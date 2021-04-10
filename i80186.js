/*
 *
 *	i80186 Emulator
 *
 */

import Cpu, {dummypage} from './cpu.js';

export default class I80186 extends Cpu {
	ax = 0;
	cx = 0;
	dx = 0;
	bx = 0;
	sp = 0;
	bp = 0;
	si = 0;
	di = 0;
	ip = 0;
	flags = 0; // ----odit sz-a-p-c
	cs = 0;
	ds = 0;
	ss = 0;
	es = 0;
	iomap = [];
	intmask = false;
	parity = new Int32Array(8);

	constructor() {
		super();
		this.memorymap.splice(0);
		for (let i = 0; i < 0x1000; i++)
			this.memorymap.push({base: dummypage, read: null, read16: null, write: () => {}, write16: null});
		this.breakpointmap = new Int32Array(0x8000);
		for (let i = 0; i < 0x100; i++)
			this.iomap.push({base: dummypage, read: null, write: () => {}});
		for (let i = 0; i < 256; i++) {
			let p = i ^ i >> 4;
			p ^= p >> 2;
			p ^= p >> 1;
			~p & 1 && (this.parity[i >> 5] |= 1 << (i & 31));
		}
	}

	set pc(val) {}

	get pc() {
		return (this.cs << 4) + this.ip & 0xfffff;
	}

	reset() {
		super.reset();
		this.flags = 0;
		this.cs = 0xffff;
		this.ds = 0;
		this.ss = 0;
		this.es = 0;
		this.sp = 0;
		this.ip = 0;
	}

	exception(intvec) {
		this.push(this.flags, this.cs, this.ip);
		this.flags = this.flags & ~0x300;
		[this.ip, this.cs] = [this.read16(0, intvec << 2), this.read16(0, intvec << 2 | 2)];
	}

	non_maskable_interrupt() {
		if (!super.interrupt() || this.intmask)
			return false;
		this.exception(2);
		return true;
	}

	interrupt(intvec) {
		if (!super.interrupt() || this.intmask || ~this.flags & 0x200)
			return false;
		this.exception(intvec);
		return true;
	}

	_execute() {
		let prefix = 0, sego = -1, rep = -1, op, v;

		this.intmask = false;
		for (;;)
			switch (this.fetch8()) {
			case 0x00: // ADD r/m8,r8
				return this.execute_00(sego);
			case 0x01: // ADD r/m16,r16
				return this.execute_01(sego);
			case 0x02: // ADD r8,r/m8
				return this.execute_02(sego);
			case 0x03: // ADD r16,r/m16
				return this.execute_03(sego);
			case 0x04: // ADD AL,imm8
				return void(this.ax = this.ax & 0xff00 | this.add8(this.ax, this.fetch8()));
			case 0x05: // ADD AX,imm16
				return void(this.ax = this.add16(this.ax, this.fetch16()));
			case 0x06: // PUSH ES
				return this.push(this.es);
			case 0x07: // POP ES
				return void(this.es = this.pop());
			case 0x08: // OR r/m8,r8
				return this.execute_08(sego);
			case 0x09: // OR r/m16,r16
				return this.execute_09(sego);
			case 0x0a: // OR r8,r/m8
				return this.execute_0a(sego);
			case 0x0b: // OR r16,r/m16
				return this.execute_0b(sego);
			case 0x0c: // OR AL,imm8
				return void(this.ax = this.ax & 0xff00 | this.or8(this.ax, this.fetch8()));
			case 0x0d: // OR AX,imm16
				return void(this.ax = this.or16(this.ax, this.fetch16()));
			case 0x0e: // PUSH CS
				return this.push(this.cs);
			case 0x10: // ADC r/m8,r8
				return this.execute_10(sego);
			case 0x11: // ADC r/m16,r16
				return this.execute_11(sego);
			case 0x12: // ADC r8,r/m8
				return this.execute_12(sego);
			case 0x13: // ADC r16,r/m16
				return this.execute_13(sego);
			case 0x14: // ADC AL,imm8
				return void(this.ax = this.ax & 0xff00 | this.adc8(this.ax, this.fetch8()));
			case 0x15: // ADC AX,imm16
				return void(this.ax = this.adc16(this.ax, this.fetch16()));
			case 0x16: // PUSH SS
				return this.push(this.ss);
			case 0x17: // POP SS
				this.intmask = true;
				return void(this.ss = this.pop());
			case 0x18: // SBB r/m8,r8
				return this.execute_18(sego);
			case 0x19: // SBB r/m16,r16
				return this.execute_19(sego);
			case 0x1a: // SBB r8,r/m8
				return this.execute_1a(sego);
			case 0x1b: // SBB r16,r/m16
				return this.execute_1b(sego);
			case 0x1c: // SBB AL,imm8
				return void(this.ax = this.ax & 0xff00 | this.sbb8(this.ax, this.fetch8()));
			case 0x1d: // SBB AX,imm16
				return void(this.ax = this.sbb16(this.ax, this.fetch16()));
			case 0x1e: // PUSH DS
				return this.push(this.ds);
			case 0x1f: // POP DS
				return void(this.ds = this.pop());
			case 0x20: // AND r/m8,r8
				return this.execute_20(sego);
			case 0x21: // AND r/m16,r16
				return this.execute_21(sego);
			case 0x22: // AND r8,r/m8
				return this.execute_22(sego);
			case 0x23: // AND r16,r/m16
				return this.execute_23(sego);
			case 0x24: // AND AL,imm8
				return void(this.ax = this.ax & 0xff00 | this.and8(this.ax, this.fetch8()));
			case 0x25: // AND AX,imm16
				return void(this.ax = this.and16(this.ax, this.fetch16()));
			case 0x26: // ES:
				sego = this.es;
				prefix++;
				break;
			case 0x27: // DAA
				return this.daa();
			case 0x28: // SUB r/m8,r8
				return this.execute_28(sego);
			case 0x29: // SUB r/m16,r16
				return this.execute_29(sego);
			case 0x2a: // SUB r8,r/m8
				return this.execute_2a(sego);
			case 0x2b: // SUB r16,r/m16
				return this.execute_2b(sego);
			case 0x2c: // SUB AL,imm8
				return void(this.ax = this.ax & 0xff00 | this.sub8(this.ax, this.fetch8()));
			case 0x2d: // SUB AX,imm16
				return void(this.ax = this.sub16(this.ax, this.fetch16()));
			case 0x2e: // CS:
				sego = this.cs;
				prefix++;
				break;
			case 0x2f: // DAS
				return this.das();
			case 0x30: // XOR r/m8,r8
				return this.execute_30(sego);
			case 0x31: // XOR r/m16,r16
				return this.execute_31(sego);
			case 0x32: // XOR r8,r/m8
				return this.execute_32(sego);
			case 0x33: // XOR r16,r/m16
				return this.execute_33(sego);
			case 0x34: // XOR AL,imm8
				return void(this.ax = this.ax & 0xff00 | this.xor8(this.ax, this.fetch8()));
			case 0x35: // XOR AX,imm16
				return void(this.ax = this.xor16(this.ax, this.fetch16()));
			case 0x36: // SS:
				sego = this.ss;
				prefix++;
				break;
			case 0x37: // AAA
				return this.aaa();
			case 0x38: // CMP r/m8,r8
				return this.execute_38(sego);
			case 0x39: // CMP r/m16,r16
				return this.execute_39(sego);
			case 0x3a: // CMP r8,r/m8
				return this.execute_3a(sego);
			case 0x3b: // CMP r16,r/m16
				return this.execute_3b(sego);
			case 0x3c: // CMP AL,imm8
				return this.sub8(this.ax, this.fetch8());
			case 0x3d: // CMP AX,imm16
				return this.sub16(this.ax, this.fetch16());
			case 0x3e: // DS:
				sego = this.ds;
				prefix++;
				break;
			case 0x3f: // AAS
				return this.aas();
			case 0x40: // INC AX
				return void(this.ax = this.inc16(this.ax));
			case 0x41: // INC CX
				return void(this.cx = this.inc16(this.cx));
			case 0x42: // INC DX
				return void(this.dx = this.inc16(this.dx));
			case 0x43: // INC BX
				return void(this.bx = this.inc16(this.bx));
			case 0x44: // INC SP
				return void(this.sp = this.inc16(this.sp));
			case 0x45: // INC BP
				return void(this.bp = this.inc16(this.bp));
			case 0x46: // INC SI
				return void(this.si = this.inc16(this.si));
			case 0x47: // INC DI
				return void(this.di = this.inc16(this.di));
			case 0x48: // DEC AX
				return void(this.ax = this.dec16(this.ax));
			case 0x49: // DEC CX
				return void(this.cx = this.dec16(this.cx));
			case 0x4a: // DEC DX
				return void(this.dx = this.dec16(this.dx));
			case 0x4b: // DEC BX
				return void(this.bx = this.dec16(this.bx));
			case 0x4c: // DEC SP
				return void(this.sp = this.dec16(this.sp));
			case 0x4d: // DEC BP
				return void(this.bp = this.dec16(this.bp));
			case 0x4e: // DEC SI
				return void(this.si = this.dec16(this.si));
			case 0x4f: // DEC DI
				return void(this.di = this.dec16(this.di));
			case 0x50: // PUSH AX
				return this.push(this.ax);
			case 0x51: // PUSH CX
				return this.push(this.cx);
			case 0x52: // PUSH DX
				return this.push(this.dx);
			case 0x53: // PUSH BX
				return this.push(this.bx);
			case 0x54: // PUSH SP
				return this.push(this.sp);
			case 0x55: // PUSH BP
				return this.push(this.bp);
			case 0x56: // PUSH SI
				return this.push(this.si);
			case 0x57: // PUSH DI
				return this.push(this.di);
			case 0x58: // POP AX
				return void(this.ax = this.pop());
			case 0x59: // POP CX
				return void(this.cx = this.pop());
			case 0x5a: // POP DX
				return void(this.dx = this.pop());
			case 0x5b: // POP BX
				return void(this.bx = this.pop());
			case 0x5c: // POP SP
				return void(this.sp = this.pop());
			case 0x5d: // POP BP
				return void(this.bp = this.pop());
			case 0x5e: // POP SI
				return void(this.si = this.pop());
			case 0x5f: // POP DI
				return void(this.di = this.pop());
			case 0x60: // PUSHA
				return this.push(this.ax, this.cx, this.dx, this.bx, this.sp, this.bp, this.si, this.di);
			case 0x61: // POPA
				return void([this.di, this.si, this.bp,, this.bx, this.dx, this.cx, this.ax] = this.pop(8));
			case 0x62: // BOUND r16,m16&16
				return this.execute_62(sego);
			case 0x68: // PUSH imm16
				return this.push(this.fetch16());
			case 0x69: // IMUL r16,r/m16,imm16
				return this.execute_69(sego);
			case 0x6a: // PUSH imm8
				return this.push(this.fetch8s());
			case 0x6b: // IMUL r16,r/m16,imm8
				return this.execute_6b(sego);
			case 0x6c: // INSB
				this.write8(this.es, this.di, this.ioread8(this.dx));
				this.di = this.di - (this.flags >>> 9 & 2) + 1 & 0xffff;
				return void(rep !== -1 && (this.cx = this.cx - 1 & 0xffff) && (this.ip = this.ip - prefix - 1 & 0xffff));
			case 0x6d: // INSW
				this.write16(this.es, this.di, this.ioread16(this.dx));
				this.di = this.di - (this.flags >>> 8 & 4) + 2 & 0xffff;
				return void(rep !== -1 && (this.cx = this.cx - 1 & 0xffff) && (this.ip = this.ip - prefix - 1 & 0xffff));
			case 0x6e: // OUTSB
				this.iowrite8(this.dx, this.read8(sego >= 0 ? sego : this.ds, this.si));
				this.si = this.si - (this.flags >>> 9 & 2) + 1 & 0xffff;
				return void(rep !== -1 && (this.cx = this.cx - 1 & 0xffff) && (this.ip = this.ip - prefix - 1 & 0xffff));
			case 0x6f: // OUTSW
				this.iowrite16(this.dx, this.read16(sego >= 0 ? sego : this.ds, this.si));
				this.si = this.si - (this.flags >>> 8 & 4) + 2 & 0xffff;
				return void(rep !== -1 && (this.cx = this.cx - 1 & 0xffff) && (this.ip = this.ip - prefix - 1 & 0xffff));
			case 0x70: // JO rel8
				return this.jcc((this.flags & 0x800) !== 0);
			case 0x71: // JNO rel8
				return this.jcc(!(this.flags & 0x800));
			case 0x72: // JB/JNAE/JC rel8
				return this.jcc((this.flags & 1) !== 0);
			case 0x73: // JNB/JAE/JNC rel8
				return this.jcc(!(this.flags & 1));
			case 0x74: // JE/JZ rel8
				return this.jcc((this.flags & 0x40) !== 0);
			case 0x75: // JNE/JNZ rel8
				return this.jcc(!(this.flags & 0x40));
			case 0x76: // JBE/JNA rel8
				return this.jcc(((this.flags >>> 6 | this.flags) & 1) !== 0);
			case 0x77: // JNBE/JA rel8
				return this.jcc(!((this.flags >>> 6 | this.flags) & 1));
			case 0x78: // JS rel8
				return this.jcc((this.flags & 0x80) !== 0);
			case 0x79: // JNS rel8
				return this.jcc(!(this.flags & 0x80));
			case 0x7a: // JP/JPE rel8
				return this.jcc((this.flags & 4) !== 0);
			case 0x7b: // JNP/JPO rel8
				return this.jcc(!(this.flags & 4));
			case 0x7c: // JL/JNGE rel8
				return this.jcc(((this.flags ^ this.flags << 4) & 0x800) !== 0);
			case 0x7d: // JNL/JGE rel8
				return this.jcc(!((this.flags ^ this.flags << 4) & 0x800));
			case 0x7e: // JLE/JNG rel8
				return this.jcc(((this.flags ^ this.flags << 4 | this.flags << 5) & 0x800) !== 0);
			case 0x7f: // JNLE/JG rel8
				return this.jcc(!((this.flags ^ this.flags << 4 | this.flags << 5) & 0x800));
			case 0x80:
				return this.execute_80(sego);
			case 0x81:
				return this.execute_81(sego);
			case 0x82:
				return this.execute_82(sego);
			case 0x83:
				return this.execute_83(sego);
			case 0x84: // TEST r8,r/m8
				return this.execute_84(sego);
			case 0x85: // TEST r16,r/m16
				return this.execute_85(sego);
			case 0x86: // XCHG r8,r/m8
				return this.execute_86(sego);
			case 0x87: // XCHG r16,r/m16
				return this.execute_87(sego);
			case 0x88: // MOV r/m8,r8
				return this.execute_88(sego);
			case 0x89: // MOV r/m16,r16
				return this.execute_89(sego);
			case 0x8a: // MOV r8,r/m8
				return this.execute_8a(sego);
			case 0x8b: // MOV r16,r/m16
				return this.execute_8b(sego);
			case 0x8c: // MOV r/m16,sreg
				return this.execute_8c(sego);
			case 0x8d: // LEA r16,m16
				return this.execute_8d();
			case 0x8e: // MOV sreg,r/m16
				return this.execute_8e(sego);
			case 0x8f: // POP r/m16
				if (!((op = this.fetch8()) >>> 3 & 7))
					return this.wop8(op, sego, this.pop());
				return this.exception(6);
			case 0x90: // XCHG AX,AX/NOP
				return;
			case 0x91: // XCHG AX,CX
				return void([this.ax, this.cx] = [this.cx, this.ax]);
			case 0x92: // XCHG AX,DX
				return void([this.ax, this.dx] = [this.dx, this.ax]);
			case 0x93: // XCHG AX,BX
				return void([this.ax, this.bx] = [this.bx, this.ax]);
			case 0x94: // XCHG AX,SP
				return void([this.ax, this.sp] = [this.sp, this.ax]);
			case 0x95: // XCHG AX,BP
				return void([this.ax, this.bp] = [this.bp, this.ax]);
			case 0x96: // XCHG AX,SI
				return void([this.ax, this.si] = [this.si, this.ax]);
			case 0x97: // XCHG AX,DI
				return void([this.ax, this.di] = [this.di, this.ax]);
			case 0x98: // CBW
				return void(this.ax = (this.ax & 0xff) - (this.ax << 1 & 0x100) & 0xffff);
			case 0x99: // CWD
				return void(this.dx = this.sub16(0, this.ax >>> 15));
			case 0x9a: // CALL ptr16:16
				return this.call32(this.fetch16(), this.fetch16());
			case 0x9b: // WAIT
				return this.exception(7);
			case 0x9c: // PUSHF
				return this.write16(this.ss, this.sp = this.sp - 2 & 0xffff, this.flags);
			case 0x9d: // POPF
				return void(this.flags = this.pop());
			case 0x9e: // SAHF
				return void(this.flags = this.flags & 0xff00 | this.ax >>> 8);
			case 0x9f: // LAHF
				return void(this.ax = this.ax & 0xff | this.flags << 8 & 0xff00);
			case 0xa0: // MOV AL,m8
				return void(this.ax = this.ax & 0xff00 | this.read8(sego >= 0 ? sego : this.ds, this.fetch16()));
			case 0xa1: // MOV AX,m16
				return void(this.ax = this.read16(sego >= 0 ? sego : this.ds, this.fetch16()));
			case 0xa2: // MOV m8,AL
				return this.write8(sego >= 0 ? sego : this.ds, this.fetch16(), this.ax);
			case 0xa3: // MOV m16,AX
				return this.write16(sego >= 0 ? sego : this.ds, this.fetch16(), this.ax);
			case 0xa4: // MOVSB
				this.write8(this.es, this.di, this.read8(sego >= 0 ? sego : this.ds, this.si));
				[this.si, this.di] = [this.si - (this.flags >>> 9 & 2) + 1 & 0xffff, this.di - (this.flags >>> 9 & 2) + 1 & 0xffff];
				return void(rep !== -1 && (this.cx = this.cx - 1 & 0xffff) && (this.ip = this.ip - prefix - 1 & 0xffff));
			case 0xa5: // MOVSW
				this.write16(this.es, this.di, this.read16(sego >= 0 ? sego : this.ds, this.si));
				[this.si, this.di] = [this.si - (this.flags >>> 8 & 4) + 2 & 0xffff, this.di - (this.flags >>> 8 & 4) + 2 & 0xffff];
				return void(rep !== -1 && (this.cx = this.cx - 1 & 0xffff) && (this.ip = this.ip - prefix - 1 & 0xffff));
			case 0xa6: // CMPSB
				this.sub8(this.read8(sego >= 0 ? sego : this.ds, this.si), this.read8(this.es, this.di));
				[this.si, this.di] = [this.si - (this.flags >>> 9 & 2) + 1 & 0xffff, this.di - (this.flags >>> 9 & 2) + 1 & 0xffff];
				return void(rep !== -1 && (this.cx = this.cx - 1 & 0xffff) && ~(rep ^ this.flags >>> 6) & 1 && (this.ip = this.ip - prefix - 1 & 0xffff));
			case 0xa7: // CMPSW
				this.sub16(this.read16(sego >= 0 ? sego : this.ds, this.si), this.read16(this.es, this.di));
				[this.si, this.di] = [this.si - (this.flags >>> 8 & 4) + 2 & 0xffff, this.di - (this.flags >>> 8 & 4) + 2 & 0xffff];
				return void(rep !== -1 && (this.cx = this.cx - 1 & 0xffff) && ~(rep ^ this.flags >>> 6) & 1 && (this.ip = this.ip - prefix - 1 & 0xffff));
			case 0xa8: // TEST AL,imm8
				return this.and8(this.ax, this.fetch8());
			case 0xa9: // TEST AX,imm16
				return this.and16(this.ax, this.fetch16());
			case 0xaa: // STOSB
				this.write8(this.es, this.di, this.ax);
				this.di = this.di - (this.flags >>> 9 & 2) + 1 & 0xffff;
				return void(rep !== -1 && (this.cx = this.cx - 1 & 0xffff) && (this.ip = this.ip - prefix - 1 & 0xffff));
			case 0xab: // STOSW
				this.write16(this.es, this.di, this.ax);
				this.di = this.di - (this.flags >>> 8 & 4) + 2 & 0xffff;
				return void(rep !== -1 && (this.cx = this.cx - 1 & 0xffff) && (this.ip = this.ip - prefix - 1 & 0xffff));
			case 0xac: // LODSB
				[this.ax, this.si] = [this.ax & 0xff00 | this.read8(sego >= 0 ? sego : this.ds, this.si), this.si - (this.flags >>> 9 & 2) + 1 & 0xffff];
				return void(rep !== -1 && (this.cx = this.cx - 1 & 0xffff) && (this.ip = this.ip - prefix - 1 & 0xffff));
			case 0xad: // LODSW
				[this.ax, this.si] = [this.read16(sego >= 0 ? sego : this.ds, this.si), this.si - (this.flags >>> 8 & 4) + 2 & 0xffff];
				return void(rep !== -1 && (this.cx = this.cx - 1 & 0xffff) && (this.ip = this.ip - prefix - 1 & 0xffff));
			case 0xae: // SCASB
				this.sub8(this.ax, this.read8(this.es, this.di));
				this.di = this.di - (this.flags >>> 9 & 2) + 1 & 0xffff;
				return void(rep !== -1 && (this.cx = this.cx - 1 & 0xffff) && ~(rep ^ this.flags >>> 6) & 1 && (this.ip = this.ip - prefix - 1 & 0xffff));
			case 0xaf: // SCASW
				this.sub16(this.ax, this.read16(this.es, this.di));
				this.di = this.di - (this.flags >>> 8 & 4) + 2 & 0xffff;
				return void(rep !== -1 && (this.cx = this.cx - 1 & 0xffff) && ~(rep ^ this.flags >>> 6) & 1 && (this.ip = this.ip - prefix - 1 & 0xffff));
			case 0xb0: // MOV AL,imm8
				return void(this.ax = this.ax & 0xff00 | this.fetch8());
			case 0xb1: // MOV CL,imm8
				return void(this.cx = this.cx & 0xff00 | this.fetch8());
			case 0xb2: // MOV DL,imm8
				return void(this.dx = this.dx & 0xff00 | this.fetch8());
			case 0xb3: // MOV BL,imm8
				return void(this.bx = this.bx & 0xff00 | this.fetch8());
			case 0xb4: // MOV AH,imm8
				return void(this.ax = this.ax & 0xff | this.fetch8() << 8);
			case 0xb5: // MOV CH,imm8
				return void(this.cx = this.cx & 0xff | this.fetch8() << 8);
			case 0xb6: // MOV DH,imm8
				return void(this.dx = this.dx & 0xff | this.fetch8() << 8);
			case 0xb7: // MOV BH,imm8
				return void(this.bx = this.bx & 0xff | this.fetch8() << 8);
			case 0xb8: // MOV AX,imm16
				return void(this.ax = this.fetch16());
			case 0xb9: // MOV CX,imm16
				return void(this.cx = this.fetch16());
			case 0xba: // MOV DX,imm16
				return void(this.dx = this.fetch16());
			case 0xbb: // MOV BX,imm16
				return void(this.bx = this.fetch16());
			case 0xbc: // MOV SP,imm16
				return void(this.sp = this.fetch16());
			case 0xbd: // MOV BP,imm16
				return void(this.bp = this.fetch16());
			case 0xbe: // MOV SI,imm16
				return void(this.si = this.fetch16());
			case 0xbf: // MOV DI,imm16
				return void(this.di = this.fetch16());
			case 0xc0:
				return this.execute_c0(sego);
			case 0xc1:
				return this.execute_c1(sego);
			case 0xc2: // RET imm16
				[this.ip, v] = [this.pop(), this.fetch16()];
				return void(this.sp = this.sp + v & 0xffff);
			case 0xc3: // RET
				return void(this.ip = this.pop());
			case 0xc4: // LES r16,m16:16
				return this.execute_c4(sego);
			case 0xc5: // LDS r16,m16:16
				return this.execute_c5(sego);
			case 0xc6: // MOV r/m8,imm8
				if (!((op = this.fetch8()) >>> 3 & 7))
					return this.wop8i(op, sego);
				return this.exception(6);
			case 0xc7: // MOV r/m16,imm16
				if (!((op = this.fetch8()) >>> 3 & 7))
					return this.wop16i(op, sego);
				return this.exception(6);
			case 0xc8: // ENTER
				return this.enter();
			case 0xc9: // LEAVE
				this.sp = this.bp;
				return void(this.bp = this.pop());
			case 0xca: // RETF imm16
				[this.ip, this.cs, v] = [...this.pop(2), this.fetch16()];
				return void(this.sp = this.sp + v & 0xffff);
			case 0xcb: // RETF
				return void([this.ip, this.cs] = this.pop(2));
			case 0xcc: // INT 3
				return this.exception(3);
			case 0xcd: // INT imm8
				return this.exception(this.fetch8());
			case 0xce: // INTO
				return void(this.flags & 0x800 && this.exception(4));
			case 0xcf: // IRET
				return void([this.ip, this.cs, this.flags] = this.pop(3));
			case 0xd0:
				return this.execute_d0(sego);
			case 0xd1:
				return this.execute_d1(sego);
			case 0xd2:
				return this.execute_d2(sego);
			case 0xd3:
				return this.execute_d3(sego);
			case 0xd4: // AAM
				return this.aam(this.fetch8());
			case 0xd5: // AAD
				return this.aad(this.fetch8());
			case 0xd7: // XLAT
				return void(this.ax = this.ax & 0xff00 | this.read8(sego >= 0 ? sego : this.ds, this.bx + (this.ax & 0xff)));
			case 0xd8: // ESC 0
			case 0xd9: // ESC 1
			case 0xda: // ESC 2
			case 0xdb: // ESC 3
			case 0xdc: // ESC 4
			case 0xdd: // ESC 5
			case 0xde: // ESC 6
			case 0xdf: // ESC 7
				return this.exception(7);
			case 0xe0: // LOOPNE/LOOPNZ rel8
				return this.jcc((this.cx = this.cx - 1 & 0xffff) && ~this.flags & 0x40);
			case 0xe1: // LOOPE/LOOPZ rel8
				return this.jcc((this.cx = this.cx - 1 & 0xffff) && this.flags & 0x40);
			case 0xe2: // LOOP rel8
				return this.jcc((this.cx = this.cx - 1 & 0xffff) !== 0);
			case 0xe3: // JCXZ rel8
				return this.jcc(!this.cx);
			case 0xe4: // IN AL,imm8
				return void(this.ax = this.ax & 0xff00 | this.ioread8(this.fetch8()));
			case 0xe5: // IN AX,imm8
				return void(this.ax = this.ioread16(this.fetch8()));
			case 0xe6: // OUT AL,imm8
				return this.iowrite8(this.fetch8(), this.ax & 0xff);
			case 0xe7: // OUT AX,imm8
				return this.iowrite16(this.fetch8(), this.ax);
			case 0xe8: // CALL rel16
				return this.call16();
			case 0xe9: // JMP rel16
				return this.jmp16();
			case 0xea: // JMP ptr16:16
				return void([this.ip, this.cs] = [this.fetch16(), this.fetch16()]);
			case 0xeb: // JMP rel8
				return this.jcc(true);
			case 0xec: // IN AL,DX
				return void(this.ax = this.ax & 0xff00 | this.ioread8(this.dx));
			case 0xed: // IN AX,DX
				return void(this.ax = this.ioread16(this.dx));
			case 0xee: // OUT AL,DX
				return this.iowrite8(this.dx, this.ax & 0xff);
			case 0xef: // OUT AX,DX
				return this.iowrite16(this.dx, this.ax);
			case 0xf0: // LOCK
				prefix++;
				break;
			case 0xf2: // REPNE/REPNZ
				rep = 0xf2;
				prefix++;
				break;
			case 0xf3: // REP/REPE/REPZ
				rep = 0xf3;
				prefix++;
				break;
			case 0xf4: // HLT
				return this.suspend();
			case 0xf5: // CMC
				return void(this.flags ^= 1);
			case 0xf6:
				return this.execute_f6(sego);
			case 0xf7:
				return this.execute_f7(sego);
			case 0xf8: // CLC
				return void(this.flags &= ~1);
			case 0xf9: // STC
				return void(this.flags |= 1);
			case 0xfa: // CLI
				return void(this.flags &= ~0x200);
			case 0xfb: // STI
				return void(this.flags |= 0x200);
			case 0xfc: // CLD
				return void(this.flags &= ~0x400);
			case 0xfd: // STD
				return void(this.flags |= 0x400);
			case 0xfe:
				return this.execute_fe(sego);
			case 0xff:
				return this.execute_ff(sego);
			default:
				return this.exception(6);
			}
	}

	execute_00(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // ADD r/m8,AL
			return this.rwop8(op, sego, this.add8, this.ax);
		case 1: // ADD r/m8,CL
			return this.rwop8(op, sego, this.add8, this.cx);
		case 2: // ADD r/m8,DL
			return this.rwop8(op, sego, this.add8, this.dx);
		case 3: // ADD r/m8,BL
			return this.rwop8(op, sego, this.add8, this.bx);
		case 4: // ADD r/m8,AH
			return this.rwop8(op, sego, this.add8, this.ax >>> 8);
		case 5: // ADD r/m8,CH
			return this.rwop8(op, sego, this.add8, this.cx >>> 8);
		case 6: // ADD r/m8,DH
			return this.rwop8(op, sego, this.add8, this.dx >>> 8);
		case 7: // ADD r/m8,BH
			return this.rwop8(op, sego, this.add8, this.bx >>> 8);
		}
	}

	execute_01(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // ADD r/m16,AX
			return this.rwop16(op, sego, this.add16, this.ax);
		case 1: // ADD r/m16,CX
			return this.rwop16(op, sego, this.add16, this.cx);
		case 2: // ADD r/m16,DX
			return this.rwop16(op, sego, this.add16, this.dx);
		case 3: // ADD r/m16,BX
			return this.rwop16(op, sego, this.add16, this.bx);
		case 4: // ADD r/m16,SP
			return this.rwop16(op, sego, this.add16, this.sp);
		case 5: // ADD r/m16,BP
			return this.rwop16(op, sego, this.add16, this.bp);
		case 6: // ADD r/m16,SI
			return this.rwop16(op, sego, this.add16, this.si);
		case 7: // ADD r/m16,DI
			return this.rwop16(op, sego, this.add16, this.di);
		}
	}

	execute_02(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // ADD AL,r/m8
			return void(this.ax = this.ax & 0xff00 | this.add8(this.ax, this.rop8(op, sego)));
		case 1: // ADD CL,r/m8
			return void(this.cx = this.cx & 0xff00 | this.add8(this.cx, this.rop8(op, sego)));
		case 2: // ADD DL,r/m8
			return void(this.dx = this.dx & 0xff00 | this.add8(this.dx, this.rop8(op, sego)));
		case 3: // ADD BL,r/m8
			return void(this.bx = this.bx & 0xff00 | this.add8(this.bx, this.rop8(op, sego)));
		case 4: // ADD AH,r/m8
			return void(this.ax = this.ax & 0xff | this.add8(this.ax >>> 8, this.rop8(op, sego)) << 8);
		case 5: // ADD CH,r/m8
			return void(this.cx = this.cx & 0xff | this.add8(this.cx >>> 8, this.rop8(op, sego)) << 8);
		case 6: // ADD DH,r/m8
			return void(this.dx = this.dx & 0xff | this.add8(this.dx >>> 8, this.rop8(op, sego)) << 8);
		case 7: // ADD BH,r/m8
			return void(this.bx = this.bx & 0xff | this.add8(this.bx >>> 8, this.rop8(op, sego)) << 8);
		}
	}

	execute_03(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // ADD AX,r/m16
			return void(this.ax = this.add16(this.ax, this.rop16(op, sego)));
		case 1: // ADD CX,r/m16
			return void(this.cx = this.add16(this.cx, this.rop16(op, sego)));
		case 2: // ADD DX,r/m16
			return void(this.dx = this.add16(this.dx, this.rop16(op, sego)));
		case 3: // ADD BX,r/m16
			return void(this.bx = this.add16(this.bx, this.rop16(op, sego)));
		case 4: // ADD SP,r/m16
			return void(this.sp = this.add16(this.sp, this.rop16(op, sego)));
		case 5: // ADD BP,r/m16
			return void(this.bp = this.add16(this.bp, this.rop16(op, sego)));
		case 6: // ADD SI,r/m16
			return void(this.si = this.add16(this.si, this.rop16(op, sego)));
		case 7: // ADD DI,r/m16
			return void(this.di = this.add16(this.di, this.rop16(op, sego)));
		}
	}

	execute_08(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // OR r/m8,AL
			return this.rwop8(op, sego, this.or8, this.ax);
		case 1: // OR r/m8,CL
			return this.rwop8(op, sego, this.or8, this.cx);
		case 2: // OR r/m8,DL
			return this.rwop8(op, sego, this.or8, this.dx);
		case 3: // OR r/m8,BL
			return this.rwop8(op, sego, this.or8, this.bx);
		case 4: // OR r/m8,AH
			return this.rwop8(op, sego, this.or8, this.ax >>> 8);
		case 5: // OR r/m8,CH
			return this.rwop8(op, sego, this.or8, this.cx >>> 8);
		case 6: // OR r/m8,DH
			return this.rwop8(op, sego, this.or8, this.dx >>> 8);
		case 7: // OR r/m8,BH
			return this.rwop8(op, sego, this.or8, this.bx >>> 8);
		}
	}

	execute_09(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // OR r/m16,AX
			return this.rwop16(op, sego, this.or16, this.ax);
		case 1: // OR r/m16,CX
			return this.rwop16(op, sego, this.or16, this.cx);
		case 2: // OR r/m16,DX
			return this.rwop16(op, sego, this.or16, this.dx);
		case 3: // OR r/m16,BX
			return this.rwop16(op, sego, this.or16, this.bx);
		case 4: // OR r/m16,SP
			return this.rwop16(op, sego, this.or16, this.sp);
		case 5: // OR r/m16,BP
			return this.rwop16(op, sego, this.or16, this.bp);
		case 6: // OR r/m16,SI
			return this.rwop16(op, sego, this.or16, this.si);
		case 7: // OR r/m16,DI
			return this.rwop16(op, sego, this.or16, this.di);
		}
	}

	execute_0a(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // OR AL,r/m8
			return void(this.ax = this.ax & 0xff00 | this.or8(this.ax, this.rop8(op, sego)));
		case 1: // OR CL,r/m8
			return void(this.cx = this.cx & 0xff00 | this.or8(this.cx, this.rop8(op, sego)));
		case 2: // OR DL,r/m8
			return void(this.dx = this.dx & 0xff00 | this.or8(this.dx, this.rop8(op, sego)));
		case 3: // OR BL,r/m8
			return void(this.bx = this.bx & 0xff00 | this.or8(this.bx, this.rop8(op, sego)));
		case 4: // OR AH,r/m8
			return void(this.ax = this.ax & 0xff | this.or8(this.ax >>> 8, this.rop8(op, sego)) << 8);
		case 5: // OR CH,r/m8
			return void(this.cx = this.cx & 0xff | this.or8(this.cx >>> 8, this.rop8(op, sego)) << 8);
		case 6: // OR DH,r/m8
			return void(this.dx = this.dx & 0xff | this.or8(this.dx >>> 8, this.rop8(op, sego)) << 8);
		case 7: // OR BH,r/m8
			return void(this.bx = this.bx & 0xff | this.or8(this.bx >>> 8, this.rop8(op, sego)) << 8);
		}
	}

	execute_0b(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // OR AX,r/m16
			return void(this.ax = this.or16(this.ax, this.rop16(op, sego)));
		case 1: // OR CX,r/m16
			return void(this.cx = this.or16(this.cx, this.rop16(op, sego)));
		case 2: // OR DX,r/m16
			return void(this.dx = this.or16(this.dx, this.rop16(op, sego)));
		case 3: // OR BX,r/m16
			return void(this.bx = this.or16(this.bx, this.rop16(op, sego)));
		case 4: // OR SP,r/m16
			return void(this.sp = this.or16(this.sp, this.rop16(op, sego)));
		case 5: // OR BP,r/m16
			return void(this.bp = this.or16(this.bp, this.rop16(op, sego)));
		case 6: // OR SI,r/m16
			return void(this.si = this.or16(this.si, this.rop16(op, sego)));
		case 7: // OR DI,r/m16
			return void(this.di = this.or16(this.di, this.rop16(op, sego)));
		}
	}

	execute_10(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // ADC r/m8,AL
			return this.rwop8(op, sego, this.adc8, this.ax);
		case 1: // ADC r/m8,CL
			return this.rwop8(op, sego, this.adc8, this.cx);
		case 2: // ADC r/m8,DL
			return this.rwop8(op, sego, this.adc8, this.dx);
		case 3: // ADC r/m8,BL
			return this.rwop8(op, sego, this.adc8, this.bx);
		case 4: // ADC r/m8,AH
			return this.rwop8(op, sego, this.adc8, this.ax >>> 8);
		case 5: // ADC r/m8,CH
			return this.rwop8(op, sego, this.adc8, this.cx >>> 8);
		case 6: // ADC r/m8,DH
			return this.rwop8(op, sego, this.adc8, this.dx >>> 8);
		case 7: // ADC r/m8,BH
			return this.rwop8(op, sego, this.adc8, this.bx >>> 8);
		}
	}

	execute_11(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // ADC r/m16,AX
			return this.rwop16(op, sego, this.adc16, this.ax);
		case 1: // ADC r/m16,CX
			return this.rwop16(op, sego, this.adc16, this.cx);
		case 2: // ADC r/m16,DX
			return this.rwop16(op, sego, this.adc16, this.dx);
		case 3: // ADC r/m16,BX
			return this.rwop16(op, sego, this.adc16, this.bx);
		case 4: // ADC r/m16,SP
			return this.rwop16(op, sego, this.adc16, this.sp);
		case 5: // ADC r/m16,BP
			return this.rwop16(op, sego, this.adc16, this.bp);
		case 6: // ADC r/m16,SI
			return this.rwop16(op, sego, this.adc16, this.si);
		case 7: // ADC r/m16,DI
			return this.rwop16(op, sego, this.adc16, this.di);
		}
	}

	execute_12(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // ADC AL,r/m8
			return void(this.ax = this.ax & 0xff00 | this.adc8(this.ax, this.rop8(op, sego)));
		case 1: // ADC CL,r/m8
			return void(this.cx = this.cx & 0xff00 | this.adc8(this.cx, this.rop8(op, sego)));
		case 2: // ADC DL,r/m8
			return void(this.dx = this.dx & 0xff00 | this.adc8(this.dx, this.rop8(op, sego)));
		case 3: // ADC BL,r/m8
			return void(this.bx = this.bx & 0xff00 | this.adc8(this.bx, this.rop8(op, sego)));
		case 4: // ADC AH,r/m8
			return void(this.ax = this.ax & 0xff | this.adc8(this.ax >>> 8, this.rop8(op, sego)) << 8);
		case 5: // ADC CH,r/m8
			return void(this.cx = this.cx & 0xff | this.adc8(this.cx >>> 8, this.rop8(op, sego)) << 8);
		case 6: // ADC DH,r/m8
			return void(this.dx = this.dx & 0xff | this.adc8(this.dx >>> 8, this.rop8(op, sego)) << 8);
		case 7: // ADC BH,r/m8
			return void(this.bx = this.bx & 0xff | this.adc8(this.bx >>> 8, this.rop8(op, sego)) << 8);
		}
	}

	execute_13(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // ADC AX,r/m16
			return void(this.ax = this.adc16(this.ax, this.rop16(op, sego)));
		case 1: // ADC CX,r/m16
			return void(this.cx = this.adc16(this.cx, this.rop16(op, sego)));
		case 2: // ADC DX,r/m16
			return void(this.dx = this.adc16(this.dx, this.rop16(op, sego)));
		case 3: // ADC BX,r/m16
			return void(this.bx = this.adc16(this.bx, this.rop16(op, sego)));
		case 4: // ADC SP,r/m16
			return void(this.sp = this.adc16(this.sp, this.rop16(op, sego)));
		case 5: // ADC BP,r/m16
			return void(this.bp = this.adc16(this.bp, this.rop16(op, sego)));
		case 6: // ADC SI,r/m16
			return void(this.si = this.adc16(this.si, this.rop16(op, sego)));
		case 7: // ADC DI,r/m16
			return void(this.di = this.adc16(this.di, this.rop16(op, sego)));
		}
	}

	execute_18(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // SBB r/m8,AL
			return this.rwop8(op, sego, this.sbb8, this.ax);
		case 1: // SBB r/m8,CL
			return this.rwop8(op, sego, this.sbb8, this.cx);
		case 2: // SBB r/m8,DL
			return this.rwop8(op, sego, this.sbb8, this.dx);
		case 3: // SBB r/m8,BL
			return this.rwop8(op, sego, this.sbb8, this.bx);
		case 4: // SBB r/m8,AH
			return this.rwop8(op, sego, this.sbb8, this.ax >>> 8);
		case 5: // SBB r/m8,CH
			return this.rwop8(op, sego, this.sbb8, this.cx >>> 8);
		case 6: // SBB r/m8,DH
			return this.rwop8(op, sego, this.sbb8, this.dx >>> 8);
		case 7: // SBB r/m8,BH
			return this.rwop8(op, sego, this.sbb8, this.bx >>> 8);
		}
	}

	execute_19(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // SBB r/m16,AX
			return this.rwop16(op, sego, this.sbb16, this.ax);
		case 1: // SBB r/m16,CX
			return this.rwop16(op, sego, this.sbb16, this.cx);
		case 2: // SBB r/m16,DX
			return this.rwop16(op, sego, this.sbb16, this.dx);
		case 3: // SBB r/m16,BX
			return this.rwop16(op, sego, this.sbb16, this.bx);
		case 4: // SBB r/m16,SP
			return this.rwop16(op, sego, this.sbb16, this.sp);
		case 5: // SBB r/m16,BP
			return this.rwop16(op, sego, this.sbb16, this.bp);
		case 6: // SBB r/m16,SI
			return this.rwop16(op, sego, this.sbb16, this.si);
		case 7: // SBB r/m16,DI
			return this.rwop16(op, sego, this.sbb16, this.di);
		}
	}

	execute_1a(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // SBB AL,r/m8
			return void(this.ax = this.ax & 0xff00 | this.sbb8(this.ax, this.rop8(op, sego)));
		case 1: // SBB CL,r/m8
			return void(this.cx = this.cx & 0xff00 | this.sbb8(this.cx, this.rop8(op, sego)));
		case 2: // SBB DL,r/m8
			return void(this.dx = this.dx & 0xff00 | this.sbb8(this.dx, this.rop8(op, sego)));
		case 3: // SBB BL,r/m8
			return void(this.bx = this.bx & 0xff00 | this.sbb8(this.bx, this.rop8(op, sego)));
		case 4: // SBB AH,r/m8
			return void(this.ax = this.ax & 0xff | this.sbb8(this.ax >>> 8, this.rop8(op, sego)) << 8);
		case 5: // SBB CH,r/m8
			return void(this.cx = this.cx & 0xff | this.sbb8(this.cx >>> 8, this.rop8(op, sego)) << 8);
		case 6: // SBB DH,r/m8
			return void(this.dx = this.dx & 0xff | this.sbb8(this.dx >>> 8, this.rop8(op, sego)) << 8);
		case 7: // SBB BH,r/m8
			return void(this.bx = this.bx & 0xff | this.sbb8(this.bx >>> 8, this.rop8(op, sego)) << 8);
		}
	}

	execute_1b(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // SBB AX,r/m16
			return void(this.ax = this.sbb16(this.ax, this.rop16(op, sego)));
		case 1: // SBB CX,r/m16
			return void(this.cx = this.sbb16(this.cx, this.rop16(op, sego)));
		case 2: // SBB DX,r/m16
			return void(this.dx = this.sbb16(this.dx, this.rop16(op, sego)));
		case 3: // SBB BX,r/m16
			return void(this.bx = this.sbb16(this.bx, this.rop16(op, sego)));
		case 4: // SBB SP,r/m16
			return void(this.sp = this.sbb16(this.sp, this.rop16(op, sego)));
		case 5: // SBB BP,r/m16
			return void(this.bp = this.sbb16(this.bp, this.rop16(op, sego)));
		case 6: // SBB SI,r/m16
			return void(this.si = this.sbb16(this.si, this.rop16(op, sego)));
		case 7: // SBB DI,r/m16
			return void(this.di = this.sbb16(this.di, this.rop16(op, sego)));
		}
	}

	execute_20(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // AND r/m8,AL
			return this.rwop8(op, sego, this.and8, this.ax);
		case 1: // AND r/m8,CL
			return this.rwop8(op, sego, this.and8, this.cx);
		case 2: // AND r/m8,DL
			return this.rwop8(op, sego, this.and8, this.dx);
		case 3: // AND r/m8,BL
			return this.rwop8(op, sego, this.and8, this.bx);
		case 4: // AND r/m8,AH
			return this.rwop8(op, sego, this.and8, this.ax >>> 8);
		case 5: // AND r/m8,CH
			return this.rwop8(op, sego, this.and8, this.cx >>> 8);
		case 6: // AND r/m8,DH
			return this.rwop8(op, sego, this.and8, this.dx >>> 8);
		case 7: // AND r/m8,BH
			return this.rwop8(op, sego, this.and8, this.bx >>> 8);
		}
	}

	execute_21(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // AND r/m16,AX
			return this.rwop16(op, sego, this.and16, this.ax);
		case 1: // AND r/m16,CX
			return this.rwop16(op, sego, this.and16, this.cx);
		case 2: // AND r/m16,DX
			return this.rwop16(op, sego, this.and16, this.dx);
		case 3: // AND r/m16,BX
			return this.rwop16(op, sego, this.and16, this.bx);
		case 4: // AND r/m16,SP
			return this.rwop16(op, sego, this.and16, this.sp);
		case 5: // AND r/m16,BP
			return this.rwop16(op, sego, this.and16, this.bp);
		case 6: // AND r/m16,SI
			return this.rwop16(op, sego, this.and16, this.si);
		case 7: // AND r/m16,DI
			return this.rwop16(op, sego, this.and16, this.di);
		}
	}

	execute_22(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // AND AL,r/m8
			return void(this.ax = this.ax & 0xff00 | this.and8(this.ax, this.rop8(op, sego)));
		case 1: // AND CL,r/m8
			return void(this.cx = this.cx & 0xff00 | this.and8(this.cx, this.rop8(op, sego)));
		case 2: // AND DL,r/m8
			return void(this.dx = this.dx & 0xff00 | this.and8(this.dx, this.rop8(op, sego)));
		case 3: // AND BL,r/m8
			return void(this.bx = this.bx & 0xff00 | this.and8(this.bx, this.rop8(op, sego)));
		case 4: // AND AH,r/m8
			return void(this.ax = this.ax & 0xff | this.and8(this.ax >>> 8, this.rop8(op, sego)) << 8);
		case 5: // AND CH,r/m8
			return void(this.cx = this.cx & 0xff | this.and8(this.cx >>> 8, this.rop8(op, sego)) << 8);
		case 6: // AND DH,r/m8
			return void(this.dx = this.dx & 0xff | this.and8(this.dx >>> 8, this.rop8(op, sego)) << 8);
		case 7: // AND BH,r/m8
			return void(this.bx = this.bx & 0xff | this.and8(this.bx >>> 8, this.rop8(op, sego)) << 8);
		}
	}

	execute_23(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // AND AX,r/m16
			return void(this.ax = this.and16(this.ax, this.rop16(op, sego)));
		case 1: // AND CX,r/m16
			return void(this.cx = this.and16(this.cx, this.rop16(op, sego)));
		case 2: // AND DX,r/m16
			return void(this.dx = this.and16(this.dx, this.rop16(op, sego)));
		case 3: // AND BX,r/m16
			return void(this.bx = this.and16(this.bx, this.rop16(op, sego)));
		case 4: // AND SP,r/m16
			return void(this.sp = this.and16(this.sp, this.rop16(op, sego)));
		case 5: // AND BP,r/m16
			return void(this.bp = this.and16(this.bp, this.rop16(op, sego)));
		case 6: // AND SI,r/m16
			return void(this.si = this.and16(this.si, this.rop16(op, sego)));
		case 7: // AND DI,r/m16
			return void(this.di = this.and16(this.di, this.rop16(op, sego)));
		}
	}

	execute_28(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // SUB r/m8,AL
			return this.rwop8(op, sego, this.sub8, this.ax);
		case 1: // SUB r/m8,CL
			return this.rwop8(op, sego, this.sub8, this.cx);
		case 2: // SUB r/m8,DL
			return this.rwop8(op, sego, this.sub8, this.dx);
		case 3: // SUB r/m8,BL
			return this.rwop8(op, sego, this.sub8, this.bx);
		case 4: // SUB r/m8,AH
			return this.rwop8(op, sego, this.sub8, this.ax >>> 8);
		case 5: // SUB r/m8,CH
			return this.rwop8(op, sego, this.sub8, this.cx >>> 8);
		case 6: // SUB r/m8,DH
			return this.rwop8(op, sego, this.sub8, this.dx >>> 8);
		case 7: // SUB r/m8,BH
			return this.rwop8(op, sego, this.sub8, this.bx >>> 8);
		}
	}

	execute_29(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // SUB r/m16,AX
			return this.rwop16(op, sego, this.sub16, this.ax);
		case 1: // SUB r/m16,CX
			return this.rwop16(op, sego, this.sub16, this.cx);
		case 2: // SUB r/m16,DX
			return this.rwop16(op, sego, this.sub16, this.dx);
		case 3: // SUB r/m16,BX
			return this.rwop16(op, sego, this.sub16, this.bx);
		case 4: // SUB r/m16,SP
			return this.rwop16(op, sego, this.sub16, this.sp);
		case 5: // SUB r/m16,BP
			return this.rwop16(op, sego, this.sub16, this.bp);
		case 6: // SUB r/m16,SI
			return this.rwop16(op, sego, this.sub16, this.si);
		case 7: // SUB r/m16,DI
			return this.rwop16(op, sego, this.sub16, this.di);
		}
	}

	execute_2a(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // SUB AL,r/m8
			return void(this.ax = this.ax & 0xff00 | this.sub8(this.ax, this.rop8(op, sego)));
		case 1: // SUB CL,r/m8
			return void(this.cx = this.cx & 0xff00 | this.sub8(this.cx, this.rop8(op, sego)));
		case 2: // SUB DL,r/m8
			return void(this.dx = this.dx & 0xff00 | this.sub8(this.dx, this.rop8(op, sego)));
		case 3: // SUB BL,r/m8
			return void(this.bx = this.bx & 0xff00 | this.sub8(this.bx, this.rop8(op, sego)));
		case 4: // SUB AH,r/m8
			return void(this.ax = this.ax & 0xff | this.sub8(this.ax >>> 8, this.rop8(op, sego)) << 8);
		case 5: // SUB CH,r/m8
			return void(this.cx = this.cx & 0xff | this.sub8(this.cx >>> 8, this.rop8(op, sego)) << 8);
		case 6: // SUB DH,r/m8
			return void(this.dx = this.dx & 0xff | this.sub8(this.dx >>> 8, this.rop8(op, sego)) << 8);
		case 7: // SUB BH,r/m8
			return void(this.bx = this.bx & 0xff | this.sub8(this.bx >>> 8, this.rop8(op, sego)) << 8);
		}
	}

	execute_2b(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // SUB AX,r/m16
			return void(this.ax = this.sub16(this.ax, this.rop16(op, sego)));
		case 1: // SUB CX,r/m16
			return void(this.cx = this.sub16(this.cx, this.rop16(op, sego)));
		case 2: // SUB DX,r/m16
			return void(this.dx = this.sub16(this.dx, this.rop16(op, sego)));
		case 3: // SUB BX,r/m16
			return void(this.bx = this.sub16(this.bx, this.rop16(op, sego)));
		case 4: // SUB SP,r/m16
			return void(this.sp = this.sub16(this.sp, this.rop16(op, sego)));
		case 5: // SUB BP,r/m16
			return void(this.bp = this.sub16(this.bp, this.rop16(op, sego)));
		case 6: // SUB SI,r/m16
			return void(this.si = this.sub16(this.si, this.rop16(op, sego)));
		case 7: // SUB DI,r/m16
			return void(this.di = this.sub16(this.di, this.rop16(op, sego)));
		}
	}

	execute_30(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // XOR r/m8,AL
			return this.rwop8(op, sego, this.xor8, this.ax);
		case 1: // XOR r/m8,CL
			return this.rwop8(op, sego, this.xor8, this.cx);
		case 2: // XOR r/m8,DL
			return this.rwop8(op, sego, this.xor8, this.dx);
		case 3: // XOR r/m8,BL
			return this.rwop8(op, sego, this.xor8, this.bx);
		case 4: // XOR r/m8,AH
			return this.rwop8(op, sego, this.xor8, this.ax >>> 8);
		case 5: // XOR r/m8,CH
			return this.rwop8(op, sego, this.xor8, this.cx >>> 8);
		case 6: // XOR r/m8,DH
			return this.rwop8(op, sego, this.xor8, this.dx >>> 8);
		case 7: // XOR r/m8,BH
			return this.rwop8(op, sego, this.xor8, this.bx >>> 8);
		}
	}

	execute_31(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // XOR r/m16,AX
			return this.rwop16(op, sego, this.xor16, this.ax);
		case 1: // XOR r/m16,CX
			return this.rwop16(op, sego, this.xor16, this.cx);
		case 2: // XOR r/m16,DX
			return this.rwop16(op, sego, this.xor16, this.dx);
		case 3: // XOR r/m16,BX
			return this.rwop16(op, sego, this.xor16, this.bx);
		case 4: // XOR r/m16,SP
			return this.rwop16(op, sego, this.xor16, this.sp);
		case 5: // XOR r/m16,BP
			return this.rwop16(op, sego, this.xor16, this.bp);
		case 6: // XOR r/m16,SI
			return this.rwop16(op, sego, this.xor16, this.si);
		case 7: // XOR r/m16,DI
			return this.rwop16(op, sego, this.xor16, this.di);
		}
	}

	execute_32(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // XOR AL,r/m8
			return void(this.ax = this.ax & 0xff00 | this.xor8(this.ax, this.rop8(op, sego)));
		case 1: // XOR CL,r/m8
			return void(this.cx = this.cx & 0xff00 | this.xor8(this.cx, this.rop8(op, sego)));
		case 2: // XOR DL,r/m8
			return void(this.dx = this.dx & 0xff00 | this.xor8(this.dx, this.rop8(op, sego)));
		case 3: // XOR BL,r/m8
			return void(this.bx = this.bx & 0xff00 | this.xor8(this.bx, this.rop8(op, sego)));
		case 4: // XOR AH,r/m8
			return void(this.ax = this.ax & 0xff | this.xor8(this.ax >>> 8, this.rop8(op, sego)) << 8);
		case 5: // XOR CH,r/m8
			return void(this.cx = this.cx & 0xff | this.xor8(this.cx >>> 8, this.rop8(op, sego)) << 8);
		case 6: // XOR DH,r/m8
			return void(this.dx = this.dx & 0xff | this.xor8(this.dx >>> 8, this.rop8(op, sego)) << 8);
		case 7: // XOR BH,r/m8
			return void(this.bx = this.bx & 0xff | this.xor8(this.bx >>> 8, this.rop8(op, sego)) << 8);
		}
	}

	execute_33(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // XOR AX,r/m16
			return void(this.ax = this.xor16(this.ax, this.rop16(op, sego)));
		case 1: // XOR CX,r/m16
			return void(this.cx = this.xor16(this.cx, this.rop16(op, sego)));
		case 2: // XOR DX,r/m16
			return void(this.dx = this.xor16(this.dx, this.rop16(op, sego)));
		case 3: // XOR BX,r/m16
			return void(this.bx = this.xor16(this.bx, this.rop16(op, sego)));
		case 4: // XOR SP,r/m16
			return void(this.sp = this.xor16(this.sp, this.rop16(op, sego)));
		case 5: // XOR BP,r/m16
			return void(this.bp = this.xor16(this.bp, this.rop16(op, sego)));
		case 6: // XOR SI,r/m16
			return void(this.si = this.xor16(this.si, this.rop16(op, sego)));
		case 7: // XOR DI,r/m16
			return void(this.di = this.xor16(this.di, this.rop16(op, sego)));
		}
	}

	execute_38(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // CMP r/m8,AL
			return this.sub8(this.rop8(op, sego), this.ax);
		case 1: // CMP r/m8,CL
			return this.sub8(this.rop8(op, sego), this.cx);
		case 2: // CMP r/m8,DL
			return this.sub8(this.rop8(op, sego), this.dx);
		case 3: // CMP r/m8,BL
			return this.sub8(this.rop8(op, sego), this.bx);
		case 4: // CMP r/m8,AH
			return this.sub8(this.rop8(op, sego), this.ax >>> 8);
		case 5: // CMP r/m8,CH
			return this.sub8(this.rop8(op, sego), this.cx >>> 8);
		case 6: // CMP r/m8,DH
			return this.sub8(this.rop8(op, sego), this.dx >>> 8);
		case 7: // CMP r/m8,BH
			return this.sub8(this.rop8(op, sego), this.bx >>> 8);
		}
	}

	execute_39(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // CMP r/m16,AX
			return this.sub16(this.rop16(op, sego), this.ax);
		case 1: // CMP r/m16,CX
			return this.sub16(this.rop16(op, sego), this.cx);
		case 2: // CMP r/m16,DX
			return this.sub16(this.rop16(op, sego), this.dx);
		case 3: // CMP r/m16,BX
			return this.sub16(this.rop16(op, sego), this.bx);
		case 4: // CMP r/m16,SP
			return this.sub16(this.rop16(op, sego), this.sp);
		case 5: // CMP r/m16,BP
			return this.sub16(this.rop16(op, sego), this.bp);
		case 6: // CMP r/m16,SI
			return this.sub16(this.rop16(op, sego), this.si);
		case 7: // CMP r/m16,DI
			return this.sub16(this.rop16(op, sego), this.di);
		}
	}

	execute_3a(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // CMP AL,r/m8
			return this.sub8(this.ax, this.rop8(op, sego));
		case 1: // CMP CL,r/m8
			return this.sub8(this.cx, this.rop8(op, sego));
		case 2: // CMP DL,r/m8
			return this.sub8(this.dx, this.rop8(op, sego));
		case 3: // CMP BL,r/m8
			return this.sub8(this.bx, this.rop8(op, sego));
		case 4: // CMP AH,r/m8
			return this.sub8(this.ax >>> 8, this.rop8(op, sego));
		case 5: // CMP CH,r/m8
			return this.sub8(this.cx >>> 8, this.rop8(op, sego));
		case 6: // CMP DH,r/m8
			return this.sub8(this.dx >>> 8, this.rop8(op, sego));
		case 7: // CMP BH,r/m8
			return this.sub8(this.bx >>> 8, this.rop8(op, sego));
		}
	}

	execute_3b(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // CMP AX,r/m16
			return this.sub16(this.ax, this.rop16(op, sego));
		case 1: // CMP CX,r/m16
			return this.sub16(this.cx, this.rop16(op, sego));
		case 2: // CMP DX,r/m16
			return this.sub16(this.dx, this.rop16(op, sego));
		case 3: // CMP BX,r/m16
			return this.sub16(this.bx, this.rop16(op, sego));
		case 4: // CMP SP,r/m16
			return this.sub16(this.sp, this.rop16(op, sego));
		case 5: // CMP BP,r/m16
			return this.sub16(this.bp, this.rop16(op, sego));
		case 6: // CMP SI,r/m16
			return this.sub16(this.si, this.rop16(op, sego));
		case 7: // CMP DI,r/m16
			return this.sub16(this.di, this.rop16(op, sego));
		}
	}

	execute_62(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // BOUND AX,m16&16
			return this.bound(this.ax, ...this.rop32(op, sego));
		case 1: // BOUND CX,m16&16
			return this.bound(this.cx, ...this.rop32(op, sego));
		case 2: // BOUND DX,m16&16
			return this.bound(this.dx, ...this.rop32(op, sego));
		case 3: // BOUND BX,m16&16
			return this.bound(this.bx, ...this.rop32(op, sego));
		case 4: // BOUND SP,m16&16
			return this.bound(this.sp, ...this.rop32(op, sego));
		case 5: // BOUND BP,m16&16
			return this.bound(this.bp, ...this.rop32(op, sego));
		case 6: // BOUND SI,m16&16
			return this.bound(this.si, ...this.rop32(op, sego));
		case 7: // BOUND DI,m16&16
			return this.bound(this.di, ...this.rop32(op, sego));
		}
	}

	execute_69(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // IMUL AX,r/m16,imm16
			return void(this.ax = this.imul16i(this.rop16(op, sego)));
		case 1: // IMUL CX,r/m16,imm16
			return void(this.cx = this.imul16i(this.rop16(op, sego)));
		case 2: // IMUL(DX,r/m16,imm16
			return void(this.dx = this.imul16i(this.rop16(op, sego)));
		case 3: // IMUL BX,r/m16,imm16
			return void(this.bx = this.imul16i(this.rop16(op, sego)));
		case 4: // IMUL SP,r/m16,imm16
			return void(this.sp = this.imul16i(this.rop16(op, sego)));
		case 5: // IMUL BP,r/m16,imm16
			return void(this.bp = this.imul16i(this.rop16(op, sego)));
		case 6: // IMUL SI,r/m16,imm16
			return void(this.si = this.imul16i(this.rop16(op, sego)));
		case 7: // IMUL DI,r/m16,imm16
			return void(this.di = this.imul16i(this.rop16(op, sego)));
		}
	}

	execute_6b(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // IMUL AX,r/m16,imm8
			return void(this.ax = this.imul16is(this.rop16(op, sego)));
		case 1: // IMUL CX,r/m16,imm8
			return void(this.cx = this.imul16is(this.rop16(op, sego)));
		case 2: // IMUL(DX,r/m16,imm8
			return void(this.dx = this.imul16is(this.rop16(op, sego)));
		case 3: // IMUL BX,r/m16,imm8
			return void(this.bx = this.imul16is(this.rop16(op, sego)));
		case 4: // IMUL SP,r/m16,imm8
			return void(this.sp = this.imul16is(this.rop16(op, sego)));
		case 5: // IMUL BP,r/m16,imm8
			return void(this.bp = this.imul16is(this.rop16(op, sego)));
		case 6: // IMUL SI,r/m16,imm8
			return void(this.si = this.imul16is(this.rop16(op, sego)));
		case 7: // IMUL DI,r/m16,imm8
			return void(this.di = this.imul16is(this.rop16(op, sego)));
		}
	}

	execute_80(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // ADD r/m8,imm8
			return this.rwop8i(op, sego, this.add8);
		case 1: // OR r/m8,imm8
			return this.rwop8i(op, sego, this.or8);
		case 2: // ADC r/m8,imm8
			return this.rwop8i(op, sego, this.adc8);
		case 3: // SBB r/m8,imm8
			return this.rwop8i(op, sego, this.sbb8);
		case 4: // AND r/m8,imm8
			return this.rwop8i(op, sego, this.and8);
		case 5: // SUB r/m8,imm8
			return this.rwop8i(op, sego, this.sub8);
		case 6: // XOR r/m8,imm8
			return this.rwop8i(op, sego, this.xor8);
		case 7: // CMP r/m8,imm8
			return this.rop8i(op, sego, this.sub8);
		}
	}

	execute_81(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // ADD r/m16,imm16
			return this.rwop16i(op, sego, this.add16);
		case 1: // OR r/m16,imm16
			return this.rwop16i(op, sego, this.or16);
		case 2: // ADC r/m16,imm16
			return this.rwop16i(op, sego, this.adc16);
		case 3: // SBB r/m16,imm16
			return this.rwop16i(op, sego, this.sbb16);
		case 4: // AND r/m16,imm16
			return this.rwop16i(op, sego, this.and16);
		case 5: // SUB r/m16,imm16
			return this.rwop16i(op, sego, this.sub16);
		case 6: // XOR r/m16,imm16
			return this.rwop16i(op, sego, this.xor16);
		case 7: // CMP r/m16,imm16
			return this.rop16i(op, sego, this.sub16);
		}
	}

	execute_82(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // ADD r/m8,imm8
			return this.rwop8i(op, sego, this.add8);
		case 2: // ADC r/m8,imm8
			return this.rwop8i(op, sego, this.adc8);
		case 3: // SBB r/m8,imm8
			return this.rwop8i(op, sego, this.sbb8);
		case 5: // SUB r/m8,imm8
			return this.rwop8i(op, sego, this.sub8);
		case 7: // CMP r/m8,imm8
			return this.rop8i(op, sego, this.sub8);
		default:
			return this.exception(6);
		}
	}

	execute_83(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // ADD r/m16,imm8
			return this.rwop16is(op, sego, this.add16);
		case 2: // ADC r/m16,imm8
			return this.rwop16is(op, sego, this.adc16);
		case 3: // SBB r/m16,imm8
			return this.rwop16is(op, sego, this.sbb16);
		case 5: // SUB r/m16,imm8
			return this.rwop16is(op, sego, this.sub16);
		case 7: // CMP r/m16,imm8
			return this.rop16is(op, sego, this.sub16);
		default:
			return this.exception(6);
		}
	}

	execute_84(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // TEST AL,r/m8
			return this.and8(this.ax, this.rop8(op, sego));
		case 1: // TEST CL,r/m8
			return this.and8(this.cx, this.rop8(op, sego));
		case 2: // TEST DL,r/m8
			return this.and8(this.dx, this.rop8(op, sego));
		case 3: // TEST BL,r/m8
			return this.and8(this.bx, this.rop8(op, sego));
		case 4: // TEST AH,r/m8
			return this.and8(this.ax >>> 8, this.rop8(op, sego));
		case 5: // TEST CH,r/m8
			return this.and8(this.cx >>> 8, this.rop8(op, sego));
		case 6: // TEST DH,r/m8
			return this.and8(this.dx >>> 8, this.rop8(op, sego));
		case 7: // TEST BH,r/m8
			return this.and8(this.bx >>> 8, this.rop8(op, sego));
		}
	}

	execute_85(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // TEST AX,r/m16
			return this.and16(this.ax, this.rop16(op, sego));
		case 1: // TEST CX,r/m16
			return this.and16(this.cx, this.rop16(op, sego));
		case 2: // TEST DX,r/m16
			return this.and16(this.dx, this.rop16(op, sego));
		case 3: // TEST BX,r/m16
			return this.and16(this.bx, this.rop16(op, sego));
		case 4: // TEST SP,r/m16
			return this.and16(this.sp, this.rop16(op, sego));
		case 5: // TEST BP,r/m16
			return this.and16(this.bp, this.rop16(op, sego));
		case 6: // TEST SI,r/m16
			return this.and16(this.si, this.rop16(op, sego));
		case 7: // TEST DI,r/m16
			return this.and16(this.di, this.rop16(op, sego));
		}
	}

	execute_86(sego) {
		const op = this.fetch8();
		let v;

		switch (op >>> 3 & 7) {
		case 0: // XCHG AL,r/m8
			[this.ax, v] = [this.ax & 0xff00 | this.rop8(op, sego), this.ax & 0xff];
			return this.wop8(op, sego, v);
		case 1: // XCHG CL,r/m8
			[this.cx, v] = [this.ax & 0xff00 | this.rop8(op, sego), this.cx & 0xff];
			return this.wop8(op, sego, v);
		case 2: // XCHG DL,r/m8
			[this.dx, v] = [this.ax & 0xff00 | this.rop8(op, sego), this.dx & 0xff];
			return this.wop8(op, sego, v);
		case 3: // XCHG BL,r/m8
			[this.bx, v] = [this.ax & 0xff00 | this.rop8(op, sego), this.bx & 0xff];
			return this.wop8(op, sego, v);
		case 4: // XCHG AH,r/m8
			[this.ax, v] = [this.ax & 0xff | this.rop8(op, sego) << 8, this.ax >>> 8];
			return this.wop8(op, sego, v);
		case 5: // XCHG CH,r/m8
			[this.cx, v] = [this.cx & 0xff | this.rop8(op, sego) << 8, this.cx >>> 8];
			return this.wop8(op, sego, v);
		case 6: // XCHG DH,r/m8
			[this.dx, v] = [this.dx & 0xff | this.rop8(op, sego) << 8, this.dx >>> 8];
			return this.wop8(op, sego, v);
		case 7: // XCHG BH,r/m8
			[this.bx, v] = [this.bx & 0xff | this.rop8(op, sego) << 8, this.bx >>> 8];
			return this.wop8(op, sego, v);
		}
	}

	execute_87(sego) {
		const op = this.fetch8();
		let v;

		switch (op >>> 3 & 7) {
		case 0: // XCHG AX,r/m16
			[this.ax, v] = [this.rop16(op, sego), this.ax];
			return this.wop16(op, sego, v);
		case 1: // XCHG CX,r/m16
			[this.cx, v] = [this.rop16(op, sego), this.cx];
			return this.wop16(op, sego, v);
		case 2: // XCHG DX,r/m16
			[this.dx, v] = [this.rop16(op, sego), this.dx];
			return this.wop16(op, sego, v);
		case 3: // XCHG BX,r/m16
			[this.bx, v] = [this.rop16(op, sego), this.bx];
			return this.wop16(op, sego, v);
		case 4: // XCHG SP,r/m16
			[this.sp, v] = [this.rop16(op, sego), this.sp];
			return this.wop16(op, sego, v);
		case 5: // XCHG BP,r/m16
			[this.bp, v] = [this.rop16(op, sego), this.bp];
			return this.wop16(op, sego, v);
		case 6: // XCHG SI,r/m16
			[this.si, v] = [this.rop16(op, sego), this.si];
			return this.wop16(op, sego, v);
		case 7: // XCHG DI,r/m16
			[this.di, v] = [this.rop16(op, sego), this.di];
			return this.wop16(op, sego, v);
		}
	}

	execute_88(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // MOV r/m8,AL
			return this.wop8(op, sego, this.ax & 0xff);
		case 1: // MOV r/m8,CL
			return this.wop8(op, sego, this.cx & 0xff);
		case 2: // MOV r/m8,DL
			return this.wop8(op, sego, this.dx & 0xff);
		case 3: // MOV r/m8,BL
			return this.wop8(op, sego, this.bx & 0xff);
		case 4: // MOV r/m8,AH
			return this.wop8(op, sego, this.ax >>> 8);
		case 5: // MOV r/m8,CH
			return this.wop8(op, sego, this.cx >>> 8);
		case 6: // MOV r/m8,DH
			return this.wop8(op, sego, this.dx >>> 8);
		case 7: // MOV r/m8,BH
			return this.wop8(op, sego, this.bx >>> 8);
		}
	}

	execute_89(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // MOV r/m16,AX
			return this.wop16(op, sego, this.ax);
		case 1: // MOV r/m16,CX
			return this.wop16(op, sego, this.cx);
		case 2: // MOV r/m16,DX
			return this.wop16(op, sego, this.dx);
		case 3: // MOV r/m16,BX
			return this.wop16(op, sego, this.bx);
		case 4: // MOV r/m16,SP
			return this.wop16(op, sego, this.sp);
		case 5: // MOV r/m16,BP
			return this.wop16(op, sego, this.bp);
		case 6: // MOV r/m16,SI
			return this.wop16(op, sego, this.si);
		case 7: // MOV r/m16,DI
			return this.wop16(op, sego, this.di);
		}
	}

	execute_8a(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // MOV AL,r/m8
			return void(this.ax = this.ax & 0xff00 | this.rop8(op, sego));
		case 1: // MOV CL,r/m8
			return void(this.cx = this.cx & 0xff00 | this.rop8(op, sego));
		case 2: // MOV DL,r/m8
			return void(this.dx = this.dx & 0xff00 | this.rop8(op, sego));
		case 3: // MOV BL,r/m8
			return void(this.bx = this.bx & 0xff00 | this.rop8(op, sego));
		case 4: // MOV AH,r/m8
			return void(this.ax = this.ax & 0xff | this.rop8(op, sego) << 8);
		case 5: // MOV CH,r/m8
			return void(this.cx = this.cx & 0xff | this.rop8(op, sego) << 8);
		case 6: // MOV DH,r/m8
			return void(this.dx = this.dx & 0xff | this.rop8(op, sego) << 8);
		case 7: // MOV BH,r/m8
			return void(this.bx = this.bx & 0xff | this.rop8(op, sego) << 8);
		}
	}

	execute_8b(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // MOV AX,r/m16
			return void(this.ax = this.rop16(op, sego));
		case 1: // MOV CX,r/m16
			return void(this.cx = this.rop16(op, sego));
		case 2: // MOV DX,r/m16
			return void(this.dx = this.rop16(op, sego));
		case 3: // MOV BX,r/m16
			return void(this.bx = this.rop16(op, sego));
		case 4: // MOV SP,r/m16
			return void(this.sp = this.rop16(op, sego));
		case 5: // MOV BP,r/m16
			return void(this.bp = this.rop16(op, sego));
		case 6: // MOV SI,r/m16
			return void(this.si = this.rop16(op, sego));
		case 7: // MOV DI,r/m16
			return void(this.di = this.rop16(op, sego));
		}
	}

	execute_8c(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // MOV r/m16,ES
			return this.wop16(op, sego, this.es);
		case 1: // MOV r/m16,CS
			return this.wop16(op, sego, this.cs);
		case 2: // MOV r/m16,SS
			return this.wop16(op, sego, this.ss);
		case 3: // MOV r/m16,DS
			return this.wop16(op, sego, this.ds);
		default:
			return this.exception(6);
		}
	}

	execute_8d() {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // LEA AX,m16
			return void(this.ax = this.lea(op));
		case 1: // LEA CX,m16
			return void(this.cx = this.lea(op));
		case 2: // LEA DX,m16
			return void(this.dx = this.lea(op));
		case 3: // LEA BX,m16
			return void(this.bx = this.lea(op));
		case 4: // LEA SP,m16
			return void(this.sp = this.lea(op));
		case 5: // LEA BP,m16
			return void(this.bp = this.lea(op));
		case 6: // LEA SI,m16
			return void(this.si = this.lea(op));
		case 7: // LEA DI,m16
			return void(this.di = this.lea(op));
		}
	}

	execute_8e(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // MOV ES,r/m16
			return void(this.es = this.rop16(op, sego));
		case 1: // MOV CS,r/m16
			return void(this.cs = this.rop16(op, sego));
		case 2: // MOV SS,r/m16
			this.intmask = true;
			return void(this.ss = this.rop16(op, sego));
		case 3: // MOV DS,r/m16
			return void(this.ds = this.rop16(op, sego));
		default:
			return this.exception(6);
		}
	}

	execute_c0(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // ROL r/m8,imm8
			return this.rwop8(op, sego, this.rol8, this.fetch8());
		case 1: // ROR r/m8,imm8
			return this.rwop8(op, sego, this.ror8, this.fetch8());
		case 2: // RCL r/m8,imm8
			return this.rwop8(op, sego, this.rcl8, this.fetch8());
		case 3: // RCR r/m8,imm8
			return this.rwop8(op, sego, this.rcr8, this.fetch8());
		case 4: // SAL/SHL r/m8,imm8
			return this.rwop8(op, sego, this.shl8, this.fetch8());
		case 5: // SHR r/m8,imm8
			return this.rwop8(op, sego, this.shr8, this.fetch8());
		case 7: // SAR r/m8,imm8
			return this.rwop8(op, sego, this.sar8, this.fetch8());
		default:
			return this.exception(6);
		}
	}

	execute_c1(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // ROL r/m16,imm8
			return this.rwop16(op, sego, this.rol16, this.fetch8());
		case 1: // ROR r/m16,imm8
			return this.rwop16(op, sego, this.ror16, this.fetch8());
		case 2: // RCL r/m16,imm8
			return this.rwop16(op, sego, this.rcl16, this.fetch8());
		case 3: // RCR r/m16,imm8
			return this.rwop16(op, sego, this.rcr16, this.fetch8());
		case 4: // SAL/SHL r/m16,imm8
			return this.rwop16(op, sego, this.shl16, this.fetch8());
		case 5: // SHR r/m16,imm8
			return this.rwop16(op, sego, this.shr16, this.fetch8());
		case 7: // SAR r/m16,imm8
			return this.rwop16(op, sego, this.sar16, this.fetch8());
		default:
			return this.exception(6);
		}
	}

	execute_c4(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // LES AX,m16:16
			return void([this.ax, this.es] = this.rop32(op, sego));
		case 1: // LES CX,m16:16
			return void([this.cx, this.es] = this.rop32(op, sego));
		case 2: // LES DX,m16:16
			return void([this.dx, this.es] = this.rop32(op, sego));
		case 3: // LES BX,m16:16
			return void([this.bx, this.es] = this.rop32(op, sego));
		case 4: // LES SP,m16:16
			return void([this.sp, this.es] = this.rop32(op, sego));
		case 5: // LES BP,m16:16
			return void([this.bp, this.es] = this.rop32(op, sego));
		case 6: // LES SI,m16:16
			return void([this.si, this.es] = this.rop32(op, sego));
		case 7: // LES DI,m16:16
			return void([this.di, this.es] = this.rop32(op, sego));
		}
	}

	execute_c5(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // LDS AX,m16:16
			return void([this.ax, this.ds] = this.rop32(op, sego));
		case 1: // LDS CX,m16:16
			return void([this.cx, this.ds] = this.rop32(op, sego));
		case 2: // LDS DX,m16:16
			return void([this.dx, this.ds] = this.rop32(op, sego));
		case 3: // LDS BX,m16:16
			return void([this.bx, this.ds] = this.rop32(op, sego));
		case 4: // LDS SP,m16:16
			return void([this.sp, this.ds] = this.rop32(op, sego));
		case 5: // LDS BP,m16:16
			return void([this.bp, this.ds] = this.rop32(op, sego));
		case 6: // LDS SI,m16:16
			return void([this.si, this.ds] = this.rop32(op, sego));
		case 7: // LDS DI,m16:16
			return void([this.di, this.ds] = this.rop32(op, sego));
		}
	}

	execute_d0(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // ROL r/m8,1
			return this.rwop8(op, sego, this.rol8, 1);
		case 1: // ROR r/m8,1
			return this.rwop8(op, sego, this.ror8, 1);
		case 2: // RCL r/m8,1
			return this.rwop8(op, sego, this.rcl8, 1);
		case 3: // RCR r/m8,1
			return this.rwop8(op, sego, this.rcr8, 1);
		case 4: // SAL/SHL r/m8,1
			return this.rwop8(op, sego, this.shl8, 1);
		case 5: // SHR r/m8,1
			return this.rwop8(op, sego, this.shr8, 1);
		case 7: // SAR r/m8,1
			return this.rwop8(op, sego, this.sar8, 1);
		default:
			return this.exception(6);
		}
	}

	execute_d1(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // ROL r/m16,1
			return this.rwop16(op, sego, this.rol16, 1);
		case 1: // ROR r/m16,1
			return this.rwop16(op, sego, this.ror16, 1);
		case 2: // RCL r/m16,1
			return this.rwop16(op, sego, this.rcl16, 1);
		case 3: // RCR r/m16,1
			return this.rwop16(op, sego, this.rcr16, 1);
		case 4: // SAL/SHL r/m16,1
			return this.rwop16(op, sego, this.shl16, 1);
		case 5: // SHR r/m16,1
			return this.rwop16(op, sego, this.shr16, 1);
		case 7: // SAR r/m16,1
			return this.rwop16(op, sego, this.sar16, 1);
		default:
			return this.exception(6);
		}
	}

	execute_d2(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // ROL r/m8,CL
			return this.rwop8(op, sego, this.rol8, this.cx & 0xff);
		case 1: // ROR r/m8,CL
			return this.rwop8(op, sego, this.ror8, this.cx & 0xff);
		case 2: // RCL r/m8,CL
			return this.rwop8(op, sego, this.rcl8, this.cx & 0xff);
		case 3: // RCR r/m8,CL
			return this.rwop8(op, sego, this.rcr8, this.cx & 0xff);
		case 4: // SAL/SHL r/m8,CL
			return this.rwop8(op, sego, this.shl8, this.cx & 0xff);
		case 5: // SHR r/m8,CL
			return this.rwop8(op, sego, this.shr8, this.cx & 0xff);
		case 7: // SAR r/m8,CL
			return this.rwop8(op, sego, this.sar8, this.cx & 0xff);
		default:
			return this.exception(6);
		}
	}

	execute_d3(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // ROL r/m16,CL
			return this.rwop16(op, sego, this.rol16, this.cx & 0xff);
		case 1: // ROR r/m16,CL
			return this.rwop16(op, sego, this.ror16, this.cx & 0xff);
		case 2: // RCL r/m16,CL
			return this.rwop16(op, sego, this.rcl16, this.cx & 0xff);
		case 3: // RCR r/m16,CL
			return this.rwop16(op, sego, this.rcr16, this.cx & 0xff);
		case 4: // SAL/SHL r/m16,CL
			return this.rwop16(op, sego, this.shl16, this.cx & 0xff);
		case 5: // SHR r/m16,CL
			return this.rwop16(op, sego, this.shr16, this.cx & 0xff);
		case 7: // SAR r/m16,CL
			return this.rwop16(op, sego, this.sar16, this.cx & 0xff);
		default:
			return this.exception(6);
		}
	}

	execute_f6(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // TEST r/m8,imm8
			return this.rop8i(op, sego, this.and8);
		case 2: // NOT r/m8
			return this.rwop8(op, sego, dst => ~dst & 0xff);
		case 3: // NEG r/m8
			return this.rwop8(op, sego, this.neg8);
		case 4: // MUL r/m8
			return this.mul8(this.rop8(op, sego));
		case 5: // IMUL r/m8
			return this.imul8(this.rop8(op, sego));
		case 6: // DIV r/m8
			return this.div8(this.rop8(op, sego));
		case 7: // IDIV r/m8
			return this.idiv8(this.rop8(op, sego));
		default:
			return this.exception(6);
		}
	}

	execute_f7(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // TEST r/m16,imm16
			return this.rop16i(op, sego, this.and16);
		case 2: // NOT r/m16
			return this.rwop16(op, sego, dst => ~dst & 0xffff);
		case 3: // NEG r/m16
			return this.rwop16(op, sego, this.neg16);
		case 4: // MUL r/m16
			return this.mul16(this.rop16(op, sego));
		case 5: // IMUL r/m16
			return this.imul16(this.rop16(op, sego));
		case 6: // DIV r/m16
			return this.div16(this.rop16(op, sego));
		case 7: // IDIV r/m16
			return this.idiv16(this.rop16(op, sego));
		default:
			return this.exception(6);
		}
	}

	execute_fe(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // INC r/m8
			return this.rwop8(op, sego, this.inc8);
		case 1: // DEC r/m8
			return this.rwop8(op, sego, this.dec8);
		default:
			return this.exception(6);
		}
	}

	execute_ff(sego) {
		const op = this.fetch8();

		switch (op >>> 3 & 7) {
		case 0: // INC r/m16
			return this.rwop16(op, sego, this.inc16);
		case 1: // DEC r/m16
			return this.rwop16(op, sego, this.dec16);
		case 2: // CALL r/m16
			return this.call16a(this.rop16(op, sego));
		case 3: // CALL m16:16
			return this.call32(...this.rop32(op, sego));
		case 4: // JMP r/m16
			return void(this.ip = this.rop16(op, sego));
		case 5: // JMP m16:16
			return void([this.ip, this.cs] = this.rop32(op, sego));
		case 6: // PUSH r/m16
			return this.push(this.rop16(op, sego));
		default:
			return this.exception(6);
		}
	}

	lea(op) {
		switch (op & 0o307) {
		case 0o000: // [BX+SI]
			return this.bx + this.si & 0xffff;
		case 0o001: // [BX+DI]
			return this.bx + this.di & 0xffff;
		case 0o002: // [BP+SI]
			return this.bp + this.si & 0xffff;
		case 0o003: // [BP+DI]
			return this.bp + this.di & 0xffff;
		case 0o004: // [SI]
			return this.si;
		case 0o005: // [DI]
			return this.di;
		case 0o006: // disp16
			return this.fetch16();
		case 0o007: // [BX]
			return this.bx;
		case 0o100: // [BX+SI]+disp8
			return this.bx + this.si + this.fetch8s() & 0xffff;
		case 0o101: // [BX+DI]+disp8
			return this.bx + this.di + this.fetch8s() & 0xffff;
		case 0o102: // [BP+SI]+disp8
			return this.bp + this.si + this.fetch8s() & 0xffff;
		case 0o103: // [BP+DI]+disp8
			return this.bp + this.di + this.fetch8s() & 0xffff;
		case 0o104: // [SI]+disp8
			return this.si + this.fetch8s() & 0xffff;
		case 0o105: // [DI]+disp8
			return this.di + this.fetch8s() & 0xffff;
		case 0o106: // [BP]+disp8
			return this.bp + this.fetch8s() & 0xffff;
		case 0o107: // [BX]+disp8
			return this.bx + this.fetch8s() & 0xffff;
		case 0o200: // [BX+SI]+disp16
			return this.bx + this.si + this.fetch16() & 0xffff;
		case 0o201: // [BX+DI]+disp16
			return this.bx + this.di + this.fetch16() & 0xffff;
		case 0o202: // [BP+SI]+disp16
			return this.bp + this.si + this.fetch16() & 0xffff;
		case 0o203: // [BP+DI]+disp16
			return this.bp + this.di + this.fetch16() & 0xffff;
		case 0o204: // [SI]+disp16
			return this.si + this.fetch16() & 0xffff;
		case 0o205: // [DI]+disp16
			return this.di + this.fetch16() & 0xffff;
		case 0o206: // [BP]+disp16
			return this.bp + this.fetch16() & 0xffff;
		case 0o207: // [BX]+disp16
			return this.bx + this.fetch16() & 0xffff;
		}
	}

	rwop8(op, sego, fn, src) {
		let seg, ea;

		switch (op & 0o307) {
		case 0o000: // [BX+SI]
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.si & 0xffff, fn.call(this, this.read8(seg, ea), src));
		case 0o001: // [BX+DI]
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.di & 0xffff, fn.call(this, this.read8(seg, ea), src));
		case 0o002: // [BP+SI]
			return this.write8(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.si & 0xffff, fn.call(this, this.read8(seg, ea), src));
		case 0o003: // [BP+DI]
			return this.write8(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.di & 0xffff, fn.call(this, this.read8(seg, ea), src));
		case 0o004: // [SI]
			return this.write8(seg = sego >= 0 ? sego : this.ds, this.si, fn.call(this, this.read8(seg, this.si), src));
		case 0o005: // [DI]
			return this.write8(seg = sego >= 0 ? sego : this.ds, this.di, fn.call(this, this.read8(seg, this.di), src));
		case 0o006: // disp16
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.fetch16(), fn.call(this, this.read8(seg, ea), src));
		case 0o007: // [BX]
			return this.write8(seg = sego >= 0 ? sego : this.ds, this.bx, fn.call(this, this.read8(seg, this.bx), src));
		case 0o100: // [BX+SI]+disp8
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.si + this.fetch8s() & 0xffff, fn.call(this, this.read8(seg, ea), src));
		case 0o101: // [BX+DI]+disp8
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.di + this.fetch8s() & 0xffff, fn.call(this, this.read8(seg, ea), src));
		case 0o102: // [BP+SI]+disp8
			return this.write8(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.si + this.fetch8s() & 0xffff, fn.call(this, this.read8(seg, ea), src));
		case 0o103: // [BP+DI]+disp8
			return this.write8(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.di + this.fetch8s() & 0xffff, fn.call(this, this.read8(seg, ea), src));
		case 0o104: // [SI]+disp8
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.si + this.fetch8s() & 0xffff, fn.call(this, this.read8(seg, ea), src));
		case 0o105: // [DI]+disp8
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.di + this.fetch8s() & 0xffff, fn.call(this, this.read8(seg, ea), src));
		case 0o106: // [BP]+disp8
			return this.write8(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.fetch8s() & 0xffff, fn.call(this, this.read8(seg, ea), src));
		case 0o107: // [BX]+disp8
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.fetch8s() & 0xffff, fn.call(this, this.read8(seg, ea), src));
		case 0o200: // [BX+SI]+disp16
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.si + this.fetch16() & 0xffff, fn.call(this, this.read8(seg, ea), src));
		case 0o201: // [BX+DI]+disp16
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.di + this.fetch16() & 0xffff, fn.call(this, this.read8(seg, ea), src));
		case 0o202: // [BP+SI]+disp16
			return this.write8(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.si + this.fetch16() & 0xffff, fn.call(this, this.read8(seg, ea), src));
		case 0o203: // [BP+DI]+disp16
			return this.write8(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.di + this.fetch16() & 0xffff, fn.call(this, this.read8(seg, ea), src));
		case 0o204: // [SI]+disp16
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.si + this.fetch16() & 0xffff, fn.call(this, this.read8(seg, ea), src));
		case 0o205: // [DI]+disp16
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.di + this.fetch16() & 0xffff, fn.call(this, this.read8(seg, ea), src));
		case 0o206: // [BP]+disp16
			return this.write8(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.fetch16() & 0xffff, fn.call(this, this.read8(seg, ea), src));
		case 0o207: // [BX]+disp16
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.fetch16() & 0xffff, fn.call(this, this.read8(seg, ea), src));
		case 0o300: // AL
			return void(this.ax = this.ax & 0xff00 | fn.call(this, this.ax & 0xff, src));
		case 0o301: // CL
			return void(this.cx = this.cx & 0xff00 | fn.call(this, this.cx & 0xff, src));
		case 0o302: // DL
			return void(this.dx = this.dx & 0xff00 | fn.call(this, this.dx & 0xff, src));
		case 0o303: // BL
			return void(this.bx = this.bx & 0xff00 | fn.call(this, this.bx & 0xff, src));
		case 0o304: // AH
			return void(this.ax = this.ax & 0xff | fn.call(this, this.ax >>> 8, src) << 8);
		case 0o305: // CH
			return void(this.cx = this.cx & 0xff | fn.call(this, this.cx >>> 8, src) << 8);
		case 0o306: // DH
			return void(this.dx = this.dx & 0xff | fn.call(this, this.dx >>> 8, src) << 8);
		case 0o307: // BH
			return void(this.bx = this.bx & 0xff | fn.call(this, this.bx >>> 8, src) << 8);
		}
	}

	rwop16(op, sego, fn, src) {
		let seg, ea;

		switch (op & 0o307) {
		case 0o000: // [BX+SI]
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.si & 0xffff, fn.call(this, this.read16(seg, ea), src));
		case 0o001: // [BX+DI]
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.di & 0xffff, fn.call(this, this.read16(seg, ea), src));
		case 0o002: // [BP+SI]
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.si & 0xffff, fn.call(this, this.read16(seg, ea), src));
		case 0o003: // [BP+DI]
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.di & 0xffff, fn.call(this, this.read16(seg, ea), src));
		case 0o004: // [SI]
			return this.write16(seg = sego >= 0 ? sego : this.ds, this.si, fn.call(this, this.read16(seg, this.si), src));
		case 0o005: // [DI]
			return this.write16(seg = sego >= 0 ? sego : this.ds, this.di, fn.call(this, this.read16(seg, this.di), src));
		case 0o006: // disp16
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.fetch16(), fn.call(this, this.read16(seg, ea), src));
		case 0o007: // [BX]
			return this.write16(seg = sego >= 0 ? sego : this.ds, this.bx, fn.call(this, this.read16(seg, this.bx), src));
		case 0o100: // [BX+SI]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.si + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), src));
		case 0o101: // [BX+DI]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.di + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), src));
		case 0o102: // [BP+SI]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.si + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), src));
		case 0o103: // [BP+DI]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.di + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), src));
		case 0o104: // [SI]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.si + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), src));
		case 0o105: // [DI]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.di + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), src));
		case 0o106: // [BP]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), src));
		case 0o107: // [BX]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), src));
		case 0o200: // [BX+SI]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.si + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), src));
		case 0o201: // [BX+DI]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.di + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), src));
		case 0o202: // [BP+SI]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.si + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), src));
		case 0o203: // [BP+DI]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.di + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), src));
		case 0o204: // [SI]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.si + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), src));
		case 0o205: // [DI]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.di + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), src));
		case 0o206: // [BP]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), src));
		case 0o207: // [BX]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), src));
		case 0o300: // AX
			return void(this.ax = fn.call(this, this.ax, src));
		case 0o301: // CX
			return void(this.cx = fn.call(this, this.cx, src));
		case 0o302: // DX
			return void(this.dx = fn.call(this, this.dx, src));
		case 0o303: // BX
			return void(this.bx = fn.call(this, this.bx, src));
		case 0o304: // SP
			return void(this.sp = fn.call(this, this.sp, src));
		case 0o305: // BP
			return void(this.bp = fn.call(this, this.bp, src));
		case 0o306: // SI
			return void(this.si = fn.call(this, this.si, src));
		case 0o307: // DI
			return void(this.di = fn.call(this, this.di, src));
		}
	}

	rwop8i(op, sego, fn) {
		let seg, ea;

		switch (op & 0o307) {
		case 0o000: // [BX+SI]
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.si & 0xffff, fn.call(this, this.read8(seg, ea), this.fetch8()));
		case 0o001: // [BX+DI]
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.di & 0xffff, fn.call(this, this.read8(seg, ea), this.fetch8()));
		case 0o002: // [BP+SI]
			return this.write8(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.si & 0xffff, fn.call(this, this.read8(seg, ea), this.fetch8()));
		case 0o003: // [BP+DI]
			return this.write8(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.di & 0xffff, fn.call(this, this.read8(seg, ea), this.fetch8()));
		case 0o004: // [SI]
			return this.write8(seg = sego >= 0 ? sego : this.ds, this.si, fn.call(this, this.read8(seg, this.si), this.fetch8()));
		case 0o005: // [DI]
			return this.write8(seg = sego >= 0 ? sego : this.ds, this.di, fn.call(this, this.read8(seg, this.di), this.fetch8()));
		case 0o006: // disp16
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.fetch16(), fn.call(this, this.read8(seg, ea), this.fetch8()));
		case 0o007: // [BX]
			return this.write8(seg = sego >= 0 ? sego : this.ds, this.bx, fn.call(this, this.read8(seg, this.bx), this.fetch8()));
		case 0o100: // [BX+SI]+disp8
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.si + this.fetch8s() & 0xffff, fn.call(this, this.read8(seg, ea), this.fetch8()));
		case 0o101: // [BX+DI]+disp8
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.di + this.fetch8s() & 0xffff, fn.call(this, this.read8(seg, ea), this.fetch8()));
		case 0o102: // [BP+SI]+disp8
			return this.write8(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.si + this.fetch8s() & 0xffff, fn.call(this, this.read8(seg, ea), this.fetch8()));
		case 0o103: // [BP+DI]+disp8
			return this.write8(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.di + this.fetch8s() & 0xffff, fn.call(this, this.read8(seg, ea), this.fetch8()));
		case 0o104: // [SI]+disp8
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.si + this.fetch8s() & 0xffff, fn.call(this, this.read8(seg, ea), this.fetch8()));
		case 0o105: // [DI]+disp8
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.di + this.fetch8s() & 0xffff, fn.call(this, this.read8(seg, ea), this.fetch8()));
		case 0o106: // [BP]+disp8
			return this.write8(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.fetch8s() & 0xffff, fn.call(this, this.read8(seg, ea), this.fetch8()));
		case 0o107: // [BX]+disp8
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.fetch8s() & 0xffff, fn.call(this, this.read8(seg, ea), this.fetch8()));
		case 0o200: // [BX+SI]+disp16
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.si + this.fetch16() & 0xffff, fn.call(this, this.read8(seg, ea), this.fetch8()));
		case 0o201: // [BX+DI]+disp16
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.di + this.fetch16() & 0xffff, fn.call(this, this.read8(seg, ea), this.fetch8()));
		case 0o202: // [BP+SI]+disp16
			return this.write8(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.si + this.fetch16() & 0xffff, fn.call(this, this.read8(seg, ea), this.fetch8()));
		case 0o203: // [BP+DI]+disp16
			return this.write8(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.di + this.fetch16() & 0xffff, fn.call(this, this.read8(seg, ea), this.fetch8()));
		case 0o204: // [SI]+disp16
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.si + this.fetch16() & 0xffff, fn.call(this, this.read8(seg, ea), this.fetch8()));
		case 0o205: // [DI]+disp16
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.di + this.fetch16() & 0xffff, fn.call(this, this.read8(seg, ea), this.fetch8()));
		case 0o206: // [BP]+disp16
			return this.write8(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.fetch16() & 0xffff, fn.call(this, this.read8(seg, ea), this.fetch8()));
		case 0o207: // [BX]+disp16
			return this.write8(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.fetch16() & 0xffff, fn.call(this, this.read8(seg, ea), this.fetch8()));
		case 0o300: // AL
			return void(this.ax = this.ax & 0xff00 | fn.call(this, this.ax & 0xff, this.fetch8()));
		case 0o301: // CL
			return void(this.cx = this.cx & 0xff00 | fn.call(this, this.cx & 0xff, this.fetch8()));
		case 0o302: // DL
			return void(this.dx = this.dx & 0xff00 | fn.call(this, this.dx & 0xff, this.fetch8()));
		case 0o303: // BL
			return void(this.bx = this.bx & 0xff00 | fn.call(this, this.bx & 0xff, this.fetch8()));
		case 0o304: // AH
			return void(this.ax = this.ax & 0xff | fn.call(this, this.ax >>> 8, this.fetch8()) << 8);
		case 0o305: // CH
			return void(this.cx = this.cx & 0xff | fn.call(this, this.cx >>> 8, this.fetch8()) << 8);
		case 0o306: // DH
			return void(this.dx = this.dx & 0xff | fn.call(this, this.dx >>> 8, this.fetch8()) << 8);
		case 0o307: // BH
			return void(this.bx = this.bx & 0xff | fn.call(this, this.bx >>> 8, this.fetch8()) << 8);
		}
	}

	rwop16i(op, sego, fn) {
		let seg, ea;

		switch (op & 0o307) {
		case 0o000: // [BX+SI]
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.si & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch16()));
		case 0o001: // [BX+DI]
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.di & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch16()));
		case 0o002: // [BP+SI]
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.si & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch16()));
		case 0o003: // [BP+DI]
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.di & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch16()));
		case 0o004: // [SI]
			return this.write16(seg = sego >= 0 ? sego : this.ds, this.si, fn.call(this, this.read16(seg, this.si), this.fetch16()));
		case 0o005: // [DI]
			return this.write16(seg = sego >= 0 ? sego : this.ds, this.di, fn.call(this, this.read16(seg, this.di), this.fetch16()));
		case 0o006: // disp16
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.fetch16(), fn.call(this, this.read16(seg, ea), this.fetch16()));
		case 0o007: // [BX]
			return this.write16(seg = sego >= 0 ? sego : this.ds, this.bx, fn.call(this, this.read16(seg, this.bx), this.fetch16()));
		case 0o100: // [BX+SI]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.si + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch16()));
		case 0o101: // [BX+DI]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.di + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch16()));
		case 0o102: // [BP+SI]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.si + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch16()));
		case 0o103: // [BP+DI]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.di + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch16()));
		case 0o104: // [SI]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.si + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch16()));
		case 0o105: // [DI]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.di + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch16()));
		case 0o106: // [BP]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch16()));
		case 0o107: // [BX]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch16()));
		case 0o200: // [BX+SI]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.si + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch16()));
		case 0o201: // [BX+DI]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.di + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch16()));
		case 0o202: // [BP+SI]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.si + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch16()));
		case 0o203: // [BP+DI]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.di + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch16()));
		case 0o204: // [SI]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.si + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch16()));
		case 0o205: // [DI]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.di + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch16()));
		case 0o206: // [BP]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch16()));
		case 0o207: // [BX]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch16()));
		case 0o300: // AX
			return void(this.ax = fn.call(this, this.ax, this.fetch16()));
		case 0o301: // CX
			return void(this.cx = fn.call(this, this.cx, this.fetch16()));
		case 0o302: // DX
			return void(this.dx = fn.call(this, this.dx, this.fetch16()));
		case 0o303: // BX
			return void(this.bx = fn.call(this, this.bx, this.fetch16()));
		case 0o304: // SP
			return void(this.sp = fn.call(this, this.sp, this.fetch16()));
		case 0o305: // BP
			return void(this.bp = fn.call(this, this.bp, this.fetch16()));
		case 0o306: // SI
			return void(this.si = fn.call(this, this.si, this.fetch16()));
		case 0o307: // DI
			return void(this.di = fn.call(this, this.di, this.fetch16()));
		}
	}

	rwop16is(op, sego, fn) {
		let seg, ea;

		switch (op & 0o307) {
		case 0o000: // [BX+SI]
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.si & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch8s()));
		case 0o001: // [BX+DI]
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.di & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch8s()));
		case 0o002: // [BP+SI]
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.si & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch8s()));
		case 0o003: // [BP+DI]
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.di & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch8s()));
		case 0o004: // [SI]
			return this.write16(seg = sego >= 0 ? sego : this.ds, this.si, fn.call(this, this.read16(seg, this.si), this.fetch8s()));
		case 0o005: // [DI]
			return this.write16(seg = sego >= 0 ? sego : this.ds, this.di, fn.call(this, this.read16(seg, this.di), this.fetch8s()));
		case 0o006: // disp16
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.fetch16(), fn.call(this, this.read16(seg, ea), this.fetch8s()));
		case 0o007: // [BX]
			return this.write16(seg = sego >= 0 ? sego : this.ds, this.bx, fn.call(this, this.read16(seg, this.bx), this.fetch8s()));
		case 0o100: // [BX+SI]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.si + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch8s()));
		case 0o101: // [BX+DI]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.di + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch8s()));
		case 0o102: // [BP+SI]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.si + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch8s()));
		case 0o103: // [BP+DI]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.di + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch8s()));
		case 0o104: // [SI]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.si + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch8s()));
		case 0o105: // [DI]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.di + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch8s()));
		case 0o106: // [BP]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch8s()));
		case 0o107: // [BX]+disp8
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.fetch8s() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch8s()));
		case 0o200: // [BX+SI]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.si + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch8s()));
		case 0o201: // [BX+DI]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.di + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch8s()));
		case 0o202: // [BP+SI]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.si + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch8s()));
		case 0o203: // [BP+DI]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.di + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch8s()));
		case 0o204: // [SI]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.si + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch8s()));
		case 0o205: // [DI]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.di + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch8s()));
		case 0o206: // [BP]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch8s()));
		case 0o207: // [BX]+disp16
			return this.write16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.fetch16() & 0xffff, fn.call(this, this.read16(seg, ea), this.fetch8s()));
		case 0o300: // AX
			return void(this.ax = fn.call(this, this.ax, this.fetch8s()));
		case 0o301: // CX
			return void(this.cx = fn.call(this, this.cx, this.fetch8s()));
		case 0o302: // DX
			return void(this.dx = fn.call(this, this.dx, this.fetch8s()));
		case 0o303: // BX
			return void(this.bx = fn.call(this, this.bx, this.fetch8s()));
		case 0o304: // SP
			return void(this.sp = fn.call(this, this.sp, this.fetch8s()));
		case 0o305: // BP
			return void(this.bp = fn.call(this, this.bp, this.fetch8s()));
		case 0o306: // SI
			return void(this.si = fn.call(this, this.si, this.fetch8s()));
		case 0o307: // DI
			return void(this.di = fn.call(this, this.di, this.fetch8s()));
		}
	}

	rop8(op, sego) {
		switch (op & 0o307) {
		case 0o000: // [BX+SI]
			return this.read8(sego >= 0 ? sego : this.ds, this.bx + this.si & 0xffff);
		case 0o001: // [BX+DI]
			return this.read8(sego >= 0 ? sego : this.ds, this.bx + this.di & 0xffff);
		case 0o002: // [BP+SI]
			return this.read8(sego >= 0 ? sego : this.ss, this.bp + this.si & 0xffff);
		case 0o003: // [BP+DI]
			return this.read8(sego >= 0 ? sego : this.ss, this.bp + this.di & 0xffff);
		case 0o004: // [SI]
			return this.read8(sego >= 0 ? sego : this.ds, this.si);
		case 0o005: // [DI]
			return this.read8(sego >= 0 ? sego : this.ds, this.di);
		case 0o006: // disp16
			return this.read8(sego >= 0 ? sego : this.ds, this.fetch16());
		case 0o007: // [BX]
			return this.read8(sego >= 0 ? sego : this.ds, this.bx);
		case 0o100: // [BX+SI]+disp8
			return this.read8(sego >= 0 ? sego : this.ds, this.bx + this.si + this.fetch8s() & 0xffff);
		case 0o101: // [BX+DI]+disp8
			return this.read8(sego >= 0 ? sego : this.ds, this.bx + this.di + this.fetch8s() & 0xffff);
		case 0o102: // [BP+SI]+disp8
			return this.read8(sego >= 0 ? sego : this.ss, this.bp + this.si + this.fetch8s() & 0xffff);
		case 0o103: // [BP+DI]+disp8
			return this.read8(sego >= 0 ? sego : this.ss, this.bp + this.di + this.fetch8s() & 0xffff);
		case 0o104: // [SI]+disp8
			return this.read8(sego >= 0 ? sego : this.ds, this.si + this.fetch8s() & 0xffff);
		case 0o105: // [DI]+disp8
			return this.read8(sego >= 0 ? sego : this.ds, this.di + this.fetch8s() & 0xffff);
		case 0o106: // [BP]+disp8
			return this.read8(sego >= 0 ? sego : this.ss, this.bp + this.fetch8s() & 0xffff);
		case 0o107: // [BX]+disp8
			return this.read8(sego >= 0 ? sego : this.ds, this.bx + this.fetch8s() & 0xffff);
		case 0o200: // [BX+SI]+disp16
			return this.read8(sego >= 0 ? sego : this.ds, this.bx + this.si + this.fetch16() & 0xffff);
		case 0o201: // [BX+DI]+disp16
			return this.read8(sego >= 0 ? sego : this.ds, this.bx + this.di + this.fetch16() & 0xffff);
		case 0o202: // [BP+SI]+disp16
			return this.read8(sego >= 0 ? sego : this.ss, this.bp + this.si + this.fetch16() & 0xffff);
		case 0o203: // [BP+DI]+disp16
			return this.read8(sego >= 0 ? sego : this.ss, this.bp + this.di + this.fetch16() & 0xffff);
		case 0o204: // [SI]+disp16
			return this.read8(sego >= 0 ? sego : this.ds, this.si + this.fetch16() & 0xffff);
		case 0o205: // [DI]+disp16
			return this.read8(sego >= 0 ? sego : this.ds, this.di + this.fetch16() & 0xffff);
		case 0o206: // [BP]+disp16
			return this.read8(sego >= 0 ? sego : this.ss, this.bp + this.fetch16() & 0xffff);
		case 0o207: // [BX]+disp16
			return this.read8(sego >= 0 ? sego : this.ds, this.bx + this.fetch16() & 0xffff);
		case 0o300: // AL
			return this.ax & 0xff;
		case 0o301: // CL
			return this.cx & 0xff;
		case 0o302: // DL
			return this.dx & 0xff;
		case 0o303: // BL
			return this.bx & 0xff;
		case 0o304: // AH
			return this.ax >>> 8;
		case 0o305: // CH
			return this.cx >>> 8;
		case 0o306: // DH
			return this.dx >>> 8;
		case 0o307: // BH
			return this.bx >>> 8;
		}
	}

	rop16(op, sego) {
		switch (op & 0o307) {
		case 0o000: // [BX+SI]
			return this.read16(sego >= 0 ? sego : this.ds, this.bx + this.si & 0xffff);
		case 0o001: // [BX+DI]
			return this.read16(sego >= 0 ? sego : this.ds, this.bx + this.di & 0xffff);
		case 0o002: // [BP+SI]
			return this.read16(sego >= 0 ? sego : this.ss, this.bp + this.si & 0xffff);
		case 0o003: // [BP+DI]
			return this.read16(sego >= 0 ? sego : this.ss, this.bp + this.di & 0xffff);
		case 0o004: // [SI]
			return this.read16(sego >= 0 ? sego : this.ds, this.si);
		case 0o005: // [DI]
			return this.read16(sego >= 0 ? sego : this.ds, this.di);
		case 0o006: // disp16
			return this.read16(sego >= 0 ? sego : this.ds, this.fetch16());
		case 0o007: // [BX]
			return this.read16(sego >= 0 ? sego : this.ds, this.bx);
		case 0o100: // [BX+SI]+disp8
			return this.read16(sego >= 0 ? sego : this.ds, this.bx + this.si + this.fetch8s() & 0xffff);
		case 0o101: // [BX+DI]+disp8
			return this.read16(sego >= 0 ? sego : this.ds, this.bx + this.di + this.fetch8s() & 0xffff);
		case 0o102: // [BP+SI]+disp8
			return this.read16(sego >= 0 ? sego : this.ss, this.bp + this.si + this.fetch8s() & 0xffff);
		case 0o103: // [BP+DI]+disp8
			return this.read16(sego >= 0 ? sego : this.ss, this.bp + this.di + this.fetch8s() & 0xffff);
		case 0o104: // [SI]+disp8
			return this.read16(sego >= 0 ? sego : this.ds, this.si + this.fetch8s() & 0xffff);
		case 0o105: // [DI]+disp8
			return this.read16(sego >= 0 ? sego : this.ds, this.di + this.fetch8s() & 0xffff);
		case 0o106: // [BP]+disp8
			return this.read16(sego >= 0 ? sego : this.ss, this.bp + this.fetch8s() & 0xffff);
		case 0o107: // [BX]+disp8
			return this.read16(sego >= 0 ? sego : this.ds, this.bx + this.fetch8s() & 0xffff);
		case 0o200: // [BX+SI]+disp16
			return this.read16(sego >= 0 ? sego : this.ds, this.bx + this.si + this.fetch16() & 0xffff);
		case 0o201: // [BX+DI]+disp16
			return this.read16(sego >= 0 ? sego : this.ds, this.bx + this.di + this.fetch16() & 0xffff);
		case 0o202: // [BP+SI]+disp16
			return this.read16(sego >= 0 ? sego : this.ss, this.bp + this.si + this.fetch16() & 0xffff);
		case 0o203: // [BP+DI]+disp16
			return this.read16(sego >= 0 ? sego : this.ss, this.bp + this.di + this.fetch16() & 0xffff);
		case 0o204: // [SI]+disp16
			return this.read16(sego >= 0 ? sego : this.ds, this.si + this.fetch16() & 0xffff);
		case 0o205: // [DI]+disp16
			return this.read16(sego >= 0 ? sego : this.ds, this.di + this.fetch16() & 0xffff);
		case 0o206: // [BP]+disp16
			return this.read16(sego >= 0 ? sego : this.ss, this.bp + this.fetch16() & 0xffff);
		case 0o207: // [BX]+disp16
			return this.read16(sego >= 0 ? sego : this.ds, this.bx + this.fetch16() & 0xffff);
		case 0o300: // AX
			return this.ax;
		case 0o301: // CX
			return this.cx;
		case 0o302: // DX
			return this.dx;
		case 0o303: // BX
			return this.bx;
		case 0o304: // SP
			return this.sp;
		case 0o305: // BP
			return this.bp;
		case 0o306: // SI
			return this.si;
		case 0o307: // DI
			return this.di;
		}
	}

	rop32(op, sego) {
		let seg, ea;

		switch (op & 0o307) {
		case 0o000: // [BX+SI]
			return [this.read16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.si & 0xffff), this.read16(seg, ea + 2 & 0xffff)];
		case 0o001: // [BX+DI]
			return [this.read16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.di & 0xffff), this.read16(seg, ea + 2 & 0xffff)];
		case 0o002: // [BP+SI]
			return [this.read16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.si & 0xffff), this.read16(seg, ea + 2 & 0xffff)];
		case 0o003: // [BP+DI]
			return [this.read16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.di & 0xffff), this.read16(seg, ea + 2 & 0xffff)];
		case 0o004: // [SI]
			return [this.read16(seg = sego >= 0 ? sego : this.ds, ea = this.si), this.read16(seg, ea + 2 & 0xffff)];
		case 0o005: // [DI]
			return [this.read16(seg = sego >= 0 ? sego : this.ds, ea = this.di), this.read16(seg, ea + 2 & 0xffff)];
		case 0o006: // disp16
			return [this.read16(seg = sego >= 0 ? sego : this.ds, ea = this.fetch16()), this.read16(seg, ea + 2 & 0xffff)];
		case 0o007: // [BX]
			return [this.read16(seg = sego >= 0 ? sego : this.ds, ea = this.bx), this.read16(seg, ea + 2 & 0xffff)];
		case 0o100: // [BX+SI]+disp8
			return [this.read16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.si + this.fetch8s() & 0xffff), this.read16(seg, ea + 2 & 0xffff)];
		case 0o101: // [BX+DI]+disp8
			return [this.read16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.di + this.fetch8s() & 0xffff), this.read16(seg, ea + 2 & 0xffff)];
		case 0o102: // [BP+SI]+disp8
			return [this.read16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.si + this.fetch8s() & 0xffff), this.read16(seg, ea + 2 & 0xffff)];
		case 0o103: // [BP+DI]+disp8
			return [this.read16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.di + this.fetch8s() & 0xffff), this.read16(seg, ea + 2 & 0xffff)];
		case 0o104: // [SI]+disp8
			return [this.read16(seg = sego >= 0 ? sego : this.ds, ea = this.si + this.fetch8s() & 0xffff), this.read16(seg, ea + 2 & 0xffff)];
		case 0o105: // [DI]+disp8
			return [this.read16(seg = sego >= 0 ? sego : this.ds, ea = this.di + this.fetch8s() & 0xffff), this.read16(seg, ea + 2 & 0xffff)];
		case 0o106: // [BP]+disp8
			return [this.read16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.fetch8s() & 0xffff), this.read16(seg, ea + 2 & 0xffff)];
		case 0o107: // [BX]+disp8
			return [this.read16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.fetch8s() & 0xffff), this.read16(seg, ea + 2 & 0xffff)];
		case 0o200: // [BX+SI]+disp16
			return [this.read16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.si + this.fetch16() & 0xffff), this.read16(seg, ea + 2 & 0xffff)];
		case 0o201: // [BX+DI]+disp16
			return [this.read16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.di + this.fetch16() & 0xffff), this.read16(seg, ea + 2 & 0xffff)];
		case 0o202: // [BP+SI]+disp16
			return [this.read16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.si + this.fetch16() & 0xffff), this.read16(seg, ea + 2 & 0xffff)];
		case 0o203: // [BP+DI]+disp16
			return [this.read16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.di + this.fetch16() & 0xffff), this.read16(seg, ea + 2 & 0xffff)];
		case 0o204: // [SI]+disp16
			return [this.read16(seg = sego >= 0 ? sego : this.ds, ea = this.si + this.fetch16() & 0xffff), this.read16(seg, ea + 2 & 0xffff)];
		case 0o205: // [DI]+disp16
			return [this.read16(seg = sego >= 0 ? sego : this.ds, ea = this.di + this.fetch16() & 0xffff), this.read16(seg, ea + 2 & 0xffff)];
		case 0o206: // [BP]+disp16
			return [this.read16(seg = sego >= 0 ? sego : this.ss, ea = this.bp + this.fetch16() & 0xffff), this.read16(seg, ea + 2 & 0xffff)];
		case 0o207: // [BX]+disp16
			return [this.read16(seg = sego >= 0 ? sego : this.ds, ea = this.bx + this.fetch16() & 0xffff), this.read16(seg, ea + 2 & 0xffff)];
		}
	}

	rop8i(op, sego, fn) {
		switch (op & 0o307) {
		case 0o000: // [BX+SI]
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ds, this.bx + this.si & 0xffff), this.fetch8());
		case 0o001: // [BX+DI]
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ds, this.bx + this.di & 0xffff), this.fetch8());
		case 0o002: // [BP+SI]
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ss, this.bp + this.si & 0xffff), this.fetch8());
		case 0o003: // [BP+DI]
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ss, this.bp + this.di & 0xffff), this.fetch8());
		case 0o004: // [SI]
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ds, this.si), this.fetch8());
		case 0o005: // [DI]
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ds, this.di), this.fetch8());
		case 0o006: // disp16
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ds, this.fetch16()), this.fetch8());
		case 0o007: // [BX]
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ds, this.bx), this.fetch8());
		case 0o100: // [BX+SI]+disp8
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ds, this.bx + this.si + this.fetch8s() & 0xffff), this.fetch8());
		case 0o101: // [BX+DI]+disp8
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ds, this.bx + this.di + this.fetch8s() & 0xffff), this.fetch8());
		case 0o102: // [BP+SI]+disp8
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ss, this.bp + this.si + this.fetch8s() & 0xffff), this.fetch8());
		case 0o103: // [BP+DI]+disp8
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ss, this.bp + this.di + this.fetch8s() & 0xffff), this.fetch8());
		case 0o104: // [SI]+disp8
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ds, this.si + this.fetch8s() & 0xffff), this.fetch8());
		case 0o105: // [DI]+disp8
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ds, this.di + this.fetch8s() & 0xffff), this.fetch8());
		case 0o106: // [BP]+disp8
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ss, this.bp + this.fetch8s() & 0xffff), this.fetch8());
		case 0o107: // [BX]+disp8
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ds, this.bx + this.fetch8s() & 0xffff), this.fetch8());
		case 0o200: // [BX+SI]+disp16
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ds, this.bx + this.si + this.fetch16() & 0xffff), this.fetch8());
		case 0o201: // [BX+DI]+disp16
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ds, this.bx + this.di + this.fetch16() & 0xffff), this.fetch8());
		case 0o202: // [BP+SI]+disp16
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ss, this.bp + this.si + this.fetch16() & 0xffff), this.fetch8());
		case 0o203: // [BP+DI]+disp16
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ss, this.bp + this.di + this.fetch16() & 0xffff), this.fetch8());
		case 0o204: // [SI]+disp16
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ds, this.si + this.fetch16() & 0xffff), this.fetch8());
		case 0o205: // [DI]+disp16
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ds, this.di + this.fetch16() & 0xffff), this.fetch8());
		case 0o206: // [BP]+disp16
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ss, this.bp + this.fetch16() & 0xffff), this.fetch8());
		case 0o207: // [BX]+disp16
			return fn.call(this, this.read8(sego >= 0 ? sego : this.ds, this.bx + this.fetch16() & 0xffff), this.fetch8());
		case 0o300: // AL
			return fn.call(this, this.ax & 0xff, this.fetch8());
		case 0o301: // CL
			return fn.call(this, this.cx & 0xff, this.fetch8());
		case 0o302: // DL
			return fn.call(this, this.dx & 0xff, this.fetch8());
		case 0o303: // BL
			return fn.call(this, this.bx & 0xff, this.fetch8());
		case 0o304: // AH
			return fn.call(this, this.ax >>> 8, this.fetch8());
		case 0o305: // CH
			return fn.call(this, this.cx >>> 8, this.fetch8());
		case 0o306: // DH
			return fn.call(this, this.dx >>> 8, this.fetch8());
		case 0o307: // BH
			return fn.call(this, this.bx >>> 8, this.fetch8());
		}
	}

	rop16i(op, sego, fn) {
		switch (op & 0o307) {
		case 0o000: // [BX+SI]
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.bx + this.si & 0xffff), this.fetch16());
		case 0o001: // [BX+DI]
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.bx + this.di & 0xffff), this.fetch16());
		case 0o002: // [BP+SI]
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ss, this.bp + this.si & 0xffff), this.fetch16());
		case 0o003: // [BP+DI]
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ss, this.bp + this.di & 0xffff), this.fetch16());
		case 0o004: // [SI]
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.si), this.fetch16());
		case 0o005: // [DI]
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.di), this.fetch16());
		case 0o006: // disp16
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.fetch16()), this.fetch16());
		case 0o007: // [BX]
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.bx), this.fetch16());
		case 0o100: // [BX+SI]+disp8
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.bx + this.si + this.fetch8s() & 0xffff), this.fetch16());
		case 0o101: // [BX+DI]+disp8
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.bx + this.di + this.fetch8s() & 0xffff), this.fetch16());
		case 0o102: // [BP+SI]+disp8
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ss, this.bp + this.si + this.fetch8s() & 0xffff), this.fetch16());
		case 0o103: // [BP+DI]+disp8
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ss, this.bp + this.di + this.fetch8s() & 0xffff), this.fetch16());
		case 0o104: // [SI]+disp8
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.si + this.fetch8s() & 0xffff), this.fetch16());
		case 0o105: // [DI]+disp8
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.di + this.fetch8s() & 0xffff), this.fetch16());
		case 0o106: // [BP]+disp8
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ss, this.bp + this.fetch8s() & 0xffff), this.fetch16());
		case 0o107: // [BX]+disp8
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.bx + this.fetch8s() & 0xffff), this.fetch16());
		case 0o200: // [BX+SI]+disp16
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.bx + this.si + this.fetch16() & 0xffff), this.fetch16());
		case 0o201: // [BX+DI]+disp16
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.bx + this.di + this.fetch16() & 0xffff), this.fetch16());
		case 0o202: // [BP+SI]+disp16
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ss, this.bp + this.si + this.fetch16() & 0xffff), this.fetch16());
		case 0o203: // [BP+DI]+disp16
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ss, this.bp + this.di + this.fetch16() & 0xffff), this.fetch16());
		case 0o204: // [SI]+disp16
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.si + this.fetch16() & 0xffff), this.fetch16());
		case 0o205: // [DI]+disp16
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.di + this.fetch16() & 0xffff), this.fetch16());
		case 0o206: // [BP]+disp16
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ss, this.bp + this.fetch16() & 0xffff), this.fetch16());
		case 0o207: // [BX]+disp16
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.bx + this.fetch16() & 0xffff), this.fetch16());
		case 0o300: // AX
			return fn.call(this, this.ax, this.fetch16());
		case 0o301: // CX
			return fn.call(this, this.cx, this.fetch16());
		case 0o302: // DX
			return fn.call(this, this.dx, this.fetch16());
		case 0o303: // BX
			return fn.call(this, this.bx, this.fetch16());
		case 0o304: // SP
			return fn.call(this, this.sp, this.fetch16());
		case 0o305: // BP
			return fn.call(this, this.bp, this.fetch16());
		case 0o306: // SI
			return fn.call(this, this.si, this.fetch16());
		case 0o307: // DI
			return fn.call(this, this.di, this.fetch16());
		}
	}

	rop16is(op, sego, fn) {
		switch (op & 0o307) {
		case 0o000: // [BX+SI]
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.bx + this.si & 0xffff), this.fetch8s());
		case 0o001: // [BX+DI]
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.bx + this.di & 0xffff), this.fetch8s());
		case 0o002: // [BP+SI]
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ss, this.bp + this.si & 0xffff), this.fetch8s());
		case 0o003: // [BP+DI]
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ss, this.bp + this.di & 0xffff), this.fetch8s());
		case 0o004: // [SI]
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.si), this.fetch8s());
		case 0o005: // [DI]
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.di), this.fetch8s());
		case 0o006: // disp16
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.fetch16()), this.fetch8s());
		case 0o007: // [BX]
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.bx), this.fetch8s());
		case 0o100: // [BX+SI]+disp8
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.bx + this.si + this.fetch8s() & 0xffff), this.fetch8s());
		case 0o101: // [BX+DI]+disp8
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.bx + this.di + this.fetch8s() & 0xffff), this.fetch8s());
		case 0o102: // [BP+SI]+disp8
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ss, this.bp + this.si + this.fetch8s() & 0xffff), this.fetch8s());
		case 0o103: // [BP+DI]+disp8
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ss, this.bp + this.di + this.fetch8s() & 0xffff), this.fetch8s());
		case 0o104: // [SI]+disp8
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.si + this.fetch8s() & 0xffff), this.fetch8s());
		case 0o105: // [DI]+disp8
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.di + this.fetch8s() & 0xffff), this.fetch8s());
		case 0o106: // [BP]+disp8
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ss, this.bp + this.fetch8s() & 0xffff), this.fetch8s());
		case 0o107: // [BX]+disp8
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.bx + this.fetch8s() & 0xffff), this.fetch8s());
		case 0o200: // [BX+SI]+disp16
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.bx + this.si + this.fetch16() & 0xffff), this.fetch8s());
		case 0o201: // [BX+DI]+disp16
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.bx + this.di + this.fetch16() & 0xffff), this.fetch8s());
		case 0o202: // [BP+SI]+disp16
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ss, this.bp + this.si + this.fetch16() & 0xffff), this.fetch8s());
		case 0o203: // [BP+DI]+disp16
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ss, this.bp + this.di + this.fetch16() & 0xffff), this.fetch8s());
		case 0o204: // [SI]+disp16
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.si + this.fetch16() & 0xffff), this.fetch8s());
		case 0o205: // [DI]+disp16
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.di + this.fetch16() & 0xffff), this.fetch8s());
		case 0o206: // [BP]+disp16
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ss, this.bp + this.fetch16() & 0xffff), this.fetch8s());
		case 0o207: // [BX]+disp16
			return fn.call(this, this.read16(sego >= 0 ? sego : this.ds, this.bx + this.fetch16() & 0xffff), this.fetch8s());
		case 0o300: // AX
			return fn.call(this, this.ax, this.fetch8s());
		case 0o301: // CX
			return fn.call(this, this.cx, this.fetch8s());
		case 0o302: // DX
			return fn.call(this, this.dx, this.fetch8s());
		case 0o303: // BX
			return fn.call(this, this.bx, this.fetch8s());
		case 0o304: // SP
			return fn.call(this, this.sp, this.fetch8s());
		case 0o305: // BP
			return fn.call(this, this.bp, this.fetch8s());
		case 0o306: // SI
			return fn.call(this, this.si, this.fetch8s());
		case 0o307: // DI
			return fn.call(this, this.di, this.fetch8s());
		}
	}

	wop8(op, sego, src) {
		switch (op & 0o307) {
		case 0o000: // [BX+SI]
			return this.write8(sego >= 0 ? sego : this.ds, this.bx + this.si & 0xffff, src);
		case 0o001: // [BX+DI]
			return this.write8(sego >= 0 ? sego : this.ds, this.bx + this.di & 0xffff, src);
		case 0o002: // [BP+SI]
			return this.write8(sego >= 0 ? sego : this.ss, this.bp + this.si & 0xffff, src);
		case 0o003: // [BP+DI]
			return this.write8(sego >= 0 ? sego : this.ss, this.bp + this.di & 0xffff, src);
		case 0o004: // [SI]
			return this.write8(sego >= 0 ? sego : this.ds, this.si, src);
		case 0o005: // [DI]
			return this.write8(sego >= 0 ? sego : this.ds, this.di, src);
		case 0o006: // disp16
			return this.write8(sego >= 0 ? sego : this.ds, this.fetch16(), src);
		case 0o007: // [BX]
			return this.write8(sego >= 0 ? sego : this.ds, this.bx, src);
		case 0o100: // [BX+SI]+disp8
			return this.write8(sego >= 0 ? sego : this.ds, this.bx + this.si + this.fetch8s() & 0xffff, src);
		case 0o101: // [BX+DI]+disp8
			return this.write8(sego >= 0 ? sego : this.ds, this.bx + this.di + this.fetch8s() & 0xffff, src);
		case 0o102: // [BP+SI]+disp8
			return this.write8(sego >= 0 ? sego : this.ss, this.bp + this.si + this.fetch8s() & 0xffff, src);
		case 0o103: // [BP+DI]+disp8
			return this.write8(sego >= 0 ? sego : this.ss, this.bp + this.di + this.fetch8s() & 0xffff, src);
		case 0o104: // [SI]+disp8
			return this.write8(sego >= 0 ? sego : this.ds, this.si + this.fetch8s() & 0xffff, src);
		case 0o105: // [DI]+disp8
			return this.write8(sego >= 0 ? sego : this.ds, this.di + this.fetch8s() & 0xffff, src);
		case 0o106: // [BP]+disp8
			return this.write8(sego >= 0 ? sego : this.ss, this.bp + this.fetch8s() & 0xffff, src);
		case 0o107: // [BX]+disp8
			return this.write8(sego >= 0 ? sego : this.ds, this.bx + this.fetch8s() & 0xffff, src);
		case 0o200: // [BX+SI]+disp16
			return this.write8(sego >= 0 ? sego : this.ds, this.bx + this.si + this.fetch16() & 0xffff, src);
		case 0o201: // [BX+DI]+disp16
			return this.write8(sego >= 0 ? sego : this.ds, this.bx + this.di + this.fetch16() & 0xffff, src);
		case 0o202: // [BP+SI]+disp16
			return this.write8(sego >= 0 ? sego : this.ss, this.bp + this.si + this.fetch16() & 0xffff, src);
		case 0o203: // [BP+DI]+disp16
			return this.write8(sego >= 0 ? sego : this.ss, this.bp + this.di + this.fetch16() & 0xffff, src);
		case 0o204: // [SI]+disp16
			return this.write8(sego >= 0 ? sego : this.ds, this.si + this.fetch16() & 0xffff, src);
		case 0o205: // [DI]+disp16
			return this.write8(sego >= 0 ? sego : this.ds, this.di + this.fetch16() & 0xffff, src);
		case 0o206: // [BP]+disp16
			return this.write8(sego >= 0 ? sego : this.ss, this.bp + this.fetch16() & 0xffff, src);
		case 0o207: // [BX]+disp16
			return this.write8(sego >= 0 ? sego : this.ds, this.bx + this.fetch16() & 0xffff, src);
		case 0o300: // AL
			return void(this.ax = this.ax & 0xff00 | src);
		case 0o301: // CL
			return void(this.cx = this.cx & 0xff00 | src);
		case 0o302: // DL
			return void(this.dx = this.dx & 0xff00 | src);
		case 0o303: // BL
			return void(this.bx = this.bx & 0xff00 | src);
		case 0o304: // AH
			return void(this.ax = this.ax & 0xff | src << 8);
		case 0o305: // CH
			return void(this.cx = this.cx & 0xff | src << 8);
		case 0o306: // DH
			return void(this.dx = this.dx & 0xff | src << 8);
		case 0o307: // BH
			return void(this.bx = this.bx & 0xff | src << 8);
		}
	}

	wop16(op, sego, src) {
		switch (op & 0o307) {
		case 0o000: // [BX+SI]
			return this.write16(sego >= 0 ? sego : this.ds, this.bx + this.si & 0xffff, src);
		case 0o001: // [BX+DI]
			return this.write16(sego >= 0 ? sego : this.ds, this.bx + this.di & 0xffff, src);
		case 0o002: // [BP+SI]
			return this.write16(sego >= 0 ? sego : this.ss, this.bp + this.si & 0xffff, src);
		case 0o003: // [BP+DI]
			return this.write16(sego >= 0 ? sego : this.ss, this.bp + this.di & 0xffff, src);
		case 0o004: // [SI]
			return this.write16(sego >= 0 ? sego : this.ds, this.si, src);
		case 0o005: // [DI]
			return this.write16(sego >= 0 ? sego : this.ds, this.di, src);
		case 0o006: // disp16
			return this.write16(sego >= 0 ? sego : this.ds, this.fetch16(), src);
		case 0o007: // [BX]
			return this.write16(sego >= 0 ? sego : this.ds, this.bx, src);
		case 0o100: // [BX+SI]+disp8
			return this.write16(sego >= 0 ? sego : this.ds, this.bx + this.si + this.fetch8s() & 0xffff, src);
		case 0o101: // [BX+DI]+disp8
			return this.write16(sego >= 0 ? sego : this.ds, this.bx + this.di + this.fetch8s() & 0xffff, src);
		case 0o102: // [BP+SI]+disp8
			return this.write16(sego >= 0 ? sego : this.ss, this.bp + this.si + this.fetch8s() & 0xffff, src);
		case 0o103: // [BP+DI]+disp8
			return this.write16(sego >= 0 ? sego : this.ss, this.bp + this.di + this.fetch8s() & 0xffff, src);
		case 0o104: // [SI]+disp8
			return this.write16(sego >= 0 ? sego : this.ds, this.si + this.fetch8s() & 0xffff, src);
		case 0o105: // [DI]+disp8
			return this.write16(sego >= 0 ? sego : this.ds, this.di + this.fetch8s() & 0xffff, src);
		case 0o106: // [BP]+disp8
			return this.write16(sego >= 0 ? sego : this.ss, this.bp + this.fetch8s() & 0xffff, src);
		case 0o107: // [BX]+disp8
			return this.write16(sego >= 0 ? sego : this.ds, this.bx + this.fetch8s() & 0xffff, src);
		case 0o200: // [BX+SI]+disp16
			return this.write16(sego >= 0 ? sego : this.ds, this.bx + this.si + this.fetch16() & 0xffff, src);
		case 0o201: // [BX+DI]+disp16
			return this.write16(sego >= 0 ? sego : this.ds, this.bx + this.di + this.fetch16() & 0xffff, src);
		case 0o202: // [BP+SI]+disp16
			return this.write16(sego >= 0 ? sego : this.ss, this.bp + this.si + this.fetch16() & 0xffff, src);
		case 0o203: // [BP+DI]+disp16
			return this.write16(sego >= 0 ? sego : this.ss, this.bp + this.di + this.fetch16() & 0xffff, src);
		case 0o204: // [SI]+disp16
			return this.write16(sego >= 0 ? sego : this.ds, this.si + this.fetch16() & 0xffff, src);
		case 0o205: // [DI]+disp16
			return this.write16(sego >= 0 ? sego : this.ds, this.di + this.fetch16() & 0xffff, src);
		case 0o206: // [BP]+disp16
			return this.write16(sego >= 0 ? sego : this.ss, this.bp + this.fetch16() & 0xffff, src);
		case 0o207: // [BX]+disp16
			return this.write16(sego >= 0 ? sego : this.ds, this.bx + this.fetch16() & 0xffff, src);
		case 0o300: // AX
			return void(this.ax = src);
		case 0o301: // CX
			return void(this.cx = src);
		case 0o302: // DX
			return void(this.dx = src);
		case 0o303: // BX
			return void(this.bx = src);
		case 0o304: // SP
			return void(this.sp = src);
		case 0o305: // BP
			return void(this.bp = src);
		case 0o306: // SI
			return void(this.si = src);
		case 0o307: // DI
			return void(this.di = src);
		}
	}

	wop8i(op, sego) {
		switch (op & 0o307) {
		case 0o000: // MOV [BX+SI],imm8
			return this.write8(sego >= 0 ? sego : this.ds, this.bx + this.si & 0xffff, this.fetch8());
		case 0o001: // MOV [BX+DI],imm8
			return this.write8(sego >= 0 ? sego : this.ds, this.bx + this.di & 0xffff, this.fetch8());
		case 0o002: // MOV [BP+SI],imm8
			return this.write8(sego >= 0 ? sego : this.ss, this.bp + this.si & 0xffff, this.fetch8());
		case 0o003: // MOV [BP+DI],imm8
			return this.write8(sego >= 0 ? sego : this.ss, this.bp + this.di & 0xffff, this.fetch8());
		case 0o004: // MOV [SI],imm8
			return this.write8(sego >= 0 ? sego : this.ds, this.si, this.fetch8());
		case 0o005: // MOV [DI],imm8
			return this.write8(sego >= 0 ? sego : this.ds, this.di, this.fetch8());
		case 0o006: // MOV disp16,imm8
			return this.write8(sego >= 0 ? sego : this.ds, this.fetch16(), this.fetch8());
		case 0o007: // MOV [BX],imm8
			return this.write8(sego >= 0 ? sego : this.ds, this.bx, this.fetch8());
		case 0o100: // MOV [BX+SI]+disp8,imm8
			return this.write8(sego >= 0 ? sego : this.ds, this.bx + this.si + this.fetch8s() & 0xffff, this.fetch8());
		case 0o101: // MOV [BX+DI]+disp8,imm8
			return this.write8(sego >= 0 ? sego : this.ds, this.bx + this.di + this.fetch8s() & 0xffff, this.fetch8());
		case 0o102: // MOV [BP+SI]+disp8,imm8
			return this.write8(sego >= 0 ? sego : this.ss, this.bp + this.si + this.fetch8s() & 0xffff, this.fetch8());
		case 0o103: // MOV [BP+DI]+disp8,imm8
			return this.write8(sego >= 0 ? sego : this.ss, this.bp + this.di + this.fetch8s() & 0xffff, this.fetch8());
		case 0o104: // MOV [SI]+disp8,imm8
			return this.write8(sego >= 0 ? sego : this.ds, this.si + this.fetch8s() & 0xffff, this.fetch8());
		case 0o105: // MOV [DI]+disp8,imm8
			return this.write8(sego >= 0 ? sego : this.ds, this.di + this.fetch8s() & 0xffff, this.fetch8());
		case 0o106: // MOV [BP]+disp8,imm8
			return this.write8(sego >= 0 ? sego : this.ss, this.bp + this.fetch8s() & 0xffff, this.fetch8());
		case 0o107: // MOV [BX]+disp8,imm8
			return this.write8(sego >= 0 ? sego : this.ds, this.bx + this.fetch8s() & 0xffff, this.fetch8());
		case 0o200: // MOV [BX+SI]+disp16,imm8
			return this.write8(sego >= 0 ? sego : this.ds, this.bx + this.si + this.fetch16() & 0xffff, this.fetch8());
		case 0o201: // MOV [BX+DI]+disp16,imm8
			return this.write8(sego >= 0 ? sego : this.ds, this.bx + this.di + this.fetch16() & 0xffff, this.fetch8());
		case 0o202: // MOV [BP+SI]+disp16,imm8
			return this.write8(sego >= 0 ? sego : this.ss, this.bp + this.si + this.fetch16() & 0xffff, this.fetch8());
		case 0o203: // MOV [BP+DI]+disp16,imm8
			return this.write8(sego >= 0 ? sego : this.ss, this.bp + this.di + this.fetch16() & 0xffff, this.fetch8());
		case 0o204: // MOV [SI]+disp16,imm8
			return this.write8(sego >= 0 ? sego : this.ds, this.si + this.fetch16() & 0xffff, this.fetch8());
		case 0o205: // MOV [DI]+disp16,imm8
			return this.write8(sego >= 0 ? sego : this.ds, this.di + this.fetch16() & 0xffff, this.fetch8());
		case 0o206: // MOV [BP]+disp16,imm8
			return this.write8(sego >= 0 ? sego : this.ss, this.bp + this.fetch16() & 0xffff, this.fetch8());
		case 0o207: // MOV [BX]+disp16,imm8
			return this.write8(sego >= 0 ? sego : this.ds, this.bx + this.fetch16() & 0xffff, this.fetch8());
		case 0o300: // MOV AL,imm8
			return void(this.ax = this.ax & 0xff00 | this.fetch8());
		case 0o301: // MOV CL,imm8
			return void(this.cx = this.cx & 0xff00 | this.fetch8());
		case 0o302: // MOV DL,imm8
			return void(this.dx = this.dx & 0xff00 | this.fetch8());
		case 0o303: // MOV BL,imm8
			return void(this.bx = this.bx & 0xff00 | this.fetch8());
		case 0o304: // MOV AH,imm8
			return void(this.ax = this.ax & 0xff | this.fetch8() << 8);
		case 0o305: // MOV CH,imm8
			return void(this.cx = this.cx & 0xff | this.fetch8() << 8);
		case 0o306: // MOV DH,imm8
			return void(this.dx = this.dx & 0xff | this.fetch8() << 8);
		case 0o307: // MOV BH,imm8
			return void(this.bx = this.bx & 0xff | this.fetch8() << 8);
		}
	}

	wop16i(op, sego) {
		switch (op & 0o307) {
		case 0o000: // MOV [BX+SI],imm16
			return this.write16(sego >= 0 ? sego : this.ds, this.bx + this.si & 0xffff, this.fetch16());
		case 0o001: // MOV [BX+DI],imm16
			return this.write16(sego >= 0 ? sego : this.ds, this.bx + this.di & 0xffff, this.fetch16());
		case 0o002: // MOV [BP+SI],imm16
			return this.write16(sego >= 0 ? sego : this.ss, this.bp + this.si & 0xffff, this.fetch16());
		case 0o003: // MOV [BP+DI],imm16
			return this.write16(sego >= 0 ? sego : this.ss, this.bp + this.di & 0xffff, this.fetch16());
		case 0o004: // MOV [SI],imm16
			return this.write16(sego >= 0 ? sego : this.ds, this.si, this.fetch16());
		case 0o005: // MOV [DI],imm16
			return this.write16(sego >= 0 ? sego : this.ds, this.di, this.fetch16());
		case 0o006: // MOV disp16,imm16
			return this.write16(sego >= 0 ? sego : this.ds, this.fetch16(), this.fetch16());
		case 0o007: // MOV [BX],imm16
			return this.write16(sego >= 0 ? sego : this.ds, this.bx, this.fetch16());
		case 0o100: // MOV [BX+SI]+disp8,imm16
			return this.write16(sego >= 0 ? sego : this.ds, this.bx + this.si + this.fetch8s() & 0xffff, this.fetch16());
		case 0o101: // MOV [BX+DI]+disp8,imm16
			return this.write16(sego >= 0 ? sego : this.ds, this.bx + this.di + this.fetch8s() & 0xffff, this.fetch16());
		case 0o102: // MOV [BP+SI]+disp8,imm16
			return this.write16(sego >= 0 ? sego : this.ss, this.bp + this.si + this.fetch8s() & 0xffff, this.fetch16());
		case 0o103: // MOV [BP+DI]+disp8,imm16
			return this.write16(sego >= 0 ? sego : this.ss, this.bp + this.di + this.fetch8s() & 0xffff, this.fetch16());
		case 0o104: // MOV [SI]+disp8,imm16
			return this.write16(sego >= 0 ? sego : this.ds, this.si + this.fetch8s() & 0xffff, this.fetch16());
		case 0o105: // MOV [DI]+disp8,imm16
			return this.write16(sego >= 0 ? sego : this.ds, this.di + this.fetch8s() & 0xffff, this.fetch16());
		case 0o106: // MOV [BP]+disp8,imm16
			return this.write16(sego >= 0 ? sego : this.ss, this.bp + this.fetch8s() & 0xffff, this.fetch16());
		case 0o107: // MOV [BX]+disp8,imm16
			return this.write16(sego >= 0 ? sego : this.ds, this.bx + this.fetch8s() & 0xffff, this.fetch16());
		case 0o200: // MOV [BX+SI]+disp16,imm16
			return this.write16(sego >= 0 ? sego : this.ds, this.bx + this.si + this.fetch16() & 0xffff, this.fetch16());
		case 0o201: // MOV [BX+DI]+disp16,imm16
			return this.write16(sego >= 0 ? sego : this.ds, this.bx + this.di + this.fetch16() & 0xffff, this.fetch16());
		case 0o202: // MOV [BP+SI]+disp16,imm16
			return this.write16(sego >= 0 ? sego : this.ss, this.bp + this.si + this.fetch16() & 0xffff, this.fetch16());
		case 0o203: // MOV [BP+DI]+disp16,imm16
			return this.write16(sego >= 0 ? sego : this.ss, this.bp + this.di + this.fetch16() & 0xffff, this.fetch16());
		case 0o204: // MOV [SI]+disp16,imm16
			return this.write16(sego >= 0 ? sego : this.ds, this.si + this.fetch16() & 0xffff, this.fetch16());
		case 0o205: // MOV [DI]+disp16,imm16
			return this.write16(sego >= 0 ? sego : this.ds, this.di + this.fetch16() & 0xffff, this.fetch16());
		case 0o206: // MOV [BP]+disp16,imm16
			return this.write16(sego >= 0 ? sego : this.ss, this.bp + this.fetch16() & 0xffff, this.fetch16());
		case 0o207: // MOV [BX]+disp16,imm16
			return this.write16(sego >= 0 ? sego : this.ds, this.bx + this.fetch16() & 0xffff, this.fetch16());
		case 0o300: // MOV AX,imm16
			return void(this.ax = this.fetch16());
		case 0o301: // MOV CX,imm16
			return void(this.cx = this.fetch16());
		case 0o302: // MOV DX,imm16
			return void(this.dx = this.fetch16());
		case 0o303: // MOV BX,imm16
			return void(this.bx = this.fetch16());
		case 0o304: // MOV SP,imm16
			return void(this.sp = this.fetch16());
		case 0o305: // MOV BP,imm16
			return void(this.bp = this.fetch16());
		case 0o306: // MOV SI,imm16
			return void(this.si = this.fetch16());
		case 0o307: // MOV DI,imm16
			return void(this.di = this.fetch16());
		}
	}

	push(...args) {
		for (let i = 0; i < args.length; i++)
			this.write16(this.ss, this.sp = this.sp - 2 & 0xffff, args[i]);
	}

	pop(n = 1) {
		if (n === 1) {
			const data = this.read16(this.ss, this.sp);
			this.sp = this.sp + 2 & 0xffff;
			return data;
		}
		const data = [];
		for (let i = 0; i < n; i++) {
			data.push(this.read16(this.ss, this.sp));
			this.sp = this.sp + 2 & 0xffff;
		}
		return data;
	}

	add8(dst, src) {
		const r = dst + src & 0xff, o = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		this.flags = this.flags & ~0x8d5 | o << 4 & 0x800 | r & 0x80 | !r << 6 | c << 1 & 0x10 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4 | c >>> 7 & 1;
		return r;
	}

	add16(dst, src) {
		const r = dst + src & 0xffff, o = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		this.flags = this.flags & ~0x8d5 | o >>> 4 & 0x800 | r >>> 8 & 0x80 | !r << 6 | c << 1 & 0x10 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4 | c >>> 15 & 1;
		return r;
	}

	or8(dst, src) {
		const r = (dst | src) & 0xff;
		this.flags = this.flags & ~0x8c5 | r & 0x80 | !r << 6 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4;
		return r;
	}

	or16(dst, src) {
		const r = (dst | src) & 0xffff;
		this.flags = this.flags & ~0x8c5 | r >>> 8 & 0x80 | !r << 6 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4;
		return r;
	}

	adc8(dst, src) {
		const r = dst + src + (this.flags & 1) & 0xff, o = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		this.flags = this.flags & ~0x8d5 | o << 4 & 0x800 | r & 0x80 | !r << 6 | c << 1 & 0x10 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4 | c >>> 7 & 1;
		return r;
	}

	adc16(dst, src) {
		const r = dst + src + (this.flags & 1) & 0xffff, o = dst & src & ~r | ~dst & ~src & r, c = dst & src | src & ~r | ~r & dst;
		this.flags = this.flags & ~0x8d5 | o >>> 4 & 0x800 | r >>> 8 & 0x80 | !r << 6 | c << 1 & 0x10 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4 | c >>> 15 & 1;
		return r;
	}

	sbb8(dst, src) {
		const r = dst - src - (this.flags & 1) & 0xff, o = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		this.flags = this.flags & ~0x8d5 | o << 4 & 0x800 | r & 0x80 | !r << 6 | c << 1 & 0x10 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4 | c >>> 7 & 1;
		return r;
	}

	sbb16(dst, src) {
		const r = dst - src - (this.flags & 1) & 0xffff, o = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		this.flags = this.flags & ~0x8d5 | o >>> 4 & 0x800 | r >>> 8 & 0x80 | !r << 6 | c << 1 & 0x10 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4 | c >>> 15 & 1;
		return r;
	}

	and8(dst, src) {
		const r = dst & src & 0xff;
		this.flags = this.flags & ~0x8c5 | r & 0x80 | !r << 6 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4;
		return r;
	}

	and16(dst, src) {
		const r = dst & src & 0xffff;
		this.flags = this.flags & ~0x8c5 | r >>> 8 & 0x80 | !r << 6 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4;
		return r;
	}

	sub8(dst, src) {
		const r = dst - src & 0xff, o = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		this.flags = this.flags & ~0x8d5 | o << 4 & 0x800 | r & 0x80 | !r << 6 | c << 1 & 0x10 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4 | c >>> 7 & 1;
		return r;
	}

	sub16(dst, src) {
		const r = dst - src & 0xffff, o = dst & ~src & ~r | ~dst & src & r, c = ~dst & src | src & r | r & ~dst;
		this.flags = this.flags & ~0x8d5 | o >>> 4 & 0x800 | r >>> 8 & 0x80 | !r << 6 | c << 1 & 0x10 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4 | c >>> 15 & 1;
		return r;
	}

	xor8(dst, src) {
		const r = (dst ^ src) & 0xff;
		this.flags = this.flags & ~0x8c5 | r & 0x80 | !r << 6 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4;
		return r;
	}

	xor16(dst, src) {
		const r = (dst ^ src) & 0xffff;
		this.flags = this.flags & ~0x8c5 | r >>> 8 & 0x80 | !r << 6 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4;
		return r;
	}

	daa() {
		let r = this.ax & 0xff;
		if (this.flags & 0x10 && (r & 0xf) < 4 || (r & 0xf) > 9) {
			if ((r += 6) >= 0x100)
				this.flags |= 1;
			this.flags |= 0x10;
		}
		if (this.flags & 1 && (r & 0xf0) < 0x40 || (r & 0xf0) > 0x90) {
			r += 0x60;
			this.flags |= 1;
		}
		this.ax = this.ax & 0xff00 | r & 0xff;
	}

	das() {
		let r = this.ax & 0xff;
		if (this.flags & 0x10 && (r & 0xf) > 5 || (r & 0xf) > 9) {
			r -= 6;
			this.flags |= 0x10;
		}
		if (this.flags & 1 && (r & 0xf0) > 0x50 || (r & 0xf0) > 0x90) {
			r -= 0x60;
			this.flags |= 1;
		}
		this.ax = this.ax & 0xff00 | r & 0xff;
	}

	aaa() {
		if (this.flags & 0x10 || (this.ax & 0xf) > 9) {
			this.ax += 0x106;
			this.flags |= 0x11;
		} else
			this.flags &= ~0x11;
		this.ax &= ~0xf0;
	}

	aas() {
		if (this.flags & 0x10 || (this.ax & 0xf) > 9) {
			this.ax -= 0x106;
			this.flags |= 0x11;
		} else
			this.flags &= ~0x11;
		this.ax &= ~0xf0;
	}

	rol8(dst, src) {
		const r = dst << (src & 7) & 0xff | dst >>> (~src & 7) + 1, o = r ^ dst, c = src ? dst >>> (-src & 7) & 1 : this.flags & 1;
		this.flags = this.flags & ~0x801 | o << 4 & 0x800 | c;
		return r;
	}

	rol16(dst, src) {
		const r = dst << (src & 15) & 0xffff | dst >>> (~src & 15) + 1, o = r ^ dst, c = src ? dst >>> (-src & 15) & 1 : this.flags & 1;
		this.flags = this.flags & ~0x801 | o >>> 4 & 0x800 | c;
		return r;
	}

	ror8(dst, src) {
		const r = dst >>> (src & 7) | dst << (~src & 7) + 1 & 0xff, o = r ^ dst, c = src ? dst >>> (src - 1 & 7) & 1 : this.flags & 1;
		this.flags = this.flags & ~0x801 | o << 4 & 0x800 | c;
		return r;
	}

	ror16(dst, src) {
		const r = dst >>> (src & 15) | dst << (~src & 15) + 1 & 0xffff, o = r ^ dst, c = src ? dst >>> (src - 1 & 15) & 1 : this.flags & 1;
		this.flags = this.flags & ~0x801 | o >>> 4 & 0x800 | c;
		return r;
	}

	rcl8(dst, src) {
		src %= 9;
		const r = (dst << src | dst >>> 9 - src | (this.flags << 7 & 0x80) >>> 8 - src) & 0xff, o = r ^ dst, c = src ? dst >>> 8 - src & 1 : this.flags & 1;
		this.flags = this.flags & ~0x801 | o << 4 & 0x800 | c;
		return r;
	}

	rcl16(dst, src) {
		src %= 17;
		const r = (dst << src | dst >>> 17 - src | (this.flags << 15 & 0x8000) >>> 16 - src) & 0xffff, o = r ^ dst, c = src ? dst >>> 16 - src & 1 : this.flags & 1;
		this.flags = this.flags & ~0x801 | o >>> 4 & 0x800 | c;
		return r;
	}

	rcr8(dst, src) {
		src %= 9;
		const r = (dst >>> src | dst << 9 - src | (this.flags & 1) << 8 - src) & 0xff, o = r ^ dst, c = src ? dst >>> src - 1 & 1 : this.flags & 1;
		this.flags = this.flags & ~0x801 | o << 4 & 0x800 | c;
		return r;
	}

	rcr16(dst, src) {
		src %= 17;
		const r = (dst >>> src | dst << 17 - src | (this.flags & 1) << 16 - src) & 0xffff, o = r ^ dst, c = src ? dst >>> src - 1 & 1 : this.flags & 1;
		this.flags = this.flags & ~0x801 | o >>> 4 & 0x800 | c;
		return r;
	}

	shl8(dst, src) {
		const r = dst << src & 0xff, o = r ^ dst, c = src ? dst << (src - 1) >>> 7 & 1 : this.flags & 1;
		this.flags = this.flags & ~0x8c5 | o << 4 & 0x800 | r & 0x80 | !r << 6 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4 | c;
		return r;
	}

	shl16(dst, src) {
		const r = dst << src & 0xffff, o = r ^ dst, c = src ? dst << (src - 1) >>> 15 & 1 : this.flags & 1;
		this.flags = this.flags & ~0x8c5 | o >>> 4 & 0x800 | r >>> 8 & 0x80 | !r << 6 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4 | c;
		return r;
	}

	shr8(dst, src) {
		const r = dst >>> src | 0, o = r ^ dst, c = src ? dst >>> (src - 1) & 1 : this.flags & 1;
		this.flags = this.flags & ~0x8c5 | o << 4 & 0x800 | r & 0x80 | !r << 6 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4 | c;
		return r;
	}

	shr16(dst, src) {
		const r = dst >>> src | 0, o = r ^ dst, c = src ? dst >>> (src - 1) & 1 : this.flags & 1;
		this.flags = this.flags & ~0x8c5 | o >>> 4 & 0x800 | r >>> 8 & 0x80 | !r << 6 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4 | c;
		return r;
	}

	sar8(dst, src) {
		dst -= dst << 1 & 0x100;
		const r = dst >> src & 0xff, o = r ^ dst, c = src ? dst >> (src - 1) & 1 : this.flags & 1;
		this.flags = this.flags & ~0x8c5 | o << 4 & 0x800 | r & 0x80 | !r << 6 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4 | c;
		return r;
	}

	sar16(dst, src) {
		dst -= dst << 1 & 0x10000;
		const r = dst >> src & 0xffff, o = r ^ dst, c = src ? dst >> (src - 1) & 1 : this.flags & 1;
		this.flags = this.flags & ~0x8c5 | o >>> 4 & 0x800 | r >>> 8 & 0x80 | !r << 6 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4 | c;
		return r;
	}

	inc8(dst) {
		const r = dst + 1 & 0xff, o = dst & 1 & ~r | ~dst & ~1 & r, c = dst & 1 | 1 & ~r | ~r & dst;
		this.flags = this.flags & ~0x8d5 | o << 4 & 0x800 | r & 0x80 | !r << 6 | c << 1 & 0x10 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4;
		return r;
	}

	inc16(dst) {
		const r = dst + 1 & 0xffff, o = dst & 1 & ~r | ~dst & ~1 & r, c = dst & 1 | 1 & ~r | ~r & dst;
		this.flags = this.flags & ~0x8d5 | o >>> 4 & 0x800 | r >>> 8 & 0x80 | !r << 6 | c << 1 & 0x10 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4;
		return r;
	}

	dec8(dst) {
		const r = dst - 1 & 0xff, o = dst & ~1 & ~r | ~dst & 1 & r, c = ~dst & 1 | 1 & r | r & ~dst;
		this.flags = this.flags & ~0x8d5 | o << 4 & 0x800 | r & 0x80 | !r << 6 | c << 1 & 0x10 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4;
		return r;
	}

	dec16(dst) {
		const r = dst - 1 & 0xffff, o = dst & ~1 & ~r | ~dst & 1 & r, c = ~dst & 1 | 1 & r | r & ~dst;
		this.flags = this.flags & ~0x8d5 | o >>> 4 & 0x800 | r >>> 8 & 0x80 | !r << 6 | c << 1 & 0x10 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4;
		return r;
	}

	neg8(dst) {
		const r = -dst & 0xff, o = dst & r, c = dst | r;
		this.flags = this.flags & ~0x8d5 | o << 4 & 0x800 | r & 0x80 | !r << 6 | c << 1 & 0x10 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4 | c >>> 7 & 1;
		return r;
	}

	neg16(dst) {
		const r = -dst & 0xffff, o = dst & r, c = dst | r;
		this.flags = this.flags & ~0x8d5 | o >>> 4 & 0x800 | r >>> 8 & 0x80 | !r << 6 | c << 1 & 0x10 | this.parity[r >>> 5 & 7] >>> (r & 31) << 2 & 4 | c >>> 15 & 1;
		return r;
	}

	mul8(src) {
		this.ax = (this.ax & 0xff) * src;
		this.flags = this.flags & ~0x801 | (this.ax & 0xff00 ? 0x801 : 0);
	}

	mul16(src) {
		const r = this.ax * src;
		[this.ax, this.dx] = [r & 0xffff, r >>> 16];
		this.flags = this.flags & ~0x801 | (this.dx ? 0x801 : 0);
	}

	imul8(src) {
		this.ax = ((this.ax & 0xff) - (this.ax << 1 & 0x100)) * (src - (src << 1 & 0x100)) & 0xffff;
		this.flags = this.flags & ~0x801 | (this.ax >>> 8 !== (-(this.ax >>> 7 & 1) & 0xff) ? 0x801 : 0);
	}

	imul16(src) {
		const r = (this.ax - (this.ax << 1 & 0x10000)) * (src - (src << 1 & 0x10000));
		[this.ax, this.dx] = [r & 0xffff, r >>> 16];
		this.flags = this.flags & ~0x801 | (this.dx !== (-(this.ax >>> 15 & 1) & 0xffff) ? 0x801 : 0);
	}

	imul16i(src) {
		const src2 = this.fetch16(), r = (src - (src << 1 & 0x10000)) * (src2 - (src2 << 1 & 0x10000));
		this.flags = this.flags & ~0x801 | (r >>> 16 !== (-(r >>> 15 & 1) & 0xffff) ? 0x801 : 0);
		return r & 0xffff;
	}

	imul16is(src) {
		const r = (src - (src << 1 & 0x10000)) * this.fetch8s();
		this.flags = this.flags & ~0x801 | (r >>> 16 !== (-(r >>> 15 & 1) & 0xffff) ? 0x801 : 0);
		return r & 0xffff;
	}

	div8(src) {
		if (!src)
			return this.exception(0);
		this.ax = this.ax / src & 0xff | this.ax % src << 8 & 0xff00;
	}

	div16(src) {
		if (!src)
			return this.exception(0);
		const dst = (this.ax | this.dx << 16) >>> 0;
		[this.ax, this.dx] = [dst / src & 0xffff, dst % src & 0xffff];
	}

	idiv8(src) {
		if (!src)
			return this.exception(0);
		src -= src << 1 & 0x100;
		const dst = this.ax - (this.ax << 1 & 0x10000);
		return dst / src & 0xff | dst % src << 8 & 0xff00;
	}

	idiv16(src) {
		if (!src)
			return this.exception(0);
		src -= src << 1 & 0x10000;
		const dst = this.ax | this.dx << 16;
		[this.ax, this.dx] = [dst / src & 0xffff, dst % src & 0xffff];
	}

	aam(src) {
		this.ax = (this.ax & 0xff) / src << 8 | (this.ax & 0xff) % src;
	}

	aad(src) {
		this.ax = (this.ax >>> 8) * src + (this.ax & 0xff) & 0xff;
	}

	jcc(cond) {
		const disp = this.fetch8s();
		cond && (this.ip = this.ip + disp & 0xffff);
	}

	call32(offset, seg) {
		this.push(this.cs, this.ip);
		[this.ip, this.cs] = [offset, seg];
	}

	call16a(offset) {
		this.push(this.ip);
		this.ip = offset;
	}

	call16() {
		const disp = this.fetch16();
		this.push(this.ip);
		this.ip = this.ip + disp & 0xffff;
	}

	jmp16() {
		const disp = this.fetch16();
		this.ip = this.ip + disp & 0xffff;
	}

	enter() {
		const data = this.fetch16(), l = this.fetch8() & 31;
		this.push(this.bp);
		const temp = this.sp;
		if (l > 1) {
			for (let i = 1; i < l; i++)
				this.push(this.read16(this.ss, this.bp = this.bp - 2 & 0xffff));
			this.push(temp);
		}
		this.bp = temp;
		this.sp = this.sp - data & 0xffff;
	}

	bound(dst, low, high) {
		if (dst < low || dst > high)
			this.exception(5);
	}

	fetch8() {
		const addr = (this.cs << 4) + this.ip, data = this.memorymap[addr >>> 8 & 0xfff].base[addr & 0xff];
		this.ip = this.ip + 1 & 0xffff;
		return data;
	}

	fetch8s() {
		const addr = (this.cs << 4) + this.ip, data = this.memorymap[addr >>> 8 & 0xfff].base[addr & 0xff];
		this.ip = this.ip + 1 & 0xffff;
		return data - (data << 1 & 0x100) | 0;
	}

	fetch16() {
		if ((this.ip & 0xf) === 0xf)
			return this.fetch8() | this.fetch8() << 8;
		const addr = (this.cs << 4) + this.ip, page = this.memorymap[addr >>> 8 & 0xfff], data = page.base[addr & 0xff] | page.base[addr + 1 & 0xff] << 8;
		this.ip = this.ip + 2 & 0xffff;
		return data;
	}

	read8(seg, offset) {
		const addr = (seg << 4) + offset, page = this.memorymap[addr >>> 8 & 0xfff];
		return page.read ? page.read(addr) : page.base[addr & 0xff];
	}

	read16(seg, offset) {
		if (offset & 1)
			return this.read8(seg, offset) | this.read8(seg, offset + 1) << 8;
		const addr = (seg << 4) + offset, page = this.memorymap[addr >>> 8 & 0xfff];
		return page.read16 ? page.read16(addr) : page.read ? page.read(addr) | page.read(addr + 1) << 8 : page.base[addr & 0xff] | page.base[addr + 1 & 0xff] << 8;
	}

	write8(seg, offset, data) {
		const addr = (seg << 4) + offset, page = this.memorymap[addr >>> 8 & 0xfff];
		if (page.write)
			page.write(addr, data & 0xff);
		else
			page.base[addr & 0xff] = data;
	}

	write16(seg, offset, data) {
		if (offset & 1) {
			this.write8(seg, offset, data);
			this.write8(seg, offset + 1, data >>> 8);
			return;
		}
		const addr = (seg << 4) + offset, page = this.memorymap[addr >>> 8 & 0xfff];
		if (page.write16)
			page.write16(addr, data);
		else if (page.write) {
			page.write(addr, data & 0xff);
			page.write(addr + 1, data >>> 8);
		} else {
			page.base[addr & 0xff] = data;
			page.base[addr + 1 & 0xff] = data >>> 8;
		}
	}

	ioread8(addr) {
		const page = this.iomap[addr >>> 8];
		return page.read ? page.read(addr) : page.base[addr & 0xff];
	}

	ioread16(addr) {
		if (addr & 1)
			return this.ioread8(addr) | this.read8(addr + 1 & 0xffff) << 8;
		const page = this.iomap[addr >>> 8];
		return page.read16 ? page.read16(addr) : page.read ? page.read(addr) | page.read(addr + 1) << 8 : page.base[addr & 0xff] | page.base[addr + 1 & 0xff] << 8;
	}

	iowrite8(addr, data) {
		const page = this.iomap[addr >>> 8];
		if (page.write)
			page.write(addr, data & 0xff);
		else
			page.base[addr & 0xff] = data;
	}

	iowrite16(addr, data) {
		if (addr & 1) {
			this.iowrite8(addr, data);
			this.iowrite8(addr + 1 & 0xffff, data >>> 8);
			return;
		}
		const page = this.iomap[addr >>> 8];
		if (page.write16)
			page.write16(addr, data);
		else if (page.write) {
			page.write(addr, data & 0xff);
			page.write(addr + 1, data >>> 8);
		} else {
			page.base[addr & 0xff] = data;
			page.base[addr + 1 & 0xff] = data >>> 8;
		}
	}
}

