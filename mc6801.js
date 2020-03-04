/*
 *
 *	MC6801 Emulator
 *
 */

import Cpu from './main.js';

export default class MC6801 extends Cpu {
	constructor(arg = null) {
		super(arg);
		this.a = 0;
		this.b = 0;
		this.ccr = 0; // ccr:11hinzvc
		this.x = 0;
		this.s = 0;
	}

	reset() {
		super.reset();
		this.ccr = 0xd0;
		this.pc = this.read(0xfffe) << 8 | this.read(0xffff);
	}

	interrupt(cause) {
		if (!super.interrupt() || (this.ccr & 0x10) !== 0)
			return false;
		this.psh16(this.pc);
		this.psh16(this.x);
		this.psh(this.a);
		this.psh(this.b);
		this.psh(this.ccr);
		this.ccr |= 0x10;
		switch (cause) {
		default:
			this.pc = this.read(0xfff8) << 8 | this.read(0xfff9);
			break;
		case 'icf':
			this.pc = this.read(0xfff6) << 8 | this.read(0xfff7);
			break;
		case 'ocf':
			this.pc = this.read(0xfff4) << 8 | this.read(0xfff5);
			break;
		case 'tof':
			this.pc = this.read(0xfff2) << 8 | this.read(0xfff3);
			break;
		case 'sci':
			this.pc = this.read(0xfff0) << 8 | this.read(0xfff1);
			break;
		}
		return true;
	}

	non_maskable_interrupt() {
		if (!super.interrupt())
			return false;
		this.psh16(this.pc);
		this.psh16(this.x);
		this.psh(this.a);
		this.psh(this.b);
		this.psh(this.ccr);
		this.ccr |= 0x10;
		this.pc = this.read(0xfffc) << 8 | this.read(0xfffd);
		return true;
	}

	_execute() {
		let v;

		switch (this.fetch()) {
		case 0x01: // NOP
			return;
		case 0x04: // LSRD
			this.a = (v = MC6801.aRr[0][this.a]) & 0xff;
			this.b = (v = MC6801.aRr[v >>> 8 & 1][this.b]) & 0xff;
			this.ccr = this.ccr & ~0x0f | !(this.a | this.b) << 2 | v >>> 7 & 2 | v >>> 8 & 1;
			return;
		case 0x05: // LSLD
			this.b = (v = MC6801.aRl[0][this.b]) & 0xff;
			this.a = (v = MC6801.aRl[v >>> 8 & 1][this.a]) & 0xff;
			this.ccr = this.ccr & ~0x0f | !(this.a | this.b) << 2 | v >>> 8 & 0x0b;
			return;
		case 0x06: // TAP
			return void(this.ccr = this.a | 0xc0);
		case 0x07: // TPA
			return void(this.a = this.ccr);
		case 0x08: // INX
			this.x = this.x + 1 & 0xffff;
			this.ccr = this.ccr & ~4 | (this.x === 0) << 2;
			return;
		case 0x09: // DEX
			this.x = this.x - 1 & 0xffff;
			this.ccr = this.ccr & ~4 | (this.x === 0) << 2;
			return;
		case 0x0a: // CLV
			return void(this.ccr &= ~2);
		case 0x0b: // SEV
			return void(this.ccr |= 2);
		case 0x0c: // CLC
			return void(this.ccr &= ~1);
		case 0x0d: // SEC
			return void(this.ccr |= 1);
		case 0x0e: // CLI
			return void(this.ccr &= ~0x10);
		case 0x0f: // SEI
			return void(this.ccr |= 0x10);
		case 0x10: // SBA
			this.a = (v = MC6801.aSub[0][this.b][this.a]) & 0xff;
			this.ccr = this.ccr & ~0x0f | v >>> 8;
			return;
		case 0x11: // CBA
			return void(this.ccr = this.ccr & ~0x0f | MC6801.aSub[0][this.b][this.a] >>> 8);
		case 0x12: // undocumented instruction
		case 0x13: // undocumented instruction
			return void(this.x = this.x + this.read1(this.s) & 0xffff);
		case 0x16: // TAB
			return void(this.ccr = this.ccr & ~0x0e | MC6801.fLogic[this.b = this.a]);
		case 0x17: // TBA
			return void(this.ccr = this.ccr & ~0x0e | MC6801.fLogic[this.a = this.b]);
		case 0x18: // XGDX
			v = this.x;
			this.x = this.a << 8 | this.b;
			this.b = v & 0xff;
			this.a = v >>> 8;
			return;
		case 0x19: // DAA
			this.a = (v = MC6801.aDaa[this.ccr >>> 4 & 2 | this.ccr & 1][this.a]) & 0xff;
			this.ccr = this.ccr & ~0x0f | v >>> 8;
			return;
		case 0x1a: // SLP
			return this.suspend();
		case 0x1b: // ABA
			this.a = (v = MC6801.aAdd[0][this.b][this.a]) & 0xff;
			this.ccr = this.ccr & ~0x2f | v >>> 8;
			return;
		case 0x20: // BRA
			return this.bcc(true);
		case 0x21: // BRN
			return this.bcc(false);
		case 0x22: // BHI
			return this.bcc(((this.ccr >>> 2 | this.ccr) & 1) === 0);
		case 0x23: // BLS
			return this.bcc(((this.ccr >>> 2 | this.ccr) & 1) !== 0);
		case 0x24: // BHS(BCC)
			return this.bcc((this.ccr & 1) === 0);
		case 0x25: // BLO(BCS)
			return this.bcc((this.ccr & 1) !== 0);
		case 0x26: // BNE
			return this.bcc((this.ccr & 4) === 0);
		case 0x27: // BEQ
			return this.bcc((this.ccr & 4) !== 0);
		case 0x28: // BVC
			return this.bcc((this.ccr & 2) === 0);
		case 0x29: // BVS
			return this.bcc((this.ccr & 2) !== 0);
		case 0x2a: // BPL
			return this.bcc((this.ccr & 8) === 0);
		case 0x2b: // BMI
			return this.bcc((this.ccr & 8) !== 0);
		case 0x2c: // BGE
			return this.bcc(((this.ccr >>> 2 ^ this.ccr) & 2) === 0);
		case 0x2d: // BLT
			return this.bcc(((this.ccr >>> 2 ^ this.ccr) & 2) !== 0);
		case 0x2e: // BGT
			return this.bcc(((this.ccr >>> 2 ^ this.ccr | this.ccr >>> 1) & 2) === 0);
		case 0x2f: // BLE
			return this.bcc(((this.ccr >>> 2 ^ this.ccr | this.ccr >>> 1) & 2) !== 0);
		case 0x30: // TSX
			return void(this.x = this.s + 1 & 0xffff);
		case 0x31: // INS
			return void(this.s = this.s + 1 & 0xffff);
		case 0x32: // PULA
			return void(this.a = this.pul());
		case 0x33: // PULB
			return void(this.b = this.pul());
		case 0x34: // DES
			return void(this.s = this.s - 1 & 0xffff);
		case 0x35: // TXS
			return void(this.s = this.x - 1 & 0xffff);
		case 0x36: // PSHA
			return this.psh(this.a);
		case 0x37: // PSHB
			return this.psh(this.b);
		case 0x38: // PULX
			return void(this.x = this.pul16());
		case 0x39: // RTS
			return void(this.pc = this.pul16());
		case 0x3a: // ABX
			return void(this.x = this.x + this.b & 0xffff);
		case 0x3b: // RTI
			this.ccr = this.pul() | 0xc0;
			this.b = this.pul();
			this.a = this.pul();
			this.x = this.pul16();
			this.pc = this.pul16();
			return;
		case 0x3c: // PSHX
			return this.psh16(this.x);
		case 0x3d: // MUL
			this.a = (v = this.a * this.b) >>> 8;
			this.b = v & 0xff;
			this.ccr = this.ccr & ~1 | v >>> 7 & 1;
			return;
		case 0x3e: // WAI
			return this.suspend();
		case 0x3f: // SWI
			this.psh16(this.pc);
			this.psh16(this.x);
			this.psh(this.a);
			this.psh(this.b);
			this.psh(this.ccr);
			this.ccr |= 0x10;
			this.pc = this.read(0xfffa) << 8 | this.read(0xfffb);
			return;
		case 0x40: // NEGA
			return void(this.a = this.nega(this.a));
		case 0x43: // COMA
			return void(this.a = this.coma(this.a));
		case 0x44: // LSRA
			return void(this.a = this.lsra(this.a));
		case 0x46: // RORA
			return void(this.a = this.rora(this.a));
		case 0x47: // ASRA
			return void(this.a = this.asra(this.a));
		case 0x48: // LSLA
			return void(this.a = this.lsla(this.a));
		case 0x49: // ROLA
			return void(this.a = this.rola(this.a));
		case 0x4a: // DECA
			return void(this.a = this.deca(this.a));
		case 0x4c: // INCA
			return void(this.a = this.inca(this.a));
		case 0x4d: // TSTA
			return this.tsta(this.a);
		case 0x4f: // CLRA
			return void(this.a = this.clra());
		case 0x50: // NEGB
			return void(this.b = this.nega(this.b));
		case 0x53: // COMB
			return void(this.b = this.coma(this.b));
		case 0x54: // LSRB
			return void(this.b = this.lsra(this.b));
		case 0x56: // RORB
			return void(this.b = this.rora(this.b));
		case 0x57: // ASRB
			return void(this.b = this.asra(this.b));
		case 0x58: // LSLB
			return void(this.b = this.lsla(this.b));
		case 0x59: // ROLB
			return void(this.b = this.rola(this.b));
		case 0x5a: // DECB
			return void(this.b = this.deca(this.b));
		case 0x5c: // INCB
			return void(this.b = this.inca(this.b));
		case 0x5d: // TSTB
			return this.tsta(this.b);
		case 0x5f: // CLRB
			return void(this.b = this.clra());
		case 0x60: // NEG ,X
			return this.neg(this.index());
		case 0x61: // AIM ,X
			return this.aim(this.fetch(), this.index());
		case 0x62: // OIM ,X
			return this.oim(this.fetch(), this.index());
		case 0x63: // COM ,X
			return this.com(this.index());
		case 0x64: // LSR ,X
			return this.lsr(this.index());
		case 0x65: // EIM ,X
			return this.eim(this.fetch(), this.index());
		case 0x66: // ROR ,X
			return this.ror(this.index());
		case 0x67: // ASR ,X
			return this.asr(this.index());
		case 0x68: // LSL ,X
			return this.lsl(this.index());
		case 0x69: // ROL ,X
			return this.rol(this.index());
		case 0x6a: // DEC ,X
			return this.dec(this.index());
		case 0x6b: // TIM ,X
			return this.tim(this.fetch(), this.index());
		case 0x6c: // INC ,X
			return this.inc(this.index());
		case 0x6d: // TST ,X
			return this.tst(this.index());
		case 0x6e: // JMP ,X
			return void(this.pc = this.index());
		case 0x6f: // CLR ,X
			return this.clr(this.index());
		case 0x70: // NEG >nn
			return this.neg(this.extend());
		case 0x71: // AIM <n
			return this.aim(this.fetch(), this.direct());
		case 0x72: // OIM <n
			return this.oim(this.fetch(), this.direct());
		case 0x73: // COM >nn
			return this.com(this.extend());
		case 0x74: // LSR >nn
			return this.lsr(this.extend());
		case 0x75: // EIM <n
			return this.eim(this.fetch(), this.direct());
		case 0x76: // ROR >nn
			return this.ror(this.extend());
		case 0x77: // ASR >nn
			return this.asr(this.extend());
		case 0x78: // LSL >nn
			return this.lsl(this.extend());
		case 0x79: // ROL >nn
			return this.rol(this.extend());
		case 0x7a: // DEC >nn
			return this.dec(this.extend());
		case 0x7b: // TIM <n
			return this.tim(this.fetch(), this.direct());
		case 0x7c: // INC >nn
			return this.inc(this.extend());
		case 0x7d: // TST >nn
			return this.tst(this.extend());
		case 0x7e: // JMP >nn
			return void(this.pc = this.extend());
		case 0x7f: // CLR >nn
			return this.clr(this.extend());
		case 0x80: // SUBA #n
			return void(this.a = this.sub(this.a, null));
		case 0x81: // CMPA #n
			return this.cmp(this.a, null);
		case 0x82: // SBCA #n
			return void(this.a = this.sbc(this.a, null));
		case 0x83: // SUBD #nn
			return this.subd(null);
		case 0x84: // ANDA #n
			return void(this.a = this.and(this.a, null));
		case 0x85: // BITA #n
			return this.bit(this.a, null);
		case 0x86: // LDAA #n
			return void(this.a = this.ld(null));
		case 0x88: // EORA #n
			return void(this.a = this.eor(this.a, null));
		case 0x89: // ADCA #n
			return void(this.a = this.adc(this.a, null));
		case 0x8a: // ORAA #n
			return void(this.a = this.or(this.a, null));
		case 0x8b: // ADDA #n
			return void(this.a = this.add(this.a, null));
		case 0x8c: // CPX #nn
			return this.cmp16(this.x, null);
		case 0x8d: // BSR
			return this.bsr();
		case 0x8e: // LDS #nn
			return void(this.s = this.ld16(null));
		case 0x90: // SUBA <n
			return void(this.a = this.sub(this.a, this.direct()));
		case 0x91: // CMPA <n
			return this.cmp(this.a, this.direct());
		case 0x92: // SBCA <n
			return void(this.a = this.sbc(this.a, this.direct()));
		case 0x93: // SUBD <n
			return this.subd(this.direct());
		case 0x94: // ANDA <n
			return void(this.a = this.and(this.a, this.direct()));
		case 0x95: // BITA <n
			return this.bit(this.a, this.direct());
		case 0x96: // LDAA <n
			return void(this.a = this.ld(this.direct()));
		case 0x97: // STAA <n
			return this.st(this.a, this.direct());
		case 0x98: // EORA <n
			return void(this.a = this.eor(this.a, this.direct()));
		case 0x99: // ADCA <n
			return void(this.a = this.adc(this.a, this.direct()));
		case 0x9a: // ORAA <n
			return void(this.a = this.or(this.a, this.direct()));
		case 0x9b: // ADDA <n
			return void(this.a = this.add(this.a, this.direct()));
		case 0x9c: // CPX <n
			return this.cmp16(this.x, this.direct());
		case 0x9d: // JSR <n
			return this.jsr(this.direct());
		case 0x9e: // LDS <n
			return void(this.s = this.ld16(this.direct()));
		case 0x9f: // STS <n
			return this.st16(this.s, this.direct());
		case 0xa0: // SUBA ,X
			return void(this.a = this.sub(this.a, this.index()));
		case 0xa1: // CMPA ,X
			return this.cmp(this.a, this.index());
		case 0xa2: // SBCA ,X
			return void(this.a = this.sbc(this.a, this.index()));
		case 0xa3: // SUBD ,X
			return this.subd(this.index());
		case 0xa4: // ANDA ,X
			return void(this.a = this.and(this.a, this.index()));
		case 0xa5: // BITA ,X
			return this.bit(this.a, this.index());
		case 0xa6: // LDAA ,X
			return void(this.a = this.ld(this.index()));
		case 0xa7: // STAA ,X
			return this.st(this.a, this.index());
		case 0xa8: // EORA ,X
			return void(this.a = this.eor(this.a, this.index()));
		case 0xa9: // ADCA ,X
			return void(this.a = this.adc(this.a, this.index()));
		case 0xaa: // ORAA ,X
			return void(this.a = this.or(this.a, this.index()));
		case 0xab: // ADDA ,X
			return void(this.a = this.add(this.a, this.index()));
		case 0xac: // CPX ,X
			return this.cmp16(this.x, this.index());
		case 0xad: // JSR ,X
			return this.jsr(this.index());
		case 0xae: // LDS ,X
			return void(this.s = this.ld16(this.index()));
		case 0xaf: // STS ,X
			return this.st16(this.s, this.index());
		case 0xb0: // SUBA >nn
			return void(this.a = this.sub(this.a, this.extend()));
		case 0xb1: // CMPA >nn
			return this.cmp(this.a, this.extend());
		case 0xb2: // SBCA >nn
			return void(this.a = this.sbc(this.a, this.extend()));
		case 0xb3: // SUBD >nn
			return this.subd(this.extend());
		case 0xb4: // ANDA >nn
			return void(this.a = this.and(this.a, this.extend()));
		case 0xb5: // BITA >nn
			return this.bit(this.a, this.extend());
		case 0xb6: // LDAA >nn
			return void(this.a = this.ld(this.extend()));
		case 0xb7: // STAA >nn
			return this.st(this.a, this.extend());
		case 0xb8: // EORA >nn
			return void(this.a = this.eor(this.a, this.extend()));
		case 0xb9: // ADCA >nn
			return void(this.a = this.adc(this.a, this.extend()));
		case 0xba: // ORAA >nn
			return void(this.a = this.or(this.a, this.extend()));
		case 0xbb: // ADDA >nn
			return void(this.a = this.add(this.a, this.extend()));
		case 0xbc: // CPX >nn
			return this.cmp16(this.x, this.extend());
		case 0xbd: // JSR >nn
			return this.jsr(this.extend());
		case 0xbe: // LDS >nn
			return void(this.s = this.ld16(this.extend()));
		case 0xbf: // STS >nn
			return this.st16(this.s, this.extend());
		case 0xc0: // SUBB #n
			return void(this.b = this.sub(this.b, null));
		case 0xc1: // CMPB #n
			return this.cmp(this.b, null);
		case 0xc2: // SBCB #n
			return void(this.b = this.sbc(this.b, null));
		case 0xc3: // ADDD #nn
			return this.addd(null);
		case 0xc4: // ANDB #n
			return void(this.b = this.and(this.b, null));
		case 0xc5: // BITB #n
			return this.bit(this.b, null);
		case 0xc6: // LDAB #n
			return void(this.b = this.ld(null));
		case 0xc8: // EORB #n
			return void(this.b = this.eor(this.b, null));
		case 0xc9: // ADCB #n
			return void(this.b = this.adc(this.b, null));
		case 0xca: // ORAB #n
			return void(this.b = this.or(this.b, null));
		case 0xcb: // ADDB #n
			return void(this.b = this.add(this.b, null));
		case 0xcc: // LDD #nn
			return this.ldd(null);
		case 0xce: // LDX #nn
			return void(this.x = this.ld16(null));
		case 0xd0: // SUBB <n
			return void(this.b = this.sub(this.b, this.direct()));
		case 0xd1: // CMPB <n
			return this.cmp(this.b, this.direct());
		case 0xd2: // SBCB <n
			return void(this.b = this.sbc(this.b, this.direct()));
		case 0xd3: // ADDD <n
			return this.addd(this.direct());
		case 0xd4: // ANDB <n
			return void(this.b = this.and(this.b, this.direct()));
		case 0xd5: // BITB <n
			return this.bit(this.b, this.direct());
		case 0xd6: // LDAB <n
			return void(this.b = this.ld(this.direct()));
		case 0xd7: // STAB <n
			return this.st(this.b, this.direct());
		case 0xd8: // EORB <n
			return void(this.b = this.eor(this.b, this.direct()));
		case 0xd9: // ADCB <n
			return void(this.b = this.adc(this.b, this.direct()));
		case 0xda: // ORAB <n
			return void(this.b = this.or(this.b, this.direct()));
		case 0xdb: // ADDB <n
			return void(this.b = this.add(this.b, this.direct()));
		case 0xdc: // LDD <n
			return this.ldd(this.direct());
		case 0xdd: // STD <n
			return this.std(this.direct());
		case 0xde: // LDX <n
			return void(this.x = this.ld16(this.direct()));
		case 0xdf: // STX <n
			return this.st16(this.x, this.direct());
		case 0xe0: // SUBB ,X
			return void(this.b = this.sub(this.b, this.index()));
		case 0xe1: // CMPB ,X
			return this.cmp(this.b, this.index());
		case 0xe2: // SBCB ,X
			return void(this.b = this.sbc(this.b, this.index()));
		case 0xe3: // ADDD ,X
			return this.addd(this.index());
		case 0xe4: // ANDB ,X
			return void(this.b = this.and(this.b, this.index()));
		case 0xe5: // BITB ,X
			return this.bit(this.b, this.index());
		case 0xe6: // LDAB ,X
			return void(this.b = this.ld(this.index()));
		case 0xe7: // STAB ,X
			return this.st(this.b, this.index());
		case 0xe8: // EORB ,X
			return void(this.b = this.eor(this.b, this.index()));
		case 0xe9: // ADCB ,X
			return void(this.b = this.adc(this.b, this.index()));
		case 0xea: // ORAB ,X
			return void(this.b = this.or(this.b, this.index()));
		case 0xeb: // ADDB ,X
			return void(this.b = this.add(this.b, this.index()));
		case 0xec: // LDD ,X
			return this.ldd(this.index());
		case 0xed: // STD ,X
			return this.std(this.index());
		case 0xee: // LDX ,X
			return void(this.x = this.ld16(this.index()));
		case 0xef: // STX ,X
			return this.st16(this.x, this.index());
		case 0xf0: // SUBB >nn
			return void(this.b = this.sub(this.b, this.extend()));
		case 0xf1: // CMPB >nn
			return this.cmp(this.b, this.extend());
		case 0xf2: // SBCB >nn
			return void(this.b = this.sbc(this.b, this.extend()));
		case 0xf3: // ADDD >nn
			return this.addd(this.extend());
		case 0xf4: // ANDB >nn
			return void(this.b = this.and(this.b, this.extend()));
		case 0xf5: // BITB >nn
			return this.bit(this.b, this.extend());
		case 0xf6: // LDAB >nn
			return void(this.b = this.ld(this.extend()));
		case 0xf7: // STAB >nn
			return this.st(this.b, this.extend());
		case 0xf8: // EORB >nn
			return void(this.b = this.eor(this.b, this.extend()));
		case 0xf9: // ADCB >nn
			return void(this.b = this.adc(this.b, this.extend()));
		case 0xfa: // ORAB >nn
			return void(this.b = this.or(this.b, this.extend()));
		case 0xfb: // ADDB >nn
			return void(this.b = this.add(this.b, this.extend()));
		case 0xfc: // LDD >nn
			return this.ldd(this.extend());
		case 0xfd: // STD >nn
			return this.std(this.extend());
		case 0xfe: // LDX >nn
			return void(this.x = this.ld16(this.extend()));
		case 0xff: // STX >nn
			return this.st16(this.x, this.extend());
		default:
			this.undefsize = 1;
			if (this.undef)
				this.undef(this.arg);
			return;
		}
	}

	index() {
		return this.x + this.fetch() & 0xffff;
	}

	direct() {
		return this.fetch();
	}

	extend() {
		return this.fetch() << 8 | this.fetch();
	}

	bcc(cond) {
		const n = this.fetch();
		if (cond) this.pc = this.pc + n - (n << 1 & 0x100) & 0xffff;
	}

	bsr() {
		const n = this.fetch();
		this.psh16(this.pc);
		this.pc = this.pc + n - (n << 1 & 0x100) & 0xffff;
	}

	nega(r) {
		r = MC6801.aSub[0][r][0];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	coma(r) {
		this.ccr = this.ccr & ~0x0f | 1 | MC6801.fLogic[r = ~r & 0xff];
		return r;
	}

	lsra(r) {
		r = MC6801.aRr[0][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	rora(r) {
		r = MC6801.aRr[this.ccr & 1][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	asra(r) {
		r = MC6801.aRr[r >>> 7][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	lsla(r) {
		r = MC6801.aRl[0][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	rola(r) {
		r = MC6801.aRl[this.ccr & 1][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	deca(r) {
		r = MC6801.aSub[0][1][r];
		this.ccr = this.ccr & ~0x0e | r >>> 8 & 0x0e;
		return r & 0xff;
	}

	inca(r) {
		r = MC6801.aAdd[0][1][r];
		this.ccr = this.ccr & ~0x0e | r >>> 8 & 0x0e;
		return r & 0xff;
	}

	tsta(r) {
		this.ccr = this.ccr & ~0x0f | MC6801.fLogic[r];
	}

	clra() {
		this.ccr = this.ccr & ~0x0f | 4;
		return 0;
	}

	neg(ea) {
		const r = MC6801.aSub[0][this.read(ea)][0];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		this.write(ea, r & 0xff);
	}

	com(ea) {
		const r = ~this.read(ea) & 0xff;
		this.ccr = this.ccr & ~0x0f | 1 | MC6801.fLogic[r];
		this.write(ea, r);
	}

	lsr(ea) {
		const r = MC6801.aRr[0][this.read(ea)];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		this.write(ea, r & 0xff);
	}

	ror(ea) {
		const r = MC6801.aRr[this.ccr & 1][this.read(ea)];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		this.write(ea, r & 0xff);
	}

	asr(ea) {
		let r = this.read(ea);
		r = MC6801.aRr[r >>> 7][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		this.write(ea, r & 0xff);
	}

	lsl(ea) {
		const r = MC6801.aRl[0][this.read(ea)];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		this.write(ea, r & 0xff);
	}

	rol(ea) {
		const r = MC6801.aRl[this.ccr & 1][this.read(ea)];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		this.write(ea, r & 0xff);
	}

	dec(ea) {
		const r = MC6801.aSub[0][1][this.read(ea)];
		this.ccr = this.ccr & ~0x0e | r >>> 8 & 0x0e;
		this.write(ea, r & 0xff);
	}

	inc(ea) {
		const r = MC6801.aAdd[0][1][this.read(ea)];
		this.ccr = this.ccr & ~0x0e | r >>> 8 & 0x0e;
		this.write(ea, r & 0xff);
	}

	tst(ea) {
		this.ccr = this.ccr & ~0x0f | MC6801.fLogic[this.read(ea)];
	}

	clr(ea) {
		this.ccr = this.ccr & ~0x0f | 4;
		this.write(ea, 0);
	}

	sub(r, ea) {
		r = MC6801.aSub[0][this.readf(ea)][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	cmp(r, ea) {
		this.ccr = this.ccr & ~0x0f | MC6801.aSub[0][this.readf(ea)][r] >>> 8;
	}

	sbc(r, ea) {
		r = MC6801.aSub[this.ccr & 1][this.readf(ea)][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	and(r, ea) {
		this.ccr = this.ccr & ~0x0e | MC6801.fLogic[r &= this.readf(ea)];
		return r;
	}

	bit(r, ea) {
		this.ccr = this.ccr & ~0x0e | MC6801.fLogic[r & this.readf(ea)];
	}

	ld(ea) {
		const r = this.readf(ea);
		this.ccr = this.ccr & ~0x0e | MC6801.fLogic[r];
		return r;
	}

	st(r, ea) {
		this.ccr = this.ccr & ~0x0e | MC6801.fLogic[this.write(ea, r)];
	}

	eor(r, ea) {
		this.ccr = this.ccr & ~0x0e | MC6801.fLogic[r ^= this.readf(ea)];
		return r;
	}

	adc(r, ea) {
		r = MC6801.aAdd[this.ccr & 1][this.readf(ea)][r];
		this.ccr = this.ccr & ~0x2f | r >>> 8;
		return r & 0xff;
	}

	or(r, ea) {
		this.ccr = this.ccr & ~0x0e | MC6801.fLogic[r |= this.readf(ea)];
		return r;
	}

	add(r, ea) {
		r = MC6801.aAdd[0][this.readf(ea)][r];
		this.ccr = this.ccr & ~0x2f | r >>> 8;
		return r & 0xff;
	}

	jsr(ea) {
		this.psh16(this.pc);
		this.pc = ea;
	}

	subd(ea) {
		let v, w;
		v = this.readf(ea);
		this.b = (w = MC6801.aSub[0][this.readf1(ea)][this.b]) & 0xff;
		this.a = (v = MC6801.aSub[w >>> 8 & 1][v][this.a]) & 0xff;
		this.ccr = this.ccr & ~0x0f | v >>> 8;
		this.ccr &= !this.b << 2 | ~4;
	}

	addd(ea) {
		let v, w;
		v = this.readf(ea);
		this.b = (w = MC6801.aAdd[0][this.readf1(ea)][this.b]) & 0xff;
		this.a = (v = MC6801.aAdd[w >>> 8 & 1][v][this.a]) & 0xff;
		this.ccr = this.ccr & ~0x0f | v >>> 8 & 0x0f;
		this.ccr &= !this.b << 2 | ~4;
	}

	ldd(ea) {
		this.a = this.readf(ea);
		this.b = this.readf1(ea);
		this.ccr = this.ccr & ~0x0e | !(this.a | this.b) << 2 | this.a >>> 4 & 8;
	}

	std(ea) {
		this.write(ea, this.a);
		this.write1(ea, this.b);
		this.ccr = this.ccr & ~0x0e | !(this.a | this.b) << 2 | this.a >>> 4 & 8;
	}

	cmp16(r, ea) {
		const v = this.readf(ea);
		const w = MC6801.aSub[0][this.readf1(ea)][r & 0xff];
		this.ccr = this.ccr & ~0x0f | MC6801.aSub[w >>> 8 & 1][v][r >>> 8] >>> 8;
		this.ccr &= ((w & 0xff) === 0) << 2 | ~4;
	}

	ld16(ea) {
		const r = this.readf(ea) << 8 | this.readf1(ea);
		this.ccr = this.ccr & ~0x0e | !r << 2 | r >>> 12 & 8;
		return r;
	}

	st16(r, ea) {
		this.write(ea, r >>> 8);
		this.write1(ea, r & 0xff);
		this.ccr = this.ccr & ~0x0e | !r << 2 | r >>> 12 & 8;
	}

	aim(imm, ea) {
		const r = imm & this.read(ea);
		this.ccr = this.ccr & ~0x0e | MC6801.fLogic[r];
		this.write(ea, r);
	}

	oim(imm, ea) {
		const r = imm | this.read(ea);
		this.ccr = this.ccr & ~0x0e | MC6801.fLogic[r];
		this.write(ea, r);
	}

	eim(imm, ea) {
		const r = imm ^ this.read(ea);
		this.ccr = this.ccr & ~0x0e | MC6801.fLogic[r];
		this.write(ea, r);
	}

	tim(imm, ea) {
		this.ccr = this.ccr & ~0x0e | MC6801.fLogic[imm & this.read(ea)];
	}

	psh(r) {
		this.write(this.s, r);
		this.s = this.s - 1 & 0xffff;
	}

	pul() {
		this.s = this.s + 1 & 0xffff;
		return this.read(this.s);
	}

	psh16(r) {
		this.write(this.s, r & 0xff);
		this.s = this.s - 1 & 0xffff;
		this.write(this.s, r >>> 8);
		this.s = this.s - 1 & 0xffff;
	}

	pul16() {
		this.s = this.s + 1 & 0xffff;
		const r = this.read(this.s) << 8;
		this.s = this.s + 1 & 0xffff;
		return r | this.read(this.s);
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

	readf1(addr) {
		if (addr === null) {
//			data = !(page = this.memorymap[this.pc >>> 8]).fetch ? page.base[this.pc & 0xff] : page.fetch(this.pc, this.arg);
			const data = this.memorymap[this.pc >>> 8].base[this.pc & 0xff];
			this.pc = this.pc + 1 & 0xffff;
			return data;
		}
		const page = this.memorymap[(addr = addr + 1 & 0xffff) >>> 8];
		return !page.read ? page.base[addr & 0xff] : page.read(addr, this.arg);
	}
}

void function () {
	let f, i, j, k, r;

	MC6801.aAdd = []; // [2][0x100][0x100];
	MC6801.aSub = []; // [2][0x100][0x100];
	MC6801.aDaa = []; // [4][0x100];
	MC6801.aRl = []; // [2][0x100];
	MC6801.aRr = []; // [2][0x100];
	MC6801.fLogic = new Uint8Array(0x100);

	for (i = 0; i < 2; i++) {
		MC6801.aAdd[i] = [];
		for (j = 0; j < 0x100; j++)
			MC6801.aAdd[i][j] = new Uint16Array(0x100);
	}
	for (i = 0; i < 2; i++) {
		MC6801.aSub[i] = [];
		for (j = 0; j < 0x100; j++)
			MC6801.aSub[i][j] = new Uint16Array(0x100);
	}
	for (i = 0; i < 4; i++)
		MC6801.aDaa[i] = new Uint16Array(0x100);
	for (i = 0; i < 2; i++)
		MC6801.aRl[i] = new Uint16Array(0x100);
	for (i = 0; i < 2; i++)
		MC6801.aRr[i] = new Uint16Array(0x100);

	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++)
			for (k = 0; k < 0x100; k++) {
				r = j + k + i & 0xff;
				const v = j & k & ~r | ~j & ~k & r;
				const c = j & k | k & ~r | ~r & j;
				f = c << 2 & 0x20 | r >>> 4 & 8 | !r << 2 | v >>> 6 & 2 | c >>> 7 & 1;
				MC6801.aAdd[i][k][j] = f << 8 | r;
			}
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++)
			for (k = 0; k < 0x100; k++) {
				r = j - k - i & 0xff;
				const v = j & ~k & ~r | ~j & k & r;
				const c = ~j & k | k & r | r & ~j;
				f = r >>> 4 & 8 | !r << 2 | v >>> 6 & 2 | c >>> 7 & 1;
				MC6801.aSub[i][k][j] = f << 8 | r;
			}
	for (i = 0; i < 0x100; i++)
		MC6801.fLogic[i] = i >>> 4 & 8 | !i << 2;
	for (i = 0; i < 4; i++)
		for (j = 0; j < 0x100; j++) {
			f = i & 1;
			r = j;
			k = 0;
			if ((i & 2) !== 0 || (r & 0x0f) > 9)
				k = 6;
			if ((i & 1) !== 0 || (r & 0xf0) > 0x90 || (r & 0xf0) > 0x80 && (r & 0x0f) > 9)
				k += 0x60;
			f |= MC6801.fLogic[(r += k) & 0xff] | (r >= 0x100);
			MC6801.aDaa[i][j] = f << 8 | r & 0xff;
		}
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++) {
			r = (j << 1 | i) & 0xff;
			f = MC6801.fLogic[r] | j >>> 7;
			f |= (f >>> 2 ^ f << 1) & 2;
			MC6801.aRl[i][j] = f << 8 | r;
		}
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++) {
			r = j >>> 1 | i << 7;
			f = MC6801.fLogic[r] | j & 1;
			f |= (f >>> 2 ^ f << 1) & 2;
			MC6801.aRr[i][j] = f << 8 | r;
		}
}();

