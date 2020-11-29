/*
 *
 *	Pole Position Sound Module
 *
 */

export default class PolePositionSound {
	snd;
	rate;
	sampleRate;
	count;
	resolution;
	gain;
	tmpwheel = [];
	wheel = [];
	ram = new Uint8Array(0x400);
	reg = new Uint8Array(0x40);
	phase = new Uint32Array(8);

	source = audioCtx.createBufferSource();
	gainNode = audioCtx.createGain();
	scriptNode = audioCtx.createScriptProcessor(512, 1, 1);

	constructor({SND, resolution = 1, gain = 0.1}) {
		this.snd = Float32Array.from(SND, e => (e & 0xf) * 2 / 15 - 1);
		this.rate = Math.floor(2048 * 48000 / audioCtx.sampleRate);
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

	read(addr) {
		return this.ram[addr & 0x3ff];
	}

	write(addr, data, timer = 0) {
		this.ram[addr &= 0x3ff] = data, addr >= 0x3c0 && this.tmpwheel[timer].push({addr: addr & 0x3f, data});
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
			for (let j = 2; j < 8; j++) {
				const vol = reg[2 + j * 4] >> 4 || reg[3 + j * 4] >> 4 || reg[3 + j * 4] & 0xf || reg[0x23 + j * 4] >> 4;
				data[i] += this.snd[reg[0x23 + j * 4] << 5 & 0xe0 | this.phase[j] >>> 27] * vol / 15;
				this.phase[j] = this.phase[j] + (reg[j * 4] << 1 | reg[1 + j * 4] << 9) * this.rate | 0;
			}
		});
	}
}

