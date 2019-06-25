/*
 *
 *	Toypop
 *
 */

import MappySound from './mappy_sound.js';
import Cpu, {init, loop} from './main.js';
import MC6809 from './mc6809.js';
import MC68000 from  './mc68000.js';
let sound;

class Toypop {
	constructor() {
		this.cxScreen = 224;
		this.cyScreen = 288;
		this.width = 256;
		this.height = 512;
		this.xOffset = 16;
		this.yOffset = 16;
		this.fReset = true;
		this.fTest = false;
		this.fDIPSwitchChanged = true;
		this.fCoin = false;
		this.fStart1P = false;
		this.fStart2P = false;
		this.nPino = 3;
		this.nBonus = 'A';
		this.nRank = 'NORMAL';
		this.fAttract = true;
		this.fRound = false;

		// CPU周りの初期化
		this.fInterruptEnable2 = false;

		this.ram = new Uint8Array(0x2100).addBase();
		this.ram2 = new Uint8Array(0x800).addBase();
		this.ram3 = new Uint8Array(0x40000).addBase();
		this.vram = new Uint8Array(0x10000).addBase();
		this.port = new Uint8Array(0x30);

		this.cpu = [new MC6809(this), new MC6809(this), new MC68000(this)];

		for (let i = 0; i < 0x20; i++) {
			this.cpu[0].memorymap[i].base = this.ram.base[i];
			this.cpu[0].memorymap[i].write = null;
		}
		for (let i = 0; i < 8; i++) {
			this.cpu[0].memorymap[0x28 + i].base = this.ram2.base[i];
			this.cpu[0].memorymap[0x28 + i].write = null;
		}
		this.cpu[0].memorymap[0x60].base = this.ram.base[0x20];
		this.cpu[0].memorymap[0x60].write = null;
		for (let i = 0; i < 4; i++) {
			this.cpu[0].memorymap[0x68 + i].read = addr => sound.read(addr);
			this.cpu[0].memorymap[0x68 + i].write = (addr, data) => sound.write(addr, data);
		}
		for (let i = 0; i < 0x80; i++)
			this.cpu[0].memorymap[0x80 + i].base = PRG1.base[i];
		this.cpu[0].memorymap[0x80].write = () => this.cpu[2].enable();
		this.cpu[0].memorymap[0x88].write = () => this.cpu[2].disable();
		this.cpu[0].memorymap[0x90].write = () => this.cpu[1].enable();
		this.cpu[0].memorymap[0x98].write = () => this.cpu[1].disable();
		this.cpu[0].memorymap[0xa0].write = addr => this.palette = addr << 7 & 0x80;

		for (let i = 0; i < 4; i++) {
			this.cpu[1].memorymap[i].read = addr => sound.read(addr);
			this.cpu[1].memorymap[i].write = (addr, data) => sound.write(addr, data);
		}
		for (let i = 0; i < 0x20; i++)
			this.cpu[1].memorymap[0xe0 + i].base = PRG2.base[i];

		for (let i = 0; i < 0x80; i++)
			this.cpu[2].memorymap[i].base = PRG3.base[i];
		for (let i = 0; i < 0x400; i++) {
			this.cpu[2].memorymap[0x800 + i].base = this.ram3.base[i];
			this.cpu[2].memorymap[0x800 + i].write = null;
		}
		for (let i = 0; i < 0x10; i++) {
			this.cpu[2].memorymap[0x1000 + i].read = addr => this.ram2[addr >>> 1 & 0x7ff];
			this.cpu[2].memorymap[0x1000 + i].write = (addr, data) => this.ram2[addr >>> 1 & 0x7ff] = data;
		}
		for (let i = 0; i < 0x80; i++) {
			this.cpu[2].memorymap[0x1800 + i].read = addr => this.vram[addr = addr << 1 & 0xfffe] << 4 | this.vram[addr | 1] & 0xf;
			this.cpu[2].memorymap[0x1800 + i].write = (addr, data) => {
				this.vram[addr = addr << 1 & 0xfffe] = data >> 4;
				this.vram[addr | 1] = data & 0xf;
			};
		}
		for (let i = 0; i < 0x500; i++) {
			this.cpu[2].memorymap[0x1900 + i].base = this.vram.base[i & 0xff];
			this.cpu[2].memorymap[0x1900 + i].write = null;
		}
		for (let i = 0; i < 0x1000; i++)
			this.cpu[2].memorymap[0x3000 + i].write16 = addr => this.fInterruptEnable2 = (addr & 0x80000) === 0;

		// Videoの初期化
		this.bg = new Uint8Array(0x8000);
		this.obj = new Uint8Array(0x10000);
		this.rgb = new Uint32Array(0x100);
		this.palette = 0;
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();
	}

	execute() {
		this.cpu[0].interrupt();
		this.cpu[1].interrupt();
		if (this.fInterruptEnable2)
			this.cpu[2].interrupt(6);
		for (let i = 0; i < 0x100; i++) {
			Cpu.multiple_execute([this.cpu[0], this.cpu[1]], 32);
			this.cpu[2].execute(48);
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
			switch (this.nPino) {
			case 1:
				this.port[0x13] = this.port[0x13] & ~3 | 1;
				break;
			case 2:
				this.port[0x13] = this.port[0x13] & ~3 | 2;
				break;
			case 3:
				this.port[0x13] &= ~3;
				break;
			case 5:
				this.port[0x13] |= 3;
				break;
			}
			switch (this.nBonus) {
			case 'A':
				this.port[0x12] &= ~8;
				break;
			case 'B':
				this.port[0x12] |= 8;
				break;
			}
			switch (this.nRank) {
			case 'EASY':
				this.port[0x12] = this.port[0x12] & ~6 | 2;
				break;
			case 'NORMAL':
				this.port[0x12] &= ~6;
				break;
			case 'HARD':
				this.port[0x12] = this.port[0x12] & ~6 | 4;
				break;
			case 'VERY HARD':
				this.port[0x12] |= 6;
				break;
			}
			if (this.fAttract)
				this.port[0x11] &= ~8;
			else
				this.port[0x11] |= 8;
			if (this.fRound)
				this.port[0x11] |= 2;
			else
				this.port[0x11] &= ~2;
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.port[0x10] |= 8;
		else
			this.port[0x10] &= ~8;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu[0].reset();
			this.cpu[1].disable();
			this.cpu[2].disable();
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if (this.fCoin) {
			--this.fCoin;
			this.port[4] |= 1 << 0;
		}
		else
			this.port[4] &= ~(1 << 0);
		if (this.fStart1P) {
			--this.fStart1P;
			this.port[7] |= 1 << 2;
		}
		else
			this.port[7] &= ~(1 << 2);
		if (this.fStart2P) {
			--this.fStart2P;
			this.port[7] |= 1 << 3;
		}
		else
			this.port[7] &= ~(1 << 3);

		// Port Emulations
		this.ram.set(this.port.subarray(4, 8), 0x2004);
		this.ram.set(this.port.subarray(0x10, 0x14), 0x2010);
		this.ram.set(this.port.subarray(0x20, 0x28), 0x2020);
		if ((this.ram[0x2008] & 0x0f) === 5) {
			this.ram[0x2002] = 0x0f;
			this.ram[0x2006] = 0x0c;
		}
		if ((this.ram[0x2018] & 0x0f) === 8) {
			const sum = new Array(this.ram.subarray(0x2019, 0x2020)).reduce((a, b) => a + (b & 0x0f));
			this.ram[0x2010] = sum >> 4 & 0x0f;
			this.ram[0x2011] = sum & 0x0f;
		}
		if ((this.ram[0x2028] & 0x0f) === 8) {
			const sum = new Array(this.ram.subarray(0x2029, 0x2030)).reduce((a, b) => a + (b & 0x0f));
			this.ram[0x2020] = sum >> 4 & 0x0f;
			this.ram[0x2021] = sum & 0x0f;
		}
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
			this.port[5] = this.port[5] & 0xf0 | 1 << 0;
		else
			this.port[5] &= ~(1 << 0);
	}

	right(fDown) {
		if (fDown)
			this.port[5] = this.port[5] & 0xf0 | 1 << 1;
		else
			this.port[5] &= ~(1 << 1);
	}

	down(fDown) {
		if (fDown)
			this.port[5] = this.port[5] & 0xf0 | 1 << 2;
		else
			this.port[5] &= ~(1 << 2);
	}

	left(fDown) {
		if (fDown)
			this.port[5] = this.port[5] & 0xf0 | 1 << 3;
		else
			this.port[5] &= ~(1 << 3);
	}

	triggerA(fDown) {
		if (fDown)
			this.port[7] |= 1 << 0;
		else
			this.port[7] &= ~(1 << 0);
	}

	triggerB(fDown) {
	}

	convertRGB() {
		for (let i = 0; i < 0x100; i++)
			this.rgb[i] = (RED[i] & 0x0f) * 255 / 15	// Red
				| (GREEN[i] & 0x0f) * 255 / 15 << 8		// Green
				| (BLUE[i] & 0x0f) * 255 / 15 << 16		// Blue
				| 0xff000000;							// Alpha
	}

	convertBG() {
		// 4 color bg
		for (let p = 0, q = 0, i = 512; i !== 0; q += 16, --i) {
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k + 8] >>> j & 1 | BG[q + k + 8] >>> (j + 3) & 2;
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k] >>> j & 1 | BG[q + k] >>> (j + 3) & 2;
		}
	}

	convertOBJ() {
		// 4 color object
		for (let p = 0, q = 0, i = 256; i !== 0; q += 64, --i) {
			for (let j = 3; j >= 0; --j) {
				for (let k = 39; k >= 32; --k)
					this.obj[p++] = OBJ[q + k] >>> j & 1 | OBJ[q + k] >>> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k] >>> j & 1 | OBJ[q + k] >>> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 47; k >= 40; --k)
					this.obj[p++] = OBJ[q + k] >>> j & 1 | OBJ[q + k] >>> (j + 3) & 2;
				for (let k = 15; k >= 8; --k)
					this.obj[p++] = OBJ[q + k] >>> j & 1 | OBJ[q + k] >>> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 55; k >= 48; --k)
					this.obj[p++] = OBJ[q + k] >>> j & 1 | OBJ[q + k] >>> (j + 3) & 2;
				for (let k = 23; k >= 16; --k)
					this.obj[p++] = OBJ[q + k] >>> j & 1 | OBJ[q + k] >>> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 63; k >= 56; --k)
					this.obj[p++] = OBJ[q + k] >>> j & 1 | OBJ[q + k] >>> (j + 3) & 2;
				for (let k = 31; k >= 24; --k)
					this.obj[p++] = OBJ[q + k] >>> j & 1 | OBJ[q + k] >>> (j + 3) & 2;
			}
		}
	}

	makeBitmap(data) {
		// graphic 描画
		let p = 256 * 8 * 2 + 239;
		let k = 0x200;
		let idx = 0x60 | this.palette;
		for (let i = 0; i < 224; p -= 256 * 288 + 1, i++)
			for (let j = 0; j < 288; k++, p += 256, j++)
				data[p] = idx | this.vram[k];

		// bg 描画
		p = 256 * 8 * 4 + 232;
		k = 0x40;
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
		for (let p = 0xf80, i = 64; i !== 0; p += 2, --i) {
			const y = 0x167 - this.ram[p + 0x801] - this.ram[p + 0x1001] * 0x100 & 0x1ff;
			const x = 0xe9 - this.ram[p + 0x800] & 0xff;
			const src = this.ram[p] | this.ram[p + 1] << 8;
			switch (this.ram[p + 0x1000] & 0x0f) {
			case 0x00: // ノーマル
				this.xfer16x16(data, x | y << 8, src);
				break;
			case 0x01: // V反転
				this.xfer16x16V(data, x | y << 8, src);
				break;
			case 0x02: // H反転
				this.xfer16x16H(data, x | y << 8, src);
				break;
			case 0x03: // HV反転
				this.xfer16x16HV(data, x | y << 8, src);
				break;
			case 0x04: // ノーマル
				this.xfer16x16(data, x | y << 8, src | 1);
				this.xfer16x16(data, x | (y - 16 & 0x1ff) << 8, src & ~1);
				break;
			case 0x05: // V反転
				this.xfer16x16V(data, x | y << 8, src & ~1);
				this.xfer16x16V(data, x | (y - 16 & 0x1ff) << 8, src | 1);
				break;
			case 0x06: // H反転
				this.xfer16x16H(data, x | y << 8, src | 1);
				this.xfer16x16H(data, x | (y - 16 & 0x1ff) << 8, src & ~1);
				break;
			case 0x07: // HV反転
				this.xfer16x16HV(data, x | y << 8, src & ~1);
				this.xfer16x16HV(data, x | (y - 16 & 0x1ff) << 8, src | 1);
				break;
			case 0x08: // ノーマル
				this.xfer16x16(data, x | y << 8, src & ~2);
				this.xfer16x16(data, x - 16 & 0xff | y << 8, src | 2);
				break;
			case 0x09: // V反転
				this.xfer16x16V(data, x | y << 8, src & ~2);
				this.xfer16x16V(data, x - 16 & 0xff | y << 8, src | 2);
				break;
			case 0x0a: // H反転
				this.xfer16x16H(data, x | y << 8, src | 2);
				this.xfer16x16H(data, x - 16 & 0xff | y << 8, src & ~2);
				break;
			case 0x0b: // HV反転
				this.xfer16x16HV(data, x | y << 8, src | 2);
				this.xfer16x16HV(data, x - 16 & 0xff | y << 8, src & ~2);
				break;
			case 0x0c: // ノーマル
				this.xfer16x16(data, x | y << 8, src & ~3 | 1);
				this.xfer16x16(data, x | (y - 16 & 0x1ff) << 8, src & ~3);
				this.xfer16x16(data, x - 16 & 0xff | y << 8, src | 3);
				this.xfer16x16(data, x - 16 & 0xff | (y - 16 & 0x1ff) << 8, src & ~3 | 2);
				break;
			case 0x0d: // V反転
				this.xfer16x16V(data, x | y << 8, src & ~3);
				this.xfer16x16V(data, x | (y - 16 & 0x1ff) << 8, src & ~3 | 1);
				this.xfer16x16V(data, x - 16 & 0xff | y << 8, src & ~3 | 2);
				this.xfer16x16V(data, x - 16 & 0xff | (y - 16 & 0x1ff) << 8, src | 3);
				break;
			case 0x0e: // H反転
				this.xfer16x16H(data, x | y << 8, src | 3);
				this.xfer16x16H(data, x | (y - 16 & 0x1ff) << 8, src & ~3 | 2);
				this.xfer16x16H(data, x - 16 & 0xff | y << 8, src & ~3 | 1);
				this.xfer16x16H(data, x - 16 & 0xff | (y - 16 & 0x1ff) << 8, src & ~3);
				break;
			case 0x0f: // HV反転
				this.xfer16x16HV(data, x | y << 8, src & ~3 | 2);
				this.xfer16x16HV(data, x | (y - 16 & 0x1ff) << 8, src | 3);
				this.xfer16x16HV(data, x - 16 & 0xff | y << 8, src & ~3);
				this.xfer16x16HV(data, x - 16 & 0xff | (y - 16 & 0x1ff) << 8, src & ~3 | 1);
				break;
			}
		}

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] = this.rgb[data[p]];
	}

	xfer8x8(data, p, k) {
		const q = this.ram[k] << 6, idx = this.ram[k + 0x400] << 2 & 0xfc, idx2 = 0x70 | this.palette;
		let px;

		if ((px = BGCOLOR[idx | this.bg[q | 0x00]]) !== 0x0f) data[p + 0x000] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x01]]) !== 0x0f) data[p + 0x001] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x02]]) !== 0x0f) data[p + 0x002] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x03]]) !== 0x0f) data[p + 0x003] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x04]]) !== 0x0f) data[p + 0x004] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x05]]) !== 0x0f) data[p + 0x005] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x06]]) !== 0x0f) data[p + 0x006] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x07]]) !== 0x0f) data[p + 0x007] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x08]]) !== 0x0f) data[p + 0x100] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x09]]) !== 0x0f) data[p + 0x101] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x0a]]) !== 0x0f) data[p + 0x102] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x0b]]) !== 0x0f) data[p + 0x103] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x0c]]) !== 0x0f) data[p + 0x104] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x0d]]) !== 0x0f) data[p + 0x105] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x0e]]) !== 0x0f) data[p + 0x106] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x0f]]) !== 0x0f) data[p + 0x107] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x10]]) !== 0x0f) data[p + 0x200] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x11]]) !== 0x0f) data[p + 0x201] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x12]]) !== 0x0f) data[p + 0x202] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x13]]) !== 0x0f) data[p + 0x203] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x14]]) !== 0x0f) data[p + 0x204] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x15]]) !== 0x0f) data[p + 0x205] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x16]]) !== 0x0f) data[p + 0x206] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x17]]) !== 0x0f) data[p + 0x207] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x18]]) !== 0x0f) data[p + 0x300] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x19]]) !== 0x0f) data[p + 0x301] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x1a]]) !== 0x0f) data[p + 0x302] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x1b]]) !== 0x0f) data[p + 0x303] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x1c]]) !== 0x0f) data[p + 0x304] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x1d]]) !== 0x0f) data[p + 0x305] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x1e]]) !== 0x0f) data[p + 0x306] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x1f]]) !== 0x0f) data[p + 0x307] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x20]]) !== 0x0f) data[p + 0x400] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x21]]) !== 0x0f) data[p + 0x401] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x22]]) !== 0x0f) data[p + 0x402] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x23]]) !== 0x0f) data[p + 0x403] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x24]]) !== 0x0f) data[p + 0x404] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x25]]) !== 0x0f) data[p + 0x405] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x26]]) !== 0x0f) data[p + 0x406] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x27]]) !== 0x0f) data[p + 0x407] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x28]]) !== 0x0f) data[p + 0x500] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x29]]) !== 0x0f) data[p + 0x501] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x2a]]) !== 0x0f) data[p + 0x502] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x2b]]) !== 0x0f) data[p + 0x503] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x2c]]) !== 0x0f) data[p + 0x504] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x2d]]) !== 0x0f) data[p + 0x505] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x2e]]) !== 0x0f) data[p + 0x506] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x2f]]) !== 0x0f) data[p + 0x507] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x30]]) !== 0x0f) data[p + 0x600] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x31]]) !== 0x0f) data[p + 0x601] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x32]]) !== 0x0f) data[p + 0x602] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x33]]) !== 0x0f) data[p + 0x603] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x34]]) !== 0x0f) data[p + 0x604] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x35]]) !== 0x0f) data[p + 0x605] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x36]]) !== 0x0f) data[p + 0x606] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x37]]) !== 0x0f) data[p + 0x607] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x38]]) !== 0x0f) data[p + 0x700] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x39]]) !== 0x0f) data[p + 0x701] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x3a]]) !== 0x0f) data[p + 0x702] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x3b]]) !== 0x0f) data[p + 0x703] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x3c]]) !== 0x0f) data[p + 0x704] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x3d]]) !== 0x0f) data[p + 0x705] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x3e]]) !== 0x0f) data[p + 0x706] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x3f]]) !== 0x0f) data[p + 0x707] = idx2 | px;
	}

	xfer16x16(data, dst, src) {
		const idx = src >>> 6 & 0xfc | 0x100;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) <= 8 * 0x100 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0xff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[src++]]) !== 0xff)
					data[dst] = px;
	}

	xfer16x16V(data, dst, src) {
		const idx = src >>> 6 & 0xfc | 0x100;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) <= 8 * 0x100 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[src++]]) !== 0xff)
					data[dst] = px;
	}

	xfer16x16H(data, dst, src) {
		const idx = src >>> 6 & 0xfc | 0x100;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) <= 8 * 0x100 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[--src]]) !== 0xff)
					data[dst] = px;
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >>> 6 & 0xfc | 0x100;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) <= 8 * 0x100 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[--src]]) !== 0xff)
					data[dst] = px;
	}
}

/*
 *
 *	Toypop
 *
 */

const url = 'toypop.zip';
const PRG3 = new Uint8Array(0x8000).addBase();
let PRG1, PRG2, BG, OBJ, RED, GREEN, BLUE, BGCOLOR, OBJCOLOR, SND;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG1 = new Uint8Array((zip.files['tp1-2.5b'].inflate() + zip.files['tp1-1.5c'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	PRG2 = new Uint8Array(zip.files['tp1-3.2c'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	zip.files['tp1-4.8c'].inflate().split('').forEach((c, i) => PRG3[i << 1] = c.charCodeAt(0));
	zip.files['tp1-5.10c'].inflate().split('').forEach((c, i) => PRG3[1 | i << 1] = c.charCodeAt(0));
	BG = new Uint8Array(zip.files['tp1-7.5p'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJ = new Uint8Array(zip.files['tp1-6.9t'].inflate().split('').map(c => c.charCodeAt(0)));
	RED = new Uint8Array(zip.files['tp1-3.1r'].inflate().split('').map(c => c.charCodeAt(0)));
	GREEN = new Uint8Array(zip.files['tp1-2.1s'].inflate().split('').map(c => c.charCodeAt(0)));
	BLUE = new Uint8Array(zip.files['tp1-1.1t'].inflate().split('').map(c => c.charCodeAt(0)));
	BGCOLOR = new Uint8Array(zip.files['tp1-4.5l'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJCOLOR = new Uint8Array(zip.files['tp1-5.2p'].inflate().split('').map(c => c.charCodeAt(0)));
	SND = new Uint8Array(zip.files['tp1-6.3d'].inflate().split('').map(c => c.charCodeAt(0)));
	init({
		game: new Toypop(),
		sound: sound = new MappySound({SND}),
		rotate: true,
	});
	loop();
}
