/*
 *
 *	YM2203 Sound Module
 *
 */

import {YM, Channel4, Chip} from './ym.js';
import {seq} from './utils.js';

export default class YM2203 {
	clock;
	div;
	gain;
	output = 0;
	addr = 0;
	reg = new Uint8Array(0x100);
	kon = new Uint8Array(8);
	status = 0;
	irq = false;
	timera = {frac: 0, count: 0};
	timerb = {frac: 0, count: 0};
	opn = new OPN();
	output0 = new Int32Array(2);
	frac = 0;
	channel = [];
	ncount = 0;
	rng = 0xffff;
	ecount = 0;
	step = 0;

	constructor({clock, gain = 1}) {
		this.clock = clock;
		this.gain = gain;
		this.div = [6, 4];
		this.opn.Init();
		for (let i = 0; i < 3; i++)
			this.channel.push({freq: 0, count: 0, output: 0});
	}

	prescaler(val) {
		this.div = [[6, 4], [3, 2], [2, 1]][val], this.frac = 0;
	}

	read() {
		return this.reg[this.addr];
	}

	write(data) {
		switch (this.addr) {
		case 0x0d:
			this.step = 0;
			break;
		case 0x27: // MODE/RESET/ENABLE/LOAD
			this.status &= ~(data >> 4 & 3), this.irq = (this.status & data >> 2 & 3) !== 0;
			data & ~this.reg[0x27] & 1 && (this.timera.count = this.reg[0x24] << 2 | this.reg[0x25] & 3);
			data & ~this.reg[0x27] & 2 && (this.timerb.count = this.reg[0x26]);
			break;
		case 0x28: // KON
			this.kon[data & 3] = Number((data & 0xf0) !== 0);
			break;
		}
		this.reg[this.addr] = data, this.status |= 0x80;
		this.opn.SetReg(this.addr, data);
	}

	execute(rate) {
		for (this.timera.frac += this.clock; this.timera.frac >= rate * 12 * this.div[0]; this.timera.frac -= rate * 12 * this.div[0]) {
			this.output0.fill(0), this.opn.Mix(this.output0, 1), this.status &= ~0x80;
			this.reg[0x27] & 1 && ++this.timera.count >= 0x400 && (this.status |= 1, this.timera.count = this.reg[0x24] << 2 | this.reg[0x25] & 3);
		}
		for (this.timerb.frac += this.clock; this.timerb.frac >= rate * 192 * this.div[0]; this.timerb.frac -= rate * 192 * this.div[0])
			this.reg[0x27] & 2 && ++this.timerb.count >= 0x100 && (this.status |= 2, this.timerb.count = this.reg[0x26]);
		for (this.frac += this.clock; this.frac >= rate * 4 * this.div[1]; this.frac -= rate * 4 * this.div[1]) {
			const reg = this.reg, nfreq = reg[6] & 31, efreq = reg[11] | reg[12] << 8, etype = reg[13];
			this.channel.forEach((ch, i) => { ch.freq = reg[1 + i * 2] << 8 & 0xf00 | reg[i * 2], ++ch.count >= ch.freq && (ch.output = ~ch.output, ch.count = 0); });
			++this.ncount >= nfreq << 1 && (this.rng = (this.rng >> 16 ^ this.rng >> 13 ^ 1) & 1 | this.rng << 1, this.ncount = 0);
			++this.ecount >= efreq && (this.step += ((this.step < 32) | etype >> 3 & ~etype & 1) - (this.step >= 95) * 64, this.ecount = 0);
		}
		return this.irq = (this.status & this.reg[0x27] >> 2 & 3) !== 0;
	}

	update() {
		this.output = this.output0[0] / 65536 * this.gain;
		const reg = this.reg, etype = reg[13];
		const evol = (~this.step ^ ((((etype ^ etype >> 1) & this.step >> 5 ^ ~etype >> 2) & 1) - 1)) & (~etype >> 3 & this.step >> 5 & 1) - 1 & 31;
		this.channel.forEach((ch, i) => {
			this.output += (((!ch.freq | reg[7] >> i | ch.output) & (reg[7] >> i + 3 | this.rng) & 1) * 2 - 1) * vol[reg[8 + i] >> 4 & 1 ? evol : reg[8 + i] << 1 & 30 | 1] / 12 * this.gain;
		});
	}
}

class OPN {
	status = 0;
	fnum = new Int32Array(3);
	fnum3 = new Int32Array(3);
	fnum2 = new Uint8Array(6);
	ch = [new Channel4, new Channel4, new Channel4];
	chip = new Chip;

	constructor() { this.ch.forEach(ch => { ch.SetChip(this.chip), ch.SetType(YM.OpType.typeN); }); }
	Init() { return this.Reset(), this.SetChannelMask(0), true; }
	SetChannelMask(t) { this.ch.forEach((ch, e) => ch.Mute(!!(t & 1 << e))); }

	Reset() {
		for (let t = 32; 40 > t; t++)
			this.SetReg(t, 0);
		for (let t = 48; 192 > t; t++)
			this.SetReg(t, 0);
		this.status = 0, this.ch.forEach(ch => ch.Reset());
	}

	ResetStatus(t) { this.status &= ~t; }

	SetReg(e, i) {
		if (255 < e)
			return;
		let s = 3 & e;
		switch (e) {
		case 40:
			return void(3 > (3 & i) && this.ch[3 & i].KeyControl(i >> 4));
		case 160: case 161: case 162:
			return void(this.fnum[s] = i + 256 * this.fnum2[s]);
		case 164: case 165: case 166:
			return void(this.fnum2[s] = i);
		case 168: case 169: case 170:
			return void(this.fnum3[s] = i + 256 * this.fnum2[3 + s]);
		case 172: case 173: case 174:
			return void(this.fnum2[s + 3] = i);
		case 176: case 177: case 178:
			return this.ch[s].SetFB(i >> 3 & 7), this.ch[s].SetAlgorithm(7 & i);
		default:
			return 3 > s && (96 === (240 & e) && (i &= 31), this.SetParameter(e, i));
		}
	}

	SetParameter(t, e) {
		if (2 < (3 & t))
			return;
		const i = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 124], s = [0, 2, 1, 3], h = s[t >> 2 & 3], a = this.ch[t & 3].op[h];
		switch (t >> 4 & 15) {
		case 3:
			return a.SetDT(e >> 4 & 7), a.SetMULTI(15 & e);
		case 4:
			return a.SetTL(127 & e, 0);
		case 5:
			return a.SetKS(e >> 6 & 3), a.SetAR(2 * (31 & e));
		case 6:
			return a.SetDR(2 * (31 & e)), a.SetAMON(0 !== (128 & e));
		case 7:
			return a.SetSR(2 * (31 & e));
		case 8:
			return a.SetSL(i[e >> 4 & 15]), a.SetRR(4 * (15 & e) + 2);
		case 9:
			return a.SetSSGEC(e & 15);
		}
	}

	Mix(t, e) {
		this.ch[0].SetFNum(this.fnum[0]), this.ch[1].SetFNum(this.fnum[1]), this.ch[2].SetFNum(this.fnum[2]);
		let h = this.ch[2].Prepare() << 4 | this.ch[1].Prepare() << 2 | this.ch[0].Prepare();
		if (h & 21) {
			let a = 2 * e;
			for (let o = 0; a > o; o += 2) {
				let n = 0;
				h & 1 && (n = this.ch[0].Calc()), h & 4 && (n += this.ch[1].Calc()), h & 16 && (n += this.ch[2].Calc());
				n = Math.min(32767, Math.max(-32768, n)), t[o] += n, t[o + 1] += n;
			}
		}
	}
}

const vol = Float64Array.from(seq(32), i => i > 1 ? Math.pow(10, (i - 31) / 20) : 0);
