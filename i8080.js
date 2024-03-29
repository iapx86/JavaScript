/*
 *
 *	i8080 Emulator
 *
 */

import Cpu, {dummypage} from './cpu.js';
import {seq} from "./utils.js";

export default class I8080 extends Cpu {
	b = 0;
	c = 0;
	d = 0;
	e = 0;
	h = 0;
	l = 0;
	a = 0;
	f = 0; // f:sz-a-p-c
	iff = 0;
	sp = 0;
	iomap = {base: dummypage, read: null, write: () => {}};

	constructor(clock) {
		super(clock);
	}

	reset() {
		super.reset();
		this.iff = 0;
		this.pc = 0;
	}

	interrupt(intvec = 0xff) {
		if (!super.interrupt() || this.iff !== 3)
			return false;
		this.iff = 0;
		this.cycle -= cc[intvec];
		switch (intvec) {
		case 0xc7: // RST 00h
			return this.rst(0x00), true;
		case 0xcf: // RST 08h
			return this.rst(0x08), true;
		case 0xd7: // RST 10h
			return this.rst(0x10), true;
		case 0xdf: // RST 18h
			return this.rst(0x18), true;
		case 0xe7: // RST 20h
			return this.rst(0x20), true;
		case 0xef: // RST 28h
			return this.rst(0x28), true;
		case 0xf7: // RST 30h
			return this.rst(0x30), true;
		case 0xff: // RST 38h
			return this.rst(0x38), true;
		}
		return true;
	}

	_execute() {
		let v, op = this.fetch();
		this.cycle -= cc[op];
		switch (op) {
		case 0x00: // NOP
			return;
		case 0x01: // LXI B,data16
			return void([this.c, this.b] = this.split(this.fetch16()));
		case 0x02: // STAX B
			return this.write(this.c | this.b << 8, this.a);
		case 0x03: // INX B
			return void([this.c, this.b] = this.split((this.c | this.b << 8) + 1 & 0xffff));
		case 0x04: // INR B
			return void(this.b = this.inc8(this.b));
		case 0x05: // DCR B
			return void(this.b = this.dec8(this.b));
		case 0x06: // MVI B,data
			return void(this.b = this.fetch());
		case 0x07: // RLC
			return this.f = this.f & ~1 | this.a >> 7, void(this.a = this.a << 1 & 0xfe | this.a >> 7);
		case 0x09: // DAD B
			return void([this.l, this.h] = this.split(this.add16(this.l | this.h << 8, this.c | this.b << 8)));
		case 0x0a: // LDAX B
			return void(this.a = this.read(this.c | this.b << 8));
		case 0x0b: // DCX B
			return void([this.c, this.b] = this.split((this.c | this.b << 8) - 1 & 0xffff));
		case 0x0c: // INR C
			return void(this.c = this.inc8(this.c));
		case 0x0d: // DCR C
			return void(this.c = this.dec8(this.c));
		case 0x0e: // MVI C,data
			return void(this.c = this.fetch());
		case 0x0f: // RRC
			return this.f = this.f & ~1 | this.a & 1, void(this.a = this.a << 7 & 0x80 | this.a >> 1);
		case 0x11: // LXI D,data16
			return void([this.e, this.d] = this.split(this.fetch16()));
		case 0x12: // STAX D
			return this.write(this.e | this.d << 8, this.a);
		case 0x13: // INX D
			return void([this.e, this.d] = this.split((this.e | this.d << 8) + 1 & 0xffff));
		case 0x14: // INR D
			return void(this.d = this.inc8(this.d));
		case 0x15: // DCR D
			return void(this.d = this.dec8(this.d));
		case 0x16: // MVI D,data
			return void(this.d = this.fetch());
		case 0x17: // RAL
			return v = this.a << 1 | this.f & 1, this.f = this.f & ~1 | v >> 8, void(this.a = v & 0xff);
		case 0x19: // DAD D
			return void([this.l, this.h] = this.split(this.add16(this.l | this.h << 8, this.e | this.d << 8)));
		case 0x1a: // LDAX D
			return void(this.a = this.read(this.e | this.d << 8));
		case 0x1b: // DCX D
			return void([this.e, this.d] = this.split((this.e | this.d << 8) - 1 & 0xffff));
		case 0x1c: // INR E
			return void(this.e = this.inc8(this.e));
		case 0x1d: // DCR E
			return void(this.e = this.dec8(this.e));
		case 0x1e: // MVI E,data
			return void(this.e = this.fetch());
		case 0x1f: // RAR
			return v = this.f << 8 | this.a, this.f = this.f & ~1 | v & 1, void(this.a = v >> 1 & 0xff);
		case 0x21: // LXI H,data16
			return void([this.l, this.h] = this.split(this.fetch16()));
		case 0x22: // SHLD addr
			return this.write16(this.fetch16(), this.l | this.h << 8);
		case 0x23: // INX H
			return void([this.l, this.h] = this.split((this.l | this.h << 8) + 1 & 0xffff));
		case 0x24: // INR H
			return void(this.h = this.inc8(this.h));
		case 0x25: // DCR H
			return void(this.h = this.dec8(this.h));
		case 0x26: // MVI H,data
			return void(this.h = this.fetch());
		case 0x27: // DAA
			return this.daa();
		case 0x29: // DAD H
			return void([this.l, this.h] = this.split(this.add16(this.l | this.h << 8, this.l | this.h << 8)));
		case 0x2a: // LHLD addr
			return void([this.l, this.h] = this.split(this.read16(this.fetch16())));
		case 0x2b: // DCX H
			return void([this.l, this.h] = this.split((this.l | this.h << 8) - 1 & 0xffff));
		case 0x2c: // INR L
			return void(this.l = this.inc8(this.l));
		case 0x2d: // DCR L
			return void(this.l = this.dec8(this.l));
		case 0x2e: // MVI L,data
			return void(this.l = this.fetch());
		case 0x2f: // CMA
			return void(this.a ^= 0xff);
		case 0x31: // LXI SP,data16
			return void(this.sp = this.fetch16());
		case 0x32: // STA addr
			return this.write(this.fetch16(), this.a);
		case 0x33: // INX SP
			return void(this.sp = this.sp + 1 & 0xffff);
		case 0x34: // INR M
			return v = this.l | this.h << 8, this.write(v, this.inc8(this.read(v)));
		case 0x35: // DCR M
			return v = this.l | this.h << 8, this.write(v, this.dec8(this.read(v)));
		case 0x36: // MVI M,data
			return this.write(this.l | this.h << 8, this.fetch());
		case 0x37: // STC
			return void(this.f |= 1);
		case 0x39: // DAD SP
			return void([this.l, this.h] = this.split(this.add16(this.l | this.h << 8, this.sp)));
		case 0x3a: // LDA addr
			return void(this.a = this.read(this.fetch16()));
		case 0x3b: // DCX SP
			return void(this.sp = this.sp - 1 & 0xffff);
		case 0x3c: // INR A
			return void(this.a = this.inc8(this.a));
		case 0x3d: // DCR A
			return void(this.a = this.dec8(this.a));
		case 0x3e: // MVI A,data
			return void(this.a = this.fetch());
		case 0x3f: // CMC
			return void(this.f ^= 1);
		case 0x40: // MOV B,B
			return;
		case 0x41: // MOV B,C
			return void(this.b = this.c);
		case 0x42: // MOV B,D
			return void(this.b = this.d);
		case 0x43: // MOV B,E
			return void(this.b = this.e);
		case 0x44: // MOV B,H
			return void(this.b = this.h);
		case 0x45: // MOV B,L
			return void(this.b = this.l);
		case 0x46: // MOV B,M
			return void(this.b = this.read(this.l | this.h << 8));
		case 0x47: // MOV B,A
			return void(this.b = this.a);
		case 0x48: // MOV C,B
			return void(this.c = this.b);
		case 0x49: // MOV C,C
			return;
		case 0x4a: // MOV C,D
			return void(this.c = this.d);
		case 0x4b: // MOV C,E
			return void(this.c = this.e);
		case 0x4c: // MOV C,H
			return void(this.c = this.h);
		case 0x4d: // MOV C,L
			return void(this.c = this.l);
		case 0x4e: // MOV C,M
			return void(this.c = this.read(this.l | this.h << 8));
		case 0x4f: // MOV C,A
			return void(this.c = this.a);
		case 0x50: // MOV D,B
			return void(this.d = this.b);
		case 0x51: // MOV D,C
			return void(this.d = this.c);
		case 0x52: // MOV D,D
			return;
		case 0x53: // MOV D,E
			return void(this.d = this.e);
		case 0x54: // MOV D,H
			return void(this.d = this.h);
		case 0x55: // MOV D,L
			return void(this.d = this.l);
		case 0x56: // MOV D,(HL)
			return void(this.d = this.read(this.l | this.h << 8));
		case 0x57: // MOV D,A
			return void(this.d = this.a);
		case 0x58: // MOV E,B
			return void(this.e = this.b);
		case 0x59: // MOV E,C
			return void(this.e = this.c);
		case 0x5a: // MOV E,D
			return void(this.e = this.d);
		case 0x5b: // MOV E,E
			return;
		case 0x5c: // MOV E,H
			return void(this.e = this.h);
		case 0x5d: // MOV E,L
			return void(this.e = this.l);
		case 0x5e: // MOV E,M
			return void(this.e = this.read(this.l | this.h << 8));
		case 0x5f: // MOV E,A
			return void(this.e = this.a);
		case 0x60: // MOV H,B
			return void(this.h = this.b);
		case 0x61: // MOV H,C
			return void(this.h = this.c);
		case 0x62: // MOV H,D
			return void(this.h = this.d);
		case 0x63: // MOV H,E
			return void(this.h = this.e);
		case 0x64: // MOV H,H
			return;
		case 0x65: // MOV H,L
			return void(this.h = this.l);
		case 0x66: // MOV H,M
			return void(this.h = this.read(this.l | this.h << 8));
		case 0x67: // MOV H,A
			return void(this.h = this.a);
		case 0x68: // MOV L,B
			return void(this.l = this.b);
		case 0x69: // MOV L,C
			return void(this.l = this.c);
		case 0x6a: // MOV L,D
			return void(this.l = this.d);
		case 0x6b: // MOV L,E
			return void(this.l = this.e);
		case 0x6c: // MOV L,H
			return void(this.l = this.h);
		case 0x6d: // MOV L,L
			return;
		case 0x6e: // MOV L,M
			return void(this.l = this.read(this.l | this.h << 8));
		case 0x6f: // MOV L,A
			return void(this.l = this.a);
		case 0x70: // MOV M,B
			return this.write(this.l | this.h << 8, this.b);
		case 0x71: // MOV M,C
			return this.write(this.l | this.h << 8, this.c);
		case 0x72: // MOV M,D
			return this.write(this.l | this.h << 8, this.d);
		case 0x73: // MOV M,E
			return this.write(this.l | this.h << 8, this.e);
		case 0x74: // MOV M,H
			return this.write(this.l | this.h << 8, this.h);
		case 0x75: // MOV M,L
			return this.write(this.l | this.h << 8, this.l);
		case 0x76: // HLT
			return this.suspend();
		case 0x77: // MOV M,A
			return this.write(this.l | this.h << 8, this.a);
		case 0x78: // MOV A,B
			return void(this.a = this.b);
		case 0x79: // MOV A,C
			return void(this.a = this.c);
		case 0x7a: // MOV A,D
			return void(this.a = this.d);
		case 0x7b: // MOV A,E
			return void(this.a = this.e);
		case 0x7c: // MOV A,H
			return void(this.a = this.h);
		case 0x7d: // MOV A,L
			return void(this.a = this.l);
		case 0x7e: // MOV A,M
			return void(this.a = this.read(this.l | this.h << 8));
		case 0x7f: // MOV A,A
			return;
		case 0x80: // ADD B
			return void(this.a = this.add8(this.a, this.b));
		case 0x81: // ADD C
			return void(this.a = this.add8(this.a, this.c));
		case 0x82: // ADD D
			return void(this.a = this.add8(this.a, this.d));
		case 0x83: // ADD E
			return void(this.a = this.add8(this.a, this.e));
		case 0x84: // ADD H
			return void(this.a = this.add8(this.a, this.h));
		case 0x85: // ADD L
			return void(this.a = this.add8(this.a, this.l));
		case 0x86: // ADD M
			return void(this.a = this.add8(this.a, this.read(this.l | this.h << 8)));
		case 0x87: // ADD A
			return void(this.a = this.add8(this.a, this.a));
		case 0x88: // ADC B
			return void(this.a = this.adc8(this.a, this.b));
		case 0x89: // ADC C
			return void(this.a = this.adc8(this.a, this.c));
		case 0x8a: // ADC D
			return void(this.a = this.adc8(this.a, this.d));
		case 0x8b: // ADC E
			return void(this.a = this.adc8(this.a, this.e));
		case 0x8c: // ADC H
			return void(this.a = this.adc8(this.a, this.h));
		case 0x8d: // ADC L
			return void(this.a = this.adc8(this.a, this.l));
		case 0x8e: // ADC M
			return void(this.a = this.adc8(this.a, this.read(this.l | this.h << 8)));
		case 0x8f: // ADC A
			return void(this.a = this.adc8(this.a, this.a));
		case 0x90: // SUB B
			return void(this.a = this.sub8(this.a, this.b));
		case 0x91: // SUB C
			return void(this.a = this.sub8(this.a, this.c));
		case 0x92: // SUB D
			return void(this.a = this.sub8(this.a, this.d));
		case 0x93: // SUB E
			return void(this.a = this.sub8(this.a, this.e));
		case 0x94: // SUB H
			return void(this.a = this.sub8(this.a, this.h));
		case 0x95: // SUB L
			return void(this.a = this.sub8(this.a, this.l));
		case 0x96: // SUB M
			return void(this.a = this.sub8(this.a, this.read(this.l | this.h << 8)));
		case 0x97: // SUB A
			return void(this.a = this.sub8(this.a, this.a));
		case 0x98: // SBB B
			return void(this.a = this.sbc8(this.a, this.b));
		case 0x99: // SBB C
			return void(this.a = this.sbc8(this.a, this.c));
		case 0x9a: // SBB D
			return void(this.a = this.sbc8(this.a, this.d));
		case 0x9b: // SBB E
			return void(this.a = this.sbc8(this.a, this.e));
		case 0x9c: // SBB H
			return void(this.a = this.sbc8(this.a, this.h));
		case 0x9d: // SBB L
			return void(this.a = this.sbc8(this.a, this.l));
		case 0x9e: // SBB M
			return void(this.a = this.sbc8(this.a, this.read(this.l | this.h << 8)));
		case 0x9f: // SBB A
			return void(this.a = this.sbc8(this.a, this.a));
		case 0xa0: // ANA B
			return void(this.a = this.and8(this.a, this.b));
		case 0xa1: // ANA C
			return void(this.a = this.and8(this.a, this.c));
		case 0xa2: // ANA D
			return void(this.a = this.and8(this.a, this.d));
		case 0xa3: // ANA E
			return void(this.a = this.and8(this.a, this.e));
		case 0xa4: // ANA H
			return void(this.a = this.and8(this.a, this.h));
		case 0xa5: // ANA L
			return void(this.a = this.and8(this.a, this.l));
		case 0xa6: // ANA M
			return void(this.a = this.and8(this.a, this.read(this.l | this.h << 8)));
		case 0xa7: // ANA A
			return void(this.a = this.and8(this.a, this.a));
		case 0xa8: // XRA B
			return void(this.a = this.xor8(this.a, this.b));
		case 0xa9: // XRA C
			return void(this.a = this.xor8(this.a, this.c));
		case 0xaa: // XRA D
			return void(this.a = this.xor8(this.a, this.d));
		case 0xab: // XRA E
			return void(this.a = this.xor8(this.a, this.e));
		case 0xac: // XRA H
			return void(this.a = this.xor8(this.a, this.h));
		case 0xad: // XRA L
			return void(this.a = this.xor8(this.a, this.l));
		case 0xae: // XRA M
			return void(this.a = this.xor8(this.a, this.read(this.l | this.h << 8)));
		case 0xaf: // XRA A
			return void(this.a = this.xor8(this.a, this.a));
		case 0xb0: // ORA B
			return void(this.a = this.or8(this.a, this.b));
		case 0xb1: // ORA C
			return void(this.a = this.or8(this.a, this.c));
		case 0xb2: // ORA D
			return void(this.a = this.or8(this.a, this.d));
		case 0xb3: // ORA E
			return void(this.a = this.or8(this.a, this.e));
		case 0xb4: // ORA H
			return void(this.a = this.or8(this.a, this.h));
		case 0xb5: // ORA L
			return void(this.a = this.or8(this.a, this.l));
		case 0xb6: // ORA M
			return void(this.a = this.or8(this.a, this.read(this.l | this.h << 8)));
		case 0xb7: // ORA A
			return void(this.a = this.or8(this.a, this.a));
		case 0xb8: // CMP B
			return void(this.sub8(this.a, this.b));
		case 0xb9: // CMP C
			return void(this.sub8(this.a, this.c));
		case 0xba: // CMP D
			return void(this.sub8(this.a, this.d));
		case 0xbb: // CMP E
			return void(this.sub8(this.a, this.e));
		case 0xbc: // CMP H
			return void(this.sub8(this.a, this.h));
		case 0xbd: // CMP L
			return void(this.sub8(this.a, this.l));
		case 0xbe: // CMP M
			return void(this.sub8(this.a, this.read(this.l | this.h << 8)));
		case 0xbf: // CMP A
			return void(this.sub8(this.a, this.a));
		case 0xc0: // RNZ
			return !(this.f & 0x40) && (this.cycle -= 6), this.ret(!(this.f & 0x40));
		case 0xc1: // POP B
			return void([this.c, this.b] = this.split(this.pop16()));
		case 0xc2: // JNZ addr
			return this.jp(!(this.f & 0x40));
		case 0xc3: // JMP addr
			return this.jp(true);
		case 0xc4: // CNZ addr
			return !(this.f & 0x40) && (this.cycle -= 6), this.call(!(this.f & 0x40));
		case 0xc5: // PUSH B
			return this.push16(this.c | this.b << 8);
		case 0xc6: // ADI data
			return void(this.a = this.add8(this.a, this.fetch()));
		case 0xc7: // RST 00h
			return this.rst(0x00);
		case 0xc8: // RZ
			return this.f & 0x40 && (this.cycle -= 6), this.ret((this.f & 0x40) !== 0);
		case 0xc9: // RET
			return this.ret(true);
		case 0xca: // JZ addr
			return this.jp((this.f & 0x40) !== 0);
		case 0xcc: // CZ addr
			return this.f & 0x40 && (this.cycle -= 6), this.call((this.f & 0x40) !== 0);
		case 0xcd: // CALL addr
			return this.call(true);
		case 0xce: // ACI data
			return void(this.a = this.adc8(this.a, this.fetch()));
		case 0xcf: // RST 08h
			return this.rst(0x08);
		case 0xd0: // RNC
			return !(this.f & 1) && (this.cycle -= 6), this.ret(!(this.f & 1));
		case 0xd1: // POP D
			return void([this.e, this.d] = this.split(this.pop16()));
		case 0xd2: // JNC addr
			return this.jp(!(this.f & 1));
		case 0xd3: // OUT port
			return this.iowrite(this.fetch(), this.a);
		case 0xd4: // CNC addr
			return !(this.f & 1) && (this.cycle -= 6), this.call(!(this.f & 1));
		case 0xd5: // PUSH D
			return this.push16(this.e | this.d << 8);
		case 0xd6: // SUI data
			return void(this.a = this.sub8(this.a, this.fetch()));
		case 0xd7: // RST 10h
			return this.rst(0x10);
		case 0xd8: // RC
			return this.f & 1 && (this.cycle -= 6), this.ret((this.f & 1) !== 0);
		case 0xda: // JC addr
			return this.jp((this.f & 1) !== 0);
		case 0xdb: // IN port
			return void(this.a = this.ioread(this.fetch()));
		case 0xdc: // CC addr
			return this.f & 1 && (this.cycle -= 6), this.call((this.f & 1) !== 0);
		case 0xde: // SBI data
			return void(this.a = this.sbc8(this.a, this.fetch()));
		case 0xdf: // RST 18h
			return this.rst(0x18);
		case 0xe0: // RPO
			return !(this.f & 4) && (this.cycle -= 6), this.ret(!(this.f & 4));
		case 0xe1: // POP H
			return void([this.l, this.h] = this.split(this.pop16()));
		case 0xe2: // JPO addr
			return this.jp(!(this.f & 4));
		case 0xe3: // XTHL
			return v = this.l | this.h << 8, [this.l, this.h] = this.split(this.pop16()), this.push16(v);
		case 0xe4: // CPO addr
			return !(this.f & 4) && (this.cycle -= 6), this.call(!(this.f & 4));
		case 0xe5: // PUSH H
			return this.push16(this.l | this.h << 8);
		case 0xe6: // ANI data
			return void(this.a = this.and8(this.a, this.fetch()));
		case 0xe7: // RST 20h
			return this.rst(0x20);
		case 0xe8: // RPE
			return this.f & 4 && (this.cycle -= 6), this.ret((this.f & 4) !== 0);
		case 0xe9: // PCHL
			return void(this.pc = this.l | this.h << 8);
		case 0xea: // JPE addr
			return this.jp((this.f & 4) !== 0);
		case 0xeb: // XCHG
			return void([this.e, this.d, this.l, this.h] = [this.l, this.h, this.e, this.d]);
		case 0xec: // CPE addr
			return this.f & 4 && (this.cycle -= 6), this.call((this.f & 4) !== 0);
		case 0xee: // XRI data
			return void(this.a = this.xor8(this.a, this.fetch()));
		case 0xef: // RST 28h
			return this.rst(0x28);
		case 0xf0: // RP
			return !(this.f & 0x80) && (this.cycle -= 6), this.ret(!(this.f & 0x80));
		case 0xf1: // POP PSW
			return void([this.f, this.a] = this.split(this.pop16()));
		case 0xf2: // JP addr
			return this.jp(!(this.f & 0x80));
		case 0xf3: // DI
			return void(this.iff = 0);
		case 0xf4: // CP addr
			return !(this.f & 0x80) && (this.cycle -= 6), this.call(!(this.f & 0x80));
		case 0xf5: // PUSH PSW
			return this.push16(this.f | this.a << 8);
		case 0xf6: // ORI data
			return void(this.a = this.or8(this.a, this.fetch()));
		case 0xf7: // RST 30h
			return this.rst(0x30);
		case 0xf8: // RM
			return this.f & 0x80 && (this.cycle -= 6), this.ret((this.f & 0x80) !== 0);
		case 0xf9: // SPHL
			return void(this.sp = this.l | this.h << 8);
		case 0xfa: // JM addr
			return this.jp((this.f & 0x80) !== 0);
		case 0xfb: // EI
			return void(this.iff = 3);
		case 0xfc: // CM addr
			return this.f & 0x80 && (this.cycle -= 6), this.call((this.f & 0x80) !== 0);
		case 0xfe: // CPI data
			return void(this.sub8(this.a, this.fetch()));
		case 0xff: // RST 38h
			return this.rst(0x38);
		default:
			this.undefsize = 1;
			this.undef();
			return;
		}
	}

	ret(cond) {
		if (cond) this.pc = this.pop16();
	}

	jp(cond) {
		const addr = this.fetch16();
		if (cond) this.pc = addr;
	}

	call(cond) {
		const addr = this.fetch16();
		if (cond) this.rst(addr);
	}

	rst(addr) {
		this.push16(this.pc), this.pc = addr;
	}

	push16(r) {
		this.sp = this.sp - 1 & 0xffff, this.write(this.sp, r >> 8), this.sp = this.sp - 1 & 0xffff, this.write(this.sp, r & 0xff);
	}

	pop16() {
		const r = this.read16(this.sp);
		return this.sp = this.sp + 2 & 0xffff, r;
	}

	add8(dst, src) {
		const r = dst + src & 0xff, c = dst & src | src & ~r | ~r & dst;
		return this.f = this.f & ~0xd5 | fLogic[r] | c << 1 & 0x10 | c >> 7 & 1, r;
	}

	add16(dst, src) {
		const r = dst + src & 0xffff, c = dst & src | src & ~r | ~r & dst;
		return this.f = this.f & ~1 | c >> 15 & 1, r;
	}

	adc8(dst, src) {
		const r = dst + src + (this.f & 1) & 0xff, c = dst & src | src & ~r | ~r & dst;
		return this.f = this.f & ~0xd5 | fLogic[r] | c << 1 & 0x10 | c >> 7 & 1, r;
	}

	sub8(dst, src) {
		const r = dst - src & 0xff, c = ~dst & src | src & r | r & ~dst;
		return this.f = this.f & ~0xd5 | fLogic[r] | c << 1 & 0x10 | c >> 7 & 1, r;
	}

	sbc8(dst, src) {
		const r = dst - src - (this.f & 1) & 0xff, c = ~dst & src | src & r | r & ~dst;
		return this.f = this.f & ~0xd5 | fLogic[r] | c << 1 & 0x10 | c >> 7 & 1, r;
	}

	and8(dst, src) {
		const r = dst & src;
		return this.f = this.f & ~0xd5 | fLogic[r] | 0x10, r;
	}

	xor8(dst, src) {
		const r = dst ^ src;
		return this.f = this.f & ~0xd5 | fLogic[r], r;
	}

	or8(dst, src) {
		const r = dst | src;
		return this.f = this.f & ~0xd5 | fLogic[r], r;
	}

	inc8(dst) {
		const r = dst + 1 & 0xff, c = dst & 1 | 1 & ~r | ~r & dst;
		return this.f = this.f & ~0xd4 | fLogic[r] | c << 1 & 0x10, r;
	}

	dec8(dst) {
		const r = dst - 1 & 0xff, c = ~dst & 1 | 1 & r | r & ~dst;
		return this.f = this.f & ~0xd4 | fLogic[r] | c << 1 & 0x10, r;
	}

	daa() {
		let r = this.a;
		if (this.f & 0x10 || (r & 0x0f) > 9) {
			if ((r += 6) >= 0x100)
				this.f |= 1;
			this.f |= 0x10;
		}
		if (this.f & 1 || (r & 0xf0) > 0x90)
			r += 0x60, this.f |= 1;
		this.a = r &= 0xff, this.f = this.f & ~0xc4 | fLogic[r];
	}

	ioread(addr) {
		return !this.iomap.read ? this.iomap.base[addr] : this.iomap.read(addr);
	}

	iowrite(addr, data) {
		!this.iomap.write ? void(this.iomap.base[addr] = data) : this.iomap.write(addr, data);
	}

	split(v) {
		return [v & 0xff, v >> 8];
	}

	fetch16() {
		const data = this.fetch();
		return data | this.fetch() << 8;
	}

	read16(addr) {
		const data = this.read(addr);
		return data | this.read(addr + 1 & 0xffff) << 8;
	}

	write16(addr, data) {
		this.write(addr, data & 0xff), this.write(addr + 1 & 0xffff, data >> 8);
	}
}

const fLogic = Uint8Array.from(seq(0x100), e => {
	let p = e ^ e >> 4;
	return p ^= p >> 2, p ^= p >> 1, e & 0x80 | !e << 6 | ~p << 2 & 4;
});

const cc = Uint8Array.of(
	 4,10, 7, 5, 5, 5, 7, 4, 0,10, 7, 5, 5, 5, 7, 4,
	 0,10, 7, 5, 5, 5, 7, 4, 0,10, 7, 5, 5, 5, 7, 4,
	 0,10,16, 5, 5, 5, 7, 4, 0,10,16, 5, 5, 5, 7, 4,
	 0,10,13, 5,10,10,10, 4, 0,10,13, 5, 5, 5, 7, 4,
	 5, 5, 5, 5, 5, 5, 7, 5, 5, 5, 5, 5, 5, 5, 7, 5,
	 5, 5, 5, 5, 5, 5, 7, 5, 5, 5, 5, 5, 5, 5, 7, 5,
	 5, 5, 5, 5, 5, 5, 7, 5, 5, 5, 5, 5, 5, 5, 7, 5,
	 7, 7, 7, 7, 7, 7, 7, 7, 5, 5, 5, 5, 5, 5, 7, 5,
	 4, 4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 4, 4, 7, 4,
	 4, 4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 4, 4, 7, 4,
	 4, 4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 4, 4, 7, 4,
	 4, 4, 4, 4, 4, 4, 7, 4, 4, 4, 4, 4, 4, 4, 7, 4,
	 5,10,10,10,11,11, 7,11, 5,10,10, 0,11,17, 7,11,
	 5,10,10,10,11,11, 7,11, 5, 0,10,10,11, 0, 7,11,
	 5,10,10,18,11,11, 7,11, 5, 5,10, 4,11, 0, 7,11,
	 5,10,10, 4,11,11, 7,11, 5, 5,10, 4,11, 0, 7,11);

