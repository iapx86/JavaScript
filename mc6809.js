/*
 *
 *	MC6809 Emulator
 *
 */

import Cpu from './cpu.js';

export default class MC6809 extends Cpu {
	a = 0;
	b = 0;
	dp = 0;
	ccr = 0; // ccr:efhinzvc
	x = 0;
	y = 0;
	u = 0;
	s = 0;

	constructor(clock) {
		super(clock);
	}

	reset() {
		super.reset();
		this.ccr = 0x50;
		this.dp = 0;
		this.pc = this.read16(0xfffe);
	}

	fast_interrupt() {
		if (!super.interrupt() || this.ccr & 0x40)
			return false;
		return this.cycle -= 10, this.pshs16(this.pc), this.pshs(this.ccr &= ~0x80), this.ccr |= 0x50, this.pc = this.read16(0xfff6), true;
	}

	interrupt() {
		if (!super.interrupt() || this.ccr & 0x10)
			return false;
		return this.cycle -= cc[0x3f], this.pshs16(this.pc, this.u, this.y, this.x), this.pshs(this.dp, this.b, this.a, this.ccr |= 0x80), this.ccr |= 0x10, this.pc = this.read16(0xfff8), true;
	}

	non_maskable_interrupt() {
		if (!super.interrupt())
			return false;
		return this.cycle -= cc[0x3f], this.pshs16(this.pc, this.u, this.y, this.x), this.pshs(this.dp, this.b, this.a, this.ccr |= 0x80), this.ccr |= 0x50, this.pc = this.read16(0xfffc), true;
	}

	_execute() {
		let v, ea, op = this.fetch();
		this.cycle -= cc[op];
		switch (op) {
		case 0x00: // NEG <n
			return ea = this.dp << 8 | this.fetch(), this.write8(this.neg8(this.read(ea)), ea);
		case 0x03: // COM <n
			return ea = this.dp << 8 | this.fetch(), this.write8(this.com8(this.read(ea)), ea);
		case 0x04: // LSR <n
			return ea = this.dp << 8 | this.fetch(), this.write8(this.lsr8(this.read(ea)), ea);
		case 0x06: // ROR <n
			return ea = this.dp << 8 | this.fetch(), this.write8(this.ror8(this.read(ea)), ea);
		case 0x07: // ASR <n
			return ea = this.dp << 8 | this.fetch(), this.write8(this.asr8(this.read(ea)), ea);
		case 0x08: // LSL <n
			return ea = this.dp << 8 | this.fetch(), this.write8(this.lsl8(this.read(ea)), ea);
		case 0x09: // ROL <n
			return ea = this.dp << 8 | this.fetch(), this.write8(this.rol8(this.read(ea)), ea);
		case 0x0a: // DEC <n
			return ea = this.dp << 8 | this.fetch(), this.write8(this.dec8(this.read(ea)), ea);
		case 0x0c: // INC <n
			return ea = this.dp << 8 | this.fetch(), this.write8(this.inc8(this.read(ea)), ea);
		case 0x0d: // TST <n
			return void(this.mov8(this.read(this.dp << 8 | this.fetch())));
		case 0x0e: // JMP <n
			return void(this.pc = this.dp << 8 | this.fetch());
		case 0x0f: // CLR <n
			return this.write8(this.clr8(), this.dp << 8 | this.fetch());
		case 0x10:
			this.cycle -= cc[op = this.fetch()];
			switch (op) {
			case 0x21: // LBRN
				return this.lbcc(false);
			case 0x22: // LBHI
				return this.lbcc(!((this.ccr >> 2 | this.ccr) & 1));
			case 0x23: // LBLS
				return this.lbcc(((this.ccr >> 2 | this.ccr) & 1) !== 0);
			case 0x24: // LBHS(LBCC)
				return this.lbcc(!(this.ccr & 1));
			case 0x25: // LBLO(LBCS)
				return this.lbcc((this.ccr & 1) !== 0);
			case 0x26: // LBNE
				return this.lbcc(!(this.ccr & 4));
			case 0x27: // LBEQ
				return this.lbcc((this.ccr & 4) !== 0);
			case 0x28: // LBVC
				return this.lbcc(!(this.ccr & 2));
			case 0x29: // LBVS
				return this.lbcc((this.ccr & 2) !== 0);
			case 0x2a: // LBPL
				return this.lbcc(!(this.ccr & 8));
			case 0x2b: // LBMI
				return this.lbcc((this.ccr & 8) !== 0);
			case 0x2c: // LBGE
				return this.lbcc(!((this.ccr >> 2 ^ this.ccr) & 2));
			case 0x2d: // LBLT
				return this.lbcc(((this.ccr >> 2 ^ this.ccr) & 2) !== 0);
			case 0x2e: // LBGT
				return this.lbcc(!((this.ccr >> 2 ^ this.ccr | this.ccr >> 1) & 2));
			case 0x2f: // LBLE
				return this.lbcc(((this.ccr >> 2 ^ this.ccr | this.ccr >> 1) & 2) !== 0);
			case 0x3f: // SWI2
				return this.pshs16(this.pc, this.u, this.y, this.x), this.pshs(this.dp, this.b, this.a, this.ccr |= 0x80), void(this.pc = this.read16(0xfff4));
			case 0x83: // CMPD #nn
				return void(this.sub16(this.fetch16(), this.a << 8 | this.b));
			case 0x8c: // CMPY #nn
				return void(this.sub16(this.fetch16(), this.y));
			case 0x8e: // LDY #nn
				return void(this.y = this.mov16(this.fetch16()));
			case 0x93: // CMPD <n
				return void(this.sub16(this.read16(this.dp << 8 | this.fetch()), this.a << 8 | this.b));
			case 0x9c: // CMPY <n
				return void(this.sub16(this.read16(this.dp << 8 | this.fetch()), this.y));
			case 0x9e: // LDY <n
				return void(this.y = this.mov16(this.read16(this.dp << 8 | this.fetch())));
			case 0x9f: // STY <n
				return this.write16(this.mov16(this.y), this.dp << 8 | this.fetch());
			case 0xa3: // CMPD ,r
				return void(this.sub16(this.read16(this.index()), this.a << 8 | this.b));
			case 0xac: // CMPY ,r
				return void(this.sub16(this.read16(this.index()), this.y));
			case 0xae: // LDY ,r
				return void(this.y = this.mov16(this.read16(this.index())));
			case 0xaf: // STY ,r
				return this.write16(this.mov16(this.y), this.index());
			case 0xb3: // CMPD >nn
				return void(this.sub16(this.read16(this.fetch16()), this.a << 8 | this.b));
			case 0xbc: // CMPY >nn
				return void(this.sub16(this.read16(this.fetch16()), this.y));
			case 0xbe: // LDY >nn
				return void(this.y = this.mov16(this.read16(this.fetch16())));
			case 0xbf: // STY >nn
				return this.write16(this.mov16(this.y), this.fetch16());
			case 0xce: // LDS #nn
				return void(this.s = this.mov16(this.fetch16()));
			case 0xde: // LDS <n
				return void(this.s = this.mov16(this.read16(this.dp << 8 | this.fetch())));
			case 0xdf: // STS <n
				return this.write16(this.mov16(this.s), this.dp << 8 | this.fetch());
			case 0xee: // LDS ,r
				return void(this.s = this.mov16(this.read16(this.index())));
			case 0xef: // STS ,r
				return this.write16(this.mov16(this.s), this.index());
			case 0xfe: // LDS >nn
				return void(this.s = this.mov16(this.read16(this.fetch16())));
			case 0xff: // STS >nn
				return this.write16(this.mov16(this.s), this.fetch16());
			default:
				this.undefsize = 2;
				this.undef();
				return;
			}
		case 0x11:
			this.cycle -= cc[op = this.fetch()];
			switch (op) {
			case 0x3f: // SWI3
				return this.pshs16(this.pc, this.u, this.y, this.x), this.pshs(this.dp, this.b, this.a, this.ccr |= 0x80), void(this.pc = this.read16(0xfff2));
			case 0x83: // CMPU #nn
				return void(this.sub16(this.fetch16(), this.u));
			case 0x8c: // CMPS #nn
				return void(this.sub16(this.fetch16(), this.s));
			case 0x93: // CMPU <n
				return void(this.sub16(this.read16(this.dp << 8 | this.fetch()), this.u));
			case 0x9c: // CMPS <n
				return void(this.sub16(this.read16(this.dp << 8 | this.fetch()), this.s));
			case 0xa3: // CMPU ,r
				return void(this.sub16(this.read16(this.index()), this.u));
			case 0xac: // CMPS ,r
				return void(this.sub16(this.read16(this.index()), this.s));
			case 0xb3: // CMPU >nn
				return void(this.sub16(this.read16(this.fetch16()), this.u));
			case 0xbc: // CMPS >nn
				return void(this.sub16(this.read16(this.fetch16()), this.s));
			default:
				this.undefsize = 2;
				this.undef();
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
			return this.daa();
		case 0x1a: // ORCC
			return void(this.ccr |= this.fetch());
		case 0x1c: // ANDCC
			return void(this.ccr &= this.fetch());
		case 0x1d: // SEX
			return void(this.b & 0x80 ? (this.a = 0xff, this.ccr = this.ccr & ~4 | 8) : (this.a = 0, this.ccr = this.ccr & ~0xc | !this.b << 2));
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
				return void([this.a, this.b, this.x] = [...this.split(this.x), this.a << 8 | this.b]);
			case 0x02: // EXG D,Y
			case 0x20: // EXG Y,D
				return void([this.a, this.b, this.y] = [...this.split(this.y), this.a << 8 | this.b]);
			case 0x03: // EXG D,U
			case 0x30: // EXG U,D
				return void([this.a, this.b, this.u] = [...this.split(this.u), this.a << 8 | this.b]);
			case 0x04: // EXG D,S
			case 0x40: // EXG S,D
				return void([this.a, this.b, this.s] = [...this.split(this.s), this.a << 8 | this.b]);
			case 0x05: // EXG D,PC
			case 0x50: // EXG PC,D
				return void([this.a, this.b, this.pc] = [...this.split(this.pc), this.a << 8 | this.b]);
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
				this.undef();
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
				return void([this.a, this.b] = this.split(this.x));
			case 0x12: // TFR X,Y
				return void(this.y = this.x);
			case 0x13: // TFR X,U
				return void(this.u = this.x);
			case 0x14: // TFR X,S
				return void(this.s = this.x);
			case 0x15: // TFR X,PC
				return void(this.pc = this.x);
			case 0x20: // TFR Y,D
				return void([this.a, this.b] = this.split(this.y));
			case 0x21: // TFR Y,X
				return void(this.x = this.y);
			case 0x23: // TFR Y,U
				return void(this.u = this.y);
			case 0x24: // TFR Y,S
				return void(this.s = this.y);
			case 0x25: // TFR Y,PC
				return void(this.pc = this.y);
			case 0x30: // TFR U,D
				return void([this.a, this.b] = this.split(this.u));
			case 0x31: // TFR U,X
				return void(this.x = this.u);
			case 0x32: // TFR U,Y
				return void(this.y = this.u);
			case 0x34: // TFR U,S
				return void(this.s = this.u);
			case 0x35: // TFR U,PC
				return void(this.pc = this.u);
			case 0x40: // TFR S,D
				return void([this.a, this.b] = this.split(this.s));
			case 0x41: // TFR S,X
				return void(this.x = this.s);
			case 0x42: // TFR S,Y
				return void(this.y = this.s);
			case 0x43: // TFR S,U
				return void(this.u = this.s);
			case 0x45: // TFR S,PC
				return void(this.pc = this.s);
			case 0x50: // TFR PC,D
				return void([this.a, this.b] = this.split(this.pc));
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
				this.undef();
				return;
			}
		case 0x20: // BRA
			return this.bcc(true);
		case 0x21: // BRN
			return this.bcc(false);
		case 0x22: // BHI
			return this.bcc(!((this.ccr >> 2 | this.ccr) & 1));
		case 0x23: // BLS
			return this.bcc(((this.ccr >> 2 | this.ccr) & 1) !== 0);
		case 0x24: // BHS(BCC)
			return this.bcc(!(this.ccr & 1));
		case 0x25: // BLO(BCS)
			return this.bcc((this.ccr & 1) !== 0);
		case 0x26: // BNE
			return this.bcc(!(this.ccr & 4));
		case 0x27: // BEQ
			return this.bcc((this.ccr & 4) !== 0);
		case 0x28: // BVC
			return this.bcc(!(this.ccr & 2));
		case 0x29: // BVS
			return this.bcc((this.ccr & 2) !== 0);
		case 0x2a: // BPL
			return this.bcc(!(this.ccr & 8));
		case 0x2b: // BMI
			return this.bcc((this.ccr & 8) !== 0);
		case 0x2c: // BGE
			return this.bcc(!((this.ccr >> 2 ^ this.ccr) & 2));
		case 0x2d: // BLT
			return this.bcc(((this.ccr >> 2 ^ this.ccr) & 2) !== 0);
		case 0x2e: // BGT
			return this.bcc(!((this.ccr >> 2 ^ this.ccr | this.ccr >> 1) & 2));
		case 0x2f: // BLE
			return this.bcc(((this.ccr >> 2 ^ this.ccr | this.ccr >> 1) & 2) !== 0);
		case 0x30: // LEAX
			return void(this.ccr = this.ccr & ~4 | !(this.x = this.index()) << 2);
		case 0x31: // LEAY
			return void(this.ccr = this.ccr & ~4 | !(this.y = this.index()) << 2);
		case 0x32: // LEAS
			return void(this.s = this.index());
		case 0x33: // LEAU
			return void(this.u = this.index());
		case 0x34: // PSHS
			(v = this.fetch()) & 0x80 && (this.cycle -= 2, this.pshs16(this.pc)), v & 0x40 && (this.cycle -= 2, this.pshs16(this.u));
			v & 0x20 && (this.cycle -= 2, this.pshs16(this.y)), v & 0x10 && (this.cycle -= 2, this.pshs16(this.x));
			v & 8 && (this.cycle -= 1, this.pshs(this.dp)), v & 4 && (this.cycle -= 1, this.pshs(this.b));
			return v & 2 && (this.cycle -= 1, this.pshs(this.a)), void(v & 1 && (this.cycle -= 1, this.pshs(this.ccr)));
		case 0x35: // PULS
			(v = this.fetch()) & 1 && (this.cycle -= 1, this.ccr = this.puls()), v & 2 && (this.cycle -= 1, this.a = this.puls());
			v & 4 && (this.cycle -= 1, this.b = this.puls()), v & 8 && (this.cycle -= 1, this.dp = this.puls());
			v & 0x10 && (this.cycle -= 2, this.x = this.puls16()), v & 0x20 && (this.cycle -= 2, this.y = this.puls16());
			return v & 0x40 && (this.cycle -= 2, this.u = this.puls16()), void(v & 0x80 && (this.cycle -= 2, this.pc = this.puls16()));
		case 0x36: // PSHU
			(v = this.fetch()) & 0x80 && (this.cycle -= 2, this.pshu16(this.pc)), v & 0x40 && (this.cycle -= 2, this.pshu16(this.s));
			v & 0x20 && (this.cycle -= 2, this.pshu16(this.y)), v & 0x10 && (this.cycle -= 2, this.pshu16(this.x));
			v & 8 && (this.cycle -= 1, this.pshu(this.dp)), v & 4 && (this.cycle -= 1, this.pshu(this.b));
			return v & 2 && (this.cycle -= 1, this.pshu(this.a)), void(v & 1 && (this.cycle -= 1, this.pshu(this.ccr)));
		case 0x37: // PULU
			(v = this.fetch()) & 1 && (this.cycle -= 1, this.ccr = this.pulu()), v & 2 && (this.cycle -= 1, this.a = this.pulu());
			v & 4 && (this.cycle -= 1, this.b = this.pulu()), v & 8 && (this.cycle -= 1, this.dp = this.pulu());
			v & 0x10 && (this.cycle -= 2, this.x = this.pulu16()), v & 0x20 && (this.cycle -= 2, this.y = this.pulu16());
			return v & 0x40 && (this.cycle -= 2, this.s = this.pulu16()), void(v & 0x80 && (this.cycle -= 2, this.pc = this.pulu16()));
		case 0x39: // RTS
			return void(this.pc = this.puls16());
		case 0x3a: // ABX
			return void(this.x = this.x + this.b & 0xffff);
		case 0x3b: // RTI
			if ((this.ccr = this.puls()) & 0x80)
				this.cycle -= 9, this.a = this.puls(), this.b = this.puls(), this.dp = this.puls(), this.x = this.puls16(), this.y = this.puls16(), this.u = this.puls16();
			return void(this.pc = this.puls16());
		case 0x3c: // CWAI
			return this.ccr &= this.fetch(), this.suspend();
		case 0x3d: // MUL
			return [this.a, this.b] = this.split(this.a * this.b), void(this.ccr = this.ccr & ~5 | !(this.a | this.b) << 2 | this.b >> 7);
		case 0x3f: // SWI
			return this.pshs16(this.pc, this.u, this.y, this.x), this.pshs(this.dp, this.b, this.a, this.ccr |= 0x80), this.ccr |= 0x50, void(this.pc = this.read16(0xfffa));
		case 0x40: // NEGA
			return void(this.a = this.neg8(this.a));
		case 0x43: // COMA
			return void(this.a = this.com8(this.a));
		case 0x44: // LSRA
			return void(this.a = this.lsr8(this.a));
		case 0x46: // RORA
			return void(this.a = this.ror8(this.a));
		case 0x47: // ASRA
			return void(this.a = this.asr8(this.a));
		case 0x48: // LSLA
			return void(this.a = this.lsl8(this.a));
		case 0x49: // ROLA
			return void(this.a = this.rol8(this.a));
		case 0x4a: // DECA
			return void(this.a = this.dec8(this.a));
		case 0x4c: // INCA
			return void(this.a = this.inc8(this.a));
		case 0x4d: // TSTA
			return void(this.mov8(this.a));
		case 0x4f: // CLRA
			return void(this.a = this.clr8());
		case 0x50: // NEGB
			return void(this.b = this.neg8(this.b));
		case 0x53: // COMB
			return void(this.b = this.com8(this.b));
		case 0x54: // LSRB
			return void(this.b = this.lsr8(this.b));
		case 0x56: // RORB
			return void(this.b = this.ror8(this.b));
		case 0x57: // ASRB
			return void(this.b = this.asr8(this.b));
		case 0x58: // LSLB
			return void(this.b = this.lsl8(this.b));
		case 0x59: // ROLB
			return void(this.b = this.rol8(this.b));
		case 0x5a: // DECB
			return void(this.b = this.dec8(this.b));
		case 0x5c: // INCB
			return void(this.b = this.inc8(this.b));
		case 0x5d: // TSTB
			return void(this.mov8(this.b));
		case 0x5f: // CLRB
			return void(this.b = this.clr8());
		case 0x60: // NEG ,r
			return ea = this.index(), this.write8(this.neg8(this.read(ea)), ea);
		case 0x63: // COM ,r
			return ea = this.index(), this.write8(this.com8(this.read(ea)), ea);
		case 0x64: // LSR ,r
			return ea = this.index(), this.write8(this.lsr8(this.read(ea)), ea);
		case 0x66: // ROR ,r
			return ea = this.index(), this.write8(this.ror8(this.read(ea)), ea);
		case 0x67: // ASR ,r
			return ea = this.index(), this.write8(this.asr8(this.read(ea)), ea);
		case 0x68: // LSL ,r
			return ea = this.index(), this.write8(this.lsl8(this.read(ea)), ea);
		case 0x69: // ROL ,r
			return ea = this.index(), this.write8(this.rol8(this.read(ea)), ea);
		case 0x6a: // DEC ,r
			return ea = this.index(), this.write8(this.dec8(this.read(ea)), ea);
		case 0x6c: // INC ,r
			return ea = this.index(), this.write8(this.inc8(this.read(ea)), ea);
		case 0x6d: // TST ,r
			return void(this.mov8(this.read(this.index())));
		case 0x6e: // JMP ,r
			return void(this.pc = this.index());
		case 0x6f: // CLR ,r
			return this.write8(this.clr8(), this.index());
		case 0x70: // NEG >nn
			return ea = this.fetch16(), this.write8(this.neg8(this.read(ea)), ea);
		case 0x73: // COM >nn
			return ea = this.fetch16(), this.write8(this.com8(this.read(ea)), ea);
		case 0x74: // LSR >nn
			return ea = this.fetch16(), this.write8(this.lsr8(this.read(ea)), ea);
		case 0x76: // ROR >nn
			return ea = this.fetch16(), this.write8(this.ror8(this.read(ea)), ea);
		case 0x77: // ASR >nn
			return ea = this.fetch16(), this.write8(this.asr8(this.read(ea)), ea);
		case 0x78: // LSL >nn
			return ea = this.fetch16(), this.write8(this.lsl8(this.read(ea)), ea);
		case 0x79: // ROL >nn
			return ea = this.fetch16(), this.write8(this.rol8(this.read(ea)), ea);
		case 0x7a: // DEC >nn
			return ea = this.fetch16(), this.write8(this.dec8(this.read(ea)), ea);
		case 0x7c: // INC >nn
			return ea = this.fetch16(), this.write8(this.inc8(this.read(ea)), ea);
		case 0x7d: // TST >nn
			return void(this.mov8(this.read(this.fetch16())));
		case 0x7e: // JMP >nn
			return void(this.pc = this.fetch16());
		case 0x7f: // CLR >nn
			return this.write8(this.clr8(), this.fetch16());
		case 0x80: // SUBA #n
			return void(this.a = this.sub8(this.fetch(), this.a));
		case 0x81: // CMPA #n
			return void(this.sub8(this.fetch(), this.a));
		case 0x82: // SBCA #n
			return void(this.a = this.sbc8(this.fetch(), this.a));
		case 0x83: // SUBD #nn
			return void([this.a, this.b] = this.split(this.sub16(this.fetch16(), this.a << 8 | this.b)));
		case 0x84: // ANDA #n
			return void(this.a = this.mov8(this.a & this.fetch()));
		case 0x85: // BITA #n
			return void(this.mov8(this.a & this.fetch()));
		case 0x86: // LDA #n
			return void(this.a = this.mov8(this.fetch()));
		case 0x88: // EORA #n
			return void(this.a = this.mov8(this.a ^ this.fetch()));
		case 0x89: // ADCA #n
			return void(this.a = this.adc8(this.fetch(), this.a));
		case 0x8a: // ORA #n
			return void(this.a = this.mov8(this.a | this.fetch()));
		case 0x8b: // ADDA #n
			return void(this.a = this.add8(this.fetch(), this.a));
		case 0x8c: // CMPX #nn
			return void(this.sub16(this.fetch16(), this.x));
		case 0x8d: // BSR
			return this.bsr();
		case 0x8e: // LDX #nn
			return void(this.x = this.mov16(this.fetch16()));
		case 0x90: // SUBA <n
			return void(this.a = this.sub8(this.read(this.dp << 8 | this.fetch()), this.a));
		case 0x91: // CMPA <n
			return void(this.sub8(this.read(this.dp << 8 | this.fetch()), this.a));
		case 0x92: // SBCA <n
			return void(this.a = this.sbc8(this.read(this.dp << 8 | this.fetch()), this.a));
		case 0x93: // SUBD <n
			return void([this.a, this.b] = this.split(this.sub16(this.read16(this.dp << 8 | this.fetch()), this.a << 8 | this.b)));
		case 0x94: // ANDA <n
			return void(this.a = this.mov8(this.a & this.read(this.dp << 8 | this.fetch())));
		case 0x95: // BITA <n
			return void(this.mov8(this.a & this.read(this.dp << 8 | this.fetch())));
		case 0x96: // LDA <n
			return void(this.a = this.mov8(this.read(this.dp << 8 | this.fetch())));
		case 0x97: // STA <n
			return this.write8(this.mov8(this.a), this.dp << 8 | this.fetch());
		case 0x98: // EORA <n
			return void(this.a = this.mov8(this.a ^ this.read(this.dp << 8 | this.fetch())));
		case 0x99: // ADCA <n
			return void(this.a = this.adc8(this.read(this.dp << 8 | this.fetch()), this.a));
		case 0x9a: // ORA <n
			return void(this.a = this.mov8(this.a | this.read(this.dp << 8 | this.fetch())));
		case 0x9b: // ADDA <n
			return void(this.a = this.add8(this.read(this.dp << 8 | this.fetch()), this.a));
		case 0x9c: // CMPX <n
			return void(this.sub16(this.read16(this.dp << 8 | this.fetch()), this.x));
		case 0x9d: // JSR <n
			return this.jsr(this.dp << 8 | this.fetch());
		case 0x9e: // LDX <n
			return void(this.x = this.mov16(this.read16(this.dp << 8 | this.fetch())));
		case 0x9f: // STX <n
			return this.write16(this.mov16(this.x), this.dp << 8 | this.fetch());
		case 0xa0: // SUBA ,r
			return void(this.a = this.sub8(this.read(this.index()), this.a));
		case 0xa1: // CMPA ,r
			return void(this.sub8(this.read(this.index()), this.a));
		case 0xa2: // SBCA ,r
			return void(this.a = this.sbc8(this.read(this.index()), this.a));
		case 0xa3: // SUBD ,r
			return void([this.a, this.b] = this.split(this.sub16(this.read16(this.index()), this.a << 8 | this.b)));
		case 0xa4: // ANDA ,r
			return void(this.a = this.mov8(this.a & this.read(this.index())));
		case 0xa5: // BITA ,r
			return void(this.mov8(this.a & this.read(this.index())));
		case 0xa6: // LDA ,r
			return void(this.a = this.mov8(this.read(this.index())));
		case 0xa7: // STA ,r
			return this.write8(this.mov8(this.a), this.index());
		case 0xa8: // EORA ,r
			return void(this.a = this.mov8(this.a ^ this.read(this.index())));
		case 0xa9: // ADCA ,r
			return void(this.a = this.adc8(this.read(this.index()), this.a));
		case 0xaa: // ORA ,r
			return void(this.a = this.mov8(this.a | this.read(this.index())));
		case 0xab: // ADDA ,r
			return void(this.a = this.add8(this.read(this.index()), this.a));
		case 0xac: // CMPX ,r
			return void(this.sub16(this.read16(this.index()), this.x));
		case 0xad: // JSR ,r
			return this.jsr(this.index());
		case 0xae: // LDX ,r
			return void(this.x = this.mov16(this.read16(this.index())));
		case 0xaf: // STX ,r
			return this.write16(this.mov16(this.x), this.index());
		case 0xb0: // SUBA >nn
			return void(this.a = this.sub8(this.read(this.fetch16()), this.a));
		case 0xb1: // CMPA >nn
			return void(this.sub8(this.read(this.fetch16()), this.a));
		case 0xb2: // SBCA >nn
			return void(this.a = this.sbc8(this.read(this.fetch16()), this.a));
		case 0xb3: // SUBD >nn
			return void([this.a, this.b] = this.split(this.sub16(this.read16(this.fetch16()), this.a << 8 | this.b)));
		case 0xb4: // ANDA >nn
			return void(this.a = this.mov8(this.a & this.read(this.fetch16())));
		case 0xb5: // BITA >nn
			return void(this.mov8(this.a & this.read(this.fetch16())));
		case 0xb6: // LDA >nn
			return void(this.a = this.mov8(this.read(this.fetch16())));
		case 0xb7: // STA >nn
			return this.write8(this.mov8(this.a), this.fetch16());
		case 0xb8: // EORA >nn
			return void(this.a = this.mov8(this.a ^ this.read(this.fetch16())));
		case 0xb9: // ADCA >nn
			return void(this.a = this.adc8(this.read(this.fetch16()), this.a));
		case 0xba: // ORA >nn
			return void(this.a = this.mov8(this.a | this.read(this.fetch16())));
		case 0xbb: // ADDA >nn
			return void(this.a = this.add8(this.read(this.fetch16()), this.a));
		case 0xbc: // CMPX >nn
			return void(this.sub16(this.read16(this.fetch16()), this.x));
		case 0xbd: // JSR >nn
			return this.jsr(this.fetch16());
		case 0xbe: // LDX >nn
			return void(this.x = this.mov16(this.read16(this.fetch16())));
		case 0xbf: // STX >nn
			return this.write16(this.mov16(this.x), this.fetch16());
		case 0xc0: // SUBB #n
			return void(this.b = this.sub8(this.fetch(), this.b));
		case 0xc1: // CMPB #n
			return void(this.sub8(this.fetch(), this.b));
		case 0xc2: // SBCB #n
			return void(this.b = this.sbc8(this.fetch(), this.b));
		case 0xc3: // ADDD #nn
			return void([this.a, this.b] = this.split(this.add16(this.fetch16(), this.a << 8 | this.b)));
		case 0xc4: // ANDB #n
			return void(this.b = this.mov8(this.b & this.fetch()));
		case 0xc5: // BITB #n
			return void(this.mov8(this.b & this.fetch()));
		case 0xc6: // LDB #n
			return void(this.b = this.mov8(this.fetch()));
		case 0xc8: // EORB #n
			return void(this.b = this.mov8(this.b ^ this.fetch()));
		case 0xc9: // ADCB #n
			return void(this.b = this.adc8(this.fetch(), this.b));
		case 0xca: // ORB #n
			return void(this.b = this.mov8(this.b | this.fetch()));
		case 0xcb: // ADDB #n
			return void(this.b = this.add8(this.fetch(), this.b));
		case 0xcc: // LDD #nn
			return void([this.a, this.b] = this.split(this.mov16(this.fetch16())));
		case 0xce: // LDU #nn
			return void(this.u = this.mov16(this.fetch16()));
		case 0xd0: // SUBB <n
			return void(this.b = this.sub8(this.read(this.dp << 8 | this.fetch()), this.b));
		case 0xd1: // CMPB <n
			return void(this.sub8(this.read(this.dp << 8 | this.fetch()), this.b));
		case 0xd2: // SBCB <n
			return void(this.b = this.sbc8(this.read(this.dp << 8 | this.fetch()), this.b));
		case 0xd3: // ADDD <n
			return void([this.a, this.b] = this.split(this.add16(this.read16(this.dp << 8 | this.fetch()), this.a << 8 | this.b)));
		case 0xd4: // ANDB <n
			return void(this.b = this.mov8(this.b & this.read(this.dp << 8 | this.fetch())));
		case 0xd5: // BITB <n
			return void(this.mov8(this.b & this.read(this.dp << 8 | this.fetch())));
		case 0xd6: // LDB <n
			return void(this.b = this.mov8(this.read(this.dp << 8 | this.fetch())));
		case 0xd7: // STB <n
			return this.write8(this.mov8(this.b), this.dp << 8 | this.fetch());
		case 0xd8: // EORB <n
			return void(this.b = this.mov8(this.b ^ this.read(this.dp << 8 | this.fetch())));
		case 0xd9: // ADCB <n
			return void(this.b = this.adc8(this.read(this.dp << 8 | this.fetch()), this.b));
		case 0xda: // ORB <n
			return void(this.b = this.mov8(this.b | this.read(this.dp << 8 | this.fetch())));
		case 0xdb: // ADDB <n
			return void(this.b = this.add8(this.read(this.dp << 8 | this.fetch()), this.b));
		case 0xdc: // LDD <n
			return void([this.a, this.b] = this.split(this.mov16(this.read16(this.dp << 8 | this.fetch()))));
		case 0xdd: // STD <n
			return this.write16(this.mov16(this.a << 8 | this.b), this.dp << 8 | this.fetch());
		case 0xde: // LDU <n
			return void(this.u = this.mov16(this.read16(this.dp << 8 | this.fetch())));
		case 0xdf: // STU <n
			return this.write16(this.mov16(this.u), this.dp << 8 | this.fetch());
		case 0xe0: // SUBB ,r
			return void(this.b = this.sub8(this.read(this.index()), this.b));
		case 0xe1: // CMPB ,r
			return void(this.sub8(this.read(this.index()), this.b));
		case 0xe2: // SBCB ,r
			return void(this.b = this.sbc8(this.read(this.index()), this.b));
		case 0xe3: // ADDD ,r
			return void([this.a, this.b] = this.split(this.add16(this.read16(this.index()), this.a << 8 | this.b)));
		case 0xe4: // ANDB ,r
			return void(this.b = this.mov8(this.b & this.read(this.index())));
		case 0xe5: // BITB ,r
			return void(this.mov8(this.b & this.read(this.index())));
		case 0xe6: // LDB ,r
			return void(this.b = this.mov8(this.read(this.index())));
		case 0xe7: // STB ,r
			return this.write8(this.mov8(this.b), this.index());
		case 0xe8: // EORB ,r
			return void(this.b = this.mov8(this.b ^ this.read(this.index())));
		case 0xe9: // ADCB ,r
			return void(this.b = this.adc8(this.read(this.index()), this.b));
		case 0xea: // ORB ,r
			return void(this.b = this.mov8(this.b | this.read(this.index())));
		case 0xeb: // ADDB ,r
			return void(this.b = this.add8(this.read(this.index()), this.b));
		case 0xec: // LDD ,r
			return void([this.a, this.b] = this.split(this.mov16(this.read16(this.index()))));
		case 0xed: // STD ,r
			return this.write16(this.mov16(this.a << 8 | this.b), this.index());
		case 0xee: // LDU ,r
			return void(this.u = this.mov16(this.read16(this.index())));
		case 0xef: // STU ,r
			return this.write16(this.mov16(this.u), this.index());
		case 0xf0: // SUBB >nn
			return void(this.b = this.sub8(this.read(this.fetch16()), this.b));
		case 0xf1: // CMPB >nn
			return void(this.sub8(this.read(this.fetch16()), this.b));
		case 0xf2: // SBCB >nn
			return void(this.b = this.sbc8(this.read(this.fetch16()), this.b));
		case 0xf3: // ADDD >nn
			return void([this.a, this.b] = this.split(this.add16(this.read16(this.fetch16()), this.a << 8 | this.b)));
		case 0xf4: // ANDB >nn
			return void(this.b = this.mov8(this.b & this.read(this.fetch16())));
		case 0xf5: // BITB >nn
			return void(this.mov8(this.b & this.read(this.fetch16())));
		case 0xf6: // LDB >nn
			return void(this.b = this.mov8(this.read(this.fetch16())));
		case 0xf7: // STB >nn
			return this.write8(this.mov8(this.b), this.fetch16());
		case 0xf8: // EORB >nn
			return void(this.b = this.mov8(this.b ^ this.read(this.fetch16())));
		case 0xf9: // ADCB >nn
			return void(this.b = this.adc8(this.read(this.fetch16()), this.b));
		case 0xfa: // ORB >nn
			return void(this.b = this.mov8(this.b | this.read(this.fetch16())));
		case 0xfb: // ADDB >nn
			return void(this.b = this.add8(this.read(this.fetch16()), this.b));
		case 0xfc: // LDD >nn
			return void([this.a, this.b] = this.split(this.mov16(this.read16(this.fetch16()))));
		case 0xfd: // STD >nn
			return this.write16(this.mov16(this.a << 8 | this.b), this.fetch16());
		case 0xfe: // LDU >nn
			return void(this.u = this.mov16(this.read16(this.fetch16())));
		case 0xff: // STU >nn
			return this.write16(this.mov16(this.u), this.fetch16());
		default:
			this.undefsize = 1;
			this.undef();
			return;
		}
	}

	index() {
		let v, pb = this.fetch();
		this.cycle -= cc_i[pb];
		switch (pb) {
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
		case 0x13: // -$d,X
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
		case 0x2d: // $d,Y
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
		case 0x33: // -$d,Y
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
		case 0x4d: // $d,U
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
		case 0x53: // -$d,U
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
		case 0x6d: // $d,S
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
		case 0x73: // -$d,S
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
			return v = this.x, this.x = this.x + 1 & 0xffff, v;
		case 0x81: // ,X++
			return v = this.x, this.x = this.x + 2 & 0xffff, v;
		case 0x82: // ,-X
			return this.x = this.x - 1 & 0xffff;
		case 0x83: // ,--X
			return this.x = this.x - 2 & 0xffff;
		case 0x84: // ,X
			return this.x;
		case 0x85: // B,X
			return this.x + (this.b << 24 >> 24) & 0xffff;
		case 0x86: // A,X
			return this.x + (this.a << 24 >> 24) & 0xffff;
		case 0x88: // n,X
			return this.x + (this.fetch() << 24 >> 24) & 0xffff;
		case 0x89: // nn,X
			return this.x + this.fetch16() & 0xffff;
		case 0x8b: // D,X
			return this.x + (this.a << 8 | this.b) & 0xffff;
		case 0x91: // [,X++]
			return v = this.read16(this.x), this.x = this.x + 2 & 0xffff, v;
		case 0x93: // [,--X]
			return this.x = this.x - 2 & 0xffff, this.read16(this.x);
		case 0x94: // [,X]
			return this.read16(this.x);
		case 0x95: // [B,X]
			return this.read16(this.x + (this.b << 24 >> 24) & 0xffff);
		case 0x96: // [A,X]
			return this.read16(this.x + (this.a << 24 >> 24) & 0xffff);
		case 0x98: // [n,X]
			return this.read16(this.x + (this.fetch() << 24 >> 24) & 0xffff);
		case 0x99: // [nn,X]
			return this.read16(this.x + this.fetch16() & 0xffff);
		case 0x9b: // [D,X]
			return this.read16(this.x + (this.a << 8 | this.b) & 0xffff);
		case 0xa0: // ,Y+
			return v = this.y, this.y = this.y + 1 & 0xffff, v;
		case 0xa1: // ,Y++
			return v = this.y, this.y = this.y + 2 & 0xffff, v;
		case 0xa2: // ,-Y
			return this.y = this.y - 1 & 0xffff;
		case 0xa3: // ,--Y
			return this.y = this.y - 2 & 0xffff;
		case 0xa4: // ,Y
			return this.y;
		case 0xa5: // B,Y
			return this.y + (this.b << 24 >> 24) & 0xffff;
		case 0xa6: // A,Y
			return this.y + (this.a << 24 >> 24) & 0xffff;
		case 0xa8: // n,Y
			return this.y + (this.fetch() << 24 >> 24) & 0xffff;
		case 0xa9: // nn,Y
			return this.y + this.fetch16() & 0xffff;
		case 0xab: // D,Y
			return this.y + (this.a << 8 | this.b) & 0xffff;
		case 0xb1: // [,Y++]
			return v = this.read16(this.y), this.y = this.y + 2 & 0xffff, v;
		case 0xb3: // [,--Y]
			return this.y = this.y - 2 & 0xffff, this.read16(this.y);
		case 0xb4: // [,Y]
			return this.read16(this.y);
		case 0xb5: // [B,Y]
			return this.read16(this.y + (this.b << 24 >> 24) & 0xffff);
		case 0xb6: // [A,Y]
			return this.read16(this.y + (this.a << 24 >> 24) & 0xffff);
		case 0xb8: // [n,Y]
			return this.read16(this.y + (this.fetch() << 24 >> 24) & 0xffff);
		case 0xb9: // [nn,Y]
			return this.read16(this.y + this.fetch16() & 0xffff);
		case 0xbb: // [D,Y]
			return this.read16(this.y + (this.a << 8 | this.b) & 0xffff);
		case 0xc0: // ,U+
			return v = this.u, this.u = this.u + 1 & 0xffff, v;
		case 0xc1: // ,U++
			return v = this.u, this.u = this.u + 2 & 0xffff, v;
		case 0xc2: // ,-U
			return this.u = this.u - 1 & 0xffff;
		case 0xc3: // ,--u
			return this.u = this.u - 2 & 0xffff;
		case 0xc4: // ,U
			return this.u;
		case 0xc5: // B,U
			return this.u + (this.b << 24 >> 24) & 0xffff;
		case 0xc6: // A,U
			return this.u + (this.a << 24 >> 24) & 0xffff;
		case 0xc8: // n,U
			return this.u + (this.fetch() << 24 >> 24) & 0xffff;
		case 0xc9: // nn,U
			return this.u + this.fetch16() & 0xffff;
		case 0xcb: // D,U
			return this.u + (this.a << 8 | this.b) & 0xffff;
		case 0xd1: // [,U++]
			return v = this.read16(this.u), this.u = this.u + 2 & 0xffff, v;
		case 0xd3: // [,--U]
			return this.u = this.u - 2 & 0xffff, this.read16(this.u);
		case 0xd4: // [,U]
			return this.read16(this.u);
		case 0xd5: // [B,U]
			return this.read16(this.u + (this.b << 24 >> 24) & 0xffff);
		case 0xd6: // [A,U]
			return this.read16(this.u + (this.a << 24 >> 24) & 0xffff);
		case 0xd8: // [n,U]
			return this.read16(this.u + (this.fetch() << 24 >> 24) & 0xffff);
		case 0xd9: // [nn,U]
			return this.read16(this.u + this.fetch16() & 0xffff);
		case 0xdb: // [D,U]
			return this.read16(this.u + (this.a << 8 | this.b) & 0xffff);
		case 0xe0: // ,S+
			return v = this.s, this.s = this.s + 1 & 0xffff, v;
		case 0xe1: // ,S++
			return v = this.s, this.s = this.s + 2 & 0xffff, v;
		case 0xe2: // ,-S
			return this.s = this.s - 1 & 0xffff;
		case 0xe3: // ,--S
			return this.s = this.s - 2 & 0xffff;
		case 0xe4: // ,S
			return this.s;
		case 0xe5: // B,S
			return this.s + (this.b << 24 >> 24) & 0xffff;
		case 0xe6: // A,S
			return this.s + (this.a << 24 >> 24) & 0xffff;
		case 0xe8: // n,S
			return this.s + (this.fetch() << 24 >> 24) & 0xffff;
		case 0xe9: // nn,S
			return this.s + this.fetch16() & 0xffff;
		case 0xeb: // D,S
			return this.s + (this.a << 8 | this.b) & 0xffff;
		case 0xf1: // [,S++]
			return v = this.read16(this.s), this.s = this.s + 2 & 0xffff, v;
		case 0xf3: // [,--S]
			return this.s = this.s - 2 & 0xffff, this.read16(this.s);
		case 0xf4: // [,S]
			return this.read16(this.s);
		case 0xf5: // [B,S]
			return this.read16(this.s + (this.b << 24 >> 24) & 0xffff);
		case 0xf6: // [A,S]
			return this.read16(this.s + (this.a << 24 >> 24) & 0xffff);
		case 0xf8: // [n,S]
			return this.read16(this.s + (this.fetch() << 24 >> 24) & 0xffff);
		case 0xf9: // [nn,S]
			return this.read16(this.s + this.fetch16() & 0xffff);
		case 0xfb: // [D,S]
			return this.read16(this.s + (this.a << 8 | this.b) & 0xffff);
		case 0x8c: case 0xac: case 0xcc: case 0xec: // n,PC
			return v = this.fetch(), this.pc + (v << 24 >> 24) & 0xffff;
		case 0x8d: case 0xad: case 0xcd: case 0xed: // nn,PC
			return v = this.fetch16(), this.pc + v & 0xffff;
		case 0x9c: case 0xbc: case 0xdc: case 0xfc: // [n,PC]
			return v = this.fetch(), this.read16(this.pc + (v << 24 >> 24) & 0xffff);
		case 0x9d: case 0xbd: case 0xdd: case 0xfd: // [nn,PC]
			return v = this.fetch16(), this.read16(this.pc + v & 0xffff);
		case 0x9f: case 0xbf: case 0xdf: case 0xff: // [nn]
			return this.read16(this.fetch16());
		default:
			return 0xffffffff;
		}
	}

	lbcc(cond) {
		const nn = this.fetch16();
		this.cycle -= cond ? 2 : 1, cond && (this.pc = this.pc + nn & 0xffff);
	}

	lbsr() {
		const nn = this.fetch16();
		this.pshs16(this.pc), this.pc = this.pc + nn & 0xffff;
	}

	bcc(cond) {
		const n = this.fetch();
		if (cond) this.pc = this.pc + (n << 24 >> 24) & 0xffff;
	}

	bsr() {
		const n = this.fetch();
		this.pshs16(this.pc), this.pc = this.pc + (n << 24 >> 24) & 0xffff;
	}

	neg8(dst) {
		const r = -dst & 0xff, v = dst & r, c = dst | r;
		return this.ccr = this.ccr & ~0x0f | r >> 4 & 8 | !r << 2 | v >> 6 & 2 | c >> 7 & 1, r;
	}

	com8(dst) {
		const r = ~dst & 0xff;
		return this.ccr = this.ccr & ~0x0f | r >> 4 & 8 | !r << 2 | 1, r;
	}

	lsr8(dst) {
		const r = dst >> 1, c = dst & 1;
		return this.ccr = this.ccr & ~0x0d | !r << 2 | c, r;
	}

	ror8(dst) {
		const r = dst >> 1 | this.ccr << 7 & 0x80, c = dst & 1;
		return this.ccr = this.ccr & ~0x0d | r >> 4 & 8 | !r << 2 | c, r;
	}

	asr8(dst) {
		const r = dst >> 1 | dst & 0x80, c = dst & 1;
		return this.ccr = this.ccr & ~0x0d | r >> 4 & 8 | !r << 2 | c, r;
	}

	lsl8(dst) {
		const r = dst << 1 & 0xff, c = dst >> 7, v = r >> 7 ^ c;
		return this.ccr = this.ccr & ~0x0f | r >> 4 & 8 | !r << 2 | v << 1 | c, r;
	}

	rol8(dst) {
		const r = dst << 1 & 0xff | this.ccr & 1, c = dst >> 7, v = r >> 7 ^ c;
		return this.ccr = this.ccr & ~0x0f | r >> 4 & 8 | !r << 2 | v << 1 | c, r;
	}

	dec8(dst) {
		const r = dst - 1 & 0xff, v = dst & ~1 & ~r | ~dst & 1 & r;
		return this.ccr = this.ccr & ~0x0e | r >> 4 & 8 | !r << 2 | v >> 6 & 2, r;
	}

	inc8(dst) {
		const r = dst + 1 & 0xff, v = dst & 1 & ~r | ~dst & ~1 & r;
		return this.ccr = this.ccr & ~0x0e | r >> 4 & 8 | !r << 2 | v >> 6 & 2, r;
	}

	clr8() {
		return this.ccr = this.ccr & ~0x0f | 4, 0;
	}

	sub8(src, dst) {
		const r = dst - src & 0xff, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		return this.ccr = this.ccr & ~0x0f | r >> 4 & 8 | !r << 2 | v >> 6 & 2 | c >> 7 & 1, r;
	}

	sub16(src, dst) {
		const r = dst - src & 0xffff, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		return this.ccr = this.ccr & ~0x0f | r >> 12 & 8 | !r << 2 | v >> 14 & 2 | c >> 15 & 1, r;
	}

	sbc8(src, dst) {
		const r = dst - src - (this.ccr & 1) & 0xff, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		return this.ccr = this.ccr & ~0x0f | r >> 4 & 8 | !r << 2 | v >> 6 & 2 | c >> 7 & 1, r;
	}

	mov8(src) {
		return this.ccr = this.ccr & ~0x0e | src >> 4 & 8 | !src << 2, src;
	}

	mov16(src) {
		return this.ccr = this.ccr & ~0x0e | src >> 12 & 8 | !src << 2, src;
	}

	adc8(src, dst) {
		const r = dst + src + (this.ccr & 1) & 0xff, v = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		return this.ccr = this.ccr & ~0x2f | c << 2 & 0x20 | r >> 4 & 8 | !r << 2 | v >> 6 & 2 | c >> 7 & 1, r;
	}

	add8(src, dst) {
		const r = dst + src & 0xff, v = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		return this.ccr = this.ccr & ~0x2f | c << 2 & 0x20 | r >> 4 & 8 | !r << 2 | v >> 6 & 2 | c >> 7 & 1, r;
	}

	add16(src, dst) {
		const r = dst + src & 0xffff, v = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		return this.ccr = this.ccr & ~0x0f | r >> 12 & 8 | !r << 2 | v >> 14 & 2 | c >> 15 & 1, r;
	}

	daa() {
		let cf = 0;
		if (this.ccr & 0x20 || (this.a & 0xf) > 9)
			cf += 6;
		if (this.ccr & 1 || (this.a & 0xf0) > 0x90 || (this.a & 0xf0) > 0x80 && (this.a & 0xf) > 9)
			cf += 0x60, this.ccr |= 1;
		this.a = this.a + cf & 0xff, this.ccr = this.ccr & ~0x0c | this.a >> 4 & 8 | !this.a << 2;
	}

	jsr(ea) {
		this.pshs16(this.pc), this.pc = ea;
	}

	pshs(...args) {
		args.forEach(e => (this.s = this.s - 1 & 0xffff, this.write8(e, this.s)));
	}

	pshu(...args) {
		args.forEach(e => (this.u = this.u - 1 & 0xffff, this.write8(e, this.u)));
	}

	puls() {
		const r = this.read(this.s);
		return this.s = this.s + 1 & 0xffff, r;
	}

	pulu() {
		const r = this.read(this.u);
		return this.u = this.u + 1 & 0xffff, r;
	}

	pshs16(...args) {
		args.forEach(e => this.pshs(e & 0xff, e >> 8));
	}

	pshu16(r) {
		this.pshu(r & 0xff, r >> 8);
	}

	puls16() {
		const r = this.puls() << 8;
		return r | this.puls();
	}

	pulu16() {
		const r = this.pulu() << 8;
		return r | this.pulu();
	}

	split(v) {
		return [v >> 8, v & 0xff];
	}

	fetch16() {
		const data = this.fetch() << 8;
		return data | this.fetch();
	}

	read16(addr) {
		const data = this.read(addr) << 8;
		return data | this.read(addr + 1 & 0xffff);
	}

	write8(data, addr) {
		const page = this.memorymap[addr >> 8];
		!page.write ? void(page.base[addr & 0xff] = data) : page.write(addr, data);
	}

	write16(data, addr) {
		this.write8(data >> 8, addr), this.write8(data & 0xff, addr + 1 & 0xffff);
	}
}

const cc = Uint8Array.of(
	 6, 0, 0, 6, 6, 0, 6, 6, 6, 6, 6, 0, 6, 6, 3, 6,
	 1, 1, 2, 2, 0, 0, 3, 9, 0, 2, 3, 0, 3, 2, 8, 7,
	 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
	 4, 4, 4, 4, 5, 5, 5, 5, 0, 5, 3, 6,20,11, 0,19,
	 2, 0, 0, 2, 2, 0, 2, 2, 2, 2, 2, 0, 2, 2, 0, 2,
	 2, 0, 0, 2, 2, 0, 2, 2, 2, 2, 2, 0, 2, 2, 0, 2,
	 6, 0, 0, 6, 6, 0, 6, 6, 6, 6, 6, 0, 6, 6, 3, 6,
	 7, 0, 0, 7, 7, 0, 7, 7, 7, 7, 7, 0, 7, 7, 4, 7,
	 2, 2, 2, 4, 2, 2, 2, 0, 2, 2, 2, 2, 4, 7, 3, 0,
	 4, 4, 4, 6, 4, 4, 4, 4, 4, 4, 4, 4, 6, 7, 5, 5,
	 4, 4, 4, 6, 4, 4, 4, 4, 4, 4, 4, 4, 6, 7, 5, 5,
	 5, 5, 5, 7, 5, 5, 5, 5, 5, 5, 5, 5, 7, 8, 6, 6,
	 2, 2, 2, 4, 2, 2, 2, 0, 2, 2, 2, 2, 3, 0, 3, 0,
	 4, 4, 4, 6, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5,
	 4, 4, 4, 6, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5,
	 5, 5, 5, 7, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6);

const cc_i = Uint8Array.of(
	 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 2, 3, 2, 3, 0, 1, 1, 0, 1, 4, 0, 4, 1, 5, 0, 0,
	 0, 6, 0, 6, 3, 4, 4, 0, 4, 7, 0, 7, 4, 8, 0, 5,
	 2, 3, 2, 3, 0, 1, 1, 0, 1, 4, 0, 4, 1, 5, 0, 0,
	 0, 6, 0, 6, 3, 4, 4, 0, 4, 7, 0, 7, 4, 8, 0, 5,
	 2, 3, 2, 3, 0, 1, 1, 0, 1, 4, 0, 4, 1, 5, 0, 0,
	 0, 6, 0, 6, 3, 4, 4, 0, 4, 7, 0, 7, 4, 8, 0, 5,
	 2, 3, 2, 3, 0, 1, 1, 0, 1, 4, 0, 4, 1, 5, 0, 0,
	 0, 6, 0, 6, 3, 4, 4, 0, 4, 7, 0, 7, 4, 8, 0, 5);
