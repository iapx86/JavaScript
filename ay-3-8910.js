/*
 *
 *	AY-3-8910 Sound Module
 *
 */

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

class AY_3_8910 {
	constructor(clock, base) {
		this.audioBuffer = [];
		for (let i = 0; i < 2; i++) {
			this.audioBuffer[i] = audioCtx.createBuffer(1, 8192, 96000);
			const data = this.audioBuffer[i].getChannelData(0);
			switch (i) {
			case 0:
				for (let j = 0; j < data.length; j++)
					data[j] = j & 1 ? 1.0 : -1.0;
				break;
			case 1:
				for (let j = 0; j < data.length; j++)
					data[j] = Math.random() < 0.5 ? 1.0 : -1.0;
				break;
			}
		}
		this.rate = clock / 8 / 96000;
		this.base = base;
		this.gainNode = audioCtx.createGain();
		this.gainNode.connect(audioCtx.destination);
		this.merger = audioCtx.createChannelMerger(1);
		this.merger.connect(this.gainNode);
		this.channel = [];
		for (let i = 0; i < 6; i++) {
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
			})(this.merger, this.audioBuffer[i < 3 ? 0 : 1]);
		}
	}

	output() {
		const base = this.base;
		for (let i = 0; i < 3; i++) {
			const freq = base[i * 2] | base[i * 2 + 1] << 8 & 0xf00;
			const vol = base[7] & 1 << i || base[i + 8] & 0x10 ? 0 : base[i + 8] & 0x0f;
			const ch = this.channel[i];
			if (freq !== ch.freq) {
				ch.audioBufferSource.playbackRate.value = this.rate / (freq === 0 ? 1 : freq);
				ch.freq = freq;
			}
			if (vol !== ch.vol) {
				ch.gainNode.gain.value = vol === 0 ? 0 : Math.pow(2, (15 - vol) / 2) / 10;
				ch.vol = vol;
			}
		}
		for (let i = 3; i < 6; i++) {
			const freq = base[6] & 0x1f;
			const vol = base[7] & 1 << i || base[i + 5] & 0x10 ? 0 : base[i + 5] & 0x0f;
			const ch = this.channel[i];
			if (freq !== ch.freq) {
				ch.audioBufferSource.playbackRate.value = this.rate / 2 / (freq === 0 ? 1 : freq);
				ch.freq = freq;
			}
			if (vol !== ch.vol) {
				ch.gainNode.gain.value = vol === 0 ? 0 : Math.pow(2, (15 - vol) / 2) / 10;
				ch.vol = vol;
			}
		}
	}
}

