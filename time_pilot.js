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

		this.cpu = new Z80(this);
		for (let i = 0; i < 0x60; i++)
			this.cpu.memorymap[i].base = PRG1.base[i];
		for (let i = 0; i < 0x10; i++) {
			this.cpu.memorymap[0xa0 + i].base = this.ram.base[i];
			this.cpu.memorymap[0xa0 + i].write = null;
		}
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0xb8 + i].base = this.cpu.memorymap[0xb0 + i].base = this.ram.base[0x10];
			this.cpu.memorymap[0xb8 + i].write = this.cpu.memorymap[0xb0 + i].write = null;
			this.cpu.memorymap[0xbc + i].base = this.cpu.memorymap[0xb4 + i].base = this.ram.base[0x11];
			this.cpu.memorymap[0xbc + i].write = this.cpu.memorymap[0xb4 + i].write = null;
		}
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0xc0 + i * 4].read = () => this.vpos;
			this.cpu.memorymap[0xc0 + i * 4].write = (addr, data) => this.command.push(data);
			this.cpu.memorymap[0xc2 + i * 4].read = () => this.in[4];
			this.cpu.memorymap[0xc3 + i * 4].read = addr => this.in[addr >>> 5 & 3];
		}
		this.cpu.memorymap[0xc3].write = (addr, data) => {
			switch (addr >>> 1 & 0x7f) {
			case 0:
				this.fInterruptEnable = (data & 1) !== 0;
				break;
			case 3:
				this.fSoundEnable = (data & 1) === 0;
				break;
			}
		};

		this.cpu2 = new Z80(this);
		for (let i = 0; i < 0x10; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 4; i++) {
			this.cpu2.memorymap[0x3c + i].base = this.cpu2.memorymap[0x38 + i].base = this.cpu2.memorymap[0x34 + i].base = this.cpu2.memorymap[0x30 + i].base = this.ram2.base[i];
			this.cpu2.memorymap[0x3c + i].write = this.cpu2.memorymap[0x38 + i].write = this.cpu2.memorymap[0x34 + i].write = this.cpu2.memorymap[0x30 + i].write = null;
		}
		for (let i = 0; i < 0x10; i++) {
			this.cpu2.memorymap[0x40 + i].read = () => sound[0].read(this.psg[0].addr);
			this.cpu2.memorymap[0x40 + i].write = (addr, data) => sound[0].write(this.psg[0].addr, data, this.count);
			this.cpu2.memorymap[0x50 + i].write = (addr, data) => this.psg[0].addr = data;
			this.cpu2.memorymap[0x60 + i].read = () => sound[1].read(this.psg[1].addr);
			this.cpu2.memorymap[0x60 + i].write = (addr, data) => sound[1].write(this.psg[1].addr, data, this.count);
			this.cpu2.memorymap[0x70 + i].write = (addr, data) => this.psg[1].addr = data;
		}

		// Videoの初期化
		this.bg = new Uint32Array(0x100000);
		this.obj = new Uint8Array(0x10000);
		this.objcolor = new Uint32Array(0x100);
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
			this.rgb[i] = ((RGB_H[i] << 8 | RGB_L[i]) >>> 1 & 31) * 255 / 31	// Red
				| ((RGB_H[i] << 8 | RGB_L[i]) >>> 6 & 31) * 255 / 31 << 8		// Green
				| ((RGB_H[i] << 8 | RGB_L[i]) >>> 11) * 255 / 31 << 16;			// Blue
	}

	convertBG() {
		for (let p = 0, q = 0, i = 256; i !== 0; q += 16, --i) {
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k] >>> (j + 4) & 1 | BG[q + k] >>> j << 1 & 2;
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k + 8] >>> (j + 4) & 1 | BG[q + k + 8] >>> j << 1 & 2;
		}
		for (let p = 0, i = 31; i !== 0; p += 0x4000, --i)
			this.bg.copyWithin(p + 0x4000, p, p + 0x4000);
		for (let p = 0, i = 0; i < 16; i++)
			for (let j = 0x4000; j !== 0; p++, --j)
				this.bg[p] = this.rgb[BGCOLOR[i * 4 + this.bg[p]] & 0x0f | 0x10];
		for (let p = 0x40000, i = 16; i < 32; i++)
			for (let j = 0x4000; j !== 0; p++, --j)
				this.bg[p] = this.rgb[BGCOLOR[i * 4 + this.bg[p]] & 0x0f | 0x10] | 0xff000000;
		for (let p = 0x80000, q = 0x1000, i = 256; i !== 0; q += 16, --i) {
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k] >>> (j + 4) & 1 | BG[q + k] >>> j << 1 & 2;
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k + 8] >>> (j + 4) & 1 | BG[q + k + 8] >>> j << 1 & 2;
		}
		for (let p = 0x80000, i = 31; i !== 0; p += 0x4000, --i)
			this.bg.copyWithin(p + 0x4000, p, p + 0x4000);
		for (let p = 0x80000, i = 0; i < 16; i++)
			for (let j = 0x4000; j !== 0; p++, --j)
				this.bg[p] = this.rgb[BGCOLOR[i * 4 + this.bg[p]] & 0x0f | 0x10];
		for (let p = 0xc0000, i = 16; i < 32; i++)
			for (let j = 0x4000; j !== 0; p++, --j)
				this.bg[p] = this.rgb[BGCOLOR[i * 4 + this.bg[p]] & 0x0f | 0x10] | 0xff000000;
	}

	convertOBJ() {
		// obj palette
		for (let i = 0; i < 0x100; i++)
			this.objcolor[i] = this.rgb[OBJCOLOR[i] & 0x0f];

		// 4 color object
		for (let p = 0, q = 0, i = 256; i !== 0; q += 64, --i) {
			for (let j = 0; j < 4; j++) {
				for (let k = 63; k >= 56; --k)
					this.obj[p++] = OBJ[q + k] >>> (j + 4) & 1 | OBJ[q + k] >>> j << 1 & 2;
				for (let k = 31; k >= 24; --k)
					this.obj[p++] = OBJ[q + k] >>> (j + 4) & 1 | OBJ[q + k] >>> j << 1 & 2;
			}
			for (let j = 0; j < 4; j++) {
				for (let k = 55; k >= 48; --k)
					this.obj[p++] = OBJ[q + k] >>> (j + 4) & 1 | OBJ[q + k] >>> j << 1 & 2;
				for (let k = 23; k >= 16; --k)
					this.obj[p++] = OBJ[q + k] >>> (j + 4) & 1 | OBJ[q + k] >>> j << 1 & 2;
			}
			for (let j = 0; j < 4; j++) {
				for (let k = 47; k >= 40; --k)
					this.obj[p++] = OBJ[q + k] >>> (j + 4) & 1 | OBJ[q + k] >>> j << 1 & 2;
				for (let k = 15; k >= 8; --k)
					this.obj[p++] = OBJ[q + k] >>> (j + 4) & 1 | OBJ[q + k] >>> j << 1 & 2;
			}
			for (let j = 0; j < 4; j++) {
				for (let k = 39; k >= 32; --k)
					this.obj[p++] = OBJ[q + k] >>> (j + 4) & 1 | OBJ[q + k] >>> j << 1 & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k] >>> (j + 4) & 1 | OBJ[q + k] >>> j << 1 & 2;
			}
		}
	}

	makeBitmap(data) {
		// bg 描画
		let p = 256 * 8 * 2 + 232;
		let k = 0x40;
		for (let i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				this.xfer8x8(data, p, k);

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

		// alphaチャンネル修正
		p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] |= 0xff000000;
	}

	xfer8x8(data, p, k) {
		const q = (this.ram[0x400 + k] | this.ram[k] << 8 & 0x3f00) << 6;

		switch (this.ram[k] >>> 6) {
		case 0: // ノーマル
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
			break;
		case 1: // V反転
			data[p + 0x000] = this.bg[q + 0x38];
			data[p + 0x001] = this.bg[q + 0x39];
			data[p + 0x002] = this.bg[q + 0x3a];
			data[p + 0x003] = this.bg[q + 0x3b];
			data[p + 0x004] = this.bg[q + 0x3c];
			data[p + 0x005] = this.bg[q + 0x3d];
			data[p + 0x006] = this.bg[q + 0x3e];
			data[p + 0x007] = this.bg[q + 0x3f];
			data[p + 0x100] = this.bg[q + 0x30];
			data[p + 0x101] = this.bg[q + 0x31];
			data[p + 0x102] = this.bg[q + 0x32];
			data[p + 0x103] = this.bg[q + 0x33];
			data[p + 0x104] = this.bg[q + 0x34];
			data[p + 0x105] = this.bg[q + 0x35];
			data[p + 0x106] = this.bg[q + 0x36];
			data[p + 0x107] = this.bg[q + 0x37];
			data[p + 0x200] = this.bg[q + 0x28];
			data[p + 0x201] = this.bg[q + 0x29];
			data[p + 0x202] = this.bg[q + 0x2a];
			data[p + 0x203] = this.bg[q + 0x2b];
			data[p + 0x204] = this.bg[q + 0x2c];
			data[p + 0x205] = this.bg[q + 0x2d];
			data[p + 0x206] = this.bg[q + 0x2e];
			data[p + 0x207] = this.bg[q + 0x2f];
			data[p + 0x300] = this.bg[q + 0x20];
			data[p + 0x301] = this.bg[q + 0x21];
			data[p + 0x302] = this.bg[q + 0x22];
			data[p + 0x303] = this.bg[q + 0x23];
			data[p + 0x304] = this.bg[q + 0x24];
			data[p + 0x305] = this.bg[q + 0x25];
			data[p + 0x306] = this.bg[q + 0x26];
			data[p + 0x307] = this.bg[q + 0x27];
			data[p + 0x400] = this.bg[q + 0x18];
			data[p + 0x401] = this.bg[q + 0x19];
			data[p + 0x402] = this.bg[q + 0x1a];
			data[p + 0x403] = this.bg[q + 0x1b];
			data[p + 0x404] = this.bg[q + 0x1c];
			data[p + 0x405] = this.bg[q + 0x1d];
			data[p + 0x406] = this.bg[q + 0x1e];
			data[p + 0x407] = this.bg[q + 0x1f];
			data[p + 0x500] = this.bg[q + 0x10];
			data[p + 0x501] = this.bg[q + 0x11];
			data[p + 0x502] = this.bg[q + 0x12];
			data[p + 0x503] = this.bg[q + 0x13];
			data[p + 0x504] = this.bg[q + 0x14];
			data[p + 0x505] = this.bg[q + 0x15];
			data[p + 0x506] = this.bg[q + 0x16];
			data[p + 0x507] = this.bg[q + 0x17];
			data[p + 0x600] = this.bg[q + 0x08];
			data[p + 0x601] = this.bg[q + 0x09];
			data[p + 0x602] = this.bg[q + 0x0a];
			data[p + 0x603] = this.bg[q + 0x0b];
			data[p + 0x604] = this.bg[q + 0x0c];
			data[p + 0x605] = this.bg[q + 0x0d];
			data[p + 0x606] = this.bg[q + 0x0e];
			data[p + 0x607] = this.bg[q + 0x0f];
			data[p + 0x700] = this.bg[q + 0x00];
			data[p + 0x701] = this.bg[q + 0x01];
			data[p + 0x702] = this.bg[q + 0x02];
			data[p + 0x703] = this.bg[q + 0x03];
			data[p + 0x704] = this.bg[q + 0x04];
			data[p + 0x705] = this.bg[q + 0x05];
			data[p + 0x706] = this.bg[q + 0x06];
			data[p + 0x707] = this.bg[q + 0x07];
			break;
		case 2: // H反転
			data[p + 0x000] = this.bg[q + 0x07];
			data[p + 0x001] = this.bg[q + 0x06];
			data[p + 0x002] = this.bg[q + 0x05];
			data[p + 0x003] = this.bg[q + 0x04];
			data[p + 0x004] = this.bg[q + 0x03];
			data[p + 0x005] = this.bg[q + 0x02];
			data[p + 0x006] = this.bg[q + 0x01];
			data[p + 0x007] = this.bg[q + 0x00];
			data[p + 0x100] = this.bg[q + 0x0f];
			data[p + 0x101] = this.bg[q + 0x0e];
			data[p + 0x102] = this.bg[q + 0x0d];
			data[p + 0x103] = this.bg[q + 0x0c];
			data[p + 0x104] = this.bg[q + 0x0b];
			data[p + 0x105] = this.bg[q + 0x0a];
			data[p + 0x106] = this.bg[q + 0x09];
			data[p + 0x107] = this.bg[q + 0x08];
			data[p + 0x200] = this.bg[q + 0x17];
			data[p + 0x201] = this.bg[q + 0x16];
			data[p + 0x202] = this.bg[q + 0x15];
			data[p + 0x203] = this.bg[q + 0x14];
			data[p + 0x204] = this.bg[q + 0x13];
			data[p + 0x205] = this.bg[q + 0x12];
			data[p + 0x206] = this.bg[q + 0x11];
			data[p + 0x207] = this.bg[q + 0x10];
			data[p + 0x300] = this.bg[q + 0x1f];
			data[p + 0x301] = this.bg[q + 0x1e];
			data[p + 0x302] = this.bg[q + 0x1d];
			data[p + 0x303] = this.bg[q + 0x1c];
			data[p + 0x304] = this.bg[q + 0x1b];
			data[p + 0x305] = this.bg[q + 0x1a];
			data[p + 0x306] = this.bg[q + 0x19];
			data[p + 0x307] = this.bg[q + 0x18];
			data[p + 0x400] = this.bg[q + 0x27];
			data[p + 0x401] = this.bg[q + 0x26];
			data[p + 0x402] = this.bg[q + 0x25];
			data[p + 0x403] = this.bg[q + 0x24];
			data[p + 0x404] = this.bg[q + 0x23];
			data[p + 0x405] = this.bg[q + 0x22];
			data[p + 0x406] = this.bg[q + 0x21];
			data[p + 0x407] = this.bg[q + 0x20];
			data[p + 0x500] = this.bg[q + 0x2f];
			data[p + 0x501] = this.bg[q + 0x2e];
			data[p + 0x502] = this.bg[q + 0x2d];
			data[p + 0x503] = this.bg[q + 0x2c];
			data[p + 0x504] = this.bg[q + 0x2b];
			data[p + 0x505] = this.bg[q + 0x2a];
			data[p + 0x506] = this.bg[q + 0x29];
			data[p + 0x507] = this.bg[q + 0x28];
			data[p + 0x600] = this.bg[q + 0x37];
			data[p + 0x601] = this.bg[q + 0x36];
			data[p + 0x602] = this.bg[q + 0x35];
			data[p + 0x603] = this.bg[q + 0x34];
			data[p + 0x604] = this.bg[q + 0x33];
			data[p + 0x605] = this.bg[q + 0x32];
			data[p + 0x606] = this.bg[q + 0x31];
			data[p + 0x607] = this.bg[q + 0x30];
			data[p + 0x700] = this.bg[q + 0x3f];
			data[p + 0x701] = this.bg[q + 0x3e];
			data[p + 0x702] = this.bg[q + 0x3d];
			data[p + 0x703] = this.bg[q + 0x3c];
			data[p + 0x704] = this.bg[q + 0x3b];
			data[p + 0x705] = this.bg[q + 0x3a];
			data[p + 0x706] = this.bg[q + 0x39];
			data[p + 0x707] = this.bg[q + 0x38];
			break;
		case 3: // HV反転
			data[p + 0x000] = this.bg[q + 0x3f];
			data[p + 0x001] = this.bg[q + 0x3e];
			data[p + 0x002] = this.bg[q + 0x3d];
			data[p + 0x003] = this.bg[q + 0x3c];
			data[p + 0x004] = this.bg[q + 0x3b];
			data[p + 0x005] = this.bg[q + 0x3a];
			data[p + 0x006] = this.bg[q + 0x39];
			data[p + 0x007] = this.bg[q + 0x38];
			data[p + 0x100] = this.bg[q + 0x37];
			data[p + 0x101] = this.bg[q + 0x36];
			data[p + 0x102] = this.bg[q + 0x35];
			data[p + 0x103] = this.bg[q + 0x34];
			data[p + 0x104] = this.bg[q + 0x33];
			data[p + 0x105] = this.bg[q + 0x32];
			data[p + 0x106] = this.bg[q + 0x31];
			data[p + 0x107] = this.bg[q + 0x30];
			data[p + 0x200] = this.bg[q + 0x2f];
			data[p + 0x201] = this.bg[q + 0x2e];
			data[p + 0x202] = this.bg[q + 0x2d];
			data[p + 0x203] = this.bg[q + 0x2c];
			data[p + 0x204] = this.bg[q + 0x2b];
			data[p + 0x205] = this.bg[q + 0x2a];
			data[p + 0x206] = this.bg[q + 0x29];
			data[p + 0x207] = this.bg[q + 0x28];
			data[p + 0x300] = this.bg[q + 0x27];
			data[p + 0x301] = this.bg[q + 0x26];
			data[p + 0x302] = this.bg[q + 0x25];
			data[p + 0x303] = this.bg[q + 0x24];
			data[p + 0x304] = this.bg[q + 0x23];
			data[p + 0x305] = this.bg[q + 0x22];
			data[p + 0x306] = this.bg[q + 0x21];
			data[p + 0x307] = this.bg[q + 0x20];
			data[p + 0x400] = this.bg[q + 0x1f];
			data[p + 0x401] = this.bg[q + 0x1e];
			data[p + 0x402] = this.bg[q + 0x1d];
			data[p + 0x403] = this.bg[q + 0x1c];
			data[p + 0x404] = this.bg[q + 0x1b];
			data[p + 0x405] = this.bg[q + 0x1a];
			data[p + 0x406] = this.bg[q + 0x19];
			data[p + 0x407] = this.bg[q + 0x18];
			data[p + 0x500] = this.bg[q + 0x17];
			data[p + 0x501] = this.bg[q + 0x16];
			data[p + 0x502] = this.bg[q + 0x15];
			data[p + 0x503] = this.bg[q + 0x14];
			data[p + 0x504] = this.bg[q + 0x13];
			data[p + 0x505] = this.bg[q + 0x12];
			data[p + 0x506] = this.bg[q + 0x11];
			data[p + 0x507] = this.bg[q + 0x10];
			data[p + 0x600] = this.bg[q + 0x0f];
			data[p + 0x601] = this.bg[q + 0x0e];
			data[p + 0x602] = this.bg[q + 0x0d];
			data[p + 0x603] = this.bg[q + 0x0c];
			data[p + 0x604] = this.bg[q + 0x0b];
			data[p + 0x605] = this.bg[q + 0x0a];
			data[p + 0x606] = this.bg[q + 0x09];
			data[p + 0x607] = this.bg[q + 0x08];
			data[p + 0x700] = this.bg[q + 0x07];
			data[p + 0x701] = this.bg[q + 0x06];
			data[p + 0x702] = this.bg[q + 0x05];
			data[p + 0x703] = this.bg[q + 0x04];
			data[p + 0x704] = this.bg[q + 0x03];
			data[p + 0x705] = this.bg[q + 0x02];
			data[p + 0x706] = this.bg[q + 0x01];
			data[p + 0x707] = this.bg[q + 0x00];
			break;
		}
	}

	xfer16x16(data, dst, src) {
		const idx = src >>> 6 & 0xfc;
		let px, i, j;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		for (src = src << 8 & 0xff00, i = 16; i !== 0; dst += 256 - 16, --i)
			for (j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx + this.obj[src++]]) !== 0 && (data[dst] & 0xff000000) === 0)
					data[dst] = px;
	}

	xfer16x16V(data, dst, src) {
		const idx = src >>> 6 & 0xfc;
		let px, i, j;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		for (src = (src << 8 & 0xff00) + 256 - 16, i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx + this.obj[src++]]) !== 0 && (data[dst] & 0xff000000) === 0)
					data[dst] = px;
	}

	xfer16x16H(data, dst, src) {
		const idx = src >>> 6 & 0xfc;
		let px, i, j;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		for (src = (src << 8 & 0xff00) + 16, i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx + this.obj[--src]]) !== 0 && (data[dst] & 0xff000000) === 0)
					data[dst] = px;
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >>> 6 & 0xfc;
		let px, i, j;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		for (src = (src << 8 & 0xff00) + 256, i = 16; i !== 0; dst += 256 - 16, --i)
			for (j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx + this.obj[--src]]) !== 0 && (data[dst] & 0xff000000) === 0)
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
			new AY_3_8910({clock: 14318181 / 8, resolution: 58, gain: 0.5}),
			new AY_3_8910({clock: 14318181 / 8, resolution: 58, gain: 0.5}),
		],
	});
	loop();
}

