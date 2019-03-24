/*
 *
 *	Pac-Man Sound Module
 *
 */

const pacmanSound = `
registerProcessor('PacManSound', class extends AudioWorkletProcessor {
	constructor (options) {
		const {SND, sampleRate, resolution} = options.processorOptions;
		super(options);
		this.reg = new Uint8Array(0x20);
		this.snd = Float32Array.from(SND, e => (e & 0x0f) * 2 / 15 - 1);
		this.rate = Math.floor(8192 * 48000 / sampleRate);
		this.sampleRate = sampleRate;
		this.resolution = resolution;
		this.count = sampleRate - 1;
		this.wheel = [];
		this.phase = new Uint32Array(3);
		this.port.onmessage = ({data: {wheel}}) => {
			if (!wheel)
				return;
			if (this.wheel.length >= resolution) {
				this.wheel.forEach(q => q.forEach(({addr, data}) => this.reg[addr] = data));
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
			for (this.count += 60 * this.resolution; this.count >= this.sampleRate; this.count -= this.sampleRate) {
				const q = this.wheel.shift();
				q && q.forEach(({addr, data}) => reg[addr] = data);
			}
			for (let j = 0; j < 3; j++) {
				data[i] += this.snd[reg[0x05 + j * 5] << 5 & 0xe0| this.phase[j] >>> 27] * reg[0x15 + j * 5] / 15;
				this.phase[j] += ((j ? 0 : reg[0x10]) | reg[0x11 + j * 5] << 4 | reg[0x12 + j * 5] << 8 | reg[0x13 + j * 5] << 12 | reg[0x14 + j * 5] << 16) * this.rate
			}
		});
		return true;
	}
});
`;

const addPacManSound = audioCtx.audioWorklet.addModule('data:text/javascript,' + pacmanSound);

class PacManSound {
	constructor({SND, resolution = 1, gain = 0.1}) {
		this.reg = new Uint8Array(0x20);
		this.resolution = resolution;
		this.gain = gain;
		this.wheel = new Array(resolution);
		this.source = new AudioBufferSourceNode(audioCtx);
		this.gainNode = new GainNode(audioCtx, {gain});
		addPacManSound.then(() => {
			this.worklet = new AudioWorkletNode(audioCtx, 'PacManSound', {processorOptions: {SND, sampleRate: audioCtx.sampleRate, resolution}});
			this.worklet.port.start();
			this.source.connect(this.worklet).connect(this.gainNode).connect(audioCtx.destination);
			this.source.start();
		});
	}

	mute(flag) {
		this.gainNode.gain.value = flag ? 0 : this.gain;
	}

	read(addr) {
		return this.reg[addr & 0x1f];
	}

	write(addr, data, timer = 0) {
		this.reg[addr &= 0x1f] = data &= 0x0f;
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

