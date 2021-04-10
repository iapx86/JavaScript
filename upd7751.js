/*
 *
 *	uPD7751 Sound Module
 *
 */

import MCS48 from './mcs48.js';

export default class UPD7751 {
	base;
	clock;
	gain;
	output = 0;
	frac = 0;
	signal = 0;
	mcu = new MCS48();
	bank = 0;

	constructor({MCU, VOI, clock = 6000000, gain = 0.5}) {
		this.base = VOI;
		this.clock = Math.floor(clock / 15);
		this.gain = gain;
		this.mcu.rom.set(MCU);
	}

	reset(state) {
		if (state & ~this.signal & 1) {
			for (this.mcu.p2 = 0, this.mcu.reset(); ~this.mcu.p2 & 0x80;) {
				const op = this.mcu.execute();
				if (op >= 0x3c && op < 0x40)
					this.mcu.bus = this.base[this.bank | this.mcu.p7 << 12 & 0x3000 | this.mcu.p6 << 8 | this.mcu.p5 << 4 | this.mcu.p4];
			}
			this.mcu.cycle = 0;
		}
		return void(this.signal = this.signal & ~1 | state & 1);
	}

	interrupt() {}

	write(data) {
		this.bank = 0, !(data & 4) && (this.bank = 0x8000), !(data & 8) && (this.bank = 0x10000), !(data & 0x10) && (this.bank = 0x18000);
		this.bank |= data << 14 & 0x4000;
		this.mcu.p2 = data >> 1 & 0x70;
	}

	execute(rate) {
		if (this.signal & 1)
			for (this.mcu.cycle += Math.floor((this.frac += this.clock) / rate), this.frac %= rate; this.mcu.cycle > 0;) {
				const op = this.mcu.execute();
				if (op >= 0x3c && op < 0x40)
					this.mcu.bus = this.base[this.bank | this.mcu.p7 << 12 & 0x3000 | this.mcu.p6 << 8 | this.mcu.p5 << 4 | this.mcu.p4];
			}
	}

	update() {
		this.output = this.signal & 1 ? (this.mcu.p1 - 0x80) / 127 * this.gain : 0;
	}
}
