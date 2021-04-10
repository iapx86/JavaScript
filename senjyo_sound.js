/*
 *
 *	Senjyo Sound Module
 *
 */

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

export default class SenjyoSound {
	snd;
	clock;
	gain;
	output = 0;
	frac = 0;
	channel = {vol: 0, freq: 256, count: 256, phase: 0};
	bq = new BiquadFilter();

	constructor({SND, clock, gain = 0.7}) {
		this.snd = SND;
		this.clock = clock;
		this.gain = gain;
		this.bq.bandpass(200, 5);
	}

	write(addr, data) {
		addr ? (this.channel.vol = data / 15) : (this.channel.count = this.channel.freq = data);
	}

	execute(rate) {
		const ch = this.channel;
		for (this.frac += this.clock; this.frac >= rate * 16; this.frac -= rate * 16)
			--ch.count <= 0 && (ch.count = ch.freq, ch.phase = ch.phase + 1 & 15);
	}

	update() {
		this.output = this.bq.filter((this.snd[this.channel.phase] * 2 / 0xbf - 1) * this.channel.vol) * this.gain;
	}
}

