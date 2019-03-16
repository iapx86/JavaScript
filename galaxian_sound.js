/*
 *
 *	Galaxian Sound Module
 *
 */

class GalaxianSound {
	constructor(SND, base) {
		this.audioBuffer = [];
		for (let i = 0; i < 2; i++) {
			this.audioBuffer[i] = audioCtx.createBuffer(1, 32, 48000);
			this.audioBuffer[i].getChannelData(0).forEach((x, j, data) => data[j] = (SND[i * 32 + j] & 0x0f) * 0.2 / 15 - 0.1);
		}
		this.rate = Math.floor(0x10000000 * (48000 / audioCtx.sampleRate));
		this.base = base;
		this.channel = {voice: 0, freq: 0, phase: 0};
		this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
		this.scriptNode.onaudioprocess = e => {
			e.outputBuffer.getChannelData(0).forEach((v, i, data) => {
				data[i] = this.audioBuffer[this.channel.voice].getChannelData(0)[this.channel.phase >>> 21 & 31];
				this.channel.phase += this.channel.freq;
			});
		};
		this.source = audioCtx.createBufferSource();
		this.source.connect(this.scriptNode);
		this.scriptNode.connect(audioCtx.destination);
		this.source.start();
	}

	output(game) {
		const base = this.base;
		this.channel.freq = game.fSoundEnable ? Math.floor(this.rate / ((base[0x17] + 1) * (256 - base[0x30]))) : 0;
		this.channel.voice = base[0x17] & 1;
	}
}

