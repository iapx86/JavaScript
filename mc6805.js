/*
 *
 *	MC6805 Emulator
 *
 */

import Cpu from './main.js';

export default class MC6805 extends Cpu {
	constructor(arg = null) {
		super(arg);
		this.a = 0;
		this.ccr = 0; // ccr:111hinzc
		this.x = 0;
		this.s = 0;
		this.int = false;
	}

	reset() {
		super.reset();
		this.a = 0;
		this.ccr = 0xd0;
		this.x = 0;
		this.s = 0x7f;
		this.pc = (this.read(0x7fe) << 8 | this.read(0x7ff)) & 0x7ff;
		this.int = false;
	}

	interrupt(vector) {
		if (!super.interrupt() || (this.ccr & 0x10) !== 0)
			return false;
		this.psh16(this.pc);
		this.psh(this.x);
		this.psh(this.a);
		this.psh(0xe0 | this.ccr >> 1 & 0x1e | this.ccr & 1);
		this.ccr |= 0x10;
		switch (vector) {
		case 'timer':
			this.pc = (this.read(0x7f8) << 8 | this.read(0x7f9)) & 0x7ff;
			break;
		default:
		case 'external':
			this.pc = (this.read(0x7fa) << 8 | this.read(0x7fb)) & 0x7ff;
			break;
		}
		return true;
	}

	_execute() {
		let v;

		switch (this.fetch()) {
		case 0x00: // BRSET0
			return void this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) & 1) & 1) !== 0);
		case 0x01: // BRCLR0
			return void this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) & 1) & 1) === 0);
		case 0x02: // BRSET1
			return void this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 1 & 1) & 1) !== 0);
		case 0x03: // BRCLR1
			return void this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 1 & 1) & 1) === 0);
		case 0x04: // BRSET2
			return void this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 2 & 1) & 1) !== 0);
		case 0x05: // BRCLR2
			return void this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 2 & 1) & 1) === 0);
		case 0x06: // BRSET3
			return void this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 3 & 1) & 1) !== 0);
		case 0x07: // BRCLR3
			return void this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 3 & 1) & 1) === 0);
		case 0x08: // BRSET4
			return void this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 4 & 1) & 1) !== 0);
		case 0x09: // BRCLR4
			return void this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 4 & 1) & 1) === 0);
		case 0x0a: // BRSET5
			return void this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 5 & 1) & 1) !== 0);
		case 0x0b: // BRCLR5
			return void this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 5 & 1) & 1) === 0);
		case 0x0c: // BRSET6
			return void this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 6 & 1) & 1) !== 0);
		case 0x0d: // BRCLR6
			return void this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 6 & 1) & 1) === 0);
		case 0x0e: // BRSET7
			return void this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 7 & 1) & 1) !== 0);
		case 0x0f: // BRCLR7
			return void this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 7 & 1) & 1) === 0);
		case 0x10: // BSET0
			return void this.write(v = this.direct(), this.read(v) | 1);
		case 0x11: // BCLR0
			return void this.write(v = this.direct(), this.read(v) & ~1);
		case 0x12: // BSET1
			return void this.write(v = this.direct(), this.read(v) | 2);
		case 0x13: // BCLR1
			return void this.write(v = this.direct(), this.read(v) & ~2);
		case 0x14: // BSET2
			return void this.write(v = this.direct(), this.read(v) | 4);
		case 0x15: // BCLR2
			return void this.write(v = this.direct(), this.read(v) & ~4);
		case 0x16: // BSET3
			return void this.write(v = this.direct(), this.read(v) | 8);
		case 0x17: // BCLR3
			return void this.write(v = this.direct(), this.read(v) & ~8);
		case 0x18: // BSET4
			return void this.write(v = this.direct(), this.read(v) | 0x10);
		case 0x19: // BCLR4
			return void this.write(v = this.direct(), this.read(v) & ~0x10);
		case 0x1a: // BSET5
			return void this.write(v = this.direct(), this.read(v) | 0x20);
		case 0x1b: // BCLR5
			return void this.write(v = this.direct(), this.read(v) & ~0x20);
		case 0x1c: // BSET6
			return void this.write(v = this.direct(), this.read(v) | 0x40);
		case 0x1d: // BCLR6
			return void this.write(v = this.direct(), this.read(v) & ~0x40);
		case 0x1e: // BSET7
			return void this.write(v = this.direct(), this.read(v) | 0x80);
		case 0x1f: // BCLR7
			return void this.write(v = this.direct(), this.read(v) & ~0x80);
		case 0x20: // BRA
			return void this.bcc(true);
		case 0x21: // BRN
			return void this.bcc(false);
		case 0x22: // BHI
			return void this.bcc(((this.ccr >>> 2 | this.ccr) & 1) === 0);
		case 0x23: // BLS
			return void this.bcc(((this.ccr >>> 2 | this.ccr) & 1) !== 0);
		case 0x24: // BCC
			return void this.bcc((this.ccr & 1) === 0);
		case 0x25: // BLO(BCS)
			return void this.bcc((this.ccr & 1) !== 0);
		case 0x26: // BNE
			return void this.bcc((this.ccr & 4) === 0);
		case 0x27: // BEQ
			return void this.bcc((this.ccr & 4) !== 0);
		case 0x28: // BHCC
			return void this.bcc((this.ccr & 0x20) === 0);
		case 0x29: // BHCS
			return void this.bcc((this.ccr & 0x20) !== 0);
		case 0x2a: // BPL
			return void this.bcc((this.ccr & 8) === 0);
		case 0x2b: // BMI
			return void this.bcc((this.ccr & 8) !== 0);
		case 0x2c: // BMC
			return void this.bcc((this.ccr & 0x10) === 0);
		case 0x2d: // BMS
			return void this.bcc((this.ccr & 0x10) !== 0);
		case 0x2e: // BIL
			return void this.bcc(this.int);
		case 0x2f: // BIH
			return void this.bcc(!this.int);
		case 0x30: // NEG <n
			return void this.neg(this.direct());
		case 0x33: // COM <n
			return void this.com(this.direct());
		case 0x34: // LSR <n
			return void this.lsr(this.direct());
		case 0x36: // ROR <n
			return void this.ror(this.direct());
		case 0x37: // ASR <n
			return void this.asr(this.direct());
		case 0x38: // ASL(LSL) <n
			return void this.lsl(this.direct());
		case 0x39: // ROL <n
			return void this.rol(this.direct());
		case 0x3a: // DEC <n
			return void this.dec(this.direct());
		case 0x3c: // INC <n
			return void this.inc(this.direct());
		case 0x3d: // TST <n
			return void this.tst(this.direct());
		case 0x3f: // CLR <n
			return void this.clr(this.direct());
		case 0x40: // NEGA
			return void(this.a = this.nega(this.a));
		case 0x42: // MUL
			this.x = (v = this.x * this.a) >>> 8;
			this.a = v & 0xff;
			this.ccr &= ~0x21;
			return;
		case 0x43: // COMA
			return void(this.a = this.coma(this.a));
		case 0x44: // LSRA
			return void(this.a = this.lsra(this.a));
		case 0x46: // RORA
			return void(this.a = this.rora(this.a));
		case 0x47: // ASRA
			return void(this.a = this.asra(this.a));
		case 0x48: // ASLA(LSLA)
			return void(this.a = this.lsla(this.a));
		case 0x49: // ROLA
			return void(this.a = this.rola(this.a));
		case 0x4a: // DECA
			return void(this.a = this.deca(this.a));
		case 0x4c: // INCA
			return void(this.a = this.inca(this.a));
		case 0x4d: // TSTA
			return void this.tsta(this.a);
		case 0x4f: // CLRA
			return void(this.a = this.clra());
		case 0x50: // NEGX
			return void(this.x = this.nega(this.x));
		case 0x53: // COMX
			return void(this.x = this.coma(this.x));
		case 0x54: // LSRX
			return void(this.x = this.lsra(this.x));
		case 0x56: // RORX
			return void(this.x = this.rora(this.x));
		case 0x57: // ASRX
			return void(this.x = this.asra(this.x));
		case 0x58: // ASLX(LSLX)
			return void(this.x = this.lsla(this.x));
		case 0x59: // ROLX
			return void(this.x = this.rola(this.x));
		case 0x5a: // DECX
			return void(this.x = this.deca(this.x));
		case 0x5c: // INCX
			return void(this.x = this.inca(this.x));
		case 0x5d: // TSTX
			return void this.tsta(this.x);
		case 0x5f: // CLRX
			return void(this.x = this.clra());
		case 0x60: // NEG n,X
			return void this.neg(this.index1());
		case 0x63: // COM n,X
			return void this.com(this.index1());
		case 0x64: // LSR n,X
			return void this.lsr(this.index1());
		case 0x66: // ROR n,X
			return void this.ror(this.index1());
		case 0x67: // ASR n,X
			return void this.asr(this.index1());
		case 0x68: // ASL(LSL) n,X
			return void this.lsl(this.index1());
		case 0x69: // ROL n,X
			return void this.rol(this.index1());
		case 0x6a: // DEC n,X
			return void this.dec(this.index1());
		case 0x6c: // INC n,X
			return void this.inc(this.index1());
		case 0x6d: // TST n,X
			return void this.tst(this.index1());
		case 0x6f: // CLR n,X
			return void this.clr(this.index1());
		case 0x70: // NEG ,X
			return void this.neg(this.index());
		case 0x73: // COM ,X
			return void this.com(this.index());
		case 0x74: // LSR ,X
			return void this.lsr(this.index());
		case 0x76: // ROR ,X
			return void this.ror(this.index());
		case 0x77: // ASR ,X
			return void this.asr(this.index());
		case 0x78: // ASL(LSL) ,X
			return void this.lsl(this.index());
		case 0x79: // ROL ,X
			return void this.rol(this.index());
		case 0x7a: // DEC ,X
			return void this.dec(this.index());
		case 0x7c: // INC ,X
			return void this.inc(this.index());
		case 0x7d: // TST ,X
			return void this.tst(this.index());
		case 0x7f: // CLR ,X
			return void this.clr(this.index());
		case 0x80: // RTI
			this.ccr = (v = this.pul()) << 1 & 0x2c | v & 1;
			this.a = this.pul();
			this.x = this.pul();
			this.pc = this.pul16() & 0x7ff;
			return;
		case 0x81: // RTS
			return void(this.pc = this.pul16() & 0x7ff);
		case 0x83: // SWI
			this.psh16(this.pc);
			this.psh(this.x);
			this.psh(this.a);
			this.psh(0xe0 | this.ccr >> 1 & 0x1e | this.ccr & 1);
			this.ccr |= 0x10;
			this.pc = (this.read(0x7fc) << 8 | this.read(0x7fd)) & 0x7ff;
			return;
		case 0x8e: // STOP
		case 0x8f: // WAIT
			this.ccr &= ~0x10;
			this.suspend();
			return;
		case 0x97: // TAX
			return void(this.x = this.a);
		case 0x98: // CLC
			return void(this.ccr &= ~1);
		case 0x99: // SEC
			return void(this.ccr |= 1);
		case 0x9a: // CLI
			return void(this.ccr &= ~0x10);
		case 0x9b: // SEI
			return void(this.ccr |= 0x10);
		case 0x9c: // RSP
			return void(this.s = 0x7f);
		case 0x9d: // NOP
			return;
		case 0x9f: // TXA
			return void(this.a = this.x);
		case 0xa0: // SUB #n
			return void(this.a = this.sub(this.a, null));
		case 0xa1: // CMP #n
			return void this.cmp(this.a, null);
		case 0xa2: // SBC #n
			return void(this.a = this.sbc(this.a, null));
		case 0xa3: // CPX #n
			return void this.cmp(this.x, null);
		case 0xa4: // AND #n
			return void(this.a = this.and(this.a, null));
		case 0xa5: // BIT #n
			return void this.bit(this.a, null);
		case 0xa6: // LDA #n
			return void(this.a = this.ld(null));
		case 0xa8: // EOR #n
			return void(this.a = this.eor(this.a, null));
		case 0xa9: // ADC #n
			return void(this.a = this.adc(this.a, null));
		case 0xaa: // ORA #n
			return void(this.a = this.or(this.a, null));
		case 0xab: // ADD #n
			return void(this.a = this.add(this.a, null));
		case 0xad: // BSR
			return void this.bsr();
		case 0xae: // LDX #n
			return void(this.x = this.ld(null));
		case 0xb0: // SUB <n
			return void(this.a = this.sub(this.a, this.direct()));
		case 0xb1: // CMP <n
			return void this.cmp(this.a, this.direct());
		case 0xb2: // SBC <n
			return void(this.a = this.sbc(this.a, this.direct()));
		case 0xb3: // CPX <n
			return void this.cmp(this.x, this.direct());
		case 0xb4: // AND <n
			return void(this.a = this.and(this.a, this.direct()));
		case 0xb5: // BIT <n
			return void this.bit(this.a, this.direct());
		case 0xb6: // LDA <n
			return void(this.a = this.ld(this.direct()));
		case 0xb7: // STA <n
			return void this.st(this.a, this.direct());
		case 0xb8: // EOR <n
			return void(this.a = this.eor(this.a, this.direct()));
		case 0xb9: // ADC <n
			return void(this.a = this.adc(this.a, this.direct()));
		case 0xba: // ORA <n
			return void(this.a = this.or(this.a, this.direct()));
		case 0xbb: // ADD <n
			return void(this.a = this.add(this.a, this.direct()));
		case 0xbc: // JMP <n
			return void(this.pc = this.direct());
		case 0xbd: // JSR <n
			return void this.jsr(this.direct());
		case 0xbe: // LDX <n
			return void(this.x = this.ld(this.direct()));
		case 0xbf: // STX <n
			return void this.st(this.x, this.direct());
		case 0xc0: // SUB >nn
			return void(this.a = this.sub(this.a, this.extend()));
		case 0xc1: // CMP >nn
			return void this.cmp(this.a, this.extend());
		case 0xc2: // SBC >nn
			return void(this.a = this.sbc(this.a, this.extend()));
		case 0xc3: // CPX >nn
			return void this.cmp(this.x, this.extend());
		case 0xc4: // AND >nn
			return void(this.a = this.and(this.a, this.extend()));
		case 0xc5: // BIT >nn
			return void this.bit(this.a, this.extend());
		case 0xc6: // LDA >nn
			return void(this.a = this.ld(this.extend()));
		case 0xc7: // STA >nn
			return void this.st(this.a, this.extend());
		case 0xc8: // EOR >nn
			return void(this.a = this.eor(this.a, this.extend()));
		case 0xc9: // ADC >nn
			return void(this.a = this.adc(this.a, this.extend()));
		case 0xca: // ORA >nn
			return void(this.a = this.or(this.a, this.extend()));
		case 0xcb: // ADD >nn
			return void(this.a = this.add(this.a, this.extend()));
		case 0xcc: // JMP >nn
			return void(this.pc = this.extend());
		case 0xcd: // JSR >nn
			return void this.jsr(this.extend());
		case 0xce: // LDX >nn
			return void(this.x = this.ld(this.extend()));
		case 0xcf: // STX >nn
			return void this.st(this.x, this.extend());
		case 0xd0: // SUB nn,X
			return void(this.a = this.sub(this.a, this.index2()));
		case 0xd1: // CMP nn,X
			return void this.cmp(this.a, this.index2());
		case 0xd2: // SBC nn,X
			return void(this.a = this.sbc(this.a, this.index2()));
		case 0xd3: // CPX nn,X
			return void this.cmp(this.x, this.index2());
		case 0xd4: // AND nn,X
			return void(this.a = this.and(this.a, this.index2()));
		case 0xd5: // BIT nn,X
			return void this.bit(this.a, this.index2());
		case 0xd6: // LDA nn,X
			return void(this.a = this.ld(this.index2()));
		case 0xd7: // STA nn,X
			return void this.st(this.a, this.index2());
		case 0xd8: // EOR nn,X
			return void(this.a = this.eor(this.a, this.index2()));
		case 0xd9: // ADC nn,X
			return void(this.a = this.adc(this.a, this.index2()));
		case 0xda: // ORA nn,X
			return void(this.a = this.or(this.a, this.index2()));
		case 0xdb: // ADD nn,X
			return void(this.a = this.add(this.a, this.index2()));
		case 0xdc: // JMP nn,X
			return void(this.pc = this.index2());
		case 0xdd: // JSR nn,X
			return void this.jsr(this.index2());
		case 0xde: // LDX nn,X
			return void(this.x = this.ld(this.index2()));
		case 0xdf: // STX nn,X
			return void this.st(this.x, this.index2());
		case 0xe0: // SUB n,X
			return void(this.a = this.sub(this.a, this.index1()));
		case 0xe1: // CMP n,X
			return void this.cmp(this.a, this.index1());
		case 0xe2: // SBC n,X
			return void(this.a = this.sbc(this.a, this.index1()));
		case 0xe3: // CPX n,X
			return void this.cmp(this.x, this.index1());
		case 0xe4: // AND n,X
			return void(this.a = this.and(this.a, this.index1()));
		case 0xe5: // BIT n,X
			return void this.bit(this.a, this.index1());
		case 0xe6: // LDA n,X
			return void(this.a = this.ld(this.index1()));
		case 0xe7: // STA n,X
			return void this.st(this.a, this.index1());
		case 0xe8: // EOR n,X
			return void(this.a = this.eor(this.a, this.index1()));
		case 0xe9: // ADC n,X
			return void(this.a = this.adc(this.a, this.index1()));
		case 0xea: // ORA n,X
			return void(this.a = this.or(this.a, this.index1()));
		case 0xeb: // ADD n,X
			return void(this.a = this.add(this.a, this.index1()));
		case 0xec: // JMP n,X
			return void(this.pc = this.index1());
		case 0xed: // JSR n,X
			return void this.jsr(this.index1());
		case 0xee: // LDX n,X
			return void(this.x = this.ld(this.index1()));
		case 0xef: // STX n,X
			return void this.st(this.x, this.index1());
		case 0xf0: // SUB ,X
			return void(this.a = this.sub(this.a, this.index()));
		case 0xf1: // CMP ,X
			return void this.cmp(this.a, this.index());
		case 0xf2: // SBC ,X
			return void(this.a = this.sbc(this.a, this.index()));
		case 0xf3: // CPX ,X
			return void this.cmp(this.x, this.index());
		case 0xf4: // AND ,X
			return void(this.a = this.and(this.a, this.index()));
		case 0xf5: // BIT ,X
			return void this.bit(this.a, this.index());
		case 0xf6: // LDA ,X
			return void(this.a = this.ld(this.index()));
		case 0xf7: // STA ,X
			return void this.st(this.a, this.index());
		case 0xf8: // EOR ,X
			return void(this.a = this.eor(this.a, this.index()));
		case 0xf9: // ADC ,X
			return void(this.a = this.adc(this.a, this.index()));
		case 0xfa: // ORA ,X
			return void(this.a = this.or(this.a, this.index()));
		case 0xfb: // ADD ,X
			return void(this.a = this.add(this.a, this.index()));
		case 0xfc: // JMP ,X
			return void(this.pc = this.index());
		case 0xfd: // JSR ,X
			return void this.jsr(this.index());
		case 0xfe: // LDX ,X
			return void(this.x = this.ld(this.index()));
		case 0xff: // STX ,X
			return void this.st(this.x, this.index());
		default:
			this.undefsize = 1;
			if (this.undef)
				this.undef(this.arg);
			return;
		}
	}

	index() {
		return this.x;
	}

	index1() {
		return this.x + this.fetch();
	}

	index2() {
		return this.x + (this.fetch() << 8 | this.fetch()) & 0x7ff;
	}

	direct() {
		return this.fetch();
	}

	extend() {
		return (this.fetch() << 8 | this.fetch()) & 0x7ff;
	}

	bcc(cond) {
		const n = this.fetch();
		if (cond) this.pc = this.pc + n - (n << 1 & 0x100) & 0x7ff;
	}

	bsr() {
		const n = this.fetch();
		this.psh16(this.pc);
		this.pc = this.pc + n - (n << 1 & 0x100) & 0x7ff;
	}

	nega(r) {
		r = MC6805.aSub[0][r][0];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	coma(r) {
		this.ccr = this.ccr & ~0x0f | 1 | MC6805.fLogic[r = ~r & 0xff];
		return r;
	}

	lsra(r) {
		r = MC6805.aRr[0][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	rora(r) {
		r = MC6805.aRr[this.ccr & 1][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	asra(r) {
		r = MC6805.aRr[r >>> 7][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	lsla(r) {
		r = MC6805.aRl[0][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	rola(r) {
		r = MC6805.aRl[this.ccr & 1][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	deca(r) {
		r = MC6805.aSub[0][1][r];
		this.ccr = this.ccr & ~0x0e | r >>> 8 & 0x0e;
		return r & 0xff;
	}

	inca(r) {
		r = MC6805.aAdd[0][1][r];
		this.ccr = this.ccr & ~0x0e | r >>> 8 & 0x0e;
		return r & 0xff;
	}

	tsta(r) {
		this.ccr = this.ccr & ~0x0e | MC6805.fLogic[r];
	}

	clra() {
		this.ccr = this.ccr & ~0x0e | 4;
		return 0;
	}

	neg(ea) {
		const r = MC6805.aSub[0][this.read(ea)][0];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		this.write(ea, r & 0xff);
	}

	com(ea) {
		const r = ~this.read(ea) & 0xff;
		this.ccr = this.ccr & ~0x0f | 1 | MC6805.fLogic[r];
		this.write(ea, r);
	}

	lsr(ea) {
		const r = MC6805.aRr[0][this.read(ea)];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		this.write(ea, r & 0xff);
	}

	ror(ea) {
		const r = MC6805.aRr[this.ccr & 1][this.read(ea)];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		this.write(ea, r & 0xff);
	}

	asr(ea) {
		let r = this.read(ea);
		r = MC6805.aRr[r >>> 7][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		this.write(ea, r & 0xff);
	}

	lsl(ea) {
		const r = MC6805.aRl[0][this.read(ea)];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		this.write(ea, r & 0xff);
	}

	rol(ea) {
		const r = MC6805.aRl[this.ccr & 1][this.read(ea)];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		this.write(ea, r & 0xff);
	}

	dec(ea) {
		const r = MC6805.aSub[0][1][this.read(ea)];
		this.ccr = this.ccr & ~0x0e | r >>> 8 & 0x0e;
		this.write(ea, r & 0xff);
	}

	inc(ea) {
		const r = MC6805.aAdd[0][1][this.read(ea)];
		this.ccr = this.ccr & ~0x0e | r >>> 8 & 0x0e;
		this.write(ea, r & 0xff);
	}

	tst(ea) {
		this.ccr = this.ccr & ~0x0e | MC6805.fLogic[this.read(ea)];
	}

	clr(ea) {
		this.ccr = this.ccr & ~0x0e | 4;
		this.write(ea, 0);
	}

	sub(r, ea) {
		r = MC6805.aSub[0][this.readf(ea)][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	cmp(r, ea) {
		this.ccr = this.ccr & ~0x0f | MC6805.aSub[0][this.readf(ea)][r] >>> 8;
	}

	sbc(r, ea) {
		r = MC6805.aSub[this.ccr & 1][this.readf(ea)][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	and(r, ea) {
		this.ccr = this.ccr & ~0x0e | MC6805.fLogic[r &= this.readf(ea)];
		return r;
	}

	bit(r, ea) {
		this.ccr = this.ccr & ~0x0e | MC6805.fLogic[r & this.readf(ea)];
	}

	ld(ea) {
		const r = this.readf(ea);
		this.ccr = this.ccr & ~0x0e | MC6805.fLogic[r];
		return r;
	}

	st(r, ea) {
		this.ccr = this.ccr & ~0x0e | MC6805.fLogic[this.write(ea, r)];
	}

	eor(r, ea) {
		this.ccr = this.ccr & ~0x0e | MC6805.fLogic[r ^= this.readf(ea)];
		return r;
	}

	adc(r, ea) {
		r = MC6805.aAdd[this.ccr & 1][this.readf(ea)][r];
		this.ccr = this.ccr & ~0x2f | r >>> 8;
		return r & 0xff;
	}

	or(r, ea) {
		this.ccr = this.ccr & ~0x0e | MC6805.fLogic[r |= this.readf(ea)];
		return r;
	}

	add(r, ea) {
		r = MC6805.aAdd[0][this.readf(ea)][r];
		this.ccr = this.ccr & ~0x2f | r >>> 8;
		return r & 0xff;
	}

	jsr(ea) {
		this.psh16(this.pc);
		this.pc = ea;
	}

	psh(r) {
		this.write(this.s, r);
		this.s = this.s - 1 & 0x1f | 0x60;
	}

	pul() {
		this.s = this.s + 1 & 0x1f | 0x60;
		return this.read(this.s);
	}

	psh16(r) {
		this.write(this.s, r & 0xff);
		this.s = this.s - 1 & 0x1f | 0x60;
		this.write(this.s, r >>> 8);
		this.s = this.s - 1 & 0x1f | 0x60;
	}

	pul16() {
		this.s = this.s + 1 & 0x1f | 0x60;
		const r = this.read(this.s) << 8;
		this.s = this.s + 1 & 0x1f | 0x60;
		return r | this.read(this.s);
	}

	fetch() {
		const page = this.memorymap[this.pc >>> 8];
		const data = !page.fetch ? page.base[this.pc & 0xff] : page.fetch(this.pc, this.arg);
		this.pc = this.pc + 1 & 0x7ff;
		return data;
	}

	readf(addr) {
		const page = this.memorymap[addr >>> 8];
		if (addr === null) {
			const data = !page.fetch ? page.base[this.pc & 0xff] : page.fetch(this.pc, this.arg);
			this.pc = this.pc + 1 & 0x7ff;
			return data;
		}
		return !page.read ? page.base[addr & 0xff] : page.read(addr, this.arg);
	}
}

void function () {
	let f, i, j, k, r;

	MC6805.aAdd = []; // [2][0x100][0x100];
	MC6805.aSub = []; // [2][0x100][0x100];
	MC6805.aRl = []; // [2][0x100];
	MC6805.aRr = []; // [2][0x100];
	MC6805.fLogic = new Uint8Array(0x100);

	for (i = 0; i < 2; i++) {
		MC6805.aAdd[i] = [];
		for (j = 0; j < 0x100; j++)
			MC6805.aAdd[i][j] = new Uint16Array(0x100);
	}
	for (i = 0; i < 2; i++) {
		MC6805.aSub[i] = [];
		for (j = 0; j < 0x100; j++)
			MC6805.aSub[i][j] = new Uint16Array(0x100);
	}
	for (i = 0; i < 2; i++)
		MC6805.aRl[i] = new Uint16Array(0x100);
	for (i = 0; i < 2; i++)
		MC6805.aRr[i] = new Uint16Array(0x100);

	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++)
			for (k = 0; k < 0x100; k++) {
				r = j + k + i & 0xff;
				const c = j & k | k & ~r | ~r & j;
				f = c << 2 & 0x20 | r >>> 4 & 8 | !r << 2 | c >>> 7 & 1;
				MC6805.aAdd[i][k][j] = f << 8 | r;
			}
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++)
			for (k = 0; k < 0x100; k++) {
				r = j - k - i & 0xff;
				const c = ~j & k | k & r | r & ~j;
				f = r >>> 4 & 8 | !r << 2 | c >>> 7 & 1;
				MC6805.aSub[i][k][j] = f << 8 | r;
			}
	for (i = 0; i < 0x100; i++)
		MC6805.fLogic[i] = i >>> 4 & 8 | !i << 2;
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++) {
			r = (j << 1 | i) & 0xff;
			f = MC6805.fLogic[r] | j >>> 7;
			MC6805.aRl[i][j] = f << 8 | r;
		}
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++) {
			r = j >>> 1 | i << 7;
			f = MC6805.fLogic[r] | j & 1;
			MC6805.aRr[i][j] = f << 8 | r;
		}
}();

