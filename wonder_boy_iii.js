/*
 *
 *	Wonder Boy III
 *
 */

import YM2151 from './ym2151.js';
import {init, seq, rseq, convertGFX, read} from './main.js';
import FD1094 from './fd1094.js';
import Z80 from './z80.js';
let game, sound;

class WonderBoyIII {
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
	nLife = 3;
	nBonus = '50k/100k/180k/300k';
	nDifficulty = 'Normal';

	ram = new Uint8Array(0x18000).addBase();
	ram2 = new Uint8Array(0x800).addBase();
	in = Uint8Array.of(0xff, 0xff, 0xff, 0xff, 0xff, 0xfd);
	fm = {addr: 0, reg: new Uint8Array(0x100), status: 0, timera: 0, timerb: 0};
	count = 0;
	command = [];

	bg = new Uint8Array(0x80000).fill(7);
	rgb = new Uint32Array(0x800).fill(0xff000000);
	isspace;
	mode = new Uint8Array(2);

	cpu = new FD1094(KEY);
	cpu2 = new Z80();

	constructor() {
		// CPU周りの初期化
		const range = (page, start, end, mirror = 0) => (page & ~mirror) >= start && (page & ~mirror) <= end;

		for (let page = 0; page < 0x10000; page++)
			if (range(page, 0, 0x3ff, 0x3800))
				this.cpu.memorymap[page].base = PRG1.base[page & 0x3ff];
			else if (range(page, 0x4000, 0x407f, 0xb880)) {
				this.cpu.memorymap[page].base = this.ram.base[page & 0x7f];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0x4100, 0x410f, 0xb8f0)) {
				this.cpu.memorymap[page].base = this.ram.base[0x100 | page & 0xf];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0x4400, 0x4407, 0x3bf8)) {
				this.cpu.memorymap[page].base = this.ram.base[0x110 | page & 7];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0x8400, 0x840f, 0x3bf0)) {
				this.cpu.memorymap[page].base = this.ram.base[0x120 | page & 0xf];
				this.cpu.memorymap[page].write = null;
				this.cpu.memorymap[page].write16 = (addr, data) => {
					const offset = addr & 0xffe;
					this.ram[0x12000 | offset] = data >> 8, this.ram[0x12001 | offset] = data;
					this.rgb[offset >> 1] = (data >> 12 & 1 | data << 1 & 0x1e) * 255 / 31	// Red
						| (data >> 13 & 1 | data >> 3 & 0x1e) * 255 / 31 << 8				// Green
						| (data >> 14 & 1 | data >> 7 & 0x1e) * 255 / 31 << 16				// Blue
						| 0xff000000;														// Alpha
				};
			} else if (range(page, 0xc400, 0xc43f, 0x39c0)) {
				this.cpu.memorymap[page].read = (addr) => {
					switch (addr & 0x3000) {
					case 0x1000:
						return this.in[addr >> 1 & 3];
					case 0x2000:
						return this.in[4 | addr >> 1 & 1];
					}
					return 0xff;
				};
				this.cpu.memorymap[page].write = (addr, data) => {
					switch (addr & 0x3007) {
					case 1:
						return this.command.push(data);
					case 3:
						return void(this.mode[0] = data);
					case 5:
						return void(this.mode[1] = data);
					}
				};
			} else if (range(page, 0xc700, 0xc73f, 0x38c0)) {
				this.cpu.memorymap[page].base = this.ram.base[0x140 | page & 0x3f];
				this.cpu.memorymap[page].write = null;
			}

		for (let i = 0; i < 0x80; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		this.cpu2.memorymap[0xe8].read = (addr) => { return addr === 0xe800 && this.command.length ? this.command.shift() : 0xff; };
		for (let i = 0; i < 8; i++) {
			this.cpu2.memorymap[0xf8 + i].base = this.ram2.base[i];
			this.cpu2.memorymap[0xf8 + i].write = null;
		}
		for (let i = 0; i < 0x100; i++) {
			this.cpu2.iomap[i].read = (addr) => {
				switch (addr >> 6 & 3) {
				case 0:
					return addr & 1 ? this.fm.status : 0xff;
				case 3:
					return this.command.length ? this.command.shift() : 0xff;
				}
				return 0xff;
			};
			this.cpu2.iomap[i].write = (addr, data) => {
				if (addr >> 6 & 3)
					return;
				if (~addr & 1)
					return void(this.fm.addr = data);
				if (this.fm.addr === 0x14) { // CSM/F RESET/IRQEN/LOAD
					this.fm.status &= ~(data >> 4 & 3);
					data & ~this.fm.reg[0x14] & 1 && (this.fm.timera = this.fm.reg[0x10] << 2 | this.fm.reg[0x11] & 3);
					data & ~this.fm.reg[0x14] & 2 && (this.fm.timerb = this.fm.reg[0x12]);
				}
				return sound.write(this.fm.addr, this.fm.reg[this.fm.addr] = data, this.count);
			};
		}

		// Videoの初期化
		convertGFX(this.bg, BG, 8192, rseq(8, 0, 8), seq(8), [Math.floor(BG.length / 3) * 16, Math.floor(BG.length / 3) * 8, 0], 8);
		this.isspace = Uint8Array.from(seq(8192), i => Number(this.bg.subarray(i << 6, i + 1 << 6).every(e => !e)));
	}

	execute() {
		this.cpu.interrupt(4), this.cpu.execute(0x4000);
		for (this.count = 0; this.count < 65; this.count++) { // 4000000 / 60 / 1024
			this.command.length && this.cpu2.non_maskable_interrupt(), this.cpu2.execute(128);
			if (this.fm.reg[0x14] & 1 && (this.fm.timera += 16) >= 0x400)
				this.fm.status |= this.fm.reg[0x14] >> 2 & 1, this.fm.timera = (this.fm.timera & 0x3ff) + (this.fm.reg[0x10] << 2 | this.fm.reg[0x11] & 3);
			if (this.fm.reg[0x14] & 2 && ++this.fm.timerb >= 0x100)
				this.fm.status |= this.fm.reg[0x14] >> 2 & 2, this.fm.timerb = (this.fm.timerb & 0xff) + this.fm.reg[0x12];
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
				this.in[5] &= ~2;
			else
				this.in[5] |= 2;
			switch (this.nLife) {
			case 2:
				this.in[5] &= ~0xc;
				break;
			case 3:
				this.in[5] |= 0xc;
				break;
			case 4:
				this.in[5] = this.in[5] & ~0xc | 8;
				break;
			case 5:
				this.in[5] = this.in[5] & ~0xc | 4;
				break;
			}
			switch (this.nBonus) {
			case '50k/100k/180k/300k':
				this.in[5] |= 0x10;
				break;
			case '50k/150k/300k':
				this.in[5] &= ~0x10;
				break;
			}
			switch (this.nDifficulty) {
			case 'Normal':
				this.in[5] |= 0x20;
				break;
			case 'Hard':
				this.in[5] &= ~0x20;
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
			this.fReset = false;
			this.cpu.reset();
			this.command.splice(0);
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

	makeBitmap(data) {
		// 画面クリア
		if (~this.mode[0] & 0x10) {
			let p = 256 * 16 + 16;
			for (let i = 0; i < 320; p += 256, i++)
				data.fill(0xff000000, p, p + 224);
			return;
		}

		// bg/obj描画
		this.drawBG(data, 2, 0);
		this.drawObj(data, 0);
		this.drawBG(data, 2, 1);
		this.drawObj(data, 1);
		this.drawBG(data, 2, 2);
		this.drawBG(data, 0, 1);
		this.drawObj(data, 2);
		this.drawBG(data, 0, 2);
		this.drawFG(data, 0x800, 0);
		this.drawObj(data, 3);
		this.drawFG(data, 0x800, 0x800);

		// palette変換
		let p = 256 * 16 + 16;
		for (let i = 0; i < 320; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] = this.rgb[data[p]];
	}

	drawBG(data, disp, pri) {
		const view = new DataView(this.ram.buffer), page = view.getUint16(0x10e9e - disp);
		const hScroll = view.getUint16(0x10f24 + disp) & 0xff, vScroll = view.getUint16(0x10ff8 + disp) & 0x1ff;
		const col = !(this.mode[1] & 4), row = !(this.mode[1] & 2);
		if (col || row)
			for (let y0 = 0; y0 < 320; y0 += 16)
				for (let y1 = y0 + 16, x0 = 0; x0 < 224; x0 += 8)
					for (let x1 = x0 + 8, y = y0; y <= y1; y += 8)
						for (let x = x0; x <= x1; x += 8) {
							const vx = 32 + x - (col ? view.getUint16(0x10f30 + (y0 >> 4 << 2) + disp) & 0xff : hScroll);
							const vy = 200 + y - (row ? view.getUint16(0x10f80 + (223 - x0 >> 3 << 2) + disp) & 0x1ff : vScroll);
							const t = view.getUint16(page << (~vx >> 5 & 8 | vy >> 7 & 4) & 0x7000 | ~vx << 4 & 0xf80 | vy >> 2 & 0x7e);
							const code = t >> 1 & 0x1000 | t & 0xfff, color = t >> 2 & 0x3f8;
							if (pri === 2)
								t & 0x1000 && !this.isspace[code] && this.xfer8x8_1(data, code, color, x - (vx & 7), y - (vy & 7), x0, y0, x1, y1);
							else if (pri === 1)
								~t & 0x1000 && !this.isspace[code] && this.xfer8x8_1(data, code, color, x - (vx & 7), y - (vy & 7), x0, y0, x1, y1);
							else
								this.xfer8x8_0(data, code, color, x - (vx & 7), y - (vy & 7), x0, y0, x1, y1);
						}
		else
			for (let x0 = 0, y0 = 0, x1 = 224, y1 = 320, y = y0; y <= y1; y += 8)
				for (let x = x0; x <= x1; x += 8) {
					const vx = 32 + x - hScroll, vy = 200 + y - vScroll;
					const t = view.getUint16(page << (~vx >> 5 & 8 | vy >> 7 & 4) & 0x7000 | ~vx << 4 & 0xf80 | vy >> 2 & 0x7e);
					const code = t >> 1 & 0x1000 | t & 0xfff, color = t >> 2 & 0x3f8;
					if (pri === 2)
						t & 0x1000 && !this.isspace[code] && this.xfer8x8_1(data, code, color, x - (vx & 7), y - (vy & 7), x0, y0, x1, y1);
					else if (pri === 1)
						~t & 0x1000 && !this.isspace[code] && this.xfer8x8_1(data, code, color, x - (vx & 7), y - (vy & 7), x0, y0, x1, y1);
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
				const code = t & 0xff, color = t >> 5 & 0x38;
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
			const x1 = ~this.ram[k] & 0xff, x0 = ~this.ram[k + 1] & 0xff;
			const y0 = (this.ram[k + 2] << 8 & 0x100 | this.ram[k + 3]) - 173 & 0x1ff;
			if ((this.ram[k + 9] & 3) !== cat || x1 < 0x0f || x0 <= x1)
				continue;
			const pitch = this.ram[k + 4] << 9 | this.ram[k + 5] << 1;
			const color = this.ram[k + 8] << 4 & 0x3f0 | 0x400, obank = this.ram[k + 9] << 12 & 0x70000;
			for (let addr = this.ram[k + 6] << 9 | this.ram[k + 7] << 1, x = x0; x > x1; --x)
				if ((addr += pitch) & 0x10000)
					for (let a = addr & 0xfffe, y = y0, px = 0; px !== 0xf && y < y0 + 512; a = a - 2 & 0xfffe, y += 4) {
						let px0 = OBJ[a | obank], px1 = OBJ[1 | a | obank];
						if ((px = px1 & 15) && px !== 15)
							data[x - 17 & 0xff | y << 8 & 0x1ff00] = color | px;
						if ((px = px1 >> 4) && px !== 15)
							data[x - 17 & 0xff | y + 1 << 8 & 0x1ff00] = color | px;
						if ((px = px0 & 15) && px !== 15)
							data[x - 17 & 0xff | y + 2 << 8 & 0x1ff00] = color | px;
						if ((px = px0 >> 4) && px !== 15)
							data[x - 17 & 0xff | y + 3 << 8 & 0x1ff00] = color | px;
					}
				else
					for (let a = addr & 0xfffe, y = y0, px = 0; px !== 0xf && y < y0 + 512; a = a + 2 & 0xfffe, y += 4) {
						let px0 = OBJ[a | obank], px1 = OBJ[1 | a | obank];
						if ((px = px0 >> 4) && px !== 15)
							data[x - 17 & 0xff | y << 8 & 0x1ff00] = color | px;
						if ((px = px0 & 15) && px !== 15)
							data[x - 17 & 0xff | y + 1 << 8 & 0x1ff00] = color | px;
						if ((px = px1 >> 4) && px !== 15)
							data[x - 17 & 0xff | y + 2 << 8 & 0x1ff00] = color | px;
						if ((px = px1 & 15) && px !== 15)
							data[x - 17 & 0xff | y + 3 << 8 & 0x1ff00] = color | px;
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
 *	Wonder Boy III
 *
 */

const PRG1 = new Uint8Array(0x40000).addBase(), OBJ = new Uint8Array(0x80000);
let KEY, BG, PRG2;

read('wb3.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	zip.decompress('wb31/epr-12084.bin').forEach((e, i) => PRG1[i << 1] = e);
	zip.decompress('wb31/epr-12082.bin').forEach((e, i) => PRG1[1 | i << 1] = e);
	zip.decompress('wb31/epr-12085.bin').forEach((e, i) => PRG1[0x20000 | i << 1] = e);
	zip.decompress('wb31/epr-12083.bin').forEach((e, i) => PRG1[0x20001 | i << 1] = e);
	KEY = zip.decompress('wb31/317-0084.key');
	BG = Uint8Array.concat(...['wb31/epr-12086.bin', 'wb31/epr-12087.bin', 'wb31/epr-12088.bin'].map(e => zip.decompress(e)));
	zip.decompress('epr-12090.b1').subarray(0, 0x8000).forEach((e, i) => OBJ[1 | i << 1] = e);
	zip.decompress('epr-12094.b5').subarray(0, 0x8000).forEach((e, i) => OBJ[i << 1] = e);
	zip.decompress('epr-12091.b2').subarray(0, 0x8000).forEach((e, i) => OBJ[0x10001 | i << 1] = e);
	zip.decompress('epr-12095.b6').subarray(0, 0x8000).forEach((e, i) => OBJ[0x10000 | i << 1] = e);
	zip.decompress('epr-12092.b3').subarray(0, 0x8000).forEach((e, i) => OBJ[0x20001 | i << 1] = e);
	zip.decompress('epr-12096.b7').subarray(0, 0x8000).forEach((e, i) => OBJ[0x20000 | i << 1] = e);
	zip.decompress('epr-12093.b4').subarray(0, 0x8000).forEach((e, i) => OBJ[0x30001 | i << 1] = e);
	zip.decompress('epr-12097.b8').subarray(0, 0x8000).forEach((e, i) => OBJ[0x30000 | i << 1] = e);
	zip.decompress('epr-12090.b1').subarray(0x8000).forEach((e, i) => OBJ[0x40001 | i << 1] = e);
	zip.decompress('epr-12094.b5').subarray(0x8000).forEach((e, i) => OBJ[0x40000 | i << 1] = e);
	zip.decompress('epr-12091.b2').subarray(0x8000).forEach((e, i) => OBJ[0x50001 | i << 1] = e);
	zip.decompress('epr-12095.b6').subarray(0x8000).forEach((e, i) => OBJ[0x50000 | i << 1] = e);
	zip.decompress('epr-12092.b3').subarray(0x8000).forEach((e, i) => OBJ[0x60001 | i << 1] = e);
	zip.decompress('epr-12096.b7').subarray(0x8000).forEach((e, i) => OBJ[0x60000 | i << 1] = e);
	zip.decompress('epr-12093.b4').subarray(0x8000).forEach((e, i) => OBJ[0x70001 | i << 1] = e);
	zip.decompress('epr-12097.b8').subarray(0x8000).forEach((e, i) => OBJ[0x70000 | i << 1] = e);
	PRG2 = zip.decompress('wb31/epr-12089.bin').addBase();
	game = new WonderBoyIII();
	sound = new YM2151({clock: 4000000, resolution: 65});
	canvas.addEventListener('click', () => game.coin());
	init({game, sound, keydown, keyup});
});

