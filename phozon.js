/*
 *
 *	Phozon
 *
 */

import MappySound from './mappy_sound.js';
import Cpu, {init, read} from './main.js';
import MC6809 from './mc6809.js';
let game, sound;

class Phozon {
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
	nChemic = 3;
	nBonus = 'A';
	nRank = '0';

	fPortTest = false;
	fInterruptEnable0 = false;
	fInterruptEnable1 = false;
	fInterruptEnable2 = false;
	fSoundEnable = false;
	ram = new Uint8Array(0x2800).addBase();
	port = new Uint8Array(0x40);
	in = new Uint8Array(10);
	edge = 0xf;

	bg = new Uint8Array(0x8000);
	obj = new Uint8Array(0x8000);
	bgcolor = Uint8Array.from(BGCOLOR, e => e & 0xf);
	objcolor = Uint8Array.from(OBJCOLOR, e => e & 0xf | 0x10);
	rgb = new Uint32Array(0x40);

	cpu = new MC6809();
	cpu2 = new MC6809();
	cpu3 = new MC6809();

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
				return void(this.fInterruptEnable2 = false);
			case 0x01: // INTERRUPT START
				return void(this.fInterruptEnable2 = true);
			case 0x02: // INTERRUPT STOP
				return void(this.fInterruptEnable1 = false);
			case 0x03: // INTERRUPT START
				return void(this.fInterruptEnable1 = true);
			case 0x04: // INTERRUPT STOP
				return void(this.fInterruptEnable0 = false);
			case 0x05: // INTERRUPT START
				return void(this.fInterruptEnable0 = true);
			case 0x06: // SND STOP
				return void(this.fSoundEnable = false);
			case 0x07: // SND START
				return void(this.fSoundEnable = true);
			case 0x08: // PORT TEST START
				return void(this.fPortTest = true);
			case 0x09: // PORT TEST END
				return void(this.fPortTest = false);
			case 0x0a: // SUB CPU STOP
				return this.cpu2.disable();
			case 0x0b: // SUB CPU START
				return this.cpu2.enable();
			case 0x0c: // SUB CPU STOP
				return this.cpu3.disable();
			case 0x0d: // SUB CPU START
				return this.cpu3.enable();
			}
		};
		for (let i = 0; i < 0x80; i++)
			this.cpu.memorymap[0x80 + i].base = PRG1.base[i];

		for (let i = 0; i < 4; i++) {
			this.cpu2.memorymap[i].read = (addr) => { return sound.read(addr); };
			this.cpu2.memorymap[i].write = (addr, data) => { sound.write(addr, data); };
		}
		for (let i = 0; i < 0x20; i++)
			this.cpu2.memorymap[0xe0 + i].base = PRG2.base[i];

		for (let i = 0; i < 0x20; i++) {
			this.cpu3.memorymap[i].base = this.ram.base[i];
			this.cpu3.memorymap[i].write = null;
		}
		for (let i = 0; i < 4; i++) {
			this.cpu3.memorymap[0x40 + i].read = (addr) => { return sound.read(addr); };
			this.cpu3.memorymap[0x40 + i].write = (addr, data) => { sound.write(addr, data); };
		}
		for (let i = 0; i < 8; i++) {
			this.cpu3.memorymap[0xa0 + i].base = this.ram.base[0x20 + i];
			this.cpu3.memorymap[0xa0 + i].write = null;
		}
		for (let i = 0; i < 0x20; i++)
			this.cpu3.memorymap[0xe0 + i].base = PRG3.base[i];

		// Videoの初期化
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();
	}

	execute() {
		sound.mute(!this.fSoundEnable);
		if (this.fInterruptEnable0)
			this.cpu.interrupt();
		if (this.fInterruptEnable1)
			this.cpu2.interrupt();
		if (this.fInterruptEnable2)
			this.cpu3.interrupt();
		Cpu.multiple_execute([this.cpu, this.cpu2, this.cpu3], 0x2000);
		return this;
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// DIPスイッチの更新
		if (this.fDIPSwitchChanged) {
			this.fDIPSwitchChanged = false;
			switch (this.nChemic) {
			case 1:
				this.in[5] &= ~1, this.in[9] |= 1;
				break;
			case 3:
				this.in[5] &= ~1, this.in[9] &= ~1;
				break;
			case 4:
				this.in[5] |= 1, this.in[9] &= ~1;
				break;
			case 5:
				this.in[5] |= 1, this.in[9] |= 1;
				break;
			}
			switch (this.nRank) {
			case '0':
				this.in[6] &= ~0xe;
				break;
			case '1':
				this.in[6] = this.in[6] & ~0xe | 2;
				break;
			case '2':
				this.in[6] = this.in[6] & ~0xe | 4;
				break;
			case '3':
				this.in[6] = this.in[6] & ~0xe | 6;
				break;
			case '4':
				this.in[6] = this.in[6] & ~0xe | 8;
				break;
			case '5':
				this.in[6] = this.in[6] & ~0xe | 0xa;
				break;
			case '6':
				this.in[6] = this.in[6] & ~0xe | 0xc;
				break;
			case '7':
				this.in[6] |= 0xe;
				break;
			}
			switch (this.nBonus) {
			case 'A':
				this.in[5] &= ~2, this.in[9] &= ~6;
				break;
			case 'B':
				this.in[5] &= ~2, this.in[9] = this.in[9] & ~6 | 2;
				break;
			case 'C':
				this.in[5] |= 2, this.in[9] &= ~6;
				break;
			case 'D':
				this.in[5] |= 2, this.in[9] = this.in[9] & ~6 | 2;
				break;
			case 'E':
				this.in[5] &= ~2, this.in[9] = this.in[9] & ~6 | 4;
				break;
			case 'F':
				this.in[5] &= ~2, this.in[9] |= 6;
				break;
			case 'G':
				this.in[5] |= 2, this.in[9] = this.in[9] & ~6 | 4;
				break;
			case 'NONE':
				this.in[5] |= 2, this.in[9] |= 6;
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
			this.fSoundEnable = false;
			this.cpu.reset();
			this.cpu2.disable();
			this.cpu3.disable();
		}
		return this;
	}

	updateInput() {
		this.in[0] = (this.fCoin !== 0) << 3, this.in[3] = this.in[3] & 3 | (this.fStart1P !== 0) << 2 | (this.fStart2P !== 0) << 3;
		this.fCoin -= (this.fCoin > 0), this.fStart1P -= (this.fStart1P > 0), this.fStart2P -= (this.fStart2P > 0);
		this.edge &= this.in[3];
		if (this.fPortTest)
			return this.edge = this.in[3] ^ 0xf, this;
		if (this.port[8] === 1)
			this.port.set(this.in.subarray(0, 4), 4);
		else if (this.port[8] === 3) {
			// クレジット/スタートボタン処理
			let credit = this.port[2] * 10 + this.port[3];
			if (this.fCoin && credit < 150)
				this.port[0] += 1, credit = Math.min(credit + 1, 99);
			if (!this.port[9] && this.fStart1P && credit > 0)
				this.port[1] += 1, credit -= (credit < 150);
			if (!this.port[9] && this.fStart2P && credit > 1)
				this.port[1] += 2, credit -= (credit < 150) * 2;
			this.port[2] = credit / 10, this.port[3] = credit % 10;
			this.port.set([this.in[1], this.in[3] << 1 & 0xa | this.edge & 5, this.in[2], this.in[3] & 0xa | this.edge >> 1 & 5], 4);
		} else if (this.port[8] === 5)
			this.port.set([0, 2, 3, 4, 5, 6, 0xc, 0xa]);
		if (this.port[0x18] === 8)
			this.port[0x10] = 1, this.port[0x11] = 0xc;
		else if (this.port[0x18] === 9)
			this.port.set([this.in[5], this.in[9], this.in[6], this.in[6], this.in[7], this.in[7], this.in[8], this.in[8]], 0x10);
		return this.edge = this.in[3] ^ 0xf, this;
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
		this.in[1] = fDown ? this.in[1] & ~(1 << 2) | 1 << 0 : this.in[1] & ~(1 << 0);
	}

	right(fDown) {
		this.in[1] = fDown ? this.in[1] & ~(1 << 3) | 1 << 1 : this.in[1] & ~(1 << 1);
	}

	down(fDown) {
		this.in[1] = fDown ? this.in[1] & ~(1 << 0) | 1 << 2 : this.in[1] & ~(1 << 2);
	}

	left(fDown) {
		this.in[1] = fDown ? this.in[1] & ~(1 << 1) | 1 << 3 : this.in[1] & ~(1 << 3);
	}

	triggerA(fDown) {
		this.in[3] = fDown ? this.in[3] | 1 << 0: this.in[3] & ~(1 << 0);
	}

	triggerB(fDown) {
	}

	convertRGB() {
		for (let i = 0; i < 0x40; i++)
			this.rgb[i] = (RED[i] & 0xf) * 255 / 15	// Red
				| (GREEN[i] & 0xf) * 255 / 15 << 8	// Green
				| (BLUE[i] & 0xf) * 255 / 15 << 16	// Blue
				| 0xff000000;						// Alpha
	}

	convertBG() {
		for (let p = 0, q = 0, i = 512; i !== 0; q += 16, --i) {
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k + 8] >> j & 1 | BG[q + k + 8] >> (j + 3) & 2;
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k] >> j & 1 | BG[q + k] >> (j + 3) & 2;
		}
	}

	convertOBJ() {
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
			data.fill(0xf, p, p + 224);

		// bg描画
		this.drawBG(data, 0);

		// obj描画
		for (let k = 0x0f80, i = 64; i !== 0; k += 2, --i) {
			const x = this.ram[k + 0x800] + 8 & 0xff;
			const y = (this.ram[k + 0x801] | this.ram[k + 0x1001] << 8) - 54 & 0x1ff;
			const src = this.ram[k] | this.ram[k + 1] << 8;
			if ((this.ram[k + 0x1000] & 0x34) === 0)
				this.xfer16x16(data, x | y << 8, src);
			else
				switch (this.ram[k + 0x1000] & 0x30) {
				// 8x8
				case 0x10:
					switch (this.ram[k + 0x1000] & 0xc0) {
					case 0x00:
						this.xfer8x8_0(data, x | y << 8, src);
						break;
					case 0x40:
						this.xfer8x8_1(data, x | y << 8, src);
						break;
					case 0x80:
						this.xfer8x8_2(data, x | y << 8, src);
						break;
					case 0xc0:
						this.xfer8x8_3(data, x | y << 8, src);
						break;
					}
					break;
				// 32x8
				case 0x20:
					if (this.ram[k + 0x1000] & 0x40) {
						this.xfer16x8_1(data, x | y << 8, src + 2);
						this.xfer16x8_1(data, x + 16 | y << 8, src);
					} else {
						this.xfer16x8_0(data, x | y << 8, src + 2);
						this.xfer16x8_0(data, x + 16 | y << 8, src);
					}
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
		let k = 0x40;
		for (let i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				this.xfer8x8(data, p, k, pri);
		p = 256 * 8 * 36 + 232;
		k = 2;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
		p = 256 * 8 * 37 + 232;
		k = 0x22;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
		p = 256 * 8 * 2 + 232;
		k = 0x3c2;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
		p = 256 * 8 * 3 + 232;
		k = 0x3e2;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
	}

	xfer8x8(data, p, k, pri) {
		const q = (this.ram[k] | this.ram[k + 0x400] << 1 & 0x100) << 6, idx = this.ram[k + 0x400] << 2 & 0x7c;
		let px;

		if ((this.ram[k + 0x400] >> 6 & 1) !== pri)
			return;
		if (~this.ram[k + 0x400] & 0x20) {
			// ノーマル
			if ((px = this.bgcolor[idx | this.bg[q | 0x00]]) !== 0xf) data[p + 0x000] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x01]]) !== 0xf) data[p + 0x001] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x02]]) !== 0xf) data[p + 0x002] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x03]]) !== 0xf) data[p + 0x003] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x04]]) !== 0xf) data[p + 0x004] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x05]]) !== 0xf) data[p + 0x005] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x06]]) !== 0xf) data[p + 0x006] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x07]]) !== 0xf) data[p + 0x007] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x08]]) !== 0xf) data[p + 0x100] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x09]]) !== 0xf) data[p + 0x101] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x0a]]) !== 0xf) data[p + 0x102] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x0b]]) !== 0xf) data[p + 0x103] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x0c]]) !== 0xf) data[p + 0x104] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x0d]]) !== 0xf) data[p + 0x105] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x0e]]) !== 0xf) data[p + 0x106] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x0f]]) !== 0xf) data[p + 0x107] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x10]]) !== 0xf) data[p + 0x200] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x11]]) !== 0xf) data[p + 0x201] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x12]]) !== 0xf) data[p + 0x202] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x13]]) !== 0xf) data[p + 0x203] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x14]]) !== 0xf) data[p + 0x204] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x15]]) !== 0xf) data[p + 0x205] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x16]]) !== 0xf) data[p + 0x206] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x17]]) !== 0xf) data[p + 0x207] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x18]]) !== 0xf) data[p + 0x300] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x19]]) !== 0xf) data[p + 0x301] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x1a]]) !== 0xf) data[p + 0x302] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x1b]]) !== 0xf) data[p + 0x303] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x1c]]) !== 0xf) data[p + 0x304] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x1d]]) !== 0xf) data[p + 0x305] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x1e]]) !== 0xf) data[p + 0x306] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x1f]]) !== 0xf) data[p + 0x307] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x20]]) !== 0xf) data[p + 0x400] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x21]]) !== 0xf) data[p + 0x401] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x22]]) !== 0xf) data[p + 0x402] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x23]]) !== 0xf) data[p + 0x403] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x24]]) !== 0xf) data[p + 0x404] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x25]]) !== 0xf) data[p + 0x405] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x26]]) !== 0xf) data[p + 0x406] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x27]]) !== 0xf) data[p + 0x407] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x28]]) !== 0xf) data[p + 0x500] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x29]]) !== 0xf) data[p + 0x501] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x2a]]) !== 0xf) data[p + 0x502] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x2b]]) !== 0xf) data[p + 0x503] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x2c]]) !== 0xf) data[p + 0x504] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x2d]]) !== 0xf) data[p + 0x505] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x2e]]) !== 0xf) data[p + 0x506] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x2f]]) !== 0xf) data[p + 0x507] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x30]]) !== 0xf) data[p + 0x600] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x31]]) !== 0xf) data[p + 0x601] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x32]]) !== 0xf) data[p + 0x602] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x33]]) !== 0xf) data[p + 0x603] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x34]]) !== 0xf) data[p + 0x604] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x35]]) !== 0xf) data[p + 0x605] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x36]]) !== 0xf) data[p + 0x606] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x37]]) !== 0xf) data[p + 0x607] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x38]]) !== 0xf) data[p + 0x700] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x39]]) !== 0xf) data[p + 0x701] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x3a]]) !== 0xf) data[p + 0x702] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x3b]]) !== 0xf) data[p + 0x703] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x3c]]) !== 0xf) data[p + 0x704] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x3d]]) !== 0xf) data[p + 0x705] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x3e]]) !== 0xf) data[p + 0x706] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x3f]]) !== 0xf) data[p + 0x707] = px;
		} else if (this.ram[k + 0x400] & 0x1f) {
			// HV反転
			if ((px = this.bgcolor[idx | this.bg[q | 0x3f]]) !== 0xf) data[p + 0x000] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x3e]]) !== 0xf) data[p + 0x001] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x3d]]) !== 0xf) data[p + 0x002] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x3c]]) !== 0xf) data[p + 0x003] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x3b]]) !== 0xf) data[p + 0x004] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x3a]]) !== 0xf) data[p + 0x005] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x39]]) !== 0xf) data[p + 0x006] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x38]]) !== 0xf) data[p + 0x007] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x37]]) !== 0xf) data[p + 0x100] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x36]]) !== 0xf) data[p + 0x101] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x35]]) !== 0xf) data[p + 0x102] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x34]]) !== 0xf) data[p + 0x103] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x33]]) !== 0xf) data[p + 0x104] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x32]]) !== 0xf) data[p + 0x105] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x31]]) !== 0xf) data[p + 0x106] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x30]]) !== 0xf) data[p + 0x107] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x2f]]) !== 0xf) data[p + 0x200] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x2e]]) !== 0xf) data[p + 0x201] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x2d]]) !== 0xf) data[p + 0x202] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x2c]]) !== 0xf) data[p + 0x203] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x2b]]) !== 0xf) data[p + 0x204] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x2a]]) !== 0xf) data[p + 0x205] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x29]]) !== 0xf) data[p + 0x206] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x28]]) !== 0xf) data[p + 0x207] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x27]]) !== 0xf) data[p + 0x300] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x26]]) !== 0xf) data[p + 0x301] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x25]]) !== 0xf) data[p + 0x302] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x24]]) !== 0xf) data[p + 0x303] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x23]]) !== 0xf) data[p + 0x304] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x22]]) !== 0xf) data[p + 0x305] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x21]]) !== 0xf) data[p + 0x306] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x20]]) !== 0xf) data[p + 0x307] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x1f]]) !== 0xf) data[p + 0x400] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x1e]]) !== 0xf) data[p + 0x401] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x1d]]) !== 0xf) data[p + 0x402] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x1c]]) !== 0xf) data[p + 0x403] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x1b]]) !== 0xf) data[p + 0x404] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x1a]]) !== 0xf) data[p + 0x405] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x19]]) !== 0xf) data[p + 0x406] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x18]]) !== 0xf) data[p + 0x407] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x17]]) !== 0xf) data[p + 0x500] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x16]]) !== 0xf) data[p + 0x501] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x15]]) !== 0xf) data[p + 0x502] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x14]]) !== 0xf) data[p + 0x503] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x13]]) !== 0xf) data[p + 0x504] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x12]]) !== 0xf) data[p + 0x505] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x11]]) !== 0xf) data[p + 0x506] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x10]]) !== 0xf) data[p + 0x507] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x0f]]) !== 0xf) data[p + 0x600] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x0e]]) !== 0xf) data[p + 0x601] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x0d]]) !== 0xf) data[p + 0x602] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x0c]]) !== 0xf) data[p + 0x603] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x0b]]) !== 0xf) data[p + 0x604] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x0a]]) !== 0xf) data[p + 0x605] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x09]]) !== 0xf) data[p + 0x606] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x08]]) !== 0xf) data[p + 0x607] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x07]]) !== 0xf) data[p + 0x700] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x06]]) !== 0xf) data[p + 0x701] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x05]]) !== 0xf) data[p + 0x702] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x04]]) !== 0xf) data[p + 0x703] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x03]]) !== 0xf) data[p + 0x704] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x02]]) !== 0xf) data[p + 0x705] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x01]]) !== 0xf) data[p + 0x706] = px;
			if ((px = this.bgcolor[idx | this.bg[q | 0x00]]) !== 0xf) data[p + 0x707] = px;
		}
	}

	xfer16x16(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0x7f00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj[src++]]) !== 0x1f)
					data[dst] = px;
	}

	xfer16x8_0(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0x7f00;
		for (let i = 8; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj[src++]]) !== 0x1f)
					data[dst] = px;
	}

	xfer16x8_1(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x7f00) + 0x80;
		for (let i = 8; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj[src++]]) !== 0x1f)
					data[dst] = px;
	}

	xfer8x8_0(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x7f00) + 8;
		for (let i = 8; i !== 0; dst += 256 - 8, src += 8, --i)
			for (let j = 8; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj[src++]]) !== 0x1f)
					data[dst] = px;
	}

	xfer8x8_1(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x7f00) + 0x88;
		for (let i = 8; i !== 0; dst += 256 - 8, src += 8, --i)
			for (let j = 8; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj[src++]]) !== 0x1f)
					data[dst] = px;
	}

	xfer8x8_2(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0x7f00;
		for (let i = 8; i !== 0; dst += 256 - 8, src += 8, --i)
			for (let j = 8; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj[src++]]) !== 0x1f)
					data[dst] = px;
	}

	xfer8x8_3(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x7f00) + 0x80;
		for (let i = 8; i !== 0; dst += 256 - 8, src += 8, --i)
			for (let j = 8; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj[src++]]) !== 0x1f)
					data[dst] = px;
	}
}

/*
 *
 *	Phozon
 *
 */

let PRG1, PRG2, PRG3, RED, BLUE, GREEN, SND, BG, BGCOLOR, OBJ, OBJCOLOR;

read('phozon.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG1 = Uint8Array.concat(...['6e.rom', '6h.rom', '6c.rom', '6d.rom'].map(e => zip.decompress(e))).addBase();
	PRG2 = zip.decompress('3b.rom').addBase();
	PRG3 = zip.decompress('9r.rom').addBase();
	BG = Uint8Array.concat(...['7j.rom', '8j.rom'].map(e => zip.decompress(e)));
	OBJ = zip.decompress('5t.rom');
	RED = zip.decompress('red.prm');
	BLUE = zip.decompress('blue.prm');
	GREEN = zip.decompress('green.prm');
	BGCOLOR = zip.decompress('chr.prm');
	OBJCOLOR = zip.decompress('sprite.prm');
	SND = zip.decompress('sound.prm');
	game = new Phozon();
	sound = new MappySound({SND});
	canvas.addEventListener('click', () => game.coin());
	init({game, sound});
});

