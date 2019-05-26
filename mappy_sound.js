/*
 *
 *	Mappy Sound Module
 *
 */

const mappySound = `
registerProcessor('MappySound', class extends AudioWorkletProcessor {
	constructor (options) {
		super(options);
		const {processorOptions: {SND, resolution}} = options;
		this.sampleRate = Math.floor(sampleRate);
		this.reg = new Uint8Array(0x40);
		this.snd = Float32Array.from(SND, e => (e & 0x0f) * 2 / 15 - 1);
		this.rate = Math.floor(2048 * 48000 / sampleRate);
		this.resolution = resolution;
		this.count = this.sampleRate - 1;
		this.wheel = [];
		this.phase = new Uint32Array(8);
		this.port.onmessage = ({data: {wheel}}) => {
			if (!wheel)
				return;
			if (this.wheel.length >= resolution) {
				this.wheel.forEach(q => q.forEach(({addr, data}) => this.reg[addr] = data));
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
				q && q.forEach(({addr, data}) => reg[addr] = data);
			}
			for (let j = 0; j < 8; j++) {
				data[i] += this.snd[reg[6 + j * 8] << 1 & 0xe0 | this.phase[j] >>> 27] * (reg[3 + j * 8] & 0x0f) / 15;
				this.phase[j] += (reg[4 + j * 8] | reg[5 + j * 8] << 8 | reg[6 + j * 8] << 16 & 0xf0000) * this.rate;
			}
		});
		return true;
	}
});
`;

const addMappySound = !audioCtx ? 0 : audioCtx.audioWorklet ? audioCtx.audioWorklet.addModule('data:text/javascript,' + mappySound) : new Promise((resolve, reject) => reject());

class MappySound {
	constructor({SND, resolution = 1, gain = 0.1}) {
		this.ram = new Uint8Array(0x400);
		this.resolution = resolution;
		this.gain = gain;
		this.tmpwheel = new Array(resolution);
		if (!audioCtx)
			return;
		this.source = audioCtx.createBufferSource();
		this.gainNode = audioCtx.createGain();
		this.gainNode.gain.value = gain;
		addMappySound.then(() => {
			this.worklet = new AudioWorkletNode(audioCtx, 'MappySound', {processorOptions: {SND, resolution}});
			this.worklet.port.start();
			this.source.connect(this.worklet).connect(this.gainNode).connect(audioCtx.destination);
			this.source.start();
		}).catch(() => {
			this.sampleRate = Math.floor(audioCtx.sampleRate);
			this.reg = new Uint8Array(0x40);
			this.snd = Float32Array.from(SND, e => (e & 0x0f) * 2 / 15 - 1);
			this.rate = Math.floor(2048 * 48000 / audioCtx.sampleRate);
			this.count = this.sampleRate - 1;
			this.wheel = [];
			this.phase = new Uint32Array(8);
			this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
			this.scriptNode.onaudioprocess = ({outputBuffer}) => {
				const reg = this.reg;
				outputBuffer.getChannelData(0).fill(0).forEach((e, i, data) => {
					for (this.count += 60 * resolution; this.count >= this.sampleRate; this.count -= this.sampleRate) {
						const q = this.wheel.shift();
						q && q.forEach(({addr, data}) => reg[addr] = data);
					}
					for (let j = 0; j < 8; j++) {
						data[i] += this.snd[reg[6 + j * 8] << 1 & 0xe0 | this.phase[j] >>> 27] * (reg[3 + j * 8] & 0x0f) / 15;
						this.phase[j] += (reg[4 + j * 8] | reg[5 + j * 8] << 8 | reg[6 + j * 8] << 16 & 0xf0000) * this.rate;
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

	read(addr) {
		return this.ram[addr & 0x3ff];
	}

	write(addr, data, timer = 0) {
		this.ram[addr &= 0x3ff] = data;
		if (addr >= 0x40)
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
				this.wheel.forEach(q => q.forEach(({addr, data}) => this.reg[addr] = data));
				this.count = this.sampleRate - 1;
				this.wheel.splice(0);
			}
			this.wheel = this.wheel.concat(this.tmpwheel);
		}
		this.tmpwheel = new Array(this.resolution);
	}
}

