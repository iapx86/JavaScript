/*
 *
 *	DAC 8bit 2ch Sound Module
 *
 */

export default class Dac8Bit2Ch {
	constructor({resolution = 1, gain = 1}) {
		this.cycles = 0;
		this.position = 0;
		this.channel = [];
		for (let i = 0; i < 2; i++)
			this.channel.push({output: 0, position: 0, gain: 1});
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.resolution = resolution;
		this.gain = gain;
		this.tmpwheel = [new Uint8Array(resolution).fill(0x80), new Uint8Array(resolution).fill(0x80)];
		this.wheel = [];
		if (!audioCtx)
			return;
		this.source = audioCtx.createBufferSource();
		this.gainNode = audioCtx.createGain();
		this.gainNode.gain.value = gain;
		this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
		this.scriptNode.onaudioprocess = ({outputBuffer}) => this.makeSound(outputBuffer.getChannelData(0).fill(0));
		this.source.connect(this.scriptNode);
		this.scriptNode.connect(this.gainNode);
		this.gainNode.connect(audioCtx.destination);
		this.source.start();
	}

	mute(flag) {
		if (!audioCtx)
			return;
		this.gainNode.gain.value = flag ? 0 : this.gain;
	}

	write(ch, data, timer = 0) {
		this.tmpwheel[ch][timer] = data;
	}

	update() {
		if (audioCtx) {
			if (this.wheel.length >= 2) {
				this.wheel.splice(0);
				this.position = 0;
			}
			this.wheel.push(this.tmpwheel);
		}
		this.tmpwheel = [new Uint8Array(this.resolution).fill(0x80), new Uint8Array(this.resolution).fill(0x80)];
	}

	makeSound(data) {
		data.forEach((e, i) => {
			this.channel.forEach(ch => data[i] += ch.output * ch.gain);
			for (this.cycles += 60 * this.resolution; this.cycles >= this.sampleRate; this.cycles -= this.sampleRate) {
				if (this.position >= this.resolution && this.wheel.length > 0) {
					this.wheel.shift();
					this.position = 0;
				}
				if (this.wheel.length > 0) {
					this.channel.forEach((ch, j) => ch.output = (this.wheel[0][j][this.position] - 0x80) / 128);
					this.position++;
				}
			}
		});
	}
}

