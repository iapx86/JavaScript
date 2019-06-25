/*
 *
 *	Phozon
 *
 */

import MappySound from './mappy_sound.js';
import Cpu, {init, loop} from './main.js';
import MC6809 from './mc6809.js';
let sound;

class Phozon {
	constructor() {
		this.cxScreen = 224;
		this.cyScreen = 288;
		this.width = 256;
		this.height = 512;
		this.xOffset = 16;
		this.yOffset = 16;
		this.fReset = false;
		this.fTest = false;
		this.fDIPSwitchChanged = true;
		this.fCoin = false;
		this.fStart1P = false;
		this.fStart2P = false;
		this.nChemic = 3;
		this.nBonus = 'A';
		this.nRank = '0';

		// CPU周りの初期化
		this.fPortTest = false;
		this.fInterruptEnable0 = false;
		this.fInterruptEnable1 = false;
		this.fInterruptEnable2 = false;
		this.fSoundEnable = false;

		this.ram = new Uint8Array(0x3000).addBase();
		this.port = new Uint8Array(0x20);
		this.key = Uint8Array.of(0, 2, 3, 4, 5, 6, 0x0c, 0x0a, 1, 0x0c);

		this.cpu = [];
		for (let i = 0; i < 3; i++)
			this.cpu[i] = new MC6809(this);

		for (let i = 0; i < 0x20; i++) {
			this.cpu[0].memorymap[i].base = this.ram.base[i];
			this.cpu[0].memorymap[i].write = null;
		}
		for (let i = 0; i < 4; i++) {
			this.cpu[0].memorymap[0x40 + i].read = addr => sound.read(addr);
			this.cpu[0].memorymap[0x40 + i].write = (addr, data) => sound.write(addr, data);
		}
		for (let i = 0; i < 4; i++) {
			this.cpu[0].memorymap[0x48 + i].base = this.ram.base[0x2c + i];
			this.cpu[0].memorymap[0x48 + i].write = null;
		}
		this.cpu[0].memorymap[0x50].write = systemcontrolarea;
		for (let i = 0; i < 0x80; i++)
			this.cpu[0].memorymap[0x80 + i].base = PRG1.base[i];
		for (let i = 0; i < 4; i++) {
			this.cpu[1].memorymap[i].read = addr => sound.read(addr);
			this.cpu[1].memorymap[i].write = (addr, data) => sound.write(addr, data);
		}
		for (let i = 0; i < 0x20; i++)
			this.cpu[1].memorymap[0xe0 + i].base = PRG2.base[i];
		for (let i = 0; i < 0x20; i++) {
			this.cpu[2].memorymap[i].base = this.ram.base[i];
			this.cpu[2].memorymap[i].write = null;
		}
		for (let i = 0; i < 4; i++) {
			this.cpu[2].memorymap[0x40 + i].read = addr => sound.read(addr);
			this.cpu[2].memorymap[0x40 + i].write = (addr, data) => sound.write(addr, data);
		}
		for (let i = 0; i < 8; i++) {
			this.cpu[2].memorymap[0xa0 + i].base = this.ram.base[0x20 + i];
			this.cpu[2].memorymap[0xa0 + i].write = null;
		}
		for (let i = 0; i < 0x20; i++)
			this.cpu[2].memorymap[0xe0 + i].base = PRG3.base[i];

		// Videoの初期化
		this.bg = new Uint32Array(0x200000);
		this.obj = new Uint8Array(0x8000);
		this.objcolor = new Uint32Array(0x100);
		this.rgb = new Uint32Array(0x40);
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();

		// ライトハンドラ
		function systemcontrolarea(addr, data, game) {
			switch (addr & 0xff) {
			case 0x00: // INTERRUPT STOP */
				game.fInterruptEnable2 = false;
				break;
			case 0x01: // INTERRUPT START */
				game.fInterruptEnable2 = true;
				break;
			case 0x02: // INTERRUPT STOP */
				game.fInterruptEnable1 = false;
				break;
			case 0x03: // INTERRUPT START */
				game.fInterruptEnable1 = true;
				break;
			case 0x04: // INTERRUPT STOP */
				game.fInterruptEnable0 = false;
				break;
			case 0x05: // INTERRUPT START */
				game.fInterruptEnable0 = true;
				break;
			case 0x07: // PORT TEST END */
				game.fPortTest = false;
				game.ram.fill(0, 0x0840, 0x0844);
				game.ram.set(game.port.subarray(4, 8), 0x0844);
				game.ram.set(game.port.subarray(0x10, 0x18), 0x0850);
				game.ram.set(game.port.subarray(4, 8), 0x2c04);
				game.ram.set(game.port.subarray(0x10, 0x18), 0x2c10);
				break;
			case 0x09: // PORT TEST START */
				game.fPortTest = true;
				break;
			case 0x0a: // SUB CPU STOP */
				game.cpu[1].disable();
				break;
			case 0x0b: // SUB CPU START */
				game.cpu[1].enable();
				break;
			case 0x0c: // SUB CPU STOP */
				game.cpu[2].disable();
				break;
			case 0x0d: // SUB CPU START */
				game.cpu[2].enable();
				break;
			case 0x0e: // SND START
				game.fSoundEnable = true;
				break;
			case 0x0f: // SND STOP
				game.fSoundEnable = false;
				break;
			}
		}
	}

	execute() {
		sound.mute(!this.fSoundEnable);
		if (this.fInterruptEnable0)
			this.cpu[0].interrupt();
		if (this.fInterruptEnable1)
			this.cpu[1].interrupt();
		if (this.fInterruptEnable2)
			this.cpu[2].interrupt();
		Cpu.multiple_execute(this.cpu, 0x2000);
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
				this.port[0x10] &= ~1;
				this.port[0x11] |= 1;
				break;
			case 3:
				this.port[0x10] &= ~1;
				this.port[0x11] &= ~1;
				break;
			case 4:
				this.port[0x10] |= 1;
				this.port[0x11] &= ~1;
				break;
			case 5:
				this.port[0x10] |= 1;
				this.port[0x11] |= 1;
				break;
			}
			switch (this.nRank) {
			case '0':
				this.port[0x12] &= ~0x0e;
				break;
			case '1':
				this.port[0x12] = this.port[0x12] & ~0x0e | 2;
				break;
			case '2':
				this.port[0x12] = this.port[0x12] & ~0x0e | 4;
				break;
			case '3':
				this.port[0x12] = this.port[0x12] & ~0x0e | 6;
				break;
			case '4':
				this.port[0x12] = this.port[0x12] & ~0x0e | 8;
				break;
			case '5':
				this.port[0x12] = this.port[0x12] & ~0x0e | 0x0a;
				break;
			case '6':
				this.port[0x12] = this.port[0x12] & ~0x0e | 0x0c;
				break;
			case '7':
				this.port[0x12] |= 0x0e;
				break;
			}
			switch (this.nBonus) {
			case 'A':
				this.port[0x10] &= ~2;
				this.port[0x11] &= ~6;
				break;
			case 'B':
				this.port[0x10] &= ~2;
				this.port[0x11] = this.port[0x11] & ~6 | 2;
				break;
			case 'C':
				this.port[0x10] |= 2;
				this.port[0x11] &= ~6;
				break;
			case 'D':
				this.port[0x10] |= 2;
				this.port[0x11] = this.port[0x11] & ~6 | 2;
				break;
			case 'E':
				this.port[0x10] &= ~2;
				this.port[0x11] = this.port[0x11] & ~6 | 4;
				break;
			case 'F':
				this.port[0x10] &= ~2;
				this.port[0x11] |= 6;
				break;
			case 'G':
				this.port[0x10] |= 2;
				this.port[0x11] = this.port[0x11] & ~6 | 4;
				break;
			case 'NONE':
				this.port[0x10] |= 2;
				this.port[0x11] |= 6;
				break;
			}
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.port[0x16] |= 8;
		else
			this.port[0x16] &= ~8;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.fSoundEnable = false;
			this.cpu[0].reset();
			this.cpu[1].disable();
			this.cpu[2].disable();
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if (this.fCoin) {
			let i = (this.ram[0x2c02] & 0x0f) * 10 + (this.ram[0x2c03] & 0x0f);
			if (i < 150) {
				i++;
				if (i > 99)
					i = 99;
				this.ram[0x2c02] = i / 10;
				this.ram[0x2c03] = i % 10;
				this.ram[0x2c00] = 1;
			}
		}
		if (this.fStart1P && !this.ram[0x2c09]) {
			let i = (this.ram[0x2c02] & 0x0f) * 10 + (this.ram[0x2c03] & 0x0f);
			if (i >= 150)
				this.ram[0x2c01] |= 1;
			else if (i > 0) {
				this.ram[0x2c01] |= 1;
				--i;
				this.ram[0x2c02] = i / 10;
				this.ram[0x2c03] = i % 10;
			}
		}
		if (this.fStart2P && !this.ram[0x2c09]) {
			let i = (this.ram[0x2c02] & 0x0f) * 10 + (this.ram[0x2c03] & 0x0f);
			if (i >= 150)
				this.ram[0x2c01] |= 2;
			else if (i > 1) {
				this.ram[0x2c01] |= 2;
				i -= 2;
				this.ram[0x2c02] = i / 10;
				this.ram[0x2c03] = i % 10;
			}
		}
		this.fCoin = this.fStart1P = this.fStart2P = false;

		if (this.fPortTest) {
			this.ram.set(this.key.subarray(0, 8), 0x2c00);
			this.ram.set(this.key.subarray(8), 0x2c10);
		}
		else {
			this.ram.set(this.port.subarray(4, 8), 0x2c04);
			this.ram.set(this.port.subarray(0x10, 0x18), 0x2c10);
			this.port[8 - this.ram[0x2c08] & 0x1f] &= ~1;
		}
		return this;
	}

	coin() {
		this.fCoin = true;
	}

	start1P() {
		this.fStart1P = true;
	}

	start2P() {
		this.fStart2P = true;
	}

	up(fDown) {
		const r = 7 - this.ram[0x2c08] & 0x1f;

		if (fDown)
			this.port[r] = this.port[r] & ~4 | 1;
		else
			this.port[r] &= ~1;
	}

	right(fDown) {
		const r = 7 - this.ram[0x2c08] & 0x1f;

		if (fDown)
			this.port[r] = this.port[r] & ~8 | 2;
		else
			this.port[r] &= ~2;
	}

	down(fDown) {
		const r = 7 - this.ram[0x2c08] & 0x1f;

		if (fDown)
			this.port[r] = this.port[r] & ~1 | 4;
		else
			this.port[r] &= ~4;
	}

	left(fDown) {
		const r = 7 - this.ram[0x2c08] & 0x1f;

		if (fDown)
			this.port[r] = this.port[r] & ~2 | 8;
		else
			this.port[r] &= ~8;
	}

	triggerA(fDown) {
		if (fDown)
			this.port[8 - this.ram[0x2c08] & 0x1f] |= 1;
		else
			this.port[8 - this.ram[0x2c08] & 0x1f] &= ~1;
	}

	triggerB(fDown) {
	}

	convertRGB() {
		for (let i = 0; i < 0x40; i++)
			this.rgb[i] = (RGB[i + 0x100] & 0x0f) * 255 / 15	// Red
				| (RGB[i] & 0x0f) * 255 / 15 << 8				// Green
				| (RGB[i + 0x200] & 0x0f) * 255 / 15 << 16;		// Blue
	}

	convertBG() {
		// BG bank 0
		for (let p = 0, q = 0, i = 256; i !== 0; q += 16, --i) {
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k + 8] >>> j & 1 | BG[q + k + 8] >>> (j + 3) & 2;
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k] >>> j & 1 | BG[q + k] >>> (j + 3) & 2;
		}
		for (let p = 0, i = 63; i !== 0; p += 0x4000, --i)
			this.bg.copyWithin(p + 0x4000, p, p + 0x4000);
		for (let p = 0, i = 0; i < 32; i++)
			for (let j = 0x4000; j !== 0; p++, --j)
				this.bg[p] = this.rgb[BGCOLOR[i * 4 + this.bg[p]] & 0x0f];
		for (let p = 0x80000, i = 0; i < 32; i++)
			for (let j = 0x4000; j !== 0; p++, --j) {
				const idx = BGCOLOR[i * 4 + this.bg[p]] & 0x0f;
				this.bg[p] = idx === 0x0f ? this.rgb[idx] : this.rgb[idx] | 0xff000000;
			}

		// BG bank 1
		for (let p = 0x100000, q = 0x1000, i = 256; i !== 0; q += 16, --i) {
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k + 8] >>> j & 1 | BG[q + k + 8] >>> (j + 3) & 2;
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k] >>> j & 1 | BG[q + k] >>> (j + 3) & 2;
		}
		for (let p = 0x100000, i = 63; i !== 0; p += 0x4000, --i)
			this.bg.copyWithin(p + 0x4000, p, p + 0x4000);
		for (let p = 0x100000, i = 0; i < 32; i++)
			for (let j = 0x4000; j !== 0; p++, --j)
				this.bg[p] = this.rgb[BGCOLOR[i * 4 + this.bg[p]] & 0x0f];
		for (let p = 0x180000, i = 0; i < 32; i++)
			for (let j = 0x4000; j !== 0; p++, --j) {
				const idx = BGCOLOR[i * 4 + this.bg[p]] & 0x0f;
				this.bg[p] = idx === 0x0f ? this.rgb[idx] : this.rgb[idx] | 0xff000000;
			}
	}

	convertOBJ() {
		// obj palette
		for (let i = 0; i < 0x100; i++) {
			const idx = OBJCOLOR[i] & 0x0f | 0x10;
			this.objcolor[i] = idx === 0x1f ? 0xffffffff : this.rgb[idx];
		}

		for (let p = 0, q = 0, i = 128; i !== 0; q += 64, --i) {
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 32] >>> j & 1 | OBJ[q + k + 32] >>> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k] >>> j & 1 | OBJ[q + k] >>> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 40] >>> j & 1 | OBJ[q + k + 40] >>> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 8] >>> j & 1 | OBJ[q + k + 8] >>> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 48] >>> j & 1 | OBJ[q + k + 48] >>> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 16] >>> j & 1 | OBJ[q + k + 16] >>> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 56] >>> j & 1 | OBJ[q + k + 56] >>> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 24] >>> j & 1 | OBJ[q + k + 24] >>> (j + 3) & 2;
			}
		}
	}

	makeBitmap(data) {
		// bg描画
		let p = 256 * 8 * 4 + 232;
		let k = 0x40;
		for (let i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				this.xfer8x8(data, p, k);
		p = 256 * 8 * 36 + 232;
		k = 2;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k);
		p = 256 * 8 * 37 + 232;
		k = 0x22;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k);
		p = 256 * 8 * 2 + 232;
		k = 0x3c2;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k);
		p = 256 * 8 * 3 + 232;
		k = 0x3e2;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k);

		// obj描画 
		for (let p = 0x0f80, i = 64; i !== 0; p += 2, --i) {
			const y = this.ram[p + 0x801] + this.ram[p + 0x1001] * 0x100 - 54 & 0x1ff;
			const x = this.ram[p + 0x800] + 8 & 0xff;
			if ((this.ram[p + 0x1000] & 0x34) === 0)
				this.xfer16x16(data, x | y << 8, this.ram[p + 1] << 8 | this.ram[p]);
			else
				switch (this.ram[p + 0x1000] & 0x30) {
					// 8x8
				case 0x10:
					switch (this.ram[p + 0x1000] & 0xc0) {
					case 0x00:
						this.xfer8x8_0(data, x | y << 8, this.ram[p + 1] << 8 | this.ram[p]);
						break;
					case 0x40:
						this.xfer8x8_1(data, x | y << 8, this.ram[p + 1] << 8 | this.ram[p]);
						break;
					case 0x80:
						this.xfer8x8_2(data, x | y << 8, this.ram[p + 1] << 8 | this.ram[p]);
						break;
					case 0xc0:
						this.xfer8x8_3(data, x | y << 8, this.ram[p + 1] << 8 | this.ram[p]);
						break;
					}
					break;
					// 32x8
				case 0x20:
					if ((this.ram[p + 0x1000] & 0x40) === 0) {
						this.xfer16x8_0(data, x | y << 8, this.ram[p + 1] << 8 | this.ram[p] + 2);
						this.xfer16x8_0(data, x + 16 | y << 8, this.ram[p + 1] << 8 | this.ram[p]);
					}
					else {
						this.xfer16x8_1(data, x | y << 8, this.ram[p + 1] << 8 | this.ram[p] + 2);
						this.xfer16x8_1(data, x + 16 | y << 8, this.ram[p + 1] << 8 | this.ram[p]);
					}
					break;
				}
		}

		// alphaチャンネル修正
		p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] |= 0xff000000;
	}

	xfer8x8(data, p, k) {
		const q = ((this.ram[k + 0x400] & 0xc0) << 7 | (this.ram[k + 0x400] & 0x1f) << 8 | this.ram[k]) << 6;
		const blue = this.rgb[0x0f];

		if ((this.ram[k + 0x400] & 0x20) === 0) {
			// ノーマル
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
		else if ((this.ram[k + 0x400] & 0x1f) !== 0) {
			// HV反転
			data[p + 0x000] = this.bg[q + 0x3f];
			data[p + 0x001] = this.bg[q + 0x3e];
			data[p + 0x002] = this.bg[q + 0x3d];
			data[p + 0x003] = this.bg[q + 0x3c];
			data[p + 0x004] = this.bg[q + 0x3b];
			data[p + 0x005] = this.bg[q + 0x3a];
			data[p + 0x006] = this.bg[q + 0x39];
			data[p + 0x007] = this.bg[q + 0x38];
			data[p + 0x100] = this.bg[q + 0x37];
			data[p + 0x101] = this.bg[q + 0x36];
			data[p + 0x102] = this.bg[q + 0x35];
			data[p + 0x103] = this.bg[q + 0x34];
			data[p + 0x104] = this.bg[q + 0x33];
			data[p + 0x105] = this.bg[q + 0x32];
			data[p + 0x106] = this.bg[q + 0x31];
			data[p + 0x107] = this.bg[q + 0x30];
			data[p + 0x200] = this.bg[q + 0x2f];
			data[p + 0x201] = this.bg[q + 0x2e];
			data[p + 0x202] = this.bg[q + 0x2d];
			data[p + 0x203] = this.bg[q + 0x2c];
			data[p + 0x204] = this.bg[q + 0x2b];
			data[p + 0x205] = this.bg[q + 0x2a];
			data[p + 0x206] = this.bg[q + 0x29];
			data[p + 0x207] = this.bg[q + 0x28];
			data[p + 0x300] = this.bg[q + 0x27];
			data[p + 0x301] = this.bg[q + 0x26];
			data[p + 0x302] = this.bg[q + 0x25];
			data[p + 0x303] = this.bg[q + 0x24];
			data[p + 0x304] = this.bg[q + 0x23];
			data[p + 0x305] = this.bg[q + 0x22];
			data[p + 0x306] = this.bg[q + 0x21];
			data[p + 0x307] = this.bg[q + 0x20];
			data[p + 0x400] = this.bg[q + 0x1f];
			data[p + 0x401] = this.bg[q + 0x1e];
			data[p + 0x402] = this.bg[q + 0x1d];
			data[p + 0x403] = this.bg[q + 0x1c];
			data[p + 0x404] = this.bg[q + 0x1b];
			data[p + 0x405] = this.bg[q + 0x1a];
			data[p + 0x406] = this.bg[q + 0x19];
			data[p + 0x407] = this.bg[q + 0x18];
			data[p + 0x500] = this.bg[q + 0x17];
			data[p + 0x501] = this.bg[q + 0x16];
			data[p + 0x502] = this.bg[q + 0x15];
			data[p + 0x503] = this.bg[q + 0x14];
			data[p + 0x504] = this.bg[q + 0x13];
			data[p + 0x505] = this.bg[q + 0x12];
			data[p + 0x506] = this.bg[q + 0x11];
			data[p + 0x507] = this.bg[q + 0x10];
			data[p + 0x600] = this.bg[q + 0x0f];
			data[p + 0x601] = this.bg[q + 0x0e];
			data[p + 0x602] = this.bg[q + 0x0d];
			data[p + 0x603] = this.bg[q + 0x0c];
			data[p + 0x604] = this.bg[q + 0x0b];
			data[p + 0x605] = this.bg[q + 0x0a];
			data[p + 0x606] = this.bg[q + 0x09];
			data[p + 0x607] = this.bg[q + 0x08];
			data[p + 0x700] = this.bg[q + 0x07];
			data[p + 0x701] = this.bg[q + 0x06];
			data[p + 0x702] = this.bg[q + 0x05];
			data[p + 0x703] = this.bg[q + 0x04];
			data[p + 0x704] = this.bg[q + 0x03];
			data[p + 0x705] = this.bg[q + 0x02];
			data[p + 0x706] = this.bg[q + 0x01];
			data[p + 0x707] = this.bg[q + 0x00];
		}
		else {
			data[p + 0x000] = blue;
			data[p + 0x001] = blue;
			data[p + 0x002] = blue;
			data[p + 0x003] = blue;
			data[p + 0x004] = blue;
			data[p + 0x005] = blue;
			data[p + 0x006] = blue;
			data[p + 0x007] = blue;
			data[p + 0x100] = blue;
			data[p + 0x101] = blue;
			data[p + 0x102] = blue;
			data[p + 0x103] = blue;
			data[p + 0x104] = blue;
			data[p + 0x105] = blue;
			data[p + 0x106] = blue;
			data[p + 0x107] = blue;
			data[p + 0x200] = blue;
			data[p + 0x201] = blue;
			data[p + 0x202] = blue;
			data[p + 0x203] = blue;
			data[p + 0x204] = blue;
			data[p + 0x205] = blue;
			data[p + 0x206] = blue;
			data[p + 0x207] = blue;
			data[p + 0x300] = blue;
			data[p + 0x301] = blue;
			data[p + 0x302] = blue;
			data[p + 0x303] = blue;
			data[p + 0x304] = blue;
			data[p + 0x305] = blue;
			data[p + 0x306] = blue;
			data[p + 0x307] = blue;
			data[p + 0x400] = blue;
			data[p + 0x401] = blue;
			data[p + 0x402] = blue;
			data[p + 0x403] = blue;
			data[p + 0x404] = blue;
			data[p + 0x405] = blue;
			data[p + 0x406] = blue;
			data[p + 0x407] = blue;
			data[p + 0x500] = blue;
			data[p + 0x501] = blue;
			data[p + 0x502] = blue;
			data[p + 0x503] = blue;
			data[p + 0x504] = blue;
			data[p + 0x505] = blue;
			data[p + 0x506] = blue;
			data[p + 0x507] = blue;
			data[p + 0x600] = blue;
			data[p + 0x601] = blue;
			data[p + 0x602] = blue;
			data[p + 0x603] = blue;
			data[p + 0x604] = blue;
			data[p + 0x605] = blue;
			data[p + 0x606] = blue;
			data[p + 0x607] = blue;
			data[p + 0x700] = blue;
			data[p + 0x701] = blue;
			data[p + 0x702] = blue;
			data[p + 0x703] = blue;
			data[p + 0x704] = blue;
			data[p + 0x705] = blue;
			data[p + 0x706] = blue;
			data[p + 0x707] = blue;
		}
	}

	xfer16x16(data, dst, src) {
		const idx = src >>> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0x7f00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx + this.obj[src++]]) !== 0xffffffff && (data[dst] & 0xff000000) === 0)
					data[dst] = px;
	}

	xfer16x8_0(data, dst, src) {
		const idx = src >>> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0x7f00;
		for (let i = 8; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx + this.obj[src++]]) !== 0xffffffff && (data[dst] & 0xff000000) === 0)
					data[dst] = px;
	}

	xfer16x8_1(data, dst, src) {
		const idx = src >>> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x7f00) + 0x80;
		for (let i = 8; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx + this.obj[src++]]) !== 0xffffffff && (data[dst] & 0xff000000) === 0)
					data[dst] = px;
	}

	xfer8x8_0(data, dst, src) {
		const idx = src >>> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x7f00) + 0x08;
		for (let i = 8; i !== 0; dst += 256 - 8, src += 8, --i)
			for (let j = 8; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx + this.obj[src++]]) !== 0xffffffff && (data[dst] & 0xff000000) === 0)
					data[dst] = px;
	}

	xfer8x8_1(data, dst, src) {
		const idx = src >>> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x7f00) + 0x88;
		for (let i = 8; i !== 0; dst += 256 - 8, src += 8, --i)
			for (let j = 8; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx + this.obj[src++]]) !== 0xffffffff && (data[dst] & 0xff000000) === 0)
					data[dst] = px;
	}

	xfer8x8_2(data, dst, src) {
		const idx = src >>> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0x7f00;
		for (let i = 8; i !== 0; dst += 256 - 8, src += 8, --i)
			for (let j = 8; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx + this.obj[src++]]) !== 0xffffffff && (data[dst] & 0xff000000) === 0)
					data[dst] = px;
	}


	xfer8x8_3(data, dst, src) {
		const idx = src >>> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x7f00) + 0x80;
		for (let i = 8; i !== 0; dst += 256 - 8, src += 8, --i)
			for (let j = 8; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx + this.obj[src++]]) !== 0xffffffff && (data[dst] & 0xff000000) === 0)
					data[dst] = px;
	}
}

/*
 *
 *	Phozon
 *
 */

const url = 'phozon.zip';
let PRG1, PRG2, PRG3, RGB, SND, BG, BGCOLOR, OBJ, OBJCOLOR;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG1 = new Uint8Array((zip.files['6e.rom'].inflate() + zip.files['6h.rom'].inflate() + zip.files['6c.rom'].inflate() + zip.files['6d.rom'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	PRG2 = new Uint8Array(zip.files['3b.rom'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	PRG3 = new Uint8Array(zip.files['9r.rom'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	BG = new Uint8Array((zip.files['7j.rom'].inflate() + zip.files['8j.rom'].inflate()).split('').map(c => c.charCodeAt(0)));
	OBJ = new Uint8Array(zip.files['5t.rom'].inflate().split('').map(c => c.charCodeAt(0)));
	RGB = new Uint8Array((zip.files['green.prm'].inflate() + zip.files['red.prm'].inflate() + zip.files['blue.prm'].inflate()).split('').map(c => c.charCodeAt(0)));
	BGCOLOR = new Uint8Array(zip.files['chr.prm'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJCOLOR = new Uint8Array(zip.files['sprite.prm'].inflate().split('').map(c => c.charCodeAt(0)));
	SND = new Uint8Array(zip.files['sound.prm'].inflate().split('').map(c => c.charCodeAt(0)));
	init({
		game: new Phozon(),
		sound: sound = new MappySound({SND}),
	});
	loop();
}
