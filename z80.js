/*
 *
 *	Z80 Emulator
 *
 */

class Z80 extends Cpu {
	constructor(arg = null) {
		super(arg);
		this.b = 0;
		this.c = 0;
		this.d = 0;
		this.e = 0;
		this.h = 0;
		this.l = 0;
		this.a = 0;
		this.f = 0; // f:sz_h_pnc
		this.ixh = 0;
		this.ixl = 0;
		this.iyh = 0;
		this.iyl = 0;
		this.iff = 0;
		this.im = 0;
		this.i = 0;
		this.r = 0;
		this.b_prime = 0;
		this.c_prime = 0;
		this.d_prime = 0;
		this.e_prime = 0;
		this.h_prime = 0;
		this.l_prime = 0;
		this.a_prime = 0;
		this.f_prime = 0;
		this.sp = 0;
		this.iomap = [];
		for (let i = 0; i < 0x100; i++)
			this.iomap.push({base: dummypage, read: null, write: () => {}});
	}

	reset() {
		super.reset();
		this.iff = 0;
		this.im = 0;
		this.sp = 0;
		this.pc = 0;
	}

	interrupt(vector = 0xff) {
		let v;

		if (!super.interrupt() || this.iff !== 3)
			return false;
		this.iff = 0;
		switch (this.im) {
		case 0:
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
			break;
		case 1:
			this.rst(0x38);
			break;
		case 2:
			this.rst(this.read(v = vector & 0xff | this.i << 8) | this.read1(v) << 8);
			break;
		}
		return true;
	}

	non_maskable_interrupt() {
		if (!super.interrupt())
			return false;
		this.iff &= 2;
		this.rst(0x66);
		return true;
	}

	_execute() {
		let v;

		this.r = this.r + 1 & 0x7f;
		switch (this.fetch()) {
		case 0x00: // NOP
			break;
		case 0x01: // LD BC,nn
			this.c = this.fetch();
			this.b = this.fetch();
			break;
		case 0x02: // LD (BC),A
			this.write(this.c | this.b << 8, this.a);
			break;
		case 0x03: // INC BC
			this.incbc();
			break;
		case 0x04: // INC B
			this.b = this.inc(this.b);
			break;
		case 0x05: // DEC B
			this.b = this.dec(this.b);
			break;
		case 0x06: // LD B,n
			this.b = this.fetch();
			break;
		case 0x07: // RLCA
			this.rlca();
			break;
		case 0x08: // EX AF,AF'
			v = this.a;
			this.a = this.a_prime;
			this.a_prime = v;
			v = this.f;
			this.f = this.f_prime;
			this.f_prime = v;
			break;
		case 0x09: // ADD HL,BC
			this.l = (v = Z80.aAdd[0][this.c][this.l]) & 0xff;
			this.h = (v = Z80.aAdd[v >>> 8 & 1][this.b][this.h]) & 0xff;
			this.f = this.f & 0xc4 | v >>> 8 & 1;
			break;
		case 0x0a: // LD A,(BC)
			this.a = this.read(this.c | this.b << 8);
			break;
		case 0x0b: // DEC BC
			this.decbc();
			break;
		case 0x0c: // INC C
			this.c = this.inc(this.c);
			break;
		case 0x0d: // DEC C
			this.c = this.dec(this.c);
			break;
		case 0x0e: // LD C,n
			this.c = this.fetch();
			break;
		case 0x0f: // RRCA
			this.rrca();
			break;
		case 0x10: // DJNZ e
			this.jr((this.b = this.b - 1 & 0xff) !== 0);
			break;
		case 0x11: // LD DE,nn
			this.e = this.fetch();
			this.d = this.fetch();
			break;
		case 0x12: // LD (DE),A
			this.write(this.e | this.d << 8, this.a);
			break;
		case 0x13: // INC DE
			this.incde();
			break;
		case 0x14: // INC D
			this.d = this.inc(this.d);
			break;
		case 0x15: // DEC D
			this.d = this.dec(this.d);
			break;
		case 0x16: // LD D,n
			this.d = this.fetch();
			break;
		case 0x17: // RLA
			this.rla();
			break;
		case 0x18: // JR e
			this.jr(true);
			break;
		case 0x19: // ADD HL,DE
			this.l = (v = Z80.aAdd[0][this.e][this.l]) & 0xff;
			this.h = (v = Z80.aAdd[v >>> 8 & 1][this.d][this.h]) & 0xff;
			this.f = this.f & 0xc4 | v >>> 8 & 1;
			break;
		case 0x1a: // LD A,(DE)
			this.a = this.read(this.e | this.d << 8);
			break;
		case 0x1b: // DEC DE
			this.decde();
			break;
		case 0x1c: // INC E
			this.e = this.inc(this.e);
			break;
		case 0x1d: // DEC E
			this.e = this.dec(this.e);
			break;
		case 0x1e: // LD E,n
			this.e = this.fetch();
			break;
		case 0x1f: // RRA
			this.rra();
			break;
		case 0x20: // JR NZ,e
			this.jr((this.f & 0x40) === 0);
			break;
		case 0x21: // LD HL,nn
			this.l = this.fetch();
			this.h = this.fetch();
			break;
		case 0x22: // LD (nn),HL
			this.write(v = this.fetch() | this.fetch() << 8, this.l);
			this.write1(v, this.h);
			break;
		case 0x23: // INC HL
			this.inchl();
			break;
		case 0x24: // INC H
			this.h = this.inc(this.h);
			break;
		case 0x25: // DEC H
			this.h = this.dec(this.h);
			break;
		case 0x26: // LD H,n
			this.h = this.fetch();
			break;
		case 0x27: // DAA
			this.a = (v = Z80.aDaa[this.f >>> 2 & 4 | this.f & 3][this.a]) & 0xff;
			this.f = v >>> 8;
			break;
		case 0x28: // JR Z,e
			this.jr((this.f & 0x40) !== 0);
			break;
		case 0x29: // ADD HL,HL
			this.l = (v = Z80.aAdd[0][this.l][this.l]) & 0xff;
			this.h = (v = Z80.aAdd[v >>> 8 & 1][this.h][this.h]) & 0xff;
			this.f = this.f & 0xc4 | v >>> 8 & 1;
			break;
		case 0x2a: // LD HL,(nn)
			this.l = this.read(v = this.fetch() | this.fetch() << 8);
			this.h = this.read1(v);
			break;
		case 0x2b: // DEC HL
			this.dechl();
			break;
		case 0x2c: // INC L
			this.l = this.inc(this.l);
			break;
		case 0x2d: // DEC L
			this.l = this.dec(this.l);
			break;
		case 0x2e: // LD L,n
			this.l = this.fetch();
			break;
		case 0x2f: // CPL
			this.a ^= 0xff;
			this.f |= 0x12;
			break;
		case 0x30: // JR NC,e
			this.jr((this.f & 1) === 0);
			break;
		case 0x31: // LD SP,nn
			this.sp = this.fetch() | this.fetch() << 8;
			break;
		case 0x32: // LD (nn),A
			this.write(this.fetch() | this.fetch() << 8, this.a);
			break;
		case 0x33: // INC SP
			this.sp = this.sp + 1 & 0xffff;
			break;
		case 0x34: // INC (HL)
			this.write(v = this.l | this.h << 8, this.inc(this.read(v)));
			break;
		case 0x35: // DEC (HL)
			this.write(v = this.l | this.h << 8, this.dec(this.read(v)));
			break;
		case 0x36: // LD (HL),n
			this.write(this.l | this.h << 8, this.fetch());
			break;
		case 0x37: // SCF
			this.f = this.f & 0xc4 | 1;
			break;
		case 0x38: // JR C,e
			this.jr((this.f & 1) !== 0);
			break;
		case 0x39: // ADD HL,SP
			this.l = (v = Z80.aAdd[0][this.sp & 0xff][this.l]) & 0xff;
			this.h = (v = Z80.aAdd[v >>> 8 & 1][this.sp >>> 8][this.h]) & 0xff;
			this.f = this.f & 0xc4 | v >>> 8 & 1;
			break;
		case 0x3a: // LD A,(nn)
			this.a = this.read(this.fetch() | this.fetch() << 8);
			break;
		case 0x3b: // DEC SP
			this.sp = this.sp - 1 & 0xffff;
			break;
		case 0x3c: // INC A
			this.a = this.inc(this.a);
			break;
		case 0x3d: // DEC A
			this.a = this.dec(this.a);
			break;
		case 0x3e: // LD A,n
			this.a = this.fetch();
			break;
		case 0x3f: // CCF
			this.f = this.f & 0xc5 ^ 1;
			break;
		case 0x40: // LD B,B
			break;
		case 0x41: // LD B,C
			this.b = this.c;
			break;
		case 0x42: // LD B,D
			this.b = this.d;
			break;
		case 0x43: // LD B,E
			this.b = this.e;
			break;
		case 0x44: // LD B,H
			this.b = this.h;
			break;
		case 0x45: // LD B,L
			this.b = this.l;
			break;
		case 0x46: // LD B,(HL)
			this.b = this.read(this.l | this.h << 8);
			break;
		case 0x47: // LD B,A
			this.b = this.a;
			break;
		case 0x48: // LD C,B
			this.c = this.b;
			break;
		case 0x49: // LD C,C
			break;
		case 0x4a: // LD C,D
			this.c = this.d;
			break;
		case 0x4b: // LD C,E
			this.c = this.e;
			break;
		case 0x4c: // LD C,H
			this.c = this.h;
			break;
		case 0x4d: // LD C,L
			this.c = this.l;
			break;
		case 0x4e: // LD C,(HL)
			this.c = this.read(this.l | this.h << 8);
			break;
		case 0x4f: // LD C,A
			this.c = this.a;
			break;
		case 0x50: // LD D,B
			this.d = this.b;
			break;
		case 0x51: // LD D,C
			this.d = this.c;
			break;
		case 0x52: // LD D,D
			break;
		case 0x53: // LD D,E
			this.d = this.e;
			break;
		case 0x54: // LD D,H
			this.d = this.h;
			break;
		case 0x55: // LD D,L
			this.d = this.l;
			break;
		case 0x56: // LD D,(HL)
			this.d = this.read(this.l | this.h << 8);
			break;
		case 0x57: // LD D,A
			this.d = this.a;
			break;
		case 0x58: // LD E,B
			this.e = this.b;
			break;
		case 0x59: // LD E,C
			this.e = this.c;
			break;
		case 0x5a: // LD E,D
			this.e = this.d;
			break;
		case 0x5b: // LD E,E
			break;
		case 0x5c: // LD E,H
			this.e = this.h;
			break;
		case 0x5d: // LD E,L
			this.e = this.l;
			break;
		case 0x5e: // LD E,(HL)
			this.e = this.read(this.l | this.h << 8);
			break;
		case 0x5f: // LD E,A
			this.e = this.a;
			break;
		case 0x60: // LD H,B
			this.h = this.b;
			break;
		case 0x61: // LD H,C
			this.h = this.c;
			break;
		case 0x62: // LD H,D
			this.h = this.d;
			break;
		case 0x63: // LD H,E
			this.h = this.e;
			break;
		case 0x64: // LD H,H
			break;
		case 0x65: // LD H,L
			this.h = this.l;
			break;
		case 0x66: // LD H,(HL)
			this.h = this.read(this.l | this.h << 8);
			break;
		case 0x67: // LD H,A
			this.h = this.a;
			break;
		case 0x68: // LD L,B
			this.l = this.b;
			break;
		case 0x69: // LD L,C
			this.l = this.c;
			break;
		case 0x6a: // LD L,D
			this.l = this.d;
			break;
		case 0x6b: // LD L,E
			this.l = this.e;
			break;
		case 0x6c: // LD L,H
			this.l = this.h;
			break;
		case 0x6d: // LD L,L
			break;
		case 0x6e: // LD L,(HL)
			this.l = this.read(this.l | this.h << 8);
			break;
		case 0x6f: // LD L,A
			this.l = this.a;
			break;
		case 0x70: // LD (HL),B
			this.write(this.l | this.h << 8, this.b);
			break;
		case 0x71: // LD (HL),C
			this.write(this.l | this.h << 8, this.c);
			break;
		case 0x72: // LD (HL),D
			this.write(this.l | this.h << 8, this.d);
			break;
		case 0x73: // LD (HL),E
			this.write(this.l | this.h << 8, this.e);
			break;
		case 0x74: // LD (HL),H
			this.write(this.l | this.h << 8, this.h);
			break;
		case 0x75: // LD (HL),L
			this.write(this.l | this.h << 8, this.l);
			break;
		case 0x76: // HALT
			this.suspend();
			break;
		case 0x77: // LD (HL),A
			this.write(this.l | this.h << 8, this.a);
			break;
		case 0x78: // LD A,B
			this.a = this.b;
			break;
		case 0x79: // LD A,C
			this.a = this.c;
			break;
		case 0x7a: // LD A,D
			this.a = this.d;
			break;
		case 0x7b: // LD A,E
			this.a = this.e;
			break;
		case 0x7c: // LD A,H
			this.a = this.h;
			break;
		case 0x7d: // LD A,L
			this.a = this.l;
			break;
		case 0x7e: // LD A,(HL)
			this.a = this.read(this.l | this.h << 8);
			break;
		case 0x7f: // LD A,A
			break;
		case 0x80: // ADD A,B
			this.add(this.b);
			break;
		case 0x81: // ADD A,C
			this.add(this.c);
			break;
		case 0x82: // ADD A,D
			this.add(this.d);
			break;
		case 0x83: // ADD A,E
			this.add(this.e);
			break;
		case 0x84: // ADD A,H
			this.add(this.h);
			break;
		case 0x85: // ADD A,L
			this.add(this.l);
			break;
		case 0x86: // ADD A,(HL)
			this.add(this.read(this.l | this.h << 8));
			break;
		case 0x87: // ADD A,A
			this.add(this.a);
			break;
		case 0x88: // ADC A,B
			this.adc(this.b);
			break;
		case 0x89: // ADC A,C
			this.adc(this.c);
			break;
		case 0x8a: // ADC A,D
			this.adc(this.d);
			break;
		case 0x8b: // ADC A,E
			this.adc(this.e);
			break;
		case 0x8c: // ADC A,H
			this.adc(this.h);
			break;
		case 0x8d: // ADC A,L
			this.adc(this.l);
			break;
		case 0x8e: // ADC A,(HL)
			this.adc(this.read(this.l | this.h << 8));
			break;
		case 0x8f: // ADC A,A
			this.adc(this.a);
			break;
		case 0x90: // SUB B
			this.sub(this.b);
			break;
		case 0x91: // SUB C
			this.sub(this.c);
			break;
		case 0x92: // SUB D
			this.sub(this.d);
			break;
		case 0x93: // SUB E
			this.sub(this.e);
			break;
		case 0x94: // SUB H
			this.sub(this.h);
			break;
		case 0x95: // SUB L
			this.sub(this.l);
			break;
		case 0x96: // SUB (HL)
			this.sub(this.read(this.l | this.h << 8));
			break;
		case 0x97: // SUB A
			this.sub(this.a);
			break;
		case 0x98: // SBC A,B
			this.sbc(this.b);
			break;
		case 0x99: // SBC A,C
			this.sbc(this.c);
			break;
		case 0x9a: // SBC A,D
			this.sbc(this.d);
			break;
		case 0x9b: // SBC A,E
			this.sbc(this.e);
			break;
		case 0x9c: // SBC A,H
			this.sbc(this.h);
			break;
		case 0x9d: // SBC A,L
			this.sbc(this.l);
			break;
		case 0x9e: // SBC A,(HL)
			this.sbc(this.read(this.l | this.h << 8));
			break;
		case 0x9f: // SBC A,A
			this.sbc(this.a);
			break;
		case 0xa0: // AND B
			this.and(this.b);
			break;
		case 0xa1: // AND C
			this.and(this.c);
			break;
		case 0xa2: // AND D
			this.and(this.d);
			break;
		case 0xa3: // AND E
			this.and(this.e);
			break;
		case 0xa4: // AND H
			this.and(this.h);
			break;
		case 0xa5: // AND L
			this.and(this.l);
			break;
		case 0xa6: // AND (HL)
			this.and(this.read(this.l | this.h << 8));
			break;
		case 0xa7: // AND A
			this.and(this.a);
			break;
		case 0xa8: // XOR B
			this.xor(this.b);
			break;
		case 0xa9: // XOR C
			this.xor(this.c);
			break;
		case 0xaa: // XOR D
			this.xor(this.d);
			break;
		case 0xab: // XOR E
			this.xor(this.e);
			break;
		case 0xac: // XOR H
			this.xor(this.h);
			break;
		case 0xad: // XOR L
			this.xor(this.l);
			break;
		case 0xae: // XOR (HL)
			this.xor(this.read(this.l | this.h << 8));
			break;
		case 0xaf: // XOR A
			this.xor(this.a);
			break;
		case 0xb0: // OR B
			this.or(this.b);
			break;
		case 0xb1: // OR C
			this.or(this.c);
			break;
		case 0xb2: // OR D
			this.or(this.d);
			break;
		case 0xb3: // OR E
			this.or(this.e);
			break;
		case 0xb4: // OR H
			this.or(this.h);
			break;
		case 0xb5: // OR L
			this.or(this.l);
			break;
		case 0xb6: // OR (HL)
			this.or(this.read(this.l | this.h << 8));
			break;
		case 0xb7: // OR A
			this.or(this.a);
			break;
		case 0xb8: // CP B
			this.cp(this.b);
			break;
		case 0xb9: // CP C
			this.cp(this.c);
			break;
		case 0xba: // CP D
			this.cp(this.d);
			break;
		case 0xbb: // CP E
			this.cp(this.e);
			break;
		case 0xbc: // CP H
			this.cp(this.h);
			break;
		case 0xbd: // CP L
			this.cp(this.l);
			break;
		case 0xbe: // CP (HL)
			this.cp(this.read(this.l | this.h << 8));
			break;
		case 0xbf: // CP A
			this.cp(this.a);
			break;
		case 0xc0: // RET NZ
			this.ret((this.f & 0x40) === 0);
			break;
		case 0xc1: // POP BC
			this.c = this.pop();
			this.b = this.pop();
			break;
		case 0xc2: // JP NZ,nn
			this.jp((this.f & 0x40) === 0);
			break;
		case 0xc3: // JP nn
			this.jp(true);
			break;
		case 0xc4: // CALL NZ,nn
			this.call((this.f & 0x40) === 0);
			break;
		case 0xc5: // PUSH BC
			this.push(this.b);
			this.push(this.c);
			break;
		case 0xc6: // ADD A,n
			this.add(this.fetch());
			break;
		case 0xc7: // RST 00h
			this.rst(0x00);
			break;
		case 0xc8: // RET Z
			this.ret((this.f & 0x40) !== 0);
			break;
		case 0xc9: // RET
			this.ret(true);
			break;
		case 0xca: // JP Z,nn
			this.jp((this.f & 0x40) !== 0);
			break;
		case 0xcb:
			this.execute_cb();
			break;
		case 0xcc: // CALL Z,nn
			this.call((this.f & 0x40) !== 0);
			break;
		case 0xcd: // CALL nn
			this.call(true);
			break;
		case 0xce: // ADC A,n
			this.adc(this.fetch());
			break;
		case 0xcf: // RST 08h
			this.rst(0x08);
			break;
		case 0xd0: // RET NC
			this.ret((this.f & 1) === 0);
			break;
		case 0xd1: // POP DE
			this.e = this.pop();
			this.d = this.pop();
			break;
		case 0xd2: // JP NC,nn
			this.jp((this.f & 1) === 0);
			break;
		case 0xd3: // OUT n,A
			this.iowrite(this.a, this.fetch(), this.a);
			break;
		case 0xd4: // CALL NC,nn
			this.call((this.f & 1) === 0);
			break;
		case 0xd5: // PUSH DE
			this.push(this.d);
			this.push(this.e);
			break;
		case 0xd6: // SUB n
			this.sub(this.fetch());
			break;
		case 0xd7: // RST 10h
			this.rst(0x10);
			break;
		case 0xd8: // RET C
			this.ret((this.f & 1) !== 0);
			break;
		case 0xd9: // EXX
			v = this.b;
			this.b = this.b_prime;
			this.b_prime = v;
			v = this.c;
			this.c = this.c_prime;
			this.c_prime = v;
			v = this.d;
			this.d = this.d_prime;
			this.d_prime = v;
			v = this.e;
			this.e = this.e_prime;
			this.e_prime = v;
			v = this.h;
			this.h = this.h_prime;
			this.h_prime = v;
			v = this.l;
			this.l = this.l_prime;
			this.l_prime = v;
			break;
		case 0xda: // JP C,nn
			this.jp((this.f & 1) !== 0);
			break;
		case 0xdb: // IN A,n
			this.a = this.ioread(this.a, this.fetch());
			break;
		case 0xdc: // CALL C,nn
			this.call((this.f & 1) !== 0);
			break;
		case 0xdd:
			this.execute_dd();
			break;
		case 0xde: // SBC A,n
			this.sbc(this.fetch());
			break;
		case 0xdf: // RST 18h
			this.rst(0x18);
			break;
		case 0xe0: // RET PO
			this.ret((this.f & 4) === 0);
			break;
		case 0xe1: // POP HL
			this.l = this.pop();
			this.h = this.pop();
			break;
		case 0xe2: // JP PO,nn
			this.jp((this.f & 4) === 0);
			break;
		case 0xe3: // EX (SP),HL
			v = this.read(this.sp);
			this.write(this.sp, this.l);
			this.l = v;
			v = this.read1(this.sp);
			this.write1(this.sp, this.h);
			this.h = v;
			break;
		case 0xe4: // CALL PO,nn
			this.call((this.f & 4) === 0);
			break;
		case 0xe5: // PUSH HL
			this.push(this.h);
			this.push(this.l);
			break;
		case 0xe6: // AND n
			this.and(this.fetch());
			break;
		case 0xe7: // RST 20h
			this.rst(0x20);
			break;
		case 0xe8: // RET PE
			this.ret((this.f & 4) !== 0);
			break;
		case 0xe9: // JP (HL)
			this.pc = this.l | this.h << 8;
			break;
		case 0xea: // JP PE,nn
			this.jp((this.f & 4) !== 0);
			break;
		case 0xeb: // EX DE,HL
			v = this.d;
			this.d = this.h;
			this.h = v;
			v = this.e;
			this.e = this.l;
			this.l = v;
			break;
		case 0xec: // CALL PE,nn
			this.call((this.f & 4) !== 0);
			break;
		case 0xed:
			this.execute_ed();
			break;
		case 0xee: // XOR n
			this.xor(this.fetch());
			break;
		case 0xef: // RST 28h
			this.rst(0x28);
			break;
		case 0xf0: // RET P
			this.ret((this.f & 0x80) === 0);
			break;
		case 0xf1: // POP AF
			this.f = this.pop();
			this.a = this.pop();
			break;
		case 0xf2: // JP P,nn
			this.jp((this.f & 0x80) === 0);
			break;
		case 0xf3: // DI
			this.iff = 0;
			break;
		case 0xf4: // CALL P,nn
			this.call((this.f & 0x80) === 0);
			break;
		case 0xf5: // PUSH AF
			this.push(this.a);
			this.push(this.f);
			break;
		case 0xf6: // OR n
			this.or(this.fetch());
			break;
		case 0xf7: // RST 30h
			this.rst(0x30);
			break;
		case 0xf8: // RET M
			this.ret((this.f & 0x80) !== 0);
			break;
		case 0xf9: // LD SP,HL
			this.sp = this.l | this.h << 8;
			break;
		case 0xfa: // JP M,nn
			this.jp((this.f & 0x80) !== 0);
			break;
		case 0xfb: // EI
			this.iff = 3;
			break;
		case 0xfc: // CALL M,nn
			this.call((this.f & 0x80) !== 0);
			break;
		case 0xfd:
			this.execute_fd();
			break;
		case 0xfe: // CP A,n
			this.cp(this.fetch());
			break;
		case 0xff: // RST 38h
			this.rst(0x38);
			break;
		}
	}

	execute_cb() {
		let v;

		switch (this.fetch()) {
		case 0x00: // RLC B
			this.b = this.rlc(this.b);
			break;
		case 0x01: // RLC C
			this.c = this.rlc(this.c);
			break;
		case 0x02: // RLC D
			this.d = this.rlc(this.d);
			break;
		case 0x03: // RLC E
			this.e = this.rlc(this.e);
			break;
		case 0x04: // RLC H
			this.h = this.rlc(this.h);
			break;
		case 0x05: // RLC L
			this.l = this.rlc(this.l);
			break;
		case 0x06: // RLC (HL)
			this.write(v = this.l | this.h << 8, this.rlc(this.read(v)));
			break;
		case 0x07: // RLC A
			this.a = this.rlc(this.a);
			break;
		case 0x08: // RRC B
			this.b = this.rrc(this.b);
			break;
		case 0x09: // RRC C
			this.c = this.rrc(this.c);
			break;
		case 0x0a: // RRC D
			this.d = this.rrc(this.d);
			break;
		case 0x0b: // RRC E
			this.e = this.rrc(this.e);
			break;
		case 0x0c: // RRC H
			this.h = this.rrc(this.h);
			break;
		case 0x0d: // RRC L
			this.l = this.rrc(this.l);
			break;
		case 0x0e: // RRC (HL)
			this.write(v = this.l | this.h << 8, this.rrc(this.read(v)));
			break;
		case 0x0f: // RRC A
			this.a = this.rrc(this.a);
			break;
		case 0x10: // RL B
			this.b = this.rl(this.b);
			break;
		case 0x11: // RL C
			this.c = this.rl(this.c);
			break;
		case 0x12: // RL D
			this.d = this.rl(this.d);
			break;
		case 0x13: // RL E
			this.e = this.rl(this.e);
			break;
		case 0x14: // RL H
			this.h = this.rl(this.h);
			break;
		case 0x15: // RL L
			this.l = this.rl(this.l);
			break;
		case 0x16: // RL (HL)
			this.write(v = this.l | this.h << 8, this.rl(this.read(v)));
			break;
		case 0x17: // RL A
			this.a = this.rl(this.a);
			break;
		case 0x18: // RR B
			this.b = this.rr(this.b);
			break;
		case 0x19: // RR C
			this.c = this.rr(this.c);
			break;
		case 0x1a: // RR D
			this.d = this.rr(this.d);
			break;
		case 0x1b: // RR E
			this.e = this.rr(this.e);
			break;
		case 0x1c: // RR H
			this.h = this.rr(this.h);
			break;
		case 0x1d: // RR L
			this.l = this.rr(this.l);
			break;
		case 0x1e: // RR (HL)
			this.write(v = this.l | this.h << 8, this.rr(this.read(v)));
			break;
		case 0x1f: // RR A
			this.a = this.rr(this.a);
			break;
		case 0x20: // SLA B
			this.b = this.sla(this.b);
			break;
		case 0x21: // SLA C
			this.c = this.sla(this.c);
			break;
		case 0x22: // SLA D
			this.d = this.sla(this.d);
			break;
		case 0x23: // SLA E
			this.e = this.sla(this.e);
			break;
		case 0x24: // SLA H
			this.h = this.sla(this.h);
			break;
		case 0x25: // SLA L
			this.l = this.sla(this.l);
			break;
		case 0x26: // SLA (HL)
			this.write(v = this.l | this.h << 8, this.sla(this.read(v)));
			break;
		case 0x27: // SLA A
			this.a = this.sla(this.a);
			break;
		case 0x28: // SRA B
			this.b = this.sra(this.b);
			break;
		case 0x29: // SRA C
			this.c = this.sra(this.c);
			break;
		case 0x2a: // SRA D
			this.d = this.sra(this.d);
			break;
		case 0x2b: // SRA E
			this.e = this.sra(this.e);
			break;
		case 0x2c: // SRA H
			this.h = this.sra(this.h);
			break;
		case 0x2d: // SRA L
			this.l = this.sra(this.l);
			break;
		case 0x2e: // SRA (HL)
			this.write(v = this.l | this.h << 8, this.sra(this.read(v)));
			break;
		case 0x2f: // SRA A
			this.a = this.sra(this.a);
			break;
		case 0x38: // SRL B
			this.b = this.srl(this.b);
			break;
		case 0x39: // SRL C
			this.c = this.srl(this.c);
			break;
		case 0x3a: // SRL D
			this.d = this.srl(this.d);
			break;
		case 0x3b: // SRL E
			this.e = this.srl(this.e);
			break;
		case 0x3c: // SRL H
			this.h = this.srl(this.h);
			break;
		case 0x3d: // SRL L
			this.l = this.srl(this.l);
			break;
		case 0x3e: // SRL (HL)
			this.write(v = this.l | this.h << 8, this.srl(this.read(v)));
			break;
		case 0x3f: // SRL A
			this.a = this.srl(this.a);
			break;
		case 0x40: // BIT 0,B
			this.bit(0, this.b);
			break;
		case 0x41: // BIT 0,C
			this.bit(0, this.c);
			break;
		case 0x42: // BIT 0,D
			this.bit(0, this.d);
			break;
		case 0x43: // BIT 0,E
			this.bit(0, this.e);
			break;
		case 0x44: // BIT 0,H
			this.bit(0, this.h);
			break;
		case 0x45: // BIT 0,L
			this.bit(0, this.l);
			break;
		case 0x46: // BIT 0,(HL)
			this.bit(0, this.read(this.l | this.h << 8));
			break;
		case 0x47: // BIT 0,A
			this.bit(0, this.a);
			break;
		case 0x48: // BIT 1,B
			this.bit(1, this.b);
			break;
		case 0x49: // BIT 1,C
			this.bit(1, this.c);
			break;
		case 0x4a: // BIT 1,D
			this.bit(1, this.d);
			break;
		case 0x4b: // BIT 1,E
			this.bit(1, this.e);
			break;
		case 0x4c: // BIT 1,H
			this.bit(1, this.h);
			break;
		case 0x4d: // BIT 1,L
			this.bit(1, this.l);
			break;
		case 0x4e: // BIT 1,(HL)
			this.bit(1, this.read(this.l | this.h << 8));
			break;
		case 0x4f: // BIT 1,A
			this.bit(1, this.a);
			break;
		case 0x50: // BIT 2,B
			this.bit(2, this.b);
			break;
		case 0x51: // BIT 2,C
			this.bit(2, this.c);
			break;
		case 0x52: // BIT 2,D
			this.bit(2, this.d);
			break;
		case 0x53: // BIT 2,E
			this.bit(2, this.e);
			break;
		case 0x54: // BIT 2,H
			this.bit(2, this.h);
			break;
		case 0x55: // BIT 2,L
			this.bit(2, this.l);
			break;
		case 0x56: // BIT 2,(HL)
			this.bit(2, this.read(this.l | this.h << 8));
			break;
		case 0x57: // BIT 2,A
			this.bit(2, this.a);
			break;
		case 0x58: // BIT 3,B
			this.bit(3, this.b);
			break;
		case 0x59: // BIT 3,C
			this.bit(3, this.c);
			break;
		case 0x5a: // BIT 3,D
			this.bit(3, this.d);
			break;
		case 0x5b: // BIT 3,E
			this.bit(3, this.e);
			break;
		case 0x5c: // BIT 3,H
			this.bit(3, this.h);
			break;
		case 0x5d: // BIT 3,L
			this.bit(3, this.l);
			break;
		case 0x5e: // BIT 3,(HL)
			this.bit(3, this.read(this.l | this.h << 8));
			break;
		case 0x5f: // BIT 3,A
			this.bit(3, this.a);
			break;
		case 0x60: // BIT 4,B
			this.bit(4, this.b);
			break;
		case 0x61: // BIT 4,C
			this.bit(4, this.c);
			break;
		case 0x62: // BIT 4,D
			this.bit(4, this.d);
			break;
		case 0x63: // BIT 4,E
			this.bit(4, this.e);
			break;
		case 0x64: // BIT 4,H
			this.bit(4, this.h);
			break;
		case 0x65: // BIT 4,L
			this.bit(4, this.l);
			break;
		case 0x66: // BIT 4,(HL)
			this.bit(4, this.read(this.l | this.h << 8));
			break;
		case 0x67: // BIT 4,A
			this.bit(4, this.a);
			break;
		case 0x68: // BIT 5,B
			this.bit(5, this.b);
			break;
		case 0x69: // BIT 5,C
			this.bit(5, this.c);
			break;
		case 0x6a: // BIT 5,D
			this.bit(5, this.d);
			break;
		case 0x6b: // BIT 5,E
			this.bit(5, this.e);
			break;
		case 0x6c: // BIT 5,H
			this.bit(5, this.h);
			break;
		case 0x6d: // BIT 5,L
			this.bit(5, this.l);
			break;
		case 0x6e: // BIT 5,(HL)
			this.bit(5, this.read(this.l | this.h << 8));
			break;
		case 0x6f: // BIT 5,A
			this.bit(5, this.a);
			break;
		case 0x70: // BIT 6,B
			this.bit(6, this.b);
			break;
		case 0x71: // BIT 6,C
			this.bit(6, this.c);
			break;
		case 0x72: // BIT 6,D
			this.bit(6, this.d);
			break;
		case 0x73: // BIT 6,E
			this.bit(6, this.e);
			break;
		case 0x74: // BIT 6,H
			this.bit(6, this.h);
			break;
		case 0x75: // BIT 6,L
			this.bit(6, this.l);
			break;
		case 0x76: // BIT 6,(HL)
			this.bit(6, this.read(this.l | this.h << 8));
			break;
		case 0x77: // BIT 6,A
			this.bit(6, this.a);
			break;
		case 0x78: // BIT 7,B
			this.bit(7, this.b);
			break;
		case 0x79: // BIT 7,C
			this.bit(7, this.c);
			break;
		case 0x7a: // BIT 7,D
			this.bit(7, this.d);
			break;
		case 0x7b: // BIT 7,E
			this.bit(7, this.e);
			break;
		case 0x7c: // BIT 7,H
			this.bit(7, this.h);
			break;
		case 0x7d: // BIT 7,L
			this.bit(7, this.l);
			break;
		case 0x7e: // BIT 7,(HL)
			this.bit(7, this.read(this.l | this.h << 8));
			break;
		case 0x7f: // BIT 7,A
			this.bit(7, this.a);
			break;
		case 0x80: // RES 0,B
			this.b = this.constructor.res(0, this.b);
			break;
		case 0x81: // RES 0,C
			this.c = this.constructor.res(0, this.c);
			break;
		case 0x82: // RES 0,D
			this.d = this.constructor.res(0, this.d);
			break;
		case 0x83: // RES 0,E
			this.e = this.constructor.res(0, this.e);
			break;
		case 0x84: // RES 0,H
			this.h = this.constructor.res(0, this.h);
			break;
		case 0x85: // RES 0,L
			this.l = this.constructor.res(0, this.l);
			break;
		case 0x86: // RES 0,(HL)
			this.write(v = this.l | this.h << 8, this.constructor.res(0, this.read(v)));
			break;
		case 0x87: // RES 0,A
			this.a = this.constructor.res(0, this.a);
			break;
		case 0x88: // RES 1,B
			this.b = this.constructor.res(1, this.b);
			break;
		case 0x89: // RES 1,C
			this.c = this.constructor.res(1, this.c);
			break;
		case 0x8a: // RES 1,D
			this.d = this.constructor.res(1, this.d);
			break;
		case 0x8b: // RES 1,E
			this.e = this.constructor.res(1, this.e);
			break;
		case 0x8c: // RES 1,H
			this.h = this.constructor.res(1, this.h);
			break;
		case 0x8d: // RES 1,L
			this.l = this.constructor.res(1, this.l);
			break;
		case 0x8e: // RES 1,(HL)
			this.write(v = this.l | this.h << 8, this.constructor.res(1, this.read(v)));
			break;
		case 0x8f: // RES 1,A
			this.a = this.constructor.res(1, this.a);
			break;
		case 0x90: // RES 2,B
			this.b = this.constructor.res(2, this.b);
			break;
		case 0x91: // RES 2,C
			this.c = this.constructor.res(2, this.c);
			break;
		case 0x92: // RES 2,D
			this.d = this.constructor.res(2, this.d);
			break;
		case 0x93: // RES 2,E
			this.e = this.constructor.res(2, this.e);
			break;
		case 0x94: // RES 2,H
			this.h = this.constructor.res(2, this.h);
			break;
		case 0x95: // RES 2,L
			this.l = this.constructor.res(2, this.l);
			break;
		case 0x96: // RES 2,(HL)
			this.write(v = this.l | this.h << 8, this.constructor.res(2, this.read(v)));
			break;
		case 0x97: // RES 2,A
			this.a = this.constructor.res(2, this.a);
			break;
		case 0x98: // RES 3,B
			this.b = this.constructor.res(3, this.b);
			break;
		case 0x99: // RES 3,C
			this.c = this.constructor.res(3, this.c);
			break;
		case 0x9a: // RES 3,D
			this.d = this.constructor.res(3, this.d);
			break;
		case 0x9b: // RES 3,E
			this.e = this.constructor.res(3, this.e);
			break;
		case 0x9c: // RES 3,H
			this.h = this.constructor.res(3, this.h);
			break;
		case 0x9d: // RES 3,L
			this.l = this.constructor.res(3, this.l);
			break;
		case 0x9e: // RES 3,(HL)
			this.write(v = this.l | this.h << 8, this.constructor.res(3, this.read(v)));
			break;
		case 0x9f: // RES 3,A
			this.a = this.constructor.res(3, this.a);
			break;
		case 0xa0: // RES 4,B
			this.b = this.constructor.res(4, this.b);
			break;
		case 0xa1: // RES 4,C
			this.c = this.constructor.res(4, this.c);
			break;
		case 0xa2: // RES 4,D
			this.d = this.constructor.res(4, this.d);
			break;
		case 0xa3: // RES 4,E
			this.e = this.constructor.res(4, this.e);
			break;
		case 0xa4: // RES 4,H
			this.h = this.constructor.res(4, this.h);
			break;
		case 0xa5: // RES 4,L
			this.l = this.constructor.res(4, this.l);
			break;
		case 0xa6: // RES 4,(HL)
			this.write(v = this.l | this.h << 8, this.constructor.res(4, this.read(v)));
			break;
		case 0xa7: // RES 4,A
			this.a = this.constructor.res(4, this.a);
			break;
		case 0xa8: // RES 5,B
			this.b = this.constructor.res(5, this.b);
			break;
		case 0xa9: // RES 5,C
			this.c = this.constructor.res(5, this.c);
			break;
		case 0xaa: // RES 5,D
			this.d = this.constructor.res(5, this.d);
			break;
		case 0xab: // RES 5,E
			this.e = this.constructor.res(5, this.e);
			break;
		case 0xac: // RES 5,H
			this.h = this.constructor.res(5, this.h);
			break;
		case 0xad: // RES 5,L
			this.l = this.constructor.res(5, this.l);
			break;
		case 0xae: // RES 5,(HL)
			this.write(v = this.l | this.h << 8, this.constructor.res(5, this.read(v)));
			break;
		case 0xaf: // RES 5,A
			this.a = this.constructor.res(5, this.a);
			break;
		case 0xb0: // RES 6,B
			this.b = this.constructor.res(6, this.b);
			break;
		case 0xb1: // RES 6,C
			this.c = this.constructor.res(6, this.c);
			break;
		case 0xb2: // RES 6,D
			this.d = this.constructor.res(6, this.d);
			break;
		case 0xb3: // RES 6,E
			this.e = this.constructor.res(6, this.e);
			break;
		case 0xb4: // RES 6,H
			this.h = this.constructor.res(6, this.h);
			break;
		case 0xb5: // RES 6,L
			this.l = this.constructor.res(6, this.l);
			break;
		case 0xb6: // RES 6,(HL)
			this.write(v = this.l | this.h << 8, this.constructor.res(6, this.read(v)));
			break;
		case 0xb7: // RES 6,A
			this.a = this.constructor.res(6, this.a);
			break;
		case 0xb8: // RES 7,B
			this.b = this.constructor.res(7, this.b);
			break;
		case 0xb9: // RES 7,C
			this.c = this.constructor.res(7, this.c);
			break;
		case 0xba: // RES 7,D
			this.d = this.constructor.res(7, this.d);
			break;
		case 0xbb: // RES 7,E
			this.e = this.constructor.res(7, this.e);
			break;
		case 0xbc: // RES 7,H
			this.h = this.constructor.res(7, this.h);
			break;
		case 0xbd: // RES 7,L
			this.l = this.constructor.res(7, this.l);
			break;
		case 0xbe: // RES 7,(HL)
			this.write(v = this.l | this.h << 8, this.constructor.res(7, this.read(v)));
			break;
		case 0xbf: // RES 7,A
			this.a = this.constructor.res(7, this.a);
			break;
		case 0xc0: // SET 0,B
			this.b = this.constructor.set(0, this.b);
			break;
		case 0xc1: // SET 0,C
			this.c = this.constructor.set(0, this.c);
			break;
		case 0xc2: // SET 0,D
			this.d = this.constructor.set(0, this.d);
			break;
		case 0xc3: // SET 0,E
			this.e = this.constructor.set(0, this.e);
			break;
		case 0xc4: // SET 0,H
			this.h = this.constructor.set(0, this.h);
			break;
		case 0xc5: // SET 0,L
			this.l = this.constructor.set(0, this.l);
			break;
		case 0xc6: // SET 0,(HL)
			this.write(v = this.l | this.h << 8, this.constructor.set(0, this.read(v)));
			break;
		case 0xc7: // SET 0,A
			this.a = this.constructor.set(0, this.a);
			break;
		case 0xc8: // SET 1,B
			this.b = this.constructor.set(1, this.b);
			break;
		case 0xc9: // SET 1,C
			this.c = this.constructor.set(1, this.c);
			break;
		case 0xca: // SET 1,D
			this.d = this.constructor.set(1, this.d);
			break;
		case 0xcb: // SET 1,E
			this.e = this.constructor.set(1, this.e);
			break;
		case 0xcc: // SET 1,H
			this.h = this.constructor.set(1, this.h);
			break;
		case 0xcd: // SET 1,L
			this.l = this.constructor.set(1, this.l);
			break;
		case 0xce: // SET 1,(HL)
			this.write(v = this.l | this.h << 8, this.constructor.set(1, this.read(v)));
			break;
		case 0xcf: // SET 1,A
			this.a = this.constructor.set(1, this.a);
			break;
		case 0xd0: // SET 2,B
			this.b = this.constructor.set(2, this.b);
			break;
		case 0xd1: // SET 2,C
			this.c = this.constructor.set(2, this.c);
			break;
		case 0xd2: // SET 2,D
			this.d = this.constructor.set(2, this.d);
			break;
		case 0xd3: // SET 2,E
			this.e = this.constructor.set(2, this.e);
			break;
		case 0xd4: // SET 2,H
			this.h = this.constructor.set(2, this.h);
			break;
		case 0xd5: // SET 2,L
			this.l = this.constructor.set(2, this.l);
			break;
		case 0xd6: // SET 2,(HL)
			this.write(v = this.l | this.h << 8, this.constructor.set(2, this.read(v)));
			break;
		case 0xd7: // SET 2,A
			this.a = this.constructor.set(2, this.a);
			break;
		case 0xd8: // SET 3,B
			this.b = this.constructor.set(3, this.b);
			break;
		case 0xd9: // SET 3,C
			this.c = this.constructor.set(3, this.c);
			break;
		case 0xda: // SET 3,D
			this.d = this.constructor.set(3, this.d);
			break;
		case 0xdb: // SET 3,E
			this.e = this.constructor.set(3, this.e);
			break;
		case 0xdc: // SET 3,H
			this.h = this.constructor.set(3, this.h);
			break;
		case 0xdd: // SET 3,L
			this.l = this.constructor.set(3, this.l);
			break;
		case 0xde: // SET 3,(HL)
			this.write(v = this.l | this.h << 8, this.constructor.set(3, this.read(v)));
			break;
		case 0xdf: // SET 3,A
			this.a = this.constructor.set(3, this.a);
			break;
		case 0xe0: // SET 4,B
			this.b = this.constructor.set(4, this.b);
			break;
		case 0xe1: // SET 4,C
			this.c = this.constructor.set(4, this.c);
			break;
		case 0xe2: // SET 4,D
			this.d = this.constructor.set(4, this.d);
			break;
		case 0xe3: // SET 4,E
			this.e = this.constructor.set(4, this.e);
			break;
		case 0xe4: // SET 4,H
			this.h = this.constructor.set(4, this.h);
			break;
		case 0xe5: // SET 4,L
			this.l = this.constructor.set(4, this.l);
			break;
		case 0xe6: // SET 4,(HL)
			this.write(v = this.l | this.h << 8, this.constructor.set(4, this.read(v)));
			break;
		case 0xe7: // SET 4,A
			this.a = this.constructor.set(4, this.a);
			break;
		case 0xe8: // SET 5,B
			this.b = this.constructor.set(5, this.b);
			break;
		case 0xe9: // SET 5,C
			this.c = this.constructor.set(5, this.c);
			break;
		case 0xea: // SET 5,D
			this.d = this.constructor.set(5, this.d);
			break;
		case 0xeb: // SET 5,E
			this.e = this.constructor.set(5, this.e);
			break;
		case 0xec: // SET 5,H
			this.h = this.constructor.set(5, this.h);
			break;
		case 0xed: // SET 5,L
			this.l = this.constructor.set(5, this.l);
			break;
		case 0xee: // SET 5,(HL)
			this.write(v = this.l | this.h << 8, this.constructor.set(5, this.read(v)));
			break;
		case 0xef: // SET 5,A
			this.a = this.constructor.set(5, this.a);
			break;
		case 0xf0: // SET 6,B
			this.b = this.constructor.set(6, this.b);
			break;
		case 0xf1: // SET 6,C
			this.c = this.constructor.set(6, this.c);
			break;
		case 0xf2: // SET 6,D
			this.d = this.constructor.set(6, this.d);
			break;
		case 0xf3: // SET 6,E
			this.e = this.constructor.set(6, this.e);
			break;
		case 0xf4: // SET 6,H
			this.h = this.constructor.set(6, this.h);
			break;
		case 0xf5: // SET 6,L
			this.l = this.constructor.set(6, this.l);
			break;
		case 0xf6: // SET 6,(HL)
			this.write(v = this.l | this.h << 8, this.constructor.set(6, this.read(v)));
			break;
		case 0xf7: // SET 6,A
			this.a = this.constructor.set(6, this.a);
			break;
		case 0xf8: // SET 7,B
			this.b = this.constructor.set(7, this.b);
			break;
		case 0xf9: // SET 7,C
			this.c = this.constructor.set(7, this.c);
			break;
		case 0xfa: // SET 7,D
			this.d = this.constructor.set(7, this.d);
			break;
		case 0xfb: // SET 7,E
			this.e = this.constructor.set(7, this.e);
			break;
		case 0xfc: // SET 7,H
			this.h = this.constructor.set(7, this.h);
			break;
		case 0xfd: // SET 7,L
			this.l = this.constructor.set(7, this.l);
			break;
		case 0xfe: // SET 7,(HL)
			this.write(v = this.l | this.h << 8, this.constructor.set(7, this.read(v)));
			break;
		case 0xff: // SET 7,A
			this.a = this.constructor.set(7, this.a);
			break;
		default:
			this.undefsize = 2;
			if (this.undef)
				this.undef(this.arg);
			break;
		}
	}

	execute_dd() {
		let v;

		switch (this.fetch()) {
		case 0x09: // ADD IX,BC
			this.ixl = (v = Z80.aAdd[0][this.c][this.ixl]) & 0xff;
			this.ixh = (v = Z80.aAdd[v >>> 8 & 1][this.b][this.ixh]) & 0xff;
			this.f = this.f & 0xc4 | v >>> 8 & 1;
			break;
		case 0x19: // ADD IX,DE
			this.ixl = (v = Z80.aAdd[0][this.e][this.ixl]) & 0xff;
			this.ixh = (v = Z80.aAdd[v >>> 8 & 1][this.d][this.ixh]) & 0xff;
			this.f = this.f & 0xc4 | v >>> 8 & 1;
			break;
		case 0x21: // LD IX,nn
			this.ixl = this.fetch();
			this.ixh = this.fetch();
			break;
		case 0x22: // LD (nn),IX
			this.write(v = this.fetch() | this.fetch() << 8, this.ixl);
			this.write1(v, this.ixh);
			break;
		case 0x23: // INC IX
			this.ixl = (v = (this.ixl | this.ixh << 8) + 1 & 0xffff) & 0xff;
			this.ixh = v >>> 8;
			break;
		case 0x24: // INC IXH (undefined operation)
			this.ixh = this.inc(this.ixh);
			break;
		case 0x25: // DEC IXH (undefined operation)
			this.ixh = this.dec(this.ixh);
			break;
		case 0x26: // LD IXH,n (undefined operation)
			this.ixh = this.fetch();
			break;
		case 0x29: // ADD IX,IX
			this.ixl = (v = Z80.aAdd[0][this.ixl][this.ixl]) & 0xff;
			this.ixh = (v = Z80.aAdd[v >>> 8 & 1][this.ixh][this.ixh]) & 0xff;
			this.f = this.f & 0xc4 | v >>> 8 & 1;
			break;
		case 0x2a: // LD IX,(nn)
			this.ixl = this.read(v = this.fetch() | this.fetch() << 8);
			this.ixh = this.read1(v);
			break;
		case 0x2b: // DEC IX
			this.ixl = (v = (this.ixl | this.ixh << 8) - 1 & 0xffff) & 0xff;
			this.ixh = v >>> 8;
			break;
		case 0x2c: // INC IXL (undefined operation)
			this.ixl = this.inc(this.ixl);
			break;
		case 0x2d: // DEC IXL (undefined operation)
			this.ixl = this.dec(this.ixl);
			break;
		case 0x2e: // LD IXL,n (undefined operation)
			this.ixl = this.fetch();
			break;
		case 0x34: // INC (IX+d)
			this.write(v = this.disp(this.ixh, this.ixl), this.inc(this.read(v)));
			break;
		case 0x35: // DEC (IX+d)
			this.write(v = this.disp(this.ixh, this.ixl), this.dec(this.read(v)));
			break;
		case 0x36: // LD (IX+d),n
			this.write(this.disp(this.ixh, this.ixl), this.fetch());
			break;
		case 0x44: // LD B,IXH (undefined operation)
			this.b = this.ixh;
			break;
		case 0x45: // LD B,IXL (undefined operation)
			this.b = this.ixl;
			break;
		case 0x46: // LD B,(IX+d)
			this.b = this.read(this.disp(this.ixh, this.ixl));
			break;
		case 0x4c: // LD C,IXH (undefined operation)
			this.c = this.ixh;
			break;
		case 0x4d: // LD C,IXL (undefined operation)
			this.c = this.ixl;
			break;
		case 0x4e: // LD C,(IX+d)
			this.c = this.read(this.disp(this.ixh, this.ixl));
			break;
		case 0x54: // LD D,IXH (undefined operation)
			this.d = this.ixh;
			break;
		case 0x55: // LD D,IXL (undefined operation)
			this.d = this.ixl;
			break;
		case 0x56: // LD D,(IX+d)
			this.d = this.read(this.disp(this.ixh, this.ixl));
			break;
		case 0x5c: // LD E,IXH (undefined operation)
			this.e = this.ixh;
			break;
		case 0x5d: // LD E,IXL (undefined operation)
			this.e = this.ixl;
			break;
		case 0x5e: // LD E,(IX+d)
			this.e = this.read(this.disp(this.ixh, this.ixl));
			break;
		case 0x60: // LD IXH,B (undefined operation)
			this.ixh = this.b;
			break;
		case 0x61: // LD IXH,C (undefined operation)
			this.ixh = this.c;
			break;
		case 0x62: // LD IXH,D (undefined operation)
			this.ixh = this.d;
			break;
		case 0x63: // LD IXH,E (undefined operation)
			this.ixh = this.e;
			break;
		case 0x66: // LD H,(IX+d)
			this.h = this.read(this.disp(this.ixh, this.ixl));
			break;
		case 0x67: // LD IXH,A (undefined operation)
			this.ixh = this.a;
			break;
		case 0x68: // LD IXL,B (undefined operation)
			this.ixl = this.b;
			break;
		case 0x69: // LD IXL,C (undefined operation)
			this.ixl = this.c;
			break;
		case 0x6a: // LD IXL,D (undefined operation)
			this.ixl = this.d;
			break;
		case 0x6b: // LD IXL,E (undefined operation)
			this.ixl = this.e;
			break;
		case 0x6e: // LD L,(IX+d)
			this.l = this.read(this.disp(this.ixh, this.ixl));
			break;
		case 0x6f: // LD IXL,A (undefined operation)
			this.ixl = this.a;
			break;
		case 0x70: // LD (IX+d),B
			this.write(this.disp(this.ixh, this.ixl), this.b);
			break;
		case 0x71: // LD (IX+d),C
			this.write(this.disp(this.ixh, this.ixl), this.c);
			break;
		case 0x72: // LD (IX+d),D
			this.write(this.disp(this.ixh, this.ixl), this.d);
			break;
		case 0x73: // LD (IX+d),E
			this.write(this.disp(this.ixh, this.ixl), this.e);
			break;
		case 0x74: // LD (IX+d),H
			this.write(this.disp(this.ixh, this.ixl), this.h);
			break;
		case 0x75: // LD (IX+d),L
			this.write(this.disp(this.ixh, this.ixl), this.l);
			break;
		case 0x77: // LD (IX+d),A
			this.write(this.disp(this.ixh, this.ixl), this.a);
			break;
		case 0x7c: // LD A,IXH (undefined operation)
			this.a = this.ixh;
			break;
		case 0x7d: // LD A,IXL (undefined operation)
			this.a = this.ixl;
			break;
		case 0x7e: // LD A,(IX+d)
			this.a = this.read(this.disp(this.ixh, this.ixl));
			break;
		case 0x84: // ADD A,IXH (undefined operation)
			this.add(this.ixh);
			break;
		case 0x85: // ADD A,IXL (undefined operation)
			this.add(this.ixl);
			break;
		case 0x86: // ADD A,(IX+d)
			this.add(this.read(this.disp(this.ixh, this.ixl)));
			break;
		case 0x8c: // ADC A,IXH (undefined operation)
			this.adc(this.ixh);
			break;
		case 0x8d: // ADC A,IXL (undefined operation)
			this.adc(this.ixl);
			break;
		case 0x8e: // ADC A,(IX+d)
			this.adc(this.read(this.disp(this.ixh, this.ixl)));
			break;
		case 0x94: // SUB IXH (undefined operation)
			this.sub(this.ixh);
			break;
		case 0x95: // SUB IXL (undefined operation)
			this.sub(this.ixl);
			break;
		case 0x96: // SUB (IX+d)
			this.sub(this.read(this.disp(this.ixh, this.ixl)));
			break;
		case 0x9c: // SBC A,IXH (undefined operation)
			this.sbc(this.ixh);
			break;
		case 0x9d: // SBC A,IXL (undefined operation)
			this.sbc(this.ixl);
			break;
		case 0x9e: // SBC A,(IX+d)
			this.sbc(this.read(this.disp(this.ixh, this.ixl)));
			break;
		case 0xa4: // AND IXH (undefined operation)
			this.and(this.ixh);
			break;
		case 0xa5: // AND IXL (undefined operation)
			this.and(this.ixl);
			break;
		case 0xa6: // AND (IX+d)
			this.and(this.read(this.disp(this.ixh, this.ixl)));
			break;
		case 0xac: // XOR IXH (undefined operation)
			this.xor(this.ixh);
			break;
		case 0xad: // XOR IXL (undefined operation)
			this.xor(this.ixl);
			break;
		case 0xae: // XOR (IX+d)
			this.xor(this.read(this.disp(this.ixh, this.ixl)));
			break;
		case 0xb4: // OR IXH (undefined operation)
			this.or(this.ixh);
			break;
		case 0xb5: // OR IXL (undefined operation)
			this.or(this.ixl);
			break;
		case 0xb6: // OR (IX+d)
			this.or(this.read(this.disp(this.ixh, this.ixl)));
			break;
		case 0xbc: // CP IXH (undefined operation)
			this.cp(this.ixh);
			break;
		case 0xbd: // CP IXL (undefined operation)
			this.cp(this.ixl);
			break;
		case 0xbe: // CP (IX+d)
			this.cp(this.read(this.disp(this.ixh, this.ixl)));
			break;
		case 0xcb:
			v = this.disp(this.ixh, this.ixl);
			switch (this.fetch()) {
			case 0x06: // RLC (IX+d)
				this.write(v, this.rlc(this.read(v)));
				break;
			case 0x0e: // RRC (IX+d)
				this.write(v, this.rrc(this.read(v)));
				break;
			case 0x16: // RL (IX+d)
				this.write(v, this.rl(this.read(v)));
				break;
			case 0x1e: // RR (IX+d)
				this.write(v, this.rr(this.read(v)));
				break;
			case 0x26: // SLA (IX+d)
				this.write(v, this.sla(this.read(v)));
				break;
			case 0x2e: // SRA (IX+d)
				this.write(v, this.sra(this.read(v)));
				break;
			case 0x3e: // SRL (IX+d)
				this.write(v, this.srl(this.read(v)));
				break;
			case 0x46: // BIT 0,(IX+d)
				this.bit(0, this.read(v));
				break;
			case 0x4e: // BIT 1,(IX+d)
				this.bit(1, this.read(v));
				break;
			case 0x56: // BIT 2,(IX+d)
				this.bit(2, this.read(v));
				break;
			case 0x5e: // BIT 3,(IX+d)
				this.bit(3, this.read(v));
				break;
			case 0x66: // BIT 4,(IX+d)
				this.bit(4, this.read(v));
				break;
			case 0x6e: // BIT 5,(IX+d)
				this.bit(5, this.read(v));
				break;
			case 0x76: // BIT 6,(IX+d)
				this.bit(6, this.read(v));
				break;
			case 0x7e: // BIT 7,(IX+d)
				this.bit(7, this.read(v));
				break;
			case 0x86: // RES 0,(IX+d)
				this.write(v, this.constructor.res(0, this.read(v)));
				break;
			case 0x8e: // RES 1,(IX+d)
				this.write(v, this.constructor.res(1, this.read(v)));
				break;
			case 0x96: // RES 2,(IX+d)
				this.write(v, this.constructor.res(2, this.read(v)));
				break;
			case 0x9e: // RES 3,(IX+d)
				this.write(v, this.constructor.res(3, this.read(v)));
				break;
			case 0xa6: // RES 4,(IX+d)
				this.write(v, this.constructor.res(4, this.read(v)));
				break;
			case 0xae: // RES 5,(IX+d)
				this.write(v, this.constructor.res(5, this.read(v)));
				break;
			case 0xb6: // RES 6,(IX+d)
				this.write(v, this.constructor.res(6, this.read(v)));
				break;
			case 0xbe: // RES 7,(IX+d)
				this.write(v, this.constructor.res(7, this.read(v)));
				break;
			case 0xc6: // SET 0,(IX+d)
				this.write(v, this.constructor.set(0, this.read(v)));
				break;
			case 0xce: // SET 1,(IX+d)
				this.write(v, this.constructor.set(1, this.read(v)));
				break;
			case 0xd6: // SET 2,(IX+d)
				this.write(v, this.constructor.set(2, this.read(v)));
				break;
			case 0xde: // SET 3,(IX+d)
				this.write(v, this.constructor.set(3, this.read(v)));
				break;
			case 0xe6: // SET 4,(IX+d)
				this.write(v, this.constructor.set(4, this.read(v)));
				break;
			case 0xee: // SET 5,(IX+d)
				this.write(v, this.constructor.set(5, this.read(v)));
				break;
			case 0xf6: // SET 6,(IX+d)
				this.write(v, this.constructor.set(6, this.read(v)));
				break;
			case 0xfe: // SET 7,(IX+d)
				this.write(v, this.constructor.set(7, this.read(v)));
				break;
			default:
				this.undefsize = 4;
				if (this.undef)
					this.undef(this.arg);
				break;
			}
			break;
		case 0xe1: // POP IX
			this.ixl = this.pop();
			this.ixh = this.pop();
			break;
		case 0xe3: // EX (SP),IX
			v = this.read(this.sp);
			this.write(this.sp, this.ixl);
			this.ixl = v;
			v = this.read1(this.sp);
			this.write1(this.sp, this.ixh);
			this.ixh = v;
			break;
		case 0xe5: // PUSH IX
			this.push(this.ixh);
			this.push(this.ixl);
			break;
		case 0xe9: // JP (IX)
			this.pc = this.ixl | this.ixh << 8;
			break;
		case 0xf9: // LD SP,IX
			this.sp = this.ixl | this.ixh << 8;
			break;
		default:
			this.undefsize = 2;
			if (this.undef)
				this.undef(this.arg);
			break;
		}
	}

	execute_ed() {
		let v;

		switch (this.fetch()) {
		case 0x40: // IN B,(C)
			this.f = this.f & 1 | Z80.fLogic[this.b = this.ioread(this.b, this.c)];
			break;
		case 0x41: // OUT (C),B
			this.iowrite(this.b, this.c, this.b);
			break;
		case 0x42: // SBC HL,BC
			this.l = (v = Z80.aSub[this.f & 1][this.c][this.l]) & 0xff;
			this.h = (v = Z80.aSub[v >>> 8 & 1][this.b][this.h]) & 0xff;
			this.f = v >>> 8 & ~((this.l !== 0) << 6);
			break;
		case 0x43: // LD (nn),BC
			this.write(v = this.fetch() | this.fetch() << 8, this.c);
			this.write1(v, this.b);
			break;
		case 0x44: // NEG
			this.a = (v = Z80.aSub[0][this.a][0]) & 0xff;
			this.f = v >>> 8;
			break;
		case 0x45: // RETN
			this.iff = (this.iff & 2) !== 0 ? 3 : 0;
			this.ret(true);
			break;
		case 0x46: // IM 0
			this.im = 0;
			break;
		case 0x47: // LD I,A
			this.i = this.a;
			break;
		case 0x48: // IN C,(C)
			this.f = this.f & 1 | Z80.fLogic[this.c = this.ioread(this.b, this.c)];
			break;
		case 0x49: // OUT (C),C
			this.iowrite(this.b, this.c, this.c);
			break;
		case 0x4a: // ADC HL,BC
			this.l = (v = Z80.aAdd[this.f & 1][this.c][this.l]) & 0xff;
			this.h = (v = Z80.aAdd[v >>> 8 & 1][this.b][this.h]) & 0xff;
			this.f = v >>> 8 & ~((this.l !== 0) << 6);
			break;
		case 0x4b: // LD BC,(nn)
			this.c = this.read(v = this.fetch() | this.fetch() << 8);
			this.b = this.read1(v);
			break;
		case 0x4d: // RETI
			this.ret(true);
			break;
		case 0x4f: // LD R,A
			this.r = this.a & 0x7f;
			break;
		case 0x50: // IN D,(C)
			this.f = this.f & 1 | Z80.fLogic[this.d = this.ioread(this.b, this.c)];
			break;
		case 0x51: // OUT (C),D
			this.iowrite(this.b, this.c, this.d);
			break;
		case 0x52: // SBC HL,DE
			this.l = (v = Z80.aSub[this.f & 1][this.e][this.l]) & 0xff;
			this.h = (v = Z80.aSub[v >>> 8 & 1][this.d][this.h]) & 0xff;
			this.f = v >>> 8 & ~((this.l !== 0) << 6);
			break;
		case 0x53: // LD (nn),DE
			this.write(v = this.fetch() | this.fetch() << 8, this.e);
			this.write1(v, this.d);
			break;
		case 0x56: // IM 1
			this.im = 1;
			break;
		case 0x57: // LD A,I
			this.f = this.f & 1 | Z80.fLogic[this.a = this.i] & 0xc0 | this.iff << 1 & 4;
			break;
		case 0x58: // IN E,(C)
			this.f = this.f & 1 | Z80.fLogic[this.e = this.ioread(this.b, this.c)];
			break;
		case 0x59: // OUT (C),E
			this.iowrite(this.b, this.c, this.e);
			break;
		case 0x5a: // ADC HL,DE
			this.l = (v = Z80.aAdd[this.f & 1][this.e][this.l]) & 0xff;
			this.h = (v = Z80.aAdd[v >>> 8 & 1][this.d][this.h]) & 0xff;
			this.f = v >>> 8 & ~((this.l !== 0) << 6);
			break;
		case 0x5b: // LD DE,(nn)
			this.e = this.read(v = this.fetch() | this.fetch() << 8);
			this.d = this.read1(v);
			break;
		case 0x5e: // IM 2
			this.im = 2;
			break;
		case 0x5f: // LD A,R
			this.f = this.f & 1 | Z80.fLogic[this.a = this.r] & 0xc0 | this.iff << 1 & 4;
			break;
		case 0x60: // IN H,(C)
			this.f = this.f & 1 | Z80.fLogic[this.h = this.ioread(this.b, this.c)];
			break;
		case 0x61: // OUT (C),H
			this.iowrite(this.b, this.c, this.h);
			break;
		case 0x62: // SBC HL,HL
			this.l = (v = Z80.aSub[this.f & 1][this.l][this.l]) & 0xff;
			this.h = (v = Z80.aSub[v >>> 8 & 1][this.h][this.h]) & 0xff;
			this.f = v >>> 8 & ~((this.l !== 0) << 6);
			break;
		case 0x67: // RRD
			this.a = this.a & 0xf0 | (v = this.read(this.l | this.h << 8) | this.a << 8) & 0x0f;
			this.f = this.f & 1 | Z80.fLogic[this.write(this.l | this.h << 8, v >>> 4 & 0xff)] & 0xc4;
			break;
		case 0x68: // IN L,(C)
			this.f = this.f & 1 | Z80.fLogic[this.l = this.ioread(this.b, this.c)];
			break;
		case 0x69: // OUT (C),L
			this.iowrite(this.b, this.c, this.l);
			break;
		case 0x6a: // ADC HL,HL
			this.l = (v = Z80.aAdd[this.f & 1][this.l][this.l]) & 0xff;
			this.h = (v = Z80.aAdd[v >>> 8 & 1][this.h][this.h]) & 0xff;
			this.f = v >>> 8 & ~((this.l !== 0) << 6);
			break;
		case 0x6f: // RLD
			this.a = this.a & 0xf0 | (v = this.read(this.l | this.h << 8) << 4 | this.a & 0x0f) >>> 8;
			this.f = this.f & 1 | Z80.fLogic[this.write(this.l | this.h << 8, v & 0xff)] & 0xc4;
			break;
		case 0x72: // SBC HL,SP
			this.l = (v = Z80.aSub[this.f & 1][this.sp & 0xff][this.l]) & 0xff;
			this.h = (v = Z80.aSub[v >>> 8 & 1][this.sp >>> 8][this.h]) & 0xff;
			this.f = v >>> 8 & ~((this.l !== 0) << 6);
			break;
		case 0x73: // LD (nn),SP
			this.write(v = this.fetch() | this.fetch() << 8, this.sp & 0xff);
			this.write1(v, this.sp >>> 8);
			break;
		case 0x78: // IN A,(C)
			this.f = this.f & 1 | Z80.fLogic[this.a = this.ioread(this.b, this.c)];
			break;
		case 0x79: // OUT (C),A
			this.iowrite(this.b, this.c, this.a);
			break;
		case 0x7a: // ADC HL,SP
			this.l = (v = Z80.aAdd[this.f & 1][this.sp & 0xff][this.l]) & 0xff;
			this.h = (v = Z80.aAdd[v >>> 8 & 1][this.sp >>> 8][this.h]) & 0xff;
			this.f = v >>> 8 & ~((this.l !== 0) << 6);
			break;
		case 0x7b: // LD SP,(nn)
			this.sp = this.read(v = this.fetch() | this.fetch() << 8) | this.read1(v) << 8;
			break;
		case 0xa0: // LDI
			this.ldi();
			break;
		case 0xa1: // CPI
			this.cpi();
			break;
		case 0xa2: // INI
			this.ini();
			break;
		case 0xa3: // OUTI
			this.outi();
			break;
		case 0xa8: // LDD
			this.ldd();
			break;
		case 0xa9: // CPD
			this.cpd();
			break;
		case 0xaa: // IND
			this.ind();
			break;
		case 0xab: // OUTD
			this.outd();
			break;
		case 0xb0: // LDIR
			this.ldi();
			if ((this.f & 4) !== 0)
				this.pc = this.pc - 2 & 0xffff;
			break;
		case 0xb1: // CPIR
			this.cpi();
			if ((this.f & 0x44) === 4)
				this.pc = this.pc - 2 & 0xffff;
			break;
		case 0xb2: // INIR
			this.ini();
			if ((this.f & 0x40) === 0)
				this.pc = this.pc - 2 & 0xffff;
			break;
		case 0xb3: // OTIR
			this.outi();
			if ((this.f & 0x40) === 0)
				this.pc = this.pc - 2 & 0xffff;
			break;
		case 0xb8: // LDDR
			this.ldd();
			if ((this.f & 4) !== 0)
				this.pc = this.pc - 2 & 0xffff;
			break;
		case 0xb9: // CPDR
			this.cpd();
			if ((this.f & 0x44) === 4)
				this.pc = this.pc - 2 & 0xffff;
			break;
		case 0xba: // INDR
			this.ind();
			if ((this.f & 0x40) === 0)
				this.pc = this.pc - 2 & 0xffff;
			break;
		case 0xbb: // OTDR
			this.outd();
			if ((this.f & 0x40) === 0)
				this.pc = this.pc - 2 & 0xffff;
			break;
		default:
			this.undefsize = 2;
			if (this.undef)
				this.undef(this.arg);
			break;
		}
	}

	execute_fd() {
		let v;

		switch (this.fetch()) {
		case 0x09: // ADD IY,BC
			this.iyl = (v = Z80.aAdd[0][this.c][this.iyl]) & 0xff;
			this.iyh = (v = Z80.aAdd[v >>> 8 & 1][this.b][this.iyh]) & 0xff;
			this.f = this.f & 0xc4 | v >>> 8 & 1;
			break;
		case 0x19: // ADD IY,DE
			this.iyl = (v = Z80.aAdd[0][this.e][this.iyl]) & 0xff;
			this.iyh = (v = Z80.aAdd[v >>> 8 & 1][this.d][this.iyh]) & 0xff;
			this.f = this.f & 0xc4 | v >>> 8 & 1;
			break;
		case 0x21: // LD IY,nn
			this.iyl = this.fetch();
			this.iyh = this.fetch();
			break;
		case 0x22: // LD (nn),IY
			this.write(v = this.fetch() | this.fetch() << 8, this.iyl);
			this.write1(v, this.iyh);
			break;
		case 0x23: // INC IY
			this.iyl = (v = (this.iyl | this.iyh << 8) + 1 & 0xffff) & 0xff;
			this.iyh = v >>> 8;
			break;
		case 0x24: // INC IYH (undefined operation)
			this.iyh = this.inc(this.iyh);
			break;
		case 0x25: // DEC IYH (undefined operation)
			this.iyh = this.dec(this.iyh);
			break;
		case 0x26: // LD IYH,n (undefined operation)
			this.iyh = this.fetch();
			break;
		case 0x29: // ADD IY,IY
			this.iyl = (v = Z80.aAdd[0][this.iyl][this.iyl]) & 0xff;
			this.iyh = (v = Z80.aAdd[v >>> 8 & 1][this.iyh][this.iyh]) & 0xff;
			this.f = this.f & 0xc4 | v >>> 8 & 1;
			break;
		case 0x2a: // LD IY,(nn)
			this.iyl = this.read(v = this.fetch() | this.fetch() << 8);
			this.iyh = this.read1(v);
			break;
		case 0x2b: // DEC IY
			this.iyl = (v = (this.iyl | this.iyh << 8) - 1 & 0xffff) & 0xff;
			this.iyh = v >>> 8;
			break;
		case 0x2c: // INC IYL (undefined operation)
			this.iyl = this.inc(this.iyl);
			break;
		case 0x2d: // DEC IYL (undefined operation)
			this.iyl = this.dec(this.iyl);
			break;
		case 0x2e: // LD IYL,n (undefined operation)
			this.iyl = this.fetch();
			break;
		case 0x34: // INC (IY+d)
			this.write(v = this.disp(this.iyh, this.iyl), this.inc(this.read(v)));
			break;
		case 0x35: // DEC (IY+d)
			this.write(v = this.disp(this.iyh, this.iyl), this.dec(this.read(v)));
			break;
		case 0x36: // LD (IY+d),n
			this.write(this.disp(this.iyh, this.iyl), this.fetch());
			break;
		case 0x44: // LD B,IYH (undefined operation)
			this.b = this.iyh;
			break;
		case 0x45: // LD B,IYL (undefined operation)
			this.b = this.iyl;
			break;
		case 0x46: // LD B,(IY+d)
			this.b = this.read(this.disp(this.iyh, this.iyl));
			break;
		case 0x4c: // LD C,IYH (undefined operation)
			this.c = this.iyh;
			break;
		case 0x4d: // LD C,IYL (undefined operation)
			this.c = this.iyl;
			break;
		case 0x4e: // LD C,(IY+d)
			this.c = this.read(this.disp(this.iyh, this.iyl));
			break;
		case 0x54: // LD D,IYH (undefined operation)
			this.d = this.iyh;
			break;
		case 0x55: // LD D,IYL (undefined operation)
			this.d = this.iyl;
			break;
		case 0x56: // LD D,(IY+d)
			this.d = this.read(this.disp(this.iyh, this.iyl));
			break;
		case 0x5c: // LD E,IYH (undefined operation)
			this.e = this.iyh;
			break;
		case 0x5d: // LD E,IYL (undefined operation)
			this.e = this.iyl;
			break;
		case 0x5e: // LD E,(IY+d)
			this.e = this.read(this.disp(this.iyh, this.iyl));
			break;
		case 0x60: // LD IYH,B (undefined operation)
			this.iyh = this.b;
			break;
		case 0x61: // LD IYH,C (undefined operation)
			this.iyh = this.c;
			break;
		case 0x62: // LD IYH,D (undefined operation)
			this.iyh = this.d;
			break;
		case 0x63: // LD IYH,E (undefined operation)
			this.iyh = this.e;
			break;
		case 0x66: // LD H,(IY+d)
			this.h = this.read(this.disp(this.iyh, this.iyl));
			break;
		case 0x67: // LD IYH,A (undefined operation)
			this.iyh = this.a;
			break;
		case 0x68: // LD IYL,B (undefined operation)
			this.iyl = this.b;
			break;
		case 0x69: // LD IYL,C (undefined operation)
			this.iyl = this.c;
			break;
		case 0x6a: // LD IYL,D (undefined operation)
			this.iyl = this.d;
			break;
		case 0x6b: // LD IYL,E (undefined operation)
			this.iyl = this.e;
			break;
		case 0x6e: // LD L,(IY+d)
			this.l = this.read(this.disp(this.iyh, this.iyl));
			break;
		case 0x6f: // LD IYL,A (undefined operation)
			this.iyl = this.a;
			break;
		case 0x70: // LD (IY+d),B
			this.write(this.disp(this.iyh, this.iyl), this.b);
			break;
		case 0x71: // LD (IY+d),C
			this.write(this.disp(this.iyh, this.iyl), this.c);
			break;
		case 0x72: // LD (IY+d),D
			this.write(this.disp(this.iyh, this.iyl), this.d);
			break;
		case 0x73: // LD (IY+d),E
			this.write(this.disp(this.iyh, this.iyl), this.e);
			break;
		case 0x74: // LD (IY+d),H
			this.write(this.disp(this.iyh, this.iyl), this.h);
			break;
		case 0x75: // LD (IY+d),L
			this.write(this.disp(this.iyh, this.iyl), this.l);
			break;
		case 0x77: // LD (IY+d),A
			this.write(this.disp(this.iyh, this.iyl), this.a);
			break;
		case 0x7c: // LD A,IYH (undefined operation)
			this.a = this.iyh;
			break;
		case 0x7d: // LD A,IYL (undefined operation)
			this.a = this.iyl;
			break;
		case 0x7e: // LD A,(IY+d)
			this.a = this.read(this.disp(this.iyh, this.iyl));
			break;
		case 0x84: // ADD A,IYH (undefined operation)
			this.add(this.iyh);
			break;
		case 0x85: // ADD A,IYL (undefined operation)
			this.add(this.iyl);
			break;
		case 0x86: // ADD A,(IY+d)
			this.add(this.read(this.disp(this.iyh, this.iyl)));
			break;
		case 0x8c: // ADC A,IYH (undefined operation)
			this.adc(this.iyh);
			break;
		case 0x8d: // ADC A,IYL (undefined operation)
			this.adc(this.iyl);
			break;
		case 0x8e: // ADC A,(IY+d)
			this.adc(this.read(this.disp(this.iyh, this.iyl)));
			break;
		case 0x94: // SUB IYH (undefined operation)
			this.sub(this.iyh);
			break;
		case 0x95: // SUB IYL (undefined operation)
			this.sub(this.iyl);
			break;
		case 0x96: // SUB (IY+d)
			this.sub(this.read(this.disp(this.iyh, this.iyl)));
			break;
		case 0x9c: // SBC A,IYH (undefined operation)
			this.sbc(this.iyh);
			break;
		case 0x9d: // SBC A,IYL (undefined operation)
			this.sbc(this.iyl);
			break;
		case 0x9e: // SBC A,(IY+d)
			this.sbc(this.read(this.disp(this.iyh, this.iyl)));
			break;
		case 0xa4: // AND IYH (undefined operation)
			this.and(this.iyh);
			break;
		case 0xa5: // AND IYL (undefined operation)
			this.and(this.iyl);
			break;
		case 0xa6: // AND (IY+d)
			this.and(this.read(this.disp(this.iyh, this.iyl)));
			break;
		case 0xac: // XOR IYH (undefined operation)
			this.xor(this.iyh);
			break;
		case 0xad: // XOR IYL (undefined operation)
			this.xor(this.iyl);
			break;
		case 0xae: // XOR (IY+d)
			this.xor(this.read(this.disp(this.iyh, this.iyl)));
			break;
		case 0xb4: // OR IYH (undefined operation)
			this.or(this.iyh);
			break;
		case 0xb5: // OR IYL (undefined operation)
			this.or(this.iyl);
			break;
		case 0xb6: // OR (IY+d)
			this.or(this.read(this.disp(this.iyh, this.iyl)));
			break;
		case 0xbc: // CP IYH (undefined operation)
			this.cp(this.iyh);
			break;
		case 0xbd: // CP IYL (undefined operation)
			this.cp(this.iyl);
			break;
		case 0xbe: // CP (IY+d)
			this.cp(this.read(this.disp(this.iyh, this.iyl)));
			break;
		case 0xcb:
			v = this.disp(this.iyh, this.iyl);
			switch (this.fetch()) {
			case 0x06: // RLC (IY+d)
				this.write(v, this.rlc(this.read(v)));
				break;
			case 0x0e: // RRC (IY+d)
				this.write(v, this.rrc(this.read(v)));
				break;
			case 0x16: // RL (IY+d)
				this.write(v, this.rl(this.read(v)));
				break;
			case 0x1e: // RR (IY+d)
				this.write(v, this.rr(this.read(v)));
				break;
			case 0x26: // SLA (IY+d)
				this.write(v, this.sla(this.read(v)));
				break;
			case 0x2e: // SRA (IY+d)
				this.write(v, this.sra(this.read(v)));
				break;
			case 0x3e: // SRL (IY+d)
				this.write(v, this.srl(this.read(v)));
				break;
			case 0x46: // BIT 0,(IY+d)
				this.bit(0, this.read(v));
				break;
			case 0x4e: // BIT 1,(IY+d)
				this.bit(1, this.read(v));
				break;
			case 0x56: // BIT 2,(IY+d)
				this.bit(2, this.read(v));
				break;
			case 0x5e: // BIT 3,(IY+d)
				this.bit(3, this.read(v));
				break;
			case 0x66: // BIT 4,(IY+d)
				this.bit(4, this.read(v));
				break;
			case 0x6e: // BIT 5,(IY+d)
				this.bit(5, this.read(v));
				break;
			case 0x76: // BIT 6,(IY+d)
				this.bit(6, this.read(v));
				break;
			case 0x7e: // BIT 7,(IY+d)
				this.bit(7, this.read(v));
				break;
			case 0x86: // RES 0,(IY+d)
				this.write(v, this.constructor.res(0, this.read(v)));
				break;
			case 0x8e: // RES 1,(IY+d)
				this.write(v, this.constructor.res(1, this.read(v)));
				break;
			case 0x96: // RES 2,(IY+d)
				this.write(v, this.constructor.res(2, this.read(v)));
				break;
			case 0x9e: // RES 3,(IY+d)
				this.write(v, this.constructor.res(3, this.read(v)));
				break;
			case 0xa6: // RES 4,(IY+d)
				this.write(v, this.constructor.res(4, this.read(v)));
				break;
			case 0xae: // RES 5,(IY+d)
				this.write(v, this.constructor.res(5, this.read(v)));
				break;
			case 0xb6: // RES 6,(IY+d)
				this.write(v, this.constructor.res(6, this.read(v)));
				break;
			case 0xbe: // RES 7,(IY+d)
				this.write(v, this.constructor.res(7, this.read(v)));
				break;
			case 0xc6: // SET 0,(IY+d)
				this.write(v, this.constructor.set(0, this.read(v)));
				break;
			case 0xce: // SET 1,(IY+d)
				this.write(v, this.constructor.set(1, this.read(v)));
				break;
			case 0xd6: // SET 2,(IY+d)
				this.write(v, this.constructor.set(2, this.read(v)));
				break;
			case 0xde: // SET 3,(IY+d)
				this.write(v, this.constructor.set(3, this.read(v)));
				break;
			case 0xe6: // SET 4,(IY+d)
				this.write(v, this.constructor.set(4, this.read(v)));
				break;
			case 0xee: // SET 5,(IY+d)
				this.write(v, this.constructor.set(5, this.read(v)));
				break;
			case 0xf6: // SET 6,(IY+d)
				this.write(v, this.constructor.set(6, this.read(v)));
				break;
			case 0xfe: // SET 7,(IY+d)
				this.write(v, this.constructor.set(7, this.read(v)));
				break;
			default:
				this.undefsize = 4;
				if (this.undef)
					this.undef(this.arg);
				break;
			}
			break;
		case 0xe1: // POP IY
			this.iyl = this.pop();
			this.iyh = this.pop();
			break;
		case 0xe3: // EX (SP),IY
			v = this.read(this.sp);
			this.write(this.sp, this.iyl);
			this.iyl = v;
			v = this.read1(this.sp);
			this.write1(this.sp, this.iyh);
			this.iyh = v;
			break;
		case 0xe5: // PUSH IY
			this.push(this.iyh);
			this.push(this.iyl);
			break;
		case 0xe9: // JP (IY)
			this.pc = this.iyl | this.iyh << 8;
			break;
		case 0xf9: // LD SP,IY
			this.sp = this.iyl | this.iyh << 8;
			break;
		default:
			this.undefsize = 2;
			if (this.undef)
				this.undef(this.arg);
			break;
		}
	}

	disp(h, l) {
		const d = this.fetch();
		return (l | h << 8) + d - (d << 1 & 0x100) & 0xffff;
	}

	jr(cond) {
		const d = this.fetch();
		if (cond) this.pc = this.pc + d - (d << 1 & 0x100) & 0xffff;
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
		const v = Z80.aAdd[0][r][this.a];
		this.f = v >>> 8;
		this.a = v & 0xff;
	}

	adc(r) {
		const v = Z80.aAdd[this.f & 1][r][this.a];
		this.f = v >>> 8;
		this.a = v & 0xff;
	}

	sub(r) {
		const v = Z80.aSub[0][r][this.a];
		this.f = v >>> 8;
		this.a = v & 0xff;
	}

	sbc(r) {
		const v = Z80.aSub[this.f & 1][r][this.a];
		this.f = v >>> 8;
		this.a = v & 0xff;
	}

	and(r) {
		this.f = Z80.fLogic[this.a &= r] | 0x10;
	}

	xor(r) {
		this.f = Z80.fLogic[this.a ^= r];
	}

	or(r) {
		this.f = Z80.fLogic[this.a |= r];
	}

	cp(r) {
		this.f = Z80.aSub[0][r][this.a] >>> 8;
	}

	inc(r) {
		const v = Z80.aAdd[0][1][r];
		this.f = this.f & 1 | v >>> 8 & 0xd6;
		return v & 0xff;
	}

	dec(r) {
		const v = Z80.aSub[0][1][r];
		this.f = this.f & 1 | v >>> 8 & 0xd6;
		return v & 0xff;
	}

	rlca() {
		const v = Z80.aRl[this.a >>> 7][this.a];
		this.f = this.f & 0xc4 | v >>> 8 & 1;
		this.a = v & 0xff;
	}

	rrca() {
		const v = Z80.aRr[this.a & 1][this.a];
		this.f = this.f & 0xc4 | v >>> 8 & 1;
		this.a = v & 0xff;
	}

	rla() {
		const v = Z80.aRl[this.f & 1][this.a];
		this.f = this.f & 0xc4 | v >>> 8 & 1;
		this.a = v & 0xff;
	}

	rra() {
		const v = Z80.aRr[this.f & 1][this.a];
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

	rlc(r) {
		const v = Z80.aRl[r >>> 7][r];
		this.f = v >>> 8;
		return v & 0xff;
	}

	rrc(r) {
		const v = Z80.aRr[r & 1][r];
		this.f = v >>> 8;
		return v & 0xff;
	}

	rl(r) {
		const v = Z80.aRl[this.f & 1][r];
		this.f = v >>> 8;
		return v & 0xff;
	}

	rr(r) {
		const v = Z80.aRr[this.f & 1][r];
		this.f = v >>> 8;
		return v & 0xff;
	}

	sla(r) {
		const v = Z80.aRl[0][r];
		this.f = v >>> 8;
		return v & 0xff;
	}

	sra(r) {
		const v = Z80.aRr[r >>> 7][r];
		this.f = v >>> 8;
		return v & 0xff;
	}

	srl(r) {
		const v = Z80.aRr[0][r];
		this.f = v >>> 8;
		return v & 0xff;
	}

	bit(b, r) {
		this.f = this.f & 1 | 0x10 | ~r >>> b << 6 & 0x40;
	}

	static set(b, r) {
		return r | 1 << b;
	}

	static res(b, r) {
		return r & ~(1 << b);
	}

	ldi() {
		this.write(this.e | this.d << 8, this.read(this.l | this.h << 8));
		this.incde();
		this.inchl();
		this.f = this.f & 0xc1 | (this.decbc() !== 0) << 2;
	}

	ldd() {
		this.write(this.e | this.d << 8, this.read(this.l | this.h << 8));
		this.decde();
		this.dechl();
		this.f = this.f & 0xc1 | (this.decbc() !== 0) << 2;
	}

	cpi() {
		this.f = this.f & 1 | Z80.aSub[0][this.read(this.l | this.h << 8)][this.a] >>> 8 & 0xd2;
		this.inchl();
		this.f |= (this.decbc() !== 0) << 2;
	}

	cpd() {
		this.f = this.f & 1 | Z80.aSub[0][this.read(this.l | this.h << 8)][this.a] >>> 8 & 0xd2;
		this.dechl();
		this.f |= (this.decbc() !== 0) << 2;
	}

	ini() {
		this.write(this.l | this.h << 8, this.ioread(this.b, this.c));
		this.f = this.f & 1 | 2 | ((this.b = this.b - 1 & 0xff) === 0) << 6;
		this.inchl();
	}

	ind() {
		this.write(this.l | this.h << 8, this.ioread(this.b, this.c));
		this.f = this.f & 1 | 2 | ((this.b = this.b - 1 & 0xff) === 0) << 6;
		this.dechl();
	}

	outi() {
		this.iowrite(this.b, this.c, this.read(this.l | this.h << 8));
		this.f = this.f & 1 | 2 | ((this.b = this.b - 1 & 0xff) === 0) << 6;
		this.inchl();
	}

	outd() {
		this.iowrite(this.b, this.c, this.read(this.l | this.h << 8));
		this.f = this.f & 1 | 2 | ((this.b = this.b - 1 & 0xff) === 0) << 6;
		this.dechl();
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

	Z80.aAdd = []; // [2][0x100][0x100];
	Z80.aSub = []; // [2][0x100][0x100];
	Z80.aDaa = []; // [8][0x100];
	Z80.aRl = []; // [2][0x100];
	Z80.aRr = []; // [2][0x100];
	Z80.fLogic = new Uint8Array(0x100);

	for (i = 0; i < 2; i++) {
		Z80.aAdd[i] = [];
		for (j = 0; j < 0x100; j++)
			Z80.aAdd[i][j] = new Uint16Array(0x100);
	}
	for (i = 0; i < 2; i++) {
		Z80.aSub[i] = [];
		for (j = 0; j < 0x100; j++)
			Z80.aSub[i][j] = new Uint16Array(0x100);
	}
	for (i = 0; i < 8; i++)
		Z80.aDaa[i] = new Uint16Array(0x100);
	for (i = 0; i < 2; i++)
		Z80.aRl[i] = new Uint16Array(0x100);
	for (i = 0; i < 2; i++)
		Z80.aRr[i] = new Uint16Array(0x100);

	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++)
			for (k = 0; k < 0x100; k++) {
				r = j + k + i & 0xff;
				const v = j & k & ~r | ~j & ~k & r;
				const c = j & k | k & ~r | ~r & j;
				f = r & 0x80 | !r << 6 | c << 1 & 0x10 | v >>> 5 & 4 | c >>> 7 & 1;
				Z80.aAdd[i][k][j] = r | f << 8;
			}
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++)
			for (k = 0; k < 0x100; k++) {
				r = j - k - i & 0xff;
				const v = j & ~k & ~r | ~j & k & r;
				const c = ~j & k | k & r | r & ~j;
				f = r & 0x80 | !r << 6 | c << 1 & 0x10 | v >>> 5 & 4 | 2 | c >>> 7 & 1;
				Z80.aSub[i][k][j] = r | f << 8;
			}
	for (i = 0; i < 0x100; i++) {
		f = i ^ i >>> 4;
		f ^= f >>> 2;
		f ^= f >>> 1;
		Z80.fLogic[i] = i & 0x80 | !i << 6 | ~f << 2 & 4;
	}
	for (i = 0; i < 8; i++)
		for (j = 0; j < 0x100; j++) {
			f = i << 2 & 0x10 | i & 3;
			r = j;
			if ((f & 2) !== 0) {
				if ((f & 0x10) !== 0 && (r & 0x0f) > 5 || (r & 0x0f) > 9) {
					r = r - 6 & 0xff;
					f |= 0x10;
				}
				if ((f & 1) !== 0 && (r & 0xf0) > 0x50 || (r & 0xf0) > 0x90) {
					r = r - 0x60 & 0xff;
					f |= 1;
				}
			}
			else {
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
			}
			Z80.aDaa[i][j] = r | f << 8 | Z80.fLogic[r] << 8;
		}
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++) {
			r = j << 1 | i;
			Z80.aRl[i][j] = r | Z80.fLogic[r & 0xff] << 8;
		}
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++) {
			r = j >>> 1 | i << 7;
			Z80.aRr[i][j] = r | (Z80.fLogic[r] | j & 1) << 8;
		}
}();

