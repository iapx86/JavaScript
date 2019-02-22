/*
 *
 *	AY-3-8910 Sound Module
 *
 */

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

class AY_3_8910 {
	constructor(clock, base, se = [], freq = 11025) {
		const sampleRate = 96000, repeat = 16;
		this.toneBuffer = audioCtx.createBuffer(1, 2 * repeat, sampleRate);
		for (let data = this.toneBuffer.getChannelData(0), i = 0; i < data.length; i++)
			data[i] = i < repeat ? 1 : -1;
		this.noiseBuffer = audioCtx.createBuffer(1, 131071 * repeat, sampleRate);
		for (let data = this.noiseBuffer.getChannelData(0), rng = 0xffff, i = 0; i < data.length; i++) {
			if (i % repeat === 0)
				rng = (rng >>> 16 ^ rng >>> 13 ^ 1) & 1 | rng << 1;
			data[i] = rng & 1 ? 1 : -1;
		}
		this.rate = clock / 8 * repeat / sampleRate;
		this.base = base;
		this.se = se;
		this.gainNode = audioCtx.createGain();
		this.gainNode.connect(audioCtx.destination);
		this.merger = audioCtx.createChannelMerger(1);
		this.merger.connect(this.gainNode);
		this.channel = [];
		for (let i = 0; i < 6; i++)
			this.channel[i] = new (function (dst, buf) {
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
			})(this.merger, i < 3 ? this.toneBuffer : this.noiseBuffer);
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

	output() {
		const base = this.base;
		for (let i = 0; i < 3; i++) {
			const freq = base[i * 2] | base[i * 2 + 1] << 8 & 0xf00;
			const vol = (base[7] & 1 << i) !== 0 ? 0 : (base[i + 8] & 0x10) !== 0 ? 13 : base[i + 8] & 0x0f;
			const ch = this.channel[i];
			if (freq !== ch.freq) {
				ch.audioBufferSource.playbackRate.value = this.rate / (freq === 0 ? 1 : freq);
				ch.freq = freq;
			}
			if (vol !== ch.vol) {
				ch.gainNode.gain.value = vol === 0 ? 0 : Math.pow(2, (vol - 15) / 2) / 10;
				ch.vol = vol;
			}
		}
		for (let i = 3; i < 6; i++) {
			const freq = base[6] & 0x1f;
			const vol = (base[7] & 1 << i) !== 0 ? 0 : (base[i + 5] & 0x10) !== 0 ? 13 : base[i + 5] & 0x0f;
			const ch = this.channel[i];
			if (freq !== ch.freq) {
				ch.audioBufferSource.playbackRate.value = this.rate / 2 / (freq === 0 ? 1 : freq);
				ch.freq = freq;
			}
			if (vol !== ch.vol) {
				ch.gainNode.gain.value = vol === 0 ? 0 : Math.pow(2, (vol - 15) / 2) / 10;
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

