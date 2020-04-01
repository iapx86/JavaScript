/*
 *
 *	Jr. Pac-Man
 *
 */

import PacManSound from './pac-man_sound.js';
import {init, loop} from './main.js';
import Z80 from './z80.js';
let sound;

class JrPacMan {
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
		this.nRank = 'NORMAL';

		// CPU周りの初期化
		this.ram = new Uint8Array(0x1100).fill(0xff).fill(1, 0x1070, 0x1078).addBase();
		this.in = Uint8Array.of(0xff, 0xff, 0xc9, 0x00);
		this.vector = 0;
		this.fInterruptEnable = false;
		this.fSoundEnable = false;

		this.cpu = new Z80(this);
		for (let i = 0; i < 0x40; i++)
			this.cpu.memorymap[i].base = PRG.base[i];
		for (let i = 0; i < 0x10; i++) {
			this.cpu.memorymap[0x40 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x40 + i].write = null;
		}
		this.cpu.memorymap[0x50].read = addr => this.in[addr >> 6 & 3];
		this.cpu.memorymap[0x50].write = (addr, data) => {
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
				return void(this.ram[0x1060 | addr & 0xf] = data);
			case 7:
				return void(this.ram[0x1070 | addr & 7] = data & 1);
			case 8:
				return void(this.dwScroll = data);
			}
		};
		for (let i = 0; i < 0x60; i++)
			this.cpu.memorymap[0x80 + i].base = PRG.base[0x40 + i];
		for (let i = 0; i < 0x100; i++)
			this.cpu.iomap[i].write = (addr, data) => void((addr & 0xff) === 0 && (this.vector = data));

		// Videoの初期化
		this.dwScroll = 0;
		this.bg = new Uint8Array(0x8000);
		this.obj = new Uint8Array(0x8000);
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
				this.in[2] &= ~0x0c;
				break;
			case 2:
				this.in[2] = this.in[2] & ~0x0c | 0x04;
				break;
			case 3:
				this.in[2] = this.in[2] & ~0x0c | 0x08;
				break;
			case 5:
				this.in[2] |= 0x0c;
				break;
			}
			switch (this.nBonus) {
			case 10000:
				this.in[2] &= ~0x30;
				break;
			case 15000:
				this.in[2] = this.in[2] & ~0x30 | 0x10;
				break;
			case 20000:
				this.in[2] = this.in[2] & ~0x30 | 0x20;
				break;
			case 30000:
				this.in[2] |= 0x30;
				break;
			}
			switch (this.nRank) {
			case 'HARD':
				this.in[2] &= ~0x40;
				break;
			case 'NORMAL':
				this.in[2] |= 0x40;
				break;
			}
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.in[1] &= ~0x10;
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
			this.rgb[i] = ((RGB_H[i] << 4 | RGB_L[i]) & 7) * 255 / 7	// Red
				| ((RGB_H[i] << 4 | RGB_L[i]) >> 3 & 7) * 255 / 7 << 8	// Green
				| ((RGB_H[i] << 4 | RGB_L[i]) >> 6) * 255 / 3 << 16		// Blue
				| 0xff000000;											// Alpha
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

	static patchROM() {
		const table = [
			[0x00C1, 0x00], [0x0002, 0x80], [0x0004, 0x00], [0x0006, 0x80],
			[0x0003, 0x00], [0x0002, 0x80], [0x0009, 0x00], [0x0004, 0x80],
			[0x5968, 0x00], [0x0001, 0x80], [0x0002, 0x00], [0x0001, 0x80],
			[0x0009, 0x00], [0x0002, 0x80], [0x0009, 0x00], [0x0001, 0x80],
			[0x00AF, 0x00], [0x000E, 0x04], [0x0002, 0x00], [0x0004, 0x04],
			[0x001E, 0x00], [0x0001, 0x80], [0x0002, 0x00], [0x0001, 0x80],
			[0x0002, 0x00], [0x0002, 0x80], [0x0009, 0x00], [0x0002, 0x80],
			[0x0009, 0x00], [0x0002, 0x80], [0x0083, 0x00], [0x0001, 0x04],
			[0x0001, 0x01], [0x0001, 0x00], [0x0002, 0x05], [0x0001, 0x00],
			[0x0003, 0x04], [0x0003, 0x01], [0x0002, 0x00], [0x0001, 0x04],
			[0x0003, 0x01], [0x0003, 0x00], [0x0003, 0x04], [0x0001, 0x01],
			[0x002E, 0x00], [0x0078, 0x01], [0x0001, 0x04], [0x0001, 0x05],
			[0x0001, 0x00], [0x0001, 0x01], [0x0001, 0x04], [0x0002, 0x00],
			[0x0001, 0x01], [0x0001, 0x04], [0x0002, 0x00], [0x0001, 0x01],
			[0x0001, 0x04], [0x0002, 0x00], [0x0001, 0x01], [0x0001, 0x04],
			[0x0001, 0x05], [0x0001, 0x00], [0x0001, 0x01], [0x0001, 0x04],
			[0x0002, 0x00], [0x0001, 0x01], [0x0001, 0x04], [0x0002, 0x00],
			[0x0001, 0x01], [0x0001, 0x04], [0x0001, 0x05], [0x0001, 0x00],
			[0x01B0, 0x01], [0x0001, 0x00], [0x0002, 0x01], [0x00AD, 0x00],
			[0x0031, 0x01], [0x005C, 0x00], [0x0005, 0x01], [0x204E, 0x00]
		];
		if ("patched" in JrPacMan)
			return;
		for (let addr = 0, i = 0, n = table.length; i < n; i++)
			for (let j = 0; j < table[i][0]; j++)
				PRG[addr++] ^= table[i][1];
		for (let i = 0; i < COLOR.length; i++)
			COLOR[i] &= 0xf;
		JrPacMan.patched = true;
	}

	makeBitmap(data) {
		// bg描画
		let p = 256 * 8 * 4 + 232 + (this.dwScroll & 7);
		let k = 0x40 + (this.dwScroll << 2 & 0x3e0);
		for (let i = 0; i < 29; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				this.xfer8x8(data, p, j, k);
		p = 256 * 8 * 36 + 232;
		k = 0x702;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k + 0x80, k);
		p = 256 * 8 * 37 + 232;
		k = 0x722;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k + 0x80, k);
		p = 256 * 8 * 2 + 232;
		k = 0x742;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k + 0x80, k);
		p = 256 * 8 * 3 + 232;
		k = 0x762;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k + 0x80, k);

		// obj描画
		for (let p = 0x0ffe, i = 7; i !== 0; p -= 2, --i) {
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
				data[p] = this.rgb[data[p] | this.ram[0x1071] << 4];
	}

	xfer8x8(data, p, j, k) {
		const q = this.ram[k] << 6 | this.ram[0x1074] << 14, idx = this.ram[j] << 2 & 0x7c | this.ram[0x1070] << 7;

		data[p + 0x000] = COLOR[idx | this.bg[q + 0x00]];
		data[p + 0x001] = COLOR[idx | this.bg[q + 0x01]];
		data[p + 0x002] = COLOR[idx | this.bg[q + 0x02]];
		data[p + 0x003] = COLOR[idx | this.bg[q + 0x03]];
		data[p + 0x004] = COLOR[idx | this.bg[q + 0x04]];
		data[p + 0x005] = COLOR[idx | this.bg[q + 0x05]];
		data[p + 0x006] = COLOR[idx | this.bg[q + 0x06]];
		data[p + 0x007] = COLOR[idx | this.bg[q + 0x07]];
		data[p + 0x100] = COLOR[idx | this.bg[q + 0x08]];
		data[p + 0x101] = COLOR[idx | this.bg[q + 0x09]];
		data[p + 0x102] = COLOR[idx | this.bg[q + 0x0a]];
		data[p + 0x103] = COLOR[idx | this.bg[q + 0x0b]];
		data[p + 0x104] = COLOR[idx | this.bg[q + 0x0c]];
		data[p + 0x105] = COLOR[idx | this.bg[q + 0x0d]];
		data[p + 0x106] = COLOR[idx | this.bg[q + 0x0e]];
		data[p + 0x107] = COLOR[idx | this.bg[q + 0x0f]];
		data[p + 0x200] = COLOR[idx | this.bg[q + 0x10]];
		data[p + 0x201] = COLOR[idx | this.bg[q + 0x11]];
		data[p + 0x202] = COLOR[idx | this.bg[q + 0x12]];
		data[p + 0x203] = COLOR[idx | this.bg[q + 0x13]];
		data[p + 0x204] = COLOR[idx | this.bg[q + 0x14]];
		data[p + 0x205] = COLOR[idx | this.bg[q + 0x15]];
		data[p + 0x206] = COLOR[idx | this.bg[q + 0x16]];
		data[p + 0x207] = COLOR[idx | this.bg[q + 0x17]];
		data[p + 0x300] = COLOR[idx | this.bg[q + 0x18]];
		data[p + 0x301] = COLOR[idx | this.bg[q + 0x19]];
		data[p + 0x302] = COLOR[idx | this.bg[q + 0x1a]];
		data[p + 0x303] = COLOR[idx | this.bg[q + 0x1b]];
		data[p + 0x304] = COLOR[idx | this.bg[q + 0x1c]];
		data[p + 0x305] = COLOR[idx | this.bg[q + 0x1d]];
		data[p + 0x306] = COLOR[idx | this.bg[q + 0x1e]];
		data[p + 0x307] = COLOR[idx | this.bg[q + 0x1f]];
		data[p + 0x400] = COLOR[idx | this.bg[q + 0x20]];
		data[p + 0x401] = COLOR[idx | this.bg[q + 0x21]];
		data[p + 0x402] = COLOR[idx | this.bg[q + 0x22]];
		data[p + 0x403] = COLOR[idx | this.bg[q + 0x23]];
		data[p + 0x404] = COLOR[idx | this.bg[q + 0x24]];
		data[p + 0x405] = COLOR[idx | this.bg[q + 0x25]];
		data[p + 0x406] = COLOR[idx | this.bg[q + 0x26]];
		data[p + 0x407] = COLOR[idx | this.bg[q + 0x27]];
		data[p + 0x500] = COLOR[idx | this.bg[q + 0x28]];
		data[p + 0x501] = COLOR[idx | this.bg[q + 0x29]];
		data[p + 0x502] = COLOR[idx | this.bg[q + 0x2a]];
		data[p + 0x503] = COLOR[idx | this.bg[q + 0x2b]];
		data[p + 0x504] = COLOR[idx | this.bg[q + 0x2c]];
		data[p + 0x505] = COLOR[idx | this.bg[q + 0x2d]];
		data[p + 0x506] = COLOR[idx | this.bg[q + 0x2e]];
		data[p + 0x507] = COLOR[idx | this.bg[q + 0x2f]];
		data[p + 0x600] = COLOR[idx | this.bg[q + 0x30]];
		data[p + 0x601] = COLOR[idx | this.bg[q + 0x31]];
		data[p + 0x602] = COLOR[idx | this.bg[q + 0x32]];
		data[p + 0x603] = COLOR[idx | this.bg[q + 0x33]];
		data[p + 0x604] = COLOR[idx | this.bg[q + 0x34]];
		data[p + 0x605] = COLOR[idx | this.bg[q + 0x35]];
		data[p + 0x606] = COLOR[idx | this.bg[q + 0x36]];
		data[p + 0x607] = COLOR[idx | this.bg[q + 0x37]];
		data[p + 0x700] = COLOR[idx | this.bg[q + 0x38]];
		data[p + 0x701] = COLOR[idx | this.bg[q + 0x39]];
		data[p + 0x702] = COLOR[idx | this.bg[q + 0x3a]];
		data[p + 0x703] = COLOR[idx | this.bg[q + 0x3b]];
		data[p + 0x704] = COLOR[idx | this.bg[q + 0x3c]];
		data[p + 0x705] = COLOR[idx | this.bg[q + 0x3d]];
		data[p + 0x706] = COLOR[idx | this.bg[q + 0x3e]];
		data[p + 0x707] = COLOR[idx | this.bg[q + 0x3f]];
	}

	xfer16x16(data, dst, src) {
		const idx = src >> 6 & 0x7c | this.ram[0x1070] << 7;
		let px, i, j, h;

		if ((h = 288 - (dst >> 8)) >= 16) {
			for (src = src << 6 & 0x3f00 | this.ram[0x1075] << 14, i = 16; i !== 0; dst += 256 - 16, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[src++]]) !== 0 && (this.ram[0x1073] === 0 || data[dst] === 0))
						data[dst] = px;
		}
		else {
			for (src = src << 6 & 0x3f00 | this.ram[0x1075] << 14, i = h; i !== 0; dst += 256 - 16, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[src++]]) !== 0 && (this.ram[0x1073] === 0 || data[dst] === 0))
						data[dst] = px;
			for (dst -= 0x10000, i = 16 - h; i !== 0; dst += 256 - 16, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[src++]]) !== 0 && (this.ram[0x1073] === 0 || data[dst] === 0))
						data[dst] = px;
		}
	}

	xfer16x16V(data, dst, src) {
		const idx = src >> 6 & 0x7c  | this.ram[0x1070] << 7;
		let px, i, j, h;

		if ((h = 288 - (dst >> 8)) >= 16) {
			for (src = (src << 6 & 0x3f00 | this.ram[0x1075] << 14) + 256 - 16, i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[src++]]) !== 0 && (this.ram[0x1073] === 0 || data[dst] === 0))
						data[dst] = px;
		}
		else {
			for (src = (src << 6 & 0x3f00 | this.ram[0x1075] << 14) + 256 - 16, i = h; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[src++]]) !== 0 && (this.ram[0x1073] === 0 || data[dst] === 0))
						data[dst] = px;
			for (dst -= 0x10000, i = 16 - h; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[src++]]) !== 0 && (this.ram[0x1073] === 0 || data[dst] === 0))
						data[dst] = px;
		}
	}

	xfer16x16H(data, dst, src) {
		const idx = src >> 6 & 0x7c | this.ram[0x1070] << 7;
		let px, i, j, h;

		if ((h = 288 - (dst >> 8)) >= 16) {
			for (src = (src << 6 & 0x3f00 | this.ram[0x1075] << 14) + 16, i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[--src]]) !== 0 && (this.ram[0x1073] === 0 || data[dst] === 0))
						data[dst] = px;
		}
		else {
			for (src = (src << 6 & 0x3f00 | this.ram[0x1075] << 14) + 16, i = h; i !== 0; dst += 256 - 16, src += 32, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[--src]]) !== 0 && (this.ram[0x1073] === 0 || data[dst] === 0))
						data[dst] = px;
			for (dst -= 0x10000, i = 16 - h; i !== 0; dst += 256 - 16, src += 32, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[--src]]) !== 0 && (this.ram[0x1073] === 0 || data[dst] === 0))
						data[dst] = px;
		}
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >> 6 & 0x7c | this.ram[0x1070] << 7;
		let px, i, j, h;

		if ((h = 288 - (dst >> 8)) >= 16) {
			for (src = (src << 6 & 0x3f00 | this.ram[0x1075] << 14) + 256, i = 16; i !== 0; dst += 256 - 16, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[--src]]) !== 0 && (this.ram[0x1073] === 0 || data[dst] === 0))
						data[dst] = px;
		}
		else {
			for (src = (src << 6 & 0x3f00 | this.ram[0x1075] << 14) + 256, i = h; i !== 0; dst += 256 - 16, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[--src]]) !== 0 && (this.ram[0x1073] === 0 || data[dst] === 0))
						data[dst] = px;
			for (dst -= 0x10000, i = 16 - h; i !== 0; dst += 256 - 16, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[--src]]) !== 0 && (this.ram[0x1073] === 0 || data[dst] === 0))
						data[dst] = px;
		}
	}
}

/*
 *
 *	Jr. Pac-Man
 *
 */

const url = 'jrpacman.zip';
let BG, COLOR, OBJ, RGB_L, RGB_H, PRG, SND;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG = zip.files['jrp8d.8d'].inflate() + zip.files['jrp8e.8e'].inflate() + zip.files['jrp8h.8h'].inflate() + zip.files['jrp8j.8j'].inflate();
	PRG = new Uint8Array((PRG + zip.files['jrp8k.8k'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	BG = new Uint8Array(zip.files['jrp2c.2c'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJ = new Uint8Array(zip.files['jrp2e.2e'].inflate().split('').map(c => c.charCodeAt(0)));
	RGB_L = new Uint8Array(zip.files['a290-27axv-bxhd.9e'].inflate().split('').map(c => c.charCodeAt(0)));
	RGB_H = new Uint8Array(zip.files['a290-27axv-cxhd.9f'].inflate().split('').map(c => c.charCodeAt(0)));
	COLOR = new Uint8Array(zip.files['a290-27axv-axhd.9p'].inflate().split('').map(c => c.charCodeAt(0)));
	SND = new Uint8Array(zip.files['a290-27axv-dxhd.7p'].inflate().split('').map(c => c.charCodeAt(0)));
	JrPacMan.patchROM();
	init({
		game: new JrPacMan(),
		sound: sound = new PacManSound({SND}),
	});
	loop();
}

