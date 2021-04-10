/*
 *
 *	SN76489 Sound Module
 *
 */

export default class SN76489 {
	rate;
	gain;
	output = 0;
	mute = false;
	addr = 0;
	reg = new Uint16Array(8).fill(-1);
	frac = 0;
	channel = [];
	ncount = 0;
	rng = 0x4000;

	constructor({clock, gain = 0.1}) {
		this.rate = Math.floor(clock / 16);
		this.gain = gain;
		for (let i = 0; i < 3; i++)
			this.channel.push({count: 0, output: 0});
	}

	control(flag) {
		this.mute = !flag;
	}

	write(data) {
		if (data & 0x80)
			this.addr = data >> 4 & 7, this.reg[this.addr] = this.reg[this.addr] & 0x3f0 | data & 0xf;
		else
			this.reg[this.addr] = this.reg[this.addr] & 0xf | data << 4 & 0x3f0;
		this.addr === 6 && (this.rng = 0x4000);
	}

	execute(rate) {
		for (this.frac += this.rate; this.frac >= rate; this.frac -= rate) {
			const reg = this.reg, nfreq = (reg[6] & 3) === 3 ? reg[4] << 1 : 32 << (reg[6] & 3);
			this.channel.forEach((ch, i) => !(--ch.count & 0x3ff) && (ch.output = ~ch.output, ch.count = reg[i * 2]));
			!(--this.ncount & 0x7ff) && (this.rng = this.rng >> 1 | (this.rng << 14 ^ this.rng << 13 & reg[6] << 12) & 0x4000, this.ncount = nfreq);
		}
	}

	update() {
		this.output = 0;
		if (this.mute)
			return;
		const reg = this.reg, nvol = ~reg[7] & 0xf;
		this.channel.forEach((ch, i) => {
			const vol = ~reg[i * 2 + 1] & 0xf;
			this.output += ((ch.output & 1) * 2 - 1) * (vol ? Math.pow(10, (vol - 15) / 10) : 0) * this.gain;
		});
		this.output += ((this.rng & 1) * 2 - 1) * (nvol ? Math.pow(10, (nvol - 15) / 10) : 0) * this.gain;
	}
}

