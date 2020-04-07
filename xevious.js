/*
 *
 *	Xevious
 *
 */

import PacManSound from './pac-man_sound.js';
import SoundEffect from './sound_effect.js';
import Cpu, {init, loop} from './main.js';
import Z80 from './z80.js';
let game, sound;

class Xevious {
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
		this.dwStick = 0;
		this.dwStickPrev = 0;
		this.dwCoin = 0;
		this.nSolvalou = 3;
		this.nRank = 'NORMAL';
		this.nBonus = 'A';

		// CPU周りの初期化
		this.fInterruptEnable = false;
		this.fNmiEnable = false;
		this.fSoundEnable = false;

		this.ram = new Uint8Array(0x4000).addBase();
		this.mmi = new Uint8Array(0x100).fill(0xff);
		this.mmo = new Uint8Array(0x100);
		this.count = 0;
		this.mapreg = new Uint8Array(0x100);
		this.dmaport = new Uint8Array(0x100);
		this.ioport = new Uint8Array(0x100);
		this.keyport = 0;
		this.keytbl = Uint8Array.of(8, 0, 2, 1, 4, 8, 3, 8, 6, 7, 8, 8, 5, 8, 8, 8);

		this.cpu = [];
		for (let i = 0; i < 3; i++)
			this.cpu[i] = new Z80(this);

		// CPU0 ROM AREA SETUP
		for (let i = 0; i < 0x40; i++)
			this.cpu[0].memorymap[i].base = PRG1.base[i];

		//CPU1 ROM AREA SETUP
		for (let i = 0; i < 0x20; i++)
			this.cpu[1].memorymap[i].base = PRG2.base[i];

		// CPU2 ROM AREA SETUP
		for (let i = 0; i < 0x10; i++)
			this.cpu[2].memorymap[i].base = PRG3.base[i];

		// CPU[012] RAM AREA SETUP
		for (let i = 0; i < 3; i++) {
			for (let j = 0; j < 8; j++) {
				this.cpu[i].memorymap[0x78 + j].base = this.ram.base[j];
				this.cpu[i].memorymap[0x78 + j].write = null;
				this.cpu[i].memorymap[0x80 + j].base = this.ram.base[8 + j];
				this.cpu[i].memorymap[0x80 + j].write = null;
				this.cpu[i].memorymap[0x90 + j].base = this.ram.base[0x10 + j];
				this.cpu[i].memorymap[0x90 + j].write = null;
				this.cpu[i].memorymap[0xa0 + j].base = this.ram.base[0x18 + j];
				this.cpu[i].memorymap[0xa0 + j].write = null;
				this.cpu[i].memorymap[0xb0 + j].base = this.ram.base[0x20 + j];
				this.cpu[i].memorymap[0xb0 + j].write = null;
				this.cpu[i].memorymap[0xb8 + j].base = this.ram.base[0x28 + j];
				this.cpu[i].memorymap[0xb8 + j].write = null;
				this.cpu[i].memorymap[0xc0 + j].base = this.ram.base[0x30 + j];
				this.cpu[i].memorymap[0xc0 + j].write = null;
				this.cpu[i].memorymap[0xc8 + j].base = this.ram.base[0x38 + j];
				this.cpu[i].memorymap[0xc8 + j].write = null;
			}
		}
		this.cpu[0].memorymap[0x68].base = this.mmi;
		this.cpu[0].memorymap[0x68].write = systemctrl0;
		this.cpu[1].memorymap[0x68].base = this.mmi;
		this.cpu[1].memorymap[0x68].write = systemctrl0;
		this.cpu[2].memorymap[0x68].base = this.mmi;
		this.cpu[2].memorymap[0x68].write = systemctrl1;
		this.cpu[0].memorymap[0x70].base = this.ioport;
		this.cpu[0].memorymap[0x70].write = ioarea;
		this.cpu[0].memorymap[0x71].base = this.dmaport;
		this.cpu[0].memorymap[0x71].write = dmactrl;
		this.cpu[0].memorymap[0xd0].write = scrollregister;
		this.cpu[1].memorymap[0xd0].write = scrollregister;
		this.cpu[1].memorymap[0xf0].base = this.mapreg;
		this.cpu[1].memorymap[0xf0].write = maparea;

		// DIPSW SETUP
		this.mmi.fill(3, 0, 8);

		this.maptbl = new Uint16Array(0x8000);
		this.mapatr = new Uint8Array(0x8000);
		this.convertMAP();

		// Videoの初期化
		this.bg2 = new Uint8Array(0x8000);
		this.bg4 = new Uint8Array(0x8000);
		this.obj4 = new Uint8Array(0x10000);
		this.obj8 = new Uint8Array(0x10000);
		this.bgcolor = Uint8Array.from(BGCOLOR_H, (e, i) => BGCOLOR_H[i] << 4 & 0x70 | BGCOLOR_L[i] & 0xf);
		this.objcolor = Uint8Array.from(OBJCOLOR_H, (e, i) => OBJCOLOR_H[i] << 4 & 0xf0 | OBJCOLOR_L[i] & 0xf);
		this.rgb = new Uint32Array(0x100);
		this.dwScroll = 0xff;
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();

		// 効果音の初期化
		this.se = [VX01, VX02, VX80].map(buf => ({buf: buf, loop: false, start: false, stop: false}));

		// ライトハンドラ
		function systemctrl0(addr, data, game) {
			switch (addr & 0xf0) {
			case 0x00:
			case 0x10:
				break;
			case 0x20:
				switch (addr & 0x0f) {
				case 0:
					game.fInterruptEnable = (data & 1) !== 0;
					break;
				case 1:
					break;
				case 2:
					if (data) {
						game.cpu[1].enable();
						game.cpu[2].enable();
					}
					else {
						game.cpu[1].disable();
						game.cpu[2].disable();
					}
					break;
				case 3:
					if (data)
						game.fSoundEnable = true;
					else {
						game.fSoundEnable = false;
						game.se[0].stop = game.se[1].stop = game.se[2].stop = true;
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

		function ioarea(addr, data, game) {
			switch (game.dmaport[0]) {
			case 0x61: // ?
				break;
			case 0x68: // voice
				if ((addr & 0x0f) === 0x03 && game.fSoundEnable) {
					game.se[0].stop = game.se[1].stop = game.se[2].stop = true;
					switch (data) {
					case 0x01:
						game.se[0].start = true;
						break;
					case 0x02:
						game.se[1].start = true;
						break;
					case 0x80:
						game.se[2].start = true;
						break;
					}
				}
				break;
			case 0xa1: // ?
				break;
			case 0x64: // keyctrl
				switch (data) {
				case 0x10:
					break;
				case 0x80:
					game.keyport = 0x05;
					break;
				case 0xe5:
					game.keyport = 0x95;
					break;
				}
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
				if (game.fTest) {
					game.ioport[0] = 0x7f;
					game.ioport[1] = 0xff;
					game.ioport[2] = 0xff;
					if ((game.dwStick & 0x0f) !== 0 || (game.dwStick & 0x30) !== 0)
						game.ioport[1] &= 0x0f;
					if ((game.dwStick & 0x20) !== 0)
						game.mmi[0] &= 0xfe;
					else
						game.mmi[0] |= 1;
				}
				else if (game.ram[0xdad]) {
					game.ioport[0] = game.dwCoin / 10 << 4 | game.dwCoin % 10;
					game.ioport[1] = game.keytbl[game.dwStick & 0x0f] | 0x30;
					if ((game.dwStick & 0x10) !== 0) {
						game.ioport[1] &= 0xdf;
						if ((game.dwStickPrev & 0x10) === 0)
							game.ioport[1] &= 0xef;
					}
					if ((game.dwStick & 0x20) !== 0)
						game.mmi[0] &= 0xfe;
					else
						game.mmi[0] |= 1;
					game.dwStickPrev = game.dwStick;
				}
				else {
					game.ioport[0] = 0x80;
					game.ioport[1] = 0x38;
					game.ioport[2] = 0x38;
				}
				break;
			case 0x74:
				game.ioport[0x03] = game.keyport;
				break;
			}
			game.fNmiEnable = true;
		}

		function maparea(addr, data, game) {
			let v, w, x;

			this.base[addr & 0xff] = data;
			if ((addr & 0xff) === 0x01) {
				v = game.maptbl[w = (this.base[0] | this.base[1] << 8) & 0x7fff];
				switch (MAPDATA[v] & 0xc0) {
				case 0x00:
					x = game.mapatr[w] ^ 0x00;
					break;
				case 0x40:
					x = game.mapatr[w] ^ 0x80;
					break;
				case 0x80:
					x = game.mapatr[w] ^ 0x40;
					break;
				case 0xc0:
					x = game.mapatr[w] ^ 0xc0;
					break;
				}
				this.base[0] = MAPDATA[v] & 0x3f | x;
				this.base[1] = MAPDATA[0x800 + v];
			}
		}

		function scrollregister(addr, data, game) {
			switch (addr & 0xff) {
			case 0x00:
				game.dwScroll = data;
				break;
			case 0x01:
				game.dwScroll = data | 0x100;
				break;
			}
		}
	}

	execute() {
		sound[0].mute(!this.fSoundEnable);
		if (this.fInterruptEnable)
			this.cpu[0].interrupt();
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
		return this;
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// DIPスイッチの更新
		if (this.fDIPSwitchChanged) {
			this.fDIPSwitchChanged = false;
			switch (this.nSolvalou) {
			case 1:
				this.mmi[5] &= ~2;
				this.mmi[6] |= 2;
				break;
			case 2:
				this.mmi[5] |= 2;
				this.mmi[6] &= ~2;
				break;
			case 3:
				this.mmi[5] |= 2;
				this.mmi[6] |= 2;
				break;
			case 5:
				this.mmi[5] &= ~2;
				this.mmi[6] &= ~2;
				break;
			}
			switch (this.nRank) {
			case 'EASY':
				this.mmi[5] &= ~1;
				this.mmi[6] |= 1;
				break;
			case 'NORMAL':
				this.mmi[5] |= 1;
				this.mmi[6] |= 1;
				break;
			case 'HARD':
				this.mmi[5] |= 1;
				this.mmi[6] &= ~1;
				break;
			case 'VERY HARD':
				this.mmi[5] &= ~1;
				this.mmi[6] &= ~1;
				break;
			}
			switch (this.nBonus) {
			case 'A':
				this.mmi[2] |= 2;
				this.mmi[3] |= 2;
				this.mmi[4] |= 2;
				break;
			case 'B':
				this.mmi[2] &= ~2;
				this.mmi[3] |= 2;
				this.mmi[4] |= 2;
				break;
			case 'C':
				this.mmi[2] |= 2;
				this.mmi[3] &= ~2;
				this.mmi[4] |= 2;
				break;
			case 'D':
				this.mmi[2] &= ~2;
				this.mmi[3] &= ~2;
				this.mmi[4] |= 2;
				break;
			case 'E':
				this.mmi[2] |= 2;
				this.mmi[3] |= 2;
				this.mmi[4] &= ~2;
				break;
			case 'F':
				this.mmi[2] &= ~2;
				this.mmi[3] |= 2;
				this.mmi[4] &= ~2;
				break;
			case 'G':
				this.mmi[2] |= 2;
				this.mmi[3] &= ~2;
				this.mmi[4] &= ~2;
				break;
			case 'NONE':
				this.mmi[2] &= ~2;
				this.mmi[3] &= ~2;
				this.mmi[4] &= ~2;
				break;
			}
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.ioport[0] |= 0x80;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.fSoundEnable = false;
			this.se[0].stop = this.se[1].stop = this.se[2].stop = true;
			this.dwCoin = 0;
			this.cpu[0].reset();
			this.cpu[1].disable();
			this.cpu[2].disable();
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if (this.fCoin && ++this.dwCoin > 99)
			this.dwCoin = 99;
		if (this.fStart1P && !this.ram[0x0823] && this.dwCoin >= 1)
			--this.dwCoin;
		if (this.fStart2P && !this.ram[0x0823] && this.dwCoin >= 2)
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
		if (fDown)
			this.dwStick = this.dwStick & ~(1 << 2) | 1 << 0;
		else
			this.dwStick &= ~(1 << 0);
	}

	right(fDown) {
		if (fDown)
			this.dwStick = this.dwStick & ~(1 << 3) | 1 << 1;
		else
			this.dwStick &= ~(1 << 1);
	}

	down(fDown) {
		if (fDown)
			this.dwStick = this.dwStick & ~(1 << 0) | 1 << 2;
		else
			this.dwStick &= ~(1 << 2);
	}

	left(fDown) {
		if (fDown)
			this.dwStick = this.dwStick & ~(1 << 1) | 1 << 3;
		else
			this.dwStick &= ~(1 << 3);
	}

	triggerA(fDown) {
		if (fDown)
			this.dwStick |= 1 << 4;
		else
			this.dwStick &= ~(1 << 4);
	}

	triggerB(fDown) {
		if (fDown)
			this.dwStick |= 1 << 5;
		else
			this.dwStick &= ~(1 << 5);
	}

	convertMAP() {
		let i, j, k, l, n;

		// MAP table の作成
		for (i = 0; i < 0x80; i++) {
			for (j = 0; j < 0x100; j++) {
				k = (i >> 1) * 0x80 + (j >> 1);			// ROM9. ROM10 address
				n = MAPTBL[k + 0x1000] << 2;			// ROM11 A9~A2
				switch (k & 1) {
				case 0:
					l = (MAPTBL[k >> 1] & 6) >> 1;		// ROM9 [d1|d2],[d5|d6]
					if ((MAPTBL[k >> 1] & 1) !== 0)
						n |= 0x400;						// ROM11 A10
					break;
				case 1:
					l = (MAPTBL[k >> 1] & 0x60) >> 5;	// ROM9 [d1|d2],[d5|d6]
					if ((MAPTBL[k >> 1] & 0x10) !== 0)
						n |= 0x400;						// ROM11 A10
					break;
				}
				switch (l) {
				case 0x00:
				case 0x03:
					break;
				case 0x01:
					l = 0x02;
					break;
				case 0x02:
					l = 0x01;
					break;
				}
				this.mapatr[i * 0x100 + j] = l << 6;
				/* ROM11 D7~D6 */
				k = ((i & 1) << 1) + (j & 1);
				/* $F000: D8, D0 */
				n |= k ^ l;
				/* ROM11 A1~A0 */
				this.maptbl[i * 0x100 + j] = n;
			}
		}
	}

	convertRGB() {
		for (let i = 0; i < 0x100; i++)
			this.rgb[i] = (RED[i] & 0x0f) * 255 / 15	// Red
				| (GREEN[i] & 0x0f) * 255 / 15 << 8		// Green
				| (BLUE[i] & 0x0f) * 255 / 15 << 16		// Blue
				| 0xff000000;							// Alpha
	}

	convertBG() {
		for (let p = 0, q = 0, i = 512; i !== 0; q += 8, --i)
			for (let j = 7; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg2[p++] = BG2[q + k] >> j & 1;
		for (let p = 0, q = 0, i = 512; i !== 0; q += 8, --i)
			for (let j = 7; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg4[p++] = BG4[q + k] >> j << 1 & 2 | BG4[q + k + 0x1000] >> j & 1;
	}

	convertOBJ() {
		this.obj4.fill(3);
		for (let p = 0, q = 0, i = 64; i !== 0; q += 64, --i) {
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj4[p++] = OBJ4[q + k + 32] >> j & 1 | OBJ4[q + k + 32] >> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj4[p++] = OBJ4[q + k] >> j & 1 | OBJ4[q + k] >> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj4[p++] = OBJ4[q + k + 40] >> j & 1 | OBJ4[q + k + 40] >> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj4[p++] = OBJ4[q + k + 8] >> j & 1 | OBJ4[q + k + 8] >> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj4[p++] = OBJ4[q + k + 48] >> j & 1 | OBJ4[q + k + 48] >> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj4[p++] = OBJ4[q + k + 16] >> j & 1 | OBJ4[q + k + 16] >> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj4[p++] = OBJ4[q + k + 56] >> j & 1 | OBJ4[q + k + 56] >> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj4[p++] = OBJ4[q + k + 24] >> j & 1 | OBJ4[q + k + 24] >> (j + 3) & 2;
			}
		}
		for (let p = 0, q = 0, i = 128; i !== 0; q += 64, --i) {
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 32] >> j & 1 | OBJ8[q + k + 32] >> (j + 3) & 2 | OBJ8[q + k + 0x4000 + 32] >> j << 2 & 4;
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k] >> j & 1 | OBJ8[q + k] >> (j + 3) & 2 | OBJ8[q + k + 0x4000] >> j << 2 & 4;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 40] >> j & 1 | OBJ8[q + k + 40] >> (j + 3) & 2 | OBJ8[q + k + 0x4000 + 40] >> j << 2 & 4;
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 8] >> j & 1 | OBJ8[q + k + 8] >> (j + 3) & 2 | OBJ8[q + k + 0x4000 + 8] >> j << 2 & 4;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 48] >> j & 1 | OBJ8[q + k + 48] >> (j + 3) & 2 | OBJ8[q + k + 0x4000 + 48] >> j << 2 & 4;
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 16] >> j & 1 | OBJ8[q + k + 16] >> (j + 3) & 2 | OBJ8[q + k + 0x4000 + 16] >> j << 2 & 4;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 56] >> j & 1 | OBJ8[q + k + 56] >> (j + 3) & 2 | OBJ8[q + k + 0x4000 + 56] >> j << 2 & 4;
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 24] >> j & 1 | OBJ8[q + k + 24] >> (j + 3) & 2 | OBJ8[q + k + 0x4000 + 24] >> j << 2 & 4;
			}
		}
		for (let p = 0x8000, q = 0x2000, i = 128; i !== 0; q += 64, --i) {
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 32] >> j & 1 | OBJ8[q + k + 32] >> (j + 3) & 2 | OBJ8[q + k + 0x2000 + 32] >> (j + 2) & 4;
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k] >> j & 1 | OBJ8[q + k] >> (j + 3) & 2 | OBJ8[q + k + 0x2000] >> (j + 2) & 4;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 40] >> j & 1 | OBJ8[q + k + 40] >> (j + 3) & 2 | OBJ8[q + k + 0x2000 + 40] >> (j + 2) & 4;
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 8] >> j & 1 | OBJ8[q + k + 8] >> (j + 3) & 2 | OBJ8[q + k + 0x2000 + 8] >> (j + 2) & 4;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 48] >> j & 1 | OBJ8[q + k + 48] >> (j + 3) & 2 | OBJ8[q + k + 0x2000 + 48] >> (j + 2) & 4;
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 16] >> j & 1 | OBJ8[q + k + 16] >> (j + 3) & 2 | OBJ8[q + k + 0x2000 + 16] >> (j + 2) & 4;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 56] >> j & 1 | OBJ8[q + k + 56] >> (j + 3) & 2 | OBJ8[q + k + 0x2000 + 56] >> (j + 2) & 4;
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 24] >> j & 1 | OBJ8[q + k + 24] >> (j + 3) & 2 | OBJ8[q + k + 0x2000 + 24] >> (j + 2) & 4;
			}
		}
	}

	makeBitmap(data) {
		// bg4 描画
		let p = 256 * (16 - (this.dwScroll + 4 & 7)) + 232;
		let k = 0x80 + ((this.dwScroll + 4 >> 3) + 2 & 0x3f);
		for (let i = 0; i < 28; k = k + 27 & 0x3f | k + 0x40 & 0x7c0, p -= 256 * 8 * 37 + 8, i++)
			for (let j = 0; j < 37; k = k + 1 & 0x3f | k & 0x7c0, p += 256 * 8, j++)
				this.xfer8x8x2(data, p, k);

		// obj描画
		for (let k = 0xf80, i = 64; i !== 0; k += 2, --i) {
			const x = this.ram[k] + 1 & 0xff;
			const y = (this.ram[k + 1] | this.ram[k + 0x801] << 8) - 24 & 0x1ff;
			const src = this.ram[k + 0x1000] | this.ram[k + 0x1001] << 8;
			if ((this.ram[k + 0x800] & 0x80) !== 0)
				switch (this.ram[k + 0x800] & 0x0f) {
				case 0x00: // ノーマル
					this.xfer16x16x2(data, x | y << 8, src);
					break;
				case 0x04: // V反転
					this.xfer16x16x2V(data, x | y << 8, src);
					break;
				case 0x08: // H反転
					this.xfer16x16x2H(data, x | y << 8, src);
					break;
				case 0x0c: // HV反転
					this.xfer16x16x2HV(data, x | y << 8, src);
					break;
				case 0x01: // ノーマル
					this.xfer16x16x2(data, x | y << 8, src & ~1);
					this.xfer16x16x2(data, x | (y + 16 & 0x1ff) << 8, src | 1);
					break;
				case 0x05: // V反転
					this.xfer16x16x2V(data, x | y << 8, src | 1);
					this.xfer16x16x2V(data, x | (y + 16 & 0x1ff) << 8, src & ~1);
					break;
				case 0x09: // H反転
					this.xfer16x16x2H(data, x | y << 8, src & ~1);
					this.xfer16x16x2H(data, x | (y + 16 & 0x1ff) << 8, src | 1);
					break;
				case 0x0d: // HV反転
					this.xfer16x16x2HV(data, x | y << 8, src | 1);
					this.xfer16x16x2HV(data, x | (y + 16 & 0x1ff) << 8, src & ~1);
					break;
				case 0x02: // ノーマル
					this.xfer16x16x2(data, x | y << 8, src | 2);
					this.xfer16x16x2(data, (x + 16 & 0xff) | y << 8, src & ~2);
					break;
				case 0x06: // V反転
					this.xfer16x16x2V(data, x | y << 8, src | 2);
					this.xfer16x16x2V(data, (x + 16 & 0xff) | y << 8, src & ~2);
					break;
				case 0x0a: // H反転
					this.xfer16x16x2H(data, x | y << 8, src & ~2);
					this.xfer16x16x2H(data, (x + 16 & 0xff) | y << 8, src | 2);
					break;
				case 0x0e: // HV反転
					this.xfer16x16x2HV(data, x | y << 8, src & ~2);
					this.xfer16x16x2HV(data, (x + 16 & 0xff) | y << 8, src | 2);
					break;
				case 0x03: // ノーマル
					this.xfer16x16x2(data, x | y << 8, src & ~3 | 2);
					this.xfer16x16x2(data, x | (y + 16 & 0x1ff) << 8, src | 3);
					this.xfer16x16x2(data, (x + 16 & 0xff) | y << 8, src & ~3);
					this.xfer16x16x2(data, (x + 16 & 0xff) | (y + 16 & 0x1ff) << 8, src & ~3 | 1);
					break;
				case 0x07: // V反転
					this.xfer16x16x2V(data, x | y << 8, src | 3);
					this.xfer16x16x2V(data, x | (y + 16 & 0x1ff) << 8, src & ~3 | 2);
					this.xfer16x16x2V(data, (x + 16 & 0xff) | y << 8, src & ~3 | 1);
					this.xfer16x16x2V(data, (x + 16 & 0xff) | (y + 16 & 0x1ff) << 8, src & ~3);
					break;
				case 0x0b: // H反転
					this.xfer16x16x2H(data, x | y << 8, src & ~3);
					this.xfer16x16x2H(data, x | (y + 16 & 0x1ff) << 8, src & ~3 | 1);
					this.xfer16x16x2H(data, (x + 16 & 0xff) | y << 8, src & ~3 | 2);
					this.xfer16x16x2H(data, (x + 16 & 0xff) | (y + 16 & 0x1ff) << 8, src | 3);
					break;
				case 0x0f: // HV反転
					this.xfer16x16x2HV(data, x | y << 8, src & ~3 | 1);
					this.xfer16x16x2HV(data, x | (y + 16 & 0x1ff) << 8, src & ~3);
					this.xfer16x16x2HV(data, (x + 16 & 0xff) | y << 8, src | 3);
					this.xfer16x16x2HV(data, (x + 16 & 0xff) | (y + 16 & 0x1ff) << 8, src & ~3 | 2);
					break;
				}
			else
				switch (this.ram[k + 0x800] & 0x0f) {
				case 0x00: // ノーマル
					this.xfer16x16x3(data, x | y << 8, src);
					break;
				case 0x04: // V反転
					this.xfer16x16x3V(data, x | y << 8, src);
					break;
				case 0x08: // H反転
					this.xfer16x16x3H(data, x | y << 8, src);
					break;
				case 0x0c: // HV反転
					this.xfer16x16x3HV(data, x | y << 8, src);
					break;
				case 0x01: // ノーマル
					this.xfer16x16x3(data, x | y << 8, src & ~1);
					this.xfer16x16x3(data, x | (y + 16 & 0x1ff) << 8, src | 1);
					break;
				case 0x05: // V反転
					this.xfer16x16x3V(data, x | y << 8, src | 1);
					this.xfer16x16x3V(data, x | (y + 16 & 0x1ff) << 8, src & ~1);
					break;
				case 0x09: // H反転
					this.xfer16x16x3H(data, x | y << 8, src & ~1);
					this.xfer16x16x3H(data, x | (y + 16 & 0x1ff) << 8, src | 1);
					break;
				case 0x0d: // HV反転
					this.xfer16x16x3HV(data, x | y << 8, src | 1);
					this.xfer16x16x3HV(data, x | (y + 16 & 0x1ff) << 8, src & ~1);
					break;
				case 0x02: // ノーマル
					this.xfer16x16x3(data, x | y << 8, src | 2);
					this.xfer16x16x3(data, (x + 16 & 0xff) | y << 8, src & ~2);
					break;
				case 0x06: // V反転
					this.xfer16x16x3V(data, x | y << 8, src | 2);
					this.xfer16x16x3V(data, (x + 16 & 0xff) | y << 8, src & ~2);
					break;
				case 0x0a: // H反転
					this.xfer16x16x3H(data, x | y << 8, src & ~2);
					this.xfer16x16x3H(data, (x + 16 & 0xff) | y << 8, src | 2);
					break;
				case 0x0e: // HV反転
					this.xfer16x16x3HV(data, x | y << 8, src & ~2);
					this.xfer16x16x3HV(data, (x + 16 & 0xff) | y << 8, src | 2);
					break;
				case 0x03: // ノーマル
					this.xfer16x16x3(data, x | y << 8, src & ~3 | 2);
					this.xfer16x16x3(data, x | (y + 16 & 0x1ff) << 8, src | 3);
					this.xfer16x16x3(data, (x + 16 & 0xff) | y << 8, src & ~3);
					this.xfer16x16x3(data, (x + 16 & 0xff) | (y + 16 & 0x1ff) << 8, src & ~3 | 1);
					break;
				case 0x07: // V反転
					this.xfer16x16x3V(data, x | y << 8, src | 3);
					this.xfer16x16x3V(data, x | (y + 16 & 0x1ff) << 8, src & ~3 | 2);
					this.xfer16x16x3V(data, (x + 16 & 0xff) | y << 8, src & ~3 | 1);
					this.xfer16x16x3V(data, (x + 16 & 0xff) | (y + 16 & 0x1ff) << 8, src & ~3);
					break;
				case 0x0b: // H反転
					this.xfer16x16x3H(data, x | y << 8, src & ~3);
					this.xfer16x16x3H(data, x | (y + 16 & 0x1ff) << 8, src & ~3 | 1);
					this.xfer16x16x3H(data, (x + 16 & 0xff) | y << 8, src & ~3 | 2);
					this.xfer16x16x3H(data, (x + 16 & 0xff) | (y + 16 & 0x1ff) << 8, src | 3);
					break;
				case 0x0f: // HV反転
					this.xfer16x16x3HV(data, x | y << 8, src & ~3 | 1);
					this.xfer16x16x3HV(data, x | (y + 16 & 0x1ff) << 8, src & ~3);
					this.xfer16x16x3HV(data, (x + 16 & 0xff) | y << 8, src | 3);
					this.xfer16x16x3HV(data, (x + 16 & 0xff) | (y + 16 & 0x1ff) << 8, src & ~3 | 2);
					break;
				}
		}

		// bg2 描画
		p = 256 * 8 * 2 + 234;
		k = 0x2084;
		for (let i = 0; i < 29; k += 28, p -= 256 * 8 * 36 + 8, i++)
			for (let j = 0; j < 36; k++, p += 256 * 8, j++)
				this.xfer8x8x1(data, p, k);

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] = this.rgb[data[p]];
	}

	xfer8x8x2(data, p, k) {
		const q = (this.ram[k + 0x3800] | this.ram[k + 0x2800] << 8 & 0x100) << 6;
		const idx = this.ram[k + 0x2800] & 0x3c | this.ram[k + 0x3800] >> 1 & 0x40 | this.ram[k + 0x2800] << 7 & 0x180;

		switch (this.ram[k + 0x2800] >> 6) {
		case 0: // ノーマル
			data[p + 0x000] = this.bgcolor[idx | this.bg4[q | 0x00]];
			data[p + 0x001] = this.bgcolor[idx | this.bg4[q | 0x01]];
			data[p + 0x002] = this.bgcolor[idx | this.bg4[q | 0x02]];
			data[p + 0x003] = this.bgcolor[idx | this.bg4[q | 0x03]];
			data[p + 0x004] = this.bgcolor[idx | this.bg4[q | 0x04]];
			data[p + 0x005] = this.bgcolor[idx | this.bg4[q | 0x05]];
			data[p + 0x006] = this.bgcolor[idx | this.bg4[q | 0x06]];
			data[p + 0x007] = this.bgcolor[idx | this.bg4[q | 0x07]];
			data[p + 0x100] = this.bgcolor[idx | this.bg4[q | 0x08]];
			data[p + 0x101] = this.bgcolor[idx | this.bg4[q | 0x09]];
			data[p + 0x102] = this.bgcolor[idx | this.bg4[q | 0x0a]];
			data[p + 0x103] = this.bgcolor[idx | this.bg4[q | 0x0b]];
			data[p + 0x104] = this.bgcolor[idx | this.bg4[q | 0x0c]];
			data[p + 0x105] = this.bgcolor[idx | this.bg4[q | 0x0d]];
			data[p + 0x106] = this.bgcolor[idx | this.bg4[q | 0x0e]];
			data[p + 0x107] = this.bgcolor[idx | this.bg4[q | 0x0f]];
			data[p + 0x200] = this.bgcolor[idx | this.bg4[q | 0x10]];
			data[p + 0x201] = this.bgcolor[idx | this.bg4[q | 0x11]];
			data[p + 0x202] = this.bgcolor[idx | this.bg4[q | 0x12]];
			data[p + 0x203] = this.bgcolor[idx | this.bg4[q | 0x13]];
			data[p + 0x204] = this.bgcolor[idx | this.bg4[q | 0x14]];
			data[p + 0x205] = this.bgcolor[idx | this.bg4[q | 0x15]];
			data[p + 0x206] = this.bgcolor[idx | this.bg4[q | 0x16]];
			data[p + 0x207] = this.bgcolor[idx | this.bg4[q | 0x17]];
			data[p + 0x300] = this.bgcolor[idx | this.bg4[q | 0x18]];
			data[p + 0x301] = this.bgcolor[idx | this.bg4[q | 0x19]];
			data[p + 0x302] = this.bgcolor[idx | this.bg4[q | 0x1a]];
			data[p + 0x303] = this.bgcolor[idx | this.bg4[q | 0x1b]];
			data[p + 0x304] = this.bgcolor[idx | this.bg4[q | 0x1c]];
			data[p + 0x305] = this.bgcolor[idx | this.bg4[q | 0x1d]];
			data[p + 0x306] = this.bgcolor[idx | this.bg4[q | 0x1e]];
			data[p + 0x307] = this.bgcolor[idx | this.bg4[q | 0x1f]];
			data[p + 0x400] = this.bgcolor[idx | this.bg4[q | 0x20]];
			data[p + 0x401] = this.bgcolor[idx | this.bg4[q | 0x21]];
			data[p + 0x402] = this.bgcolor[idx | this.bg4[q | 0x22]];
			data[p + 0x403] = this.bgcolor[idx | this.bg4[q | 0x23]];
			data[p + 0x404] = this.bgcolor[idx | this.bg4[q | 0x24]];
			data[p + 0x405] = this.bgcolor[idx | this.bg4[q | 0x25]];
			data[p + 0x406] = this.bgcolor[idx | this.bg4[q | 0x26]];
			data[p + 0x407] = this.bgcolor[idx | this.bg4[q | 0x27]];
			data[p + 0x500] = this.bgcolor[idx | this.bg4[q | 0x28]];
			data[p + 0x501] = this.bgcolor[idx | this.bg4[q | 0x29]];
			data[p + 0x502] = this.bgcolor[idx | this.bg4[q | 0x2a]];
			data[p + 0x503] = this.bgcolor[idx | this.bg4[q | 0x2b]];
			data[p + 0x504] = this.bgcolor[idx | this.bg4[q | 0x2c]];
			data[p + 0x505] = this.bgcolor[idx | this.bg4[q | 0x2d]];
			data[p + 0x506] = this.bgcolor[idx | this.bg4[q | 0x2e]];
			data[p + 0x507] = this.bgcolor[idx | this.bg4[q | 0x2f]];
			data[p + 0x600] = this.bgcolor[idx | this.bg4[q | 0x30]];
			data[p + 0x601] = this.bgcolor[idx | this.bg4[q | 0x31]];
			data[p + 0x602] = this.bgcolor[idx | this.bg4[q | 0x32]];
			data[p + 0x603] = this.bgcolor[idx | this.bg4[q | 0x33]];
			data[p + 0x604] = this.bgcolor[idx | this.bg4[q | 0x34]];
			data[p + 0x605] = this.bgcolor[idx | this.bg4[q | 0x35]];
			data[p + 0x606] = this.bgcolor[idx | this.bg4[q | 0x36]];
			data[p + 0x607] = this.bgcolor[idx | this.bg4[q | 0x37]];
			data[p + 0x700] = this.bgcolor[idx | this.bg4[q | 0x38]];
			data[p + 0x701] = this.bgcolor[idx | this.bg4[q | 0x39]];
			data[p + 0x702] = this.bgcolor[idx | this.bg4[q | 0x3a]];
			data[p + 0x703] = this.bgcolor[idx | this.bg4[q | 0x3b]];
			data[p + 0x704] = this.bgcolor[idx | this.bg4[q | 0x3c]];
			data[p + 0x705] = this.bgcolor[idx | this.bg4[q | 0x3d]];
			data[p + 0x706] = this.bgcolor[idx | this.bg4[q | 0x3e]];
			data[p + 0x707] = this.bgcolor[idx | this.bg4[q | 0x3f]];
			break;
		case 1: // V反転
			data[p + 0x000] = this.bgcolor[idx | this.bg4[q | 0x38]];
			data[p + 0x001] = this.bgcolor[idx | this.bg4[q | 0x39]];
			data[p + 0x002] = this.bgcolor[idx | this.bg4[q | 0x3a]];
			data[p + 0x003] = this.bgcolor[idx | this.bg4[q | 0x3b]];
			data[p + 0x004] = this.bgcolor[idx | this.bg4[q | 0x3c]];
			data[p + 0x005] = this.bgcolor[idx | this.bg4[q | 0x3d]];
			data[p + 0x006] = this.bgcolor[idx | this.bg4[q | 0x3e]];
			data[p + 0x007] = this.bgcolor[idx | this.bg4[q | 0x3f]];
			data[p + 0x100] = this.bgcolor[idx | this.bg4[q | 0x30]];
			data[p + 0x101] = this.bgcolor[idx | this.bg4[q | 0x31]];
			data[p + 0x102] = this.bgcolor[idx | this.bg4[q | 0x32]];
			data[p + 0x103] = this.bgcolor[idx | this.bg4[q | 0x33]];
			data[p + 0x104] = this.bgcolor[idx | this.bg4[q | 0x34]];
			data[p + 0x105] = this.bgcolor[idx | this.bg4[q | 0x35]];
			data[p + 0x106] = this.bgcolor[idx | this.bg4[q | 0x36]];
			data[p + 0x107] = this.bgcolor[idx | this.bg4[q | 0x37]];
			data[p + 0x200] = this.bgcolor[idx | this.bg4[q | 0x28]];
			data[p + 0x201] = this.bgcolor[idx | this.bg4[q | 0x29]];
			data[p + 0x202] = this.bgcolor[idx | this.bg4[q | 0x2a]];
			data[p + 0x203] = this.bgcolor[idx | this.bg4[q | 0x2b]];
			data[p + 0x204] = this.bgcolor[idx | this.bg4[q | 0x2c]];
			data[p + 0x205] = this.bgcolor[idx | this.bg4[q | 0x2d]];
			data[p + 0x206] = this.bgcolor[idx | this.bg4[q | 0x2e]];
			data[p + 0x207] = this.bgcolor[idx | this.bg4[q | 0x2f]];
			data[p + 0x300] = this.bgcolor[idx | this.bg4[q | 0x20]];
			data[p + 0x301] = this.bgcolor[idx | this.bg4[q | 0x21]];
			data[p + 0x302] = this.bgcolor[idx | this.bg4[q | 0x22]];
			data[p + 0x303] = this.bgcolor[idx | this.bg4[q | 0x23]];
			data[p + 0x304] = this.bgcolor[idx | this.bg4[q | 0x24]];
			data[p + 0x305] = this.bgcolor[idx | this.bg4[q | 0x25]];
			data[p + 0x306] = this.bgcolor[idx | this.bg4[q | 0x26]];
			data[p + 0x307] = this.bgcolor[idx | this.bg4[q | 0x27]];
			data[p + 0x400] = this.bgcolor[idx | this.bg4[q | 0x18]];
			data[p + 0x401] = this.bgcolor[idx | this.bg4[q | 0x19]];
			data[p + 0x402] = this.bgcolor[idx | this.bg4[q | 0x1a]];
			data[p + 0x403] = this.bgcolor[idx | this.bg4[q | 0x1b]];
			data[p + 0x404] = this.bgcolor[idx | this.bg4[q | 0x1c]];
			data[p + 0x405] = this.bgcolor[idx | this.bg4[q | 0x1d]];
			data[p + 0x406] = this.bgcolor[idx | this.bg4[q | 0x1e]];
			data[p + 0x407] = this.bgcolor[idx | this.bg4[q | 0x1f]];
			data[p + 0x500] = this.bgcolor[idx | this.bg4[q | 0x10]];
			data[p + 0x501] = this.bgcolor[idx | this.bg4[q | 0x11]];
			data[p + 0x502] = this.bgcolor[idx | this.bg4[q | 0x12]];
			data[p + 0x503] = this.bgcolor[idx | this.bg4[q | 0x13]];
			data[p + 0x504] = this.bgcolor[idx | this.bg4[q | 0x14]];
			data[p + 0x505] = this.bgcolor[idx | this.bg4[q | 0x15]];
			data[p + 0x506] = this.bgcolor[idx | this.bg4[q | 0x16]];
			data[p + 0x507] = this.bgcolor[idx | this.bg4[q | 0x17]];
			data[p + 0x600] = this.bgcolor[idx | this.bg4[q | 0x08]];
			data[p + 0x601] = this.bgcolor[idx | this.bg4[q | 0x09]];
			data[p + 0x602] = this.bgcolor[idx | this.bg4[q | 0x0a]];
			data[p + 0x603] = this.bgcolor[idx | this.bg4[q | 0x0b]];
			data[p + 0x604] = this.bgcolor[idx | this.bg4[q | 0x0c]];
			data[p + 0x605] = this.bgcolor[idx | this.bg4[q | 0x0d]];
			data[p + 0x606] = this.bgcolor[idx | this.bg4[q | 0x0e]];
			data[p + 0x607] = this.bgcolor[idx | this.bg4[q | 0x0f]];
			data[p + 0x700] = this.bgcolor[idx | this.bg4[q | 0x00]];
			data[p + 0x701] = this.bgcolor[idx | this.bg4[q | 0x01]];
			data[p + 0x702] = this.bgcolor[idx | this.bg4[q | 0x02]];
			data[p + 0x703] = this.bgcolor[idx | this.bg4[q | 0x03]];
			data[p + 0x704] = this.bgcolor[idx | this.bg4[q | 0x04]];
			data[p + 0x705] = this.bgcolor[idx | this.bg4[q | 0x05]];
			data[p + 0x706] = this.bgcolor[idx | this.bg4[q | 0x06]];
			data[p + 0x707] = this.bgcolor[idx | this.bg4[q | 0x07]];
			break;
		case 2: // H反転
			data[p + 0x000] = this.bgcolor[idx | this.bg4[q | 0x07]];
			data[p + 0x001] = this.bgcolor[idx | this.bg4[q | 0x06]];
			data[p + 0x002] = this.bgcolor[idx | this.bg4[q | 0x05]];
			data[p + 0x003] = this.bgcolor[idx | this.bg4[q | 0x04]];
			data[p + 0x004] = this.bgcolor[idx | this.bg4[q | 0x03]];
			data[p + 0x005] = this.bgcolor[idx | this.bg4[q | 0x02]];
			data[p + 0x006] = this.bgcolor[idx | this.bg4[q | 0x01]];
			data[p + 0x007] = this.bgcolor[idx | this.bg4[q | 0x00]];
			data[p + 0x100] = this.bgcolor[idx | this.bg4[q | 0x0f]];
			data[p + 0x101] = this.bgcolor[idx | this.bg4[q | 0x0e]];
			data[p + 0x102] = this.bgcolor[idx | this.bg4[q | 0x0d]];
			data[p + 0x103] = this.bgcolor[idx | this.bg4[q | 0x0c]];
			data[p + 0x104] = this.bgcolor[idx | this.bg4[q | 0x0b]];
			data[p + 0x105] = this.bgcolor[idx | this.bg4[q | 0x0a]];
			data[p + 0x106] = this.bgcolor[idx | this.bg4[q | 0x09]];
			data[p + 0x107] = this.bgcolor[idx | this.bg4[q | 0x08]];
			data[p + 0x200] = this.bgcolor[idx | this.bg4[q | 0x17]];
			data[p + 0x201] = this.bgcolor[idx | this.bg4[q | 0x16]];
			data[p + 0x202] = this.bgcolor[idx | this.bg4[q | 0x15]];
			data[p + 0x203] = this.bgcolor[idx | this.bg4[q | 0x14]];
			data[p + 0x204] = this.bgcolor[idx | this.bg4[q | 0x13]];
			data[p + 0x205] = this.bgcolor[idx | this.bg4[q | 0x12]];
			data[p + 0x206] = this.bgcolor[idx | this.bg4[q | 0x11]];
			data[p + 0x207] = this.bgcolor[idx | this.bg4[q | 0x10]];
			data[p + 0x300] = this.bgcolor[idx | this.bg4[q | 0x1f]];
			data[p + 0x301] = this.bgcolor[idx | this.bg4[q | 0x1e]];
			data[p + 0x302] = this.bgcolor[idx | this.bg4[q | 0x1d]];
			data[p + 0x303] = this.bgcolor[idx | this.bg4[q | 0x1c]];
			data[p + 0x304] = this.bgcolor[idx | this.bg4[q | 0x1b]];
			data[p + 0x305] = this.bgcolor[idx | this.bg4[q | 0x1a]];
			data[p + 0x306] = this.bgcolor[idx | this.bg4[q | 0x19]];
			data[p + 0x307] = this.bgcolor[idx | this.bg4[q | 0x18]];
			data[p + 0x400] = this.bgcolor[idx | this.bg4[q | 0x27]];
			data[p + 0x401] = this.bgcolor[idx | this.bg4[q | 0x26]];
			data[p + 0x402] = this.bgcolor[idx | this.bg4[q | 0x25]];
			data[p + 0x403] = this.bgcolor[idx | this.bg4[q | 0x24]];
			data[p + 0x404] = this.bgcolor[idx | this.bg4[q | 0x23]];
			data[p + 0x405] = this.bgcolor[idx | this.bg4[q | 0x22]];
			data[p + 0x406] = this.bgcolor[idx | this.bg4[q | 0x21]];
			data[p + 0x407] = this.bgcolor[idx | this.bg4[q | 0x20]];
			data[p + 0x500] = this.bgcolor[idx | this.bg4[q | 0x2f]];
			data[p + 0x501] = this.bgcolor[idx | this.bg4[q | 0x2e]];
			data[p + 0x502] = this.bgcolor[idx | this.bg4[q | 0x2d]];
			data[p + 0x503] = this.bgcolor[idx | this.bg4[q | 0x2c]];
			data[p + 0x504] = this.bgcolor[idx | this.bg4[q | 0x2b]];
			data[p + 0x505] = this.bgcolor[idx | this.bg4[q | 0x2a]];
			data[p + 0x506] = this.bgcolor[idx | this.bg4[q | 0x29]];
			data[p + 0x507] = this.bgcolor[idx | this.bg4[q | 0x28]];
			data[p + 0x600] = this.bgcolor[idx | this.bg4[q | 0x37]];
			data[p + 0x601] = this.bgcolor[idx | this.bg4[q | 0x36]];
			data[p + 0x602] = this.bgcolor[idx | this.bg4[q | 0x35]];
			data[p + 0x603] = this.bgcolor[idx | this.bg4[q | 0x34]];
			data[p + 0x604] = this.bgcolor[idx | this.bg4[q | 0x33]];
			data[p + 0x605] = this.bgcolor[idx | this.bg4[q | 0x32]];
			data[p + 0x606] = this.bgcolor[idx | this.bg4[q | 0x31]];
			data[p + 0x607] = this.bgcolor[idx | this.bg4[q | 0x30]];
			data[p + 0x700] = this.bgcolor[idx | this.bg4[q | 0x3f]];
			data[p + 0x701] = this.bgcolor[idx | this.bg4[q | 0x3e]];
			data[p + 0x702] = this.bgcolor[idx | this.bg4[q | 0x3d]];
			data[p + 0x703] = this.bgcolor[idx | this.bg4[q | 0x3c]];
			data[p + 0x704] = this.bgcolor[idx | this.bg4[q | 0x3b]];
			data[p + 0x705] = this.bgcolor[idx | this.bg4[q | 0x3a]];
			data[p + 0x706] = this.bgcolor[idx | this.bg4[q | 0x39]];
			data[p + 0x707] = this.bgcolor[idx | this.bg4[q | 0x38]];
			break;
		case 3: // HV反転
			data[p + 0x000] = this.bgcolor[idx | this.bg4[q | 0x3f]];
			data[p + 0x001] = this.bgcolor[idx | this.bg4[q | 0x3e]];
			data[p + 0x002] = this.bgcolor[idx | this.bg4[q | 0x3d]];
			data[p + 0x003] = this.bgcolor[idx | this.bg4[q | 0x3c]];
			data[p + 0x004] = this.bgcolor[idx | this.bg4[q | 0x3b]];
			data[p + 0x005] = this.bgcolor[idx | this.bg4[q | 0x3a]];
			data[p + 0x006] = this.bgcolor[idx | this.bg4[q | 0x39]];
			data[p + 0x007] = this.bgcolor[idx | this.bg4[q | 0x38]];
			data[p + 0x100] = this.bgcolor[idx | this.bg4[q | 0x37]];
			data[p + 0x101] = this.bgcolor[idx | this.bg4[q | 0x36]];
			data[p + 0x102] = this.bgcolor[idx | this.bg4[q | 0x35]];
			data[p + 0x103] = this.bgcolor[idx | this.bg4[q | 0x34]];
			data[p + 0x104] = this.bgcolor[idx | this.bg4[q | 0x33]];
			data[p + 0x105] = this.bgcolor[idx | this.bg4[q | 0x32]];
			data[p + 0x106] = this.bgcolor[idx | this.bg4[q | 0x31]];
			data[p + 0x107] = this.bgcolor[idx | this.bg4[q | 0x30]];
			data[p + 0x200] = this.bgcolor[idx | this.bg4[q | 0x2f]];
			data[p + 0x201] = this.bgcolor[idx | this.bg4[q | 0x2e]];
			data[p + 0x202] = this.bgcolor[idx | this.bg4[q | 0x2d]];
			data[p + 0x203] = this.bgcolor[idx | this.bg4[q | 0x2c]];
			data[p + 0x204] = this.bgcolor[idx | this.bg4[q | 0x2b]];
			data[p + 0x205] = this.bgcolor[idx | this.bg4[q | 0x2a]];
			data[p + 0x206] = this.bgcolor[idx | this.bg4[q | 0x29]];
			data[p + 0x207] = this.bgcolor[idx | this.bg4[q | 0x28]];
			data[p + 0x300] = this.bgcolor[idx | this.bg4[q | 0x27]];
			data[p + 0x301] = this.bgcolor[idx | this.bg4[q | 0x26]];
			data[p + 0x302] = this.bgcolor[idx | this.bg4[q | 0x25]];
			data[p + 0x303] = this.bgcolor[idx | this.bg4[q | 0x24]];
			data[p + 0x304] = this.bgcolor[idx | this.bg4[q | 0x23]];
			data[p + 0x305] = this.bgcolor[idx | this.bg4[q | 0x22]];
			data[p + 0x306] = this.bgcolor[idx | this.bg4[q | 0x21]];
			data[p + 0x307] = this.bgcolor[idx | this.bg4[q | 0x20]];
			data[p + 0x400] = this.bgcolor[idx | this.bg4[q | 0x1f]];
			data[p + 0x401] = this.bgcolor[idx | this.bg4[q | 0x1e]];
			data[p + 0x402] = this.bgcolor[idx | this.bg4[q | 0x1d]];
			data[p + 0x403] = this.bgcolor[idx | this.bg4[q | 0x1c]];
			data[p + 0x404] = this.bgcolor[idx | this.bg4[q | 0x1b]];
			data[p + 0x405] = this.bgcolor[idx | this.bg4[q | 0x1a]];
			data[p + 0x406] = this.bgcolor[idx | this.bg4[q | 0x19]];
			data[p + 0x407] = this.bgcolor[idx | this.bg4[q | 0x18]];
			data[p + 0x500] = this.bgcolor[idx | this.bg4[q | 0x17]];
			data[p + 0x501] = this.bgcolor[idx | this.bg4[q | 0x16]];
			data[p + 0x502] = this.bgcolor[idx | this.bg4[q | 0x15]];
			data[p + 0x503] = this.bgcolor[idx | this.bg4[q | 0x14]];
			data[p + 0x504] = this.bgcolor[idx | this.bg4[q | 0x13]];
			data[p + 0x505] = this.bgcolor[idx | this.bg4[q | 0x12]];
			data[p + 0x506] = this.bgcolor[idx | this.bg4[q | 0x11]];
			data[p + 0x507] = this.bgcolor[idx | this.bg4[q | 0x10]];
			data[p + 0x600] = this.bgcolor[idx | this.bg4[q | 0x0f]];
			data[p + 0x601] = this.bgcolor[idx | this.bg4[q | 0x0e]];
			data[p + 0x602] = this.bgcolor[idx | this.bg4[q | 0x0d]];
			data[p + 0x603] = this.bgcolor[idx | this.bg4[q | 0x0c]];
			data[p + 0x604] = this.bgcolor[idx | this.bg4[q | 0x0b]];
			data[p + 0x605] = this.bgcolor[idx | this.bg4[q | 0x0a]];
			data[p + 0x606] = this.bgcolor[idx | this.bg4[q | 0x09]];
			data[p + 0x607] = this.bgcolor[idx | this.bg4[q | 0x08]];
			data[p + 0x700] = this.bgcolor[idx | this.bg4[q | 0x07]];
			data[p + 0x701] = this.bgcolor[idx | this.bg4[q | 0x06]];
			data[p + 0x702] = this.bgcolor[idx | this.bg4[q | 0x05]];
			data[p + 0x703] = this.bgcolor[idx | this.bg4[q | 0x04]];
			data[p + 0x704] = this.bgcolor[idx | this.bg4[q | 0x03]];
			data[p + 0x705] = this.bgcolor[idx | this.bg4[q | 0x02]];
			data[p + 0x706] = this.bgcolor[idx | this.bg4[q | 0x01]];
			data[p + 0x707] = this.bgcolor[idx | this.bg4[q | 0x00]];
			break;
		}
	}

	xfer8x8x1(data, p, k) {
		const q = (this.ram[k + 0x1000] | this.ram[k] << 2 & 0x100) << 6;
		const color = this.ram[k] >> 2 & 0xf | this.ram[k] << 4 & 0x30;

		switch (this.ram[k] >> 7) {
		case 0: // ノーマル
			if (this.bg2[q | 0x00]) data[p + 0x000] = color;
			if (this.bg2[q | 0x01]) data[p + 0x001] = color;
			if (this.bg2[q | 0x02]) data[p + 0x002] = color;
			if (this.bg2[q | 0x03]) data[p + 0x003] = color;
			if (this.bg2[q | 0x04]) data[p + 0x004] = color;
			if (this.bg2[q | 0x05]) data[p + 0x005] = color;
			if (this.bg2[q | 0x06]) data[p + 0x006] = color;
			if (this.bg2[q | 0x07]) data[p + 0x007] = color;
			if (this.bg2[q | 0x08]) data[p + 0x100] = color;
			if (this.bg2[q | 0x09]) data[p + 0x101] = color;
			if (this.bg2[q | 0x0a]) data[p + 0x102] = color;
			if (this.bg2[q | 0x0b]) data[p + 0x103] = color;
			if (this.bg2[q | 0x0c]) data[p + 0x104] = color;
			if (this.bg2[q | 0x0d]) data[p + 0x105] = color;
			if (this.bg2[q | 0x0e]) data[p + 0x106] = color;
			if (this.bg2[q | 0x0f]) data[p + 0x107] = color;
			if (this.bg2[q | 0x10]) data[p + 0x200] = color;
			if (this.bg2[q | 0x11]) data[p + 0x201] = color;
			if (this.bg2[q | 0x12]) data[p + 0x202] = color;
			if (this.bg2[q | 0x13]) data[p + 0x203] = color;
			if (this.bg2[q | 0x14]) data[p + 0x204] = color;
			if (this.bg2[q | 0x15]) data[p + 0x205] = color;
			if (this.bg2[q | 0x16]) data[p + 0x206] = color;
			if (this.bg2[q | 0x17]) data[p + 0x207] = color;
			if (this.bg2[q | 0x18]) data[p + 0x300] = color;
			if (this.bg2[q | 0x19]) data[p + 0x301] = color;
			if (this.bg2[q | 0x1a]) data[p + 0x302] = color;
			if (this.bg2[q | 0x1b]) data[p + 0x303] = color;
			if (this.bg2[q | 0x1c]) data[p + 0x304] = color;
			if (this.bg2[q | 0x1d]) data[p + 0x305] = color;
			if (this.bg2[q | 0x1e]) data[p + 0x306] = color;
			if (this.bg2[q | 0x1f]) data[p + 0x307] = color;
			if (this.bg2[q | 0x20]) data[p + 0x400] = color;
			if (this.bg2[q | 0x21]) data[p + 0x401] = color;
			if (this.bg2[q | 0x22]) data[p + 0x402] = color;
			if (this.bg2[q | 0x23]) data[p + 0x403] = color;
			if (this.bg2[q | 0x24]) data[p + 0x404] = color;
			if (this.bg2[q | 0x25]) data[p + 0x405] = color;
			if (this.bg2[q | 0x26]) data[p + 0x406] = color;
			if (this.bg2[q | 0x27]) data[p + 0x407] = color;
			if (this.bg2[q | 0x28]) data[p + 0x500] = color;
			if (this.bg2[q | 0x29]) data[p + 0x501] = color;
			if (this.bg2[q | 0x2a]) data[p + 0x502] = color;
			if (this.bg2[q | 0x2b]) data[p + 0x503] = color;
			if (this.bg2[q | 0x2c]) data[p + 0x504] = color;
			if (this.bg2[q | 0x2d]) data[p + 0x505] = color;
			if (this.bg2[q | 0x2e]) data[p + 0x506] = color;
			if (this.bg2[q | 0x2f]) data[p + 0x507] = color;
			if (this.bg2[q | 0x30]) data[p + 0x600] = color;
			if (this.bg2[q | 0x31]) data[p + 0x601] = color;
			if (this.bg2[q | 0x32]) data[p + 0x602] = color;
			if (this.bg2[q | 0x33]) data[p + 0x603] = color;
			if (this.bg2[q | 0x34]) data[p + 0x604] = color;
			if (this.bg2[q | 0x35]) data[p + 0x605] = color;
			if (this.bg2[q | 0x36]) data[p + 0x606] = color;
			if (this.bg2[q | 0x37]) data[p + 0x607] = color;
			if (this.bg2[q | 0x38]) data[p + 0x700] = color;
			if (this.bg2[q | 0x39]) data[p + 0x701] = color;
			if (this.bg2[q | 0x3a]) data[p + 0x702] = color;
			if (this.bg2[q | 0x3b]) data[p + 0x703] = color;
			if (this.bg2[q | 0x3c]) data[p + 0x704] = color;
			if (this.bg2[q | 0x3d]) data[p + 0x705] = color;
			if (this.bg2[q | 0x3e]) data[p + 0x706] = color;
			if (this.bg2[q | 0x3f]) data[p + 0x707] = color;
			break;
		case 1: // H反転
			if (this.bg2[q | 0x07]) data[p + 0x000] = color;
			if (this.bg2[q | 0x06]) data[p + 0x001] = color;
			if (this.bg2[q | 0x05]) data[p + 0x002] = color;
			if (this.bg2[q | 0x04]) data[p + 0x003] = color;
			if (this.bg2[q | 0x03]) data[p + 0x004] = color;
			if (this.bg2[q | 0x02]) data[p + 0x005] = color;
			if (this.bg2[q | 0x01]) data[p + 0x006] = color;
			if (this.bg2[q | 0x00]) data[p + 0x007] = color;
			if (this.bg2[q | 0x0f]) data[p + 0x100] = color;
			if (this.bg2[q | 0x0e]) data[p + 0x101] = color;
			if (this.bg2[q | 0x0d]) data[p + 0x102] = color;
			if (this.bg2[q | 0x0c]) data[p + 0x103] = color;
			if (this.bg2[q | 0x0b]) data[p + 0x104] = color;
			if (this.bg2[q | 0x0a]) data[p + 0x105] = color;
			if (this.bg2[q | 0x09]) data[p + 0x106] = color;
			if (this.bg2[q | 0x08]) data[p + 0x107] = color;
			if (this.bg2[q | 0x17]) data[p + 0x200] = color;
			if (this.bg2[q | 0x16]) data[p + 0x201] = color;
			if (this.bg2[q | 0x15]) data[p + 0x202] = color;
			if (this.bg2[q | 0x14]) data[p + 0x203] = color;
			if (this.bg2[q | 0x13]) data[p + 0x204] = color;
			if (this.bg2[q | 0x12]) data[p + 0x205] = color;
			if (this.bg2[q | 0x11]) data[p + 0x206] = color;
			if (this.bg2[q | 0x10]) data[p + 0x207] = color;
			if (this.bg2[q | 0x1f]) data[p + 0x300] = color;
			if (this.bg2[q | 0x1e]) data[p + 0x301] = color;
			if (this.bg2[q | 0x1d]) data[p + 0x302] = color;
			if (this.bg2[q | 0x1c]) data[p + 0x303] = color;
			if (this.bg2[q | 0x1b]) data[p + 0x304] = color;
			if (this.bg2[q | 0x1a]) data[p + 0x305] = color;
			if (this.bg2[q | 0x19]) data[p + 0x306] = color;
			if (this.bg2[q | 0x18]) data[p + 0x307] = color;
			if (this.bg2[q | 0x27]) data[p + 0x400] = color;
			if (this.bg2[q | 0x26]) data[p + 0x401] = color;
			if (this.bg2[q | 0x25]) data[p + 0x402] = color;
			if (this.bg2[q | 0x24]) data[p + 0x403] = color;
			if (this.bg2[q | 0x23]) data[p + 0x404] = color;
			if (this.bg2[q | 0x22]) data[p + 0x405] = color;
			if (this.bg2[q | 0x21]) data[p + 0x406] = color;
			if (this.bg2[q | 0x20]) data[p + 0x407] = color;
			if (this.bg2[q | 0x2f]) data[p + 0x500] = color;
			if (this.bg2[q | 0x2e]) data[p + 0x501] = color;
			if (this.bg2[q | 0x2d]) data[p + 0x502] = color;
			if (this.bg2[q | 0x2c]) data[p + 0x503] = color;
			if (this.bg2[q | 0x2b]) data[p + 0x504] = color;
			if (this.bg2[q | 0x2a]) data[p + 0x505] = color;
			if (this.bg2[q | 0x29]) data[p + 0x506] = color;
			if (this.bg2[q | 0x28]) data[p + 0x507] = color;
			if (this.bg2[q | 0x37]) data[p + 0x600] = color;
			if (this.bg2[q | 0x36]) data[p + 0x601] = color;
			if (this.bg2[q | 0x35]) data[p + 0x602] = color;
			if (this.bg2[q | 0x34]) data[p + 0x603] = color;
			if (this.bg2[q | 0x33]) data[p + 0x604] = color;
			if (this.bg2[q | 0x32]) data[p + 0x605] = color;
			if (this.bg2[q | 0x31]) data[p + 0x606] = color;
			if (this.bg2[q | 0x30]) data[p + 0x607] = color;
			if (this.bg2[q | 0x3f]) data[p + 0x700] = color;
			if (this.bg2[q | 0x3e]) data[p + 0x701] = color;
			if (this.bg2[q | 0x3d]) data[p + 0x702] = color;
			if (this.bg2[q | 0x3c]) data[p + 0x703] = color;
			if (this.bg2[q | 0x3b]) data[p + 0x704] = color;
			if (this.bg2[q | 0x3a]) data[p + 0x705] = color;
			if (this.bg2[q | 0x39]) data[p + 0x706] = color;
			if (this.bg2[q | 0x38]) data[p + 0x707] = color;
			break;
		}
	}

	// 4color object
	xfer16x16x2(data, dst, src) {
		const idx = src >> 5 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0xff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj4[src++]]) & 0x80)
					data[dst] = px & 0x7f;
	}

	xfer16x16x2V(data, dst, src) {
		const idx = src >> 5 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj4[src++]]) & 0x80)
					data[dst] = px & 0x7f;
	}

	xfer16x16x2H(data, dst, src) {
		const idx = src >> 5 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj4[--src]]) & 0x80)
					data[dst] = px & 0x7f;
	}

	xfer16x16x2HV(data, dst, src) {
		const idx = src >> 5 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj4[--src]]) & 0x80)
					data[dst] = px & 0x7f;
	}

	// 8color object
	xfer16x16x3(data, dst, src) {
		const idx = src >> 5 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0xff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj8[src++]]) & 0x80)
					data[dst] = px & 0x7f;
	}

	xfer16x16x3V(data, dst, src) {
		const idx = src >> 5 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj8[src++]]) & 0x80)
					data[dst] = px & 0x7f;
	}

	xfer16x16x3H(data, dst, src) {
		const idx = src >> 5 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj8[--src]]) & 0x80)
					data[dst] = px & 0x7f;
	}

	xfer16x16x3HV(data, dst, src) {
		const idx = src >> 5 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj8[--src]]) & 0x80)
					data[dst] = px & 0x7f;
	}
}

/*
 *
 *	Xevious
 *
 */

const VX01 = new Int16Array(new Uint8Array(window.atob('\
+v/2//r/8v8FALL/pv5L/mb+d/6K/pf+pv6z/ub+Lv+A/9j/MAA7AWACiQJcAkICJwITAv0B5gGkAUsB5QB8AAkArv7o/Q/+I/49/k3+Xv5u/n/+iv6r/u7+\
Ov+T/+v/OwCHAL8AswFvAkcCLwITAv4B6QHYAa8BXwH/AJYAKwDJ/3D/Jv/w/s3+vv6+/tb+7f4p/yD/XP5F/l7+bP5+/oz+mP7I/g//Yf+5/w4AXwClANcA\
BQENAbkBXgI2AiECBwLyAeABxgGDAScBwgBWAO//kP9B//v+4v5c/vf9IP4s/kP+Uf5g/nL+fv6U/tT+IP92/8//JQBtALAA2wC9AWACMwIeAgQC8AHcAcoB\
mAFDAeEAdwAOAK3/Vv8U/9v+yP6R/gv+G/4w/kH+U/5i/nP+gP6Y/tj+I/96/9L/JQBwAK4A4AD+AA4BCQERAdoBNQIKAvoB4AHPAbgBeQEgAbsAUQDp/43/\
O//7/s7+tv6x/rz+1v78/iz/X/+S/8T/8P8VADIARgBPAFAASgA9ACsAFAAAAOT/2/+i/43+Hf5A/k/+af50/o7+hv7L/h4AHgH1AVwCOQIdAgMC7wHNAX0B\
JAGxAF4AdP8a/un9EP4j/jv+S/5c/mv+ev6J/r3+B/9a/7L/BwBWAJoAzQDyAAYBCgH/AOgAyAChAHcATQAkAAAA4v/O/7z/u/+r/ycAJwHgARwC9QHfAckB\
twF/AScBwwBeAO3/ov/H/sv94/38/RT+KP44/kr+W/5p/oH+vv4L/2H/uf8OAFoAmQDKAOoA+gD6AO0A1ACxAIoAYAA2AA4A7f/R/7z/r/+q/6r/sv++/83/\
4P/y/wUAFQAjAC4ANQA5ADoANwAyACsAIgAZABAABwD///n/8//w//L/7//2/+v/ZgBkAf0B/QHcAcgBswGeAV8BBwGjADkA0/93/yX/5v66/qL+nf6q/sT+\
6/4b/0//hP+2/+P/CAAlADkARABFAD8AMwAhAA0A9//g/83/u/+s/6P/nf+c/57/pP+t/7b/wv/O/9j/5P/s//P/+P/7//z/+//6//f/8v/u/+n/5f/i/9//\
3f/c/9v/3P/e/+D/4v/k/+f/6v/s/+//8f/y//P/9P/0//T/8//z//P/8v/x//D/8f/w/+//8P/w//H/8f/y//L/8//0//T/9v/2//f/9//3//j/9//4//j/\
9//3//f/9//3//f/+P/3//f/+P/4//j/+P/5//j/+f/6//n/+v/6//r/+v/7//r/+v/6//z/+v/6//v/+v/6//v/+//7//v//f/7//z/+//9//z//f/9//3/\
/f/9//3//f/9//3//v/9//3//v/9//7//v/+//7//f/+//7//v/+//7//v///////////////v////7//v////7//v////7//v/////////+//7//v//////\
/v/+/////v////7//v/+//7//v/+//7//v/+/////v/+//7//v/9//3//f/9//3//v/9//3//f/9//3//f/9//3//f/+//z//f/9//3//v/9//7//f/+//7/\
/v/+//3//v/+//7//f/+//7//v/+//3//v/9//7//v/+//3//v/+//7//v/+//7//v/+//7////+//7//v/+//7//v/+//7//v/+//7//v/+/////v/+//7/\
/v/9//3//v/+//7//v/+//3//v/+//3////9//3//f/9//3//f/9//3//P/8//3//P/8//z//P/8//z//P/8//z/+//8//r/+v/8//v/+//7//r/+v/7//v/\
+v/6//r/+//7//r/+//7//v/+v/7//r/+v/6//r/+v/6//r/+v/6//r/+v/6//r/+v/7//v/+//7//z/+//7//v/+//7//v//P/7//j//f/z/wgAoP+W/k/+\
a/56/o7+nP6p/rn+7P40/4f/3v80AIEAwQD3ABwB/wF/Ak4COwIeAgkC+AHfAaABRAHeAHMACwCq/1n/E//v/rH+Gv4h/jr+S/5d/mz+fP6K/pn+0f4X/3D/\
vP9wAMEBeQJdAjwCIQIKAvUB4wG8AWgBDQGdAEAAqf9H/tz9Cv4a/jP+RP5V/mX+dv6C/qz+8/5D/5z/8v9CAIgAwADsAAABDwH7ADUBCQImAgIC8AHWAccB\
pgFbAf0AkwAvAML/e/+b/sr98v0E/hz+L/5A/lH+Y/5u/ov+zf4b/3P/y/8eAGgApQDTAPIA/gD7AO0A0QCuAIUAWgAxAA0A6f/U/7X/4v/KAJABBAL5AdoB\
xgGxAXoBJAHCAFcA7/+Q/zr/9/7H/qn+of6n/sL+3v4d/xL/Sv4t/kj+Vv5p/nf+hf64/gD/U/+r/wEAUACWAMsA8wAEASQB/AFBAhUCBALqAdcBxgGXAUMB\
4gB4AA8Ar/9X/w7/3v64/rn+Sf4E/ir+NP5K/lz+aP6B/nr+N/+CAG0BLAJBAhUCAgLgAeABSgH8//T+H/4F/iv+Pf5S/mL+cv6F/r7+Cf9f/7n/DABeAJwA\
lgFjAkACJgILAvYB4QHRAa0BYAEBAZkALwDL/2//KP/m/tP+bf75/R7+K/4//lH+YP5x/n7+lv7X/iL/ev/R/yUAcACuAN4A/wAKARAB8wBuAScCGQL/AekB\
1AHCAZEBPQHbAHIACQCn/1L/C//Y/rr+rv61/sr+7f4b/03/gf+1/+L/CgAqAEAATABRAEwAQQAwABsABADx/9X/0/8E/yn+Nf5K/l7+cP5+/o7+n/7R/hr/\
a//P/+cAHwJ/AlECNAIZAgIC7wHSAccAl/+l/hD+KP5D/lb+bv5e/kX/YQAoAdIBLQIcAv0B6QHIAX4BJAG7AFMA4f+L/tX9Af4T/i3+P/5Q/mH+df5//qX+\
3v5f/6AAxQFkAkgCJQINAvYB4wHIAYYBKgHHAFQA/v7q/ev9C/4i/jf+R/5Y/m3+d/6V/sz+RP+CAKgBVwJDAh8CBwLvAdwBxAGEASoBxABaAPH/lP9D//3+\
3f49/vX9H/4q/kH+Vf5f/n/+Yv4M/14AOgECAkMCGwIDAuoB1wGkAU8B7QCDABkAuP9i/xz/6f7K/r7+xv7b/vz+Kv9c/4//v//v/xAAPAAkAD7/ef5D/mH+\
cf6E/pL+of7X/iD/c//L/yEAcQCuAOoA/gCkAWgCSQIwAhUCAALtAdkBowFIAeoAdgAhAFn/Cv7m/Qz+H/43/kf+WP5o/nn+if68/gj/VP9LAJcBXAJUAi0C\
FAL9AegB1QGlAVcB7gCZALX/Rf7X/QH+Fv4v/kD+Uv5i/nL+gP6x/vr+TP+l//v/SwCSAMMA8wD3AIsBRQInAg8C9gHeAdABsgGFAaQASf85/tv9CP4c/jT+\
Rv5X/mf+d/6s/vX+Sf+j//j/RwCMAMMA5QAAAfgANQEMAiQCAALuAdUBxQGqAW0B9wCx/2v+z/3v/Qr+If41/kX+Wv5m/of+vv49/30AogFNAjgCEgL8Ad4B\
1gGNAVkAQf9Y/vL9F/4r/kL+VP5k/nX+qP7x/kf/nP/3/z0AtgDpAV8CLwIZAvoB6QHOAckBXgEUAPn+GP7v/Rj+Kv5B/lH+Y/5x/p/+6P45/5T/6v88AIAA\
twDfAPYA/QD2AOEAwwCeAHUATAAlAP7/5v+///7/6wChAQMC8AHUAcEBpwFoAQwBqwA8AOL/VP8N/r/97/3//Rz+Kf5D/kb+Yf5//3gAOgHTARQC+AHeAcoB\
oAFQAfAAiAAbAL3/Xv8h/7n+7P30/RD+If42/kb+Vv5n/nT+k/7W/iP/fP/T/yYAbwCtANoA9gAFAQMBvQE2AgwC+gHfAcwBuwGKATYBEgC+/uX94v0H/hv+\
Mf5B/lT+Y/55/rX+Af9Z/7D/BgBTAJMAxQDmAPYA9wDrANMAsQCKAF8ANQAPAO3/0P++/6//rv+m/9j/yACoARQC+wHgAcoBuQGUAUcB6QCBABcAtP9c/xH/\
2v62/qX+p/64/tv++/5F//f+Of48/k/+YP52/oD+n/7E/rD/+wDwAWcCOgIeAgUC6wHiAQkByf/S/hn+Fv46/kj+a/5Q/gP/MgABAbMBIgIiAv4B6gHNAYkB\
MQHKAGIA6/+O/tH9+v0O/ij+Ov5L/lz+bf55/pr+3v4r/4X/3P8vAHoAtACtAWICOAIiAgQC7wHaAcgBngGGAEn/S/7p/RP+J/4+/k/+Yv5v/ov+zv4b/3P/\
y/8eAGkApwDWAPMAAQEAAfAA2AC1AJAAYQBPAP4AtgEBAusB0QG/AZ4BUwH3AJAAJwDE/2r/G//k/rf+s/5+/gD+F/4q/jz+Tv5c/m7+ef6c/uL+MP+I/+D/\
MwB7ALUA4QD+AAgBAwH1ANUAawEZAg4C8wHeAcoBsgFwARYBsQBGAOD/g/8w//H+xv6s/qz+Lv4I/iv+Nf5L/ln+av53/o3+yv4V/2v/w/8YAGQAowDVAPgA\
BQEMAfEAegEpAhMC/AHlAc8BvwGPATkB2QBwAAcAp/9Q/wv/2P66/qz+t/7E/vn+7P44/jj+Tv5d/m/+fv6L/rX+/v5M/6n/9f+XAOABdwJPAjQCGAIDAu4B\
3QGxAWEBAAGYACwA2v7g/fb9EP4q/j/+Uf5j/ln+TP9VABkBuAEZAhgC9wHjAb0BcQESAakAPwDa/4D/M//4/tH+vv6+/s/+7P4W/0b/ev+u/93/BAApADsA\
XgDp/+b+Tf5F/mH+cf6E/pH+o/7d/if/e//T/ycAdAC1AOcACQEZARsBDgH2ANYArgCGAFgAQwDzAK8BDQIBAuMB0QGzAW0BEAGpAD8A2v9//y7/9f7F/r3+\
i/4K/h7+Mf5D/lX+ZP52/oD+ov7n/jP/jf/j/zYAfwC6AOcAAgEPAQsB/QDaAN0AogEeAgUC7wHXAcYBoAFRAfMAiwAgAL7/Zf8b/+P+v/6w/rP+xf7l/hD/\
QP90/6T/2P/4/y0A5P/x/lT+Pv5c/mv+gP6L/qb+6P4z/4v/4/81AIAAvADqAAgBFAESAQIB5wDEAJwAcQBHAB8A///j/87/wf+8/73/xf/Q/+D/8f8FABcA\
JQA2ADsA3gDZASYCAwLsAdMBwwGpAWMBCAGjADgA1P95/yj/7P7C/qz+qv65/tT+/f4r/1//k//D//P/U/+B/j/+Vv5n/n3+g/7V/l3/0v9DAKEA7AAhAT8B\
SgE9ASUB8gAWAYgBvQHPAbgBhQE7AeEAfwAcAMH/b/8r//n+2f7L/s/+4f7//if/Vv+G/7X/4P8GACUAOwBJAE0ASAA/ADEAGgARAIn/zf5U/jb+U/5k/nT+\
kf7R/h//d//N/yIAbQCpANgA9gAEAQMB9ADaALYAjgBkADoAEgDx/9X/wf+0/7D/sv+6/8f/3P92ACMBkwHdAfUB5gG8AXQBGgG1AE0A6P+O/z//A//a/sX+\
wv7P/ur+Ef9B/3P/pf/W/wAAIwA9AFAAUwBdACoAb//f/nf+SP5d/m/+gv65/gL/VP+x//v/iQBzASgCWQIwAhYCAALjAbABGQEEACT/Z/4M/if+Pf5R/mL+\
cv6l/u3+P/+a//H/PwCHALYANQH8AT8CHwIHAu8B2AGaAUEB2wBwAAkAp/9Y/43+8P0M/iH+Nv5J/lr+aP6J/s3+Gv91/8z/HwBpAKQA0wDvAPwA+wDqAEkB\
xgH9AfcB3QGyAWQBBQGlAL//tf4C/vH9Ff4q/j3+VP5R/gL/7/+bADEBlgHVAesB3AGuAWcBDgGtAEYA5f+P/0X/Cv/n/kv+Bv4r/jr+Tf5e/mv+jv7U/iL/\
fP/S/y4AAAHZAUsCNQIVAv4B6QHCAWoBewB5/7L+GP4O/i7+P/5V/mP+g/7G/hP/bP/E/xcAYQCfAM0A6wD4APUA5gDLAKsAgQBbACkAMwC5AB0BXAF2AXAB\
TwEaAdUAhQAxAOT/mP9k///+MP76/Rz+Lv5D/lT+Yf6G/s3+Hf92/9D/IQDdAL4BPAIxAhEC+AHkAcEBdAEVAa4AQwDf/4P/Nv/8/tX+v/4+/hX+N/5E/lf+\
Zv53/qv+9f5I/6L/+f9IAIsAwADmAPkAAAH1AOIAvAC4ADIBjgG6AcEBowFvAR8B0ABSAE7/af7v/Qf+Iv42/kv+Wf5w/lL/MwDgAG0ByQH8AQAC5QGtAVsB\
/ACTACoAyf9z/yv/9v7W/sf+y/7f/v/+J/9b/4j/xP/E/z7/3/6l/oz+lP6x/ur+If+0/68AbQEEAkUCKAINAvcByQF4ARYBrABBAN//hf87/wT/4P7O/tX+\
4f4N/wD/ef5T/mX+dv6F/rL++v5K/6L/+P9JAI4AxgDvAAUBEAEBAUkB1AEYAg4C9AHUAZEBMgHaABQAAf8y/vb9Hf4v/kX+V/5m/n/+v/4M/2P/vP8QAFwA\
mgDLAOoA+QD5AOsA0QCwAIgAXgA0AA0A7P/Q/7z/sP+q/6v/tP/A/9L/5P/6/wcANADjAHUB1AH/AeoB0gGWAUoBzgC+/9D+FP7r/RD+I/45/kv+Wv6H/s7+\
IP96/9L/IwBqAKMAzADlAO0A5wDUALYAkgBoAD4AFgDx/9L/uv+p/6D/nv+j/63/u//N/+D/8/8FABMAIQAqADAAMwAxAC4AKAAhABkADwAGAP7/9//y/+//\
7P/v/+r/WwADAWwBsgHLAb8BkwFOAfcAlwAzANT/f/81//v+2P6//sr+cv4Q/i3+PP5Q/l7+df6y/v3+U/+u/wIATwCRAMMA5AD0AAMBhwEEAhMC9AHiAb0B\
cwEXAa8ARADf/4T/Nf/5/tL+vv69/sz+6P4R/0H/dP+m/9f//v8mAMH/MP/V/pb+ff6C/qH+1P4W/2X/tf8DAFEAFAHkAUoCNAIWAv4B6gG5AWMBAQGXAC0A\
zP90/y3/+f7Z/sn+0v7h/gv/FP+S/lP+X/5y/oH+rP7y/kL/m//w/0UAggD2AM0BTQJAAiACBgLzAckBhQHoAND/8f45/gn+Lf4//lP+Zf50/qj+8f5E/5//\
9P9DAIcAvgDkAPoA/wD6ANsAAwGHAdMB9QHsAcIBfAEjAb4AUwDy/5H/Tf/W/g3+/P0c/i7+Q/5T/mH+e/69/gj/Y/+z/y0AGQHlAUcCKgIOAvUB4gG1AV4B\
/QCSACwAvv/D/vr9+P0X/iv+QP5Q/l/+dv6z/v/+Vv+v/wcAUQCVAL8AKAHqATQCFwL+AeYB0AGSATcB0QBpAP3/qP8e/yz+6/0R/iP+Of5J/lr+av6c/uT+\
O/+L/ygAIAHhAUYCKAILAvMB4AGuAVcB9wCLACUAtv+5/vj9/P0Z/i3+Qv5T/mL+ef64/gT/W/+0/wgAVQCVAMcA5wD6APYAAQGCAfEBCQLuAdgBpwFRAfcA\
ewBz/3z+6/36/Rj+LP4//lD+X/6O/tb+Kf+C/9n/KwBxAKkA0QDrAPIA7gDWANUAUQGwAd0B4AHAAYIBLwHNAGgAAwCl/1T/Ev/i/sf+vv7H/tv+//4m/2f/\
R//H/oX+YP5j/n/+tP74/kn/n//z/0EAgwC5AN8A9QD8APQA4ADBAKEAcQBxAPAATwGEAZYBhwFdAR8B0gB9ACcA1f+N/0//If8C//T+9v4B/xv/Ov9p/3f/\
9/6X/mP+X/5x/pP+1P4e/3X/y/8eAGgApQDUAPMAAAEAAfEA2gC2AJIAZgBOAL0ALgFsAYsBhwFmATAB6QCZAEQA8v+p/2j/NP8R//3++v4C/xX/M/9a/33/\
sf9s/+X+nP5v/mn+f/6u/u/+PP+R/+X/NwB2AMsAkwE1AkICIAIFAvIBzwGLARMBBQAW/1L+Af4l/jj+Uv5a/nr+Xf8qAM8AVAGtAd4B6QHRAZwBUQH4AJUA\
MgDW/4X/Pv8P/2T+Bv4q/jn+Tv5f/m3+hf7E/g7/Zv+9/xkA7gDLAUsCPwIeAgYC8QHNAX4BHQG0AEgA6P9y/3n+8/0Q/iX+Ov5N/l7+bP6N/tL+IP96/9D/\
IwBsAKgA1QDyAP0A/gDjABUBnAHnAfwB5gHCAXsBIQG8AFIA7f+R/0L/BP/a/sT+wf7P/un+EP8//3H/pf/V////IwA+AFAAWABXAE4AQwAoAHn/0f5d/j3+\
Wf5q/nr+oP7k/jP/jP/i/zUAfQC6AOQAAAEKAXoBDgIqAg0C9gHdAaEBRwHhAHYAEACs/2T/sv79/Qz+Jf45/kv+W/5p/of+yP4V/23/xf8aAGQApADQAP4A\
pgEtAigCCQLzAd4BqQFSAe8AhQAbALr/ZP8e/+z+zf7C/sv+4P4C/zD/Yv+V/8j/9f8cADsAUQBdAF8AWgBOAD0AJgARAPb/6P/C/w7/cv45/lH+Y/51/oX+\
uP4B/1P/rf8CAFMAlgDNAO4AIwHMAToCKQINAvcB3QGcAUEB2wBxAAoArP9Z/xb/6P7R/sb+2/6L/jL+TP5Z/mz+e/6a/vj+fP/0/2AAugAAAS4BRQFHATYB\
FAHnAK8AfwCsAN4A7gDsANYAswCFAFEAGwDo/7n/kf9z/13/Uv9R/1j/Z/98/5X/rv/I/+H/9/8IABgAx/9a/xb/5/7V/tn+8f4Z/0z/h//F/wEANgBmAIoA\
owCxALMArACcAIUAawBOADAAEwD7/+X/1f/M/8f/xv/N/9H/+v97AOIAKAFQAVoBSwElAe8ArQBlABsA2/+S/+z+Yv4d/iv+Rf5U/nH+qP4R/+H/kwAiAYwB\
zAHmAdwBswFzASABwwBiAAQAsf9o/y7/B//y/u3++P4Q/zL/Xf+K/7n/5P8LACwARABUAFsAWQBUAEMAOwDt/17//P63/pP+jP6g/sv+A/9J/5f/4f8qAGcA\
7QCEAeEBFwIaAv8BxwFyARYBVwB6/9X+Tf4X/jH+R/5Z/m/+q/71/kz/pv/7/0oAiQDBANsAKQGiAeUBAALzAcYBfwEmAcIAWgD3/6D/Uv8Z/5v+HP4f/jb+\
Sf5Z/nT+tP4A/1n/sf8FAFIAkgDCAOIA8gBJAaoB1gHgAcQBjQFBAeYAhgAlAMz/fv87/wz/k/4g/ib+PP5Q/l/+hf7L/hr/dP/M/x4AZgChAMwA6ADyAO4A\
3gDBAKAAcgCBAM4A+AAMAQYB7QDHAJQAXAAiAOr/tv+M/2r/U/9H/0b/Tv9e/3X/kP+q/8f/4P/5/w0AHAAlACoAKgAmAB4AFAAIAPv/7v/l/9f/1v+2/zn/\
3v6m/o3+kv6v/uD+Hv9n/7P//P9AAHoApwDHANgA3QDVAMMApQCRANkAGAE1ATkBJQH/AMoAjABLAAoAzv+a/3D/VP9B/zn/Pv9L/2T/fP+j/3v/Iv/0/tz+\
3f70/hr/S/+H/8P//v81AGUAigCkALIAtwCvAKEAjABxAFUANABmAL8A8gARARMBBAHhALQAfQBBAAgAz/+p/13/xv5e/i7+Qf5U/mf+nf7l/jv/kf/r/zMA\
qgBZAdABHAIgAgIC5AGaAUgBrQDI/xH/fv4c/h3+OP5K/lz+if7R/iL/fP/T/yYAawCnAMwA/wB8AdEB+QH5AdUBlgFBAeAAeQAUALj/Z/8m//f+3P7U/t3+\
9f4V/0L/c/+k/9P///8iAD4AUABcAFoAWgACAHz/H//c/rb+rP66/t/+EP9O/5L/2P8XAGUABAGJAd0BCAIJAugBqwFXAfcAjwApAMz/ev82/wb/6f7f/ub+\
+f4c/0P/fP9+/zL/C//6/gD/GP88/23/o//c/xEAQQBqAIoAnwCpAKoAoQCSAHwAYwBIAC0AFAD9/+v/3v/W/9H/0//T//L/bQDXAB4BSAFTAUgBIwH1AJ0A\
4/8//8D+Zf41/jr+Uv5m/sX+jP85AMsAOwGEAa4BswGbAWcBJQHQAH8AFABK/6j+L/4X/jX+SP5Y/nf+u/4I/2L/uv8OAFoAlwDJAOEAMgGmAeIB+QHmAbUB\
bgEPAbUADQAz/5L+Gv4R/i7+Qf5S/m7+sP78/lX/rv8CAE0AjAC8ANwA6wDrAN0AxACiAHsAUgApAAQA4P8YAHUAsADYAOcA4wDOAKwAfwBNABoA6P+5/5H/\
dP9a/1v/J/+w/m/+Tf5R/m7+o/7n/jj/jv/i/y8AcQCnAM0A4gDpAOAAzgCwAI8AYgBTAJ4A2AD2AP8A8QDTAKcAdQA8AAMA0f+i/33/YP9P/0f/TP9R//P+\
pP6B/nn+jv66/vT+O/+K/9b/IQBdAKcAPQG0AfkBEgL/AdYBiwE1AboA3P8Z/4H+Gf4c/jb+Tf5W/pv+Xf8GAJgADAFcAYwBnAGOAWQBKgHfAJEALABm/8L+\
SP4c/jX+Sf5Z/nr+vf4L/2T/vv8NAJ8AUgHJARkCIgIEAucBngFMAZ0AvP8M/3z+Hv4e/jn+TP5e/pH+2/4u/4j/3f8uAHMAqgDTAOoA8ADqANUADAFWAXMB\
dAFYAScB5gCaAEwA/v+4/3v/TP8d/6H+NP4n/j/+Uv5k/p3+4/5N/xgAzABYAbsB8gEDAu8BuwFxARYBsABLAOv/lv9N/xb/8f7h/uP+8f4N/zX/Y/+U/8X/\
8P8YADQAUgBAAM7/c/8w/wX/9P73/gv/Lf9e/5T/zP8EADUAYgCDAJ0AqQC2ABkBcQGcAacBkQFkASEB1QB6ALj/A/98/iT+Kv5D/lT+af6h/uz+Qf+b//D/\
PwCCALYA2gDuAPIA6ADRALEAiwBiADcAEQDt/8//uf+q/6P/pP+r/7b/y/8+ALwAEQFIAV8BWwE/AQ8B0ACJAD4A9v+0/33/Uf8x/yD/HP8i/zX/Uf9w/5X/\
tv/d/+b/iv9A/xL/+v74/gr/Kf9U/4f/v//0/yYAUgB1AJEAmwC7ACoBeQGiAagBjgFdARoBygB0AB8A0P+L/1L/KP8P/wX/Cv8a/zX/Wf+A/6n/0f+W/0f/\
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\
Gv8e/y7/S/90/6L/0v8AACwATwBrAH8AiQCMAIYAegBpAFMAPQAmABAA/f/s/+D/1//T/9P/1f/c/+P/7f/2/wAACgARABgAHAAeAB8AHwAdABkAFAAPAAoA\
BgABAP3/+v/4//f/+P/4//n//P/6/zEAiQDDAOgA9QDwANkAtQCGAFMAIADt/77/l/96/2L/X/9C/+3+vP6n/qz+yP70/i3/av/H/2AA3gA6AXYBkQGOAXEB\
PgH8AK4AYAAOAM7/Zv/Y/nz+P/44/kz+Zv6k/u3+Qv+a//L/OgCvADkBkgHJAdgBxgGZAVIBBAFzAL//L/+7/m7+Qv46/k3+e/68/gn/Yf+1/0IA3wBQAZ4B\
xQHJAbABfAEzAd4AhAAnANv/YP/K/mb+Kf4x/kn+W/6f/gf/b//V/zAAfQC7AOYA+wAlAVIBXAFPASsB9wC3AHIALADo/67/ff9Y/z3/Av/P/rv+vf7U/vr+\
Lf9o/6f/5P8cAE0AcgCNAJ0AoQCbAIwAdgBcAD8AJAAHAO7/2v/K/77/u/+4/8f/BgBAAGkAhgCTAJYAjQB6AF8AQQAhAAAA4v/I/7L/o/+a/5b/mP+f/6n/\
uf+i/3j/Zf9b/2D/cP+H/6T/xf8TAGcApADPAOUA6gDdAMQAnQBEAOL/kf9S/yb/Dv8H/xL/Kf9N/3j/qf/W/xYAeADDAPgAFQEbAQ4B8ADFAJMAWwAiAO7/\
vv+Y/3r/av9d/yf/AP/z/vf+Df8w/17/kf/H//v/KQBQAG8AgwCOAJEAiQB6AGcAUAA2AB4ABQDy/+H/1v/L/9T/DAA+AGIAegCEAIUAegBrAEUA8v+o/2//\
Rv8v/yf/Lv9B/1//hf+u/9j//v8iAEAAVgBmAG0AbgBmAGcAjwCpALIArgCcAIEAYAA7ABQA7//O/7P/nv+P/4j/h/+Q/4v/X/9E/zz/QP9Q/2v/jf+z/9r/\
//8hAD8ATwB8AL0A4wD2APYA4wDEAJoAbAA4AAgA2v+z/5T/fv9y/23/cv9+/4//pP+7/9P/6v/+/xMACwDa/7X/m/+M/4f/i/+X/6n/v//Y//H/CAAdAC8A\
PABFAEoASQBFAD0AMwAoABsAEAAEAPv/8//t/+r/6f/p/+3/7f8PAE8AeQCXAKUApQCaAIQAaABGACMA///h/7v/av8t/wf/9f74/gr/Kf9S/5f/BQBgAKoA\
4AD9AAcB/gDlAL8AkQBeACoA9//K/6T/iP90/2v/av9y/4H/lf+r/8X/3f/0/wcAGAAjAC4AGwDg/7L/kf97/3L/dP9//5L/q//H/+P/AAAZAC8AQQBNAFMA\
VABQAEkAPwAyACQAFwAKAP//IABPAGsAfQCDAH8AcQBcAEQAKAAMAPH/2P/E/7T/qv+l/6b/ev9N/zj/Mf85/07/bv+S/8H/HwB2ALYA5AD7AAAB8gDYAK8A\
gABPABsA7P/C/6D/hv93/2r/Mv8N///+A/8X/zj/ZP+V/8f/+v8lAEwAaAB9AIgAiACDAHUAYwBNADYAGwASADYAUgBiAGkAZgBbAEsANgAeAAYA7//Z/8r/\
s/9w/z7/If8W/x3/L/9O/3b/ov/Q//z/JABEAF4AcAB6AHgAkwC/ANMA2ADLALEAjwBkADsA7v+K/0H/DP/v/uf+8f4L/zD/iv/2/04AlwDKAOsA+ADxANwA\
kAAtAN7/l/9g/zr/Jv8k/yz/Q/9k/4v/tv/g/wgAKwBIAF4AawBxAHEAZwBpAJEAqgCxAKsAmAB9AFsANgARAOz/zf+x/53/kf+K/4r/kf+c/6v/vP/N/+D/\
8P/+/wsAEwAaABIA2f+n/4b/b/9l/2f/df+H/7H/CQBTAI0AtgDNANMAywC2AJYAcQBIAB0A9P/Q/7L/nP+M/4n/Yv8w/xn/E/8g/zb/XP+H/7T/5P8QADcA\
VwBvAH0AhQB/AJUAvwDSANUAyACuAIwAZAA4AAwA5f/C/6T/kf+F/4H/hP+N/5v/rf/C/9X/6v/7/wwAEgDm/7r/nP+I/4D/g/+N/57/tP/O/+n/AgAaAC0A\
PQBHAE0ATQBKAEMAOQAuACIAFAAMADIAXAB1AIMAhAB8AGwAVAA5AB0AAADl/87/u/+t/6X/ov+k/6r/tP+//87/3P/p//b/AAAIAA4AEAARABEA5P+p/4L/\
Z/9a/1j/Zv96/5b/tv/X//r/GAA+AIwAxwDtAP0A+gDnAMYAnQBrADkABwDc/7D/Wv8T/+n+1f7X/u3+Ef9B/3n/s//r/yAATQBxAIsAmACmANYA9wAAAfgA\
3gC5AIoAVwAjAPL/xv+h/4b/c/9r/2v/dP+D/5f/rf/G/93/9//q/8D/pv+W/5D/k/+d/63/wv/Y/+//BwAaACoAOABBAEUARQBBADoAMQAnABoAEAAFAPz/\
9f/w/+z/6v8XAE4AcgCMAJUAkwCGAHIAVwA3ABcA+P/c/8P/r/+j/5r/nP+R/17/Pv8w/zP/Qf9b/37/pf/P//b/GwA7AFQAZQBvAHEAbABiAFMAQgAvABsA\
CQD4/+r/4P/Y/9X/1P/X/93/5P/s//T//f8FAAwAEgAWABcAGQAYABcAEQArAGIAgwCXAJwAlgCEAGsATQArAAkA6P/N/7T/ov+X/5L/k/+Z/6T/sf/A/9H/\
4v/w//7/CAAPABQAFgAVABEADQAHAP//+P/w/+v/5v/i/9//3//d/9//4P/l/9//rf+B/2b/Wv9Z/2X/e/+W/7f/2P/5/xgAMgBHAFUAXgBgAF4AVQBIADoA\
KgAZAAoA/P/x/+f/4f/e/97/3//k/+n/8P/3////BQANAA4AJABgAIsApgCwAK4AngCFAGYAQQAcAPf/1v+6/6b/lv+N/43/kf+a/6n/uv/L/9z/7f/+/wgA\
FAD4/8H/nP+D/3b/dP97/4z/ov+8/9j/9v8PACYAOgBHAE4AWACJALUAygDPAMMArQCMAGYANwDY/37/Pf8O//X+8v7//hr/Qf9x/6X/2P8JADQAVgByAH8A\
nwDXAPQA/wD2ANwAtgCIAFQAIADv/8P/nf+G/1D/DP/q/tz+4/78/iH/VP+I/+H/UQCmAOkAEQEjASABCgHkALIAfQBAAA0AwP9Y/w7/3P7E/sP+1v76/in/\
Y/+h/97/FgBHAG8AjQCfAKIAqwDWAPAA8wDmAMgAoQBzAEIAEQDi/7v/mv+C/3P/bf9w/3n/V/83/y//M/9F/2P/h/+w/9n/AgAmAEUAWAB+AMAA6QD9APwA\
6wDLAKAAcAA8AAkA2/+x/5b/af8f//L+3P7c/vD+EP8//3T/rf/l/xgARQBoAIIAkQCWAJEAhQByAF0AQAAvAEsAYgBsAG4AZABVAD8AKQAIALf/cf9A/yD/\
FP8a/yr/R/9v/5r/x//z/xsAPQBYAGsAdQB3AHIAZwBXAEQAWwB8AIkAjACCAHAAWAA7ABsA/f/h/8j/tf+n/53/m/+d/6X/qv+B/1//T/9M/1b/a/+H/6n/\
zP/w/xEALgBDAHAAtADeAPQA9gDnAMoAogBzAEIAEADi/7v/mv+C/3P/bP90/17/Mv8j/yH/MP9K/27/mP/E/+7/FwA6AFUAaQB0AHgAdABpAFsARwAzAB4A\
CgD4/+n/3f/U/9D/z//T/9f/3//o//L/+v8KACIANQA/AE4AdwCTAJ8AnwCTAH0AYAA/ABwA+v/b/8H/rP+c/5X/kv+Y/5X/d/9n/2P/av97/5L/r//K//n/\
PgB1AJsAsgC5ALQAoQCKAFYABwDG/5H/Z/9O/0P/RP9P/37/xv8DADgAYQB/AJEAlQCSAGkAKAD0/8X/oP+G/3j/cv93/4P/mP+v/8r/5f/+/xYAJwBBAHMA\
mACsALEAqQCXAHsAWgA2ABIA7//Q/7f/pP+W/5H/k/+Z/6P/sv/C/9X/z/+1/6j/ov+l/63/uf/J/9z/7/8BABIAHgBDAHMAkAChAKQAmwCJAG8AUQAvAA4A\
7//U/73/rP+i/53/n/+l/7D/vf/M/9z/7P/5/wYAEAAWABoAGwAaABcAEgAMAAUA///2//H/7P/n/+X/5P/l/+H/vP+d/4v/gv+E/43/nv+1/87/6P8BABkA\
KwBNAIEAogC1ALkArwCcAH8AXwAlANj/mv9p/0n/Of83/0L/V/+Q/93/HQBUAH0AmQCnAKgAngCJAG0ATgAsAAoAyv+I/1v/PP8v/zH/Pv9Y/3v/ov/K//H/\
FgBTAJMAvQDXAN4A1gDAAKAAeQBOACIA+f/T/7T/nf+N/4b/hv+N/5n/qf++/9L/5f/7/wAA5P/P/8D/uf+4/73/x//R/+7/KABTAHUAigCSAJEAhABzAEkA\
AwDJ/5r/eP9j/1n/XP9q/4D/nP+8/93/+/8YADAAQwBQAFcAWABUAEwAPgBCAFwAaQBtAGgAWwBJADMAHAAEAO3/2f/K/7n/if9j/07/SP9M/17/eP+V/8P/\
DgBRAIMApgC5AL4AtQCgAIQAYQA7ABUA8f/S/7f/pP+X/5H/k/+Z/6b/tf/E/9f/6f/5/wcAEwAaACEAIgAhAB0AFwAQAAYAAADs/7z/mP+A/3T/cv97/43/\
ov/P/xQATQB5AJgAqQCsAKMAkAB3AFgANgAUAPT/2P/B/6//pP+f/6H/pv+x/77/zf/d/+z/+/8HABIAGQAdAB8AHQAaABQADwAIAAAA+f/y/+7/z/+k/4n/\
ev91/3v/iv+g/7n/1f/x/wsAIgA1AEQATQBRAFAASwBCADYAKgAcAA0AAgD4/+7/7f8PADAARwBVAFwAWQBQAEMAMgAeAAoA9//l/9b/yf/B/7z/vv+0/5D/\
ef9u/27/ef+L/6P/vv/c//f/EwAnAEgAfwCkALgAvgC3AKQAhwBlAEAAGgD2/9b/u/+n/5n/lf+R/2//WP9R/1X/Zf9+/57/wP/j/wQAIgA5AFYAigCwAMUA\
ygDAAKoAjABnAD8AFwDx/9D/tP+f/5P/jf+O/5X/of+w/8T/0//C/67/pv+l/6z/t//G/9f/6//8/w0AHAAnAC8ANQA2ADUAMQApACEAGAAPAAYA/v/3//L/\
7v/s/+v/7P/v//H/9v/4/w8APABbAG8AeQB4AG4AXQBGAC0AEwD5/+H/zf+9/7L/rP+r/63/s/++/8r/1f/j/+3/+//3/9T/uv+q/6L/of+n/7H/wf/T/+f/\
+v8LABsAJwAwADYAOAA2ADMAKwApAEYAXwBsAG4AagBdAEoANAAcAAQA7v/a/8r/vf+3/7P/s/+4/8D/yP/V/9//6//2//7/BQAKAA0ADwAPAAwACAAFAAAA\
+v/2//H/7v/r/+n/6f/p/+r/6//t/+//8//z//f/4P+5/6H/kf+M/4//mv+r/7//1//v/wUAGgArADgAQQBFAEQAQQA6ADAAJgAaAA8ABAD6//L/7f/p/+f/\
6P/p/+z/8P/1//r/AAAEAAcACgAMAA0ADQANAAwACQAHAAUAAgD///3//P/6//r/+v/5//r/+//6//3//v8AAP//CAAwAFEAZwByAHQAawBdAEgAMAAYAP7/\
5//T/8L/t/+v/6//mP90/2L/Wv9h/3H/if+l/8T/5P8CAB0AMwBEAE4AVABSAGcAhwCTAJYAiwB4AF8AQgAiAAIA5f/K/7r/lP9g/0P/NP81/0D/WP95/53/\
3/8uAGsAmQC2AMMAwgC0AJoAegBUACwABgDh/8L/qv+Y/47/jP+P/5n/p/+4/8n/3f/u////CADt/9H/v/+0/7D/sv+6/8T/2/8TAEUAagCDAJAAkgCJAHkA\
YQBGACkACwDw/9n/xf+3/67/qv+s/7L/uv/G/9T/wP+o/5v/l/+c/6f/uP/K/+T/HQBVAH0AmQCmAKYAnACJAGoAJQDg/6v/f/9h/1L/T/9Y/2z/hv+n/8j/\
8P83AHQAoQC9AMkAxgC2AJsAeQBUACoAAwDg/8D/qP+Z/47/jf+G/2X/Vf9Q/1n/bf+I/6n/y//t/w0AKQBAAFAAWgBeAFwAVQBKADwALAAcAAwA/f/x/+f/\
4v/c//X/HwA8AFIAXgBhAF0AUQBDABQA2P+p/4b/bv9h/2L/bP9//5f/tP/S//D/DAAjADgARABSAHsAmwCqAKwAoQCMAHAATgArAAgA5//L/7T/o/+Z/5b/\
l/+h/6D/hP92/3P/ev+K/6H/u//V//D/CwAgADMAQQBJAEsASwBFADwAMAAkABUADQAlAD8ATgBUAFMASwA/AC4AHAAIAPX/5P/W/8r/wv++/7z/vv/E/8r/\
1f/F/6X/lP+L/4z/lf+j/7f/zP/k//r/DgAgAC4AOAA/AD8APQA3AC8AJgAbABAABQD7//T/7v/q/+f/6P/p/+z/7//+/ysATwBoAHYAeQBzAGUAUQA5AB8A\
BQDr/9n/tf99/1j/Qv87/0D/Uv9t/4//tP/Z//7/HABMAIsAswDMANIAyQC0AJYAcABGABwA9P/Q/7P/nP+N/4b/hv+N/5n/qv+9/9D/5P/2/wcAFAAdACMA\
JQAkAB8AGQARAAcAAQDh/7D/jv94/27/b/96/43/pf/B/93/+v8TAEQAfQCjALoAwQC7AKgAjABqAEQAHQD5/9j/vP+n/5n/kv+S/5j/o/+x/8P/1f/m//f/\
BgASABwAIQAjACIAHgAZABIACgABAPv/8//t/+j/5//k/+P/5P/m/+n/7v/x//b/+f/9////AQACAAMAAwACAAAAAgDu/8H/o/+P/4b/h/+Q/6D/tf/N/+f/\
//8VACoAOABDAEoATABpAIkAlwCaAJMAgABoAEsAKwAMAO7/1v+//6//pv+h/6P/qP+N/3T/bP9t/3n/jf+l/8H/3//7/xUAKwA8AEgATwBQAEwARAA6AC4A\
IAARAAUA+v/v/+j/4//h/+D/7f/+/wsAFAArAEoAXgBpAGoAYgBWAEMALwAJANX/rf+P/3v/cv9y/3v/i/+g/7n/0//s/wMAGAApADUAPAA+ADwANwAuACQA\
GAANAAAA+/8NABwAJgArACoAJwAhABcADAABAPf/7f/k/93/2P/W/9T/1f/Z/9z/4f/S/73/sf+t/63/tP++/8z/3P/r//r/CQAVAB4AOwBYAGcAcABuAGUA\
VgBDACwAFAD8/+f/1f/H/77/uP+2/7n/v//I/9H/3P/n//P//P8EAAsADgAQABAADwAMAAgAAwD//+b/x/+z/6X/oP+h/6r/t//H/9n/6//9/w4AHAAnAC8A\
MwA0ADIALAAmAB0AFQAMAAMA/P/2//D/7f/s/+3/7f/0/xIALAA+AEoATgBLAEQAOQAqABkACQD3/+n/3f/U/83/yv/K/8z/0f/Y/9//5//u//b//f8DAAcA\
CgAKAAoACAAGAAMAAAD9//n/9v/0//H/7//v/+7/7v/w//D/8v/0//X/+P/4//n/+v/7//v/+//7//v/+f/6/+n/zP+6/67/qf+r/7L/v//N/93/7//+/w4A\
GgAkACwALQA5AFMAYgBoAGYAXABNADsAJwASAPz/6f/Z/83/xP+//7//wf/H/8//2P/i/+z/9v///wYACwAPABAAEQAPAAwACQAEAP///P/m/8b/s/+n/6H/\
pP+r/7n/yv/c/+7///8QAB4AKAAwADQANAAwACsAJQAcABQACwACAPr/9P/w/+z/6//r/+z/7//y//X/+f/9/wAABAAGAAgACAAJAAgABwAFAAQAGAAxAD4A\
RgBIAEMAOQAsAB0ADQD9/+7/4f/W/8//yv/I/8r/zf/T/9r/4f/p//H/+P///wMABwAJAAoACAAIAAQAAQD+//v/+P/1//P/8f/w/+//7//x//L/8v/0//b/\
9//5/+3/0f/A/7T/sf+y/7n/w//S/+D/8f8BAA4AGgAjACoALAAsACoAJgAgABgAEAAJAAIA+//2//L/8P/v/+//7//y//T/+P/7//7/AQADAAYABwAHAAcA\
BwAGAAUAAwABAAAA/v/8//v/+v/5//n/+f/5//n/+v/6//v/+//8//3//f/9//3//f/9//z//P/8//z/+//7//v/+//7//v/+v/6//r/+//7//v/+//8//v/\
+//8//z/+//9//z/+//8//v/+v/7//v//P/7//v/+//7//z/+//8//z/+//8//z//P8QACsAPABFAEkARgA9ADEAIgARAAEA8f/j/9f/z//J/8b/xv/J/87/\
1f/d/+X/7f/1//v/AQAFAAcABwAIAAYABAABAP3/+v/h/8P/sf+l/6H/pP+t/7r/yv/b/+3///8OABwAJgAsADAALwAsACgAIQAZABEABwD///j/8v/t/+v/\
6f/p////HAAvAD0ARABFAEAAOAArABwADAD9/+7/4f/X/9D/zP/J/8v/zv/V/9H/vP+w/6v/rf+z/73/zP/c/+z//P8LABcAIAAnACsALQAqACcAOABKAFIA\
VABOAEMANgAlABMAAgDx/+L/1//O/8n/x//I/8v/0f/Z/+H/6f/y//n/AAAEAAkAAADj/8//wf+5/7b/uf/B/8r/5v8QADEATABaAGMAYwBdAFAAQAAtABgA\
BADx/+D/0//J/8T/sP+W/4r/hf+K/5T/pv+7/9P/6v8AABQAJAAxADkAPAA9ADgANwBIAFQAVwBTAEkAOwAqABcABADy/+P/1v/M/8b/xP/E/8j/zf/V/93/\
5v/v//j/6P/U/8n/wv/A/8P/y//U/+H/BwArAEYAWgBkAGYAYQBWAEUAMwAeAAgA9f/N/6b/i/97/3b/ev+G/5r/sP/L/+X//v8UACcANgBAAEUARgBBADsA\
MAAmADIAPwBBAEAAOQAvACIAEwAEAPb/6f/e/9b/0P/N/87/0P/U/9r/4f/n/+7/9f/7/wEA+P/e/8v/wP+5/7n/vP/F/8//7P8WADYATwBeAGUAZABcAE8A\
PQAqABUAAQDu/9//0v/I/8P/wf/E/8n/0P/Z/+L/7P/1//3/BQAKAA4AEAAQAA8ADAAKAP3/3f/D/7L/qf+m/6r/tP/A/9D/4v/0/wUAFAAgACkALwAyADEA\
LwApACIAGQAaAC4AOgBAAD8AOwAzACYAGwACANj/t/+f/4//iv+M/5b/pf/F//b/IABBAFoAaQBvAG0AYwBUAEAAKgATAP7/1f+p/4z/eP9v/3H/fP+O/6X/\
v//b//X/DQAiADMAPwBEAFQAbQB4AHoAcgBkAFEAOQAfAAYA7//Z/8r/sf+O/3j/bP9s/3b/hv+e/7j/1P/x/wgAHgAwADwARABHAEUAPwA1ACsAHQAVACIA\
LQAyADMALgAnABwAEQAEAPj/7f/k/93/1//V/9T/1v/Z/93/4v/p/+7/9P/5//3/AAADAAQABAAEAAIAAAD+//r/+P/h/8T/sv+n/6P/p/+w/73/zf/e//D/\
AQAQAB4AJwAuAC8ANwBPAF4AZgBkAFsATgA7ACgACwDb/7P/lf+A/3j/eP+C/5D/r//k/xEANwBUAGgAcQByAGoAXABJADMAHQD+/8v/pP+I/3b/b/9y/33/\
j/+y/+n/FwA/AFwAcAB5AHkAcQBjAE8AOAAfAAYA7//c/8z/wf+6/7f/uf++/8f/0f/c/+j/9f/1/+H/1P/M/8j/yv/P/9b/4P/r//f/AQAMABUAMABOAGAA\
awBsAGUAWQBIADMAHQAHAPL/4f/Q/6z/jf98/3T/d/+D/5X/rP/G/+D/+/8SACYANgBAAEYARgBNAGIAbABtAGUAWQBGADEAGQADAO7/2//M/8L/u/+5/7z/\
wf/I/9H/3P/m//H/+f/r/9f/zP/G/8P/xf/M/9X/3//q//b/AQAMABMAGQAeAB8AJgA/AFAAWgBbAFUASgA6ACgAFQACAO//4P/U/8r/xf/D/8T/yP/O/9b/\
3//S/8L/uv+3/7r/wv/N/9r/6P/3/wQAEAAaACEAJQAoACYANgBMAFgAXQBZAE8AQQAwAB0ACQD3/+f/2P/O/8f/w//D/8b/zP/U/9z/5v/u//b///8FAAkA\
DAAMAA4AAgDj/8v/u/+x/63/sP+4/8T/0v/i//L/AQAPABoAIgAoACsAKwAoACQAHAAWAA4ABgD///n/9P/w/+7/7P/s/+7/8P/z//X/CgApAD0ASwBQAFAA\
SQA9AC8AHQAMAPf/2v/C/7H/pv+j/6T/q/+2/8T/1f/l//X/BAAYAC8APgBGAEkARgA9ADIAJQAMAO//2v/H/7z/tP+0/7f/vv/T/+z/AAATACEAKwAwADEA\
LgAeAAkA+P/p/93/1f/Q/87/0P/U/9v/4//r//j/DgAfACsAMgA1ADQALwAnABwAEQAFAPr/8P/n/+D/3P/Z/9j/zf/E/8H/w//I/9D/2f/k//D/+/8EAA0A\
FQAlADMAOQA8ADkAMgApAB0AEAAEAPf/7P/k/9z/2P/W/9b/2P/c/+H/5v/v/+3/5f/h/+D/3//j/+b/6//w//f//P8BAAUACAALAAsADQAMAA0AGAAgACQA\
JAAiAB0AFgAOAAYA/v/2/+//6v/l/+P/4v/i/+T/5//q/+//6//i/93/2v/b/97/4v/o/+7/9f/9/wIACAAMAA4AEAAQABAADgAMAAkADQAWABwAHgAeABsA\
FwARAAkAAgD7//T/7//r/+f/5f/l/+b/5//q/+3/8P/z//f/+v/7//L/5//g/93/3P/d/+D/5f/r//H/+P/+/wMACAAMAA0ADwAQAA4ADAAJAAYAAwAAAP3/\
+//5//f/9//2//f/9//4//n/+v/8//3//v///wAAAAAAAAEAAQAMABgAHgAiACEAHgAaABMADAAEAPv/9P/t/+j/5P/j/+L/4//k/+j/6//v//P/7v/l/+D/\
3f/c/+D/4//o/+7/9f/7/wEABwALAA0AEAAQAA8AEAAbACMAJwAnACMAHgAXAA4ABQD9//T/7P/m/9f/x//A/73/vf/D/8z/1f/k//z/EgAjAC8ANgA5ADYA\
MQAlAA0A9//j/9T/yf/D/8L/w//N/+L/9f8HABUAHgAlACgAKAAkAB4AFgAOAAQA+//z/+z/5//j/9f/yv/D/8H/w//I/9H/2//n//7/FAAmADMAOgA8ADoA\
NAArACAAFAAHAPv/8P/n/+D/2//Z/9n/2//e/+T/4P/Z/9f/1v/a/9//5v/t//X//f8DAAoADwATACEALAAxADQAMgArACMAGQAOAAMA+f/v/+f/4f/e/9v/\
3P/d/+H/5v/q//D/7//n/+L/4P/f/+H/5f/q/+//9f/8/wEABQAJAAwADQANAA0ACwAJAAcABgARABkAHAAeABwAGAATAAwABQD+//f/8f/s/+n/5v/l/+b/\
5v/p/+v/7//x/+f/3//c/9v/3P/g/+X/6//y//n/AQAFAA4AHwArADIANQA0AC8AJwAeABMABwD8//L/6P/V/8X/vP+5/7r/v//I/9P/4//9/xQAJgAzADsA\
PgA8ADYALgAhABUACQD8//D/5v/h/9v/2f/Y/9r/3v/i/+j/7v/0//r//v8CAAUABwAHAAcABgAFAAEA8v/l/9r/1P/S/9H/1f/Z/+H/6f/y//r/AgANACAA\
LAA1ADgANgAyACkAIAAPAPX/4P/Q/8T/vf+8/7//xP/N/9j/5P/x//z/BgAPABcAGwAfACwANAA2ADYAMAAoAB4AEgAHAPr/8P/n/+D/0v/C/7v/t/+6/8D/\
yv/V/+P/+/8TACcANAA8AD8APgA4AC4AFgD9/+n/2f/N/8T/wf/D/8f/z//Z/+P/7//6/wQADQATABgAGgAbABoAFgATAA4ACQADAP7/+f/1//L/8f/v/+//\
8P/y//P/9v8EABIAGwAiACMAIwAfABoAEwAJAAEA+P/w/+n/5f/h/9//3//g/+L/5v/p/+3/8v/3//j/7f/l/+H/3v/d/+D/5P/p/+//9P/6/wEABQAJAA0A\
DgARAB4AJwArACwAKQAkAB0AEwAJAP//9//u/+j/5P/g/9//4P/i/+X/6f/u//L/9v/7//7/+P/t/+f/4f/f/9//4v/m/+r/8f/3//z/AgAHAAsADQAPAA8A\
DgANAAsACAAFAAkAEwAZAB0AHgAcABcAEgAMAAQA/f/3//H/5//V/8v/xP/B/8P/yP/P/9r/5f/x//z/BQANABMAGAAaABoAFwAVABAACwAGAAAA/P/3//T/\
8f/v/+//7//0/wMADwAXABwAHgAdABsAFQAOAAcA///4//H/6//n/+T/4//i/+T/5v/p/+z/8P/0//j/9P/p/+L/3//d/97/4v/m/+z/8v/5////BAAIAAwA\
DgAPABEAGgAkACkAKgAnACQAHAASAAkAAAD3/+//6P/j/+D/4P/h/+H/5P/o/+v/8f/1//H/5//i/9//3v/f/+P/6P/t//T/+f8AAAQAEQAhACsAMAAxAC8A\
KQAgABcABQDs/9r/y//C/73/vv/C/8n/2//z/wcAGAAlAC0AMQAwAC0AJQAeABMACQD+//T/6//l/+D/0v/F/7//vf++/8X/zv/Z/+X/8v/9/wgAEAAbACwA\
OAA/AEAAPQA1ACoAHwARAAMA+P/s/+P/1//F/7v/tf+2/7v/w//P/9z/6P/2/wQADgAXAB0AIAAiACEAHgAZABQADQAOABUAFwAYABYAEwAOAAcAAgD0/+D/\
1P/K/8b/xf/I/87/1v/g/+v/9f///wcADgAUABcAGQAYABYAEgANAA0AFAAZABsAGgAXABIADAAEAP7/9v/w/+v/5//k/+P/5P/k/+f/4P/W/9L/0f/S/9b/\
3f/l/+3/9v/+/wYACgAWACYALwA1ADYAMgArACIAGAALAAAA9f/r/+P/3v/c/9r/2//c/9P/zP/L/83/0v/Z/+L/7P/1////BwAOABIAHQArADMANwA3ADIA\
KgAgABQACAD9//L/6f/i/9z/2v/a/9v/3v/h/+f/7P/y/+3/5f/i/+D/4f/k/+j/7v/0/wYAFwAjACsALwAvACsAJQAdAAkA8v/h/9P/yf/E/8P/xv/M/9X/\
4P/q//X/AAAIABAAFQAiADAANwA5ADgAMQApAB4AEQAFAPn/7f/l/9//2v/X/9j/2f/R/8r/yf/K/8//1//g/+r/9v8MACAALgA3ADsAPAA3AC8AJQAZAAwA\
AAD1/+z/5P/f/9v/2v/c/97/4//n/+3/8//5//r/8f/s/+f/5f/l/+f/6//v//X/+f/+/wMABwALAA0ADgAOAA8AGQAiACcAKAAmACEAGwASAAkAAAD4//D/\
6v/n/+P/4f/h/+P/5v/q/+3/8f/0//n//v/4/+3/5f/g/97/3v/g/+T/6f/v//X/+/8AAAUACQAMAA4ADgANAAwACgAIAAQABwASABgAGwAcABoAFgAPAAkA\
AgD7//X/7//r/+f/5f/k/+T/5v/o/+z/7//z//b/+v/8//7/AAAAAAEAAQD//////v/8//v/+f/5//j/\
').split('').map(c => c.charCodeAt(0))).buffer);

const VX02 = new Int16Array(new Uint8Array(window.atob('\
+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\
pfwz/MH7D/z5/LT9ef5t/uT9jP06/f/80fyx/Jz8mvyX/F/9pv6v/8QA/wCwAIwAYwBFAC0AHAALAAEA/P/5//r//f8EAA8AHwArAEUAPwADAU4CTANABEkE\
2QOGAy8D3AJRAyYEwQRPBbIF+wUlBuMFlwWZBG0DdgJ9AZgAuf/s/iz+h/3j/Wj+1P4O/13+kv3s/Fb82Ptp+w77xPqL+mz6lvrO+v36LPtX+4H7rPvQ+wf8\
W/yu/An9aP3M/TT+nf4H/3H/2/9CAKcAAgFgAboBDwJYAqUC1QJ0A8wE6wX3BmwHBAeWBiwGrgWrBUsGWwYPBtUFnAVqBTcFAwXTBKIEdgQqBN4CfQFSACr/\
H/4q/Tv8bPul+qv6Rvu++zj8pPwU/W796f3E/ef8RPyw+zf70vqB+kv6e/qt+v36Gfwp/SP+Cv/q/7gAfQFxAeYAhAAmANn/jP9L/xL/4v66/p3+g/53/mf+\
lv6p/8gAvwGkAm0DIgTBBEYFuQUMBkUGYwYeBuEFqAVxBT4FDAXbBKwEVwQDBJ0DJwM5ApMAF/+6/Xf8SvtA+k75iPic+PP4MPmn+T36x/pX++P7cPz8/IT9\
Cf6J/v/+eP/n/08ArwAGAVYBmwHZAQsCNgJYAm0CfgJ+AocCOAILAev/6/73/SH9YPyz+yP7nvqL+tH6A/s1+2L7jvu7++D7Evwj/Mb8H/4+/08AUQFAAhcD\
4wPVA0kD4QJ2AhgCvgFoARgBzgCKAE4AFQDg/7X/j/9y/1f/Sv8z/+n/FgEIAuwCsgNjBP4EfwXuBTgGcwZ9Bi4G8wW1BX8FNgX7A5sCfAFKALb/4//2/wMA\
BgACAPr/7v/a/8j/rf+d/03/Jf71/PL7Bvs/+oX5b/nD+fz5N/pr+p76z/r9+hz76fv4/M79yf18/Vr9QP05/Tz9Sv1i/YP9rf3f/Rj+Vv6Y/uD+Lf94/8//\
DgDzAHQCtQPfBOIFzAaOB/8H8geRB0sHBAfEBo0G9QXpBP4DHwNGAnUBqwDs/zn/l/77/W397/yB/CH80PuP+137O/sn+yH7Kfs9+2P7j/vE+wb8Ufyi/P38\
WP3Q/Sb/owD/ARYDLgMZAxMDBwP9Au4C3gLJArICmAJ/Al4CRQIUAnMCeQNLBAUFnwUPBlgGIgbcBaUFbAU5BQcF1wSpBH0EUAQmBNYDgwMmA6QCNQK7AT8B\
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\
sgDoALYAUAABALr/ev8+/wz/4P68/qD+i/57/nb+bf6t/kX/yf9PAMYAMgGXAfIBQwKKAsUC+AIfAz4DTQNeAywDlAIHAoAB/wCHABQAqP9G/+7+mP5O/gv+\
1v2h/cj9Pv6h/v3+WP+v//7/SQCOAM0ABQE3AWIBiAGjAb8BtAE6AbwATwDf/6X/1/8GAC0ATwBrAIQAmACoALUAvgDDAMMAwwC7ALgAkQD8/23/8f56/hD+\
s/1i/R395Py3/Jb8gPx4/HH8y/xx/QD+lv7P/sH+yP7Q/uL++v4S/y//Uv9y//X/rQBGAdUB6gHSAcgBuQGxAQ8CjALvAkcDjQPHA/MDEgQlBCoEJQQUBPYD\
0gOgA3AD+AIhAl0BoQDw/0j/rf4h/pn9If24/Fr8DvzJ+637Dfx1/OD8Jf3+/N/80PzK/NH84fz4/Bv9Ov2g/WT+GP+8/1sA8gB3Af0BRwIiAvwB3QG1AccB\
NgKSAuACHwNRA3UDlgOIAwYDfgIBAoABJQE6AU0BWgFAAbQAKACq/zP/y/5o/gv+vf13/T39Df3m/Mv8vPwf/av9KP6Y/pf+ev5x/mn+df7v/oD/CAB7AHkA\
VgBEAC8AMQCgAB4BhwHmATkCfgK9At0ChQIaAroBXAEEAa8AXAAPAMb/g/9G/xH/3v6w/ov+av5Q/jz+L/4o/if+K/42/kD+q/5N/93/agCLAGsAXgBPAEUA\
PAA0AC8AKQAlACIAIAAfAB8AIAAhACMAJgAoAC4AMQA2ADoASQDGAFEByQEiAv4BxgGYAWQBSQGZAfIBNgJvApoCuwLRAtsC3ALUAsECpwIjAmwBzAAvAKH/\
hv+R/4z/if9//3b/a/9e/1L/RP82/yn/HP8P/wL/9/7s/uP+2f7S/sv+xv7C/r/+vv6+/sD+w/7H/sz+0v7a/uD+7P7x/gX/6f5j/vL9k/05/SH9d/3F/Rz+\
PP75/cT9nv2D/XP9bP1t/Xr9iv0A/rH+Tf/f/2sA8ABpAdoBPwKZAuoCLwNnA5UDtAPRA4sD+wJ+AgACigEZAasARADi/4j/Of/t/qb+av41/gv+5v3M/bb9\
vP03/sH+Nf+s/xoAfwDeADIBfwHEAf4BMQL3AYkBLwHWAIQAOADw/7H/cP9S/6r/AQBMAJEAzAACATABVwF5AZMBpgGyAboBuAG3AZcBBgFtAOX/ZP/0/ov+\
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\
hv8N/5/+PP7Y/cn96v3+/Rr+7v2f/WX9M/0O/T39k/3d/Sf+IP4C/vb97/31/U3+w/4m/4n/mf+I/4n/if+P//D/XwDAAA4BAAHkANEAvgCtAJ4AjgCBAHIA\
cQDBABgBYwGYAXQBQAEVAeYA0AAIAUMBcQGXAbUBzAHeAeYB6gHkAd4BwAFOAdQAZgD8/5r/QP/t/qX+WP46/mv+k/7I/tf+k/5e/jD+DP7x/dz9z/3J/cf9\
EP6G/u7+Tv+u/wkAXQCrAPIAMwFqAaABjAFHAQ4B2AChAK8A6wASATwBGgHIAIMAQwACAP7/NABdAIEAngC4AMwA4AC2AFQAAQC1/2n/X/+Q/7L/1P/x/wsA\
IgA2AEgAVgBiAGsAcgB1AHYAdgBzAG4AZwBeAFMASAA6ACwAGgC6/0T/5P6G/jT+7P2u/Xr9UP0w/Rj9Cv0J/Qf9Sv3J/Tz+q/4W/3v/2v8/AF4ARwA8ADQA\
KQBcAMcAGgFvAZABZQE/AR4B9wAEAU8BigG+AegBCwIjAjwCGQK0AVoBBAGsAIwAqwC7ANAAqQBDAOv/mP9N/wz/0P6W/mf+QP5v/rn+9v44/3H/qP/d/wkA\
5P+n/3n/UP8t/wz/8/7e/s7+w/68/rv+vv7E/s7+3f7u/gH/GP8x/03/af+J/6H/BwCUAAYBdAGNAXwBcgFoAVkBiAHkASsCagKbAsQC4QL1AgADAQP6AuoC\
0wK1ApACZAIzAv8BxQGJAUkBCAHEAIcAGABt/9L+SP7E/U795/yK/D78+PsD/Ef8g/zC/AL9R/2J/dX96v3G/bT9qv2q/bL9v/3U/e/9E/6J/hn/lP8IACMA\
KAA5AEgAWgBtAH8AkwChAMcAOwGnAQgCVAJFAh8C/wHaAccBAQI/Am0CkgKsArwCxwK4AlMC4QF5ARABvgC/AMcAxAC/ALUApwCXAIQAcABaAEIAKAAOAPP/\
1v+//2T/4/54/g/+tf2t/dP97v0N/iv+TP5r/o7+Z/4h/vD9xP2m/Y/9gf19/X39kP35/XH+4v5F/1L/UP9Y/2P/c/+G/5n/sf/E/+n/awDjAFMBmgGNAX0B\
bwFhAVMBRQE0AScBEQEsAYQByQEMAhMC0gGaAWMBKQEoAV4BhAGjAbkBxwHRAdIBzgHEAbUBoQGHAWsBSAEpAdQARADA/0f/0P6V/qT+p/6u/rD+t/67/sn+\
tf5S/gD+uf1+/U79J/0L/fn87fwv/aD9Bf5q/oD+dv58/oX+lP6p/sH+3f78/h3/Qf9n/43/s//c/wAAJgBOAHMAlwC7ANsA/AATAVcB2AFEAqcC+QJAA3kD\
pgPIA90D5wPmA9oDxAOkA3wDSwMTA9UCkQJGAqgB8gBNAK7/G/+S/hb+of0y/fH8Bv0e/Tf9Uf1v/Y79r/3T/fr9Hv5L/ln+H/7r/cb9o/2q/QP+XP6x/gL/\
S/+a/+L/JQBlAJ8A1AAFAekApgBxAD0AEQDo/8P/of+E/2//V/9F/zf/Lf8o/yf/J/8u/zL/fv/5/10AvQARAV8BowHhAc0BkAFfAS0B/wDRAKUAfABUAC4A\
CwDq/8z/sf+Z/4T/cf9m/1P/cP/W/ykAfwCdAHQAUgA3ABYALwCDAMcABQE5AWcBiwGvAagBUQH/ALIAagAmAOb/p/90/zz/Qf+D/7f/5/8RADgAWAB6AG8A\
HADS/5L/Uf9H/4H/rP/c/83/hv9M/x7/6f7w/kH/ef+4/7j/f/9T/zL/CP8l/33/v/8EAPz/yv+m/4P/af9U/z7/Lf8h/xn/FP8S/xT/Gf8h/yz/Of9M/1f/\
h/8LAHkA5gAhAQwB/ADtAN8A0gDFALYArACYALwAGwFjAakBqAFsATwBCQHaAK0AgQBXAC4ACQAxAHcArQDdAAUBKAFDAVgBZQFvAXABcwE5AcIAWgD2/5r/\
Rv/2/rP+b/46/ln+kv7F/vP+H/9J/3L/kf9e/x3/6f60/o7+bP5R/j3+Lv4l/iP+Jf4w/jf+bv7v/ln/z/8RAAcABAAFAAMAIQCNAO4ASgF5AVcBNgEaAfkA\
AAFMAY0BxAHyARUCMAJIAj4C4QF+ASUByACSAKgAugDEAMkAygDGAMAAtgCpAJoAhwBxAFwAQgAuAP3/gf8J/6P+PP76/RH+Lf5H/mH+e/6U/q7+zP7o/gT/\
IP88/1j/c/+N/6T/u//S/+T/+//Q/3f/Mv/w/rH+sf7w/iL/Yf9d/x3/9P7N/rH+mv6J/n/+e/57/oH+jP6c/q/+xv7h/v/+IP9A/3v/AwCMAAMBcwHXATEC\
ggLGAgEDMANWA2oDJAPFAm8CGALEAXEBHwHPAIIAOQD0/7P/dv8+/w7/5P65/pb+gf67/hD/Wf+c/9z/FgBNAHYASwAOAN7/r/+O/8L/CABAAHQAoQDJAOwA\
CQEhATUBQAFOASUBuwBdAAcAsf+b/8H/1//z/8f/bP8m/+X+qP50/kn+JP4G/vP9Mv6S/uH+Lf96/8L/BQBFADoABgDh/73/of+H/3T/Zf9S/1D/rf8JAF4A\
lQB2AFQAOwAdAB0AbgC6AAEBJwH5AMYAmQBvAEkAJQACAOb/xf/i/zcAdwC7ANUAnwBrADoAEQDq/8f/pf+L/2v/gv/b/yQAaACiANkABgE0ATYB6wCkAGcA\
JQAVAEsAcwCeAIsAOwD2/7j/ef9z/6//2/8LAAIAuf99/0b/Gv/w/sr+rP6S/n7+cP5n/mL+Y/5q/nP+gf6T/qn+wf7c/vn+GP85/13/f/+m/8P/9P96APwA\
cwHJAcUBtwGsAZ8BkAGBAW8BXQFFAUMBjwHUARECLALuAaoBawEqAe4AsgB2AEEABgAIAEMAbgCVALQAzQDhAO8A9wD+APsA+wDBAEwA4/+D/yb/Bv8l/zn/\
Tv9e/23/ev+G/5D/m/+g/6v/l/84/+H+lf5I/iz+Yf6M/r7+yv6G/lb+L/4J/hn+cv6//g//N/8P//f+5P7Y/tH+z/7Q/tf+4f7v/gD/FP8s/0T/rf81AKUA\
EQFvAcYBEwJXApECwQLnAgMDFgMfAyADGAMHA+8CzwKrAjgCngEVAY0AEACX/yb/wf5l/gr+vv17/UL9D/3+/ET9kf3Z/SH+Zv6r/uz+Jv8L/+H+yv6y/rj+\
DP9o/8D/DwBZAJwA2wATAUUBcQGWAbEBeAEkAdwAlgBXABoA4v+t/3//Vf8y/w7/8P7Z/sb+uv6x/q/+q/7h/k//t/8WAGsAvQAEAUoBXgEpAfkAzACjAH4A\
WQA2ABcA+f8nAHYAtQDtAM8AkwBkADUADgA1AHoArADZALIAawAzAPz/y/+g/3X/VP8w/yj/ef/B/wgAJADy/8f/of+B/2X/TP87/yj/Gv8R/wv/CP8N/wj/\
Pv+3/xcAegCcAH8AawBbAEgAdQDSAB4BYgGbAc4B9wEYAjECQwJJAlACEgKcATMBzABsABEAuv9o/x//2P7k/hX/N/9Z/y7/5v6r/nP+Sf4j/gX+7v3d/dT9\
0P3T/dz96v39/Rb+Mv5S/nX+nf7G/vH+Hv9M/3n/qP/U//7/LwBZAIMArgDNAB0BqQEbAokCrQKRAnoCYQJBAlgCoQLTAvwCFgMpAywDLwP5AnoCAgKNARsB\
rgBEAN//gf8n/x//Of9I/1P/DP+x/mf+Hv7k/a/9hf1h/Uf9NP0q/Sf9Lv01/Wf95/1f/tf+J/8n/y7/Ov9I/1v/bv+D/5r/rv/K/+L//P8TADUApgAhAYoB\
6QE7AoICvwLvAssCgQJAAvwBuQHCAegB+AEFAr0BUAHzAJUAQgBBAFYAYQBgAAsApv9O//z+t/5z/jX+Av7W/bH9lf1+/XP9aP2O/QD+ZP7N/gX/9v7v/vL+\
8f4i/5v/AQBmAIkAbwBgAFMARABvANIAHwFtAXUBPwEVAeoAwgCdAHgAVAAzABoAUgCdANcADAE4AV0BfAGUAaQBrwGyAbMBaQH0AI4AKgDO/3n/Kf/i/qP+\
Zv6E/sD+7P4a/0P/av+O/7D/iv8//wj/0v6n/s3+F/9R/4z/v//w/x0AQwAXANL/nf9q/0L/G//4/t3+xv61/qr+ov6i/p7+xf4y/5v/BAA/AC0AHQAUAAcA\
KQCOAOUANQF6AbgB6gEbAhUCxwGCAT4B/AC+AIMASAAVANz/1/8WAEUAeAB0AC0A7v+4/3//gf/D//P/JwAZANT/nf9r/z//G//5/tr+w/6w/un+Sv+b/+f/\
KwBsAKQA3QDNAIsAWAAnAPz/0v+t/4z/b/9U/0H/Lv8h/xH/KP+Q/+v/PwCMANAADgFFAXUBnwG+Ad4B0AF3ASEB0wCCAFoAfwCZALEAsQBeAAIAtv9o/z3/\
ZP+M/6//zv/p/wIAGAAqADoARgBUAEcA6/+Q/z//+f61/nr+R/4c/vn93P3J/bv9t/20/fP9bP7T/j7/Z/9Y/1f/V/9f/2j/dP+D/5T/pv8TAIwA9wBLAUUB\
LgEgAQ8BDAFaAa0B8QEeAvEBtAF/AUkBFQHjALMAggBVACkAAADZ/7b/lf95/2D/Sf83/yX/Zv/G/xMAXgCeANkADAE3AQ8ByACNAFQAIADv/8H/mP9w/1r/\
mv/f/x4ARwAZAOL/tf+M/2j/SP8s/xf/AP/v/uT+3P7W/tb+2P7e/uf+8v4B/xP/Jf8+/03/g/8MAH4A7gAkARABBAH3AOsA4ADTAMYAuQCrAJ4AkACDAHUA\
agCtAAYBTgGOAcEB7gERAi0CPQJIAkgCSQIYAp4BKQG9AE8AGAAjACIAJQDq/3j/FP+9/mb+Sf54/pL+uv6n/lT+GP7k/bX9zf0d/mD+p/6k/nn+X/5L/jv+\
eP7f/jT/j//g/ywAcgCzAO4AIwFOAXwBdAEnAeEAogBgAFgAjQCxANgAugBmACAA3f+i/2v/O/8R/+r+w/7a/jH/eP+7//f/MABkAJQAvADiAAABHwEWAb8A\
bwAlAOL/o/9r/zf/Dv/c/vf+Rv+D/7//rf92/1L/Lv8Q//n+5f7Y/s3+0P4i/4v/5/80ACoADQD8/+r/6v88AJQA5AAXAfIAyACkAIEAYQBEACgADgD3/+L/\
0P+//7T/ov/Q/zQAhgDSABQBUAGEAbAB1AHxAQcCFQIdAh4CFwILAvkB4gHGAaUBgQFZAS8B/wDTAGQAyf9B/8b+U/4s/jv+O/5C/kj+Tf5W/mH+Jv7M/Yf9\
Tf0d/fj83/zO/Mf8yfzW/Or8B/0n/Wj9/f2N/h3/iv+j/7v/1//3/xUANQBXAHkAlQDrAHMB4gFMAmcCTQI6AiUCDAIzAoECugLqAgwDJgMxAzsDFgOiAjAC\
xAFUARUBGwEUAQsB+gDmAM0AuQByAOv/cf8D/5n+Yf55/on+mf6n/rb+xv7X/ub+9/4F/xn/HP/L/nj+N/7+/dD9q/2M/Xr9af2Y/Qf+aP7K/iT/eP/R/yEA\
aQCwAO4ALAEvAfEAwQCSAGcAQAAbAPv/3f/C/6z/mP+H/4D/a/+o/xIAZACzAPoAOQFxAaIBywHuAQYCHgL/AZwBQgHrAJoATAACAL7/fv9E/xL/4/63/pP+\
df5d/kv+Pv44/jf+O/5E/lH+Y/55/pP+sv7P/v3+eP8EAH4A8ABXAbUBCQJSApICxgLyAggDxgJwAiIC0AGPAZ0BtwHCAccBwgG6AawBlAEsAakANgDH/2H/\
Bf+p/pz+v/7U/u3+0P6j/n3+Xf5D/mD+lP6+/vP+8P7S/sT+t/6z/uD+Jv9j/5j/lf+E/33/dv92/6//8v8sAF0AVAA9ACwAHAAPAAMA9//v/+P/8/8xAGYA\
mwCrAIsAcQBYAEAAKwAWAAMA8v/g//n/MQBdAIoAhQBeAD8AIQAHAO3/1v/C/63/o//Q/wUAMQBaAHwAmwC3AM0A4ADvAPgAAQHeAJgAWgAgAOj/tf+G/1r/\
NP8P/yL/Tv9u/4//ef9Q/zL/GP8G//H+4/7Z/tL+0P7S/tX+3f7o/vX+BP8W/yr/P/9W/27/hP+c/7n/0//t/wgAHgBQAK4A/gBMAW0BXwFXAUsBPwEyASMB\
EwEDAe4ABgE5AVsBewFmATEBAwHVAKUAnQC5AMgA1wC2AHQAOwAFAM//yP/i//H/AAAKABQAGgAfACEAIwAgACEABgC8/3n/QP8G//L+Dv8j/zn/Tf9f/3H/\
g/+U/6X/sv/E/7X/e/9M/yL/AP/e/sT+rv6e/pD+sv71/iz/af+e/9L/BAAxAFsAggCkAMcAygCcAHQATgAsAAwA8P/V/77/pf+0/+v/FgBDAEAAGwD//+f/\
zv/h/xYAQABnAIkAqADDANkA7AD7AAYBDQEPARABDAEIAfEAowBWAA8Azv+Q/1n/Jv/8/s/+zP74/hj/Of9X/3X/k/+u/8f/4f/5/wwAIAAyAD8AUQA7AP//\
zf+g/3T/b/+W/7T/0v/r/wMAGAAwACoA9P/G/5z/ev9Z/0D/Kf8S/wT/9/7w/uz+7P7v/vb+//4N/xv/Nf+H/9//LAB0ALYA8QArAU4BNwEdAQYB7gDXAMEA\
qwCUAH8AagBWAEMAMQAgABAAAgD1/+n/3/8JAEYAdwCkAMsA7QAKASQBDQHWAKgAewBPAFYAdACIAJcAcAA2AAUA1f+r/7n/1//u/wMA4v+t/4P/Xv87/0j/\
df+W/7j/pv9+/2D/Rf8v/x//Dv8C//v++P4y/3n/tP/t/yEAUgB+AKUAlQBwAFQAOAAgAAoA9P/k/9D/0v8IADkAaAB6AFkAOgAhAAUABQA1AF4AhQCQAGcA\
QgAgAAEA5P/J/7H/m/+I/3j/a/9f/1X/T/9M/0v/Sv9N/1L/Wf9h/23/dP+n//3/QwCLAKgAmACPAIQAegByAGoAYgBZAE4AcgCwAN8ADgEFAd8AwACfAIEA\
ZABGACsAEQD4/+H/y/+4/6b/lf+H/3v/cf9p/2T/X/9d/1z/Yv+g/+f/JQBVAEoANwApABsAEAAFAPv/8v/q/+P/3v/Y/9X/zv/r/zEAaACgAK8AkQB5AGMA\
SgBZAI0AsgDXAMoAmwB0AE8AKAAjAEkAZgB/AJQAowCwALkAvgDBAL0AuwCnAF4AEgDP/43/ZP9x/3//iP+S/5n/n/+m/6v/sP+1/7f/u/++/8D/wf/C/8P/\
w//D/8P/wf/B/8D/vv+8/7r/uf+w/3T/Mf/+/sj+ov65/tj+9v4W//f+0f65/qL+nv7T/g3/Qf94/6r/3P8KADEAIwAFAPH/3P/Q//n/MQBgAIwAsgDVAPMA\
DQH1AMEAlwBuAEkAWQB7AJQApwCAAEwAIAD2/9D/rv+P/3X/XP9Q/4D/sf/f//z/4f/E/63/l/+W/8v//f8tAEMAJAAKAPL/3P/L/7z/r/+k/5v/lf+Q/47/\
jP+O/5H/lf+c/6P/r//y/z8AggC8ALoAqQCcAJAAhgCtAOYAFAE8AV0BeQGOAZ4BqAGtAawBpwGcAY4BfAFmAU0BMAERAfAAzACpAIIAXwARAKX/Rv/w/p7+\
fP6E/oL+i/5p/ib+9v3M/av9vv3z/SD+Uf5Q/jz+Nv4z/jf+cv7E/g7/V/9s/2n/cf95/4X/k/+i/67/w//V/+j//P8PACQAOQBMAF4AcwCAALUACgFRAZIB\
ygH5ASACQQJZAmoCdAJ3AnECZwJVAkICBwKgAUEB5QCIAFIASAAzACQA7/+U/0P/+v60/pr+q/62/sP+z/7d/uv++v4J/xn/Kv86/0v/Xf9t/37/j/+f/6//\
vf/L/9n/5f/x//z/BQAOABUAGwAhACQAKgAZANb/mf9j/zX/DP/j/sT+qv6V/oX+e/52/nf+e/6D/pD+of61/sz+5v4E/yP/Rf9n/7//KQCEANUA6wDvAPcA\
/QALAUoBkAHIAfgBIQJBAlsCZQIyAvQBvAF/AU0BUQFZAVoBTQEHAbgAcQAsAOz/sP92/0X/Ev8B/yL/Ov9X/0//Hv/9/tr+vf6n/pb+if6B/n7+f/6F/o7+\
nP6q/ur+QP+R/+L//f/6/wAABQANABYAHgAoAC4AQgCKANIAEQFJAXgBowHGAeIB9wEGAg0CDwIMAgIC8wHeAccBqgGKAWEBAQGXADYA2P+H/3H/Z/9b/07/\
QP81/yr/IP/m/p3+Xf4m/vr91P21/Z/9jf2V/dX9Gf5a/pv+2v4Y/1H/jf/G//v/LwBZAEsAMQAfAA0ABAAzAGoAmQC+AKgAhwBsAFEAOgAlABAAAADs//X/\
LgBdAI0AlwB0AFYAPAAfACQAVgB8AKMApQB5AFQAMQARAPP/2P/A/6r/lv+4/+//GQBCAGYAhgCiALgAmgBnAD0AFADx/wMAJwBCAFoAOgAHAN7/t/+V/3X/\
Wv9D/y7/H/8R/wX///77/vr+/f4C/wr/FP8h/zD/Qf9T/2j/e/+P/6n/vP/k/z4AkgDiABIBDAEFAQAB9QACAT8BcAGdAa0BhAFbATYBCwH+ABwBMwFDAUwB\
UQFOAU4BKgHXAIwAQwD//7//g/9K/xj/6f7E/p7+ff5k/lD+dP6t/tn+Ef8M//L+5v7c/tn+1/7Z/t/+6P7z/gL/Ef8n/zb/XP+8/w4AYACPAIsAigCMAIgA\
oQDnACABVwFqAUoBLAEOAfIA1QC4AJsAfwBjAEkALgAVAP7/5//U/8D/sv+f/6n/5P8TAEYAUAAtABIA9//f/8r/t/+m/5b/if9+/3T/bf9o/2X/Y/9k/2b/\
af9v/3X/fv+G/4//m/+n/7L/wP/N/9r/6P/1/wQAEABLAJ0A3gAgATIBGgEHAfQA3wDxACEBRQFlAVABGwHuAMEAkwCUALAAvwDNAKkAZwAvAPn/xv/H/+D/\
7v/9/wcAEAAWABsAHAAdABsAGQDm/5z/Xv8l//D+8f4O/yL/OP9L/1//cv+E/5T/pf+y/8T/sv96/0n/Iv/7/vj+KP9K/3H/av9E/yz/FP/8/hT/VP+G/7j/\
5f8RADkAXgCAAJ4AuADPAOMA8wD/AAcBDAEOAQwBCAEBAcwAegAxAO3/r/92/0H/Ev/q/sP+pP6I/nX+Yv5x/rL+7f4j/1v/kP/D//T/IABLAHIAlQC1ANIA\
6wD/AA8BHQEkAS0BHQHZAJYAWgAeAPr/DAAbACkAIQDl/63/e/9O/yn/CP/n/tD+uP7E/v3+Lv9p/3n/Yv9U/0n/PP9U/57/2P8WACkAFAAGAPv/7/8MAE0A\
gAC0ALUAlgB+AGcAUgA/AC0AHAANAAEAKwBjAJEAugCpAIQAaABLADcAWACDAKYAxgDfAPQABAERARkBHgEfARwBFwENAQAB8gDfAMwAtgCfAIYAbABRADYA\
6/+L/zj/7/6p/oj+nf6j/rf+o/5n/j3+Gv7+/RH+Sv58/q7+4P4P/z3/bv+b/8j/8P8aABgA9P/c/8T/sf+h/5X/i/+E/37/r//0/y0AZABiAEsAPAAtACYA\
UgCNALwA5wAMASwBSAFaATQB/QDOAKAAeACHAKIAtADAAJIAVgAkAPH/zP/h//3/EgAmADUAQwBPAFgAXgBkAGgAaQBoAGQAYABbACYA2P+X/1r/JP/3/sn+\
o/6D/m7+kv7G/vH+Hf9K/3X/n//F/+r/DgAtAE0APwARAO7/zf+y/5r/hP9x/2H/WP9Q/0j/SP9C/1f/pv/p/ygAYQCWAMUA9AABAd4AvgCiAIIAgQCuANEA\
8wD0AMIAlgBtAEcAIgABAOH/xf+n/7L/5f8MADEAUQBuAIYAngCLAFUAKAD+/9P/0//5/xQAMQAiAO7/xf+e/33/X/9E/y7/Hv8M/wH/+P70/vH+AP9I/47/\
0v/3/+n/4P/c/9T/6P8tAGoAoQDSAP0AJAFEAWEBdgGHAZMBmQGaAZcBjwGCAXMBYAFJAS8BEgH0ANIAsgBmAP3/n/9I//n+tP5y/jX+A/7Y/eb9Df4x/lT+\
Qf4k/hP+B/4C/gX+DP4X/in+Pv5Z/nb+mP64/vT+Xv/B/yQAfADQABsBZAGTAYoBegFvAV0BYAGUAb0B5AHoAbcBiAFZASsB/wDSAKYAfQBQAE0AbwCCAJkA\
hABIABUA5v+4/7n/2v/w/wgA7P+3/4z/ZP9B/1D/e/+d/73/2v/2/w4AJQA4AEoAVwBmAF8AJQDs/7r/if90/5T/rv/L/8b/lP9s/0j/KP8R//f+5P7W/sz+\
xv7D/sX+yf7S/t7+6/79/hD/J/88/1X/b/+J/6H/v//a//n/EQBKAKoA/ABLAXEBZwFeAVcBSgFhAZsBxAHqAd0BqwGAAVIBJQH5AM0AoQB3AE8AWwB6AIsA\
nQCAAEIADgDb/6z/gv9a/zf/F/8B/yT/Uv94/53/vv/d//v/DADn/7v/l/91/1n/Qf8p/xv/Cv8J/0n/gv+2/+b/EwA7AGMAegBZADQAFQD1/+r/FAA8AF8A\
fgCYAK4AwwDCAIoAVAAkAPT/yv+k/3//Yf9A/0L/dv+c/8f/zf+n/4r/cP9b/0j/Of8w/yf/IP8e/x3/If8m/y3/OP9D/1P/X/94/9L/IQBvAJ0AlgCRAIwA\
hwCDAIAAewB3AG8AigDNAP8AMgE4ARIB8wDTALQAlwB6AF4AQgAqAEcAcQCTAKsAhwBYADAACQDm/8T/pv+K/3D/Wv9G/zb/KP8d/xb/E/8N/w7/EP8V/xz/\
Jf8w/z3/S/9X/2v/fv+Q/6P/t//L/97/8f8HABgALQA6AF0AsQD7AEABaQFYAUUBMQEfAQsB9gDfAMoAsQDCAPAAEgEuAUMBUgFbAWEBNwHtAKoAagArABwA\
KwAvADMAMgAwACwAJQAcABQABwAAANr/iP8+//7+wP6n/sD+0f7l/vb+CP8b/y3/Pv9R/2D/df9q/zT/DP/n/sL+xf70/iD/Tf9l/0r/Mv8d/wz/Ev9T/4z/\
xf/e/8f/uP+r/6H/m/+X/5X/l/+U/7//DQBLAIgAvgDvABsBQAFhAXwBkgGiAawBsgGxAbABmAFLAfoAsQBoADcAPAA6AD0AIADU/5H/VP8c/+7+wv6Y/nn+\
W/5r/qL+0P78/iv/V/+C/6z/0v/2/xcAOgBDABkA9P/S/7X/nf+H/3P/Zv9V/2j/qf/f/xMAQgBtAJQAtwDWAPIACAEbASkBNAE4AT8BJAHZAJYAVgAaAOL/\
rv9+/1X/Kf8s/1X/c/+U/4n/Xv8+/yT/C//3/un+3f7W/tP+1P7Y/uD+6/74/gn/G/8y/0P/fv/i/zUAhQDLAAwBRwF+AYQBZQFMATIBGQH/AOUAywCxAJcA\
fwBmAE4ANwAhAA4A+v/p/9j/0v8DADgAZgCNALAAzwDpAPsA1QCeAG8AQQAXAO//yf+m/4f/a/9T/zz/K/8W/y//bf+e/9H/0v+1/6L/kP+C/3f/bv9n/2P/\
Yv9g/2L/Zv9r/3L/e/+E/5L/mv+8/xAAWQCgAMcAuQCtAKEAlwCNAIIAdgBsAGEAVgBMAEEAOAAuAFcAkwDCAOwAEAEuAUcBWQFnAW8BcQFwAToB6wClAGAA\
IAAUAB8AIQAhAB4AGgATAA8A3v+P/03/Dv/Z/qv+fP5X/jf+Jf5O/oL+sv7c/gr/N/9j/4X/cP9T/0L/M/8o/2D/n//U/wYANABfAIYAqQDIAOMA+AANAesA\
sAB/AFAAJAD7/9P/sf+R/3T/W/9F/zP/Jv8Y/w//Cf8H/wf/C/8S/xv/J/8y/3X/zv8XAF4AnQDXAAwBOQEsAQoB8QDVALwAowCKAHEAWgBDAC4AGQAHAPX/\
5P/W/8j/vP+y/6r/o/+e/5z/mP/G/w0ARwB+AK0A2AD/AB8BOQFPAV4BbQFWARIB1ACaAF8ATABfAGgAcABzAHMAcgBtAGcAXwBUAEwAKgDY/43/SP8J/9T+\
ov50/k7+Lv4V/gP+9f3w/e39H/5w/rT++/4Q/wv/Ef8Y/yX/M/9C/1X/af9//5P/qf/E/9j/DQBsAL4ACwFPAYsBwQHuARUCMwJLAlwCZAJnAmECVwJFAi8C\
EwL1AbwBUAHoAIUAJgDN/3n/Kv/i/qP+Z/4w/gP+3P29/aX9kP2m/ej9JP5k/on+k/6j/rX+zP7k/v/+Gv84/1T/mf/q/zEAdACxAOoAHAFHAUYBOAErARwB\
DgH9AO0A2wDHALQAoACMAHgAZABQAD0AKQAYAAUADQAwAEsAYwB4AIkAlgCiAKkArgCuAK8AnQBqADYABQDX/7//x//O/9X/2P/b/93/4P/O/57/cv9K/yn/\
Cv/z/tz+yf65/rv+4f4J/zX/UP9I/z7/PP86/0P/ev+s/9v/9f/v/+j/5f/h//P/IwBPAHkAigB7AGsAXQBPAFgAfQCdALgAzwDhAPEA/gDvAMQAmgB0AE0A\
PwBPAFoAYgBmAGoAaQBqAFcAIwDx/8X/mv+I/5b/o/+u/7j/wP/J/9H/1//e/+T/6f/t//H/9P/3//n/+v/5//v/8//I/5j/cP9L/zL/Qf9Y/23/ef9i/0X/\
Mv8h/xf/PP9k/4j/qv/L/+r/CQAaAAYA8f/f/9D/xP+5/7D/qv+l/6L/ov+i/6T/p/+s/7H/uf/B/8r/1f/g/+r/9P8HAD0AeQCrANkAAgEmAUQBXgFzAYQB\
jwGUAZYBkwGLAYIBXwEeAd0AoABjAEIAPQAyACoABQDH/5D/X/8w/yH/Lv84/0L/S/9W/2D/bP9i/z3/Hf8F/+z+2v7M/sL+vf69/uP+Fv9F/3f/pP/Q//r/\
HwAeABAACAD+//n/9P/w/+3/7P/r/+v/7P/u//H/9P/4//z/AgAGACMAWgCKALYA2wD9ABoBNAE3ARYB9gDWALYApQC1AMUAzgDWANkA2QDYAMMAjgBYACYA\
9P/V/9v/4f/l/+f/6f/p/+j/5//m/+P/4f/e/9v/2P/U/8//p/9z/0j/IP8B/wr/If80/0j/W/9u/4H/lP+l/7f/yP/U/77/nf+D/2v/WP9I/z3/Nf8s/yn/\
KP8q/y//NP9K/4f/wf/2/ygAVwCBAKkAzADtAAgBHwEwARwB9wDWALUAlgB3AFoAPgAiAAoA8v/c/8j/tf+m/5f/jf+C/3v/mf/G/+z/DQAIAPb/6f/d/9j/\
9v8hAEMAYgB+AJcArQC+AKsAhgBmAEYAKgAOAPb/3v/H/73/2P/3/xAAJwA7AE0AXQBqAHQAfQCDAIcAiQCIAIgAfABLABYA5/+6/5P/k/+i/6z/tv++/8b/\
zv/U/9r/3//k/+n/0v+l/33/Wv88/yP/Dv/6/ur+5P4C/y3/V/93/3L/Zv9h/13/Y/+Q/8T/8f8VABQACQAFAP7/BQAvAFwAgwCmAMMA3wD3AAAB4wDBAKMA\
gwBxAIMAlQCkAKUAgABXADMADgD8/wwAHgArADYAPwBGAE0ASQAiAPT/zf+m/43/mf+t/73/zP/a/+f/8v/8/wYADgAVABsAIQAlACcAKAApACkAJwAnAA0A\
2f+r/4H/Wv9S/2f/dv+G/3j/V/87/yf/FP8D//n+8P7t/uz+8P71/v7+Cv8X/yf/Of9N/2L/ef+M/6b/wP/W/wgAUQCTANEABQE3AWIBigGXAYEBagFSATgB\
LAFBAVIBXwFVASgB+QDMAKAAdwBOACYAAgDd/9T/5v/z/wAA8f/I/6T/hP9n/03/N/8l/xX/Cv8n/1H/dv+Y/7n/1//2/wwA/f/k/9H/v/+x/6T/mf+R/4n/\
j/+4/+X/DAAwAFIAbwCKAKIAtgDHANQA3gDmAOsA7ADqAOUA3gDUAMkAoABgACUA7v+6/6D/pv+p/6n/q/+s/6v/rv+W/2X/Pv8Y//v+3/7H/rb+qP6g/rn+\
6v4R/z7/Tf9B/z//QP9C/2n/pv/Y/wYADQAHAAYABAAIAC8AYgCMALQA1gD0AA0BIgEUAfEA0QCyAJYAnQCwAL4AxQClAHkAUgAsAAgA5//J/6z/kv97/2f/\
Vf9H/zr/Mf8r/yj/KP8l/zT/bf+g/9L/7v/o/+L/3//e/97/3//h/+T/6P8LAEEAbgCYAL0A3QD5ABEBJAEzAT0BRAEpAfcAyQCcAHEARgAfAPn/1f+0/5X/\
ef9g/0j/Pv9a/3v/l/+z/8v/4v/5/wcA8f/R/7j/of+N/3z/bf9i/1X/X/+L/7T/2v/8/xwAOgBVAG0AggCUAKQAqACHAF8APQAcAAYAFwAqADoAPQAbAPX/\
1P+2/5v/hP9t/1z/S/9U/3z/n//A/97/+/8UAC0AKwANAPP/3f/J/7j/qP+a/4//hv9//3n/d/91/3X/d/96/4D/h/+P/5j/ov+t/7n/xv/T/+D/7v/7/yQA\
YgCZAMoA9QAcAT0BWQFwAYEBjQGWAYgBVgEjAfIAwwCUAGgAOgASAOn/2v/o//L/+v///wMABwAJAAkACAAHAAUAAgD+//r/9P/v/+n/5P/d/9f/0P/K/8P/\
vf+3/7H/rP+n/6L/nv+b/5j/lf+T/5L/kP+Q/5D/kv+J/1//NP8T//L+1v7C/rL+pf6e/pr+nP6g/qn+tf7f/iT/Xf+c/8D/xf/Q/9v/5/8JAEgAgQC1AOQA\
DwE0AVYBXAFCASkBEQH2APMACwEbASoBHgHxAMcAngB4AFIALwANAOz/0f/Z//H/AQAOAPX/0f+0/5b/g/+V/7H/yv/h//b/CQAaACoAOABDAEwAVQBAABMA\
7P/J/6r/rP/D/9T/4//Q/63/kf93/2T/c/+V/7H/y//j//v/DwAkACIAAgDj/8n/sv+e/47/fv9x/2j/Yf9c/1n/WP9h/5L/xP/0/xMADgAFAAEA+/8EADEA\
XQCEAJsAiwB4AGgAWABKAD0ALwAjABcAJwBOAG4AiwCGAGkAUwA8ACcAFAACAPH/4P/W/+//EwAyAE4AZQB6AI0AnACoALEAuAC7AL0AuwC4ALIAqQCfAJQA\
hwB4AGgAVwBFADMAIAAOAPv/5v+w/27/NP8B/9X+0/7h/ur+9P7Y/rL+mf6E/nz+m/7F/uz+D/8M/wL/AP8B/wb/Dv8Y/yT/NP9F/1j/bf+D/5T/y/8WAFYA\
lADKAPwAKwFSAXUBkgGqAb0ByQHRAdMB0QGvAXIBOgEAAckAlABgADAA///T/6r/gv9f/z//I/8K//j+5f7W/s3+xv7D/sX+x/7c/hD/Sf+C/6f/qf+q/6//\
sv/L/wIANgBoAH8AdgBtAGcAXwBtAJYAuwDdAOMAygCxAJkAggBrAFYAQAAtABsAKgBLAGIAdgBiAEAAJAAJAPP/AQAcADAAQAArAAYA6v/N/7n/yv/l//v/\
BwDv/9D/tv+d/4//p//G/+D/+P/x/9P/u/+l/5T/hP93/2v/Yv9c/1f/VP9U/1X/Wf9e/2b/bv93/4L/j/+d/6r/vP/y/zEAaACUAJgAkgCOAIkAhQCBAHsA\
dwBvAHYAnQDDAOIA/QATASQBMQE4AT0BPQE6AS0B/AC+AIQATwAbAOn/uv+P/2X/Uv9h/27/ff90/07/Lv8R//r+6f7X/sr+wf68/rv+vv7D/sz+1v7+/j3/\
ev+z/83/zv/T/9r/4v/r//T//f8GABYASQCCALIA3AACASMBQQFQATgBFwH6ANkAwQDNAN4A6QDoAMAAkQBlADwAFADu/8v/qf+L/3D/V/9B/y//H/8y/1n/\
e/+c/7n/1f/w/wcA/f/g/8r/tf+i/5T/hv98/3P/cP+U/8H/5/8LAAsA+P/r/9//1f/M/8b/wP+7/7n/t/+2/7b/uP+7/77/wv/H/87/9f8sAFwAhgCKAHwA\
cgBnAGAAegCiAMEA2QDNAK4AlAB6AGUAcgCKAJwApACHAF8AOgAYAPn/3P+//6f/jf+E/6D/vf/W/+z/AQASACQAKwAOAOn/y/+u/5//tP/O/+T/9/8JABkA\
JwAzADwARQBMAE0AKgD7/9X/r/+R/5n/rv++/8r/sv+O/3L/WP9H/17/f/+a/7X/zv/l//v/EAAjADQAQgBQAFsAZQBsAHIAdgB5AHgAdgB0AHAAaQBhADYA\
/P/L/5z/cP9M/yn/Df/1/uH++P4b/zr/VP9I/zj/K/8h/yH/S/99/6n/0v/5/x0APwBfAHwAlgCuAMIA0wDhAOwA8wD4APoA+QD0AM4AlABgAC8AAgDW/6//\
iv9q/03/M/8e/w3//P7x/un+5f7m/ub+/f4z/2v/n//Q//3/KABTAGoAXQBPAEMAOQAxACgAIQAaABMADwAKAAYAAwAGACsAWwCCAKUAxQDgAPcACgEZASUB\
LAEwATABLAElARsB8QCxAHYAPQAIANf/p/99/1X/M/84/03/Xv9u/3z/iv+Z/6b/kv9u/1H/OP8j/xX/Bf/6/vT+8P7w/vL++P4A/wv/GP8n/zn/S/9g/3P/\
iP+h/7f/z//n////FQAsAEIAVwBqAHwAqQDpACABUQF7AZ8BvAHUAeQB7wH1AfUB7gHkAdUBwAGpAY0BbgFNASgBAgHZALIAegAiAMz/e/8x/+z+sf56/kb+\
Gf4K/h3+MP5F/lr+cv6L/qf+tP6i/pL+iv6G/on+jv6Y/qX+tf7p/i7/bP+u/+n/IgBWAIYAlQCNAIoAhgCDAKAAzgD0ABMBDwH1AN0AxwCwAJoAhABvAFkA\
TgBnAIIAmQCfAIAAXgBBACIAEgAmADwATgBWADoAFQD1/9b/wf/S/+r//v8PAB0AKgA3ADgAFADs/8n/qf+M/3P/XP9K/zf/N/9d/4H/pf+1/6P/k/+H/3v/\
hv+x/9n/AAAMAPv/7f/g/9b/zv/I/8L/vv+8/7v/uv+7/73/xP/u/yIAUAB5AJ8AwADeAPYA6wDLAK8AlAB8AIcAngCvALwAxQDMAM4AzwCwAHsASQAcAPH/\
5f/x//j//P8AAAQABAAEAAQAAwAAAP3/+f/3//P/7v/p/+T/3v/a/8z/m/9n/zz/FP/7/gv/H/8z/0X/WP9q/33/kP+i/7T/xP/V/+T/8/8CAAUA5v/D/6b/\
iv98/5T/sf/N/9z/yP+v/5v/iv99/3P/av9l/2L/Yf9j/2b/bP9z/3z/h/+T/6D/sf/k/yUAXgCSAMAA6wARATIBTwFnAXkBiAGRAZUBlQGRAYkBfQFsAVkB\
IwHaAJUAVQAYANz/pv9y/0T/Gv/z/tX+tf6d/on+ev5w/mn+af5r/nL+ff6M/p3+zP4U/1L/lv+5/8H/zv/b/+v/+v8KABgAKAA4AEYAUwBhAGsAhQC+APQA\
IgFKAW0BiAGfAbEBvAHDAcQBwAG4AasBmgGAAT8B9ACvAGsAKgDt/7P/ff9K/yn/LP80/zr/QP9G/0z/VP9T/zH/Cf/t/tL+u/6q/p3+lv6Q/qT+2v4I/zn/\
U/9P/1D/Uf9Y/1//aP92/4L/kf+i/7L/xP/U/+v/JQBnAJ8A1AACASsBTwFuAYcBmwGqAbIBtwG3AbABqAGJAUgBBwHKAI0AZgBfAFYASgA7AC0AHAANAOf/\
pv9r/zf/Bf/u/vn+A/8N/xf/Iv8u/zr/R/9V/2H/b/99/4r/mf+m/7T/wf/N/9n/4//v//n/AgAKABEAGAAdACIACgDb/7P/kP9x/1b/Pf8s/xv/DP8D//3+\
/P77/v/+Bv8O/xv/Kf85/0z/YP93/4n/vv8KAEoAiAC/APEAHwFGAUoBNgEmARUBAwERAS8BRAFUAT8BFQHvAMkApACBAF0APAAaAAQAFAAmADYANgATAOz/\
zP+s/5z/sf/I/9z/7v/9/wwAGAAjAC0ANAA7ADwAGADq/8P/nf+E/4//pP+1/8X/1P/i/+7/+f8DAAwAFAAaACAAJAAoACoADADc/7L/jP9q/2v/gv+V/6b/\
l/92/1z/Rv80/0X/a/+M/6n/ov+O/4D/dP9t/2j/ZP9j/2T/aP9t/3X/ff+H/5P/oP+u/73/y//y/zMAbgCjANMA/wAkAUcBUQE5AR4BBgHsAOgA/wAQAR4B\
DQHhALYAjQBnAEEAHgD8/9z/v//E/9z/7v/+/wwAGQAjACwAMwA4ADwAQAAzAAQA1f+s/4b/ZP9G/yv/Fv8B/wv/Mv9S/3L/j/+s/8f/4v/d/8L/r/+b/43/\
gf94/3H/av9n/2f/aP9r/3D/dv99/4f/kf+d/6r/t//F/9T/4f8JAEkAgAC3AMwAxAC+ALYAsACpAKEAmQCPAIoApgDMAOoA/ADoAMgAqwCQAHYAfQCUAKMA\
rgCVAGoAQwAeAP//AwAUACAAKgAxADcAOwA5ABQA4/+5/5H/bv9N/zH/Gf8D//f+Ff84/1j/d/+T/67/yv/e/87/s/+f/43/f/9z/2n/Yf9e/1n/Wf9a/17/\
Yv+E/7//8v8hAC0AJAAgABwAGwA5AGgAjwCyALEAmwCIAHYAZQBVAEQANAAlABgACgAAAAEABgAJAAwADwARABIAFAAUACMARgBiAH0AgQBxAGUAVwBKAD0A\
MAAkABYACgAVACsAOwBKAD4AJgARAP7/6//a/8r/u/+t/6H/l/+N/4f/fv+H/6b/wP/Z/+//AwAVACgAKAAUAAMA8//j/+T/+v8MABwAKAA0AD4ARwBMAFEA\
UwBXAE8ALwANAO//0/+7/73/yP/R/9T/v/+k/4//ev9s/3r/jf+f/63/oP+P/4L/eP9w/2n/Zf9j/2L/Zf9o/2z/c/94/5T/wf/m/wsAGAAVABYAFwAZADEA\
VQByAI0ApAC4AMkA1wDiAOoA7gDwAO8A7ADlAN4AyQCcAHAARgAfAPr/1/+1/5f/ev92/4H/if+R/4D/Zv9T/0H/NP8p/yH/G/8c/xf/L/9Y/3j/mv+3/9f/\
8/8PABUACgAEAP3/+f/1//P/8f/v/+//7v/v//D/8P/9/yAAQABdAHYAjACgALIAvwDKANMA2ADbANsA2ADVAMUAnQBzAE0AKAANAA0ADAAJAAYAAgD9//j/\
7v/J/6X/hf9n/0//Ov8l/xf/Cf8M/yj/QP9b/2j/Xv9Y/1b/Uv9f/4X/pv/J/9z/2f/X/9j/2P/n/wwAKwBKAFYATABFAD4ANwAzAC4AKQAlAB8AMgBQAGgA\
fwB7AGgAWwBMAD8ASwBfAG4AegBqAFIAPAAnABQAAwDx/+L/0//L/9//9P8FABQAIgAuADgAQAArABAA+//l/9f/4//z/wAADAAVAB0AJAApABUA+P/g/8j/\
tf+i/5L/hP94/27/Z/9h/17/Wv9j/4f/p//I/9v/1v/S/9D/zv/a//3/HAA5AEQAOgAyACoAIwAdABcAEgAOAAkABgABAP7/+//7/xQAMgBMAGUAeQCLAJoA\
pwCxALgAvAC/AK4AiQBoAEkAKgAOAPP/2v/C/6z/mP+G/3f/aP9n/3//lP+r/7j/rP+f/5X/jf+H/4T/gf+B/3//jv+z/9T/9P8RACwARABcAG4AgQCQAJ0A\
ogCMAHIAWwBEADcAQQBLAFQAWgBdAF8AYgBZADcAFgD3/9n/xv/O/9X/3f/c/8D/pv+Q/3v/dP+G/5f/qP+s/5n/iv9+/3L/dv+S/6z/xf/a/+//BAAXACgA\
OABFAFIAWwBLADEAGwAHAPT/5P/U/8b/uv+v/6b/nv+Y/5T/kf+P/5D/kf+U/5j/nf+k/6n/t//g/wgAKwBMAGoAhQCeAKwAnwCQAIEAcgBtAH4AkACdAKcA\
rgCzALYAsgCTAG8ATgAvABEA9P/a/8H/q/+W/4T/c/9l/1n/T/9I/0P/QP9B/2D/g/+j/7v/uP+0/7T/s/+0/7f/uf++/8L/x//P/9T/3f/i//T/HQBBAGUA\
dwByAGsAZgBgAGgAggCZAK0AvQDKANMA2gDeAN8A3QDZANIAyQC9ALMAmABoADoADgDk/8n/xv/C/73/uP+0/6//q/+m/6P/n/+d/5b/d/9X/zz/Jf8Q/wP/\
9/7r/uX+7/4N/y//UP9u/4z/qf/H/9n/0//O/8v/yP/R//P/EwAwAEoAYwB3AIwAlwCHAHIAYgBSAEgAWgBoAHcAdwBdAEcAMQAbAAgA9v/l/9b/x/+7/7D/\
pv+f/5f/lP+Q/47/jf+R/67/0v/x/w8AKQBDAFkAbABnAFUARwA5ACwAIAAUAAkA/v/2/+3/5v/f/9j/0//P/8z/yv/I/8f/x//J/8r/zf/q/w4ALQBJAGIA\
eQCMAJwAkAB7AGoAWABIAFIAYgBuAHcAfgCDAIUAhQCEAIIAfAB3AFwAMgAMAOn/x/++/8T/xP/G/7D/jv90/1v/R/82/yj/G/8S/w//DP8J/wz/D/8Z/0P/\
bP+U/7L/tv+4/73/xP/M/9P/3P/l/+7/9/8AAAkAEwAbACQALAA0ADsARABnAIwArADDAL0AsgCpAJ0AlgCoALsAygDUANsA3wDhAN0AvwCYAHUAUQAwABAA\
8f/U/7r/oP+K/3b/Y/9S/1f/bv+A/5T/kf9//3T/av9j/17/W/9b/1v/Xv98/6L/xf/l/wIAHgA4AE8ATQA/ADQAKQAhABcADgAHAP///v8YADAASABTAEIA\
MwAkABcACgD///X/6//h/+H/+v8QACcAMgAiABIAAwD3/+v/4f/X/87/x//B/7v/t/+z/7P/zf/t/wkAIgA5AE0AYQBtAGEASwA5ACkAGAAJAPv/7f/g/9b/\
y//C/7r/s/+u/6n/pv+k/6P/o/+k/6X/qP+s/7H/tv+8/8P/zP/x/xgAOgBXAFUATgBKAEUAQQA8ADYAMwAtADAASgBkAHoAjACbAKcAsgCxAJUAeQBdAEMA\
KgATAPz/5v/S/7//rf+d/5D/g/94/2//af9k/2H/X/9f/2D/Y/9o/27/dP98/4b/kP+a/6b/sf++/8r/1//j/+///P8HABMAHQAoADIAOgBDAEsAUABbAIAA\
oQDAANMAyAC7AK4AoACSAIQAcwBlAFUAVABoAHQAgAB6AF4AQwApABIA+//k/8//vP+q/5r/i/9//3X/bP99/5j/r//F/8H/sv+o/6D/mv+V/5H/jv+N/43/\
jv+R/5X/l/+t/9X/9/8aACQAHgAbABcAFAASABAADQAMAAoACAAHAAYABQAEAAMAAgABAAEAAQABAAEAAQABAAEAAgADAAMAAwAYADsAVgBwAHEAYgBWAEsA\
PwA0ACgAHQATAAkA///1/+3/5f/d/9f/0f/M/8j/xP/B/77/vf+8/7v/vf+9/7//wv/E/8f/zf/P/97/BQAmAEcAVABLAEQAPAA1AC4AKAAhABoAFAAOAAgA\
AgD8//n/DgAqAEEAVQBMADoAKwAdABAAAwD3/+z/4P/f//f/DQAfADAAPgBKAFYAVAA6ACEACQDz/9//zP+6/6z/nP+Z/67/w//V/+X/9f8CABAAFQAAAOn/\
1v/F/7X/p/+a/5D/iP+A/3v/eP92/3X/jv+y/9D/7P/s/+X/4f/d/9v/2v/Z/9v/2f/h/wEAIwA/AFoAcgCGAJgApACWAH8AawBXAEkAVABhAGwAbQBUADgA\
IAAHAPf/AQANABYAGAD+/+P/y/+3/6T/k/+D/3j/a/9s/4f/n/+3/8z/4P/z/wYACwD5/+n/2v/O/8T/uv+y/6z/p/+j/6H/oP+g/6H/uv/g//7/HAAgABcA\
EwAOAAsAIQBAAFgAbgCBAJIAoACrALQAuwC+AMAAwAC8ALYAsACmAJwAjwCBAF4ALQACANn/s/+l/6b/pP+k/6H/oP+f/5//mP94/1r/Qv8s/yL/NP9G/1j/\
a/98/47/oP+x/8L/0f/i/+j/1v/F/7f/q/+i/5v/lf+S/47/nP+//93//P8JAAEA+v/3//P/AgAjAD4AWABuAIIAkwCjAJ4AhgByAF4ASQBJAFoAZgBvAHYA\
ewB+AIEAcwBQAC8AEgD1/+v/9f/7/wEABAAIAAoADAADAOL/xf+r/5H/h/+X/6T/sv+z/53/iv98/23/b/+K/6D/uf++/6//p/+g/5r/lv+U/5T/lP+X/5v/\
oP+m/63/tf+//8j/0v/a/+v/FQA+AGQAgAB/AHsAeAB0AHkAlQCvAMUA1wDlAPAA+QD9AP8A/gD6APMA6gDfANIAvQCOAF0ALwADAOD/2P/T/83/xP+j/3z/\
Wv89/yb/LP85/0T/UP9c/2j/df+B/47/m/+o/7H/ov+N/3//cf9q/3//mv+y/8n/3v/y/wYAFwAPAP3/7//j/9n/0f/J/8P/v/+7/7n/uP+4/7r/vP/A/8T/\
yf/Q/+7/FwA5AFkAdACOAKUAuACwAJ0AjQB8AG4AeQCKAJUAoACmAKsArQCuAJwAdwBUADQAEwAIAA8AEQATAP//3P+//6X/jP+K/5r/pf+w/7r/xP/M/9f/\
z/+1/5//jP98/3D/ZP9c/1b/Uv9t/4z/qf/F/9//+P8PACIAHAAOAAQA+v/0/wgAIgA3AEoAQAAuACEAEwALAB0AMwBFAFUAYgBsAHcAegBiAEcALgAWAAAA\
7P/Y/8f/t/+p/53/k/+K/4L/hv+j/7//2f/x/wcAHAAvAEAATwBdAGgAbwBbAEEAKgAUAAUAEAAdACkALQAUAP3/5v/S/8H/sf+i/5b/jP+D/3z/d/90/3P/\
c/90/3f/fP+C/4n/kv+b/6X/s//a/wYALQBQAHEAjQCpAL8AugCoAJoAjAB/AHAAYgBWAEYAQQBUAGQAcwB5AGMASgA0AB4ADwAbACgAMgA7AEAARQBIAEkA\
SQBJAEcAQwA/ADoAMwAtACUAHQAUAAwAAgD5//D/5v/d/9X/zP/E/7z/tv+u/6n/o/+e/5r/l/+R/3P/Uv83/x//D/8A//H+6v7j/u/+EP8u/1H/cf+R/7D/\
z//r/wYAIAA5AEMANwAtACIAGgATAAwACAACAP7//f/6//j/9v/2//f/9//6//v//v8YADwAWwB2AI8AowC3AMYA0gDcAOMA6ADpAOgA4wDfAMsAngB2AE4A\
KQAGAOT/xP+n/43/jP+Y/6D/qf+x/7n/v//G/83/0//Z/+D/4//o/+3/8f/f/8D/qP+S/33/gf+V/6T/tf/D/9H/3//r//f/AgAMABcAFwD//+f/0v/A/7D/\
of+W/4z/g/99/3r/d/92/3j/ev9//4X/i/+b/8T/7P8TACwAKgArACsALAAuAC8AMQAzADIAQwBmAIEAnQCkAJYAiQB+AHAAdQCLAJsAqQCyALoAvgDBAMAA\
vQC6ALIAqgCgAJMAhwBpADgADADh/7r/lv91/1b/Pf8j/x3/Lv89/0z/Wf9p/3f/iP+M/3n/av9f/1b/UP9M/0n/Sv9N/1L/WP9g/2j/dv+g/8z/9v8WABsA\
HgAhACMALgBRAHIAkgCnAJ8AlACJAIAAdwBsAGIAWQBNAFMAawB8AI0AiABwAFsARwAzADMARABOAFkATgAxABgAAQDr/+v/+f8FAA8AFQAdACEAJwAbAPv/\
4P/G/6//mv+I/3f/af9d/2n/hP+a/7H/xf/Y/+r//P8MABoAJwA1ADIAGQADAO//3v/O/8D/s/+o/5//sP/L/+L/9/8LABwALQA9AEkAVQBfAGYAVQA4ACAA\
CQD0/+H/zf++/6//pP+2/8z/4P/u/+P/0f/F/7n/s//J/+L/+f8GAPn/6//h/9X/z//j//3/FAAoADoASgBYAGQAVwA+ACoAFgAGAA4AHwAsADgAQQBIAE8A\
UwBXAFkAWQBYAFYAUwBOAEgAKgACAN//v/+i/4f/b/9a/0f/Ov9L/2H/dP+I/5r/rf++/8//4P/w//3/CwABAOv/2v/K/73/sv+o/6D/mf+a/7b/0//u/wAA\
+P/t/+f/4f/g//n/FQAvAEUAPAAvACUAGwATAAsAAwD+//f//f8aADQATABSAEIANAApABsAHwA3AEkAXABdAEgANQAkABIAEwAmADQAQgBNAFYAXQBjAFYA\
NwAbAAIA6P/j//H/+/8DAAoADwAVABkAHAAeAB8AHwAfAB4AHAAaABcAEwAPAAsAAwDi/7z/nP9//2j/a/93/4L/jf+X/6H/rP+1/6X/jv98/27/Yv9Z/1H/\
TP9L/0v/Tv9R/1f/X/9x/57/yf/v/xQANwBWAHQAjgCmALoAzQDXAMYAsACbAIcAdABgAE0AOwAqABkACQD6/+3/4P/V/8v/wv+6/7j/0P/r/wMAGgAuAD8A\
UABZAEgAMgAhAA4AAgARACMAMQA8AC4AFQABAO3/3v/q//z/CgAUAAIA7P/b/8n/vf/N/+L/8/8DABAAHAAoADAAHwAFAPD/2//N/9j/6v/4/wUAEAAaACMA\
KwAxADYAOgA8ACMAAwDp/8//uv/A/8//2P/h/8//tv+j/5H/hP93/2z/Zf9g/1v/Wf9a/1z/YP9m/2z/df9//4r/lv+i/7D/vf/O//n/KABRAHIAdwB2AHcA\
dgB8AJkAtwDQAOUA9gADAQ0BEwEXARcBFAENAQQB+QDrANwAtgCBAFEAIgD3/87/pv+D/2H/R/9K/1H/Wf9Z/0L/K/8Z/wn/AP/3/vD+7/7v/vH++P4A/wv/\
Fv8x/2b/lP/C/9v/4P/p//P//f8HABIAHAAlADEAVgB+AKAAwADbAPIABgEWASEBKgEvATABLQEpASABFgH1AMMAlgBoAD0AFQDu/8r/pv+I/4T/i/+O/5L/\
lv+Z/53/of+l/6n/rf+x/6P/hv9u/1r/R/9N/2P/df+I/5n/rP+8/83/x/+1/6f/m/+T/4z/hv+D/4L/g/+g/8T/4////wAA+f/2//T/9f8RADIATABmAHoA\
jQCfAK0AuQDAAL0AsQCmAJgAiwB+AG8AYABRAEUAQgBCAEEAOwAqABYAAwDy/+X/4v/j/+H/4f/f/97/3P/a/9j/1//V/9P/0v/R/8//yv++/6//oP+V/43/\
kf+a/6L/qf+w/7j/wf/G/8P/uv+0/7D/rf+r/6r/qv+q/6z/r/+z/7b/u//B/8b/zf/U/9v/4f/o//D/9//9/wUADAATABgAIwA0AEgAWgBkAGQAYQBdAFoA\
WQBjAG0AdAB6AH0AfgB/AHsAbQBZAEcANgApACUAJQAiAB8AGwAWABIACQD3/+P/0f+//7X/tP+4/7n/u/++/8D/w//F/8j/yv/O/8//x/+7/7H/qf+k/6v/\
tv/A/8n/0//c/+X/7f/1//3/BQALABEAFwAbACAAIwAmACgAKQAjABQABgD5/+3/5P/Z/9L/yv/F/8r/1P/f/+f/5P/f/9j/0//T/9v/6P/0//3//P/2//P/\
7//s/+r/6P/n/+b/6v/4/wgAFQAdABsAFgASAA8ADAAKAAYABQADAAkAFwAkAC4ALwAoACIAGwAWABsAJAAtADUAOgA/AEMARgBDADQAJgAYAAsA///0/+n/\
3v/X/9j/4P/n/+3/6f/f/9b/zv/I/8P/v/+8/7n/uv/F/9T/4v/u//v/BQAPABgAFgAOAAcAAgD//wUAEAAZACEAKQAuADMANwA6ADwAPAA+AD4APQA6ADcA\
NQAwACwAJgAXAAMA8P/e/87/wP+y/6b/nP+V/5f/of+q/7P/u//E/83/1f/d/+X/7f/z//P/6//i/9z/1//b/+b/8f/6//r/8//u/+j/5P/h/97/3f/b/9r/\
2v/b/9z/3f/e/+H/5P/m/+r/8v8EABcAJwA2AEMATwBZAGEAaQBuAHIAdQB2AHcAdQBzAG8AaQBlAF0AVgBOAEQAOgAoAA8A9//g/8z/uv+p/5n/i/9//3X/\
bf9m/2H/Yv9u/33/i/+a/6j/tv/F/8//0P/O/83/zv/Q/9L/1P/Y/9v/5P/3/woAGwArADkARgBRAFwAZQBsAHIAdQB5AHkAeQB2AGgAVQBDADIAIQASAAIA\
9P/l/9r/zv/D/7r/sv+r/6b/of+e/5v/mv+a/5z/nv+h/6T/qv+v/7T/u//C/8n/0f/a/+r/AgAXACwAPQBNAF0AaABrAGUAXgBZAFIATABFAD4ANwAvACkA\
IQAaABMADAAGAAAA+f/0//T//f8IABAAFwAeACMAKAAoAB0AEAAEAPn/7//l/93/1f/P/9D/2f/j/+v/8v/5////BQACAPf/7f/k/9z/1f/Q/8r/xv/D/8n/\
1//j/+7/8f/r/+b/4v/f/+b/8v///wkACQADAP7/+f/2//z/BwASABsAGQAQAAoAAwD//wMADwAXAB4AJAAqAC4AMAAnABsADwADAPn/7//m/97/1v/S/9n/\
4//s//H/6//i/9z/1v/V/93/6f/z//j/8//s/+f/4v/h/+z/+P8CAAwAFAAbACIAKQAsADEANQA3ADkAOgA6ADgANwA1ADEALgAjABAA/f/s/9z/1f/X/9j/\
2f/S/8T/uP+s/6T/nP+V/5H/jf+L/4r/i/+N/4//lv+n/7z/0P/i//P/BAAUACAAIwAgAB8AHAAdACcANQBBAEkAUwBaAGAAYgBYAEwAQAAzACoAKwAvADIA\
MgAmABYACAD8//D/5P/Z/9H/yf/G/8z/1v/e/+b/7f/0//r/AAAFAAoADgANAAQA+P/t/+P/3//k/+z/8//5//7/BAAIAAkAAAD1/+r/4P/c/+L/6v/w//f/\
/f8DAAgACAD///P/6v/g/93/4//s//T/+/8BAAYADAAPAAcA+//w/+j/4P/Y/9L/zv/I/8r/1v/i/+7/8v/s/+j/5P/g/+P/7v/9/wkAEwAeACYALgA1ADsA\
PwBEAEYASABJAEkARwA7ACkAGQAKAP3/+//9//7//f/y/+P/1v/K/8D/t/+u/6j/o/+f/5v/mv+a/5v/nP+e/6P/p/+s/7v/0f/l//j/AgADAAYACAALAA0A\
EAASABQAGgAnADgARwBUAF4AaABwAHcAewB/AIAAfwB+AHsAdwBxAGEASgA2ACAADAD6/+f/1//H/7v/uv++/8H/wv+5/63/ov+a/5P/jf+J/4b/hf+G/4f/\
if+N/5L/n/+0/8n/3P/m/+j/6//v//P/AQAUACYANgA6ADkANgA0ADMAOwBIAFIAXABjAGkAbQBuAGUAVwBIADoALQArAC0ALgAsACEAEAAAAPL/5f/i/+X/\
6f/q/+L/1f/J/77/tf+u/6f/ov+d/5r/mf+Y/5j/mf+g/7D/xP/V/+L/5P/j/+X/5//u//7/DgAfACcAJQAiAB8AHAAaABkAFgATABEADwANAAsACQAHAAUA\
BAACAAEAAgAMABoAJwAvACwAJQAfABgAFgAcACUALQAwACgAHQAUAAoAAgD5//H/6v/j/93/1//T/8//y//P/9v/6P/z//j/8//u/+r/5f/q//X/AQAMAA4A\
BwAAAPv/9v/w/+z/6f/l/+L/4f/f/93/3P/d/+n/+P8GABAAEQALAAYAAwAAAPz/+v/3//X/+f8GABMAHgAnADAAOAA+AEMARwBKAEwARwA5ACgAGgAMAAQA\
BgAIAAoACgAKAAoACgAGAPj/6P/Y/8v/v/+0/6r/ov+a/5T/kP+N/4v/i/+U/6X/tv/F/8r/yP/J/8n/y//O/9L/1v/Z/+D/8P8DABUAJgA0AEIATgBXAFYA\
TgBGAD8AOgA+AEYATABOAEYAOAAsACAAFgALAAAA9//t/+b/3v/W/9D/y//G/8L/v/++/7z/xP/T/+H/7//z/+//6//p/+j/5//l/+X/5v/l/+b/5//o/+r/\
7P/t//D/8f/z//b/+f/7//7/AAADAAUABwAKAA4AHAAtADsASQBTAF0AZABoAGEAVABJAD0ANQA2ADsAPQA+AD4APgA7ADkANQAxACwAJQAXAAEA7f/b/8v/\
xv/G/8f/xv+7/6z/n/+U/4z/kP+Z/6P/qf+m/6D/nP+Y/5f/of+w/7//zP/O/83/zP/N/9D/2//t//3/CgANAAoACAAHAAYABgAFAAQABAAIABUAJAAxAD0A\
RwBOAFYAXABfAGMAZQBlAGQAYgBfAFgARwAyAB8ADAD///z//P/7//X/5v/V/8b/uP+x/7T/uv+//8T/yf/O/9L/1//c/+D/5P/p/+3/8f/0//f/+v/+////\
AQD5/+v/4P/V/8z/zf/V/93/4//q//D/9v/8//n/7v/k/9z/1v/Y/+H/7P/0//L/6v/k/97/2v/W/9P/0f/P/8//z//Q/9H/0v/V/9j/2//f/+P/5//s//D/\
9f/6/wcAHAAuAD4ATQBaAGUAcAB4AH4AgwCGAIgAiACGAIQAewBpAFMAPwAsABwAFgAUABEACgD5/+X/0//E/7X/qP+e/5T/jP+F/4D/fP95/3n/ef97/37/\
g/+I/47/lv+d/6b/sP+6/8P/zf/X/+L/7f/3/wEACgAUAB0AJQAtADUAOwBBAEYASgBPAF0AbgB8AIgAkgCZAKAAowCkAKQAoQCeAJgAkgCJAH8AdABpAFwA\
TwA8ACEABADo/9D/vP+0/6//qv+l/6H/nf+a/5n/l/+W/5b/k/+H/3r/cP9n/2X/bv97/4f/k/+f/6v/uP/D/9D/2//o//D/8P/q/+f/4//k/+7//P8JABIA\
EQAKAAcAAwAAAP3/+//6//j/+/8JABYAIgApACUAHwAZABQAFQAfACoAMwA1AC0AIwAbABMACwAFAP7/+P/z//T//v8IABIAEwALAAMA+//1/+//6f/l/+H/\
3f/l//L//f8GAAUA/v/4//P/8P/3/wMADgAVABMACwADAP3/+P/z/+3/6v/m/+L/4P/d/9z/2//i//H///8LABcAIgArADIAMQApACAAGAAQABEAGQAhACcA\
KwAvADIAMwA1ADUANAAzADMAMAArACgAJAAfABoAFAAQAAsABQD///n/6v/V/8L/sf+k/6D/pP+n/6n/ov+X/47/h/+D/4r/l/+j/67/sP+t/6z/rP+v/7z/\
zv/e/+///v8MABkAIwAjAB4AGgAWABMADwANAAoACAAGAAQAAgABAP///v/+//7//f/9/wUAFQAjAC8AOwBEAEwAUwBZAF0AYQBiAGIAYgBfAF4AWgBUAE8A\
SQBBAC8AFwACAO7/3v/Y/9X/1P/Q/8H/sv+k/5f/kP+T/5v/o/+q/7L/uf/B/8f/xP+8/7X/sf+u/6z/q/+s/63/s//D/9X/5v/3/wUAEwAhACgAJQAgAB0A\
GAAaACQAMAA6AD0ANwAuACYAHwAYABIACwAFAAAAAwANABcAHwAfABUADAAEAP3/9v/w/+r/5v/i/+f/9P/+/wgAEAAYAB8AJQAqAC4AMwA1ADcAOAA4ADcA\
NQA0ADEALgAqACYAIAAcABUAAgDt/9r/yf+6/6z/oP+V/4z/i/+T/53/pv+o/6P/nv+b/5r/mf+a/53/oP+k/6j/rv+0/7v/w//K/9P/2//j/+z/9P/9/wYA\
DgAWAB0AJAAqADAAOwBPAGIAcgCAAIoAlQCcAKEApQCmAKcApACgAJsAlACKAHUAWwBCACsAFQD//+r/1//E/7n/uP+5/7n/uf+5/7r/u/+9/77/v//B/77/\
s/+n/5z/lf+T/5z/p/+x/7v/xP/O/9j/4f/q//L/+v////n/8P/p/+P/4f/q//X//v8FAAEA+f/0/+3/6f/l/+L/3//c/9//6v/5/wYADQALAAUAAQD+//v/\
+P/2//T/8v/x//D/8P/v/+//8P/w//H/8v/3/wYAFwAlADIAPQBHAFAAUgBLAEEAOAAuACkALgA0ADkAOAAsAB4AEwAHAPv/8f/n/9//1v/P/8n/w/++/7r/\
t/+2/7X/tP+0/7b/t/+4/7v/wP/E/8j/zv/T/+D/9f8IABoAIgAhACEAIQAhACEAIAAgAB8AHgAdABwAGwAZABsAJQAzAD4ARwBPAFUAWgBeAF8AYQBgAF0A\
UAA9ACsAGgAJAPr/6v/d/8//x//J/8//1P/X/9r/3f/h/9//1P/I/77/tf+t/6f/of+e/5r/n/+t/7z/yv/X/+T/8P/7/wUADwAXACAAJgAgABYADgAFAAIA\
CAAPABcAHQAjACcAKgAqACEAEwAIAPv/9P/3//3/AgADAPr/7v/k/9r/1f/c/+T/7P/u/+b/3v/W/9D/y//G/8P/wf+//8X/0//i/+///P8IABIAHQAhABsA\
EwANAAcACAARABoAIwAkABsAEgAKAAIA+//1/+//6v/l/+H/3f/a/9j/1v/V/9T/1P/V/9f/4//0/wQAEAASAA4ACwAJAAkAEwAgACwAMwAvACcAIAAcABQA\
DgAJAAMA///5//X/8v/u/+v/7v/7/wgAEgAcACQAKwAxADYAOgA9AEAAPAAvAB8AEQAEAPj/7P/h/9f/zv/O/9b/3f/k/+r/8P/1//n/9v/q/+D/1//P/8j/\
w/+9/7n/t/+0/7P/s/+z/7X/wv/U/+X/9P8CAA8AHAAnACgAIgAbABcAEgAOAAoABgACAAEACwAXACAAJgAhABkAEgALAAgADwAZACEAJwAsADIANAA3ADkA\
OQA5ADYAKQAYAAgA+f/r/97/0v/H/73/tP+s/6b/of+d/6L/sP+9/8n/zf/J/8b/xf/E/8T/xf/H/8n/zP/X/+v//P8MABMAEQAPAA4ADgANAA0ADQANAA0A\
DAANAAwADAALAAwADAAMAAwACwALAAwACwANABgAJwA0AD8ASABRAFcAXABhAGIAZABiAFYARAAzACMAFgASABMAEwASABAADgAMAAgA+//p/9b/x/+6/63/\
ov+Y/5D/jv+V/5//qv+y/6//qv+m/6T/ov+j/6T/pf+p/6z/sf+1/7v/wf/O/+T/+f8MABgAGgAbABwAHgAfACAAIgAiACUALwA/AEwAVgBUAE0ARgA/ADoA\
PgBHAE0ATwBIADsALgAiABcADAABAPj/7v/q//D/9//9/wEABgAJAA0ACgD+//H/5f/a/9b/2//j/+n/7v/y//b/+v/+/wEAAwAGAAcA/P/u/+L/1v/M/8L/\
u/+0/6//rv+4/8X/0P/b/+X/7v/4/wEACAAPABYAGAAPAAUA/f/1/+3/5v/g/9v/1//Z/+T/8P/7/wUADgAWAB0AJAApAC4AMgA2ADcAOQA6ADkAOQA3ADUA\
MQAiAA8A/v/t/97/0f/E/7n/rv+n/5//mf+U/5H/kP+P/5T/pP+2/8b/1v/l//P/AAANABkAIwAuADcAPgBFAEsATwBSAFUAVwBWAFUAVABRAE4ASQBEAEAA\
OgA0AC4AJwAgABgAEQAJAAEA+v/z/+z/5f/f/9r/1P/P/8v/xv/D/8D/vf+8/7r/uf+5/7r/uv+7/77/wP/C/8X/yf/M/9D/1P/X/9z/4P/l/+n/7f/x//X/\
+f/8/wAAAwAGAAkADAANAA8AEQASABQAFAAVABUAFQAUABQAFAATABEAEAAPAA0ACwAKAAcABQADAAEA///9//v/+v/5//b/9P/z//H/7//u/+3/7f/s/+v/\
6//r/+r/6//r/+v/6//s/+3/7v/u/+//8P/x//L/9P/0//X/9//4//n/+v/7//3//f//////AAABAAEAAgACAAMAAwADAAQABAAEAAQABAADAAQAAwADAAIA\
AgACAAEAAQAAAA==\
').split('').map(c => c.charCodeAt(0))).buffer);

const VX80 = new Int16Array(new Uint8Array(window.atob('\
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\
hfxq/Fn8Wfxc/Ij8V/0+/g3/zv+JADcB1gFnAuwCXAPGAwUEnAMTA5sCIwK1AUkB4gCAACgA0/+L/0L/B//E/uX+j/8dAKAAEwF8AdgBLAJwAqsC1QIAA+4C\
PQKGAd8AQwCx/yz/sf48/tb9fP0u/e78t/yT/BH9xf1h/u7+0f6Q/mr+R/4z/iT+HP4g/ib+N/5I/nb+Pf8gAO0AmQHHAdcB7wH9AR8CqgIyA6kD8AO4A3MD\
NQPqAr4C/QIyA1sDVwPbAlUC2AFdAecAdgAFAKD/N/8h/17/hP+u/3z/BP+m/k7+/f23/Xr9Rv0d/fv85PzV/NH80Pzr/Hr9HP6o/i3/sv8pAJoA+gDlAK4A\
hQBeAD0AHAD//+X/zf+3/6j/l/+O/3z/qP81AK0AGwF6AdEBGAJgAl0C9wGcAUYB7ADVABkBSgFzAZIBqAG4Ab8BwAG6Aa0BmwGEAWgBRwEjAfsA0QCkAHYA\
RwAWAOb/tv+H/1j/LP/+/tz+b/64/SH9mPwj/MD7a/sp+/P62/pA+8T7Pvy6/DT9rf0n/pD+iv5w/mr+Zv57/gP/mv8gAKcAvACcAI4AgAB8AOEAaQHXATwC\
lALgAiEDUAMKA54CQALhAY0BpgHdAf8BFgK4ATUBxQBYAPX/mf9D//v+q/6N/uT+Mv+B/5T/Rf///sL+kP5m/kP+J/4U/gf+Af4B/gn+Ff4o/kD+XP5+/qD+\
1P5z/yYAyABQAV4BTgFNAUMBUgHMAUkCtgL3Ar0CegI7Av4BwQGEAUgBEQHSALYABwFXAZYBzAH4ARoCMgJAAkcCRgI9AikCpAH7AGkA2f9f/1v/cf9+/3b/\
//6A/hD+p/1g/ZL91v0U/kH+/f2t/XX9Pv0w/Zn9CP51/rz+kv5s/lL+QP43/jT+N/4//k7+Yv56/pb+t/7a/gH/KP9T/37/qv/X/wQALABZAIQArQDVAPsA\
GgFMAekBiAIPA4cD6wNCBIUEuQTdBPME9wTwBHYExQMlA4MC5wFSAb0AMgCn/0P/Vv9l/3b/Wv/U/lr+6f2E/S795Pyj/HP8Q/xm/Ob8V/3I/TH+mP7z/lz/\
jf9U/yL//P7e/sb+tP6n/qP+oP76/pL/FgCOAPsAYAG3AQoC8QGcAVkBGQHZAPwAVgGQAdABuAFJAe0AkwA/APH/qf9l/yr/9f7C/pf+dv5S/lz+zv5G/7L/\
EgBtALwADQEtAd4AjwBJAAkAz/+b/2r/Qf8b//n+3f7G/rX+qf6g/p3+oP6l/q/+vf7P/uP++/4T/zL/T/9z/4r/0f+HACYBtgE2AqkCCwNmA5IDRgPvAqEC\
SgIgAlwCjAKtAsMCzQLOAsYCswKaAncCUQIUAmQBpQD4/1P/vP4z/rD9Of3R/HX8KPzm+7X7iPuq+y/8pPwk/V39Pf0z/TD9Of1K/WL9gf2n/dH9Av41/m/+\
pP74/rX/dwAtAawBtgG6AcQBwwHnAXAC8QJcA7YDAQQ/BGsEigSbBJ4EkwR7BFgELATyA7IDAgMlAl0BmgDj/zb/lP4E/nX9Af0K/TH9T/1u/Y79rv3S/en9\
lP0w/eb8o/yA/NT8RP2o/Qv+a/7I/h3/dP/H/xMAWQCeAH4AJQDh/6L/b/88/xL/8f7P/s3+Ov+y/yMAaQA8AA0A6//E/8T/NwClAAcBXQGqAewBKQJKAvQB\
iwEwAdgAhgA6APD/sf9t/2v/zP8XAGYAYgAKAMP/hf9G/zP/mf/t/0EAYQASAM3/j/9c/y//A//g/sT+qP7o/m7/2/9GAEMACgDl/8H/o/+M/3j/ZP9W/0z/\
Rv9D/0P/Rv9N/1b/Yf9v/37/kP+k/7j/zf/d/0cA8QB9Af8BcALWAigDeQN1AxEDuQJeAgcCsgFeAQoBuwBuACUA3/+g/17/Qv+W/+v/NAB0AKwA3AAGAScB\
RgFOAQABpgBVAAcAv/95/zr/AP/K/p7+dP5N/jH+Ev4s/oX+0/4n/0P/G/8C/+r+2f7N/sT+v/6//sH+yP7R/t/+6/4K/4H/+P9hAMIAGgFpAa8B6wEfAkgC\
bQJzAiQCywF6ASUB6gAAARgBJQErASwBJwEhAQsBogApAMH/Wf8M/xb/Kv84/0b/Uf9a/2T/a/9y/3n/fv+A/zj/2v6G/jv+/f3H/Zr9eP1Z/VT9pv0H/l7+\
tf4F/1L/o//m/9j/sv+c/4f/dv/G/yIAcQCsAI8AZwBIACsAEwD9/+j/1v/J/73/tP+t/6j/pf+l/6j/qv+y/7X/AQB2ANQALwE7ARgBAAHoANIABQFYAZcB\
zgH7ASECPQJQAhACrQFWAQABrgBhABgA0v+R/1b/av+f/8f/6/++/3P/OP8F/9T+/P5A/3b/ov94/0H/GP/u/s3+s/6d/o3+gv58/nv+fv6I/o/+x/4+/67/\
HgBXAEUAPgA3ADQAMQAvAC8AMAAyAH4A5wBAAY8B0wEPAkICaQKJAp8CrgK0ArECpgKVAn0CXwI5AhAC4gGvAXoBPgEKAaUAAABp/9/+W/4I/gr+Bv4H/t39\
dv0e/df8lfyU/Nv8GP1f/Wr9RP0w/Sb9If1e/dn9R/61/h7/fP/e/zoAjgDeACQBawGIAVYBJQH5ANAAqgCGAGMARAAmAAsA9P/e/8v/u/+w/6P/nf+T/6v/\
EwByAMcAFAFXAZQByAH2ARsCNQJOAkEC4QGDASoB1QCDADYA7P+r/2j/R/96/6b/0//c/5b/Vf8f/+/+wv6f/n7+aP5R/oD+4P4x/4n/kf9x/17/Tf86/3P/\
3f8vAIIAhgBeAEMAKAASAEgAngDiAB4BBQHNAKIAdwBTAH4AwwD4ACYBSwFsAYQBmQFhAf8ArABbABIAFwA9AFQAagB5AIYAjwCUAJcAlQCSAIwAgwB3AGsA\
XABMADsAKAAUAP//7P/V/8X/iP8O/6P+P/7k/cD96f0J/jP+L/7q/bX9jP1o/YL94P0z/of+1/4j/2v/t//8/z4AegCyAOUAFAE7AWQBWQEJAcEAggBAADIA\
aQCSAL0AswBkACEA4v+s/3r/Uv8o/wb/6f4Y/3D/uP/6/+f/vP+b/4f/aP+T//T/PgCHAMYAAAE0AWIBiQGpAcMB1wHlAe0B8AHrAeAB0wG+AaoBfgH/AH0A\
BwCX/zD/1v5//i/+6/2x/X79Vf02/SD9Ev0N/RD9HP0w/Uv9av2U/bv9E/6y/kD/zf8jADEASwBjAH0AmACxAMkA4wD1AEsBxwEsAocC1AIWA0wDdwOWA6oD\
swOyA6UDkQNyA04DEwOCAuQBUwHFAD4Av/9F/9T+cf4R/rr9bv0t/fT8Dv1T/Y79yv25/Y39dP1i/Vv9W/1i/XH9hv2h/cL95v0T/jz+iv4k/7H/PQC9ADIB\
nAEBAkgCMwIVAvoB3QHAAaIBggFjAUABIAH+ANwAvACcAH8AYABEACYAHQBlALAA7gAkAVEBeAGXAakBZQELAbwAbgAnAOP/o/9p/zD/D/9F/33/sP/J/5D/\
U/8h//j+0P6t/pL+e/5q/l/+WP5W/lr+ZP69/i7/mv/9/1gArAD4AD0BewGxAd0BAgLVAYMBPgH5ALkAxgDzAA4BJwE1AUEBRgFGAUIBOQEsARwBBwHwANMA\
vgB4AO//c/8F/5n+ZP59/ov+mv6n/rX+xf7V/uT++P71/sP+lf5x/lT+Pf4t/iL+Hf4a/kP+k/7c/h//Yf+j/+D/GgBPAIIAsADYAP0AHQE2AVABVQEiAeoA\
uQCGAGkAgACTAKcAnQBgACkA9f/G/5r/c/9P/zL/Ev8Z/0//eP+k/6n/hf9s/1b/Rf86/y7/Jf8j/x//V/+j/+D/FQAQAAAA9//v/+j/5f/i/+D/3v/g/+H/\
5P/m/+v/8P/2//v/BAAIACkAdgC4APYAKwFZAYEBowG9AdMB3wHqAd8BnAFUARABzgCPAFIAFgDh/6n/mv+z/8X/1f/h/+z/9v/8/wIABwAIAA0A7f+n/2r/\
Nf8A//P+FP8s/0r/Qv8V//D+z/60/sT+9/4m/1j/W/9C/y//If8U/yX/bv+n/+P//P/m/9j/zf/E/7//uv+3/7f/uP/t/zYAcQCnAKMAiwB7AGwAXwBQAEMA\
OAAtACMAGQARAAkAAwD8//r/9f/0/+7/EQBXAJAAxgDzABwBPQFfAVsBJwH4AMsAnQCTALEAxADUAN0A5ADlAOgAwwB1ADEA8P+0/3z/Sf8a//L+z/6s/pH+\
e/5r/l7+hf7H/vv+Of9F/zL/Kf8l/yH/VP+g/97/GQAZAAcA///2//P/JQBkAJkAxgC7AJ4AhgBvAF4AhAC0ANkA+QATAScBOQE/AQoBzACVAF0AKwD6/83/\
o/98/1j/O/8d/wj/9P7h/tb+zf7I/sb+yP7M/tT+4P7u/v7+EP8k/zr/Uv9r/4D/nP+1/+L/QgCYAOgAJgEoAR4BGgEQARUBTQGAAa0BvgGWAWwBQwEaAfIA\
ygCjAHwAVQAxAA0A7P/M/6//lP98/2b/U/9E/2z/pP/T//z/7f/M/7X/nv+M/3v/bv9j/1r/Uv9P/0z/Tv9L/3L/v//+/z0ASQA0ACkAHAASAAgAAAD4//D/\
6v/m/+H/3f/a/9r/2P/Y/9n/2f/b/97/4P/l/+X//v9GAIYAxADiAMoAtACfAIoAdwBjAE8APQAqABkACAD5/+v/4/8QAEcAdACcAL4A2gD0AAEB1ACdAGsA\
OwAPAOX/vv+b/3b/aP+Q/7P/1//k/7r/lP9z/1X/PP8m/xL/Bf/5/u/+6v7n/uj+7P4o/3b/uf/y//D/5P/e/9n/1v/V/9P/1v/U/+b/KwBuAKgA3AAJATIB\
UwFtAU8BGgHvAMIAmABvAEcAIAD8/9r/uv+c/4H/aP9T/0H/Mf8k/xr/Ff8R/w7/EP8S/xn/IP8t/zL/WP+z//v/RQBjAFYAUgBMAEcAQwA/ADsANwAzADAA\
LQAqACcAJAAhAB4AHAAaABgAFgAUABIAEAAPAA8ADgAPAAsAMgB4ALEA5QARATcBVQFyAXMBPwEKAdYApQB2AEgAGgDy/8j/y//v/wgAHwAwAEAATABXADUA\
8f+8/4j/Wf8w/wn/6v7O/rL+n/6P/oX+fP6D/sL+A/9H/3r/c/9p/2X/Yv9j/2b/a/9x/3r/hP+P/5v/qf+2//b/SQCQANEA1gDGAL0AsgCpANQADQE5AV8B\
fwGYAasBuAG+AcABuQG0AY0BNgHkAJUASgACAL7/fv9D/w3/3f60/oz+af5T/nz+qf7T/vr+3v7F/rb+qf6i/qH+ov6p/q3+0v4j/3D/vP8AAEIAewC1ANYA\
wQCqAJUAggBwAF4ATgA+AC8AIgAVAAkA///4/yYAYgCSAMAA5QAHASMBOgFMAVoBYQFlAWUBYAFWAUkBOQElARAB9gDbAL8AoACAAGAAPwAeAP3/3f++/4f/\
Ov/z/rb+f/5i/mj+bf51/n3+iP6V/qb+pP6G/m7+Xf5Q/mD+kP6//uz+GP9C/3D/mv/D/+v/EAAzAEAALQAfABIABgD8//T/7v/o/+T/4f/g/97/3v/h/+P/\
5//s/+///v8vAGMAkQC7AOAAAAEdATQBRwFWAWABZgFpAWYBYAFXAUoBOwEnARMB6wCkAF0AGgDb/6L/a/85/w7/5P7e/vL+AP8Q/wL/3/7G/rP+pv6+/ur+\
Df82/13/gf+m/8j/6f8IACQAQQBDACkAEwD//+3/+f8cADsAVgBtAIMAlQClAJcAcQBQADEAEgASACwAPQBOAEAAGgD6/9z/wf+r/5X/gf9x/2T/fP+l/8n/\
6v8HACMAPQBTAEYAJwAQAPn/5//4/xkAMwBLAGAAcwCCAI8AfABUADAADwDy//b/DQAfACwAFgDx/9L/tv+g/6z/yv/i//f/CwAdAC0AOwAqAAMA4//F/6v/\
lP9//23/Xv9S/0n/Qv8//zz/Sf+A/7D/3//1/+v/5f/i/93/8f8iAE4AdwCaALkA1gDtAAEBEgEfASYBKwEtASwBJgEbAe4ArwB2AD4AEAAGAAgABwD//9L/\
n/9y/0j/Kv8y/0b/Vv9m/3X/hP+T/5//iv9m/0v/M/8j/xP/Bf/+/vf+AP8t/2H/jv+7/+T/CwAwAFIAcQCNAKgAsgCYAHoAYABHADEAGwAHAPT/5P/U/8f/\
u/+x/6n/ov+e/5z/m/+a/7f/7P8ZAEQATwA/ADYALAAlADwAZwCJAKcAnwCGAHAAWwBHADYAIwAUAAIA+/8XADoAVgBxAIUAmACoALEAlwBtAEkAJgAKABMA\
JgA0ADkAGADw/83/rf+Q/3f/YP9M/zv/Lf8i/xv/Gf8Q/yL/Wv+I/7f/y//C/7v/t/+1/7X/t/+4/7z/wP/h/xgASAB0AJsAvwDeAPkAEAEiAS4BOQEkAfUA\
yQCfAHYAagB2AHsAfgBjADAAAgDW/7D/jP9p/0v/Mf8a/wb/+f7q/uD+2v7W/tf+2/7g/un+9P4D/xH/I/83/0v/YP9z/47/pv+9/9f/7f8cAGQApADfAPgA\
9QD0APEA7QDpAOIA2gDSAMkA4QAGASABNwEvAQoB5wDFAKMAnwCwALkAvgCgAG4AQgAWAO7/yP+k/4T/Zf9K/zP/Hf8M//v++f4f/0b/bP+E/3f/af9e/1f/\
Uv9P/0//UP9T/1j/X/9n/3H/ff+u/+v/IABOAFQATQBKAEYASQBtAJkAvwDcANAAuACiAIwAfgCTALAAwwDUAN4A5wDtAO4A7ADnAOAA1gDKALsAqwCYAIQA\
bwBZAEMALAAUAP3/5v/O/7n/ov+P/2P/IP/o/rf+hv53/oj+l/6n/rj+y/7f/vH+CP8f/zb/Tv9l/33/lP+s/8H/1v/r////CwDy/9T/uv+j/5j/s//U//L/\
AgDt/9f/xf+0/6f/nv+V/5H/i/+b/83/+P8lADgAKgAfABcADgAWAD8AaACLAKoAxgDdAPIA8wDSAK4AjQBtAFAANQAaAAAA6f/U/7//rv+e/5H/hv99/3b/\
cf9x/5f/yf/z/xsAPwBgAH4AmQCxAMUA1QDiAM8ApQB/AFoAOQAZAPr/3//E/7L/yP/j//n/DwAfADAAPgBKAFUAXQBkAGEAOwANAOX/v/+d/37/Y/9L/zb/\
I/8Y/xD/Ff8d/yn/Nf9L/3r/qP/U//L/9//8/wEACQAPABQAGwAiACYAKwAvADQAOAA7AD0AQQBBAEEASwBsAIoApAC5AMsA2ADlAOIAxQCqAI4AcgBZAD4A\
JgANAPX/3//L/7j/pv+V/4f/e/9w/2f/Yv95/5X/r//F/77/sv+q/6T/oP+c/5r/mP+Z/5r/nP+g/6P/qP+u/7X/u//D/8r/0//b/+P/6//1//z/BAANABQA\
GwAiACgALwAzADkAPQBAAEMARwBjAIUAoAC4AMwA2wDoAPAA2gC7AKAAhQBqAE8ANgAeAAQA9P/9/wkAEAAWABkAHAAeAB8AHgAcABoAFQD3/9H/sf+S/3v/\
f/+K/5L/mv+h/6j/r/+2/7z/w//I/87/vv+g/4r/dv9k/2z/gv+T/6X/tv/G/9X/4//x//3/CQAUAB4AJwAtADUAMAATAPf/4P/K/8T/0//h/+7/+f8DAAsA\
FQAOAPP/3f/I/7L/sP/E/9P/5P/k/9D/v/+x/6P/qv/E/9n/7v8BABMAIgAyAC8AGQAGAPf/5v/r/wEAFAAlADIAPwBKAFYAVgA9ACQADgD4/+7//f8JABcA\
FgD+/+j/1P/D/7X/p/+b/5L/iv+E/4D/ff99/37/gf+F/4r/kP+b/8D/6f8OAC0AMQAuAC0ALQAxAE8AbgCKAJsAkACDAHYAagBeAFIARwA8AC8AMQBIAFsA\
bAB6AIUAjQCUAJcAmgCaAJgAlACPAIgAfwB1AGoAXQBQAEQAJADz/8j/of98/3D/c/91/3f/ef98/3//gv+G/4r/j/+V/4b/av9W/0P/NP8o/yL/HP8Y/xb/\
MP9X/3n/mv+g/57/oP+j/6n/sP+3/8D/yf/T/9z/5//y//z/CAATAB4AJwAzAFYAgACkAMMA3wD3AAsBGwEoATEBNgE3ATYBMgEpAR4BEQEBAe8A3AC1AH4A\
SgAWAOf/u/+S/2v/R/8o/w7/9f7j/tD+xv7W/u3+B/8f/x//Fv8U/xb/F/87/2P/iP+o/6v/rf+y/7b/wv/o/w8AMwBOAE0ASQBIAEQASQBnAIMAmwCwAMEA\
zwDcANwAwgCmAI0AcgBhAGoAcAB1AG8ATgAuABEA9f/b/8P/rP+Z/4f/dv9p/17/Vv9O/13/ff+X/7H/s/+o/6P/n/+d/7P/1f/z/w4ADwAFAP7/+P/1//H/\
7f/q/+j/5//m/+b/5//n/+j/6//u/+//8v/2//n//P///wgAKQBMAGoAhQCeALEAwwDMALkAogCMAHUAZgBwAHsAggCGAIgAiACGAIMAfQB2AG4AZABBABQA\
7P/G/6T/hP9n/07/Nv8k/y//Qf9S/17/UP9B/zb/Lf8o/yX/JP8n/y3/Mv85/0P/UP9b/3f/qf/V/wIAGgAbACEAJwAtADIAOAA9AEIARwBkAIkApwC+ALgA\
qwCgAJQAhwB7AG8AYgBUAE4AYQByAIEAhgBwAFYAPwAqAB4AKQA0AD4AOwAeAAQA7P/V/8v/2f/l//D/+v8CAAgADwATABcAGQAbABsAAwDh/8T/qv+U/5r/\
p/+x/7j/pv+P/33/bP9i/3P/i/+g/7H/p/+Z/4//h/+C/37/fP98/33/gP+F/4n/kf+X/7X/4f8GACoASgBoAIMAnACbAIwAfwBzAGYAcQCHAJUApACuALUA\
uQC9AKwAiABoAEgAKgAiACgAKgAsABYA8//U/7r/oP+J/3P/df+H/5b/pf+z/8D/zf/Z/+T/7//4/wEACQAQABYAGwAgACQAJgAnACkAKQAoACcAJQAiAB8A\
GwAWAAgA8//h/8//wP+z/6b/mv+R/4z/kv+c/6X/qv+k/57/mv+X/5r/p/+2/8X/z//P/8z/y//M/83/zv/Q/9L/1v/Z/93/4f/l/+v/7v/0//j//P8EABQA\
KAA6AEkAVgBhAG0AdQB8AIAAhQCFAIUAhACCAHoAawBUAEAALQAZAAcA9f/l/9b/y//M/8//0f/S/9X/1v/Y/9r/2//d/9//3//V/8j/vP+y/6n/ov+c/5j/\
lP+X/6T/s//C/8//3P/o//X/+//3//P/8P/s/+v/6v/o/+n/6P/o/+n/6v/r/+3/7//x//T/9v/6/wcAGAApADgARQBQAFoAYwBhAFgATgBEADsAMgAoACAA\
FwAOAAUAAAD4//D/6v/k/9//2v/X/9z/5//z//3//v/3//L/7f/n/+X/4v/f/9z/3P/m//T/AQALAAsABQAAAPz/+P/1//L/7//t/+v/6f/o/+j/6P/v//7/\
DQAZABwAFwARAA4ACgAMABgAIgAsADQAOgBAAEUASABKAEsASwBGADgAJQAVAAYA/P/7//7//v////7//f/9//j/5//Z/8r/vP+x/6f/oP+Y/5L/lf+g/6z/\
uP++/7r/tf+z/7T/tP+0/7X/uf+8/7//xP/J/8//2P/r/wAAFAAlADUARABRAFgAVQBPAEkAQwBAAEgAUABWAFkAUQBEADcALAAhABYACwAAAPf/7v/m/97/\
1//Q/8v/x//D/8D/wP/K/9j/5v/v/+7/6f/l/+L/4P/f/97/3v/e/+L/8f8AAA4AGwAmADEAOQA+ADgALgAlAB0AFgANAAcAAAD6//P/7f/o/+X/4P/c/9v/\
2P/W/9T/1P/U/9X/1f/d/+z//P8JABEADgALAAgABgAEAAIAAAD+//3//P/7//r/+f/5/wIAEQAfACsANAA9AEUASwBJAD0AMgAnAB0AEwAJAAAA9//u/+b/\
4P/Z/9P/z//K/8b/xP/B/8D/v/++/77/wP/B/8P/xv/J/83/0f/V/9n/3v/i/+f/7P/x//b/+////wQACAAQAB8AMQBCAE0ATQBHAEMAQAA7ADYAMQAtACcA\
IgAcABcAEwANAAcAAwD9//n/9P/5/wQADgAXABcADgAFAP7/+P/x/+r/5f/g/9v/2P/U/9H/z//R/97/7P/4//3/+f/1//D/7f/p/+b/5P/i/+D/4P/f/9//\
3//g/+r/+v8IABUAFwASAA0ACgAIABAAHAAmAC0AKgAhABkAEQALABAAGQAgACQAHQASAAcA/f/2//f///8EAAoADgASABQAFgAYABkAGQAXAA4A/f/u/+D/\
1P/T/9f/3P/f/9j/y//B/7j/sf+2/7//yP/P/8z/xf/A/7r/uv/D/9D/3f/p//T///8JABIAGgAhACgALQAyADYAOQA7AD0APQA9ADwANAAkABIAAwD0/+z/\
7//x//L/7f/e/9L/xv+8/7T/rP+m/6H/nv+j/7H/v//M/9j/5P/w//v/BQAPABgAIAAiABoAEgAKAAIA/P/2//D/7P/n/+z/+f8EAAwADQAGAP//+f/1//v/\
BgAQABoAIgAoAC4AMwAwACQAGAAOAAUABAALABEAFQAZABwAHgAfABgACQD8/+//5P/a/9D/yP/B/73/w//O/9j/4f/q//L/+v8BAAcADgATABgAHAAgACMA\
JQAnACgAKAAoACcAJgAkACIAIAAcABkAFQARAA4ACgAFAAEA/f/5//X/8P/s/+n/5f/i/+D/2//a/9j/1v/U/9P/0v/R/9H/0f/R/9P/0v/U/9X/1//Y/9r/\
3f/e/+H/4//m/+n/6//t//D/8v/1//j/+v/8//3///8BAAMABAAFAAYABwAHAAgACAAIAAkACAAHAAgABwAGAAUABQAFAAMAAgABAAAA///+//3/+//7//n/\
+f/3//b/9v/1//T/8//z//P/8v/y//H/8v/y//L/8//z//P/8//z//T/9f/1//X/9//2//f/+P/4//n/+v/6//v//P/9//3//v////7//v8AAAAAAAAAAAIA\
AAAAAAAAAQABAAEAAQABAAEAAAAAAAAA//////7//v/+//7//f/9//3//f/8//v/+//7//v/+v/6//r/+f/6//n/+f/6//j/+P/5//n/+P/5//n/+P/4//n/\
+P/4//j/+f/5//n/+f/6//r/+v/6//r/+v/7//v/+//7//v/+//7//z/+//8//z/+//8//z//P/8//z//P/8//z//P/9//3//P/8//z//P/7//z//P/7//v/\
+v/7//v/+//7//v/+//7//v/+//8//z//P/6//v//P/7//v/+//7//v/+//7//v/+//7//z/+//8//z//P/7//z//P/7//z//P/7//z//P/8//z//P/8//z/\
/P/8//z//P/7//z/+//7//z/+//7//v/+//7//v/+//7//v/+v/7//z//P/6//v/+//7//v/+//7//v/+//6//r//P/7//r/+v/7//r/+//7//v/+//8//r/\
+//7//z//P/7//v/+//7//z//P/7//z//P/8//z//P/8//z//P/8//z//P/8//z//P/8//z//P/8//z//P/8//v//P/9//z/+//7//z/+//8//z//P/8//z/\
/P/8//z/+//8//v//P/8//z//P/8//z/+//8//v/+//8//v/+//8//v/+//7//v/+//7//v/+//6//v/\
').split('').map(c => c.charCodeAt(0))).buffer);

/*
 *
 *	Xevious
 *
 */

const url = 'xevious.zip';
let BG2, BG4, OBJ4, OBJ8, BGCOLOR_H, BGCOLOR_L, OBJCOLOR_H, OBJCOLOR_L, RED, GREEN, BLUE, SND, PRG1, PRG2, PRG3, MAPTBL, MAPDATA;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG1 = new Uint8Array((zip.files['xvi_1.3p'].inflate() + zip.files['xvi_2.3m'].inflate() + zip.files['xvi_3.2m'].inflate() + zip.files['xvi_4.2l'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	PRG2 = new Uint8Array((zip.files['xvi_5.3f'].inflate() + zip.files['xvi_6.3j'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	PRG3 = new Uint8Array(zip.files['xvi_7.2c'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	BG2 = new Uint8Array(zip.files['xvi_12.3b'].inflate().split('').map(c => c.charCodeAt(0)));
	BG4 = new Uint8Array((zip.files['xvi_13.3c'].inflate() + zip.files['xvi_14.3d'].inflate()).split('').map(c => c.charCodeAt(0)));
	OBJ8 = new Uint8Array((zip.files['xvi_15.4m'].inflate() + zip.files['xvi_17.4p'].inflate() + zip.files['xvi_18.4r'].inflate()).split('').map(c => c.charCodeAt(0)));
	OBJ4 = new Uint8Array(zip.files['xvi_16.4n'].inflate().split('').map(c => c.charCodeAt(0)));
	MAPTBL = new Uint8Array((zip.files['xvi_9.2a'].inflate() + zip.files['xvi_10.2b'].inflate()).split('').map(c => c.charCodeAt(0)));
	MAPDATA = new Uint8Array(zip.files['xvi_11.2c'].inflate().split('').map(c => c.charCodeAt(0)));
	RED = new Uint8Array(zip.files['xvi-8.6a'].inflate().split('').map(c => c.charCodeAt(0)));
	GREEN = new Uint8Array(zip.files['xvi-9.6d'].inflate().split('').map(c => c.charCodeAt(0)));
	BLUE = new Uint8Array(zip.files['xvi-10.6e'].inflate().split('').map(c => c.charCodeAt(0)));
	BGCOLOR_L = new Uint8Array(zip.files['xvi-7.4h'].inflate().split('').map(c => c.charCodeAt(0)));
	BGCOLOR_H = new Uint8Array(zip.files['xvi-6.4f'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJCOLOR_L = new Uint8Array(zip.files['xvi-4.3l'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJCOLOR_H = new Uint8Array(zip.files['xvi-5.3m'].inflate().split('').map(c => c.charCodeAt(0)));
	SND = new Uint8Array(zip.files['xvi-2.7n'].inflate().split('').map(c => c.charCodeAt(0)));
	init({
		game: game = new Xevious(),
		sound: sound = [
			new PacManSound({SND, resolution: 2}),
			new SoundEffect({se: game.se, freq: 11025, gain: 8}),
		],
	});
	loop();
}

