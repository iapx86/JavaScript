/*
 *
 *	Mappy Sound Module
 *
 */

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

class MappySound {
	constructor(SND, base, se = [], freq = 11025) {
		this.audioBuffer = [];
		for (let i = 0; i < 8; i++) {
			this.audioBuffer[i] = audioCtx.createBuffer(1, 32, 48000);
			const data = this.audioBuffer[i].getChannelData(0);
			for (let j = 0; j < 32; j++)
				data[j] = (SND[i * 32 + j] & 0x0f) * 2 / 15 - 1;
		}
		this.base = base;
		this.se = se;
		this.gainNode = audioCtx.createGain();
		this.gainNode.connect(audioCtx.destination);
		this.merger = audioCtx.createChannelMerger(1);
		this.merger.connect(this.gainNode);
		this.channel = [];
		for (let i = 0; i < 8; i++) {
			this.channel[i] = new (function (dst, buf) {
				this.voice = 0;
				this.freq = 0;
				this.vol = 0;
				this.gainNode = audioCtx.createGain();
				this.gainNode.gain.value = 0;
				this.gainNode.connect(dst);
				this.audioBufferSource = audioCtx.createBufferSource();
				this.audioBufferSource.buffer = buf;
				this.audioBufferSource.loop = true;
				this.audioBufferSource.playbackRate.value = 0;
				this.audioBufferSource.connect(this.gainNode);
				this.audioBufferSource.start();
			})(this.merger, this.audioBuffer[0]);
		}
		for (let i = 0; i < se.length; i++) {
			const n = se[i].buf.length;
			se[i].audioBuffer = audioCtx.createBuffer(1, n, 48000);
			se[i].playbackRate = freq / 48000;
			const data = se[i].audioBuffer.getChannelData(0);
			for (let j = 0; j < n; j++)
				data[j] = se[i].buf[j] / 32767;
			se[i].audioBufferSource = null;
		}
	}

	output() {
		const base = this.base;
		for (let r = 0, i = 0; i < 8; r += 8, i++) {
			const voice = base[r + 6] >>> 4 & 7;
			const freq = base[r + 4] | base[r + 5] << 8 | base[r + 6] << 16 & 0xf0000;
			const vol = base[r + 3] & 0x0f;
			const ch = this.channel[i];
			if (voice !== ch.voice) {
				ch.audioBufferSource.stop();
				ch.audioBufferSource = audioCtx.createBufferSource();
				ch.audioBufferSource.buffer = this.audioBuffer[voice];
				ch.audioBufferSource.loop = true;
				ch.audioBufferSource.playbackRate.value = freq / (1 << 16);
				ch.audioBufferSource.connect(ch.gainNode);
				ch.audioBufferSource.start();
				ch.voice = voice;
				ch.freq = freq;
			}
			else if (freq !== ch.freq) {
				ch.audioBufferSource.playbackRate.value = freq / (1 << 16);
				ch.freq = freq;
			}
			if (vol !== ch.vol) {
				ch.gainNode.gain.value = vol / (15 * 10);
				ch.vol = vol;
			}
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

