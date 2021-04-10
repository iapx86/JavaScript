/*
 *
 *	Mappy Sound Module
 *
 */

export default class MappySound {
	snd;
	clock;
	gain;
	output = 0;
	mute = false;
	ram = new Uint8Array(0x400);
	frac = 0;

	constructor({SND, clock = 48000, gain = 0.1}) {
		this.snd = SND;
		this.clock = clock;
		this.gain = gain;
	}

	control(flag) {
		this.mute = !flag;
	}

	read(addr) {
		return this.ram[addr & 0x3ff];
	}

	write(addr, data) {
		this.ram[addr & 0x3ff] = data;
	}

	execute(rate) {
		for (this.frac += this.clock; this.frac >= rate; this.frac -= rate) {
			const r = this.ram;
			for (let ch = 0; ch < 0x40; ch += 8) {
				const ph = (r[ch | 2] << 16 | r[ch | 1] << 8 | r[ch | 0]) + (r[ch | 6] << 16 & 0xf0000 | r[ch | 5] << 8 | r[ch | 4]);
				r[ch | 2] = ph >> 16, r[ch | 1] = ph >> 8, r[ch | 0] = ph;
			}
		}
	}

	update() {
		this.output = 0;
		if (this.mute)
			return;
		const r = this.ram;
		for (let ch = 0; ch < 0x40; ch += 8)
			this.output += (this.snd[r[ch | 6] << 1 & 0xe0 | r[ch | 2] & 0x1f] * 2 / 15 - 1) * (r[ch | 3] & 15) / 15 * this.gain;
	}
}

