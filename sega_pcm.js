/*
 *
 *	SEGA PCM Sound Module
 *
 */

export default class SegaPCM {
	pcm;
	clock;
	gain;
	output = 0;
	ram = new Uint8Array(0x800);
	frac = 0;
	low = new Uint8Array(16);

	constructor({PCM, clock, gain = 1}) {
		this.pcm = PCM;
		this.clock = clock;
		this.gain = gain;
	}

	read(addr) {
		return this.ram[addr & 0x7ff];
	}

	write(addr, data) {
		this.ram[addr & 0x7ff] = data;
	}

	execute(rate) {
		for (this.frac += this.clock; this.frac >= rate * 128; this.frac -= rate * 128) {
			const reg = this.ram;
			for (let i = 0; i < 0x80; i += 8)
				if (~reg[0x86 | i] & 1) {
					const addr = (reg[0x85 | i] << 16 | reg[0x84 | i] << 8 | this.low[i >> 3]) + reg[7 | i];
					reg[0x85 | i] = addr >> 16, reg[0x84 | i] = addr >> 8, this.low[i >> 3] = addr;
					if (reg[0x85 | i] === (reg[6 | i] + 1 & 0xff)) {
						this.low[i >> 3] = 0;
						if (~reg[0x86 | i] & 2)
							reg[0x85 | i] = reg[5 | i], reg[0x84 | i] = reg[4 | i];
						else
							reg[0x86 | i] |= 1;
					}
				}
		}
	}

	update() {
		const reg = this.ram;
		this.output = 0;
		for (let i = 0; i < 0x80; i += 8)
			if (~reg[0x86 | i] & 1) {
				const vol = ((reg[2 | i] & 0x7f) + (reg[3 | i] & 0x7f)) / 0xfe;
				this.output += (this.pcm[reg[0x86 | i] << 12 & 0x70000 | reg[0x85 | i] << 8 | reg[0x84 | i]] * 2 / 255 - 1) * vol * this.gain;
			}
	}
}

