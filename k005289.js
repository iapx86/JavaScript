/*
 *
 *	K005289 Sound Module
 *
 */

export default class K005289 {
	snd;
	clock;
	gain;
	output = 0;
	reg = new Uint16Array(8);
	frac = 0;

	constructor({SND, clock, gain = 0.1}) {
		this.snd = SND;
		this.clock = clock;
		this.gain = gain;
	}

	write(addr, data) {
		this.reg[addr] = data;
	}

	execute(rate) {
		for (this.frac += this.clock; this.frac >= rate; this.frac -= rate)
			for (let i = 0; i < 2; i++)
				++this.reg[i + 4] >= this.reg[i + 2] && (++this.reg[i + 6], this.reg[i + 4] = 0);
	}

	update() {
		this.output = 0;
		for (let i = 0; i < 2; i++)
			this.output += (this.snd[i << 8 | this.reg[i] & 0xe0 | this.reg[i + 6] & 0x1f] * 2 / 15 - 1) * (this.reg[i] & 15) / 15 * this.gain;
	}
}

