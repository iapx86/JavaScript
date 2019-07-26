/*
 *
 *	MC68000 Emulator
 *
 */

import Cpu, {dummypage} from './main.js';

export default class MC68000 extends Cpu {
	constructor(arg = null) {
		super(arg);
		this.d0 = 0;
		this.d1 = 0;
		this.d2 = 0;
		this.d3 = 0;
		this.d4 = 0;
		this.d5 = 0;
		this.d6 = 0;
		this.d7 = 0;
		this.a0 = 0;
		this.a1 = 0;
		this.a2 = 0;
		this.a3 = 0;
		this.a4 = 0;
		this.a5 = 0;
		this.a6 = 0;
		this.a7 = 0;
		this.ssp = 0;
		this.usp = 0;
		this.sr = 0; // sr:t-s--iii ccr:---xnzvc
		this.memorymap.splice(0);
		for (let i = 0; i < 0x10000; i++)
			this.memorymap.push({base: dummypage, read: null, read16: null, write: () => {}, write16: null});
		this.breakpointmap = new Uint32Array(0x80000);
	}

	reset() {
		super.reset();
		this.sr = 0x2700;
		this.a7 = this.read32(0);
		this.pc = this.read32(4);
	}

	interrupt(ipl) {
		if (!super.interrupt() || ipl < 7 && ipl <= (this.sr >>> 8 & 7))
			return false;
		this.exception(24 + ipl);
		this.sr = this.sr & ~0x0700 | ipl << 8;
		return true;
	}

	exception(vector) {
		if ((this.sr & 0x2000) === 0)
			[this.usp, this.a7] = [this.a7, this.ssp];
		this.write32(this.pc, this.a7 = this.a7 - 4 | 0);
		this.write16(this.sr, this.a7 = this.a7 - 2 | 0);
		this.pc = this.read32(vector << 2);
		this.sr = this.sr & ~0x8000 | 0x2000;
	}

	_execute() {
		const op = this.fetch16();

		switch (op >>> 12) {
		case 0x0: // Bit Manipulation/MOVEP/Immediate
			return void this.execute_0(op);
		case 0x1: // Move Byte
			return void this.execute_1(op);
		case 0x2: // Move Long
			return void this.execute_2(op);
		case 0x3: // Move Word
			return void this.execute_3(op);
		case 0x4: // Miscellaneous
			return void this.execute_4(op);
		case 0x5: // ADDQ/SUBQ/Scc/DBcc
			return void this.execute_5(op);
		case 0x6: // Bcc/BSR
			return void this.execute_6(op);
		case 0x7: // MOVEQ
			return void this.execute_7(op);
		case 0x8: // OR/DIV/SBCD
			return void this.execute_8(op);
		case 0x9: // SUB/SUBX
			return void this.execute_9(op);
		case 0xa: // (Unassigned)
			return void this.exception(10);
		case 0xb: // CMP/EOR
			return void this.execute_b(op);
		case 0xc: // AND/MUL/ABCD/EXG
			return void this.execute_c(op);
		case 0xd: // ADD/ADDX
			return void this.execute_d(op);
		case 0xe: // Shift/Rotate
			return void this.execute_e(op);
		case 0xf: // (Unassigned)
			return void this.exception(11);
		}
	}

	execute_0(op) {
		switch (op >>> 3 & 0o777) {
		case 0o000: // ORI.B #<data>,Dn
		case 0o002: // ORI.B #<data>,(An)
		case 0o003: // ORI.B #<data>,(An)+
		case 0o004: // ORI.B #<data>,-(An)
		case 0o005: // ORI.B #<data>,d(An)
		case 0o006: // ORI.B #<data>,d(An,Xi)
			return void this.rwop8(op, this.or8, this.fetch16());
		case 0o007:
			switch (op & 7) {
			case 0: // ORI.B #<data>,Abs.W
			case 1: // ORI.B #<data>,Abs.L
				return void this.rwop8(op, this.or8, this.fetch16());
			case 4: // ORI #<data>,CCR
				return void(this.sr |= this.fetch16() & 0xff);
			default:
				return void this.exception(4);
			}
		case 0o010: // ORI.W #<data>,Dn
		case 0o012: // ORI.W #<data>,(An)
		case 0o013: // ORI.W #<data>,(An)+
		case 0o014: // ORI.W #<data>,-(An)
		case 0o015: // ORI.W #<data>,d(An)
		case 0o016: // ORI.W #<data>,d(An,Xi)
			return void this.rwop16(op, this.or16, this.fetch16());
		case 0o017:
			switch (op & 7) {
			case 0: // ORI.W #<data>,Abs.W
			case 1: // ORI.W #<data>,Abs.L
				return void this.rwop16(op, this.or16, this.fetch16());
			case 4: // ORI #<data>,SR
				if ((this.sr & 0x2000) === 0)
					return void this.exception(8);
				return void(this.sr |= this.fetch16());
			default:
				return void this.exception(4);
			}
		case 0o020: // ORI.L #<data>,Dn
		case 0o022: // ORI.L #<data>,(An)
		case 0o023: // ORI.L #<data>,(An)+
		case 0o024: // ORI.L #<data>,-(An)
		case 0o025: // ORI.L #<data>,d(An)
		case 0o026: // ORI.L #<data>,d(An,Xi)
			return void this.rwop32(op, this.or32, this.fetch32());
		case 0o027: // ORI.L #<data>,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.or32, this.fetch32());
		case 0o040: // BTST D0,Dn
			return void this.btst32(this.d0, this.rop32(op));
		case 0o041: // MOVEP.W d(Ay),D0
			return void(this.d0 = this.d0 & ~0xffff | this.movep(op));
		case 0o042: // BTST D0,(An)
		case 0o043: // BTST D0,(An)+
		case 0o044: // BTST D0,-(An)
		case 0o045: // BTST D0,d(An)
		case 0o046: // BTST D0,d(An,Xi)
			return void this.btst8(this.d0, this.rop8(op));
		case 0o047: // BTST D0,Abs...
			if ((op & 7) >= 4)
				return void this.exception(4);
			return void this.btst8(this.d0, this.rop8(op));
		case 0o050: // BCHG D0,Dn
			return void this.rwop32(op, this.bchg32, this.d0);
		case 0o051: // MOVEP.L d(Ay),D0
			return void(this.d0 = this.movep(op));
		case 0o052: // BCHG D0,(An)
		case 0o053: // BCHG D0,(An)+
		case 0o054: // BCHG D0,-(An)
		case 0o055: // BCHG D0,d(An)
		case 0o056: // BCHG D0,d(An,Xi)
			return void this.rwop8(op, this.bchg8, this.d0);
		case 0o057: // BCHG D0,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bchg8, this.d0);
		case 0o060: // BCLR D0,Dn
			return void this.rwop32(op, this.bclr32, this.d0);
		case 0o061: // MOVEP.W D0,d(Ay)
			return void this.movep(op, this.d0);
		case 0o062: // BCLR D0,(An)
		case 0o063: // BCLR D0,(An)+
		case 0o064: // BCLR D0,-(An)
		case 0o065: // BCLR D0,d(An)
		case 0o066: // BCLR D0,d(An,Xi)
			return void this.rwop8(op, this.bclr8, this.d0);
		case 0o067: // BCLR D0,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bclr8, this.d0);
		case 0o070: // BSET D0,Dn
			return void this.rwop32(op, this.bset32, this.d0);
		case 0o071: // MOVEP.L D0,d(Ay)
			return void this.movep(op, this.d0);
		case 0o072: // BSET D0,(An)
		case 0o073: // BSET D0,(An)+
		case 0o074: // BSET D0,-(An)
		case 0o075: // BSET D0,d(An)
		case 0o076: // BSET D0,d(An,Xi)
			return void this.rwop8(op, this.bset8, this.d0);
		case 0o077: // BSET D0,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bset8, this.d0);
		case 0o100: // ANDI.B #<data>,Dn
		case 0o102: // ANDI.B #<data>,(An)
		case 0o103: // ANDI.B #<data>,(An)+
		case 0o104: // ANDI.B #<data>,-(An)
		case 0o105: // ANDI.B #<data>,d(An)
		case 0o106: // ANDI.B #<data>,d(An,Xi)
			return void this.rwop8(op, this.and8, this.fetch16());
		case 0o107:
			switch (op & 7) {
			case 0: // ANDI.B #<data>,Abs.W
			case 1: // ANDI.B #<data>,Abs.L
				return void this.rwop8(op, this.and8, this.fetch16());
			case 4: // ANDI #<data>,CCR
				return void(this.sr &= this.fetch16() | ~0xff);
			default:
				return void this.exception(4);
			}
		case 0o110: // ANDI.W #<data>,Dn
		case 0o112: // ANDI.W #<data>,(An)
		case 0o113: // ANDI.W #<data>,(An)+
		case 0o114: // ANDI.W #<data>,-(An)
		case 0o115: // ANDI.W #<data>,d(An)
		case 0o116: // ANDI.W #<data>,d(An,Xi)
			return void this.rwop16(op, this.and16, this.fetch16());
		case 0o117:
			switch (op & 7) {
			case 0: // ANDI.W #<data>,Abs.W
			case 1: // ANDI.W #<data>,Abs.L
				return void this.rwop16(op, this.and16, this.fetch16());
			case 4: // ANDI #<data>,SR
				if ((this.sr & 0x2000) === 0)
					return void this.exception(8);
				this.sr &= this.fetch16();
				if ((this.sr & 0x2000) === 0)
					[this.ssp, this.a7] = [this.a7, this.usp];
				return;
			default:
				return void this.exception(4);
			}
		case 0o120: // ANDI.L #<data>,Dn
		case 0o122: // ANDI.L #<data>,(An)
		case 0o123: // ANDI.L #<data>,(An)+
		case 0o124: // ANDI.L #<data>,-(An)
		case 0o125: // ANDI.L #<data>,d(An)
		case 0o126: // ANDI.L #<data>,d(An,Xi)
			return void this.rwop32(op, this.and32, this.fetch32());
		case 0o127: // ANDI.L #<data>,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.and32, this.fetch32());
		case 0o140: // BTST D1,Dn
			return void this.btst32(this.d1, this.rop32(op));
		case 0o141: // MOVEP.W d(Ay),D1
			return void(this.d1 = this.d1 & ~0xffff | this.movep(op));
		case 0o142: // BTST D1,(An)
		case 0o143: // BTST D1,(An)+
		case 0o144: // BTST D1,-(An)
		case 0o145: // BTST D1,d(An)
		case 0o146: // BTST D1,d(An,Xi)
			return void this.btst8(this.d1, this.rop8(op));
		case 0o147: // BTST D1,Abs...
			if ((op & 7) >= 4)
				return void this.exception(4);
			return void this.btst8(this.d1, this.rop8(op));
		case 0o150: // BCHG D1,Dn
			return void this.rwop32(op, this.bchg32, this.d1);
		case 0o151: // MOVEP.L d(Ay),D1
			return void(this.d1 = this.movep(op));
		case 0o152: // BCHG D1,(An)
		case 0o153: // BCHG D1,(An)+
		case 0o154: // BCHG D1,-(An)
		case 0o155: // BCHG D1,d(An)
		case 0o156: // BCHG D1,d(An,Xi)
			return void this.rwop8(op, this.bchg8, this.d1);
		case 0o157: // BCHG D1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bchg8, this.d1);
		case 0o160: // BCLR D1,Dn
			return void this.rwop32(op, this.bclr32, this.d1);
		case 0o161: // MOVEP.W D1,d(Ay)
			return void this.movep(op, this.d1);
		case 0o162: // BCLR D1,(An)
		case 0o163: // BCLR D1,(An)+
		case 0o164: // BCLR D1,-(An)
		case 0o165: // BCLR D1,d(An)
		case 0o166: // BCLR D1,d(An,Xi)
			return void this.rwop8(op, this.bclr8, this.d1);
		case 0o167: // BCLR D1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bclr8, this.d1);
		case 0o170: // BSET D1,Dn
			return void this.rwop32(op, this.bset32, this.d1);
		case 0o171: // MOVEP.L D1,d(Ay)
			return void this.movep(op, this.d1);
		case 0o172: // BSET D1,(An)
		case 0o173: // BSET D1,(An)+
		case 0o174: // BSET D1,-(An)
		case 0o175: // BSET D1,d(An)
		case 0o176: // BSET D1,d(An,Xi)
			return void this.rwop8(op, this.bset8, this.d1);
		case 0o177: // BSET D1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bset8, this.d1);
		case 0o200: // SUBI.B #<data>,Dn
		case 0o202: // SUBI.B #<data>,(An)
		case 0o203: // SUBI.B #<data>,(An)+
		case 0o204: // SUBI.B #<data>,-(An)
		case 0o205: // SUBI.B #<data>,d(An)
		case 0o206: // SUBI.B #<data>,d(An,Xi)
			return void this.rwop8(op, this.sub8, this.fetch16());
		case 0o207: // SUBI.B #<data>,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.sub8, this.fetch16());
		case 0o210: // SUBI.W #<data>,Dn
		case 0o212: // SUBI.W #<data>,(An)
		case 0o213: // SUBI.W #<data>,(An)+
		case 0o214: // SUBI.W #<data>,-(An)
		case 0o215: // SUBI.W #<data>,d(An)
		case 0o216: // SUBI.W #<data>,d(An,Xi)
			return void this.rwop16(op, this.sub16, this.fetch16());
		case 0o217: // SUBI.W #<data>,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.sub16, this.fetch16());
		case 0o220: // SUBI.L #<data>,Dn
		case 0o222: // SUBI.L #<data>,(An)
		case 0o223: // SUBI.L #<data>,(An)+
		case 0o224: // SUBI.L #<data>,-(An)
		case 0o225: // SUBI.L #<data>,d(An)
		case 0o226: // SUBI.L #<data>,d(An,Xi)
			return void this.rwop32(op, this.sub32, this.fetch32());
		case 0o227: // SUBI.L #<data>,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.sub32, this.fetch32());
		case 0o240: // BTST D2,Dn
			return void this.btst32(this.d2, this.rop32(op));
		case 0o241: // MOVEP.W d(Ay),D2
			return void(this.d2 = this.d2 & ~0xffff | this.movep(op));
		case 0o242: // BTST D2,(An)
		case 0o243: // BTST D2,(An)+
		case 0o244: // BTST D2,-(An)
		case 0o245: // BTST D2,d(An)
		case 0o246: // BTST D2,d(An,Xi)
			return void this.btst8(this.d2, this.rop8(op));
		case 0o247: // BTST D2,Abs...
			if ((op & 7) >= 4)
				return void this.exception(4);
			return void this.btst8(this.d2, this.rop8(op));
		case 0o250: // BCHG D2,Dn
			return void this.rwop32(op, this.bchg32, this.d2);
		case 0o251: // MOVEP.L d(Ay),D2
			return void(this.d2 = this.movep(op));
		case 0o252: // BCHG D2,(An)
		case 0o253: // BCHG D2,(An)+
		case 0o254: // BCHG D2,-(An)
		case 0o255: // BCHG D2,d(An)
		case 0o256: // BCHG D2,d(An,Xi)
			return void this.rwop8(op, this.bchg8, this.d2);
		case 0o257: // BCHG D2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bchg8, this.d2);
		case 0o260: // BCLR D2,Dn
			return void this.rwop32(op, this.bclr32, this.d2);
		case 0o261: // MOVEP.W D2,d(Ay)
			return void this.movep(op, this.d2);
		case 0o262: // BCLR D2,(An)
		case 0o263: // BCLR D2,(An)+
		case 0o264: // BCLR D2,-(An)
		case 0o265: // BCLR D2,d(An)
		case 0o266: // BCLR D2,d(An,Xi)
			return void this.rwop8(op, this.bclr8, this.d2);
		case 0o267: // BCLR D2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bclr8, this.d2);
		case 0o270: // BSET D2,Dn
			return void this.rwop32(op, this.bset32, this.d2);
		case 0o271: // MOVEP.L D2,d(Ay)
			return void this.movep(op, this.d2);
		case 0o272: // BSET D2,(An)
		case 0o273: // BSET D2,(An)+
		case 0o274: // BSET D2,-(An)
		case 0o275: // BSET D2,d(An)
		case 0o276: // BSET D2,d(An,Xi)
			return void this.rwop8(op, this.bset8, this.d2);
		case 0o277: // BSET D2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bset8, this.d2);
		case 0o300: // ADDI.B #<data>,Dn
		case 0o302: // ADDI.B #<data>,(An)
		case 0o303: // ADDI.B #<data>,(An)+
		case 0o304: // ADDI.B #<data>,-(An)
		case 0o305: // ADDI.B #<data>,d(An)
		case 0o306: // ADDI.B #<data>,d(An,Xi)
			return void this.rwop8(op, this.add8, this.fetch16());
		case 0o307: // ADDI.B #<data>,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.add8, this.fetch16());
		case 0o310: // ADDI.W #<data>,Dn
		case 0o312: // ADDI.W #<data>,(An)
		case 0o313: // ADDI.W #<data>,(An)+
		case 0o314: // ADDI.W #<data>,-(An)
		case 0o315: // ADDI.W #<data>,d(An)
		case 0o316: // ADDI.W #<data>,d(An,Xi)
			return void this.rwop16(op, this.add16, this.fetch16());
		case 0o317: // ADDI.W #<data>,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.add16, this.fetch16());
		case 0o320: // ADDI.L #<data>,Dn
		case 0o322: // ADDI.L #<data>,(An)
		case 0o323: // ADDI.L #<data>,(An)+
		case 0o324: // ADDI.L #<data>,-(An)
		case 0o325: // ADDI.L #<data>,d(An)
		case 0o326: // ADDI.L #<data>,d(An,Xi)
			return void this.rwop32(op, this.add32, this.fetch32());
		case 0o327: // ADDI.L #<data>,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.add32, this.fetch32());
		case 0o340: // BTST D3,Dn
			return void this.btst32(this.d3, this.rop32(op));
		case 0o341: // MOVEP.W d(Ay),D3
			return void(this.d3 = this.d3 & ~0xffff | this.movep(op));
		case 0o342: // BTST D3,(An)
		case 0o343: // BTST D3,(An)+
		case 0o344: // BTST D3,-(An)
		case 0o345: // BTST D3,d(An)
		case 0o346: // BTST D3,d(An,Xi)
			return void this.btst8(this.d3, this.rop8(op));
		case 0o347: // BTST D3,Abs...
			if ((op & 7) >= 4)
				return void this.exception(4);
			return void this.btst8(this.d3, this.rop8(op));
		case 0o350: // BCHG D3,Dn
			return void this.rwop32(op, this.bchg32, this.d3);
		case 0o351: // MOVEP.L d(Ay),D3
			return void(this.d3 = this.movep(op));
		case 0o352: // BCHG D3,(An)
		case 0o353: // BCHG D3,(An)+
		case 0o354: // BCHG D3,-(An)
		case 0o355: // BCHG D3,d(An)
		case 0o356: // BCHG D3,d(An,Xi)
			return void this.rwop8(op, this.bchg8, this.d3);
		case 0o357: // BCHG D3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bchg8, this.d3);
		case 0o360: // BCLR D3,Dn
			return void this.rwop32(op, this.bclr32, this.d3);
		case 0o361: // MOVEP.W D3,d(Ay)
			return void this.movep(op, this.d3);
		case 0o362: // BCLR D3,(An)
		case 0o363: // BCLR D3,(An)+
		case 0o364: // BCLR D3,-(An)
		case 0o365: // BCLR D3,d(An)
		case 0o366: // BCLR D3,d(An,Xi)
			return void this.rwop8(op, this.bclr8, this.d3);
		case 0o367: // BCLR D3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bclr8, this.d3);
		case 0o370: // BSET D3,Dn
			return void this.rwop32(op, this.bset32, this.d3);
		case 0o371: // MOVEP.L D3,d(Ay)
			return void this.movep(op, this.d3);
		case 0o372: // BSET D3,(An)
		case 0o373: // BSET D3,(An)+
		case 0o374: // BSET D3,-(An)
		case 0o375: // BSET D3,d(An)
		case 0o376: // BSET D3,d(An,Xi)
			return void this.rwop8(op, this.bset8, this.d3);
		case 0o377: // BSET D3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bset8, this.d3);
		case 0o400: // BTST #<data>,Dn
			return void this.btst32(this.fetch16(), this.rop32(op));
		case 0o402: // BTST #<data>,(An)
		case 0o403: // BTST #<data>,(An)+
		case 0o404: // BTST #<data>,-(An)
		case 0o405: // BTST #<data>,d(An)
		case 0o406: // BTST #<data>,d(An,Xi)
			return void this.btst8(this.fetch16(), this.rop8(op));
		case 0o407: // BTST #<data>,Abs...
			if ((op & 7) >= 4)
				return void this.exception(4);
			return void this.btst8(this.fetch16(), this.rop8(op));
		case 0o410: // BCHG #<data>,Dn
			return void this.rwop32(op, this.bchg32, this.fetch16());
		case 0o412: // BCHG #<data>,(An)
		case 0o413: // BCHG #<data>,(An)+
		case 0o414: // BCHG #<data>,-(An)
		case 0o415: // BCHG #<data>,d(An)
		case 0o416: // BCHG #<data>,d(An,Xi)
			return void this.rwop8(op, this.bchg8, this.fetch16());
		case 0o417: // BCHG #<data>,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bchg8, this.fetch16());
		case 0o420: // BCLR #<data>,Dn
			return void this.rwop32(op, this.bclr32, this.fetch16());
		case 0o422: // BCLR #<data>,(An)
		case 0o423: // BCLR #<data>,(An)+
		case 0o424: // BCLR #<data>,-(An)
		case 0o425: // BCLR #<data>,d(An)
		case 0o426: // BCLR #<data>,d(An,Xi)
			return void this.rwop8(op, this.bclr8, this.fetch16());
		case 0o427: // BCLR #<data>,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bclr8, this.fetch16());
		case 0o430: // BSET #<data>,Dn
			return void this.rwop32(op, this.bset32, this.fetch16());
		case 0o432: // BSET #<data>,(An)
		case 0o433: // BSET #<data>,(An)+
		case 0o434: // BSET #<data>,-(An)
		case 0o435: // BSET #<data>,d(An)
		case 0o436: // BSET #<data>,d(An,Xi)
			return void this.rwop8(op, this.bset8, this.fetch16());
		case 0o437: // BSET #<data>,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bset8, this.fetch16());
		case 0o440: // BTST D4,Dn
			return void this.btst32(this.d4, this.rop32(op));
		case 0o441: // MOVEP.W d(Ay),D4
			return void(this.d4 = this.d4 & ~0xffff | this.movep(op));
		case 0o442: // BTST D4,(An)
		case 0o443: // BTST D4,(An)+
		case 0o444: // BTST D4,-(An)
		case 0o445: // BTST D4,d(An)
		case 0o446: // BTST D4,d(An,Xi)
			return void this.btst8(this.d4, this.rop8(op));
		case 0o447: // BTST D4,Abs...
			if ((op & 7) >= 4)
				return void this.exception(4);
			return void this.btst8(this.d4, this.rop8(op));
		case 0o450: // BCHG D4,Dn
			return void this.rwop32(op, this.bchg32, this.d4);
		case 0o451: // MOVEP.L d(Ay),D4
			return void(this.d4 = this.movep(op));
		case 0o452: // BCHG D4,(An)
		case 0o453: // BCHG D4,(An)+
		case 0o454: // BCHG D4,-(An)
		case 0o455: // BCHG D4,d(An)
		case 0o456: // BCHG D4,d(An,Xi)
			return void this.rwop8(op, this.bchg8, this.d4);
		case 0o457: // BCHG D4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bchg8, this.d4);
		case 0o460: // BCLR D4,Dn
			return void this.rwop32(op, this.bclr32, this.d4);
		case 0o461: // MOVEP.W D4,d(Ay)
			return void this.movep(op, this.d4);
		case 0o462: // BCLR D4,(An)
		case 0o463: // BCLR D4,(An)+
		case 0o464: // BCLR D4,-(An)
		case 0o465: // BCLR D4,d(An)
		case 0o466: // BCLR D4,d(An,Xi)
			return void this.rwop8(op, this.bclr8, this.d4);
		case 0o467: // BCLR D4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bclr8, this.d4);
		case 0o470: // BSET D4,Dn
			return void this.rwop32(op, this.bset32, this.d4);
		case 0o471: // MOVEP.L D4,d(Ay)
			return void this.movep(op, this.d4);
		case 0o472: // BSET D4,(An)
		case 0o473: // BSET D4,(An)+
		case 0o474: // BSET D4,-(An)
		case 0o475: // BSET D4,d(An)
		case 0o476: // BSET D4,d(An,Xi)
			return void this.rwop8(op, this.bset8, this.d4);
		case 0o477: // BSET D4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bset8, this.d4);
		case 0o500: // EORI.B #<data>,Dn
		case 0o502: // EORI.B #<data>,(An)
		case 0o503: // EORI.B #<data>,(An)+
		case 0o504: // EORI.B #<data>,-(An)
		case 0o505: // EORI.B #<data>,d(An)
		case 0o506: // EORI.B #<data>,d(An,Xi)
			return void this.rwop8(op, this.eor8, this.fetch16());
		case 0o507:
			switch (op & 7) {
			case 0: // EORI.B #<data>,Abs.W
			case 1: // EORI.B #<data>,Abs.L
				return void this.rwop8(op, this.eor8, this.fetch16());
			case 4: // EORI #<data>,CCR
				return void(this.sr ^= this.fetch16() & 0xff);
			default:
				return void this.exception(4);
			}
		case 0o510: // EORI.W #<data>,Dn
		case 0o512: // EORI.W #<data>,(An)
		case 0o513: // EORI.W #<data>,(An)+
		case 0o514: // EORI.W #<data>,-(An)
		case 0o515: // EORI.W #<data>,d(An)
		case 0o516: // EORI.W #<data>,d(An,Xi)
			return void this.rwop16(op, this.eor16, this.fetch16());
		case 0o517:
			switch (op & 7) {
			case 0: // EORI.W #<data>,Abs.W
			case 1: // EORI.W #<data>,Abs.L
				return void this.rwop16(op, this.eor16, this.fetch16());
			case 4: // EORI #<data>,SR
				if ((this.sr & 0x2000) === 0)
					return void this.exception(8);
				this.sr ^= this.fetch16();
				if ((this.sr & 0x2000) === 0)
					[this.ssp, this.a7] = [this.a7, this.usp];
				return;
			default:
				return void this.exception(4);
			}
		case 0o520: // EORI.L #<data>,Dn
		case 0o522: // EORI.L #<data>,(An)
		case 0o523: // EORI.L #<data>,(An)+
		case 0o524: // EORI.L #<data>,-(An)
		case 0o525: // EORI.L #<data>,d(An)
		case 0o526: // EORI.L #<data>,d(An,Xi)
			return void this.rwop32(op, this.eor32, this.fetch32());
		case 0o527: // EORI.L #<data>,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.eor32, this.fetch32());
		case 0o540: // BTST D5,Dn
			return void this.btst32(this.d5, this.rop32(op));
		case 0o541: // MOVEP.W d(Ay),D5
			return void(this.d5 = this.d5 & ~0xffff | this.movep(op));
		case 0o542: // BTST D5,(An)
		case 0o543: // BTST D5,(An)+
		case 0o544: // BTST D5,-(An)
		case 0o545: // BTST D5,d(An)
		case 0o546: // BTST D5,d(An,Xi)
			return void this.btst8(this.d5, this.rop8(op));
		case 0o547: // BTST D5,Abs...
			if ((op & 7) >= 4)
				return void this.exception(4);
			return void this.btst8(this.d5, this.rop8(op));
		case 0o550: // BCHG D5,Dn
			return void this.rwop32(op, this.bchg32, this.d5);
		case 0o551: // MOVEP.L d(Ay),D5
			return void(this.d5 = this.movep(op));
		case 0o552: // BCHG D5,(An)
		case 0o553: // BCHG D5,(An)+
		case 0o554: // BCHG D5,-(An)
		case 0o555: // BCHG D5,d(An)
		case 0o556: // BCHG D5,d(An,Xi)
			return void this.rwop8(op, this.bchg8, this.d5);
		case 0o557: // BCHG D5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bchg8, this.d5);
		case 0o560: // BCLR D5,Dn
			return void this.rwop32(op, this.bclr32, this.d5);
		case 0o561: // MOVEP.W D5,d(Ay)
			return void this.movep(op, this.d5);
		case 0o562: // BCLR D5,(An)
		case 0o563: // BCLR D5,(An)+
		case 0o564: // BCLR D5,-(An)
		case 0o565: // BCLR D5,d(An)
		case 0o566: // BCLR D5,d(An,Xi)
			return void this.rwop8(op, this.bclr8, this.d5);
		case 0o567: // BCLR D5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bclr8, this.d5);
		case 0o570: // BSET D5,Dn
			return void this.rwop32(op, this.bset32, this.d5);
		case 0o571: // MOVEP.L D5,d(Ay)
			return void this.movep(op, this.d5);
		case 0o572: // BSET D5,(An)
		case 0o573: // BSET D5,(An)+
		case 0o574: // BSET D5,-(An)
		case 0o575: // BSET D5,d(An)
		case 0o576: // BSET D5,d(An,Xi)
			return void this.rwop8(op, this.bset8, this.d5);
		case 0o577: // BSET D5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bset8, this.d5);
		case 0o600: // CMPI.B #<data>,Dn
		case 0o602: // CMPI.B #<data>,(An)
		case 0o603: // CMPI.B #<data>,(An)+
		case 0o604: // CMPI.B #<data>,-(An)
		case 0o605: // CMPI.B #<data>,d(An)
		case 0o606: // CMPI.B #<data>,d(An,Xi)
			return void this.cmp8(this.fetch16(), this.rop8(op));
		case 0o607: // CMPI.B #<data>,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.cmp8(this.fetch16(), this.rop8(op));
		case 0o610: // CMPI.W #<data>,Dn
		case 0o612: // CMPI.W #<data>,(An)
		case 0o613: // CMPI.W #<data>,(An)+
		case 0o614: // CMPI.W #<data>,-(An)
		case 0o615: // CMPI.W #<data>,d(An)
		case 0o616: // CMPI.W #<data>,d(An,Xi)
			return void this.cmp16(this.fetch16(), this.rop16(op));
		case 0o617: // CMPI.W #<data>,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.cmp16(this.fetch16(), this.rop16(op));
		case 0o620: // CMPI.L #<data>,Dn
		case 0o622: // CMPI.L #<data>,(An)
		case 0o623: // CMPI.L #<data>,(An)+
		case 0o624: // CMPI.L #<data>,-(An)
		case 0o625: // CMPI.L #<data>,d(An)
		case 0o626: // CMPI.L #<data>,d(An,Xi)
			return void this.cmp32(this.fetch32(), this.rop32(op));
		case 0o627: // CMPI.L #<data>,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.cmp32(this.fetch32(), this.rop32(op));
		case 0o640: // BTST D6,Dn
			return void this.btst32(this.d6, this.rop32(op));
		case 0o641: // MOVEP.W d(Ay),D6
			return void(this.d6 = this.d6 & ~0xffff | this.movep(op));
		case 0o642: // BTST D6,(An)
		case 0o643: // BTST D6,(An)+
		case 0o644: // BTST D6,-(An)
		case 0o645: // BTST D6,d(An)
		case 0o646: // BTST D6,d(An,Xi)
			return void this.btst8(this.d6, this.rop8(op));
		case 0o647: // BTST D6,Abs...
			if ((op & 7) >= 4)
				return void this.exception(4);
			return void this.btst8(this.d6, this.rop8(op));
		case 0o650: // BCHG D6,Dn
			return void this.rwop32(op, this.bchg32, this.d6);
		case 0o651: // MOVEP.L d(Ay),D6
			return void(this.d6 = this.movep(op));
		case 0o652: // BCHG D6,(An)
		case 0o653: // BCHG D6,(An)+
		case 0o654: // BCHG D6,-(An)
		case 0o655: // BCHG D6,d(An)
		case 0o656: // BCHG D6,d(An,Xi)
			return void this.rwop8(op, this.bchg8, this.d6);
		case 0o657: // BCHG D6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bchg8, this.d6);
		case 0o660: // BCLR D6,Dn
			return void this.rwop32(op, this.bclr32, this.d6);
		case 0o661: // MOVEP.W D6,d(Ay)
			return void this.movep(op, this.d6);
		case 0o662: // BCLR D6,(An)
		case 0o663: // BCLR D6,(An)+
		case 0o664: // BCLR D6,-(An)
		case 0o665: // BCLR D6,d(An)
		case 0o666: // BCLR D6,d(An,Xi)
			return void this.rwop8(op, this.bclr8, this.d6);
		case 0o667: // BCLR D6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bclr8, this.d6);
		case 0o670: // BSET D6,Dn
			return void this.rwop32(op, this.bset32, this.d6);
		case 0o671: // MOVEP.L D6,d(Ay)
			return void this.movep(op, this.d6);
		case 0o672: // BSET D6,(An)
		case 0o673: // BSET D6,(An)+
		case 0o674: // BSET D6,-(An)
		case 0o675: // BSET D6,d(An)
		case 0o676: // BSET D6,d(An,Xi)
			return void this.rwop8(op, this.bset8, this.d6);
		case 0o677: // BSET D6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bset8, this.d6);
		case 0o740: // BTST D7,Dn
			return void this.btst32(this.d7, this.rop32(op));
		case 0o741: // MOVEP.W d(Ay),D7
			return void(this.d7 = this.d7 & ~0xffff | this.movep(op));
		case 0o742: // BTST D7,(An)
		case 0o743: // BTST D7,(An)+
		case 0o744: // BTST D7,-(An)
		case 0o745: // BTST D7,d(An)
		case 0o746: // BTST D7,d(An,Xi)
			return void this.btst8(this.d7, this.rop8(op));
		case 0o747: // BTST D7,Abs...
			if ((op & 7) >= 4)
				return void this.exception(4);
			return void this.btst8(this.d7, this.rop8(op));
		case 0o750: // BCHG D7,Dn
			return void this.rwop32(op, this.bchg32, this.d7);
		case 0o751: // MOVEP.L d(Ay),D7
			return void(this.d7 = this.movep(op));
		case 0o752: // BCHG D7,(An)
		case 0o753: // BCHG D7,(An)+
		case 0o754: // BCHG D7,-(An)
		case 0o755: // BCHG D7,d(An)
		case 0o756: // BCHG D7,d(An,Xi)
			return void this.rwop8(op, this.bchg8, this.d7);
		case 0o757: // BCHG D7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bchg8, this.d7);
		case 0o760: // BCLR D7,Dn
			return void this.rwop32(op, this.bclr32, this.d7);
		case 0o761: // MOVEP.W D7,d(Ay)
			return void this.movep(op, this.d7);
		case 0o762: // BCLR D7,(An)
		case 0o763: // BCLR D7,(An)+
		case 0o764: // BCLR D7,-(An)
		case 0o765: // BCLR D7,d(An)
		case 0o766: // BCLR D7,d(An,Xi)
			return void this.rwop8(op, this.bclr8, this.d7);
		case 0o767: // BCLR D7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bclr8, this.d7);
		case 0o770: // BSET D7,Dn
			return void this.rwop32(op, this.bset32, this.d7);
		case 0o771: // MOVEP.L D7,d(Ay)
			return void this.movep(op, this.d7);
		case 0o772: // BSET D7,(An)
		case 0o773: // BSET D7,(An)+
		case 0o774: // BSET D7,-(An)
		case 0o775: // BSET D7,d(An)
		case 0o776: // BSET D7,d(An,Xi)
			return void this.rwop8(op, this.bset8, this.d7);
		case 0o777: // BSET D7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.bset8, this.d7);
		default:
			return void this.exception(4);
		}
	}

	execute_1(op) {
		switch (op >>> 3 & 0o777) {
		case 0o000: // MOVE.B Dn,D0
		case 0o002: // MOVE.B (An),D0
		case 0o003: // MOVE.B (An)+,D0
		case 0o004: // MOVE.B -(An),D0
		case 0o005: // MOVE.B d(An),D0
		case 0o006: // MOVE.B d(An,Xi),D0
			return void(this.d0 = this.d0 & ~0xff | this.rop8(op, true));
		case 0o007: // MOVE.B Abs...,D0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d0 = this.d0 & ~0xff | this.rop8(op, true));
		case 0o020: // MOVE.B Dn,(A0)
		case 0o022: // MOVE.B (An),(A0)
		case 0o023: // MOVE.B (An)+,(A0)
		case 0o024: // MOVE.B -(An),(A0)
		case 0o025: // MOVE.B d(An),(A0)
		case 0o026: // MOVE.B d(An,Xi),(A0)
			return void this.write8(this.rop8(op, true), this.a0);
		case 0o027: // MOVE.B Abs...,(A0)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a0);
		case 0o030: // MOVE.B Dn,(A0)+
		case 0o032: // MOVE.B (An),(A0)+
		case 0o033: // MOVE.B (An)+,(A0)+
		case 0o034: // MOVE.B -(An),(A0)+
		case 0o035: // MOVE.B d(An),(A0)+
		case 0o036: // MOVE.B d(An,Xi),(A0)+
			this.write8(this.rop8(op, true), this.a0);
			return void(this.a0 = this.a0 + 1 | 0);
		case 0o037: // MOVE.B Abs...,(A0)+
			if ((op & 7) >= 5)
				return void this.exception(4);
			this.write8(this.rop8(op, true), this.a0);
			return void(this.a1 = this.a1 + 1 | 0);
		case 0o040: // MOVE.B Dn,-(A0)
		case 0o042: // MOVE.B (An),-(A0)
		case 0o043: // MOVE.B (An)+,-(A0)
		case 0o044: // MOVE.B -(An),-(A0)
		case 0o045: // MOVE.B d(An),-(A0)
		case 0o046: // MOVE.B d(An,Xi),-(A0)
			return void this.write8(this.rop8(op, true), this.a0 = this.a0 - 1 | 0);
		case 0o047: // MOVE.B Abs...,-(A0)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a0 = this.a0 - 1 | 0);
		case 0o050: // MOVE.B Dn,d(A0)
		case 0o052: // MOVE.B (An),d(A0)
		case 0o053: // MOVE.B (An)+,d(A0)
		case 0o054: // MOVE.B -(An),d(A0)
		case 0o055: // MOVE.B d(An),d(A0)
		case 0o056: // MOVE.B d(An,Xi),d(A0)
			return void this.write8(this.rop8(op, true), this.a0 + this.fetch16s() | 0);
		case 0o057: // MOVE.B Abs...,d(A0)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a0 + this.fetch16s() | 0);
		case 0o060: // MOVE.B Dn,d(A0,Xi)
		case 0o062: // MOVE.B (An),d(A0,Xi)
		case 0o063: // MOVE.B (An)+,d(A0,Xi)
		case 0o064: // MOVE.B -(An),d(A0,Xi)
		case 0o065: // MOVE.B d(An),d(A0,Xi)
		case 0o066: // MOVE.B d(An,Xi),d(A0,Xi)
			return void this.write8(this.rop8(op, true), this.index(this.a0));
		case 0o067: // MOVE.B Abs...,d(A0,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.index(this.a0));
		case 0o070: // MOVE.B Dn,Abs.W
		case 0o072: // MOVE.B (An),Abs.W
		case 0o073: // MOVE.B (An)+,Abs.W
		case 0o074: // MOVE.B -(An),Abs.W
		case 0o075: // MOVE.B d(An),Abs.W
		case 0o076: // MOVE.B d(An,Xi),Abs.W
			return void this.write8(this.rop8(op, true), this.fetch16s());
		case 0o077: // MOVE.B Abs...,Abs.W
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.fetch16s());
		case 0o100: // MOVE.B Dn,D1
		case 0o102: // MOVE.B (An),D1
		case 0o103: // MOVE.B (An)+,D1
		case 0o104: // MOVE.B -(An),D1
		case 0o105: // MOVE.B d(An),D1
		case 0o106: // MOVE.B d(An,Xi),D1
			return void(this.d1 = this.d1 & ~0xff | this.rop8(op, true));
		case 0o107: // MOVE.B Abs...,D1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d1 = this.d1 & ~0xff | this.rop8(op, true));
		case 0o120: // MOVE.B Dn,(A1)
		case 0o122: // MOVE.B (An),(A1)
		case 0o123: // MOVE.B (An)+,(A1)
		case 0o124: // MOVE.B -(An),(A1)
		case 0o125: // MOVE.B d(An),(A1)
		case 0o126: // MOVE.B d(An,Xi),(A1)
			return void this.write8(this.rop8(op, true), this.a1);
		case 0o127: // MOVE.B Abs...,(A1)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a1);
		case 0o130: // MOVE.B Dn,(A1)+
		case 0o132: // MOVE.B (An),(A1)+
		case 0o133: // MOVE.B (An)+,(A1)+
		case 0o134: // MOVE.B -(An),(A1)+
		case 0o135: // MOVE.B d(An),(A1)+
		case 0o136: // MOVE.B d(An,Xi),(A1)+
			this.write8(this.rop8(op, true), this.a1);
			return void(this.a1 = this.a1 + 1 | 0);
		case 0o137: // MOVE.B Abs...,(A1)+
			if ((op & 7) >= 5)
				return void this.exception(4);
			this.write8(this.rop8(op, true), this.a1);
			return void(this.a1 = this.a1 + 1 | 0);
		case 0o140: // MOVE.B Dn,-(A1)
		case 0o142: // MOVE.B (An),-(A1)
		case 0o143: // MOVE.B (An)+,-(A1)
		case 0o144: // MOVE.B -(An),-(A1)
		case 0o145: // MOVE.B d(An),-(A1)
		case 0o146: // MOVE.B d(An,Xi),-(A1)
			return void this.write8(this.rop8(op, true), this.a1 = this.a1 - 1 | 0);
		case 0o147: // MOVE.B Abs...,-(A1)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a1 = this.a1 - 1 | 0);
		case 0o150: // MOVE.B Dn,d(A1)
		case 0o152: // MOVE.B (An),d(A1)
		case 0o153: // MOVE.B (An)+,d(A1)
		case 0o154: // MOVE.B -(An),d(A1)
		case 0o155: // MOVE.B d(An),d(A1)
		case 0o156: // MOVE.B d(An,Xi),d(A1)
			return void this.write8(this.rop8(op, true), this.a1 + this.fetch16s() | 0);
		case 0o157: // MOVE.B Abs...,d(A1)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a1 + this.fetch16s() | 0);
		case 0o160: // MOVE.B Dn,d(A1,Xi)
		case 0o162: // MOVE.B (An),d(A1,Xi)
		case 0o163: // MOVE.B (An)+,d(A1,Xi)
		case 0o164: // MOVE.B -(An),d(A1,Xi)
		case 0o165: // MOVE.B d(An),d(A1,Xi)
		case 0o166: // MOVE.B d(An,Xi),d(A1,Xi)
			return void this.write8(this.rop8(op, true), this.index(this.a1));
		case 0o167: // MOVE.B Abs...,d(A1,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.index(this.a1));
		case 0o170: // MOVE.B Dn,Abs.L
		case 0o172: // MOVE.B (An),Abs.L
		case 0o173: // MOVE.B (An)+,Abs.L
		case 0o174: // MOVE.B -(An),Abs.L
		case 0o175: // MOVE.B d(An),Abs.L
		case 0o176: // MOVE.B d(An,Xi),Abs.L
			return void this.write8(this.rop8(op, true), this.fetch32());
		case 0o177: // MOVE.B Abs...,Abs.L
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.fetch32());
		case 0o200: // MOVE.B Dn,D2
		case 0o202: // MOVE.B (An),D2
		case 0o203: // MOVE.B (An)+,D2
		case 0o204: // MOVE.B -(An),D2
		case 0o205: // MOVE.B d(An),D2
		case 0o206: // MOVE.B d(An,Xi),D2
			return void(this.d2 = this.d2 & ~0xff | this.rop8(op, true));
		case 0o207: // MOVE.B Abs...,D2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d2 = this.d2 & ~0xff | this.rop8(op, true));
		case 0o220: // MOVE.B Dn,(A2)
		case 0o222: // MOVE.B (An),(A2)
		case 0o223: // MOVE.B (An)+,(A2)
		case 0o224: // MOVE.B -(An),(A2)
		case 0o225: // MOVE.B d(An),(A2)
		case 0o226: // MOVE.B d(An,Xi),(A2)
			return void this.write8(this.rop8(op, true), this.a2);
		case 0o227: // MOVE.B Abs...,(A2)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a2);
		case 0o230: // MOVE.B Dn,(A2)+
		case 0o232: // MOVE.B (An),(A2)+
		case 0o233: // MOVE.B (An)+,(A2)+
		case 0o234: // MOVE.B -(An),(A2)+
		case 0o235: // MOVE.B d(An),(A2)+
		case 0o236: // MOVE.B d(An,Xi),(A2)+
			this.write8(this.rop8(op, true), this.a2);
			return void(this.a2 = this.a2 + 1 | 0);
		case 0o237: // MOVE.B Abs...,(A2)+
			if ((op & 7) >= 5)
				return void this.exception(4);
			this.write8(this.rop8(op, true), this.a2);
			return void(this.a2 = this.a2 + 1 | 0);
		case 0o240: // MOVE.B Dn,-(A2)
		case 0o242: // MOVE.B (An),-(A2)
		case 0o243: // MOVE.B (An)+,-(A2)
		case 0o244: // MOVE.B -(An),-(A2)
		case 0o245: // MOVE.B d(An),-(A2)
		case 0o246: // MOVE.B d(An,Xi),-(A2)
			return void this.write8(this.rop8(op, true), this.a2 = this.a2 - 1 | 0);
		case 0o247: // MOVE.B Abs...,-(A2)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a2 = this.a2 - 1 | 0);
		case 0o250: // MOVE.B Dn,d(A2)
		case 0o252: // MOVE.B (An),d(A2)
		case 0o253: // MOVE.B (An)+,d(A2)
		case 0o254: // MOVE.B -(An),d(A2)
		case 0o255: // MOVE.B d(An),d(A2)
		case 0o256: // MOVE.B d(An,Xi),d(A2)
			return void this.write8(this.rop8(op, true), this.a2 + this.fetch16s() | 0);
		case 0o257: // MOVE.B Abs...,d(A2)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a2 + this.fetch16s() | 0);
		case 0o260: // MOVE.B Dn,d(A2,Xi)
		case 0o262: // MOVE.B (An),d(A2,Xi)
		case 0o263: // MOVE.B (An)+,d(A2,Xi)
		case 0o264: // MOVE.B -(An),d(A2,Xi)
		case 0o265: // MOVE.B d(An),d(A2,Xi)
		case 0o266: // MOVE.B d(An,Xi),d(A2,Xi)
			return void this.write8(this.rop8(op, true), this.index(this.a2));
		case 0o267: // MOVE.B Abs...,d(A2,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.index(this.a2));
		case 0o300: // MOVE.B Dn,D3
		case 0o302: // MOVE.B (An),D3
		case 0o303: // MOVE.B (An)+,D3
		case 0o304: // MOVE.B -(An),D3
		case 0o305: // MOVE.B d(An),D3
		case 0o306: // MOVE.B d(An,Xi),D3
			return void(this.d3 = this.d3 & ~0xff | this.rop8(op, true));
		case 0o307: // MOVE.B Abs...,D3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d3 = this.d3 & ~0xff | this.rop8(op, true));
		case 0o320: // MOVE.B Dn,(A3)
		case 0o322: // MOVE.B (An),(A3)
		case 0o323: // MOVE.B (An)+,(A3)
		case 0o324: // MOVE.B -(An),(A3)
		case 0o325: // MOVE.B d(An),(A3)
		case 0o326: // MOVE.B d(An,Xi),(A3)
			return void this.write8(this.rop8(op, true), this.a3);
		case 0o327: // MOVE.B Abs...,(A3)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a3);
		case 0o330: // MOVE.B Dn,(A3)+
		case 0o332: // MOVE.B (An),(A3)+
		case 0o333: // MOVE.B (An)+,(A3)+
		case 0o334: // MOVE.B -(An),(A3)+
		case 0o335: // MOVE.B d(An),(A3)+
		case 0o336: // MOVE.B d(An,Xi),(A3)+
			this.write8(this.rop8(op, true), this.a3);
			return void(this.a3 = this.a3 + 1 | 0);
		case 0o337: // MOVE.B Abs...,(A3)+
			if ((op & 7) >= 5)
				return void this.exception(4);
			this.write8(this.rop8(op, true), this.a3);
			return void(this.a3 = this.a3 + 1 | 0);
		case 0o340: // MOVE.B Dn,-(A3)
		case 0o342: // MOVE.B (An),-(A3)
		case 0o343: // MOVE.B (An)+,-(A3)
		case 0o344: // MOVE.B -(An),-(A3)
		case 0o345: // MOVE.B d(An),-(A3)
		case 0o346: // MOVE.B d(An,Xi),-(A3)
			return void this.write8(this.rop8(op, true), this.a3 = this.a3 - 1 | 0);
		case 0o347: // MOVE.B Abs...,-(A3)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a3 = this.a3 - 1 | 0);
		case 0o350: // MOVE.B Dn,d(A3)
		case 0o352: // MOVE.B (An),d(A3)
		case 0o353: // MOVE.B (An)+,d(A3)
		case 0o354: // MOVE.B -(An),d(A3)
		case 0o355: // MOVE.B d(An),d(A3)
		case 0o356: // MOVE.B d(An,Xi),d(A3)
			return void this.write8(this.rop8(op, true), this.a3 + this.fetch16s() | 0);
		case 0o357: // MOVE.B Abs...,d(A3)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a3 + this.fetch16s() | 0);
		case 0o360: // MOVE.B Dn,d(A3,Xi)
		case 0o362: // MOVE.B (An),d(A3,Xi)
		case 0o363: // MOVE.B (An)+,d(A3,Xi)
		case 0o364: // MOVE.B -(An),d(A3,Xi)
		case 0o365: // MOVE.B d(An),d(A3,Xi)
		case 0o366: // MOVE.B d(An,Xi),d(A3,Xi)
			return void this.write8(this.rop8(op, true), this.index(this.a3));
		case 0o367: // MOVE.B Abs...,d(A3,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.index(this.a3));
		case 0o400: // MOVE.B Dn,D4
		case 0o402: // MOVE.B (An),D4
		case 0o403: // MOVE.B (An)+,D4
		case 0o404: // MOVE.B -(An),D4
		case 0o405: // MOVE.B d(An),D4
		case 0o406: // MOVE.B d(An,Xi),D4
			return void(this.d4 = this.d4 & ~0xff | this.rop8(op, true));
		case 0o407: // MOVE.B Abs...,D4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d4 = this.d4 & ~0xff | this.rop8(op, true));
		case 0o420: // MOVE.B Dn,(A4)
		case 0o422: // MOVE.B (An),(A4)
		case 0o423: // MOVE.B (An)+,(A4)
		case 0o424: // MOVE.B -(An),(A4)
		case 0o425: // MOVE.B d(An),(A4)
		case 0o426: // MOVE.B d(An,Xi),(A4)
			return void this.write8(this.rop8(op, true), this.a4);
		case 0o427: // MOVE.B Abs...,(A4)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a4);
		case 0o430: // MOVE.B Dn,(A4)+
		case 0o432: // MOVE.B (An),(A4)+
		case 0o433: // MOVE.B (An)+,(A4)+
		case 0o434: // MOVE.B -(An),(A4)+
		case 0o435: // MOVE.B d(An),(A4)+
		case 0o436: // MOVE.B d(An,Xi),(A4)+
			this.write8(this.rop8(op, true), this.a4);
			return void(this.a4 = this.a4 + 1 | 0);
		case 0o437: // MOVE.B Abs...,(A4)+
			if ((op & 7) >= 5)
				return void this.exception(4);
			this.write8(this.rop8(op, true), this.a4);
			return void(this.a4 = this.a4 + 1 | 0);
		case 0o440: // MOVE.B Dn,-(A4)
		case 0o442: // MOVE.B (An),-(A4)
		case 0o443: // MOVE.B (An)+,-(A4)
		case 0o444: // MOVE.B -(An),-(A4)
		case 0o445: // MOVE.B d(An),-(A4)
		case 0o446: // MOVE.B d(An,Xi),-(A4)
			return void this.write8(this.rop8(op, true), this.a4 = this.a4 - 1 | 0);
		case 0o447: // MOVE.B Abs...,-(A4)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a4 = this.a4 - 1 | 0);
		case 0o450: // MOVE.B Dn,d(A4)
		case 0o452: // MOVE.B (An),d(A4)
		case 0o453: // MOVE.B (An)+,d(A4)
		case 0o454: // MOVE.B -(An),d(A4)
		case 0o455: // MOVE.B d(An),d(A4)
		case 0o456: // MOVE.B d(An,Xi),d(A4)
			return void this.write8(this.rop8(op, true), this.a4 + this.fetch16s() | 0);
		case 0o457: // MOVE.B Abs...,d(A4)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a4 + this.fetch16s() | 0);
		case 0o460: // MOVE.B Dn,d(A4,Xi)
		case 0o462: // MOVE.B (An),d(A4,Xi)
		case 0o463: // MOVE.B (An)+,d(A4,Xi)
		case 0o464: // MOVE.B -(An),d(A4,Xi)
		case 0o465: // MOVE.B d(An),d(A4,Xi)
		case 0o466: // MOVE.B d(An,Xi),d(A4,Xi)
			return void this.write8(this.rop8(op, true), this.index(this.a4));
		case 0o467: // MOVE.B Abs...,d(A4,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.index(this.a4));
		case 0o500: // MOVE.B Dn,D5
		case 0o502: // MOVE.B (An),D5
		case 0o503: // MOVE.B (An)+,D5
		case 0o504: // MOVE.B -(An),D5
		case 0o505: // MOVE.B d(An),D5
		case 0o506: // MOVE.B d(An,Xi),D5
			return void(this.d5 = this.d5 & ~0xff | this.rop8(op, true));
		case 0o507: // MOVE.B Abs...,D5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d5 = this.d5 & ~0xff | this.rop8(op, true));
		case 0o520: // MOVE.B Dn,(A5)
		case 0o522: // MOVE.B (An),(A5)
		case 0o523: // MOVE.B (An)+,(A5)
		case 0o524: // MOVE.B -(An),(A5)
		case 0o525: // MOVE.B d(An),(A5)
		case 0o526: // MOVE.B d(An,Xi),(A5)
			return void this.write8(this.rop8(op, true), this.a5);
		case 0o527: // MOVE.B Abs...,(A5)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a5);
		case 0o530: // MOVE.B Dn,(A5)+
		case 0o532: // MOVE.B (An),(A5)+
		case 0o533: // MOVE.B (An)+,(A5)+
		case 0o534: // MOVE.B -(An),(A5)+
		case 0o535: // MOVE.B d(An),(A5)+
		case 0o536: // MOVE.B d(An,Xi),(A5)+
			this.write8(this.rop8(op, true), this.a5);
			return void(this.a5 = this.a5 + 1 | 0);
		case 0o537: // MOVE.B Abs...,(A5)+
			if ((op & 7) >= 5)
				return void this.exception(4);
			this.write8(this.rop8(op, true), this.a5);
			return void(this.a5 = this.a5 + 1 | 0);
		case 0o540: // MOVE.B Dn,-(A5)
		case 0o542: // MOVE.B (An),-(A5)
		case 0o543: // MOVE.B (An)+,-(A5)
		case 0o544: // MOVE.B -(An),-(A5)
		case 0o545: // MOVE.B d(An),-(A5)
		case 0o546: // MOVE.B d(An,Xi),-(A5)
			return void this.write8(this.rop8(op, true), this.a5 = this.a5 - 1 | 0);
		case 0o547: // MOVE.B Abs...,-(A5)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a5 = this.a5 - 1 | 0);
		case 0o550: // MOVE.B Dn,d(A5)
		case 0o552: // MOVE.B (An),d(A5)
		case 0o553: // MOVE.B (An)+,d(A5)
		case 0o554: // MOVE.B -(An),d(A5)
		case 0o555: // MOVE.B d(An),d(A5)
		case 0o556: // MOVE.B d(An,Xi),d(A5)
			return void this.write8(this.rop8(op, true), this.a5 + this.fetch16s() | 0);
		case 0o557: // MOVE.B Abs...,d(A5)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a5 + this.fetch16s() | 0);
		case 0o560: // MOVE.B Dn,d(A5,Xi)
		case 0o562: // MOVE.B (An),d(A5,Xi)
		case 0o563: // MOVE.B (An)+,d(A5,Xi)
		case 0o564: // MOVE.B -(An),d(A5,Xi)
		case 0o565: // MOVE.B d(An),d(A5,Xi)
		case 0o566: // MOVE.B d(An,Xi),d(A5,Xi)
			return void this.write8(this.rop8(op, true), this.index(this.a5));
		case 0o567: // MOVE.B Abs...,d(A5,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.index(this.a5));
		case 0o600: // MOVE.B Dn,D6
		case 0o602: // MOVE.B (An),D6
		case 0o603: // MOVE.B (An)+,D6
		case 0o604: // MOVE.B -(An),D6
		case 0o605: // MOVE.B d(An),D6
		case 0o606: // MOVE.B d(An,Xi),D6
			return void(this.d6 = this.d6 & ~0xff | this.rop8(op, true));
		case 0o607: // MOVE.B Abs...,D6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d6 = this.d6 & ~0xff | this.rop8(op, true));
		case 0o620: // MOVE.B Dn,(A6)
		case 0o622: // MOVE.B (An),(A6)
		case 0o623: // MOVE.B (An)+,(A6)
		case 0o624: // MOVE.B -(An),(A6)
		case 0o625: // MOVE.B d(An),(A6)
		case 0o626: // MOVE.B d(An,Xi),(A6)
			return void this.write8(this.rop8(op, true), this.a6);
		case 0o627: // MOVE.B Abs...,(A6)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a6);
		case 0o630: // MOVE.B Dn,(A6)+
		case 0o632: // MOVE.B (An),(A6)+
		case 0o633: // MOVE.B (An)+,(A6)+
		case 0o634: // MOVE.B -(An),(A6)+
		case 0o635: // MOVE.B d(An),(A6)+
		case 0o636: // MOVE.B d(An,Xi),(A6)+
			this.write8(this.rop8(op, true), this.a6);
			return void(this.a6 = this.a6 + 1 | 0);
		case 0o637: // MOVE.B Abs...,(A6)+
			if ((op & 7) >= 5)
				return void this.exception(4);
			this.write8(this.rop8(op, true), this.a6);
			return void(this.a6 = this.a6 + 1 | 0);
		case 0o640: // MOVE.B Dn,-(A6)
		case 0o642: // MOVE.B (An),-(A6)
		case 0o643: // MOVE.B (An)+,-(A6)
		case 0o644: // MOVE.B -(An),-(A6)
		case 0o645: // MOVE.B d(An),-(A6)
		case 0o646: // MOVE.B d(An,Xi),-(A6)
			return void this.write8(this.rop8(op, true), this.a6 = this.a6 - 1 | 0);
		case 0o647: // MOVE.B Abs...,-(A6)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a6 = this.a6 - 1 | 0);
		case 0o650: // MOVE.B Dn,d(A6)
		case 0o652: // MOVE.B (An),d(A6)
		case 0o653: // MOVE.B (An)+,d(A6)
		case 0o654: // MOVE.B -(An),d(A6)
		case 0o655: // MOVE.B d(An),d(A6)
		case 0o656: // MOVE.B d(An,Xi),d(A6)
			return void this.write8(this.rop8(op, true), this.a6 + this.fetch16s() | 0);
		case 0o657: // MOVE.B Abs...,d(A6)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a6 + this.fetch16s() | 0);
		case 0o660: // MOVE.B Dn,d(A6,Xi)
		case 0o662: // MOVE.B (An),d(A6,Xi)
		case 0o663: // MOVE.B (An)+,d(A6,Xi)
		case 0o664: // MOVE.B -(An),d(A6,Xi)
		case 0o665: // MOVE.B d(An),d(A6,Xi)
		case 0o666: // MOVE.B d(An,Xi),d(A6,Xi)
			return void this.write8(this.rop8(op, true), this.index(this.a6));
		case 0o667: // MOVE.B Abs...,d(A6,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.index(this.a6));
		case 0o700: // MOVE.B Dn,D7
		case 0o702: // MOVE.B (An),D7
		case 0o703: // MOVE.B (An)+,D7
		case 0o704: // MOVE.B -(An),D7
		case 0o705: // MOVE.B d(An),D7
		case 0o706: // MOVE.B d(An,Xi),D7
			return void(this.d7 = this.d7 & ~0xff | this.rop8(op, true));
		case 0o707: // MOVE.B Abs...,D7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d7 = this.d7 & ~0xff | this.rop8(op, true));
		case 0o720: // MOVE.B Dn,(A7)
		case 0o722: // MOVE.B (An),(A7)
		case 0o723: // MOVE.B (An)+,(A7)
		case 0o724: // MOVE.B -(An),(A7)
		case 0o725: // MOVE.B d(An),(A7)
		case 0o726: // MOVE.B d(An,Xi),(A7)
			return void this.write8(this.rop8(op, true), this.a7);
		case 0o727: // MOVE.B Abs...,(A7)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a7);
		case 0o730: // MOVE.B Dn,(A7)+
		case 0o732: // MOVE.B (An),(A7)+
		case 0o733: // MOVE.B (An)+,(A7)+
		case 0o734: // MOVE.B -(An),(A7)+
		case 0o735: // MOVE.B d(An),(A7)+
		case 0o736: // MOVE.B d(An,Xi),(A7)+
			this.write8(this.rop8(op, true), this.a7);
			return void(this.a7 = this.a7 + 1 | 0);
		case 0o737: // MOVE.B Abs...,(A7)+
			if ((op & 7) >= 5)
				return void this.exception(4);
			this.write8(this.rop8(op, true), this.a7);
			return void(this.a7 = this.a7 + 1 | 0);
		case 0o740: // MOVE.B Dn,-(A7)
		case 0o742: // MOVE.B (An),-(A7)
		case 0o743: // MOVE.B (An)+,-(A7)
		case 0o744: // MOVE.B -(An),-(A7)
		case 0o745: // MOVE.B d(An),-(A7)
		case 0o746: // MOVE.B d(An,Xi),-(A7)
			return void this.write8(this.rop8(op, true), this.a7 = this.a7 - 1 | 0);
		case 0o747: // MOVE.B Abs...,-(A7)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a7 = this.a7 - 1 | 0);
		case 0o750: // MOVE.B Dn,d(A7)
		case 0o752: // MOVE.B (An),d(A7)
		case 0o753: // MOVE.B (An)+,d(A7)
		case 0o754: // MOVE.B -(An),d(A7)
		case 0o755: // MOVE.B d(An),d(A7)
		case 0o756: // MOVE.B d(An,Xi),d(A7)
			return void this.write8(this.rop8(op, true), this.a7 + this.fetch16s() | 0);
		case 0o757: // MOVE.B Abs...,d(A7)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.a7 + this.fetch16s() | 0);
		case 0o760: // MOVE.B Dn,d(A7,Xi)
		case 0o762: // MOVE.B (An),d(A7,Xi)
		case 0o763: // MOVE.B (An)+,d(A7,Xi)
		case 0o764: // MOVE.B -(An),d(A7,Xi)
		case 0o765: // MOVE.B d(An),d(A7,Xi)
		case 0o766: // MOVE.B d(An,Xi),d(A7,Xi)
			return void this.write8(this.rop8(op, true), this.index(this.a7));
		case 0o767: // MOVE.B Abs...,d(A7,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write8(this.rop8(op, true), this.index(this.a7));
		default:
			return void this.exception(4);
		}
	}

	execute_2(op) {
		switch (op >>> 3 & 0o777) {
		case 0o000: // MOVE.L Dn,D0
		case 0o001: // MOVE.L An,D0
		case 0o002: // MOVE.L (An),D0
		case 0o003: // MOVE.L (An)+,D0
		case 0o004: // MOVE.L -(An),D0
		case 0o005: // MOVE.L d(An),D0
		case 0o006: // MOVE.L d(An,Xi),D0
			return void(this.d0 = this.rop32(op, true));
		case 0o007: // MOVE.L Abs...,D0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d0 = this.rop32(op, true));
		case 0o010: // MOVEA.L Dn,A0
		case 0o011: // MOVEA.L An,A0
		case 0o012: // MOVEA.L (An),A0
		case 0o013: // MOVEA.L (An)+,A0
		case 0o014: // MOVEA.L -(An),A0
		case 0o015: // MOVEA.L d(An),A0
		case 0o016: // MOVEA.L d(An,Xi),A0
			return void(this.a0 = this.rop32(op));
		case 0o017: // MOVEA.L Abs...,A0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a0 = this.rop32(op));
		case 0o020: // MOVE.L Dn,(A0)
		case 0o021: // MOVE.L An,(A0)
		case 0o022: // MOVE.L (An),(A0)
		case 0o023: // MOVE.L (An)+,(A0)
		case 0o024: // MOVE.L -(An),(A0)
		case 0o025: // MOVE.L d(An),(A0)
		case 0o026: // MOVE.L d(An,Xi),(A0)
			return void this.write32(this.rop32(op, true), this.a0);
		case 0o027: // MOVE.L Abs...,(A0)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a0);
		case 0o030: // MOVE.L Dn,(A0)+
		case 0o031: // MOVE.L An,(A0)+
		case 0o032: // MOVE.L (An),(A0)+
		case 0o033: // MOVE.L (An)+,(A0)+
		case 0o034: // MOVE.L -(An),(A0)+
		case 0o035: // MOVE.L d(An),(A0)+
		case 0o036: // MOVE.L d(An,Xi),(A0)+
			this.write32(this.rop32(op, true), this.a0);
			return void(this.a0 = this.a0 + 4 | 0);
		case 0o037: // MOVE.L Abs...,(A0)+
			if ((op & 7) >= 5)
				return void this.exception(4);
			this.write32(this.rop32(op, true), this.a0);
			return void(this.a0 = this.a0 + 4 | 0);
		case 0o040: // MOVE.L Dn,-(A0)
		case 0o041: // MOVE.L An,-(A0)
		case 0o042: // MOVE.L (An),-(A0)
		case 0o043: // MOVE.L (An)+,-(A0)
		case 0o044: // MOVE.L -(An),-(A0)
		case 0o045: // MOVE.L d(An),-(A0)
		case 0o046: // MOVE.L d(An,Xi),-(A0)
			return void this.write32(this.rop32(op, true), this.a0 = this.a0 - 4 | 0);
		case 0o047: // MOVE.L Abs...,-(A0)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a0 = this.a0 - 4 | 0);
		case 0o050: // MOVE.L Dn,d(A0)
		case 0o051: // MOVE.L An,d(A0)
		case 0o052: // MOVE.L (An),d(A0)
		case 0o053: // MOVE.L (An)+,d(A0)
		case 0o054: // MOVE.L -(An),d(A0)
		case 0o055: // MOVE.L d(An),d(A0)
		case 0o056: // MOVE.L d(An,Xi),d(A0)
			return void this.write32(this.rop32(op, true), this.a0 + this.fetch16s() | 0);
		case 0o057: // MOVE.L Abs...,d(A0)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a0 + this.fetch16s() | 0);
		case 0o060: // MOVE.L Dn,d(A0,Xi)
		case 0o061: // MOVE.L An,d(A0,Xi)
		case 0o062: // MOVE.L (An),d(A0,Xi)
		case 0o063: // MOVE.L (An)+,d(A0,Xi)
		case 0o064: // MOVE.L -(An),d(A0,Xi)
		case 0o065: // MOVE.L d(An),d(A0,Xi)
		case 0o066: // MOVE.L d(An,Xi),d(A0,Xi)
			return void this.write32(this.rop32(op, true), this.index(this.a0));
		case 0o067: // MOVE.L Abs...,d(A0,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.index(this.a0));
		case 0o070: // MOVE.L Dn,Abs.W
		case 0o071: // MOVE.L An,Abs.W
		case 0o072: // MOVE.L (An),Abs.W
		case 0o073: // MOVE.L (An)+,Abs.W
		case 0o074: // MOVE.L -(An),Abs.W
		case 0o075: // MOVE.L d(An),Abs.W
		case 0o076: // MOVE.L d(An,Xi),Abs.W
			return void this.write32(this.rop32(op, true), this.fetch16s());
		case 0o077: // MOVE.L Abs...,Abs.W
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.fetch16s());
		case 0o100: // MOVE.L Dn,D1
		case 0o101: // MOVE.L An,D1
		case 0o102: // MOVE.L (An),D1
		case 0o103: // MOVE.L (An)+,D1
		case 0o104: // MOVE.L -(An),D1
		case 0o105: // MOVE.L d(An),D1
		case 0o106: // MOVE.L d(An,Xi),D1
			return void(this.d1 = this.rop32(op, true));
		case 0o107: // MOVE.L Abs...,D1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d1 = this.rop32(op, true));
		case 0o110: // MOVEA.L Dn,A1
		case 0o111: // MOVEA.L An,A1
		case 0o112: // MOVEA.L (An),A1
		case 0o113: // MOVEA.L (An)+,A1
		case 0o114: // MOVEA.L -(An),A1
		case 0o115: // MOVEA.L d(An),A1
		case 0o116: // MOVEA.L d(An,Xi),A1
			return void(this.a1 = this.rop32(op));
		case 0o117: // MOVEA.L Abs...,A1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a1 = this.rop32(op));
		case 0o120: // MOVE.L Dn,(A1)
		case 0o121: // MOVE.L An,(A1)
		case 0o122: // MOVE.L (An),(A1)
		case 0o123: // MOVE.L (An)+,(A1)
		case 0o124: // MOVE.L -(An),(A1)
		case 0o125: // MOVE.L d(An),(A1)
		case 0o126: // MOVE.L d(An,Xi),(A1)
			return void this.write32(this.rop32(op, true), this.a1);
		case 0o127: // MOVE.L Abs...,(A1)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a1);
		case 0o130: // MOVE.L Dn,(A1)+
		case 0o131: // MOVE.L An,(A1)+
		case 0o132: // MOVE.L (An),(A1)+
		case 0o133: // MOVE.L (An)+,(A1)+
		case 0o134: // MOVE.L -(An),(A1)+
		case 0o135: // MOVE.L d(An),(A1)+
		case 0o136: // MOVE.L d(An,Xi),(A1)+
			this.write32(this.rop32(op, true), this.a1);
			return void(this.a1 = this.a1 + 4 | 0);
		case 0o137: // MOVE.L Abs...,(A1)+
			if ((op & 7) >= 5)
				return void this.exception(4);
			this.write32(this.rop32(op, true), this.a1);
			return void(this.a1 = this.a1 + 4 | 0);
		case 0o140: // MOVE.L Dn,-(A1)
		case 0o141: // MOVE.L An,-(A1)
		case 0o142: // MOVE.L (An),-(A1)
		case 0o143: // MOVE.L (An)+,-(A1)
		case 0o144: // MOVE.L -(An),-(A1)
		case 0o145: // MOVE.L d(An),-(A1)
		case 0o146: // MOVE.L d(An,Xi),-(A1)
			return void this.write32(this.rop32(op, true), this.a1 = this.a1 - 4 | 0);
		case 0o147: // MOVE.L Abs...,-(A1)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a1 = this.a1 - 4 | 0);
		case 0o150: // MOVE.L Dn,d(A1)
		case 0o151: // MOVE.L An,d(A1)
		case 0o152: // MOVE.L (An),d(A1)
		case 0o153: // MOVE.L (An)+,d(A1)
		case 0o154: // MOVE.L -(An),d(A1)
		case 0o155: // MOVE.L d(An),d(A1)
		case 0o156: // MOVE.L d(An,Xi),d(A1)
			return void this.write32(this.rop32(op, true), this.a1 + this.fetch16s() | 0);
		case 0o157: // MOVE.L Abs...,d(A1)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a1 + this.fetch16s() | 0);
		case 0o160: // MOVE.L Dn,d(A1,Xi)
		case 0o161: // MOVE.L An,d(A1,Xi)
		case 0o162: // MOVE.L (An),d(A1,Xi)
		case 0o163: // MOVE.L (An)+,d(A1,Xi)
		case 0o164: // MOVE.L -(An),d(A1,Xi)
		case 0o165: // MOVE.L d(An),d(A1,Xi)
		case 0o166: // MOVE.L d(An,Xi),d(A1,Xi)
			return void this.write32(this.rop32(op, true), this.index(this.a1));
		case 0o167: // MOVE.L Abs...,d(A1,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.index(this.a1));
		case 0o170: // MOVE.L Dn,Abs.L
		case 0o171: // MOVE.L An,Abs.L
		case 0o172: // MOVE.L (An),Abs.L
		case 0o173: // MOVE.L (An)+,Abs.L
		case 0o174: // MOVE.L -(An),Abs.L
		case 0o175: // MOVE.L d(An),Abs.L
		case 0o176: // MOVE.L d(An,Xi),Abs.L
			return void this.write32(this.rop32(op, true), this.fetch32());
		case 0o177: // MOVE.L Abs...,Abs.L
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.fetch32());
		case 0o200: // MOVE.L Dn,D2
		case 0o201: // MOVE.L An,D2
		case 0o202: // MOVE.L (An),D2
		case 0o203: // MOVE.L (An)+,D2
		case 0o204: // MOVE.L -(An),D2
		case 0o205: // MOVE.L d(An),D2
		case 0o206: // MOVE.L d(An,Xi),D2
			return void(this.d2 = this.rop32(op, true));
		case 0o207: // MOVE.L Abs...,D2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d2 = this.rop32(op, true));
		case 0o210: // MOVEA.L Dn,A2
		case 0o211: // MOVEA.L An,A2
		case 0o212: // MOVEA.L (An),A2
		case 0o213: // MOVEA.L (An)+,A2
		case 0o214: // MOVEA.L -(An),A2
		case 0o215: // MOVEA.L d(An),A2
		case 0o216: // MOVEA.L d(An,Xi),A2
			return void(this.a2 = this.rop32(op));
		case 0o217: // MOVEA.L Abs...,A2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a2 = this.rop32(op));
		case 0o220: // MOVE.L Dn,(A2)
		case 0o221: // MOVE.L An,(A2)
		case 0o222: // MOVE.L (An),(A2)
		case 0o223: // MOVE.L (An)+,(A2)
		case 0o224: // MOVE.L -(An),(A2)
		case 0o225: // MOVE.L d(An),(A2)
		case 0o226: // MOVE.L d(An,Xi),(A2)
			return void this.write32(this.rop32(op, true), this.a2);
		case 0o227: // MOVE.L Abs...,(A2)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a2);
		case 0o230: // MOVE.L Dn,(A2)+
		case 0o231: // MOVE.L An,(A2)+
		case 0o232: // MOVE.L (An),(A2)+
		case 0o233: // MOVE.L (An)+,(A2)+
		case 0o234: // MOVE.L -(An),(A2)+
		case 0o235: // MOVE.L d(An),(A2)+
		case 0o236: // MOVE.L d(An,Xi),(A2)+
			this.write32(this.rop32(op, true), this.a2);
			return void(this.a2 = this.a2 + 4 | 0);
		case 0o237: // MOVE.L Abs...,(A2)+
			if ((op & 7) >= 5)
				return void this.exception(4);
			this.write32(this.rop32(op, true), this.a2);
			return void(this.a2 = this.a2 + 4 | 0);
		case 0o240: // MOVE.L Dn,-(A2)
		case 0o241: // MOVE.L An,-(A2)
		case 0o242: // MOVE.L (An),-(A2)
		case 0o243: // MOVE.L (An)+,-(A2)
		case 0o244: // MOVE.L -(An),-(A2)
		case 0o245: // MOVE.L d(An),-(A2)
		case 0o246: // MOVE.L d(An,Xi),-(A2)
			return void this.write32(this.rop32(op, true), this.a2 = this.a2 - 4 | 0);
		case 0o247: // MOVE.L Abs...,-(A2)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a2 = this.a2 - 4 | 0);
		case 0o250: // MOVE.L Dn,d(A2)
		case 0o251: // MOVE.L An,d(A2)
		case 0o252: // MOVE.L (An),d(A2)
		case 0o253: // MOVE.L (An)+,d(A2)
		case 0o254: // MOVE.L -(An),d(A2)
		case 0o255: // MOVE.L d(An),d(A2)
		case 0o256: // MOVE.L d(An,Xi),d(A2)
			return void this.write32(this.rop32(op, true), this.a2 + this.fetch16s() | 0);
		case 0o257: // MOVE.L Abs...,d(A2)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a2 + this.fetch16s() | 0);
		case 0o260: // MOVE.L Dn,d(A2,Xi)
		case 0o261: // MOVE.L An,d(A2,Xi)
		case 0o262: // MOVE.L (An),d(A2,Xi)
		case 0o263: // MOVE.L (An)+,d(A2,Xi)
		case 0o264: // MOVE.L -(An),d(A2,Xi)
		case 0o265: // MOVE.L d(An),d(A2,Xi)
		case 0o266: // MOVE.L d(An,Xi),d(A2,Xi)
			return void this.write32(this.rop32(op, true), this.index(this.a2));
		case 0o267: // MOVE.L Abs...,d(A2,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.index(this.a2));
		case 0o300: // MOVE.L Dn,D3
		case 0o301: // MOVE.L An,D3
		case 0o302: // MOVE.L (An),D3
		case 0o303: // MOVE.L (An)+,D3
		case 0o304: // MOVE.L -(An),D3
		case 0o305: // MOVE.L d(An),D3
		case 0o306: // MOVE.L d(An,Xi),D3
			return void(this.d3 = this.rop32(op, true));
		case 0o307: // MOVE.L Abs..,D3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d3 = this.rop32(op, true));
		case 0o310: // MOVEA.L Dn,A3
		case 0o311: // MOVEA.L An,A3
		case 0o312: // MOVEA.L (An),A3
		case 0o313: // MOVEA.L (An)+,A3
		case 0o314: // MOVEA.L -(An),A3
		case 0o315: // MOVEA.L d(An),A3
		case 0o316: // MOVEA.L d(An,Xi),A3
			return void(this.a3 = this.rop32(op));
		case 0o317: // MOVEA.L Abs...,A3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a3 = this.rop32(op));
		case 0o320: // MOVE.L Dn,(A3)
		case 0o321: // MOVE.L An,(A3)
		case 0o322: // MOVE.L (An),(A3)
		case 0o323: // MOVE.L (An)+,(A3)
		case 0o324: // MOVE.L -(An),(A3)
		case 0o325: // MOVE.L d(An),(A3)
		case 0o326: // MOVE.L d(An,Xi),(A3)
			return void this.write32(this.rop32(op, true), this.a3);
		case 0o327: // MOVE.L Abs...,(A3)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a3);
		case 0o330: // MOVE.L Dn,(A3)+
		case 0o331: // MOVE.L An,(A3)+
		case 0o332: // MOVE.L (An),(A3)+
		case 0o333: // MOVE.L (An)+,(A3)+
		case 0o334: // MOVE.L -(An),(A3)+
		case 0o335: // MOVE.L d(An),(A3)+
		case 0o336: // MOVE.L d(An,Xi),(A3)+
			this.write32(this.rop32(op, true), this.a3);
			return void(this.a3 = this.a3 + 4 | 0);
		case 0o337: // MOVE.L Abs...,(A3)+
			if ((op & 7) >= 5)
				return void this.exception(4);
			this.write32(this.rop32(op, true), this.a3);
			return void(this.a3 = this.a3 + 4 | 0);
		case 0o340: // MOVE.L Dn,-(A3)
		case 0o341: // MOVE.L An,-(A3)
		case 0o342: // MOVE.L (An),-(A3)
		case 0o343: // MOVE.L (An)+,-(A3)
		case 0o344: // MOVE.L -(An),-(A3)
		case 0o345: // MOVE.L d(An),-(A3)
		case 0o346: // MOVE.L d(An,Xi),-(A3)
			return void this.write32(this.rop32(op, true), this.a3 = this.a3 - 4 | 0);
		case 0o347: // MOVE.L Abs...,-(A3)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a3 = this.a3 - 4 | 0);
		case 0o350: // MOVE.L Dn,d(A3)
		case 0o351: // MOVE.L An,d(A3)
		case 0o352: // MOVE.L (An),d(A3)
		case 0o353: // MOVE.L (An)+,d(A3)
		case 0o354: // MOVE.L -(An),d(A3)
		case 0o355: // MOVE.L d(An),d(A3)
		case 0o356: // MOVE.L d(An,Xi),d(A3)
			return void this.write32(this.rop32(op, true), this.a3 + this.fetch16s() | 0);
		case 0o357: // MOVE.L Abs...,d(A3)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a3 + this.fetch16s() | 0);
		case 0o360: // MOVE.L Dn,d(A3,Xi)
		case 0o361: // MOVE.L An,d(A3,Xi)
		case 0o362: // MOVE.L (An),d(A3,Xi)
		case 0o363: // MOVE.L (An)+,d(A3,Xi)
		case 0o364: // MOVE.L -(An),d(A3,Xi)
		case 0o365: // MOVE.L d(An),d(A3,Xi)
		case 0o366: // MOVE.L d(An,Xi),d(A3,Xi)
			return void this.write32(this.rop32(op, true), this.index(this.a3));
		case 0o367: // MOVE.L Abs...,d(A3,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.index(this.a3));
		case 0o400: // MOVE.L Dn,D4
		case 0o401: // MOVE.L An,D4
		case 0o402: // MOVE.L (An),D4
		case 0o403: // MOVE.L (An)+,D4
		case 0o404: // MOVE.L -(An),D4
		case 0o405: // MOVE.L d(An),D4
		case 0o406: // MOVE.L d(An,Xi),D4
			return void(this.d4 = this.rop32(op, true));
		case 0o407: // MOVE.L Abs...,D4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d4 = this.rop32(op, true));
		case 0o410: // MOVEA.L Dn,A4
		case 0o411: // MOVEA.L An,A4
		case 0o412: // MOVEA.L (An),A4
		case 0o413: // MOVEA.L (An)+,A4
		case 0o414: // MOVEA.L -(An),A4
		case 0o415: // MOVEA.L d(An),A4
		case 0o416: // MOVEA.L d(An,Xi),A4
			return void(this.a4 = this.rop32(op));
		case 0o417: // MOVEA.L Abs...,A4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a4 = this.rop32(op));
		case 0o420: // MOVE.L Dn,(A4)
		case 0o421: // MOVE.L An,(A4)
		case 0o422: // MOVE.L (An),(A4)
		case 0o423: // MOVE.L (An)+,(A4)
		case 0o424: // MOVE.L -(An),(A4)
		case 0o425: // MOVE.L d(An),(A4)
		case 0o426: // MOVE.L d(An,Xi),(A4)
			return void this.write32(this.rop32(op, true), this.a4);
		case 0o427: // MOVE.L Abs...,(A4)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a4);
		case 0o430: // MOVE.L Dn,(A4)+
		case 0o431: // MOVE.L An,(A4)+
		case 0o432: // MOVE.L (An),(A4)+
		case 0o433: // MOVE.L (An)+,(A4)+
		case 0o434: // MOVE.L -(An),(A4)+
		case 0o435: // MOVE.L d(An),(A4)+
		case 0o436: // MOVE.L d(An,Xi),(A4)+
			this.write32(this.rop32(op, true), this.a4);
			return void(this.a4 = this.a4 + 4 | 0);
		case 0o437: // MOVE.L Abs...,(A4)+
			if ((op & 7) >= 5)
				this.exception(4);
			this.write32(this.rop32(op, true), this.a4);
			return void(this.a4 = this.a4 + 4 | 0);
		case 0o440: // MOVE.L Dn,-(A4)
		case 0o441: // MOVE.L An,-(A4)
		case 0o442: // MOVE.L (An),-(A4)
		case 0o443: // MOVE.L (An)+,-(A4)
		case 0o444: // MOVE.L -(An),-(A4)
		case 0o445: // MOVE.L d(An),-(A4)
		case 0o446: // MOVE.L d(An,Xi),-(A4)
			return void this.write32(this.rop32(op, true), this.a4 = this.a4 - 4 | 0);
		case 0o447: // MOVE.L Abs...,-(A4)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a4 = this.a4 - 4 | 0);
		case 0o450: // MOVE.L Dn,d(A4)
		case 0o451: // MOVE.L An,d(A4)
		case 0o452: // MOVE.L (An),d(A4)
		case 0o453: // MOVE.L (An)+,d(A4)
		case 0o454: // MOVE.L -(An),d(A4)
		case 0o455: // MOVE.L d(An),d(A4)
		case 0o456: // MOVE.L d(An,Xi),d(A4)
			return void this.write32(this.rop32(op, true), this.a4 + this.fetch16s() | 0);
		case 0o457: // MOVE.L Abs...,d(A4)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a4 + this.fetch16s() | 0);
		case 0o460: // MOVE.L Dn,d(A4,Xi)
		case 0o461: // MOVE.L An,d(A4,Xi)
		case 0o462: // MOVE.L (An),d(A4,Xi)
		case 0o463: // MOVE.L (An)+,d(A4,Xi)
		case 0o464: // MOVE.L -(An),d(A4,Xi)
		case 0o465: // MOVE.L d(An),d(A4,Xi)
		case 0o466: // MOVE.L d(An,Xi),d(A4,Xi)
			return void this.write32(this.rop32(op, true), this.index(this.a4));
		case 0o467: // MOVE.L Abs..W,d(A4,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.index(this.a4));
		case 0o500: // MOVE.L Dn,D5
		case 0o501: // MOVE.L An,D5
		case 0o502: // MOVE.L (An),D5
		case 0o503: // MOVE.L (An)+,D5
		case 0o504: // MOVE.L -(An),D5
		case 0o505: // MOVE.L d(An),D5
		case 0o506: // MOVE.L d(An,Xi),D5
			return void(this.d5 = this.rop32(op, true));
		case 0o507: // MOVE.L Abs...,D5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d5 = this.rop32(op, true));
		case 0o510: // MOVEA.L Dn,A5
		case 0o511: // MOVEA.L An,A5
		case 0o512: // MOVEA.L (An),A5
		case 0o513: // MOVEA.L (An)+,A5
		case 0o514: // MOVEA.L -(An),A5
		case 0o515: // MOVEA.L d(An),A5
		case 0o516: // MOVEA.L d(An,Xi),A5
			return void(this.a5 = this.rop32(op));
		case 0o517: // MOVEA.L Abs...,A5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a5 = this.rop32(op));
		case 0o520: // MOVE.L Dn,(A5)
		case 0o521: // MOVE.L An,(A5)
		case 0o522: // MOVE.L (An),(A5)
		case 0o523: // MOVE.L (An)+,(A5)
		case 0o524: // MOVE.L -(An),(A5)
		case 0o525: // MOVE.L d(An),(A5)
		case 0o526: // MOVE.L d(An,Xi),(A5)
			return void this.write32(this.rop32(op, true), this.a5);
		case 0o527: // MOVE.L Abs...,(A5)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a5);
		case 0o530: // MOVE.L Dn,(A5)+
		case 0o531: // MOVE.L An,(A5)+
		case 0o532: // MOVE.L (An),(A5)+
		case 0o533: // MOVE.L (An)+,(A5)+
		case 0o534: // MOVE.L -(An),(A5)+
		case 0o535: // MOVE.L d(An),(A5)+
		case 0o536: // MOVE.L d(An,Xi),(A5)+
			this.write32(this.rop32(op, true), this.a5);
			return void(this.a5 = this.a5 + 4 | 0);
		case 0o537: // MOVE.L Abs...,(A5)+
			if ((op & 7) >= 5)
				return void this.exception(4);
			this.write32(this.rop32(op, true), this.a5);
			return void(this.a5 = this.a5 + 4 | 0);
		case 0o540: // MOVE.L Dn,-(A5)
		case 0o541: // MOVE.L An,-(A5)
		case 0o542: // MOVE.L (An),-(A5)
		case 0o543: // MOVE.L (An)+,-(A5)
		case 0o544: // MOVE.L -(An),-(A5)
		case 0o545: // MOVE.L d(An),-(A5)
		case 0o546: // MOVE.L d(An,Xi),-(A5)
			return void this.write32(this.rop32(op, true), this.a5 = this.a5 - 4 | 0);
		case 0o547: // MOVE.L Abs...,-(A5)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a5 = this.a5 - 4 | 0);
		case 0o550: // MOVE.L Dn,d(A5)
		case 0o551: // MOVE.L An,d(A5)
		case 0o552: // MOVE.L (An),d(A5)
		case 0o553: // MOVE.L (An)+,d(A5)
		case 0o554: // MOVE.L -(An),d(A5)
		case 0o555: // MOVE.L d(An),d(A5)
		case 0o556: // MOVE.L d(An,Xi),d(A5)
			return void this.write32(this.rop32(op, true), this.a5 + this.fetch16s() | 0);
		case 0o557: // MOVE.L Abs...,d(A5)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a5 + this.fetch16s() | 0);
		case 0o560: // MOVE.L Dn,d(A5,Xi)
		case 0o561: // MOVE.L An,d(A5,Xi)
		case 0o562: // MOVE.L (An),d(A5,Xi)
		case 0o563: // MOVE.L (An)+,d(A5,Xi)
		case 0o564: // MOVE.L -(An),d(A5,Xi)
		case 0o565: // MOVE.L d(An),d(A5,Xi)
		case 0o566: // MOVE.L d(An,Xi),d(A5,Xi)
			return void this.write32(this.rop32(op, true), this.index(this.a5));
		case 0o567: // MOVE.L Abs...,d(A5,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.index(this.a5));
		case 0o600: // MOVE.L Dn,D6
		case 0o601: // MOVE.L An,D6
		case 0o602: // MOVE.L (An),D6
		case 0o603: // MOVE.L (An)+,D6
		case 0o604: // MOVE.L -(An),D6
		case 0o605: // MOVE.L d(An),D6
		case 0o606: // MOVE.L d(An,Xi),D6
			return void(this.d6 = this.rop32(op, true));
		case 0o607: // MOVE.L Abs...,D6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d6 = this.rop32(op, true));
		case 0o610: // MOVEA.L Dn,A6
		case 0o611: // MOVEA.L An,A6
		case 0o612: // MOVEA.L (An),A6
		case 0o613: // MOVEA.L (An)+,A6
		case 0o614: // MOVEA.L -(An),A6
		case 0o615: // MOVEA.L d(An),A6
		case 0o616: // MOVEA.L d(An,Xi),A6
			return void(this.a6 = this.rop32(op));
		case 0o617: // MOVEA.L Abs...,A6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a6 = this.rop32(op));
		case 0o620: // MOVE.L Dn,(A6)
		case 0o621: // MOVE.L An,(A6)
		case 0o622: // MOVE.L (An),(A6)
		case 0o623: // MOVE.L (An)+,(A6)
		case 0o624: // MOVE.L -(An),(A6)
		case 0o625: // MOVE.L d(An),(A6)
		case 0o626: // MOVE.L d(An,Xi),(A6)
			return void this.write32(this.rop32(op, true), this.a6);
		case 0o627: // MOVE.L Abs...,(A6)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a6);
		case 0o630: // MOVE.L Dn,(A6)+
		case 0o631: // MOVE.L An,(A6)+
		case 0o632: // MOVE.L (An),(A6)+
		case 0o633: // MOVE.L (An)+,(A6)+
		case 0o634: // MOVE.L -(An),(A6)+
		case 0o635: // MOVE.L d(An),(A6)+
		case 0o636: // MOVE.L d(An,Xi),(A6)+
			this.write32(this.rop32(op, true), this.a6);
			return void(this.a6 = this.a6 + 4 | 0);
		case 0o637: // MOVE.L Abs...,(A6)+
			if ((op & 7) >= 5)
				return void this.exception(4);
			this.write32(this.rop32(op, true), this.a6);
			return void(this.a6 = this.a6 + 4 | 0);
		case 0o640: // MOVE.L Dn,-(A6)
		case 0o641: // MOVE.L An,-(A6)
		case 0o642: // MOVE.L (An),-(A6)
		case 0o643: // MOVE.L (An)+,-(A6)
		case 0o644: // MOVE.L -(An),-(A6)
		case 0o645: // MOVE.L d(An),-(A6)
		case 0o646: // MOVE.L d(An,Xi),-(A6)
			return void this.write32(this.rop32(op, true), this.a6 = this.a6 - 4 | 0);
		case 0o647: // MOVE.L Abs...,-(A6)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a6 = this.a6 - 4 | 0);
		case 0o650: // MOVE.L Dn,d(A6)
		case 0o651: // MOVE.L An,d(A6)
		case 0o652: // MOVE.L (An),d(A6)
		case 0o653: // MOVE.L (An)+,d(A6)
		case 0o654: // MOVE.L -(An),d(A6)
		case 0o655: // MOVE.L d(An),d(A6)
		case 0o656: // MOVE.L d(An,Xi),d(A6)
			return void this.write32(this.rop32(op, true), this.a6 + this.fetch16s() | 0);
		case 0o657: // MOVE.L Abs...,d(A6)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a6 + this.fetch16s() | 0);
		case 0o660: // MOVE.L Dn,d(A6,Xi)
		case 0o661: // MOVE.L An,d(A6,Xi)
		case 0o662: // MOVE.L (An),d(A6,Xi)
		case 0o663: // MOVE.L (An)+,d(A6,Xi)
		case 0o664: // MOVE.L -(An),d(A6,Xi)
		case 0o665: // MOVE.L d(An),d(A6,Xi)
		case 0o666: // MOVE.L d(An,Xi),d(A6,Xi)
			return void this.write32(this.rop32(op, true), this.index(this.a6));
		case 0o667: // MOVE.L Abs...,d(A6,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.index(this.a6));
		case 0o700: // MOVE.L Dn,D7
		case 0o701: // MOVE.L An,D7
		case 0o702: // MOVE.L (An),D7
		case 0o703: // MOVE.L (An)+,D7
		case 0o704: // MOVE.L -(An),D7
		case 0o705: // MOVE.L d(An),D7
		case 0o706: // MOVE.L d(An,Xi),D7
			return void(this.d7 = this.rop32(op, true));
		case 0o707: // MOVE.L Abs...,D7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d7 = this.rop32(op, true));
		case 0o710: // MOVEA.L Dn,A7
		case 0o711: // MOVEA.L An,A7
		case 0o712: // MOVEA.L (An),A7
		case 0o713: // MOVEA.L (An)+,A7
		case 0o714: // MOVEA.L -(An),A7
		case 0o715: // MOVEA.L d(An),A7
		case 0o716: // MOVEA.L d(An,Xi),A7
			return void(this.a7 = this.rop32(op));
		case 0o717: // MOVEA.L Abs...,A7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a7 = this.rop32(op));
		case 0o720: // MOVE.L Dn,(A7)
		case 0o721: // MOVE.L An,(A7)
		case 0o722: // MOVE.L (An),(A7)
		case 0o723: // MOVE.L (An)+,(A7)
		case 0o724: // MOVE.L -(An),(A7)
		case 0o725: // MOVE.L d(An),(A7)
		case 0o726: // MOVE.L d(An,Xi),(A7)
			return void this.write32(this.rop32(op, true), this.a7);
		case 0o727: // MOVE.L Abs...,(A7)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a7);
		case 0o730: // MOVE.L Dn,(A7)+
		case 0o731: // MOVE.L An,(A7)+
		case 0o732: // MOVE.L (An),(A7)+
		case 0o733: // MOVE.L (An)+,(A7)+
		case 0o734: // MOVE.L -(An),(A7)+
		case 0o735: // MOVE.L d(An),(A7)+
		case 0o736: // MOVE.L d(An,Xi),(A7)+
			this.write32(this.rop32(op, true), this.a7);
			return void(this.a7 = this.a7 + 4 | 0);
		case 0o737: // MOVE.L Abs...,(A7)+
			if ((op & 7) >= 5)
				return void this.exception(4);
			this.write32(this.rop32(op, true), this.a7);
			return void(this.a7 = this.a7 + 4 | 0);
		case 0o740: // MOVE.L Dn,-(A7)
		case 0o741: // MOVE.L An,-(A7)
		case 0o742: // MOVE.L (An),-(A7)
		case 0o743: // MOVE.L (An)+,-(A7)
		case 0o744: // MOVE.L -(An),-(A7)
		case 0o745: // MOVE.L d(An),-(A7)
		case 0o746: // MOVE.L d(An,Xi),-(A7)
			return void this.write32(this.rop32(op, true), this.a7 = this.a7 - 4 | 0);
		case 0o747: // MOVE.L Abs...,-(A7)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a7 = this.a7 - 4 | 0);
		case 0o750: // MOVE.L Dn,d(A7)
		case 0o751: // MOVE.L An,d(A7)
		case 0o752: // MOVE.L (An),d(A7)
		case 0o753: // MOVE.L (An)+,d(A7)
		case 0o754: // MOVE.L -(An),d(A7)
		case 0o755: // MOVE.L d(An),d(A7)
		case 0o756: // MOVE.L d(An,Xi),d(A7)
			return void this.write32(this.rop32(op, true), this.a7 + this.fetch16s() | 0);
		case 0o757: // MOVE.L Abs...,d(A7)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.a7 + this.fetch16s() | 0);
		case 0o760: // MOVE.L Dn,d(A7,Xi)
		case 0o761: // MOVE.L An,d(A7,Xi)
		case 0o762: // MOVE.L (An),d(A7,Xi)
		case 0o763: // MOVE.L (An)+,d(A7,Xi)
		case 0o764: // MOVE.L -(An),d(A7,Xi)
		case 0o765: // MOVE.L d(An),d(A7,Xi)
		case 0o766: // MOVE.L d(An,Xi),d(A7,Xi)
			return void this.write32(this.rop32(op, true), this.index(this.a7));
		case 0o767: // MOVE.L Abs...,d(A7,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write32(this.rop32(op, true), this.index(this.a7));
		default:
			return void this.exception(4);
		}
	}

	execute_3(op) {
		switch (op >>> 3 & 0o777) {
		case 0o000: // MOVE.W Dn,D0
		case 0o001: // MOVE.W An,D0
		case 0o002: // MOVE.W (An),D0
		case 0o003: // MOVE.W (An)+,D0
		case 0o004: // MOVE.W -(An),D0
		case 0o005: // MOVE.W d(An),D0
		case 0o006: // MOVE.W d(An,Xi),D0
			return void(this.d0 = this.d0 & ~0xffff | this.rop16(op, true));
		case 0o007: // MOVE.W Abs...,D0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d0 = this.d0 & ~0xffff | this.rop16(op, true));
		case 0o010: // MOVEA.W Dn,A0
		case 0o011: // MOVEA.W An,A0
		case 0o012: // MOVEA.W (An),A0
		case 0o013: // MOVEA.W (An)+,A0
		case 0o014: // MOVEA.W -(An),A0
		case 0o015: // MOVEA.W d(An),A0
		case 0o016: // MOVEA.W d(An,Xi),A0
			return void(this.a0 = (this.a0 = this.rop16(op)) - (this.a0 << 1 & 0x10000));
		case 0o017: // MOVEA.W Abs...,A0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a0 = (this.a0 = this.rop16(op)) - (this.a0 << 1 & 0x10000));
		case 0o020: // MOVE.W Dn,(A0)
		case 0o021: // MOVE.W An,(A0)
		case 0o022: // MOVE.W (An),(A0)
		case 0o023: // MOVE.W (An)+,(A0)
		case 0o024: // MOVE.W -(An),(A0)
		case 0o025: // MOVE.W d(An),(A0)
		case 0o026: // MOVE.W d(An,Xi),(A0)
			return void this.write16(this.rop16(op, true), this.a0);
		case 0o027: // MOVE.W Abs...,(A0)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a0);
		case 0o030: // MOVE.W Dn,(A0)+
		case 0o031: // MOVE.W An,(A0)+
		case 0o032: // MOVE.W (An),(A0)+
		case 0o033: // MOVE.W (An)+,(A0)+
		case 0o034: // MOVE.W -(An),(A0)+
		case 0o035: // MOVE.W d(An),(A0)+
		case 0o036: // MOVE.W d(An,Xi),(A0)+
			this.write16(this.rop16(op, true), this.a0);
			return void(this.a0 = this.a0 + 2 | 0);
		case 0o037: // MOVE.W Abs...,(A0)+
			if ((op & 7) >= 5)
				return void this.exception(4);
			this.write16(this.rop16(op, true), this.a0);
			return void(this.a0 = this.a0 + 2 | 0);
		case 0o040: // MOVE.W Dn,-(A0)
		case 0o041: // MOVE.W An,-(A0)
		case 0o042: // MOVE.W (An),-(A0)
		case 0o043: // MOVE.W (An)+,-(A0)
		case 0o044: // MOVE.W -(An),-(A0)
		case 0o045: // MOVE.W d(An),-(A0)
		case 0o046: // MOVE.W d(An,Xi),-(A0)
			return void this.write16(this.rop16(op, true), this.a0 = this.a0 - 2 | 0);
		case 0o047: // MOVE.W Abs...,-(A0)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a0 = this.a0 - 2 | 0);
		case 0o050: // MOVE.W Dn,d(A0)
		case 0o051: // MOVE.W An,d(A0)
		case 0o052: // MOVE.W (An),d(A0)
		case 0o053: // MOVE.W (An)+,d(A0)
		case 0o054: // MOVE.W -(An),d(A0)
		case 0o055: // MOVE.W d(An),d(A0)
		case 0o056: // MOVE.W d(An,Xi),d(A0)
			return void this.write16(this.rop16(op, true), this.a0 + this.fetch16s() | 0);
		case 0o057: // MOVE.W Abs...,d(A0)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a0 + this.fetch16s() | 0);
		case 0o060: // MOVE.W Dn,d(A0,Xi)
		case 0o061: // MOVE.W An,d(A0,Xi)
		case 0o062: // MOVE.W (An),d(A0,Xi)
		case 0o063: // MOVE.W (An)+,d(A0,Xi)
		case 0o064: // MOVE.W -(An),d(A0,Xi)
		case 0o065: // MOVE.W d(An),d(A0,Xi)
		case 0o066: // MOVE.W d(An,Xi),d(A0,Xi)
			return void this.write16(this.rop16(op, true), this.index(this.a0));
		case 0o067: // MOVE.W Abs...,d(A0,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.index(this.a0));
		case 0o070: // MOVE.W Dn,Abs.W
		case 0o071: // MOVE.W An,Abs.W
		case 0o072: // MOVE.W (An),Abs.W
		case 0o073: // MOVE.W (An)+,Abs.W
		case 0o074: // MOVE.W -(An),Abs.W
		case 0o075: // MOVE.W d(An),Abs.W
		case 0o076: // MOVE.W d(An,Xi),Abs.W
			return void this.write16(this.rop16(op, true), this.fetch16s());
		case 0o077: // MOVE.W Abs...,Abs.W
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.fetch16s());
		case 0o100: // MOVE.W Dn,D1
		case 0o101: // MOVE.W An,D1
		case 0o102: // MOVE.W (An),D1
		case 0o103: // MOVE.W (An)+,D1
		case 0o104: // MOVE.W -(An),D1
		case 0o105: // MOVE.W d(An),D1
		case 0o106: // MOVE.W d(An,Xi),D1
			return void(this.d1 = this.d1 & ~0xffff | this.rop16(op, true));
		case 0o107: // MOVE.W Abs...,D1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d1 = this.d1 & ~0xffff | this.rop16(op, true));
		case 0o110: // MOVEA.W Dn,A1
		case 0o111: // MOVEA.W An,A1
		case 0o112: // MOVEA.W (An),A1
		case 0o113: // MOVEA.W (An)+,A1
		case 0o114: // MOVEA.W -(An),A1
		case 0o115: // MOVEA.W d(An),A1
		case 0o116: // MOVEA.W d(An,Xi),A1
			return void(this.a1 = (this.a1 = this.rop16(op)) - (this.a1 << 1 & 0x10000));
		case 0o117: // MOVEA.W Abs...,A1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a1 = (this.a1 = this.rop16(op)) - (this.a1 << 1 & 0x10000));
		case 0o120: // MOVE.W Dn,(A1)
		case 0o121: // MOVE.W An,(A1)
		case 0o122: // MOVE.W (An),(A1)
		case 0o123: // MOVE.W (An)+,(A1)
		case 0o124: // MOVE.W -(An),(A1)
		case 0o125: // MOVE.W d(An),(A1)
		case 0o126: // MOVE.W d(An,Xi),(A1)
			return void this.write16(this.rop16(op, true), this.a1);
		case 0o127: // MOVE.W Abs...,(A1)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a1);
		case 0o130: // MOVE.W Dn,(A1)+
		case 0o131: // MOVE.W An,(A1)+
		case 0o132: // MOVE.W (An),(A1)+
		case 0o133: // MOVE.W (An)+,(A1)+
		case 0o134: // MOVE.W -(An),(A1)+
		case 0o135: // MOVE.W d(An),(A1)+
		case 0o136: // MOVE.W d(An,Xi),(A1)+
			this.write16(this.rop16(op, true), this.a1);
			return void(this.a1 = this.a1 + 2 | 0);
		case 0o137: // MOVE.W Abs...,(A1)+
			if ((op & 7) >= 5)
				return void this.exception(4);
			this.write16(this.rop16(op, true), this.a1);
			return void(this.a1 = this.a1 + 2 | 0);
		case 0o140: // MOVE.W Dn,-(A1)
		case 0o141: // MOVE.W An,-(A1)
		case 0o142: // MOVE.W (An),-(A1)
		case 0o143: // MOVE.W (An)+,-(A1)
		case 0o144: // MOVE.W -(An),-(A1)
		case 0o145: // MOVE.W d(An),-(A1)
		case 0o146: // MOVE.W d(An,Xi),-(A1)
			return void this.write16(this.rop16(op, true), this.a1 = this.a1 - 2 | 0);
		case 0o147: // MOVE.W Abs...,-(A1)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a1 = this.a1 - 2 | 0);
		case 0o150: // MOVE.W Dn,d(A1)
		case 0o151: // MOVE.W An,d(A1)
		case 0o152: // MOVE.W (An),d(A1)
		case 0o153: // MOVE.W (An)+,d(A1)
		case 0o154: // MOVE.W -(An),d(A1)
		case 0o155: // MOVE.W d(An),d(A1)
		case 0o156: // MOVE.W d(An,Xi),d(A1)
			return void this.write16(this.rop16(op, true), this.a1 + this.fetch16s() | 0);
		case 0o157: // MOVE.W Abs...,d(A1)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a1 + this.fetch16s() | 0);
		case 0o160: // MOVE.W Dn,d(A1,Xi)
		case 0o161: // MOVE.W An,d(A1,Xi)
		case 0o162: // MOVE.W (An),d(A1,Xi)
		case 0o163: // MOVE.W (An)+,d(A1,Xi)
		case 0o164: // MOVE.W -(An),d(A1,Xi)
		case 0o165: // MOVE.W d(An),d(A1,Xi)
		case 0o166: // MOVE.W d(An,Xi),d(A1,Xi)
			return void this.write16(this.rop16(op, true), this.index(this.a1));
		case 0o167: // MOVE.W Abs...,d(A1,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.index(this.a1));
		case 0o170: // MOVE.W Dn,Abs.L
		case 0o171: // MOVE.W An,Abs.L
		case 0o172: // MOVE.W (An),Abs.L
		case 0o173: // MOVE.W (An)+,Abs.L
		case 0o174: // MOVE.W -(An),Abs.L
		case 0o175: // MOVE.W d(An),Abs.L
		case 0o176: // MOVE.W d(An,Xi),Abs.L
			return void this.write16(this.rop16(op, true), this.fetch32());
		case 0o177: // MOVE.W Abs...,Abs.L
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.fetch32());
		case 0o200: // MOVE.W Dn,D2
		case 0o201: // MOVE.W An,D2
		case 0o202: // MOVE.W (An),D2
		case 0o203: // MOVE.W (An)+,D2
		case 0o204: // MOVE.W -(An),D2
		case 0o205: // MOVE.W d(An),D2
		case 0o206: // MOVE.W d(An,Xi),D2
			return void(this.d2 = this.d2 & ~0xffff | this.rop16(op, true));
		case 0o207: // MOVE.W Abs...,D2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d2 = this.d2 & ~0xffff | this.rop16(op, true));
		case 0o210: // MOVEA.W Dn,A2
		case 0o211: // MOVEA.W An,A2
		case 0o212: // MOVEA.W (An),A2
		case 0o213: // MOVEA.W (An)+,A2
		case 0o214: // MOVEA.W -(An),A2
		case 0o215: // MOVEA.W d(An),A2
		case 0o216: // MOVEA.W d(An,Xi),A2
			return void(this.a2 = (this.a2 = this.rop16(op)) - (this.a2 << 1 & 0x10000));
		case 0o217: // MOVEA.W Abs...,A2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a2 = (this.a2 = this.rop16(op)) - (this.a2 << 1 & 0x10000));
		case 0o220: // MOVE.W Dn,(A2)
		case 0o221: // MOVE.W An,(A2)
		case 0o222: // MOVE.W (An),(A2)
		case 0o223: // MOVE.W (An)+,(A2)
		case 0o224: // MOVE.W -(An),(A2)
		case 0o225: // MOVE.W d(An),(A2)
		case 0o226: // MOVE.W d(An,Xi),(A2)
			return void this.write16(this.rop16(op, true), this.a2);
		case 0o227: // MOVE.W Abs...,(A2)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a2);
		case 0o230: // MOVE.W Dn,(A2)+
		case 0o231: // MOVE.W An,(A2)+
		case 0o232: // MOVE.W (An),(A2)+
		case 0o233: // MOVE.W (An)+,(A2)+
		case 0o234: // MOVE.W -(An),(A2)+
		case 0o235: // MOVE.W d(An),(A2)+
		case 0o236: // MOVE.W d(An,Xi),(A2)+
			this.write16(this.rop16(op, true), this.a2);
			return void(this.a2 = this.a2 + 2 | 0);
		case 0o237: // MOVE.W Abs...,(A2)+
			if ((op & 7) >= 5)
				return void this.exception(4);
			this.write16(this.rop16(op, true), this.a2);
			return void(this.a2 = this.a2 + 2 | 0);
		case 0o240: // MOVE.W Dn,-(A2)
		case 0o241: // MOVE.W An,-(A2)
		case 0o242: // MOVE.W (An),-(A2)
		case 0o243: // MOVE.W (An)+,-(A2)
		case 0o244: // MOVE.W -(An),-(A2)
		case 0o245: // MOVE.W d(An),-(A2)
		case 0o246: // MOVE.W d(An,Xi),-(A2)
			return void this.write16(this.rop16(op, true), this.a2 = this.a2 - 2 | 0);
		case 0o247: // MOVE.W Abs...,-(A2)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a2 = this.a2 - 2 | 0);
		case 0o250: // MOVE.W Dn,d(A2)
		case 0o251: // MOVE.W An,d(A2)
		case 0o252: // MOVE.W (An),d(A2)
		case 0o253: // MOVE.W (An)+,d(A2)
		case 0o254: // MOVE.W -(An),d(A2)
		case 0o255: // MOVE.W d(An),d(A2)
		case 0o256: // MOVE.W d(An,Xi),d(A2)
			return void this.write16(this.rop16(op, true), this.a2 + this.fetch16s() | 0);
		case 0o257: // MOVE.W Abs...,d(A2)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a2 + this.fetch16s() | 0);
		case 0o260: // MOVE.W Dn,d(A2,Xi)
		case 0o261: // MOVE.W An,d(A2,Xi)
		case 0o262: // MOVE.W (An),d(A2,Xi)
		case 0o263: // MOVE.W (An)+,d(A2,Xi)
		case 0o264: // MOVE.W -(An),d(A2,Xi)
		case 0o265: // MOVE.W d(An),d(A2,Xi)
		case 0o266: // MOVE.W d(An,Xi),d(A2,Xi)
			return void this.write16(this.rop16(op, true), this.index(this.a2));
		case 0o267: // MOVE.W Abs...,d(A2,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.index(this.a2));
		case 0o300: // MOVE.W Dn,D3
		case 0o301: // MOVE.W An,D3
		case 0o302: // MOVE.W (An),D3
		case 0o303: // MOVE.W (An)+,D3
		case 0o304: // MOVE.W -(An),D3
		case 0o305: // MOVE.W d(An),D3
		case 0o306: // MOVE.W d(An,Xi),D3
			return void(this.d3 = this.d3 & ~0xffff | this.rop16(op, true));
		case 0o307: // MOVE.W Abs...,D3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d3 = this.d3 & ~0xffff | this.rop16(op, true));
		case 0o310: // MOVEA.W Dn,A3
		case 0o311: // MOVEA.W An,A3
		case 0o312: // MOVEA.W (An),A3
		case 0o313: // MOVEA.W (An)+,A3
		case 0o314: // MOVEA.W -(An),A3
		case 0o315: // MOVEA.W d(An),A3
		case 0o316: // MOVEA.W d(An,Xi),A3
			return void(this.a3 = (this.a3 = this.rop16(op)) - (this.a3 << 1 & 0x10000));
		case 0o317: // MOVEA.W Abs...,A3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a3 = (this.a3 = this.rop16(op)) - (this.a3 << 1 & 0x10000));
		case 0o320: // MOVE.W Dn,(A3)
		case 0o321: // MOVE.W An,(A3)
		case 0o322: // MOVE.W (An),(A3)
		case 0o323: // MOVE.W (An)+,(A3)
		case 0o324: // MOVE.W -(An),(A3)
		case 0o325: // MOVE.W d(An),(A3)
		case 0o326: // MOVE.W d(An,Xi),(A3)
			return void this.write16(this.rop16(op, true), this.a3);
		case 0o327: // MOVE.W Abs...,(A3)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a3);
		case 0o330: // MOVE.W Dn,(A3)+
		case 0o331: // MOVE.W An,(A3)+
		case 0o332: // MOVE.W (An),(A3)+
		case 0o333: // MOVE.W (An)+,(A3)+
		case 0o334: // MOVE.W -(An),(A3)+
		case 0o335: // MOVE.W d(An),(A3)+
		case 0o336: // MOVE.W d(An,Xi),(A3)+
			this.write16(this.rop16(op, true), this.a3);
			return void(this.a3 = this.a3 + 2 | 0);
		case 0o337: // MOVE.W Abs...,(A3)+
			if ((op & 7) >= 5)
				return void this.exception(4);
			this.write16(this.rop16(op, true), this.a3);
			return void(this.a3 = this.a3 + 2 | 0);
		case 0o340: // MOVE.W Dn,-(A3)
		case 0o341: // MOVE.W An,-(A3)
		case 0o342: // MOVE.W (An),-(A3)
		case 0o343: // MOVE.W (An)+,-(A3)
		case 0o344: // MOVE.W -(An),-(A3)
		case 0o345: // MOVE.W d(An),-(A3)
		case 0o346: // MOVE.W d(An,Xi),-(A3)
			return void this.write16(this.rop16(op, true), this.a3 = this.a3 - 2 | 0);
		case 0o347: // MOVE.W Abs...,-(A3)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a3 = this.a3 - 2 | 0);
		case 0o350: // MOVE.W Dn,d(A3)
		case 0o351: // MOVE.W An,d(A3)
		case 0o352: // MOVE.W (An),d(A3)
		case 0o353: // MOVE.W (An)+,d(A3)
		case 0o354: // MOVE.W -(An),d(A3)
		case 0o355: // MOVE.W d(An),d(A3)
		case 0o356: // MOVE.W d(An,Xi),d(A3)
			return void this.write16(this.rop16(op, true), this.a3 + this.fetch16s() | 0);
		case 0o357: // MOVE.W Abs...,d(A3)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a3 + this.fetch16s() | 0);
		case 0o360: // MOVE.W Dn,d(A3,Xi)
		case 0o361: // MOVE.W An,d(A3,Xi)
		case 0o362: // MOVE.W (An),d(A3,Xi)
		case 0o363: // MOVE.W (An)+,d(A3,Xi)
		case 0o364: // MOVE.W -(An),d(A3,Xi)
		case 0o365: // MOVE.W d(An),d(A3,Xi)
		case 0o366: // MOVE.W d(An,Xi),d(A3,Xi)
			return void this.write16(this.rop16(op, true), this.index(this.a3));
		case 0o367: // MOVE.W Abs...,d(A3,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.index(this.a3));
		case 0o400: // MOVE.W Dn,D4
		case 0o401: // MOVE.W An,D4
		case 0o402: // MOVE.W (An),D4
		case 0o403: // MOVE.W (An)+,D4
		case 0o404: // MOVE.W -(An),D4
		case 0o405: // MOVE.W d(An),D4
		case 0o406: // MOVE.W d(An,Xi),D4
			return void(this.d4 = this.d4 & ~0xffff | this.rop16(op, true));
		case 0o407: // MOVE.W Abs...,D4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d4 = this.d4 & ~0xffff | this.rop16(op, true));
		case 0o410: // MOVEA.W Dn,A4
		case 0o411: // MOVEA.W An,A4
		case 0o412: // MOVEA.W (An),A4
		case 0o413: // MOVEA.W (An)+,A4
		case 0o414: // MOVEA.W -(An),A4
		case 0o415: // MOVEA.W d(An),A4
		case 0o416: // MOVEA.W d(An,Xi),A4
			return void(this.a4 = (this.a4 = this.rop16(op)) - (this.a4 << 1 & 0x10000));
		case 0o417: // MOVEA.W Abs...,A4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a4 = (this.a4 = this.rop16(op)) - (this.a4 << 1 & 0x10000));
		case 0o420: // MOVE.W Dn,(A4)
		case 0o421: // MOVE.W An,(A4)
		case 0o422: // MOVE.W (An),(A4)
		case 0o423: // MOVE.W (An)+,(A4)
		case 0o424: // MOVE.W -(An),(A4)
		case 0o425: // MOVE.W d(An),(A4)
		case 0o426: // MOVE.W d(An,Xi),(A4)
			return void this.write16(this.rop16(op, true), this.a4);
		case 0o427: // MOVE.W Abs...,(A4)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a4);
		case 0o430: // MOVE.W Dn,(A4)+
		case 0o431: // MOVE.W An,(A4)+
		case 0o432: // MOVE.W (An),(A4)+
		case 0o433: // MOVE.W (An)+,(A4)+
		case 0o434: // MOVE.W -(An),(A4)+
		case 0o435: // MOVE.W d(An),(A4)+
		case 0o436: // MOVE.W d(An,Xi),(A4)+
			this.write16(this.rop16(op, true), this.a4);
			return void(this.a4 = this.a4 + 2 | 0);
		case 0o437: // MOVE.W Abs...,(A4)+
			if ((op & 7) >= 5)
				return void this.exception(4);
			this.write16(this.rop16(op, true), this.a4);
			return void(this.a4 = this.a4 + 2 | 0);
		case 0o440: // MOVE.W Dn,-(A4)
		case 0o441: // MOVE.W An,-(A4)
		case 0o442: // MOVE.W (An),-(A4)
		case 0o443: // MOVE.W (An)+,-(A4)
		case 0o444: // MOVE.W -(An),-(A4)
		case 0o445: // MOVE.W d(An),-(A4)
		case 0o446: // MOVE.W d(An,Xi),-(A4)
			return void this.write16(this.rop16(op, true), this.a4 = this.a4 - 2 | 0);
		case 0o447: // MOVE.W Abs...,-(A4)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a4 = this.a4 - 2 | 0);
		case 0o450: // MOVE.W Dn,d(A4)
		case 0o451: // MOVE.W An,d(A4)
		case 0o452: // MOVE.W (An),d(A4)
		case 0o453: // MOVE.W (An)+,d(A4)
		case 0o454: // MOVE.W -(An),d(A4)
		case 0o455: // MOVE.W d(An),d(A4)
		case 0o456: // MOVE.W d(An,Xi),d(A4)
			return void this.write16(this.rop16(op, true), this.a4 + this.fetch16s() | 0);
		case 0o457: // MOVE.W Abs...,d(A4)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a4 + this.fetch16s() | 0);
		case 0o460: // MOVE.W Dn,d(A4,Xi)
		case 0o461: // MOVE.W An,d(A4,Xi)
		case 0o462: // MOVE.W (An),d(A4,Xi)
		case 0o463: // MOVE.W (An)+,d(A4,Xi)
		case 0o464: // MOVE.W -(An),d(A4,Xi)
		case 0o465: // MOVE.W d(An),d(A4,Xi)
		case 0o466: // MOVE.W d(An,Xi),d(A4,Xi)
			return void this.write16(this.rop16(op, true), this.index(this.a4));
		case 0o467: // MOVE.W Abs...,d(A4,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.index(this.a4));
		case 0o500: // MOVE.W Dn,D5
		case 0o501: // MOVE.W An,D5
		case 0o502: // MOVE.W (An),D5
		case 0o503: // MOVE.W (An)+,D5
		case 0o504: // MOVE.W -(An),D5
		case 0o505: // MOVE.W d(An),D5
		case 0o506: // MOVE.W d(An,Xi),D5
			return void(this.d5 = this.d5 & ~0xffff | this.rop16(op, true));
		case 0o507: // MOVE.W Abs...,D5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d5 = this.d5 & ~0xffff | this.rop16(op, true));
		case 0o510: // MOVEA.W Dn,A5
		case 0o511: // MOVEA.W An,A5
		case 0o512: // MOVEA.W (An),A5
		case 0o513: // MOVEA.W (An)+,A5
		case 0o514: // MOVEA.W -(An),A5
		case 0o515: // MOVEA.W d(An),A5
		case 0o516: // MOVEA.W d(An,Xi),A5
			return void(this.a5 = (this.a5 = this.rop16(op)) - (this.a5 << 1 & 0x10000));
		case 0o517: // MOVEA.W Abs...,A5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a5 = (this.a5 = this.rop16(op)) - (this.a5 << 1 & 0x10000));
		case 0o520: // MOVE.W Dn,(A5)
		case 0o521: // MOVE.W An,(A5)
		case 0o522: // MOVE.W (An),(A5)
		case 0o523: // MOVE.W (An)+,(A5)
		case 0o524: // MOVE.W -(An),(A5)
		case 0o525: // MOVE.W d(An),(A5)
		case 0o526: // MOVE.W d(An,Xi),(A5)
			return void this.write16(this.rop16(op, true), this.a5);
		case 0o527: // MOVE.W Abs...,(A5)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a5);
		case 0o530: // MOVE.W Dn,(A5)+
		case 0o531: // MOVE.W An,(A5)+
		case 0o532: // MOVE.W (An),(A5)+
		case 0o533: // MOVE.W (An)+,(A5)+
		case 0o534: // MOVE.W -(An),(A5)+
		case 0o535: // MOVE.W d(An),(A5)+
		case 0o536: // MOVE.W d(An,Xi),(A5)+
			this.write16(this.rop16(op, true), this.a5);
			return void(this.a5 = this.a5 + 2 | 0);
		case 0o537: // MOVE.W Abs...,(A5)+
			if ((op & 7) >= 5)
				return void this.exception(4);
			this.write16(this.rop16(op, true), this.a5);
			return void(this.a5 = this.a5 + 2 | 0);
		case 0o540: // MOVE.W Dn,-(A5)
		case 0o541: // MOVE.W An,-(A5)
		case 0o542: // MOVE.W (An),-(A5)
		case 0o543: // MOVE.W (An)+,-(A5)
		case 0o544: // MOVE.W -(An),-(A5)
		case 0o545: // MOVE.W d(An),-(A5)
		case 0o546: // MOVE.W d(An,Xi),-(A5)
			return void this.write16(this.rop16(op, true), this.a5 = this.a5 - 2 | 0);
		case 0o547: // MOVE.W Abs...,-(A5)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a5 = this.a5 - 2 | 0);
		case 0o550: // MOVE.W Dn,d(A5)
		case 0o551: // MOVE.W An,d(A5)
		case 0o552: // MOVE.W (An),d(A5)
		case 0o553: // MOVE.W (An)+,d(A5)
		case 0o554: // MOVE.W -(An),d(A5)
		case 0o555: // MOVE.W d(An),d(A5)
		case 0o556: // MOVE.W d(An,Xi),d(A5)
			return void this.write16(this.rop16(op, true), this.a5 + this.fetch16s() | 0);
		case 0o557: // MOVE.W Abs...,d(A5)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a5 + this.fetch16s() | 0);
		case 0o560: // MOVE.W Dn,d(A5,Xi)
		case 0o561: // MOVE.W An,d(A5,Xi)
		case 0o562: // MOVE.W (An),d(A5,Xi)
		case 0o563: // MOVE.W (An)+,d(A5,Xi)
		case 0o564: // MOVE.W -(An),d(A5,Xi)
		case 0o565: // MOVE.W d(An),d(A5,Xi)
		case 0o566: // MOVE.W d(An,Xi),d(A5,Xi)
			return void this.write16(this.rop16(op, true), this.index(this.a5));
		case 0o567: // MOVE.W Abs...,d(A5,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.index(this.a5));
		case 0o600: // MOVE.W Dn,D6
		case 0o601: // MOVE.W An,D6
		case 0o602: // MOVE.W (An),D6
		case 0o603: // MOVE.W (An)+,D6
		case 0o604: // MOVE.W -(An),D6
		case 0o605: // MOVE.W d(An),D6
		case 0o606: // MOVE.W d(An,Xi),D6
			return void(this.d6 = this.d6 & ~0xffff | this.rop16(op, true));
		case 0o607: // MOVE.W Abs...,D6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d6 = this.d6 & ~0xffff | this.rop16(op, true));
		case 0o610: // MOVEA.W Dn,A6
		case 0o611: // MOVEA.W An,A6
		case 0o612: // MOVEA.W (An),A6
		case 0o613: // MOVEA.W (An)+,A6
		case 0o614: // MOVEA.W -(An),A6
		case 0o615: // MOVEA.W d(An),A6
		case 0o616: // MOVEA.W d(An,Xi),A6
			return void(this.a6 = (this.a6 = this.rop16(op)) - (this.a6 << 1 & 0x10000));
		case 0o617: // MOVEA.W Abs...,A6
			if ((op & 7) >= 5)
				return this.exception(4);
			return void(this.a6 = (this.a6 = this.rop16(op)) - (this.a6 << 1 & 0x10000));
		case 0o620: // MOVE.W Dn,(A6)
		case 0o621: // MOVE.W An,(A6)
		case 0o622: // MOVE.W (An),(A6)
		case 0o623: // MOVE.W (An)+,(A6)
		case 0o624: // MOVE.W -(An),(A6)
		case 0o625: // MOVE.W d(An),(A6)
		case 0o626: // MOVE.W d(An,Xi),(A6)
			return void this.write16(this.rop16(op, true), this.a6);
		case 0o627: // MOVE.W Abs...,(A6)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a6);
		case 0o630: // MOVE.W Dn,(A6)+
		case 0o631: // MOVE.W An,(A6)+
		case 0o632: // MOVE.W (An),(A6)+
		case 0o633: // MOVE.W (An)+,(A6)+
		case 0o634: // MOVE.W -(An),(A6)+
		case 0o635: // MOVE.W d(An),(A6)+
		case 0o636: // MOVE.W d(An,Xi),(A6)+
			this.write16(this.rop16(op, true), this.a6);
			return void(this.a6 = this.a6 + 2 | 0);
		case 0o637: // MOVE.W Abs...,(A6)+
			if ((op & 7) >= 5)
				return void this.exception(4);
			this.write16(this.rop16(op, true), this.a6);
			return void(this.a6 = this.a6 + 2 | 0);
		case 0o640: // MOVE.W Dn,-(A6)
		case 0o641: // MOVE.W An,-(A6)
		case 0o642: // MOVE.W (An),-(A6)
		case 0o643: // MOVE.W (An)+,-(A6)
		case 0o644: // MOVE.W -(An),-(A6)
		case 0o645: // MOVE.W d(An),-(A6)
		case 0o646: // MOVE.W d(An,Xi),-(A6)
			return void this.write16(this.rop16(op, true), this.a6 = this.a6 - 2 | 0);
		case 0o647: // MOVE.W Abs...,-(A6)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a6 = this.a6 - 2 | 0);
		case 0o650: // MOVE.W Dn,d(A6)
		case 0o651: // MOVE.W An,d(A6)
		case 0o652: // MOVE.W (An),d(A6)
		case 0o653: // MOVE.W (An)+,d(A6)
		case 0o654: // MOVE.W -(An),d(A6)
		case 0o655: // MOVE.W d(An),d(A6)
		case 0o656: // MOVE.W d(An,Xi),d(A6)
			return void this.write16(this.rop16(op, true), this.a6 + this.fetch16s() | 0);
		case 0o657: // MOVE.W Abs...,d(A6)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a6 + this.fetch16s() | 0);
		case 0o660: // MOVE.W Dn,d(A6,Xi)
		case 0o661: // MOVE.W An,d(A6,Xi)
		case 0o662: // MOVE.W (An),d(A6,Xi)
		case 0o663: // MOVE.W (An)+,d(A6,Xi)
		case 0o664: // MOVE.W -(An),d(A6,Xi)
		case 0o665: // MOVE.W d(An),d(A6,Xi)
		case 0o666: // MOVE.W d(An,Xi),d(A6,Xi)
			return void this.write16(this.rop16(op, true), this.index(this.a6));
		case 0o667: // MOVE.W Abs...,d(A6,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.index(this.a6));
		case 0o700: // MOVE.W Dn,D7
		case 0o701: // MOVE.W An,D7
		case 0o702: // MOVE.W (An),D7
		case 0o703: // MOVE.W (An)+,D7
		case 0o704: // MOVE.W -(An),D7
		case 0o705: // MOVE.W d(An),D7
		case 0o706: // MOVE.W d(An,Xi),D7
			return void(this.d7 = this.d7 & ~0xffff | this.rop16(op, true));
		case 0o707: // MOVE.W Abs...,D7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d7 = this.d7 & ~0xffff | this.rop16(op, true));
		case 0o710: // MOVEA.W Dn,A7
		case 0o711: // MOVEA.W An,A7
		case 0o712: // MOVEA.W (An),A7
		case 0o713: // MOVEA.W (An)+,A7
		case 0o714: // MOVEA.W -(An),A7
		case 0o715: // MOVEA.W d(An),A7
		case 0o716: // MOVEA.W d(An,Xi),A7
			return void(this.a7 = (this.a7 = this.rop16(op)) - (this.a7 << 1 & 0x10000));
		case 0o717: // MOVEA.W Abs...,A7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a7 = (this.a7 = this.rop16(op)) - (this.a7 << 1 & 0x10000));
		case 0o720: // MOVE.W Dn,(A7)
		case 0o721: // MOVE.W An,(A7)
		case 0o722: // MOVE.W (An),(A7)
		case 0o723: // MOVE.W (An)+,(A7)
		case 0o724: // MOVE.W -(An),(A7)
		case 0o725: // MOVE.W d(An),(A7)
		case 0o726: // MOVE.W d(An,Xi),(A7)
			return void this.write16(this.rop16(op, true), this.a7);
		case 0o727: // MOVE.W Abs...,(A7)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a7);
		case 0o730: // MOVE.W Dn,(A7)+
		case 0o731: // MOVE.W An,(A7)+
		case 0o732: // MOVE.W (An),(A7)+
		case 0o733: // MOVE.W (An)+,(A7)+
		case 0o734: // MOVE.W -(An),(A7)+
		case 0o735: // MOVE.W d(An),(A7)+
		case 0o736: // MOVE.W d(An,Xi),(A7)+
			this.write16(this.rop16(op, true), this.a7);
			return void(this.a7 = this.a7 + 2 | 0);
		case 0o737: // MOVE.W Abs...,(A7)+
			if ((op & 7) >= 5)
				return void this.exception(4);
			this.write16(this.rop16(op, true), this.a7);
			return void(this.a7 = this.a7 + 2 | 0);
		case 0o740: // MOVE.W Dn,-(A7)
		case 0o741: // MOVE.W An,-(A7)
		case 0o742: // MOVE.W (An),-(A7)
		case 0o743: // MOVE.W (An)+,-(A7)
		case 0o744: // MOVE.W -(An),-(A7)
		case 0o745: // MOVE.W d(An),-(A7)
		case 0o746: // MOVE.W d(An,Xi),-(A7)
			return void this.write16(this.rop16(op, true), this.a7 = this.a7 - 2 | 0);
		case 0o747: // MOVE.W Abs...,-(A7)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a7 = this.a7 - 2 | 0);
		case 0o750: // MOVE.W Dn,d(A7)
		case 0o751: // MOVE.W An,d(A7)
		case 0o752: // MOVE.W (An),d(A7)
		case 0o753: // MOVE.W (An)+,d(A7)
		case 0o754: // MOVE.W -(An),d(A7)
		case 0o755: // MOVE.W d(An),d(A7)
		case 0o756: // MOVE.W d(An,Xi),d(A7)
			return void this.write16(this.rop16(op, true), this.a7 + this.fetch16s() | 0);
		case 0o757: // MOVE.W Abs...,d(A7)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.a7 + this.fetch16s() | 0);
		case 0o760: // MOVE.W Dn,d(A7,Xi)
		case 0o761: // MOVE.W An,d(A7,Xi)
		case 0o762: // MOVE.W (An),d(A7,Xi)
		case 0o763: // MOVE.W (An)+,d(A7,Xi)
		case 0o764: // MOVE.W -(An),d(A7,Xi)
		case 0o765: // MOVE.W d(An),d(A7,Xi)
		case 0o766: // MOVE.W d(An,Xi),d(A7,Xi)
			return void this.write16(this.rop16(op, true), this.index(this.a7));
		case 0o767: // MOVE.W Abs...,d(A7,Xi)
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.write16(this.rop16(op, true), this.index(this.a7));
		default:
			return void this.exception(4);
		}
	}

	execute_4(op) {
		switch (op >>> 3 & 0o777) {
		case 0o000: // NEGX.B Dn
		case 0o002: // NEGX.B (An)
		case 0o003: // NEGX.B (An)+
		case 0o004: // NEGX.B -(An)
		case 0o005: // NEGX.B d(An)
		case 0o006: // NEGX.B d(An,Xi)
			return void this.rwop8(op, this.negx8);
		case 0o007: // NEGX.B Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.negx8);
		case 0o010: // NEGX.W Dn
		case 0o012: // NEGX.W (An)
		case 0o013: // NEGX.W (An)+
		case 0o014: // NEGX.W -(An)
		case 0o015: // NEGX.W d(An)
		case 0o016: // NEGX.W d(An,Xi)
			return void this.rwop16(op, this.negx16);
		case 0o017: // NEGX.W Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.negx16);
		case 0o020: // NEGX.L Dn
		case 0o022: // NEGX.L (An)
		case 0o023: // NEGX.L (An)+
		case 0o024: // NEGX.L -(An)
		case 0o025: // NEGX.L d(An)
		case 0o026: // NEGX.L d(An,Xi)
			return void this.rwop32(op, this.negx32);
		case 0o027: // NEGX.L Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.negx32);
		case 0o030: // MOVE SR,Dn
		case 0o032: // MOVE SR,(An)
		case 0o033: // MOVE SR,(An)+
		case 0o034: // MOVE SR,-(An)
		case 0o035: // MOVE SR,d(An)
		case 0o036: // MOVE SR,d(An,Xi)
			return void this.rwop16(op, src => src, this.sr);
		case 0o037: // MOVE SR,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, src => src, this.sr);
		case 0o060: // CHK Dn,D0
		case 0o062: // CHK (An),D0
		case 0o063: // CHK (An)+,D0
		case 0o064: // CHK -(An),D0
		case 0o065: // CHK d(An),D0
		case 0o066: // CHK d(An,Xi),D0
			return void this.chk(this.rop16(op), this.d0);
		case 0o067: // CHK Abs...,D0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.chk(this.rop16(op), this.d0);
		case 0o072: // LEA (An),A0
		case 0o075: // LEA d(An),A0
		case 0o076: // LEA d(An,Xi),A0
			return void(this.a0 = this.lea(op));
		case 0o077: // LEA Abs...,A0
			if ((op & 7) >= 4)
				return void this.exception(4);
			return void(this.a0 = this.lea(op));
		case 0o100: // CLR.B Dn
		case 0o102: // CLR.B (An)
		case 0o103: // CLR.B (An)+
		case 0o104: // CLR.B -(An)
		case 0o105: // CLR.B d(An)
		case 0o106: // CLR.B d(An,Xi)
			return void this.rwop8(op, this.clr);
		case 0o107: // CLR.B Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.clr);
		case 0o110: // CLR.W Dn
		case 0o112: // CLR.W (An)
		case 0o113: // CLR.W (An)+
		case 0o114: // CLR.W -(An)
		case 0o115: // CLR.W d(An)
		case 0o116: // CLR.W d(An,Xi)
			return void this.rwop16(op, this.clr);
		case 0o117: // CLR.W Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.clr);
		case 0o120: // CLR.L Dn
		case 0o122: // CLR.L (An)
		case 0o123: // CLR.L (An)+
		case 0o124: // CLR.L -(An)
		case 0o125: // CLR.L d(An)
		case 0o126: // CLR.L d(An,Xi)
			return void this.rwop32(op, this.clr);
		case 0o127: // CLR.L Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.clr);
		case 0o160: // CHK Dn,D1
		case 0o162: // CHK (An),D1
		case 0o163: // CHK (An)+,D1
		case 0o164: // CHK -(An),D1
		case 0o165: // CHK d(An),D1
		case 0o166: // CHK d(An,Xi),D1
			return void this.chk(this.rop16(op), this.d1);
		case 0o167: // CHK Abs...,D1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.chk(this.rop16(op), this.d1);
		case 0o172: // LEA (An),A1
		case 0o175: // LEA d(An),A1
		case 0o176: // LEA d(An,Xi),A1
			return void(this.a1 = this.lea(op));
		case 0o177: // LEA Abs...,A1
			if ((op & 7) >= 4)
				return void this.exception(4);
			return void(this.a1 = this.lea(op));
		case 0o200: // NEG.B Dn
		case 0o202: // NEG.B (An)
		case 0o203: // NEG.B (An)+
		case 0o204: // NEG.B -(An)
		case 0o205: // NEG.B d(An)
		case 0o206: // NEG.B d(An,Xi)
			return void this.rwop8(op, this.neg8);
		case 0o207: // NEG.B Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.neg8);
		case 0o210: // NEG.W Dn
		case 0o212: // NEG.W (An)
		case 0o213: // NEG.W (An)+
		case 0o214: // NEG.W -(An)
		case 0o215: // NEG.W d(An)
		case 0o216: // NEG.W d(An,Xi)
			return void this.rwop16(op, this.neg16);
		case 0o217: // NEG.W Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.neg16);
		case 0o220: // NEG.L Dn
		case 0o222: // NEG.L (An)
		case 0o223: // NEG.L (An)+
		case 0o224: // NEG.L -(An)
		case 0o225: // NEG.L d(An)
		case 0o226: // NEG.L d(An,Xi)
			return void this.rwop32(op, this.neg32);
		case 0o227: // NEG.L Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.neg32);
		case 0o230: // MOVE Dn,CCR
		case 0o232: // MOVE (An),CCR
		case 0o233: // MOVE (An)+,CCR
		case 0o234: // MOVE -(An),CCR
		case 0o235: // MOVE d(An),CCR
		case 0o236: // MOVE d(An,Xi),CCR
			return void(this.sr = this.sr & ~0xff | this.rop16(op) & 0xff);
		case 0o237: // MOVE Abs...,CCR
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.sr = this.sr & ~0xff | this.rop16(op) & 0xff);
		case 0o260: // CHK Dn,D2
		case 0o262: // CHK (An),D2
		case 0o263: // CHK (An)+,D2
		case 0o264: // CHK -(An),D2
		case 0o265: // CHK d(An),D2
		case 0o266: // CHK d(An,Xi),D2
			return void this.chk(this.rop16(op), this.d2);
		case 0o267: // CHK Abs...,D2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.chk(this.rop16(op), this.d2);
		case 0o272: // LEA (An),A2
		case 0o275: // LEA d(An),A2
		case 0o276: // LEA d(An,Xi),A2
			return void(this.a2 = this.lea(op));
		case 0o277: // LEA Abs...,A2
			if ((op & 7) >= 4)
				return void this.exception(4);
			return void(this.a2 = this.lea(op));
		case 0o300: // NOT.B Dn
		case 0o302: // NOT.B (An)
		case 0o303: // NOT.B (An)+
		case 0o304: // NOT.B -(An)
		case 0o305: // NOT.B d(An)
		case 0o306: // NOT.B d(An,Xi)
			return void this.rwop8(op, this.not8);
		case 0o307: // NOT.B Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.not8);
		case 0o310: // NOT.W Dn
		case 0o312: // NOT.W (An)
		case 0o313: // NOT.W (An)+
		case 0o314: // NOT.W -(An)
		case 0o315: // NOT.W d(An)
		case 0o316: // NOT.W d(An,Xi)
			return void this.rwop16(op, this.not16);
		case 0o317: // NOT.W Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.not16);
		case 0o320: // NOT.L Dn
		case 0o322: // NOT.L (An)
		case 0o323: // NOT.L (An)+
		case 0o324: // NOT.L -(An)
		case 0o325: // NOT.L d(An)
		case 0o326: // NOT.L d(An,Xi)
			return void this.rwop32(op, this.not32);
		case 0o327: // NOT.L Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.not32);
		case 0o330: // MOVE Dn,SR
		case 0o332: // MOVE (An),SR
		case 0o333: // MOVE (An)+,SR
		case 0o334: // MOVE -(An),SR
		case 0o335: // MOVE d(An),SR
		case 0o336: // MOVE d(An,Xi),SR
			if ((this.sr & 0x2000) === 0)
				return void this.exception(8);
			this.sr = this.rop16(op);
			if ((this.sr & 0x2000) === 0)
				[this.ssp, this.a7] = [this.a7, this.usp];
			return;
		case 0o337: // MOVE Abs...,SR
			if ((op & 7) >= 5)
				return void this.exception(4);
			if ((this.sr & 0x2000) === 0)
				return void this.exception(8);
			this.sr = this.rop16(op);
			if ((this.sr & 0x2000) === 0)
				[this.ssp, this.a7] = [this.a7, this.usp];
			return;
		case 0o360: // CHK Dn,D3
		case 0o362: // CHK (An),D3
		case 0o363: // CHK (An)+,D3
		case 0o364: // CHK -(An),D3
		case 0o365: // CHK d(An),D3
		case 0o366: // CHK d(An,Xi),D3
			return void this.chk(this.rop16(op), this.d3);
		case 0o367: // CHK Abs...,D3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.chk(this.rop16(op), this.d3);
		case 0o372: // LEA (An),A3
		case 0o375: // LEA d(An),A3
		case 0o376: // LEA d(An,Xi),A3
			return void(this.a3 = this.lea(op));
		case 0o377: // LEA Abs...,A3
			if ((op & 7) >= 4)
				return void this.exception(4);
			return void(this.a3 = this.lea(op));
		case 0o400: // NBCD Dn
		case 0o402: // NBCD (An)
		case 0o403: // NBCD (An)+
		case 0o404: // NBCD -(An)
		case 0o405: // NBCD d(An)
		case 0o406: // NBCD d(An,Xi)
			return void this.rwop8(op, this.nbcd);
		case 0o407: // NBCD Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.nbcd);
		case 0o410: // SWAP Dn
			return void this.rwop32(op, this.swap);
		case 0o412: // PEA (An)
		case 0o415: // PEA d(An)
		case 0o416: // PEA d(An,Xi)
			return void this.write32(this.lea(op), this.a7 = this.a7 - 4 | 0);
		case 0o417: // PEA Abs...
			if ((op & 7) >= 4)
				return void this.exception(4);
			return void this.write32(this.lea(op), this.a7 = this.a7 - 4 | 0);
		case 0o420: // EXT.W Dn
			return void this.rwop16(op, this.ext16);
		case 0o422: // MOVEM.W <register list>,(An)
		case 0o424: // MOVEM.W <register list>,-(An)
		case 0o425: // MOVEM.W <register list>,d(An)
		case 0o426: // MOVEM.W <register list>,d(An,Xi)
			return void this.movem16rm(op);
		case 0o427: // MOVEM.W <register list>,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.movem16rm(op);
		case 0o430: // EXT.L Dn
			return void this.rwop32(op, this.ext32);
		case 0o432: // MOVEM.L <register list>,(An)
		case 0o434: // MOVEM.L <register list>,-(An)
		case 0o435: // MOVEM.L <register list>,d(An)
		case 0o436: // MOVEM.L <register list>,d(An,Xi)
			return void this.movem32rm(op);
		case 0o437: // MOVEM.L <register list>,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.movem32rm(op);
		case 0o460: // CHK Dn,D4
		case 0o462: // CHK (An),D4
		case 0o463: // CHK (An)+,D4
		case 0o464: // CHK -(An),D4
		case 0o465: // CHK d(An),D4
		case 0o466: // CHK d(An,Xi),D4
			return void this.chk(this.rop16(op), this.d4);
		case 0o467: // CHK Abs...,D4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.chk(this.rop16(op), this.d4);
		case 0o472: // LEA (An),A4
		case 0o475: // LEA d(An),A4
		case 0o476: // LEA d(An,Xi),A4
			return void(this.a4 = this.lea(op));
		case 0o477: // LEA Abs...,A4
			if ((op & 7) >= 4)
				return void this.exception(4);
			return void(this.a4 = this.lea(op));
		case 0o500: // TST.B Dn
		case 0o502: // TST.B (An)
		case 0o503: // TST.B (An)+
		case 0o504: // TST.B -(An)
		case 0o505: // TST.B d(An)
		case 0o506: // TST.B d(An,Xi)
			return void this.rop8(op, true);
		case 0o507: // TST.B Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rop8(op, true);
		case 0o510: // TST.W Dn
		case 0o512: // TST.W (An)
		case 0o513: // TST.W (An)+
		case 0o514: // TST.W -(An)
		case 0o515: // TST.W d(An)
		case 0o516: // TST.W d(An,Xi)
			return void this.rop16(op, true);
		case 0o517: // TST.W Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rop16(op, true);
		case 0o520: // TST.L Dn
		case 0o522: // TST.L (An)
		case 0o523: // TST.L (An)+
		case 0o524: // TST.L -(An)
		case 0o525: // TST.L d(An)
		case 0o526: // TST.L d(An,Xi)
			return void this.rop32(op, true);
		case 0o527: // TST.L Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rop32(op, true);
		case 0o530: // TAS Dn
		case 0o532: // TAS (An)
		case 0o533: // TAS (An)+
		case 0o534: // TAS -(An)
		case 0o535: // TAS d(An)
		case 0o536: // TAS d(An,Xi)
			return void this.rwop8(op, this.tas);
		case 0o537:
			switch (op & 7) {
			case 0: // TAS Abs.W
			case 1: // TAS Abs.L
				return void this.rwop8(op, this.tas);
			case 4: // ILLEGAL
			default:
				return void this.exception(4);
			}
		case 0o560: // CHK Dn,D5
		case 0o562: // CHK (An),D5
		case 0o563: // CHK (An)+,D5
		case 0o564: // CHK -(An),D5
		case 0o565: // CHK d(An),D5
		case 0o566: // CHK d(An,Xi),D5
			return void this.chk(this.rop16(op), this.d5);
		case 0o567: // CHK Abs...,D5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.chk(this.rop16(op), this.d5);
		case 0o572: // LEA (An),A5
		case 0o575: // LEA d(An),A5
		case 0o576: // LEA d(An,Xi),A5
			return void(this.a5 = this.lea(op));
		case 0o577: // LEA Abs...,A5
			if ((op & 7) >= 4)
				return void this.exception(4);
			return void(this.a5 = this.lea(op));
		case 0o622: // MOVEM.W (An),<register list>
		case 0o623: // MOVEM.W (An)+,<register list>
		case 0o625: // MOVEM.W d(An),<register list>
		case 0o626: // MOVEM.W d(An,Xi),<register list>
			return void this.movem16mr(op);
		case 0o627: // MOVEM.W Abs...,<register list>
			if ((op & 7) >= 4)
				return void this.exception(4);
			return void this.movem16mr(op);
		case 0o632: // MOVEM.L (An),<register list>
		case 0o633: // MOVEM.L (An)+,<register list>
		case 0o635: // MOVEM.L d(An),<register list>
		case 0o636: // MOVEM.L d(An,Xi),<register list>
			return void this.movem32mr(op);
		case 0o637: // MOVEM.L Abs...,<register list>
			if ((op & 7) >= 4)
				return void this.exception(4);
			return void this.movem32mr(op);
		case 0o660: // CHK Dn,D6
		case 0o662: // CHK (An),D6
		case 0o663: // CHK (An)+,D6
		case 0o664: // CHK -(An),D6
		case 0o665: // CHK d(An),D6
		case 0o666: // CHK d(An,Xi),D6
			return void this.chk(this.rop16(op), this.d6);
		case 0o667: // CHK Abs...,D6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.chk(this.rop16(op), this.d6);
		case 0o672: // LEA (An),A6
		case 0o675: // LEA d(An),A6
		case 0o676: // LEA d(An,Xi),A6
			return void(this.a6 = this.lea(op));
		case 0o677: // LEA Abs...,A6
			if ((op & 7) >= 4)
				return void this.exception(4);
			return void(this.a6 = this.lea(op));
		case 0o710: // TRAP #<vector>
		case 0o711:
			return void this.exception(op & 0x0f | 0x20);
		case 0o712: // LINK An,#<displacement>
			return void this.rwop32(op & 7 | 0o10, this.link);
		case 0o713: // UNLK An
			return void this.rwop32(op & 7 | 0o10, this.unlk);
		case 0o714: // MOVE An,USP
			if ((this.sr & 0x2000) === 0)
				return void this.exception(8);
			return void(this.usp = this.rop32(op & 7 | 0o10));
		case 0o715: // MOVE USP,An
			if ((this.sr & 0x2000) === 0)
				return void this.exception(8);
			return void this.rwop32(op & 7 | 0o10, src => src, this.usp);
		case 0o716:
			switch(op & 7) {
			case 0: // RESET
				if ((this.sr & 0x2000) === 0)
					return void this.exception(8);
				return void this.reset();
			case 1: // NOP
				return;
			case 2: // STOP
				if ((this.sr & 0x2000) === 0)
					return void this.exception(8);
				return void(this.fSuspend = true);
			case 3: // RTE
				if ((this.sr & 0x2000) === 0)
					return void this.exception(8);
				this.sr = this.read16(this.a7);
				this.pc = this.read32(this.a7 = this.a7 + 2 | 0);
				this.a7 = this.a7 + 4 | 0;
				if ((this.sr & 0x2000) === 0)
					[this.ssp, this.a7] = [this.a7, this.usp];
				return;
			case 4: // RTD 68010
				return void this.exception(4);
			case 5: // RTS
				this.pc = this.read32(this.a7);
				return void(this.a7 = this.a7 + 4 | 0);
			case 6: // TRAPV
				if ((this.sr & 2) !== 0)
					return void this.exception(7);
				return;
			case 7: // RTR
				this.sr = this.sr & ~0xff | this.read16(this.a7) & 0xff;
				this.pc = this.read32(this.a7 = this.a7 + 2 | 0);
				return void(this.a7 = this.a7 + 4 | 0);
			}
			break;
		case 0o722: // JSR (An)
		case 0o725: // JSR d(An)
		case 0o726: // JSR d(An,Xi)
			return void this.jsr(op);
		case 0o727: // JSR Abs...
			if ((op & 7) >= 4)
				return void this.exception(4);
			return void this.jsr(op);
		case 0o732: // JMP (An)
		case 0o735: // JMP d(An)
		case 0o736: // JMP d(An,Xi)
			return void(this.pc = this.lea(op));
		case 0o737: // JMP Abs...
			if ((op & 7) >= 4)
				return void this.exception(4);
			return void(this.pc = this.lea(op));
		case 0o760: // CHK Dn,D7
		case 0o762: // CHK (An),D7
		case 0o763: // CHK (An)+,D7
		case 0o764: // CHK -(An),D7
		case 0o765: // CHK d(An),D7
		case 0o766: // CHK d(An,Xi),D7
			return void this.chk(this.rop16(op), this.d7);
		case 0o767: // CHK Abs...,D7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.chk(this.rop16(op), this.d7);
		case 0o772: // LEA (An),A7
		case 0o775: // LEA d(An),A7
		case 0o776: // LEA d(An,Xi),A7
			return void(this.a7 = this.lea(op));
		case 0o777: // LEA Abs...,A7
			if ((op & 7) >= 4)
				return void this.exception(4);
			return void(this.a7 = this.lea(op));
		default:
			return void this.exception(4);
		}
	}

	execute_5(op) {
		switch (op >>> 3 & 0o777) {
		case 0o000: // ADDQ.B #8,Dn
		case 0o002: // ADDQ.B #8,(An)
		case 0o003: // ADDQ.B #8,(An)+
		case 0o004: // ADDQ.B #8,-(An)
		case 0o005: // ADDQ.B #8,d(An)
		case 0o006: // ADDQ.B #8,d(An,Xi)
			return void this.rwop8(op, this.add8, 8);
		case 0o007: // ADDQ.B #8,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.add8, 8);
		case 0o010: // ADDQ.W #8,Dn
			return void this.rwop16(op, this.add16, 8);
		case 0o011: // ADDQ.W #8,An
			return void this.rwop16(op, (src, dst) => dst + src | 0, 8);
		case 0o012: // ADDQ.W #8,(An)
		case 0o013: // ADDQ.W #8,(An)+
		case 0o014: // ADDQ.W #8,-(An)
		case 0o015: // ADDQ.W #8,d(An)
		case 0o016: // ADDQ.W #8,d(An,Xi)
			return void this.rwop16(op, this.add16, 8);
		case 0o017: // ADDQ.W #8,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.add16, 8);
		case 0o020: // ADDQ.L #8,Dn
			return void this.rwop32(op, this.add32, 8);
		case 0o021: // ADDQ.L #8,An
			return void this.rwop32(op, (src, dst) => dst + src | 0, 8);
		case 0o022: // ADDQ.L #8,(An)
		case 0o023: // ADDQ.L #8,(An)+
		case 0o024: // ADDQ.L #8,-(An)
		case 0o025: // ADDQ.L #8,d(An)
		case 0o026: // ADDQ.L #8,d(An,Xi)
			return void this.rwop32(op, this.add32, 8);
		case 0o027: // ADDQ.L #8,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.add32, 8);
		case 0o030: // ST Dn
			return void this.rwop8(op, src => src, 0xff);
		case 0o031: // DBT Dn,<label>
			return void this.rwop16(op & 7, this.dbcc, true);
		case 0o032: // ST (An)
		case 0o033: // ST (An)+
		case 0o034: // ST -(An)
		case 0o035: // ST d(An)
		case 0o036: // ST d(An,Xi)
			return void this.rwop8(op, src => src, 0xff);
		case 0o037: // ST Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, src => src, 0xff);
		case 0o040: // SUBQ.B #8,Dn
		case 0o042: // SUBQ.B #8,(An)
		case 0o043: // SUBQ.B #8,(An)+
		case 0o044: // SUBQ.B #8,-(An)
		case 0o045: // SUBQ.B #8,d(An)
		case 0o046: // SUBQ.B #8,d(An,Xi)
			return void this.rwop8(op, this.sub8, 8);
		case 0o047: // SUBQ.B #8,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.sub8, 8);
		case 0o050: // SUBQ.W #8,Dn
			return void this.rwop16(op, this.sub16, 8);
		case 0o051: // SUBQ.W #8,An
			return void this.rwop16(op, (src, dst) => dst - src | 0, 8);
		case 0o052: // SUBQ.W #8,(An)
		case 0o053: // SUBQ.W #8,(An)+
		case 0o054: // SUBQ.W #8,-(An)
		case 0o055: // SUBQ.W #8,d(An)
		case 0o056: // SUBQ.W #8,d(An,Xi)
			return void this.rwop16(op, this.sub16, 8);
		case 0o057: // SUBQ.W #8,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.sub16, 8);
		case 0o060: // SUBQ.L #8,Dn
			return void this.rwop32(op, this.sub32, 8);
		case 0o061: // SUBQ.L #8,An
			return void this.rwop32(op, (src, dst) => dst - src | 0, 8);
		case 0o062: // SUBQ.L #8,(An)
		case 0o063: // SUBQ.L #8,(An)+
		case 0o064: // SUBQ.L #8,-(An)
		case 0o065: // SUBQ.L #8,d(An)
		case 0o066: // SUBQ.L #8,d(An,Xi)
			return void this.rwop32(op, this.sub32, 8);
		case 0o067: // SUBQ.L #8,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.sub32, 8);
		case 0o070: // SF Dn
			return void this.rwop8(op, src => src, 0);
		case 0o071: // DBRA Dn,<label>
			return void this.rwop16(op & 7, this.dbcc, false);
		case 0o072: // SF (An)
		case 0o073: // SF (An)+
		case 0o074: // SF -(An)
		case 0o075: // SF d(An)
		case 0o076: // SF d(An,Xi)
			return void this.rwop8(op, src => src, 0);
		case 0o077: // SF Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, src => src, 0);
		case 0o100: // ADDQ.B #1,Dn
		case 0o102: // ADDQ.B #1,(An)
		case 0o103: // ADDQ.B #1,(An)+
		case 0o104: // ADDQ.B #1,-(An)
		case 0o105: // ADDQ.B #1,d(An)
		case 0o106: // ADDQ.B #1,d(An,Xi)
			return void this.rwop8(op, this.add8, 1);
		case 0o107: // ADDQ.B #1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.add8, 1);
		case 0o110: // ADDQ.W #1,Dn
			return void this.rwop16(op, this.add16, 1);
		case 0o111: // ADDQ.W #1,An
			return void this.rwop16(op, (src, dst) => dst + src | 0, 1);
		case 0o112: // ADDQ.W #1,(An)
		case 0o113: // ADDQ.W #1,(An)+
		case 0o114: // ADDQ.W #1,-(An)
		case 0o115: // ADDQ.W #1,d(An)
		case 0o116: // ADDQ.W #1,d(An,Xi)
			return void this.rwop16(op, this.add16, 1);
		case 0o117: // ADDQ.W #1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.add16, 1);
		case 0o120: // ADDQ.L #1,Dn
			return void this.rwop32(op, this.add32, 1);
		case 0o121: // ADDQ.L #1,An
			return void this.rwop32(op, (src, dst) => dst + src | 0, 1);
		case 0o122: // ADDQ.L #1,(An)
		case 0o123: // ADDQ.L #1,(An)+
		case 0o124: // ADDQ.L #1,-(An)
		case 0o125: // ADDQ.L #1,d(An)
		case 0o126: // ADDQ.L #1,d(An,Xi)
			return void this.rwop32(op, this.add32, 1);
		case 0o127: // ADDQ.L #1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.add32, 1);
		case 0o130: // SHI Dn
			return void this.rwop8(op, src => src, ((this.sr >>> 2 | this.sr) & 1) === 0 ? 0xff : 0);
		case 0o131: // DBHI Dn,<label>
			return void this.rwop16(op & 7, this.dbcc, ((this.sr >>> 2 | this.sr) & 1) === 0);
		case 0o132: // SHI (An)
		case 0o133: // SHI (An)+
		case 0o134: // SHI -(An)
		case 0o135: // SHI d(An)
		case 0o136: // SHI d(An,Xi)
			return void this.rwop8(op, src => src, ((this.sr >>> 2 | this.sr) & 1) === 0 ? 0xff : 0);
		case 0o137: // SHI Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, src => src, ((this.sr >>> 2 | this.sr) & 1) === 0 ? 0xff : 0);
		case 0o140: // SUBQ.B #1,Dn
		case 0o142: // SUBQ.B #1,(An)
		case 0o143: // SUBQ.B #1,(An)+
		case 0o144: // SUBQ.B #1,-(An)
		case 0o145: // SUBQ.B #1,d(An)
		case 0o146: // SUBQ.B #1,d(An,Xi)
			return void this.rwop8(op, this.sub8, 1);
		case 0o147: // SUBQ.B #1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.sub8, 1);
		case 0o150: // SUBQ.W #1,Dn
			return void this.rwop16(op, this.sub16, 1);
		case 0o151: // SUBQ.W #1,An
			return void this.rwop16(op, (src, dst) => dst - src | 0, 1);
		case 0o152: // SUBQ.W #1,(An)
		case 0o153: // SUBQ.W #1,(An)+
		case 0o154: // SUBQ.W #1,-(An)
		case 0o155: // SUBQ.W #1,d(An)
		case 0o156: // SUBQ.W #1,d(An,Xi)
			return void this.rwop16(op, this.sub16, 1);
		case 0o157: // SUBQ.W #1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.sub16, 1);
		case 0o160: // SUBQ.L #1,Dn
			return void this.rwop32(op, this.sub32, 1);
		case 0o161: // SUBQ.L #1,An
			return void this.rwop32(op, (src, dst) => dst - src | 0, 1);
		case 0o162: // SUBQ.L #1,(An)
		case 0o163: // SUBQ.L #1,(An)+
		case 0o164: // SUBQ.L #1,-(An)
		case 0o165: // SUBQ.L #1,d(An)
		case 0o166: // SUBQ.L #1,d(An,Xi)
			return void this.rwop32(op, this.sub32, 1);
		case 0o167: // SUBQ.L #1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.sub32, 1);
		case 0o170: // SLS Dn
			return void this.rwop8(op, src => src, ((this.sr >>> 2 | this.sr) & 1) !== 0 ? 0xff : 0);
		case 0o171: // DBLS Dn,<label>
			return void this.rwop16(op & 7, this.dbcc, ((this.sr >>> 2 | this.sr) & 1) !== 0);
		case 0o172: // SLS (An)
		case 0o173: // SLS (An)+
		case 0o174: // SLS -(An)
		case 0o175: // SLS d(An)
		case 0o176: // SLS d(An,Xi)
			return void this.rwop8(op, src => src, ((this.sr >>> 2 | this.sr) & 1) !== 0 ? 0xff : 0);
		case 0o177: // SLS Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, src => src, ((this.sr >>> 2 | this.sr) & 1) !== 0 ? 0xff : 0);
		case 0o200: // ADDQ.B #2,Dn
		case 0o202: // ADDQ.B #2,(An)
		case 0o203: // ADDQ.B #2,(An)+
		case 0o204: // ADDQ.B #2,-(An)
		case 0o205: // ADDQ.B #2,d(An)
		case 0o206: // ADDQ.B #2,d(An,Xi)
			return void this.rwop8(op, this.add8, 2);
		case 0o207: // ADDQ.B #2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.add8, 2);
		case 0o210: // ADDQ.W #2,Dn
			return void this.rwop16(op, this.add16, 2);
		case 0o211: // ADDQ.W #2,An
			return void this.rwop16(op, (src, dst) => dst + src | 0, 2);
		case 0o212: // ADDQ.W #2,(An)
		case 0o213: // ADDQ.W #2,(An)+
		case 0o214: // ADDQ.W #2,-(An)
		case 0o215: // ADDQ.W #2,d(An)
		case 0o216: // ADDQ.W #2,d(An,Xi)
			return void this.rwop16(op, this.add16, 2);
		case 0o217: // ADDQ.W #2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.add16, 2);
		case 0o220: // ADDQ.L #2,Dn
			return void this.rwop32(op, this.add32, 2);
		case 0o221: // ADDQ.L #2,An
			return void this.rwop32(op, (src, dst) => dst + src | 0, 2);
		case 0o222: // ADDQ.L #2,(An)
		case 0o223: // ADDQ.L #2,(An)+
		case 0o224: // ADDQ.L #2,-(An)
		case 0o225: // ADDQ.L #2,d(An)
		case 0o226: // ADDQ.L #2,d(An,Xi)
			return void this.rwop32(op, this.add32, 2);
		case 0o227: // ADDQ.L #2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.add32, 2);
		case 0o230: // SCC Dn
			return void this.rwop8(op, src => src, (this.sr & 1) === 0 ? 0xff : 0);
		case 0o231: // DBCC Dn,<label>
			return void this.rwop16(op & 7, this.dbcc, (this.sr & 1) === 0);
		case 0o232: // SCC (An)
		case 0o233: // SCC (An)+
		case 0o234: // SCC -(An)
		case 0o235: // SCC d(An)
		case 0o236: // SCC d(An,Xi)
			return void this.rwop8(op, src => src, (this.sr & 1) === 0 ? 0xff : 0);
		case 0o237: // SCC Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, src => src, (this.sr & 1) === 0 ? 0xff : 0);
		case 0o240: // SUBQ.B #2,Dn
		case 0o242: // SUBQ.B #2,(An)
		case 0o243: // SUBQ.B #2,(An)+
		case 0o244: // SUBQ.B #2,-(An)
		case 0o245: // SUBQ.B #2,d(An)
		case 0o246: // SUBQ.B #2,d(An,Xi)
			return void this.rwop8(op, this.sub8, 2);
		case 0o247: // SUBQ.B #2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.sub8, 2);
		case 0o250: // SUBQ.W #2,Dn
			return void this.rwop16(op, this.sub16, 2);
		case 0o251: // SUBQ.W #2,An
			return void this.rwop16(op, (src, dst) => dst - src | 0, 2);
		case 0o252: // SUBQ.W #2,(An)
		case 0o253: // SUBQ.W #2,(An)+
		case 0o254: // SUBQ.W #2,-(An)
		case 0o255: // SUBQ.W #2,d(An)
		case 0o256: // SUBQ.W #2,d(An,Xi)
			return void this.rwop16(op, this.sub16, 2);
		case 0o257: // SUBQ.W #2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.sub16, 2);
		case 0o260: // SUBQ.L #2,Dn
			return void this.rwop32(op, this.sub32, 2);
		case 0o261: // SUBQ.L #2,An
			return void this.rwop32(op, (src, dst) => dst - src | 0, 2);
		case 0o262: // SUBQ.L #2,(An)
		case 0o263: // SUBQ.L #2,(An)+
		case 0o264: // SUBQ.L #2,-(An)
		case 0o265: // SUBQ.L #2,d(An)
		case 0o266: // SUBQ.L #2,d(An,Xi)
			return void this.rwop32(op, this.sub32, 2);
		case 0o267: // SUBQ.L #2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.sub32, 2);
		case 0o270: // SCS Dn
			return void this.rwop8(op, src => src, (this.sr & 1) !== 0 ? 0xff : 0);
		case 0o271: // DBCS Dn,<label>
			return void this.rwop16(op & 7, this.dbcc, (this.sr & 1) !== 0);
		case 0o272: // SCS (An)
		case 0o273: // SCS (An)+
		case 0o274: // SCS -(An)
		case 0o275: // SCS d(An)
		case 0o276: // SCS d(An,Xi)
			return void this.rwop8(op, src => src, (this.sr & 1) !== 0 ? 0xff : 0);
		case 0o277: // SCS Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, src => src, (this.sr & 1) !== 0 ? 0xff : 0);
		case 0o300: // ADDQ.B #3,Dn
		case 0o302: // ADDQ.B #3,(An)
		case 0o303: // ADDQ.B #3,(An)+
		case 0o304: // ADDQ.B #3,-(An)
		case 0o305: // ADDQ.B #3,d(An)
		case 0o306: // ADDQ.B #3,d(An,Xi)
			return void this.rwop8(op, this.add8, 3);
		case 0o307: // ADDQ.B #3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.add8, 3);
		case 0o310: // ADDQ.W #3,Dn
			return void this.rwop16(op, this.add16, 3);
		case 0o311: // ADDQ.W #3,An
			return void this.rwop16(op, (src, dst) => dst + src | 0, 3);
		case 0o312: // ADDQ.W #3,(An)
		case 0o313: // ADDQ.W #3,(An)+
		case 0o314: // ADDQ.W #3,-(An)
		case 0o315: // ADDQ.W #3,d(An)
		case 0o316: // ADDQ.W #3,d(An,Xi)
			return void this.rwop16(op, this.add16, 3);
		case 0o317: // ADDQ.W #3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.add16, 3);
		case 0o320: // ADDQ.L #3,Dn
			return void this.rwop32(op, this.add32, 3);
		case 0o321: // ADDQ.L #3,An
			return void this.rwop32(op, (src, dst) => dst + src | 0, 3);
		case 0o322: // ADDQ.L #3,(An)
		case 0o323: // ADDQ.L #3,(An)+
		case 0o324: // ADDQ.L #3,-(An)
		case 0o325: // ADDQ.L #3,d(An)
		case 0o326: // ADDQ.L #3,d(An,Xi)
			return void this.rwop32(op, this.add32, 3);
		case 0o327: // ADDQ.L #3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.add32, 3);
		case 0o330: // SNE Dn
			return void this.rwop8(op, src => src, (this.sr & 4) === 0 ? 0xff : 0);
		case 0o331: // DBNE Dn,<label>
			return void this.rwop16(op & 7, this.dbcc, (this.sr & 4) === 0);
		case 0o332: // SNE (An)
		case 0o333: // SNE (An)+
		case 0o334: // SNE -(An)
		case 0o335: // SNE d(An)
		case 0o336: // SNE d(An,Xi)
			return void this.rwop8(op, src => src, (this.sr & 4) === 0 ? 0xff : 0);
		case 0o337: // SNE Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, src => src, (this.sr & 4) === 0 ? 0xff : 0);
		case 0o340: // SUBQ.B #3,Dn
		case 0o342: // SUBQ.B #3,(An)
		case 0o343: // SUBQ.B #3,(An)+
		case 0o344: // SUBQ.B #3,-(An)
		case 0o345: // SUBQ.B #3,d(An)
		case 0o346: // SUBQ.B #3,d(An,Xi)
			return void this.rwop8(op, this.sub8, 3);
		case 0o347: // SUBQ.B #3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.sub8, 3);
		case 0o350: // SUBQ.W #3,Dn
			return void this.rwop16(op, this.sub16, 3);
		case 0o351: // SUBQ.W #3,An
			return void this.rwop16(op, (src, dst) => dst - src | 0, 3);
		case 0o352: // SUBQ.W #3,(An)
		case 0o353: // SUBQ.W #3,(An)+
		case 0o354: // SUBQ.W #3,-(An)
		case 0o355: // SUBQ.W #3,d(An)
		case 0o356: // SUBQ.W #3,d(An,Xi)
			return void this.rwop16(op, this.sub16, 3);
		case 0o357: // SUBQ.W #3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.sub16, 3);
		case 0o360: // SUBQ.L #3,Dn
			return void this.rwop32(op, this.sub32, 3);
		case 0o361: // SUBQ.L #3,An
			return void this.rwop32(op, (src, dst) => dst - src | 0, 3);
		case 0o362: // SUBQ.L #3,(An)
		case 0o363: // SUBQ.L #3,(An)+
		case 0o364: // SUBQ.L #3,-(An)
		case 0o365: // SUBQ.L #3,d(An)
		case 0o366: // SUBQ.L #3,d(An,Xi)
			return void this.rwop32(op, this.sub32, 3);
		case 0o367: // SUBQ.L #3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.sub32, 3);
		case 0o370: // SEQ Dn
			return void this.rwop8(op, src => src, (this.sr & 4) !== 0 ? 0xff : 0);
		case 0o371: // DBEQ Dn,<label>
			return void this.rwop16(op & 7, this.dbcc, (this.sr & 4) !== 0);
		case 0o372: // SEQ (An)
		case 0o373: // SEQ (An)+
		case 0o374: // SEQ -(An)
		case 0o375: // SEQ d(An)
		case 0o376: // SEQ d(An,Xi)
			return void this.rwop8(op, src => src, (this.sr & 4) !== 0 ? 0xff : 0);
		case 0o377: // SEQ Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, src => src, (this.sr & 4) !== 0 ? 0xff : 0);
		case 0o400: // ADDQ.B #4,Dn
		case 0o402: // ADDQ.B #4,(An)
		case 0o403: // ADDQ.B #4,(An)+
		case 0o404: // ADDQ.B #4,-(An)
		case 0o405: // ADDQ.B #4,d(An)
		case 0o406: // ADDQ.B #4,d(An,Xi)
			return void this.rwop8(op, this.add8, 4);
		case 0o407: // ADDQ.B #4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.add8, 4);
		case 0o410: // ADDQ.W #4,Dn
			return void this.rwop16(op, this.add16, 4);
		case 0o411: // ADDQ.W #4,An
			return void this.rwop16(op, (src, dst) => dst + src | 0, 4);
		case 0o412: // ADDQ.W #4,(An)
		case 0o413: // ADDQ.W #4,(An)+
		case 0o414: // ADDQ.W #4,-(An)
		case 0o415: // ADDQ.W #4,d(An)
		case 0o416: // ADDQ.W #4,d(An,Xi)
			return void this.rwop16(op, this.add16, 4);
		case 0o417: // ADDQ.W #4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.add16, 4);
		case 0o420: // ADDQ.L #4,Dn
			return void this.rwop32(op, this.add32, 4);
		case 0o421: // ADDQ.L #4,An
			return void this.rwop32(op, (src, dst) => dst + src | 0, 4);
		case 0o422: // ADDQ.L #4,(An)
		case 0o423: // ADDQ.L #4,(An)+
		case 0o424: // ADDQ.L #4,-(An)
		case 0o425: // ADDQ.L #4,d(An)
		case 0o426: // ADDQ.L #4,d(An,Xi)
			return void this.rwop32(op, this.add32, 4);
		case 0o427: // ADDQ.L #4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.add32, 4);
		case 0o430: // SVC Dn
			return void this.rwop8(op, src => src, (this.sr & 2) === 0 ? 0xff : 0);
		case 0o431: // DBVC Dn,<label>
			return void this.rwop16(op & 7, this.dbcc, (this.sr & 2) === 0);
		case 0o432: // SVC (An)
		case 0o433: // SVC (An)+
		case 0o434: // SVC -(An)
		case 0o435: // SVC d(An)
		case 0o436: // SVC d(An,Xi)
			return void this.rwop8(op, src => src, (this.sr & 2) === 0 ? 0xff : 0);
		case 0o437: // SVC Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, src => src, (this.sr & 2) === 0 ? 0xff : 0);
		case 0o440: // SUBQ.B #4,Dn
		case 0o442: // SUBQ.B #4,(An)
		case 0o443: // SUBQ.B #4,(An)+
		case 0o444: // SUBQ.B #4,-(An)
		case 0o445: // SUBQ.B #4,d(An)
		case 0o446: // SUBQ.B #4,d(An,Xi)
			return void this.rwop8(op, this.sub8, 4);
		case 0o447: // SUBQ.B #4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.sub8, 4);
		case 0o450: // SUBQ.W #4,Dn
			return void this.rwop16(op, this.sub16, 4);
		case 0o451: // SUBQ.W #4,An
			return void this.rwop16(op, (src, dst) => dst - src | 0, 4);
		case 0o452: // SUBQ.W #4,(An)
		case 0o453: // SUBQ.W #4,(An)+
		case 0o454: // SUBQ.W #4,-(An)
		case 0o455: // SUBQ.W #4,d(An)
		case 0o456: // SUBQ.W #4,d(An,Xi)
			return void this.rwop16(op, this.sub16, 4);
		case 0o457: // SUBQ.W #4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.sub16, 4);
		case 0o460: // SUBQ.L #4,Dn
			return void this.rwop32(op, this.sub32, 4);
		case 0o461: // SUBQ.L #4,An
			return void this.rwop32(op, (src, dst) => dst - src | 0, 4);
		case 0o462: // SUBQ.L #4,(An)
		case 0o463: // SUBQ.L #4,(An)+
		case 0o464: // SUBQ.L #4,-(An)
		case 0o465: // SUBQ.L #4,d(An)
		case 0o466: // SUBQ.L #4,d(An,Xi)
			return void this.rwop32(op, this.sub32, 4);
		case 0o467: // SUBQ.L #4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.sub32, 4);
		case 0o470: // SVS Dn
			return void this.rwop8(op, src => src, (this.sr & 2) !== 0 ? 0xff : 0);
		case 0o471: // DBVS Dn,<label>
			return void this.rwop16(op & 7, this.dbcc, (this.sr & 2) !== 0);
		case 0o472: // SVS (An)
		case 0o473: // SVS (An)+
		case 0o474: // SVS -(An)
		case 0o475: // SVS d(An)
		case 0o476: // SVS d(An,Xi)
			return void this.rwop8(op, src => src, (this.sr & 2) !== 0 ? 0xff : 0);
		case 0o477: // SVS Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, src => src, (this.sr & 2) !== 0 ? 0xff : 0);
		case 0o500: // ADDQ.B #5,Dn
		case 0o502: // ADDQ.B #5,(An)
		case 0o503: // ADDQ.B #5,(An)+
		case 0o504: // ADDQ.B #5,-(An)
		case 0o505: // ADDQ.B #5,d(An)
		case 0o506: // ADDQ.B #5,d(An,Xi)
			return void this.rwop8(op, this.add8, 5);
		case 0o507: // ADDQ.B #5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.add8, 5);
		case 0o510: // ADDQ.W #5,Dn
			return void this.rwop16(op, this.add16, 5);
		case 0o511: // ADDQ.W #5,An
			return void this.rwop16(op, (src, dst) => dst + src | 0, 5);
		case 0o512: // ADDQ.W #5,(An)
		case 0o513: // ADDQ.W #5,(An)+
		case 0o514: // ADDQ.W #5,-(An)
		case 0o515: // ADDQ.W #5,d(An)
		case 0o516: // ADDQ.W #5,d(An,Xi)
			return void this.rwop16(op, this.add16, 5);
		case 0o517: // ADDQ.W #5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.add16, 5);
		case 0o520: // ADDQ.L #5,Dn
			return void this.rwop32(op, this.add32, 5);
		case 0o521: // ADDQ.L #5,An
			return void this.rwop32(op, (src, dst) => dst + src | 0, 5);
		case 0o522: // ADDQ.L #5,(An)
		case 0o523: // ADDQ.L #5,(An)+
		case 0o524: // ADDQ.L #5,-(An)
		case 0o525: // ADDQ.L #5,d(An)
		case 0o526: // ADDQ.L #5,d(An,Xi)
			return void this.rwop32(op, this.add32, 5);
		case 0o527: // ADDQ.L #5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.add32, 5);
		case 0o530: // SPL Dn
			return void this.rwop8(op, src => src, (this.sr & 8) === 0 ? 0xff : 0);
		case 0o531: // DBPL Dn,<label>
			return void this.rwop16(op & 7, this.dbcc, (this.sr & 8) === 0);
		case 0o532: // SPL (An)
		case 0o533: // SPL (An)+
		case 0o534: // SPL -(An)
		case 0o535: // SPL d(An)
		case 0o536: // SPL d(An,Xi)
			return void this.rwop8(op, src => src, (this.sr & 8) === 0 ? 0xff : 0);
		case 0o537: // SPL Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, src => src, (this.sr & 8) === 0 ? 0xff : 0);
		case 0o540: // SUBQ.B #5,Dn
		case 0o542: // SUBQ.B #5,(An)
		case 0o543: // SUBQ.B #5,(An)+
		case 0o544: // SUBQ.B #5,-(An)
		case 0o545: // SUBQ.B #5,d(An)
		case 0o546: // SUBQ.B #5,d(An,Xi)
			return void this.rwop8(op, this.sub8, 5);
		case 0o547: // SUBQ.B #5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.sub8, 5);
		case 0o550: // SUBQ.W #5,Dn
			return void this.rwop16(op, this.sub16, 5);
		case 0o551: // SUBQ.W #5,An
			return void this.rwop16(op, (src, dst) => dst - src | 0, 5);
		case 0o552: // SUBQ.W #5,(An)
		case 0o553: // SUBQ.W #5,(An)+
		case 0o554: // SUBQ.W #5,-(An)
		case 0o555: // SUBQ.W #5,d(An)
		case 0o556: // SUBQ.W #5,d(An,Xi)
			return void this.rwop16(op, this.sub16, 5);
		case 0o557: // SUBQ.W #5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.sub16, 5);
		case 0o560: // SUBQ.L #5,Dn
			return void this.rwop32(op, this.sub32, 5);
		case 0o561: // SUBQ.L #5,An
			return void this.rwop32(op, (src, dst) => dst - src | 0, 5);
		case 0o562: // SUBQ.L #5,(An)
		case 0o563: // SUBQ.L #5,(An)+
		case 0o564: // SUBQ.L #5,-(An)
		case 0o565: // SUBQ.L #5,d(An)
		case 0o566: // SUBQ.L #5,d(An,Xi)
			return void this.rwop32(op, this.sub32, 5);
		case 0o567: // SUBQ.L #5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.sub32, 5);
		case 0o570: // SMI Dn
			return void this.rwop8(op, src => src, (this.sr & 8) !== 0 ? 0xff : 0);
		case 0o571: // DBMI Dn,<label>
			return void this.rwop16(op & 7, this.dbcc, (this.sr & 8) !== 0);
		case 0o572: // SMI (An)
		case 0o573: // SMI (An)+
		case 0o574: // SMI -(An)
		case 0o575: // SMI d(An)
		case 0o576: // SMI d(An,Xi)
			return void this.rwop8(op, src => src, (this.sr & 8) !== 0 ? 0xff : 0);
		case 0o577: // SMI Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, src => src, (this.sr & 8) !== 0 ? 0xff : 0);
		case 0o600: // ADDQ.B #6,Dn
		case 0o602: // ADDQ.B #6,(An)
		case 0o603: // ADDQ.B #6,(An)+
		case 0o604: // ADDQ.B #6,-(An)
		case 0o605: // ADDQ.B #6,d(An)
		case 0o606: // ADDQ.B #6,d(An,Xi)
			return void this.rwop8(op, this.add8, 6);
		case 0o607: // ADDQ.B #6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.add8, 6);
		case 0o610: // ADDQ.W #6,Dn
			return void this.rwop16(op, this.add16, 6);
		case 0o611: // ADDQ.W #6,An
			return void this.rwop16(op, (src, dst) => dst + src | 0, 6);
		case 0o612: // ADDQ.W #6,(An)
		case 0o613: // ADDQ.W #6,(An)+
		case 0o614: // ADDQ.W #6,-(An)
		case 0o615: // ADDQ.W #6,d(An)
		case 0o616: // ADDQ.W #6,d(An,Xi)
			return void this.rwop16(op, this.add16, 6);
		case 0o617: // ADDQ.W #6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.add16, 6);
		case 0o620: // ADDQ.L #6,Dn
			return void this.rwop32(op, this.add32, 6);
		case 0o621: // ADDQ.L #6,An
			return void this.rwop32(op, (src, dst) => dst + src | 0, 6);
		case 0o622: // ADDQ.L #6,(An)
		case 0o623: // ADDQ.L #6,(An)+
		case 0o624: // ADDQ.L #6,-(An)
		case 0o625: // ADDQ.L #6,d(An)
		case 0o626: // ADDQ.L #6,d(An,Xi)
			return void this.rwop32(op, this.add32, 6);
		case 0o627: // ADDQ.L #6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.add32, 6);
		case 0o630: // SGE Dn
			return void this.rwop8(op, src => src, ((this.sr >>> 2 ^ this.sr) & 2) === 0 ? 0xff : 0);
		case 0o631: // DBGE Dn,<label>
			return void this.rwop16(op & 7, this.dbcc, ((this.sr >>> 2 ^ this.sr) & 2) === 0);
		case 0o632: // SGE (An)
		case 0o633: // SGE (An)+
		case 0o634: // SGE -(An)
		case 0o635: // SGE d(An)
		case 0o636: // SGE d(An,Xi)
			return void this.rwop8(op, src => src, ((this.sr >>> 2 ^ this.sr) & 2) === 0 ? 0xff : 0);
		case 0o637: // SGE Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, src => src, ((this.sr >>> 2 ^ this.sr) & 2) === 0 ? 0xff : 0);
		case 0o640: // SUBQ.B #6,Dn
		case 0o642: // SUBQ.B #6,(An)
		case 0o643: // SUBQ.B #6,(An)+
		case 0o644: // SUBQ.B #6,-(An)
		case 0o645: // SUBQ.B #6,d(An)
		case 0o646: // SUBQ.B #6,d(An,Xi)
			return void this.rwop8(op, this.sub8, 6);
		case 0o647: // SUBQ.B #6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.sub8, 6);
		case 0o650: // SUBQ.W #6,Dn
			return void this.rwop16(op, this.sub16, 6);
		case 0o651: // SUBQ.W #6,An
			return void this.rwop16(op, (src, dst) => dst - src | 0, 6);
		case 0o652: // SUBQ.W #6,(An)
		case 0o653: // SUBQ.W #6,(An)+
		case 0o654: // SUBQ.W #6,-(An)
		case 0o655: // SUBQ.W #6,d(An)
		case 0o656: // SUBQ.W #6,d(An,Xi)
			return void this.rwop16(op, this.sub16, 6);
		case 0o657: // SUBQ.W #6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.sub16, 6);
		case 0o660: // SUBQ.L #6,Dn
			return void this.rwop32(op, this.sub32, 6);
		case 0o661: // SUBQ.L #6,An
			return void this.rwop32(op, (src, dst) => dst - src | 0, 6);
		case 0o662: // SUBQ.L #6,(An)
		case 0o663: // SUBQ.L #6,(An)+
		case 0o664: // SUBQ.L #6,-(An)
		case 0o665: // SUBQ.L #6,d(An)
		case 0o666: // SUBQ.L #6,d(An,Xi)
			return void this.rwop32(op, this.sub32, 6);
		case 0o667: // SUBQ.L #6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.sub32, 6);
		case 0o670: // SLT Dn
			return void this.rwop8(op, src => src, ((this.sr >>> 2 ^ this.sr) & 2) !== 0 ? 0xff : 0);
		case 0o671: // DBLT Dn,<label>
			return void this.rwop16(op & 7, this.dbcc, ((this.sr >>> 2 ^ this.sr) & 2) !== 0);
		case 0o672: // SLT (An)
		case 0o673: // SLT (An)+
		case 0o674: // SLT -(An)
		case 0o675: // SLT d(An)
		case 0o676: // SLT d(An,Xi)
			return void this.rwop8(op, src => src, ((this.sr >>> 2 ^ this.sr) & 2) !== 0 ? 0xff : 0);
		case 0o677: // SLT Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, src => src, ((this.sr >>> 2 ^ this.sr) & 2) !== 0 ? 0xff : 0);
		case 0o700: // ADDQ.B #7,Dn
		case 0o702: // ADDQ.B #7,(An)
		case 0o703: // ADDQ.B #7,(An)+
		case 0o704: // ADDQ.B #7,-(An)
		case 0o705: // ADDQ.B #7,d(An)
		case 0o706: // ADDQ.B #7,d(An,Xi)
			return void this.rwop8(op, this.add8, 7);
		case 0o707: // ADDQ.B #7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.add8, 7);
		case 0o710: // ADDQ.W #7,Dn
			return void this.rwop16(op, this.add16, 7);
		case 0o711: // ADDQ.W #7,An
			return void this.rwop16(op, (src, dst) => dst + src | 0, 7);
		case 0o712: // ADDQ.W #7,(An)
		case 0o713: // ADDQ.W #7,(An)+
		case 0o714: // ADDQ.W #7,-(An)
		case 0o715: // ADDQ.W #7,d(An)
		case 0o716: // ADDQ.W #7,d(An,Xi)
			return void this.rwop16(op, this.add16, 7);
		case 0o717: // ADDQ.W #7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.add16, 7);
		case 0o720: // ADDQ.L #7,Dn
			return void this.rwop32(op, this.add32, 7);
		case 0o721: // ADDQ.L #7,An
			return void this.rwop32(op, (src, dst) => dst + src | 0, 7);
		case 0o722: // ADDQ.L #7,(An)
		case 0o723: // ADDQ.L #7,(An)+
		case 0o724: // ADDQ.L #7,-(An)
		case 0o725: // ADDQ.L #7,d(An)
		case 0o726: // ADDQ.L #7,d(An,Xi)
			return void this.rwop32(op, this.add32, 7);
		case 0o727: // ADDQ.L #7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.add32, 7);
		case 0o730: // SGT Dn
			return void this.rwop8(op, src => src, ((this.sr >>> 2 ^ this.sr | this.sr >>> 1) & 2) === 0 ? 0xff : 0);
		case 0o731: // DBGT Dn,<label>
			return void this.rwop16(op & 7, this.dbcc, ((this.sr >>> 2 ^ this.sr | this.sr >>> 1) & 2) === 0);
		case 0o732: // SGT (An)
		case 0o733: // SGT (An)+
		case 0o734: // SGT -(An)
		case 0o735: // SGT d(An)
		case 0o736: // SGT d(An,Xi)
			return void this.rwop8(op, src => src, ((this.sr >>> 2 ^ this.sr | this.sr >>> 1) & 2) === 0 ? 0xff : 0);
		case 0o737: // SGT Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, src => src, ((this.sr >>> 2 ^ this.sr | this.sr >>> 1) & 2) === 0 ? 0xff : 0);
		case 0o740: // SUBQ.B #7,Dn
		case 0o742: // SUBQ.B #7,(An)
		case 0o743: // SUBQ.B #7,(An)+
		case 0o744: // SUBQ.B #7,-(An)
		case 0o745: // SUBQ.B #7,d(An)
		case 0o746: // SUBQ.B #7,d(An,Xi)
			return void this.rwop8(op, this.sub8, 7);
		case 0o747: // SUBQ.B #7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.sub8, 7);
		case 0o750: // SUBQ.W #7,Dn
			return void this.rwop16(op, this.sub16, 7);
		case 0o751: // SUBQ.W #7,An
			return void this.rwop16(op, (src, dst) => dst - src | 0, 7);
		case 0o752: // SUBQ.W #7,(An)
		case 0o753: // SUBQ.W #7,(An)+
		case 0o754: // SUBQ.W #7,-(An)
		case 0o755: // SUBQ.W #7,d(An)
		case 0o756: // SUBQ.W #7,d(An,Xi)
			return void this.rwop16(op, this.sub16, 7);
		case 0o757: // SUBQ.W #7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.sub16, 7);
		case 0o760: // SUBQ.L #7,Dn
			return void this.rwop32(op, this.sub32, 7);
		case 0o761: // SUBQ.L #7,An
			return void this.rwop32(op, (src, dst) => dst - src | 0, 7);
		case 0o762: // SUBQ.L #7,(An)
		case 0o763: // SUBQ.L #7,(An)+
		case 0o764: // SUBQ.L #7,-(An)
		case 0o765: // SUBQ.L #7,d(An)
		case 0o766: // SUBQ.L #7,d(An,Xi)
			return void this.rwop32(op, this.sub32, 7);
		case 0o767: // SUBQ.L #7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.sub32, 7);
		case 0o770: // SLE Dn
			return void this.rwop8(op, src => src, ((this.sr >>> 2 ^ this.sr | this.sr >>> 1) & 2) !== 0 ? 0xff : 0);
		case 0o771: // DBLE Dn,<label>
			return void this.rwop16(op & 7, this.dbcc, ((this.sr >>> 2 ^ this.sr | this.sr >>> 1) & 2) !== 0);
		case 0o772: // SLE (An)
		case 0o773: // SLE (An)+
		case 0o774: // SLE -(An)
		case 0o775: // SLE d(An)
		case 0o776: // SLE d(An,Xi)
			return void this.rwop8(op, src => src, ((this.sr >>> 2 ^ this.sr | this.sr >>> 1) & 2) !== 0 ? 0xff : 0);
		case 0o777: // SLE Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, src => src, ((this.sr >>> 2 ^ this.sr | this.sr >>> 1) & 2) !== 0 ? 0xff : 0);
		default:
			return void this.exception(4);
		}
	}

	execute_6(op) {
		const base = this.pc;
		const disp = (op & 0xff) === 0 ? this.fetch16s() : (op & 0xff) - (op << 1 & 0x100);

		switch (op >>> 8 & 0xf) {
		case 0x0: // BRA <label>
			return void(this.pc = base + disp | 0);
		case 0x1: // BSR <label>
			this.write32(this.pc, this.a7 = this.a7 - 4 | 0);
			return void(this.pc = base + disp | 0);
		case 0x2: // BHI <label>
			return void(((this.sr >>> 2 | this.sr) & 1) === 0 && (this.pc = base + disp | 0));
		case 0x3: // BLS <label>
			return void(((this.sr >>> 2 | this.sr) & 1) !== 0 && (this.pc = base + disp | 0));
		case 0x4: // BCC <label>
			return void((this.sr & 1) === 0 && (this.pc = base + disp | 0));
		case 0x5: // BCS <label>
			return void((this.sr & 1) !== 0 && (this.pc = base + disp | 0));
		case 0x6: // BNE <label>
			return void((this.sr & 4) === 0 && (this.pc = base + disp | 0));
		case 0x7: // BEQ <label>
			return void((this.sr & 4) !== 0 && (this.pc = base + disp | 0));
		case 0x8: // BVC <label>
			return void((this.sr & 2) === 0 && (this.pc = base + disp | 0));
		case 0x9: // BVS <label>
			return void((this.sr & 2) !== 0 && (this.pc = base + disp | 0));
		case 0xa: // BPL <label>
			return void((this.sr & 8) === 0 && (this.pc = base + disp | 0));
		case 0xb: // BMI <label>
			return void((this.sr & 8) !== 0 && (this.pc = base + disp | 0));
		case 0xc: // BGE <label>
			return void(((this.sr >>> 2 ^ this.sr) & 2) === 0 && (this.pc = base + disp | 0));
		case 0xd: // BLT <label>
			return void(((this.sr >>> 2 ^ this.sr) & 2) !== 0 && (this.pc = base + disp | 0));
		case 0xe: // BGT <label>
			return void(((this.sr >>> 2 ^ this.sr | this.sr >>> 1) & 2) === 0 && (this.pc = base + disp | 0));
		case 0xf: // BLE <label>
			return void(((this.sr >>> 2 ^ this.sr | this.sr >>> 1) & 2) !== 0 && (this.pc = base + disp | 0));
		}
	}

	execute_7(op) {
		const data = (op & 0xff) - (op << 1 & 0x100);

		this.sr = this.sr & ~0x0f | data >>> 28 & 8 | !data << 2;
		switch (op >>> 8 & 0xf) {
		case 0x0: // MOVEQ #<data>,D0
			return void(this.d0 = data);
		case 0x2: // MOVEQ #<data>,D1
			return void(this.d1 = data);
		case 0x4: // MOVEQ #<data>,D2
			return void(this.d2 = data);
		case 0x6: // MOVEQ #<data>,D3
			return void(this.d3 = data);
		case 0x8: // MOVEQ #<data>,D4
			return void(this.d4 = data);
		case 0xa: // MOVEQ #<data>,D5
			return void(this.d5 = data);
		case 0xc: // MOVEQ #<data>,D6
			return void(this.d6 = data);
		case 0xe: // MOVEQ #<data>,D7
			return void(this.d7 = data);
		default:
			return void this.exception(4);
		}
	}

	execute_8(op) {
		switch (op >>> 3 & 0o777) {
		case 0o000: // OR.B Dn,D0
		case 0o002: // OR.B (An),D0
		case 0o003: // OR.B (An)+,D0
		case 0o004: // OR.B -(An),D0
		case 0o005: // OR.B d(An),D0
		case 0o006: // OR.B d(An,Xi),D0
			return void(this.d0 = this.d0 & ~0xff | this.or8(this.rop8(op), this.d0));
		case 0o007: // OR.B Abs...,D0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d0 = this.d0 & ~0xff | this.or8(this.rop8(op), this.d0));
		case 0o010: // OR.W Dn,D0
		case 0o012: // OR.W (An),D0
		case 0o013: // OR.W (An)+,D0
		case 0o014: // OR.W -(An),D0
		case 0o015: // OR.W d(An),D0
		case 0o016: // OR.W d(An,Xi),D0
			return void(this.d0 = this.d0 & ~0xffff | this.or16(this.rop16(op), this.d0));
		case 0o017: // OR.W Abs...,D0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d0 = this.d0 & ~0xffff | this.or16(this.rop16(op), this.d0));
		case 0o020: // OR.L Dn,D0
		case 0o022: // OR.L (An),D0
		case 0o023: // OR.L (An)+,D0
		case 0o024: // OR.L -(An),D0
		case 0o025: // OR.L d(An),D0
		case 0o026: // OR.L d(An,Xi),D0
			return void(this.d0 = this.or32(this.rop32(op), this.d0));
		case 0o027: // OR.L Abs...,D0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d0 = this.or32(this.rop32(op), this.d0));
		case 0o030: // DIVU Dn,D0
		case 0o032: // DIVU (An),D0
		case 0o033: // DIVU (An)+,D0
		case 0o034: // DIVU -(An),D0
		case 0o035: // DIVU d(An),D0
		case 0o036: // DIVU d(An,Xi),D0
			return void(this.d0 = this.divu(this.rop16(op), this.d0));
		case 0o037: // DIVU Abs...,D0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d0 = this.divu(this.rop16(op), this.d0));
		case 0o040: // SBCD Dy,D0
			return void(this.d0 = this.d0 & ~0xff | this.sbcd(this.rop8(op), this.d0));
		case 0o041: // SBCD -(Ay),-(A0)
			return void this.write8(this.sbcd(this.rop8(op & 7 | 0o40), this.read8(this.a0 = this.a0 - 1 | 0)), this.a0);
		case 0o042: // OR.B D0,(An)
		case 0o043: // OR.B D0,(An)+
		case 0o044: // OR.B D0,-(An)
		case 0o045: // OR.B D0,d(An)
		case 0o046: // OR.B D0,d(An,Xi)
			return void this.rwop8(op, this.or8, this.d0);
		case 0o047: // OR.B D0,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.or8, this.d0);
		case 0o052: // OR.W D0,(An)
		case 0o053: // OR.W D0,(An)+
		case 0o054: // OR.W D0,-(An)
		case 0o055: // OR.W D0,d(An)
		case 0o056: // OR.W D0,d(An,Xi)
			return void this.rwop16(op, this.or16, this.d0);
		case 0o057: // OR.W D0,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.or16, this.d0);
		case 0o062: // OR.L D0,(An)
		case 0o063: // OR.L D0,(An)+
		case 0o064: // OR.L D0,-(An)
		case 0o065: // OR.L D0,d(An)
		case 0o066: // OR.L D0,d(An,Xi)
			return void this.rwop32(op, this.or32, this.d0);
		case 0o067: // OR.L D0,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.or32, this.d0);
		case 0o070: // DIVS Dn,D0
		case 0o072: // DIVS (An),D0
		case 0o073: // DIVS (An)+,D0
		case 0o074: // DIVS -(An),D0
		case 0o075: // DIVS d(An),D0
		case 0o076: // DIVS d(An,Xi),D0
			return void(this.d0 = this.divs(this.rop16(op), this.d0));
		case 0o077: // DIVS Abs...,D0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d0 = this.divs(this.rop16(op), this.d0));
		case 0o100: // OR.B Dn,D1
		case 0o102: // OR.B (An),D1
		case 0o103: // OR.B (An)+,D1
		case 0o104: // OR.B -(An),D1
		case 0o105: // OR.B d(An),D1
		case 0o106: // OR.B d(An,Xi),D1
			return void(this.d1 = this.d1 & ~0xff | this.or8(this.rop8(op), this.d1));
		case 0o107: // OR.B Abs...,D1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d1 = this.d1 & ~0xff | this.or8(this.rop8(op), this.d1));
		case 0o110: // OR.W Dn,D1
		case 0o112: // OR.W (An),D1
		case 0o113: // OR.W (An)+,D1
		case 0o114: // OR.W -(An),D1
		case 0o115: // OR.W d(An),D1
		case 0o116: // OR.W d(An,Xi),D1
			return void(this.d1 = this.d1 & ~0xffff | this.or16(this.rop16(op), this.d1));
		case 0o117: // OR.W Abs...,D1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d1 = this.d1 & ~0xffff | this.or16(this.rop16(op), this.d1));
		case 0o120: // OR.L Dn,D1
		case 0o122: // OR.L (An),D1
		case 0o123: // OR.L (An)+,D1
		case 0o124: // OR.L -(An),D1
		case 0o125: // OR.L d(An),D1
		case 0o126: // OR.L d(An,Xi),D1
			return void(this.d1 = this.or32(this.rop32(op), this.d1));
		case 0o127: // OR.L Abs...,D1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d1 = this.or32(this.rop32(op), this.d1));
		case 0o130: // DIVU Dn,D1
		case 0o132: // DIVU (An),D1
		case 0o133: // DIVU (An)+,D1
		case 0o134: // DIVU -(An),D1
		case 0o135: // DIVU d(An),D1
		case 0o136: // DIVU d(An,Xi),D1
			return void(this.d1 = this.divu(this.rop16(op), this.d1));
		case 0o137: // DIVU Abs...,D1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d1 = this.divu(this.rop16(op), this.d1));
		case 0o140: // SBCD Dy,D1
			return void(this.d1 = this.d1 & ~0xff | this.sbcd(this.rop8(op), this.d1));
		case 0o141: // SBCD -(Ay),-(A1)
			return void this.write8(this.sbcd(this.rop8(op & 7 | 0o40), this.read8(this.a1 = this.a1 - 1 | 0)), this.a1);
		case 0o142: // OR.B D1,(An)
		case 0o143: // OR.B D1,(An)+
		case 0o144: // OR.B D1,-(An)
		case 0o145: // OR.B D1,d(An)
		case 0o146: // OR.B D1,d(An,Xi)
			return void this.rwop8(op, this.or8, this.d1);
		case 0o147: // OR.B D1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.or8, this.d1);
		case 0o152: // OR.W D1,(An)
		case 0o153: // OR.W D1,(An)+
		case 0o154: // OR.W D1,-(An)
		case 0o155: // OR.W D1,d(An)
		case 0o156: // OR.W D1,d(An,Xi)
			return void this.rwop16(op, this.or16, this.d1);
		case 0o157: // OR.W D1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.or16, this.d1);
		case 0o162: // OR.L D1,(An)
		case 0o163: // OR.L D1,(An)+
		case 0o164: // OR.L D1,-(An)
		case 0o165: // OR.L D1,d(An)
		case 0o166: // OR.L D1,d(An,Xi)
			return void this.rwop32(op, this.or32, this.d1);
		case 0o167: // OR.L D1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.or32, this.d1);
		case 0o170: // DIVS Dn,D1
		case 0o172: // DIVS (An),D1
		case 0o173: // DIVS (An)+,D1
		case 0o174: // DIVS -(An),D1
		case 0o175: // DIVS d(An),D1
		case 0o176: // DIVS d(An,Xi),D1
			return void(this.d1 = this.divs(this.rop16(op), this.d1));
		case 0o177: // DIVS Abs...,D1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d1 = this.divs(this.rop16(op), this.d1));
		case 0o200: // OR.B Dn,D2
		case 0o202: // OR.B (An),D2
		case 0o203: // OR.B (An)+,D2
		case 0o204: // OR.B -(An),D2
		case 0o205: // OR.B d(An),D2
		case 0o206: // OR.B d(An,Xi),D2
			return void(this.d2 = this.d2 & ~0xff | this.or8(this.rop8(op), this.d2));
		case 0o207: // OR.B Abs...,D2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d2 = this.d2 & ~0xff | this.or8(this.rop8(op), this.d2));
		case 0o210: // OR.W Dn,D2
		case 0o212: // OR.W (An),D2
		case 0o213: // OR.W (An)+,D2
		case 0o214: // OR.W -(An),D2
		case 0o215: // OR.W d(An),D2
		case 0o216: // OR.W d(An,Xi),D2
			return void(this.d2 = this.d2 & ~0xffff | this.or16(this.rop16(op), this.d2));
		case 0o217: // OR.W Abs...,D2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d2 = this.d2 & ~0xffff | this.or16(this.rop16(op), this.d2));
		case 0o220: // OR.L Dn,D2
		case 0o222: // OR.L (An),D2
		case 0o223: // OR.L (An)+,D2
		case 0o224: // OR.L -(An),D2
		case 0o225: // OR.L d(An),D2
		case 0o226: // OR.L d(An,Xi),D2
			return void(this.d2 = this.or32(this.rop32(op), this.d2));
		case 0o227: // OR.L Abs...,D2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d2 = this.or32(this.rop32(op), this.d2));
		case 0o230: // DIVU Dn,D2
		case 0o232: // DIVU (An),D2
		case 0o233: // DIVU (An)+,D2
		case 0o234: // DIVU -(An),D2
		case 0o235: // DIVU d(An),D2
		case 0o236: // DIVU d(An,Xi),D2
			return void(this.d2 = this.divu(this.rop16(op), this.d2));
		case 0o237: // DIVU Abs...,D2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d2 = this.divu(this.rop16(op), this.d2));
		case 0o240: // SBCD Dy,D2
			return void(this.d2 = this.d2 & ~0xff | this.sbcd(this.rop8(op), this.d2));
		case 0o241: // SBCD -(Ay),-(A2)
			return void this.write8(this.sbcd(this.rop8(op & 7 | 0o40), this.read8(this.a2 = this.a2 - 1 | 0)), this.a2);
		case 0o242: // OR.B D2,(An)
		case 0o243: // OR.B D2,(An)+
		case 0o244: // OR.B D2,-(An)
		case 0o245: // OR.B D2,d(An)
		case 0o246: // OR.B D2,d(An,Xi)
			return void this.rwop8(op, this.or8, this.d2);
		case 0o247: // OR.B D2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.or8, this.d2);
		case 0o252: // OR.W D2,(An)
		case 0o253: // OR.W D2,(An)+
		case 0o254: // OR.W D2,-(An)
		case 0o255: // OR.W D2,d(An)
		case 0o256: // OR.W D2,d(An,Xi)
			return void this.rwop16(op, this.or16, this.d2);
		case 0o257: // OR.W D2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.or16, this.d2);
		case 0o262: // OR.L D2,(An)
		case 0o263: // OR.L D2,(An)+
		case 0o264: // OR.L D2,-(An)
		case 0o265: // OR.L D2,d(An)
		case 0o266: // OR.L D2,d(An,Xi)
			return void this.rwop32(op, this.or32, this.d2);
		case 0o267: // OR.L D2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.or32, this.d2);
		case 0o270: // DIVS Dn,D2
		case 0o272: // DIVS (An),D2
		case 0o273: // DIVS (An)+,D2
		case 0o274: // DIVS -(An),D2
		case 0o275: // DIVS d(An),D2
		case 0o276: // DIVS d(An,Xi),D2
			return void(this.d2 = this.divs(this.rop16(op), this.d2));
		case 0o277: // DIVS Abs...,D2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d2 = this.divs(this.rop16(op), this.d2));
		case 0o300: // OR.B Dn,D3
		case 0o302: // OR.B (An),D3
		case 0o303: // OR.B (An)+,D3
		case 0o304: // OR.B -(An),D3
		case 0o305: // OR.B d(An),D3
		case 0o306: // OR.B d(An,Xi),D3
			return void(this.d3 = this.d3 & ~0xff | this.or8(this.rop8(op), this.d3));
		case 0o307: // OR.B Abs...,D3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d3 = this.d3 & ~0xff | this.or8(this.rop8(op), this.d3));
		case 0o310: // OR.W Dn,D3
		case 0o312: // OR.W (An),D3
		case 0o313: // OR.W (An)+,D3
		case 0o314: // OR.W -(An),D3
		case 0o315: // OR.W d(An),D3
		case 0o316: // OR.W d(An,Xi),D3
			return void(this.d3 = this.d3 & ~0xffff | this.or16(this.rop16(op), this.d3));
		case 0o317: // OR.W Abs...,D3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d3 = this.d3 & ~0xffff | this.or16(this.rop16(op), this.d3));
		case 0o320: // OR.L Dn,D3
		case 0o322: // OR.L (An),D3
		case 0o323: // OR.L (An)+,D3
		case 0o324: // OR.L -(An),D3
		case 0o325: // OR.L d(An),D3
		case 0o326: // OR.L d(An,Xi),D3
			return void(this.d3 = this.or32(this.rop32(op), this.d3));
		case 0o327: // OR.L Abs...,D3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d3 = this.or32(this.rop32(op), this.d3));
		case 0o330: // DIVU Dn,D3
		case 0o332: // DIVU (An),D3
		case 0o333: // DIVU (An)+,D3
		case 0o334: // DIVU -(An),D3
		case 0o335: // DIVU d(An),D3
		case 0o336: // DIVU d(An,Xi),D3
			return void(this.d3 = this.divu(this.rop16(op), this.d3));
		case 0o337: // DIVU Abs...,D3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d3 = this.divu(this.rop16(op), this.d3));
		case 0o340: // SBCD Dy,D3
			return void(this.d3 = this.d3 & ~0xff | this.sbcd(this.rop8(op), this.d3));
		case 0o341: // SBCD -(Ay),-(A3)
			return void this.write8(this.sbcd(this.rop8(op & 7 | 0o40), this.read8(this.a3 = this.a3 - 1 | 0)), this.a3);
		case 0o342: // OR.B D3,(An)
		case 0o343: // OR.B D3,(An)+
		case 0o344: // OR.B D3,-(An)
		case 0o345: // OR.B D3,d(An)
		case 0o346: // OR.B D3,d(An,Xi)
			return void this.rwop8(op, this.or8, this.d3);
		case 0o347: // OR.B D3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.or8, this.d3);
		case 0o352: // OR.W D3,(An)
		case 0o353: // OR.W D3,(An)+
		case 0o354: // OR.W D3,-(An)
		case 0o355: // OR.W D3,d(An)
		case 0o356: // OR.W D3,d(An,Xi)
			return void this.rwop16(op, this.or16, this.d3);
		case 0o357: // OR.W D3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.or16, this.d3);
		case 0o362: // OR.L D3,(An)
		case 0o363: // OR.L D3,(An)+
		case 0o364: // OR.L D3,-(An)
		case 0o365: // OR.L D3,d(An)
		case 0o366: // OR.L D3,d(An,Xi)
			return void this.rwop32(op, this.or32, this.d3);
		case 0o367: // OR.L D3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.or32, this.d3);
		case 0o370: // DIVS Dn,D3
		case 0o372: // DIVS (An),D3
		case 0o373: // DIVS (An)+,D3
		case 0o374: // DIVS -(An),D3
		case 0o375: // DIVS d(An),D3
		case 0o376: // DIVS d(An,Xi),D3
			return void(this.d3 = this.divs(this.rop16(op), this.d3));
		case 0o377: // DIVS Abs...,D3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d3 = this.divs(this.rop16(op), this.d3));
		case 0o400: // OR.B Dn,D4
		case 0o402: // OR.B (An),D4
		case 0o403: // OR.B (An)+,D4
		case 0o404: // OR.B -(An),D4
		case 0o405: // OR.B d(An),D4
		case 0o406: // OR.B d(An,Xi),D4
			return void(this.d4 = this.d4 & ~0xff | this.or8(this.rop8(op), this.d4));
		case 0o407: // OR.B Abs...,D4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d4 = this.d4 & ~0xff | this.or8(this.rop8(op), this.d4));
		case 0o410: // OR.W Dn,D4
		case 0o412: // OR.W (An),D4
		case 0o413: // OR.W (An)+,D4
		case 0o414: // OR.W -(An),D4
		case 0o415: // OR.W d(An),D4
		case 0o416: // OR.W d(An,Xi),D4
			return void(this.d4 = this.d4 & ~0xffff | this.or16(this.rop16(op), this.d4));
		case 0o417: // OR.W Abs...,D4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d4 = this.d4 & ~0xffff | this.or16(this.rop16(op), this.d4));
		case 0o420: // OR.L Dn,D4
		case 0o422: // OR.L (An),D4
		case 0o423: // OR.L (An)+,D4
		case 0o424: // OR.L -(An),D4
		case 0o425: // OR.L d(An),D4
		case 0o426: // OR.L d(An,Xi),D4
			return void(this.d4 = this.or32(this.rop32(op), this.d4));
		case 0o427: // OR.L Abs...,D4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d4 = this.or32(this.rop32(op), this.d4));
		case 0o430: // DIVU Dn,D4
		case 0o432: // DIVU (An),D4
		case 0o433: // DIVU (An)+,D4
		case 0o434: // DIVU -(An),D4
		case 0o435: // DIVU d(An),D4
		case 0o436: // DIVU d(An,Xi),D4
			return void(this.d4 = this.divu(this.rop16(op), this.d4));
		case 0o437: // DIVU Abs...,D4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d4 = this.divu(this.rop16(op), this.d4));
		case 0o440: // SBCD Dy,D4
			return void(this.d4 = this.d4 & ~0xff | this.sbcd(this.rop8(op), this.d4));
		case 0o441: // SBCD -(Ay),-(A4)
			return void this.write8(this.sbcd(this.rop8(op & 7 | 0o40), this.read8(this.a4 = this.a4 - 1 | 0)), this.a4);
		case 0o442: // OR.B D4,(An)
		case 0o443: // OR.B D4,(An)+
		case 0o444: // OR.B D4,-(An)
		case 0o445: // OR.B D4,d(An)
		case 0o446: // OR.B D4,d(An,Xi)
			return void this.rwop8(op, this.or8, this.d4);
		case 0o447: // OR.B D4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.or8, this.d4);
		case 0o452: // OR.W D4,(An)
		case 0o453: // OR.W D4,(An)+
		case 0o454: // OR.W D4,-(An)
		case 0o455: // OR.W D4,d(An)
		case 0o456: // OR.W D4,d(An,Xi)
			return void this.rwop16(op, this.or16, this.d4);
		case 0o457: // OR.W D4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.or16, this.d4);
		case 0o462: // OR.L D4,(An)
		case 0o463: // OR.L D4,(An)+
		case 0o464: // OR.L D4,-(An)
		case 0o465: // OR.L D4,d(An)
		case 0o466: // OR.L D4,d(An,Xi)
			return void this.rwop32(op, this.or32, this.d4);
		case 0o467: // OR.L D4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.or32, this.d4);
		case 0o470: // DIVS Dn,D4
		case 0o472: // DIVS (An),D4
		case 0o473: // DIVS (An)+,D4
		case 0o474: // DIVS -(An),D4
		case 0o475: // DIVS d(An),D4
		case 0o476: // DIVS d(An,Xi),D4
			return void(this.d4 = this.divs(this.rop16(op), this.d4));
		case 0o477: // DIVS Abs...,D4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d4 = this.divs(this.rop16(op), this.d4));
		case 0o500: // OR.B Dn,D5
		case 0o502: // OR.B (An),D5
		case 0o503: // OR.B (An)+,D5
		case 0o504: // OR.B -(An),D5
		case 0o505: // OR.B d(An),D5
		case 0o506: // OR.B d(An,Xi),D5
			return void(this.d5 = this.d5 & ~0xff | this.or8(this.rop8(op), this.d5));
		case 0o507: // OR.B Abs...,D5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d5 = this.d5 & ~0xff | this.or8(this.rop8(op), this.d5));
		case 0o510: // OR.W Dn,D5
		case 0o512: // OR.W (An),D5
		case 0o513: // OR.W (An)+,D5
		case 0o514: // OR.W -(An),D5
		case 0o515: // OR.W d(An),D5
		case 0o516: // OR.W d(An,Xi),D5
			return void(this.d5 = this.d5 & ~0xffff | this.or16(this.rop16(op), this.d5));
		case 0o517: // OR.W Abs...,D5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d5 = this.d5 & ~0xffff | this.or16(this.rop16(op), this.d5));
		case 0o520: // OR.L Dn,D5
		case 0o522: // OR.L (An),D5
		case 0o523: // OR.L (An)+,D5
		case 0o524: // OR.L -(An),D5
		case 0o525: // OR.L d(An),D5
		case 0o526: // OR.L d(An,Xi),D5
			return void(this.d5 = this.or32(this.rop32(op), this.d5));
		case 0o527: // OR.L Abs...,D5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d5 = this.or32(this.rop32(op), this.d5));
		case 0o530: // DIVU Dn,D5
		case 0o532: // DIVU (An),D5
		case 0o533: // DIVU (An)+,D5
		case 0o534: // DIVU -(An),D5
		case 0o535: // DIVU d(An),D5
		case 0o536: // DIVU d(An,Xi),D5
			return void(this.d5 = this.divu(this.rop16(op), this.d5));
		case 0o537: // DIVU Abs...,D5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d5 = this.divu(this.rop16(op), this.d5));
		case 0o540: // SBCD Dy,D5
			return void(this.d5 = this.d5 & ~0xff | this.sbcd(this.rop8(op), this.d5));
		case 0o541: // SBCD -(Ay),-(A5)
			return void this.write8(this.sbcd(this.rop8(op & 7 | 0o40), this.read8(this.a5 = this.a5 - 1 | 0)), this.a5);
		case 0o542: // OR.B D5,(An)
		case 0o543: // OR.B D5,(An)+
		case 0o544: // OR.B D5,-(An)
		case 0o545: // OR.B D5,d(An)
		case 0o546: // OR.B D5,d(An,Xi)
			return void this.rwop8(op, this.or8, this.d5);
		case 0o547: // OR.B D5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.or8, this.d5);
		case 0o552: // OR.W D5,(An)
		case 0o553: // OR.W D5,(An)+
		case 0o554: // OR.W D5,-(An)
		case 0o555: // OR.W D5,d(An)
		case 0o556: // OR.W D5,d(An,Xi)
			return void this.rwop16(op, this.or16, this.d5);
		case 0o557: // OR.W D5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.or16, this.d5);
		case 0o562: // OR.L D5,(An)
		case 0o563: // OR.L D5,(An)+
		case 0o564: // OR.L D5,-(An)
		case 0o565: // OR.L D5,d(An)
		case 0o566: // OR.L D5,d(An,Xi)
			return void this.rwop32(op, this.or32, this.d5);
		case 0o567: // OR.L D5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.or32, this.d5);
		case 0o570: // DIVS Dn,D5
		case 0o572: // DIVS (An),D5
		case 0o573: // DIVS (An)+,D5
		case 0o574: // DIVS -(An),D5
		case 0o575: // DIVS d(An),D5
		case 0o576: // DIVS d(An,Xi),D5
			return void(this.d5 = this.divs(this.rop16(op), this.d5));
		case 0o577: // DIVS Abs...,D5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d5 = this.divs(this.rop16(op), this.d5));
		case 0o600: // OR.B Dn,D6
		case 0o602: // OR.B (An),D6
		case 0o603: // OR.B (An)+,D6
		case 0o604: // OR.B -(An),D6
		case 0o605: // OR.B d(An),D6
		case 0o606: // OR.B d(An,Xi),D6
			return void(this.d6 = this.d6 & ~0xff | this.or8(this.rop8(op), this.d6));
		case 0o607: // OR.B Abs...,D6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d6 = this.d6 & ~0xff | this.or8(this.rop8(op), this.d6));
		case 0o610: // OR.W Dn,D6
		case 0o612: // OR.W (An),D6
		case 0o613: // OR.W (An)+,D6
		case 0o614: // OR.W -(An),D6
		case 0o615: // OR.W d(An),D6
		case 0o616: // OR.W d(An,Xi),D6
			return void(this.d6 = this.d6 & ~0xffff | this.or16(this.rop16(op), this.d6));
		case 0o617: // OR.W Abs...,D6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d6 = this.d6 & ~0xffff | this.or16(this.rop16(op), this.d6));
		case 0o620: // OR.L Dn,D6
		case 0o622: // OR.L (An),D6
		case 0o623: // OR.L (An)+,D6
		case 0o624: // OR.L -(An),D6
		case 0o625: // OR.L d(An),D6
		case 0o626: // OR.L d(An,Xi),D6
			return void(this.d6 = this.or32(this.rop32(op), this.d6));
		case 0o627: // OR.L Abs...,D6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d6 = this.or32(this.rop32(op), this.d6));
		case 0o630: // DIVU Dn,D6
		case 0o632: // DIVU (An),D6
		case 0o633: // DIVU (An)+,D6
		case 0o634: // DIVU -(An),D6
		case 0o635: // DIVU d(An),D6
		case 0o636: // DIVU d(An,Xi),D6
			return void(this.d6 = this.divu(this.rop16(op), this.d6));
		case 0o637: // DIVU Abs...,D6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d6 = this.divu(this.rop16(op), this.d6));
		case 0o640: // SBCD Dy,D6
			return void(this.d6 = this.d6 & ~0xff | this.sbcd(this.rop8(op), this.d6));
		case 0o641: // SBCD -(Ay),-(A6)
			return void this.write8(this.sbcd(this.rop8(op & 7 | 0o40), this.read8(this.a6 = this.a6 - 1 | 0)), this.a6);
		case 0o642: // OR.B D6,(An)
		case 0o643: // OR.B D6,(An)+
		case 0o644: // OR.B D6,-(An)
		case 0o645: // OR.B D6,d(An)
		case 0o646: // OR.B D6,d(An,Xi)
			return void this.rwop8(op, this.or8, this.d6);
		case 0o647: // OR.B D6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.or8, this.d6);
		case 0o652: // OR.W D6,(An)
		case 0o653: // OR.W D6,(An)+
		case 0o654: // OR.W D6,-(An)
		case 0o655: // OR.W D6,d(An)
		case 0o656: // OR.W D6,d(An,Xi)
			return void this.rwop16(op, this.or16, this.d6);
		case 0o657: // OR.W D6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.or16, this.d6);
		case 0o662: // OR.L D6,(An)
		case 0o663: // OR.L D6,(An)+
		case 0o664: // OR.L D6,-(An)
		case 0o665: // OR.L D6,d(An)
		case 0o666: // OR.L D6,d(An,Xi)
			return void this.rwop32(op, this.or32, this.d6);
		case 0o667: // OR.L D6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.or32, this.d6);
		case 0o670: // DIVS Dn,D6
		case 0o672: // DIVS (An),D6
		case 0o673: // DIVS (An)+,D6
		case 0o674: // DIVS -(An),D6
		case 0o675: // DIVS d(An),D6
		case 0o676: // DIVS d(An,Xi),D6
			return void(this.d6 = this.divs(this.rop16(op), this.d6));
		case 0o677: // DIVS Abs...,D6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d6 = this.divs(this.rop16(op), this.d6));
		case 0o700: // OR.B Dn,D7
		case 0o702: // OR.B (An),D7
		case 0o703: // OR.B (An)+,D7
		case 0o704: // OR.B -(An),D7
		case 0o705: // OR.B d(An),D7
		case 0o706: // OR.B d(An,Xi),D7
			return void(this.d7 = this.d7 & ~0xff | this.or8(this.rop8(op), this.d7));
		case 0o707: // OR.B Abs...,D7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d7 = this.d7 & ~0xff | this.or8(this.rop8(op), this.d7));
		case 0o710: // OR.W Dn,D7
		case 0o712: // OR.W (An),D7
		case 0o713: // OR.W (An)+,D7
		case 0o714: // OR.W -(An),D7
		case 0o715: // OR.W d(An),D7
		case 0o716: // OR.W d(An,Xi),D7
			return void(this.d7 = this.d7 & ~0xffff | this.or16(this.rop16(op), this.d7));
		case 0o717: // OR.W Abs...,D7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d7 = this.d7 & ~0xffff | this.or16(this.rop16(op), this.d7));
		case 0o720: // OR.L Dn,D7
		case 0o722: // OR.L (An),D7
		case 0o723: // OR.L (An)+,D7
		case 0o724: // OR.L -(An),D7
		case 0o725: // OR.L d(An),D7
		case 0o726: // OR.L d(An,Xi),D7
			return void(this.d7 = this.or32(this.rop32(op), this.d7));
		case 0o727: // OR.L Abs...,D7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d7 = this.or32(this.rop32(op), this.d7));
		case 0o730: // DIVU Dn,D7
		case 0o732: // DIVU (An),D7
		case 0o733: // DIVU (An)+,D7
		case 0o734: // DIVU -(An),D7
		case 0o735: // DIVU d(An),D7
		case 0o736: // DIVU d(An,Xi),D7
			return void(this.d7 = this.divu(this.rop16(op), this.d7));
		case 0o737: // DIVU Abs...,D7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d7 = this.divu(this.rop16(op), this.d7));
		case 0o740: // SBCD Dy,D7
			return void(this.d7 = this.d7 & ~0xff | this.sbcd(this.rop8(op), this.d7));
		case 0o741: // SBCD -(Ay),-(A7)
			return void this.write8(this.sbcd(this.rop8(op & 7 | 0o40), this.read8(this.a7 = this.a7 - 1 | 0)), this.a7);
		case 0o742: // OR.B D7,(An)
		case 0o743: // OR.B D7,(An)+
		case 0o744: // OR.B D7,-(An)
		case 0o745: // OR.B D7,d(An)
		case 0o746: // OR.B D7,d(An,Xi)
			return void this.rwop8(op, this.or8, this.d7);
		case 0o747: // OR.B D7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.or8, this.d7);
		case 0o752: // OR.W D7,(An)
		case 0o753: // OR.W D7,(An)+
		case 0o754: // OR.W D7,-(An)
		case 0o755: // OR.W D7,d(An)
		case 0o756: // OR.W D7,d(An,Xi)
			return void this.rwop16(op, this.or16, this.d7);
		case 0o757: // OR.W D7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.or16, this.d7);
		case 0o762: // OR.L D7,(An)
		case 0o763: // OR.L D7,(An)+
		case 0o764: // OR.L D7,-(An)
		case 0o765: // OR.L D7,d(An)
		case 0o766: // OR.L D7,d(An,Xi)
			return void this.rwop32(op, this.or32, this.d7);
		case 0o767: // OR.L D7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.or32, this.d7);
		case 0o770: // DIVS Dn,D7
		case 0o772: // DIVS (An),D7
		case 0o773: // DIVS (An)+,D7
		case 0o774: // DIVS -(An),D7
		case 0o775: // DIVS d(An),D7
		case 0o776: // DIVS d(An,Xi),D7
			return void(this.d7 = this.divs(this.rop16(op), this.d7));
		case 0o777: // DIVS Abs...,D7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d7 = this.divs(this.rop16(op), this.d7));
		default:
			return void this.exception(4);
		}
	}

	execute_9(op) {
		let data;

		switch (op >>> 3 & 0o777) {
		case 0o000: // SUB.B Dn,D0
		case 0o002: // SUB.B (An),D0
		case 0o003: // SUB.B (An)+,D0
		case 0o004: // SUB.B -(An),D0
		case 0o005: // SUB.B d(An),D0
		case 0o006: // SUB.B d(An,Xi),D0
			return void(this.d0 = this.d0 & ~0xff | this.sub8(this.rop8(op), this.d0));
		case 0o007: // SUB.B Abs...,D0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d0 = this.d0 & ~0xff | this.sub8(this.rop8(op), this.d0));
		case 0o010: // SUB.W Dn,D0
		case 0o011: // SUB.W An,D0
		case 0o012: // SUB.W (An),D0
		case 0o013: // SUB.W (An)+,D0
		case 0o014: // SUB.W -(An),D0
		case 0o015: // SUB.W d(An),D0
		case 0o016: // SUB.W d(An,Xi),D0
			return void(this.d0 = this.d0 & ~0xffff | this.sub16(this.rop16(op), this.d0));
		case 0o017: // SUB.W Abs...,D0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d0 = this.d0 & ~0xffff | this.sub16(this.rop16(op), this.d0));
		case 0o020: // SUB.L Dn,D0
		case 0o021: // SUB.L An,D0
		case 0o022: // SUB.L (An),D0
		case 0o023: // SUB.L (An)+,D0
		case 0o024: // SUB.L -(An),D0
		case 0o025: // SUB.L d(An),D0
		case 0o026: // SUB.L d(An,Xi),D0
			return void(this.d0 = this.sub32(this.rop32(op), this.d0));
		case 0o027: // SUB.L Abs...,D0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d0 = this.sub32(this.rop32(op), this.d0));
		case 0o030: // SUBA.W Dn,A0
		case 0o031: // SUBA.W An,A0
		case 0o032: // SUBA.W (An),A0
		case 0o033: // SUBA.W (An)+,A0
		case 0o034: // SUBA.W -(An),A0
		case 0o035: // SUBA.W d(An),A0
		case 0o036: // SUBA.W d(An,Xi),A0
			return void(this.a0 = this.a0 - (data = this.rop16(op)) + (data << 1 & 0x10000) | 0);
		case 0o037: // SUBA.W Abs...,A0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a0 = this.a0 - (data = this.rop16(op)) + (data << 1 & 0x10000) | 0);
		case 0o040: // SUBX.B Dy,D0
			return void(this.d0 = this.d0 & ~0xff | this.subx8(this.rop8(op), this.d0));
		case 0o041: // SUBX.B -(Ay),-(A0)
			return void this.write8(this.subx8(this.rop8(op & 7 | 0o40), this.read8(this.a0 = this.a0 - 1 | 0)), this.a0);
		case 0o042: // SUB.B D0,(An)
		case 0o043: // SUB.B D0,(An)+
		case 0o044: // SUB.B D0,-(An)
		case 0o045: // SUB.B D0,d(An)
		case 0o046: // SUB.B D0,d(An,Xi)
			return void this.rwop8(op, this.sub8, this.d0);
		case 0o047: // SUB.B D0,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.sub8, this.d0);
		case 0o050: // SUBX.W Dy,D0
			return void(this.d0 = this.d0 & ~0xffff | this.subx16(this.rop16(op), this.d0));
		case 0o051: // SUBX.W -(Ay),-(A0)
			return void this.write16(this.subx16(this.rop16(op & 7 | 0o40), this.read16(this.a0 = this.a0 - 2 | 0)), this.a0);
		case 0o052: // SUB.W D0,(An)
		case 0o053: // SUB.W D0,(An)+
		case 0o054: // SUB.W D0,-(An)
		case 0o055: // SUB.W D0,d(An)
		case 0o056: // SUB.W D0,d(An,Xi)
			return void this.rwop16(op, this.sub16, this.d0);
		case 0o057: // SUB.W D0,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.sub16, this.d0);
		case 0o060: // SUBX.L Dy,D0
			return void(this.d0 = this.subx32(this.rop32(op), this.d0));
		case 0o061: // SUBX.L -(Ay),-(A0)
			return void this.write32(this.subx32(this.rop32(op & 7 | 0o40), this.read32(this.a0 = this.a0 - 4 | 0)), this.a0);
		case 0o062: // SUB.L D0,(An)
		case 0o063: // SUB.L D0,(An)+
		case 0o064: // SUB.L D0,-(An)
		case 0o065: // SUB.L D0,d(An)
		case 0o066: // SUB.L D0,d(An,Xi)
			return void this.rwop32(op, this.sub32, this.d0);
		case 0o067: // SUB.L D0,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.sub32, this.d0);
		case 0o070: // SUBA.L Dn,A0
		case 0o071: // SUBA.L An,A0
		case 0o072: // SUBA.L (An),A0
		case 0o073: // SUBA.L (An)+,A0
		case 0o074: // SUBA.L -(An),A0
		case 0o075: // SUBA.L d(An),A0
		case 0o076: // SUBA.L d(An,Xi),A0
			return void(this.a0 = this.a0 - this.rop32(op) | 0);
		case 0o077: // SUBA.L Abs...,A0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a0 = this.a0 - this.rop32(op) | 0);
		case 0o100: // SUB.B Dn,D1
		case 0o102: // SUB.B (An),D1
		case 0o103: // SUB.B (An)+,D1
		case 0o104: // SUB.B -(An),D1
		case 0o105: // SUB.B d(An),D1
		case 0o106: // SUB.B d(An,Xi),D1
			return void(this.d1 = this.d1 & ~0xff | this.sub8(this.rop8(op), this.d1));
		case 0o107: // SUB.B Abs...,D1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d1 = this.d1 & ~0xff | this.sub8(this.rop8(op), this.d1));
		case 0o110: // SUB.W Dn,D1
		case 0o111: // SUB.W An,D1
		case 0o112: // SUB.W (An),D1
		case 0o113: // SUB.W (An)+,D1
		case 0o114: // SUB.W -(An),D1
		case 0o115: // SUB.W d(An),D1
		case 0o116: // SUB.W d(An,Xi),D1
			return void(this.d1 = this.d1 & ~0xffff | this.sub16(this.rop16(op), this.d1));
		case 0o117: // SUB.W Abs...,D1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d1 = this.d1 & ~0xffff | this.sub16(this.rop16(op), this.d1));
		case 0o120: // SUB.L Dn,D1
		case 0o121: // SUB.L An,D1
		case 0o122: // SUB.L (An),D1
		case 0o123: // SUB.L (An)+,D1
		case 0o124: // SUB.L -(An),D1
		case 0o125: // SUB.L d(An),D1
		case 0o126: // SUB.L d(An,Xi),D1
			return void(this.d1 = this.sub32(this.rop32(op), this.d1));
		case 0o127: // SUB.L Abs...,D1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d1 = this.sub32(this.rop32(op), this.d1));
		case 0o130: // SUBA.W Dn,A1
		case 0o131: // SUBA.W An,A1
		case 0o132: // SUBA.W (An),A1
		case 0o133: // SUBA.W (An)+,A1
		case 0o134: // SUBA.W -(An),A1
		case 0o135: // SUBA.W d(An),A1
		case 0o136: // SUBA.W d(An,Xi),A1
			return void(this.a1 = this.a1 - (data = this.rop16(op)) + (data << 1 & 0x10000) | 0);
		case 0o137: // SUBA.W Abs...,A1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a1 = this.a1 - (data = this.rop16(op)) + (data << 1 & 0x10000) | 0);
		case 0o140: // SUBX.B Dy,D1
			return void(this.d1 = this.d1 & ~0xff | this.subx8(this.rop8(op), this.d1));
		case 0o141: // SUBX.B -(Ay),-(A1)
			return void this.write8(this.subx8(this.rop8(op & 7 | 0o40), this.read8(this.a1 = this.a1 - 1 | 0)), this.a1);
		case 0o142: // SUB.B D1,(An)
		case 0o143: // SUB.B D1,(An)+
		case 0o144: // SUB.B D1,-(An)
		case 0o145: // SUB.B D1,d(An)
		case 0o146: // SUB.B D1,d(An,Xi)
			return void this.rwop8(op, this.sub8, this.d1);
		case 0o147: // SUB.B D1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.sub8, this.d1);
		case 0o150: // SUBX.W Dy,D1
			return void(this.d1 = this.d1 & ~0xffff | this.subx16(this.rop16(op), this.d1));
		case 0o151: // SUBX.W -(Ay),-(A1)
			return void this.write16(this.subx16(this.rop16(op & 7 | 0o40), this.read16(this.a1 = this.a1 - 2 | 0)), this.a1);
		case 0o152: // SUB.W D1,(An)
		case 0o153: // SUB.W D1,(An)+
		case 0o154: // SUB.W D1,-(An)
		case 0o155: // SUB.W D1,d(An)
		case 0o156: // SUB.W D1,d(An,Xi)
			return void this.rwop16(op, this.sub16, this.d1);
		case 0o157: // SUB.W D1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.sub16, this.d1);
		case 0o160: // SUBX.L Dy,D1
			return void(this.d1 = this.subx32(this.rop32(op), this.d1));
		case 0o161: // SUBX.L -(Ay),-(A1)
			return void this.write32(this.subx32(this.rop32(op & 7 | 0o40), this.read32(this.a1 = this.a1 - 4 | 0)), this.a1);
		case 0o162: // SUB.L D1,(An)
		case 0o163: // SUB.L D1,(An)+
		case 0o164: // SUB.L D1,-(An)
		case 0o165: // SUB.L D1,d(An)
		case 0o166: // SUB.L D1,d(An,Xi)
			return void this.rwop32(op, this.sub32, this.d1);
		case 0o167: // SUB.L D1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.sub32, this.d1);
		case 0o170: // SUBA.L Dn,A1
		case 0o171: // SUBA.L An,A1
		case 0o172: // SUBA.L (An),A1
		case 0o173: // SUBA.L (An)+,A1
		case 0o174: // SUBA.L -(An),A1
		case 0o175: // SUBA.L d(An),A1
		case 0o176: // SUBA.L d(An,Xi),A1
			return void(this.a1 = this.a1 - this.rop32(op) | 0);
		case 0o177: // SUBA.L Abs...,A1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a1 = this.a1 - this.rop32(op) | 0);
		case 0o200: // SUB.B Dn,D2
		case 0o202: // SUB.B (An),D2
		case 0o203: // SUB.B (An)+,D2
		case 0o204: // SUB.B -(An),D2
		case 0o205: // SUB.B d(An),D2
		case 0o206: // SUB.B d(An,Xi),D2
			return void(this.d2 = this.d2 & ~0xff | this.sub8(this.rop8(op), this.d2));
		case 0o207: // SUB.B Abs...,D2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d2 = this.d2 & ~0xff | this.sub8(this.rop8(op), this.d2));
		case 0o210: // SUB.W Dn,D2
		case 0o211: // SUB.W An,D2
		case 0o212: // SUB.W (An),D2
		case 0o213: // SUB.W (An)+,D2
		case 0o214: // SUB.W -(An),D2
		case 0o215: // SUB.W d(An),D2
		case 0o216: // SUB.W d(An,Xi),D2
			return void(this.d2 = this.d2 & ~0xffff | this.sub16(this.rop16(op), this.d2));
		case 0o217: // SUB.W Abs...,D2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d2 = this.d2 & ~0xffff | this.sub16(this.rop16(op), this.d2));
		case 0o220: // SUB.L Dn,D2
		case 0o221: // SUB.L An,D2
		case 0o222: // SUB.L (An),D2
		case 0o223: // SUB.L (An)+,D2
		case 0o224: // SUB.L -(An),D2
		case 0o225: // SUB.L d(An),D2
		case 0o226: // SUB.L d(An,Xi),D2
			return void(this.d2 = this.sub32(this.rop32(op), this.d2));
		case 0o227: // SUB.L Abs...,D2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d2 = this.sub32(this.rop32(op), this.d2));
		case 0o230: // SUBA.W Dn,A2
		case 0o231: // SUBA.W An,A2
		case 0o232: // SUBA.W (An),A2
		case 0o233: // SUBA.W (An)+,A2
		case 0o234: // SUBA.W -(An),A2
		case 0o235: // SUBA.W d(An),A2
		case 0o236: // SUBA.W d(An,Xi),A2
			return void(this.a2 = this.a2 - (data = this.rop16(op)) + (data << 1 & 0x10000) | 0);
		case 0o237: // SUBA.W Abs...,A2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a2 = this.a2 - (data = this.rop16(op)) + (data << 1 & 0x10000) | 0);
		case 0o240: // SUBX.B Dy,D2
			return void(this.d2 = this.d2 & ~0xff | this.subx8(this.rop8(op), this.d2));
		case 0o241: // SUBX.B -(Ay),-(A2)
			return void this.write8(this.subx8(this.rop8(op & 7 | 0o40), this.read8(this.a2 = this.a2 - 1 | 0)), this.a2);
		case 0o242: // SUB.B D2,(An)
		case 0o243: // SUB.B D2,(An)+
		case 0o244: // SUB.B D2,-(An)
		case 0o245: // SUB.B D2,d(An)
		case 0o246: // SUB.B D2,d(An,Xi)
			return void this.rwop8(op, this.sub8, this.d2);
		case 0o247: // SUB.B D2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.sub8, this.d2);
		case 0o250: // SUBX.W Dy,D2
			return void(this.d2 = this.d2 & ~0xffff | this.subx16(this.rop16(op), this.d2));
		case 0o251: // SUBX.W -(Ay),-(A2)
			return void this.write16(this.subx16(this.rop16(op & 7 | 0o40), this.read16(this.a2 = this.a2 - 2 | 0)), this.a2);
		case 0o252: // SUB.W D2,(An)
		case 0o253: // SUB.W D2,(An)+
		case 0o254: // SUB.W D2,-(An)
		case 0o255: // SUB.W D2,d(An)
		case 0o256: // SUB.W D2,d(An,Xi)
			return void this.rwop16(op, this.sub16, this.d2);
		case 0o257: // SUB.W D2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.sub16, this.d2);
		case 0o260: // SUBX.L Dy,D2
			return void(this.d2 = this.subx32(this.rop32(op), this.d2));
		case 0o261: // SUBX.L -(Ay),-(A2)
			return void this.write32(this.subx32(this.rop32(op & 7 | 0o40), this.read32(this.a2 = this.a2 - 4 | 0)), this.a2);
		case 0o262: // SUB.L D2,(An)
		case 0o263: // SUB.L D2,(An)+
		case 0o264: // SUB.L D2,-(An)
		case 0o265: // SUB.L D2,d(An)
		case 0o266: // SUB.L D2,d(An,Xi)
			return void this.rwop32(op, this.sub32, this.d2);
		case 0o267: // SUB.L D2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.sub32, this.d2);
		case 0o270: // SUBA.L Dn,A2
		case 0o271: // SUBA.L An,A2
		case 0o272: // SUBA.L (An),A2
		case 0o273: // SUBA.L (An)+,A2
		case 0o274: // SUBA.L -(An),A2
		case 0o275: // SUBA.L d(An),A2
		case 0o276: // SUBA.L d(An,Xi),A2
			return void(this.a2 = this.a2 - this.rop32(op) | 0);
		case 0o277: // SUBA.L Abs...,A2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a2 = this.a2 - this.rop32(op) | 0);
		case 0o300: // SUB.B Dn,D3
		case 0o302: // SUB.B (An),D3
		case 0o303: // SUB.B (An)+,D3
		case 0o304: // SUB.B -(An),D3
		case 0o305: // SUB.B d(An),D3
		case 0o306: // SUB.B d(An,Xi),D3
			return void(this.d3 = this.d3 & ~0xff | this.sub8(this.rop8(op), this.d3));
		case 0o307: // SUB.B Abs...,D3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d3 = this.d3 & ~0xff | this.sub8(this.rop8(op), this.d3));
		case 0o310: // SUB.W Dn,D3
		case 0o311: // SUB.W An,D3
		case 0o312: // SUB.W (An),D3
		case 0o313: // SUB.W (An)+,D3
		case 0o314: // SUB.W -(An),D3
		case 0o315: // SUB.W d(An),D3
		case 0o316: // SUB.W d(An,Xi),D3
			return void(this.d3 = this.d3 & ~0xffff | this.sub16(this.rop16(op), this.d3));
		case 0o317: // SUB.W Abs...,D3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d3 = this.d3 & ~0xffff | this.sub16(this.rop16(op), this.d3));
		case 0o320: // SUB.L Dn,D3
		case 0o321: // SUB.L An,D3
		case 0o322: // SUB.L (An),D3
		case 0o323: // SUB.L (An)+,D3
		case 0o324: // SUB.L -(An),D3
		case 0o325: // SUB.L d(An),D3
		case 0o326: // SUB.L d(An,Xi),D3
			return void(this.d3 = this.sub32(this.rop32(op), this.d3));
		case 0o327: // SUB.L Abs...,D3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d3 = this.sub32(this.rop32(op), this.d3));
		case 0o330: // SUBA.W Dn,A3
		case 0o331: // SUBA.W An,A3
		case 0o332: // SUBA.W (An),A3
		case 0o333: // SUBA.W (An)+,A3
		case 0o334: // SUBA.W -(An),A3
		case 0o335: // SUBA.W d(An),A3
		case 0o336: // SUBA.W d(An,Xi),A3
			return void(this.a3 = this.a3 - (data = this.rop16(op)) + (data << 1 & 0x10000) | 0);
		case 0o337: // SUBA.W Abs...,A3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a3 = this.a3 - (data = this.rop16(op)) + (data << 1 & 0x10000) | 0);
		case 0o340: // SUBX.B Dy,D3
			return void(this.d3 = this.d3 & ~0xff | this.subx8(this.rop8(op), this.d3));
		case 0o341: // SUBX.B -(Ay),-(A3)
			return void this.write8(this.subx8(this.rop8(op & 7 | 0o40), this.read8(this.a3 = this.a3 - 1 | 0)), this.a3);
		case 0o342: // SUB.B D3,(An)
		case 0o343: // SUB.B D3,(An)+
		case 0o344: // SUB.B D3,-(An)
		case 0o345: // SUB.B D3,d(An)
		case 0o346: // SUB.B D3,d(An,Xi)
			return void this.rwop8(op, this.sub8, this.d3);
		case 0o347: // SUB.B D3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.sub8, this.d3);
		case 0o350: // SUBX.W Dy,D3
			return void(this.d3 = this.d3 & ~0xffff | this.subx16(this.rop16(op), this.d3));
		case 0o351: // SUBX.W -(Ay),-(A3)
			return void this.write16(this.subx16(this.rop16(op & 7 | 0o40), this.read16(this.a3 = this.a3 - 2 | 0)), this.a3);
		case 0o352: // SUB.W D3,(An)
		case 0o353: // SUB.W D3,(An)+
		case 0o354: // SUB.W D3,-(An)
		case 0o355: // SUB.W D3,d(An)
		case 0o356: // SUB.W D3,d(An,Xi)
			return void this.rwop16(op, this.sub16, this.d3);
		case 0o357: // SUB.W D3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.sub16, this.d3);
		case 0o360: // SUBX.L Dy,D3
			return void(this.d3 = this.subx32(this.rop32(op), this.d3));
		case 0o361: // SUBX.L -(Ay),-(A3)
			return void this.write32(this.subx32(this.rop32(op & 7 | 0o40), this.read32(this.a3 = this.a3 - 4 | 0)), this.a3);
		case 0o362: // SUB.L D3,(An)
		case 0o363: // SUB.L D3,(An)+
		case 0o364: // SUB.L D3,-(An)
		case 0o365: // SUB.L D3,d(An)
		case 0o366: // SUB.L D3,d(An,Xi)
			return void this.rwop32(op, this.sub32, this.d3);
		case 0o367: // SUB.L D3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.sub32, this.d3);
		case 0o370: // SUBA.L Dn,A3
		case 0o371: // SUBA.L An,A3
		case 0o372: // SUBA.L (An),A3
		case 0o373: // SUBA.L (An)+,A3
		case 0o374: // SUBA.L -(An),A3
		case 0o375: // SUBA.L d(An),A3
		case 0o376: // SUBA.L d(An,Xi),A3
			return void(this.a3 = this.a3 - this.rop32(op) | 0);
		case 0o377: // SUBA.L Abs...,A3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a3 = this.a3 - this.rop32(op) | 0);
		case 0o400: // SUB.B Dn,D4
		case 0o402: // SUB.B (An),D4
		case 0o403: // SUB.B (An)+,D4
		case 0o404: // SUB.B -(An),D4
		case 0o405: // SUB.B d(An),D4
		case 0o406: // SUB.B d(An,Xi),D4
			return void(this.d4 = this.d4 & ~0xff | this.sub8(this.rop8(op), this.d4));
		case 0o407: // SUB.B Abs...,D4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d4 = this.d4 & ~0xff | this.sub8(this.rop8(op), this.d4));
		case 0o410: // SUB.W Dn,D4
		case 0o411: // SUB.W An,D4
		case 0o412: // SUB.W (An),D4
		case 0o413: // SUB.W (An)+,D4
		case 0o414: // SUB.W -(An),D4
		case 0o415: // SUB.W d(An),D4
		case 0o416: // SUB.W d(An,Xi),D4
			return void(this.d4 = this.d4 & ~0xffff | this.sub16(this.rop16(op), this.d4));
		case 0o417: // SUB.W Abs...,D4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d4 = this.d4 & ~0xffff | this.sub16(this.rop16(op), this.d4));
		case 0o420: // SUB.L Dn,D4
		case 0o421: // SUB.L An,D4
		case 0o422: // SUB.L (An),D4
		case 0o423: // SUB.L (An)+,D4
		case 0o424: // SUB.L -(An),D4
		case 0o425: // SUB.L d(An),D4
		case 0o426: // SUB.L d(An,Xi),D4
			return void(this.d4 = this.sub32(this.rop32(op), this.d4));
		case 0o427: // SUB.L Abs...,D4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d4 = this.sub32(this.rop32(op), this.d4));
		case 0o430: // SUBA.W Dn,A4
		case 0o431: // SUBA.W An,A4
		case 0o432: // SUBA.W (An),A4
		case 0o433: // SUBA.W (An)+,A4
		case 0o434: // SUBA.W -(An),A4
		case 0o435: // SUBA.W d(An),A4
		case 0o436: // SUBA.W d(An,Xi),A4
			return void(this.a4 = this.a4 - (data = this.rop16(op)) + (data << 1 & 0x10000) | 0);
		case 0o437: // SUBA.W Abs...,A4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a4 = this.a4 - (data = this.rop16(op)) + (data << 1 & 0x10000) | 0);
		case 0o440: // SUBX.B Dy,D4
			return void(this.d4 = this.d4 & ~0xff | this.subx8(this.rop8(op), this.d4));
		case 0o441: // SUBX.B -(Ay),-(A4)
			return void this.write8(this.subx8(this.rop8(op & 7 | 0o40), this.read8(this.a4 = this.a4 - 1 | 0)), this.a4);
		case 0o442: // SUB.B D4,(An)
		case 0o443: // SUB.B D4,(An)+
		case 0o444: // SUB.B D4,-(An)
		case 0o445: // SUB.B D4,d(An)
		case 0o446: // SUB.B D4,d(An,Xi)
			return void this.rwop8(op, this.sub8, this.d4);
		case 0o447: // SUB.B D4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.sub8, this.d4);
		case 0o450: // SUBX.W Dy,D4
			return void(this.d4 = this.d4 & ~0xffff | this.subx16(this.rop16(op), this.d4));
		case 0o451: // SUBX.W -(Ay),-(A4)
			return void this.write16(this.subx16(this.rop16(op & 7 | 0o40), this.read16(this.a4 = this.a4 - 2 | 0)), this.a4);
		case 0o452: // SUB.W D4,(An)
		case 0o453: // SUB.W D4,(An)+
		case 0o454: // SUB.W D4,-(An)
		case 0o455: // SUB.W D4,d(An)
		case 0o456: // SUB.W D4,d(An,Xi)
			return void this.rwop16(op, this.sub16, this.d4);
		case 0o457: // SUB.W D4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.sub16, this.d4);
		case 0o460: // SUBX.L Dy,D4
			return void(this.d4 = this.subx32(this.rop32(op), this.d4));
		case 0o461: // SUBX.L -(Ay),-(A4)
			return void this.write32(this.subx32(this.rop32(op & 7 | 0o40), this.read32(this.a4 = this.a4 - 4 | 0)), this.a4);
		case 0o462: // SUB.L D4,(An)
		case 0o463: // SUB.L D4,(An)+
		case 0o464: // SUB.L D4,-(An)
		case 0o465: // SUB.L D4,d(An)
		case 0o466: // SUB.L D4,d(An,Xi)
			return void this.rwop32(op, this.sub32, this.d4);
		case 0o467: // SUB.L D4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.sub32, this.d4);
		case 0o470: // SUBA.L Dn,A4
		case 0o471: // SUBA.L An,A4
		case 0o472: // SUBA.L (An),A4
		case 0o473: // SUBA.L (An)+,A4
		case 0o474: // SUBA.L -(An),A4
		case 0o475: // SUBA.L d(An),A4
		case 0o476: // SUBA.L d(An,Xi),A4
			return void(this.a4 = this.a4 - this.rop32(op) | 0);
		case 0o477: // SUBA.L Abs...,A4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a4 = this.a4 - this.rop32(op) | 0);
		case 0o500: // SUB.B Dn,D5
		case 0o502: // SUB.B (An),D5
		case 0o503: // SUB.B (An)+,D5
		case 0o504: // SUB.B -(An),D5
		case 0o505: // SUB.B d(An),D5
		case 0o506: // SUB.B d(An,Xi),D5
			return void(this.d5 = this.d5 & ~0xff | this.sub8(this.rop8(op), this.d5));
		case 0o507: // SUB.B Abs...,D5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d5 = this.d5 & ~0xff | this.sub8(this.rop8(op), this.d5));
		case 0o510: // SUB.W Dn,D5
		case 0o511: // SUB.W An,D5
		case 0o512: // SUB.W (An),D5
		case 0o513: // SUB.W (An)+,D5
		case 0o514: // SUB.W -(An),D5
		case 0o515: // SUB.W d(An),D5
		case 0o516: // SUB.W d(An,Xi),D5
			return void(this.d5 = this.d5 & ~0xffff | this.sub16(this.rop16(op), this.d5));
		case 0o517: // SUB.W Abs...,D5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d5 = this.d5 & ~0xffff | this.sub16(this.rop16(op), this.d5));
		case 0o520: // SUB.L Dn,D5
		case 0o521: // SUB.L An,D5
		case 0o522: // SUB.L (An),D5
		case 0o523: // SUB.L (An)+,D5
		case 0o524: // SUB.L -(An),D5
		case 0o525: // SUB.L d(An),D5
		case 0o526: // SUB.L d(An,Xi),D5
			return void(this.d5 = this.sub32(this.rop32(op), this.d5));
		case 0o527: // SUB.L Abs...,D5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d5 = this.sub32(this.rop32(op), this.d5));
		case 0o530: // SUBA.W Dn,A5
		case 0o531: // SUBA.W An,A5
		case 0o532: // SUBA.W (An),A5
		case 0o533: // SUBA.W (An)+,A5
		case 0o534: // SUBA.W -(An),A5
		case 0o535: // SUBA.W d(An),A5
		case 0o536: // SUBA.W d(An,Xi),A5
			return void(this.a5 = this.a5 - (data = this.rop16(op)) + (data << 1 & 0x10000) | 0);
		case 0o537: // SUBA.W Abs...,A5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a5 = this.a5 - (data = this.rop16(op)) + (data << 1 & 0x10000) | 0);
		case 0o540: // SUBX.B Dy,D5
			return void(this.d5 = this.d5 & ~0xff | this.subx8(this.rop8(op), this.d5));
		case 0o541: // SUBX.B -(Ay),-(A5)
			return void this.write8(this.subx8(this.rop8(op & 7 | 0o40), this.read8(this.a5 = this.a5 - 1 | 0)), this.a5);
		case 0o542: // SUB.B D5,(An)
		case 0o543: // SUB.B D5,(An)+
		case 0o544: // SUB.B D5,-(An)
		case 0o545: // SUB.B D5,d(An)
		case 0o546: // SUB.B D5,d(An,Xi)
			return void this.rwop8(op, this.sub8, this.d5);
		case 0o547: // SUB.B D5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.sub8, this.d5);
		case 0o550: // SUBX.W Dy,D5
			return void(this.d5 = this.d5 & ~0xffff | this.subx16(this.rop16(op), this.d5));
		case 0o551: // SUBX.W -(Ay),-(A5)
			return void this.write16(this.subx16(this.rop16(op & 7 | 0o40), this.read16(this.a5 = this.a5 - 2 | 0)), this.a5);
		case 0o552: // SUB.W D5,(An)
		case 0o553: // SUB.W D5,(An)+
		case 0o554: // SUB.W D5,-(An)
		case 0o555: // SUB.W D5,d(An)
		case 0o556: // SUB.W D5,d(An,Xi)
			return void this.rwop16(op, this.sub16, this.d5);
		case 0o557: // SUB.W D5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.sub16, this.d5);
		case 0o560: // SUBX.L Dy,D5
			return void(this.d5 = this.subx32(this.rop32(op), this.d5));
		case 0o561: // SUBX.L -(Ay),-(A5)
			return void this.write32(this.subx32(this.rop32(op & 7 | 0o40), this.read32(this.a5 = this.a5 - 4 | 0)), this.a5);
		case 0o562: // SUB.L D5,(An)
		case 0o563: // SUB.L D5,(An)+
		case 0o564: // SUB.L D5,-(An)
		case 0o565: // SUB.L D5,d(An)
		case 0o566: // SUB.L D5,d(An,Xi)
			return void this.rwop32(op, this.sub32, this.d5);
		case 0o567: // SUB.L D5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.sub32, this.d5);
		case 0o570: // SUBA.L Dn,A5
		case 0o571: // SUBA.L An,A5
		case 0o572: // SUBA.L (An),A5
		case 0o573: // SUBA.L (An)+,A5
		case 0o574: // SUBA.L -(An),A5
		case 0o575: // SUBA.L d(An),A5
		case 0o576: // SUBA.L d(An,Xi),A5
			return void(this.a5 = this.a5 - this.rop32(op) | 0);
		case 0o577: // SUBA.L Abs...,A5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a5 = this.a5 - this.rop32(op) | 0);
		case 0o600: // SUB.B Dn,D6
		case 0o602: // SUB.B (An),D6
		case 0o603: // SUB.B (An)+,D6
		case 0o604: // SUB.B -(An),D6
		case 0o605: // SUB.B d(An),D6
		case 0o606: // SUB.B d(An,Xi),D6
			return void(this.d6 = this.d6 & ~0xff | this.sub8(this.rop8(op), this.d6));
		case 0o607: // SUB.B Abs...,D6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d6 = this.d6 & ~0xff | this.sub8(this.rop8(op), this.d6));
		case 0o610: // SUB.W Dn,D6
		case 0o611: // SUB.W An,D6
		case 0o612: // SUB.W (An),D6
		case 0o613: // SUB.W (An)+,D6
		case 0o614: // SUB.W -(An),D6
		case 0o615: // SUB.W d(An),D6
		case 0o616: // SUB.W d(An,Xi),D6
			return void(this.d6 = this.d6 & ~0xffff | this.sub16(this.rop16(op), this.d6));
		case 0o617: // SUB.W Abs...,D6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d6 = this.d6 & ~0xffff | this.sub16(this.rop16(op), this.d6));
		case 0o620: // SUB.L Dn,D6
		case 0o621: // SUB.L An,D6
		case 0o622: // SUB.L (An),D6
		case 0o623: // SUB.L (An)+,D6
		case 0o624: // SUB.L -(An),D6
		case 0o625: // SUB.L d(An),D6
		case 0o626: // SUB.L d(An,Xi),D6
			return void(this.d6 = this.sub32(this.rop32(op), this.d6));
		case 0o627: // SUB.L Abs...,D6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d6 = this.sub32(this.rop32(op), this.d6));
		case 0o630: // SUBA.W Dn,A6
		case 0o631: // SUBA.W An,A6
		case 0o632: // SUBA.W (An),A6
		case 0o633: // SUBA.W (An)+,A6
		case 0o634: // SUBA.W -(An),A6
		case 0o635: // SUBA.W d(An),A6
		case 0o636: // SUBA.W d(An,Xi),A6
			return void(this.a6 = this.a6 - (data = this.rop16(op)) + (data << 1 & 0x10000) | 0);
		case 0o637: // SUBA.W Abs...,A6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a6 = this.a6 - (data = this.rop16(op)) + (data << 1 & 0x10000) | 0);
		case 0o640: // SUBX.B Dy,D6
			return void(this.d6 = this.d6 & ~0xff | this.subx8(this.rop8(op), this.d6));
		case 0o641: // SUBX.B -(Ay),-(A6)
			return void this.write8(this.subx8(this.rop8(op & 7 | 0o40), this.read8(this.a6 = this.a6 - 1 | 0)), this.a6);
		case 0o642: // SUB.B D6,(An)
		case 0o643: // SUB.B D6,(An)+
		case 0o644: // SUB.B D6,-(An)
		case 0o645: // SUB.B D6,d(An)
		case 0o646: // SUB.B D6,d(An,Xi)
			return void this.rwop8(op, this.sub8, this.d6);
		case 0o647: // SUB.B D6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.sub8, this.d6);
		case 0o650: // SUBX.W Dy,D6
			return void(this.d6 = this.d6 & ~0xffff | this.subx16(this.rop16(op), this.d6));
		case 0o651: // SUBX.W -(Ay),-(A6)
			return void this.write16(this.subx16(this.rop16(op & 7 | 0o40), this.read16(this.a6 = this.a6 - 2 | 0)), this.a6);
		case 0o652: // SUB.W D6,(An)
		case 0o653: // SUB.W D6,(An)+
		case 0o654: // SUB.W D6,-(An)
		case 0o655: // SUB.W D6,d(An)
		case 0o656: // SUB.W D6,d(An,Xi)
			return void this.rwop16(op, this.sub16, this.d6);
		case 0o657: // SUB.W D6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.sub16, this.d6);
		case 0o660: // SUBX.L Dy,D6
			return void(this.d6 = this.subx32(this.rop32(op), this.d6));
		case 0o661: // SUBX.L -(Ay),-(A6)
			return void this.write32(this.subx32(this.rop32(op & 7 | 0o40), this.read32(this.a6 = this.a6 - 4 | 0)), this.a6);
		case 0o662: // SUB.L D6,(An)
		case 0o663: // SUB.L D6,(An)+
		case 0o664: // SUB.L D6,-(An)
		case 0o665: // SUB.L D6,d(An)
		case 0o666: // SUB.L D6,d(An,Xi)
			return void this.rwop32(op, this.sub32, this.d6);
		case 0o667: // SUB.L D6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.sub32, this.d6);
		case 0o670: // SUBA.L Dn,A6
		case 0o671: // SUBA.L An,A6
		case 0o672: // SUBA.L (An),A6
		case 0o673: // SUBA.L (An)+,A6
		case 0o674: // SUBA.L -(An),A6
		case 0o675: // SUBA.L d(An),A6
		case 0o676: // SUBA.L d(An,Xi),A6
			return void(this.a6 = this.a6 - this.rop32(op) | 0);
		case 0o677: // SUBA.L Abs...,A6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a6 = this.a6 - this.rop32(op) | 0);
		case 0o700: // SUB.B Dn,D7
		case 0o702: // SUB.B (An),D7
		case 0o703: // SUB.B (An)+,D7
		case 0o704: // SUB.B -(An),D7
		case 0o705: // SUB.B d(An),D7
		case 0o706: // SUB.B d(An,Xi),D7
			return void(this.d7 = this.d7 & ~0xff | this.sub8(this.rop8(op), this.d7));
		case 0o707: // SUB.B Abs...,D7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d7 = this.d7 & ~0xff | this.sub8(this.rop8(op), this.d7));
		case 0o710: // SUB.W Dn,D7
		case 0o711: // SUB.W An,D7
		case 0o712: // SUB.W (An),D7
		case 0o713: // SUB.W (An)+,D7
		case 0o714: // SUB.W -(An),D7
		case 0o715: // SUB.W d(An),D7
		case 0o716: // SUB.W d(An,Xi),D7
			return void(this.d7 = this.d7 & ~0xffff | this.sub16(this.rop16(op), this.d7));
		case 0o717: // SUB.W Abs...,D7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d7 = this.d7 & ~0xffff | this.sub16(this.rop16(op), this.d7));
		case 0o720: // SUB.L Dn,D7
		case 0o721: // SUB.L An,D7
		case 0o722: // SUB.L (An),D7
		case 0o723: // SUB.L (An)+,D7
		case 0o724: // SUB.L -(An),D7
		case 0o725: // SUB.L d(An),D7
		case 0o726: // SUB.L d(An,Xi),D7
			return void(this.d7 = this.sub32(this.rop32(op), this.d7));
		case 0o727: // SUB.L Abs...,D7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d7 = this.sub32(this.rop32(op), this.d7));
		case 0o730: // SUBA.W Dn,A7
		case 0o731: // SUBA.W An,A7
		case 0o732: // SUBA.W (An),A7
		case 0o733: // SUBA.W (An)+,A7
		case 0o734: // SUBA.W -(An),A7
		case 0o735: // SUBA.W d(An),A7
		case 0o736: // SUBA.W d(An,Xi),A7
			return void(this.a7 = this.a7 - (data = this.rop16(op)) + (data << 1 & 0x10000) | 0);
		case 0o737: // SUBA.W Abs...,A7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a7 = this.a7 - (data = this.rop16(op)) + (data << 1 & 0x10000) | 0);
		case 0o740: // SUBX.B Dy,D7
			return void(this.d7 = this.d7 & ~0xff | this.subx8(this.rop8(op), this.d7));
		case 0o741: // SUBX.B -(Ay),-(A7)
			return void this.write8(this.subx8(this.rop8(op & 7 | 0o40), this.read8(this.a7 = this.a7 - 1 | 0)), this.a7);
		case 0o742: // SUB.B D7,(An)
		case 0o743: // SUB.B D7,(An)+
		case 0o744: // SUB.B D7,-(An)
		case 0o745: // SUB.B D7,d(An)
		case 0o746: // SUB.B D7,d(An,Xi)
			return void this.rwop8(op, this.sub8, this.d7);
		case 0o747: // SUB.B D7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.sub8, this.d7);
		case 0o750: // SUBX.W Dy,D7
			return void(this.d7 = this.d7 & ~0xffff | this.subx16(this.rop16(op), this.d7));
		case 0o751: // SUBX.W -(Ay),-(A7)
			return void this.write16(this.subx16(this.rop16(op & 7 | 0o40), this.read16(this.a7 = this.a7 - 2 | 0)), this.a7);
		case 0o752: // SUB.W D7,(An)
		case 0o753: // SUB.W D7,(An)+
		case 0o754: // SUB.W D7,-(An)
		case 0o755: // SUB.W D7,d(An)
		case 0o756: // SUB.W D7,d(An,Xi)
			return void this.rwop16(op, this.sub16, this.d7);
		case 0o757: // SUB.W D7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.sub16, this.d7);
		case 0o760: // SUBX.L Dy,D7
			return void(this.d7 = this.subx32(this.rop32(op), this.d7));
		case 0o761: // SUBX.L -(Ay),-(A7)
			return void this.write32(this.subx32(this.rop32(op & 7 | 0o40), this.read32(this.a7 = this.a7 - 4 | 0)), this.a7);
		case 0o762: // SUB.L D7,(An)
		case 0o763: // SUB.L D7,(An)+
		case 0o764: // SUB.L D7,-(An)
		case 0o765: // SUB.L D7,d(An)
		case 0o766: // SUB.L D7,d(An,Xi)
			return void this.rwop32(op, this.sub32, this.d7);
		case 0o767: // SUB.L D7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.sub32, this.d7);
		case 0o770: // SUBA.L Dn,A7
		case 0o771: // SUBA.L An,A7
		case 0o772: // SUBA.L (An),A7
		case 0o773: // SUBA.L (An)+,A7
		case 0o774: // SUBA.L -(An),A7
		case 0o775: // SUBA.L d(An),A7
		case 0o776: // SUBA.L d(An,Xi),A7
			return void(this.a7 = this.a7 - this.rop32(op) | 0);
		case 0o777: // SUBA.L Abs...,A7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a7 = this.a7 - this.rop32(op) | 0);
		default:
			return void this.exception(4);
		}
	}

	execute_b(op) {
		switch (op >>> 3 & 0o777) {
		case 0o000: // CMP.B Dn,D0
		case 0o002: // CMP.B (An),D0
		case 0o003: // CMP.B (An)+,D0
		case 0o004: // CMP.B -(An),D0
		case 0o005: // CMP.B d(An),D0
		case 0o006: // CMP.B d(An,Xi),D0
			return void this.cmp8(this.rop8(op), this.d0);
		case 0o007: // CMP.B Abs...,D0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp8(this.rop8(op), this.d0);
		case 0o010: // CMP.W Dn,D0
		case 0o011: // CMP.W An,D0
		case 0o012: // CMP.W (An),D0
		case 0o013: // CMP.W (An)+,D0
		case 0o014: // CMP.W -(An),D0
		case 0o015: // CMP.W d(An),D0
		case 0o016: // CMP.W d(An,Xi),D0
			return void this.cmp16(this.rop16(op), this.d0);
		case 0o017: // CMP.W Abs...,D0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp16(this.rop16(op), this.d0);
		case 0o020: // CMP.L Dn,D0
		case 0o021: // CMP.L An,D0
		case 0o022: // CMP.L (An),D0
		case 0o023: // CMP.L (An)+,D0
		case 0o024: // CMP.L -(An),D0
		case 0o025: // CMP.L d(An),D0
		case 0o026: // CMP.L d(An,Xi),D0
			return void this.cmp32(this.rop32(op), this.d0);
		case 0o027: // CMP.L Abs...,D0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp32(this.rop32(op), this.d0);
		case 0o030: // CMPA.W Dn,A0
		case 0o031: // CMPA.W An,A0
		case 0o032: // CMPA.W (An),A0
		case 0o033: // CMPA.W (An)+,A0
		case 0o034: // CMPA.W -(An),A0
		case 0o035: // CMPA.W d(An),A0
		case 0o036: // CMPA.W d(An,Xi),A0
			return void this.cmpa16(this.rop16(op), this.a0);
		case 0o037: // CMPA.W Abs...,A0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmpa16(this.rop16(op), this.a0);
		case 0o040: // EOR.B D0,Dn
			return void this.rwop8(op, this.eor8, this.d0);
		case 0o041: // CMPM.B (Ay)+,(A0)+
			this.cmp8(this.rop8(op & 7 | 0o30), this.read8(this.a0));
			return void(this.a0 = this.a0 + 1 | 0);
		case 0o042: // EOR.B D0,(An)
		case 0o043: // EOR.B D0,(An)+
		case 0o044: // EOR.B D0,-(An)
		case 0o045: // EOR.B D0,d(An)
		case 0o046: // EOR.B D0,d(An,Xi)
			return void this.rwop8(op, this.eor8, this.d0);
		case 0o047: // EOR.B D0,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.eor8, this.d0);
		case 0o050: // EOR.W D0,Dn
			return void this.rwop16(op, this.eor16, this.d0);
		case 0o051: // CMPM.W (Ay)+,(A0)+
			this.cmp16(this.rop16(op & 7 | 0o30), this.read16(this.a0));
			return void(this.a0 = this.a0 + 2 | 0);
		case 0o052: // EOR.W D0,(An)
		case 0o053: // EOR.W D0,(An)+
		case 0o054: // EOR.W D0,-(An)
		case 0o055: // EOR.W D0,d(An)
		case 0o056: // EOR.W D0,d(An,Xi)
			return void this.rwop16(op, this.eor16, this.d0);
		case 0o057: // EOR.W D0,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.eor16, this.d0);
		case 0o060: // EOR.L D0,Dn
			return void this.rwop32(op, this.eor32, this.d0);
		case 0o061: // CMPM.L (Ay)+,(A0)+
			this.cmp32(this.rop32(op & 7 | 0o30), this.read32(this.a0));
			return void(this.a0 = this.a0 + 4 | 0);
		case 0o062: // EOR.L D0,(An)
		case 0o063: // EOR.L D0,(An)+
		case 0o064: // EOR.L D0,-(An)
		case 0o065: // EOR.L D0,d(An)
		case 0o066: // EOR.L D0,d(An,Xi)
			return void this.rwop32(op, this.eor32, this.d0);
		case 0o067: // EOR.L D0,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.eor32, this.d0);
		case 0o070: // CMPA.L Dn,A0
		case 0o071: // CMPA.L An,A0
		case 0o072: // CMPA.L (An),A0
		case 0o073: // CMPA.L (An)+,A0
		case 0o074: // CMPA.L -(An),A0
		case 0o075: // CMPA.L d(An),A0
		case 0o076: // CMPA.L d(An,Xi),A0
			return void this.cmpa32(this.rop32(op), this.a0);
		case 0o077: // CMPA.L Abs...,A0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmpa32(this.rop32(op), this.a0);
		case 0o100: // CMP.B Dn,D1
		case 0o102: // CMP.B (An),D1
		case 0o103: // CMP.B (An)+,D1
		case 0o104: // CMP.B -(An),D1
		case 0o105: // CMP.B d(An),D1
		case 0o106: // CMP.B d(An,Xi),D1
			return void this.cmp8(this.rop8(op), this.d1);
		case 0o107: // CMP.B Abs...,D1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp8(this.rop8(op), this.d1);
		case 0o110: // CMP.W Dn,D1
		case 0o111: // CMP.W An,D1
		case 0o112: // CMP.W (An),D1
		case 0o113: // CMP.W (An)+,D1
		case 0o114: // CMP.W -(An),D1
		case 0o115: // CMP.W d(An),D1
		case 0o116: // CMP.W d(An,Xi),D1
			return void this.cmp16(this.rop16(op), this.d1);
		case 0o117: // CMP.W Abs...,D1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp16(this.rop16(op), this.d1);
		case 0o120: // CMP.L Dn,D1
		case 0o121: // CMP.L An,D1
		case 0o122: // CMP.L (An),D1
		case 0o123: // CMP.L (An)+,D1
		case 0o124: // CMP.L -(An),D1
		case 0o125: // CMP.L d(An),D1
		case 0o126: // CMP.L d(An,Xi),D1
			return void this.cmp32(this.rop32(op), this.d1);
		case 0o127: // CMP.L Abs...,D1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp32(this.rop32(op), this.d1);
		case 0o130: // CMPA.W Dn,A1
		case 0o131: // CMPA.W An,A1
		case 0o132: // CMPA.W (An),A1
		case 0o133: // CMPA.W (An)+,A1
		case 0o134: // CMPA.W -(An),A1
		case 0o135: // CMPA.W d(An),A1
		case 0o136: // CMPA.W d(An,Xi),A1
			return void this.cmpa16(this.rop16(op), this.a1);
		case 0o137: // CMPA.W Abs...,A1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmpa16(this.rop16(op), this.a1);
		case 0o140: // EOR.B D1,Dn
			return void this.rwop8(op, this.eor8, this.d1);
		case 0o141: // CMPM.B (Ay)+,(A1)+
			this.cmp8(this.rop8(op & 7 | 0o30), this.read8(this.a1));
			return void(this.a1 = this.a1 + 1 | 0);
		case 0o142: // EOR.B D1,(An)
		case 0o143: // EOR.B D1,(An)+
		case 0o144: // EOR.B D1,-(An)
		case 0o145: // EOR.B D1,d(An)
		case 0o146: // EOR.B D1,d(An,Xi)
			return void this.rwop8(op, this.eor8, this.d1);
		case 0o147: // EOR.B D1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.eor8, this.d1);
		case 0o150: // EOR.W D1,Dn
			return void this.rwop16(op, this.eor16, this.d1);
		case 0o151: // CMPM.W (Ay)+,(A1)+
			this.cmp16(this.rop16(op & 7 | 0o30), this.read16(this.a1));
			return void(this.a1 = this.a1 + 2 | 0);
		case 0o152: // EOR.W D1,(An)
		case 0o153: // EOR.W D1,(An)+
		case 0o154: // EOR.W D1,-(An)
		case 0o155: // EOR.W D1,d(An)
		case 0o156: // EOR.W D1,d(An,Xi)
			return void this.rwop16(op, this.eor16, this.d1);
		case 0o157: // EOR.W D1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.eor16, this.d1);
		case 0o160: // EOR.L D1,Dn
			return void this.rwop32(op, this.eor32, this.d1);
		case 0o161: // CMPM.L (Ay)+,(A1)+
			this.cmp32(this.rop32(op & 7 | 0o30), this.read32(this.a1));
			return void(this.a1 = this.a1 + 4 | 0);
		case 0o162: // EOR.L D1,(An)
		case 0o163: // EOR.L D1,(An)+
		case 0o164: // EOR.L D1,-(An)
		case 0o165: // EOR.L D1,d(An)
		case 0o166: // EOR.L D1,d(An,Xi)
			return void this.rwop32(op, this.eor32, this.d1);
		case 0o167: // EOR.L D1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.eor32, this.d1);
		case 0o170: // CMPA.L Dn,A1
		case 0o171: // CMPA.L An,A1
		case 0o172: // CMPA.L (An),A1
		case 0o173: // CMPA.L (An)+,A1
		case 0o174: // CMPA.L -(An),A1
		case 0o175: // CMPA.L d(An),A1
		case 0o176: // CMPA.L d(An,Xi),A1
			return void this.cmpa32(this.rop32(op), this.a1);
		case 0o177: // CMPA.L Abs...,A1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmpa32(this.rop32(op), this.a1);
		case 0o200: // CMP.B Dn,D2
		case 0o202: // CMP.B (An),D2
		case 0o203: // CMP.B (An)+,D2
		case 0o204: // CMP.B -(An),D2
		case 0o205: // CMP.B d(An),D2
		case 0o206: // CMP.B d(An,Xi),D2
			return void this.cmp8(this.rop8(op), this.d2);
		case 0o207: // CMP.B Abs...,D2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp8(this.rop8(op), this.d2);
		case 0o210: // CMP.W Dn,D2
		case 0o211: // CMP.W An,D2
		case 0o212: // CMP.W (An),D2
		case 0o213: // CMP.W (An)+,D2
		case 0o214: // CMP.W -(An),D2
		case 0o215: // CMP.W d(An),D2
		case 0o216: // CMP.W d(An,Xi),D2
			return void this.cmp16(this.rop16(op), this.d2);
		case 0o217: // CMP.W Abs...,D2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp16(this.rop16(op), this.d2);
		case 0o220: // CMP.L Dn,D2
		case 0o221: // CMP.L An,D2
		case 0o222: // CMP.L (An),D2
		case 0o223: // CMP.L (An)+,D2
		case 0o224: // CMP.L -(An),D2
		case 0o225: // CMP.L d(An),D2
		case 0o226: // CMP.L d(An,Xi),D2
			return void this.cmp32(this.rop32(op), this.d2);
		case 0o227: // CMP.L Abs...,D2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp32(this.rop32(op), this.d2);
		case 0o230: // CMPA.W Dn,A2
		case 0o231: // CMPA.W An,A2
		case 0o232: // CMPA.W (An),A2
		case 0o233: // CMPA.W (An)+,A2
		case 0o234: // CMPA.W -(An),A2
		case 0o235: // CMPA.W d(An),A2
		case 0o236: // CMPA.W d(An,Xi),A2
			return void this.cmpa16(this.rop16(op), this.a2);
		case 0o237: // CMPA.W Abs...,A2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmpa16(this.rop16(op), this.a2);
		case 0o240: // EOR.B D2,Dn
			return void this.rwop8(op, this.eor8, this.d2);
		case 0o241: // CMPM.B (Ay)+,(A2)+
			this.cmp8(this.rop8(op & 7 | 0o30), this.read8(this.a2));
			return void(this.a2 = this.a2 + 1 | 0);
		case 0o242: // EOR.B D2,(An)
		case 0o243: // EOR.B D2,(An)+
		case 0o244: // EOR.B D2,-(An)
		case 0o245: // EOR.B D2,d(An)
		case 0o246: // EOR.B D2,d(An,Xi)
			return void this.rwop8(op, this.eor8, this.d2);
		case 0o247: // EOR.B D2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.eor8, this.d2);
		case 0o250: // EOR.W D2,Dn
			return void this.rwop16(op, this.eor16, this.d2);
		case 0o251: // CMPM.W (Ay)+,(A2)+
			this.cmp16(this.rop16(op & 7 | 0o30), this.read16(this.a2));
			return void(this.a2 = this.a2 + 2 | 0);
		case 0o252: // EOR.W D2,(An)
		case 0o253: // EOR.W D2,(An)+
		case 0o254: // EOR.W D2,-(An)
		case 0o255: // EOR.W D2,d(An)
		case 0o256: // EOR.W D2,d(An,Xi)
			return void this.rwop16(op, this.eor16, this.d2);
		case 0o257: // EOR.W D2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.eor16, this.d2);
		case 0o260: // EOR.L D2,Dn
			return void this.rwop32(op, this.eor32, this.d2);
		case 0o261: // CMPM.L (Ay)+,(A2)+
			this.cmp32(this.rop32(op & 7 | 0o30), this.read32(this.a2));
			return void(this.a2 = this.a2 + 4 | 0);
		case 0o262: // EOR.L D2,(An)
		case 0o263: // EOR.L D2,(An)+
		case 0o264: // EOR.L D2,-(An)
		case 0o265: // EOR.L D2,d(An)
		case 0o266: // EOR.L D2,d(An,Xi)
			return void this.rwop32(op, this.eor32, this.d2);
		case 0o267: // EOR.L D2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.eor32, this.d2);
		case 0o270: // CMPA.L Dn,A2
		case 0o271: // CMPA.L An,A2
		case 0o272: // CMPA.L (An),A2
		case 0o273: // CMPA.L (An)+,A2
		case 0o274: // CMPA.L -(An),A2
		case 0o275: // CMPA.L d(An),A2
		case 0o276: // CMPA.L d(An,Xi),A2
			return void this.cmpa32(this.rop32(op), this.a2);
		case 0o277: // CMPA.L Abs...,A2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmpa32(this.rop32(op), this.a2);
		case 0o300: // CMP.B Dn,D3
		case 0o302: // CMP.B (An),D3
		case 0o303: // CMP.B (An)+,D3
		case 0o304: // CMP.B -(An),D3
		case 0o305: // CMP.B d(An),D3
		case 0o306: // CMP.B d(An,Xi),D3
			return void this.cmp8(this.rop8(op), this.d3);
		case 0o307: // CMP.B Abs...,D3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp8(this.rop8(op), this.d3);
		case 0o310: // CMP.W Dn,D3
		case 0o311: // CMP.W An,D3
		case 0o312: // CMP.W (An),D3
		case 0o313: // CMP.W (An)+,D3
		case 0o314: // CMP.W -(An),D3
		case 0o315: // CMP.W d(An),D3
		case 0o316: // CMP.W d(An,Xi),D3
			return void this.cmp16(this.rop16(op), this.d3);
		case 0o317: // CMP.W Abs...,D3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp16(this.rop16(op), this.d3);
		case 0o320: // CMP.L Dn,D3
		case 0o321: // CMP.L An,D3
		case 0o322: // CMP.L (An),D3
		case 0o323: // CMP.L (An)+,D3
		case 0o324: // CMP.L -(An),D3
		case 0o325: // CMP.L d(An),D3
		case 0o326: // CMP.L d(An,Xi),D3
			return void this.cmp32(this.rop32(op), this.d3);
		case 0o327: // CMP.L Abs...,D3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp32(this.rop32(op), this.d3);
		case 0o330: // CMPA.W Dn,A3
		case 0o331: // CMPA.W An,A3
		case 0o332: // CMPA.W (An),A3
		case 0o333: // CMPA.W (An)+,A3
		case 0o334: // CMPA.W -(An),A3
		case 0o335: // CMPA.W d(An),A3
		case 0o336: // CMPA.W d(An,Xi),A3
			return void this.cmpa16(this.rop16(op), this.a3);
		case 0o337: // CMPA.W Abs...,A3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmpa16(this.rop16(op), this.a3);
		case 0o340: // EOR.B D3,Dn
			return void this.rwop8(op, this.eor8, this.d3);
		case 0o341: // CMPM.B (Ay)+,(A3)+
			this.cmp8(this.rop8(op & 7 | 0o30), this.read8(this.a3));
			return void(this.a3 = this.a3 + 1 | 0);
		case 0o342: // EOR.B D3,(An)
		case 0o343: // EOR.B D3,(An)+
		case 0o344: // EOR.B D3,-(An)
		case 0o345: // EOR.B D3,d(An)
		case 0o346: // EOR.B D3,d(An,Xi)
			return void this.rwop8(op, this.eor8, this.d3);
		case 0o347: // EOR.B D3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.eor8, this.d3);
		case 0o350: // EOR.W D3,Dn
			return void this.rwop16(op, this.eor16, this.d3);
		case 0o351: // CMPM.W (Ay)+,(A3)+
			this.cmp16(this.rop16(op & 7 | 0o30), this.read16(this.a3));
			return void(this.a3 = this.a3 + 2 | 0);
		case 0o352: // EOR.W D3,(An)
		case 0o353: // EOR.W D3,(An)+
		case 0o354: // EOR.W D3,-(An)
		case 0o355: // EOR.W D3,d(An)
		case 0o356: // EOR.W D3,d(An,Xi)
			return void this.rwop16(op, this.eor16, this.d3);
		case 0o357: // EOR.W D3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.eor16, this.d3);
		case 0o360: // EOR.L D3,Dn
			return void this.rwop32(op, this.eor32, this.d3);
		case 0o361: // CMPM.L (Ay)+,(A3)+
			this.cmp32(this.rop32(op & 7 | 0o30), this.read32(this.a3));
			return void(this.a3 = this.a3 + 4 | 0);
		case 0o362: // EOR.L D3,(An)
		case 0o363: // EOR.L D3,(An)+
		case 0o364: // EOR.L D3,-(An)
		case 0o365: // EOR.L D3,d(An)
		case 0o366: // EOR.L D3,d(An,Xi)
			return void this.rwop32(op, this.eor32, this.d3);
		case 0o367: // EOR.L D3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.eor32, this.d3);
		case 0o370: // CMPA.L Dn,A3
		case 0o371: // CMPA.L An,A3
		case 0o372: // CMPA.L (An),A3
		case 0o373: // CMPA.L (An)+,A3
		case 0o374: // CMPA.L -(An),A3
		case 0o375: // CMPA.L d(An),A3
		case 0o376: // CMPA.L d(An,Xi),A3
			return void this.cmpa32(this.rop32(op), this.a3);
		case 0o377: // CMPA.L Abs...,A3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmpa32(this.rop32(op), this.a3);
		case 0o400: // CMP.B Dn,D4
		case 0o402: // CMP.B (An),D4
		case 0o403: // CMP.B (An)+,D4
		case 0o404: // CMP.B -(An),D4
		case 0o405: // CMP.B d(An),D4
		case 0o406: // CMP.B d(An,Xi),D4
			return void this.cmp8(this.rop8(op), this.d4);
		case 0o407: // CMP.B Abs...,D4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp8(this.rop8(op), this.d4);
		case 0o410: // CMP.W Dn,D4
		case 0o411: // CMP.W An,D4
		case 0o412: // CMP.W (An),D4
		case 0o413: // CMP.W (An)+,D4
		case 0o414: // CMP.W -(An),D4
		case 0o415: // CMP.W d(An),D4
		case 0o416: // CMP.W d(An,Xi),D4
			return void this.cmp16(this.rop16(op), this.d4);
		case 0o417: // CMP.W Abs...,D4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp16(this.rop16(op), this.d4);
		case 0o420: // CMP.L Dn,D4
		case 0o421: // CMP.L An,D4
		case 0o422: // CMP.L (An),D4
		case 0o423: // CMP.L (An)+,D4
		case 0o424: // CMP.L -(An),D4
		case 0o425: // CMP.L d(An),D4
		case 0o426: // CMP.L d(An,Xi),D4
			return void this.cmp32(this.rop32(op), this.d4);
		case 0o427: // CMP.L Abs...,D4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp32(this.rop32(op), this.d4);
		case 0o430: // CMPA.W Dn,A4
		case 0o431: // CMPA.W An,A4
		case 0o432: // CMPA.W (An),A4
		case 0o433: // CMPA.W (An)+,A4
		case 0o434: // CMPA.W -(An),A4
		case 0o435: // CMPA.W d(An),A4
		case 0o436: // CMPA.W d(An,Xi),A4
			return void this.cmpa16(this.rop16(op), this.a4);
		case 0o437: // CMPA.W Abs...,A4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmpa16(this.rop16(op), this.a4);
		case 0o440: // EOR.B D4,Dn
			return void this.rwop8(op, this.eor8, this.d4);
		case 0o441: // CMPM.B (Ay)+,(A4)+
			this.cmp8(this.rop8(op & 7 | 0o30), this.read8(this.a4));
			return void(this.a4 = this.a4 + 1 | 0);
		case 0o442: // EOR.B D4,(An)
		case 0o443: // EOR.B D4,(An)+
		case 0o444: // EOR.B D4,-(An)
		case 0o445: // EOR.B D4,d(An)
		case 0o446: // EOR.B D4,d(An,Xi)
			return void this.rwop8(op, this.eor8, this.d4);
		case 0o447: // EOR.B D4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.eor8, this.d4);
		case 0o450: // EOR.W D4,Dn
			return void this.rwop16(op, this.eor16, this.d4);
		case 0o451: // CMPM.W (Ay)+,(A4)+
			this.cmp16(this.rop16(op & 7 | 0o30), this.read16(this.a4));
			return void(this.a4 = this.a4 + 2 | 0);
		case 0o452: // EOR.W D4,(An)
		case 0o453: // EOR.W D4,(An)+
		case 0o454: // EOR.W D4,-(An)
		case 0o455: // EOR.W D4,d(An)
		case 0o456: // EOR.W D4,d(An,Xi)
			return void this.rwop16(op, this.eor16, this.d4);
		case 0o457: // EOR.W D4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.eor16, this.d4);
		case 0o460: // EOR.L D4,Dn
			return void this.rwop32(op, this.eor32, this.d4);
		case 0o461: // CMPM.L (Ay)+,(A4)+
			this.cmp32(this.rop32(op & 7 | 0o30), this.read32(this.a4));
			return void(this.a4 = this.a4 + 4 | 0);
		case 0o462: // EOR.L D4,(An)
		case 0o463: // EOR.L D4,(An)+
		case 0o464: // EOR.L D4,-(An)
		case 0o465: // EOR.L D4,d(An)
		case 0o466: // EOR.L D4,d(An,Xi)
			return void this.rwop32(op, this.eor32, this.d4);
		case 0o467: // EOR.L D4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.eor32, this.d4);
		case 0o470: // CMPA.L Dn,A4
		case 0o471: // CMPA.L An,A4
		case 0o472: // CMPA.L (An),A4
		case 0o473: // CMPA.L (An)+,A4
		case 0o474: // CMPA.L -(An),A4
		case 0o475: // CMPA.L d(An),A4
		case 0o476: // CMPA.L d(An,Xi),A4
			return void this.cmpa32(this.rop32(op), this.a4);
		case 0o477: // CMPA.L Abs...,A4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmpa32(this.rop32(op), this.a4);
		case 0o500: // CMP.B Dn,D5
		case 0o502: // CMP.B (An),D5
		case 0o503: // CMP.B (An)+,D5
		case 0o504: // CMP.B -(An),D5
		case 0o505: // CMP.B d(An),D5
		case 0o506: // CMP.B d(An,Xi),D5
			return void this.cmp8(this.rop8(op), this.d5);
		case 0o507: // CMP.B Abs...,D5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp8(this.rop8(op), this.d5);
		case 0o510: // CMP.W Dn,D5
		case 0o511: // CMP.W An,D5
		case 0o512: // CMP.W (An),D5
		case 0o513: // CMP.W (An)+,D5
		case 0o514: // CMP.W -(An),D5
		case 0o515: // CMP.W d(An),D5
		case 0o516: // CMP.W d(An,Xi),D5
			return void this.cmp16(this.rop16(op), this.d5);
		case 0o517: // CMP.W Abs...,D5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp16(this.rop16(op), this.d5);
		case 0o520: // CMP.L Dn,D5
		case 0o521: // CMP.L An,D5
		case 0o522: // CMP.L (An),D5
		case 0o523: // CMP.L (An)+,D5
		case 0o524: // CMP.L -(An),D5
		case 0o525: // CMP.L d(An),D5
		case 0o526: // CMP.L d(An,Xi),D5
			return void this.cmp32(this.rop32(op), this.d5);
		case 0o527: // CMP.L Abs...,D5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp32(this.rop32(op), this.d5);
		case 0o530: // CMPA.W Dn,A5
		case 0o531: // CMPA.W An,A5
		case 0o532: // CMPA.W (An),A5
		case 0o533: // CMPA.W (An)+,A5
		case 0o534: // CMPA.W -(An),A5
		case 0o535: // CMPA.W d(An),A5
		case 0o536: // CMPA.W d(An,Xi),A5
			return void this.cmpa16(this.rop16(op), this.a5);
		case 0o537: // CMPA.W Abs...,A5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmpa16(this.rop16(op), this.a5);
		case 0o540: // EOR.B D5,Dn
			return void this.rwop8(op, this.eor8, this.d5);
		case 0o541: // CMPM.B (Ay)+,(A5)+
			this.cmp8(this.rop8(op & 7 | 0o30), this.read8(this.a5));
			return void(this.a5 = this.a5 + 1 | 0);
		case 0o542: // EOR.B D5,(An)
		case 0o543: // EOR.B D5,(An)+
		case 0o544: // EOR.B D5,-(An)
		case 0o545: // EOR.B D5,d(An)
		case 0o546: // EOR.B D5,d(An,Xi)
			return void this.rwop8(op, this.eor8, this.d5);
		case 0o547: // EOR.B D5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.eor8, this.d5);
		case 0o550: // EOR.W D5,Dn
			return void this.rwop16(op, this.eor16, this.d5);
		case 0o551: // CMPM.W (Ay)+,(A5)+
			this.cmp16(this.rop16(op & 7 | 0o30), this.read16(this.a5));
			return void(this.a5 = this.a5 + 2 | 0);
		case 0o552: // EOR.W D5,(An)
		case 0o553: // EOR.W D5,(An)+
		case 0o554: // EOR.W D5,-(An)
		case 0o555: // EOR.W D5,d(An)
		case 0o556: // EOR.W D5,d(An,Xi)
			return void this.rwop16(op, this.eor16, this.d5);
		case 0o557: // EOR.W D5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.eor16, this.d5);
		case 0o560: // EOR.L D5,Dn
			return void this.rwop32(op, this.eor32, this.d5);
		case 0o561: // CMPM.L (Ay)+,(A5)+
			this.cmp32(this.rop32(op & 7 | 0o30), this.read32(this.a5));
			return void(this.a5 = this.a5 + 4 | 0);
		case 0o562: // EOR.L D5,(An)
		case 0o563: // EOR.L D5,(An)+
		case 0o564: // EOR.L D5,-(An)
		case 0o565: // EOR.L D5,d(An)
		case 0o566: // EOR.L D5,d(An,Xi)
			return void this.rwop32(op, this.eor32, this.d5);
		case 0o567: // EOR.L D5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.eor32, this.d5);
		case 0o570: // CMPA.L Dn,A5
		case 0o571: // CMPA.L An,A5
		case 0o572: // CMPA.L (An),A5
		case 0o573: // CMPA.L (An)+,A5
		case 0o574: // CMPA.L -(An),A5
		case 0o575: // CMPA.L d(An),A5
		case 0o576: // CMPA.L d(An,Xi),A5
			return void this.cmpa32(this.rop32(op), this.a5);
		case 0o577: // CMPA.L Abs...,A5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmpa32(this.rop32(op), this.a5);
		case 0o600: // CMP.B Dn,D6
		case 0o602: // CMP.B (An),D6
		case 0o603: // CMP.B (An)+,D6
		case 0o604: // CMP.B -(An),D6
		case 0o605: // CMP.B d(An),D6
		case 0o606: // CMP.B d(An,Xi),D6
			return void this.cmp8(this.rop8(op), this.d6);
		case 0o607: // CMP.B Abs...,D6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp8(this.rop8(op), this.d6);
		case 0o610: // CMP.W Dn,D6
		case 0o611: // CMP.W An,D6
		case 0o612: // CMP.W (An),D6
		case 0o613: // CMP.W (An)+,D6
		case 0o614: // CMP.W -(An),D6
		case 0o615: // CMP.W d(An),D6
		case 0o616: // CMP.W d(An,Xi),D6
			return void this.cmp16(this.rop16(op), this.d6);
		case 0o617: // CMP.W Abs...,D6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp16(this.rop16(op), this.d6);
		case 0o620: // CMP.L Dn,D6
		case 0o621: // CMP.L An,D6
		case 0o622: // CMP.L (An),D6
		case 0o623: // CMP.L (An)+,D6
		case 0o624: // CMP.L -(An),D6
		case 0o625: // CMP.L d(An),D6
		case 0o626: // CMP.L d(An,Xi),D6
			return void this.cmp32(this.rop32(op), this.d6);
		case 0o627: // CMP.L Abs...,D6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp32(this.rop32(op), this.d6);
		case 0o630: // CMPA.W Dn,A6
		case 0o631: // CMPA.W An,A6
		case 0o632: // CMPA.W (An),A6
		case 0o633: // CMPA.W (An)+,A6
		case 0o634: // CMPA.W -(An),A6
		case 0o635: // CMPA.W d(An),A6
		case 0o636: // CMPA.W d(An,Xi),A6
			return void this.cmpa16(this.rop16(op), this.a6);
		case 0o637: // CMPA.W Abs...,A6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmpa16(this.rop16(op), this.a6);
		case 0o640: // EOR.B D6,Dn
			return void this.rwop8(op, this.eor8, this.d6);
		case 0o641: // CMPM.B (Ay)+,(A6)+
			this.cmp8(this.rop8(op & 7 | 0o30), this.read8(this.a6));
			return void(this.a6 = this.a6 + 1 | 0);
		case 0o642: // EOR.B D6,(An)
		case 0o643: // EOR.B D6,(An)+
		case 0o644: // EOR.B D6,-(An)
		case 0o645: // EOR.B D6,d(An)
		case 0o646: // EOR.B D6,d(An,Xi)
			return void this.rwop8(op, this.eor8, this.d6);
		case 0o647: // EOR.B D6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.eor8, this.d6);
		case 0o650: // EOR.W D6,Dn
			return void this.rwop16(op, this.eor16, this.d6);
		case 0o651: // CMPM.W (Ay)+,(A6)+
			this.cmp16(this.rop16(op & 7 | 0o30), this.read16(this.a6));
			return void(this.a6 = this.a6 + 2 | 0);
		case 0o652: // EOR.W D6,(An)
		case 0o653: // EOR.W D6,(An)+
		case 0o654: // EOR.W D6,-(An)
		case 0o655: // EOR.W D6,d(An)
		case 0o656: // EOR.W D6,d(An,Xi)
			return void this.rwop16(op, this.eor16, this.d6);
		case 0o657: // EOR.W D6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.eor16, this.d6);
		case 0o660: // EOR.L D6,Dn
			return void this.rwop32(op, this.eor32, this.d6);
		case 0o661: // CMPM.L (Ay)+,(A6)+
			this.cmp32(this.rop32(op & 7 | 0o30), this.read32(this.a6));
			return void(this.a6 = this.a6 + 4 | 0);
		case 0o662: // EOR.L D6,(An)
		case 0o663: // EOR.L D6,(An)+
		case 0o664: // EOR.L D6,-(An)
		case 0o665: // EOR.L D6,d(An)
		case 0o666: // EOR.L D6,d(An,Xi)
			return void this.rwop32(op, this.eor32, this.d6);
		case 0o667: // EOR.L D6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.eor32, this.d6);
		case 0o670: // CMPA.L Dn,A6
		case 0o671: // CMPA.L An,A6
		case 0o672: // CMPA.L (An),A6
		case 0o673: // CMPA.L (An)+,A6
		case 0o674: // CMPA.L -(An),A6
		case 0o675: // CMPA.L d(An),A6
		case 0o676: // CMPA.L d(An,Xi),A6
			return void this.cmpa32(this.rop32(op), this.a6);
		case 0o677: // CMPA.L Abs...,A6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmpa32(this.rop32(op), this.a6);
		case 0o700: // CMP.B Dn,D7
		case 0o702: // CMP.B (An),D7
		case 0o703: // CMP.B (An)+,D7
		case 0o704: // CMP.B -(An),D7
		case 0o705: // CMP.B d(An),D7
		case 0o706: // CMP.B d(An,Xi),D7
			return void this.cmp8(this.rop8(op), this.d7);
		case 0o707: // CMP.B Abs...,D7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp8(this.rop8(op), this.d7);
		case 0o710: // CMP.W Dn,D7
		case 0o711: // CMP.W An,D7
		case 0o712: // CMP.W (An),D7
		case 0o713: // CMP.W (An)+,D7
		case 0o714: // CMP.W -(An),D7
		case 0o715: // CMP.W d(An),D7
		case 0o716: // CMP.W d(An,Xi),D7
			return void this.cmp16(this.rop16(op), this.d7);
		case 0o717: // CMP.W Abs...,D7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp16(this.rop16(op), this.d7);
		case 0o720: // CMP.L Dn,D7
		case 0o721: // CMP.L An,D7
		case 0o722: // CMP.L (An),D7
		case 0o723: // CMP.L (An)+,D7
		case 0o724: // CMP.L -(An),D7
		case 0o725: // CMP.L d(An),D7
		case 0o726: // CMP.L d(An,Xi),D7
			return void this.cmp32(this.rop32(op), this.d7);
		case 0o727: // CMP.L Abs...,D7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmp32(this.rop32(op), this.d7);
		case 0o730: // CMPA.W Dn,A7
		case 0o731: // CMPA.W An,A7
		case 0o732: // CMPA.W (An),A7
		case 0o733: // CMPA.W (An)+,A7
		case 0o734: // CMPA.W -(An),A7
		case 0o735: // CMPA.W d(An),A7
		case 0o736: // CMPA.W d(An,Xi),A7
			return void this.cmpa16(this.rop16(op), this.a7);
		case 0o737: // CMPA.W Abs...,A7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmpa16(this.rop16(op), this.a7);
		case 0o740: // EOR.B D7,Dn
			return void this.rwop8(op, this.eor8, this.d7);
		case 0o741: // CMPM.B (Ay)+,(A7)+
			this.cmp8(this.rop8(op & 7 | 0o30), this.read8(this.a7));
			return void(this.a7 = this.a7 + 1 | 0);
		case 0o742: // EOR.B D7,(An)
		case 0o743: // EOR.B D7,(An)+
		case 0o744: // EOR.B D7,-(An)
		case 0o745: // EOR.B D7,d(An)
		case 0o746: // EOR.B D7,d(An,Xi)
			return void this.rwop8(op, this.eor8, this.d7);
		case 0o747: // EOR.B D7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.eor8, this.d7);
		case 0o750: // EOR.W D7,Dn
			return void this.rwop16(op, this.eor16, this.d7);
		case 0o751: // CMPM.W (Ay)+,(A7)+
			this.cmp16(this.rop16(op & 7 | 0o30), this.read16(this.a7));
			return void(this.a7 = this.a7 + 2 | 0);
		case 0o752: // EOR.W D7,(An)
		case 0o753: // EOR.W D7,(An)+
		case 0o754: // EOR.W D7,-(An)
		case 0o755: // EOR.W D7,d(An)
		case 0o756: // EOR.W D7,d(An,Xi)
			return void this.rwop16(op, this.eor16, this.d7);
		case 0o757: // EOR.W D7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.eor16, this.d7);
		case 0o760: // EOR.L D7,Dn
			return void this.rwop32(op, this.eor32, this.d7);
		case 0o761: // CMPM.L (Ay)+,(A7)+
			this.cmp32(this.rop32(op & 7 | 0o30), this.read32(this.a7));
			return void(this.a7 = this.a7 + 4 | 0);
		case 0o762: // EOR.L D7,(An)
		case 0o763: // EOR.L D7,(An)+
		case 0o764: // EOR.L D7,-(An)
		case 0o765: // EOR.L D7,d(An)
		case 0o766: // EOR.L D7,d(An,Xi)
			return void this.rwop32(op, this.eor32, this.d7);
		case 0o767: // EOR.L D7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.eor32, this.d7);
		case 0o770: // CMPA.L Dn,A7
		case 0o771: // CMPA.L An,A7
		case 0o772: // CMPA.L (An),A7
		case 0o773: // CMPA.L (An)+,A7
		case 0o774: // CMPA.L -(An),A7
		case 0o775: // CMPA.L d(An),A7
		case 0o776: // CMPA.L d(An,Xi),A7
			return void this.cmpa32(this.rop32(op), this.a7);
		case 0o777: // CMPA.L Abs...,A7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void this.cmpa32(this.rop32(op), this.a7);
		default:
			return void this.exception(4);
		}
	}

	execute_c(op) {
		switch (op >>> 3 & 0o777) {
		case 0o000: // AND.B Dn,D0
		case 0o002: // AND.B (An),D0
		case 0o003: // AND.B (An)+,D0
		case 0o004: // AND.B -(An),D0
		case 0o005: // AND.B d(An),D0
		case 0o006: // AND.B d(An,Xi),D0
			return void(this.d0 = this.d0 & ~0xff | this.and8(this.rop8(op), this.d0));
		case 0o007: // AND.B Abs...,D0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d0 = this.d0 & ~0xff | this.and8(this.rop8(op), this.d0));
		case 0o010: // AND.W Dn,D0
		case 0o012: // AND.W (An),D0
		case 0o013: // AND.W (An)+,D0
		case 0o014: // AND.W -(An),D0
		case 0o015: // AND.W d(An),D0
		case 0o016: // AND.W d(An,Xi),D0
			return void(this.d0 = this.d0 & ~0xffff | this.and16(this.rop16(op), this.d0));
		case 0o017: // AND.W Abs...,D0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d0 = this.d0 & ~0xffff | this.and16(this.rop16(op), this.d0));
		case 0o020: // AND.L Dn,D0
		case 0o022: // AND.L (An),D0
		case 0o023: // AND.L (An)+,D0
		case 0o024: // AND.L -(An),D0
		case 0o025: // AND.L d(An),D0
		case 0o026: // AND.L d(An,Xi),D0
			return void(this.d0 = this.and32(this.rop32(op), this.d0));
		case 0o027: // AND.L Abs...,D0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d0 = this.and32(this.rop32(op), this.d0));
		case 0o030: // MULU Dn,D0
		case 0o032: // MULU (An),D0
		case 0o033: // MULU (An)+,D0
		case 0o034: // MULU -(An),D0
		case 0o035: // MULU d(An),D0
		case 0o036: // MULU d(An,Xi),D0
			return void(this.d0 = this.mulu(this.rop16(op), this.d0 & 0xffff));
		case 0o037: // MULU Abs...,D0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d0 = this.mulu(this.rop16(op), this.d0 & 0xffff));
		case 0o040: // ABCD Dy,D0
			return void(this.d0 = this.d0 & ~0xff | this.abcd(this.rop8(op), this.d0));
		case 0o041: // ABCD -(Ay),-(A0)
			return void this.write8(this.abcd(this.rop8(op & 7 | 0o40), this.read8(this.a0 = this.a0 - 1 | 0)), this.a0);
		case 0o042: // AND.B D0,(An)
		case 0o043: // AND.B D0,(An)+
		case 0o044: // AND.B D0,-(An)
		case 0o045: // AND.B D0,d(An)
		case 0o046: // AND.B D0,d(An,Xi)
			return void this.rwop8(op, this.and8, this.d0);
		case 0o047: // AND.B D0,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.and8, this.d0);
		case 0o050: // EXG D0,Dy
			return void(this.d0 = this.exg(op, this.d0));
		case 0o051: // EXG A0,Ay
			return void(this.a0 = this.exg(op, this.a0));
		case 0o052: // AND.W D0,(An)
		case 0o053: // AND.W D0,(An)+
		case 0o054: // AND.W D0,-(An)
		case 0o055: // AND.W D0,d(An)
		case 0o056: // AND.W D0,d(An,Xi)
			return void this.rwop16(op, this.and16, this.d0);
		case 0o057: // AND.W D0,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.and16, this.d0);
		case 0o061: // EXG D0,Ay
			return void(this.d0 = this.exg(op, this.d0));
		case 0o062: // AND.L D0,(An)
		case 0o063: // AND.L D0,(An)+
		case 0o064: // AND.L D0,-(An)
		case 0o065: // AND.L D0,d(An)
		case 0o066: // AND.L D0,d(An,Xi)
			return void this.rwop32(op, this.and32, this.d0);
		case 0o067: // AND.L D0,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.and32, this.d0);
		case 0o070: // MULS Dn,D0
		case 0o072: // MULS (An),D0
		case 0o073: // MULS (An)+,D0
		case 0o074: // MULS -(An),D0
		case 0o075: // MULS d(An),D0
		case 0o076: // MULS d(An,Xi),D0
			return void(this.d0 = this.muls(this.rop16(op), this.d0 & 0xffff));
		case 0o077: // MULS Abs...,D0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d0 = this.muls(this.rop16(op), this.d0 & 0xffff));
		case 0o100: // AND.B Dn,D1
		case 0o102: // AND.B (An),D1
		case 0o103: // AND.B (An)+,D1
		case 0o104: // AND.B -(An),D1
		case 0o105: // AND.B d(An),D1
		case 0o106: // AND.B d(An,Xi),D1
			return void(this.d1 = this.d1 & ~0xff | this.and8(this.rop8(op), this.d1));
		case 0o107: // AND.B Abs...,D1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d1 = this.d1 & ~0xff | this.and8(this.rop8(op), this.d1));
		case 0o110: // AND.W Dn,D1
		case 0o112: // AND.W (An),D1
		case 0o113: // AND.W (An)+,D1
		case 0o114: // AND.W -(An),D1
		case 0o115: // AND.W d(An),D1
		case 0o116: // AND.W d(An,Xi),D1
			return void(this.d1 = this.d1 & ~0xffff | this.and16(this.rop16(op), this.d1));
		case 0o117: // AND.W Abs...,D1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d1 = this.d1 & ~0xffff | this.and16(this.rop16(op), this.d1));
		case 0o120: // AND.L Dn,D1
		case 0o122: // AND.L (An),D1
		case 0o123: // AND.L (An)+,D1
		case 0o124: // AND.L -(An),D1
		case 0o125: // AND.L d(An),D1
		case 0o126: // AND.L d(An,Xi),D1
			return void(this.d1 = this.and32(this.rop32(op), this.d1));
		case 0o127: // AND.L Abs...,D1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d1 = this.and32(this.rop32(op), this.d1));
		case 0o130: // MULU Dn,D1
		case 0o132: // MULU (An),D1
		case 0o133: // MULU (An)+,D1
		case 0o134: // MULU -(An),D1
		case 0o135: // MULU d(An),D1
		case 0o136: // MULU d(An,Xi),D1
			return void(this.d1 = this.mulu(this.rop16(op), this.d1 & 0xffff));
		case 0o137: // MULU Abs...,D1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d1 = this.mulu(this.rop16(op), this.d1 & 0xffff));
		case 0o140: // ABCD Dy,D1
			return void(this.d1 = this.d1 & ~0xff | this.abcd(this.rop8(op), this.d1));
		case 0o141: // ABCD -(Ay),-(A1)
			return void this.write8(this.abcd(this.rop8(op & 7 | 0o40), this.read8(this.a1 = this.a1 - 1 | 0)), this.a1);
		case 0o142: // AND.B D1,(An)
		case 0o143: // AND.B D1,(An)+
		case 0o144: // AND.B D1,-(An)
		case 0o145: // AND.B D1,d(An)
		case 0o146: // AND.B D1,d(An,Xi)
			return void this.rwop8(op, this.and8, this.d1);
		case 0o147: // AND.B D1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.and8, this.d1);
		case 0o150: // EXG D1,Dy
			return void(this.d1 = this.exg(op, this.d1));
		case 0o151: // EXG A1,Ay
			return void(this.a1 = this.exg(op, this.a1));
		case 0o152: // AND.W D1,(An)
		case 0o153: // AND.W D1,(An)+
		case 0o154: // AND.W D1,-(An)
		case 0o155: // AND.W D1,d(An)
		case 0o156: // AND.W D1,d(An,Xi)
			return void this.rwop16(op, this.and16, this.d1);
		case 0o157: // AND.W D1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.and16, this.d1);
		case 0o161: // EXG D1,Ay
			return void(this.d1 = this.exg(op, this.d1));
		case 0o162: // AND.L D1,(An)
		case 0o163: // AND.L D1,(An)+
		case 0o164: // AND.L D1,-(An)
		case 0o165: // AND.L D1,d(An)
		case 0o166: // AND.L D1,d(An,Xi)
			return void this.rwop32(op, this.and32, this.d1);
		case 0o167: // AND.L D1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.and32, this.d1);
		case 0o170: // MULS Dn,D1
		case 0o172: // MULS (An),D1
		case 0o173: // MULS (An)+,D1
		case 0o174: // MULS -(An),D1
		case 0o175: // MULS d(An),D1
		case 0o176: // MULS d(An,Xi),D1
			return void(this.d1 = this.muls(this.rop16(op), this.d1 & 0xffff));
		case 0o177: // MULS Abs...,D1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d1 = this.muls(this.rop16(op), this.d1 & 0xffff));
		case 0o200: // AND.B Dn,D2
		case 0o202: // AND.B (An),D2
		case 0o203: // AND.B (An)+,D2
		case 0o204: // AND.B -(An),D2
		case 0o205: // AND.B d(An),D2
		case 0o206: // AND.B d(An,Xi),D2
			return void(this.d2 = this.d2 & ~0xff | this.and8(this.rop8(op), this.d2));
		case 0o207: // AND.B Abs...,D2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d2 = this.d2 & ~0xff | this.and8(this.rop8(op), this.d2));
		case 0o210: // AND.W Dn,D2
		case 0o212: // AND.W (An),D2
		case 0o213: // AND.W (An)+,D2
		case 0o214: // AND.W -(An),D2
		case 0o215: // AND.W d(An),D2
		case 0o216: // AND.W d(An,Xi),D2
			return void(this.d2 = this.d2 & ~0xffff | this.and16(this.rop16(op), this.d2));
		case 0o217: // AND.W Abs...,D2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d2 = this.d2 & ~0xffff | this.and16(this.rop16(op), this.d2));
		case 0o220: // AND.L Dn,D2
		case 0o222: // AND.L (An),D2
		case 0o223: // AND.L (An)+,D2
		case 0o224: // AND.L -(An),D2
		case 0o225: // AND.L d(An),D2
		case 0o226: // AND.L d(An,Xi),D2
			return void(this.d2 = this.and32(this.rop32(op), this.d2));
		case 0o227: // AND.L Abs...,D2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d2 = this.and32(this.rop32(op), this.d2));
		case 0o230: // MULU Dn,D2
		case 0o232: // MULU (An),D2
		case 0o233: // MULU (An)+,D2
		case 0o234: // MULU -(An),D2
		case 0o235: // MULU d(An),D2
		case 0o236: // MULU d(An,Xi),D2
			return void(this.d2 = this.mulu(this.rop16(op), this.d2 & 0xffff));
		case 0o237: // MULU Abs...,D2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d2 = this.mulu(this.rop16(op), this.d2 & 0xffff));
		case 0o240: // ABCD Dy,D2
			return void(this.d2 = this.d2 & ~0xff | this.abcd(this.rop8(op), this.d2));
		case 0o241: // ABCD -(Ay),-(A2)
			return void this.write8(this.abcd(this.rop8(op & 7 | 0o40), this.read8(this.a2 = this.a2 - 1 | 0)), this.a2);
		case 0o242: // AND.B D2,(An)
		case 0o243: // AND.B D2,(An)+
		case 0o244: // AND.B D2,-(An)
		case 0o245: // AND.B D2,d(An)
		case 0o246: // AND.B D2,d(An,Xi)
			return void this.rwop8(op, this.and8, this.d2);
		case 0o247: // AND.B D2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.and8, this.d2);
		case 0o250: // EXG D2,Dy
			return void(this.d2 = this.exg(op, this.d2));
		case 0o251: // EXG A2,Ay
			return void(this.a2 = this.exg(op, this.a2));
		case 0o252: // AND.W D2,(An)
		case 0o253: // AND.W D2,(An)+
		case 0o254: // AND.W D2,-(An)
		case 0o255: // AND.W D2,d(An)
		case 0o256: // AND.W D2,d(An,Xi)
			return void this.rwop16(op, this.and16, this.d2);
		case 0o257: // AND.W D2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.and16, this.d2);
		case 0o261: // EXG D2,Ay
			return void(this.d2 = this.exg(op, this.d2));
		case 0o262: // AND.L D2,(An)
		case 0o263: // AND.L D2,(An)+
		case 0o264: // AND.L D2,-(An)
		case 0o265: // AND.L D2,d(An)
		case 0o266: // AND.L D2,d(An,Xi)
			return void this.rwop32(op, this.and32, this.d2);
		case 0o267: // AND.L D2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.and32, this.d2);
		case 0o270: // MULS Dn,D2
		case 0o272: // MULS (An),D2
		case 0o273: // MULS (An)+,D2
		case 0o274: // MULS -(An),D2
		case 0o275: // MULS d(An),D2
		case 0o276: // MULS d(An,Xi),D2
			return void(this.d2 = this.muls(this.rop16(op), this.d2 & 0xffff));
		case 0o277: // MULS Abs...,D2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d2 = this.muls(this.rop16(op), this.d2 & 0xffff));
		case 0o300: // AND.B Dn,D3
		case 0o302: // AND.B (An),D3
		case 0o303: // AND.B (An)+,D3
		case 0o304: // AND.B -(An),D3
		case 0o305: // AND.B d(An),D3
		case 0o306: // AND.B d(An,Xi),D3
			return void(this.d3 = this.d3 & ~0xff | this.and8(this.rop8(op), this.d3));
		case 0o307: // AND.B Abs...,D3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d3 = this.d3 & ~0xff | this.and8(this.rop8(op), this.d3));
		case 0o310: // AND.W Dn,D3
		case 0o312: // AND.W (An),D3
		case 0o313: // AND.W (An)+,D3
		case 0o314: // AND.W -(An),D3
		case 0o315: // AND.W d(An),D3
		case 0o316: // AND.W d(An,Xi),D3
			return void(this.d3 = this.d3 & ~0xffff | this.and16(this.rop16(op), this.d3));
		case 0o317: // AND.W Abs...,D3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d3 = this.d3 & ~0xffff | this.and16(this.rop16(op), this.d3));
		case 0o320: // AND.L Dn,D3
		case 0o322: // AND.L (An),D3
		case 0o323: // AND.L (An)+,D3
		case 0o324: // AND.L -(An),D3
		case 0o325: // AND.L d(An),D3
		case 0o326: // AND.L d(An,Xi),D3
			return void(this.d3 = this.and32(this.rop32(op), this.d3));
		case 0o327: // AND.L Abs...,D3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d3 = this.and32(this.rop32(op), this.d3));
		case 0o330: // MULU Dn,D3
		case 0o332: // MULU (An),D3
		case 0o333: // MULU (An)+,D3
		case 0o334: // MULU -(An),D3
		case 0o335: // MULU d(An),D3
		case 0o336: // MULU d(An,Xi),D3
			return void(this.d3 = this.mulu(this.rop16(op), this.d3 & 0xffff));
		case 0o337: // MULU Abs...,D3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d3 = this.mulu(this.rop16(op), this.d3 & 0xffff));
		case 0o340: // ABCD Dy,D3
			return void(this.d3 = this.d3 & ~0xff | this.abcd(this.rop8(op), this.d3));
		case 0o341: // ABCD -(Ay),-(A3)
			return void this.write8(this.abcd(this.rop8(op & 7 | 0o40), this.read8(this.a3 = this.a3 - 1 | 0)), this.a3);
		case 0o342: // AND.B D3,(An)
		case 0o343: // AND.B D3,(An)+
		case 0o344: // AND.B D3,-(An)
		case 0o345: // AND.B D3,d(An)
		case 0o346: // AND.B D3,d(An,Xi)
			return void this.rwop8(op, this.and8, this.d3);
		case 0o347: // AND.B D3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.and8, this.d3);
		case 0o350: // EXG D3,Dy
			return void(this.d3 = this.exg(op, this.d3));
		case 0o351: // EXG A3,Ay
			return void(this.a3 = this.exg(op, this.a3));
		case 0o352: // AND.W D3,(An)
		case 0o353: // AND.W D3,(An)+
		case 0o354: // AND.W D3,-(An)
		case 0o355: // AND.W D3,d(An)
		case 0o356: // AND.W D3,d(An,Xi)
			return void this.rwop16(op, this.and16, this.d3);
		case 0o357: // AND.W D3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.and16, this.d3);
		case 0o361: // EXG D3,Ay
			return void(this.d3 = this.exg(op, this.d3));
		case 0o362: // AND.L D3,(An)
		case 0o363: // AND.L D3,(An)+
		case 0o364: // AND.L D3,-(An)
		case 0o365: // AND.L D3,d(An)
		case 0o366: // AND.L D3,d(An,Xi)
			return void this.rwop32(op, this.and32, this.d3);
		case 0o367: // AND.L D3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.and32, this.d3);
		case 0o370: // MULS Dn,D3
		case 0o372: // MULS (An),D3
		case 0o373: // MULS (An)+,D3
		case 0o374: // MULS -(An),D3
		case 0o375: // MULS d(An),D3
		case 0o376: // MULS d(An,Xi),D3
			return void(this.d3 = this.muls(this.rop16(op), this.d3 & 0xffff));
		case 0o377: // MULS Abs...,D3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d3 = this.muls(this.rop16(op), this.d3 & 0xffff));
		case 0o400: // AND.B Dn,D4
		case 0o402: // AND.B (An),D4
		case 0o403: // AND.B (An)+,D4
		case 0o404: // AND.B -(An),D4
		case 0o405: // AND.B d(An),D4
		case 0o406: // AND.B d(An,Xi),D4
			return void(this.d4 = this.d4 & ~0xff | this.and8(this.rop8(op), this.d4));
		case 0o407: // AND.B Abs...,D4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d4 = this.d4 & ~0xff | this.and8(this.rop8(op), this.d4));
		case 0o410: // AND.W Dn,D4
		case 0o412: // AND.W (An),D4
		case 0o413: // AND.W (An)+,D4
		case 0o414: // AND.W -(An),D4
		case 0o415: // AND.W d(An),D4
		case 0o416: // AND.W d(An,Xi),D4
			return void(this.d4 = this.d4 & ~0xffff | this.and16(this.rop16(op), this.d4));
		case 0o417: // AND.W Abs...,D4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d4 = this.d4 & ~0xffff | this.and16(this.rop16(op), this.d4));
		case 0o420: // AND.L Dn,D4
		case 0o422: // AND.L (An),D4
		case 0o423: // AND.L (An)+,D4
		case 0o424: // AND.L -(An),D4
		case 0o425: // AND.L d(An),D4
		case 0o426: // AND.L d(An,Xi),D4
			return void(this.d4 = this.and32(this.rop32(op), this.d4));
		case 0o427: // AND.L Abs...,D4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d4 = this.and32(this.rop32(op), this.d4));
		case 0o430: // MULU Dn,D4
		case 0o432: // MULU (An),D4
		case 0o433: // MULU (An)+,D4
		case 0o434: // MULU -(An),D4
		case 0o435: // MULU d(An),D4
		case 0o436: // MULU d(An,Xi),D4
			return void(this.d4 = this.mulu(this.rop16(op), this.d4 & 0xffff));
		case 0o437: // MULU Abs...,D4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d4 = this.mulu(this.rop16(op), this.d4 & 0xffff));
		case 0o440: // ABCD Dy,D4
			return void(this.d4 = this.d4 & ~0xff | this.abcd(this.rop8(op), this.d4));
		case 0o441: // ABCD -(Ay),-(A4)
			return void this.write8(this.abcd(this.rop8(op & 7 | 0o40), this.read8(this.a4 = this.a4 - 1 | 0)), this.a4);
		case 0o442: // AND.B D4,(An)
		case 0o443: // AND.B D4,(An)+
		case 0o444: // AND.B D4,-(An)
		case 0o445: // AND.B D4,d(An)
		case 0o446: // AND.B D4,d(An,Xi)
			return void this.rwop8(op, this.and8, this.d4);
		case 0o447: // AND.B D4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.and8, this.d4);
		case 0o450: // EXG D4,Dy
			return void(this.d4 = this.exg(op, this.d4));
		case 0o451: // EXG A4,Ay
			return void(this.a4 = this.exg(op, this.a4));
		case 0o452: // AND.W D4,(An)
		case 0o453: // AND.W D4,(An)+
		case 0o454: // AND.W D4,-(An)
		case 0o455: // AND.W D4,d(An)
		case 0o456: // AND.W D4,d(An,Xi)
			return void this.rwop16(op, this.and16, this.d4);
		case 0o457: // AND.W D4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.and16, this.d4);
		case 0o461: // EXG D4,Ay
			return void(this.d4 = this.exg(op, this.d4));
		case 0o462: // AND.L D4,(An)
		case 0o463: // AND.L D4,(An)+
		case 0o464: // AND.L D4,-(An)
		case 0o465: // AND.L D4,d(An)
		case 0o466: // AND.L D4,d(An,Xi)
			return void this.rwop32(op, this.and32, this.d4);
		case 0o467: // AND.L D4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.and32, this.d4);
		case 0o470: // MULS Dn,D4
		case 0o472: // MULS (An),D4
		case 0o473: // MULS (An)+,D4
		case 0o474: // MULS -(An),D4
		case 0o475: // MULS d(An),D4
		case 0o476: // MULS d(An,Xi),D4
			return void(this.d4 = this.muls(this.rop16(op), this.d4 & 0xffff));
		case 0o477: // MULS Abs...,D4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d4 = this.muls(this.rop16(op), this.d4 & 0xffff));
		case 0o500: // AND.B Dn,D5
		case 0o502: // AND.B (An),D5
		case 0o503: // AND.B (An)+,D5
		case 0o504: // AND.B -(An),D5
		case 0o505: // AND.B d(An),D5
		case 0o506: // AND.B d(An,Xi),D5
			return void(this.d5 = this.d5 & ~0xff | this.and8(this.rop8(op), this.d5));
		case 0o507: // AND.B Abs...,D5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d5 = this.d5 & ~0xff | this.and8(this.rop8(op), this.d5));
		case 0o510: // AND.W Dn,D5
		case 0o512: // AND.W (An),D5
		case 0o513: // AND.W (An)+,D5
		case 0o514: // AND.W -(An),D5
		case 0o515: // AND.W d(An),D5
		case 0o516: // AND.W d(An,Xi),D5
			return void(this.d5 = this.d5 & ~0xffff | this.and16(this.rop16(op), this.d5));
		case 0o517: // AND.W Abs...,D5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d5 = this.d5 & ~0xffff | this.and16(this.rop16(op), this.d5));
		case 0o520: // AND.L Dn,D5
		case 0o522: // AND.L (An),D5
		case 0o523: // AND.L (An)+,D5
		case 0o524: // AND.L -(An),D5
		case 0o525: // AND.L d(An),D5
		case 0o526: // AND.L d(An,Xi),D5
			return void(this.d5 = this.and32(this.rop32(op), this.d5));
		case 0o527: // AND.L Abs...,D5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d5 = this.and32(this.rop32(op), this.d5));
		case 0o530: // MULU Dn,D5
		case 0o532: // MULU (An),D5
		case 0o533: // MULU (An)+,D5
		case 0o534: // MULU -(An),D5
		case 0o535: // MULU d(An),D5
		case 0o536: // MULU d(An,Xi),D5
			return void(this.d5 = this.mulu(this.rop16(op), this.d5 & 0xffff));
		case 0o537: // MULU Abs...,D5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d5 = this.mulu(this.rop16(op), this.d5 & 0xffff));
		case 0o540: // ABCD Dy,D5
			return void(this.d5 = this.d5 & ~0xff | this.abcd(this.rop8(op), this.d5));
		case 0o541: // ABCD -(Ay),-(A5)
			return void this.write8(this.abcd(this.rop8(op & 7 | 0o40), this.read8(this.a5 = this.a5 - 1 | 0)), this.a5);
		case 0o542: // AND.B D5,(An)
		case 0o543: // AND.B D5,(An)+
		case 0o544: // AND.B D5,-(An)
		case 0o545: // AND.B D5,d(An)
		case 0o546: // AND.B D5,d(An,Xi)
			return void this.rwop8(op, this.and8, this.d5);
		case 0o547: // AND.B D5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.and8, this.d5);
		case 0o550: // EXG D5,Dy
			return void(this.d5 = this.exg(op, this.d5));
		case 0o551: // EXG A5,Ay
			return void(this.a5 = this.exg(op, this.a5));
		case 0o552: // AND.W D5,(An)
		case 0o553: // AND.W D5,(An)+
		case 0o554: // AND.W D5,-(An)
		case 0o555: // AND.W D5,d(An)
		case 0o556: // AND.W D5,d(An,Xi)
			return void this.rwop16(op, this.and16, this.d5);
		case 0o557: // AND.W D5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.and16, this.d5);
		case 0o561: // EXG D5,Ay
			return void(this.d5 = this.exg(op, this.d5));
		case 0o562: // AND.L D5,(An)
		case 0o563: // AND.L D5,(An)+
		case 0o564: // AND.L D5,-(An)
		case 0o565: // AND.L D5,d(An)
		case 0o566: // AND.L D5,d(An,Xi)
			return void this.rwop32(op, this.and32, this.d5);
		case 0o567: // AND.L D5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.and32, this.d5);
		case 0o570: // MULS Dn,D5
		case 0o572: // MULS (An),D5
		case 0o573: // MULS (An)+,D5
		case 0o574: // MULS -(An),D5
		case 0o575: // MULS d(An),D5
		case 0o576: // MULS d(An,Xi),D5
			return void(this.d5 = this.muls(this.rop16(op), this.d5 & 0xffff));
		case 0o577: // MULS Abs...,D5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d5 = this.muls(this.rop16(op), this.d5 & 0xffff));
		case 0o600: // AND.B Dn,D6
		case 0o602: // AND.B (An),D6
		case 0o603: // AND.B (An)+,D6
		case 0o604: // AND.B -(An),D6
		case 0o605: // AND.B d(An),D6
		case 0o606: // AND.B d(An,Xi),D6
			return void(this.d6 = this.d6 & ~0xff | this.and8(this.rop8(op), this.d6));
		case 0o607: // AND.B Abs...,D6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d6 = this.d6 & ~0xff | this.and8(this.rop8(op), this.d6));
		case 0o610: // AND.W Dn,D6
		case 0o612: // AND.W (An),D6
		case 0o613: // AND.W (An)+,D6
		case 0o614: // AND.W -(An),D6
		case 0o615: // AND.W d(An),D6
		case 0o616: // AND.W d(An,Xi),D6
			return void(this.d6 = this.d6 & ~0xffff | this.and16(this.rop16(op), this.d6));
		case 0o617: // AND.W Abs...,D6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d6 = this.d6 & ~0xffff | this.and16(this.rop16(op), this.d6));
		case 0o620: // AND.L Dn,D6
		case 0o622: // AND.L (An),D6
		case 0o623: // AND.L (An)+,D6
		case 0o624: // AND.L -(An),D6
		case 0o625: // AND.L d(An),D6
		case 0o626: // AND.L d(An,Xi),D6
			return void(this.d6 = this.and32(this.rop32(op), this.d6));
		case 0o627: // AND.L Abs...,D6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d6 = this.and32(this.rop32(op), this.d6));
		case 0o630: // MULU Dn,D6
		case 0o632: // MULU (An),D6
		case 0o633: // MULU (An)+,D6
		case 0o634: // MULU -(An),D6
		case 0o635: // MULU d(An),D6
		case 0o636: // MULU d(An,Xi),D6
			return void(this.d6 = this.mulu(this.rop16(op), this.d6 & 0xffff));
		case 0o637: // MULU Abs...,D6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d6 = this.mulu(this.rop16(op), this.d6 & 0xffff));
		case 0o640: // ABCD Dy,D6
			return void(this.d6 = this.d6 & ~0xff | this.abcd(this.rop8(op), this.d6));
		case 0o641: // ABCD -(Ay),-(A6)
			return void this.write8(this.abcd(this.rop8(op & 7 | 0o40), this.read8(this.a6 = this.a6 - 1 | 0)), this.a6);
		case 0o642: // AND.B D6,(An)
		case 0o643: // AND.B D6,(An)+
		case 0o644: // AND.B D6,-(An)
		case 0o645: // AND.B D6,d(An)
		case 0o646: // AND.B D6,d(An,Xi)
			return void this.rwop8(op, this.and8, this.d6);
		case 0o647: // AND.B D6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.and8, this.d6);
		case 0o650: // EXG D6,Dy
			return void(this.d6 = this.exg(op, this.d6));
		case 0o651: // EXG A6,Ay
			return void(this.a6 = this.exg(op, this.a6));
		case 0o652: // AND.W D6,(An)
		case 0o653: // AND.W D6,(An)+
		case 0o654: // AND.W D6,-(An)
		case 0o655: // AND.W D6,d(An)
		case 0o656: // AND.W D6,d(An,Xi)
			return void this.rwop16(op, this.and16, this.d6);
		case 0o657: // AND.W D6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.and16, this.d6);
		case 0o661: // EXG D6,Ay
			return void(this.d6 = this.exg(op, this.d6));
		case 0o662: // AND.L D6,(An)
		case 0o663: // AND.L D6,(An)+
		case 0o664: // AND.L D6,-(An)
		case 0o665: // AND.L D6,d(An)
		case 0o666: // AND.L D6,d(An,Xi)
			return void this.rwop32(op, this.and32, this.d6);
		case 0o667: // AND.L D6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.and32, this.d6);
		case 0o670: // MULS Dn,D6
		case 0o672: // MULS (An),D6
		case 0o673: // MULS (An)+,D6
		case 0o674: // MULS -(An),D6
		case 0o675: // MULS d(An),D6
		case 0o676: // MULS d(An,Xi),D6
			return void(this.d6 = this.muls(this.rop16(op), this.d6 & 0xffff));
		case 0o677: // MULS Abs...,D6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d6 = this.muls(this.rop16(op), this.d6 & 0xffff));
		case 0o700: // AND.B Dn,D7
		case 0o702: // AND.B (An),D7
		case 0o703: // AND.B (An)+,D7
		case 0o704: // AND.B -(An),D7
		case 0o705: // AND.B d(An),D7
		case 0o706: // AND.B d(An,Xi),D7
			return void(this.d7 = this.d7 & ~0xff | this.and8(this.rop8(op), this.d7));
		case 0o707: // AND.B Abs...,D7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d7 = this.d7 & ~0xff | this.and8(this.rop8(op), this.d7));
		case 0o710: // AND.W Dn,D7
		case 0o712: // AND.W (An),D7
		case 0o713: // AND.W (An)+,D7
		case 0o714: // AND.W -(An),D7
		case 0o715: // AND.W d(An),D7
		case 0o716: // AND.W d(An,Xi),D7
			return void(this.d7 = this.d7 & ~0xffff | this.and16(this.rop16(op), this.d7));
		case 0o717: // AND.W Abs...,D7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d7 = this.d7 & ~0xffff | this.and16(this.rop16(op), this.d7));
		case 0o720: // AND.L Dn,D7
		case 0o722: // AND.L (An),D7
		case 0o723: // AND.L (An)+,D7
		case 0o724: // AND.L -(An),D7
		case 0o725: // AND.L d(An),D7
		case 0o726: // AND.L d(An,Xi),D7
			return void(this.d7 = this.and32(this.rop32(op), this.d7));
		case 0o727: // AND.L Abs...,D7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d7 = this.and32(this.rop32(op), this.d7));
		case 0o730: // MULU Dn,D7
		case 0o732: // MULU (An),D7
		case 0o733: // MULU (An)+,D7
		case 0o734: // MULU -(An),D7
		case 0o735: // MULU d(An),D7
		case 0o736: // MULU d(An,Xi),D7
			return void(this.d7 = this.mulu(this.rop16(op), this.d7 & 0xffff));
		case 0o737: // MULU Abs...,D7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d7 = this.mulu(this.rop16(op), this.d7 & 0xffff));
		case 0o740: // ABCD Dy,D7
			return void(this.d7 = this.d7 & ~0xff | this.abcd(this.rop8(op), this.d7));
		case 0o741: // ABCD -(Ay),-(A7)
			return void this.write8(this.abcd(this.rop8(op & 7 | 0o40), this.read8(this.a7 = this.a7 - 1 | 0)), this.a7);
		case 0o742: // AND.B D7,(An)
		case 0o743: // AND.B D7,(An)+
		case 0o744: // AND.B D7,-(An)
		case 0o745: // AND.B D7,d(An)
		case 0o746: // AND.B D7,d(An,Xi)
			return void this.rwop8(op, this.and8, this.d7);
		case 0o747: // AND.B D7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.and8, this.d7);
		case 0o750: // EXG D7,Dy
			return void(this.d7 = this.exg(op, this.d7));
		case 0o751: // EXG A7,Ay
			return void(this.a7 = this.exg(op, this.a7));
		case 0o752: // AND.W D7,(An)
		case 0o753: // AND.W D7,(An)+
		case 0o754: // AND.W D7,-(An)
		case 0o755: // AND.W D7,d(An)
		case 0o756: // AND.W D7,d(An,Xi)
			return void this.rwop16(op, this.and16, this.d7);
		case 0o757: // AND.W D7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.and16, this.d7);
		case 0o761: // EXG D7,Ay
			return void(this.d7 = this.exg(op, this.d7));
		case 0o762: // AND.L D7,(An)
		case 0o763: // AND.L D7,(An)+
		case 0o764: // AND.L D7,-(An)
		case 0o765: // AND.L D7,d(An)
		case 0o766: // AND.L D7,d(An,Xi)
			return void this.rwop32(op, this.and32, this.d7);
		case 0o767: // AND.L D7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.and32, this.d7);
		case 0o770: // MULS Dn,D7
		case 0o772: // MULS (An),D7
		case 0o773: // MULS (An)+,D7
		case 0o774: // MULS -(An),D7
		case 0o775: // MULS d(An),D7
		case 0o776: // MULS d(An,Xi),D7
			return void(this.d7 = this.muls(this.rop16(op), this.d7 & 0xffff));
		case 0o777: // MULS Abs...,D7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d7 = this.muls(this.rop16(op), this.d7 & 0xffff));
		default:
			return void this.exception(4);
		}
	}

	execute_d(op) {
		let data;

		switch (op >>> 3 & 0o777) {
		case 0o000: // ADD.B Dn,D0
		case 0o002: // ADD.B (An),D0
		case 0o003: // ADD.B (An)+,D0
		case 0o004: // ADD.B -(An),D0
		case 0o005: // ADD.B d(An),D0
		case 0o006: // ADD.B d(An,Xi),D0
			return void(this.d0 = this.d0 & ~0xff | this.add8(this.rop8(op), this.d0));
		case 0o007: // ADD.B Abs...,D0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d0 = this.d0 & ~0xff | this.add8(this.rop8(op), this.d0));
		case 0o010: // ADD.W Dn,D0
		case 0o011: // ADD.W An,D0
		case 0o012: // ADD.W (An),D0
		case 0o013: // ADD.W (An)+,D0
		case 0o014: // ADD.W -(An),D0
		case 0o015: // ADD.W d(An),D0
		case 0o016: // ADD.W d(An,Xi),D0
			return void(this.d0 = this.d0 & ~0xffff | this.add16(this.rop16(op), this.d0));
		case 0o017: // ADD.W Abs...,D0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d0 = this.d0 & ~0xffff | this.add16(this.rop16(op), this.d0));
		case 0o020: // ADD.L Dn,D0
		case 0o021: // ADD.L An,D0
		case 0o022: // ADD.L (An),D0
		case 0o023: // ADD.L (An)+,D0
		case 0o024: // ADD.L -(An),D0
		case 0o025: // ADD.L d(An),D0
		case 0o026: // ADD.L d(An,Xi),D0
			return void(this.d0 = this.add32(this.rop32(op), this.d0));
		case 0o027: // ADD.L Abs...,D0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d0 = this.add32(this.rop32(op), this.d0));
		case 0o030: // ADDA.W Dn,A0
		case 0o031: // ADDA.W An,A0
		case 0o032: // ADDA.W (An),A0
		case 0o033: // ADDA.W (An)+,A0
		case 0o034: // ADDA.W -(An),A0
		case 0o035: // ADDA.W d(An),A0
		case 0o036: // ADDA.W d(An,Xi),A0
			return void(this.a0 = this.a0 + (data = this.rop16(op)) - (data << 1 & 0x10000) | 0);
		case 0o037: // ADDA.W Abs...,A0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a0 = this.a0 + (data = this.rop16(op)) - (data << 1 & 0x10000) | 0);
		case 0o040: // ADDX.B Dy,D0
			return void(this.d0 = this.d0 & ~0xff | this.addx8(this.rop8(op), this.d0));
		case 0o041: // ADDX.B -(Ay),-(A0)
			return void this.write8(this.addx8(this.rop8(op & 7 | 0o40), this.read8(this.a0 = this.a0 - 1 | 0)), this.a0);
		case 0o042: // ADD.B D0,(An)
		case 0o043: // ADD.B D0,(An)+
		case 0o044: // ADD.B D0,-(An)
		case 0o045: // ADD.B D0,d(An)
		case 0o046: // ADD.B D0,d(An,Xi)
			return void this.rwop8(op, this.add8, this.d0);
		case 0o047: // ADD.B D0,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.add8, this.d0);
		case 0o050: // ADDX.W Dy,D0
			return void(this.d0 = this.d0 & ~0xffff | this.addx16(this.rop16(op), this.d0));
		case 0o051: // ADDX.W -(Ay),-(A0)
			return void this.write16(this.addx16(this.rop16(op & 7 | 0o40), this.read16(this.a0 = this.a0 - 2 | 0)), this.a0);
		case 0o052: // ADD.W D0,(An)
		case 0o053: // ADD.W D0,(An)+
		case 0o054: // ADD.W D0,-(An)
		case 0o055: // ADD.W D0,d(An)
		case 0o056: // ADD.W D0,d(An,Xi)
			return void this.rwop16(op, this.add16, this.d0);
		case 0o057: // ADD.W D0,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.add16, this.d0);
		case 0o060: // ADDX.L Dy,D0
			return void(this.d0 = this.addx32(this.rop32(op), this.d0));
		case 0o061: // ADDX.L -(Ay),-(A0)
			return void this.write32(this.addx32(this.rop32(op & 7 | 0o40), this.read32(this.a0 = this.a0 - 4 | 0)), this.a0);
		case 0o062: // ADD.L D0,(An)
		case 0o063: // ADD.L D0,(An)+
		case 0o064: // ADD.L D0,-(An)
		case 0o065: // ADD.L D0,d(An)
		case 0o066: // ADD.L D0,d(An,Xi)
			return void this.rwop32(op, this.add32, this.d0);
		case 0o067: // ADD.L D0,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.add32, this.d0);
		case 0o070: // ADDA.L Dn,A0
		case 0o071: // ADDA.L An,A0
		case 0o072: // ADDA.L (An),A0
		case 0o073: // ADDA.L (An)+,A0
		case 0o074: // ADDA.L -(An),A0
		case 0o075: // ADDA.L d(An),A0
		case 0o076: // ADDA.L d(An,Xi),A0
			return void(this.a0 = this.a0 + this.rop32(op) | 0);
		case 0o077: // ADDA.L Abs...,A0
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a0 = this.a0 + this.rop32(op) | 0);
		case 0o100: // ADD.B Dn,D1
		case 0o102: // ADD.B (An),D1
		case 0o103: // ADD.B (An)+,D1
		case 0o104: // ADD.B -(An),D1
		case 0o105: // ADD.B d(An),D1
		case 0o106: // ADD.B d(An,Xi),D1
			return void(this.d1 = this.d1 & ~0xff | this.add8(this.rop8(op), this.d1));
		case 0o107: // ADD.B Abs...,D1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d1 = this.d1 & ~0xff | this.add8(this.rop8(op), this.d1));
		case 0o110: // ADD.W Dn,D1
		case 0o111: // ADD.W An,D1
		case 0o112: // ADD.W (An),D1
		case 0o113: // ADD.W (An)+,D1
		case 0o114: // ADD.W -(An),D1
		case 0o115: // ADD.W d(An),D1
		case 0o116: // ADD.W d(An,Xi),D1
			return void(this.d1 = this.d1 & ~0xffff | this.add16(this.rop16(op), this.d1));
		case 0o117: // ADD.W Abs...,D1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d1 = this.d1 & ~0xffff | this.add16(this.rop16(op), this.d1));
		case 0o120: // ADD.L Dn,D1
		case 0o121: // ADD.L An,D1
		case 0o122: // ADD.L (An),D1
		case 0o123: // ADD.L (An)+,D1
		case 0o124: // ADD.L -(An),D1
		case 0o125: // ADD.L d(An),D1
		case 0o126: // ADD.L d(An,Xi),D1
			return void(this.d1 = this.add32(this.rop32(op), this.d1));
		case 0o127: // ADD.L Abs...,D1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d1 = this.add32(this.rop32(op), this.d1));
		case 0o130: // ADDA.W Dn,A1
		case 0o131: // ADDA.W An,A1
		case 0o132: // ADDA.W (An),A1
		case 0o133: // ADDA.W (An)+,A1
		case 0o134: // ADDA.W -(An),A1
		case 0o135: // ADDA.W d(An),A1
		case 0o136: // ADDA.W d(An,Xi),A1
			return void(this.a1 = this.a1 + (data = this.rop16(op)) - (data << 1 & 0x10000) | 0);
		case 0o137: // ADDA.W Abs...,A1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a1 = this.a1 + (data = this.rop16(op)) - (data << 1 & 0x10000) | 0);
		case 0o140: // ADDX.B Dy,D1
			return void(this.d1 = this.d1 & ~0xff | this.addx8(this.rop8(op), this.d1));
		case 0o141: // ADDX.B -(Ay),-(A1)
			return void this.write8(this.addx8(this.rop8(op & 7 | 0o40), this.read8(this.a1 = this.a1 - 1 | 0)), this.a1);
		case 0o142: // ADD.B D1,(An)
		case 0o143: // ADD.B D1,(An)+
		case 0o144: // ADD.B D1,-(An)
		case 0o145: // ADD.B D1,d(An)
		case 0o146: // ADD.B D1,d(An,Xi)
			return void this.rwop8(op, this.add8, this.d1);
		case 0o147: // ADD.B D1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.add8, this.d1);
		case 0o150: // ADDX.W Dy,D1
			return void(this.d1 = this.d1 & ~0xffff | this.addx16(this.rop16(op), this.d1));
		case 0o151: // ADDX.W -(Ay),-(A1)
			return void this.write16(this.addx16(this.rop16(op & 7 | 0o40), this.read16(this.a1 = this.a1 - 2 | 0)), this.a1);
		case 0o152: // ADD.W D1,(An)
		case 0o153: // ADD.W D1,(An)+
		case 0o154: // ADD.W D1,-(An)
		case 0o155: // ADD.W D1,d(An)
		case 0o156: // ADD.W D1,d(An,Xi)
			return void this.rwop16(op, this.add16, this.d1);
		case 0o157: // ADD.W D1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.add16, this.d1);
		case 0o160: // ADDX.L Dy,D1
			return void(this.d1 = this.addx32(this.rop32(op), this.d1));
		case 0o161: // ADDX.L -(Ay),-(A1)
			return void this.write32(this.addx32(this.rop32(op & 7 | 0o40), this.read32(this.a1 = this.a1 - 4 | 0)), this.a1);
		case 0o162: // ADD.L D1,(An)
		case 0o163: // ADD.L D1,(An)+
		case 0o164: // ADD.L D1,-(An)
		case 0o165: // ADD.L D1,d(An)
		case 0o166: // ADD.L D1,d(An,Xi)
			return void this.rwop32(op, this.add32, this.d1);
		case 0o167: // ADD.L D1,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.add32, this.d1);
		case 0o170: // ADDA.L Dn,A1
		case 0o171: // ADDA.L An,A1
		case 0o172: // ADDA.L (An),A1
		case 0o173: // ADDA.L (An)+,A1
		case 0o174: // ADDA.L -(An),A1
		case 0o175: // ADDA.L d(An),A1
		case 0o176: // ADDA.L d(An,Xi),A1
			return void(this.a1 = this.a1 + this.rop32(op) | 0);
		case 0o177: // ADDA.L Abs...,A1
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a1 = this.a1 + this.rop32(op) | 0);
		case 0o200: // ADD.B Dn,D2
		case 0o202: // ADD.B (An),D2
		case 0o203: // ADD.B (An)+,D2
		case 0o204: // ADD.B -(An),D2
		case 0o205: // ADD.B d(An),D2
		case 0o206: // ADD.B d(An,Xi),D2
			return void(this.d2 = this.d2 & ~0xff | this.add8(this.rop8(op), this.d2));
		case 0o207: // ADD.B Abs...,D2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d2 = this.d2 & ~0xff | this.add8(this.rop8(op), this.d2));
		case 0o210: // ADD.W Dn,D2
		case 0o211: // ADD.W An,D2
		case 0o212: // ADD.W (An),D2
		case 0o213: // ADD.W (An)+,D2
		case 0o214: // ADD.W -(An),D2
		case 0o215: // ADD.W d(An),D2
		case 0o216: // ADD.W d(An,Xi),D2
			return void(this.d2 = this.d2 & ~0xffff | this.add16(this.rop16(op), this.d2));
		case 0o217: // ADD.W Abs...,D2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d2 = this.d2 & ~0xffff | this.add16(this.rop16(op), this.d2));
		case 0o220: // ADD.L Dn,D2
		case 0o221: // ADD.L An,D2
		case 0o222: // ADD.L (An),D2
		case 0o223: // ADD.L (An)+,D2
		case 0o224: // ADD.L -(An),D2
		case 0o225: // ADD.L d(An),D2
		case 0o226: // ADD.L d(An,Xi),D2
			return void(this.d2 = this.add32(this.rop32(op), this.d2));
		case 0o227: // ADD.L Abs...,D2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d2 = this.add32(this.rop32(op), this.d2));
		case 0o230: // ADDA.W Dn,A2
		case 0o231: // ADDA.W An,A2
		case 0o232: // ADDA.W (An),A2
		case 0o233: // ADDA.W (An)+,A2
		case 0o234: // ADDA.W -(An),A2
		case 0o235: // ADDA.W d(An),A2
		case 0o236: // ADDA.W d(An,Xi),A2
			return void(this.a2 = this.a2 + (data = this.rop16(op)) - (data << 1 & 0x10000) | 0);
		case 0o237: // ADDA.W Abs...,A2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a2 = this.a2 + (data = this.rop16(op)) - (data << 1 & 0x10000) | 0);
		case 0o240: // ADDX.B Dy,D2
			return void(this.d2 = this.d2 & ~0xff | this.addx8(this.rop8(op), this.d2));
		case 0o241: // ADDX.B -(Ay),-(A2)
			return void this.write8(this.addx8(this.rop8(op & 7 | 0o40), this.read8(this.a2 = this.a2 - 1 | 0)), this.a2);
		case 0o242: // ADD.B D2,(An)
		case 0o243: // ADD.B D2,(An)+
		case 0o244: // ADD.B D2,-(An)
		case 0o245: // ADD.B D2,d(An)
		case 0o246: // ADD.B D2,d(An,Xi)
			return void this.rwop8(op, this.add8, this.d2);
		case 0o247: // ADD.B D2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.add8, this.d2);
		case 0o250: // ADDX.W Dy,D2
			return void(this.d2 = this.d2 & ~0xffff | this.addx16(this.rop16(op), this.d2));
		case 0o251: // ADDX.W -(Ay),-(A2)
			return void this.write16(this.addx16(this.rop16(op & 7 | 0o40), this.read16(this.a2 = this.a2 - 2 | 0)), this.a2);
		case 0o252: // ADD.W D2,(An)
		case 0o253: // ADD.W D2,(An)+
		case 0o254: // ADD.W D2,-(An)
		case 0o255: // ADD.W D2,d(An)
		case 0o256: // ADD.W D2,d(An,Xi)
			return void this.rwop16(op, this.add16, this.d2);
		case 0o257: // ADD.W D2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.add16, this.d2);
		case 0o260: // ADDX.L Dy,D2
			return void(this.d2 = this.addx32(this.rop32(op), this.d2));
		case 0o261: // ADDX.L -(Ay),-(A2)
			return void this.write32(this.addx32(this.rop32(op & 7 | 0o40), this.read32(this.a2 = this.a2 - 4 | 0)), this.a2);
		case 0o262: // ADD.L D2,(An)
		case 0o263: // ADD.L D2,(An)+
		case 0o264: // ADD.L D2,-(An)
		case 0o265: // ADD.L D2,d(An)
		case 0o266: // ADD.L D2,d(An,Xi)
			return void this.rwop32(op, this.add32, this.d2);
		case 0o267: // ADD.L D2,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.add32, this.d2);
		case 0o270: // ADDA.L Dn,A2
		case 0o271: // ADDA.L An,A2
		case 0o272: // ADDA.L (An),A2
		case 0o273: // ADDA.L (An)+,A2
		case 0o274: // ADDA.L -(An),A2
		case 0o275: // ADDA.L d(An),A2
		case 0o276: // ADDA.L d(An,Xi),A2
			return void(this.a2 = this.a2 + this.rop32(op) | 0);
		case 0o277: // ADDA.L Abs...,A2
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a2 = this.a2 + this.rop32(op) | 0);
		case 0o300: // ADD.B Dn,D3
		case 0o302: // ADD.B (An),D3
		case 0o303: // ADD.B (An)+,D3
		case 0o304: // ADD.B -(An),D3
		case 0o305: // ADD.B d(An),D3
		case 0o306: // ADD.B d(An,Xi),D3
			return void(this.d3 = this.d3 & ~0xff | this.add8(this.rop8(op), this.d3));
		case 0o307: // ADD.B Abs...,D3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d3 = this.d3 & ~0xff | this.add8(this.rop8(op), this.d3));
		case 0o310: // ADD.W Dn,D3
		case 0o311: // ADD.W An,D3
		case 0o312: // ADD.W (An),D3
		case 0o313: // ADD.W (An)+,D3
		case 0o314: // ADD.W -(An),D3
		case 0o315: // ADD.W d(An),D3
		case 0o316: // ADD.W d(An,Xi),D3
			return void(this.d3 = this.d3 & ~0xffff | this.add16(this.rop16(op), this.d3));
		case 0o317: // ADD.W Abs...,D3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d3 = this.d3 & ~0xffff | this.add16(this.rop16(op), this.d3));
		case 0o320: // ADD.L Dn,D3
		case 0o321: // ADD.L An,D3
		case 0o322: // ADD.L (An),D3
		case 0o323: // ADD.L (An)+,D3
		case 0o324: // ADD.L -(An),D3
		case 0o325: // ADD.L d(An),D3
		case 0o326: // ADD.L d(An,Xi),D3
			return void(this.d3 = this.add32(this.rop32(op), this.d3));
		case 0o327: // ADD.L Abs...,D3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d3 = this.add32(this.rop32(op), this.d3));
		case 0o330: // ADDA.W Dn,A3
		case 0o331: // ADDA.W An,A3
		case 0o332: // ADDA.W (An),A3
		case 0o333: // ADDA.W (An)+,A3
		case 0o334: // ADDA.W -(An),A3
		case 0o335: // ADDA.W d(An),A3
		case 0o336: // ADDA.W d(An,Xi),A3
			return void(this.a3 = this.a3 + (data = this.rop16(op)) - (data << 1 & 0x10000) | 0);
		case 0o337: // ADDA.W Abs...,A3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a3 = this.a3 + (data = this.rop16(op)) - (data << 1 & 0x10000) | 0);
		case 0o340: // ADDX.B Dy,D3
			return void(this.d3 = this.d3 & ~0xff | this.addx8(this.rop8(op), this.d3));
		case 0o341: // ADDX.B -(Ay),-(A3)
			return void this.write8(this.addx8(this.rop8(op & 7 | 0o40), this.read8(this.a3 = this.a3 - 1 | 0)), this.a3);
		case 0o342: // ADD.B D3,(An)
		case 0o343: // ADD.B D3,(An)+
		case 0o344: // ADD.B D3,-(An)
		case 0o345: // ADD.B D3,d(An)
		case 0o346: // ADD.B D3,d(An,Xi)
			return void this.rwop8(op, this.add8, this.d3);
		case 0o347: // ADD.B D3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.add8, this.d3);
		case 0o350: // ADDX.W Dy,D3
			return void(this.d3 = this.d3 & ~0xffff | this.addx16(this.rop16(op), this.d3));
		case 0o351: // ADDX.W -(Ay),-(A3)
			return void this.write16(this.addx16(this.rop16(op & 7 | 0o40), this.read16(this.a3 = this.a3 - 2 | 0)), this.a3);
		case 0o352: // ADD.W D3,(An)
		case 0o353: // ADD.W D3,(An)+
		case 0o354: // ADD.W D3,-(An)
		case 0o355: // ADD.W D3,d(An)
		case 0o356: // ADD.W D3,d(An,Xi)
			return void this.rwop16(op, this.add16, this.d3);
		case 0o357: // ADD.W D3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.add16, this.d3);
		case 0o360: // ADDX.L Dy,D3
			return void(this.d3 = this.addx32(this.rop32(op), this.d3));
		case 0o361: // ADDX.L -(Ay),-(A3)
			return void this.write32(this.addx32(this.rop32(op & 7 | 0o40), this.read32(this.a3 = this.a3 - 4 | 0)), this.a3);
		case 0o362: // ADD.L D3,(An)
		case 0o363: // ADD.L D3,(An)+
		case 0o364: // ADD.L D3,-(An)
		case 0o365: // ADD.L D3,d(An)
		case 0o366: // ADD.L D3,d(An,Xi)
			return void this.rwop32(op, this.add32, this.d3);
		case 0o367: // ADD.L D3,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.add32, this.d3);
		case 0o370: // ADDA.L Dn,A3
		case 0o371: // ADDA.L An,A3
		case 0o372: // ADDA.L (An),A3
		case 0o373: // ADDA.L (An)+,A3
		case 0o374: // ADDA.L -(An),A3
		case 0o375: // ADDA.L d(An),A3
		case 0o376: // ADDA.L d(An,Xi),A3
			return void(this.a3 = this.a3 + this.rop32(op) | 0);
		case 0o377: // ADDA.L Abs...,A3
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a3 = this.a3 + this.rop32(op) | 0);
		case 0o400: // ADD.B Dn,D4
		case 0o402: // ADD.B (An),D4
		case 0o403: // ADD.B (An)+,D4
		case 0o404: // ADD.B -(An),D4
		case 0o405: // ADD.B d(An),D4
		case 0o406: // ADD.B d(An,Xi),D4
			return void(this.d4 = this.d4 & ~0xff | this.add8(this.rop8(op), this.d4));
		case 0o407: // ADD.B Abs...,D4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d4 = this.d4 & ~0xff | this.add8(this.rop8(op), this.d4));
		case 0o410: // ADD.W Dn,D4
		case 0o411: // ADD.W An,D4
		case 0o412: // ADD.W (An),D4
		case 0o413: // ADD.W (An)+,D4
		case 0o414: // ADD.W -(An),D4
		case 0o415: // ADD.W d(An),D4
		case 0o416: // ADD.W d(An,Xi),D4
			return void(this.d4 = this.d4 & ~0xffff | this.add16(this.rop16(op), this.d4));
		case 0o417: // ADD.W Abs...,D4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d4 = this.d4 & ~0xffff | this.add16(this.rop16(op), this.d4));
		case 0o420: // ADD.L Dn,D4
		case 0o421: // ADD.L An,D4
		case 0o422: // ADD.L (An),D4
		case 0o423: // ADD.L (An)+,D4
		case 0o424: // ADD.L -(An),D4
		case 0o425: // ADD.L d(An),D4
		case 0o426: // ADD.L d(An,Xi),D4
			return void(this.d4 = this.add32(this.rop32(op), this.d4));
		case 0o427: // ADD.L Abs...,D4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d4 = this.add32(this.rop32(op), this.d4));
		case 0o430: // ADDA.W Dn,A4
		case 0o431: // ADDA.W An,A4
		case 0o432: // ADDA.W (An),A4
		case 0o433: // ADDA.W (An)+,A4
		case 0o434: // ADDA.W -(An),A4
		case 0o435: // ADDA.W d(An),A4
		case 0o436: // ADDA.W d(An,Xi),A4
			return void(this.a4 = this.a4 + (data = this.rop16(op)) - (data << 1 & 0x10000) | 0);
		case 0o437: // ADDA.W Abs...,A4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a4 = this.a4 + (data = this.rop16(op)) - (data << 1 & 0x10000) | 0);
		case 0o440: // ADDX.B Dy,D4
			return void(this.d4 = this.d4 & ~0xff | this.addx8(this.rop8(op), this.d4));
		case 0o441: // ADDX.B -(Ay),-(A4)
			return void this.write8(this.addx8(this.rop8(op & 7 | 0o40), this.read8(this.a4 = this.a4 - 1 | 0)), this.a4);
		case 0o442: // ADD.B D4,(An)
		case 0o443: // ADD.B D4,(An)+
		case 0o444: // ADD.B D4,-(An)
		case 0o445: // ADD.B D4,d(An)
		case 0o446: // ADD.B D4,d(An,Xi)
			return void this.rwop8(op, this.add8, this.d4);
		case 0o447: // ADD.B D4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.add8, this.d4);
		case 0o450: // ADDX.W Dy,D4
			return void(this.d4 = this.d4 & ~0xffff | this.addx16(this.rop16(op), this.d4));
		case 0o451: // ADDX.W -(Ay),-(A4)
			return void this.write16(this.addx16(this.rop16(op & 7 | 0o40), this.read16(this.a4 = this.a4 - 2 | 0)), this.a4);
		case 0o452: // ADD.W D4,(An)
		case 0o453: // ADD.W D4,(An)+
		case 0o454: // ADD.W D4,-(An)
		case 0o455: // ADD.W D4,d(An)
		case 0o456: // ADD.W D4,d(An,Xi)
			return void this.rwop16(op, this.add16, this.d4);
		case 0o457: // ADD.W D4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.add16, this.d4);
		case 0o460: // ADDX.L Dy,D4
			return void(this.d4 = this.addx32(this.rop32(op), this.d4));
		case 0o461: // ADDX.L -(Ay),-(A4)
			return void this.write32(this.addx32(this.rop32(op & 7 | 0o40), this.read32(this.a4 = this.a4 - 4 | 0)), this.a4);
		case 0o462: // ADD.L D4,(An)
		case 0o463: // ADD.L D4,(An)+
		case 0o464: // ADD.L D4,-(An)
		case 0o465: // ADD.L D4,d(An)
		case 0o466: // ADD.L D4,d(An,Xi)
			return void this.rwop32(op, this.add32, this.d4);
		case 0o467: // ADD.L D4,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.add32, this.d4);
		case 0o470: // ADDA.L Dn,A4
		case 0o471: // ADDA.L An,A4
		case 0o472: // ADDA.L (An),A4
		case 0o473: // ADDA.L (An)+,A4
		case 0o474: // ADDA.L -(An),A4
		case 0o475: // ADDA.L d(An),A4
		case 0o476: // ADDA.L d(An,Xi),A4
			return void(this.a4 = this.a4 + this.rop32(op) | 0);
		case 0o477: // ADDA.L Abs...,A4
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a4 = this.a4 + this.rop32(op) | 0);
		case 0o500: // ADD.B Dn,D5
		case 0o502: // ADD.B (An),D5
		case 0o503: // ADD.B (An)+,D5
		case 0o504: // ADD.B -(An),D5
		case 0o505: // ADD.B d(An),D5
		case 0o506: // ADD.B d(An,Xi),D5
			return void(this.d5 = this.d5 & ~0xff | this.add8(this.rop8(op), this.d5));
		case 0o507: // ADD.B Abs...,D5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d5 = this.d5 & ~0xff | this.add8(this.rop8(op), this.d5));
		case 0o510: // ADD.W Dn,D5
		case 0o511: // ADD.W An,D5
		case 0o512: // ADD.W (An),D5
		case 0o513: // ADD.W (An)+,D5
		case 0o514: // ADD.W -(An),D5
		case 0o515: // ADD.W d(An),D5
		case 0o516: // ADD.W d(An,Xi),D5
			return void(this.d5 = this.d5 & ~0xffff | this.add16(this.rop16(op), this.d5));
		case 0o517: // ADD.W Abs...,D5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d5 = this.d5 & ~0xffff | this.add16(this.rop16(op), this.d5));
		case 0o520: // ADD.L Dn,D5
		case 0o521: // ADD.L An,D5
		case 0o522: // ADD.L (An),D5
		case 0o523: // ADD.L (An)+,D5
		case 0o524: // ADD.L -(An),D5
		case 0o525: // ADD.L d(An),D5
		case 0o526: // ADD.L d(An,Xi),D5
			return void(this.d5 = this.add32(this.rop32(op), this.d5));
		case 0o527: // ADD.L Abs...,D5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d5 = this.add32(this.rop32(op), this.d5));
		case 0o530: // ADDA.W Dn,A5
		case 0o531: // ADDA.W An,A5
		case 0o532: // ADDA.W (An),A5
		case 0o533: // ADDA.W (An)+,A5
		case 0o534: // ADDA.W -(An),A5
		case 0o535: // ADDA.W d(An),A5
		case 0o536: // ADDA.W d(An,Xi),A5
			return void(this.a5 = this.a5 + (data = this.rop16(op)) - (data << 1 & 0x10000) | 0);
		case 0o537: // ADDA.W Abs...,A5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a5 = this.a5 + (data = this.rop16(op)) - (data << 1 & 0x10000) | 0);
		case 0o540: // ADDX.B Dy,D5
			return void(this.d5 = this.d5 & ~0xff | this.addx8(this.rop8(op), this.d5));
		case 0o541: // ADDX.B -(Ay),-(A5)
			return void this.write8(this.addx8(this.rop8(op & 7 | 0o40), this.read8(this.a5 = this.a5 - 1 | 0)), this.a5);
		case 0o542: // ADD.B D5,(An)
		case 0o543: // ADD.B D5,(An)+
		case 0o544: // ADD.B D5,-(An)
		case 0o545: // ADD.B D5,d(An)
		case 0o546: // ADD.B D5,d(An,Xi)
			return void this.rwop8(op, this.add8, this.d5);
		case 0o547: // ADD.B D5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.add8, this.d5);
		case 0o550: // ADDX.W Dy,D5
			return void(this.d5 = this.d5 & ~0xffff | this.addx16(this.rop16(op), this.d5));
		case 0o551: // ADDX.W -(Ay),-(A5)
			return void this.write16(this.addx16(this.rop16(op & 7 | 0o40), this.read16(this.a5 = this.a5 - 2 | 0)), this.a5);
		case 0o552: // ADD.W D5,(An)
		case 0o553: // ADD.W D5,(An)+
		case 0o554: // ADD.W D5,-(An)
		case 0o555: // ADD.W D5,d(An)
		case 0o556: // ADD.W D5,d(An,Xi)
			return void this.rwop16(op, this.add16, this.d5);
		case 0o557: // ADD.W D5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.add16, this.d5);
		case 0o560: // ADDX.L Dy,D5
			return void(this.d5 = this.addx32(this.rop32(op), this.d5));
		case 0o561: // ADDX.L -(Ay),-(A5)
			return void this.write32(this.addx32(this.rop32(op & 7 | 0o40), this.read32(this.a5 = this.a5 - 4 | 0)), this.a5);
		case 0o562: // ADD.L D5,(An)
		case 0o563: // ADD.L D5,(An)+
		case 0o564: // ADD.L D5,-(An)
		case 0o565: // ADD.L D5,d(An)
		case 0o566: // ADD.L D5,d(An,Xi)
			return void this.rwop32(op, this.add32, this.d5);
		case 0o567: // ADD.L D5,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.add32, this.d5);
		case 0o570: // ADDA.L Dn,A5
		case 0o571: // ADDA.L An,A5
		case 0o572: // ADDA.L (An),A5
		case 0o573: // ADDA.L (An)+,A5
		case 0o574: // ADDA.L -(An),A5
		case 0o575: // ADDA.L d(An),A5
		case 0o576: // ADDA.L d(An,Xi),A5
			return void(this.a5 = this.a5 + this.rop32(op) | 0);
		case 0o577: // ADDA.L Abs...,A5
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a5 = this.a5 + this.rop32(op) | 0);
		case 0o600: // ADD.B Dn,D6
		case 0o602: // ADD.B (An),D6
		case 0o603: // ADD.B (An)+,D6
		case 0o604: // ADD.B -(An),D6
		case 0o605: // ADD.B d(An),D6
		case 0o606: // ADD.B d(An,Xi),D6
			return void(this.d6 = this.d6 & ~0xff | this.add8(this.rop8(op), this.d6));
		case 0o607: // ADD.B Abs...,D6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d6 = this.d6 & ~0xff | this.add8(this.rop8(op), this.d6));
		case 0o610: // ADD.W Dn,D6
		case 0o611: // ADD.W An,D6
		case 0o612: // ADD.W (An),D6
		case 0o613: // ADD.W (An)+,D6
		case 0o614: // ADD.W -(An),D6
		case 0o615: // ADD.W d(An),D6
		case 0o616: // ADD.W d(An,Xi),D6
			return void(this.d6 = this.d6 & ~0xffff | this.add16(this.rop16(op), this.d6));
		case 0o617: // ADD.W Abs...,D6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d6 = this.d6 & ~0xffff | this.add16(this.rop16(op), this.d6));
		case 0o620: // ADD.L Dn,D6
		case 0o621: // ADD.L An,D6
		case 0o622: // ADD.L (An),D6
		case 0o623: // ADD.L (An)+,D6
		case 0o624: // ADD.L -(An),D6
		case 0o625: // ADD.L d(An),D6
		case 0o626: // ADD.L d(An,Xi),D6
			return void(this.d6 = this.add32(this.rop32(op), this.d6));
		case 0o627: // ADD.L Abs...,D6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d6 = this.add32(this.rop32(op), this.d6));
		case 0o630: // ADDA.W Dn,A6
		case 0o631: // ADDA.W An,A6
		case 0o632: // ADDA.W (An),A6
		case 0o633: // ADDA.W (An)+,A6
		case 0o634: // ADDA.W -(An),A6
		case 0o635: // ADDA.W d(An),A6
		case 0o636: // ADDA.W d(An,Xi),A6
			return void(this.a6 = this.a6 + (data = this.rop16(op)) - (data << 1 & 0x10000) | 0);
		case 0o637: // ADDA.W Abs...,A6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a6 = this.a6 + (data = this.rop16(op)) - (data << 1 & 0x10000) | 0);
		case 0o640: // ADDX.B Dy,D6
			return void(this.d6 = this.d6 & ~0xff | this.addx8(this.rop8(op), this.d6));
		case 0o641: // ADDX.B -(Ay),-(A6)
			return void this.write8(this.addx8(this.rop8(op & 7 | 0o40), this.read8(this.a6 = this.a6 - 1 | 0)), this.a6);
		case 0o642: // ADD.B D6,(An)
		case 0o643: // ADD.B D6,(An)+
		case 0o644: // ADD.B D6,-(An)
		case 0o645: // ADD.B D6,d(An)
		case 0o646: // ADD.B D6,d(An,Xi)
			return void this.rwop8(op, this.add8, this.d6);
		case 0o647: // ADD.B D6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.add8, this.d6);
		case 0o650: // ADDX.W Dy,D6
			return void(this.d6 = this.d6 & ~0xffff | this.addx16(this.rop16(op), this.d6));
		case 0o651: // ADDX.W -(Ay),-(A6)
			return void this.write16(this.addx16(this.rop16(op & 7 | 0o40), this.read16(this.a6 = this.a6 - 2 | 0)), this.a6);
		case 0o652: // ADD.W D6,(An)
		case 0o653: // ADD.W D6,(An)+
		case 0o654: // ADD.W D6,-(An)
		case 0o655: // ADD.W D6,d(An)
		case 0o656: // ADD.W D6,d(An,Xi)
			return void this.rwop16(op, this.add16, this.d6);
		case 0o657: // ADD.W D6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.add16, this.d6);
		case 0o660: // ADDX.L Dy,D6
			return void(this.d6 = this.addx32(this.rop32(op), this.d6));
		case 0o661: // ADDX.L -(Ay),-(A6)
			return void this.write32(this.addx32(this.rop32(op & 7 | 0o40), this.read32(this.a6 = this.a6 - 4 | 0)), this.a6);
		case 0o662: // ADD.L D6,(An)
		case 0o663: // ADD.L D6,(An)+
		case 0o664: // ADD.L D6,-(An)
		case 0o665: // ADD.L D6,d(An)
		case 0o666: // ADD.L D6,d(An,Xi)
			return void this.rwop32(op, this.add32, this.d6);
		case 0o667: // ADD.L D6,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.add32, this.d6);
		case 0o670: // ADDA.L Dn,A6
		case 0o671: // ADDA.L An,A6
		case 0o672: // ADDA.L (An),A6
		case 0o673: // ADDA.L (An)+,A6
		case 0o674: // ADDA.L -(An),A6
		case 0o675: // ADDA.L d(An),A6
		case 0o676: // ADDA.L d(An,Xi),A6
			return void(this.a6 = this.a6 + this.rop32(op) | 0);
		case 0o677: // ADDA.L Abs...,A6
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a6 = this.a6 + this.rop32(op) | 0);
		case 0o700: // ADD.B Dn,D7
		case 0o702: // ADD.B (An),D7
		case 0o703: // ADD.B (An)+,D7
		case 0o704: // ADD.B -(An),D7
		case 0o705: // ADD.B d(An),D7
		case 0o706: // ADD.B d(An,Xi),D7
			return void(this.d7 = this.d7 & ~0xff | this.add8(this.rop8(op), this.d7));
		case 0o707: // ADD.B Abs...,D7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d7 = this.d7 & ~0xff | this.add8(this.rop8(op), this.d7));
		case 0o710: // ADD.W Dn,D7
		case 0o711: // ADD.W An,D7
		case 0o712: // ADD.W (An),D7
		case 0o713: // ADD.W (An)+,D7
		case 0o714: // ADD.W -(An),D7
		case 0o715: // ADD.W d(An),D7
		case 0o716: // ADD.W d(An,Xi),D7
			return void(this.d7 = this.d7 & ~0xffff | this.add16(this.rop16(op), this.d7));
		case 0o717: // ADD.W Abs...,D7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d7 = this.d7 & ~0xffff | this.add16(this.rop16(op), this.d7));
		case 0o720: // ADD.L Dn,D7
		case 0o721: // ADD.L An,D7
		case 0o722: // ADD.L (An),D7
		case 0o723: // ADD.L (An)+,D7
		case 0o724: // ADD.L -(An),D7
		case 0o725: // ADD.L d(An),D7
		case 0o726: // ADD.L d(An,Xi),D7
			return void(this.d7 = this.add32(this.rop32(op), this.d7));
		case 0o727: // ADD.L Abs...,D7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.d7 = this.add32(this.rop32(op), this.d7));
		case 0o730: // ADDA.W Dn,A7
		case 0o731: // ADDA.W An,A7
		case 0o732: // ADDA.W (An),A7
		case 0o733: // ADDA.W (An)+,A7
		case 0o734: // ADDA.W -(An),A7
		case 0o735: // ADDA.W d(An),A7
		case 0o736: // ADDA.W d(An,Xi),A7
			return void(this.a7 = this.a7 + (data = this.rop16(op)) - (data << 1 & 0x10000) | 0);
		case 0o737: // ADDA.W Abs...,A7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a7 = this.a7 + (data = this.rop16(op)) - (data << 1 & 0x10000) | 0);
		case 0o740: // ADDX.B Dy,D7
			return void(this.d7 = this.d7 & ~0xff | this.addx8(this.rop8(op), this.d7));
		case 0o741: // ADDX.B -(Ay),-(A7)
			return void this.write8(this.addx8(this.rop8(op & 7 | 0o40), this.read8(this.a7 = this.a7 - 1 | 0)), this.a7);
		case 0o742: // ADD.B D7,(An)
		case 0o743: // ADD.B D7,(An)+
		case 0o744: // ADD.B D7,-(An)
		case 0o745: // ADD.B D7,d(An)
		case 0o746: // ADD.B D7,d(An,Xi)
			return void this.rwop8(op, this.add8, this.d7);
		case 0o747: // ADD.B D7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop8(op, this.add8, this.d7);
		case 0o750: // ADDX.W Dy,D7
			return void(this.d7 = this.d7 & ~0xffff | this.addx16(this.rop16(op), this.d7));
		case 0o751: // ADDX.W -(Ay),-(A7)
			return void this.write16(this.addx16(this.rop16(op & 7 | 0o40), this.read16(this.a7 = this.a7 - 2 | 0)), this.a7);
		case 0o752: // ADD.W D7,(An)
		case 0o753: // ADD.W D7,(An)+
		case 0o754: // ADD.W D7,-(An)
		case 0o755: // ADD.W D7,d(An)
		case 0o756: // ADD.W D7,d(An,Xi)
			return void this.rwop16(op, this.add16, this.d7);
		case 0o757: // ADD.W D7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.add16, this.d7);
		case 0o760: // ADDX.L Dy,D7
			return void(this.d7 = this.addx32(this.rop32(op), this.d7));
		case 0o761: // ADDX.L -(Ay),-(A7)
			return void this.write32(this.addx32(this.rop32(op & 7 | 0o40), this.read32(this.a7 = this.a7 - 4 | 0)), this.a7);
		case 0o762: // ADD.L D7,(An)
		case 0o763: // ADD.L D7,(An)+
		case 0o764: // ADD.L D7,-(An)
		case 0o765: // ADD.L D7,d(An)
		case 0o766: // ADD.L D7,d(An,Xi)
			return void this.rwop32(op, this.add32, this.d7);
		case 0o767: // ADD.L D7,Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop32(op, this.add32, this.d7);
		case 0o770: // ADDA.L Dn,A7
		case 0o771: // ADDA.L An,A7
		case 0o772: // ADDA.L (An),A7
		case 0o773: // ADDA.L (An)+,A7
		case 0o774: // ADDA.L -(An),A7
		case 0o775: // ADDA.L d(An),A7
		case 0o776: // ADDA.L d(An,Xi),A7
			return void(this.a7 = this.a7 + this.rop32(op) | 0);
		case 0o777: // ADDA.L Abs...,A7
			if ((op & 7) >= 5)
				return void this.exception(4);
			return void(this.a7 = this.a7 + this.rop32(op) | 0);
		default:
			return void this.exception(4);
		}
	}

	execute_e(op) {
		switch (op >>> 3 & 0o777) {
		case 0o000: // ASR.B #8,Dy
			return void this.rwop8(op & 7, this.asr8, 8);
		case 0o001: // LSR.B #8,Dy
			return void this.rwop8(op & 7, this.lsr8, 8);
		case 0o002: // ROXR.B #8,Dy
			return void this.rwop8(op & 7, this.roxr8, 8);
		case 0o003: // ROR.B #8,Dy
			return void this.rwop8(op & 7, this.ror8, 8);
		case 0o004: // ASR.B D0,Dy
			return void this.rwop8(op & 7, this.asr8, this.d0);
		case 0o005: // LSR.B D0,Dy
			return void this.rwop8(op & 7, this.lsr8, this.d0);
		case 0o006: // ROXR.B D0,Dy
			return void this.rwop8(op & 7, this.roxr8, this.d0);
		case 0o007: // ROR.B D0,Dy
			return void this.rwop8(op & 7, this.ror8, this.d0);
		case 0o010: // ASR.W #8,Dy
			return void this.rwop16(op & 7, this.asr16, 8);
		case 0o011: // LSR.W #8,Dy
			return void this.rwop16(op & 7, this.lsr16, 8);
		case 0o012: // ROXR.W #8,Dy
			return void this.rwop16(op & 7, this.roxr16, 8);
		case 0o013: // ROR.W #8,Dy
			return void this.rwop16(op & 7, this.ror16, 8);
		case 0o014: // ASR.W D0,Dy
			return void this.rwop16(op & 7, this.asr16, this.d0);
		case 0o015: // LSR.W D0,Dy
			return void this.rwop16(op & 7, this.lsr16, this.d0);
		case 0o016: // ROXR.W D0,Dy
			return void this.rwop16(op & 7, this.roxr16, this.d0);
		case 0o017: // ROR.W D0,Dy
			return void this.rwop16(op & 7, this.ror16, this.d0);
		case 0o020: // ASR.L #8,Dy
			return void this.rwop32(op & 7, this.asr32, 8);
		case 0o021: // LSR.L #8,Dy
			return void this.rwop32(op & 7, this.lsr32, 8);
		case 0o022: // ROXR.L #8,Dy
			return void this.rwop32(op & 7, this.roxr32, 8);
		case 0o023: // ROR.L #8,Dy
			return void this.rwop32(op & 7, this.ror32, 8);
		case 0o024: // ASR.L D0,Dy
			return void this.rwop32(op & 7, this.asr32, this.d0);
		case 0o025: // LSR.L D0,Dy
			return void this.rwop32(op & 7, this.lsr32, this.d0);
		case 0o026: // ROXR.L D0,Dy
			return void this.rwop32(op & 7, this.roxr32, this.d0);
		case 0o027: // ROR.L D0,Dy
			return void this.rwop32(op & 7, this.ror32, this.d0);
		case 0o032: // ASR.W (An)
		case 0o033: // ASR.W (An)+
		case 0o034: // ASR.W -(An)
		case 0o035: // ASR.W d(An)
		case 0o036: // ASR.W d(An,Xi)
			return void this.rwop16(op, this.asr16, 1);
		case 0o037: // ASR.W Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.asr16, 1);
		case 0o040: // ASL.B #8,Dy
			return void this.rwop8(op & 7, this.asl8, 8);
		case 0o041: // LSL.B #8,Dy
			return void this.rwop8(op & 7, this.lsl8, 8);
		case 0o042: // ROXL.B #8,Dy
			return void this.rwop8(op & 7, this.roxl8, 8);
		case 0o043: // ROL.B #8,Dy
			return void this.rwop8(op & 7, this.rol8, 8);
		case 0o044: // ASL.B D0,Dy
			return void this.rwop8(op & 7, this.asl8, this.d0);
		case 0o045: // LSL.B D0,Dy
			return void this.rwop8(op & 7, this.lsl8, this.d0);
		case 0o046: // ROXL.B D0,Dy
			return void this.rwop8(op & 7, this.roxl8, this.d0);
		case 0o047: // ROL.B D0,Dy
			return void this.rwop8(op & 7, this.rol8, this.d0);
		case 0o050: // ASL.W #8,Dy
			return void this.rwop16(op & 7, this.asl16, 8);
		case 0o051: // LSL.W #8,Dy
			return void this.rwop16(op & 7, this.lsl16, 8);
		case 0o052: // ROXL.W #8,Dy
			return void this.rwop16(op & 7, this.roxl16, 8);
		case 0o053: // ROL.W #8,Dy
			return void this.rwop16(op & 7, this.rol16, 8);
		case 0o054: // ASL.W D0,Dy
			return void this.rwop16(op & 7, this.asl16, this.d0);
		case 0o055: // LSL.W D0,Dy
			return void this.rwop16(op & 7, this.lsl16, this.d0);
		case 0o056: // ROXL.W D0,Dy
			return void this.rwop16(op & 7, this.roxl16, this.d0);
		case 0o057: // ROL.W D0,Dy
			return void this.rwop16(op & 7, this.rol16, this.d0);
		case 0o060: // ASL.L #8,Dy
			return void this.rwop32(op & 7, this.asl32, 8);
		case 0o061: // LSL.L #8,Dy
			return void this.rwop32(op & 7, this.lsl32, 8);
		case 0o062: // ROXL.L #8,Dy
			return void this.rwop32(op & 7, this.roxl32, 8);
		case 0o063: // ROL.L #8,Dy
			return void this.rwop32(op & 7, this.rol32, 8);
		case 0o064: // ASL.L D0,Dy
			return void this.rwop32(op & 7, this.asl32, this.d0);
		case 0o065: // LSL.L D0,Dy
			return void this.rwop32(op & 7, this.lsl32, this.d0);
		case 0o066: // ROXL.L D0,Dy
			return void this.rwop32(op & 7, this.roxl32, this.d0);
		case 0o067: // ROL.L D0,Dy
			return void this.rwop32(op & 7, this.rol32, this.d0);
		case 0o072: // ASL.W (An)
		case 0o073: // ASL.W (An)+
		case 0o074: // ASL.W -(An)
		case 0o075: // ASL.W d(An)
		case 0o076: // ASL.W d(An,Xi)
			return void this.rwop16(op, this.asl16, 1);
		case 0o077: // ASL.W Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.asl16, 1);
		case 0o100: // ASR.B #1,Dy
			return void this.rwop8(op & 7, this.asr8, 1);
		case 0o101: // LSR.B #1,Dy
			return void this.rwop8(op & 7, this.lsr8, 1);
		case 0o102: // ROXR.B #1,Dy
			return void this.rwop8(op & 7, this.roxr8, 1);
		case 0o103: // ROR.B #1,Dy
			return void this.rwop8(op & 7, this.ror8, 1);
		case 0o104: // ASR.B D1,Dy
			return void this.rwop8(op & 7, this.asr8, this.d1);
		case 0o105: // LSR.B D1,Dy
			return void this.rwop8(op & 7, this.lsr8, this.d1);
		case 0o106: // ROXR.B D1,Dy
			return void this.rwop8(op & 7, this.roxr8, this.d1);
		case 0o107: // ROR.B D1,Dy
			return void this.rwop8(op & 7, this.ror8, this.d1);
		case 0o110: // ASR.W #1,Dy
			return void this.rwop16(op & 7, this.asr16, 1);
		case 0o111: // LSR.W #1,Dy
			return void this.rwop16(op & 7, this.lsr16, 1);
		case 0o112: // ROXR.W #1,Dy
			return void this.rwop16(op & 7, this.roxr16, 1);
		case 0o113: // ROR.W #1,Dy
			return void this.rwop16(op & 7, this.ror16, 1);
		case 0o114: // ASR.W D1,Dy
			return void this.rwop16(op & 7, this.asr16, this.d1);
		case 0o115: // LSR.W D1,Dy
			return void this.rwop16(op & 7, this.lsr16, this.d1);
		case 0o116: // ROXR.W D1,Dy
			return void this.rwop16(op & 7, this.roxr16, this.d1);
		case 0o117: // ROR.W D1,Dy
			return void this.rwop16(op & 7, this.ror16, this.d1);
		case 0o120: // ASR.L #1,Dy
			return void this.rwop32(op & 7, this.asr32, 1);
		case 0o121: // LSR.L #1,Dy
			return void this.rwop32(op & 7, this.lsr32, 1);
		case 0o122: // ROXR.L #1,Dy
			return void this.rwop32(op & 7, this.roxr32, 1);
		case 0o123: // ROR.L #1,Dy
			return void this.rwop32(op & 7, this.ror32, 1);
		case 0o124: // ASR.L D1,Dy
			return void this.rwop32(op & 7, this.asr32, this.d1);
		case 0o125: // LSR.L D1,Dy
			return void this.rwop32(op & 7, this.lsr32, this.d1);
		case 0o126: // ROXR.L D1,Dy
			return void this.rwop32(op & 7, this.roxr32, this.d1);
		case 0o127: // ROR.L D1,Dy
			return void this.rwop32(op & 7, this.ror32, this.d1);
		case 0o132: // LSR.W (An)
		case 0o133: // LSR.W (An)+
		case 0o134: // LSR.W -(An)
		case 0o135: // LSR.W d(An)
		case 0o136: // LSR.W d(An,Xi)
			return void this.rwop16(op, this.lsr16, 1);
		case 0o137: // LSR.W Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.lsr16, 1);
		case 0o140: // ASL.B #1,Dy
			return void this.rwop8(op & 7, this.asl8, 1);
		case 0o141: // LSL.B #1,Dy
			return void this.rwop8(op & 7, this.lsl8, 1);
		case 0o142: // ROXL.B #1,Dy
			return void this.rwop8(op & 7, this.roxl8, 1);
		case 0o143: // ROL.B #1,Dy
			return void this.rwop8(op & 7, this.rol8, 1);
		case 0o144: // ASL.B D1,Dy
			return void this.rwop8(op & 7, this.asl8, this.d1);
		case 0o145: // LSL.B D1,Dy
			return void this.rwop8(op & 7, this.lsl8, this.d1);
		case 0o146: // ROXL.B D1,Dy
			return void this.rwop8(op & 7, this.roxl8, this.d1);
		case 0o147: // ROL.B D1,Dy
			return void this.rwop8(op & 7, this.rol8, this.d1);
		case 0o150: // ASL.W #1,Dy
			return void this.rwop16(op & 7, this.asl16, 1);
		case 0o151: // LSL.W #1,Dy
			return void this.rwop16(op & 7, this.lsl16, 1);
		case 0o152: // ROXL.W #1,Dy
			return void this.rwop16(op & 7, this.roxl16, 1);
		case 0o153: // ROL.W #1,Dy
			return void this.rwop16(op & 7, this.rol16, 1);
		case 0o154: // ASL.W D1,Dy
			return void this.rwop16(op & 7, this.asl16, this.d1);
		case 0o155: // LSL.W D1,Dy
			return void this.rwop16(op & 7, this.lsl16, this.d1);
		case 0o156: // ROXL.W D1,Dy
			return void this.rwop16(op & 7, this.roxl16, this.d1);
		case 0o157: // ROL.W D1,Dy
			return void this.rwop16(op & 7, this.rol16, this.d1);
		case 0o160: // ASL.L #1,Dy
			return void this.rwop32(op & 7, this.asl32, 1);
		case 0o161: // LSL.L #1,Dy
			return void this.rwop32(op & 7, this.lsl32, 1);
		case 0o162: // ROXL.L #1,Dy
			return void this.rwop32(op & 7, this.roxl32, 1);
		case 0o163: // ROL.L #1,Dy
			return void this.rwop32(op & 7, this.rol32, 1);
		case 0o164: // ASL.L D1,Dy
			return void this.rwop32(op & 7, this.asl32, this.d1);
		case 0o165: // LSL.L D1,Dy
			return void this.rwop32(op & 7, this.lsl32, this.d1);
		case 0o166: // ROXL.L D1,Dy
			return void this.rwop32(op & 7, this.roxl32, this.d1);
		case 0o167: // ROL.L D1,Dy
			return void this.rwop32(op & 7, this.rol32, this.d1);
		case 0o172: // LSL.W (An)
		case 0o173: // LSL.W (An)+
		case 0o174: // LSL.W -(An)
		case 0o175: // LSL.W d(An)
		case 0o176: // LSL.W d(An,Xi)
			return void this.rwop16(op, this.lsl16, 1);
		case 0o177: // LSL.W Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.lsl16, 1);
		case 0o200: // ASR.B #2,Dy
			return void this.rwop8(op & 7, this.asr8, 2);
		case 0o201: // LSR.B #2,Dy
			return void this.rwop8(op & 7, this.lsr8, 2);
		case 0o202: // ROXR.B #2,Dy
			return void this.rwop8(op & 7, this.roxr8, 2);
		case 0o203: // ROR.B #2,Dy
			return void this.rwop8(op & 7, this.ror8, 2);
		case 0o204: // ASR.B D2,Dy
			return void this.rwop8(op & 7, this.asr8, this.d2);
		case 0o205: // LSR.B D2,Dy
			return void this.rwop8(op & 7, this.lsr8, this.d2);
		case 0o206: // ROXR.B D2,Dy
			return void this.rwop8(op & 7, this.roxr8, this.d2);
		case 0o207: // ROR.B D2,Dy
			return void this.rwop8(op & 7, this.ror8, this.d2);
		case 0o210: // ASR.W #2,Dy
			return void this.rwop16(op & 7, this.asr16, 2);
		case 0o211: // LSR.W #2,Dy
			return void this.rwop16(op & 7, this.lsr16, 2);
		case 0o212: // ROXR.W #2,Dy
			return void this.rwop16(op & 7, this.roxr16, 2);
		case 0o213: // ROR.W #2,Dy
			return void this.rwop16(op & 7, this.ror16, 2);
		case 0o214: // ASR.W D2,Dy
			return void this.rwop16(op & 7, this.asr16, this.d2);
		case 0o215: // LSR.W D2,Dy
			return void this.rwop16(op & 7, this.lsr16, this.d2);
		case 0o216: // ROXR.W D2,Dy
			return void this.rwop16(op & 7, this.roxr16, this.d2);
		case 0o217: // ROR.W D2,Dy
			return void this.rwop16(op & 7, this.ror16, this.d2);
		case 0o220: // ASR.L #2,Dy
			return void this.rwop32(op & 7, this.asr32, 2);
		case 0o221: // LSR.L #2,Dy
			return void this.rwop32(op & 7, this.lsr32, 2);
		case 0o222: // ROXR.L #2,Dy
			return void this.rwop32(op & 7, this.roxr32, 2);
		case 0o223: // ROR.L #2,Dy
			return void this.rwop32(op & 7, this.ror32, 2);
		case 0o224: // ASR.L D2,Dy
			return void this.rwop32(op & 7, this.asr32, this.d2);
		case 0o225: // LSR.L D2,Dy
			return void this.rwop32(op & 7, this.lsr32, this.d2);
		case 0o226: // ROXR.L D2,Dy
			return void this.rwop32(op & 7, this.roxr32, this.d2);
		case 0o227: // ROR.L D2,Dy
			return void this.rwop32(op & 7, this.ror32, this.d2);
		case 0o232: // ROXR.W (An)
		case 0o233: // ROXR.W (An)+
		case 0o234: // ROXR.W -(An)
		case 0o235: // ROXR.W d(An)
		case 0o236: // ROXR.W d(An,Xi)
			return void this.rwop16(op, this.roxr16, 1);
		case 0o237: // ROXR.W Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.roxr16, 1);
		case 0o240: // ASL.B #2,Dy
			return void this.rwop8(op & 7, this.asl8, 2);
		case 0o241: // LSL.B #2,Dy
			return void this.rwop8(op & 7, this.lsl8, 2);
		case 0o242: // ROXL.B #2,Dy
			return void this.rwop8(op & 7, this.roxl8, 2);
		case 0o243: // ROL.B #2,Dy
			return void this.rwop8(op & 7, this.rol8, 2);
		case 0o244: // ASL.B D2,Dy
			return void this.rwop8(op & 7, this.asl8, this.d2);
		case 0o245: // LSL.B D2,Dy
			return void this.rwop8(op & 7, this.lsl8, this.d2);
		case 0o246: // ROXL.B D2,Dy
			return void this.rwop8(op & 7, this.roxl8, this.d2);
		case 0o247: // ROL.B D2,Dy
			return void this.rwop8(op & 7, this.rol8, this.d2);
		case 0o250: // ASL.W #2,Dy
			return void this.rwop16(op & 7, this.asl16, 2);
		case 0o251: // LSL.W #2,Dy
			return void this.rwop16(op & 7, this.lsl16, 2);
		case 0o252: // ROXL.W #2,Dy
			return void this.rwop16(op & 7, this.roxl16, 2);
		case 0o253: // ROL.W #2,Dy
			return void this.rwop16(op & 7, this.rol16, 2);
		case 0o254: // ASL.W D2,Dy
			return void this.rwop16(op & 7, this.asl16, this.d2);
		case 0o255: // LSL.W D2,Dy
			return void this.rwop16(op & 7, this.lsl16, this.d2);
		case 0o256: // ROXL.W D2,Dy
			return void this.rwop16(op & 7, this.roxl16, this.d2);
		case 0o257: // ROL.W D2,Dy
			return void this.rwop16(op & 7, this.rol16, this.d2);
		case 0o260: // ASL.L #2,Dy
			return void this.rwop32(op & 7, this.asl32, 2);
		case 0o261: // LSL.L #2,Dy
			return void this.rwop32(op & 7, this.lsl32, 2);
		case 0o262: // ROXL.L #2,Dy
			return void this.rwop32(op & 7, this.roxl32, 2);
		case 0o263: // ROL.L #2,Dy
			return void this.rwop32(op & 7, this.rol32, 2);
		case 0o264: // ASL.L D2,Dy
			return void this.rwop32(op & 7, this.asl32, this.d2);
		case 0o265: // LSL.L D2,Dy
			return void this.rwop32(op & 7, this.lsl32, this.d2);
		case 0o266: // ROXL.L D2,Dy
			return void this.rwop32(op & 7, this.roxl32, this.d2);
		case 0o267: // ROL.L D2,Dy
			return void this.rwop32(op & 7, this.rol32, this.d2);
		case 0o272: // ROXL.W (An)
		case 0o273: // ROXL.W (An)+
		case 0o274: // ROXL.W -(An)
		case 0o275: // ROXL.W d(An)
		case 0o276: // ROXL.W d(An,Xi)
			return void this.rwop16(op, this.roxl16, 1);
		case 0o277: // ROXL.W Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.roxl16, 1);
		case 0o300: // ASR.B #3,Dy
			return void this.rwop8(op & 7, this.asr8, 3);
		case 0o301: // LSR.B #3,Dy
			return void this.rwop8(op & 7, this.lsr8, 3);
		case 0o302: // ROXR.B #3,Dy
			return void this.rwop8(op & 7, this.roxr8, 3);
		case 0o303: // ROR.B #3,Dy
			return void this.rwop8(op & 7, this.ror8, 3);
		case 0o304: // ASR.B D3,Dy
			return void this.rwop8(op & 7, this.asr8, this.d3);
		case 0o305: // LSR.B D3,Dy
			return void this.rwop8(op & 7, this.lsr8, this.d3);
		case 0o306: // ROXR.B D3,Dy
			return void this.rwop8(op & 7, this.roxr8, this.d3);
		case 0o307: // ROR.B D3,Dy
			return void this.rwop8(op & 7, this.ror8, this.d3);
		case 0o310: // ASR.W #3,Dy
			return void this.rwop16(op & 7, this.asr16, 3);
		case 0o311: // LSR.W #3,Dy
			return void this.rwop16(op & 7, this.lsr16, 3);
		case 0o312: // ROXR.W #3,Dy
			return void this.rwop16(op & 7, this.roxr16, 3);
		case 0o313: // ROR.W #3,Dy
			return void this.rwop16(op & 7, this.ror16, 3);
		case 0o314: // ASR.W D3,Dy
			return void this.rwop16(op & 7, this.asr16, this.d3);
		case 0o315: // LSR.W D3,Dy
			return void this.rwop16(op & 7, this.lsr16, this.d3);
		case 0o316: // ROXR.W D3,Dy
			return void this.rwop16(op & 7, this.roxr16, this.d3);
		case 0o317: // ROR.W D3,Dy
			return void this.rwop16(op & 7, this.ror16, this.d3);
		case 0o320: // ASR.L #3,Dy
			return void this.rwop32(op & 7, this.asr32, 3);
		case 0o321: // LSR.L #3,Dy
			return void this.rwop32(op & 7, this.lsr32, 3);
		case 0o322: // ROXR.L #3,Dy
			return void this.rwop32(op & 7, this.roxr32, 3);
		case 0o323: // ROR.L #3,Dy
			return void this.rwop32(op & 7, this.ror32, 3);
		case 0o324: // ASR.L D3,Dy
			return void this.rwop32(op & 7, this.asr32, this.d3);
		case 0o325: // LSR.L D3,Dy
			return void this.rwop32(op & 7, this.lsr32, this.d3);
		case 0o326: // ROXR.L D3,Dy
			return void this.rwop32(op & 7, this.roxr32, this.d3);
		case 0o327: // ROR.L D3,Dy
			return void this.rwop32(op & 7, this.ror32, this.d3);
		case 0o332: // ROR.W (An)
		case 0o333: // ROR.W (An)+
		case 0o334: // ROR.W -(An)
		case 0o335: // ROR.W d(An)
		case 0o336: // ROR.W d(An,Xi)
			return void this.rwop16(op, this.ror16, 1);
		case 0o337: // ROR.W Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.ror16, 1);
		case 0o340: // ASL.B #3,Dy
			return void this.rwop8(op & 7, this.asl8, 3);
		case 0o341: // LSL.B #3,Dy
			return void this.rwop8(op & 7, this.lsl8, 3);
		case 0o342: // ROXL.B #3,Dy
			return void this.rwop8(op & 7, this.roxl8, 3);
		case 0o343: // ROL.B #3,Dy
			return void this.rwop8(op & 7, this.rol8, 3);
		case 0o344: // ASL.B D3,Dy
			return void this.rwop8(op & 7, this.asl8, this.d3);
		case 0o345: // LSL.B D3,Dy
			return void this.rwop8(op & 7, this.lsl8, this.d3);
		case 0o346: // ROXL.B D3,Dy
			return void this.rwop8(op & 7, this.roxl8, this.d3);
		case 0o347: // ROL.B D3,Dy
			return void this.rwop8(op & 7, this.rol8, this.d3);
		case 0o350: // ASL.W #3,Dy
			return void this.rwop16(op & 7, this.asl16, 3);
		case 0o351: // LSL.W #3,Dy
			return void this.rwop16(op & 7, this.lsl16, 3);
		case 0o352: // ROXL.W #3,Dy
			return void this.rwop16(op & 7, this.roxl16, 3);
		case 0o353: // ROL.W #3,Dy
			return void this.rwop16(op & 7, this.rol16, 3);
		case 0o354: // ASL.W D3,Dy
			return void this.rwop16(op & 7, this.asl16, this.d3);
		case 0o355: // LSL.W D3,Dy
			return void this.rwop16(op & 7, this.lsl16, this.d3);
		case 0o356: // ROXL.W D3,Dy
			return void this.rwop16(op & 7, this.roxl16, this.d3);
		case 0o357: // ROL.W D3,Dy
			return void this.rwop16(op & 7, this.rol16, this.d3);
		case 0o360: // ASL.L #3,Dy
			return void this.rwop32(op & 7, this.asl32, 3);
		case 0o361: // LSL.L #3,Dy
			return void this.rwop32(op & 7, this.lsl32, 3);
		case 0o362: // ROXL.L #3,Dy
			return void this.rwop32(op & 7, this.roxl32, 3);
		case 0o363: // ROL.L #3,Dy
			return void this.rwop32(op & 7, this.rol32, 3);
		case 0o364: // ASL.L D3,Dy
			return void this.rwop32(op & 7, this.asl32, this.d3);
		case 0o365: // LSL.L D3,Dy
			return void this.rwop32(op & 7, this.lsl32, this.d3);
		case 0o366: // ROXL.L D3,Dy
			return void this.rwop32(op & 7, this.roxl32, this.d3);
		case 0o367: // ROL.L D3,Dy
			return void this.rwop32(op & 7, this.rol32, this.d3);
		case 0o372: // ROL.W (An)
		case 0o373: // ROL.W (An)+
		case 0o374: // ROL.W -(An)
		case 0o375: // ROL.W d(An)
		case 0o376: // ROL.W d(An,Xi)
			return void this.rwop16(op, this.rol16, 1);
		case 0o377: // ROL.W Abs...
			if ((op & 7) >= 2)
				return void this.exception(4);
			return void this.rwop16(op, this.rol16, 1);
		case 0o400: // ASR.B #4,Dy
			return void this.rwop8(op & 7, this.asr8, 4);
		case 0o401: // LSR.B #4,Dy
			return void this.rwop8(op & 7, this.lsr8, 4);
		case 0o402: // ROXR.B #4,Dy
			return void this.rwop8(op & 7, this.roxr8, 4);
		case 0o403: // ROR.B #4,Dy
			return void this.rwop8(op & 7, this.ror8, 4);
		case 0o404: // ASR.B D4,Dy
			return void this.rwop8(op & 7, this.asr8, this.d4);
		case 0o405: // LSR.B D4,Dy
			return void this.rwop8(op & 7, this.lsr8, this.d4);
		case 0o406: // ROXR.B D4,Dy
			return void this.rwop8(op & 7, this.roxr8, this.d4);
		case 0o407: // ROR.B D4,Dy
			return void this.rwop8(op & 7, this.ror8, this.d4);
		case 0o410: // ASR.W #4,Dy
			return void this.rwop16(op & 7, this.asr16, 4);
		case 0o411: // LSR.W #4,Dy
			return void this.rwop16(op & 7, this.lsr16, 4);
		case 0o412: // ROXR.W #4,Dy
			return void this.rwop16(op & 7, this.roxr16, 4);
		case 0o413: // ROR.W #4,Dy
			return void this.rwop16(op & 7, this.ror16, 4);
		case 0o414: // ASR.W D4,Dy
			return void this.rwop16(op & 7, this.asr16, this.d4);
		case 0o415: // LSR.W D4,Dy
			return void this.rwop16(op & 7, this.lsr16, this.d4);
		case 0o416: // ROXR.W D4,Dy
			return void this.rwop16(op & 7, this.roxr16, this.d4);
		case 0o417: // ROR.W D4,Dy
			return void this.rwop16(op & 7, this.ror16, this.d4);
		case 0o420: // ASR.L #4,Dy
			return void this.rwop32(op & 7, this.asr32, 4);
		case 0o421: // LSR.L #4,Dy
			return void this.rwop32(op & 7, this.lsr32, 4);
		case 0o422: // ROXR.L #4,Dy
			return void this.rwop32(op & 7, this.roxr32, 4);
		case 0o423: // ROR.L #4,Dy
			return void this.rwop32(op & 7, this.ror32, 4);
		case 0o424: // ASR.L D4,Dy
			return void this.rwop32(op & 7, this.asr32, this.d4);
		case 0o425: // LSR.L D4,Dy
			return void this.rwop32(op & 7, this.lsr32, this.d4);
		case 0o426: // ROXR.L D4,Dy
			return void this.rwop32(op & 7, this.roxr32, this.d4);
		case 0o427: // ROR.L D4,Dy
			return void this.rwop32(op & 7, this.ror32, this.d4);
		case 0o440: // ASL.B #4,Dy
			return void this.rwop8(op & 7, this.asl8, 4);
		case 0o441: // LSL.B #4,Dy
			return void this.rwop8(op & 7, this.lsl8, 4);
		case 0o442: // ROXL.B #4,Dy
			return void this.rwop8(op & 7, this.roxl8, 4);
		case 0o443: // ROL.B #4,Dy
			return void this.rwop8(op & 7, this.rol8, 4);
		case 0o444: // ASL.B D4,Dy
			return void this.rwop8(op & 7, this.asl8, this.d4);
		case 0o445: // LSL.B D4,Dy
			return void this.rwop8(op & 7, this.lsl8, this.d4);
		case 0o446: // ROXL.B D4,Dy
			return void this.rwop8(op & 7, this.roxl8, this.d4);
		case 0o447: // ROL.B D4,Dy
			return void this.rwop8(op & 7, this.rol8, this.d4);
		case 0o450: // ASL.W #4,Dy
			return void this.rwop16(op & 7, this.asl16, 4);
		case 0o451: // LSL.W #4,Dy
			return void this.rwop16(op & 7, this.lsl16, 4);
		case 0o452: // ROXL.W #4,Dy
			return void this.rwop16(op & 7, this.roxl16, 4);
		case 0o453: // ROL.W #4,Dy
			return void this.rwop16(op & 7, this.rol16, 4);
		case 0o454: // ASL.W D4,Dy
			return void this.rwop16(op & 7, this.asl16, this.d4);
		case 0o455: // LSL.W D4,Dy
			return void this.rwop16(op & 7, this.lsl16, this.d4);
		case 0o456: // ROXL.W D4,Dy
			return void this.rwop16(op & 7, this.roxl16, this.d4);
		case 0o457: // ROL.W D4,Dy
			return void this.rwop16(op & 7, this.rol16, this.d4);
		case 0o460: // ASL.L #4,Dy
			return void this.rwop32(op & 7, this.asl32, 4);
		case 0o461: // LSL.L #4,Dy
			return void this.rwop32(op & 7, this.lsl32, 4);
		case 0o462: // ROXL.L #4,Dy
			return void this.rwop32(op & 7, this.roxl32, 4);
		case 0o463: // ROL.L #4,Dy
			return void this.rwop32(op & 7, this.rol32, 4);
		case 0o464: // ASL.L D4,Dy
			return void this.rwop32(op & 7, this.asl32, this.d4);
		case 0o465: // LSL.L D4,Dy
			return void this.rwop32(op & 7, this.lsl32, this.d4);
		case 0o466: // ROXL.L D4,Dy
			return void this.rwop32(op & 7, this.roxl32, this.d4);
		case 0o467: // ROL.L D4,Dy
			return void this.rwop32(op & 7, this.rol32, this.d4);
		case 0o500: // ASR.B #5,Dy
			return void this.rwop8(op & 7, this.asr8, 5);
		case 0o501: // LSR.B #5,Dy
			return void this.rwop8(op & 7, this.lsr8, 5);
		case 0o502: // ROXR.B #5,Dy
			return void this.rwop8(op & 7, this.roxr8, 5);
		case 0o503: // ROR.B #5,Dy
			return void this.rwop8(op & 7, this.ror8, 5);
		case 0o504: // ASR.B D5,Dy
			return void this.rwop8(op & 7, this.asr8, this.d5);
		case 0o505: // LSR.B D5,Dy
			return void this.rwop8(op & 7, this.lsr8, this.d5);
		case 0o506: // ROXR.B D5,Dy
			return void this.rwop8(op & 7, this.roxr8, this.d5);
		case 0o507: // ROR.B D5,Dy
			return void this.rwop8(op & 7, this.ror8, this.d5);
		case 0o510: // ASR.W #5,Dy
			return void this.rwop16(op & 7, this.asr16, 5);
		case 0o511: // LSR.W #5,Dy
			return void this.rwop16(op & 7, this.lsr16, 5);
		case 0o512: // ROXR.W #5,Dy
			return void this.rwop16(op & 7, this.roxr16, 5);
		case 0o513: // ROR.W #5,Dy
			return void this.rwop16(op & 7, this.ror16, 5);
		case 0o514: // ASR.W D5,Dy
			return void this.rwop16(op & 7, this.asr16, this.d5);
		case 0o515: // LSR.W D5,Dy
			return void this.rwop16(op & 7, this.lsr16, this.d5);
		case 0o516: // ROXR.W D5,Dy
			return void this.rwop16(op & 7, this.roxr16, this.d5);
		case 0o517: // ROR.W D5,Dy
			return void this.rwop16(op & 7, this.ror16, this.d5);
		case 0o520: // ASR.L #5,Dy
			return void this.rwop32(op & 7, this.asr32, 5);
		case 0o521: // LSR.L #5,Dy
			return void this.rwop32(op & 7, this.lsr32, 5);
		case 0o522: // ROXR.L #5,Dy
			return void this.rwop32(op & 7, this.roxr32, 5);
		case 0o523: // ROR.L #5,Dy
			return void this.rwop32(op & 7, this.ror32, 5);
		case 0o524: // ASR.L D5,Dy
			return void this.rwop32(op & 7, this.asr32, this.d5);
		case 0o525: // LSR.L D5,Dy
			return void this.rwop32(op & 7, this.lsr32, this.d5);
		case 0o526: // ROXR.L D5,Dy
			return void this.rwop32(op & 7, this.roxr32, this.d5);
		case 0o527: // ROR.L D5,Dy
			return void this.rwop32(op & 7, this.ror32, this.d5);
		case 0o540: // ASL.B #5,Dy
			return void this.rwop8(op & 7, this.asl8, 5);
		case 0o541: // LSL.B #5,Dy
			return void this.rwop8(op & 7, this.lsl8, 5);
		case 0o542: // ROXL.B #5,Dy
			return void this.rwop8(op & 7, this.roxl8, 5);
		case 0o543: // ROL.B #5,Dy
			return void this.rwop8(op & 7, this.rol8, 5);
		case 0o544: // ASL.B D5,Dy
			return void this.rwop8(op & 7, this.asl8, this.d5);
		case 0o545: // LSL.B D5,Dy
			return void this.rwop8(op & 7, this.lsl8, this.d5);
		case 0o546: // ROXL.B D5,Dy
			return void this.rwop8(op & 7, this.roxl8, this.d5);
		case 0o547: // ROL.B D5,Dy
			return void this.rwop8(op & 7, this.rol8, this.d5);
		case 0o550: // ASL.W #5,Dy
			return void this.rwop16(op & 7, this.asl16, 5);
		case 0o551: // LSL.W #5,Dy
			return void this.rwop16(op & 7, this.lsl16, 5);
		case 0o552: // ROXL.W #5,Dy
			return void this.rwop16(op & 7, this.roxl16, 5);
		case 0o553: // ROL.W #5,Dy
			return void this.rwop16(op & 7, this.rol16, 5);
		case 0o554: // ASL.W D5,Dy
			return void this.rwop16(op & 7, this.asl16, this.d5);
		case 0o555: // LSL.W D5,Dy
			return void this.rwop16(op & 7, this.lsl16, this.d5);
		case 0o556: // ROXL.W D5,Dy
			return void this.rwop16(op & 7, this.roxl16, this.d5);
		case 0o557: // ROL.W D5,Dy
			return void this.rwop16(op & 7, this.rol16, this.d5);
		case 0o560: // ASL.L #5,Dy
			return void this.rwop32(op & 7, this.asl32, 5);
		case 0o561: // LSL.L #5,Dy
			return void this.rwop32(op & 7, this.lsl32, 5);
		case 0o562: // ROXL.L #5,Dy
			return void this.rwop32(op & 7, this.roxl32, 5);
		case 0o563: // ROL.L #5,Dy
			return void this.rwop32(op & 7, this.rol32, 5);
		case 0o564: // ASL.L D5,Dy
			return void this.rwop32(op & 7, this.asl32, this.d5);
		case 0o565: // LSL.L D5,Dy
			return void this.rwop32(op & 7, this.lsl32, this.d5);
		case 0o566: // ROXL.L D5,Dy
			return void this.rwop32(op & 7, this.roxl32, this.d5);
		case 0o567: // ROL.L D5,Dy
			return void this.rwop32(op & 7, this.rol32, this.d5);
		case 0o600: // ASR.B #6,Dy
			return void this.rwop8(op & 7, this.asr8, 6);
		case 0o601: // LSR.B #6,Dy
			return void this.rwop8(op & 7, this.lsr8, 6);
		case 0o602: // ROXR.B #6,Dy
			return void this.rwop8(op & 7, this.roxr8, 6);
		case 0o603: // ROR.B #6,Dy
			return void this.rwop8(op & 7, this.ror8, 6);
		case 0o604: // ASR.B D6,Dy
			return void this.rwop8(op & 7, this.asr8, this.d6);
		case 0o605: // LSR.B D6,Dy
			return void this.rwop8(op & 7, this.lsr8, this.d6);
		case 0o606: // ROXR.B D6,Dy
			return void this.rwop8(op & 7, this.roxr8, this.d6);
		case 0o607: // ROR.B D6,Dy
			return void this.rwop8(op & 7, this.ror8, this.d6);
		case 0o610: // ASR.W #6,Dy
			return void this.rwop16(op & 7, this.asr16, 6);
		case 0o611: // LSR.W #6,Dy
			return void this.rwop16(op & 7, this.lsr16, 6);
		case 0o612: // ROXR.W #6,Dy
			return void this.rwop16(op & 7, this.roxr16, 6);
		case 0o613: // ROR.W #6,Dy
			return void this.rwop16(op & 7, this.ror16, 6);
		case 0o614: // ASR.W D6,Dy
			return void this.rwop16(op & 7, this.asr16, this.d6);
		case 0o615: // LSR.W D6,Dy
			return void this.rwop16(op & 7, this.lsr16, this.d6);
		case 0o616: // ROXR.W D6,Dy
			return void this.rwop16(op & 7, this.roxr16, this.d6);
		case 0o617: // ROR.W D6,Dy
			return void this.rwop16(op & 7, this.ror16, this.d6);
		case 0o620: // ASR.L #6,Dy
			return void this.rwop32(op & 7, this.asr32, 6);
		case 0o621: // LSR.L #6,Dy
			return void this.rwop32(op & 7, this.lsr32, 6);
		case 0o622: // ROXR.L #6,Dy
			return void this.rwop32(op & 7, this.roxr32, 6);
		case 0o623: // ROR.L #6,Dy
			return void this.rwop32(op & 7, this.ror32, 6);
		case 0o624: // ASR.L D6,Dy
			return void this.rwop32(op & 7, this.asr32, this.d6);
		case 0o625: // LSR.L D6,Dy
			return void this.rwop32(op & 7, this.lsr32, this.d6);
		case 0o626: // ROXR.L D6,Dy
			return void this.rwop32(op & 7, this.roxr32, this.d6);
		case 0o627: // ROR.L D6,Dy
			return void this.rwop32(op & 7, this.ror32, this.d6);
		case 0o640: // ASL.B #6,Dy
			return void this.rwop8(op & 7, this.asl8, 6);
		case 0o641: // LSL.B #6,Dy
			return void this.rwop8(op & 7, this.lsl8, 6);
		case 0o642: // ROXL.B #6,Dy
			return void this.rwop8(op & 7, this.roxl8, 6);
		case 0o643: // ROL.B #6,Dy
			return void this.rwop8(op & 7, this.rol8, 6);
		case 0o644: // ASL.B D6,Dy
			return void this.rwop8(op & 7, this.asl8, this.d6);
		case 0o645: // LSL.B D6,Dy
			return void this.rwop8(op & 7, this.lsl8, this.d6);
		case 0o646: // ROXL.B D6,Dy
			return void this.rwop8(op & 7, this.roxl8, this.d6);
		case 0o647: // ROL.B D6,Dy
			return void this.rwop8(op & 7, this.rol8, this.d6);
		case 0o650: // ASL.W #6,Dy
			return void this.rwop16(op & 7, this.asl16, 6);
		case 0o651: // LSL.W #6,Dy
			return void this.rwop16(op & 7, this.lsl16, 6);
		case 0o652: // ROXL.W #6,Dy
			return void this.rwop16(op & 7, this.roxl16, 6);
		case 0o653: // ROL.W #6,Dy
			return void this.rwop16(op & 7, this.rol16, 6);
		case 0o654: // ASL.W D6,Dy
			return void this.rwop16(op & 7, this.asl16, this.d6);
		case 0o655: // LSL.W D6,Dy
			return void this.rwop16(op & 7, this.lsl16, this.d6);
		case 0o656: // ROXL.W D6,Dy
			return void this.rwop16(op & 7, this.roxl16, this.d6);
		case 0o657: // ROL.W D6,Dy
			return void this.rwop16(op & 7, this.rol16, this.d6);
		case 0o660: // ASL.L #6,Dy
			return void this.rwop32(op & 7, this.asl32, 6);
		case 0o661: // LSL.L #6,Dy
			return void this.rwop32(op & 7, this.lsl32, 6);
		case 0o662: // ROXL.L #6,Dy
			return void this.rwop32(op & 7, this.roxl32, 6);
		case 0o663: // ROL.L #6,Dy
			return void this.rwop32(op & 7, this.rol32, 6);
		case 0o664: // ASL.L D6,Dy
			return void this.rwop32(op & 7, this.asl32, this.d6);
		case 0o665: // LSL.L D6,Dy
			return void this.rwop32(op & 7, this.lsl32, this.d6);
		case 0o666: // ROXL.L D6,Dy
			return void this.rwop32(op & 7, this.roxl32, this.d6);
		case 0o667: // ROL.L D6,Dy
			return void this.rwop32(op & 7, this.rol32, this.d6);
		case 0o700: // ASR.B #7,Dy
			return void this.rwop8(op & 7, this.asr8, 7);
		case 0o701: // LSR.B #7,Dy
			return void this.rwop8(op & 7, this.lsr8, 7);
		case 0o702: // ROXR.B #7,Dy
			return void this.rwop8(op & 7, this.roxr8, 7);
		case 0o703: // ROR.B #7,Dy
			return void this.rwop8(op & 7, this.ror8, 7);
		case 0o704: // ASR.B D7,Dy
			return void this.rwop8(op & 7, this.asr8, this.d7);
		case 0o705: // LSR.B D7,Dy
			return void this.rwop8(op & 7, this.lsr8, this.d7);
		case 0o706: // ROXR.B D7,Dy
			return void this.rwop8(op & 7, this.roxr8, this.d7);
		case 0o707: // ROR.B D7,Dy
			return void this.rwop8(op & 7, this.ror8, this.d7);
		case 0o710: // ASR.W #7,Dy
			return void this.rwop16(op & 7, this.asr16, 7);
		case 0o711: // LSR.W #7,Dy
			return void this.rwop16(op & 7, this.lsr16, 7);
		case 0o712: // ROXR.W #7,Dy
			return void this.rwop16(op & 7, this.roxr16, 7);
		case 0o713: // ROR.W #7,Dy
			return void this.rwop16(op & 7, this.ror16, 7);
		case 0o714: // ASR.W D7,Dy
			return void this.rwop16(op & 7, this.asr16, this.d7);
		case 0o715: // LSR.W D7,Dy
			return void this.rwop16(op & 7, this.lsr16, this.d7);
		case 0o716: // ROXR.W D7,Dy
			return void this.rwop16(op & 7, this.roxr16, this.d7);
		case 0o717: // ROR.W D7,Dy
			return void this.rwop16(op & 7, this.ror16, this.d7);
		case 0o720: // ASR.L #7,Dy
			return void this.rwop32(op & 7, this.asr32, 7);
		case 0o721: // LSR.L #7,Dy
			return void this.rwop32(op & 7, this.lsr32, 7);
		case 0o722: // ROXR.L #7,Dy
			return void this.rwop32(op & 7, this.roxr32, 7);
		case 0o723: // ROR.L #7,Dy
			return void this.rwop32(op & 7, this.ror32, 7);
		case 0o724: // ASR.L D7,Dy
			return void this.rwop32(op & 7, this.asr32, this.d7);
		case 0o725: // LSR.L D7,Dy
			return void this.rwop32(op & 7, this.lsr32, this.d7);
		case 0o726: // ROXR.L D7,Dy
			return void this.rwop32(op & 7, this.roxr32, this.d7);
		case 0o727: // ROR.L D7,Dy
			return void this.rwop32(op & 7, this.ror32, this.d7);
		case 0o740: // ASL.B #7,Dy
			return void this.rwop8(op & 7, this.asl8, 7);
		case 0o741: // LSL.B #7,Dy
			return void this.rwop8(op & 7, this.lsl8, 7);
		case 0o742: // ROXL.B #7,Dy
			return void this.rwop8(op & 7, this.roxl8, 7);
		case 0o743: // ROL.B #7,Dy
			return void this.rwop8(op & 7, this.rol8, 7);
		case 0o744: // ASL.B D7,Dy
			return void this.rwop8(op & 7, this.asl8, this.d7);
		case 0o745: // LSL.B D7,Dy
			return void this.rwop8(op & 7, this.lsl8, this.d7);
		case 0o746: // ROXL.B D7,Dy
			return void this.rwop8(op & 7, this.roxl8, this.d7);
		case 0o747: // ROL.B D7,Dy
			return void this.rwop8(op & 7, this.rol8, this.d7);
		case 0o750: // ASL.W #7,Dy
			return void this.rwop16(op & 7, this.asl16, 7);
		case 0o751: // LSL.W #7,Dy
			return void this.rwop16(op & 7, this.lsl16, 7);
		case 0o752: // ROXL.W #7,Dy
			return void this.rwop16(op & 7, this.roxl16, 7);
		case 0o753: // ROL.W #7,Dy
			return void this.rwop16(op & 7, this.rol16, 7);
		case 0o754: // ASL.W D7,Dy
			return void this.rwop16(op & 7, this.asl16, this.d7);
		case 0o755: // LSL.W D7,Dy
			return void this.rwop16(op & 7, this.lsl16, this.d7);
		case 0o756: // ROXL.W D7,Dy
			return void this.rwop16(op & 7, this.roxl16, this.d7);
		case 0o757: // ROL.W D7,Dy
			return void this.rwop16(op & 7, this.rol16, this.d7);
		case 0o760: // ASL.L #7,Dy
			return void this.rwop32(op & 7, this.asl32, 7);
		case 0o761: // LSL.L #7,Dy
			return void this.rwop32(op & 7, this.lsl32, 7);
		case 0o762: // ROXL.L #7,Dy
			return void this.rwop32(op & 7, this.roxl32, 7);
		case 0o763: // ROL.L #7,Dy
			return void this.rwop32(op & 7, this.rol32, 7);
		case 0o764: // ASL.L D7,Dy
			return void this.rwop32(op & 7, this.asl32, this.d7);
		case 0o765: // LSL.L D7,Dy
			return void this.rwop32(op & 7, this.lsl32, this.d7);
		case 0o766: // ROXL.L D7,Dy
			return void this.rwop32(op & 7, this.roxl32, this.d7);
		case 0o767: // ROL.L D7,Dy
			return void this.rwop32(op & 7, this.rol32, this.d7);
		default:
			return void this.exception(4);
		}
	}

	rwop8(op, fn, src) {
		let ea;

		switch(op & 0o77) {
		case 0o00: // B D0
			return void(this.d0 = this.d0 & ~0xff | fn.call(this, src, this.d0 & 0xff));
		case 0o01: // B D1
			return void(this.d1 = this.d1 & ~0xff | fn.call(this, src, this.d1 & 0xff));
		case 0o02: // B D2
			return void(this.d2 = this.d2 & ~0xff | fn.call(this, src, this.d2 & 0xff));
		case 0o03: // B D3
			return void(this.d3 = this.d3 & ~0xff | fn.call(this, src, this.d3 & 0xff));
		case 0o04: // B D4
			return void(this.d4 = this.d4 & ~0xff | fn.call(this, src, this.d4 & 0xff));
		case 0o05: // B D5
			return void(this.d5 = this.d5 & ~0xff | fn.call(this, src, this.d5 & 0xff));
		case 0o06: // B D6
			return void(this.d6 = this.d6 & ~0xff | fn.call(this, src, this.d6 & 0xff));
		case 0o07: // B D7
			return void(this.d7 = this.d7 & ~0xff | fn.call(this, src, this.d7 & 0xff));
		case 0o20: // B (A0)
			return void this.write8(fn.call(this, src, this.read8(this.a0)), this.a0);
		case 0o21: // B (A1)
			return void this.write8(fn.call(this, src, this.read8(this.a1)), this.a1);
		case 0o22: // B (A2)
			return void this.write8(fn.call(this, src, this.read8(this.a2)), this.a2);
		case 0o23: // B (A3)
			return void this.write8(fn.call(this, src, this.read8(this.a3)), this.a3);
		case 0o24: // B (A4)
			return void this.write8(fn.call(this, src, this.read8(this.a4)), this.a4);
		case 0o25: // B (A5)
			return void this.write8(fn.call(this, src, this.read8(this.a5)), this.a5);
		case 0o26: // B (A6)
			return void this.write8(fn.call(this, src, this.read8(this.a6)), this.a6);
		case 0o27: // B (A7)
			return void this.write8(fn.call(this, src, this.read8(this.a7)), this.a7);
		case 0o30: // B (A0)+
			this.write8(fn.call(this, src, this.read8(this.a0)), this.a0);
			return void(this.a0 = this.a0 + 1 | 0);
		case 0o31: // B (A1)+
			this.write8(fn.call(this, src, this.read8(this.a1)), this.a1);
			return void(this.a1 = this.a1 + 1 | 0);
		case 0o32: // B (A2)+
			this.write8(fn.call(this, src, this.read8(this.a2)), this.a2);
			return void(this.a2 = this.a2 + 1 | 0);
		case 0o33: // B (A3)+
			this.write8(fn.call(this, src, this.read8(this.a3)), this.a3);
			return void(this.a3 = this.a3 + 1 | 0);
		case 0o34: // B (A4)+
			this.write8(fn.call(this, src, this.read8(this.a4)), this.a4);
			return void(this.a4 = this.a4 + 1 | 0);
		case 0o35: // B (A5)+
			this.write8(fn.call(this, src, this.read8(this.a5)), this.a5);
			return void(this.a5 = this.a5 + 1 | 0);
		case 0o36: // B (A6)+
			this.write8(fn.call(this, src, this.read8(this.a6)), this.a6);
			return void(this.a6 = this.a6 + 1 | 0);
		case 0o37: // B (A7)+
			this.write8(fn.call(this, src, this.read8(this.a7)), this.a7);
			return void(this.a7 = this.a7 + 1 | 0);
		case 0o40: // B -(A0)
			return void this.write8(fn.call(this, src, this.read8(this.a0 = this.a0 - 1 | 0)), this.a0);
		case 0o41: // B -(A1)
			return void this.write8(fn.call(this, src, this.read8(this.a1 = this.a1 - 1 | 0)), this.a1);
		case 0o42: // B -(A2)
			return void this.write8(fn.call(this, src, this.read8(this.a2 = this.a2 - 1 | 0)), this.a2);
		case 0o43: // B -(A3)
			return void this.write8(fn.call(this, src, this.read8(this.a3 = this.a3 - 1 | 0)), this.a3);
		case 0o44: // B -(A4)
			return void this.write8(fn.call(this, src, this.read8(this.a4 = this.a4 - 1 | 0)), this.a4);
		case 0o45: // B -(A5)
			return void this.write8(fn.call(this, src, this.read8(this.a5 = this.a5 - 1 | 0)), this.a5);
		case 0o46: // B -(A6)
			return void this.write8(fn.call(this, src, this.read8(this.a6 = this.a6 - 1 | 0)), this.a6);
		case 0o47: // B -(A7)
			return void this.write8(fn.call(this, src, this.read8(this.a7 = this.a7 - 1 | 0)), this.a7);
		case 0o50: // B d(A0)
			return void this.write8(fn.call(this, src, this.read8(ea = this.a0 + this.fetch16s() | 0)), ea);
		case 0o51: // B d(A1)
			return void this.write8(fn.call(this, src, this.read8(ea = this.a1 + this.fetch16s() | 0)), ea);
		case 0o52: // B d(A2)
			return void this.write8(fn.call(this, src, this.read8(ea = this.a2 + this.fetch16s() | 0)), ea);
		case 0o53: // B d(A3)
			return void this.write8(fn.call(this, src, this.read8(ea = this.a3 + this.fetch16s() | 0)), ea);
		case 0o54: // B d(A4)
			return void this.write8(fn.call(this, src, this.read8(ea = this.a4 + this.fetch16s() | 0)), ea);
		case 0o55: // B d(A5)
			return void this.write8(fn.call(this, src, this.read8(ea = this.a5 + this.fetch16s() | 0)), ea);
		case 0o56: // B d(A6)
			return void this.write8(fn.call(this, src, this.read8(ea = this.a6 + this.fetch16s() | 0)), ea);
		case 0o57: // B d(A7)
			return void this.write8(fn.call(this, src, this.read8(ea = this.a7 + this.fetch16s() | 0)), ea);
		case 0o60: // B d(A0,Xi)
			return void this.write8(fn.call(this, src, this.read8(ea = this.index(this.a0))), ea);
		case 0o61: // B d(A1,Xi)
			return void this.write8(fn.call(this, src, this.read8(ea = this.index(this.a1))), ea);
		case 0o62: // B d(A2,Xi)
			return void this.write8(fn.call(this, src, this.read8(ea = this.index(this.a2))), ea);
		case 0o63: // B d(A3,Xi)
			return void this.write8(fn.call(this, src, this.read8(ea = this.index(this.a3))), ea);
		case 0o64: // B d(A4,Xi)
			return void this.write8(fn.call(this, src, this.read8(ea = this.index(this.a4))), ea);
		case 0o65: // B d(A5,Xi)
			return void this.write8(fn.call(this, src, this.read8(ea = this.index(this.a5))), ea);
		case 0o66: // B d(A6,Xi)
			return void this.write8(fn.call(this, src, this.read8(ea = this.index(this.a6))), ea);
		case 0o67: // B d(A7,Xi)
			return void this.write8(fn.call(this, src, this.read8(ea = this.index(this.a7))), ea);
		case 0o70: // B Abs.W
			return void this.write8(fn.call(this, src, this.read8(ea = this.fetch16s())), ea);
		case 0o71: // B Abs.L
			return void this.write8(fn.call(this, src, this.read8(ea = this.fetch32())), ea);
		}
	}

	rwop16(op, fn, src) {
		let ea;

		switch(op & 0o77) {
		case 0o00: // W D0
			return void(this.d0 = this.d0 & ~0xffff | fn.call(this, src, this.d0 & 0xffff));
		case 0o01: // W D1
			return void(this.d1 = this.d1 & ~0xffff | fn.call(this, src, this.d1 & 0xffff));
		case 0o02: // W D2
			return void(this.d2 = this.d2 & ~0xffff | fn.call(this, src, this.d2 & 0xffff));
		case 0o03: // W D3
			return void(this.d3 = this.d3 & ~0xffff | fn.call(this, src, this.d3 & 0xffff));
		case 0o04: // W D4
			return void(this.d4 = this.d4 & ~0xffff | fn.call(this, src, this.d4 & 0xffff));
		case 0o05: // W D5
			return void(this.d5 = this.d5 & ~0xffff | fn.call(this, src, this.d5 & 0xffff));
		case 0o06: // W D6
			return void(this.d6 = this.d6 & ~0xffff | fn.call(this, src, this.d6 & 0xffff));
		case 0o07: // W D7
			return void(this.d7 = this.d7 & ~0xffff | fn.call(this, src, this.d7 & 0xffff));
		case 0o10: // W A0
			return void(this.a0 = fn.call(this, src, this.a0));
		case 0o11: // W A1
			return void(this.a1 = fn.call(this, src, this.a1));
		case 0o12: // W A2
			return void(this.a2 = fn.call(this, src, this.a2));
		case 0o13: // W A3
			return void(this.a3 = fn.call(this, src, this.a3));
		case 0o14: // W A4
			return void(this.a4 = fn.call(this, src, this.a4));
		case 0o15: // W A5
			return void(this.a5 = fn.call(this, src, this.a5));
		case 0o16: // W A6
			return void(this.a6 = fn.call(this, src, this.a6));
		case 0o17: // W A7
			return void(this.a7 = fn.call(this, src, this.a7));
		case 0o20: // W (A0)
			return void this.write16(fn.call(this, src, this.read16(this.a0)), this.a0);
		case 0o21: // W (A1)
			return void this.write16(fn.call(this, src, this.read16(this.a1)), this.a1);
		case 0o22: // W (A2)
			return void this.write16(fn.call(this, src, this.read16(this.a2)), this.a2);
		case 0o23: // W (A3)
			return void this.write16(fn.call(this, src, this.read16(this.a3)), this.a3);
		case 0o24: // W (A4)
			return void this.write16(fn.call(this, src, this.read16(this.a4)), this.a4);
		case 0o25: // W (A5)
			return void this.write16(fn.call(this, src, this.read16(this.a5)), this.a5);
		case 0o26: // W (A6)
			return void this.write16(fn.call(this, src, this.read16(this.a6)), this.a6);
		case 0o27: // W (A7)
			return void this.write16(fn.call(this, src, this.read16(this.a7)), this.a7);
		case 0o30: // W (A0)+
			this.write16(fn.call(this, src, this.read16(this.a0)), this.a0);
			return void(this.a0 = this.a0 + 2 | 0);
		case 0o31: // W (A1)+
			this.write16(fn.call(this, src, this.read16(this.a1)), this.a1);
			return void(this.a1 = this.a1 + 2 | 0);
		case 0o32: // W (A2)+
			this.write16(fn.call(this, src, this.read16(this.a2)), this.a2);
			return void(this.a2 = this.a2 + 2 | 0);
		case 0o33: // W (A3)+
			this.write16(fn.call(this, src, this.read16(this.a3)), this.a3);
			return void(this.a3 = this.a3 + 2 | 0);
		case 0o34: // W (A4)+
			this.write16(fn.call(this, src, this.read16(this.a4)), this.a4);
			return void(this.a4 = this.a4 + 2 | 0);
		case 0o35: // W (A5)+
			this.write16(fn.call(this, src, this.read16(this.a5)), this.a5);
			return void(this.a5 = this.a5 + 2 | 0);
		case 0o36: // W (A6)+
			this.write16(fn.call(this, src, this.read16(this.a6)), this.a6);
			return void(this.a6 = this.a6 + 2 | 0);
		case 0o37: // W (A7)+
			this.write16(fn.call(this, src, this.read16(this.a7)), this.a7);
			return void(this.a7 = this.a7 + 2 | 0);
		case 0o40: // W -(A0)
			return void this.write16(fn.call(this, src, this.read16(this.a0 = this.a0 - 2 | 0)), this.a0);
		case 0o41: // W -(A1)
			return void this.write16(fn.call(this, src, this.read16(this.a1 = this.a1 - 2 | 0)), this.a1);
		case 0o42: // W -(A2)
			return void this.write16(fn.call(this, src, this.read16(this.a2 = this.a2 - 2 | 0)), this.a2);
		case 0o43: // W -(A3)
			return void this.write16(fn.call(this, src, this.read16(this.a3 = this.a3 - 2 | 0)), this.a3);
		case 0o44: // W -(A4)
			return void this.write16(fn.call(this, src, this.read16(this.a4 = this.a4 - 2 | 0)), this.a4);
		case 0o45: // W -(A5)
			return void this.write16(fn.call(this, src, this.read16(this.a5 = this.a5 - 2 | 0)), this.a5);
		case 0o46: // W -(A6)
			return void this.write16(fn.call(this, src, this.read16(this.a6 = this.a6 - 2 | 0)), this.a6);
		case 0o47: // W -(A7)
			return void this.write16(fn.call(this, src, this.read16(this.a7 = this.a7 - 2 | 0)), this.a7);
		case 0o50: // W d(A0)
			return void this.write16(fn.call(this, src, this.read16(ea = this.a0 + this.fetch16s() | 0)), ea);
		case 0o51: // W d(A1)
			return void this.write16(fn.call(this, src, this.read16(ea = this.a1 + this.fetch16s() | 0)), ea);
		case 0o52: // W d(A2)
			return void this.write16(fn.call(this, src, this.read16(ea = this.a2 + this.fetch16s() | 0)), ea);
		case 0o53: // W d(A3)
			return void this.write16(fn.call(this, src, this.read16(ea = this.a3 + this.fetch16s() | 0)), ea);
		case 0o54: // W d(A4)
			return void this.write16(fn.call(this, src, this.read16(ea = this.a4 + this.fetch16s() | 0)), ea);
		case 0o55: // W d(A5)
			return void this.write16(fn.call(this, src, this.read16(ea = this.a5 + this.fetch16s() | 0)), ea);
		case 0o56: // W d(A6)
			return void this.write16(fn.call(this, src, this.read16(ea = this.a6 + this.fetch16s() | 0)), ea);
		case 0o57: // W d(A7)
			return void this.write16(fn.call(this, src, this.read16(ea = this.a7 + this.fetch16s() | 0)), ea);
		case 0o60: // W d(A0,Xi)
			return void this.write16(fn.call(this, src, this.read16(ea = this.index(this.a0))), ea);
		case 0o61: // W d(A1,Xi)
			return void this.write16(fn.call(this, src, this.read16(ea = this.index(this.a1))), ea);
		case 0o62: // W d(A2,Xi)
			return void this.write16(fn.call(this, src, this.read16(ea = this.index(this.a2))), ea);
		case 0o63: // W d(A3,Xi)
			return void this.write16(fn.call(this, src, this.read16(ea = this.index(this.a3))), ea);
		case 0o64: // W d(A4,Xi)
			return void this.write16(fn.call(this, src, this.read16(ea = this.index(this.a4))), ea);
		case 0o65: // W d(A5,Xi)
			return void this.write16(fn.call(this, src, this.read16(ea = this.index(this.a5))), ea);
		case 0o66: // W d(A6,Xi)
			return void this.write16(fn.call(this, src, this.read16(ea = this.index(this.a6))), ea);
		case 0o67: // W d(A7,Xi)
			return void this.write16(fn.call(this, src, this.read16(ea = this.index(this.a7))), ea);
		case 0o70: // W Abs.W
			return void this.write16(fn.call(this, src, this.read16(ea = this.fetch16s())), ea);
		case 0o71: // W Abs.L
			return void this.write16(fn.call(this, src, this.read16(ea = this.fetch32())), ea);
		}
	}

	rwop32(op, fn, src) {
		let ea;

		switch(op & 0o77) {
		case 0o00: // L D0
			return void(this.d0 = fn.call(this, src, this.d0));
		case 0o01: // L D1
			return void(this.d1 = fn.call(this, src, this.d1));
		case 0o02: // L D2
			return void(this.d2 = fn.call(this, src, this.d2));
		case 0o03: // L D3
			return void(this.d3 = fn.call(this, src, this.d3));
		case 0o04: // L D4
			return void(this.d4 = fn.call(this, src, this.d4));
		case 0o05: // L D5
			return void(this.d5 = fn.call(this, src, this.d5));
		case 0o06: // L D6
			return void(this.d6 = fn.call(this, src, this.d6));
		case 0o07: // L D7
			return void(this.d7 = fn.call(this, src, this.d7));
		case 0o10: // L A0
			return void(this.a0 = fn.call(this, src, this.a0));
		case 0o11: // L A1
			return void(this.a1 = fn.call(this, src, this.a1));
		case 0o12: // L A2
			return void(this.a2 = fn.call(this, src, this.a2));
		case 0o13: // L A3
			return void(this.a3 = fn.call(this, src, this.a3));
		case 0o14: // L A4
			return void(this.a4 = fn.call(this, src, this.a4));
		case 0o15: // L A5
			return void(this.a5 = fn.call(this, src, this.a5));
		case 0o16: // L A6
			return void(this.a6 = fn.call(this, src, this.a6));
		case 0o17: // L A7
			return void(this.a7 = fn.call(this, src, this.a7));
		case 0o20: // L (A0)
			return void this.write32(fn.call(this, src, this.read32(this.a0)), this.a0);
		case 0o21: // L (A1)
			return void this.write32(fn.call(this, src, this.read32(this.a1)), this.a1);
		case 0o22: // L (A2)
			return void this.write32(fn.call(this, src, this.read32(this.a2)), this.a2);
		case 0o23: // L (A3)
			return void this.write32(fn.call(this, src, this.read32(this.a3)), this.a3);
		case 0o24: // L (A4)
			return void this.write32(fn.call(this, src, this.read32(this.a4)), this.a4);
		case 0o25: // L (A5)
			return void this.write32(fn.call(this, src, this.read32(this.a5)), this.a5);
		case 0o26: // L (A6)
			return void this.write32(fn.call(this, src, this.read32(this.a6)), this.a6);
		case 0o27: // L (A7)
			return void this.write32(fn.call(this, src, this.read32(this.a7)), this.a7);
		case 0o30: // L (A0)+
			this.write32(fn.call(this, src, this.read32(this.a0)), this.a0);
			return void(this.a0 = this.a0 + 4 | 0);
		case 0o31: // L (A1)+
			this.write32(fn.call(this, src, this.read32(this.a1)), this.a1);
			return void(this.a1 = this.a1 + 4 | 0);
		case 0o32: // L (A2)+
			this.write32(fn.call(this, src, this.read32(this.a2)), this.a2);
			return void(this.a2 = this.a2 + 4 | 0);
		case 0o33: // L (A3)+
			this.write32(fn.call(this, src, this.read32(this.a3)), this.a3);
			return void(this.a3 = this.a3 + 4 | 0);
		case 0o34: // L (A4)+
			this.write32(fn.call(this, src, this.read32(this.a4)), this.a4);
			return void(this.a4 = this.a4 + 4 | 0);
		case 0o35: // L (A5)+
			this.write32(fn.call(this, src, this.read32(this.a5)), this.a5);
			return void(this.a5 = this.a5 + 4 | 0);
		case 0o36: // L (A6)+
			this.write32(fn.call(this, src, this.read32(this.a6)), this.a6);
			return void(this.a6 = this.a6 + 4 | 0);
		case 0o37: // L (A7)+
			this.write32(fn.call(this, src, this.read32(this.a7)), this.a7);
			return void(this.a7 = this.a7 + 4 | 0);
		case 0o40: // L -(A0)
			return void this.write32(fn.call(this, src, this.read32(this.a0 = this.a0 - 4 | 0)), this.a0);
		case 0o41: // L -(A1)
			return void this.write32(fn.call(this, src, this.read32(this.a1 = this.a1 - 4 | 0)), this.a1);
		case 0o42: // L -(A2)
			return void this.write32(fn.call(this, src, this.read32(this.a2 = this.a2 - 4 | 0)), this.a2);
		case 0o43: // L -(A3)
			return void this.write32(fn.call(this, src, this.read32(this.a3 = this.a3 - 4 | 0)), this.a3);
		case 0o44: // L -(A4)
			return void this.write32(fn.call(this, src, this.read32(this.a4 = this.a4 - 4 | 0)), this.a4);
		case 0o45: // L -(A5)
			return void this.write32(fn.call(this, src, this.read32(this.a5 = this.a5 - 4 | 0)), this.a5);
		case 0o46: // L -(A6)
			return void this.write32(fn.call(this, src, this.read32(this.a6 = this.a6 - 4 | 0)), this.a6);
		case 0o47: // L -(A7)
			return void this.write32(fn.call(this, src, this.read32(this.a7 = this.a7 - 4 | 0)), this.a7);
		case 0o50: // L d(A0)
			return void this.write32(fn.call(this, src, this.read32(ea = this.a0 + this.fetch16s() | 0)), ea);
		case 0o51: // L d(A1)
			return void this.write32(fn.call(this, src, this.read32(ea = this.a1 + this.fetch16s() | 0)), ea);
		case 0o52: // L d(A2)
			return void this.write32(fn.call(this, src, this.read32(ea = this.a2 + this.fetch16s() | 0)), ea);
		case 0o53: // L d(A3)
			return void this.write32(fn.call(this, src, this.read32(ea = this.a3 + this.fetch16s() | 0)), ea);
		case 0o54: // L d(A4)
			return void this.write32(fn.call(this, src, this.read32(ea = this.a4 + this.fetch16s() | 0)), ea);
		case 0o55: // L d(A5)
			return void this.write32(fn.call(this, src, this.read32(ea = this.a5 + this.fetch16s() | 0)), ea);
		case 0o56: // L d(A6)
			return void this.write32(fn.call(this, src, this.read32(ea = this.a6 + this.fetch16s() | 0)), ea);
		case 0o57: // L d(A7)
			return void this.write32(fn.call(this, src, this.read32(ea = this.a7 + this.fetch16s() | 0)), ea);
		case 0o60: // L d(A0,Xi)
			return void this.write32(fn.call(this, src, this.read32(ea = this.index(this.a0))), ea);
		case 0o61: // L d(A1,Xi)
			return void this.write32(fn.call(this, src, this.read32(ea = this.index(this.a1))), ea);
		case 0o62: // L d(A2,Xi)
			return void this.write32(fn.call(this, src, this.read32(ea = this.index(this.a2))), ea);
		case 0o63: // L d(A3,Xi)
			return void this.write32(fn.call(this, src, this.read32(ea = this.index(this.a3))), ea);
		case 0o64: // L d(A4,Xi)
			return void this.write32(fn.call(this, src, this.read32(ea = this.index(this.a4))), ea);
		case 0o65: // L d(A5,Xi)
			return void this.write32(fn.call(this, src, this.read32(ea = this.index(this.a5))), ea);
		case 0o66: // L d(A6,Xi)
			return void this.write32(fn.call(this, src, this.read32(ea = this.index(this.a6))), ea);
		case 0o67: // L d(A7,Xi)
			return void this.write32(fn.call(this, src, this.read32(ea = this.index(this.a7))), ea);
		case 0o70: // L Abs.W
			return void this.write32(fn.call(this, src, this.read32(ea = this.fetch16s())), ea);
		case 0o71: // L Abs.L
			return void this.write32(fn.call(this, src, this.read32(ea = this.fetch32())), ea);
		}
	}

	rop8(op, flag) {
		let data = 0xff;

		switch(op & 0o77) {
		case 0o00: // B D0
			data = this.d0 & 0xff;
			break;
		case 0o01: // B D1
			data = this.d1 & 0xff;
			break;
		case 0o02: // B D2
			data = this.d2 & 0xff;
			break;
		case 0o03: // B D3
			data = this.d3 & 0xff;
			break;
		case 0o04: // B D4
			data = this.d4 & 0xff;
			break;
		case 0o05: // B D5
			data = this.d5 & 0xff;
			break;
		case 0o06: // B D6
			data = this.d6 & 0xff;
			break;
		case 0o07: // B D7
			data = this.d7 & 0xff;
			break;
		case 0o20: // B (A0)
			data = this.read8(this.a0);
			break;
		case 0o21: // B (A1)
			data = this.read8(this.a1);
			break;
		case 0o22: // B (A2)
			data = this.read8(this.a2);
			break;
		case 0o23: // B (A3)
			data = this.read8(this.a3);
			break;
		case 0o24: // B (A4)
			data = this.read8(this.a4);
			break;
		case 0o25: // B (A5)
			data = this.read8(this.a5);
			break;
		case 0o26: // B (A6)
			data = this.read8(this.a6);
			break;
		case 0o27: // B (A7)
			data = this.read8(this.a7);
			break;
		case 0o30: // B (A0)+
			data = this.read8(this.a0);
			this.a0 = this.a0 + 1 | 0;
			break;
		case 0o31: // B (A1)+
			data = this.read8(this.a1);
			this.a1 = this.a1 + 1 | 0;
			break;
		case 0o32: // B (A2)+
			data = this.read8(this.a2);
			this.a2 = this.a2 + 1 | 0;
			break;
		case 0o33: // B (A3)+
			data = this.read8(this.a3);
			this.a3 = this.a3 + 1 | 0;
			break;
		case 0o34: // B (A4)+
			data = this.read8(this.a4);
			this.a4 = this.a4 + 1 | 0;
			break;
		case 0o35: // B (A5)+
			data = this.read8(this.a5);
			this.a5 = this.a5 + 1 | 0;
			break;
		case 0o36: // B (A6)+
			data = this.read8(this.a6);
			this.a6 = this.a6 + 1 | 0;
			break;
		case 0o37: // B (A7)+
			data = this.read8(this.a7);
			this.a7 = this.a7 + 1 | 0;
			break;
		case 0o40: // B -(A0)
			data = this.read8(this.a0 = this.a0 - 1 | 0);
			break;
		case 0o41: // B -(A1)
			data = this.read8(this.a1 = this.a1 - 1 | 0);
			break;
		case 0o42: // B -(A2)
			data = this.read8(this.a2 = this.a2 - 1 | 0);
			break;
		case 0o43: // B -(A3)
			data = this.read8(this.a3 = this.a3 - 1 | 0);
			break;
		case 0o44: // B -(A4)
			data = this.read8(this.a4 = this.a4 - 1 | 0);
			break;
		case 0o45: // B -(A5)
			data = this.read8(this.a5 = this.a5 - 1 | 0);
			break;
		case 0o46: // B -(A6)
			data = this.read8(this.a6 = this.a6 - 1 | 0);
			break;
		case 0o47: // B -(A7)
			data = this.read8(this.a7 = this.a7 - 1 | 0);
			break;
		case 0o50: // B d(A0)
			data = this.read8(this.a0 + this.fetch16s() | 0);
			break;
		case 0o51: // B d(A1)
			data = this.read8(this.a1 + this.fetch16s() | 0);
			break;
		case 0o52: // B d(A2)
			data = this.read8(this.a2 + this.fetch16s() | 0);
			break;
		case 0o53: // B d(A3)
			data = this.read8(this.a3 + this.fetch16s() | 0);
			break;
		case 0o54: // B d(A4)
			data = this.read8(this.a4 + this.fetch16s() | 0);
			break;
		case 0o55: // B d(A5)
			data = this.read8(this.a5 + this.fetch16s() | 0);
			break;
		case 0o56: // B d(A6)
			data = this.read8(this.a6 + this.fetch16s() | 0);
			break;
		case 0o57: // B d(A7)
			data = this.read8(this.a7 + this.fetch16s() | 0);
			break;
		case 0o60: // B d(A0,Xi)
			data = this.read8(this.index(this.a0));
			break;
		case 0o61: // B d(A1,Xi)
			data = this.read8(this.index(this.a1));
			break;
		case 0o62: // B d(A2,Xi)
			data = this.read8(this.index(this.a2));
			break;
		case 0o63: // B d(A3,Xi)
			data = this.read8(this.index(this.a3));
			break;
		case 0o64: // B d(A4,Xi)
			data = this.read8(this.index(this.a4));
			break;
		case 0o65: // B d(A5,Xi)
			data = this.read8(this.index(this.a5));
			break;
		case 0o66: // B d(A6,Xi)
			data = this.read8(this.index(this.a6));
			break;
		case 0o67: // B d(A7,Xi)
			data = this.read8(this.index(this.a7));
			break;
		case 0o70: // B Abs.W
			data = this.read8(this.fetch16s());
			break;
		case 0o71: // B Abs.L
			data = this.read8(this.fetch32());
			break;
		case 0o72: // B d(PC)
			data = this.read8(this.pc + this.fetch16s() | 0);
			break;
		case 0o73: // B d(PC,Xi)
			data = this.read8(this.index(this.pc));
			break;
		case 0o74: // B #<data>
			data = this.fetch16() & 0xff;
			break;
		}
		if (flag)
			this.sr = this.sr & ~0x0f | data >>> 4 & 8 | !data << 2;
		return data;
	}

	rop16(op, flag) {
		let data = 0xffff;

		switch(op & 0o77) {
		case 0o00: // W D0
			data = this.d0 & 0xffff;
			break;
		case 0o01: // W D1
			data = this.d1 & 0xffff;
			break;
		case 0o02: // W D2
			data = this.d2 & 0xffff;
			break;
		case 0o03: // W D3
			data = this.d3 & 0xffff;
			break;
		case 0o04: // W D4
			data = this.d4 & 0xffff;
			break;
		case 0o05: // W D5
			data = this.d5 & 0xffff;
			break;
		case 0o06: // W D6
			data = this.d6 & 0xffff;
			break;
		case 0o07: // W D7
			data = this.d7 & 0xffff;
			break;
		case 0o10: // W A0
			data = this.a0 & 0xffff;
			break;
		case 0o11: // W A1
			data = this.a1 & 0xffff;
			break;
		case 0o12: // W A2
			data = this.a2 & 0xffff;
			break;
		case 0o13: // W A3
			data = this.a3 & 0xffff;
			break;
		case 0o14: // W A4
			data = this.a4 & 0xffff;
			break;
		case 0o15: // W A5
			data = this.a5 & 0xffff;
			break;
		case 0o16: // W A6
			data = this.a6 & 0xffff;
			break;
		case 0o17: // W A7
			data = this.a7 & 0xffff;
			break;
		case 0o20: // W (A0)
			data = this.read16(this.a0);
			break;
		case 0o21: // W (A1)
			data = this.read16(this.a1);
			break;
		case 0o22: // W (A2)
			data = this.read16(this.a2);
			break;
		case 0o23: // W (A3)
			data = this.read16(this.a3);
			break;
		case 0o24: // W (A4)
			data = this.read16(this.a4);
			break;
		case 0o25: // W (A5)
			data = this.read16(this.a5);
			break;
		case 0o26: // W (A6)
			data = this.read16(this.a6);
			break;
		case 0o27: // W (A7)
			data = this.read16(this.a7);
			break;
		case 0o30: // W (A0)+
			data = this.read16(this.a0);
			this.a0 = this.a0 + 2 | 0;
			break;
		case 0o31: // W (A1)+
			data = this.read16(this.a1);
			this.a1 = this.a1 + 2 | 0;
			break;
		case 0o32: // W (A2)+
			data = this.read16(this.a2);
			this.a2 = this.a2 + 2 | 0;
			break;
		case 0o33: // W (A3)+
			data = this.read16(this.a3);
			this.a3 = this.a3 + 2 | 0;
			break;
		case 0o34: // W (A4)+
			data = this.read16(this.a4);
			this.a4 = this.a4 + 2 | 0;
			break;
		case 0o35: // W (A5)+
			data = this.read16(this.a5);
			this.a5 = this.a5 + 2 | 0;
			break;
		case 0o36: // W (A6)+
			data = this.read16(this.a6);
			this.a6 = this.a6 + 2 | 0;
			break;
		case 0o37: // W (A7)+
			data = this.read16(this.a7);
			this.a7 = this.a7 + 2 | 0;
			break;
		case 0o40: // W -(A0)
			data = this.read16(this.a0 = this.a0 - 2 | 0);
			break;
		case 0o41: // W -(A1)
			data = this.read16(this.a1 = this.a1 - 2 | 0);
			break;
		case 0o42: // W -(A2)
			data = this.read16(this.a2 = this.a2 - 2 | 0);
			break;
		case 0o43: // W -(A3)
			data = this.read16(this.a3 = this.a3 - 2 | 0);
			break;
		case 0o44: // W -(A4)
			data = this.read16(this.a4 = this.a4 - 2 | 0);
			break;
		case 0o45: // W -(A5)
			data = this.read16(this.a5 = this.a5 - 2 | 0);
			break;
		case 0o46: // W -(A6)
			data = this.read16(this.a6 = this.a6 - 2 | 0);
			break;
		case 0o47: // W -(A7)
			data = this.read16(this.a7 = this.a7 - 2 | 0);
			break;
		case 0o50: // W d(A0)
			data = this.read16(this.a0 + this.fetch16s() | 0);
			break;
		case 0o51: // W d(A1)
			data = this.read16(this.a1 + this.fetch16s() | 0);
			break;
		case 0o52: // W d(A2)
			data = this.read16(this.a2 + this.fetch16s() | 0);
			break;
		case 0o53: // W d(A3)
			data = this.read16(this.a3 + this.fetch16s() | 0);
			break;
		case 0o54: // W d(A4)
			data = this.read16(this.a4 + this.fetch16s() | 0);
			break;
		case 0o55: // W d(A5)
			data = this.read16(this.a5 + this.fetch16s() | 0);
			break;
		case 0o56: // W d(A6)
			data = this.read16(this.a6 + this.fetch16s() | 0);
			break;
		case 0o57: // W d(A7)
			data = this.read16(this.a7 + this.fetch16s() | 0);
			break;
		case 0o60: // W d(A0,Xi)
			data = this.read16(this.index(this.a0));
			break;
		case 0o61: // W d(A1,Xi)
			data = this.read16(this.index(this.a1));
			break;
		case 0o62: // W d(A2,Xi)
			data = this.read16(this.index(this.a2));
			break;
		case 0o63: // W d(A3,Xi)
			data = this.read16(this.index(this.a3));
			break;
		case 0o64: // W d(A4,Xi)
			data = this.read16(this.index(this.a4));
			break;
		case 0o65: // W d(A5,Xi)
			data = this.read16(this.index(this.a5));
			break;
		case 0o66: // W d(A6,Xi)
			data = this.read16(this.index(this.a6));
			break;
		case 0o67: // W d(A7,Xi)
			data = this.read16(this.index(this.a7));
			break;
		case 0o70: // W Abs.W
			data = this.read16(this.fetch16s());
			break;
		case 0o71: // W Abs.L
			data = this.read16(this.fetch32());
			break;
		case 0o72: // W d(PC)
			data = this.read16(this.pc + this.fetch16s() | 0);
			break;
		case 0o73: // W d(PC,Xi)
			data = this.read16(this.index(this.pc));
			break;
		case 0o74: // W #<data>
			data = this.fetch16();
			break;
		}
		if (flag)
			this.sr = this.sr & ~0x0f | data >>> 12 & 8 | !data << 2;
		return data;
	}

	rop32(op, flag) {
		let data = 0xffffffff;

		switch(op & 0o77) {
		case 0o00: // L D0
			data = this.d0;
			break;
		case 0o01: // L D1
			data = this.d1;
			break;
		case 0o02: // L D2
			data = this.d2;
			break;
		case 0o03: // L D3
			data = this.d3;
			break;
		case 0o04: // L D4
			data = this.d4;
			break;
		case 0o05: // L D5
			data = this.d5;
			break;
		case 0o06: // L D6
			data = this.d6;
			break;
		case 0o07: // L D7
			data = this.d7;
			break;
		case 0o10: // L A0
			data = this.a0;
			break;
		case 0o11: // L A1
			data = this.a1;
			break;
		case 0o12: // L A2
			data = this.a2;
			break;
		case 0o13: // L A3
			data = this.a3;
			break;
		case 0o14: // L A4
			data = this.a4;
			break;
		case 0o15: // L A5
			data = this.a5;
			break;
		case 0o16: // L A6
			data = this.a6;
			break;
		case 0o17: // L A7
			data = this.a7;
			break;
		case 0o20: // L (A0)
			data = this.read32(this.a0);
			break;
		case 0o21: // L (A1)
			data = this.read32(this.a1);
			break;
		case 0o22: // L (A2)
			data = this.read32(this.a2);
			break;
		case 0o23: // L (A3)
			data = this.read32(this.a3);
			break;
		case 0o24: // L (A4)
			data = this.read32(this.a4);
			break;
		case 0o25: // L (A5)
			data = this.read32(this.a5);
			break;
		case 0o26: // L (A6)
			data = this.read32(this.a6);
			break;
		case 0o27: // L (A7)
			data = this.read32(this.a7);
			break;
		case 0o30: // W (A0)+
			data = this.read32(this.a0);
			this.a0 = this.a0 + 4 | 0;
			break;
		case 0o31: // W (A1)+
			data = this.read32(this.a1);
			this.a1 = this.a1 + 4 | 0;
			break;
		case 0o32: // W (A2)+
			data = this.read32(this.a2);
			this.a2 = this.a2 + 4 | 0;
			break;
		case 0o33: // W (A3)+
			data = this.read32(this.a3);
			this.a3 = this.a3 + 4 | 0;
			break;
		case 0o34: // W (A4)+
			data = this.read32(this.a4);
			this.a4 = this.a4 + 4 | 0;
			break;
		case 0o35: // W (A5)+
			data = this.read32(this.a5);
			this.a5 = this.a5 + 4 | 0;
			break;
		case 0o36: // W (A6)+
			data = this.read32(this.a6);
			this.a6 = this.a6 + 4 | 0;
			break;
		case 0o37: // W (A7)+
			data = this.read32(this.a7);
			this.a7 = this.a7 + 4 | 0;
			break;
		case 0o40: // L -(A0)
			data = this.read32(this.a0 = this.a0 - 4 | 0);
			break;
		case 0o41: // L -(A1)
			data = this.read32(this.a1 = this.a1 - 4 | 0);
			break;
		case 0o42: // L -(A2)
			data = this.read32(this.a2 = this.a2 - 4 | 0);
			break;
		case 0o43: // L -(A3)
			data = this.read32(this.a3 = this.a3 - 4 | 0);
			break;
		case 0o44: // L -(A4)
			data = this.read32(this.a4 = this.a4 - 4 | 0);
			break;
		case 0o45: // L -(A5)
			data = this.read32(this.a5 = this.a5 - 4 | 0);
			break;
		case 0o46: // L -(A6)
			data = this.read32(this.a6 = this.a6 - 4 | 0);
			break;
		case 0o47: // L -(A7)
			data = this.read32(this.a7 = this.a7 - 4 | 0);
			break;
		case 0o50: // L d(A0)
			data = this.read32(this.a0 + this.fetch16s() | 0);
			break;
		case 0o51: // L d(A1)
			data = this.read32(this.a1 + this.fetch16s() | 0);
			break;
		case 0o52: // L d(A2)
			data = this.read32(this.a2 + this.fetch16s() | 0);
			break;
		case 0o53: // L d(A3)
			data = this.read32(this.a3 + this.fetch16s() | 0);
			break;
		case 0o54: // L d(A4)
			data = this.read32(this.a4 + this.fetch16s() | 0);
			break;
		case 0o55: // L d(A5)
			data = this.read32(this.a5 + this.fetch16s() | 0);
			break;
		case 0o56: // L d(A6)
			data = this.read32(this.a6 + this.fetch16s() | 0);
			break;
		case 0o57: // L d(A7)
			data = this.read32(this.a7 + this.fetch16s() | 0);
			break;
		case 0o60: // L d(A0,Xi)
			data = this.read32(this.index(this.a0));
			break;
		case 0o61: // L d(A1,Xi)
			data = this.read32(this.index(this.a1));
			break;
		case 0o62: // L d(A2,Xi)
			data = this.read32(this.index(this.a2));
			break;
		case 0o63: // L d(A3,Xi)
			data = this.read32(this.index(this.a3));
			break;
		case 0o64: // L d(A4,Xi)
			data = this.read32(this.index(this.a4));
			break;
		case 0o65: // L d(A5,Xi)
			data = this.read32(this.index(this.a5));
			break;
		case 0o66: // L d(A6,Xi)
			data = this.read32(this.index(this.a6));
			break;
		case 0o67: // L d(A7,Xi)
			data = this.read32(this.index(this.a7));
			break;
		case 0o70: // L Abs.W
			data = this.read32(this.fetch16s());
			break;
		case 0o71: // L Abs.L
			data = this.read32(this.fetch32());
			break;
		case 0o72: // L d(PC)
			data = this.read32(this.pc + this.fetch16s() | 0);
			break;
		case 0o73: // L d(PC,Xi)
			data = this.read32(this.index(this.pc));
			break;
		case 0o74: // L #<data>
			data = this.fetch32();
			break;
		}
		if (flag)
			this.sr = this.sr & ~0x0f | data >>> 28 & 8 | !data << 2;
		return data;
	}

	movep(op, src) {
		const addr = this.lea(op & 7 | 0o50);
		switch (op >>> 6 & 3){
		case 0: // MOVEP.W d(Ay),Dx
			return this.read8(addr) << 8 | this.read8(addr + 2);
		case 1: // MOVEP.L d(Ay),Dx
			return this.read8(addr) << 24 | this.read8(addr + 2) << 16 | this.read8(addr + 4) << 8 | this.read8(addr + 6);
		case 2: // MOVEP.W Dx,d(Ay)
			this.write8(src >> 8, addr);
			this.write8(src, addr + 2);
			return;
		case 3: // MOVEP.L Dx,d(Ay)
			this.write8(src >>> 24, addr);
			this.write8(src >>> 16, addr + 2);
			this.write8(src >>> 8, addr + 4);
			this.write8(src, addr + 6);
			return;
		}
	}

	movem16rm(op) {
		const list = this.fetch16();
		let ea = this.lea(op);
		if ((op & 0o70) === 0o40) {
			if ((list & 1) !== 0)
				this.write16(this.a7, ea = ea - 2 | 0);
			if ((list & 2) !== 0)
				this.write16(this.a6, ea = ea - 2 | 0);
			if ((list & 4) !== 0)
				this.write16(this.a5, ea = ea - 2 | 0);
			if ((list & 8) !== 0)
				this.write16(this.a4, ea = ea - 2 | 0);
			if ((list & 0x10) !== 0)
				this.write16(this.a3, ea = ea - 2 | 0);
			if ((list & 0x20) !== 0)
				this.write16(this.a2, ea = ea - 2 | 0);
			if ((list & 0x40) !== 0)
				this.write16(this.a1, ea = ea - 2 | 0);
			if ((list & 0x80) !== 0)
				this.write16(this.a0, ea = ea - 2 | 0);
			if ((list & 0x100) !== 0)
				this.write16(this.d7, ea = ea - 2 | 0);
			if ((list & 0x200) !== 0)
				this.write16(this.d6, ea = ea - 2 | 0);
			if ((list & 0x400) !== 0)
				this.write16(this.d5, ea = ea - 2 | 0);
			if ((list & 0x800) !== 0)
				this.write16(this.d4, ea = ea - 2 | 0);
			if ((list & 0x1000) !== 0)
				this.write16(this.d3, ea = ea - 2 | 0);
			if ((list & 0x2000) !== 0)
				this.write16(this.d2, ea = ea - 2 | 0);
			if ((list & 0x4000) !== 0)
				this.write16(this.d1, ea = ea - 2 | 0);
			if ((list & 0x8000) !== 0)
				this.write16(this.d0, ea = ea - 2 | 0);
			this.rwop32(op & 7 | 0o10, src => src, ea);
		}
		else {
			ea = ea - 2 | 0;
			if ((list & 1) !== 0)
				this.write16(this.d0, ea = ea + 2 | 0);
			if ((list & 2) !== 0)
				this.write16(this.d1, ea = ea + 2 | 0);
			if ((list & 4) !== 0)
				this.write16(this.d2, ea = ea + 2 | 0);
			if ((list & 8) !== 0)
				this.write16(this.d3, ea = ea + 2 | 0);
			if ((list & 0x10) !== 0)
				this.write16(this.d4, ea = ea + 2 | 0);
			if ((list & 0x20) !== 0)
				this.write16(this.d5, ea = ea + 2 | 0);
			if ((list & 0x40) !== 0)
				this.write16(this.d6, ea = ea + 2 | 0);
			if ((list & 0x80) !== 0)
				this.write16(this.d7, ea = ea + 2 | 0);
			if ((list & 0x100) !== 0)
				this.write16(this.a0, ea = ea + 2 | 0);
			if ((list & 0x200) !== 0)
				this.write16(this.a1, ea = ea + 2 | 0);
			if ((list & 0x400) !== 0)
				this.write16(this.a2, ea = ea + 2 | 0);
			if ((list & 0x800) !== 0)
				this.write16(this.a3, ea = ea + 2 | 0);
			if ((list & 0x1000) !== 0)
				this.write16(this.a4, ea = ea + 2 | 0);
			if ((list & 0x2000) !== 0)
				this.write16(this.a5, ea = ea + 2 | 0);
			if ((list & 0x4000) !== 0)
				this.write16(this.a6, ea = ea + 2 | 0);
			if ((list & 0x8000) !== 0)
				this.write16(this.a7, ea + 2 | 0);
		}
	}

	movem32rm(op) {
		const list = this.fetch16();
		let ea = this.lea(op);
		if ((op & 0o70) === 0o40) {
			if ((list & 1) !== 0)
				this.write32(this.a7, ea = ea - 4 | 0);
			if ((list & 2) !== 0)
				this.write32(this.a6, ea = ea - 4 | 0);
			if ((list & 4) !== 0)
				this.write32(this.a5, ea = ea - 4 | 0);
			if ((list & 8) !== 0)
				this.write32(this.a4, ea = ea - 4 | 0);
			if ((list & 0x10) !== 0)
				this.write32(this.a3, ea = ea - 4 | 0);
			if ((list & 0x20) !== 0)
				this.write32(this.a2, ea = ea - 4 | 0);
			if ((list & 0x40) !== 0)
				this.write32(this.a1, ea = ea - 4 | 0);
			if ((list & 0x80) !== 0)
				this.write32(this.a0, ea = ea - 4 | 0);
			if ((list & 0x100) !== 0)
				this.write32(this.d7, ea = ea - 4 | 0);
			if ((list & 0x200) !== 0)
				this.write32(this.d6, ea = ea - 4 | 0);
			if ((list & 0x400) !== 0)
				this.write32(this.d5, ea = ea - 4 | 0);
			if ((list & 0x800) !== 0)
				this.write32(this.d4, ea = ea - 4 | 0);
			if ((list & 0x1000) !== 0)
				this.write32(this.d3, ea = ea - 4 | 0);
			if ((list & 0x2000) !== 0)
				this.write32(this.d2, ea = ea - 4 | 0);
			if ((list & 0x4000) !== 0)
				this.write32(this.d1, ea = ea - 4 | 0);
			if ((list & 0x8000) !== 0)
				this.write32(this.d0, ea = ea - 4 | 0);
			this.rwop32(op & 7 | 0o10, src => src, ea);
		}
		else {
			ea = ea - 4 | 0;
			if ((list & 1) !== 0)
				this.write32(this.d0, ea = ea + 4 | 0);
			if ((list & 2) !== 0)
				this.write32(this.d1, ea = ea + 4 | 0);
			if ((list & 4) !== 0)
				this.write32(this.d2, ea = ea + 4 | 0);
			if ((list & 8) !== 0)
				this.write32(this.d3, ea = ea + 4 | 0);
			if ((list & 0x10) !== 0)
				this.write32(this.d4, ea = ea + 4 | 0);
			if ((list & 0x20) !== 0)
				this.write32(this.d5, ea = ea + 4 | 0);
			if ((list & 0x40) !== 0)
				this.write32(this.d6, ea = ea + 4 | 0);
			if ((list & 0x80) !== 0)
				this.write32(this.d7, ea = ea + 4 | 0);
			if ((list & 0x100) !== 0)
				this.write32(this.a0, ea = ea + 4 | 0);
			if ((list & 0x200) !== 0)
				this.write32(this.a1, ea = ea + 4 | 0);
			if ((list & 0x400) !== 0)
				this.write32(this.a2, ea = ea + 4 | 0);
			if ((list & 0x800) !== 0)
				this.write32(this.a3, ea = ea + 4 | 0);
			if ((list & 0x1000) !== 0)
				this.write32(this.a4, ea = ea + 4 | 0);
			if ((list & 0x2000) !== 0)
				this.write32(this.a5, ea = ea + 4 | 0);
			if ((list & 0x4000) !== 0)
				this.write32(this.a6, ea = ea + 4 | 0);
			if ((list & 0x8000) !== 0)
				this.write32(this.a7, ea + 4 | 0);
		}
	}

	movem16mr(op) {
		const list = this.fetch16();
		let ea = this.lea(op) - 2 | 0;
		if ((list & 1) !== 0)
			this.d0 = this.read16s(ea = ea + 2 | 0);
		if ((list & 2) !== 0)
			this.d1 = this.read16s(ea = ea + 2 | 0);
		if ((list & 4) !== 0)
			this.d2 = this.read16s(ea = ea + 2 | 0);
		if ((list & 8) !== 0)
			this.d3 = this.read16s(ea = ea + 2 | 0);
		if ((list & 0x10) !== 0)
			this.d4 = this.read16s(ea = ea + 2 | 0);
		if ((list & 0x20) !== 0)
			this.d5 = this.read16s(ea = ea + 2 | 0);
		if ((list & 0x40) !== 0)
			this.d6 = this.read16s(ea = ea + 2 | 0);
		if ((list & 0x80) !== 0)
			this.d7 = this.read16s(ea = ea + 2 | 0);
		if ((list & 0x100) !== 0)
			this.a0 = this.read16s(ea = ea + 2 | 0);
		if ((list & 0x200) !== 0)
			this.a1 = this.read16s(ea = ea + 2 | 0);
		if ((list & 0x400) !== 0)
			this.a2 = this.read16s(ea = ea + 2 | 0);
		if ((list & 0x800) !== 0)
			this.a3 = this.read16s(ea = ea + 2 | 0);
		if ((list & 0x1000) !== 0)
			this.a4 = this.read16s(ea = ea + 2 | 0);
		if ((list & 0x2000) !== 0)
			this.a5 = this.read16s(ea = ea + 2 | 0);
		if ((list & 0x4000) !== 0)
			this.a6 = this.read16s(ea = ea + 2 | 0);
		if ((list & 0x8000) !== 0)
			this.a7 = this.read16s(ea = ea + 2 | 0);
		if ((op & 0o70) === 0o30)
			this.rwop32(op & 7 | 0o10, src => src, ea + 2 | 0);
	}

	movem32mr(op) {
		const list = this.fetch16();
		let ea = this.lea(op) - 4 | 0;
		if ((list & 1) !== 0)
			this.d0 = this.read32(ea = ea + 4 | 0);
		if ((list & 2) !== 0)
			this.d1 = this.read32(ea = ea + 4 | 0);
		if ((list & 4) !== 0)
			this.d2 = this.read32(ea = ea + 4 | 0);
		if ((list & 8) !== 0)
			this.d3 = this.read32(ea = ea + 4 | 0);
		if ((list & 0x10) !== 0)
			this.d4 = this.read32(ea = ea + 4 | 0);
		if ((list & 0x20) !== 0)
			this.d5 = this.read32(ea = ea + 4 | 0);
		if ((list & 0x40) !== 0)
			this.d6 = this.read32(ea = ea + 4 | 0);
		if ((list & 0x80) !== 0)
			this.d7 = this.read32(ea = ea + 4 | 0);
		if ((list & 0x100) !== 0)
			this.a0 = this.read32(ea = ea + 4 | 0);
		if ((list & 0x200) !== 0)
			this.a1 = this.read32(ea = ea + 4 | 0);
		if ((list & 0x400) !== 0)
			this.a2 = this.read32(ea = ea + 4 | 0);
		if ((list & 0x800) !== 0)
			this.a3 = this.read32(ea = ea + 4 | 0);
		if ((list & 0x1000) !== 0)
			this.a4 = this.read32(ea = ea + 4 | 0);
		if ((list & 0x2000) !== 0)
			this.a5 = this.read32(ea = ea + 4 | 0);
		if ((list & 0x4000) !== 0)
			this.a6 = this.read32(ea = ea + 4 | 0);
		if ((list & 0x8000) !== 0)
			this.a7 = this.read32(ea = ea + 4 | 0);
		if ((op & 0o70) === 0o30)
			this.rwop32(op & 7 | 0o10, src => src, ea + 4 | 0);
	}

	exg(op, src) {
		switch(op & 0o17) {
		case 0o00: // EXG Rx,D0
			[src, this.d0] = [this.d0, src];
			return src;
		case 0o01: // EXG Rx,D1
			[src, this.d1] = [this.d1, src];
			return src;
		case 0o02: // EXG Rx,D2
			[src, this.d2] = [this.d2, src];
			return src;
		case 0o03: // EXG Rx,D3
			[src, this.d3] = [this.d3, src];
			return src;
		case 0o04: // EXG Rx,D4
			[src, this.d4] = [this.d4, src];
			return src;
		case 0o05: // EXG Rx,D5
			[src, this.d5] = [this.d5, src];
			return src;
		case 0o06: // EXG Rx,D6
			[src, this.d6] = [this.d6, src];
			return src;
		case 0o07: // EXG Rx,D7
			[src, this.d7] = [this.d7, src];
			return src;
		case 0o10: // EXG Rx,A0
			[src, this.a0] = [this.a0, src];
			return src;
		case 0o11: // EXG Rx,A1
			[src, this.a1] = [this.a1, src];
			return src;
		case 0o12: // EXG Rx,A2
			[src, this.a2] = [this.a2, src];
			return src;
		case 0o13: // EXG Rx,A3
			[src, this.a3] = [this.a3, src];
			return src;
		case 0o14: // EXG Rx,A4
			[src, this.a4] = [this.a4, src];
			return src;
		case 0o15: // EXG Rx,A5
			[src, this.a5] = [this.a5, src];
			return src;
		case 0o16: // EXG Rx,A6
			[src, this.a6] = [this.a6, src];
			return src;
		case 0o17: // EXG Rx,A7
			[src, this.a7] = [this.a7, src];
			return src;
		}
	}

	jsr(op) {
		const addr = this.lea(op);
		this.write32(this.pc, this.a7 = this.a7 - 4 | 0);
		this.pc = addr;
	}

	chk(src, dst) {
		dst = (dst & 0xffff) - (dst << 1 & 0x10000);
		src -= src << 1 & 0x10000;
		if (dst >= 0 && dst <= src)
			return;
		this.sr = this.sr & ~8 | dst >> 12 & 8;
		this.exception(6);
	}

	lea(op) {
		switch(op & 0o77) {
		case 0o20: // (A0)
			return this.a0;
		case 0o21: // (A1)
			return this.a1;
		case 0o22: // (A2)
			return this.a2;
		case 0o23: // (A3)
			return this.a3;
		case 0o24: // (A4)
			return this.a4;
		case 0o25: // (A5)
			return this.a5;
		case 0o26: // (A6)
			return this.a6;
		case 0o27: // (A7)
			return this.a7;
		case 0o30: // (A0)+
			return this.a0;
		case 0o31: // (A1)+
			return this.a1;
		case 0o32: // (A2)+
			return this.a2;
		case 0o33: // (A3)+
			return this.a3;
		case 0o34: // (A4)+
			return this.a4;
		case 0o35: // (A5)+
			return this.a5;
		case 0o36: // (A6)+
			return this.a6;
		case 0o37: // (A7)+
			return this.a7;
		case 0o40: // -(A0)
			return this.a0;
		case 0o41: // -(A1)
			return this.a1;
		case 0o42: // -(A2)
			return this.a2;
		case 0o43: // -(A3)
			return this.a3;
		case 0o44: // -(A4)
			return this.a4;
		case 0o45: // -(A5)
			return this.a5;
		case 0o46: // -(A6)
			return this.a6;
		case 0o47: // -(A7)
			return this.a7;
		case 0o50: // d(A0)
			return this.a0 + this.fetch16s() | 0;
		case 0o51: // d(A1)
			return this.a1 + this.fetch16s() | 0;
		case 0o52: // d(A2)
			return this.a2 + this.fetch16s() | 0;
		case 0o53: // d(A3)
			return this.a3 + this.fetch16s() | 0;
		case 0o54: // d(A4)
			return this.a4 + this.fetch16s() | 0;
		case 0o55: // d(A5)
			return this.a5 + this.fetch16s() | 0;
		case 0o56: // d(A6)
			return this.a6 + this.fetch16s() | 0;
		case 0o57: // d(A7)
			return this.a7 + this.fetch16s() | 0;
		case 0o60: // d(A0,Xi)
			return this.index(this.a0);
		case 0o61: // d(A1,Xi)
			return this.index(this.a1);
		case 0o62: // d(A2,Xi)
			return this.index(this.a2);
		case 0o63: // d(A3,Xi)
			return this.index(this.a3);
		case 0o64: // d(A4,Xi)
			return this.index(this.a4);
		case 0o65: // d(A5,Xi)
			return this.index(this.a5);
		case 0o66: // d(A6,Xi)
			return this.index(this.a6);
		case 0o67: // d(A7,Xi)
			return this.index(this.a7);
		case 0o70: // Abs.W
			return this.fetch16s();
		case 0o71: // Abs.L
			return this.fetch32();
		case 0o72: // d(PC)
			return this.pc + this.fetch16s() | 0;
		case 0o73: // d(PC,Xi)
			return this.index(this.pc);
		}
	}

	or8(src, dst) {
		const r = (dst | src) & 0xff;
		this.sr = this.sr & ~0x0f | r >>> 4 & 8 | !r << 2;
		return r;
	}

	or16(src, dst) {
		const r = (dst | src) & 0xffff;
		this.sr = this.sr & ~0x0f | r >>> 12 & 8 | !r << 2;
		return r;
	}

	or32(src, dst) {
		const r = dst | src;
		this.sr = this.sr & ~0x0f | r >>> 28 & 8 | !r << 2;
		return r;
	}

	and8(src, dst) {
		const r = dst & src & 0xff;
		this.sr = this.sr & ~0x0f | r >>> 4 & 8 | !r << 2;
		return r;
	}

	and16(src, dst) {
		const r = dst & src & 0xffff;
		this.sr = this.sr & ~0x0f | r >>> 12 & 8 | !r << 2;
		return r;
	}

	and32(src, dst) {
		const r = dst & src;
		this.sr = this.sr & ~0x0f | r >>> 28 & 8 | !r << 2;
		return r;
	}

	sub8(src, dst) {
		const r = dst - src & 0xff, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		this.sr = this.sr & ~0x1f | c >>> 3 & 0x10 | r >>> 4 & 8 | !r << 2 | v >>> 6 & 2 | c >>> 7 & 1;
		return r;
	}

	sub16(src, dst) {
		const r = dst - src & 0xffff, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		this.sr = this.sr & ~0x1f | c >>> 11 & 0x10 | r >>> 12 & 8 | !r << 2 | v >>> 14 & 2 | c >>> 15 & 1;
		return r;
	}

	sub32(src, dst) {
		const r = dst - src | 0, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		this.sr = this.sr & ~0x1f | c >>> 27 & 0x10 | r >>> 28 & 8 | !r << 2 | v >>> 30 & 2 | c >>> 31;
		return r;
	}

	add8(src, dst) {
		const r = dst + src & 0xff, v = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		this.sr = this.sr & ~0x1f | c >>> 3 & 0x10 | r >>> 4 & 8 | !r << 2 | v >>> 6 & 2 | c >>> 7 & 1;
		return r;
	}

	add16(src, dst) {
		const r = dst + src & 0xffff, v = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		this.sr = this.sr & ~0x1f | c >>> 11 & 0x10 | r >>> 12 & 8 | !r << 2 | v >>> 14 & 2 | c >>> 15 & 1;
		return r;
	}

	add32(src, dst) {
		const r = dst + src | 0, v = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		this.sr = this.sr & ~0x1f | c >>> 27 & 0x10 | r >>> 28 & 8 | !r << 2 | v >>> 30 & 2 | c >>> 31;
		return r;
	}

	btst8(src, dst) {
		this.sr = this.sr & ~4 | ~dst >>> (src & 7) << 2 & 4;
	}

	btst32(src, dst) {
		this.sr = this.sr & ~4 | ~dst >>> (src & 31) << 2 & 4;
	}

	bchg8(src, dst) {
		this.sr = this.sr & ~4 | ~dst >>> (src &= 7) << 2 & 4;
		return dst ^ 1 << src;
	}

	bchg32(src, dst) {
		this.sr = this.sr & ~4 | ~dst >>> (src &= 31) << 2 & 4;
		return dst ^ 1 << src;
	}

	bclr8(src, dst) {
		this.sr = this.sr & ~4 | ~dst >>> (src &= 7) << 2 & 4;
		return dst & ~(1 << src);
	}

	bclr32(src, dst) {
		this.sr = this.sr & ~4 | ~dst >>> (src &= 31) << 2 & 4;
		return dst & ~(1 << src);
	}

	bset8(src, dst) {
		this.sr = this.sr & ~4 | ~dst >>> (src &= 7) << 2 & 4;
		return dst | 1 << src;
	}

	bset32(src, dst) {
		this.sr = this.sr & ~4 | ~dst >>> (src &= 31) << 2 & 4;
		return dst | 1 << src;
	}

	eor8(src, dst) {
		const r = (dst ^ src) & 0xff;
		this.sr = this.sr & ~0x0f | r >>> 4 & 8 | !r << 2;
		return r;
	}

	eor16(src, dst) {
		const r = (dst ^ src) & 0xffff;
		this.sr = this.sr & ~0x0f | r >>> 12 & 8 | !r << 2;
		return r;
	}

	eor32(src, dst) {
		const r = dst ^ src;
		this.sr = this.sr & ~0x0f | r >>> 28 & 8 | !r << 2;
		return r;
	}

	cmp8(src, dst) {
		const r = dst - src & 0xff, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		this.sr = this.sr & ~0x0f | r >>> 4 & 8 | !r << 2 | v >>> 6 & 2 | c >>> 7 & 1;
	}

	cmp16(src, dst) {
		const r = dst - src & 0xffff, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		this.sr = this.sr & ~0x0f | r >>> 12 & 8 | !r << 2 | v >>> 14 & 2 | c >>> 15 & 1;
	}

	cmp32(src, dst) {
		const r = dst - src | 0, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		this.sr = this.sr & ~0x0f | r >>> 28 & 8 | !r << 2 | v >>> 30 & 2 | c >>> 31;
	}

	divu(src, dst) {
		if (!src) {
			this.exception(5);
			return dst;
		}
		const r = (dst >>> 0) / src | 0;
		if (r > 0xffff || r < 0) {
			this.sr |= 2;
			return dst;
		}
		this.sr = this.sr & ~0x0f | r >>> 12 & 8 | !r << 2;
		return r | ((dst >>> 0) % src) << 16;
	}

	sbcd(src, dst) {
		let r = dst - src - (this.sr >>> 4 & 1) & 0xff, c = ~dst & src | src & r | r & ~dst;
		if ((c & 8) !== 0 && (r & 0x0f) > 5 || (r & 0x0f) > 9)
			r -= 6;
		if ((c & 0x80) !== 0 && (r & 0xf0) > 0x50 || (r & 0xf0) > 0x90) {
			r -= 0x60;
			c |= 0x80;
		}
		r &= 0xff;
		this.sr = this.sr & ~0x15 | c >>> 3 & 0x10 | !r << 2 | c >>> 7 & 1;
		return r;
	}

	divs(src, dst) {
		if (!src) {
			this.exception(5);
			return dst;
		}
		src -= src << 1 & 0x10000;
		const r = dst / src | 0;
		if (r > 0x7fff || r < -0x8000) {
			this.sr |= 2;
			return dst;
		}
		this.sr = this.sr & ~0x0f | r >>> 12 & 8 | !r << 2;
		return r & 0xffff | (dst % src) << 16;
	}

	subx8(src, dst) {
		const r = dst - src - (this.sr >>> 4 & 1) & 0xff, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		this.sr = this.sr & ~0x1f | c >>> 3 & 0x10 | r >>> 4 & 8 | !r << 2 | v >>> 6 & 2 | c >>> 7 & 1;
		return r;
	}

	subx16(src, dst) {
		const r = dst - src - (this.sr >>> 4 & 1) & 0xffff, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		this.sr = this.sr & ~0x1f | c >>> 11 & 0x10 | r >>> 12 & 8 | !r << 2 | v >>> 14 & 2 | c >>> 15 & 1;
		return r;
	}

	subx32(src, dst) {
		const r = dst - src - (this.sr >>> 4 & 1) | 0, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		this.sr = this.sr & ~0x1f | c >>> 27 & 0x10 | r >>> 28 & 8 | !r << 2 | v >>> 30 & 2 | c >>> 31;
		return r;
	}

	cmpa16(src, dst) {
		src -= src << 1 & 0x10000;
		const r = dst - src | 0, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		this.sr = this.sr & ~0x0f | r >>> 28 & 8 | !r << 2 | v >>> 30 & 2 | c >>> 31;
	}

	cmpa32(src, dst) {
		const r = dst - src | 0, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		this.sr = this.sr & ~0x0f | r >>> 28 & 8 | !r << 2 | v >>> 30 & 2 | c >>> 31;
	}

	mulu(src, dst) {
		const r = src * dst | 0;
		this.sr = this.sr & ~0x0f | r >>> 28 & 8 | !r << 2;
		return r;
	}

	abcd(src, dst) {
		let r = dst + src + (this.sr >>> 4 & 1) & 0xff, c = dst & src | src & ~r | ~r & dst;
		if ((c & 8) !== 0 && (r & 0x0f) < 4 || (r & 0x0f) > 9)
			if ((r += 6) >= 0x100)
				c |= 0x80;
		if ((c & 0x80) !== 0 && (r & 0xf0) < 0x40 || (r & 0xf0) > 0x90) {
			r += 0x60;
			c |= 0x80;
		}
		r &= 0xff;
		this.sr = this.sr & ~0x15 | c >>> 3 & 0x10 | !r << 2 | c >>> 7 & 1;
		return r;
	}

	muls(src, dst) {
		const r = (dst - (dst << 1 & 0x10000)) * (src - (src << 1 & 0x10000)) | 0;
		this.sr = this.sr & ~0x0f | r >>> 28 & 8 | !r << 2;
		return r;
	}

	addx8(src, dst) {
		const r = dst + src + (this.sr >>> 4 & 1) & 0xff, v = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		this.sr = this.sr & ~0x1f | c >>> 3 & 0x10 | r >>> 4 & 8 | !r << 2 | v >>> 6 & 2 | c >>> 7 & 1;
		return r;
	}

	addx16(src, dst) {
		const r = dst + src + (this.sr >>> 4 & 1) & 0xffff, v = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		this.sr = this.sr & ~0x1f | c >>> 11 & 0x10 | r >>> 12 & 8 | !r << 2 | v >>> 14 & 2 | c >>> 15 & 1;
		return r;
	}

	addx32(src, dst) {
		const r = dst + src + (this.sr >>> 4 & 1) | 0, v = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		this.sr = this.sr & ~0x1f | c >>> 27 & 0x10 | r >>> 28 & 8 | !r << 2 | v >>> 30 & 2 | c >>> 31;
		return r;
	}

	asr8(src, dst) {
		src &= 63;
		dst -= dst << 1 & 0x100;
		const r = dst >> src & 0xff, x = src ? dst >> (src - 1) & 1 : this.sr >>> 4 & 1, c = src ? dst >> (src - 1) & 1 : 0;
		this.sr = this.sr & ~0x1f | x << 4 | r >>> 4 & 8 | !r << 2 | c;
		return r;
	}

	asr16(src, dst) {
		src &= 63;
		dst -= dst << 1 & 0x10000;
		const r = dst >> src & 0xffff, x = src ? dst >> (src - 1) & 1 : this.sr >>> 4 & 1, c = src ? dst >> (src - 1) & 1 : 0;
		this.sr = this.sr & ~0x1f | x << 4 | r >>> 12 & 8 | !r << 2 | c;
		return r;
	}

	asr32(src, dst) {
		src &= 63;
		const r = dst >> src, x = src ? dst >> (src - 1) & 1 : this.sr >>> 4 & 1, c = src ? dst >> (src - 1) & 1 : 0;
		this.sr = this.sr & ~0x1f | x << 4 | r >>> 28 & 8 | !r << 2 | c;
		return r;
	}

	lsr8(src, dst) {
		src &= 63;
		const r = dst >>> src | 0, x = src ? dst >>> (src - 1) & 1 : this.sr >>> 4 & 1, c = src ? dst >>> (src - 1) & 1 : 0;
		this.sr = this.sr & ~0x1f | x << 4 | r >>> 4 & 8 | !r << 2 | c;
		return r;
	}

	lsr16(src, dst) {
		src &= 63;
		const r = dst >>> src | 0, x = src ? dst >>> (src - 1) & 1 : this.sr >>> 4 & 1, c = src ? dst >>> (src - 1) & 1 : 0;
		this.sr = this.sr & ~0x1f | x << 4 | r >>> 12 & 8 | !r << 2 | c;
		return r;
	}

	lsr32(src, dst) {
		src &= 63;
		const r = dst >>> src | 0, x = src ? dst >>> (src - 1) & 1 : this.sr >>> 4 & 1, c = src ? dst >>> (src - 1) & 1 : 0;
		this.sr = this.sr & ~0x1f | x << 4 | r >>> 28 & 8 | !r << 2 | c;
		return r;
	}

	roxr8(src, dst) {
		src = (src & 63) % 9;
		const r = (dst >>> src | dst << 9 - src | (this.sr >>> 4 & 1) << 8 - src) & 0xff, x = src ? dst >>> src - 1 & 1 : this.sr >>> 4 & 1;
		this.sr = this.sr & ~0x1f | x << 4 | r >>> 4 & 8 | !r << 2 | x;
		return r;
	}

	roxr16(src, dst) {
		src = (src & 63) % 17;
		const r = (dst >>> src | dst << 17 - src | (this.sr >>> 4 & 1) << 16 - src) & 0xffff, x = src ? dst >>> src - 1 & 1 : this.sr >>> 4 & 1;
		this.sr = this.sr & ~0x1f | x << 4 | r >>> 12 & 8 | !r << 2 | x;
		return r;
	}

	roxr32(src, dst) {
		src = (src & 63) % 33;
		const r = dst >>> src | dst << 33 - src | (this.sr >>> 4 & 1) << 32 - src, x = src ? dst >>> src - 1 & 1 : this.sr >>> 4 & 1;
		this.sr = this.sr & ~0x1f | x << 4 | r >>> 28 & 8 | !r << 2 | x;
		return r;
	}

	ror8(src, dst) {
		src &= 63;
		const r = dst >>> (src & 7) | dst << (~src & 7) + 1 & 0xff, c = src ? dst >>> (src - 1 & 7) & 1 : 0;
		this.sr = this.sr & ~0x0f | r >>> 4 & 8 | !r << 2 | c;
		return r;
	}

	ror16(src, dst) {
		src &= 63;
		const r = dst >>> (src & 15) | dst << (~src & 15) + 1 & 0xffff, c = src ? dst >>> (src - 1 & 15) & 1 : 0;
		this.sr = this.sr & ~0x0f | r >>> 12 & 8 | !r << 2 | c;
		return r;
	}

	ror32(src, dst) {
		src &= 63;
		const r = dst >>> (src & 31) | dst << (~src & 31) + 1, c = src ? dst >>> (src - 1 & 31) & 1 : 0;
		this.sr = this.sr & ~0x0f | r >>> 28 & 8 | !r << 2 | c;
		return r;
	}

	asl8(src, dst) {
		let x = this.sr >>> 4 & 1, v = 0, c = 0;
		src &= 63;
		for (let i = 0; i < src; i++) {
			v |= (dst >>> 7 ^ dst >>> 6) & 1;
			[x, c, dst] = [dst >>> 7, dst >>> 7, dst << 1];
		}
		dst &= 0xff;
		this.sr = this.sr & ~0x1f | x << 4 | dst >>> 4 & 8 | !dst << 2 | v << 1 | c;
		return dst;
	}

	asl16(src, dst) {
		let x = this.sr >>> 4 & 1, v = 0, c = 0;
		src &= 63;
		for (let i = 0; i < src; i++) {
			v |= (dst >>> 15 ^ dst >>> 14) & 1;
			[x, c, dst] = [dst >>> 15, dst >>> 15, dst << 1];
		}
		dst &= 0xffff;
		this.sr = this.sr & ~0x1f | x << 4 | dst >>> 12 & 8 | !dst << 2 | v << 1 | c;
		return dst;
	}

	asl32(src, dst) {
		let x = this.sr >>> 4 & 1, v = 0, c = 0;
		src &= 63;
		for (let i = 0; i < src; i++) {
			v |= (dst >>> 31 ^ dst >>> 30) & 1;
			[x, c, dst] = [dst >>> 31, dst >>> 31, dst << 1];
		}
		this.sr = this.sr & ~0x1f | x << 4 | dst >>> 28 & 8 | !dst << 2 | v << 1 | c;
		return dst;
	}

	lsl8(src, dst) {
		src &= 63;
		const r = dst << src & 0xff, x = src ? dst << (src - 1) >>> 7 & 1 : this.sr >>> 4 & 1, c = src ? dst << (src - 1) >>> 7 & 1 : 0;
		this.sr = this.sr & ~0x1f | x << 4 | r >>> 4 & 8 | !r << 2 | c;
		return r;
	}

	lsl16(src, dst) {
		src &= 63;
		const r = dst << src & 0xffff, x = src ? dst << (src - 1) >>> 15 & 1 : this.sr >>> 4 & 1, c = src ? dst << (src - 1) >>> 15 & 1 : 0;
		this.sr = this.sr & ~0x1f | x << 4 | r >>> 12 & 8 | !r << 2 | c;
		return r;
	}

	lsl32(src, dst) {
		src &= 63;
		const r = dst << src, x = src ? dst << (src - 1) >>> 31 & 1 : this.sr >>> 4 & 1, c = src ? dst << (src - 1) >>> 31 & 1 : 0;
		this.sr = this.sr & ~0x1f | x << 4 | r >>> 28 & 8 | !r << 2 | c;
		return r;
	}

	roxl8(src, dst) {
		src = (src & 63) % 9;
		const r = (dst << src | dst >>> 9 - src | (this.sr << 3 & 0x80) >>> 8 - src) & 0xff, x = src ? dst >>> 8 - src & 1 : this.sr >>> 4 & 1;
		this.sr = this.sr & ~0x1f | x << 4 | r >>> 4 & 8 | !r << 2 | x;
		return r;
	}

	roxl16(src, dst) {
		src = (src & 63) % 17;
		const r = (dst << src | dst >>> 17 - src | (this.sr << 11 & 0x8000) >>> 16 - src) & 0xffff, x = src ? dst >>> 16 - src & 1 : this.sr >>> 4 & 1;
		this.sr = this.sr & ~0x1f | x << 4 | r >>> 12 & 8 | !r << 2 | x;
		return r;
	}

	roxl32(src, dst) {
		src = (src & 63) % 33;
		const r = dst << src | dst >>> 33 - src | (this.sr << 27 & 0x80000000) >>> 32 - src, x = src ? dst >>> 32 - src & 1 : this.sr >>> 4 & 1;
		this.sr = this.sr & ~0x1f | x << 4 | r >>> 28 & 8 | !r << 2 | x;
		return r;
	}

	rol8(src, dst) {
		src &= 63;
		const r = dst << (src & 7) & 0xff | dst >>> (~src & 7) + 1, c = src ? dst >>> (-src & 7) & 1 : 0;
		this.sr = this.sr & ~0x0f | r >>> 4 & 8 | !r << 2 | c;
		return r;
	}

	rol16(src, dst) {
		src &= 63;
		const r = dst << (src & 15) & 0xffff | dst >>> (~src & 15) + 1, c = src ? dst >>> (-src & 15) & 1 : 0;
		this.sr = this.sr & ~0x0f | r >>> 12 & 8 | !r << 2 | c;
		return r;
	}

	rol32(src, dst) {
		src &= 63;
		const r = dst << (src & 31) | dst >>> (~src & 31) + 1, c = src ? dst >>> (-src & 31) & 1 : 0;
		this.sr = this.sr & ~0x0f | r >>> 28 & 8 | !r << 2 | c;
		return r;
	}

	negx8(src, dst) {
		const r = -dst - (this.sr >>> 4 & 1) & 0xff, v = dst & r, c = dst | r;
		this.sr = this.sr & ~0x1f | c >>> 3 & 0x10 | r >>> 4 & 8 | !r << 2 | v >>> 6 & 2 | c >>> 7 & 1;
		return r;
	}

	negx16(src, dst) {
		const r = -dst - (this.sr >>> 4 & 1) & 0xffff, v = dst & r, c = dst | r;
		this.sr = this.sr & ~0x1f | c >>> 11 & 0x10 | r >>> 12 & 8 | !r << 2 | v >>> 14 & 2 | c >>> 15 & 1;
		return r;
	}

	negx32(src, dst) {
		const r = -dst - (this.sr >>> 4 & 1) | 0, v = dst & r, c = dst | r;
		this.sr = this.sr & ~0x1f | c >>> 27 & 0x10 | r >>> 28 & 8 | !r << 2 | v >>> 30 & 2 | c >>> 31;
		return r;
	}

	clr() {
		this.sr = this.sr & ~0x0f | 4;
		return 0;
	}

	neg8(src, dst) {
		const r = -dst & 0xff, v = dst & r, c = dst | r;
		this.sr = this.sr & ~0x1f | c >>> 3 & 0x10 | r >>> 4 & 8 | !r << 2 | v >>> 6 & 2 | c >>> 7 & 1;
		return r;
	}

	neg16(src, dst) {
		const r = -dst & 0xffff, v = dst & r, c = dst | r;
		this.sr = this.sr & ~0x1f | c >>> 11 & 0x10 | r >>> 12 & 8 | !r << 2 | v >>> 14 & 2 | c >>> 15 & 1;
		return r;
	}

	neg32(src, dst) {
		const r = -dst | 0, v = dst & r, c = dst | r;
		this.sr = this.sr & ~0x1f | c >>> 27 & 0x10 | r >>> 28 & 8 | !r << 2 | v >>> 30 & 2 | c >>> 31;
		return r;
	}

	not8(src, dst) {
		const r = ~dst & 0xff;
		this.sr = this.sr & ~0x0f | r >>> 4 & 8 | !r << 2;
		return r;
	}

	not16(src, dst) {
		const r = ~dst & 0xffff;
		this.sr = this.sr & ~0x0f | r >>> 12 & 8 | !r << 2;
		return r;
	}

	not32(src, dst) {
		const r = ~dst;
		this.sr = this.sr & ~0x0f | r >>> 28 & 8 | !r << 2;
		return r;
	}

	nbcd(src, dst) {
		let r = -dst - (this.sr >>> 4 & 1) & 0xff, c = dst | r;
		if ((c & 8) !== 0 && (r & 0x0f) > 5 || (r & 0x0f) > 9)
			r -= 6;
		if ((c & 0x80) !== 0 && (r & 0xf0) > 0x50 || (r & 0xf0) > 0x90) {
			r -= 0x60;
			c |= 0x80;
		}
		r &= 0xff;
		this.sr = this.sr & ~0x15 | c >>> 3 & 0x10 | !r << 2 | c >>> 7 & 1;
		return r;
	}

	swap(src, dst) {
		const r = dst << 16 | dst >>> 16;
		this.sr = this.sr & ~0x0f | r >>> 28 & 8 | !r << 2;
		return r;
	}

	ext16(src, dst) {
		const r = (dst & 0xff) - (dst << 1 & 0x100) & 0xffff;
		this.sr = this.sr & ~0x0f | r >>> 12 & 8 | !r << 2;
		return r;
	}

	ext32(src, dst) {
		const r = (dst & 0xffff) - (dst << 1 & 0x10000);
		this.sr = this.sr & ~0x0f | r >>> 28 & 8 | !r << 2;
		return r;
	}

	tas(src, dst) {
		this.sr = this.sr & ~0x0f | dst >>> 4 & 8 | !dst << 2;
		return dst | 0x80;
	}

	link(src, dst) {
		this.write32(dst, this.a7 = this.a7 - 4 | 0);
		dst = this.a7;
		this.a7 = this.a7 + this.fetch16s() | 0;
		return dst;
	}

	unlk(src, dst) {
		this.a7 = dst;
		dst = this.read32(this.a7);
		this.a7 = this.a7 + 4 | 0;
		return dst;
	}

	dbcc(cond, dst) {
		const base = this.pc;
		this.pc = !cond && (dst = dst - 1 & 0xffff) !== 0xffff ? base + this.fetch16s() | 0 : base + 2 | 0;
		return dst;
	}

	index(base) {
		const word = this.fetch16();
		const disp = (word & 0xff) - (word << 1 & 0x100);
		switch (word >>> 11) {
		case 0x00: // D0.W
			return base + (this.d0 & 0xffff) - (this.d0 << 1 & 0x10000) + disp | 0;
		case 0x01: // D0.L
			return base + this.d0 + disp | 0;
		case 0x02: // D1.W
			return base + (this.d1 & 0xffff) - (this.d1 << 1 & 0x10000) + disp | 0;
		case 0x03: // D1.L
			return base + this.d1 + disp | 0;
		case 0x04: // D2.W
			return base + (this.d2 & 0xffff) - (this.d2 << 1 & 0x10000) + disp | 0;
		case 0x05: // D2.L
			return base + this.d2 + disp | 0;
		case 0x06: // D3.W
			return base + (this.d3 & 0xffff) - (this.d3 << 1 & 0x10000) + disp | 0;
		case 0x07: // D3.L
			return base + this.d3 + disp | 0;
		case 0x08: // D4.W
			return base + (this.d4 & 0xffff) - (this.d4 << 1 & 0x10000) + disp | 0;
		case 0x09: // D4.L
			return base + this.d4 + disp | 0;
		case 0x0a: // D5.W
			return base + (this.d5 & 0xffff) - (this.d5 << 1 & 0x10000) + disp | 0;
		case 0x0b: // D5.L
			return base + this.d5 + disp | 0;
		case 0x0c: // D6.W
			return base + (this.d6 & 0xffff) - (this.d6 << 1 & 0x10000) + disp | 0;
		case 0x0d: // D6.L
			return base + this.d6 + disp | 0;
		case 0x0e: // D7.W
			return base + (this.d7 & 0xffff) - (this.d7 << 1 & 0x10000) + disp | 0;
		case 0x0f: // D7.L
			return base + this.d7 + disp | 0;
		case 0x10: // A0.W
			return base + (this.a0 & 0xffff) - (this.a0 << 1 & 0x10000) + disp | 0;
		case 0x11: // A0.L
			return base + this.a0 + disp | 0;
		case 0x12: // A1.W
			return base + (this.a1 & 0xffff) - (this.a1 << 1 & 0x10000) + disp | 0;
		case 0x13: // A1.L
			return base + this.a1 + disp | 0;
		case 0x14: // A2.W
			return base + (this.a2 & 0xffff) - (this.a2 << 1 & 0x10000) + disp | 0;
		case 0x15: // A2.L
			return base + this.a2 + disp | 0;
		case 0x16: // A3.W
			return base + (this.a3 & 0xffff) - (this.a3 << 1 & 0x10000) + disp | 0;
		case 0x17: // A3.L
			return base + this.a3 + disp | 0;
		case 0x18: // A4.W
			return base + (this.a4 & 0xffff) - (this.a4 << 1 & 0x10000) + disp | 0;
		case 0x19: // A4.L
			return base + this.a4 + disp | 0;
		case 0x1a: // A5.W
			return base + (this.a5 & 0xffff) - (this.a5 << 1 & 0x10000) + disp | 0;
		case 0x1b: // A5.L
			return base + this.a5 + disp | 0;
		case 0x1c: // A6.W
			return base + (this.a6 & 0xffff) - (this.a6 << 1 & 0x10000) + disp | 0;
		case 0x1d: // A6.L
			return base + this.a6 + disp | 0;
		case 0x1e: // A7.W
			return base + (this.a7 & 0xffff) - (this.a7 << 1 & 0x10000) + disp | 0;
		case 0x1f: // A7.L
			return base + this.a7 + disp | 0;
		}
	}

	fetch16() {
		const page = this.memorymap[this.pc >>> 8 & 0xffff];
		const data = page.base[this.pc & 0xff] << 8 | page.base[this.pc + 1 & 0xff];
		this.pc = this.pc + 2 | 0;
		return data;
	}

	fetch16s() {
		const page = this.memorymap[this.pc >>> 8 & 0xffff];
		const data = page.base[this.pc & 0xff] << 8 | page.base[this.pc + 1 & 0xff];
		this.pc = this.pc + 2 | 0;
		return data - (data << 1 & 0x10000);
	}

	fetch32() {
		return this.fetch16() << 16 | this.fetch16();
	}

	read8(addr) {
		const page = this.memorymap[addr >>> 8 & 0xffff];
		return page.read ? page.read(addr, this.arg) : page.base[addr & 0xff];
	}

	read16(addr) {
		const page = this.memorymap[addr >>> 8 & 0xffff];
		return page.read16 ? page.read16(addr, this.arg) : page.read ? page.read(addr, this.arg) << 8 | page.read(addr + 1 | 0, this.arg) : page.base[addr & 0xff] << 8 | page.base[addr + 1 & 0xff];
	}

	read16s(addr) {
		const page = this.memorymap[addr >>> 8 & 0xffff];
		const data = page.read16 ? page.read16(addr, this.arg) : page.read ? page.read(addr, this.arg) << 8 | page.read(addr + 1 | 0, this.arg) : page.base[addr & 0xff] << 8 | page.base[addr + 1 & 0xff];
		return data - (data << 1 & 0x10000);
	}

	read32(addr) {
		return this.read16(addr) << 16 | this.read16(addr + 2 | 0);
	}

	write8(data, addr) {
		const page = this.memorymap[addr >>> 8 & 0xffff];
		if (page.write)
			page.write(addr, data & 0xff, this.arg);
		else
			page.base[addr & 0xff] = data;
	}

	write16(data, addr) {
		const page = this.memorymap[addr >>> 8 & 0xffff];
		if (page.write16)
			page.write16(addr, data & 0xffff, this.arg);
		else if (page.write) {
			page.write(addr, data >>> 8 & 0xff, this.arg);
			page.write(addr + 1 | 0, data & 0xff, this.arg);
		}
		else {
			page.base[addr & 0xff] = data >>> 8;
			page.base[addr + 1 & 0xff] = data;
		}
	}

	write32(data, addr) {
		this.write16(data >>> 16, addr);
		this.write16(data, addr + 2 | 0);
	}
}

