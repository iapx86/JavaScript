/*
 *
 *	Strategy X
 *
 */

import AY_3_8910 from './ay-3-8910.js';
import {init, loop} from './main.js';
import Z80 from './z80.js';
let game, sound;

class StrategyX {
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

		// CPU周りの初期化
		this.fInterruptEnable = false;
		this.fSoundEnable = false;

		this.ram = new Uint8Array(0xd00).addBase();
		this.ppi0 = Uint8Array.of(0xff, 0xfc, 0xf1, 0);
		this.ppi1 = Uint8Array.of(0, 0, 0xfc, 0);
		this.ram2 = new Uint8Array(0x400).addBase();
		this.psg = [{addr: 0}, {addr: 0}];
		this.count = 0;
		this.timer = 0;
		this.command = [];

		this.cpu = new Z80(this);
		for (let i = 0; i < 0x60; i++)
			this.cpu.memorymap[i].base = PRG1.base[i];
		for (let i = 0; i < 8; i++) {
			this.cpu.memorymap[0x80 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x80 + i].write = null;
		}
		this.cpu.memorymap[0x88].base = this.ram.base[0xc];
		this.cpu.memorymap[0x88].write = null;
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0x94 + i].base = this.cpu.memorymap[0x90 + i].base = this.ram.base[8 + i];
			this.cpu.memorymap[0x94 + i].write = this.cpu.memorymap[0x90 + i].write = null;
		}
		this.cpu.memorymap[0xa0].read = addr => this.ppi0[addr >>> 2 & 3];
		this.cpu.memorymap[0xa8].read = addr => this.ppi1[addr >>> 2 & 3];
		this.cpu.memorymap[0xa8].write = (addr, data) => {
			switch (addr >>> 2 & 3) {
			case 0:
				this.command.push(data);
				break;
			case 1:
				this.fSoundEnable = (data & 0x10) === 0;
				break;
			}
		};
		this.cpu.memorymap[0xb0].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				this.fBackgroundGreen = (data & 1) !== 0;
				break;
			case 2:
				this.fBackgroundBlue = (data & 1) !== 0;
				break;
			case 4:
				this.fInterruptEnable = (data & 1) !== 0;
				break;
			case 0xa:
				this.fBackgroundRed = (data & 1) !== 0;
				break;
			}
		};

		this.cpu2 = new Z80(this);
		for (let i = 0; i < 0x20; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 4; i++) {
			this.cpu2.memorymap[0x8c + i].base = this.cpu2.memorymap[0x88 + i].base = this.cpu2.memorymap[0x84 + i].base = this.cpu2.memorymap[0x80 + i].base = this.ram2.base[i];
			this.cpu2.memorymap[0x8c + i].write = this.cpu2.memorymap[0x88 + i].write = this.cpu2.memorymap[0x84 + i].write = this.cpu2.memorymap[0x80 + i].write = null;
		}
		for (let i = 0; i < 0x100; i++) {
			this.cpu2.iomap[i].read = addr => {
				let data = 0xff;
				if ((addr & 0x20) !== 0)
					data &= sound[1].read(this.psg[1].addr);
				if ((addr & 0x80) !== 0)
					data &= sound[0].read(this.psg[0].addr);
				return data;
			};
			this.cpu2.iomap[i].write = (addr, data) => {
				if ((addr & 0x10) !== 0)
					this.psg[1].addr = data;
				else if ((addr & 0x20) !== 0)
					sound[1].write(this.psg[1].addr, data, this.count);
				if ((addr & 0x40) !== 0)
					this.psg[0].addr = data;
				else if ((addr & 0x80) !== 0)
					sound[0].write(this.psg[0].addr, data, this.count);
			};
		}

		// Videoの初期化
		this.fBackgroundGreen = false;
		this.fBackgroundBlue = false;
		this.fBackgroundRed = false;
		this.bg = new Uint32Array(0x20000);
		this.obj = new Uint8Array(0x4000);
		this.rgb = new Uint32Array(0x20);
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();
	}

	execute() {
		sound[0].mute(!this.fSoundEnable);
		sound[1].mute(!this.fSoundEnable);
		if (this.fInterruptEnable)
			this.cpu.non_maskable_interrupt();
		this.cpu.execute(0x2000);
		for (this.count = 0; this.count < 116; this.count++) { // 14318181 / 60 / 2048
			if (this.command.length && this.cpu2.interrupt())
				sound[0].write(0x0e, this.command.shift());
			sound[0].write(0x0f, [0x0e, 0x1e, 0x0e, 0x1e, 0x2e, 0x3e, 0x2e, 0x3e, 0x4e, 0x5e, 0x8e, 0x9e, 0x8e, 0x9e, 0xae, 0xbe, 0xae, 0xbe, 0xce, 0xde][this.timer]);
			this.cpu2.execute(36);
			if (++this.timer >= 20)
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
				this.ppi0[1] &= ~3;
				break;
			case 4:
				this.ppi0[1] = this.ppi0[1] & ~3 | 1;
				break;
			case 5:
				this.ppi0[1] = this.ppi0[1] & ~3 | 2;
				break;
			case 255:
				this.ppi0[1] |= 3;
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
			this.fSoundEnable = false;
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
			this.ppi0[0] &= ~(1 << 7);
		}
		else
			this.ppi0[0] |= 1 << 7;
		if (this.fStart1P) {
			--this.fStart1P;
			this.ppi0[1] &= ~(1 << 7);
		}
		else
			this.ppi0[1] |= 1 << 7;
		if (this.fStart2P) {
			--this.fStart2P;
			this.ppi0[1] &= ~(1 << 6);
		}
		else
			this.ppi0[1] |= 1 << 6;
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
			this.ppi0[2] = this.ppi0[2] & ~(1 << 4) | 1 << 6;
		else
			this.ppi0[2] |= 1 << 4;
	}

	right(fDown) {
		if (fDown)
			this.ppi0[0] = this.ppi0[0] & ~(1 << 4) | 1 << 5;
		else
			this.ppi0[0] |= 1 << 4;
	}

	down(fDown) {
		if (fDown)
			this.ppi0[2] = this.ppi0[2] & ~(1 << 6) | 1 << 4;
		else
			this.ppi0[2] |= 1 << 6;
	}

	left(fDown) {
		if (fDown)
			this.ppi0[0] = this.ppi0[0] & ~(1 << 5) | 1 << 4;
		else
			this.ppi0[0] |= 1 << 5;
	}

	triggerA(fDown) {
		if (fDown)
			this.ppi0[0] &= ~(1 << 3);
		else
			this.ppi0[0] |= 1 << 3;
	}

	triggerB(fDown) {
		if (fDown)
			this.ppi0[2] &= ~(1 << 5);
		else
			this.ppi0[2] |= 1 << 5;
	}

	triggerX(fDown) {
		if (fDown)
			this.ppi0[0] &= ~(1 << 1);
		else
			this.ppi0[0] |= 1 << 1;
	}

	convertRGB() {
		for (let i = 0; i < 0x20; i++)
			this.rgb[i] = (RGB[i] & 7) * 255 / 7	// Red
				| (RGB[i] >>> 3 & 7) * 255 / 7 << 8	// Green
				| (RGB[i] >>> 6) * 255 / 3 << 16;	// Blue
	}

	convertBG() {
		for (let p = 0, q = 0, i = 256; i !== 0; q += 8, --i)
			for (let j = 7; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k + 0x800] >>> j & 1 | BG[q + k] >>> j << 1 & 2;
		for (let p = 0, i = 7; i !== 0; p += 0x4000, --i)
			this.bg.copyWithin(p + 0x4000, p, p + 0x4000);
		for (let p = 0, i = 0; i < 8; i++)
			for (let j = 0x4000; j !== 0; p++, --j)
				this.bg[p] = this.rgb[i * 4 + this.bg[p]];
	}

	convertOBJ() {
		for (let p = 0, q = 0, i = 64; i !== 0; q += 32, --i) {
			for (let j = 7; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = BG[q + k + 0x800 + 16] >>> j & 1 | BG[q + k + 16] >>> j << 1 & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = BG[q + k + 0x800] >>> j & 1 | BG[q + k] >>> j << 1 & 2;
			}
			for (let j = 7; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = BG[q + k + 0x800 + 24] >>> j & 1 | BG[q + k + 24] >>> j << 1 & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = BG[q + k + 0x800 + 8] >>> j & 1 | BG[q + k + 8] >>> j << 1 & 2;
			}
		}
	}

	makeBitmap(data) {
		// bg 描画
		let p = 256 * 32;
		let k = 0xbe2;
		for (let i = 2; i < 32; p += 256 * 8, k += 0x401, i++) {
			let dwScroll = this.ram[0xc00 + i * 2];
			for (let j = 0; j < 32; k -= 0x20, j++) {
				this.xfer8x8(data, p + dwScroll, k, i);
				dwScroll = dwScroll + 8 & 0xff;
			}
		}

		// obj 描画
		for (let k = 0xc5c, i = 7; i >= 0; k -= 4, --i) {
			const x = this.ram[k];
			const y = this.ram[k + 3] + 16;
			switch (this.ram[k + 1] & 0xc0) {
			case 0x00: // ノーマル
				this.xfer16x16(data, x | y << 8, this.ram[k + 1] & 0x3f | this.ram[k + 2] << 6);
				break;
			case 0x40: // V反転
				this.xfer16x16V(data, x | y << 8, this.ram[k + 1] & 0x3f | this.ram[k + 2] << 6);
				break;
			case 0x80: // H反転
				this.xfer16x16H(data, x | y << 8, this.ram[k + 1] & 0x3f | this.ram[k + 2] << 6);
				break;
			case 0xc0: // HV反転
				this.xfer16x16HV(data, x | y << 8, this.ram[k + 1] & 0x3f | this.ram[k + 2] << 6);
				break;
			}
		}

		// bullets 描画
		for (let k = 0xc60, i = 0; i < 8; k += 4, i++) {
			p = this.ram[k + 1] | 264 - this.ram[k + 3] << 8;
			data[p] = this.rgb[7];
		}

		// bg 描画
		p = 256 * 16;
		k = 0xbe0;
		for (let i = 0; i < 2; p += 256 * 8, k += 0x401, i++) {
			let dwScroll = this.ram[0xc00 + i * 2];
			for (let j = 0; j < 32; k -= 0x20, j++) {
				this.xfer8x8(data, p + dwScroll, k, i);
				dwScroll = dwScroll + 8 & 0xff;
			}
		}

		// 背景色変更
		p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256 - 224, i++) {
			const color = (this.fBackgroundBlue && (~MAP[i >>> 3] & 1) !== 0 ? 0x00470000 : 0)
						| (this.fBackgroundGreen && (~MAP[i >>> 3] & 2) !== 0 ? 0x00003c00 : 0)
						| (this.fBackgroundRed && (~MAP[i >>> 3] & 2) !== 0 ? 0x0000007c : 0);
			for (let j = 0; j < 224; p++, j++)
				if (data[p] === 0)
					data[p] = color;
		}

		// alphaチャンネル修正
		p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] |= 0xff000000;
	}

	xfer8x8(data, p, k, i) {
		const q = (this.ram[k] | this.ram[0xc01 + i * 2] << 8) << 6 & 0x1ffc0;

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
	}

	xfer16x16(data, dst, src) {
		const idx = src >>> 4 & 0x1c;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		src = src << 8 & 0x3f00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.rgb[idx + this.obj[src++]]) !== 0)
					data[dst] = px;
	}

	xfer16x16V(data, dst, src) {
		const idx = src >>> 4 & 0x1c;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		src = (src << 8 & 0x3f00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.rgb[idx + this.obj[src++]]) !== 0)
					data[dst] = px;
	}

	xfer16x16H(data, dst, src) {
		const idx = src >>> 4 & 0x1c;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		src = (src << 8 & 0x3f00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.rgb[idx + this.obj[--src]]) !== 0)
					data[dst] = px;
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >>> 4 & 0x1c;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		src = (src << 8 & 0x3f00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.rgb[idx + this.obj[--src]]) !== 0)
					data[dst] = px;
	}
}

const keydown = e => {
	switch (e.keyCode) {
	case 37: // left
		game.left(true);
		break;
	case 38: // up
		game.up(true);
		break;
	case 39: // right
		game.right(true);
		break;
	case 40: // down
		game.down(true);
		break;
	case 48: // '0'
		game.coin();
		break;
	case 49: // '1'
		game.start1P();
		break;
	case 50: // '2'
		game.start2P();
		break;
	case 77: // 'M'
		if (!audioCtx)
			break;
		if (audioCtx.state === 'suspended')
			audioCtx.resume().catch();
		else if (audioCtx.state === 'running')
			audioCtx.suspend().catch();
		break;
	case 82: // 'R'
		game.reset();
		break;
	case 84: // 'T'
		if ((game.fTest = !game.fTest) === true)
			game.fReset = true;
		break;
	case 67: // 'C'
		game.triggerB(true);
		break;
	case 32: // space
	case 88: // 'X'
		game.triggerA(true);
		break;
	case 90: // 'Z'
		game.triggerX(true);
		break;
	}
};

const keyup = e => {
	switch (e.keyCode) {
	case 37: // left
		game.left(false);
		break;
	case 38: // up
		game.up(false);
		break;
	case 39: // right
		game.right(false);
		break;
	case 40: // down
		game.down(false);
		break;
	case 67: // 'C'
		game.triggerB(false);
		break;
	case 32: // space
	case 88: // 'X'
		game.triggerA(false);
		break;
	case 90: // 'Z'
		game.triggerX(false);
		break;
	}
};

/*
 *
 *	Strategy X
 *
 */

const url = 'stratgyx.zip';
let BG, RGB, PRG1, PRG2, MAP;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG1 = zip.files['2c_1.bin'].inflate() + zip.files['2e_2.bin'].inflate() + zip.files['2f_3.bin'].inflate() + zip.files['2h_4.bin'].inflate();
	PRG1 = new Uint8Array((PRG1 + zip.files['2j_5.bin'].inflate() + zip.files['2l_6.bin'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	PRG2 = new Uint8Array((zip.files['s1.bin'].inflate() + zip.files['s2.bin'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	BG = new Uint8Array((zip.files['5f_c2.bin'].inflate() + zip.files['5h_c1.bin'].inflate()).split('').map(c => c.charCodeAt(0)));
	RGB = new Uint8Array(zip.files['strategy.6e'].inflate().split('').map(c => c.charCodeAt(0)));
	MAP = new Uint8Array(zip.files['strategy.10k'].inflate().split('').map(c => c.charCodeAt(0)));
	init({
		game: game = new StrategyX(),
		sound: sound = [
			new AY_3_8910({clock: 14318181 / 8, resolution: 116, gain: 0.3}),
			new AY_3_8910({clock: 14318181 / 8, resolution: 116, gain: 0.3}),
		],
		rotate: true,
		keydown, keyup
	});
	loop();
}
