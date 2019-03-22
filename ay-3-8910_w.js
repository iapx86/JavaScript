/*
 *
 *	AY-3-8910 Sound Module
 *
 */

const ay_3_8910 = `
registerProcessor('AY_3_8910', class extends AudioWorkletProcessor {
	constructor (options) {
		super(options);
		this.reg = new Uint8Array(0x10);
		this.count = 0;
		this.wheel = [];
		this.cycles = 0;
		this.channel = [];
		for (let i = 0; i < 3; i++)
			this.channel.push({freq: 0, tone: false, noise: false, vol: 0, env: false, count: 0, output: 0});
		this.nfreq = 0;
		this.efreq = 0;
		this.etype = 0;
		this.ncount = 0;
		this.rng = 0xffff;
		this.ecount = 0;
		this.step = 0;
		this.port.onmessage = ({data: {clock, sampleRate, resolution, wheel}}) => {
			if (clock)
				this.rate = Math.floor(clock / 8);
			if (sampleRate)
				this.sampleRate = sampleRate;
			if (resolution)
				this.resolution = resolution;
			if (wheel) {
				if (this.wheel.length >= this.resolution) {
					this.wheel.forEach(q => q.forEach(e => this.write(e)));
					this.count = 0;
					this.wheel = [];
				}
				if (this.wheel.length)
					this.wheel = this.wheel.concat(wheel);
				else {
					this.wheel = wheel;
					const q = this.wheel.shift();
					q && q.forEach(e => this.write(e));
					this.update();
				}
			}
		};
		this.port.start();
	}
	process (inputs, outputs) {
		outputs[0][0].fill(0).forEach((e, i, data) => {
			const evol = (~this.step ^ ((((this.etype ^ this.etype >> 1) & this.step >> 4 ^ ~this.etype >> 2) & 1) - 1)) & (~this.etype >> 3 & this.step >> 4 & 1) - 1 & 15;
			this.channel.forEach(ch => {
				const vol = ch.env ? evol : ch.vol;
				data[i] += (((ch.output | ch.tone) & (this.rng | ch.noise) & 1) * 2 - 1) * (vol ? Math.pow(2, (vol - 15) / 2) : 0);
			});
			for (this.count += 60 * this.resolution; this.count >= this.sampleRate; this.count -= this.sampleRate) {
				const q = this.wheel.shift();
				q && q.forEach(e => this.write(e));
			}
			this.update();
			for (this.cycles += this.rate; this.cycles >= this.sampleRate; this.cycles -= this.sampleRate) {
				this.channel.forEach(ch => {
					if (++ch.count >= ch.freq) {
						ch.count = 0;
						ch.output = ~ch.output;
					}
				});
				if (++this.ncount >= this.nfreq << 1) {
					this.ncount = 0;
					this.rng = (this.rng >> 16 ^ this.rng >> 13 ^ 1) & 1 | this.rng << 1;
				}
				if (++this.ecount >= this.efreq) {
					this.ecount = 0;
					this.step += ((this.step < 16) | this.etype >> 3 & ~this.etype & 1) - (this.step >= 47) * 32;
				}
			}
		});
		return true;
	}
	update() {
		const reg = this.reg, [ch0, ch1, ch2] = this.channel;
		ch0.freq = reg[0] | reg[1] << 8 & 0xf00;
		ch1.freq = reg[2] | reg[3] << 8 & 0xf00;
		ch2.freq = reg[4] | reg[5] << 8 & 0xf00;
		this.nfreq = reg[6] & 0x1f;
		ch0.tone = reg[7];
		ch1.tone = reg[7] >> 1;
		ch2.tone = reg[7] >> 2;
		ch0.noise = reg[7] >> 3;
		ch1.noise = reg[7] >> 4;
		ch2.noise = reg[7] >> 5;
		ch0.vol = reg[8] & 0x0f;
		ch0.env = (reg[8] & 0x10) !== 0;
		ch1.vol = reg[9] & 0x0f;
		ch1.env = (reg[9] & 0x10) !== 0;
		ch2.vol = reg[10] & 0x0f;
		ch2.env = (reg[10] & 0x10) !== 0;
		this.efreq = reg[11] | reg[12] << 8;
		this.etype = reg[13];
	}
	write({addr, data}) {
		this.reg[addr] = data;
		if (addr === 13)
			this.step = 0;
	}
});
`;

const ay_3_8910Promise = audioCtx.audioWorklet.addModule('data:text/javascript,' + ay_3_8910);

class AY_3_8910 {
	constructor({clock, resolution = 1, gain = 0.1}) {
		this.reg = new Uint8Array(0x10);
		this.resolution = resolution;
		this.gain = gain;
		this.wheel = new Array(resolution);
		this.source = audioCtx.createBufferSource();
		this.gainNode = audioCtx.createGain();
		this.gainNode.gain.value = this.gain;
		ay_3_8910Promise.then(() => {
			this.worklet = new AudioWorkletNode(audioCtx, 'AY_3_8910');
			this.worklet.port.start();
			this.worklet.port.postMessage({clock, sampleRate: audioCtx.sampleRate, resolution});
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

