/*
 *
 *	uPD7759 Sound Module
 *
 */

export default class UPD7759 {
	base;
	clock;
	sampleRate;
	gain;
	output = 0;
	frac = 0;
	md = true;
	signal = 0;
	port = 0;
	m = {state: 'IDLE', count: 0, valid: false, cycle: 0, repeat: 0, num: 0, addr: 0, rate: 0};
	addr = 0;
	adpcm_state = 0;
	adpcm_data = 0;
	output0 = 0;

	constructor({VOI, mode = true, clock = 640000, gain = 0.5}) {
		this.base = VOI;
		this.clock = clock;
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.gain = gain;
		this.md = mode;
	}

	reset(state) {
		~state & 1 && this.m.state !== 'IDLE' && (this.m.state = 'IDLE', this.m.cycle = this.adpcm_state = this.output0 = 0);
		return void(this.signal = this.signal & ~1 | state & 1);
	}

	st(state) {
		this.signal & 1 && state << 1 & ~this.signal & 2 && this.m.state === 'IDLE' && (this.m.state = 'START', this.m.cycle -= 70);
		return void(this.signal = this.signal & ~2 | state << 1 & 2);
	}

	busy() {
		return this.m.state === 'IDLE';
	}

	write(data) {
		this.port = data;
	}

	execute(rate, rate_correction, fn) {
		if (!this.md)
			for (this.m.cycle += Math.floor((this.frac += this.clock * rate_correction) / rate), this.frac %= rate; this.m.cycle > 0;)
				!this.transition() && fn();
	}

	update() {
		if (this.md)
			for (this.m.cycle += Math.floor((this.frac += this.clock) / this.sampleRate), this.frac %= this.sampleRate; this.m.cycle > 0; this.transition()) {}
		this.output = this.output0 / 255 * this.gain;
	}

	transition() {
		const next = () => { return this.md ? this.base[this.addr++] : this.port; };
		let data;
		switch (this.m.state) {
		case 'IDLE':
			return this.m.cycle -= 4, true;
		case 'START':
			return this.m.num = this.md ? this.port : 0x10, this.addr = 0, this.m.state = 'MAX_NUM', this.m.cycle -= 44, false;
		case 'MAX_NUM':
			return data = next(), this.m.state = data < this.m.num ? 'IDLE' : 'DUMMY', this.m.cycle -= 32, this.m.state === 'IDLE';
		case 'DUMMY':
			return next(), this.addr = this.m.num * 2 + 5, this.m.state = 'ADDR_H', this.m.cycle -= 32, false;
		case 'ADDR_H':
			return this.m.addr = next(), this.m.state = 'ADDR_L', this.m.cycle -= 44, false;
		case 'ADDR_L':
			return data = next(), this.addr = (this.m.addr << 8 | data) << 1, this.m.state = 'DUMMY2', this.m.cycle -= 36, false;
		case 'DUMMY2':
			return next(), this.m.valid = false, this.m.repeat = 0, this.m.state = 'HEADER', this.m.cycle -= 36, false;
		case 'HEADER':
			this.m.repeat && (--this.m.repeat, this.addr = this.m.addr);
			(data = next()) && (this.m.valid = true);
			switch (data >> 6) {
			case 0:
				return this.adpcm_state = this.output0 = 0, this.m.state = !data && this.m.valid ? 'IDLE' : 'HEADER', this.m.cycle -= 1024 * ((data & 0x3f) + 1), this.m.state === 'IDLE';
			case 1:
				return this.m.rate = 4 * ((data & 0x3f) + 1), this.m.count = 256, this.m.state = 'NIBBLE_H', this.m.cycle -= 36, false;
			case 2:
				return this.m.rate = 4 * ((data & 0x3f) + 1), this.m.state = 'COUNT', this.m.cycle -= 36, false;
			case 3:
				return this.m.repeat = (data & 7) + 1, this.m.addr = this.addr, this.m.state = 'HEADER', this.m.cycle -= 36, false;
			}
			return;
		case 'COUNT':
			return data = next(), this.m.count = data + 1, this.m.state = 'NIBBLE_H', this.m.cycle -= 36, false;
		case 'NIBBLE_H':
			this.adpcm_data = next();
			data = this.adpcm_data >> 4, this.output0 += step[this.adpcm_state][data], this.adpcm_state = Math.min(Math.max(this.adpcm_state + state_table[data], 0), 15);
			return this.m.state = --this.m.count ? 'NIBBLE_L' : 'HEADER', this.m.cycle -= this.m.rate, this.m.state === 'NIBBLE_L';
		case 'NIBBLE_L':
			data = this.adpcm_data & 15, this.output0 += step[this.adpcm_state][data], this.adpcm_state = Math.min(Math.max(this.adpcm_state + state_table[data], 0), 15);
			return this.m.state = --this.m.count ? 'NIBBLE_H' : 'HEADER', this.m.cycle -= this.m.rate, false;
		}
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
