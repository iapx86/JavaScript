/*
 *
 *	DigDug
 *
 */

import PacManSound from './pac-man_sound.js';
import Cpu, {init, read} from './main.js';
import Z80 from './z80.js';
import MB8840 from './mb8840.js';
let game, sound;

class DigDug {
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
	nDigdug = 3;
	nBonus = 'F';
	nRank = 'B';
	fContinue = false;
	fAttract = true;

	fInterruptEnable0 = false;
	fInterruptEnable1 = false;
	fInterruptEnable2 = false;
	fNmiEnable = false;
	ram = new Uint8Array(RAM).addBase();
	mmi = new Uint8Array(0x100).fill(0xff);
	mmo = new Uint8Array(0x100);
	count = 0;
	dmactrl = 0;
	ioport = new Uint8Array(0x100);

	fBG2Attribute = true;
	fBG4Disable = true;
	fFlip = true;
	dwBG4Color = 3;
	dwBG4Select = 3;
	bg2 = new Uint8Array(0x2000);
	bg4 = new Uint8Array(0x4000);
	obj = new Uint8Array(0x10000);
	bgcolor = Uint8Array.from(BGCOLOR, e => e & 0xf);
	objcolor = Uint8Array.from(OBJCOLOR, e => e & 0xf | 0x10);
	rgb = new Uint32Array(0x20);

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
			else if (range(page, 0x68))
				this.cpu[0].memorymap[page].write = (addr, data) => {
					switch (addr & 0xf0) {
					case 0x00:
					case 0x10:
						return sound.write(addr, data, this.count);
					case 0x20:
						switch (addr & 0x0f) {
						case 0:
							return void(this.fInterruptEnable0 = (data & 1) !== 0);
						case 1:
							return void(this.fInterruptEnable1 = (data & 1) !== 0);
						case 2:
							return this.mmo[0x22] && !data && (this.fInterruptEnable2 = true), void(this.mmo[0x22] = data);
						case 3:
							return (data & 1) !== 0 ? (this.cpu[1].enable(), this.cpu[2].enable()) : (this.cpu[1].disable(), this.cpu[2].disable());
						}
					}
				};
			else if (range(page, 0x70)) {
				this.cpu[0].memorymap[page].read = addr => {
					let data = 0xff;
					(this.dmactrl & 1) !== 0 && (data &= this.mcu.o, this.mcu.k |= 8, interrupt(this.mcu));
					(this.dmactrl & 2) !== 0 && (data &= this.ioport[addr & 0xff]);
					return data;
				};
				this.cpu[0].memorymap[page].write = (addr, data) => {
					(this.dmactrl & 1) !== 0 && (this.mcu.k = data & 7, interrupt(this.mcu));
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
					case 0xd2:
						return void(this.ioport.set(this.mmi.subarray(0, 2)));
					}
				};
			} else if (range(page, 0x80, 0x87)) {
				this.cpu[0].memorymap[page].base = this.ram.base[page & 7];
				this.cpu[0].memorymap[page].write = null;
			} else if (range(page, 0x88, 0x8b, 4)) {
				this.cpu[0].memorymap[page].base = this.ram.base[8 | page & 3];
				this.cpu[0].memorymap[page].write = null;
			} else if (range(page, 0x90, 0x93, 4)) {
				this.cpu[0].memorymap[page].base = this.ram.base[0x10 | page & 3];
				this.cpu[0].memorymap[page].write = null;
			} else if (range(page, 0x98, 0x9b, 4)) {
				this.cpu[0].memorymap[page].base = this.ram.base[0x18 | page & 3];
				this.cpu[0].memorymap[page].write = null;
			} else if (range(page, 0xa0))
				this.cpu[0].memorymap[0xa0].write = (addr, data) => {
					switch (addr & 7) {
					case 0:
						return void(this.dwBG4Select = this.dwBG4Select & 2 | data & 1);
					case 1:
						return void(this.dwBG4Select = this.dwBG4Select & 1 | data << 1 & 2);
					case 2:
						return void(this.fBG2Attribute = (data & 1) !== 0);
					case 3:
						return void(this.fBG4Disable = (data & 1) !== 0);
					case 4:
						return void(this.dwBG4Color = this.dwBG4Color & 2 | data & 1);
					case 5:
						return void(this.dwBG4Color = this.dwBG4Color & 1 | data << 1 & 2);
					case 7:
						return void(this.fFlip = false);
					}
				};

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

		this.mcu.rom.set(IO);
		this.mcu.r = 0xffff;

		this.mmi[0] = 0x99; // DIPSW A
		this.mmi[1] = 0x2e; // DIPSW B

		// Videoの初期化
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();
	}

	execute() {
		if (this.fInterruptEnable0)
			this.cpu[0].interrupt();
		if (this.fInterruptEnable1)
			this.cpu[1].interrupt();
		this.count = 0;
		if (this.fInterruptEnable2) {
			this.fInterruptEnable2 = false;
			this.cpu[2].non_maskable_interrupt();		// SOUND INTERRUPT
		}
		for (let i = 128; i !== 0; --i) {
			if (this.fNmiEnable)
				this.cpu[0].non_maskable_interrupt();	// DMA INTERRUPT
			Cpu.multiple_execute(this.cpu, 32);
		}
		this.count = 1;
		if (this.fInterruptEnable2) {
			this.fInterruptEnable2 = false;
			this.cpu[2].non_maskable_interrupt();		// SOUND INTERRUPT
		}
		for (let i = 128; i !== 0; --i) {
			if (this.fNmiEnable)
				this.cpu[0].non_maskable_interrupt();	// DMA INTERRUPT
			Cpu.multiple_execute(this.cpu, 32);
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
			switch (this.nDigdug) {
			case 1:
				this.mmi[0] &= 0x3f;
				break;
			case 2:
				this.mmi[0] = this.mmi[0] & 0x3f | 0x40;
				break;
			case 3:
				this.mmi[0] = this.mmi[0] & 0x3f | 0x80;
				break;
			case 5:
				this.mmi[0] |= 0xc0;
				break;
			}
			switch (this.nRank) {
			case 'A':
				this.mmi[1] &= 0xfc;
				break;
			case 'B':
				this.mmi[1] = this.mmi[1] & 0xfc | 0x02;
				break;
			case 'C':
				this.mmi[1] = this.mmi[1] & 0xfc | 0x01;
				break;
			case 'D':
				this.mmi[1] |= 0x03;
				break;
			}
			switch (this.nBonus) {
			case 'NONE':
				this.mmi[0] &= 0xc7;
				break;
			case 'A':
				this.mmi[0] = this.mmi[0] & 0xc7 | 0x20;
				break;
			case 'B':
				this.mmi[0] = this.mmi[0] & 0xc7 | 0x10;
				break;
			case 'C':
				this.mmi[0] = this.mmi[0] & 0xc7 | 0x30;
				break;
			case 'D':
				this.mmi[0] = this.mmi[0] & 0xc7 | 0x08;
				break;
			case 'E':
				this.mmi[0] = this.mmi[0] & 0xc7 | 0x28;
				break;
			case 'F':
				this.mmi[0] = this.mmi[0] & 0xc7 | 0x18;
				break;
			case 'G':
				this.mmi[0] |= 0x38;
				break;
			}
			if (this.fContinue)
				this.mmi[1] &= 0xf7;
			else
				this.mmi[1] |= 0x08;
			if (this.fAttract)
				this.mmi[1] &= 0xef;
			else
				this.mmi[1] |= 0x10;
			if (!this.fTest)
				this.fReset = true;
		}

		this.mcu.r = this.mcu.r & ~0x8000 | !this.fTest << 15;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.fInterruptEnable0 = this.fInterruptEnable1 = this.fInterruptEnable2 = false;
			this.cpu[0].reset();
			this.cpu[1].disable();
			this.cpu[2].disable();
			for (this.mcu.reset(); ~this.mcu.mask & 4; this.mcu.execute()) {}
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
	}

	convertBG() {
		for (let p = 0, q = 0, i = 128; i !== 0; q += 8, --i)
			for (let j = 0; j < 8; j++)
				for (let k = 7; k >= 0; --k)
					this.bg2[p++] = BG2[q + k] >> j & 1;
		for (let p = 0, q = 0, i = 256; i !== 0; q += 16, --i) {
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg4[p++] = BG4[q + k + 8] >> j & 1 | BG4[q + k + 8] >> (j + 3) & 2;
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg4[p++] = BG4[q + k] >> j & 1 | BG4[q + k] >> (j + 3) & 2;
		}
	}

	convertOBJ() {
		for (let p = 0, q = 0, i = 256; i !== 0; q += 64, --i) {
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
				const x = this.ram[k + 0x800] - 1 & 0xff;
				const y = (this.ram[k + 0x801] - 55 & 0xff) + 32;
				if (this.ram[k] < 0x80) {
					const src = this.ram[k] | this.ram[k + 1] << 8;
					switch (this.ram[k + 0x1000] & 3) {
					case 0: // ノーマル
						this.xfer16x16(data, x | y << 8, src);
						break;
					case 1: // V反転
						this.xfer16x16V(data, x | y << 8, src);
						break;
					case 2: // H反転
						this.xfer16x16H(data, x | y << 8, src);
						break;
					case 3: // HV反転
						this.xfer16x16HV(data, x | y << 8, src);
						break;
					}
				} else if (this.ram[k] < 0xc0) {
					const src = this.ram[k] << 2 & 0x3c | this.ram[k + 1] << 8;
					switch (this.ram[k + 0x1000] & 3) {
					case 0: // ノーマル
						this.xfer16x16(data, x | y << 8, src | 0x82);
						this.xfer16x16(data, x | y + 16 << 8, src | 0x83);
						this.xfer16x16(data, x + 16 & 0xff | y << 8, src | 0x80);
						this.xfer16x16(data, x + 16 & 0xff | y + 16 << 8, src | 0x81);
						break;
					case 1: // V反転
						this.xfer16x16V(data, x | y << 8, src | 0x83);
						this.xfer16x16V(data, x | y + 16 << 8, src | 0x82);
						this.xfer16x16V(data, x + 16 & 0xff | y << 8, src | 0x81);
						this.xfer16x16V(data, x + 16 & 0xff | y + 16 << 8, src | 0x80);
						break;
					case 2: // H反転
						this.xfer16x16H(data, x | y << 8, src | 0x80);
						this.xfer16x16H(data, x | y + 16 << 8, src | 0x81);
						this.xfer16x16H(data, x + 16 & 0xff | y << 8, src | 0x82);
						this.xfer16x16H(data, x + 16 & 0xff | y + 16 << 8, src | 0x83);
						break;
					case 3: // HV反転
						this.xfer16x16HV(data, x | y << 8, src | 0x81);
						this.xfer16x16HV(data, x | y + 16 << 8, src | 0x80);
						this.xfer16x16HV(data, x + 16 & 0xff | y << 8, src | 0x83);
						this.xfer16x16HV(data, x + 16 & 0xff | y + 16 << 8, src | 0x82);
						break;
					}
				} else {
					const src = this.ram[k] << 2 & 0x3c | this.ram[k + 1] << 8;
					switch (this.ram[k + 0x1000] & 3) {
					case 0: // ノーマル
						this.xfer16x16(data, x | y << 8, src | 0xc2);
						this.xfer16x16(data, x | y + 16 << 8, src | 0xc3);
						this.xfer16x16(data, x + 16 & 0xff | y << 8, src | 0xc0);
						this.xfer16x16(data, x + 16 & 0xff | y + 16 << 8, src | 0xc1);
						break;
					case 1: // V反転
						this.xfer16x16V(data, x | y << 8, src | 0xc3);
						this.xfer16x16V(data, x | y + 16 << 8, src | 0xc2);
						this.xfer16x16V(data, x + 16 & 0xff | y << 8, src | 0xc1);
						this.xfer16x16V(data, x + 16 & 0xff | y + 16 << 8, src | 0xc0);
						break;
					case 2: // H反転
						this.xfer16x16H(data, x | y << 8, src | 0xc0);
						this.xfer16x16H(data, x | y + 16 << 8, src | 0xc1);
						this.xfer16x16H(data, x + 16 & 0xff | y << 8, src | 0xc2);
						this.xfer16x16H(data, x + 16 & 0xff | y + 16 << 8, src | 0xc3);
						break;
					case 3: // HV反転
						this.xfer16x16HV(data, x | y << 8, src | 0xc1);
						this.xfer16x16HV(data, x | y + 16 << 8, src | 0xc0);
						this.xfer16x16HV(data, x + 16 & 0xff | y << 8, src | 0xc3);
						this.xfer16x16HV(data, x + 16 & 0xff | y + 16 << 8, src | 0xc2);
						break;
					}
				}
			}
		else
			for (let k = 0xb80, i = 64; i !== 0; k += 2, --i) {
				const x = this.ram[k + 0x800] - 1 & 0xff;
				const y = (this.ram[k + 0x801] - 55 & 0xff) + 32;
				if (this.ram[k] < 0x80) {
					const src = this.ram[k] | this.ram[k + 1] << 8;
					switch (this.ram[k + 0x1000] & 3) {
					case 0: // ノーマル
						this.xfer16x16HV(data, x | y << 8, src);
						break;
					case 1: // V反転
						this.xfer16x16H(data, x | y << 8, src);
						break;
					case 2: // H反転
						this.xfer16x16V(data, x | y << 8, src);
						break;
					case 3: // HV反転
						this.xfer16x16(data, x | y << 8, src);
						break;
					}
				} else if (this.ram[k] < 0xc0) {
					const src = this.ram[k] << 2 & 0x3c | this.ram[k + 1] << 8;
					switch (this.ram[k + 0x1000] & 3) {
					case 0: // ノーマル
						this.xfer16x16HV(data, x | y << 8, src | 0x81);
						this.xfer16x16HV(data, x | y + 16 << 8, src | 0x80);
						this.xfer16x16HV(data, x + 16 & 0xff | y << 8, src | 0x83);
						this.xfer16x16HV(data, x + 16 & 0xff | y + 16 << 8, src | 0x82);
						break;
					case 1: // V反転
						this.xfer16x16H(data, x | y << 8, src | 0x80);
						this.xfer16x16H(data, x | y + 16 << 8, src | 0x81);
						this.xfer16x16H(data, x + 16 & 0xff | y << 8, src | 0x82);
						this.xfer16x16H(data, x + 16 & 0xff | y + 16 << 8, src | 0x83);
						break;
					case 2: // H反転
						this.xfer16x16V(data, x | y << 8, src | 0x83);
						this.xfer16x16V(data, x | y + 16 << 8, src | 0x82);
						this.xfer16x16V(data, x + 16 & 0xff | y << 8, src | 0x81);
						this.xfer16x16V(data, x + 16 & 0xff | y + 16 << 8, src | 0x80);
						break;
					case 3: // HV反転
						this.xfer16x16(data, x | y << 8, src | 0x82);
						this.xfer16x16(data, x | y + 16 << 8, src | 0x83);
						this.xfer16x16(data, x + 16 & 0xff | y << 8, src | 0x80);
						this.xfer16x16(data, x + 16 & 0xff | y + 16 << 8, src | 0x81);
						break;
					}
				} else {
					const src = this.ram[k] << 2 & 0x3c | this.ram[k + 1] << 8;
					switch (this.ram[k + 0x1000] & 3) {
					case 0: // ノーマル
						this.xfer16x16HV(data, x | y << 8, src | 0xc1);
						this.xfer16x16HV(data, x | y + 16 << 8, src | 0xc0);
						this.xfer16x16HV(data, x + 16 & 0xff | y << 8, src | 0xc3);
						this.xfer16x16HV(data, x + 16 & 0xff | y + 16 << 8, src | 0xc2);
						break;
					case 1: // V反転
						this.xfer16x16H(data, x | y << 8, src | 0xc0);
						this.xfer16x16H(data, x | y + 16 << 8, src | 0xc1);
						this.xfer16x16H(data, x + 16 & 0xff | y << 8, src | 0xc2);
						this.xfer16x16H(data, x + 16 & 0xff | y + 16 << 8, src | 0xc3);
						break;
					case 2: // H反転
						this.xfer16x16V(data, x | y << 8, src | 0xc3);
						this.xfer16x16V(data, x | y + 16 << 8, src | 0xc2);
						this.xfer16x16V(data, x + 16 & 0xff | y << 8, src | 0xc1);
						this.xfer16x16V(data, x + 16 & 0xff | y + 16 << 8, src | 0xc0);
						break;
					case 3: // HV反転
						this.xfer16x16(data, x | y << 8, src | 0xc2);
						this.xfer16x16(data, x | y + 16 << 8, src | 0xc3);
						this.xfer16x16(data, x + 16 & 0xff | y << 8, src | 0xc0);
						this.xfer16x16(data, x + 16 & 0xff | y + 16 << 8, src | 0xc1);
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
		const color = this.fBG2Attribute ? this.ram[k + 0x400] & 0xf : this.ram[k] >> 4 & 0xe | this.ram[k] >> 3 & 2;
		const q = this.ram[k] << 6 & 0x1fc0, r = MAPDATA[k | this.dwBG4Select << 10] << 6, idx = MAPDATA[k | this.dwBG4Select << 10] >> 2 & 0x3c | this.dwBG4Color << 6;

		if (this.fBG4Disable) {
			data[p + 0x000] = this.bg2[q | 0x00] * color;
			data[p + 0x001] = this.bg2[q | 0x01] * color;
			data[p + 0x002] = this.bg2[q | 0x02] * color;
			data[p + 0x003] = this.bg2[q | 0x03] * color;
			data[p + 0x004] = this.bg2[q | 0x04] * color;
			data[p + 0x005] = this.bg2[q | 0x05] * color;
			data[p + 0x006] = this.bg2[q | 0x06] * color;
			data[p + 0x007] = this.bg2[q | 0x07] * color;
			data[p + 0x100] = this.bg2[q | 0x08] * color;
			data[p + 0x101] = this.bg2[q | 0x09] * color;
			data[p + 0x102] = this.bg2[q | 0x0a] * color;
			data[p + 0x103] = this.bg2[q | 0x0b] * color;
			data[p + 0x104] = this.bg2[q | 0x0c] * color;
			data[p + 0x105] = this.bg2[q | 0x0d] * color;
			data[p + 0x106] = this.bg2[q | 0x0e] * color;
			data[p + 0x107] = this.bg2[q | 0x0f] * color;
			data[p + 0x200] = this.bg2[q | 0x10] * color;
			data[p + 0x201] = this.bg2[q | 0x11] * color;
			data[p + 0x202] = this.bg2[q | 0x12] * color;
			data[p + 0x203] = this.bg2[q | 0x13] * color;
			data[p + 0x204] = this.bg2[q | 0x14] * color;
			data[p + 0x205] = this.bg2[q | 0x15] * color;
			data[p + 0x206] = this.bg2[q | 0x16] * color;
			data[p + 0x207] = this.bg2[q | 0x17] * color;
			data[p + 0x300] = this.bg2[q | 0x18] * color;
			data[p + 0x301] = this.bg2[q | 0x19] * color;
			data[p + 0x302] = this.bg2[q | 0x1a] * color;
			data[p + 0x303] = this.bg2[q | 0x1b] * color;
			data[p + 0x304] = this.bg2[q | 0x1c] * color;
			data[p + 0x305] = this.bg2[q | 0x1d] * color;
			data[p + 0x306] = this.bg2[q | 0x1e] * color;
			data[p + 0x307] = this.bg2[q | 0x1f] * color;
			data[p + 0x400] = this.bg2[q | 0x20] * color;
			data[p + 0x401] = this.bg2[q | 0x21] * color;
			data[p + 0x402] = this.bg2[q | 0x22] * color;
			data[p + 0x403] = this.bg2[q | 0x23] * color;
			data[p + 0x404] = this.bg2[q | 0x24] * color;
			data[p + 0x405] = this.bg2[q | 0x25] * color;
			data[p + 0x406] = this.bg2[q | 0x26] * color;
			data[p + 0x407] = this.bg2[q | 0x27] * color;
			data[p + 0x500] = this.bg2[q | 0x28] * color;
			data[p + 0x501] = this.bg2[q | 0x29] * color;
			data[p + 0x502] = this.bg2[q | 0x2a] * color;
			data[p + 0x503] = this.bg2[q | 0x2b] * color;
			data[p + 0x504] = this.bg2[q | 0x2c] * color;
			data[p + 0x505] = this.bg2[q | 0x2d] * color;
			data[p + 0x506] = this.bg2[q | 0x2e] * color;
			data[p + 0x507] = this.bg2[q | 0x2f] * color;
			data[p + 0x600] = this.bg2[q | 0x30] * color;
			data[p + 0x601] = this.bg2[q | 0x31] * color;
			data[p + 0x602] = this.bg2[q | 0x32] * color;
			data[p + 0x603] = this.bg2[q | 0x33] * color;
			data[p + 0x604] = this.bg2[q | 0x34] * color;
			data[p + 0x605] = this.bg2[q | 0x35] * color;
			data[p + 0x606] = this.bg2[q | 0x36] * color;
			data[p + 0x607] = this.bg2[q | 0x37] * color;
			data[p + 0x700] = this.bg2[q | 0x38] * color;
			data[p + 0x701] = this.bg2[q | 0x39] * color;
			data[p + 0x702] = this.bg2[q | 0x3a] * color;
			data[p + 0x703] = this.bg2[q | 0x3b] * color;
			data[p + 0x704] = this.bg2[q | 0x3c] * color;
			data[p + 0x705] = this.bg2[q | 0x3d] * color;
			data[p + 0x706] = this.bg2[q | 0x3e] * color;
			data[p + 0x707] = this.bg2[q | 0x3f] * color;
		} else {
			data[p + 0x000] = this.bg2[q | 0x00] ? color : this.bgcolor[idx | this.bg4[r | 0x00]];
			data[p + 0x001] = this.bg2[q | 0x01] ? color : this.bgcolor[idx | this.bg4[r | 0x01]];
			data[p + 0x002] = this.bg2[q | 0x02] ? color : this.bgcolor[idx | this.bg4[r | 0x02]];
			data[p + 0x003] = this.bg2[q | 0x03] ? color : this.bgcolor[idx | this.bg4[r | 0x03]];
			data[p + 0x004] = this.bg2[q | 0x04] ? color : this.bgcolor[idx | this.bg4[r | 0x04]];
			data[p + 0x005] = this.bg2[q | 0x05] ? color : this.bgcolor[idx | this.bg4[r | 0x05]];
			data[p + 0x006] = this.bg2[q | 0x06] ? color : this.bgcolor[idx | this.bg4[r | 0x06]];
			data[p + 0x007] = this.bg2[q | 0x07] ? color : this.bgcolor[idx | this.bg4[r | 0x07]];
			data[p + 0x100] = this.bg2[q | 0x08] ? color : this.bgcolor[idx | this.bg4[r | 0x08]];
			data[p + 0x101] = this.bg2[q | 0x09] ? color : this.bgcolor[idx | this.bg4[r | 0x09]];
			data[p + 0x102] = this.bg2[q | 0x0a] ? color : this.bgcolor[idx | this.bg4[r | 0x0a]];
			data[p + 0x103] = this.bg2[q | 0x0b] ? color : this.bgcolor[idx | this.bg4[r | 0x0b]];
			data[p + 0x104] = this.bg2[q | 0x0c] ? color : this.bgcolor[idx | this.bg4[r | 0x0c]];
			data[p + 0x105] = this.bg2[q | 0x0d] ? color : this.bgcolor[idx | this.bg4[r | 0x0d]];
			data[p + 0x106] = this.bg2[q | 0x0e] ? color : this.bgcolor[idx | this.bg4[r | 0x0e]];
			data[p + 0x107] = this.bg2[q | 0x0f] ? color : this.bgcolor[idx | this.bg4[r | 0x0f]];
			data[p + 0x200] = this.bg2[q | 0x10] ? color : this.bgcolor[idx | this.bg4[r | 0x10]];
			data[p + 0x201] = this.bg2[q | 0x11] ? color : this.bgcolor[idx | this.bg4[r | 0x11]];
			data[p + 0x202] = this.bg2[q | 0x12] ? color : this.bgcolor[idx | this.bg4[r | 0x12]];
			data[p + 0x203] = this.bg2[q | 0x13] ? color : this.bgcolor[idx | this.bg4[r | 0x13]];
			data[p + 0x204] = this.bg2[q | 0x14] ? color : this.bgcolor[idx | this.bg4[r | 0x14]];
			data[p + 0x205] = this.bg2[q | 0x15] ? color : this.bgcolor[idx | this.bg4[r | 0x15]];
			data[p + 0x206] = this.bg2[q | 0x16] ? color : this.bgcolor[idx | this.bg4[r | 0x16]];
			data[p + 0x207] = this.bg2[q | 0x17] ? color : this.bgcolor[idx | this.bg4[r | 0x17]];
			data[p + 0x300] = this.bg2[q | 0x18] ? color : this.bgcolor[idx | this.bg4[r | 0x18]];
			data[p + 0x301] = this.bg2[q | 0x19] ? color : this.bgcolor[idx | this.bg4[r | 0x19]];
			data[p + 0x302] = this.bg2[q | 0x1a] ? color : this.bgcolor[idx | this.bg4[r | 0x1a]];
			data[p + 0x303] = this.bg2[q | 0x1b] ? color : this.bgcolor[idx | this.bg4[r | 0x1b]];
			data[p + 0x304] = this.bg2[q | 0x1c] ? color : this.bgcolor[idx | this.bg4[r | 0x1c]];
			data[p + 0x305] = this.bg2[q | 0x1d] ? color : this.bgcolor[idx | this.bg4[r | 0x1d]];
			data[p + 0x306] = this.bg2[q | 0x1e] ? color : this.bgcolor[idx | this.bg4[r | 0x1e]];
			data[p + 0x307] = this.bg2[q | 0x1f] ? color : this.bgcolor[idx | this.bg4[r | 0x1f]];
			data[p + 0x400] = this.bg2[q | 0x20] ? color : this.bgcolor[idx | this.bg4[r | 0x20]];
			data[p + 0x401] = this.bg2[q | 0x21] ? color : this.bgcolor[idx | this.bg4[r | 0x21]];
			data[p + 0x402] = this.bg2[q | 0x22] ? color : this.bgcolor[idx | this.bg4[r | 0x22]];
			data[p + 0x403] = this.bg2[q | 0x23] ? color : this.bgcolor[idx | this.bg4[r | 0x23]];
			data[p + 0x404] = this.bg2[q | 0x24] ? color : this.bgcolor[idx | this.bg4[r | 0x24]];
			data[p + 0x405] = this.bg2[q | 0x25] ? color : this.bgcolor[idx | this.bg4[r | 0x25]];
			data[p + 0x406] = this.bg2[q | 0x26] ? color : this.bgcolor[idx | this.bg4[r | 0x26]];
			data[p + 0x407] = this.bg2[q | 0x27] ? color : this.bgcolor[idx | this.bg4[r | 0x27]];
			data[p + 0x500] = this.bg2[q | 0x28] ? color : this.bgcolor[idx | this.bg4[r | 0x28]];
			data[p + 0x501] = this.bg2[q | 0x29] ? color : this.bgcolor[idx | this.bg4[r | 0x29]];
			data[p + 0x502] = this.bg2[q | 0x2a] ? color : this.bgcolor[idx | this.bg4[r | 0x2a]];
			data[p + 0x503] = this.bg2[q | 0x2b] ? color : this.bgcolor[idx | this.bg4[r | 0x2b]];
			data[p + 0x504] = this.bg2[q | 0x2c] ? color : this.bgcolor[idx | this.bg4[r | 0x2c]];
			data[p + 0x505] = this.bg2[q | 0x2d] ? color : this.bgcolor[idx | this.bg4[r | 0x2d]];
			data[p + 0x506] = this.bg2[q | 0x2e] ? color : this.bgcolor[idx | this.bg4[r | 0x2e]];
			data[p + 0x507] = this.bg2[q | 0x2f] ? color : this.bgcolor[idx | this.bg4[r | 0x2f]];
			data[p + 0x600] = this.bg2[q | 0x30] ? color : this.bgcolor[idx | this.bg4[r | 0x30]];
			data[p + 0x601] = this.bg2[q | 0x31] ? color : this.bgcolor[idx | this.bg4[r | 0x31]];
			data[p + 0x602] = this.bg2[q | 0x32] ? color : this.bgcolor[idx | this.bg4[r | 0x32]];
			data[p + 0x603] = this.bg2[q | 0x33] ? color : this.bgcolor[idx | this.bg4[r | 0x33]];
			data[p + 0x604] = this.bg2[q | 0x34] ? color : this.bgcolor[idx | this.bg4[r | 0x34]];
			data[p + 0x605] = this.bg2[q | 0x35] ? color : this.bgcolor[idx | this.bg4[r | 0x35]];
			data[p + 0x606] = this.bg2[q | 0x36] ? color : this.bgcolor[idx | this.bg4[r | 0x36]];
			data[p + 0x607] = this.bg2[q | 0x37] ? color : this.bgcolor[idx | this.bg4[r | 0x37]];
			data[p + 0x700] = this.bg2[q | 0x38] ? color : this.bgcolor[idx | this.bg4[r | 0x38]];
			data[p + 0x701] = this.bg2[q | 0x39] ? color : this.bgcolor[idx | this.bg4[r | 0x39]];
			data[p + 0x702] = this.bg2[q | 0x3a] ? color : this.bgcolor[idx | this.bg4[r | 0x3a]];
			data[p + 0x703] = this.bg2[q | 0x3b] ? color : this.bgcolor[idx | this.bg4[r | 0x3b]];
			data[p + 0x704] = this.bg2[q | 0x3c] ? color : this.bgcolor[idx | this.bg4[r | 0x3c]];
			data[p + 0x705] = this.bg2[q | 0x3d] ? color : this.bgcolor[idx | this.bg4[r | 0x3d]];
			data[p + 0x706] = this.bg2[q | 0x3e] ? color : this.bgcolor[idx | this.bg4[r | 0x3e]];
			data[p + 0x707] = this.bg2[q | 0x3f] ? color : this.bgcolor[idx | this.bg4[r | 0x3f]];
		}
	}

	xfer8x8HV(data, p, k) {
		const color = this.fBG2Attribute ? this.ram[k + 0x400] & 0xf : this.ram[k] >> 4 & 0xe | this.ram[k] >> 3 & 2;
		const q = this.ram[k] << 6 & 0x1fc0, r = MAPDATA[k | this.dwBG4Select << 10] << 6, idx = MAPDATA[k | this.dwBG4Select << 10] >> 2 & 0x3c | this.dwBG4Color << 6;

		if (this.fBG4Disable) {
			data[p + 0x000] = this.bg2[q | 0x3f] * color;
			data[p + 0x001] = this.bg2[q | 0x3e] * color;
			data[p + 0x002] = this.bg2[q | 0x3d] * color;
			data[p + 0x003] = this.bg2[q | 0x3c] * color;
			data[p + 0x004] = this.bg2[q | 0x3b] * color;
			data[p + 0x005] = this.bg2[q | 0x3a] * color;
			data[p + 0x006] = this.bg2[q | 0x39] * color;
			data[p + 0x007] = this.bg2[q | 0x38] * color;
			data[p + 0x100] = this.bg2[q | 0x37] * color;
			data[p + 0x101] = this.bg2[q | 0x36] * color;
			data[p + 0x102] = this.bg2[q | 0x35] * color;
			data[p + 0x103] = this.bg2[q | 0x34] * color;
			data[p + 0x104] = this.bg2[q | 0x33] * color;
			data[p + 0x105] = this.bg2[q | 0x32] * color;
			data[p + 0x106] = this.bg2[q | 0x31] * color;
			data[p + 0x107] = this.bg2[q | 0x30] * color;
			data[p + 0x200] = this.bg2[q | 0x2f] * color;
			data[p + 0x201] = this.bg2[q | 0x2e] * color;
			data[p + 0x202] = this.bg2[q | 0x2d] * color;
			data[p + 0x203] = this.bg2[q | 0x2c] * color;
			data[p + 0x204] = this.bg2[q | 0x2b] * color;
			data[p + 0x205] = this.bg2[q | 0x2a] * color;
			data[p + 0x206] = this.bg2[q | 0x29] * color;
			data[p + 0x207] = this.bg2[q | 0x28] * color;
			data[p + 0x300] = this.bg2[q | 0x27] * color;
			data[p + 0x301] = this.bg2[q | 0x26] * color;
			data[p + 0x302] = this.bg2[q | 0x25] * color;
			data[p + 0x303] = this.bg2[q | 0x24] * color;
			data[p + 0x304] = this.bg2[q | 0x23] * color;
			data[p + 0x305] = this.bg2[q | 0x22] * color;
			data[p + 0x306] = this.bg2[q | 0x21] * color;
			data[p + 0x307] = this.bg2[q | 0x20] * color;
			data[p + 0x400] = this.bg2[q | 0x1f] * color;
			data[p + 0x401] = this.bg2[q | 0x1e] * color;
			data[p + 0x402] = this.bg2[q | 0x1d] * color;
			data[p + 0x403] = this.bg2[q | 0x1c] * color;
			data[p + 0x404] = this.bg2[q | 0x1b] * color;
			data[p + 0x405] = this.bg2[q | 0x1a] * color;
			data[p + 0x406] = this.bg2[q | 0x19] * color;
			data[p + 0x407] = this.bg2[q | 0x18] * color;
			data[p + 0x500] = this.bg2[q | 0x17] * color;
			data[p + 0x501] = this.bg2[q | 0x16] * color;
			data[p + 0x502] = this.bg2[q | 0x15] * color;
			data[p + 0x503] = this.bg2[q | 0x14] * color;
			data[p + 0x504] = this.bg2[q | 0x13] * color;
			data[p + 0x505] = this.bg2[q | 0x12] * color;
			data[p + 0x506] = this.bg2[q | 0x11] * color;
			data[p + 0x507] = this.bg2[q | 0x10] * color;
			data[p + 0x600] = this.bg2[q | 0x0f] * color;
			data[p + 0x601] = this.bg2[q | 0x0e] * color;
			data[p + 0x602] = this.bg2[q | 0x0d] * color;
			data[p + 0x603] = this.bg2[q | 0x0c] * color;
			data[p + 0x604] = this.bg2[q | 0x0b] * color;
			data[p + 0x605] = this.bg2[q | 0x0a] * color;
			data[p + 0x606] = this.bg2[q | 0x09] * color;
			data[p + 0x607] = this.bg2[q | 0x08] * color;
			data[p + 0x700] = this.bg2[q | 0x07] * color;
			data[p + 0x701] = this.bg2[q | 0x06] * color;
			data[p + 0x702] = this.bg2[q | 0x05] * color;
			data[p + 0x703] = this.bg2[q | 0x04] * color;
			data[p + 0x704] = this.bg2[q | 0x03] * color;
			data[p + 0x705] = this.bg2[q | 0x02] * color;
			data[p + 0x706] = this.bg2[q | 0x01] * color;
			data[p + 0x707] = this.bg2[q | 0x00] * color;
		} else {
			data[p + 0x000] = this.bg2[q | 0x3f] ? color : this.bgcolor[idx | this.bg4[r | 0x3f]];
			data[p + 0x001] = this.bg2[q | 0x3e] ? color : this.bgcolor[idx | this.bg4[r | 0x3e]];
			data[p + 0x002] = this.bg2[q | 0x3d] ? color : this.bgcolor[idx | this.bg4[r | 0x3d]];
			data[p + 0x003] = this.bg2[q | 0x3c] ? color : this.bgcolor[idx | this.bg4[r | 0x3c]];
			data[p + 0x004] = this.bg2[q | 0x3b] ? color : this.bgcolor[idx | this.bg4[r | 0x3b]];
			data[p + 0x005] = this.bg2[q | 0x3a] ? color : this.bgcolor[idx | this.bg4[r | 0x3a]];
			data[p + 0x006] = this.bg2[q | 0x39] ? color : this.bgcolor[idx | this.bg4[r | 0x39]];
			data[p + 0x007] = this.bg2[q | 0x38] ? color : this.bgcolor[idx | this.bg4[r | 0x38]];
			data[p + 0x100] = this.bg2[q | 0x37] ? color : this.bgcolor[idx | this.bg4[r | 0x37]];
			data[p + 0x101] = this.bg2[q | 0x36] ? color : this.bgcolor[idx | this.bg4[r | 0x36]];
			data[p + 0x102] = this.bg2[q | 0x35] ? color : this.bgcolor[idx | this.bg4[r | 0x35]];
			data[p + 0x103] = this.bg2[q | 0x34] ? color : this.bgcolor[idx | this.bg4[r | 0x34]];
			data[p + 0x104] = this.bg2[q | 0x33] ? color : this.bgcolor[idx | this.bg4[r | 0x33]];
			data[p + 0x105] = this.bg2[q | 0x32] ? color : this.bgcolor[idx | this.bg4[r | 0x32]];
			data[p + 0x106] = this.bg2[q | 0x31] ? color : this.bgcolor[idx | this.bg4[r | 0x31]];
			data[p + 0x107] = this.bg2[q | 0x30] ? color : this.bgcolor[idx | this.bg4[r | 0x30]];
			data[p + 0x200] = this.bg2[q | 0x2f] ? color : this.bgcolor[idx | this.bg4[r | 0x2f]];
			data[p + 0x201] = this.bg2[q | 0x2e] ? color : this.bgcolor[idx | this.bg4[r | 0x2e]];
			data[p + 0x202] = this.bg2[q | 0x2d] ? color : this.bgcolor[idx | this.bg4[r | 0x2d]];
			data[p + 0x203] = this.bg2[q | 0x2c] ? color : this.bgcolor[idx | this.bg4[r | 0x2c]];
			data[p + 0x204] = this.bg2[q | 0x2b] ? color : this.bgcolor[idx | this.bg4[r | 0x2b]];
			data[p + 0x205] = this.bg2[q | 0x2a] ? color : this.bgcolor[idx | this.bg4[r | 0x2a]];
			data[p + 0x206] = this.bg2[q | 0x29] ? color : this.bgcolor[idx | this.bg4[r | 0x29]];
			data[p + 0x207] = this.bg2[q | 0x28] ? color : this.bgcolor[idx | this.bg4[r | 0x28]];
			data[p + 0x300] = this.bg2[q | 0x27] ? color : this.bgcolor[idx | this.bg4[r | 0x27]];
			data[p + 0x301] = this.bg2[q | 0x26] ? color : this.bgcolor[idx | this.bg4[r | 0x26]];
			data[p + 0x302] = this.bg2[q | 0x25] ? color : this.bgcolor[idx | this.bg4[r | 0x25]];
			data[p + 0x303] = this.bg2[q | 0x24] ? color : this.bgcolor[idx | this.bg4[r | 0x24]];
			data[p + 0x304] = this.bg2[q | 0x23] ? color : this.bgcolor[idx | this.bg4[r | 0x23]];
			data[p + 0x305] = this.bg2[q | 0x22] ? color : this.bgcolor[idx | this.bg4[r | 0x22]];
			data[p + 0x306] = this.bg2[q | 0x21] ? color : this.bgcolor[idx | this.bg4[r | 0x21]];
			data[p + 0x307] = this.bg2[q | 0x20] ? color : this.bgcolor[idx | this.bg4[r | 0x20]];
			data[p + 0x400] = this.bg2[q | 0x1f] ? color : this.bgcolor[idx | this.bg4[r | 0x1f]];
			data[p + 0x401] = this.bg2[q | 0x1e] ? color : this.bgcolor[idx | this.bg4[r | 0x1e]];
			data[p + 0x402] = this.bg2[q | 0x1d] ? color : this.bgcolor[idx | this.bg4[r | 0x1d]];
			data[p + 0x403] = this.bg2[q | 0x1c] ? color : this.bgcolor[idx | this.bg4[r | 0x1c]];
			data[p + 0x404] = this.bg2[q | 0x1b] ? color : this.bgcolor[idx | this.bg4[r | 0x1b]];
			data[p + 0x405] = this.bg2[q | 0x1a] ? color : this.bgcolor[idx | this.bg4[r | 0x1a]];
			data[p + 0x406] = this.bg2[q | 0x19] ? color : this.bgcolor[idx | this.bg4[r | 0x19]];
			data[p + 0x407] = this.bg2[q | 0x18] ? color : this.bgcolor[idx | this.bg4[r | 0x18]];
			data[p + 0x500] = this.bg2[q | 0x17] ? color : this.bgcolor[idx | this.bg4[r | 0x17]];
			data[p + 0x501] = this.bg2[q | 0x16] ? color : this.bgcolor[idx | this.bg4[r | 0x16]];
			data[p + 0x502] = this.bg2[q | 0x15] ? color : this.bgcolor[idx | this.bg4[r | 0x15]];
			data[p + 0x503] = this.bg2[q | 0x14] ? color : this.bgcolor[idx | this.bg4[r | 0x14]];
			data[p + 0x504] = this.bg2[q | 0x13] ? color : this.bgcolor[idx | this.bg4[r | 0x13]];
			data[p + 0x505] = this.bg2[q | 0x12] ? color : this.bgcolor[idx | this.bg4[r | 0x12]];
			data[p + 0x506] = this.bg2[q | 0x11] ? color : this.bgcolor[idx | this.bg4[r | 0x11]];
			data[p + 0x507] = this.bg2[q | 0x10] ? color : this.bgcolor[idx | this.bg4[r | 0x10]];
			data[p + 0x600] = this.bg2[q | 0x0f] ? color : this.bgcolor[idx | this.bg4[r | 0x0f]];
			data[p + 0x601] = this.bg2[q | 0x0e] ? color : this.bgcolor[idx | this.bg4[r | 0x0e]];
			data[p + 0x602] = this.bg2[q | 0x0d] ? color : this.bgcolor[idx | this.bg4[r | 0x0d]];
			data[p + 0x603] = this.bg2[q | 0x0c] ? color : this.bgcolor[idx | this.bg4[r | 0x0c]];
			data[p + 0x604] = this.bg2[q | 0x0b] ? color : this.bgcolor[idx | this.bg4[r | 0x0b]];
			data[p + 0x605] = this.bg2[q | 0x0a] ? color : this.bgcolor[idx | this.bg4[r | 0x0a]];
			data[p + 0x606] = this.bg2[q | 0x09] ? color : this.bgcolor[idx | this.bg4[r | 0x09]];
			data[p + 0x607] = this.bg2[q | 0x08] ? color : this.bgcolor[idx | this.bg4[r | 0x08]];
			data[p + 0x700] = this.bg2[q | 0x07] ? color : this.bgcolor[idx | this.bg4[r | 0x07]];
			data[p + 0x701] = this.bg2[q | 0x06] ? color : this.bgcolor[idx | this.bg4[r | 0x06]];
			data[p + 0x702] = this.bg2[q | 0x05] ? color : this.bgcolor[idx | this.bg4[r | 0x05]];
			data[p + 0x703] = this.bg2[q | 0x04] ? color : this.bgcolor[idx | this.bg4[r | 0x04]];
			data[p + 0x704] = this.bg2[q | 0x03] ? color : this.bgcolor[idx | this.bg4[r | 0x03]];
			data[p + 0x705] = this.bg2[q | 0x02] ? color : this.bgcolor[idx | this.bg4[r | 0x02]];
			data[p + 0x706] = this.bg2[q | 0x01] ? color : this.bgcolor[idx | this.bg4[r | 0x01]];
			data[p + 0x707] = this.bg2[q | 0x00] ? color : this.bgcolor[idx | this.bg4[r | 0x00]];
		}
	}

	xfer16x16(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px, h;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (dst >= 288 * 0x100)
			dst -= 0x10000;
		if ((h = 288 - (dst >> 8)) >= 16) {
			src = src << 8 & 0xff00;
			for (let i = 16; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx | this.obj[src++]]) !== 0x1f)
						data[dst] = px;
		} else {
			src = src << 8 & 0xff00;
			for (let i = h; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx | this.obj[src++]]) !== 0x1f)
						data[dst] = px;
			dst -= 0x10000;
			for (let i = 16 - h; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx | this.obj[src++]]) !== 0x1f)
						data[dst] = px;
		}
	}

	xfer16x16V(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px, h;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (dst >= 288 * 0x100)
			dst -= 0x10000;
		if ((h = 288 - (dst >> 8)) >= 16) {
			src = (src << 8 & 0xff00) + 256 - 16;
			for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx | this.obj[src++]]) !== 0x1f)
						data[dst] = px;
		} else {
			src = (src << 8 & 0xff00) + 256 - 16;
			for (let i = h; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx | this.obj[src++]]) !== 0x1f)
						data[dst] = px;
			dst -= 0x10000;
			for (let i = 16 - h; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx | this.obj[src++]]) !== 0x1f)
						data[dst] = px;
		}
	}

	xfer16x16H(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px, h;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (dst >= 288 * 0x100)
			dst -= 0x10000;
		if ((h = 288 - (dst >> 8)) >= 16) {
			src = (src << 8 & 0xff00) + 16;
			for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx | this.obj[--src]]) !== 0x1f)
						data[dst] = px;
		} else {
			src = (src << 8 & 0xff00) + 16;
			for (let i = h; i !== 0; dst += 256 - 16, src += 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx | this.obj[--src]]) !== 0x1f)
						data[dst] = px;
			dst -= 0x10000;
			for (let i = 16 - h; i !== 0; dst += 256 - 16, src += 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx | this.obj[--src]]) !== 0x1f)
						data[dst] = px;
		}
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px, h;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (dst >= 288 * 0x100)
			dst -= 0x10000;
		if ((h = 288 - (dst >> 8)) >= 16) {
			src = (src << 8 & 0xff00) + 256;
			for (let i = 16; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx | this.obj[--src]]) !== 0x1f)
						data[dst] = px;
		} else {
			src = (src << 8 & 0xff00) + 256;
			for (let i = h; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx | this.obj[--src]]) !== 0x1f)
						data[dst] = px;
			dst -= 0x10000;
			for (let i = 16 - h; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx | this.obj[--src]]) !== 0x1f)
						data[dst] = px;
		}
	}
}

/*
 *
 *	DigDug
 *
 */

const RAM = new Uint8Array(window.atob('\
//f/6/9v//8T/zT/YP8o/////+f///9/3f/5/5z/Ev//f////////2f/rf/L/6L//7P///////8R/wL/AP/A///z/////v+/Ff9M/7j/Rv//////////78z/\
TP/B/7H/////7/////4m/23/Xf9x///d////Pv/8DP+I/4D/Bv//z/+/////+0H/NP8I/yT//////9/9//+//y7/5f9q////////////2/+e/wX/bf//f//3\
/3X/bx//qP8I/6D//7v/5v/f/9ww/xD/IP8N////////////mv+S/3H/dP///////////5v/GP8q/+j/////b//+/98a/0D/JP9E///+/3//3//bEP9A/wL/\
Q////v///////xH/M////+7///7/7/////8r//P/lP8E///+/+7////vAP82/4T/aP//Zv/f/+//+1D/o//g/9T///////////9z/0L/Fv9+//v/////7/+/\
kv+V//z/MP///////17/dw3/Q/8I/3H/////Cv/7//+I/xD/IP8C////////////n/+c/6D/7//////v/////zb/Jf9x//P//73//f/b/9qB/1H/sf8Q////\
//3//f/7Af8F/4H/AP//9///////v/j/ff9p/+n///r///////8m/27/jP+6/////0//X///hP9h/4P/aP/////1/33//yL/gv8s/yr/////e/////9X/53/\
5/8q//////v/////5/90/w3/c////v/7/1n/9RD/AP8g/2j//77/7v/3/18E/wT/HP+X///////////3Yv9t/43/uf//////7////4H/Wf/x/7///7L/v/+n\
/31A/wD/iP82/////+//+/7vEf8C/xT/Af//////////fyv/i/+1/1T///////////9r/6v/C/+3/////3v/f//2AP8A/xD/EP/////b/9f//8D/Fv8O/8D/\
////3//v//9P/1X/3f/g////////////G//1/3H/1f//v///////9wD/MP8B/2D//zn///////8Q/xT/IP8Q//+/////////4//1/03/df///v/v////+8L/\
nf8l/1f//7r/6//f//8Q/2j/Tv8C///u/97//v+/gf+g/wj/BP//f////////wv/qP+h/03/////9v////9b/0r/6v+q//9f/9v/1/+/AP8A/4D/BP//9///\
/7f//wX/AP8C/wX////////3//9F/13/fv+D////////9//7Ef9R/1X/ZP//9P/3/////xH/BP/A/4T//7//7f/v/99i/0b/iP8A//////3/////Yf9T/0b/\
Xf//f////7///1L/3P/x/9P/////7//v//9D/xD/HP/A//////r/+v//5f8B/0D/AP/////v/////5H/lf/D/2X//9f/+/9t/3+//6X/tP+V//9//3//////\
Mv/A/5n/Ev//6//b//7//8r/jP8I/yz////////////L/63/qf+N/////2////+vZ//K/+r/0//////3////uSj/Kf8L/xX//93//f+l//8K/xD/YP8o////\
///////70/+4//r/5/////7//////yH/LP/q/yL//73/+////98C/yD/Cv9Q///v//7///93Av9q/wf/Fv///////////0H/TP9q/2r///f///////+H/9b/\
kv/a/////9v////fEv+a/yj/KP//vv++//7/34H/sf8Q/5n///f//v////5p/3L/pv+m///9////3///yv/J/+n/b////f/2/3f//0T/Bf+l/xL//3//f///\
/7OD/wH/pP9J/////+3///9/m/97/9D////////3////74X/sf/r/+v//9///v9//2+B/wH/IP+h///d////7/9/Fv9Q/w7/hP///v///////+v/2//1/1z/\
//////9///+1/5f/lf+V///f/9/////vgf9E/wX/CP/////7/3v//zv/kP+U//L//////f////93/xX/tP87//9///3/f///1/81/3//vP////9u//f/pwD/\
sP+A/xb//37//////+1A/67/QP9A//9//3v/b/8/2v9a/8j/af//e//z//V//un/+P9o/+v//2v/ef/7//4b/yP/IP+Q//9//+////+v0f9Q/wH/Fv//////\
/7//v9//Vv9x/9v///////9//29k/wb/zf97//9v/7//lf/3UP+j/4H/of//bf/n////94L/5P8s/wD///7///9///+b/0z/Tf9p///7//////+/Xf9v/0v/\
af///v/v/7//vgn/AP9g/yD//7//9/+//70I/wz/Qf8E//////v////d2//L/8z/Vf////+v/+///5P/yf/L/8v//3v/+P/2//uA/0T/ZP+B//9+/77/tv+/\
EP9E/wT/AP//9//3/////5n/X/9b/8n//3/8/fQ///3L/3v/9f9D///+//b/t/+/Uf8A/0H/yP/55f+++r7zthP/mP+p/wL/+f////X/9H53//f/o/+D//3/\
///5+/336/9n/+//9P/28/nb+v3w6GP/FP8k/0H//t/97/Rv839w/yD/BP8U//vf/c/8////uf/N/+X//v/5/f7d/v/8/dv/b//t//T/+Oj///r38n4E/yD/\
EP8A//3R+czzbPDuAP9l/yD/Ev/7f/72///1r37/5v9s/3T///75s/n3+fMl/3b/NP+x//nr+bv0tPfUgf8U/4D/oP/dzRC+/U/d0uWLdqrNd30dX0GwWIZT\
ZZ/vcRVLXfXRxe5xSQL2U3uL3R0R+ehWJl6tgM65udhyltbKz8ka8eS8Mm/+NbIgZSv72vXwQftD9LKWJXj/0sIQ8M0LPQfOdqhTEXN6pDQB/lc0UTia2+t1\
S17yHvNpctB6ekfyH2URdbPSyfDCLZ1OXtmk7/XPRfOjEnGkklcYi1UQjFBoupM/p7xcAxAwpAf+Xund0sXfZf2wNShwvtle9ud2nVDP/XP4S+Iakf8yWPMU\
xLQPbl2v+jnWTPh5WNylSzpF09+dN94WquLbOfpW+18R9/vWfXD78HQ39Drx1QarWXO82YF3Hsb3gX2hpSk+0r/4J3Pdt9YTwdmAmdazNxp5xmK07j1083Tg\
AX7Fe3fu+vVCWt1xtlcycILB/hGi+NI/etinXwvXOuC3Ko2z/hXn+DeBtsj9aH08iVVLWL7O/ZDt83yf+TqTfes8jcTV3xh11vyF0vu9X9hZUx3J2NMamiVc\
N/67MU/pcNggytrF2WFgrdEM4/YsuPJUg0XblxsewQJH5bSAU0y7E0zm89mfcUlG/shVdp0KAuFAbvOhx29UXPS/Xhh+/oTRdlgTfze2xtXnWXVbELPp2VMS\
4VlLVipXX+76nCLtfBVYUXrDwg1t1RXyFd9Z23vdDB57fOb2dw/EfSSTEKMljiv/avNilKfq4WTFx26xZf984sKlR6HCver6SKWiv7Yi80K4ZAOL0MKPx47Y\
91C9uNdmF/0U30N4mmLw762zhBoLLtLmjPn1lqpmMCizud5YylAlwhqtpvCsJpDGnO78NXxkan6jef5G52oFfrdNopHUBlK/TdsHr8lSRIthgdUvx0Lc39uh\
x7ypfvBz+OiwlbNyrLjPu2B692a4LL25pxm/ZtiJ3ueblaVmAM1Q1Lmom2L+ruR7cfPdZtPJ9HFR+Lpgn5w/q0SgyGbpBDXItKIbRMb+ORtvy+BG/KXp0AIy\
o3QqmqGn/3q0Zvap3fm0vMBkYI9Ebj+CyEKP7NDr/YC0ZP6bF739P/JlUJNDoKiW9mBk/tuXPuItYkB8J/mv9AhG75cFb+/A+WLEwkrk+uCRYaC1FaqQaANm\
IWW8ESXqnGK0rHmrdzwNZtMnbsimoxFm7LyvTsy17XZmOJfMa4VUZOhILag1LfRmSK3u8U1IN2CgczuuZ9ydYjq5uFls0GFusMzmnmmb23bSNOSdm8n3Zs3z\
VPQKuOxAsLoA0FiouUKtJndq6VL8Zkc67ezcmF1k3MSaC3co/mKo2KfftKfmZPv1paql/2kyx4q4v410lfLmodE/sdo25CZLy+jiJGlkv5Ryu+j/pkK0Q1MK\
PT6IdHRi77vktW1q3c0Qvv1P3dLli3aqzXd9HV9BsFiGU2Wf73EVS1310cXucUkC9lN7i90dEfnoViZerYDOubnYcpbWys/JGvHkvDJv/jWyIGUr+9r18EH7\
Q/SyliV4/9LCEPDNCz0HznaoUxFzeqQ0Af5XNFE4mtvrdUte8h7zaXLQenpH8h9lEXWz0snwwi2dTl7ZpO/1z0XzoxJxpJJXGItVEIxQaLqTP6e8XAMQMKQH\
/l7p3dLF32X9sDUocL7ZXvbndp1Qz/1z+EviGpH/MljzFMS0D25dr/o51kz4eVjcpUs6RdPfnTfeFqri2zn6VvtfEff71n1w+/B0N/Q68dUGq1lzvNmBdx7G\
94F9oaUpPtK/+Cdz3bfWE8HZgJnWszcaecZitO49dPN04AF+xXt37vr1QlrdcbZXMnCCwf4RovjSP3rYp18L1zrgtyqNs/4V5/g3gbbI/Wh9PIlVS1i+zv2Q\
7fN8n/k6k33rPI3E1d8Yddb8hdL7vV/YWVMdydjTGpolXDf+uzFP6XDYIMraxdlhYK3RDOP2LLjyVINF25cbHsECR+W0gFNMuxNM5vPZn3FJRv7IVXadCgLh\
QG7zocdvVFz0v14Yfv6E0XZYE383tsbV51l1WxCz6dlTEuFZS1YqV1/u+pwi7XwVWFF6w8INbdUV8hXfWdt73Qwee3zm9ncPxH0kkxCjJY4r/2rzYpSn6uFk\
xcdusWX/fOLCpUehwr3q+kilor+2IvNCuGQDi9DCj8eO2PdQvbjXZhf9FN9DeJpi8O+ts4QaCy7S5oz59ZaqZjAos7neWMpQJcIarabwrCaQxpzu/DV8ZGp+\
o3n+RudqBX63TaKR1AZSv03bB6/JUkSLYYHVL8dC3N/boce8qX7wc/josJWzcqy4z7tgevdmuCy9uacZv2bYid7nm5WlZgDNUNS5qJti/q7ke3Hz3WbTyfRx\
Ufi6YJ+cP6tEoMhm6QQ1yLSiG0TG/jkbb8vgRvyl6dACMqN0Kpqhp/96tGb2qd35tLzAZGCPRG4/gshCj+zQ6/2AtGT+mxe9/T/yZVCTQ6ColvZgZP7blz7i\
LWJAfCf5r/QIRu+XBW/vwPlixMJK5PrgkWGgtRWqkGgDZiFlvBEl6pxitKx5q3c8DWbTJ27IpqMRZuy8r07Mte12ZjiXzGuFVGToSC2oNS30Zkit7vFNSDdg\
oHM7rmfcnWI6ubhZbNBhbrDM5p5pm9t20jTknZvJ92bN81T0CrjsQLC6ANBYqLlCrSZ3aulS/GZHOu3s3JhdZNzEmgt3KP5iqNin37Sn5mT79aWqpf9pMseK\
uL+NdJXy5qHRP7HaNuQmS8vo4iRpZL+Ucrvo/6ZCtENTCj0+iHR0Yu+75LVtagPiM0O06ah3nc4Ojv05Zb5fLSPA4D+egA3H+AlKXkokrrt/TpJyqPk3RRy/\
qxLkc36aUt2hFYb3cYPtr7P/AyTdIifdnbH2NDzdsP2dqMGzHWV7v4/JdahP1xIchJ7el9qTwroPvtb0LYkGPCtGL2dXpsc4PDKE2/eVSJaH3pD3PR/PpjYs\
LZycFyXSfeA7xeb4fampHurf50Jk6lItlw+tKSCRJtHt92WPndL+FnydtZGq1Pala91fIeT8rc9mF3so1ZOiqPDus6jt6w1Vwnulgvetn93e9X9Ms/kdOYn7\
97Zv7cxf/Wzbny99ph+w6bcdhCcakPTRDW4J5bUzjvU3o9P2B/29tm+T3X3UleK9+/d5p9hy8I21NwuedZ/dB+8ft9I8faPdParcFHVT+6uoK/qi96iONO0T\
d+7rhoEWXUgQr6RpM+cdrQYt8W4MDf3708nyXoWNpYZcuV3HjVTvXgCEW6/1hYtHztLS9dhUnkeus/Xp7fxVi6X3pduDhfZEB9QxTtbQSg0ljnmVXYB52eu4\
hZ0YXn9R2KuZVhNy//irvbQZ9sYclJQcg/9dw+qlEL1BWTAyT4dzmJvlhnuNWJWNAKYsiH2pDnZpnZV1ltWVtwWx7H8H88pOoD9JkblZ8M1wd89ldb27XI+6\
Ag1v8M3qIfx1/00PedWkExTbO8vieg5p1r8rGO/+rooqJib+291YPc1mSgdMCRxaJibr2A6vX/rZchOqO5iMjn1GGjvafpMMKuZpi4SqWZwnAv6iffx/xxJm\
OfqR2VDOUybctR8q/so3Rur+mhv+y5jOr5LadP9+kib5xi7uegauZmI2Clv5KIzmwhlMV1rSkWK+HMqqZ+9PJqUQWBpPLCsnyliOsiv1/8bSHE+ssY6SbpjO\
L4YbjHpuC6ktjU06K2aPnzHyJ8xpJlodgv6dzHxOZCq6f+qq6ibDXk8vv+9r7vKMX7fK027mPdoaovSfDmVIcrvteu74Bm6LHX75Kyhm0Jbf4S44/3fMJ5bb\
rCYejFKe+sqqK0xC7ufq+JqdKQezs/Khfsn/bq6HE4HvqJgPTZM3u40a+GZxOc71wEfrp3bv/7wv75tGCvoPioopZgYgbur8Gw6cJzB4o8tVCzguw6uZ69IS\
fmRritwqjj+MYoqWsttCr+5mYusYD7aGyWb0DkZLCaH6Zsb+j0/3nb5ms/oRPpkA+qZqCj+ia4YKZg68mL9p2qjWmc54elqKCGquHS7dzx3KJl3CaQ7+qjRm\
SP2RzqC4LCbCpUJlKpsnZgsSLg6BsNpi5Q4PalZSrEYu09Rfr/7ZZoq3C6R0AgpKsNV9Pfm/rmagA+JYuxqRYiPMiEriEvJGLIlXu7oTS0YD4jNDtOmod53O\
Do79OWW+Xy0jwOA/noANx/gJSl5KJK67f06Scqj5N0Ucv6sS5HN+mlLdoRWG93GD7a+z/wMk3SIn3Z2x9jQ83bD9najBsx1le7+PyXWoT9cSHISe3pfak8K6\
D77W9C2JBjwrRi9nV6bHODwyhNv3lUiWh96Q9z0fz6Y2LC2cnBcl0n3gO8Xm+H2pqR7q3+dCZOpSLZcPrSkgkSbR7fdlj53S/hZ8nbWRqtT2pWvdXyHk/K3P\
Zhd7KNWToqjw7rOo7esNVcJ7pYL3rZ/d3vV/TLP5HTmJ+/e2b+3MX/1s258vfaYfsOm3HYQnGpD00Q1uCeW1M471N6PT9gf9vbZvk9191JXivfv3eafYcvCN\
tTcLnnWf3QfvH7fSPH2j3T2q3BR1U/urqCv6oveojjTtE3fu64aBFl1IEK+kaTPnHa0GLfFuDA39+9PJ8l6FjaWGXLldx41U714AhFuv9YWLR87S0vXYVJ5H\
rrP16e38VYul96Xbg4X2RAfUMU7W0EoNJY55lV2AednruIWdGF5/UdirmVYTcv/4q720GfbGHJSUHIP/XcPqpRC9QVkwMk+Hc5ib5YZ7jViVjQCmLIh9qQ52\
aZ2VdZbVlbcFsex/B/PKTqA/SZG5WfDNcHfPZXW9u1yPugINb/DN6iH8df9ND3nVpBMU2zvL4noOada/Kxjv/q6KKiYm/tvdWD3NZkoHTAkcWiYm69gOr1/6\
2XITqjuYjI59Rho72n6TDCrmaYuEqlmcJwL+on38f8cSZjn6kdlQzlMm3LUfKv7KN0bq/pob/suYzq+S2nT/fpIm+cYu7noGrmZiNgpb+SiM5sIZTFda0pFi\
vhzKqmfvTyalEFgaTywrJ8pYjrIr9f/G0hxPrLGOkm6Yzi+GG4x6bgupLY1NOitmj58x8ifMaSZaHYL+ncx8TmQqun/qquomw15PL7/va+7yjF+3ytNu5j3a\
GqL0nw5lSHK77Xru+AZuix1++SsoZtCW3+EuOP93zCeW26wmHoxSnvrKqitMQu7n6vianSkHs7PyoX7J/26uhxOB76iYD02TN7uNGvhmcTnO9cBH66d27/+8\
L++bRgr6D4qKKWYGIG7q/BsOnCcweKPLVQs4LsOrmevSEn5ka4rcKo4/jGKKlrLbQq/uZmLrGA+2hslm9A5GSwmh+mbG/o9P952+ZrP6ET6ZAPqmago/omuG\
CmYOvJi/adqo1pnOeHpaighqrh0u3c8dyiZdwmkO/qo0Zkj9kc6guCwmwqVCZSqbJ2YLEi4OgbDaYuUOD2pWUqxGLtPUX6/+2WaKtwukdAIKSrDVfT35v65m\
oAPiWLsakWIjzIhK4hLyRiyJV7u6E0tG/ON8EzQybct9ZXzdneVo63epd12WF0nD/CS47eMJaaX/nymlfKPbXv4WKfSP/WGdf3Mpgdf2nmSd/rgJk3xU/f4Y\
j43Ybsv+M9CO99O/mvXWSojRJcHrYuRUbenD/5cSf6moOvG1Kkal1bjOK3c890/LnwJDsWl3e9bQZkMfi7Rj/V+8yTVGwXX9qZzH1bP+QdDgf4EZup//yOvd\
dc3dXlaYu5SXbgb3gFPk/71z7VD9tMdtcBk/2kc0TQhBRJeR1WFC1A2bArb/Tjur+9Nnz6/X0pbds1r+fBi6ynPFsU1m5Dqf/ObDmoXvaCMaAc33XsDVPxEz\
2px92hvw2LLxxfyl8Uxx+ftXr19Ur/Y9/kf2nmXZjbrNBXH3t506SBCc129U2BKl9EflyllySen5Ud2HZ18B669nt6VgRvmftLpYHFMCEbzl+83t1vI3+ZcB\
f05ECLL73cDrqRJfTaeRtv/KDdjmOnq58uDz75KVXQ27ZmnZrT+6Wd18Vjz55SUj4cBSj48mWG96/tY/SEP4tteUxbcpzxsX/0l+XvWlGVD9Obuvgs1IZcuG\
W+8WPaU95T4U+beuP9QPDVb9yvXJiZLysznph+PPq2/crJRVlPYhPA+6zom7rv+ffWTfqd98hT0b6l8/wAP39e2y72t3gtTd/eV1yd3d5ye8PuV/5uXpM6jr\
YxTP/6r0r++2vQziK1zcGyaj2eYQCZgorZL6ZnkzuiswPp9yOd56novOTvZdbuv2ScvaRrOvSnuOqsLmN/bf3du77uNjZyrj+7KcJ9y76YimUktm97otnCbq\
w2biIIJzGK7IZrOeyZzip+9mEn2P0sKxrmZKmJvYy3/RZqap6MpUrSpWhPn5rM3Os3b8+GLhhg6ODmdTrY4qmOpm0gxr9/MC8nSK8Ov2+ePDZufuqSyKtkFm\
Ka0PimyEjW61htzZhu8RZvsY786CmP9mn5kqa35vCwba3bWLCDIcZj7GcnuyjqhGKIv88Z4Zr0aTKJstcaZIkrM4GbtTrGrmoCS9rmLJFGa4flOC/qPoZiya\
evAP+IhGalru7aL8Z2Zup5//Y/7eZovL8v3D7d9OR6vvq1L5S3b531y+YqPV5gjuqAAjIuPm1vuiKqLtw2666XkZT7lKYm+Oju6W/aDupol5mu17a33Cyt5O\
3K3WdrgYyXs4qj5i4Jjnq4fqBubTF8pLN52SJu0yMM7Op/9m36oPt6n3pyfzZL4Y745tZsXee7nqqBFmLlZuupu7gma2GRv+RLiy5unkFLs+6yJmm0+FqDvb\
u3aG/GySTZ5cdsbHm2ubn7b2B68q6gzFe249fPLaP3dTRuF/6/PQyfcm9ovtiiCndmaXLrczmd4/ZvzjfBM0Mm3LfWV83Z3laOt3qXddlhdJw/wkuO3jCWml\
/58ppXyj217+Fin0j/1hnX9zKYHX9p5knf64CZN8VP3+GI+N2G7L/jPQjvfTv5r11kqI0SXB62LkVG3pw/+XEn+pqDrxtSpGpdW4zit3PPdPy58CQ7Fpd3vW\
0GZDH4u0Y/1fvMk1RsF1/amcx9Wz/kHQ4H+BGbqf/8jr3XXN3V5WmLuUl24G94BT5P+9c+1Q/bTHbXAZP9pHNE0IQUSXkdVhQtQNmwK2/047q/vTZ8+v19KW\
3bNa/nwYuspzxbFNZuQ6n/zmw5qF72gjGgHN917A1T8RM9qcfdob8Niy8cX8pfFMcfn7V69fVK/2Pf5H9p5l2Y26zQVx97edOkgQnNdvVNgSpfRH5cpZcknp\
+VHdh2dfAeuvZ7elYEb5n7S6WBxTAhG85fvN7dbyN/mXAX9ORAiy+93A66kSX02nkbb/yg3Y5jp6ufLg8++SlV0Nu2Zp2a0/ulndfFY8+eUlI+HAUo+PJlhv\
ev7WP0hD+LbXlMW3Kc8bF/9Jfl71pRlQ/Tm7r4LNSGXLhlvvFj2lPeU+FPm3rj/UDw1W/cr1yYmS8rM56Yfjz6tv3KyUVZT2ITwPus6Ju67/n31k36nffIU9\
G+pfP8AD9/Xtsu9rd4LU3f3ldcnd3ecnvD7lf+bl6TOo62MUz/+q9K/vtr0M4itc3Bsmo9nmEAmYKK2S+mZ5M7orMD6fcjneep6Lzk72XW7r9knL2kazr0p7\
jqrC5jf2393bu+7jY2cq4/uynCfcu+mIplJLZve6LZwm6sNm4iCCcxiuyGaznsmc4qfvZhJ9j9LCsa5mSpib2Mt/0WamqejKVK0qVoT5+azNzrN2/Phi4YYO\
jg5nU62OKpjqZtIMa/fzAvJ0ivDr9vnjw2bn7qksirZBZimtD4pshI1utYbc2YbvEWb7GO/Ogpj/Zp+ZKmt+bwsG2t21iwgyHGY+xnJ7so6oRiiL/PGeGa9G\
kyibLXGmSJKzOBm7U6xq5qAkva5iyRRmuH5Tgv6j6GYsmnrwD/iIRmpa7u2i/Gdmbqef/2P+3maLy/L9w+3fTker76tS+Ut2+d9cvmKj1eYI7qgAIyLj5tb7\
oiqi7cNuuul5GU+5SmJvjo7ulv2g7qaJeZrte2t9wsreTtyt1na4GMl7OKo+YuCY56uH6gbm0xfKSzedkibtMjDOzqf/Zt+qD7ep96cn82S+GO+ObWbF3nu5\
6qgRZi5Wbrqbu4Jmthkb/kS4subp5BS7PusiZptPhag727t2hvxskk2eXHbGx5trm5+29gevKuoMxXtuPXzy2j93U0bhf+vz0Mn3JvaL7Yogp3Zmly63M5ne\
P2Y=\
').split('').map(c => c.charCodeAt(0)));

/*
 *
 *	DigDug
 *
 */

let PRG1, PRG2, PRG3, BG2, MAPDATA, BG4, OBJ, SND, BGCOLOR, OBJCOLOR, RGB, IO;

read('digdug.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG1 = Uint8Array.concat(...['dd1a.1', 'dd1a.2', 'dd1a.3', 'dd1a.4'].map(e => zip.decompress(e))).addBase();
	PRG2 = Uint8Array.concat(...['dd1a.5', 'dd1a.6'].map(e => zip.decompress(e))).addBase();
	PRG3 = zip.decompress('dd1.7').addBase();
	BG2 = zip.decompress('dd1.9');
	OBJ = Uint8Array.concat(...['dd1.15', 'dd1.14', 'dd1.13', 'dd1.12'].map(e => zip.decompress(e)));
	BG4 = zip.decompress('dd1.11');
	MAPDATA = zip.decompress('dd1.10b');
	RGB = zip.decompress('136007.113');
	OBJCOLOR = zip.decompress('136007.111');
	BGCOLOR = zip.decompress('136007.112');
	SND = zip.decompress('136007.110');
}).then(() =>read('namco51.zip')).then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	IO = zip.decompress('51xx.bin');
	game = new DigDug();
	sound = new PacManSound({SND, resolution: 2});
	canvas.addEventListener('click', () => game.coin());
	init({game, sound});
});

