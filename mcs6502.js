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
		this.push(this.pc >> 8, this.pc & 0xff, this.ccr &= ~0x10);
		this.ccr |= 4;
		this.pc = this.read(0xfffe) | this.read(0xffff) << 8;
		return true;
	}

	non_maskable_interrupt() {
		if (!super.interrupt())
			return false;
		this.push(this.pc >> 8, this.pc & 0xff, this.ccr &= ~0x10);
		this.ccr |= 4;
		this.pc = this.read(0xfffa) | this.read(0xfffb) << 8;
		return true;
	}

	_execute() {
		let ea;

		switch (this.fetch()) {
		case 0x00: // BRK
			this.fetch();
			this.push(this.pc >> 8, this.pc & 0xff, this.ccr |= 0x10);
			this.ccr |= 0x04;
			return void(this.pc = this.read(0xfffe) | this.read(0xffff) << 8);
		case 0x01: // ORA (n,X)
			return void(this.a = this.mov8(this.a | this.read(this.read16z(this.fetch() + this.ix & 0xff))));
		case 0x05: // ORA n
			return void(this.a = this.mov8(this.a | this.read(this.fetch())));
		case 0x06: // ASL n
			return this.write(ea = this.fetch(), this.asl8(this.read(ea)));
		case 0x08: // PHP
			return this.push(this.ccr);
		case 0x09: // ORA #n
			return void(this.a = this.mov8(this.a | this.fetch()));
		case 0x0a: // ASLA
			return void(this.a = this.asl8(this.a));
		case 0x0d: // ORA nn
			return void(this.a = this.mov8(this.a | this.read(this.fetch() | this.fetch() << 8)));
		case 0x0e: // ASL nn
			return this.write(ea = this.fetch() | this.fetch() << 8, this.asl8(this.read(ea)));
		case 0x10: // BPL
			return this.bcc((this.ccr & 0x80) === 0);
		case 0x11: // ORA (n),Y
			return void(this.a = this.mov8(this.a | this.read(this.read16z(this.fetch()) + this.iy & 0xffff)));
		case 0x15: // ORA n,X
			return void(this.a = this.mov8(this.a | this.read(this.fetch() + this.ix & 0xff)));
		case 0x16: // ASL n,X
			return this.write(ea = this.fetch() + this.ix & 0xff, this.asl8(this.read(ea)));
		case 0x18: // CLC
			return void(this.ccr &= ~1);
		case 0x19: // ORA nn,Y
			return void(this.a = this.mov8(this.a | this.read((this.fetch() | this.fetch() << 8) + this.iy & 0xffff)));
		case 0x1d: // ORA nn,X
			return void(this.a = this.mov8(this.a | this.read((this.fetch() | this.fetch() << 8) + this.ix & 0xffff)));
		case 0x1e: // ASL nn,X
			return this.write(ea = (this.fetch() | this.fetch() << 8) + this.ix & 0xffff, this.asl8(this.read(ea)));
		case 0x20: // JSR nn
			ea = this.fetch() | this.fetch() << 8;
			this.push(this.pc >> 8, this.pc & 0xff);
			return void(this.pc = ea);
		case 0x21: // AND (n,X)
			return void(this.a = this.mov8(this.a & this.read(this.read16z(this.fetch() + this.ix & 0xff))));
		case 0x24: // BIT n
			return this.bit8(this.a, this.read(this.fetch()));
		case 0x25: // AND n
			return void(this.a = this.mov8(this.a & this.read(this.fetch())));
		case 0x26: // ROL n
			return this.write(ea = this.fetch(), this.rol8(this.read(ea)));
		case 0x28: // PLP
			return void(this.ccr = this.pull() | 0x20);
		case 0x29: // AND #n
			return void(this.a = this.mov8(this.a & this.fetch()));
		case 0x2a: // ROLA
			return void(this.a = this.rol8(this.a));
		case 0x2c: // BIT nn
			return this.bit8(this.a, this.read(this.fetch() | this.fetch() << 8));
		case 0x2d: // AND nn
			return void(this.a = this.mov8(this.a & this.read(this.fetch() | this.fetch() << 8)));
		case 0x2e: // ROL nn
			return this.write(ea = this.fetch() | this.fetch() << 8, this.rol8(this.read(ea)));
		case 0x30: // BMI
			return this.bcc((this.ccr & 0x80) !== 0);
		case 0x31: // AND (n),Y
			return void(this.a = this.mov8(this.a & this.read(this.read16z(this.fetch()) + this.iy & 0xffff)));
		case 0x35: // AND n,X
			return void(this.a = this.mov8(this.a & this.read(this.fetch() + this.ix & 0xff)));
		case 0x36: // ROL n,X
			return this.write(ea = this.fetch() + this.ix & 0xff, this.rol8(this.read(ea)));
		case 0x38: // SEC
			return void(this.ccr |= 1);
		case 0x39: // AND nn,Y
			return void(this.a = this.mov8(this.a & this.read((this.fetch() | this.fetch() << 8) + this.iy & 0xffff)));
		case 0x3d: // AND nn,X
			return void(this.a = this.mov8(this.a & this.read((this.fetch() | this.fetch() << 8) + this.ix & 0xffff)));
		case 0x3e: // ROL nn,X
			return this.write(ea = (this.fetch() | this.fetch() << 8) + this.ix & 0xffff, this.rol8(this.read(ea)));
		case 0x40: // RTI
			return void([this.ccr, this.pc] = [this.pull() | 0x20, this.pull() | this.pull() << 8]);
		case 0x41: // EOR (n,X)
			return void(this.a = this.mov8(this.a ^ this.read(this.read16z(this.fetch() + this.ix & 0xff))));
		case 0x45: // EOR n
			return void(this.a = this.mov8(this.a ^ this.read(this.fetch())));
		case 0x46: // LSR n
			return this.write(ea = this.fetch(), this.lsr8(this.read(ea)));
		case 0x48: // PHA
			return this.push(this.a);
		case 0x49: // EOR #n
			return void(this.a = this.mov8(this.a ^ this.fetch()));
		case 0x4a: // LSRA
			return void(this.a = this.lsr8(this.a));
		case 0x4c: // JMP nn
			return void(this.pc = this.fetch() | this.fetch() << 8);
		case 0x4d: // EOR nn
			return void(this.a = this.mov8(this.a ^ this.read(this.fetch() | this.fetch() << 8)));
		case 0x4e: // LSR nn
			return this.write(ea = this.fetch() | this.fetch() << 8, this.lsr8(this.read(ea)));
		case 0x50: // BVC
			return this.bcc((this.ccr & 0x40) === 0);
		case 0x51: // EOR (n),Y
			return void(this.a = this.mov8(this.a ^ this.read(this.read16z(this.fetch()) + this.iy & 0xffff)));
		case 0x55: // EOR n,X
			return void(this.a = this.mov8(this.a ^ this.read(this.fetch() + this.ix & 0xff)));
		case 0x56: // LSR n,X
			return this.write(ea = this.fetch() + this.ix & 0xff, this.lsr8(this.read(ea)));
		case 0x58: // CLI
			return void(this.ccr &= ~4);
		case 0x59: // EOR nn,Y
			return void(this.a = this.mov8(this.a ^ this.read((this.fetch() | this.fetch() << 8) + this.iy & 0xffff)));
		case 0x5d: // EOR nn,X
			return void(this.a = this.mov8(this.a ^ this.read((this.fetch() | this.fetch() << 8) + this.ix & 0xffff)));
		case 0x5e: // LSR nn,X
			return this.write(ea = (this.fetch() | this.fetch() << 8) + this.ix & 0xffff, this.lsr8(this.read(ea)));
		case 0x60: // RTS
			return void(this.pc = this.pull() | this.pull() << 8);
		case 0x61: // ADC (n,X)
			return void(this.a = this.adc8(this.a, this.read(this.read16z(this.fetch() + this.ix & 0xff))));
		case 0x65: // ADC n
			return void(this.a = this.adc8(this.a, this.read(this.fetch())));
		case 0x66: // ROR n
			return this.write(ea = this.fetch(), this.ror8(this.read(ea)));
		case 0x68: // PLA
			return void(this.a = this.pull());
		case 0x69: // ADC #n
			return void(this.a = this.adc8(this.a, this.fetch()));
		case 0x6a: // RORA
			return void(this.a = this.ror8(this.a));
		case 0x6c: // JMP (nn)
			return void(this.pc = this.read(ea = this.fetch() | this.fetch() << 8) | this.read(ea + 1 & 0xffff) << 8);
		case 0x6d: // ADC nn
			return void(this.a = this.adc8(this.a, this.read(this.fetch() | this.fetch() << 8)));
		case 0x6e: // ROR nn
			return this.write(ea = this.fetch() | this.fetch() << 8, this.ror8(this.read(ea)));
		case 0x70: // BVS
			return this.bcc((this.ccr & 0x40) !== 0);
		case 0x71: // ADC (n),Y
			return void(this.a = this.adc8(this.a, this.read(this.read16z(this.fetch()) + this.iy & 0xffff)));
		case 0x75: // ADC n,X
			return void(this.a = this.adc8(this.a, this.read(this.fetch() + this.ix & 0xff)));
		case 0x76: // ROR n,X
			return this.write(ea = this.fetch() + this.ix & 0xff, this.ror8(this.read(ea)));
		case 0x78: // SEI
			return void(this.ccr |= 4);
		case 0x79: // ADC nn,Y
			return void(this.a = this.adc8(this.a, this.read((this.fetch() | this.fetch() << 8) + this.iy & 0xffff)));
		case 0x7d: // ADC nn,X
			return void(this.a = this.adc8(this.a, this.read((this.fetch() | this.fetch() << 8) + this.ix & 0xffff)));
		case 0x7e: // ROR nn,X
			return this.write(ea = (this.fetch() | this.fetch() << 8) + this.ix & 0xffff, this.ror8(this.read(ea)));
		case 0x81: // STA (n,X)
			return this.write(this.read16z(this.fetch() + this.ix & 0xff), this.a);
		case 0x84: // STY n
			return this.write(this.fetch(), this.iy);
		case 0x85: // STA n
			return this.write(this.fetch(), this.a);
		case 0x86: // STX n
			return this.write(this.fetch(), this.ix);
		case 0x88: // DEY
			return void(this.iy = this.mov8(this.iy - 1 & 0xff));
		case 0x8a: // TXA
			return void(this.a = this.mov8(this.ix));
		case 0x8c: // STY nn
			return this.write(this.fetch() | this.fetch() << 8, this.iy);
		case 0x8d: // STA nn
			return this.write(this.fetch() | this.fetch() << 8, this.a);
		case 0x8e: // STX nn
			return this.write(this.fetch() | this.fetch() << 8, this.ix);
		case 0x90: // BCC
			return this.bcc((this.ccr & 1) === 0);
		case 0x91: // STA (n),Y
			return this.write(this.read16z(this.fetch()) + this.iy & 0xffff, this.a);
		case 0x94: // STY n,X
			return this.write(this.fetch() + this.ix & 0xff, this.iy);
		case 0x95: // STA n,X
			return this.write(this.fetch() + this.ix & 0xff, this.a);
		case 0x96: // STX n,Y
			return this.write(this.fetch() + this.iy & 0xff, this.ix);
		case 0x98: // TYA
			return void(this.a = this.mov8(this.iy));
		case 0x99: // STA nn,Y
			return this.write((this.fetch() | this.fetch() << 8) + this.iy & 0xffff, this.a);
		case 0x9a: // TXS
			return void(this.sp = this.ix);
		case 0x9d: // STA nn,X
			return this.write((this.fetch() | this.fetch() << 8) + this.ix & 0xffff, this.a);
		case 0xa0: // LDY #n
			return void(this.iy = this.mov8(this.fetch()));
		case 0xa1: // LDA (n,X)
			return void(this.a = this.mov8(this.read(this.read16z(this.fetch() + this.ix & 0xff))));
		case 0xa2: // LDX #n
			return void(this.ix = this.mov8(this.fetch()));
		case 0xa4: // LDY n
			return void(this.iy = this.mov8(this.read(this.fetch())));
		case 0xa5: // LDA n
			return void(this.a = this.mov8(this.read(this.fetch())));
		case 0xa6: // LDX n
			return void(this.ix = this.mov8(this.read(this.fetch())));
		case 0xa8: // TAY
			return void(this.iy = this.mov8(this.a));
		case 0xa9: // LDA #n
			return void(this.a = this.mov8(this.fetch()));
		case 0xaa: // TAX
			return void(this.ix = this.mov8(this.a));
		case 0xac: // LDY nn
			return void(this.iy = this.mov8(this.read(this.fetch() | this.fetch() << 8)));
		case 0xad: // LDA nn
			return void(this.a = this.mov8(this.read(this.fetch() | this.fetch() << 8)));
		case 0xae: // LDX nn
			return void(this.ix = this.mov8(this.read(this.fetch() | this.fetch() << 8)));
		case 0xb0: // BCS
			return this.bcc((this.ccr & 1) !== 0);
		case 0xb1: // LDA (n),Y
			return void(this.a = this.mov8(this.read(this.read16z(this.fetch()) + this.iy & 0xffff)));
		case 0xb4: // LDY n,X
			return void(this.iy = this.mov8(this.read(this.fetch() + this.ix & 0xff)));
		case 0xb5: // LDA n,X
			return void(this.a = this.mov8(this.read(this.fetch() + this.ix & 0xff)));
		case 0xb6: // LDX n,Y
			return void(this.ix = this.mov8(this.read(this.fetch() + this.iy & 0xff)));
		case 0xb8: // CLV
			return void(this.ccr &= ~0x40);
		case 0xb9: // LDA nn,Y
			return void(this.a = this.mov8(this.read((this.fetch() | this.fetch() << 8) + this.iy & 0xffff)));
		case 0xba: // TSX
			return void(this.ix = this.mov8(this.sp));
		case 0xbc: // LDY nn,X
			return void(this.iy = this.mov8(this.read((this.fetch() | this.fetch() << 8) + this.ix & 0xffff)));
		case 0xbd: // LDA nn,X
			return void(this.a = this.mov8(this.read((this.fetch() | this.fetch() << 8) + this.ix & 0xffff)));
		case 0xbe: // LDX nn,Y
			return void(this.ix = this.mov8(this.read((this.fetch() | this.fetch() << 8) + this.iy & 0xffff)));
		case 0xc0: // CPY #n
			return this.cmp8(this.iy, this.fetch());
		case 0xc1: // CMP (n,X)
			return this.cmp8(this.a, this.read(this.read16z(this.fetch() + this.ix & 0xff)));
		case 0xc4: // CPY n
			return this.cmp8(this.iy, this.read(this.fetch()));
		case 0xc5: // CMP n
			return this.cmp8(this.a, this.read(this.fetch()));
		case 0xc6: // DEC n
			return this.write(ea = this.fetch(), this.mov8(this.read(ea) - 1 & 0xff));
		case 0xc8: // INY
			return void(this.iy = this.mov8(this.iy + 1 & 0xff));
		case 0xc9: // CMP #n
			return this.cmp8(this.a, this.fetch());
		case 0xca: // DEX
			return void(this.ix = this.mov8(this.ix - 1 & 0xff));
		case 0xcc: // CPY nn
			return this.cmp8(this.iy, this.read(this.fetch() | this.fetch() << 8));
		case 0xcd: // CMP nn
			return this.cmp8(this.a, this.read(this.fetch() | this.fetch() << 8));
		case 0xce: // DEC nn
			return this.write(ea = this.fetch() | this.fetch() << 8, this.mov8(this.read(ea) - 1 & 0xff));
		case 0xd0: // BNE
			return this.bcc((this.ccr & 2) === 0);
		case 0xd1: // CMP (n),Y
			return this.cmp8(this.a, this.read(this.read16z(this.fetch()) + this.iy & 0xffff));
		case 0xd5: // CMP n,X
			return this.cmp8(this.a, this.read(this.fetch() + this.ix & 0xff));
		case 0xd6: // DEC n,X
			return this.write(ea = this.fetch() + this.ix & 0xff, this.mov8(this.read(ea) - 1 & 0xff));
		case 0xd8: // CLD
			return void(this.ccr &= ~8);
		case 0xd9: // CMP nn,Y
			return this.cmp8(this.a, this.read((this.fetch() | this.fetch() << 8) + this.iy & 0xffff));
		case 0xdd: // CMP nn,X
			return this.cmp8(this.a, this.read((this.fetch() | this.fetch() << 8) + this.ix & 0xffff));
		case 0xde: // DEC nn,X
			return this.write(ea = (this.fetch() | this.fetch() << 8) + this.ix & 0xffff, this.mov8(this.read(ea) - 1 & 0xff));
		case 0xe0: // CPX #n
			return this.cmp8(this.ix, this.fetch());
		case 0xe1: // SBC (n,X)
			return void(this.a = this.sbc8(this.a, this.read(this.read16z(this.fetch() + this.ix & 0xff))));
		case 0xe4: // CPX n
			return this.cmp8(this.ix, this.read(this.fetch()));
		case 0xe5: // SBC n
			return void(this.a = this.sbc8(this.a, this.read(this.fetch())));
		case 0xe6: // INC n
			return this.write(ea = this.fetch(), this.mov8(this.read(ea) + 1 & 0xff));
		case 0xe8: // INX
			return void(this.ix = this.mov8(this.ix + 1 & 0xff));
		case 0xe9: // SBC #n
			return void(this.a = this.sbc8(this.a, this.fetch()));
		case 0xea: // NOP
			return;
		case 0xec: // CPX nn
			return this.cmp8(this.ix, this.read(this.fetch() | this.fetch() << 8));
		case 0xed: // SBC nn
			return void(this.a = this.sbc8(this.a, this.read(this.fetch() | this.fetch() << 8)));
		case 0xee: // INC nn
			return this.write(ea = this.fetch() | this.fetch() << 8, this.mov8(this.read(ea) + 1 & 0xff));
		case 0xf0: // BEQ
			return this.bcc((this.ccr & 2) !== 0);
		case 0xf1: // SBC (n),Y
			return void(this.a = this.sbc8(this.a, this.read(this.read16z(this.fetch()) + this.iy & 0xffff)));
		case 0xf5: // SBC n,X
			return void(this.a = this.sbc8(this.a, this.read(this.fetch() + this.ix & 0xff)));
		case 0xf6: // INC n,X
			return this.write(ea = this.fetch() + this.ix & 0xff, this.mov8(this.read(ea) + 1 & 0xff));
		case 0xf8: // SED
			return void(this.ccr |= 8);
		case 0xf9: // SBC nn,Y
			return void(this.a = this.sbc8(this.a, this.read((this.fetch() | this.fetch() << 8) + this.iy & 0xffff)));
		case 0xfd: // SBC nn,X
			return void(this.a = this.sbc8(this.a, this.read((this.fetch() | this.fetch() << 8) + this.ix & 0xffff)));
		case 0xfe: // INC nn,X
			return this.write(ea = (this.fetch() | this.fetch() << 8) + this.ix & 0xffff, this.mov8(this.read(ea) + 1 & 0xff));
		default:
			this.undefsize = 1;
			if (this.undef)
				this.undef(this.arg);
			return;
		}
	}

	mov8(src) {
		this.ccr = this.ccr & ~0x82 | src & 0x80 | !src << 1;
		return src;
	}

	asl8(dst) {
		const r = dst << 1 & 0xff, c = dst >> 7;
		this.ccr = this.ccr & ~0x83 | r & 0x80 | !r << 1 | c;
		return r;
	}

	bit8(dst, src) {
		const r = dst & src;
		this.ccr = this.ccr & ~0xc2 | src & 0xc0 | !r << 1;
	}

	rol8(dst) {
		const r = dst << 1 & 0xff | this.ccr & 1, c = dst >> 7;
		this.ccr = this.ccr & ~0x83 | r & 0x80 | !r << 1 | c;
		return r;
	}

	lsr8(dst) {
		const r = dst >> 1, c = dst & 1;
		this.ccr = this.ccr & ~0x83 | !r << 1 | c;
		return r;
	}

	adc8(dst, src) {
		let r = dst + src + (this.ccr & 1) & 0xff, v = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst, cf = 0;
		if ((this.ccr & 8) !== 0) {
			if ((c & 8) !== 0 || (r & 0xf) > 9)
				cf += 6;
			if ((c & 0x80) !== 0 || (r & 0xf0) > 0x90 || (r & 0xf0) > 0x80 && (r & 0xf) > 9) {
				cf += 0x60;
				c |= 0x80;
			}
			r = r + cf & 0xff;
		}
		this.ccr = this.ccr & ~0xc3 | r & 0x80 | v >> 1 & 0x40 | !r << 1 | c >> 7 & 1;
		return r;
	}

	ror8(dst) {
		const r = dst >> 1 | this.ccr << 7 & 0x80, c = dst & 1;
		this.ccr = this.ccr & ~0x83 | r & 0x80 | !r << 1 | c;
		return r;
	}

	cmp8(dst, src) {
		const r = dst - src & 0xff, c = dst & ~src | ~src & ~r | ~r & dst;
		this.ccr = this.ccr & ~0x83 | r & 0x80 | !r << 1 | c >> 7 & 1;
	}

	sbc8(dst, src) {
		let r = dst + ~src + (this.ccr & 1) & 0xff, v = dst & ~src & ~r | ~dst & src & r, c = dst & ~src | ~src & ~r | ~r & dst, cf = 0;
		if ((this.ccr & 8) !== 0) {
			if ((c & 8) === 0 || (r & 0x0f) > 9)
				cf -= 6;
			if ((c & 0x80) === 0 || (r & 0xf0) > 0x90) {
				cf -= 0x60;
				c &= ~0x80;
			}
			r = r + cf & 0xff;
		}
		this.ccr = this.ccr & ~0xc3 | r & 0x80 | v >> 1 & 0x40 | !r << 1 | c >> 7 & 1;
		return r;
	}

	bcc(cond) {
		const d = this.fetch();
		if (cond) this.pc = this.pc + d - (d << 1 & 0x100) & 0xffff;
	}

	push(...args) {
		args.forEach(e => {
			this.write(this.sp | 0x100, e);
			this.sp = this.sp - 1 & 0xff;
		});
	}

	pull() {
		return this.read((this.sp = this.sp + 1 & 0xff) | 0x100);
	}

	read16z(addr) {
		return this.read(addr) | this.read(addr + 1 & 0xff) << 8;
	}
}

