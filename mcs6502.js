/*
 *
 *	MCS6502 Emulator
 *
 */

import Cpu from './main.js';

export default class MCS6502 extends Cpu {
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
			return;
		case 0x01: // ORA (n,X)
			return this.ora(this.indx());
		case 0x05: // ORA n
			return this.ora(this.fetch());
		case 0x06: // ASL
			return this.asl(this.fetch());
		case 0x08: // PHP
			return this.push(this.ccr);
		case 0x09: // ORA #n
			return this.ora(null);
		case 0x0a: // ASLA
			this.a = (v = MCS6502.aRl[0][this.a]) & 0xff;
			this.ccr = this.ccr & ~0x83 | v >>> 8;
			return;
		case 0x0d: // ORA nn
			return this.ora(this.abs());
		case 0x0e: // ASL n
			return this.asl(this.abs());
		case 0x10: // BPL
			return this.bcc((this.ccr & 0x80) === 0);
		case 0x11: // ORA (n),Y
			return this.ora(this.indy());
		case 0x15: // ORA n,X
			return this.ora(this.zpx());
		case 0x16: // ASL n,X
			return this.asl(this.zpx());
		case 0x18: // CLC
			return void(this.ccr &= ~1);
		case 0x19: // ORA nn,Y
			return this.ora(this.absy());
		case 0x1d: // ORA nn,X
			return this.ora(this.absx());
		case 0x1e: // ASL nn,X
			return this.asl(this.absx());
		case 0x20: // JSR nn
			ea = this.abs();
			this.push(this.pc >>> 8);
			this.push(this.pc & 0xff);
			this.pc = ea;
			return;
		case 0x21: // AND (n,X)
			return this.and(this.indx());
		case 0x24: // BIT n
			return this.bit(this.fetch());
		case 0x25: // AND n
			return this.and(this.fetch());
		case 0x26: // ROL n
			return this.rol(this.fetch());
		case 0x28: // PLP
			return void(this.ccr = this.pull() | 0x20);
		case 0x29: // AND #n
			return this.and(null);
		case 0x2a: // ROLA
			this.a = (v = MCS6502.aRl[this.ccr & 1][this.a]) & 0xff;
			this.ccr = this.ccr & ~0x83 | v >>> 8;
			return;
		case 0x2c: // BIT nn
			return this.bit(this.abs());
		case 0x2d: // AND nn
			return this.and(this.abs());
		case 0x2e: // ROL nn
			return this.rol(this.abs());
		case 0x30: // BMI
			return this.bcc((this.ccr & 0x80) !== 0);
		case 0x31: // AND (n),Y
			return this.and(this.indy());
		case 0x35: // AND n,X
			return this.and(this.zpx());
		case 0x36: // ROL n,X
			return this.rol(this.zpx());
		case 0x38: // SEC
			return void(this.ccr |= 1);
		case 0x39: // AND nn,Y
			return this.and(this.absy());
		case 0x3d: // AND nn,X
			return this.and(this.absx());
		case 0x3e: // ROL nn,X
			return this.rol(this.absx());
		case 0x40: // RTI
			return void([this.ccr, this.pc] = [this.pull() | 0x20, this.pull() | this.pull() << 8]);
		case 0x41: // EOR (n,X)
			return this.eor(this.indx());
		case 0x45: // EOR n
			return this.eor(this.fetch());
		case 0x46: // LSR n
			return this.lsr(this.fetch());
		case 0x48: // PHA
			return this.push(this.a);
		case 0x49: // EOR #n
			return this.eor(null);
		case 0x4a: // LSRA
			this.a = (v = MCS6502.aRr[0][this.a]) & 0xff;
			this.ccr = this.ccr & ~0x83 | v >>> 8;
			return;
		case 0x4c: // JMP nn
			return void(this.pc = this.abs());
		case 0x4d: // EOR nn
			return this.eor(this.abs());
		case 0x4e: // LSR nn
			return this.lsr(this.abs());
		case 0x50: // BVC
			return this.bcc((this.ccr & 0x40) === 0);
		case 0x51: // EOR (n),Y
			return this.eor(this.indy());
		case 0x55: // EOR n,X
			return this.eor(this.zpx());
		case 0x56: // LSR n,X
			return this.lsr(this.zpx());
		case 0x58: // CLI
			return void(this.ccr &= ~4);
		case 0x59: // EOR nn,Y
			return this.eor(this.absy());
		case 0x5d: // EOR nn,X
			return this.eor(this.absx());
		case 0x5e: // LSR nn,X
			return this.lsr(this.absx());
		case 0x60: // RTS
			return void(this.pc = this.pull() | this.pull() << 8);
		case 0x61: // ADC (n,X)
			return this.adc(this.indx());
		case 0x65: // ADC n
			return this.adc(this.fetch());
		case 0x66: // ROR n
			return this.ror(this.fetch());
		case 0x68: // PLA
			return void(this.a = this.pull());
		case 0x69: // ADC #n
			return this.adc(null);
		case 0x6a: // RORA
			this.a = (v = MCS6502.aRr[this.ccr & 1][this.a]) & 0xff;
			this.ccr = this.ccr & ~0x83 | v >>> 8;
			return;
		case 0x6c: // JMP (nn)
			return void(this.pc = this.read(ea = this.abs()) | this.read(ea + 1 & 0xffff) << 8);
		case 0x6d: // ADC nn
			return this.adc(this.abs());
		case 0x6e: // ROR nn
			return this.ror(this.abs());
		case 0x70: // BVS
			return this.bcc((this.ccr & 0x40) !== 0);
		case 0x71: // ADC (n),Y
			return this.adc(this.indy());
		case 0x75: // ADC n,X
			return this.adc(this.zpx());
		case 0x76: // ROR n,X
			return this.ror(this.zpx());
		case 0x78: // SEI
			return void(this.ccr |= 4);
		case 0x79: // ADC nn,Y
			return this.adc(this.absy());
		case 0x7d: // ADC nn,X
			return this.adc(this.absx());
		case 0x7e: // ROR nn,X
			return this.ror(this.absx());
		case 0x81: // STA (n,X)
			return this.write(this.indx(), this.a);
		case 0x84: // STY n
			return this.write(this.fetch(), this.iy);
		case 0x85: // STA n
			return this.write(this.fetch(), this.a);
		case 0x86: // STX n
			return this.write(this.fetch(), this.ix);
		case 0x88: // DEY
			return void(this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.iy = this.iy - 1 & 0xff]);
		case 0x8a: // TXA
			return void(this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.a = this.ix]);
		case 0x8c: // STY nn
			return this.write(this.abs(), this.iy);
		case 0x8d: // STA nn
			return this.write(this.abs(), this.a);
		case 0x8e: // STX nn
			return this.write(this.abs(), this.ix);
		case 0x90: // BCC
			return this.bcc((this.ccr & 1) === 0);
		case 0x91: // STA (n),Y
			return this.write(this.indy(), this.a);
		case 0x94: // STY n,X
			return this.write(this.zpx(), this.iy);
		case 0x95: // STA n,X
			return this.write(this.zpx(), this.a);
		case 0x96: // STX n,Y
			return this.write(this.zpy(), this.ix);
		case 0x98: // TYA
			return void(this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.a = this.iy]);
		case 0x99: // STA nn,Y
			return this.write(this.absy(), this.a);
		case 0x9a: // TXS
			return void(this.sp = this.ix);
		case 0x9d: // STA nn,X
			return this.write(this.absx(), this.a);
		case 0xa0: // LDY #n
			return this.ldy(null);
		case 0xa1: // LDA (n,X)
			return this.lda(this.indx());
		case 0xa2: // LDX #n
			return this.ldx(null);
		case 0xa4: // LDY n
			return this.ldy(this.fetch());
		case 0xa5: // LDA n
			return this.lda(this.fetch());
		case 0xa6: // LDX n
			return this.ldx(this.fetch());
		case 0xa8: // TAY
			return void(this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.iy = this.a]);
		case 0xa9: // LDA #n
			return this.lda(null);
		case 0xaa: // TAX
			return void(this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.ix = this.a]);
		case 0xac: // LDY nn
			return this.ldy(this.abs());
		case 0xad: // LDA nn
			return this.lda(this.abs());
		case 0xae: // LDX nn
			return this.ldx(this.abs());
		case 0xb0: // BCS
			return this.bcc((this.ccr & 1) !== 0);
		case 0xb1: // LDA (n),Y
			return this.lda(this.indy());
		case 0xb4: // LDY n,X
			return this.ldy(this.zpx());
		case 0xb5: // LDA n,X
			return this.lda(this.zpx());
		case 0xb6: // LDX n,Y
			return this.ldx(this.zpy());
		case 0xb8: // CLV
			return void(this.ccr &= ~0x40);
		case 0xb9: // LDA nn,Y
			return this.lda(this.absy());
		case 0xba: // TSX
			return void(this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.ix = this.sp]);
		case 0xbc: // LDY nn,X
			return this.ldy(this.absx());
		case 0xbd: // LDA nn,X
			return this.lda(this.absx());
		case 0xbe: // LDX nn,Y
			return this.ldx(this.absy());
		case 0xc0: // CPY #n
			return this.cpy(null);
		case 0xc1: // CMP (n,X)
			return this.cmp(this.indx());
		case 0xc4: // CPY n
			return this.cpy(this.fetch());
		case 0xc5: // CMP n
			return this.cmp(this.fetch());
		case 0xc6: // DEC n
			return this.dec(this.fetch());
		case 0xc8: // INY
			return void(this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.iy = this.iy + 1 & 0xff]);
		case 0xc9: // CMP #n
			return this.cmp(null);
		case 0xca: // DEX
			return void(this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.ix = this.ix - 1 & 0xff]);
		case 0xcc: // CPY nn
			return this.cpy(this.abs());
		case 0xcd: // CMP nn
			return this.cmp(this.abs());
		case 0xce: // DEC nn
			return this.dec(this.abs());
		case 0xd0: // BNE
			return this.bcc((this.ccr & 2) === 0);
		case 0xd1: // CMP (n),Y
			return this.cmp(this.indy());
		case 0xd5: // CMP n,X
			return this.cmp(this.zpx());
		case 0xd6: // DEC n,X
			return this.dec(this.zpx());
		case 0xd8: // CLD
			return void(this.ccr &= ~8);
		case 0xd9: // CMP nn,Y
			return this.cmp(this.absy());
		case 0xdd: // CMP nn,X
			return this.cmp(this.absx());
		case 0xde: // DEC nn,X
			return this.dec(this.absx());
		case 0xe0: // CPX #n
			return this.cpx(null);
		case 0xe1: // SBC (n,X)
			return this.sbc(this.indx());
		case 0xe4: // CPX n
			return this.cpx(this.fetch());
		case 0xe5: // SBC n
			return this.sbc(this.fetch());
		case 0xe6: // INC n
			return this.inc(this.fetch());
		case 0xe8: // INX
			return void(this.ccr = this.ccr & ~0x82 | MCS6502.fLogic[this.ix = this.ix + 1 & 0xff]);
		case 0xe9: // SBC #n
			return this.sbc(null);
		case 0xea: // NOP
			return;
		case 0xec: // CPX nn
			return this.cpx(this.abs());
		case 0xed: // SBC nn
			return this.sbc(this.abs());
		case 0xee: // INC nn
			return this.inc(this.abs());
		case 0xf0: // BEQ
			return this.bcc((this.ccr & 2) !== 0);
		case 0xf1: // SBC (n),Y
			return this.sbc(this.indy());
		case 0xf5: // SBC n,X
			return this.sbc(this.zpx());
		case 0xf6: // INC n,X
			return this.inc(this.zpx());
		case 0xf8: // SED
			return void(this.ccr |= 8);
		case 0xf9: // SBC nn,Y
			return this.sbc(this.absy());
		case 0xfd: // SBC nn,X
			return this.sbc(this.absx());
		case 0xfe: // INC nn,X
			return this.inc(this.absx());
		default:
			this.undefsize = 1;
			if (this.undef)
				this.undef(this.arg);
			return;
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

