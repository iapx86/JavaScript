/*
 *
 *	DAC 8bit 2ch Sound Module
 *
 */

export default class Dac8Bit2Ch {
	sampleRate;
	resolution;
	tmpwheel;
	wheel = [];
	cycles = 0;
	position = 0;
	channel = [];

	source = audioCtx.createBufferSource();
	gainNode = audioCtx.createGain();
	scriptNode = audioCtx.createScriptProcessor(512, 1, 1);

	constructor({resolution = 1, gain = 1}) {
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.resolution = resolution;
		this.tmpwheel = [new Uint8Array(resolution).fill(0x80), new Uint8Array(resolution).fill(0x80)];
		for (let i = 0; i < 2; i++)
			this.channel.push({output: 0, gain: 1});
		this.gainNode.gain.value = gain;
		this.scriptNode.onaudioprocess = ({outputBuffer}) => this.makeSound(outputBuffer.getChannelData(0).fill(0));
		this.source.connect(this.scriptNode).connect(this.gainNode).connect(audioCtx.destination);
		this.source.start();
	}

	write(ch, data, timer = 0) {
		this.tmpwheel[ch][timer] = data;
	}

	update() {
		this.wheel.length >= 2 && (this.wheel.splice(0), this.position = 0), this.wheel.push(this.tmpwheel);
		this.tmpwheel = [new Uint8Array(this.resolution).fill(0x80), new Uint8Array(this.resolution).fill(0x80)];
	}

	makeSound(data) {
		data.forEach((e, i) => {
			this.channel.forEach(ch => data[i] += ch.output * ch.gain);
			for (this.cycles += 60 * this.resolution; this.cycles >= this.sampleRate; this.cycles -= this.sampleRate) {
				this.position >= this.resolution && this.wheel.length > 0 && (this.wheel.shift(), this.position = 0);
				this.wheel.length && this.channel.forEach((ch, j) => ch.output = (this.wheel[0][j][this.position] - 0x80) / 128), this.position++;
			}
		});
	}
}

