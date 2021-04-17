/*
 *
 *	Sukeban Jansi Ryuko
 *
 */

import YM2151 from './ym2151.js';
import UPD7751 from './upd7751.js';
import {seq, rseq, convertGFX, Timer} from './utils.js';
import {init, read} from './main.js';
import FD1089B from './fd1089b.js';
import Z80 from './z80.js';
let game, sound;

class SukebanJansiRyuko {
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
	fTurbo = false;
	fDemoSound = true;
	nLevel = 'Weak';

	ram = new Uint8Array(0x18000).addBase();
	ram2 = new Uint8Array(0x800).addBase();
	in = Uint8Array.of(0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfb);
	input_num = 0;
	command = 0;
	cpu2_nmi = false;

	bg = new Uint8Array(0x40000).fill(7);
	isspace;
	rgb = new Int32Array(0x800).fill(0xff000000);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;
	mode = new Uint8Array(2);

	cpu = new FD1089B(KEY, 10000000);
	cpu2 = new Z80(4000000);
	timer = new Timer(60);

	constructor() {
		// CPU周りの初期化
		const range = (page, start, end, mirror = 0) => (page & ~mirror) >= start && (page & ~mirror) <= end;

		for (let page = 0; page < 0x10000; page++)
			if (range(page, 0, 0x1ff, 0x3800))
				this.cpu.memorymap[page].base = PRG1.base[page & 0x1ff];
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
						switch (addr >> 1 & 3) {
						case 0:
							return this.in[6];
						case 1:
							return this.in[this.input_num] === 0xff ? 0xff : 1 << this.input_num ^ 0xff;
						case 2:
							return this.in[this.input_num];
						default:
							return 0xff;
						}
					case 0x2000:
						return this.in[10 | addr >> 1 & 1];
					}
					return 0xff;
				};
				this.cpu.memorymap[page].write = (addr, data) => {
					switch (addr & 0x3007) {
					case 1:
						return this.cpu2_nmi = true, void(this.command = data);
					case 3:
						data & ~this.mode[0] & 4 && (this.input_num = (this.input_num + 1) % 6);
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
				case 3:
					return this.command;
				}
				return 0xff;
			};
			this.cpu2.iomap[i].write = (addr, data) => {
				switch (addr >> 6 & 3) {
				case 0:
					if (~addr & 1)
						return void (sound[0].addr = data);
					if (sound[0].addr === 0x1b)
						sound[1].reset(data >> 6 & 1), sound[1].interrupt(data >> 7);
					return sound[0].write(data);
				case 2:
					return sound[1].write(data);
				}
			};
		}

		this.cpu2.check_interrupt = () => { return this.cpu2_nmi && (this.cpu2_nmi = false, this.cpu2.non_maskable_interrupt()); };

		// Videoの初期化
		convertGFX(this.bg, BG, 4096, rseq(8, 0, 8), seq(8), [Math.floor(BG.length / 3) * 16, Math.floor(BG.length / 3) * 8, 0], 8);
		this.isspace = Uint8Array.from(seq(4096), i => Number(this.bg.subarray(i << 6, i + 1 << 6).every(e => !e)));
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.cpu2.execute(tick_rate);
			this.timer.execute(tick_rate, () => { update(), this.cpu.interrupt(4); });
			sound[0].execute(tick_rate);
			sound[1].execute(tick_rate);
			audio.execute(tick_rate);
		}
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// DIPスイッチの更新
		if (this.fDIPSwitchChanged) {
			this.fDIPSwitchChanged = false;
			if (this.fDemoSound)
				this.in[11] &= ~4;
			else
				this.in[11] |= 4;
			switch (this.nLevel) {
			case 'Weak':
				this.in[11] |= 3;
				break;
			case 'Medium Weak':
				this.in[11] = this.in[11] & ~3 | 2;
				break;
			case 'Medium Strong':
				this.in[11] = this.in[11] & ~3 | 1;
				break;
			case 'Strong':
				this.in[11] &= ~3;
				break;
			}
			this.fReset = true;
		}

		if (this.fTest)
			this.in[6] &= ~4;
		else
			this.in[6] |= 4;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu.reset();
			this.cpu2_nmi = false;
			this.cpu2.reset();
		}
		return this;
	}

	updateInput() {
		this.in[6] = this.in[6] & ~8 | !this.fCoin << 3, this.in[4] = this.in[4] & ~1 | (this.fStart1P < 1);
		this.fCoin -= !!this.fCoin, this.fStart1P -= (this.fStart1P > 0 || this.fTurbo), this.fStart1P < 0 && (this.fStart1P = 2);
		return this;
	}

	coin(fDown) {
		fDown && (this.fCoin = 2);
	}

	start1P(fDown) {
		fDown && (this.fStart1P = 2);
	}

	makeBitmap(flag) {
		if (!(this.updated = flag))
			return this.bitmap;

		// 画面クリア
		if (~this.mode[0] & 0x10) {
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
		this.drawFG(this.bitmap, 0x800, 0);
		this.drawObj(this.bitmap, 3);
		this.drawFG(this.bitmap, 0x800, 0x800);

		// palette変換
		let p = 256 * 16 + 16;
		for (let i = 0; i < 320; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				this.bitmap[p] = this.rgb[this.bitmap[p]];

		return this.bitmap;
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
							const code = t & 0xfff, color = t >> 2 & 0x3f8;
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
					const code = t & 0xfff, color = t >> 2 & 0x3f8;
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
					for (let a = addr & 0xfffe, y = y0, px = 0; px !== 15 && y < y0 + 512; a = a - 2 & 0xfffe) {
						let px0 = OBJ[a | obank], px1 = OBJ[1 | a | obank];
						px = px1 & 15, px && px !== 15 && (data[x - 17 & 0xff | y << 8 & 0x1ff00] = color | px), y++;
						px = px1 >> 4, px && px !== 15 && (data[x - 17 & 0xff | y << 8 & 0x1ff00] = color | px), y++;
						px = px0 & 15, px && px !== 15 && (data[x - 17 & 0xff | y << 8 & 0x1ff00] = color | px), y++;
						px = px0 >> 4, px && px !== 15 && (data[x - 17 & 0xff | y << 8 & 0x1ff00] = color | px), y++;
					}
				else
					for (let a = addr & 0xfffe, y = y0, px = 0; px !== 15 && y < y0 + 512; a = a + 2 & 0xfffe) {
						let px0 = OBJ[a | obank], px1 = OBJ[1 | a | obank];
						px = px0 >> 4, px && px !== 15 && (data[x - 17 & 0xff | y << 8 & 0x1ff00] = color | px), y++;
						px = px0 & 15, px && px !== 15 && (data[x - 17 & 0xff | y << 8 & 0x1ff00] = color | px), y++;
						px = px1 >> 4, px && px !== 15 && (data[x - 17 & 0xff | y << 8 & 0x1ff00] = color | px), y++;
						px = px1 & 15, px && px !== 15 && (data[x - 17 & 0xff | y << 8 & 0x1ff00] = color | px), y++;
					}
		}
	}
}

const keydown = e => {
	if (e.repeat)
		return;
	switch (e.code) {
	case 'Digit0':
		return void game.coin(true);
	case 'Digit1':
		return void game.start1P(true);
	case 'Digit2': // FLIP FLOP
		return void(game.in[3] &= ~(1 << 4));
	case 'Digit3': // BET
		return void(game.in[4] &= ~(1 << 1));
	case 'Digit4': // LAST CHANCE
		return void(game.in[0] &= ~(1 << 4));
	case 'Digit5': // KAN
		return void(game.in[5] &= ~(1 << 0));
	case 'Digit6': // PON
		return void(game.in[3] &= ~(1 << 3));
	case 'Digit7': // CHI
		return void(game.in[3] &= ~(1 << 2));
	case 'Digit8': // REACH
		return void(game.in[5] &= ~(1 << 1));
	case 'Space':
	case 'Digit9': // RON
		return void(game.in[5] &= ~(1 << 2));
	case 'ArrowLeft':
	case 'KeyA':
		return void(game.in[0] &= ~(1 << 0));
	case 'ArrowRight':
	case 'KeyB':
		return void(game.in[0] &= ~(1 << 1));
	case 'KeyC':
		return void(game.in[0] &= ~(1 << 2));
	case 'KeyD':
		return void(game.in[0] &= ~(1 << 3));
	case 'KeyE':
		return void(game.in[1] &= ~(1 << 0));
	case 'KeyF':
		return void(game.in[1] &= ~(1 << 1));
	case 'KeyG':
		return void(game.in[1] &= ~(1 << 2));
	case 'KeyH':
		return void(game.in[1] &= ~(1 << 3));
	case 'KeyI':
		return void(game.in[2] &= ~(1 << 0));
	case 'KeyJ':
		return void(game.in[2] &= ~(1 << 1));
	case 'KeyK':
		return void(game.in[2] &= ~(1 << 2));
	case 'KeyL':
		return void(game.in[2] &= ~(1 << 3));
	case 'KeyM':
		return void(game.in[3] &= ~(1 << 0));
	case 'KeyN':
		return void(game.in[3] &= ~(1 << 1));
	case 'KeyR':
		return game.reset();
	case 'KeyT':
		return void(game.fTest = true);
	case 'KeyV': // MUTE
		return audioCtx.state === 'suspended' ? audioCtx.resume().catch() : audioCtx.state === 'running' && audioCtx.suspend().catch();
	case 'KeyZ':
		return void(game.fTurbo = true);
	}
};

const keyup = e => {
	switch (e.code) {
	case 'Digit2': // FLIP FLOP
		return void(game.in[3] |= 1 << 4);
	case 'Digit3': // BET
		return void(game.in[4] |= 1 << 1);
	case 'Digit4': // LAST CHANCE
		return void(game.in[0] |= 1 << 4);
	case 'Digit5': // KAN
		return void(game.in[5] |= 1 << 0);
	case 'Digit6': // PON
		return void(game.in[3] |= 1 << 3);
	case 'Digit7': // CHI
		return void(game.in[3] |= 1 << 2);
	case 'Digit8': // REACH
		return void(game.in[5] |= 1 << 1);
	case 'Space':
	case 'Digit9': // RON
		return void(game.in[5] |= 1 << 2);
	case 'ArrowLeft':
	case 'KeyA':
		return void(game.in[0] |= 1 << 0);
	case 'ArrowRight':
	case 'KeyB':
		return void(game.in[0] |= 1 << 1);
	case 'KeyC':
		return void(game.in[0] |= 1 << 2);
	case 'KeyD':
		return void(game.in[0] |= 1 << 3);
	case 'KeyE':
		return void(game.in[1] |= 1 << 0);
	case 'KeyF':
		return void(game.in[1] |= 1 << 1);
	case 'KeyG':
		return void(game.in[1] |= 1 << 2);
	case 'KeyH':
		return void(game.in[1] |= 1 << 3);
	case 'KeyI':
		return void(game.in[2] |= 1 << 0);
	case 'KeyJ':
		return void(game.in[2] |= 1 << 1);
	case 'KeyK':
		return void(game.in[2] |= 1 << 2);
	case 'KeyL':
		return void(game.in[2] |= 1 << 3);
	case 'KeyM':
		return void(game.in[3] |= 1 << 0);
	case 'KeyN':
		return void(game.in[3] |= 1 << 1);
	case 'KeyT':
		return void(game.fTest = false);
	case 'KeyZ':
		return void(game.fTurbo = false);
	}
};

/*
 *
 *	Sukeban Jansi Ryuko
 *
 */

const PRG1 = new Uint8Array(0x20000).addBase(), OBJ = new Uint8Array(0x80000);
let BG, PRG2, MCU, VOI, KEY;

read('sjryuko.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	zip.decompress('sjryuko1/epr-12251.43').forEach((e, i) => PRG1[i << 1] = e);
	zip.decompress('sjryuko1/epr-12249.26').forEach((e, i) => PRG1[1 | i << 1] = e);
	zip.decompress('sjryuko1/epr-12252.42').forEach((e, i) => PRG1[0x10000 | i << 1] = e);
	zip.decompress('sjryuko1/epr-12250.25').forEach((e, i) => PRG1[0x10001 | i << 1] = e);
	BG = Uint8Array.concat(...['epr-12224-95.b9', 'epr-12225-94.b10', 'epr-12226-93.b11'].map(e => zip.decompress(e)));
	zip.decompress('epr-12232-10.b1').subarray(0, 0x8000).forEach((e, i) => OBJ[1 | i << 1] = e);
	zip.decompress('epr-12236-11.b5').subarray(0, 0x8000).forEach((e, i) => OBJ[i << 1] = e);
	zip.decompress('epr-12233-17.b2').subarray(0, 0x8000).forEach((e, i) => OBJ[0x10001 | i << 1] = e);
	zip.decompress('epr-12237-18.b6').subarray(0, 0x8000).forEach((e, i) => OBJ[0x10000 | i << 1] = e);
	zip.decompress('epr-12234-23.b3').subarray(0, 0x8000).forEach((e, i) => OBJ[0x20001 | i << 1] = e);
	zip.decompress('epr-12238-24.b7').subarray(0, 0x8000).forEach((e, i) => OBJ[0x20000 | i << 1] = e);
	zip.decompress('epr-12235-29.b4').subarray(0, 0x8000).forEach((e, i) => OBJ[0x30001 | i << 1] = e);
	zip.decompress('epr-12239-30.b8').subarray(0, 0x8000).forEach((e, i) => OBJ[0x30000 | i << 1] = e);
	zip.decompress('epr-12232-10.b1').subarray(0x8000).forEach((e, i) => OBJ[0x40001 | i << 1] = e);
	zip.decompress('epr-12236-11.b5').subarray(0x8000).forEach((e, i) => OBJ[0x40000 | i << 1] = e);
	zip.decompress('epr-12233-17.b2').subarray(0x8000).forEach((e, i) => OBJ[0x50001 | i << 1] = e);
	zip.decompress('epr-12237-18.b6').subarray(0x8000).forEach((e, i) => OBJ[0x50000 | i << 1] = e);
	zip.decompress('epr-12234-23.b3').subarray(0x8000).forEach((e, i) => OBJ[0x60001 | i << 1] = e);
	zip.decompress('epr-12238-24.b7').subarray(0x8000).forEach((e, i) => OBJ[0x60000 | i << 1] = e);
	zip.decompress('epr-12235-29.b4').subarray(0x8000).forEach((e, i) => OBJ[0x70001 | i << 1] = e);
	zip.decompress('epr-12239-30.b8').subarray(0x8000).forEach((e, i) => OBJ[0x70000 | i << 1] = e);
	PRG2 = zip.decompress('sjryuko1/epr-12227.12').addBase();
	MCU = zip.decompress('sjryuko1/7751.bin').addBase();
	VOI = Uint8Array.concat(...['sjryuko1/epr-12228.1', 'sjryuko1/epr-12229.2', 'sjryuko1/epr-12230.4', 'sjryuko1/epr-12231.5'].map(e => zip.decompress(e)));
	KEY = zip.decompress('317-5021.key').addBase();
	game = new SukebanJansiRyuko();
	sound = [
		new YM2151({clock: 4000000}),
		new UPD7751({MCU, VOI}),
	];
	canvas.addEventListener('click', () => game.coin(true));
	init({game, sound, keydown, keyup});
});

