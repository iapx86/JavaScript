/*
 *
 *	C30 Sound Module
 *
 */

const c30 = `
registerProcessor('C30', class extends AudioWorkletProcessor {
	constructor (options) {
		super(options);
		const {processorOptions: {resolution}} = options;
		this.sampleRate = Math.floor(sampleRate);
		this.reg = new Uint8Array(0x140);
		this.snd = new Float32Array(0x200);
		this.rate = Math.floor(2048 * 48000 / sampleRate);
		this.resolution = resolution;
		this.count = this.sampleRate - 1;
		this.wheel = [];
		this.channel = [];
		for (let i = 0; i < 8; i++)
			this.channel.push({phase: 0, ncount: 0, rng: 1, output: 0});
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
				if (j >= 4 || (reg[0x100 | -4 + j * 8 & 0x3f] & 0x80) === 0) {
					data[i] += this.snd[reg[0x101 + j * 8] << 1 & 0x1e0 | ch.phase >>> 27] * (reg[0x100 + j * 8] & 0x0f) / 15;
					ch.phase += (reg[0x103 + j * 8] | reg[0x102 + j * 8] << 8 | reg[0x101 + j * 8] << 16 & 0xf0000) * this.rate;
				}
				else {
					data[i] += (ch.output * 2 - 1) * (reg[0x100 + j * 8] & 0x0f) / 15;
					for (ch.ncount += reg[0x103 + j * 8] * this.rate; ch.ncount >= 0x80000; ch.ncount -= 0x80000) {
						ch.output ^= ch.rng + 1 >>> 1 & 1;
						ch.rng = (ch.rng ^ (~ch.rng & 1) - 1 & 0x28000) >>> 1;
					}
				}
			});
		});
		return true;
	}
	regwrite({addr, data}) {
		this.reg[addr] = data;
		if (addr >= 0x100)
			return;
		this.snd[addr * 2] = (data >>> 4) * 2 / 15 - 1;
		this.snd[1 + addr * 2] = (data & 0x0f) * 2 / 15 - 1;
	}
});
`;

const addC30 = audioCtx.audioWorklet ? audioCtx.audioWorklet.addModule('data:text/javascript,' + c30) : new Promise((resolve, reject) => reject());

class C30 {
	constructor({resolution = 1, gain = 0.1} = {}) {
		this.ram = new Uint8Array(0x400);
		this.resolution = resolution;
		this.gain = gain;
		this.tmpwheel = new Array(resolution);
		this.source = audioCtx.createBufferSource();
		this.gainNode = audioCtx.createGain();
		this.gainNode.gain.value = gain;
		addC30.then(() => {
			this.worklet = new AudioWorkletNode(audioCtx, 'C30', {processorOptions: {resolution}});
			this.worklet.port.start();
			this.source.connect(this.worklet).connect(this.gainNode).connect(audioCtx.destination);
			this.source.start();
		}).catch(() => {
			this.sampleRate = Math.floor(audioCtx.sampleRate);
			this.reg = new Uint8Array(0x140);
			this.snd = new Float32Array(0x200);
			this.rate = Math.floor(2048 * 48000 / audioCtx.sampleRate);
			this.count = this.sampleRate - 1;
			this.wheel = [];
			this.channel = [];
			for (let i = 0; i < 8; i++)
				this.channel.push({phase: 0, ncount: 0, rng: 1, output: 0});
			this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
			this.scriptNode.onaudioprocess = ({outputBuffer}) => {
				const reg = this.reg;
				outputBuffer.getChannelData(0).fill(0).forEach((e, i, data) => {
					for (this.count += 60 * resolution; this.count >= this.sampleRate; this.count -= this.sampleRate) {
						const q = this.wheel.shift();
						q && q.forEach(e => this.regwrite(e));
					}
					this.channel.forEach((ch, j) => {
						if (j >= 4 || (reg[0x100 | -4 + j * 8 & 0x3f] & 0x80) === 0) {
							data[i] += this.snd[reg[0x101 + j * 8] << 1 & 0x1e0 | ch.phase >>> 27] * (reg[0x100 + j * 8] & 0x0f) / 15;
							ch.phase += (reg[0x103 + j * 8] | reg[0x102 + j * 8] << 8 | reg[0x101 + j * 8] << 16 & 0xf0000) * this.rate;
						}
						else {
							data[i] += (ch.output * 2 - 1) * (reg[0x100 + j * 8] & 0x0f) / 15;
							for (ch.ncount += reg[0x103 + j * 8] * this.rate; ch.ncount >= 0x80000; ch.ncount -= 0x80000) {
								ch.output ^= ch.rng + 1 >>> 1 & 1;
								ch.rng = (ch.rng ^ (~ch.rng & 1) - 1 & 0x28000) >>> 1;
							}
						}
					});
				});
			};
			this.source.connect(this.scriptNode);
			this.scriptNode.connect(this.gainNode);
			this.gainNode.connect(audioCtx.destination);
			this.source.start();
		});
	}

	mute(flag) {
		this.gainNode.gain.value = flag ? 0 : this.gain;
	}

	read(addr) {
		return this.ram[addr & 0x3ff];
	}

	write(addr, data, timer = 0) {
		this.ram[addr &= 0x3ff] = data;
		if (addr >= 0x140)
			return;
		if (this.tmpwheel[timer])
			this.tmpwheel[timer].push({addr, data});
		else
			this.tmpwheel[timer] = [{addr, data}];
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

	regwrite({addr, data}) {
		this.reg[addr] = data;
		if (addr >= 0x100)
			return;
		this.snd[addr * 2] = (data >>> 4) * 2 / 15 - 1;
		this.snd[1 + addr * 2] = (data & 0x0f) * 2 / 15 - 1;
	}
}

