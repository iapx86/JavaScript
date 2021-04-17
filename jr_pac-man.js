/*
 *
 *	Jr. Pac-Man
 *
 */

import PacManSound from './pac-man_sound.js';
import {seq, rseq, convertGFX, Timer} from './utils.js';
import {init, read} from './main.js';
import Z80 from './z80.js';
let game, sound;

class JrPacMan {
	static patched = false;

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
	nBonus = 10000;
	nRank = 'NORMAL';

	fInterruptEnable = false;
	ram = new Uint8Array(0x1100).fill(0xff).fill(1, 0x1070, 0x1078).addBase();
	in = Uint8Array.of(0xff, 0xff, 0xc9, 0x00);
	intvec = 0;

	dwScroll = 0;
	bg = new Uint8Array(0x8000).fill(3);
	obj = new Uint8Array(0x8000).fill(3);
	rgb = Int32Array.from(seq(0x20).map(i => RGB_H[i] << 4 | RGB_L[i]), e => 0xff000000 | (e >> 6) * 255 / 3 << 16 | (e >> 3 & 7) * 255 / 7 << 8 | (e & 7) * 255 / 7);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;

	cpu = new Z80(Math.floor(18432000 / 6));
	timer = new Timer(60);

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x40; i++)
			this.cpu.memorymap[i].base = PRG.base[i];
		for (let i = 0; i < 0x10; i++) {
			this.cpu.memorymap[0x40 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x40 + i].write = null;
		}
		this.cpu.memorymap[0x50].read = (addr) => { return this.in[addr >> 6 & 3]; };
		this.cpu.memorymap[0x50].write = (addr, data) => {
			switch (addr >> 4 & 0xf) {
			case 0:
				switch (addr & 7) {
				case 0:
					return void(this.fInterruptEnable = (data & 1) !== 0);
				case 1:
					return sound.control(data & 1);
				}
				return;
			case 4:
			case 5:
				return sound.write(addr, data);
			case 6:
				return void(this.ram[0x1060 | addr & 0xf] = data);
			case 7:
				return void(this.ram[0x1070 | addr & 7] = data & 1);
			case 8:
				return void(this.dwScroll = data);
			}
		};
		for (let i = 0; i < 0x60; i++)
			this.cpu.memorymap[0x80 + i].base = PRG.base[0x40 + i];
		for (let i = 0; i < 0x100; i++)
			this.cpu.iomap[i].write = (addr, data) => { !(addr & 0xff) && (this.intvec = data); };

		JrPacMan.patchROM();

		// Videoの初期化
		convertGFX(this.bg, BG, 512, rseq(8, 0, 8), seq(4, 64).concat(seq(4)), [0, 4], 16);
		convertGFX(this.obj, OBJ, 128, rseq(8, 256, 8).concat(rseq(8, 0, 8)), seq(4, 64).concat(seq(4, 128), seq(4, 192), seq(4)), [0, 4], 64);
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.timer.execute(tick_rate, () => { update(), this.fInterruptEnable && this.cpu.interrupt(this.intvec); });
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
			switch (this.nPacman) {
			case 1:
				this.in[2] &= ~0xc;
				break;
			case 2:
				this.in[2] = this.in[2] & ~0xc | 4;
				break;
			case 3:
				this.in[2] = this.in[2] & ~0xc | 8;
				break;
			case 5:
				this.in[2] |= 0xc;
				break;
			}
			switch (this.nBonus) {
			case 10000:
				this.in[2] &= ~0x30;
				break;
			case 15000:
				this.in[2] = this.in[2] & ~0x30 | 0x10;
				break;
			case 20000:
				this.in[2] = this.in[2] & ~0x30 | 0x20;
				break;
			case 30000:
				this.in[2] |= 0x30;
				break;
			}
			switch (this.nRank) {
			case 'HARD':
				this.in[2] &= ~0x40;
				break;
			case 'NORMAL':
				this.in[2] |= 0x40;
				break;
			}
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.in[1] &= ~0x10;
		else
			this.in[1] |= 0x10;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu.reset();
		}
		return this;
	}

	updateInput() {
		this.in[0] = this.in[0] & ~(1 << 5) | !this.fCoin << 5;
		this.in[1] = this.in[1] & ~0x60 | !this.fStart1P << 5 | !this.fStart2P << 6;
		this.fCoin -= !!this.fCoin, this.fStart1P -= !!this.fStart1P, this.fStart2P -= !!this.fStart2P;
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
		this.in[0] = this.in[0] & ~(1 << 0) | fDown << 3 | !fDown << 0;
		this.in[1] = this.in[1] & ~(1 << 0) | fDown << 3 | !fDown << 0;
	}

	right(fDown) {
		this.in[0] = this.in[0] & ~(1 << 2) | fDown << 1 | !fDown << 2;
		this.in[1] = this.in[1] & ~(1 << 2) | fDown << 1 | !fDown << 2;
	}

	down(fDown) {
		this.in[0] = this.in[0] & ~(1 << 3) | fDown << 0 | !fDown << 3;
		this.in[1] = this.in[1] & ~(1 << 3) | fDown << 0 | !fDown << 3;
	}

	left(fDown) {
		this.in[0] = this.in[0] & ~(1 << 1) | fDown << 2 | !fDown << 1;
		this.in[1] = this.in[1] & ~(1 << 1) | fDown << 2 | !fDown << 1;
	}

	static patchROM() {
		const table = [
			[0x00C1, 0x00], [0x0002, 0x80], [0x0004, 0x00], [0x0006, 0x80],
			[0x0003, 0x00], [0x0002, 0x80], [0x0009, 0x00], [0x0004, 0x80],
			[0x5968, 0x00], [0x0001, 0x80], [0x0002, 0x00], [0x0001, 0x80],
			[0x0009, 0x00], [0x0002, 0x80], [0x0009, 0x00], [0x0001, 0x80],
			[0x00AF, 0x00], [0x000E, 0x04], [0x0002, 0x00], [0x0004, 0x04],
			[0x001E, 0x00], [0x0001, 0x80], [0x0002, 0x00], [0x0001, 0x80],
			[0x0002, 0x00], [0x0002, 0x80], [0x0009, 0x00], [0x0002, 0x80],
			[0x0009, 0x00], [0x0002, 0x80], [0x0083, 0x00], [0x0001, 0x04],
			[0x0001, 0x01], [0x0001, 0x00], [0x0002, 0x05], [0x0001, 0x00],
			[0x0003, 0x04], [0x0003, 0x01], [0x0002, 0x00], [0x0001, 0x04],
			[0x0003, 0x01], [0x0003, 0x00], [0x0003, 0x04], [0x0001, 0x01],
			[0x002E, 0x00], [0x0078, 0x01], [0x0001, 0x04], [0x0001, 0x05],
			[0x0001, 0x00], [0x0001, 0x01], [0x0001, 0x04], [0x0002, 0x00],
			[0x0001, 0x01], [0x0001, 0x04], [0x0002, 0x00], [0x0001, 0x01],
			[0x0001, 0x04], [0x0002, 0x00], [0x0001, 0x01], [0x0001, 0x04],
			[0x0001, 0x05], [0x0001, 0x00], [0x0001, 0x01], [0x0001, 0x04],
			[0x0002, 0x00], [0x0001, 0x01], [0x0001, 0x04], [0x0002, 0x00],
			[0x0001, 0x01], [0x0001, 0x04], [0x0001, 0x05], [0x0001, 0x00],
			[0x01B0, 0x01], [0x0001, 0x00], [0x0002, 0x01], [0x00AD, 0x00],
			[0x0031, 0x01], [0x005C, 0x00], [0x0005, 0x01], [0x204E, 0x00]
		];
		if (JrPacMan.patched)
			return;
		for (let addr = 0, i = 0, n = table.length; i < n; i++)
			for (let j = 0; j < table[i][0]; j++)
				PRG[addr++] ^= table[i][1];
		JrPacMan.patched = true;
	}

	makeBitmap(flag) {
		if (!(this.updated = flag))
			return this.bitmap;

		// 画面クリア
		let p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256, i++)
			this.bitmap.fill(0, p, p + 224);

		// bg描画
		if (!this.ram[0x1073])
			this.drawBG(this.bitmap);

		// obj描画
		for (let k = 0x0ffe, i = 7; i !== 0; k -= 2, --i) {
			const x = (~this.ram[k + 0x70] - (i < 3)) & 0xff;
			const y = (-this.ram[k + 0x71] & 0xff) + 32;
			const src = this.ram[k] | this.ram[k + 1] << 8;
			switch (this.ram[k] & 3) {
			case 0: // ノーマル
				this.xfer16x16(this.bitmap, x | y << 8, src);
				break;
			case 1: // V反転
				this.xfer16x16V(this.bitmap, x | y << 8, src);
				break;
			case 2: // H反転
				this.xfer16x16H(this.bitmap, x | y << 8, src);
				break;
			case 3: // HV反転
				this.xfer16x16HV(this.bitmap, x | y << 8, src);
				break;
			}
		}

		// bg描画
		if (this.ram[0x1073] !== 0)
			this.drawBG(this.bitmap);

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				this.bitmap[p] = this.rgb[this.bitmap[p] | this.ram[0x1071] << 4];

		return this.bitmap;
	}

	drawBG(data) {
		let p = 256 * 8 * 4 + 232 + (this.dwScroll & 7);
		for (let k = 0x40 + (this.dwScroll << 2 & 0x3e0), i = 0; i < 29; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				this.xfer8x8(data, p, j, k);
		p = 256 * 8 * 36 + 232;
		for (let k = 0x702, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k + 0x80, k);
		p = 256 * 8 * 37 + 232;
		for (let k = 0x722, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k + 0x80, k);
		p = 256 * 8 * 2 + 232;
		for (let k = 0x742, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k + 0x80, k);
		p = 256 * 8 * 3 + 232;
		for (let k = 0x762, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k + 0x80, k);
	}

	xfer8x8(data, p, j, k) {
		const q = this.ram[k] << 6 | this.ram[0x1074] << 14, idx = this.ram[j] << 2 & 0x7c | this.ram[0x1070] << 7;
		let px;

		(px = COLOR[idx | this.bg[q | 0x00]]) && (data[p + 0x000] = px);
		(px = COLOR[idx | this.bg[q | 0x01]]) && (data[p + 0x001] = px);
		(px = COLOR[idx | this.bg[q | 0x02]]) && (data[p + 0x002] = px);
		(px = COLOR[idx | this.bg[q | 0x03]]) && (data[p + 0x003] = px);
		(px = COLOR[idx | this.bg[q | 0x04]]) && (data[p + 0x004] = px);
		(px = COLOR[idx | this.bg[q | 0x05]]) && (data[p + 0x005] = px);
		(px = COLOR[idx | this.bg[q | 0x06]]) && (data[p + 0x006] = px);
		(px = COLOR[idx | this.bg[q | 0x07]]) && (data[p + 0x007] = px);
		(px = COLOR[idx | this.bg[q | 0x08]]) && (data[p + 0x100] = px);
		(px = COLOR[idx | this.bg[q | 0x09]]) && (data[p + 0x101] = px);
		(px = COLOR[idx | this.bg[q | 0x0a]]) && (data[p + 0x102] = px);
		(px = COLOR[idx | this.bg[q | 0x0b]]) && (data[p + 0x103] = px);
		(px = COLOR[idx | this.bg[q | 0x0c]]) && (data[p + 0x104] = px);
		(px = COLOR[idx | this.bg[q | 0x0d]]) && (data[p + 0x105] = px);
		(px = COLOR[idx | this.bg[q | 0x0e]]) && (data[p + 0x106] = px);
		(px = COLOR[idx | this.bg[q | 0x0f]]) && (data[p + 0x107] = px);
		(px = COLOR[idx | this.bg[q | 0x10]]) && (data[p + 0x200] = px);
		(px = COLOR[idx | this.bg[q | 0x11]]) && (data[p + 0x201] = px);
		(px = COLOR[idx | this.bg[q | 0x12]]) && (data[p + 0x202] = px);
		(px = COLOR[idx | this.bg[q | 0x13]]) && (data[p + 0x203] = px);
		(px = COLOR[idx | this.bg[q | 0x14]]) && (data[p + 0x204] = px);
		(px = COLOR[idx | this.bg[q | 0x15]]) && (data[p + 0x205] = px);
		(px = COLOR[idx | this.bg[q | 0x16]]) && (data[p + 0x206] = px);
		(px = COLOR[idx | this.bg[q | 0x17]]) && (data[p + 0x207] = px);
		(px = COLOR[idx | this.bg[q | 0x18]]) && (data[p + 0x300] = px);
		(px = COLOR[idx | this.bg[q | 0x19]]) && (data[p + 0x301] = px);
		(px = COLOR[idx | this.bg[q | 0x1a]]) && (data[p + 0x302] = px);
		(px = COLOR[idx | this.bg[q | 0x1b]]) && (data[p + 0x303] = px);
		(px = COLOR[idx | this.bg[q | 0x1c]]) && (data[p + 0x304] = px);
		(px = COLOR[idx | this.bg[q | 0x1d]]) && (data[p + 0x305] = px);
		(px = COLOR[idx | this.bg[q | 0x1e]]) && (data[p + 0x306] = px);
		(px = COLOR[idx | this.bg[q | 0x1f]]) && (data[p + 0x307] = px);
		(px = COLOR[idx | this.bg[q | 0x20]]) && (data[p + 0x400] = px);
		(px = COLOR[idx | this.bg[q | 0x21]]) && (data[p + 0x401] = px);
		(px = COLOR[idx | this.bg[q | 0x22]]) && (data[p + 0x402] = px);
		(px = COLOR[idx | this.bg[q | 0x23]]) && (data[p + 0x403] = px);
		(px = COLOR[idx | this.bg[q | 0x24]]) && (data[p + 0x404] = px);
		(px = COLOR[idx | this.bg[q | 0x25]]) && (data[p + 0x405] = px);
		(px = COLOR[idx | this.bg[q | 0x26]]) && (data[p + 0x406] = px);
		(px = COLOR[idx | this.bg[q | 0x27]]) && (data[p + 0x407] = px);
		(px = COLOR[idx | this.bg[q | 0x28]]) && (data[p + 0x500] = px);
		(px = COLOR[idx | this.bg[q | 0x29]]) && (data[p + 0x501] = px);
		(px = COLOR[idx | this.bg[q | 0x2a]]) && (data[p + 0x502] = px);
		(px = COLOR[idx | this.bg[q | 0x2b]]) && (data[p + 0x503] = px);
		(px = COLOR[idx | this.bg[q | 0x2c]]) && (data[p + 0x504] = px);
		(px = COLOR[idx | this.bg[q | 0x2d]]) && (data[p + 0x505] = px);
		(px = COLOR[idx | this.bg[q | 0x2e]]) && (data[p + 0x506] = px);
		(px = COLOR[idx | this.bg[q | 0x2f]]) && (data[p + 0x507] = px);
		(px = COLOR[idx | this.bg[q | 0x30]]) && (data[p + 0x600] = px);
		(px = COLOR[idx | this.bg[q | 0x31]]) && (data[p + 0x601] = px);
		(px = COLOR[idx | this.bg[q | 0x32]]) && (data[p + 0x602] = px);
		(px = COLOR[idx | this.bg[q | 0x33]]) && (data[p + 0x603] = px);
		(px = COLOR[idx | this.bg[q | 0x34]]) && (data[p + 0x604] = px);
		(px = COLOR[idx | this.bg[q | 0x35]]) && (data[p + 0x605] = px);
		(px = COLOR[idx | this.bg[q | 0x36]]) && (data[p + 0x606] = px);
		(px = COLOR[idx | this.bg[q | 0x37]]) && (data[p + 0x607] = px);
		(px = COLOR[idx | this.bg[q | 0x38]]) && (data[p + 0x700] = px);
		(px = COLOR[idx | this.bg[q | 0x39]]) && (data[p + 0x701] = px);
		(px = COLOR[idx | this.bg[q | 0x3a]]) && (data[p + 0x702] = px);
		(px = COLOR[idx | this.bg[q | 0x3b]]) && (data[p + 0x703] = px);
		(px = COLOR[idx | this.bg[q | 0x3c]]) && (data[p + 0x704] = px);
		(px = COLOR[idx | this.bg[q | 0x3d]]) && (data[p + 0x705] = px);
		(px = COLOR[idx | this.bg[q | 0x3e]]) && (data[p + 0x706] = px);
		(px = COLOR[idx | this.bg[q | 0x3f]]) && (data[p + 0x707] = px);
	}

	xfer16x16(data, dst, src) {
		const idx = src >> 6 & 0x7c | this.ram[0x1070] << 7, h = 288 - (dst >> 8);
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (h >= 16) {
			src = src << 6 & 0x3f00 | this.ram[0x1075] << 14;
			for (let i = 16; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[src++]]))
						data[dst] = px;
		} else {
			src = src << 6 & 0x3f00 | this.ram[0x1075] << 14;
			for (let i = h; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[src++]]))
						data[dst] = px;
			dst -= 0x10000;
			for (let i = 16 - h; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[src++]]))
						data[dst] = px;
		}
	}

	xfer16x16V(data, dst, src) {
		const idx = src >> 6 & 0x7c | this.ram[0x1070] << 7, h = 288 - (dst >> 8);
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (h >= 16) {
			src = (src << 6 & 0x3f00 | this.ram[0x1075] << 14) + 256 - 16;
			for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[src++]]))
						data[dst] = px;
		} else {
			src = (src << 6 & 0x3f00 | this.ram[0x1075] << 14) + 256 - 16;
			for (let i = h; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[src++]]))
						data[dst] = px;
			dst -= 0x10000;
			for (let i = 16 - h; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[src++]]))
						data[dst] = px;
		}
	}

	xfer16x16H(data, dst, src) {
		const idx = src >> 6 & 0x7c | this.ram[0x1070] << 7, h = 288 - (dst >> 8);
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (h >= 16) {
			src = (src << 6 & 0x3f00 | this.ram[0x1075] << 14) + 16;
			for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[--src]]))
						data[dst] = px;
		} else {
			src = (src << 6 & 0x3f00 | this.ram[0x1075] << 14) + 16;
			for (let i = h; i !== 0; dst += 256 - 16, src += 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[--src]]))
						data[dst] = px;
			dst -= 0x10000;
			for (let i = 16 - h; i !== 0; dst += 256 - 16, src += 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[--src]]))
						data[dst] = px;
		}
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >> 6 & 0x7c | this.ram[0x1070] << 7, h = 288 - (dst >> 8);
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (h >= 16) {
			src = (src << 6 & 0x3f00 | this.ram[0x1075] << 14) + 256;
			for (let i = 16; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[--src]]))
						data[dst] = px;
		} else {
			src = (src << 6 & 0x3f00 | this.ram[0x1075] << 14) + 256;
			for (let i = h; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[--src]]))
						data[dst] = px;
			dst -= 0x10000;
			for (let i = 16 - h; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[--src]]))
						data[dst] = px;
		}
	}
}

/*
 *
 *	Jr. Pac-Man
 *
 */

let PRG, BG, OBJ, RGB_L, RGB_H, COLOR, SND;

read('jrpacman.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG = Uint8Array.concat(...['jrp8d.8d', 'jrp8e.8e', 'jrp8h.8h', 'jrp8j.8j', 'jrp8k.8k'].map(e => zip.decompress(e))).addBase();
	BG = zip.decompress('jrp2c.2c');
	OBJ = zip.decompress('jrp2e.2e');
	RGB_L = zip.decompress('a290-27axv-bxhd.9e');
	RGB_H = zip.decompress('a290-27axv-cxhd.9f');
	COLOR = zip.decompress('a290-27axv-axhd.9p');
	SND = zip.decompress('a290-27axv-dxhd.7p');
	game = new JrPacMan();
	sound = new PacManSound({SND});
	canvas.addEventListener('click', () => game.coin(true));
	init({game, sound});
});

