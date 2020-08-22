/*
 *
 *	Super Pac-Man
 *
 */

import MappySound from './mappy_sound.js';
import Cpu, {init, loop} from './main.js';
import MC6809 from './mc6809.js';
let sound;

class SuperPacMan {
	cxScreen = 224;
	cyScreen = 288;
	width = 256;
	height = 512;
	xOffset = 16;
	yOffset = 16;

	fReset = false;
	fTest = false;
	fDIPSwitchChanged = true;
	fCoin = false;
	fStart1P = false;
	fStart2P = false;
	dwCoin = 0;
	nPacman = 3;
	nRank = '0';
	nBonus = 'A';
	fAttract = true;

	fPortTest = false;
	fInterruptEnable0 = false;
	fInterruptEnable1 = false;
	fSoundEnable = false;
	ram = new Uint8Array(0x2400).addBase();
	port = new Uint8Array(0x20);

	bg = new Uint8Array(0x4000);
	obj = new Uint8Array(0x10000);
	bgcolor = Uint8Array.from(BGCOLOR, e => ~e & 0xf | 0x10);
	objcolor = Uint8Array.from(OBJCOLOR, e => e & 0xf);
	rgb = new Uint32Array(0x20);

	cpu = new MC6809();
	cpu2 = new MC6809();

	constructor() {
		const systemcontrolarea = addr => {
			switch (addr & 0xff) {
			case 0x00: // INTERRUPT STOP
				return void(this.fInterruptEnable1 = false);
			case 0x01: // INTERRUPT START
				return void(this.fInterruptEnable1 = true);
			case 0x02: // INTERRUPT STOP
				return void(this.fInterruptEnable0 = false);
			case 0x03: // INTERRUPT START
				return void(this.fInterruptEnable0 = true);
			case 0x06: // SND STOP
				return void(this.fSoundEnable = false);
			case 0x07: // SND START
				return void(this.fSoundEnable = true);
			case 0x08: // PORT TEST START
				return void(this.fPortTest = true);
			case 0x09: // PORT TEST END
				return void(this.fPortTest = false);
			case 0x0a: // SUB CPU STOP
				return this.cpu2.disable();
			case 0x0b: // SUB CPU START
				return this.cpu2.enable();
			}
		};

		// CPU周りの初期化
		for (let i = 0; i < 0x20; i++) {
			this.cpu.memorymap[i].base = this.ram.base[i];
			this.cpu.memorymap[i].write = null;
		}
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0x40 + i].read = addr => sound.read(addr);
			this.cpu.memorymap[0x40 + i].write = (addr, data) => sound.write(addr, data);
		}
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0x48 + i].base = this.ram.base[0x20 + i];
			this.cpu.memorymap[0x48 + i].write = null;
		}
		this.cpu.memorymap[0x50].write = systemcontrolarea;
		for (let i = 0; i < 0x40; i++)
			this.cpu.memorymap[0xc0 + i].base = PRG1.base[i];

		for (let i = 0; i < 4; i++) {
			this.cpu2.memorymap[i].read = addr => sound.read(addr);
			this.cpu2.memorymap[i].write = (addr, data) => sound.write(addr, data);
		}
		this.cpu2.memorymap[0x20].write = systemcontrolarea;
		for (let i = 0; i < 0x10; i++)
			this.cpu2.memorymap[0xf0 + i].base = PRG2.base[i];

		// Videoの初期化
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();
	}

	execute() {
		sound.mute(!this.fSoundEnable);
		if (this.fInterruptEnable0)
			this.cpu.interrupt();
		if (this.fInterruptEnable1)
			this.cpu2.interrupt();
		Cpu.multiple_execute([this.cpu, this.cpu2], 0x2000);
		if (this.fInterruptEnable0)
			Cpu.multiple_execute([this.cpu, this.cpu2], 0x2000);
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
				this.port[0x11] = this.port[0x11] & ~0xc | 4;
				break;
			case 2:
				this.port[0x11] = this.port[0x11] & ~0xc | 8;
				break;
			case 3:
				this.port[0x11] &= ~0xc;
				break;
			case 5:
				this.port[0x11] |= 0xc;
				break;
			}
			switch (this.nRank) {
			case '0':
				this.port[0x13] = 0;
				break;
			case '1':
				this.port[0x13] = 1;
				break;
			case '2':
				this.port[0x13] = 2;
				break;
			case '3':
				this.port[0x13] = 3;
				break;
			case '4':
				this.port[0x13] = 4;
				break;
			case '5':
				this.port[0x13] = 5;
				break;
			case '6':
				this.port[0x13] = 6;
				break;
			case '7':
				this.port[0x13] = 7;
				break;
			case '8':
				this.port[0x13] = 8;
				break;
			case '9':
				this.port[0x13] = 9;
				break;
			case 'A':
				this.port[0x13] = 0xa;
				break;
			case 'B':
				this.port[0x13] = 0xb;
				break;
			case 'C':
				this.port[0x13] = 0xc;
				break;
			case 'D':
				this.port[0x13] = 0xd;
				break;
			case 'E':
				this.port[0x13] = 0xe;
				break;
			case 'F':
				this.port[0x13] = 0xf;
				break;
			}
			switch (this.nBonus) {
			case 'A':
				this.port[0x11] &= ~3;
				break;
			case 'B':
				this.port[0x11] = this.port[0x11] & ~3 | 1;
				break;
			case 'C':
				this.port[0x11] = this.port[0x11] & ~3 | 2;
				break;
			case 'D':
				this.port[0x11] |= 3;
				break;
			}
			if (this.fAttract)
				this.port[0x14] &= ~4;
			else
				this.port[0x14] |= 4;
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.port[0x16] |= 8;
		else
			this.port[0x16] &= ~8;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.fSoundEnable = false;
			this.cpu.reset();
			this.cpu2.disable();
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if (this.fCoin && this.dwCoin < 150 && ++this.dwCoin > 99)
			this.dwCoin = 99;
		if (this.fStart1P && !this.ram[0x2009] && this.dwCoin > 0 && this.dwCoin < 150)
			--this.dwCoin;
		if (this.fStart2P && !this.ram[0x2009] && this.dwCoin > 1 && this.dwCoin < 150)
			this.dwCoin -= 2;
		this.fCoin = this.fStart1P = this.fStart2P = false;

		if (!this.fPortTest) {
			let i, p;
			this.ram.set(this.port.subarray(2, 8), 0x2002);
			this.ram.set(this.port.subarray(0x10, 0x18), 0x2010);
			switch (this.ram[0x2008] & 0x0f) {
			case 1:
				this.ram[0x2000] = this.port[5];
				this.ram[0x2001] = this.port[4];
				break;
			case 2:
				this.dwCoin = 0;
				break;
			case 4:
				this.ram[0x2000] = this.dwCoin / 10;
				this.ram[0x2001] = this.dwCoin % 10;
				break;
			case 8:
				for (i = 0, p = 0x2009; p < 0x2010; p++)
					i += this.ram[p] & 0x0f;
				this.ram[0x2000] = i >> 4 & 0x0f;
				this.ram[0x2001] = i & 0x0f;
				break;
			}
			if ((this.ram[0x2018] & 0x0f) === 8) {
				for (i = 0, p = 0x2019; p < 0x2020; p++)
					i += this.ram[p] & 0x0f;
				this.ram[0x2010] = i >> 4 & 0x0f;
				this.ram[0x2011] = i & 0x0f;
			}
			this.port[5] &= ~1;
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
			this.port[4] = this.port[4] & ~4 | 1;
		else
			this.port[4] &= ~1;
	}

	right(fDown) {
		if (fDown)
			this.port[4] = this.port[4] & ~8 | 2;
		else
			this.port[4] &= ~2;
	}

	down(fDown) {
		if (fDown)
			this.port[4] = this.port[4] & ~1 | 4;
		else
			this.port[4] &= ~4;
	}

	left(fDown) {
		if (fDown)
			this.port[4] = this.port[4] & ~2 | 8;
		else
			this.port[4] &= ~8;
	}

	triggerA(fDown) {
		if (fDown)
			this.port[5] |= 3;
		else
			this.port[5] &= ~2;
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
		this.obj.fill(3);
		for (let p = 0, q = 0, i = 128; i !== 0; q += 64, --i) {
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 32] >> j & 1 | OBJ[q + k + 32] >> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k] >> j & 1 | OBJ[q + k] >> (j + 3) & 2;
			}
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
		}
	}

	makeBitmap(data) {
		// 画面クリア
		let p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256, i++)
			data.fill(0x1f, p, p + 224);

		// bg描画
		this.drawBG(data, 0);

		// obj描画
		for (let k = 0x0f80, i = 64; i !== 0; k += 2, --i) {
			const x = this.ram[k + 0x800] - 1 & 0xff;
			const y = (this.ram[k + 0x801] | this.ram[k + 0x1001] << 8) - 24 & 0x1ff;
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

		// bg描画
		this.drawBG(data, 1);

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] = this.rgb[data[p]];
	}

	drawBG(data, pri) {
		let p = 256 * 8 * 4 + 232;
		let k = 0x40;
		for (let i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				this.xfer8x8(data, p, k, pri);
		p = 256 * 8 * 36 + 232;
		k = 2;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
		p = 256 * 8 * 37 + 232;
		k = 0x22;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
		p = 256 * 8 * 2 + 232;
		k = 0x3c2;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
		p = 256 * 8 * 3 + 232;
		k = 0x3e2;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
	}

	xfer8x8(data, p, k, pri) {
		const q = this.ram[k] << 6, idx = this.ram[k + 0x400] << 2 & 0xfc;
		let px;

		if ((this.ram[k + 0x400] >> 6 & 1) !== pri)
			return;
		if ((px = this.bgcolor[idx | this.bg[q | 0x00]]) !== 0x1f) data[p + 0x000] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x01]]) !== 0x1f) data[p + 0x001] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x02]]) !== 0x1f) data[p + 0x002] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x03]]) !== 0x1f) data[p + 0x003] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x04]]) !== 0x1f) data[p + 0x004] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x05]]) !== 0x1f) data[p + 0x005] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x06]]) !== 0x1f) data[p + 0x006] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x07]]) !== 0x1f) data[p + 0x007] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x08]]) !== 0x1f) data[p + 0x100] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x09]]) !== 0x1f) data[p + 0x101] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x0a]]) !== 0x1f) data[p + 0x102] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x0b]]) !== 0x1f) data[p + 0x103] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x0c]]) !== 0x1f) data[p + 0x104] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x0d]]) !== 0x1f) data[p + 0x105] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x0e]]) !== 0x1f) data[p + 0x106] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x0f]]) !== 0x1f) data[p + 0x107] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x10]]) !== 0x1f) data[p + 0x200] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x11]]) !== 0x1f) data[p + 0x201] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x12]]) !== 0x1f) data[p + 0x202] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x13]]) !== 0x1f) data[p + 0x203] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x14]]) !== 0x1f) data[p + 0x204] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x15]]) !== 0x1f) data[p + 0x205] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x16]]) !== 0x1f) data[p + 0x206] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x17]]) !== 0x1f) data[p + 0x207] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x18]]) !== 0x1f) data[p + 0x300] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x19]]) !== 0x1f) data[p + 0x301] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x1a]]) !== 0x1f) data[p + 0x302] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x1b]]) !== 0x1f) data[p + 0x303] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x1c]]) !== 0x1f) data[p + 0x304] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x1d]]) !== 0x1f) data[p + 0x305] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x1e]]) !== 0x1f) data[p + 0x306] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x1f]]) !== 0x1f) data[p + 0x307] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x20]]) !== 0x1f) data[p + 0x400] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x21]]) !== 0x1f) data[p + 0x401] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x22]]) !== 0x1f) data[p + 0x402] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x23]]) !== 0x1f) data[p + 0x403] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x24]]) !== 0x1f) data[p + 0x404] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x25]]) !== 0x1f) data[p + 0x405] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x26]]) !== 0x1f) data[p + 0x406] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x27]]) !== 0x1f) data[p + 0x407] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x28]]) !== 0x1f) data[p + 0x500] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x29]]) !== 0x1f) data[p + 0x501] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x2a]]) !== 0x1f) data[p + 0x502] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x2b]]) !== 0x1f) data[p + 0x503] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x2c]]) !== 0x1f) data[p + 0x504] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x2d]]) !== 0x1f) data[p + 0x505] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x2e]]) !== 0x1f) data[p + 0x506] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x2f]]) !== 0x1f) data[p + 0x507] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x30]]) !== 0x1f) data[p + 0x600] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x31]]) !== 0x1f) data[p + 0x601] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x32]]) !== 0x1f) data[p + 0x602] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x33]]) !== 0x1f) data[p + 0x603] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x34]]) !== 0x1f) data[p + 0x604] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x35]]) !== 0x1f) data[p + 0x605] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x36]]) !== 0x1f) data[p + 0x606] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x37]]) !== 0x1f) data[p + 0x607] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x38]]) !== 0x1f) data[p + 0x700] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x39]]) !== 0x1f) data[p + 0x701] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x3a]]) !== 0x1f) data[p + 0x702] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x3b]]) !== 0x1f) data[p + 0x703] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x3c]]) !== 0x1f) data[p + 0x704] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x3d]]) !== 0x1f) data[p + 0x705] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x3e]]) !== 0x1f) data[p + 0x706] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x3f]]) !== 0x1f) data[p + 0x707] = px;
	}

	xfer16x16(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0xff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj[src++]]) !== 0xf)
					data[dst] = px;
	}

	xfer16x16V(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj[src++]]) !== 0xf)
					data[dst] = px;
	}

	xfer16x16H(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj[--src]]) !== 0xf)
					data[dst] = px;
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj[--src]]) !== 0xf)
					data[dst] = px;
	}
}

/*
 *
 *	Super Pac-Man
 *
 */

const url = 'superpac.zip';
let SND, BG, OBJ, BGCOLOR, OBJCOLOR, RGB, PRG1, PRG2;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG1 = new Uint8Array((zip.files['sp1-2.1c'].inflate() + zip.files['sp1-1.1b'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	PRG2 = new Uint8Array(zip.files['spc-3.1k'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	BG = new Uint8Array(zip.files['sp1-6.3c'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJ = new Uint8Array(zip.files['spv-2.3f'].inflate().split('').map(c => c.charCodeAt(0)));
	RGB = new Uint8Array(zip.files['superpac.4c'].inflate().split('').map(c => c.charCodeAt(0)));
	BGCOLOR = new Uint8Array(zip.files['superpac.4e'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJCOLOR = new Uint8Array(zip.files['superpac.3l'].inflate().split('').map(c => c.charCodeAt(0)));
	SND = new Uint8Array(zip.files['superpac.3m'].inflate().split('').map(c => c.charCodeAt(0)));
	init({
		game: new SuperPacMan(),
		sound: sound = new MappySound({SND}),
	});
	loop();
}

