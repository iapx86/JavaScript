/*
 *
 *	Namco 63701X Sound Module
 *
 */

export default class Namco63701X {
	pcm;
	rate;
	sampleRate;
	gain;
	output = 0;
	frac = 0;
	channel = [];

	constructor({PCM, clock, gain = 0.7}) {
		this.pcm = PCM;
		this.rate = Math.floor(clock / 1000);
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.gain = gain;
		for (let i = 0; i < 2; i++)
			this.channel.push({select: 0, play: false, pos: 0, vol: 0, count: 0});
	}

	write(addr, data) {
		const ch = this.channel[addr >> 1 & 1];
		if (addr & 1)
			ch.select = data;
		else if (ch.select & 0x1f) {
			const bank = ch.select << 11 & 0x70000, offs = ch.select - 1 << 1 & 0x3e;
			ch.vol = [26, 84, 200, 258][data >> 6];
			ch.play = this.pcm[ch.pos = bank | this.pcm[bank | offs] << 8 | this.pcm[bank | offs + 1]] !== 0xff;
			ch.count = this.pcm[ch.pos] ? 0 : this.pcm[++ch.pos] + 1;
		} else
			ch.play = false;
	}

	update() {
		for (this.frac += this.rate; this.frac >= this.sampleRate; this.frac -= this.sampleRate)
			this.channel.forEach(ch => {
				if (ch.play && !(ch.count && --ch.count))
					ch.play = this.pcm[++ch.pos] !== 0xff, ch.count = this.pcm[ch.pos] ? 0 : this.pcm[++ch.pos] + 1;
			});
		this.output = 0;
		this.channel.forEach(ch => ch.play && !ch.count && (this.output += (this.pcm[ch.pos] - 128) * ch.vol / 32767 * this.gain));
	}
}

