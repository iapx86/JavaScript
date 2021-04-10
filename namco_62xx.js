/*
 *
 *	Namco 62XX Sound Module
 *
 */

import MB8840 from './mb8840.js';

class BiquadFilter {
	b0 = 0;
	b1 = 0;
	b2 = 0;
	a1 = 0;
	a2 = 0;
	x1 = 0;
	x2 = 0;
	y1 = 0;
	y2 = 0;

	bandpass(freq, Q) {
		const w0 = 2 * Math.PI * freq / audioCtx.sampleRate, alpha = Math.sin(w0) / (2 * Q), a0 = 1 + alpha;
		this.b0 = alpha / a0, this.b1 = 0, this.b2 = -alpha / a0, this.a1 = -2 * Math.cos(w0) / a0, this.a2 = (1 - alpha) / a0;
	}

	filter(x) {
		const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
		this.x2 = this.x1, this.x1 = x, this.y2 = this.y1, this.y1 = y;
		return y;
	}
}

export default class Namco62XX {
	clock;
	gain;
	output = 0;
	frac = 0;
	mcu = new MB8840();
	delta = 0;
	bq = new BiquadFilter();

	constructor({PRG, clock, gain = 0.75}) {
		this.clock = Math.floor(clock / 6);
		this.gain = gain;
		this.mcu.rom.set(PRG);
		this.bq.bandpass(200, 1);
	}

	reset() {
		this.mcu.reset();
		for (; ~this.mcu.mask & 4; this.mcu.execute()) {}
	}

	param(port) {
		if (~this.mcu.cause & 4 || !this.mcu.interrupt())
			return;
		this.mcu.cause &= ~4;
		for (let op = this.mcu.execute(); op !== 0x3c; op = this.mcu.execute())
			if (op === 3) {
				this.delta ^= this.mcu.r, ~this.mcu.r & this.delta & 0x80 && (port[this.mcu.r >> 4 & 15] = this.mcu.r & 15);
				this.delta & 0xf0 && this.mcu.r & 0x80 && (this.mcu.r = this.mcu.r & ~15 | port[this.mcu.r >> 4 & 15]);
				this.delta = this.mcu.r = this.mcu.r & ~0x200 | this.mcu.r << 1 & 0x200;
			}
	}

	execute(rate) {
		for (this.mcu.cycle += Math.floor((this.frac += this.clock) / rate), this.frac %= rate; this.mcu.cycle > 0; this.mcu.execute()) {}
	}

	update() {
		this.output = this.bq.filter(((this.mcu.o & 15) + (this.mcu.o >> 4)) / 15) * this.gain;
	}
}

