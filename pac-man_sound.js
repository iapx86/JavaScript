/*
 *
 *	Pac-Man Sound Module
 *
 */

export default class PacManSound {
	snd;
	clock;
	gain;
	output = 0;
	mute = false;
	reg = new Uint8Array(0x20);
	frac = 0;

	constructor({SND, clock = 96000, gain = 0.1}) {
		this.snd = SND;
		this.clock = clock;
		this.gain = gain;
	}

	control(flag) {
		this.mute = !flag;
	}

	write(addr, data) {
		this.reg[addr & 0x1f] = data & 15;
	}

	execute(rate, rate_correction = 1) {
		for (this.frac += this.clock * rate_correction; this.frac >= rate; this.frac -= rate) {
			const r = this.reg;
			for (let ch = 0; ch < 15; ch += 5) {
				let ph = r[ch + 4] << 16 | r[ch + 3] << 12 | r[ch + 2] << 8 | r[ch + 1] << 4 | (ch ? 0 : r[0]);
				ph += r[ch + 0x14] << 16 | r[ch + 0x13] << 12 | r[ch + 0x12] << 8 | r[ch + 0x11] << 4 | (ch ? 0 : r[0x10]);
				r[ch + 4] = ph >> 16 & 15, r[ch + 3] = ph >> 12 & 15, r[ch + 2] = ph >> 8, r[ch + 1] = ph >> 4 & 15, !ch && (r[0] = ph & 15);
			}
		}
	}

	update() {
		this.output = 0;
		if (this.mute)
			return;
		const r = this.reg;
		for (let ch = 0; ch < 15; ch += 5)
			this.output += (this.snd[r[ch + 5] << 5 & 0xe0 | r[ch + 4] << 1 | r[ch + 3] >> 3] * 2 / 15 - 1) * r[ch + 0x15] / 15 * this.gain;
	}
}

