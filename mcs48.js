/*
 *
 *	MCS-48 Emulator
 *
 */

export default class MCS48 {
	pc = 0;
	a = 0;
	r = new Uint8Array(0x100);
	bus = 0;
	p1 = 0;
	p2 = 0;
	p4 = 0;
	p5 = 0;
	p6 = 0;
	p7 = 0;
	t0 = 0;
	t1 = 0;
	irq = 0;
	t = 0;
	cy = 0; // psw:cy,ac,f0,bs,1,s2,s1,s0
	ac = 0;
	f0 = 0;
	bs = 0;
	s = 0;
	dbf = 0;
	f1 = 0;
	tf = 0;
	mask = 0;
	a11mask = 0;
	rom = new Uint8Array(0x1000);
	cycle = 0;

	reset() {
		this.pc = 0;
		this.s = 0;
		this.bs = 0;
		this.dbf = 0;
		this.mask = 0;
		this.tf = 0;
		this.f0 = 0;
		this.f1 = 0;
		this.a11mask = 0x800;
		this.cycle = 0;
	}

	interrupt(cause = 'external') {
		let intvec = 0;
		switch (cause) {
		default:
		case 'external':
			if (~this.mask & 1)
				return false;
			this.mask &= ~1, intvec = 3;
			break;
		case 'timer':
			if (~this.mask & 2)
				return false;
			this.mask &= ~2, intvec = 7;
			break;
		}
		return this.cycle -= 2, this.push(), this.pc = intvec, this.a11mask = 0, true;
	}

	execute () {
		let v, w, op = this.fetch();
		this.cycle -= cc[op];
		switch (op) {
		case 0x00: // NOP
			return op;
		case 0x01: // IDL
			return op;
		case 0x02: // OUTL BUS,A
			return this.bus = this.a, op;
		case 0x03: // ADD A,#data
			return this.add(this.fetch()), op;
		case 0x04: // JMP address
			return this.pc = this.dbf & this.a11mask | 0x000 | this.fetch(), op;
		case 0x05: // EN I
			return this.mask |= 1, op;
		case 0x07: // DEC A
			return this.a = this.a - 1 & 0xff, op;
		case 0x08: // INS A,BUS
			return this.a = this.bus, op;
		case 0x09: // IN A,P1
			return this.a = this.p1, op;
		case 0x0a: // IN A,P2
			return this.a = this.p2, op;
		case 0x0c: // MOVD A,P4
			return this.a = this.p4, op;
		case 0x0d: // MOVD A,P5
			return this.a = this.p5, op;
		case 0x0e: // MOVD A,P6
			return this.a = this.p6, op;
		case 0x0f: // MOVD A,P7
			return this.a = this.p7, op;
		case 0x10: // INC @R0
			return this.r[this.r[this.bs | 0]] += 1, op;
		case 0x11: // INC @R1
			return this.r[this.r[this.bs | 1]] += 1, op;
		case 0x12: // JB0 address
			return v = this.pc & 0xf00, v |= this.fetch(), this.a & 1 && (this.pc = v), op;
		case 0x13: // ADDC A,#data
			return this.addc(this.fetch()), op;
		case 0x14: // CALL address
			return v = this.dbf & this.a11mask | 0x000 | this.fetch(), this.push(), this.pc = v, op;
		case 0x15: // DIS I
			return this.mask &= ~1, op;
		case 0x16: // JTF address
			return v = this.pc & 0xf00, v |= this.fetch(), this.tf && (this.pc = v), this.tf = 0, op;
		case 0x17: // INC A
			return this.a = this.a + 1 & 0xff, op;
		case 0x18: // INC R0
			return this.r[this.bs | 0] += 1, op;
		case 0x19: // INC R1
			return this.r[this.bs | 1] += 1, op;
		case 0x1a: // INC R2
			return this.r[this.bs | 2] += 1, op;
		case 0x1b: // INC R3
			return this.r[this.bs | 3] += 1, op;
		case 0x1c: // INC R4
			return this.r[this.bs | 4] += 1, op;
		case 0x1d: // INC R5
			return this.r[this.bs | 5] += 1, op;
		case 0x1e: // INC R6
			return this.r[this.bs | 6] += 1, op;
		case 0x1f: // INC R7
			return this.r[this.bs | 7] += 1, op;
		case 0x20: // XCH A,@R0
			return v = this.r[this.bs | 0], w = this.r[v], this.r[v] = this.a, this.a = w, op;
		case 0x21: // XCH A,@R1
			return v = this.r[this.bs | 1], w = this.r[v], this.r[v] = this.a, this.a = w, op;
		case 0x23: // MOV A,#data
			return this.a = this.fetch(), op;
		case 0x24: // JMP address
			return this.pc = this.dbf & this.a11mask | 0x100 | this.fetch(), op;
		case 0x25: // EN TCNTI
			return this.mask |= 2, op;
		case 0x26: // JNT0 address
			return v = this.pc & 0xf00, v |= this.fetch(), !this.t0 && (this.pc = v), op;
		case 0x27: // CLR A
			return this.a = 0, op;
		case 0x28: // XCH A,R0
			return v = this.bs | 0, w = this.r[v], this.r[v] = this.a, this.a = w, op;
		case 0x29: // XCH A,R1
			return v = this.bs | 1, w = this.r[v], this.r[v] = this.a, this.a = w, op;
		case 0x2a: // XCH A,R2
			return v = this.bs | 2, w = this.r[v], this.r[v] = this.a, this.a = w, op;
		case 0x2b: // XCH A,R3
			return v = this.bs | 3, w = this.r[v], this.r[v] = this.a, this.a = w, op;
		case 0x2c: // XCH A,R4
			return v = this.bs | 4, w = this.r[v], this.r[v] = this.a, this.a = w, op;
		case 0x2d: // XCH A,R5
			return v = this.bs | 5, w = this.r[v], this.r[v] = this.a, this.a = w, op;
		case 0x2e: // XCH A,R6
			return v = this.bs | 6, w = this.r[v], this.r[v] = this.a, this.a = w, op;
		case 0x2f: // XCH A,R7
			return v = this.bs | 7, w = this.r[v], this.r[v] = this.a, this.a = w, op;
		case 0x30: // XCHD A,@R0
			return v = this.r[this.bs | 0], w = this.r[v], this.r[v] = this.r[v] & 0xf0 | this.a & 0xf, this.a = this.a & 0xf0 | w & 0xf, op;
		case 0x31: // XCHD A,@R1
			return v = this.r[this.bs | 1], w = this.r[v], this.r[v] = this.r[v] & 0xf0 | this.a & 0xf, this.a = this.a & 0xf0 | w & 0xf, op;
		case 0x32: // JB1 address
			return v = this.pc & 0xf00, v |= this.fetch(), this.a & 2 && (this.pc = v), op;
		case 0x34: // CALL address
			return v = this.dbf & this.a11mask | 0x100 | this.fetch(), this.push(), this.pc = v, op;
		case 0x35: // DIS TCNTI
			return this.mask &= ~2, op;
		case 0x36: // JT0 address
			return v = this.pc & 0xf00, v |= this.fetch(), this.t0 && (this.pc = v), op;
		case 0x37: // CPL A
			return this.a ^= 0xff, op;
		case 0x39: // OUTL P1,A
			return this.p1 = this.a, op;
		case 0x3a: // OUTL P2,A
			return this.p2 = this.a, op;
		case 0x3c: // MOVD P4,A
			return this.p4 = this.a & 0xf, op;
		case 0x3d: // MOVD P5,A
			return this.p5 = this.a & 0xf, op;
		case 0x3e: // MOVD P6,A
			return this.p6 = this.a & 0xf, op;
		case 0x3f: // MOVD P7,A
			return this.p7 = this.a & 0xf, op;
		case 0x40: // ORL A,@R0
			return this.a |= this.r[this.r[this.bs | 0]], op;
		case 0x41: // ORL A,@R1
			return this.a |= this.r[this.r[this.bs | 1]], op;
		case 0x42: // MOV A,T
			return this.a = this.t, op;
		case 0x43: // ORL A,#data
			return this.a |= this.fetch(), op;
		case 0x44: // JMP address
			return this.pc = this.dbf & this.a11mask | 0x200 | this.fetch(), op;
		case 0x45: // STRT CNT
			return op;
		case 0x46: // JNT1 address
			return v = this.pc & 0xf00, v |= this.fetch(), !this.t1 && (this.pc = v), op;
		case 0x47: // SWAP A
			return this.a = this.a << 4 & 0xf0 | this.a >> 4, op;
		case 0x48: // ORL A,R0
			return this.a |= this.r[this.bs | 0], op;
		case 0x49: // ORL A,R1
			return this.a |= this.r[this.bs | 1], op;
		case 0x4a: // ORL A,R2
			return this.a |= this.r[this.bs | 2], op;
		case 0x4b: // ORL A,R3
			return this.a |= this.r[this.bs | 3], op;
		case 0x4c: // ORL A,R4
			return this.a |= this.r[this.bs | 4], op;
		case 0x4d: // ORL A,R5
			return this.a |= this.r[this.bs | 5], op;
		case 0x4e: // ORL A,R6
			return this.a |= this.r[this.bs | 6], op;
		case 0x4f: // ORL A,R7
			return this.a |= this.r[this.bs | 7], op;
		case 0x50: // ANL A,@R0
			return this.a &= this.r[this.r[this.bs | 0]], op;
		case 0x51: // ANL A,@R1
			return this.a &= this.r[this.r[this.bs | 1]], op;
		case 0x52: // JB2 address
			return v = this.pc & 0xf00, v |= this.fetch(), this.a & 4 && (this.pc = v), op;
		case 0x53: // ANL A,#data
			return this.a &= this.fetch(), op;
		case 0x54: // CALL address
			return v = this.dbf & this.a11mask | 0x200 | this.fetch(), this.push(), this.pc = v, op;
		case 0x55: // STRT T
			return op;
		case 0x56: // JT1 address
			return v = this.pc & 0xf00, v |= this.fetch(), this.t1 && (this.pc = v), op;
		case 0x57: // DA A
			return this.daa(), op;
		case 0x58: // ANL A,R0
			return this.a &= this.r[this.bs | 0], op;
		case 0x59: // ANL A,R1
			return this.a &= this.r[this.bs | 1], op;
		case 0x5a: // ANL A,R2
			return this.a &= this.r[this.bs | 2], op;
		case 0x5b: // ANL A,R3
			return this.a &= this.r[this.bs | 3], op;
		case 0x5c: // ANL A,R4
			return this.a &= this.r[this.bs | 4], op;
		case 0x5d: // ANL A,R5
			return this.a &= this.r[this.bs | 5], op;
		case 0x5e: // ANL A,R6
			return this.a &= this.r[this.bs | 6], op;
		case 0x5f: // ANL A,R7
			return this.a &= this.r[this.bs | 7], op;
		case 0x60: // ADD A,@R0
			return this.add(this.r[this.r[this.bs | 0]]), op;
		case 0x61: // ADD A,@R1
			return this.add(this.r[this.r[this.bs | 1]]), op;
		case 0x62: // MOV T,A
			return this.t = this.a, op;
		case 0x64: // JMP address
			return this.pc = this.dbf & this.a11mask | 0x300 | this.fetch(), op;
		case 0x65: // STOP TCNT
			return op;
		case 0x67: // RRC A
			return v = this.cy << 8 | this.a, this.a = v >> 1, this.cy = v & 1, op;
		case 0x68: // ADD A,R0
			return this.add(this.r[this.bs | 0]), op;
		case 0x69: // ADD A,R1
			return this.add(this.r[this.bs | 1]), op;
		case 0x6a: // ADD A,R2
			return this.add(this.r[this.bs | 2]), op;
		case 0x6b: // ADD A,R3
			return this.add(this.r[this.bs | 3]), op;
		case 0x6c: // ADD A,R4
			return this.add(this.r[this.bs | 4]), op;
		case 0x6d: // ADD A,R5
			return this.add(this.r[this.bs | 5]), op;
		case 0x6e: // ADD A,R6
			return this.add(this.r[this.bs | 6]), op;
		case 0x6f: // ADD A,R7
			return this.add(this.r[this.bs | 7]), op;
		case 0x70: // ADDC A,@R0
			return this.addc(this.r[this.r[this.bs | 0]]), op;
		case 0x71: // ADDC A,@R1
			return this.addc(this.r[this.r[this.bs | 1]]), op;
		case 0x72: // JB3 address
			return v = this.pc & 0xf00, v |= this.fetch(), this.a & 8 && (this.pc = v), op;
		case 0x74: // CALL address
			return v = this.dbf & this.a11mask | 0x300 | this.fetch(), this.push(), this.pc = v, op;
		case 0x75: // ENT0 CLK
			return op;
		case 0x76: // JF1 address
			return v = this.pc & 0xf00, v |= this.fetch(), this.f1 && (this.pc = v), op;
		case 0x77: // RR A
			return this.a = this.a << 7 & 0x80 | this.a >> 1, op;
		case 0x78: // ADDC A,R0
			return this.addc(this.r[this.bs | 0]), op;
		case 0x79: // ADDC A,R1
			return this.addc(this.r[this.bs | 1]), op;
		case 0x7a: // ADDC A,R2
			return this.addc(this.r[this.bs | 2]), op;
		case 0x7b: // ADDC A,R3
			return this.addc(this.r[this.bs | 3]), op;
		case 0x7c: // ADDC A,R4
			return this.addc(this.r[this.bs | 4]), op;
		case 0x7d: // ADDC A,R5
			return this.addc(this.r[this.bs | 5]), op;
		case 0x7e: // ADDC A,R6
			return this.addc(this.r[this.bs | 6]), op;
		case 0x7f: // ADDC A,R7
			return this.addc(this.r[this.bs | 7]), op;
		case 0x80: // MOVX A,@R0
			return this.a = this.read(this.r[this.bs | 0]), op;
		case 0x81: // MOVX A,@R1
			return this.a = this.read(this.r[this.bs | 1]), op;
		case 0x83: // RET
			return this.ret(false),  op;
		case 0x84: // JMP address
			return this.pc = this.dbf & this.a11mask | 0x400 | this.fetch(), op;
		case 0x85: // CLR F0
			return this.f0 = 0, op;
		case 0x86: // JNI address
			return v = this.pc & 0xf00, v |= this.fetch(), this.irq && (this.pc = v), op;
		case 0x88: // ORL BUS,#data
			return this.bus |= this.fetch(), op;
		case 0x89: // ORL P1,#data
			return this.p1 |= this.fetch(), op;
		case 0x8a: // ORL P2,#data
			return this.p2 |= this.fetch(), op;
		case 0x8c: // ORLD P4,A
			return this.p4 |= this.a & 0xf, op;
		case 0x8d: // ORLD P5,A
			return this.p5 |= this.a & 0xf, op;
		case 0x8e: // ORLD P6,A
			return this.p6 |= this.a & 0xf, op;
		case 0x8f: // ORLD P7,A
			return this.p7 |= this.a & 0xf, op;
		case 0x90: // MOVX @R0,A
			return this.write(this.r[this.bs | 0], this.a), op;
		case 0x91: // MOVX @R1,A
			return this.write(this.r[this.bs | 1], this.a), op;
		case 0x92: // JB4 address
			return v = this.pc & 0xf00, v |= this.fetch(), this.a & 0x10 && (this.pc = v), op;
		case 0x93: // RETR
			return this.ret(true), this.a11mask = 0x800, op;
		case 0x94: // CALL address
			return v = this.dbf & this.a11mask | 0x400 | this.fetch(), this.push(), this.pc = v, op;
		case 0x95: // CPL F0
			return this.f0 ^= 1, op;
		case 0x96: // JNZ address
			return v = this.pc & 0xf00, v |= this.fetch(), this.a && (this.pc = v), op;
		case 0x97: // CLR C
			return this.cy = 0, op;
		case 0x98: // ANL BUS,#data
			return this.bus &= this.fetch(), op;
		case 0x99: // ANL P1,#data
			return this.p1 &= this.fetch(), op;
		case 0x9a: // ANL P2,#data
			return this.p2 &= this.fetch(), op;
		case 0x9c: // ANLD P4,A
			return this.p4 &= this.a, op;
		case 0x9d: // ANLD P5,A
			return this.p5 &= this.a, op;
		case 0x9e: // ANLD P6,A
			return this.p6 &= this.a, op;
		case 0x9f: // ANLD P7,A
			return this.p7 &= this.a, op;
		case 0xa0: // MOV @R0,A
			return this.r[this.r[this.bs | 0]] = this.a, op;
		case 0xa1: // MOV @R1,A
			return this.r[this.r[this.bs | 1]] = this.a, op;
		case 0xa3: // MOVP A,@A
			return this.a = this.rom[this.pc & 0xf00 | this.a], op;
		case 0xa4: // JMP address
			return this.pc = this.dbf & this.a11mask | 0x500 | this.fetch(), op;
		case 0xa5: // CLR F1
			return this.f1 = 0, op;
		case 0xa7: // CPL C
			return this.cy ^= 1, op;
		case 0xa8: // MOV R0,A
			return this.r[this.bs | 0] = this.a, op;
		case 0xa9: // MOV R1,A
			return this.r[this.bs | 1] = this.a, op;
		case 0xaa: // MOV R2,A
			return this.r[this.bs | 2] = this.a, op;
		case 0xab: // MOV R3,A
			return this.r[this.bs | 3] = this.a, op;
		case 0xac: // MOV R4,A
			return this.r[this.bs | 4] = this.a, op;
		case 0xad: // MOV R5,A
			return this.r[this.bs | 5] = this.a, op;
		case 0xae: // MOV R6,A
			return this.r[this.bs | 6] = this.a, op;
		case 0xaf: // MOV R7,A
			return this.r[this.bs | 7] = this.a, op;
		case 0xb0: // MOV @R0,#data
			return this.r[this.r[this.bs | 0]] = this.fetch(), op;
		case 0xb1: // MOV @R1,#data
			return this.r[this.r[this.bs | 1]] = this.fetch(), op;
		case 0xb2: // JB5 address
			return v = this.pc & 0xf00, v |= this.fetch(), this.a & 0x20 && (this.pc = v), op;
		case 0xb3: // JMPP @A
			return this.pc = this.pc & 0xf00 | this.rom[this.pc & 0xf00 | this.a], op;
		case 0xb4: // CALL address
			return v = this.dbf & this.a11mask | 0x500 | this.fetch(), this.push(), this.pc = v, op;
		case 0xb5: // CPL F1
			return this.f1 ^= 1, op;
		case 0xb6: // JF0 address
			return v = this.pc & 0xf00, v |= this.fetch(), this.f0 && (this.pc = v), op;
		case 0xb8: // MOV R0,#data
			return this.r[this.bs | 0] = this.fetch(), op;
		case 0xb9: // MOV R1,#data
			return this.r[this.bs | 1] = this.fetch(), op;
		case 0xba: // MOV R2,#data
			return this.r[this.bs | 2] = this.fetch(), op;
		case 0xbb: // MOV R3,#data
			return this.r[this.bs | 3] = this.fetch(), op;
		case 0xbc: // MOV R4,#data
			return this.r[this.bs | 4] = this.fetch(), op;
		case 0xbd: // MOV R5,#data
			return this.r[this.bs | 5] = this.fetch(), op;
		case 0xbe: // MOV R6,#data
			return this.r[this.bs | 6] = this.fetch(), op;
		case 0xbf: // MOV R7,#data
			return this.r[this.bs | 7] = this.fetch(), op;
		case 0xc4: // JMP address
			return this.pc = this.dbf & this.a11mask | 0x600 | this.fetch(), op;
		case 0xc5: // SEL RB0
			return this.bs = 0, op;
		case 0xc6: // JZ address
			return v = this.pc & 0xf00, v |= this.fetch(), !this.a && (this.pc = v), op;
		case 0xc7: // MOV A,PSW
			return this.a = this.cy << 7 | this.ac << 6 | this.f0 << 5 | (this.bs !== 0) << 4 | 8 | this.s, op;
		case 0xc8: // DEC R0
			return this.r[this.bs | 0] -= 1, op;
		case 0xc9: // DEC R1
			return this.r[this.bs | 1] -= 1, op;
		case 0xca: // DEC R2
			return this.r[this.bs | 2] -= 1, op;
		case 0xcb: // DEC R3
			return this.r[this.bs | 3] -= 1, op;
		case 0xcc: // DEC R4
			return this.r[this.bs | 4] -= 1, op;
		case 0xcd: // DEC R5
			return this.r[this.bs | 5] -= 1, op;
		case 0xce: // DEC R6
			return this.r[this.bs | 6] -= 1, op;
		case 0xcf: // DEC R7
			return this.r[this.bs | 7] -= 1, op;
		case 0xd0: // XRL A,@R0
			return this.a ^= this.r[this.r[this.bs | 0]], op;
		case 0xd1: // XRL A,@R1
			return this.a ^= this.r[this.r[this.bs | 1]], op;
		case 0xd2: // JB6 address
			return v = this.pc & 0xf00, v |= this.fetch(), this.a & 0x40 && (this.pc = v), op;
		case 0xd3: // XRL A,#data
			return this.a ^= this.fetch(), op;
		case 0xd4: // CALL address
			return v = this.dbf & this.a11mask | 0x600 | this.fetch(), this.push(), this.pc = v, op;
		case 0xd5: // SEL RB1
			return this.bs = 24, op;
		case 0xd7: // MOV PSW,A
			return this.cy = this.a >> 7, this.ac = this.a >> 6 & 1, this.f0 = this.a >> 5 & 1, this.bs = (this.a >> 4 & 1) * 24, this.s = this.a & 7, op;
		case 0xd8: // XRL A,R0
			return this.a ^= this.r[this.bs | 0], op;
		case 0xd9: // XRL A,R1
			return this.a ^= this.r[this.bs | 1], op;
		case 0xda: // XRL A,R2
			return this.a ^= this.r[this.bs | 2], op;
		case 0xdb: // XRL A,R3
			return this.a ^= this.r[this.bs | 3], op;
		case 0xdc: // XRL A,R4
			return this.a ^= this.r[this.bs | 4], op;
		case 0xdd: // XRL A,R5
			return this.a ^= this.r[this.bs | 5], op;
		case 0xde: // XRL A,R6
			return this.a ^= this.r[this.bs | 6], op;
		case 0xdf: // XRL A,R7
			return this.a ^= this.r[this.bs | 7], op;
		case 0xe3: // MOVP3 A,@A
			return this.a = this.rom[0x300 | this.a], op;
		case 0xe4: // JMP address
			return this.pc = this.dbf & this.a11mask | 0x700 | this.fetch(), op;
		case 0xe5: // SEL MB0
			return this.dbf = 0, op;
		case 0xe6: // JNC address
			return v = this.pc & 0xf00, v |= this.fetch(), !this.cy && (this.pc = v), op;
		case 0xe7: // RL A
			return this.a = this.a << 1 & 0xfe | this.a >> 7, op;
		case 0xe8: // DJNZ R0,address
			return v = this.pc & 0xf00, v |= this.fetch(), (this.r[this.bs | 0] -= 1) && (this.pc = v), op;
		case 0xe9: // DJNZ R1,address
			return v = this.pc & 0xf00, v |= this.fetch(), (this.r[this.bs | 1] -= 1) && (this.pc = v), op;
		case 0xea: // DJNZ R2,address
			return v = this.pc & 0xf00, v |= this.fetch(), (this.r[this.bs | 2] -= 1) && (this.pc = v), op;
		case 0xeb: // DJNZ R3,address
			return v = this.pc & 0xf00, v |= this.fetch(), (this.r[this.bs | 3] -= 1) && (this.pc = v), op;
		case 0xec: // DJNZ R4,address
			return v = this.pc & 0xf00, v |= this.fetch(), (this.r[this.bs | 4] -= 1) && (this.pc = v), op;
		case 0xed: // DJNZ R5,address
			return v = this.pc & 0xf00, v |= this.fetch(), (this.r[this.bs | 5] -= 1) && (this.pc = v), op;
		case 0xee: // DJNZ R6,address
			return v = this.pc & 0xf00, v |= this.fetch(), (this.r[this.bs | 6] -= 1) && (this.pc = v), op;
		case 0xef: // DJNZ R7,address
			return v = this.pc & 0xf00, v |= this.fetch(), (this.r[this.bs | 7] -= 1) && (this.pc = v), op;
		case 0xf0: // MOV A,@R0
			return this.a = this.r[this.r[this.bs | 0]], op;
		case 0xf1: // MOV A,@R1
			return this.a = this.r[this.r[this.bs | 1]], op;
		case 0xf2: // JB7 address
			return v = this.pc & 0xf00, v |= this.fetch(), this.a & 0x80 && (this.pc = v), op;
		case 0xf4: // CALL address
			return v = this.dbf & this.a11mask | 0x700 | this.fetch(), this.push(), this.pc = v, op;
		case 0xf5: // SEL MB1
			return this.dbf = 0x800, op;
		case 0xf6: // JC address
			return v = this.pc & 0xf00, v |= this.fetch(), this.cy && (this.pc = v), op;
		case 0xf7: // RLC A
			return v = this.a << 1 | this.cy, this.a = v & 0xff, this.cy = v >> 8, op;
		case 0xf8: // MOV A,R0
			return this.a = this.r[this.bs | 0], op;
		case 0xf9: // MOV A,R1
			return this.a = this.r[this.bs | 1], op;
		case 0xfa: // MOV A,R2
			return this.a = this.r[this.bs | 2], op;
		case 0xfb: // MOV A,R3
			return this.a = this.r[this.bs | 3], op;
		case 0xfc: // MOV A,R4
			return this.a = this.r[this.bs | 4], op;
		case 0xfd: // MOV A,R5
			return this.a = this.r[this.bs | 5], op;
		case 0xfe: // MOV A,R6
			return this.a = this.r[this.bs | 6], op;
		case 0xff: // MOV A,R7
			return this.a = this.r[this.bs | 7], op;
		default: // ILLEGAL
			return -1;
		}
	}

	add(src) {
		const r = this.a + src & 0xff, c = this.a & src | src & ~r | ~r & this.a;
		this.a = r, this.cy = c >> 7 & 1, this.ac = c >> 3 & 1;
	}

	addc(src) {
		const r = this.a + src + this.cy & 0xff, c = this.a & src | src & ~r | ~r & this.a;
		this.a = r, this.cy = c >> 7 & 1, this.ac = c >> 3 & 1;
	}

	daa() {
		let r = this.a;
		if ((this.ac || (r & 0xf) > 9) && (r += 6) >= 0x100)
			this.cy |= 1;
		if (this.cy || (r & 0xf0) > 0x90)
			r += 0x60, this.cy |= 1;
		this.a = r & 0xff;
	}

	push() {
		this.pc |= this.cy << 15 | this.ac << 14 | this.f0 << 13 | (this.bs !== 0) << 12;
		this.r[8 + this.s * 2] = this.pc & 0xff, this.r[9 + this.s * 2] = this.pc >> 8, this.s = this.s + 1 & 7;
	}

	ret(psw) {
		this.s = this.s - 1 & 7, this.pc = this.r[8 + this.s * 2] | this.r[9 + this.s * 2] << 8;
		psw && (this.cy = this.pc >> 15, this.ac = this.pc >> 14 & 1, this.f0 = this.pc >> 13 & 1, this.bs = (this.pc >> 12 & 1) * 24), this.pc &= 0xfff;
	}

	fetch() {
		const data = this.rom[this.pc];
		return this.pc = this.pc + 1 & 0x7ff | this.pc & 0x800, data;
	}

	read() {
		return 0xff;
	}

	write() {}
}

const cc = Uint8Array.of(
	 1, 1, 2, 2, 2, 1, 0, 1, 2, 2, 2, 0, 2, 2, 2, 2,
	 1, 1, 2, 2, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 0, 2, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 2, 0, 2, 1, 2, 1, 0, 2, 2, 0, 2, 2, 2, 2,
	 1, 1, 1, 2, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 2, 2, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 1, 0, 2, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 2, 0, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 2, 2, 0, 2, 2, 1, 2, 0, 2, 2, 2, 0, 2, 2, 2, 2,
	 2, 2, 2, 2, 2, 1, 2, 1, 2, 2, 2, 0, 2, 2, 2, 2,
	 1, 1, 0, 2, 2, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 2, 2, 2, 2, 2, 1, 2, 0, 2, 2, 2, 2, 2, 2, 2, 2,
	 0, 0, 0, 0, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 2, 2, 2, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 0, 0, 0, 2, 2, 1, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2,
	 1, 1, 2, 0, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1);

