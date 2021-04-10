/*
 *
 *	K007232 Sound Module
 *
 */

export default class K007232 {
	snd;
	limit;
	clock;
	gain;
	output = 0;
	reg = new Uint8Array(14);
	frac = 0;
	channel = [];

	constructor({SND, clock, gain = 0.1}) {
		this.snd = SND;
		this.limit = Math.min(SND.length, 0x20000);
		this.clock = clock;
		this.gain = gain;
		for (let i = 0; i < 2; i++)
			this.channel.push({play: false, addr: 0, bank: 0, vol: 0});
	}

	read(addr) {
		switch (addr &= 0xf) {
		case 5:
			this.channel[0].addr = (this.reg[2] | this.reg[3] << 8 | this.reg[4] << 16 & 0x10000) << 12;
			this.channel[0].play = this.channel[0].addr >> 12 < this.limit && this.snd[this.channel[0].bank | this.channel[0].addr >> 12] < 0x80;
			break;
		case 11:
			this.channel[1].addr = (this.reg[8] | this.reg[9] << 8 | this.reg[10] << 16 & 0x10000) << 12;
			this.channel[1].play = this.channel[1].addr >> 12 < this.limit && this.snd[this.channel[1].bank | this.channel[1].addr >> 12] < 0x80;
			break;
		}
		return 0;
	}

	write(addr, data) {
		switch (addr &= 0xf) {
		case 5:
		case 11:
			this.read(addr);
			break;
		case 12:
			this.channel[0].vol = (data >> 4) / 15, this.channel[1].vol = (data & 0xf) / 15;
			break;
		}
		this.reg[addr] = data;
	}

	set_bank(bank0, bank1) {
		this.channel[0].bank = bank0 << 17, this.channel[1].bank = bank1 << 17;
	}

	execute(rate) {
		for (this.frac += this.clock; this.frac >= rate * 128; this.frac -= rate * 128) {
			const reg = this.reg;
			this.channel.forEach((ch, i) => {
				if (!ch.play)
					return;
				const prate = Math.floor(0x20000 / (0x200 - (reg[i * 6] | reg[1 + i * 6] << 8 & 0x100)));
				for (let addr = (ch.addr >> 12) + 1, addr1 = (ch.addr += prate) >> 12; addr <= addr1; addr++)
					if (addr >= this.limit || this.snd[ch.bank | addr] >= 0x80) {
						if (reg[13] >> i & 1)
							ch.addr = (reg[2 + i * 6] | reg[3 + i * 6] << 8 | reg[4 + i * 6] << 16 & 0x10000) << 12;
						else
							ch.play = false;
						return;
					}
			});
		}
	}

	update() {
		this.output = 0;
		this.channel.forEach(ch => ch.play && (this.output += ((this.snd[ch.bank | ch.addr >> 12] & 0x7f) * 2 / 127 - 1) * ch.vol * this.gain));
	}
}

