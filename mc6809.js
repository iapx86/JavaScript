/*
 *
 *	MC6809 Emulator
 *
 */

let aAdd = []; // [2][0x100][0x100];
let aSub = []; // [2][0x100][0x100];
let aDaa = []; // [4][0x100];
let aRl = []; // [2][0x100];
let aRr = []; // [2][0x100];
let fLogic = new Uint8Array(0x100);
let dummypage = new Uint8Array(0x100).fill(0xff);

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
	for (i = 0; i < 4; i++)
		aDaa[i] = new Uint16Array(0x100);
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
				if (r > 0x7f || r < -0x80)
					f |= 2;
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
				if (r > 0x7f || r < -0x80)
					f |= 2;
				f |= (r ^ j << 1 ^ k << 1) >>> 8 & 1;
				aSub[i][k][j] = f << 8 | r & 0xff;
			}
	for (i = 0; i < 0x100; i++) {
		f = i >>> 4 & 8;
		if (!i)
			f |= 4;
		fLogic[i] = f;
	}
	for (i = 0; i < 4; i++)
		for (j = 0; j < 0x100; j++) {
			f = i << 4 & 0x20 | i & 1;
			r = j;
			k = 0;
			if ((f & 0x20) !== 0 || (r & 0x0f) > 9)
				k = 6;
			if ((f & 1) !== 0 || (r & 0xf0) > 0x90 || (r & 0xf0) > 0x80 && (r & 0x0f) > 9)
				k += 0x60;
			if ((r += k) >= 0x100)
				f |= 1;
			f |= fLogic[r & 0xff];
			aDaa[i][j] = f << 8 | r & 0xff;
		}
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++) {
			r = j << 1 | i;
			aRl[i][j] = fLogic[r & 0xff] << 8 | r;
			if (((j ^ j << 1) & 0x80) !== 0)
				aRl[i][j] |= 0x0200;
		}
	for (i = 0; i < 2; i++)
		for (j = 0; j < 0x100; j++) {
			r = j >>> 1 | i << 7;
			aRr[i][j] = (fLogic[r] | j & 1) << 8 | r;
		}
})();

class Cpu {
	constructor(arg = null) {
		this.fActive = false;
		this.fSuspend = false;
		this.pc = 0;
		this.memorymap = [];
		for (let i = 0; i < 0x100; i++)
			this.memorymap.push({base: dummypage, read: null, write: (addr, data) => data, fetch: null});
		this.breakpointmap = new Uint32Array(0x800);
		this.breakpoint = null;
		this.undef = null;
		this.undefsize = 0;
		this.arg = arg;
	}

	set_breakpoint(addr) {
		this.breakpointmap[addr >>> 5] |= 1 << (addr & 0x1f);
	}

	clear_breakpoint(addr) {
		this.breakpointmap[addr >>> 5] &= ~(1 << (addr & 0x1f));
	}

	clear_all_breakpoint() {
		this.breakpointmap.fill(0);
	}

	reset() {
		this.fActive = true;
		this.fSuspend = false;
	}

	enable() {
		if (this.fActive)
			return;
		this.reset();
	}

	disable() {
		this.fActive = false;
	}

	suspend() {
		if (!this.fActive || this.fSuspend)
			return;
		this.fSuspend = true;
	}

	resume() {
		if (!this.fActive || !this.fSuspend)
			return;
		this.fSuspend = false;
	}

	interrupt() {
		if (!this.fActive)
			return false;
		this.resume();
		return true;
	}

	static multiple_execute(cpu, count) {
		const n = cpu.length;
		for (let i = 0; i < count; i++)
			for (let j = 0; j < n; j++) {
				if (!cpu[j].fActive || cpu[j].fSuspend)
					continue;
				if (cpu[j].breakpoint && (cpu[j].breakpointmap[cpu[j].pc >>> 5] & 1 << (cpu[j].pc & 0x1f)) !== 0)
					cpu[j].breakpoint(cpu[j].pc, cpu[j].arg);
				cpu[j]._execute();
			}
	}

	execute(count) {
		for (let i = 0; i < count; i++) {
			if (!this.fActive || this.fSuspend)
				break;
			if (this.breakpoint && (this.breakpointmap[this.pc >>> 5] & 1 << (this.pc & 0x1f)) !== 0)
				this.breakpoint(this.pc, this.arg);
			this._execute();
		}
	}

	_execute() {
	}

	fetch() {
//		const page = this.memorymap[this.pc >>> 8];
//		const data = !page.fetch ? page.base[this.pc & 0xff] : page.fetch(this.pc, this.arg);
		const data = this.memorymap[this.pc >>> 8].base[this.pc & 0xff];

		this.pc = this.pc + 1 & 0xffff;
		return data;
	}

	read(addr) {
		const page = this.memorymap[addr >>> 8];

		return !page.read ? page.base[addr & 0xff] : page.read(addr, this.arg);
	}

	read1(addr) {
		const page = this.memorymap[(addr = addr + 1 & 0xffff) >>> 8];

		return !page.read ? page.base[addr & 0xff] : page.read(addr, this.arg);
	}

	write(addr, data) {
		const page = this.memorymap[addr >>> 8];

		if (!page.write)
			page.base[addr & 0xff] = data;
		else
			page.write(addr, data, this.arg);
		return data;
	}

	write1(addr, data) {
		const page = this.memorymap[(addr = addr + 1 & 0xffff) >>> 8];

		if (!page.write)
			page.base[addr & 0xff] = data;
		else
			page.write(addr, data, this.arg);
		return data;
	}
}

class MC6809 extends Cpu {
	constructor(arg = null) {
		super(arg);
		this.a = 0;
		this.b = 0;
		this.dp = 0;
		this.ccr = 0; // ccr:efhinzvc
		this.x = 0;
		this.y = 0;
		this.u = 0;
		this.s = 0;
	}

	reset() {
		super.reset();
		this.ccr = 0x50;
		this.dp = 0;
		this.pc = this.read(0xfffe) << 8 | this.read(0xffff);
	}

	fast_interrupt() {
		if (!super.interrupt() || (this.ccr & 0x40) !== 0)
			return false;
		this.pshs16(this.pc);
		this.pshs(this.ccr &= ~0x80);
		this.ccr |= 0x50;
		this.pc = this.read(0xfff6) << 8 | this.read(0xfff7);
		return true;
	}

	interrupt() {
		if (!super.interrupt() || (this.ccr & 0x10) !== 0)
			return false;
		this.pshs16(this.pc);
		this.pshs16(this.u);
		this.pshs16(this.y);
		this.pshs16(this.x);
		this.pshs(this.dp);
		this.pshs(this.b);
		this.pshs(this.a);
		this.pshs(this.ccr |= 0x80);
		this.ccr |= 0x10;
		this.pc = this.read(0xfff8) << 8 | this.read(0xfff9);
		return true;
	}

	non_maskable_interrupt() {
		if (!super.interrupt())
			return false;
		this.pshs16(this.pc);
		this.pshs16(this.u);
		this.pshs16(this.y);
		this.pshs16(this.x);
		this.pshs(this.dp);
		this.pshs(this.b);
		this.pshs(this.a);
		this.pshs(this.ccr |= 0x80);
		this.ccr |= 0x50;
		this.pc = this.read(0xfffc) << 8 | this.read(0xfffd);
		return true;
	}

	_execute() {
		let v;

		switch (this.fetch()) {
		case 0x00: // NEG <n
			this.neg(this.direct());
			break;
		case 0x03: // COM <n
			this.com(this.direct());
			break;
		case 0x04: // LSR <n
			this.lsr(this.direct());
			break;
		case 0x06: // ROR <n
			this.ror(this.direct());
			break;
		case 0x07: // ASR <n
			this.asr(this.direct());
			break;
		case 0x08: // LSL <n
			this.lsl(this.direct());
			break;
		case 0x09: // ROL <n
			this.rol(this.direct());
			break;
		case 0x0a: // DEC <n
			this.dec(this.direct());
			break;
		case 0x0c: // INC <n
			this.inc(this.direct());
			break;
		case 0x0d: // TST <n
			this.tst(this.direct());
			break;
		case 0x0e: // JMP <n
			this.pc = this.direct();
			break;
		case 0x0f: // CLR <n
			this.clr(this.direct());
			break;
		case 0x10:
			switch (this.fetch()) {
			case 0x21: // LBRN
				this.lbcc(false);
				break;
			case 0x22: // LBHI
				this.lbcc(((this.ccr >>> 2 | this.ccr) & 1) === 0);
				break;
			case 0x23: // LBLS
				this.lbcc(((this.ccr >>> 2 | this.ccr) & 1) !== 0);
				break;
			case 0x24: // LBHS(LBCC)
				this.lbcc((this.ccr & 1) === 0);
				break;
			case 0x25: // LBLO(LBCS)
				this.lbcc((this.ccr & 1) !== 0);
				break;
			case 0x26: // LBNE
				this.lbcc((this.ccr & 4) === 0);
				break;
			case 0x27: // LBEQ
				this.lbcc((this.ccr & 4) !== 0);
				break;
			case 0x28: // LBVC
				this.lbcc((this.ccr & 2) === 0);
				break;
			case 0x29: // LBVS
				this.lbcc((this.ccr & 2) !== 0);
				break;
			case 0x2a: // LBPL
				this.lbcc((this.ccr & 8) === 0);
				break;
			case 0x2b: // LBMI
				this.lbcc((this.ccr & 8) !== 0);
				break;
			case 0x2c: // LBGE
				this.lbcc(((this.ccr >>> 2 ^ this.ccr) & 2) === 0);
				break;
			case 0x2d: // LBLT
				this.lbcc(((this.ccr >>> 2 ^ this.ccr) & 2) !== 0);
				break;
			case 0x2e: // LBGT
				this.lbcc(((this.ccr >>> 2 ^ this.ccr | this.ccr >>> 1) & 2) === 0);
				break;
			case 0x2f: // LBLE
				this.lbcc(((this.ccr >>> 2 ^ this.ccr | this.ccr >>> 1) & 2) !== 0);
				break;
			case 0x3f: // SWI2
				this.pshs16(this.pc);
				this.pshs16(this.u);
				this.pshs16(this.y);
				this.pshs16(this.x);
				this.pshs(this.dp);
				this.pshs(this.b);
				this.pshs(this.a);
				this.pshs(this.ccr |= 0x80);
				this.pc = this.read(0xfff4) << 8 | this.read(0xfff5);
				break;
			case 0x83: // CMPD #nn
				this.cmp16(this.a << 8 | this.b, null);
				break;
			case 0x8c: // CMPY #nn
				this.cmp16(this.y, null);
				break;
			case 0x8e: // LDY #nn
				this.y = this.ld16(null);
				break;
			case 0x93: // CMPD <n
				this.cmp16(this.a << 8 | this.b, this.direct());
				break;
			case 0x9c: // CMPY <n
				this.cmp16(this.y, this.direct());
				break;
			case 0x9e: // LDY <n
				this.y = this.ld16(this.direct());
				break;
			case 0x9f: // STY <n
				this.st16(this.y, this.direct());
				break;
			case 0xa3: // CMPD ,r
				this.cmp16(this.a << 8 | this.b, this.index());
				break;
			case 0xac: // CMPY ,r
				this.cmp16(this.y, this.index());
				break;
			case 0xae: // LDY ,r
				this.y = this.ld16(this.index());
				break;
			case 0xaf: // STY ,r
				this.st16(this.y, this.index());
				break;
			case 0xb3: // CMPD >nn
				this.cmp16(this.a << 8 | this.b, this.extend());
				break;
			case 0xbc: // CMPY >nn
				this.cmp16(this.y, this.extend());
				break;
			case 0xbe: // LDY >nn
				this.y = this.ld16(this.extend());
				break;
			case 0xbf: // STY >nn
				this.st16(this.y, this.extend());
				break;
			case 0xce: // LDS #nn
				this.s = this.ld16(null);
				break;
			case 0xde: // LDS <n
				this.s = this.ld16(this.direct());
				break;
			case 0xdf: // STS <n
				this.st16(this.s, this.direct());
				break;
			case 0xee: // LDS ,r
				this.s = this.ld16(this.index());
				break;
			case 0xef: // STS ,r
				this.st16(this.s, this.index());
				break;
			case 0xfe: // LDS >nn
				this.s = this.ld16(this.extend());
				break;
			case 0xff: // STS >nn
				this.st16(this.s, this.extend());
				break;
			default:
				this.undefsize = 2;
				if (this.undef)
					this.undef(this.arg);
				break;
			}
			break;
		case 0x11:
			switch (this.fetch()) {
			case 0x3f: // SWI3
				this.pshs16(this.pc);
				this.pshs16(this.u);
				this.pshs16(this.y);
				this.pshs16(this.x);
				this.pshs(this.dp);
				this.pshs(this.b);
				this.pshs(this.a);
				this.pshs(this.ccr |= 0x80);
				this.pc = this.read(0xfff2) << 8 | this.read(0xfff3);
				break;
			case 0x83: // CMPU #nn
				this.cmp16(this.u, null);
				break;
			case 0x8c: // CMPS #nn
				this.cmp16(this.s, null);
				break;
			case 0x93: // CMPU <n
				this.cmp16(this.u, this.direct());
				break;
			case 0x9c: // CMPS <n
				this.cmp16(this.s, this.direct());
				break;
			case 0xa3: // CMPU ,r
				this.cmp16(this.u, this.index());
				break;
			case 0xac: // CMPS ,r
				this.cmp16(this.s, this.index());
				break;
			case 0xb3: // CMPU >nn
				this.cmp16(this.u, this.extend());
				break;
			case 0xbc: // CMPS >nn
				this.cmp16(this.s, this.extend());
				break;
			default:
				this.undefsize = 2;
				if (this.undef)
					this.undef(this.arg);
				break;
			}
			break;
		case 0x12: // NOP
			break;
		case 0x13: // SYNC
			this.suspend();
			break;
		case 0x16: // LBRA
			this.lbcc(true);
			break;
		case 0x17: // LBSR
			this.lbsr();
			break;
		case 0x19: // DAA
			this.a = (v = aDaa[this.ccr >>> 4 & 2 | this.ccr & 1][this.a]) & 0xff;
			this.ccr = this.ccr & ~0x2f | v >>> 8;
			break;
		case 0x1a: // ORCC
			this.ccr |= this.fetch();
			break;
		case 0x1c: // ANDCC
			this.ccr &= this.fetch();
			break;
		case 0x1d: // SEX
			if ((this.b & 0x80) !== 0) {
				this.a = 0xff;
				this.ccr = this.ccr & ~4 | 8;
			}
			else {
				this.a = 0;
				this.ccr = this.ccr & ~8 | 4;
			}
			break;
		case 0x1e: // EXG
			switch (this.fetch()) {
			case 0x00: // EXG D,D
			case 0x11: // EXG X,X
			case 0x22: // EXG Y,Y
			case 0x33: // EXG U,U
			case 0x44: // EXG S,S
			case 0x55: // EXG PC,PC
			case 0x88: // EXG A,A
			case 0x99: // EXG B,B
			case 0xaa: // EXG CCR,CCR
			case 0xbb: // EXG DP,DP
				break;
			case 0x01: // EXG D,X
			case 0x10: // EXG X,D
				v = this.x;
				this.x = this.a << 8 | this.b;
				this.a = v >>> 8;
				this.b = v & 0xff;
				break;
			case 0x02: // EXG D,Y
			case 0x20: // EXG Y,D
				v = this.y;
				this.y = this.a << 8 | this.b;
				this.a = v >>> 8;
				this.b = v & 0xff;
				break;
			case 0x03: // EXG D,U
			case 0x30: // EXG U,D
				v = this.u;
				this.u = this.a << 8 | this.b;
				this.a = v >>> 8;
				this.b = v & 0xff;
				break;
			case 0x04: // EXG D,S
			case 0x40: // EXG S,D
				v = this.s;
				this.s = this.a << 8 | this.b;
				this.a = v >>> 8;
				this.b = v & 0xff;
				break;
			case 0x05: // EXG D,PC
			case 0x50: // EXG PC,D
				v = this.pc;
				this.pc = this.a << 8 | this.b;
				this.a = v >>> 8;
				this.b = v & 0xff;
				break;
			case 0x12: // EXG X,Y
			case 0x21: // EXG Y,X
				v = this.y;
				this.y = this.x;
				this.x = v;
				break;
			case 0x13: // EXG X,U
			case 0x31: // EXG U,X
				v = this.u;
				this.u = this.x;
				this.x = v;
				break;
			case 0x14: // EXG X,S
			case 0x41: // EXG S,X
				v = this.s;
				this.s = this.x;
				this.x = v;
				break;
			case 0x15: // EXG X,PC
			case 0x51: // EXG PC,X
				v = this.pc;
				this.pc = this.x;
				this.x = v;
				break;
			case 0x23: // EXG Y,U
			case 0x32: // EXG U,Y
				v = this.u;
				this.u = this.y;
				this.y = v;
				break;
			case 0x24: // EXG Y,S
			case 0x42: // EXG S,Y
				v = this.s;
				this.s = this.y;
				this.y = v;
				break;
			case 0x25: // EXG Y,PC
			case 0x52: // EXG PC,Y
				v = this.pc;
				this.pc = this.y;
				this.y = v;
				break;
			case 0x34: // EXG U,S
			case 0x43: // EXG S,U
				v = this.s;
				this.s = this.u;
				this.u = v;
				break;
			case 0x35: // EXG U,PC
			case 0x53: // EXG PC,U
				v = this.pc;
				this.pc = this.u;
				this.u = v;
				break;
			case 0x45: // EXG S,PC
			case 0x54: // EXG PC,S
				v = this.pc;
				this.pc = this.s;
				this.s = v;
				break;
			case 0x89: // EXG A,B
			case 0x98: // EXG B,A
				v = this.b;
				this.b = this.a;
				this.a = v;
				break;
			case 0x8a: // EXG A,CCR
			case 0xa8: // EXG CCR,A
				v = this.ccr;
				this.ccr = this.a;
				this.a = v;
				break;
			case 0x8b: // EXG A,DP
			case 0xb8: // EXG DP,A
				v = this.dp;
				this.dp = this.a;
				this.a = v;
				break;
			case 0x9a: // EXG B,CCR
			case 0xa9: // EXG CCR,B
				v = this.ccr;
				this.ccr = this.b;
				this.b = v;
				break;
			case 0x9b: // EXG B,DP
			case 0xb9: // EXG DP,B
				v = this.dp;
				this.dp = this.b;
				this.b = v;
				break;
			case 0xab: // EXG CCR,DP
			case 0xba: // EXG DP,CCR
				v = this.dp;
				this.dp = this.ccr;
				this.ccr = v;
				break;
			default:
				this.undefsize = 2;
				if (this.undef)
					this.undef(this.arg);
				break;
			}
			break;
		case 0x1f: // TFR
			switch (this.fetch()) {
			case 0x00: // TFR D,D
			case 0x11: // TFR X,X
			case 0x22: // TFR Y,Y
			case 0x33: // TFR U,U
			case 0x44: // TFR S,S
			case 0x55: // TFR PC,PC
			case 0x88: // TFR A,A
			case 0x99: // TFR B,B
			case 0xaa: // TFR CCR,CCR
			case 0xbb: // TFR DP,DP
				break;
			case 0x01: // TFR D,X
				this.x = this.a << 8 | this.b;
				break;
			case 0x02: // TFR D,Y
				this.y = this.a << 8 | this.b;
				break;
			case 0x03: // TFR D,U
				this.u = this.a << 8 | this.b;
				break;
			case 0x04: // TFR D,S
				this.s = this.a << 8 | this.b;
				break;
			case 0x05: // TFR D,PC
				this.pc = this.a << 8 | this.b;
				break;
			case 0x10: // TFR X,D
				this.a = this.x >>> 8;
				this.b = this.x & 0xff;
				break;
			case 0x12: // TFR X,Y
				this.y = this.x;
				break;
			case 0x13: // TFR X,U
				this.u = this.x;
				break;
			case 0x14: // TFR X,S
				this.s = this.x;
				break;
			case 0x15: // TFR X,PC
				this.pc = this.x;
				break;
			case 0x20: // TFR Y,D
				this.a = this.y >>> 8;
				this.b = this.y & 0xff;
				break;
			case 0x21: // TFR Y,X
				this.x = this.y;
				break;
			case 0x23: // TFR Y,U
				this.u = this.y;
				break;
			case 0x24: // TFR Y,S
				this.s = this.y;
				break;
			case 0x25: // TFR Y,PC
				this.pc = this.y;
				break;
			case 0x30: // TFR U,D
				this.a = this.u >>> 8;
				this.b = this.u & 0xff;
				break;
			case 0x31: // TFR U,X
				this.x = this.u;
				break;
			case 0x32: // TFR U,Y
				this.y = this.u;
				break;
			case 0x34: // TFR U,S
				this.s = this.u;
				break;
			case 0x35: // TFR U,PC
				this.pc = this.u;
				break;
			case 0x40: // TFR S,D
				this.a = this.s >>> 8;
				this.b = this.s & 0xff;
				break;
			case 0x41: // TFR S,X
				this.x = this.s;
				break;
			case 0x42: // TFR S,Y
				this.y = this.s;
				break;
			case 0x43: // TFR S,U
				this.u = this.s;
				break;
			case 0x45: // TFR S,PC
				this.pc = this.s;
				break;
			case 0x50: // TFR PC,D
				this.a = this.pc >>> 8;
				this.b = this.pc & 0xff;
				break;
			case 0x51: // TFR PC,X
				this.x = this.pc;
				break;
			case 0x52: // TFR PC,Y
				this.y = this.pc;
				break;
			case 0x53: // TFR PC,U
				this.u = this.pc;
				break;
			case 0x54: // TFR PC,S
				this.s = this.pc;
				break;
			case 0x89: // TFR A,B
				this.b = this.a;
				break;
			case 0x8a: // TFR A,CCR
				this.ccr = this.a;
				break;
			case 0x8b: // TFR A,DP
				this.dp = this.a;
				break;
			case 0x98: // TFR B,A
				this.a = this.b;
				break;
			case 0x9a: // TFR B,CCR
				this.ccr = this.b;
				break;
			case 0x9b: // TFR B,DP
				this.dp = this.b;
				break;
			case 0xa8: // TFR CCR,A
				this.a = this.ccr;
				break;
			case 0xa9: // TFR CCR,B
				this.b = this.ccr;
				break;
			case 0xab: // TFR CCR,DP
				this.dp = this.ccr;
				break;
			case 0xb8: // TFR DP,A
				this.a = this.dp;
				break;
			case 0xb9: // TFR DP,B
				this.b = this.dp;
				break;
			case 0xba: // TFR DP,CCR
				this.ccr = this.dp;
				break;
			default:
				this.undefsize = 2;
				if (this.undef)
					this.undef(this.arg);
				break;
			}
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
		case 0x24: // BHS(BCC)
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
		case 0x28: // BVC
			this.bcc((this.ccr & 2) === 0);
			break;
		case 0x29: // BVS
			this.bcc((this.ccr & 2) !== 0);
			break;
		case 0x2a: // BPL
			this.bcc((this.ccr & 8) === 0);
			break;
		case 0x2b: // BMI
			this.bcc((this.ccr & 8) !== 0);
			break;
		case 0x2c: // BGE
			this.bcc(((this.ccr >>> 2 ^ this.ccr) & 2) === 0);
			break;
		case 0x2d: // BLT
			this.bcc(((this.ccr >>> 2 ^ this.ccr) & 2) !== 0);
			break;
		case 0x2e: // BGT
			this.bcc(((this.ccr >>> 2 ^ this.ccr | this.ccr >>> 1) & 2) === 0);
			break;
		case 0x2f: // BLE
			this.bcc(((this.ccr >>> 2 ^ this.ccr | this.ccr >>> 1) & 2) !== 0);
			break;
		case 0x30: // LEAX
			this.ccr = this.ccr & ~4 | !(this.x = this.index()) << 2;
			break;
		case 0x31: // LEAY
			this.ccr = this.ccr & ~4 | !(this.y = this.index()) << 2;
			break;
		case 0x32: // LEAS
			this.s = this.index();
			break;
		case 0x33: // LEAU
			this.u = this.index();
			break;
		case 0x34: // PSHS
			if (((v = this.fetch()) & 0x80) !== 0)
				this.pshs16(this.pc);
			if ((v & 0x40) !== 0)
				this.pshs16(this.u);
			if ((v & 0x20) !== 0)
				this.pshs16(this.y);
			if ((v & 0x10) !== 0)
				this.pshs16(this.x);
			if ((v & 8) !== 0)
				this.pshs(this.dp);
			if ((v & 4) !== 0)
				this.pshs(this.b);
			if ((v & 2) !== 0)
				this.pshs(this.a);
			if ((v & 1) !== 0)
				this.pshs(this.ccr);
			break;
		case 0x35: // PULS
			if (((v = this.fetch()) & 1) !== 0)
				this.ccr = this.puls();
			if ((v & 2) !== 0)
				this.a = this.puls();
			if ((v & 4) !== 0)
				this.b = this.puls();
			if ((v & 8) !== 0)
				this.dp = this.puls();
			if ((v & 0x10) !== 0)
				this.x = this.puls16();
			if ((v & 0x20) !== 0)
				this.y = this.puls16();
			if ((v & 0x40) !== 0)
				this.u = this.puls16();
			if ((v & 0x80) !== 0)
				this.pc = this.puls16();
			break;
		case 0x36: // PSHU
			if (((v = this.fetch()) & 0x80) !== 0)
				this.pshu16(this.pc);
			if ((v & 0x40) !== 0)
				this.pshu16(this.s);
			if ((v & 0x20) !== 0)
				this.pshu16(this.y);
			if ((v & 0x10) !== 0)
				this.pshu16(this.x);
			if ((v & 8) !== 0)
				this.pshu(this.dp);
			if ((v & 4) !== 0)
				this.pshu(this.b);
			if ((v & 2) !== 0)
				this.pshu(this.a);
			if ((v & 1) !== 0)
				this.pshu(this.ccr);
			break;
		case 0x37: // PULU
			if (((v = this.fetch()) & 1) !== 0)
				this.ccr = this.pulu();
			if ((v & 2) !== 0)
				this.a = this.pulu();
			if ((v & 4) !== 0)
				this.b = this.pulu();
			if ((v & 8) !== 0)
				this.dp = this.pulu();
			if ((v & 0x10) !== 0)
				this.x = this.pulu16();
			if ((v & 0x20) !== 0)
				this.y = this.pulu16();
			if ((v & 0x40) !== 0)
				this.s = this.pulu16();
			if ((v & 0x80) !== 0)
				this.pc = this.pulu16();
			break;
		case 0x39: // RTS
			this.pc = this.puls16();
			break;
		case 0x3a: // ABX
			this.x = this.x + this.b & 0xffff;
			break;
		case 0x3b: // RTI
			if (((this.ccr = this.puls()) & 0x80) !== 0) {
				this.a = this.puls();
				this.b = this.puls();
				this.dp = this.puls();
				this.x = this.puls16();
				this.y = this.puls16();
				this.u = this.puls16();
			}
			this.pc = this.puls16();
			break;
		case 0x3c: // CWAI
			this.ccr &= this.fetch();
			this.suspend();
			break;
		case 0x3d: // MUL
			this.a = (v = this.a * this.b) >>> 8;
			this.b = v & 0xff;
			this.ccr = this.ccr & ~5 | !v << 2 | v >>> 7 & 1;
			break;
		case 0x3f: // SWI
			this.pshs16(this.pc);
			this.pshs16(this.u);
			this.pshs16(this.y);
			this.pshs16(this.x);
			this.pshs(this.dp);
			this.pshs(this.b);
			this.pshs(this.a);
			this.pshs(this.ccr |= 0x80);
			this.ccr |= 0x50;
			this.pc = this.read(0xfffa) << 8 | this.read(0xfffb);
			break;
		case 0x40: // NEGA
			this.a = this.nega(this.a);
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
		case 0x48: // LSLA
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
		case 0x50: // NEGB
			this.b = this.nega(this.b);
			break;
		case 0x53: // COMB
			this.b = this.coma(this.b);
			break;
		case 0x54: // LSRB
			this.b = this.lsra(this.b);
			break;
		case 0x56: // RORB
			this.b = this.rora(this.b);
			break;
		case 0x57: // ASRB
			this.b = this.asra(this.b);
			break;
		case 0x58: // LSLB
			this.b = this.lsla(this.b);
			break;
		case 0x59: // ROLB
			this.b = this.rola(this.b);
			break;
		case 0x5a: // DECB
			this.b = this.deca(this.b);
			break;
		case 0x5c: // INCB
			this.b = this.inca(this.b);
			break;
		case 0x5d: // TSTB
			this.tsta(this.b);
			break;
		case 0x5f: // CLRB
			this.b = this.clra();
			break;
		case 0x60: // NEG ,r
			this.neg(this.index());
			break;
		case 0x63: // COM ,r
			this.com(this.index());
			break;
		case 0x64: // LSR ,r
			this.lsr(this.index());
			break;
		case 0x66: // ROR ,r
			this.ror(this.index());
			break;
		case 0x67: // ASR ,r
			this.asr(this.index());
			break;
		case 0x68: // LSL ,r
			this.lsl(this.index());
			break;
		case 0x69: // ROL ,r
			this.rol(this.index());
			break;
		case 0x6a: // DEC ,r
			this.dec(this.index());
			break;
		case 0x6c: // INC ,r
			this.inc(this.index());
			break;
		case 0x6d: // TST ,r
			this.tst(this.index());
			break;
		case 0x6e: // JMP ,r
			this.pc = this.index();
			break;
		case 0x6f: // CLR ,r
			this.clr(this.index());
			break;
		case 0x70: // NEG >nn
			this.neg(this.extend());
			break;
		case 0x73: // COM >nn
			this.com(this.extend());
			break;
		case 0x74: // LSR >nn
			this.lsr(this.extend());
			break;
		case 0x76: // ROR >nn
			this.ror(this.extend());
			break;
		case 0x77: // ASR >nn
			this.asr(this.extend());
			break;
		case 0x78: // LSL >nn
			this.lsl(this.extend());
			break;
		case 0x79: // ROL >nn
			this.rol(this.extend());
			break;
		case 0x7a: // DEC >nn
			this.dec(this.extend());
			break;
		case 0x7c: // INC >nn
			this.inc(this.extend());
			break;
		case 0x7d: // TST >nn
			this.tst(this.extend());
			break;
		case 0x7e: // JMP >nn
			this.pc = this.extend();
			break;
		case 0x7f: // CLR >nn
			this.clr(this.extend());
			break;
		case 0x80: // SUBA #n
			this.a = this.sub(this.a, null);
			break;
		case 0x81: // CMPA #n
			this.cmp(this.a, null);
			break;
		case 0x82: // SBCA #n
			this.a = this.sbc(this.a, null);
			break;
		case 0x83: // SUBD #nn
			this.subd(null);
			break;
		case 0x84: // ANDA #n
			this.a = this.and(this.a, null);
			break;
		case 0x85: // BITA #n
			this.bit(this.a, null);
			break;
		case 0x86: // LDA #n
			this.a = this.ld(null);
			break;
		case 0x88: // EORA #n
			this.a = this.eor(this.a, null);
			break;
		case 0x89: // ADCA #n
			this.a = this.adc(this.a, null);
			break;
		case 0x8a: // ORA #n
			this.a = this.or(this.a, null);
			break;
		case 0x8b: // ADDA #n
			this.a = this.add(this.a, null);
			break;
		case 0x8c: // CMPX #nn
			this.cmp16(this.x, null);
			break;
		case 0x8d: // BSR
			this.bsr();
			break;
		case 0x8e: // LDX #nn
			this.x = this.ld16(null);
			break;
		case 0x90: // SUBA <n
			this.a = this.sub(this.a, this.direct());
			break;
		case 0x91: // CMPA <n
			this.cmp(this.a, this.direct());
			break;
		case 0x92: // SBCA <n
			this.a = this.sbc(this.a, this.direct());
			break;
		case 0x93: // SUBD <n
			this.subd(this.direct());
			break;
		case 0x94: // ANDA <n
			this.a = this.and(this.a, this.direct());
			break;
		case 0x95: // BITA <n
			this.bit(this.a, this.direct());
			break;
		case 0x96: // LDA <n
			this.a = this.ld(this.direct());
			break;
		case 0x97: // STA <n
			this.st(this.a, this.direct());
			break;
		case 0x98: // EORA <n
			this.a = this.eor(this.a, this.direct());
			break;
		case 0x99: // ADCA <n
			this.a = this.adc(this.a, this.direct());
			break;
		case 0x9a: // ORA <n
			this.a = this.or(this.a, this.direct());
			break;
		case 0x9b: // ADDA <n
			this.a = this.add(this.a, this.direct());
			break;
		case 0x9c: // CMPX <n
			this.cmp16(this.x, this.direct());
			break;
		case 0x9d: // JSR <n
			this.jsr(this.direct());
			break;
		case 0x9e: // LDX <n
			this.x = this.ld16(this.direct());
			break;
		case 0x9f: // STX <n
			this.st16(this.x, this.direct());
			break;
		case 0xa0: // SUBA ,r
			this.a = this.sub(this.a, this.index());
			break;
		case 0xa1: // CMPA ,r
			this.cmp(this.a, this.index());
			break;
		case 0xa2: // SBCA ,r
			this.a = this.sbc(this.a, this.index());
			break;
		case 0xa3: // SUBD ,r
			this.subd(this.index());
			break;
		case 0xa4: // ANDA ,r
			this.a = this.and(this.a, this.index());
			break;
		case 0xa5: // BITA ,r
			this.bit(this.a, this.index());
			break;
		case 0xa6: // LDA ,r
			this.a = this.ld(this.index());
			break;
		case 0xa7: // STA ,r
			this.st(this.a, this.index());
			break;
		case 0xa8: // EORA ,r
			this.a = this.eor(this.a, this.index());
			break;
		case 0xa9: // ADCA ,r
			this.a = this.adc(this.a, this.index());
			break;
		case 0xaa: // ORA ,r
			this.a = this.or(this.a, this.index());
			break;
		case 0xab: // ADDA ,r
			this.a = this.add(this.a, this.index());
			break;
		case 0xac: // CMPX ,r
			this.cmp16(this.x, this.index());
			break;
		case 0xad: // JSR ,r
			this.jsr(this.index());
			break;
		case 0xae: // LDX ,r
			this.x = this.ld16(this.index());
			break;
		case 0xaf: // STX ,r
			this.st16(this.x, this.index());
			break;
		case 0xb0: // SUBA >nn
			this.a = this.sub(this.a, this.extend());
			break;
		case 0xb1: // CMPA >nn
			this.cmp(this.a, this.extend());
			break;
		case 0xb2: // SBCA >nn
			this.a = this.sbc(this.a, this.extend());
			break;
		case 0xb3: // SUBD >nn
			this.subd(this.extend());
			break;
		case 0xb4: // ANDA >nn
			this.a = this.and(this.a, this.extend());
			break;
		case 0xb5: // BITA >nn
			this.bit(this.a, this.extend());
			break;
		case 0xb6: // LDA >nn
			this.a = this.ld(this.extend());
			break;
		case 0xb7: // STA >nn
			this.st(this.a, this.extend());
			break;
		case 0xb8: // EORA >nn
			this.a = this.eor(this.a, this.extend());
			break;
		case 0xb9: // ADCA >nn
			this.a = this.adc(this.a, this.extend());
			break;
		case 0xba: // ORA >nn
			this.a = this.or(this.a, this.extend());
			break;
		case 0xbb: // ADDA >nn
			this.a = this.add(this.a, this.extend());
			break;
		case 0xbc: // CMPX >nn
			this.cmp16(this.x, this.extend());
			break;
		case 0xbd: // JSR >nn
			this.jsr(this.extend());
			break;
		case 0xbe: // LDX >nn
			this.x = this.ld16(this.extend());
			break;
		case 0xbf: // STX >nn
			this.st16(this.x, this.extend());
			break;
		case 0xc0: // SUBB #n
			this.b = this.sub(this.b, null);
			break;
		case 0xc1: // CMPB #n
			this.cmp(this.b, null);
			break;
		case 0xc2: // SBCB #n
			this.b = this.sbc(this.b, null);
			break;
		case 0xc3: // ADDD #nn
			this.addd(null);
			break;
		case 0xc4: // ANDB #n
			this.b = this.and(this.b, null);
			break;
		case 0xc5: // BITB #n
			this.bit(this.b, null);
			break;
		case 0xc6: // LDB #n
			this.b = this.ld(null);
			break;
		case 0xc8: // EORB #n
			this.b = this.eor(this.b, null);
			break;
		case 0xc9: // ADCB #n
			this.b = this.adc(this.b, null);
			break;
		case 0xca: // ORB #n
			this.b = this.or(this.b, null);
			break;
		case 0xcb: // ADDB #n
			this.b = this.add(this.b, null);
			break;
		case 0xcc: // LDD #nn
			this.ldd(null);
			break;
		case 0xce: // LDU #nn
			this.u = this.ld16(null);
			break;
		case 0xd0: // SUBB <n
			this.b = this.sub(this.b, this.direct());
			break;
		case 0xd1: // CMPB <n
			this.cmp(this.b, this.direct());
			break;
		case 0xd2: // SBCB <n
			this.b = this.sbc(this.b, this.direct());
			break;
		case 0xd3: // ADDD <n
			this.addd(this.direct());
			break;
		case 0xd4: // ANDB <n
			this.b = this.and(this.b, this.direct());
			break;
		case 0xd5: // BITB <n
			this.bit(this.b, this.direct());
			break;
		case 0xd6: // LDB <n
			this.b = this.ld(this.direct());
			break;
		case 0xd7: // STB <n
			this.st(this.b, this.direct());
			break;
		case 0xd8: // EORB <n
			this.b = this.eor(this.b, this.direct());
			break;
		case 0xd9: // ADCB <n
			this.b = this.adc(this.b, this.direct());
			break;
		case 0xda: // ORB <n
			this.b = this.or(this.b, this.direct());
			break;
		case 0xdb: // ADDB <n
			this.b = this.add(this.b, this.direct());
			break;
		case 0xdc: // LDD <n
			this.ldd(this.direct());
			break;
		case 0xdd: // STD <n
			this.std(this.direct());
			break;
		case 0xde: // LDU <n
			this.u = this.ld16(this.direct());
			break;
		case 0xdf: // STU <n
			this.st16(this.u, this.direct());
			break;
		case 0xe0: // SUBB ,r
			this.b = this.sub(this.b, this.index());
			break;
		case 0xe1: // CMPB ,r
			this.cmp(this.b, this.index());
			break;
		case 0xe2: // SBCB ,r
			this.b = this.sbc(this.b, this.index());
			break;
		case 0xe3: // ADDD ,r
			this.addd(this.index());
			break;
		case 0xe4: // ANDB ,r
			this.b = this.and(this.b, this.index());
			break;
		case 0xe5: // BITB ,r
			this.bit(this.b, this.index());
			break;
		case 0xe6: // LDB ,r
			this.b = this.ld(this.index());
			break;
		case 0xe7: // STB ,r
			this.st(this.b, this.index());
			break;
		case 0xe8: // EORB ,r
			this.b = this.eor(this.b, this.index());
			break;
		case 0xe9: // ADCB ,r
			this.b = this.adc(this.b, this.index());
			break;
		case 0xea: // ORB ,r
			this.b = this.or(this.b, this.index());
			break;
		case 0xeb: // ADDB ,r
			this.b = this.add(this.b, this.index());
			break;
		case 0xec: // LDD ,r
			this.ldd(this.index());
			break;
		case 0xed: // STD ,r
			this.std(this.index());
			break;
		case 0xee: // LDU ,r
			this.u = this.ld16(this.index());
			break;
		case 0xef: // STU ,r
			this.st16(this.u, this.index());
			break;
		case 0xf0: // SUBB >nn
			this.b = this.sub(this.b, this.extend());
			break;
		case 0xf1: // CMPB >nn
			this.cmp(this.b, this.extend());
			break;
		case 0xf2: // SBCB >nn
			this.b = this.sbc(this.b, this.extend());
			break;
		case 0xf3: // ADDD >nn
			this.addd(this.extend());
			break;
		case 0xf4: // ANDB >nn
			this.b = this.and(this.b, this.extend());
			break;
		case 0xf5: // BITB >nn
			this.bit(this.b, this.extend());
			break;
		case 0xf6: // LDB >nn
			this.b = this.ld(this.extend());
			break;
		case 0xf7: // STB >nn
			this.st(this.b, this.extend());
			break;
		case 0xf8: // EORB >nn
			this.b = this.eor(this.b, this.extend());
			break;
		case 0xf9: // ADCB >nn
			this.b = this.adc(this.b, this.extend());
			break;
		case 0xfa: // ORB >nn
			this.b = this.or(this.b, this.extend());
			break;
		case 0xfb: // ADDB >nn
			this.b = this.add(this.b, this.extend());
			break;
		case 0xfc: // LDD >nn
			this.ldd(this.extend());
			break;
		case 0xfd: // STD >nn
			this.std(this.extend());
			break;
		case 0xfe: // LDU >nn
			this.u = this.ld16(this.extend());
			break;
		case 0xff: // STU >nn
			this.st16(this.u, this.extend());
			break;
		default:
			this.undefsize = 1;
			if (this.undef)
				this.undef(this.arg);
			break;
		}
	}

	index() {
		let v;

		switch (this.fetch()) {
		case 0x00: // $0,X
			return this.x;
		case 0x01: // $1,X
			return this.x + 1 & 0xffff;
		case 0x02: // $2,X
			return this.x + 2 & 0xffff;
		case 0x03: // $3,X
			return this.x + 3 & 0xffff;
		case 0x04: // $4,X
			return this.x + 4 & 0xffff;
		case 0x05: // $5,X
			return this.x + 5 & 0xffff;
		case 0x06: // $6,X
			return this.x + 6 & 0xffff;
		case 0x07: // $7,X
			return this.x + 7 & 0xffff;
		case 0x08: // $8,X
			return this.x + 8 & 0xffff;
		case 0x09: // $9,X
			return this.x + 9 & 0xffff;
		case 0x0a: // $a,X
			return this.x + 0x0a & 0xffff;
		case 0x0b: // $b,X
			return this.x + 0x0b & 0xffff;
		case 0x0c: // $c,X
			return this.x + 0x0c & 0xffff;
		case 0x0d: // $d,X
			return this.x + 0x0d & 0xffff;
		case 0x0e: // $e,X
			return this.x + 0x0e & 0xffff;
		case 0x0f: // $f,X
			return this.x + 0x0f & 0xffff;
		case 0x10: // -$10,X
			return this.x - 0x10 & 0xffff;
		case 0x11: // -$f,X
			return this.x - 0x0f & 0xffff;
		case 0x12: // -$e,X
			return this.x - 0x0e & 0xffff;
		case 0x13: // -$D,X
			return this.x - 0x0d & 0xffff;
		case 0x14: // -$c,X
			return this.x - 0x0c & 0xffff;
		case 0x15: // -$b,X
			return this.x - 0x0b & 0xffff;
		case 0x16: // -$a,X
			return this.x - 0x0a & 0xffff;
		case 0x17: // -$9,X
			return this.x - 9 & 0xffff;
		case 0x18: // -$8,X
			return this.x - 8 & 0xffff;
		case 0x19: // -$7,X
			return this.x - 7 & 0xffff;
		case 0x1a: // -$6,X
			return this.x - 6 & 0xffff;
		case 0x1b: // -$5,X
			return this.x - 5 & 0xffff;
		case 0x1c: // -$4,X
			return this.x - 4 & 0xffff;
		case 0x1d: // -$3,X
			return this.x - 3 & 0xffff;
		case 0x1e: // -$2,X
			return this.x - 2 & 0xffff;
		case 0x1f: // -$1,X
			return this.x - 1 & 0xffff;
		case 0x20: // $0,Y
			return this.y;
		case 0x21: // $1,Y
			return this.y + 1 & 0xffff;
		case 0x22: // $2,Y
			return this.y + 2 & 0xffff;
		case 0x23: // $3,Y
			return this.y + 3 & 0xffff;
		case 0x24: // $4,Y
			return this.y + 4 & 0xffff;
		case 0x25: // $5,Y
			return this.y + 5 & 0xffff;
		case 0x26: // $6,Y
			return this.y + 6 & 0xffff;
		case 0x27: // $7,Y
			return this.y + 7 & 0xffff;
		case 0x28: // $8,Y
			return this.y + 8 & 0xffff;
		case 0x29: // $9,Y
			return this.y + 9 & 0xffff;
		case 0x2a: // $a,Y
			return this.y + 0x0a & 0xffff;
		case 0x2b: // $b,Y
			return this.y + 0x0b & 0xffff;
		case 0x2c: // $c,Y
			return this.y + 0x0c & 0xffff;
		case 0x2d: // $D,Y
			return this.y + 0x0d & 0xffff;
		case 0x2e: // $e,Y
			return this.y + 0x0e & 0xffff;
		case 0x2f: // $f,Y
			return this.y + 0x0f & 0xffff;
		case 0x30: // -$10,Y
			return this.y - 0x10 & 0xffff;
		case 0x31: // -$f,Y
			return this.y - 0x0f & 0xffff;
		case 0x32: // -$e,Y
			return this.y - 0x0e & 0xffff;
		case 0x33: // -$D,Y
			return this.y - 0x0d & 0xffff;
		case 0x34: // -$c,Y
			return this.y - 0x0c & 0xffff;
		case 0x35: // -$b,Y
			return this.y - 0x0b & 0xffff;
		case 0x36: // -$a,Y
			return this.y - 0x0a & 0xffff;
		case 0x37: // -$9,Y
			return this.y - 9 & 0xffff;
		case 0x38: // -$8,Y
			return this.y - 8 & 0xffff;
		case 0x39: // -$7,Y
			return this.y - 7 & 0xffff;
		case 0x3a: // -$6,Y
			return this.y - 6 & 0xffff;
		case 0x3b: // -$5,Y
			return this.y - 5 & 0xffff;
		case 0x3c: // -$4,Y
			return this.y - 4 & 0xffff;
		case 0x3d: // -$3,Y
			return this.y - 3 & 0xffff;
		case 0x3e: // -$2,Y
			return this.y - 2 & 0xffff;
		case 0x3f: // -$1,Y
			return this.y - 1 & 0xffff;
		case 0x40: // $0,U
			return this.u;
		case 0x41: // $1,U
			return this.u + 1 & 0xffff;
		case 0x42: // $2,U
			return this.u + 2 & 0xffff;
		case 0x43: // $3,U
			return this.u + 3 & 0xffff;
		case 0x44: // $4,U
			return this.u + 4 & 0xffff;
		case 0x45: // $5,U
			return this.u + 5 & 0xffff;
		case 0x46: // $6,U
			return this.u + 6 & 0xffff;
		case 0x47: // $7,U
			return this.u + 7 & 0xffff;
		case 0x48: // $8,U
			return this.u + 8 & 0xffff;
		case 0x49: // $9,U
			return this.u + 9 & 0xffff;
		case 0x4a: // $a,U
			return this.u + 0x0a & 0xffff;
		case 0x4b: // $b,U
			return this.u + 0x0b & 0xffff;
		case 0x4c: // $c,U
			return this.u + 0x0c & 0xffff;
		case 0x4d: // $D,U
			return this.u + 0x0d & 0xffff;
		case 0x4e: // $e,U
			return this.u + 0x0e & 0xffff;
		case 0x4f: // $f,U
			return this.u + 0x0f & 0xffff;
		case 0x50: // -$10,U
			return this.u - 0x10 & 0xffff;
		case 0x51: // -$f,U
			return this.u - 0x0f & 0xffff;
		case 0x52: // -$e,U
			return this.u - 0x0e & 0xffff;
		case 0x53: // -$D,U
			return this.u - 0x0d & 0xffff;
		case 0x54: // -$c,U
			return this.u - 0x0c & 0xffff;
		case 0x55: // -$b,U
			return this.u - 0x0b & 0xffff;
		case 0x56: // -$a,U
			return this.u - 0x0a & 0xffff;
		case 0x57: // -$9,U
			return this.u - 9 & 0xffff;
		case 0x58: // -$8,U
			return this.u - 8 & 0xffff;
		case 0x59: // -$7,U
			return this.u - 7 & 0xffff;
		case 0x5a: // -$6,U
			return this.u - 6 & 0xffff;
		case 0x5b: // -$5,U
			return this.u - 5 & 0xffff;
		case 0x5c: // -$4,U
			return this.u - 4 & 0xffff;
		case 0x5d: // -$3,U
			return this.u - 3 & 0xffff;
		case 0x5e: // -$2,U
			return this.u - 2 & 0xffff;
		case 0x5f: // -$1,U
			return this.u - 1 & 0xffff;
		case 0x60: // $0,S
			return this.s;
		case 0x61: // $1,S
			return this.s + 1 & 0xffff;
		case 0x62: // $2,S
			return this.s + 2 & 0xffff;
		case 0x63: // $3,S
			return this.s + 3 & 0xffff;
		case 0x64: // $4,S
			return this.s + 4 & 0xffff;
		case 0x65: // $5,S
			return this.s + 5 & 0xffff;
		case 0x66: // $6,S
			return this.s + 6 & 0xffff;
		case 0x67: // $7,S
			return this.s + 7 & 0xffff;
		case 0x68: // $8,S
			return this.s + 8 & 0xffff;
		case 0x69: // $9,S
			return this.s + 9 & 0xffff;
		case 0x6a: // $a,S
			return this.s + 0x0a & 0xffff;
		case 0x6b: // $b,S
			return this.s + 0x0b & 0xffff;
		case 0x6c: // $c,S
			return this.s + 0x0c & 0xffff;
		case 0x6d: // $D,S
			return this.s + 0x0d & 0xffff;
		case 0x6e: // $e,S
			return this.s + 0x0e & 0xffff;
		case 0x6f: // $f,S
			return this.s + 0x0f & 0xffff;
		case 0x70: // -$10,S
			return this.s - 0x10 & 0xffff;
		case 0x71: // -$f,S
			return this.s - 0x0f & 0xffff;
		case 0x72: // -$e,S
			return this.s - 0x0e & 0xffff;
		case 0x73: // -$D,S
			return this.s - 0x0d & 0xffff;
		case 0x74: // -$c,S
			return this.s - 0x0c & 0xffff;
		case 0x75: // -$b,S
			return this.s - 0x0b & 0xffff;
		case 0x76: // -$a,S
			return this.s - 0x0a & 0xffff;
		case 0x77: // -$9,S
			return this.s - 9 & 0xffff;
		case 0x78: // -$8,S
			return this.s - 8 & 0xffff;
		case 0x79: // -$7,S
			return this.s - 7 & 0xffff;
		case 0x7a: // -$6,S
			return this.s - 6 & 0xffff;
		case 0x7b: // -$5,S
			return this.s - 5 & 0xffff;
		case 0x7c: // -$4,S
			return this.s - 4 & 0xffff;
		case 0x7d: // -$3,S
			return this.s - 3 & 0xffff;
		case 0x7e: // -$2,S
			return this.s - 2 & 0xffff;
		case 0x7f: // -$1,S
			return this.s - 1 & 0xffff;
		case 0x80: // ,X+
			v = this.x;
			this.x = this.x + 1 & 0xffff;
			return v;
		case 0x81: // ,X++
			v = this.x;
			this.x = this.x + 2 & 0xffff;
			return v;
		case 0x82: // ,-X
			return this.x = this.x - 1 & 0xffff;
		case 0x83: // ,--X
			return this.x = this.x - 2 & 0xffff;
		case 0x84: // ,X
			return this.x;
		case 0x85: // B,X
			return this.x + this.b - (this.b << 1 & 0x100) & 0xffff;
		case 0x86: // A,X
			return this.x + this.a - (this.a << 1 & 0x100) & 0xffff;
		case 0x88: // n,X
			return this.x + (v = this.fetch()) - (v << 1 & 0x100) & 0xffff;
		case 0x89: // nn,X
			return this.x + (this.fetch() << 8 | this.fetch()) & 0xffff;
		case 0x8b: // D,X
			return this.x + (this.a << 8 | this.b) & 0xffff;
		case 0x91: // [,X++]
			v = this.x;
			this.x = this.x + 2 & 0xffff;
			break;
		case 0x93: // [,--X]
			v = this.x = this.x - 2 & 0xffff;
			break;
		case 0x94: // [,X]
			v = this.x;
			break;
		case 0x95: // [B,X]
			v = this.x + this.b - (this.b << 1 & 0x100) & 0xffff;
			break;
		case 0x96: // [A,X]
			v = this.x + this.a - (this.a << 1 & 0x100) & 0xffff;
			break;
		case 0x98: // [n,X]
			v = this.x + (v = this.fetch()) - (v << 1 & 0x100) & 0xffff;
			break;
		case 0x99: // [nn,X]
			v = this.x + (this.fetch() << 8 | this.fetch()) & 0xffff;
			break;
		case 0x9b: // [D,X]
			v = this.x + (this.a << 8 | this.b) & 0xffff;
			break;
		case 0xa0: // ,Y+
			v = this.y;
			this.y = this.y + 1 & 0xffff;
			return v;
		case 0xa1: // ,Y++
			v = this.y;
			this.y = this.y + 2 & 0xffff;
			return v;
		case 0xa2: // ,-Y
			return this.y = this.y - 1 & 0xffff;
		case 0xa3: // ,--Y
			return this.y = this.y - 2 & 0xffff;
		case 0xa4: // ,Y
			return this.y;
		case 0xa5: // B,Y
			return this.y + this.b - (this.b << 1 & 0x100) & 0xffff;
		case 0xa6: // A,Y
			return this.y + this.a - (this.a << 1 & 0x100) & 0xffff;
		case 0xa8: // n,Y
			return this.y + (v = this.fetch()) - (v << 1 & 0x100) & 0xffff;
		case 0xa9: // nn,Y
			return this.y + (this.fetch() << 8 | this.fetch()) & 0xffff;
		case 0xab: // D,Y
			return this.y + (this.a << 8 | this.b) & 0xffff;
		case 0xb1: // [,Y++]
			v = this.y;
			this.y = this.y + 2 & 0xffff;
			break;
		case 0xb3: // [,--Y]
			v = this.y = this.y - 2 & 0xffff;
			break;
		case 0xb4: // [,Y]
			v = this.y;
			break;
		case 0xb5: // [B,Y]
			v = this.y + this.b - (this.b << 1 & 0x100) & 0xffff;
			break;
		case 0xb6: // [A,Y]
			v = this.y + this.a - (this.a << 1 & 0x100) & 0xffff;
			break;
		case 0xb8: // [n,Y]
			v = this.y + (v = this.fetch()) - (v << 1 & 0x100) & 0xffff;
			break;
		case 0xb9: // [nn,Y]
			v = this.y + (this.fetch() << 8 | this.fetch()) & 0xffff;
			break;
		case 0xbb: // [D,Y]
			v = this.y + (this.a << 8 | this.b) & 0xffff;
			break;
		case 0xc0: // ,U+
			v = this.u;
			this.u = this.u + 1 & 0xffff;
			return v;
		case 0xc1: // ,U++
			v = this.u;
			this.u = this.u + 2 & 0xffff;
			return v;
		case 0xc2: // ,-U
			return this.u = this.u - 1 & 0xffff;
		case 0xc3: // ,--u
			return this.u = this.u - 2 & 0xffff;
		case 0xc4: // ,U
			return this.u;
		case 0xc5: // B,U
			return this.u + this.b - (this.b << 1 & 0x100) & 0xffff;
		case 0xc6: // A,U
			return this.u + this.a - (this.a << 1 & 0x100) & 0xffff;
		case 0xc8: // n,U
			return this.u + (v = this.fetch()) - (v << 1 & 0x100) & 0xffff;
		case 0xc9: // nn,U
			return this.u + (this.fetch() << 8 | this.fetch()) & 0xffff;
		case 0xcb: // D,U
			return this.u + (this.a << 8 | this.b) & 0xffff;
		case 0xd1: // [,U++]
			v = this.u;
			this.u = this.u + 2 & 0xffff;
			break;
		case 0xd3: // [,--U]
			v = this.u = this.u - 2 & 0xffff;
			break;
		case 0xd4: // [,U]
			v = this.u;
			break;
		case 0xd5: // [B,U]
			v = this.u + this.b - (this.b << 1 & 0x100) & 0xffff;
			break;
		case 0xd6: // [A,U]
			v = this.u + this.a - (this.a << 1 & 0x100) & 0xffff;
			break;
		case 0xd8: // [n,U]
			v = this.u + (v = this.fetch()) - (v << 1 & 0x100) & 0xffff;
			break;
		case 0xd9: // [nn,U]
			v = this.u + (this.fetch() << 8 | this.fetch()) & 0xffff;
			break;
		case 0xdb: // [D,U]
			v = this.u + (this.a << 8 | this.b) & 0xffff;
			break;
		case 0xe0: // ,S+
			v = this.s;
			this.s = this.s + 1 & 0xffff;
			return v;
		case 0xe1: // ,S++
			v = this.s;
			this.s = this.s + 2 & 0xffff;
			return v;
		case 0xe2: // ,-S
			return this.s = this.s - 1 & 0xffff;
		case 0xe3: // ,--S
			return this.s = this.s - 2 & 0xffff;
		case 0xe4: // ,S
			return this.s;
		case 0xe5: // B,S
			return this.s + this.b - (this.b << 1 & 0x100) & 0xffff;
		case 0xe6: // A,S
			return this.s + this.a - (this.a << 1 & 0x100) & 0xffff;
		case 0xe8: // n,S
			return this.s + (v = this.fetch()) - (v << 1 & 0x100) & 0xffff;
		case 0xe9: // nn,S
			return this.s + (this.fetch() << 8 | this.fetch()) & 0xffff;
		case 0xeb: // D,S
			return this.s + (this.a << 8 | this.b) & 0xffff;
		case 0xf1: // [,S++]
			v = this.s;
			this.s = this.s + 2 & 0xffff;
			break;
		case 0xf3: // [,--S]
			v = this.s = this.s - 2 & 0xffff;
			break;
		case 0xf4: // [,S]
			v = this.s;
			break;
		case 0xf5: // [B,S]
			v = this.s + this.b - (this.b << 1 & 0x100) & 0xffff;
			break;
		case 0xf6: // [A,S]
			v = this.s + this.a - (this.a << 1 & 0x100) & 0xffff;
			break;
		case 0xf8: // [n,S]
			v = this.s + (v = this.fetch()) - (v << 1 & 0x100) & 0xffff;
			break;
		case 0xf9: // [nn,S]
			v = this.s + (this.fetch() << 8 | this.fetch()) & 0xffff;
			break;
		case 0xfb: // [D,S]
			v = this.s + (this.a << 8 | this.b) & 0xffff;
			break;
		case 0x8c: // n,PC
		case 0xac:
		case 0xcc:
		case 0xec:
			v = this.fetch();
			return this.pc + v - (v << 1 & 0x100) & 0xffff;
		case 0x8d: // nn,PC
		case 0xad:
		case 0xcd:
		case 0xed:
			v = this.fetch() << 8 | this.fetch();
			return this.pc + v & 0xffff;
		case 0x9c: // [n,PC]
		case 0xbc:
		case 0xdc:
		case 0xfc:
			v = this.fetch();
			v = this.pc + v - (v << 1 & 0x100) & 0xffff;
			break;
		case 0x9d: // [nn,PC]
		case 0xbd:
		case 0xdd:
		case 0xfd:
			v = this.fetch() << 8 | this.fetch();
			v = this.pc + v & 0xffff;
			break;
		case 0x9f: // [nn]
		case 0xbf:
		case 0xdf:
		case 0xff:
			v = this.fetch() << 8 | this.fetch();
			break;
		default:
			return 0xffffffff;
		}
		return this.read(v) << 8 | this.read1(v);
	}

	direct() {
		return this.dp << 8 | this.fetch();
	}

	extend() {
		return this.fetch() << 8 | this.fetch();
	}

	lbcc(cond) {
		const nn = this.fetch() << 8 | this.fetch();
		if (cond) this.pc = this.pc + nn & 0xffff;
	}

	lbsr() {
		const nn = this.fetch() << 8 | this.fetch();
		this.pshs16(this.pc);
		this.pc = this.pc + nn & 0xffff;
	}

	bcc(cond) {
		const n = this.fetch();
		if (cond) this.pc = this.pc + n - (n << 1 & 0x100) & 0xffff;
	}

	bsr() {
		const n = this.fetch();
		this.pshs16(this.pc);
		this.pc = this.pc + n - (n << 1 & 0x100) & 0xffff;
	}

	nega(r) {
		r = aSub[0][r][0];
		this.ccr = this.ccr & ~0x2f | r >>> 8;
		return r & 0xff;
	}

	coma(r) {
		this.ccr = this.ccr & ~0x0f | 1 | fLogic[r = ~r & 0xff];
		return r;
	}

	lsra(r) {
		r = aRr[0][r];
		this.ccr = this.ccr & ~0x0d | r >>> 8;
		return r & 0xff;
	}

	rora(r) {
		r = aRr[this.ccr & 1][r];
		this.ccr = this.ccr & ~0x0d | r >>> 8;
		return r & 0xff;
	}

	asra(r) {
		r = aRr[r >>> 7][r];
		this.ccr = this.ccr & ~0x2d | r >>> 8;
		return r & 0xff;
	}

	lsla(r) {
		r = aRl[0][r];
		this.ccr = this.ccr & ~0x2f | r >>> 8;
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
		this.ccr = this.ccr & ~0x0f | 4;
		return 0;
	}

	neg(ea) {
		const r = aSub[0][this.read(ea)][0];
		this.ccr = this.ccr & ~0x2f | r >>> 8;
		this.write(ea, r & 0xff);
	}

	com(ea) {
		const r = ~this.read(ea) & 0xff;
		this.ccr = this.ccr & ~0x0f | 1 | fLogic[r];
		this.write(ea, r);
	}

	lsr(ea) {
		const r = aRr[0][this.read(ea)];
		this.ccr = this.ccr & ~0x0d | r >>> 8;
		this.write(ea, r & 0xff);
	}

	ror(ea) {
		const r = aRr[this.ccr & 1][this.read(ea)];
		this.ccr = this.ccr & ~0x0d | r >>> 8;
		this.write(ea, r & 0xff);
	}

	asr(ea) {
		let r = this.read(ea);
		r = aRr[r >>> 7][r];
		this.ccr = this.ccr & ~0x2d | r >>> 8;
		this.write(ea, r & 0xff);
	}

	lsl(ea) {
		const r = aRl[0][this.read(ea)];
		this.ccr = this.ccr & ~0x2f | r >>> 8;
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
		this.ccr = this.ccr & ~0x0f | 4;
		this.write(ea, 0);
	}

	sub(r, ea) {
		r = aSub[0][this.readf(ea)][r];
		this.ccr = this.ccr & ~0x2f | r >>> 8;
		return r & 0xff;
	}

	cmp(r, ea) {
		this.ccr = this.ccr & ~0x2f | aSub[0][this.readf(ea)][r] >>> 8;
	}

	sbc(r, ea) {
		r = aSub[this.ccr & 1][this.readf(ea)][r];
		this.ccr = this.ccr & ~0x2f | r >>> 8;
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
		this.pshs16(this.pc);
		this.pc = ea;
	}

	subd(ea) {
		let v, w;
		v = this.readf(ea);
		this.b = (w = aSub[0][this.readf1(ea)][this.b]) & 0xff;
		this.a = (v = aSub[w >>> 8 & 1][v][this.a]) & 0xff;
		this.ccr = this.ccr & ~0x0f | v >>> 8 & 0x0f;
		this.ccr &= !this.b << 2 | ~4;
	}

	addd(ea) {
		let v, w;
		v = this.readf(ea);
		this.b = (w = aAdd[0][this.readf1(ea)][this.b]) & 0xff;
		this.a = (v = aAdd[w >>> 8 & 1][v][this.a]) & 0xff;
		this.ccr = this.ccr & ~0x0f | v >>> 8 & 0x0f;
		this.ccr &= !this.b << 2 | ~4;
	}

	ldd(ea) {
		this.a = this.readf(ea);
		this.b = this.readf1(ea);
		this.ccr = this.ccr & ~0x0e | ((this.a | this.b) === 0) << 2 | this.a >>> 4 & 8;
	}

	std(ea) {
		this.write(ea, this.a);
		this.write1(ea, this.b);
		this.ccr = this.ccr & ~0x0e | ((this.a | this.b) === 0) << 2 | this.a >>> 4 & 8;
	}

	cmp16(r, ea) {
		const v = this.readf(ea);
		const w = aSub[0][this.readf1(ea)][r & 0xff];
		this.ccr = this.ccr & ~0x0f | aSub[w >>> 8 & 1][v][r >>> 8] >>> 8 & 0x0f;
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

	pshs(r) {
		this.s = this.s - 1 & 0xffff;
		this.write(this.s, r);
	}

	pshu(r) {
		this.u = this.u - 1 & 0xffff;
		this.write(this.u, r);
	}

	puls() {
		const r = this.read(this.s);
		this.s = this.s + 1 & 0xffff;
		return r;
	}

	pulu() {
		const r = this.read(this.u);
		this.u = this.u + 1 & 0xffff;
		return r;
	}

	pshs16(r) {
		this.s = this.s - 2 & 0xffff;
		this.write1(this.s, r & 0xff);
		this.write(this.s, r >>> 8);
	}

	pshu16(r) {
		this.u = this.u - 2 & 0xffff;
		this.write1(this.u, r & 0xff);
		this.write(this.u, r >>> 8);
	}

	puls16() {
		const r = this.read(this.s) << 8 | this.read1(this.s);
		this.s = this.s + 2 & 0xffff;
		return r;
	}

	pulu16() {
		const r = this.read(this.u) << 8 | this.read1(this.u);
		this.u = this.u + 2 & 0xffff;
		return r;
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

