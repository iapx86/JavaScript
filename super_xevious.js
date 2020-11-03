/*
 *
 *	Super Xevious
 *
 */

import PacManSound from './pac-man_sound.js';
import Namco54XX from './namco_54xx.js';
import Cpu, {init, read} from './main.js';
import Z80 from './z80.js';
let game, sound;

class SuperXevious {
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
	fCoin = false;
	fStart1P = false;
	fStart2P = false;
	dwStick = 0;
	dwStickPrev = 0;
	dwCoin = 0;
	nSolvalou = 3;
	nRank = 'NORMAL';
	nBonus = 'A';

	fInterruptEnable = false;
	fNmiEnable = false;
	fSoundEnable = false;
	ram = new Uint8Array(0x4000).addBase();
	mmi = new Uint8Array(0x100).fill(0xff);
	mmo = new Uint8Array(0x100);
	count = 0;
	mapreg = new Uint8Array(0x100);
	mapaddr = 0;
	dmaport = new Uint8Array(0x100);
	ioport = new Uint8Array(0x100);
	keyport = 0;
	keytbl = Uint8Array.of(8, 0, 2, 1, 4, 8, 3, 8, 6, 7, 8, 8, 5, 8, 8, 8);

	maptbl = new Uint16Array(0x8000);
	mapatr = new Uint8Array(0x8000);

	bg2 = new Uint8Array(0x8000);
	bg4 = new Uint8Array(0x8000);
	obj4 = new Uint8Array(0x10000);
	obj8 = new Uint8Array(0x10000);
	bgcolor = Uint8Array.from(BGCOLOR_H, (e, i) => BGCOLOR_H[i] << 4 & 0x70 | BGCOLOR_L[i] & 0xf);
	objcolor = Uint8Array.from(OBJCOLOR_H, (e, i) => OBJCOLOR_H[i] << 4 & 0xf0 | OBJCOLOR_L[i] & 0xf);
	rgb = new Uint32Array(0x100);
	dwScroll = 0xff;

	cpu = [new Z80(), new Z80(), new Z80()];

	constructor() {
		// CPU周りの初期化
		this.ioport[0] = 0x00;
		this.ioport[1] = 0xf8;
		this.ioport[2] = 0xf8;

		const range = (page, start, end = start, mirror = 0) => (page & ~mirror) >= start && (page & ~mirror) <= end;

		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0x3f))
				this.cpu[0].memorymap[page].base = PRG1.base[page & 0x3f];
			else if (range(page, 0x68)) {
				this.cpu[0].memorymap[page].base = this.mmi;
				this.cpu[0].memorymap[page].write = (addr, data) => {
					switch (addr & 0xf0) {
					case 0x00:
					case 0x10:
						break;
					case 0x20:
						switch (addr & 0x0f) {
						case 0:
							this.fInterruptEnable = (data & 1) !== 0;
							break;
						case 1:
							break;
						case 2:
							if (data)
								this.cpu[1].enable(), this.cpu[2].enable();
							else
								this.cpu[1].disable(), this.cpu[2].disable();
							break;
						case 3:
							this.fSoundEnable = (data & 1) !== 0;
							break;
						}
						// fallthrough
					default:
						this.mmo[addr & 0xff] = data;
						break;
					}
				};
			} else if (range(page, 0x70)) {
				this.cpu[0].memorymap[page].base = this.ioport;
				this.cpu[0].memorymap[page].write = (addr, data) => {
					if ((this.dmaport[0] & 8) !== 0)
						sound[1].write(data);
					switch (this.dmaport[0]) {
					case 0x64: // keyctrl
						switch (data) {
						case 0x80:
							return void(this.keyport = 5);
						case 0xe5:
							return void(this.keyport = 0x95);
						}
					}
				};
			} else if (range(page, 0x71)) {
				this.cpu[0].memorymap[page].base = this.dmaport;
				this.cpu[0].memorymap[page].write = (addr, data) => {
					this.dmaport[addr & 0xff] = data;
					switch (data) {
					case 0x10:
						this.fNmiEnable = false;
						return;
					case 0x71:
						this.ioport[0] = this.dwCoin / 10 << 4 | this.dwCoin % 10;
						this.ioport[1] = this.keytbl[this.dwStick & 0x0f] | 0x30;
						this.mmi[0] |= 1;
						if ((this.dwStick & 0x10) !== 0) {
							this.ioport[1] &= 0xdf;
							if ((this.dwStickPrev & 0x10) === 0)
								this.ioport[1] &= 0xef;
						}
						if ((this.dwStick & 0x20) !== 0)
							this.mmi[0] &= 0xfe;
						this.dwStickPrev = this.dwStick;
						break;
					case 0x74:
						this.ioport[3] = this.keyport;
						break;
					default:
						this.dmaport[addr & 0xff] = data;
						break;
					}
					this.fNmiEnable = true;
				};
			} else if (range(page, 0x78, 0x7f)) {
				this.cpu[0].memorymap[page].base = this.ram.base[page & 7];
				this.cpu[0].memorymap[page].write = null;
			} else if (range(page, 0x80, 0x87)) {
				this.cpu[0].memorymap[page].base = this.ram.base[8 | page & 7];
				this.cpu[0].memorymap[page].write = null;
			} else if (range(page, 0x90, 0x97)) {
				this.cpu[0].memorymap[page].base = this.ram.base[0x10 | page & 7];
				this.cpu[0].memorymap[page].write = null;
			} else if (range(page, 0xa0, 0xa7)) {
				this.cpu[0].memorymap[page].base = this.ram.base[0x18 | page & 7];
				this.cpu[0].memorymap[page].write = null;
			} else if (range(page, 0xb0, 0xbf)) {
				this.cpu[0].memorymap[page].base = this.ram.base[0x20 | page & 0xf];
				this.cpu[0].memorymap[page].write = null;
			} else if (range(page, 0xc0, 0xcf)) {
				this.cpu[0].memorymap[page].base = this.ram.base[0x30 | page & 0xf];
				this.cpu[0].memorymap[page].write = null;
			} else if (range(page, 0xd0))
				this.cpu[0].memorymap[page].write = (addr, data) => {
					switch (addr & 0xff) {
					case 0:
						return void(this.dwScroll = data);
					case 1:
						return void(this.dwScroll = data | 0x100);
					}
				};
			else if (range(page, 0xf0)) {
				this.cpu[0].memorymap[page].base = this.mapreg;
				this.cpu[0].memorymap[page].write = (addr, data) => {
					switch (addr & 0xff) {
					case 0:
						this.mapaddr = this.mapaddr & 0x7f00 | data;
						break;
					case 1:
						this.mapaddr = this.mapaddr & 0xff | data << 8 & 0x7f00;
						break;
					default:
						return;
					}
					let ptr = this.maptbl[this.mapaddr], x = this.mapatr[this.mapaddr];
					x ^= MAPDATA[ptr] >> 1 & 0x40 | MAPDATA[ptr] << 1 & 0x80;
					this.mapreg[0] = MAPDATA[ptr] & 0x3f | x;
					this.mapreg[1] = MAPDATA[0x800 + ptr];
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
			switch (addr & 0xf0) {
			case 0x00:
			case 0x10:
				return sound[0].write(addr, data, this.count);
			case 0x20:
				return;
			default:
				return void(this.mmo[addr & 0xff] = data);
			}
		}, fetch: null};

		// DIPSW SETUP
		this.mmi.fill(3, 0, 7);
		this.mmi[7] = 2;

		this.convertMAP();

		// Videoの初期化
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();
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
				this.mmi[5] &= ~2, this.mmi[6] |= 2;
				break;
			case 2:
				this.mmi[5] |= 2, this.mmi[6] &= ~2;
				break;
			case 3:
				this.mmi[5] |= 2, this.mmi[6] |= 2;
				break;
			case 5:
				this.mmi[5] &= ~2, this.mmi[6] &= ~2;
				break;
			}
			switch (this.nRank) {
			case 'EASY':
				this.mmi[5] &= ~1, this.mmi[6] |= 1;
				break;
			case 'NORMAL':
				this.mmi[5] |= 1, this.mmi[6] |= 1;
				break;
			case 'HARD':
				this.mmi[5] |= 1, this.mmi[6] &= ~1;
				break;
			case 'VERY HARD':
				this.mmi[5] &= ~1, this.mmi[6] &= ~1;
				break;
			}
			switch (this.nBonus) {
			case 'A':
				this.mmi[2] |= 2, this.mmi[3] |= 2, this.mmi[4] |= 2;
				break;
			case 'B':
				this.mmi[2] &= ~2, this.mmi[3] |= 2, this.mmi[4] |= 2;
				break;
			case 'C':
				this.mmi[2] |= 2, this.mmi[3] &= ~2, this.mmi[4] |= 2;
				break;
			case 'D':
				this.mmi[2] &= ~2, this.mmi[3] &= ~2, this.mmi[4] |= 2;
				break;
			case 'E':
				this.mmi[2] |= 2, this.mmi[3] |= 2, this.mmi[4] &= ~2;
				break;
			case 'F':
				this.mmi[2] &= ~2, this.mmi[3] |= 2, this.mmi[4] &= ~2;
				break;
			case 'G':
				this.mmi[2] |= 2, this.mmi[3] &= ~2, this.mmi[4] &= ~2;
				break;
			case 'NONE':
				this.mmi[2] &= ~2, this.mmi[3] &= ~2, this.mmi[4] &= ~2;
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
			this.rgb[i] = (RED[i] & 0xf) * 255 / 15	// Red
				| (GREEN[i] & 0xf) * 255 / 15 << 8	// Green
				| (BLUE[i] & 0xf) * 255 / 15 << 16	// Blue
				| 0xff000000;						// Alpha
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
		// bg4描画
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

		// bg2描画
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
 *	Super Xevious
 *
 */

let BG2, BG4, OBJ4, OBJ8, BGCOLOR_H, BGCOLOR_L, OBJCOLOR_H, OBJCOLOR_L, RED, GREEN, BLUE, SND, PRG1, PRG2, PRG3, MAPTBL, MAPDATA;

read('xevious.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG1 = Uint8Array.concat(...['sxeviousj/xv3_1.3p', 'sxeviousj/xv3_2.3m', 'sxevious/xv3_3.2m', 'sxevious/xv3_4.2l'].map(e => zip.decompress(e))).addBase();
	PRG2 = Uint8Array.concat(...['sxevious/xv3_5.3f', 'sxevious/xv3_6.3j'].map(e => zip.decompress(e))).addBase();
	PRG3 = zip.decompress('xvi_7.2c').addBase();
	BG2 = zip.decompress('xvi_12.3b');
	BG4 = Uint8Array.concat(...['xvi_13.3c', 'xvi_14.3d'].map(e => zip.decompress(e)));
	OBJ8 = Uint8Array.concat(...['xvi_15.4m', 'xvi_17.4p', 'xvi_18.4r'].map(e => zip.decompress(e)));
	OBJ4 = zip.decompress('xvi_16.4n');
	MAPTBL = Uint8Array.concat(...['xvi_9.2a', 'xvi_10.2b'].map(e => zip.decompress(e)));
	MAPDATA = zip.decompress('xvi_11.2c');
	RED = zip.decompress('xvi-8.6a');
	GREEN = zip.decompress('xvi-9.6d');
	BLUE = zip.decompress('xvi-10.6e');
	BGCOLOR_L = zip.decompress('xvi-7.4h');
	BGCOLOR_H = zip.decompress('xvi-6.4f');
	OBJCOLOR_L = zip.decompress('xvi-4.3l');
	OBJCOLOR_H = zip.decompress('xvi-5.3m');
	SND = zip.decompress('xvi-2.7n');
	game = new SuperXevious();
	sound = [
		new PacManSound({SND, resolution: 2}),
		new Namco54XX({clock: 1536000}),
	];
	canvas.addEventListener('click', () => game.coin());
	init({game, sound});
});

