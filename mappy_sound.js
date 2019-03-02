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
		for (let i = 0; i < 8; i++)
			this.channel[i] = new (function (dst, buf) {
				this.voice = 0;
				this.freq = 0;
				this.vol = 0;
				this.gainNode = [];
				this.audioBufferSource = [];
				this.merger = audioCtx.createChannelMerger(1);
				this.merger.connect(dst);
				for (let i = 0; i < 8; i++) {
					this.gainNode[i] = audioCtx.createGain();
					this.gainNode[i].gain.value = 0;
					this.gainNode[i].connect(this.merger);
					this.audioBufferSource[i] = audioCtx.createBufferSource();
					this.audioBufferSource[i].buffer = buf[i];
					this.audioBufferSource[i].loop = true;
					this.audioBufferSource[i].playbackRate.value = 0;
					this.audioBufferSource[i].connect(this.gainNode[i]);
					this.audioBufferSource[i].start();
				}
			})(this.merger, this.audioBuffer);
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
				ch.gainNode[ch.voice].gain.value = 0;
				ch.audioBufferSource[voice].playbackRate.value = freq / (1 << 16);
				ch.gainNode[voice].gain.value = freq > 0 ? vol / (15 * 10) : 0;
				ch.voice = voice;
				ch.freq = freq;
				ch.vol = vol;
			}
			else if (freq !== ch.freq) {
				ch.audioBufferSource[voice].playbackRate.value = freq / (1 << 16);
				ch.gainNode[voice].gain.value = freq > 0 ? vol / (15 * 10) : 0;
				ch.freq = freq;
				ch.vol = vol;
			}
			else if (vol !== ch.vol) {
				ch.gainNode[voice].gain.value = freq > 0 ? vol / (15 * 10) : 0;
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

