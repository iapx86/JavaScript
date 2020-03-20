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
		this.psh16(this.pc, this.x);
		this.psh(this.a, this.b, this.ccr);
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
		this.psh16(this.pc, this.x);
		this.psh(this.a, this.b, this.ccr);
		this.ccr |= 0x10;
		this.pc = this.read(0xfffc) << 8 | this.read(0xfffd);
		return true;
	}

	_execute() {
		let ea;

		switch (this.fetch()) {
		case 0x01: // NOP
			return;
		case 0x04: // LSRD
			return void([this.a, this.b] = this.split(this.lsr16(this.a << 8 | this.b)));
		case 0x05: // LSLD
			return void([this.a, this.b] = this.split(this.lsl16(this.a << 8 | this.b)));
		case 0x06: // TAP
			return void(this.ccr = this.a | 0xc0);
		case 0x07: // TPA
			return void(this.a = this.ccr);
		case 0x08: // INX
			return void(this.x = this.inc16(this.x));
		case 0x09: // DEX
			return void(this.x = this.dec16(this.x));
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
			return void(this.a = this.sub8(this.b, this.a));
		case 0x11: // CBA
			return void(this.sub8(this.b, this.a));
		case 0x12: // undocumented instruction
		case 0x13: // undocumented instruction
			return void(this.x = this.x + this.read(this.s + 1 & 0xffff) & 0xffff);
		case 0x16: // TAB
			return void(this.b = this.mov8(this.a));
		case 0x17: // TBA
			return void(this.a = this.mov8(this.b));
		case 0x18: // XGDX
			return void([this.a, this.b, this.x] = [this.x >> 8, this.x & 0xff, this.a << 8 | this.b]);
		case 0x19: // DAA
			return this.daa();
		case 0x1a: // SLP
			return this.suspend();
		case 0x1b: // ABA
			return void(this.a = this.add8(this.b, this.a));
		case 0x20: // BRA
			return this.bcc(true);
		case 0x21: // BRN
			return this.bcc(false);
		case 0x22: // BHI
			return this.bcc(((this.ccr >> 2 | this.ccr) & 1) === 0);
		case 0x23: // BLS
			return this.bcc(((this.ccr >> 2 | this.ccr) & 1) !== 0);
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
			return this.bcc(((this.ccr >> 2 ^ this.ccr) & 2) === 0);
		case 0x2d: // BLT
			return this.bcc(((this.ccr >> 2 ^ this.ccr) & 2) !== 0);
		case 0x2e: // BGT
			return this.bcc(((this.ccr >> 2 ^ this.ccr | this.ccr >> 1) & 2) === 0);
		case 0x2f: // BLE
			return this.bcc(((this.ccr >> 2 ^ this.ccr | this.ccr >> 1) & 2) !== 0);
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
			return void([this.ccr, this.b, this.a, this.x, this.pc] = [this.pul() | 0xc0, this.pul(), this.pul(), this.pul16(), this.pul16()]);
		case 0x3c: // PSHX
			return this.psh16(this.x);
		case 0x3d: // MUL
			[this.a, this.b] = this.split(this.a * this.b);
			return void(this.ccr = this.ccr & ~1 | this.b >> 7);
		case 0x3e: // WAI
			return this.suspend();
		case 0x3f: // SWI
			this.psh16(this.pc, this.x);
			this.psh(this.a, this.b, this.ccr);
			this.ccr |= 0x10;
			return void(this.pc = this.read(0xfffa) << 8 | this.read(0xfffb));
		case 0x40: // NEGA
			return void(this.a = this.neg8(this.a));
		case 0x43: // COMA
			return void(this.a = this.com8(this.a));
		case 0x44: // LSRA
			return void(this.a = this.lsr8(this.a));
		case 0x46: // RORA
			return void(this.a = this.ror8(this.a));
		case 0x47: // ASRA
			return void(this.a = this.asr8(this.a));
		case 0x48: // LSLA
			return void(this.a = this.lsl8(this.a));
		case 0x49: // ROLA
			return void(this.a = this.rol8(this.a));
		case 0x4a: // DECA
			return void(this.a = this.dec8(this.a));
		case 0x4c: // INCA
			return void(this.a = this.inc8(this.a));
		case 0x4d: // TSTA
			return this.tst8(this.a);
		case 0x4f: // CLRA
			return void(this.a = this.clr8());
		case 0x50: // NEGB
			return void(this.b = this.neg8(this.b));
		case 0x53: // COMB
			return void(this.b = this.com8(this.b));
		case 0x54: // LSRB
			return void(this.b = this.lsr8(this.b));
		case 0x56: // RORB
			return void(this.b = this.ror8(this.b));
		case 0x57: // ASRB
			return void(this.b = this.asr8(this.b));
		case 0x58: // LSLB
			return void(this.b = this.lsl8(this.b));
		case 0x59: // ROLB
			return void(this.b = this.rol8(this.b));
		case 0x5a: // DECB
			return void(this.b = this.dec8(this.b));
		case 0x5c: // INCB
			return void(this.b = this.inc8(this.b));
		case 0x5d: // TSTB
			return this.tst8(this.b);
		case 0x5f: // CLRB
			return void(this.b = this.clr8());
		case 0x60: // NEG ,X
			return this.write8(this.neg8(this.read(ea = this.x + this.fetch() & 0xffff)), ea);
		case 0x61: // AIM ,X
			return this.write8(this.mov8(this.fetch() & this.read(ea = this.x + this.fetch() & 0xffff)), ea);
		case 0x62: // OIM ,X
			return this.write8(this.mov8(this.fetch() | this.read(ea = this.x + this.fetch() & 0xffff)), ea);
		case 0x63: // COM ,X
			return this.write8(this.com8(this.read(ea = this.x + this.fetch() & 0xffff)), ea);
		case 0x64: // LSR ,X
			return this.write8(this.lsr8(this.read(ea = this.x + this.fetch() & 0xffff)), ea);
		case 0x65: // EIM ,X
			return this.write8(this.mov8(this.fetch() ^ this.read(ea = this.x + this.fetch() & 0xffff)), ea);
		case 0x66: // ROR ,X
			return this.write8(this.ror8(this.read(ea = this.x + this.fetch() & 0xffff)), ea);
		case 0x67: // ASR ,X
			return this.write8(this.asr8(this.read(ea = this.x + this.fetch() & 0xffff)), ea);
		case 0x68: // LSL ,X
			return this.write8(this.lsl8(this.read(ea = this.x + this.fetch() & 0xffff)), ea);
		case 0x69: // ROL ,X
			return this.write8(this.rol8(this.read(ea = this.x + this.fetch() & 0xffff)), ea);
		case 0x6a: // DEC ,X
			return this.write8(this.dec8(this.read(ea = this.x + this.fetch() & 0xffff)), ea);
		case 0x6b: // TIM ,X
			return void(this.mov8(this.fetch() & this.read(this.x + this.fetch() & 0xffff)));
		case 0x6c: // INC ,X
			return this.write8(this.inc8(this.read(ea = this.x + this.fetch() & 0xffff)), ea);
		case 0x6d: // TST ,X
			return this.tst8(this.read(this.x + this.fetch() & 0xffff));
		case 0x6e: // JMP ,X
			return void(this.pc = this.x + this.fetch() & 0xffff);
		case 0x6f: // CLR ,X
			return this.write8(this.clr8(), this.x + this.fetch() & 0xffff);
		case 0x70: // NEG >nn
			return this.write8(this.neg8(this.read(ea = this.fetch() << 8 | this.fetch())), ea);
		case 0x71: // AIM <n
			return this.write8(this.mov8(this.fetch() & this.read(ea = this.fetch())), ea);
		case 0x72: // OIM <n
			return this.write8(this.mov8(this.fetch() | this.read(ea = this.fetch())), ea);
		case 0x73: // COM >nn
			return this.write8(this.com8(this.read(ea = this.fetch() << 8 | this.fetch())), ea);
		case 0x74: // LSR >nn
			return this.write8(this.lsr8(this.read(ea = this.fetch() << 8 | this.fetch())), ea);
		case 0x75: // EIM <n
			return this.write8(this.mov8(this.fetch() ^ this.read(ea = this.fetch())), ea);
		case 0x76: // ROR >nn
			return this.write8(this.ror8(this.read(ea = this.fetch() << 8 | this.fetch())), ea);
		case 0x77: // ASR >nn
			return this.write8(this.asr8(this.read(ea = this.fetch() << 8 | this.fetch())), ea);
		case 0x78: // LSL >nn
			return this.write8(this.lsl8(this.read(ea = this.fetch() << 8 | this.fetch())), ea);
		case 0x79: // ROL >nn
			return this.write8(this.rol8(this.read(ea = this.fetch() << 8 | this.fetch())), ea);
		case 0x7a: // DEC >nn
			return this.write8(this.dec8(this.read(ea = this.fetch() << 8 | this.fetch())), ea);
		case 0x7b: // TIM <n
			return void(this.mov8(this.fetch() & this.read(this.fetch())));
		case 0x7c: // INC >nn
			return this.write8(this.inc8(this.read(ea = this.fetch() << 8 | this.fetch())), ea);
		case 0x7d: // TST >nn
			return this.tst8(this.read(this.fetch() << 8 | this.fetch()));
		case 0x7e: // JMP >nn
			return void(this.pc = this.fetch() << 8 | this.fetch());
		case 0x7f: // CLR >nn
			return this.write8(this.clr8(), this.fetch() << 8 | this.fetch());
		case 0x80: // SUBA #n
			return void(this.a = this.sub8(this.fetch(), this.a));
		case 0x81: // CMPA #n
			return void(this.sub8(this.fetch(), this.a));
		case 0x82: // SBCA #n
			return void(this.a = this.sbc8(this.fetch(), this.a));
		case 0x83: // SUBD #nn
			return void([this.a, this.b] = this.split(this.sub16(this.fetch() << 8 | this.fetch(), this.a << 8 | this.b)));
		case 0x84: // ANDA #n
			return void(this.a = this.mov8(this.a & this.fetch()));
		case 0x85: // BITA #n
			return void(this.mov8(this.a & this.fetch()));
		case 0x86: // LDAA #n
			return void(this.a = this.mov8(this.fetch()));
		case 0x88: // EORA #n
			return void(this.a = this.mov8(this.a ^ this.fetch()));
		case 0x89: // ADCA #n
			return void(this.a = this.adc8(this.fetch(), this.a));
		case 0x8a: // ORAA #n
			return void(this.a = this.mov8(this.a | this.fetch()));
		case 0x8b: // ADDA #n
			return void(this.a = this.add8(this.fetch(), this.a));
		case 0x8c: // CPX #nn
			return void(this.sub16(this.fetch() << 8 | this.fetch(), this.x));
		case 0x8d: // BSR
			return this.bsr();
		case 0x8e: // LDS #nn
			return void(this.s = this.mov16(this.fetch() << 8 | this.fetch()));
		case 0x90: // SUBA <n
			return void(this.a = this.sub8(this.read(this.fetch()), this.a));
		case 0x91: // CMPA <n
			return void(this.sub8(this.read(this.fetch()), this.a));
		case 0x92: // SBCA <n
			return void(this.a = this.sbc8(this.read(this.fetch()), this.a));
		case 0x93: // SUBD <n
			return void([this.a, this.b] = this.split(this.sub16(this.read16(this.fetch()), this.a << 8 | this.b)));
		case 0x94: // ANDA <n
			return void(this.a = this.mov8(this.a & this.read(this.fetch())));
		case 0x95: // BITA <n
			return void(this.mov8(this.a & this.read(this.fetch())));
		case 0x96: // LDAA <n
			return void(this.a = this.mov8(this.read(this.fetch())));
		case 0x97: // STAA <n
			return this.write8(this.mov8(this.a), this.fetch());
		case 0x98: // EORA <n
			return void(this.a = this.mov8(this.a ^ this.read(this.fetch())));
		case 0x99: // ADCA <n
			return void(this.a = this.adc8(this.read(this.fetch()), this.a));
		case 0x9a: // ORAA <n
			return void(this.a = this.mov8(this.a | this.read(this.fetch())));
		case 0x9b: // ADDA <n
			return void(this.a = this.add8(this.read(this.fetch()), this.a));
		case 0x9c: // CPX <n
			return void(this.sub16(this.read16(this.fetch()), this.x));
		case 0x9d: // JSR <n
			return this.jsr(this.fetch());
		case 0x9e: // LDS <n
			return void(this.s = this.mov16(this.read16(this.fetch())));
		case 0x9f: // STS <n
			return this.write16(this.mov16(this.s), this.fetch());
		case 0xa0: // SUBA ,X
			return void(this.a = this.sub8(this.read(this.x + this.fetch() & 0xffff), this.a));
		case 0xa1: // CMPA ,X
			return void(this.sub8(this.read(this.x + this.fetch() & 0xffff), this.a));
		case 0xa2: // SBCA ,X
			return void(this.a = this.sbc8(this.read(this.x + this.fetch() & 0xffff), this.a));
		case 0xa3: // SUBD ,X
			return void([this.a, this.b] = this.split(this.sub16(this.read16(this.x + this.fetch() & 0xffff), this.a << 8 | this.b)));
		case 0xa4: // ANDA ,X
			return void(this.a = this.mov8(this.a & this.read(this.x + this.fetch() & 0xffff)));
		case 0xa5: // BITA ,X
			return void(this.mov8(this.a & this.read(this.x + this.fetch() & 0xffff)));
		case 0xa6: // LDAA ,X
			return void(this.a = this.mov8(this.read(this.x + this.fetch() & 0xffff)));
		case 0xa7: // STAA ,X
			return this.write8(this.mov8(this.a), this.x + this.fetch() & 0xffff);
		case 0xa8: // EORA ,X
			return void(this.a = this.mov8(this.a ^ this.read(this.x + this.fetch() & 0xffff)));
		case 0xa9: // ADCA ,X
			return void(this.a = this.adc8(this.read(this.x + this.fetch() & 0xffff), this.a));
		case 0xaa: // ORAA ,X
			return void(this.a = this.mov8(this.a | this.read(this.x + this.fetch() & 0xffff)));
		case 0xab: // ADDA ,X
			return void(this.a = this.add8(this.read(this.x + this.fetch() & 0xffff), this.a));
		case 0xac: // CPX ,X
			return void(this.sub16(this.read16(this.x + this.fetch() & 0xffff), this.x));
		case 0xad: // JSR ,X
			return this.jsr(this.x + this.fetch() & 0xffff);
		case 0xae: // LDS ,X
			return void(this.s = this.mov16(this.read16(this.x + this.fetch() & 0xffff)));
		case 0xaf: // STS ,X
			return this.write16(this.mov16(this.s), this.x + this.fetch() & 0xffff);
		case 0xb0: // SUBA >nn
			return void(this.a = this.sub8(this.read(this.fetch() << 8 | this.fetch()), this.a));
		case 0xb1: // CMPA >nn
			return void(this.sub8(this.read(this.fetch() << 8 | this.fetch()), this.a));
		case 0xb2: // SBCA >nn
			return void(this.a = this.sbc8(this.read(this.fetch() << 8 | this.fetch()), this.a));
		case 0xb3: // SUBD >nn
			return void([this.a, this.b] = this.split(this.sub16(this.read16(this.fetch() << 8 | this.fetch()), this.a << 8 | this.b)));
		case 0xb4: // ANDA >nn
			return void(this.a = this.mov8(this.a & this.read(this.fetch() << 8 | this.fetch())));
		case 0xb5: // BITA >nn
			return void(this.mov8(this.a & this.read(this.fetch() << 8 | this.fetch())));
		case 0xb6: // LDAA >nn
			return void(this.a = this.mov8(this.read(this.fetch() << 8 | this.fetch())));
		case 0xb7: // STAA >nn
			return this.write8(this.mov8(this.a), this.fetch() << 8 | this.fetch());
		case 0xb8: // EORA >nn
			return void(this.a = this.mov8(this.a ^ this.read(this.fetch() << 8 | this.fetch())));
		case 0xb9: // ADCA >nn
			return void(this.a = this.adc8(this.read(this.fetch() << 8 | this.fetch()), this.a));
		case 0xba: // ORAA >nn
			return void(this.a = this.mov8(this.a | this.read(this.fetch() << 8 | this.fetch())));
		case 0xbb: // ADDA >nn
			return void(this.a = this.add8(this.read(this.fetch() << 8 | this.fetch()), this.a));
		case 0xbc: // CPX >nn
			return void(this.sub16(this.read16(this.fetch() << 8 | this.fetch()), this.x));
		case 0xbd: // JSR >nn
			return this.jsr(this.fetch() << 8 | this.fetch());
		case 0xbe: // LDS >nn
			return void(this.s = this.mov16(this.read16(this.fetch() << 8 | this.fetch())));
		case 0xbf: // STS >nn
			return this.write16(this.mov16(this.s), this.fetch() << 8 | this.fetch());
		case 0xc0: // SUBB #n
			return void(this.b = this.sub8(this.fetch(), this.b));
		case 0xc1: // CMPB #n
			return void(this.sub8(this.fetch(), this.b));
		case 0xc2: // SBCB #n
			return void(this.b = this.sbc8(this.fetch(), this.b));
		case 0xc3: // ADDD #nn
			return void([this.a, this.b] = this.split(this.add16(this.fetch() << 8 | this.fetch(), this.a << 8 | this.b)));
		case 0xc4: // ANDB #n
			return void(this.b = this.mov8(this.b & this.fetch()));
		case 0xc5: // BITB #n
			return void(this.mov8(this.b & this.fetch()));
		case 0xc6: // LDAB #n
			return void(this.b = this.mov8(this.fetch()));
		case 0xc8: // EORB #n
			return void(this.b = this.mov8(this.b ^ this.fetch()));
		case 0xc9: // ADCB #n
			return void(this.b = this.adc8(this.fetch(), this.b));
		case 0xca: // ORAB #n
			return void(this.b = this.mov8(this.b | this.fetch()));
		case 0xcb: // ADDB #n
			return void(this.b = this.add8(this.fetch(), this.b));
		case 0xcc: // LDD #nn
			return void([this.a, this.b] = this.split(this.mov16(this.fetch() << 8 | this.fetch())));
		case 0xce: // LDX #nn
			return void(this.x = this.mov16(this.fetch() << 8 | this.fetch()));
		case 0xd0: // SUBB <n
			return void(this.b = this.sub8(this.read(this.fetch()), this.b));
		case 0xd1: // CMPB <n
			return void(this.sub8(this.read(this.fetch()), this.b));
		case 0xd2: // SBCB <n
			return void(this.b = this.sbc8(this.read(this.fetch()), this.b));
		case 0xd3: // ADDD <n
			return void([this.a, this.b] = this.split(this.add16(this.read16(this.fetch()), this.a << 8 | this.b)));
		case 0xd4: // ANDB <n
			return void(this.b = this.mov8(this.b & this.read(this.fetch())));
		case 0xd5: // BITB <n
			return void(this.mov8(this.b & this.read(this.fetch())));
		case 0xd6: // LDAB <n
			return void(this.b = this.mov8(this.read(this.fetch())));
		case 0xd7: // STAB <n
			return this.write8(this.mov8(this.b), this.fetch());
		case 0xd8: // EORB <n
			return void(this.b = this.mov8(this.b ^ this.read(this.fetch())));
		case 0xd9: // ADCB <n
			return void(this.b = this.adc8(this.read(this.fetch()), this.b));
		case 0xda: // ORAB <n
			return void(this.b = this.mov8(this.b | this.read(this.fetch())));
		case 0xdb: // ADDB <n
			return void(this.b = this.add8(this.read(this.fetch()), this.b));
		case 0xdc: // LDD <n
			return void([this.a, this.b] = this.split(this.mov16(this.read16(this.fetch()))));
		case 0xdd: // STD <n
			return this.write16(this.mov16(this.a << 8 | this.b), this.fetch());
		case 0xde: // LDX <n
			return void(this.x = this.mov16(this.read16(this.fetch())));
		case 0xdf: // STX <n
			return this.write16(this.mov16(this.x), this.fetch());
		case 0xe0: // SUBB ,X
			return void(this.b = this.sub8(this.read(this.x + this.fetch() & 0xffff), this.b));
		case 0xe1: // CMPB ,X
			return void(this.sub8(this.read(this.x + this.fetch() & 0xffff), this.b));
		case 0xe2: // SBCB ,X
			return void(this.b = this.sbc8(this.read(this.x + this.fetch() & 0xffff), this.b));
		case 0xe3: // ADDD ,X
			return void([this.a, this.b] = this.split(this.add16(this.read16(this.x + this.fetch() & 0xffff), this.a << 8 | this.b)));
		case 0xe4: // ANDB ,X
			return void(this.b = this.mov8(this.b & this.read(this.x + this.fetch() & 0xffff)));
		case 0xe5: // BITB ,X
			return void(this.mov8(this.b & this.read(this.x + this.fetch() & 0xffff)));
		case 0xe6: // LDAB ,X
			return void(this.b = this.mov8(this.read(this.x + this.fetch() & 0xffff)));
		case 0xe7: // STAB ,X
			return this.write8(this.mov8(this.b), this.x + this.fetch() & 0xffff);
		case 0xe8: // EORB ,X
			return void(this.b = this.mov8(this.b ^ this.read(this.x + this.fetch() & 0xffff)));
		case 0xe9: // ADCB ,X
			return void(this.b = this.adc8(this.read(this.x + this.fetch() & 0xffff), this.b));
		case 0xea: // ORAB ,X
			return void(this.b = this.mov8(this.b | this.read(this.x + this.fetch() & 0xffff)));
		case 0xeb: // ADDB ,X
			return void(this.b = this.add8(this.read(this.x + this.fetch() & 0xffff), this.b));
		case 0xec: // LDD ,X
			return void([this.a, this.b] = this.split(this.mov16(this.read16(this.x + this.fetch() & 0xffff))));
		case 0xed: // STD ,X
			return this.write16(this.mov16(this.a << 8 | this.b), this.x + this.fetch() & 0xffff);
		case 0xee: // LDX ,X
			return void(this.x = this.mov16(this.read16(this.x + this.fetch() & 0xffff)));
		case 0xef: // STX ,X
			return this.write16(this.mov16(this.x), this.x + this.fetch() & 0xffff);
		case 0xf0: // SUBB >nn
			return void(this.b = this.sub8(this.read(this.fetch() << 8 | this.fetch()), this.b));
		case 0xf1: // CMPB >nn
			return void(this.sub8(this.read(this.fetch() << 8 | this.fetch()), this.b));
		case 0xf2: // SBCB >nn
			return void(this.b = this.sbc8(this.read(this.fetch() << 8 | this.fetch()), this.b));
		case 0xf3: // ADDD >nn
			return void([this.a, this.b] = this.split(this.add16(this.read16(this.fetch() << 8 | this.fetch()), this.a << 8 | this.b)));
		case 0xf4: // ANDB >nn
			return void(this.b = this.mov8(this.b & this.read(this.fetch() << 8 | this.fetch())));
		case 0xf5: // BITB >nn
			return void(this.mov8(this.b & this.read(this.fetch() << 8 | this.fetch())));
		case 0xf6: // LDAB >nn
			return void(this.b = this.mov8(this.read(this.fetch() << 8 | this.fetch())));
		case 0xf7: // STAB >nn
			return this.write8(this.mov8(this.b), this.fetch() << 8 | this.fetch());
		case 0xf8: // EORB >nn
			return void(this.b = this.mov8(this.b ^ this.read(this.fetch() << 8 | this.fetch())));
		case 0xf9: // ADCB >nn
			return void(this.b = this.adc8(this.read(this.fetch() << 8 | this.fetch()), this.b));
		case 0xfa: // ORAB >nn
			return void(this.b = this.mov8(this.b | this.read(this.fetch() << 8 | this.fetch())));
		case 0xfb: // ADDB >nn
			return void(this.b = this.add8(this.read(this.fetch() << 8 | this.fetch()), this.b));
		case 0xfc: // LDD >nn
			return void([this.a, this.b] = this.split(this.mov16(this.read16(this.fetch() << 8 | this.fetch()))));
		case 0xfd: // STD >nn
			return this.write16(this.mov16(this.a << 8 | this.b), this.fetch() << 8 | this.fetch());
		case 0xfe: // LDX >nn
			return void(this.x = this.mov16(this.read16(this.fetch() << 8 | this.fetch())));
		case 0xff: // STX >nn
			return this.write16(this.mov16(this.x), this.fetch() << 8 | this.fetch());
		default:
			this.undefsize = 1;
			if (this.undef)
				this.undef(this.arg);
			return;
		}
	}

	bcc(cond) {
		const n = this.fetch();
		if (cond) this.pc = this.pc + (n << 24 >> 24) & 0xffff;
	}

	bsr() {
		const n = this.fetch();
		this.psh16(this.pc);
		this.pc = this.pc + (n << 24 >> 24) & 0xffff;
	}

	neg8(dst) {
		const r = -dst & 0xff, v = dst & r, c = dst | r;
		this.ccr = this.ccr & ~0x0f | r >> 4 & 8 | !r << 2 | v >> 6 & 2 | c >> 7 & 1;
		return r;
	}

	com8(dst) {
		const r = ~dst & 0xff;
		this.ccr = this.ccr & ~0x0f | r >> 4 & 8 | !r << 2 | 1;
		return r;
	}

	lsr8(dst) {
		const r = dst >> 1, c = dst & 1;
		this.ccr = this.ccr & ~0x0f | !r << 2 | c << 1 | c;
		return r;
	}

	lsr16(dst) {
		const r = dst >> 1, c = dst & 1;
		this.ccr = this.ccr & ~0x0f | !r << 2 | c << 1 | c;
		return r;
	}

	ror8(dst) {
		const r = dst >> 1 | this.ccr << 7 & 0x80, c = dst & 1, v = r >> 7 ^ c;
		this.ccr = this.ccr & ~0x0f | r >> 4 & 8 | !r << 2 | v << 1 | c;
		return r;
	}

	asr8(dst) {
		const r = dst >> 1 | dst & 0x80, c = dst & 1, v = r >> 7 ^ c;
		this.ccr = this.ccr & ~0x0f | r >> 4 & 8 | !r << 2 | v << 1 | c;
		return r;
	}

	lsl8(dst) {
		const r = dst << 1 & 0xff, c = dst >> 7, v = r >> 7 ^ c;
		this.ccr = this.ccr & ~0x0f | r >> 4 & 8 | !r << 2 | v << 1 | c;
		return r;
	}

	lsl16(dst) {
		const r = dst << 1 & 0xffff, c = dst >> 15, v = r >> 15 ^ c;
		this.ccr = this.ccr & ~0x0f | r >> 12 & 8 | !r << 2 | v << 1 | c;
		return r;
	}

	rol8(dst) {
		const r = dst << 1 & 0xff | this.ccr & 1, c = dst >> 7, v = r >> 7 ^ c;
		this.ccr = this.ccr & ~0x0f | r >> 4 & 8 | !r << 2 | v << 1 | c;
		return r;
	}

	dec8(dst) {
		const r = dst - 1 & 0xff, v = dst & ~1 & ~r | ~dst & 1 & r;
		this.ccr = this.ccr & ~0x0e | r >> 4 & 8 | !r << 2 | v >> 6 & 2;
		return r;
	}

	dec16(dst) {
		const r = dst - 1 & 0xffff;
		this.ccr = this.ccr & ~4 | !r << 2;
		return r;
	}

	inc8(dst) {
		const r = dst + 1 & 0xff, v = dst & 1 & ~r | ~dst & ~1 & r;
		this.ccr = this.ccr & ~0x0e | r >> 4 & 8 | !r << 2 | v >> 6 & 2;
		return r;
	}

	inc16(dst) {
		const r = dst + 1 & 0xffff;
		this.ccr = this.ccr & ~4 | !r << 2;
		return r;
	}

	tst8(src) {
		this.ccr = this.ccr & ~0x0f | src >> 4 & 8 | !src << 2;
	}

	clr8() {
		this.ccr = this.ccr & ~0x0f | 4;
		return 0;
	}

	sub8(src, dst) {
		const r = dst - src & 0xff, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		this.ccr = this.ccr & ~0x0f | r >> 4 & 8 | !r << 2 | v >> 6 & 2 | c >> 7 & 1;
		return r;
	}

	sub16(src, dst) {
		const r = dst - src & 0xffff, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		this.ccr = this.ccr & ~0x0f | r >> 12 & 8 | !r << 2 | v >> 14 & 2 | c >> 15 & 1;
		return r;
	}

	sbc8(src, dst) {
		const r = dst - src - (this.ccr & 1) & 0xff, v = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		this.ccr = this.ccr & ~0x0f | r >> 4 & 8 | !r << 2 | v >> 6 & 2 | c >> 7 & 1;
		return r;
	}

	mov8(src) {
		this.ccr = this.ccr & ~0x0e | src >> 4 & 8 | !src << 2;
		return src;
	}

	mov16(src) {
		this.ccr = this.ccr & ~0x0e | src >> 12 & 8 | !src << 2;
		return src;
	}

	adc8(src, dst) {
		const r = dst + src + (this.ccr & 1) & 0xff, v = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		this.ccr = this.ccr & ~0x2f | c << 2 & 0x20 | r >> 4 & 8 | !r << 2 | v >> 6 & 2 | c >> 7 & 1;
		return r;
	}

	add8(src, dst) {
		const r = dst + src & 0xff, v = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		this.ccr = this.ccr & ~0x2f | c << 2 & 0x20 | r >> 4 & 8 | !r << 2 | v >> 6 & 2 | c >> 7 & 1;
		return r;
	}

	add16(src, dst) {
		const r = dst + src & 0xffff, v = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		this.ccr = this.ccr & ~0x0f | r >> 12 & 8 | !r << 2 | v >> 14 & 2 | c >> 15 & 1;
		return r;
	}

	daa() {
		let cf = 0;
		if ((this.ccr & 0x20) !== 0 && (this.a & 0xf) < 4 || (this.a & 0xf) > 9)
			cf += 6;
		if ((this.ccr & 1) !== 0 && (this.a & 0xf0) < 0x40 || (this.a & 0xf0) > 0x90 || (this.a & 0xf0) > 0x80 && (this.a & 0xf) > 9) {
			cf += 0x60;
			this.ccr |= 1;
		}
		this.a = this.a + cf & 0xff;
		this.ccr = this.ccr & ~0x0c | this.a >> 4 & 8 | !this.a << 2;
	}

	jsr(ea) {
		this.psh16(this.pc);
		this.pc = ea;
	}

	psh(...args) {
		args.forEach(e => {
			this.write8(e, this.s);
			this.s = this.s - 1 & 0xffff;
		});
	}

	pul() {
		return this.read(this.s = this.s + 1 & 0xffff);
	}

	psh16(...args) {
		args.forEach(e => {
			this.write16(e, this.s = this.s - 1 & 0xffff);
			this.s = this.s - 1 & 0xffff;
		});
	}

	pul16() {
		const r = this.read(this.s = this.s + 1 & 0xffff) << 8;
		return r | this.read(this.s = this.s + 1 & 0xffff);
	}

	split(v) {
		return [v >> 8, v & 0xff];
	}

	read16(addr) {
		return this.read(addr) << 8 | this.read(addr + 1 & 0xffff);
	}

	write8(data, addr) {
		const page = this.memorymap[addr >> 8];
		!page.write ? void(page.base[addr & 0xff] = data) : page.write(addr, data, this.arg);
	}

	write16(data, addr) {
		this.write8(data >> 8, addr);
		this.write8(data, addr + 1 & 0xffff);
	}
}

