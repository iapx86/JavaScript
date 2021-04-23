/*
 *
 *	MSM6258 Sound Module
 *
 */

export default class MSM6258 {
	clock;
	div;
	gain;
	output = 0;
	mute = false;
	frac = 0;
	m = {port: 0, play: false, shift: 0, state: 0, output: 0};

	constructor({clock = 8000000, gain = 0.2} = {}) {
		this.clock = clock;
		this.div = 1024;
		this.gain = gain;
	}

	control(data) {
		this.mute = (data & 3) === 3, this.div = [1024, 768, 512, 512][data >> 2 & 3];
	}

	command(data) {
		data & 2 && !this.m.play && (this.m.play = true, this.m.output = this.m.state = this.m.shift = 0, this.frac = 0);
		data & 1 && (this.m.play = false);
	}

	status() {
		return this.m.play << 7 | 0x40;
	}

	write(data) {
		this.m.port = data;
	}

	execute(rate, fn) {
		if (this.m.play)
			for (this.frac += this.clock; this.frac >= rate * this.div; this.frac -= rate * this.div) {
				!this.m.shift && fn(), this.m.output = Math.min(Math.max(this.m.output + step[this.m.state][this.m.port >> this.m.shift & 15], -512), 511);
				this.m.state = Math.min(Math.max(this.m.state + state_table[this.m.port >> this.m.shift & 7], 0), 48), this.m.shift ^= 4;
			}
	}

	update() {
		this.output = this.mute ? 0 : this.m.output / 511 * this.gain;
	}
}

const step = [];
const state_table = [-1, -1, -1, -1, 2, 4, 6, 8];

void function () {
	for (let i = 0; i < 49; i++) {
		step[i] = [];
		const val = Math.floor(16 * Math.pow(1.1, i));
		for (let j = 0; j < 16; j++)
			step[i][j] = (j < 8 ? 1 : -1) * ((j & 4 ? val : 0) + (j & 2 ? val >> 1 : 0) + (j & 1 ? val >> 2 : 0) + (val >> 3));
	}
}();

