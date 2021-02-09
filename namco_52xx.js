/*
 *
 *	Namco 52XX Sound Module
 *
 */

export default class Namco52XX {
	voi;
	rate;
	sampleRate;
	gain;
	output = 0;
	frac = 0;
	channel = {play: 0, pos: 0, end: 0};

	constructor({VOI, clock, gain = 0.25}) {
		this.voi = VOI;
		this.rate = Math.floor(clock / 384);
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.gain = gain;
	}

	reset() {
		this.channel.play = 0;
	}

	write(data) {
		if (data <= this.channel.play)
			return;
		this.channel.play = data;
		this.channel.pos = this.voi[data - 1] << 1 | this.voi[data + 0xf] << 9;
		this.channel.end = this.voi[data] << 1 | this.voi[data + 0x10] << 9;
	}

	update() {
		for (this.frac += this.rate; this.frac >= this.sampleRate; this.frac -= this.sampleRate)
			if (this.channel.play && ++this.channel.pos === this.channel.end)
				this.channel.play = 0;
		this.output = this.channel.play ? ((this.voi[this.channel.pos >> 1] >> (this.channel.pos << 2 & 4) & 15) - 8) / 7 * this.gain : 0;
	}
}

