/*
 *
 *	Galaxian Sound Module
 *
 */

export default class GalaxianSound {
	snd;
	rate;
	gain;
	channel = {voice: 0, freq: 0, phase: 0};

	source = audioCtx.createBufferSource();
	gainNode = audioCtx.createGain();
	scriptNode = audioCtx.createScriptProcessor(512, 1, 1);

	constructor({SND, gain = 0.1}) {
		this.snd = Float32Array.from(SND, e => (e & 0x0f) * 2 / 15 - 1);
		this.rate = Math.floor(0x10000000 * 48000 / audioCtx.sampleRate);
		this.gain = gain;
		this.gainNode.gain.value = this.gain;
		this.scriptNode.onaudioprocess = ({outputBuffer}) => this.makeSound(outputBuffer.getChannelData(0));
		this.source.connect(this.scriptNode).connect(this.gainNode).connect(audioCtx.destination);
		this.source.start();
	}

	mute(flag) {
		this.gainNode.gain.value = flag ? 0 : this.gain;
	}

	update(game) {
		const reg = game.mmo;
		this.channel.voice = reg[0x17] & 1;
		this.channel.freq = reg[0x30] !== 0xff ? Math.floor(this.rate / ((reg[0x17] + 1) * (256 - reg[0x30]))) : 0;
	}

	makeSound(data) {
		data.forEach((e, i) => {
			data[i] = this.snd[this.channel.voice << 5 | this.channel.phase >> 21 & 31];
			this.channel.phase = this.channel.phase + this.channel.freq | 0;
		});
	}
}

