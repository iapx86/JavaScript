/*
 *
 *	Namco 63701X Sound Module
 *
 */

export default class Namco63701X {
	pcm;
	rate;
	sampleRate;
	cycles = 0;
	channel = [];

	source = audioCtx.createBufferSource();
	gainNode = audioCtx.createGain();
	scriptNode = audioCtx.createScriptProcessor(512, 1, 1);

	constructor({PCM, clock, gain = 0.7}) {
		this.pcm = PCM;
		this.rate = Math.floor(clock / 1000);
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		for (let i = 0; i < 2; i++)
			this.channel.push({select: 0, play: false, pos: 0, vol: 0, count: 0});
		this.gainNode.gain.value = gain;
		this.scriptNode.onaudioprocess = ({outputBuffer}) => this.makeSound(outputBuffer.getChannelData(0).fill(0));
		this.source.connect(this.scriptNode).connect(this.gainNode).connect(audioCtx.destination);
		this.source.start();
	}

	write(addr, data) {
		const ch = this.channel[addr >> 1 & 1];
		if ((addr & 1) !== 0)
			ch.select = data;
		else if ((ch.select & 0x1f) !== 0) {
			const bank = ch.select << 11 & 0x70000, offs = ch.select - 1 << 1 & 0x3e;
			ch.vol = [26, 84, 200, 258][data >> 6];
			ch.play = this.pcm[ch.pos = bank | this.pcm[bank | offs] << 8 | this.pcm[bank | offs + 1]] !== 0xff;
			ch.count = this.pcm[ch.pos] === 0 ? this.pcm[++ch.pos] + 1 : 0;
		} else
			ch.play = false;
	}

	update() {}

	makeSound(data) {
		data.forEach((e, i) => {
			this.channel.forEach(ch => ch.play && !ch.count && (data[i] += (this.pcm[ch.pos] - 0x80) * ch.vol / 32767));
			for (this.cycles += this.rate; this.cycles >= this.sampleRate; this.cycles -= this.sampleRate)
				this.channel.forEach(ch => {
					if (!ch.play || ch.count && --ch.count)
						return;
					ch.play = this.pcm[++ch.pos] !== 0xff;
					ch.count = this.pcm[ch.pos] === 0 ? this.pcm[++ch.pos] + 1 : 0;
				});
		});
	}
}

