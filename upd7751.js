/*
 *
 *	uPD7751 Sound Module
 *
 */

import MCS48 from './mcs48.js';

export default class UPD7751 {
	base;
	rate;
	sampleRate;
	cycles = 0;
	signal = 0;
	mcu = new MCS48();
	bank = 0;

	source = audioCtx.createBufferSource();
	gainNode = audioCtx.createGain();
	scriptNode = audioCtx.createScriptProcessor(512, 1, 1);

	constructor({MCU, VOI, clock = 6000000, gain = 0.5}) {
		this.base = VOI;
		this.rate = Math.floor(clock / 15);
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.mcu.rom.set(MCU);
		this.gainNode.gain.value = gain;
		this.scriptNode.onaudioprocess = ({outputBuffer}) => this.makeSound(outputBuffer.getChannelData(0));
		this.source.connect(this.scriptNode).connect(this.gainNode).connect(audioCtx.destination);
		this.source.start();
	}

	reset(state) {
		if (state & ~this.signal & 1) {
			for (this.mcu.p2 = 0, this.mcu.reset(); ~this.mcu.p2 & 0x80;) {
				const op = this.mcu.execute();
				if (op >= 0x3c && op < 0x40)
					this.mcu.bus = this.base[this.bank | this.mcu.p7 << 12 & 0x3000 | this.mcu.p6 << 8 | this.mcu.p5 << 4 | this.mcu.p4];
			}
			this.mcu.cycles = 0;
		}
		return void(this.signal = this.signal & ~1 | state & 1);
	}

	interrupt() {}

	write(data) {
		this.bank = 0, !(data & 4) && (this.bank = 0x8000), !(data & 8) && (this.bank = 0x10000), !(data & 0x10) && (this.bank = 0x18000);
		this.bank |= data << 14 & 0x4000;
		this.mcu.p2 = data >> 1 & 0x70;
	}

	update() {}

	makeSound(data) {
		data.forEach((e, i) => {
			data[i] = this.signal & 1 ? (this.mcu.p1 - 0x80) / 127 : 0;
			if (this.signal & 1)
				for (this.mcu.cycles += Math.floor((this.cycles += this.rate) / this.sampleRate), this.cycles %= this.sampleRate; this.mcu.cycles > 0;) {
					const op = this.mcu.execute();
					if (op >= 0x3c && op < 0x40)
						this.mcu.bus = this.base[this.bank | this.mcu.p7 << 12 & 0x3000 | this.mcu.p6 << 8 | this.mcu.p5 << 4 | this.mcu.p4];
				}
		});
	}
}
