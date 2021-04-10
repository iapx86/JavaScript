/*
 *
 *	C30 Sound Module
 *
 */

export default class C30 {
	clock;
	gain;
	output = 0;
	ram = new Uint8Array(0x400);
	snd = new Float64Array(0x200);
	frac = 0;
	channel = [];

	constructor({clock = 48000, gain = 0.1} = {}) {
		this.clock = clock;
		this.gain = gain;
		for (let i = 0; i < 4; i++)
			this.channel.push({ncount: 0, rng: 1, output: 0});
	}

	read(addr) {
		return this.ram[addr & 0x3ff];
	}

	write(addr, data) {
		this.ram[addr &= 0x3ff] = data;
		addr < 0x100 && (this.snd[addr * 2] = (data >> 4) * 2 / 15 - 1, this.snd[1 + addr * 2] = (data & 15) * 2 / 15 - 1);
	}

	execute(rate) {
		for (this.frac += this.clock; this.frac >= rate; this.frac -= rate) {
			const r = this.ram;
			for (let ch = 0x100; ch < 0x140; ch += 8)
				if (ch >= 0x120 || ~r[0x104 | ch - 8 & 0x38] & 0x80) {
					const ph = (r[ch | 5] << 16 | r[ch | 6] << 8 | r[ch | 7]) + (r[ch | 1] << 16 & 0xf0000 | r[ch | 2] << 8 | r[ch | 3]);
					r[ch | 5] = ph >> 16, r[ch | 6] = ph >> 8, r[ch | 7] = ph;
				} else {
					const channel = this.channel[ch >> 3 & 3];
					for (channel.ncount += r[ch | 3]; channel.ncount >= 0x100; channel.ncount -= 0x100)
						channel.output ^= channel.rng + 1 >> 1 & 1, channel.rng = (channel.rng ^ (~channel.rng & 1) - 1 & 0x28000) >> 1;
				}
		}
	}

	update() {
		const r = this.ram;
		this.output = 0;
		for (let ch = 0x100; ch < 0x140; ch += 8)
			if (ch >= 0x120 || ~r[0x104 | ch - 8 & 0x38] & 0x80)
				this.output += this.snd[r[ch | 1] << 1 & 0x1e0 | r[ch | 5] & 0x1f] * (r[ch | 0] & 15) / 15 * this.gain;
			else
				this.output += (this.channel[ch >> 3 & 3].output * 2 - 1) * (r[ch | 0] & 15) / 15 * this.gain;
	}
}

