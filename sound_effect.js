/*
 *
 *	Sound Effect Module
 *
 */

export default class SoundEffect {
	se;
	sampleRate;
	gain;
	output = 0;

	constructor({se, gain = 1}) {
		this.se = se;
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.gain = gain;
	}

	update() {
		this.se.forEach(ch => {
			if (ch.stop)
				ch.play = false;
			if (ch.start && !ch.play)
				ch.play = true, ch.p = ch.frac = 0;
			ch.start = ch.stop = false;
			if (!ch.play)
				return;
			for (ch.frac += ch.freq; ch.frac >= this.sampleRate; ch.frac -= this.sampleRate) {
				if (++ch.p < ch.buf.length)
					continue;
				if (!(ch.play = ch.loop))
					break;
				ch.p = 0;
			}
		});
		this.output = 0;
		this.se.forEach(ch => { ch.play && (this.output += ch.buf[ch.p] / 32767 * this.gain); });
	}
}

