/*
 *
 *	Pac-Man Sound Module
 *
 */

class PacManSound {
	constructor(SND, base, base2 = null, se = [], freq = 11025) {
		this.audioBuffer = [];
		for (let i = 0; i < 8; i++) {
			this.audioBuffer[i] = audioCtx.createBuffer(1, 32, 48000);
			this.audioBuffer[i].getChannelData(0).forEach((x, j, data) => data[j] = (SND[i * 32 + j] & 0x0f) * 2 / 15 - 1);
		}
		this.base = base;
		this.base2 = base2;
		this.channel = [];
		for (let i = 0; i < 3; i++) {
			const ch = {voice: 0, freq: 0, vol: 0, gainNode: [], audioBufferSource: []};
			for (let j = 0; j < 8; j++) {
				ch.gainNode[j] = audioCtx.createGain();
				ch.gainNode[j].gain.value = 0;
				ch.gainNode[j].connect(audioCtx.destination);
				ch.audioBufferSource[j] = audioCtx.createBufferSource();
				ch.audioBufferSource[j].buffer = this.audioBuffer[j];
				ch.audioBufferSource[j].loop = true;
				ch.audioBufferSource[j].playbackRate.value = 0;
				ch.audioBufferSource[j].connect(ch.gainNode[j]);
				ch.audioBufferSource[j].start();
			}
			this.channel.push(ch);
		}
	}

	output() {
		const now = audioCtx.currentTime;
		const nextTime = now + 1 / 120;
		let voice, freq, vol;

		this.channel.forEach((ch, i) => {
			[voice, freq, vol] = PacManSound.getParameter(this.base, i);
			if (voice !== ch.voice) {
				ch.gainNode[ch.voice].gain.cancelScheduledValues(now);
				ch.gainNode[ch.voice].gain.setValueAtTime(0, now);
				ch.audioBufferSource[voice].playbackRate.cancelScheduledValues(now);
				ch.audioBufferSource[voice].playbackRate.setValueAtTime(freq / (1 << 14), now);
				ch.gainNode[voice].gain.cancelScheduledValues(now);
				ch.gainNode[voice].gain.setValueAtTime(freq > 0 ? vol / (15 * 10) : 0, now);
				[ch.voice, ch.freq, ch.vol] = [voice, freq, vol];
			}
			else if (freq !== ch.freq) {
				ch.audioBufferSource[voice].playbackRate.cancelScheduledValues(now);
				ch.audioBufferSource[voice].playbackRate.setValueAtTime(freq / (1 << 14), now);
				ch.gainNode[voice].gain.cancelScheduledValues(now);
				ch.gainNode[voice].gain.setValueAtTime(freq > 0 ? vol / (15 * 10) : 0, now);
				[ch.freq, ch.vol] = [freq, vol];
			}
			else if (vol !== ch.vol) {
				ch.gainNode[voice].gain.cancelScheduledValues(now);
				ch.gainNode[voice].gain.setValueAtTime(freq > 0 ? vol / (15 * 10) : 0, now);
				ch.vol = vol;
			}
		}, this);
		if (this.base2 !== null)
			this.channel.forEach((ch, i) => {
				[voice, freq, vol] = PacManSound.getParameter(this.base2, i);
				if (voice !== ch.voice) {
					ch.gainNode[ch.voice].gain.setValueAtTime(0, nextTime);
					ch.audioBufferSource[voice].playbackRate.setValueAtTime(freq / (1 << 14), nextTime);
					ch.gainNode[voice].gain.setValueAtTime(freq > 0 ? vol / (15 * 10) : 0, nextTime);
					[ch.voice, ch.freq, ch.vol] = [voice, freq, vol];
				}
				else if (freq !== ch.freq) {
					ch.audioBufferSource[voice].playbackRate.setValueAtTime(freq / (1 << 14), nextTime);
					ch.gainNode[voice].gain.setValueAtTime(freq > 0 ? vol / (15 * 10) : 0, nextTime);
					[ch.freq, ch.vol] = [freq, vol];
				}
				else if (vol !== ch.vol) {
					ch.gainNode[voice].gain.setValueAtTime(freq > 0 ? vol / (15 * 10) : 0, nextTime);
					ch.vol = vol;
				}
			}, this);
	}

	static getParameter(base, index) {
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

