/*
 *
 *	Sky Kid Deluxe
 *
 */

import YM2151 from './ym2151.js';
import C30 from './c30.js';
import Cpu, {init, loop} from './main.js';
import MC6809 from './mc6809.js';
import MC6801 from './mc6801.js';
let sound;

class SkyKidDeluxe {
	constructor() {
		this.cxScreen = 224;
		this.cyScreen = 288;
		this.width = 256;
		this.height = 512;
		this.xOffset = 16;
		this.yOffset = 16;
		this.fReset = true;
		this.fTest = false;
		this.fDIPSwitchChanged = true;
		this.fCoin = 0;
		this.fStart1P = 0;
		this.fStart2P = 0;
		this.fAttract = true;
		this.fRound = false;
		this.nLife = 3;
		this.nBonus = '30000 90000';

		// CPU周りの初期化
		this.bank = 0;

		this.ram = new Uint8Array(0x6000).addBase();
		this.ram3 = new Uint8Array(0xd00).addBase();
		this.fm = {addr: 0};
		this.in = new Uint8Array(5).fill(0xff);

		this.cpu = new MC6809(this);
		for (let i = 0; i < 0x40; i++) {
			this.cpu.memorymap[i].base = this.ram.base[i];
			this.cpu.memorymap[i].write = null;
		}
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0x40 + i].read = addr => sound[1].read(addr);
			this.cpu.memorymap[0x40 + i].write = (addr, data) => sound[1].write(addr, data);
		}
		for (let i = 0; i < 0x1c; i++) {
			this.cpu.memorymap[0x44 + i].base = this.ram.base[0x44 + i];
			this.cpu.memorymap[0x44 + i].write = null;
		}
		for (let i = 0; i < 0x20; i++)
			this.cpu.memorymap[0x60 + i].base = PRG1.base[i];
		for (let i = 0; i < 0x80; i++)
			this.cpu.memorymap[0x80 + i].base = PRG1.base[0x80 + i];
//		for (let i = 0; i < 8; i++)
//			this.cpu.memorymap[0x88 + i].write = addr => this.bgbank = addr >> 10 & 1;
		this.cpu.memorymap[0x90].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				return void(this.vScroll[0] = this.vScroll[0] & 0xff | data << 8);
			case 1:
				return void(this.vScroll[0] = this.vScroll[0] & 0xff00 | data);
			case 2:
				return void(this.hScroll[0] = data);
			case 3:
				const bank = data << 5 & 0x60;
				if (bank === this.bank)
					break;
				for (let i = 0; i < 0x20; i++)
					this.cpu.memorymap[0x60 + i].base = PRG1.base[bank + i];
				return void(this.bank = bank);
			case 4:
				return void(this.vScroll[1] = this.vScroll[1] & 0xff | data << 8);
			case 5:
				return void(this.vScroll[1] = this.vScroll[1] & 0xff00 | data);
			case 6:
				return void(this.hScroll[1] = data);
			}
		};
		this.cpu.memorymap[0x94].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				return void(this.vScroll[2] = this.vScroll[2] & 0xff | data << 8);
			case 1:
				return void(this.vScroll[2] = this.vScroll[2] & 0xff00 | data);
			case 2:
				return void(this.hScroll[2] = data);
			case 4:
				return void(this.vScroll[3] = this.vScroll[3] & 0xff | data << 8);
			case 5:
				return void(this.vScroll[3] = this.vScroll[3] & 0xff00 | data);
			case 6:
				return void(this.hScroll[3] = data);
			}
		};
		this.cpu.memorymap[0xa0].write = (addr, data) => void(this.backcolor = data);

		this.cpu2 = new MC6809(this);
		for (let i = 0; i < 0x80; i++)
			this.cpu2.memorymap[0x80 + i].base = PRG2.base[i];

		this.mcu = new MC6801(this);
		this.mcu.memorymap[0].base = this.ram3.base[0];
		this.mcu.memorymap[0].read = addr => addr === 2 ? this.in[2] : this.ram3[addr];
		this.mcu.memorymap[0].write = null;
		for (let i = 0; i < 4; i++) {
			this.mcu.memorymap[0x10 + i].read = addr => sound[1].read(addr);
			this.mcu.memorymap[0x10 + i].write = (addr, data) => sound[1].write(addr, data);
		}
		for (let i = 0; i < 0x0c; i++) {
			this.mcu.memorymap[0x14 + i].base = this.ram3.base[1 + i];
			this.mcu.memorymap[0x14 + i].write = null;
		}
		this.mcu.memorymap[0x20].read = addr => {
			switch (addr & 0xff) {
			case 1:
				return 0;
			case 0x20:
				return this.in[0];
			case 0x21:
				return this.in[1];
			case 0x30:
				return this.in[3];
			case 0x31:
				return this.in[4];
			}
			return 0xff;
		};
		this.mcu.memorymap[0x20].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				return void(this.fm.addr = data);
			case 1:
				return void sound[0].write(this.fm.addr, data);
			}
		};
		for (let i = 0; i < 0x40; i++)
			this.mcu.memorymap[0x80 + i].base = PRG3.base[i];
		for (let i = 0; i < 0x10; i++)
			this.mcu.memorymap[0xf0 + i].base = PRG3I.base[i];

		// Videoの初期化
		this.bg1 = new Uint8Array(0x20000);
		this.bg2 = new Uint8Array(0x20000);
		this.obj = new Uint8Array(0x20000);
		this.rgb = new Uint32Array(0x200);
		this.vScroll = new Uint16Array(4);
		this.hScroll = new Uint8Array(4);
//		this.bgbank = 0;
		this.backcolor = 0;
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();
	}

	execute() {
		this.cpu.interrupt();
		this.mcu.interrupt();
		Cpu.multiple_execute([this.cpu, this.mcu], 0x1000);
		if ((this.ram3[8] & 8) !== 0)
			this.mcu.interrupt('ocf');
		Cpu.multiple_execute([this.cpu, this.mcu], 0x1000);
		return this;
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// DIPスイッチの更新
		if (this.fDIPSwitchChanged) {
			this.fDIPSwitchChanged = false;
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.in[4] &= 8;
		else
			this.in[4] |= 8;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu.reset();
			this.mcu.reset();
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if (this.fCoin) {
			--this.fCoin;
			this.in[0] &= ~(1 << 5);
		}
		else
			this.in[0] |= 1 << 5;
		if (this.fStart1P) {
			--this.fStart1P;
			this.in[0] &= ~(1 << 6);
		}
		else
			this.in[0] |= 1 << 6;
		if (this.fStart2P) {
			--this.fStart2P;
			this.in[1] &= ~(1 << 6);
		}
		else
			this.in[1] |= 1 << 6;
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
			this.in[1] = this.in[1] & ~(1 << 2);
		else
			this.in[1] |= 1 << 2;
	}

	right(fDown) {
		if (fDown)
			this.in[2] = this.in[2] & ~(1 << 5);
		else
			this.in[2] |= 1 << 5;
	}

	down(fDown) {
		if (fDown)
			this.in[0] = this.in[0] & ~(1 << 2);
		else
			this.in[0] |= 1 << 2;
	}

	left(fDown) {
		if (fDown)
			this.in[2] = this.in[2] & ~(1 << 4);
		else
			this.in[2] |= 1 << 4;
	}

	triggerA(fDown) {
		if (fDown)
			this.in[2] &= ~(1 << 3);
		else
			this.in[2] |= 1 << 3;
	}

	triggerB(fDown) {
		if (fDown)
			this.in[0] &= ~(1 << 1);
		else
			this.in[0] |= 1 << 1;
	}

	convertRGB() {
		for (let i = 0; i < 0x200; i++)
			this.rgb[i] = (RED[i] & 0xf) * 255 / 15	// Red
				| (RED[i] >> 4) * 255 / 15 << 8		// Green
				| (BLUE[i] & 0xf) * 255 / 15 << 16	// Blue
				| 0xff000000;						// Alpha
	}

	convertBG() {
		for (let p = 0, q = 0, i = 0; i < 2048; q += 8, i++) {
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg1[p++] = BG1[(q + k) * 2] >> j & 1 | BG1[(q + k) * 2] >> j + 3 & 2 | ~BG1[q + k + 0x8000] >> j + 2 & 4;
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg1[p++] = BG1[(q + k) * 2 + 1] >> j & 1 | BG1[(q + k) * 2 + 1] >> j + 3 & 2 | ~BG1[q + k + 0x8000] >> j << 2 & 4;
		}
		for (let p = 0, q = 0, i = 0; i < 2048; q += 8, i++) {
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg2[p++] = BG2[(q + k) * 2] >> j & 1 | BG2[(q + k) * 2] >> j + 3 & 2 | ~BG2[q + k + 0x8000] >> j + 2 & 4;
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg2[p++] = BG2[(q + k) * 2 + 1] >> j & 1 | BG2[(q + k) * 2 + 1] >> j + 3 & 2 | ~BG2[q + k + 0x8000] >> j << 2 & 4;
		}
	}

	convertOBJ() {
		for (let p = 0, q = 0, i = 128; i !== 0; q += 512, --i) {
			for (let j = 0; j < 8; j++) {
				for (let k = 120; k >= 0; k -= 8)
					this.obj[p++] = OBJ[q + j + k + 256] >> 4;
				for (let k = 120; k >= 0; k -= 8)
					this.obj[p++] = OBJ[q + j + k] >> 4;
				for (let k = 120; k >= 0; k -= 8)
					this.obj[p++] = OBJ[q + j + k + 256] & 0xf;
				for (let k = 120; k >= 0; k -= 8)
					this.obj[p++] = OBJ[q + j + k] & 0xf;
			}
			for (let j = 0; j < 8; j++) {
				for (let k = 120; k >= 0; k -= 8)
					this.obj[p++] = OBJ[q + j + k + 384] >> 4;
				for (let k = 120; k >= 0; k -= 8)
					this.obj[p++] = OBJ[q + j + k + 128] >> 4;
				for (let k = 120; k >= 0; k -= 8)
					this.obj[p++] = OBJ[q + j + k + 384] & 0xf;
				for (let k = 120; k >= 0; k -= 8)
					this.obj[p++] = OBJ[q + j + k + 128] & 0xf;
			}
		}
	}

	makeBitmap(data) {
		let p, k, layer;

		// 画面クリア
		p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256, i++)
			data.fill(BGCOLOR[this.backcolor << 3 | 7], p, p + 224);

		for (let pri = 0; pri < 8; pri++) {
			// bg描画
			for (layer = 0; layer < 4; layer++)
				if ((this.vScroll[layer] >> 9 & 7) === pri)
					break;
			switch (layer) {
			case 0:
				p = 256 * 8 * 2 + 232 - (204 - this.vScroll[0] & 7) * 256 + (7 - this.hScroll[0] & 7);
				k = 204 - this.vScroll[0] >> 2 & 0x7e | 7 - this.hScroll[0] << 4 & 0xf80;
				for (let i = 0; i < 29; k = k + 54 & 0x7e | k + 0x80 & 0xf80, p -= 256 * 8 * 37 + 8, i++)
					for (let j = 0; j < 37; k = k + 2 & 0x7e | k & 0x3f80, p += 256 * 8, j++)
						this.xfer8x8b1(data, p, k, 0);
				break;
			case 1:
				p = 256 * 8 * 2 + 232 - (206 - this.vScroll[1] & 7) * 256 + (7 - this.hScroll[1] & 7);
				k = 206 - this.vScroll[1] >> 2 & 0x7e | 7 - this.hScroll[1] << 4 & 0xf80 | 0x1000;
				for (let i = 0; i < 29; k = k + 54 & 0x7e | k + 0x80 & 0xf80 | 0x1000, p -= 256 * 8 * 37 + 8, i++)
					for (let j = 0; j < 37; k = k + 2 & 0x7e | k & 0x3f80, p += 256 * 8, j++)
						this.xfer8x8b1(data, p, k, 0x10);
				break;
			case 2:
				p = 256 * 8 * 2 + 232 - (203 - this.vScroll[2] & 7) * 256 + (7 - this.hScroll[2] & 7);
				k = 203 - this.vScroll[2] >> 2 & 0x7e | 7 - this.hScroll[2] << 4 & 0xf80 | 0x2000;
				for (let i = 0; i < 29; k = k + 54 & 0x7e | k + 0x80 & 0xf80 | 0x2000, p -= 256 * 8 * 37 + 8, i++)
					for (let j = 0; j < 37; k = k + 2 & 0x7e | k & 0x3f80, p += 256 * 8, j++)
						this.xfer8x8b2(data, p, k, 0);
				break;
			case 3:
				p = 256 * 8 * 2 + 232 - (205 - this.vScroll[3] & 7) * 256 + (7 - this.hScroll[3] & 7);
				k = 205 - this.vScroll[3] >> 2 & 0x7e | 7 - this.hScroll[3] << 4 & 0xf80 | 0x3000;
				for (let i = 0; i < 29; k = k + 54 & 0x7e | k + 0x80 & 0xf80 | 0x3000, p -= 256 * 8 * 37 + 8, i++)
					for (let j = 0; j < 37; k = k + 2 & 0x7e | k & 0x3f80, p += 256 * 8, j++)
						this.xfer8x8b2(data, p, k, 0x10);
				break;
			}

			// obj描画
			for (let k = 0x5800, i = 127; i !== 0; k += 16, --i) {
				const ram = this.ram;
				if (ram[k + 8] >> 5 !== pri)
					continue;
				const w = [16, 8, 32, 4][ram[k + 8] >> 1 & 3], h = [16, 8, 32, 4][ram[k + 4] >> 6];
				const x = w + ram[k + 9] + ram[0x5ff7] & 0xff;
				const y = 371 + (ram[k + 7] | ram[k + 6] << 8 & 0x100) + (ram[0x5ff5] | ram[0x5ff4] << 8 & 0x100) & 0x1ff;
				const src = (~ram[k + 8] & 0x18 | 7) & -w | (ram[k + 4] & -h) << 5 & 0x300 | ram[k + 5] << 10 & 0xfc00 | ram[k + 4] << 16 & 0x10000;
				const color = ram[k + 6] << 3 & 0x7f0;
				switch (ram[k + 8] & 1 | ram[k + 4] >> 4 & 2) {
				case 0:
					this.xferHxW(data, src, color, y, x, h, w);
					break;
				case 1:
					this.xferHxW_H(data, src, color, y, x, h, w);
					break;
				case 2:
					this.xferHxW_V(data, src, color, y, x, h, w);
					break;
				case 0x03:
					this.xferHxW_HV(data, src, color, y, x, h, w);
					break;
				}
			}
		}

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] = this.rgb[data[p]];
	}

	xfer8x8b1(data, p, k, back) {
		const q = (this.ram[k] | BGADDR[this.ram[k + 1] << 2 & 0xc | back] << 7 & 0x700) << 6;
		const idx = this.ram[k + 1] << 3;
		let px;

		if ((px = this.bg1[q | 0x00]) !== 7) data[p + 0x000] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x01]) !== 7) data[p + 0x001] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x02]) !== 7) data[p + 0x002] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x03]) !== 7) data[p + 0x003] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x04]) !== 7) data[p + 0x004] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x05]) !== 7) data[p + 0x005] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x06]) !== 7) data[p + 0x006] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x07]) !== 7) data[p + 0x007] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x08]) !== 7) data[p + 0x100] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x09]) !== 7) data[p + 0x101] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x0a]) !== 7) data[p + 0x102] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x0b]) !== 7) data[p + 0x103] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x0c]) !== 7) data[p + 0x104] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x0d]) !== 7) data[p + 0x105] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x0e]) !== 7) data[p + 0x106] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x0f]) !== 7) data[p + 0x107] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x10]) !== 7) data[p + 0x200] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x11]) !== 7) data[p + 0x201] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x12]) !== 7) data[p + 0x202] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x13]) !== 7) data[p + 0x203] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x14]) !== 7) data[p + 0x204] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x15]) !== 7) data[p + 0x205] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x16]) !== 7) data[p + 0x206] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x17]) !== 7) data[p + 0x207] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x18]) !== 7) data[p + 0x300] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x19]) !== 7) data[p + 0x301] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x1a]) !== 7) data[p + 0x302] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x1b]) !== 7) data[p + 0x303] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x1c]) !== 7) data[p + 0x304] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x1d]) !== 7) data[p + 0x305] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x1e]) !== 7) data[p + 0x306] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x1f]) !== 7) data[p + 0x307] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x20]) !== 7) data[p + 0x400] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x21]) !== 7) data[p + 0x401] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x22]) !== 7) data[p + 0x402] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x23]) !== 7) data[p + 0x403] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x24]) !== 7) data[p + 0x404] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x25]) !== 7) data[p + 0x405] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x26]) !== 7) data[p + 0x406] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x27]) !== 7) data[p + 0x407] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x28]) !== 7) data[p + 0x500] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x29]) !== 7) data[p + 0x501] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x2a]) !== 7) data[p + 0x502] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x2b]) !== 7) data[p + 0x503] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x2c]) !== 7) data[p + 0x504] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x2d]) !== 7) data[p + 0x505] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x2e]) !== 7) data[p + 0x506] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x2f]) !== 7) data[p + 0x507] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x30]) !== 7) data[p + 0x600] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x31]) !== 7) data[p + 0x601] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x32]) !== 7) data[p + 0x602] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x33]) !== 7) data[p + 0x603] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x34]) !== 7) data[p + 0x604] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x35]) !== 7) data[p + 0x605] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x36]) !== 7) data[p + 0x606] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x37]) !== 7) data[p + 0x607] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x38]) !== 7) data[p + 0x700] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x39]) !== 7) data[p + 0x701] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x3a]) !== 7) data[p + 0x702] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x3b]) !== 7) data[p + 0x703] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x3c]) !== 7) data[p + 0x704] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x3d]) !== 7) data[p + 0x705] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x3e]) !== 7) data[p + 0x706] = BGCOLOR[idx | px];
		if ((px = this.bg1[q | 0x3f]) !== 7) data[p + 0x707] = BGCOLOR[idx | px];
	}

	xfer8x8b2(data, p, k, back) {
		const q = (this.ram[k] | BGADDR[this.ram[k + 1] & 0x3 | back] << 3 & 0x700) << 6;
		const idx = this.ram[k + 1] << 3;
		let px;

		if ((px = this.bg2[q | 0x00]) !== 7) data[p + 0x000] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x01]) !== 7) data[p + 0x001] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x02]) !== 7) data[p + 0x002] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x03]) !== 7) data[p + 0x003] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x04]) !== 7) data[p + 0x004] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x05]) !== 7) data[p + 0x005] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x06]) !== 7) data[p + 0x006] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x07]) !== 7) data[p + 0x007] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x08]) !== 7) data[p + 0x100] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x09]) !== 7) data[p + 0x101] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x0a]) !== 7) data[p + 0x102] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x0b]) !== 7) data[p + 0x103] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x0c]) !== 7) data[p + 0x104] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x0d]) !== 7) data[p + 0x105] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x0e]) !== 7) data[p + 0x106] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x0f]) !== 7) data[p + 0x107] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x10]) !== 7) data[p + 0x200] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x11]) !== 7) data[p + 0x201] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x12]) !== 7) data[p + 0x202] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x13]) !== 7) data[p + 0x203] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x14]) !== 7) data[p + 0x204] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x15]) !== 7) data[p + 0x205] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x16]) !== 7) data[p + 0x206] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x17]) !== 7) data[p + 0x207] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x18]) !== 7) data[p + 0x300] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x19]) !== 7) data[p + 0x301] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x1a]) !== 7) data[p + 0x302] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x1b]) !== 7) data[p + 0x303] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x1c]) !== 7) data[p + 0x304] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x1d]) !== 7) data[p + 0x305] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x1e]) !== 7) data[p + 0x306] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x1f]) !== 7) data[p + 0x307] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x20]) !== 7) data[p + 0x400] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x21]) !== 7) data[p + 0x401] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x22]) !== 7) data[p + 0x402] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x23]) !== 7) data[p + 0x403] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x24]) !== 7) data[p + 0x404] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x25]) !== 7) data[p + 0x405] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x26]) !== 7) data[p + 0x406] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x27]) !== 7) data[p + 0x407] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x28]) !== 7) data[p + 0x500] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x29]) !== 7) data[p + 0x501] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x2a]) !== 7) data[p + 0x502] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x2b]) !== 7) data[p + 0x503] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x2c]) !== 7) data[p + 0x504] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x2d]) !== 7) data[p + 0x505] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x2e]) !== 7) data[p + 0x506] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x2f]) !== 7) data[p + 0x507] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x30]) !== 7) data[p + 0x600] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x31]) !== 7) data[p + 0x601] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x32]) !== 7) data[p + 0x602] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x33]) !== 7) data[p + 0x603] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x34]) !== 7) data[p + 0x604] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x35]) !== 7) data[p + 0x605] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x36]) !== 7) data[p + 0x606] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x37]) !== 7) data[p + 0x607] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x38]) !== 7) data[p + 0x700] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x39]) !== 7) data[p + 0x701] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x3a]) !== 7) data[p + 0x702] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x3b]) !== 7) data[p + 0x703] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x3c]) !== 7) data[p + 0x704] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x3d]) !== 7) data[p + 0x705] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x3e]) !== 7) data[p + 0x706] = BGCOLOR[idx | px];
		if ((px = this.bg2[q | 0x3f]) !== 7) data[p + 0x707] = BGCOLOR[idx | px];
	}

	xferHxW(data, src, color, y0, x0, h, w) {
		const y1 = y0 + h - 1 & 0x1ff, x1 = x0 - w + 1 & 0xff;
		let px;

		if ((y0 < 16 || y0 >= 304) && (y1 < 16 || y1 >= 304) || (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let y = y0, i = 0; i < h; y = y + 1 & 0x1ff, i++)
			for (let x = x0, j = w - 1; j >= 0; x = x - 1 & 0xff, --j)
				if ((px = this.obj[src + i * 32 + j]) !== 0xf)
					data[x | y << 8] = 0x100 | OBJCOLOR[color | px];
	}

	xferHxW_V(data, src, color, y0, x0, h, w) {
		const y1 = y0 + h - 1 & 0x1ff, x1 = x0 - w + 1 & 0xff;
		let px;

		if ((y0 < 16 || y0 >= 304) && (y1 < 16 || y1 >= 304) || (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let y = y1, i = 0; i < h; y = y - 1 & 0x1ff, i++)
			for (let x = x0, j = w - 1; j >= 0; x = x - 1 & 0xff, --j)
				if ((px = this.obj[src + i * 32 + j]) !== 0xf)
					data[x | y << 8] = 0x100 | OBJCOLOR[color | px];
	}

	xferHxW_H(data, src, color, y0, x0, h, w) {
		const y1 = y0 + h - 1 & 0x1ff, x1 = x0 - w + 1 & 0xff;
		let px;

		if ((y0 < 16 || y0 >= 304) && (y1 < 16 || y1 >= 304) || (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let y = y0, i = 0; i < h; y = y + 1 & 0x1ff, i++)
			for (let x = x1, j = w - 1; j >= 0; x = x + 1 & 0xff, --j)
				if ((px = this.obj[src + i * 32 + j]) !== 0xf)
					data[x | y << 8] = 0x100 | OBJCOLOR[color | px];
	}

	xferHxW_HV(data, src, color, y0, x0, h, w) {
		const y1 = y0 + h - 1 & 0x1ff, x1 = x0 - w + 1 & 0xff;
		let px;

		if ((y0 < 16 || y0 >= 304) && (y1 < 16 || y1 >= 304) || (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let y = y1, i = 0; i < h; y = y - 1 & 0x1ff, i++)
			for (let x = x1, j = w - 1; j >= 0; x = x + 1 & 0xff, --j)
				if ((px = this.obj[src + i * 32 + j]) !== 0xf)
					data[x | y << 8] = 0x100 | OBJCOLOR[color | px];
	}
}

/*
 *
 *	Sky Kid Deluxe
 *
 */

const url = 'skykiddx.zip';
let PRG1, PRG2, BG1, BG2, OBJ, RED, BLUE, BGCOLOR, OBJCOLOR, BGADDR, PRG3, PRG3I;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG1 = new Uint8Array((zip.files['sk3_2.9d'].inflate() + zip.files['sk3_1b.9c'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	PRG2 = new Uint8Array(zip.files['sk3_3.12c'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	BG1 = new Uint8Array((zip.files['sk3_9.7r'].inflate() + zip.files['sk3_10.7s'].inflate()).split('').map(c => c.charCodeAt(0)));
	BG2 = new Uint8Array((zip.files['sk3_7.4r'].inflate() + zip.files['sk3_8.4s'].inflate()).split('').map(c => c.charCodeAt(0)));
	OBJ = new Uint8Array((zip.files['sk3_5.12h'].inflate() + zip.files['sk3_6.12k'].inflate()).split('').map(c => c.charCodeAt(0)));
	RED = new Uint8Array(zip.files['sk3-1.3r'].inflate().split('').map(c => c.charCodeAt(0)));
	BLUE = new Uint8Array(zip.files['sk3-2.3s'].inflate().split('').map(c => c.charCodeAt(0)));
	BGCOLOR = new Uint8Array(zip.files['sk3-3.4v'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJCOLOR = new Uint8Array(zip.files['sk3-4.5v'].inflate().split('').map(c => c.charCodeAt(0)));
	BGADDR = new Uint8Array(zip.files['sk3-5.6u'].inflate().split('').map(c => c.charCodeAt(0)));
	PRG3 = new Uint8Array(zip.files['sk3_4.6b'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	PRG3I = new Uint8Array(zip.files['cus60-60a1.mcu'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	init({
		game: new SkyKidDeluxe(),
		sound: sound = [
			new YM2151({clock: 3579580}),
			new C30(),
		],
		rotate: true,
	});
	loop();
}

