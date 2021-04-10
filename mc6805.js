/*
 *
 *	MC6805 Emulator
 *
 */

import Cpu from './cpu.js';

export default class MC6805 extends Cpu {
	a = 0;
	ccr = 0; // ccr:111hinzc
	x = 0;
	s = 0;
	irq = false;

	constructor(clock) {
		super(clock);
	}

	reset() {
		super.reset();
		this.a = 0;
		this.ccr = 0xe8;
		this.x = 0;
		this.s = 0x7f;
		this.pc = this.read16(0x7fe) & 0x7ff;
		this.irq = false;
	}

	interrupt(intvec) {
		if (!super.interrupt() || this.ccr & 8)
			return false;
		this.cycle -= cc[0x83], this.psh16(this.pc), this.psh(this.x, this.a, this.ccr), this.ccr |= 8;
		switch (intvec) {
		case 'timer':
			return this.pc = this.read16(0x7f8) & 0x7ff, true;
		default:
		case 'external':
			return this.pc = this.read16(0x7fa) & 0x7ff, true;
		}
	}

	_execute() {
		let ea, op = this.fetch();
		this.cycle -= cc[op];
		switch (op) {
		case 0x00: // BRSET0
			return this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.fetch()) & 1) & 1) !== 0);
		case 0x01: // BRCLR0
			return this.bcc(!((this.ccr = this.ccr & ~1 | this.read(this.fetch()) & 1) & 1));
		case 0x02: // BRSET1
			return this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.fetch()) >> 1 & 1) & 1) !== 0);
		case 0x03: // BRCLR1
			return this.bcc(!((this.ccr = this.ccr & ~1 | this.read(this.fetch()) >> 1 & 1) & 1));
		case 0x04: // BRSET2
			return this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.fetch()) >> 2 & 1) & 1) !== 0);
		case 0x05: // BRCLR2
			return this.bcc(!((this.ccr = this.ccr & ~1 | this.read(this.fetch()) >> 2 & 1) & 1));
		case 0x06: // BRSET3
			return this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.fetch()) >> 3 & 1) & 1) !== 0);
		case 0x07: // BRCLR3
			return this.bcc(!((this.ccr = this.ccr & ~1 | this.read(this.fetch()) >> 3 & 1) & 1));
		case 0x08: // BRSET4
			return this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.fetch()) >> 4 & 1) & 1) !== 0);
		case 0x09: // BRCLR4
			return this.bcc(!((this.ccr = this.ccr & ~1 | this.read(this.fetch()) >> 4 & 1) & 1));
		case 0x0a: // BRSET5
			return this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.fetch()) >> 5 & 1) & 1) !== 0);
		case 0x0b: // BRCLR5
			return this.bcc(!((this.ccr = this.ccr & ~1 | this.read(this.fetch()) >> 5 & 1) & 1));
		case 0x0c: // BRSET6
			return this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.fetch()) >> 6 & 1) & 1) !== 0);
		case 0x0d: // BRCLR6
			return this.bcc(!((this.ccr = this.ccr & ~1 | this.read(this.fetch()) >> 6 & 1) & 1));
		case 0x0e: // BRSET7
			return this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.fetch()) >> 7 & 1) & 1) !== 0);
		case 0x0f: // BRCLR7
			return this.bcc(!((this.ccr = this.ccr & ~1 | this.read(this.fetch()) >> 7 & 1) & 1));
		case 0x10: // BSET0
			return ea = this.fetch(), this.write8(this.read(ea) | 1, ea);
		case 0x11: // BCLR0
			return ea = this.fetch(), this.write8(this.read(ea) & ~1, ea);
		case 0x12: // BSET1
			return ea = this.fetch(), this.write8(this.read(ea) | 2, ea);
		case 0x13: // BCLR1
			return ea = this.fetch(), this.write8(this.read(ea) & ~2, ea);
		case 0x14: // BSET2
			return ea = this.fetch(), this.write8(this.read(ea) | 4, ea);
		case 0x15: // BCLR2
			return ea = this.fetch(), this.write8(this.read(ea) & ~4, ea);
		case 0x16: // BSET3
			return ea = this.fetch(), this.write8(this.read(ea) | 8, ea);
		case 0x17: // BCLR3
			return ea = this.fetch(), this.write8(this.read(ea) & ~8, ea);
		case 0x18: // BSET4
			return ea = this.fetch(), this.write8(this.read(ea) | 0x10, ea);
		case 0x19: // BCLR4
			return ea = this.fetch(), this.write8(this.read(ea) & ~0x10, ea);
		case 0x1a: // BSET5
			return ea = this.fetch(), this.write8(this.read(ea) | 0x20, ea);
		case 0x1b: // BCLR5
			return ea = this.fetch(), this.write8(this.read(ea) & ~0x20, ea);
		case 0x1c: // BSET6
			return ea = this.fetch(), this.write8(this.read(ea) | 0x40, ea);
		case 0x1d: // BCLR6
			return ea = this.fetch(), this.write8(this.read(ea) & ~0x40, ea);
		case 0x1e: // BSET7
			return ea = this.fetch(), this.write8(this.read(ea) | 0x80, ea);
		case 0x1f: // BCLR7
			return ea = this.fetch(), this.write8(this.read(ea) & ~0x80, ea);
		case 0x20: // BRA
			return this.bcc(true);
		case 0x21: // BRN
			return this.bcc(false);
		case 0x22: // BHI
			return this.bcc(!((this.ccr >> 1 | this.ccr) & 1));
		case 0x23: // BLS
			return this.bcc(((this.ccr >> 1 | this.ccr) & 1) !== 0);
		case 0x24: // BCC
			return this.bcc(!(this.ccr & 1));
		case 0x25: // BLO(BCS)
			return this.bcc((this.ccr & 1) !== 0);
		case 0x26: // BNE
			return this.bcc(!(this.ccr & 2));
		case 0x27: // BEQ
			return this.bcc((this.ccr & 2) !== 0);
		case 0x28: // BHCC
			return this.bcc(!(this.ccr & 0x10));
		case 0x29: // BHCS
			return this.bcc((this.ccr & 0x10) !== 0);
		case 0x2a: // BPL
			return this.bcc(!(this.ccr & 4));
		case 0x2b: // BMI
			return this.bcc((this.ccr & 4) !== 0);
		case 0x2c: // BMC
			return this.bcc(!(this.ccr & 8));
		case 0x2d: // BMS
			return this.bcc((this.ccr & 8) !== 0);
		case 0x2e: // BIL
			return this.bcc(this.irq);
		case 0x2f: // BIH
			return this.bcc(!this.irq);
		case 0x30: // NEG <n
			return ea = this.fetch(), this.write8(this.neg8(this.read(ea)), ea);
		case 0x33: // COM <n
			return ea = this.fetch(), this.write8(this.com8(this.read(ea)), ea);
		case 0x34: // LSR <n
			return ea = this.fetch(), this.write8(this.lsr8(this.read(ea)), ea);
		case 0x36: // ROR <n
			return ea = this.fetch(), this.write8(this.ror8(this.read(ea)), ea);
		case 0x37: // ASR <n
			return ea = this.fetch(), this.write8(this.asr8(this.read(ea)), ea);
		case 0x38: // ASL(LSL) <n
			return ea = this.fetch(), this.write8(this.lsl8(this.read(ea)), ea);
		case 0x39: // ROL <n
			return ea = this.fetch(), this.write8(this.rol8(this.read(ea)), ea);
		case 0x3a: // DEC <n
			return ea = this.fetch(), this.write8(this.mov8(this.read(ea) - 1 & 0xff), ea);
		case 0x3c: // INC <n
			return ea = this.fetch(), this.write8(this.mov8(this.read(ea) + 1 & 0xff), ea);
		case 0x3d: // TST <n
			return void(this.mov8(this.read(this.fetch())));
		case 0x3f: // CLR <n
			return this.write8(this.clr8(), this.fetch());
		case 0x40: // NEGA
			return void(this.a = this.neg8(this.a));
		case 0x42: // MUL
			return [this.x, this.a] = this.split(this.x * this.a), void(this.ccr &= ~0x11);
		case 0x43: // COMA
			return void(this.a = this.com8(this.a));
		case 0x44: // LSRA
			return void(this.a = this.lsr8(this.a));
		case 0x46: // RORA
			return void(this.a = this.ror8(this.a));
		case 0x47: // ASRA
			return void(this.a = this.asr8(this.a));
		case 0x48: // ASLA(LSLA)
			return void(this.a = this.lsl8(this.a));
		case 0x49: // ROLA
			return void(this.a = this.rol8(this.a));
		case 0x4a: // DECA
			return void(this.a = this.mov8(this.a - 1 & 0xff));
		case 0x4c: // INCA
			return void(this.a = this.mov8(this.a + 1 & 0xff));
		case 0x4d: // TSTA
			return void(this.mov8(this.a));
		case 0x4f: // CLRA
			return void(this.a = this.clr8());
		case 0x50: // NEGX
			return void(this.x = this.neg8(this.x));
		case 0x53: // COMX
			return void(this.x = this.com8(this.x));
		case 0x54: // LSRX
			return void(this.x = this.lsr8(this.x));
		case 0x56: // RORX
			return void(this.x = this.ror8(this.x));
		case 0x57: // ASRX
			return void(this.x = this.asr8(this.x));
		case 0x58: // ASLX(LSLX)
			return void(this.x = this.lsl8(this.x));
		case 0x59: // ROLX
			return void(this.x = this.rol8(this.x));
		case 0x5a: // DECX
			return void(this.x = this.mov8(this.x - 1 & 0xff));
		case 0x5c: // INCX
			return void(this.x = this.mov8(this.x + 1 & 0xff));
		case 0x5d: // TSTX
			return void(this.mov8(this.x));
		case 0x5f: // CLRX
			return void(this.x = this.clr8());
		case 0x60: // NEG n,X
			return ea = this.x + this.fetch(), this.write8(this.neg8(this.read(ea)), ea);
		case 0x63: // COM n,X
			return ea = this.x + this.fetch(), this.write8(this.com8(this.read(ea)), ea);
		case 0x64: // LSR n,X
			return ea = this.x + this.fetch(), this.write8(this.lsr8(this.read(ea)), ea);
		case 0x66: // ROR n,X
			return ea = this.x + this.fetch(), this.write8(this.ror8(this.read(ea)), ea);
		case 0x67: // ASR n,X
			return ea = this.x + this.fetch(), this.write8(this.asr8(this.read(ea)), ea);
		case 0x68: // ASL(LSL) n,X
			return ea = this.x + this.fetch(), this.write8(this.lsl8(this.read(ea)), ea);
		case 0x69: // ROL n,X
			return ea = this.x + this.fetch(), this.write8(this.rol8(this.read(ea)), ea);
		case 0x6a: // DEC n,X
			return ea = this.x + this.fetch(), this.write8(this.mov8(this.read(ea) - 1 & 0xff), ea);
		case 0x6c: // INC n,X
			return ea = this.x + this.fetch(), this.write8(this.mov8(this.read(ea) + 1 & 0xff), ea);
		case 0x6d: // TST n,X
			return void(this.mov8(this.read(this.x + this.fetch())));
		case 0x6f: // CLR n,X
			return this.write8(this.clr8(), this.x + this.fetch());
		case 0x70: // NEG ,X
			return this.write8(this.neg8(this.read(this.x)), this.x);
		case 0x73: // COM ,X
			return this.write8(this.com8(this.read(this.x)), this.x);
		case 0x74: // LSR ,X
			return this.write8(this.lsr8(this.read(this.x)), this.x);
		case 0x76: // ROR ,X
			return this.write8(this.ror8(this.read(this.x)), this.x);
		case 0x77: // ASR ,X
			return this.write8(this.asr8(this.read(this.x)), this.x);
		case 0x78: // ASL(LSL) ,X
			return this.write8(this.lsl8(this.read(this.x)), this.x);
		case 0x79: // ROL ,X
			return this.write8(this.rol8(this.read(this.x)), this.x);
		case 0x7a: // DEC ,X
			return this.write8(this.mov8(this.read(this.x) - 1 & 0xff), this.x);
		case 0x7c: // INC ,X
			return this.write8(this.mov8(this.read(this.x) + 1 & 0xff), this.x);
		case 0x7d: // TST ,X
			return void(this.mov8(this.read(this.x)));
		case 0x7f: // CLR ,X
			return this.write8(this.clr8(), this.x);
		case 0x80: // RTI
			return this.ccr = this.pul() | 0xe0, this.a = this.pul(), this.x = this.pul(), void(this.pc = this.pul16() & 0x7ff);
		case 0x81: // RTS
			return void(this.pc = this.pul16() & 0x7ff);
		case 0x83: // SWI
			return this.psh16(this.pc), this.psh(this.x, this.a, this.ccr), this.ccr |= 8, void(this.pc = this.read16(0x7fc) & 0x7ff);
		case 0x8e: // STOP
		case 0x8f: // WAIT
			return this.ccr &= ~8, this.suspend();
		case 0x97: // TAX
			return void(this.x = this.a);
		case 0x98: // CLC
			return void(this.ccr &= ~1);
		case 0x99: // SEC
			return void(this.ccr |= 1);
		case 0x9a: // CLI
			return void(this.ccr &= ~8);
		case 0x9b: // SEI
			return void(this.ccr |= 8);
		case 0x9c: // RSP
			return void(this.s = 0x7f);
		case 0x9d: // NOP
			return;
		case 0x9f: // TXA
			return void(this.a = this.x);
		case 0xa0: // SUB #n
			return void(this.a = this.sub8(this.fetch(), this.a));
		case 0xa1: // CMP #n
			return void(this.sub8(this.fetch(), this.a));
		case 0xa2: // SBC #n
			return void(this.a = this.sbc8(this.fetch(), this.a));
		case 0xa3: // CPX #n
			return void(this.sub8(this.fetch(), this.x));
		case 0xa4: // AND #n
			return void(this.a = this.mov8(this.a & this.fetch()));
		case 0xa5: // BIT #n
			return void(this.mov8(this.a & this.fetch()));
		case 0xa6: // LDA #n
			return void(this.a = this.mov8(this.fetch()));
		case 0xa8: // EOR #n
			return void(this.a = this.mov8(this.a ^ this.fetch()));
		case 0xa9: // ADC #n
			return void(this.a = this.adc8(this.fetch(), this.a));
		case 0xaa: // ORA #n
			return void(this.a = this.mov8(this.a | this.fetch()));
		case 0xab: // ADD #n
			return void(this.a = this.add8(this.fetch(), this.a));
		case 0xad: // BSR
			return this.bsr();
		case 0xae: // LDX #n
			return void(this.x = this.mov8(this.fetch()));
		case 0xb0: // SUB <n
			return void(this.a = this.sub8(this.read(this.fetch()), this.a));
		case 0xb1: // CMP <n
			return void(this.sub8(this.read(this.fetch()), this.a));
		case 0xb2: // SBC <n
			return void(this.a = this.sbc8(this.read(this.fetch()), this.a));
		case 0xb3: // CPX <n
			return void(this.sub8(this.read(this.fetch()), this.x));
		case 0xb4: // AND <n
			return void(this.a = this.mov8(this.a & this.read(this.fetch())));
		case 0xb5: // BIT <n
			return void(this.mov8(this.a & this.read(this.fetch())));
		case 0xb6: // LDA <n
			return void(this.a = this.mov8(this.read(this.fetch())));
		case 0xb7: // STA <n
			return this.write8(this.mov8(this.a), this.fetch());
		case 0xb8: // EOR <n
			return void(this.a = this.mov8(this.a ^ this.read(this.fetch())));
		case 0xb9: // ADC <n
			return void(this.a = this.adc8(this.read(this.fetch()), this.a));
		case 0xba: // ORA <n
			return void(this.a = this.mov8(this.a | this.read(this.fetch())));
		case 0xbb: // ADD <n
			return void(this.a = this.add8(this.read(this.fetch()), this.a));
		case 0xbc: // JMP <n
			return void(this.pc = this.fetch());
		case 0xbd: // JSR <n
			return this.jsr(this.fetch());
		case 0xbe: // LDX <n
			return void(this.x = this.mov8(this.read(this.fetch())));
		case 0xbf: // STX <n
			return this.write8(this.mov8(this.x), this.fetch());
		case 0xc0: // SUB >nn
			return void(this.a = this.sub8(this.read(this.fetch16() & 0x7ff), this.a));
		case 0xc1: // CMP >nn
			return void(this.sub8(this.read(this.fetch16() & 0x7ff), this.a));
		case 0xc2: // SBC >nn
			return void(this.a = this.sbc8(this.read(this.fetch16() & 0x7ff), this.a));
		case 0xc3: // CPX >nn
			return void(this.sub8(this.read(this.fetch16() & 0x7ff), this.x));
		case 0xc4: // AND >nn
			return void(this.a = this.mov8(this.a & this.read(this.fetch16() & 0x7ff)));
		case 0xc5: // BIT >nn
			return void(this.mov8(this.a & this.read(this.fetch16() & 0x7ff)));
		case 0xc6: // LDA >nn
			return void(this.a = this.mov8(this.read(this.fetch16() & 0x7ff)));
		case 0xc7: // STA >nn
			return this.write8(this.mov8(this.a), this.fetch16() & 0x7ff);
		case 0xc8: // EOR >nn
			return void(this.a = this.mov8(this.a ^ this.read(this.fetch16() & 0x7ff)));
		case 0xc9: // ADC >nn
			return void(this.a = this.adc8(this.read(this.fetch16() & 0x7ff), this.a));
		case 0xca: // ORA >nn
			return void(this.a = this.mov8(this.a | this.read(this.fetch16() & 0x7ff)));
		case 0xcb: // ADD >nn
			return void(this.a = this.add8(this.read(this.fetch16() & 0x7ff), this.a));
		case 0xcc: // JMP >nn
			return void(this.pc = this.fetch16() & 0x7ff);
		case 0xcd: // JSR >nn
			return this.jsr(this.fetch16() & 0x7ff);
		case 0xce: // LDX >nn
			return void(this.x = this.mov8(this.read(this.fetch16() & 0x7ff)));
		case 0xcf: // STX >nn
			return this.write8(this.mov8(this.x), this.fetch16() & 0x7ff);
		case 0xd0: // SUB nn,X
			return void(this.a = this.sub8(this.read(this.x + this.fetch16() & 0x7ff), this.a));
		case 0xd1: // CMP nn,X
			return void(this.sub8(this.read(this.x + this.fetch16() & 0x7ff), this.a));
		case 0xd2: // SBC nn,X
			return void(this.a = this.sbc8(this.read(this.x + this.fetch16() & 0x7ff), this.a));
		case 0xd3: // CPX nn,X
			return void(this.sub8(this.read(this.x + this.fetch16() & 0x7ff), this.x));
		case 0xd4: // AND nn,X
			return void(this.a = this.mov8(this.a & this.read(this.x + this.fetch16() & 0x7ff)));
		case 0xd5: // BIT nn,X
			return void(this.mov8(this.a & this.read(this.x + this.fetch16() & 0x7ff)));
		case 0xd6: // LDA nn,X
			return void(this.a = this.mov8(this.read(this.x + this.fetch16() & 0x7ff)));
		case 0xd7: // STA nn,X
			return this.write8(this.mov8(this.a), this.x + this.fetch16() & 0x7ff);
		case 0xd8: // EOR nn,X
			return void(this.a = this.mov8(this.a ^ this.read(this.x + this.fetch16() & 0x7ff)));
		case 0xd9: // ADC nn,X
			return void(this.a = this.adc8(this.read(this.x + this.fetch16() & 0x7ff), this.a));
		case 0xda: // ORA nn,X
			return void(this.a = this.mov8(this.a | this.read(this.x + this.fetch16() & 0x7ff)));
		case 0xdb: // ADD nn,X
			return void(this.a = this.add8(this.read(this.x + this.fetch16() & 0x7ff), this.a));
		case 0xdc: // JMP nn,X
			return void(this.pc = this.x + this.fetch16() & 0x7ff);
		case 0xdd: // JSR nn,X
			return this.jsr(this.x + this.fetch16() & 0x7ff);
		case 0xde: // LDX nn,X
			return void(this.x = this.mov8(this.read(this.x + this.fetch16() & 0x7ff)));
		case 0xdf: // STX nn,X
			return this.write8(this.mov8(this.x), this.x + this.fetch16() & 0x7ff);
		case 0xe0: // SUB n,X
			return void(this.a = this.sub8(this.read(this.x + this.fetch()), this.a));
		case 0xe1: // CMP n,X
			return void(this.sub8(this.read(this.x + this.fetch()), this.a));
		case 0xe2: // SBC n,X
			return void(this.a = this.sbc8(this.read(this.x + this.fetch()), this.a));
		case 0xe3: // CPX n,X
			return void(this.sub8(this.read(this.x + this.fetch()), this.x));
		case 0xe4: // AND n,X
			return void(this.a = this.mov8(this.a & this.read(this.x + this.fetch())));
		case 0xe5: // BIT n,X
			return void(this.mov8(this.a & this.read(this.x + this.fetch())));
		case 0xe6: // LDA n,X
			return void(this.a = this.mov8(this.read(this.x + this.fetch())));
		case 0xe7: // STA n,X
			return this.write8(this.mov8(this.a), this.x + this.fetch());
		case 0xe8: // EOR n,X
			return void(this.a = this.mov8(this.a ^ this.read(this.x + this.fetch())));
		case 0xe9: // ADC n,X
			return void(this.a = this.adc8(this.read(this.x + this.fetch()), this.a));
		case 0xea: // ORA n,X
			return void(this.a = this.mov8(this.a | this.read(this.x + this.fetch())));
		case 0xeb: // ADD n,X
			return void(this.a = this.add8(this.read(this.x + this.fetch()), this.a));
		case 0xec: // JMP n,X
			return void(this.pc = this.x + this.fetch());
		case 0xed: // JSR n,X
			return this.jsr(this.x + this.fetch());
		case 0xee: // LDX n,X
			return void(this.x = this.mov8(this.read(this.x + this.fetch())));
		case 0xef: // STX n,X
			return this.write8(this.mov8(this.x), this.x + this.fetch());
		case 0xf0: // SUB ,X
			return void(this.a = this.sub8(this.read(this.x), this.a));
		case 0xf1: // CMP ,X
			return void(this.sub8(this.read(this.x), this.a));
		case 0xf2: // SBC ,X
			return void(this.a = this.sbc8(this.read(this.x), this.a));
		case 0xf3: // CPX ,X
			return void(this.sub8(this.read(this.x), this.x));
		case 0xf4: // AND ,X
			return void(this.a = this.mov8(this.a & this.read(this.x)));
		case 0xf5: // BIT ,X
			return void(this.mov8(this.a & this.read(this.x)));
		case 0xf6: // LDA ,X
			return void(this.a = this.mov8(this.read(this.x)));
		case 0xf7: // STA ,X
			return this.write8(this.mov8(this.a), this.x);
		case 0xf8: // EOR ,X
			return void(this.a = this.mov8(this.a ^ this.read(this.x)));
		case 0xf9: // ADC ,X
			return void(this.a = this.adc8(this.read(this.x), this.a));
		case 0xfa: // ORA ,X
			return void(this.a = this.mov8(this.a | this.read(this.x)));
		case 0xfb: // ADD ,X
			return void(this.a = this.add8(this.read(this.x), this.a));
		case 0xfc: // JMP ,X
			return void(this.pc = this.x);
		case 0xfd: // JSR ,X
			return this.jsr(this.x);
		case 0xfe: // LDX ,X
			return void(this.x = this.mov8(this.read(this.x)));
		case 0xff: // STX ,X
			return this.write8(this.mov8(this.x), this.x);
		default:
			this.undefsize = 1;
			this.undef();
			return;
		}
	}

	bcc(cond) {
		const n = this.fetch();
		if (cond) this.pc = this.pc + (n << 24 >> 24) & 0x7ff;
	}

	bsr() {
		const n = this.fetch();
		this.psh16(this.pc), this.pc = this.pc + (n << 24 >> 24) & 0x7ff;
	}

	neg8(dst) {
		const r = -dst & 0xff, c = dst | r;
		return this.ccr = this.ccr & ~7 | r >> 5 & 4 | !r << 1 | c >> 7 & 1, r;
	}

	com8(dst) {
		const r = ~dst & 0xff;
		return this.ccr = this.ccr & ~7 | r >> 5 & 4 | !r << 1 | 1, r;
	}

	lsr8(dst) {
		const r = dst >> 1, c = dst & 1;
		return this.ccr = this.ccr & ~7 | !r << 1 | c, r;
	}

	ror8(dst) {
		const r = dst >> 1 | this.ccr << 7 & 0x80, c = dst & 1;
		return this.ccr = this.ccr & ~7 | r >> 5 & 4 | !r << 1 | c, r;
	}

	asr8(dst) {
		const r = dst >> 1 | dst & 0x80, c = dst & 1;
		return this.ccr = this.ccr & ~7 | r >> 5 & 4 | !r << 1 | c, r;
	}

	lsl8(dst) {
		const r = dst << 1 & 0xff, c = dst >> 7;
		return this.ccr = this.ccr & ~7 | r >> 5 & 4 | !r << 1 | c, r;
	}

	rol8(dst) {
		const r = dst << 1 & 0xff | this.ccr & 1, c = dst >> 7;
		return this.ccr = this.ccr & ~7 | r >> 5 & 4 | !r << 1 | c, r;
	}

	clr8() {
		return this.ccr = this.ccr & ~6 | 2, 0;
	}

	sub8(src, dst) {
		const r = dst - src & 0xff, c = ~dst & src | src & r | r & ~dst;
		return this.ccr = this.ccr & ~7 | r >> 5 & 4 | !r << 1 | c >> 7 & 1, r;
	}

	sbc8(src, dst) {
		const r = dst - src - (this.ccr & 1) & 0xff, c = ~dst & src | src & r | r & ~dst;
		return this.ccr = this.ccr & ~7 | r >> 5 & 4 | !r << 1 | c >> 7 & 1, r;
	}

	mov8(src) {
		return this.ccr = this.ccr & ~6 | src >> 5 & 4 | !src << 1, src;
	}

	adc8(src, dst) {
		const r = dst + src + (this.ccr & 1) & 0xff, c = dst & src | src & ~r | ~r & dst;
		return this.ccr = this.ccr & ~0x17 | c << 1 & 0x10 | r >> 5 & 4 | !r << 1 | c >> 7 & 1, r;
	}

	add8(src, dst) {
		const r = dst + src & 0xff, c = dst & src | src & ~r | ~r & dst;
		return this.ccr = this.ccr & ~0x17 | c << 1 & 0x10 | r >> 5 & 4 | !r << 1 | c >> 7 & 1, r;
	}

	jsr(ea) {
		this.psh16(this.pc), this.pc = ea;
	}

	psh(...args) {
		args.forEach(e => (this.write8(e, this.s), this.s = this.s - 1 & 0x1f | 0x60));
	}

	pul() {
		return this.s = this.s + 1 & 0x1f | 0x60, this.read(this.s);
	}

	psh16(r) {
		this.psh(r & 0xff, r >> 8);
	}

	pul16() {
		const r = this.pul() << 8;
		return r | this.pul();
	}

	split(v) {
		return [v >> 8, v & 0xff];
	}

	fetch() {
		const page = this.memorymap[this.pc >> 8];
		const data = !page.fetch ? page.base[this.pc & 0xff] : page.fetch(this.pc);
		return this.pc = this.pc + 1 & 0x7ff, data;
	}

	fetch16() {
		const data = this.fetch() << 8;
		return data | this.fetch();
	}

	read16(addr) {
		const data = this.read(addr) << 8;
		return data | this.read(addr + 1);
	}

	write8(data, addr) {
		const page = this.memorymap[addr >> 8];
		!page.write ? void(page.base[addr & 0xff] = data) : page.write(addr, data);
	}
}

const cc = Uint8Array.of( // MC68705P5
	10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,
	 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
	 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
	 6, 0, 0, 6, 6, 0, 6, 6, 6, 6, 6, 0, 6, 6, 0, 6,
	 4, 0, 0, 4, 4, 0, 4, 4, 4, 4, 4, 0, 4, 4, 0, 4,
	 4, 0, 0, 4, 4, 0, 4, 4, 4, 4, 4, 0, 4, 4, 0, 4,
	 7, 0, 0, 7, 7, 0, 7, 7, 7, 7, 7, 0, 7, 7, 0, 7,
	 6, 0, 0, 6, 6, 0, 6, 6, 6, 6, 6, 0, 6, 6, 0, 6,
	 9, 6, 0,11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 0, 2,
	 2, 2, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 0, 8, 2, 0,
	 4, 4, 4, 4, 4, 4, 4, 5, 4, 4, 4, 4, 3, 7, 4, 5,
	 5, 5, 5, 5, 5, 5, 5, 6, 5, 5, 5, 5, 4, 8, 5, 6,
	 6, 6, 6, 6, 6, 6, 6, 7, 6, 6, 6, 6, 5, 9, 6, 7,
	 5, 5, 5, 5, 5, 5, 5, 6, 5, 5, 5, 5, 4, 8, 5, 6,
	 4, 4, 4, 4, 4, 4, 4, 5, 4, 4, 4, 4, 3, 7, 4, 5);

