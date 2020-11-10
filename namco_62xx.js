/*
 *
 *	Namco 62XX Sound Module
 *
 */

import MB8840 from './mb8840.js';

export default class Namco62XX {
	rate;
	sampleRate;
	gain;
	cycles = 0;
	mcu = new MB8840();
	delta = 0;

	source;
	biquadFilter;
	gainNode;
	scriptNode;

	constructor({PRG, clock, gain = 0.75}) {
		this.rate = Math.floor(clock / 6);
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.gain = gain;
		this.mcu.rom.set(PRG);
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

	reset() {
		this.mcu.reset();
		while ((this.mcu.mask & 4) === 0)
			this.mcu.execute();
	}

	param(port) {
		if ((this.mcu.cause & 4) === 0 || !this.mcu.interrupt())
			return;
		this.mcu.cause &= ~4;
		for (let op = this.mcu.execute(); op !== 0x3c; op = this.mcu.execute())
			if (op === 3) {
				this.delta ^= this.mcu.r;
				if ((~this.mcu.r & this.delta & 0x80) !== 0)
					port[this.mcu.r >> 4 & 15] = this.mcu.r & 15;
				if ((this.delta & 0xf0) !== 0 && (this.mcu.r & 0x80) !== 0)
					this.mcu.r = this.mcu.r & ~15 | port[this.mcu.r >> 4 & 15];
				this.delta = this.mcu.r = this.mcu.r & ~0x200 | this.mcu.r << 1 & 0x200;
			}
	}

	update() {
		if (!audioCtx || audioCtx.state !== 'suspended')
			return;
		this.mcu.cycles += Math.floor((this.cycles += this.rate * Math.floor(this.sampleRate / 60)) / this.sampleRate), this.cycles %= this.sampleRate;
		while (this.mcu.cycles > 0)
			this.mcu.execute();
	}

	makeSound(data) {
		data.forEach((e, i) => {
			data[i] += ((this.mcu.o & 15) + (this.mcu.o >> 4)) / 15;
			this.mcu.cycles += Math.floor((this.cycles += this.rate) / this.sampleRate), this.cycles %= this.sampleRate;
			while (this.mcu.cycles > 0)
				this.mcu.execute();
		});
	}
}

