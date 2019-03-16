/*
 *
 *	Galaxian Sound Module
 *
 */

class GalaxianSound {
	constructor(SND, base) {
		this.audioBuffer = [];
		for (let i = 0; i < 2; i++) {
			this.audioBuffer[i] = audioCtx.createBuffer(1, 32, 44100);
			this.audioBuffer[i].getChannelData(0).forEach((x, j, data) => data[j] = (SND[i * 32 + j] & 0x0f) * 0.2 / 15 - 0.1);
		}
		this.base = base;
		this.channel = {voice: 0, freq: 0, audioBufferSource: audioCtx.createBufferSource()};
		this.channel.audioBufferSource.buffer = this.audioBuffer[0];
		this.channel.audioBufferSource.loop = true;
		this.channel.audioBufferSource.playbackRate.value = 0;
		this.channel.audioBufferSource.connect(audioCtx.destination);
		this.channel.audioBufferSource.start();
	}

	output(game) {
		const base = this.base;
		const freq = game.fSoundEnable ? 2337397167 / ((base[0x17] + 1) * (256 - base[0x30])) | 0 : 0;
		const voice = base[0x17] & 1;
		const ch = this.channel;
		if (voice !== ch.voice) {
			ch.audioBufferSource.stop();
			ch.audioBufferSource = audioCtx.createBufferSource();
			ch.audioBufferSource.buffer = this.audioBuffer[voice];
			ch.audioBufferSource.loop = true;
			ch.audioBufferSource.playbackRate.value = freq / (1 << 24);
			ch.audioBufferSource.connect(audioCtx.destination);
			ch.audioBufferSource.start();
			[ch.voice, ch.freq] = [voice, freq];
		}
		else if (freq !== ch.freq) {
			ch.audioBufferSource.playbackRate.value = freq / (1 << 24);
			ch.freq = freq;
		}
	}
}

