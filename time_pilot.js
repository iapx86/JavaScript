/*
 *
 *	Time Pilot
 *
 */

import AY_3_8910 from './ay-3-8910.js';
import {init, loop} from './main.js';
import Z80 from './z80.js';
let sound;

class TimePilot {
	constructor() {
		this.cxScreen = 224;
		this.cyScreen = 256;
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
		this.nBonus = '10000 50000';
		this.nDifficulty = 4;

		// CPU周りの初期化
		this.fInterruptEnable = false;
		this.fSoundEnable = false;

		this.ram = new Uint8Array(0x1400).addBase();
		this.in = Uint8Array.of(0xff, 0xff, 0xff, 0xff, 0x4b);
		this.ram2 = new Uint8Array(0x400).addBase();
		this.psg = [{addr: 0}, {addr: 0}];
		this.count = 0;
		this.timer = 0;
		this.command = [];

		const range = (page, start, end, mirror = 0) => (page & ~mirror) >= start && (page & ~mirror) <= end;

		this.cpu = new Z80(this);
		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0x5f))
				this.cpu.memorymap[page].base = PRG1.base[page & 0x7f];
			else if (range(page, 0xa0, 0xaf)) {
				this.cpu.memorymap[page].base = this.ram.base[page & 0xf];
				this.cpu.memorymap[page].write = null;
			}
			else if (range(page, 0xb0, 0xb0, 0x0b)) {
				this.cpu.memorymap[page].base = this.ram.base[0x10];
				this.cpu.memorymap[page].write = null;
			}
			else if (range(page, 0xb4, 0xb4, 0x0b)) {
				this.cpu.memorymap[page].base = this.ram.base[0x11];
				this.cpu.memorymap[page].write = null;
			}
			else if (range(page, 0xc0, 0xc0, 0x0c)) {
				this.cpu.memorymap[page].read = () => this.vpos;
				this.cpu.memorymap[page].write = (addr, data) => this.command.push(data);
			}
			else if (range(page, 0xc2, 0xc2, 0x0c))
				this.cpu.memorymap[page].read = () => this.in[4];
			else if (range(page, 0xc3, 0xc3, 0x0c)) {
				this.cpu.memorymap[page].read = addr => this.in[addr >> 5 & 3];
				this.cpu.memorymap[page].write = (addr, data) => {
					switch (addr >> 1 & 0x7f) {
					case 0:
						return void(this.fInterruptEnable = (data & 1) !== 0);
					case 3:
						return void(this.fSoundEnable = (data & 1) === 0);
					}
				};
			}

		this.cpu2 = new Z80(this);
		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0x0f))
				this.cpu2.memorymap[page].base = PRG2.base[page & 0xf];
			else if (range(page, 0x30, 0x33, 0x0c)) {
				this.cpu2.memorymap[page].base = this.ram2.base[page & 3];
				this.cpu2.memorymap[page].write = null;
			}
			else if (range(page, 0x40, 0x40, 0x0f)) {
				this.cpu2.memorymap[page].read = () => sound[0].read(this.psg[0].addr);
				this.cpu2.memorymap[page].write = (addr, data) => sound[0].write(this.psg[0].addr, data, this.count);
			}
			else if (range(page, 0x50, 0x50, 0x0f))
				this.cpu2.memorymap[page].write = (addr, data) => this.psg[0].addr = data;
			else if (range(page, 0x60, 0x60, 0x0f)) {
				this.cpu2.memorymap[page].read = () => sound[1].read(this.psg[1].addr);
				this.cpu2.memorymap[page].write = (addr, data) => sound[1].write(this.psg[1].addr, data, this.count);
			}
			else if (range(page, 0x70, 0x70, 0x0f))
				this.cpu2.memorymap[page].write = (addr, data) => this.psg[1].addr = data;

		// Videoの初期化
		this.bg = new Uint8Array(0x8000);
		this.obj = new Uint8Array(0x10000);
		this.rgb = new Uint32Array(0x20);
		this.vpos = 0;
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();
	}

	execute() {
		sound[0].mute(!this.fSoundEnable);
		sound[1].mute(!this.fSoundEnable);
		for (let i = 0; i < 256; i++) {
			this.vpos = i + 144 & 0xff;
			if (this.vpos === 0)
				this.ram.copyWithin(0x1200, 0x1000, 0x1200);
			if (this.vpos === 240 && this.fInterruptEnable)
				this.cpu.non_maskable_interrupt();
			this.cpu.execute(32);
		}
		for (this.count = 0; this.count < 58; this.count++) { // 14318181 / 8 / 60 / 512
			if (this.command.length && this.cpu2.interrupt())
				sound[0].write(0x0e, this.command.shift());
			sound[0].write(0x0f, [0x00, 0x10, 0x20, 0x30, 0x40, 0x90, 0xa0, 0xb0, 0xa0, 0xd0][this.timer]);
			this.cpu2.execute(73);
			if (++this.timer >= 10)
				this.timer = 0;
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
			switch (this.nLife) {
			case 3:
				this.in[4] |= 3;
				break;
			case 4:
				this.in[4] = this.in[4] & ~3 | 2;
				break;
			case 5:
				this.in[4] = this.in[4] & ~3 | 1;
				break;
			case 255:
				this.in[4] &= ~3;
				break;
			}
			switch (this.nBonus) {
			case '10000 50000':
				this.in[4] |= 8;
				break;
			case '20000 60000':
				this.in[4] &= ~8;
				break;
			}
			switch (this.nDifficulty) {
			case 1:
				this.in[4] |= 0x70;
				break;
			case 2:
				this.in[4] = this.in[4] & ~0x70 | 0x60;
				break;
			case 3:
				this.in[4] = this.in[4] & ~0x70 | 0x50;
				break;
			case 4:
				this.in[4] = this.in[4] & ~0x70 | 0x40;
				break;
			case 5:
				this.in[4] = this.in[4] & ~0x70 | 0x30;
				break;
			case 6:
				this.in[4] = this.in[4] & ~0x70 | 0x20;
				break;
			case 7:
				this.in[4] = this.in[4] & ~0x70 | 0x10;
				break;
			case 8:
				this.in[4] &= ~0x70;
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
			this.command.splice(0);
			this.cpu2.reset();
			this.timer = 0;
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if (this.fCoin) {
			--this.fCoin;
			this.in[0] &= ~(1 << 0);
		}
		else
			this.in[0] |= 1 << 0;
		if (this.fStart1P) {
			--this.fStart1P;
			this.in[0] &= ~(1 << 3);
		}
		else
			this.in[0] |= 1 << 3;
		if (this.fStart2P) {
			--this.fStart2P;
			this.in[0] &= ~(1 << 4);
		}
		else
			this.in[0] |= 1 << 4;
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
		if (fDown)
			this.in[1] = this.in[1] & ~(1 << 2) | 1 << 3;
		else
			this.in[1] |= 1 << 2;
	}

	right(fDown) {
		if (fDown)
			this.in[1] = this.in[1] & ~(1 << 1) | 1 << 0;
		else
			this.in[1] |= 1 << 1;
	}

	down(fDown) {
		if (fDown)
			this.in[1] = this.in[1] & ~(1 << 3) | 1 << 2;
		else
			this.in[1] |= 1 << 3;
	}

	left(fDown) {
		if (fDown)
			this.in[1] = this.in[1] & ~(1 << 0) | 1 << 1;
		else
			this.in[1] |= 1 << 0;
	}

	triggerA(fDown) {
		if (fDown)
			this.in[1] &= ~(1 << 4);
		else
			this.in[1] |= 1 << 4;
	}

	triggerB(fDown) {
	}

	convertRGB() {
		for (let i = 0; i < 0x20; i++)
			this.rgb[i] = ((RGB_H[i] << 8 | RGB_L[i]) >> 1 & 31) * 255 / 31	// Red
				| ((RGB_H[i] << 8 | RGB_L[i]) >> 6 & 31) * 255 / 31 << 8	// Green
				| ((RGB_H[i] << 8 | RGB_L[i]) >> 11) * 255 / 31 << 16		// Blue
				| 0xff000000;
	}

	convertBG() {
		for (let p = 0, q = 0, i = 512; i !== 0; q += 16, --i) {
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k] >> (j + 4) & 1 | BG[q + k] >> j << 1 & 2;
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k + 8] >> (j + 4) & 1 | BG[q + k + 8] >> j << 1 & 2;
		}
	}

	convertOBJ() {
		for (let p = 0, q = 0, i = 256; i !== 0; q += 64, --i) {
			for (let j = 0; j < 4; j++) {
				for (let k = 63; k >= 56; --k)
					this.obj[p++] = OBJ[q + k] >> (j + 4) & 1 | OBJ[q + k] >> j << 1 & 2;
				for (let k = 31; k >= 24; --k)
					this.obj[p++] = OBJ[q + k] >> (j + 4) & 1 | OBJ[q + k] >> j << 1 & 2;
			}
			for (let j = 0; j < 4; j++) {
				for (let k = 55; k >= 48; --k)
					this.obj[p++] = OBJ[q + k] >> (j + 4) & 1 | OBJ[q + k] >> j << 1 & 2;
				for (let k = 23; k >= 16; --k)
					this.obj[p++] = OBJ[q + k] >> (j + 4) & 1 | OBJ[q + k] >> j << 1 & 2;
			}
			for (let j = 0; j < 4; j++) {
				for (let k = 47; k >= 40; --k)
					this.obj[p++] = OBJ[q + k] >> (j + 4) & 1 | OBJ[q + k] >> j << 1 & 2;
				for (let k = 15; k >= 8; --k)
					this.obj[p++] = OBJ[q + k] >> (j + 4) & 1 | OBJ[q + k] >> j << 1 & 2;
			}
			for (let j = 0; j < 4; j++) {
				for (let k = 39; k >= 32; --k)
					this.obj[p++] = OBJ[q + k] >> (j + 4) & 1 | OBJ[q + k] >> j << 1 & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k] >> (j + 4) & 1 | OBJ[q + k] >> j << 1 & 2;
			}
		}
	}

	makeBitmap(data) {
		// bg 描画
		let p = 256 * 8 * 2 + 232;
		let k = 0x40;
		for (let i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				this.xfer8x8(data, p, k, 0);

		// obj 描画
		for (let k = 0x103e; k >= 0x1010; k -= 2) {
			const src0 = this.ram[k + 0x301] - 1 & 0xff | this.ram[k + 0x200] + 16 << 8;
			const dst0 = this.ram[k + 0x201] | this.ram[k + 0x300] << 8;
			switch (dst0 >> 14) {
			case 0: // ノーマル
				this.xfer16x16(data, src0, dst0);
				break;
			case 1: // V反転
				this.xfer16x16V(data, src0, dst0);
				break;
			case 2: // H反転
				this.xfer16x16H(data, src0, dst0);
				break;
			case 3: // HV反転
				this.xfer16x16HV(data, src0, dst0);
				break;
			}
			const src1 = this.ram[k + 0x101] - 1 & 0xff | this.ram[k] + 16 << 8;
			const dst1 = this.ram[k + 1] | this.ram[k + 0x100] << 8;
			if (src1 === src0 && dst1 === dst0)
				continue;
			switch (dst1 >> 14) {
			case 0: // ノーマル
				this.xfer16x16(data, src1, dst1);
				break;
			case 1: // V反転
				this.xfer16x16V(data, src1, dst1);
				break;
			case 2: // H反転
				this.xfer16x16H(data, src1, dst1);
				break;
			case 3: // HV反転
				this.xfer16x16HV(data, src1, dst1);
				break;
			}
		}

		// bg 描画
		p = 256 * 8 * 2 + 232;
		k = 0x40;
		for (let i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				this.xfer8x8(data, p, k, 1);

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] = this.rgb[data[p]];
	}

	xfer8x8(data, p, k, pri) {
		const q = (this.ram[0x400 + k] | this.ram[k] << 3 & 0x100) << 6, idx = this.ram[k] << 2 & 0x7c;

		if ((this.ram[k] >> 4 & 1) !== pri)
			return;
		switch (this.ram[k] >> 6) {
		case 0: // ノーマル
			data[p + 0x000] = BGCOLOR[idx | this.bg[q + 0x00]] | 0x10;
			data[p + 0x001] = BGCOLOR[idx | this.bg[q + 0x01]] | 0x10;
			data[p + 0x002] = BGCOLOR[idx | this.bg[q + 0x02]] | 0x10;
			data[p + 0x003] = BGCOLOR[idx | this.bg[q + 0x03]] | 0x10;
			data[p + 0x004] = BGCOLOR[idx | this.bg[q + 0x04]] | 0x10;
			data[p + 0x005] = BGCOLOR[idx | this.bg[q + 0x05]] | 0x10;
			data[p + 0x006] = BGCOLOR[idx | this.bg[q + 0x06]] | 0x10;
			data[p + 0x007] = BGCOLOR[idx | this.bg[q + 0x07]] | 0x10;
			data[p + 0x100] = BGCOLOR[idx | this.bg[q + 0x08]] | 0x10;
			data[p + 0x101] = BGCOLOR[idx | this.bg[q + 0x09]] | 0x10;
			data[p + 0x102] = BGCOLOR[idx | this.bg[q + 0x0a]] | 0x10;
			data[p + 0x103] = BGCOLOR[idx | this.bg[q + 0x0b]] | 0x10;
			data[p + 0x104] = BGCOLOR[idx | this.bg[q + 0x0c]] | 0x10;
			data[p + 0x105] = BGCOLOR[idx | this.bg[q + 0x0d]] | 0x10;
			data[p + 0x106] = BGCOLOR[idx | this.bg[q + 0x0e]] | 0x10;
			data[p + 0x107] = BGCOLOR[idx | this.bg[q + 0x0f]] | 0x10;
			data[p + 0x200] = BGCOLOR[idx | this.bg[q + 0x10]] | 0x10;
			data[p + 0x201] = BGCOLOR[idx | this.bg[q + 0x11]] | 0x10;
			data[p + 0x202] = BGCOLOR[idx | this.bg[q + 0x12]] | 0x10;
			data[p + 0x203] = BGCOLOR[idx | this.bg[q + 0x13]] | 0x10;
			data[p + 0x204] = BGCOLOR[idx | this.bg[q + 0x14]] | 0x10;
			data[p + 0x205] = BGCOLOR[idx | this.bg[q + 0x15]] | 0x10;
			data[p + 0x206] = BGCOLOR[idx | this.bg[q + 0x16]] | 0x10;
			data[p + 0x207] = BGCOLOR[idx | this.bg[q + 0x17]] | 0x10;
			data[p + 0x300] = BGCOLOR[idx | this.bg[q + 0x18]] | 0x10;
			data[p + 0x301] = BGCOLOR[idx | this.bg[q + 0x19]] | 0x10;
			data[p + 0x302] = BGCOLOR[idx | this.bg[q + 0x1a]] | 0x10;
			data[p + 0x303] = BGCOLOR[idx | this.bg[q + 0x1b]] | 0x10;
			data[p + 0x304] = BGCOLOR[idx | this.bg[q + 0x1c]] | 0x10;
			data[p + 0x305] = BGCOLOR[idx | this.bg[q + 0x1d]] | 0x10;
			data[p + 0x306] = BGCOLOR[idx | this.bg[q + 0x1e]] | 0x10;
			data[p + 0x307] = BGCOLOR[idx | this.bg[q + 0x1f]] | 0x10;
			data[p + 0x400] = BGCOLOR[idx | this.bg[q + 0x20]] | 0x10;
			data[p + 0x401] = BGCOLOR[idx | this.bg[q + 0x21]] | 0x10;
			data[p + 0x402] = BGCOLOR[idx | this.bg[q + 0x22]] | 0x10;
			data[p + 0x403] = BGCOLOR[idx | this.bg[q + 0x23]] | 0x10;
			data[p + 0x404] = BGCOLOR[idx | this.bg[q + 0x24]] | 0x10;
			data[p + 0x405] = BGCOLOR[idx | this.bg[q + 0x25]] | 0x10;
			data[p + 0x406] = BGCOLOR[idx | this.bg[q + 0x26]] | 0x10;
			data[p + 0x407] = BGCOLOR[idx | this.bg[q + 0x27]] | 0x10;
			data[p + 0x500] = BGCOLOR[idx | this.bg[q + 0x28]] | 0x10;
			data[p + 0x501] = BGCOLOR[idx | this.bg[q + 0x29]] | 0x10;
			data[p + 0x502] = BGCOLOR[idx | this.bg[q + 0x2a]] | 0x10;
			data[p + 0x503] = BGCOLOR[idx | this.bg[q + 0x2b]] | 0x10;
			data[p + 0x504] = BGCOLOR[idx | this.bg[q + 0x2c]] | 0x10;
			data[p + 0x505] = BGCOLOR[idx | this.bg[q + 0x2d]] | 0x10;
			data[p + 0x506] = BGCOLOR[idx | this.bg[q + 0x2e]] | 0x10;
			data[p + 0x507] = BGCOLOR[idx | this.bg[q + 0x2f]] | 0x10;
			data[p + 0x600] = BGCOLOR[idx | this.bg[q + 0x30]] | 0x10;
			data[p + 0x601] = BGCOLOR[idx | this.bg[q + 0x31]] | 0x10;
			data[p + 0x602] = BGCOLOR[idx | this.bg[q + 0x32]] | 0x10;
			data[p + 0x603] = BGCOLOR[idx | this.bg[q + 0x33]] | 0x10;
			data[p + 0x604] = BGCOLOR[idx | this.bg[q + 0x34]] | 0x10;
			data[p + 0x605] = BGCOLOR[idx | this.bg[q + 0x35]] | 0x10;
			data[p + 0x606] = BGCOLOR[idx | this.bg[q + 0x36]] | 0x10;
			data[p + 0x607] = BGCOLOR[idx | this.bg[q + 0x37]] | 0x10;
			data[p + 0x700] = BGCOLOR[idx | this.bg[q + 0x38]] | 0x10;
			data[p + 0x701] = BGCOLOR[idx | this.bg[q + 0x39]] | 0x10;
			data[p + 0x702] = BGCOLOR[idx | this.bg[q + 0x3a]] | 0x10;
			data[p + 0x703] = BGCOLOR[idx | this.bg[q + 0x3b]] | 0x10;
			data[p + 0x704] = BGCOLOR[idx | this.bg[q + 0x3c]] | 0x10;
			data[p + 0x705] = BGCOLOR[idx | this.bg[q + 0x3d]] | 0x10;
			data[p + 0x706] = BGCOLOR[idx | this.bg[q + 0x3e]] | 0x10;
			data[p + 0x707] = BGCOLOR[idx | this.bg[q + 0x3f]] | 0x10;
			break;
		case 1: // V反転
			data[p + 0x000] = BGCOLOR[idx | this.bg[q + 0x38]] | 0x10;
			data[p + 0x001] = BGCOLOR[idx | this.bg[q + 0x39]] | 0x10;
			data[p + 0x002] = BGCOLOR[idx | this.bg[q + 0x3a]] | 0x10;
			data[p + 0x003] = BGCOLOR[idx | this.bg[q + 0x3b]] | 0x10;
			data[p + 0x004] = BGCOLOR[idx | this.bg[q + 0x3c]] | 0x10;
			data[p + 0x005] = BGCOLOR[idx | this.bg[q + 0x3d]] | 0x10;
			data[p + 0x006] = BGCOLOR[idx | this.bg[q + 0x3e]] | 0x10;
			data[p + 0x007] = BGCOLOR[idx | this.bg[q + 0x3f]] | 0x10;
			data[p + 0x100] = BGCOLOR[idx | this.bg[q + 0x30]] | 0x10;
			data[p + 0x101] = BGCOLOR[idx | this.bg[q + 0x31]] | 0x10;
			data[p + 0x102] = BGCOLOR[idx | this.bg[q + 0x32]] | 0x10;
			data[p + 0x103] = BGCOLOR[idx | this.bg[q + 0x33]] | 0x10;
			data[p + 0x104] = BGCOLOR[idx | this.bg[q + 0x34]] | 0x10;
			data[p + 0x105] = BGCOLOR[idx | this.bg[q + 0x35]] | 0x10;
			data[p + 0x106] = BGCOLOR[idx | this.bg[q + 0x36]] | 0x10;
			data[p + 0x107] = BGCOLOR[idx | this.bg[q + 0x37]] | 0x10;
			data[p + 0x200] = BGCOLOR[idx | this.bg[q + 0x28]] | 0x10;
			data[p + 0x201] = BGCOLOR[idx | this.bg[q + 0x29]] | 0x10;
			data[p + 0x202] = BGCOLOR[idx | this.bg[q + 0x2a]] | 0x10;
			data[p + 0x203] = BGCOLOR[idx | this.bg[q + 0x2b]] | 0x10;
			data[p + 0x204] = BGCOLOR[idx | this.bg[q + 0x2c]] | 0x10;
			data[p + 0x205] = BGCOLOR[idx | this.bg[q + 0x2d]] | 0x10;
			data[p + 0x206] = BGCOLOR[idx | this.bg[q + 0x2e]] | 0x10;
			data[p + 0x207] = BGCOLOR[idx | this.bg[q + 0x2f]] | 0x10;
			data[p + 0x300] = BGCOLOR[idx | this.bg[q + 0x20]] | 0x10;
			data[p + 0x301] = BGCOLOR[idx | this.bg[q + 0x21]] | 0x10;
			data[p + 0x302] = BGCOLOR[idx | this.bg[q + 0x22]] | 0x10;
			data[p + 0x303] = BGCOLOR[idx | this.bg[q + 0x23]] | 0x10;
			data[p + 0x304] = BGCOLOR[idx | this.bg[q + 0x24]] | 0x10;
			data[p + 0x305] = BGCOLOR[idx | this.bg[q + 0x25]] | 0x10;
			data[p + 0x306] = BGCOLOR[idx | this.bg[q + 0x26]] | 0x10;
			data[p + 0x307] = BGCOLOR[idx | this.bg[q + 0x27]] | 0x10;
			data[p + 0x400] = BGCOLOR[idx | this.bg[q + 0x18]] | 0x10;
			data[p + 0x401] = BGCOLOR[idx | this.bg[q + 0x19]] | 0x10;
			data[p + 0x402] = BGCOLOR[idx | this.bg[q + 0x1a]] | 0x10;
			data[p + 0x403] = BGCOLOR[idx | this.bg[q + 0x1b]] | 0x10;
			data[p + 0x404] = BGCOLOR[idx | this.bg[q + 0x1c]] | 0x10;
			data[p + 0x405] = BGCOLOR[idx | this.bg[q + 0x1d]] | 0x10;
			data[p + 0x406] = BGCOLOR[idx | this.bg[q + 0x1e]] | 0x10;
			data[p + 0x407] = BGCOLOR[idx | this.bg[q + 0x1f]] | 0x10;
			data[p + 0x500] = BGCOLOR[idx | this.bg[q + 0x10]] | 0x10;
			data[p + 0x501] = BGCOLOR[idx | this.bg[q + 0x11]] | 0x10;
			data[p + 0x502] = BGCOLOR[idx | this.bg[q + 0x12]] | 0x10;
			data[p + 0x503] = BGCOLOR[idx | this.bg[q + 0x13]] | 0x10;
			data[p + 0x504] = BGCOLOR[idx | this.bg[q + 0x14]] | 0x10;
			data[p + 0x505] = BGCOLOR[idx | this.bg[q + 0x15]] | 0x10;
			data[p + 0x506] = BGCOLOR[idx | this.bg[q + 0x16]] | 0x10;
			data[p + 0x507] = BGCOLOR[idx | this.bg[q + 0x17]] | 0x10;
			data[p + 0x600] = BGCOLOR[idx | this.bg[q + 0x08]] | 0x10;
			data[p + 0x601] = BGCOLOR[idx | this.bg[q + 0x09]] | 0x10;
			data[p + 0x602] = BGCOLOR[idx | this.bg[q + 0x0a]] | 0x10;
			data[p + 0x603] = BGCOLOR[idx | this.bg[q + 0x0b]] | 0x10;
			data[p + 0x604] = BGCOLOR[idx | this.bg[q + 0x0c]] | 0x10;
			data[p + 0x605] = BGCOLOR[idx | this.bg[q + 0x0d]] | 0x10;
			data[p + 0x606] = BGCOLOR[idx | this.bg[q + 0x0e]] | 0x10;
			data[p + 0x607] = BGCOLOR[idx | this.bg[q + 0x0f]] | 0x10;
			data[p + 0x700] = BGCOLOR[idx | this.bg[q + 0x00]] | 0x10;
			data[p + 0x701] = BGCOLOR[idx | this.bg[q + 0x01]] | 0x10;
			data[p + 0x702] = BGCOLOR[idx | this.bg[q + 0x02]] | 0x10;
			data[p + 0x703] = BGCOLOR[idx | this.bg[q + 0x03]] | 0x10;
			data[p + 0x704] = BGCOLOR[idx | this.bg[q + 0x04]] | 0x10;
			data[p + 0x705] = BGCOLOR[idx | this.bg[q + 0x05]] | 0x10;
			data[p + 0x706] = BGCOLOR[idx | this.bg[q + 0x06]] | 0x10;
			data[p + 0x707] = BGCOLOR[idx | this.bg[q + 0x07]] | 0x10;
			break;
		case 2: // H反転
			data[p + 0x000] = BGCOLOR[idx | this.bg[q + 0x07]] | 0x10;
			data[p + 0x001] = BGCOLOR[idx | this.bg[q + 0x06]] | 0x10;
			data[p + 0x002] = BGCOLOR[idx | this.bg[q + 0x05]] | 0x10;
			data[p + 0x003] = BGCOLOR[idx | this.bg[q + 0x04]] | 0x10;
			data[p + 0x004] = BGCOLOR[idx | this.bg[q + 0x03]] | 0x10;
			data[p + 0x005] = BGCOLOR[idx | this.bg[q + 0x02]] | 0x10;
			data[p + 0x006] = BGCOLOR[idx | this.bg[q + 0x01]] | 0x10;
			data[p + 0x007] = BGCOLOR[idx | this.bg[q + 0x00]] | 0x10;
			data[p + 0x100] = BGCOLOR[idx | this.bg[q + 0x0f]] | 0x10;
			data[p + 0x101] = BGCOLOR[idx | this.bg[q + 0x0e]] | 0x10;
			data[p + 0x102] = BGCOLOR[idx | this.bg[q + 0x0d]] | 0x10;
			data[p + 0x103] = BGCOLOR[idx | this.bg[q + 0x0c]] | 0x10;
			data[p + 0x104] = BGCOLOR[idx | this.bg[q + 0x0b]] | 0x10;
			data[p + 0x105] = BGCOLOR[idx | this.bg[q + 0x0a]] | 0x10;
			data[p + 0x106] = BGCOLOR[idx | this.bg[q + 0x09]] | 0x10;
			data[p + 0x107] = BGCOLOR[idx | this.bg[q + 0x08]] | 0x10;
			data[p + 0x200] = BGCOLOR[idx | this.bg[q + 0x17]] | 0x10;
			data[p + 0x201] = BGCOLOR[idx | this.bg[q + 0x16]] | 0x10;
			data[p + 0x202] = BGCOLOR[idx | this.bg[q + 0x15]] | 0x10;
			data[p + 0x203] = BGCOLOR[idx | this.bg[q + 0x14]] | 0x10;
			data[p + 0x204] = BGCOLOR[idx | this.bg[q + 0x13]] | 0x10;
			data[p + 0x205] = BGCOLOR[idx | this.bg[q + 0x12]] | 0x10;
			data[p + 0x206] = BGCOLOR[idx | this.bg[q + 0x11]] | 0x10;
			data[p + 0x207] = BGCOLOR[idx | this.bg[q + 0x10]] | 0x10;
			data[p + 0x300] = BGCOLOR[idx | this.bg[q + 0x1f]] | 0x10;
			data[p + 0x301] = BGCOLOR[idx | this.bg[q + 0x1e]] | 0x10;
			data[p + 0x302] = BGCOLOR[idx | this.bg[q + 0x1d]] | 0x10;
			data[p + 0x303] = BGCOLOR[idx | this.bg[q + 0x1c]] | 0x10;
			data[p + 0x304] = BGCOLOR[idx | this.bg[q + 0x1b]] | 0x10;
			data[p + 0x305] = BGCOLOR[idx | this.bg[q + 0x1a]] | 0x10;
			data[p + 0x306] = BGCOLOR[idx | this.bg[q + 0x19]] | 0x10;
			data[p + 0x307] = BGCOLOR[idx | this.bg[q + 0x18]] | 0x10;
			data[p + 0x400] = BGCOLOR[idx | this.bg[q + 0x27]] | 0x10;
			data[p + 0x401] = BGCOLOR[idx | this.bg[q + 0x26]] | 0x10;
			data[p + 0x402] = BGCOLOR[idx | this.bg[q + 0x25]] | 0x10;
			data[p + 0x403] = BGCOLOR[idx | this.bg[q + 0x24]] | 0x10;
			data[p + 0x404] = BGCOLOR[idx | this.bg[q + 0x23]] | 0x10;
			data[p + 0x405] = BGCOLOR[idx | this.bg[q + 0x22]] | 0x10;
			data[p + 0x406] = BGCOLOR[idx | this.bg[q + 0x21]] | 0x10;
			data[p + 0x407] = BGCOLOR[idx | this.bg[q + 0x20]] | 0x10;
			data[p + 0x500] = BGCOLOR[idx | this.bg[q + 0x2f]] | 0x10;
			data[p + 0x501] = BGCOLOR[idx | this.bg[q + 0x2e]] | 0x10;
			data[p + 0x502] = BGCOLOR[idx | this.bg[q + 0x2d]] | 0x10;
			data[p + 0x503] = BGCOLOR[idx | this.bg[q + 0x2c]] | 0x10;
			data[p + 0x504] = BGCOLOR[idx | this.bg[q + 0x2b]] | 0x10;
			data[p + 0x505] = BGCOLOR[idx | this.bg[q + 0x2a]] | 0x10;
			data[p + 0x506] = BGCOLOR[idx | this.bg[q + 0x29]] | 0x10;
			data[p + 0x507] = BGCOLOR[idx | this.bg[q + 0x28]] | 0x10;
			data[p + 0x600] = BGCOLOR[idx | this.bg[q + 0x37]] | 0x10;
			data[p + 0x601] = BGCOLOR[idx | this.bg[q + 0x36]] | 0x10;
			data[p + 0x602] = BGCOLOR[idx | this.bg[q + 0x35]] | 0x10;
			data[p + 0x603] = BGCOLOR[idx | this.bg[q + 0x34]] | 0x10;
			data[p + 0x604] = BGCOLOR[idx | this.bg[q + 0x33]] | 0x10;
			data[p + 0x605] = BGCOLOR[idx | this.bg[q + 0x32]] | 0x10;
			data[p + 0x606] = BGCOLOR[idx | this.bg[q + 0x31]] | 0x10;
			data[p + 0x607] = BGCOLOR[idx | this.bg[q + 0x30]] | 0x10;
			data[p + 0x700] = BGCOLOR[idx | this.bg[q + 0x3f]] | 0x10;
			data[p + 0x701] = BGCOLOR[idx | this.bg[q + 0x3e]] | 0x10;
			data[p + 0x702] = BGCOLOR[idx | this.bg[q + 0x3d]] | 0x10;
			data[p + 0x703] = BGCOLOR[idx | this.bg[q + 0x3c]] | 0x10;
			data[p + 0x704] = BGCOLOR[idx | this.bg[q + 0x3b]] | 0x10;
			data[p + 0x705] = BGCOLOR[idx | this.bg[q + 0x3a]] | 0x10;
			data[p + 0x706] = BGCOLOR[idx | this.bg[q + 0x39]] | 0x10;
			data[p + 0x707] = BGCOLOR[idx | this.bg[q + 0x38]] | 0x10;
			break;
		case 3: // HV反転
			data[p + 0x000] = BGCOLOR[idx | this.bg[q + 0x3f]] | 0x10;
			data[p + 0x001] = BGCOLOR[idx | this.bg[q + 0x3e]] | 0x10;
			data[p + 0x002] = BGCOLOR[idx | this.bg[q + 0x3d]] | 0x10;
			data[p + 0x003] = BGCOLOR[idx | this.bg[q + 0x3c]] | 0x10;
			data[p + 0x004] = BGCOLOR[idx | this.bg[q + 0x3b]] | 0x10;
			data[p + 0x005] = BGCOLOR[idx | this.bg[q + 0x3a]] | 0x10;
			data[p + 0x006] = BGCOLOR[idx | this.bg[q + 0x39]] | 0x10;
			data[p + 0x007] = BGCOLOR[idx | this.bg[q + 0x38]] | 0x10;
			data[p + 0x100] = BGCOLOR[idx | this.bg[q + 0x37]] | 0x10;
			data[p + 0x101] = BGCOLOR[idx | this.bg[q + 0x36]] | 0x10;
			data[p + 0x102] = BGCOLOR[idx | this.bg[q + 0x35]] | 0x10;
			data[p + 0x103] = BGCOLOR[idx | this.bg[q + 0x34]] | 0x10;
			data[p + 0x104] = BGCOLOR[idx | this.bg[q + 0x33]] | 0x10;
			data[p + 0x105] = BGCOLOR[idx | this.bg[q + 0x32]] | 0x10;
			data[p + 0x106] = BGCOLOR[idx | this.bg[q + 0x31]] | 0x10;
			data[p + 0x107] = BGCOLOR[idx | this.bg[q + 0x30]] | 0x10;
			data[p + 0x200] = BGCOLOR[idx | this.bg[q + 0x2f]] | 0x10;
			data[p + 0x201] = BGCOLOR[idx | this.bg[q + 0x2e]] | 0x10;
			data[p + 0x202] = BGCOLOR[idx | this.bg[q + 0x2d]] | 0x10;
			data[p + 0x203] = BGCOLOR[idx | this.bg[q + 0x2c]] | 0x10;
			data[p + 0x204] = BGCOLOR[idx | this.bg[q + 0x2b]] | 0x10;
			data[p + 0x205] = BGCOLOR[idx | this.bg[q + 0x2a]] | 0x10;
			data[p + 0x206] = BGCOLOR[idx | this.bg[q + 0x29]] | 0x10;
			data[p + 0x207] = BGCOLOR[idx | this.bg[q + 0x28]] | 0x10;
			data[p + 0x300] = BGCOLOR[idx | this.bg[q + 0x27]] | 0x10;
			data[p + 0x301] = BGCOLOR[idx | this.bg[q + 0x26]] | 0x10;
			data[p + 0x302] = BGCOLOR[idx | this.bg[q + 0x25]] | 0x10;
			data[p + 0x303] = BGCOLOR[idx | this.bg[q + 0x24]] | 0x10;
			data[p + 0x304] = BGCOLOR[idx | this.bg[q + 0x23]] | 0x10;
			data[p + 0x305] = BGCOLOR[idx | this.bg[q + 0x22]] | 0x10;
			data[p + 0x306] = BGCOLOR[idx | this.bg[q + 0x21]] | 0x10;
			data[p + 0x307] = BGCOLOR[idx | this.bg[q + 0x20]] | 0x10;
			data[p + 0x400] = BGCOLOR[idx | this.bg[q + 0x1f]] | 0x10;
			data[p + 0x401] = BGCOLOR[idx | this.bg[q + 0x1e]] | 0x10;
			data[p + 0x402] = BGCOLOR[idx | this.bg[q + 0x1d]] | 0x10;
			data[p + 0x403] = BGCOLOR[idx | this.bg[q + 0x1c]] | 0x10;
			data[p + 0x404] = BGCOLOR[idx | this.bg[q + 0x1b]] | 0x10;
			data[p + 0x405] = BGCOLOR[idx | this.bg[q + 0x1a]] | 0x10;
			data[p + 0x406] = BGCOLOR[idx | this.bg[q + 0x19]] | 0x10;
			data[p + 0x407] = BGCOLOR[idx | this.bg[q + 0x18]] | 0x10;
			data[p + 0x500] = BGCOLOR[idx | this.bg[q + 0x17]] | 0x10;
			data[p + 0x501] = BGCOLOR[idx | this.bg[q + 0x16]] | 0x10;
			data[p + 0x502] = BGCOLOR[idx | this.bg[q + 0x15]] | 0x10;
			data[p + 0x503] = BGCOLOR[idx | this.bg[q + 0x14]] | 0x10;
			data[p + 0x504] = BGCOLOR[idx | this.bg[q + 0x13]] | 0x10;
			data[p + 0x505] = BGCOLOR[idx | this.bg[q + 0x12]] | 0x10;
			data[p + 0x506] = BGCOLOR[idx | this.bg[q + 0x11]] | 0x10;
			data[p + 0x507] = BGCOLOR[idx | this.bg[q + 0x10]] | 0x10;
			data[p + 0x600] = BGCOLOR[idx | this.bg[q + 0x0f]] | 0x10;
			data[p + 0x601] = BGCOLOR[idx | this.bg[q + 0x0e]] | 0x10;
			data[p + 0x602] = BGCOLOR[idx | this.bg[q + 0x0d]] | 0x10;
			data[p + 0x603] = BGCOLOR[idx | this.bg[q + 0x0c]] | 0x10;
			data[p + 0x604] = BGCOLOR[idx | this.bg[q + 0x0b]] | 0x10;
			data[p + 0x605] = BGCOLOR[idx | this.bg[q + 0x0a]] | 0x10;
			data[p + 0x606] = BGCOLOR[idx | this.bg[q + 0x09]] | 0x10;
			data[p + 0x607] = BGCOLOR[idx | this.bg[q + 0x08]] | 0x10;
			data[p + 0x700] = BGCOLOR[idx | this.bg[q + 0x07]] | 0x10;
			data[p + 0x701] = BGCOLOR[idx | this.bg[q + 0x06]] | 0x10;
			data[p + 0x702] = BGCOLOR[idx | this.bg[q + 0x05]] | 0x10;
			data[p + 0x703] = BGCOLOR[idx | this.bg[q + 0x04]] | 0x10;
			data[p + 0x704] = BGCOLOR[idx | this.bg[q + 0x03]] | 0x10;
			data[p + 0x705] = BGCOLOR[idx | this.bg[q + 0x02]] | 0x10;
			data[p + 0x706] = BGCOLOR[idx | this.bg[q + 0x01]] | 0x10;
			data[p + 0x707] = BGCOLOR[idx | this.bg[q + 0x00]] | 0x10;
			break;
		}
	}

	xfer16x16(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px, i, j;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		for (src = src << 8 & 0xff00, i = 16; i !== 0; dst += 256 - 16, --i)
			for (j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[src++]]) !== 0)
					data[dst] = px;
	}

	xfer16x16V(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px, i, j;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		for (src = (src << 8 & 0xff00) + 256 - 16, i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[src++]]) !== 0)
					data[dst] = px;
	}

	xfer16x16H(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px, i, j;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		for (src = (src << 8 & 0xff00) + 16, i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[--src]]) !== 0)
					data[dst] = px;
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px, i, j;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		for (src = (src << 8 & 0xff00) + 256, i = 16; i !== 0; dst += 256 - 16, --i)
			for (j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[--src]]) !== 0)
					data[dst] = px;
	}
}

/*
 *
 *	Time Pilot
 *
 */

const url = 'timeplt.zip';
let PRG1, PRG2, BG, OBJ, RGB_H, RGB_L, OBJCOLOR, BGCOLOR;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG1 = new Uint8Array((zip.files['tm1'].inflate() + zip.files['tm2'].inflate() + zip.files['tm3'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	PRG2 = new Uint8Array(zip.files['tm7'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	BG = new Uint8Array(zip.files['tm6'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJ = new Uint8Array((zip.files['tm4'].inflate() + zip.files['tm5'].inflate()).split('').map(c => c.charCodeAt(0)));
	RGB_H = new Uint8Array(zip.files['timeplt.b4'].inflate().split('').map(c => c.charCodeAt(0)));
	RGB_L = new Uint8Array(zip.files['timeplt.b5'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJCOLOR = new Uint8Array(zip.files['timeplt.e9'].inflate().split('').map(c => c.charCodeAt(0)));
	BGCOLOR = new Uint8Array(zip.files['timeplt.e12'].inflate().split('').map(c => c.charCodeAt(0)));
	init({
		game: new TimePilot(),
		sound: sound = [
			new AY_3_8910({clock: 14318181 / 8, resolution: 58, gain: 0.3}),
			new AY_3_8910({clock: 14318181 / 8, resolution: 58, gain: 0.3}),
		],
	});
	loop();
}

