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
			this.audioBuffer[i].getChannelData(0).forEach((x, j, data) => data[j] = (SND[i * 32 + j] & 0x0f) * 2 / 15 - 1);
		}
		this.base = base;
		this.se = se;
		this.merger = audioCtx.createChannelMerger(1);
		this.merger.connect(audioCtx.destination);
		this.channel = [];
		for (let i = 0; i < 8; i++) {
			const ch = {voice: 0, freq: 0, vol: 0, merger: audioCtx.createChannelMerger(1), gainNode: [], audioBufferSource: []};
			ch.merger.connect(this.merger);
			for (let j = 0; j < 8; j++) {
				ch.gainNode[j] = audioCtx.createGain();
				ch.gainNode[j].gain.value = 0;
				ch.gainNode[j].connect(ch.merger);
				ch.audioBufferSource[j] = audioCtx.createBufferSource();
				ch.audioBufferSource[j].buffer = this.audioBuffer[j];
				ch.audioBufferSource[j].loop = true;
				ch.audioBufferSource[j].playbackRate.value = 0;
				ch.audioBufferSource[j].connect(ch.gainNode[j]);
				ch.audioBufferSource[j].start();
			}
			this.channel.push(ch);
		}
		se.forEach(se => {
			se.audioBuffer = audioCtx.createBuffer(1, se.buf.length, 48000);
			se.audioBuffer.getChannelData(0).forEach((x, i, data) => data[i] = se.buf[i] / 32767);
			se.playbackRate = freq / 48000;
			se.audioBufferSource = null;
		});
	}

	output() {
		const base = this.base;
		this.channel.forEach((ch, i) => {
			const voice = base[6 + i * 8] >>> 4 & 7;
			const freq = base[4 + i * 8] | base[5 + i * 8] << 8 | base[6 + i * 8] << 16 & 0xf0000;
			const vol = base[3 + i * 8] & 0x0f;
			if (voice !== ch.voice) {
				ch.gainNode[ch.voice].gain.value = 0;
				ch.audioBufferSource[voice].playbackRate.value = freq / (1 << 16);
				ch.gainNode[voice].gain.value = freq > 0 ? vol / (15 * 10) : 0;
				[ch.voice, ch.freq, ch.vol] = [voice, freq, vol];
			}
			else if (freq !== ch.freq) {
				ch.audioBufferSource[voice].playbackRate.value = freq / (1 << 16);
				ch.gainNode[voice].gain.value = freq > 0 ? vol / (15 * 10) : 0;
				[ch.freq, ch.vol] = [freq, vol];
			}
			else if (vol !== ch.vol) {
				ch.gainNode[voice].gain.value = freq > 0 ? vol / (15 * 10) : 0;
				ch.vol = vol;
			}
		});
		this.se.forEach(se => {
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
			se.start = se.stop = false;
		});
	}
}

