/*
 *
 *	Galaxian
 *
 */

import GalaxianSound from './galaxian_sound.js';
import SoundEffect from './sound_effect.js';
import {seq, rseq, convertGFX, Timer} from './utils.js';
import {init, expand} from './main.js';
import Z80 from './z80.js';
let game, sound;

class Galaxian {
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
	nGalaxip = 3;
	nBonus = 'B';

	fInterruptEnable = false;
	mode = 0;
	ram = new Uint8Array(0x900).addBase();
	mmo = new Uint8Array(0x100);
	ioport = new Uint8Array(0x100);

	stars = [];
	fStarEnable = false;
	fStarMove = false;
	bg = new Uint8Array(0x4000).fill(3);
	obj = new Uint8Array(0x4000).fill(3);
	rgb = new Int32Array(0x80);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;

	se;

	cpu = new Z80(Math.floor(18432000 / 6));
	timer = new Timer(60);

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x28; i++)
			this.cpu.memorymap[i].base = PRG.base[i];
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0x40 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x40 + i].write = null;
			this.cpu.memorymap[0x50 + i].base = this.ram.base[4 + i];
			this.cpu.memorymap[0x50 + i].write = null;
		}
		this.cpu.memorymap[0x58].base = this.ram.base[8];
		this.cpu.memorymap[0x58].write = null;
		this.cpu.memorymap[0x60].base = this.ioport;
		this.cpu.memorymap[0x60].write = (addr, data) => { this.mmo[addr & 7] = data & 1; };
		this.cpu.memorymap[0x68].base = this.ioport.subarray(0x10);
		this.cpu.memorymap[0x68].write = (addr, data) => {
			switch (addr & 7) {
			case 3: // BOMB
				data & 1 && (this.se[0].start = this.se[0].stop = true);
				break;
			case 5: // SHOT
				data & 1 && !this.mmo[0x15] && (this.se[1].start = this.se[1].stop = true);
				break;
			case 7: // SOUND VOICE/FREQUENCY
				sound[0].set_reg17(data);
				break;
			}
			this.mmo[addr & 7 | 0x10] = data & 1;
		};
		this.cpu.memorymap[0x70].base = this.ioport.subarray(0x20);
		this.cpu.memorymap[0x70].write = (addr, data) => {
			switch (addr & 7) {
			case 1:
				this.fInterruptEnable = (data & 1) !== 0;
				break;
			case 4:
				this.fStarEnable = (data & 1) !== 0, sound[0].control(data & 1);
				break;
			}
			this.mmo[addr & 7 | 0x20] = data & 1;
		};
		this.cpu.memorymap[0x78].write = (addr, data) => { sound[0].set_reg30(data), this.mmo[0x30] = data; }; // SOUND FREQUENCY

		this.cpu.breakpoint = (addr) => {
			switch (addr) {
			case 0x18c3:
				return void(!this.ram[0x07] && this.emulateWave(this.ram[0x021f]));
			case 0x1cc1:
				return this.emulateWave(0);
			}
		};
		this.cpu.set_breakpoint(0x18c3);
		this.cpu.set_breakpoint(0x1cc1);

		// Videoの初期化
		convertGFX(this.bg, BG, 256, rseq(8, 0, 8), seq(8), [0, BG.length * 4], 8);
		convertGFX(this.obj, BG, 64, rseq(8, 128, 8).concat(rseq(8, 0, 8)), seq(8).concat(seq(8, 64)), [0, BG.length * 4], 32);
		for (let i = 0; i < 0x20; i++)
			this.rgb[i] = 0xff000000 | (RGB[i] >> 6) * 255 / 3 << 16 | (RGB[i] >> 3 & 7) * 255 / 7 << 8 | (RGB[i] & 7) * 255 / 7;
		const starColors = [0xd0, 0x70, 0x40, 0x00];
		for (let i = 0; i < 0x40; i++)
			this.rgb[0x40 | i] = 0xff000000 | starColors[i >> 4 & 3] << 16 | starColors[i >> 2 & 3] << 8 | starColors[i & 3];
		for (let i = 0; i < 1024; i++)
			this.stars.push({x: 0, y: 0, color: 0});
		this.initializeStar();

		// 効果音の初期化
		const table = [BOMB, SHOT, WAVE0001, WAVE0010, WAVE0011, WAVE0100, WAVE0101, WAVE0110, WAVE0111, WAVE1000, WAVE1001, WAVE1010, WAVE1011, WAVE1100, WAVE1101, WAVE1110, WAVE1111];
		this.se = table.map(buf => ({freq: 11025, buf, loop: true, start: false, stop: false}));
		this.se[0].loop = this.se[1].loop = false;
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.timer.execute(tick_rate, () => { this.moveStars(), update(), this.fInterruptEnable && this.cpu.non_maskable_interrupt(); });
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
			switch (this.nGalaxip) {
			case 3:
				this.ioport[0x20] &= 0xfb;
				break;
			case 5:
				this.ioport[0x20] |= 0x04;
				break;
			}
			switch (this.nBonus) {
			case 'NONE':
				this.ioport[0x20] &= 0xfc;
				break;
			case 'A':
				this.ioport[0x20] = this.ioport[0x20] & 0xfc | 0x01;
				break;
			case 'B':
				this.ioport[0x20] = this.ioport[0x20] & 0xfc | 0x02;
				break;
			case 'C':
				this.ioport[0x20] |= 0x03;
				break;
			}
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.ioport[0] |= 0x40;
		else
			this.ioport[0] &= 0xbf;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.se.forEach(se => se.stop = true);
			this.cpu.reset();
			this.fInterruptEnable = false;
		}
		return this;
	}

	emulateWave(_mode) {
		if (_mode === this.mode)
			return;
		if (this.mode)
			this.se[this.mode + 1].stop = true;
		if (_mode)
			this.se[_mode + 1].start = true;
		this.mode = _mode;
	}

	updateInput() {
		this.ioport[0] = this.ioport[0] & ~(1 << 0) | !!this.fCoin << 0;
		this.ioport[0x10] = this.ioport[0x10] & ~3 | !!this.fStart1P << 0 | !!this.fStart2P << 1;
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

	right(fDown) {
		this.ioport[0] = this.ioport[0] & ~(1 << 3 | fDown << 2) | fDown << 3;
	}

	left(fDown) {
		this.ioport[0] = this.ioport[0] & ~(1 << 2 | fDown << 3) | fDown << 2;
	}

	triggerA(fDown) {
		this.ioport[0] = this.ioport[0] & ~(1 << 4) | fDown << 4;
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
		for (let k = 0x840, i = 8; i !== 0; k += 4, --i) {
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

		// bullets描画
		for (let k = 0x860, i = 0; i < 8; k += 4, i++) {
			p = this.ram[k + 1] | 267 - this.ram[k + 3] << 8;
			this.bitmap[p + 0x300] = this.bitmap[p + 0x200] = this.bitmap[p + 0x100] = this.bitmap[p] = i > 6 ? 7 : 3;
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
 *	Galaxian
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
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\
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

const WAVE0001 = new Int16Array(new Uint8Array(window.atob('\
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\
').split('').map(c => c.charCodeAt(0))).buffer);

const WAVE0010 = new Int16Array(new Uint8Array(window.atob('\
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\
').split('').map(c => c.charCodeAt(0))).buffer);

const WAVE0011 = new Int16Array(new Uint8Array(window.atob('\
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\
').split('').map(c => c.charCodeAt(0))).buffer);

const WAVE0100 = new Int16Array(new Uint8Array(window.atob('\
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\
').split('').map(c => c.charCodeAt(0))).buffer);

const WAVE0101 = new Int16Array(new Uint8Array(window.atob('\
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\
').split('').map(c => c.charCodeAt(0))).buffer);

const WAVE0110 = new Int16Array(new Uint8Array(window.atob('\
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\
').split('').map(c => c.charCodeAt(0))).buffer);

const WAVE0111 = new Int16Array(new Uint8Array(window.atob('\
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\
Ffvt+sD7Gfzn+w==\
').split('').map(c => c.charCodeAt(0))).buffer);

const WAVE1000 = new Int16Array(new Uint8Array(window.atob('\
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\
tPZW9wD4OPgg+eT4zfkC+rP6Ivs=\
').split('').map(c => c.charCodeAt(0))).buffer);

const WAVE1001 = new Int16Array(new Uint8Array(window.atob('\
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\
').split('').map(c => c.charCodeAt(0))).buffer);

const WAVE1010 = new Int16Array(new Uint8Array(window.atob('\
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\
').split('').map(c => c.charCodeAt(0))).buffer);

const WAVE1011 = new Int16Array(new Uint8Array(window.atob('\
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\
').split('').map(c => c.charCodeAt(0))).buffer);

const WAVE1100 = new Int16Array(new Uint8Array(window.atob('\
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\
').split('').map(c => c.charCodeAt(0))).buffer);

const WAVE1101 = new Int16Array(new Uint8Array(window.atob('\
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\
').split('').map(c => c.charCodeAt(0))).buffer);

const WAVE1110 = new Int16Array(new Uint8Array(window.atob('\
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\
').split('').map(c => c.charCodeAt(0))).buffer);

const WAVE1111 = new Int16Array(new Uint8Array(window.atob('\
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\
').split('').map(c => c.charCodeAt(0))).buffer);

/*
 *
 *	Galaxian
 *
 */

import {ROM} from "./dist/galaxian.png.js";
let BG, RGB, PRG;

window.addEventListener('load', () => expand(ROM).then(ROM => {
	PRG = new Uint8Array(ROM.buffer, 0x0, 0x2800).addBase();
	BG = new Uint8Array(ROM.buffer, 0x2800, 0x1000);
	RGB = new Uint8Array(ROM.buffer, 0x3800, 0x20);
	game = new Galaxian();
	sound = [
		new GalaxianSound({SND}),
		new SoundEffect({se: game.se, gain: 0.5}),
	];
	canvas.addEventListener('click', () => game.coin(true));
	init({game, sound});
}));

