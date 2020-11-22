/*
 *
 *	Namco 52XX Sound Module
 *
 */

export default class Namco52XX {
	voi;
	rate;
	sampleRate;
	cycles = 0;
	channel = {play: 0, pos: 0, end: 0};

	source = audioCtx.createBufferSource();
	gainNode = audioCtx.createGain();
	scriptNode = audioCtx.createScriptProcessor(512, 1, 1);

	constructor({VOI, clock, gain = 0.25}) {
		this.voi = VOI;
		this.rate = Math.floor(clock / 384);
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.gainNode.gain.value = gain;
		this.scriptNode.onaudioprocess = ({outputBuffer}) => this.makeSound(outputBuffer.getChannelData(0));
		this.source.connect(this.scriptNode).connect(this.gainNode).connect(audioCtx.destination);
		this.source.start();
	}

	reset() {
		this.channel.play = 0;
	}

	write(data) {
		if (data <= this.channel.play)
			return;
		this.channel.play = data;
		this.channel.pos = this.voi[data - 1] << 1 | this.voi[data + 0xf] << 9;
		this.channel.end = this.voi[data] << 1 | this.voi[data + 0x10] << 9;
	}

	update() {}

	makeSound(data) {
		data.forEach((e, i) => {
			data[i] = this.channel.play ? ((this.voi[this.channel.pos >> 1] >> (this.channel.pos << 2 & 4) & 15) - 8) / 7 : 0;
			for (this.cycles += this.rate; this.cycles >= this.sampleRate; this.cycles -= this.sampleRate)
				if (this.channel.play && ++this.channel.pos === this.channel.end)
					this.channel.play = 0;
		});
	}
}

