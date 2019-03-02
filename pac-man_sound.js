/*
 *
 *	Pac-Man Sound Module
 *
 */

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

class PacManSound {
	constructor(SND, base, base2 = null, se = [], freq = 11025) {
		this.audioBuffer = [];
		for (let i = 0; i < 8; i++) {
			this.audioBuffer[i] = audioCtx.createBuffer(1, 32, 48000);
			const data = this.audioBuffer[i].getChannelData(0);
			for (let j = 0; j < 32; j++)
				data[j] = (SND[i * 32 + j] & 0x0f) * 2 / 15 - 1;
		}
		this.base = base;
		this.base2 = base2;
		this.se = se;
		this.gainNode = audioCtx.createGain();
		this.gainNode.connect(audioCtx.destination);
		this.merger = audioCtx.createChannelMerger(1);
		this.merger.connect(this.gainNode);
		this.channel = [];
		for (let i = 0; i < 3; i++)
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
		const now = audioCtx.currentTime;
		const nextTime = now + 1 / 120;
		let voice, freq, vol;

		for (let i = 0; i < 3; i++) {
			[voice, freq, vol] = this.getParameter(this.base, i);
			const ch = this.channel[i];
			if (voice !== ch.voice) {
				ch.gainNode[ch.voice].gain.cancelScheduledValues(now);
				ch.gainNode[ch.voice].gain.setValueAtTime(0, now);
				ch.audioBufferSource[voice].playbackRate.cancelScheduledValues(now);
				ch.audioBufferSource[voice].playbackRate.setValueAtTime(freq / (1 << 14), now);
				ch.gainNode[voice].gain.cancelScheduledValues(now);
				ch.gainNode[voice].gain.setValueAtTime(freq > 0 ? vol / (15 * 10) : 0, now);
				ch.voice = voice;
				ch.freq = freq;
				ch.vol = vol;
			}
			else if (freq !== ch.freq) {
				ch.audioBufferSource[voice].playbackRate.cancelScheduledValues(now);
				ch.audioBufferSource[voice].playbackRate.setValueAtTime(freq / (1 << 14), now);
				ch.gainNode[voice].gain.cancelScheduledValues(now);
				ch.gainNode[voice].gain.setValueAtTime(freq > 0 ? vol / (15 * 10) : 0, now);
				ch.freq = freq;
				ch.vol = vol;
			}
			else if (vol !== ch.vol) {
				ch.gainNode[voice].gain.cancelScheduledValues(now);
				ch.gainNode[voice].gain.setValueAtTime(freq > 0 ? vol / (15 * 10) : 0, now);
				ch.vol = vol;
			}
		}
		if (this.base2 !== null)
			for (let i = 0; i < 3; i++) {
				[voice, freq, vol] = this.getParameter(this.base2, i);
				const ch = this.channel[i];
				if (voice !== ch.voice) {
					ch.gainNode[ch.voice].gain.setValueAtTime(0, nextTime);
					ch.audioBufferSource[voice].playbackRate.setValueAtTime(freq / (1 << 14), nextTime);
					ch.gainNode[voice].gain.setValueAtTime(freq > 0 ? vol / (15 * 10) : 0, nextTime);
					ch.voice = voice;
					ch.freq = freq;
					ch.vol = vol;
				}
				else if (freq !== ch.freq) {
					ch.audioBufferSource[voice].playbackRate.setValueAtTime(freq / (1 << 14), nextTime);
					ch.gainNode[voice].gain.setValueAtTime(freq > 0 ? vol / (15 * 10) : 0, nextTime);
					ch.freq = freq;
					ch.vol = vol;
				}
				else if (vol !== ch.vol) {
					ch.gainNode[voice].gain.setValueAtTime(freq > 0 ? vol / (15 * 10) : 0, nextTime);
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

	getParameter(base, index) {
		let voice, freq, vol;

		switch (index) {
		case 0:
			voice = base[0x05] & 7;
			freq = base[0x10] | base[0x11] << 4 | base[0x12] << 8 | base[0x13] << 12 | base[0x14] << 16;
			vol = base[0x15];
			break;
		case 1:
			voice = base[0x0a] & 7;
			freq = base[0x16] << 4 | base[0x17] << 8 | base[0x18] << 12 | base[0x19] << 16;
			vol = base[0x1a];
			break;
		case 2:
			voice = base[0x0f] & 7;
			freq = base[0x1b] << 4 | base[0x1c] << 8 | base[0x1d] << 12 | base[0x1e] << 16;
			vol = base[0x1f];
			break;
		}
		return [voice, freq, vol];
	}
}

