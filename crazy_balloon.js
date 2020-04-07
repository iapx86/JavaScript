/*
 *
 *	Crazy Balloon
 *
 */

import {init, loop} from './main.js';
import Z80 from './z80.js';

class CrazyBalloon {
	constructor() {
		this.cxScreen = 224;
		this.cyScreen = 256;
		this.width = 256;
		this.height = 256;
		this.xOffset = 0;
		this.yOffset = 0;
		this.fReset = false;
		this.fTest = false;
		this.fDIPSwitchChanged = true;
		this.fCoin = 0;
		this.fStart1P = 0;
		this.fStart2P = 0;
		this.nLife = 3;
		this.nBonus = 5000;

		// CPU周りの初期化
		this.fInterruptEnable = false;
		this.ram = new Uint8Array(0x0c00).addBase();
		this.io = new Uint8Array(0x100);

		this.cpu = new Z80(this);
		for (let i = 0; i < 0x30; i++)
			this.cpu.memorymap[i].base = PRG.base[i];
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0x44 + i].base = this.cpu.memorymap[0x40 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x44 + i].write = this.cpu.memorymap[0x40 + i].write = null;
			this.cpu.memorymap[0x4c + i].base = this.cpu.memorymap[0x48 + i].base = this.ram.base[4 + i];
			this.cpu.memorymap[0x4c + i].write = this.cpu.memorymap[0x48 + i].write = null;
			this.cpu.memorymap[0x54 + i].base = this.cpu.memorymap[0x50 + i].base = this.ram.base[8 + i];
			this.cpu.memorymap[0x54 + i].write = this.cpu.memorymap[0x50 + i].write = null;
		}
		for (let i = 0; i < 0x100; i++) {
			this.cpu.iomap[i].read = addr => this.io[addr & 3];
			this.cpu.iomap[i].write = (addr, data) => {
				switch (addr & 0xff) {
				case 2:
				case 3:
				case 4:
					this.objctrl[(addr & 0xff) - 2] = data;
					break;
				case 6:
					this.fInterruptEnable = (data & 1) !== 0;
					break;
				case 8:
					this.io[8] = data;
					break;
				}
			}
		}

		// DIPSW SETUP
		this.io[0] = 0x87;
		this.io[1] = 0xff;
		this.io[2] = 0xf7;
		this.io[3] = 0x3f;

		// Videoの初期化
		this.rgb = Uint32Array.of(
			0xffffffff, 0xffffff00, 0xffff00ff, 0xffff0000,
			0xff00ffff, 0xff00ff00, 0xff0000ff, 0xff000000,
			0xff555555, 0xff555500, 0xff550055, 0xff550000,
			0xff005555, 0xff005500, 0xff000055, 0xff000000,
		);
		this.bg = new Uint8Array(0x4000);
		this.obj = new Uint8Array(0x4000);
		this.objctrl = new Uint8Array(3);
		this.convertBG();
		this.convertOBJ();
	}

	execute() {
		if (this.fInterruptEnable)
			this.cpu.interrupt();
		this.cpu.execute(0x1800);
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
			case 2:
				this.io[0] &= ~0x0c;
				break;
			case 3:
				this.io[0] |= 4;
				this.io[0] &= ~8;
				break;
			case 4:
				this.io[0] &= ~4;
				this.io[0] |= 8;
				break;
			case 5:
				this.io[0] |= 0x0c;
				break;
			}
			switch (this.nBonus) {
			case 5000:
				this.io[0] &= ~0x10;
				break;
			case 10000:
				this.io[0] |= 0x10;
				break;
			}
			this.fReset = true;
		}

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.fInterruptEnable = false;
			this.ram.fill(0);
			this.cpu.reset();
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if ((this.io[8] & 2) === 0) {
			this.io[3] &= 0x0f;
			return this;
		}
		if (this.fCoin) {
			--this.fCoin;
			this.io[3] |= 1 << 6;
		}
		else
			this.io[3] &= ~(1 << 6);
		if (this.fStart1P) {
			--this.fStart1P;
			this.io[3] &= ~(1 << 4);
		}
		else
			this.io[3] |= 1 << 4;
		if (this.fStart2P) {
			--this.fStart2P;
			this.io[3] &= ~(1 << 5);
		}
		else
			this.io[3] |= 1 << 5;
		return this;
	}

	coin() {
		this.fCoin = 3;
	}

	start1P() {
		this.fStart1P = 2;
	}

	start2P() {
		this.fStart2P = 2;
	}

	up(fDown) {
		if (fDown)
			this.io[1] = this.io[1] & ~(1 << 0) | 1 << 1;
		else
			this.io[1] |= 1 << 0;
	}

	right(fDown) {
		if (fDown)
			this.io[1] = this.io[1] & ~(1 << 3) | 1 << 2;
		else
			this.io[1] |= 1 << 3;
	}

	down(fDown) {
		if (fDown)
			this.io[1] = this.io[1] & ~(1 << 1) | 1 << 0;
		else
			this.io[1] |= 1 << 1;
	}

	left(fDown) {
		if (fDown)
			this.io[1] = this.io[1] & ~(1 << 2) | 1 << 3;
		else
			this.io[1] |= 1 << 2;
	}

	triggerA(fDown) {
	}

	triggerB(fDown) {
	}

	convertBG() {
		for (let p = 0, q = 0, i = 0; i < 256; q += 8, i++)
			for (let j = 7; j >= 0; --j)
				for (let k = 0; k < 8; k++)
					this.bg[p++] = BG[q + k] >> j & 1;
	}

	convertOBJ() {
		for (let p = 0, q = 0, i = 0; i < 16; q += 128, i++) {
			for (let j = 7; j >= 0; --j)
				for (let k = 0; k < 32; k++)
					this.obj[p++] = OBJ[q + k + 96] >> j & 1;
			for (let j = 7; j >= 0; --j)
				for (let k = 0; k < 32; k++)
					this.obj[p++] = OBJ[q + k + 64] >> j & 1;
			for (let j = 7; j >= 0; --j)
				for (let k = 0; k < 32; k++)
					this.obj[p++] = OBJ[q + k + 32] >> j & 1;
			for (let j = 7; j >= 0; --j)
				for (let k = 0; k < 32; k++)
					this.obj[p++] = OBJ[q + k] >> j & 1;
		}
	}

	makeBitmap(data) {
		// bg描画
		let p = 256 * 8 * 31;
		let k = 0x0080;
		for (let i = 0; i < 28; p += 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p -= 256 * 8, j++)
				this.xfer8x8(data, p, k);

		// obj描画
		this.xfer32x32(data, (224 - this.objctrl[2]) & 0xff | this.objctrl[1] << 8, this.objctrl[0]);

		// palette変換
		p = 0;
		for (let i = 0; i < 256; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] = this.rgb[data[p]];
	}

	xfer8x8(data, p, k) {
		const q = this.ram[k + 0x400] << 6, color = this.ram[k + 0x800] & 0xf;

		data[p + 0x000] = this.bg[q | 0x00] ? color : 15;
		data[p + 0x001] = this.bg[q | 0x01] ? color : 15;
		data[p + 0x002] = this.bg[q | 0x02] ? color : 15;
		data[p + 0x003] = this.bg[q | 0x03] ? color : 15;
		data[p + 0x004] = this.bg[q | 0x04] ? color : 15;
		data[p + 0x005] = this.bg[q | 0x05] ? color : 15;
		data[p + 0x006] = this.bg[q | 0x06] ? color : 15;
		data[p + 0x007] = this.bg[q | 0x07] ? color : 15;
		data[p + 0x100] = this.bg[q | 0x08] ? color : 15;
		data[p + 0x101] = this.bg[q | 0x09] ? color : 15;
		data[p + 0x102] = this.bg[q | 0x0a] ? color : 15;
		data[p + 0x103] = this.bg[q | 0x0b] ? color : 15;
		data[p + 0x104] = this.bg[q | 0x0c] ? color : 15;
		data[p + 0x105] = this.bg[q | 0x0d] ? color : 15;
		data[p + 0x106] = this.bg[q | 0x0e] ? color : 15;
		data[p + 0x107] = this.bg[q | 0x0f] ? color : 15;
		data[p + 0x200] = this.bg[q | 0x10] ? color : 15;
		data[p + 0x201] = this.bg[q | 0x11] ? color : 15;
		data[p + 0x202] = this.bg[q | 0x12] ? color : 15;
		data[p + 0x203] = this.bg[q | 0x13] ? color : 15;
		data[p + 0x204] = this.bg[q | 0x14] ? color : 15;
		data[p + 0x205] = this.bg[q | 0x15] ? color : 15;
		data[p + 0x206] = this.bg[q | 0x16] ? color : 15;
		data[p + 0x207] = this.bg[q | 0x17] ? color : 15;
		data[p + 0x300] = this.bg[q | 0x18] ? color : 15;
		data[p + 0x301] = this.bg[q | 0x19] ? color : 15;
		data[p + 0x302] = this.bg[q | 0x1a] ? color : 15;
		data[p + 0x303] = this.bg[q | 0x1b] ? color : 15;
		data[p + 0x304] = this.bg[q | 0x1c] ? color : 15;
		data[p + 0x305] = this.bg[q | 0x1d] ? color : 15;
		data[p + 0x306] = this.bg[q | 0x1e] ? color : 15;
		data[p + 0x307] = this.bg[q | 0x1f] ? color : 15;
		data[p + 0x400] = this.bg[q | 0x20] ? color : 15;
		data[p + 0x401] = this.bg[q | 0x21] ? color : 15;
		data[p + 0x402] = this.bg[q | 0x22] ? color : 15;
		data[p + 0x403] = this.bg[q | 0x23] ? color : 15;
		data[p + 0x404] = this.bg[q | 0x24] ? color : 15;
		data[p + 0x405] = this.bg[q | 0x25] ? color : 15;
		data[p + 0x406] = this.bg[q | 0x26] ? color : 15;
		data[p + 0x407] = this.bg[q | 0x27] ? color : 15;
		data[p + 0x500] = this.bg[q | 0x28] ? color : 15;
		data[p + 0x501] = this.bg[q | 0x29] ? color : 15;
		data[p + 0x502] = this.bg[q | 0x2a] ? color : 15;
		data[p + 0x503] = this.bg[q | 0x2b] ? color : 15;
		data[p + 0x504] = this.bg[q | 0x2c] ? color : 15;
		data[p + 0x505] = this.bg[q | 0x2d] ? color : 15;
		data[p + 0x506] = this.bg[q | 0x2e] ? color : 15;
		data[p + 0x507] = this.bg[q | 0x2f] ? color : 15;
		data[p + 0x600] = this.bg[q | 0x30] ? color : 15;
		data[p + 0x601] = this.bg[q | 0x31] ? color : 15;
		data[p + 0x602] = this.bg[q | 0x32] ? color : 15;
		data[p + 0x603] = this.bg[q | 0x33] ? color : 15;
		data[p + 0x604] = this.bg[q | 0x34] ? color : 15;
		data[p + 0x605] = this.bg[q | 0x35] ? color : 15;
		data[p + 0x606] = this.bg[q | 0x36] ? color : 15;
		data[p + 0x607] = this.bg[q | 0x37] ? color : 15;
		data[p + 0x700] = this.bg[q | 0x38] ? color : 15;
		data[p + 0x701] = this.bg[q | 0x39] ? color : 15;
		data[p + 0x702] = this.bg[q | 0x3a] ? color : 15;
		data[p + 0x703] = this.bg[q | 0x3b] ? color : 15;
		data[p + 0x704] = this.bg[q | 0x3c] ? color : 15;
		data[p + 0x705] = this.bg[q | 0x3d] ? color : 15;
		data[p + 0x706] = this.bg[q | 0x3e] ? color : 15;
		data[p + 0x707] = this.bg[q | 0x3f] ? color : 15;
	}

	xfer32x32(data, dst, src) {
		const color = src >> 4;
		let collision = false;

		this.io[2] = this.io[2] & 0xf0 | 0x07;
		if ((dst & 0xff) === 224 || (dst & 0xff00) > 224 * 256 || color === 15)
			return;
		src = src << 10 & 0x3c00;
		for (let i = 32; i !== 0; dst += 256 - 32, --i)
			for (let j = 32; j !== 0; dst++, --j)
				if (this.obj[src++]) {
					collision = collision || data[dst] !== 15;
					data[dst] = color;
				}
		if (collision)
			this.io[2]++;
	}
}

/*
 *
 *	Crazy Balloon
 *
 */

const url = 'crbaloon.zip';
let PRG, BG, OBJ;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG = zip.files['cl01.bin'].inflate() + zip.files['cl02.bin'].inflate() + zip.files['cl03.bin'].inflate() + zip.files['cl04.bin'].inflate();
	PRG = new Uint8Array((PRG + zip.files['cl05.bin'].inflate() + zip.files['cl06.bin'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	BG = new Uint8Array(zip.files['cl07.bin'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJ = new Uint8Array(zip.files['cl08.bin'].inflate().split('').map(c => c.charCodeAt(0)));
	init({game: new CrazyBalloon()});
	loop();
}

