/*
 *
 *	Galaxian Sound Module
 *
 */

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

class GalaxianSound {
	constructor(SND, base, se = [], freq = 11025) {
		this.audioBuffer = [];
		for (let i = 0; i < 2; i++) {
			this.audioBuffer[i] = audioCtx.createBuffer(1, 32, 44100);
			const data = this.audioBuffer[i].getChannelData(0);
			for (let j = 0; j < 32; j++)
				data[j] = (SND[i * 32 + j] & 0x0f) * 0.2 / 15 - 0.1;
		}
		this.base = base;
		this.se = se;
		this.gainNode = audioCtx.createGain();
		this.gainNode.connect(audioCtx.destination);
		this.merger = audioCtx.createChannelMerger(1);
		this.merger.connect(this.gainNode);
		this.channel = {};
		this.channel.voice = 0;
		this.channel.freq = 0;
		this.channel.audioBufferSource = audioCtx.createBufferSource();
		this.channel.audioBufferSource.buffer = this.audioBuffer[0];
		this.channel.audioBufferSource.loop = true;
		this.channel.audioBufferSource.playbackRate.value = 0;
		this.channel.audioBufferSource.connect(this.merger);
		this.channel.audioBufferSource.start();
		for (let i = 0; i < se.length; i++) {
			const n = se[i].buf.length;
			se[i].audioBuffer = audioCtx.createBuffer(1, n, 44100);
			se[i].playbackRate = freq / 44100;
			const data = se[i].audioBuffer.getChannelData(0);
			for (let j = 0; j < n; j++)
				data[j] = se[i].buf[j] / 32767;
			se[i].audioBufferSource = null;
		}
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
			ch.audioBufferSource.connect(this.merger);
			ch.audioBufferSource.start();
			ch.voice = voice;
			ch.freq = freq;
		}
		else if (freq !== ch.freq) {
			ch.audioBufferSource.playbackRate.value = freq / (1 << 24);
			ch.freq = freq;
		}
		for (let i = 0, n = this.se.length; i < n; i++) {
			const se = this.se[i];
			if (se.stop && se.audioBufferSource) {
				se.audioBufferSource.stop();
				se.audioBufferSource = null;
			}
			if (se.start && !se.audioBufferSource) {
				se.audioBufferSource = audioCtx.createBufferSource();
				se.audioBufferSource.buffer = se.audioBuffer;
				se.audioBufferSource.loop = se.loop;
				se.audioBufferSource.playbackRate.value = se.playbackRate;
				se.audioBufferSource.connect(this.merger);
				se.audioBufferSource.start();
			}
			se.start = false;
			se.stop = false;
		}
	}
}

