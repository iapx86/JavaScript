/*
 *
 *	MC6805 Emulator
 *
 */

let aAdd = []; // [2][0x100][0x100];
let aSub = []; // [2][0x100][0x100];
let aRl = []; // [2][0x100];
let aRr = []; // [2][0x100];
let fLogic = new Uint8Array(0x100);

(function () {
	let f, i, j, k, r;

	for (i = 0; i < 2; i++) {
		aAdd[i] = [];
		for (j = 0; j < 0x100; j++)
			aAdd[i][j] = new Uint16Array(0x100);
	}
	for (i = 0; i < 2; i++) {
		aSub[i] = [];
		for (j = 0; j < 0x100; j++)
			aSub[i][j] = new Uint16Array(0x100);
	}
	for (i = 0; i < 2; i++)
		aRl[i] = new Uint16Array(0x100);
	for (i = 0; i < 2; i++)
		aRr[i] = new Uint16Array(0x100);

	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++)
			for (k = 0; k < 0x100; k++) {
				r = j - (j << 1 & 0x100) + k - (k << 1 & 0x100) + i;
				f = r >>> 4 & 8;
				if ((r & 0xff) === 0)
					f |= 4;
				f |= (r ^ j ^ k) << 1 & 0x20;
				f |= (r ^ j << 1 ^ k << 1) >>> 8 & 1;
				aAdd[i][k][j] = f << 8 | r & 0xff;
			}
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++)
			for (k = 0; k < 0x100; k++) {
				r = j - (j << 1 & 0x100) - k + (k << 1 & 0x100) - i;
				f = r >>> 4 & 8;
				if ((r & 0xff) === 0)
					f |= 4;
				f |= (r ^ j << 1 ^ k << 1) >>> 8 & 1;
				aSub[i][k][j] = f << 8 | r & 0xff;
			}
	for (i = 0; i < 0x100; i++) {
		f = i >>> 4 & 8;
		if (!i)
			f |= 4;
		fLogic[i] = f;
	}
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++) {
			r = (j << 1 | i) & 0xff;
			f = fLogic[r] | j >>> 7;
			aRl[i][j] = f << 8 | r;
		}
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++) {
			r = j >>> 1 | i << 7;
			f = fLogic[r] | j & 1;
			aRr[i][j] = f << 8 | r;
		}
})();

class MC6805 extends Cpu {
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

	interrupt() {
		if (!super.interrupt() || (this.ccr & 0x10) !== 0)
			return false;
		this.psh16(this.pc);
		this.psh(this.x);
		this.psh(this.a);
		this.psh(0xe0 | this.ccr >> 1 & 0x1e | this.ccr & 1);
		this.ccr |= 0x10;
		this.pc = (this.read(0x7fa) << 8 | this.read(0x7fb)) & 0x7ff;
		return true;
	}

	_execute() {
		let v;

		switch (this.fetch()) {
		case 0x00: // BRSET0
			this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) & 1) & 1) !== 0);
			break;
		case 0x01: // BRCLR0
			this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) & 1) & 1) === 0);
			break;
		case 0x02: // BRSET1
			this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 1 & 1) & 1) !== 0);
			break;
		case 0x03: // BRCLR1
			this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 1 & 1) & 1) === 0);
			break;
		case 0x04: // BRSET2
			this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 2 & 1) & 1) !== 0);
			break;
		case 0x05: // BRCLR2
			this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 2 & 1) & 1) === 0);
			break;
		case 0x06: // BRSET3
			this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 3 & 1) & 1) !== 0);
			break;
		case 0x07: // BRCLR3
			this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 3 & 1) & 1) === 0);
			break;
		case 0x08: // BRSET4
			this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 4 & 1) & 1) !== 0);
			break;
		case 0x09: // BRCLR4
			this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 4 & 1) & 1) === 0);
			break;
		case 0x0a: // BRSET5
			this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 5 & 1) & 1) !== 0);
			break;
		case 0x0b: // BRCLR5
			this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 5 & 1) & 1) === 0);
			break;
		case 0x0c: // BRSET6
			this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 6 & 1) & 1) !== 0);
			break;
		case 0x0d: // BRCLR6
			this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 6 & 1) & 1) === 0);
			break;
		case 0x0e: // BRSET7
			this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 7 & 1) & 1) !== 0);
			break;
		case 0x0f: // BRCLR7
			this.bcc(((this.ccr = this.ccr & ~1 | this.read(this.direct()) >>> 7 & 1) & 1) === 0);
			break;
		case 0x10: // BSET0
			this.write(v = this.direct(), this.read(v) | 1);
			break;
		case 0x11: // BCLR0
			this.write(v = this.direct(), this.read(v) & ~1);
			break;
		case 0x12: // BSET1
			this.write(v = this.direct(), this.read(v) | 2);
			break;
		case 0x13: // BCLR1
			this.write(v = this.direct(), this.read(v) & ~2);
			break;
		case 0x14: // BSET2
			this.write(v = this.direct(), this.read(v) | 4);
			break;
		case 0x15: // BCLR2
			this.write(v = this.direct(), this.read(v) & ~4);
			break;
		case 0x16: // BSET3
			this.write(v = this.direct(), this.read(v) | 8);
			break;
		case 0x17: // BCLR3
			this.write(v = this.direct(), this.read(v) & ~8);
			break;
		case 0x18: // BSET4
			this.write(v = this.direct(), this.read(v) | 0x10);
			break;
		case 0x19: // BCLR4
			this.write(v = this.direct(), this.read(v) & ~0x10);
			break;
		case 0x1a: // BSET5
			this.write(v = this.direct(), this.read(v) | 0x20);
			break;
		case 0x1b: // BCLR5
			this.write(v = this.direct(), this.read(v) & ~0x20);
			break;
		case 0x1c: // BSET6
			this.write(v = this.direct(), this.read(v) | 0x40);
			break;
		case 0x1d: // BCLR6
			this.write(v = this.direct(), this.read(v) & ~0x40);
			break;
		case 0x1e: // BSET7
			this.write(v = this.direct(), this.read(v) | 0x80);
			break;
		case 0x1f: // BCLR7
			this.write(v = this.direct(), this.read(v) & ~0x80);
			break;
		case 0x20: // BRA
			this.bcc(true);
			break;
		case 0x21: // BRN
			this.bcc(false);
			break;
		case 0x22: // BHI
			this.bcc(((this.ccr >>> 2 | this.ccr) & 1) === 0);
			break;
		case 0x23: // BLS
			this.bcc(((this.ccr >>> 2 | this.ccr) & 1) !== 0);
			break;
		case 0x24: // BCC
			this.bcc((this.ccr & 1) === 0);
			break;
		case 0x25: // BLO(BCS)
			this.bcc((this.ccr & 1) !== 0);
			break;
		case 0x26: // BNE
			this.bcc((this.ccr & 4) === 0);
			break;
		case 0x27: // BEQ
			this.bcc((this.ccr & 4) !== 0);
			break;
		case 0x28: // BHCC
			this.bcc((this.ccr & 0x20) === 0);
			break;
		case 0x29: // BHCS
			this.bcc((this.ccr & 0x20) !== 0);
			break;
		case 0x2a: // BPL
			this.bcc((this.ccr & 8) === 0);
			break;
		case 0x2b: // BMI
			this.bcc((this.ccr & 8) !== 0);
			break;
		case 0x2c: // BMC
			this.bcc((this.ccr & 0x10) === 0);
			break;
		case 0x2d: // BMS
			this.bcc((this.ccr & 0x10) !== 0);
			break;
		case 0x2e: // BIL
			this.bcc(!this.int);
			break;
		case 0x2f: // BIH
			this.bcc(this.int);
			break;
		case 0x30: // NEG <n
			this.neg(this.direct());
			break;
		case 0x33: // COM <n
			this.com(this.direct());
			break;
		case 0x34: // LSR <n
			this.lsr(this.direct());
			break;
		case 0x36: // ROR <n
			this.ror(this.direct());
			break;
		case 0x37: // ASR <n
			this.asr(this.direct());
			break;
		case 0x38: // ASL(LSL) <n
			this.lsl(this.direct());
			break;
		case 0x39: // ROL <n
			this.rol(this.direct());
			break;
		case 0x3a: // DEC <n
			this.dec(this.direct());
			break;
		case 0x3c: // INC <n
			this.inc(this.direct());
			break;
		case 0x3d: // TST <n
			this.tst(this.direct());
			break;
		case 0x3f: // CLR <n
			this.clr(this.direct());
			break;
		case 0x40: // NEGA
			this.a = this.nega(this.a);
			break;
		case 0x42: // MUL
			this.x = (v = this.x * this.a) >>> 8;
			this.a = v & 0xff;
			this.ccr &= ~0x21;
			break;
		case 0x43: // COMA
			this.a = this.coma(this.a);
			break;
		case 0x44: // LSRA
			this.a = this.lsra(this.a);
			break;
		case 0x46: // RORA
			this.a = this.rora(this.a);
			break;
		case 0x47: // ASRA
			this.a = this.asra(this.a);
			break;
		case 0x48: // ASLA(LSLA)
			this.a = this.lsla(this.a);
			break;
		case 0x49: // ROLA
			this.a = this.rola(this.a);
			break;
		case 0x4a: // DECA
			this.a = this.deca(this.a);
			break;
		case 0x4c: // INCA
			this.a = this.inca(this.a);
			break;
		case 0x4d: // TSTA
			this.tsta(this.a);
			break;
		case 0x4f: // CLRA
			this.a = this.clra();
			break;
		case 0x50: // NEGX
			this.x = this.nega(this.x);
			break;
		case 0x53: // COMX
			this.x = this.coma(this.x);
			break;
		case 0x54: // LSRX
			this.x = this.lsra(this.x);
			break;
		case 0x56: // RORX
			this.x = this.rora(this.x);
			break;
		case 0x57: // ASRX
			this.x = this.asra(this.x);
			break;
		case 0x58: // ASLX(LSLX)
			this.x = this.lsla(this.x);
			break;
		case 0x59: // ROLX
			this.x = this.rola(this.x);
			break;
		case 0x5a: // DECX
			this.x = this.deca(this.x);
			break;
		case 0x5c: // INCX
			this.x = this.inca(this.x);
			break;
		case 0x5d: // TSTX
			this.tsta(this.x);
			break;
		case 0x5f: // CLRX
			this.x = this.clra();
			break;
		case 0x60: // NEG n,X
			this.neg(this.index1());
			break;
		case 0x63: // COM n,X
			this.com(this.index1());
			break;
		case 0x64: // LSR n,X
			this.lsr(this.index1());
			break;
		case 0x66: // ROR n,X
			this.ror(this.index1());
			break;
		case 0x67: // ASR n,X
			this.asr(this.index1());
			break;
		case 0x68: // ASL(LSL) n,X
			this.lsl(this.index1());
			break;
		case 0x69: // ROL n,X
			this.rol(this.index1());
			break;
		case 0x6a: // DEC n,X
			this.dec(this.index1());
			break;
		case 0x6c: // INC n,X
			this.inc(this.index1());
			break;
		case 0x6d: // TST n,X
			this.tst(this.index1());
			break;
		case 0x6f: // CLR n,X
			this.clr(this.index1());
			break;
		case 0x70: // NEG ,X
			this.neg(this.index());
			break;
		case 0x73: // COM ,X
			this.com(this.index());
			break;
		case 0x74: // LSR ,X
			this.lsr(this.index());
			break;
		case 0x76: // ROR ,X
			this.ror(this.index());
			break;
		case 0x77: // ASR ,X
			this.asr(this.index());
			break;
		case 0x78: // ASL(LSL) ,X
			this.lsl(this.index());
			break;
		case 0x79: // ROL ,X
			this.rol(this.index());
			break;
		case 0x7a: // DEC ,X
			this.dec(this.index());
			break;
		case 0x7c: // INC ,X
			this.inc(this.index());
			break;
		case 0x7d: // TST ,X
			this.tst(this.index());
			break;
		case 0x7f: // CLR ,X
			this.clr(this.index());
			break;
		case 0x80: // RTI
			this.ccr = (v = this.pul()) << 1 & 0x2c | v & 1;
			this.a = this.pul();
			this.x = this.pul();
			this.pc = this.pul16() & 0x7ff;
			break;
		case 0x81: // RTS
			this.pc = this.pul16() & 0x7ff;
			break;
		case 0x83: // SWI
			this.psh16(this.pc);
			this.psh(this.x);
			this.psh(this.a);
			this.psh(0xe0 | this.ccr >> 1 & 0x1e | this.ccr & 1);
			this.ccr |= 0x10;
			this.pc = (this.read(0x7fc) << 8 | this.read(0x7fd)) & 0x7ff;
			break;
		case 0x8e: // STOP
		case 0x8f: // WAIT
			this.ccr &= ~0x10;
			this.suspend();
			break;
		case 0x97: // TAX
			this.x = this.a;
			break;
		case 0x98: // CLC
			this.ccr &= ~1;
			break;
		case 0x99: // SEC
			this.ccr |= 1;
			break;
		case 0x9a: // CLI
			this.ccr &= ~0x10;
			break;
		case 0x9b: // SEI
			this.ccr |= 0x10;
			break;
		case 0x9c: // RSP
			this.s = 0x7f;
			break;
		case 0x9d: // NOP
			break;
		case 0x9f: // TXA
			this.a = this.x;
			break;
		case 0xa0: // SUB #n
			this.a = this.sub(this.a, null);
			break;
		case 0xa1: // CMP #n
			this.cmp(this.a, null);
			break;
		case 0xa2: // SBC #n
			this.a = this.sbc(this.a, null);
			break;
		case 0xa3: // CPX #n
			this.cmp(this.x, null);
			break;
		case 0xa4: // AND #n
			this.a = this.and(this.a, null);
			break;
		case 0xa5: // BIT #n
			this.bit(this.a, null);
			break;
		case 0xa6: // LDA #n
			this.a = this.ld(null);
			break;
		case 0xa8: // EOR #n
			this.a = this.eor(this.a, null);
			break;
		case 0xa9: // ADC #n
			this.a = this.adc(this.a, null);
			break;
		case 0xaa: // ORA #n
			this.a = this.or(this.a, null);
			break;
		case 0xab: // ADD #n
			this.a = this.add(this.a, null);
			break;
		case 0xad: // BSR
			this.bsr();
			break;
		case 0xae: // LDX #n
			this.x = this.ld(null);
			break;
		case 0xb0: // SUB <n
			this.a = this.sub(this.a, this.direct());
			break;
		case 0xb1: // CMP <n
			this.cmp(this.a, this.direct());
			break;
		case 0xb2: // SBC <n
			this.a = this.sbc(this.a, this.direct());
			break;
		case 0xb3: // CPX <n
			this.cmp(this.x, this.direct());
			break;
		case 0xb4: // AND <n
			this.a = this.and(this.a, this.direct());
			break;
		case 0xb5: // BIT <n
			this.bit(this.a, this.direct());
			break;
		case 0xb6: // LDA <n
			this.a = this.ld(this.direct());
			break;
		case 0xb7: // STA <n
			this.st(this.a, this.direct());
			break;
		case 0xb8: // EOR <n
			this.a = this.eor(this.a, this.direct());
			break;
		case 0xb9: // ADC <n
			this.a = this.adc(this.a, this.direct());
			break;
		case 0xba: // ORA <n
			this.a = this.or(this.a, this.direct());
			break;
		case 0xbb: // ADD <n
			this.a = this.add(this.a, this.direct());
			break;
		case 0xbc: // JMP <n
			this.pc = this.direct();
			break;
		case 0xbd: // JSR <n
			this.jsr(this.direct());
			break;
		case 0xbe: // LDX <n
			this.x = this.ld(this.direct());
			break;
		case 0xbf: // STX <n
			this.st(this.x, this.direct());
			break;
		case 0xc0: // SUB >nn
			this.a = this.sub(this.a, this.extend());
			break;
		case 0xc1: // CMP >nn
			this.cmp(this.a, this.extend());
			break;
		case 0xc2: // SBC >nn
			this.a = this.sbc(this.a, this.extend());
			break;
		case 0xc3: // CPX >nn
			this.cmp(this.x, this.extend());
			break;
		case 0xc4: // AND >nn
			this.a = this.and(this.a, this.extend());
			break;
		case 0xc5: // BIT >nn
			this.bit(this.a, this.extend());
			break;
		case 0xc6: // LDA >nn
			this.a = this.ld(this.extend());
			break;
		case 0xc7: // STA >nn
			this.st(this.a, this.extend());
			break;
		case 0xc8: // EOR >nn
			this.a = this.eor(this.a, this.extend());
			break;
		case 0xc9: // ADC >nn
			this.a = this.adc(this.a, this.extend());
			break;
		case 0xca: // ORA >nn
			this.a = this.or(this.a, this.extend());
			break;
		case 0xcb: // ADD >nn
			this.a = this.add(this.a, this.extend());
			break;
		case 0xcc: // JMP >nn
			this.pc = this.extend();
			break;
		case 0xcd: // JSR >nn
			this.jsr(this.extend());
			break;
		case 0xce: // LDX >nn
			this.x = this.ld(this.extend());
			break;
		case 0xcf: // STX >nn
			this.st(this.x, this.extend());
			break;
		case 0xd0: // SUB nn,X
			this.a = this.sub(this.a, this.index2());
			break;
		case 0xd1: // CMP nn,X
			this.cmp(this.a, this.index2());
			break;
		case 0xd2: // SBC nn,X
			this.a = this.sbc(this.a, this.index2());
			break;
		case 0xd3: // CPX nn,X
			this.cmp(this.x, this.index2());
			break;
		case 0xd4: // AND nn,X
			this.a = this.and(this.a, this.index2());
			break;
		case 0xd5: // BIT nn,X
			this.bit(this.a, this.index2());
			break;
		case 0xd6: // LDA nn,X
			this.a = this.ld(this.index2());
			break;
		case 0xd7: // STA nn,X
			this.st(this.a, this.index2());
			break;
		case 0xd8: // EOR nn,X
			this.a = this.eor(this.a, this.index2());
			break;
		case 0xd9: // ADC nn,X
			this.a = this.adc(this.a, this.index2());
			break;
		case 0xda: // ORA nn,X
			this.a = this.or(this.a, this.index2());
			break;
		case 0xdb: // ADD nn,X
			this.a = this.add(this.a, this.index2());
			break;
		case 0xdc: // JMP nn,X
			this.pc = this.index2();
			break;
		case 0xdd: // JSR nn,X
			this.jsr(this.index2());
			break;
		case 0xde: // LDX nn,X
			this.x = this.ld(this.index2());
			break;
		case 0xdf: // STX nn,X
			this.st(this.x, this.index2());
			break;
		case 0xe0: // SUB n,X
			this.a = this.sub(this.a, this.index1());
			break;
		case 0xe1: // CMP n,X
			this.cmp(this.a, this.index1());
			break;
		case 0xe2: // SBC n,X
			this.a = this.sbc(this.a, this.index1());
			break;
		case 0xe3: // CPX n,X
			this.cmp(this.x, this.index1());
			break;
		case 0xe4: // AND n,X
			this.a = this.and(this.a, this.index1());
			break;
		case 0xe5: // BIT n,X
			this.bit(this.a, this.index1());
			break;
		case 0xe6: // LDA n,X
			this.a = this.ld(this.index1());
			break;
		case 0xe7: // STA n,X
			this.st(this.a, this.index1());
			break;
		case 0xe8: // EOR n,X
			this.a = this.eor(this.a, this.index1());
			break;
		case 0xe9: // ADC n,X
			this.a = this.adc(this.a, this.index1());
			break;
		case 0xea: // ORA n,X
			this.a = this.or(this.a, this.index1());
			break;
		case 0xeb: // ADD n,X
			this.a = this.add(this.a, this.index1());
			break;
		case 0xec: // JMP n,X
			this.pc = this.index1();
			break;
		case 0xed: // JSR n,X
			this.jsr(this.index1());
			break;
		case 0xee: // LDX n,X
			this.x = this.ld(this.index1());
			break;
		case 0xef: // STX n,X
			this.st(this.x, this.index1());
			break;
		case 0xf0: // SUB ,X
			this.a = this.sub(this.a, this.index());
			break;
		case 0xf1: // CMP ,X
			this.cmp(this.a, this.index());
			break;
		case 0xf2: // SBC ,X
			this.a = this.sbc(this.a, this.index());
			break;
		case 0xf3: // CPX ,X
			this.cmp(this.x, this.index());
			break;
		case 0xf4: // AND ,X
			this.a = this.and(this.a, this.index());
			break;
		case 0xf5: // BIT ,X
			this.bit(this.a, this.index());
			break;
		case 0xf6: // LDA ,X
			this.a = this.ld(this.index());
			break;
		case 0xf7: // STA ,X
			this.st(this.a, this.index());
			break;
		case 0xf8: // EOR ,X
			this.a = this.eor(this.a, this.index());
			break;
		case 0xf9: // ADC ,X
			this.a = this.adc(this.a, this.index());
			break;
		case 0xfa: // ORA ,X
			this.a = this.or(this.a, this.index());
			break;
		case 0xfb: // ADD ,X
			this.a = this.add(this.a, this.index());
			break;
		case 0xfc: // JMP ,X
			this.pc = this.index();
			break;
		case 0xfd: // JSR ,X
			this.jsr(this.index());
			break;
		case 0xfe: // LDX ,X
			this.x = this.ld(this.index());
			break;
		case 0xff: // STX ,X
			this.st(this.x, this.index());
			break;
		default:
			this.undefsize = 1;
			if (this.undef)
				this.undef(this.arg);
			break;
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
		r = aSub[0][r][0];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	coma(r) {
		this.ccr = this.ccr & ~0x0f | 1 | fLogic[r = ~r & 0xff];
		return r;
	}

	lsra(r) {
		r = aRr[0][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	rora(r) {
		r = aRr[this.ccr & 1][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	asra(r) {
		r = aRr[r >>> 7][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	lsla(r) {
		r = aRl[0][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	rola(r) {
		r = aRl[this.ccr & 1][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	deca(r) {
		r = aSub[0][1][r];
		this.ccr = this.ccr & ~0x0e | r >>> 8 & 0x0e;
		return r & 0xff;
	}

	inca(r) {
		r = aAdd[0][1][r];
		this.ccr = this.ccr & ~0x0e | r >>> 8 & 0x0e;
		return r & 0xff;
	}

	tsta(r) {
		this.ccr = this.ccr & ~0x0e | fLogic[r];
	}

	clra() {
		this.ccr = this.ccr & ~0x0e | 4;
		return 0;
	}

	neg(ea) {
		const r = aSub[0][this.read(ea)][0];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		this.write(ea, r & 0xff);
	}

	com(ea) {
		const r = ~this.read(ea) & 0xff;
		this.ccr = this.ccr & ~0x0f | 1 | fLogic[r];
		this.write(ea, r);
	}

	lsr(ea) {
		const r = aRr[0][this.read(ea)];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		this.write(ea, r & 0xff);
	}

	ror(ea) {
		const r = aRr[this.ccr & 1][this.read(ea)];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		this.write(ea, r & 0xff);
	}

	asr(ea) {
		let r = this.read(ea);
		r = aRr[r >>> 7][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		this.write(ea, r & 0xff);
	}

	lsl(ea) {
		const r = aRl[0][this.read(ea)];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		this.write(ea, r & 0xff);
	}

	rol(ea) {
		const r = aRl[this.ccr & 1][this.read(ea)];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		this.write(ea, r & 0xff);
	}

	dec(ea) {
		const r = aSub[0][1][this.read(ea)];
		this.ccr = this.ccr & ~0x0e | r >>> 8 & 0x0e;
		this.write(ea, r & 0xff);
	}

	inc(ea) {
		const r = aAdd[0][1][this.read(ea)];
		this.ccr = this.ccr & ~0x0e | r >>> 8 & 0x0e;
		this.write(ea, r & 0xff);
	}

	tst(ea) {
		this.ccr = this.ccr & ~0x0e | fLogic[this.read(ea)];
	}

	clr(ea) {
		this.ccr = this.ccr & ~0x0e | 4;
		this.write(ea, 0);
	}

	sub(r, ea) {
		r = aSub[0][this.readf(ea)][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	cmp(r, ea) {
		this.ccr = this.ccr & ~0x0f | aSub[0][this.readf(ea)][r] >>> 8;
	}

	sbc(r, ea) {
		r = aSub[this.ccr & 1][this.readf(ea)][r];
		this.ccr = this.ccr & ~0x0f | r >>> 8;
		return r & 0xff;
	}

	and(r, ea) {
		this.ccr = this.ccr & ~0x0e | fLogic[r &= this.readf(ea)];
		return r;
	}

	bit(r, ea) {
		this.ccr = this.ccr & ~0x0e | fLogic[r & this.readf(ea)];
	}

	ld(ea) {
		const r = this.readf(ea);
		this.ccr = this.ccr & ~0x0e | fLogic[r];
		return r;
	}

	st(r, ea) {
		this.ccr = this.ccr & ~0x0e | fLogic[this.write(ea, r)];
	}

	eor(r, ea) {
		this.ccr = this.ccr & ~0x0e | fLogic[r ^= this.readf(ea)];
		return r;
	}

	adc(r, ea) {
		r = aAdd[this.ccr & 1][this.readf(ea)][r];
		this.ccr = this.ccr & ~0x2f | r >>> 8;
		return r & 0xff;
	}

	or(r, ea) {
		this.ccr = this.ccr & ~0x0e | fLogic[r |= this.readf(ea)];
		return r;
	}

	add(r, ea) {
		r = aAdd[0][this.readf(ea)][r];
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

	readf(addr) {
		if (addr === null) {
//			data = !(page = this.memorymap[this.pc >>> 8]).fetch ? page.base[this.pc & 0xff] : page.fetch(this.pc, this.arg);
			const data = this.memorymap[this.pc >>> 8].base[this.pc & 0xff];
			this.pc = this.pc + 1 & 0x7ff;
			return data;
		}
		const page = this.memorymap[addr >>> 8];
		return !page.read ? page.base[addr & 0xff] : page.read(addr, this.arg);
	}
}

