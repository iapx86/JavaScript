/*
 *
 *	Zig Zag
 *
 */

import AY_3_8910 from './ay-3-8910.js';
import {init, loop} from './main.js';
import Z80 from './z80.js';
let sound;

class ZigZag {
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
		this.nBonus = '10000 60000';

		// CPU周りの初期化
		this.fInterruptEnable = false;
		this.bank = 0x20;

		this.ram = new Uint8Array(0x900).addBase();
		this.in = Uint8Array.of(0, 0, 2);
		this.psg = {latch: 0, addr: 0};

		this.cpu = new Z80(this);
		for (let i = 0; i < 0x40; i++)
			this.cpu.memorymap[i].base = PRG.base[i];
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0x44 + i].base = this.cpu.memorymap[0x40 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x44 + i].write = this.cpu.memorymap[0x40 + i].write = null;
			this.cpu.memorymap[0x54 + i].base = this.cpu.memorymap[0x50 + i].base = this.ram.base[4 + i];
			this.cpu.memorymap[0x54 + i].write = this.cpu.memorymap[0x50 + i].write = null;
		}
		for (let i = 0; i < 8; i++) {
			this.cpu.memorymap[0x58 + i].base = this.ram.base[8];
			this.cpu.memorymap[0x58 + i].write = null;
			this.cpu.memorymap[0x48 + i].write = addr => {
				switch (addr & 0x0300) {
				case 0x0000:
					if ((addr & 1) === 0)
						break;
					if ((addr & 2) === 0)
						sound.write(this.psg.addr, this.psg.latch);
					else
						this.psg.addr = this.psg.latch;
					break;
				case 0x0100:
					this.psg.latch = addr;
					break;
				}
			};
			this.cpu.memorymap[0x60 + i].read = () => this.in[0];
			this.cpu.memorymap[0x68 + i].read = () => this.in[1];
			this.cpu.memorymap[0x70 + i].read = () => this.in[2];
			this.cpu.memorymap[0x70 + i].write = (addr, data) => {
				switch (addr & 7) {
				case 0x01:
					this.fInterruptEnable = (data & 1) !== 0;
					break;
				case 0x02:
					const bank = data << 4 & 0x10 | 0x20;
					if (bank === this.bank)
						break;
					for (let i = 0; i < 0x10; i++) {
						this.cpu.memorymap[0x20 + i].base = PRG.base[bank + i];
						this.cpu.memorymap[0x30 + i].base = PRG.base[(bank ^ 0x10) + i];
					}
					this.bank = bank;
					break;
				case 0x04:
					this.fStarEnable = (data & 1) !== 0;
					break;
				}
			};
		}

		// Videoの初期化
		this.stars = [];
		for (let i = 0; i < 1024; i++)
			this.stars[i] = {x: 0, y: 0, color: 0};
		this.fStarEnable = false;
		this.fStarMove = false;
		this.bg = new Uint32Array(0x20000);
		this.obj = new Uint8Array(0x4000);
		this.rgb = new Uint32Array(0x20);
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();
		this.initializeStar();
	}

	execute() {
		if (this.fInterruptEnable)
			this.cpu.non_maskable_interrupt();
		this.cpu.execute(0x1600);
		this.moveStars();
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
				this.in[2] &= ~1;
				break;
			case 4:
				this.in[2] |= 1;
				break;
			}
			switch (this.nBonus) {
			case '10000 60000':
				this.in[2] &= ~0x0c;
				break;
			case '20000 60000':
				this.in[2] = this.in[2] & ~0x0c | 4;
				break;
			case '30000 60000':
				this.in[2] = this.in[2] & ~0x0c | 8;
				break;
			case '40000 60000':
				this.in[2] |= 0x0c;
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
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if (this.fCoin) {
			--this.fCoin;
			this.in[0] |= 1 << 0;
		}
		else
			this.in[0] &= ~(1 << 0);
		if (this.fStart1P) {
			--this.fStart1P;
			this.in[1] |= 1 << 0;
		}
		else
			this.in[1] &= ~(1 << 0);
		if (this.fStart2P) {
			--this.fStart2P;
			this.in[1] |= 1 << 1;
		}
		else
			this.in[1] &= ~(1 << 1);
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
			this.in[0] = this.in[0] & ~(1 << 6) | 1 << 5;
		else
			this.in[0] &= ~(1 << 5);
	}

	right(fDown) {
		if (fDown)
			this.in[0] = this.in[0] & ~(1 << 2) | 1 << 3;
		else
			this.in[0] &= ~(1 << 3);
	}

	down(fDown) {
		if (fDown)
			this.in[0] = this.in[0] & ~(1 << 5) | 1 << 6;
		else
			this.in[0] &= ~(1 << 6);
	}

	left(fDown) {
		if (fDown)
			this.in[0] = this.in[0] & ~(1 << 3) | 1 << 2;
		else
			this.in[0] &= ~(1 << 2);
	}

	triggerA(fDown) {
		if (fDown)
			this.in[0] |= 1 << 4;
		else
			this.in[0] &= ~(1 << 4);
	}

	triggerB(fDown) {
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
					this.obj[p++] = OBJ[q + k + 0x800 + 16] >>> j & 1 | OBJ[q + k + 16] >>> j << 1 & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 0x800] >>> j & 1 | OBJ[q + k] >>> j << 1 & 2;
			}
			for (let j = 7; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 0x800 + 24] >>> j & 1 | OBJ[q + k + 24] >>> j << 1 & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 0x800 + 8] >>> j & 1 | OBJ[q + k + 8] >>> j << 1 & 2;
			}
		}
	}

	initializeStar() {
		const starColors = [0xd0, 0x70, 0x40, 0x00];
		let color;

		for (let sr = 0, i = 0, x = 255; x >= 0; --x) {
			for (let y = 0; y < 256; y++) {
				const cy = sr >>> 4 ^ ~sr >>> 16;
				sr = cy & 1 | sr << 1;
				if ((sr & 0x100ff) === 0xff && (color = sr >>> 8 & 0x3f) !== 0 && color !== 0x3f) {
					this.stars[i].x = x & 0xff;
					this.stars[i].y = y;
					this.stars[i].color = starColors[color & 3]	// Red
						| starColors[color >>> 2 & 3] << 8		// Green
						| starColors[color >>> 4 & 3] << 16;		// Blue
					if (++i >= 1024)
						return;
				}
			}
		}
	}

	moveStars() {
		if (this.fStarEnable && (this.fStarMove = !this.fStarMove))
			for (let i = 0; i < 256 && this.stars[i].color; i++)
				if (++this.stars[i].y >= 0x100) {
					this.stars[i].y &= 0xff;
					this.stars[i].x = this.stars[i].x - 1 & 0xff;
				}
	}

	makeBitmap(data) {
		// bg 描画
		let p = 256 * 32;
		let k = 0x7e2;
		for (let i = 2; i < 32; p += 256 * 8, k += 0x401, i++) {
			let dwScroll = this.ram[0x800 + i * 2];
			for (let j = 0; j < 32; k -= 0x20, j++) {
				this.xfer8x8(data, p + dwScroll, k, i);
				dwScroll = dwScroll + 8 & 0xff;
			}
		}

		// obj 描画
		for (let k = 0x840, i = 16; i !== 0; k += 4, --i) {
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

		// bg 描画
		p = 256 * 16;
		k = 0x7e0;
		for (let i = 0; i < 2; p += 256 * 8, k += 0x401, i++) {
			let dwScroll = this.ram[0x800 + i * 2];
			for (let j = 0; j < 32; k -= 0x20, j++) {
				this.xfer8x8(data, p + dwScroll, k, i);
				dwScroll = dwScroll + 8 & 0xff;
			}
		}

		// star 描画
		if (this.fStarEnable) {
			let px;
			p = 256 * 16;
			for (let i = 0; i < 256; i++) {
				if (!(px = this.stars[i].color))
					break;
				const x = this.stars[i].x;
				const y = this.stars[i].y;
				if ((x & 1) !== 0 && (y & 8) === 0 && data[p + (x | y << 8)] === 0)
					data[p + (x | y << 8)] = px;
				else if ((x & 1) === 0 && (y & 8) !== 0 && data[p + (x | y << 8)] === 0)
					data[p + (x | y << 8)] = px;
			}
		}

		// alphaチャンネル修正
		p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] |= 0xff000000;
	}

	xfer8x8(data, p, k, i) {
		const q = (this.ram[k] | this.ram[0x801 + i * 2] << 8) << 6 & 0x1ffc0;

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

/*
 *
 *	Zig Zag
 *
 */

const url = 'zigzagb.zip';
let BG, OBJ, RGB, PRG;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG = new Uint8Array((zip.files['zz_d1.7l'].inflate() + zip.files['zz_d2.7k'].inflate() + zip.files['zz_d4.7f'].inflate() + zip.files['zz_d3.7h'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	BG = new Uint8Array((zip.files['zz_6.1h'].inflate().substring(0, 0x800) + zip.files['zz_5.1k'].inflate().substring(0, 0x800)).split('').map(c => c.charCodeAt(0)));
	OBJ = new Uint8Array((zip.files['zz_6.1h'].inflate().substring(0x800) + zip.files['zz_5.1k'].inflate().substring(0x800)).split('').map(c => c.charCodeAt(0)));
	RGB = new Uint8Array(zip.files['zzbpr_e9.bin'].inflate().split('').map(c => c.charCodeAt(0)));
	init({
		game: new ZigZag(),
		sound: sound = new AY_3_8910({clock: 1843200}),
	});
	loop();
}
