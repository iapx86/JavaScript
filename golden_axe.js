/*
 *
 *	Golden Axe
 *
 */

import YM2151 from './ym2151.js';
import UPD7759 from './upd7759.js';
import {dummypage, init, seq, rseq, convertGFX, read} from './main.js';
import FD1094 from './fd1094.js';
import Z80 from './z80.js';
let game, sound;

class GoldenAxe {
	cxScreen = 224;
	cyScreen = 320;
	width = 256;
	height = 512;
	xOffset = 16;
	yOffset = 16;
	rotate = true;

	fReset = true;
	fTest = false;
	fDIPSwitchChanged = true;
	fCoin = 0;
	fStart1P = 0;
	fStart2P = 0;
	fTurbo = false;
	fDemoSound = true;
	nDifficulty = 'Normal';

	memorymapper = {reg: new Uint8Array(0x20), memorymap: []};
	ram = new Uint8Array(0x18000).addBase();
	ram2 = new Uint8Array(0x800).addBase();
	in = Uint8Array.of(0xff, 0xff, 0xff, 0xff, 0xfd, 0xff);
	command = 0;
	bank = 0;
	cpu2_irq = false;
	cpu2_nmi = false;

	bg = new Uint8Array(0x100000).fill(7);
	rgb = new Int32Array(0x800).fill(0xff000000);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	isspace;
	mode = 0;
	bgbank = new Int32Array(2);

	cpu = new FD1094(KEY, Math.floor(20000000 / 2));
	cpu2 = new Z80(Math.floor(20000000 / 4));

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 8; i++)
			this.memorymapper.memorymap.push([]);
		for (let i = 0; i < 8; i++)
			for (let j = 0; j < 0x2000; j++)
				this.memorymapper.memorymap[i].push({base: dummypage, read: null, read16: null, write: () => {}, write16: null});

		const range = (page, start, end, mirror = 0) => (page & ~mirror) >= start && (page & ~mirror) <= end;

		for (let page = 0; page < 0x2000; page++)
			if (range(page, 0, 0x3ff, 0xfc00))
				this.memorymapper.memorymap[0][page].base = PRG1.base[page & 0x3ff];
		for (let page = 0; page < 0x2000; page++)
			if (range(page, 0, 0x3ff, 0xfc00))
				this.memorymapper.memorymap[1][page].base = PRG1.base[0x400 | page & 0x3ff];
		for (let page = 0; page < 0x2000; page++)
			if (range(page, 0, 0xff, 0xff00))
				this.memorymapper.memorymap[2][page].write = (addr, data) => { this.bgbank[addr & 1] = data << 12 & 0x3000; };
		for (let page = 0; page < 0x2000; page++)
			if (range(page, 0, 0x3f, 0xffc0)) {
				this.memorymapper.memorymap[3][page].base = this.ram.base[0x140 | page & 0x3f];
				this.memorymapper.memorymap[3][page].write = null;
			}
		for (let page = 0; page < 0x2000; page++)
			if (range(page, 0, 7, 0xfff8)) {
				this.memorymapper.memorymap[4][page].base = this.ram.base[0x110 | page & 7];
				this.memorymapper.memorymap[4][page].write = null;
			}
		for (let page = 0; page < 0x2000; page++)
			if (range(page, 0, 0xff, 0xfe00)) {
				this.memorymapper.memorymap[5][page].base = this.ram.base[page & 0xff];
				this.memorymapper.memorymap[5][page].write = null;
			} else if (range(page, 0x100, 0x10f, 0xfef0)) {
				this.memorymapper.memorymap[5][page].base = this.ram.base[0x100 | page & 0xf];
				this.memorymapper.memorymap[5][page].write = null;
			}
		for (let page = 0; page < 0x2000; page++)
			if (range(page, 0, 0xf, 0xfff0)) {
				this.memorymapper.memorymap[6][page].base = this.ram.base[0x120 | page & 0xf];
				this.memorymapper.memorymap[6][page].write = null;
				this.memorymapper.memorymap[6][page].write16 = (addr, data) => {
					const offset = addr & 0xffe;
					this.ram[0x12000 | offset] = data >> 8, this.ram[0x12001 | offset] = data;
					this.rgb[offset >> 1] = (data >> 12 & 1 | data << 1 & 0x1e) * 255 / 31	// Red
						| (data >> 13 & 1 | data >> 3 & 0x1e) * 255 / 31 << 8				// Green
						| (data >> 14 & 1 | data >> 7 & 0x1e) * 255 / 31 << 16				// Blue
						| 0xff000000;														// Alpha
				};
			}
		for (let page = 0; page < 0x2000; page++)
			if (range(page, 0, 0x3f, 0xffc0)) {
				this.memorymapper.memorymap[7][page].read = (addr) => {
					switch (addr & 0x3000) {
					case 0x1000:
						return this.in[addr >> 1 & 3];
					case 0x2000:
						return this.in[4 | addr >> 1 & 1];
					}
					return 0xff;
				};
				this.memorymapper.memorymap[7][page].write = (addr, data) => { !(addr & 0x3000) && (this.mode = data); };
			}

		for (let i = 0; i < 0x80; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 0x40; i++)
			this.cpu2.memorymap[0x80 + i].read = (addr) => { return PRG2[this.bank + addr]; };
		this.cpu2.memorymap[0xe8].read = (addr) => { return addr === 0xe800 ? this.command : 0xff; };
		for (let i = 0; i < 8; i++) {
			this.cpu2.memorymap[0xf8 + i].base = this.ram2.base[i];
			this.cpu2.memorymap[0xf8 + i].write = null;
		}
		for (let i = 0; i < 0x100; i++) {
			this.cpu2.iomap[i].read = (addr) => {
				switch (addr >> 6 & 3) {
				case 0:
					return addr & 1 ? sound[0].status : 0xff;
				case 2:
					return sound[1].busy() << 7;
				case 3:
					return this.command;
				}
				return 0xff;
			};
			this.cpu2.iomap[i].write = (addr, data) => {
				switch (addr >> 6 & 3) {
				case 0:
					return ~addr & 1 ? void(sound[0].addr = data) : sound[0].write(data);
				case 1:
					sound[1].reset(data >> 6 & 1), sound[1].st(data >> 7);
					return void(this.bank = data << 14 & 0x1c000);
				case 2:
					return sound[1].write(data);
				}
			};
		}

		this.cpu2.check_interrupt = () => {
			if (this.cpu2_nmi)
				return this.cpu2_nmi = false, this.cpu2.non_maskable_interrupt();
			if (this.cpu2_irq && this.cpu2.interrupt())
				this.cpu2_irq = false, true;
			return false;
		};

		// Videoの初期化
		convertGFX(this.bg, BG, 16384, rseq(8, 0, 8), seq(8), [Math.floor(BG.length / 3) * 16, Math.floor(BG.length / 3) * 8, 0], 8);
		this.isspace = Uint8Array.from(seq(16384), i => Number(this.bg.subarray(i << 6, i + 1 << 6).every(e => !e)));
	}

	updateRegion() {
		const flag = new Uint8Array(0x10000);
		const reg = this.memorymapper.reg;
		for (let index = 0; index < 8; index++) {
			const size = [0x100, 0x200, 0x800, 0x2000][reg[0x10 | index << 1] & 3], base = reg[0x11 | index << 1] << 8 & ~(size - 1);
			for (let page = 0; page < size; page++)
				if (!flag[base | page])
					this.cpu.memorymap[base | page] = this.memorymapper.memorymap[index][page], flag[base | page] = 1;
		}
		for (let page = 0; page < 0x10000; page++)
			if (!flag[page])
				this.cpu.memorymap[page] = {base: dummypage, read: (addr) => {
					if (!(addr & 1))
						return 0xff;
					switch (addr = addr >> 1 & 0x1f) {
					case 0:
					case 1:
						return reg[addr];
					case 2:
						return (reg[2] & 3) === 3 ? 0 : 0xf;
					case 3:
						return 0;
					}
					return this.cpu.read16(this.cpu.pc - 2 | 0) & 0xff;
				}, read16: null, write: (addr, data) => {
					if (!(addr & 1))
						return;
					if ((addr = addr >> 1 & 0x1f) >= 0x10)
						return void(data !== reg[addr] && (reg[addr] = data, this.updateRegion()));
					switch (addr) {
					case 3:
						this.cpu2_irq = true, this.command = data;
						break;
					case 5:
						if (data === 1)
							this.cpu.write16(reg[0] << 8 | reg[1], reg[0xa] << 17 | reg[0xb] << 9 | reg[0xc] << 1);
						else if (data === 2) {
							const result = this.cpu.read16(reg[7] << 17 | reg[8] << 9 | reg[9] << 1);
							reg[0] = result >> 8, reg[1] = result & 0xff;
						}
						break;
					}
					return void(reg[addr] = data);
				}, write16: null};
	}

	execute(audio, rate_correction) {
		const tick_rate = 384000, tick_max = Math.floor(tick_rate / 60);
		this.cpu.interrupt(4);
		for (let i = 0; i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.cpu2.execute(tick_rate);
			sound[0].execute(tick_rate);
			sound[1].execute(tick_rate, rate_correction, () => this.cpu2_nmi = true);
			audio.execute(tick_rate, rate_correction);
		}
		return this;
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// DIPスイッチの更新
		if (this.fDIPSwitchChanged) {
			this.fDIPSwitchChanged = false;
			if (this.fDemoSound)
				this.in[4] &= ~2;
			else
				this.in[4] |= 2;
			switch (this.nDifficulty) {
			case 'Special':
				this.in[4] &= ~0x3c;
				break;
			case 'Easiest':
				this.in[4] = this.in[4] & ~0x3c | 0x14;
				break;
			case 'Easier':
				this.in[4] = this.in[4] & ~0x3c | 0x1c;
				break;
			case 'Easy':
				this.in[4] = this.in[4] & ~0x3c | 0x34;
				break;
			case 'Normal':
				this.in[4] |= 0x3c;
				break;
			case 'Hard':
				this.in[4] = this.in[4] & ~0x3c | 0x38;
				break;
			case 'Harder':
				this.in[4] = this.in[4] & ~0x3c | 0x2c;
				break;
			case 'Hardest':
				this.in[4] = this.in[4] & ~0x3c | 0x28;
				break;
			}
			this.fReset = true;
		}

		if (this.fTest)
			this.in[0] &= ~4;
		else
			this.in[0] |= 4;

		// リセット処理
		if (this.fReset) {
			this.memorymapper.reg.fill(0);
			this.updateRegion();
			this.fReset = false;
			this.cpu.reset();
			this.cpu2_irq = this.cpu2_nmi = false;
			this.cpu2.reset();
		}
		return this;
	}

	updateInput() {
		this.in[0] = this.in[0] & ~0x38 | !this.fCoin << 3 | !this.fStart1P << 4 | !this.fStart2P << 5;
		this.fCoin -= !!this.fCoin, this.fStart1P -= !!this.fStart1P, this.fStart2P -= !!this.fStart2P;
		this.fTurbo && (this.in[1] ^= 1 << 1);
		return this;
	}

	coin() {
		this.fCoin = 2;
	}

	start1P() {
		this.fStart1P = 2;
	}

	start2P() {
		this.fStart2P = 2;
	}

	up(fDown) {
		this.in[1] = this.in[1] & ~(1 << 5) | fDown << 4 | !fDown << 5;
	}

	right(fDown) {
		this.in[1] = this.in[1] & ~(1 << 6) | fDown << 7 | !fDown << 6;
	}

	down(fDown) {
		this.in[1] = this.in[1] & ~(1 << 4) | fDown << 5 | !fDown << 4;
	}

	left(fDown) {
		this.in[1] = this.in[1] & ~(1 << 7) | fDown << 6 | !fDown << 7;
	}

	triggerA(fDown) {
		this.in[1] = this.in[1] & ~(1 << 1) | !fDown << 1;
	}

	triggerB(fDown) {
		this.in[1] = this.in[1] & ~(1 << 2) | !fDown << 2;
	}

	triggerX(fDown) {
		this.in[1] = this.in[1] & ~(1 << 0) | !fDown << 0;
	}

	triggerY(fDown) {
		!(this.fTurbo = fDown) && (this.in[1] |= 1 << 1);
	}

	makeBitmap() {
		// 画面クリア
		if (~this.mode & 0x20) {
			let p = 256 * 16 + 16;
			for (let i = 0; i < 320; p += 256, i++)
				this.bitmap.fill(0xff000000, p, p + 224);
			return this.bitmap;
		}

		// bg/obj描画
		this.drawBG(this.bitmap, 2, 0);
		this.drawObj(this.bitmap, 0);
		this.drawBG(this.bitmap, 2, 1);
		this.drawObj(this.bitmap, 1);
		this.drawBG(this.bitmap, 2, 2);
		this.drawBG(this.bitmap, 0, 1);
		this.drawObj(this.bitmap, 2);
		this.drawBG(this.bitmap, 0, 2);
		this.drawFG(this.bitmap, 0x8000, 0);
		this.drawObj(this.bitmap, 3);
		this.drawFG(this.bitmap, 0x8000, 0x8000);

		// palette変換
		let p = 256 * 16 + 16;
		for (let i = 0; i < 320; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				this.bitmap[p] = this.rgb[this.bitmap[p]];

		return this.bitmap;
	}

	drawBG(data, disp, pri) {
		const view = new DataView(this.ram.buffer), page = [view.getUint16(0x10e80 + disp), view.getUint16(0x10e84 + disp)];
		const hScroll = [view.getUint16(0x10e90 + disp), view.getUint16(0x10e94 + disp)], vScroll = [view.getUint16(0x10e98 + disp), view.getUint16(0x10e9c + disp)];
		const col = (hScroll[0] & 0x8000) !== 0, row = (vScroll[0] & 0x8000) !== 0;
		if (col)
			for (let column = 0; column < 21; column++)
				for (let y0 = Math.max(column * 16 - 8, 0), y1 = Math.min(column * 16 + 8, 320), x0 = 0; x0 < 224; x0 += 8)
					for (let x1 = x0 + 8, y = y0; y <= y1; y += 8)
						for (let x = x0; x <= x1; x += 8) {
							const rScroll = view.getUint16(0x10f80 + (223 - x0 >> 3 << 1) + (disp << 5)), alt = rScroll >> 15;
							const vx = 32 + x - (alt ? hScroll[1] : view.getUint16(0x10f16 + (column << 1) + (disp << 5)));
							const vy = 704 + y - (alt ? vScroll[1] : row ? rScroll : vScroll[0]);
							const t = view.getUint16(page[alt] << (~vx >> 5 & 8 | vy >> 7 & 4) & 0xf000 | ~vx << 4 & 0xf80 | vy >> 2 & 0x7e);
							const code = this.bgbank[t >> 12 & 1] | t & 0xfff, color = t >> 3 & 0x3f8;
							if (pri === 2)
								t & 0x8000 && !this.isspace[code] && this.xfer8x8_1(data, code, color, x - (vx & 7), y - (vy & 7), x0, y0, x1, y1);
							else if (pri === 1)
								~t & 0x8000 && !this.isspace[code] && this.xfer8x8_1(data, code, color, x - (vx & 7), y - (vy & 7), x0, y0, x1, y1);
							else
								this.xfer8x8_0(data, code, color, x - (vx & 7), y - (vy & 7), x0, y0, x1, y1);
						}
		else
			for (let y0 = 0, y1 = 320, x0 = 0; x0 < 224; x0 += 8)
				for (let x1 = x0 + 8, y = y0; y <= y1; y += 8)
					for (let x = x0; x <= x1; x += 8) {
						const rScroll = view.getUint16(0x10f80 + (223 - x0 >> 3 << 1) + (disp << 5)), alt = rScroll >> 15;
						const vx = 32 + x - hScroll[alt], vy = 704 + y - (alt ? vScroll[1] : row ? rScroll : vScroll[0]);
						const t = view.getUint16(page[alt] << (~vx >> 5 & 8 | vy >> 7 & 4) & 0xf000 | ~vx << 4 & 0xf80 | vy >> 2 & 0x7e);
						const code = this.bgbank[t >> 12 & 1] | t & 0xfff, color = t >> 3 & 0x3f8;
						if (pri === 2)
							t & 0x8000 && !this.isspace[code] && this.xfer8x8_1(data, code, color, x - (vx & 7), y - (vy & 7), x0, y0, x1, y1);
						else if (pri === 1)
							~t & 0x8000 && !this.isspace[code] && this.xfer8x8_1(data, code, color, x - (vx & 7), y - (vy & 7), x0, y0, x1, y1);
						else
							this.xfer8x8_0(data, code, color, x - (vx & 7), y - (vy & 7), x0, y0, x1, y1);
					}
	}

	xfer8x8_0(data, code, color, x, y, x0, y0, x1, y1) {
		const x2 = Math.max(x, x0), y2 = Math.max(y, y0), w = Math.min(x + 8, x1) - x2, h = Math.min(y + 8, y1) - y2;
		for (let p = 16 + y2 << 8 | 16 + x2, q = code << 6 | y2 - y << 3 | x2 - x, i = 0; i < h; p += 256 - w, q += 8 - w, i++)
			for (let px, j = 0; j < w; p++, j++)
				!(px = this.bg[q++]) && (data[p] = color | px);
	}

	xfer8x8_1(data, code, color, x, y, x0, y0, x1, y1) {
		const x2 = Math.max(x, x0), y2 = Math.max(y, y0), w = Math.min(x + 8, x1) - x2, h = Math.min(y + 8, y1) - y2;
		for (let p = 16 + y2 << 8 | 16 + x2, q = code << 6 | y2 - y << 3 | x2 - x, i = 0; i < h; p += 256 - w, q += 8 - w, i++)
			for (let px, j = 0; j < w; p++, j++)
				(px = this.bg[q++]) && (data[p] = color | px);
	}

	drawFG(data, mask, cmp) {
		const view = new DataView(this.ram.buffer);
		for (let i = 0; i < 32; i++)
			for (let px, j = 0; j < 64; j++) {
				const x = 232 - i * 8 & 0xff, y = -176 + j * 8 & 0x1ff, t = view.getUint16(0x10000 | i << 7 | j << 1);
				const code = this.bgbank[0] | t & 0x1ff, color = t >> 6 & 0x38;
				if (x < 9 || x > 239 || y < 9 || y > 335 || (t & mask) !== cmp || this.isspace[code])
					continue;
				const p = x | y << 8, q = code << 6;
				(px = this.bg[q | 0x00]) && (data[p | 0x000] = color | px);
				(px = this.bg[q | 0x01]) && (data[p | 0x001] = color | px);
				(px = this.bg[q | 0x02]) && (data[p | 0x002] = color | px);
				(px = this.bg[q | 0x03]) && (data[p | 0x003] = color | px);
				(px = this.bg[q | 0x04]) && (data[p | 0x004] = color | px);
				(px = this.bg[q | 0x05]) && (data[p | 0x005] = color | px);
				(px = this.bg[q | 0x06]) && (data[p | 0x006] = color | px);
				(px = this.bg[q | 0x07]) && (data[p | 0x007] = color | px);
				(px = this.bg[q | 0x08]) && (data[p | 0x100] = color | px);
				(px = this.bg[q | 0x09]) && (data[p | 0x101] = color | px);
				(px = this.bg[q | 0x0a]) && (data[p | 0x102] = color | px);
				(px = this.bg[q | 0x0b]) && (data[p | 0x103] = color | px);
				(px = this.bg[q | 0x0c]) && (data[p | 0x104] = color | px);
				(px = this.bg[q | 0x0d]) && (data[p | 0x105] = color | px);
				(px = this.bg[q | 0x0e]) && (data[p | 0x106] = color | px);
				(px = this.bg[q | 0x0f]) && (data[p | 0x107] = color | px);
				(px = this.bg[q | 0x10]) && (data[p | 0x200] = color | px);
				(px = this.bg[q | 0x11]) && (data[p | 0x201] = color | px);
				(px = this.bg[q | 0x12]) && (data[p | 0x202] = color | px);
				(px = this.bg[q | 0x13]) && (data[p | 0x203] = color | px);
				(px = this.bg[q | 0x14]) && (data[p | 0x204] = color | px);
				(px = this.bg[q | 0x15]) && (data[p | 0x205] = color | px);
				(px = this.bg[q | 0x16]) && (data[p | 0x206] = color | px);
				(px = this.bg[q | 0x17]) && (data[p | 0x207] = color | px);
				(px = this.bg[q | 0x18]) && (data[p | 0x300] = color | px);
				(px = this.bg[q | 0x19]) && (data[p | 0x301] = color | px);
				(px = this.bg[q | 0x1a]) && (data[p | 0x302] = color | px);
				(px = this.bg[q | 0x1b]) && (data[p | 0x303] = color | px);
				(px = this.bg[q | 0x1c]) && (data[p | 0x304] = color | px);
				(px = this.bg[q | 0x1d]) && (data[p | 0x305] = color | px);
				(px = this.bg[q | 0x1e]) && (data[p | 0x306] = color | px);
				(px = this.bg[q | 0x1f]) && (data[p | 0x307] = color | px);
				(px = this.bg[q | 0x20]) && (data[p | 0x400] = color | px);
				(px = this.bg[q | 0x21]) && (data[p | 0x401] = color | px);
				(px = this.bg[q | 0x22]) && (data[p | 0x402] = color | px);
				(px = this.bg[q | 0x23]) && (data[p | 0x403] = color | px);
				(px = this.bg[q | 0x24]) && (data[p | 0x404] = color | px);
				(px = this.bg[q | 0x25]) && (data[p | 0x405] = color | px);
				(px = this.bg[q | 0x26]) && (data[p | 0x406] = color | px);
				(px = this.bg[q | 0x27]) && (data[p | 0x407] = color | px);
				(px = this.bg[q | 0x28]) && (data[p | 0x500] = color | px);
				(px = this.bg[q | 0x29]) && (data[p | 0x501] = color | px);
				(px = this.bg[q | 0x2a]) && (data[p | 0x502] = color | px);
				(px = this.bg[q | 0x2b]) && (data[p | 0x503] = color | px);
				(px = this.bg[q | 0x2c]) && (data[p | 0x504] = color | px);
				(px = this.bg[q | 0x2d]) && (data[p | 0x505] = color | px);
				(px = this.bg[q | 0x2e]) && (data[p | 0x506] = color | px);
				(px = this.bg[q | 0x2f]) && (data[p | 0x507] = color | px);
				(px = this.bg[q | 0x30]) && (data[p | 0x600] = color | px);
				(px = this.bg[q | 0x31]) && (data[p | 0x601] = color | px);
				(px = this.bg[q | 0x32]) && (data[p | 0x602] = color | px);
				(px = this.bg[q | 0x33]) && (data[p | 0x603] = color | px);
				(px = this.bg[q | 0x34]) && (data[p | 0x604] = color | px);
				(px = this.bg[q | 0x35]) && (data[p | 0x605] = color | px);
				(px = this.bg[q | 0x36]) && (data[p | 0x606] = color | px);
				(px = this.bg[q | 0x37]) && (data[p | 0x607] = color | px);
				(px = this.bg[q | 0x38]) && (data[p | 0x700] = color | px);
				(px = this.bg[q | 0x39]) && (data[p | 0x701] = color | px);
				(px = this.bg[q | 0x3a]) && (data[p | 0x702] = color | px);
				(px = this.bg[q | 0x3b]) && (data[p | 0x703] = color | px);
				(px = this.bg[q | 0x3c]) && (data[p | 0x704] = color | px);
				(px = this.bg[q | 0x3d]) && (data[p | 0x705] = color | px);
				(px = this.bg[q | 0x3e]) && (data[p | 0x706] = color | px);
				(px = this.bg[q | 0x3f]) && (data[p | 0x707] = color | px);
			}
	}

	drawObj(data, cat) {
		for (let k = 0x11000; k < 0x11800; k += 0x10) {
			if (this.ram[k + 4] & 0x80)
				break;
			const x1 = ~this.ram[k] & 0xff, x0 = ~this.ram[k + 1] & 0xff;
			const y0 = (this.ram[k + 2] << 8 & 0x100 | this.ram[k + 3]) - 168 & 0x1ff;
			if ((this.ram[k + 9] >> 6) !== cat || this.ram[k + 4] & 0x40)
				continue;
			const flip = this.ram[k + 4] & 1, pitch = this.ram[k + 5] << 24 >> 23;
			const color = this.ram[k + 9] << 4 & 0x3f0 | 0x400, obank = this.ram[k + 8] << 17 & 0x1e0000;
			const hzoom = 0x20 | this.ram[k + 0xa] << 3 & 0x18 | this.ram[k + 0xb] >> 5, vzoom = this.ram[k + 0xb] & 0x1f;
			for (let addr = this.ram[k + 6] << 9 | this.ram[k + 7] << 1, xacc = 0, x = x0; x > x1; --x) {
				addr += pitch * ((xacc += hzoom) >> 5), xacc &= 0x1f;
				if (flip)
					for (let a = addr & 0x1fffe, yacc = vzoom << 2 & 0x3c, y = y0, px = 0; px !== 15 && y < y0 + 512; a = a - 2 & 0x1fffe) {
						let px0 = OBJ[a | obank], px1 = OBJ[1 | a | obank];
						px = px1 & 15, (yacc += vzoom) < 0x40 ? (px && px !== 15 && (data[x - 16 & 0xff | y << 8 & 0x1ff00] = color | px), y++) : yacc -= 0x40;
						px = px1 >> 4, (yacc += vzoom) < 0x40 ? (px && px !== 15 && (data[x - 16 & 0xff | y << 8 & 0x1ff00] = color | px), y++) : yacc -= 0x40;
						px = px0 & 15, (yacc += vzoom) < 0x40 ? (px && px !== 15 && (data[x - 16 & 0xff | y << 8 & 0x1ff00] = color | px), y++) : yacc -= 0x40;
						px = px0 >> 4, (yacc += vzoom) < 0x40 ? (px && px !== 15 && (data[x - 16 & 0xff | y << 8 & 0x1ff00] = color | px), y++) : yacc -= 0x40;
					}
				else
					for (let a = addr & 0x1fffe, yacc = vzoom << 2 & 0x3c, y = y0, px = 0; px !== 15 && y < y0 + 512; a = a + 2 & 0x1fffe) {
						let px0 = OBJ[a | obank], px1 = OBJ[1 | a | obank];
						px = px0 >> 4, (yacc += vzoom) < 0x40 ? (px && px !== 15 && (data[x - 16 & 0xff | y << 8 & 0x1ff00] = color | px), y++) : yacc -= 0x40;
						px = px0 & 15, (yacc += vzoom) < 0x40 ? (px && px !== 15 && (data[x - 16 & 0xff | y << 8 & 0x1ff00] = color | px), y++) : yacc -= 0x40;
						px = px1 >> 4, (yacc += vzoom) < 0x40 ? (px && px !== 15 && (data[x - 16 & 0xff | y << 8 & 0x1ff00] = color | px), y++) : yacc -= 0x40;
						px = px1 & 15, (yacc += vzoom) < 0x40 ? (px && px !== 15 && (data[x - 16 & 0xff | y << 8 & 0x1ff00] = color | px), y++) : yacc -= 0x40;
					}
			}
		}
	}
}

const keydown = e => {
	if (e.repeat)
		return;
	switch (e.code) {
	case 'ArrowLeft':
		return void game.left(true);
	case 'ArrowUp':
		return void game.up(true);
	case 'ArrowRight':
		return void game.right(true);
	case 'ArrowDown':
		return void game.down(true);
	case 'Digit0':
		return void game.coin();
	case 'Digit1':
		return void game.start1P();
	case 'Digit2':
		return void game.start2P();
	case 'KeyC':
		return void game.triggerX(true);
	case 'KeyM': // MUTE
		if (audioCtx.state === 'suspended')
			audioCtx.resume().catch();
		else if (audioCtx.state === 'running')
			audioCtx.suspend().catch();
		return;
	case 'KeyR':
		return void game.reset();
	case 'KeyT':
		return void(game.fTest = true);
	case 'Space':
	case 'KeyX':
		return void game.triggerA(true);
	case 'KeyZ':
		return void game.triggerB(true);
	}
};

const keyup = e => {
	switch (e.code) {
	case 'ArrowLeft':
		return void game.left(false);
	case 'ArrowUp':
		return void game.up(false);
	case 'ArrowRight':
		return void game.right(false);
	case 'ArrowDown':
		return void game.down(false);
	case 'KeyC':
		return void game.triggerX(false);
	case 'KeyT':
		return void(game.fTest = false);
	case 'Space':
	case 'KeyX':
		return void game.triggerA(false);
	case 'KeyZ':
		return void game.triggerB(false);
	}
};

/*
 *
 *	Golden Axe
 *
 */

const PRG1 = new Uint8Array(0x80000).addBase(), OBJ = new Uint8Array(0x200000).fill(0xff);
let KEY, BG, PRG2;

read('goldnaxe.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	zip.decompress('goldnaxej/epr-12540.a7').forEach((e, i) => PRG1[i << 1] = e);
	zip.decompress('goldnaxej/epr-12539.a5').forEach((e, i) => PRG1[1 | i << 1] = e);
	zip.decompress('goldnaxe2/epr-12521.a8').forEach((e, i) => PRG1[0x40000 | i << 1] = e);
	zip.decompress('goldnaxe2/epr-12519.a6').forEach((e, i) => PRG1[0x40001 | i << 1] = e);
	KEY = zip.decompress('goldnaxej/317-0121.key');
	BG = Uint8Array.concat(...['epr-12385.ic19', 'epr-12386.ic20', 'epr-12387.ic21'].map(e => zip.decompress(e)));
	zip.decompress('mpr-12379.ic12').subarray(0, 0x20000).forEach((e, i) => OBJ[i << 1] = e);
	zip.decompress('mpr-12378.ic9').subarray(0, 0x20000).forEach((e, i) => OBJ[1 | i << 1] = e);
	zip.decompress('mpr-12381.ic13').subarray(0, 0x20000).forEach((e, i) => OBJ[0x40000 | i << 1] = e);
	zip.decompress('mpr-12380.ic10').subarray(0, 0x20000).forEach((e, i) => OBJ[0x40001 | i << 1] = e);
	zip.decompress('mpr-12383.ic14').subarray(0, 0x20000).forEach((e, i) => OBJ[0x80000 | i << 1] = e);
	zip.decompress('mpr-12382.ic11').subarray(0, 0x20000).forEach((e, i) => OBJ[0x80001 | i << 1] = e);
	zip.decompress('mpr-12379.ic12').subarray(0x20000).forEach((e, i) => OBJ[0x100000 | i << 1] = e);
	zip.decompress('mpr-12378.ic9').subarray(0x20000).forEach((e, i) => OBJ[0x100001 | i << 1] = e);
	zip.decompress('mpr-12381.ic13').subarray(0x20000).forEach((e, i) => OBJ[0x140000 | i << 1] = e);
	zip.decompress('mpr-12380.ic10').subarray(0x20000).forEach((e, i) => OBJ[0x140001 | i << 1] = e);
	zip.decompress('mpr-12383.ic14').subarray(0x20000).forEach((e, i) => OBJ[0x180000 | i << 1] = e);
	zip.decompress('mpr-12382.ic11').subarray(0x20000).forEach((e, i) => OBJ[0x180001 | i << 1] = e);
	PRG2 = Uint8Array.concat(...['epr-12390.ic8', 'mpr-12384.ic6'].map(e => zip.decompress(e))).addBase();
	game = new GoldenAxe();
	sound = [
		new YM2151({clock: 8000000 / 2}),
		new UPD7759(),
	];
	canvas.addEventListener('click', () => game.coin());
	init({game, sound, keydown, keyup});
});

