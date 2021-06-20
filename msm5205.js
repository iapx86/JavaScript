/*
 *
 *	MSM5205 Sound Module
 *
 */

export default class MSM5205 {
	clock;
	div;
	gain;
	output = 0;
	frac = 0;
	m = {port: 0, play: false, state: 0, output: 0};

	constructor({clock = 384000, div = 48, gain = 0.5} = {}) {
		this.clock = clock;
		this.div = div;
		this.gain = gain;
	}

	start() {
		!this.m.play && (this.m.play = true, this.m.output = this.m.state = 0);
	}

	stop() {
		this.m.play = false;
	}

	status() {
		return this.m.play;
	}

	write(data) {
		this.m.port = data;
	}

	execute(rate, fn) {
		for (this.frac += this.clock; this.frac >= rate * this.div; this.frac -= rate * this.div)
			if (fn(), this.m.play) {
				this.m.output = Math.min(Math.max(this.m.output + step[this.m.state][this.m.port], -2048), 2047);
				this.m.state = Math.min(Math.max(this.m.state + state_table[this.m.port & 7], 0), 48);
			}
	}

	update() {
		this.output = this.m.output / 2047 * this.gain;
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

