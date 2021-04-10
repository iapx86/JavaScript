/*
 *
 *	uPD7759 Sound Module
 *
 */

export default class UPD7759 {
	voi;
	clock;
	sampleRate;
	gain;
	output = 0;
	frac = 0;
	signal = 0;
	m = {port: 0, drq: true, cycle: 0, addr: 0, output: 0};
	g = generator(this.m);
	done = true;

	constructor({VOI, clock = 640000, gain = 0.5} = {}) {
		this.voi = VOI;
		this.clock = clock;
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.gain = gain;
	}

	reset(state) {
		~state & 1 && (this.done = this.g.return(undefined).done, this.m.drq = true, this.m.output = 0);
		return void(this.signal = this.signal & ~1 | state & 1);
	}

	st(state) {
		this.signal & 1 && state << 1 & ~this.signal & 2 && this.done && (this.g = generator(this.m, this.voi), this.done = false, this.m.cycle = -70, this.m.addr = 0);
		return void(this.signal = this.signal & ~2 | state << 1 & 2);
	}

	busy() {
		return this.done;
	}

	write(data) {
		this.m.port = data, this.m.drq = true;
	}

	execute(rate, fn) {
		if (!this.voi)
			for (this.m.cycle += Math.floor((this.frac += this.clock) / rate), this.frac %= rate; !this.done && this.m.cycle > 0 && this.m.drq;)
				this.done = this.g.next().done, !this.m.drq && fn();
	}

	update() {
		if (this.voi)
			for (this.m.cycle += Math.floor((this.frac += this.clock) / this.sampleRate), this.frac %= this.sampleRate; !this.done && this.m.cycle > 0;)
				!this.m.drq && (this.m.port = this.voi[this.m.addr++], this.m.drq = true), this.done = this.g.next().done;
		this.output = this.m.output / 255 * this.gain;
	}
}

function* generator(m, voi) {
	let num, addr_h, cycle = n => m.cycle -= n, drq = () => m.drq = false;
	yield, num = voi ? m.port : 0x10, cycle(44), drq(), yield;
	if (m.port < num)
		return;
	cycle(28), drq(), yield, m.addr = num * 2 + 5, cycle(32), drq(), yield, addr_h = m.port, cycle(44), drq();
	yield, m.addr = (addr_h << 8 | m.port) << 1, cycle(36), drq(), yield, cycle(36), drq();
	for (let header, repeat = 0, addr = 0, valid = false, state = 0, rate = 0, count = 0;;) {
		repeat && (--repeat, m.addr = addr), yield, (header = m.port) && (valid = true);
		switch (header >> 6) {
		case 0:
			if (!header && valid)
				return void(m.output = 0);
			state = m.output = 0, cycle(1024 * ((header & 63) + 1)), drq();
			continue;
		case 1:
			rate = 4 * ((header & 63) + 1), count = 256, cycle(36), drq();
			break;
		case 2:
			rate = 4 * ((header & 63) + 1), cycle(36), drq(), yield, count = m.port + 1, cycle(36), drq();
			break;
		case 3:
			repeat = (header & 7) + 1, addr = m.addr, cycle(36), drq();
			continue;
		}
		for (let i = 0; i < count; m.port = m.port << 4 & 0xf0, i++)
			yield, m.output += step[state][m.port >> 4], state = Math.min(Math.max(state + state_table[m.port >> 4], 0), 15), cycle(rate), i & 1 && drq();
		count & 1 && drq();
	}
}

const step = [
	[ 0,  0,  1,  2,  3,   5,   7,  10,  0,   0,  -1,  -2,  -3,   -5,   -7,  -10 ],
	[ 0,  1,  2,  3,  4,   6,   8,  13,  0,  -1,  -2,  -3,  -4,   -6,   -8,  -13 ],
	[ 0,  1,  2,  4,  5,   7,  10,  15,  0,  -1,  -2,  -4,  -5,   -7,  -10,  -15 ],
	[ 0,  1,  3,  4,  6,   9,  13,  19,  0,  -1,  -3,  -4,  -6,   -9,  -13,  -19 ],
	[ 0,  2,  3,  5,  8,  11,  15,  23,  0,  -2,  -3,  -5,  -8,  -11,  -15,  -23 ],
	[ 0,  2,  4,  7, 10,  14,  19,  29,  0,  -2,  -4,  -7, -10,  -14,  -19,  -29 ],
	[ 0,  3,  5,  8, 12,  16,  22,  33,  0,  -3,  -5,  -8, -12,  -16,  -22,  -33 ],
	[ 1,  4,  7, 10, 15,  20,  29,  43, -1,  -4,  -7, -10, -15,  -20,  -29,  -43 ],
	[ 1,  4,  8, 13, 18,  25,  35,  53, -1,  -4,  -8, -13, -18,  -25,  -35,  -53 ],
	[ 1,  6, 10, 16, 22,  31,  43,  64, -1,  -6, -10, -16, -22,  -31,  -43,  -64 ],
	[ 2,  7, 12, 19, 27,  37,  51,  76, -2,  -7, -12, -19, -27,  -37,  -51,  -76 ],
	[ 2,  9, 16, 24, 34,  46,  64,  96, -2,  -9, -16, -24, -34,  -46,  -64,  -96 ],
	[ 3, 11, 19, 29, 41,  57,  79, 117, -3, -11, -19, -29, -41,  -57,  -79, -117 ],
	[ 4, 13, 24, 36, 50,  69,  96, 143, -4, -13, -24, -36, -50,  -69,  -96, -143 ],
	[ 4, 16, 29, 44, 62,  85, 118, 175, -4, -16, -29, -44, -62,  -85, -118, -175 ],
	[ 6, 20, 36, 54, 76, 104, 144, 214, -6, -20, -36, -54, -76, -104, -144, -214 ],
];

const state_table = [ -1, -1, 0, 0, 1, 2, 2, 3, -1, -1, 0, 0, 1, 2, 2, 3 ];
