/*
 *
 *	Pole Position Sound Module
 *
 */

export default class PolePositionSound {
	snd;
	clock;
	gain;
	output = 0;
	ram = new Uint8Array(0x400);
	frac = 0;

	constructor({SND, clock = 96000, gain = 0.1}) {
		this.snd = SND;
		this.clock = clock;
		this.gain = gain;
	}

	read(addr) {
		return this.ram[addr & 0x3ff];
	}

	write(addr, data) {
		this.ram[addr & 0x3ff] = data;
	}

	execute(rate) {
		for (this.frac += this.clock; this.frac >= rate; this.frac -= rate) {
			const reg = this.ram;
			for (let ch = 0x3c8; ch < 0x3e0; ch += 4) {
				const phase = (reg[ch | 0x22] << 16 | reg[ch | 0x21] << 8 | reg[ch | 0x20]) + (reg[ch | 1] << 8 | reg[ch | 0]);
				reg[ch | 0x22] = phase >> 16, reg[ch | 0x21] = phase >> 8, reg[ch | 0x20] = phase;
			}
		}
	}

	update() {
		const reg = this.ram;
		this.output = 0;
		for (let ch = 0x3c8; ch < 0x3e0; ch += 4) {
			const vol = reg[ch | 2] >> 4 || reg[ch | 3] >> 4 || reg[ch | 3] & 0xf || reg[ch | 0x23] >> 4;
			this.output += (this.snd[reg[ch | 0x23] << 5 & 0xe0 | reg[ch | 0x22] & 0x1f] * 2 / 15 - 1) * vol / 15 * this.gain;
		}
	}
}

