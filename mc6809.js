/*
 *
 *	MC6809 Emulator
 *
 */

import Cpu from './main.js';

export default class MC6809 extends Cpu {
	constructor(arg = null) {
		super(arg);
		this.a = 0;
		this.b = 0;
		this.dp = 0;
		this.ccr = 0; // ccr:efhinzvc
		this.x = 0;
		this.y = 0;
		this.u = 0;
		this.s = 0;
	}

	reset() {
		super.reset();
		this.ccr = 0x50;
		this.dp = 0;
		this.pc = this.read(0xfffe) << 8 | this.read(0xffff);
	}
/*
 *	fast_interrupt() {
 *		if (!super.interrupt() || (this.ccr & 0x40) !== 0)
 *			return false;
 *		this.pshs16(this.pc);
 *		this.pshs(this.ccr &= ~0x80);
 *		this.ccr |= 0x50;
 *		this.pc = this.read(0xfff6) << 8 | this.read(0xfff7);
 *		return true;
 *	}
 */
	interrupt() {
		if (!super.interrupt() || (this.ccr & 0x10) !== 0)
			return false;
		this.pshs16(this.pc);
		this.pshs16(this.u);
		this.pshs16(this.y);
		this.pshs16(this.x);
		this.pshs(this.dp);
		this.pshs(this.b);
		this.pshs(this.a);
		this.pshs(this.ccr |= 0x80);
		this.ccr |= 0x10;
		this.pc = this.read(0xfff8) << 8 | this.read(0xfff9);
		return true;
	}

	non_maskable_interrupt() {
		if (!super.interrupt())
			return false;
		this.pshs16(this.pc);
		this.pshs16(this.u);
		this.pshs16(this.y);
		this.pshs16(this.x);
		this.pshs(this.dp);
		this.pshs(this.b);
		this.pshs(this.a);
		this.pshs(this.ccr |= 0x80);
		this.ccr |= 0x50;
		this.pc = this.read(0xfffc) << 8 | this.read(0xfffd);
		return true;
	}

	_execute() {
		let v;

		switch (this.fetch()) {
		case 0x00: // NEG <n
			return this.neg(this.direct());
		case 0x03: // COM <n
			return this.com(this.direct());
		case 0x04: // LSR <n
			return this.lsr(this.direct());
		case 0x06: // ROR <n
			return this.ror(this.direct());
		case 0x07: // ASR <n
			return this.asr(this.direct());
		case 0x08: // LSL <n
			return this.lsl(this.direct());
		case 0x09: // ROL <n
			return this.rol(this.direct());
		case 0x0a: // DEC <n
			return this.dec(this.direct());
		case 0x0c: // INC <n
			return this.inc(this.direct());
		case 0x0d: // TST <n
			return this.tst(this.direct());
		case 0x0e: // JMP <n
			return void(this.pc = this.direct());
		case 0x0f: // CLR <n
			return this.clr(this.direct());
		case 0x10:
			switch (this.fetch()) {
			case 0x21: // LBRN
				return this.lbcc(false);
			case 0x22: // LBHI
				return this.lbcc(((this.ccr >>> 2 | this.ccr) & 1) === 0);
			case 0x23: // LBLS
				return this.lbcc(((this.ccr >>> 2 | this.ccr) & 1) !== 0);
			case 0x24: // LBHS(LBCC)
				return this.lbcc((this.ccr & 1) === 0);
			case 0x25: // LBLO(LBCS)
				return this.lbcc((this.ccr & 1) !== 0);
			case 0x26: // LBNE
				return this.lbcc((this.ccr & 4) === 0);
			case 0x27: // LBEQ
				return this.lbcc((this.ccr & 4) !== 0);
			case 0x28: // LBVC
				return this.lbcc((this.ccr & 2) === 0);
			case 0x29: // LBVS
				return this.lbcc((this.ccr & 2) !== 0);
			case 0x2a: // LBPL
				return this.lbcc((this.ccr & 8) === 0);
			case 0x2b: // LBMI
				return this.lbcc((this.ccr & 8) !== 0);
			case 0x2c: // LBGE
				return this.lbcc(((this.ccr >>> 2 ^ this.ccr) & 2) === 0);
			case 0x2d: // LBLT
				return this.lbcc(((this.ccr >>> 2 ^ this.ccr) & 2) !== 0);
			case 0x2e: // LBGT
				return this.lbcc(((this.ccr >>> 2 ^ this.ccr | this.ccr >>> 1) & 2) === 0);
			case 0x2f: // LBLE
				return this.lbcc(((this.ccr >>> 2 ^ this.ccr | this.ccr >>> 1) & 2) !== 0);
			case 0x3f: // SWI2
				this.pshs16(this.pc);
				this.pshs16(this.u);
				this.pshs16(this.y);
				this.pshs16(this.x);
				this.pshs(this.dp);
				this.pshs(this.b);
				this.pshs(this.a);
				this.pshs(this.ccr |= 0x80);
				this.pc = this.read(0xfff4) << 8 | this.read(0xfff5);
				return;
			case 0x83: // CMPD #nn
				return this.cmp16(this.a << 8 | this.b, null);
			case 0x8c: // CMPY #nn
				return this.cmp16(this.y, null);
			case 0x8e: // LDY #nn
				return void(this.y = this.ld16(null));
			case 0x93: // CMPD <n
				return this.cmp16(this.a << 8 | this.b, this.direct());
			case 0x9c: // CMPY <n
				return this.cmp16(this.y, this.direct());
			case 0x9e: // LDY <n
				return void(this.y = this.ld16(this.direct()));
			case 0x9f: // STY <n
				return this.st16(this.y, this.direct());
			case 0xa3: // CMPD ,r
				return this.cmp16(this.a << 8 | this.b, this.index());
			case 0xac: // CMPY ,r
				return this.cmp16(this.y, this.index());
			case 0xae: // LDY ,r
				return void(this.y = this.ld16(this.index()));
			case 0xaf: // STY ,r
				return this.st16(this.y, this.index());
			case 0xb3: // CMPD >nn
				return this.cmp16(this.a << 8 | this.b, this.extend());
			case 0xbc: // CMPY >nn
				return this.cmp16(this.y, this.extend());
			case 0xbe: // LDY >nn
				return void(this.y = this.ld16(this.extend()));
			case 0xbf: // STY >nn
				return this.st16(this.y, this.extend());
			case 0xce: // LDS #nn
				return void(this.s = this.ld16(null));
			case 0xde: // LDS <n
				return void(this.s = this.ld16(this.direct()));
			case 0xdf: // STS <n
				return this.st16(this.s, this.direct());
			case 0xee: // LDS ,r
				return void(this.s = this.ld16(this.index()));
			case 0xef: // STS ,r
				return this.st16(this.s, this.index());
			case 0xfe: // LDS >nn
				return void(this.s = this.ld16(this.extend()));
			case 0xff: // STS >nn
				return this.st16(this.s, this.extend());
			default:
				this.undefsize = 2;
				if (this.undef)
					this.undef(this.arg);
				return;
			}
		case 0x11:
			switch (this.fetch()) {
			case 0x3f: // SWI3
				this.pshs16(this.pc);
				this.pshs16(this.u);
				this.pshs16(this.y);
				this.pshs16(this.x);
				this.pshs(this.dp);
				this.pshs(this.b);
				this.pshs(this.a);
				this.pshs(this.ccr |= 0x80);
				this.pc = this.read(0xfff2) << 8 | this.read(0xfff3);
				return;
			case 0x83: // CMPU #nn
				return this.cmp16(this.u, null);
			case 0x8c: // CMPS #nn
				return this.cmp16(this.s, null);
			case 0x93: // CMPU <n
				return this.cmp16(this.u, this.direct());
			case 0x9c: // CMPS <n
				return this.cmp16(this.s, this.direct());
			case 0xa3: // CMPU ,r
				return this.cmp16(this.u, this.index());
			case 0xac: // CMPS ,r
				return this.cmp16(this.s, this.index());
			case 0xb3: // CMPU >nn
				return this.cmp16(this.u, this.extend());
			case 0xbc: // CMPS >nn
				return this.cmp16(this.s, this.extend());
			default:
				this.undefsize = 2;
				if (this.undef)
					this.undef(this.arg);
				return;
			}
		case 0x12: // NOP
			return;
		case 0x13: // SYNC
			return this.suspend();
		case 0x16: // LBRA
			return this.lbcc(true);
		case 0x17: // LBSR
			return this.lbsr();
		case 0x19: // DAA
			this.a = (v = MC6809.aDaa[this.ccr >>> 4 & 2 | this.ccr & 1][this.a]) & 0xff;
			this.ccr = this.ccr & ~0x0f | v >>> 8;
			return;
		case 0x1a: // ORCC
			return void(this.ccr |= this.fetch());
		case 0x1c: // ANDCC
			return void(this.ccr &= this.fetch());
		case 0x1d: // SEX
			if ((this.b & 0x80) !== 0) {
				this.a = 0xff;
				this.ccr = this.ccr & ~4 | 8;
			}
			else {
				this.a = 0;
				this.ccr = this.ccr & ~8 | 4;
			}
			return;
		case 0x1e: // EXG
			switch (this.fetch()) {
			case 0x00: // EXG D,D
			case 0x11: // EXG X,X
			case 0x22: // EXG Y,Y
			case 0x33: // EXG U,U
			case 0x44: // EXG S,S
			case 0x55: // EXG PC,PC
			case 0x88: // EXG A,A
			case 0x99: // EXG B,B
			case 0xaa: // EXG CCR,CCR
			case 0xbb: // EXG DP,DP
				return;
			case 0x01: // EXG D,X
			case 0x10: // EXG X,D
				return void([this.a, this.b, this.x] = [this.x >>> 8, this.x & 0xff, this.a << 8 | this.b]);
			case 0x02: // EXG D,Y
			case 0x20: // EXG Y,D
				return void([this.a, this.b, this.y] = [this.y >>> 8, this.y & 0xff, this.a << 8 | this.b]);
			case 0x03: // EXG D,U
			case 0x30: // EXG U,D
				return void([this.a, this.b, this.u] = [this.u >>> 8, this.u & 0xff, this.a << 8 | this.b]);
			case 0x04: // EXG D,S
			case 0x40: // EXG S,D
				return void([this.a, this.b, this.s] = [this.s >>> 8, this.s & 0xff, this.a << 8 | this.b]);
			case 0x05: // EXG D,PC
			case 0x50: // EXG PC,D
				return void([this.a, this.b, this.pc] = [this.pc >>> 8, this.pc & 0xff, this.a << 8 | this.b]);
			case 0x12: // EXG X,Y
			case 0x21: // EXG Y,X
				return void([this.x, this.y] = [this.y, this.x]);
			case 0x13: // EXG X,U
			case 0x31: // EXG U,X
				return void([this.x, this.u] = [this.u, this.x]);
			case 0x14: // EXG X,S
			case 0x41: // EXG S,X
				return void([this.x, this.s] = [this.s, this.x]);
			case 0x15: // EXG X,PC
			case 0x51: // EXG PC,X
				return void([this.x, this.pc] = [this.pc, this.x]);
			case 0x23: // EXG Y,U
			case 0x32: // EXG U,Y
				return void([this.y, this.u] = [this.u, this.y]);
			case 0x24: // EXG Y,S
			case 0x42: // EXG S,Y
				return void([this.y, this.s] = [this.s, this.y]);
			case 0x25: // EXG Y,PC
			case 0x52: // EXG PC,Y
				return void([this.y, this.pc] = [this.pc, this.y]);
			case 0x34: // EXG U,S
			case 0x43: // EXG S,U
				return void([this.u, this.s] = [this.s, this.u]);
			case 0x35: // EXG U,PC
			case 0x53: // EXG PC,U
				return void([this.u, this.pc] = [this.pc, this.u]);
			case 0x45: // EXG S,PC
			case 0x54: // EXG PC,S
				return void([this.s, this.pc] = [this.pc, this.s]);
			case 0x89: // EXG A,B
			case 0x98: // EXG B,A
				return void([this.a, this.b] = [this.b, this.a]);
			case 0x8a: // EXG A,CCR
			case 0xa8: // EXG CCR,A
				return void([this.a, this.ccr] = [this.ccr, this.a]);
			case 0x8b: // EXG A,DP
			case 0xb8: // EXG DP,A
				return void([this.a, this.dp] = [this.dp, this.a]);
			case 0x9a: // EXG B,CCR
			case 0xa9: // EXG CCR,B
				return void([this.b, this.ccr] = [this.ccr, this.b]);
			case 0x9b: // EXG B,DP
			case 0xb9: // EXG DP,B
				return void([this.b, this.dp] = [this.dp, this.b]);
			case 0xab: // EXG CCR,DP
			case 0xba: // EXG DP,CCR
				return void([this.ccr, this.dp] = [this.dp, this.ccr]);
			default:
				this.undefsize = 2;
				if (this.undef)
					this.undef(this.arg);
				return;
			}
		case 0x1f: // TFR
			switch (this.fetch()) {
			case 0x00: // TFR D,D
			case 0x11: // TFR X,X
			case 0x22: // TFR Y,Y
			case 0x33: // TFR U,U
			case 0x44: // TFR S,S
			case 0x55: // TFR PC,PC
			case 0x88: // TFR A,A
			case 0x99: // TFR B,B
			case 0xaa: // TFR CCR,CCR
			case 0xbb: // TFR DP,DP
				return;
			case 0x01: // TFR D,X
				return void(this.x = this.a << 8 | this.b);
			case 0x02: // TFR D,Y
				return void(this.y = this.a << 8 | this.b);
			case 0x03: // TFR D,U
				return void(this.u = this.a << 8 | this.b);
			case 0x04: // TFR D,S
				return void(this.s = this.a << 8 | this.b);
			case 0x05: // TFR D,PC
				return void(this.pc = this.a << 8 | this.b);
			case 0x10: // TFR X,D
				return void([this.a, this.b] = [this.x >>> 8, this.x & 0xff]);
			case 0x12: // TFR X,Y
				return void(this.y = this.x);
			case 0x13: // TFR X,U
				return void(this.u = this.x);
			case 0x14: // TFR X,S
				return void(this.s = this.x);
			case 0x15: // TFR X,PC
				return void(this.pc = this.x);
			case 0x20: // TFR Y,D
				return void([this.a, this.b] = [this.y >>> 8, this.y & 0xff]);
			case 0x21: // TFR Y,X
				return void(this.x = this.y);
			case 0x23: // TFR Y,U
				return void(this.u = this.y);
			case 0x24: // TFR Y,S
				return void(this.s = this.y);
			case 0x25: // TFR Y,PC
				return void(this.pc = this.y);
			case 0x30: // TFR U,D
				return void([this.a, this.b] = [this.u >>> 8, this.u & 0xff]);
			case 0x31: // TFR U,X
				return void(this.x = this.u);
			case 0x32: // TFR U,Y
				return void(this.y = this.u);
			case 0x34: // TFR U,S
				return void(this.s = this.u);
			case 0x35: // TFR U,PC
				return void(this.pc = this.u);
			case 0x40: // TFR S,D
				return void([this.a, this.b] = [this.s >>> 8, this.s & 0xff]);
			case 0x41: // TFR S,X
				return void(this.x = this.s);
			case 0x42: // TFR S,Y
				return void(this.y = this.s);
			case 0x43: // TFR S,U
				return void(this.u = this.s);
			case 0x45: // TFR S,PC
				return void(this.pc = this.s);
			case 0x50: // TFR PC,D
				return void([this.a, this.b] = [this.pc >>> 8, this.pc & 0xff]);
			case 0x51: // TFR PC,X
				return void(this.x = this.pc);
			case 0x52: // TFR PC,Y
				return void(this.y = this.pc);
			case 0x53: // TFR PC,U
				return void(this.u = this.pc);
			case 0x54: // TFR PC,S
				return void(this.s = this.pc);
			case 0x89: // TFR A,B
				return void(this.b = this.a);
			case 0x8a: // TFR A,CCR
				return void(this.ccr = this.a);
			case 0x8b: // TFR A,DP
				return void(this.dp = this.a);
			case 0x98: // TFR B,A
				return void(this.a = this.b);
			case 0x9a: // TFR B,CCR
				return void(this.ccr = this.b);
			case 0x9b: // TFR B,DP
				return void(this.dp = this.b);
			case 0xa8: // TFR CCR,A
				return void(this.a = this.ccr);
			case 0xa9: // TFR CCR,B
				return void(this.b = this.ccr);
			case 0xab: // TFR CCR,DP
				return void(this.dp = this.ccr);
			case 0xb8: // TFR DP,A
				return void(this.a = this.dp);
			case 0xb9: // TFR DP,B
				return void(this.b = this.dp);
			case 0xba: // TFR DP,CCR
				return void(this.ccr = this.dp);
			default:
				this.undefsize = 2;
				if (this.undef)
					this.undef(this.arg);
				return;
			}
		case 0x20: // BRA
			return this.bcc(true);
		case 0x21: // BRN
			return this.bcc(false);
		case 0x22: // BHI
			return this.bcc(((this.ccr >>> 2 | this.ccr) & 1) === 0);
		case 0x23: // BLS
			return this.bcc(((this.ccr >>> 2 | this.ccr) & 1) !== 0);
		case 0x24: // BHS(BCC)
			return this.bcc((this.ccr & 1) === 0);
		case 0x25: // BLO(BCS)
			return this.bcc((this.ccr & 1) !== 0);
		case 0x26: // BNE
			return this.bcc((this.ccr & 4) === 0);
		case 0x27: // BEQ
			return this.bcc((this.ccr & 4) !== 0);
		case 0x28: // BVC
			return this.bcc((this.ccr & 2) === 0);
		case 0x29: // BVS
			return this.bcc((this.ccr & 2) !== 0);
		case 0x2a: // BPL
			return this.bcc((this.ccr & 8) === 0);
		case 0x2b: // BMI
			return this.bcc((this.ccr & 8) !== 0);
		case 0x2c: // BGE
			return this.bcc(((this.ccr >>> 2 ^ this.ccr) & 2) === 0);
		case 0x2d: // BLT
			return this.bcc(((this.ccr >>> 2 ^ this.ccr) & 2) !== 0);
		case 0x2e: // BGT
			return this.bcc(((this.ccr >>> 2 ^ this.ccr | this.ccr >>> 1) & 2) === 0);
		case 0x2f: // BLE
			return this.bcc(((this.ccr >>> 2 ^ this.ccr | this.ccr >>> 1) & 2) !== 0);
		case 0x30: // LEAX
			return void(this.ccr = this.ccr & ~4 | !(this.x = this.index()) << 2);
		case 0x31: // LEAY
			return void(this.ccr = this.ccr & ~4 | !(this.y = this.index()) << 2);
		case 0x32: // LEAS
			return void(this.s = this.index());
		case 0x33: // LEAU
			return void(this.u = this.index());
		case 0x34: // PSHS
			if (((v = this.fetch()) & 0x80) !== 0)
				this.pshs16(this.pc);
			if ((v & 0x40) !== 0)
				this.pshs16(this.u);
			if ((v & 0x20) !== 0)
				this.pshs16(this.y);
			if ((v & 0x10) !== 0)
				this.pshs16(this.x);
			if ((v & 8) !== 0)
				this.pshs(this.dp);
			if ((v & 4) !== 0)
				this.pshs(this.b);
			if ((v & 2) !== 0)
				this.pshs(this.a);
			if ((v & 1) !== 0)
				this.pshs(this.ccr);
			return;
		case 0x35: // PULS
			if (((v = this.fetch()) & 1) !== 0)
				this.ccr = this.puls();
			if ((v & 2) !== 0)
				this.a = this.puls();
			if ((v & 4) !== 0)
				this.b = this.puls();
			if ((v & 8) !== 0)
				this.dp = this.puls();
			if ((v & 0x10) !== 0)
				this.x = this.puls16();
			if ((v & 0x20) !== 0)
				this.y = this.puls16();
			if ((v & 0x40) !== 0)
				this.u = this.puls16();
			if ((v & 0x80) !== 0)
				this.pc = this.puls16();
			return;
		case 0x36: // PSHU
			if (((v = this.fetch()) & 0x80) !== 0)
				this.pshu16(this.pc);
			if ((v & 0x40) !== 0)
				this.pshu16(this.s);
			if ((v & 0x20) !== 0)
				this.pshu16(this.y);
			if ((v & 0x10) !== 0)
				this.pshu16(this.x);
			if ((v & 8) !== 0)
				this.pshu(this.dp);
			if ((v & 4) !== 0)
				this.pshu(this.b);
			if ((v & 2) !== 0)
				this.pshu(this.a);
			if ((v & 1) !== 0)
				this.pshu(this.ccr);
			return;
		case 0x37: // PULU
			if (((v = this.fetch()) & 1) !== 0)
				this.ccr = this.pulu();
			if ((v & 2) !== 0)
				this.a = this.pulu();
			if ((v & 4) !== 0)
				this.b = this.pulu();
			if ((v & 8) !== 0)
				this.dp = this.pulu();
			if ((v & 0x10) !== 0)
				this.x = this.pulu16();
			if ((v & 0x20) !== 0)
				this.y = this.pulu16();
			if ((v & 0x40) !== 0)
				this.s = this.pulu16();
			if ((v & 0x80) !== 0)
				this.pc = this.pulu16();
			return;
		case 0x39: // RTS
			return void(this.pc = this.puls16());
		case 0x3a: // ABX
			return void(this.x = this.x + this.b & 0xffff);
		case 0x3b: // RTI
			if (((this.ccr = this.puls()) & 0x80) !== 0) {
				this.a = this.puls();
				this.b = this.puls();
				this.dp = this.puls();
				this.x = this.puls16();
				this.y = this.puls16();
				this.u = this.puls16();
			}
			this.pc = this.puls16();
			return;
		case 0x3c: // CWAI
			this.ccr &= this.fetch();
			this.suspend();
			return;
		case 0x3d: // MUL
			this.a = (v = this.a * this.b) >>> 8;
			this.b = v & 0xff;
			this.ccr = this.ccr & ~5 | !v << 2 | v >>> 7 & 1;
			return;
		case 0x3f: // SWI
			this.pshs16(this.pc);
			this.pshs16(this.u);
			this.pshs16(this.y);
			this.pshs16(this.x);
			this.pshs(this.dp);
			this.pshs(this.b);
			this.pshs(this.a);
			this.pshs(this.ccr |= 0x80);
			this.ccr |= 0x50;
			this.pc = this.read(0xfffa) << 8 | this.read(0xfffb);
			return;
		case 0x40: // NEGA
			return void(this.a = this.nega(this.a));
		case 0x43: // COMA
			return void(this.a = this.coma(this.a));
		case 0x44: // LSRA
			return void(this.a = this.lsra(this.a));
		case 0x46: // RORA
			return void(this.a = this.rora(this.a));
		case 0x47: // ASRA
			return void(this.a = this.asra(this.a));
		case 0x48: // LSLA
			return void(this.a = this.lsla(this.a));
		case 0x49: // ROLA
			return void(this.a = this.rola(this.a));
		case 0x4a: // DECA
			return void(this.a = this.deca(this.a));
		case 0x4c: // INCA
			return void(this.a = this.inca(this.a));
		case 0x4d: // TSTA
			return this.tsta(this.a);
		case 0x4f: // CLRA
			return void(this.a = this.clra());
		case 0x50: // NEGB
			return void(this.b = this.nega(this.b));
		case 0x53: // COMB
			return void(this.b = this.coma(this.b));
		case 0x54: // LSRB
			return void(this.b = this.lsra(this.b));
		case 0x56: // RORB
			return void(this.b = this.rora(this.b));
		case 0x57: // ASRB
			return void(this.b = this.asra(this.b));
		case 0x58: // LSLB
			return void(this.b = this.lsla(this.b));
		case 0x59: // ROLB
			return void(this.b = this.rola(this.b));
		case 0x5a: // DECB
			return void(this.b = this.deca(this.b));
		case 0x5c: // INCB
			return void(this.b = this.inca(this.b));
		case 0x5d: // TSTB
			return this.tsta(this.b);
		case 0x5f: // CLRB
			return void(this.b = this.clra());
		case 0x60: // NEG ,r
			return this.neg(this.index());
		case 0x63: // COM ,r
			return this.com(this.index());
		case 0x64: // LSR ,r
			return this.lsr(this.index());
		case 0x66: // ROR ,r
			return this.ror(this.index());
		case 0x67: // ASR ,r
			return this.asr(this.index());
		case 0x68: // LSL ,r
			return this.lsl(this.index());
		case 0x69: // ROL ,r
			return this.rol(this.index());
		case 0x6a: // DEC ,r
			return this.dec(this.index());
		case 0x6c: // INC ,r
			return this.inc(this.index());
		case 0x6d: // TST ,r
			return this.tst(this.index());
		case 0x6e: // JMP ,r
			return void(this.pc = this.index());
		case 0x6f: // CLR ,r
			return this.clr(this.index());
		case 0x70: // NEG >nn
			return this.neg(this.extend());
		case 0x73: // COM >nn
			return this.com(this.extend());
		case 0x74: // LSR >nn
			return this.lsr(this.extend());
		case 0x76: // ROR >nn
			return this.ror(this.extend());
		case 0x77: // ASR >nn
			return this.asr(this.extend());
		case 0x78: // LSL >nn
			return this.lsl(this.extend());
		case 0x79: // ROL >nn
			return this.rol(this.extend());
		case 0x7a: // DEC >nn
			return this.dec(this.extend());
		case 0x7c: // INC >nn
			return this.inc(this.extend());
		case 0x7d: // TST >nn
			return this.tst(this.extend());
		case 0x7e: // JMP >nn
			return void(this.pc = this.extend());
		case 0x7f: // CLR >nn
			return this.clr(this.extend());
		case 0x80: // SUBA #n
			return void(this.a = this.sub(this.a, null));
		case 0x81: // CMPA #n
			return this.cmp(this.a, null);
		case 0x82: // SBCA #n
			return void(this.a = this.sbc(this.a, null));
		case 0x83: // SUBD #nn
			return this.subd(null);
		case 0x84: // ANDA #n
			return void(this.a = this.and(this.a, null));
		case 0x85: // BITA #n
			return this.bit(this.a, null);
		case 0x86: // LDA #n
			return void(this.a = this.ld(null));
		case 0x88: // EORA #n
			return void(this.a = this.eor(this.a, null));
		case 0x89: // ADCA #n
			return void(this.a = this.adc(this.a, null));
		case 0x8a: // ORA #n
			return void(this.a = this.or(this.a, null));
		case 0x8b: // ADDA #n
			return void(this.a = this.add(this.a, null));
		case 0x8c: // CMPX #nn
			return this.cmp16(this.x, null);
		case 0x8d: // BSR
			return this.bsr();
		case 0x8e: // LDX #nn
			return void(this.x = this.ld16(null));
		case 0x90: // SUBA <n
			return void(this.a = this.sub(this.a, this.direct()));
		case 0x91: // CMPA <n
			return this.cmp(this.a, this.direct());
		case 0x92: // SBCA <n
			return void(this.a = this.sbc(this.a, this.direct()));
		case 0x93: // SUBD <n
			return this.subd(this.direct());
		case 0x94: // ANDA <n
			return void(this.a = this.and(this.a, this.direct()));
		case 0x95: // BITA <n
			return this.bit(this.a, this.direct());
		case 0x96: // LDA <n
			return void(this.a = this.ld(this.direct()));
		case 0x97: // STA <n
			return this.st(this.a, this.direct());
		case 0x98: // EORA <n
			return void(this.a = this.eor(this.a, this.direct()));
		case 0x99: // ADCA <n
			return void(this.a = this.adc(this.a, this.direct()));
		case 0x9a: // ORA <n
			return void(this.a = this.or(this.a, this.direct()));
		case 0x9b: // ADDA <n
			return void(this.a = this.add(this.a, this.direct()));
		case 0x9c: // CMPX <n
			return this.cmp16(this.x, this.direct());
		case 0x9d: // JSR <n
			return this.jsr(this.direct());
		case 0x9e: // LDX <n
			return void(this.x = this.ld16(this.direct()));
		case 0x9f: // STX <n
			return this.st16(this.x, this.direct());
		case 0xa0: // SUBA ,r
			return void(this.a = this.sub(this.a, this.index()));
		case 0xa1: // CMPA ,r
			return this.cmp(this.a, this.index());
		case 0xa2: // SBCA ,r
			return void(this.a = this.sbc(this.a, this.index()));
		case 0xa3: // SUBD ,r
			return this.subd(this.index());
		case 0xa4: // ANDA ,r
			return void(this.a = this.and(this.a, this.index()));
		case 0xa5: // BITA ,r
			return this.bit(this.a, this.index());
		case 0xa6: // LDA ,r
			return void(this.a = this.ld(this.index()));
		case 0xa7: // STA ,r
			return this.st(this.a, this.index());
		case 0xa8: // EORA ,r
			return void(this.a = this.eor(this.a, this.index()));
		case 0xa9: // ADCA ,r
			return void(this.a = this.adc(this.a, this.index()));
		case 0xaa: // ORA ,r
			return void(this.a = this.or(this.a, this.index()));
		case 0xab: // ADDA ,r
			return void(this.a = this.add(this.a, this.index()));
		case 0xac: // CMPX ,r
			return this.cmp16(this.x, this.index());
		case 0xad: // JSR ,r
			return this.jsr(this.index());
		case 0xae: // LDX ,r
			return void(this.x = this.ld16(this.index()));
		case 0xaf: // STX ,r
			return this.st16(this.x, this.index());
		case 0xb0: // SUBA >nn
			return void(this.a = this.sub(this.a, this.extend()));
		case 0xb1: // CMPA >nn
			return this.cmp(this.a, this.extend());
		case 0xb2: // SBCA >nn
			return void(this.a = this.sbc(this.a, this.extend()));
		case 0xb3: // SUBD >nn
			return this.subd(this.extend());
		case 0xb4: // ANDA >nn
			return void(this.a = this.and(this.a, this.extend()));
		case 0xb5: // BITA >nn
			return this.bit(this.a, this.extend());
		case 0xb6: // LDA >nn
			return void(this.a = this.ld(this.extend()));
		case 0xb7: // STA >nn
			return this.st(this.a, this.extend());
		case 0xb8: // EORA >nn
			return void(this.a = this.eor(this.a, this.extend()));
		case 0xb9: // ADCA >nn
			return void(this.a = this.adc(this.a, this.extend()));
		case 0xba: // ORA >nn
			return void(this.a = this.or(this.a, this.extend()));
		case 0xbb: // ADDA >nn
			return void(this.a = this.add(this.a, this.extend()));
		case 0xbc: // CMPX >nn
			return this.cmp16(this.x, this.extend());
		case 0xbd: // JSR >nn
			return this.jsr(this.extend());
		case 0xbe: // LDX >nn
			return void(this.x = this.ld16(this.extend()));
		case 0xbf: // STX >nn
			return this.st16(this.x, this.extend());
		case 0xc0: // SUBB #n
			return void(this.b = this.sub(this.b, null));
		case 0xc1: // CMPB #n
			return this.cmp(this.b, null);
		case 0xc2: // SBCB #n
			return void(this.b = this.sbc(this.b, null));
		case 0xc3: // ADDD #nn
			return this.addd(null);
		case 0xc4: // ANDB #n
			return void(this.b = this.and(this.b, null));
		case 0xc5: // BITB #n
			return this.bit(this.b, null);
		case 0xc6: // LDB #n
			return void(this.b = this.ld(null));
		case 0xc8: // EORB #n
			return void(this.b = this.eor(this.b, null));
		case 0xc9: // ADCB #n
			return void(this.b = this.adc(this.b, null));
		case 0xca: // ORB #n
			return void(this.b = this.or(this.b, null));
		case 0xcb: // ADDB #n
			return void(this.b = this.add(this.b, null));
		case 0xcc: // LDD #nn
			return this.ldd(null);
		case 0xce: // LDU #nn
			return void(this.u = this.ld16(null));
		case 0xd0: // SUBB <n
			return void(this.b = this.sub(this.b, this.direct()));
		case 0xd1: // CMPB <n
			return this.cmp(this.b, this.direct());
		case 0xd2: // SBCB <n
			return void(this.b = this.sbc(this.b, this.direct()));
		case 0xd3: // ADDD <n
			return this.addd(this.direct());
		case 0xd4: // ANDB <n
			return void(this.b = this.and(this.b, this.direct()));
		case 0xd5: // BITB <n
			return this.bit(this.b, this.direct());
		case 0xd6: // LDB <n
			return void(this.b = this.ld(this.direct()));
		case 0xd7: // STB <n
			return this.st(this.b, this.direct());
		case 0xd8: // EORB <n
			return void(this.b = this.eor(this.b, this.direct()));
		case 0xd9: // ADCB <n
			return void(this.b = this.adc(this.b, this.direct()));
		case 0xda: // ORB <n
			return void(this.b = this.or(this.b, this.direct()));
		case 0xdb: // ADDB <n
			return void(this.b = this.add(this.b, this.direct()));
		case 0xdc: // LDD <n
			return this.ldd(this.direct());
		case 0xdd: // STD <n
			return this.std(this.direct());
		case 0xde: // LDU <n
			return void(this.u = this.ld16(this.direct()));
		case 0xdf: // STU <n
			return this.st16(this.u, this.direct());
		case 0xe0: // SUBB ,r
			return void(this.b = this.sub(this.b, this.index()));
		case 0xe1: // CMPB ,r
			return this.cmp(this.b, this.index());
		case 0xe2: // SBCB ,r
			return void(this.b = this.sbc(this.b, this.index()));
		case 0xe3: // ADDD ,r
			return this.addd(this.index());
		case 0xe4: // ANDB ,r
			return void(this.b = this.and(this.b, this.index()));
		case 0xe5: // BITB ,r
			return this.bit(this.b, this.index());
		case 0xe6: // LDB ,r
			return void(this.b = this.ld(this.index()));
		case 0xe7: // STB ,r
			return this.st(this.b, this.index());
		case 0xe8: // EORB ,r
			return void(this.b = this.eor(this.b, this.index()));
		case 0xe9: // ADCB ,r
			return void(this.b = this.adc(this.b, this.index()));
		case 0xea: // ORB ,r
			return void(this.b = this.or(this.b, this.index()));
		case 0xeb: // ADDB ,r
			return void(this.b = this.add(this.b, this.index()));
		case 0xec: // LDD ,r
			return this.ldd(this.index());
		case 0xed: // STD ,r
			return this.std(this.index());
		case 0xee: // LDU ,r
			return void(this.u = this.ld16(this.index()));
		case 0xef: // STU ,r
			return this.st16(this.u, this.index());
		case 0xf0: // SUBB >nn
			return void(this.b = this.sub(this.b, this.extend()));
		case 0xf1: // CMPB >nn
			return this.cmp(this.b, this.extend());
		case 0xf2: // SBCB >nn
			return void(this.b = this.sbc(this.b, this.extend()));
		case 0xf3: // ADDD >nn
			return this.addd(this.extend());
		case 0xf4: // ANDB >nn
			return void(this.b = this.and(this.b, this.extend()));
		case 0xf5: // BITB >nn
			return this.bit(this.b, this.extend());
		case 0xf6: // LDB >nn
			return void(this.b = this.ld(this.extend()));
		case 0xf7: // STB >nn
			return this.st(this.b, this.extend());
		case 0xf8: // EORB >nn
			return void(this.b = this.eor(this.b, this.extend()));
		case 0xf9: // ADCB >nn
			return void(this.b = this.adc(this.b, this.extend()));
		case 0xfa: // ORB >nn
			return void(this.b = this.or(this.b, this.extend()));
		case 0xfb: // ADDB >nn
			return void(this.b = this.add(this.b, this.extend()));
		case 0xfc: // LDD >nn
			return this.ldd(this.extend());
		case 0xfd: // STD >nn
			return this.std(this.extend());
		case 0xfe: // LDU >nn
			return void(this.u = this.ld16(this.extend()));
		case 0xff: // STU >nn
			return this.st16(this.u, this.extend());
		default:
			this.undefsize = 1;
			if (this.undef)
				this.undef(this.arg);
			return;
		}
	}

	index() {
		let v;

		switch (this.fetch()) {
		case 0x00: // $0,X
			return this.x;
		case 0x01: // $1,X
			return this.x + 1 & 0xffff;
		case 0x02: // $2,X
			return this.x + 2 & 0xffff;
		case 0x03: // $3,X
			return this.x + 3 & 0xffff;
		case 0x04: // $4,X
			return this.x + 4 & 0xffff;
		case 0x05: // $5,X
			return this.x + 5 & 0xffff;
		case 0x06: // $6,X
			return this.x + 6 & 0xffff;
		case 0x07: // $7,X
			return this.x + 7 & 0xffff;
		case 0x08: // $8,X
			return this.x + 8 & 0xffff;
		case 0x09: // $9,X
			return this.x + 9 & 0xffff;
		case 0x0a: // $a,X
			return this.x + 0x0a & 0xffff;
		case 0x0b: // $b,X
			return this.x + 0x0b & 0xffff;
		case 0x0c: // $c,X
			return this.x + 0x0c & 0xffff;
		case 0x0d: // $d,X
			return this.x + 0x0d & 0xffff;
		case 0x0e: // $e,X
			return this.x + 0x0e & 0xffff;
		case 0x0f: // $f,X
			return this.x + 0x0f & 0xffff;
		case 0x10: // -$10,X
			return this.x - 0x10 & 0xffff;
		case 0x11: // -$f,X
			return this.x - 0x0f & 0xffff;
		case 0x12: // -$e,X
			return this.x - 0x0e & 0xffff;
		case 0x13: // -$D,X
			return this.x - 0x0d & 0xffff;
		case 0x14: // -$c,X
			return this.x - 0x0c & 0xffff;
		case 0x15: // -$b,X
			return this.x - 0x0b & 0xffff;
		case 0x16: // -$a,X
			return this.x - 0x0a & 0xffff;
		case 0x17: // -$9,X
			return this.x - 9 & 0xffff;
		case 0x18: // -$8,X
			return this.x - 8 & 0xffff;
		case 0x19: // -$7,X
			return this.x - 7 & 0xffff;
		case 0x1a: // -$6,X
			return this.x - 6 & 0xffff;
		case 0x1b: // -$5,X
			return this.x - 5 & 0xffff;
		case 0x1c: // -$4,X
			return this.x - 4 & 0xffff;
		case 0x1d: // -$3,X
			return this.x - 3 & 0xffff;
		case 0x1e: // -$2,X
			return this.x - 2 & 0xffff;
		case 0x1f: // -$1,X
			return this.x - 1 & 0xffff;
		case 0x20: // $0,Y
			return this.y;
		case 0x21: // $1,Y
			return this.y + 1 & 0xffff;
		case 0x22: // $2,Y
			return this.y + 2 & 0xffff;
		case 0x23: // $3,Y
			return this.y + 3 & 0xffff;
		case 0x24: // $4,Y
			return this.y + 4 & 0xffff;
		case 0x25: // $5,Y
			return this.y + 5 & 0xffff;
		case 0x26: // $6,Y
			return this.y + 6 & 0xffff;
		case 0x27: // $7,Y
			return this.y + 7 & 0xffff;
		case 0x28: // $8,Y
			return this.y + 8 & 0xffff;
		case 0x29: // $9,Y
			return this.y + 9 & 0xffff;
		case 0x2a: // $a,Y
			return this.y + 0x0a & 0xffff;
		case 0x2b: // $b,Y
			return this.y + 0x0b & 0xffff;
		case 0x2c: // $c,Y
			return this.y + 0x0c & 0xffff;
		case 0x2d: // $D,Y
			return this.y + 0x0d & 0xffff;
		case 0x2e: // $e,Y
			return this.y + 0x0e & 0xffff;
		case 0x2f: // $f,Y
			return this.y + 0x0f & 0xffff;
		case 0x30: // -$10,Y
			return this.y - 0x10 & 0xffff;
		case 0x31: // -$f,Y
			return this.y - 0x0f & 0xffff;
		case 0x32: // -$e,Y
			return this.y - 0x0e & 0xffff;
		case 0x33: // -$D,Y
			return this.y - 0x0d & 0xffff;
		case 0x34: // -$c,Y
			return this.y - 0x0c & 0xffff;
		case 0x35: // -$b,Y
			return this.y - 0x0b & 0xffff;
		case 0x36: // -$a,Y
			return this.y - 0x0a & 0xffff;
		case 0x37: // -$9,Y
			return this.y - 9 & 0xffff;
		case 0x38: // -$8,Y
			return this.y - 8 & 0xffff;
		case 0x39: // -$7,Y
			return this.y - 7 & 0xffff;
		case 0x3a: // -$6,Y
			return this.y - 6 & 0xffff;
		case 0x3b: // -$5,Y
			return this.y - 5 & 0xffff;
		case 0x3c: // -$4,Y
			return this.y - 4 & 0xffff;
		case 0x3d: // -$3,Y
			return this.y - 3 & 0xffff;
		case 0x3e: // -$2,Y
			return this.y - 2 & 0xffff;
		case 0x3f: // -$1,Y
			return this.y - 1 & 0xffff;
		case 0x40: // $0,U
			return this.u;
		case 0x41: // $1,U
			return this.u + 1 & 0xffff;
		case 0x42: // $2,U
			return this.u + 2 & 0xffff;
		case 0x43: // $3,U
			return this.u + 3 & 0xffff;
		case 0x44: // $4,U
			return this.u + 4 & 0xffff;
		case 0x45: // $5,U
			return this.u + 5 & 0xffff;
		case 0x46: // $6,U
			return this.u + 6 & 0xffff;
		case 0x47: // $7,U
			return this.u + 7 & 0xffff;
		case 0x48: // $8,U
			return this.u + 8 & 0xffff;
		case 0x49: // $9,U
			return this.u + 9 & 0xffff;
		case 0x4a: // $a,U
			return this.u + 0x0a & 0xffff;
		case 0x4b: // $b,U
			return this.u + 0x0b & 0xffff;
		case 0x4c: // $c,U
			return this.u + 0x0c & 0xffff;
		case 0x4d: // $D,U
			return this.u + 0x0d & 0xffff;
		case 0x4e: // $e,U
			return this.u + 0x0e & 0xffff;
		case 0x4f: // $f,U
			return this.u + 0x0f & 0xffff;
		case 0x50: // -$10,U
			return this.u - 0x10 & 0xffff;
		case 0x51: // -$f,U
			return this.u - 0x0f & 0xffff;
		case 0x52: // -$e,U
			return this.u - 0x0e & 0xffff;
		case 0x53: // -$D,U
			return this.u - 0x0d & 0xffff;
		case 0x54: // -$c,U
			return this.u - 0x0c & 0xffff;
		case 0x55: // -$b,U
			return this.u - 0x0b & 0xffff;
		case 0x56: // -$a,U
			return this.u - 0x0a & 0xffff;
		case 0x57: // -$9,U
			return this.u - 9 & 0xffff;
		case 0x58: // -$8,U
			return this.u - 8 & 0xffff;
		case 0x59: // -$7,U
			return this.u - 7 & 0xffff;
		case 0x5a: // -$6,U
			return this.u - 6 & 0xffff;
		case 0x5b: // -$5,U
			return this.u - 5 & 0xffff;
		case 0x5c: // -$4,U
			return this.u - 4 & 0xffff;
		case 0x5d: // -$3,U
			return this.u - 3 & 0xffff;
		case 0x5e: // -$2,U
			return this.u - 2 & 0xffff;
		case 0x5f: // -$1,U
			return this.u - 1 & 0xffff;
		case 0x60: // $0,S
			return this.s;
		case 0x61: // $1,S
			return this.s + 1 & 0xffff;
		case 0x62: // $2,S
			return this.s + 2 & 0xffff;
		case 0x63: // $3,S
			return this.s + 3 & 0xffff;
		case 0x64: // $4,S
			return this.s + 4 & 0xffff;
		case 0x65: // $5,S
			return this.s + 5 & 0xffff;
		case 0x66: // $6,S
			return this.s + 6 & 0xffff;
		case 0x67: // $7,S
			return this.s + 7 & 0xffff;
		case 0x68: // $8,S
			return this.s + 8 & 0xffff;
		case 0x69: // $9,S
			return this.s + 9 & 0xffff;
		case 0x6a: // $a,S
			return this.s + 0x0a & 0xffff;
		case 0x6b: // $b,S
			return this.s + 0x0b & 0xffff;
		case 0x6c: // $c,S
			return this.s + 0x0c & 0xffff;
		case 0x6d: // $D,S
			return this.s + 0x0d & 0xffff;
		case 0x6e: // $e,S
			return this.s + 0x0e & 0xffff;
		case 0x6f: // $f,S
			return this.s + 0x0f & 0xffff;
		case 0x70: // -$10,S
			return this.s - 0x10 & 0xffff;
		case 0x71: // -$f,S
			return this.s - 0x0f & 0xffff;
		case 0x72: // -$e,S
			return this.s - 0x0e & 0xffff;
		case 0x73: // -$D,S
			return this.s - 0x0d & 0xffff;
		case 0x74: // -$c,S
			return this.s - 0x0c & 0xffff;
		case 0x75: // -$b,S
			return this.s - 0x0b & 0xffff;
		case 0x76: // -$a,S
			return this.s - 0x0a & 0xffff;
		case 0x77: // -$9,S
			return this.s - 9 & 0xffff;
		case 0x78: // -$8,S
			return this.s - 8 & 0xffff;
		case 0x79: // -$7,S
			return this.s - 7 & 0xffff;
		case 0x7a: // -$6,S
			return this.s - 6 & 0xffff;
		case 0x7b: // -$5,S
			return this.s - 5 & 0xffff;
		case 0x7c: // -$4,S
			return this.s - 4 & 0xffff;
		case 0x7d: // -$3,S
			return this.s - 3 & 0xffff;
		case 0x7e: // -$2,S
			return this.s - 2 & 0xffff;
		case 0x7f: // -$1,S
			return this.s - 1 & 0xffff;
		case 0x80: // ,X+
			v = this.x;
			this.x = this.x + 1 & 0xffff;
			return v;
		case 0x81: // ,X++
			v = this.x;
			this.x = this.x + 2 & 0xffff;
			return v;
		case 0x82: // ,-X
			return this.x = this.x - 1 & 0xffff;
		case 0x83: // ,--X
			return this.x = this.x - 2 & 0xffff;
		case 0x84: // ,X
			return this.x;
		case 0x85: // B,X
			return this.x + this.b - (this.b << 1 & 0x100) & 0xffff;
		case 0x86: // A,X
			return this.x + this.a - (this.a << 1 & 0x100) & 0xffff;
		case 0x88: // n,X
			return this.x + (v = this.fetch()) - (v << 1 & 0x100) & 0xffff;
		case 0x89: // nn,X
			return this.x + (this.fetch() << 8 | this.fetch()) & 0xffff;
		case 0x8b: // D,X
			return this.x + (this.a << 8 | this.b) & 0xffff;
		case 0x91: // [,X++]
			v = this.x;
			this.x = this.x + 2 & 0xffff;
			break;
		case 0x93: // [,--X]
			v = this.x = this.x - 2 & 0xffff;
			break;
		case 0x94: // [,X]
			v = this.x;
			break;
		case 0x95: // [B,X]
			v = this.x + this.b - (this.b << 1 & 0x100) & 0xffff;
			break;
		case 0x96: // [A,X]
			v = this.x + this.a - (this.a << 1 & 0x100) & 0xffff;
			break;
		case 0x98: // [n,X]
			v = this.x + (v = this.fetch()) - (v << 1 & 0x100) & 0xffff;
			break;
		case 0x99: // [nn,X]
			v = this.x + (this.fetch() << 8 | this.fetch()) & 0xffff;
			break;
		case 0x9b: // [D,X]
			v = this.x + (this.a << 8 | this.b) & 0xffff;
			break;
		case 0xa0: // ,Y+
			v = this.y;
			this.y = this.y + 1 & 0xffff;
			return v;
		case 0xa1: // ,Y++
			v = this.y;
			this.y = this.y + 2 & 0xffff;
			return v;
		case 0xa2: // ,-Y
			return this.y = this.y - 1 & 0xffff;
		case 0xa3: // ,--Y
			return this.y = this.y - 2 & 0xffff;
		case 0xa4: // ,Y
			return this.y;
		case 0xa5: // B,Y
			return this.y + this.b - (this.b << 1 & 0x100) & 0xffff;
		case 0xa6: // A,Y
			return this.y + this.a - (this.a << 1 & 0x100) & 0xffff;
		case 0xa8: // n,Y
			return this.y + (v = this.fetch()) - (v << 1 & 0x100) & 0xffff;
		case 0xa9: // nn,Y
			return this.y + (this.fetch() << 8 | this.fetch()) & 0xffff;
		case 0xab: // D,Y
			return this.y + (this.a << 8 | this.b) & 0xffff;
		case 0xb1: // [,Y++]
			v = this.y;
			this.y = this.y + 2 & 0xffff;
			break;
		case 0xb3: // [,--Y]
			v = this.y = this.y - 2 & 0xffff;
			break;
		case 0xb4: // [,Y]
			v = this.y;
			break;
		case 0xb5: // [B,Y]
			v = this.y + this.b - (this.b << 1 & 0x100) & 0xffff;
			break;
		case 0xb6: // [A,Y]
			v = this.y + this.a - (this.a << 1 & 0x100) & 0xffff;
			break;
		case 0xb8: // [n,Y]
			v = this.y + (v = this.fetch()) - (v << 1 & 0x100) & 0xffff;
			break;
		case 0xb9: // [nn,Y]
			v = this.y + (this.fetch() << 8 | this.fetch()) & 0xffff;
			break;
		case 0xbb: // [D,Y]
			v = this.y + (this.a << 8 | this.b) & 0xffff;
			break;
		case 0xc0: // ,U+
			v = this.u;
			this.u = this.u + 1 & 0xffff;
			return v;
		case 0xc1: // ,U++
			v = this.u;
			this.u = this.u + 2 & 0xffff;
			return v;
		case 0xc2: // ,-U
			return this.u = this.u - 1 & 0xffff;
		case 0xc3: // ,--u
			return this.u = this.u - 2 & 0xffff;
		case 0xc4: // ,U
			return this.u;
		case 0xc5: // B,U
			return this.u + this.b - (this.b << 1 & 0x100) & 0xffff;
		case 0xc6: // A,U
			return this.u + this.a - (this.a << 1 & 0x100) & 0xffff;
		case 0xc8: // n,U
			return this.u + (v = this.fetch()) - (v << 1 & 0x100) & 0xffff;
		case 0xc9: // nn,U
			return this.u + (this.fetch() << 8 | this.fetch()) & 0xffff;
		case 0xcb: // D,U
			return this.u + (this.a << 8 | this.b) & 0xffff;
		case 0xd1: // [,U++]
			v = this.u;
			this.u = this.u + 2 & 0xffff;
			break;
		case 0xd3: // [,--U]
			v = this.u = this.u - 2 & 0xffff;
			break;
		case 0xd4: // [,U]
			v = this.u;
			break;
		case 0xd5: // [B,U]
			v = this.u + this.b - (this.b << 1 & 0x100) & 0xffff;
			break;
		case 0xd6: // [A,U]
			v = this.u + this.a - (this.a << 1 & 0x100) & 0xffff;
			break;
		case 0xd8: // [n,U]
			v = this.u + (v = this.fetch()) - (v << 1 & 0x100) & 0xffff;
			break;
		case 0xd9: // [nn,U]
			v = this.u + (this.fetch() << 8 | this.fetch()) & 0xffff;
			break;
		case 0xdb: // [D,U]
			v = this.u + (this.a << 8 | this.b) & 0xffff;
			break;
		case 0xe0: // ,S+
			v = this.s;
			this.s = this.s + 1 & 0xffff;
			return v;
		case 0xe1: // ,S++
			v = this.s;
			this.s = this.s + 2 & 0xffff;
			return v;
		case 0xe2: // ,-S
			return this.s = this.s - 1 & 0xffff;
		case 0xe3: // ,--S
			return this.s = this.s - 2 & 0xffff;
		case 0xe4: // ,S
			return this.s;
		case 0xe5: // B,S
			return this.s + this.b - (this.b << 1 & 0x100) & 0xffff;
		case 0xe6: // A,S
			return this.s + this.a - (this.a << 1 & 0x100) & 0xffff;
		case 0xe8: // n,S
			return this.s + (v = this.fetch()) - (v << 1 & 0x100) & 0xffff;
		case 0xe9: // nn,S
			return this.s + (this.fetch() << 8 | this.fetch()) & 0xffff;
		case 0xeb: // D,S
			return this.s + (this.a << 8 | this.b) & 0xffff;
		case 0xf1: // [,S++]
			v = this.s;
			this.s = this.s + 2 & 0xffff;
			break;
		case 0xf3: // [,--S]
			v = this.s = this.s - 2 & 0xffff;
			break;
		case 0xf4: // [,S]
			v = this.s;
			break;
		case 0xf5: // [B,S]
			v = this.s + this.b - (this.b << 1 & 0x100) & 0xffff;
			break;
		case 0xf6: // [A,S]
			v = this.s + this.a - (this.a << 1 & 0x100) & 0xffff;
			break;
		case 0xf8: // [n,S]
			v = this.s + (v = this.fetch()) - (v << 1 & 0x100) & 0xffff;
			break;
		case 0xf9: // [nn,S]
			v = this.s + (this.fetch() << 8 | this.fetch()) & 0xffff;
			break;
		case 0xfb: // [D,S]
			v = this.s + (this.a << 8 | this.b) & 0xffff;
			break;
		case 0x8c: // n,PC
		case 0xac:
		case 0xcc:
		case 0xec:
			v = this.fetch();
			return this.pc + v - (v << 1 & 0x100) & 0xffff;
		case 0x8d: // nn,PC
		case 0xad:
		case 0xcd:
		case 0xed:
			v = this.fetch() << 8 | this.fetch();
			return this.pc + v & 0xffff;
		case 0x9c: // [n,PC]
		case 0xbc:
		case 0xdc:
		case 0xfc:
			v = this.fetch();
			v = this.pc + v - (v << 1 & 0x100) & 0xffff;
			break;
		case 0x9d: // [nn,PC]
		case 0xbd:
		case 0xdd:
		case 0xfd:
			v = this.fetch() << 8 | this.fetch();
			v = this.pc + v & 0xffff;
			break;
		case 0x9f: // [nn]
		case 0xbf:
		case 0xdf:
		case 0xff:
			v = this.fetch() << 8 | this.fetch();
			break;
		default:
			return 0xffffffff;
		}
		return this.read(v) << 8 | this.read1(v);
	}

	direct() {
		return this.dp << 8 | this.fetch();
	}

	extend() {
		return this.fetch() << 8 | this.fetch();
	}

	lbcc(cond) {
		const nn = this.fetch() << 8 | this.fetch();
		if (cond) this.pc = this.pc + nn & 0xffff;
	}

	lbsr() {
		const nn = this.fetch() << 8 | this.fetch();
		this.pshs16(this.pc);
		this.pc = this.pc + nn & 0xffff;
	}

	bcc(cond) {
		const n = this.fetch();
		if (cond) this.pc = this.pc + n - (n << 1 & 0x100) & 0xffff;
	}

	bsr() {
		const n = this.fetch();
		this.pshs16(this.pc);
		this.pc = this.pc + n - (n << 1 & 0x100) & 0xffff;
	}

	nega(r) {
		r = MC6809.aSub[0][r][0];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	coma(r) {
		this.ccr = this.ccr & ~0x0f | 1 | MC6809.fLogic[r = ~r & 0xff];
		return r;
	}

	lsra(r) {
		r = MC6809.aRr[0][r];
		this.ccr = this.ccr & ~0x0d | r >>> 8;
		return r & 0xff;
	}

	rora(r) {
		r = MC6809.aRr[this.ccr & 1][r];
		this.ccr = this.ccr & ~0x0d | r >>> 8;
		return r & 0xff;
	}

	asra(r) {
		r = MC6809.aRr[r >>> 7][r];
		this.ccr = this.ccr & ~0x0d | r >>> 8;
		return r & 0xff;
	}

	lsla(r) {
		r = MC6809.aRl[0][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	rola(r) {
		r = MC6809.aRl[this.ccr & 1][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	deca(r) {
		r = MC6809.aSub[0][1][r];
		this.ccr = this.ccr & ~0x0e | r >>> 8 & 0x0e;
		return r & 0xff;
	}

	inca(r) {
		r = MC6809.aAdd[0][1][r];
		this.ccr = this.ccr & ~0x0e | r >>> 8 & 0x0e;
		return r & 0xff;
	}

	tsta(r) {
		this.ccr = this.ccr & ~0x0e | MC6809.fLogic[r];
	}

	clra() {
		this.ccr = this.ccr & ~0x0f | 4;
		return 0;
	}

	neg(ea) {
		const r = MC6809.aSub[0][this.read(ea)][0];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		this.write(ea, r & 0xff);
	}

	com(ea) {
		const r = ~this.read(ea) & 0xff;
		this.ccr = this.ccr & ~0x0f | 1 | MC6809.fLogic[r];
		this.write(ea, r);
	}

	lsr(ea) {
		const r = MC6809.aRr[0][this.read(ea)];
		this.ccr = this.ccr & ~0x0d | r >>> 8;
		this.write(ea, r & 0xff);
	}

	ror(ea) {
		const r = MC6809.aRr[this.ccr & 1][this.read(ea)];
		this.ccr = this.ccr & ~0x0d | r >>> 8;
		this.write(ea, r & 0xff);
	}

	asr(ea) {
		let r = this.read(ea);
		r = MC6809.aRr[r >>> 7][r];
		this.ccr = this.ccr & ~0x0d | r >>> 8;
		this.write(ea, r & 0xff);
	}

	lsl(ea) {
		const r = MC6809.aRl[0][this.read(ea)];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		this.write(ea, r & 0xff);
	}

	rol(ea) {
		const r = MC6809.aRl[this.ccr & 1][this.read(ea)];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		this.write(ea, r & 0xff);
	}

	dec(ea) {
		const r = MC6809.aSub[0][1][this.read(ea)];
		this.ccr = this.ccr & ~0x0e | r >>> 8 & 0x0e;
		this.write(ea, r & 0xff);
	}

	inc(ea) {
		const r = MC6809.aAdd[0][1][this.read(ea)];
		this.ccr = this.ccr & ~0x0e | r >>> 8 & 0x0e;
		this.write(ea, r & 0xff);
	}

	tst(ea) {
		this.ccr = this.ccr & ~0x0e | MC6809.fLogic[this.read(ea)];
	}

	clr(ea) {
		this.ccr = this.ccr & ~0x0f | 4;
		this.write(ea, 0);
	}

	sub(r, ea) {
		r = MC6809.aSub[0][this.readf(ea)][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	cmp(r, ea) {
		this.ccr = this.ccr & ~0x0f | MC6809.aSub[0][this.readf(ea)][r] >>> 8;
	}

	sbc(r, ea) {
		r = MC6809.aSub[this.ccr & 1][this.readf(ea)][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	and(r, ea) {
		this.ccr = this.ccr & ~0x0e | MC6809.fLogic[r &= this.readf(ea)];
		return r;
	}

	bit(r, ea) {
		this.ccr = this.ccr & ~0x0e | MC6809.fLogic[r & this.readf(ea)];
	}

	ld(ea) {
		const r = this.readf(ea);
		this.ccr = this.ccr & ~0x0e | MC6809.fLogic[r];
		return r;
	}

	st(r, ea) {
		this.ccr = this.ccr & ~0x0e | MC6809.fLogic[this.write(ea, r)];
	}

	eor(r, ea) {
		this.ccr = this.ccr & ~0x0e | MC6809.fLogic[r ^= this.readf(ea)];
		return r;
	}

	adc(r, ea) {
		r = MC6809.aAdd[this.ccr & 1][this.readf(ea)][r];
		this.ccr = this.ccr & ~0x2f | r >>> 8;
		return r & 0xff;
	}

	or(r, ea) {
		this.ccr = this.ccr & ~0x0e | MC6809.fLogic[r |= this.readf(ea)];
		return r;
	}

	add(r, ea) {
		r = MC6809.aAdd[0][this.readf(ea)][r];
		this.ccr = this.ccr & ~0x2f | r >>> 8;
		return r & 0xff;
	}

	jsr(ea) {
		this.pshs16(this.pc);
		this.pc = ea;
	}

	subd(ea) {
		let v, w;
		v = this.readf(ea);
		this.b = (w = MC6809.aSub[0][this.readf1(ea)][this.b]) & 0xff;
		this.a = (v = MC6809.aSub[w >>> 8 & 1][v][this.a]) & 0xff;
		this.ccr = this.ccr & ~0x0f | v >>> 8;
		this.ccr &= !this.b << 2 | ~4;
	}

	addd(ea) {
		let v, w;
		v = this.readf(ea);
		this.b = (w = MC6809.aAdd[0][this.readf1(ea)][this.b]) & 0xff;
		this.a = (v = MC6809.aAdd[w >>> 8 & 1][v][this.a]) & 0xff;
		this.ccr = this.ccr & ~0x0f | v >>> 8 & 0x0f;
		this.ccr &= !this.b << 2 | ~4;
	}

	ldd(ea) {
		this.a = this.readf(ea);
		this.b = this.readf1(ea);
		this.ccr = this.ccr & ~0x0e | !(this.a | this.b) << 2 | this.a >>> 4 & 8;
	}

	std(ea) {
		this.write(ea, this.a);
		this.write1(ea, this.b);
		this.ccr = this.ccr & ~0x0e | !(this.a | this.b) << 2 | this.a >>> 4 & 8;
	}

	cmp16(r, ea) {
		const v = this.readf(ea);
		const w = MC6809.aSub[0][this.readf1(ea)][r & 0xff];
		this.ccr = this.ccr & ~0x0f | MC6809.aSub[w >>> 8 & 1][v][r >>> 8] >>> 8;
		this.ccr &= ((w & 0xff) === 0) << 2 | ~4;
	}

	ld16(ea) {
		const r = this.readf(ea) << 8 | this.readf1(ea);
		this.ccr = this.ccr & ~0x0e | !r << 2 | r >>> 12 & 8;
		return r;
	}

	st16(r, ea) {
		this.write(ea, r >>> 8);
		this.write1(ea, r & 0xff);
		this.ccr = this.ccr & ~0x0e | !r << 2 | r >>> 12 & 8;
	}

	pshs(r) {
		this.s = this.s - 1 & 0xffff;
		this.write(this.s, r);
	}

	pshu(r) {
		this.u = this.u - 1 & 0xffff;
		this.write(this.u, r);
	}

	puls() {
		const r = this.read(this.s);
		this.s = this.s + 1 & 0xffff;
		return r;
	}

	pulu() {
		const r = this.read(this.u);
		this.u = this.u + 1 & 0xffff;
		return r;
	}

	pshs16(r) {
		this.s = this.s - 2 & 0xffff;
		this.write1(this.s, r & 0xff);
		this.write(this.s, r >>> 8);
	}

	pshu16(r) {
		this.u = this.u - 2 & 0xffff;
		this.write1(this.u, r & 0xff);
		this.write(this.u, r >>> 8);
	}

	puls16() {
		const r = this.read(this.s) << 8 | this.read1(this.s);
		this.s = this.s + 2 & 0xffff;
		return r;
	}

	pulu16() {
		const r = this.read(this.u) << 8 | this.read1(this.u);
		this.u = this.u + 2 & 0xffff;
		return r;
	}

	readf(addr) {
		if (addr === null) {
//			data = !(page = this.memorymap[this.pc >>> 8]).fetch ? page.base[this.pc & 0xff] : page.fetch(this.pc, this.arg);
			const data = this.memorymap[this.pc >>> 8].base[this.pc & 0xff];
			this.pc = this.pc + 1 & 0xffff;
			return data;
		}
		const page = this.memorymap[addr >>> 8];
		return !page.read ? page.base[addr & 0xff] : page.read(addr, this.arg);
	}

	readf1(addr) {
		if (addr === null) {
//			data = !(page = this.memorymap[this.pc >>> 8]).fetch ? page.base[this.pc & 0xff] : page.fetch(this.pc, this.arg);
			const data = this.memorymap[this.pc >>> 8].base[this.pc & 0xff];
			this.pc = this.pc + 1 & 0xffff;
			return data;
		}
		const page = this.memorymap[(addr = addr + 1 & 0xffff) >>> 8];
		return !page.read ? page.base[addr & 0xff] : page.read(addr, this.arg);
	}
}

void function () {
	let f, i, j, k, r;

	MC6809.aAdd = []; // [2][0x100][0x100];
	MC6809.aSub = []; // [2][0x100][0x100];
	MC6809.aDaa = []; // [4][0x100];
	MC6809.aRl = []; // [2][0x100];
	MC6809.aRr = []; // [2][0x100];
	MC6809.fLogic = new Uint8Array(0x100);

	for (i = 0; i < 2; i++) {
		MC6809.aAdd[i] = [];
		for (j = 0; j < 0x100; j++)
			MC6809.aAdd[i][j] = new Uint16Array(0x100);
	}
	for (i = 0; i < 2; i++) {
		MC6809.aSub[i] = [];
		for (j = 0; j < 0x100; j++)
			MC6809.aSub[i][j] = new Uint16Array(0x100);
	}
	for (i = 0; i < 4; i++)
		MC6809.aDaa[i] = new Uint16Array(0x100);
	for (i = 0; i < 2; i++)
		MC6809.aRl[i] = new Uint16Array(0x100);
	for (i = 0; i < 2; i++)
		MC6809.aRr[i] = new Uint16Array(0x100);

	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++)
			for (k = 0; k < 0x100; k++) {
				r = j + k + i & 0xff;
				const v = j & k & ~r | ~j & ~k & r;
				const c = j & k | k & ~r | ~r & j;
				f = c << 2 & 0x20 | r >>> 4 & 8 | !r << 2 | v >>> 6 & 2 | c >>> 7 & 1;
				MC6809.aAdd[i][k][j] = f << 8 | r;
			}
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++)
			for (k = 0; k < 0x100; k++) {
				r = j - k - i & 0xff;
				const v = j & ~k & ~r | ~j & k & r;
				const c = ~j & k | k & r | r & ~j;
				f = r >>> 4 & 8 | !r << 2 | v >>> 6 & 2 | c >>> 7 & 1;
				MC6809.aSub[i][k][j] = f << 8 | r;
			}
	for (i = 0; i < 0x100; i++)
		MC6809.fLogic[i] = i >>> 4 & 8 | !i << 2;
	for (i = 0; i < 4; i++)
		for (j = 0; j < 0x100; j++) {
			f = i & 1;
			r = j;
			k = 0;
			if ((i & 2) !== 0 || (r & 0x0f) > 9)
				k = 6;
			if ((i & 1) !== 0 || (r & 0xf0) > 0x90 || (r & 0xf0) > 0x80 && (r & 0x0f) > 9)
				k += 0x60;
			f |= MC6809.fLogic[(r += k) & 0xff] | (r >= 0x100);
			MC6809.aDaa[i][j] = f << 8 | r & 0xff;
		}
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++) {
			r = (j << 1 | i) & 0xff;
			f = MC6809.fLogic[r] | j >>> 7;
			f |= (f >>> 2 ^ f << 1) & 2;
			MC6809.aRl[i][j] = f << 8 | r;
		}
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++) {
			r = j >>> 1 | i << 7;
			f = MC6809.fLogic[r] | j & 1;
			MC6809.aRr[i][j] = f << 8 | r;
		}
}();

