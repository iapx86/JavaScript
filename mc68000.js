/*
 *
 *	MC68000 Emulator
 *
 */

import Cpu, {dummypage} from './cpu.js';

export default class MC68000 extends Cpu {
	d = new Int32Array(8);
	a = new Int32Array(8);
	ssp = 0;
	usp = 0;
	sr = 0; // sr:t-s--iii ccr:---xnzvc
	op = 0;

	constructor(clock) {
		super(clock);
		this.memorymap.splice(0);
		for (let i = 0; i < 0x10000; i++)
			this.memorymap.push({base: dummypage, read: null, read16: null, write: () => {}, write16: null});
		this.breakpointmap = new Int32Array(0x80000);
	}

	reset() {
		super.reset();
		this.sr = 0x2700;
		this.a[7] = this.txread32(0);
		this.pc = this.txread32(4);
	}

	interrupt(ipl = 1, vector = 24 + ipl) {
		if (ipl < 7 && ipl <= (this.sr >> 8 & 7) || !super.interrupt())
			return false;
		return this.exception(vector), this.sr = this.sr & ~0x0700 | ipl << 8, true;
	}

	exception(vector) {
		switch (vector) {
		case 4: case 8: case 10: case 11:
			this.pc = this.pc - 2 | 0;
			break;
		}
		this.cycle -= cc_ex[vector], ~this.sr & 0x2000 && (this.usp = this.a[7], this.a[7] = this.ssp);
		this.a[7] -= 4, this.write32(this.pc, this.a[7]), this.a[7] -= 2, this.write16(this.sr, this.a[7]), this.pc = this.read32(vector << 2), this.sr = this.sr & ~0x8000 | 0x2000;
	}

	_execute() {
		if (this.pc & 1)
			return this.exception(3);
		this.op = this.fetch16();
		this.cycle -= cc[this.op];
		switch (this.op >> 12) {
		case 0x0: // Bit Manipulation/MOVEP/Immediate
			return this.execute_0();
		case 0x1: // Move Byte
			return this.execute_1();
		case 0x2: // Move Long
			return this.execute_2();
		case 0x3: // Move Word
			return this.execute_3();
		case 0x4: // Miscellaneous
			return this.execute_4();
		case 0x5: // ADDQ/SUBQ/Scc/DBcc
			return this.execute_5();
		case 0x6: // Bcc/BSR
			return this.execute_6();
		case 0x7: // MOVEQ
			return this.execute_7();
		case 0x8: // OR/DIV/SBCD
			return this.execute_8();
		case 0x9: // SUB/SUBX
			return this.execute_9();
		case 0xa: // (Unassigned)
			return this.exception(10);
		case 0xb: // CMP/EOR
			return this.execute_b();
		case 0xc: // AND/MUL/ABCD/EXG
			return this.execute_c();
		case 0xd: // ADD/ADDX
			return this.execute_d();
		case 0xe: // Shift/Rotate
			return this.execute_e();
		case 0xf: // (Unassigned)
			return this.exception(11);
		}
	}

	execute_0() { // Bit Manipulation/MOVEP/Immediate
		const x = this.op >> 9 & 7, y = this.op & 7;
		let ea, data;
		switch (this.op >> 3 & 0o77) {
		case 0o00:
			switch (x) {
			case 0: // ORI.B #<data>,Dy
				return void(this.d[y] = this.d[y] & ~0xff | this.or8(this.fetch16(), this.d[y]));
			case 1: // ANDI.B #<data>,Dy
				return void(this.d[y] = this.d[y] & ~0xff | this.and8(this.fetch16(), this.d[y]));
			case 2: // SUBI.B #<data>,Dy
				return void(this.d[y] = this.d[y] & ~0xff | this.sub8(this.fetch16(), this.d[y]));
			case 3: // ADDI.B #<data>,Dy
				return void(this.d[y] = this.d[y] & ~0xff | this.add8(this.fetch16(), this.d[y]));
			case 4: // BTST #<data>,Dy
				return this.btst32(this.fetch16(), this.d[y]);
			case 5: // EORI.B #<data>,Dy
				return void(this.d[y] = this.d[y] & ~0xff | this.eor8(this.fetch16(), this.d[y]));
			case 6: // CMPI.B #<data>,Dy
				return this.cmp8(this.fetch16(), this.d[y]);
			}
			return this.exception(4);
		case 0o02:
			switch (x) {
			case 0: // ORI.B #<data>,(Ay)
				return this.write8(this.or8(this.fetch16(), this.read8(this.a[y])), this.a[y]);
			case 1: // ANDI.B #<data>,(Ay)
				return this.write8(this.and8(this.fetch16(), this.read8(this.a[y])), this.a[y]);
			case 2: // SUBI.B #<data>,(Ay)
				return this.write8(this.sub8(this.fetch16(), this.read8(this.a[y])), this.a[y]);
			case 3: // ADDI.B #<data>,(Ay)
				return this.write8(this.add8(this.fetch16(), this.read8(this.a[y])), this.a[y]);
			case 4: // BTST #<data>,(Ay)
				return this.btst8(this.fetch16(), this.read8(this.a[y]));
			case 5: // EORI.B #<data>,(Ay)
				return this.write8(this.eor8(this.fetch16(), this.read8(this.a[y])), this.a[y]);
			case 6: // CMPI.B #<data>,(Ay)
				return this.cmp8(this.fetch16(), this.read8(this.a[y]));
			}
			return this.exception(4);
		case 0o03:
			switch (x) {
			case 0: // ORI.B #<data>,(Ay)+
				return this.write8(this.or8(this.fetch16(), this.read8(this.a[y])), this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 1: // ANDI.B #<data>,(Ay)+
				return this.write8(this.and8(this.fetch16(), this.read8(this.a[y])), this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 2: // SUBI.B #<data>,(Ay)+
				return this.write8(this.sub8(this.fetch16(), this.read8(this.a[y])), this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 3: // ADDI.B #<data>,(Ay)+
				return this.write8(this.add8(this.fetch16(), this.read8(this.a[y])), this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 4: // BTST #<data>,(Ay)+
				return this.btst8(this.fetch16(), this.read8(this.a[y])), void(this.a[y] += y < 7 ? 1 : 2);
			case 5: // EORI.B #<data>,(Ay)+
				return this.write8(this.eor8(this.fetch16(), this.read8(this.a[y])), this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 6: // CMPI.B #<data>,(Ay)+
				return this.cmp8(this.fetch16(), this.read8(this.a[y])), void(this.a[y] += y < 7 ? 1 : 2);
			}
			return this.exception(4);
		case 0o04:
			switch (x) {
			case 0: // ORI.B #<data>,-(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.write8(this.or8(this.fetch16(), this.read8(this.a[y])), this.a[y]);
			case 1: // ANDI.B #<data>,-(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.write8(this.and8(this.fetch16(), this.read8(this.a[y])), this.a[y]);
			case 2: // SUBI.B #<data>,-(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.write8(this.sub8(this.fetch16(), this.read8(this.a[y])), this.a[y]);
			case 3: // ADDI.B #<data>,-(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.write8(this.add8(this.fetch16(), this.read8(this.a[y])), this.a[y]);
			case 4: // BTST #<data>,-(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.btst8(this.fetch16(), this.read8(this.a[y]));
			case 5: // EORI.B #<data>,-(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.write8(this.eor8(this.fetch16(), this.read8(this.a[y])), this.a[y]);
			case 6: // CMPI.B #<data>,-(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.cmp8(this.fetch16(), this.read8(this.a[y]));
			}
			return this.exception(4);
		case 0o05:
			switch (x) {
			case 0: // ORI.B #<data>,d(Ay)
				return data = this.fetch16(), ea = this.disp(this.a[y]), this.write8(this.or8(data, this.read8(ea)), ea);
			case 1: // ANDI.B #<data>,d(Ay)
				return data = this.fetch16(), ea = this.disp(this.a[y]), this.write8(this.and8(data, this.read8(ea)), ea);
			case 2: // SUBI.B #<data>,d(Ay)
				return data = this.fetch16(), ea = this.disp(this.a[y]), this.write8(this.sub8(data, this.read8(ea)), ea);
			case 3: // ADDI.B #<data>,d(Ay)
				return data = this.fetch16(), ea = this.disp(this.a[y]), this.write8(this.add8(data, this.read8(ea)), ea);
			case 4: // BTST #<data>,d(Ay)
				return data = this.fetch16(), ea = this.disp(this.a[y]), this.btst8(data, this.read8(ea));
			case 5: // EORI.B #<data>,d(Ay)
				return data = this.fetch16(), ea = this.disp(this.a[y]), this.write8(this.eor8(data, this.read8(ea)), ea);
			case 6: // CMPI.B #<data>,d(Ay)
				return data = this.fetch16(), ea = this.disp(this.a[y]), this.cmp8(data, this.read8(ea));
			}
			return this.exception(4);
		case 0o06:
			switch (x) {
			case 0: // ORI.B #<data>,d(Ay,Xi)
				return data = this.fetch16(), ea = this.index(this.a[y]), this.write8(this.or8(data, this.read8(ea)), ea);
			case 1: // ANDI.B #<data>,d(Ay,Xi)
				return data = this.fetch16(), ea = this.index(this.a[y]), this.write8(this.and8(data, this.read8(ea)), ea);
			case 2: // SUBI.B #<data>,d(Ay,Xi)
				return data = this.fetch16(), ea = this.index(this.a[y]), this.write8(this.sub8(data, this.read8(ea)), ea);
			case 3: // ADDI.B #<data>,d(Ay,Xi)
				return data = this.fetch16(), ea = this.index(this.a[y]), this.write8(this.add8(data, this.read8(ea)), ea);
			case 4: // BTST #<data>,d(Ay,Xi)
				return data = this.fetch16(), ea = this.index(this.a[y]), this.btst8(data, this.read8(ea));
			case 5: // EORI.B #<data>,d(Ay,Xi)
				return data = this.fetch16(), ea = this.index(this.a[y]), this.write8(this.eor8(data, this.read8(ea)), ea);
			case 6: // CMPI.B #<data>,d(Ay,Xi)
				return data = this.fetch16(), ea = this.index(this.a[y]), this.cmp8(data, this.read8(ea));
			}
			return this.exception(4);
		case 0o07:
			switch (x << 3 | y) {
			case 0o00: // ORI.B #<data>,Abs.W
				return data = this.fetch16(), ea = this.fetch16s(), this.write8(this.or8(data, this.read8(ea)), ea);
			case 0o01: // ORI.B #<data>,Abs.L
				return data = this.fetch16(), ea = this.fetch32(), this.write8(this.or8(data, this.read8(ea)), ea);
			case 0o04: // ORI #<data>,CCR
				return void(this.sr |= this.fetch16() & 0xff);
			case 0o10: // ANDI.B #<data>,Abs.W
				return data = this.fetch16(), ea = this.fetch16s(), this.write8(this.and8(data, this.read8(ea)), ea);
			case 0o11: // ANDI.B #<data>,Abs.L
				return data = this.fetch16(), ea = this.fetch32(), this.write8(this.and8(data, this.read8(ea)), ea);
			case 0o14: // ANDI #<data>,CCR
				return void(this.sr &= this.fetch16() | ~0xff);
			case 0o20: // SUBI.B #<data>,Abs.W
				return data = this.fetch16(), ea = this.fetch16s(), this.write8(this.sub8(data, this.read8(ea)), ea);
			case 0o21: // SUBI.B #<data>,Abs.L
				return data = this.fetch16(), ea = this.fetch32(), this.write8(this.sub8(data, this.read8(ea)), ea);
			case 0o30: // ADDI.B #<data>,Abs.W
				return data = this.fetch16(), ea = this.fetch16s(), this.write8(this.add8(data, this.read8(ea)), ea);
			case 0o31: // ADDI.B #<data>,Abs.L
				return data = this.fetch16(), ea = this.fetch32(), this.write8(this.add8(data, this.read8(ea)), ea);
			case 0o40: // BTST #<data>,Abs.W
				return data = this.fetch16(), this.btst8(data, this.read8(this.fetch16s()));
			case 0o41: // BTST #<data>,Abs.L
				return data = this.fetch16(), this.btst8(data, this.read8(this.fetch32()));
			case 0o42: // BTST #<data>,d(PC)
				return data = this.fetch16(), this.btst8(data, this.read8(this.disp(this.pc)));
			case 0o43: // BTST #<data>,d(PC,Xi)
				return data = this.fetch16(), this.btst8(data, this.read8(this.index(this.pc)));
			case 0o50: // EORI.B #<data>,Abs.W
				return data = this.fetch16(), ea = this.fetch16s(), this.write8(this.eor8(data, this.read8(ea)), ea);
			case 0o51: // EORI.B #<data>,Abs.L
				return data = this.fetch16(), ea = this.fetch32(), this.write8(this.eor8(data, this.read8(ea)), ea);
			case 0o54: // EORI #<data>,CCR
				return void(this.sr ^= this.fetch16() & 0xff);
			case 0o60: // CMPI.B #<data>,Abs.W
				return data = this.fetch16(), this.cmp8(data, this.read8(this.fetch16s()));
			case 0o61: // CMPI.B #<data>,Abs.L
				return data = this.fetch16(), this.cmp8(data, this.read8(this.fetch32()));
			}
			return this.exception(4);
		case 0o10:
			switch (x) {
			case 0: // ORI.W #<data>,Dy
				return void(this.d[y] = this.d[y] & ~0xffff | this.or16(this.fetch16(), this.d[y]));
			case 1: // ANDI.W #<data>,Dy
				return void(this.d[y] = this.d[y] & ~0xffff | this.and16(this.fetch16(), this.d[y]));
			case 2: // SUBI.W #<data>,Dy
				return void(this.d[y] = this.d[y] & ~0xffff | this.sub16(this.fetch16(), this.d[y]));
			case 3: // ADDI.W #<data>,Dy
				return void(this.d[y] = this.d[y] & ~0xffff | this.add16(this.fetch16(), this.d[y]));
			case 4: // BCHG #<data>,Dy
				return void(this.d[y] = this.bchg32(this.fetch16(), this.d[y]));
			case 5: // EORI.W #<data>,Dy
				return void(this.d[y] = this.d[y] & ~0xffff | this.eor16(this.fetch16(), this.d[y]));
			case 6: // CMPI.W #<data>,Dy
				return this.cmp16(this.fetch16(), this.d[y]);
			}
			return this.exception(4);
		case 0o12:
			switch (x) {
			case 0: // ORI.W #<data>,(Ay)
				return this.write16(this.or16(this.fetch16(), this.read16(this.a[y])), this.a[y]);
			case 1: // ANDI.W #<data>,(Ay)
				return this.write16(this.and16(this.fetch16(), this.read16(this.a[y])), this.a[y]);
			case 2: // SUBI.W #<data>,(Ay)
				return this.write16(this.sub16(this.fetch16(), this.read16(this.a[y])), this.a[y]);
			case 3: // ADDI.W #<data>,(Ay)
				return this.write16(this.add16(this.fetch16(), this.read16(this.a[y])), this.a[y]);
			case 4: // BCHG #<data>,(Ay)
				return this.write8(this.bchg8(this.fetch16(), this.read8(this.a[y])), this.a[y]);
			case 5: // EORI.W #<data>,(Ay)
				return this.write16(this.eor16(this.fetch16(), this.read16(this.a[y])), this.a[y]);
			case 6: // CMPI.W #<data>,(Ay)
				return this.cmp16(this.fetch16(), this.read16(this.a[y]));
			}
			return this.exception(4);
		case 0o13:
			switch (x) {
			case 0: // ORI.W #<data>,(Ay)+
				return this.write16(this.or16(this.fetch16(), this.read16(this.a[y])), this.a[y]), void(this.a[y] += 2);
			case 1: // ANDI.W #<data>,(Ay)+
				return this.write16(this.and16(this.fetch16(), this.read16(this.a[y])), this.a[y]), void(this.a[y] += 2);
			case 2: // SUBI.W #<data>,(Ay)+
				return this.write16(this.sub16(this.fetch16(), this.read16(this.a[y])), this.a[y]), void(this.a[y] += 2);
			case 3: // ADDI.W #<data>,(Ay)+
				return this.write16(this.add16(this.fetch16(), this.read16(this.a[y])), this.a[y]), void(this.a[y] += 2);
			case 4: // BCHG #<data>,(Ay)+
				return this.write8(this.bchg8(this.fetch16(), this.read8(this.a[y])), this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 5: // EORI.W #<data>,(Ay)+
				return this.write16(this.eor16(this.fetch16(), this.read16(this.a[y])), this.a[y]), void(this.a[y] += 2);
			case 6: // CMPI.W #<data>,(Ay)+
				return this.cmp16(this.fetch16(), this.read16(this.a[y])), void(this.a[y] += 2);
			}
			return this.exception(4);
		case 0o14:
			switch (x) {
			case 0: // ORI.W #<data>,-(Ay)
				return this.a[y] -= 2, this.write16(this.or16(this.fetch16(), this.read16(this.a[y])), this.a[y]);
			case 1: // ANDI.W #<data>,-(Ay)
				return this.a[y] -= 2, this.write16(this.and16(this.fetch16(), this.read16(this.a[y])), this.a[y]);
			case 2: // SUBI.W #<data>,-(Ay)
				return this.a[y] -= 2, this.write16(this.sub16(this.fetch16(), this.read16(this.a[y])), this.a[y]);
			case 3: // ADDI.W #<data>,-(Ay)
				return this.a[y] -= 2, this.write16(this.add16(this.fetch16(), this.read16(this.a[y])), this.a[y]);
			case 4: // BCHG #<data>,-(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.write8(this.bchg8(this.fetch16(), this.read8(this.a[y])), this.a[y]);
			case 5: // EORI.W #<data>,-(Ay)
				return this.a[y] -= 2, this.write16(this.eor16(this.fetch16(), this.read16(this.a[y])), this.a[y]);
			case 6: // CMPI.W #<data>,-(Ay)
				return this.a[y] -= 2, this.cmp16(this.fetch16(), this.read16(this.a[y]));
			}
			return this.exception(4);
		case 0o15:
			switch (x) {
			case 0: // ORI.W #<data>,d(Ay)
				return data = this.fetch16(), ea = this.disp(this.a[y]), this.write16(this.or16(data, this.read16(ea)), ea);
			case 1: // ANDI.W #<data>,d(Ay)
				return data = this.fetch16(), ea = this.disp(this.a[y]), this.write16(this.and16(data, this.read16(ea)), ea);
			case 2: // SUBI.W #<data>,d(Ay)
				return data = this.fetch16(), ea = this.disp(this.a[y]), this.write16(this.sub16(data, this.read16(ea)), ea);
			case 3: // ADDI.W #<data>,d(Ay)
				return data = this.fetch16(), ea = this.disp(this.a[y]), this.write16(this.add16(data, this.read16(ea)), ea);
			case 4: // BCHG #<data>,d(Ay)
				return data = this.fetch16(), ea = this.disp(this.a[y]), this.write8(this.bchg8(data, this.read8(ea)), ea);
			case 5: // EORI.W #<data>,d(Ay)
				return data = this.fetch16(), ea = this.disp(this.a[y]), this.write16(this.eor16(data, this.read16(ea)), ea);
			case 6: // CMPI.W #<data>,d(Ay)
				return data = this.fetch16(), ea = this.disp(this.a[y]), this.cmp16(data, this.read16(ea));
			}
			return this.exception(4);
		case 0o16:
			switch (x) {
			case 0: // ORI.W #<data>,d(Ay,Xi)
				return data = this.fetch16(), ea = this.index(this.a[y]), this.write16(this.or16(data, this.read16(ea)), ea);
			case 1: // ANDI.W #<data>,d(Ay,Xi)
				return data = this.fetch16(), ea = this.index(this.a[y]), this.write16(this.and16(data, this.read16(ea)), ea);
			case 2: // SUBI.W #<data>,d(Ay,Xi)
				return data = this.fetch16(), ea = this.index(this.a[y]), this.write16(this.sub16(data, this.read16(ea)), ea);
			case 3: // ADDI.W #<data>,d(Ay,Xi)
				return data = this.fetch16(), ea = this.index(this.a[y]), this.write16(this.add16(data, this.read16(ea)), ea);
			case 4: // BCHG #<data>,d(Ay,Xi)
				return data = this.fetch16(), ea = this.index(this.a[y]), this.write8(this.bchg8(data, this.read8(ea)), ea);
			case 5: // EORI.W #<data>,d(Ay,Xi)
				return data = this.fetch16(), ea = this.index(this.a[y]), this.write16(this.eor16(data, this.read16(ea)), ea);
			case 6: // CMPI.W #<data>,d(Ay,Xi)
				return data = this.fetch16(), ea = this.index(this.a[y]), this.cmp16(data, this.read16(ea));
			}
			return this.exception(4);
		case 0o17:
			switch (x << 3 | y) {
			case 0o00: // ORI.W #<data>,Abs.W
				return data = this.fetch16(), ea = this.fetch16s(), this.write16(this.or16(data, this.read16(ea)), ea);
			case 0o01: // ORI.W #<data>,Abs.L
				return data = this.fetch16(), ea = this.fetch32(), this.write16(this.or16(data, this.read16(ea)), ea);
			case 0o04: // ORI #<data>,SR
				return ~this.sr & 0x2000 ? this.exception(8) : void(this.sr |= this.fetch16());
			case 0o10: // ANDI.W #<data>,Abs.W
				return data = this.fetch16(), ea = this.fetch16s(), this.write16(this.and16(data, this.read16(ea)), ea);
			case 0o11: // ANDI.W #<data>,Abs.L
				return data = this.fetch16(), ea = this.fetch32(), this.write16(this.and16(data, this.read16(ea)), ea);
			case 0o14: // ANDI #<data>,SR
				return ~this.sr & 0x2000 ? this.exception(8) : (this.sr &= this.fetch16(), void(~this.sr & 0x2000 && (this.ssp = this.a[7], this.a[7] = this.usp)));
			case 0o20: // SUBI.W #<data>,Abs.W
				return data = this.fetch16(), ea = this.fetch16s(), this.write16(this.sub16(data, this.read16(ea)), ea);
			case 0o21: // SUBI.W #<data>,Abs.L
				return data = this.fetch16(), ea = this.fetch32(), this.write16(this.sub16(data, this.read16(ea)), ea);
			case 0o30: // ADDI.W #<data>,Abs.W
				return data = this.fetch16(), ea = this.fetch16s(), this.write16(this.add16(data, this.read16(ea)), ea);
			case 0o31: // ADDI.W #<data>,Abs.L
				return data = this.fetch16(), ea = this.fetch32(), this.write16(this.add16(data, this.read16(ea)), ea);
			case 0o40: // BCHG #<data>,Abs.W
				return data = this.fetch16(), ea = this.fetch16s(), this.write8(this.bchg8(data, this.read8(ea)), ea);
			case 0o41: // BCHG #<data>,Abs.L
				return data = this.fetch16(), ea = this.fetch32(), this.write8(this.bchg8(data, this.read8(ea)), ea);
			case 0o50: // EORI.W #<data>,Abs.W
				return data = this.fetch16(), ea = this.fetch16s(), this.write16(this.eor16(data, this.read16(ea)), ea);
			case 0o51: // EORI.W #<data>,Abs.L
				return data = this.fetch16(), ea = this.fetch32(), this.write16(this.eor16(data, this.read16(ea)), ea);
			case 0o54: // EORI #<data>,SR
				return ~this.sr & 0x2000 ? this.exception(8) : (this.sr ^= this.fetch16(), void(~this.sr & 0x2000 && (this.ssp = this.a[7], this.a[7] = this.usp)));
			case 0o60: // CMPI.W #<data>,Abs.W
				return data = this.fetch16(), this.cmp16(data, this.read16(this.fetch16s()));
			case 0o61: // CMPI.W #<data>,Abs.L
				return data = this.fetch16(), this.cmp16(data, this.read16(this.fetch32()));
			}
			return this.exception(4);
		case 0o20:
			switch (x) {
			case 0: // ORI.L #<data>,Dy
				return void(this.d[y] = this.or32(this.fetch32(), this.d[y]));
			case 1: // ANDI.L #<data>,Dy
				return void(this.d[y] = this.and32(this.fetch32(), this.d[y]));
			case 2: // SUBI.L #<data>,Dy
				return void(this.d[y] = this.sub32(this.fetch32(), this.d[y]));
			case 3: // ADDI.L #<data>,Dy
				return void(this.d[y] = this.add32(this.fetch32(), this.d[y]));
			case 4: // BCLR #<data>,Dy
				return void(this.d[y] = this.bclr32(this.fetch16(), this.d[y]));
			case 5: // EORI.L #<data>,Dy
				return void(this.d[y] = this.eor32(this.fetch32(), this.d[y]));
			case 6: // CMPI.L #<data>,Dy
				return this.cmp32(this.fetch32(), this.d[y]);
			}
			return this.exception(4);
		case 0o22:
			switch (x) {
			case 0: // ORI.L #<data>,(Ay)
				return this.write32(this.or32(this.fetch32(), this.read32(this.a[y])), this.a[y]);
			case 1: // ANDI.L #<data>,(Ay)
				return this.write32(this.and32(this.fetch32(), this.read32(this.a[y])), this.a[y]);
			case 2: // SUBI.L #<data>,(Ay)
				return this.write32(this.sub32(this.fetch32(), this.read32(this.a[y])), this.a[y]);
			case 3: // ADDI.L #<data>,(Ay)
				return this.write32(this.add32(this.fetch32(), this.read32(this.a[y])), this.a[y]);
			case 4: // BCLR #<data>,(Ay)
				return this.write8(this.bclr8(this.fetch16(), this.read8(this.a[y])), this.a[y]);
			case 5: // EORI.L #<data>,(Ay)
				return this.write32(this.eor32(this.fetch32(), this.read32(this.a[y])), this.a[y]);
			case 6: // CMPI.L #<data>,(Ay)
				return this.cmp32(this.fetch32(), this.read32(this.a[y]));
			}
			return this.exception(4);
		case 0o23:
			switch (x) {
			case 0: // ORI.L #<data>,(Ay)+
				return this.write32(this.or32(this.fetch32(), this.read32(this.a[y])), this.a[y]), void(this.a[y] += 4);
			case 1: // ANDI.L #<data>,(Ay)+
				return this.write32(this.and32(this.fetch32(), this.read32(this.a[y])), this.a[y]), void(this.a[y] += 4);
			case 2: // SUBI.L #<data>,(Ay)+
				return this.write32(this.sub32(this.fetch32(), this.read32(this.a[y])), this.a[y]), void(this.a[y] += 4);
			case 3: // ADDI.L #<data>,(Ay)+
				return this.write32(this.add32(this.fetch32(), this.read32(this.a[y])), this.a[y]), void(this.a[y] += 4);
			case 4: // BCLR #<data>,(Ay)+
				return this.write8(this.bclr8(this.fetch16(), this.read8(this.a[y])), this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 5: // EORI.L #<data>,(Ay)+
				return this.write32(this.eor32(this.fetch32(), this.read32(this.a[y])), this.a[y]), void(this.a[y] += 4);
			case 6: // CMPI.L #<data>,(Ay)+
				return this.cmp32(this.fetch32(), this.read32(this.a[y])), void(this.a[y] += 4);
			}
			return this.exception(4);
		case 0o24:
			switch (x) {
			case 0: // ORI.L #<data>,-(Ay)
				return this.a[y] -= 4, this.write32(this.or32(this.fetch32(), this.read32(this.a[y])), this.a[y]);
			case 1: // ANDI.L #<data>,-(Ay)
				return this.a[y] -= 4, this.write32(this.and32(this.fetch32(), this.read32(this.a[y])), this.a[y]);
			case 2: // SUBI.L #<data>,-(Ay)
				return this.a[y] -= 4, this.write32(this.sub32(this.fetch32(), this.read32(this.a[y])), this.a[y]);
			case 3: // ADDI.L #<data>,-(Ay)
				return this.a[y] -= 4, this.write32(this.add32(this.fetch32(), this.read32(this.a[y])), this.a[y]);
			case 4: // BCLR #<data>,-(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.write8(this.bclr8(this.fetch16(), this.read8(this.a[y])), this.a[y]);
			case 5: // EORI.L #<data>,-(Ay)
				return this.a[y] -= 4, this.write32(this.eor32(this.fetch32(), this.read32(this.a[y])), this.a[y]);
			case 6: // CMPI.L #<data>,-(Ay)
				return this.a[y] -= 4, this.cmp32(this.fetch32(), this.read32(this.a[y]));
			}
			return this.exception(4);
		case 0o25:
			switch (x) {
			case 0: // ORI.L #<data>,d(Ay)
				return data = this.fetch32(), ea = this.disp(this.a[y]), this.write32(this.or32(data, this.read32(ea)), ea);
			case 1: // ANDI.L #<data>,d(Ay)
				return data = this.fetch32(), ea = this.disp(this.a[y]), this.write32(this.and32(data, this.read32(ea)), ea);
			case 2: // SUBI.L #<data>,d(Ay)
				return data = this.fetch32(), ea = this.disp(this.a[y]), this.write32(this.sub32(data, this.read32(ea)), ea);
			case 3: // ADDI.L #<data>,d(Ay)
				return data = this.fetch32(), ea = this.disp(this.a[y]), this.write32(this.add32(data, this.read32(ea)), ea);
			case 4: // BCLR #<data>,d(Ay)
				return data = this.fetch16(), ea = this.disp(this.a[y]), this.write8(this.bclr8(data, this.read8(ea)), ea);
			case 5: // EORI.L #<data>,d(Ay)
				return data = this.fetch32(), ea = this.disp(this.a[y]), this.write32(this.eor32(data, this.read32(ea)), ea);
			case 6: // CMPI.L #<data>,d(Ay)
				return data = this.fetch32(), ea = this.disp(this.a[y]), this.cmp32(data, this.read32(ea));
			}
			return this.exception(4);
		case 0o26:
			switch (x) {
			case 0: // ORI.L #<data>,d(Ay,Xi)
				return data = this.fetch32(), ea = this.index(this.a[y]), this.write32(this.or32(data, this.read32(ea)), ea);
			case 1: // ANDI.L #<data>,d(Ay,Xi)
				return data = this.fetch32(), ea = this.index(this.a[y]), this.write32(this.and32(data, this.read32(ea)), ea);
			case 2: // SUBI.L #<data>,d(Ay,Xi)
				return data = this.fetch32(), ea = this.index(this.a[y]), this.write32(this.sub32(data, this.read32(ea)), ea);
			case 3: // ADDI.L #<data>,d(Ay,Xi)
				return data = this.fetch32(), ea = this.index(this.a[y]), this.write32(this.add32(data, this.read32(ea)), ea);
			case 4: // BCLR #<data>,d(Ay,Xi)
				return data = this.fetch16(), ea = this.index(this.a[y]), this.write8(this.bclr8(data, this.read8(ea)), ea);
			case 5: // EORI.L #<data>,d(Ay,Xi)
				return data = this.fetch32(), ea = this.index(this.a[y]), this.write32(this.eor32(data, this.read32(ea)), ea);
			case 6: // CMPI.L #<data>,d(Ay,Xi)
				return data = this.fetch32(), ea = this.index(this.a[y]), this.cmp32(data, this.read32(ea));
			}
			return this.exception(4);
		case 0o27:
			switch (x << 3 | y) {
			case 0o00: // ORI.L #<data>,Abs.W
				return data = this.fetch32(), ea = this.fetch16s(), this.write32(this.or32(data, this.read32(ea)), ea);
			case 0o01: // ORI.L #<data>,Abs.L
				return data = this.fetch32(), ea = this.fetch32(), this.write32(this.or32(data, this.read32(ea)), ea);
			case 0o10: // ANDI.L #<data>,Abs.W
				return data = this.fetch32(), ea = this.fetch16s(), this.write32(this.and32(data, this.read32(ea)), ea);
			case 0o11: // ANDI.L #<data>,Abs.L
				return data = this.fetch32(), ea = this.fetch32(), this.write32(this.and32(data, this.read32(ea)), ea);
			case 0o20: // SUBI.L #<data>,Abs.W
				return data = this.fetch32(), ea = this.fetch16s(), this.write32(this.sub32(data, this.read32(ea)), ea);
			case 0o21: // SUBI.L #<data>,Abs.L
				return data = this.fetch32(), ea = this.fetch32(), this.write32(this.sub32(data, this.read32(ea)), ea);
			case 0o30: // ADDI.L #<data>,Abs.W
				return data = this.fetch32(), ea = this.fetch16s(), this.write32(this.add32(data, this.read32(ea)), ea);
			case 0o31: // ADDI.L #<data>,Abs.L
				return data = this.fetch32(), ea = this.fetch32(), this.write32(this.add32(data, this.read32(ea)), ea);
			case 0o40: // BCLR #<data>,Abs.W
				return data = this.fetch16(), ea = this.fetch16s(), this.write8(this.bclr8(data, this.read8(ea)), ea);
			case 0o41: // BCLR #<data>,Abs.L
				return data = this.fetch16(), ea = this.fetch32(), this.write8(this.bclr8(data, this.read8(ea)), ea);
			case 0o50: // EORI.L #<data>,Abs.W
				return data = this.fetch32(), ea = this.fetch16s(), this.write32(this.eor32(data, this.read32(ea)), ea);
			case 0o51: // EORI.L #<data>,Abs.L
				return data = this.fetch32(), ea = this.fetch32(), this.write32(this.eor32(data, this.read32(ea)), ea);
			case 0o60: // CMPI.L #<data>,Abs.W
				return data = this.fetch32(), this.cmp32(data, this.read32(this.fetch16s()));
			case 0o61: // CMPI.L #<data>,Abs.L
				return data = this.fetch32(), this.cmp32(data, this.read32(this.fetch32()));
			}
			return this.exception(4);
		case 0o30: // BSET #<data>,Dy
			return x !== 4 ? this.exception(4) : void(this.d[y] = this.bset32(this.fetch16(), this.d[y]));
		case 0o32: // BSET #<data>,(Ay)
			return x !== 4 ? this.exception(4) : this.write8(this.bset8(this.fetch16(), this.read8(this.a[y])), this.a[y]);
		case 0o33: // BSET #<data>,(Ay)+
			return x !== 4 ? this.exception(4) : (this.write8(this.bset8(this.fetch16(), this.read8(this.a[y])), this.a[y]), void(this.a[y] += y < 7 ? 1 : 2));
		case 0o34: // BSET #<data>,-(Ay)
			return x !== 4 ? this.exception(4) : (this.a[y] -= y < 7 ? 1 : 2, this.write8(this.bset8(this.fetch16(), this.read8(this.a[y])), this.a[y]));
		case 0o35: // BSET #<data>,d(Ay)
			return x !== 4 ? this.exception(4) : (data = this.fetch16(), ea = this.disp(this.a[y]), this.write8(this.bset8(data, this.read8(ea)), ea));
		case 0o36: // BSET #<data>,d(Ay,Xi)
			return x !== 4 ? this.exception(4) : (data = this.fetch16(), ea = this.index(this.a[y]), this.write8(this.bset8(data, this.read8(ea)), ea));
		case 0o37:
			switch (x << 3 | y) {
			case 0o40: // BSET #<data>,Abs.W
				return data = this.fetch16(), ea = this.fetch16s(), this.write8(this.bset8(data, this.read8(ea)), ea);
			case 0o41: // BSET #<data>,Abs.L
				return data = this.fetch16(), ea = this.fetch32(), this.write8(this.bset8(data, this.read8(ea)), ea);
			}
			return this.exception(4);
		case 0o40: // BTST Dx,Dy
			return this.btst32(this.d[x], this.d[y]);
		case 0o41: // MOVEP.W d(Ay),Dx
			return ea = this.disp(this.a[y]), void(this.d[x] = this.d[x] & ~0xffff | this.read8(ea) << 8 | this.read8(ea + 2 | 0));
		case 0o42: // BTST Dx,(Ay)
			return this.btst8(this.d[x], this.read8(this.a[y]));
		case 0o43: // BTST Dx,(Ay)+
			return this.btst8(this.d[x], this.read8(this.a[y])), void(this.a[y] += y < 7 ? 1 : 2);
		case 0o44: // BTST Dx,-(Ay)
			return this.a[y] -= y < 7 ? 1 : 2, this.btst8(this.d[x], this.read8(this.a[y]));
		case 0o45: // BTST Dx,d(Ay)
			return ea = this.disp(this.a[y]), this.btst8(this.d[x], this.read8(ea));
		case 0o46: // BTST Dx,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.btst8(this.d[x], this.read8(ea));
		case 0o47: // BTST Dx,Abs...
			return y >= 4 ? this.exception(4) : this.btst8(this.d[x], this.rop8());
		case 0o50: // BCHG Dx,Dy
			return void(this.d[y] = this.bchg32(this.d[x], this.d[y]));
		case 0o51: // MOVEP.L d(Ay),Dx
			return ea = this.disp(this.a[y]), void(this.d[x] = this.read8(ea) << 24 | this.read8(ea + 2 | 0) << 16 | this.read8(ea + 4 | 0) << 8 | this.read8(ea + 6 | 0));
		case 0o52: // BCHG Dx,(Ay)
			return this.write8(this.bchg8(this.d[x], this.read8(this.a[y])), this.a[y]);
		case 0o53: // BCHG Dx,(Ay)+
			return this.write8(this.bchg8(this.d[x], this.read8(this.a[y])), this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
		case 0o54: // BCHG Dx,-(Ay)
			return this.a[y] -= y < 7 ? 1 : 2, this.write8(this.bchg8(this.d[x], this.read8(this.a[y])), this.a[y]);
		case 0o55: // BCHG Dx,d(Ay)
			return ea = this.disp(this.a[y]), this.write8(this.bchg8(this.d[x], this.read8(ea)), ea);
		case 0o56: // BCHG Dx,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write8(this.bchg8(this.d[x], this.read8(ea)), ea);
		case 0o57:
			switch (y) {
			case 0: // BCHG Dx,Abs.W
				return ea = this.fetch16s(), this.write8(this.bchg8(this.d[x], this.read8(ea)), ea);
			case 1: // BCHG Dx,Abs.L
				return ea = this.fetch32(), this.write8(this.bchg8(this.d[x], this.read8(ea)), ea);
			}
			return this.exception(4);
		case 0o60: // BCLR Dx,Dy
			return void(this.d[y] = this.bclr32(this.d[x], this.d[y]));
		case 0o61: // MOVEP.W Dx,d(Ay)
			return ea = this.disp(this.a[y]), this.write8(this.d[x] >> 8, ea), this.write8(this.d[x], ea + 2 | 0);
		case 0o62: // BCLR Dx,(Ay)
			return this.write8(this.bclr8(this.d[x], this.read8(this.a[y])), this.a[y]);
		case 0o63: // BCLR Dx,(Ay)+
			return this.write8(this.bclr8(this.d[x], this.read8(this.a[y])), this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
		case 0o64: // BCLR Dx,-(Ay)
			return this.a[y] -= y < 7 ? 1 : 2, this.write8(this.bclr8(this.d[x], this.read8(this.a[y])), this.a[y]);
		case 0o65: // BCLR Dx,d(Ay)
			return ea = this.disp(this.a[y]), this.write8(this.bclr8(this.d[x], this.read8(ea)), ea);
		case 0o66: // BCLR Dx,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write8(this.bclr8(this.d[x], this.read8(ea)), ea);
		case 0o67:
			switch (y) {
			case 0: // BCLR Dx,Abs.W
				return ea = this.fetch16s(), this.write8(this.bclr8(this.d[x], this.read8(ea)), ea);
			case 1: // BCLR Dx,Abs.L
				return ea = this.fetch32(), this.write8(this.bclr8(this.d[x], this.read8(ea)), ea);
			}
			return this.exception(4);
		case 0o70: // BSET Dx,Dy
			return void(this.d[y] = this.bset32(this.d[x], this.d[y]));
		case 0o71: // MOVEP.L Dx,d(Ay)
			return ea = this.disp(this.a[y]), this.write8(this.d[x] >> 24, ea), this.write8(this.d[x] >> 16, ea + 2 | 0), this.write8(this.d[x] >> 8, ea + 4 | 0), this.write8(this.d[x], ea + 6 | 0);
		case 0o72: // BSET Dx,(Ay)
			return this.write8(this.bset8(this.d[x], this.read8(this.a[y])), this.a[y]);
		case 0o73: // BSET Dx,(Ay)+
			return this.write8(this.bset8(this.d[x], this.read8(this.a[y])), this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
		case 0o74: // BSET Dx,-(Ay)
			return this.a[y] -= y < 7 ? 1 : 2, this.write8(this.bset8(this.d[x], this.read8(this.a[y])), this.a[y]);
		case 0o75: // BSET Dx,d(Ay)
			return ea = this.disp(this.a[y]), this.write8(this.bset8(this.d[x], this.read8(ea)), ea);
		case 0o76: // BSET Dx,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write8(this.bset8(this.d[x], this.read8(ea)), ea);
		case 0o77:
			switch (y) {
			case 0: // BSET Dx,Abs.W
				return ea = this.fetch16s(), this.write8(this.bset8(this.d[x], this.read8(ea)), ea);
			case 1: // BSET Dx,Abs.L
				return ea = this.fetch32(), this.write8(this.bset8(this.d[x], this.read8(ea)), ea);
			}
			return this.exception(4);
		default:
			return this.exception(4);
		}
	}

	execute_1() { // Move Byte
		const x = this.op >> 9 & 7, y = this.op & 7;
		let src;
		switch (this.op >> 3 & 0o77) {
		case 0o00: // MOVE.B Dy,Dx
			return void(this.d[x] = this.d[x] & ~0xff | this.or8(0, this.d[y]));
		case 0o02: // MOVE.B (Ay),Dx
			return src = this.read8(this.a[y]), void(this.d[x] = this.d[x] & ~0xff | this.or8(0, src));
		case 0o03: // MOVE.B (Ay)+,Dx
			return src = this.read8(this.a[y]), this.a[y] += y < 7 ? 1 : 2, void(this.d[x] = this.d[x] & ~0xff | this.or8(0, src));
		case 0o04: // MOVE.B -(Ay),Dx
			return this.a[y] -= y < 7 ? 1 : 2, src = this.read8(this.a[y]), void(this.d[x] = this.d[x] & ~0xff | this.or8(0, src));
		case 0o05: // MOVE.B d(Ay),Dx
			return src = this.read8(this.disp(this.a[y])), void(this.d[x] = this.d[x] & ~0xff | this.or8(0, src));
		case 0o06: // MOVE.B d(Ay,Xi),Dx
			return src = this.read8(this.index(this.a[y])), void(this.d[x] = this.d[x] & ~0xff | this.or8(0, src));
		case 0o07: // MOVE.B Abs...,Dx
			return y >= 5 ? this.exception(4) : (src = this.rop8(), void(this.d[x] = this.d[x] & ~0xff | this.or8(0, src)));
		case 0o20: // MOVE.B Dy,(Ax)
			return src = this.d[y], this.write8(this.or8(0, src), this.a[x]);
		case 0o22: // MOVE.B (Ay),(Ax)
			return src = this.read8(this.a[y]), this.write8(this.or8(0, src), this.a[x]);
		case 0o23: // MOVE.B (Ay)+,(Ax)
			return src = this.read8(this.a[y]), this.a[y] += y < 7 ? 1 : 2, this.write8(this.or8(0, src), this.a[x]);
		case 0o24: // MOVE.B -(Ay),(Ax)
			return this.a[y] -= y < 7 ? 1 : 2, src = this.read8(this.a[y]), this.write8(this.or8(0, src), this.a[x]);
		case 0o25: // MOVE.B d(Ay),(Ax)
			return src = this.read8(this.disp(this.a[y])), this.write8(this.or8(0, src), this.a[x]);
		case 0o26: // MOVE.B d(Ay,Xi),(Ax)
			return src = this.read8(this.index(this.a[y])), this.write8(this.or8(0, src), this.a[x]);
		case 0o27: // MOVE.B Abs...,(Ax)
			return y >= 5 ? this.exception(4) : (src = this.rop8(), this.write8(this.or8(0, src), this.a[x]));
		case 0o30: // MOVE.B Dy,(Ax)+
			return src = this.d[y], this.write8(this.or8(0, src), this.a[x]), void(this.a[x] += x < 7 ? 1 : 2);
		case 0o32: // MOVE.B (Ay),(Ax)+
			return src = this.read8(this.a[y]), this.write8(this.or8(0, src), this.a[x]), void(this.a[x] += x < 7 ? 1 : 2);
		case 0o33: // MOVE.B (Ay)+,(Ax)+
			return src = this.read8(this.a[y]), this.a[y] += y < 7 ? 1 : 2, this.write8(this.or8(0, src), this.a[x]), void(this.a[x] += x < 7 ? 1 : 2);
		case 0o34: // MOVE.B -(Ay),(Ax)+
			return this.a[y] -= y < 7 ? 1 : 2, src = this.read8(this.a[y]), this.write8(this.or8(0, src), this.a[x]), void(this.a[x] += x < 7 ? 1 : 2);
		case 0o35: // MOVE.B d(Ay),(Ax)+
			return src = this.read8(this.disp(this.a[y])), this.write8(this.or8(0, src), this.a[x]), void(this.a[x] += x < 7 ? 1 : 2);
		case 0o36: // MOVE.B d(Ay,Xi),(Ax)+
			return src = this.read8(this.index(this.a[y])), this.write8(this.or8(0, src), this.a[x]), void(this.a[x] += x < 7 ? 1 : 2);
		case 0o37: // MOVE.B Abs...,(Ax)+
			return y >= 5 ? this.exception(4) : (src = this.rop8(), this.write8(this.or8(0, src), this.a[x]), void(this.a[x] += x < 7 ? 1 : 2));
		case 0o40: // MOVE.B Dy,-(Ax)
			return src = this.d[y], this.a[x] -= x < 7 ? 1 : 2, this.write8(this.or8(0, src), this.a[x]);
		case 0o42: // MOVE.B (Ay),-(Ax)
			return src = this.read8(this.a[y]), this.a[x] -= x < 7 ? 1 : 2, this.write8(this.or8(0, src), this.a[x]);
		case 0o43: // MOVE.B (Ay)+,-(Ax)
			return src = this.read8(this.a[y]), this.a[y] += y < 7 ? 1 : 2, this.a[x] -= x < 7 ? 1 : 2, this.write8(this.or8(0, src), this.a[x]);
		case 0o44: // MOVE.B -(Ay),-(Ax)
			return this.a[y] -= y < 7 ? 1 : 2, src = this.read8(this.a[y]), this.a[x] -= x < 7 ? 1 : 2, this.write8(this.or8(0, src), this.a[x]);
		case 0o45: // MOVE.B d(Ay),-(Ax)
			return src = this.read8(this.disp(this.a[y])), this.a[x] -= x < 7 ? 1 : 2, this.write8(this.or8(0, src), this.a[x]);
		case 0o46: // MOVE.B d(Ay,Xi),-(Ax)
			return src = this.read8(this.index(this.a[y])), this.a[x] -= x < 7 ? 1 : 2, this.write8(this.or8(0, src), this.a[x]);
		case 0o47: // MOVE.B Abs...,-(Ax)
			return y >= 5 ? this.exception(4) : (src = this.rop8(), this.a[x] -= x < 7 ? 1 : 2, this.write8(this.or8(0, src), this.a[x]));
		case 0o50: // MOVE.B Dy,d(Ax)
			return src = this.d[y], this.write8(this.or8(0, src), this.disp(this.a[x]));
		case 0o52: // MOVE.B (Ay),d(Ax)
			return src = this.read8(this.a[y]), this.write8(this.or8(0, src), this.disp(this.a[x]));
		case 0o53: // MOVE.B (Ay)+,d(Ax)
			return src = this.read8(this.a[y]), this.a[y] += y < 7 ? 1 : 2, this.write8(this.or8(0, src), this.disp(this.a[x]));
		case 0o54: // MOVE.B -(Ay),d(Ax)
			return this.a[y] -= y < 7 ? 1 : 2, src = this.read8(this.a[y]), this.write8(this.or8(0, src), this.disp(this.a[x]));
		case 0o55: // MOVE.B d(Ay),d(Ax)
			return src = this.read8(this.disp(this.a[y])), this.write8(this.or8(0, src), this.disp(this.a[x]));
		case 0o56: // MOVE.B d(Ay,Xi),d(Ax)
			return src = this.read8(this.index(this.a[y])), this.write8(this.or8(0, src), this.disp(this.a[x]));
		case 0o57: // MOVE.B Abs...,d(Ax)
			return y >= 5 ? this.exception(4) : (src = this.rop8(), this.write8(this.or8(0, src), this.disp(this.a[x])));
		case 0o60: // MOVE.B Dy,d(Ax,Xi)
			return src = this.d[y], this.write8(this.or8(0, src), this.index(this.a[x]));
		case 0o62: // MOVE.B (Ay),d(Ax,Xi)
			return src = this.read8(this.a[y]), this.write8(this.or8(0, src), this.index(this.a[x]));
		case 0o63: // MOVE.B (Ay)+,d(Ax,Xi)
			return src = this.read8(this.a[y]), this.a[y] += y < 7 ? 1 : 2, this.write8(this.or8(0, src), this.index(this.a[x]));
		case 0o64: // MOVE.B -(Ay),d(Ax,Xi)
			return this.a[y] -= y < 7 ? 1 : 2, src = this.read8(this.a[y]), this.write8(this.or8(0, src), this.index(this.a[x]));
		case 0o65: // MOVE.B d(Ay),d(Ax,Xi)
			return src = this.read8(this.disp(this.a[y])), this.write8(this.or8(0, src), this.index(this.a[x]));
		case 0o66: // MOVE.B d(Ay,Xi),d(Ax,Xi)
			return src = this.read8(this.index(this.a[y])), this.write8(this.or8(0, src), this.index(this.a[x]));
		case 0o67: // MOVE.B Abs...,d(Ax,Xi)
			return y >= 5 ? this.exception(4) : (src = this.rop8(), this.write8(this.or8(0, src), this.index(this.a[x])));
		case 0o70:
			switch (x) {
			case 0: // MOVE.B Dy,Abs.W
				return src = this.d[y], this.write8(this.or8(0, src), this.fetch16s());
			case 1: // MOVE.B Dy,Abs.L
				return src = this.d[y], this.write8(this.or8(0, src), this.fetch32());
			}
			return this.exception(4);
		case 0o72:
			switch (x) {
			case 0: // MOVE.B (Ay),Abs.W
				return src = this.read8(this.a[y]), this.write8(this.or8(0, src), this.fetch16s());
			case 1: // MOVE.B (Ay),Abs.L
				return src = this.read8(this.a[y]), this.write8(this.or8(0, src), this.fetch32());
			}
			return this.exception(4);
		case 0o73:
			switch (x) {
			case 0: // MOVE.B (Ay)+,Abs.W
				return src = this.read8(this.a[y]), this.a[y] += y < 7 ? 1 : 2, this.write8(this.or8(0, src), this.fetch16s());
			case 1: // MOVE.B (Ay)+,Abs.L
				return src = this.read8(this.a[y]), this.a[y] += y < 7 ? 1 : 2, this.write8(this.or8(0, src), this.fetch32());
			}
			return this.exception(4);
		case 0o74:
			switch (x) {
			case 0: // MOVE.B -(Ay),Abs.W
				return this.a[y] -= y < 7 ? 1 : 2, src = this.read8(this.a[y]), this.write8(this.or8(0, src), this.fetch16s());
			case 1: // MOVE.B -(Ay),Abs.L
				return this.a[y] -= y < 7 ? 1 : 2, src = this.read8(this.a[y]), this.write8(this.or8(0, src), this.fetch32());
			}
			return this.exception(4);
		case 0o75:
			switch (x) {
			case 0: // MOVE.B d(Ay),Abs.W
				return src = this.read8(this.disp(this.a[y])), this.write8(this.or8(0, src), this.fetch16s());
			case 1: // MOVE.B d(Ay),Abs.L
				return src = this.read8(this.disp(this.a[y])), this.write8(this.or8(0, src), this.fetch32());
			}
			return this.exception(4);
		case 0o76:
			switch (x) {
			case 0: // MOVE.B d(Ay,Xi),Abs.W
				return src = this.read8(this.index(this.a[y])), this.write8(this.or8(0, src), this.fetch16s());
			case 1: // MOVE.B d(Ay,Xi),Abs.L
				return src = this.read8(this.index(this.a[y])), this.write8(this.or8(0, src), this.fetch32());
			}
			return this.exception(4);
		case 0o77:
			switch (x) {
			case 0: // MOVE.B Abs...,Abs.W
				return y >= 5 ? this.exception(4) : (src = this.rop8(), this.write8(this.or8(0, src), this.fetch16s()));
			case 1: // MOVE.B Abs...,Abs.L
				return y >= 5 ? this.exception(4) : (src = this.rop8(), this.write8(this.or8(0, src), this.fetch32()));
			}
			return this.exception(4);
		default:
			return this.exception(4);
		}
	}

	execute_2() { // Move Long
		const x = this.op >> 9 & 7, y = this.op & 7;
		let src;
		switch (this.op >> 3 & 0o77) {
		case 0o00: // MOVE.L Dy,Dx
			return void(this.d[x] = this.or32(0, this.d[y]));
		case 0o01: // MOVE.L Ay,Dx
			return void(this.d[x] = this.or32(0, this.a[y]));
		case 0o02: // MOVE.L (Ay),Dx
			return src = this.read32(this.a[y]), void(this.d[x] = this.or32(0, src));
		case 0o03: // MOVE.L (Ay)+,Dx
			return src = this.read32(this.a[y]), this.a[y] += 4, void(this.d[x] = this.or32(0, src));
		case 0o04: // MOVE.L -(Ay),Dx
			return this.a[y] -= 4, src = this.read32(this.a[y]), void(this.d[x] = this.or32(0, src));
		case 0o05: // MOVE.L d(Ay),Dx
			return src = this.read32(this.disp(this.a[y])), void(this.d[x] = this.or32(0, src));
		case 0o06: // MOVE.L d(Ay,Xi),Dx
			return src = this.read32(this.index(this.a[y])), void(this.d[x] = this.or32(0, src));
		case 0o07: // MOVE.L Abs...,Dx
			return y >= 5 ? this.exception(4) : (src = this.rop32(), void(this.d[x] = this.or32(0, src)));
		case 0o10: // MOVEA.L Dy,Ax
			return void(this.a[x] = this.d[y]);
		case 0o11: // MOVEA.L Ay,Ax
			return void(this.a[x] = this.a[y]);
		case 0o12: // MOVEA.L (Ay),Ax
			return src = this.read32(this.a[y]), void(this.a[x] = src);
		case 0o13: // MOVEA.L (Ay)+,Ax
			return src = this.read32(this.a[y]), this.a[y] += 4, void(this.a[x] = src);
		case 0o14: // MOVEA.L -(Ay),Ax
			return this.a[y] -= 4, src = this.read32(this.a[y]), void(this.a[x] = src);
		case 0o15: // MOVEA.L d(Ay),Ax
			return src = this.read32(this.disp(this.a[y])), void(this.a[x] = src);
		case 0o16: // MOVEA.L d(Ay,Xi),Ax
			return src = this.read32(this.index(this.a[y])), void(this.a[x] = src);
		case 0o17: // MOVEA.L Abs...,Ax
			return y >= 5 ? this.exception(4) : (src = this.rop32(), void(this.a[x] = src));
		case 0o20: // MOVE.L Dy,(Ax)
			return src = this.d[y], this.write32(this.or32(0, src), this.a[x]);
		case 0o21: // MOVE.L Ay,(Ax)
			return src = this.a[y], this.write32(this.or32(0, src), this.a[x]);
		case 0o22: // MOVE.L (Ay),(Ax)
			return src = this.read32(this.a[y]), this.write32(this.or32(0, src), this.a[x]);
		case 0o23: // MOVE.L (Ay)+,(Ax)
			return src = this.read32(this.a[y]), this.a[y] += 4, this.write32(this.or32(0, src), this.a[x]);
		case 0o24: // MOVE.L -(Ay),(Ax)
			return this.a[y] -= 4, src = this.read32(this.a[y]), this.write32(this.or32(0, src), this.a[x]);
		case 0o25: // MOVE.L d(Ay),(Ax)
			return src = this.read32(this.disp(this.a[y])), this.write32(this.or32(0, src), this.a[x]);
		case 0o26: // MOVE.L d(Ay,Xi),(Ax)
			return src = this.read32(this.index(this.a[y])), this.write32(this.or32(0, src), this.a[x]);
		case 0o27: // MOVE.L Abs...,(Ax)
			return y >= 5 ? this.exception(4) : (src = this.rop32(), this.write32(this.or32(0, src), this.a[x]));
		case 0o30: // MOVE.L Dy,(Ax)+
			return src = this.d[y], this.write32(this.or32(0, src), this.a[x]), void(this.a[x] += 4);
		case 0o31: // MOVE.L Ay,(Ax)+
			return src = this.a[y], this.write32(this.or32(0, src), this.a[x]), void(this.a[x] += 4);
		case 0o32: // MOVE.L (Ay),(Ax)+
			return src = this.read32(this.a[y]), this.write32(this.or32(0, src), this.a[x]), void(this.a[x] += 4);
		case 0o33: // MOVE.L (Ay)+,(Ax)+
			return src = this.read32(this.a[y]), this.a[y] += 4, this.write32(this.or32(0, src), this.a[x]), void(this.a[x] += 4);
		case 0o34: // MOVE.L -(Ay),(Ax)+
			return this.a[y] -= 4, src = this.read32(this.a[y]), this.write32(this.or32(0, src), this.a[x]), void(this.a[x] += 4);
		case 0o35: // MOVE.L d(Ay),(Ax)+
			return src = this.read32(this.disp(this.a[y])), this.write32(this.or32(0, src), this.a[x]), void(this.a[x] += 4);
		case 0o36: // MOVE.L d(Ay,Xi),(Ax)+
			return src = this.read32(this.index(this.a[y])), this.write32(this.or32(0, src), this.a[x]), void(this.a[x] += 4);
		case 0o37: // MOVE.L Abs...,(Ax)+
			return y >= 5 ? this.exception(4) : (src = this.rop32(), this.write32(this.or32(0, src), this.a[x]), void(this.a[x] += 4));
		case 0o40: // MOVE.L Dy,-(Ax)
			return src = this.d[y], this.a[x] -= 4, this.write32(this.or32(0, src), this.a[x]);
		case 0o41: // MOVE.L Ay,-(Ax)
			return src = this.a[y], this.a[x] -= 4, this.write32(this.or32(0, src), this.a[x]);
		case 0o42: // MOVE.L (Ay),-(Ax)
			return src = this.read32(this.a[y]), this.a[x] -= 4, this.write32(this.or32(0, src), this.a[x]);
		case 0o43: // MOVE.L (Ay)+,-(Ax)
			return src = this.read32(this.a[y]), this.a[y] += 4, this.a[x] -= 4, this.write32(this.or32(0, src), this.a[x]);
		case 0o44: // MOVE.L -(Ay),-(Ax)
			return this.a[y] -= 4, src = this.read32(this.a[y]), this.a[x] -= 4, this.write32(this.or32(0, src), this.a[x]);
		case 0o45: // MOVE.L d(Ay),-(Ax)
			return src = this.read32(this.disp(this.a[y])), this.a[x] -= 4, this.write32(this.or32(0, src), this.a[x]);
		case 0o46: // MOVE.L d(Ay,Xi),-(Ax)
			return src = this.read32(this.index(this.a[y])), this.a[x] -= 4, this.write32(this.or32(0, src), this.a[x]);
		case 0o47: // MOVE.L Abs...,-(Ax)
			return y >= 5 ? this.exception(4) : (src = this.rop32(), this.a[x] -= 4, this.write32(this.or32(0, src), this.a[x]));
		case 0o50: // MOVE.L Dy,d(Ax)
			return src = this.d[y], this.write32(this.or32(0, src), this.disp(this.a[x]));
		case 0o51: // MOVE.L Ay,d(Ax)
			return src = this.a[y], this.write32(this.or32(0, src), this.disp(this.a[x]));
		case 0o52: // MOVE.L (Ay),d(Ax)
			return src = this.read32(this.a[y]), this.write32(this.or32(0, src), this.disp(this.a[x]));
		case 0o53: // MOVE.L (Ay)+,d(Ax)
			return src = this.read32(this.a[y]), this.a[y] += 4, this.write32(this.or32(0, src), this.disp(this.a[x]));
		case 0o54: // MOVE.L -(Ay),d(Ax)
			return this.a[y] -= 4, src = this.read32(this.a[y]), this.write32(this.or32(0, src), this.disp(this.a[x]));
		case 0o55: // MOVE.L d(Ay),d(Ax)
			return src = this.read32(this.disp(this.a[y])), this.write32(this.or32(0, src), this.disp(this.a[x]));
		case 0o56: // MOVE.L d(Ay,Xi),d(Ax)
			return src = this.read32(this.index(this.a[y])), this.write32(this.or32(0, src), this.disp(this.a[x]));
		case 0o57: // MOVE.L Abs...,d(Ax)
			return y >= 5 ? this.exception(4) : (src = this.rop32(), this.write32(this.or32(0, src), this.disp(this.a[x])));
		case 0o60: // MOVE.L Dy,d(Ax,Xi)
			return src = this.d[y], this.write32(this.or32(0, src), this.index(this.a[x]));
		case 0o61: // MOVE.L Ay,d(Ax,Xi)
			return src = this.a[y], this.write32(this.or32(0, src), this.index(this.a[x]));
		case 0o62: // MOVE.L (Ay),d(Ax,Xi)
			return src = this.read32(this.a[y]), this.write32(this.or32(0, src), this.index(this.a[x]));
		case 0o63: // MOVE.L (Ay)+,d(Ax,Xi)
			return src = this.read32(this.a[y]), this.a[y] += 4, this.write32(this.or32(0, src), this.index(this.a[x]));
		case 0o64: // MOVE.L -(Ay),d(Ax,Xi)
			return this.a[y] -= 4, src = this.read32(this.a[y]), this.write32(this.or32(0, src), this.index(this.a[x]));
		case 0o65: // MOVE.L d(Ay),d(Ax,Xi)
			return src = this.read32(this.disp(this.a[y])), this.write32(this.or32(0, src), this.index(this.a[x]));
		case 0o66: // MOVE.L d(Ay,Xi),d(Ax,Xi)
			return src = this.read32(this.index(this.a[y])), this.write32(this.or32(0, src), this.index(this.a[x]));
		case 0o67: // MOVE.L Abs...,d(Ax,Xi)
			return y >= 5 ? this.exception(4) : (src = this.rop32(), this.write32(this.or32(0, src), this.index(this.a[x])));
		case 0o70:
			switch (x) {
			case 0: // MOVE.L Dy,Abs.W
				return src = this.d[y], this.write32(this.or32(0, src), this.fetch16s());
			case 1: // MOVE.L Dy,Abs.L
				return src = this.d[y], this.write32(this.or32(0, src), this.fetch32());
			}
			return this.exception(4);
		case 0o71:
			switch (x) {
			case 0: // MOVE.L Ay,Abs.W
				return src = this.a[y], this.write32(this.or32(0, src), this.fetch16s());
			case 1: // MOVE.L Ay,Abs.L
				return src = this.a[y], this.write32(this.or32(0, src), this.fetch32());
			}
			return this.exception(4);
		case 0o72:
			switch (x) {
			case 0: // MOVE.L (Ay),Abs.W
				return src = this.read32(this.a[y]), this.write32(this.or32(0, src), this.fetch16s());
			case 1: // MOVE.L (Ay),Abs.L
				return src = this.read32(this.a[y]), this.write32(this.or32(0, src), this.fetch32());
			}
			return this.exception(4);
		case 0o73:
			switch (x) {
			case 0: // MOVE.L (Ay)+,Abs.W
				return src = this.read32(this.a[y]), this.a[y] += 4, this.write32(this.or32(0, src), this.fetch16s());
			case 1: // MOVE.L (Ay)+,Abs.L
				return src = this.read32(this.a[y]), this.a[y] += 4, this.write32(this.or32(0, src), this.fetch32());
			}
			return this.exception(4);
		case 0o74:
			switch (x) {
			case 0: // MOVE.L -(Ay),Abs.W
				return this.a[y] -= 4, src = this.read32(this.a[y]), this.write32(this.or32(0, src), this.fetch16s());
			case 1: // MOVE.L -(Ay),Abs.L
				return this.a[y] -= 4, src = this.read32(this.a[y]), this.write32(this.or32(0, src), this.fetch32());
			}
			return this.exception(4);
		case 0o75:
			switch (x) {
			case 0: // MOVE.L d(Ay),Abs.W
				return src = this.read32(this.disp(this.a[y])), this.write32(this.or32(0, src), this.fetch16s());
			case 1: // MOVE.L d(Ay),Abs.L
				return src = this.read32(this.disp(this.a[y])), this.write32(this.or32(0, src), this.fetch32());
			}
			return this.exception(4);
		case 0o76:
			switch (x) {
			case 0: // MOVE.L d(Ay,Xi),Abs.W
				return src = this.read32(this.index(this.a[y])), this.write32(this.or32(0, src), this.fetch16s());
			case 1: // MOVE.L d(Ay,Xi),Abs.L
				return src = this.read32(this.index(this.a[y])), this.write32(this.or32(0, src), this.fetch32());
			}
			return this.exception(4);
		case 0o77:
			switch (x) {
			case 0: // MOVE.L Abs...,Abs.W
				return y >= 5 ? this.exception(4) : (src = this.rop32(), this.write32(this.or32(0, src), this.fetch16s()));
			case 1: // MOVE.L Abs...,Abs.L
				return y >= 5 ? this.exception(4) : (src = this.rop32(), this.write32(this.or32(0, src), this.fetch32()));
			}
			return this.exception(4);
		default:
			return this.exception(4);
		}
	}

	execute_3() { // Move Word
		const x = this.op >> 9 & 7, y = this.op & 7;
		let src;
		switch (this.op >> 3 & 0o77) {
		case 0o00: // MOVE.W Dy,Dx
			return void(this.d[x] = this.d[x] & ~0xffff | this.or16(0, this.d[y]));
		case 0o01: // MOVE.W Ay,Dx
			return void(this.d[x] = this.d[x] & ~0xffff | this.or16(0, this.a[y]));
		case 0o02: // MOVE.W (Ay),Dx
			return src = this.read16(this.a[y]), void(this.d[x] = this.d[x] & ~0xffff | this.or16(0, src));
		case 0o03: // MOVE.W (Ay)+,Dx
			return src = this.read16(this.a[y]), this.a[y] += 2, void(this.d[x] = this.d[x] & ~0xffff | this.or16(0, src));
		case 0o04: // MOVE.W -(Ay),Dx
			return this.a[y] -= 2, src = this.read16(this.a[y]), void(this.d[x] = this.d[x] & ~0xffff | this.or16(0, src));
		case 0o05: // MOVE.W d(Ay),Dx
			return src = this.read16(this.disp(this.a[y])), void(this.d[x] = this.d[x] & ~0xffff | this.or16(0, src));
		case 0o06: // MOVE.W d(Ay,Xi),Dx
			return src = this.read16(this.index(this.a[y])), void(this.d[x] = this.d[x] & ~0xffff | this.or16(0, src));
		case 0o07: // MOVE.W Abs...,Dx
			return y >= 5 ? this.exception(4) : (src = this.rop16(), void(this.d[x] = this.d[x] & ~0xffff | this.or16(0, src)));
		case 0o10: // MOVEA.W Dy,Ax
			return void(this.a[x] = this.d[y] << 16 >> 16);
		case 0o11: // MOVEA.W Ay,Ax
			return void(this.a[x] = this.a[y] << 16 >> 16);
		case 0o12: // MOVEA.W (Ay),Ax
			return src = this.read16(this.a[y]), void(this.a[x] = src << 16 >> 16);
		case 0o13: // MOVEA.W (Ay)+,Ax
			return src = this.read16(this.a[y]), this.a[y] += 2, void(this.a[x] = src << 16 >> 16);
		case 0o14: // MOVEA.W -(Ay),Ax
			return this.a[y] -= 2, src = this.read16(this.a[y]), void(this.a[x] = src << 16 >> 16);
		case 0o15: // MOVEA.W d(Ay),Ax
			return src = this.read16(this.disp(this.a[y])), void(this.a[x] = src << 16 >> 16);
		case 0o16: // MOVEA.W d(Ay,Xi),Ax
			return src = this.read16(this.index(this.a[y])), void(this.a[x] = src << 16 >> 16);
		case 0o17: // MOVEA.W Abs...,Ax
			return y >= 5 ? this.exception(4) : (src = this.rop16(), void(this.a[x] = src << 16 >> 16));
		case 0o20: // MOVE.W Dy,(Ax)
			return src = this.d[y], this.write16(this.or16(0, src), this.a[x]);
		case 0o21: // MOVE.W Ay,(Ax)
			return src = this.a[y], this.write16(this.or16(0, src), this.a[x]);
		case 0o22: // MOVE.W (Ay),(Ax)
			return src = this.read16(this.a[y]), this.write16(this.or16(0, src), this.a[x]);
		case 0o23: // MOVE.W (Ay)+,(Ax)
			return src = this.read16(this.a[y]), this.a[y] += 2, this.write16(this.or16(0, src), this.a[x]);
		case 0o24: // MOVE.W -(Ay),(Ax)
			return this.a[y] -= 2, src = this.read16(this.a[y]), this.write16(this.or16(0, src), this.a[x]);
		case 0o25: // MOVE.W d(Ay),(Ax)
			return src = this.read16(this.disp(this.a[y])), this.write16(this.or16(0, src), this.a[x]);
		case 0o26: // MOVE.W d(Ay,Xi),(Ax)
			return src = this.read16(this.index(this.a[y])), this.write16(this.or16(0, src), this.a[x]);
		case 0o27: // MOVE.W Abs...,(Ax)
			return y >= 5 ? this.exception(4) : (src = this.rop16(), this.write16(this.or16(0, src), this.a[x]));
		case 0o30: // MOVE.W Dy,(Ax)+
			return src = this.d[y], this.write16(this.or16(0, src), this.a[x]), void(this.a[x] += 2);
		case 0o31: // MOVE.W Ay,(Ax)+
			return src = this.a[y], this.write16(this.or16(0, src), this.a[x]), void(this.a[x] += 2);
		case 0o32: // MOVE.W (Ay),(Ax)+
			return src = this.read16(this.a[y]), this.write16(this.or16(0, src), this.a[x]), void(this.a[x] += 2);
		case 0o33: // MOVE.W (Ay)+,(Ax)+
			return src = this.read16(this.a[y]), this.a[y] += 2, this.write16(this.or16(0, src), this.a[x]), void(this.a[x] += 2);
		case 0o34: // MOVE.W -(Ay),(Ax)+
			return this.a[y] -= 2, src = this.read16(this.a[y]), this.write16(this.or16(0, src), this.a[x]), void(this.a[x] += 2);
		case 0o35: // MOVE.W d(Ay),(Ax)+
			return src = this.read16(this.disp(this.a[y])), this.write16(this.or16(0, src), this.a[x]), void(this.a[x] += 2);
		case 0o36: // MOVE.W d(Ay,Xi),(Ax)+
			return src = this.read16(this.index(this.a[y])), this.write16(this.or16(0, src), this.a[x]), void(this.a[x] += 2);
		case 0o37: // MOVE.W Abs...,(Ax)+
			return y >= 5 ? this.exception(4) : (src = this.rop16(), this.write16(this.or16(0, src), this.a[x]), void(this.a[x] += 2));
		case 0o40: // MOVE.W Dy,-(Ax)
			return src = this.d[y], this.a[x] -= 2, this.write16(this.or16(0, src), this.a[x]);
		case 0o41: // MOVE.W Ay,-(Ax)
			return src = this.a[y], this.a[x] -= 2, this.write16(this.or16(0, src), this.a[x]);
		case 0o42: // MOVE.W (Ay),-(Ax)
			return src = this.read16(this.a[y]), this.a[x] -= 2, this.write16(this.or16(0, src), this.a[x]);
		case 0o43: // MOVE.W (Ay)+,-(Ax)
			return src = this.read16(this.a[y]), this.a[y] += 2, this.a[x] -= 2, this.write16(this.or16(0, src), this.a[x]);
		case 0o44: // MOVE.W -(Ay),-(Ax)
			return this.a[y] -= 2, src = this.read16(this.a[y]), this.a[x] -= 2, this.write16(this.or16(0, src), this.a[x]);
		case 0o45: // MOVE.W d(Ay),-(Ax)
			return src = this.read16(this.disp(this.a[y])), this.a[x] -= 2, this.write16(this.or16(0, src), this.a[x]);
		case 0o46: // MOVE.W d(Ay,Xi),-(Ax)
			return src = this.read16(this.index(this.a[y])), this.a[x] -= 2, this.write16(this.or16(0, src), this.a[x]);
		case 0o47: // MOVE.W Abs...,-(Ax)
			return y >= 5 ? this.exception(4) : (src = this.rop16(), this.a[x] -= 2, this.write16(this.or16(0, src), this.a[x]));
		case 0o50: // MOVE.W Dy,d(Ax)
			return src = this.d[y], this.write16(this.or16(0, src), this.disp(this.a[x]));
		case 0o51: // MOVE.W Ay,d(Ax)
			return src = this.a[y], this.write16(this.or16(0, src), this.disp(this.a[x]));
		case 0o52: // MOVE.W (Ay),d(Ax)
			return src = this.read16(this.a[y]), this.write16(this.or16(0, src), this.disp(this.a[x]));
		case 0o53: // MOVE.W (Ay)+,d(Ax)
			return src = this.read16(this.a[y]), this.a[y] += 2, this.write16(this.or16(0, src), this.disp(this.a[x]));
		case 0o54: // MOVE.W -(Ay),d(Ax)
			return this.a[y] -= 2, src = this.read16(this.a[y]), this.write16(this.or16(0, src), this.disp(this.a[x]));
		case 0o55: // MOVE.W d(Ay),d(Ax)
			return src = this.read16(this.disp(this.a[y])), this.write16(this.or16(0, src), this.disp(this.a[x]));
		case 0o56: // MOVE.W d(Ay,Xi),d(Ax)
			return src = this.read16(this.index(this.a[y])), this.write16(this.or16(0, src), this.disp(this.a[x]));
		case 0o57: // MOVE.W Abs...,d(Ax)
			return y >= 5 ? this.exception(4) : (src = this.rop16(), this.write16(this.or16(0, src), this.disp(this.a[x])));
		case 0o60: // MOVE.W Dy,d(Ax,Xi)
			return src = this.d[y], this.write16(this.or16(0, src), this.index(this.a[x]));
		case 0o61: // MOVE.W Ay,d(Ax,Xi)
			return src = this.a[y], this.write16(this.or16(0, src), this.index(this.a[x]));
		case 0o62: // MOVE.W (Ay),d(Ax,Xi)
			return src = this.read16(this.a[y]), this.write16(this.or16(0, src), this.index(this.a[x]));
		case 0o63: // MOVE.W (Ay)+,d(Ax,Xi)
			return src = this.read16(this.a[y]), this.a[y] += 2, this.write16(this.or16(0, src), this.index(this.a[x]));
		case 0o64: // MOVE.W -(Ay),d(Ax,Xi)
			return this.a[y] -= 2, src = this.read16(this.a[y]), this.write16(this.or16(0, src), this.index(this.a[x]));
		case 0o65: // MOVE.W d(Ay),d(Ax,Xi)
			return src = this.read16(this.disp(this.a[y])), this.write16(this.or16(0, src), this.index(this.a[x]));
		case 0o66: // MOVE.W d(Ay,Xi),d(Ax,Xi)
			return src = this.read16(this.index(this.a[y])), this.write16(this.or16(0, src), this.index(this.a[x]));
		case 0o67: // MOVE.W Abs...,d(Ax,Xi)
			return y >= 5 ? this.exception(4) : (src = this.rop16(), this.write16(this.or16(0, src), this.index(this.a[x])));
		case 0o70:
			switch (x) {
			case 0: // MOVE.W Dy,Abs.W
				return src = this.d[y], this.write16(this.or16(0, src), this.fetch16s());
			case 1: // MOVE.W Dy,Abs.L
				return src = this.d[y], this.write16(this.or16(0, src), this.fetch32());
			}
			return this.exception(4);
		case 0o71:
			switch (x) {
			case 0: // MOVE.W Ay,Abs.W
				return src = this.a[y], this.write16(this.or16(0, src), this.fetch16s());
			case 1: // MOVE.W Ay,Abs.L
				return src = this.a[y], this.write16(this.or16(0, src), this.fetch32());
			}
			return this.exception(4);
		case 0o72:
			switch (x) {
			case 0: // MOVE.W (Ay),Abs.W
				return src = this.read16(this.a[y]), this.write16(this.or16(0, src), this.fetch16s());
			case 1: // MOVE.W (Ay),Abs.L
				return src = this.read16(this.a[y]), this.write16(this.or16(0, src), this.fetch32());
			}
			return this.exception(4);
		case 0o73:
			switch (x) {
			case 0: // MOVE.W (Ay)+,Abs.W
				return src = this.read16(this.a[y]), this.a[y] += 2, this.write16(this.or16(0, src), this.fetch16s());
			case 1: // MOVE.W (Ay)+,Abs.L
				return src = this.read16(this.a[y]), this.a[y] += 2, this.write16(this.or16(0, src), this.fetch32());
			}
			return this.exception(4);
		case 0o74:
			switch (x) {
			case 0: // MOVE.W -(Ay),Abs.W
				return this.a[y] -= 2, src = this.read16(this.a[y]), this.write16(this.or16(0, src), this.fetch16s());
			case 1: // MOVE.W -(Ay),Abs.L
				return this.a[y] -= 2, src = this.read16(this.a[y]), this.write16(this.or16(0, src), this.fetch32());
			}
			return this.exception(4);
		case 0o75:
			switch (x) {
			case 0: // MOVE.W d(Ay),Abs.W
				return src = this.read16(this.disp(this.a[y])), this.write16(this.or16(0, src), this.fetch16s());
			case 1: // MOVE.W d(Ay),Abs.L
				return src = this.read16(this.disp(this.a[y])), this.write16(this.or16(0, src), this.fetch32());
			}
			return this.exception(4);
		case 0o76:
			switch (x) {
			case 0: // MOVE.W d(Ay,Xi),Abs.W
				return src = this.read16(this.index(this.a[y])), this.write16(this.or16(0, src), this.fetch16s());
			case 1: // MOVE.W d(Ay,Xi),Abs.L
				return src = this.read16(this.index(this.a[y])), this.write16(this.or16(0, src), this.fetch32());
			}
			return this.exception(4);
		case 0o77:
			switch (x) {
			case 0: // MOVE.W Abs...,Abs.W
				return y >= 5 ? this.exception(4) : (src = this.rop16(), this.write16(this.or16(0, src), this.fetch16s()));
			case 1: // MOVE.W Abs...,Abs.L
				return y >= 5 ? this.exception(4) : (src = this.rop16(), this.write16(this.or16(0, src), this.fetch32()));
			}
			return this.exception(4);
		default:
			return this.exception(4);
		}
	}

	execute_4() { // Miscellaneous
		const x = this.op >> 9 & 7, y = this.op & 7;
		let ea, data;
		switch (this.op >> 3 & 0o77) {
		case 0o00:
			switch (x) {
			case 0: // NEGX.B Dy
				return void(this.d[y] = this.d[y] & ~0xff | this.negx8(this.d[y]));
			case 1: // CLR.B Dy
				return void(this.d[y] = this.d[y] & ~0xff | this.clr());
			case 2: // NEG.B Dy
				return void(this.d[y] = this.d[y] & ~0xff | this.neg8(this.d[y]));
			case 3: // NOT.B Dy
				return void(this.d[y] = this.d[y] & ~0xff | this.or8(0, ~this.d[y]));
			case 4: // NBCD Dy
				return void(this.d[y] = this.d[y] & ~0xff | this.nbcd(this.d[y]));
			case 5: // TST.B Dy
				return void(this.or8(0, this.d[y]));
			}
			return this.exception(4);
		case 0o02:
			switch (x) {
			case 0: // NEGX.B (Ay)
				return this.write8(this.negx8(this.read8(this.a[y])), this.a[y]);
			case 1: // CLR.B (Ay)
				return this.read8(this.a[y]), this.write8(this.clr(), this.a[y]);
			case 2: // NEG.B (Ay)
				return this.write8(this.neg8(this.read8(this.a[y])), this.a[y]);
			case 3: // NOT.B (Ay)
				return this.write8(this.or8(0, ~this.read8(this.a[y])), this.a[y]);
			case 4: // NBCD (Ay)
				return this.write8(this.nbcd(this.read8(this.a[y])), this.a[y]);
			case 5: // TST.B (Ay)
				return void(this.or8(0, this.read8(this.a[y])));
			}
			return this.exception(4);
		case 0o03:
			switch (x) {
			case 0: // NEGX.B (Ay)+
				return this.write8(this.negx8(this.read8(this.a[y])), this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 1: // CLR.B (Ay)+
				return this.read8(this.a[y]), this.write8(this.clr(), this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 2: // NEG.B (Ay)+
				return this.write8(this.neg8(this.read8(this.a[y])), this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 3: // NOT.B (Ay)+
				return this.write8(this.or8(0, ~this.read8(this.a[y])), this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 4: // NBCD (Ay)+
				return this.write8(this.nbcd(this.read8(this.a[y])), this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 5: // TST.B (Ay)+
				return this.or8(0, this.read8(this.a[y])), void(this.a[y] += y < 7 ? 1 : 2);
			}
			return this.exception(4);
		case 0o04:
			switch (x) {
			case 0: // NEGX.B -(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.write8(this.negx8(this.read8(this.a[y])), this.a[y]);
			case 1: // CLR.B -(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.read8(this.a[y]), this.write8(this.clr(), this.a[y]);
			case 2: // NEG.B -(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.write8(this.neg8(this.read8(this.a[y])), this.a[y]);
			case 3: // NOT.B -(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.write8(this.or8(0, ~this.read8(this.a[y])), this.a[y]);
			case 4: // NBCD -(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.write8(this.nbcd(this.read8(this.a[y])), this.a[y]);
			case 5: // TST.B -(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, void(this.or8(0, this.read8(this.a[y])));
			}
			return this.exception(4);
		case 0o05:
			switch (x) {
			case 0: // NEGX.B d(Ay)
				return ea = this.disp(this.a[y]), this.write8(this.negx8(this.read8(ea)), ea);
			case 1: // CLR.B d(Ay)
				return ea = this.disp(this.a[y]), this.read8(ea), this.write8(this.clr(), ea);
			case 2: // NEG.B d(Ay)
				return ea = this.disp(this.a[y]), this.write8(this.neg8(this.read8(ea)), ea);
			case 3: // NOT.B d(Ay)
				return ea = this.disp(this.a[y]), this.write8(this.or8(0, ~this.read8(ea)), ea);
			case 4: // NBCD d(Ay)
				return ea = this.disp(this.a[y]), this.write8(this.nbcd(this.read8(ea)), ea);
			case 5: // TST.B d(Ay)
				return ea = this.disp(this.a[y]), void(this.or8(0, this.read8(ea)));
			}
			return this.exception(4);
		case 0o06:
			switch (x) {
			case 0: // NEGX.B d(Ay,Xi)
				return ea = this.index(this.a[y]), this.write8(this.negx8(this.read8(ea)), ea);
			case 1: // CLR.B d(Ay,Xi)
				return ea = this.index(this.a[y]), this.read8(ea), this.write8(this.clr(), ea);
			case 2: // NEG.B d(Ay,Xi)
				return ea = this.index(this.a[y]), this.write8(this.neg8(this.read8(ea)), ea);
			case 3: // NOT.B d(Ay,Xi)
				return ea = this.index(this.a[y]), this.write8(this.or8(0, ~this.read8(ea)), ea);
			case 4: // NBCD d(Ay,Xi)
				return ea = this.index(this.a[y]), this.write8(this.nbcd(this.read8(ea)), ea);
			case 5: // TST.B d(Ay,Xi)
				return ea = this.index(this.a[y]), void(this.or8(0, this.read8(ea)));
			}
			return this.exception(4);
		case 0o07:
			switch (x << 3 | y) {
			case 0o00: // NEGX.B Abs.W
				return ea = this.fetch16s(), this.write8(this.negx8(this.read8(ea)), ea);
			case 0o01: // NEGX.B Abs.L
				return ea = this.fetch32(), this.write8(this.negx8(this.read8(ea)), ea);
			case 0o10: // CLR.B Abs.W
				return ea = this.fetch16s(), this.read8(ea), this.write8(this.clr(), ea);
			case 0o11: // CLR.B Abs.L
				return ea = this.fetch32(), this.read8(ea), this.write8(this.clr(), ea);
			case 0o20: // NEG.B Abs.W
				return ea = this.fetch16s(), this.write8(this.neg8(this.read8(ea)), ea);
			case 0o21: // NEG.B Abs.L
				return ea = this.fetch32(), this.write8(this.neg8(this.read8(ea)), ea);
			case 0o30: // NOT.B Abs.W
				return ea = this.fetch16s(), this.write8(this.or8(0, ~this.read8(ea)), ea);
			case 0o31: // NOT.B Abs.L
				return ea = this.fetch32(), this.write8(this.or8(0, ~this.read8(ea)), ea);
			case 0o40: // NBCD Abs.W
				return ea = this.fetch16s(), this.write8(this.nbcd(this.read8(ea)), ea);
			case 0o41: // NBCD Abs.L
				return ea = this.fetch32(), this.write8(this.nbcd(this.read8(ea)), ea);
			case 0o50: // TST.B Abs.W
				return void(this.or8(0, this.read8(this.fetch16s())));
			case 0o51: // TST.B Abs.L
				return void(this.or8(0, this.read8(this.fetch32())));
			}
			return this.exception(4);
		case 0o10:
			switch (x) {
			case 0: // NEGX.W Dy
				return void(this.d[y] = this.d[y] & ~0xffff | this.negx16(this.d[y]));
			case 1: // CLR.W Dy
				return void(this.d[y] = this.d[y] & ~0xffff | this.clr());
			case 2: // NEG.W Dy
				return void(this.d[y] = this.d[y] & ~0xffff | this.neg16(this.d[y]));
			case 3: // NOT.W Dy
				return void(this.d[y] = this.d[y] & ~0xffff | this.or16(0, ~this.d[y]));
			case 4: // SWAP Dy
				return void(this.d[y] = this.or32(0, this.d[y] << 16 | this.d[y] >>> 16));
			case 5: // TST.W Dy
				return void(this.or16(0, this.d[y]));
			case 7: // TRAP #<vector>
				return this.exception(y | 0x20);
			}
			return this.exception(4);
		case 0o11: // TRAP #<vector>
			return x !== 7 ? this.exception(4) : this.exception(y | 0x28);
		case 0o12:
			switch (x) {
			case 0: // NEGX.W (Ay)
				return this.write16(this.negx16(this.read16(this.a[y])), this.a[y]);
			case 1: // CLR.W (Ay)
				return this.read16(this.a[y]), this.write16(this.clr(), this.a[y]);
			case 2: // NEG.W (Ay)
				return this.write16(this.neg16(this.read16(this.a[y])), this.a[y]);
			case 3: // NOT.W (Ay)
				return this.write16(this.or16(0, ~this.read16(this.a[y])), this.a[y]);
			case 4: // PEA (Ay)
				return ea = this.a[y], this.a[7] -= 4, this.write32(ea, this.a[7]);
			case 5: // TST.W (Ay)
				return void(this.or16(0, this.read16(this.a[y])));
			case 7: // LINK Ay,#<displacement>
				return this.a[7] -= 4, this.write32(this.a[y], this.a[7]), this.a[y] = this.a[7], void(this.a[7] = this.disp(this.a[7]));
			}
			return this.exception(4);
		case 0o13:
			switch (x) {
			case 0: // NEGX.W (Ay)+
				return this.write16(this.negx16(this.read16(this.a[y])), this.a[y]), void(this.a[y] += 2);
			case 1: // CLR.W (Ay)+
				return this.read16(this.a[y]), this.write16(this.clr(), this.a[y]), void(this.a[y] += 2);
			case 2: // NEG.W (Ay)+
				return this.write16(this.neg16(this.read16(this.a[y])), this.a[y]), void(this.a[y] += 2);
			case 3: // NOT.W (Ay)+
				return this.write16(this.or16(0, ~this.read16(this.a[y])), this.a[y]), void(this.a[y] += 2);
			case 5: // TST.W (Ay)+
				return this.or16(0, this.read16(this.a[y])), void(this.a[y] += 2);
			case 7: // UNLK Ay
				return this.a[7] = this.a[y], this.a[y] = this.read32(this.a[7]), void(this.a[7] += 4);
			}
			return this.exception(4);
		case 0o14:
			switch (x) {
			case 0: // NEGX.W -(Ay)
				return this.a[y] -= 2, this.write16(this.negx16(this.read16(this.a[y])), this.a[y]);
			case 1: // CLR.W -(Ay)
				return this.a[y] -= 2, this.read16(this.a[y]), this.write16(this.clr(), this.a[y]);
			case 2: // NEG.W -(Ay)
				return this.a[y] -= 2, this.write16(this.neg16(this.read16(this.a[y])), this.a[y]);
			case 3: // NOT.W -(Ay)
				return this.a[y] -= 2, this.write16(this.or16(0, ~this.read16(this.a[y])), this.a[y]);
			case 5: // TST.W -(Ay)
				return this.a[y] -= 2, void(this.or16(0, this.read16(this.a[y])));
			case 7: // MOVE Ay,USP
				return ~this.sr & 0x2000 ? this.exception(8) : void(this.usp = this.a[y]);
			}
			return this.exception(4);
		case 0o15:
			switch (x) {
			case 0: // NEGX.W d(Ay)
				return ea = this.disp(this.a[y]), this.write16(this.negx16(this.read16(ea)), ea);
			case 1: // CLR.W d(Ay)
				return ea = this.disp(this.a[y]), this.read16(ea), this.write16(this.clr(), ea);
			case 2: // NEG.W d(Ay)
				return ea = this.disp(this.a[y]), this.write16(this.neg16(this.read16(ea)), ea);
			case 3: // NOT.W d(Ay)
				return ea = this.disp(this.a[y]), this.write16(this.or16(0, ~this.read16(ea)), ea);
			case 4: // PEA d(Ay)
				return ea = this.disp(this.a[y]), this.a[7] -= 4, this.write32(ea, this.a[7]);
			case 5: // TST.W d(Ay)
				return ea = this.disp(this.a[y]), void(this.or16(0, this.read16(ea)));
			case 7: // MOVE USP,Ay
				return ~this.sr & 0x2000 ? this.exception(8) : void(this.a[y] = this.usp);
			}
			return this.exception(4);
		case 0o16:
			switch (x) {
			case 0: // NEGX.W d(Ay,Xi)
				return ea = this.index(this.a[y]), this.write16(this.negx16(this.read16(ea)), ea);
			case 1: // CLR.W d(Ay,Xi)
				return ea = this.index(this.a[y]), this.read16(ea), this.write16(this.clr(), ea);
			case 2: // NEG.W d(Ay,Xi)
				return ea = this.index(this.a[y]), this.write16(this.neg16(this.read16(ea)), ea);
			case 3: // NOT.W d(Ay,Xi)
				return ea = this.index(this.a[y]), this.write16(this.or16(0, ~this.read16(ea)), ea);
			case 4: // PEA d(Ay,Xi)
				return ea = this.index(this.a[y]), this.a[7] -= 4, this.write32(ea, this.a[7]);
			case 5: // TST.W d(Ay,Xi)
				return ea = this.index(this.a[y]), void(this.or16(0, this.read16(ea)));
			case 7:
				switch(y) {
				case 0: // RESET
					return ~this.sr & 0x2000 ? this.exception(8) : void(0);
				case 1: // NOP
					return;
				case 2: // STOP #<data>
					return ~this.sr & 0x2000 || ~(data = this.fetch16()) & 0x2000 ? this.exception(8) : (this.sr = data, void(this.fSuspend = true));
				case 3: // RTE
					return ~this.sr & 0x2000 ? this.exception(8) : this.rte();
				case 4: // RTD 68010
					return this.exception(4);
				case 5: // RTS
					return this.pc = this.read32(this.a[7]), void(this.a[7] += 4);
				case 6: // TRAPV
					return this.sr & 2 ? this.exception(7) : void(0);
				case 7: // RTR
					return this.sr = this.sr & ~0xff | this.read16(this.a[7]) & 0xff, this.a[7] += 2, this.pc = this.read32(this.a[7]), void(this.a[7] += 4);
				}
				return;
			}
			return this.exception(4);
		case 0o17:
			switch (x << 3 | y) {
			case 0o00: // NEGX.W Abs.W
				return ea = this.fetch16s(), this.write16(this.negx16(this.read16(ea)), ea);
			case 0o01: // NEGX.W Abs.L
				return ea = this.fetch32(), this.write16(this.negx16(this.read16(ea)), ea);
			case 0o10: // CLR.W Abs.W
				return ea = this.fetch16s(), this.read16(ea), this.write16(this.clr(), ea);
			case 0o11: // CLR.W Abs.L
				return ea = this.fetch32(), this.read16(ea), this.write16(this.clr(), ea);
			case 0o20: // NEG.W Abs.W
				return ea = this.fetch16s(), this.write16(this.neg16(this.read16(ea)), ea);
			case 0o21: // NEG.W Abs.L
				return ea = this.fetch32(), this.write16(this.neg16(this.read16(ea)), ea);
			case 0o30: // NOT.W Abs.W
				return ea = this.fetch16s(), this.write16(this.or16(0, ~this.read16(ea)), ea);
			case 0o31: // NOT.W Abs.L
				return ea = this.fetch32(), this.write16(this.or16(0, ~this.read16(ea)), ea);
			case 0o40: // PEA Abs.W
				return ea = this.fetch16s(), this.a[7] -= 4, this.write32(ea, this.a[7]);
			case 0o41: // PEA Abs.L
				return ea = this.fetch32(), this.a[7] -= 4, this.write32(ea, this.a[7]);
			case 0o42: // PEA d(PC)
				return ea = this.disp(this.pc), this.a[7] -= 4, this.write32(ea, this.a[7]);
			case 0o43: // PEA d(PC,Xi)
				return ea = this.index(this.pc), this.a[7] -= 4, this.write32(ea, this.a[7]);
			case 0o50: // TST.W Abs.W
				return void(this.or16(0, this.read16(this.fetch16s())));
			case 0o51: // TST.W Abs.L
				return void(this.or16(0, this.read16(this.fetch32())));
			}
			return this.exception(4);
		case 0o20:
			switch (x) {
			case 0: // NEGX.L Dy
				return void(this.d[y] = this.negx32(this.d[y]));
			case 1: // CLR.L Dy
				return void(this.d[y] = this.clr());
			case 2: // NEG.L Dy
				return void(this.d[y] = this.neg32(this.d[y]));
			case 3: // NOT.L Dy
				return void(this.d[y] = this.or32(0, ~this.d[y]));
			case 4: // EXT.W Dy
				return void(this.d[y] = this.d[y] & ~0xffff | this.or16(0, this.d[y] << 24 >> 24));
			case 5: // TST.L Dy
				return void(this.or32(0, this.d[y]));
			}
			return this.exception(4);
		case 0o22:
			switch (x) {
			case 0: // NEGX.L (Ay)
				return this.write32(this.negx32(this.read32(this.a[y])), this.a[y]);
			case 1: // CLR.L (Ay)
				return this.read32(this.a[y]), this.write32(this.clr(), this.a[y]);
			case 2: // NEG.L (Ay)
				return this.write32(this.neg32(this.read32(this.a[y])), this.a[y]);
			case 3: // NOT.L (Ay)
				return this.write32(this.or32(0, ~this.read32(this.a[y])), this.a[y]);
			case 4: // MOVEM.W <register list>,(Ay)
				return this.movem16rm();
			case 5: // TST.L (Ay)
				return void(this.or32(0, this.read32(this.a[y])));
			case 6: // MOVEM.W (Ay),<register list>
				return this.movem16mr();
			case 7: // JSR (Ay)
				return ea = this.a[y], this.a[7] -= 4, this.write32(this.pc, this.a[7]), void(this.pc = ea);
			}
			return;
		case 0o23:
			switch (x) {
			case 0: // NEGX.L (Ay)+
				return this.write32(this.negx32(this.read32(this.a[y])), this.a[y]), void(this.a[y] += 4);
			case 1: // CLR.L (Ay)+
				return this.read32(this.a[y]), this.write32(this.clr(), this.a[y]), void(this.a[y] += 4);
			case 2: // NEG.L (Ay)+
				return this.write32(this.neg32(this.read32(this.a[y])), this.a[y]), void(this.a[y] += 4);
			case 3: // NOT.L (Ay)+
				return this.write32(this.or32(0, ~this.read32(this.a[y])), this.a[y]), void(this.a[y] += 4);
			case 5: // TST.L (Ay)+
				return this.or32(0, this.read32(this.a[y])), void(this.a[y] += 4);
			case 6: // MOVEM.W (Ay)+,<register list>
				return this.movem16mr();
			}
			return this.exception(4);
		case 0o24:
			switch (x) {
			case 0: // NEGX.L -(Ay)
				return this.a[y] -= 4, this.write32(this.negx32(this.read32(this.a[y])), this.a[y]);
			case 1: // CLR.L -(Ay)
				return this.a[y] -= 4, this.read32(this.a[y]), this.write32(this.clr(), this.a[y]);
			case 2: // NEG.L -(Ay)
				return this.a[y] -= 4, this.write32(this.neg32(this.read32(this.a[y])), this.a[y]);
			case 3: // NOT.L -(Ay)
				return this.a[y] -= 4, this.write32(this.or32(0, ~this.read32(this.a[y])), this.a[y]);
			case 4: // MOVEM.W <register list>,-(Ay)
				return this.movem16rm();
			case 5: // TST.L -(Ay)
				return this.a[y] -= 4, void(this.or32(0, this.read32(this.a[y])));
			}
			return this.exception(4);
		case 0o25:
			switch (x) {
			case 0: // NEGX.L d(Ay)
				return ea = this.disp(this.a[y]), this.write32(this.negx32(this.read32(ea)), ea);
			case 1: // CLR.L d(Ay)
				return ea = this.disp(this.a[y]), this.read32(ea), this.write32(this.clr(), ea);
			case 2: // NEG.L d(Ay)
				return ea = this.disp(this.a[y]), this.write32(this.neg32(this.read32(ea)), ea);
			case 3: // NOT.L d(Ay)
				return ea = this.disp(this.a[y]), this.write32(this.or32(0, ~this.read32(ea)), ea);
			case 4: // MOVEM.W <register list>,d(Ay)
				return this.movem16rm();
			case 5: // TST.L d(Ay)
				return ea = this.disp(this.a[y]), void(this.or32(0, this.read32(ea)));
			case 6: // MOVEM.W d(Ay),<register list>
				return this.movem16mr();
			case 7: // JSR d(Ay)
				return ea = this.disp(this.a[y]), this.a[7] -= 4, this.write32(this.pc, this.a[7]), void(this.pc = ea);
			}
			return;
		case 0o26:
			switch (x) {
			case 0: // NEGX.L d(Ay,Xi)
				return ea = this.index(this.a[y]), this.write32(this.negx32(this.read32(ea)), ea);
			case 1: // CLR.L d(Ay,Xi)
				return ea = this.index(this.a[y]), this.read32(ea), this.write32(this.clr(), ea);
			case 2: // NEG.L d(Ay,Xi)
				return ea = this.index(this.a[y]), this.write32(this.neg32(this.read32(ea)), ea);
			case 3: // NOT.L d(Ay,Xi)
				return ea = this.index(this.a[y]), this.write32(this.or32(0, ~this.read32(ea)), ea);
			case 4: // MOVEM.W <register list>,d(Ay,Xi)
				return this.movem16rm();
			case 5: // TST.L d(Ay,Xi)
				return ea = this.index(this.a[y]), void(this.or32(0, this.read32(ea)));
			case 6: // MOVEM.W d(Ay,Xi),<register list>
				return this.movem16mr();
			case 7: // JSR d(Ay,Xi)
				return ea = this.index(this.a[y]), this.a[7] -= 4, this.write32(this.pc, this.a[7]), void(this.pc = ea);
			}
			return;
		case 0o27:
			switch (x << 3 | y) {
			case 0o00: // NEGX.L Abs.W
				return ea = this.fetch16s(), this.write32(this.negx32(this.read32(ea)), ea);
			case 0o01: // NEGX.L Abs.L
				return ea = this.fetch32(), this.write32(this.negx32(this.read32(ea)), ea);
			case 0o10: // CLR.L Abs.W
				return ea = this.fetch16s(), this.read32(ea), this.write32(this.clr(), ea);
			case 0o11: // CLR.L Abs.L
				return ea = this.fetch32(), this.read32(ea), this.write32(this.clr(), ea);
			case 0o20: // NEG.L Abs.W
				return ea = this.fetch16s(), this.write32(this.neg32(this.read32(ea)), ea);
			case 0o21: // NEG.L Abs.L
				return ea = this.fetch32(), this.write32(this.neg32(this.read32(ea)), ea);
			case 0o30: // NOT.L Abs.W
				return ea = this.fetch16s(), this.write32(this.or32(0, ~this.read32(ea)), ea);
			case 0o31: // NOT.L Abs.L
				return ea = this.fetch32(), this.write32(this.or32(0, ~this.read32(ea)), ea);
			case 0o40: // MOVEM.W <register list>,Abs.W
			case 0o41: // MOVEM.W <register list>,Abs.L
				return this.movem16rm();
			case 0o50: // TST.L Abs.W
				return void(this.or32(0, this.read32(this.fetch16s())));
			case 0o51: // TST.L Abs.L
				return void(this.or32(0, this.read32(this.fetch32())));
			case 0o60: // MOVEM.W Abs.W,<register list>
			case 0o61: // MOVEM.W Abs.L,<register list>
			case 0o62: // MOVEM.W d(PC),<register list>
			case 0o63: // MOVEM.W d(PC,Xi),<register list>
				return this.movem16mr();
			case 0o70: // JSR Abs.W
				return ea = this.fetch16s(), this.a[7] -= 4, this.write32(this.pc, this.a[7]), void(this.pc = ea);
			case 0o71: // JSR Abs.L
				return ea = this.fetch32(), this.a[7] -= 4, this.write32(this.pc, this.a[7]), void(this.pc = ea);
			case 0o72: // JSR d(PC)
				return ea = this.disp(this.pc), this.a[7] -= 4, this.write32(this.pc, this.a[7]), void(this.pc = ea);
			case 0o73: // JSR d(PC,Xi)
				return ea = this.index(this.pc), this.a[7] -= 4, this.write32(this.pc, this.a[7]), void(this.pc = ea);
			}
			return;
		case 0o30:
			switch (x) {
			case 0: // MOVE SR,Dy
				return void(this.d[y] = this.d[y] & ~0xffff | this.sr);
			case 2: // MOVE Dy,CCR
				return void(this.sr = this.sr & ~0xff | this.d[y] & 0xff);
			case 3: // MOVE Dy,SR
				return ~this.sr & 0x2000 ? this.exception(8) : (this.sr = this.d[y] & 0xffff, void(~this.sr & 0x2000 && (this.ssp = this.a[7], this.a[7] = this.usp)));
			case 4: // EXT.L Dy
				return void(this.d[y] = this.or32(0, this.d[y] << 16 >> 16));
			case 5: // TAS Dy
				return void(this.d[y] = this.d[y] & ~0xff | this.or8(0, this.d[y]) | 0x80);
			}
			return this.exception(4);
		case 0o32:
			switch (x) {
			case 0: // MOVE SR,(Ay)
				return this.read16(this.a[y]), this.write16(this.sr, this.a[y]);
			case 2: // MOVE (Ay),CCR
				return void(this.sr = this.sr & ~0xff | this.read16(this.a[y]) & 0xff);
			case 3: // MOVE (Ay),SR
				return ~this.sr & 0x2000 ? this.exception(8) : (this.sr = this.read16(this.a[y]), void(~this.sr & 0x2000 && (this.ssp = this.a[7], this.a[7] = this.usp)));
			case 4: // MOVEM.L <register list>,(Ay)
				return this.movem32rm();
			case 5: // TAS (Ay)
				return this.write8(this.or8(0, this.read8(this.a[y])) | 0x80, this.a[y]);
			case 6: // MOVEM.L (Ay),<register list>
				return this.movem32mr();
			case 7: // JMP (Ay)
				return void(this.pc = this.a[y]);
			}
			return this.exception(4);
		case 0o33:
			switch (x) {
			case 0: // MOVE SR,(Ay)+
				return this.read16(this.a[y]), this.write16(this.sr, this.a[y]), void(this.a[y] += 2);
			case 2: // MOVE (Ay)+,CCR
				return this.sr = this.sr & ~0xff | this.read16(this.a[y]) & 0xff, void(this.a[y] += 2);
			case 3: // MOVE (Ay)+,SR
				return ~this.sr & 0x2000 ? this.exception(8) : (this.sr = this.read16(this.a[y]), this.a[y] += 2, void(~this.sr & 0x2000 && (this.ssp = this.a[7], this.a[7] = this.usp)));
			case 5: // TAS (Ay)+
				return this.write8(this.or8(0, this.read8(this.a[y])) | 0x80, this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 6: // MOVEM.L (Ay)+,<register list>
				return this.movem32mr();
			}
			return this.exception(4);
		case 0o34:
			switch (x) {
			case 0: // MOVE SR,-(Ay)
				return this.a[y] -= 2, this.read16(this.a[y]), this.write16(this.sr, this.a[y]);
			case 2: // MOVE -(Ay),CCR
				return this.a[y] -= 2, void(this.sr = this.sr & ~0xff | this.read16(this.a[y]) & 0xff);
			case 3: // MOVE -(Ay),SR
				return ~this.sr & 0x2000 ? this.exception(8) : (this.a[y] -= 2, this.sr = this.read16(this.a[y]), void(~this.sr & 0x2000 && (this.ssp = this.a[7], this.a[7] = this.usp)));
			case 4: // MOVEM.L <register list>,-(Ay)
				return this.movem32rm();
			case 5: // TAS -(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.write8(this.or8(0, this.read8(this.a[y])) | 0x80, this.a[y]);
			}
			return this.exception(4);
		case 0o35:
			switch (x) {
			case 0: // MOVE SR,d(Ay)
				return ea = this.disp(this.a[y]), this.read16(ea), this.write16(this.sr, ea);
			case 2: // MOVE d(Ay),CCR
				return ea = this.disp(this.a[y]), void(this.sr = this.sr & ~0xff | this.read16(ea) & 0xff);
			case 3: // MOVE d(Ay),SR
				return ~this.sr & 0x2000 ? this.exception(8) : (ea = this.disp(this.a[y]), this.sr = this.read16(ea), void(~this.sr & 0x2000 && (this.ssp = this.a[7], this.a[7] = this.usp)));
			case 4: // MOVEM.L <register list>,d(Ay)
				return this.movem32rm();
			case 5: // TAS d(Ay)
				return ea = this.disp(this.a[y]), this.write8(this.or8(0, this.read8(ea)) | 0x80, ea);
			case 6: // MOVEM.L d(Ay),<register list>
				return this.movem32mr();
			case 7: // JMP d(Ay)
				return void(this.pc = this.disp(this.a[y]));
			}
			return this.exception(4);
		case 0o36:
			switch (x) {
			case 0: // MOVE SR,d(Ay,Xi)
				return ea = this.index(this.a[y]), this.read16(ea), this.write16(this.sr, ea);
			case 2: // MOVE d(Ay,Xi),CCR
				return ea = this.index(this.a[y]), void(this.sr = this.sr & ~0xff | this.read16(ea) & 0xff);
			case 3: // MOVE d(Ay,Xi),SR
				return ~this.sr & 0x2000 ? this.exception(8) : (ea = this.index(this.a[y]), this.sr = this.read16(ea), void(~this.sr & 0x2000 && (this.ssp = this.a[7], this.a[7] = this.usp)));
			case 4: // MOVEM.L <register list>,d(Ay,Xi)
				return this.movem32rm();
			case 5: // TAS d(Ay,Xi)
				return ea = this.index(this.a[y]), this.write8(this.or8(0, this.read8(ea)) | 0x80, ea);
			case 6: // MOVEM.L d(Ay,Xi),<register list>
				return this.movem32mr();
			case 7: // JMP d(Ay,Xi)
				return void(this.pc = this.index(this.a[y]));
			}
			return this.exception(4);
		case 0o37:
			switch (x << 3 | y) {
			case 0o00: // MOVE SR,Abs.W
				return ea = this.fetch16s(), this.read16(ea), this.write16(this.sr, ea);
			case 0o01: // MOVE SR,Abs.L
				return ea = this.fetch32(), this.read16(ea), this.write16(this.sr, ea);
			case 0o20: // MOVE Abs.W,CCR
			case 0o21: // MOVE Abs.L,CCR
			case 0o22: // MOVE d(PC),CCR
			case 0o23: // MOVE d(PC,Xi),CCR
			case 0o24: // MOVE #<data>,CCR
				return void(this.sr = this.sr & ~0xff | this.rop16() & 0xff);
			case 0o30: // MOVE Abs.W,SR
			case 0o31: // MOVE Abs.L,SR
			case 0o32: // MOVE d(PC),SR
			case 0o33: // MOVE d(PC,Xi),SR
			case 0o34: // MOVE #<data>,SR
				return ~this.sr & 0x2000 ? this.exception(8) : (this.sr = this.rop16(), void(~this.sr & 0x2000 && (this.ssp = this.a[7], this.a[7] = this.usp)));
			case 0o40: // MOVEM.L <register list>,Abs.W
			case 0o41: // MOVEM.L <register list>,Abs.L
				return this.movem32rm();
			case 0o50: // TAS Abs.W
				return ea = this.fetch16s(), this.write8(this.or8(0, this.read8(ea)) | 0x80, ea);
			case 0o51: // TAS Abs.L
				return ea = this.fetch32(), this.write8(this.or8(0, this.read8(ea)) | 0x80, ea);
			case 0o54: // ILLEGAL
				return this.exception(4);
			case 0o60: // MOVEM.L Abs.W,<register list>
			case 0o61: // MOVEM.L Abs.L,<register list>
			case 0o62: // MOVEM.L d(PC),<register list>
			case 0o63: // MOVEM.L d(PC,Xi),<register list>
				return this.movem32mr();
			case 0o70: // JMP Abs.W
				return void(this.pc = this.fetch16s());
			case 0o71: // JMP Abs.L
				return void(this.pc = this.fetch32());
			case 0o72: // JMP d(PC)
				return void(this.pc = this.disp(this.pc));
			case 0o73: // JMP d(PC,Xi)
				return void(this.pc = this.index(this.pc));
			}
			return this.exception(4);
		case 0o60: // CHK Dy,Dx
			return this.chk(this.d[y], this.d[x]);
		case 0o62: // CHK (Ay),Dx
			return this.chk(this.read16(this.a[y]), this.d[x]);
		case 0o63: // CHK (Ay)+,Dx
			return this.chk(this.read16(this.a[y]), this.d[x]), void(this.a[y] += 2);
		case 0o64: // CHK -(Ay),Dx
			return this.a[y] -= 2, this.chk(this.read16(this.a[y]), this.d[x]);
		case 0o65: // CHK d(Ay),Dx
			return ea = this.disp(this.a[y]), this.chk(this.read16(ea), this.d[x]);
		case 0o66: // CHK d(Ay,Xi),Dx
			return ea = this.index(this.a[y]), this.chk(this.read16(ea), this.d[x]);
		case 0o67: // CHK Abs...,Dx
			return y >= 5 ? this.exception(4) : this.chk(this.rop16(), this.d[x]);
		case 0o72: // LEA (Ay),Ax
			return void(this.a[x] = this.a[y]);
		case 0o75: // LEA d(Ay),Ax
			return void(this.a[x] = this.disp(this.a[y]));
		case 0o76: // LEA d(Ay,Xi),Ax
			return void(this.a[x] = this.index(this.a[y]));
		case 0o77: // LEA Abs...,Ax
			return y >= 4 ? this.exception(4) : void(this.a[x] = this.lea());
		default:
			return this.exception(4);
		}
	}

	execute_5() { // ADDQ/SUBQ/Scc/DBcc
		const x = this.op >> 9 & 7, y = this.op & 7, data = (x - 1 & 7) + 1;
		let ea;
		switch (this.op >> 3 & 0o77) {
		case 0o00: // ADDQ.B #<data>,Dy
			return void(this.d[y] = this.d[y] & ~0xff | this.add8(data, this.d[y]));
		case 0o02: // ADDQ.B #<data>,(Ay)
			return this.write8(this.add8(data, this.read8(this.a[y])), this.a[y]);
		case 0o03: // ADDQ.B #<data>,(Ay)+
			return this.write8(this.add8(data, this.read8(this.a[y])), this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
		case 0o04: // ADDQ.B #<data>,-(Ay)
			return this.a[y] -= y < 7 ? 1 : 2, this.write8(this.add8(data, this.read8(this.a[y])), this.a[y]);
		case 0o05: // ADDQ.B #<data>,d(Ay)
			return ea = this.disp(this.a[y]), this.write8(this.add8(data, this.read8(ea)), ea);
		case 0o06: // ADDQ.B #<data>,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write8(this.add8(data, this.read8(ea)), ea);
		case 0o07:
			switch (y) {
			case 0: // ADDQ.B #<data>,Abs.W
				return ea = this.fetch16s(), this.write8(this.add8(data, this.read8(ea)), ea);
			case 1: // ADDQ.B #<data>,Abs.L
				return ea = this.fetch32(), this.write8(this.add8(data, this.read8(ea)), ea);
			}
			return this.exception(4);
		case 0o10: // ADDQ.W #<data>,Dy
			return void(this.d[y] = this.d[y] & ~0xffff | this.add16(data, this.d[y]));
		case 0o11: // ADDQ.W #<data>,Ay
			return void(this.a[y] = this.adda32(data, this.a[y]));
		case 0o12: // ADDQ.W #<data>,(Ay)
			return this.write16(this.add16(data, this.read16(this.a[y])), this.a[y]);
		case 0o13: // ADDQ.W #<data>,(Ay)+
			return this.write16(this.add16(data, this.read16(this.a[y])), this.a[y]), void(this.a[y] += 2);
		case 0o14: // ADDQ.W #<data>,-(Ay)
			return this.a[y] -= 2, this.write16(this.add16(data, this.read16(this.a[y])), this.a[y]);
		case 0o15: // ADDQ.W #<data>,d(Ay)
			return ea = this.disp(this.a[y]), this.write16(this.add16(data, this.read16(ea)), ea);
		case 0o16: // ADDQ.W #<data>,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write16(this.add16(data, this.read16(ea)), ea);
		case 0o17:
			switch (y) {
			case 0: // ADDQ.W #<data>,Abs.W
				return ea = this.fetch16s(), this.write16(this.add16(data, this.read16(ea)), ea);
			case 1: // ADDQ.W #<data>,Abs.L
				return ea = this.fetch32(), this.write16(this.add16(data, this.read16(ea)), ea);
			}
			return this.exception(4);
		case 0o20: // ADDQ.L #<data>,Dy
			return void(this.d[y] = this.add32(data, this.d[y]));
		case 0o21: // ADDQ.L #<data>,Ay
			return void(this.a[y] = this.adda32(data, this.a[y]));
		case 0o22: // ADDQ.L #<data>,(Ay)
			return this.write32(this.add32(data, this.read32(this.a[y])), this.a[y]);
		case 0o23: // ADDQ.L #<data>,(Ay)+
			return this.write32(this.add32(data, this.read32(this.a[y])), this.a[y]), void(this.a[y] += 4);
		case 0o24: // ADDQ.L #<data>,-(Ay)
			return this.a[y] -= 4, this.write32(this.add32(data, this.read32(this.a[y])), this.a[y]);
		case 0o25: // ADDQ.L #<data>,d(Ay)
			return ea = this.disp(this.a[y]), this.write32(this.add32(data, this.read32(ea)), ea);
		case 0o26: // ADDQ.L #<data>,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write32(this.add32(data, this.read32(ea)), ea);
		case 0o27:
			switch (y) {
			case 0: // ADDQ.L #<data>,Abs.W
				return ea = this.fetch16s(), this.write32(this.add32(data, this.read32(ea)), ea);
			case 1: // ADDQ.L #<data>,Abs.L
				return ea = this.fetch32(), this.write32(this.add32(data, this.read32(ea)), ea);
			}
			return this.exception(4);
		case 0o30: // Scc Dy
			switch (x) {
			case 0: // ST Dy
				return void(this.d[y] |= 0xff);
			case 1: // SHI Dy
				return void(this.d[y] = this.d[y] & ~0xff | ((this.sr >> 2 | this.sr) & 1 ? 0 : 0xff));
			case 2: // SCC Dy
				return void(this.d[y] = this.d[y] & ~0xff | (this.sr & 1 ? 0 : 0xff));
			case 3: // SNE Dy
				return void(this.d[y] = this.d[y] & ~0xff | (this.sr & 4 ? 0 : 0xff));
			case 4: // SVC Dy
				return void(this.d[y] = this.d[y] & ~0xff | (this.sr & 2 ? 0 : 0xff));
			case 5: // SPL Dy
				return void(this.d[y] = this.d[y] & ~0xff | (this.sr & 8 ? 0 : 0xff));
			case 6: // SGE Dy
				return void(this.d[y] = this.d[y] & ~0xff | ((this.sr >> 2 ^ this.sr) & 2 ? 0 : 0xff));
			case 7: // SGT Dy
				return void(this.d[y] = this.d[y] & ~0xff | ((this.sr >> 2 ^ this.sr | this.sr >> 1) & 2 ? 0 : 0xff));
			}
			return;
		case 0o31: // DBcc Dy,<label>
			switch (x) {
			case 0: // DBT Dy,<label>
				return this.dbcc(true);
			case 1: // DBHI Dy,<label>
				return this.dbcc(!((this.sr >> 2 | this.sr) & 1));
			case 2: // DBCC Dy,<label>
				return this.dbcc(!(this.sr & 1));
			case 3: // DBNE Dy,<label>
				return this.dbcc(!(this.sr & 4));
			case 4: // DBVC Dy,<label>
				return this.dbcc(!(this.sr & 2));
			case 5: // DBPL Dy,<label>
				return this.dbcc(!(this.sr & 8));
			case 6: // DBGE Dy,<label>
				return this.dbcc(!((this.sr >> 2 ^ this.sr) & 2));
			case 7: // DBGT Dy,<label>
				return this.dbcc(!((this.sr >> 2 ^ this.sr | this.sr >> 1) & 2));
			}
			return;
		case 0o32: // Scc (Ay)
			switch (x) {
			case 0: // ST (Ay)
				return this.read8(this.a[y]), this.write8(0xff, this.a[y]);
			case 1: // SHI (Ay)
				return this.read8(this.a[y]), this.write8((this.sr >> 2 | this.sr) & 1 ? 0 : 0xff, this.a[y]);
			case 2: // SCC (Ay)
				return this.read8(this.a[y]), this.write8(this.sr & 1 ? 0 : 0xff, this.a[y]);
			case 3: // SNE (Ay)
				return this.read8(this.a[y]), this.write8(this.sr & 4 ? 0 : 0xff, this.a[y]);
			case 4: // SVC (Ay)
				return this.read8(this.a[y]), this.write8(this.sr & 2 ? 0 : 0xff, this.a[y]);
			case 5: // SPL (Ay)
				return this.read8(this.a[y]), this.write8(this.sr & 8 ? 0 : 0xff, this.a[y]);
			case 6: // SGE (Ay)
				return this.read8(this.a[y]), this.write8((this.sr >> 2 ^ this.sr) & 2 ? 0 : 0xff, this.a[y]);
			case 7: // SGT (Ay)
				return this.read8(this.a[y]), this.write8((this.sr >> 2 ^ this.sr | this.sr >> 1) & 2 ? 0 : 0xff, this.a[y]);
			}
			return;
		case 0o33: // Scc (Ay)+
			switch (x) {
			case 0: // ST (Ay)+
				return this.read8(this.a[y]), this.write8(0xff, this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 1: // SHI (Ay)+
				return this.read8(this.a[y]), this.write8((this.sr >> 2 | this.sr) & 1 ? 0 : 0xff, this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 2: // SCC (Ay)+
				return this.read8(this.a[y]), this.write8(this.sr & 1 ? 0 : 0xff, this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 3: // SNE (Ay)+
				return this.read8(this.a[y]), this.write8(this.sr & 4 ? 0 : 0xff, this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 4: // SVC (Ay)+
				return this.read8(this.a[y]), this.write8(this.sr & 2 ? 0 : 0xff, this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 5: // SPL (Ay)+
				return this.read8(this.a[y]), this.write8(this.sr & 8 ? 0 : 0xff, this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 6: // SGE (Ay)+
				return this.read8(this.a[y]), this.write8((this.sr >> 2 ^ this.sr) & 2 ? 0 : 0xff, this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 7: // SGT (Ay)+
				return this.read8(this.a[y]), this.write8((this.sr >> 2 ^ this.sr | this.sr >> 1) & 2 ? 0 : 0xff, this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			}
			return;
		case 0o34: // Scc -(Ay)
			switch (x) {
			case 0: // ST -(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.read8(this.a[y]), this.write8(0xff, this.a[y]);
			case 1: // SHI -(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.read8(this.a[y]), this.write8((this.sr >> 2 | this.sr) & 1 ? 0 : 0xff, this.a[y]);
			case 2: // SCC -(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.read8(this.a[y]), this.write8(this.sr & 1 ? 0 : 0xff, this.a[y]);
			case 3: // SNE -(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.read8(this.a[y]), this.write8(this.sr & 4 ? 0 : 0xff, this.a[y]);
			case 4: // SVC -(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.read8(this.a[y]), this.write8(this.sr & 2 ? 0 : 0xff, this.a[y]);
			case 5: // SPL -(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.read8(this.a[y]), this.write8(this.sr & 8 ? 0 : 0xff, this.a[y]);
			case 6: // SGE -(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.read8(this.a[y]), this.write8((this.sr >> 2 ^ this.sr) & 2 ? 0 : 0xff, this.a[y]);
			case 7: // SGT -(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.read8(this.a[y]), this.write8((this.sr >> 2 ^ this.sr | this.sr >> 1) & 2 ? 0 : 0xff, this.a[y]);
			}
			return;
		case 0o35: // Scc d(Ay)
			switch (x) {
			case 0: // ST d(Ay)
				return ea = this.disp(this.a[y]), this.read8(ea), this.write8(0xff, ea);
			case 1: // SHI d(Ay)
				return ea = this.disp(this.a[y]), this.read8(ea), this.write8((this.sr >> 2 | this.sr) & 1 ? 0 : 0xff, ea);
			case 2: // SCC d(Ay)
				return ea = this.disp(this.a[y]), this.read8(ea), this.write8(this.sr & 1 ? 0 : 0xff, ea);
			case 3: // SNE d(Ay)
				return ea = this.disp(this.a[y]), this.read8(ea), this.write8(this.sr & 4 ? 0 : 0xff, ea);
			case 4: // SVC d(Ay)
				return ea = this.disp(this.a[y]), this.read8(ea), this.write8(this.sr & 2 ? 0 : 0xff, ea);
			case 5: // SPL d(Ay)
				return ea = this.disp(this.a[y]), this.read8(ea), this.write8(this.sr & 8 ? 0 : 0xff, ea);
			case 6: // SGE d(Ay)
				return ea = this.disp(this.a[y]), this.read8(ea), this.write8((this.sr >> 2 ^ this.sr) & 2 ? 0 : 0xff, ea);
			case 7: // SGT d(Ay)
				return ea = this.disp(this.a[y]), this.read8(ea), this.write8((this.sr >> 2 ^ this.sr | this.sr >> 1) & 2 ? 0 : 0xff, ea);
			}
			return;
		case 0o36: // Scc d(Ay,Xi)
			switch (x) {
			case 0: // ST d(Ay,Xi)
				return ea = this.index(this.a[y]), this.read8(ea), this.write8(0xff, ea);
			case 1: // SHI d(Ay,Xi)
				return ea = this.index(this.a[y]), this.read8(ea), this.write8((this.sr >> 2 | this.sr) & 1 ? 0 : 0xff, ea);
			case 2: // SCC d(Ay,Xi)
				return ea = this.index(this.a[y]), this.read8(ea), this.write8(this.sr & 1 ? 0 : 0xff, ea);
			case 3: // SNE d(Ay,Xi)
				return ea = this.index(this.a[y]), this.read8(ea), this.write8(this.sr & 4 ? 0 : 0xff, ea);
			case 4: // SVC d(Ay,Xi)
				return ea = this.index(this.a[y]), this.read8(ea), this.write8(this.sr & 2 ? 0 : 0xff, ea);
			case 5: // SPL d(Ay,Xi)
				return ea = this.index(this.a[y]), this.read8(ea), this.write8(this.sr & 8 ? 0 : 0xff, ea);
			case 6: // SGE d(Ay,Xi)
				return ea = this.index(this.a[y]), this.read8(ea), this.write8((this.sr >> 2 ^ this.sr) & 2 ? 0 : 0xff, ea);
			case 7: // SGT d(Ay,Xi)
				return ea = this.index(this.a[y]), this.read8(ea), this.write8((this.sr >> 2 ^ this.sr | this.sr >> 1) & 2 ? 0 : 0xff, ea);
			}
			return;
		case 0o37: // Scc Abs...
			switch (x << 3 | y) {
			case 0o00: // ST Abs.W
				return ea = this.fetch16s(), this.read8(ea), this.write8(0xff, ea);
			case 0o01: // ST Abs.L
				return ea = this.fetch32(), this.read8(ea), this.write8(0xff, ea);
			case 0o10: // SHI Abs.W
				return ea = this.fetch16s(), this.read8(ea), this.write8((this.sr >> 2 | this.sr) & 1 ? 0 : 0xff, ea);
			case 0o11: // SHI Abs.L
				return ea = this.fetch32(), this.read8(ea), this.write8((this.sr >> 2 | this.sr) & 1 ? 0 : 0xff, ea);
			case 0o20: // SCC Abs.W
				return ea = this.fetch16s(), this.read8(ea), this.write8(this.sr & 1 ? 0 : 0xff, ea);
			case 0o21: // SCC Abs.L
				return ea = this.fetch32(), this.read8(ea), this.write8(this.sr & 1 ? 0 : 0xff, ea);
			case 0o30: // SNE Abs.W
				return ea = this.fetch16s(), this.read8(ea), this.write8(this.sr & 4 ? 0 : 0xff, ea);
			case 0o31: // SNE Abs.L
				return ea = this.fetch32(), this.read8(ea), this.write8(this.sr & 4 ? 0 : 0xff, ea);
			case 0o40: // SVC Abs.W
				return ea = this.fetch16s(), this.read8(ea), this.write8(this.sr & 2 ? 0 : 0xff, ea);
			case 0o41: // SVC Abs.L
				return ea = this.fetch32(), this.read8(ea), this.write8(this.sr & 2 ? 0 : 0xff, ea);
			case 0o50: // SPL Abs.W
				return ea = this.fetch16s(), this.read8(ea), this.write8(this.sr & 8 ? 0 : 0xff, ea);
			case 0o51: // SPL Abs.L
				return ea = this.fetch32(), this.read8(ea), this.write8(this.sr & 8 ? 0 : 0xff, ea);
			case 0o60: // SGE Abs.W
				return ea = this.fetch16s(), this.read8(ea), this.write8((this.sr >> 2 ^ this.sr) & 2 ? 0 : 0xff, ea);
			case 0o61: // SGE Abs.L
				return ea = this.fetch32(), this.read8(ea), this.write8((this.sr >> 2 ^ this.sr) & 2 ? 0 : 0xff, ea);
			case 0o70: // SGT Abs.W
				return ea = this.fetch16s(), this.read8(ea), this.write8((this.sr >> 2 ^ this.sr | this.sr >> 1) & 2 ? 0 : 0xff, ea);
			case 0o71: // SGT Abs.L
				return ea = this.fetch32(), this.read8(ea), this.write8((this.sr >> 2 ^ this.sr | this.sr >> 1) & 2 ? 0 : 0xff, ea);
			}
			return this.exception(4);
		case 0o40: // SUBQ.B #<data>,Dy
			return void(this.d[y] = this.d[y] & ~0xff | this.sub8(data, this.d[y]));
		case 0o42: // SUBQ.B #<data>,(Ay)
			return this.write8(this.sub8(data, this.read8(this.a[y])), this.a[y]);
		case 0o43: // SUBQ.B #<data>,(Ay)+
			return this.write8(this.sub8(data, this.read8(this.a[y])), this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
		case 0o44: // SUBQ.B #<data>,-(Ay)
			return this.a[y] -= y < 7 ? 1 : 2, this.write8(this.sub8(data, this.read8(this.a[y])), this.a[y]);
		case 0o45: // SUBQ.B #<data>,d(Ay)
			return ea = this.disp(this.a[y]), this.write8(this.sub8(data, this.read8(ea)), ea);
		case 0o46: // SUBQ.B #<data>,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write8(this.sub8(data, this.read8(ea)), ea);
		case 0o47:
			switch (y) {
			case 0: // SUBQ.B #<data>,Abs.W
				return ea = this.fetch16s(), this.write8(this.sub8(data, this.read8(ea)), ea);
			case 1: // SUBQ.B #<data>,Abs.L
				return ea = this.fetch32(), this.write8(this.sub8(data, this.read8(ea)), ea);
			}
			return this.exception(4);
		case 0o50: // SUBQ.W #<data>,Dy
			return void(this.d[y] = this.d[y] & ~0xffff | this.sub16(data, this.d[y]));
		case 0o51: // SUBQ.W #<data>,Ay
			return void(this.a[y] = this.suba32(data, this.a[y]));
		case 0o52: // SUBQ.W #<data>,(Ay)
			return this.write16(this.sub16(data, this.read16(this.a[y])), this.a[y]);
		case 0o53: // SUBQ.W #<data>,(Ay)+
			return this.write16(this.sub16(data, this.read16(this.a[y])), this.a[y]), void(this.a[y] += 2);
		case 0o54: // SUBQ.W #<data>,-(Ay)
			return this.a[y] -= 2, this.write16(this.sub16(data, this.read16(this.a[y])), this.a[y]);
		case 0o55: // SUBQ.W #<data>,d(Ay)
			return ea = this.disp(this.a[y]), this.write16(this.sub16(data, this.read16(ea)), ea);
		case 0o56: // SUBQ.W #<data>,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write16(this.sub16(data, this.read16(ea)), ea);
		case 0o57:
			switch (y) {
			case 0: // SUBQ.W #<data>,Abs.W
				return ea = this.fetch16s(), this.write16(this.sub16(data, this.read16(ea)), ea);
			case 1: // SUBQ.W #<data>,Abs.L
				return ea = this.fetch32(), this.write16(this.sub16(data, this.read16(ea)), ea);
			}
			return this.exception(4);
		case 0o60: // SUBQ.L #<data>,Dy
			return void(this.d[y] = this.sub32(data, this.d[y]));
		case 0o61: // SUBQ.L #<data>,Ay
			return void(this.a[y] = this.suba32(data, this.a[y]));
		case 0o62: // SUBQ.L #<data>,(Ay)
			return this.write32(this.sub32(data, this.read32(this.a[y])), this.a[y]);
		case 0o63: // SUBQ.L #<data>,(Ay)+
			return this.write32(this.sub32(data, this.read32(this.a[y])), this.a[y]), void(this.a[y] += 4);
		case 0o64: // SUBQ.L #<data>,-(Ay)
			return this.a[y] -= 4, this.write32(this.sub32(data, this.read32(this.a[y])), this.a[y]);
		case 0o65: // SUBQ.L #<data>,d(Ay)
			return ea = this.disp(this.a[y]), this.write32(this.sub32(data, this.read32(ea)), ea);
		case 0o66: // SUBQ.L #<data>,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write32(this.sub32(data, this.read32(ea)), ea);
		case 0o67:
			switch (y) {
			case 0: // SUBQ.L #<data>,Abs.W
				return ea = this.fetch16s(), this.write32(this.sub32(data, this.read32(ea)), ea);
			case 1: // SUBQ.L #<data>,Abs.L
				return ea = this.fetch32(), this.write32(this.sub32(data, this.read32(ea)), ea);
			}
			return this.exception(4);
		case 0o70: // Scc Dy
			switch (x) {
			case 0: // SF Dy
				return void(this.d[y] &= ~0xff);
			case 1: // SLS Dy
				return void(this.d[y] = this.d[y] & ~0xff | ((this.sr >> 2 | this.sr) & 1 ? 0xff : 0));
			case 2: // SCS Dy
				return void(this.d[y] = this.d[y] & ~0xff | (this.sr & 1 ? 0xff : 0));
			case 3: // SEQ Dy
				return void(this.d[y] = this.d[y] & ~0xff | (this.sr & 4 ? 0xff : 0));
			case 4: // SVS Dy
				return void(this.d[y] = this.d[y] & ~0xff | (this.sr & 2 ? 0xff : 0));
			case 5: // SMI Dy
				return void(this.d[y] = this.d[y] & ~0xff | (this.sr & 8 ? 0xff : 0));
			case 6: // SLT Dy
				return void(this.d[y] = this.d[y] & ~0xff | ((this.sr >> 2 ^ this.sr) & 2 ? 0xff : 0));
			case 7: // SLE Dy
				return void(this.d[y] = this.d[y] & ~0xff | ((this.sr >> 2 ^ this.sr | this.sr >> 1) & 2 ? 0xff : 0));
			}
			return;
		case 0o71: // DBcc Dy,<label>
			switch (x) {
			case 0: // DBRA Dy,<label>
				return this.dbcc(false);
			case 1: // DBLS Dy,<label>
				return this.dbcc(((this.sr >> 2 | this.sr) & 1) !== 0);
			case 2: // DBCS Dy,<label>
				return this.dbcc((this.sr & 1) !== 0);
			case 3: // DBEQ Dy,<label>
				return this.dbcc((this.sr & 4) !== 0);
			case 4: // DBVS Dy,<label>
				return this.dbcc((this.sr & 2) !== 0);
			case 5: // DBMI Dy,<label>
				return this.dbcc((this.sr & 8) !== 0);
			case 6: // DBLT Dy,<label>
				return this.dbcc(((this.sr >> 2 ^ this.sr) & 2) !== 0);
			case 7: // DBLE Dy,<label>
				return this.dbcc(((this.sr >> 2 ^ this.sr | this.sr >> 1) & 2) !== 0);
			}
			return;
		case 0o72: // Scc (Ay)
			switch (x) {
			case 0: // SF (Ay)
				return this.read8(this.a[y]), this.write8(0, this.a[y]);
			case 1: // SLS (Ay)
				return this.read8(this.a[y]), this.write8((this.sr >> 2 | this.sr) & 1 ? 0xff : 0, this.a[y]);
			case 2: // SCS (Ay)
				return this.read8(this.a[y]), this.write8(this.sr & 1 ? 0xff : 0, this.a[y]);
			case 3: // SEQ (Ay)
				return this.read8(this.a[y]), this.write8(this.sr & 4 ? 0xff : 0, this.a[y]);
			case 4: // SVS (Ay)
				return this.read8(this.a[y]), this.write8(this.sr & 2 ? 0xff : 0, this.a[y]);
			case 5: // SMI (Ay)
				return this.read8(this.a[y]), this.write8(this.sr & 8 ? 0xff : 0, this.a[y]);
			case 6: // SLT (Ay)
				return this.read8(this.a[y]), this.write8((this.sr >> 2 ^ this.sr) & 2 ? 0xff : 0, this.a[y]);
			case 7: // SLE (Ay)
				return this.read8(this.a[y]), this.write8((this.sr >> 2 ^ this.sr | this.sr >> 1) & 2 ? 0xff : 0, this.a[y]);
			}
			return;
		case 0o73: // Scc (Ay)+
			switch (x) {
			case 0: // SF (Ay)+
				return this.read8(this.a[y]), this.write8(0, this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 1: // SLS (Ay)+
				return this.read8(this.a[y]), this.write8((this.sr >> 2 | this.sr) & 1 ? 0xff : 0, this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 2: // SCS (Ay)+
				return this.read8(this.a[y]), this.write8(this.sr & 1 ? 0xff : 0, this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 3: // SEQ (Ay)+
				return this.read8(this.a[y]), this.write8(this.sr & 4 ? 0xff : 0, this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 4: // SVS (Ay)+
				return this.read8(this.a[y]), this.write8(this.sr & 2 ? 0xff : 0, this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 5: // SMI (Ay)+
				return this.read8(this.a[y]), this.write8(this.sr & 8 ? 0xff : 0, this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 6: // SLT (Ay)+
				return this.read8(this.a[y]), this.write8((this.sr >> 2 ^ this.sr) & 2 ? 0xff : 0, this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			case 7: // SLE (Ay)+
				return this.read8(this.a[y]), this.write8((this.sr >> 2 ^ this.sr | this.sr >> 1) & 2 ? 0xff : 0, this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
			}
			return;
		case 0o74: // Scc -(Ay)
			switch (x) {
			case 0: // SF -(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.read8(this.a[y]), this.write8(0, this.a[y]);
			case 1: // SLS -(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.read8(this.a[y]), this.write8((this.sr >> 2 | this.sr) & 1 ? 0xff : 0, this.a[y]);
			case 2: // SCS -(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.read8(this.a[y]), this.write8(this.sr & 1 ? 0xff : 0, this.a[y]);
			case 3: // SEQ -(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.read8(this.a[y]), this.write8(this.sr & 4 ? 0xff : 0, this.a[y]);
			case 4: // SVS -(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.read8(this.a[y]), this.write8(this.sr & 2 ? 0xff : 0, this.a[y]);
			case 5: // SMI -(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.read8(this.a[y]), this.write8(this.sr & 8 ? 0xff : 0, this.a[y]);
			case 6: // SLT -(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.read8(this.a[y]), this.write8((this.sr >> 2 ^ this.sr) & 2 ? 0xff : 0, this.a[y]);
			case 7: // SLE -(Ay)
				return this.a[y] -= y < 7 ? 1 : 2, this.read8(this.a[y]), this.write8((this.sr >> 2 ^ this.sr | this.sr >> 1) & 2 ? 0xff : 0, this.a[y]);
			}
			return;
		case 0o75: // Scc d(Ay)
			switch (x) {
			case 0: // SF d(Ay)
				return ea = this.disp(this.a[y]), this.read8(ea), this.write8(0, ea);
			case 1: // SLS d(Ay)
				return ea = this.disp(this.a[y]), this.read8(ea), this.write8((this.sr >> 2 | this.sr) & 1 ? 0xff : 0, ea);
			case 2: // SCS d(Ay)
				return ea = this.disp(this.a[y]), this.read8(ea), this.write8(this.sr & 1 ? 0xff : 0, ea);
			case 3: // SEQ d(Ay)
				return ea = this.disp(this.a[y]), this.read8(ea), this.write8(this.sr & 4 ? 0xff : 0, ea);
			case 4: // SVS d(Ay)
				return ea = this.disp(this.a[y]), this.read8(ea), this.write8(this.sr & 2 ? 0xff : 0, ea);
			case 5: // SMI d(Ay)
				return ea = this.disp(this.a[y]), this.read8(ea), this.write8(this.sr & 8 ? 0xff : 0, ea);
			case 6: // SLT d(Ay)
				return ea = this.disp(this.a[y]), this.read8(ea), this.write8((this.sr >> 2 ^ this.sr) & 2 ? 0xff : 0, ea);
			case 7: // SLE d(Ay)
				return ea = this.disp(this.a[y]), this.read8(ea), this.write8((this.sr >> 2 ^ this.sr | this.sr >> 1) & 2 ? 0xff : 0, ea);
			}
			return;
		case 0o76: // Scc d(Ay,Xi)
			switch (x) {
			case 0: // SF d(Ay,Xi)
				return ea = this.index(this.a[y]), this.read8(ea), this.write8(0, ea);
			case 1: // SLS d(Ay,Xi)
				return ea = this.index(this.a[y]), this.read8(ea), this.write8((this.sr >> 2 | this.sr) & 1 ? 0xff : 0, ea);
			case 2: // SCS d(Ay,Xi)
				return ea = this.index(this.a[y]), this.read8(ea), this.write8(this.sr & 1 ? 0xff : 0, ea);
			case 3: // SEQ d(Ay,Xi)
				return ea = this.index(this.a[y]), this.read8(ea), this.write8(this.sr & 4 ? 0xff : 0, ea);
			case 4: // SVS d(Ay,Xi)
				return ea = this.index(this.a[y]), this.read8(ea), this.write8(this.sr & 2 ? 0xff : 0, ea);
			case 5: // SMI d(Ay,Xi)
				return ea = this.index(this.a[y]), this.read8(ea), this.write8(this.sr & 8 ? 0xff : 0, ea);
			case 6: // SLT d(Ay,Xi)
				return ea = this.index(this.a[y]), this.read8(ea), this.write8((this.sr >> 2 ^ this.sr) & 2 ? 0xff : 0, ea);
			case 7: // SLE d(Ay,Xi)
				return ea = this.index(this.a[y]), this.read8(ea), this.write8((this.sr >> 2 ^ this.sr | this.sr >> 1) & 2 ? 0xff : 0, ea);
			}
			return;
		case 0o77: // Scc Abs...
			switch (x << 3 | y) {
			case 0o00: // SF Abs.W
				return ea = this.fetch16s(), this.read8(ea), this.write8(0, ea);
			case 0o01: // SF Abs.L
				return ea = this.fetch32(), this.read8(ea), this.write8(0, ea);
			case 0o10: // SLS Abs.W
				return ea = this.fetch16s(), this.read8(ea), this.write8((this.sr >> 2 | this.sr) & 1 ? 0xff : 0, ea);
			case 0o11: // SLS Abs.L
				return ea = this.fetch32(), this.read8(ea), this.write8((this.sr >> 2 | this.sr) & 1 ? 0xff : 0, ea);
			case 0o20: // SCS Abs.W
				return ea = this.fetch16s(), this.read8(ea), this.write8(this.sr & 1 ? 0xff : 0, ea);
			case 0o21: // SCS Abs.L
				return ea = this.fetch32(), this.read8(ea), this.write8(this.sr & 1 ? 0xff : 0, ea);
			case 0o30: // SEQ Abs.W
				return ea = this.fetch16s(), this.read8(ea), this.write8(this.sr & 4 ? 0xff : 0, ea);
			case 0o31: // SEQ Abs.L
				return ea = this.fetch32(), this.read8(ea), this.write8(this.sr & 4 ? 0xff : 0, ea);
			case 0o40: // SVS Abs.W
				return ea = this.fetch16s(), this.read8(ea), this.write8(this.sr & 2 ? 0xff : 0, ea);
			case 0o41: // SVS Abs.L
				return ea = this.fetch32(), this.read8(ea), this.write8(this.sr & 2 ? 0xff : 0, ea);
			case 0o50: // SMI Abs.W
				return ea = this.fetch16s(), this.read8(ea), this.write8(this.sr & 8 ? 0xff : 0, ea);
			case 0o51: // SMI Abs.L
				return ea = this.fetch32(), this.read8(ea), this.write8(this.sr & 8 ? 0xff : 0, ea);
			case 0o60: // SLT Abs.W
				return ea = this.fetch16s(), this.read8(ea), this.write8((this.sr >> 2 ^ this.sr) & 2 ? 0xff : 0, ea);
			case 0o61: // SLT Abs.L
				return ea = this.fetch32(), this.read8(ea), this.write8((this.sr >> 2 ^ this.sr) & 2 ? 0xff : 0, ea);
			case 0o70: // SLE Abs.W
				return ea = this.fetch16s(), this.read8(ea), this.write8((this.sr >> 2 ^ this.sr | this.sr >> 1) & 2 ? 0xff : 0, ea);
			case 0o71: // SLE Abs.L
				return ea = this.fetch32(), this.read8(ea), this.write8((this.sr >> 2 ^ this.sr | this.sr >> 1) & 2 ? 0xff : 0, ea);
			}
			return this.exception(4);
		default:
			return this.exception(4);
		}
	}

	execute_6() { // Bcc/BSR
		const addr = this.op & 0xff ? this.pc + (this.op << 24 >> 24) | 0 : this.disp(this.pc);
		switch (this.op >> 8 & 0xf) {
		case 0x0: // BRA <label>
			return void(this.pc = addr);
		case 0x1: // BSR <label>
			return this.a[7] -= 4, this.write32(this.pc, this.a[7]), void(this.pc = addr);
		case 0x2: // BHI <label>
			return void(~(this.sr >> 2 | this.sr) & 1 ? (this.pc = addr) : (this.cycle -= this.op & 0xff ? -2 : 2));
		case 0x3: // BLS <label>
			return void((this.sr >> 2 | this.sr) & 1 ? (this.pc = addr) : (this.cycle -= this.op & 0xff ? -2 : 2));
		case 0x4: // BCC <label>
			return void(~this.sr & 1 ? (this.pc = addr) : (this.cycle -= this.op & 0xff ? -2 : 2));
		case 0x5: // BCS <label>
			return void(this.sr & 1 ? (this.pc = addr) : (this.cycle -= this.op & 0xff ? -2 : 2));
		case 0x6: // BNE <label>
			return void(~this.sr & 4 ? (this.pc = addr) : (this.cycle -= this.op & 0xff ? -2 : 2));
		case 0x7: // BEQ <label>
			return void(this.sr & 4 ? (this.pc = addr) : (this.cycle -= this.op & 0xff ? -2 : 2));
		case 0x8: // BVC <label>
			return void(~this.sr & 2 ? (this.pc = addr) : (this.cycle -= this.op & 0xff ? -2 : 2));
		case 0x9: // BVS <label>
			return void(this.sr & 2 ? (this.pc = addr) : (this.cycle -= this.op & 0xff ? -2 : 2));
		case 0xa: // BPL <label>
			return void(~this.sr & 8 ? (this.pc = addr) : (this.cycle -= this.op & 0xff ? -2 : 2));
		case 0xb: // BMI <label>
			return void(this.sr & 8 ? (this.pc = addr) : (this.cycle -= this.op & 0xff ? -2 : 2));
		case 0xc: // BGE <label>
			return void(~(this.sr >> 2 ^ this.sr) & 2 ? (this.pc = addr) : (this.cycle -= this.op & 0xff ? -2 : 2));
		case 0xd: // BLT <label>
			return void((this.sr >> 2 ^ this.sr) & 2 ? (this.pc = addr) : (this.cycle -= this.op & 0xff ? -2 : 2));
		case 0xe: // BGT <label>
			return void(~(this.sr >> 2 ^ this.sr | this.sr >> 1) & 2 ? (this.pc = addr) : (this.cycle -= this.op & 0xff ? -2 : 2));
		case 0xf: // BLE <label>
			return void((this.sr >> 2 ^ this.sr | this.sr >> 1) & 2 ? (this.pc = addr) : (this.cycle -= this.op & 0xff ? -2 : 2));
		}
	}

	execute_7() { // MOVEQ
		const n = this.op >> 9 & 7, data = this.op << 24 >> 24;
		this.op & 0x100 ? this.exception(4) : (this.d[n] = data, void(this.sr = this.sr & ~0x0f | data >> 28 & 8 | !data << 2));
	}

	execute_8() { // OR/DIV/SBCD
		const x = this.op >> 9 & 7, y = this.op & 7;
		let ea;
		switch (this.op >> 3 & 0o77) {
		case 0o00: // OR.B Dy,Dx
			return void(this.d[x] = this.d[x] & ~0xff | this.or8(this.d[y], this.d[x]));
		case 0o02: // OR.B (Ay),Dx
			return void(this.d[x] = this.d[x] & ~0xff | this.or8(this.read8(this.a[y]), this.d[x]));
		case 0o03: // OR.B (Ay)+,Dx
			return this.d[x] = this.d[x] & ~0xff | this.or8(this.read8(this.a[y]), this.d[x]), void(this.a[y] += y < 7 ? 1 : 2);
		case 0o04: // OR.B -(Ay),Dx
			return this.a[y] -= y < 7 ? 1 : 2, void(this.d[x] = this.d[x] & ~0xff | this.or8(this.read8(this.a[y]), this.d[x]));
		case 0o05: // OR.B d(Ay),Dx
			return ea = this.disp(this.a[y]), void(this.d[x] = this.d[x] & ~0xff | this.or8(this.read8(ea), this.d[x]));
		case 0o06: // OR.B d(Ay,Xi),Dx
			return ea = this.index(this.a[y]), void(this.d[x] = this.d[x] & ~0xff | this.or8(this.read8(ea), this.d[x]));
		case 0o07: // OR.B Abs...,Dx
			return y >= 5 ? this.exception(4) : void(this.d[x] = this.d[x] & ~0xff | this.or8(this.rop8(), this.d[x]));
		case 0o10: // OR.W Dy,Dx
			return void(this.d[x] = this.d[x] & ~0xffff | this.or16(this.d[y], this.d[x]));
		case 0o12: // OR.W (Ay),Dx
			return void(this.d[x] = this.d[x] & ~0xffff | this.or16(this.read16(this.a[y]), this.d[x]));
		case 0o13: // OR.W (Ay)+,Dx
			return this.d[x] = this.d[x] & ~0xffff | this.or16(this.read16(this.a[y]), this.d[x]), void(this.a[y] += 2);
		case 0o14: // OR.W -(Ay),Dx
			return this.a[y] -= 2, void(this.d[x] = this.d[x] & ~0xffff | this.or16(this.read16(this.a[y]), this.d[x]));
		case 0o15: // OR.W d(Ay),Dx
			return ea = this.disp(this.a[y]), void(this.d[x] = this.d[x] & ~0xffff | this.or16(this.read16(ea), this.d[x]));
		case 0o16: // OR.W d(Ay,Xi),Dx
			return ea = this.index(this.a[y]), void(this.d[x] = this.d[x] & ~0xffff | this.or16(this.read16(ea), this.d[x]));
		case 0o17: // OR.W Abs...,Dx
			return y >= 5 ? this.exception(4) : void(this.d[x] = this.d[x] & ~0xffff | this.or16(this.rop16(), this.d[x]));
		case 0o20: // OR.L Dy,Dx
			return void(this.d[x] = this.or32(this.d[y], this.d[x]));
		case 0o22: // OR.L (Ay),Dx
			return void(this.d[x] = this.or32(this.read32(this.a[y]), this.d[x]));
		case 0o23: // OR.L (Ay)+,Dx
			return this.d[x] = this.or32(this.read32(this.a[y]), this.d[x]), void(this.a[y] += 4);
		case 0o24: // OR.L -(Ay),Dx
			return this.a[y] -= 4, void(this.d[x] = this.or32(this.read32(this.a[y]), this.d[x]));
		case 0o25: // OR.L d(Ay),Dx
			return ea = this.disp(this.a[y]), void(this.d[x] = this.or32(this.read32(ea), this.d[x]));
		case 0o26: // OR.L d(Ay,Xi),Dx
			return ea = this.index(this.a[y]), void(this.d[x] = this.or32(this.read32(ea), this.d[x]));
		case 0o27: // OR.L Abs...,Dx
			return y >= 5 ? this.exception(4) : void(this.d[x] = this.or32(this.rop32(), this.d[x]));
		case 0o30: // DIVU Dy,Dx
			return void(this.d[x] = this.divu(this.d[y], this.d[x]));
		case 0o32: // DIVU (Ay),Dx
			return void(this.d[x] = this.divu(this.read16(this.a[y]), this.d[x]));
		case 0o33: // DIVU (Ay)+,Dx
			return this.d[x] = this.divu(this.read16(this.a[y]), this.d[x]), void(this.a[y] += 2);
		case 0o34: // DIVU -(Ay),Dx
			return this.a[y] -= 2, void(this.d[x] = this.divu(this.read16(this.a[y]), this.d[x]));
		case 0o35: // DIVU d(Ay),Dx
			return ea = this.disp(this.a[y]), void(this.d[x] = this.divu(this.read16(ea), this.d[x]));
		case 0o36: // DIVU d(Ay,Xi),Dx
			return ea = this.index(this.a[y]), void(this.d[x] = this.divu(this.read16(ea), this.d[x]));
		case 0o37: // DIVU Abs...,Dx
			return y >= 5 ? this.exception(4) : void(this.d[x] = this.divu(this.rop16(), this.d[x]));
		case 0o40: // SBCD Dy,Dx
			return void(this.d[x] = this.d[x] & ~0xff | this.sbcd(this.d[y], this.d[x]));
		case 0o41: // SBCD -(Ay),-(Ax)
			return this.a[y] -= y < 7 ? 1 : 2, this.a[x] -= x < 7 ? 1 : 2, this.write8(this.sbcd(this.read8(this.a[y]), this.read8(this.a[x])), this.a[x]);
		case 0o42: // OR.B Dx,(Ay)
			return this.write8(this.or8(this.d[x], this.read8(this.a[y])), this.a[y]);
		case 0o43: // OR.B Dx,(Ay)+
			return this.write8(this.or8(this.d[x], this.read8(this.a[y])), this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
		case 0o44: // OR.B Dx,-(Ay)
			return this.a[y] -= y < 7 ? 1 : 2, this.write8(this.or8(this.d[x], this.read8(this.a[y])), this.a[y]);
		case 0o45: // OR.B Dx,d(Ay)
			return ea = this.disp(this.a[y]), this.write8(this.or8(this.d[x], this.read8(ea)), ea);
		case 0o46: // OR.B Dx,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write8(this.or8(this.d[x], this.read8(ea)), ea);
		case 0o47:
			switch (y) {
			case 0: // OR.B Dx,Abs.W
				return ea = this.fetch16s(), this.write8(this.or8(this.d[x], this.read8(ea)), ea);
			case 1: // OR.B Dx,Abs.L
				return ea = this.fetch32(), this.write8(this.or8(this.d[x], this.read8(ea)), ea);
			}
			return this.exception(4);
		case 0o52: // OR.W Dx,(Ay)
			return this.write16(this.or16(this.d[x], this.read16(this.a[y])), this.a[y]);
		case 0o53: // OR.W Dx,(Ay)+
			return this.write16(this.or16(this.d[x], this.read16(this.a[y])), this.a[y]), void(this.a[y] += 2);
		case 0o54: // OR.W Dx,-(Ay)
			return this.a[y] -= 2, this.write16(this.or16(this.d[x], this.read16(this.a[y])), this.a[y]);
		case 0o55: // OR.W Dx,d(Ay)
			return ea = this.disp(this.a[y]), this.write16(this.or16(this.d[x], this.read16(ea)), ea);
		case 0o56: // OR.W Dx,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write16(this.or16(this.d[x], this.read16(ea)), ea);
		case 0o57:
			switch (y) {
			case 0: // OR.W Dx,Abs.W
				return ea = this.fetch16s(), this.write16(this.or16(this.d[x], this.read16(ea)), ea);
			case 1: // OR.W Dx,Abs.L
				return ea = this.fetch32(), this.write16(this.or16(this.d[x], this.read16(ea)), ea);
			}
			return this.exception(4);
		case 0o62: // OR.L Dx,(Ay)
			return this.write32(this.or32(this.d[x], this.read32(this.a[y])), this.a[y]);
		case 0o63: // OR.L Dx,(Ay)+
			return this.write32(this.or32(this.d[x], this.read32(this.a[y])), this.a[y]), void(this.a[y] += 4);
		case 0o64: // OR.L Dx,-(Ay)
			return this.a[y] -= 4, this.write32(this.or32(this.d[x], this.read32(this.a[y])), this.a[y]);
		case 0o65: // OR.L Dx,d(Ay)
			return ea = this.disp(this.a[y]), this.write32(this.or32(this.d[x], this.read32(ea)), ea);
		case 0o66: // OR.L Dx,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write32(this.or32(this.d[x], this.read32(ea)), ea);
		case 0o67:
			switch (y) {
			case 0: // OR.L Dx,Abs.W
				return ea = this.fetch16s(), this.write32(this.or32(this.d[x], this.read32(ea)), ea);
			case 1: // OR.L Dx,Abs.L
				return ea = this.fetch32(), this.write32(this.or32(this.d[x], this.read32(ea)), ea);
			}
			return this.exception(4);
		case 0o70: // DIVS Dy,Dx
			return void(this.d[x] = this.divs(this.d[y], this.d[x]));
		case 0o72: // DIVS (Ay),Dx
			return void(this.d[x] = this.divs(this.read16(this.a[y]), this.d[x]));
		case 0o73: // DIVS (Ay)+,Dx
			return this.d[x] = this.divs(this.read16(this.a[y]), this.d[x]), void(this.a[y] += 2);
		case 0o74: // DIVS -(Ay),Dx
			return this.a[y] -= 2, void(this.d[x] = this.divs(this.read16(this.a[y]), this.d[x]));
		case 0o75: // DIVS d(Ay),Dx
			return ea = this.disp(this.a[y]), void(this.d[x] = this.divs(this.read16(ea), this.d[x]));
		case 0o76: // DIVS d(Ay,Xi),Dx
			return ea = this.index(this.a[y]), void(this.d[x] = this.divs(this.read16(ea), this.d[x]));
		case 0o77: // DIVS Abs...,Dx
			return y >= 5 ? this.exception(4) : void(this.d[x] = this.divs(this.rop16(), this.d[x]));
		default:
			return this.exception(4);
		}
	}

	execute_9() { // SUB/SUBX
		const x = this.op >> 9 & 7, y = this.op & 7;
		let ea;
		switch (this.op >> 3 & 0o77) {
		case 0o00: // SUB.B Dy,Dx
			return void(this.d[x] = this.d[x] & ~0xff | this.sub8(this.d[y], this.d[x]));
		case 0o02: // SUB.B (Ay),Dx
			return void(this.d[x] = this.d[x] & ~0xff | this.sub8(this.read8(this.a[y]), this.d[x]));
		case 0o03: // SUB.B (Ay)+,Dx
			return this.d[x] = this.d[x] & ~0xff | this.sub8(this.read8(this.a[y]), this.d[x]), void(this.a[y] += y < 7 ? 1 : 2);
		case 0o04: // SUB.B -(Ay),Dx
			return this.a[y] -= y < 7 ? 1 : 2, void(this.d[x] = this.d[x] & ~0xff | this.sub8(this.read8(this.a[y]), this.d[x]));
		case 0o05: // SUB.B d(Ay),Dx
			return ea = this.disp(this.a[y]), void(this.d[x] = this.d[x] & ~0xff | this.sub8(this.read8(ea), this.d[x]));
		case 0o06: // SUB.B d(Ay,Xi),Dx
			return ea = this.index(this.a[y]), void(this.d[x] = this.d[x] & ~0xff | this.sub8(this.read8(ea), this.d[x]));
		case 0o07: // SUB.B Abs...,Dx
			return y >= 5 ? this.exception(4) : void(this.d[x] = this.d[x] & ~0xff | this.sub8(this.rop8(), this.d[x]));
		case 0o10: // SUB.W Dy,Dx
			return void(this.d[x] = this.d[x] & ~0xffff | this.sub16(this.d[y], this.d[x]));
		case 0o11: // SUB.W Ay,Dx
			return void(this.d[x] = this.d[x] & ~0xffff | this.sub16(this.a[y], this.d[x]));
		case 0o12: // SUB.W (Ay),Dx
			return void(this.d[x] = this.d[x] & ~0xffff | this.sub16(this.read16(this.a[y]), this.d[x]));
		case 0o13: // SUB.W (Ay)+,Dx
			return this.d[x] = this.d[x] & ~0xffff | this.sub16(this.read16(this.a[y]), this.d[x]), void(this.a[y] += 2);
		case 0o14: // SUB.W -(Ay),Dx
			return this.a[y] -= 2, void(this.d[x] = this.d[x] & ~0xffff | this.sub16(this.read16(this.a[y]), this.d[x]));
		case 0o15: // SUB.W d(Ay),Dx
			return ea = this.disp(this.a[y]), void(this.d[x] = this.d[x] & ~0xffff | this.sub16(this.read16(ea), this.d[x]));
		case 0o16: // SUB.W d(Ay,Xi),Dx
			return ea = this.index(this.a[y]), void(this.d[x] = this.d[x] & ~0xffff | this.sub16(this.read16(ea), this.d[x]));
		case 0o17: // SUB.W Abs...,Dx
			return y >= 5 ? this.exception(4) : void(this.d[x] = this.d[x] & ~0xffff | this.sub16(this.rop16(), this.d[x]));
		case 0o20: // SUB.L Dy,Dx
			return void(this.d[x] = this.sub32(this.d[y], this.d[x]));
		case 0o21: // SUB.L Ay,Dx
			return void(this.d[x] = this.sub32(this.a[y], this.d[x]));
		case 0o22: // SUB.L (Ay),Dx
			return void(this.d[x] = this.sub32(this.read32(this.a[y]), this.d[x]));
		case 0o23: // SUB.L (Ay)+,Dx
			return this.d[x] = this.sub32(this.read32(this.a[y]), this.d[x]), void(this.a[y] += 4);
		case 0o24: // SUB.L -(Ay),Dx
			return this.a[y] -= 4, void(this.d[x] = this.sub32(this.read32(this.a[y]), this.d[x]));
		case 0o25: // SUB.L d(Ay),Dx
			return ea = this.disp(this.a[y]), void(this.d[x] = this.sub32(this.read32(ea), this.d[x]));
		case 0o26: // SUB.L d(Ay,Xi),Dx
			return ea = this.index(this.a[y]), void(this.d[x] = this.sub32(this.read32(ea), this.d[x]));
		case 0o27: // SUB.L Abs...,Dx
			return y >= 5 ? this.exception(4) : void(this.d[x] = this.sub32(this.rop32(), this.d[x]));
		case 0o30: // SUBA.W Dy,Ax
			return void(this.a[x] -= this.d[y] << 16 >> 16);
		case 0o31: // SUBA.W Ay,Ax
			return void(this.a[x] -= this.a[y] << 16 >> 16);
		case 0o32: // SUBA.W (Ay),Ax
			return void(this.a[x] -= this.read16(this.a[y]) << 16 >> 16);
		case 0o33: // SUBA.W (Ay)+,Ax
			return this.a[x] -= this.read16(this.a[y]) << 16 >> 16, void(this.a[y] += 2);
		case 0o34: // SUBA.W -(Ay),Ax
			return this.a[y] -= 2, void(this.a[x] -= this.read16(this.a[y]) << 16 >> 16);
		case 0o35: // SUBA.W d(Ay),Ax
			return ea = this.disp(this.a[y]), void(this.a[x] -= this.read16(ea) << 16 >> 16);
		case 0o36: // SUBA.W d(Ay,Xi),Ax
			return ea = this.index(this.a[y]), void(this.a[x] -= this.read16(ea) << 16 >> 16);
		case 0o37: // SUBA.W Abs...,Ax
			return y >= 5 ? this.exception(4) : void(this.a[x] -= this.rop16() << 16 >> 16);
		case 0o40: // SUBX.B Dy,Dx
			return void(this.d[x] = this.d[x] & ~0xff | this.subx8(this.d[y], this.d[x]));
		case 0o41: // SUBX.B -(Ay),-(Ax)
			return this.a[y] -= y < 7 ? 1 : 2, this.a[x] -= x < 7 ? 1 : 2, this.write8(this.subx8(this.read8(this.a[y]), this.read8(this.a[x])), this.a[x]);
		case 0o42: // SUB.B Dx,(Ay)
			return this.write8(this.sub8(this.d[x], this.read8(this.a[y])), this.a[y]);
		case 0o43: // SUB.B Dx,(Ay)+
			return this.write8(this.sub8(this.d[x], this.read8(this.a[y])), this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
		case 0o44: // SUB.B Dx,-(Ay)
			return this.a[y] -= y < 7 ? 1 : 2, this.write8(this.sub8(this.d[x], this.read8(this.a[y])), this.a[y]);
		case 0o45: // SUB.B Dx,d(Ay)
			return ea = this.disp(this.a[y]), this.write8(this.sub8(this.d[x], this.read8(ea)), ea);
		case 0o46: // SUB.B Dx,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write8(this.sub8(this.d[x], this.read8(ea)), ea);
		case 0o47:
			switch (y) {
			case 0: // SUB.B Dx,Abs.W
				return ea = this.fetch16s(), this.write8(this.sub8(this.d[x], this.read8(ea)), ea);
			case 1: // SUB.B Dx,Abs.L
				return ea = this.fetch32(), this.write8(this.sub8(this.d[x], this.read8(ea)), ea);
			}
			return this.exception(4);
		case 0o50: // SUBX.W Dy,Dx
			return void(this.d[x] = this.d[x] & ~0xffff | this.subx16(this.d[y], this.d[x]));
		case 0o51: // SUBX.W -(Ay),-(Ax)
			return this.a[y] -= 2, this.a[x] -= 2, this.write16(this.subx16(this.read16(this.a[y]), this.read16(this.a[x])), this.a[x]);
		case 0o52: // SUB.W Dx,(Ay)
			return this.write16(this.sub16(this.d[x], this.read16(this.a[y])), this.a[y]);
		case 0o53: // SUB.W Dx,(Ay)+
			return this.write16(this.sub16(this.d[x], this.read16(this.a[y])), this.a[y]), void(this.a[y] += 2);
		case 0o54: // SUB.W Dx,-(Ay)
			return this.a[y] -= 2, this.write16(this.sub16(this.d[x], this.read16(this.a[y])), this.a[y]);
		case 0o55: // SUB.W Dx,d(Ay)
			return ea = this.disp(this.a[y]), this.write16(this.sub16(this.d[x], this.read16(ea)), ea);
		case 0o56: // SUB.W Dx,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write16(this.sub16(this.d[x], this.read16(ea)), ea);
		case 0o57:
			switch (y) {
			case 0: // SUB.W Dx,Abs.W
				return ea = this.fetch16s(), this.write16(this.sub16(this.d[x], this.read16(ea)), ea);
			case 1: // SUB.W Dx,Abs.L
				return ea = this.fetch32(), this.write16(this.sub16(this.d[x], this.read16(ea)), ea);
			}
			return this.exception(4);
		case 0o60: // SUBX.L Dy,Dx
			return void(this.d[x] = this.subx32(this.d[y], this.d[x]));
		case 0o61: // SUBX.L -(Ay),-(Ax)
			return this.a[y] -= 4, this.a[x] -= 4, this.write32(this.subx32(this.read32(this.a[y]), this.read32(this.a[x])), this.a[x]);
		case 0o62: // SUB.L Dx,(Ay)
			return this.write32(this.sub32(this.d[x], this.read32(this.a[y])), this.a[y]);
		case 0o63: // SUB.L Dx,(Ay)+
			return this.write32(this.sub32(this.d[x], this.read32(this.a[y])), this.a[y]), void(this.a[y] += 4);
		case 0o64: // SUB.L Dx,-(Ay)
			return this.a[y] -= 4, this.write32(this.sub32(this.d[x], this.read32(this.a[y])), this.a[y]);
		case 0o65: // SUB.L Dx,d(Ay)
			return ea = this.disp(this.a[y]), this.write32(this.sub32(this.d[x], this.read32(ea)), ea);
		case 0o66: // SUB.L Dx,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write32(this.sub32(this.d[x], this.read32(ea)), ea);
		case 0o67:
			switch (y) {
			case 0: // SUB.L Dx,Abs.W
				return ea = this.fetch16s(), this.write32(this.sub32(this.d[x], this.read32(ea)), ea);
			case 1: // SUB.L Dx,Abs.L
				return ea = this.fetch32(), this.write32(this.sub32(this.d[x], this.read32(ea)), ea);
			}
			return this.exception(4);
		case 0o70: // SUBA.L Dy,Ax
			return void(this.a[x] -= this.d[y]);
		case 0o71: // SUBA.L Ay,Ax
			return void(this.a[x] -= this.a[y]);
		case 0o72: // SUBA.L (Ay),Ax
			return void(this.a[x] -= this.read32(this.a[y]));
		case 0o73: // SUBA.L (Ay)+,Ax
			return this.a[x] -= this.read32(this.a[y]), void(this.a[y] += 4);
		case 0o74: // SUBA.L -(Ay),Ax
			return this.a[y] -= 4, void(this.a[x] -= this.read32(this.a[y]));
		case 0o75: // SUBA.L d(Ay),Ax
			return ea = this.disp(this.a[y]), void(this.a[x] -= this.read32(ea));
		case 0o76: // SUBA.L d(Ay,Xi),Ax
			return ea = this.index(this.a[y]), void(this.a[x] -= this.read32(ea));
		case 0o77: // SUBA.L Abs...,Ax
			return y >= 5 ? this.exception(4) : void(this.a[x] -= this.rop32());
		default:
			return this.exception(4);
		}
	}

	execute_b() { // CMP/EOR
		const x = this.op >> 9 & 7, y = this.op & 7;
		let ea;
		switch (this.op >> 3 & 0o77) {
		case 0o00: // CMP.B Dy,Dx
			return this.cmp8(this.d[y], this.d[x]);
		case 0o02: // CMP.B (Ay),Dx
			return this.cmp8(this.read8(this.a[y]), this.d[x]);
		case 0o03: // CMP.B (Ay)+,Dx
			return this.cmp8(this.read8(this.a[y]), this.d[x]), void(this.a[y] += y < 7 ? 1 : 2);
		case 0o04: // CMP.B -(Ay),Dx
			return this.a[y] -= y < 7 ? 1 : 2, this.cmp8(this.read8(this.a[y]), this.d[x]);
		case 0o05: // CMP.B d(Ay),Dx
			return ea = this.disp(this.a[y]), this.cmp8(this.read8(ea), this.d[x]);
		case 0o06: // CMP.B d(Ay,Xi),Dx
			return ea = this.index(this.a[y]), this.cmp8(this.read8(ea), this.d[x]);
		case 0o07: // CMP.B Abs...,Dx
			return y >= 5 ? this.exception(4) : this.cmp8(this.rop8(), this.d[x]);
		case 0o10: // CMP.W Dy,Dx
			return this.cmp16(this.d[y], this.d[x]);
		case 0o11: // CMP.W Ay,Dx
			return this.cmp16(this.a[y], this.d[x]);
		case 0o12: // CMP.W (Ay),Dx
			return this.cmp16(this.read16(this.a[y]), this.d[x]);
		case 0o13: // CMP.W (Ay)+,Dx
			return this.cmp16(this.read16(this.a[y]), this.d[x]), void(this.a[y] += 2);
		case 0o14: // CMP.W -(Ay),Dx
			return this.a[y] -= 2, this.cmp16(this.read16(this.a[y]), this.d[x]);
		case 0o15: // CMP.W d(Ay),Dx
			return ea = this.disp(this.a[y]), this.cmp16(this.read16(ea), this.d[x]);
		case 0o16: // CMP.W d(Ay,Xi),Dx
			return ea = this.index(this.a[y]), this.cmp16(this.read16(ea), this.d[x]);
		case 0o17: // CMP.W Abs...,Dx
			return y >= 5 ? this.exception(4) : this.cmp16(this.rop16(), this.d[x]);
		case 0o20: // CMP.L Dy,Dx
			return this.cmp32(this.d[y], this.d[x]);
		case 0o21: // CMP.L Ay,Dx
			return this.cmp32(this.a[y], this.d[x]);
		case 0o22: // CMP.L (Ay),Dx
			return this.cmp32(this.read32(this.a[y]), this.d[x]);
		case 0o23: // CMP.L (Ay)+,Dx
			return this.cmp32(this.read32(this.a[y]), this.d[x]), void(this.a[y] += 4);
		case 0o24: // CMP.L -(Ay),Dx
			return this.a[y] -= 4, this.cmp32(this.read32(this.a[y]), this.d[x]);
		case 0o25: // CMP.L d(Ay),Dx
			return ea = this.disp(this.a[y]), this.cmp32(this.read32(ea), this.d[x]);
		case 0o26: // CMP.L d(Ay,Xi),Dx
			return ea = this.index(this.a[y]), this.cmp32(this.read32(ea), this.d[x]);
		case 0o27: // CMP.L Abs...,Dx
			return y >= 5 ? this.exception(4) : this.cmp32(this.rop32(), this.d[x]);
		case 0o30: // CMPA.W Dy,Ax
			return this.cmpa16(this.d[y], this.a[x]);
		case 0o31: // CMPA.W Ay,Ax
			return this.cmpa16(this.a[y], this.a[x]);
		case 0o32: // CMPA.W (Ay),Ax
			return this.cmpa16(this.read16(this.a[y]), this.a[x]);
		case 0o33: // CMPA.W (Ay)+,Ax
			return this.cmpa16(this.read16(this.a[y]), this.a[x]), void(this.a[y] += 2);
		case 0o34: // CMPA.W -(Ay),Ax
			return this.a[y] -= 2, this.cmpa16(this.read16(this.a[y]), this.a[x]);
		case 0o35: // CMPA.W d(Ay),Ax
			return ea = this.disp(this.a[y]), this.cmpa16(this.read16(ea), this.a[x]);
		case 0o36: // CMPA.W d(Ay,Xi),Ax
			return ea = this.index(this.a[y]), this.cmpa16(this.read16(ea), this.a[x]);
		case 0o37: // CMPA.W Abs...,Ax
			return y >= 5 ? this.exception(4) : this.cmpa16(this.rop16(), this.a[x]);
		case 0o40: // EOR.B Dx,Dy
			return void(this.d[y] = this.d[y] & ~0xff | this.eor8(this.d[x], this.d[y]));
		case 0o41: // CMPM.B (Ay)+,(Ax)+
			return this.cmp8(this.read8(this.a[y]), this.read8(this.a[x])), this.a[y] += y < 7 ? 1 : 2, void(this.a[x] += x < 7 ? 1 : 2);
		case 0o42: // EOR.B Dx,(Ay)
			return this.write8(this.eor8(this.d[x], this.read8(this.a[y])), this.a[y]);
		case 0o43: // EOR.B Dx,(Ay)+
			return this.write8(this.eor8(this.d[x], this.read8(this.a[y])), this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
		case 0o44: // EOR.B Dx,-(Ay)
			return this.a[y] -= y < 7 ? 1 : 2, this.write8(this.eor8(this.d[x], this.read8(this.a[y])), this.a[y]);
		case 0o45: // EOR.B Dx,d(Ay)
			return ea = this.disp(this.a[y]), this.write8(this.eor8(this.d[x], this.read8(ea)), ea);
		case 0o46: // EOR.B Dx,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write8(this.eor8(this.d[x], this.read8(ea)), ea);
		case 0o47:
			switch (y) {
			case 0: // EOR.B Dx,Abs.W
				return ea = this.fetch16s(), this.write8(this.eor8(this.d[x], this.read8(ea)), ea);
			case 1: // EOR.B Dx,Abs.L
				return ea = this.fetch32(), this.write8(this.eor8(this.d[x], this.read8(ea)), ea);
			}
			return this.exception(4);
		case 0o50: // EOR.W Dx,Dy
			return void(this.d[y] = this.d[y] & ~0xffff | this.eor16(this.d[x], this.d[y]));
		case 0o51: // CMPM.W (Ay)+,(Ax)+
			return this.cmp16(this.read16(this.a[y]), this.read16(this.a[x])), this.a[y] += 2, void(this.a[x] += 2);
		case 0o52: // EOR.W Dx,(Ay)
			return this.write16(this.eor16(this.d[x], this.read16(this.a[y])), this.a[y]);
		case 0o53: // EOR.W Dx,(Ay)+
			return this.write16(this.eor16(this.d[x], this.read16(this.a[y])), this.a[y]), void(this.a[y] += 2);
		case 0o54: // EOR.W Dx,-(Ay)
			return this.a[y] -= 2, this.write16(this.eor16(this.d[x], this.read16(this.a[y])), this.a[y]);
		case 0o55: // EOR.W Dx,d(Ay)
			return ea = this.disp(this.a[y]), this.write16(this.eor16(this.d[x], this.read16(ea)), ea);
		case 0o56: // EOR.W Dx,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write16(this.eor16(this.d[x], this.read16(ea)), ea);
		case 0o57:
			switch (y) {
			case 0: // EOR.W Dx,Abs.W
				return ea = this.fetch16s(), this.write16(this.eor16(this.d[x], this.read16(ea)), ea);
			case 1: // EOR.W Dx,Abs.L
				return ea = this.fetch32(), this.write16(this.eor16(this.d[x], this.read16(ea)), ea);
			}
			return this.exception(4);
		case 0o60: // EOR.L Dx,Dy
			return void(this.d[y] = this.eor32(this.d[x], this.d[y]));
		case 0o61: // CMPM.L (Ay)+,(Ax)+
			return this.cmp32(this.read32(this.a[y]), this.read32(this.a[x])), this.a[y] += 4, void(this.a[x] += 4);
		case 0o62: // EOR.L Dx,(Ay)
			return this.write32(this.eor32(this.d[x], this.read32(this.a[y])), this.a[y]);
		case 0o63: // EOR.L Dx,(Ay)+
			return this.write32(this.eor32(this.d[x], this.read32(this.a[y])), this.a[y]), void(this.a[y] += 4);
		case 0o64: // EOR.L Dx,-(Ay)
			return this.a[y] -= 4, this.write32(this.eor32(this.d[x], this.read32(this.a[y])), this.a[y]);
		case 0o65: // EOR.L Dx,d(Ay)
			return ea = this.disp(this.a[y]), this.write32(this.eor32(this.d[x], this.read32(ea)), ea);
		case 0o66: // EOR.L Dx,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write32(this.eor32(this.d[x], this.read32(ea)), ea);
		case 0o67:
			switch (y) {
			case 0: // EOR.L Dx,Abs.W
				return ea = this.fetch16s(), this.write32(this.eor32(this.d[x], this.read32(ea)), ea);
			case 1: // EOR.L Dx,Abs.L
				return ea = this.fetch32(), this.write32(this.eor32(this.d[x], this.read32(ea)), ea);
			}
			return this.exception(4);
		case 0o70: // CMPA.L Dy,Ax
			return this.cmpa32(this.d[y], this.a[x]);
		case 0o71: // CMPA.L Ay,Ax
			return this.cmpa32(this.a[y], this.a[x]);
		case 0o72: // CMPA.L (Ay),Ax
			return this.cmpa32(this.read32(this.a[y]), this.a[x]);
		case 0o73: // CMPA.L (Ay)+,Ax
			return this.cmpa32(this.read32(this.a[y]), this.a[x]), void(this.a[y] += 4);
		case 0o74: // CMPA.L -(Ay),Ax
			return this.a[y] -= 4, this.cmpa32(this.read32(this.a[y]), this.a[x]);
		case 0o75: // CMPA.L d(Ay),Ax
			return ea = this.disp(this.a[y]), this.cmpa32(this.read32(ea), this.a[x]);
		case 0o76: // CMPA.L d(Ay,Xi),Ax
			return ea = this.index(this.a[y]), this.cmpa32(this.read32(ea), this.a[x]);
		case 0o77: // CMPA.L Abs...,Ax
			return y >= 5 ? this.exception(4) : this.cmpa32(this.rop32(), this.a[x]);
		default:
			return this.exception(4);
		}
	}

	execute_c() { // AND/MUL/ABCD/EXG
		const x = this.op >> 9 & 7, y = this.op & 7;
		let ea, src;
		switch (this.op >> 3 & 0o77) {
		case 0o00: // AND.B Dy,Dx
			return void(this.d[x] = this.d[x] & ~0xff | this.and8(this.d[y], this.d[x]));
		case 0o02: // AND.B (Ay),Dx
			return void(this.d[x] = this.d[x] & ~0xff | this.and8(this.read8(this.a[y]), this.d[x]));
		case 0o03: // AND.B (Ay)+,Dx
			return this.d[x] = this.d[x] & ~0xff | this.and8(this.read8(this.a[y]), this.d[x]), void(this.a[y] += y < 7 ? 1 : 2);
		case 0o04: // AND.B -(Ay),Dx
			return this.a[y] -= y < 7 ? 1 : 2, void(this.d[x] = this.d[x] & ~0xff | this.and8(this.read8(this.a[y]), this.d[x]));
		case 0o05: // AND.B d(Ay),Dx
			return ea = this.disp(this.a[y]), void(this.d[x] = this.d[x] & ~0xff | this.and8(this.read8(ea), this.d[x]));
		case 0o06: // AND.B d(Ay,Xi),Dx
			return ea = this.index(this.a[y]), void(this.d[x] = this.d[x] & ~0xff | this.and8(this.read8(ea), this.d[x]));
		case 0o07: // AND.B Abs...,Dx
			return y >= 5 ? this.exception(4) : void(this.d[x] = this.d[x] & ~0xff | this.and8(this.rop8(), this.d[x]));
		case 0o10: // AND.W Dy,Dx
			return void(this.d[x] = this.d[x] & ~0xffff | this.and16(this.d[y], this.d[x]));
		case 0o12: // AND.W (Ay),Dx
			return void(this.d[x] = this.d[x] & ~0xffff | this.and16(this.read16(this.a[y]), this.d[x]));
		case 0o13: // AND.W (Ay)+,Dx
			return this.d[x] = this.d[x] & ~0xffff | this.and16(this.read16(this.a[y]), this.d[x]), void(this.a[y] += 2);
		case 0o14: // AND.W -(Ay),Dx
			return this.a[y] -= 2, void(this.d[x] = this.d[x] & ~0xffff | this.and16(this.read16(this.a[y]), this.d[x]));
		case 0o15: // AND.W d(Ay),Dx
			return ea = this.disp(this.a[y]), void(this.d[x] = this.d[x] & ~0xffff | this.and16(this.read16(ea), this.d[x]));
		case 0o16: // AND.W d(Ay,Xi),Dx
			return ea = this.index(this.a[y]), void(this.d[x] = this.d[x] & ~0xffff | this.and16(this.read16(ea), this.d[x]));
		case 0o17: // AND.W Abs...,Dx
			return y >= 5 ? this.exception(4) : void(this.d[x] = this.d[x] & ~0xffff | this.and16(this.rop16(), this.d[x]));
		case 0o20: // AND.L Dy,Dx
			return void(this.d[x] = this.and32(this.d[y], this.d[x]));
		case 0o22: // AND.L (Ay),Dx
			return void(this.d[x] = this.and32(this.read32(this.a[y]), this.d[x]));
		case 0o23: // AND.L (Ay)+,Dx
			return this.d[x] = this.and32(this.read32(this.a[y]), this.d[x]), void(this.a[y] += 4);
		case 0o24: // AND.L -(Ay),Dx
			return this.a[y] -= 4, void(this.d[x] = this.and32(this.read32(this.a[y]), this.d[x]));
		case 0o25: // AND.L d(Ay),Dx
			return ea = this.disp(this.a[y]), void(this.d[x] = this.and32(this.read32(ea), this.d[x]));
		case 0o26: // AND.L d(Ay,Xi),Dx
			return ea = this.index(this.a[y]), void(this.d[x] = this.and32(this.read32(ea), this.d[x]));
		case 0o27: // AND.L Abs...,Dx
			return y >= 5 ? this.exception(4) : void(this.d[x] = this.and32(this.rop32(), this.d[x]));
		case 0o30: // MULU Dy,Dx
			return void(this.d[x] = this.mulu(this.d[y], this.d[x]));
		case 0o32: // MULU (Ay),Dx
			return void(this.d[x] = this.mulu(this.read16(this.a[y]), this.d[x]));
		case 0o33: // MULU (Ay)+,Dx
			return this.d[x] = this.mulu(this.read16(this.a[y]), this.d[x]), void(this.a[y] += 2);
		case 0o34: // MULU -(Ay),Dx
			return this.a[y] -= 2, void(this.d[x] = this.mulu(this.read16(this.a[y]), this.d[x]));
		case 0o35: // MULU d(Ay),Dx
			return ea = this.disp(this.a[y]), void(this.d[x] = this.mulu(this.read16(ea), this.d[x]));
		case 0o36: // MULU d(Ay,Xi),Dx
			return ea = this.index(this.a[y]), void(this.d[x] = this.mulu(this.read16(ea), this.d[x]));
		case 0o37: // MULU Abs...,Dx
			return y >= 5 ? this.exception(4) : void(this.d[x] = this.mulu(this.rop16(), this.d[x]));
		case 0o40: // ABCD Dy,Dx
			return void(this.d[x] = this.d[x] & ~0xff | this.abcd(this.d[y], this.d[x]));
		case 0o41: // ABCD -(Ay),-(Ax)
			return this.a[y] -= y < 7 ? 1 : 2, this.a[x] -= x < 7 ? 1 : 2, this.write8(this.abcd(this.read8(this.a[y]), this.read8(this.a[x])), this.a[x]);
		case 0o42: // AND.B Dx,(Ay)
			return this.write8(this.and8(this.d[x], this.read8(this.a[y])), this.a[y]);
		case 0o43: // AND.B Dx,(Ay)+
			return this.write8(this.and8(this.d[x], this.read8(this.a[y])), this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
		case 0o44: // AND.B Dx,-(Ay)
			return this.a[y] -= y < 7 ? 1 : 2, this.write8(this.and8(this.d[x], this.read8(this.a[y])), this.a[y]);
		case 0o45: // AND.B Dx,d(Ay)
			return ea = this.disp(this.a[y]), this.write8(this.and8(this.d[x], this.read8(ea)), ea);
		case 0o46: // AND.B Dx,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write8(this.and8(this.d[x], this.read8(ea)), ea);
		case 0o47:
			switch (y) {
			case 0: // AND.B Dx,Abs.W
				return ea = this.fetch16s(), this.write8(this.and8(this.d[x], this.read8(ea)), ea);
			case 1: // AND.B Dx,Abs.L
				return ea = this.fetch32(), this.write8(this.and8(this.d[x], this.read8(ea)), ea);
			}
			return this.exception(4);
		case 0o50: // EXG Dx,Dy
			return src = this.d[x], this.d[x] = this.d[y], void(this.d[y] = src);
		case 0o51: // EXG Ax,Ay
			return src = this.a[x], this.a[x] = this.a[y], void(this.a[y] = src);
		case 0o52: // AND.W Dx,(Ay)
			return this.write16(this.and16(this.d[x], this.read16(this.a[y])), this.a[y]);
		case 0o53: // AND.W Dx,(Ay)+
			return this.write16(this.and16(this.d[x], this.read16(this.a[y])), this.a[y]), void(this.a[y] += 2);
		case 0o54: // AND.W Dx,-(Ay)
			return this.a[y] -= 2, this.write16(this.and16(this.d[x], this.read16(this.a[y])), this.a[y]);
		case 0o55: // AND.W Dx,d(Ay)
			return ea = this.disp(this.a[y]), this.write16(this.and16(this.d[x], this.read16(ea)), ea);
		case 0o56: // AND.W Dx,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write16(this.and16(this.d[x], this.read16(ea)), ea);
		case 0o57:
			switch (y) {
			case 0: // AND.W Dx,Abs.W
				return ea = this.fetch16s(), this.write16(this.and16(this.d[x], this.read16(ea)), ea);
			case 1: // AND.W Dx,Abs.L
				return ea = this.fetch32(), this.write16(this.and16(this.d[x], this.read16(ea)), ea);
			}
			return this.exception(4);
		case 0o61: // EXG Dx,Ay
			return src = this.d[x], this.d[x] = this.a[y], void(this.a[y] = src);
		case 0o62: // AND.L Dx,(Ay)
			return this.write32(this.and32(this.d[x], this.read32(this.a[y])), this.a[y]);
		case 0o63: // AND.L Dx,(Ay)+
			return this.write32(this.and32(this.d[x], this.read32(this.a[y])), this.a[y]), void(this.a[y] += 4);
		case 0o64: // AND.L Dx,-(Ay)
			return this.a[y] -= 4, this.write32(this.and32(this.d[x], this.read32(this.a[y])), this.a[y]);
		case 0o65: // AND.L Dx,d(Ay)
			return ea = this.disp(this.a[y]), this.write32(this.and32(this.d[x], this.read32(ea)), ea);
		case 0o66: // AND.L Dx,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write32(this.and32(this.d[x], this.read32(ea)), ea);
		case 0o67:
			switch (y) {
			case 0: // AND.L Dx,Abs.W
				return ea = this.fetch16s(), this.write32(this.and32(this.d[x], this.read32(ea)), ea);
			case 1: // AND.L Dx,Abs.L
				return ea = this.fetch32(), this.write32(this.and32(this.d[x], this.read32(ea)), ea);
			}
			return this.exception(4);
		case 0o70: // MULS Dy,Dx
			return void(this.d[x] = this.muls(this.d[y], this.d[x]));
		case 0o72: // MULS (Ay),Dx
			return void(this.d[x] = this.muls(this.read16(this.a[y]), this.d[x]));
		case 0o73: // MULS (Ay)+,Dx
			return this.d[x] = this.muls(this.read16(this.a[y]), this.d[x]), void(this.a[y] += 2);
		case 0o74: // MULS -(Ay),Dx
			return this.a[y] -= 2, void(this.d[x] = this.muls(this.read16(this.a[y]), this.d[x]));
		case 0o75: // MULS d(Ay),Dx
			return ea = this.disp(this.a[y]), void(this.d[x] = this.muls(this.read16(ea), this.d[x]));
		case 0o76: // MULS d(Ay,Xi),Dx
			return ea = this.index(this.a[y]), void(this.d[x] = this.muls(this.read16(ea), this.d[x]));
		case 0o77: // MULS Abs...,Dx
			return y >= 5 ? this.exception(4) : void(this.d[x] = this.muls(this.rop16(), this.d[x]));
		default:
			return this.exception(4);
		}
	}

	execute_d() { // ADD/ADDX
		const x = this.op >> 9 & 7, y = this.op & 7;
		let ea;
		switch (this.op >> 3 & 0o77) {
		case 0o00: // ADD.B Dy,Dx
			return void(this.d[x] = this.d[x] & ~0xff | this.add8(this.d[y], this.d[x]));
		case 0o02: // ADD.B (Ay),Dx
			return void(this.d[x] = this.d[x] & ~0xff | this.add8(this.read8(this.a[y]), this.d[x]));
		case 0o03: // ADD.B (Ay)+,Dx
			return this.d[x] = this.d[x] & ~0xff | this.add8(this.read8(this.a[y]), this.d[x]), void(this.a[y] += y < 7 ? 1 : 2);
		case 0o04: // ADD.B -(Ay),Dx
			return this.a[y] -= y < 7 ? 1 : 2, void(this.d[x] = this.d[x] & ~0xff | this.add8(this.read8(this.a[y]), this.d[x]));
		case 0o05: // ADD.B d(Ay),Dx
			return ea = this.disp(this.a[y]), void(this.d[x] = this.d[x] & ~0xff | this.add8(this.read8(ea), this.d[x]));
		case 0o06: // ADD.B d(Ay,Xi),Dx
			return ea = this.index(this.a[y]), void(this.d[x] = this.d[x] & ~0xff | this.add8(this.read8(ea), this.d[x]));
		case 0o07: // ADD.B Abs...,Dx
			return y >= 5 ? this.exception(4) : void(this.d[x] = this.d[x] & ~0xff | this.add8(this.rop8(), this.d[x]));
		case 0o10: // ADD.W Dy,Dx
			return void(this.d[x] = this.d[x] & ~0xffff | this.add16(this.d[y], this.d[x]));
		case 0o11: // ADD.W Ay,Dx
			return void(this.d[x] = this.d[x] & ~0xffff | this.add16(this.a[y], this.d[x]));
		case 0o12: // ADD.W (Ay),Dx
			return void(this.d[x] = this.d[x] & ~0xffff | this.add16(this.read16(this.a[y]), this.d[x]));
		case 0o13: // ADD.W (Ay)+,Dx
			return this.d[x] = this.d[x] & ~0xffff | this.add16(this.read16(this.a[y]), this.d[x]), void(this.a[y] += 2);
		case 0o14: // ADD.W -(Ay),Dx
			return this.a[y] -= 2, void(this.d[x] = this.d[x] & ~0xffff | this.add16(this.read16(this.a[y]), this.d[x]));
		case 0o15: // ADD.W d(Ay),Dx
			return ea = this.disp(this.a[y]), void(this.d[x] = this.d[x] & ~0xffff | this.add16(this.read16(ea), this.d[x]));
		case 0o16: // ADD.W d(Ay,Xi),Dx
			return ea = this.index(this.a[y]), void(this.d[x] = this.d[x] & ~0xffff | this.add16(this.read16(ea), this.d[x]));
		case 0o17: // ADD.W Abs...,Dx
			return y >= 5 ? this.exception(4) : void(this.d[x] = this.d[x] & ~0xffff | this.add16(this.rop16(), this.d[x]));
		case 0o20: // ADD.L Dy,Dx
			return void(this.d[x] = this.add32(this.d[y], this.d[x]));
		case 0o21: // ADD.L Ay,Dx
			return void(this.d[x] = this.add32(this.a[y], this.d[x]));
		case 0o22: // ADD.L (Ay),Dx
			return void(this.d[x] = this.add32(this.read32(this.a[y]), this.d[x]));
		case 0o23: // ADD.L (Ay)+,Dx
			return this.d[x] = this.add32(this.read32(this.a[y]), this.d[x]), void(this.a[y] += 4);
		case 0o24: // ADD.L -(Ay),Dx
			return this.a[y] -= 4, void(this.d[x] = this.add32(this.read32(this.a[y]), this.d[x]));
		case 0o25: // ADD.L d(Ay),Dx
			return ea = this.disp(this.a[y]), void(this.d[x] = this.add32(this.read32(ea), this.d[x]));
		case 0o26: // ADD.L d(Ay,Xi),Dx
			return ea = this.index(this.a[y]), void(this.d[x] = this.add32(this.read32(ea), this.d[x]));
		case 0o27: // ADD.L Abs...,Dx
			return y >= 5 ? this.exception(4) : void(this.d[x] = this.add32(this.rop32(), this.d[x]));
		case 0o30: // ADDA.W Dy,Ax
			return void(this.a[x] += this.d[y] << 16 >> 16);
		case 0o31: // ADDA.W Ay,Ax
			return void(this.a[x] += this.a[y] << 16 >> 16);
		case 0o32: // ADDA.W (Ay),Ax
			return void(this.a[x] += this.read16(this.a[y]) << 16 >> 16);
		case 0o33: // ADDA.W (Ay)+,Ax
			return this.a[x] += this.read16(this.a[y]) << 16 >> 16, void(this.a[y] += 2);
		case 0o34: // ADDA.W -(Ay),Ax
			return this.a[y] -= 2, void(this.a[x] += this.read16(this.a[y]) << 16 >> 16);
		case 0o35: // ADDA.W d(Ay),Ax
			return ea = this.disp(this.a[y]), void(this.a[x] += this.read16(ea) << 16 >> 16);
		case 0o36: // ADDA.W d(Ay,Xi),Ax
			return ea = this.index(this.a[y]), void(this.a[x] += this.read16(ea) << 16 >> 16);
		case 0o37: // ADDA.W Abs...,Ax
			return y >= 5 ? this.exception(4) : void(this.a[x] += this.rop16() << 16 >> 16);
		case 0o40: // ADDX.B Dy,Dx
			return void(this.d[x] = this.d[x] & ~0xff | this.addx8(this.d[y], this.d[x]));
		case 0o41: // ADDX.B -(Ay),-(Ax)
			return this.a[y] -= y < 7 ? 1 : 2, this.a[x] -= x < 7 ? 1 : 2, this.write8(this.addx8(this.read8(this.a[y]), this.read8(this.a[x])), this.a[x]);
		case 0o42: // ADD.B Dx,(Ay)
			return this.write8(this.add8(this.d[x], this.read8(this.a[y])), this.a[y]);
		case 0o43: // ADD.B Dx,(Ay)+
			return this.write8(this.add8(this.d[x], this.read8(this.a[y])), this.a[y]), void(this.a[y] += y < 7 ? 1 : 2);
		case 0o44: // ADD.B Dx,-(Ay)
			return this.a[y] -= y < 7 ? 1 : 2, this.write8(this.add8(this.d[x], this.read8(this.a[y])), this.a[y]);
		case 0o45: // ADD.B Dx,d(Ay)
			return ea = this.disp(this.a[y]), this.write8(this.add8(this.d[x], this.read8(ea)), ea);
		case 0o46: // ADD.B Dx,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write8(this.add8(this.d[x], this.read8(ea)), ea);
		case 0o47:
			switch (y) {
			case 0: // ADD.B Dx,Abs.W
				return ea = this.fetch16s(), this.write8(this.add8(this.d[x], this.read8(ea)), ea);
			case 1: // ADD.B Dx,Abs.L
				return ea = this.fetch32(), this.write8(this.add8(this.d[x], this.read8(ea)), ea);
			}
			return this.exception(4);
		case 0o50: // ADDX.W Dy,Dx
			return void(this.d[x] = this.d[x] & ~0xffff | this.addx16(this.d[y], this.d[x]));
		case 0o51: // ADDX.W -(Ay),-(Ax)
			return this.a[y] -= 2, this.a[x] -= 2, this.write16(this.addx16(this.read16(this.a[y]), this.read16(this.a[x])), this.a[x]);
		case 0o52: // ADD.W Dx,(Ay)
			return this.write16(this.add16(this.d[x], this.read16(this.a[y])), this.a[y]);
		case 0o53: // ADD.W Dx,(Ay)+
			return this.write16(this.add16(this.d[x], this.read16(this.a[y])), this.a[y]), void(this.a[y] += 2);
		case 0o54: // ADD.W Dx,-(Ay)
			return this.a[y] -= 2, this.write16(this.add16(this.d[x], this.read16(this.a[y])), this.a[y]);
		case 0o55: // ADD.W Dx,d(Ay)
			return ea = this.disp(this.a[y]), this.write16(this.add16(this.d[x], this.read16(ea)), ea);
		case 0o56: // ADD.W Dx,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write16(this.add16(this.d[x], this.read16(ea)), ea);
		case 0o57:
			switch (y) {
			case 0: // ADD.W Dx,Abs.W
				return ea = this.fetch16s(), this.write16(this.add16(this.d[x], this.read16(ea)), ea);
			case 1: // ADD.W Dx,Abs.L
				return ea = this.fetch32(), this.write16(this.add16(this.d[x], this.read16(ea)), ea);
			}
			return this.exception(4);
		case 0o60: // ADDX.L Dy,Dx
			return void(this.d[x] = this.addx32(this.d[y], this.d[x]));
		case 0o61: // ADDX.L -(Ay),-(Ax)
			return this.a[y] -= 4, this.a[x] -= 4, this.write32(this.addx32(this.read32(this.a[y]), this.read32(this.a[x])), this.a[x]);
		case 0o62: // ADD.L Dx,(Ay)
			return this.write32(this.add32(this.d[x], this.read32(this.a[y])), this.a[y]);
		case 0o63: // ADD.L Dx,(Ay)+
			return this.write32(this.add32(this.d[x], this.read32(this.a[y])), this.a[y]), void(this.a[y] += 4);
		case 0o64: // ADD.L Dx,-(Ay)
			return this.a[y] -= 4, this.write32(this.add32(this.d[x], this.read32(this.a[y])), this.a[y]);
		case 0o65: // ADD.L Dx,d(Ay)
			return ea = this.disp(this.a[y]), this.write32(this.add32(this.d[x], this.read32(ea)), ea);
		case 0o66: // ADD.L Dx,d(Ay,Xi)
			return ea = this.index(this.a[y]), this.write32(this.add32(this.d[x], this.read32(ea)), ea);
		case 0o67:
			switch (y) {
			case 0: // ADD.L Dx,Abs.W
				return ea = this.fetch16s(), this.write32(this.add32(this.d[x], this.read32(ea)), ea);
			case 1: // ADD.L Dx,Abs.L
				return ea = this.fetch32(), this.write32(this.add32(this.d[x], this.read32(ea)), ea);
			}
			return this.exception(4);
		case 0o70: // ADDA.L Dy,Ax
			return void(this.a[x] += this.d[y]);
		case 0o71: // ADDA.L Ay,Ax
			return void(this.a[x] += this.a[y]);
		case 0o72: // ADDA.L (Ay),Ax
			return void(this.a[x] += this.read32(this.a[y]));
		case 0o73: // ADDA.L (Ay)+,Ax
			return this.a[x] += this.read32(this.a[y]), void(this.a[y] += 4);
		case 0o74: // ADDA.L -(Ay),Ax
			return this.a[y] -= 4, void(this.a[x] += this.read32(this.a[y]));
		case 0o75: // ADDA.L d(Ay),Ax
			return ea = this.disp(this.a[y]), void(this.a[x] += this.read32(ea));
		case 0o76: // ADDA.L d(Ay,Xi),Ax
			return ea = this.index(this.a[y]), void(this.a[x] += this.read32(ea));
		case 0o77: // ADDA.L Abs...,Ax
			return y >= 5 ? this.exception(4) : void(this.a[x] += this.rop32());
		default:
			return this.exception(4);
		}
	}

	execute_e() { // Shift/Rotate
		const x = this.op >> 9 & 7, y = this.op & 7, data = (x - 1 & 7) + 1;
		let ea;
		switch (this.op >> 3 & 0o77) {
		case 0o00: // ASR.B #<data>,Dy
			return void(this.d[y] = this.d[y] & ~0xff | this.asr8(data, this.d[y]));
		case 0o01: // LSR.B #<data>,Dy
			return void(this.d[y] = this.d[y] & ~0xff | this.lsr8(data, this.d[y]));
		case 0o02: // ROXR.B #<data>,Dy
			return void(this.d[y] = this.d[y] & ~0xff | this.roxr8(data, this.d[y]));
		case 0o03: // ROR.B #<data>,Dy
			return void(this.d[y] = this.d[y] & ~0xff | this.ror8(data, this.d[y]));
		case 0o04: // ASR.B Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.d[y] & ~0xff | this.asr8(this.d[x], this.d[y]));
		case 0o05: // LSR.B Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.d[y] & ~0xff | this.lsr8(this.d[x], this.d[y]));
		case 0o06: // ROXR.B Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.d[y] & ~0xff | this.roxr8(this.d[x], this.d[y]));
		case 0o07: // ROR.B Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.d[y] & ~0xff | this.ror8(this.d[x], this.d[y]));
		case 0o10: // ASR.W #<data>,Dy
			return void(this.d[y] = this.d[y] & ~0xffff | this.asr16(data, this.d[y]));
		case 0o11: // LSR.W #<data>,Dy
			return void(this.d[y] = this.d[y] & ~0xffff | this.lsr16(data, this.d[y]));
		case 0o12: // ROXR.W #<data>,Dy
			return void(this.d[y] = this.d[y] & ~0xffff | this.roxr16(data, this.d[y]));
		case 0o13: // ROR.W #<data>,Dy
			return void(this.d[y] = this.d[y] & ~0xffff | this.ror16(data, this.d[y]));
		case 0o14: // ASR.W Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.d[y] & ~0xffff | this.asr16(this.d[x], this.d[y]));
		case 0o15: // LSR.W Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.d[y] & ~0xffff | this.lsr16(this.d[x], this.d[y]));
		case 0o16: // ROXR.W Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.d[y] & ~0xffff | this.roxr16(this.d[x], this.d[y]));
		case 0o17: // ROR.W Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.d[y] & ~0xffff | this.ror16(this.d[x], this.d[y]));
		case 0o20: // ASR.L #<data>,Dy
			return void(this.d[y] = this.asr32(data, this.d[y]));
		case 0o21: // LSR.L #<data>,Dy
			return void(this.d[y] = this.lsr32(data, this.d[y]));
		case 0o22: // ROXR.L #<data>,Dy
			return void(this.d[y] = this.roxr32(data, this.d[y]));
		case 0o23: // ROR.L #<data>,Dy
			return void(this.d[y] = this.ror32(data, this.d[y]));
		case 0o24: // ASR.L Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.asr32(this.d[x], this.d[y]));
		case 0o25: // LSR.L Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.lsr32(this.d[x], this.d[y]));
		case 0o26: // ROXR.L Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.roxr32(this.d[x], this.d[y]));
		case 0o27: // ROR.L Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.ror32(this.d[x], this.d[y]));
		case 0o32:
			switch (x) {
			case 0: // ASR.W (Ay)
				return this.write16(this.asr16(1, this.read16(this.a[y])), this.a[y]);
			case 1: // LSR.W (Ay)
				return this.write16(this.lsr16(1, this.read16(this.a[y])), this.a[y]);
			case 2: // ROXR.W (Ay)
				return this.write16(this.roxr16(1, this.read16(this.a[y])), this.a[y]);
			case 3: // ROR.W (Ay)
				return this.write16(this.ror16(1, this.read16(this.a[y])), this.a[y]);
			}
			return this.exception(4);
		case 0o33:
			switch (x) {
			case 0: // ASR.W (Ay)+
				return this.write16(this.asr16(1, this.read16(this.a[y])), this.a[y]), void(this.a[y] += 2);
			case 1: // LSR.W (Ay)+
				return this.write16(this.lsr16(1, this.read16(this.a[y])), this.a[y]), void(this.a[y] += 2);
			case 2: // ROXR.W (Ay)+
				return this.write16(this.roxr16(1, this.read16(this.a[y])), this.a[y]), void(this.a[y] += 2);
			case 3: // ROR.W (Ay)+
				return this.write16(this.ror16(1, this.read16(this.a[y])), this.a[y]), void(this.a[y] += 2);
			}
			return this.exception(4);
		case 0o34:
			switch (x) {
			case 0: // ASR.W -(Ay)
				return this.a[y] -= 2, this.write16(this.asr16(1, this.read16(this.a[y])), this.a[y]);
			case 1: // LSR.W -(Ay)
				return this.a[y] -= 2, this.write16(this.lsr16(1, this.read16(this.a[y])), this.a[y]);
			case 2: // ROXR.W -(Ay)
				return this.a[y] -= 2, this.write16(this.roxr16(1, this.read16(this.a[y])), this.a[y]);
			case 3: // ROR.W -(Ay)
				return this.a[y] -= 2, this.write16(this.ror16(1, this.read16(this.a[y])), this.a[y]);
			}
			return this.exception(4);
		case 0o35:
			switch (x) {
			case 0: // ASR.W d(Ay)
				return ea = this.disp(this.a[y]), this.write16(this.asr16(1, this.read16(ea)), ea);
			case 1: // LSR.W d(Ay)
				return ea = this.disp(this.a[y]), this.write16(this.lsr16(1, this.read16(ea)), ea);
			case 2: // ROXR.W d(Ay)
				return ea = this.disp(this.a[y]), this.write16(this.roxr16(1, this.read16(ea)), ea);
			case 3: // ROR.W d(Ay)
				return ea = this.disp(this.a[y]), this.write16(this.ror16(1, this.read16(ea)), ea);
			}
			return this.exception(4);
		case 0o36:
			switch (x) {
			case 0: // ASR.W d(Ay,Xi)
				return ea = this.index(this.a[y]), this.write16(this.asr16(1, this.read16(ea)), ea);
			case 1: // LSR.W d(Ay,Xi)
				return ea = this.index(this.a[y]), this.write16(this.lsr16(1, this.read16(ea)), ea);
			case 2: // ROXR.W d(Ay,Xi)
				return ea = this.index(this.a[y]), this.write16(this.roxr16(1, this.read16(ea)), ea);
			case 3: // ROR.W d(Ay,Xi)
				return ea = this.index(this.a[y]), this.write16(this.ror16(1, this.read16(ea)), ea);
			}
			return this.exception(4);
		case 0o37:
			switch (x << 3 | y) {
			case 0o00: // ASR.W Abs.W
				return ea = this.fetch16s(), this.write16(this.asr16(1, this.read16(ea)), ea);
			case 0o01: // ASR.W Abs.L
				return ea = this.fetch32(), this.write16(this.asr16(1, this.read16(ea)), ea);
			case 0o10: // LSR.W Abs.W
				return ea = this.fetch16s(), this.write16(this.lsr16(1, this.read16(ea)), ea);
			case 0o11: // LSR.W Abs.L
				return ea = this.fetch32(), this.write16(this.lsr16(1, this.read16(ea)), ea);
			case 0o20: // ROXR.W Abs.W
				return ea = this.fetch16s(), this.write16(this.roxr16(1, this.read16(ea)), ea);
			case 0o21: // ROXR.W Abs.L
				return ea = this.fetch32(), this.write16(this.roxr16(1, this.read16(ea)), ea);
			case 0o30: // ROR.W Abs.W
				return ea = this.fetch16s(), this.write16(this.ror16(1, this.read16(ea)), ea);
			case 0o31: // ROR.W Abs.L
				return ea = this.fetch32(), this.write16(this.ror16(1, this.read16(ea)), ea);
			}
			return this.exception(4);
		case 0o40: // ASL.B #<data>,Dy
			return void(this.d[y] = this.d[y] & ~0xff | this.asl8(data, this.d[y]));
		case 0o41: // LSL.B #<data>,Dy
			return void(this.d[y] = this.d[y] & ~0xff | this.lsl8(data, this.d[y]));
		case 0o42: // ROXL.B #<data>,Dy
			return void(this.d[y] = this.d[y] & ~0xff | this.roxl8(data, this.d[y]));
		case 0o43: // ROL.B #<data>,Dy
			return void(this.d[y] = this.d[y] & ~0xff | this.rol8(data, this.d[y]));
		case 0o44: // ASL.B Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.d[y] & ~0xff | this.asl8(this.d[x], this.d[y]));
		case 0o45: // LSL.B Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.d[y] & ~0xff | this.lsl8(this.d[x], this.d[y]));
		case 0o46: // ROXL.B Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.d[y] & ~0xff | this.roxl8(this.d[x], this.d[y]));
		case 0o47: // ROL.B Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.d[y] & ~0xff | this.rol8(this.d[x], this.d[y]));
		case 0o50: // ASL.W #<data>,Dy
			return void(this.d[y] = this.d[y] & ~0xffff | this.asl16(data, this.d[y]));
		case 0o51: // LSL.W #<data>,Dy
			return void(this.d[y] = this.d[y] & ~0xffff | this.lsl16(data, this.d[y]));
		case 0o52: // ROXL.W #<data>,Dy
			return void(this.d[y] = this.d[y] & ~0xffff | this.roxl16(data, this.d[y]));
		case 0o53: // ROL.W #<data>,Dy
			return void(this.d[y] = this.d[y] & ~0xffff | this.rol16(data, this.d[y]));
		case 0o54: // ASL.W Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.d[y] & ~0xffff | this.asl16(this.d[x], this.d[y]));
		case 0o55: // LSL.W Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.d[y] & ~0xffff | this.lsl16(this.d[x], this.d[y]));
		case 0o56: // ROXL.W Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.d[y] & ~0xffff | this.roxl16(this.d[x], this.d[y]));
		case 0o57: // ROL.W Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.d[y] & ~0xffff | this.rol16(this.d[x], this.d[y]));
		case 0o60: // ASL.L #<data>,Dy
			return void(this.d[y] = this.asl32(data, this.d[y]));
		case 0o61: // LSL.L #<data>,Dy
			return void(this.d[y] = this.lsl32(data, this.d[y]));
		case 0o62: // ROXL.L #<data>,Dy
			return void(this.d[y] = this.roxl32(data, this.d[y]));
		case 0o63: // ROL.L #<data>,Dy
			return void(this.d[y] = this.rol32(data, this.d[y]));
		case 0o64: // ASL.L Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.asl32(this.d[x], this.d[y]));
		case 0o65: // LSL.L Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.lsl32(this.d[x], this.d[y]));
		case 0o66: // ROXL.L Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.roxl32(this.d[x], this.d[y]));
		case 0o67: // ROL.L Dx,Dy
			return this.cycle -= this.d[x] << 1 & 0x7e, void(this.d[y] = this.rol32(this.d[x], this.d[y]));
		case 0o72:
			switch (x) {
			case 0: // ASL.W (Ay)
				return this.write16(this.asl16(1, this.read16(this.a[y])), this.a[y]);
			case 1: // LSL.W (Ay)
				return this.write16(this.lsl16(1, this.read16(this.a[y])), this.a[y]);
			case 2: // ROXL.W (Ay)
				return this.write16(this.roxl16(1, this.read16(this.a[y])), this.a[y]);
			case 3: // ROL.W (Ay)
				return this.write16(this.rol16(1, this.read16(this.a[y])), this.a[y]);
			}
			return this.exception(4);
		case 0o73:
			switch (x) {
			case 0: // ASL.W (Ay)+
				return this.write16(this.asl16(1, this.read16(this.a[y])), this.a[y]), void(this.a[y] += 2);
			case 1: // LSL.W (Ay)+
				return this.write16(this.lsl16(1, this.read16(this.a[y])), this.a[y]), void(this.a[y] += 2);
			case 2: // ROXL.W (Ay)+
				return this.write16(this.roxl16(1, this.read16(this.a[y])), this.a[y]), void(this.a[y] += 2);
			case 3: // ROL.W (Ay)+
				return this.write16(this.rol16(1, this.read16(this.a[y])), this.a[y]), void(this.a[y] += 2);
			}
			return this.exception(4);
		case 0o74:
			switch (x) {
			case 0: // ASL.W -(Ay)
				return this.a[y] -= 2, this.write16(this.asl16(1, this.read16(this.a[y])), this.a[y]);
			case 1: // LSL.W -(Ay)
				return this.a[y] -= 2, this.write16(this.lsl16(1, this.read16(this.a[y])), this.a[y]);
			case 2: // ROXL.W -(Ay)
				return this.a[y] -= 2, this.write16(this.roxl16(1, this.read16(this.a[y])), this.a[y]);
			case 3: // ROL.W -(Ay)
				return this.a[y] -= 2, this.write16(this.rol16(1, this.read16(this.a[y])), this.a[y]);
			}
			return this.exception(4);
		case 0o75:
			switch (x) {
			case 0: // ASL.W d(Ay)
				return ea = this.disp(this.a[y]), this.write16(this.asl16(1, this.read16(ea)), ea);
			case 1: // LSL.W d(Ay)
				return ea = this.disp(this.a[y]), this.write16(this.lsl16(1, this.read16(ea)), ea);
			case 2: // ROXL.W d(Ay)
				return ea = this.disp(this.a[y]), this.write16(this.roxl16(1, this.read16(ea)), ea);
			case 3: // ROL.W d(Ay)
				return ea = this.disp(this.a[y]), this.write16(this.rol16(1, this.read16(ea)), ea);
			}
			return this.exception(4);
		case 0o76:
			switch (x) {
			case 0: // ASL.W d(Ay,Xi)
				return ea = this.index(this.a[y]), this.write16(this.asl16(1, this.read16(ea)), ea);
			case 1: // LSL.W d(Ay,Xi)
				return ea = this.index(this.a[y]), this.write16(this.lsl16(1, this.read16(ea)), ea);
			case 2: // ROXL.W d(Ay,Xi)
				return ea = this.index(this.a[y]), this.write16(this.roxl16(1, this.read16(ea)), ea);
			case 3: // ROL.W d(Ay,Xi)
				return ea = this.index(this.a[y]), this.write16(this.rol16(1, this.read16(ea)), ea);
			}
			return this.exception(4);
		case 0o77:
			switch (x << 3 | y) {
			case 0o00: // ASL.W Abs.W
				return ea = this.fetch16s(), this.write16(this.asl16(1, this.read16(ea)), ea);
			case 0o01: // ASL.W Abs.L
				return ea = this.fetch32(), this.write16(this.asl16(1, this.read16(ea)), ea);
			case 0o10: // LSL.W Abs.W
				return ea = this.fetch16s(), this.write16(this.lsl16(1, this.read16(ea)), ea);
			case 0o11: // LSL.W Abs.L
				return ea = this.fetch32(), this.write16(this.lsl16(1, this.read16(ea)), ea);
			case 0o20: // ROXL.W Abs.W
				return ea = this.fetch16s(), this.write16(this.roxl16(1, this.read16(ea)), ea);
			case 0o21: // ROXL.W Abs.L
				return ea = this.fetch32(), this.write16(this.roxl16(1, this.read16(ea)), ea);
			case 0o30: // ROL.W Abs.W
				return ea = this.fetch16s(), this.write16(this.rol16(1, this.read16(ea)), ea);
			case 0o31: // ROL.W Abs.L
				return ea = this.fetch32(), this.write16(this.rol16(1, this.read16(ea)), ea);
			}
			return this.exception(4);
		default:
			return this.exception(4);
		}
	}

	rop8() {
		switch (this.op & 7) {
		case 0: // B Abs.W
			return this.read8(this.fetch16s());
		case 1: // B Abs.L
			return this.read8(this.fetch32());
		case 2: // B d(PC)
			return this.txread8(this.disp(this.pc));
		case 3: // B d(PC,Xi)
			return this.txread8(this.index(this.pc));
		case 4: // B #<data>
			return this.fetch16() & 0xff;
		}
		return -1;
	}

	rop16() {
		switch (this.op & 7) {
		case 0: // W Abs.W
			return this.read16(this.fetch16s());
		case 1: // W Abs.L
			return this.read16(this.fetch32());
		case 2: // W d(PC)
			return this.txread16(this.disp(this.pc));
		case 3: // W d(PC,Xi)
			return this.txread16(this.index(this.pc));
		case 4: // W #<data>
			return this.fetch16();
		}
		return -1;
	}

	rop32() {
		switch (this.op & 7) {
		case 0: // L Abs.W
			return this.read32(this.fetch16s());
		case 1: // L Abs.L
			return this.read32(this.fetch32());
		case 2: // L d(PC)
			return this.txread32(this.disp(this.pc));
		case 3: // L d(PC,Xi)
			return this.txread32(this.index(this.pc));
		case 4: // L #<data>
			return this.fetch32();
		}
		return -1;
	}

	movem16rm() {
		const n = this.op & 7, list = this.fetch16();
		let ea = this.lea();
		if ((this.op & 0o70) === 0o40) {
			for (let i = 0; i < 8; i++)
				list & 1 << i ? (this.cycle -= 4, ea = ea - 2 | 0, this.write16(this.a[7 - i], ea)) : void(0);
			for (let i = 0; i < 8; i++)
				list & 0x100 << i ? (this.cycle -= 4, ea = ea - 2 | 0, this.write16(this.d[7 - i], ea)) : void(0);
			this.a[n] = ea;
		} else {
			for (let i = 0; i < 8; i++)
				list & 1 << i && (this.cycle -= 4, this.write16(this.d[i], ea), ea = ea + 2 | 0);
			for (let i = 0; i < 8; i++)
				list & 0x100 << i && (this.cycle -= 4, this.write16(this.a[i], ea), ea = ea + 2 | 0);
		}
	}

	movem32rm() {
		const n = this.op & 7, list = this.fetch16();
		let ea = this.lea();
		if ((this.op & 0o70) === 0o40) {
			for (let i = 0; i < 8; i++)
				list & 1 << i ? (this.cycle -= 8, ea = ea - 4 | 0, this.write32(this.a[7 - i], ea)) : void(0);
			for (let i = 0; i < 8; i++)
				list & 0x100 << i ? (this.cycle -= 8, ea = ea - 4 | 0, this.write32(this.d[7 - i], ea)) : void(0);
			this.a[n] = ea;
		} else {
			for (let i = 0; i < 8; i++)
				list & 1 << i && (this.cycle -= 8, this.write32(this.d[i], ea), ea = ea + 4 | 0);
			for (let i = 0; i < 8; i++)
				list & 0x100 << i && (this.cycle -= 8, this.write32(this.a[i], ea), ea = ea + 4 | 0);
		}
	}

	movem16mr() {
		const n = this.op & 7, list = this.fetch16();
		let ea = this.lea();
		for (let i = 0; i < 8; i++)
			list & 1 << i && (this.cycle -= 4, this.d[i] = this.read16s(ea), ea = ea + 2 | 0);
		for (let i = 0; i < 8; i++)
			list & 0x100 << i && (this.cycle -= 4, this.a[i] = this.read16s(ea), ea = ea + 2 | 0);
		(this.op & 0o70) === 0o30 && (this.a[n] = ea);
	}

	movem32mr() {
		const n = this.op & 7, list = this.fetch16();
		let ea = this.lea();
		for (let i = 0; i < 8; i++)
			list & 1 << i && (this.cycle -= 8, this.d[i] = this.read32(ea), ea = ea + 4 | 0);
		for (let i = 0; i < 8; i++)
			list & 0x100 << i && (this.cycle -= 8, this.a[i] = this.read32(ea), ea = ea + 4 | 0);
		(this.op & 0o70) === 0o30 && (this.a[n] = ea);
	}

	rte() {
		this.sr = this.read16(this.a[7]), this.a[7] += 2, this.pc = this.read32(this.a[7]), this.a[7] += 4, ~this.sr & 0x2000 && (this.ssp = this.a[7], this.a[7] = this.usp);
	}

	chk(src, dst) {
		dst = dst << 16 >> 16, src = src << 16 >> 16, dst >= 0 && dst <= src ? void(0) : (this.sr = this.sr & ~8 | dst >> 12 & 8, this.exception(6));
	}

	lea() {
		const n = this.op & 7;
		switch(this.op >> 3 & 7) {
		case 2: // (An)
		case 3: // (An)+
		case 4: // -(An)
			return this.a[n];
		case 5: // d(An)
			return this.disp(this.a[n]);
		case 6: // d(An,Xi)
			return this.index(this.a[n]);
		case 7:
			switch (n) {
			case 0: // Abs.W
				return this.fetch16s();
			case 1: // Abs.L
				return this.fetch32();
			case 2: // d(PC)
				return this.disp(this.pc);
			case 3: // d(PC,Xi)
				return this.index(this.pc);
			}
		}
		return -1;
	}

	or8(src, dst) {
		const r = (dst | src) & 0xff;
		return this.sr = this.sr & ~0x0f | r >> 4 & 8 | !r << 2, r;
	}

	or16(src, dst) {
		const r = (dst | src) & 0xffff;
		return this.sr = this.sr & ~0x0f | r >> 12 & 8 | !r << 2, r;
	}

	or32(src, dst) {
		const r = dst | src;
		return this.sr = this.sr & ~0x0f | r >> 28 & 8 | !r << 2, r;
	}

	and8(src, dst) {
		const r = dst & src & 0xff;
		return this.sr = this.sr & ~0x0f | r >> 4 & 8 | !r << 2, r;
	}

	and16(src, dst) {
		const r = dst & src & 0xffff;
		return this.sr = this.sr & ~0x0f | r >> 12 & 8 | !r << 2, r;
	}

	and32(src, dst) {
		const r = dst & src;
		return this.sr = this.sr & ~0x0f | r >> 28 & 8 | !r << 2, r;
	}

	sub8(src, dst) {
		const r = dst - src & 0xff, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		return this.sr = this.sr & ~0x1f | c >> 3 & 0x10 | r >> 4 & 8 | !r << 2 | v >> 6 & 2 | c >> 7 & 1, r;
	}

	sub16(src, dst) {
		const r = dst - src & 0xffff, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		return this.sr = this.sr & ~0x1f | c >> 11 & 0x10 | r >> 12 & 8 | !r << 2 | v >> 14 & 2 | c >> 15 & 1, r;
	}

	sub32(src, dst) {
		const r = dst - src | 0, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		return this.sr = this.sr & ~0x1f | c >> 27 & 0x10 | r >> 28 & 8 | !r << 2 | v >> 30 & 2 | c >> 31 & 1, r;
	}

	suba32(src, dst) {
		return dst - src | 0;
	}

	add8(src, dst) {
		const r = dst + src & 0xff, v = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		return this.sr = this.sr & ~0x1f | c >> 3 & 0x10 | r >> 4 & 8 | !r << 2 | v >> 6 & 2 | c >> 7 & 1, r;
	}

	add16(src, dst) {
		const r = dst + src & 0xffff, v = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		return this.sr = this.sr & ~0x1f | c >> 11 & 0x10 | r >> 12 & 8 | !r << 2 | v >> 14 & 2 | c >> 15 & 1, r;
	}

	add32(src, dst) {
		const r = dst + src | 0, v = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		return this.sr = this.sr & ~0x1f | c >> 27 & 0x10 | r >> 28 & 8 | !r << 2 | v >> 30 & 2 | c >> 31 & 1, r;
	}

	adda32(src, dst) {
		return dst + src | 0;
	}

	btst8(src, dst) {
		this.sr = this.sr & ~4 | ~dst >> (src & 7) << 2 & 4;
	}

	btst32(src, dst) {
		this.sr = this.sr & ~4 | ~dst >> (src & 31) << 2 & 4;
	}

	bchg8(src, dst) {
		return this.sr = this.sr & ~4 | ~dst >> (src &= 7) << 2 & 4, (dst ^ 1 << src) & 0xff;
	}

	bchg32(src, dst) {
		return this.sr = this.sr & ~4 | ~dst >> (src &= 31) << 2 & 4, dst ^ 1 << src;
	}

	bclr8(src, dst) {
		return this.sr = this.sr & ~4 | ~dst >> (src &= 7) << 2 & 4, dst & ~(1 << src) & 0xff;
	}

	bclr32(src, dst) {
		return this.sr = this.sr & ~4 | ~dst >> (src &= 31) << 2 & 4, dst & ~(1 << src);
	}

	bset8(src, dst) {
		return this.sr = this.sr & ~4 | ~dst >> (src &= 7) << 2 & 4, (dst | 1 << src) & 0xff;
	}

	bset32(src, dst) {
		return this.sr = this.sr & ~4 | ~dst >> (src &= 31) << 2 & 4, dst | 1 << src;
	}

	eor8(src, dst) {
		const r = (dst ^ src) & 0xff;
		return this.sr = this.sr & ~0x0f | r >> 4 & 8 | !r << 2, r;
	}

	eor16(src, dst) {
		const r = (dst ^ src) & 0xffff;
		return this.sr = this.sr & ~0x0f | r >> 12 & 8 | !r << 2, r;
	}

	eor32(src, dst) {
		const r = dst ^ src;
		return this.sr = this.sr & ~0x0f | r >> 28 & 8 | !r << 2, r;
	}

	cmp8(src, dst) {
		const r = dst - src & 0xff, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		this.sr = this.sr & ~0x0f | r >> 4 & 8 | !r << 2 | v >> 6 & 2 | c >> 7 & 1;
	}

	cmp16(src, dst) {
		const r = dst - src & 0xffff, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		this.sr = this.sr & ~0x0f | r >> 12 & 8 | !r << 2 | v >> 14 & 2 | c >> 15 & 1;
	}

	cmp32(src, dst) {
		const r = dst - src | 0, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		this.sr = this.sr & ~0x0f | r >> 28 & 8 | !r << 2 | v >> 30 & 2 | c >> 31 & 1;
	}

	divu(src, dst) {
		if (!(src &= 0xffff))
			return this.exception(5), dst;
		const r = (dst >>> 0) / src | 0;
		return r > 0xffff || r < 0 ? (this.sr |= 2, dst) : (this.sr = this.sr & ~0x0f | r >> 12 & 8 | !r << 2, r | (dst >>> 0) % src << 16);
	}

	sbcd(src, dst) {
		let r = dst - src - (this.sr >> 4 & 1) & 0xff, c = ~dst & src | src & r | r & ~dst;
		if (c & 8 && (r & 0x0f) > 5 || (r & 0x0f) > 9)
			r -= 6;
		if (c & 0x80 && (r & 0xf0) > 0x50 || (r & 0xf0) > 0x90)
			r -= 0x60, c |= 0x80;
		return r &= 0xff, this.sr = this.sr & ~0x15 | c >> 3 & 0x10 | this.sr & !r << 2 | c >> 7 & 1, r;
	}

	divs(src, dst) {
		if (!(src = src << 16 >> 16))
			return this.exception(5), dst;
		const r = dst / src | 0;
		return r > 0x7fff || r < -0x8000 ? (this.sr |= 2, dst) : (this.sr = this.sr & ~0x0f | r >> 12 & 8 | !r << 2, r & 0xffff | dst % src << 16);
	}

	subx8(src, dst) {
		const r = dst - src - (this.sr >> 4 & 1) & 0xff, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		return this.sr = this.sr & ~0x1f | c >> 3 & 0x10 | r >> 4 & 8 | this.sr & !r << 2 | v >> 6 & 2 | c >> 7 & 1, r;
	}

	subx16(src, dst) {
		const r = dst - src - (this.sr >> 4 & 1) & 0xffff, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		return this.sr = this.sr & ~0x1f | c >> 11 & 0x10 | r >> 12 & 8 | this.sr & !r << 2 | v >> 14 & 2 | c >> 15 & 1, r;
	}

	subx32(src, dst) {
		const r = dst - src - (this.sr >> 4 & 1) | 0, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		return this.sr = this.sr & ~0x1f | c >> 27 & 0x10 | r >> 28 & 8 | this.sr & !r << 2 | v >> 30 & 2 | c >> 31 & 1, r;
	}

	cmpa16(src, dst) {
		const r = dst - (src = src << 16 >> 16) | 0, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		this.sr = this.sr & ~0x0f | r >> 28 & 8 | !r << 2 | v >> 30 & 2 | c >> 31 & 1;
	}

	cmpa32(src, dst) {
		const r = dst - src | 0, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		this.sr = this.sr & ~0x0f | r >> 28 & 8 | !r << 2 | v >> 30 & 2 | c >> 31 & 1;
	}

	mulu(src, dst) {
		const r = (src & 0xffff) * (dst & 0xffff) | 0;
		return this.cycle -= (bc[src >> 8 & 0xff] + bc[src & 0xff]) << 1, this.sr = this.sr & ~0x0f | r >> 28 & 8 | !r << 2, r;
	}

	abcd(src, dst) {
		let r = dst + src + (this.sr >> 4 & 1) & 0xff, c = dst & src | src & ~r | ~r & dst;
		if (c & 8 && (r & 0x0f) < 4 || (r & 0x0f) > 9)
			if ((r += 6) >= 0x100)
				c |= 0x80;
		if (c & 0x80 && (r & 0xf0) < 0x40 || (r & 0xf0) > 0x90)
			r += 0x60, c |= 0x80;
		return r &= 0xff, this.sr = this.sr & ~0x15 | c >> 3 & 0x10 | this.sr & !r << 2 | c >> 7 & 1, r;
	}

	muls(src, dst) {
		const r = (dst << 16 >> 16) * (src << 16 >> 16) | 0, e = src ^ src << 1;
		return this.cycle -= (bc[e >> 8 & 0xff] + bc[e & 0xff]) << 1, this.sr = this.sr & ~0x0f | r >> 28 & 8 | !r << 2, r;
	}

	addx8(src, dst) {
		const r = dst + src + (this.sr >> 4 & 1) & 0xff, v = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		return this.sr = this.sr & ~0x1f | c >> 3 & 0x10 | r >> 4 & 8 | this.sr & !r << 2 | v >> 6 & 2 | c >> 7 & 1, r;
	}

	addx16(src, dst) {
		const r = dst + src + (this.sr >> 4 & 1) & 0xffff, v = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		return this.sr = this.sr & ~0x1f | c >> 11 & 0x10 | r >> 12 & 8 | this.sr & !r << 2 | v >> 14 & 2 | c >> 15 & 1, r;
	}

	addx32(src, dst) {
		const r = dst + src + (this.sr >> 4 & 1) | 0, v = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		return this.sr = this.sr & ~0x1f | c >> 27 & 0x10 | r >> 28 & 8 | this.sr & !r << 2 | v >> 30 & 2 | c >> 31 & 1, r;
	}

	asr8(src, dst) {
		src &= 63, dst = dst << 24 >> 24;
		const r = dst >> Math.min(src, 7) & 0xff, c = (src > 0) & dst >> Math.min(src - 1, 7), x = src > 0 ? c : this.sr >> 4 & 1;
		return this.sr = this.sr & ~0x1f | x << 4 | r >> 4 & 8 | !r << 2 | c, r;
	}

	asr16(src, dst) {
		src &= 63, dst = dst << 16 >> 16;
		const r = dst >> Math.min(src, 15) & 0xffff, c = (src > 0) & dst >> Math.min(src - 1, 15), x = src > 0 ? c : this.sr >> 4 & 1;
		return this.sr = this.sr & ~0x1f | x << 4 | r >> 12 & 8 | !r << 2 | c, r;
	}

	asr32(src, dst) {
		src &= 63;
		const r = dst >> Math.min(src, 31), c = (src > 0) & dst >> Math.min(src - 1, 31), x = src > 0 ? c : this.sr >> 4 & 1;
		return this.sr = this.sr & ~0x1f | x << 4 | r >> 28 & 8 | !r << 2 | c, r;
	}

	lsr8(src, dst) {
		src &= 63, dst &= 0xff;
		const r = -(src < 8) & dst >> src, c = (src > 0 && src < 9) & dst >> src - 1, x = src > 0 ? c : this.sr >> 4 & 1;
		return this.sr = this.sr & ~0x1f | x << 4 | r >> 4 & 8 | !r << 2 | c, r;
	}

	lsr16(src, dst) {
		src &= 63, dst &= 0xffff;
		const r = -(src < 16) & dst >> src, c = (src > 0 && src < 17) & dst >> src - 1, x = src > 0 ? c : this.sr >> 4 & 1;
		return this.sr = this.sr & ~0x1f | x << 4 | r >> 12 & 8 | !r << 2 | c, r;
	}

	lsr32(src, dst) {
		src &= 63;
		const r = -(src < 32) & dst >>> src, c = (src > 0 && src < 33) & dst >> src - 1, x = src > 0 ? c : this.sr >> 4 & 1;
		return this.sr = this.sr & ~0x1f | x << 4 | r >> 28 & 8 | !r << 2 | c, r;
	}

	roxr8(src, dst) {
		src = (src & 63) % 9, dst &= 0xff;
		let x = this.sr >> 4 & 1, r = (dst | x << 8 | dst << 9) >> src & 0xff;
		x = src > 0 ? dst >> src - 1 & 1 : x;
		return this.sr = this.sr & ~0x1f | x << 4 | r >> 4 & 8 | !r << 2 | x, r;
	}

	roxr16(src, dst) {
		src = (src & 63) % 17, dst &= 0xffff;
		let x = this.sr >> 4 & 1, r = (dst | x << 16 | dst << 17) >> src & 0xffff;
		x = src > 0 ? dst >> src - 1 & 1 : x;
		return this.sr = this.sr & ~0x1f | x << 4 | r >> 12 & 8 | !r << 2 | x, r;
	}

	roxr32(src, dst) {
		src = (src & 63) % 33;
		let x = this.sr >> 4 & 1, r = -(src > 1) & dst << 33 - src | -(src > 0) & x << 32 - src | -(src < 32) & dst >>> src;
		x = src > 0 ? dst >> src - 1 & 1 : x;
		return this.sr = this.sr & ~0x1f | x << 4 | r >> 28 & 8 | !r << 2 | x, r;
	}

	ror8(src, dst) {
		dst &= 0xff;
		const r = (dst | dst << 8) >> (src & 7) & 0xff, c = (src > 0) & r >> 7;
		return this.sr = this.sr & ~0x0f | r >> 4 & 8 | !r << 2 | c, r;
	}

	ror16(src, dst) {
		dst &= 0xffff;
		const r = (dst | dst << 16) >> (src & 15) & 0xffff, c = (src > 0) & r >> 15;
		return this.sr = this.sr & ~0x0f | r >> 12 & 8 | !r << 2 | c, r;
	}

	ror32(src, dst) {
		const r = dst << (-src & 31) | dst >>> (src & 31), c = (src > 0) & r >> 31;
		return this.sr = this.sr & ~0x0f | r >> 28 & 8 | !r << 2 | c, r;
	}

	asl8(src, dst) {
		src &= 63;
		const r = -(src < 8) & dst << src & 0xff, c = (src > 0 && src < 9) & dst << src - 1 >> 7, x = src > 0 ? c : this.sr >> 4 & 1;
		const m = ~0x7f >> Math.min(src - 1, 7) & 0xff, v = src > 0 ? dst >> 7 & ((~(dst << 1) & m) !== 0) | ~dst >> 7 & ((dst << 1 & m) !== 0) : 0;
		return this.sr = this.sr & ~0x1f | x << 4 | r >> 4 & 8 | !r << 2 | v << 1 | c, r;
	}

	asl16(src, dst) {
		src &= 63;
		const r = -(src < 16) & dst << src & 0xffff, c = (src > 0 && src < 17) & dst << src - 1 >> 15, x = src > 0 ? c : this.sr >> 4 & 1;
		const m = ~0x7fff >> Math.min(src - 1, 15) & 0xffff, v = src > 0 ? dst >> 15 & ((~(dst << 1) & m) !== 0) | ~dst >> 15 & ((dst << 1 & m) !== 0) : 0;
		return this.sr = this.sr & ~0x1f | x << 4 | r >> 12 & 8 | !r << 2 | v << 1 | c, r;
	}

	asl32(src, dst) {
		src &= 63;
		const r = -(src < 32) & dst << src, c = (src > 0 && src < 33) & dst << src - 1 >> 31, x = src > 0 ? c : this.sr >> 4 & 1;
		const m = ~0x7fffffff >> Math.min(src - 1, 31), v = src > 0 ? dst >> 31 & ((~(dst << 1) & m) !== 0) | ~dst >> 31 & ((dst << 1 & m) !== 0) : 0;
		return this.sr = this.sr & ~0x1f | x << 4 | r >> 28 & 8 | !r << 2 | v << 1 | c, r;
	}

	lsl8(src, dst) {
		src &= 63;
		const r = -(src < 8) & dst << src & 0xff, c = (src > 0 && src < 9) & dst << src - 1 >> 7, x = src > 0 ? c : this.sr >> 4 & 1;
		return this.sr = this.sr & ~0x1f | x << 4 | r >> 4 & 8 | !r << 2 | c, r;
	}

	lsl16(src, dst) {
		src &= 63;
		const r = -(src < 16) & dst << src & 0xffff, c = (src > 0 && src < 17) & dst << src - 1 >> 15, x = src > 0 ? c : this.sr >> 4 & 1;
		return this.sr = this.sr & ~0x1f | x << 4 | r >> 12 & 8 | !r << 2 | c, r;
	}

	lsl32(src, dst) {
		src &= 63;
		const r = -(src < 32) & dst << src, c = (src > 0 && src < 33) & dst << src - 1 >> 31, x = src > 0 ? c : this.sr >> 4 & 1;
		return this.sr = this.sr & ~0x1f | x << 4 | r >> 28 & 8 | !r << 2 | c, r;
	}

	roxl8(src, dst) {
		src = (src & 63) % 9, dst &= 0xff;
		let x = this.sr >> 4 & 1, r = (dst >> 1 | x << 7 | dst << 8) >> 8 - src & 0xff;
		x = src > 0 ? dst >> 8 - src & 1 : x;
		return this.sr = this.sr & ~0x1f | x << 4 | r >> 4 & 8 | !r << 2 | x, r;
	}

	roxl16(src, dst) {
		src = (src & 63) % 17, dst &= 0xffff;
		let x = this.sr >> 4 & 1, r = (dst >> 1 | x << 15 | dst << 16) >> 16 - src & 0xffff;
		x = src > 0 ? dst >> 16 - src & 1 : x;
		return this.sr = this.sr & ~0x1f | x << 4 | r >> 12 & 8 | !r << 2 | x, r;
	}

	roxl32(src, dst) {
		src = (src & 63) % 33;
		let x = this.sr >> 4 & 1, r = -(src < 32) & dst << src | -(src > 0) & x << src - 1 | -(src > 1) & dst >>> 33 - src;
		x = src > 0 ? dst >> 32 - src & 1 : x;
		return this.sr = this.sr & ~0x1f | x << 4 | r >> 28 & 8 | !r << 2 | x, r;
	}

	rol8(src, dst) {
		dst &= 0xff;
		const r = (dst | dst << 8) >> (-src & 7) & 0xff, c = (src > 0) & r;
		return this.sr = this.sr & ~0x0f | r >> 4 & 8 | !r << 2 | c, r;
	}

	rol16(src, dst) {
		dst &= 0xffff;
		const r = (dst | dst << 16) >> (-src & 15) & 0xffff, c = (src > 0) & r;
		return this.sr = this.sr & ~0x0f | r >> 12 & 8 | !r << 2 | c, r;
	}

	rol32(src, dst) {
		const r = dst << (src & 31) | dst >>> (-src & 31), c = (src > 0) & r;
		return this.sr = this.sr & ~0x0f | r >> 28 & 8 | !r << 2 | c, r;
	}

	negx8(dst) {
		const r = -dst - (this.sr >> 4 & 1) & 0xff, v = dst & r, c = dst | r;
		return this.sr = this.sr & ~0x1f | c >> 3 & 0x10 | r >> 4 & 8 | this.sr & !r << 2 | v >> 6 & 2 | c >> 7 & 1, r;
	}

	negx16(dst) {
		const r = -dst - (this.sr >> 4 & 1) & 0xffff, v = dst & r, c = dst | r;
		return this.sr = this.sr & ~0x1f | c >> 11 & 0x10 | r >> 12 & 8 | this.sr & !r << 2 | v >> 14 & 2 | c >> 15 & 1, r;
	}

	negx32(dst) {
		const r = -dst - (this.sr >> 4 & 1) | 0, v = dst & r, c = dst | r;
		return this.sr = this.sr & ~0x1f | c >> 27 & 0x10 | r >> 28 & 8 | this.sr & !r << 2 | v >> 30 & 2 | c >> 31 & 1, r;
	}

	clr() {
		return this.sr = this.sr & ~0x0f | 4, 0;
	}

	neg8(dst) {
		const r = -dst & 0xff, v = dst & r, c = dst | r;
		return this.sr = this.sr & ~0x1f | c >> 3 & 0x10 | r >> 4 & 8 | !r << 2 | v >> 6 & 2 | c >> 7 & 1, r;
	}

	neg16(dst) {
		const r = -dst & 0xffff, v = dst & r, c = dst | r;
		return this.sr = this.sr & ~0x1f | c >> 11 & 0x10 | r >> 12 & 8 | !r << 2 | v >> 14 & 2 | c >> 15 & 1, r;
	}

	neg32(dst) {
		const r = -dst | 0, v = dst & r, c = dst | r;
		return this.sr = this.sr & ~0x1f | c >> 27 & 0x10 | r >> 28 & 8 | !r << 2 | v >> 30 & 2 | c >> 31 & 1, r;
	}

	nbcd(dst) {
		let r = -dst - (this.sr >> 4 & 1) & 0xff, c = dst | r;
		if (c & 8 && (r & 0x0f) > 5 || (r & 0x0f) > 9)
			r -= 6;
		if (c & 0x80 && (r & 0xf0) > 0x50 || (r & 0xf0) > 0x90)
			r -= 0x60, c |= 0x80;
		return r &= 0xff, this.sr = this.sr & ~0x15 | c >> 3 & 0x10 | this.sr & !r << 2 | c >> 7 & 1, r;
	}

	dbcc(cond) {
		const n = this.op & 7, addr = this.disp(this.pc);
		cond ? (this.cycle -= 2) : ((this.d[n] = this.d[n] & ~0xffff | this.d[n] - 1 & 0xffff) & 0xffff) !== 0xffff ? (this.pc = addr) : (this.cycle -= 4);
	}

	disp(base) {
		return base + this.fetch16s() | 0;
	}

	index(base) {
		const word = this.fetch16(), i = word >> 12 & 7, disp = word << 24 >> 24;
		return word & 0x800 ? base + (word & 0x8000 ? this.a[i] : this.d[i]) + disp | 0 : base + ((word & 0x8000 ? this.a[i] : this.d[i]) << 16 >> 16) + disp | 0;
	}

	txread8(addr) {
		const data = this.txread16(addr & ~1);
		return addr & 1 ? data & 0xff : data >> 8;
	}

	txread16(addr) {
		const page = this.memorymap[addr >> 8 & 0xffff];
		return page.base[addr & 0xff] << 8 | page.base[addr + 1 & 0xff];
	}

	txread32(addr) {
		const data = this.txread16(addr) << 16;
		return data | this.txread16(addr + 2 | 0);
	}

	fetch16() {
		const data = this.txread16(this.pc);
		return this.pc = this.pc + 2 | 0, data;
	}

	fetch16s() {
		const data = this.txread16(this.pc) << 16 >> 16;
		return this.pc = this.pc + 2 | 0, data;
	}

	fetch32() {
		const data = this.txread32(this.pc);
		return this.pc = this.pc + 4 | 0, data;
	}

	read8(addr) {
		const data = this.read16(addr & ~1);
		return addr & 1 ? data & 0xff : data >> 8;
	}

	read16(addr) {
		const page = this.memorymap[addr >> 8 & 0xffff];
		return page.read16 ? page.read16(addr) : page.read ? page.read(addr) << 8 | page.read(addr + 1 | 0) : page.base[addr & 0xff] << 8 | page.base[addr + 1 & 0xff];
	}

	read16s(addr) {
		return this.read16(addr) << 16 >> 16;
	}

	read32(addr) {
		const data = this.read16(addr) << 16;
		return data | this.read16(addr + 2 | 0);
	}

	write8(data, addr) {
		const page = this.memorymap[addr >> 8 & 0xffff];
		page.write ? page.write(addr, data & 0xff) : void(page.base[addr & 0xff] = data);
	}

	write16(data, addr) {
		const page = this.memorymap[addr >> 8 & 0xffff];
		if (page.write16)
			page.write16(addr, data & 0xffff);
		else if (page.write)
			page.write(addr, data >> 8 & 0xff), page.write(addr + 1 | 0, data & 0xff);
		else
			page.base[addr & 0xff] = data >> 8, page.base[addr + 1 & 0xff] = data;
	}

	write32(data, addr) {
		this.write16(data >> 16 & 0xffff, addr), this.write16(data & 0xffff, addr + 2 | 0);
	}
}

const cc = Uint8Array.from(window.atob('\
CAgICAgICAgAAAAAAAAAABAQEBAQEBAQEBAQEBAQEBASEhISEhISEhQUFBQUFBQUFhYWFhYWFhYUGAAAFAAAAAgICAgICAgIAAAAAAAAAAAQEBAQEBAQEBAQ\
EBAQEBAQEhISEhISEhIUFBQUFBQUFBYWFhYWFhYWFBgAABQAAAAQEBAQEBAQEAAAAAAAAAAAHBwcHBwcHBwcHBwcHBwcHB4eHh4eHh4eICAgICAgICAiIiIi\
IiIiIiAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYGBgYGBgYGEBAQEBAQ\
EBAICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAAAAAAAAAICAgICAgICBgYGBgYGBgYDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4O\
EBAQEBAQEBASEhISEhISEhAUAAAAAAAACgoKCgoKCgoQEBAQEBAQEAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAgI\
CAgICAgIGBgYGBgYGBgMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAICAgICAgICAAAAAAAAAAAEBAQEBAQEBAQEBAQ\
EBAQEBISEhISEhISFBQUFBQUFBQWFhYWFhYWFhQYAAAUAAAACAgICAgICAgAAAAAAAAAABAQEBAQEBAQEBAQEBAQEBASEhISEhISEhQUFBQUFBQUFhYWFhYW\
FhYUGAAAFAAAABAQEBAQEBAQAAAAAAAAAAAcHBwcHBwcHBwcHBwcHBwcHh4eHh4eHh4gICAgICAgICIiIiIiIiIiICQAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgYGBgYGBgYQEBAQEBAQEAgICAgICAgICAgICAgICAgKCgoKCgoKCgwM\
DAwMDAwMDg4ODg4ODg4MEAAAAAAAAAgICAgICAgIGBgYGBgYGBgMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAKCgoK\
CgoKChAQEBAQEBAQDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAACAgICAgICAgYGBgYGBgYGAwMDAwMDAwMDAwMDAwM\
DAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAgICAgICAgIAAAAAAAAAAAQEBAQEBAQEBAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBYWFhYWFhYW\
FBgAAAAAAAAICAgICAgICAAAAAAAAAAAEBAQEBAQEBAQEBAQEBAQEBISEhISEhISFBQUFBQUFBQWFhYWFhYWFhQYAAAAAAAAEBAQEBAQEBAAAAAAAAAAABwc\
HBwcHBwcHBwcHBwcHBweHh4eHh4eHiAgICAgICAgIiIiIiIiIiIgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAGBgYGBgYGBhAQEBAQEBAQCAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQAAAAAAAACAgICAgI\
CAgYGBgYGBgYGAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAoKCgoKCgoKEBAQEBAQEBAMDAwMDAwMDAwMDAwMDAwM\
Dg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAICAgICAgICBgYGBgYGBgYDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAU\
AAAAAAAACAgICAgICAgAAAAAAAAAABAQEBAQEBAQEBAQEBAQEBASEhISEhISEhQUFBQUFBQUFhYWFhYWFhYUGAAAAAAAAAgICAgICAgIAAAAAAAAAAAQEBAQ\
EBAQEBAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBYWFhYWFhYWFBgAAAAAAAAQEBAQEBAQEAAAAAAAAAAAHBwcHBwcHBwcHBwcHBwcHB4eHh4eHh4eICAgICAg\
ICAiIiIiIiIiIiAkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYGBgYGBgYG\
EBAQEBAQEBAICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAAAAAAAAAICAgICAgICBgYGBgYGBgYDAwMDAwMDAwMDAwMDAwMDA4O\
Dg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAACgoKCgoKCgoQEBAQEBAQEAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAA\
AAAAAAgICAgICAgIGBgYGBgYGBgMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAKCgoKCgoKCgAAAAAAAAAADAwMDAwM\
DAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAADAwMDAwMDAwAAAAAAAAAABAQEBAQEBAQEBAQEBAQEBASEhISEhISEhQUFBQUFBQU\
FhYWFhYWFhYUGAAAAAAAAA4ODg4ODg4OAAAAAAAAAAAQEBAQEBAQEBAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBYWFhYWFhYWFBgAAAAAAAAMDAwMDAwMDAAA\
AAAAAAAAEBAQEBAQEBAQEBAQEBAQEBISEhISEhISFBQUFBQUFBQWFhYWFhYWFhQYAAAAAAAABgYGBgYGBgYQEBAQEBAQEAgICAgICAgICAgICAgICAgKCgoK\
CgoKCgwMDAwMDAwMDg4ODg4ODg4MEAAAAAAAAAgICAgICAgIGBgYGBgYGBgMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAA\
AAAKCgoKCgoKChAQEBAQEBAQDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAACAgICAgICAgYGBgYGBgYGAwMDAwMDAwM\
DAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAgICAgICAgIAAAAAAAAAAAQEBAQEBAQEBAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBYW\
FhYWFhYWFBgAABQAAAAICAgICAgICAAAAAAAAAAAEBAQEBAQEBAQEBAQEBAQEBISEhISEhISFBQUFBQUFBQWFhYWFhYWFhQYAAAUAAAAEBAQEBAQEBAAAAAA\
AAAAABwcHBwcHBwcHBwcHBwcHBweHh4eHh4eHiAgICAgICAgIiIiIiIiIiIgJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGBgYGBgYGBhAQEBAQEBAQCAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQAAAAAAAA\
CAgICAgICAgYGBgYGBgYGAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAoKCgoKCgoKEBAQEBAQEBAMDAwMDAwMDAwM\
DAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAICAgICAgICBgYGBgYGBgYDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhIS\
EhISEhAUAAAAAAAACAgICAgICAgAAAAAAAAAAAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAgICAgICAgIAAAAAAAA\
AAAMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAODg4ODg4ODgAAAAAAAAAAFBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYW\
GBgYGBgYGBgaGhoaGhoaGhgcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYG\
BgYGBgYGEBAQEBAQEBAICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAAAAAAAAAICAgICAgICBgYGBgYGBgYDAwMDAwMDAwMDAwM\
DAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAACgoKCgoKCgoQEBAQEBAQEAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhIS\
EhIQFAAAAAAAAAgICAgICAgIGBgYGBgYGBgMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABgYGBgYGBgYQEBAQEBAQEAgICAgICAgICAgICAgI\
CAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAAAAAAAAAgICAgICAgIGBgYGBgYGBgMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhIS\
EBQAAAAAAAAKCgoKCgoKChAQEBAQEBAQDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAACAgICAgICAgYGBgYGBgYGAwM\
DAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAQEBAQEBAQEAAAAAAAAAAAICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwM\
DAwMDA4ODg4ODg4ODBAMDggAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAgICAgI\
CAgAAAAAAAAAAAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFBASDAAAAAgICAgICAgIAAAAAAAAAAAMDAwMDAwMDAwMDAwMDAwM\
Dg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQQEgwAAAAICAgICAgICAAAAAAAAAAADAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAU\
EBIMAAAADAwMDAwMDAwAAAAAAAAAABAQEBAQEBAQEBAQEBAQEBASEhISEhISEhQUFBQUFBQUFhYWFhYWFhYUGBQWEAAAAA4ODg4ODg4OAAAAAAAAAAASEhIS\
EhISEhISEhISEhISFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYFhoWGBIAAAAMDAwMDAwMDAAAAAAAAAAAEBAQEBAQEBAQEBAQEBAQEBISEhISEhISFBQUFBQU\
FBQWFhYWFhYWFhQYFBYQAAAABAQEBAQEBAQAAAAAAAAAAAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAICAgICAgICAAAAAAAAAAADAwMDAwMDAwMDAwMDAwMDA4O\
Dg4ODg4OEBAQEBAQEBASEhISEhISEhAUEBIMAAAACAgICAgICAgAAAAAAAAAAAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFBAS\
DAAAAAgICAgICAgIAAAAAAAAAAAMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQQEgwAAAAMDAwMDAwMDAAAAAAAAAAAEBAQEBAQ\
EBAQEBAQEBAQEBISEhISEhISFBQUFBQUFBQWFhYWFhYWFhQYFBYQAAAADg4ODg4ODg4AAAAAAAAAABISEhISEhISEhISEhISEhIUFBQUFBQUFBYWFhYWFhYW\
GBgYGBgYGBgWGhYYEgAAABAQEBAQEBAQAAAAAAAAAAAUFBQUFBQUFBQUFBQUFBQUFhYWFhYWFhYYGBgYGBgYGBoaGhoaGhoaGBwYGhQAAAAEBAQEBAQEBAAA\
AAAAAAAACAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgICAgICAgIAAAAAAAAAAAMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQQEgwA\
AAAICAgICAgICAAAAAAAAAAADAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUEBIMAAAACAgICAgICAgAAAAAAAAAAAwMDAwMDAwM\
DAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFBASDAAAAAwMDAwMDAwMAAAAAAAAAAAQEBAQEBAQEBAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBYW\
FhYWFhYWFBgUFhAAAAAODg4ODg4ODgAAAAAAAAAAEhISEhISEhISEhISEhISEhQUFBQUFBQUFhYWFhYWFhYYGBgYGBgYGBYaFhgSAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEBAQEBAQEAAAAAAAAAAAICAgICAgICAgICAgICAgICgoKCgoK\
CgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
CAgICAgICAgAAAAAAAAAAAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFBASDAAAAAgICAgICAgIAAAAAAAAAAAMDAwMDAwMDAwM\
DAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQQEgwAAAAICAgICAgICAAAAAAAAAAADAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhIS\
EhISEhAUEBIMAAAADAwMDAwMDAwAAAAAAAAAABAQEBAQEBAQEBAQEBAQEBASEhISEhISEhQUFBQUFBQUFhYWFhYWFhYUGBQWEAAAAA4ODg4ODg4OAAAAAAAA\
AAASEhISEhISEhISEhISEhISFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYFhoWGBIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAQEBAQEBAQAAAAAAAAAAAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAICAgICAgICAAAAAAAAAAADAwMDAwMDAwMDAwM\
DAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUEBIMAAAACAgICAgICAgAAAAAAAAAAAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhIS\
EhIQFBASDAAAAAgICAgICAgIAAAAAAAAAAAMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQQEgwAAAAMDAwMDAwMDAAAAAAAAAAA\
EBAQEBAQEBAQEBAQEBAQEBISEhISEhISFBQUFBQUFBQWFhYWFhYWFhQYFBYQAAAADg4ODg4ODg4AAAAAAAAAABISEhISEhISEhISEhISEhIUFBQUFBQUFBYW\
FhYWFhYWGBgYGBgYGBgWGhYYEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBAQE\
BAQEBAAAAAAAAAAACAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgICAgICAgIAAAAAAAAAAAMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhIS\
EBQQEgwAAAAICAgICAgICAAAAAAAAAAADAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUEBIMAAAACAgICAgICAgAAAAAAAAAAAwM\
DAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFBASDAAAAAwMDAwMDAwMAAAAAAAAAAAQEBAQEBAQEBAQEBAQEBAQEhISEhISEhIUFBQU\
FBQUFBYWFhYWFhYWFBgUFhAAAAAODg4ODg4ODgAAAAAAAAAAEhISEhISEhISEhISEhISEhQUFBQUFBQUFhYWFhYWFhYYGBgYGBgYGBYaFhgSAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEBAQEBAQEAAAAAAAAAAAICAgICAgICAgICAgICAgI\
CgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAACAgICAgICAgAAAAAAAAAAAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFBASDAAAAAgICAgICAgIAAAAAAAAAAAMDAwM\
DAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQQEgwAAAAICAgICAgICAAAAAAAAAAADAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQ\
EBASEhISEhISEhAUEBIMAAAADAwMDAwMDAwAAAAAAAAAABAQEBAQEBAQEBAQEBAQEBASEhISEhISEhQUFBQUFBQUFhYWFhYWFhYUGBQWEAAAAA4ODg4ODg4O\
AAAAAAAAAAASEhISEhISEhISEhISEhISFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYFhoWGBIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAQEBAQEBAQAAAAAAAAAAAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwO\
CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAICAgICAgICAAAAAAAAAAADAwMDAwM\
DAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUEBIMAAAACAgICAgICAgAAAAAAAAAAAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQ\
EhISEhISEhIQFBASDAAAAAgICAgICAgIAAAAAAAAAAAMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQQEgwAAAAMDAwMDAwMDAAA\
AAAAAAAAEBAQEBAQEBAQEBAQEBAQEBISEhISEhISFBQUFBQUFBQWFhYWFhYWFhQYFBYQAAAADg4ODg4ODg4AAAAAAAAAABISEhISEhISEhISEhISEhIUFBQU\
FBQUFBYWFhYWFhYWGBgYGBgYGBgWGhYYEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAEBAQEBAQEBAQEBAQEBAQEDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUEBIMAAAABAQEBAQEBAQEBAQEBAQEBAwMDAwMDAwM\
DAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFBASDAAAAAwMDAwMDAwMDAwMDAwMDAwUFBQUFBQUFBQUFBQUFBQUFhYWFhYWFhYYGBgYGBgYGBoa\
GhoaGhoaGBwYGhQAAAAMDAwMDAwMDAwMDAwMDAwMFBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgaGhoaGhoaGhgcGBoUAAAADAwMDAwMDAwMDAwM\
DAwMDBQUFBQUFBQUFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYGhoaGhoaGhoYHBgaFAAAABAQEBAQEBAQEBAQEBAQEBAYGBgYGBgYGBgYGBgYGBgYGhoaGhoa\
GhocHBwcHBwcHB4eHh4eHh4eHCAcHhgAAAASEhISEhISEhISEhISEhISGhoaGhoaGhoaGhoaGhoaGhwcHBwcHBwcHh4eHh4eHh4gICAgICAgIB4iHiAaAAAA\
EBAQEBAQEBAQEBAQEBAQEBgYGBgYGBgYGBgYGBgYGBgaGhoaGhoaGhwcHBwcHBwcHh4eHh4eHh4cIBweGAAAAAQEBAQEBAQEBAQEBAQEBAQMDAwMDAwMDAwM\
DAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQQEgwAAAAEBAQEBAQEBAQEBAQEBAQEDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhIS\
EhISEhAUEBIMAAAADAwMDAwMDAwMDAwMDAwMDBQUFBQUFBQUFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYGhoaGhoaGhoYHBgaFAAAAAwMDAwMDAwMDAwMDAwM\
DAwUFBQUFBQUFBQUFBQUFBQUFhYWFhYWFhYYGBgYGBgYGBoaGhoaGhoaGBwYGhQAAAAMDAwMDAwMDAwMDAwMDAwMFBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYW\
GBgYGBgYGBgaGhoaGhoaGhgcGBoUAAAAEBAQEBAQEBAQEBAQEBAQEBgYGBgYGBgYGBgYGBgYGBgaGhoaGhoaGhwcHBwcHBwcHh4eHh4eHh4cIBweGAAAABIS\
EhISEhISEhISEhISEhIaGhoaGhoaGhoaGhoaGhoaHBwcHBwcHBweHh4eHh4eHiAgICAgICAgHiIeIBoAAAAUFBQUFBQUFBQUFBQUFBQUHBwcHBwcHBwcHBwc\
HBwcHB4eHh4eHh4eICAgICAgICAiIiIiIiIiIiAkICIcAAAABAQEBAQEBAQEBAQEBAQEBAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhIS\
EhIQFBASDAAAAAQEBAQEBAQEBAQEBAQEBAQMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQQEgwAAAAMDAwMDAwMDAwMDAwMDAwM\
FBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgaGhoaGhoaGhgcGBoUAAAADAwMDAwMDAwMDAwMDAwMDBQUFBQUFBQUFBQUFBQUFBQWFhYWFhYWFhgY\
GBgYGBgYGhoaGhoaGhoYHBgaFAAAAAwMDAwMDAwMDAwMDAwMDAwUFBQUFBQUFBQUFBQUFBQUFhYWFhYWFhYYGBgYGBgYGBoaGhoaGhoaGBwYGhQAAAAQEBAQ\
EBAQEBAQEBAQEBAQGBgYGBgYGBgYGBgYGBgYGBoaGhoaGhoaHBwcHBwcHBweHh4eHh4eHhwgHB4YAAAAEhISEhISEhISEhISEhISEhoaGhoaGhoaGhoaGhoa\
GhocHBwcHBwcHB4eHh4eHh4eICAgICAgICAeIh4gGgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAEBAQEBAQEBAQEBAQEBAQEDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUEBIMAAAABAQEBAQEBAQEBAQEBAQEBAwM\
DAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFBASDAAAAAwMDAwMDAwMDAwMDAwMDAwUFBQUFBQUFBQUFBQUFBQUFhYWFhYWFhYYGBgY\
GBgYGBoaGhoaGhoaGBwYGhQAAAAMDAwMDAwMDAwMDAwMDAwMFBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgaGhoaGhoaGhgcGBoUAAAADAwMDAwM\
DAwMDAwMDAwMDBQUFBQUFBQUFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYGhoaGhoaGhoYHBgaFAAAABAQEBAQEBAQEBAQEBAQEBAYGBgYGBgYGBgYGBgYGBgY\
GhoaGhoaGhocHBwcHBwcHB4eHh4eHh4eHCAcHhgAAAASEhISEhISEhISEhISEhISGhoaGhoaGhoaGhoaGhoaGhwcHBwcHBwcHh4eHh4eHh4gICAgICAgIB4i\
HiAaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEBAQEBAQEBAQEBAQEBAQMDAwM\
DAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQQEgwAAAAEBAQEBAQEBAQEBAQEBAQEDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQ\
EBASEhISEhISEhAUEBIMAAAADAwMDAwMDAwMDAwMDAwMDBQUFBQUFBQUFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYGhoaGhoaGhoYHBgaFAAAAAwMDAwMDAwM\
DAwMDAwMDAwUFBQUFBQUFBQUFBQUFBQUFhYWFhYWFhYYGBgYGBgYGBoaGhoaGhoaGBwYGhQAAAAMDAwMDAwMDAwMDAwMDAwMFBQUFBQUFBQUFBQUFBQUFBYW\
FhYWFhYWGBgYGBgYGBgaGhoaGhoaGhgcGBoUAAAAEBAQEBAQEBAQEBAQEBAQEBgYGBgYGBgYGBgYGBgYGBgaGhoaGhoaGhwcHBwcHBwcHh4eHh4eHh4cIBwe\
GAAAABISEhISEhISEhISEhISEhIaGhoaGhoaGhoaGhoaGhoaHBwcHBwcHBweHh4eHh4eHiAgICAgICAgHiIeIBoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAQEBAQEBAQEBAQEBAQEBAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQ\
EhISEhISEhIQFBASDAAAAAQEBAQEBAQEBAQEBAQEBAQMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQQEgwAAAAMDAwMDAwMDAwM\
DAwMDAwMFBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgaGhoaGhoaGhgcGBoUAAAADAwMDAwMDAwMDAwMDAwMDBQUFBQUFBQUFBQUFBQUFBQWFhYW\
FhYWFhgYGBgYGBgYGhoaGhoaGhoYHBgaFAAAAAwMDAwMDAwMDAwMDAwMDAwUFBQUFBQUFBQUFBQUFBQUFhYWFhYWFhYYGBgYGBgYGBoaGhoaGhoaGBwYGhQA\
AAAQEBAQEBAQEBAQEBAQEBAQGBgYGBgYGBgYGBgYGBgYGBoaGhoaGhoaHBwcHBwcHBweHh4eHh4eHhwgHB4YAAAAEhISEhISEhISEhISEhISEhoaGhoaGhoa\
GhoaGhoaGhocHBwcHBwcHB4eHh4eHh4eICAgICAgICAeIh4gGgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAEBAQEBAQEBAQEBAQEBAQEDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUEBIMAAAABAQEBAQEBAQEBAQE\
BAQEBAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFBASDAAAAAwMDAwMDAwMDAwMDAwMDAwUFBQUFBQUFBQUFBQUFBQUFhYWFhYW\
FhYYGBgYGBgYGBoaGhoaGhoaGBwYGhQAAAAMDAwMDAwMDAwMDAwMDAwMFBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgaGhoaGhoaGhgcGBoUAAAA\
DAwMDAwMDAwMDAwMDAwMDBQUFBQUFBQUFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYGhoaGhoaGhoYHBgaFAAAABAQEBAQEBAQEBAQEBAQEBAYGBgYGBgYGBgY\
GBgYGBgYGhoaGhoaGhocHBwcHBwcHB4eHh4eHh4eHCAcHhgAAAASEhISEhISEhISEhISEhISGhoaGhoaGhoaGhoaGhoaGhwcHBwcHBwcHh4eHh4eHh4gICAg\
ICAgIB4iHiAaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEBAQEBAQEBAQEBAQE\
BAQMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQQEgwAAAAEBAQEBAQEBAQEBAQEBAQEDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4O\
EBAQEBAQEBASEhISEhISEhAUEBIMAAAADAwMDAwMDAwMDAwMDAwMDBQUFBQUFBQUFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYGhoaGhoaGhoYHBgaFAAAAAwM\
DAwMDAwMDAwMDAwMDAwUFBQUFBQUFBQUFBQUFBQUFhYWFhYWFhYYGBgYGBgYGBoaGhoaGhoaGBwYGhQAAAAMDAwMDAwMDAwMDAwMDAwMFBQUFBQUFBQUFBQU\
FBQUFBYWFhYWFhYWGBgYGBgYGBgaGhoaGhoaGhgcGBoUAAAAEBAQEBAQEBAQEBAQEBAQEBgYGBgYGBgYGBgYGBgYGBgaGhoaGhoaGhwcHBwcHBwcHh4eHh4e\
Hh4cIBweGAAAABISEhISEhISEhISEhISEhIaGhoaGhoaGhoaGhoaGhoaHBwcHBwcHBweHh4eHh4eHiAgICAgICAgHiIeIBoAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAQEBAQEBAQEBAQEBAQEBAgICAgICAgICAgICAgICAgKCgoKCgoKCgwM\
DAwMDAwMDg4ODg4ODg4MEAwOCAAAAAQEBAQEBAQEBAQEBAQEBAQICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAICAgI\
CAgICAgICAgICAgIDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUEBIMAAAACAgICAgICAgICAgICAgICAwMDAwMDAwMDAwMDAwM\
DAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFBASDAAAAAgICAgICAgICAgICAgICAgMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhIS\
EBQQEgwAAAAMDAwMDAwMDAwMDAwMDAwMEBAQEBAQEBAQEBAQEBAQEBISEhISEhISFBQUFBQUFBQWFhYWFhYWFhQYFBYQAAAADg4ODg4ODg4ODg4ODg4ODhIS\
EhISEhISEhISEhISEhIUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgWGhYYEgAAAAwMDAwMDAwMDAwMDAwMDAwQEBAQEBAQEBAQEBAQEBAQEhISEhISEhIUFBQU\
FBQUFBYWFhYWFhYWFBgUFhAAAAAEBAQEBAQEBAQEBAQEBAQECAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAABAQEBAQE\
BAQEBAQEBAQEBAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAgICAgICAgICAgICAgICAgMDAwMDAwMDAwMDAwMDAwM\
Dg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQQEgwAAAAICAgICAgICAgICAgICAgIDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAU\
EBIMAAAACAgICAgICAgICAgICAgICAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFBASDAAAAAwMDAwMDAwMDAwMDAwMDAwQEBAQ\
EBAQEBAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBYWFhYWFhYWFBgUFhAAAAAODg4ODg4ODg4ODg4ODg4OEhISEhISEhISEhISEhISEhQUFBQUFBQUFhYWFhYW\
FhYYGBgYGBgYGBYaFhgSAAAAEBAQEBAQEBAQEBAQEBAQEBQUFBQUFBQUFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYGhoaGhoaGhoYHBgaFAAAAAQEBAQEBAQE\
BAQEBAQEBAQICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAEBAQEBAQEBAQEBAQEBAQECAgICAgICAgICAgICAgICAoK\
CgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAACAgICAgICAgICAgICAgICAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFBAS\
DAAAAAgICAgICAgICAgICAgICAgMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQQEgwAAAAICAgICAgICAgICAgICAgIDAwMDAwM\
DAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUEBIMAAAADAwMDAwMDAwMDAwMDAwMDBAQEBAQEBAQEBAQEBAQEBASEhISEhISEhQUFBQUFBQU\
FhYWFhYWFhYUGBQWEAAAAA4ODg4ODg4ODg4ODg4ODg4SEhISEhISEhISEhISEhISFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYFhoWGBIAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAQEBAQEBAQEBAQEBAQEBAgICAgICAgICAgICAgICAgKCgoK\
CgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAQEBAQEBAQEBAQEBAQEBAQICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggA\
AAAICAgICAgICAgICAgICAgIDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUEBIMAAAACAgICAgICAgICAgICAgICAwMDAwMDAwM\
DAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFBASDAAAAAgICAgICAgICAgICAgICAgMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBIS\
EhISEhISEBQQEgwAAAAMDAwMDAwMDAwMDAwMDAwMEBAQEBAQEBAQEBAQEBAQEBISEhISEhISFBQUFBQUFBQWFhYWFhYWFhQYFBYQAAAADg4ODg4ODg4ODg4O\
Dg4ODhISEhISEhISEhISEhISEhIUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgWGhYYEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBAQEBAQEBAQEBAQEBAQECAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAA\
BAQEBAQEBAQEBAQEBAQEBAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAgICAgICAgICAgICAgICAgMDAwMDAwMDAwM\
DAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQQEgwAAAAICAgICAgICAgICAgICAgIDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhIS\
EhISEhAUEBIMAAAACAgICAgICAgICAgICAgICAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFBASDAAAAAwMDAwMDAwMDAwMDAwM\
DAwQEBAQEBAQEBAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBYWFhYWFhYWFBgUFhAAAAAODg4ODg4ODg4ODg4ODg4OEhISEhISEhISEhISEhISEhQUFBQUFBQU\
FhYWFhYWFhYYGBgYGBgYGBYaFhgSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQE\
BAQEBAQEBAQEBAQEBAQICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAEBAQEBAQEBAQEBAQEBAQECAgICAgICAgICAgI\
CAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAACAgICAgICAgICAgICAgICAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhIS\
EhIQFBASDAAAAAgICAgICAgICAgICAgICAgMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQQEgwAAAAICAgICAgICAgICAgICAgI\
DAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUEBIMAAAADAwMDAwMDAwMDAwMDAwMDBAQEBAQEBAQEBAQEBAQEBASEhISEhISEhQU\
FBQUFBQUFhYWFhYWFhYUGBQWEAAAAA4ODg4ODg4ODg4ODg4ODg4SEhISEhISEhISEhISEhISFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYFhoWGBIAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAQEBAQEBAQEBAQEBAQEBAgICAgICAgICAgICAgI\
CAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAQEBAQEBAQEBAQEBAQEBAQICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4O\
DBAMDggAAAAICAgICAgICAgICAgICAgIDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUEBIMAAAACAgICAgICAgICAgICAgICAwM\
DAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFBASDAAAAAgICAgICAgICAgICAgICAgMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQ\
EBAQEBISEhISEhISEBQQEgwAAAAMDAwMDAwMDAwMDAwMDAwMEBAQEBAQEBAQEBAQEBAQEBISEhISEhISFBQUFBQUFBQWFhYWFhYWFhQYFBYQAAAADg4ODg4O\
Dg4ODg4ODg4ODhISEhISEhISEhISEhISEhIUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgWGhYYEgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBAQEBAQEBAQEBAQEBAQECAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQ\
DA4IAAAABAQEBAQEBAQEBAQEBAQEBAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAgICAgICAgICAgICAgICAgMDAwM\
DAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQQEgwAAAAICAgICAgICAgICAgICAgIDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQ\
EBASEhISEhISEhAUEBIMAAAACAgICAgICAgICAgICAgICAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFBASDAAAAAwMDAwMDAwM\
DAwMDAwMDAwQEBAQEBAQEBAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBYWFhYWFhYWFBgUFhAAAAAODg4ODg4ODg4ODg4ODg4OEhISEhISEhISEhISEhISEhQU\
FBQUFBQUFhYWFhYWFhYYGBgYGBgYGBYaFhgSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAQEBAQEBAQEAAAAAAAAAAAMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAEBAQEBAQEBAAAAAAAAAAADAwMDAwM\
DAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAABgYGBgYGBgYAAAAAAAAAABQUFBQUFBQUFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgY\
GhoaGhoaGhoYHAAAAAAAAAYGBgYGBgYGAAAAAAAAAAAMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoKCgoKCgoKAAAAAAAAAAAODg4ODg4ODg4ODg4ODg4OEBAQEBAQEBASEhISEhISEhQUFBQUFBQUEhYSFA4A\
AAAAAAAAAAAAAAAAAAAAAAAABAQEBAQEBAQAAAAAAAAAAAAAAAAAAAAACAgICAgICAgMDAwMDAwMDAgMCAwAAAAABAQEBAQEBAQAAAAAAAAAAAwMDAwMDAwM\
DAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAQEBAQEBAQEAAAAAAAAAAAMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBIS\
EhISEhISEBQAAAAAAAAGBgYGBgYGBgAAAAAAAAAAFBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgaGhoaGhoaGhgcAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
CgoKCgoKCgoAAAAAAAAAAA4ODg4ODg4ODg4ODg4ODg4QEBAQEBAQEBISEhISEhISFBQUFBQUFBQSFhIUDgAAAAAAAAAAAAAAAAAAAAAAAAAEBAQEBAQEBAAA\
AAAAAAAAAAAAAAAAAAAICAgICAgICAwMDAwMDAwMCAwIDAAAAAAEBAQEBAQEBAAAAAAAAAAADAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhIS\
EhISEhAUAAAAAAAABAQEBAQEBAQAAAAAAAAAAAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAYGBgYGBgYGAAAAAAAA\
AAAUFBQUFBQUFBQUFBQUFBQUFhYWFhYWFhYYGBgYGBgYGBoaGhoaGhoaGBwAAAAAAAAMDAwMDAwMDAAAAAAAAAAAEBAQEBAQEBAQEBAQEBAQEBISEhISEhIS\
FBQUFBQUFBQWFhYWFhYWFhQYFBYQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKCgoKCgoKCgAAAAAAAAAADg4ODg4ODg4ODg4O\
Dg4ODhAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBIWEhQOAAAAAAAAAAAAAAAAAAAAAAAAAAQEBAQEBAQEAAAAAAAAAAAAAAAAAAAAAAgICAgICAgIDAwMDAwM\
DAwIDAgMAAAAAAQEBAQEBAQEAAAAAAAAAAAMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAEBAQEBAQEBAAAAAAAAAAA\
DAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAABgYGBgYGBgYAAAAAAAAAABQUFBQUFBQUFBQUFBQUFBQWFhYWFhYWFhgY\
GBgYGBgYGhoaGhoaGhoYHAAAAAAAAAwMDAwMDAwMAAAAAAAAAAAQEBAQEBAQEBAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBYWFhYWFhYWFBgUFhAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoKCgoKCgoKAAAAAAAAAAAODg4ODg4ODg4ODg4ODg4OEBAQEBAQEBASEhISEhISEhQUFBQUFBQU\
EhYSFA4AAAAAAAAAAAAAAAAAAAAAAAAABAQEBAQEBAQAAAAAAAAAAAAAAAAAAAAACAgICAgICAgMDAwMDAwMDAgMCAwAAAAABgYGBgYGBgYAAAAAAAAAAAwM\
DAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAQEBAQEBAQEAAAAAAAAAAAMDAwMDAwMDAAAAAAAAAAAAAAAAAAAAAAQEBAQ\
EBAQEBQUFBQUFBQUEBQQFAAAAAAEBAQEBAQEBAAAAAAAAAAACAgICAgICAgAAAAAAAAAAAgICAgICAgIDAwMDAwMDAwODg4ODg4ODgwQAAAAAAAABAQEBAQE\
BAQAAAAAAAAAAAgICAgICAgIAAAAAAAAAAAICAgICAgICAwMDAwMDAwMDg4ODg4ODg4MEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAACgoKCgoKCgoAAAAAAAAAAA4ODg4ODg4ODg4ODg4ODg4QEBAQEBAQEBISEhISEhISFBQUFBQUFBQSFhIUDgAAAAAAAAAAAAAAAAAAAAAAAAAEBAQE\
BAQEBAAAAAAAAAAAAAAAAAAAAAAICAgICAgICAwMDAwMDAwMCAwIDAAAAAAEBAQEBAQEBAAAAAAAAAAACAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwM\
DAwODg4ODg4ODgwQAAAAAAAABAQEBAQEBAQAAAAAAAAAAAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAAAAAAAAAQEBAQEBAQE\
AAAAAAAAAAAMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAEBAQEBAQEBAAAAAAAAAAADg4ODg4ODg4ODg4ODg4ODhAQ\
EBAQEBAQEhISEhISEhIUFBQUFBQUFBIWAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKCgoKCgoKCgAAAAAAAAAADg4ODg4O\
Dg4ODg4ODg4ODhAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBIWEhQOAAAAAAAAAAAAAAAAAAAAAAAAAAQEBAQEBAQEAAAAAAAAAAAAAAAAAAAAAAgICAgICAgI\
DAwMDAwMDAwIDAgMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwMDAwMDAwMDAwMDAwAAAAA\
AAAAABAQEBAQEBAQEhISEhISEhIQFBASAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMDAwMDAwMDAwMDAwMAAAAAAAAAAAQEBAQEBAQEBISEhISEhISEBQQEgAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoKCgoKCgoKAAAAAAAAAAAODg4ODg4ODg4ODg4ODg4OEBAQEBAQEBASEhISEhISEhQU\
FBQUFBQUEhYSFA4AAAAAAAAAAAAAAAAAAAAAAAAABAQEBAQEBAQAAAAAAAAAAAAAAAAAAAAACAgICAgICAgMDAwMDAwMDAgMCAwAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEBAQEBAQEAwMDAwMDAwMBAQEBAQE\
BAQEBAQEBAQEBIQEBBQAEAQUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBAQEBAQEBAAAAAAAAAAAAAAAAAAAAAAEhISEhISEhIWFhYWFhYWFhIUEhYAAAAA\
AAAAAAAAAAAAAAAAAAAAAAgICAgICAgIAAAAAAAAAAAAAAAAAAAAAAoKCgoKCgoKDg4ODg4ODg4KDAoOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAACgoKCgoKCgoAAAAAAAAAAA4ODg4ODg4ODg4ODg4ODg4QEBAQEBAQEBISEhISEhISFBQUFBQUFBQSFhIUDgAAAAAAAAAAAAAAAAAAAAAA\
AAAEBAQEBAQEBAAAAAAAAAAAAAAAAAAAAAAICAgICAgICAwMDAwMDAwMCAwIDAAAAAAEBAQEBAQEBAAAAAAAAAAADAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4O\
EBAQEBAQEBASEhISEhISEhAUAAAAAAAABAQEBAQEBAQICAgICAgICAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAgI\
CAgICAgICAgICAgICAgUFBQUFBQUFBQUFBQUFBQUFhYWFhYWFhYYGBgYGBgYGBoaGhoaGhoaGBwAAAAAAAAEBAQEBAQEBAoKCgoKCgoKDAwMDAwMDAwMDAwM\
DAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAABAQEBAQEBAQAAAAAAAAAAAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhIS\
EhIQFAAAAAAAAAQEBAQEBAQECAgICAgICAgMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAICAgICAgICAgICAgICAgI\
FBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgaGhoaGhoaGhgcAAAAAAAABAQEBAQEBAQKCgoKCgoKCgwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQ\
EBAQEBAQEhISEhISEhIQFAAAAAAAAAQEBAQEBAQEAAAAAAAAAAAMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAEBAQE\
BAQEBAgICAgICAgIDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAACAgICAgICAgICAgICAgICBQUFBQUFBQUFBQUFBQU\
FBQWFhYWFhYWFhgYGBgYGBgYGhoaGhoaGhoYHAAAAAAAAAQEBAQEBAQECgoKCgoKCgoMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhIS\
EBQAAAAAAAAEBAQEBAQEBAAAAAAAAAAADAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAABAQEBAQEBAQICAgICAgICAwM\
DAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAgICAgICAgICAgICAgICAgUFBQUFBQUFBQUFBQUFBQUFhYWFhYWFhYYGBgY\
GBgYGBoaGhoaGhoaGBwAAAAAAAAEBAQEBAQEBAoKCgoKCgoKDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAABAQEBAQE\
BAQAAAAAAAAAAAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAQEBAQEBAQECAgICAgICAgMDAwMDAwMDAwMDAwMDAwM\
Dg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAICAgICAgICAgICAgICAgIFBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgaGhoaGhoaGhgc\
AAAAAAAABAQEBAQEBAQKCgoKCgoKCgwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAQEBAQEBAQEAAAAAAAAAAAMDAwM\
DAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAEBAQEBAQEBAgICAgICAgIDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQ\
EBASEhISEhISEhAUAAAAAAAACAgICAgICAgICAgICAgICBQUFBQUFBQUFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYGhoaGhoaGhoYHAAAAAAAAAQEBAQEBAQE\
CgoKCgoKCgoMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAEBAQEBAQEBAAAAAAAAAAADAwMDAwMDAwMDAwMDAwMDA4O\
Dg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAABAQEBAQEBAQICAgICAgICAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAA\
AAAAAAgICAgICAgICAgICAgICAgUFBQUFBQUFBQUFBQUFBQUFhYWFhYWFhYYGBgYGBgYGBoaGhoaGhoaGBwAAAAAAAAEBAQEBAQEBAoKCgoKCgoKDAwMDAwM\
DAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAABAQEBAQEBAQAAAAAAAAAAAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQ\
EhISEhISEhIQFAAAAAAAAAQEBAQEBAQECAgICAgICAgMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAICAgICAgICAgI\
CAgICAgIFBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgaGhoaGhoaGhgcAAAAAAAABAQEBAQEBAQKCgoKCgoKCgwMDAwMDAwMDAwMDAwMDAwODg4O\
Dg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAQEBAQEBAQEAAAAAAAAAAAMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAA\
AAAEBAQEBAQEBAgICAgICAgIDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAACAgICAgICAgICAgICAgICBQUFBQUFBQU\
FBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYGhoaGhoaGhoYHAAAAAAAAAQEBAQEBAQECgoKCgoKCgoMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBIS\
EhISEhISEBQAAAAAAAAEBAQEBAQEBAAAAAAAAAAADAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAABAQEBAQEBAQICAgI\
CAgICAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAgICAgICAgICAgICAgICAgUFBQUFBQUFBQUFBQUFBQUFhYWFhYW\
FhYYGBgYGBgYGBoaGhoaGhoaGBwAAAAAAAAEBAQEBAQEBAoKCgoKCgoKDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAA\
BAQEBAQEBAQAAAAAAAAAAAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAQEBAQEBAQECAgICAgICAgMDAwMDAwMDAwM\
DAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAICAgICAgICAgICAgICAgIFBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgaGhoa\
GhoaGhgcAAAAAAAABAQEBAQEBAQKCgoKCgoKCgwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAQEBAQEBAQEAAAAAAAA\
AAAMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAEBAQEBAQEBAgICAgICAgIDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4O\
EBAQEBAQEBASEhISEhISEhAUAAAAAAAACAgICAgICAgICAgICAgICBQUFBQUFBQUFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYGhoaGhoaGhoYHAAAAAAAAAQE\
BAQEBAQECgoKCgoKCgoMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAEBAQEBAQEBAAAAAAAAAAADAwMDAwMDAwMDAwM\
DAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAABAQEBAQEBAQICAgICAgICAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhIS\
EhIQFAAAAAAAAAgICAgICAgICAgICAgICAgUFBQUFBQUFBQUFBQUFBQUFhYWFhYWFhYYGBgYGBgYGBoaGhoaGhoaGBwAAAAAAAAEBAQEBAQEBAoKCgoKCgoK\
DAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAABAQEBAQEBAQAAAAAAAAAAAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQ\
EBAQEBAQEhISEhISEhIQFAAAAAAAAAQEBAQEBAQECAgICAgICAgMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAICAgI\
CAgICAgICAgICAgIFBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgaGhoaGhoaGhgcAAAAAAAABAQEBAQEBAQKCgoKCgoKCgwMDAwMDAwMDAwMDAwM\
DAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAQEBAQEBAQEAAAAAAAAAAAMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhIS\
EBQAAAAAAAAEBAQEBAQEBAgICAgICAgIDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAACAgICAgICAgICAgICAgICBQU\
FBQUFBQUFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYGhoaGhoaGhoYHAAAAAAAAAQEBAQEBAQECgoKCgoKCgoMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQ\
EBAQEBISEhISEhISEBQAAAAAAAAEBAQEBAQEBAAAAAAAAAAADAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAABAQEBAQE\
BAQICAgICAgICAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAgICAgICAgICAgICAgICAgUFBQUFBQUFBQUFBQUFBQU\
FhYWFhYWFhYYGBgYGBgYGBoaGhoaGhoaGBwAAAAAAAAEBAQEBAQEBAoKCgoKCgoKDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAU\
AAAAAAAACgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKChISEhISEhIS\
EhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhIS\
EhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhIS\
EhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhIKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoK\
CgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE\
BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE\
BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE\
BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE\
BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE\
BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE\
BAQEBAQEBAQEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBAQE\
BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE\
BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE\
BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE\
BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE\
BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE\
BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE\
BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE\
BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE\
BAQEBAQEBAQEBAQEBAQEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE\
BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE\
BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE\
BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE\
BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE\
BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE\
BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE\
BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE\
BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAEBAQEBAQEBAAAAAAAAAAACAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAABAQEBAQEBAQAAAAAAAAAAAgI\
CAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAgICAgICAgIAAAAAAAAAAAODg4ODg4ODg4ODg4ODg4OEBAQEBAQEBASEhIS\
EhISEhQUFBQUFBQUEhYSFBAAAACMjIyMjIyMjAAAAAAAAAAAkJCQkJCQkJCQkJCQkJCQkJKSkpKSkpKSlJSUlJSUlJSWlpaWlpaWlpSYlJaQAAAABgYGBgYG\
BgYSEhISEhISEgwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMDAwMDAwMDAwMDAwM\
Dg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgaGhoaGhoaGhgc\
AAAAAAAAnp6enp6enp4AAAAAAAAAAKampqampqampqampqampqaoqKioqKioqKqqqqqqqqqqrKysrKysrKyqrqqspgAAAAQEBAQEBAQEAAAAAAAAAAAICAgI\
CAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAEBAQEBAQEBAAAAAAAAAAACAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwM\
DAwODg4ODg4ODgwQDA4IAAAACAgICAgICAgAAAAAAAAAAA4ODg4ODg4ODg4ODg4ODg4QEBAQEBAQEBISEhISEhISFBQUFBQUFBQSFhIUEAAAAIyMjIyMjIyM\
AAAAAAAAAACQkJCQkJCQkJCQkJCQkJCQkpKSkpKSkpKUlJSUlJSUlJaWlpaWlpaWlJiUlpAAAAAGBgYGBgYGBhISEhISEhISDAwMDAwMDAwMDAwMDAwMDA4O\
Dg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAUFBQUFBQUFBQUFBQUFBQUFhYWFhYWFhYYGBgYGBgYGBoaGhoaGhoaGBwAAAAAAACenp6enp6engAAAAAAAAAApqampqam\
pqampqampqampqioqKioqKioqqqqqqqqqqqsrKysrKysrKquqqymAAAABAQEBAQEBAQAAAAAAAAAAAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwM\
Dg4ODg4ODg4MEAwOCAAAAAQEBAQEBAQEAAAAAAAAAAAICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAICAgICAgICAAA\
AAAAAAAADg4ODg4ODg4ODg4ODg4ODhAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBIWEhQQAAAAjIyMjIyMjIwAAAAAAAAAAJCQkJCQkJCQkJCQkJCQkJCSkpKS\
kpKSkpSUlJSUlJSUlpaWlpaWlpaUmJSWkAAAAAYGBgYGBgYGEhISEhISEhIMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAADAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQUFBQUFBQU\
FBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYGhoaGhoaGhoYHAAAAAAAAJ6enp6enp6eAAAAAAAAAACmpqampqampqampqampqamqKioqKioqKiqqqqqqqqqqqys\
rKysrKysqq6qrKYAAAAEBAQEBAQEBAAAAAAAAAAACAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAABAQEBAQEBAQAAAAA\
AAAAAAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAgICAgICAgIAAAAAAAAAAAODg4ODg4ODg4ODg4ODg4OEBAQEBAQ\
EBASEhISEhISEhQUFBQUFBQUEhYSFBAAAACMjIyMjIyMjAAAAAAAAAAAkJCQkJCQkJCQkJCQkJCQkJKSkpKSkpKSlJSUlJSUlJSWlpaWlpaWlpSYlJaQAAAA\
BgYGBgYGBgYSEhISEhISEgwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwMDAwMDAwM\
DAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgaGhoa\
GhoaGhgcAAAAAAAAnp6enp6enp4AAAAAAAAAAKampqampqampqampqampqaoqKioqKioqKqqqqqqqqqqrKysrKysrKyqrqqspgAAAAQEBAQEBAQEAAAAAAAA\
AAAICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAEBAQEBAQEBAAAAAAAAAAACAgICAgICAgICAgICAgICAoKCgoKCgoK\
DAwMDAwMDAwODg4ODg4ODgwQDA4IAAAACAgICAgICAgAAAAAAAAAAA4ODg4ODg4ODg4ODg4ODg4QEBAQEBAQEBISEhISEhISFBQUFBQUFBQSFhIUEAAAAIyM\
jIyMjIyMAAAAAAAAAACQkJCQkJCQkJCQkJCQkJCQkpKSkpKSkpKUlJSUlJSUlJaWlpaWlpaWlJiUlpAAAAAGBgYGBgYGBhISEhISEhISDAwMDAwMDAwMDAwM\
DAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhIS\
EhIQFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUFBQUFBQUFBQUFBQUFBQUFhYWFhYWFhYYGBgYGBgYGBoaGhoaGhoaGBwAAAAAAACenp6enp6engAAAAAAAAAA\
pqampqampqampqampqampqioqKioqKioqqqqqqqqqqqsrKysrKysrKquqqymAAAABAQEBAQEBAQAAAAAAAAAAAgICAgICAgICAgICAgICAgKCgoKCgoKCgwM\
DAwMDAwMDg4ODg4ODg4MEAwOCAAAAAQEBAQEBAQEAAAAAAAAAAAICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAICAgI\
CAgICAAAAAAAAAAADg4ODg4ODg4ODg4ODg4ODhAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBIWEhQQAAAAjIyMjIyMjIwAAAAAAAAAAJCQkJCQkJCQkJCQkJCQ\
kJCSkpKSkpKSkpSUlJSUlJSUlpaWlpaWlpaUmJSWkAAAAAYGBgYGBgYGEhISEhISEhIMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhIS\
EBQAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQU\
FBQUFBQUFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYGhoaGhoaGhoYHAAAAAAAAJ6enp6enp6eAAAAAAAAAACmpqampqampqampqampqamqKioqKioqKiqqqqq\
qqqqqqysrKysrKysqq6qrKYAAAAEBAQEBAQEBAAAAAAAAAAACAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAABAQEBAQE\
BAQAAAAAAAAAAAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAgICAgICAgIAAAAAAAAAAAODg4ODg4ODg4ODg4ODg4O\
EBAQEBAQEBASEhISEhISEhQUFBQUFBQUEhYSFBAAAACMjIyMjIyMjAAAAAAAAAAAkJCQkJCQkJCQkJCQkJCQkJKSkpKSkpKSlJSUlJSUlJSWlpaWlpaWlpSY\
lJaQAAAABgYGBgYGBgYSEhISEhISEgwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMDAwM\
DAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYWGBgYGBgY\
GBgaGhoaGhoaGhgcAAAAAAAAnp6enp6enp4AAAAAAAAAAKampqampqampqampqampqaoqKioqKioqKqqqqqqqqqqrKysrKysrKyqrqqspgAAAAQEBAQEBAQE\
AAAAAAAAAAAICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAEBAQEBAQEBAAAAAAAAAAACAgICAgICAgICAgICAgICAoK\
CgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAACAgICAgICAgAAAAAAAAAAA4ODg4ODg4ODg4ODg4ODg4QEBAQEBAQEBISEhISEhISFBQUFBQUFBQSFhIU\
EAAAAIyMjIyMjIyMAAAAAAAAAACQkJCQkJCQkJCQkJCQkJCQkpKSkpKSkpKUlJSUlJSUlJaWlpaWlpaWlJiUlpAAAAAGBgYGBgYGBhISEhISEhISDAwMDAwM\
DAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQ\
EhISEhISEhIQFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUFBQUFBQUFBQUFBQUFBQUFhYWFhYWFhYYGBgYGBgYGBoaGhoaGhoaGBwAAAAAAACenp6enp6engAA\
AAAAAAAApqampqampqampqampqampqioqKioqKioqqqqqqqqqqqsrKysrKysrKquqqymAAAABAQEBAQEBAQAAAAAAAAAAAgICAgICAgICAgICAgICAgKCgoK\
CgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAQEBAQEBAQEBAQEBAQEBAQICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggA\
AAAICAgICAgICAgICAgICAgIDg4ODg4ODg4ODg4ODg4ODhAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBIWEhQQAAAACAgICAgICAgICAgICAgICAwMDAwMDAwM\
DAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFBASDAAAAAQEBAQEBAQEEhISEhISEhIMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBIS\
EhISEhISEBQAAAAAAAAEBAQEBAQEBBISEhISEhISDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAACAgICAgICAgeHh4e\
Hh4eHhQUFBQUFBQUFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYGhoaGhoaGhoYHAAAAAAAAAgICAgICAgICAgICAgICAgODg4ODg4ODg4ODg4ODg4OEBAQEBAQ\
EBASEhISEhISEhQUFBQUFBQUEhYSFBAAAAAEBAQEBAQEBAAAAAAAAAAACAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAA\
BAQEBAQEBAQEBAQEBAQEBAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAgICAgICAgICAgICAgICAgODg4ODg4ODg4O\
Dg4ODg4OEBAQEBAQEBASEhISEhISEhQUFBQUFBQUEhYSFBAAAAAICAgICAgICAgICAgICAgIDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhIS\
EhISEhAUEBIMAAAABAQEBAQEBAQSEhISEhISEgwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAQEBAQEBAQEEhISEhIS\
EhIMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAICAgICAgICB4eHh4eHh4eFBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYW\
GBgYGBgYGBgaGhoaGhoaGhgcAAAAAAAACAgICAgICAgICAgICAgICA4ODg4ODg4ODg4ODg4ODg4QEBAQEBAQEBISEhISEhISFBQUFBQUFBQSFhIUEAAAAAQE\
BAQEBAQEAAAAAAAAAAAICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAEBAQEBAQEBAQEBAQEBAQECAgICAgICAgICAgI\
CAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAACAgICAgICAgICAgICAgICA4ODg4ODg4ODg4ODg4ODg4QEBAQEBAQEBISEhISEhISFBQUFBQU\
FBQSFhIUEAAAAAgICAgICAgICAgICAgICAgMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQQEgwAAAAEBAQEBAQEBBISEhISEhIS\
DAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAABAQEBAQEBAQSEhISEhISEgwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQ\
EBAQEBAQEhISEhISEhIQFAAAAAAAAAgICAgICAgIHh4eHh4eHh4UFBQUFBQUFBQUFBQUFBQUFhYWFhYWFhYYGBgYGBgYGBoaGhoaGhoaGBwAAAAAAAAICAgI\
CAgICAgICAgICAgIDg4ODg4ODg4ODg4ODg4ODhAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBIWEhQQAAAABAQEBAQEBAQAAAAAAAAAAAgICAgICAgICAgICAgI\
CAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAQEBAQEBAQEBAQEBAQEBAQICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4O\
DBAMDggAAAAICAgICAgICAgICAgICAgIDg4ODg4ODg4ODg4ODg4ODhAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBIWEhQQAAAACAgICAgICAgICAgICAgICAwM\
DAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFBASDAAAAAQEBAQEBAQEEhISEhISEhIMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQ\
EBAQEBISEhISEhISEBQAAAAAAAAEBAQEBAQEBBISEhISEhISDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAACAgICAgI\
CAgeHh4eHh4eHhQUFBQUFBQUFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYGhoaGhoaGhoYHAAAAAAAAAgICAgICAgICAgICAgICAgODg4ODg4ODg4ODg4ODg4O\
EBAQEBAQEBASEhISEhISEhQUFBQUFBQUEhYSFBAAAAAEBAQEBAQEBAAAAAAAAAAACAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQ\
DA4IAAAABAQEBAQEBAQEBAQEBAQEBAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAgICAgICAgICAgICAgICAgODg4O\
Dg4ODg4ODg4ODg4OEBAQEBAQEBASEhISEhISEhQUFBQUFBQUEhYSFBAAAAAICAgICAgICAgICAgICAgIDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQ\
EBASEhISEhISEhAUEBIMAAAABAQEBAQEBAQSEhISEhISEgwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAQEBAQEBAQE\
EhISEhISEhIMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAICAgICAgICB4eHh4eHh4eFBQUFBQUFBQUFBQUFBQUFBYW\
FhYWFhYWGBgYGBgYGBgaGhoaGhoaGhgcAAAAAAAACAgICAgICAgICAgICAgICA4ODg4ODg4ODg4ODg4ODg4QEBAQEBAQEBISEhISEhISFBQUFBQUFBQSFhIU\
EAAAAAQEBAQEBAQEAAAAAAAAAAAICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAEBAQEBAQEBAQEBAQEBAQECAgICAgI\
CAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAACAgICAgICAgICAgICAgICA4ODg4ODg4ODg4ODg4ODg4QEBAQEBAQEBISEhISEhIS\
FBQUFBQUFBQSFhIUEAAAAAgICAgICAgICAgICAgICAgMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQQEgwAAAAEBAQEBAQEBBIS\
EhISEhISDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAABAQEBAQEBAQSEhISEhISEgwMDAwMDAwMDAwMDAwMDAwODg4O\
Dg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAgICAgICAgIHh4eHh4eHh4UFBQUFBQUFBQUFBQUFBQUFhYWFhYWFhYYGBgYGBgYGBoaGhoaGhoaGBwAAAAA\
AAAICAgICAgICAgICAgICAgIDg4ODg4ODg4ODg4ODg4ODhAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBIWEhQQAAAABAQEBAQEBAQAAAAAAAAAAAgICAgICAgI\
CAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAQEBAQEBAQEBAQEBAQEBAQICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4O\
Dg4ODg4ODBAMDggAAAAICAgICAgICAgICAgICAgIDg4ODg4ODg4ODg4ODg4ODhAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBIWEhQQAAAACAgICAgICAgICAgI\
CAgICAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFBASDAAAAAQEBAQEBAQEEhISEhISEhIMDAwMDAwMDAwMDAwMDAwMDg4ODg4O\
Dg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAEBAQEBAQEBBISEhISEhISDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAA\
CAgICAgICAgeHh4eHh4eHhQUFBQUFBQUFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYGhoaGhoaGhoYHAAAAAAAAAgICAgICAgICAgICAgICAgODg4ODg4ODg4O\
Dg4ODg4OEBAQEBAQEBASEhISEhISEhQUFBQUFBQUEhYSFBAAAAAEBAQEBAQEBAAAAAAAAAAACAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4O\
Dg4ODgwQDA4IAAAABAQEBAQEBAQEBAQEBAQEBAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAgICAgICAgICAgICAgI\
CAgODg4ODg4ODg4ODg4ODg4OEBAQEBAQEBASEhISEhISEhQUFBQUFBQUEhYSFBAAAAAICAgICAgICAgICAgICAgIDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4O\
EBAQEBAQEBASEhISEhISEhAUEBIMAAAABAQEBAQEBAQSEhISEhISEgwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAQE\
BAQEBAQEEhISEhISEhIMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAICAgICAgICB4eHh4eHh4eFBQUFBQUFBQUFBQU\
FBQUFBYWFhYWFhYWGBgYGBgYGBgaGhoaGhoaGhgcAAAAAAAACAgICAgICAgICAgICAgICA4ODg4ODg4ODg4ODg4ODg4QEBAQEBAQEBISEhISEhISFBQUFBQU\
FBQSFhIUEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBAQEBAQEBAAAAAAAAAAACAgICAgICAgICAgICAgICAoK\
CgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAABAQEBAQEBAQEBAQEBAQEBAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwO\
CAAAAAYGBgYGBgYGBgYGBgYGBgYODg4ODg4ODg4ODg4ODg4OEBAQEBAQEBASEhISEhISEhQUFBQUFBQUEhYSFA4AAAAGBgYGBgYGBgYGBgYGBgYGCgoKCgoK\
CgoKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEA4SDhAKAAAABAQEBAQEBAQMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQ\
EhISEhISEhIQFAAAAAAAAAQEBAQEBAQEDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAICAgICAgICBQU\
FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgaGhoaGhoaGhgcAAAAAAAABgYGBgYGBgYGBgYGBgYGBg4ODg4ODg4ODg4ODg4ODg4QEBAQ\
EBAQEBISEhISEhISFBQUFBQUFBQSFhIUDgAAAAQEBAQEBAQEAAAAAAAAAAAICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggA\
AAAEBAQEBAQEBAQEBAQEBAQECAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAABgYGBgYGBgYGBgYGBgYGBg4ODg4ODg4O\
Dg4ODg4ODg4QEBAQEBAQEBISEhISEhISFBQUFBQUFBQSFhIUDgAAAAYGBgYGBgYGBgYGBgYGBgYKCgoKCgoKCgoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODhAQ\
EBAQEBAQDhIOEAoAAAAEBAQEBAQEBAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAABAQEBAQEBAQMDAwM\
DAwMDAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAgICAgICAgIFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFhYWFhYW\
FhYYGBgYGBgYGBoaGhoaGhoaGBwAAAAAAAAGBgYGBgYGBgYGBgYGBgYGDg4ODg4ODg4ODg4ODg4ODhAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBIWEhQOAAAA\
BAQEBAQEBAQAAAAAAAAAAAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAQEBAQEBAQEBAQEBAQEBAQICAgICAgICAgI\
CAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAGBgYGBgYGBgYGBgYGBgYGDg4ODg4ODg4ODg4ODg4ODhAQEBAQEBAQEhISEhISEhIUFBQU\
FBQUFBIWEhQOAAAABgYGBgYGBgYGBgYGBgYGBgoKCgoKCgoKCgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBAOEg4QCgAAAAQEBAQEBAQEDAwMDAwM\
DAwMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAEBAQEBAQEBAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4O\
EBAQEBAQEBASEhISEhISEhAUAAAAAAAACAgICAgICAgUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYGhoaGhoaGhoYHAAAAAAAAAYG\
BgYGBgYGBgYGBgYGBgYODg4ODg4ODg4ODg4ODg4OEBAQEBAQEBASEhISEhISEhQUFBQUFBQUEhYSFA4AAAAEBAQEBAQEBAAAAAAAAAAACAgICAgICAgICAgI\
CAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAABAQEBAQEBAQEBAQEBAQEBAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4O\
Dg4MEAwOCAAAAAYGBgYGBgYGBgYGBgYGBgYODg4ODg4ODg4ODg4ODg4OEBAQEBAQEBASEhISEhISEhQUFBQUFBQUEhYSFA4AAAAGBgYGBgYGBgYGBgYGBgYG\
CgoKCgoKCgoKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEA4SDhAKAAAABAQEBAQEBAQMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQ\
EBAQEBAQEhISEhISEhIQFAAAAAAAAAQEBAQEBAQEDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAICAgI\
CAgICBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgaGhoaGhoaGhgcAAAAAAAABgYGBgYGBgYGBgYGBgYGBg4ODg4ODg4ODg4ODg4O\
Dg4QEBAQEBAQEBISEhISEhISFBQUFBQUFBQSFhIUDgAAAAQEBAQEBAQEAAAAAAAAAAAICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4O\
DBAMDggAAAAEBAQEBAQEBAQEBAQEBAQECAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAABgYGBgYGBgYGBgYGBgYGBg4O\
Dg4ODg4ODg4ODg4ODg4QEBAQEBAQEBISEhISEhISFBQUFBQUFBQSFhIUDgAAAAYGBgYGBgYGBgYGBgYGBgYKCgoKCgoKCgoKCgoKCgoKDAwMDAwMDAwODg4O\
Dg4ODhAQEBAQEBAQDhIOEAoAAAAEBAQEBAQEBAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAABAQEBAQE\
BAQMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAgICAgICAgIFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU\
FhYWFhYWFhYYGBgYGBgYGBoaGhoaGhoaGBwAAAAAAAAGBgYGBgYGBgYGBgYGBgYGDg4ODg4ODg4ODg4ODg4ODhAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBIW\
EhQOAAAABAQEBAQEBAQAAAAAAAAAAAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAQEBAQEBAQEBAQEBAQEBAQICAgI\
CAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAGBgYGBgYGBgYGBgYGBgYGDg4ODg4ODg4ODg4ODg4ODhAQEBAQEBAQEhISEhIS\
EhIUFBQUFBQUFBIWEhQOAAAABgYGBgYGBgYGBgYGBgYGBgoKCgoKCgoKCgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBAOEg4QCgAAAAQEBAQEBAQE\
DAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAEBAQEBAQEBAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA4O\
Dg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAACAgICAgICAgUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYGhoaGhoaGhoYHAAA\
AAAAAAYGBgYGBgYGBgYGBgYGBgYODg4ODg4ODg4ODg4ODg4OEBAQEBAQEBASEhISEhISEhQUFBQUFBQUEhYSFA4AAAAEBAQEBAQEBAAAAAAAAAAACAgICAgI\
CAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAABAQEBAQEBAQEBAQEBAQEBAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwM\
Dg4ODg4ODg4MEAwOCAAAAAYGBgYGBgYGBgYGBgYGBgYODg4ODg4ODg4ODg4ODg4OEBAQEBAQEBASEhISEhISEhQUFBQUFBQUEhYSFA4AAAAGBgYGBgYGBgYG\
BgYGBgYGCgoKCgoKCgoKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEA4SDhAKAAAABAQEBAQEBAQMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwODg4O\
Dg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAQEBAQEBAQEDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAA\
AAAICAgICAgICBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgaGhoaGhoaGhgcAAAAAAAABgYGBgYGBgYGBgYGBgYGBg4ODg4ODg4O\
Dg4ODg4ODg4QEBAQEBAQEBISEhISEhISFBQUFBQUFBQSFhIUDgAAAAQEBAQEBAQEAAAAAAAAAAAICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4O\
Dg4ODg4ODBAMDggAAAAEBAQEBAQEBAQEBAQEBAQECAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAABgYGBgYGBgYGBgYG\
BgYGBg4ODg4ODg4ODg4ODg4ODg4QEBAQEBAQEBISEhISEhISFBQUFBQUFBQSFhIUDgAAAAYGBgYGBgYGBgYGBgYGBgYKCgoKCgoKCgoKCgoKCgoKDAwMDAwM\
DAwODg4ODg4ODhAQEBAQEBAQDhIOEAoAAAAEBAQEBAQEBAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAA\
BAQEBAQEBAQMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAgICAgICAgIFBQUFBQUFBQUFBQUFBQUFBQU\
FBQUFBQUFhYWFhYWFhYYGBgYGBgYGBoaGhoaGhoaGBwAAAAAAAAGBgYGBgYGBgYGBgYGBgYGDg4ODg4ODg4ODg4ODg4ODhAQEBAQEBAQEhISEhISEhIUFBQU\
FBQUFBIWEhQOAAAABAQEBAQEBAQAAAAAAAAAAAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAQEBAQEBAQEAAAAAAAA\
AAAICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAICAgICAgICAAAAAAAAAAADg4ODg4ODg4ODg4ODg4ODhAQEBAQEBAQ\
EhISEhISEhIUFBQUFBQUFBIWEhQQAAAAJiYmJiYmJiYAAAAAAAAAACoqKioqKioqKioqKioqKiosLCwsLCwsLC4uLi4uLi4uMDAwMDAwMDAuMi4wKgAAAAYG\
BgYGBgYGEhISEhISEhIMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAGBgYGBgYGBgYGBgYGBgYGDAwMDAwMDAwMDAwM\
DAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAAAAAAAAAAAAAGBgYGBgYGBhQUFBQUFBQUFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYGhoaGhoa\
GhoYHAAAAAAAACYmJiYmJiYmAAAAAAAAAAAuLi4uLi4uLi4uLi4uLi4uMDAwMDAwMDAyMjIyMjIyMjQ0NDQ0NDQ0MjYyNC4AAAAEBAQEBAQEBAAAAAAAAAAA\
CAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAABAQEBAQEBAQAAAAAAAAAAAgICAgICAgICAgICAgICAgKCgoKCgoKCgwM\
DAwMDAwMDg4ODg4ODg4MEAwOCAAAAAgICAgICAgIAAAAAAAAAAAODg4ODg4ODg4ODg4ODg4OEBAQEBAQEBASEhISEhISEhQUFBQUFBQUEhYSFBAAAAAmJiYm\
JiYmJgAAAAAAAAAAKioqKioqKioqKioqKioqKiwsLCwsLCwsLi4uLi4uLi4wMDAwMDAwMC4yLjAqAAAABgYGBgYGBgYSEhISEhISEgwMDAwMDAwMDAwMDAwM\
DAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAYGBgYGBgYGBgYGBgYGBgYMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhIS\
EBQAAAAAAAAAAAAAAAAAAAYGBgYGBgYGFBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgaGhoaGhoaGhgcAAAAAAAAJiYmJiYmJiYAAAAAAAAAAC4u\
Li4uLi4uLi4uLi4uLi4wMDAwMDAwMDIyMjIyMjIyNDQ0NDQ0NDQyNjI0LgAAAAQEBAQEBAQEAAAAAAAAAAAICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwM\
DAwMDA4ODg4ODg4ODBAMDggAAAAEBAQEBAQEBAAAAAAAAAAACAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAACAgICAgI\
CAgAAAAAAAAAAA4ODg4ODg4ODg4ODg4ODg4QEBAQEBAQEBISEhISEhISFBQUFBQUFBQSFhIUEAAAACYmJiYmJiYmAAAAAAAAAAAqKioqKioqKioqKioqKioq\
LCwsLCwsLCwuLi4uLi4uLjAwMDAwMDAwLjIuMCoAAAAGBgYGBgYGBhISEhISEhISDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAU\
AAAAAAAABgYGBgYGBgYGBgYGBgYGBgwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAAAAAAAAAAABgYGBgYGBgYUFBQU\
FBQUFBQUFBQUFBQUFhYWFhYWFhYYGBgYGBgYGBoaGhoaGhoaGBwAAAAAAAAmJiYmJiYmJgAAAAAAAAAALi4uLi4uLi4uLi4uLi4uLjAwMDAwMDAwMjIyMjIy\
MjI0NDQ0NDQ0NDI2MjQuAAAABAQEBAQEBAQAAAAAAAAAAAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAQEBAQEBAQE\
AAAAAAAAAAAICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAICAgICAgICAAAAAAAAAAADg4ODg4ODg4ODg4ODg4ODhAQ\
EBAQEBAQEhISEhISEhIUFBQUFBQUFBIWEhQQAAAAJiYmJiYmJiYAAAAAAAAAACoqKioqKioqKioqKioqKiosLCwsLCwsLC4uLi4uLi4uMDAwMDAwMDAuMi4w\
KgAAAAYGBgYGBgYGEhISEhISEhIMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAGBgYGBgYGBgYGBgYGBgYGDAwMDAwM\
DAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAAAAAAAAAAAAAGBgYGBgYGBhQUFBQUFBQUFBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgY\
GhoaGhoaGhoYHAAAAAAAACYmJiYmJiYmAAAAAAAAAAAuLi4uLi4uLi4uLi4uLi4uMDAwMDAwMDAyMjIyMjIyMjQ0NDQ0NDQ0MjYyNC4AAAAEBAQEBAQEBAAA\
AAAAAAAACAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAABAQEBAQEBAQAAAAAAAAAAAgICAgICAgICAgICAgICAgKCgoK\
CgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAgICAgICAgIAAAAAAAAAAAODg4ODg4ODg4ODg4ODg4OEBAQEBAQEBASEhISEhISEhQUFBQUFBQUEhYSFBAA\
AAAmJiYmJiYmJgAAAAAAAAAAKioqKioqKioqKioqKioqKiwsLCwsLCwsLi4uLi4uLi4wMDAwMDAwMC4yLjAqAAAABgYGBgYGBgYSEhISEhISEgwMDAwMDAwM\
DAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAYGBgYGBgYGBgYGBgYGBgYMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBIS\
EhISEhISEBQAAAAAAAAAAAAAAAAAAAYGBgYGBgYGFBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgaGhoaGhoaGhgcAAAAAAAAJiYmJiYmJiYAAAAA\
AAAAAC4uLi4uLi4uLi4uLi4uLi4wMDAwMDAwMDIyMjIyMjIyNDQ0NDQ0NDQyNjI0LgAAAAQEBAQEBAQEAAAAAAAAAAAICAgICAgICAgICAgICAgICgoKCgoK\
CgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAEBAQEBAQEBAAAAAAAAAAACAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAA\
CAgICAgICAgAAAAAAAAAAA4ODg4ODg4ODg4ODg4ODg4QEBAQEBAQEBISEhISEhISFBQUFBQUFBQSFhIUEAAAACYmJiYmJiYmAAAAAAAAAAAqKioqKioqKioq\
KioqKioqLCwsLCwsLCwuLi4uLi4uLjAwMDAwMDAwLjIuMCoAAAAGBgYGBgYGBhISEhISEhISDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhIS\
EhISEhAUAAAAAAAABgYGBgYGBgYGBgYGBgYGBgwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAAAAAAAAAAABgYGBgYG\
BgYUFBQUFBQUFBQUFBQUFBQUFhYWFhYWFhYYGBgYGBgYGBoaGhoaGhoaGBwAAAAAAAAmJiYmJiYmJgAAAAAAAAAALi4uLi4uLi4uLi4uLi4uLjAwMDAwMDAw\
MjIyMjIyMjI0NDQ0NDQ0NDI2MjQuAAAABAQEBAQEBAQAAAAAAAAAAAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAQE\
BAQEBAQEAAAAAAAAAAAICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAICAgICAgICAAAAAAAAAAADg4ODg4ODg4ODg4O\
Dg4ODhAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBIWEhQQAAAAJiYmJiYmJiYAAAAAAAAAACoqKioqKioqKioqKioqKiosLCwsLCwsLC4uLi4uLi4uMDAwMDAw\
MDAuMi4wKgAAAAYGBgYGBgYGEhISEhISEhIMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAGBgYGBgYGBgYGBgYGBgYG\
DAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAAAAAAAAAAAAAGBgYGBgYGBhQUFBQUFBQUFBQUFBQUFBQWFhYWFhYWFhgY\
GBgYGBgYGhoaGhoaGhoYHAAAAAAAACYmJiYmJiYmAAAAAAAAAAAuLi4uLi4uLi4uLi4uLi4uMDAwMDAwMDAyMjIyMjIyMjQ0NDQ0NDQ0MjYyNC4AAAAEBAQE\
BAQEBAAAAAAAAAAACAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAABAQEBAQEBAQAAAAAAAAAAAgICAgICAgICAgICAgI\
CAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAgICAgICAgIAAAAAAAAAAAODg4ODg4ODg4ODg4ODg4OEBAQEBAQEBASEhISEhISEhQUFBQUFBQU\
EhYSFBAAAAAmJiYmJiYmJgAAAAAAAAAAKioqKioqKioqKioqKioqKiwsLCwsLCwsLi4uLi4uLi4wMDAwMDAwMC4yLjAqAAAABgYGBgYGBgYSEhISEhISEgwM\
DAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAYGBgYGBgYGBgYGBgYGBgYMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQ\
EBAQEBISEhISEhISEBQAAAAAAAAAAAAAAAAAAAYGBgYGBgYGFBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgaGhoaGhoaGhgcAAAAAAAAJiYmJiYm\
JiYAAAAAAAAAAC4uLi4uLi4uLi4uLi4uLi4wMDAwMDAwMDIyMjIyMjIyNDQ0NDQ0NDQyNjI0LgAAAAQEBAQEBAQEAAAAAAAAAAAICAgICAgICAgICAgICAgI\
CgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAEBAQEBAQEBAQEBAQEBAQECAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQ\
DA4IAAAACAgICAgICAgICAgICAgICA4ODg4ODg4ODg4ODg4ODg4QEBAQEBAQEBISEhISEhISFBQUFBQUFBQSFhIUEAAAAAgICAgICAgICAgICAgICAgMDAwM\
DAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQQEgwAAAAEBAQEBAQEBBISEhISEhISDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQ\
EBASEhISEhISEhAUAAAAAAAABAQEBAQEBAQSEhISEhISEgwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAgICAgICAgI\
Hh4eHh4eHh4UFBQUFBQUFBQUFBQUFBQUFhYWFhYWFhYYGBgYGBgYGBoaGhoaGhoaGBwAAAAAAAAICAgICAgICAgICAgICAgIDg4ODg4ODg4ODg4ODg4ODhAQ\
EBAQEBAQEhISEhISEhIUFBQUFBQUFBIWEhQQAAAABAQEBAQEBAQAAAAAAAAAAAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwO\
CAAAAAQEBAQEBAQEBAQEBAQEBAQICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAICAgICAgICAgICAgICAgIDg4ODg4O\
Dg4ODg4ODg4ODhAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBIWEhQQAAAACAgICAgICAgICAgICAgICAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQ\
EhISEhISEhIQFBASDAAAAAQEBAQEBAQEEhISEhISEhIMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAEBAQEBAQEBBIS\
EhISEhISDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAACAgICAgICAgeHh4eHh4eHhQUFBQUFBQUFBQUFBQUFBQWFhYW\
FhYWFhgYGBgYGBgYGhoaGhoaGhoYHAAAAAAAAAgICAgICAgICAgICAgICAgODg4ODg4ODg4ODg4ODg4OEBAQEBAQEBASEhISEhISEhQUFBQUFBQUEhYSFBAA\
AAAEBAQEBAQEBAAAAAAAAAAACAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAABAQEBAQEBAQEBAQEBAQEBAgICAgICAgI\
CAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAgICAgICAgICAgICAgICAgODg4ODg4ODg4ODg4ODg4OEBAQEBAQEBASEhISEhISEhQU\
FBQUFBQUEhYSFBAAAAAICAgICAgICAgICAgICAgIDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUEBIMAAAABAQEBAQEBAQSEhIS\
EhISEgwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAQEBAQEBAQEEhISEhISEhIMDAwMDAwMDAwMDAwMDAwMDg4ODg4O\
Dg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAICAgICAgICB4eHh4eHh4eFBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgaGhoaGhoaGhgcAAAAAAAA\
CAgICAgICAgICAgICAgICA4ODg4ODg4ODg4ODg4ODg4QEBAQEBAQEBISEhISEhISFBQUFBQUFBQSFhIUEAAAAAQEBAQEBAQEAAAAAAAAAAAICAgICAgICAgI\
CAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAEBAQEBAQEBAQEBAQEBAQECAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4O\
Dg4ODgwQDA4IAAAACAgICAgICAgICAgICAgICA4ODg4ODg4ODg4ODg4ODg4QEBAQEBAQEBISEhISEhISFBQUFBQUFBQSFhIUEAAAAAgICAgICAgICAgICAgI\
CAgMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQQEgwAAAAEBAQEBAQEBBISEhISEhISDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4O\
EBAQEBAQEBASEhISEhISEhAUAAAAAAAABAQEBAQEBAQSEhISEhISEgwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAgI\
CAgICAgIHh4eHh4eHh4UFBQUFBQUFBQUFBQUFBQUFhYWFhYWFhYYGBgYGBgYGBoaGhoaGhoaGBwAAAAAAAAICAgICAgICAgICAgICAgIDg4ODg4ODg4ODg4O\
Dg4ODhAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBIWEhQQAAAABAQEBAQEBAQAAAAAAAAAAAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4O\
Dg4MEAwOCAAAAAQEBAQEBAQEBAQEBAQEBAQICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAICAgICAgICAgICAgICAgI\
Dg4ODg4ODg4ODg4ODg4ODhAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBIWEhQQAAAACAgICAgICAgICAgICAgICAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQ\
EBAQEBAQEhISEhISEhIQFBASDAAAAAQEBAQEBAQEEhISEhISEhIMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAEBAQE\
BAQEBBISEhISEhISDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAACAgICAgICAgeHh4eHh4eHhQUFBQUFBQUFBQUFBQU\
FBQWFhYWFhYWFhgYGBgYGBgYGhoaGhoaGhoYHAAAAAAAAAgICAgICAgICAgICAgICAgODg4ODg4ODg4ODg4ODg4OEBAQEBAQEBASEhISEhISEhQUFBQUFBQU\
EhYSFBAAAAAEBAQEBAQEBAAAAAAAAAAACAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwMDAwODg4ODg4ODgwQDA4IAAAABAQEBAQEBAQEBAQEBAQEBAgI\
CAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwMDg4ODg4ODg4MEAwOCAAAAAgICAgICAgICAgICAgICAgODg4ODg4ODg4ODg4ODg4OEBAQEBAQEBASEhIS\
EhISEhQUFBQUFBQUEhYSFBAAAAAICAgICAgICAgICAgICAgIDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUEBIMAAAABAQEBAQE\
BAQSEhISEhISEgwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAQEBAQEBAQEEhISEhISEhIMDAwMDAwMDAwMDAwMDAwM\
Dg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAICAgICAgICB4eHh4eHh4eFBQUFBQUFBQUFBQUFBQUFBYWFhYWFhYWGBgYGBgYGBgaGhoaGhoaGhgc\
AAAAAAAACAgICAgICAgICAgICAgICA4ODg4ODg4ODg4ODg4ODg4QEBAQEBAQEBISEhISEhISFBQUFBQUFBQSFhIUEAAAAAQEBAQEBAQEAAAAAAAAAAAICAgI\
CAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAEBAQEBAQEBAQEBAQEBAQECAgICAgICAgICAgICAgICAoKCgoKCgoKDAwMDAwM\
DAwODg4ODg4ODgwQDA4IAAAACAgICAgICAgICAgICAgICA4ODg4ODg4ODg4ODg4ODg4QEBAQEBAQEBISEhISEhISFBQUFBQUFBQSFhIUEAAAAAgICAgICAgI\
CAgICAgICAgMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQQEgwAAAAEBAQEBAQEBBISEhISEhISDAwMDAwMDAwMDAwMDAwMDA4O\
Dg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAABAQEBAQEBAQSEhISEhISEgwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAA\
AAAAAAgICAgICAgIHh4eHh4eHh4UFBQUFBQUFBQUFBQUFBQUFhYWFhYWFhYYGBgYGBgYGBoaGhoaGhoaGBwAAAAAAAAICAgICAgICAgICAgICAgIDg4ODg4O\
Dg4ODg4ODg4ODhAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBIWEhQQAAAABAQEBAQEBAQAAAAAAAAAAAgICAgICAgICAgICAgICAgKCgoKCgoKCgwMDAwMDAwM\
Dg4ODg4ODg4MEAwOCAAAAAQEBAQEBAQEBAQEBAQEBAQICAgICAgICAgICAgICAgICgoKCgoKCgoMDAwMDAwMDA4ODg4ODg4ODBAMDggAAAAICAgICAgICAgI\
CAgICAgIDg4ODg4ODg4ODg4ODg4ODhAQEBAQEBAQEhISEhISEhIUFBQUFBQUFBIWEhQQAAAACAgICAgICAgICAgICAgICAwMDAwMDAwMDAwMDAwMDAwODg4O\
Dg4ODhAQEBAQEBAQEhISEhISEhIQFBASDAAAAAQEBAQEBAQEEhISEhISEhIMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAA\
AAAEBAQEBAQEBBISEhISEhISDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAACAgICAgICAgeHh4eHh4eHhQUFBQUFBQU\
FBQUFBQUFBQWFhYWFhYWFhgYGBgYGBgYGhoaGhoaGhoYHAAAAAAAAAgICAgICAgICAgICAgICAgODg4ODg4ODg4ODg4ODg4OEBAQEBAQEBASEhISEhISEhQU\
FBQUFBQUEhYSFBAAAAAWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGFhYWFhYWFhYWFhYW\
FhYWFhYWFhYWFhYWFhYWFhYWFhYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBhgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYCAgICAgI\
CAgICAgICAgICAgICAgICAgICAgICAgICAgAAAAAAAAAAAAAAAAAAAAADAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAA\
FhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYW\
FhYWFhYWBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGAgICAgICAgICAgICAgICAgICAgI\
CAgICAgICAgICAgIAAAAAAAAAAAAAAAAAAAAAAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAgICAgICAgICAgICAgI\
CAgICAgICAgICAgICAgICAgIBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAYGBgYGBgYG\
BgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAAA\
AAAAAAAAAAAAAAAAAAAMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQEBAQEBISEhISEhISEBQAAAAAAAAICAgICAgICAgICAgICAgICAgICAgICAgICAgI\
CAgICAYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgGBgYGBgYGBgYGBgYGBgYGBgYGBgYG\
BgYGBgYGBgYGBgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgAAAAAAAAAAAAAAAAAAAAA\
DAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAUAAAAAAAACgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoGBgYGBgYGBgYG\
BgYGBgYGBgYGBgYGBgYGBgYGBgYGBgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYMDAwM\
DAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAAAAAAAAAAAAAAAAAAAAwMDAwMDAwMDAwMDAwM\
DAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAAoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYG\
BgYGBgYGBgYKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGDAwMDAwMDAwMDAwMDAwMDAwM\
DAwMDAwMDAwMDAwMDAwICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAAAAAAAAAAAAAAAAAAAAAAMDAwMDAwMDAwMDAwMDAwMDg4ODg4ODg4QEBAQ\
EBAQEBISEhISEhISEBQAAAAAAAAMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGDAwMDAwM\
DAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4O\
CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgAAAAAAAAAAAAAAAAAAAAADAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4OEBAQEBAQEBASEhISEhISEhAU\
AAAAAAAADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgwMDAwMDAwMDAwMDAwMDAwMDAwM\
DAwMDAwMDAwMDAwMBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODggICAgICAgICAgICAgI\
CAgICAgICAgICAgICAgICAgIAAAAAAAAAAAAAAAAAAAAAAwMDAwMDAwMDAwMDAwMDAwODg4ODg4ODhAQEBAQEBAQEhISEhISEhIQFAAAAAAAAA4ODg4ODg4O\
Dg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4OBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODgYG\
BgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAICAgICAgICAgICAgICAgICAgICAgICAgICAgI\
CAgICAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAODg4ODg4ODg4ODg4ODg4ODg4ODg4O\
Dg4ODg4ODg4ODgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGDg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4GBgYGBgYGBgYGBgYGBgYG\
BgYGBgYGBgYGBgYGBgYGBhAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAGBgYG\
BgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBhAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYG\
BgYSEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEggICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQBgYGBgYGBgYGBgYGBgYGBgYG\
BgYGBgYGBgYGBgYGBgYQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGEhISEhISEhISEhIS\
EhISEhISEhISEhISEhISEhISEhIICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYG\
EhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhIGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBhQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU\
FBQUFBQUCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhIGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBhISEhISEhISEhISEhIS\
EhISEhISEhISEhISEhISEhISBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFAgICAgICAgI\
CAgICAgICAgICAgICAgICAgICAgICAgIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQU\
FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU\
FBQUFAYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYICAgICAgICAgICAgICAgICAgICAgI\
CAgICAgICAgICAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUFBQUFBQUFBQUFBQUFBQU\
FBQUFBQUFBQUFBQUFBQUFAYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQGBgYGBgYGBgYG\
BgYGBgYGBgYGBgYGBgYGBgYGBgYGBhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAA==\
').split(''), c => c.charCodeAt(0));

const cc_ex = Uint8Array.from(window.atob('\
KAQyMiIqLCIiIgQEBAQELAQEBAQEBAQELCwsLCwsLCwmJiYmJiYmJiYmJiYmJiYmBAQEBAQEBAQEBAQEBAQEBCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCws\
LCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCws\
LCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLA==\
').split(''), c => c.charCodeAt(0));

const bc = Uint8Array.from(window.atob('\
AAEBAgECAgMBAgIDAgMDBAECAgMCAwMEAgMDBAMEBAUBAgIDAgMDBAIDAwQDBAQFAgMDBAMEBAUDBAQFBAUFBgECAgMCAwMEAgMDBAMEBAUCAwMEAwQEBQME\
BAUEBQUGAgMDBAMEBAUDBAQFBAUFBgMEBAUEBQUGBAUFBgUGBgcBAgIDAgMDBAIDAwQDBAQFAgMDBAMEBAUDBAQFBAUFBgIDAwQDBAQFAwQEBQQFBQYDBAQF\
BAUFBgQFBQYFBgYHAgMDBAMEBAUDBAQFBAUFBgMEBAUEBQUGBAUFBgUGBgcDBAQFBAUFBgQFBQYFBgYHBAUFBgUGBgcFBgYHBgcHCA==\
').split(''), c => c.charCodeAt(0));

