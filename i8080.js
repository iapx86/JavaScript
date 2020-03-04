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
		this.f = 0; // f:sz-h-p-c
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
			return this.incbc();
		case 0x04: // INR B
			return void(this.b = this.inc(this.b));
		case 0x05: // DCR B
			return void(this.b = this.dec(this.b));
		case 0x06: // MVI B,data
			return void(this.b = this.fetch());
		case 0x07: // RLC
			return this.rlca();
		case 0x09: // DAD B
			this.l = (v = I8080.aAdd[0][this.c][this.l]) & 0xff;
			this.h = (v = I8080.aAdd[v >>> 8 & 1][this.b][this.h]) & 0xff;
			this.f = this.f & 0xc4 | v >>> 8 & 1;
			return;
		case 0x0a: // LDAX B
			return void(this.a = this.read(this.c | this.b << 8));
		case 0x0b: // DCX B
			return this.decbc();
		case 0x0c: // INR C
			return void(this.c = this.inc(this.c));
		case 0x0d: // DCR C
			return void(this.c = this.dec(this.c));
		case 0x0e: // MVI C,data
			return void(this.c = this.fetch());
		case 0x0f: // RRC
			return this.rrca();
		case 0x11: // LXI D,data16
			return void([this.e, this.d] = [this.fetch(), this.fetch()]);
		case 0x12: // STAX D
			return this.write(this.e | this.d << 8, this.a);
		case 0x13: // INX D
			return this.incde();
		case 0x14: // INR D
			return void(this.d = this.inc(this.d));
		case 0x15: // DCR D
			return void(this.d = this.dec(this.d));
		case 0x16: // MVI D,data
			return void(this.d = this.fetch());
		case 0x17: // RAL
			return this.rla();
		case 0x19: // DAD D
			this.l = (v = I8080.aAdd[0][this.e][this.l]) & 0xff;
			this.h = (v = I8080.aAdd[v >>> 8 & 1][this.d][this.h]) & 0xff;
			this.f = this.f & 0xc4 | v >>> 8 & 1;
			return;
		case 0x1a: // LDAX D
			return void(this.a = this.read(this.e | this.d << 8));
		case 0x1b: // DCX D
			return this.decde();
		case 0x1c: // INR E
			return void(this.e = this.inc(this.e));
		case 0x1d: // DCR E
			return void(this.e = this.dec(this.e));
		case 0x1e: // MVI E,data
			return void(this.e = this.fetch());
		case 0x1f: // RAR
			return this.rra();
		case 0x21: // LXI H,data16
			return void([this.l, this.h] = [this.fetch(), this.fetch()]);
		case 0x22: // SHLD addr
			this.write(v = this.fetch() | this.fetch() << 8, this.l);
			this.write1(v, this.h);
			return;
		case 0x23: // INX H
			return this.inchl();
		case 0x24: // INR H
			return void(this.h = this.inc(this.h));
		case 0x25: // DCR H
			return void(this.h = this.dec(this.h));
		case 0x26: // MVI H,data
			return void(this.h = this.fetch());
		case 0x27: // DAA
			this.a = (v = I8080.aDaa[this.f >>> 3 & 2 | this.f & 1][this.a]) & 0xff;
			this.f = v >>> 8;
			return;
		case 0x29: // DAD H
			this.l = (v = I8080.aAdd[0][this.l][this.l]) & 0xff;
			this.h = (v = I8080.aAdd[v >>> 8 & 1][this.h][this.h]) & 0xff;
			this.f = this.f & 0xc4 | v >>> 8 & 1;
			return;
		case 0x2a: // LHLD addr
			this.l = this.read(v = this.fetch() | this.fetch() << 8);
			this.h = this.read1(v);
			return;
		case 0x2b: // DCX H
			return this.dechl();
		case 0x2c: // INR L
			return void(this.l = this.inc(this.l));
		case 0x2d: // DCR L
			return void(this.l = this.dec(this.l));
		case 0x2e: // MVI L,data
			return void(this.l = this.fetch());
		case 0x2f: // CMA
			this.a ^= 0xff;
			this.f |= 0x12;
			return;
		case 0x31: // LXI SP,data16
			return void(this.sp = this.fetch() | this.fetch() << 8);
		case 0x32: // STA addr
			return this.write(this.fetch() | this.fetch() << 8, this.a);
		case 0x33: // INX SP
			return void(this.sp = this.sp + 1 & 0xffff);
		case 0x34: // INR M
			return this.write(v = this.l | this.h << 8, this.inc(this.read(v)));
		case 0x35: // DCR M
			return this.write(v = this.l | this.h << 8, this.dec(this.read(v)));
		case 0x36: // MVI M,data
			return this.write(this.l | this.h << 8, this.fetch());
		case 0x37: // STC
			return void(this.f = this.f & 0xc4 | 1);
		case 0x39: // DAD SP
			this.l = (v = I8080.aAdd[0][this.sp & 0xff][this.l]) & 0xff;
			this.h = (v = I8080.aAdd[v >>> 8 & 1][this.sp >>> 8][this.h]) & 0xff;
			this.f = this.f & 0xc4 | v >>> 8 & 1;
			return;
		case 0x3a: // LDA addr
			return void(this.a = this.read(this.fetch() | this.fetch() << 8));
		case 0x3b: // DCX SP
			return void(this.sp = this.sp - 1 & 0xffff);
		case 0x3c: // INR A
			return void(this.a = this.inc(this.a));
		case 0x3d: // DCR A
			return void(this.a = this.dec(this.a));
		case 0x3e: // MVI A,data
			return void(this.a = this.fetch());
		case 0x3f: // CMC
			return void(this.f = this.f & 0xc5 ^ 1);
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
			return this.add(this.b);
		case 0x81: // ADD C
			return this.add(this.c);
		case 0x82: // ADD D
			return this.add(this.d);
		case 0x83: // ADD E
			return this.add(this.e);
		case 0x84: // ADD H
			return this.add(this.h);
		case 0x85: // ADD L
			return this.add(this.l);
		case 0x86: // ADD M
			return this.add(this.read(this.l | this.h << 8));
		case 0x87: // ADD A
			return this.add(this.a);
		case 0x88: // ADC B
			return this.adc(this.b);
		case 0x89: // ADC C
			return this.adc(this.c);
		case 0x8a: // ADC D
			return this.adc(this.d);
		case 0x8b: // ADC E
			return this.adc(this.e);
		case 0x8c: // ADC H
			return this.adc(this.h);
		case 0x8d: // ADC L
			return this.adc(this.l);
		case 0x8e: // ADC M
			return this.adc(this.read(this.l | this.h << 8));
		case 0x8f: // ADC A
			return this.adc(this.a);
		case 0x90: // SUB B
			return this.sub(this.b);
		case 0x91: // SUB C
			return this.sub(this.c);
		case 0x92: // SUB D
			return this.sub(this.d);
		case 0x93: // SUB E
			return this.sub(this.e);
		case 0x94: // SUB H
			return this.sub(this.h);
		case 0x95: // SUB L
			return this.sub(this.l);
		case 0x96: // SUB M
			return this.sub(this.read(this.l | this.h << 8));
		case 0x97: // SUB A
			return this.sub(this.a);
		case 0x98: // SBB B
			return this.sbc(this.b);
		case 0x99: // SBB C
			return this.sbc(this.c);
		case 0x9a: // SBB D
			return this.sbc(this.d);
		case 0x9b: // SBB E
			return this.sbc(this.e);
		case 0x9c: // SBB H
			return this.sbc(this.h);
		case 0x9d: // SBB L
			return this.sbc(this.l);
		case 0x9e: // SBB M
			return this.sbc(this.read(this.l | this.h << 8));
		case 0x9f: // SBB A
			return this.sbc(this.a);
		case 0xa0: // ANA B
			return this.and(this.b);
		case 0xa1: // ANA C
			return this.and(this.c);
		case 0xa2: // ANA D
			return this.and(this.d);
		case 0xa3: // ANA E
			return this.and(this.e);
		case 0xa4: // ANA H
			return this.and(this.h);
		case 0xa5: // ANA L
			return this.and(this.l);
		case 0xa6: // ANA M
			return this.and(this.read(this.l | this.h << 8));
		case 0xa7: // ANA A
			return this.and(this.a);
		case 0xa8: // XRA B
			return this.xor(this.b);
		case 0xa9: // XRA C
			return this.xor(this.c);
		case 0xaa: // XRA D
			return this.xor(this.d);
		case 0xab: // XRA E
			return this.xor(this.e);
		case 0xac: // XRA H
			return this.xor(this.h);
		case 0xad: // XRA L
			return this.xor(this.l);
		case 0xae: // XRA M
			return this.xor(this.read(this.l | this.h << 8));
		case 0xaf: // XRA A
			return this.xor(this.a);
		case 0xb0: // ORA B
			return this.or(this.b);
		case 0xb1: // ORA C
			return this.or(this.c);
		case 0xb2: // ORA D
			return this.or(this.d);
		case 0xb3: // ORA E
			return this.or(this.e);
		case 0xb4: // ORA H
			return this.or(this.h);
		case 0xb5: // ORA L
			return this.or(this.l);
		case 0xb6: // ORA M
			return this.or(this.read(this.l | this.h << 8));
		case 0xb7: // ORA A
			return this.or(this.a);
		case 0xb8: // CMP B
			return this.cp(this.b);
		case 0xb9: // CMP C
			return this.cp(this.c);
		case 0xba: // CMP D
			return this.cp(this.d);
		case 0xbb: // CMP E
			return this.cp(this.e);
		case 0xbc: // CMP H
			return this.cp(this.h);
		case 0xbd: // CMP L
			return this.cp(this.l);
		case 0xbe: // CMP M
			return this.cp(this.read(this.l | this.h << 8));
		case 0xbf: // CMP A
			return this.cp(this.a);
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
			this.push(this.b);
			this.push(this.c);
			return;
		case 0xc6: // ADI data
			return this.add(this.fetch());
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
			this.push(this.d);
			this.push(this.e);
			return;
		case 0xd6: // SUI data
			return this.sub(this.fetch());
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
			return this.sbc(this.fetch());
		case 0xdf: // RST 18h
			return this.rst(0x18);
		case 0xe0: // RPO
			return this.ret((this.f & 4) === 0);
		case 0xe1: // POP H
			return void([this.l, this.h] = [this.pop(), this.pop()]);
		case 0xe2: // JPO addr
			return this.jp((this.f & 4) === 0);
		case 0xe3: // XTHL
			v = this.read(this.sp);
			this.write(this.sp, this.l);
			this.l = v;
			v = this.read1(this.sp);
			this.write1(this.sp, this.h);
			this.h = v;
			return;
		case 0xe4: // CPO addr
			return this.call((this.f & 4) === 0);
		case 0xe5: // PUSH H
			this.push(this.h);
			this.push(this.l);
			return;
		case 0xe6: // ANI data
			return this.and(this.fetch());
		case 0xe7: // RST 20h
			return this.rst(0x20);
		case 0xe8: // RPE
			return this.ret((this.f & 4) !== 0);
		case 0xe9: // PCHL
			return void(this.pc = this.l | this.h << 8);
		case 0xea: // JPE addr
			return this.jp((this.f & 4) !== 0);
		case 0xeb: // XCHG
			return void([this.l, this.h, this.e, this.d] = [this.e, this.d, this.l, this.h]);
		case 0xec: // CPE addr
			return this.call((this.f & 4) !== 0);
		case 0xee: // XRI data
			return this.xor(this.fetch());
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
			this.push(this.a);
			this.push(this.f);
			return;
		case 0xf6: // ORI data
			return this.or(this.fetch());
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
			return this.cp(this.fetch());
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
		this.push(this.pc >>> 8);
		this.push(this.pc & 0xff);
		this.pc = addr;
	}

	push(r) {
		this.sp = this.sp - 1 & 0xffff;
		this.write(this.sp, r);
	}

	pop() {
		const r = this.read(this.sp);
		this.sp = this.sp + 1 & 0xffff;
		return r;
	}

	add(r) {
		const v = I8080.aAdd[0][r][this.a];
		this.f = v >>> 8;
		this.a = v & 0xff;
	}

	adc(r) {
		const v = I8080.aAdd[this.f & 1][r][this.a];
		this.f = v >>> 8;
		this.a = v & 0xff;
	}

	sub(r) {
		const v = I8080.aSub[0][r][this.a];
		this.f = v >>> 8;
		this.a = v & 0xff;
	}

	sbc(r) {
		const v = I8080.aSub[this.f & 1][r][this.a];
		this.f = v >>> 8;
		this.a = v & 0xff;
	}

	and(r) {
		this.f = I8080.fLogic[this.a &= r] | 0x10;
	}

	xor(r) {
		this.f = I8080.fLogic[this.a ^= r];
	}

	or(r) {
		this.f = I8080.fLogic[this.a |= r];
	}

	cp(r) {
		this.f = I8080.aSub[0][r][this.a] >>> 8;
	}

	inc(r) {
		const v = I8080.aAdd[0][1][r];
		this.f = this.f & 1 | v >>> 8 & 0xd6;
		return v & 0xff;
	}

	dec(r) {
		const v = I8080.aSub[0][1][r];
		this.f = this.f & 1 | v >>> 8 & 0xd6;
		return v & 0xff;
	}

	rlca() {
		const v = I8080.aRl[this.a >>> 7][this.a];
		this.f = this.f & 0xc4 | v >>> 8 & 1;
		this.a = v & 0xff;
	}

	rrca() {
		const v = I8080.aRr[this.a & 1][this.a];
		this.f = this.f & 0xc4 | v >>> 8 & 1;
		this.a = v & 0xff;
	}

	rla() {
		const v = I8080.aRl[this.f & 1][this.a];
		this.f = this.f & 0xc4 | v >>> 8 & 1;
		this.a = v & 0xff;
	}

	rra() {
		const v = I8080.aRr[this.f & 1][this.a];
		this.f = this.f & 0xc4 | v >>> 8 & 1;
		this.a = v & 0xff;
	}

	incbc() {
		const v = (this.c | this.b << 8) + 1 & 0xffff;
		this.c = v & 0xff;
		this.b = v >>> 8;
	}

	decbc() {
		const v = (this.c | this.b << 8) - 1 & 0xffff;
		this.c = v & 0xff;
		this.b = v >>> 8;
		return v;
	}

	incde() {
		const v = (this.e | this.d << 8) + 1 & 0xffff;
		this.e = v & 0xff;
		this.d = v >>> 8;
	}

	decde() {
		const v = (this.e | this.d << 8) - 1 & 0xffff;
		this.e = v & 0xff;
		this.d = v >>> 8;
	}

	inchl() {
		const v = (this.l | this.h << 8) + 1 & 0xffff;
		this.l = v & 0xff;
		this.h = v >>> 8;
	}

	dechl() {
		const v = (this.l | this.h << 8) - 1 & 0xffff;
		this.l = v & 0xff;
		this.h = v >>> 8;
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
}

void function () {
	let f, i, j, k, r;

	I8080.aAdd = []; // [2][0x100][0x100];
	I8080.aSub = []; // [2][0x100][0x100];
	I8080.aDaa = []; // [4][0x100];
	I8080.aRl = []; // [2][0x100];
	I8080.aRr = []; // [2][0x100];
	I8080.fLogic = new Uint8Array(0x100);

	for (i = 0; i < 2; i++) {
		I8080.aAdd[i] = [];
		for (j = 0; j < 0x100; j++)
			I8080.aAdd[i][j] = new Uint16Array(0x100);
	}
	for (i = 0; i < 2; i++) {
		I8080.aSub[i] = [];
		for (j = 0; j < 0x100; j++)
			I8080.aSub[i][j] = new Uint16Array(0x100);
	}
	for (i = 0; i < 8; i++)
		I8080.aDaa[i] = new Uint16Array(0x100);
	for (i = 0; i < 2; i++)
		I8080.aRl[i] = new Uint16Array(0x100);
	for (i = 0; i < 2; i++)
		I8080.aRr[i] = new Uint16Array(0x100);

	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++)
			for (k = 0; k < 0x100; k++) {
				r = j + k + i & 0xff;
				const c = j & k | k & ~r | ~r & j;
				f = r ^ r >>> 4;
				f ^= f >>> 2;
				f ^= f >>> 1;
				f = r & 0x80 | !r << 6 | c << 1 & 0x10 | ~f << 2 & 4 | c >>> 7 & 1;
				I8080.aAdd[i][k][j] = r | f << 8;
			}
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++)
			for (k = 0; k < 0x100; k++) {
				r = j - k - i & 0xff;
				const c = ~j & k | k & r | r & ~j;
				f = r ^ r >>> 4;
				f ^= f >>> 2;
				f ^= f >>> 1;
				f = r & 0x80 | !r << 6 | c << 1 & 0x10 | ~f << 2 & 4 | c >>> 7 & 1;
				I8080.aSub[i][k][j] = r & 0xff | f << 8;
			}
	for (i = 0; i < 0x100; i++) {
		f = i ^ i >>> 4;
		f ^= f >>> 2;
		f ^= f >>> 1;
		I8080.fLogic[i] = i & 0x80 | !i << 6 | ~f << 2 & 4;
	}
	for (i = 0; i < 4; i++)
		for (j = 0; j < 0x100; j++) {
			f = i << 3 & 0x10 | i & 1;
			r = j;
			if ((f & 0x10) !== 0 && (r & 0x0f) < 4 || (r & 0x0f) > 9) {
				if ((r += 6) >= 0x100) {
					r &= 0xff;
					f |= 0x01;
				}
				f |= 0x10;
			}
			if ((f & 1) !== 0 && (r & 0xf0) < 0x40 || (r & 0xf0) > 0x90) {
				r = r + 0x60 & 0xff;
				f |= 1;
			}
			I8080.aDaa[i][j] = r | f << 8 | I8080.fLogic[r] << 8;
		}
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++) {
			r = j << 1 | i;
			I8080.aRl[i][j] = r | I8080.fLogic[r & 0xff] << 8;
		}
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++) {
			r = j >>> 1 | i << 7;
			I8080.aRr[i][j] = r | (I8080.fLogic[r] | j & 1) << 8;
		}
}();

