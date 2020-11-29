/*
 *
 *	Pac-Man Sound Module
 *
 */

export default class PacManSound {
	snd;
	rate;
	sampleRate;
	count;
	resolution;
	gain;
	tmpwheel = [];
	wheel = [];
	reg = new Uint8Array(0x20);
	phase = new Uint32Array(3);

	source = audioCtx.createBufferSource();
	gainNode = audioCtx.createGain();
	scriptNode = audioCtx.createScriptProcessor(512, 1, 1);

	constructor({SND, resolution = 1, gain = 0.1}) {
		this.snd = Float32Array.from(SND, e => (e & 0xf) * 2 / 15 - 1);
		this.rate = Math.floor(8192 * 48000 / audioCtx.sampleRate);
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.count = this.sampleRate - 1;
		this.resolution = resolution;
		this.gain = gain;
		for (let i = 0; i < resolution; i++)
			this.tmpwheel.push([]);
		this.gainNode.gain.value = gain;
		this.scriptNode.onaudioprocess = ({outputBuffer}) => this.makeSound(outputBuffer.getChannelData(0).fill(0));
		this.source.connect(this.scriptNode).connect(this.gainNode).connect(audioCtx.destination);
		this.source.start();
	}

	mute(flag) {
		this.gainNode.gain.value = flag ? 0 : this.gain;
	}

	write(addr, data, timer = 0) {
		this.tmpwheel[timer].push({addr: addr & 0x1f, data: data & 0xf});
	}

	update() {
		if (this.wheel.length > this.resolution) {
			while (this.wheel.length)
				this.wheel.shift().forEach(({addr, data}) => this.reg[addr] = data);
			this.count = this.sampleRate - 1;
		}
		this.tmpwheel.forEach(e => this.wheel.push(e));
		for (let i = 0; i < this.resolution; i++)
			this.tmpwheel[i] = [];
	}

	makeSound(data) {
		const reg = this.reg;
		data.forEach((e, i) => {
			for (this.count += 60 * this.resolution; this.count >= this.sampleRate; this.count -= this.sampleRate)
				this.wheel.length && this.wheel.shift().forEach(({addr, data}) => reg[addr] = data);
			for (let j = 0; j < 3; j++) {
				data[i] += this.snd[reg[0x05 + j * 5] << 5 & 0xe0 | this.phase[j] >>> 27] * reg[0x15 + j * 5] / 15;
				this.phase[j] = this.phase[j] + ((j ? 0 : reg[0x10]) | reg[0x11 + j * 5] << 4 | reg[0x12 + j * 5] << 8 | reg[0x13 + j * 5] << 12 | reg[0x14 + j * 5] << 16) * this.rate | 0;
			}
		});
	}
}

