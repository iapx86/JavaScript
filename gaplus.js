/*
 *
 *	Gaplus
 *
 */

import MappySound from './mappy_sound.js';
import SoundEffect from './sound_effect.js';
import Cpu, {init, loop} from './main.js';
import MC6809 from './mc6809.js';
let game, sound;

class Gaplus {
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
		this.nMyShip = 3;
		this.nRank = '0';
		this.nBonus = 'A';
		this.fAttract = true;

		// CPU周りの初期化
		this.fInterruptEnable0 = false;
		this.fInterruptEnable1 = false;
		this.fInterruptEnable2 = false;

		this.ram = new Uint8Array(0x2500).addBase();
		this.port = new Uint8Array(0x40);
		this.starport = new Uint8Array(0x100);
		this.port[0x20] = 4; // UPRIGHT

		this.cpu = new MC6809(this);
		for (let i = 0; i < 0x08; i++) {
			this.cpu.memorymap[i].base = this.ram.base[i];
			this.cpu.memorymap[i].write = null;
		}
		for (let i = 0; i < 0x18; i++) {
			this.cpu.memorymap[0x08 + i].base = this.ram.base[8 + i];
			this.cpu.memorymap[0x08 + i].write = null;
		}
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0x60 + i].read = addr => sound[0].read(addr);
			this.cpu.memorymap[0x60 + i].write = (addr, data) => sound[0].write(addr, data);
		}
		this.cpu.memorymap[0x68].base = this.ram.base[0x24];
		this.cpu.memorymap[0x68].write = (addr, data) => {
			if (addr === 0x682a && this.ram[0x2428] !== 4 && (data - this.ram[0x2429] - 1 & 0x0f) === 0)
				this.se[0].start = this.se[0].stop = true;
			this.ram[0x2400 | addr & 0xff] = data;
		};
		this.cpu.memorymap[0x74].write = () => this.fInterruptEnable0 = true;
		this.cpu.memorymap[0x7c].write = () => this.fInterruptEnable0 = false;
		this.cpu.memorymap[0x84].write = () => {
			this.cpu2.enable();
			this.cpu3.enable();
		};
		this.cpu.memorymap[0x8c].write = () => {
			this.cpu2.disable();
			this.cpu3.disable();
		};
		for (let i = 0; i < 0x60; i++)
			this.cpu.memorymap[0xa0 + i].base = PRG1.base[i];
		this.cpu.memorymap[0xa0].write = (addr, data) => this.starport[addr & 0xff] = data;

		this.cpu2 = new MC6809(this);
		for (let i = 0; i < 0x08; i++) {
			this.cpu2.memorymap[i].base = this.ram.base[i];
			this.cpu2.memorymap[i].write = null;
		}
		for (let i = 0; i < 0x18; i++) {
			this.cpu2.memorymap[0x08 + i].base = this.ram.base[8 + i];
			this.cpu2.memorymap[0x08 + i].write = null;
		}
		this.cpu2.memorymap[0x60].write = addr => {
			switch (addr & 0xff) {
			case 0x01: // INTERRUPT START
				this.fInterruptEnable1 = true;
				break;
			case 0x80: // INTERRUPT STOP
				this.fInterruptEnable1 = false;
				break;
			case 0x81: // INTERRUPT START
				this.fInterruptEnable1 = true;
				break;
			}
		};
		for (let i = 0; i < 0x60; i++)
			this.cpu2.memorymap[0xa0 + i].base = PRG2.base[i];

		this.cpu3 = new MC6809(this);
		for (let i = 0; i < 4; i++) {
			this.cpu3.memorymap[i].read = addr => sound[0].read(addr);
			this.cpu3.memorymap[i].write = (addr, data) => sound[0].write(addr, data);
		}
		this.cpu3.memorymap[0x40].write = () => this.fInterruptEnable2 = true;
		this.cpu3.memorymap[0x60].write = () => this.fInterruptEnable2 = false;
		for (let i = 0; i < 0x20; i++)
			this.cpu3.memorymap[0xe0 + i].base = PRG3.base[i];

		// Videoの初期化
		this.stars = [];
		for (let i = 0; i < 256; i++)
			this.stars.push({x: 0, y: 0, color: 0, blk: 0});
		this.stars0 = [];
		for (let i = 0; i < 64; i++)
			this.stars0.push({x: 0, y: 0, color: 0, blk: 0});
		this.stars1 = [];
		for (let i = 0; i < 32; i++)
			this.stars1.push({x: 0, y: 0, color: 0, blk: 0});
		this.stars2 = [];
		for (let i = 0; i < 64; i++)
			this.stars2.push({x: 0, y: 0, color: 0, blk: 0});
		this.bg = new Uint8Array(0x4000);
		this.obj4 = new Uint8Array(0x10000);
		this.obj8 = new Uint8Array(0x10000);
		this.bgcolor = Uint8Array.from(BGCOLOR, e => 0xf0 | e & 0xf);
		this.objcolor = Uint8Array.from(OBJCOLOR_H, (e, i) => OBJCOLOR_H[i] << 4 & 0xf0 | OBJCOLOR_L[i] & 0xf);
		this.rgb = new Uint32Array(0x140);
		this.dwCount = 0;
		this.convertRGB();
		this.convertBG();
		this.convertOBJ4();
		this.convertOBJ8();
		this.initializeStar();

		// 効果音の初期化
		this.se = [{buf: BANG, loop: false, start: false, stop: false}];
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
				this.port[0x11] &= ~0x0c;
				break;
			case 2:
				this.port[0x11] = this.port[0x11] & ~0x0c | 4;
				break;
			case 4:
				this.port[0x11] = this.port[0x11] & ~0x0c | 8;
				break;
			case 5:
				this.port[0x11] |= 0x0c;
				break;
			}
			switch (this.nRank) {
			case '0':
				this.port[0x14] &= ~7;
				break;
			case '1':
				this.port[0x14] = this.port[0x14] & ~7 | 1;
				break;
			case '2':
				this.port[0x14] = this.port[0x14] & ~7 | 2;
				break;
			case '3':
				this.port[0x14] = this.port[0x14] & ~7 | 3;
				break;
			case '4':
				this.port[0x14] = this.port[0x14] & ~7 | 4;
				break;
			case '5':
				this.port[0x14] = this.port[0x14] & ~7 | 5;
				break;
			case '6':
				this.port[0x14] = this.port[0x14] & ~7 | 6;
				break;
			case '7':
				this.port[0x14] |= 7;
				break;
			}
			switch (this.nBonus) {
			case 'A':
				this.port[0x12] &= ~7;
				break;
			case 'B':
				this.port[0x12] = this.port[0x12] & ~7 | 1;
				break;
			case 'C':
				this.port[0x12] = this.port[0x12] & ~7 | 2;
				break;
			case 'D':
				this.port[0x12] = this.port[0x12] & ~7 | 3;
				break;
			case 'E':
				this.port[0x12] = this.port[0x12] & ~7 | 4;
				break;
			case 'F':
				this.port[0x12] = this.port[0x12] & ~7 | 5;
				break;
			case 'G':
				this.port[0x12] = this.port[0x12] & ~7 | 6;
				break;
			case 'H':
				this.port[0x12] |= 7;
				break;
			}
			if (this.fAttract)
				this.port[0x17] &= ~8;
			else
				this.port[0x17] |= 8;
//			if (this.fSelect)
//				this.port[0x12] |= 8;
//			else
//				this.port[0x12] &= ~8;
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.port[0x14] |= 8;
		else
			this.port[0x14] &= ~8;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.se[0].stop = true;
			this.ram.fill(0, 0x2400, 0x2500);
			this.cpu.reset();
		}
		return this;
	}

	updateInput() {
		let i;

		// クレジット/スタートボタン処理
		if (this.fCoin) {
			this.port[3] |= 4;
			switch (this.ram[0x2408]) {
			case 3:
				this.ram[0x2400]++;
				i = (this.ram[0x2402] & 0x0f) * 10 + (this.ram[0x2403] & 0x0f);
				if (i < 150) {
					i++;
					if (i > 99)
						i = 99;
					this.ram[0x2402] = i / 10;
					this.ram[0x2403] = i % 10;
				}
				break;
			case 4:
				this.ram[0x2402]++;
				i = (this.ram[0x2400] & 0x0f) * 10 + (this.ram[0x2401] & 0x0f);
				if (i < 150) {
					i++;
					if (i > 99)
						i = 99;
					this.ram[0x2400] = i / 10;
					this.ram[0x2401] = i % 10;
				}
				break;
			}
		}
		else
			this.port[3] &= ~4;
		if (this.fStart1P) {
			this.port[5] |= 4;
			if (!this.ram[0x2409]) {
				switch (this.ram[0x2408]) {
				case 3:
					i = (this.ram[0x2402] & 0x0f) * 10 + (this.ram[0x2403] & 0x0f);
					if (i > 0) {
						this.ram[0x2401] = 1;
						--i;
						this.ram[0x2402] = i / 10;
						this.ram[0x2403] = i % 10;
					}
					break;
				case 4:
					i = (this.ram[0x2400] & 0x0f) * 10 + (this.ram[0x2401] & 0x0f);
					if (i > 0) {
						this.ram[0x2403] = 1;
						--i;
						this.ram[0x2400] = i / 10;
						this.ram[0x2401] = i % 10;
					}
					break;
				}
			}
		}
		else
			this.port[5] &= ~4;
		if (this.fStart2P) {
			this.port[5] |= 8;
			if (!this.ram[0x2409]) {
				switch (this.ram[0x2408]) {
				case 3:
					i = (this.ram[0x2402] & 0x0f) * 10 + (this.ram[0x2403] & 0x0f);
					if (i > 1) {
						this.ram[0x2401] = 2;
						i -= 2;
						this.ram[0x2402] = i / 10;
						this.ram[0x2403] = i % 10;
					}
					break;
				case 4:
					i = (this.ram[0x2400] & 0x0f) * 10 + (this.ram[0x2401] & 0x0f);
					if (i > 1) {
						this.ram[0x2403] = 2;
						i -= 2;
						this.ram[0x2400] = i / 10;
						this.ram[0x2401] = i % 10;
					}
					break;
				}
			}
		}
		else
			this.port[5] &= ~8;
		this.fCoin = this.fStart1P = this.fStart2P = false;

		switch (this.ram[0x2408]) {
		case 0x01:
			this.ram[0x2400] = this.port[3];
			this.ram[0x2401] = this.port[4];
			this.ram[0x2403] = this.port[5];
			this.ram[0x2405] = this.port[3];
			this.ram[0x2406] = this.port[4];
			this.ram[0x2407] = this.port[5];
			break;
		case 0x03:
		case 0x04:
			this.ram[0x2404] = this.port[4];
			this.ram[0x2405] = this.port[5];
			break;
		case 0x05:
			this.ram[0x2400] = 0x0f;
			this.ram[0x2401] = 0x0f;
			break;
		case 0x08:
			this.ram[0x2400] = 6;
			this.ram[0x2401] = 9;
			break;
		}
		switch (this.ram[0x2418]) {
		case 0x01:
			this.ram[0x2410] = this.port[0x11];
			this.ram[0x2411] = this.port[0x12];
			this.ram[0x2412] = this.port[0x14];
			this.ram[0x2413] = this.port[0x17];
			break;
		case 0x04:
			this.ram[0x2411] = this.port[0x11];
			this.ram[0x2412] = this.port[0x12];
			this.ram[0x2414] = this.port[0x14];
			this.ram[0x2417] = this.port[0x17];
			break;
		case 0x05:
			this.ram[0x2410] = 0x0f;
			this.ram[0x2411] = 0x0f;
			break;
		case 0x08:
			this.ram[0x2410] = 6;
			this.ram[0x2411] = 9;
			break;
		}
		switch (this.ram[0x2428]) {
		case 0x01:
			this.ram[0x2421] = 0x0f;
			break;
		case 0x02:
			this.ram[0x2422] = 0x0f;
			break;
		case 0x04:
			this.ram[0x2420] = this.port[0x20];
			this.ram[0x2421] = 0x0f;
			this.ram[0x2422] = 0x0e;
			this.ram[0x2423] = 1;
			break;
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
		if (fDown)
			this.port[4] = this.port[4] & ~4 | 1;
		else
			this.port[4] &= ~1;
	}

	right(fDown) {
		if (fDown)
			this.port[4] = this.port[4] & ~8 | 2;
		else
			this.port[4] &= ~2;
	}

	down(fDown) {
		if (fDown)
			this.port[4] = this.port[4] & ~1 | 4;
		else
			this.port[4] &= ~4;
	}

	left(fDown) {
		if (fDown)
			this.port[4] = this.port[4] & ~2 | 8;
		else
			this.port[4] &= ~8;
	}

	triggerA(fDown) {
		if (fDown)
			this.port[5] |= 2;
		else
			this.port[5] &= ~2;
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
				| (i >> 3 & 6) * 255 / 7 << 16				// Blue
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

	convertOBJ4() {
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
	}

	convertOBJ8() {
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
			}
			else if (this.stars1[i].y < 0) {
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
			}
			else if (this.stars2[i].y < 0) {
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
			}
			else if (this.stars0[i].y < 0) {
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

const BANG = new Int16Array(new Uint8Array(window.atob('\
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\
UQEnBIsDNQGT/9r9Yfzd+pr5Dvgf+MH7J/9ZAkoF9AeRCuYM7g7yEK0SShS8FVQXoBeHFIIR2g5HDM8JawcSBdYCqgCS/oP8ifrB+Ov2nvgk/A7/2gGPBB0G\
DAS+Aab/k/3a+yv6k/ga95z1TvTX8rf0svgC/DX/QAJlBNgC6gA5/5D9JPy5+nH5Kvjt9s31uPS1887yBPJX8avw+fBZ8ZXyxvY++4z+0/52/ur/owNLB7sI\
zwdAB6gGKQaTBQ0FsgQ/BNYDSwODA4cGCAohDD8LSgpfCbIIrgfZCPoLgA6hDvgMwQuDCmsJSwhBB0MGVwWBBJsDwQICAkYBgAADACX/0P8HA8MFSwh7CqYM\
NQxfCvsIkgd2Bl0FdgQ0AwwDkAU6CCQJeQcbBsIEpgOcAoUBjwCX/0EBGQQhBmQFugN7AmEBVQAd/y3+A/12/V0AIQPDA0AC/QAzAtgE4wbeCIUKIwyHDQwP\
gQ8mDfAK5AgWByYFUwVVB88ILwpmC1gMXwqvB3IFaAMjARAAqgGGA7sDbAHw/vj+3wBRAjoBlv6D/GP6hPi+9h71PvOO8sb0Bfci+QL7Af3i/LX6wvhG+Zz7\
Xf0e/6gAnwHq/5j9pvxs/iAAjgHgAg4EHAUjBvMGDAUjAsD/af0Z+674hfYt9GjzTvVh95T3ZfVL89DzIvb49/32oPTP8gLxeu/t7Z7sFuv26rPtdvAT83r1\
0/ca+if8Hf7k/3ABzQJ9Aeb+cv3M/sgAfwFk/zb9IPsx+RL3R/ef+a77MPuw+BH3a/jH+l782/q1+Or2TfV884Dz7vVz+Ob4FPeY9dr2l/mz+/L68fjY94r5\
Ifyf/Sz8bfr2+Jj3/PVX9iD5kvsD/koAQAJGAUn/tv0m/J36Evmp91X2IvUH9PTy+fEn8Xnw5+9o7+zujO5d7iLukPB69PD3MvuS/gIBYAAn/6b/jwJ6BbwG\
VQUiBPECDwLzAGgCiwUXCIsKuAywDm8QCBKBE88U9hUrFz0YWhkNGP0UjRLKEikUzxSCEoIPFg3JCjsIUgfECB8KlgnHBpYEVQI6AE3+K/9MAc0CUASJBZ8G\
pAfgCLYI+wVHA9wCfgTFBbEE2gGp/2UAIwJfA58EjAWHBlsHagh+B4oE4AHXAVADPwSDAqD/PP3S+rn4iPaV9FfyqPGg8931TfZU9Jfy0vBJ797tTe8V8lf0\
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\
Ff2m/wwCwQLfAWcB4QI/BfAGeQZrBaQE7AP7AiADOAUqBw4JrwpODAoMdwp7CX4KOAwQDecLOQrJCSALjgzbDDELmgmECdMKDgx7C40JMQjTCB0K9wrQC3wM\
DQ2jDVkOyQ4dD4QPvg8AEPsP8A2KC2cJagdvBYcEfwUiBrcGIgeqB2sGCARMApQCigPQAxwC+f8c/xYA5AC0AU4C6wIZAvz/Nv52/PD6VPnJ91f2LPVK9vL3\
3vjT9zz2+PWs9zD5ovrl+yf9af58/48AgAFKAhkDywOiBCQEBgIhAFH+tPwP+2X5wfdP9u/0wPOa8ozxmvCm7+nuLu717evvH/JK9Gf2WPg7+vT7l/0m/6MA\
2AH9AGH/xv4VAJoB8AInBD4FSwYrBxkICwchBXwD0wE6ADf/bQCzAdsC3wMUBcoE0QIlAVgBnwKXA40EdwXQBRkEBgLnAAICCAP0A68EgAXFBLMC/wAxATIC\
EAPJA30EnQSTAowAu/4X/Yv7D/qc+Bf3fPdH+bv6QPq0+Kb3yPiK+vv7Sf2u/ub+Xf3j+xr8v/0G/3v+z/zH+738Nv5X/3H+9fy++3X6MPkS+AD3+PUU9Vv0\
jPPW8kbys/He8j/1jPfD9/D2fvbu9XT1EfXG9FD0w/RZ9835KPxp/r4ATAFdAMv/LAFlAzsFAgeTCBYKXQuwDLIMJQvSCW8IQwfmBVsG/gc5CWgKews2DMwK\
FAmXBx0GkQRRBNcFAwcNCAQJ4wkACfcGyQWYBtwHSAjOBvcEaASdBZoGewc5COgIhwkqCnMKvAioBtgEMQNyAawA0gH+AuQCBwFs/+L9jfwd+1z79fwz/oD/\
owCsAagCuQPcAyICZwAXAEQBUwI1A/0D5wSmBWQGtAblBO0CEwFK/6f9Bfxu+uj4kvc69vr0yPPG8s3x9/Av8IzvA/E/80T1VPdI+R77yfxi/t//LAFgAoQD\
lwR+BX0EvAK/AbcC+gMKBekF/wa2BrIE9QIHAz8EIwULBtQGagf7B4kIAgleCcYJxQheBjgEBgTpBD4FswM0AbT/PgA/AS4BHf8a/UP7h/nh90T20vRK853z\
VvXK9lv4wfnf+tT5Q/gF96j1gPR483TyZvGt8cDzpvWq94T5QvvR/Ej+qf/YAEQCqQIUAaD/Tf4J/Zb78/un/Qb/nf76/O/7+/yd/hAAaAHIAmkD7gFiAOX+\
cv0m/Pr6yPmf+KX3wvb39TH3UPks+/v82P7w//H+y/2z/Lr7qPoa+yH9A/8o//D9B/0w/Ev7sfpB/E3+GwDtAYcD8gQ3Bp0HtQcrBrgECwWYBuIHfQfHBYYE\
SgXGBq4HhwbjBGgD/gHDAI7/Yf5r/U/8Oftj+or53PgM+Cv5e/tw/Wv/MQHSAj4ExQUnBsEEWAOJAxcFUQaBB5oIhAlYCIcGwQXaBvsHDgnlCdIKjgqdCN8G\
2Ab8B8UIyAe8BVIE8wQBBt4GjQdRCAsI8QUVBEYCjQD8/nf98vuk+ln76PwU/lf/aABrAT8CNAP7AicBdP+H/9kAtQGqAnEDHAS7BIQFZQVdA4IBzP8Q/or8\
9fqT+Wr6Avz6/Ib8w/uL+5384P33/vT/4gC8AZUCUwMKBJ4EIwWjBRIGfgbgBlwH8QZqBQAEsgJ0ASgA8/7O/cD8pfuf+rj57/gW+Kj3rvjb+fP67fvh/OP8\
3vv/+jf6X/md+G/5pvqm+538f/1V/iD/9v+0AFMBFQKwAVMAQf8a/i/9PvxD+2b6oPni+A74uvfd+Bj6Mftd/GH9Vv5K/yYA7wC1AVcCpAFHAIf/HADqABYB\
8f/P/rn9xvyw+7v70fy7/YX9aPyB+5b6uPkB+Wf4uvcI95X2/PXi9VL32/i1+Sv5q/g/+Mr3Wfcb9972kfaf92n57/ph/N/98v6d/vT9Ev5y/6oAzQHxAgME\
xwPGAhYC0QIOBLwEEwT/Ar8CywO4BJMFQwb/BrwGewV2BGsDWgJ0AQECGgOrA90CoQEQAfEB4gKnA10E/gSIBEoDQAKDAmYDCQShBC4FrAUSBmwGuQb/Bj0H\
gQevB9EH4gcYCNAHPQZxBLQDHgRQBKQEvgTQBOsEAgUOBecDKALRAOkAXgFDAcP/Ov7Z/Fv7Gvr3+NX3vPay9bf05/Mp83XyyPE78a7wVvB98S7zS/QV9HLz\
nvMU9aH2Tfe69jn26vZ9+OL5QPt7/LT91f72/7IA2v/2/kD+f/3R/BP8evu2+iX7mPzh/en9Ev2q/Jf9Bf8yAGIBdwJoA1cEJwXvBZoGNwfRB2MIxAjEBzcG\
QAWoBUsGzgY6B5UH5QctCGMIcwfQBXAEHwPMAacA9wCcASICuQI/Ax4D0wF/AEj/Lv4D/SX9H/7H/k7+/vxN/AP99/2r/mv/OgAsAAn/4f3q/ff+tP9vABIB\
tgFOAuEC/gKhAXMAVv89/jT9TP08/hL/mf5s/Xf8wfzP/az+d/8fAOQAkQFLAiQC1gCy/4X+iP2L/Mv8xf2a/uz9vPzm++n6FPpV+Y342vcw95L2DfaJ9R/1\
4fSb9FX0LPT089Pzx/O287rzzfPz8w30VvQ39lr4O/on/On9h/8FAWQC+wJcAt0BhwElAcoA2wFlA5oENgSCAwMDiQLiARgClAPkBCIGPwdfCE8JHQrBCvUJ\
1gjlBwQH+wWkBZcGlQewB4AGhgWmBbAGbAfeBqkFmwSmA8ICCgLPAuQDTQR0A10CLQIqA/cDygR3BR0GdgU1BC8DMwJaAc0AmgGOAlMD/QOhBCwFvQVQBq0G\
HQePB6gGNQUYBAMD+wFDAeABqgJNA9EDcgQVBL4CewFqATUC1AI0AsEAtP8qAOUAcwEiAp4CHwOPA+kDOQRxBK4E7QQIBTkFVAWCBREFcAPCASwBqQHpARoC\
RwJzApECzwKWAvIAZP/c/Xr88vqE+jP7tfsu+7v5h/hY91H2PvU+9FLziPLa8TPxnPAR8JLvgO/u8HXy3fND9br2CfdH9t/1SvXK9G70hfU29574DPpq+7b8\
5P0s/2P/ef67/S3+fP9/AAwAAv89/nL9w/wD/HP7yfrN+i/8fv2u/t3//QAPAgkD2AOzBHUF7wXzBMkDwQKxAdMA8v8Z/yn+V/5//5UAgAB4/73+/P1K/cn8\
n/3l/rb/FP9I/p39Af1y/OX7e/sQ+6/6UPr9+bL5c/k0+VD6B/yJ/Qz/cwCNASkBfwADAJD/Jv++/mP+CP7E/Zr9MP3+/br/LAFiAc4AfgAjALH/pv/sAIcC\
mAMgA6ECKgK+AVAB5wCVACYAvv95/zH/6v6x/of+xv98AfICPASnBWMGrwURBXwE/wOGAx8DnQIsAsUBZQEFAagAQgACABkBwAIXBFIFfgY4B34GzgUuBYgE\
CgSNA/ICewL+AYABDAGvAFIA8f9//y3/8v64/oj+UP73/dL9tP2J/XT9Sf0j/Sn9G/0P/Qn9Cv0O/Q39Ev0t/T/9Yv5mABkCsQM1BWIGDgZ6BRgFyARaBPED\
mAMtA9kCiwIoAtEBiQFFAQkBwgCKAKoBWgPOBBQGSAcCCFwHpQYEBmIFwgQnBIcD9gKDAhkClgEPAasAMwD6AJYCxAN1A6YCcwKJA60EMgWDBLoDEAN+At4B\
TQHCADkAt/82/87+YP7u/YX9Mf3i/ND8Jf6o//UAJwJdA7UD5AI0ApQBBAF0AO//cv8D/5b+J/6//bn+LgBHAfYANwCw/zL/m/64/ioAcwGqAq8DuATQBM8D\
CAM+AnABuwAQAFX/sP4n/oD9P/1r/rP/0ADaAeQC1QOcBGkFEgalBh0HJAblBOED2ALUAeAAAQAD/7j+zf+fAG8BQALxAoEDHgSIBIwDHQJkAfcBwQLZAqAB\
ZgA1/x3+Dv0D/A77L/pb+YX4z/ch94X24vVm9eH0sPQJ9oz34vg4+oz77/se+3v64PlR+b74hfkO+zr8af2Q/pP/igCRAfEB/wAFAAj/Lv5R/Yv9t/6z/3T/\
Zf6M/cT83/tZ+2P8e/2R/qn/mQB5AU0CCwPKA2oE8QRjBcQFOQZyBsgGaAbjBGoDLwPDAxoEJwOVATwA+v60/Yj8b/sa+wv80vyZ/Tz+2v7m/on+R/7C/nj/\
3v+l/0P/+f6w/mX+df4f/7H/JQCjABUB6ABrAAEAm/8q/+L+Wv/T/1cAxgAbAWwBuAEMAtgBIgGoAM0AIQFDAcAABgC//wEAVwBBAHn/9v5V/rf9QP3P/GT8\
3fsI/JD88Pxp/bf9CP5V/qn+oP4I/oj99vx5/Pf7EPyY/Af9bv3X/TP+a/68/r/+KP6R/X393f05/gz+Z/3Z/E382PuF+7T7Qfy2/CL9jP3Z/R7+d/5I/rf9\
JP0V/Xz9zP14/dv8Xvzh+3D7B/uw+kT6/Pm2+Vv5F/nT+Kb4evhX+CX4Avjw98f3uvfA97j3s/fC99j3BfgL+DX4Ovk7+i37F/zv/Mj9g/5N/2H/Ef/n/lb/\
8v+SAIgANQAMANr/rv92/0T/Cf86/wMAtABRAeoBhAL5ApID7gOHA+oCtQIXA6IDzwNHA9gCWwLzAYcBrgEpApMCSwK7AUEB0ABrAB4ApgAsAY0B9QFQArIC\
FANZAzEDpwIpAqYBJAGxAFEA3P+T/wAAcADsAF8BxQE1An0CwAKHAvMBewGdAQUCQALoAUAB8gBHAaUBlgH8AGMAYQDUADYB9QBeAOL/b//z/pv+7v53/8j/\
KACBAO0AQgGBAYEB3AA8ADoAnwD1AEEBhAGzAUABlQA3AH4A0gC/ACgAuf8f/5D++P3z/XP+1f4o/3j/0/8bAHgAigD1/1f/xf5l/vL95v1n/rb+EP90/8L/\
GQBrAK4A4AAnAREBagDS/zn/of4y/rn9Ov3M/CX9o/0R/nv+z/5F/5P/5//a/zf/t/45/sj9T/1+/Q3+dP47/sf9Zf3s/JL8Qvzr+6z7dPsp++36vfqe+nr6\
1/qt+3D8sfyE/Gz81Pyd/Tn+L/7x/fX9qf5X/93/aAD0AIMBAAKIAlQC1wGPAeEBaQLXAj4DmAPWAxsEeQQ9BJED+QIUA3kDyAMABC4ETgRiBJgEwQTfBPoE\
CAUPBSAFeASHA9sC6wL3AgkDFwMyA+oC/QEfAWUAvv8R/xT/dP+n/y3/cP7r/XT97Pyx/B39cP3H/RX+b/5H/rX9N/1x/f/9cf7I/iH/Pf+//jP+CP6M/vr+\
x/43/sr9Xf3x/J38TPzq+5X7UfsW+8/6nvpV+kX6/PrZ+1j8Gvzl+7T7nPtj+7j7m/xO/Qj+tf5m/+v/kADjAJMAQgBUAOUAdgGAAQMBqwBWABsA6f8fALYA\
OwGyAScCgwL0AlcDnwPxA0YECQRbA88CPQKpATQBvQBCANf/bP8H/63+Wf4c/tb9gP1P/Sj9AP20/BL90/1o/hX/tf8zABUAxv9v/zP/9f4A/7b/XQDlAHkB\
AwJ6AgEDdAPDAysEdwTFBOcEIQVUBYEFRgWVBO0DQgO+AiMCNAKRAtMCFwNVA4ADpgPnA7sD/AJJApIB6wBbAG0AuQDpAIUAy/9k/7n/FwA2AJ7/GP+F/gv+\
qv0v/dr8dPyc/C/9uP0s/pT+9v5P/77/7f90//z+n/4t/r/9z/1S/tL+Pf+l/woArv8P/8j+IP+k/8f/WP/e/tv+Wf+9/y4AiQDsAJ0A6P+m/+v/UQCdAOQA\
NQGAAbQB+AELAjwCggIEAkoBqwC+ABUBSwGIAaoBuQHaAfQB/gEKAh8CmQHHACMALwBxAHUAt//7/lL+uf05/bD8IPy2+0L73vp/+rb6Q/ui+5n7H/vp+nn7\
Mvx//D388vuV+2L7FftA+/n7jfws/cj9T/7G/kX/sf9q/+/+oP5T/u39of1N/QP9y/yG/ED8Ffzy+737PvwQ/b79ef4n/6L/ff81/+b+n/5T/nP+G//W/wwA\
s/9x/yz/7v7J/jv/8/+FAEcA9//J/4n/P/8R/97+l/6E/nz+Kf5u/k3/CQBDAAkAzv+S/27/Q/8w/xD/+/6c/3cAAQG3AKUAigBPADcAewAcAc0BagLpAnAD\
WwPfAqECKQO0A9cDiwMRAxEDowMeBBUEjgMVA6wCVAL9AYwBOgEDAUUB5AFdAvwBgwF1AeIBZQLgAjMDfwPXAxkEQATzA0kD4QI4A4kDtgP7AysEQwR5BJkE\
ogS6BNIE4QTaBOgE5QTvBLsE2gP0Aq8C1QLjAqoCvAHhANYABQEFAZEAt/8R/0P/jf9l/7z+NP6I/fD8bPxg/MX8OP2G/b79G/5j/rL+2f4x/n/9af3F/Qn+\
4P1A/cX8/fyH/az9UP3k/FP80PtY+zX7uPtl/KH8Gfyy+1r7DfvY+nr6F/ry+av5Y/lb+db5kvpZ+w38nvxC/dv9Y/57/hv+wv17/Vb9Cf1Z/SL+n/5p/hH+\
5P1j/hX/pv8hALQAIwGFAfABoQEIAagANAC2/0n/4P55/mT+5/51/6P/U//v/pn+Vf7n/ZD9Uf0D/d/8yfyd/F78Tfwr/AD87vsJ/Lj8g/1P/gj/u/9sAAIB\
gAERAo0CBAN6A+ID8wORAx0DqgJTAt8BagH8AIoAOwDl/xMAtwAyAa0BHQKWAhwDXAOTA+wDIwR4BMYE6QQSBUMFUwVzBYwFmwWZBY4FkwWSBZMFjAVtBWMF\
UAUoBRsFGwXuBL0EngRoBDsELAQBBMUDlwNaAysDFwPsArQCiAJbAjACBgLZAaUBawFJARAB/ADfAJ8ASQAyAA0A0v/K/6D/Xf89/yb///7l/sH+l/5+/nH+\
T/43/iP+8P3H/br9m/2J/Y79Wv0l/Sb9GP0H/e782vzE/Lf8t/ys/Lj8uPyb/JP8jvx9/ID8ffxj/Ef8Ofwz/Dj8TfxS/Dz8PvxX/EH8TfxQ/Dz8PPxT/F78\
ZPx1/HP8c/x7/Hb8ePyN/Ib8ePyO/KH8s/zO/Nr8zfzW/Pj89/z6/O/88vzv/AT9Fv0g/Uz9Uv1K/Vj9YP1z/aP9u/26/cn96/0A/ir+K/4e/i7+Lv42/kn+\
T/5a/mH+b/6J/oX+nP6h/pT+rP6Z/rX+yv7d/uv+4/7o/vD+BP/8/uf+5/4E/xX/Fv81/0b/S/9L/1r/Xf92/4T/a/9q/3z/hv+M/7H/nP+Q/6L/sP+9/7n/\
rP+o/77/zP/X/9n/3v/O/9H/2//U/+3/+v/v/+j/8f/5//7/CgD5/+3/CwAXACkAOwAwABYAJAA9ACYALgBBACYAGQAqAB0AKAAtACAAKgA7AEUAQABBAEMA\
MQAxAE0AUABGAEIALwArADkAJwAxAEMASwAtADAAOwA1AFQASQA7AD8AOQA3ADcA\
').split('').map(c => c.charCodeAt(0))).buffer);

/*
 *
 *	Gaplus
 *
 */

const url = 'gaplus.zip';
let SND, BGCOLOR, OBJCOLOR_H, OBJCOLOR_L, RED, BLUE, GREEN, BG, OBJ4, OBJ8, PRG1, PRG2, PRG3;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG1 = new Uint8Array((zip.files['gp2-4.8d'].inflate() + zip.files['gp2-3b.8c'].inflate() + zip.files['gp2-2b.8b'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	PRG2 = new Uint8Array((zip.files['gp2-8.11d'].inflate() + zip.files['gp2-7.11c'].inflate() + zip.files['gp2-6.11b'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	PRG3 = new Uint8Array(zip.files['gp2-1.4b'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	BG = new Uint8Array(zip.files['gp2-5.8s'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJ8 = new Uint8Array((zip.files['gp2-11.11p'].inflate() + zip.files['gp2-10.11n'].inflate() + zip.files['gp2-9.11m'].inflate()).split('').map(c => c.charCodeAt(0)));
	OBJ4 = new Uint8Array(zip.files['gp2-12.11r'].inflate().split('').map(c => c.charCodeAt(0)));
	RED = new Uint8Array(zip.files['gp2-3.1p'].inflate().split('').map(c => c.charCodeAt(0)));
	GREEN = new Uint8Array(zip.files['gp2-1.1n'].inflate().split('').map(c => c.charCodeAt(0)));
	BLUE = new Uint8Array(zip.files['gp2-2.2n'].inflate().split('').map(c => c.charCodeAt(0)));
	BGCOLOR = new Uint8Array(zip.files['gp2-7.6s'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJCOLOR_L = new Uint8Array(zip.files['gp2-6.6p'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJCOLOR_H = new Uint8Array(zip.files['gp2-5.6n'].inflate().split('').map(c => c.charCodeAt(0)));
	SND = new Uint8Array(zip.files['gp2-4.3f'].inflate().split('').map(c => c.charCodeAt(0)));
	init({
		game: game = new Gaplus(),
		sound: sound = [
			new MappySound({SND}),
			new SoundEffect({se: game.se, freq: 11025, gain: 0.75}),
		],
	});
	loop();
}

