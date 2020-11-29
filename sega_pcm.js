/*
 *
 *	SEGA PCM Sound Module
 *
 */

export default class SegaPCM {
	pcm;
	rate;
	sampleRate;
	count;
	resolution;
	gain;
	tmpwheel = [];
	wheel = [];
	ram = new Uint8Array(0x800);
	reg = new Uint8Array(0x100);
	cycles = 0;
	low = new Uint8Array(16);

	source = audioCtx.createBufferSource();
	gainNode = audioCtx.createGain();
	scriptNode = audioCtx.createScriptProcessor(512, 1, 1);

	constructor({PCM, clock, resolution = 1, gain = 1}) {
		this.pcm = Float32Array.from(PCM, e => e * 2 / 255 - 1);
		this.rate = Math.floor(clock / 128);
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
		return this.ram[addr & 0x7ff];
	}

	write(addr, data, timer = 0) {
		this.ram[addr &= 0x7ff] = data, addr < 0x100 && this.tmpwheel[timer].push({addr, data});
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
			for (let j = 0; j < 0x80; j += 8)
				if (~reg[0x86 | j] & 1) {
					const vol = ((reg[2 | j] & 0x7f) + (reg[3 | j] & 0x7f)) / 0xfe;
					data[i] += this.pcm[reg[0x86 | j] << 12 & 0x70000 | reg[0x85 | j] << 8 | reg[0x84 | j]] * vol;
				}
			for (this.cycles += this.rate; this.cycles >= this.sampleRate; this.cycles -= this.sampleRate)
				for (let j = 0; j < 0x80; j += 8)
					if (~reg[0x86 | j] & 1) {
						const addr = (reg[0x85 | j] << 16 | reg[0x84 | j] << 8 | this.low[j >> 3]) + reg[7 | j];
						reg[0x85 | j] = addr >> 16, reg[0x84 | j] = addr >> 8, this.low[j >> 3] = addr;
						if (reg[0x85 | j] === (reg[6 | j] + 1 & 0xff)) {
							this.low[j >> 3] = 0;
							if (~reg[0x86 | j] & 2)
								reg[0x85 | j] = reg[5 | j], reg[0x84 | j] = reg[4 | j];
							else
								reg[0x86 | j] |= 1;
						}
					}
		});
	}
}

