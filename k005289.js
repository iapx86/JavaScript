/*
 *
 *	K005289 Sound Module
 *
 */

export default class K005289 {
	snd;
	rate;
	sampleRate;
	count;
	resolution;
	gain;
	tmpwheel = [];
	wheel = [];
	reg = new Uint16Array(4);
	phase = new Uint32Array(2);

	source;
	gainNode;
	scriptNode;

	constructor({SND, clock, resolution = 1, gain = 0.1}) {
		this.snd = Float32Array.from(SND, e => (e & 0xf) * 2 / 15 - 1);
		this.rate = clock / audioCtx.sampleRate * (1 << 27);
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.count = this.sampleRate - 1;
		this.resolution = resolution;
		this.gain = gain;
		for (let i = 0; i < resolution; i++)
			this.tmpwheel.push([]);
		if (!audioCtx)
			return;
		this.source = audioCtx.createBufferSource();
		this.gainNode = audioCtx.createGain();
		this.gainNode.gain.value = gain;
		this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
		this.scriptNode.onaudioprocess = ({outputBuffer}) => this.makeSound(outputBuffer.getChannelData(0).fill(0));
		this.source.connect(this.scriptNode);
		this.scriptNode.connect(this.gainNode);
		this.gainNode.connect(audioCtx.destination);
		this.source.start();
	}

	mute(flag) {
		if (!audioCtx)
			return;
		this.gainNode.gain.value = flag ? 0 : this.gain;
	}

	write(addr, data, timer = 0) {
		this.tmpwheel[timer].push({addr, data});
	}

	update() {
		if (audioCtx) {
			if (this.wheel.length > this.resolution) {
				while (this.wheel.length)
					this.wheel.shift().forEach(({addr, data}) => this.reg[addr] = data);
				this.count = this.sampleRate - 1;
			}
			this.tmpwheel.forEach(e => this.wheel.push(e));
		}
		for (let i = 0; i < this.resolution; i++)
			this.tmpwheel[i] = [];
	}

	makeSound(data) {
		const reg = this.reg;
		data.forEach((e, i) => {
			for (this.count += 60 * this.resolution; this.count >= this.sampleRate; this.count -= this.sampleRate)
				if (this.wheel.length)
					this.wheel.shift().forEach(({addr, data}) => reg[addr] = data);
			for (let j = 0; j < 2; j++)
				if (reg[j + 2]) {
					data[i] += this.snd[j << 8 | reg[j] & 0xe0 | this.phase[j] >>> 27] * (reg[j] & 0xf) / 15;
					this.phase[j] = this.phase[j] + Math.floor(this.rate / reg[j + 2]) | 0;
				}
		});
	}
}

