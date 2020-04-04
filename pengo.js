/*
 *
 *	Pengo
 *
 */

import PacManSound from './pac-man_sound.js';
import {init, loop} from './main.js';
import Z80 from './z80.js';
let sound;

class Pengo {
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
		this.nLife = 3;
		this.nBonus = 30000;
		this.nRank = 'MEDIUM';

		// CPU周りの初期化
		this.ram = new Uint8Array(0x1100).addBase();
		this.in = Uint8Array.of(0xcc, 0xb0, 0xff, 0xff);
		this.fInterruptEnable = false;
		this.fSoundEnable = false;

		this.cpu = new Z80(this);
		for (let i = 0; i < 0x80; i++)
			this.cpu.memorymap[i].base = PRG.base[i];
		for (let i = 0; i < 0x10; i++) {
			this.cpu.memorymap[0x80 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x80 + i].write = null;
		}
		this.cpu.memorymap[0x90].read = addr => this.in[addr >> 6 & 3];
		this.cpu.memorymap[0x90].write = (addr, data) => {
			switch (addr >> 4 & 0xf) {
			case 0:
			case 1:
				return sound.write(addr, data);
			case 2:
				return void(this.ram[0x1020 | addr & 0xf] = data);
			case 4:
				switch (addr & 7) {
				case 0:
					return void(this.fInterruptEnable = (data & 1) !== 0);
				case 1:
					return void(this.fSoundEnable = (data & 1) !== 0);
				default:
					return void(this.ram[0x1040 | addr & 7] = data & 1);
				}
			}
		};

		// Videoの初期化
		this.bg = new Uint8Array(0x8000);
		this.obj = new Uint8Array(0x8000);
		this.color = Uint8Array.from(COLOR, e => e & 0xf);
		this.rgb = new Uint32Array(0x20);
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();
	}

	execute() {
		sound.mute(!this.fSoundEnable);
		if (this.fInterruptEnable)
			this.cpu.interrupt();
		this.cpu.execute(0x1600);
		return this;
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// DIPスイッチの更新
		if (this.fDIPSwitchChanged) {
			this.fDIPSwitchChanged = false;
			switch (this.nLife) {
			case 2:
				this.in[1] |= 0x18;
				break;
			case 3:
				this.in[1] = this.in[1] & ~0x18 | 0x10;
				break;
			case 4:
				this.in[1] = this.in[1] & ~0x18 | 0x08;
				break;
			case 5:
				this.in[1] &= ~0x18;
				break;
			}
			switch (this.nBonus) {
			case 30000:
				this.in[1] &= ~1;
				break;
			case 50000:
				this.in[1] |= 1;
				break;
			}
			switch (this.nRank) {
			case 'EASY':
				this.in[1] |= 0xc0;
				break;
			case 'MEDIUM':
				this.in[1] = this.in[1] & ~0xc0 | 0x80;
				break;
			case 'HARD':
				this.in[1] = this.in[1] & ~0xc0 | 0x40;
				break;
			case 'HARDEST':
				this.in[1] &= ~0xc0;
				break;
			}
			this.fReset = true;
		}

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
			this.in[3] &= ~(1 << 4);
		}
		else
			this.in[3] |= 1 << 4;
		if (this.fStart1P) {
			--this.fStart1P;
			this.in[2] &= ~(1 << 5);
		}
		else
			this.in[2] |= 1 << 5;
		if (this.fStart2P) {
			--this.fStart2P;
			this.in[2] &= ~(1 << 6);
		}
		else
			this.in[2] |= 1 << 6;
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
			this.in[3] = this.in[3] & ~(1 << 0) | 1 << 3;
			this.in[2] = this.in[2] & ~(1 << 0) | 1 << 3;
		}
		else {
			this.in[3] |= 1 << 0;
			this.in[2] |= 1 << 0;
		}
	}

	right(fDown) {
		if (fDown) {
			this.in[3] = this.in[3] & ~(1 << 3) | 1 << 2;
			this.in[2] = this.in[2] & ~(1 << 3) | 1 << 2;
		}
		else {
			this.in[3] |= 1 << 3;
			this.in[2] |= 1 << 3;
		}
	}

	down(fDown) {
		if (fDown) {
			this.in[3] = this.in[3] & ~(1 << 1) | 1 << 0;
			this.in[2] = this.in[2] & ~(1 << 1) | 1 << 0;
		}
		else {
			this.in[3] |= 1 << 1;
			this.in[2] |= 1 << 1;
		}
	}

	left(fDown) {
		if (fDown) {
			this.in[3] = this.in[3] & ~(1 << 2) | 1 << 3;
			this.in[2] = this.in[2] & ~(1 << 2) | 1 << 3;
		}
		else {
			this.in[3] |= 1 << 2;
			this.in[2] |= 1 << 2;
		}
	}

	triggerA(fDown) {
		if (fDown) {
			this.in[3] &= ~(1 << 7);
			this.in[2] &= ~(1 << 7);
		}
		else {
			this.in[3] |= 1 << 7;
			this.in[2] |= 1 << 7;
		}
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
		for (let p = 0, q = 0, i = 512; i !== 0; q += 16, --i) {
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k + 8] >> j & 1 | BG[q + k + 8] >> (j + 3) & 2;
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k] >> j & 1 | BG[q + k] >> (j + 3) & 2;
		}
	}

	convertOBJ() {
		for (let p = 0, q = 0, i = 128; i !== 0; q += 64, --i) {
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
		for (let p = 0x0ffe, i = 7; i !== 0; p -= 2, --i) {
			const x = (~this.ram[p + 0x30] - (i < 3)) & 0xff;
			if (x === 0 || x >= 240)
				continue;
			const y = (-this.ram[p + 0x31] & 0xff) + 32;
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
				data[p] = this.rgb[data[p] | this.ram[0x1042] << 4];
	}

	xfer8x8(data, p, k) {
		const q = this.ram[k] << 6 | this.ram[0x1047] << 14, idx = this.ram[k + 0x400] << 2 & 0x7c | this.ram[0x1046] << 7;

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
		const idx = src >> 6 & 0x7c | this.ram[0x1046] << 7, h = 288 - (dst >> 8);
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (h >= 16) {
			src = src << 6 & 0x3f00 | this.ram[0x1047] << 14;
			for (let i = 16; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx | this.obj[src++]]) !== 0)
						data[dst] = px;
		}
		else {
			src = src << 6 & 0x3f00 | this.ram[0x1047] << 14;
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
		const idx = src >> 6 & 0x7c | this.ram[0x1046] << 7, h = 288 - (dst >> 8);
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (h >= 16) {
			src = (src << 6 & 0x3f00 | this.ram[0x1047] << 14) + 256 - 16;
			for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx | this.obj[src++]]) !== 0)
						data[dst] = px;
		}
		else {
			src = (src << 6 & 0x3f00 | this.ram[0x1047] << 14) + 256 - 16;
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
		const idx = src >> 6 & 0x7c | this.ram[0x1046] << 7, h = 288 - (dst >> 8);
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (h >= 16) {
			src = (src << 6 & 0x3f00 | this.ram[0x1047] << 14) + 16;
			for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx | this.obj[--src]]) !== 0)
						data[dst] = px;
		}
		else {
			src = (src << 6 & 0x3f00 | this.ram[0x1047] << 14) + 16;
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
		const idx = src >> 6 & 0x7c | this.ram[0x1046] << 7, h = 288 - (dst >> 8);
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (h >= 16) {
			src = (src << 6 & 0x3f00 | this.ram[0x1047] << 14) + 256;
			for (let i = 16; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx | this.obj[--src]]) !== 0)
						data[dst] = px;
		}
		else {
			src = (src << 6 & 0x3f00 | this.ram[0x1047] << 14) + 256;
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
 *	Pengo
 *
 */

const url = 'pengo.zip';
let BG, COLOR, OBJ, RGB, PRG, SND;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG = zip.files['pengo3u/ep5120.8'].inflate() + zip.files['pengo3u/ep5121.7'].inflate() + zip.files['pengo3u/ep5122.15'].inflate() + zip.files['pengo3u/ep5123.14'].inflate() + zip.files['pengo2u/ep5124.21'].inflate();
	PRG = new Uint8Array((PRG + zip.files['pengo3u/ep5125.20'].inflate() + zip.files['pengo2u/ep5126.32'].inflate() + zip.files['pengo3u/ep5127.31'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	BG = new Uint8Array((zip.files['ep1640.92'].inflate().substring(0, 0x1000) + zip.files['ep1695.105'].inflate().substring(0, 0x1000)).split('').map(c => c.charCodeAt(0)));
	OBJ = new Uint8Array((zip.files['ep1640.92'].inflate().substring(0x1000) + zip.files['ep1695.105'].inflate().substring(0x1000)).split('').map(c => c.charCodeAt(0)));
	RGB = new Uint8Array(zip.files['pr1633.78'].inflate().split('').map(c => c.charCodeAt(0)));
	COLOR = new Uint8Array(zip.files['pr1634.88'].inflate().split('').map(c => c.charCodeAt(0)));
	SND = new Uint8Array(zip.files['pr1635.51'].inflate().split('').map(c => c.charCodeAt(0)));
	init({
		game: new Pengo(),
		sound: sound = new PacManSound({SND}),
	});
	loop();
}

