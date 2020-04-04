/*
 *
 *	Pac-Man
 *
 */

import PacManSound from './pac-man_sound.js';
import {init, loop} from './main.js';
import Z80 from './z80.js';
let sound;

class PacMan {
	constructor() {
		this.cxScreen = 224;
		this.cyScreen = 288;
		this.width = 256;
		this.height = 512;
		this.xOffset = 16;
		this.yOffset = 16;
		this.fReset = false;
		this.fTest = false;
		this.fDIPSwitchChanged = true;
		this.fCoin = 0;
		this.fStart1P = 0;
		this.fStart2P = 0;
		this.nPacman = 3;
		this.nBonus = 10000;

		// CPU周りの初期化
		this.ram = new Uint8Array(0xd00).addBase();
		this.in = Uint8Array.of(0xff, 0xff, 0xc9, 0x00);
		this.vector = 0;
		this.fInterruptEnable = false;
		this.fSoundEnable = false;

		const range = (page, start, end, mirror = 0) => (page & ~mirror) >= start && (page & ~mirror) <= end;

		this.cpu = new Z80(this);
		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0x3f, 0x80))
				this.cpu.memorymap[page].base = PRG.base[page & 0x3f];
			else if (range(page, 0x40, 0x47, 0xa0)) {
				this.cpu.memorymap[page].base = this.ram.base[page & 7];
				this.cpu.memorymap[page].write = null;
			}
			else if (range(page, 0x48, 0x48, 0xa3))
				this.cpu.memorymap[page].read = () => 0xbf;
			else if (range(page, 0x4c, 0x4f, 0xa0)) {
				this.cpu.memorymap[page].base = this.ram.base[8 | page & 3];
				this.cpu.memorymap[page].write = null;
			}
			else if (range(page, 0x50, 0x50, 0xaf)) {
				this.cpu.memorymap[page].read = addr => this.in[addr >> 6 & 3];
				this.cpu.memorymap[page].write = (addr, data) => {
					switch (addr >> 4 & 0xf) {
					case 0:
						switch (addr & 7) {
						case 0:
							return void(this.fInterruptEnable = (data & 1) !== 0);
						case 1:
							return void(this.fSoundEnable = (data & 1) !== 0);
						}
						return;
					case 4:
					case 5:
						return sound.write(addr, data);
					case 6:
						return void(this.ram[0xc60 | addr & 0xf] = data);
					}
				};
			}
		for (let page = 0; page < 0x100; page++)
			this.cpu.iomap[page].write = (addr, data) => void((addr & 0xff) === 0 && (this.vector = data));

		// Videoの初期化
		this.bg = new Uint8Array(0x4000);
		this.obj = new Uint8Array(0x4000);
		this.color = Uint8Array.from(COLOR, e => e & 0xf);
		this.rgb = new Uint32Array(0x20);
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();
	}

	execute() {
		sound.mute(!this.fSoundEnable);
		if (this.fInterruptEnable)
			this.cpu.interrupt(this.vector);
		this.cpu.execute(0x2000);
		if (this.cpu.fActive && !this.cpu.fSuspend && this.cpu.iff === 3)
			this.cpu.execute(0x1400);
		return this;
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// DIPスイッチの更新
		if (this.fDIPSwitchChanged) {
			this.fDIPSwitchChanged = false;
			switch (this.nPacman) {
			case 1:
				this.in[2] &= 0xf3;
				break;
			case 2:
				this.in[2] = this.in[2] & 0xf3 | 0x04;
				break;
			case 3:
				this.in[2] = this.in[2] & 0xf3 | 0x08;
				break;
			case 5:
				this.in[2] |= 0x0c;
				break;
			}
			switch (this.nBonus) {
			case 10000:
				this.in[2] &= 0xcf;
				break;
			case 15000:
				this.in[2] = this.in[2] & 0xcf | 0x10;
				break;
			case 20000:
				this.in[2] = this.in[2] & 0xcf | 0x20;
				break;
			case 'NONE':
				this.in[2] |= 0x30;
				break;
			}
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.in[1] &= 0xef;
		else
			this.in[1] |= 0x10;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu.reset();
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if (this.fCoin) {
			--this.fCoin;
			this.in[0] &= ~(1 << 5);
		}
		else
			this.in[0] |= 1 << 5;
		if (this.fStart1P) {
			--this.fStart1P;
			this.in[1] &= ~(1 << 5);
		}
		else
			this.in[1] |= 1 << 5;
		if (this.fStart2P) {
			--this.fStart2P;
			this.in[1] &= ~(1 << 6);
		}
		else
			this.in[1] |= 1 << 6;
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
		if (fDown) {
			this.in[0] = this.in[0] & ~(1 << 0) | 1 << 3;
			this.in[1] = this.in[0] & ~(1 << 0) | 1 << 3;
		}
		else {
			this.in[0] |= 1 << 0;
			this.in[1] |= 1 << 0;
		}
	}

	right(fDown) {
		if (fDown) {
			this.in[0] = this.in[0] & ~(1 << 2) | 1 << 1;
			this.in[1] = this.in[1] & ~(1 << 2) | 1 << 1;
		}
		else {
			this.in[0] |= 1 << 2;
			this.in[1] |= 1 << 2;
		}
	}

	down(fDown) {
		if (fDown) {
			this.in[0] = this.in[0] & ~(1 << 3) | 1 << 0;
			this.in[1] = this.in[1] & ~(1 << 3) | 1 << 0;
		}
		else {
			this.in[0] |= 1 << 3;
			this.in[1] |= 1 << 3;
		}
	}

	left(fDown) {
		if (fDown) {
			this.in[0] = this.in[0] & ~(1 << 1) | 1 << 2;
			this.in[1] = this.in[1] & ~(1 << 1) | 1 << 2;
		}
		else {
			this.in[0] |= 1 << 1;
			this.in[1] |= 1 << 1;
		}
	}

	triggerA(fDown) {
	}

	triggerB(fDown) {
	}

	convertRGB() {
		for (let i = 0; i < 0x20; i++)
			this.rgb[i] = (RGB[i] & 7) * 255 / 7	// Red
				| (RGB[i] >> 3 & 7) * 255 / 7 << 8	// Green
				| (RGB[i] >> 6) * 255 / 3 << 16		// Blue
				| 0xff000000;						// Alpha
	}

	convertBG() {
		for (let p = 0, q = 0, i = 256; i !== 0; q += 16, --i) {
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k + 8] >> j & 1 | BG[q + k + 8] >> (j + 3) & 2;
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k] >> j & 1 | BG[q + k] >> (j + 3) & 2;
		}
	}

	convertOBJ() {
		for (let p = 0, q = 0, i = 64; i !== 0; q += 64, --i) {
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 40] >> j & 1 | OBJ[q + k + 40] >> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 8] >> j & 1 | OBJ[q + k + 8] >> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 48] >> j & 1 | OBJ[q + k + 48] >> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 16] >> j & 1 | OBJ[q + k + 16] >> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 56] >> j & 1 | OBJ[q + k + 56] >> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 24] >> j & 1 | OBJ[q + k + 24] >> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 32] >> j & 1 | OBJ[q + k + 32] >> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k] >> j & 1 | OBJ[q + k] >> (j + 3) & 2;
			}
		}
	}

	makeBitmap(data) {
		// bg描画
		let p = 256 * 8 * 4 + 232;
		let k = 0x40;
		for (let i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				this.xfer8x8(data, p, k);
		p = 256 * 8 * 36 + 232;
		k = 2;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k);
		p = 256 * 8 * 37 + 232;
		k = 0x22;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k);
		p = 256 * 8 * 2 + 232;
		k = 0x3c2;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k);
		p = 256 * 8 * 3 + 232;
		k = 0x3e2;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k);

		// obj描画
		for (let p = 0x0bfe, i = 7; i !== 0; p -= 2, --i) {
			const x = (~this.ram[p + 0x70] - (i < 3)) & 0xff;
			if (x === 0 || x >= 240)
				continue;
			const y = (-this.ram[p + 0x71] & 0xff) + 32;
			switch (this.ram[p] & 3) {
			case 0: // ノーマル
				this.xfer16x16(data, x | y << 8, this.ram[p] | this.ram[p + 1] << 8);
				break;
			case 1: // V反転
				this.xfer16x16V(data, x | y << 8, this.ram[p] | this.ram[p + 1] << 8);
				break;
			case 2: // H反転
				this.xfer16x16H(data, x | y << 8, this.ram[p] | this.ram[p + 1] << 8);
				break;
			case 3: // HV反転
				this.xfer16x16HV(data, x | y << 8, this.ram[p] | this.ram[p + 1] << 8);
				break;
			}
		}

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] |= this.rgb[data[p]];
	}

	xfer8x8(data, p, k) {
		const q = this.ram[k] << 6, idx = this.ram[k + 0x400] << 2 & 0x7c;

		data[p + 0x000] = this.color[idx | this.bg[q + 0x00]];
		data[p + 0x001] = this.color[idx | this.bg[q + 0x01]];
		data[p + 0x002] = this.color[idx | this.bg[q + 0x02]];
		data[p + 0x003] = this.color[idx | this.bg[q + 0x03]];
		data[p + 0x004] = this.color[idx | this.bg[q + 0x04]];
		data[p + 0x005] = this.color[idx | this.bg[q + 0x05]];
		data[p + 0x006] = this.color[idx | this.bg[q + 0x06]];
		data[p + 0x007] = this.color[idx | this.bg[q + 0x07]];
		data[p + 0x100] = this.color[idx | this.bg[q + 0x08]];
		data[p + 0x101] = this.color[idx | this.bg[q + 0x09]];
		data[p + 0x102] = this.color[idx | this.bg[q + 0x0a]];
		data[p + 0x103] = this.color[idx | this.bg[q + 0x0b]];
		data[p + 0x104] = this.color[idx | this.bg[q + 0x0c]];
		data[p + 0x105] = this.color[idx | this.bg[q + 0x0d]];
		data[p + 0x106] = this.color[idx | this.bg[q + 0x0e]];
		data[p + 0x107] = this.color[idx | this.bg[q + 0x0f]];
		data[p + 0x200] = this.color[idx | this.bg[q + 0x10]];
		data[p + 0x201] = this.color[idx | this.bg[q + 0x11]];
		data[p + 0x202] = this.color[idx | this.bg[q + 0x12]];
		data[p + 0x203] = this.color[idx | this.bg[q + 0x13]];
		data[p + 0x204] = this.color[idx | this.bg[q + 0x14]];
		data[p + 0x205] = this.color[idx | this.bg[q + 0x15]];
		data[p + 0x206] = this.color[idx | this.bg[q + 0x16]];
		data[p + 0x207] = this.color[idx | this.bg[q + 0x17]];
		data[p + 0x300] = this.color[idx | this.bg[q + 0x18]];
		data[p + 0x301] = this.color[idx | this.bg[q + 0x19]];
		data[p + 0x302] = this.color[idx | this.bg[q + 0x1a]];
		data[p + 0x303] = this.color[idx | this.bg[q + 0x1b]];
		data[p + 0x304] = this.color[idx | this.bg[q + 0x1c]];
		data[p + 0x305] = this.color[idx | this.bg[q + 0x1d]];
		data[p + 0x306] = this.color[idx | this.bg[q + 0x1e]];
		data[p + 0x307] = this.color[idx | this.bg[q + 0x1f]];
		data[p + 0x400] = this.color[idx | this.bg[q + 0x20]];
		data[p + 0x401] = this.color[idx | this.bg[q + 0x21]];
		data[p + 0x402] = this.color[idx | this.bg[q + 0x22]];
		data[p + 0x403] = this.color[idx | this.bg[q + 0x23]];
		data[p + 0x404] = this.color[idx | this.bg[q + 0x24]];
		data[p + 0x405] = this.color[idx | this.bg[q + 0x25]];
		data[p + 0x406] = this.color[idx | this.bg[q + 0x26]];
		data[p + 0x407] = this.color[idx | this.bg[q + 0x27]];
		data[p + 0x500] = this.color[idx | this.bg[q + 0x28]];
		data[p + 0x501] = this.color[idx | this.bg[q + 0x29]];
		data[p + 0x502] = this.color[idx | this.bg[q + 0x2a]];
		data[p + 0x503] = this.color[idx | this.bg[q + 0x2b]];
		data[p + 0x504] = this.color[idx | this.bg[q + 0x2c]];
		data[p + 0x505] = this.color[idx | this.bg[q + 0x2d]];
		data[p + 0x506] = this.color[idx | this.bg[q + 0x2e]];
		data[p + 0x507] = this.color[idx | this.bg[q + 0x2f]];
		data[p + 0x600] = this.color[idx | this.bg[q + 0x30]];
		data[p + 0x601] = this.color[idx | this.bg[q + 0x31]];
		data[p + 0x602] = this.color[idx | this.bg[q + 0x32]];
		data[p + 0x603] = this.color[idx | this.bg[q + 0x33]];
		data[p + 0x604] = this.color[idx | this.bg[q + 0x34]];
		data[p + 0x605] = this.color[idx | this.bg[q + 0x35]];
		data[p + 0x606] = this.color[idx | this.bg[q + 0x36]];
		data[p + 0x607] = this.color[idx | this.bg[q + 0x37]];
		data[p + 0x700] = this.color[idx | this.bg[q + 0x38]];
		data[p + 0x701] = this.color[idx | this.bg[q + 0x39]];
		data[p + 0x702] = this.color[idx | this.bg[q + 0x3a]];
		data[p + 0x703] = this.color[idx | this.bg[q + 0x3b]];
		data[p + 0x704] = this.color[idx | this.bg[q + 0x3c]];
		data[p + 0x705] = this.color[idx | this.bg[q + 0x3d]];
		data[p + 0x706] = this.color[idx | this.bg[q + 0x3e]];
		data[p + 0x707] = this.color[idx | this.bg[q + 0x3f]];
	}

	xfer16x16(data, dst, src) {
		const idx = src >> 6 & 0x7c, h = 288 - (dst >> 8);
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (h >= 16) {
			src = src << 6 & 0x3f00;
			for (let i = 16; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx | this.obj[src++]]) !== 0)
						data[dst] = px;
		}
		else {
			src = src << 6 & 0x3f00;
			for (let i = h; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx | this.obj[src++]]) !== 0)
						data[dst] = px;
			dst -= 0x10000;
			for (let i = 16 - h; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx | this.obj[src++]]) !== 0)
						data[dst] = px;
		}
	}

	xfer16x16V(data, dst, src) {
		const idx = src >> 6 & 0x7c, h = 288 - (dst >> 8);
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (h >= 16) {
			src = (src << 6 & 0x3f00) + 256 - 16;
			for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx | this.obj[src++]]) !== 0)
						data[dst] = px;
		}
		else {
			src = (src << 6 & 0x3f00) + 256 - 16;
			for (let i = h; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx | this.obj[src++]]) !== 0)
						data[dst] = px;
			dst -= 0x10000;
			for (let i = 16 - h; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx | this.obj[src++]]) !== 0)
						data[dst] = px;
		}
	}

	xfer16x16H(data, dst, src) {
		const idx = src >> 6 & 0x7c, h = 288 - (dst >> 8);
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (h >= 16) {
			src = (src << 6 & 0x3f00) + 16;
			for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx | this.obj[--src]]) !== 0)
						data[dst] = px;
		}
		else {
			src = (src << 6 & 0x3f00) + 16;
			for (let i = h; i !== 0; dst += 256 - 16, src += 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx | this.obj[--src]]) !== 0)
						data[dst] = px;
			dst -= 0x10000;
			for (let i = 16 - h; i !== 0; dst += 256 - 16, src += 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx | this.obj[--src]]) !== 0)
						data[dst] = px;
		}
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >> 6 & 0x7c, h = 288 - (dst >> 8);
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (h >= 16) {
			src = (src << 6 & 0x3f00) + 256;
			for (let i = 16; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx | this.obj[--src]]) !== 0)
						data[dst] = px;
		}
		else {
			src = (src << 6 & 0x3f00) + 256;
			for (let i = h; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx | this.obj[--src]]) !== 0)
						data[dst] = px;
			dst -= 0x10000;
			for (let i = 16 - h; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx | this.obj[--src]]) !== 0)
						data[dst] = px;
		}
	}
}

/*
 *
 *	Pac-Man
 *
 */

const url = 'puckman.zip';
let BG, COLOR, OBJ, RGB, PRG, SND;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG = zip.files['pm1_prg1.6e'].inflate() + zip.files['pm1_prg2.6k'].inflate() + zip.files['pm1_prg3.6f'].inflate() + zip.files['pm1_prg4.6m'].inflate() + zip.files['pm1_prg5.6h'].inflate();
	PRG = new Uint8Array((PRG + zip.files['pm1_prg6.6n'].inflate() + zip.files['pm1_prg7.6j'].inflate() + zip.files['pm1_prg8.6p'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	BG = new Uint8Array((zip.files['pm1_chg1.5e'].inflate() + zip.files['pm1_chg2.5h'].inflate()).split('').map(c => c.charCodeAt(0)));
	OBJ = new Uint8Array((zip.files['pm1_chg3.5f'].inflate() + zip.files['pm1_chg4.5j'].inflate()).split('').map(c => c.charCodeAt(0)));
	RGB = new Uint8Array(zip.files['pm1-1.7f'].inflate().split('').map(c => c.charCodeAt(0)));
	COLOR = new Uint8Array(zip.files['pm1-4.4a'].inflate().split('').map(c => c.charCodeAt(0)));
	SND = new Uint8Array(zip.files['pm1-3.1m'].inflate().split('').map(c => c.charCodeAt(0)));
	init({
		game: new PacMan(),
		sound: sound = new PacManSound({SND}),
	});
	loop();
}

