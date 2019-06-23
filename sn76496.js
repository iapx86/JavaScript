/*
 *
 *	SN76496 Sound Module
 *
 */

const sn76496 = `
registerProcessor('SN76496', class extends AudioWorkletProcessor {
	constructor (options) {
		super(options);
		const {processorOptions: {clock, resolution}} = options;
		this.sampleRate = Math.floor(sampleRate);
		this.addr = 0;
		this.reg = new Uint16Array(8).fill(-1);
		this.rate = Math.floor(clock / 16);
		this.resolution = resolution;
		this.count = this.sampleRate - 1;
		this.wheel = [];
		this.cycles = 0;
		this.channel = [];
		for (let i = 0; i < 3; i++)
			this.channel.push({freq: 0, count: 0, output: 0});
		this.ncount = 0;
		this.rng = 0x10000;
		this.port.onmessage = ({data: {wheel}}) => {
			if (!wheel)
				return;
			if (this.wheel.length >= resolution) {
				this.wheel.forEach(q => q.forEach(e => this.regwrite(e)));
				this.count = this.sampleRate - 1;
				this.wheel.splice(0);
			}
			this.wheel = this.wheel.concat(wheel);
		};
		this.port.start();
	}
	process (inputs, outputs) {
		const reg = this.reg;
		outputs[0][0].fill(0).forEach((e, i, data) => {
			for (this.count += 60 * this.resolution; this.count >= this.sampleRate; this.count -= this.sampleRate) {
				const q = this.wheel.shift();
				q && q.forEach(e => this.regwrite(e));
			}
			this.channel.forEach((ch, j) => {
				ch.freq = reg[j * 2];
				const vol = ~reg[j * 2 + 1] & 0x0f;
				data[i] += ((ch.output & 1) * 2 - 1) * (vol ? Math.pow(10, (vol - 15) / 10) : 0);
			});
			const nfreq = (reg[6] & 3) === 3 ? this.channel[2].freq << 1 : 32 << (reg[6] & 3), nvol = ~reg[7] & 0x0f;
			data[i] += ((this.rng & 1) * 2 - 1) * (nvol ? Math.pow(10, (nvol - 15) / 10) : 0);
			for (this.cycles += this.rate; this.cycles >= this.sampleRate; this.cycles -= this.sampleRate) {
				this.channel.forEach(ch => {
					if ((--ch.count & 0x3ff) === 0) {
						ch.count = ch.freq;
						ch.output = ~ch.output;
					}
				});
				if ((--this.ncount & 0x7ff) === 0) {
					this.ncount = nfreq;
					if ((reg[6] & 4) !== 0)
						this.rng = this.rng >> 1 | (this.rng << 13 ^ this.rng << 14) & 0x10000;
					else
						this.rng >>= 1;
				}
			}
		});
		return true;
	}
	regwrite(data) {
		if ((data & 0x80) !== 0) {
			this.addr = data >>> 4 & 7;
			this.reg[this.addr] = this.reg[this.addr] & 0x3f0 | data & 0x0f;
		}
		else
			this.reg[this.addr] = this.reg[this.addr] & 0x0f | data << 4 & 0x3f0;
		if (this.addr === 6)
			this.rng = 0x10000;
	}
});
`;

const addSN76496 = !audioCtx ? 0 : audioCtx.audioWorklet ? audioCtx.audioWorklet.addModule('data:text/javascript,' + sn76496) : new Promise((resolve, reject) => reject());

export default class SN76496 {
	constructor({clock, resolution = 1, gain = 0.1}) {
		this.resolution = resolution;
		this.gain = gain;
		this.tmpwheel = new Array(resolution);
		if (!audioCtx)
			return;
		this.source = audioCtx.createBufferSource();
		this.gainNode = audioCtx.createGain();
		this.gainNode.gain.value = gain;
		addSN76496.then(() => {
			this.worklet = new AudioWorkletNode(audioCtx, 'SN76496', {processorOptions: {clock, resolution}});
			this.worklet.port.start();
			this.source.connect(this.worklet).connect(this.gainNode).connect(audioCtx.destination);
			this.source.start();
		}).catch(() => {
			this.sampleRate = Math.floor(audioCtx.sampleRate);
			this.addr = 0;
			this.reg = new Uint16Array(8).fill(-1);
			this.rate = Math.floor(clock / 16);
			this.count = this.sampleRate - 1;
			this.wheel = [];
			this.cycles = 0;
			this.channel = [];
			for (let i = 0; i < 3; i++)
				this.channel.push({freq: 0, count: 0, output: 0});
			this.ncount = 0;
			this.rng = 0x10000;
			this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
			this.scriptNode.onaudioprocess = ({outputBuffer}) => {
				const reg = this.reg;
				outputBuffer.getChannelData(0).fill(0).forEach((e, i, data) => {
					for (this.count += 60 * resolution; this.count >= this.sampleRate; this.count -= this.sampleRate) {
						const q = this.wheel.shift();
						q && q.forEach(e => this.regwrite(e));
					}
					this.channel.forEach((ch, j) => {
						ch.freq = reg[j * 2];
						const vol = ~reg[j * 2 + 1] & 0x0f;
						data[i] += ((ch.output & 1) * 2 - 1) * (vol ? Math.pow(10, (vol - 15) / 10) : 0);
					});
					const nfreq = (reg[6] & 3) === 3 ? this.channel[2].freq << 1 : 32 << (reg[6] & 3), nvol = ~reg[7] & 0x0f;
					data[i] += ((this.rng & 1) * 2 - 1) * (nvol ? Math.pow(10, (nvol - 15) / 10) : 0);
					for (this.cycles += this.rate; this.cycles >= this.sampleRate; this.cycles -= this.sampleRate) {
						this.channel.forEach(ch => {
							if ((--ch.count & 0x3ff) === 0) {
								ch.count = ch.freq;
								ch.output = ~ch.output;
							}
						});
						if ((--this.ncount & 0x7ff) === 0) {
							this.ncount = nfreq;
							if ((reg[6] & 4) !== 0)
								this.rng = this.rng >> 1 | (this.rng << 13 ^ this.rng << 14) & 0x10000;
							else
								this.rng >>= 1;
						}
					}
				});
			};
			this.source.connect(this.scriptNode);
			this.scriptNode.connect(this.gainNode);
			this.gainNode.connect(audioCtx.destination);
			this.source.start();
		});
	}

	mute(flag) {
		if (!audioCtx)
			return;
		this.gainNode.gain.value = flag ? 0 : this.gain;
	}

	write(data, timer = 0) {
		if (this.tmpwheel[timer])
			this.tmpwheel[timer].push(data);
		else
			this.tmpwheel[timer] = [data];
	}

	update() {
		if (this.worklet)
			this.worklet.port.postMessage({wheel: this.tmpwheel});
		else if (this.wheel) {
			if (this.wheel.length >= this.resolution) {
				this.wheel.forEach(q => q.forEach(e => this.regwrite(e)));
				this.count = this.sampleRate - 1;
				this.wheel.splice(0);
			}
			this.wheel = this.wheel.concat(this.tmpwheel);
		}
		this.tmpwheel = new Array(this.resolution);
	}

	regwrite(data) {
		if ((data & 0x80) !== 0) {
			this.addr = data >>> 4 & 7;
			this.reg[this.addr] = this.reg[this.addr] & 0x3f0 | data & 0x0f;
		}
		else
			this.reg[this.addr] = this.reg[this.addr] & 0x0f | data << 4 & 0x3f0;
		if (this.addr === 6)
			this.rng = 0x10000;
	}
}

