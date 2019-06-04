/*
 *
 *	Galaga
 *
 */

import PacManSound from './pac-man_sound.js';
import SoundEffect from './sound_effect.js';
import Cpu, {init, loop} from './main.js';
import Z80 from './z80.js';
let game, sound;

class Galaga {
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
		this.dwCoin = 0;
		this.dwStick = 0;
		this.abStick = Uint8Array.of(0xff, 0xff, 0xfd, 0xff, 0xff, 0xff, 0xfd, 0xfd, 0xf7, 0xf7, 0xff, 0xff, 0xff, 0xf7, 0xff, 0xff);
		this.abStick2 = Uint8Array.of(~0, ~1, ~2, ~1, ~4, ~0, ~2, ~2, ~8, ~8, ~0, ~1, ~4, ~8, ~4, ~0);
		this.dwButton = 0;
		this.nMyShip = 3;
		this.nRank = 'NORMAL';
		this.nBonus = 'B';
		this.fAttract = true;

		// CPU周りの初期化
		this.fInterruptEnable0 = false;
		this.fInterruptEnable1 = false;
		this.fNmiEnable = false;
		this.fSoundEnable = false;
		this.dwMode = 0;

		this.ram = new Uint8Array(0x2000).addBase();
		this.mmi = new Uint8Array(0x100).fill(0xff);
		this.mmo = new Uint8Array(0x100);
		this.count = 0;
		this.keyport = new Uint8Array(0x100);
		this.dmaport = new Uint8Array(0x100).fill(0x10);
		this.ioport = new Uint8Array(0x100).fill(0xff);
		this.starport = new Uint8Array(0x100).fill(0xff);

		this.cpu = [];
		for (let i = 0; i < 3; i++)
			this.cpu[i] = new Z80(this);

		/* CPU0 ROM AREA SETUP */
		for (let i = 0; i < 0x40; i++)
			this.cpu[0].memorymap[i].base = PRG1.base[i];

		/* CPU1 ROM AREA SETUP */
		for (let i = 0; i < 0x10; i++)
			this.cpu[1].memorymap[i].base = PRG2.base[i];

		/* CPU2 ROM AREA SETUP */
		for (let i = 0; i < 0x10; i++)
			this.cpu[2].memorymap[i].base = PRG3.base[i];

		/* CPU[012] RAM AREA SETUP */
		for (let i = 0; i < 3; i++) {
			for (let j = 0; j < 8; j++) {
				this.cpu[i].memorymap[0x80 + j].base = this.ram.base[j];
				this.cpu[i].memorymap[0x80 + j].write = null;
			}
			for (let j = 0; j < 4; j++) {
				this.cpu[i].memorymap[0x88 + j].base = this.ram.base[8 + j];
				this.cpu[i].memorymap[0x88 + j].write = null;
				this.cpu[i].memorymap[0x90 + j].base = this.ram.base[0x0c + j];
				this.cpu[i].memorymap[0x90 + j].write = null;
				this.cpu[i].memorymap[0x98 + j].base = this.ram.base[0x10 + j];
				this.cpu[i].memorymap[0x98 + j].write = null;
			}
		}
		this.cpu[0].memorymap[0x68].base = this.mmi;
		this.cpu[0].memorymap[0x68].write = systemctrl0;
		this.cpu[1].memorymap[0x68].base = this.mmi;
		this.cpu[1].memorymap[0x68].write = systemctrl0;
		this.cpu[2].memorymap[0x68].base = this.mmi;
		this.cpu[2].memorymap[0x68].write = systemctrl1;

		this.cpu[0].memorymap[0x70].base = this.ioport;
		this.cpu[0].memorymap[0x71].base = this.dmaport;
		this.cpu[0].memorymap[0x71].write = dmactrl;
		this.cpu[0].memorymap[0xa0].base = this.starport;
		this.cpu[0].memorymap[0xa0].write = starctrl;
		this.cpu[0].memorymap[0xb1].base = this.keyport;

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
		this.stars = [];
		for (let i = 0; i < 1024; i++)
			this.stars.push({x: 0, y: 0, color: 0, blk: 0});
		this.fFlip = true;
		this.fStarEnable = false;
		this.bg = new Uint32Array(0x100000);
		this.obj = new Uint8Array(0x10000);
		this.objcolor = new Uint32Array(0x100);
		this.rgb = new Uint32Array(0x20);
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();
		this.initializeStar();

		// 効果音の初期化
		this.se = [{buf: BOMB, loop: false, start: false, stop: false}];

		// ライトハンドラ
		function systemctrl0(addr, data, game) {
			switch (addr & 0xf0) {
			case 0x00:
			case 0x10:
				break;
			case 0x20:
				switch (addr & 0x0f) {
				case 0:
					game.fInterruptEnable0 = (data & 1) !== 0;
					break;
				case 1:
					game.fInterruptEnable1 = (data & 1) !== 0;
					break;
				case 2:
					if (data)
						game.fSoundEnable = true;
					else {
						game.fSoundEnable = false;
						game.se[0].stop = true;
					}
					break;
				case 3:
					if (data) {
						game.cpu[1].enable();
						game.cpu[2].enable();
					}
					else {
						game.cpu[1].disable();
						game.cpu[2].disable();
					}
					break;
				}
			default:
				game.mmo[addr & 0xff] = data;
				break;
			}
		}

		function systemctrl1(addr, data, game) {
			switch (addr & 0xf0) {
			case 0x00:
			case 0x10:
				sound[0].write(addr, data, game.count);
				break;
			case 0x20:
				break;
			default:
				game.mmo[addr & 0xff] = data;
				break;
			}
		}

		function dmactrl(addr, data, game) {
			this.base[addr & 0xff] = data;
			switch (data) {
			case 0x10:
				game.fNmiEnable = false;
				return;
			case 0x71:
				if (!game.dwMode)
					game.ioport[0] = game.dwCoin / 10 << 4 | game.dwCoin % 10;
				else if (game.fTest)
					game.ioport[0] = 0;
				else
					game.ioport[0] = 0xff;
				if (game.fTest)
					game.ioport[2] = game.ioport[1] = game.abStick2[game.dwStick] & ~game.dwButton;
				else {
					game.ioport[2] = game.ioport[1] = game.abStick[game.dwStick] & ~game.dwButton;
					game.dwButton &= 0x20;
				}
				break;
			case 0xa1:
				game.dwMode = 1;
				break;
			case 0xa8:
				game.se[0].start = game.se[0].stop = true;
				break;
			case 0xb1:
				game.dwCoin = 0;
				game.ioport[2] = game.ioport[1] = game.ioport[0] = 0;
				break;
			case 0xc1:
				game.dwMode = 0;
				break;
			case 0xe1:
				game.dwMode = 0;
				game.ram[0x11b8] = game.ram[0x11b7] = game.ram[0x11b6] = game.ram[0x11b5] = 0;
				break;
			case 0xd2:
				game.ioport[0] = game.mmi[0];
				game.ioport[1] = game.mmi[1];
				break;
			}
			game.fNmiEnable = true;
		}

		function starctrl(addr, data, game) {
			switch (addr & 0xff) {
			case 0x05:
				game.fStarEnable = (data & 1) !== 0;
				break;
			case 0x07:
				game.fFlip = !game.fTest && (data & 1) !== 0;
			default:
				this.base[addr & 0xff] = data;
				break;
			}
		}
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
				this.mmi[6] &= ~1;
				this.mmi[7] &= ~1;
				break;
			case 3:
				this.mmi[6] &= ~1;
				this.mmi[7] |= 1;
				break;
			case 4:
				this.mmi[6] |= 1;
				this.mmi[7] &= ~1;
				break;
			case 5:
				this.mmi[6] |= 1;
				this.mmi[7] |= 1;
				break;
			}
			switch (this.nRank) {
			case 'EASY':
				this.mmi[0] |= 2;
				this.mmi[1] |= 2;
				break;
			case 'NORMAL':
				this.mmi[0] &= ~2;
				this.mmi[1] &= ~2;
				break;
			case 'HARD':
				this.mmi[0] |= 2;
				this.mmi[1] &= ~2;
				break;
			case 'VERY HARD':
				this.mmi[0] &= ~2;
				this.mmi[1] |= 2;
				break;
			}
			switch (this.nBonus) {
			case 'A':
				this.mmi[3] &= ~1;
				this.mmi[4] &= ~1;
				this.mmi[5] |= 1;
				break;
			case 'B':
				this.mmi[3] &= ~1;
				this.mmi[4] |= 1;
				this.mmi[5] &= ~1;
				break;
			case 'C':
				this.mmi[3] &= ~1;
				this.mmi[4] |= 1;
				this.mmi[5] |= 1;
				break;
			case 'D':
				this.mmi[3] |= 1;
				this.mmi[4] &= ~1;
				this.mmi[5] &= ~1;
				break;
			case 'E':
				this.mmi[3] |= 1;
				this.mmi[4] &= ~1;
				this.mmi[5] |= 1;
				break;
			case 'F':
				this.mmi[3] |= 1;
				this.mmi[4] |= 1;
				this.mmi[5] &= ~1;
				break;
			case 'G':
				this.mmi[3] |= 1;
				this.mmi[4] |= 1;
				this.mmi[5] |= 1;
				break;
			case 'NONE':
				this.mmi[3] &= ~1;
				this.mmi[4] &= ~1;
				this.mmi[5] &= ~1;
				break;
			}
			if (this.fAttract)
				this.mmi[3] &= ~2;
			else
				this.mmi[3] |= 2;
			if (!this.fTest)
				this.fReset = true;
		}

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.fSoundEnable = false;
			this.se[0].stop = true;
			this.dwCoin = 0;
			this.fInterruptEnable0 = this.fInterruptEnable1 = false;
			this.cpu[0].reset();
			this.cpu[1].disable();
			this.cpu[2].disable();
			this.fStarEnable = false;
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if (this.fCoin && ++this.dwCoin > 99)
			this.dwCoin = 99;
		if (this.fStart1P && this.ram[0x0e01] === 2 && this.dwCoin)
			--this.dwCoin;
		if (this.fStart2P && this.ram[0x0e01] === 2 && this.dwCoin >= 2)
			this.dwCoin -= 2;
		this.fCoin = this.fStart1P = this.fStart2P = false;
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
	}

	right(fDown) {
		if (fDown)
			this.dwStick = this.dwStick & ~(1 << 3) | 1 << 1;
		else
			this.dwStick &= ~(1 << 1);
	}

	down(fDown) {
	}

	left(fDown) {
		if (fDown)
			this.dwStick = this.dwStick & ~(1 << 1) | 1 << 3;
		else
			this.dwStick &= ~(1 << 3);
	}

	triggerA(fDown) {
		this.dwButton = fDown ? 0x30 : 0;
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
		// 4 color bg
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
		for (let p = 0, i = 0; i < 64; i++)
			for (let j = 0x4000; j !== 0; p++, --j)
				this.bg[p] = this.rgb[BGCOLOR[i * 4 + this.bg[p]] & 0x0f | 0x10];
	}

	convertOBJ() {
		// obj palette
		for (let i = 0; i < 0x100; i++)
			this.objcolor[i] = this.rgb[OBJCOLOR[i] & 0x0f];

		// 4 color object
		this.obj.fill(3);
		for (let p = 0, q = 0, i = 128; i !== 0; q += 64, --i) {
			for (let j = 3; j >= 0; --j) {
				for (let k = 39; k >= 32; --k)
					this.obj[p++] = OBJ[q + k] >>> j & 1 | OBJ[q + k] >>> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k] >>> j & 1 | OBJ[q + k] >>> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 47; k >= 40; --k)
					this.obj[p++] = OBJ[q + k] >>> j & 1 | OBJ[q + k] >>> (j + 3) & 2;
				for (let k = 15; k >= 8; --k)
					this.obj[p++] = OBJ[q + k] >>> j & 1 | OBJ[q + k] >>> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 55; k >= 48; --k)
					this.obj[p++] = OBJ[q + k] >>> j & 1 | OBJ[q + k] >>> (j + 3) & 2;
				for (let k = 23; k >= 16; --k)
					this.obj[p++] = OBJ[q + k] >>> j & 1 | OBJ[q + k] >>> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 63; k >= 56; --k)
					this.obj[p++] = OBJ[q + k] >>> j & 1 | OBJ[q + k] >>> (j + 3) & 2;
				for (let k = 31; k >= 24; --k)
					this.obj[p++] = OBJ[q + k] >>> j & 1 | OBJ[q + k] >>> (j + 3) & 2;
			}
		}
	}

	initializeStar() {
		let color;

		for (let sr = 0, i = 0, x = 223; x >= 0; --x) {
			for (let y = 0; y < 288; y++) {
				const cy = ~sr << 5 ^ ~sr << 10 ^ ~sr << 12 ^ sr << 15;
				sr = cy & 0x8000 | sr >>> 1;
				if ((sr & 0xf429) === 0xf000 && (color = sr << 1 & 0x20 | sr << 2 & 0x18 | sr >>> 6 & 0x07) !== 0) {
					this.stars[i].x = x;
					this.stars[i].y = y;
					this.stars[i].color = (color << 1 & 6) * 255 / 7	// Red
						| (color >>> 1 & 6) * 255 / 7 << 8				// Green
						| (color >>> 4) * 255 / 3 << 16;				// Blue
					this.stars[i].blk = sr >>> 11 & 1 | sr >>> 8 & 2;
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
		// bg 描画
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
		}
		else {
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
			for (let p = 0xb80, i = 64; i !== 0; p += 2, --i) {
				const y = this.ram[p + 0x401] + this.ram[p + 0x801] * 0x100 - 24 & 0x1ff;
				const x = this.ram[p + 0x400] - 1 & 0xff;
				switch (this.ram[p + 0x800] & 0x0f) {
				case 0x00: // ノーマル
					this.xfer16x16(data, x | y << 8, this.ram[p] | this.ram[p + 1] << 8);
					break;
				case 0x01: // V反転
					this.xfer16x16V(data, x | y << 8, this.ram[p] | this.ram[p + 1] << 8);
					break;
				case 0x02: // H反転
					this.xfer16x16H(data, x | y << 8, this.ram[p] | this.ram[p + 1] << 8);
					break;
				case 0x03: // HV反転
					this.xfer16x16HV(data, x | y << 8, this.ram[p] | this.ram[p + 1] << 8);
					break;
				case 0x04: // ノーマル
					this.xfer16x16(data, x | y << 8, this.ram[p] & ~1 | this.ram[p + 1] << 8);
					this.xfer16x16(data, x | (y + 16 & 0x1ff) << 8, this.ram[p] | this.ram[p + 1] << 8 | 1);
					break;
				case 0x05: // V反転
					this.xfer16x16V(data, x | y << 8, this.ram[p] | this.ram[p + 1] << 8 | 1);
					this.xfer16x16V(data, x | (y + 16 & 0x1ff) << 8, this.ram[p] & ~1 | this.ram[p + 1] << 8);
					break;
				case 0x06: // H反転
					this.xfer16x16H(data, x | y << 8, this.ram[p] & ~1 | this.ram[p + 1] << 8);
					this.xfer16x16H(data, x | (y + 16 & 0x1ff) << 8, this.ram[p] | this.ram[p + 1] << 8 | 1);
					break;
				case 0x07: // HV反転
					this.xfer16x16HV(data, x | y << 8, this.ram[p] | this.ram[p + 1] << 8 | 1);
					this.xfer16x16HV(data, x | (y + 16 & 0x1ff) << 8, this.ram[p] & ~1 | this.ram[p + 1] << 8);
					break;
				case 0x08: // ノーマル
					this.xfer16x16(data, x | y << 8, this.ram[p] | this.ram[p + 1] << 8 | 2);
					this.xfer16x16(data, x + 16 & 0xff | y << 8, this.ram[p] & ~2 | this.ram[p + 1] << 8);
					break;
				case 0x09: // V反転
					this.xfer16x16V(data, x | y << 8, this.ram[p] | this.ram[p + 1] << 8 | 2);
					this.xfer16x16V(data, x + 16 & 0xff | y << 8, this.ram[p] & ~2 | this.ram[p + 1] << 8);
					break;
				case 0x0a: // H反転
					this.xfer16x16H(data, x | y << 8, this.ram[p] & ~2 | this.ram[p + 1] << 8);
					this.xfer16x16H(data, x + 16 & 0xff | y << 8, this.ram[p] | this.ram[p + 1] << 8 | 2);
					break;
				case 0x0b: // HV反転
					this.xfer16x16HV(data, x | y << 8, this.ram[p] & ~2 | this.ram[p + 1] << 8);
					this.xfer16x16HV(data, x + 16 & 0xff | y << 8, this.ram[p] | this.ram[p + 1] << 8 | 2);
					break;
				case 0x0c: // ノーマル
					this.xfer16x16(data, x | y << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8 | 2);
					this.xfer16x16(data, x | (y + 16 & 0x1ff) << 8, this.ram[p] | this.ram[p + 1] << 8 | 3);
					this.xfer16x16(data, x + 16 & 0xff | y << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8);
					this.xfer16x16(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8 | 1);
					break;
				case 0x0d: // V反転
					this.xfer16x16V(data, x | y << 8, this.ram[p] | this.ram[p + 1] << 8 | 3);
					this.xfer16x16V(data, x | (y + 16 & 0x1ff) << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8 | 2);
					this.xfer16x16V(data, x + 16 & 0xff | y << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8 | 1);
					this.xfer16x16V(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8);
					break;
				case 0x0e: // H反転
					this.xfer16x16H(data, x | y << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8);
					this.xfer16x16H(data, x | (y + 16 & 0x1ff) << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8 | 1);
					this.xfer16x16H(data, x + 16 & 0xff | y << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8 | 2);
					this.xfer16x16H(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, this.ram[p] | this.ram[p + 1] << 8 | 3);
					break;
				case 0x0f: // HV反転
					this.xfer16x16HV(data, x | y << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8 | 1);
					this.xfer16x16HV(data, x | (y + 16 & 0x1ff) << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8);
					this.xfer16x16HV(data, x + 16 & 0xff | y << 8, this.ram[p] | this.ram[p + 1] << 8 | 3);
					this.xfer16x16HV(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8 | 2);
					break;
				}
			}
		else
			for (let p = 0xb80, i = 64; i !== 0; p += 2, --i) {
				const y = this.ram[p + 0x401] + this.ram[p + 0x801] * 0x100 - 24 & 0x1ff;
				const x = this.ram[p + 0x400] - 1 & 0xff;
				switch (this.ram[p + 0x800] & 0x0f) {
				case 0x00: // ノーマル
					this.xfer16x16HV(data, x | y << 8, this.ram[p] | this.ram[p + 1] << 8);
					break;
				case 0x01: // V反転
					this.xfer16x16H(data, x | y << 8, this.ram[p] | this.ram[p + 1] << 8);
					break;
				case 0x02: // H反転
					this.xfer16x16V(data, x | y << 8, this.ram[p] | this.ram[p + 1] << 8);
					break;
				case 0x03: // HV反転
					this.xfer16x16(data, x | y << 8, this.ram[p] | this.ram[p + 1] << 8);
					break;
				case 0x04: // ノーマル
					this.xfer16x16HV(data, x | y << 8, this.ram[p] | this.ram[p + 1] << 8 | 1);
					this.xfer16x16HV(data, x | (y + 16 & 0x1ff) << 8, this.ram[p] & ~1 | this.ram[p + 1] << 8);
					break;
				case 0x05: // V反転
					this.xfer16x16H(data, x | y << 8, this.ram[p] & ~1 | this.ram[p + 1] << 8);
					this.xfer16x16H(data, x | (y + 16 & 0x1ff) << 8, this.ram[p] | this.ram[p + 1] << 8 | 1);
					break;
				case 0x06: // H反転
					this.xfer16x16V(data, x | y << 8, this.ram[p] | this.ram[p + 1] << 8 | 1);
					this.xfer16x16V(data, x | (y + 16 & 0x1ff) << 8, this.ram[p] & ~1 | this.ram[p + 1] << 8);
					break;
				case 0x07: // HV反転
					this.xfer16x16(data, x | y << 8, this.ram[p] & ~1 | this.ram[p + 1] << 8);
					this.xfer16x16(data, x | (y + 16 & 0x1ff) << 8, this.ram[p] | this.ram[p + 1] << 8 | 1);
					break;
				case 0x08: // ノーマル
					this.xfer16x16HV(data, x | y << 8, this.ram[p] & ~2 | this.ram[p + 1] << 8);
					this.xfer16x16HV(data, x + 16 & 0xff | y << 8, this.ram[p] | this.ram[p + 1] << 8 | 2);
					break;
				case 0x09: // V反転
					this.xfer16x16H(data, x | y << 8, this.ram[p] & ~2 | this.ram[p + 1] << 8);
					this.xfer16x16H(data, x + 16 & 0xff | y << 8, this.ram[p] | this.ram[p + 1] << 8 | 2);
					break;
				case 0x0a: // H反転
					this.xfer16x16V(data, x | y << 8, this.ram[p] | this.ram[p + 1] << 8 | 2);
					this.xfer16x16V(data, x + 16 & 0xff | y << 8, this.ram[p] & ~2 | this.ram[p + 1] << 8);
					break;
				case 0x0b: // HV反転
					this.xfer16x16(data, x | y << 8, this.ram[p] | this.ram[p + 1] << 8 | 2);
					this.xfer16x16(data, x + 16 & 0xff | y << 8, this.ram[p] & ~2 | this.ram[p + 1] << 8);
					break;
				case 0x0c: // ノーマル
					this.xfer16x16HV(data, x | y << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8 | 1);
					this.xfer16x16HV(data, x | (y + 16 & 0x1ff) << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8);
					this.xfer16x16HV(data, x + 16 & 0xff | y << 8, this.ram[p] | this.ram[p + 1] << 8 | 3);
					this.xfer16x16HV(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8 | 2);
					break;
				case 0x0d: // V反転
					this.xfer16x16H(data, x | y << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8);
					this.xfer16x16H(data, x | (y + 16 & 0x1ff) << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8 | 1);
					this.xfer16x16H(data, x + 16 & 0xff | y << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8 | 2);
					this.xfer16x16H(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, this.ram[p] | this.ram[p + 1] << 8 | 3);
					break;
				case 0x0e: // H反転
					this.xfer16x16V(data, x | y << 8, this.ram[p] | this.ram[p + 1] << 8 | 3);
					this.xfer16x16V(data, x | (y + 16 & 0x1ff) << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8 | 2);
					this.xfer16x16V(data, x + 16 & 0xff | y << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8 | 1);
					this.xfer16x16V(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8);
					break;
				case 0x0f: // HV反転
					this.xfer16x16(data, x | y << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8 | 2);
					this.xfer16x16(data, x | (y + 16 & 0x1ff) << 8, this.ram[p] | this.ram[p + 1] << 8 | 3);
					this.xfer16x16(data, x + 16 & 0xff | y << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8);
					this.xfer16x16(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, this.ram[p] & ~3 | this.ram[p + 1] << 8 | 1);
					break;
				}
			}

		// star 描画 
		if (!this.fTest && this.fStarEnable) {
			let p = 256 * 16 + 16;
			for (let i = 0; i < 256 && this.stars[i].color; i++) {
				const y = this.stars[i].y;
				if (y < 0x10 || y >= 0x110)
					continue;
				const x = this.stars[i].x;
				const k = this.stars[i].blk;
				switch (this.starport[0] >>> 3 & 3) {
				case 0:
					if ((k === 0 || k === 2) && data[p + (x | y << 8)] === 0)
						data[p + (x | y << 8)] = this.stars[i].color;
					break;
				case 1:
					if ((k === 1 || k === 2) && data[p + (x | y << 8)] === 0)
						data[p + (x | y << 8)] = this.stars[i].color;
					break;
				case 2:
					if ((k === 0 || k === 3) && data[p + (x | y << 8)] === 0)
						data[p + (x | y << 8)] = this.stars[i].color;
					break;
				case 3:
					if ((k === 1 || k === 3) && data[p + (x | y << 8)] === 0)
						data[p + (x | y << 8)] = this.stars[i].color;
					break;
				}
			}
		}

		// alphaチャンネル修正
		for (let p = 256 * 16 + 16, i = 0; i < 288; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] |= 0xff000000;
	}

	xfer8x8(data, p, k) {
		const q = ((this.ram[k] | this.ram[k + 0x400] << 8) & 0x3fff) << 6;

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

	xfer8x8HV(data, p, k) {
		const q = ((this.ram[k] | this.ram[k + 0x400] << 8) & 0x3fff) << 6;

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

	xfer16x16(data, dst, src) {
		const idx = src >>> 6 & 0xfc;
		let px, i, j, h;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) <= 8 * 0x100 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0xff00;
		if ((h = (dst >>> 8) - 8) >= 16) {
			for (i = 16; i !== 0; dst += 256 - 16, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx + this.obj[src++]]) !== 0 && data[dst] === 0)
						data[dst] = px;
		}
		else {
			dst = (dst & 0xff) + 24 * 0x100;
			src += (16 - h) * 16;
			for (i = h; i !== 0; dst += 256 - 16, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx + this.obj[src++]]) !== 0 && data[dst] === 0)
						data[dst] = px;
		}
	}

	xfer16x16V(data, dst, src) {
		const idx = src >>> 6 & 0xfc;
		let px, i, j, h;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) <= 8 * 0x100 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 256 - 16;
		if ((h = (dst >>> 8) - 8) >= 16) {
			for (i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx + this.obj[src++]]) !== 0 && data[dst] === 0)
						data[dst] = px;
		}
		else {
			dst = (dst & 0xff) + 24 * 0x100;
			src -= (16 - h) * 16;
			for (i = h; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx + this.obj[src++]]) !== 0 && data[dst] === 0)
						data[dst] = px;
		}
	}

	xfer16x16H(data, dst, src) {
		const idx = src >>> 6 & 0xfc;
		let px, i, j, h;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) <= 8 * 0x100 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 16;
		if ((h = (dst >>> 8) - 8) >= 16) {
			for (i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx + this.obj[--src]]) !== 0 && data[dst] === 0)
						data[dst] = px;
		}
		else {
			dst = (dst & 0xff) + 24 * 0x100;
			src += (16 - h) * 16;
			for (i = h; i !== 0; dst += 256 - 16, src += 32, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx + this.obj[--src]]) !== 0 && data[dst] === 0)
						data[dst] = px;
		}
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >>> 6 & 0xfc;
		let px, i, j, h;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) <= 8 * 0x100 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 256;
		if ((h = (dst >>> 8) - 8) >= 16) {
			for (i = 16; i !== 0; dst += 256 - 16, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx + this.obj[--src]]) !== 0 && data[dst] === 0)
						data[dst] = px;
		}
		else {
			dst = (dst & 0xff) + 24 * 0x100;
			src -= (16 - h) * 16;
			for (i = h; i !== 0; dst += 256 - 16, --i)
				for (j = 16; j !== 0; dst++, --j)
					if ((px = this.objcolor[idx + this.obj[--src]]) !== 0 && data[dst] === 0)
						data[dst] = px;
		}
	}
}

/*
 *
 *	Galaga
 *
 */

const BOMB = new Int16Array(new Uint8Array(window.atob('\
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\
UP9M/1L/Zf8=\
').split('').map(c => c.charCodeAt(0))).buffer);

/*
 *
 *	Galaga
 *
 */

const url = 'galaga.zip';
let BG, OBJ, BGCOLOR, OBJCOLOR, RGB, SND, PRG1, PRG2, PRG3;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG1 = new Uint8Array((zip.files['gg1_1b.3p'].inflate() + zip.files['gg1_2b.3m'].inflate() + zip.files['gg1_3.2m'].inflate() + zip.files['gg1_4b.2l'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	PRG2 = new Uint8Array(zip.files['gg1_5b.3f'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	PRG3 = new Uint8Array(zip.files['gg1_7b.2c'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	BG = new Uint8Array(zip.files['gg1_9.4l'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJ = new Uint8Array((zip.files['gg1_11.4d'].inflate() + zip.files['gg1_10.4f'].inflate()).split('').map(c => c.charCodeAt(0)));
	RGB = new Uint8Array(zip.files['prom-5.5n'].inflate().split('').map(c => c.charCodeAt(0)));
	BGCOLOR = new Uint8Array(zip.files['prom-4.2n'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJCOLOR = new Uint8Array(zip.files['prom-3.1c'].inflate().split('').map(c => c.charCodeAt(0)));
	SND = new Uint8Array(zip.files['prom-1.1d'].inflate().split('').map(c => c.charCodeAt(0)));
	init({
		game: game = new Galaga(),
		sound: sound = [
			new PacManSound({SND, resolution: 2}),
			new SoundEffect({se: game.se, freq: 11025, gain: 0.5}),
		],
	});
	loop();
}

