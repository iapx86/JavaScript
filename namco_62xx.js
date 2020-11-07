/*
 *
 *	Namco 62XX Sound Module
 *
 */

export default class Namco62XX {
	rate;
	sampleRate;
	gain;
	cycles = 0;
	channel = [];
	rng = 0;

	source;
	biquadFilter;
	gainNode;
	scriptNode;

	constructor({clock, gain = 0.75}) {
		this.rate = Math.floor(clock / 600);
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.gain = gain;
		for (let i = 0; i < 2; i++)
			this.channel.push({data: 0, play: 0, output: 0, vol: 0, state: 0, count: 0, count1: 0, count2: 0, count3: 0, vol1: 0});
		if (!audioCtx)
			return;
		this.source = audioCtx.createBufferSource();
		this.biquadFilter = audioCtx.createBiquadFilter();
		this.biquadFilter.type = 'bandpass';
		this.biquadFilter.frequency.value = 200;
		this.biquadFilter.Q.value = 1;
		this.gainNode = audioCtx.createGain();
		this.gainNode.gain.value = gain;
		this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
		this.scriptNode.onaudioprocess = ({outputBuffer}) => this.makeSound(outputBuffer.getChannelData(0).fill(0));
		this.source.connect(this.scriptNode);
		this.scriptNode.connect(this.biquadFilter);
		this.biquadFilter.connect(this.gainNode);
		this.gainNode.connect(audioCtx.destination);
		this.source.start();
	}

	mute(flag) {
		if (!audioCtx)
			return;
		this.gainNode.gain.value = flag ? 0 : this.gain;
	}

	param(port) {
		if (port[8] === 1) {
			this.channel[0].count1 = port[9] | port[10] << 4, this.channel[0].count2 = port[11] | port[12] << 4;
			this.channel[0].count3 = port[13] | port[14] << 4, this.channel[0].vol1 = port[15], port[1] = 0xf;
		} else if (port[8] === 2) {
			this.channel[1].count1 = port[9] | port[10] << 4, this.channel[1].count2 = port[11] | port[12] << 4;
			this.channel[1].count3 = port[13] | port[14] << 4, this.channel[1].vol1 = port[15], port[2] = 0xf;
		} else if (port[8] === 3) {
			if (port[9] !== this.channel[0].data)
				this.channel[0].data = port[9], this.channel[0].play = 1, this.channel[0].state = 0, port[1] = 1;
			if (port[10] !== this.channel[1].data)
				this.channel[1].data = port[10], this.channel[1].play = 1, this.channel[1].state = 0, port[2] = 1;
		} else if (port[8] === 4) {
			const answer = port.subarray(9, 15).reduce((a, b) => a + b) * port[15];
			port[1] = answer & 0xf, port[2] = answer >> 4 & 0xf, port[3] = answer >> 8;
		}
	}

	update() {
	}

	makeSound(data) {
		data.forEach((e, i) => {
			this.channel.forEach(ch => data[i] += ch.output / 15);
			for (this.cycles += this.rate; this.cycles >= this.sampleRate; this.cycles -= this.sampleRate) {
				this.rng = this.rng << 1 | ~(this.rng >> 14 ^ this.rng >> 7) & 1;
				this.channel.forEach((ch, j) => {
					if (ch.play === 0) {
						ch.output = 0;
						return;
					}
					--ch.count;
					if (ch.state === 0)
						ch.state = 1, ch.vol = ch.vol1, ch.count = ch.count1 << 2;
					else if (ch.state === 1) {
						if (ch.count >= 0)
							ch.output = -(j ? (this.rng & 0xc00) === 0xc00 : (this.rng & 0x80) !== 0) & ch.vol;
						else
							ch.state = 2, ch.count = ch.count2 << 2;
					} else if (ch.state === 2) {
						if (ch.count >= 0)
							ch.output = 0;
						else
							ch.state = 3, ch.count = ch.count3 << 2;
					} else if (ch.count >= 0)
						ch.output = -(j ? (this.rng & 0xc00) === 0xc00 : (this.rng & 0x80) !== 0) & ch.vol;
					else if (--ch.vol === 0)
						ch.play = ch.state = 0;
					else
						ch.count = ch.count3 << 2;
				});
			}
		});
	}
}

