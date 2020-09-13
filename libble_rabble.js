/*
 *
 *	Libble Rabble
 *
 */

import MappySound from './mappy_sound.js';
import Cpu, {init} from './main.js';
import MC6809 from './mc6809.js';
import MC68000 from  './mc68000.js';
let game, sound;

class LibbleRabble {
	cxScreen = 224;
	cyScreen = 288;
	width = 256;
	height = 512;
	xOffset = 16;
	yOffset = 16;
	rotate = true;

	fReset = true;
	fTest = false;
	fDIPSwitchChanged = true;
	fCoin = false;
	fStart1P = false;
	fStart2P = false;
	nLibbleRabble = 3;
	nBonus = 'A_H';
	fRound = false;
	fAttract = true;
	fPractice = true;
	nRank = 'A';

	fInterruptEnable = false;
	fInterruptEnable2 = false;

	ram = new Uint8Array(0x2100).addBase();
	ram2 = new Uint8Array(0x800).addBase();
	ram3 = new Uint8Array(0x40000).addBase();
	vram = new Uint8Array(0x10000).addBase();
	port = new Uint8Array(0x30);

	bg = new Uint8Array(0x8000);
	obj = new Uint8Array(0x10000);
	rgb = new Uint32Array(0x100);
	palette = 0;

	cpu = new MC6809();
	cpu2 = new MC6809();
	cpu3 = new MC68000();

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x20; i++) {
			this.cpu.memorymap[i].base = this.ram.base[i];
			this.cpu.memorymap[i].write = null;
		}
		for (let i = 0; i < 8; i++) {
			this.cpu.memorymap[0x28 + i].base = this.ram2.base[i];
			this.cpu.memorymap[0x28 + i].write = null;
		}
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0x60 + i].read = addr => sound.read(addr);
			this.cpu.memorymap[0x60 + i].write = (addr, data) => sound.write(addr, data);
		}
		this.cpu.memorymap[0x68].base = this.ram.base[0x20];
		this.cpu.memorymap[0x68].write = null;
		for (let i = 0; i < 0x10; i++)
			this.cpu.memorymap[0x70 + i].write = addr => void(this.fInterruptEnable = (addr & 0x800) === 0);
		for (let i = 0; i < 0x80; i++)
			this.cpu.memorymap[0x80 + i].base = PRG1.base[i];
		for (let i = 0; i < 0x10; i++)
			this.cpu.memorymap[0x80 + i].write = addr => (addr & 0x800) === 0 ? this.cpu3.enable() : this.cpu3.disable();
		for (let i = 0; i < 0x10; i++)
			this.cpu.memorymap[0x90 + i].write = addr => (addr & 0x800) === 0 ? this.cpu2.enable() : this.cpu2.disable();
		this.cpu.memorymap[0xa0].write = addr => void(this.palette = addr << 7 & 0x80);

		for (let i = 0; i < 4; i++) {
			this.cpu2.memorymap[i].read = addr => sound.read(addr);
			this.cpu2.memorymap[i].write = (addr, data) => sound.write(addr, data);
		}
		for (let i = 0; i < 0x20; i++)
			this.cpu2.memorymap[0xe0 + i].base = PRG2.base[i];

		for (let i = 0; i < 0x80; i++)
			this.cpu3.memorymap[i].base = PRG3.base[i];
		for (let i = 0; i < 0x400; i++) {
			this.cpu3.memorymap[0x800 + i].base = this.ram3.base[i];
			this.cpu3.memorymap[0x800 + i].write = null;
		}
		for (let i = 0; i < 0x10; i++) {
			this.cpu3.memorymap[0x1000 + i].read = addr => this.ram2[addr >> 1 & 0x7ff];
			this.cpu3.memorymap[0x1000 + i].write = (addr, data) => void(this.ram2[addr >> 1 & 0x7ff] = data);
		}
		for (let i = 0; i < 0x80; i++) {
			this.cpu3.memorymap[0x1800 + i].read = addr => this.vram[addr = addr << 1 & 0xfffe] << 4 | this.vram[addr | 1] & 0xf;
			this.cpu3.memorymap[0x1800 + i].write = (addr, data) => void(this.vram[addr = addr << 1 & 0xfffe] = data >> 4, this.vram[addr | 1] = data & 0xf);
		}
		for (let i = 0; i < 0x500; i++) {
			this.cpu3.memorymap[0x1900 + i].base = this.vram.base[i & 0xff];
			this.cpu3.memorymap[0x1900 + i].write = null;
		}
		for (let i = 0; i < 0x1000; i++)
			this.cpu3.memorymap[0x3000 + i].write16 = addr => void(this.fInterruptEnable2 = (addr & 0x80000) === 0);

		// Videoの初期化
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();
	}

	execute() {
		if (this.fInterruptEnable)
			this.cpu.interrupt();
		this.cpu2.interrupt();
		if (this.fInterruptEnable2)
			this.cpu3.interrupt(6);
		for (let i = 0; i < 0x100; i++) {
			Cpu.multiple_execute([this.cpu, this.cpu2], 32);
			this.cpu3.execute(48);
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
			switch (this.nLibbleRabble) {
			case 1:
				this.port[0x13] = this.port[0x13] & ~3 | 1;
				break;
			case 2:
				this.port[0x13] |= 3;
				break;
			case 3:
				this.port[0x13] &= ~3;
				break;
			case 5:
				this.port[0x13] = this.port[0x13] & ~3 | 2;
				break;
			}
			switch (this.nBonus) {
			case 'A_H': // 1st 40000 2nd 120000 3rd 200000 4th 400000 5th 600000 6th 1000000
				this.port[0x13] &= ~0xc;
				this.port[0x10] &= ~1;
				break;
			case 'B_I': // 1st 40000 2nd 140000 3rd 250000 4th 400000 5th 700000 6th 1000000
				this.port[0x13] &= ~0xc;
				this.port[0x10] |= 1;
				break;
			case 'C_J': // C: 1st 50000 2nd 150000 3rd 320000 4th 500000 5th 700000 6th 1000000
						// J: 1st 20000 2nd 120000
				this.port[0x13] = this.port[0x13] & ~0xc | 8;
				this.port[0x10] &= ~1;
				break;
			case 'D_K': // D: 1st 40000 2nd 120000 Every 120000
						// K: 1st 50000 2nd 150000
				this.port[0x13] = this.port[0x13] & ~0xc | 8;
				this.port[0x10] |= 1;
				break;
			case 'E_L': // 1st 50000 2nd 150000 Every 150000
				this.port[0x13] = this.port[0x13] & ~0xc | 4;
				this.port[0x10] &= ~1;
				break;
			case 'F_M': // F: 1st 50000 2nd 150000 3rd 300000
						// M: 1st 60000 2nd 200000 Every 200000
				this.port[0x13] = this.port[0x13] & ~0xc | 4;
				this.port[0x10] |= 1;
				break;
			case 'G_N': // G: 1st 40000 2nd 120000 3rd 200000
						// N: 1st 50000
				this.port[0x13] |= 0xc;
				this.port[0x10] &= ~1;
				break;
			case 'Nothing':
				this.port[0x13] |= 0xc;
				this.port[0x10] |= 1;
				break;
			}
			if (this.fRound)
				this.port[0x11] |= 2;
			else
				this.port[0x11] &= ~2;
			if (this.fAttract)
				this.port[0x11] &= ~4;
			else
				this.port[0x11] |= 4;
			if (this.fPractice)
				this.port[0x12] &= ~2;
			else
				this.port[0x12] |= 2;
			switch (this.nRank) {
			case 'A':
				this.port[0x12] &= ~0xc;
				break;
			case 'B':
				this.port[0x12] = this.port[0x12] & ~0xc | 8;
				break;
			case 'C':
				this.port[0x12] = this.port[0x12] & ~0xc | 4;
				break;
			case 'D':
				this.port[0x12] |= 0xc;
				break;
			}
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.port[0x27] |= 8;
		else
			this.port[0x27] &= ~8;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu.reset();
			this.cpu2.disable();
			this.cpu3.disable();
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if (this.fCoin && this.ram[0x2008] === 3) {
			let i = (this.ram[0x2002] & 0xf) * 10 + (this.ram[0x2003] & 0xf);
			if (i < 150) {
				i++;
				if (i > 99)
					i = 99;
				this.ram[0x2002] = i / 10;
				this.ram[0x2003] = i % 10;
				this.ram[0x2000] = 1;
			}
		}
		if (this.fStart1P && this.ram[0x2008] === 3) {
			let i = (this.ram[0x2002] & 0xf) * 10 + (this.ram[0x2003] & 0xf);
			if (i >= 150)
				this.ram[0x2001] |= 1 << 0;
			else if (i > 0) {
				this.ram[0x2001] |= 1 << 0;
				--i;
				this.ram[0x2002] = i / 10;
				this.ram[0x2003] = i % 10;
			}
		}
		if (this.fStart2P && this.ram[0x2008] === 3) {
			let i = (this.ram[0x2002] & 0xf) * 10 + (this.ram[0x2003] & 0xf);
			if (i >= 150)
				this.ram[0x2001] |= 1 << 1;
			else if (i > 1) {
				this.ram[0x2001] |= 1 << 1;
				i -= 2;
				this.ram[0x2002] = i / 10;
				this.ram[0x2003] = i % 10;
			}
		}
		this.fCoin = this.fStart1P = this.fStart2P = false;

		// Port Emulations
		switch (this.ram[0x2008] & 0xf) {
		case 1:
		case 3:
			this.ram.set(this.port.subarray(4, 8), 0x2004);
			break;
		case 5:
			this.ram.set(Uint8Array.of(0, 0xf, 0xd, 9, 1, 0xc, 0xc), 0x2001);
			break;
		}
		switch (this.ram[0x2018] & 0xf) {
		case 1:
			this.ram.set(this.port.subarray(0x10, 0x14), 0x2010);
			break;
		case 7:
			this.ram[0x2012] = 0xe;
			break;
		}
		switch (this.ram[0x2028] & 0xf) {
		case 7:
			this.ram[0x2027] = 6;
			break;
		case 9:
			this.ram.set(this.port.subarray(0x20, 0x28), 0x2020);
			break;
		}
		return this;
	}

	coin() {
		this.fCoin = true;
	}

	start1P() {
		this.fStart1P = true;
	}

	start2P() {
		this.fStart2P = true;
	}

	up(fDown) {
		if (fDown)
			this.port[0x22] = this.port[0x22] & ~(1 << 2) | 1 << 0;
		else
			this.port[0x22] &= ~(1 << 0);
	}

	right(fDown) {
		if (fDown)
			this.port[0x22] = this.port[0x22] & ~(1 << 3) | 1 << 1;
		else
			this.port[0x22] &= ~(1 << 1);
	}

	down(fDown) {
		if (fDown)
			this.port[0x22] = this.port[0x22] & ~(1 << 0) | 1 << 2;
		else
			this.port[0x22] &= ~(1 << 2);
	}

	left(fDown) {
		if (fDown)
			this.port[0x22] = this.port[0x22] & ~(1 << 1) | 1 << 3;
		else
			this.port[0x22] &= ~(1 << 3);
	}

	up2(fDown) {
		if (fDown)
			this.port[4] = this.port[4] & ~(1 << 2) | 1 << 0;
		else
			this.port[4] &= ~(1 << 0);
	}

	right2(fDown) {
		if (fDown)
			this.port[4] = this.port[4] & ~(1 << 3) | 1 << 1;
		else
			this.port[4] &= ~(1 << 1);
	}

	down2(fDown) {
		if (fDown)
			this.port[4] = this.port[4] & ~(1 << 0) | 1 << 2;
		else
			this.port[4] &= ~(1 << 2);
	}

	left2(fDown) {
		if (fDown)
			this.port[4] = this.port[4] & ~(1 << 1) | 1 << 3;
		else
			this.port[4] &= ~(1 << 3);
	}

	triggerA(fDown) {
	}

	triggerB(fDown) {
	}

	convertRGB() {
		for (let i = 0; i < 0x100; i++)
			this.rgb[i] = (RED[i] & 0xf) * 255 / 15	// Red
				| (GREEN[i] & 0xf) * 255 / 15 << 8	// Green
				| (BLUE[i] & 0xf) * 255 / 15 << 16	// Blue
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
		for (let p = 0, q = 0, i = 256; i !== 0; q += 64, --i) {
			for (let j = 3; j >= 0; --j) {
				for (let k = 39; k >= 32; --k)
					this.obj[p++] = OBJ[q + k] >> j & 1 | OBJ[q + k] >> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k] >> j & 1 | OBJ[q + k] >> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 47; k >= 40; --k)
					this.obj[p++] = OBJ[q + k] >> j & 1 | OBJ[q + k] >> (j + 3) & 2;
				for (let k = 15; k >= 8; --k)
					this.obj[p++] = OBJ[q + k] >> j & 1 | OBJ[q + k] >> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 55; k >= 48; --k)
					this.obj[p++] = OBJ[q + k] >> j & 1 | OBJ[q + k] >> (j + 3) & 2;
				for (let k = 23; k >= 16; --k)
					this.obj[p++] = OBJ[q + k] >> j & 1 | OBJ[q + k] >> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 63; k >= 56; --k)
					this.obj[p++] = OBJ[q + k] >> j & 1 | OBJ[q + k] >> (j + 3) & 2;
				for (let k = 31; k >= 24; --k)
					this.obj[p++] = OBJ[q + k] >> j & 1 | OBJ[q + k] >> (j + 3) & 2;
			}
		}
	}

	makeBitmap(data) {
		// graphic描画
		let p = 256 * 8 * 2 + 239;
		let k = 0x200;
		let idx = 0x60 | this.palette;
		for (let i = 0; i < 224; p -= 256 * 288 + 1, i++)
			for (let j = 0; j < 288; k++, p += 256, j++)
				data[p] = idx | this.vram[k];

		// bg描画
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
		for (let k = 0xf80, i = 64; i !== 0; k += 2, --i) {
			const x = this.ram[k + 0x800] + 7 & 0xff;
			const y = (this.ram[k + 0x801] | this.ram[k + 0x1001] << 8) - 55 & 0x1ff;
			const src = this.ram[k] | this.ram[k + 1] << 8;
			switch (this.ram[k + 0x1000] & 0x0f) {
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
				this.xfer16x16(data, x | y << 8, src & ~1);
				this.xfer16x16(data, x | (y + 16 & 0x1ff) << 8, src | 1);
				break;
			case 0x05: // V反転
				this.xfer16x16V(data, x | y << 8, src | 1);
				this.xfer16x16V(data, x | (y + 16 & 0x1ff) << 8, src & ~1);
				break;
			case 0x06: // H反転
				this.xfer16x16H(data, x | y << 8, src & ~1);
				this.xfer16x16H(data, x | (y + 16 & 0x1ff) << 8, src | 1);
				break;
			case 0x07: // HV反転
				this.xfer16x16HV(data, x | y << 8, src | 1);
				this.xfer16x16HV(data, x | (y + 16 & 0x1ff) << 8, src & ~1);
				break;
			case 0x08: // ノーマル
				this.xfer16x16(data, x | y << 8, src | 2);
				this.xfer16x16(data, x + 16 & 0xff | y << 8, src & ~2);
				break;
			case 0x09: // V反転
				this.xfer16x16V(data, x | y << 8, src | 2);
				this.xfer16x16V(data, x + 16 & 0xff | y << 8, src & ~2);
				break;
			case 0x0a: // H反転
				this.xfer16x16H(data, x | y << 8, src & ~2);
				this.xfer16x16H(data, x + 16 & 0xff | y << 8, src | 2);
				break;
			case 0x0b: // HV反転
				this.xfer16x16HV(data, x | y << 8, src & ~2);
				this.xfer16x16HV(data, x + 16 & 0xff | y << 8, src | 2);
				break;
			case 0x0c: // ノーマル
				this.xfer16x16(data, x | y << 8, src & ~3 | 2);
				this.xfer16x16(data, x | (y + 16 & 0x1ff) << 8, src | 3);
				this.xfer16x16(data, x + 16 & 0xff | y << 8, src & ~3);
				this.xfer16x16(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3 | 1);
				break;
			case 0x0d: // V反転
				this.xfer16x16V(data, x | y << 8, src | 3);
				this.xfer16x16V(data, x | (y + 16 & 0x1ff) << 8, src & ~3 | 2);
				this.xfer16x16V(data, x + 16 & 0xff | y << 8, src & ~3 | 1);
				this.xfer16x16V(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3);
				break;
			case 0x0e: // H反転
				this.xfer16x16H(data, x | y << 8, src & ~3);
				this.xfer16x16H(data, x | (y + 16 & 0x1ff) << 8, src & ~3 | 1);
				this.xfer16x16H(data, x + 16 & 0xff | y << 8, src & ~3 | 2);
				this.xfer16x16H(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src | 3);
				break;
			case 0x0f: // HV反転
				this.xfer16x16HV(data, x | y << 8, src & ~3 | 1);
				this.xfer16x16HV(data, x | (y + 16 & 0x1ff) << 8, src & ~3);
				this.xfer16x16HV(data, x + 16 & 0xff | y << 8, src | 3);
				this.xfer16x16HV(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3 | 2);
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

		if ((px = BGCOLOR[idx | this.bg[q | 0x00]]) !== 0xf) data[p + 0x000] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x01]]) !== 0xf) data[p + 0x001] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x02]]) !== 0xf) data[p + 0x002] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x03]]) !== 0xf) data[p + 0x003] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x04]]) !== 0xf) data[p + 0x004] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x05]]) !== 0xf) data[p + 0x005] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x06]]) !== 0xf) data[p + 0x006] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x07]]) !== 0xf) data[p + 0x007] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x08]]) !== 0xf) data[p + 0x100] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x09]]) !== 0xf) data[p + 0x101] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x0a]]) !== 0xf) data[p + 0x102] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x0b]]) !== 0xf) data[p + 0x103] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x0c]]) !== 0xf) data[p + 0x104] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x0d]]) !== 0xf) data[p + 0x105] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x0e]]) !== 0xf) data[p + 0x106] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x0f]]) !== 0xf) data[p + 0x107] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x10]]) !== 0xf) data[p + 0x200] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x11]]) !== 0xf) data[p + 0x201] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x12]]) !== 0xf) data[p + 0x202] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x13]]) !== 0xf) data[p + 0x203] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x14]]) !== 0xf) data[p + 0x204] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x15]]) !== 0xf) data[p + 0x205] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x16]]) !== 0xf) data[p + 0x206] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x17]]) !== 0xf) data[p + 0x207] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x18]]) !== 0xf) data[p + 0x300] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x19]]) !== 0xf) data[p + 0x301] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x1a]]) !== 0xf) data[p + 0x302] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x1b]]) !== 0xf) data[p + 0x303] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x1c]]) !== 0xf) data[p + 0x304] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x1d]]) !== 0xf) data[p + 0x305] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x1e]]) !== 0xf) data[p + 0x306] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x1f]]) !== 0xf) data[p + 0x307] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x20]]) !== 0xf) data[p + 0x400] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x21]]) !== 0xf) data[p + 0x401] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x22]]) !== 0xf) data[p + 0x402] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x23]]) !== 0xf) data[p + 0x403] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x24]]) !== 0xf) data[p + 0x404] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x25]]) !== 0xf) data[p + 0x405] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x26]]) !== 0xf) data[p + 0x406] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x27]]) !== 0xf) data[p + 0x407] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x28]]) !== 0xf) data[p + 0x500] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x29]]) !== 0xf) data[p + 0x501] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x2a]]) !== 0xf) data[p + 0x502] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x2b]]) !== 0xf) data[p + 0x503] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x2c]]) !== 0xf) data[p + 0x504] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x2d]]) !== 0xf) data[p + 0x505] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x2e]]) !== 0xf) data[p + 0x506] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x2f]]) !== 0xf) data[p + 0x507] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x30]]) !== 0xf) data[p + 0x600] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x31]]) !== 0xf) data[p + 0x601] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x32]]) !== 0xf) data[p + 0x602] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x33]]) !== 0xf) data[p + 0x603] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x34]]) !== 0xf) data[p + 0x604] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x35]]) !== 0xf) data[p + 0x605] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x36]]) !== 0xf) data[p + 0x606] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x37]]) !== 0xf) data[p + 0x607] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x38]]) !== 0xf) data[p + 0x700] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x39]]) !== 0xf) data[p + 0x701] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x3a]]) !== 0xf) data[p + 0x702] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x3b]]) !== 0xf) data[p + 0x703] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x3c]]) !== 0xf) data[p + 0x704] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x3d]]) !== 0xf) data[p + 0x705] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x3e]]) !== 0xf) data[p + 0x706] = idx2 | px;
		if ((px = BGCOLOR[idx | this.bg[q | 0x3f]]) !== 0xf) data[p + 0x707] = idx2 | px;
	}

	xfer16x16(data, dst, src) {
		const idx = src >> 6 & 0xfc | 0x100;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0xff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[src++]]) !== 0xff)
					data[dst] = px;
	}

	xfer16x16V(data, dst, src) {
		const idx = src >> 6 & 0xfc | 0x100;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[src++]]) !== 0xff)
					data[dst] = px;
	}

	xfer16x16H(data, dst, src) {
		const idx = src >> 6 & 0xfc | 0x100;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[--src]]) !== 0xff)
					data[dst] = px;
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >> 6 & 0xfc | 0x100;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
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
 *	Libble Rabble
 *
 */

const url = 'liblrabl.zip';
const PRG3 = new Uint8Array(0x8000).addBase();
let PRG1, PRG2, BG, OBJ, RED, GREEN, BLUE, BGCOLOR, OBJCOLOR, SND;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG1 = new Uint8Array((zip.files['5b.rom'].inflate() + zip.files['5c.rom'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	PRG2 = new Uint8Array(zip.files['2c.rom'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	zip.files['8c.rom'].inflate().split('').forEach((c, i) => PRG3[i << 1] = c.charCodeAt(0));
	zip.files['10c.rom'].inflate().split('').forEach((c, i) => PRG3[1 | i << 1] = c.charCodeAt(0));
	BG = new Uint8Array(zip.files['5p.rom'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJ = new Uint8Array(zip.files['9t.rom'].inflate().split('').map(c => c.charCodeAt(0)));
	RED = new Uint8Array(zip.files['lr1-3.1r'].inflate().split('').map(c => c.charCodeAt(0)));
	GREEN = new Uint8Array(zip.files['lr1-2.1s'].inflate().split('').map(c => c.charCodeAt(0)));
	BLUE = new Uint8Array(zip.files['lr1-1.1t'].inflate().split('').map(c => c.charCodeAt(0)));
	BGCOLOR = new Uint8Array(zip.files['lr1-5.5l'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJCOLOR = new Uint8Array(zip.files['lr1-6.2p'].inflate().split('').map(c => c.charCodeAt(0)));
	SND = new Uint8Array(zip.files['lr1-4.3d'].inflate().split('').map(c => c.charCodeAt(0)));
	game = new LibbleRabble();
	sound = new MappySound({SND});
	canvas.addEventListener('click', () => game.coin());
	init({game, sound});
}

