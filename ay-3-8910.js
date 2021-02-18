/*
 *
 *	AY-3-8910 Sound Module
 *
 */

export default class AY_3_8910 {
	rate;
	gain;
	output = 0;
	mute = false;
	reg = new Uint8Array(0x10);
	frac = 0;
	channel = [];
	ncount = 0;
	rng = 0xffff;
	ecount = 0;
	step = 0;

	constructor({clock, gain = 0.1}) {
		this.rate = clock / 8;
		this.gain = gain;
		for (let i = 0; i < 3; i++)
			this.channel.push({freq: 0, count: 0, output: 0});
	}

	control(flag) {
		this.mute = !flag;
	}

	read(addr) {
		return this.reg[addr & 0xf];
	}

	write(addr, data) {
		this.reg[addr &= 15] = data, addr === 13 && (this.step = 0);
	}

	execute(rate, rate_correction = 1) {
		for (this.frac += this.rate * rate_correction; this.frac >= rate; this.frac -= rate) {
			const reg = this.reg, nfreq = reg[6] & 0x1f, efreq = reg[11] | reg[12] << 8, etype = reg[13];
			this.channel.forEach((ch, i) => ch.freq = reg[1 + i * 2] << 8 & 0xf00 | reg[i * 2]);
			this.channel.forEach(ch => ++ch.count >= ch.freq && (ch.output = ~ch.output, ch.count = 0));
			++this.ncount >= nfreq << 1 && (this.rng = (this.rng >> 16 ^ this.rng >> 13 ^ 1) & 1 | this.rng << 1, this.ncount = 0);
			++this.ecount >= efreq && (this.step += ((this.step < 16) | etype >> 3 & ~etype & 1) - (this.step >= 47) * 32, this.ecount = 0);
		}
	}

	update() {
		this.output = 0;
		if (this.mute)
			return;
		const reg = this.reg, etype = reg[13];
		const evol = (~this.step ^ ((((etype ^ etype >> 1) & this.step >> 4 ^ ~etype >> 2) & 1) - 1)) & (~etype >> 3 & this.step >> 4 & 1) - 1 & 15;
		this.channel.forEach((ch, i) => {
			const vol = reg[8 + i] >> 4 & 1 ? evol : reg[8 + i] & 0xf;
			this.output += (((!ch.freq | reg[7] >> i | ch.output) & (reg[7] >> i + 3 | this.rng) & 1) * 2 - 1) * (vol ? Math.pow(10, (vol - 15) / 10) : 0) * this.gain;
		});
	}
}

