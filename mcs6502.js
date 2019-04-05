/*
 *
 *	MCS6502 Emulator
 *
 */

class MCS6502 extends Cpu {
	constructor(arg = null) {
		super(arg);
		this.a = 0;
		this.iy = 0;
		this.ix = 0;
		this.sp = 0;
		this.ccr = 0; // ccr:nv1bdizc
	}

	reset() {
		super.reset();
		this.ccr |= 0x24;
		this.sp = 0xff;
		this.pc = this.read(0xfffc) | this.read(0xfffd) << 8;
	}

	interrupt() {
		if (!super.interrupt() || (this.ccr & 4) !== 0)
			return false;
		this.push(this.pc >>> 8);
		this.push(this.pc & 0xff);
		this.push(this.ccr &= ~0x10);
		this.ccr |= 4;
		this.pc = this.read(0xfffe) | this.read(0xffff) << 8;
		return true;
	}

	non_maskable_interrupt() {
		if (!super.interrupt())
			return false;
		this.push(this.pc >>> 8);
		this.push(this.pc & 0xff);
		this.push(this.ccr &= ~0x10);
		this.ccr |= 4;
		this.pc = this.read(0xfffa) | this.read(0xfffb) << 8;
		return true;
	}

	_execute() {
		let ea, v;

		switch (this.fetch()) {
		case 0x00: // BRK
			this.fetch();
			this.push(this.pc >>> 8);
			this.push(this.pc & 0xff);
			this.push(this.ccr |= 0x10);
			this.ccr |= 0x04;
			this.pc = this.read(0xfffe) | this.read(0xffff) << 8;
			break;
		case 0x01: // ORA (n,X)
			this.ora(this.indx());
			break;
		case 0x05: // ORA n
			this.ora(this.fetch());
			break;
		case 0x06: // ASL
			this.asl(this.fetch());
			break;
		case 0x08: // PHP
			this.push(this.ccr);
			break;
		case 0x09: // ORA #n
			this.ora(null);
			break;
		case 0x0a: // ASLA
			this.a = (v = MCS6502.aRl[0][this.a]) & 0xff;
			this.ccr = this.ccr & ~0x83 | v >>> 8;
			break;
		case 0x0d: // ORA nn
			this.ora(this.abs());
			break;
		case 0x0e: // ASL n
			this.asl(this.abs());
			break;
		case 0x10: // BPL
			this.bcc((this.ccr & 0x80) === 0);
			break;
		case 0x11: // ORA (n),Y
			this.ora(this.indy());
			break;
		case 0x15: // ORA n,X
			this.ora(this.zpx());
			break;
		case 0x16: // ASL n,X
			this.asl(this.zpx());
			break;
		case 0x18: // CLC
			this.ccr &= ~1;
			break;
		case 0x19: // ORA nn,Y
			this.ora(this.absy());
			break;
		case 0x1d: // ORA nn,X
			this.ora(this.absx());
			break;
		case 0x1e: // ASL nn,X
			this.asl(this.absx());
			break;
		case 0x20: // JSR nn
			ea = this.abs();
			this.push(this.pc >>> 8);
			this.push(this.pc & 0xff);
			this.pc = ea;
			break;
		case 0x21: // AND (n,X)
			this.and(this.indx());
			break;
		case 0x24: // BIT n
			this.bit(this.fetch());
			break;
		case 0x25: // AND n
			this.and(this.fetch());
			break;
		case 0x26: // ROL n
			this.rol(this.fetch());
			break;
		case 0x28: // PLP
			this.ccr = this.pull() | 0x20;
			break;
		case 0x29: // AND #n
			this.and(null);
			break;
		case 0x2a: // ROLA
			this.a = (v = MCS6502.aRl[this.ccr & 1][this.a]) & 0xff;
			this.ccr = this.ccr & ~0x83 | v >>> 8;
			break;
		case 0x2c: // BIT nn
			this.bit(this.abs());
			break;
		case 0x2d: // AND nn
			this.and(this.abs());
			break;
		case 0x2e: // ROL nn
			this.rol(this.abs());
			break;
		case 0x30: // BMI
			this.bcc((this.ccr & 0x80) !== 0);
			break;
		case 0x31: // AND (n),Y
			this.and(this.indy());
			break;
		case 0x35: // AND n,X
			this.and(this.zpx());
			break;
		case 0x36: // ROL n,X
			this.rol(this.zpx());
			break;
		case 0x38: // SEC
			this.ccr |= 1;
			break;
		case 0x39: // AND nn,Y
			this.and(this.absy());
			break;
		case 0x3d: // AND nn,X
			this.and(this.absx());
			break;
		case 0x3e: // ROL nn,X
			this.rol(this.absx());
			break;
		case 0x40: // RTI
			this.ccr = this.pull() | 0x20;
			this.pc = this.pull();
			this.pc |= this.pull() << 8;
			break;
		case 0x41: // EOR (n,X)
			this.eor(this.indx());
			break;
		case 0x45: // EOR n
			this.eor(this.fetch());
			break;
		case 0x46: // LSR n
			this.lsr(this.fetch());
			break;
		case 0x48: // PHA
			this.push(this.a);
			break;
		case 0x49: // EOR #n
			this.eor(null);
			break;
		case 0x4a: // LSRA
			this.a = (v = MCS6502.aRr[0][this.a]) & 0xff;
			this.ccr = this.ccr & ~0x83 | v >>> 8;
			break;
		case 0x4c: // JMP nn
			this.pc = this.abs();
			break;
		case 0x4d: // EOR nn
			this.eor(this.abs());
			break;
		case 0x4e: // LSR nn
			this.lsr(this.abs());
			break;
		case 0x50: // BVC
			this.bcc((this.ccr & 0x40) === 0);
			break;
		case 0x51: // EOR (n),Y
			this.eor(this.indy());
			break;
		case 0x55: // EOR n,X
			this.eor(this.zpx());
			break;
		case 0x56: // LSR n,X
			this.lsr(this.zpx());
			break;
		case 0x58: // CLI
			this.ccr &= ~4;
			break;
		case 0x59: // EOR nn,Y
			this.eor(this.absy());
			break;
		case 0x5d: // EOR nn,X
			this.eor(this.absx());
			break;
		case 0x5e: // LSR nn,X
			this.lsr(this.absx());
			break;
		case 0x60: // RTS
			this.pc = this.pull();
			this.pc |= this.pull() << 8;
			break;
		case 0x61: // ADC (n,X)
			this.adc(this.indx());
			break;
		case 0x65: // ADC n
			this.adc(this.fetch());
			break;
		case 0x66: // ROR n
			this.ror(this.fetch());
			break;
		case 0x68: // PLA
			this.a = this.pull();
			break;
		case 0x69: // ADC #n
			this.adc(null);
			break;
		case 0x6a: // RORA
			this.a = (v = MCS6502.aRr[this.ccr & 1][this.a]) & 0xff;
			this.ccr = this.ccr & ~0x83 | v >>> 8;
			break;
		case 0x6c: // JMP (nn)
			this.pc = this.read(ea = this.abs()) | this.read(ea + 1 & 0xffff) << 8;
			break;
		case 0x6d: // ADC nn
			this.adc(this.abs());
			break;
		case 0x6e: // ROR nn
			this.ror(this.abs());
			break;
		case 0x70: // BVS
			this.bcc((this.ccr & 0x40) !== 0);
			break;
		case 0x71: // ADC (n),Y
			this.adc(this.indy());
			break;
		case 0x75: // ADC n,X
			this.adc(this.zpx());
			break;
		case 0x76: // ROR n,X
			this.ror(this.zpx());
			break;
		case 0x78: // SEI
			this.ccr |= 4;
			break;
		case 0x79: // ADC nn,Y
			this.adc(this.absy());
			break;
		case 0x7d: // ADC nn,X
			this.adc(this.absx());
			break;
		case 0x7e: // ROR nn,X
			this.ror(this.absx());
			break;
		case 0x81: // STA (n,X)
			this.write(this.indx(), this.a);
			break;
		case 0x84: // STY n
			this.write(this.fetch(), this.iy);
			break;
		case 0x85: // STA n
			this.write(this.fetch(), this.a);
			break;
		case 0x86: // STX n
			this.write(this.fetch(), this.ix);
			break;
		case 0x88: // DEY
			this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.iy = this.iy - 1 & 0xff];
			break;
		case 0x8a: // TXA
			this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.a = this.ix];
			break;
		case 0x8c: // STY nn
			this.write(this.abs(), this.iy);
			break;
		case 0x8d: // STA nn
			this.write(this.abs(), this.a);
			break;
		case 0x8e: // STX nn
			this.write(this.abs(), this.ix);
			break;
		case 0x90: // BCC
			this.bcc((this.ccr & 1) === 0);
			break;
		case 0x91: // STA (n),Y
			this.write(this.indy(), this.a);
			break;
		case 0x94: // STY n,X
			this.write(this.zpx(), this.iy);
			break;
		case 0x95: // STA n,X
			this.write(this.zpx(), this.a);
			break;
		case 0x96: // STX n,Y
			this.write(this.zpy(), this.ix);
			break;
		case 0x98: // TYA
			this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.a = this.iy];
			break;
		case 0x99: // STA nn,Y
			this.write(this.absy(), this.a);
			break;
		case 0x9a: // TXS
			this.sp = this.ix;
			break;
		case 0x9d: // STA nn,X
			this.write(this.absx(), this.a);
			break;
		case 0xa0: // LDY #n
			this.ldy(null);
			break;
		case 0xa1: // LDA (n,X)
			this.lda(this.indx());
			break;
		case 0xa2: // LDX #n
			this.ldx(null);
			break;
		case 0xa4: // LDY n
			this.ldy(this.fetch());
			break;
		case 0xa5: // LDA n
			this.lda(this.fetch());
			break;
		case 0xa6: // LDX n
			this.ldx(this.fetch());
			break;
		case 0xa8: // TAY
			this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.iy = this.a];
			break;
		case 0xa9: // LDA #n
			this.lda(null);
			break;
		case 0xaa: // TAX
			this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.ix = this.a];
			break;
		case 0xac: // LDY nn
			this.ldy(this.abs());
			break;
		case 0xad: // LDA nn
			this.lda(this.abs());
			break;
		case 0xae: // LDX nn
			this.ldx(this.abs());
			break;
		case 0xb0: // BCS
			this.bcc((this.ccr & 1) !== 0);
			break;
		case 0xb1: // LDA (n),Y
			this.lda(this.indy());
			break;
		case 0xb4: // LDY n,X
			this.ldy(this.zpx());
			break;
		case 0xb5: // LDA n,X
			this.lda(this.zpx());
			break;
		case 0xb6: // LDX n,Y
			this.ldx(this.zpy());
			break;
		case 0xb8: // CLV
			this.ccr &= ~0x40;
			break;
		case 0xb9: // LDA nn,Y
			this.lda(this.absy());
			break;
		case 0xba: // TSX
			this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.ix = this.sp];
			break;
		case 0xbc: // LDY nn,X
			this.ldy(this.absx());
			break;
		case 0xbd: // LDA nn,X
			this.lda(this.absx());
			break;
		case 0xbe: // LDX nn,Y
			this.ldx(this.absy());
			break;
		case 0xc0: // CPY #n
			this.cpy(null);
			break;
		case 0xc1: // CMP (n,X)
			this.cmp(this.indx());
			break;
		case 0xc4: // CPY n
			this.cpy(this.fetch());
			break;
		case 0xc5: // CMP n
			this.cmp(this.fetch());
			break;
		case 0xc6: // DEC n
			this.dec(this.fetch());
			break;
		case 0xc8: // INY
			this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.iy = this.iy + 1 & 0xff];
			break;
		case 0xc9: // CMP #n
			this.cmp(null);
			break;
		case 0xca: // DEX
			this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.ix = this.ix - 1 & 0xff];
			break;
		case 0xcc: // CPY nn
			this.cpy(this.abs());
			break;
		case 0xcd: // CMP nn
			this.cmp(this.abs());
			break;
		case 0xce: // DEC nn
			this.dec(this.abs());
			break;
		case 0xd0: // BNE
			this.bcc((this.ccr & 2) === 0);
			break;
		case 0xd1: // CMP (n),Y
			this.cmp(this.indy());
			break;
		case 0xd5: // CMP n,X
			this.cmp(this.zpx());
			break;
		case 0xd6: // DEC n,X
			this.dec(this.zpx());
			break;
		case 0xd8: // CLD
			this.ccr &= ~8;
			break;
		case 0xd9: // CMP nn,Y
			this.cmp(this.absy());
			break;
		case 0xdd: // CMP nn,X
			this.cmp(this.absx());
			break;
		case 0xde: // DEC nn,X
			this.dec(this.absx());
			break;
		case 0xe0: // CPX #n
			this.cpx(null);
			break;
		case 0xe1: // SBC (n,X)
			this.sbc(this.indx());
			break;
		case 0xe4: // CPX n
			this.cpx(this.fetch());
			break;
		case 0xe5: // SBC n
			this.sbc(this.fetch());
			break;
		case 0xe6: // INC n
			this.inc(this.fetch());
			break;
		case 0xe8: // INX
			this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.ix = this.ix + 1 & 0xff];
			break;
		case 0xe9: // SBC #n
			this.sbc(null);
			break;
		case 0xea: // NOP
			break;
		case 0xec: // CPX nn
			this.cpx(this.abs());
			break;
		case 0xed: // SBC nn
			this.sbc(this.abs());
			break;
		case 0xee: // INC nn
			this.inc(this.abs());
			break;
		case 0xf0: // BEQ
			this.bcc((this.ccr & 2) !== 0);
			break;
		case 0xf1: // SBC (n),Y
			this.sbc(this.indy());
			break;
		case 0xf5: // SBC n,X
			this.sbc(this.zpx());
			break;
		case 0xf6: // INC n,X
			this.inc(this.zpx());
			break;
		case 0xf8: // SED
			this.ccr |= 8;
			break;
		case 0xf9: // SBC nn,Y
			this.sbc(this.absy());
			break;
		case 0xfd: // SBC nn,X
			this.sbc(this.absx());
			break;
		case 0xfe: // INC nn,X
			this.inc(this.absx());
			break;
		default:
			this.undefsize = 1;
			if (this.undef)
				this.undef(this.arg);
			break;
		}
	}

	abs() {
		return this.fetch() | this.fetch() << 8;
	}

	absx() {
		return (this.fetch() | this.fetch() << 8) + this.ix & 0xffff;
	}

	absy() {
		return (this.fetch() | this.fetch() << 8) + this.iy & 0xffff;
	}

	zpx() {
		return this.fetch() + this.ix & 0xff;
	}

	zpy() {
		return this.fetch() + this.iy & 0xff;
	}

	indx() {
		const addr = this.zpx();
		return this.read(addr) | this.read(addr + 1 & 0xff) << 8;
	}

	indy() {
		const addr = this.fetch();
		return (this.read(addr) | this.read(addr + 1 & 0xff) << 8) + this.iy & 0xffff;
	}

	lda(ea) {
		this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.a = this.readf(ea)];
	}

	ldx(ea) {
		this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.ix = this.readf(ea)];
	}

	ldy(ea) {
		this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.iy = this.readf(ea)];
	}

	ora(ea) {
		this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.a |= this.readf(ea)];
	}

	and(ea) {
		this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.a &= this.readf(ea)];
	}

	eor(ea) {
		this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.a ^= this.readf(ea)];
	}

	adc(ea) {
		const v = MCS6502.aAdd[this.ccr >>> 3 & 1][this.ccr & 1][this.a][this.readf(ea)];
		this.a = v & 0xff;
		this.ccr = this.ccr & ~0xc3 | v >>> 8;
	}

	sbc(ea) {
		const v = MCS6502.aSub[this.ccr >>> 3 & 1][this.ccr & 1][this.a][this.readf(ea)];
		this.a = v & 0xff;
		this.ccr = this.ccr & ~0xc3 | v >>> 8;
	}

	cmp(ea) {
		this.ccr = this.ccr & ~0x83 | MCS6502.aSub[0][1][this.a][this.readf(ea)] >>> 8 & 0x83;
	}

	cpy(ea) {
		this.ccr = this.ccr & ~0x83 | MCS6502.aSub[0][1][this.iy][this.readf(ea)] >>> 8 & 0x83;
	}

	cpx(ea) {
		this.ccr = this.ccr & ~0x83 | MCS6502.aSub[0][1][this.ix][this.readf(ea)] >>> 8 & 0x83;
	}

	bit(ea) {
		const v = this.read(ea);
		this.ccr = this.ccr & ~0xc2 | MCS6502.fLogic[this.a & v] & 2 | v & 0xc0;
	}

	asl(ea) {
		const v = MCS6502.aRl[0][this.read(ea)];
		this.write(ea, v & 0xff);
		this.ccr = this.ccr & ~0x83 | v >>> 8;
	}

	rol(ea) {
		const v = MCS6502.aRl[this.ccr & 1][this.read(ea)];
		this.write(ea, v & 0xff);
		this.ccr = this.ccr & ~0x83 | v >>> 8;
	}

	lsr(ea) {
		const v = MCS6502.aRr[0][this.read(ea)];
		this.write(ea, v & 0xff);
		this.ccr = this.ccr & ~0x83 | v >>> 8;
	}

	ror(ea) {
		const v = MCS6502.aRr[this.ccr & 1][this.read(ea)];
		this.write(ea, v & 0xff);
		this.ccr = this.ccr & ~0x83 | v >>> 8;
	}

	dec(ea) {
		this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.write(ea, this.read(ea) - 1 & 0xff)];
	}

	inc(ea) {
		this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.write(ea, this.read(ea) + 1 & 0xff)];
	}

	bcc(cond) {
		const d = this.fetch();
		if (cond) this.pc = this.pc + d - (d << 1 & 0x100) & 0xffff;
	}

	push(r) {
		this.write(this.sp | 0x100, r);
		this.sp = this.sp - 1 & 0xff;
	}

	pull() {
		this.sp = this.sp + 1 & 0xff;
		return this.read(this.sp | 0x100);
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
}

void function () {
	let f, i, j, k, r;

	MCS6502.aAdd = []; // [2][2][0x100][0x100];
	MCS6502.aSub = []; // [2][2][0x100][0x100];
	MCS6502.aRl = []; // [2][0x100];
	MCS6502.aRr = []; // [2][0x100];
	MCS6502.fLogic = new Uint8Array(0x100);

	for (i = 0; i < 2; i++) {
		MCS6502.aAdd[i] = [];
		for (j = 0; j < 2; j++) {
			MCS6502.aAdd[i][j] = [];
			for (k = 0; k < 0x100; k++)
				MCS6502.aAdd[i][j][k] = new Uint16Array(0x100);
		}
	}
	for (i = 0; i < 2; i++) {
		MCS6502.aSub[i] = [];
		for (j = 0; j < 2; j++) {
			MCS6502.aSub[i][j] = [];
			for (k = 0; k < 0x100; k++)
				MCS6502.aSub[i][j][k] = new Uint16Array(0x100);
		}
	}
	for (i = 0; i < 2; i++)
		MCS6502.aRl[i] = new Uint16Array(0x100);
	for (i = 0; i < 2; i++)
		MCS6502.aRr[i] = new Uint16Array(0x100);

	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++)
			for (k = 0; k < 0x100; k++) {
				r = j - (j << 1 & 0x100) + k - (k << 1 & 0x100) + i;
				f = r & 0x80;
				if ((r & 0xff) === 0)
					f |= 2;
				if (r > 0x7f || r < -0x80)
					f |= 0x40;
				f |= (r ^ j << 1 ^ k << 1) >>> 8 & 1;
				MCS6502.aAdd[0][i][j][k] = r & 0xff | f << 8;
				if ((r & 0x0f) > 9 || ((r ^ j ^ k) & 0x10) !== 0)
					r += 6;
				if ((r & 0xf0) > 0x90 || (f &= 1)) {
					r += 0x60;
					f |= 1;
				}
				f |= r & 0x80;
				if ((r & 0xff) === 0)
					f |= 2;
				MCS6502.aAdd[1][i][j][k] = r & 0xff | f << 8;
			}
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++)
			for (k = 0; k < 0x100; k++) {
				r = j - (j << 1 & 0x100) + ~(k - (k << 1 & 0x100)) + i;
				f = r & 0x80;
				if ((r & 0xff) === 0)
					f |= 2;
				if (r > 0x7f || r < -0x80)
					f |= 0x40;
				f |= (r ^ j << 1 ^ ~k << 1) >>> 8 & 1;
				MCS6502.aSub[0][i][j][k] = r & 0xff | f << 8;
				if ((r & 0x0f) > 9 || ((r ^ j ^ ~k) & 0x10) === 0)
					r -= 6;
				if ((r & 0xf0) > 0x90 || !(f &= 1)) {
					r -= 0x60;
					f = 0;
				}
				f |= r & 0x80;
				if ((r & 0xff) === 0)
					f |= 2;
				MCS6502.aSub[1][i][j][k] = r & 0xff | f << 8;
			}
	for (i = 0; i < 0x100; i++) {
		f = i & 0x80;
		if (i === 0)
			f |= 2;
		MCS6502.fLogic[i] = f;
	}
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++) {
			r = j << 1 | i;
			MCS6502.aRl[i][j] = MCS6502.fLogic[r & 0xff] << 8 | r;
		}
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++) {
			r = j >>> 1 | i << 7;
			MCS6502.aRr[i][j] = (MCS6502.fLogic[r] | j & 1) << 8 | r;
		}
}();

