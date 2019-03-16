/*
 *
 *	AY-3-8910 Sound Module
 *
 */

class AY_3_8910 {
	constructor(clock, psg, resolution = 0) {
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
		this.channel = [];
		for (let i = 0; i < 3; i++) {
			const ch = {freq: 0, vol: 0, gainNode: audioCtx.createGain(), oscillator: audioCtx.createOscillator()};
			ch.gainNode.gain.value = 0;
			ch.gainNode.connect(audioCtx.destination);
			ch.oscillator.type = 'square';
			ch.oscillator.frequency.value = 0;
			ch.oscillator.connect(ch.gainNode);
			ch.oscillator.start();
			this.channel.push(ch);
		}
		for (let i = 0; i < 3; i++) {
			const ch = {freq: 0, vol: 0, gainNode: audioCtx.createGain(), audioBufferSource: audioCtx.createBufferSource()};
			ch.gainNode.gain.value = 0;
			ch.gainNode.connect(audioCtx.destination);
			ch.audioBufferSource.buffer = this.noiseBuffer;
			ch.audioBufferSource.loop = true;
			ch.audioBufferSource.playbackRate.value = 0;
			ch.audioBufferSource.connect(ch.gainNode);
			ch.audioBufferSource.start();
			this.channel.push(ch);
		}
	}

	output() {
		const now = audioCtx.currentTime;
		const base = this.psg.reg;
		let que, freq, vol;
		if (typeof this.psg.que !== 'undefined') {
			que = this.psg.que;
			this.psg.que = '';
			while (que !== '' && que.charCodeAt(0) === 0) {
				base[que.charCodeAt(1)] = que.charCodeAt(2);
				que = que.substring(3);
			}
		}
		for (let i = 0; i < 3; i++)
			this.channel[i].oscillator.frequency.cancelScheduledValues(now);
		for (let i = 0; i < 3; i++)
			this.channel[i + 3].audioBufferSource.playbackRate.cancelScheduledValues(now);
		for (let i = 0; i < 6; i++)
			this.channel[i].gainNode.gain.cancelScheduledValues(now);
		for (let i = 0; i < 3; i++) {
			[freq, vol] = AY_3_8910.getToneParameter(base, i);
			const ch = this.channel[i];
			ch.oscillator.frequency.setValueAtTime(this.clock / 16 / (freq === 0 ? 1 : freq), now);
			ch.gainNode.gain.setValueAtTime(vol === 0 ? 0 : Math.pow(2, (vol - 15) / 2) / 10, now);
			[ch.freq, ch.vol] = [freq, vol];
		}
		for (let i = 0; i < 3; i++) {
			[freq, vol] = AY_3_8910.getNoiseParameter(base, i);
			const ch = this.channel[i + 3];
			ch.audioBufferSource.playbackRate.setValueAtTime(this.rate / 2 / (freq === 0 ? 1 : freq), now);
			ch.gainNode.gain.setValueAtTime(vol === 0 ? 0 : Math.pow(2, (vol - 15) / 2) / 10, now);
			[ch.freq, ch.vol] = [freq, vol];
		}
		if (typeof this.psg.que !== 'undefined')
			while (que !== '') {
				const count = que.charCodeAt(0);
				do {
					base[que.charCodeAt(1)] = que.charCodeAt(2);
					que = que.substring(3);
				} while (que !== '' && que.charCodeAt(0) === count);
				const time = now + count / 60 / this.resolution;
				for (let i = 0; i < 3; i++) {
					[freq, vol] = AY_3_8910.getToneParameter(base, i);
					const ch = this.channel[i];
					if (freq !== ch.freq) {
						ch.oscillator.frequency.setValueAtTime(this.clock / 16 / (freq === 0 ? 1 : freq), time);
						ch.freq = freq;
					}
					if (vol !== ch.vol) {
						ch.gainNode.gain.setValueAtTime(vol === 0 ? 0 : Math.pow(2, (vol - 15) / 2) / 10, time);
						ch.vol = vol;
					}
				}
				for (let i = 0; i < 3; i++) {
					[freq, vol] = AY_3_8910.getNoiseParameter(base, i);
					const ch = this.channel[i + 3];
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

