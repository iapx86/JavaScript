/*
 *
 *	Galaxian Sound Module
 *
 */

class GalaxianSound {
	constructor({SND, gain = 0.1}) {
		this.snd = Float32Array.from(SND, e => (e & 0x0f) * 2 / 15 - 1);
		this.rate = Math.floor(0x10000000 * (48000 / audioCtx.sampleRate));
		this.gain = gain;
		this.channel = {voice: 0, freq: 0, phase: 0};
		this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
		this.scriptNode.onaudioprocess = ({outputBuffer}) => {
			outputBuffer.getChannelData(0).forEach((e, i, data) => {
				data[i] = this.snd[this.channel.voice << 5 | this.channel.phase >>> 21 & 31];
				this.channel.phase += this.channel.freq;
			});
		};
		this.source = audioCtx.createBufferSource();
		this.gainNode = audioCtx.createGain();
		this.gainNode.gain.value = this.gain;
		this.source.connect(this.scriptNode);
		this.scriptNode.connect(this.gainNode);
		this.gainNode.connect(audioCtx.destination);
		this.source.start();
	}

	mute(flag) {
		this.gainNode.gain.value = flag ? 0 : this.gain;
	}

	update(game) {
		const reg = game.mmo;
		this.channel.voice = reg[0x17] & 1;
		this.channel.freq = Math.floor(this.rate / ((reg[0x17] + 1) * (256 - reg[0x30])));
	}
}

