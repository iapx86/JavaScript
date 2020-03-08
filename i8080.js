/*
 *
 *	i8080 Emulator
 *
 */

import Cpu, {dummypage} from './main.js';

export default class I8080 extends Cpu {
	constructor(arg = null) {
		super(arg);
		this.b = 0;
		this.c = 0;
		this.d = 0;
		this.e = 0;
		this.h = 0;
		this.l = 0;
		this.a = 0;
		this.f = 0; // f:sz-a-p-c
		this.iff = 0;
		this.r = 0;
		this.sp = 0;
		this.iomap = [];
		for (let i = 0; i < 0x100; i++)
			this.iomap.push({base: dummypage, read: null, write: () => {}});
	}

	reset() {
		super.reset();
		this.iff = 0;
		this.sp = 0;
		this.pc = 0;
	}

	interrupt(vector = 0xff) {
		if (!super.interrupt() || this.iff !== 3)
			return false;
		this.iff = 0;
		switch (vector) {
		case 0xc7: // RST 00h
			this.rst(0x00);
			break;
		case 0xcf: // RST 08h
			this.rst(0x08);
			break;
		case 0xd7: // RST 10h
			this.rst(0x10);
			break;
		case 0xdf: // RST 18h
			this.rst(0x18);
			break;
		case 0xe7: // RST 20h
			this.rst(0x20);
			break;
		case 0xef: // RST 28h
			this.rst(0x28);
			break;
		case 0xf7: // RST 30h
			this.rst(0x30);
			break;
		case 0xff: // RST 38h
			this.rst(0x38);
			break;
		}
		return true;
	}

	_execute() {
		let v;

		switch (this.fetch()) {
		case 0x00: // NOP
			return;
		case 0x01: // LXI B,data16
			return void([this.c, this.b] = [this.fetch(), this.fetch()]);
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
			return void([this.f, this.a] = [this.f & ~1 | this.a >> 7, this.a << 1 & 0xff | this.a >> 7]);
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
			return void([this.f, this.a] = [this.f & ~1 | this.a & 1, this.a >> 1 | this.a << 7 & 0x80]);
		case 0x11: // LXI D,data16
			return void([this.e, this.d] = [this.fetch(), this.fetch()]);
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
			return void([this.f, this.a] = [this.f & ~1 | this.a >> 7, this.a << 1 & 0xff | this.f & 1]);
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
			return void([this.f, this.a] = [this.f & ~1 | this.a & 1, this.a >> 1 | this.f << 7 & 0x80]);
		case 0x21: // LXI H,data16
			return void([this.l, this.h] = [this.fetch(), this.fetch()]);
		case 0x22: // SHLD addr
			return this.write16(this.fetch() | this.fetch() << 8, this.l | this.h << 8);
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
			return void([this.l, this.h] = this.split(this.read16(this.fetch() | this.fetch() << 8)));
		case 0x2b: // DCX H
			return void([this.l, this.h] = this.split((this.l | this.h << 8) - 1 & 0xffff));
		case 0x2c: // INR L
			return void(this.l = this.inc8(this.l));
		case 0x2d: // DCR L
			return void(this.l = this.dec8(this.l));
		case 0x2e: // MVI L,data
			return void(this.l = this.fetch());
		case 0x2f: // CMA
			return void(this.a = ~this.a & 0xff);
		case 0x31: // LXI SP,data16
			return void(this.sp = this.fetch() | this.fetch() << 8);
		case 0x32: // STA addr
			return this.write(this.fetch() | this.fetch() << 8, this.a);
		case 0x33: // INX SP
			return void(this.sp = this.sp + 1 & 0xffff);
		case 0x34: // INR M
			return this.write(v = this.l | this.h << 8, this.inc8(this.read(v)));
		case 0x35: // DCR M
			return this.write(v = this.l | this.h << 8, this.dec8(this.read(v)));
		case 0x36: // MVI M,data
			return this.write(this.l | this.h << 8, this.fetch());
		case 0x37: // STC
			return void(this.f |= 1);
		case 0x39: // DAD SP
			return void([this.l, this.h] = this.split(this.add16(this.l | this.h << 8, this.sp)));
		case 0x3a: // LDA addr
			return void(this.a = this.read(this.fetch() | this.fetch() << 8));
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
			return this.ret((this.f & 0x40) === 0);
		case 0xc1: // POP B
			return void([this.c, this.b] = [this.pop(), this.pop()]);
		case 0xc2: // JNZ addr
			return this.jp((this.f & 0x40) === 0);
		case 0xc3: // JMP addr
			return this.jp(true);
		case 0xc4: // CNZ addr
			return this.call((this.f & 0x40) === 0);
		case 0xc5: // PUSH B
			return this.push(this.b, this.c);
		case 0xc6: // ADI data
			return void(this.a = this.add8(this.a, this.fetch()));
		case 0xc7: // RST 00h
			return this.rst(0x00);
		case 0xc8: // RZ
			return this.ret((this.f & 0x40) !== 0);
		case 0xc9: // RET
			return this.ret(true);
		case 0xca: // JZ addr
			return this.jp((this.f & 0x40) !== 0);
		case 0xcc: // CZ addr
			return this.call((this.f & 0x40) !== 0);
		case 0xcd: // CALL addr
			return this.call(true);
		case 0xce: // ACI data
			return this.adc(this.fetch());
		case 0xcf: // RST 08h
			return this.rst(0x08);
		case 0xd0: // RNC
			return this.ret((this.f & 1) === 0);
		case 0xd1: // POP D
			return void([this.e, this.d] = [this.pop(), this.pop()]);
		case 0xd2: // JNC addr
			return this.jp((this.f & 1) === 0);
		case 0xd3: // OUT port
			return this.iowrite(this.a, this.fetch(), this.a);
		case 0xd4: // CNC addr
			return this.call((this.f & 1) === 0);
		case 0xd5: // PUSH D
			return this.push(this.d, this.e);
		case 0xd6: // SUI data
			return void(this.a = this.sub8(this.a, this.fetch()));
		case 0xd7: // RST 10h
			return this.rst(0x10);
		case 0xd8: // RC
			return this.ret((this.f & 1) !== 0);
		case 0xda: // JC addr
			return this.jp((this.f & 1) !== 0);
		case 0xdb: // IN port
			return void(this.a = this.ioread(this.a, this.fetch()));
		case 0xdc: // CC addr
			return this.call((this.f & 1) !== 0);
		case 0xde: // SBI data
			return void(this.a = this.sbc8(this.a, this.fetch()));
		case 0xdf: // RST 18h
			return this.rst(0x18);
		case 0xe0: // RPO
			return this.ret((this.f & 4) === 0);
		case 0xe1: // POP H
			return void([this.l, this.h] = [this.pop(), this.pop()]);
		case 0xe2: // JPO addr
			return this.jp((this.f & 4) === 0);
		case 0xe3: // XTHL
			[v, this.l, this.h] = [this.l | this.h << 8, this.pop(), this.pop()];
			return this.push16(v);
		case 0xe4: // CPO addr
			return this.call((this.f & 4) === 0);
		case 0xe5: // PUSH H
			return this.push(this.h, this.l);
		case 0xe6: // ANI data
			return void(this.a = this.and8(this.a, this.fetch()));
		case 0xe7: // RST 20h
			return this.rst(0x20);
		case 0xe8: // RPE
			return this.ret((this.f & 4) !== 0);
		case 0xe9: // PCHL
			return void(this.pc = this.l | this.h << 8);
		case 0xea: // JPE addr
			return this.jp((this.f & 4) !== 0);
		case 0xeb: // XCHG
			return void([this.e, this.d, this.l, this.h] = [this.l, this.h, this.e, this.d]);
		case 0xec: // CPE addr
			return this.call((this.f & 4) !== 0);
		case 0xee: // XRI data
			return void(this.a = this.xor8(this.a, this.fetch()));
		case 0xef: // RST 28h
			return this.rst(0x28);
		case 0xf0: // RP
			return this.ret((this.f & 0x80) === 0);
		case 0xf1: // POP PSW
			return void([this.f, this.a] = [this.pop(), this.pop()]);
		case 0xf2: // JP addr
			return this.jp((this.f & 0x80) === 0);
		case 0xf3: // DI
			return void(this.iff = 0);
		case 0xf4: // CP addr
			return this.call((this.f & 0x80) === 0);
		case 0xf5: // PUSH PSW
			return this.push(this.a, this.f);
		case 0xf6: // ORI data
			return void(this.a = this.or8(this.a, this.fetch()));
		case 0xf7: // RST 30h
			return this.rst(0x30);
		case 0xf8: // RM
			return this.ret((this.f & 0x80) !== 0);
		case 0xf9: // SPHL
			return void(this.sp = this.l | this.h << 8);
		case 0xfa: // JM addr
			return this.jp((this.f & 0x80) !== 0);
		case 0xfb: // EI
			return void(this.iff = 3);
		case 0xfc: // CM addr
			return this.call((this.f & 0x80) !== 0);
		case 0xfe: // CPI data
			return void(this.sub8(this.a, this.fetch()));
		case 0xff: // RST 38h
			return this.rst(0x38);
		default:
			this.undefsize = 1;
			if (this.undef)
				this.undef(this.arg);
			return;
		}
	}

	ret(cond) {
		if (cond) this.pc = this.pop() | this.pop() << 8;
	}

	jp(cond) {
		const addr = this.fetch() | this.fetch() << 8;
		if (cond) this.pc = addr;
	}

	call(cond) {
		const addr = this.fetch() | this.fetch() << 8;
		if (cond) this.rst(addr);
	}

	rst(addr) {
		this.push16(this.pc);
		this.pc = addr;
	}

	push(...args) {
		args.forEach(e => this.write(this.sp = this.sp - 1 & 0xffff, e));
	}

	push16(r) {
		this.write16(this.sp = this.sp - 2 & 0xffff, r);
	}

	pop() {
		const r = this.read(this.sp);
		this.sp = this.sp + 1 & 0xffff;
		return r;
	}

	add8(dst, src) {
		const r = dst + src & 0xff, c = dst & src | src & ~r | ~r & dst;
		this.f = this.f & ~0xd5 | I8080.fLogic[r] | c << 1 & 0x10 | c >> 7 & 1;
		return r;
	}

	add16(dst, src) {
		const r = dst + src & 0xffff, c = dst & src | src & ~r | ~r & dst;
		this.f = this.f & ~1 | c >> 15 & 1;
		return r;
	}

	adc8(dst, src) {
		const r = dst + src + (this.f & 1) & 0xff, c = dst & src | src & ~r | ~r & dst;
		this.f = this.f & ~0xd5 | I8080.fLogic[r] | c << 1 & 0x10 | c >> 7 & 1;
		return r;
	}

	sub8(dst, src) {
		const r = dst - src & 0xff, c = ~dst & src | src & r | r & ~dst;
		this.f = this.f & ~0xd5 | I8080.fLogic[r] | c << 1 & 0x10 | c >> 7 & 1;
		return r;
	}

	sbc8(dst, src) {
		const r = dst - src - (this.f & 1) & 0xff, c = ~dst & src | src & r | r & ~dst;
		this.f = this.f & ~0xd5 | I8080.fLogic[r] | c << 1 & 0x10 | c >> 7 & 1;
		return r;
	}

	and8(dst, src) {
		const r = dst & src;
		this.f = this.f & ~0xd5 | I8080.fLogic[r] | 0x10;
		return r;
	}

	xor8(dst, src) {
		const r = dst ^ src;
		this.f = this.f & ~0xd5 | I8080.fLogic[r];
		return r;
	}

	or8(dst, src) {
		const r = dst | src;
		this.f = this.f & ~0xd5 | I8080.fLogic[r];
		return r;
	}

	inc8(dst) {
		const r = dst + 1 & 0xff, c = dst & 1 | 1 & ~r | ~r & dst;
		this.f = this.f & ~0xd4 | I8080.fLogic[r] | c << 1 & 0x10;
		return r;
	}

	dec8(dst) {
		const r = dst - 1 & 0xff, c = ~dst & 1 | 1 & r | r & ~dst;
		this.f = this.f & ~0xd4 | I8080.fLogic[r] | c << 1 & 0x10;
		return r;
	}

	daa() {
		let r = this.a;
		if ((this.f & 0x10) !== 0 || (r & 0x0f) > 9) {
			if ((r += 6) >= 0x100)
				this.f |= 1;
			this.f |= 0x10;
		}
		if ((this.f & 1) !== 0  || (r & 0xf0) > 0x90) {
			r += 0x60;
			this.f |= 1;
		}
		this.a = r &= 0xff;
		this.f = this.f & ~0xc4 | I8080.fLogic[r];
	}

	ioread(h, l) {
		const page = this.iomap[h];
		return !page.read ? page.base[l] : page.read(l | h << 8, this.arg);
	}

	iowrite(h, l, data) {
		const page = this.iomap[h];
		if (!page.write)
			page.base[l] = data;
		else
			page.write(l | h << 8, data, this.arg);
	}

	split(v) {
		return [v & 0xff, v >> 8];
	}

	read16(addr) {
		return this.read(addr) | this.read(addr + 1 & 0xffff) << 8;
	}

	write16(addr, data) {
		this.write(addr, data);
		this.write(addr + 1 & 0xffff, data >> 8);
	}
}

void function () {
	I8080.fLogic = new Uint8Array(0x100);
	for (let r = 0; r < 0x100; r++) {
		let p = r ^ r >> 4;
		p ^= p >> 2;
		p ^= p >> 1;
		I8080.fLogic[r] = r & 0x80 | !r << 6 | ~p << 2 & 4;
	}
}();

