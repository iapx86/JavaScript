/*
 *
 *	Gaplus
 *
 */

import MappySound from './mappy_sound.js';
import Namco62XX from './namco_62xx.js';
import Cpu, {init, read} from './main.js';
import MC6809 from './mc6809.js';
let game, sound;

class Gaplus {
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
	nMyShip = 3;
	nRank = '0';
	nBonus = 'A';
	fAttract = true;

	fPortTest = false;
	fInterruptEnable0 = false;
	fInterruptEnable1 = false;
	fInterruptEnable2 = false;
	ram = new Uint8Array(0x2000).addBase();
	port = new Uint8Array(0x40);
	in = Uint8Array.of(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4);
	edge = 0xf;
	starport = new Uint8Array(0x100);

	stars = [];
	stars0 = [];
	stars1 = [];
	stars2 = [];
	bg = new Uint8Array(0x4000);
	obj4 = new Uint8Array(0x10000);
	obj8 = new Uint8Array(0x10000);
	bgcolor = Uint8Array.from(BGCOLOR, e => 0xf0 | e & 0xf);
	objcolor = Uint8Array.from(OBJCOLOR_H, (e, i) => OBJCOLOR_H[i] << 4 & 0xf0 | OBJCOLOR_L[i] & 0xf);
	rgb = new Uint32Array(0x140);
	dwCount = 0;

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
			this.cpu.memorymap[0x60 + i].read = addr => sound[0].read(addr);
			this.cpu.memorymap[0x60 + i].write = (addr, data) => sound[0].write(addr, data);
		}
		this.cpu.memorymap[0x68].read = addr => this.port[addr & 0x3f] | 0xf0;
		this.cpu.memorymap[0x68].write = (addr, data) => {
			this.port[addr & 0x3f] = data & 0xf;
			(addr & 0x38) === 0x28 && (sound[1].mcu.cause |= 4);
		};
		this.cpu.memorymap[0x74].write = () => void(this.fInterruptEnable0 = true);
		this.cpu.memorymap[0x7c].write = () => void(this.fInterruptEnable0 = false);
		this.cpu.memorymap[0x84].write = () => (this.cpu2.enable(), this.cpu3.enable());
		this.cpu.memorymap[0x8c].write = () => (this.cpu2.disable(), this.cpu3.disable());
		this.cpu.memorymap[0x94].write = () => void(this.fPortTest = false);
		this.cpu.memorymap[0x9c].write = () => void(this.fPortTest = true);
		for (let i = 0; i < 0x60; i++)
			this.cpu.memorymap[0xa0 + i].base = PRG1.base[i];
		this.cpu.memorymap[0xa0].write = (addr, data) => void(this.starport[addr & 0xff] = data);

		for (let i = 0; i < 0x20; i++) {
			this.cpu2.memorymap[i].base = this.ram.base[i];
			this.cpu2.memorymap[i].write = null;
		}
		this.cpu2.memorymap[0x60].write = addr => {
			switch (addr & 0xff) {
			case 0x01: // INTERRUPT START
				return void(this.fInterruptEnable1 = true);
			case 0x80: // INTERRUPT STOP
				return void(this.fInterruptEnable1 = false);
			case 0x81: // INTERRUPT START
				return void(this.fInterruptEnable1 = true);
			}
		};
		for (let i = 0; i < 0x60; i++)
			this.cpu2.memorymap[0xa0 + i].base = PRG2.base[i];

		for (let i = 0; i < 4; i++) {
			this.cpu3.memorymap[i].read = addr => sound[0].read(addr);
			this.cpu3.memorymap[i].write = (addr, data) => sound[0].write(addr, data);
		}
		this.cpu3.memorymap[0x40].write = () => void(this.fInterruptEnable2 = true);
		this.cpu3.memorymap[0x60].write = () => void(this.fInterruptEnable2 = false);
		for (let i = 0; i < 0x20; i++)
			this.cpu3.memorymap[0xe0 + i].base = PRG3.base[i];

		// Videoの初期化
		for (let i = 0; i < 256; i++)
			this.stars.push({x: 0, y: 0, color: 0, blk: 0});
		for (let i = 0; i < 64; i++)
			this.stars0.push({x: 0, y: 0, color: 0, blk: 0});
		for (let i = 0; i < 32; i++)
			this.stars1.push({x: 0, y: 0, color: 0, blk: 0});
		for (let i = 0; i < 64; i++)
			this.stars2.push({x: 0, y: 0, color: 0, blk: 0});
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();
		this.initializeStar();
	}

	execute() {
		if (this.fInterruptEnable0)
			this.cpu.interrupt();
		if (this.fInterruptEnable1)
			this.cpu2.interrupt();
		if (this.fInterruptEnable2)
			this.cpu3.interrupt();
		Cpu.multiple_execute([this.cpu, this.cpu2, this.cpu3], 0x2000);
		this.moveStars();
		return this;
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// DIPスイッチの更新
		if (this.fDIPSwitchChanged) {
			this.fDIPSwitchChanged = false;
			switch (this.nMyShip) {
			case 3:
				this.in[5] &= ~0xc;
				break;
			case 2:
				this.in[5] = this.in[5] & ~0xc | 4;
				break;
			case 4:
				this.in[5] = this.in[5] & ~0xc | 8;
				break;
			case 5:
				this.in[5] |= 0xc;
				break;
			}
			switch (this.nRank) {
			case '0':
				this.in[7] &= ~7;
				break;
			case '1':
				this.in[7] = this.in[7] & ~7 | 1;
				break;
			case '2':
				this.in[7] = this.in[7] & ~7 | 2;
				break;
			case '3':
				this.in[7] = this.in[7] & ~7 | 3;
				break;
			case '4':
				this.in[7] = this.in[7] & ~7 | 4;
				break;
			case '5':
				this.in[7] = this.in[7] & ~7 | 5;
				break;
			case '6':
				this.in[7] = this.in[7] & ~7 | 6;
				break;
			case '7':
				this.in[7] |= 7;
				break;
			}
			switch (this.nBonus) {
			case 'A':
				this.in[6] &= ~7;
				break;
			case 'B':
				this.in[6] = this.in[6] & ~7 | 1;
				break;
			case 'C':
				this.in[6] = this.in[6] & ~7 | 2;
				break;
			case 'D':
				this.in[6] = this.in[6] & ~7 | 3;
				break;
			case 'E':
				this.in[6] = this.in[6] & ~7 | 4;
				break;
			case 'F':
				this.in[6] = this.in[6] & ~7 | 5;
				break;
			case 'G':
				this.in[6] = this.in[6] & ~7 | 6;
				break;
			case 'H':
				this.in[6] |= 7;
				break;
			}
			if (this.fAttract)
				this.in[8] &= ~8;
			else
				this.in[8] |= 8;
//			if (this.fSelect)
//				this.in[6] |= 8;
//			else
//				this.in[6] &= ~8;
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.in[7] |= 8;
		else
			this.in[7] &= ~8;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.port.fill(0);
			sound[1].reset();
			this.cpu.reset();
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
			this.port.set(this.in.subarray(0, 4));
		else if (this.port[8] === 4) {
			// クレジット/スタートボタン処理
			let credit = this.port[0] * 10 + this.port[1];
			if (this.fCoin && credit < 150)
				this.port[2] += 1, credit = Math.min(credit + 1, 99);
			if (!this.port[9] && this.fStart1P && credit > 0)
				this.port[3] += 1, credit -= (credit < 150);
			if (!this.port[9] && this.fStart2P && credit > 1)
				this.port[3] += 2, credit -= (credit < 150) * 2;
			this.port[0] = credit / 10, this.port[1] = credit % 10;
			this.port.set([this.in[1], this.in[3] << 1 & 0xa | this.edge & 5, this.in[2], this.in[3] & 0xa | this.edge >> 1 & 5], 4);
		} else if (this.port[8] === 8)
			this.port[0] = 6, this.port[1] = 9;
		if (this.port[0x18] === 4)
			this.port.set([this.in[5], this.in[9], this.in[6], this.in[6], this.in[7], this.in[7], this.in[8], this.in[8]], 0x10);
		else if (this.port[0x18] === 5)
			this.port[0x10] = 0xf, this.port[0x11] = 0xf;
		sound[1].mcu.k = this.in[10], sound[1].param(this.port.subarray(0x20, 0x30));
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
		for (let i = 0; i < 0x100; i++)
			this.rgb[i] = (RED[i] & 0xf) * 255 / 15	// Red
				| (GREEN[i] & 0xf) * 255 / 15 << 8	// Green
				| (BLUE[i] & 0xf) * 255 / 15 << 16	// Blue
				| 0xff000000;						// Alpha
		for (let i = 0; i < 0x40; i++)
			this.rgb[0x100 | i] = (i << 1 & 6) * 255 / 7	// Red
				| (i >> 1 & 6) * 255 / 7 << 8				// Green
				| (i >> 4) * 255 / 3 << 16					// Blue
				| 0xff000000;								// Alpha
	}

	convertBG() {
		for (let p = 0, q = 0, i = 128; i !== 0; q += 32, --i) {
			for (let j = 7; j >= 0; --j)
				this.bg[p++] = BG[q + j + 16] >> 1 & 1 | BG[q + j + 16] >> 2 & 2;
			for (let j = 7; j >= 0; --j)
				this.bg[p++] = BG[q + j + 16] & 1 | BG[q + j + 16] >> 1 & 2;
			for (let j = 7; j >= 0; --j)
				this.bg[p++] = BG[q + j + 24] >> 1 & 1 | BG[q + j + 24] >> 2 & 2;
			for (let j = 7; j >= 0; --j)
				this.bg[p++] = BG[q + j + 24] & 1 | BG[q + j + 24] >> 1 & 2;
			for (let j = 7; j >= 0; --j)
				this.bg[p++] = BG[q + j] >> 1 & 1 | BG[q + j] >> 2 & 2;
			for (let j = 7; j >= 0; --j)
				this.bg[p++] = BG[q + j] & 1 | BG[q + j] >> 1 & 2;
			for (let j = 7; j >= 0; --j)
				this.bg[p++] = BG[q + j + 8] >> 1 & 1 | BG[q + j + 8] >> 2 & 2;
			for (let j = 7; j >= 0; --j)
				this.bg[p++] = BG[q + j + 8] & 1 | BG[q + j + 8] >> 1 & 2;
		}
		for (let p = 0x2000, q = 0, i = 128; i !== 0; q += 32, --i) {
			for (let j = 7; j >= 0; --j)
				this.bg[p++] = BG[q + j + 16] >> 5 & 1 | BG[q + j + 16] >> 6 & 2;
			for (let j = 7; j >= 0; --j)
				this.bg[p++] = BG[q + j + 16] >> 4 & 1 | BG[q + j + 16] >> 5 & 2;
			for (let j = 7; j >= 0; --j)
				this.bg[p++] = BG[q + j + 24] >> 5 & 1 | BG[q + j + 24] >> 6 & 2;
			for (let j = 7; j >= 0; --j)
				this.bg[p++] = BG[q + j + 24] >> 4 & 1 | BG[q + j + 24] >> 5 & 2;
			for (let j = 7; j >= 0; --j)
				this.bg[p++] = BG[q + j] >> 5 & 1 | BG[q + j] >> 6 & 2;
			for (let j = 7; j >= 0; --j)
				this.bg[p++] = BG[q + j] >> 4 & 1 | BG[q + j] >> 5 & 2;
			for (let j = 7; j >= 0; --j)
				this.bg[p++] = BG[q + j + 8] >> 5 & 1 | BG[q + j + 8] >> 6 & 2;
			for (let j = 7; j >= 0; --j)
				this.bg[p++] = BG[q + j + 8] >> 4 & 1 | BG[q + j + 8] >> 5 & 2;
		}
	}

	convertOBJ() {
		this.obj4.fill(3);
		for (let p = 0, q = 0, i = 128; i !== 0; q += 64, --i) {
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
					this.obj8[p++] = OBJ8[q + k + 32] >> j & 1 | OBJ8[q + k + 32] >> (j + 3) & 2 | OBJ8[q + k + 0x4000 + 32] >> (j + 2) & 4;
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k] >> j & 1 | OBJ8[q + k] >> (j + 3) & 2 | OBJ8[q + k + 0x4000] >> (j + 2) & 4;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 40] >> j & 1 | OBJ8[q + k + 40] >> (j + 3) & 2 | OBJ8[q + k + 0x4000 + 40] >> (j + 2) & 4;
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 8] >> j & 1 | OBJ8[q + k + 8] >> (j + 3) & 2 | OBJ8[q + k + 0x4000 + 8] >> (j + 2) & 4;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 48] >> j & 1 | OBJ8[q + k + 48] >> (j + 3) & 2 | OBJ8[q + k + 0x4000 + 48] >> (j + 2) & 4;
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 16] >> j & 1 | OBJ8[q + k + 16] >> (j + 3) & 2 | OBJ8[q + k + 0x4000 + 16] >> (j + 2) & 4;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 56] >> j & 1 | OBJ8[q + k + 56] >> (j + 3) & 2 | OBJ8[q + k + 0x4000 + 56] >> (j + 2) & 4;
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 24] >> j & 1 | OBJ8[q + k + 24] >> (j + 3) & 2 | OBJ8[q + k + 0x4000 + 24] >> (j + 2) & 4;
			}
		}
		for (let p = 0x8000, q = 0x2000, i = 128; i !== 0; q += 64, --i) {
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 32] >> j & 1 | OBJ8[q + k + 32] >> (j + 3) & 2 | OBJ8[q + k + 0x2000 + 32] << 2 >> j & 4;
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k] >> j & 1 | OBJ8[q + k] >> (j + 3) & 2 | OBJ8[q + k + 0x2000] << 2 >> j & 4;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 40] >> j & 1 | OBJ8[q + k + 40] >> (j + 3) & 2 | OBJ8[q + k + 0x2000 + 40] << 2 >> j & 4;
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 8] >> j & 1 | OBJ8[q + k + 8] >> (j + 3) & 2 | OBJ8[q + k + 0x2000 + 8] << 2 >> j & 4;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 48] >> j & 1 | OBJ8[q + k + 48] >> (j + 3) & 2 | OBJ8[q + k + 0x2000 + 48] << 2 >> j & 4;
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 16] >> j & 1 | OBJ8[q + k + 16] >> (j + 3) & 2 | OBJ8[q + k + 0x2000 + 16] << 2 >> j & 4;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 56] >> j & 1 | OBJ8[q + k + 56] >> (j + 3) & 2 | OBJ8[q + k + 0x2000 + 56] << 2 >> j & 4;
				for (let k = 7; k >= 0; --k)
					this.obj8[p++] = OBJ8[q + k + 24] >> j & 1 | OBJ8[q + k + 24] >> (j + 3) & 2 | OBJ8[q + k + 0x2000 + 24] << 2 >> j & 4;
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
					this.stars[i].blk = sr >> 11 & 0x01 | sr >> 8 & 0x02;
					i++;
				}
			}
		}

		for (let i = 0, j = 0; i < 256; j++, i += 4) {
			this.stars0[j] = this.stars[i];
			if ((this.stars0[j].color & 3) === 2 || (this.stars0[j].color & 3) === 3)
				--this.stars0[j].color;
			if ((this.stars0[j].color & 0x0c) === 8 || (this.stars0[j].color & 0x0c) === 0x0c)
				this.stars0[j].color -= 4;
			if ((this.stars0[j].color & 0x30) === 0x20 || (this.stars0[j].color & 0x30) === 0x30)
				this.stars0[j].color -= 0x10;
		}
		for (let i = 1, j = 0; i < 256; j++, i += 8) {
			this.stars1[j] = this.stars[i];
			if ((this.stars1[j].color & 3) === 1 || (this.stars1[j].color & 3) === 2)
				this.stars1[j].color++;
			if ((this.stars1[j].color & 0x0c) === 4 || (this.stars1[j].color & 0x0c) === 8)
				this.stars1[j].color += 4;
			if ((this.stars1[j].color & 0x30) === 0x10 || (this.stars1[j].color & 0x30) === 0x20)
				this.stars1[j].color += 0x10;
		}
		for (let i = 2, j = 0; i < 256; j++, i += 4)
			this.stars2[j] = this.stars[i];
	}

	moveStars() {
		this.dwCount++;

		// star 1
		for (let i = 0; i < 32 && this.stars1[i].color; i++) {
			this.stars1[i].y += 3 - (this.starport[2] & 7 ^ 4);
			if (this.stars1[i].y >= 0x120) {
				this.stars1[i].y -= 0x120;
				if (--this.stars1[i].x < 0)
					this.stars1[i].x += 0xe0;
			} else if (this.stars1[i].y < 0) {
				this.stars1[i].y += 0x120;
				if (++this.stars1[i].x >= 0xe0)
					this.stars1[i].x -= 0xe0;
			}
			this.stars1[i].x += (this.starport[2] >> 3 & 7 ^ 4) - 4;
			if (this.stars1[i].x >= 0xe0)
				this.stars1[i].x -= 0xe0;
			else if (this.stars1[i].x < 0)
				this.stars1[i].x += 0xe0;
		}

		// star 2
		for (let i = 0; i < 64 && this.stars2[i].color; i++) {
			this.stars2[i].y += 3 - (this.starport[3] & 7 ^ 4);
			if (this.stars2[i].y >= 0x120) {
				this.stars2[i].y -= 0x120;
				if (--this.stars2[i].x < 0)
					this.stars2[i].x += 0xe0;
			} else if (this.stars2[i].y < 0) {
				this.stars2[i].y += 0x120;
				if (++this.stars2[i].x >= 0xe0)
					this.stars2[i].x -= 0xe0;
			}
			this.stars2[i].x += (this.starport[3] >> 3 & 7 ^ 4) - 4;
			if (this.stars2[i].x >= 0xe0)
				this.stars2[i].x -= 0xe0;
			else if (this.stars2[i].x < 0)
				this.stars2[i].x += 0xe0;
		}

		// star 0
		for (let i = 0; i < 64 && this.stars0[i].color; i++) {
			this.stars0[i].y += 3 - (this.starport[1] & 7 ^ 4);
			if (this.stars0[i].y >= 0x120) {
				this.stars0[i].y -= 0x120;
				if (--this.stars0[i].x < 0)
					this.stars0[i].x += 0xe0;
			} else if (this.stars0[i].y < 0) {
				this.stars0[i].y += 0x120;
				if (++this.stars0[i].x >= 0xe0)
					this.stars0[i].x -= 0xe0;
			}
			this.stars0[i].x += (this.starport[1] >> 3 & 7 ^ 4) - 4;
			if (this.stars0[i].x >= 0xe0)
				this.stars0[i].x -= 0xe0;
			else if (this.stars0[i].x < 0)
				this.stars0[i].x += 0xe0;
		}
	}

	makeBitmap(data) {
		// 画面クリア
		let p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256, i++)
			data.fill(0xff, p, p + 224);

		// bg描画
		this.drawBG(data, 0);

		// obj描画
		for (let k = 0x0f80, i = 64; i !== 0; k += 2, --i) {
			if ((this.ram[k + 0x1001] & 0x80) === 0)
				continue;
			const x = this.ram[k + 0x800] + 8 & 0xff;
			const y = (this.ram[k + 0x801] | this.ram[k + 0x1001] << 8) - 0x37 & 0x1ff;
			const src = this.ram[k] | this.ram[k + 1] << 8;
			switch (this.ram[k + 0x1000] & 0xeb) {
			case 0x00: // ノーマル
			case 0x80:
				this.xfer16x16x3(data, x | y << 8, src);
				break;
			case 0x01: // V反転
			case 0x81:
				this.xfer16x16x3V(data, x | y << 8, src);
				break;
			case 0x02: // H反転
			case 0x82:
				this.xfer16x16x3H(data, x | y << 8, src);
				break;
			case 0x03: // HV反転
			case 0x83:
				this.xfer16x16x3HV(data, x | y << 8, src);
				break;
			case 0x08: // ノーマル
				this.xfer16x16x3(data, x | y << 8, src & ~1);
				this.xfer16x16x3(data, x | (y + 16 & 0x1ff) << 8, src | 1);
				break;
			case 0x09: // V反転
				this.xfer16x16x3V(data, x | y << 8, src | 1);
				this.xfer16x16x3V(data, x | (y + 16 & 0x1ff) << 8, src & ~1);
				break;
			case 0x0a: // H反転
				this.xfer16x16x3H(data, x | y << 8, src & ~1);
				this.xfer16x16x3H(data, x | (y + 16 & 0x1ff) << 8, src | 1);
				break;
			case 0x0b: // HV反転
				this.xfer16x16x3HV(data, x | y << 8, src | 1);
				this.xfer16x16x3HV(data, x | (y + 16 & 0x1ff) << 8, src & ~1);
				break;
			case 0x20: // ノーマル
				this.xfer16x16x3(data, x | y << 8, src | 2);
				this.xfer16x16x3(data, x + 16 & 0xff | y << 8, src & ~2);
				break;
			case 0x21: // V反転
				this.xfer16x16x3V(data, x | y << 8, src | 2);
				this.xfer16x16x3V(data, x + 16 & 0xff | y << 8, src & ~2);
				break;
			case 0x22: // H反転
				this.xfer16x16x3H(data, x | y << 8, src & ~2);
				this.xfer16x16x3H(data, x + 16 & 0xff | y << 8, src | 2);
				break;
			case 0x23: // HV反転
				this.xfer16x16x3HV(data, x | y << 8, src & ~2);
				this.xfer16x16x3HV(data, x + 16 & 0xff | y << 8, src | 2);
				break;
			case 0x28: // ノーマル
				this.xfer16x16x3(data, x | y << 8, src & ~3 | 2);
				this.xfer16x16x3(data, x | (y + 16 & 0x1ff) << 8, src | 3);
				this.xfer16x16x3(data, x + 16 & 0xff | y << 8, src & ~3);
				this.xfer16x16x3(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3 | 1);
				break;
			case 0x29: // V反転
				this.xfer16x16x3V(data, x | y << 8, src | 3);
				this.xfer16x16x3V(data, x | (y + 16 & 0x1ff) << 8, src & ~3 | 2);
				this.xfer16x16x3V(data, x + 16 & 0xff | y << 8, src & ~3 | 1);
				this.xfer16x16x3V(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3);
				break;
			case 0x2a: // H反転
				this.xfer16x16x3H(data, x | y << 8, src & ~3);
				this.xfer16x16x3H(data, x | (y + 16 & 0x1ff) << 8, src & ~3 | 1);
				this.xfer16x16x3H(data, x + 16 & 0xff | y << 8, src & ~3 | 2);
				this.xfer16x16x3H(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src | 3);
				break;
			case 0x2b: // HV反転
				this.xfer16x16x3HV(data, x | y << 8, src & ~3 | 1);
				this.xfer16x16x3HV(data, x | (y + 16 & 0x1ff) << 8, src & ~3);
				this.xfer16x16x3HV(data, x + 16 & 0xff | y << 8, src | 3);
				this.xfer16x16x3HV(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3 | 2);
				break;
			case 0x40: // ノーマル
			case 0xc0:
				this.xfer16x16x2(data, x | y << 8, src);
				break;
			case 0x41: // V反転
			case 0xc1:
				this.xfer16x16x2V(data, x | y << 8, src);
				break;
			case 0x42: // H反転
			case 0xc2:
				this.xfer16x16x2H(data, x | y << 8, src);
				break;
			case 0x43: // HV反転
			case 0xc3:
				this.xfer16x16x2HV(data, x | y << 8, src);
				break;
			case 0x48: // ノーマル
				this.xfer16x16x2(data, x | y << 8, src & ~1);
				this.xfer16x16x2(data, x | (y + 16 & 0x1ff) << 8, src | 1);
				break;
			case 0x49: // V反転
				this.xfer16x16x2V(data, x | y << 8, src | 1);
				this.xfer16x16x2V(data, x | (y + 16 & 0x1ff) << 8, src & ~1);
				break;
			case 0x4a: // H反転
				this.xfer16x16x2H(data, x | y << 8, src & ~1);
				this.xfer16x16x2H(data, x | (y + 16 & 0x1ff) << 8, src | 1);
				break;
			case 0x4b: // HV反転
				this.xfer16x16x2HV(data, x | y << 8, src | 1);
				this.xfer16x16x2HV(data, x | (y + 16 & 0x1ff) << 8, src & ~1);
				break;
			case 0x60: // ノーマル
				this.xfer16x16x2(data, x | y << 8, src | 2);
				this.xfer16x16x2(data, x + 16 & 0xff | y << 8, src & ~2);
				break;
			case 0x61: // V反転
				this.xfer16x16x2V(data, x | y << 8, src | 2);
				this.xfer16x16x2V(data, x + 16 & 0xff | y << 8, src & ~2);
				break;
			case 0x62: // H反転
				this.xfer16x16x2H(data, x | y << 8, src & ~2);
				this.xfer16x16x2H(data, x + 16 & 0xff | y << 8, src | 2);
				break;
			case 0x63: // HV反転
				this.xfer16x16x2HV(data, x | y << 8, src & ~2);
				this.xfer16x16x2HV(data, x + 16 & 0xff | y << 8, src | 2);
				break;
			case 0x68: // ノーマル
				this.xfer16x16x2(data, x | y << 8, src & ~3 | 2);
				this.xfer16x16x2(data, x | (y + 16 & 0x1ff) << 8, src | 3);
				this.xfer16x16x2(data, x + 16 & 0xff | y << 8, src & ~3);
				this.xfer16x16x2(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3 | 1);
				break;
			case 0x69: // V反転
				this.xfer16x16x2V(data, x | y << 8, src | 3);
				this.xfer16x16x2V(data, x | (y + 16 & 0x1ff) << 8, src & ~3 | 2);
				this.xfer16x16x2V(data, x + 16 & 0xff | y << 8, src & ~3 | 1);
				this.xfer16x16x2V(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3);
				break;
			case 0x6a: // H反転
				this.xfer16x16x2H(data, x | y << 8, src & ~3);
				this.xfer16x16x2H(data, x | (y + 16 & 0x1ff) << 8, src & ~3 | 1);
				this.xfer16x16x2H(data, x + 16 & 0xff | y << 8, src & ~3 | 2);
				this.xfer16x16x2H(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src | 3);
				break;
			case 0x6b: // HV反転
				this.xfer16x16x2HV(data, x | y << 8, src & ~3 | 1);
				this.xfer16x16x2HV(data, x | (y + 16 & 0x1ff) << 8, src & ~3);
				this.xfer16x16x2HV(data, x + 16 & 0xff | y << 8, src | 3);
				this.xfer16x16x2HV(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3 | 2);
				break;
			case 0x88: // ノーマル
				this.xfer16x16x3(data, x | y << 8, src);
				this.xfer16x16x3(data, x | (y + 16 & 0x1ff) << 8, src);
				break;
			case 0x89: // V反転
				this.xfer16x16x3V(data, x | y << 8, src);
				this.xfer16x16x3V(data, x | (y + 16 & 0x1ff) << 8, src);
				break;
			case 0x8a: // H反転
				this.xfer16x16x3H(data, x | y << 8, src);
				this.xfer16x16x3H(data, x | (y + 16 & 0x1ff) << 8, src);
				break;
			case 0x8b: // HV反転
				this.xfer16x16x3HV(data, x | y << 8, src);
				this.xfer16x16x3HV(data, x | (y + 16 & 0x1ff) << 8, src);
				break;
			case 0xa0: // ノーマル
				this.xfer16x16x3(data, x | y << 8, src);
				this.xfer16x16x3(data, x + 16 & 0xff | y << 8, src);
				break;
			case 0xa1: // V反転
				this.xfer16x16x3V(data, x | y << 8, src);
				this.xfer16x16x3V(data, x + 16 & 0xff | y << 8, src);
				break;
			case 0xa2: // H反転
				this.xfer16x16x3H(data, x | y << 8, src);
				this.xfer16x16x3H(data, x + 16 & 0xff | y << 8, src);
				break;
			case 0xa3: // HV反転
				this.xfer16x16x3HV(data, x | y << 8, src);
				this.xfer16x16x3HV(data, x + 16 & 0xff | y << 8, src);
				break;
			case 0xa8: // ノーマル
				this.xfer16x16x3(data, x | y << 8, src);
				this.xfer16x16x3(data, x | (y + 16 & 0x1ff) << 8, src);
				this.xfer16x16x3(data, x + 16 & 0xff | y << 8, src);
				this.xfer16x16x3(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src);
				break;
			case 0xa9: // V反転
				this.xfer16x16x3V(data, x | y << 8, src);
				this.xfer16x16x3V(data, x | (y + 16 & 0x1ff) << 8, src);
				this.xfer16x16x3V(data, x + 16 & 0xff | y << 8, src);
				this.xfer16x16x3V(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src);
				break;
			case 0xaa: // H反転
				this.xfer16x16x3H(data, x | y << 8, src);
				this.xfer16x16x3H(data, x | (y + 16 & 0x1ff) << 8, src);
				this.xfer16x16x3H(data, x + 16 & 0xff | y << 8, src);
				this.xfer16x16x3H(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src);
				break;
			case 0xab: // HV反転
				this.xfer16x16x3HV(data, x | y << 8, src);
				this.xfer16x16x3HV(data, x | (y + 16 & 0x1ff) << 8, src);
				this.xfer16x16x3HV(data, x + 16 & 0xff | y << 8, src);
				this.xfer16x16x3HV(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src);
				break;
			case 0xc8: // ノーマル
				this.xfer16x16x2(data, x | y << 8, src);
				this.xfer16x16x2(data, x | (y + 16 & 0x1ff) << 8, src);
				break;
			case 0xc9: // V反転
				this.xfer16x16x2V(data, x | y << 8, src);
				this.xfer16x16x2V(data, x | (y + 16 & 0x1ff) << 8, src);
				break;
			case 0xca: // H反転
				this.xfer16x16x2H(data, x | y << 8, src);
				this.xfer16x16x2H(data, x | (y + 16 & 0x1ff) << 8, src);
				break;
			case 0xcb: // HV反転
				this.xfer16x16x2HV(data, x | y << 8, src);
				this.xfer16x16x2HV(data, x | (y + 16 & 0x1ff) << 8, src);
				break;
			case 0xe0: // ノーマル
				this.xfer16x16x2(data, x | y << 8, src);
				this.xfer16x16x2(data, x + 16 & 0xff | y << 8, src);
				break;
			case 0xe1: // V反転
				this.xfer16x16x2V(data, x | y << 8, src);
				this.xfer16x16x2V(data, x + 16 & 0xff | y << 8, src);
				break;
			case 0xe2: // H反転
				this.xfer16x16x2H(data, x | y << 8, src);
				this.xfer16x16x2H(data, x + 16 & 0xff | y << 8, src);
				break;
			case 0xe3: // HV反転
				this.xfer16x16x2HV(data, x | y << 8, src);
				this.xfer16x16x2HV(data, x + 16 & 0xff | y << 8, src);
				break;
			case 0xe8: // ノーマル
				this.xfer16x16x2(data, x | y << 8, src);
				this.xfer16x16x2(data, x | (y + 16 & 0x1ff) << 8, src);
				this.xfer16x16x2(data, x + 16 & 0xff | y << 8, src);
				this.xfer16x16x2(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src);
				break;
			case 0xe9: // V反転
				this.xfer16x16x2V(data, x | y << 8, src);
				this.xfer16x16x2V(data, x | (y + 16 & 0x1ff) << 8, src);
				this.xfer16x16x2V(data, x + 16 & 0xff | y << 8, src);
				this.xfer16x16x2V(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src);
				break;
			case 0xea: // H反転
				this.xfer16x16x2H(data, x | y << 8, src);
				this.xfer16x16x2H(data, x | (y + 16 & 0x1ff) << 8, src);
				this.xfer16x16x2H(data, x + 16 & 0xff | y << 8, src);
				this.xfer16x16x2H(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src);
				break;
			case 0xeb: // HV反転
				this.xfer16x16x2HV(data, x | y << 8, src);
				this.xfer16x16x2HV(data, x | (y + 16 & 0x1ff) << 8, src);
				this.xfer16x16x2HV(data, x + 16 & 0xff | y << 8, src);
				this.xfer16x16x2HV(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src);
				break;
			}
		}

		// bg描画
		this.drawBG(data, 1);

		p = 256 * 16 + 16;

		// star 1描画
		for (let i = 0; i < 32 && this.stars1[i].color; i++) {
			const x = this.stars1[i].x, y = this.stars1[i].y;
			if ((this.starport[0] & 2) === 0 || y < 0x10 || y >= 0x110)
				continue;
			if (data[p + (x | y << 8)] === 0xff)
				data[p + (x | y << 8)] = 0x100 | this.stars1[i].color;
		}

		// star 2描画
		for (let i = 0; i < 64 && this.stars2[i].color; i++) {
			const x = this.stars2[i].x, y = this.stars2[i].y;
			if ((this.starport[0] & 8) === 0 || y < 0x10 || y >= 0x110)
				continue;
			if (this.starport[3] & 0x80 && this.stars2[i].blk === (this.dwCount >> 1 & 3))
				continue;
			if (data[p + (x | y << 8)] === 0xff)
				data[p + (x | y << 8)] = 0x100 | this.stars2[i].color;
		}

		// star 0描画
		for (let i = 0; i < 64 && this.stars0[i].color; i++) {
			const x = this.stars0[i].x, y = this.stars0[i].y;
			if ((this.starport[0] & 4) === 0 || y < 0x10 || y >= 0x110)
				continue;
			if (data[p + (x | y << 8)] === 0xff)
				data[p + (x | y << 8)] = 0x100 | this.stars0[i].color;
		}

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
		const q = (this.ram[k] & 0x7f | this.ram[k + 0x400] & 0x80) << 6, idx = this.ram[k + 0x400] << 2 & 0xfc;
		let px;

		if ((this.ram[k + 0x400] >> 6 & 1) !== pri)
			return;
		if ((px = this.bgcolor[idx | this.bg[q | 0x00]]) !== 0xff) data[p + 0x000] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x01]]) !== 0xff) data[p + 0x001] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x02]]) !== 0xff) data[p + 0x002] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x03]]) !== 0xff) data[p + 0x003] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x04]]) !== 0xff) data[p + 0x004] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x05]]) !== 0xff) data[p + 0x005] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x06]]) !== 0xff) data[p + 0x006] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x07]]) !== 0xff) data[p + 0x007] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x08]]) !== 0xff) data[p + 0x100] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x09]]) !== 0xff) data[p + 0x101] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x0a]]) !== 0xff) data[p + 0x102] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x0b]]) !== 0xff) data[p + 0x103] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x0c]]) !== 0xff) data[p + 0x104] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x0d]]) !== 0xff) data[p + 0x105] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x0e]]) !== 0xff) data[p + 0x106] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x0f]]) !== 0xff) data[p + 0x107] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x10]]) !== 0xff) data[p + 0x200] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x11]]) !== 0xff) data[p + 0x201] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x12]]) !== 0xff) data[p + 0x202] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x13]]) !== 0xff) data[p + 0x203] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x14]]) !== 0xff) data[p + 0x204] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x15]]) !== 0xff) data[p + 0x205] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x16]]) !== 0xff) data[p + 0x206] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x17]]) !== 0xff) data[p + 0x207] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x18]]) !== 0xff) data[p + 0x300] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x19]]) !== 0xff) data[p + 0x301] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x1a]]) !== 0xff) data[p + 0x302] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x1b]]) !== 0xff) data[p + 0x303] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x1c]]) !== 0xff) data[p + 0x304] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x1d]]) !== 0xff) data[p + 0x305] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x1e]]) !== 0xff) data[p + 0x306] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x1f]]) !== 0xff) data[p + 0x307] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x20]]) !== 0xff) data[p + 0x400] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x21]]) !== 0xff) data[p + 0x401] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x22]]) !== 0xff) data[p + 0x402] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x23]]) !== 0xff) data[p + 0x403] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x24]]) !== 0xff) data[p + 0x404] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x25]]) !== 0xff) data[p + 0x405] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x26]]) !== 0xff) data[p + 0x406] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x27]]) !== 0xff) data[p + 0x407] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x28]]) !== 0xff) data[p + 0x500] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x29]]) !== 0xff) data[p + 0x501] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x2a]]) !== 0xff) data[p + 0x502] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x2b]]) !== 0xff) data[p + 0x503] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x2c]]) !== 0xff) data[p + 0x504] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x2d]]) !== 0xff) data[p + 0x505] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x2e]]) !== 0xff) data[p + 0x506] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x2f]]) !== 0xff) data[p + 0x507] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x30]]) !== 0xff) data[p + 0x600] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x31]]) !== 0xff) data[p + 0x601] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x32]]) !== 0xff) data[p + 0x602] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x33]]) !== 0xff) data[p + 0x603] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x34]]) !== 0xff) data[p + 0x604] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x35]]) !== 0xff) data[p + 0x605] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x36]]) !== 0xff) data[p + 0x606] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x37]]) !== 0xff) data[p + 0x607] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x38]]) !== 0xff) data[p + 0x700] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x39]]) !== 0xff) data[p + 0x701] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x3a]]) !== 0xff) data[p + 0x702] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x3b]]) !== 0xff) data[p + 0x703] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x3c]]) !== 0xff) data[p + 0x704] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x3d]]) !== 0xff) data[p + 0x705] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x3e]]) !== 0xff) data[p + 0x706] = px;
		if ((px = this.bgcolor[idx | this.bg[q | 0x3f]]) !== 0xff) data[p + 0x707] = px;
	}

	xfer16x16x3(data, dst, src) {
		const idx = src >> 5 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0xff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj8[src++]]) !== 0xff)
					data[dst] = px;
	}

	xfer16x16x3V(data, dst, src) {
		const idx = src >> 5 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj8[src++]]) !== 0xff)
					data[dst] = px;
	}

	xfer16x16x3H(data, dst, src) {
		const idx = src >> 5 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj8[--src]]) !== 0xff)
					data[dst] = px;
	}

	xfer16x16x3HV(data, dst, src) {
		const idx = src >> 5 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj8[--src]]) !== 0xff)
					data[dst] = px;
	}

	xfer16x16x2(data, dst, src) {
		const idx = src >> 5 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0xff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj4[src++]]) !== 0xff)
					data[dst] = px;
	}

	xfer16x16x2V(data, dst, src) {
		const idx = src >> 5 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj4[src++]]) !== 0xff)
					data[dst] = px;
	}

	xfer16x16x2H(data, dst, src) {
		const idx = src >> 5 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj4[--src]]) !== 0xff)
					data[dst] = px;
	}

	xfer16x16x2HV(data, dst, src) {
		const idx = src >> 5 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj4[--src]]) !== 0xff)
					data[dst] = px;
	}
}

/*
 *
 *	Gaplus
 *
 */

let SND, BGCOLOR, OBJCOLOR_H, OBJCOLOR_L, RED, BLUE, GREEN, BG, OBJ4, OBJ8, PRG1, PRG2, PRG3, PRG;

read('gaplus.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG1 = Uint8Array.concat(...['gp2-4.8d', 'gp2-3b.8c', 'gp2-2b.8b'].map(e => zip.decompress(e))).addBase();
	PRG2 = Uint8Array.concat(...['gp2-8.11d', 'gp2-7.11c', 'gp2-6.11b'].map(e => zip.decompress(e))).addBase();
	PRG3 = zip.decompress('gp2-1.4b').addBase();
	BG = zip.decompress('gp2-5.8s');
	OBJ8 = Uint8Array.concat(...['gp2-11.11p', 'gp2-10.11n', 'gp2-9.11m'].map(e => zip.decompress(e)));
	OBJ4 = zip.decompress('gp2-12.11r');
	RED = zip.decompress('gp2-3.1p');
	GREEN = zip.decompress('gp2-1.1n');
	BLUE = zip.decompress('gp2-2.2n');
	BGCOLOR = zip.decompress('gp2-7.6s');
	OBJCOLOR_L = zip.decompress('gp2-6.6p');
	OBJCOLOR_H = zip.decompress('gp2-5.6n');
	SND = zip.decompress('gp2-4.3f');
}).then(() => read('namco62.zip')).then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG = zip.decompress('62xx.bin');
	game = new Gaplus();
	sound = [
		new MappySound({SND}),
		new Namco62XX({PRG, clock: 1536000}),
	];
	canvas.addEventListener('click', () => game.coin());
	init({game, sound});
});

