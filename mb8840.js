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
	cycle = 0;

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
		this.cycle = 0;
	}

	interrupt(_cause = 'external') {
		let intvec = 0;
		switch (_cause) {
		default:
		case 'external':
			if (~this.mask & 4)
				return false;
			this.mask &= ~4, intvec = 2;
			break;
		case 'timer':
			if (~this.mask & 2)
				return false;
			this.mask &= ~2, intvec = 4;
			break;
		case 'serial':
			if (~this.mask & 1)
				return false;
			this.mask &= ~1, intvec = 6;
		}
		return this.cycle -= 3, this.push(this.pc | this.zf << 13 | this.cf << 14 | this.st << 15), this.pc = intvec, this.st = true, true;
	}

	execute() {
		let v, op = this.fetch();
		this.cycle -= cc[op];
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
			return v = this.a << 1 | this.cf, this.a = v & 15, this.zf = !this.a, this.cf = v >> 4 !== 0, this.st = !this.cf, op;
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
			return v = this.m[this.x][this.y] - this.a - this.cf, this.a = v & 15, this.zf = !this.a, this.cf = v >> 4 !== 0, this.st = !this.cf, op;
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
			return this.st = !(this.r & 1 << this.y), op;
		case 0x25: // TSTI
			return this.st = !(this.cause & 4), op;
		case 0x26: // TSTV
			return this.st = !(this.cause & 2), this.cause &= ~2, op;
		case 0x27: // TSTS
			return this.st = !(this.cause & 1), this.cause &= ~1, op;
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
			return this.a = -this.a & 15, this.st = !!this.a, op;
		case 0x2e: // C
			return v = this.m[this.x][this.y] - this.a, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0x2f: // EOR
			return this.a ^= this.m[this.x][this.y], this.zf = !this.a, this.st = !this.zf, op;
		case 0x30: // SBIT 0
			return this.m[this.x][this.y] |= 1, this.st = true, op;
		case 0x31: // SBIT 1
			return this.m[this.x][this.y] |= 2, this.st = true, op;
		case 0x32: // SBIT 2
			return this.m[this.x][this.y] |= 4, this.st = true, op;
		case 0x33: // SBIT 3
			return this.m[this.x][this.y] |= 8, this.st = true, op;
		case 0x34: // RBIT 0
			return this.m[this.x][this.y] &= ~1, this.st = true, op;
		case 0x35: // RBIT 1
			return this.m[this.x][this.y] &= ~2, this.st = true, op;
		case 0x36: // RBIT 2
			return this.m[this.x][this.y] &= ~4, this.st = true, op;
		case 0x37: // RBIT 3
			return this.m[this.x][this.y] &= ~8, this.st = true, op;
		case 0x38: // TBIT 0
			return this.st = !(this.m[this.x][this.y] & 1), op;
		case 0x39: // TBIT 1
			return this.st = !(this.m[this.x][this.y] & 2), op;
		case 0x3a: // TBIT 2
			return this.st = !(this.m[this.x][this.y] & 4), op;
		case 0x3b: // TBIT 3
			return this.st = !(this.m[this.x][this.y] & 8), op;
		case 0x3c: // RTI
			return v = this.pop(), this.zf = (v & 1 << 13) !== 0, this.cf = (v & 1 << 14) !== 0, this.st = (v & 1 << 15) !== 0, this.pc = v & 0x7ff, op;
		case 0x3d: // JPA addr
			return this.pc = this.a << 2 | this.fetch() << 6 & 0x7c0, this.st = true, op;
		case 0x3e: // EN imm
			return this.mask |= this.fetch(), this.st = true, op;
		case 0x3f: // DIS imm
			return this.mask &= ~this.fetch(), this.st = true, op;
		case 0x40: // SETD 0
			return this.r |= 1, this.st = true, op;
		case 0x41: // SETD 1
			return this.r |= 2, this.st = true, op;
		case 0x42: // SETD 2
			return this.r |= 4, this.st = true, op;
		case 0x43: // SETD 3
			return this.r |= 8, this.st = true, op;
		case 0x44: // RSTD 0
			return this.r &= ~1, this.st = true, op;
		case 0x45: // RSTD 1
			return this.r &= ~2, this.st = true, op;
		case 0x46: // RSTD 2
			return this.r &= ~4, this.st = true, op;
		case 0x47: // RSTD 3
			return this.r &= ~8, this.st = true, op;
		case 0x48: // TSTD 8
			return this.st = !(this.r & 256), op;
		case 0x49: // TSTD 9
			return this.st = !(this.r & 512), op;
		case 0x4a: // TSTD 10
			return this.st = !(this.r & 1024), op;
		case 0x4b: // TSTD 11
			return this.st = !(this.r & 2048), op;
		case 0x4c: // TBA 0
			return this.st = !(this.a & 1), op;
		case 0x4d: // TBA 1
			return this.st = !(this.a & 2), op;
		case 0x4e: // TBA 2
			return this.st = !(this.a & 4), op;
		case 0x4f: // TBA 3
			return this.st = !(this.a & 8), op;
		case 0x50: // XD 0
			return v = this.m[0][0], this.m[0][0] = this.a, this.a = v, this.zf = !this.a, this.st = true, op;
		case 0x51: // XD 1
			return v = this.m[0][1], this.m[0][1] = this.a, this.a = v, this.zf = !this.a, this.st = true, op;
		case 0x52: // XD 2
			return v = this.m[0][2], this.m[0][2] = this.a, this.a = v, this.zf = !this.a, this.st = true, op;
		case 0x53: // XD 3
			return v = this.m[0][3], this.m[0][3] = this.a, this.a = v, this.zf = !this.a, this.st = true, op;
		case 0x54: // XYD 4
			return v = this.m[0][4], this.m[0][4] = this.y, this.y = v, this.zf = !this.y, this.st = true, op;
		case 0x55: // XYD 5
			return v = this.m[0][5], this.m[0][5] = this.y, this.y = v, this.zf = !this.y, this.st = true, op;
		case 0x56: // XYD 6
			return v = this.m[0][6], this.m[0][6] = this.y, this.y = v, this.zf = !this.y, this.st = true, op;
		case 0x57: // XYD 7
			return v = this.m[0][7], this.m[0][7] = this.y, this.y = v, this.zf = !this.y, this.st = true, op;
		case 0x58: // LXI 0
			return this.x = 0, this.zf = true, this.st = true, op;
		case 0x59: // LXI 1
			return this.x = 1, this.zf = false, this.st = true, op;
		case 0x5a: // LXI 2
			return this.x = 2, this.zf = false, this.st = true, op;
		case 0x5b: // LXI 3
			return this.x = 3, this.zf = false, this.st = true, op;
		case 0x5c: // LXI 4
			return this.x = 4, this.zf = false, this.st = true, op;
		case 0x5d: // LXI 5
			return this.x = 5, this.zf = false, this.st = true, op;
		case 0x5e: // LXI 6
			return this.x = 6, this.zf = false, this.st = true, op;
		case 0x5f: // LXI 7
			return this.x = 7, this.zf = false, this.st = true, op;
		case 0x60: // CALL addr
			return v = this.fetch(), this.st && (this.push(this.pc), this.pc = v), this.st = true, op;
		case 0x61: // CALL addr
			return v = this.fetch(), this.st && (this.push(this.pc), this.pc = v | 0x100), this.st = true, op;
		case 0x62: // CALL addr
			return v = this.fetch(), this.st && (this.push(this.pc), this.pc = v | 0x200), this.st = true, op;
		case 0x63: // CALL addr
			return v = this.fetch(), this.st && (this.push(this.pc), this.pc = v | 0x300), this.st = true, op;
		case 0x64: // CALL addr
			return v = this.fetch(), this.st && (this.push(this.pc), this.pc = v | 0x400), this.st = true, op;
		case 0x65: // CALL addr
			return v = this.fetch(), this.st && (this.push(this.pc), this.pc = v | 0x500), this.st = true, op;
		case 0x66: // CALL addr
			return v = this.fetch(), this.st && (this.push(this.pc), this.pc = v | 0x600), this.st = true, op;
		case 0x67: // CALL addr
			return v = this.fetch(), this.st && (this.push(this.pc), this.pc = v | 0x700), this.st = true, op;
		case 0x68: // JPL addr
			return v = this.fetch(), this.st && (this.pc = v), this.st = true, op;
		case 0x69: // JPL addr
			return v = this.fetch(), this.st && (this.pc = v | 0x100), this.st = true, op;
		case 0x6a: // JPL addr
			return v = this.fetch(), this.st && (this.pc = v | 0x200), this.st = true, op;
		case 0x6b: // JPL addr
			return v = this.fetch(), this.st && (this.pc = v | 0x300), this.st = true, op;
		case 0x6c: // JPL addr
			return v = this.fetch(), this.st && (this.pc = v | 0x400), this.st = true, op;
		case 0x6d: // JPL addr
			return v = this.fetch(), this.st && (this.pc = v | 0x500), this.st = true, op;
		case 0x6e: // JPL addr
			return v = this.fetch(), this.st && (this.pc = v | 0x600), this.st = true, op;
		case 0x6f: // JPL addr
			return v = this.fetch(), this.st && (this.pc = v | 0x700), this.st = true, op;
		case 0x70: // AI 0
			return this.zf = !this.a, this.cf = false, this.st = true, op;
		case 0x71: // AI 1/ICA
			return v = this.a + 1, this.a = v & 15, this.zf = !this.a, this.cf = v >> 4 !== 0, this.st = !this.cf, op;
		case 0x72: // AI 2
			return v = this.a + 2, this.a = v & 15, this.zf = !this.a, this.cf = v >> 4 !== 0, this.st = !this.cf, op;
		case 0x73: // AI 3
			return v = this.a + 3, this.a = v & 15, this.zf = !this.a, this.cf = v >> 4 !== 0, this.st = !this.cf, op;
		case 0x74: // AI 4
			return v = this.a + 4, this.a = v & 15, this.zf = !this.a, this.cf = v >> 4 !== 0, this.st = !this.cf, op;
		case 0x75: // AI 5
			return v = this.a + 5, this.a = v & 15, this.zf = !this.a, this.cf = v >> 4 !== 0, this.st = !this.cf, op;
		case 0x76: // AI 6
			return v = this.a + 6, this.a = v & 15, this.zf = !this.a, this.cf = v >> 4 !== 0, this.st = !this.cf, op;
		case 0x77: // AI 7
			return v = this.a + 7, this.a = v & 15, this.zf = !this.a, this.cf = v >> 4 !== 0, this.st = !this.cf, op;
		case 0x78: // AI 8
			return v = this.a + 8, this.a = v & 15, this.zf = !this.a, this.cf = v >> 4 !== 0, this.st = !this.cf, op;
		case 0x79: // AI 9
			return v = this.a + 9, this.a = v & 15, this.zf = !this.a, this.cf = v >> 4 !== 0, this.st = !this.cf, op;
		case 0x7a: // AI 10
			return v = this.a + 10, this.a = v & 15, this.zf = !this.a, this.cf = v >> 4 !== 0, this.st = !this.cf, op;
		case 0x7b: // AI 11
			return v = this.a + 11, this.a = v & 15, this.zf = !this.a, this.cf = v >> 4 !== 0, this.st = !this.cf, op;
		case 0x7c: // AI 12
			return v = this.a + 12, this.a = v & 15, this.zf = !this.a, this.cf = v >> 4 !== 0, this.st = !this.cf, op;
		case 0x7d: // AI 13
			return v = this.a + 13, this.a = v & 15, this.zf = !this.a, this.cf = v >> 4 !== 0, this.st = !this.cf, op;
		case 0x7e: // AI 14
			return v = this.a + 14, this.a = v & 15, this.zf = !this.a, this.cf = v >> 4 !== 0, this.st = !this.cf, op;
		case 0x7f: // AI 15/DCA
			return v = this.a + 15, this.a = v & 15, this.zf = !this.a, this.cf = v >> 4 !== 0, this.st = !this.cf, op;
		case 0x80: // LYI 0
			return this.y = 0, this.zf = true, this.st = true, op;
		case 0x81: // LYI 1
			return this.y = 1, this.zf = false, this.st = true, op;
		case 0x82: // LYI 2
			return this.y = 2, this.zf = false, this.st = true, op;
		case 0x83: // LYI 3
			return this.y = 3, this.zf = false, this.st = true, op;
		case 0x84: // LYI 4
			return this.y = 4, this.zf = false, this.st = true, op;
		case 0x85: // LYI 5
			return this.y = 5, this.zf = false, this.st = true, op;
		case 0x86: // LYI 6
			return this.y = 6, this.zf = false, this.st = true, op;
		case 0x87: // LYI 7
			return this.y = 7, this.zf = false, this.st = true, op;
		case 0x88: // LYI 8
			return this.y = 8, this.zf = false, this.st = true, op;
		case 0x89: // LYI 9
			return this.y = 9, this.zf = false, this.st = true, op;
		case 0x8a: // LYI 10
			return this.y = 10, this.zf = false, this.st = true, op;
		case 0x8b: // LYI 11
			return this.y = 11, this.zf = false, this.st = true, op;
		case 0x8c: // LYI 12
			return this.y = 12, this.zf = false, this.st = true, op;
		case 0x8d: // LYI 13
			return this.y = 13, this.zf = false, this.st = true, op;
		case 0x8e: // LYI 14
			return this.y = 14, this.zf = false, this.st = true, op;
		case 0x8f: // LYI 15
			return this.y = 15, this.zf = false, this.st = true, op;
		case 0x90: // LI 0/CLA
			return this.a = 0, this.zf = true, this.st = true, op;
		case 0x91: // LI 1
			return this.a = 1, this.zf = false, this.st = true, op;
		case 0x92: // LI 2
			return this.a = 2, this.zf = false, this.st = true, op;
		case 0x93: // LI 3
			return this.a = 3, this.zf = false, this.st = true, op;
		case 0x94: // LI 4
			return this.a = 4, this.zf = false, this.st = true, op;
		case 0x95: // LI 5
			return this.a = 5, this.zf = false, this.st = true, op;
		case 0x96: // LI 6
			return this.a = 6, this.zf = false, this.st = true, op;
		case 0x97: // LI 7
			return this.a = 7, this.zf = false, this.st = true, op;
		case 0x98: // LI 8
			return this.a = 8, this.zf = false, this.st = true, op;
		case 0x99: // LI 9
			return this.a = 9, this.zf = false, this.st = true, op;
		case 0x9a: // LI 10
			return this.a = 10, this.zf = false, this.st = true, op;
		case 0x9b: // LI 11
			return this.a = 11, this.zf = false, this.st = true, op;
		case 0x9c: // LI 12
			return this.a = 12, this.zf = false, this.st = true, op;
		case 0x9d: // LI 13
			return this.a = 13, this.zf = false, this.st = true, op;
		case 0x9e: // LI 14
			return this.a = 14, this.zf = false, this.st = true, op;
		case 0x9f: // LI 15
			return this.a = 15, this.zf = false, this.st = true, op;
		case 0xa0: // CYI 0
			return v = -this.y, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xa1: // CYI 1
			return v = 1 - this.y, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xa2: // CYI 2
			return v = 2 - this.y, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xa3: // CYI 3
			return v = 3 - this.y, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xa4: // CYI 4
			return v = 4 - this.y, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xa5: // CYI 5
			return v = 5 - this.y, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xa6: // CYI 6
			return v = 6 - this.y, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xa7: // CYI 7
			return v = 7 - this.y, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xa8: // CYI 8
			return v = 8 - this.y, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xa9: // CYI 9
			return v = 9 - this.y, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xaa: // CYI 10
			return v = 10 - this.y, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xab: // CYI 11
			return v = 11 - this.y, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xac: // CYI 12
			return v = 12 - this.y, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xad: // CYI 13
			return v = 13 - this.y, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xae: // CYI 14
			return v = 14 - this.y, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xaf: // CYI 15
			return v = 15 - this.y, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xb0: // CI 0
			return v = -this.a, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xb1: // CI 1
			return v = 1 - this.a, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xb2: // CI 2
			return v = 2 - this.a, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xb3: // CI 3
			return v = 3 - this.a, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xb4: // CI 4
			return v = 4 - this.a, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xb5: // CI 5
			return v = 5 - this.a, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xb6: // CI 6
			return v = 6 - this.a, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xb7: // CI 7
			return v = 7 - this.a, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xb8: // CI 8
			return v = 8 - this.a, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xb9: // CI 9
			return v = 9 - this.a, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xba: // CI 10
			return v = 10 - this.a, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xbb: // CI 11
			return v = 11 - this.a, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xbc: // CI 12
			return v = 12 - this.a, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xbd: // CI 13
			return v = 13 - this.a, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xbe: // CI 14
			return v = 14 - this.a, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xbf: // CI 15
			return v = 15 - this.a, this.zf = !(v & 15), this.cf = v >> 4 !== 0, this.st = !this.zf, op;
		case 0xc0: // JMP 0
			return this.st && (this.pc &= ~63), this.st = true, op;
		case 0xc1: // JMP 1
			return this.st && (this.pc = this.pc & ~63 | 1), this.st = true, op;
		case 0xc2: // JMP 2
			return this.st && (this.pc = this.pc & ~63 | 2), this.st = true, op;
		case 0xc3: // JMP 3
			return this.st && (this.pc = this.pc & ~63 | 3), this.st = true, op;
		case 0xc4: // JMP 4
			return this.st && (this.pc = this.pc & ~63 | 4), this.st = true, op;
		case 0xc5: // JMP 5
			return this.st && (this.pc = this.pc & ~63 | 5), this.st = true, op;
		case 0xc6: // JMP 6
			return this.st && (this.pc = this.pc & ~63 | 6), this.st = true, op;
		case 0xc7: // JMP 7
			return this.st && (this.pc = this.pc & ~63 | 7), this.st = true, op;
		case 0xc8: // JMP 8
			return this.st && (this.pc = this.pc & ~63 | 8), this.st = true, op;
		case 0xc9: // JMP 9
			return this.st && (this.pc = this.pc & ~63 | 9), this.st = true, op;
		case 0xca: // JMP 10
			return this.st && (this.pc = this.pc & ~63 | 10), this.st = true, op;
		case 0xcb: // JMP 11
			return this.st && (this.pc = this.pc & ~63 | 11), this.st = true, op;
		case 0xcc: // JMP 12
			return this.st && (this.pc = this.pc & ~63 | 12), this.st = true, op;
		case 0xcd: // JMP 13
			return this.st && (this.pc = this.pc & ~63 | 13), this.st = true, op;
		case 0xce: // JMP 14
			return this.st && (this.pc = this.pc & ~63 | 14), this.st = true, op;
		case 0xcf: // JMP 15
			return this.st && (this.pc = this.pc & ~63 | 15), this.st = true, op;
		case 0xd0: // JMP 16
			return this.st && (this.pc = this.pc & ~63 | 16), this.st = true, op;
		case 0xd1: // JMP 17
			return this.st && (this.pc = this.pc & ~63 | 17), this.st = true, op;
		case 0xd2: // JMP 18
			return this.st && (this.pc = this.pc & ~63 | 18), this.st = true, op;
		case 0xd3: // JMP 19
			return this.st && (this.pc = this.pc & ~63 | 19), this.st = true, op;
		case 0xd4: // JMP 20
			return this.st && (this.pc = this.pc & ~63 | 20), this.st = true, op;
		case 0xd5: // JMP 21
			return this.st && (this.pc = this.pc & ~63 | 21), this.st = true, op;
		case 0xd6: // JMP 22
			return this.st && (this.pc = this.pc & ~63 | 22), this.st = true, op;
		case 0xd7: // JMP 23
			return this.st && (this.pc = this.pc & ~63 | 23), this.st = true, op;
		case 0xd8: // JMP 24
			return this.st && (this.pc = this.pc & ~63 | 24), this.st = true, op;
		case 0xd9: // JMP 25
			return this.st && (this.pc = this.pc & ~63 | 25), this.st = true, op;
		case 0xda: // JMP 26
			return this.st && (this.pc = this.pc & ~63 | 26), this.st = true, op;
		case 0xdb: // JMP 27
			return this.st && (this.pc = this.pc & ~63 | 27), this.st = true, op;
		case 0xdc: // JMP 28
			return this.st && (this.pc = this.pc & ~63 | 28), this.st = true, op;
		case 0xdd: // JMP 29
			return this.st && (this.pc = this.pc & ~63 | 29), this.st = true, op;
		case 0xde: // JMP 30
			return this.st && (this.pc = this.pc & ~63 | 30), this.st = true, op;
		case 0xdf: // JMP 31
			return this.st && (this.pc = this.pc & ~63 | 31), this.st = true, op;
		case 0xe0: // JMP 32
			return this.st && (this.pc = this.pc & ~63 | 32), this.st = true, op;
		case 0xe1: // JMP 33
			return this.st && (this.pc = this.pc & ~63 | 33), this.st = true, op;
		case 0xe2: // JMP 34
			return this.st && (this.pc = this.pc & ~63 | 34), this.st = true, op;
		case 0xe3: // JMP 35
			return this.st && (this.pc = this.pc & ~63 | 35), this.st = true, op;
		case 0xe4: // JMP 36
			return this.st && (this.pc = this.pc & ~63 | 36), this.st = true, op;
		case 0xe5: // JMP 37
			return this.st && (this.pc = this.pc & ~63 | 37), this.st = true, op;
		case 0xe6: // JMP 38
			return this.st && (this.pc = this.pc & ~63 | 38), this.st = true, op;
		case 0xe7: // JMP 39
			return this.st && (this.pc = this.pc & ~63 | 39), this.st = true, op;
		case 0xe8: // JMP 40
			return this.st && (this.pc = this.pc & ~63 | 40), this.st = true, op;
		case 0xe9: // JMP 41
			return this.st && (this.pc = this.pc & ~63 | 41), this.st = true, op;
		case 0xea: // JMP 42
			return this.st && (this.pc = this.pc & ~63 | 42), this.st = true, op;
		case 0xeb: // JMP 43
			return this.st && (this.pc = this.pc & ~63 | 43), this.st = true, op;
		case 0xec: // JMP 44
			return this.st && (this.pc = this.pc & ~63 | 44), this.st = true, op;
		case 0xed: // JMP 45
			return this.st && (this.pc = this.pc & ~63 | 45), this.st = true, op;
		case 0xee: // JMP 46
			return this.st && (this.pc = this.pc & ~63 | 46), this.st = true, op;
		case 0xef: // JMP 47
			return this.st && (this.pc = this.pc & ~63 | 47), this.st = true, op;
		case 0xf0: // JMP 48
			return this.st && (this.pc = this.pc & ~63 | 48), this.st = true, op;
		case 0xf1: // JMP 49
			return this.st && (this.pc = this.pc & ~63 | 49), this.st = true, op;
		case 0xf2: // JMP 50
			return this.st && (this.pc = this.pc & ~63 | 50), this.st = true, op;
		case 0xf3: // JMP 51
			return this.st && (this.pc = this.pc & ~63 | 51), this.st = true, op;
		case 0xf4: // JMP 52
			return this.st && (this.pc = this.pc & ~63 | 52), this.st = true, op;
		case 0xf5: // JMP 53
			return this.st && (this.pc = this.pc & ~63 | 53), this.st = true, op;
		case 0xf6: // JMP 54
			return this.st && (this.pc = this.pc & ~63 | 54), this.st = true, op;
		case 0xf7: // JMP 55
			return this.st && (this.pc = this.pc & ~63 | 55), this.st = true, op;
		case 0xf8: // JMP 56
			return this.st && (this.pc = this.pc & ~63 | 56), this.st = true, op;
		case 0xf9: // JMP 57
			return this.st && (this.pc = this.pc & ~63 | 57), this.st = true, op;
		case 0xfa: // JMP 58
			return this.st && (this.pc = this.pc & ~63 | 58), this.st = true, op;
		case 0xfb: // JMP 59
			return this.st && (this.pc = this.pc & ~63 | 59), this.st = true, op;
		case 0xfc: // JMP 60
			return this.st && (this.pc = this.pc & ~63 | 60), this.st = true, op;
		case 0xfd: // JMP 61
			return this.st && (this.pc = this.pc & ~63 | 61), this.st = true, op;
		case 0xfe: // JMP 62
			return this.st && (this.pc = this.pc & ~63 | 62), this.st = true, op;
		case 0xff: // JMP 63
			return this.st && (this.pc |= 63), this.st = true, op;
		}
	}

	push(addr) {
		this.stack[this.sp] = addr, this.sp = this.sp - 1 & 3;
	}

	pop() {
		return this.sp = this.sp + 1 & 3, this.stack[this.sp];
	}

	fetch() {
		const data = this.rom[this.pc];
		return this.pc = this.pc + 1 & 0x7ff, data;
	}
}

const cc = Uint8Array.of(
	 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2,
	 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
	 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);

