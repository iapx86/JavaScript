/*
 *
 *	Pac & Pal
 *
 */

import MappySound from './mappy_sound.js';
import Cpu, {init, read} from './main.js';
import MC6809 from './mc6809.js';
let game, sound;

class PacAndPal {
	cxScreen = 224;
	cyScreen = 288;
	width = 256;
	height = 512;
	xOffset = 16;
	yOffset = 16;
	rotate = false;

	fReset = false;
	fTest = false;
	fDIPSwitchChanged = true;
	fCoin = 0;
	fStart1P = 0;
	fStart2P = 0;
	nPacman = 3;
	nRank = 'B';
	nBonus = 'E';

	fPortTest = false;
	fInterruptEnable0 = false;
	fInterruptEnable1 = false;
//	fSoundEnable = false;
	ram = new Uint8Array(0x2000).addBase();
	port = new Uint8Array(0x40);
	in = new Uint8Array(10);

	bg = new Uint8Array(0x4000);
	obj = new Uint8Array(0x10000);
	bgcolor = Uint8Array.from(BGCOLOR, e => ~e & 0xf | 0x10);
	objcolor = Uint8Array.from(OBJCOLOR, e => e & 0xf);
	rgb;

	cpu = new MC6809();
	cpu2 = new MC6809();

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x20; i++) {
			this.cpu.memorymap[i].base = this.ram.base[i];
			this.cpu.memorymap[i].write = null;
		}
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0x40 + i].read = (addr) => { return sound.read(addr); };
			this.cpu.memorymap[0x40 + i].write = (addr, data) => { sound.write(addr, data); };
		}
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0x48 + i].read = (addr) => { return this.port[addr & 0x3f] | 0xf0; };
			this.cpu.memorymap[0x48 + i].write = (addr, data) => { this.port[addr & 0x3f] = data & 0xf; };
		}
		this.cpu.memorymap[0x50].write = (addr) => {
			switch (addr & 0xff) {
			case 0x00: // INTERRUPT STOP
				return void(this.fInterruptEnable1 = false);
			case 0x01: // INTERRUPT START
				return void(this.fInterruptEnable1 = true);
			case 0x02: // INTERRUPT STOP
				return void(this.fInterruptEnable0 = false);
			case 0x03: // INTERRUPT START
				return void(this.fInterruptEnable0 = true);
//			case 0x06: // SND STOP
//				return void(this.fSoundEnable = false);
//			case 0x07: // SND START
//				return void(this.fSoundEnable = true);
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
		for (let i = 0; i < 0x60; i++)
			this.cpu.memorymap[0xa0 + i].base = PRG1.base[i];

		for (let i = 0; i < 4; i++) {
			this.cpu2.memorymap[i].read = (addr) => { return sound.read(addr); };
			this.cpu2.memorymap[i].write = (addr, data) => { sound.write(addr, data); };
		}
		this.cpu2.memorymap[0x20].write = this.cpu.memorymap[0x50].write;
		for (let i = 0; i < 0x10; i++)
			this.cpu2.memorymap[0xf0 + i].base = PRG2.base[i];

		// Videoの初期化
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();
	}

	execute() {
//		sound.mute(!this.fSoundEnable);
		this.fInterruptEnable0 && this.cpu.interrupt(), this.fInterruptEnable1 && this.cpu2.interrupt();
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
			switch (this.nBonus) {
			case 'A':
				this.in[7] &= ~3, this.in[6] |= 8;
				break;
			case 'B':
				this.in[7] = this.in[7] & ~3 | 1, this.in[6] &= ~8;
				break;
			case 'C':
				this.in[7] = this.in[7] & ~3 | 1, this.in[6] |= 8;
				break;
			case 'D':
				this.in[7] = this.in[7] & ~3 | 2, this.in[6] &= ~8;
				break;
			case 'E':
				this.in[7] = this.in[7] & ~3 | 2, this.in[6] |= 8;
				break;
			case 'F':
				this.in[7] |= 3, this.in[6] &= ~8;
				break;
			case 'G':
				this.in[7] |= 3, this.in[6] |= 8;
				break;
			case 'NONE':
				this.in[7] &= ~3, this.in[6] &= ~8;
				break;
			}
			switch (this.nPacman) {
			case 1:
				this.in[7] &= ~0xc;
				break;
			case 2:
				this.in[7] = this.in[7] & ~0xc | 4;
				break;
			case 3:
				this.in[7] = this.in[7] & ~0xc | 8;
				break;
			case 5:
				this.in[7] |= 0xc;
				break;
			}
			switch (this.nRank) {
			case 'A':
				this.in[5] &= ~0xc;
				break;
			case 'B':
				this.in[5] = this.in[5] & ~0xc | 4;
				break;
			case 'C':
				this.in[5] = this.in[5] & ~0xc | 8;
				break;
			case 'D':
				this.in[5] |= 0xc;
				break;
			}
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.in[8] |= 8;
		else
			this.in[8] &= ~8;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
//			this.fSoundEnable = false;
			this.cpu.reset();
			this.cpu2.disable();
		}
		return this;
	}

	updateInput() {
		this.in[0] = !!this.fCoin << 3, this.in[3] = this.in[3] & 3 | !!this.fStart1P << 2 | !!this.fStart2P << 3;
		this.fCoin -= !!this.fCoin, this.fStart1P -= !!this.fStart1P, this.fStart2P -= !!this.fStart2P;
		if (this.fPortTest)
			return this;
		if (this.port[8] === 1)
			this.port.set(this.in.subarray(0, 4));
		if (this.port[0x18] === 3)
			this.port.set([this.in[5], this.in[7], this.in[6], this.in[8]], 0x14);
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
		this.in[1] = this.in[1] & ~(1 << 0 | fDown << 2) | fDown << 0;
	}

	right(fDown) {
		this.in[1] = this.in[1] & ~(1 << 1 | fDown << 3) | fDown << 1;
	}

	down(fDown) {
		this.in[1] = this.in[1] & ~(1 << 2 | fDown << 0) | fDown << 2;
	}

	left(fDown) {
		this.in[1] = this.in[1] & ~(1 << 3 | fDown << 1) | fDown << 3;
	}

	triggerA(fDown) {
		this.in[3] = this.in[3] & ~(1 << 0) | fDown << 0;
	}

	convertRGB() {
		this.rgb = Uint32Array.from(RGB, e => 0xff000000 | (e >> 6) * 255 / 3 << 16 | (e >> 3 & 7) * 255 / 7 << 8 | (e & 7) * 255 / 7);
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
		for (let k = 0x40, i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				this.xfer8x8(data, p, k, pri);
		p = 256 * 8 * 36 + 232;
		for (let k = 2, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
		p = 256 * 8 * 37 + 232;
		for (let k = 0x22, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
		p = 256 * 8 * 2 + 232;
		for (let k = 0x3c2, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
		p = 256 * 8 * 3 + 232;
		for (let k = 0x3e2, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
	}

	xfer8x8(data, p, k, pri) {
		const q = this.ram[k] << 6, idx = this.ram[k + 0x400] << 2 & 0xfc;
		let px;

		if ((this.ram[k + 0x400] >> 6 & 1) !== pri)
			return;
		(px = this.bgcolor[idx | this.bg[q | 0x00]]) !== 0x1f && data[p + 0x000] > 1 && (data[p + 0x000] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x01]]) !== 0x1f && data[p + 0x001] > 1 && (data[p + 0x001] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x02]]) !== 0x1f && data[p + 0x002] > 1 && (data[p + 0x002] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x03]]) !== 0x1f && data[p + 0x003] > 1 && (data[p + 0x003] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x04]]) !== 0x1f && data[p + 0x004] > 1 && (data[p + 0x004] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x05]]) !== 0x1f && data[p + 0x005] > 1 && (data[p + 0x005] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x06]]) !== 0x1f && data[p + 0x006] > 1 && (data[p + 0x006] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x07]]) !== 0x1f && data[p + 0x007] > 1 && (data[p + 0x007] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x08]]) !== 0x1f && data[p + 0x100] > 1 && (data[p + 0x100] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x09]]) !== 0x1f && data[p + 0x101] > 1 && (data[p + 0x101] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x0a]]) !== 0x1f && data[p + 0x102] > 1 && (data[p + 0x102] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x0b]]) !== 0x1f && data[p + 0x103] > 1 && (data[p + 0x103] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x0c]]) !== 0x1f && data[p + 0x104] > 1 && (data[p + 0x104] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x0d]]) !== 0x1f && data[p + 0x105] > 1 && (data[p + 0x105] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x0e]]) !== 0x1f && data[p + 0x106] > 1 && (data[p + 0x106] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x0f]]) !== 0x1f && data[p + 0x107] > 1 && (data[p + 0x107] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x10]]) !== 0x1f && data[p + 0x200] > 1 && (data[p + 0x200] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x11]]) !== 0x1f && data[p + 0x201] > 1 && (data[p + 0x201] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x12]]) !== 0x1f && data[p + 0x202] > 1 && (data[p + 0x202] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x13]]) !== 0x1f && data[p + 0x203] > 1 && (data[p + 0x203] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x14]]) !== 0x1f && data[p + 0x204] > 1 && (data[p + 0x204] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x15]]) !== 0x1f && data[p + 0x205] > 1 && (data[p + 0x205] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x16]]) !== 0x1f && data[p + 0x206] > 1 && (data[p + 0x206] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x17]]) !== 0x1f && data[p + 0x207] > 1 && (data[p + 0x207] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x18]]) !== 0x1f && data[p + 0x300] > 1 && (data[p + 0x300] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x19]]) !== 0x1f && data[p + 0x301] > 1 && (data[p + 0x301] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x1a]]) !== 0x1f && data[p + 0x302] > 1 && (data[p + 0x302] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x1b]]) !== 0x1f && data[p + 0x303] > 1 && (data[p + 0x303] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x1c]]) !== 0x1f && data[p + 0x304] > 1 && (data[p + 0x304] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x1d]]) !== 0x1f && data[p + 0x305] > 1 && (data[p + 0x305] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x1e]]) !== 0x1f && data[p + 0x306] > 1 && (data[p + 0x306] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x1f]]) !== 0x1f && data[p + 0x307] > 1 && (data[p + 0x307] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x20]]) !== 0x1f && data[p + 0x400] > 1 && (data[p + 0x400] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x21]]) !== 0x1f && data[p + 0x401] > 1 && (data[p + 0x401] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x22]]) !== 0x1f && data[p + 0x402] > 1 && (data[p + 0x402] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x23]]) !== 0x1f && data[p + 0x403] > 1 && (data[p + 0x403] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x24]]) !== 0x1f && data[p + 0x404] > 1 && (data[p + 0x404] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x25]]) !== 0x1f && data[p + 0x405] > 1 && (data[p + 0x405] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x26]]) !== 0x1f && data[p + 0x406] > 1 && (data[p + 0x406] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x27]]) !== 0x1f && data[p + 0x407] > 1 && (data[p + 0x407] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x28]]) !== 0x1f && data[p + 0x500] > 1 && (data[p + 0x500] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x29]]) !== 0x1f && data[p + 0x501] > 1 && (data[p + 0x501] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x2a]]) !== 0x1f && data[p + 0x502] > 1 && (data[p + 0x502] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x2b]]) !== 0x1f && data[p + 0x503] > 1 && (data[p + 0x503] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x2c]]) !== 0x1f && data[p + 0x504] > 1 && (data[p + 0x504] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x2d]]) !== 0x1f && data[p + 0x505] > 1 && (data[p + 0x505] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x2e]]) !== 0x1f && data[p + 0x506] > 1 && (data[p + 0x506] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x2f]]) !== 0x1f && data[p + 0x507] > 1 && (data[p + 0x507] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x30]]) !== 0x1f && data[p + 0x600] > 1 && (data[p + 0x600] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x31]]) !== 0x1f && data[p + 0x601] > 1 && (data[p + 0x601] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x32]]) !== 0x1f && data[p + 0x602] > 1 && (data[p + 0x602] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x33]]) !== 0x1f && data[p + 0x603] > 1 && (data[p + 0x603] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x34]]) !== 0x1f && data[p + 0x604] > 1 && (data[p + 0x604] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x35]]) !== 0x1f && data[p + 0x605] > 1 && (data[p + 0x605] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x36]]) !== 0x1f && data[p + 0x606] > 1 && (data[p + 0x606] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x37]]) !== 0x1f && data[p + 0x607] > 1 && (data[p + 0x607] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x38]]) !== 0x1f && data[p + 0x700] > 1 && (data[p + 0x700] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x39]]) !== 0x1f && data[p + 0x701] > 1 && (data[p + 0x701] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x3a]]) !== 0x1f && data[p + 0x702] > 1 && (data[p + 0x702] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x3b]]) !== 0x1f && data[p + 0x703] > 1 && (data[p + 0x703] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x3c]]) !== 0x1f && data[p + 0x704] > 1 && (data[p + 0x704] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x3d]]) !== 0x1f && data[p + 0x705] > 1 && (data[p + 0x705] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x3e]]) !== 0x1f && data[p + 0x706] > 1 && (data[p + 0x706] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x3f]]) !== 0x1f && data[p + 0x707] > 1 && (data[p + 0x707] = px);
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
 *	Pac & Pal
 *
 */

let SND, BG, OBJ, BGCOLOR, OBJCOLOR, RGB, PRG1, PRG2;

read('pacnpal.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG1 = Uint8Array.concat(...['pap1-3b.1d', 'pap1-2b.1c', 'pap3-1.1b'].map(e => zip.decompress(e))).addBase();
	PRG2 = zip.decompress('pap1-4.1k').addBase();
	BG = zip.decompress('pap1-6.3c');
	OBJ = zip.decompress('pap1-5.3f');
	RGB = zip.decompress('pap1-6.4c');
	BGCOLOR = zip.decompress('pap1-5.4e');
	OBJCOLOR = zip.decompress('pap1-4.3l');
	SND = zip.decompress('pap1-3.3m');
	game = new PacAndPal();
	sound = new MappySound({SND});
	canvas.addEventListener('click', () => game.coin());
	init({game, sound});
});

