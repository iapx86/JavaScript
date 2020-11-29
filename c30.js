/*
 *
 *	C30 Sound Module
 *
 */

export default class C30 {
	rate;
	sampleRate;
	count;
	resolution;
	gain;
	tmpwheel = [];
	wheel = [];
	ram = new Uint8Array(0x400);
	reg = new Uint8Array(0x140);
	snd = new Float32Array(0x200);
	channel = [];

	source = audioCtx.createBufferSource();
	gainNode = audioCtx.createGain();
	scriptNode = audioCtx.createScriptProcessor(512, 1, 1);

	constructor({clock = 24000, resolution = 1, gain = 0.1} = {}) {
		this.rate = Math.floor(clock * 4096 / audioCtx.sampleRate);
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.count = this.sampleRate - 1;
		this.resolution = resolution;
		this.gain = gain;
		for (let i = 0; i < resolution; i++)
			this.tmpwheel.push([]);
		for (let i = 0; i < 8; i++)
			this.channel.push({phase: 0, ncount: 0, rng: 1, output: 0});
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
		this.ram[addr &= 0x3ff] = data, addr < 0x140 && this.tmpwheel[timer].push({addr, data});
	}

	update() {
		if (this.wheel.length > this.resolution) {
			while (this.wheel.length)
				this.wheel.shift().forEach(e => this.regwrite(e));
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
				this.wheel.length && this.wheel.shift().forEach(e => this.regwrite(e));
			this.channel.forEach((ch, j) => {
				if (j >= 4 || ~reg[0x100 | -4 + j * 8 & 0x3f] & 0x80) {
					data[i] += this.snd[reg[0x101 + j * 8] << 1 & 0x1e0 | ch.phase >>> 27] * (reg[0x100 + j * 8] & 0xf) / 15;
					ch.phase = ch.phase + (reg[0x103 + j * 8] | reg[0x102 + j * 8] << 8 | reg[0x101 + j * 8] << 16 & 0xf0000) * this.rate | 0;
				} else {
					data[i] += (ch.output * 2 - 1) * (reg[0x100 + j * 8] & 0xf) / 15;
					for (ch.ncount += reg[0x103 + j * 8] * this.rate; ch.ncount >= 0x80000; ch.ncount -= 0x80000)
						ch.output ^= ch.rng + 1 >> 1 & 1, ch.rng = (ch.rng ^ (~ch.rng & 1) - 1 & 0x28000) >> 1;
				}
			});
		});
	}

	regwrite({addr, data}) {
		this.reg[addr] = data, addr < 0x100 && (this.snd[addr * 2] = (data >> 4) * 2 / 15 - 1, this.snd[1 + addr * 2] = (data & 0xf) * 2 / 15 - 1);
	}
}

