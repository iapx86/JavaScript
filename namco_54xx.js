/*
 *
 *	Namco 54XX Sound Module
 *
 */

import MB8840 from './mb8840.js';

class BiquadFilter {
	b0 = 0;
	b1 = 0;
	b2 = 0;
	a1 = 0;
	a2 = 0;
	x1 = 0;
	x2 = 0;
	y1 = 0;
	y2 = 0;

	bandpass(freq, Q) {
		const w0 = 2 * Math.PI * freq / audioCtx.sampleRate, alpha = Math.sin(w0) / (2 * Q), a0 = 1 + alpha;
		this.b0 = alpha / a0, this.b1 = 0, this.b2 = -alpha / a0, this.a1 = -2 * Math.cos(w0) / a0, this.a2 = (1 - alpha) / a0;
	}

	filter(x) {
		const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
		this.x2 = this.x1, this.x1 = x, this.y2 = this.y1, this.y1 = y;
		return y;
	}
}

export default class Namco54XX {
	rate;
	sampleRate;
	gain;
	cycles = 0;
	mcu = new MB8840();
	bq = [new BiquadFilter(), new BiquadFilter(), new BiquadFilter()];

	source = audioCtx.createBufferSource();
	gainNode = audioCtx.createGain();
	scriptNode = audioCtx.createScriptProcessor(512, 1, 1);

	constructor({PRG, clock, gain = 0.5}) {
		this.rate = Math.floor(clock / 6);
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.gain = gain;
		this.mcu.rom.set(PRG);
		[[200, 1], [200, 1], [2200, 1]].forEach((e, i) => this.bq[i].bandpass(...e));
		this.gainNode.gain.value = gain;
		this.scriptNode.onaudioprocess = ({outputBuffer}) => this.makeSound(outputBuffer.getChannelData(0));
		this.source.connect(this.scriptNode).connect(this.gainNode).connect(audioCtx.destination);
		this.source.start();
	}

	reset() {
		for (this.mcu.reset(); ~this.mcu.mask & 4; this.mcu.execute()) {}
	}

	write(data) {
		this.mcu.k = data >> 4, this.mcu.r = this.mcu.r & ~15 | data & 15, this.mcu.cause = this.mcu.cause & ~4 | !this.mcu.interrupt() << 2;
		for (let op = this.mcu.execute(); op !== 0x3c && (op !== 0x25 || this.mcu.cause & 4); op = this.mcu.execute())
			op === 0x25 && (this.mcu.cause &= ~4);
	}

	update() {}

	makeSound(data) {
		data.forEach((e, i) => {
			data[i] = this.bq[0].filter((this.mcu.o & 15) / 15) + this.bq[1].filter((this.mcu.o >> 4) / 15) + this.bq[2].filter((this.mcu.r >> 4 & 15) / 15);
			this.mcu.cycles += Math.floor((this.cycles += this.rate) / this.sampleRate), this.cycles %= this.sampleRate;
			for (; this.mcu.mask & 4 && this.mcu.cycles > 0; this.mcu.execute()) {}
		});
	}
}

