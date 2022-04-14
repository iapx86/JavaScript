/*
 *
 *	YM2151 Sound Module
 *
 */

import {YM, Channel4, Chip} from './ym.js';

export default class YM2151 {
	clock;
	gain;
	output = 0;
	addr = 0;
	reg = new Uint8Array(0x100);
	kon = new Uint8Array(8);
	status = 0;
	irq = false;
	timera = {frac: 0, count: 0};
	timerb = {frac: 0, count: 0};
	opm = new OPM();
	output0 = new Int32Array(2);

	constructor({clock, gain = 1}) {
		this.clock = clock;
		this.gain = gain;
		this.opm.Init();
	}

	write(data) {
		switch (this.addr) {
		case 8: // KON
			this.kon[data & 7] = Number((data & 0x78) !== 0);
			break;
		case 0x14: // CSM/F RESET/IRQEN/LOAD
			this.status &= ~(data >> 4 & 3), this.irq = (this.status & data >> 2 & 3) !== 0;
			data & ~this.reg[0x14] & 1 && (this.timera.count = this.reg[0x10] << 2 | this.reg[0x11] & 3);
			data & ~this.reg[0x14] & 2 && (this.timerb.count = this.reg[0x12]);
			break;
		}
		this.reg[this.addr] = data, this.status |= 0x80;
		this.opm.SetReg(this.addr, data);
	}

	execute(rate) {
		for (this.timera.frac += this.clock; this.timera.frac >= rate * 64; this.timera.frac -= rate * 64) {
			this.output0.fill(0), this.opm.Mix(this.output0, 1), this.status &= ~0x80;
			this.reg[0x14] & 1 && ++this.timera.count >= 0x400 && (this.status |= 1, this.timera.count = this.reg[0x10] << 2 | this.reg[0x11] & 3);
		}
		for (this.timerb.frac += this.clock; this.timerb.frac >= rate * 1024; this.timerb.frac -= rate * 1024)
			this.reg[0x14] & 2 && ++this.timerb.count >= 0x100 && (this.status |= 2, this.timerb.count = this.reg[0x12]);
		return this.irq = (this.status & this.reg[0x14] >> 2 & 3) !== 0;
	}

	update() {
		this.output = (this.output0[0] + this.output0[1]) / 131072 * this.gain;
	}
}

class OPM {
	static LFOENTS = 512;
	pmd = 0;
	amd = 0;
	lfo_count_ = 0;
	lfo_count_diff_ = 0;
	lfo_step_ = 0;
	lfo_count_prev_ = -1;
	lfowaveform = 0;
	noise = 0;
	noisecount = 0;
	noisedelta = 0;
	lfofreq = 0;
	status = 0;
	reg01 = 0;
	kc = new Int32Array(8);
	kf = new Int32Array(8);
	pan = new Int32Array(8);
	ch = [new Channel4, new Channel4, new Channel4, new Channel4, new Channel4, new Channel4, new Channel4, new Channel4];
	chip = new Chip;

	constructor() { this.ch.forEach(ch => { ch.SetChip(this.chip), ch.SetType(YM.OpType.typeM); }); }
	Init() { return this.Reset(), this.SetChannelMask(0), true; }
	SetChannelMask(t) { this.ch.forEach((ch, e) => ch.Mute(!!(t & 1 << e))); }

	Reset() {
		for (let t = 0; 256 > t; t++)
			this.SetReg(t, 0);
		this.SetReg(25, 128), this.status = 0, this.noise = 12345, this.noisecount = 0, this.ch.forEach(ch => ch.Reset());
	}

	ResetStatus(t) { this.status & t && (this.status &= ~t); }

	SetReg(e, i) {
		if (e >= 256)
			return;
		let s = 7 & e;
		switch (255 & e) {
		case 1:
			return 2 & i && (this.lfo_count_ = 0, this.lfo_count_prev_ = -1), void(this.reg01 = i);
		case 8:
			return this.ch[7 & i].KeyControl(i >> 3);
		case 24:
			return this.lfofreq = i, void(this.lfo_count_diff_ = (16 + (15 & this.lfofreq) << 12) / (1 << 15 - (this.lfofreq >> 4)) | 0);
		case 25:
			return void(128 & i ? (this.pmd = 127 & i) : (this.amd = 127 & i));
		case 27:
			return void(this.lfowaveform = 3 & i);
		case 32: case 33: case 34: case 35: case 36: case 37: case 38: case 39:
			return this.ch[s].SetFB(i >> 3 & 7), this.ch[s].SetAlgorithm(7 & i), void(this.pan[s] = i >> 6 & 3);
		case 40: case 41: case 42: case 43: case 44: case 45: case 46: case 47:
			return this.kc[s] = i, this.ch[s].SetKCKF(this.kc[s], this.kf[s]);
		case 48: case 49: case 50: case 51: case 52: case 53: case 54: case 55:
			return this.kf[s] = i >> 2, this.ch[s].SetKCKF(this.kc[s], this.kf[s]);
		case 56: case 57: case 58: case 59: case 60: case 61: case 62: case 63:
			return this.ch[s].SetMS(i << 4 | i >> 4);
		case 15:
			return this.noisedelta = i, void(this.noisecount = 0);
		default:
			return void(e >= 64 && this.SetParameter(e, i));
		}
	}

	SetParameter(t, e) {
		let i = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 124], s = [0, 2, 1, 3], h = s[t >> 3 & 3], a = this.ch[7 & t].op[h];
		switch (t >> 5 & 7) {
		case 2:
			return a.SetDT(e >> 4 & 7), a.SetMULTI(15 & e);
		case 3:
			return a.SetTL(127 & e, 0);
		case 4:
			return a.SetKS(e >> 6 & 3), a.SetAR(2 * (31 & e));
		case 5:
			return a.SetDR(2 * (31 & e)), a.SetAMON(0 !== (128 & e));
		case 6:
			return a.SetSR(2 * (31 & e)), a.SetDT2(e >> 6 & 3);
		case 7:
			return a.SetSL(i[e >> 4 & 15]), a.SetRR(4 * (15 & e) + 2);
		}
	}

	LFO() {
		if (3 !== this.lfowaveform) {
			let t = this.lfo_count_ >> 15 & 510;
			this.chip.SetPML((pmtable[this.lfowaveform][t] * this.pmd / 128 | 0) + 128), this.chip.SetAML(amtable[this.lfowaveform][t] * this.amd / 128 | 0);
		} else if (-131072 & (this.lfo_count_ ^ this.lfo_count_prev_)) {
			let t = 255 & (32768 * Math.random() | 0) / 17;
			this.chip.SetPML(((t - 128) * this.pmd / 128 | 0) + 128), this.chip.SetAML(t * this.amd / 128 | 0);
		}
		this.lfo_count_prev_ = this.lfo_count_, this.lfo_step_++, 0 === (7 & this.lfo_step_) && (this.lfo_count_ += this.lfo_count_diff_);
	}

	Noise() {
		this.noisecount += 2 << YM.RATIOBITS;
		if (this.noisecount >= 32 << YM.RATIOBITS) {
			let e = 32 - (31 & this.noisedelta);
			1 === e && (e = 2), this.noisecount -= e << YM.RATIOBITS, 31 === (31 & this.noisedelta) && (this.noisecount -= YM.RATIOBITS);
			this.noise = this.noise >> 1 ^ (1 & this.noise ? 33800 : 0);
		}
		return this.noise;
	}

	MixSub(t, e) {
		16384 & t && (e[this.pan[0]] = this.ch[0].Calc()), 4096 & t && (e[this.pan[1]] += this.ch[1].Calc()), 1024 & t && (e[this.pan[2]] += this.ch[2].Calc());
		256 & t && (e[this.pan[3]] += this.ch[3].Calc()), 64 & t && (e[this.pan[4]] += this.ch[4].Calc()), 16 & t && (e[this.pan[5]] += this.ch[5].Calc());
		4 & t && (e[this.pan[6]] += this.ch[6].Calc()), 1 & t && (128 & this.noisedelta ? (e[this.pan[7]] += this.ch[7].CalcN(this.Noise())) : (e[this.pan[7]] += this.ch[7].Calc()));
	}

	MixSubL(t, e) {
		16384 & t && (e[this.pan[0]] = this.ch[0].CalcL()), 4096 & t && (e[this.pan[1]] += this.ch[1].CalcL()), 1024 & t && (e[this.pan[2]] += this.ch[2].CalcL());
		256 & t && (e[this.pan[3]] += this.ch[3].CalcL()), 64 & t && (e[this.pan[4]] += this.ch[4].CalcL()), 16 & t && (e[this.pan[5]] += this.ch[5].CalcL());
		4 & t && (e[this.pan[6]] += this.ch[6].CalcL()), 1 & t && (128 & this.noisedelta ? (e[this.pan[7]] += this.ch[7].CalcLN(this.Noise())) : (e[this.pan[7]] += this.ch[7].CalcL()));
	}

	Mix(t, e) {
		let h = 0, a = 2 * e;
		for (let o = 0; 8 > o; o++)
			h = h << 2 | this.ch[o].Prepare();
		if (h & 21845) {
			2 & this.reg01 && (h &= 21845);
			let n = new Int32Array(8);
			for (let o = 0; a > o; o += 2) {
				n[1] = n[2] = n[3] = 0, this.LFO(), 43690 & h ? this.MixSubL(h, n) : this.MixSub(h, n);
				t[o] += Math.min(65535, Math.max(-65536, n[1] + n[3])), t[o + 1] += Math.min(65535, Math.max(-65536, n[2] + n[3]));
			}
		}
	}
}

const amtable = new Array(4), pmtable = new Array(4);

void function () {
	for (let t = 0; 4 > t; t++) {
		let e = 0;
		amtable[t] = new Int32Array(OPM.LFOENTS), pmtable[t] = new Int32Array(OPM.LFOENTS);
		for (let i = 0; i < OPM.LFOENTS; i++) {
			let s, h;
			switch (t) {
			case 0:
				h = ((i + 256 & 511) / 2 | 0) - 128, s = 255 - (i / 2 | 0);
				break;
			case 1:
				s = 256 > i ? 255 : 0, h = 256 > i ? 127 : -128;
				break;
			case 2:
				h = i + 128 & 511, h = 256 > h ? h - 128 : 383 - h, s = 256 > i ? 255 - i : i - 256;
				break;
			case 3:
				3 & i || (e = 255 & (32768 * Math.random() | 0) / 17), s = e, h = e - 128;
				break;
			}
			amtable[t][i] = s, pmtable[t][i] = -h - 1;
		}
	}
}();
