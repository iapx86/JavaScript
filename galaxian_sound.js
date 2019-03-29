/*
 *
 *	Galaxian Sound Module
 *
 */

class GalaxianSound {
	constructor({SND, gain = 0.1}) {
		const repeat = 8;
		this.audioBuffer = [];
		for (let i = 0; i < 2; i++) {
			this.audioBuffer[i] = audioCtx.createBuffer(1, 32 * repeat, audioCtx.sampleRate);
			this.audioBuffer[i].getChannelData(0).forEach((e, j, buf) => buf[j] = (SND[i << 5 | Math.floor(j / repeat)] & 0x0f) * 2 / 15 - 1);
		}
		this.rate = 48000 * repeat / audioCtx.sampleRate * (1 << 7);
		this.gain = gain;
		this.muteflag = false;
		this.channel = {source: [], gainNode: []};
		for (let i = 0; i < 2; i++) {
			this.channel.source[i] = audioCtx.createBufferSource();
			this.channel.source[i].buffer = this.audioBuffer[i];
			this.channel.source[i].loop = true;
			this.channel.gainNode[i] = audioCtx.createGain();
			this.channel.source[i].connect(this.channel.gainNode[i]);
			this.channel.gainNode[i].connect(audioCtx.destination);
			this.channel.source[i].start();
		}
	}

	mute(flag) {
		this.muteflag = flag;
	}

	update(game) {
		const reg = game.mmo;
		const voice = reg[0x17] & 1;
		const freq = (reg[0x17] + 1) * (256 - reg[0x30]);
		this.channel.source.forEach(n => n.playbackRate.value = this.rate / freq);
		this.channel.gainNode.forEach((n, i) => n.gain.value = i === voice && !this.muteflag ? this.gain : 0);
	}
}

