/*
 *
 *	Mappy Sound Module
 *
 */

class MappySound {
	constructor(SND, base) {
		this.audioBuffer = [];
		for (let i = 0; i < 8; i++) {
			this.audioBuffer[i] = audioCtx.createBuffer(1, 32, 48000);
			this.audioBuffer[i].getChannelData(0).forEach((x, j, data) => data[j] = (SND[i * 32 + j] & 0x0f) * 2 / 15 - 1);
		}
		this.rate = Math.floor(2048 * 48000 / audioCtx.sampleRate);
		this.base = base;
		this.channel = [];
		for (let i = 0; i < 8; i++)
			this.channel.push({voice: 0, freq: 0, vol: 0, phase: 0});
		this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
		this.scriptNode.onaudioprocess = e => {
			e.outputBuffer.getChannelData(0).forEach((v, i, data) => {
				data[i] = 0;
				this.channel.forEach(ch => {
					data[i] += this.audioBuffer[ch.voice].getChannelData(0)[ch.phase >>> 27] * ch.vol / (15 * 10);
					ch.phase += ch.freq * this.rate;
				});
			});
		};
		this.source = audioCtx.createBufferSource();
		this.source.connect(this.scriptNode);
		this.scriptNode.connect(audioCtx.destination);
		this.source.start();
	}

	output() {
		this.channel.forEach((ch, i) => {
			ch.voice = this.base[6 + i * 8] >>> 4 & 7;
			ch.freq = this.base[4 + i * 8] | this.base[5 + i * 8] << 8 | this.base[6 + i * 8] << 16 & 0xf0000;
			ch.vol = this.base[3 + i * 8] & 0x0f;
		});
	}
}
