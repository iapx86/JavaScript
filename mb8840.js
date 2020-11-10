/*
 *
 *	MB8840 Emulator
 *
 */

export default class MB8840 {
	pc = 0;
	a = 0;
	x = 0;
	y = 0;
	zf = false;
	cf = false;
	st = false;
	m = [];
	o = 0;
	p = 0;
	r = 0;
	k = 0;
	t = 0;
	sb = 0;
	rom = new Uint8Array(0x800);
	ram = new Uint8Array(0x80);
	stack = new Uint16Array(4);
	sp = 0;
	cause = 0; // cause:Ext(IF),Timer(VF),SB(SF)
	mask = 0;
	cycles = 0;

	constructor() {
		for (let i = 0; i < 8; i++)
			this.m.push(this.ram.subarray(i * 16, i * 16 + 16));
	}

	reset() {
		this.pc = 0;
		this.st = true;
		this.sp = 3;
		this.cause = 0;
		this.mask = 0;
		this.cycles = 0;
	}

	interrupt(cause = 'external') {
		let vector = 0;
		switch (cause) {
		default:
		case 'external':
			if ((this.mask & 4) === 0)
				return false;
			this.mask &= ~4, vector = 2;
			break;
		case 'timer':
			if ((this.mask & 2) === 0)
				return false;
			this.mask &= ~2, vector = 4;
			break;
		case 'serial':
			if ((this.mask & 1) === 0)
				return false;
			this.mask &= ~1, vector = 6;
		}
		return this.push(this.pc | this.zf << 13 | this.cf << 14 | this.st << 15), this.pc = vector, this.st = true, this.cycles = this.cycles - 3 | 0, true;
	}

	execute() {
		let op = this.fetch(), v;
		switch (op) {
		case 0x00: // NOP
			return this.st = true, op;
		case 0x01: // OUTO
			return this.o = this.o & ~(15 << (this.cf << 2)) | this.a << (this.cf << 2), this.st = true, op;
		case 0x02: // OUTP
			return this.p = this.a, this.st = true, op;
		case 0x03: // OUT
			return this.r = this.r & ~(15 << (this.y << 2 & 12)) | this.a << (this.y << 2 & 12), this.st = true, op;
		case 0x04: // TAY
			return this.y = this.a, this.st = true, op;
		case 0x05: // TATH
			return this.t = this.t & ~(15 << 4) | this.a << 4, this.st = true, op;
		case 0x06: // TATL
			return this.t = this.t & ~15 | this.a, this.st = true, op;
		case 0x07: // TAS
			return this.sb = this.a, this.st = true, op;
		case 0x08: // ICY
			return this.y = this.y + 1 & 15, this.zf = !this.y, this.st = this.y !== 0, op;
		case 0x09: // ICM
			return v = this.m[this.x][this.y] = this.m[this.x][this.y] + 1 & 15, this.zf = !v, this.st = v !== 0, op;
		case 0x0a: // STIC
			return this.m[this.x][this.y] = this.a, this.y = this.y + 1 & 15, this.zf = !this.y, this.st = this.y !== 0, op;
		case 0x0b: // X
			return v = this.m[this.x][this.y], this.m[this.x][this.y] = this.a, this.a = v, this.zf = !this.a, this.st = true, op;
		case 0x0c: // ROL
			return v = this.a << 1 & 15 | this.cf, this.zf = !v, this.cf = (this.a >> 3) !== 0, this.a = v, this.st = !this.cf, op;
		case 0x0d: // L
			return this.a = this.m[this.x][this.y], this.zf = !this.a, this.st = true, op;
		case 0x0e: // ADC
			return v = this.a + this.m[this.x][this.y] + this.cf, this.a = v & 15, this.zf = !this.a, this.cf = v >> 4 !== 0, this.st = !this.cf, op;
		case 0x0f: // AND
			return this.a &= this.m[this.x][this.y], this.zf = !this.a, this.st = !this.zf, op;
		case 0x10: // DAA
			return this.a > 9 && (this.cf = true), this.cf && (this.a = this.a + 6 & 15), this.st = !this.cf, op;
		case 0x11: // DAS
			return this.a > 9 && (this.cf = true), this.cf && (this.a = this.a + 10 & 15), this.st = !this.cf, op;
		case 0x12: // INK
			return this.a = this.k, this.zf = !this.a, this.st = true, op;
		case 0x13: // IN
			return this.a = this.r >> (this.y << 2 & 12) & 15, this.st = true, op;
		case 0x14: // TYA
			return this.a = this.y, this.zf = !this.a, this.st = true, op;
		case 0x15: // TTHA
			return this.a = this.t >> 4, this.zf = !this.a, this.st = true, op;
		case 0x16: // TTLA
			return this.a = this.t & 15, this.zf = !this.a, this.st = true, op;
		case 0x17: // TSA
			return this.a = this.sb, this.zf = !this.a, this.st = true, op;
		case 0x18: // DCY
			return this.y = this.y - 1 & 15, this.st = this.y !== 15, op;
		case 0x19: // DCM
			return v = this.m[this.x][this.y] = this.m[this.x][this.y] - 1 & 15, this.zf = !v, this.st = v !== 15, op;
		case 0x1a: // STDC
			return this.m[this.x][this.y] = this.a, this.y = this.y - 1 & 15, this.zf = !this.y, this.st = this.y !== 15, op;
		case 0x1b: // XX
			return v = this.x, this.x = this.a, this.a = v, this.zf = !this.a, this.st = true, op;
		case 0x1c: // ROR
			return v = this.a >> 1 | this.cf << 3, this.zf = !v, this.cf = (this.a & 1) !== 0, this.a = v, this.st = !this.cf, op;
		case 0x1d: // ST
			return this.m[this.x][this.y] = this.a, this.st = true, op;
		case 0x1e: // SBC
			return v = this.a - this.m[this.x][this.y] - this.cf, this.a = v & 15, this.zf = !this.a, this.cf = v >> 4 !== 0, this.st = !this.cf, op;
		case 0x1f: // OR
			return this.a |= this.m[this.x][this.y], this.zf = !this.a, this.st = !this.zf, op;
		case 0x20: // SETR
			return this.r |= 1 << this.y, this.st = true, op;
		case 0x21: // SETC
			return this.cf = this.st = true, op;
		case 0x22: // RSTR
			return this.r &= ~(1 << this.y), this.st = true, op;
		case 0x23: // RSTC
			return this.cf = false, this.st = true, op;
		case 0x24: // TSTR
			return this.st = (this.r >> this.y & 1) === 0, op;
		case 0x25: // TSTI
			return this.st = (this.cause & 4) === 0, op;
		case 0x26: // TSTV
			return this.st = (this.cause & 2) === 0, this.cause &= ~2, op;
		case 0x27: // TSTS
			return this.st = (this.cause & 1) === 0, this.cause &= ~1, op;
		case 0x28: // TSTC
			return this.st = !this.cf, op;
		case 0x29: // TSTZ
			return this.st = !this.zf, op;
		case 0x2a: // STS
			return this.m[this.x][this.y] = this.sb, this.zf = !this.sb, this.st = true, op;
		case 0x2b: // LS
			return this.sb = this.m[this.x][this.y], this.zf = !this.sb, this.st = true, op;
		case 0x2c: // RTS
			return this.pc = this.pop() & 0x7ff, this.st = true, op;
		case 0x2d: // NEG
			return this.a = -this.a & 15, this.zf = !this.a, this.st = !this.zf, op;
		case 0x2e: // C
			return v = this.a - this.m[this.x][this.y], this.zf = (v & 15) === 0, this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0x2f: // EOR
			return this.a ^= this.m[this.x][this.y], this.zf = !this.a, this.st = !this.zf, op;
		case 0x30: case 0x31: case 0x32: case 0x33: // SBIT bp
			return this.m[this.x][this.y] |= 1 << (op & 3), this.st = true, op;
		case 0x34: case 0x35: case 0x36: case 0x37: // RBIT bp
			return this.m[this.x][this.y] &= ~(1 << (op & 3)), this.st = true, op;
		case 0x38: case 0x39: case 0x3a: case 0x3b: // TBIT bp
			return this.st = (this.m[this.x][this.y] >> (op & 3) & 1) === 0, op;
		case 0x3c: // RTI
			return this.rti(), op;
		case 0x3d: // JPA addr
			return this.pc = this.a << 2 | this.fetch() << 6 & 0x7c0, this.st = true, op;
		case 0x3e: // EN imm
			return this.mask |= this.fetch(), this.st = true, op;
		case 0x3f: // DIS imm
			return this.mask &= ~this.fetch(), this.st = true, op;
		case 0x40: case 0x41: case 0x42: case 0x43: // SETD d
			return this.r |= 1 << (op & 3), this.st = true, op;
		case 0x44: case 0x45: case 0x46: case 0x47: // RSTD d
			return this.r &= ~(1 << (op & 3)), this.st = true, op;
		case 0x48: case 0x49: case 0x4a: case 0x4b: // TSTD d
			return this.st = (this.r >> (op & 15) & 1) === 0, op;
		case 0x4c: case 0x4d: case 0x4e: case 0x4f: // TBA bp
			return this.st = (this.a >> (op & 3) & 1) === 0, op;
		case 0x50: case 0x51: case 0x52: case 0x53: // XD D
			return v = this.m[0][op & 3], this.m[0][op & 3] = this.a, this.a = v, this.zf = !this.a, this.st = true, op;
		case 0x54: case 0x55: case 0x56: case 0x57: // XYD D
			return v = this.m[0][op & 7], this.m[0][op & 7] = this.y, this.y = v, this.zf = !this.y, this.st = true, op;
		case 0x58: case 0x59: case 0x5a: case 0x5b: case 0x5c: case 0x5d: case 0x5e: case 0x5f: // LXI imm
			return this.x = op & 7, this.zf = !this.x, this.st = true, op;
		case 0x60: case 0x61: case 0x62: case 0x63: case 0x64: case 0x65: case 0x66: case 0x67: // CALL addr
			return v = this.fetch(), this.st && (this.push(this.pc), this.pc = v | op << 8 & 0x700), this.st = true, op;
		case 0x68: case 0x69: case 0x6a: case 0x6b: case 0x6c: case 0x6d: case 0x6e: case 0x6f: // JPL addr
			return v = this.fetch(), this.st && (this.pc = v | op << 8 & 0x700), this.st = true, op;
		case 0x70: case 0x71: case 0x72: case 0x73: case 0x74: case 0x75: case 0x76: case 0x77:
		case 0x78: case 0x79: case 0x7a: case 0x7b: case 0x7c: case 0x7d: case 0x7e: case 0x7f: // AI imm
			return v = this.a + (op & 15), this.a = v & 15, this.zf = !this.a, this.cf = v >> 4 !== 0, this.st = !this.cf, op;
		case 0x80: case 0x81: case 0x82: case 0x83: case 0x84: case 0x85: case 0x86: case 0x87:
		case 0x88: case 0x89: case 0x8a: case 0x8b: case 0x8c: case 0x8d: case 0x8e: case 0x8f: // LYI imm
			return this.y = op & 15, this.zf = !this.y, this.st = true, op;
		case 0x90: case 0x91: case 0x92: case 0x93: case 0x94: case 0x95: case 0x96: case 0x97:
		case 0x98: case 0x99: case 0x9a: case 0x9b: case 0x9c: case 0x9d: case 0x9e: case 0x9f: // LI imm
			return this.a = op & 15, this.zf = !this.a, this.st = true, op;
		case 0xa0: case 0xa1: case 0xa2: case 0xa3: case 0xa4: case 0xa5: case 0xa6: case 0xa7:
		case 0xa8: case 0xa9: case 0xaa: case 0xab: case 0xac: case 0xad: case 0xae: case 0xaf: // CYI imm
			return v = this.y - (op & 15), this.zf = (v & 15) === 0, this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xb0: case 0xb1: case 0xb2: case 0xb3: case 0xb4: case 0xb5: case 0xb6: case 0xb7:
		case 0xb8: case 0xb9: case 0xba: case 0xbb: case 0xbc: case 0xbd: case 0xbe: case 0xbf: // CI imm
			return v = this.a - (op & 15), this.zf = (v & 15) === 0, this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		default: // JMP addr
			return this.st && (this.pc = this.pc & ~63 | op & 63), this.st = true, op;
		}
	}

	rti() {
		const addr = this.pop();
		this.zf = (addr >> 13 & 1) !== 0, this.cf = (addr >> 14 & 1) !== 0, this.st = (addr >> 15 & 1) !== 0, this.pc = addr & 0x7ff;
	}

	push(addr) {
		this.stack[this.sp] = addr, this.sp = this.sp - 1 & 3;
	}

	pop() {
		return this.sp = this.sp + 1 & 3, this.stack[this.sp];
	}

	fetch() {
		const data = this.rom[this.pc];
		return this.pc = this.pc + 1 & 0x7ff, this.cycles = this.cycles - 1 | 0, data;
	}
}

