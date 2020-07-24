/*
 *
 *	Namco 63701X Sound Module
 *
 */

export default class Namco63701X {
	constructor({PCM, clock, gain = 1}) {
		this.cycles = 0;
		this.channel = [];
		for (let i = 0; i < 2; i++)
			this.channel.push({play: false, base: 0, voice: 0, pos: 0, vol: 0, count: 0});
		this.pcm = PCM;
		this.rate = Math.floor(clock / 1000);
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.gain = gain;
		if (!audioCtx)
			return;
		this.source = audioCtx.createBufferSource();
		this.gainNode = audioCtx.createGain();
		this.gainNode.gain.value = gain;
		this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
		this.scriptNode.onaudioprocess = ({outputBuffer}) => this.makeSound(outputBuffer.getChannelData(0).fill(0));
		this.source.connect(this.scriptNode);
		this.scriptNode.connect(this.gainNode);
		this.gainNode.connect(audioCtx.destination);
		this.source.start();
	}

	mute(flag) {
		if (!audioCtx)
			return;
		this.gainNode.gain.value = flag ? 0 : this.gain;
	}

	write(addr, data) {
		const ch = this.channel[addr >> 1 & 1];
		if ((addr & 1) !== 0) {
			ch.base = data << 11 & 0x70000;
			ch.voice = data & 0x1f;
		}
		else if (ch.voice) {
			ch.vol = [26, 84, 200, 258][data >> 6];
			ch.pos = this.pcm[ch.base | ch.voice * 2 - 2] << 8 | this.pcm[ch.base | ch.voice * 2 - 1];
			ch.play = this.pcm[ch.base | ch.pos] !== 0xff;
			ch.count = this.pcm[ch.base | ch.pos] === 0 ? this.pcm[ch.base | (ch.pos = ch.pos + 1 & 0xffff)] + 1 : 0;
		}
	}

	update() {
	}

	makeSound(data) {
		data.forEach((e, i) => {
			this.channel.forEach(ch => ch.play && !ch.count && (data[i] += (this.pcm[ch.base | ch.pos] - 0x80) * ch.vol / 32767));
			for (this.cycles += this.rate; this.cycles >= this.sampleRate; this.cycles -= this.sampleRate)
				this.channel.forEach(ch => {
					if (!ch.play || ch.count && --ch.count)
						return;
					ch.play = this.pcm[ch.base | (ch.pos = ch.pos + 1 & 0xffff)] !== 0xff;
					ch.count = this.pcm[ch.base | ch.pos] === 0 ? this.pcm[ch.base | (ch.pos = ch.pos + 1 & 0xffff)] + 1 : 0;
				});
		});
	}
}

