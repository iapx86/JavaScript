/*
 *
 *	Zig Zag
 *
 */

import AY_3_8910 from './ay-3-8910.js';
import {seq, rseq, convertGFX, Timer} from './utils.js';
import {init, expand} from './main.js';
import Z80 from './z80.js';
let game, sound;

class ZigZag {
	cxScreen = 224;
	cyScreen = 256;
	width = 256;
	height = 512;
	xOffset = 16;
	yOffset = 16;
	rotate = false;

	fReset = false;
	fTest = false;
	fDIPSwitchChanged = true;
	fCoin = 0;
	fStart1P = 0;
	fStart2P = 0;
	nLife = 3;
	nBonus = '10000 60000';

	fInterruptEnable = false;
	bank = 0x20;

	ram = new Uint8Array(0x900).addBase();
	in = Uint8Array.of(0, 0, 2);
	psg = {latch: 0, addr: 0};

	stars = [];
	fStarEnable = false;
	fStarMove = false;
	bg = new Uint8Array(0x4000).fill(3);
	obj = new Uint8Array(0x4000).fill(3);
	rgb = new Int32Array(0x80);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;

	cpu = new Z80(Math.floor(18432000 / 6));
	timer = new Timer(60);

	constructor() {
		// CPU周りの初期化
		const range = (page, start, end, mirror = 0) => (page & ~mirror) >= start && (page & ~mirror) <= end;

		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0x3f))
				this.cpu.memorymap[page].base = PRG.base[page & 0x3f];
			else if (range(page, 0x40, 0x43, 0x04)) {
				this.cpu.memorymap[page].base = this.ram.base[page & 3];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0x48, 0x48, 0x07))
				this.cpu.memorymap[page].write = (addr) => {
					switch (addr & 0x0300) {
					case 0x0000:
						if (~addr & 1)
							return;
						if (~addr & 2)
							return sound.write(this.psg.addr, this.psg.latch);
						return void(this.psg.addr = this.psg.latch);
					case 0x0100:
						return void(this.psg.latch = addr);
					}
				};
			else if (range(page, 0x50, 0x53, 0x04)) {
				this.cpu.memorymap[page].base = this.ram.base[4 | page & 3];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0x58, 0x58, 0x07)) {
				this.cpu.memorymap[page].base = this.ram.base[8];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0x60, 0x60, 0x07))
				this.cpu.memorymap[page].read = () => { return this.in[0]; };
			else if (range(page, 0x68, 0x68, 0x07))
				this.cpu.memorymap[page].read = () => { return this.in[1]; };
			else if (range(page, 0x70, 0x70, 0x07)) {
				this.cpu.memorymap[page].read = () => { return this.in[2]; };
				this.cpu.memorymap[page].write = (addr, data) => {
					switch (addr & 7) {
					case 1:
						return void(this.fInterruptEnable = (data & 1) !== 0);
					case 2:
						const _bank = data << 4 & 0x10 | 0x20;
						if (_bank === this.bank)
							return;
						for (let i = 0; i < 0x10; i++) {
							this.cpu.memorymap[0x20 + i].base = PRG.base[_bank + i];
							this.cpu.memorymap[0x30 + i].base = PRG.base[(_bank ^ 0x10) + i];
						}
						return void(this.bank = _bank);
					case 4:
						return void(this.fStarEnable = (data & 1) !== 0);
					}
				};
			}

		// Videoの初期化
		convertGFX(this.bg, BG, 256, rseq(8, 0, 8), seq(8), [0, BG.length * 4], 8);
		convertGFX(this.obj, OBJ, 64, rseq(8, 128, 8).concat(rseq(8, 0, 8)), seq(8).concat(seq(8, 64)), [0, OBJ.length * 4], 32);
		for (let i = 0; i < 0x20; i++)
			this.rgb[i] = 0xff000000 | (RGB[i] >> 6) * 255 / 3 << 16 | (RGB[i] >> 3 & 7) * 255 / 7 << 8 | (RGB[i] & 7) * 255 / 7;
		const starColors = [0xd0, 0x70, 0x40, 0x00];
		for (let i = 0; i < 0x40; i++)
			this.rgb[0x40 | i] = 0xff000000 | starColors[i >> 4 & 3] << 16 | starColors[i >> 2 & 3] << 8 | starColors[i & 3];
		for (let i = 0; i < 1024; i++)
			this.stars.push({x: 0, y: 0, color: 0});
		this.initializeStar();
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.timer.execute(tick_rate, () => { this.moveStars(), update(), this.fInterruptEnable && this.cpu.non_maskable_interrupt(); });
			sound.execute(tick_rate);
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
			switch (this.nLife) {
			case 3:
				this.in[2] &= ~1;
				break;
			case 4:
				this.in[2] |= 1;
				break;
			}
			switch (this.nBonus) {
			case '10000 60000':
				this.in[2] &= ~0x0c;
				break;
			case '20000 60000':
				this.in[2] = this.in[2] & ~0x0c | 4;
				break;
			case '30000 60000':
				this.in[2] = this.in[2] & ~0x0c | 8;
				break;
			case '40000 60000':
				this.in[2] |= 0x0c;
				break;
			}
			if (!this.fTest)
				this.fReset = true;
		}

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu.reset();
			this.fInterruptEnable = false;
		}
		return this;
	}

	updateInput() {
		this.in[0] = this.in[0] & ~(1 << 0) | !!this.fCoin << 0;
		this.in[1] = this.in[1] & ~3 | !!this.fStart1P << 0 | !!this.fStart2P << 1;
		this.fCoin -= !!this.fCoin, this.fStart1P -= !!this.fStart1P, this.fStart2P -= !!this.fStart2P;
		return this;
	}

	coin(fDown) {
		fDown && (this.fCoin = 2);
	}

	start1P(fDown) {
		fDown && (this.fStart1P = 2);
	}

	start2P(fDown) {
		fDown && (this.fStart2P = 2);
	}

	up(fDown) {
		this.in[0] = this.in[0] & ~(1 << 5 | fDown << 6) | fDown << 5;
	}

	right(fDown) {
		this.in[0] = this.in[0] & ~(1 << 3 | fDown << 2) | fDown << 3;
	}

	down(fDown) {
		this.in[0] = this.in[0] & ~(1 << 6 | fDown << 5) | fDown << 6;
	}

	left(fDown) {
		this.in[0] = this.in[0] & ~(1 << 2 | fDown << 3) | fDown << 2;
	}

	triggerA(fDown) {
		this.in[0] = this.in[0] & ~(1 << 4) | fDown << 4;
	}

	initializeStar() {
		let color;

		for (let sr = 0, i = 0, x = 255; x >= 0; --x) {
			for (let y = 0; y < 256; y++) {
				const cy = sr >> 4 ^ ~sr >> 16;
				sr = cy & 1 | sr << 1;
				if ((sr & 0x100ff) === 0xff && (color = sr >> 8 & 0x3f) && color !== 0x3f) {
					this.stars[i].x = x & 0xff;
					this.stars[i].y = y;
					this.stars[i].color = color;
					if (++i >= 1024)
						return;
				}
			}
		}
	}

	moveStars() {
		if (this.fStarEnable && (this.fStarMove = !this.fStarMove))
			for (let i = 0; i < 256 && this.stars[i].color; i++)
				if (++this.stars[i].y >= 0x100) {
					this.stars[i].y &= 0xff;
					this.stars[i].x = this.stars[i].x - 1 & 0xff;
				}
	}

	makeBitmap(flag) {
		if (!(this.updated = flag))
			return this.bitmap;

		// bg描画
		let p = 256 * 32;
		for (let k = 0x7e2, i = 2; i < 32; p += 256 * 8, k += 0x401, i++) {
			let dwScroll = this.ram[0x800 + i * 2];
			for (let j = 0; j < 32; k -= 0x20, j++) {
				this.xfer8x8(this.bitmap, p + dwScroll, k, i);
				dwScroll = dwScroll + 8 & 0xff;
			}
		}

		// obj描画
		for (let k = 0x840, i = 16; i !== 0; k += 4, --i) {
			const x = this.ram[k], y = this.ram[k + 3] + 16;
			const src = this.ram[k + 1] & 0x3f | this.ram[k + 2] << 6;
			switch (this.ram[k + 1] & 0xc0) {
			case 0x00: // ノーマル
				this.xfer16x16(this.bitmap, x | y << 8, src);
				break;
			case 0x40: // V反転
				this.xfer16x16V(this.bitmap, x | y << 8, src);
				break;
			case 0x80: // H反転
				this.xfer16x16H(this.bitmap, x | y << 8, src);
				break;
			case 0xc0: // HV反転
				this.xfer16x16HV(this.bitmap, x | y << 8, src);
				break;
			}
		}

		// bg描画
		p = 256 * 16;
		for (let k = 0x7e0, i = 0; i < 2; p += 256 * 8, k += 0x401, i++) {
			let dwScroll = this.ram[0x800 + i * 2];
			for (let j = 0; j < 32; k -= 0x20, j++) {
				this.xfer8x8(this.bitmap, p + dwScroll, k, i);
				dwScroll = dwScroll + 8 & 0xff;
			}
		}

		// star描画
		if (this.fStarEnable) {
			p = 256 * 16;
			for (let i = 0; i < 256; i++) {
				const px = this.stars[i].color;
				if (!px)
					break;
				const x = this.stars[i].x, y = this.stars[i].y;
				if (x & 1 && ~y & 8 && !(this.bitmap[p + (x | y << 8)] & 3))
					this.bitmap[p + (x | y << 8)] = 0x40 | px;
				else if (~x & 1 && y & 8 && !(this.bitmap[p + (x | y << 8)] & 3))
					this.bitmap[p + (x | y << 8)] = 0x40 | px;
			}
		}

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				this.bitmap[p] = this.rgb[this.bitmap[p]];

		return this.bitmap;
	}

	xfer8x8(data, p, k, i) {
		const q = this.ram[k] << 6, idx = this.ram[0x801 + i * 2] << 2 & 0x1c;

		data[p + 0x000] = idx | this.bg[q | 0x00];
		data[p + 0x001] = idx | this.bg[q | 0x01];
		data[p + 0x002] = idx | this.bg[q | 0x02];
		data[p + 0x003] = idx | this.bg[q | 0x03];
		data[p + 0x004] = idx | this.bg[q | 0x04];
		data[p + 0x005] = idx | this.bg[q | 0x05];
		data[p + 0x006] = idx | this.bg[q | 0x06];
		data[p + 0x007] = idx | this.bg[q | 0x07];
		data[p + 0x100] = idx | this.bg[q | 0x08];
		data[p + 0x101] = idx | this.bg[q | 0x09];
		data[p + 0x102] = idx | this.bg[q | 0x0a];
		data[p + 0x103] = idx | this.bg[q | 0x0b];
		data[p + 0x104] = idx | this.bg[q | 0x0c];
		data[p + 0x105] = idx | this.bg[q | 0x0d];
		data[p + 0x106] = idx | this.bg[q | 0x0e];
		data[p + 0x107] = idx | this.bg[q | 0x0f];
		data[p + 0x200] = idx | this.bg[q | 0x10];
		data[p + 0x201] = idx | this.bg[q | 0x11];
		data[p + 0x202] = idx | this.bg[q | 0x12];
		data[p + 0x203] = idx | this.bg[q | 0x13];
		data[p + 0x204] = idx | this.bg[q | 0x14];
		data[p + 0x205] = idx | this.bg[q | 0x15];
		data[p + 0x206] = idx | this.bg[q | 0x16];
		data[p + 0x207] = idx | this.bg[q | 0x17];
		data[p + 0x300] = idx | this.bg[q | 0x18];
		data[p + 0x301] = idx | this.bg[q | 0x19];
		data[p + 0x302] = idx | this.bg[q | 0x1a];
		data[p + 0x303] = idx | this.bg[q | 0x1b];
		data[p + 0x304] = idx | this.bg[q | 0x1c];
		data[p + 0x305] = idx | this.bg[q | 0x1d];
		data[p + 0x306] = idx | this.bg[q | 0x1e];
		data[p + 0x307] = idx | this.bg[q | 0x1f];
		data[p + 0x400] = idx | this.bg[q | 0x20];
		data[p + 0x401] = idx | this.bg[q | 0x21];
		data[p + 0x402] = idx | this.bg[q | 0x22];
		data[p + 0x403] = idx | this.bg[q | 0x23];
		data[p + 0x404] = idx | this.bg[q | 0x24];
		data[p + 0x405] = idx | this.bg[q | 0x25];
		data[p + 0x406] = idx | this.bg[q | 0x26];
		data[p + 0x407] = idx | this.bg[q | 0x27];
		data[p + 0x500] = idx | this.bg[q | 0x28];
		data[p + 0x501] = idx | this.bg[q | 0x29];
		data[p + 0x502] = idx | this.bg[q | 0x2a];
		data[p + 0x503] = idx | this.bg[q | 0x2b];
		data[p + 0x504] = idx | this.bg[q | 0x2c];
		data[p + 0x505] = idx | this.bg[q | 0x2d];
		data[p + 0x506] = idx | this.bg[q | 0x2e];
		data[p + 0x507] = idx | this.bg[q | 0x2f];
		data[p + 0x600] = idx | this.bg[q | 0x30];
		data[p + 0x601] = idx | this.bg[q | 0x31];
		data[p + 0x602] = idx | this.bg[q | 0x32];
		data[p + 0x603] = idx | this.bg[q | 0x33];
		data[p + 0x604] = idx | this.bg[q | 0x34];
		data[p + 0x605] = idx | this.bg[q | 0x35];
		data[p + 0x606] = idx | this.bg[q | 0x36];
		data[p + 0x607] = idx | this.bg[q | 0x37];
		data[p + 0x700] = idx | this.bg[q | 0x38];
		data[p + 0x701] = idx | this.bg[q | 0x39];
		data[p + 0x702] = idx | this.bg[q | 0x3a];
		data[p + 0x703] = idx | this.bg[q | 0x3b];
		data[p + 0x704] = idx | this.bg[q | 0x3c];
		data[p + 0x705] = idx | this.bg[q | 0x3d];
		data[p + 0x706] = idx | this.bg[q | 0x3e];
		data[p + 0x707] = idx | this.bg[q | 0x3f];
	}

	xfer16x16(data, dst, src) {
		const idx = src >> 4 & 0x1c;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		src = src << 8 & 0x3f00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[src++]))
					data[dst] = idx | px;
	}

	xfer16x16V(data, dst, src) {
		const idx = src >> 4 & 0x1c;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		src = (src << 8 & 0x3f00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[src++]))
					data[dst] = idx | px;
	}

	xfer16x16H(data, dst, src) {
		const idx = src >> 4 & 0x1c;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		src = (src << 8 & 0x3f00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[--src]))
					data[dst] = idx | px;
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >> 4 & 0x1c;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		src = (src << 8 & 0x3f00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[--src]))
					data[dst] = idx | px;
	}
}

/*
 *
 *	Zig Zag
 *
 */

import {ROM} from "./dist/zigzag.png.js";
let BG, OBJ, RGB, PRG;

window.addEventListener('load', () => expand(ROM).then(ROM => {
	PRG = new Uint8Array(ROM.buffer, 0x0, 0x4000).addBase();
	BG = new Uint8Array(ROM.buffer, 0x4000, 0x1000);
	OBJ = new Uint8Array(ROM.buffer, 0x5000, 0x1000);
	RGB = new Uint8Array(ROM.buffer, 0x6000, 0x20);
	game = new ZigZag();
	sound = new AY_3_8910({clock: Math.floor(18432000 / 6)});
	canvas.addEventListener('click', () => game.coin(true));
	init({game, sound});
}));

