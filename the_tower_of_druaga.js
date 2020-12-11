/*
 *
 *	The Tower of Druaga
 *
 */

import MappySound from './mappy_sound.js';
import Cpu, {init, read} from './main.js';
import MC6809 from './mc6809.js';
let game, sound;

class TheTowerOfDruaga {
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
	nGilgamesh = 3;

	fPortTest = false;
	fInterruptEnable0 = false;
	fInterruptEnable1 = false;
//	fSoundEnable = false;
	ram = new Uint8Array(0x2800).addBase();
	port = new Uint8Array(0x40);
	in = new Uint8Array(10);
	edge1 = 0xf;
	edge2 = 0xf;

	bg = new Uint8Array(0x4000);
	obj = new Uint8Array(0x10000);
	bgcolor = Uint8Array.from(BGCOLOR, e => e & 0xf | 0x10);
	objcolor = Uint8Array.from(OBJCOLOR, e => e & 0xf);
	rgb = Uint32Array.from(RGB, e => (e & 7) * 255 / 7 | (e >> 3 & 7) * 255 / 7 << 8 | (e >> 6) * 255 / 3 << 16 | 0xff000000);
	dwScroll = 0xff;

	cpu = new MC6809();
	cpu2 = new MC6809();

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x28; i++) {
			this.cpu.memorymap[i].base = this.ram.base[i];
			this.cpu.memorymap[i].write = null;
		}
		for (let i = 0; i < 8; i++)
			this.cpu.memorymap[0x38 + i].write = (addr) => { this.dwScroll = addr >> 3 & 0xff; };
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
		for (let i = 0; i < 0x80; i++)
			this.cpu.memorymap[0x80 + i].base = PRG1.base[i];

		for (let i = 0; i < 4; i++) {
			this.cpu2.memorymap[i].read = (addr) => { return sound.read(addr); };
			this.cpu2.memorymap[i].write = (addr, data) => { sound.write(addr, data); };
		}
		this.cpu2.memorymap[0x20].write = this.cpu.memorymap[0x50].write;
		for (let i = 0; i < 0x20; i++)
			this.cpu2.memorymap[0xe0 + i].base = PRG2.base[i];

		// Videoの初期化
		this.convertBG();
		this.convertOBJ();
	}

	execute() {
//		sound.mute(!this.fSoundEnable);
		this.fInterruptEnable0 && this.cpu.interrupt(), this.fInterruptEnable1 && this.cpu2.interrupt();
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
			switch (this.nGilgamesh) {
			case 1:
				this.in[6] = this.in[6] & ~3 | 2;
				break;
			case 2:
				this.in[6] = this.in[6] & ~3 | 1;
				break;
			case 3:
				this.in[6] &= ~3;
				break;
			case 5:
				this.in[6] |= 3;
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
		this.edge1 &= this.in[3], this.edge2 &= this.in[8];
		if (this.fPortTest)
			return this.edge1 = this.in[3] ^ 0xf, this.edge2 = this.in[8] ^ 0xf, this;
		if (this.port[8] === 1)
			this.port.set(this.in.subarray(0, 4), 4);
		else if (this.port[8] === 3) {
			let credit = this.port[2] * 10 + this.port[3];
			if (this.fCoin && credit < 150)
				this.port[0] += 1, credit = Math.min(credit + 1, 99);
			if (!this.port[9] && this.fStart1P && credit > 0)
				this.port[1] += 1, credit -= (credit < 150);
			if (!this.port[9] && this.fStart2P && credit > 1)
				this.port[1] += 2, credit -= (credit < 150) * 2;
			this.port[2] = credit / 10, this.port[3] = credit % 10;
			this.port.set([this.in[1], this.in[3] << 1 & 0xa | this.edge1 & 5, this.in[2], this.in[3] & 0xa | this.edge1 >> 1 & 5], 4);
		}
		if (this.port[0x18] === 4)
			this.port.set([this.in[6], this.in[8] << 1 & 0xa | this.edge2 & 5, this.in[7], this.in[8] & 0xa | this.edge2 >> 1 & 5], 0x14);
		return this.edge1 = this.in[3] ^ 0xf, this.edge2 = this.in[8] ^ 0xf, this;
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

	convertBG() {
		for (let p = 0, q = 0, i = 256; i !== 0; q += 16, --i) {
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = ~BG[q + k + 8] >> j & 1 | ~BG[q + k + 8] >> (j + 3) & 2;
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = ~BG[q + k] >> j & 1 | ~BG[q + k] >> (j + 3) & 2;
		}
	}

	convertOBJ() {
		this.obj.fill(0xf);
		for (let p = 0, q = 0, i = 128; i !== 0; q += 64, --i) {
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 32] >> j & 1 | OBJ[q + k + 32] >> (j + 3) & 2 | OBJ[q + k + 0x2000 + 32] >> j << 2 & 4 | OBJ[q + k + 0x2000 + 32] >> (j + 1) & 8;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k] >> j & 1 | OBJ[q + k] >> (j + 3) & 2 | OBJ[q + k + 0x2000] >> j << 2 & 4 | OBJ[q + k + 0x2000] >> (j + 1) & 8;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 40] >> j & 1 | OBJ[q + k + 40] >> (j + 3) & 2 | OBJ[q + k + 0x2000 + 40] >> j << 2 & 4 | OBJ[q + k + 0x2000 + 40] >> (j + 1) & 8;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 8] >> j & 1 | OBJ[q + k + 8] >> (j + 3) & 2 | OBJ[q + k + 0x2000 + 8] >> j << 2 & 4 | OBJ[q + k + 0x2000 + 8] >> (j + 1) & 8;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 48] >> j & 1 | OBJ[q + k + 48] >> (j + 3) & 2 | OBJ[q + k + 0x2000 + 48] >> j << 2 & 4 | OBJ[q + k + 0x2000 + 48] >> (j + 1) & 8;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 16] >> j & 1 | OBJ[q + k + 16] >> (j + 3) & 2 | OBJ[q + k + 0x2000 + 16] >> j << 2 & 4 | OBJ[q + k + 0x2000 + 16] >> (j + 1) & 8;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 56] >> j & 1 | OBJ[q + k + 56] >> (j + 3) & 2 | OBJ[q + k + 0x2000 + 56] >> j << 2 & 4 | OBJ[q + k + 0x2000 + 56] >> (j + 1) & 8;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 24] >> j & 1 | OBJ[q + k + 24] >> (j + 3) & 2 | OBJ[q + k + 0x2000 + 24] >> j << 2 & 4 | OBJ[q + k + 0x2000 + 24] >> (j + 1) & 8;
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
		for (let k = 0x1780, i = 64; i !== 0; k += 2, --i) {
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
		let p = 256 * 8 * 4 + 232 + (this.dwScroll & 7);
		let k = this.dwScroll << 2 & 0x3e0;
		for (let i = 0; i < 29; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				this.xfer8x8(data, p, k, pri);
		p = 256 * 8 * 36 + 232;
		k = 0x0782;
		for (let i = 0; i < 14; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
		k = 0x0780;
		for (let i = 0; i < 2; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
		k = 0x0792;
		for (let i = 0; i < 12; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
		p = 256 * 8 * 37 + 232;
		k = 0x07a2;
		for (let i = 0; i < 14; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
		k = 0x07a0;
		for (let i = 0; i < 2; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
		k = 0x07b2;
		for (let i = 0; i < 12; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
		p = 256 * 8 * 2 + 232;
		k = 0x07c2;
		for (let i = 0; i < 14; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
		k = 0x07c0;
		for (let i = 0; i < 2; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
		k = 0x07d2;
		for (let i = 0; i < 12; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
		p = 256 * 8 * 3 + 232;
		k = 0x07e2;
		for (let i = 0; i < 14; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
		k = 0x07e0;
		for (let i = 0; i < 2; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
		k = 0x07f2;
		for (let i = 0; i < 12; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
	}

	xfer8x8(data, p, k, pri) {
		const q = this.ram[k] << 6, idx = this.ram[k + 0x800] << 2 & 0xfc;
		let px;

		if ((this.ram[k + 0x800] >> 6 & 1) !== pri)
			return;
		(px = this.bgcolor[idx | this.bg[q | 0x00]]) !== 0x1f && (data[p + 0x000] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x01]]) !== 0x1f && (data[p + 0x001] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x02]]) !== 0x1f && (data[p + 0x002] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x03]]) !== 0x1f && (data[p + 0x003] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x04]]) !== 0x1f && (data[p + 0x004] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x05]]) !== 0x1f && (data[p + 0x005] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x06]]) !== 0x1f && (data[p + 0x006] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x07]]) !== 0x1f && (data[p + 0x007] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x08]]) !== 0x1f && (data[p + 0x100] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x09]]) !== 0x1f && (data[p + 0x101] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x0a]]) !== 0x1f && (data[p + 0x102] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x0b]]) !== 0x1f && (data[p + 0x103] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x0c]]) !== 0x1f && (data[p + 0x104] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x0d]]) !== 0x1f && (data[p + 0x105] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x0e]]) !== 0x1f && (data[p + 0x106] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x0f]]) !== 0x1f && (data[p + 0x107] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x10]]) !== 0x1f && (data[p + 0x200] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x11]]) !== 0x1f && (data[p + 0x201] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x12]]) !== 0x1f && (data[p + 0x202] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x13]]) !== 0x1f && (data[p + 0x203] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x14]]) !== 0x1f && (data[p + 0x204] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x15]]) !== 0x1f && (data[p + 0x205] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x16]]) !== 0x1f && (data[p + 0x206] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x17]]) !== 0x1f && (data[p + 0x207] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x18]]) !== 0x1f && (data[p + 0x300] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x19]]) !== 0x1f && (data[p + 0x301] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x1a]]) !== 0x1f && (data[p + 0x302] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x1b]]) !== 0x1f && (data[p + 0x303] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x1c]]) !== 0x1f && (data[p + 0x304] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x1d]]) !== 0x1f && (data[p + 0x305] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x1e]]) !== 0x1f && (data[p + 0x306] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x1f]]) !== 0x1f && (data[p + 0x307] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x20]]) !== 0x1f && (data[p + 0x400] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x21]]) !== 0x1f && (data[p + 0x401] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x22]]) !== 0x1f && (data[p + 0x402] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x23]]) !== 0x1f && (data[p + 0x403] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x24]]) !== 0x1f && (data[p + 0x404] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x25]]) !== 0x1f && (data[p + 0x405] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x26]]) !== 0x1f && (data[p + 0x406] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x27]]) !== 0x1f && (data[p + 0x407] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x28]]) !== 0x1f && (data[p + 0x500] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x29]]) !== 0x1f && (data[p + 0x501] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x2a]]) !== 0x1f && (data[p + 0x502] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x2b]]) !== 0x1f && (data[p + 0x503] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x2c]]) !== 0x1f && (data[p + 0x504] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x2d]]) !== 0x1f && (data[p + 0x505] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x2e]]) !== 0x1f && (data[p + 0x506] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x2f]]) !== 0x1f && (data[p + 0x507] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x30]]) !== 0x1f && (data[p + 0x600] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x31]]) !== 0x1f && (data[p + 0x601] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x32]]) !== 0x1f && (data[p + 0x602] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x33]]) !== 0x1f && (data[p + 0x603] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x34]]) !== 0x1f && (data[p + 0x604] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x35]]) !== 0x1f && (data[p + 0x605] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x36]]) !== 0x1f && (data[p + 0x606] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x37]]) !== 0x1f && (data[p + 0x607] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x38]]) !== 0x1f && (data[p + 0x700] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x39]]) !== 0x1f && (data[p + 0x701] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x3a]]) !== 0x1f && (data[p + 0x702] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x3b]]) !== 0x1f && (data[p + 0x703] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x3c]]) !== 0x1f && (data[p + 0x704] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x3d]]) !== 0x1f && (data[p + 0x705] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x3e]]) !== 0x1f && (data[p + 0x706] = px);
		(px = this.bgcolor[idx | this.bg[q | 0x3f]]) !== 0x1f && (data[p + 0x707] = px);
	}

	xfer16x16(data, dst, src) {
		const idx = src >> 4 & 0x3f0;
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
		const idx = src >> 4 & 0x3f0;
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
		const idx = src >> 4 & 0x3f0;
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
		const idx = src >> 4 & 0x3f0;
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
 *	The Tower of Druaga
 *
 */

let SND, BG, OBJ, BGCOLOR, OBJCOLOR, RGB, PRG1, PRG2;

read('todruaga.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG1 = Uint8Array.concat(...['td2_3.1d', 'td2_1.1b'].map(e => zip.decompress(e))).addBase();
	PRG2 = zip.decompress('td1_4.1k').addBase();
	BG = zip.decompress('td1_5.3b');
	OBJ = Uint8Array.concat(...['td1_7.3n', 'td1_6.3m'].map(e => zip.decompress(e)));
	RGB = zip.decompress('td1-5.5b');
	BGCOLOR = zip.decompress('td1-6.4c');
	OBJCOLOR = zip.decompress('td1-7.5k');
	SND = zip.decompress('td1-3.3m');
	game = new TheTowerOfDruaga();
	sound = new MappySound({SND});
	canvas.addEventListener('click', () => game.coin());
	init({game, sound});
});

