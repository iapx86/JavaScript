/*
 *
 *	Galaga
 *
 */

import PacManSound from './pac-man_sound.js';
import Namco54XX from './namco_54xx.js';
import Cpu, {init, read} from './main.js';
import Z80 from './z80.js';
import MB8840 from './mb8840.js';
let game, sound;

class Galaga {
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
	dwStick = 0;
	abStick = Uint8Array.of(~0, ~1, ~2, ~1, ~4, ~0, ~2, ~2, ~8, ~8, ~0, ~1, ~4, ~8, ~4, ~0);
	nMyShip = 3;
	nRank = 'NORMAL';
	nBonus = 'B';
	fAttract = true;

	fInterruptEnable0 = false;
	fInterruptEnable1 = false;
	fNmiEnable = false;
	fSoundEnable = false;
	ram = new Uint8Array(0x2000).addBase();
	mmi = new Uint8Array(0x100).fill(0xff);
	count = 0;
	dmactrl = 0;
	starport = new Uint8Array(0x100).fill(0xff);

	stars = [];
	fFlip = true;
	fStarEnable = false;
	bg = new Uint8Array(0x4000);
	obj = new Uint8Array(0x10000);
	bgcolor = Uint8Array.from(BGCOLOR, e => e & 0xf | 0x10);
	objcolor = Uint8Array.from(OBJCOLOR, e => e & 0xf);
	rgb = new Uint32Array(0x80);

	cpu = [new Z80(), new Z80(), new Z80()];
	mcu = new MB8840();

	constructor() {
		// CPU周りの初期化
		const range = (page, start, end = start, mirror = 0) => (page & ~mirror) >= start && (page & ~mirror) <= end;
		const interrupt = mcu => {
			mcu.cause = mcu.cause & ~4 | !mcu.interrupt() << 2;
			for (let op = mcu.execute(); op !== 0x3c && (op !== 0x25 || mcu.cause & 4); op = mcu.execute())
				op === 0x25 && (mcu.cause &= ~4);
		};

		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0x3f))
				this.cpu[0].memorymap[page].base = PRG1.base[page & 0x3f];
			else if (range(page, 0x68)) {
				this.cpu[0].memorymap[page].base = this.mmi;
				this.cpu[0].memorymap[page].write = (addr, data) => {
					switch (addr & 0xff) {
					case 0x20:
						return void(this.fInterruptEnable0 = (data & 1) !== 0);
					case 0x21:
						return void(this.fInterruptEnable1 = (data & 1) !== 0);
					case 0x22:
						return void(this.fSoundEnable = (data & 1) !== 0);
					case 0x23:
						return (data & 1) !== 0 ? (this.cpu[1].enable(), this.cpu[2].enable()) : (this.cpu[1].disable(), this.cpu[2].disable());
					}
				};
			} else if (range(page, 0x70)) {
				this.cpu[0].memorymap[page].read = () => {
					let data = 0xff;
					(this.dmactrl & 1) !== 0 && (data &= this.mcu.o, this.mcu.k |= 8, interrupt(this.mcu));
					return data;
				};
				this.cpu[0].memorymap[page].write = (addr, data) => {
					(this.dmactrl & 1) !== 0 && (this.mcu.k = data & 7, interrupt(this.mcu));
					(this.dmactrl & 8) !== 0 && sound[1].write(data);
				};
			} else if (range(page, 0x71)) {
				this.cpu[0].memorymap[page].read = () => this.dmactrl;
				this.cpu[0].memorymap[page].write = (addr, data) => {
					this.fNmiEnable = (data & 0xe0) !== 0;
					switch (this.dmactrl = data) {
					case 0x71:
					case 0xb1:
						if (this.mcu.mask & 4)
							for (this.mcu.execute(); this.mcu.pc !== 0x182; this.mcu.execute()) {}
						return this.mcu.t = this.mcu.t + 1 & 0xff, this.mcu.k |= 8, interrupt(this.mcu);
					case 0xe1:
						return void(this.ram.fill(0, 0x11b5, 0x11b9));
					}
				};
			} else if (range(page, 0x80, 0x87)) {
				this.cpu[0].memorymap[page].base = this.ram.base[page & 7];
				this.cpu[0].memorymap[page].write = null;
			} else if (range(page, 0x88, 0x8b, 4)) {
				this.cpu[0].memorymap[page].base = this.ram.base[8 | page & 3];
				this.cpu[0].memorymap[page].write = null;
			} else if (range(page, 0x90, 0x93, 4)) {
				this.cpu[0].memorymap[page].base = this.ram.base[0xc | page & 3];
				this.cpu[0].memorymap[page].write = null;
			} else if (range(page, 0x98, 0x9b, 4)) {
				this.cpu[0].memorymap[page].base = this.ram.base[0x10 | page & 3];
				this.cpu[0].memorymap[page].write = null;
			} else if (range(page, 0xa0)) {
				this.cpu[0].memorymap[page].base = this.starport;
				this.cpu[0].memorymap[page].write = (addr, data) => {
					switch (addr & 0xff) {
					case 0x05:
						this.fStarEnable = (data & 1) !== 0;
						break;
					case 0x07:
						this.fFlip = !this.fTest && (data & 1) !== 0;
						// fallthrough
					default:
						this.starport[addr & 0xff] = data;
						break;
					}
				};
			}

		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0x1f))
				this.cpu[1].memorymap[page].base = PRG2.base[page & 0x1f];
			else if (range(page, 0x40, 0xff))
				this.cpu[1].memorymap[page] = this.cpu[0].memorymap[page];

		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0xf))
				this.cpu[2].memorymap[page].base = PRG3.base[page & 0xf];
			else if (range(page, 0x40, 0xff))
				this.cpu[2].memorymap[page] = this.cpu[0].memorymap[page];
		this.cpu[2].memorymap[0x68] = {base: this.mmi, read: null, write: (addr, data) => {
			(addr & 0xe0) === 0 && sound[0].write(addr, data, this.count);
		}, fetch: null};

		this.mcu.rom.set(IO);
		this.mcu.r = 0xffff;

		// DIPSW SETUP A:0x01 B:0x02
		this.mmi[0] = 3; // DIPSW B/A1
		this.mmi[1] = 3; // DIPSW B/A2
		this.mmi[2] = 3; // DIPSW B/A3
		this.mmi[3] = 0; // DIPSW B/A4
		this.mmi[4] = 3; // DIPSW B/A5
		this.mmi[5] = 2; // DIPSW B/A6
		this.mmi[6] = 2; // DIPSW B/A7
		this.mmi[7] = 3; // DIPSW B/A8

		// Videoの初期化
		for (let i = 0; i < 1024; i++)
			this.stars.push({x: 0, y: 0, color: 0, blk: 0});
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();
		this.initializeStar();
	}

	execute() {
		sound[0].mute(!this.fSoundEnable);
		if (this.fInterruptEnable0)
			this.cpu[0].interrupt();
		if (this.fInterruptEnable1)
			this.cpu[1].interrupt();
		this.count = 0;
		this.cpu[2].non_maskable_interrupt();			// SOUND INTERRUPT
		for (let i = 128; i !== 0; --i) {
			if (this.fNmiEnable)
				this.cpu[0].non_maskable_interrupt();	// DMA INTERRUPT
			Cpu.multiple_execute(this.cpu, 32);
		}
		this.count = 1;
		this.cpu[2].non_maskable_interrupt();			// SOUND INTERRUPT
		for (let i = 128; i !== 0; --i) {
			if (this.fNmiEnable)
				this.cpu[0].non_maskable_interrupt();	// DMA INTERRUPT
			Cpu.multiple_execute(this.cpu, 32);
		}
		this.moveStars();
		return this;
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// DIPスイッチの更新 A:0x01 B:0x02
		if (this.fDIPSwitchChanged) {
			this.fDIPSwitchChanged = false;
			switch (this.nMyShip) {
			case 2:
				this.mmi[6] &= ~1, this.mmi[7] &= ~1;
				break;
			case 3:
				this.mmi[6] &= ~1, this.mmi[7] |= 1;
				break;
			case 4:
				this.mmi[6] |= 1, this.mmi[7] &= ~1;
				break;
			case 5:
				this.mmi[6] |= 1, this.mmi[7] |= 1;
				break;
			}
			switch (this.nRank) {
			case 'EASY':
				this.mmi[0] |= 2, this.mmi[1] |= 2;
				break;
			case 'NORMAL':
				this.mmi[0] &= ~2, this.mmi[1] &= ~2;
				break;
			case 'HARD':
				this.mmi[0] |= 2, this.mmi[1] &= ~2;
				break;
			case 'VERY HARD':
				this.mmi[0] &= ~2, this.mmi[1] |= 2;
				break;
			}
			switch (this.nBonus) {
			case 'A':
				this.mmi[3] &= ~1, this.mmi[4] &= ~1, this.mmi[5] |= 1;
				break;
			case 'B':
				this.mmi[3] &= ~1, this.mmi[4] |= 1, this.mmi[5] &= ~1;
				break;
			case 'C':
				this.mmi[3] &= ~1, this.mmi[4] |= 1, this.mmi[5] |= 1;
				break;
			case 'D':
				this.mmi[3] |= 1, this.mmi[4] &= ~1, this.mmi[5] &= ~1;
				break;
			case 'E':
				this.mmi[3] |= 1, this.mmi[4] &= ~1, this.mmi[5] |= 1;
				break;
			case 'F':
				this.mmi[3] |= 1, this.mmi[4] |= 1, this.mmi[5] &= ~1;
				break;
			case 'G':
				this.mmi[3] |= 1, this.mmi[4] |= 1, this.mmi[5] |= 1;
				break;
			case 'NONE':
				this.mmi[3] &= ~1, this.mmi[4] &= ~1, this.mmi[5] &= ~1;
				break;
			}
			if (this.fAttract)
				this.mmi[3] &= ~2;
			else
				this.mmi[3] |= 2;
			if (!this.fTest)
				this.fReset = true;
		}

		this.mcu.r = this.mcu.r & ~0x8000 | !this.fTest << 15;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.fSoundEnable = false;
			sound[1].reset();
			this.fInterruptEnable0 = this.fInterruptEnable1 = false;
			this.cpu[0].reset();
			this.cpu[1].disable();
			this.cpu[2].disable();
			for (this.mcu.reset(); ~this.mcu.mask & 4; this.mcu.execute()) {}
			this.fStarEnable = false;
		}
		return this;
	}

	updateInput() {
		this.mcu.r = this.mcu.r & ~0x4c0f | this.abStick[this.dwStick] & 0xf | (this.fStart1P <= 0) << 10 | (this.fStart2P <= 0) << 11 | (this.fCoin <= 0) << 14;
		this.fCoin -= (this.fCoin > 0), this.fStart1P -= (this.fStart1P > 0), this.fStart2P -= (this.fStart2P > 0);
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
		this.dwStick = fDown ? this.dwStick & ~(1 << 2) | 1 << 0 : this.dwStick & ~(1 << 0);
	}

	right(fDown) {
		this.dwStick = fDown ? this.dwStick & ~(1 << 3) | 1 << 1 : this.dwStick & ~(1 << 1);
	}

	down(fDown) {
		this.dwStick = fDown ? this.dwStick & ~(1 << 0) | 1 << 2 : this.dwStick & ~(1 << 2);
	}

	left(fDown) {
		this.dwStick = fDown ? this.dwStick & ~(1 << 1) | 1 << 3 : this.dwStick & ~(1 << 3);
	}

	triggerA(fDown) {
		this.mcu.r = this.mcu.r & ~0x100 | !fDown << 8;
	}

	triggerB(fDown) {
	}

	convertRGB() {
		for (let i = 0; i < 0x20; i++)
			this.rgb[i] = (RGB[i] & 7) * 255 / 7	// Red
				| (RGB[i] >> 3 & 7) * 255 / 7 << 8	// Green
				| (RGB[i] >> 6) * 255 / 3 << 16		// Blue
				| 0xff000000;						// Alpha
		for (let i = 0; i < 0x40; i++)
			this.rgb[0x40 | i] = (i << 1 & 6) * 255 / 7	// Red
				| (i >> 1 & 6) * 255 / 7 << 8			// Green
				| (i >> 4) * 255 / 3 << 16				// Blue
				| 0xff000000;							// Alpha
	}

	convertBG() {
		for (let p = 0, q = 0, i = 256; i !== 0; q += 16, --i) {
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k + 8] >> j & 1 | BG[q + k + 8] >> (j + 3) & 2;
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k] >> j & 1 | BG[q + k] >> (j + 3) & 2;
		}
	}

	convertOBJ() {
		this.obj.fill(3);
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

	initializeStar() {
		let color;

		for (let sr = 0, i = 0, x = 223; x >= 0; --x) {
			for (let y = 0; y < 288; y++) {
				const cy = ~sr << 5 ^ ~sr << 10 ^ ~sr << 12 ^ sr << 15;
				sr = cy & 0x8000 | sr >> 1;
				if ((sr & 0xf429) === 0xf000 && (color = sr << 1 & 0x20 | sr << 2 & 0x18 | sr >> 6 & 0x07) !== 0) {
					this.stars[i].x = x;
					this.stars[i].y = y;
					this.stars[i].color = color;
					this.stars[i].blk = sr >> 11 & 1 | sr >> 8 & 2;
					if (++i >= 1024)
						return;
				}
			}
		}
	}

	moveStars() {
		if (!this.fStarEnable)
			return;
		for (let i = 0; i < 256 && this.stars[i].color; i++)
			switch (this.starport[0] & 7) {
			case 0:
				if (--this.stars[i].y < 0) {
					this.stars[i].y += 0x120;
					if (++this.stars[i].x >= 0xe0)
						this.stars[i].x -= 0xe0;
				}
				break;
			case 1:
				if ((this.stars[i].y -= 2) < 0) {
					this.stars[i].y += 0x120;
					if (++this.stars[i].x >= 0xe0)
						this.stars[i].x -= 0xe0;
				}
				break;
			case 2:
				if ((this.stars[i].y -= 3) < 0) {
					this.stars[i].y += 0x120;
					if (++this.stars[i].x >= 0xe0)
						this.stars[i].x -= 0xe0;
				}
				break;
			case 3:
				if ((this.stars[i].y += 4) >= 0x120) {
					this.stars[i].y -= 0x120;
					if (--this.stars[i].x < 0)
						this.stars[i].x += 0xe0;
				}
				break;
			case 4:
				if ((this.stars[i].y += 3) >= 0x120) {
					this.stars[i].y -= 0x120;
					if (--this.stars[i].x < 0)
						this.stars[i].x += 0xe0;
				}
				break;
			case 5:
				if ((this.stars[i].y += 2) >= 0x120) {
					this.stars[i].y -= 0x120;
					if (--this.stars[i].x < 0)
						this.stars[i].x += 0xe0;
				}
				break;
			case 6:
				if (++this.stars[i].y >= 0x120) {
					this.stars[i].y -= 0x120;
					if (--this.stars[i].x < 0)
						this.stars[i].x += 0xe0;
				}
				break;
			}
	}

	makeBitmap(data) {
		// bg描画
		if (!this.fFlip) {
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
		} else {
			let p = 256 * 8 * 35 + 16;
			let k = 0x40;
			for (let i = 0; i < 28; p += 256 * 8 * 32 + 8, i++)
				for (let j = 0; j < 32; k++, p -= 256 * 8, j++)
					this.xfer8x8HV(data, p, k);
			p = 256 * 8 * 3 + 16;
			k = 2;
			for (let i = 0; i < 28; p += 8, k++, i++)
				this.xfer8x8HV(data, p, k);
			p = 256 * 8 * 2 + 16;
			k = 0x22;
			for (let i = 0; i < 28; p += 8, k++, i++)
				this.xfer8x8HV(data, p, k);
			p = 256 * 8 * 37 + 16;
			k = 0x3c2;
			for (let i = 0; i < 28; p += 8, k++, i++)
				this.xfer8x8HV(data, p, k);
			p = 256 * 8 * 36 + 16;
			k = 0x3e2;
			for (let i = 0; i < 28; p += 8, k++, i++)
				this.xfer8x8HV(data, p, k);
		}

		// obj描画
		if (!this.fFlip)
			for (let k = 0xb80, i = 64; i !== 0; k += 2, --i) {
				const x = this.ram[k + 0x400] - 1 & 0xff;
				const y = (this.ram[k + 0x401] | this.ram[k + 0x801] << 8) - 24 & 0x1ff;
				const src = this.ram[k] | this.ram[k + 1] << 8;
				switch (this.ram[k + 0x800] & 0x0f) {
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
		else
			for (let k = 0xb80, i = 64; i !== 0; k += 2, --i) {
				const x = this.ram[k + 0x400] - 1 & 0xff;
				const y = (this.ram[k + 0x401] | this.ram[k + 0x801] << 8) - 24 & 0x1ff;
				const src = this.ram[k] | this.ram[k + 1] << 8;
				switch (this.ram[k + 0x800] & 0x0f) {
				case 0x00: // ノーマル
					this.xfer16x16HV(data, x | y << 8, src);
					break;
				case 0x01: // V反転
					this.xfer16x16H(data, x | y << 8, src);
					break;
				case 0x02: // H反転
					this.xfer16x16V(data, x | y << 8, src);
					break;
				case 0x03: // HV反転
					this.xfer16x16(data, x | y << 8, src);
					break;
				case 0x04: // ノーマル
					this.xfer16x16HV(data, x | y << 8, src | 1);
					this.xfer16x16HV(data, x | (y + 16 & 0x1ff) << 8, src & ~1);
					break;
				case 0x05: // V反転
					this.xfer16x16H(data, x | y << 8, src & ~1);
					this.xfer16x16H(data, x | (y + 16 & 0x1ff) << 8, src | 1);
					break;
				case 0x06: // H反転
					this.xfer16x16V(data, x | y << 8, src | 1);
					this.xfer16x16V(data, x | (y + 16 & 0x1ff) << 8, src & ~1);
					break;
				case 0x07: // HV反転
					this.xfer16x16(data, x | y << 8, src & ~1);
					this.xfer16x16(data, x | (y + 16 & 0x1ff) << 8, src | 1);
					break;
				case 0x08: // ノーマル
					this.xfer16x16HV(data, x | y << 8, src & ~2);
					this.xfer16x16HV(data, x + 16 & 0xff | y << 8, src | 2);
					break;
				case 0x09: // V反転
					this.xfer16x16H(data, x | y << 8, src & ~2);
					this.xfer16x16H(data, x + 16 & 0xff | y << 8, src | 2);
					break;
				case 0x0a: // H反転
					this.xfer16x16V(data, x | y << 8, src | 2);
					this.xfer16x16V(data, x + 16 & 0xff | y << 8, src & ~2);
					break;
				case 0x0b: // HV反転
					this.xfer16x16(data, x | y << 8, src | 2);
					this.xfer16x16(data, x + 16 & 0xff | y << 8, src & ~2);
					break;
				case 0x0c: // ノーマル
					this.xfer16x16HV(data, x | y << 8, src & ~3 | 1);
					this.xfer16x16HV(data, x | (y + 16 & 0x1ff) << 8, src & ~3);
					this.xfer16x16HV(data, x + 16 & 0xff | y << 8, src | 3);
					this.xfer16x16HV(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3 | 2);
					break;
				case 0x0d: // V反転
					this.xfer16x16H(data, x | y << 8, src & ~3);
					this.xfer16x16H(data, x | (y + 16 & 0x1ff) << 8, src & ~3 | 1);
					this.xfer16x16H(data, x + 16 & 0xff | y << 8, src & ~3 | 2);
					this.xfer16x16H(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src | 3);
					break;
				case 0x0e: // H反転
					this.xfer16x16V(data, x | y << 8, src | 3);
					this.xfer16x16V(data, x | (y + 16 & 0x1ff) << 8, src & ~3 | 2);
					this.xfer16x16V(data, x + 16 & 0xff | y << 8, src & ~3 | 1);
					this.xfer16x16V(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3);
					break;
				case 0x0f: // HV反転
					this.xfer16x16(data, x | y << 8, src & ~3 | 2);
					this.xfer16x16(data, x | (y + 16 & 0x1ff) << 8, src | 3);
					this.xfer16x16(data, x + 16 & 0xff | y << 8, src & ~3);
					this.xfer16x16(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3 | 1);
					break;
				}
			}

		// star描画
		if (!this.fTest && this.fStarEnable) {
			let p = 256 * 16 + 16;
			for (let i = 0; i < 256 && this.stars[i].color; i++) {
				const px = this.stars[i].color;
				const x = this.stars[i].x, y = this.stars[i].y;
				if (y < 0x10 || y >= 0x110)
					continue;
				const k = this.stars[i].blk;
				switch (this.starport[0] >> 3 & 3) {
				case 0:
					if ((k === 0 || k === 2) && data[p + (x | y << 8)] === 0x1f)
						data[p + (x | y << 8)] = 0x40 | px;
					break;
				case 1:
					if ((k === 1 || k === 2) && data[p + (x | y << 8)] === 0x1f)
						data[p + (x | y << 8)] = 0x40 | px;
					break;
				case 2:
					if ((k === 0 || k === 3) && data[p + (x | y << 8)] === 0x1f)
						data[p + (x | y << 8)] = 0x40 | px;
					break;
				case 3:
					if ((k === 1 || k === 3) && data[p + (x | y << 8)] === 0x1f)
						data[p + (x | y << 8)] = 0x40 | px;
					break;
				}
			}
		}

		// palette変換
		let p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] = this.rgb[data[p]];
	}

	xfer8x8(data, p, k) {
		const q = this.ram[k] << 6, idx = this.ram[k + 0x400] << 2 & 0xfc;

		data[p + 0x000] = this.bgcolor[idx | this.bg[q | 0x00]];
		data[p + 0x001] = this.bgcolor[idx | this.bg[q | 0x01]];
		data[p + 0x002] = this.bgcolor[idx | this.bg[q | 0x02]];
		data[p + 0x003] = this.bgcolor[idx | this.bg[q | 0x03]];
		data[p + 0x004] = this.bgcolor[idx | this.bg[q | 0x04]];
		data[p + 0x005] = this.bgcolor[idx | this.bg[q | 0x05]];
		data[p + 0x006] = this.bgcolor[idx | this.bg[q | 0x06]];
		data[p + 0x007] = this.bgcolor[idx | this.bg[q | 0x07]];
		data[p + 0x100] = this.bgcolor[idx | this.bg[q | 0x08]];
		data[p + 0x101] = this.bgcolor[idx | this.bg[q | 0x09]];
		data[p + 0x102] = this.bgcolor[idx | this.bg[q | 0x0a]];
		data[p + 0x103] = this.bgcolor[idx | this.bg[q | 0x0b]];
		data[p + 0x104] = this.bgcolor[idx | this.bg[q | 0x0c]];
		data[p + 0x105] = this.bgcolor[idx | this.bg[q | 0x0d]];
		data[p + 0x106] = this.bgcolor[idx | this.bg[q | 0x0e]];
		data[p + 0x107] = this.bgcolor[idx | this.bg[q | 0x0f]];
		data[p + 0x200] = this.bgcolor[idx | this.bg[q | 0x10]];
		data[p + 0x201] = this.bgcolor[idx | this.bg[q | 0x11]];
		data[p + 0x202] = this.bgcolor[idx | this.bg[q | 0x12]];
		data[p + 0x203] = this.bgcolor[idx | this.bg[q | 0x13]];
		data[p + 0x204] = this.bgcolor[idx | this.bg[q | 0x14]];
		data[p + 0x205] = this.bgcolor[idx | this.bg[q | 0x15]];
		data[p + 0x206] = this.bgcolor[idx | this.bg[q | 0x16]];
		data[p + 0x207] = this.bgcolor[idx | this.bg[q | 0x17]];
		data[p + 0x300] = this.bgcolor[idx | this.bg[q | 0x18]];
		data[p + 0x301] = this.bgcolor[idx | this.bg[q | 0x19]];
		data[p + 0x302] = this.bgcolor[idx | this.bg[q | 0x1a]];
		data[p + 0x303] = this.bgcolor[idx | this.bg[q | 0x1b]];
		data[p + 0x304] = this.bgcolor[idx | this.bg[q | 0x1c]];
		data[p + 0x305] = this.bgcolor[idx | this.bg[q | 0x1d]];
		data[p + 0x306] = this.bgcolor[idx | this.bg[q | 0x1e]];
		data[p + 0x307] = this.bgcolor[idx | this.bg[q | 0x1f]];
		data[p + 0x400] = this.bgcolor[idx | this.bg[q | 0x20]];
		data[p + 0x401] = this.bgcolor[idx | this.bg[q | 0x21]];
		data[p + 0x402] = this.bgcolor[idx | this.bg[q | 0x22]];
		data[p + 0x403] = this.bgcolor[idx | this.bg[q | 0x23]];
		data[p + 0x404] = this.bgcolor[idx | this.bg[q | 0x24]];
		data[p + 0x405] = this.bgcolor[idx | this.bg[q | 0x25]];
		data[p + 0x406] = this.bgcolor[idx | this.bg[q | 0x26]];
		data[p + 0x407] = this.bgcolor[idx | this.bg[q | 0x27]];
		data[p + 0x500] = this.bgcolor[idx | this.bg[q | 0x28]];
		data[p + 0x501] = this.bgcolor[idx | this.bg[q | 0x29]];
		data[p + 0x502] = this.bgcolor[idx | this.bg[q | 0x2a]];
		data[p + 0x503] = this.bgcolor[idx | this.bg[q | 0x2b]];
		data[p + 0x504] = this.bgcolor[idx | this.bg[q | 0x2c]];
		data[p + 0x505] = this.bgcolor[idx | this.bg[q | 0x2d]];
		data[p + 0x506] = this.bgcolor[idx | this.bg[q | 0x2e]];
		data[p + 0x507] = this.bgcolor[idx | this.bg[q | 0x2f]];
		data[p + 0x600] = this.bgcolor[idx | this.bg[q | 0x30]];
		data[p + 0x601] = this.bgcolor[idx | this.bg[q | 0x31]];
		data[p + 0x602] = this.bgcolor[idx | this.bg[q | 0x32]];
		data[p + 0x603] = this.bgcolor[idx | this.bg[q | 0x33]];
		data[p + 0x604] = this.bgcolor[idx | this.bg[q | 0x34]];
		data[p + 0x605] = this.bgcolor[idx | this.bg[q | 0x35]];
		data[p + 0x606] = this.bgcolor[idx | this.bg[q | 0x36]];
		data[p + 0x607] = this.bgcolor[idx | this.bg[q | 0x37]];
		data[p + 0x700] = this.bgcolor[idx | this.bg[q | 0x38]];
		data[p + 0x701] = this.bgcolor[idx | this.bg[q | 0x39]];
		data[p + 0x702] = this.bgcolor[idx | this.bg[q | 0x3a]];
		data[p + 0x703] = this.bgcolor[idx | this.bg[q | 0x3b]];
		data[p + 0x704] = this.bgcolor[idx | this.bg[q | 0x3c]];
		data[p + 0x705] = this.bgcolor[idx | this.bg[q | 0x3d]];
		data[p + 0x706] = this.bgcolor[idx | this.bg[q | 0x3e]];
		data[p + 0x707] = this.bgcolor[idx | this.bg[q | 0x3f]];
	}

	xfer8x8HV(data, p, k) {
		const q = this.ram[k] << 6, idx = this.ram[k + 0x400] << 2 & 0xfc;

		data[p + 0x000] = this.bgcolor[idx | this.bg[q | 0x3f]];
		data[p + 0x001] = this.bgcolor[idx | this.bg[q | 0x3e]];
		data[p + 0x002] = this.bgcolor[idx | this.bg[q | 0x3d]];
		data[p + 0x003] = this.bgcolor[idx | this.bg[q | 0x3c]];
		data[p + 0x004] = this.bgcolor[idx | this.bg[q | 0x3b]];
		data[p + 0x005] = this.bgcolor[idx | this.bg[q | 0x3a]];
		data[p + 0x006] = this.bgcolor[idx | this.bg[q | 0x39]];
		data[p + 0x007] = this.bgcolor[idx | this.bg[q | 0x38]];
		data[p + 0x100] = this.bgcolor[idx | this.bg[q | 0x37]];
		data[p + 0x101] = this.bgcolor[idx | this.bg[q | 0x36]];
		data[p + 0x102] = this.bgcolor[idx | this.bg[q | 0x35]];
		data[p + 0x103] = this.bgcolor[idx | this.bg[q | 0x34]];
		data[p + 0x104] = this.bgcolor[idx | this.bg[q | 0x33]];
		data[p + 0x105] = this.bgcolor[idx | this.bg[q | 0x32]];
		data[p + 0x106] = this.bgcolor[idx | this.bg[q | 0x31]];
		data[p + 0x107] = this.bgcolor[idx | this.bg[q | 0x30]];
		data[p + 0x200] = this.bgcolor[idx | this.bg[q | 0x2f]];
		data[p + 0x201] = this.bgcolor[idx | this.bg[q | 0x2e]];
		data[p + 0x202] = this.bgcolor[idx | this.bg[q | 0x2d]];
		data[p + 0x203] = this.bgcolor[idx | this.bg[q | 0x2c]];
		data[p + 0x204] = this.bgcolor[idx | this.bg[q | 0x2b]];
		data[p + 0x205] = this.bgcolor[idx | this.bg[q | 0x2a]];
		data[p + 0x206] = this.bgcolor[idx | this.bg[q | 0x29]];
		data[p + 0x207] = this.bgcolor[idx | this.bg[q | 0x28]];
		data[p + 0x300] = this.bgcolor[idx | this.bg[q | 0x27]];
		data[p + 0x301] = this.bgcolor[idx | this.bg[q | 0x26]];
		data[p + 0x302] = this.bgcolor[idx | this.bg[q | 0x25]];
		data[p + 0x303] = this.bgcolor[idx | this.bg[q | 0x24]];
		data[p + 0x304] = this.bgcolor[idx | this.bg[q | 0x23]];
		data[p + 0x305] = this.bgcolor[idx | this.bg[q | 0x22]];
		data[p + 0x306] = this.bgcolor[idx | this.bg[q | 0x21]];
		data[p + 0x307] = this.bgcolor[idx | this.bg[q | 0x20]];
		data[p + 0x400] = this.bgcolor[idx | this.bg[q | 0x1f]];
		data[p + 0x401] = this.bgcolor[idx | this.bg[q | 0x1e]];
		data[p + 0x402] = this.bgcolor[idx | this.bg[q | 0x1d]];
		data[p + 0x403] = this.bgcolor[idx | this.bg[q | 0x1c]];
		data[p + 0x404] = this.bgcolor[idx | this.bg[q | 0x1b]];
		data[p + 0x405] = this.bgcolor[idx | this.bg[q | 0x1a]];
		data[p + 0x406] = this.bgcolor[idx | this.bg[q | 0x19]];
		data[p + 0x407] = this.bgcolor[idx | this.bg[q | 0x18]];
		data[p + 0x500] = this.bgcolor[idx | this.bg[q | 0x17]];
		data[p + 0x501] = this.bgcolor[idx | this.bg[q | 0x16]];
		data[p + 0x502] = this.bgcolor[idx | this.bg[q | 0x15]];
		data[p + 0x503] = this.bgcolor[idx | this.bg[q | 0x14]];
		data[p + 0x504] = this.bgcolor[idx | this.bg[q | 0x13]];
		data[p + 0x505] = this.bgcolor[idx | this.bg[q | 0x12]];
		data[p + 0x506] = this.bgcolor[idx | this.bg[q | 0x11]];
		data[p + 0x507] = this.bgcolor[idx | this.bg[q | 0x10]];
		data[p + 0x600] = this.bgcolor[idx | this.bg[q | 0x0f]];
		data[p + 0x601] = this.bgcolor[idx | this.bg[q | 0x0e]];
		data[p + 0x602] = this.bgcolor[idx | this.bg[q | 0x0d]];
		data[p + 0x603] = this.bgcolor[idx | this.bg[q | 0x0c]];
		data[p + 0x604] = this.bgcolor[idx | this.bg[q | 0x0b]];
		data[p + 0x605] = this.bgcolor[idx | this.bg[q | 0x0a]];
		data[p + 0x606] = this.bgcolor[idx | this.bg[q | 0x09]];
		data[p + 0x607] = this.bgcolor[idx | this.bg[q | 0x08]];
		data[p + 0x700] = this.bgcolor[idx | this.bg[q | 0x07]];
		data[p + 0x701] = this.bgcolor[idx | this.bg[q | 0x06]];
		data[p + 0x702] = this.bgcolor[idx | this.bg[q | 0x05]];
		data[p + 0x703] = this.bgcolor[idx | this.bg[q | 0x04]];
		data[p + 0x704] = this.bgcolor[idx | this.bg[q | 0x03]];
		data[p + 0x705] = this.bgcolor[idx | this.bg[q | 0x02]];
		data[p + 0x706] = this.bgcolor[idx | this.bg[q | 0x01]];
		data[p + 0x707] = this.bgcolor[idx | this.bg[q | 0x00]];
	}

	xfer16x16(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px, h;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) <= 8 * 0x100 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0xff00;
		if ((h = (dst >> 8) - 8) >= 16) {
			for (let i = 16; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx | this.obj[src++]]) !== 0xf)
						data[dst] = px;
		} else {
			dst = (dst & 0xff) + 24 * 0x100;
			src += (16 - h) * 16;
			for (let i = h; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx | this.obj[src++]]) !== 0xf)
						data[dst] = px;
		}
	}

	xfer16x16V(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px, h;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) <= 8 * 0x100 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 256 - 16;
		if ((h = (dst >> 8) - 8) >= 16) {
			for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx | this.obj[src++]]) !== 0xf)
						data[dst] = px;
		} else {
			dst = (dst & 0xff) + 24 * 0x100;
			src -= (16 - h) * 16;
			for (let i = h; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx | this.obj[src++]]) !== 0xf)
						data[dst] = px;
		}
	}

	xfer16x16H(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px, h;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) <= 8 * 0x100 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 16;
		if ((h = (dst >> 8) - 8) >= 16) {
			for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx | this.obj[--src]]) !== 0xf)
						data[dst] = px;
		} else {
			dst = (dst & 0xff) + 24 * 0x100;
			src += (16 - h) * 16;
			for (let i = h; i !== 0; dst += 256 - 16, src += 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx | this.obj[--src]]) !== 0xf)
						data[dst] = px;
		}
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px, h;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) <= 8 * 0x100 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 256;
		if ((h = (dst >> 8) - 8) >= 16) {
			for (let i = 16; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx | this.obj[--src]]) !== 0xf)
						data[dst] = px;
		} else {
			dst = (dst & 0xff) + 24 * 0x100;
			src -= (16 - h) * 16;
			for (let i = h; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx | this.obj[--src]]) !== 0xf)
						data[dst] = px;
		}
	}
}

/*
 *
 *	Galaga
 *
 */

let BG, OBJ, BGCOLOR, OBJCOLOR, RGB, SND, PRG1, PRG2, PRG3, IO, PRG;

read('galaga.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG1 = Uint8Array.concat(...['gg1_1b.3p', 'gg1_2b.3m', 'gg1_3.2m', 'gg1_4b.2l'].map(e => zip.decompress(e))).addBase();
	PRG2 = zip.decompress('gg1_5b.3f').addBase();
	PRG3 = zip.decompress('gg1_7b.2c').addBase();
	BG = zip.decompress('gg1_9.4l');
	OBJ = Uint8Array.concat(...['gg1_11.4d', 'gg1_10.4f'].map(e => zip.decompress(e)));
	RGB = zip.decompress('prom-5.5n');
	BGCOLOR = zip.decompress('prom-4.2n');
	OBJCOLOR = zip.decompress('prom-3.1c');
	SND = zip.decompress('prom-1.1d');
}).then(() => read('namco51.zip')).then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	IO = zip.decompress('51xx.bin');
}).then(() => read('namco54.zip')).then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG = zip.decompress('54xx.bin');
	game = new Galaga();
	sound = [
		new PacManSound({SND, resolution: 2}),
		new Namco54XX({PRG, clock: 1536000}),
	];
	canvas.addEventListener('click', () => game.coin());
	init({game, sound});
});

