/*
 *
 *	K054539 Sound Module
 *
 */

export default class K054539 {
	pcm;
	rate;
	sampleRate;
	count;
	resolution;
	gain;
	tmpwheel = [];
	wheel = [];
	ram = new Uint8Array(0x400);
	reg = new Uint8Array(0x400);
	cycles = 0;
	channel = [];

	source;
	gainNode;
	scriptNode;

	constructor({PCM, clock, resolution = 1, gain = 1}) {
		this.pcm = PCM;
		this.rate = Math.floor(clock / 384);
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.count = this.sampleRate - 1;
		this.resolution = resolution;
		this.gain = gain;
		for (let i = 0; i < resolution; i++)
			this.tmpwheel.push([]);
		for (let i = 0; i < 8; i++)
			this.channel.push({play: false, output: 0, addr: 0, frac: 0});
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

	read(addr) {
		return (addr &= 0x3ff) < 0x230 ? this.ram[addr] : 0xff;
	}

	write(addr, data, timer = 0) {
		switch (addr &= 0x3ff) {
		case 0x214:
			data &= ~this.ram[0x22c];
			for (let i = 0; i < 8; i++)
				if ((data & 1 << i) !== 0 && (this.ram[0x200 | i << 1] & 0xc) === 0xc)
					data &= ~(1 << i);
			this.ram[0x22c] |= data;
			break;
		case 0x215:
			this.ram[0x22c] &= ~data;
			break;
		}
		this.ram[addr] = data;
		if (addr < 0x230)
			this.tmpwheel[timer].push({addr, data});
	}

	update() {
		if (audioCtx) {
			if (this.wheel.length > this.resolution) {
				while (this.wheel.length)
					this.wheel.shift().forEach(e => this.regwrite(e));
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
					this.wheel.shift().forEach(e => this.regwrite(e));
			if ((reg[0x22f] & 1) === 0)
				return;
			this.channel.forEach((ch, j) => ch.play && (data[i] += ch.output / 32767 * Math.pow(10, -36 / 0x40 / 20 * reg[3 | j << 5])));
			for (this.cycles += this.rate; this.cycles >= this.sampleRate; this.cycles -= this.sampleRate)
				this.channel.forEach((ch, j) => {
					if (!ch.play)
						return;
					const rate = reg[j << 5] | reg[1 | j << 5] << 8 | reg[2 | j << 5] << 16;
					const loop = reg[8 | j << 5] | reg[9 | j << 5] << 8 | reg[0xa | j << 5] << 16;
					let val;
outer:				switch (reg[0x200 | j << 1] & 0x2c) {
					case 0:
						for (ch.frac += rate; ch.frac >= 0x10000; ch.frac -= 0x10000)
							if ((ch.output = this.pcm[ch.addr += 1] << 24 >> 16) === -0x8000) {
								if ((reg[0x201 | j << 1] & 1) === 0)
									break outer;
								ch.output = this.pcm[ch.addr = loop] << 24 >> 16;
							}
						return;
					case 4:
						for (ch.frac += rate; ch.frac >= 0x10000; ch.frac -= 0x10000)
							if ((ch.output = (this.pcm[ch.addr += 2] | this.pcm[ch.addr + 1] << 8) << 16 >> 16) === -0x8000) {
								if ((reg[0x201 | j << 1] & 1) === 0)
									break outer;
								ch.output = (this.pcm[ch.addr = loop] | this.pcm[ch.addr + 1] << 8) << 16 >> 16;
							}
						return;
					case 8:
						for (ch.frac += rate; ch.frac >= 0x10000; ch.frac -= 0x10000) {
							if ((val = this.pcm[(ch.addr += 1) >> 1]) === 0x88) {
								if ((reg[0x201 | j << 1] & 1) === 0)
									break outer;
								val = this.pcm[(ch.addr = loop << 1) >> 1];
							}
							ch.output += [0, 1, 4, 9, 16, 25, 36, 49, -64, -49, -36, -25, -16, -9, -4, -1][(ch.addr & 1) === 0 ? val & 15 : val >> 4] << 8;
							ch.output = ch.output < -0x7f00 ? -0x7f00 : ch.output > 0x7f00 ? 0x7f00 : ch.output;
						}
						return;
					case 0x20:
						for (ch.frac -= rate; ch.frac < 0; ch.frac += 0x10000)
							if ((ch.output = this.pcm[ch.addr -= 1] << 24 >> 16) === -0x8000) {
								if ((reg[0x201 | j << 1] & 1) === 0)
									break outer;
								ch.output = this.pcm[ch.addr = loop] << 24 >> 16;
							}
						return;
					case 0x24:
						for (ch.frac -= rate; ch.frac < 0; ch.frac += 0x10000)
							if ((ch.output = (this.pcm[ch.addr -= 2] | this.pcm[ch.addr + 1] << 8) << 16 >> 16) === -0x8000) {
								if ((reg[0x201 | j << 1] & 1) === 0)
									break outer;
								ch.output = (this.pcm[ch.addr = loop] | this.pcm[ch.addr + 1] << 8) << 16 >> 16;
							}
						return;
					case 0x28:
						for (ch.frac -= rate; ch.frac < 0; ch.frac += 0x10000) {
							if ((val = this.pcm[(ch.addr -= 1) >> 1]) === 0x88) {
								if ((reg[0x201 | j << 1] & 1) === 0)
									break outer;
								val = this.pcm[(ch.addr = loop << 1) >> 1];
							}
							ch.output -= [0, 1, 4, 9, 16, 25, 36, 49, -64, -49, -36, -25, -16, -9, -4, -1][(ch.addr & 1) === 0 ? val & 15 : val >> 4] << 8;
							ch.output = ch.output < -0x7f00 ? -0x7f00 : ch.output > 0x7f00 ? 0x7f00 : ch.output;
						}
						return;
					}
					ch.play = false;
					this.ram[0x22c] &= ~(1 << j);
				});
		});
	}

	regwrite({addr, data}) {
		const reg = this.reg;
		switch (addr) {
		case 0x214:
			this.channel.forEach((ch, i) => {
				if ((data & 1 << i) === 0)
					return;
				Object.assign(ch, {play: true, output: 0, addr: reg[0xc | i << 5] | reg[0xd | i << 5] << 8 | reg[0xe | i << 5] << 16, frac: 0});
				switch (reg[0x200 | i << 1] & 0xc) {
				case 0:
					return void(ch.output = this.pcm[ch.addr] << 24 >> 16);
				case 4:
					return void(ch.output = (this.pcm[ch.addr] | this.pcm[ch.addr + 1] << 8) << 16 >> 16);
				case 8:
					return void(ch.output = [0, 1, 4, 9, 16, 25, 36, 49, -64, -49, -36, -25, -16, -9, -4, -1][this.pcm[(ch.addr <<= 1) >> 1] & 15] << 8);
				}
			});
			break;
		case 0x215:
			this.channel.forEach((ch, i) => (data & 1 << i) !== 0 && (ch.play = false));
			break;
		}
		reg[addr] = data;
	}
}

