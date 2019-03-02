/*
 *
 *	AY-3-8910 Sound Module
 *
 */

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

class AY_3_8910 {
	constructor(clock, psg, resolution = 0, se = [], freq = 11025) {
		const sampleRate = 96000, repeat = 16;
		this.noiseBuffer = audioCtx.createBuffer(1, 131071 * repeat, sampleRate);
		for (let data = this.noiseBuffer.getChannelData(0), rng = 0xffff, i = 0; i < data.length; i++) {
			if (i % repeat === 0)
				rng = (rng >>> 16 ^ rng >>> 13 ^ 1) & 1 | rng << 1;
			data[i] = rng & 1 ? 1 : -1;
		}
		this.clock = clock;
		this.rate = clock * repeat / 8 / sampleRate;
		this.psg = psg;
		this.resolution = resolution;
		this.se = se;
		this.gainNode = audioCtx.createGain();
		this.gainNode.connect(audioCtx.destination);
		this.merger = audioCtx.createChannelMerger(1);
		this.merger.connect(this.gainNode);
		this.channel = [];
		for (let i = 0; i < psg.length; i++) {
			this.channel[i] = [];
			for (let j = 0; j < 3; j++) {
				const ch = {freq: 0, vol: 0, gainNode: audioCtx.createGain(), oscillator: audioCtx.createOscillator()};
				ch.gainNode.gain.value = 0;
				ch.gainNode.connect(this.merger);
				ch.oscillator.type = 'square';
				ch.oscillator.frequency.value = 0;
				ch.oscillator.connect(ch.gainNode);
				ch.oscillator.start();
				this.channel[i][j] = ch;
			}
			for (let j = 3; j < 6; j++) {
				const ch = {freq: 0, vol: 0, gainNode: audioCtx.createGain(), audioBufferSource: audioCtx.createBufferSource()};
				ch.gainNode.gain.value = 0;
				ch.gainNode.connect(this.merger);
				ch.audioBufferSource.buffer = this.noiseBuffer;
				ch.audioBufferSource.loop = true;
				ch.audioBufferSource.playbackRate.value = 0;
				ch.audioBufferSource.connect(ch.gainNode);
				ch.audioBufferSource.start();
				this.channel[i][j] = ch;
			}
		}
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
		const now = audioCtx.currentTime;
		const que = [];
		let freq, vol;
		for (let i = 0; i < this.psg.length; i++) {
			const base = this.psg[i].reg;
			if (typeof this.psg[i].que !== 'undefined') {
				que[i] = this.psg[i].que;
				this.psg[i].que = '';
				while (que[i] !== '' && que[i].charCodeAt(0) === 0) {
					base[que[i].charCodeAt(1)] = que[i].charCodeAt(2);
					que[i] = que[i].substring(3);
				}
			}
			for (let j = 0; j < 3; j++)
				this.channel[i][j].oscillator.frequency.cancelScheduledValues(now);
			for (let j = 3; j < 6; j++)
				this.channel[i][j].audioBufferSource.playbackRate.cancelScheduledValues(now);
			for (let j = 0; j < 6; j++)
				this.channel[i][j].gainNode.gain.cancelScheduledValues(now);
		}
		for (let i = 0; i < this.psg.length; i++) {
			const base = this.psg[i].reg;
			for (let j = 0; j < 3; j++) {
				[freq, vol] = AY_3_8910.getToneParameter(base, j);
				const ch = this.channel[i][j];
				ch.oscillator.frequency.setValueAtTime(this.clock / 16 / (freq === 0 ? 1 : freq), now);
				ch.gainNode.gain.setValueAtTime(vol === 0 ? 0 : Math.pow(2, (vol - 15) / 2) / 10, now);
				[ch.freq, ch.vol] = [freq, vol];
			}
			for (let j = 0; j < 3; j++) {
				[freq, vol] = AY_3_8910.getNoiseParameter(base, j);
				const ch = this.channel[i][j + 3];
				ch.audioBufferSource.playbackRate.setValueAtTime(this.rate / 2 / (freq === 0 ? 1 : freq), now);
				ch.gainNode.gain.setValueAtTime(vol === 0 ? 0 : Math.pow(2, (vol - 15) / 2) / 10, now);
				[ch.freq, ch.vol] = [freq, vol];
			}
		}
		for (let i = 0; i < this.psg.length; i++) {
			const base = this.psg[i].reg;
			if (typeof this.psg[i].que === 'undefined')
				continue;
			while (que[i] !== '') {
				const count = que[i].charCodeAt(0);
				do {
					base[que[i].charCodeAt(1)] = que[i].charCodeAt(2);
					que[i] = que[i].substring(3);
				} while (que[i] !== '' && que[i].charCodeAt(0) === count);
				const time = now + count / 60 / this.resolution;
				for (let j = 0; j < 3; j++) {
					[freq, vol] = AY_3_8910.getToneParameter(base, j);
					const ch = this.channel[i][j];
					if (freq !== ch.freq) {
						ch.oscillator.frequency.setValueAtTime(this.clock / 16 / (freq === 0 ? 1 : freq), time);
						ch.freq = freq;
					}
					if (vol !== ch.vol) {
						ch.gainNode.gain.setValueAtTime(vol === 0 ? 0 : Math.pow(2, (vol - 15) / 2) / 10, time);
						ch.vol = vol;
					}
				}
				for (let j = 0; j < 3; j++) {
					[freq, vol] = AY_3_8910.getNoiseParameter(base, j);
					const ch = this.channel[i][j + 3];
					if (freq !== ch.freq) {
						ch.audioBufferSource.playbackRate.setValueAtTime(this.rate / 2 / (freq === 0 ? 1 : freq), time);
						ch.freq = freq;
					}
					if (vol !== ch.vol) {
						ch.gainNode.gain.setValueAtTime(vol === 0 ? 0 : Math.pow(2, (vol - 15) / 2) / 10, time);
						ch.vol = vol;
					}
				}
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
	
	static getToneParameter(base, index) {
		const freq = base[index * 2] | base[index * 2 + 1] << 8 & 0xf00;
		const vol = (base[7] & 1 << index) !== 0 ? 0 : (base[index + 8] & 0x10) !== 0 ? 13 : base[index + 8] & 0x0f;
		return [freq, vol];
	}

	static getNoiseParameter(base, index) {
		const freq = base[6] & 0x1f;
		const vol = (base[7] & 1 << index + 3) !== 0 ? 0 : (base[index + 8] & 0x10) !== 0 ? 13 : base[index + 8] & 0x0f;
		return [freq, vol];
	}
}

