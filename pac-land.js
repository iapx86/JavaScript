/*
 *
 *	Pac-Land
 *
 */

import C30 from './c30.js';
import {init, loop} from './main.js';
import MC6809 from './mc6809.js';
import MC6801 from './mc6801.js';
let sound;

class PacLand {
	cxScreen = 224;
	cyScreen = 288;
	width = 256;
	height = 512;
	xOffset = 16;
	yOffset = 16;

	fReset = true;
	fTest = false;
	fDIPSwitchChanged = true;
	fCoin = 0;
	fStart1P = 0;
	fStart2P = 0;
	nLife = 3;
	fAttract = true;
	nBonus = 'A';
	nRank = 'A';

	fInterruptEnable0 = false;
	fInterruptEnable1 = false;
	bank = 0x80;

	ram = new Uint8Array(0x3800).addBase();
	ram2 = new Uint8Array(0x900).addBase();
	in = new Uint8Array(5).fill(0xff);

	fg = new Uint8Array(0x8000);
	bg = new Uint8Array(0x8000);
	obj = new Uint8Array(0x20000);
	rgb = new Uint32Array(0x400);
	opaque = [new Uint8Array(0x100), new Uint8Array(0x100), new Uint8Array(0x100)];
	dwScroll0 = 0;
	dwScroll1 = 0;
	palette = 0;
	fFlip = false;

	cpu = new MC6809();
	mcu = new MC6801();

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x38; i++) {
			this.cpu.memorymap[i].base = this.ram.base[i];
			this.cpu.memorymap[i].write = null;
		}
		this.cpu.memorymap[0x38].write = (addr, data) => void(this.dwScroll0 = data | addr << 8 & 0x100);
		this.cpu.memorymap[0x3a].write = (addr, data) => void(this.dwScroll1 = data | addr << 8 & 0x100);
		this.cpu.memorymap[0x3c].write = (addr, data) => {
			const bank = (data << 5 & 0xe0) + 0x80;
			if ((addr & 0xff) !== 0)
				return;
			if (bank !== this.bank) {
				for (let i = 0; i < 0x20; i++)
					this.cpu.memorymap[0x40 + i].base = PRG1.base[bank + i];
				this.bank = bank;
			}
			this.palette = data << 5 & 0x300;
		};
		for (let i = 0; i < 0x20; i++)
			this.cpu.memorymap[0x40 + i].base = PRG1.base[0x80 + i];
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0x68 + i].read = addr => sound.read(addr);
			this.cpu.memorymap[0x68 + i].write = (addr, data) => sound.write(addr, data);
		}
		for (let i = 0; i < 0x10; i++)
			this.cpu.memorymap[0x70 + i].write = addr => void(this.fInterruptEnable0 = (addr & 0x800) === 0);
		for (let i = 0; i < 0x80; i++)
			this.cpu.memorymap[0x80 + i].base = PRG1.base[i];
		for (let i = 0; i < 0x10; i++)
			this.cpu.memorymap[0x80 + i].write = addr => (addr & 0x800) === 0 ? this.mcu.enable() : this.mcu.disable();
		for (let i = 0; i < 0x10; i++)
			this.cpu.memorymap[0x90 + i].write = addr => void(this.fFlip = (addr & 0x800) === 0);

		this.mcu.memorymap[0].base = this.ram2.base[0];
		this.mcu.memorymap[0].read = addr => addr === 2 ? this.in[4] : this.ram2[addr];
		this.mcu.memorymap[0].write = null;
		for (let i = 0; i < 4; i++) {
			this.mcu.memorymap[0x10 + i].read = addr => sound.read(addr);
			this.mcu.memorymap[0x10 + i].write = (addr, data) => sound.write(addr, data);
		}
		for (let i = 0; i < 0x40; i++)
			this.mcu.memorymap[0x40 + i].write = addr => void(this.fInterruptEnable1 = (addr & 0x2000) === 0);
		for (let i = 0; i < 0x20; i++)
			this.mcu.memorymap[0x80 + i].base = PRG2.base[i];
		for (let i = 0; i < 8; i++) {
			this.mcu.memorymap[0xc0 + i].base = this.ram2.base[1 + i];
			this.mcu.memorymap[0xc0 + i].write = null;
		}
		this.mcu.memorymap[0xd0].read = addr => (addr & 0xfc) === 0 ? this.in[addr & 3] : 0xff;
		for (let i = 0; i < 0x10; i++)
			this.mcu.memorymap[0xf0 + i].base = PRG2I.base[i];

		// Videoの初期化
		this.convertRGB();
		this.convertFG();
		this.convertBG();
		this.convertOBJ();
	}

	execute() {
		if (this.fInterruptEnable0)
			this.cpu.interrupt();
		if (this.fInterruptEnable1)
			this.mcu.interrupt();
		for (let i = 0; i < 800; i++)
			this.cpu.execute(5), this.mcu.execute(6);
		if ((this.ram2[8] & 8) !== 0)
			this.mcu.interrupt('ocf');
		for (let i = 0; i < 800; i++)
			this.cpu.execute(5), this.mcu.execute(6);
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
				this.in[0] |= 0x60;
				break;
			case 2:
				this.in[0] = this.in[0] & ~0x60 | 0x40;
				break;
			case 4:
				this.in[0] = this.in[0] & ~0x60 | 0x20;
				break;
			case 5:
				this.in[0] &= ~0x60;
				break;
			}
			if (this.fAttract)
				this.in[1] |= 0x40;
			else
				this.in[1] &= ~0x40;
			switch (this.nBonus) {
			case 'A': // 30000 80000 150000 300000 500000 1000000
				this.in[0] |= 0x0e;
				break;
			case 'B': // 30000 100000 200000 400000 600000 1000000
				this.in[0] = this.in[0] & ~0x0e | 0x0c;
				break;
			case 'C': // 40000 100000 180000 300000 500000 1000000
				this.in[0] = this.in[0] & ~0x60 | 0x0a;
				break;
			case 'D': // 30000 80000 every 100000
				this.in[0] = this.in[0] & ~0x60 | 8;
				break;
			case 'E': // 50000 150000 every 200000
				this.in[0] = this.in[0] & ~0x60 | 6;
				break;
			case 'F': // 30000 80000 150000
				this.in[0] = this.in[0] & ~0x60 | 4;
				break;
			case 'G': // 40000 100000 200000
				this.in[0] = this.in[0] & ~0x60 | 2;
				break;
			case 'H': // 40000
				this.in[0] &= ~0x60;
				break;
			}
			switch (this.nRank) {
			case 'A': // Normal
				this.in[0] |= 1;
				this.in[1] |= 8;
				break;
			case 'B': // Easy
				this.in[0] |= 1;
				this.in[1] &= ~8;
				break;
			case 'C': // Hard
				this.in[0] &= ~1;
				this.in[1] |= 8;
				break;
			case 'D': // Very Hard
				this.in[0] &= ~1;
				this.in[1] &= ~8;
				break;
			}
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.in[0] &= ~0x80;
		else
			this.in[0] |= 0x80;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu.reset();
			this.mcu.disable();
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if (this.fCoin)
			this.in[3] &= ~(1 << 5), --this.fCoin;
		else
			this.in[3] |= 1 << 5;
		if (this.fStart1P)
			this.in[2] &= ~(1 << 4), --this.fStart1P;
		else
			this.in[2] |= 1 << 4;
		if (this.fStart2P)
			this.in[2] &= ~(1 << 5), --this.fStart2P;
		else
			this.in[2] |= 1 << 5;
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
	}

	right(fDown) {
		if (fDown)
			this.in[4] &= ~(1 << 5);
		else
			this.in[4] |= 1 << 5;
	}

	down(fDown) {
	}

	left(fDown) {
		if (fDown)
			this.in[4] &= ~(1 << 4);
		else
			this.in[4] |= 1 << 4;
	}

	triggerA(fDown) {
		if (fDown)
			this.in[4] &= ~(1 << 3);
		else
			this.in[4] |= 1 << 3;
	}

	triggerB(fDown) {
	}

	convertRGB() {
		for (let i = 0; i < 0x400; i++)
			this.rgb[i] = (RED[i] & 0xf) * 255 / 15	// Red
				| (RED[i] >> 4) * 255 / 15 << 8		// Green
				| (BLUE[i] & 0xf) * 255 / 15 << 16	// Blue
				| 0xff000000;						// Alpha
	}

	convertFG() {
		for (let p = 0, q = 0, i = 512; i !== 0; q += 16, --i) {
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.fg[p++] = FG[q + k + 8] >> j & 1 | FG[q + k + 8] >> (j + 3) & 2;
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.fg[p++] = FG[q + k] >> j & 1 | FG[q + k] >> (j + 3) & 2;
		}
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
		this.opaque[0].fill(0).fill(1, 0, 0x80);
		this.opaque[1].fill(0).fill(1, 0, 0x7f).fill(1, 0x80, 0xff);
		this.opaque[2].fill(0).fill(1, 0xf0, 0xff);

		for (let p = 0, q = 0, i = 512; i !== 0; q += 64, --i) {
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 0x8000 + 32] >> j & 1 | OBJ[q + k + 0x8000 + 32] >> (j + 3) & 2 | OBJ[q + k + 32] >> j << 2 & 4 | OBJ[q + k + 32] >> (j + 1) & 8;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 0x8000] >> j & 1 | OBJ[q + k + 0x8000] >> (j + 3) & 2 | OBJ[q + k] >> j << 2 & 4 | OBJ[q + k] >> (j + 1) & 8;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 0x8000 + 40] >> j & 1 | OBJ[q + k + 0x8000 + 40] >> (j + 3) & 2 | OBJ[q + k + 40] >> j << 2 & 4 | OBJ[q + k + 40] >> (j + 1) & 8;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 0x8000 + 8] >> j & 1 | OBJ[q + k + 0x8000 + 8] >> (j + 3) & 2 | OBJ[q + k + 8] >> j << 2 & 4 | OBJ[q + k + 8] >> (j + 1) & 8;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 0x8000 + 48] >> j & 1 | OBJ[q + k + 0x8000 + 48] >> (j + 3) & 2 | OBJ[q + k + 48] >> j << 2 & 4 | OBJ[q + k + 48] >> (j + 1) & 8;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 0x8000 + 16] >> j & 1 | OBJ[q + k + 0x8000 + 16] >> (j + 3) & 2 | OBJ[q + k + 16] >> j << 2 & 4 | OBJ[q + k + 16] >> (j + 1) & 8;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 0x8000 + 56] >> j & 1 | OBJ[q + k + 0x8000 + 56] >> (j + 3) & 2 | OBJ[q + k + 56] >> j << 2 & 4 | OBJ[q + k + 56] >> (j + 1) & 8;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 0x8000 + 24] >> j & 1 | OBJ[q + k + 0x8000 + 24] >> (j + 3) & 2 | OBJ[q + k + 24] >> j << 2 & 4 | OBJ[q + k + 24] >> (j + 1) & 8;
			}
		}
	}

	makeBitmap(data) {
		const ram = this.ram;

		// 画面クリア
		let p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256, i++)
			data.fill(0, p, p + 224);

		// obj描画
		this.drawObj(data, 0);

		// bg描画
		p = 256 * 8 * 2 + 232 - (this.fFlip ? 4 + this.dwScroll1 & 7 : 5 + this.dwScroll1 & 7) * 256;
		let k = 0x1100 | (this.fFlip ? (4 + this.dwScroll1 >> 2) + 0x30 : (5 + this.dwScroll1 >> 2) + 4) & 0x7e;
		for (let i = 0; i < 28; k = k + 54 & 0x7e | k + 0x80 & 0x1f80, p -= 256 * 8 * 37 + 8, i++)
			for (let j = 0; j < 37; k = k + 2 & 0x7e | k & 0x1f80, p += 256 * 8, j++)
				this.xfer8x8(data, BGCOLOR, this.bg, ram[k + 1] << 1 & 0x7c | ram[k] << 1 & 0x180 | ram[k + 1] << 9 & 0x200, p, k);

		// fg描画
		p = 256 * 8 * 2 + 208 - (this.fFlip ? 1 + this.dwScroll0 & 7 : this.dwScroll0 & 7) * 256;
		k = 0x280 | (this.fFlip ? (1 + this.dwScroll0 >> 2) + 0x30 : (this.dwScroll0 >> 2) + 6) & 0x7e;
		for (let i = 0; i < 24; k = k + 54 & 0x7e | k + 0x80 & 0x1f80, p -= 256 * 8 * 37 + 8, i++)
			for (let j = 0; j < 37; k = k + 2 & 0x7e | k & 0x1f80, p += 256 * 8, j++)
				if ((ram[k + 1] & 0x20) === 0)
					this.xfer8x8(data, FGCOLOR, this.fg, ram[k + 1] << 1 & 0x3c | ram[k] << 1 & 0x1c0 | ram[k + 1] << 9 & 0x200, p, k);
		p = 256 * 8 * 2 + 232;
		k = this.fFlip ? 0x132 : 0x106;
		for (let i = 0; i < 3; p -= 256 * 8 * 36 + 8, k += 56, i++)
			for (let j = 0; j < 36; p += 256 * 8, k += 2, j++)
				if ((ram[k + 1] & 0x20) === 0)
					this.xfer8x8(data, FGCOLOR, this.fg, ram[k + 1] << 1 & 0x3c | ram[k] << 1 & 0x1c0 | ram[k + 1] << 9 & 0x200, p, k);
		p = 256 * 8 * 2 + 16;
		k = this.fFlip ? 0xeb2 : 0xe86;
		for (let i = 0; i < 36; p += 256 * 8, k += 2, i++)
			if ((ram[k + 1] & 0x20) === 0)
				this.xfer8x8(data, FGCOLOR, this.fg, ram[k + 1] << 1 & 0x3c | ram[k] << 1 & 0x1c0 | ram[k + 1] << 9 & 0x200, p, k);

		// obj描画
		this.drawObj(data, 1);

		// fg描画
		p = 256 * 8 * 2 + 208 - (this.fFlip ? 1 + this.dwScroll0 & 7 : this.dwScroll0 & 7) * 256;
		k = 0x280 | (this.fFlip ? (1 + this.dwScroll0 >> 2) + 0x30 : (this.dwScroll0 >> 2) + 6) & 0x7e;
		for (let i = 0; i < 24; k = k + 54 & 0x7e | k + 0x80 & 0x1f80, p -= 256 * 8 * 37 + 8, i++)
			for (let j = 0; j < 37; k = k + 2 & 0x7e | k & 0x1f80, p += 256 * 8, j++)
				if ((ram[k + 1] & 0x20) !== 0)
					this.xfer8x8(data, FGCOLOR, this.fg, ram[k + 1] << 1 & 0x3c | ram[k] << 1 & 0x1c0 | ram[k + 1] << 9 & 0x200, p, k);
		p = 256 * 8 * 2 + 232;
		k = this.fFlip ? 0x132 : 0x106;
		for (let i = 0; i < 3; p -= 256 * 8 * 36 + 8, k += 56, i++)
			for (let j = 0; j < 36; p += 256 * 8, k += 2, j++)
				if ((ram[k + 1] & 0x20) !== 0)
					this.xfer8x8(data, FGCOLOR, this.fg, ram[k + 1] << 1 & 0x3c | ram[k] << 1 & 0x1c0 | ram[k + 1] << 9 & 0x200, p, k);
		p = 256 * 8 * 2 + 16;
		k = this.fFlip ? 0xeb2 : 0xe86;
		for (let i = 0; i < 36; p += 256 * 8, k += 2, i++)
			if ((ram[k + 1] & 0x20) !== 0)
				this.xfer8x8(data, FGCOLOR, this.fg, ram[k + 1] << 1 & 0x3c | ram[k] << 1 & 0x1c0 | ram[k + 1] << 9 & 0x200, p, k);

		// obj描画
		this.drawObj(data, 2);

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] = this.rgb[this.palette | data[p]];
	}

	drawObj(data, cat) {
		if (this.fFlip) {
			for (let k = 0x2780, i = 64; i !== 0; k += 2, --i) {
				const x = 0xe9 - this.ram[k + 0x800] & 0xff;
				const y = 0x167 - this.ram[k + 0x801] - this.ram[k + 0x1001] * 0x100 & 0x1ff;
				const src = this.ram[k + 1] << 9 | this.ram[k + 0x1000] << 1 & 0x100 | this.ram[k];
				switch (this.ram[k + 0x1000] & 0x0f) {
				case 0x00: // ノーマル
					this.xfer16x16(data, x | y << 8, src, cat);
					break;
				case 0x01: // V反転
					this.xfer16x16V(data, x | y << 8, src, cat);
					break;
				case 0x02: // H反転
					this.xfer16x16H(data, x | y << 8, src, cat);
					break;
				case 0x03: // HV反転
					this.xfer16x16HV(data, x | y << 8, src, cat);
					break;
				case 0x04: // ノーマル
					this.xfer16x16(data, x | y << 8, src | 1, cat);
					this.xfer16x16(data, x | (y - 16 & 0x1ff) << 8, src & ~1, cat);
					break;
				case 0x05: // V反転
					this.xfer16x16V(data, x | y << 8, src & ~1, cat);
					this.xfer16x16V(data, x | (y - 16 & 0x1ff) << 8, src | 1, cat);
					break;
				case 0x06: // H反転
					this.xfer16x16H(data, x | y << 8, src | 1, cat);
					this.xfer16x16H(data, x | (y - 16 & 0x1ff) << 8, src & ~1, cat);
					break;
				case 0x07: // HV反転
					this.xfer16x16HV(data, x | y << 8, src & ~1, cat);
					this.xfer16x16HV(data, x | (y - 16 & 0x1ff) << 8, src | 1, cat);
					break;
				case 0x08: // ノーマル
					this.xfer16x16(data, x | y << 8, src & ~2, cat);
					this.xfer16x16(data, x - 16 & 0xff | y << 8, src | 2, cat);
					break;
				case 0x09: // V反転
					this.xfer16x16V(data, x | y << 8, src & ~2, cat);
					this.xfer16x16V(data, x - 16 & 0xff | y << 8, src | 2, cat);
					break;
				case 0x0a: // H反転
					this.xfer16x16H(data, x | y << 8, src | 2, cat);
					this.xfer16x16H(data, x - 16 & 0xff | y << 8, src & ~2, cat);
					break;
				case 0x0b: // HV反転
					this.xfer16x16HV(data, x | y << 8, src | 2, cat);
					this.xfer16x16HV(data, x - 16 & 0xff | y << 8, src & ~2, cat);
					break;
				case 0x0c: // ノーマル
					this.xfer16x16(data, x | y << 8, src & ~3 | 1, cat);
					this.xfer16x16(data, x | (y - 16 & 0x1ff) << 8, src & ~3, cat);
					this.xfer16x16(data, x - 16 & 0xff | y << 8, src | 3, cat);
					this.xfer16x16(data, x - 16 & 0xff | (y - 16 & 0x1ff) << 8, src & ~3 | 2, cat);
					break;
				case 0x0d: // V反転
					this.xfer16x16V(data, x | y << 8, src & ~3, cat);
					this.xfer16x16V(data, x | (y - 16 & 0x1ff) << 8, src & ~3 | 1, cat);
					this.xfer16x16V(data, x - 16 & 0xff | y << 8, src & ~3 | 2, cat);
					this.xfer16x16V(data, x - 16 & 0xff | (y - 16 & 0x1ff) << 8, src | 3, cat);
					break;
				case 0x0e: // H反転
					this.xfer16x16H(data, x | y << 8, src | 3, cat);
					this.xfer16x16H(data, x | (y - 16 & 0x1ff) << 8, src & ~3 | 2, cat);
					this.xfer16x16H(data, x - 16 & 0xff | y << 8, src & ~3 | 1, cat);
					this.xfer16x16H(data, x - 16 & 0xff | (y - 16 & 0x1ff) << 8, src & ~3, cat);
					break;
				case 0x0f: // HV反転
					this.xfer16x16HV(data, x | y << 8, src & ~3 | 2, cat);
					this.xfer16x16HV(data, x | (y - 16 & 0x1ff) << 8, src | 3, cat);
					this.xfer16x16HV(data, x - 16 & 0xff | y << 8, src & ~3, cat);
					this.xfer16x16HV(data, x - 16 & 0xff | (y - 16 & 0x1ff) << 8, src & ~3 | 1, cat);
					break;
				}
			}
		}
		else {
			for (let k = 0x2780, i = 64; i !== 0; k += 2, --i) {
				const x = this.ram[k + 0x800] + 7 & 0xff;
				const y = (this.ram[k + 0x801] | this.ram[k + 0x1001] << 8) - 55 & 0x1ff;
				const src = this.ram[k + 1] << 9 | this.ram[k + 0x1000] << 1 & 0x100 | this.ram[k];
				switch (this.ram[k + 0x1000] & 0x0f) {
				case 0x00: // ノーマル
					this.xfer16x16(data, x | y << 8, src, cat);
					break;
				case 0x01: // V反転
					this.xfer16x16V(data, x | y << 8, src, cat);
					break;
				case 0x02: // H反転
					this.xfer16x16H(data, x | y << 8, src, cat);
					break;
				case 0x03: // HV反転
					this.xfer16x16HV(data, x | y << 8, src, cat);
					break;
				case 0x04: // ノーマル
					this.xfer16x16(data, x | y << 8, src & ~1, cat);
					this.xfer16x16(data, x | (y + 16 & 0x1ff) << 8, src | 1, cat);
					break;
				case 0x05: // V反転
					this.xfer16x16V(data, x | y << 8, src | 1, cat);
					this.xfer16x16V(data, x | (y + 16 & 0x1ff) << 8, src & ~1, cat);
					break;
				case 0x06: // H反転
					this.xfer16x16H(data, x | y << 8, src & ~1, cat);
					this.xfer16x16H(data, x | (y + 16 & 0x1ff) << 8, src | 1, cat);
					break;
				case 0x07: // HV反転
					this.xfer16x16HV(data, x | y << 8, src | 1, cat);
					this.xfer16x16HV(data, x | (y + 16 & 0x1ff) << 8, src & ~1, cat);
					break;
				case 0x08: // ノーマル
					this.xfer16x16(data, x | y << 8, src | 2, cat);
					this.xfer16x16(data, x + 16 & 0xff | y << 8, src & ~2, cat);
					break;
				case 0x09: // V反転
					this.xfer16x16V(data, x | y << 8, src | 2, cat);
					this.xfer16x16V(data, x + 16 & 0xff | y << 8, src & ~2, cat);
					break;
				case 0x0a: // H反転
					this.xfer16x16H(data, x | y << 8, src & ~2, cat);
					this.xfer16x16H(data, x + 16 & 0xff | y << 8, src | 2, cat);
					break;
				case 0x0b: // HV反転
					this.xfer16x16HV(data, x | y << 8, src & ~2, cat);
					this.xfer16x16HV(data, x + 16 & 0xff | y << 8, src | 2, cat);
					break;
				case 0x0c: // ノーマル
					this.xfer16x16(data, x | y << 8, src & ~3 | 2, cat);
					this.xfer16x16(data, x | (y + 16 & 0x1ff) << 8, src | 3, cat);
					this.xfer16x16(data, x + 16 & 0xff | y << 8, src & ~3, cat);
					this.xfer16x16(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3 | 1, cat);
					break;
				case 0x0d: // V反転
					this.xfer16x16V(data, x | y << 8, src | 3, cat);
					this.xfer16x16V(data, x | (y + 16 & 0x1ff) << 8, src & ~3 | 2, cat);
					this.xfer16x16V(data, x + 16 & 0xff | y << 8, src & ~3 | 1, cat);
					this.xfer16x16V(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3, cat);
					break;
				case 0x0e: // H反転
					this.xfer16x16H(data, x | y << 8, src & ~3, cat);
					this.xfer16x16H(data, x | (y + 16 & 0x1ff) << 8, src & ~3 | 1, cat);
					this.xfer16x16H(data, x + 16 & 0xff | y << 8, src & ~3 | 2, cat);
					this.xfer16x16H(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src | 3, cat);
					break;
				case 0x0f: // HV反転
					this.xfer16x16HV(data, x | y << 8, src & ~3 | 1, cat);
					this.xfer16x16HV(data, x | (y + 16 & 0x1ff) << 8, src & ~3, cat);
					this.xfer16x16HV(data, x + 16 & 0xff | y << 8, src | 3, cat);
					this.xfer16x16HV(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3 | 2, cat);
					break;
				}
			}
		}
	}

	xfer8x8(data, color, pattern, idx, p, k) {
		const q = (this.ram[k] | this.ram[k + 1] << 8) << 6 & 0x7fc0;
		let px;

		switch (this.ram[k + 1] >> 6) {
		case 0: // ノーマル
			if ((px = color[idx | pattern[q | 0x00]]) !== 0xff) data[p + 0x000] = px;
			if ((px = color[idx | pattern[q | 0x01]]) !== 0xff) data[p + 0x001] = px;
			if ((px = color[idx | pattern[q | 0x02]]) !== 0xff) data[p + 0x002] = px;
			if ((px = color[idx | pattern[q | 0x03]]) !== 0xff) data[p + 0x003] = px;
			if ((px = color[idx | pattern[q | 0x04]]) !== 0xff) data[p + 0x004] = px;
			if ((px = color[idx | pattern[q | 0x05]]) !== 0xff) data[p + 0x005] = px;
			if ((px = color[idx | pattern[q | 0x06]]) !== 0xff) data[p + 0x006] = px;
			if ((px = color[idx | pattern[q | 0x07]]) !== 0xff) data[p + 0x007] = px;
			if ((px = color[idx | pattern[q | 0x08]]) !== 0xff) data[p + 0x100] = px;
			if ((px = color[idx | pattern[q | 0x09]]) !== 0xff) data[p + 0x101] = px;
			if ((px = color[idx | pattern[q | 0x0a]]) !== 0xff) data[p + 0x102] = px;
			if ((px = color[idx | pattern[q | 0x0b]]) !== 0xff) data[p + 0x103] = px;
			if ((px = color[idx | pattern[q | 0x0c]]) !== 0xff) data[p + 0x104] = px;
			if ((px = color[idx | pattern[q | 0x0d]]) !== 0xff) data[p + 0x105] = px;
			if ((px = color[idx | pattern[q | 0x0e]]) !== 0xff) data[p + 0x106] = px;
			if ((px = color[idx | pattern[q | 0x0f]]) !== 0xff) data[p + 0x107] = px;
			if ((px = color[idx | pattern[q | 0x10]]) !== 0xff) data[p + 0x200] = px;
			if ((px = color[idx | pattern[q | 0x11]]) !== 0xff) data[p + 0x201] = px;
			if ((px = color[idx | pattern[q | 0x12]]) !== 0xff) data[p + 0x202] = px;
			if ((px = color[idx | pattern[q | 0x13]]) !== 0xff) data[p + 0x203] = px;
			if ((px = color[idx | pattern[q | 0x14]]) !== 0xff) data[p + 0x204] = px;
			if ((px = color[idx | pattern[q | 0x15]]) !== 0xff) data[p + 0x205] = px;
			if ((px = color[idx | pattern[q | 0x16]]) !== 0xff) data[p + 0x206] = px;
			if ((px = color[idx | pattern[q | 0x17]]) !== 0xff) data[p + 0x207] = px;
			if ((px = color[idx | pattern[q | 0x18]]) !== 0xff) data[p + 0x300] = px;
			if ((px = color[idx | pattern[q | 0x19]]) !== 0xff) data[p + 0x301] = px;
			if ((px = color[idx | pattern[q | 0x1a]]) !== 0xff) data[p + 0x302] = px;
			if ((px = color[idx | pattern[q | 0x1b]]) !== 0xff) data[p + 0x303] = px;
			if ((px = color[idx | pattern[q | 0x1c]]) !== 0xff) data[p + 0x304] = px;
			if ((px = color[idx | pattern[q | 0x1d]]) !== 0xff) data[p + 0x305] = px;
			if ((px = color[idx | pattern[q | 0x1e]]) !== 0xff) data[p + 0x306] = px;
			if ((px = color[idx | pattern[q | 0x1f]]) !== 0xff) data[p + 0x307] = px;
			if ((px = color[idx | pattern[q | 0x20]]) !== 0xff) data[p + 0x400] = px;
			if ((px = color[idx | pattern[q | 0x21]]) !== 0xff) data[p + 0x401] = px;
			if ((px = color[idx | pattern[q | 0x22]]) !== 0xff) data[p + 0x402] = px;
			if ((px = color[idx | pattern[q | 0x23]]) !== 0xff) data[p + 0x403] = px;
			if ((px = color[idx | pattern[q | 0x24]]) !== 0xff) data[p + 0x404] = px;
			if ((px = color[idx | pattern[q | 0x25]]) !== 0xff) data[p + 0x405] = px;
			if ((px = color[idx | pattern[q | 0x26]]) !== 0xff) data[p + 0x406] = px;
			if ((px = color[idx | pattern[q | 0x27]]) !== 0xff) data[p + 0x407] = px;
			if ((px = color[idx | pattern[q | 0x28]]) !== 0xff) data[p + 0x500] = px;
			if ((px = color[idx | pattern[q | 0x29]]) !== 0xff) data[p + 0x501] = px;
			if ((px = color[idx | pattern[q | 0x2a]]) !== 0xff) data[p + 0x502] = px;
			if ((px = color[idx | pattern[q | 0x2b]]) !== 0xff) data[p + 0x503] = px;
			if ((px = color[idx | pattern[q | 0x2c]]) !== 0xff) data[p + 0x504] = px;
			if ((px = color[idx | pattern[q | 0x2d]]) !== 0xff) data[p + 0x505] = px;
			if ((px = color[idx | pattern[q | 0x2e]]) !== 0xff) data[p + 0x506] = px;
			if ((px = color[idx | pattern[q | 0x2f]]) !== 0xff) data[p + 0x507] = px;
			if ((px = color[idx | pattern[q | 0x30]]) !== 0xff) data[p + 0x600] = px;
			if ((px = color[idx | pattern[q | 0x31]]) !== 0xff) data[p + 0x601] = px;
			if ((px = color[idx | pattern[q | 0x32]]) !== 0xff) data[p + 0x602] = px;
			if ((px = color[idx | pattern[q | 0x33]]) !== 0xff) data[p + 0x603] = px;
			if ((px = color[idx | pattern[q | 0x34]]) !== 0xff) data[p + 0x604] = px;
			if ((px = color[idx | pattern[q | 0x35]]) !== 0xff) data[p + 0x605] = px;
			if ((px = color[idx | pattern[q | 0x36]]) !== 0xff) data[p + 0x606] = px;
			if ((px = color[idx | pattern[q | 0x37]]) !== 0xff) data[p + 0x607] = px;
			if ((px = color[idx | pattern[q | 0x38]]) !== 0xff) data[p + 0x700] = px;
			if ((px = color[idx | pattern[q | 0x39]]) !== 0xff) data[p + 0x701] = px;
			if ((px = color[idx | pattern[q | 0x3a]]) !== 0xff) data[p + 0x702] = px;
			if ((px = color[idx | pattern[q | 0x3b]]) !== 0xff) data[p + 0x703] = px;
			if ((px = color[idx | pattern[q | 0x3c]]) !== 0xff) data[p + 0x704] = px;
			if ((px = color[idx | pattern[q | 0x3d]]) !== 0xff) data[p + 0x705] = px;
			if ((px = color[idx | pattern[q | 0x3e]]) !== 0xff) data[p + 0x706] = px;
			if ((px = color[idx | pattern[q | 0x3f]]) !== 0xff) data[p + 0x707] = px;
			break;
		case 1: // V反転
			if ((px = color[idx | pattern[q | 0x38]]) !== 0xff) data[p + 0x000] = px;
			if ((px = color[idx | pattern[q | 0x39]]) !== 0xff) data[p + 0x001] = px;
			if ((px = color[idx | pattern[q | 0x3a]]) !== 0xff) data[p + 0x002] = px;
			if ((px = color[idx | pattern[q | 0x3b]]) !== 0xff) data[p + 0x003] = px;
			if ((px = color[idx | pattern[q | 0x3c]]) !== 0xff) data[p + 0x004] = px;
			if ((px = color[idx | pattern[q | 0x3d]]) !== 0xff) data[p + 0x005] = px;
			if ((px = color[idx | pattern[q | 0x3e]]) !== 0xff) data[p + 0x006] = px;
			if ((px = color[idx | pattern[q | 0x3f]]) !== 0xff) data[p + 0x007] = px;
			if ((px = color[idx | pattern[q | 0x30]]) !== 0xff) data[p + 0x100] = px;
			if ((px = color[idx | pattern[q | 0x31]]) !== 0xff) data[p + 0x101] = px;
			if ((px = color[idx | pattern[q | 0x32]]) !== 0xff) data[p + 0x102] = px;
			if ((px = color[idx | pattern[q | 0x33]]) !== 0xff) data[p + 0x103] = px;
			if ((px = color[idx | pattern[q | 0x34]]) !== 0xff) data[p + 0x104] = px;
			if ((px = color[idx | pattern[q | 0x35]]) !== 0xff) data[p + 0x105] = px;
			if ((px = color[idx | pattern[q | 0x36]]) !== 0xff) data[p + 0x106] = px;
			if ((px = color[idx | pattern[q | 0x37]]) !== 0xff) data[p + 0x107] = px;
			if ((px = color[idx | pattern[q | 0x28]]) !== 0xff) data[p + 0x200] = px;
			if ((px = color[idx | pattern[q | 0x29]]) !== 0xff) data[p + 0x201] = px;
			if ((px = color[idx | pattern[q | 0x2a]]) !== 0xff) data[p + 0x202] = px;
			if ((px = color[idx | pattern[q | 0x2b]]) !== 0xff) data[p + 0x203] = px;
			if ((px = color[idx | pattern[q | 0x2c]]) !== 0xff) data[p + 0x204] = px;
			if ((px = color[idx | pattern[q | 0x2d]]) !== 0xff) data[p + 0x205] = px;
			if ((px = color[idx | pattern[q | 0x2e]]) !== 0xff) data[p + 0x206] = px;
			if ((px = color[idx | pattern[q | 0x2f]]) !== 0xff) data[p + 0x207] = px;
			if ((px = color[idx | pattern[q | 0x20]]) !== 0xff) data[p + 0x300] = px;
			if ((px = color[idx | pattern[q | 0x21]]) !== 0xff) data[p + 0x301] = px;
			if ((px = color[idx | pattern[q | 0x22]]) !== 0xff) data[p + 0x302] = px;
			if ((px = color[idx | pattern[q | 0x23]]) !== 0xff) data[p + 0x303] = px;
			if ((px = color[idx | pattern[q | 0x24]]) !== 0xff) data[p + 0x304] = px;
			if ((px = color[idx | pattern[q | 0x25]]) !== 0xff) data[p + 0x305] = px;
			if ((px = color[idx | pattern[q | 0x26]]) !== 0xff) data[p + 0x306] = px;
			if ((px = color[idx | pattern[q | 0x27]]) !== 0xff) data[p + 0x307] = px;
			if ((px = color[idx | pattern[q | 0x18]]) !== 0xff) data[p + 0x400] = px;
			if ((px = color[idx | pattern[q | 0x19]]) !== 0xff) data[p + 0x401] = px;
			if ((px = color[idx | pattern[q | 0x1a]]) !== 0xff) data[p + 0x402] = px;
			if ((px = color[idx | pattern[q | 0x1b]]) !== 0xff) data[p + 0x403] = px;
			if ((px = color[idx | pattern[q | 0x1c]]) !== 0xff) data[p + 0x404] = px;
			if ((px = color[idx | pattern[q | 0x1d]]) !== 0xff) data[p + 0x405] = px;
			if ((px = color[idx | pattern[q | 0x1e]]) !== 0xff) data[p + 0x406] = px;
			if ((px = color[idx | pattern[q | 0x1f]]) !== 0xff) data[p + 0x407] = px;
			if ((px = color[idx | pattern[q | 0x10]]) !== 0xff) data[p + 0x500] = px;
			if ((px = color[idx | pattern[q | 0x11]]) !== 0xff) data[p + 0x501] = px;
			if ((px = color[idx | pattern[q | 0x12]]) !== 0xff) data[p + 0x502] = px;
			if ((px = color[idx | pattern[q | 0x13]]) !== 0xff) data[p + 0x503] = px;
			if ((px = color[idx | pattern[q | 0x14]]) !== 0xff) data[p + 0x504] = px;
			if ((px = color[idx | pattern[q | 0x15]]) !== 0xff) data[p + 0x505] = px;
			if ((px = color[idx | pattern[q | 0x16]]) !== 0xff) data[p + 0x506] = px;
			if ((px = color[idx | pattern[q | 0x17]]) !== 0xff) data[p + 0x507] = px;
			if ((px = color[idx | pattern[q | 0x08]]) !== 0xff) data[p + 0x600] = px;
			if ((px = color[idx | pattern[q | 0x09]]) !== 0xff) data[p + 0x601] = px;
			if ((px = color[idx | pattern[q | 0x0a]]) !== 0xff) data[p + 0x602] = px;
			if ((px = color[idx | pattern[q | 0x0b]]) !== 0xff) data[p + 0x603] = px;
			if ((px = color[idx | pattern[q | 0x0c]]) !== 0xff) data[p + 0x604] = px;
			if ((px = color[idx | pattern[q | 0x0d]]) !== 0xff) data[p + 0x605] = px;
			if ((px = color[idx | pattern[q | 0x0e]]) !== 0xff) data[p + 0x606] = px;
			if ((px = color[idx | pattern[q | 0x0f]]) !== 0xff) data[p + 0x607] = px;
			if ((px = color[idx | pattern[q | 0x00]]) !== 0xff) data[p + 0x700] = px;
			if ((px = color[idx | pattern[q | 0x01]]) !== 0xff) data[p + 0x701] = px;
			if ((px = color[idx | pattern[q | 0x02]]) !== 0xff) data[p + 0x702] = px;
			if ((px = color[idx | pattern[q | 0x03]]) !== 0xff) data[p + 0x703] = px;
			if ((px = color[idx | pattern[q | 0x04]]) !== 0xff) data[p + 0x704] = px;
			if ((px = color[idx | pattern[q | 0x05]]) !== 0xff) data[p + 0x705] = px;
			if ((px = color[idx | pattern[q | 0x06]]) !== 0xff) data[p + 0x706] = px;
			if ((px = color[idx | pattern[q | 0x07]]) !== 0xff) data[p + 0x707] = px;
			break;
		case 2: // H反転
			if ((px = color[idx | pattern[q | 0x07]]) !== 0xff) data[p + 0x000] = px;
			if ((px = color[idx | pattern[q | 0x06]]) !== 0xff) data[p + 0x001] = px;
			if ((px = color[idx | pattern[q | 0x05]]) !== 0xff) data[p + 0x002] = px;
			if ((px = color[idx | pattern[q | 0x04]]) !== 0xff) data[p + 0x003] = px;
			if ((px = color[idx | pattern[q | 0x03]]) !== 0xff) data[p + 0x004] = px;
			if ((px = color[idx | pattern[q | 0x02]]) !== 0xff) data[p + 0x005] = px;
			if ((px = color[idx | pattern[q | 0x01]]) !== 0xff) data[p + 0x006] = px;
			if ((px = color[idx | pattern[q | 0x00]]) !== 0xff) data[p + 0x007] = px;
			if ((px = color[idx | pattern[q | 0x0f]]) !== 0xff) data[p + 0x100] = px;
			if ((px = color[idx | pattern[q | 0x0e]]) !== 0xff) data[p + 0x101] = px;
			if ((px = color[idx | pattern[q | 0x0d]]) !== 0xff) data[p + 0x102] = px;
			if ((px = color[idx | pattern[q | 0x0c]]) !== 0xff) data[p + 0x103] = px;
			if ((px = color[idx | pattern[q | 0x0b]]) !== 0xff) data[p + 0x104] = px;
			if ((px = color[idx | pattern[q | 0x0a]]) !== 0xff) data[p + 0x105] = px;
			if ((px = color[idx | pattern[q | 0x09]]) !== 0xff) data[p + 0x106] = px;
			if ((px = color[idx | pattern[q | 0x08]]) !== 0xff) data[p + 0x107] = px;
			if ((px = color[idx | pattern[q | 0x17]]) !== 0xff) data[p + 0x200] = px;
			if ((px = color[idx | pattern[q | 0x16]]) !== 0xff) data[p + 0x201] = px;
			if ((px = color[idx | pattern[q | 0x15]]) !== 0xff) data[p + 0x202] = px;
			if ((px = color[idx | pattern[q | 0x14]]) !== 0xff) data[p + 0x203] = px;
			if ((px = color[idx | pattern[q | 0x13]]) !== 0xff) data[p + 0x204] = px;
			if ((px = color[idx | pattern[q | 0x12]]) !== 0xff) data[p + 0x205] = px;
			if ((px = color[idx | pattern[q | 0x11]]) !== 0xff) data[p + 0x206] = px;
			if ((px = color[idx | pattern[q | 0x10]]) !== 0xff) data[p + 0x207] = px;
			if ((px = color[idx | pattern[q | 0x1f]]) !== 0xff) data[p + 0x300] = px;
			if ((px = color[idx | pattern[q | 0x1e]]) !== 0xff) data[p + 0x301] = px;
			if ((px = color[idx | pattern[q | 0x1d]]) !== 0xff) data[p + 0x302] = px;
			if ((px = color[idx | pattern[q | 0x1c]]) !== 0xff) data[p + 0x303] = px;
			if ((px = color[idx | pattern[q | 0x1b]]) !== 0xff) data[p + 0x304] = px;
			if ((px = color[idx | pattern[q | 0x1a]]) !== 0xff) data[p + 0x305] = px;
			if ((px = color[idx | pattern[q | 0x19]]) !== 0xff) data[p + 0x306] = px;
			if ((px = color[idx | pattern[q | 0x18]]) !== 0xff) data[p + 0x307] = px;
			if ((px = color[idx | pattern[q | 0x27]]) !== 0xff) data[p + 0x400] = px;
			if ((px = color[idx | pattern[q | 0x26]]) !== 0xff) data[p + 0x401] = px;
			if ((px = color[idx | pattern[q | 0x25]]) !== 0xff) data[p + 0x402] = px;
			if ((px = color[idx | pattern[q | 0x24]]) !== 0xff) data[p + 0x403] = px;
			if ((px = color[idx | pattern[q | 0x23]]) !== 0xff) data[p + 0x404] = px;
			if ((px = color[idx | pattern[q | 0x22]]) !== 0xff) data[p + 0x405] = px;
			if ((px = color[idx | pattern[q | 0x21]]) !== 0xff) data[p + 0x406] = px;
			if ((px = color[idx | pattern[q | 0x20]]) !== 0xff) data[p + 0x407] = px;
			if ((px = color[idx | pattern[q | 0x2f]]) !== 0xff) data[p + 0x500] = px;
			if ((px = color[idx | pattern[q | 0x2e]]) !== 0xff) data[p + 0x501] = px;
			if ((px = color[idx | pattern[q | 0x2d]]) !== 0xff) data[p + 0x502] = px;
			if ((px = color[idx | pattern[q | 0x2c]]) !== 0xff) data[p + 0x503] = px;
			if ((px = color[idx | pattern[q | 0x2b]]) !== 0xff) data[p + 0x504] = px;
			if ((px = color[idx | pattern[q | 0x2a]]) !== 0xff) data[p + 0x505] = px;
			if ((px = color[idx | pattern[q | 0x29]]) !== 0xff) data[p + 0x506] = px;
			if ((px = color[idx | pattern[q | 0x28]]) !== 0xff) data[p + 0x507] = px;
			if ((px = color[idx | pattern[q | 0x37]]) !== 0xff) data[p + 0x600] = px;
			if ((px = color[idx | pattern[q | 0x36]]) !== 0xff) data[p + 0x601] = px;
			if ((px = color[idx | pattern[q | 0x35]]) !== 0xff) data[p + 0x602] = px;
			if ((px = color[idx | pattern[q | 0x34]]) !== 0xff) data[p + 0x603] = px;
			if ((px = color[idx | pattern[q | 0x33]]) !== 0xff) data[p + 0x604] = px;
			if ((px = color[idx | pattern[q | 0x32]]) !== 0xff) data[p + 0x605] = px;
			if ((px = color[idx | pattern[q | 0x31]]) !== 0xff) data[p + 0x606] = px;
			if ((px = color[idx | pattern[q | 0x30]]) !== 0xff) data[p + 0x607] = px;
			if ((px = color[idx | pattern[q | 0x3f]]) !== 0xff) data[p + 0x700] = px;
			if ((px = color[idx | pattern[q | 0x3e]]) !== 0xff) data[p + 0x701] = px;
			if ((px = color[idx | pattern[q | 0x3d]]) !== 0xff) data[p + 0x702] = px;
			if ((px = color[idx | pattern[q | 0x3c]]) !== 0xff) data[p + 0x703] = px;
			if ((px = color[idx | pattern[q | 0x3b]]) !== 0xff) data[p + 0x704] = px;
			if ((px = color[idx | pattern[q | 0x3a]]) !== 0xff) data[p + 0x705] = px;
			if ((px = color[idx | pattern[q | 0x39]]) !== 0xff) data[p + 0x706] = px;
			if ((px = color[idx | pattern[q | 0x38]]) !== 0xff) data[p + 0x707] = px;
			break;
		case 3: // HV反転
			if ((px = color[idx | pattern[q | 0x3f]]) !== 0xff) data[p + 0x000] = px;
			if ((px = color[idx | pattern[q | 0x3e]]) !== 0xff) data[p + 0x001] = px;
			if ((px = color[idx | pattern[q | 0x3d]]) !== 0xff) data[p + 0x002] = px;
			if ((px = color[idx | pattern[q | 0x3c]]) !== 0xff) data[p + 0x003] = px;
			if ((px = color[idx | pattern[q | 0x3b]]) !== 0xff) data[p + 0x004] = px;
			if ((px = color[idx | pattern[q | 0x3a]]) !== 0xff) data[p + 0x005] = px;
			if ((px = color[idx | pattern[q | 0x39]]) !== 0xff) data[p + 0x006] = px;
			if ((px = color[idx | pattern[q | 0x38]]) !== 0xff) data[p + 0x007] = px;
			if ((px = color[idx | pattern[q | 0x37]]) !== 0xff) data[p + 0x100] = px;
			if ((px = color[idx | pattern[q | 0x36]]) !== 0xff) data[p + 0x101] = px;
			if ((px = color[idx | pattern[q | 0x35]]) !== 0xff) data[p + 0x102] = px;
			if ((px = color[idx | pattern[q | 0x34]]) !== 0xff) data[p + 0x103] = px;
			if ((px = color[idx | pattern[q | 0x33]]) !== 0xff) data[p + 0x104] = px;
			if ((px = color[idx | pattern[q | 0x32]]) !== 0xff) data[p + 0x105] = px;
			if ((px = color[idx | pattern[q | 0x31]]) !== 0xff) data[p + 0x106] = px;
			if ((px = color[idx | pattern[q | 0x30]]) !== 0xff) data[p + 0x107] = px;
			if ((px = color[idx | pattern[q | 0x2f]]) !== 0xff) data[p + 0x200] = px;
			if ((px = color[idx | pattern[q | 0x2e]]) !== 0xff) data[p + 0x201] = px;
			if ((px = color[idx | pattern[q | 0x2d]]) !== 0xff) data[p + 0x202] = px;
			if ((px = color[idx | pattern[q | 0x2c]]) !== 0xff) data[p + 0x203] = px;
			if ((px = color[idx | pattern[q | 0x2b]]) !== 0xff) data[p + 0x204] = px;
			if ((px = color[idx | pattern[q | 0x2a]]) !== 0xff) data[p + 0x205] = px;
			if ((px = color[idx | pattern[q | 0x29]]) !== 0xff) data[p + 0x206] = px;
			if ((px = color[idx | pattern[q | 0x28]]) !== 0xff) data[p + 0x207] = px;
			if ((px = color[idx | pattern[q | 0x27]]) !== 0xff) data[p + 0x300] = px;
			if ((px = color[idx | pattern[q | 0x26]]) !== 0xff) data[p + 0x301] = px;
			if ((px = color[idx | pattern[q | 0x25]]) !== 0xff) data[p + 0x302] = px;
			if ((px = color[idx | pattern[q | 0x24]]) !== 0xff) data[p + 0x303] = px;
			if ((px = color[idx | pattern[q | 0x23]]) !== 0xff) data[p + 0x304] = px;
			if ((px = color[idx | pattern[q | 0x22]]) !== 0xff) data[p + 0x305] = px;
			if ((px = color[idx | pattern[q | 0x21]]) !== 0xff) data[p + 0x306] = px;
			if ((px = color[idx | pattern[q | 0x20]]) !== 0xff) data[p + 0x307] = px;
			if ((px = color[idx | pattern[q | 0x1f]]) !== 0xff) data[p + 0x400] = px;
			if ((px = color[idx | pattern[q | 0x1e]]) !== 0xff) data[p + 0x401] = px;
			if ((px = color[idx | pattern[q | 0x1d]]) !== 0xff) data[p + 0x402] = px;
			if ((px = color[idx | pattern[q | 0x1c]]) !== 0xff) data[p + 0x403] = px;
			if ((px = color[idx | pattern[q | 0x1b]]) !== 0xff) data[p + 0x404] = px;
			if ((px = color[idx | pattern[q | 0x1a]]) !== 0xff) data[p + 0x405] = px;
			if ((px = color[idx | pattern[q | 0x19]]) !== 0xff) data[p + 0x406] = px;
			if ((px = color[idx | pattern[q | 0x18]]) !== 0xff) data[p + 0x407] = px;
			if ((px = color[idx | pattern[q | 0x17]]) !== 0xff) data[p + 0x500] = px;
			if ((px = color[idx | pattern[q | 0x16]]) !== 0xff) data[p + 0x501] = px;
			if ((px = color[idx | pattern[q | 0x15]]) !== 0xff) data[p + 0x502] = px;
			if ((px = color[idx | pattern[q | 0x14]]) !== 0xff) data[p + 0x503] = px;
			if ((px = color[idx | pattern[q | 0x13]]) !== 0xff) data[p + 0x504] = px;
			if ((px = color[idx | pattern[q | 0x12]]) !== 0xff) data[p + 0x505] = px;
			if ((px = color[idx | pattern[q | 0x11]]) !== 0xff) data[p + 0x506] = px;
			if ((px = color[idx | pattern[q | 0x10]]) !== 0xff) data[p + 0x507] = px;
			if ((px = color[idx | pattern[q | 0x0f]]) !== 0xff) data[p + 0x600] = px;
			if ((px = color[idx | pattern[q | 0x0e]]) !== 0xff) data[p + 0x601] = px;
			if ((px = color[idx | pattern[q | 0x0d]]) !== 0xff) data[p + 0x602] = px;
			if ((px = color[idx | pattern[q | 0x0c]]) !== 0xff) data[p + 0x603] = px;
			if ((px = color[idx | pattern[q | 0x0b]]) !== 0xff) data[p + 0x604] = px;
			if ((px = color[idx | pattern[q | 0x0a]]) !== 0xff) data[p + 0x605] = px;
			if ((px = color[idx | pattern[q | 0x09]]) !== 0xff) data[p + 0x606] = px;
			if ((px = color[idx | pattern[q | 0x08]]) !== 0xff) data[p + 0x607] = px;
			if ((px = color[idx | pattern[q | 0x07]]) !== 0xff) data[p + 0x700] = px;
			if ((px = color[idx | pattern[q | 0x06]]) !== 0xff) data[p + 0x701] = px;
			if ((px = color[idx | pattern[q | 0x05]]) !== 0xff) data[p + 0x702] = px;
			if ((px = color[idx | pattern[q | 0x04]]) !== 0xff) data[p + 0x703] = px;
			if ((px = color[idx | pattern[q | 0x03]]) !== 0xff) data[p + 0x704] = px;
			if ((px = color[idx | pattern[q | 0x02]]) !== 0xff) data[p + 0x705] = px;
			if ((px = color[idx | pattern[q | 0x01]]) !== 0xff) data[p + 0x706] = px;
			if ((px = color[idx | pattern[q | 0x00]]) !== 0xff) data[p + 0x707] = px;
			break;
		}
	}

	xfer16x16(data, dst, src, cat) {
		const idx = src >> 5 & 0x3f0;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0x1ff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if (this.opaque[cat][px = OBJCOLOR[idx | this.obj[src++]]])
					data[dst] = px;
	}

	xfer16x16V(data, dst, src, cat) {
		const idx = src >> 5 & 0x3f0;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x1ff00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if (this.opaque[cat][px = OBJCOLOR[idx | this.obj[src++]]])
					data[dst] = px;
	}

	xfer16x16H(data, dst, src, cat) {
		const idx = src >> 5 & 0x3f0;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x1ff00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if (this.opaque[cat][px = OBJCOLOR[idx | this.obj[--src]]])
					data[dst] = px;
	}

	xfer16x16HV(data, dst, src, cat) {
		const idx = src >> 5 & 0x3f0;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x1ff00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if (this.opaque[cat][px = OBJCOLOR[idx | this.obj[--src]]])
					data[dst] = px;
	}
}

/*
 *
 *	Pac-Land
 *
 */

const url = 'pacland.zip';
let PRG1, PRG2, PRG2I, FG, BG, OBJ, RED, BLUE, FGCOLOR, BGCOLOR, OBJCOLOR;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG1 = zip.files['paclandj/pl6_01.8b'].inflate() + zip.files['paclandj/pl6_02.8d'].inflate() + zip.files['pl1_3.8e'].inflate() + zip.files['pl1_4.8f'].inflate();
	PRG1 = new Uint8Array((PRG1 + zip.files['pl1_5.8h'].inflate() + zip.files['paclandj/pl1_6.8j'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	PRG2 = new Uint8Array(zip.files['pl1_7.3e'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	PRG2I = new Uint8Array(zip.files['cus60-60a1.mcu'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	FG = new Uint8Array(zip.files['paclandj/pl6_12.6n'].inflate().split('').map(c => c.charCodeAt(0)));
	BG = new Uint8Array(zip.files['paclandj/pl1_13.6t'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJ = zip.files['paclandj/pl1_9b.6f'].inflate() + zip.files['paclandj/pl1_8.6e'].inflate() + zip.files['paclandj/pl1_10b.7e'].inflate();
	OBJ = new Uint8Array((OBJ + zip.files['paclandj/pl1_11.7f'].inflate()).split('').map(c => c.charCodeAt(0)));
	RED = new Uint8Array(zip.files['pl1-2.1t'].inflate().split('').map(c => c.charCodeAt(0)));
	BLUE = new Uint8Array(zip.files['pl1-1.1r'].inflate().split('').map(c => c.charCodeAt(0)));
	FGCOLOR = new Uint8Array(zip.files['pl1-5.5t'].inflate().split('').map(c => c.charCodeAt(0)));
	BGCOLOR = new Uint8Array(zip.files['pl1-4.4n'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJCOLOR = new Uint8Array(zip.files['pl1-3.6l'].inflate().split('').map(c => c.charCodeAt(0)));
	init({
		game: new PacLand(),
		sound: sound = new C30(),
		rotate: true,
	});
	loop();
}

