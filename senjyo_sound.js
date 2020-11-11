/*
 *
 *	Senjyo Sound Module
 *
 */

export default class SenjyoSound {
	snd;
	rate;
	sampleRate;
	count;
	resolution;
	gain;
	tmpwheel = [];
	wheel = [];
	cycles = 0;
	channel = {vol: 0, freq: 256, count: 256, phase: 0};

	source = audioCtx.createBufferSource();
	biquadFilter = audioCtx.createBiquadFilter();
	gainNode = audioCtx.createGain();
	scriptNode = audioCtx.createScriptProcessor(512, 1, 1);

	constructor({SND, clock, resolution = 1, gain = 0.7}) {
		this.snd = Float32Array.from(SND, e => e * 2 / 0xbf - 1);
		this.rate = Math.floor(clock / 16);
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.count = this.sampleRate - 1;
		this.resolution = resolution;
		this.gain = gain;
		for (let i = 0; i < resolution; i++)
			this.tmpwheel.push([]);
		this.biquadFilter.type = 'bandpass';
		this.biquadFilter.frequency.value = 200;
		this.biquadFilter.Q.value = 5;
		this.gainNode.gain.value = this.gain;
		this.scriptNode.onaudioprocess = ({outputBuffer}) => this.makeSound(outputBuffer.getChannelData(0));
		this.source.connect(this.scriptNode).connect(this.biquadFilter).connect(this.gainNode).connect(audioCtx.destination);
		this.source.start();
	}

	write(addr, data, timer = 0) {
		this.tmpwheel[timer].push({addr, data});
	}

	update() {
		if (this.wheel.length > this.resolution) {
			while (this.wheel.length)
				this.wheel.shift().forEach(e => this.regwrite(e));
			this.count = this.sampleRate - 1;
		}
		this.tmpwheel.forEach(e => this.wheel.push(e));
		for (let i = 0; i < this.resolution; i++)
			this.tmpwheel[i] = [];
	}

	makeSound(data) {
		const ch = this.channel;
		data.forEach((e, i) => {
			for (this.count += 60 * this.resolution; this.count >= this.sampleRate; this.count -= this.sampleRate)
				if (this.wheel.length)
					this.wheel.shift().forEach(e => this.regwrite(e));
			data[i] = this.snd[ch.phase] * ch.vol;
			for (this.cycles += this.rate; this.cycles >= this.sampleRate; this.cycles -= this.sampleRate)
				if (--ch.count <= 0)
					ch.count = ch.freq, ch.phase = ch.phase + 1 & 15;
		});
	}

	regwrite({addr, data}) {
		if (addr)
			this.channel.vol = data / 15;
		else
			this.channel.count = this.channel.freq = data;
	}
}

