/*
 *
 *	Metro-Cross
 *
 */

import C30 from './c30.js';
import {init, loop} from './main.js';
import MC6809 from './mc6809.js';
import MC6801 from './mc6801.js';
let sound;

class MetroCross {
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
		this.nRank = 'A';
		this.fContinue = true;
		this.fAttract = true;
		this.fSelect = false;

		// CPU周りの初期化
		this.ram = new Uint8Array(0x4800).addBase();
		this.ram2 = new Uint8Array(0x900).addBase();
		this.in = new Uint8Array(8).fill(0xff);
		this.select = 0;

		this.cpu = new MC6809(this);
		for (let i = 0; i < 0x40; i++) {
			this.cpu.memorymap[i].base = this.ram.base[i];
			this.cpu.memorymap[i].write = null;
		}
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0x40 + i].read = addr => sound.read(addr);
			this.cpu.memorymap[0x40 + i].write = (addr, data) => sound.write(addr, data);
		}
		for (let i = 0; i < 8; i++) {
			this.cpu.memorymap[0x48 + i].base = this.ram.base[0x40 + i];
			this.cpu.memorymap[0x48 + i].write = null;
		}
		for (let i = 0; i < 0xa0; i++)
			this.cpu.memorymap[0x60 + i].base = PRG1.base[i];
		this.cpu.memorymap[0x88].write = () => this.cpu.irq = false;
		this.cpu.memorymap[0xb0].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				this.vScroll[0] = this.vScroll[0] & 0xff | data << 8;
				break;
			case 1:
				this.vScroll[0] = this.vScroll[0] & 0xff00 | data;
				break;
			case 2:
				this.hScroll[0] = data;
				break;
			case 4:
				this.vScroll[1] = this.vScroll[1] & 0xff | data << 8;
				break;
			case 5:
				this.vScroll[1] = this.vScroll[1] & 0xff00 | data;
				break;
			case 6:
				this.hScroll[1] = data;
				break;
			}
		};

		this.cpu.check_interrupt = () => this.cpu.irq && this.cpu.interrupt();
		this.cpu.irq = false;

		this.mcu = new MC6801(this);
		this.mcu.memorymap[0].read = addr => {
			if (addr === 2)
				return this.in[this.select];
			return this.ram2[addr];
		};
		this.mcu.memorymap[0].write = (addr, data) => {
			if (addr === 2 && (data & 0xe0) === 0x60)
				this.select = data & 7;
			this.ram2[addr] = data;
		};
		for (let i = 0; i < 4; i++) {
			this.mcu.memorymap[0x10 + i].read = addr => sound.read(addr);
			this.mcu.memorymap[0x10 + i].write = (addr, data) => sound.write(addr, data);
		}
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
		this.bg = new Uint8Array(0x20000);
		this.obj = new Uint8Array(0x20000);
		this.rgb = new Uint32Array(0x800);
		this.vScroll = [0, 0];
		this.hScroll = [0, 0];
		this.convertRGB();
		this.convertFG();
		this.convertBG();
		this.convertOBJ();
	}

	execute() {
		this.cpu.irq = true;
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
			switch (this.nRank) {
			case 'A': // Normal
				this.in[0] |= 3;
				break;
			case 'B': // Easy
				this.in[0] = this.in[0] & ~3 | 2;
				break;
			case 'C': // Hard
				this.in[0] = this.in[0] & ~3 | 1;
				break;
			case 'D': // Very Hard
				this.in[0] &= ~3;
				break;
			}
			if (this.fContinue)
				this.in[1] |= 0x10;
			else
				this.in[1] &= ~0x10;
			if (this.fAttract)
				this.in[1] |= 2;
			else
				this.in[1] &= ~2;
			if (this.fSelect)
				this.in[1] &= ~1;
			else
				this.in[1] |= 1;
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.in[0] &= ~0x10;
		else
			this.in[0] |= 0x10;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu.irq = false;
			this.cpu.reset();
			this.mcu.reset();
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
			this.in[2] ^= 2; // Pause
	}

	convertRGB() {
		for (let i = 0; i < 0x800; i++)
			this.rgb[i] = (RED[i] & 0x0f) * 255 / 15	// Red
				| (GREEN[i] & 0x0f) * 255 / 15 << 8		// Green
				| (GREEN[i] >> 4) * 255 / 15 << 16		// Blue
				| 0xff000000;							// Alpha
	}

	convertFG() {
		for (let p = 0, q = 0, i = 512; i !== 0; q += 16, --i) {
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.fg[p++] = FG[q + k + 8] >>> j & 1 | FG[q + k + 8] >>> (j + 3) & 2;
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.fg[p++] = FG[q + k] >>> j & 1 | FG[q + k] >>> (j + 3) & 2;
		}
	}

	convertBG() {
		for (let p = 0, q = 0, i = 512; i !== 0; q += 16, --i) {
			for (let j = 3; j >= 0; --j)
				for (let k = 14; k >= 0; k -= 2)
					this.bg[p++] = BG[q + k] >>> j & 1 | BG[q + k] >>> (j + 3) & 2 | BG[q + k + 0x8000] >>> (j + 2) & 4;
			for (let j = 3; j >= 0; --j)
				for (let k = 14; k >= 0; k -= 2)
					this.bg[p++] = BG[q + k + 1] >>> j & 1 | BG[q + k + 1] >>> (j + 3) & 2 | BG[q + k + 0x8000 + 1] >>> (j + 2) & 4;
		}
		for (let p = 0x8000, q = 0x2000, i = 512; i !== 0; q += 16, --i) {
			for (let j = 3; j >= 0; --j)
				for (let k = 14; k >= 0; k -= 2)
					this.bg[p++] = BG[q + k] >>> j & 1 | BG[q + k] >>> (j + 3) & 2 | BG[q + k + 0x6000] >>> j << 2 & 4;
			for (let j = 3; j >= 0; --j)
				for (let k = 14; k >= 0; k -= 2)
					this.bg[p++] = BG[q + k + 1] >>> j & 1 | BG[q + k + 1] >>> (j + 3) & 2 | BG[q + k + 0x6000 + 1] >>> j << 2 & 4;
		}
		for (let p = 0x10000, q = 0x4000, i = 512; i !== 0; q += 16, --i) {
			for (let j = 3; j >= 0; --j)
				for (let k = 14; k >= 0; k -= 2)
					this.bg[p++] = BG[q + k] >>> j & 1 | BG[q + k] >>> (j + 3) & 2 | BG[q + k + 0x6000] >>> (j + 2) & 4;
			for (let j = 3; j >= 0; --j)
				for (let k = 14; k >= 0; k -= 2)
					this.bg[p++] = BG[q + k + 1] >>> j & 1 | BG[q + k + 1] >>> (j + 3) & 2 | BG[q + k + 0x6000 + 1] >>> (j + 2) & 4;
		}
		for (let p = 0x18000, q = 0x6000, i = 512; i !== 0; q += 16, --i) {
			for (let j = 3; j >= 0; --j)
				for (let k = 14; k >= 0; k -= 2)
					this.bg[p++] = BG[q + k] >>> j & 1 | BG[q + k] >>> (j + 3) & 2 | BG[q + k + 0x4000] >>> j << 2 & 4;
			for (let j = 3; j >= 0; --j)
				for (let k = 14; k >= 0; k -= 2)
					this.bg[p++] = BG[q + k + 1] >>> j & 1 | BG[q + k + 1] >>> (j + 3) & 2 | BG[q + k + 0x4000 + 1] >>> j << 2 & 4;
		}
	}

	convertOBJ() {
		for (let p = 0, q = 0, i = 256; i !== 0; q += 128, --i) {
			for (let k = 4; k >= 0; k -= 4)
				for (let l = 120; l >= 0; l -= 8)
					this.obj[p++] = OBJ[q + l] >>> k & 0x0f;
			for (let k = 4; k >= 0; k -= 4)
				for (let l = 120; l >= 0; l -= 8)
					this.obj[p++] = OBJ[q + l + 1] >>> k & 0x0f;
			for (let k = 4; k >= 0; k -= 4)
				for (let l = 120; l >= 0; l -= 8)
					this.obj[p++] = OBJ[q + l + 2] >>> k & 0x0f;
			for (let k = 4; k >= 0; k -= 4)
				for (let l = 120; l >= 0; l -= 8)
					this.obj[p++] = OBJ[q + l + 3] >>> k & 0x0f;
			for (let k = 4; k >= 0; k -= 4)
				for (let l = 120; l >= 0; l -= 8)
					this.obj[p++] = OBJ[q + l + 4] >>> k & 0x0f;
			for (let k = 4; k >= 0; k -= 4)
				for (let l = 120; l >= 0; l -= 8)
					this.obj[p++] = OBJ[q + l + 5] >>> k & 0x0f;
			for (let k = 4; k >= 0; k -= 4)
				for (let l = 120; l >= 0; l -= 8)
					this.obj[p++] = OBJ[q + l + 6] >>> k & 0x0f;
			for (let k = 4; k >= 0; k -= 4)
				for (let l = 120; l >= 0; l -= 8)
					this.obj[p++] = OBJ[q + l + 7] >>> k & 0x0f;
		}
		this.obj.fill(0x0f, 0x10000);
	}

	makeBitmap(data) {
		let p, k, back;

		// bg描画
		back = (this.vScroll[0] & 0xe00) === 0xc00 ? 1 : 0;
		p = 256 * 8 * 2 + 232 + (25 + this.hScroll[back] & 7) - (25 - back * 2 + this.vScroll[back] & 7) * 256;
		k = 0x2000 | back << 12 | 25 + this.hScroll[back] << 4 & 0xf80 | 25 - back * 2 + this.vScroll[back] >>> 2 & 0x7e;
		for (let i = 0; i < 29; k = k + 54 & 0x7e | k + 0x80 & 0xf80 | k & 0x3000, p -= 256 * 8 * 37 + 8, i++)
			for (let j = 0; j < 37; k = k + 2 & 0x7e | k & 0x3f80, p += 256 * 8, j++)
				this.xfer8x8b0(data, p, k, back);

		// obj描画
		this.drawObj(data, 0);

		// bg描画
		back ^= 1;
		p = 256 * 8 * 2 + 232 + (25 + this.hScroll[back] & 7) - (25 - back * 2 + this.vScroll[back] & 7) * 256;
		k = 0x2000 | back << 12 | 25 + this.hScroll[back] << 4 & 0xf80 | 25 - back * 2 + this.vScroll[back] >>> 2 & 0x7e;
		for (let i = 0; i < 29; k = k + 54 & 0x7e | k + 0x80 & 0xf80 | k & 0x3000, p -= 256 * 8 * 37 + 8, i++)
			for (let j = 0; j < 37; k = k + 2 & 0x7e | k & 0x3f80, p += 256 * 8, j++)
				this.xfer8x8b1(data, p, k, back);

		// obj描画
		this.drawObj(data, 1);

		// fg描画
		p = 256 * 8 * 4 + 232;
		k = 0x4040;
		for (let i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				this.xfer8x8f(data, p, k);
		p = 256 * 8 * 36 + 232;
		k = 0x4002;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8f(data, p, k);
		p = 256 * 8 * 37 + 232;
		k = 0x4022;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8f(data, p, k);
		p = 256 * 8 * 2 + 232;
		k = 0x43c2;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8f(data, p, k);
		p = 256 * 8 * 3 + 232;
		k = 0x43e2;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8f(data, p, k);

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] = this.rgb[data[p]];
	}

	drawObj(data, pri) {
		const ram = this.ram;

		for (let p = 0x1800, i = 127; i !== 0; p += 16, --i) {
			if ((ram[p + 4] & 1) !== pri)
				continue;
			const y = -54 + (ram[p + 7] | ram[p + 6] << 8 & 0x100) + (ram[0x1ff5] | ram[0x1ff4] << 8 & 0x100) & 0x1ff;
			const x = -1 + ram[p + 9] + ram[0x1ff7] & 0xff;
			const src = ram[p + 4] >> 4 & 1 | ram[p + 8] >> 3 & 2 | ram[p + 5] << 2 & 0x1fc | ram[p + 6] << 8 & 0xfe00;
			switch (ram[p + 8] & 5 | ram[p + 4] >> 4 & 0x0a) {
			case 0x00:
				this.xfer16x16(data, x | y << 8, src);
				break;
			case 0x01:
				this.xfer16x16H(data, x | y << 8, src);
				break;
			case 0x02:
				this.xfer16x16V(data, x | y << 8, src);
				break;
			case 0x03:
				this.xfer16x16HV(data, x | y << 8, src);
				break;
			case 0x04:
				this.xfer16x16(data, x | y << 8, src | 2);
				this.xfer16x16(data, x + 16 & 0xff | y << 8, src & ~2);
				break;
			case 0x05:
				this.xfer16x16H(data, x | y << 8, src & ~2);
				this.xfer16x16H(data, x + 16 & 0xff | y << 8, src | 2);
				break;
			case 0x06:
				this.xfer16x16V(data, x | y << 8, src | 2);
				this.xfer16x16V(data, x + 16 & 0xff | y << 8, src & ~2);
				break;
			case 0x07:
				this.xfer16x16HV(data, x | y << 8, src & ~2);
				this.xfer16x16HV(data, x + 16 & 0xff | y << 8, src | 2);
				break;
			case 0x08:
				this.xfer16x16(data, x | y << 8, src & ~1);
				this.xfer16x16(data, x | (y + 16 & 0x1ff) << 8, src | 1);
				break;
			case 0x09:
				this.xfer16x16H(data, x | y << 8, src & ~1);
				this.xfer16x16H(data, x | (y + 16 & 0x1ff) << 8, src | 1);
				break;
			case 0x0a:
				this.xfer16x16V(data, x | y << 8, src | 1);
				this.xfer16x16V(data, x | (y + 16 & 0x1ff) << 8, src & ~1);
				break;
			case 0x0b:
				this.xfer16x16HV(data, x | y << 8, src | 1);
				this.xfer16x16HV(data, x | (y + 16 & 0x1ff) << 8, src & ~1);
				break;
			case 0x0c:
				this.xfer16x16(data, x | y << 8, src & ~3 | 2);
				this.xfer16x16(data, x | (y + 16 & 0x1ff) << 8, src | 3);
				this.xfer16x16(data, x + 16 & 0xff | y << 8, src & ~3);
				this.xfer16x16(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3 | 1);
				break;
			case 0x0d:
				this.xfer16x16H(data, x | y << 8, src & ~3);
				this.xfer16x16H(data, x | (y + 16 & 0x1ff) << 8, src & ~3 | 1);
				this.xfer16x16H(data, x + 16 & 0xff | y << 8, src & ~3 | 2);
				this.xfer16x16H(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src | 3);
				break;
			case 0x0e:
				this.xfer16x16V(data, x | y << 8, src | 3);
				this.xfer16x16V(data, x | (y + 16 & 0x1ff) << 8, src & ~3 | 2);
				this.xfer16x16V(data, x + 16 & 0xff | y << 8, src & ~3 | 1);
				this.xfer16x16V(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3);
				break;
			case 0x0f:
				this.xfer16x16HV(data, x | y << 8, src & ~3 | 1);
				this.xfer16x16HV(data, x | (y + 16 & 0x1ff) << 8, src & ~3);
				this.xfer16x16HV(data, x + 16 & 0xff | y << 8, src | 3);
				this.xfer16x16HV(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3 | 2);
				break;
			}
		}
	}

	xfer8x8b0(data, p, k, back) {
		const q = (this.ram[k] | this.ram[k + 1] << 8 & 0x300 | back << 10) << 6;
		const idx = this.ram[k + 1] << 3;

		data[p + 0x000] = idx | this.bg[q | 0x00];
		data[p + 0x001] = idx | this.bg[q | 0x01];
		data[p + 0x002] = idx | this.bg[q | 0x02];
		data[p + 0x003] = idx | this.bg[q | 0x03];
		data[p + 0x004] = idx | this.bg[q | 0x04];
		data[p + 0x005] = idx | this.bg[q | 0x05];
		data[p + 0x006] = idx | this.bg[q | 0x06];
		data[p + 0x007] = idx | this.bg[q | 0x07];
		data[p + 0x100] = idx | this.bg[q | 0x08];
		data[p + 0x101] = idx | this.bg[q | 0x09];
		data[p + 0x102] = idx | this.bg[q | 0x0a];
		data[p + 0x103] = idx | this.bg[q | 0x0b];
		data[p + 0x104] = idx | this.bg[q | 0x0c];
		data[p + 0x105] = idx | this.bg[q | 0x0d];
		data[p + 0x106] = idx | this.bg[q | 0x0e];
		data[p + 0x107] = idx | this.bg[q | 0x0f];
		data[p + 0x200] = idx | this.bg[q | 0x10];
		data[p + 0x201] = idx | this.bg[q | 0x11];
		data[p + 0x202] = idx | this.bg[q | 0x12];
		data[p + 0x203] = idx | this.bg[q | 0x13];
		data[p + 0x204] = idx | this.bg[q | 0x14];
		data[p + 0x205] = idx | this.bg[q | 0x15];
		data[p + 0x206] = idx | this.bg[q | 0x16];
		data[p + 0x207] = idx | this.bg[q | 0x17];
		data[p + 0x300] = idx | this.bg[q | 0x18];
		data[p + 0x301] = idx | this.bg[q | 0x19];
		data[p + 0x302] = idx | this.bg[q | 0x1a];
		data[p + 0x303] = idx | this.bg[q | 0x1b];
		data[p + 0x304] = idx | this.bg[q | 0x1c];
		data[p + 0x305] = idx | this.bg[q | 0x1d];
		data[p + 0x306] = idx | this.bg[q | 0x1e];
		data[p + 0x307] = idx | this.bg[q | 0x1f];
		data[p + 0x400] = idx | this.bg[q | 0x20];
		data[p + 0x401] = idx | this.bg[q | 0x21];
		data[p + 0x402] = idx | this.bg[q | 0x22];
		data[p + 0x403] = idx | this.bg[q | 0x23];
		data[p + 0x404] = idx | this.bg[q | 0x24];
		data[p + 0x405] = idx | this.bg[q | 0x25];
		data[p + 0x406] = idx | this.bg[q | 0x26];
		data[p + 0x407] = idx | this.bg[q | 0x27];
		data[p + 0x500] = idx | this.bg[q | 0x28];
		data[p + 0x501] = idx | this.bg[q | 0x29];
		data[p + 0x502] = idx | this.bg[q | 0x2a];
		data[p + 0x503] = idx | this.bg[q | 0x2b];
		data[p + 0x504] = idx | this.bg[q | 0x2c];
		data[p + 0x505] = idx | this.bg[q | 0x2d];
		data[p + 0x506] = idx | this.bg[q | 0x2e];
		data[p + 0x507] = idx | this.bg[q | 0x2f];
		data[p + 0x600] = idx | this.bg[q | 0x30];
		data[p + 0x601] = idx | this.bg[q | 0x31];
		data[p + 0x602] = idx | this.bg[q | 0x32];
		data[p + 0x603] = idx | this.bg[q | 0x33];
		data[p + 0x604] = idx | this.bg[q | 0x34];
		data[p + 0x605] = idx | this.bg[q | 0x35];
		data[p + 0x606] = idx | this.bg[q | 0x36];
		data[p + 0x607] = idx | this.bg[q | 0x37];
		data[p + 0x700] = idx | this.bg[q | 0x38];
		data[p + 0x701] = idx | this.bg[q | 0x39];
		data[p + 0x702] = idx | this.bg[q | 0x3a];
		data[p + 0x703] = idx | this.bg[q | 0x3b];
		data[p + 0x704] = idx | this.bg[q | 0x3c];
		data[p + 0x705] = idx | this.bg[q | 0x3d];
		data[p + 0x706] = idx | this.bg[q | 0x3e];
		data[p + 0x707] = idx | this.bg[q | 0x3f];
	}

	xfer8x8b1(data, p, k, back) {
		const q = (this.ram[k] | this.ram[k + 1] << 8 & 0x300 | back << 10) << 6;
		const idx = this.ram[k + 1] << 3;
		let px;

		if ((px = this.bg[q | 0x00]) !== 7) data[p + 0x000] = idx | px;
		if ((px = this.bg[q | 0x01]) !== 7) data[p + 0x001] = idx | px;
		if ((px = this.bg[q | 0x02]) !== 7) data[p + 0x002] = idx | px;
		if ((px = this.bg[q | 0x03]) !== 7) data[p + 0x003] = idx | px;
		if ((px = this.bg[q | 0x04]) !== 7) data[p + 0x004] = idx | px;
		if ((px = this.bg[q | 0x05]) !== 7) data[p + 0x005] = idx | px;
		if ((px = this.bg[q | 0x06]) !== 7) data[p + 0x006] = idx | px;
		if ((px = this.bg[q | 0x07]) !== 7) data[p + 0x007] = idx | px;
		if ((px = this.bg[q | 0x08]) !== 7) data[p + 0x100] = idx | px;
		if ((px = this.bg[q | 0x09]) !== 7) data[p + 0x101] = idx | px;
		if ((px = this.bg[q | 0x0a]) !== 7) data[p + 0x102] = idx | px;
		if ((px = this.bg[q | 0x0b]) !== 7) data[p + 0x103] = idx | px;
		if ((px = this.bg[q | 0x0c]) !== 7) data[p + 0x104] = idx | px;
		if ((px = this.bg[q | 0x0d]) !== 7) data[p + 0x105] = idx | px;
		if ((px = this.bg[q | 0x0e]) !== 7) data[p + 0x106] = idx | px;
		if ((px = this.bg[q | 0x0f]) !== 7) data[p + 0x107] = idx | px;
		if ((px = this.bg[q | 0x10]) !== 7) data[p + 0x200] = idx | px;
		if ((px = this.bg[q | 0x11]) !== 7) data[p + 0x201] = idx | px;
		if ((px = this.bg[q | 0x12]) !== 7) data[p + 0x202] = idx | px;
		if ((px = this.bg[q | 0x13]) !== 7) data[p + 0x203] = idx | px;
		if ((px = this.bg[q | 0x14]) !== 7) data[p + 0x204] = idx | px;
		if ((px = this.bg[q | 0x15]) !== 7) data[p + 0x205] = idx | px;
		if ((px = this.bg[q | 0x16]) !== 7) data[p + 0x206] = idx | px;
		if ((px = this.bg[q | 0x17]) !== 7) data[p + 0x207] = idx | px;
		if ((px = this.bg[q | 0x18]) !== 7) data[p + 0x300] = idx | px;
		if ((px = this.bg[q | 0x19]) !== 7) data[p + 0x301] = idx | px;
		if ((px = this.bg[q | 0x1a]) !== 7) data[p + 0x302] = idx | px;
		if ((px = this.bg[q | 0x1b]) !== 7) data[p + 0x303] = idx | px;
		if ((px = this.bg[q | 0x1c]) !== 7) data[p + 0x304] = idx | px;
		if ((px = this.bg[q | 0x1d]) !== 7) data[p + 0x305] = idx | px;
		if ((px = this.bg[q | 0x1e]) !== 7) data[p + 0x306] = idx | px;
		if ((px = this.bg[q | 0x1f]) !== 7) data[p + 0x307] = idx | px;
		if ((px = this.bg[q | 0x20]) !== 7) data[p + 0x400] = idx | px;
		if ((px = this.bg[q | 0x21]) !== 7) data[p + 0x401] = idx | px;
		if ((px = this.bg[q | 0x22]) !== 7) data[p + 0x402] = idx | px;
		if ((px = this.bg[q | 0x23]) !== 7) data[p + 0x403] = idx | px;
		if ((px = this.bg[q | 0x24]) !== 7) data[p + 0x404] = idx | px;
		if ((px = this.bg[q | 0x25]) !== 7) data[p + 0x405] = idx | px;
		if ((px = this.bg[q | 0x26]) !== 7) data[p + 0x406] = idx | px;
		if ((px = this.bg[q | 0x27]) !== 7) data[p + 0x407] = idx | px;
		if ((px = this.bg[q | 0x28]) !== 7) data[p + 0x500] = idx | px;
		if ((px = this.bg[q | 0x29]) !== 7) data[p + 0x501] = idx | px;
		if ((px = this.bg[q | 0x2a]) !== 7) data[p + 0x502] = idx | px;
		if ((px = this.bg[q | 0x2b]) !== 7) data[p + 0x503] = idx | px;
		if ((px = this.bg[q | 0x2c]) !== 7) data[p + 0x504] = idx | px;
		if ((px = this.bg[q | 0x2d]) !== 7) data[p + 0x505] = idx | px;
		if ((px = this.bg[q | 0x2e]) !== 7) data[p + 0x506] = idx | px;
		if ((px = this.bg[q | 0x2f]) !== 7) data[p + 0x507] = idx | px;
		if ((px = this.bg[q | 0x30]) !== 7) data[p + 0x600] = idx | px;
		if ((px = this.bg[q | 0x31]) !== 7) data[p + 0x601] = idx | px;
		if ((px = this.bg[q | 0x32]) !== 7) data[p + 0x602] = idx | px;
		if ((px = this.bg[q | 0x33]) !== 7) data[p + 0x603] = idx | px;
		if ((px = this.bg[q | 0x34]) !== 7) data[p + 0x604] = idx | px;
		if ((px = this.bg[q | 0x35]) !== 7) data[p + 0x605] = idx | px;
		if ((px = this.bg[q | 0x36]) !== 7) data[p + 0x606] = idx | px;
		if ((px = this.bg[q | 0x37]) !== 7) data[p + 0x607] = idx | px;
		if ((px = this.bg[q | 0x38]) !== 7) data[p + 0x700] = idx | px;
		if ((px = this.bg[q | 0x39]) !== 7) data[p + 0x701] = idx | px;
		if ((px = this.bg[q | 0x3a]) !== 7) data[p + 0x702] = idx | px;
		if ((px = this.bg[q | 0x3b]) !== 7) data[p + 0x703] = idx | px;
		if ((px = this.bg[q | 0x3c]) !== 7) data[p + 0x704] = idx | px;
		if ((px = this.bg[q | 0x3d]) !== 7) data[p + 0x705] = idx | px;
		if ((px = this.bg[q | 0x3e]) !== 7) data[p + 0x706] = idx | px;
		if ((px = this.bg[q | 0x3f]) !== 7) data[p + 0x707] = idx | px;
	}

	xfer8x8f(data, p, k) {
		const q = this.ram[k] << 6, idx = this.ram[k + 0x400] << 4 & 0x7f0;
		let px;

		if ((px = this.fg[q | 0x00]) !== 3) data[p + 0x000] = idx | px;
		if ((px = this.fg[q | 0x01]) !== 3) data[p + 0x001] = idx | px;
		if ((px = this.fg[q | 0x02]) !== 3) data[p + 0x002] = idx | px;
		if ((px = this.fg[q | 0x03]) !== 3) data[p + 0x003] = idx | px;
		if ((px = this.fg[q | 0x04]) !== 3) data[p + 0x004] = idx | px;
		if ((px = this.fg[q | 0x05]) !== 3) data[p + 0x005] = idx | px;
		if ((px = this.fg[q | 0x06]) !== 3) data[p + 0x006] = idx | px;
		if ((px = this.fg[q | 0x07]) !== 3) data[p + 0x007] = idx | px;
		if ((px = this.fg[q | 0x08]) !== 3) data[p + 0x100] = idx | px;
		if ((px = this.fg[q | 0x09]) !== 3) data[p + 0x101] = idx | px;
		if ((px = this.fg[q | 0x0a]) !== 3) data[p + 0x102] = idx | px;
		if ((px = this.fg[q | 0x0b]) !== 3) data[p + 0x103] = idx | px;
		if ((px = this.fg[q | 0x0c]) !== 3) data[p + 0x104] = idx | px;
		if ((px = this.fg[q | 0x0d]) !== 3) data[p + 0x105] = idx | px;
		if ((px = this.fg[q | 0x0e]) !== 3) data[p + 0x106] = idx | px;
		if ((px = this.fg[q | 0x0f]) !== 3) data[p + 0x107] = idx | px;
		if ((px = this.fg[q | 0x10]) !== 3) data[p + 0x200] = idx | px;
		if ((px = this.fg[q | 0x11]) !== 3) data[p + 0x201] = idx | px;
		if ((px = this.fg[q | 0x12]) !== 3) data[p + 0x202] = idx | px;
		if ((px = this.fg[q | 0x13]) !== 3) data[p + 0x203] = idx | px;
		if ((px = this.fg[q | 0x14]) !== 3) data[p + 0x204] = idx | px;
		if ((px = this.fg[q | 0x15]) !== 3) data[p + 0x205] = idx | px;
		if ((px = this.fg[q | 0x16]) !== 3) data[p + 0x206] = idx | px;
		if ((px = this.fg[q | 0x17]) !== 3) data[p + 0x207] = idx | px;
		if ((px = this.fg[q | 0x18]) !== 3) data[p + 0x300] = idx | px;
		if ((px = this.fg[q | 0x19]) !== 3) data[p + 0x301] = idx | px;
		if ((px = this.fg[q | 0x1a]) !== 3) data[p + 0x302] = idx | px;
		if ((px = this.fg[q | 0x1b]) !== 3) data[p + 0x303] = idx | px;
		if ((px = this.fg[q | 0x1c]) !== 3) data[p + 0x304] = idx | px;
		if ((px = this.fg[q | 0x1d]) !== 3) data[p + 0x305] = idx | px;
		if ((px = this.fg[q | 0x1e]) !== 3) data[p + 0x306] = idx | px;
		if ((px = this.fg[q | 0x1f]) !== 3) data[p + 0x307] = idx | px;
		if ((px = this.fg[q | 0x20]) !== 3) data[p + 0x400] = idx | px;
		if ((px = this.fg[q | 0x21]) !== 3) data[p + 0x401] = idx | px;
		if ((px = this.fg[q | 0x22]) !== 3) data[p + 0x402] = idx | px;
		if ((px = this.fg[q | 0x23]) !== 3) data[p + 0x403] = idx | px;
		if ((px = this.fg[q | 0x24]) !== 3) data[p + 0x404] = idx | px;
		if ((px = this.fg[q | 0x25]) !== 3) data[p + 0x405] = idx | px;
		if ((px = this.fg[q | 0x26]) !== 3) data[p + 0x406] = idx | px;
		if ((px = this.fg[q | 0x27]) !== 3) data[p + 0x407] = idx | px;
		if ((px = this.fg[q | 0x28]) !== 3) data[p + 0x500] = idx | px;
		if ((px = this.fg[q | 0x29]) !== 3) data[p + 0x501] = idx | px;
		if ((px = this.fg[q | 0x2a]) !== 3) data[p + 0x502] = idx | px;
		if ((px = this.fg[q | 0x2b]) !== 3) data[p + 0x503] = idx | px;
		if ((px = this.fg[q | 0x2c]) !== 3) data[p + 0x504] = idx | px;
		if ((px = this.fg[q | 0x2d]) !== 3) data[p + 0x505] = idx | px;
		if ((px = this.fg[q | 0x2e]) !== 3) data[p + 0x506] = idx | px;
		if ((px = this.fg[q | 0x2f]) !== 3) data[p + 0x507] = idx | px;
		if ((px = this.fg[q | 0x30]) !== 3) data[p + 0x600] = idx | px;
		if ((px = this.fg[q | 0x31]) !== 3) data[p + 0x601] = idx | px;
		if ((px = this.fg[q | 0x32]) !== 3) data[p + 0x602] = idx | px;
		if ((px = this.fg[q | 0x33]) !== 3) data[p + 0x603] = idx | px;
		if ((px = this.fg[q | 0x34]) !== 3) data[p + 0x604] = idx | px;
		if ((px = this.fg[q | 0x35]) !== 3) data[p + 0x605] = idx | px;
		if ((px = this.fg[q | 0x36]) !== 3) data[p + 0x606] = idx | px;
		if ((px = this.fg[q | 0x37]) !== 3) data[p + 0x607] = idx | px;
		if ((px = this.fg[q | 0x38]) !== 3) data[p + 0x700] = idx | px;
		if ((px = this.fg[q | 0x39]) !== 3) data[p + 0x701] = idx | px;
		if ((px = this.fg[q | 0x3a]) !== 3) data[p + 0x702] = idx | px;
		if ((px = this.fg[q | 0x3b]) !== 3) data[p + 0x703] = idx | px;
		if ((px = this.fg[q | 0x3c]) !== 3) data[p + 0x704] = idx | px;
		if ((px = this.fg[q | 0x3d]) !== 3) data[p + 0x705] = idx | px;
		if ((px = this.fg[q | 0x3e]) !== 3) data[p + 0x706] = idx | px;
		if ((px = this.fg[q | 0x3f]) !== 3) data[p + 0x707] = idx | px;
	}

	xfer16x16(data, dst, src) {
		const idx = src >>> 5 & 0x7f0;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0x1ff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[src++]) !== 0x0f)
					data[dst] = idx | px;
	}

	xfer16x16V(data, dst, src) {
		const idx = src >>> 5 & 0x7f0;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x1ff00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[src++]) !== 0x0f)
					data[dst] = idx | px;
	}

	xfer16x16H(data, dst, src) {
		const idx = src >>> 5 & 0x7f0;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x1ff00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[--src]) !== 0x0f)
					data[dst] = idx | px;
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >>> 5 & 0x7f0;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x1ff00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[--src]) !== 0x0f)
					data[dst] = idx | px;
	}
}

/*
 *
 *	Metro-Cross
 *
 */

const url = 'metrocrs.zip';
let PRG1, PRG2, PRG2I, FG, BG, OBJ, GREEN, RED;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG1 = new Uint8Array((zip.files['mc1-3.9c'].inflate() + zip.files['mc1-1.9a'].inflate() + zip.files['mc1-2.9b'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	PRG2 = new Uint8Array(zip.files['mc1-4.3b'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	PRG2I = new Uint8Array(zip.files['cus60-60a1.mcu'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	FG = new Uint8Array(zip.files['mc1-5.3j'].inflate().split('').map(c => c.charCodeAt(0)));
	BG = new Uint8Array((zip.files['mc1-7.4p'].inflate() + zip.files['mc1-6.4n'].inflate() + '\xff'.repeat(0x4000)).split('').map(c => c.charCodeAt(0)));
	OBJ = new Uint8Array((zip.files['mc1-8.8k'].inflate() + zip.files['mc1-9.8l'].inflate()).split('').map(c => c.charCodeAt(0)));
	GREEN = new Uint8Array(zip.files['mc1-1.1n'].inflate().split('').map(c => c.charCodeAt(0)));
	RED = new Uint8Array(zip.files['mc1-2.2m'].inflate().split('').map(c => c.charCodeAt(0)));
	init({
		game: new MetroCross(),
		sound: sound = new C30(),
		rotate: true,
	});
	loop();
}
