/*
 *
 *	i8080 Emulator
 *
 */

class I8080 extends Cpu {
	constructor(arg = null) {
		super(arg);
		this.b = 0;
		this.c = 0;
		this.d = 0;
		this.e = 0;
		this.h = 0;
		this.l = 0;
		this.a = 0;
		this.f = 0; // f:sz_h_p_c
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
			break;
		case 0x01: // LXI B,data16
			this.c = this.fetch();
			this.b = this.fetch();
			break;
		case 0x02: // STAX B
			this.write(this.c | this.b << 8, this.a);
			break;
		case 0x03: // INX B
			this.incbc();
			break;
		case 0x04: // INR B
			this.b = this.inc(this.b);
			break;
		case 0x05: // DCR B
			this.b = this.dec(this.b);
			break;
		case 0x06: // MVI B,data
			this.b = this.fetch();
			break;
		case 0x07: // RLC
			this.rlca();
			break;
		case 0x09: // DAD B
			this.l = (v = I8080.aAdd[0][this.c][this.l]) & 0xff;
			this.h = (v = I8080.aAdd[v >>> 8 & 1][this.b][this.h]) & 0xff;
			this.f = this.f & 0xc4 | v >>> 8 & 1;
			break;
		case 0x0a: // LDAX B
			this.a = this.read(this.c | this.b << 8);
			break;
		case 0x0b: // DCX B
			this.decbc();
			break;
		case 0x0c: // INR C
			this.c = this.inc(this.c);
			break;
		case 0x0d: // DCR C
			this.c = this.dec(this.c);
			break;
		case 0x0e: // MVI C,data
			this.c = this.fetch();
			break;
		case 0x0f: // RRC
			this.rrca();
			break;
		case 0x11: // LXI D,data16
			this.e = this.fetch();
			this.d = this.fetch();
			break;
		case 0x12: // STAX D
			this.write(this.e | this.d << 8, this.a);
			break;
		case 0x13: // INX D
			this.incde();
			break;
		case 0x14: // INR D
			this.d = this.inc(this.d);
			break;
		case 0x15: // DCR D
			this.d = this.dec(this.d);
			break;
		case 0x16: // MVI D,data
			this.d = this.fetch();
			break;
		case 0x17: // RAL
			this.rla();
			break;
		case 0x19: // DAD D
			this.l = (v = I8080.aAdd[0][this.e][this.l]) & 0xff;
			this.h = (v = I8080.aAdd[v >>> 8 & 1][this.d][this.h]) & 0xff;
			this.f = this.f & 0xc4 | v >>> 8 & 1;
			break;
		case 0x1a: // LDAX D
			this.a = this.read(this.e | this.d << 8);
			break;
		case 0x1b: // DCX D
			this.decde();
			break;
		case 0x1c: // INR E
			this.e = this.inc(this.e);
			break;
		case 0x1d: // DCR E
			this.e = this.dec(this.e);
			break;
		case 0x1e: // MVI E,data
			this.e = this.fetch();
			break;
		case 0x1f: // RAR
			this.rra();
			break;
		case 0x21: // LXI H,data16
			this.l = this.fetch();
			this.h = this.fetch();
			break;
		case 0x22: // SHLD addr
			this.write(v = this.fetch() | this.fetch() << 8, this.l);
			this.write1(v, this.h);
			break;
		case 0x23: // INX H
			this.inchl();
			break;
		case 0x24: // INR H
			this.h = this.inc(this.h);
			break;
		case 0x25: // DCR H
			this.h = this.dec(this.h);
			break;
		case 0x26: // MVI H,data
			this.h = this.fetch();
			break;
		case 0x27: // DAA
			this.a = (v = I8080.aDaa[this.f >>> 3 & 2 | this.f & 1][this.a]) & 0xff;
			this.f = v >>> 8;
			break;
		case 0x29: // DAD H
			this.l = (v = I8080.aAdd[0][this.l][this.l]) & 0xff;
			this.h = (v = I8080.aAdd[v >>> 8 & 1][this.h][this.h]) & 0xff;
			this.f = this.f & 0xc4 | v >>> 8 & 1;
			break;
		case 0x2a: // LHLD addr
			this.l = this.read(v = this.fetch() | this.fetch() << 8);
			this.h = this.read1(v);
			break;
		case 0x2b: // DCX H
			this.dechl();
			break;
		case 0x2c: // INR L
			this.l = this.inc(this.l);
			break;
		case 0x2d: // DCR L
			this.l = this.dec(this.l);
			break;
		case 0x2e: // MVI L,data
			this.l = this.fetch();
			break;
		case 0x2f: // CMA
			this.a ^= 0xff;
			this.f |= 0x12;
			break;
		case 0x31: // LXI SP,data16
			this.sp = this.fetch() | this.fetch() << 8;
			break;
		case 0x32: // STA addr
			this.write(this.fetch() | this.fetch() << 8, this.a);
			break;
		case 0x33: // INX SP
			this.sp = this.sp + 1 & 0xffff;
			break;
		case 0x34: // INR M
			this.write(v = this.l | this.h << 8, this.inc(this.read(v)));
			break;
		case 0x35: // DCR M
			this.write(v = this.l | this.h << 8, this.dec(this.read(v)));
			break;
		case 0x36: // MVI M,data
			this.write(this.l | this.h << 8, this.fetch());
			break;
		case 0x37: // STC
			this.f = this.f & 0xc4 | 1;
			break;
		case 0x39: // DAD SP
			this.l = (v = I8080.aAdd[0][this.sp & 0xff][this.l]) & 0xff;
			this.h = (v = I8080.aAdd[v >>> 8 & 1][this.sp >>> 8][this.h]) & 0xff;
			this.f = this.f & 0xc4 | v >>> 8 & 1;
			break;
		case 0x3a: // LDA addr
			this.a = this.read(this.fetch() | this.fetch() << 8);
			break;
		case 0x3b: // DCX SP
			this.sp = this.sp - 1 & 0xffff;
			break;
		case 0x3c: // INR A
			this.a = this.inc(this.a);
			break;
		case 0x3d: // DCR A
			this.a = this.dec(this.a);
			break;
		case 0x3e: // MVI A,data
			this.a = this.fetch();
			break;
		case 0x3f: // CMC
			this.f = this.f & 0xc5 ^ 1;
			break;
		case 0x40: // MOV B,B
			break;
		case 0x41: // MOV B,C
			this.b = this.c;
			break;
		case 0x42: // MOV B,D
			this.b = this.d;
			break;
		case 0x43: // MOV B,E
			this.b = this.e;
			break;
		case 0x44: // MOV B,H
			this.b = this.h;
			break;
		case 0x45: // MOV B,L
			this.b = this.l;
			break;
		case 0x46: // MOV B,M
			this.b = this.read(this.l | this.h << 8);
			break;
		case 0x47: // MOV B,A
			this.b = this.a;
			break;
		case 0x48: // MOV C,B
			this.c = this.b;
			break;
		case 0x49: // MOV C,C
			break;
		case 0x4a: // MOV C,D
			this.c = this.d;
			break;
		case 0x4b: // MOV C,E
			this.c = this.e;
			break;
		case 0x4c: // MOV C,H
			this.c = this.h;
			break;
		case 0x4d: // MOV C,L
			this.c = this.l;
			break;
		case 0x4e: // MOV C,M
			this.c = this.read(this.l | this.h << 8);
			break;
		case 0x4f: // MOV C,A
			this.c = this.a;
			break;
		case 0x50: // MOV D,B
			this.d = this.b;
			break;
		case 0x51: // MOV D,C
			this.d = this.c;
			break;
		case 0x52: // MOV D,D
			break;
		case 0x53: // MOV D,E
			this.d = this.e;
			break;
		case 0x54: // MOV D,H
			this.d = this.h;
			break;
		case 0x55: // MOV D,L
			this.d = this.l;
			break;
		case 0x56: // MOV D,(HL)
			this.d = this.read(this.l | this.h << 8);
			break;
		case 0x57: // MOV D,A
			this.d = this.a;
			break;
		case 0x58: // MOV E,B
			this.e = this.b;
			break;
		case 0x59: // MOV E,C
			this.e = this.c;
			break;
		case 0x5a: // MOV E,D
			this.e = this.d;
			break;
		case 0x5b: // MOV E,E
			break;
		case 0x5c: // MOV E,H
			this.e = this.h;
			break;
		case 0x5d: // MOV E,L
			this.e = this.l;
			break;
		case 0x5e: // MOV E,M
			this.e = this.read(this.l | this.h << 8);
			break;
		case 0x5f: // MOV E,A
			this.e = this.a;
			break;
		case 0x60: // MOV H,B
			this.h = this.b;
			break;
		case 0x61: // MOV H,C
			this.h = this.c;
			break;
		case 0x62: // MOV H,D
			this.h = this.d;
			break;
		case 0x63: // MOV H,E
			this.h = this.e;
			break;
		case 0x64: // MOV H,H
			break;
		case 0x65: // MOV H,L
			this.h = this.l;
			break;
		case 0x66: // MOV H,M
			this.h = this.read(this.l | this.h << 8);
			break;
		case 0x67: // MOV H,A
			this.h = this.a;
			break;
		case 0x68: // MOV L,B
			this.l = this.b;
			break;
		case 0x69: // MOV L,C
			this.l = this.c;
			break;
		case 0x6a: // MOV L,D
			this.l = this.d;
			break;
		case 0x6b: // MOV L,E
			this.l = this.e;
			break;
		case 0x6c: // MOV L,H
			this.l = this.h;
			break;
		case 0x6d: // MOV L,L
			break;
		case 0x6e: // MOV L,M
			this.l = this.read(this.l | this.h << 8);
			break;
		case 0x6f: // MOV L,A
			this.l = this.a;
			break;
		case 0x70: // MOV M,B
			this.write(this.l | this.h << 8, this.b);
			break;
		case 0x71: // MOV M,C
			this.write(this.l | this.h << 8, this.c);
			break;
		case 0x72: // MOV M,D
			this.write(this.l | this.h << 8, this.d);
			break;
		case 0x73: // MOV M,E
			this.write(this.l | this.h << 8, this.e);
			break;
		case 0x74: // MOV M,H
			this.write(this.l | this.h << 8, this.h);
			break;
		case 0x75: // MOV M,L
			this.write(this.l | this.h << 8, this.l);
			break;
		case 0x76: // HLT
			this.suspend();
			break;
		case 0x77: // MOV M,A
			this.write(this.l | this.h << 8, this.a);
			break;
		case 0x78: // MOV A,B
			this.a = this.b;
			break;
		case 0x79: // MOV A,C
			this.a = this.c;
			break;
		case 0x7a: // MOV A,D
			this.a = this.d;
			break;
		case 0x7b: // MOV A,E
			this.a = this.e;
			break;
		case 0x7c: // MOV A,H
			this.a = this.h;
			break;
		case 0x7d: // MOV A,L
			this.a = this.l;
			break;
		case 0x7e: // MOV A,M
			this.a = this.read(this.l | this.h << 8);
			break;
		case 0x7f: // MOV A,A
			break;
		case 0x80: // ADD B
			this.add(this.b);
			break;
		case 0x81: // ADD C
			this.add(this.c);
			break;
		case 0x82: // ADD D
			this.add(this.d);
			break;
		case 0x83: // ADD E
			this.add(this.e);
			break;
		case 0x84: // ADD H
			this.add(this.h);
			break;
		case 0x85: // ADD L
			this.add(this.l);
			break;
		case 0x86: // ADD M
			this.add(this.read(this.l | this.h << 8));
			break;
		case 0x87: // ADD A
			this.add(this.a);
			break;
		case 0x88: // ADC B
			this.adc(this.b);
			break;
		case 0x89: // ADC C
			this.adc(this.c);
			break;
		case 0x8a: // ADC D
			this.adc(this.d);
			break;
		case 0x8b: // ADC E
			this.adc(this.e);
			break;
		case 0x8c: // ADC H
			this.adc(this.h);
			break;
		case 0x8d: // ADC L
			this.adc(this.l);
			break;
		case 0x8e: // ADC M
			this.adc(this.read(this.l | this.h << 8));
			break;
		case 0x8f: // ADC A
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
		case 0x96: // SUB M
			this.sub(this.read(this.l | this.h << 8));
			break;
		case 0x97: // SUB A
			this.sub(this.a);
			break;
		case 0x98: // SBB B
			this.sbc(this.b);
			break;
		case 0x99: // SBB C
			this.sbc(this.c);
			break;
		case 0x9a: // SBB D
			this.sbc(this.d);
			break;
		case 0x9b: // SBB E
			this.sbc(this.e);
			break;
		case 0x9c: // SBB H
			this.sbc(this.h);
			break;
		case 0x9d: // SBB L
			this.sbc(this.l);
			break;
		case 0x9e: // SBB M
			this.sbc(this.read(this.l | this.h << 8));
			break;
		case 0x9f: // SBB A
			this.sbc(this.a);
			break;
		case 0xa0: // ANA B
			this.and(this.b);
			break;
		case 0xa1: // ANA C
			this.and(this.c);
			break;
		case 0xa2: // ANA D
			this.and(this.d);
			break;
		case 0xa3: // ANA E
			this.and(this.e);
			break;
		case 0xa4: // ANA H
			this.and(this.h);
			break;
		case 0xa5: // ANA L
			this.and(this.l);
			break;
		case 0xa6: // ANA M
			this.and(this.read(this.l | this.h << 8));
			break;
		case 0xa7: // ANA A
			this.and(this.a);
			break;
		case 0xa8: // XRA B
			this.xor(this.b);
			break;
		case 0xa9: // XRA C
			this.xor(this.c);
			break;
		case 0xaa: // XRA D
			this.xor(this.d);
			break;
		case 0xab: // XRA E
			this.xor(this.e);
			break;
		case 0xac: // XRA H
			this.xor(this.h);
			break;
		case 0xad: // XRA L
			this.xor(this.l);
			break;
		case 0xae: // XRA M
			this.xor(this.read(this.l | this.h << 8));
			break;
		case 0xaf: // XRA A
			this.xor(this.a);
			break;
		case 0xb0: // ORA B
			this.or(this.b);
			break;
		case 0xb1: // ORA C
			this.or(this.c);
			break;
		case 0xb2: // ORA D
			this.or(this.d);
			break;
		case 0xb3: // ORA E
			this.or(this.e);
			break;
		case 0xb4: // ORA H
			this.or(this.h);
			break;
		case 0xb5: // ORA L
			this.or(this.l);
			break;
		case 0xb6: // ORA M
			this.or(this.read(this.l | this.h << 8));
			break;
		case 0xb7: // ORA A
			this.or(this.a);
			break;
		case 0xb8: // CMP B
			this.cp(this.b);
			break;
		case 0xb9: // CMP C
			this.cp(this.c);
			break;
		case 0xba: // CMP D
			this.cp(this.d);
			break;
		case 0xbb: // CMP E
			this.cp(this.e);
			break;
		case 0xbc: // CMP H
			this.cp(this.h);
			break;
		case 0xbd: // CMP L
			this.cp(this.l);
			break;
		case 0xbe: // CMP M
			this.cp(this.read(this.l | this.h << 8));
			break;
		case 0xbf: // CMP A
			this.cp(this.a);
			break;
		case 0xc0: // RNZ
			this.ret((this.f & 0x40) === 0);
			break;
		case 0xc1: // POP B
			this.c = this.pop();
			this.b = this.pop();
			break;
		case 0xc2: // JNZ addr
			this.jp((this.f & 0x40) === 0);
			break;
		case 0xc3: // JMP addr
			this.jp(true);
			break;
		case 0xc4: // CNZ addr
			this.call((this.f & 0x40) === 0);
			break;
		case 0xc5: // PUSH B
			this.push(this.b);
			this.push(this.c);
			break;
		case 0xc6: // ADI data
			this.add(this.fetch());
			break;
		case 0xc7: // RST 00h
			this.rst(0x00);
			break;
		case 0xc8: // RZ
			this.ret((this.f & 0x40) !== 0);
			break;
		case 0xc9: // RET
			this.ret(true);
			break;
		case 0xca: // JZ addr
			this.jp((this.f & 0x40) !== 0);
			break;
		case 0xcc: // CZ addr
			this.call((this.f & 0x40) !== 0);
			break;
		case 0xcd: // CALL addr
			this.call(true);
			break;
		case 0xce: // ACI data
			this.adc(this.fetch());
			break;
		case 0xcf: // RST 08h
			this.rst(0x08);
			break;
		case 0xd0: // RNC
			this.ret((this.f & 1) === 0);
			break;
		case 0xd1: // POP D
			this.e = this.pop();
			this.d = this.pop();
			break;
		case 0xd2: // JNC addr
			this.jp((this.f & 1) === 0);
			break;
		case 0xd3: // OUT port
			this.iowrite(this.a, this.fetch(), this.a);
			break;
		case 0xd4: // CNC addr
			this.call((this.f & 1) === 0);
			break;
		case 0xd5: // PUSH D
			this.push(this.d);
			this.push(this.e);
			break;
		case 0xd6: // SUI data
			this.sub(this.fetch());
			break;
		case 0xd7: // RST 10h
			this.rst(0x10);
			break;
		case 0xd8: // RC
			this.ret((this.f & 1) !== 0);
			break;
		case 0xda: // JC addr
			this.jp((this.f & 1) !== 0);
			break;
		case 0xdb: // IN port
			this.a = this.ioread(this.a, this.fetch());
			break;
		case 0xdc: // CC addr
			this.call((this.f & 1) !== 0);
			break;
		case 0xde: // SBI data
			this.sbc(this.fetch());
			break;
		case 0xdf: // RST 18h
			this.rst(0x18);
			break;
		case 0xe0: // RPO
			this.ret((this.f & 4) === 0);
			break;
		case 0xe1: // POP H
			this.l = this.pop();
			this.h = this.pop();
			break;
		case 0xe2: // JPO addr
			this.jp((this.f & 4) === 0);
			break;
		case 0xe3: // XTHL
			v = this.read(this.sp);
			this.write(this.sp, this.l);
			this.l = v;
			v = this.read1(this.sp);
			this.write1(this.sp, this.h);
			this.h = v;
			break;
		case 0xe4: // CPO addr
			this.call((this.f & 4) === 0);
			break;
		case 0xe5: // PUSH H
			this.push(this.h);
			this.push(this.l);
			break;
		case 0xe6: // ANI data
			this.and(this.fetch());
			break;
		case 0xe7: // RST 20h
			this.rst(0x20);
			break;
		case 0xe8: // RPE
			this.ret((this.f & 4) !== 0);
			break;
		case 0xe9: // PCHL
			this.pc = this.l | this.h << 8;
			break;
		case 0xea: // JPE addr
			this.jp((this.f & 4) !== 0);
			break;
		case 0xeb: // XCHG
			v = this.d;
			this.d = this.h;
			this.h = v;
			v = this.e;
			this.e = this.l;
			this.l = v;
			break;
		case 0xec: // CPE addr
			this.call((this.f & 4) !== 0);
			break;
		case 0xee: // XRI data
			this.xor(this.fetch());
			break;
		case 0xef: // RST 28h
			this.rst(0x28);
			break;
		case 0xf0: // RP
			this.ret((this.f & 0x80) === 0);
			break;
		case 0xf1: // POP PSW
			this.f = this.pop();
			this.a = this.pop();
			break;
		case 0xf2: // JP addr
			this.jp((this.f & 0x80) === 0);
			break;
		case 0xf3: // DI
			this.iff = 0;
			break;
		case 0xf4: // CP addr
			this.call((this.f & 0x80) === 0);
			break;
		case 0xf5: // PUSH PSW
			this.push(this.a);
			this.push(this.f);
			break;
		case 0xf6: // ORI data
			this.or(this.fetch());
			break;
		case 0xf7: // RST 30h
			this.rst(0x30);
			break;
		case 0xf8: // RM
			this.ret((this.f & 0x80) !== 0);
			break;
		case 0xf9: // SPHL
			this.sp = this.l | this.h << 8;
			break;
		case 0xfa: // JM addr
			this.jp((this.f & 0x80) !== 0);
			break;
		case 0xfb: // EI
			this.iff = 3;
			break;
		case 0xfc: // CM addr
			this.call((this.f & 0x80) !== 0);
			break;
		case 0xfe: // CPI data
			this.cp(this.fetch());
			break;
		case 0xff: // RST 38h
			this.rst(0x38);
			break;
		default:
			this.undefsize = 1;
			if (this.undef)
				this.undef(this.arg);
			break;
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
				r = j - (j << 1 & 0x100) + k - (k << 1 & 0x100) + i;
				f = r & 0x80;
				if ((r & 0xff) === 0)
					f |= 0x40;
				if (r > 0x7f || r < -0x80)
					f |= 4;
				f |= (r ^ j ^ k) & 0x10;
				f |= (r ^ j << 1 ^ k << 1) >>> 8 & 1;
				I8080.aAdd[i][k][j] = r & 0xff | f << 8;
			}
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++)
			for (k = 0; k < 0x100; k++) {
				r = j - (j << 1 & 0x100) - k + (k << 1 & 0x100) - i;
				f = r & 0x80;
				if ((r & 0xff) === 0)
					f |= 0x40;
				if (r > 0x7f || r < -0x80)
					f |= 4;
				f |= (r ^ j ^ k) & 0x10;
				f |= (r ^ j << 1 ^ k << 1) >>> 8 & 1;
				I8080.aSub[i][k][j] = r & 0xff | f << 8;
			}
	for (i = 0; i < 0x100; i++) {
		f = i & 0x80;
		if (!i)
			f |= 0x40;
		r = i ^ i >>> 4;
		r ^= r >>> 2;
		r ^= r >>> 1;
		if ((r & 1) === 0)
			f |= 0x04;
		I8080.fLogic[i] = f;
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

