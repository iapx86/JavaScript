/*
 *
 *	Toypop
 *
 */

import MappySound from './mappy_sound.js';
import {seq, rseq, convertGFX, Timer} from './utils.js';
import {init, expand} from './main.js';
import MC6809 from './mc6809.js';
import MC68000 from './mc68000.js';
let game, sound;

class Toypop {
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
	fCoin = 0;
	fStart1P = 0;
	fStart2P = 0;
	nPino = 3;
	nBonus = 'A';
	nRank = 'NORMAL';
	fAttract = true;
	fRound = false;

	fInterruptEnable = false;
	fInterruptEnable2 = false;
	ram = new Uint8Array(0x2000).addBase();
	ram2 = new Uint8Array(0x800).addBase();
	ram3 = new Uint8Array(0x40000).addBase();
	vram = new Uint8Array(0x10000).addBase();
	port = new Uint8Array(0x40);
	in = new Uint8Array(15);

	bg = new Uint8Array(0x8000).fill(3);
	obj = new Uint8Array(0x10000).fill(3);
	rgb = Int32Array.from(seq(0x100), i => 0xff000000 | BLUE[i] * 255 / 15 << 16 | GREEN[i] * 255 / 15 << 8 | RED[i] * 255 / 15);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;
	palette = 0;

	cpu = new MC6809(Math.floor(6144000 / 4));
	cpu2 = new MC6809(Math.floor(6144000 / 4));
	cpu3 = new MC68000(6144000);
	timer = new Timer(60);

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
		this.cpu.memorymap[0x60].read = (addr) => { return this.port[addr & 0x3f] | 0xf0; };
		this.cpu.memorymap[0x60].write = (addr, data) => { this.port[addr & 0x3f] = data & 0xf; };
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0x68 + i].read = (addr) => { return sound.read(addr); };
			this.cpu.memorymap[0x68 + i].write = (addr, data) => { sound.write(addr, data); };
		}
		this.cpu.memorymap[0x70].read = () => { return this.fInterruptEnable = true, 0; };
		this.cpu.memorymap[0x70].write = () => { this.fInterruptEnable = false; };
		for (let i = 0; i < 0x80; i++)
			this.cpu.memorymap[0x80 + i].base = PRG1.base[i];
		for (let i = 0; i < 0x10; i++)
			this.cpu.memorymap[0x80 + i].write = (addr) => { addr & 0x800 ? this.cpu3.disable() : this.cpu3.enable(); };
		for (let i = 0; i < 0x10; i++)
			this.cpu.memorymap[0x90 + i].write = (addr) => { addr & 0x800 ? this.cpu2.disable() : this.cpu2.enable(); };
		this.cpu.memorymap[0xa0].write = (addr) => { this.palette = addr << 7 & 0x80; };

		for (let i = 0; i < 4; i++) {
			this.cpu2.memorymap[i].read = (addr) => { return sound.read(addr); };
			this.cpu2.memorymap[i].write = (addr, data) => { sound.write(addr, data); };
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
			this.cpu3.memorymap[0x1000 + i].read = (addr) => { return this.ram2[addr >> 1 & 0x7ff]; };
			this.cpu3.memorymap[0x1000 + i].write = (addr, data) => { this.ram2[addr >> 1 & 0x7ff] = data; };
		}
		for (let i = 0; i < 0x80; i++) {
			this.cpu3.memorymap[0x1800 + i].read = (addr) => { return addr = addr << 1 & 0xfffe, this.vram[addr] << 4 | this.vram[addr | 1] & 0xf; };
			this.cpu3.memorymap[0x1800 + i].write = (addr, data) => { addr = addr << 1 & 0xfffe, this.vram[addr] = data >> 4, this.vram[addr | 1] = data & 0xf; };
		}
		for (let i = 0; i < 0x500; i++) {
			this.cpu3.memorymap[0x1900 + i].base = this.vram.base[i & 0xff];
			this.cpu3.memorymap[0x1900 + i].write = null;
		}
		for (let i = 0; i < 0x1000; i++)
			this.cpu3.memorymap[0x3000 + i].write16 = (addr) => { this.fInterruptEnable2 = !(addr & 0x80000); };

		// Videoの初期化
		convertGFX(this.bg, BG, 512, rseq(8, 0, 8), seq(4, 64).concat(seq(4)), [0, 4], 16);
		convertGFX(this.obj, OBJ, 256, rseq(8, 256, 8).concat(rseq(8, 0, 8)), seq(4).concat(seq(4, 64), seq(4, 128), seq(4, 192)), [0, 4], 64);
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.cpu2.execute(tick_rate);
			this.cpu3.execute(tick_rate);
			this.timer.execute(tick_rate, () => {
				update(), this.fInterruptEnable && this.cpu.interrupt(), this.cpu2.interrupt(), this.fInterruptEnable2 && this.cpu3.interrupt(6);
			});
			sound.execute(tick_rate);
			audio.execute(tick_rate);
		}
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
				this.in[8] = this.in[8] & ~3 | 1;
				break;
			case 2:
				this.in[8] = this.in[8] & ~3 | 2;
				break;
			case 3:
				this.in[8] &= ~3;
				break;
			case 5:
				this.in[8] |= 3;
				break;
			}
			switch (this.nBonus) {
			case 'A':
				this.in[7] &= ~8;
				break;
			case 'B':
				this.in[7] |= 8;
				break;
			}
			switch (this.nRank) {
			case 'EASY':
				this.in[7] = this.in[7] & ~6 | 2;
				break;
			case 'NORMAL':
				this.in[7] &= ~6;
				break;
			case 'HARD':
				this.in[7] = this.in[7] & ~6 | 4;
				break;
			case 'VERY HARD':
				this.in[7] |= 6;
				break;
			}
			if (this.fAttract)
				this.in[6] &= ~8;
			else
				this.in[6] |= 8;
			if (this.fRound)
				this.in[6] |= 2;
			else
				this.in[6] &= ~2;
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.in[5] |= 8;
		else
			this.in[5] &= ~8;

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
		this.in[0] = !!this.fCoin << 3, this.in[3] = this.in[3] & 3 | !!this.fStart1P << 2 | !!this.fStart2P << 3;
		this.fCoin -= !!this.fCoin, this.fStart1P -= !!this.fStart1P, this.fStart2P -= !!this.fStart2P;
		if (this.port[8] === 1)
			this.port.set(this.in.subarray(0, 4), 4);
		else if (this.port[8] === 5)
			this.port[2] = 0xf, this.port[6] = 0xc;
		if (this.port[0x18] === 1)
			this.port.set(this.in.subarray(5, 9), 0x10);
		else if (this.port[0x18] === 8)
			this.port[0x10] = 6, this.port[0x11] = 9;
		if (this.port[0x28] === 8)
			this.port[0x20] = 6, this.port[0x21] = 9;
		else if (this.port[0x28] === 9)
			this.port.set([this.in[10], this.in[14], this.in[11], this.in[11], this.in[12], this.in[12], this.in[13], this.in[13]], 0x20);
		return this;
	}

	coin(fDown) {
		fDown && (this.fCoin = 2);
	}

	start1P(fDown) {
		fDown && (this.fStart1P = 2);
	}

	start2P(fDown) {
		fDown && (this.fStart2P = 2);
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

	makeBitmap(flag) {
		if (!(this.updated = flag))
			return this.bitmap;

		// graphic描画
		let p = 256 * 8 * 2 + 239;
		let idx = 0x60 | this.palette;
		for (let k = 0x200, i = 0; i < 224; p -= 256 * 288 + 1, i++)
			for (let j = 0; j < 288; k++, p += 256, j++)
				this.bitmap[p] = idx | this.vram[k];

		// bg描画
		p = 256 * 8 * 4 + 232;
		for (let k = 0x40, i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				this.xfer8x8(this.bitmap, p, k);
		p = 256 * 8 * 36 + 232;
		for (let k = 2, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(this.bitmap, p, k);
		p = 256 * 8 * 37 + 232;
		for (let k = 0x22, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(this.bitmap, p, k);
		p = 256 * 8 * 2 + 232;
		for (let k = 0x3c2, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(this.bitmap, p, k);
		p = 256 * 8 * 3 + 232;
		for (let k = 0x3e2, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(this.bitmap, p, k);

		// obj描画
		for (let k = 0xf80, i = 64; i !== 0; k += 2, --i) {
			const x = 0xe9 - this.ram[k + 0x800] & 0xff;
			const y = 0x167 - (this.ram[k + 0x801] | this.ram[k + 0x1001] << 8) & 0x1ff;
			const src = this.ram[k] | this.ram[k + 1] << 8;
			switch (this.ram[k + 0x1000] & 0x0f) {
			case 0x00: // ノーマル
				this.xfer16x16(this.bitmap, x | y << 8, src);
				break;
			case 0x01: // V反転
				this.xfer16x16V(this.bitmap, x | y << 8, src);
				break;
			case 0x02: // H反転
				this.xfer16x16H(this.bitmap, x | y << 8, src);
				break;
			case 0x03: // HV反転
				this.xfer16x16HV(this.bitmap, x | y << 8, src);
				break;
			case 0x04: // ノーマル
				this.xfer16x16(this.bitmap, x | y << 8, src | 1);
				this.xfer16x16(this.bitmap, x | (y - 16 & 0x1ff) << 8, src & ~1);
				break;
			case 0x05: // V反転
				this.xfer16x16V(this.bitmap, x | y << 8, src & ~1);
				this.xfer16x16V(this.bitmap, x | (y - 16 & 0x1ff) << 8, src | 1);
				break;
			case 0x06: // H反転
				this.xfer16x16H(this.bitmap, x | y << 8, src | 1);
				this.xfer16x16H(this.bitmap, x | (y - 16 & 0x1ff) << 8, src & ~1);
				break;
			case 0x07: // HV反転
				this.xfer16x16HV(this.bitmap, x | y << 8, src & ~1);
				this.xfer16x16HV(this.bitmap, x | (y - 16 & 0x1ff) << 8, src | 1);
				break;
			case 0x08: // ノーマル
				this.xfer16x16(this.bitmap, x | y << 8, src & ~2);
				this.xfer16x16(this.bitmap, x - 16 & 0xff | y << 8, src | 2);
				break;
			case 0x09: // V反転
				this.xfer16x16V(this.bitmap, x | y << 8, src & ~2);
				this.xfer16x16V(this.bitmap, x - 16 & 0xff | y << 8, src | 2);
				break;
			case 0x0a: // H反転
				this.xfer16x16H(this.bitmap, x | y << 8, src | 2);
				this.xfer16x16H(this.bitmap, x - 16 & 0xff | y << 8, src & ~2);
				break;
			case 0x0b: // HV反転
				this.xfer16x16HV(this.bitmap, x | y << 8, src | 2);
				this.xfer16x16HV(this.bitmap, x - 16 & 0xff | y << 8, src & ~2);
				break;
			case 0x0c: // ノーマル
				this.xfer16x16(this.bitmap, x | y << 8, src & ~3 | 1);
				this.xfer16x16(this.bitmap, x | (y - 16 & 0x1ff) << 8, src & ~3);
				this.xfer16x16(this.bitmap, x - 16 & 0xff | y << 8, src | 3);
				this.xfer16x16(this.bitmap, x - 16 & 0xff | (y - 16 & 0x1ff) << 8, src & ~3 | 2);
				break;
			case 0x0d: // V反転
				this.xfer16x16V(this.bitmap, x | y << 8, src & ~3);
				this.xfer16x16V(this.bitmap, x | (y - 16 & 0x1ff) << 8, src & ~3 | 1);
				this.xfer16x16V(this.bitmap, x - 16 & 0xff | y << 8, src & ~3 | 2);
				this.xfer16x16V(this.bitmap, x - 16 & 0xff | (y - 16 & 0x1ff) << 8, src | 3);
				break;
			case 0x0e: // H反転
				this.xfer16x16H(this.bitmap, x | y << 8, src | 3);
				this.xfer16x16H(this.bitmap, x | (y - 16 & 0x1ff) << 8, src & ~3 | 2);
				this.xfer16x16H(this.bitmap, x - 16 & 0xff | y << 8, src & ~3 | 1);
				this.xfer16x16H(this.bitmap, x - 16 & 0xff | (y - 16 & 0x1ff) << 8, src & ~3);
				break;
			case 0x0f: // HV反転
				this.xfer16x16HV(this.bitmap, x | y << 8, src & ~3 | 2);
				this.xfer16x16HV(this.bitmap, x | (y - 16 & 0x1ff) << 8, src | 3);
				this.xfer16x16HV(this.bitmap, x - 16 & 0xff | y << 8, src & ~3);
				this.xfer16x16HV(this.bitmap, x - 16 & 0xff | (y - 16 & 0x1ff) << 8, src & ~3 | 1);
				break;
			}
		}

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				this.bitmap[p] = this.rgb[this.bitmap[p]];

		return this.bitmap;
	}

	xfer8x8(data, p, k) {
		const q = this.ram[k] << 6, idx = this.ram[k + 0x400] << 2 & 0xfc, idx2 = 0x70 | this.palette;
		let px;

		(px = BGCOLOR[idx | this.bg[q | 0x00]]) !== 0xf && (data[p + 0x000] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x01]]) !== 0xf && (data[p + 0x001] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x02]]) !== 0xf && (data[p + 0x002] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x03]]) !== 0xf && (data[p + 0x003] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x04]]) !== 0xf && (data[p + 0x004] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x05]]) !== 0xf && (data[p + 0x005] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x06]]) !== 0xf && (data[p + 0x006] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x07]]) !== 0xf && (data[p + 0x007] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x08]]) !== 0xf && (data[p + 0x100] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x09]]) !== 0xf && (data[p + 0x101] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x0a]]) !== 0xf && (data[p + 0x102] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x0b]]) !== 0xf && (data[p + 0x103] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x0c]]) !== 0xf && (data[p + 0x104] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x0d]]) !== 0xf && (data[p + 0x105] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x0e]]) !== 0xf && (data[p + 0x106] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x0f]]) !== 0xf && (data[p + 0x107] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x10]]) !== 0xf && (data[p + 0x200] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x11]]) !== 0xf && (data[p + 0x201] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x12]]) !== 0xf && (data[p + 0x202] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x13]]) !== 0xf && (data[p + 0x203] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x14]]) !== 0xf && (data[p + 0x204] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x15]]) !== 0xf && (data[p + 0x205] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x16]]) !== 0xf && (data[p + 0x206] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x17]]) !== 0xf && (data[p + 0x207] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x18]]) !== 0xf && (data[p + 0x300] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x19]]) !== 0xf && (data[p + 0x301] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x1a]]) !== 0xf && (data[p + 0x302] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x1b]]) !== 0xf && (data[p + 0x303] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x1c]]) !== 0xf && (data[p + 0x304] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x1d]]) !== 0xf && (data[p + 0x305] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x1e]]) !== 0xf && (data[p + 0x306] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x1f]]) !== 0xf && (data[p + 0x307] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x20]]) !== 0xf && (data[p + 0x400] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x21]]) !== 0xf && (data[p + 0x401] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x22]]) !== 0xf && (data[p + 0x402] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x23]]) !== 0xf && (data[p + 0x403] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x24]]) !== 0xf && (data[p + 0x404] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x25]]) !== 0xf && (data[p + 0x405] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x26]]) !== 0xf && (data[p + 0x406] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x27]]) !== 0xf && (data[p + 0x407] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x28]]) !== 0xf && (data[p + 0x500] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x29]]) !== 0xf && (data[p + 0x501] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x2a]]) !== 0xf && (data[p + 0x502] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x2b]]) !== 0xf && (data[p + 0x503] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x2c]]) !== 0xf && (data[p + 0x504] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x2d]]) !== 0xf && (data[p + 0x505] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x2e]]) !== 0xf && (data[p + 0x506] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x2f]]) !== 0xf && (data[p + 0x507] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x30]]) !== 0xf && (data[p + 0x600] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x31]]) !== 0xf && (data[p + 0x601] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x32]]) !== 0xf && (data[p + 0x602] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x33]]) !== 0xf && (data[p + 0x603] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x34]]) !== 0xf && (data[p + 0x604] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x35]]) !== 0xf && (data[p + 0x605] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x36]]) !== 0xf && (data[p + 0x606] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x37]]) !== 0xf && (data[p + 0x607] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x38]]) !== 0xf && (data[p + 0x700] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x39]]) !== 0xf && (data[p + 0x701] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x3a]]) !== 0xf && (data[p + 0x702] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x3b]]) !== 0xf && (data[p + 0x703] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x3c]]) !== 0xf && (data[p + 0x704] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x3d]]) !== 0xf && (data[p + 0x705] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x3e]]) !== 0xf && (data[p + 0x706] = idx2 | px);
		(px = BGCOLOR[idx | this.bg[q | 0x3f]]) !== 0xf && (data[p + 0x707] = idx2 | px);
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
 *	Toypop
 *
 */

import {ROM} from "./dist/toypop.png.js";
let PRG1, PRG2, PRG3, BG, OBJ, RED, GREEN, BLUE, BGCOLOR, OBJCOLOR, SND;

window.addEventListener('load', () => expand(ROM).then(ROM => {
	PRG1 = new Uint8Array(ROM.buffer, 0x0, 0x8000).addBase();
	PRG2 = new Uint8Array(ROM.buffer, 0x8000, 0x2000).addBase();
	PRG3 = new Uint8Array(ROM.buffer, 0xa000, 0x8000).addBase();
	BG = new Uint8Array(ROM.buffer, 0x12000, 0x2000);
	OBJ = new Uint8Array(ROM.buffer, 0x14000, 0x4000);
	RED = new Uint8Array(ROM.buffer, 0x18000, 0x100);
	GREEN = new Uint8Array(ROM.buffer, 0x18100, 0x100);
	BLUE = new Uint8Array(ROM.buffer, 0x18200, 0x100);
	BGCOLOR = new Uint8Array(ROM.buffer, 0x18300, 0x100);
	OBJCOLOR = new Uint8Array(ROM.buffer, 0x18400, 0x200);
	SND = new Uint8Array(ROM.buffer, 0x18600, 0x100);
	game = new Toypop();
	sound = new MappySound({SND});
	canvas.addEventListener('click', () => game.coin(true));
	init({game, sound});
}));

