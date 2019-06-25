/*
 *
 *	Korosuke Roller
 *
 */

import PacManSound from './pac-man_sound.js';
import {init, loop} from './main.js';
import Z80 from './z80.js';
let sound;

class KorosukeRoller {
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

		// CPU周りの初期化
		this.ram = new Uint8Array(0xd00).addBase();
		this.in = Uint8Array.of(0xef, 0x6f, 0x31, 0x00);
		this.vector = 0;
		this.fInterruptEnable = false;
		this.fSoundEnable = false;
		this.fProtectEnable = false;
		this.protect_count = 0;
		this.protect_index = 0;

		this.cpu = new Z80(this);
		for (let i = 0; i < 0x40; i++)
			this.cpu.memorymap[0x80 + i].base = this.cpu.memorymap[i].base = PRG.base[i];
		for (let i = 0; i < 8; i++) {
			this.cpu.memorymap[0xe0 + i].base = this.cpu.memorymap[0xc0 + i].base = this.cpu.memorymap[0x60 + i].base = this.cpu.memorymap[0x40 + i].base = this.ram.base[i];
			this.cpu.memorymap[0xe0 + i].write = this.cpu.memorymap[0xc0 + i].write = this.cpu.memorymap[0x60 + i].write = this.cpu.memorymap[0x40 + i].write = null;
		}
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0xe8 + i].read = this.cpu.memorymap[0xc8 + i].read = this.cpu.memorymap[0x68 + i].read = this.cpu.memorymap[0x48 + i].read = () => 0xbf;
			this.cpu.memorymap[0xec + i].base = this.cpu.memorymap[0xcc + i].base = this.cpu.memorymap[0x6c + i].base = this.cpu.memorymap[0x4c + i].base = this.ram.base[8 + i];
			this.cpu.memorymap[0xec + i].write = this.cpu.memorymap[0xcc + i].write = this.cpu.memorymap[0x6c + i].write = this.cpu.memorymap[0x4c + i].write = null;
		}
		for (let i = 0; i < 0x10; i++) {
			this.cpu.memorymap[0xf0 + i].read = this.cpu.memorymap[0xd0 + i].read = this.cpu.memorymap[0x70 + i].read = this.cpu.memorymap[0x50 + i].read = addr => {
				const index = addr >>> 6 & 3;
				switch (index) {
				case 2:
					const data = this.in[2] & ~0xc0;
					if (this.fProtectEnable)
						return  data | [0x00, 0xc0, 0x00, 0x40, 0xc0, 0x40, 0x00, 0xc0, 0x00, 0x40, 0x00, 0xc0, 0x00, 0x40, 0xc0, 0x40,
							0x00, 0xc0, 0x00, 0x40, 0x00, 0xc0, 0x00, 0x40, 0xc0, 0x40, 0x00, 0xc0, 0x00, 0x40][this.protect_index];
					const index2 = [0x01, 0x04, 0x05, 0x0e, 0x10].indexOf(addr & 0x3f);
					return index2 < 0 ? data : data | [0x40, 0x40, 0xc0, 0xc0, 0xc0][index2];
				case 3:
					if (this.fProtectEnable)
						return [0x1f, 0x3f, 0x2f, 0x2f, 0x0f, 0x0f, 0x0f, 0x3f, 0x0f, 0x0f, 0x1c, 0x3c, 0x2c, 0x2c, 0x0c, 0x0c,
							0x0c, 0x3c, 0x0c, 0x0c, 0x11, 0x31, 0x21, 0x21, 0x01, 0x01, 0x01, 0x31, 0x01, 0x01][this.protect_index];
					const index3 = [0x00, 0x09, 0x0c].indexOf(addr & 0x3f);
					return index3 < 0 ? 0x20 : [0x1f, 0x30, 0x00][index3];
				}
				return this.in[index];
			};
			this.cpu.memorymap[0xf0 + i].write = this.cpu.memorymap[0xd0 + i].write = this.cpu.memorymap[0x70 + i].write = this.cpu.memorymap[0x50 + i].write = (addr, data) => {
				switch (addr & 0xf0) {
				case 0x00:
				case 0x10:
				case 0x20:
				case 0x30:
					switch (addr & 7) {
					case 0:
						this.fInterruptEnable = (data & 1) !== 0;
						break;
					case 1:
						this.fSoundEnable = (data & 1) !== 0;
						break;
					case 4:
						if (!(this.fProtectEnable = (data & 1) !== 0))
							this.protect_count = this.protect_index = 0;
						else if (++this.protect_count === 0x3c) {
							this.protect_count = 0;
							if (++this.protect_index === 0x1e)
								this.protect_index = 0;
						}
						break;
					}
					break;
				case 0x40:
				case 0x50:
					sound.write(addr, data);
					break;
				case 0x60:
					this.ram[0xc60 + (addr & 0x0f)] = data;
					break;
				}
			};
		}
		for (let i = 0; i < 0x100; i++)
			this.cpu.iomap[i].write = (addr, data) => {
				if ((addr & 0xff) === 0)
					this.vector = data;
			};

		// Videoの初期化
		this.bg = new Uint32Array(0x80000);
		this.obj = new Uint8Array(0x4000);
		this.color = new Uint32Array(0x100);
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
			switch (this.nLife) {
			case 3:
				this.in[2] &= 0xf3;
				break;
			case 4:
				this.in[2] = this.in[2] & 0xf3 | 0x04;
				break;
			case 5:
				this.in[2] = this.in[2] & 0xf3 | 0x08;
				break;
			case 6:
				this.in[2] |= 0x0c;
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
			this.in[0] &= ~(1 << 6);
		}
		else
			this.in[0] |= 1 << 6;
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
		if (fDown)
			this.in[0] &= ~(1 << 7 | 1 << 5);
		else
			this.in[0] |= 1 << 7 | 1 << 5;
	}

	triggerB(fDown) {
	}

	convertRGB() {
		for (let i = 0; i < 0x20; i++)
			this.rgb[i] = (RGB[i] & 7) * 255 / 7	// Red
				| (RGB[i] >>> 3 & 7) * 255 / 7 << 8	// Green
				| (RGB[i] >>> 6) * 255 / 3 << 16;	// Blue
	}

	convertBG() {
		for (let p = 0, q = 0, i = 256; i !== 0; q += 16, --i) {
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k + 8] >>> j & 1 | BG[q + k + 8] >>> (j + 3) & 2;
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k] >>> j & 1 | BG[q + k] >>> (j + 3) & 2;
		}
		for (let p = 0, i = 31; i !== 0; p += 0x4000, --i)
			this.bg.copyWithin(p + 0x4000, p, p + 0x4000);
		for (let p = 0, i = 0; i < 32; i++)
			for (let j = 0x4000; j !== 0; p++, --j)
				this.bg[p] = this.rgb[COLOR[i * 4 + this.bg[p]] & 0x0f];
	}

	convertOBJ() {
		// obj palette
		for (let i = 0; i < 0x100; i++)
			this.color[i] = this.rgb[COLOR[i] & 0x0f];

		for (let p = 0, q = 0, i = 64; i !== 0; q += 64, --i) {
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 40] >>> j & 1 | OBJ[q + k + 40] >>> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 8] >>> j & 1 | OBJ[q + k + 8] >>> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 48] >>> j & 1 | OBJ[q + k + 48] >>> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 16] >>> j & 1 | OBJ[q + k + 16] >>> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 56] >>> j & 1 | OBJ[q + k + 56] >>> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 24] >>> j & 1 | OBJ[q + k + 24] >>> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 32] >>> j & 1 | OBJ[q + k + 32] >>> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k] >>> j & 1 | OBJ[q + k] >>> (j + 3) & 2;
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

		// alphaチャンネル修正
		p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] |= 0xff000000;
	}

	xfer8x8(data, p, k) {
		const q = ((this.ram[k] | this.ram[k + 0x400] << 8) & 0x1fff) << 6;

		data[p + 0x000] = this.bg[q + 0x00];
		data[p + 0x001] = this.bg[q + 0x01];
		data[p + 0x002] = this.bg[q + 0x02];
		data[p + 0x003] = this.bg[q + 0x03];
		data[p + 0x004] = this.bg[q + 0x04];
		data[p + 0x005] = this.bg[q + 0x05];
		data[p + 0x006] = this.bg[q + 0x06];
		data[p + 0x007] = this.bg[q + 0x07];
		data[p + 0x100] = this.bg[q + 0x08];
		data[p + 0x101] = this.bg[q + 0x09];
		data[p + 0x102] = this.bg[q + 0x0a];
		data[p + 0x103] = this.bg[q + 0x0b];
		data[p + 0x104] = this.bg[q + 0x0c];
		data[p + 0x105] = this.bg[q + 0x0d];
		data[p + 0x106] = this.bg[q + 0x0e];
		data[p + 0x107] = this.bg[q + 0x0f];
		data[p + 0x200] = this.bg[q + 0x10];
		data[p + 0x201] = this.bg[q + 0x11];
		data[p + 0x202] = this.bg[q + 0x12];
		data[p + 0x203] = this.bg[q + 0x13];
		data[p + 0x204] = this.bg[q + 0x14];
		data[p + 0x205] = this.bg[q + 0x15];
		data[p + 0x206] = this.bg[q + 0x16];
		data[p + 0x207] = this.bg[q + 0x17];
		data[p + 0x300] = this.bg[q + 0x18];
		data[p + 0x301] = this.bg[q + 0x19];
		data[p + 0x302] = this.bg[q + 0x1a];
		data[p + 0x303] = this.bg[q + 0x1b];
		data[p + 0x304] = this.bg[q + 0x1c];
		data[p + 0x305] = this.bg[q + 0x1d];
		data[p + 0x306] = this.bg[q + 0x1e];
		data[p + 0x307] = this.bg[q + 0x1f];
		data[p + 0x400] = this.bg[q + 0x20];
		data[p + 0x401] = this.bg[q + 0x21];
		data[p + 0x402] = this.bg[q + 0x22];
		data[p + 0x403] = this.bg[q + 0x23];
		data[p + 0x404] = this.bg[q + 0x24];
		data[p + 0x405] = this.bg[q + 0x25];
		data[p + 0x406] = this.bg[q + 0x26];
		data[p + 0x407] = this.bg[q + 0x27];
		data[p + 0x500] = this.bg[q + 0x28];
		data[p + 0x501] = this.bg[q + 0x29];
		data[p + 0x502] = this.bg[q + 0x2a];
		data[p + 0x503] = this.bg[q + 0x2b];
		data[p + 0x504] = this.bg[q + 0x2c];
		data[p + 0x505] = this.bg[q + 0x2d];
		data[p + 0x506] = this.bg[q + 0x2e];
		data[p + 0x507] = this.bg[q + 0x2f];
		data[p + 0x600] = this.bg[q + 0x30];
		data[p + 0x601] = this.bg[q + 0x31];
		data[p + 0x602] = this.bg[q + 0x32];
		data[p + 0x603] = this.bg[q + 0x33];
		data[p + 0x604] = this.bg[q + 0x34];
		data[p + 0x605] = this.bg[q + 0x35];
		data[p + 0x606] = this.bg[q + 0x36];
		data[p + 0x607] = this.bg[q + 0x37];
		data[p + 0x700] = this.bg[q + 0x38];
		data[p + 0x701] = this.bg[q + 0x39];
		data[p + 0x702] = this.bg[q + 0x3a];
		data[p + 0x703] = this.bg[q + 0x3b];
		data[p + 0x704] = this.bg[q + 0x3c];
		data[p + 0x705] = this.bg[q + 0x3d];
		data[p + 0x706] = this.bg[q + 0x3e];
		data[p + 0x707] = this.bg[q + 0x3f];
	}

	xfer16x16(data, dst, src) {
		const idx = src >>> 6 & 0x7c;
		let px, i, j, h;

		if ((h = 288 - (dst >>> 8)) >= 16) {
			for (src = src << 6 & 0x3f00, i = 16; i !== 0; dst += 256 - 16, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx + this.obj[src++]]) !== 0)
						data[dst] = px;
		}
		else {
			for (src = src << 6 & 0x3f00, i = h; i !== 0; dst += 256 - 16, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx + this.obj[src++]]) !== 0)
						data[dst] = px;
			for (dst -= 0x10000, i = 16 - h; i !== 0; dst += 256 - 16, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx + this.obj[src++]]) !== 0)
						data[dst] = px;
		}
	}

	xfer16x16V(data, dst, src) {
		const idx = src >>> 6 & 0x7c;
		let px, i, j, h;

		if ((h = 288 - (dst >>> 8)) >= 16) {
			for (src = (src << 6 & 0x3f00) + 256 - 16, i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx + this.obj[src++]]) !== 0)
						data[dst] = px;
		}
		else {
			for (src = (src << 6 & 0x3f00) + 256 - 16, i = h; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx + this.obj[src++]]) !== 0)
						data[dst] = px;
			for (dst -= 0x10000, i = 16 - h; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx + this.obj[src++]]) !== 0)
						data[dst] = px;
		}
	}

	xfer16x16H(data, dst, src) {
		const idx = src >>> 6 & 0x7c;
		let px, i, j, h;

		if ((h = 288 - (dst >>> 8)) >= 16) {
			for (src = (src << 6 & 0x3f00) + 16, i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx + this.obj[--src]]) !== 0)
						data[dst] = px;
		}
		else {
			for (src = (src << 6 & 0x3f00) + 16, i = h; i !== 0; dst += 256 - 16, src += 32, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx + this.obj[--src]]) !== 0)
						data[dst] = px;
			for (dst -= 0x10000, i = 16 - h; i !== 0; dst += 256 - 16, src += 32, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx + this.obj[--src]]) !== 0)
						data[dst] = px;
		}
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >>> 6 & 0x7c;
		let px, i, j, h;

		if ((h = 288 - (dst >>> 8)) >= 16) {
			for (src = (src << 6 & 0x3f00) + 256, i = 16; i !== 0; dst += 256 - 16, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx + this.obj[--src]]) !== 0)
						data[dst] = px;
		}
		else {
			for (src = (src << 6 & 0x3f00) + 256, i = h; i !== 0; dst += 256 - 16, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx + this.obj[--src]]) !== 0)
						data[dst] = px;
			for (dst -= 0x10000, i = 16 - h; i !== 0; dst += 256 - 16, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = this.color[idx + this.obj[--src]]) !== 0)
						data[dst] = px;
		}
	}
}

/*
 *
 *	Korosuke Roller
 *
 */

const url = 'crush.zip';
let BG, COLOR, OBJ, RGB, PRG, SND;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG = zip.files['korosuke/kr.6e'].inflate() + zip.files['korosuke/kr.6f'].inflate() + zip.files['korosuke/kr.6h'].inflate();
	PRG = new Uint8Array((PRG + zip.files['korosuke/kr.6j'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	BG = new Uint8Array(zip.files['korosuke/kr.5e'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJ = new Uint8Array(zip.files['korosuke/kr.5f'].inflate().split('').map(c => c.charCodeAt(0)));
	RGB = new Uint8Array(zip.files['82s123.7f'].inflate().split('').map(c => c.charCodeAt(0)));
	COLOR = new Uint8Array(zip.files['2s140.4a'].inflate().split('').map(c => c.charCodeAt(0)));
	SND = new Uint8Array(zip.files['82s126.1m'].inflate().split('').map(c => c.charCodeAt(0)));
	init({
		game: new KorosukeRoller(),
		sound: sound = new PacManSound({SND}),
	});
	loop();
}
