/*
 *
 *	K005289 Sound Module
 *
 */

const k005289 = `
registerProcessor('K005289', class extends AudioWorkletProcessor {
	constructor (options) {
		super(options);
		const {processorOptions: {SND, clock, resolution}} = options;
		this.sampleRate = Math.floor(sampleRate);
		this.reg = new Uint16Array(4);
		this.snd = Float32Array.from(SND, e => (e & 0x0f) * 2 / 15 - 1);
		this.rate = clock / sampleRate * (1 << 27);
		this.resolution = resolution;
		this.count = this.sampleRate - 1;
		this.wheel = [];
		this.phase = new Uint32Array(2);
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
			for (let j = 0; j < 2; j++)
				if (reg[j + 2]) {
					data[i] += this.snd[j << 8 | reg[j] & 0xe0 | this.phase[j] >>> 27] * (reg[j] & 0x0f) / 15;
					this.phase[j] += Math.floor(this.rate / reg[j + 2]);
				}
		});
		return true;
	}
});
`;

const addK005289 = !audioCtx ? 0 : audioCtx.audioWorklet ? audioCtx.audioWorklet.addModule('data:text/javascript,' + k005289) : new Promise((resolve, reject) => reject());

export default class K005289 {
	constructor({SND, clock, resolution = 1, gain = 0.1}) {
		this.resolution = resolution;
		this.gain = gain;
		this.tmpwheel = new Array(resolution);
		if (!audioCtx)
			return;
		this.source = audioCtx.createBufferSource();
		this.gainNode = audioCtx.createGain();
		this.gainNode.gain.value = gain;
		addK005289.then(() => {
			this.worklet = new AudioWorkletNode(audioCtx, 'K005289', {processorOptions: {SND, clock, resolution}});
			this.worklet.port.start();
			this.source.connect(this.worklet).connect(this.gainNode).connect(audioCtx.destination);
			this.source.start();
		}).catch(() => {
			this.sampleRate = Math.floor(audioCtx.sampleRate);
			this.reg = new Uint16Array(4);
			this.snd = Float32Array.from(SND, e => (e & 0x0f) * 2 / 15 - 1);
			this.rate = clock / audioCtx.sampleRate * (1 << 27);
			this.count = this.sampleRate - 1;
			this.wheel = [];
			this.phase = new Uint32Array(2);
			this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
			this.scriptNode.onaudioprocess = ({outputBuffer}) => {
				const reg = this.reg;
				outputBuffer.getChannelData(0).fill(0).forEach((e, i, data) => {
					for (this.count += 60 * resolution; this.count >= this.sampleRate; this.count -= this.sampleRate) {
						const q = this.wheel.shift();
						q && q.forEach(({addr, data}) => reg[addr] = data);
					}
					for (let j = 0; j < 2; j++)
						if (reg[j + 2]) {
							data[i] += this.snd[j << 8 | reg[j] & 0xe0 | this.phase[j] >>> 27] * (reg[j] & 0x0f) / 15;
							this.phase[j] += Math.floor(this.rate / reg[j + 2]);
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

	write(addr, data, timer = 0) {
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

