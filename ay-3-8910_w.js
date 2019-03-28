/*
 *
 *	AY-3-8910 Sound Module
 *
 */

const ay_3_8910 = `
registerProcessor('AY_3_8910', class extends AudioWorkletProcessor {
	constructor (options) {
		super(options);
		const {processorOptions: {clock, resolution}} = options;
		this.reg = new Uint8Array(0x10);
		this.rate = Math.floor(clock / 8);
		this.resolution = resolution;
		this.count = sampleRate - 1;
		this.wheel = [];
		this.cycles = 0;
		this.channel = [];
		for (let i = 0; i < 3; i++)
			this.channel.push({freq: 0, count: 0, output: 0});
		this.ncount = 0;
		this.rng = 0xffff;
		this.ecount = 0;
		this.step = 0;
		this.port.onmessage = ({data: {wheel}}) => {
			if (!wheel)
				return;
			if (this.wheel.length >= resolution) {
				this.wheel.forEach(q => q.forEach(e => this.write(e)));
				this.count = sampleRate - 1;
				this.wheel = [];
			}
			this.wheel = this.wheel.concat(wheel);
		};
		this.port.start();
	}
	process (inputs, outputs) {
		const reg = this.reg;
		outputs[0][0].fill(0).forEach((e, i, data) => {
			for (this.count += 60 * this.resolution; this.count >= sampleRate; this.count -= sampleRate) {
				const q = this.wheel.shift();
				q && q.forEach(e => this.write(e));
			}
			const nfreq = reg[6] & 0x1f, efreq = reg[11] | reg[12] << 8, etype = reg[13];
			const evol = (~this.step ^ ((((etype ^ etype >> 1) & this.step >> 4 ^ ~etype >> 2) & 1) - 1)) & (~etype >> 3 & this.step >> 4 & 1) - 1 & 15;
			this.channel.forEach((ch, j) => {
				ch.freq = reg[j * 2] | reg[1 + j * 2] << 8 & 0xf00;
				const vol = (reg[8 + j] >> 4 & 1) !== 0 ? evol : reg[8 + j] & 0x0f;
				data[i] += (((reg[7] >> j | ch.output) & (reg[7] >> j + 3 | this.rng) & 1) * 2 - 1) * (vol ? Math.pow(2, (vol - 15) / 2) : 0);
			});
			for (this.cycles += this.rate; this.cycles >= sampleRate; this.cycles -= sampleRate) {
				this.channel.forEach(ch => {
					if (++ch.count >= ch.freq) {
						ch.count = 0;
						ch.output = ~ch.output;
					}
				});
				if (++this.ncount >= nfreq << 1) {
					this.ncount = 0;
					this.rng = (this.rng >> 16 ^ this.rng >> 13 ^ 1) & 1 | this.rng << 1;
				}
				if (++this.ecount >= efreq) {
					this.ecount = 0;
					this.step += ((this.step < 16) | etype >> 3 & ~etype & 1) - (this.step >= 47) * 32;
				}
			}
		});
		return true;
	}
	write({addr, data}) {
		this.reg[addr] = data;
		if (addr === 13)
			this.step = 0;
	}
});
`;

const addAY_3_8910 = audioCtx.audioWorklet.addModule('data:text/javascript,' + ay_3_8910);

class AY_3_8910 {
	constructor({clock, resolution = 1, gain = 0.1}) {
		this.reg = new Uint8Array(0x10);
		this.resolution = resolution;
		this.gain = gain;
		this.wheel = new Array(resolution);
		this.source = new AudioBufferSourceNode(audioCtx);
		this.gainNode = new GainNode(audioCtx, {gain});
		addAY_3_8910.then(() => {
			this.worklet = new AudioWorkletNode(audioCtx, 'AY_3_8910', {processorOptions: {clock, resolution}});
			this.worklet.port.start();
			this.source.connect(this.worklet).connect(this.gainNode).connect(audioCtx.destination);
			this.source.start();
		});
	}

	mute(flag) {
		this.gainNode.gain.value = flag ? 0 : this.gain;
	}

	read(addr) {
		return this.reg[addr & 0x0f];
	}

	write(addr, data, timer = 0) {
		this.reg[addr &= 0x0f] = data;
		if (addr >= 0x0e)
			return;
		if (this.wheel[timer])
			this.wheel[timer].push({addr, data});
		else
			this.wheel[timer] = [{addr, data}];
	}

	update() {
		this.worklet && this.worklet.port.postMessage({wheel: this.wheel});
		this.wheel = new Array(this.resolution);
	}
}

