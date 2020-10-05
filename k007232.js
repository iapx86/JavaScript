/*
 *
 *	K007232 Sound Module
 *
 */

export default class K007232 {
	base;
	limit;
	snd;
	rate;
	sampleRate;
	count;
	resolution;
	gain;
	tmpwheel = [];
	wheel = [];
	reg = new Uint8Array(14);
	cycles = 0;
	channel = [];

	source;
	gainNode;
	scriptNode;

	constructor({SND, clock, resolution = 1, gain = 0.1}) {
		this.base = SND;
		this.limit = Math.min(SND.length, 0x20000);
		this.snd = Float32Array.from(SND, e => (e & 0x7f) * 2 / 127 - 1);
		this.rate = Math.floor(clock / 128);
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.count = this.sampleRate - 1;
		this.resolution = resolution;
		this.gain = gain;
		for (let i = 0; i < resolution; i++)
			this.tmpwheel.push([]);
		for (let i = 0; i < 2; i++)
			this.channel.push({play: false, addr: 0, bank: 0, vol: 0});
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
		this.gainNode.gain.value = flag ? 0 : this.gain;
	}

	read(addr, timer = 0) {
		switch (addr &= 0xf) {
		case 5:
		case 11:
			this.tmpwheel[timer].push({addr, data: 0});
			break;
		}
		return 0;
	}

	write(addr, data, timer = 0) {
		addr &= 0xf;
		this.tmpwheel[timer].push({addr, data});
	}

	set_bank(bank0, bank1, timer = 0) {
		this.tmpwheel[timer].push({addr: 16, data: bank0}, {addr: 17, data: bank1});
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
				if (this.wheel.length)
					this.wheel.shift().forEach(e => this.regwrite(e));
			this.channel.forEach(ch => ch.play && (data[i] += this.snd[ch.bank | ch.addr >> 12] * ch.vol));
			for (this.cycles += this.rate; this.cycles >= this.sampleRate; this.cycles -= this.sampleRate)
				this.channel.forEach((ch, j) => {
					if (!ch.play)
						return;
					const rate = Math.floor(0x20000 / (0x200 - (reg[j * 6] | reg[1 + j * 6] << 8 & 0x100)));
					for (let addr = (ch.addr >> 12) + 1, addr1 = (ch.addr += rate) >> 12; addr <= addr1; addr++)
						if (addr >= this.limit || this.base[ch.bank | addr] >= 0x80) {
							if ((reg[13] & 1 << j) !== 0)
								ch.addr = (reg[2 + j * 6] | reg[3 + j * 6] << 8 | reg[4 + j * 6] << 16 & 0x10000) << 12;
							else
								ch.play = false;
							break;
						}
				});
		});
	}

	regwrite({addr, data}) {
		const reg = this.reg;
		switch (addr) {
		case 5:
			this.channel[0].addr = (reg[2] | reg[3] << 8 | reg[4] << 16 & 0x10000) << 12;
			this.channel[0].play = this.channel[0].addr >> 12 < this.limit && this.base[this.channel[0].bank | this.channel[0].addr >> 12] < 0x80;
			break;
		case 11:
			this.channel[1].addr = (reg[8] | reg[9] << 8 | reg[10] << 16 & 0x10000) << 12;
			this.channel[1].play = this.channel[1].addr >> 12 < this.limit && this.base[this.channel[1].bank | this.channel[1].addr >> 12] < 0x80;
			break;
		case 12:
			this.channel[0].vol = (data >> 4) / 15, this.channel[1].vol = (data & 0xf) / 15;
			break;
		case 16:
			return void(this.channel[0].bank = data << 17);
		case 17:
			return void(this.channel[1].bank = data << 17);
		}
		reg[addr] = data;
	}
}

