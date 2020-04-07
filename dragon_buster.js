/*
 *
 *	Dragon Buster
 *
 */

import C30 from './c30.js';
import {init, loop} from './main.js';
import MC6809 from './mc6809.js';
import MC6801 from './mc6801.js';
let sound;

class DragonBuster {
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
		this.fContinue = false;
		this.fAttract = true;
		this.fSkip = false;

		// CPU周りの初期化
		this.fInterruptEnable0 = false;
		this.fInterruptEnable1 = false;
		this.bank = 0x80;

		this.ram = new Uint8Array(0x3000).addBase();
		this.ram2 = new Uint8Array(0x900).addBase();
		this.in = new Uint8Array(8).fill(0xff);
		this.select = 0;

		this.cpu = new MC6809(this);
		for (let i = 0; i < 0x20; i++)
			this.cpu.memorymap[i].base = PRG1.base[0x80 + i];
		for (let i = 0; i < 0x10; i++) {
			this.cpu.memorymap[0x20 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x20 + i].write = null;
		}
		for (let i = 0; i < 0x20; i++) {
			this.cpu.memorymap[0x40 + i].base = this.ram.base[0x10 + i];
			this.cpu.memorymap[0x40 + i].write = null;
		}
		this.cpu.memorymap[0x60].write = addr => this.hScroll = addr & 0xff;
		for (let i = 0; i < 2; i++)
			this.cpu.memorymap[0x62 + i].write = addr => this.vScroll = addr & 0x1ff;
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0x68 + i].read = addr => sound.read(addr);
			this.cpu.memorymap[0x68 + i].write = (addr, data) => sound.write(addr, data);
		}
		for (let i = 0; i < 0x10; i++)
			this.cpu.memorymap[0x70 + i].write = addr => this.fInterruptEnable0 = (addr & 0x800) === 0;
		for (let i = 0; i < 0x80; i++)
			this.cpu.memorymap[0x80 + i].base = PRG1.base[i];
		for (let i = 0; i < 0x10; i++)
			this.cpu.memorymap[0x80 + i].write = addr => (addr & 0x800) === 0 ? this.mcu.enable() : this.mcu.disable();
		for (let i = 0; i < 0x10; i++)
			this.cpu.memorymap[0x90 + i].write = addr => {
				const bank = ~addr >> 6 & 0x20 | 0x80;
				if (bank === this.bank)
					return;
				for (let i = 0; i < 0x20; i++)
					this.cpu.memorymap[i].base = PRG1.base[bank + i];
				this.bank = bank;
			};
		this.cpu.memorymap[0xa0].write = (addr, data) => {
			if ((addr & 0xfe) !== 0)
				return;
			this.priority = data;
			this.fFlip = (addr & 1) !== 0;
		};

		this.mcu = new MC6801(this);
		this.mcu.memorymap[0].read = addr => addr === 2 ? this.in[this.select] : this.ram2[addr];
		this.mcu.memorymap[0].write = (addr, data) => {
			if (addr === 2 && (data & 0xe0) === 0x60)
				this.select = data & 7;
			this.ram2[addr] = data;
		};
		for (let i = 0; i < 4; i++) {
			this.mcu.memorymap[0x10 + i].read = addr => sound.read(addr);
			this.mcu.memorymap[0x10 + i].write = (addr, data) => sound.write(addr, data);
		}
		for (let i = 0; i < 0x40; i++)
			this.mcu.memorymap[0x40 + i].write = addr => this.fInterruptEnable1 = (addr & 0x2000) === 0;
		for (let i = 0; i < 0x20; i++)
			this.mcu.memorymap[0x80 + i].base = PRG2.base[i];
		for (let i = 0; i < 8; i++) {
			this.mcu.memorymap[0xc0 + i].base = this.ram2.base[1 + i];
			this.mcu.memorymap[0xc0 + i].write = null;
		}
		for (let i = 0; i < 0x10; i++)
			this.mcu.memorymap[0xf0 + i].base = PRG2I.base[i];

		// Videoの初期化
		this.fg = new Uint8Array(0x8000);
		this.bg = new Uint8Array(0x8000);
		this.obj = new Uint8Array(0x20000);
		this.rgb = new Uint32Array(0x100);
		this.priority = 0;
		this.vScroll = 0;
		this.hScroll = 0;
		this.fFlip = false;
		this.convertRGB();
		this.convertFG();
		this.convertBG();
		this.convertOBJ();
	}

	execute() {
		if (this.fInterruptEnable0)
			this.cpu.interrupt();
		if (this.fInterruptEnable1)
			this.mcu.interrupt();
		for (let i = 0; i < 800; i++) {
			this.cpu.execute(5);
			this.mcu.execute(6);
		}
		if ((this.ram2[8] & 8) !== 0)
			this.mcu.interrupt('ocf');
		for (let i = 0; i < 800; i++) {
			this.cpu.execute(5);
			this.mcu.execute(6);
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
			if (this.fContinue)
				this.in[1] &= ~4;
			else
				this.in[1] |= 4;
			if (this.fAttract)
				this.in[2] |= 8;
			else
				this.in[2] &= ~8;
			if (this.fSkip)
				this.in[2] &= ~4;
			else
				this.in[2] |= 4;
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.in[1] &= ~2;
		else
			this.in[1] |= 2;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu.reset();
			this.mcu.disable();
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if (this.fCoin) {
			--this.fCoin;
			this.in[4] &= ~(1 << 0);
		}
		else
			this.in[4] |= 1 << 0;
		if (this.fStart1P) {
			--this.fStart1P;
			this.in[4] &= ~(1 << 3);
		}
		else
			this.in[4] |= 1 << 3;
		if (this.fStart2P) {
			--this.fStart2P;
			this.in[4] &= ~(1 << 4);
		}
		else
			this.in[4] |= 1 << 4;
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
			this.in[6] = this.in[6] & ~(1 << 3) | 1 << 2;
		else
			this.in[6] |= 1 << 3;
	}

	right(fDown) {
		if (fDown)
			this.in[6] = this.in[6] & ~(1 << 1) | 1 << 0;
		else
			this.in[6] |= 1 << 1;
	}

	down(fDown) {
		if (fDown)
			this.in[6] = this.in[6] & ~(1 << 2) | 1 << 3;
		else
			this.in[6] |= 1 << 2;
	}

	left(fDown) {
		if (fDown)
			this.in[6] = this.in[6] & ~(1 << 0) | 1 << 1;
		else
			this.in[6] |= 1 << 0;
	}

	triggerA(fDown) {
		if (fDown)
			this.in[6] &= ~(1 << 4);
		else
			this.in[6] |= 1 << 4;
	}

	triggerB(fDown) {
		if (fDown)
			this.in[3] &= ~(1 << 3);
		else
			this.in[3] |= 1 << 3;
	}

	convertRGB() {
		for (let i = 0; i < 0x100; i++)
			this.rgb[i] = (RED[i] & 0xf) * 255 / 15	// Red
				| (GREEN[i] & 0xf) * 255 / 15 << 8	// Green
				| (BLUE[i] & 0xf) * 255 / 15 << 16	// Blue
				| 0xff000000;						// Alpha
	}

	convertFG() {
		for (let p = 0, q = 0, i = 512; i !== 0; q += 16, --i) {
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.fg[p++] = FG[q + k + 8] >> j & 1 | FG[q + k + 8] >> (j + 3) & 2;
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.fg[p++] = FG[q + k] >> j & 1 | FG[q + k] >> (j + 3) & 2;
		}
	}

	convertBG() {
		for (let p = 0, q = 0, i = 512; i !== 0; q += 16, --i) {
			for (let j = 3; j >= 0; --j)
				for (let k = 14; k >= 0; k -= 2)
					this.bg[p++] = BG[q + k] >> j & 1 | BG[q + k] >> (j + 3) & 2;
			for (let j = 3; j >= 0; --j)
				for (let k = 14; k >= 0; k -= 2)
					this.bg[p++] = BG[q + k + 1] >> j & 1 | BG[q + k + 1] >> (j + 3) & 2;
		}
	}

	convertOBJ() {
		for (let p = 0, q = 0, i = 128; i !== 0; q += 64, --i) {
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 32] >> j & 1 | OBJ[q + k + 32] >> (j + 3) & 2 | OBJ[q + k + 0x4000 + 32] << 2 >> j & 4;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k] >> j & 1 | OBJ[q + k] >> (j + 3) & 2 | OBJ[q + k + 0x4000] << 2 >> j & 4;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 40] >> j & 1 | OBJ[q + k + 40] >> (j + 3) & 2 | OBJ[q + k + 0x4000 + 40] << 2 >> j & 4;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 8] >> j & 1 | OBJ[q + k + 8] >> (j + 3) & 2 | OBJ[q + k + 0x4000 + 8] << 2 >> j & 4;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 48] >> j & 1 | OBJ[q + k + 48] >> (j + 3) & 2 | OBJ[q + k + 0x4000 + 48] << 2 >> j & 4;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 16] >> j & 1 | OBJ[q + k + 16] >> (j + 3) & 2 | OBJ[q + k + 0x4000 + 16] << 2 >> j & 4;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 56] >> j & 1 | OBJ[q + k + 56] >> (j + 3) & 2 | OBJ[q + k + 0x4000 + 56] << 2 >> j & 4;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 24] >> j & 1 | OBJ[q + k + 24] >> (j + 3) & 2 | OBJ[q + k + 0x4000 + 24] << 2 >> j & 4;
			}
		}
		for (let p = 0x8000, q = 0x2000, i = 128; i !== 0; q += 64, --i) {
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 32] >> j & 1 | OBJ[q + k + 32] >> (j + 3) & 2 | OBJ[q + k + 0x2000 + 32] >> (j + 2) & 4;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k] >> j & 1 | OBJ[q + k] >> (j + 3) & 2 | OBJ[q + k + 0x2000] >> (j + 2) & 4;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 40] >> j & 1 | OBJ[q + k + 40] >> (j + 3) & 2 | OBJ[q + k + 0x2000 + 40] >> (j + 2) & 4;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 8] >> j & 1 | OBJ[q + k + 8] >> (j + 3) & 2 | OBJ[q + k + 0x2000 + 8] >> (j + 2) & 4;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 48] >> j & 1 | OBJ[q + k + 48] >> (j + 3) & 2 | OBJ[q + k + 0x2000 + 48] >> (j + 2) & 4;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 16] >> j & 1 | OBJ[q + k + 16] >> (j + 3) & 2 | OBJ[q + k + 0x2000 + 16] >> (j + 2) & 4;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 56] >> j & 1 | OBJ[q + k + 56] >> (j + 3) & 2 | OBJ[q + k + 0x2000 + 56] >> (j + 2) & 4;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 24] >> j & 1 | OBJ[q + k + 24] >> (j + 3) & 2 | OBJ[q + k + 0x2000 + 24] >> (j + 2) & 4;
			}
		}
		for (let p = 0x10000, q = 0x6000, i = 128; i !== 0; q += 64, --i) {
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
		this.obj.fill(3, 0x18000);
	}

	makeBitmap(data) {
		// bg描画
		let p = 256 * 8 * 2 + 232 + (this.fFlip ? (7 - this.hScroll & 7) - (4 - this.vScroll & 7) * 256 : (1 + this.hScroll & 7) - (3 + this.vScroll & 7) * 256);
		let k = this.fFlip ? 7 - this.hScroll << 3 & 0x7c0 | (4 - this.vScroll >> 3) + 23 & 0x3f : 0x18 + 1 + this.hScroll << 3 & 0x7c0 | (3 + this.vScroll >> 3) + 4 & 0x3f;
		for (let i = 0; i < 29; k = k + 27 & 0x3f | k + 0x40 & 0x7c0, p -= 256 * 8 * 37 + 8, i++)
			for (let j = 0; j < 37; k = k + 1 & 0x3f | k & 0x7c0, p += 256 * 8, j++)
				this.xfer8x8b(data, p, k);

		// fg描画
		if ((this.priority & 4) !== 0) {
			p = 256 * 8 * 4 + 232;
			k = 0x1040;
			for (let i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
				for (let j = 0; j < 32; k++, p += 256 * 8, j++)
					if (((this.ram[k] ^ this.priority) & 0xf0) === 0)
						this.xfer8x8f(data, p, k);
			p = 256 * 8 * 36 + 232;
			k = 0x1002;
			for (let i = 0; i < 28; p -= 8, k++, i++)
				if (((this.ram[k] ^ this.priority) & 0xf0) === 0)
					this.xfer8x8f(data, p, k);
			p = 256 * 8 * 37 + 232;
			k = 0x1022;
			for (let i = 0; i < 28; p -= 8, k++, i++)
				if (((this.ram[k] ^ this.priority) & 0xf0) === 0)
					this.xfer8x8f(data, p, k);
			p = 256 * 8 * 2 + 232;
			k = 0x13c2;
			for (let i = 0; i < 28; p -= 8, k++, i++)
				if (((this.ram[k] ^ this.priority) & 0xf0) === 0)
					this.xfer8x8f(data, p, k);
			p = 256 * 8 * 3 + 232;
			k = 0x13e2;
			for (let i = 0; i < 28; p -= 8, k++, i++)
				if (((this.ram[k] ^ this.priority) & 0xf0) === 0)
					this.xfer8x8f(data, p, k);
		}

		// obj描画
		if (this.fFlip) {
			for (let k = 0x1f80, i = 64; i !== 0; k += 2, --i) {
				const x = 0xe9 - this.ram[k + 0x800] & 0xff;
				const y = 0x169 - this.ram[k + 0x801] - this.ram[k + 0x1001] * 0x100 & 0x1ff;
				const src = this.ram[k] | this.ram[k + 0x1000] << 1 & 0x100 | this.ram[k + 1] << 9;
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
					this.xfer16x16(data, x | y << 8, src | 1);
					this.xfer16x16(data, x | (y - 16 & 0x1ff) << 8, src & ~1);
					break;
				case 0x05: // V反転
					this.xfer16x16V(data, x | y << 8, src & ~1);
					this.xfer16x16V(data, x | (y - 16 & 0x1ff) << 8, src | 1);
					break;
				case 0x06: // H反転
					this.xfer16x16H(data, x | y << 8, src | 1);
					this.xfer16x16H(data, x | (y - 16 & 0x1ff) << 8, src & ~1);
					break;
				case 0x07: // HV反転
					this.xfer16x16HV(data, x | y << 8, src & ~1);
					this.xfer16x16HV(data, x | (y - 16 & 0x1ff) << 8, src | 1);
					break;
				case 0x08: // ノーマル
					this.xfer16x16(data, x | y << 8, src & ~2);
					this.xfer16x16(data, x - 16 & 0xff | y << 8, src | 2);
					break;
				case 0x09: // V反転
					this.xfer16x16V(data, x | y << 8, src & ~2);
					this.xfer16x16V(data, x - 16 & 0xff | y << 8, src | 2);
					break;
				case 0x0a: // H反転
					this.xfer16x16H(data, x | y << 8, src | 2);
					this.xfer16x16H(data, x - 16 & 0xff | y << 8, src & ~2);
					break;
				case 0x0b: // HV反転
					this.xfer16x16HV(data, x | y << 8, src | 2);
					this.xfer16x16HV(data, x - 16 & 0xff | y << 8, src & ~2);
					break;
				case 0x0c: // ノーマル
					this.xfer16x16(data, x | y << 8, src & ~3 | 1);
					this.xfer16x16(data, x | (y - 16 & 0x1ff) << 8, src & ~3);
					this.xfer16x16(data, x - 16 & 0xff | y << 8, src | 3);
					this.xfer16x16(data, x - 16 & 0xff | (y - 16 & 0x1ff) << 8, src & ~3 | 2);
					break;
				case 0x0d: // V反転
					this.xfer16x16V(data, x | y << 8, src & ~3);
					this.xfer16x16V(data, x | (y - 16 & 0x1ff) << 8, src & ~3 | 1);
					this.xfer16x16V(data, x - 16 & 0xff | y << 8, src & ~3 | 2);
					this.xfer16x16V(data, x - 16 & 0xff | (y - 16 & 0x1ff) << 8, src | 3);
					break;
				case 0x0e: // H反転
					this.xfer16x16H(data, x | y << 8, src | 3);
					this.xfer16x16H(data, x | (y - 16 & 0x1ff) << 8, src & ~3 | 2);
					this.xfer16x16H(data, x - 16 & 0xff | y << 8, src & ~3 | 1);
					this.xfer16x16H(data, x - 16 & 0xff | (y - 16 & 0x1ff) << 8, src & ~3);
					break;
				case 0x0f: // HV反転
					this.xfer16x16HV(data, x | y << 8, src & ~3 | 2);
					this.xfer16x16HV(data, x | (y - 16 & 0x1ff) << 8, src | 3);
					this.xfer16x16HV(data, x - 16 & 0xff | y << 8, src & ~3);
					this.xfer16x16HV(data, x - 16 & 0xff | (y - 16 & 0x1ff) << 8, src & ~3 | 1);
					break;
				}
			}
		}
		else {
			for (let k = 0x1f80, i = 64; i !== 0; k += 2, --i) {
				const x = this.ram[k + 0x800] + 7 & 0xff;
				const y = (this.ram[k + 0x801] | this.ram[k + 0x1001] << 8) - 55 & 0x1ff;
				const src = this.ram[k] | this.ram[k + 0x1000] << 1 & 0x100 | this.ram[k + 1] << 9;
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
		}

		// fg描画
		p = 256 * 8 * 4 + 232;
		k = 0x1040;
		for (let i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				if ((this.priority & 4) === 0 || ((this.ram[k] ^ this.priority) & 0xf0) !== 0)
					this.xfer8x8f(data, p, k);
		p = 256 * 8 * 36 + 232;
		k = 0x1002;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			if ((this.priority & 4) === 0 || ((this.ram[k] ^ this.priority) & 0xf0) !== 0)
				this.xfer8x8f(data, p, k);
		p = 256 * 8 * 37 + 232;
		k = 0x1022;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			if ((this.priority & 4) === 0 || ((this.ram[k] ^ this.priority) & 0xf0) !== 0)
				this.xfer8x8f(data, p, k);
		p = 256 * 8 * 2 + 232;
		k = 0x13c2;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			if ((this.priority & 4) === 0 || ((this.ram[k] ^ this.priority) & 0xf0) !== 0)
				this.xfer8x8f(data, p, k);
		p = 256 * 8 * 3 + 232;
		k = 0x13e2;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			if ((this.priority & 4) === 0 || ((this.ram[k] ^ this.priority) & 0xf0) !== 0)
				this.xfer8x8f(data, p, k);

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] = this.rgb[data[p]];
	}

	xfer8x8f(data, p, k) {
		const q = this.ram[k] << 6, idx = this.ram[k + 0x400] << 2 & 0xfc;
		let px;

		if ((px = this.fg[q | 0x00]) !== 0) data[p + 0x000] = idx | px;
		if ((px = this.fg[q | 0x01]) !== 0) data[p + 0x001] = idx | px;
		if ((px = this.fg[q | 0x02]) !== 0) data[p + 0x002] = idx | px;
		if ((px = this.fg[q | 0x03]) !== 0) data[p + 0x003] = idx | px;
		if ((px = this.fg[q | 0x04]) !== 0) data[p + 0x004] = idx | px;
		if ((px = this.fg[q | 0x05]) !== 0) data[p + 0x005] = idx | px;
		if ((px = this.fg[q | 0x06]) !== 0) data[p + 0x006] = idx | px;
		if ((px = this.fg[q | 0x07]) !== 0) data[p + 0x007] = idx | px;
		if ((px = this.fg[q | 0x08]) !== 0) data[p + 0x100] = idx | px;
		if ((px = this.fg[q | 0x09]) !== 0) data[p + 0x101] = idx | px;
		if ((px = this.fg[q | 0x0a]) !== 0) data[p + 0x102] = idx | px;
		if ((px = this.fg[q | 0x0b]) !== 0) data[p + 0x103] = idx | px;
		if ((px = this.fg[q | 0x0c]) !== 0) data[p + 0x104] = idx | px;
		if ((px = this.fg[q | 0x0d]) !== 0) data[p + 0x105] = idx | px;
		if ((px = this.fg[q | 0x0e]) !== 0) data[p + 0x106] = idx | px;
		if ((px = this.fg[q | 0x0f]) !== 0) data[p + 0x107] = idx | px;
		if ((px = this.fg[q | 0x10]) !== 0) data[p + 0x200] = idx | px;
		if ((px = this.fg[q | 0x11]) !== 0) data[p + 0x201] = idx | px;
		if ((px = this.fg[q | 0x12]) !== 0) data[p + 0x202] = idx | px;
		if ((px = this.fg[q | 0x13]) !== 0) data[p + 0x203] = idx | px;
		if ((px = this.fg[q | 0x14]) !== 0) data[p + 0x204] = idx | px;
		if ((px = this.fg[q | 0x15]) !== 0) data[p + 0x205] = idx | px;
		if ((px = this.fg[q | 0x16]) !== 0) data[p + 0x206] = idx | px;
		if ((px = this.fg[q | 0x17]) !== 0) data[p + 0x207] = idx | px;
		if ((px = this.fg[q | 0x18]) !== 0) data[p + 0x300] = idx | px;
		if ((px = this.fg[q | 0x19]) !== 0) data[p + 0x301] = idx | px;
		if ((px = this.fg[q | 0x1a]) !== 0) data[p + 0x302] = idx | px;
		if ((px = this.fg[q | 0x1b]) !== 0) data[p + 0x303] = idx | px;
		if ((px = this.fg[q | 0x1c]) !== 0) data[p + 0x304] = idx | px;
		if ((px = this.fg[q | 0x1d]) !== 0) data[p + 0x305] = idx | px;
		if ((px = this.fg[q | 0x1e]) !== 0) data[p + 0x306] = idx | px;
		if ((px = this.fg[q | 0x1f]) !== 0) data[p + 0x307] = idx | px;
		if ((px = this.fg[q | 0x20]) !== 0) data[p + 0x400] = idx | px;
		if ((px = this.fg[q | 0x21]) !== 0) data[p + 0x401] = idx | px;
		if ((px = this.fg[q | 0x22]) !== 0) data[p + 0x402] = idx | px;
		if ((px = this.fg[q | 0x23]) !== 0) data[p + 0x403] = idx | px;
		if ((px = this.fg[q | 0x24]) !== 0) data[p + 0x404] = idx | px;
		if ((px = this.fg[q | 0x25]) !== 0) data[p + 0x405] = idx | px;
		if ((px = this.fg[q | 0x26]) !== 0) data[p + 0x406] = idx | px;
		if ((px = this.fg[q | 0x27]) !== 0) data[p + 0x407] = idx | px;
		if ((px = this.fg[q | 0x28]) !== 0) data[p + 0x500] = idx | px;
		if ((px = this.fg[q | 0x29]) !== 0) data[p + 0x501] = idx | px;
		if ((px = this.fg[q | 0x2a]) !== 0) data[p + 0x502] = idx | px;
		if ((px = this.fg[q | 0x2b]) !== 0) data[p + 0x503] = idx | px;
		if ((px = this.fg[q | 0x2c]) !== 0) data[p + 0x504] = idx | px;
		if ((px = this.fg[q | 0x2d]) !== 0) data[p + 0x505] = idx | px;
		if ((px = this.fg[q | 0x2e]) !== 0) data[p + 0x506] = idx | px;
		if ((px = this.fg[q | 0x2f]) !== 0) data[p + 0x507] = idx | px;
		if ((px = this.fg[q | 0x30]) !== 0) data[p + 0x600] = idx | px;
		if ((px = this.fg[q | 0x31]) !== 0) data[p + 0x601] = idx | px;
		if ((px = this.fg[q | 0x32]) !== 0) data[p + 0x602] = idx | px;
		if ((px = this.fg[q | 0x33]) !== 0) data[p + 0x603] = idx | px;
		if ((px = this.fg[q | 0x34]) !== 0) data[p + 0x604] = idx | px;
		if ((px = this.fg[q | 0x35]) !== 0) data[p + 0x605] = idx | px;
		if ((px = this.fg[q | 0x36]) !== 0) data[p + 0x606] = idx | px;
		if ((px = this.fg[q | 0x37]) !== 0) data[p + 0x607] = idx | px;
		if ((px = this.fg[q | 0x38]) !== 0) data[p + 0x700] = idx | px;
		if ((px = this.fg[q | 0x39]) !== 0) data[p + 0x701] = idx | px;
		if ((px = this.fg[q | 0x3a]) !== 0) data[p + 0x702] = idx | px;
		if ((px = this.fg[q | 0x3b]) !== 0) data[p + 0x703] = idx | px;
		if ((px = this.fg[q | 0x3c]) !== 0) data[p + 0x704] = idx | px;
		if ((px = this.fg[q | 0x3d]) !== 0) data[p + 0x705] = idx | px;
		if ((px = this.fg[q | 0x3e]) !== 0) data[p + 0x706] = idx | px;
		if ((px = this.fg[q | 0x3f]) !== 0) data[p + 0x707] = idx | px;
	}

	xfer8x8b(data, p, k) {
		const q = (this.ram[k] | this.ram[k + 0x800] << 8) << 6 & 0x7fc0;
		const idx = this.ram[k + 0x800] << 1 & 0xfc | this.ram[k + 0x800] << 8 & 0x100;

		data[p + 0x000] = BGCOLOR[idx | this.bg[q | 0x00]];
		data[p + 0x001] = BGCOLOR[idx | this.bg[q | 0x01]];
		data[p + 0x002] = BGCOLOR[idx | this.bg[q | 0x02]];
		data[p + 0x003] = BGCOLOR[idx | this.bg[q | 0x03]];
		data[p + 0x004] = BGCOLOR[idx | this.bg[q | 0x04]];
		data[p + 0x005] = BGCOLOR[idx | this.bg[q | 0x05]];
		data[p + 0x006] = BGCOLOR[idx | this.bg[q | 0x06]];
		data[p + 0x007] = BGCOLOR[idx | this.bg[q | 0x07]];
		data[p + 0x100] = BGCOLOR[idx | this.bg[q | 0x08]];
		data[p + 0x101] = BGCOLOR[idx | this.bg[q | 0x09]];
		data[p + 0x102] = BGCOLOR[idx | this.bg[q | 0x0a]];
		data[p + 0x103] = BGCOLOR[idx | this.bg[q | 0x0b]];
		data[p + 0x104] = BGCOLOR[idx | this.bg[q | 0x0c]];
		data[p + 0x105] = BGCOLOR[idx | this.bg[q | 0x0d]];
		data[p + 0x106] = BGCOLOR[idx | this.bg[q | 0x0e]];
		data[p + 0x107] = BGCOLOR[idx | this.bg[q | 0x0f]];
		data[p + 0x200] = BGCOLOR[idx | this.bg[q | 0x10]];
		data[p + 0x201] = BGCOLOR[idx | this.bg[q | 0x11]];
		data[p + 0x202] = BGCOLOR[idx | this.bg[q | 0x12]];
		data[p + 0x203] = BGCOLOR[idx | this.bg[q | 0x13]];
		data[p + 0x204] = BGCOLOR[idx | this.bg[q | 0x14]];
		data[p + 0x205] = BGCOLOR[idx | this.bg[q | 0x15]];
		data[p + 0x206] = BGCOLOR[idx | this.bg[q | 0x16]];
		data[p + 0x207] = BGCOLOR[idx | this.bg[q | 0x17]];
		data[p + 0x300] = BGCOLOR[idx | this.bg[q | 0x18]];
		data[p + 0x301] = BGCOLOR[idx | this.bg[q | 0x19]];
		data[p + 0x302] = BGCOLOR[idx | this.bg[q | 0x1a]];
		data[p + 0x303] = BGCOLOR[idx | this.bg[q | 0x1b]];
		data[p + 0x304] = BGCOLOR[idx | this.bg[q | 0x1c]];
		data[p + 0x305] = BGCOLOR[idx | this.bg[q | 0x1d]];
		data[p + 0x306] = BGCOLOR[idx | this.bg[q | 0x1e]];
		data[p + 0x307] = BGCOLOR[idx | this.bg[q | 0x1f]];
		data[p + 0x400] = BGCOLOR[idx | this.bg[q | 0x20]];
		data[p + 0x401] = BGCOLOR[idx | this.bg[q | 0x21]];
		data[p + 0x402] = BGCOLOR[idx | this.bg[q | 0x22]];
		data[p + 0x403] = BGCOLOR[idx | this.bg[q | 0x23]];
		data[p + 0x404] = BGCOLOR[idx | this.bg[q | 0x24]];
		data[p + 0x405] = BGCOLOR[idx | this.bg[q | 0x25]];
		data[p + 0x406] = BGCOLOR[idx | this.bg[q | 0x26]];
		data[p + 0x407] = BGCOLOR[idx | this.bg[q | 0x27]];
		data[p + 0x500] = BGCOLOR[idx | this.bg[q | 0x28]];
		data[p + 0x501] = BGCOLOR[idx | this.bg[q | 0x29]];
		data[p + 0x502] = BGCOLOR[idx | this.bg[q | 0x2a]];
		data[p + 0x503] = BGCOLOR[idx | this.bg[q | 0x2b]];
		data[p + 0x504] = BGCOLOR[idx | this.bg[q | 0x2c]];
		data[p + 0x505] = BGCOLOR[idx | this.bg[q | 0x2d]];
		data[p + 0x506] = BGCOLOR[idx | this.bg[q | 0x2e]];
		data[p + 0x507] = BGCOLOR[idx | this.bg[q | 0x2f]];
		data[p + 0x600] = BGCOLOR[idx | this.bg[q | 0x30]];
		data[p + 0x601] = BGCOLOR[idx | this.bg[q | 0x31]];
		data[p + 0x602] = BGCOLOR[idx | this.bg[q | 0x32]];
		data[p + 0x603] = BGCOLOR[idx | this.bg[q | 0x33]];
		data[p + 0x604] = BGCOLOR[idx | this.bg[q | 0x34]];
		data[p + 0x605] = BGCOLOR[idx | this.bg[q | 0x35]];
		data[p + 0x606] = BGCOLOR[idx | this.bg[q | 0x36]];
		data[p + 0x607] = BGCOLOR[idx | this.bg[q | 0x37]];
		data[p + 0x700] = BGCOLOR[idx | this.bg[q | 0x38]];
		data[p + 0x701] = BGCOLOR[idx | this.bg[q | 0x39]];
		data[p + 0x702] = BGCOLOR[idx | this.bg[q | 0x3a]];
		data[p + 0x703] = BGCOLOR[idx | this.bg[q | 0x3b]];
		data[p + 0x704] = BGCOLOR[idx | this.bg[q | 0x3c]];
		data[p + 0x705] = BGCOLOR[idx | this.bg[q | 0x3d]];
		data[p + 0x706] = BGCOLOR[idx | this.bg[q | 0x3e]];
		data[p + 0x707] = BGCOLOR[idx | this.bg[q | 0x3f]];
	}

	xfer16x16(data, dst, src) {
		const idx = src >> 6 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0x1ff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[src++]]) !== 0xff)
					data[dst] = px;
	}

	xfer16x16V(data, dst, src) {
		const idx = src >> 6 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x1ff00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[src++]]) !== 0xff)
					data[dst] = px;
	}

	xfer16x16H(data, dst, src) {
		const idx = src >> 6 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x1ff00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[--src]]) !== 0xff)
					data[dst] = px;
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >> 6 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x1ff00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[--src]]) !== 0xff)
					data[dst] = px;
	}
}

/*
 *
 *	Dragon Buster
 *
 */

const url = 'drgnbstr.zip';
let PRG1, PRG2, PRG2I, FG, BG, OBJ, RED, GREEN, BLUE, BGCOLOR, OBJCOLOR;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG1 = new Uint8Array((zip.files['db1_2b.6c'].inflate() + zip.files['db1_1.6b'].inflate() + zip.files['db1_3.6d'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	PRG2 = new Uint8Array(zip.files['db1_4.3c'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	PRG2I = new Uint8Array(zip.files['cus60-60a1.mcu'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	FG = new Uint8Array(zip.files['db1_6.6l'].inflate().split('').map(c => c.charCodeAt(0)));
	BG = new Uint8Array(zip.files['db1_5.7e'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJ = new Uint8Array((zip.files['db1_8.10n'].inflate() + zip.files['db1_7.10m'].inflate()).split('').map(c => c.charCodeAt(0)));
	RED = new Uint8Array(zip.files['db1-1.2n'].inflate().split('').map(c => c.charCodeAt(0)));
	GREEN = new Uint8Array(zip.files['db1-2.2p'].inflate().split('').map(c => c.charCodeAt(0)));
	BLUE = new Uint8Array(zip.files['db1-3.2r'].inflate().split('').map(c => c.charCodeAt(0)));
	BGCOLOR = new Uint8Array(zip.files['db1-4.5n'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJCOLOR = new Uint8Array(zip.files['db1-5.6n'].inflate().split('').map(c => c.charCodeAt(0)));
	init({
		game: new DragonBuster(),
		sound: sound = new C30(),
		rotate: true,
	});
	loop();
}

