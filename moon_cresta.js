/*
 *
 *	Moon Cresta
 *
 */

import GalaxianSound from './galaxian_sound.js';
import SoundEffect from './sound_effect.js';
import {init, read} from './main.js';
import Z80 from './z80.js';
let game, sound;

class MoonCresta {
	static decoded = false;

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
	nBonus = 30000;

	fInterruptEnable = false;
	fSoundEnable = false;

	ram = new Uint8Array(0x900).addBase();
	mmo = new Uint8Array(0x100);
	in = new Uint8Array(3);

	stars = [];
	fStarEnable = false;
	fStarMove = false;
	bank = 0;
	bg = new Uint8Array(0x8000);
	obj = new Uint8Array(0x8000);
	rgb = new Uint32Array(0x80);

	se = [BOMB, SHOT].map(buf => ({buf, loop: false, start: false, stop: false}));

	cpu = new Z80();

	constructor() {
		// CPU周りの初期化
		const range = (page, start, end, mirror = 0) => (page & ~mirror) >= start && (page & ~mirror) <= end;

		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0x3f))
				this.cpu.memorymap[page].base = PRG.base[page & 0x3f];
			else if (range(page, 0x80, 0x83, 0x04)) {
				this.cpu.memorymap[page].base = this.ram.base[page & 3];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0x90, 0x93, 0x04)) {
				this.cpu.memorymap[page].base = this.ram.base[4 | page & 3];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0x98, 0x98, 0x07)) {
				this.cpu.memorymap[page].base = this.ram.base[8];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0xa0, 0xa0, 0x07)) {
				this.cpu.memorymap[page].read = () => { return this.in[0]; };
				this.cpu.memorymap[page].write = (addr, data) => { this.mmo[addr & 7] = data & 1, this.bank = this.mmo[0] | this.mmo[1] << 1; };
			} else if (range(page, 0xa8, 0xa8, 0x07)) {
				this.cpu.memorymap[page].read = () => { return this.in[1]; };
				this.cpu.memorymap[page].write = (addr, data) => {
					switch (addr & 7) {
					case 3: // BOMB
						data & 1 ? (this.se[0].start = true) : (this.se[0].stop = true);
						break;
					case 5: // SHOT
						data & 1 && !this.mmo[0x15] && (this.se[1].start = this.se[1].stop = true);
						break;
					}
					this.mmo[addr & 7 | 0x10] = data & 1;
				};
			} else if (range(page, 0xb0, 0xb0, 0x07)) {
				this.cpu.memorymap[page].read = () => { return this.in[2]; };
				this.cpu.memorymap[page].write = (addr, data) => {
					switch (addr & 7) {
					case 0:
						this.fInterruptEnable = (data & 1) !== 0;
						break;
					case 4:
						!this.fSoundEnable && (this.mmo[0x30] = 0xff), this.fStarEnable = this.fSoundEnable = (data & 1) !== 0;
						break;
					}
					this.mmo[addr & 7 | 0x20] = data & 1;
				};
			} else if (range(page, 0xb8, 0xb8, 0x07))
				this.cpu.memorymap[page].write = (addr, data) => { this.mmo[0x30] = data; };

		MoonCresta.decodeROM();

		// Videoの初期化
		for (let i = 0; i < 1024; i++)
			this.stars.push({x: 0, y: 0, color: 0});
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();
		this.initializeStar();
	}

	execute() {
		sound[0].mute(!this.fSoundEnable);
		this.fInterruptEnable && this.cpu.non_maskable_interrupt(), this.cpu.execute(0x2000);
		this.moveStars();
		return this;
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// DIPスイッチの更新
		if (this.fDIPSwitchChanged) {
			this.fDIPSwitchChanged = false;
			switch (this.nBonus) {
			case 30000:
				this.in[1] &= ~0x40;
				break;
			case 50000:
				this.in[1] |= 0x40;
				break;
			}
			if (!this.fTest)
				this.fReset = true;
		}

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.fSoundEnable = false;
			this.se.forEach(se => se.stop = true);
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

	coin() {
		this.fCoin = 2;
	}

	start1P() {
		this.fStart1P = 2;
	}

	start2P() {
		this.fStart2P = 2;
	}

	right(fDown) {
		this.in[0] = this.in[0] & ~(1 << 3 | fDown << 2) | fDown << 3;
	}

	left(fDown) {
		this.in[0] = this.in[0] & ~(1 << 2 | fDown << 3) | fDown << 2;
	}

	triggerA(fDown) {
		this.in[0] = this.in[0] & ~(1 << 4) | fDown << 4;
	}

	convertRGB() {
		for (let i = 0; i < 0x20; i++)
			this.rgb[i] = (RGB[i] & 7) * 255 / 7	// Red
				| (RGB[i] >> 3 & 7) * 255 / 7 << 8	// Green
				| (RGB[i] >> 6) * 255 / 3 << 16		// Blue
				| 0xff000000;						// Alpha
		const starColors = [0xd0, 0x70, 0x40, 0x00];
		for (let i = 0; i < 0x40; i++)
			this.rgb[0x40 | i] = starColors[i & 3]	// Red
				| starColors[i >> 2 & 3] << 8		// Green
				| starColors[i >> 4 & 3] << 16		// Blue
				| 0xff000000;						// Alpha
	}

	convertBG() {
		for (let p = 0, q = 0, i = 512; i !== 0; q += 8, --i)
			for (let j = 7; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k + 0x1000] >> j & 1 | BG[q + k] >> j << 1 & 2;
	}

	convertOBJ() {
		for (let p = 0, q = 0, i = 128; i !== 0; q += 32, --i) {
			for (let j = 7; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = BG[q + k + 0x1000 + 16] >> j & 1 | BG[q + k + 16] >> j << 1 & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = BG[q + k + 0x1000] >> j & 1 | BG[q + k] >> j << 1 & 2;
			}
			for (let j = 7; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = BG[q + k + 0x1000 + 24] >> j & 1 | BG[q + k + 24] >> j << 1 & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = BG[q + k + 0x1000 + 8] >> j & 1 | BG[q + k + 8] >> j << 1 & 2;
			}
		}
	}

	static decodeROM() {
		if (MoonCresta.decoded)
			return;
		for (let i = 0; i < PRG.length; i++) {
			PRG[i] ^= PRG[i] << 5 & 0x40;
			PRG[i] ^= PRG[i] >> 3 & 4;
			if (~i & 1)
				PRG[i] = PRG[i] & 0xbb | PRG[i] << 4 & 0x40 | PRG[i] >> 4 & 4;
		}
		MoonCresta.decoded = true;
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

	makeBitmap(data) {
		// bg描画
		let p = 256 * 32;
		for (let k = 0x7e2, i = 2; i < 32; p += 256 * 8, k += 0x401, i++) {
			let dwScroll = this.ram[0x800 + i * 2];
			for (let j = 0; j < 32; k -= 0x20, j++) {
				this.xfer8x8(data, p + dwScroll, k, i);
				dwScroll = dwScroll + 8 & 0xff;
			}
		}

		// obj描画
		for (let k = 0x840, i = 8; i !== 0; k += 4, --i) {
			const x = this.ram[k], y = this.ram[k + 3] + 16;
			const src = this.ram[k + 1] & 0x3f | this.ram[k + 2] << 6;
			switch (this.ram[k + 1] & 0xc0) {
			case 0x00: // ノーマル
				this.xfer16x16(data, x | y << 8, src);
				break;
			case 0x40: // V反転
				this.xfer16x16V(data, x | y << 8, src);
				break;
			case 0x80: // H反転
				this.xfer16x16H(data, x | y << 8, src);
				break;
			case 0xc0: // HV反転
				this.xfer16x16HV(data, x | y << 8, src);
				break;
			}
		}

		// bullets描画
		for (let k = 0x860, i = 0; i < 8; k += 4, i++) {
			p = this.ram[k + 1] | 267 - this.ram[k + 3] << 8;
			data[p + 0x300] = data[p + 0x200] = data[p + 0x100] = data[p] = i > 6 ? 7 : 3;
		}

		// bg描画
		p = 256 * 16;
		for (let k = 0x7e0, i = 0; i < 2; p += 256 * 8, k += 0x401, i++) {
			let dwScroll = this.ram[0x800 + i * 2];
			for (let j = 0; j < 32; k -= 0x20, j++) {
				this.xfer8x8(data, p + dwScroll, k, i);
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
				if (x & 1 && ~y & 8 && !(data[p + (x | y << 8)] & 3))
					data[p + (x | y << 8)] = 0x40 | px;
				else if (~x & 1 && y & 8 && !(data[p + (x | y << 8)] & 3))
					data[p + (x | y << 8)] = 0x40 | px;
			}
		}

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] = this.rgb[data[p]];
	}

	xfer8x8(data, p, k, i) {
		let q = this.ram[k] << 6, idx = this.ram[0x801 + i * 2] << 2 & 0x1c;

		if (this.mmo[2] && (this.ram[k] & 0xc0) === 0x80)
			q = (this.ram[k] & 0x3f | this.bank << 6 | 0x100) << 6 & 0x7ffc0;
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
		if (this.mmo[2] && (src & 0x30) === 0x20)
			src = src << 8 & 0x0f00 | this.bank << 12 | 0x4000;
		else
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
		if (this.mmo[2] && (src & 0x30) === 0x20)
			src = (src << 8 & 0x0f00 | this.bank << 12 | 0x4000) + 256 - 16;
		else
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
		if (this.mmo[2] && (src & 0x30) === 0x20)
			src = (src << 8 & 0x0f00 | this.bank << 12 | 0x4000) + 16;
		else
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
		if (this.mmo[2] && (src & 0x30) === 0x20)
			src = (src << 8 & 0x0f00 | this.bank << 12 | 0x4000) + 256;
		else
			src = (src << 8 & 0x3f00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[--src]))
					data[dst] = idx | px;
	}
}

/*
 *
 *	Moon Cresta
 *
 */

const SND = new Uint8Array(window.atob('\
9/n6+/z9/f7+/v39/Pv6+ff19PPy8fHw8PDx8fLz9PX39/j4+fn6+vv7/Pz9/f7+//8AAAEBAgIDAwQEBQUGBg==\
').split('').map(c => c.charCodeAt(0)));

const BOMB = new Int16Array(new Uint8Array(window.atob('\
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\
EAD3/wQA/f8BAP//AAAAAP7/AgD7/wgA7/+/ABAB9wAEAf0AAQF+AQAB/wAAAf8AAQH+AAUBVwCk/wz/vf75/dL93Pwm/SX8OfwO/Qj9Q/z0+/v7u/wV/ff8\
Bv19/QL9AP0B/QH9/vwE/fr8C/3r/Mn9AP64/hT/9/4C/wP/9P66/xkA5/9EAA8B9gAIAfUAEgG/APD/BwD8/wAAAgD6/w0ARf/n/hn/u/7y/Qb+/f0B/gH+\
+/0J/u39Q/4M/wD/9P48/xQA8/8LAPL/FwC3//3+7/5M/1P/5f4O//j+BP///v7+BP/4/hH/wP7v/Qn++v0F/vv9Bv7z/bj+IP+6/u/9Dv7s/cL+EP/4/gT/\
/v4A/4L+/P4H//P+Gf+v/jD+F//1/gP/BP/x/j7/EQD3/wQA/f8BAP////8BAP3/BAD6/w0Axv/l/hz/Nf7+/U/92/zK/Qz++f0I/vb9Ev5A/fD8Cf37/AT9\
/fwF/fn8C/3r/En9AP44/hb/9f4H//z+A//9/gP//P4G//L+O/8ZAOb/xgALAf4A+wAPAb8A8v8BAAgA6f9PAFIA5f8OAPX/CgDy/xYAOP/8/u/+TP9U/+T+\
D//1/gn/9f4S/0D+7/0J/vn9Bv75/Qn+7/1A/hD/+f4C/wH/+/4L/+n+z//U/+D+PP8pACH/Rv/S/+/+1/7a/Sb+qf0x/Rr+7v0T/kX93/zK/Qj+A/7y/b7+\
Ev/3/gX//f4C/3//AP8B//7+A//7/gj/7/5A/xAA+f8CAAIA+f8QAMD/7/4I//v+A////gD/Af/9/gX/9v4T/zz+9/35/bj+GP/u/hb/Pf7x/Qj+/P0C/v/9\
//0C/vv9CP7v/UD+Ev/1/gn/9v4P/+b+0f/Q/+j+C//9/v3+C//o/lD/0f/m/g7/9v4H//j+DP9J/tz9zf4E/wv/w/7u/Qj+/f3+/Qf+7v3C/gz/AP/0/rz/\
FADz/wsA8/8VALr/+P73/jv/EgD3/wMAAQD7/w0Axv/k/h3/M/7//e39Tf7T/mb+jP77/f/9CP7u/UT+Cf8I/0b+6/0N/vb9C/7u/T/+E//y/g//6v7G/wgA\
CQDF/+z+Cv/4/gb/+f4J/+3+wv8MAP//9/+X/7D/MP8XAPj//v8PAL7/9f77/hT/Mv4u/hn/9f4D/wP/9v4X/7H+rf4c/+3+E//E/uH9x/4M//r+A//+/gH/\
//4A/wH///4C//3+Bf/0/rf/IQC3//T+Bf/9/gL///4B///+Af/+/gP/+v4M/0j+3v3I/gz/+v4F//v+B//2/hP/Pf70/QD+Df5B/fD8Bf0B/fX8uv0a/ub9\
Rf4O//n+BP/+/gL///4A/wD///4B//7+A//7/gf/8f49/xUA7/8VAD7/7/4K//f+Cv/x/hr/r/6v/hr/8f4K//b+C//s/sP/DAAAAPT/PAAUAfQACgH0ABIB\
vgDx/wUAAAD5/xAAPv/z/oD+jP5D/u39Cf77/QH+Af78/Qj+8P0//hP/9f4K//T+FP+9/vP9A/4H/kz92/xM/Qb+B/7M/d38Sv0M/vv9A/7//QD+Av78/Qf+\
8v27/hn/5/7F/w0A+/8BAAIA+f8QAMD/7/4I//v+A//+/gH///4A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP///gH//v4C//z+Bv/y/rv/GQDm/8QADgH4AAUB\
+gAGAfYAEQFAAO7/CQD4/wcA9v8RAD//8P4G//7+/f4I/+3+w/8KAAYASf/m/hj/QP7q/Rn+uf32/P/8C/3G/On7Evzq+8P8EP34/Ib9/PwF/fv8Cf3w/ED9\
Ev72/Qj+9/0N/un9yf7+/rr/EAD9//X/PQARAfkAAAEEAfQAGAEvAK4AGAHyAAcB+wACAf4A/wABAfwABgH0ABYBNgACAEX/8f7//hH/OP4D/kH9+/zM/On7\
DPz6+wT8//sB/AH8//sE/Pv7Cvzu+8P8Df0A/XX9PP0W/vL9D/7r/cT+C/8A//T+Pf8SAPf/BAD+/wAAAQD7/wgA7/+/ABAB9wAEAf0AAQH+AAAB/wAAAf4A\
AQH8AAcBUgAs//z++/4P/0H+7v0J/vv9A/7+/QH+AP4A/gL+/v0F/vj9Ef5A/fD8Cf37/AT9/fwE/fv8Cf3u/MP9DP4A/vT9Pf4T//f+Bf/9/gL/f/8A/wD/\
AP///gH//f4E//j+Df/n/hn/8/4H//v+Av///gD/Af/+/gP/+v4L/8n+3P1L/gf/A//y/r7/EgD3/wUA/f8BAP//AAAAAAAAAAAAAAAA//8BAP3/BAD3/xEA\
v//x/gb///78/gz/Rv7l/Rv+OP34/Pv8NP0k/jf98/wI/fn8Cf3x/Lz9Gf7n/UX+Dv/5/gT//v4C///+AP8B//7+A//7/gj/7/7A/xAA+f+CAAEA+v8OAMP/\
6v4Q/+r+wf8RAPT/DADv/xwAK/+1/xAABQBF/2//Av8L/0P+7f0J/vv9A/7+/QL+/v0C/vz9B/7y/Tv+Gv/l/kj/iP8DAPH/wgALAQUBSgDj/xwAN//2/v/+\
C/9F/uj9Ef7q/UP+D//4/gT//f4C///+AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP+A/v/+Av/9/gX/9/4S/z7+8v0D/gP+8v2+/hP/9P4K//b+Ev/B/u79\
DP72/Q/+R/3f/Ej9DP77/QP+/v0C/v79A/78/Qf+8v07/hn/5/7E/w8A+P8GAPr/BwDy/zkAHwE8AOz/EwDi/9UASwDv/wAAEAC1/yr/n//o/xsAN//5/vr+\
Ff8y/q3+Gf/z/gb//v79/gf/7/7B/w4A/f/8/w8Av//y/gL/Cf9I/uH9wf4c/7r+8v0G/vz9Av7//QH+AP4A/gD+AP4A/gD+AP4A/gD+AP4A/gH+AP4C/v39\
Bv72/RP+PP32/Pr8tv0c/uX9Rv4O//n+BP/+/gD/Av/7/gn/7f5C/wwAAAD0/zwAFAH0AAoB9AASAT8A8P8HAPz/AAADAPj/EAC///H+Bv///vz+DP9G/ub9\
Gf68/fD8Cv33/Av97vxB/RD++f0D/gD+/f0I/vD9wP4R//j+Bf/9/gL///4A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD///4B//3+Bf/2/hD/\
4f5b/z3/K/8VAAEAx//s/gf/Af/0/rv/FgDv/xUAvf/w/gj/+v4F//n+Cf/u/kH/DQD9//v/EAC9//b++f64/xgA7f8WAL3/8f4H//z+Av8A//7+BP/5/g7/\
Rf7n/Rn+u/3y/Af9/PwD/f78Av3+/AP9/PwH/fL8PP0Y/ur9wP4W/+j+xf8OAPv/AQACAPr/jv/D/+r+EP/p/sT/DAD8//3/CQDq/80A1gDd/x8Atf/4/v3+\
Df9C/u39Cf76/QT+/f0E/vv9CP7v/UD+Ef/4/gX//f4D//3+BP/6/gz/yP7g/cb+EP/z/hL/Qf7r/RD+6/1D/g//+P4E/33+Av///gD/AP8A/wD/AP8A/wD/\
AP8A/wD/AP9//wH///4C//3+Bf/0/rf/IQC3//X+A/8B//v+C//p/s3/Vv/e/h//t/72/QL+BP7z/Tz+Fv/v/hb/vP70/QP+Bf7y/R3+Jv3D/dX96/z//Lj9\
Ff74/QH+Bf7y/b7+E//z/gv/7/69/xcA6f/CABIB8QAUAT0A8P8HAPv/AwD9/wIA/P8EAPf/EADA/+/+CP/7/gP//v4B///+AP8A///+Af/+/gP/+v4K/+3+\
xP8KAAYAyv/k/hv/uv7y/Qb+/f0B/gH+/P0H/vD9vv4V//D+Ef/l/lD/1P9g/xr/4P7U/9H/4/4V/+r+IP+o/rz+Zf4q/e78P/0S/vf9Bv77/Qf+dv2U/bv9\
+Pz3/Lz9Ev76/f/9CP7s/cj+AP83/xUA9f8GAPz/AgD//wAAAAD+/wMA+v8JAOz/RAAIAQgBxADs/wkA+v8CAAAA/v8EAPf/EABA/+/+B//9/gD/Av/6/g//\
Q/7r/RL+Sf3Y/Fn9y/3u/AT9B/3p/FL9zv3v/P38OP0W/vT9CP75/Qn+8f08/hv/w/7d/VL+VP7b/cb+E//p/sX/CQACAPD/QgAKAQcBRQDs/wkA+v8DAP3/\
AgD8/wQA9/8QAED/7/4I//v+A//+/gH//v4C//3+Bv/z/rn/HwC9/+v+GP+6/vb9/v0O/sH98PwE/QP98/w8/Rb+7/0T/uP9Vf5M/u79//2z/h3/5P5G/w0A\
+f8EAP3/AQD//wAAAAAAAAAAAAAAAP//AQD9/wQA9/8QAMD/7/4J//r+BP/7/gX/9/4R/8D+7/0I/vv9A/7+/QH+AP4A/gD+AP4A/gD+AP4B/v79A/77/Qj+\
7/1A/hD/+P4D/wD//f4H/+/+wP8QAPj/BAD/////BAD4/xAAQP/v/gn/+v4E//z+Bf/5/g7/Rf7m/Rr+Ov31/AL9BP3y/D79E/72/Qj++f0K/u/9Qf4Q/3j+\
A/8A//3+B//v/sD/EAD3/wQA/v8AAAEA/P8GAPL/ugAdAb8A5P/CABIB8AAWAbsA9f///wsARP/q/g7/8v4T/z/+7/0K/vj9CP7y/bj+Iv+2/vf9Af4F/vH9\
P/4S//f+Bf/9/gL///4A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP///gH//v4D//v+CP/v/kD/EAD3/wQA/f8BAP//AAAAAAAA//8CAPz/BgD1/xUAN/8A/8j+\
6/0J/v39/v0K/sn93vxJ/Qz++/0D/v79Af4A/gD+Av7+/QX++P0R/kH97vwL/Xf9C/3u/D/9E/7z/Q3+7f1C/hD/+P4F//v+BP/7/gb/8v45/xsA4v9MAP4A\
NgEZAuwBFwK8AfAABwH7AAEB/wD9AAQB9wARAT8A8f8EAAIA9/8VADX/Bf8//v79x/3x/P78FP0x/DH8Ff3+/FH82fvO/Ab9BP3x/MH9Df4A/vX9vf4T//f+\
Bf/9/gL///4A///+Af///gL//f4F//X+tv8jALT/+f75/rT/JAA2//b+Av8C//r+EP9B/u79Cf75/Qb++f0J/u/9QP4R//j+Bf/9/gH/AP///gP/+/4I/+/+\
QP8QAPf/BgD6/4b/9/8NAOb/UABQAOf/DAD6/wEAAgD4/xAAwP/v/gj/+/4B/wH//P4H//P+Gf+v/i/+Gf/z/gb//v79/gf/7/5B/w4A/P/8/w4Awv/u/gr/\
+P4I//X+E/8+/vL9A/6H/Uv93PxK/Qr+/f3+/Qb+8P2//hH/+P4F//3+Av8A/wD/Av/9/gX/9/6S/j7+8v0D/gP+cv6//hH/+f4C/wL/+f4Q/8H+7/0I/vv9\
A/7+/QL+/v0D/vv9iP7v/UD+Ef/4/gT//v7//gT/+P4O/+X+U/9M/+7+/v40/x0A6P8fAKv/sv8VAPj///8MAEL/7v4J//v+A//9/gP/+/4H//P+Gf+w/q3+\
HP/u/hD/6v5D/w8A+v8BAAQA9v8VADj/AP/I/ur9C/75/QT+/v0B/gD+AP4A/gH+/v0F/vn9Df7n/VH+Uf7n/Q3++P0F/vz9BP77/Qj+7/1A/hH/9/4G//v+\
Bf/2/q//UACIAPwAAQH+AAEB/gABAf0AAwH5AA0BRADm/xkAO//y/gb//P4B/wD//v4F//f+E/89/vT9AP4M/kP97fwK/fn8Bf36/Aj98vw7/Rn+5/1F/g7/\
+f4E//7+Av///gD/AP8A///+Af/+/gP/+/4I/+/+wP8QAPf/BAD9/wEAAQD9/wUA9/8SAD3/9P4A/wv/RP7r/Q7+8/0S/kH96/wQ/ev8Q/0P/vn9Bf79/QL+\
/v0C/v39Bv7z/Tf+Q/8hAKv/Mf8YAPP/h//8/wIA/v8AAAAAAAAAAP//AQD9/wQA9/8SAD3/8/4A/wj/6f7P/1H/5/4L//3+/f4L/+f+0v/N/+z+BP8L/8H+\
8v3+/TL+Jf80/vj9AP4F/vH9P/4S//f+Bf/9/gL///4A/wD/AP///gL//f4F//f+E/89/vT9AP4M/kP97vwJ/fz8Af0B/fz8CP3w/MD9Ev72/Qj++f0K/u/9\
v/4T//P+Df/s/kH/EAD4/wQA/f8BAP//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//8BAP3/BAD5/w4Axf/m/hr/uf71/QL+A/7z/bz+Fv/v/hb/\
Pf7x/Qf+/P0C/gD+/v0F/vX9Nv4k/zT++/33/bj+HP/l/kf/CwD///r/EQA9//b+/P4T/zT+Kf4h/+X+If+q/rL+Fv/2/gP/BP/y/j7/EwD1/woA9P8UADz/\
9P4A/wv/Q/7s/Qz+9v0L/u39Qf4Q//j+Bf/9/gP//f4E//v+C/9K/tz9Tf4E/wv/w/7t/Qr++f0G/vn9Cf7v/UD+Ef/4/gX//f4C///+AP8A/wD/AP8A/wD/\
AP8A/wD/AP8A/wD/AP8A/wD/AP8A///+Af/+/gP/+/4H//H+Pf8VAPD/FABA/+z+EP/r/kL/EAD1/wkA9f8RAMH/6/4Q/+7+HP+u/i/+Gv/w/gz/8/4T/z/+\
8P0I/vv9BP79/QT++/0I/u/9Qf4Q//r+AP8F//P+HP+q/jj+Bv82/xMA///P/9r+Sv8LAPr/AwD+/wEA//8AAAAAAAD//wEA/f8EAPn/DgBF/+f+Gf+8/vH9\
CP76/Qb++f0N/sj93vzJ/Qr+/f3+/Qb+8P1A/hD/+v4A/wX/8f4//xEA9/8EAP3/AQABAP3/BAD3/xAAQP/v/gj/+/4D//3+Av/9/gX/+P4R/z/+8f0G/gD+\
+/0P/kH97/wJ/fz8A/3//AH9AP0B/f/8A/38/Aj98Py//RT+8/0N/u39QP4T//P+Df/t/kD/EgDz/w0A7P9BAA8B9wAEAf0AAQH+AAAB/wD/AP8A/wD/AP8A\
AAH+AAEB/QAFAfYAEgG9APP/AgAIAMn/4/4e/zT+AP5M/eP8HP25/PT7Bfz/+//7Bvzz+7v8Gv3n/EX9D/76/QX+/v0C/gD+Af4A/gD+Af7+/QP++/0I/u/9\
wP4Q//j+A/8A//3+B//v/j//kf/2/wcA+P8JAO7/QAARAfYABgH6AAYB9gARAT8A7/8IAPr/BAD7/wUA9/8QAMD/7/4J//r+BP/8/gX/+f4O/0b+5v0b/rj9\
+Pz7/LT9JP43/fP8CP34/Av97vxB/RH++P0F/v79Av7//QH+/v0D/vv9Cf7t/cP+DP8A//T+vf8SAPf/BAD///7/BQDy/zoAHAG/AOP/RQANAfkAAwH9AAEB\
/gABAf0AAwH5AA0BRQDm/xoAOf/2/gD/Cv/G/uf9F/5B/ej8G/03/Pr79vs8/BT99vwH/fz8Bf36/Ar97vxD/Qz+Af7y/cD+Dv///vT+vf8SAPf/BQB9/wEA\
//8AAAAAAAAAAAAAAAAAAAAA//8BAP3/BQD3/xMAvP/2/v3+EP87/v39y/3n/BD97vw6/SP+NP38/PX8vf0T/vb9B/77/QX++/0J/u/9QP4Q//j+A/8A//v+\
Cv/r/sf/AwAQADT/q/8cAO7/DQDx/xYAOf/5/vT+QP8JAAkAwP/0/vn+uf8VAPP/CgD0/xIAQP/u/gv/9f4O/+j+yv8AABUAq/89/1v/4P4S//T+Cv/1/hL/\
v/7w/Qf+/v3+/Qb+8v29/hX/8f4T/8L+6P0X/t/9Wf5D/iD+Lf+y/vX9Cf7y/bn+IP85/vL9Cf73/Q3+6v1I/gP/Ev+y/rD+Ff/7/vX+Pv8NAAIATf/b/sr/\
CwD6/wMA/v8BAP7/AgD9/wUA9v8TALv/9v77/hT/sv6t/hv/7/4M//P+E/8//vD9CP77/QP+/v0A/gD+/v0D/vv9CP7v/cD+Ef/4/gX//f4C//3+A//7/gj/\
7/4//xIA9f8JAPX/EgBA/+/+Cv/4/gn/8/4X/7X+gf7o/Vn+Ov62/l7+4P0R/vj9Av4E/vP9PP4a/8b+2f1b/kb+9/3x/Uz+0f7r/QD+s/4d/+T+Rv8OAPj/\
BgD7/wYA9/8PAEL/6v6Q/+r+wv8PAPj/BAD9/wEA/////wEA/f8EAPf/EQA///H+Bf8A//r+D/9B/u/9CP77/QP+/v0B/gD+AP4A/gD+AP4A/gD+AP4A/gD+\
AP4A/gD+Af7+/QP++/0I/u/9wP4R//j+Bf/9/gL//f4D//v+CP/v/r//EgD1/wkA9P8TAD3/9P4A/wj/6f7P/1H/5v4N//j+BP/9/gH///4B///+Av/9/gX/\
9P43/yEAN//0/gX//f4C///+Af///gL//f4F//j+EP9B/u39C/73/Qr+7/0+/hX/b/4W/z3+8v0F/gD++/0M/uj9UP5S/uX9EP70/Q3+7f3B/hD/+P4F//7+\
Af8B//3+Bf/2/hP/O/73/ff9O/4T//f+BP///v7+Bf/0/rf/IQA3//T+Bf/9/gL///4B///+AP///gL//f4F//j+EP/B/u39jf70/RD+5f1S/tD+6P0M/vv9\
//0H/u/9wv4M/wD/9P49/xIA9/8FAP3/AQD//wAAAAAAAAAAAAAAAP//AQD9/wQA+f8OAMX/5/4Z/zv+8v0H/vz9Av7+/QL+/f0F/vf9Ef7h/Vv+Pf4s/hb/\
AP/K/uj9Dv71/Qz+7f3B/hD/+P4F//3+Av///gD/AP8A/wD/AP8A/wD///4B//7+A//6/or/7P5F/wgACABF/+z+Cv/6/gP//v4B///+AP8A///+Av/9/gX/\
+P4R/0D+7/0J/vn9Bv75/Qn+7/2//hP/8/4M//D+G/8u/rD+Gf/0/gX/AP/7/gz/5/5R/1H/5/4O//f+B//5/gn/8v4Z/y/+sP4Y//X+A/8D//X+GP+w/i/+\
Gf/z/gf/+/4C///+//6C/vv+B//z/hj/sf6s/h7/6v4Z/zr+9P0C/gT+8v0+/hL/9/4F//z+BP/8/gb/9P63/yEAN//0/gX//f4C//7+Af/+/gP/+/4I/+/+\
wP8RAPf/BgD6/wYA9/8QAMH/7P4O//H+Ff87/vX9/P2z/iT/N/7z/Qj+9/0M/uv9Rv4I/wn/Q/7v/YX+BP7w/cP+Cv8E/+z+Tv/S/+b+Dv/4/gT//f4B///+\
AP8A///+Af/+/gP/+/4I/+/+wP8QAPf/BAD9/wEA//8BAP//AQD9/wQA9/8RAL//8f4F/wD/+v4P/0H+7/0I/v39AP4D/vj9Ef6//fL8A/0F/fD8Q/0K/gX+\
7P1O/tP+5f0R/vP9Df7r/cT+C/8A//T+PP8UAPT/CgD0/xMAvf/0/gD/CP/p/k//Uf/n/gv/+/7//gb/8P6//xAA+P8EAP////8EAPj/EADA/+/+Cf/6/gT/\
+/4G//b+E/+9/vT9AP4M/sT97PwM/fb8DP3s/MT9DP4A/vT9Pf4T//f+Bf/9/gL///4A/wD///6B/v7+A//7/gf/8f69/xUA7/8VAD3/8f4H//3+AP8D//j+\
EP9A/vD9B/7+/f79B/7w/UD+EP/4/gP/AP/9/gf/7/7A/xEA9/8GAPv/BAD5/wwASP/e/sj/DAD6/wMA/v8BAP//AAAAAP//AQD9/wQA+f8OAMX/5/4Z/zv+\
8v0H/vz9A/7+/QP+/f0F/vn9D/5D/er8Ev3p/Eb9Cv4B/vT9Pf4T//X+CP/4/gr/7v7A/xAA9/8EAP3/AQD//wAAAAAAAAAAAAD//wIA/P8GAPX/FQA3/wD/\
yP7q/Qv++f0E/v79Af4A/gD+AP4A/gD+AP4A/gH+/v0D/vv9CP7v/UD+Ef/4/gX//f4C///+AP8B//7+A//7/gf/8f49/xYA7v8XALr/9v77/rP/JAA2//T+\
B//6/gb/9/6Q/sL+6v0R/ur9w/4P//j+BP/9/gL///4A/wD/AP8A/wD/AP8A/wD/AP///gP/+/4J//D+Hv8n/j7+XP7d/Rj+5v3F/g7/+f4E//7+AP8C//v+\
CP/v/kD/EAD5/wIAAgD4/xIAPv/0/v/+Df/B/vD9BP4D/vL9vv4T//T+Cv/0/hP/Pv7y/QP+A/7x/b/+EP/6/gD/Bf/x/r//EQD4/wQA/////wQA9/+S/z7/\
8/4C/wn/yP7i/b/+IP+1/vz98/1B/gv/Bv9I/uf9Ev7q/cP+Ef/2/gn/9v4R/8L+6/2Q/uv9wf4S//P+Dv/q/sb/CAAJAMX/7P4K//r+A//+/gH///7//gH/\
/f4E//j+Df/n/lD/Uv/k/hL/8P4V/73+8f0G/v79/v0H/vD9wP4R//f+Bf/8/gT//P4F//X+tv8jADT/+f75/jT/IwA3//T+B//6/gf/9v4S/8D+7/0I/vv9\
BP78/Qb+9v0Q/uL92v4+/qn+Gf/4/vj+u/8TAPb/BQD9/wEAAQD9/wQA9/+Q/0D/7/4I//v+Av8A//7+BP/5/g7/RP5o/hb+4v1U/k/+6P0N/vj9Bf78/QX+\
+v0K/u39xf4J/wn/Rf7t/Qr++/0D/v79Af7//QH+/v0D/vv9Cf7t/UP+DP8A//T+vf8SAPf/BQD9/wEA//8AAAAAAAAAAP//AQB9/wQA9/8QAMD/7v4K//j+\
B//2/hL/wP7v/Qj++/0E/v39BP76/Qn+7f3D/gz/AP/0/j7/EgD4/wIAAwD3/xQAuf/8/u/+zP/T/+X+Dv/4/gT//f4B///+AP8A/wD/AP///gL//f4G//X+\
Ff+5/vv98f3J/tn+2f3G/hr/O/70/QP+BP70/Rn+Lv2z/RH+Af7t/U/+Tv7u/f39uP4V//X+Bv/9/gH/AP///gP/+/4I/+/+wP8QAPf/BQD8/wQA+v8IAPL/\
GQAv/67/GgDw/wwA8/8TAL7/7/4J//r+Bf/6/gj/8v4a/67+Mf4W//j+f/4M/8L+7v0J/vv9A/7+/QH+//0C/v79Bf73/RL+P/3y/AT9BP3y/L/9EP76/QD+\
Bv7x/b/+Ef/4/gX//f4C//7+Av/9/gX/9P43/yIANv/2/gD/BP/y/jz/FgDv/xIA5P9SAFAA5/8NAPj/BAD+/wAAAQD9/wQA9/8QAMD/7/4I//v+A//+/gH/\
//4A/wD/AP8A/wD/AP///gL/+/4I//L+G/8s/jX+D/8G/8P+8/36/br+Ff/1/gf/+v4G//j+kP7C/uv9D/7t/b3+G//B/uP9xf4O//j+Bv/5/gn/7v5A/xAA\
+P8EAP////8EAPj/EADA/+7+Cv/4/gf/9v4S/0D+7/0I/vv9A/7+/QH+//0B/v/9Av79/Qb+9P04/iH/OP7y/Qj++P0K/u/9v/4T//L+D//q/sb/CAAJAMX/\
7P4K//j+Bv/4/gr/7P5F/wgACABF/+z+Cv/6/gP//v4B///+AP8A/wD/AP8A/wD/AP8A/wD///4C//v+B//z/hn/r/4v/hn/8/4H//v+Av///gD/AP8A/wD/\
AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD///4C//3+Bf/4/hH/QP7w/Qf+/v3+/Qf+8P1A/hH/+P4F//3+Av///gD/\
AP8A/wD/AP8A/wD/AP///gL//f4E//j+D//D/ur9Ef7q/cP+D//4/gT//f4C/wD/AP8C//3+Bf/3/hL/Pv7y/QP+A/7y/T7+Ev/3/gX//f4C///+AP8A/wD/\
AP8A/wD/AP8A///+Af/+/gL/fP8G//L+O/8ZAOf/RAAPAfYACQH0ABQBPAD0/wAADABC/+3+Cf/6/gP//v4B///+AP8A/wD/AP8A/wD/AP8A/wD/AP///gL/\
/f4F//j+kf5A/u/9CP77/QP+/v0B/gD+AP4A/gD+AP4A/gD+Af7+/QP++/0I/vD9Pv4T//P+Df/s/kH/EAD4/wQA/f8BAAEA/f8EAPf/EABA/+/+CP/7/gP/\
/v6B///+Av/9/gX/+P4R/0D+8P0H/v39Af4C/vn9MP4v/x/+xf5X/uT9D/73/QX+/f0B/gD+AP4B/v79A/77/Qj+7/1A/hH/+P4F//3+A//9/gT/+v4N/8X+\
4/2//hz/Xf9b/7//pf+i/+j/GQC7//D+Cv/2/gz/6v5F/wgACABF/+z+Cf/7/gH/Af/8/gj/7/5A/xEA9/8GAPr/BgD3/xIAv//x/gX/AP/6/g//Qf7v/Qj+\
+/0E/v39BP77/Qj+7/1A/hH/9/4G//v+Bv/4/g7/5/7R/9H/5/4N//j+BP/9/gH///4A/wD/AP8A/wD///4C//3+Bf/2/hP/PP52/vr9N/4b/+n+H/+s/rH+\
GP/0/gX/Af/5/g//4/5Y/0P/If8nAOD/p/8h/8P/1//k/g3/+/79/g7/Qf7v/Qj++/0D/v79Af4A/gD+Af7+/QP++/0K/u39Rf4J/wn/Rf7t/Qr++/0C/gH+\
/P0I/u/9wP4R//f+Bv/6/gf/9v4Q/+H+Wv89/yv/FgD9/+//zQDQAOv/AwAMAL7/9/70/sL/BgAOALb/qf8fAOn/GQC7//H+B//7/gP//v4B///+Av/9/gb/\
9f4V/7j+/P3v/c3+Uv7o/Qn+Af70/R3+J/3D/dX96vwA/bX9Gf7w/Q7+7f1A/hP/8/4N/+z+wf8QAPj/BAD9/wAAAQD8/wcA8/8YADD/Lf8cAO3/EwDD/+H+\
xv8OAPf/CAD1/xIAP//v/gn/+v4E//v+Bf/3/hH/QP7v/Qj+/P0B/gH+/P0I/u/9wP4R//j+Bf/9/gL///4A/wD///4D//v+Cf/v/h//pP7E/tH+8P31/cr+\
Uf7s/f79t/4W//P+Cf/4/gr/7v7A/xAA9/8EAP3/AQD//wAAAAAAAAAA//8BAP3/BQD2/xMAO//2/vv+FP+y/i3+G//v/gz/8/4T/0D+7/0K/vj9CP7y/Tj+\
If84/vT9Bv78/QP+/f0E/vv9CP7v/cD+Ef/4/gX//f4C///+AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP///gL//f4G//X+Fv+3/v/9\
6v1U/sP+JP4g/+z+D//x/hb/Ov74/ff9O/4T//b+Bv/7/gX/+v4K/+7+If+i/sj+SP4i/iH/7v4J//v+AP8D//n+jf/n/lH/Uf/n/g3/+P4E//3+Af///gD/\
AP9//4H//v4D//v+CP/v/kD/EAD4/wQA/////wQA+P8QAMD/7/4I//v+A//+/gH///4A/wD/AP8A/wD/AP8A///+Af/9/gT/+P4N/+f+0f/R/+f+Df/4/gT/\
/v4A/wH//f4F//j+Ef/A/u/9CP77/QP+/v0C/v79A/77/Qj+7/3B/g//+v4A/wX/8f6//xEA+P8EAP////8EAPj/EADA/+/+Cf/6/gT/+/4F//f+Ef/B/u/9\
Cv75/Qj+9v0R/kH97vwL/fb8DP3s/ET9DP4A/vT9Pf4T//f+Bf/9/gL///4A/wH//v4D//v+CP/v/sD/EAD3/wQA/f8BAH//AAAAAP//AQD9/wQA+P8PAEL/\
6v4R/+n+RP8MAP3//P8OAMH/7v4J//v+g//+/gH///4A/wD/AP///gL//f4F//f+Ev+//vH9Bf6B/vf9Nv4j/7b+9/0B/gb+8v0e/ib9Q/3V/ev8//w3/Rb+\
9v0F/gD+/f0H/vD9v/4S//X+Cf/0/jP/KwCj/7v/CQANALb/q/8bAPH/CAD7/wIA/v8AAAAA/v8CAPv/CADy/xoArP80/xAAAwDH/+r+Cv/6/gP//v4B///+\
AP8A/wD/AP8A/wD/AP8A/wD///4C//3+Bf/3/hL/Pv7y/QP+B/5L/V39yf0M/vv9A/7+/QL+/v0D/vv9CP7v/UD+Ef/4/gX//f4C//3+A//7/gj/7/5A/xAA\
9/8FAPz/AwD8/wQA+P8OAEX/5v4X/97+Wf9D/5//LQAy//b+CP/1/hP/vf7z/QP+A/7y/T7+Ev/3/gX//f4C///+AP8A/wD/AP8A///+Av/9/gX/+P4R/0D+\
7/0I/vv9BP78/QX++f0M/ur9TP7Z/lb+zf4J//z+Av/+/gL//f4D/3v/CP/v/sD/EQD2/wcA+P8JAPL/GQAv/6//GQDz/wYA/f///wMA+P8QAMD/7v6K//j+\
B//2/hL/QP7v/Qj++/0D/v79Af4A/gD+AP4A/gD+AP4A/gD+AP4A/gH+/v0D/vv9CP7v/UD+Ef/4/gX//f4C///+Af/+/gP/+/4I/+/+wP8QAPf/BAD9/wEA\
AAD+/wIA+/8HAPD/vQAVAe8AFgG8APL/BAAAAPr/DwDB/+7+Cv/4/gf/9v4S/0D+7/0I/vv9A/7+/QH+AP4A/gD+AP6A/QD+AP4A/gD+AP4A/gD+AP4B/v79\
A/77/Qj+7/3A/hH/+P4F//3+Av/9/gT/+v4K/2z/Rf8IAAgAxf/s/gr/+v4D//7+Af9//wD///4B//7+BP/6/g7/xf7k/T/+H/+3/vj9+v00/iT/t/71/QX+\
/v0A/gP++f0N/mb+Uf5Q/uj9CP6i/mH/zv/c/kr/CwD7/wMA/v8BAP//AAAAAAAAAAAAAAAAAAD//wEA/f8EAPj/EADB/+z+Df/z/hP/Pv7w/Qj++/0E/v39\
BP77/Qj+7/3A/hH/+P4F//3+Av///gD/AP8A/wD/AP8A/wD/AP///gP/+/4J//D+Hv+n/j/+W/7e/Rf+6P3B/hj/xP7d/dL+Vv7X/c3+CP/+/v3+B//w/sD/\
EAD5/wMA///9/wgAT//T/l3/xP/2/vP+yf9X/9/+GP/o/iL/pP7B/ln+4v0Q/vf9Bf79/QH+AP4A/gH+/v0D/vv9CP7w/b/+E//z/gz/8P4b/67+MP4Z//L+\
CP/6/gX/+f4K/+3+Qv8NAP//0//Q/t//Qf+e/zIApP8w/yQAN//z/gn/9f4S/7/+7v0L/vb9C/7t/cD+Ef/2/gf/+f4J//D+Pv8VAO//FQA9//H+CP/6/gX/\
+v4I//P+GP+x/qz+Hv/q/hj/vP7w/Qr+9/0L/u39wf4Q//j+BP///v/+BP/4/hD/Qf7t/Qv+9v0L/u39wf4Q//j+Bf/9/gL///4A/wD/AP8A/wD/AP///gH/\
/v4D//r+C//q/kn/AQAVAK3/O//f/9n+Hf/d/tX/zv/m/g//8/6N/+z+w/8NAPz//P8OAMH/7v4J//v+Av8A//7+BP/4/hH/QP7v/Qj++/0D/v79Af4A/gD+\
AP4A/gD+AP4A/gD+AP4A/gD+AP4A/gD+AP4A/gD+Af7+/QP++/0I/u/9wP4Q//j+A/8A//3+B//v/kD/EAD3/wQA/f8BAAAA/v8EAPj/DQDm/1AA0ADm/w0A\
+P8EAPz/AgD8/wUA9/8SAD3/9P4A/wz/w/7u/Qj+/P0A/gT+9/0T/jv9+Pz4/Lv9Ff70/Qj++f0K/vD9P/4U//P+EP9H/t/9yv4J/wT/0P7U/Vv+Sf7u/QT+\
Bf7t/cj+/v6//+X/yP5l/7z/o/8sADH/9/4E//z+BP/6/gn/b/8//xIA9f8JAPX/EgA//+/+CP/7/gP//v4B///+Av/9/gX/+P4R/0D+7/0I/vv9A/7+/QH+\
gP4A/gD+AP6A/gH+/v0D/vv9CP7v/UD+Ef/3/gb/+/4G//f+Dv/l/lP/TP/v/vz+OP8VAPX/BgD8/wEA//8AAAAAAAD//wEA/f8EAPf/EADA/+/+CP/7/gP/\
/f4C//z+Bv/1/hX/uf77/fH9Sf5Z/tn9Rv4a/zz+8/0F/gH++/0M/uj90P5R/uf9Df75/QT+/v0A/gL++/0I/u/9wP4R//j+Bf/9/gL///4A/wD/AP///gH/\
/v4D//v+CP/v/kD/EQD3/wYA+v8GAPf/EQDA/+/+CP/7/gP///4A/wH//v4D//r+DP/I/t79SP4M//v+Av8A//7+Bf/2/hP/u/73/fj9uv4W//H+Df/w/hr/\
Mf4r/iL/4v4m/yH+Rf5T/uv9//03/hb/9f4G//3+Av///gD/AP8A///+Af/+/gP/+/4J/+7+wf8OAPz//P8OAEH/7v4J//v+A//+/gH///4A/wD/AP8A/wD/\
AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP///gL//f4F//j+Ef/A/u/9CP77/QP+/v0B/gD+AP4A/gH+\
/v0D/vv9CP7v/UD+Ef/4/gX//f4C///+AP///gH//f4E//n+C//r/kn/Xf/O/l3/S//n/hH/7P6+/xoAQf/i/kX/DQD6/wMA///+/wQA+P8QAMD/7/4J//r+\
BP/8/gT/+v4M/0j+3v3I/gz/+v4D//7+Af///gD/AP8A/wD///4C//3+Bf/4/hH/wP7v/Qn++v0F/vr9CP7y/Rn+MP2u/Rz+7v0Q/uv9wv4Q//j+BP/+/gD/\
Av/7/gj/7/7A/xAA9/8FAPz/AwD8/wUA9/8QAMD/7/4J//r+BP/7/gX/9/4Q/8H+7f0N/vT9EP7m/VD+U/7i/Rb+6P3D/hH/9P4M//D+G/+u/q/+Gv/x/gn/\
+P4I//P+OP8hALf/9P4F//z+A//8/gX/+P4N/+f+Uf9R/+f+Df/5/gT///4A/wL//P4J/83+1v1Z/kz+6v0L/vr9Av4A/vz9CP7v/UD+Ef/4/gX//f4C///+\
AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A///+Af/+/gP/+/4I/+/+wP8RAPf/BgD6/wYA9/8RAMD/7/4I//v+A//+/gH///4A/wD///4C//3+\
Bf/4/hH/wP7v/Qj++/0D/v79Av7+/QP++/0M/sj93/xH/Q/+9v0M/u39Qf4Q//j+Bf/9/gL///4A/wH//f4E//j+Df/n/lH/0f/n/g3/+P4E//3+Af///gD/\
AP8A/wD/AP+A/wD/AP8A/wD/AP8A/wD/AP///gH//f4E//n+C//r/kn/3v/N/l7/yf/r/gv/+f4E//3+Af///gD/AP8A/wD///4B//7+A//6/gz/yP7e/cj+\
DP/7/gL///7//gL/+/4L/8n+3P1L/gb/Bv9L/tz9Sf4L//v+A//+/gH///4A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/\
AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP///gH//v4D//r+Cf/t/sP/CgAFAMr/4P5B/xwAu//z/gX//v7//gP/+f4P/8P+6v2R/ur9Q/4P//j+\
BP/9/gL///4A/wD/AP8A///+Af/+/gP/+v4M/8j+4P1G/hH/8v4U/77+8P0I/vr9Bv75/Qn+7/3A/hL/9v4H//n+Cf/w/r7/FQDv/xUAPf/x/gf//f7//gT/\
9/4T/zv+9/33/bv+E//2/gX//f4C///+AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A///+Av/9/gT/+P4Q/0L+7P0O/u/9uv4g/zn+8v0I/vj9Cv7u/UH+\
EP/4/gX//f4C///+AP8A/wD///4B//7+A//7/gj/7/5A/xAA9/8EAP3/AQD//wAAAAD//wEA/f8EAPj/EABB/+z+Df/z/hP/Pv7w/Qj++/0D/v79Af4A/gD+\
Af7+/QP++/0I/vD9Pv4T//P+Dv/s/kP/DgD6/wEABADR/9D+Yv+7/6j/HgDu/w0A8v8TAL7/8P4H//3+AP8D//j+Ef++/vL9A/4D/vL9Pv4S//f+Bf/9/gL/\
//4A/wD/AP8A/wD/AP8A/wD/AP8A///+Av/9/gX/+P4R/8D+7/0I/vv9A/7+/QH+AP4A/gD+AP4B/v79Bf75/Q3+5/3R/lH+5/0N/vn9Bf7+/QH+AP4A/gH+\
/v0D/vv9Cf7t/UP+DP8A//T+vf8SAPf/BQD9/wEA//8BAP7/AgD6/wgA8f8bACv/OP9m/8j+Yf/H/+z+Cv/5/gT//f4B///+AP8A/wD/AP///gH//f4E//j+\
Df/n/tH/Uf/n/g3/+P4E//7+AP8B//3+Bf/4/hH/wP7v/Qj++/0D/v79Af4A/gD+AP4A/gH+/v0D/vv9CP7v/cD+Ev/2/gf/+P4K/+7+QP8QAPf/BAD9/wEA\
//8AAAAAAAAAAAAA//8BAP3/BAD3/xAAQP/u/gr/+P4H//b+Ev9A/u/9CP77/QP+/v0B/gD+AP4A/gD+AP4A/gD+AP4A/gD+AP4B/v79BP75/Qz+6v3M/ln+\
Vv7N/gn//f4B/wH//P4H/+/+Qf+O//3/+v8OAOD/XQA4ADcA3gDf/xEA9f8FAP3/AQD//wAA//8BAP3/BAD3/xEAv//x/gX/AP/7/g7/w/7q/RD+7v0c/q79\
sP0Z/vP9CP78/QP+//0B/gD+AP4A/gD+AP4A/gD+Af7+/QP++/0I/u/9wP4R//j+Bf/9/gL///4A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/\
AP8A/wD/AP8A/wD/AP8A///+Af/9/gT/+P4O/+X+1P9L//H++f69/w0ABgBG/+z+Cv/6/gP//v4B///+AP8A/wD/AP8A///+Af/9/gX/9v4R/9/+Xv83/7f/\
Xv/g/hH/+P4D/wL/+f4Q/0D+7/0I/vv9Av7//f/9Av77/Qj+7/3A/hH/9/4F//v+BP/7/gj/8f69/xUA7/8VAL3/8f4H//v+A//+/gH///4A/wD/AP8A/wD/\
AP8A/wD/AP8A/wD///4B//7+A//7/gv/yv7c/U3+BP8L/0P+7f2K/vv9A/7+/QL+/v0D/vv9CP7v/UD+Ef/3/gb/+/4G//j+Dv/n/tH/Uf/n/g3/+P4E//3+\
Af///gD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP///oL+/f4F//j+EP9B/uz9Dv7x/RT+Xf5g/rb+\
uv7Z/uj9Af62/hb/9P4H//v+BP/8/gb/9P43/yEAt//0/gX//f4C///+Af///gD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP///gH//v4D//r+\
Cv/s/sX/CAAIAMX/7P4K//r+A//+/gH///4B//7+A//6/gz/yP7e/cj+DP/7/gL///7//gL/+/4M/8j+3/3I/g7/+P4I//b+Ev+//vD9CP77/QT+/f0E/vv9\
CP7v/cD+Ef/4/gX//f4B/wD///4D//v+CP/v/kD/EAD3/wUA/P8CAP3/AwD8/wkAzf/W/tn/TP/q/gr/+/4A/wT/9v4W/7T+p/4q/zP+9/0E/v79Af4A/v79\
BP75/Q3+5/3R/lH+Z/6N/vn9Bf7+/QH+//0B/v79A/77/Qj+7/1A/hH/+P4F//3+Av///gD/AP8A/wD/AP8A/wD/AP8A/wD///4B//7+A//7/gj/7/4//xIA\
9f8JAPX/EgBA/+7+Cv/4/gj/8v64/yAAOf/x/gr/df8P/2X/0f/Q/+f+Df/4/gT//v4A/wH//f4F//j+Ef9A/u/9CP77/QP+/v0B/gD+AP4A/gD+AP4A/gD+\
Af7+/QP++/0I/u/9wP4S//b+B//5/gn/8P69/xcA7f8aALX//v7u/sz/0//l/g7/+P4E//3+Af///gD/AP///gL//f4F//j+Ef9A/u/9CP77/QT+/f0E/vv9\
CP7v/cD+Ef/4/gX//f4C///+AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD///4C//3+Bf/4/hH/QP7v/Qj+\
+/0E/v39BP77/Qj+7/1A/hH/+P4F//3+Av///gD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/\
AP8A/wD/AP8A/wD/AP///gH//f4E//j+Df/n/tD/0v/l/hD/9P4N/8v+1f3b/kf+8v37/Tn+lf71/gb//f4C///+AP8B//3+BP/4/g3/5/7R/1H/5/4N//j+\
BP/9/gH///4A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD///4C//3+Bf/4/hH/QP7v/Qj+/P0B/gH+/P0I/vD9P/4S//b+B//5/gv/zP7X/Vf+T/7l/RT+\
6P3E/g7/+f4E//3+Av///gD/AP8A/wD/AP8A/wD/AP///gH//v4D//v+CP/v/r//EgD1/wkA9f8SAD//7/4I//v+A//+/gH///4A/wD/AP8A/wD/AP8A/wD/\
AP8A/wD/AP8A/wD///4C//3+Bf/4/hH/wP7v/Qj++/0D/v79Af4A/gD+AP4B/v79A/77/Qj+7/1A/hD/+P4D/wD//f4H/+/+wP8QAPj/BAD+////AgB6/4z/\
yP/e/kj/CwD8/wAAAgD5/xAAQP/v/gj/+/4D//7+Af///gD/AP8A/wD/AP8A///+A//7/gn/8P4e/6f+wP5Z/uP9Dv75/QD+Bf7w/UD+Ef/4/gX//f4C///+\
AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A///+Av/9/gX/+P4R/0D+8P2H/v79/v0H/vD9QP4R//j+Bf/9/gP//f4E//n+C//q/sv/\
2/9T/9L/AQANAEL/7f4J//r+BP/8/gP/+v4J/+7+Qf8OAPz//P8OAEH/7v4J//r+BP/7/gX/9/4Q/0H+7f0L/vb9DP7s/cP+DP///vj+Fv8x/i7+Gv/z/gj/\
+/4E//3+BP/7/ov+Sf7d/cr+Cf8C/9P+z/3j/jr+Kv4c//H+Cf/7/gP///4A/wD/AP8A/wD/AP8A///+Af/+/gP/+/4I/+/+P/8SAPX/CAD3/w0AR//e/sj/\
CwD8/wAAAgD5/xAAwP/x/gX/AP/6/g//Qf7v/Qj+/P0B/gH++/0J/uz9xv4H/wn/5P5b/7n/N/9e/1//Ef/2/gX//f4B///+AP8A/wD/AP8A/wD/AP///gL/\
+/4H//P+Gf+v/i/+Gf/z/gf/+/6C/v/+AP8A/wD/AP///gH//f4F//b+Ef/f/l7/t/83/17/3/4R//b+Bf/9/gH///4A/wD/AP8A/4D/AP8A/wD/AP8A/wD/\
//4C//v+B//z/hn/r/6v/hn/8/4H//3+AP8E//j+EP/B/u39C/72/Qv+7v1A/hP/8/4M/3D+G/+u/rD+Gf/z/gf/\
').split('').map(c => c.charCodeAt(0))).buffer);

const SHOT = new Int16Array(new Uint8Array(window.atob('\
AAD//wEA/f8EAPf/EADA/+/+Bv/9/v3+Cf/u/h//xf7Q//ABwABP/W/8XgYlAPj2igNFB73z0v+vCUoAEfUI+RYQ3/VD9X0Pwf/i7ecHaAyA614D1Qvp/Sns\
GgJIDpf84eu2AWcQ/Og8/54SjfCe8V8UGftA7O8SMv2s6GkIhw8K6rP6chWx80buNBXP/hrrshCrBkfvhPLNE/oDJ+669PIYHfCj868ZqfXH8MgUZgHC7Qn0\
GRfGADnnxg9hC+/6MegnBI0ScQFv7Lb2uRoT6Y77axSlATjtSfNBGn3xxO08FFkHkPSv6McLDhFV5iP9hBi06Wb2SBWBAwTs8fNoFy8BKOkP+DwWlQUa8L3t\
EBx08A3zqhcHA5jv1O1zFmoH3uMXDkoPBOSJBrgVXOfw/PobR+lK/ckWZPqJ51ED4xU7Ab3n9v1IGIbjfwOhFwHkGQUSE+zysOeRFEMFE+KBCM0UU+KhAN8T\
UP2r5LMDjhUy86nnZgk4FLvjQf++GS/lff2MFsYA4eW4ArsXOvaD5gIWEwIQ5VYZegMQ5GgVdwhR46QQzBBB9H7pjxQoDXrnxvnfGHP9n+P1DggKYeHLF/AD\
5uNGEwsMjuzC7l8aIfs25BsMWhFp9ZTlTgcMFcTh3wmpD9/mFfQ2GKL9deKtCRsSeu0r6SoVoASn5MYYywFV54z5bBzA8RbvGB8T8MnxJRlHBXjnzP0pG132\
hOjZC0MV5uN/EOwNJ+WQ/kEav/ey5cgY9vtY6skeiPOC7AceH/Oc7Isd+vFf7KAfmexK+dEYYe6x6e4N5hDw7/7mIhqo8FrwEB5g56z2AxhI/fXinwYbFF/r\
EOshFqkDpOJcFUcLC+2p7KUYSgJZ5BMcZ/0/6JgdBvqW6vYhnPEv+gYcF/DQ7IUWGgoS5DMWEQ4l7tztDhknAq7klRxZ+gLoMx0a9NPsXx377Z/wER5p5dAC\
RxJE5/XuFBgd+VHm+BfWAe7mYPJlHIPrlfhiF/jqZOlDEioFcd8TGen7N+ddF3UHxeRy/hYa8vBB6icUNApX4Uwck/2k7xgecvV56eYRWw+B5tYbAQAk5v0R\
LBKx448CpBVs4UcVxwXG4jIcnvri6mYZfATs4mQDZxYr6vXr1xZC/lbjxxvs8EnsxByX5/L1TxnD4GQB9hM93R8NGgmK4MkRVQ1C5I35hhYP4nUMzxLO6Xjz\
pxwF+Afo8xeuCNDhPg+JEH7jfApLGdv0yur7Hmjvhf1AHPziZguaFv/wwuqIGOsCP+yeHXnxMOnZEUgKed8RHJz2mfJ/Gd7pBuxIFq/9H+QCHcDskfLQGKr4\
QuCEFN317u21Gq33fuIYEPgImOJY+gEaP+f5+w8Yut1/EKgHoOjyHFb0B+khFDEKC+awF0sNeeNpCIoQ3uZUGtULMOU5BsoZTe048S4f6fUL+6MaNujv86Qb\
tfYE708fveRWDHELZN5kDboM6d+eBt8Rnd0AEUsCvuLrFikDx+DMBGoTg+BJ/IMWOurA6nkXZPnq58ge/uQ0CN4MPuLj/SIaJ+fGAhkWlt5iGQL/7vGwH/jo\
Rvr0Hj/zKO9SFhoSl+WGA0cbOe078mcdYPjo8EwgNOXSBdoTpt9SF0//mufnH0fp0P5gF+XoQO30F6/2COtnHDbhowseBbLeXwJqEazhkxI/+1rfMQx/CETl\
PxhX8FXmkxMeAfnj2R2f7Fb3fRzO8N3rWxsR/nnlix1T8B4BUBro4EYZMQNs7KweGAPo42AYi/t49fofouJvD70LWOXsGTwHs+LtC2sTJuBYB00TU+WZ9fgb\
ouezB+0Jp9wvDiAK2N1HCDsOkd7cA4ATHt0DA0cKVeA8E1QHM+CzBY0Uwt/UA7oVLufK9JEd1euh/rEXg+MyGqMD2eTLF5QLg+VSCsUWF+nHHG763+swIKz8\
LulNHvv82eg1EfsUtOP6AosPceNjHs3vLPZZGofe0A8KAxLjvh2+56D7ThLN4C4ZVu+66FQYVPDV5UIXd/MG7D4aDt6ICNoGP+DnGwrsZffQF4DcURZb+mf1\
Vxkg5cP4JB1A65cOLgoP4vQZZgg/5dMYkwpI5AYY/wr140QXSAtz4yQVFg2l4FMY9fYb+Ycam+G4EFkQCuJjA5QWXeCWA5QTyeMx9pgZP+MhBAkKAeAOGE/8\
pd8CCPkJVOTtGQ7ro+1YG5Trre/TGsPvI+gPG6LzfvzhE2vhWAGcGZzk3g9/B8Pn+SIB6XsIcRFO67Iiy+yB+QkhBO3X+e4gFuuO/Bge3uxN9DIa8AXX4HcX\
SPaq9WUffOvS8MQVw+R4DGYPG9zcCf//l+gMHAPfAQhaBQDg5xsz5U3+nQzN5MoYX+o661IZz+6C9p8UVOLNG8Xtj/DbG0jwzus1HdHyhAMAEsPhhQjIFtzj\
Rxvm+dP/2Rh44JoThhB141gUmw2u4oAXcQeW5YIJYRmQ6dn3WB285pP7xRqR4+j+/Rce4C0D0hKZ4Ub58xYs4NsKPgE95AIboePxAEMVv+By/H4UueS59JIY\
AObjDWEClN+1D+0Hy+SzHqDp1AP5EBblvB8x+ufq8Bxo/X3n8Rsb/nn7xRqY5F4Abxvk5jMR/QQW6/4gfuQmDq0H+OdtHZv7uuN/EUoE8exoHWfia/xxFa7k\
xvOWGPbiOQV7BeHgIBsa468ENQ5f21MKpwkC3UwQzgQE39oU0//R4EcQ9gQU5rUd/uYeEVICX+SAHyf5++yqHqP3KuvKHq73tgSRFObg0hlRCLzllRAjDhjn\
JiH569QFSA9m6ecg9emv9h4dt+az/K8YyuCBA4gSF926CjAKxN2FBWMKAeYbGU7jivgLFePjkvRmGCvh+Am+//TuQRm020UJ0A574MsEVhD06BUai/CS7ZUe\
hfAKCpQOu+ESHgsCHOpBHzT9POluHa/7UACwFpriqwioFazkwRv984cARhhb3mUQHA1D4AMWKwNb4m4Yx/mA4hgUuvkJ7PkWieDdE2L3yuCLEyH4wevfFp7e\
uxDXAXneSBQv/njfVRNa/IHyYBiJ4hb6IhnK5NAPiQEA7vMd3uRWEdIQ0eUdBDkZS+aDGbr70vbkIhjsnfniH+fnNgOsGFDlcQAuFxroYxpz9D/uGB8x6CX6\
6hdN5Cr3Jhf+5IATh/QJ6Roa3Ov76RAYc+mcBFEHINqsDZkBP+uHGNnlrfCZGCTmJQblBZfmcyD77fjwSRyc7iTx7x287UoN/QxZ4roR2Qza6Vwh4+ovDBkM\
V+rlIoP4Ru0aIdjydvXpIOjm8gFcF3vk2/5fF1PjKhTf9/vyrRsc6fTtvBhh6jIFkwoL2wQJ5QWW5kgY7+ph6Y4XYepk/PELMt96GzDknAVhBiTkmR7B8YDs\
eRVZ5poTQQn24AIYbANQ5hghIvRQ9RQZZ+YkIKTwpgVsDznySh5R5XAC3Bdi7JUcI+4G+ikeueIPCAATC98FFOADIuPaGeb3pOQ6GMvy7PWoEJfkUhka6ZXs\
zxct53IHOAbX24kX/fWL5p4bAel28xgZ7N87BLYRyd0sEuQFB+G2EtIEu+u3HTbm+BNWC0LjMxuyAhvnsRpm/yv6WB994kYOcBMG41YZsQQB56ggCvQc8l8g\
Y+afAfIVyeJHABEUn+GHF0LwePpOEKPfCxxO5fwEpgVg4ygdfu1T62wUN96GEdX08PHwEOjk2hnf4BYAPhLL3E0QLwW94K0bjvQs7socr+z88YkdgOoXC68I\
OuxSIJLkVhfd/Zr2vCGh7hbzoR7t7iUJXgyK6oogd+S9FOP9wfO/GqPgEByI7+b/1w5346Uc5+RAEqP7ieQiHQLpufNdF/3dMASJCynbVRLB+gzi/RmT6hnx\
Khkm36oDBA+Q3VITPwHm4M0UFf32880cq+DHCeMS5OEpGtYDVuqMIKr3xO/RHwT0FAgYF0Dhvxk2BuPniCGS83D2RR4x6nT5Uhpg6B8TkAMl45QaMfcu5gAZ\
8vDL/HgSQd2R/7sPId8bFdzrJfkvDLbenRhc9lDi0hkW7C/xjA6q4h4Y+fls4wsaMvMz7FgfgOVEAGML+ulBH6TkBhIkAvfxGRyh6iodx/OH8fEeFvGjD4gI\
IORMGoD/ufoDG/bfHBFUDR7jnAxNCwfsGx1Q5aP94hUK5OT5fxXt5LETWfX359kYSe1F6AMWt+wJ9zwPcN3TFqbsWfcsGATi5fnRFsvgdwNqEfnhrABHExPn\
GBqw8XjyXx0e8I/xUB1e8toAHhYj5XofTPNwAJ0X6OTpHsj0p/0tGBzmKBizCrbjuRKDCgrkZAvXDbPkNBtO7tj8kRJt388YVvDA9lkTnuCuD4gI8NyGDJv2\
TvBaGarp0+x1GIDoP/SsDUXjWRLdAu3ezhCZ8533KxpS6YP03BtW6UT8SxGa5zEdR/KS/A8ebO4899wfye7p/DUWKOnEHRz2ffvaGqLk3Rc6/8jwah7J5dAM\
pwhT55gdveqUC5wGWuGSDMQGbOulFvzq4+zyFiztHf9WCuLb9QxRBMze+wuyBO/dEQ6F/tThwBQZ907t1xiL4jIJXwfc5L0b0+3Q/IgVruNmF1v9G/GIHvLo\
6wvJDprodSC68mcGPBbc6Z7/ExtL7bERsgd95ioPTAyB7dYZ4vIN7C8Z8/Yu+0UTc+SI+jUWTOYfBW4HEugVFkjrOeqSFKzwtfj8DaLgIvmKE0PkAQT/BeLn\
YBaz7CbsuBWW9Hv5HxT64KUGmhDJ5sgA0haL51kOpwlD6YMeEfOW/WwZguoqGsr+se1VG17/cOwoGEwBb++zG5//UenBEd4Kn+OMElz76vLPGevkUwgwCZDj\
BRfP837w3BaA9D3nRBF9/kbixg4iAQbjGgBxD8/gJwyJ/pTrJRd26Jz06xQ183vp2hPc+4rz6Rdj6r32BBRhCf/l1Q/kBAbwXx/m7p4DDBYn6vYPKRN86wwD\
EhOi6Zca5/vn82Abcv2b6uEJ6g+k6HYVGAAL6FcEQhHo46QOjv/07aUV1uwS7JsQOvrz6HsXNedZA9UIcOAfBEoMueQH/MsS4uc0930P1uXjCG8OtueL+w4Q\
3udVD4sME+rY/0QYEu9m+W4aUfex8jwa0f+l7akW0Qer6ikPzxDz57IKLwpE7QgX/AZ86TkHixGQ7MH1xBbV8371Wxcu57cLdAV85oz9rxFP560JXgRs4WgI\
JQcY5LP9SQ8L5r4ADA/S6ybwaRMc5zUFwQh05cYNBwpl6fX8ehWC8rrvuBN2Apbrjhs28x4CvBSX7aT8LxV3CXjp6Q1FCWbvghgYB3fsuwbLFDzt9/xcFsT1\
Te5ZEOYFAehsF4D1I/inE1vrMvTuDaYIzuWJ/94JweXwDS0Fherk8ZISpvGi8C8UWOfKBBEJ6OT6AIIQWesK9tQTxPVR7O0Uz/Gv+S0WmuppBJMT9PVU8awX\
XfOPAIIW5+qyCgwSmfZo8UUULwSr8m8YMvjC79YO+wmc6j0Q9AqS7Hv7uBSW9D3tkw2LBIfm1hNp96nxrRMW8ZXtMA/2/XrlNgfjCHDmwPtrEODtAu+8EUTq\
H/4IEC7z7uxVEPoBB+rh/yATAewxCZULeOoFBf8TEfJh+AoXA/4U7/cTHwq476j+vxht8uQEixLa7Lv/SRVu9WDyTxQP/+bv7xLQBbfqkQGzDObnARDU/7Xp\
pRM+99HvjRHA/B/qLfoBEfzq9PhCD8Dm5QbsBUTlwwGwCSnmLwWVDLrxNe8qECIAnejsCBcMZ+8d9WQV2fhB+U0WA/PR9hwUWQPW7DkRXARw8f8ZU/ha+HEV\
wgNv7gAIbxE987/0QBPzALLtbRVr+T7xTBVl9Jz0fhTS7xP4nxKK6438EA8Z967quQiuBsLnvPvEDSPx9exWB4QJG/C57sAQCO5I+kkQ3egRAP4Nw+juBTAL\
8+mxDDAJH/KV9W0Vw/tQ+FkWEPdf9QITWAe57T8LNwtb7lcVoAGV8OYVS/3a8n8XCvga9nwTQQGF8E/6+hS38NT++A3p7Ub0iw//+cXsfhJd8/Dweg7j/qjp\
z/xNDULvbu9JDWj7TenBAH0LCPkx6UkLcfy47IITSvTC9IMR6f1m7zH9QxXP8GoDNA/X7tf+PBJIBVzw8AT2E/H2PffwEtEEGu/3CcAOr+3tBJEQK/7N7W0N\
XwLc7gcUx/lu8a8SgPe18SMSh/QT85IR9fFx9LwQXu9o9a4QuOvR/skJAe0V8qAIVAV77hTzyg9S7Gr94gwa+F7t8gA4D27rUQeqBzntwf12Eu3zCPp3FODy\
Lf0bFSfyHQAJE67/V/O9AvgUv/OW/9IUt/FnAH0TVfAuApwQTv0Z8CcKKAvr8kL0/xBP/Zvy/RBW+SbusAErDc7qHv+7C7P33OvfBqcF8+2s8h0MDvv76jwO\
K/g67soLNgO+7o/3YQ9E7OgB6Qzi694E+gzr93nyog0hCPnvtQHIEVr73vJ8Esn91/YiFkX52vffFVj3yfrzEVAAo/AaBiEOd/UZ9Q8SJfUE+SkP9P+g7hz/\
Ow1l9K/wxAs2AWftIfhIDn7ym/OKDIf9Zu7b9aENzfWP79IPVPOZ9rUNDfVe8NYJhgW57VT9dA0U7eIFEAu17UcGEg1f7wIHdw6O7+AG2g468AoH9Q7r8PYL\
pQo08kj/FRHt/dLw6w3+AQTxzBFy/ebwBxBk/eTw/QsiBR7y8fVODR79lewjAkUJ3/Cd8qsKEP+Z623+Kwrt8gfw7gg9AoTscPwPDDr3AvCsCDgG/O/d+iQP\
9PhL8n0LJAhS7/IK7gmc8PgJvQzj+/L0gw72Cdf1g/tkD/sIM/as+k8R2gAs82b/5xG09Pb6UA5BAaPwNf99DD/tVwVdCGbsTgQjCFf2x+/NB0sE4O3R+GAK\
z/iL7A4DgQZe8LDzUQqO/B3uofvnDJ3x3/eKDNb+h/Jb+F8R6viN+TMPh/yt8hIMcAXU8b8Oewdy8ZcM9QmK8ZUKgQyY/IH0+wbRDiHyPgiECif16/inEHHz\
JP3rDCf/q/CH/2UL3fde8AkEhQjl+XntiQUzAP7rhgqx/HjtwgdXAl3xJvRpC8f4SO73BRsFhOysAwYIXe3aAmUKe/ss8l0AOg9h83/9aA2wAZTzFwJdDzn8\
7fWfCxoK4vW3/AwQxAEy820GvQxH+hn10ggICvXwSAmaBnTzwPpjDlPzSvrtDbD0uvavDW71f/XWCaUAMfFQ+CYKY/ss7RMC4wNr63MEywOq7K0B7QZi7V7/\
twm/7/P8SQzp8Nz/3wrS+H/0IArgBkH1F/uxEFb1iQCODq8A+vZv/d0SwvpN/RUPZ/7/87sKHwZj8p8MOQXo8cgIiAgW+2PzbwQSDH7wjQQSBw7yYvklDGD5\
mvG7C8z6UvCYB+UCefTw8vEHQQDp78f5ywnn7WP9pgce+7Xx7vksDcH0C/otC2X6fPLCBvMHyvUr+RcNeQMk9BwC8Q19/kz1NwulBn/zoQs4CHDzIQj0C9ry\
DwU7C9b/YvT0BEULJPnf9bcJJgWd82D61ArN/RbxnwCqCLXy/fSvBwcCgvV98Z8EfwOa7ZoArQbw7dT+xwb6+3DvWADgBQDuaATMBV76rvL7ABkMjvMR/Y4L\
hAFm9Zn+UQ3V/nr13QLRDKUCcPajAV0Ouf799i8DLw7c9vr8Qg+P+VL5tQ6/+1L2WQtHA4f4IvXvCD4FMfBGBDgGaPu98IsEJwLP7pAHAALD7hUDMgXQ7mr/\
Dwc38PT60Am48dj88Afu8hn3bgfHAlL2k/WaCQUC8vQQ+rQK5QPZ+Cj3tQ5a+rD6aw2iAnb56PkUDr8CZfXICusHQv359ooKHwcN+G/6cg0c/P31mQuJArjy\
lwfuBff6MPOOBkIFPPYH9a8K2/cz9RsIDgCt9TbzvwVsAUPvCwJaBZrvwAKfAyD11PTPCS/3MPaGCzn5SPVCCYkCP/nK9bYHJwe68+UDjgp/9e4A5w0392z+\
+QwbA834nf0UDu38TPd1CekHaP3P9RcDxws69ij8sQyo9kj9mAnw9sP2Vgmz/13ypQaHAyb53fI+ALcHC/HW/hAFMffw8cAGe/ov8nQGMwAX98TylAMfBObw\
GgSvAj3xeQDaBwIAkfT1/mwKYP659eAF7QhJ/GP3AQybAW73XA2bAqn2iAp9B9P9ZvfqCpAE/PQPBSAK4/RmAKYJMP8X99z58wsz+z33xAiE/tvyBf4JB8Lw\
nv+KBhPypPp7CG30lfYYCPD3MfO4B/n7yfP9BUH/gvPs+xoIdPJ6/fsIDPVM+9kI3QCU+OD4Cgr0BLr84fYuDLgAhfjtC0IF+/xT+TELygUm+rf8/g0Z+lX9\
HQ1u+zz5tAtb/4D2mgmcAt7zdAXmBVzz8QBWCEf01vuoCGv2CfdUCAj6//KhBnv97PG2BAIAt/US9FQDwAGL+RPykAIaA7L32PPlA88DaPxw8ygDpwTp8kkG\
TgXz/CL2/AfqBRD2/APmCq74f/+oDdn73fxPC1oE/Ps/+60M4P/B97QHhQcM9pgCeQkF93f9QAsE+Nv7fgfi/rP0K/5rBof7bfJ+ARECOPAAAtMBOfrV8bv/\
qQKp8gD4WAbl+SrzwwV4/lrydwP4Agn86fMZA4sFevri9pQH/AOO+vf4xwjeBTf3WQivBuL64fwYDNYDtPpo/H4MDQK3+QwL7AKE+FsANQrBAUj64Pi/CQEC\
0/X0Bi8Cc/c++bcJv/Yu+psG0f4w9vH3Wgbz/Br04PjKBoD5P/QSBA4A2/iN9EgEzQD18+L6vQVoAJn3ofiLB9cAVvcb/TwKJvnv+ykLzf5u+BEKHgQw97EH\
SQfs/3n5lQHcCyf8aPsoC/P/pPiMCaIDYfbiBAkH3/WgA1oFNvpn99gFKQIc+Or2owcM+fv2pQbY+pfzQgTO/uTyAAMcADj1pvegBNv9X/Tg+SQGmvQw++AG\
yvfi9y0ItvsG+IMHOf759rcBZAl0+Yv9qgpR/bz60gpWApX4IQkiBnH4eQhOBsn82fvjC1X+wPleCpcAGPfGBrgE1fUuAuIGyvbn/EUI2Peu+z8GIPpV9b4A\
yAP380v7JwaW9Qf42APK/R33i/UvBVf6QvThAtH/GvP0/4AErPRl/eMErP7V9zH6zgYPAiz86vfxBIcHUvhRAHYKkfpQAEoKLftt/doJhQT0/cX6HwkBBGD8\
qvpyCFAFHf5W+F4B5AhI+Tj7SwgO/Kb3jAb4/1P13gLUAuj7NvbS/FkGNvcR+gIFo/YO99oCk/+S+U71jQJtABf4K/YqAngCnfSB/s0FavdB+1YHbvut+NUH\
fgBR9yoGKAVf+EgG7wXU/G77AAkjBLX8h/uZCB4Fq/hPBysEqPg9AdEHmAHD+UD92Ad2ABP43v5bB5b3efwGB7363/dMBV/+C/UsA+IBa/tP9cIBCgIs88z+\
jgID/IX29fj/BCb7tfa4BCP9Y/W3/+UD2v7j9hn+BQbH/p33qQGCBqL+0/g6BEcGjP3h+fUC1wi3+mb/jAi5Au/7n/zyCIsClPp2/uEH1wBo+Zz/2Qb1/u/3\
jgAyBrT5tPjPBM8BpPuj9hn//wUH96T8KASG+Nf2bgPAAND6Yfb0/WAFN/fi+/8DDfnN96sC2AF89bsA5QNt/kb4gP4+BsH7AvnDBIEDhP6s+BIEUwX3/Sr6\
NAJZCAb7S/24CMj+6/peCHMCAPoDB8IDIvyK+i4Ijf4M+UQG3gEU/cb3LAF6BlD4BPzpBP/+fPlQ+KgFQfrR92gFfvxr95YDi/61+Df4iwPW/8f1bAGEAnH9\
i/d//PUE2v8F+zr59QYt/A369AZw/6n4qARrBAb4CQK0BXsAkvrW/+cHn/n7/8wIc/t9/voG8/9I+k/94gZSAVj8YvqkBS8BUfrs+U8Gt/zC+N0EpwCM+9T3\
cQJCAev54/cQA+L/h/lT+JsENfsi+K0EI/0M+IgD5//f+XD6Wgbj+l/6EAb7/hH4VwQUA0L4RAGuBr75BgFeBQ7/t/kaAwkFKv6V+YgEIwSV/Zf5HwL/BZn5\
Nv5iB7b8Z/rDBRIAD/igAgAD0Pf1/q4FLflT+0YEu/95+mj5qQNq/5H5RvisAq4AbPYH/6IDdvem/PMDZv60+hL53ANGATf9MfgeAs8C9/w2+TID2QKh/FD5\
ggWqAPr59wWTAtX+k/niA2cEM/4l+rsE0AOw/Qf6qwLuBdr5z/4gB8X8RfuIBTABa/1Y+SEE6AFJ+vv5EARmAab8cPj2/nMEwflo+nUE1Pz0990C9QBr/NX3\
Nv7pBAP63/qQA73/gvtX+RQEhgCu+p36fwSQAJ76R/tkBkz8Mfs7BiD/yPnIBKICKvkWAgEG9/mjAFUF8/vE/EAGkQDU+e8DnAN4+TAAtAW4+nX85AXw/YL5\
HgTnAC/4jwGfAkj+z/h9/mEDJ/0K+MD+7AJm92/97QOO+UH67gLw/kz7hvjuAhoAt/pl+R0EG/1e+VUEYQAd/XT5jAN7AtT8g/p3BDsCHv04+rkDjANM/3n6\
VwEzBdj+n/qzAcQEtfyo+xAFFQMM/l36Jv+5BuX60v0WBJT+tPlk/xEEy/3c+RL9qwW8+4f7VgOo/j75RPzrA2T59/swBN36l/qMA9P+y/qR+ewC+QCM/Qn5\
SwFpAuD8efkLAgcCr/g5AY4DC/qX/ZQFgfw//BkFKwA6/SL7DgT1AvL+zPqDARAE6v1V+l7/PAaB/DH8nATtAJv9qvovA0kBhfyC+gIExgB7/AH6EwK0Avr4\
df5JBPv6XfsZBEH+Jfn2AgEBsP1C+Zj+cwRY/zb71PsLBH7/l/uL+rADywBe/aP55v7cBEr7/P0IBNf8rfrxAlQCzvn+/7sEuPvv/PIEVP55+jAEbwHl+a4C\
awGv/Pb6QgMIATz8OftrA2UAP/u9+pgD1AA8/U75kgGRAU785PmiAfIBLv66+e7+tgLZ/X/5Cf+BA8T5zP4lBD/7z/vWA9v/1fzE+m0D2QB6/Nf6PgTv/o76\
AwQZAUH+gPqv/7cEHfxz/CIE8v7Z+YcCOQLz+SH/2AMM+2P+RQPT/Mf6KANbAaL9h/lcABkCMv3f+ZYAUAEy/af5A/+XA1f7pPuOA7X9SPqyAtcBSPmjAM8C\
uv4D+9f9JAQC/mP6v/9iBH77vPyGBLL+2fpFA4YBV/6a+rMC9QG2/aL6pgJaACH6iAOgAIj9ZPrs/1YEdPtb/KkDe/6h+mkCVgFL+uEB8AAo/WP6FgCGA9r6\
q/3hAiH/9fsT+04Dvf8X/I77fwPd/Jr6WwMI/0/6EwJIAMT8iPoXAusACv1/+ogD0/6I+i8D8P+2/ef6OwPo/0T6yAFpAv76dP+iAyT/Q/2x+3MDUQFn+uEA\
bgLR/gb8WfzSA0H/RfqOARUCSfpn/8AC2v7k+6b8OAN6/sf6lP5IAyn8hvxeA7b/wP3K+l8C5f/N+S//ygKn/jT87/rlAoMAV/rEARwAUvq4/qkDTfww/BED\
yv/C/av6XwI0ASf9BPuoAvf/kPr6AYIB4/oEAHoD1PvQ/B4EJv5D/HMD+v35+mUCcwEF/t76AQDIAXz99vp2/4QD0vul/BQDB/6Y+vIBygBe+iEBegAr/fj6\
tgGvAUD+rfoC/xQCN/6/+uP+SQLV/ZX72vwdBBH9R/xgAur+MvwA/aAD4fv+/CQDsf+h/dz7jwKcADD7f/8ZAy7/NP3v++MDBAFW+0MCygAB/u/7vgLaAHH9\
BPx2AnkAov3P+9MCI/+y+joC3QA8++v/OANY+yL/uQHL/mz7W//1AUv+J/uC/xsCKP5Z+zX/mwIZ+7790wJx/az7NwLz/0z+bPsU/8wCuP7G/LP80gJo/238\
I/0aA0L/HvzW/CQDu/xk/EkDjf4u/MUB4f8R/ZD8uAIz/0b93ftmAkcBEvvl/3wCSvzr/O0C4v5h+7wBUQBf/oT7Sv7HAtL+Kv3K+ywDU/06/J8CRf+O/dv6\
eABnAVb+oftV/MAC8P7F+hcBjwBm/jP7MP/bARf+RfvW/ZwCtv54/Tz7IgH0AQn7KADeACb+YvvBABkBLfuIAOgBePzK/RMDB/6b/EoDEQFT/LgB6ACm/df7\
NgKB/2z7xAFVAEb+3vuH/tACp/6I/QL7AgE6ARn7oABiACT+ZPu6APEAnf0++3oAlwC4/Tn78wDgAOj6rAD3AKj+yPv7/igCCv/Y+/L+LQID/2T83f5YAmz+\
MPxPAEsCyP48/fz8gQOI/0f8CALj/5v7UgB+Av/8Bf60Alj+kfwSAqn/TP70+ywBeQAs+1QAhAGK+xz+8gHO/mz9H/u3ANkAc/v+/hwB+P6c/Nv8fQEU/4/8\
4vx4ARP/mvzL/KUBn/4p/Bb94gKb/tf75wBHAQ/88f48Al79Vf0HA/z+4vzNAb//ef2w/CcDtv5x/K0Cv//V+4gBHQAV/k78fgEdAKP9B/wfAVAAQ/3C+zQB\
9v8t+1T/hwHk+139dQL//S/8AgKy/8f99vssAfn/K/tUAAcBAfxQ/gACUv3O/OoBBABT+0EAiwEP/Av+HQIN/mP8sgHD/03+WfuJAHgAEf56+3YAgwAL/n37\
9f+DAAv+fft0AIQACv6A+20AkwDt/db72f7KAl39J/3/AUD/g/65+5sBbwAT/vr7dgG3AOn7HAGVARf8ZAA4Aa7+sPy0/8IBuvta/+4B0v5m/Wn9UAI1/2T8\
Dv6aAtn9gPygAdL/OP6f+w7/YwIm/fT8mQGn/wb85P/AACX8IP5MAsn81f1oAQP/tvzP/YUB7P7K/Lj9qAGK/pn8cv1sAif+DPwXATUAyfuM/x4CLv2t/V0C\
Sf/v/aMBXP9b/Vn94AF8/w39fvwWAmr/3vvo/kICYf0l/fsBTP9q/un7pwAzAMD7Av+nAd3+dP0e/f8B7P4P/a/8EAI0/4r+sPtz/xAC9vs6/8QAl/6A/Gj+\
0wEV/C/+NwLu/G39QAHU/i/90fwCAu7/6ful/9wB3/zy/SwCAP5u/CcBrP80/I8A3//H+8P//ADK/u78YP3eAZ/+jvx5/WcCKv4J/JoAMgDT+9f+/AD5/BH9\
ogF1/tz73gDTAAD84/5LAan+rv3B+8IBHQDW+4X/pQEj/UL9OgLq/mP8kAH9/3v+TPzD/ycBifvT/7QBKv9G/QH+uAH6/tX8b/3QAdH+gv0q/MkBof8p/LUA\
uP/9/ZH8cgEYAFr+o/xoARwAWf6k/GcBHABZ/qT8ZwEaAFz+nvxxAQ4Ab/54/KH/lwL4/Nf9LQK6/6b+ifw6AWX/SfxaAaD/kv5z/OX+NQKn/YH93AGS/xf8\
TQDnAD/8zP8MAHP+Vfy3/7kASvs9/8YAk/6M/In9PgHG/jH8Ov1cAaT+iPyG/U0Bev4A/D/+4wGa/jn+svv7AL8Ab/wKAHUAsPyw/j4Cd/73/PgBIQCY/l78\
Dv9lAgD/ev0K/UQCUv9Q/ST9NQJW/1T9FP3RAaz///3T++gAygAL/NT+awGg/SP9pQH9/gn84wCD/7b9VPw0AQcA4fvdAP//pv6G/Ib9SALV/gD+J/xVAWb/\
CfygAGcAQfyX/scB3vwq/j0Bf/1m/DkBrP+e/ib89/96ABv+3/vN/0EBg/5X/UP81QEN/8n8AwFK/8P7//8IAdH+UP3B/YoB7v5B/cz9gQHz/j79zf2CAfH+\
QP3J/YwB3v5m/WH94gGz/tn9cPzCAbP/gP6M/J3+TAJw/vr8+gEYAKv+HfyBAGgAYP5F/GcAfgBJ/mT8vP8cASf8GgB8AfX8cv+4AKD++vxr/tQBkvwS/ocB\
W/6y/CEBwf+A/nv8w/7eAaL+K/7P+yMBeAAY/Av/1AFm/Qn94AFJ/7D+PPyOAGEA5vxb/R4CE//2+xkBUwCe/uH8KP/cAJj+5Pyn/lwBmP7k/Kf+XgGT/u78\
lP6AAVb+4/yy/BMCLP+//jj8jABDADf8BQEqAK7+4vw6/6gBcvzQ/i0CgP7x/P0BmP+q/h38gQBoAGD+Rvzm/34ASf5m/LL/1gAl/MP9vQFB/v77ngAyANH7\
2P54AX79Cf3PAar/7/uRAGsAa/7G/Ab9QQIj/gP9mAAF/5r9XfxYAav+HfxiAZr/nv48/MT/1gAT/BP+hgFc/rL8IQHC/33+gPy4/u8Bgf6I/gr8VAHjAGD8\
Qf+IAan+r/3D/DoCuv0K/vABAQBN/h79IwLP/pP8QQEEAX/8tf+HAb7+fv1D/RUC9P18/BUByf91/O3/vAEG/ZD98gEV/hj99ABA/7L8fv3TAb3+UP59/C4B\
1f+g/Vj8uADA/8v94fsb/7oBI/zi/m8Awv7P/LL+WAGZ/uP8qf5aAZz+3/yw/koB3P5N/T7+mAEp/978p/7iAa7+KP4s/QICVf9p/UX9BgKy/73+NPySAIUA\
5/32+84A3gB3/PD+OAHF/pr9uvxQAWL+1vtbAO3/1f6B/F3+/ABV/kv8Df+QATv9Mv0IAfv+o/6O+4j/CQHF/mz9aP1JAev+a/0q/W0BB/9j/SD9iQHS/qb9\
svvtAOj/zv64/P7/MQFx/g79Z/5vAlL+G/3MAT4AevxrAL8BAv0S/hQCuP6e/DsBBQGF/KT/qAF//vf9WfxZAZb/q/4f/Hv/cwBO/uf7rv7dABn82v0NAQP/\
zf0Z/EgBXP9y/YT8owEf/xD81P/cAHP8+f4oAeL+Y/0B/jUCyP1q/fIBdP9q/J8AQwGE/Oj/vQDA/sP9FP6rAiv/oPy/APoAl/zk/7sAqP7i/Jz++QBi/sr8\
Bf3BASL+Bv2SAA7/DP51/CsBZP/6/Wr8eAGv//f9qPwfAcz/5/2x/BoBzv9n/q/8nwDG/3X+k/z0AA8Aaf6H/D4BYgBS/o/8vwDWAJD+/fxw/mkCVP4e/cQB\
TgBf/BoAaAHr/qr9Cf1yAmn/xP4Q/IIAcABM/m78pP/LADD7jv8WAaL+lP0n/D8Bwv+/++D+MgHJ/HH9XwHl/qX+n/u7/7gA2/5m/WP9XgGY/qP8L/2CAdj+\
nv68+4H/JAHQ/HD9WwHq/r7+e/xFAaX/mv5a/JoAJwGT/sb93vypAd3/kfzR/8oAuv6k/Sv9CQIm/9f8mgDM/2n+qvwrAWf/VfxfAHwAU/yI/+AAif4G/eX+\
VQGW/Ib+IAEr/i39BAFi/6z8if99AQn9pv2+AXv+j/z4AAgAnP6P/Pv9XgFg/q/8pQC3/7f+gfwA/mABVf7I/HsA3v9j/GD/0ACi/tr9fvwlAcf/bfxf/8oA\
rP7G/cP8iAEQALH8sQC5/33+jvz4AAwAbv5+/E3/RgHM/nv9nf13Af7+7f2S/cUBRv/s/Un9dgFZ/879QPxqAFYAyPxw/qYBMv4Z/U4BPgB//JkA7f+2/uz8\
VP6gAar+MP7h+4oANACY/hH9Hf59Abn8Sv4XAf3+0v0U/E8BU//i/fj7i/+IAGv8JP9DAHX9dPxKAG0AtPyH/v8Awv4X/gT8rgDz/5X+t/x//QMCg/7S/PAA\
V//2/QL9IAFx/+j9Cf0fAWv/9v3s/HUBtv9o/mP9WwBaAa/9zf10AQv/jvzpAMwAoP+h/Sf+HgIz/578wAB7AJb8Zf82AdT++v2X/YUB5v4X/iP9KgG3/ur8\
OgFL/6r+bvy5/wgBfP1+/WkB9v5z/MEAsv+D/oP8LP8RAXP9hv1hAYH/XvwvAK0Aq/x+/p4BN/4V/VQBNQCN/KL/YQG1/bn9nAFA/uH87ABT/4f92/wNAY//\
0f5o/ET+TwHg/Zn8QwB5/5X8rf8dAdP86v3qAIr+nPxNAGIAx/zk/0EA/PzG/bgB6/5h/JYA7/+3/uT8Cf8jAWz9h/1hAUn/qP5w/Lj/CQF5/YT9XAFU/5b+\
lPytAMH/cf6h/FsAFwBy/Kf/bQEQ/Sb+MwHb/qv+1vzzAHIA0P4G/bgAsv+K/nb8x//aAKX+xv3M/PQAs/9x/Ov/rADl/lr99P1BAfD+Yv3c/XYBQv4B/fcA\
mP/N/mX8UP41ATP+Cf3yAJz/yv7p/Mr+PwEh/in9lgBg/5z+evwIAPn/rP55/EP+PgEr/hL95gCx/4P+h/wCAPr/sf7s/Fv/EwCc/gP9u/7JAHb9bPy1ALL/\
s/4O/ef9jQEA/sz9JQFZ/+H9Uv3sAGX/2f1Y/WoBvv+7/Ir/bgGt/b39uwGN/yj96wCw/3/+jvx0ABUA3v6f/O3/EgCN/kz9FP8kATn+B/3wAKX/tf41/SD/\
ugHZ/4b+9fxLAC4Bi/3x/wAAq/70/M7/qAB2/mn9wP5UAVH+/fzyAKr/qf5P/dD+SwFZ/vT8/wCS/9T+3Pxe/5wAgP5h/cz+PQHH/s3+d/zi/9UA0/w2/ikB\
4/4i/uj8swBg//396fz4ALD/df6p/B4Azv9j/tr81P9ZAPP+av2g/QEB4v6n/V/9wQBD/9b+Jv0k/yQBK/4r/YsAVf/C/EH/GwHD/bj9EwFX/hD9QQAIANT8\
/P75ANr+B/5S/aYAFP/p/WX9mQAf/7z9qfy2AHb/pv2q/M4A8/70+2n/RwDv/N/95QDn/rf+r/xoAFUA5/6J/b/99gC8/7X8+P+BAMv+o/2e/akBYv+e/dQA\
bv9X/dT98ADY//P+ov00AMEBtP38/fQAI/7v/eUAVv8G/9j8Of8fAZ/9b/3oAE3/mf6S/K//vf96/pL88P8YAHv+8vyp/gIB/P3g/VcAB/93/XH9iQEB/k79\
+wBE/5f+wvxY/+YA0f4u/lr96gDc/zP9QP/vAM3+Mf5W/e8AWQAT/fT/LAAf/mb9+wCo/6T+W/23/noBAP7c/VsAAf8D/jn95wDJ/Vr99QBI/5X+xPzX/2gA\
z/6y/VD9/gCZ/6X8Zv+9AIP9Of5OAcL+z/yOAJT/wv4C/RX/RAEP/a7+oAAk/4T+Mv04AEQAwvwP/14Bpv9m/hr9DwHJ//T9tP1GAfv/6vzT/4wAkv+r/f79\
tQBD/pv9mwA8/w/9nP/JAFT9vf6YAAX/Xv0s/vIA/P73/Vn9pQAP/9L9Af1GADMA5Pyt/qwA5/4S/q39GwHT/rT84/9ZAOP+kf2u/RYBAP9I/Q4AUP/r/N3/\
VAD0/mv9HP6MAKr+R/3h/qYA5f4d/m/9pgB2/1P92f3uADL/+fza/04ABP9K/X3+vQDx/mj9Kv5sAAr/XP0s/nMA+P7+/e79hwGF/sf9BgEt/+b+Fv05AAEA\
if5k/br+6AAo/u/94wC0//38zP9pANT+of2V/WUB1v8j/VQA5v8u/UL/7wDN/i7+WP1sAN7/C/2D/2sAUf3K/hoBl/6t/VIBCQC5/kb90f7TAEX+nf0SAFH/\
6fzf/1EA+P5i/VH+EAGQ/QP+rACK/tv8CwCO//f+qf2i/n8AB/1J/gQBav7x/Pb/q/+j/ln9u/5yAA/9Q/6LAGD+//xgAM//X/3C/noAcv2i/r0Apv5E/Q7/\
uACP/fr93QBd/3z+6fz0/7v/Wv4B/eL/qP+h/D7/qP/f/sv9I/6ZAAX/mf7b/Pv/t/9f/vj88f+L//f8q/+/AFz9tP6mAPD+Bv6//fcAXP/i/cz9+wBF/xb+\
Rf1VAOr/yP7i/QL+dQGc/6D9EAB3AIr9zf7XADn+1P0yASwAo/3b/7gA3f01/yEA9v6a/cT+uQDX/qr9YP1AACL/Kf1V/+P/lv1C/ocAbf7m/LAAIwBA/dr+\
3wAb/jv+kwBX/pP9GABL//L80v9oANH+rf1c/UMARf/Q/jX9Zf+v/6f+Tf1V/0EAkP50/W3+mQA5/nL9KQDG/kX9zP7eAC/+6P1rAE//sv6R/SD/wQBA/tv9\
eAA7/9X+Mv3n/7H/oP5c/Tn/cAA3/f/+EQD4/gP+v/1aAGP+i/0jADr/Df2A/xcA6v6g/WT9PQBJ/8r+Pf1a/8b/XP7y/AL/DgAB//L93/0eABf/6f3i/R8A\
Ef93/sX99wBW//L9i/0PAIz/Wf1y/w4AMP96/j79gwC//2D9Uf9YALP94/30AJr/rf3S/+H/P/37/pMA9/4E/rr9hABF/w7+WP2M/47/9P6y/W7++v+l/mb9\
ff6BAGP+hf0rAFL/yf45/WX/r/+n/kz9WP86AJv+Yv2O/lsA9P6h/lf9fgCz/2T+c/31/6r/pv5U/UT/YQCt/en97ACl/5r99f8jANj+3/37/QgBdv+O/WYA\
WP99/nH9RADl/kH9EgCZ/7D+UP3G/l8AVP2p/kgABP8R/nH9LQBh/6D9Lv4tAID+cf3i/9v/Qv17/w0AAf+Q/dH+JwDx/pz9xv61ANn+yP1U/qEAPv7d/XcA\
Pf/N/mP9k//VAN7+Hv6Y/bwAl/7F/XsASv+K/l79AgCj/6n+VP3D/mQAq/3s/WYAVv+D/mH9BACd/7b+Pf3r/hoA+P77/dL9MQD6/h7+W/32/7//cP2J/nwA\
Yf6O/RcAeP+A/YT/eP9u/vL88/+P/+78l/9//wv/Z/0S/qoAS/6V/R4AYP+0/lz9gf6DAFv+lP0QAIL/bv3K/loAt/3a/YUA+f6M/WUAWv/6/XH95//P/1f9\
1f5WALP95v1tACf/Fv16/5v/5f7H/Uz+NwCU/VD+ZgDz/hn+bv0NAHb+hv2a/3j/e/22/nwAff1l/kcAR/+J/sP+qgA3/uT9bwAl/xj9ev8aAOn+vv1a/p8A\
vv3h/fAAJf+W/f//kP/6/qD9tP5eAOj9WP4AAOP+q/3t/6b/2f7Z/Qj+bgAm/5T9AwCK/wL/kv3N/i8A4v66/Wz+8//Y/u79t/0hAFv/vf5L/Ub/4/9I/WX/\
PgAC/jr+SwBs/2z+g/2p/zX/lf30/63/nf5p/Xn+iQBY/pX9kf99/3f9u/52AIP9W/7b/wD/qP17/uL/8/69/TP+hP8l/+L94v0lAAX/Dv53/aL/dP9//Q7/\
YP/A/sD9Xf+7/5X+bf13/okAV/6Z/QkAjP9e/Wb/JgDe/kv+Rf5lAaT+ff0hAGz/Mv62/woA9P4T/vj9GwCE/1397/4SAAX/4/2f/o0Apf5U/Un/0v/u/VX+\
/P8V/5H+X/16/7T/Bv48/iUAhf5u/eX/1v9K/W3/qf+r/kv9Vv+//5L+b/12/okAV/6Z/Yr/i/9e/ef+JQDg/kr+Jv4VAAj/Nv4w/g8ADP8R/mb96f/T/8z9\
bP+p/6z+x/1d/zIAqf5D/Wn/GQD6/pf9yv4wAOL+uv1t/vX/sP7O/Ur/1//g/Zb+agCf/if+XwBO/8H+zv2V/1//vv7E/VP/TQDy/VL+AwDi/qr97/+k/93+\
0/0T/jgApP4q/lQAZv9u/oT9pP9o/3n+aP17/6T/0f5y/rT9JwAt/6n9p/9Y/7v+1P2S/z7/l/1m/8v/4f0f/9L/8/5N/oj+mwD4/9z+If7O/p0AjP/E/QcA\
h//n/VX/SAD7/UP+HAC1/h/+WwBi/3P+fP2z/yb/sP2g/2L/rf5t/T3+GQDH/tT9h/97/4f9dP4XADb+/f2R/xn/8/3I/dX/Z/6F/an/V/+//k39m/7R///+\
k/5w/a7/Yf+A/mD9iP+P//X+Lv52/un/5v5U/gj+cwA9/9P+s/1n/67/qP7M/Vb/vv+U/u39ev6AAIr+RP4PANT+vf3R/9j/2f2k/s//9/7I/hL+ZgBS/63+\
Hf5nAEb/y/6+/Vb/yv/2/U3+CQD8/uH+sf1e/8b/9/1O/ggA2f65/dX/0v/i/ZP+7/+X/jb+QwCA/+H9aP8fAOz+Mv50/uj/7f5F/ib+GwDU/rH9bf+i/+H+\
TP4f/iAA9f7a/sv9h/4BAHn+jf7o/67+4/15/4r/8/2T/t//4v5q/rf9pv9N//v+QP4l/iEAyf7I/aH/Sf8J/yP+/f7j/+/+R/4g/igAvv7Z/QL/gf/+/YL+\
/P+K/kj+gv8R/zT+K/6g/8b+zv2V/2L/uf7R/Zj+0v///hD+df2l/3D/Bf6D/vX/mf4s/lsAMP+Q/YH/kv/0/i7+dv7p/+n+Tv4V/rj/IP43/pn/yv7M/ZP/\
Zf+y/lz+hP/2/zf+HgBhADH/Y/5U/0wAzf6y/W//m//v/i7+ef7i//f+Nf5m/gkABv5D/hMAzP7P/Yz/cv+Z/i3+Vv/d/6T+Jv5cAFf/q/4b/uz+uP8I/zX+\
Mf4OAAv/N/4r/pr/9/7d/sH9m/9f/7n+0/2X/zH/sP0W/3n//f2M/ub/2v72/h/+9P+j/9n+Xv78/YYA+f4J/vL/Gv+q/Vv/0f/g/Z3+VgDs/tz+y/2F/4n/\
5/1U/8n/9v1L/g8Azf7S/YP/hP/3/Q7/aP+u/uL9/P6F//z9hP76/43+Q/6K/wT/Tv7Z/VL/2f7N/Yb/g//0/Zj+0v/7/jz+Lf6S/wn/OP4r/pr/9/7d/sL9\
mv9h/7b+1/0OAGf/s/7Z/Yv/a/+r/ub9dv+P/+f9TP/b/9b9Kf/H/wT/Mf7h/hYA7P2V/uH/3P72/p79d/+d/+L+Tf4b/qr/vv7Y/Yb/ef8O/kH+j//8/tz+\
vv2h/tH/9v5I/hj+uf+e/jr+kv/8/tf+yf2O/nX/EP5B/o3/AP/U/s39if99/wD+gv76/43+Qv6M/wH/0/7N/Qn/ff8A/oL++v+N/kL+jP8B/9P+zf0I/3//\
/f2H/vP/m/4p/t7/T/+//tH9EP9o/67+4/34/oz/7v0d/03/Af8w/uX+sQDo/+j/tf6s/x4Ayv4k/93/Lf8T/v7+cP9M/k//EQDF/2L+xP9y/wD+iv9o/7L+\
2f0M/2j/sv7Z/Qz/av+t/uH9/v6C/wH+fP4IAHL+l/7W//L+Tf6N/u7/Rf/F/s79E/9j/7f+0v2X/1T/+P5A/ib+nP/2/tz+xv2S/2//m/4s/lb/3f+k/ib+\
2v9a/6b+Jv7b/tn/qP4h/uL/Tv++/tf9hf78/4v+R/6E/w7/O/4g/rL/JP4x/qH/vf7l/UT/Ev/Q/sb9n/8t/7L9Ff96//z9jv7h/+L+av62/aj/S//9/j7+\
J/6d//X+3v7B/Zn/Yv+z/t79Af9//4f+S/5+/xj/Jf7q/o//9P2L/vP/lv40/sr/c//8/RP/1v/4/j7+K/6T/wf/Of4p/p7/zP7F/aT/Rf8Q/xX+O//Z/+39\
Uv6I/9b+wv0g/1D/+v4//if+nP/2/tz+xf2T/2z/oP4j/mb/QP/9/kb+kf7q/0r/vv7a/f3+iv/v/Rz/Tf8B/zD+Z/4LAIL+S/6D/w3/vP4b/l7/XP+d/jn+\
kv/7/tr+w/2a/1//uv7R/Zj/VP/4/kD+Jv6d//X+3v7B/Zr/Yf+2/tf9Dv9n/7P+2f0N/2n/r/7f/QD/f/8G/k7+ef8h/xf+Av9j/+n+U/6I/vP/PP/2/nv+\
Nv/7/3r+kP5gAGL/Cf+n/7L/oP48/+v/mf4y/sv/cf/9/RL/Vv/4/j7+rP6S/wn/Nv6u/pX///5O/t79RP8Y/0L+5P1B/xj/Q/7h/Un/5f66/SX/TP/9/jz+\
rP6V/wT/wf4Z/l7/3f+b/r7+if8L/7z+Hf5Z/+X/iv4A//X/m/6k/uf/PP8F/zn+Kf6c//T+3/6//Z//M/+i/TL/Rf8B/zz+Kf6c//X+3v7B/Rr/Yf+2/tf9\
Dv9n/7P+2P0O/2X/t/7R/Rr/T/8B/y3+bP4CAJH+MP7Y/1T/V/5S/93/pf6j/uH/S/9k/jn/KgAf/0f/0f/u/vv+v/9l/0b+Z/+6/wf/Nf4x/o//C/82/i3+\
l//9/lL+1/1R/9z+yP0O/3X/Ef5A/o7//f7Z/sP9mf9h/7X+2P0L/2n/Uf5N/+7/gP4P/9v/7f51/k3/yf/9/jz+q/6X//z+c/5G/13/0v5U/97/of6t/s3/\
cf/8/RT/U//9/jT+4/6S//T9if53/4/+Qv6N///+2P7F/Zb+Z/+r/uz9Rf/j/sX9EP91/xD+Q/6K/wX/zP7d/cj+Ef/N/s/9C/92/xD+P/6S/9H+w/0j/0n/\
Cf8i/n7+Yv/x/kT+Jv6Z//3+Tv7f/UH/H/+z/iH+2v7g/5n+P/6J/wv/vf4d/rb/nf69/ov/Cf++/hr+X//d/5z+u/6O///+c/5C/2b/vv6b/2EAs//f/lz/\
O/8P/wT/dP96AKD/8/5A/2v/l/46/pf/y/7L/ZX/Yv+4/tL9Fv9X//T+Rv4c/q//rv4a/u7/Nv8J/1X+n/+f/9T+iv4z/3T/j/7D/oj/Bf9q/lH/Tf/u/nz+\
O//v/5L+wf6M/wD/cv5C/2n/mv60/qL/tf6Z/uz/PP/+/mr+Vv9B/wf/LP7p/ov/AP5Q/nr/HP8h/vH+hP8J/kL+lf/J/tT9BP+B//79A/96/43+Qv6M/wD/\
1v7J/Q7/dP8S/j3+l//H/tb9AP+J/+/9Hf9K/wj/I/5+/mL/8f5B/iv+Ev8L/zT+Mv6N/w3/M/4z/o3/Df8z/jP+jf8N/7T+sP6S/wX/wf6X/uP/Vf+p/qP+\
3v9R/9j+Uv9Z/87+YP9C//n+b/5P/0v/9f5v/lP/Q/8H/yv+6/6H/wj+Qv6U/8n+1P0E/4H//v0D//r/jf5C/o3//v7Z/sT9Gf9h/7X+2f0J/3D/pP70/Tn+\
HP/C/t/9TP4C/w//Of4i/jD/J/4t/qr/q/4o/tH/bf8B/g3/Xv/n/n7+Pv9k/0r+X/9K/+n+D/9x/xL/4v5X/0f/9v5v/lH/xv8B/zf+sf6M/xD/K/7l/pX/\
av4d/1D/+v4//qb+nf/2/tr+yP2O/nX/kP5A/o//+/7e/rz9Jf9K/wL/Mf7k/pH/9P0J/3b/kf6+/pP/8/4P/2n+Sv9f/0v+Y/9A//z+yP6N/vL/Of/+/mz+\
UP9L//b+bv5V/z//Dv8d/gT/WP8A/yj++v7m/+v+Tf4V/rr/nP67/pD/+/55/jf/e/95/hP/Wf/v/nP+Uf9D/wn/Jv71/nb/pv7o/ff+i//z/RP/Xf/n/uD+\
R/4J/4L/9f0X/1T/+P7C/iT+o//H/sr9HP9R//z+PP4u/hH/Cf84/iv+Gf/4/lr+x/0R/3D/GP4y/qr/pv63/pH//f51/j//bf+S/sH+iv8E/+z+TP9U/+L+\
k/7w/pT/vf4Q/nb/Lf8X/xr+A/9f//P+Qf4r/hL/C/80/jL+Df8N/zP+M/4N/w3/M/4z/o3/Df+z/jP+jf8N/7T+sP6T/wP/xv6P/vH/Ov/9/u3+0P9M//H+\
9v5G/9n/3v4Z/+P+zf9d/8z+4f9D//b+9v5B/2T/R/5n/zr/B/+2/q/+kv8F/0D+HP63/5z+P/6G/xH/sf4z/o3+Dv+w/jf+hf8a/xr+BP9e//T+QP4r/hL/\
C/81/jH+kP8J/zr+pv4n/7v+5P3L/uD+xf0S/3H/F/61/qP/sv6f/t7/Vf9Q/mL/Pf8F/7b+r/6S/wb/Pv6f/jD/Kf4p/i//o/43/hP//P7X/sn9Dv91/xD+\
QP4O//3+2v7C/Rr/Xf/f/hT/cP+Q/+n+Sv9g/0n+Zf87/wX/OP6s/pj/+f54/j3/b/+Q/sX+hP8S/zL+MP6U/wD/Tf7g/cD+H/8y/qX+Mf+g/rz+i/8I/2T+\
Xf81/z//Tf8i//3/iv7F/on/Af90/j//bv+R/sL+iP8K/8D+lv5n/0v/Xf5M/2b/l/6+/o3/AP9y/kL/af+a/rP+pP+y/p7+Yf9O/1z+TP9m/5f+v/6K/wb/\
Z/5W/0T/Af84/jD+EP8L/zb+Lv4V//7+0P7b/cr+D//Q/sj9F/9e/2D+Ef92/wX//f6B/wH//f4E/3n/C//r/kn/Xv/N/l7/yf/s/gn/fP///gX/8/6a/63+\
tP6Q/wL/av5U/0b//v6+/qX+ov/n/hj/Xf5b/0H/A/84/q7+E/8F/z/+HP62/5/+Ov4P//7+df4+/+7/kf7C/on/Cf/B/pP+bP9B//H+hP4D/3X/GP+u/rL+\
k/8A/83+X/7C/hr/Xv5a/0T//f7D/pv+t/+g/rf+l//x/o7+7v4d/6z+M/4T///+z/7b/cr+Dv/T/sT9H/9Q//v+Pv4p/pn//f7P/t79w/4Y/2L+VP9P/+j+\
jP75/oP/AP/9/gf/8v4a/63+s/4R/wD/b/5L/1X/4v4T/2//Ff+7/pX+bv87//7+a/5U/0b/AP85/q/+EP8L/zX+r/6U///+b/5M/1P/5f6O/vj+hP///v/+\
BP94/w3/5v5S/07/6/4F/4X/6/5O/9H/5/4L//z+fv8I/+z+Sf9e/83+Xf9K/+n+D/9y/xH/5P5S/1D/5/4O//f+B//5/on+8v6Z/6/+L/4a//H+Cv93/gr/\
cP8c/6v+N/4M/wz/t/6r/pr/8/4F/wH/+P4T/7j+Hf5c/17/m/68/oz/BP/q/lL/S//z/nX+SP9X/2D+Fv/p/iD/qP44/gr/Dv+y/jP+Df8N/7P+Mv4O/wz/\
tf4v/hT///5v/kv/Vv/h/pX+6/4f/6r+tP6S//3+8/5F/2D/zP5f/8j/7f4G/wL/df8Z/6z+tv4M/wz/t/6r/hv/8/6G/v/+fP8J/+z+yP/g/8n+Zv87/wf/\
tf6w/hD/CP+6/qb+JP/j/iT/Jv66/gn/D/8z/rH+Ef8G/z/+Hf41/6H+t/4W//P+C//0/g//5f5R/1D/6P4L/33//f4L/+j+UP9R/+f+Df94/wX/+/6F//j+\
Df9n/lH/Uf/n/o3++f4D///+fv4F//b+FP+4/h3+Xf9d/53+uP6U//b+Bv/9/gH/AP/+/gT/+f4L/+v+Sf9e/83+Xv9J/+v+C/95/wT//f4B///+AP8A/wD/\
AP8A/wD/gP4A/wD/gP4A/wD/AP8A/wD/AP///oH+/f6E//n+C//r/kn/Xv/N/l7/Sf/r/gv/+f4E//3+gf7//oD///4B//3+BP/5/oz+6f7N/9b/2/7F/xoA\
PP9y/gX///79/ob+8/4Z/6/+r/4Z//P+iP76/gX/+/4H/3X/Ff+3/qH+M/+g/rr+Dv8E/8r+4/28/ib/Jv46/gr/Df+2/qz+Gv/0/oT+A//1/hj/sP6w/hj/\
9f6D/gP/9f4Y/7D+rv4b/+7+D//u/hv/rv6w/hn/8/4I//r+Bf/7/gf/9f4V/7f+ov4y/6L+t/4T//j+gv4E//X+GP+w/q/+Gf/z/gf/e/4C///+AP8A/wD/\
AP8A/wD/AP8A/wD/AP+A/wD/AP8A/wD/AP8A/wD/AP///oH+/f6E//j+Df/n/lD/Uv/k/hH/cf8R/+T+Uv9Q/+j+C//9/n3/C//o/lD/Uf/n/g3/+P6E//3+\
Af///gD/AP8A///+Av/7/of+8/4Z/6/+r/4Z//P+h/78/gH/Af99/gb/9f4V/zf+Iv4y/6L+t/4V//X+Bv98/gL///4A/wD/AP8A/wD/AP8A/wD/AP8A/wD/\
AP8A/4D+AP8A/wD/gP4A/wD/AP+A/gD/AP8A/4D+AP8A/wD/gP7//gH//f4E//j+Df/n/lH/Uf/n/g3/+P4E//3+Av/+/gL/+/4H//P+Gf+v/q/+Gv/w/oz+\
9P4P/+f+T//V/9/+Gv/f/lX/Tv/o/gv/+/4A/4X+9P4Z/6/+r/4Z//P+B//7/gL///4B///+Av/7/gf/8/4Z/6/+r/4Z//P+h/77/gP//P4F/3j/Df/n/lH/\
Uf9n/w3/+P6E//3+Af///gD/AP8A/wD/AP8A/wD/AP8A/wD/AP+A/gD///4C//z+Bv/1/hX/t/6i/jL/ov63/hX/9f4G/3z+Av///gD/AP8A///+Af/9/gT/\
eP8N/+f+Uf9R/+f+Df/4/oX/+/4F//j+Df/n/lH/UP/o/gv//f79/gv/6P5Q/1H/5/4N/3j/BP/9/gL//v4C//v+CP/x/hv/q/63/gv/Df81/q7+Fv/8/tP+\
1v3R/gD/EP+6/qD+M/+h/rf+Ff/0/gj/+P4J//D+PP8ZAMb/2P7b/8b/9v7z/kr/1f/k/g7/+P4E//3+Af///gD///4C//v+CP/x/hv/K/63/gv/Dv8y/jL+\
Dv8L/zf+K/4b//H+iP77/gL///4A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP///gH//f4E/3j/Df/n/lH/\
Uf/n/g3/eP8E//3+Af///gD///4C//v+B//z/hn/r/6w/hj/9f6D/gP/9f4Y/7D+r/4Z//P+B/97/gL///4A/wD/AP8A/wD/AP8A/4D/AP8A/wD/AP8A///+\
Af/9/gT/+f4L/+v+Sf9f/8z+YP/G/3H///6x/yUAtf/1/gX//f4C///+Af///gD/AP8A/wD/AP8A/wD/AP8A///+Av/7/gj/8f4b/6v+t/4M/wz/tf6t/hf/\
ef77/hX/sf6u/hr/8f4K/3f+Cv/x/hr/r/6v/hn/8/4H//v+Av///oD+AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/\
AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP///gL/+/4I//H+G/+r/rf+DP8M/7f+K/4b//H+CP/7/gL/f/8A/wD/AP8A/wD/AP8A/wD/AP8A/4D/gP8A/4D/\
AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/\
AP8A/wD/AP8A/wD/AP8A/wD/\
').split('').map(c => c.charCodeAt(0))).buffer);

/*
 *
 *	Moon Cresta
 *
 */

let BG, RGB, PRG;

read('mooncrst.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG = Uint8Array.concat(...['mc1', 'mc2', 'mc3', 'mc4', 'mc5.7r', 'mc6.8d', 'mc7.8e', 'mc8'].map(e => zip.decompress(e))).addBase();
	BG = Uint8Array.concat(...['mcs_b', 'mcs_d', 'mcs_a', 'mcs_c'].map(e => zip.decompress(e)));
	RGB = zip.decompress('mmi6331.6l');
	game = new MoonCresta();
	sound = [
		new GalaxianSound({SND}),
		new SoundEffect({se: game.se, freq: 11025, gain: 0.5}),
	];
	canvas.addEventListener('click', () => game.coin());
	init({game, sound});
});

