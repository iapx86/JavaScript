/*
 *
 *	Mappy Sound Module
 *
 */

class MappySound {
	constructor(SND, base) {
		this.snd = Float32Array.from(SND, v => (v & 0x0f) * 2 / 15 - 1);
		this.rate = Math.floor(2048 * 48000 / audioCtx.sampleRate);
		this.base = base;
		this.channel = [];
		for (let i = 0; i < 8; i++)
			this.channel.push({voice: 0, freq: 0, vol: 0, phase: 0});
		this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
		this.scriptNode.onaudioprocess = e => {
			e.outputBuffer.getChannelData(0).fill(0).forEach((v, i, data) => {
				this.channel.forEach(ch => data[i] += this.snd[ch.voice << 5 | ch.phase >>> 27] * ch.vol / (15 * 10));
				this.channel.forEach(ch => ch.phase += ch.freq * this.rate);
			});
		};
		this.source = audioCtx.createBufferSource();
		this.source.connect(this.scriptNode);
		this.scriptNode.connect(audioCtx.destination);
		this.source.start();
	}

	output() {
		const reg = this.base;
		for (let i = 0; i < 8; i++) {
			const ch = this.channel[i];
			ch.voice = reg[6 + i * 8] >>> 4 & 7;
			ch.freq = reg[4 + i * 8] | reg[5 + i * 8] << 8 | reg[6 + i * 8] << 16 & 0xf0000;
			ch.vol = reg[3 + i * 8] & 0x0f;
		}
	}
}
