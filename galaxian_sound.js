/*
 *
 *	Galaxian Sound Module
 *
 */

export default class GalaxianSound {
	snd;
	rate;
	gain;
	output = 0;
	mute = false;
	reg17 = 0;
	reg30 = 0;
	freq = 0;
	phase = 0;

	constructor({SND, gain = 0.1}) {
		this.snd = SND;
		this.rate = Math.floor(0x10000000 * 48000 / audioCtx.sampleRate);
		this.gain = gain;
	}

	control(flag) {
		(this.mute = !flag) && this.set_reg30(0xff);
	}

	set_reg17(data) {
		this.reg17 = data & 1;
		this.freq = this.reg30 !== 0xff ? Math.floor(this.rate / ((this.reg17 + 1) * (256 - this.reg30))) : 0;
	}

	set_reg30(data) {
		this.reg30 = data;
		this.freq = this.reg30 !== 0xff ? Math.floor(this.rate / ((this.reg17 + 1) * (256 - this.reg30))) : 0;
	}

	update() {
		this.phase = this.phase + this.freq | 0;
		this.output = !this.mute ? ((this.snd[this.reg17 << 5 | this.phase >> 21 & 31] & 15) * 2 / 15 - 1) * this.gain : 0;
	}
}

