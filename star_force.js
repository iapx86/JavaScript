/*
 *
 *	Star Force
 *
 */

import SN76489 from './sn76489.js';
import SenjyoSound from './senjyo_sound.js';
import Cpu, {init, read} from './main.js';
import Z80 from './z80.js';
let game, sound;

class StarForce {
	cxScreen = 224;
	cyScreen = 256;
	width = 256;
	height = 512;
	xOffset = 16;
	yOffset = 16;
	rotate = false;

	fReset = true;
	fTest = false;
	fDIPSwitchChanged = true;
	fCoin = 0;
	fStart1P = 0;
	fStart2P = 0;
	fTurbo = 0;
	nLife = 3;
	fDemoSound = true;
	nExtend = '50000, 200000, 500000';
	nDifficulty = 'Normal';

	ram = new Uint8Array(0x3c00).addBase();
	ram2 = new Uint8Array(0x400).addBase();
	in = Uint8Array.of(0, 0, 0, 0, 0xc0, 0);
	count = 0;
	timer = 0;
	cpu_irq = false;
	cpu2_command = 0;
	pio = {irq: false, fInterruptEnable: false};
	ctc = {irq: false, fInterruptEnable: false, cmd: 0};

	fg = new Uint8Array(0x8000);
	bg1 = new Uint8Array(0x10000);
	bg2 = new Uint8Array(0x10000);
	bg3 = new Uint8Array(0x8000);
	obj = new Uint8Array(0x20000);
	rgb = new Uint32Array(0x200);

	cpu = new Z80();
	cpu2 = new Z80();

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x80; i++)
			this.cpu.memorymap[i].base = PRG1.base[i];
		for (let i = 0; i < 0x3c; i++) {
			this.cpu.memorymap[0x80 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x80 + i].write = null;
		}
		this.cpu.memorymap[0xd0].read = (addr) => { return (addr &= 0xff) < 6 ? this.in[addr] : 0xff; };
		this.cpu.memorymap[0xd0].write = (addr, data) => {
			switch (addr & 0xff) {
			case 2:
				return void(this.cpu_irq = false);
			case 4:
				return this.cpu2_command = data, void(this.pio.irq = this.pio.fInterruptEnable);
			}
		};

		this.cpu.check_interrupt = () => { return this.cpu_irq && this.cpu.interrupt(); };

		for (let i = 0; i < 0x20; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 4; i++) {
			this.cpu2.memorymap[0x40 + i].base = this.ram2.base[i];
			this.cpu2.memorymap[0x40 + i].write = null;
		}
		this.cpu2.memorymap[0x80].write = (addr, data) => { sound[0].write(data, this.count); };
		this.cpu2.memorymap[0x90].write = (addr, data) => { sound[1].write(data, this.count); };
		this.cpu2.memorymap[0xa0].write = (addr, data) => { sound[2].write(data, this.count); };
		this.cpu2.memorymap[0xd0].write = (addr, data) => { sound[3].write(1, data & 15, this.count); };
		for (let i = 0; i < 0x100; i++) {
			this.cpu2.iomap[i].read = (addr) => { return addr & 0xff ? 0xff :  this.cpu2_command; };
			this.cpu2.iomap[i].write = (addr, data) => {
				switch (addr & 0xff) {
				case 1:
					return void(data === 0xa7 && (this.pio.fInterruptEnable = true));
				case 9:
					return void(data === 0xd7 && (this.ctc.fInterruptEnable = true));
				case 0xa:
					if (this.ctc.cmd & 4) {
						sound[3].write(0, (data ? data : 256) * (this.ctc.cmd & 0x20 ? 16 : 1), this.count);
						this.ctc.cmd &= ~4;
					} else if (data & 1)
						this.ctc.cmd = data;
					return;
				}
			};
		}

		this.cpu2.check_interrupt = () => {
			if (this.pio.irq && this.cpu2.interrupt(0))
				return this.pio.irq = false, true;
			if (this.ctc.irq && this.cpu2.interrupt(10))
				return this.ctc.irq = false, true;
			return false;
		};

		// Videoの初期化
		this.convertFG();
		this.convertBG();
		this.convertOBJ();
	}

	execute() {
		this.cpu_irq = true;
		for (this.count = 0; this.count < 3; this.count++) {
			!this.timer && (this.ctc.irq = this.ctc.fInterruptEnable);
			Cpu.multiple_execute([this.cpu, this.cpu2], 0x800);
			++this.timer >= 2 && (this.timer = 0);
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
			switch (this.nLife) {
			case 2:
				this.in[4] |= 0x30;
				break;
			case 3:
				this.in[4] &= ~0x30;
				break;
			case 4:
				this.in[4] = this.in[4] & ~0x30 | 0x10;
				break;
			case 5:
				this.in[4] = this.in[4] & ~0x30 | 0x20;
				break;
			}
			if (this.fDemoSound)
				this.in[4] |= 0x80;
			else
				this.in[4] &= ~0x80;
			switch (this.nExtend) {
			case '50000, 200000, 500000':
				this.in[5] &= ~7;
				break;
			case '100000, 300000, 800000':
				this.in[5] = this.in[5] & ~7 | 1;
				break;
			case '50000, 200000':
				this.in[5] = this.in[5] & ~7 | 2;
				break;
			case '100000, 300000':
				this.in[5] = this.in[5] & ~7 | 3;
				break;
			case '50000':
				this.in[5] = this.in[5] & ~7 | 4;
				break;
			case '100000':
				this.in[5] = this.in[5] & ~7 | 5;
				break;
			case '200000':
				this.in[5] = this.in[5] & ~7 | 6;
				break;
			case 'No':
				this.in[5] |= 7;
				break;
			}
			switch (this.nDifficulty) {
			case 'Normal':
				this.in[5] &= ~0x38;
				break;
			case 'Difficult1':
				this.in[5] = this.in[5] & ~0x38 | 8;
				break;
			case 'Difficult2':
				this.in[5] = this.in[5] & ~0x38 | 0x10;
				break;
			case 'Difficult3':
				this.in[5] = this.in[5] & ~0x38 | 0x18;
				break;
			case 'Difficult4':
				this.in[5] = this.in[5] & ~0x38 | 0x20;
				break;
			case 'Difficult5':
				this.in[5] = this.in[5] & ~0x38 | 0x28;
				break;
			}
			if (!this.fTest)
				this.fReset = true;
		}

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu.reset();
			this.cpu_irq = false;
			this.cpu2.reset();
			this.timer = 0;
			this.pio.irq = false;
			this.pio.fInterruptEnable = false;
			this.ctc.irq = false;
			this.ctc.fInterruptEnable = false;
			this.ctc.cmd = 0;
		}
		return this;
	}

	updateInput() {
		this.in[2] = this.in[2] & ~0xd | !!this.fCoin << 0 | !!this.fStart1P << 2 | !!this.fStart2P << 3;
		this.fCoin -= !!this.fCoin, this.fStart1P -= !!this.fStart1P, this.fStart2P -= !!this.fStart2P;
		this.fTurbo && (this.in[0] ^= 1 << 4);
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
		this.in[0] = this.in[0] & ~(1 << 2 | fDown << 3) | fDown << 2;
	}

	right(fDown) {
		this.in[0] = this.in[0] & ~(1 << 0 | fDown << 1) | fDown << 0;
	}

	down(fDown) {
		this.in[0] = this.in[0] & ~(1 << 3 | fDown << 2) | fDown << 3;
	}

	left(fDown) {
		this.in[0] = this.in[0] & ~(1 << 1 | fDown << 0) | fDown << 1;
	}

	triggerA(fDown) {
		this.in[0] = this.in[0] & ~(1 << 4) | fDown << 4;
	}

	triggerB(fDown) {
		!(this.fTurbo = fDown) && (this.in[0] &= ~(1 << 4));
	}

	convertRGB() {
		for (let j = 0; j < 0x200; j++) {
			const e = this.ram[0x1c00 + j], i = e >> 6 & 3, r = e << 2 & 0xc, g = e & 0xc, b = e >> 2 & 0xc;
			this.rgb[j] = (r ? r | i : 0) * 255 / 15	// Red
				| (g ? g | i : 0) * 255 / 15 << 8		// Green
				| (b ? b | i : 0) * 255 / 15 << 16		// Blue
				| 0xff000000;							// Alpha
		}
	}

	convertFG() {
		for (let p = 0, q = 0, i = 0; i < 512; q += 8, i++)
			for (let j = 7; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.fg[p++] = FG[q + k] >> j << 2 & 4 | FG[q + k + 0x1000] >> j << 1 & 2 | FG[q + k + 0x2000] >> j & 1;
	}

	convertBG() {
		for (let p = 0, q = 0, i = 0; i < 256; q += 32, i++) {
			for (let j = 7; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.bg1[p++] = BG1[q + k + 16] >> j << 2 & 4 | BG1[q + k + 0x2000 + 16] >> j << 1 & 2 | BG1[q + k + 0x4000 + 16] >> j & 1;
				for (let k = 7; k >= 0; --k)
					this.bg1[p++] = BG1[q + k] >> j << 2 & 4 | BG1[q + k + 0x2000] >> j << 1 & 2 | BG1[q + k + 0x4000] >> j & 1;
			}
			for (let j = 7; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.bg1[p++] = BG1[q + k + 24] >> j << 2 & 4 | BG1[q + k + 0x2000 + 24] >> j << 1 & 2 | BG1[q + k + 0x4000 + 24] >> j & 1;
				for (let k = 7; k >= 0; --k)
					this.bg1[p++] = BG1[q + k + 8] >> j << 2 & 4 | BG1[q + k + 0x2000 + 8] >> j << 1 & 2 | BG1[q + k + 0x4000 + 8] >> j & 1;
			}
		}
		for (let p = 0, q = 0, i = 0; i < 256; q += 32, i++) {
			for (let j = 7; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.bg2[p++] = BG2[q + k + 16] >> j << 2 & 4 | BG2[q + k + 0x2000 + 16] >> j << 1 & 2 | BG2[q + k + 0x4000 + 16] >> j & 1;
				for (let k = 7; k >= 0; --k)
					this.bg2[p++] = BG2[q + k] >> j << 2 & 4 | BG2[q + k + 0x2000] >> j << 1 & 2 | BG2[q + k + 0x4000] >> j & 1;
			}
			for (let j = 7; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.bg2[p++] = BG2[q + k + 24] >> j << 2 & 4 | BG2[q + k + 0x2000 + 24] >> j << 1 & 2 | BG2[q + k + 0x4000 + 24] >> j & 1;
				for (let k = 7; k >= 0; --k)
					this.bg2[p++] = BG2[q + k + 8] >> j << 2 & 4 | BG2[q + k + 0x2000 + 8] >> j << 1 & 2 | BG2[q + k + 0x4000 + 8] >> j & 1;
			}
		}
		for (let p = 0, q = 0, i = 0; i < 128; q += 32, i++) {
			for (let j = 7; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.bg3[p++] = BG3[q + k + 16] >> j << 2 & 4 | BG3[q + k + 0x1000 + 16] >> j << 1 & 2 | BG3[q + k + 0x2000 + 16] >> j & 1;
				for (let k = 7; k >= 0; --k)
					this.bg3[p++] = BG3[q + k] >> j << 2 & 4 | BG3[q + k + 0x1000] >> j << 1 & 2 | BG3[q + k + 0x2000] >> j & 1;
			}
			for (let j = 7; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.bg3[p++] = BG3[q + k + 24] >> j << 2 & 4 | BG3[q + k + 0x1000 + 24] >> j << 1 & 2 | BG3[q + k + 0x2000 + 24] >> j & 1;
				for (let k = 7; k >= 0; --k)
					this.bg3[p++] = BG3[q + k + 8] >> j << 2 & 4 | BG3[q + k + 0x1000 + 8] >> j << 1 & 2 | BG3[q + k + 0x2000 + 8] >> j & 1;
			}
		}
	}

	convertOBJ() {
		for (let p = 0, q = 0, i = 0; i < 512; q += 32, i++) {
			for (let j = 7; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 16] >> j << 2 & 4 | OBJ[q + k + 0x4000 + 16] >> j << 1 & 2 | OBJ[q + k + 0x8000 + 16] >> j & 1;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k] >> j << 2 & 4 | OBJ[q + k + 0x4000] >> j << 1 & 2 | OBJ[q + k + 0x8000] >> j & 1;
			}
			for (let j = 7; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 24] >> j << 2 & 4 | OBJ[q + k + 0x4000 + 24] >> j << 1 & 2 | OBJ[q + k + 0x8000 + 24] >> j & 1;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 8] >> j << 2 & 4 | OBJ[q + k + 0x4000 + 8] >> j << 1 & 2 | OBJ[q + k + 0x8000 + 8] >> j & 1;
			}
		}
	}

	makeBitmap(data) {
		this.convertRGB();

		// 画面クリア
		let p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256, i++)
			data.fill(0, p, p + 224);

		// obj描画
		this.drawObj(data, 0);

		// bg描画
		let hScroll = (this.ram[0x1e20] | this.ram[0x1e21] << 8) + 15;
		let vScroll = this.ram[0x1e25];
		p = 256 * 8 * 2 + 224 + (hScroll & 15) + (-vScroll & 0x0f) * 256;
		let k = vScroll + 15 >> 4 & 0x0f | hScroll & 0x7f0 | 0x2000;
		for (let i = 0; i < 15; k = k + 0x10 & 0x7ff | k & 0xf800, p -= 256 * 16 * 16 + 16, i++)
			for (let j = 0; j < 16; k = k + 1 & 0x0f | k & 0xfff0, p += 256 * 16, j++)
				this.xfer16x16_3(data, p, this.ram[k]);

		// obj描画
		this.drawObj(data, 1);

		// bg描画
		hScroll = (this.ram[0x1e30] | this.ram[0x1e31] << 8) + 15;
		vScroll = this.ram[0x1e35];
		p = 256 * 8 * 2 + 224 + (hScroll & 15) + (-vScroll & 0x0f) * 256;
		k = vScroll + 15 >> 4 & 0x0f | hScroll & 0x7f0 | 0x2800;
		for (let i = 0; i < 15; k = k + 0x10 & 0x7ff | k & 0xf800, p -= 256 * 16 * 16 + 16, i++)
			for (let j = 0; j < 16; k = k + 1 & 0x0f | k & 0xfff0, p += 256 * 16, j++)
				this.xfer16x16_2(data, p, this.ram[k]);

		// obj描画
		this.drawObj(data, 2);

		// bg描画
		hScroll = (this.ram[0x1e30] | this.ram[0x1e31] << 8) + 15;
		vScroll = this.ram[0x1e35];
		p = 256 * 8 * 2 + 224 + (hScroll & 15) + (-vScroll & 0x0f) * 256;
		k = vScroll + 15 >> 4 & 0x0f | hScroll & 0x7f0 | 0x3000;
		for (let i = 0; i < 15; k = k + 0x10 & 0x7ff | k & 0xf800, p -= 256 * 16 * 16 + 16, i++)
			for (let j = 0; j < 16; k = k + 1 & 0x0f | k & 0xfff0, p += 256 * 16, j++)
				this.xfer16x16_1(data, p, this.ram[k]);

		// obj描画
		this.drawObj(data, 3);

		// fg描画
		p = 256 * 8 * 2 + 232;
		k = 0x1040;
		for (let i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				this.xfer8x8(data, p, k);

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] = this.rgb[data[p]];
	}

	drawObj(data, pri) {
		for (let k = 0x187c, i = 32; i !== 0; k -= 4, --i) {
			if ((this.ram[k + 1] >> 4 & 3) !== pri)
				continue;
			const x = this.ram[k + 2] - 1 & 0xff;
			const y = (this.ram[k + 3] - 1 & 0xff) + 16;
			if (this.ram[k] < 0xc0) {
				const src = this.ram[k] | this.ram[k + 1] << 9;
				switch (this.ram[k + 1] >> 6) {
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
			} else {
				const src = this.ram[k] << 2 & 0x1fc | this.ram[k + 1] << 9;
				switch (this.ram[k + 1] >> 6) {
				case 0: // ノーマル
					this.xfer16x16(data, x | y << 8, src | 2);
					this.xfer16x16(data, x + 16 & 0xff | y << 8, src | 0);
					this.xfer16x16(data, x | (y & 0xff) + 16 << 8, src | 3);
					this.xfer16x16(data, x + 16 & 0xff | (y & 0xff) + 16 << 8, src | 1);
					break;
				case 1: // V反転
					this.xfer16x16V(data, x | y << 8, src | 3);
					this.xfer16x16V(data, x + 16 & 0xff | y << 8, src | 1);
					this.xfer16x16V(data, x | (y & 0xff) + 16 << 8, src | 2);
					this.xfer16x16V(data, x + 16 & 0xff | (y & 0xff) + 16 << 8, src | 0);
					break;
				case 2: // H反転
					this.xfer16x16H(data, x | y << 8, src | 0);
					this.xfer16x16H(data, x + 16 & 0xff | y << 8, src | 2);
					this.xfer16x16H(data, x | (y & 0xff) + 16 << 8, src | 1);
					this.xfer16x16H(data, x + 16 & 0xff | (y & 0xff) + 16 << 8, src | 3);
					break;
				case 3: // HV反転
					this.xfer16x16HV(data, x | y << 8, src | 1);
					this.xfer16x16HV(data, x + 16 & 0xff | y << 8, src | 3);
					this.xfer16x16HV(data, x | (y & 0xff) + 16 << 8, src | 0);
					this.xfer16x16HV(data, x + 16 & 0xff | (y & 0xff) + 16 << 8, src | 2);
					break;
				}
			}
		}
	}

	xfer8x8(data, p, k) {
		const q = (this.ram[k] | this.ram[k + 0x400] << 4 & 0x100) << 6, idx = this.ram[k + 0x400] << 3 & 0x38;
		let px;

		(px = this.fg[q | 0x00]) && (data[p + 0x000] = idx | px);
		(px = this.fg[q | 0x01]) && (data[p + 0x001] = idx | px);
		(px = this.fg[q | 0x02]) && (data[p + 0x002] = idx | px);
		(px = this.fg[q | 0x03]) && (data[p + 0x003] = idx | px);
		(px = this.fg[q | 0x04]) && (data[p + 0x004] = idx | px);
		(px = this.fg[q | 0x05]) && (data[p + 0x005] = idx | px);
		(px = this.fg[q | 0x06]) && (data[p + 0x006] = idx | px);
		(px = this.fg[q | 0x07]) && (data[p + 0x007] = idx | px);
		(px = this.fg[q | 0x08]) && (data[p + 0x100] = idx | px);
		(px = this.fg[q | 0x09]) && (data[p + 0x101] = idx | px);
		(px = this.fg[q | 0x0a]) && (data[p + 0x102] = idx | px);
		(px = this.fg[q | 0x0b]) && (data[p + 0x103] = idx | px);
		(px = this.fg[q | 0x0c]) && (data[p + 0x104] = idx | px);
		(px = this.fg[q | 0x0d]) && (data[p + 0x105] = idx | px);
		(px = this.fg[q | 0x0e]) && (data[p + 0x106] = idx | px);
		(px = this.fg[q | 0x0f]) && (data[p + 0x107] = idx | px);
		(px = this.fg[q | 0x10]) && (data[p + 0x200] = idx | px);
		(px = this.fg[q | 0x11]) && (data[p + 0x201] = idx | px);
		(px = this.fg[q | 0x12]) && (data[p + 0x202] = idx | px);
		(px = this.fg[q | 0x13]) && (data[p + 0x203] = idx | px);
		(px = this.fg[q | 0x14]) && (data[p + 0x204] = idx | px);
		(px = this.fg[q | 0x15]) && (data[p + 0x205] = idx | px);
		(px = this.fg[q | 0x16]) && (data[p + 0x206] = idx | px);
		(px = this.fg[q | 0x17]) && (data[p + 0x207] = idx | px);
		(px = this.fg[q | 0x18]) && (data[p + 0x300] = idx | px);
		(px = this.fg[q | 0x19]) && (data[p + 0x301] = idx | px);
		(px = this.fg[q | 0x1a]) && (data[p + 0x302] = idx | px);
		(px = this.fg[q | 0x1b]) && (data[p + 0x303] = idx | px);
		(px = this.fg[q | 0x1c]) && (data[p + 0x304] = idx | px);
		(px = this.fg[q | 0x1d]) && (data[p + 0x305] = idx | px);
		(px = this.fg[q | 0x1e]) && (data[p + 0x306] = idx | px);
		(px = this.fg[q | 0x1f]) && (data[p + 0x307] = idx | px);
		(px = this.fg[q | 0x20]) && (data[p + 0x400] = idx | px);
		(px = this.fg[q | 0x21]) && (data[p + 0x401] = idx | px);
		(px = this.fg[q | 0x22]) && (data[p + 0x402] = idx | px);
		(px = this.fg[q | 0x23]) && (data[p + 0x403] = idx | px);
		(px = this.fg[q | 0x24]) && (data[p + 0x404] = idx | px);
		(px = this.fg[q | 0x25]) && (data[p + 0x405] = idx | px);
		(px = this.fg[q | 0x26]) && (data[p + 0x406] = idx | px);
		(px = this.fg[q | 0x27]) && (data[p + 0x407] = idx | px);
		(px = this.fg[q | 0x28]) && (data[p + 0x500] = idx | px);
		(px = this.fg[q | 0x29]) && (data[p + 0x501] = idx | px);
		(px = this.fg[q | 0x2a]) && (data[p + 0x502] = idx | px);
		(px = this.fg[q | 0x2b]) && (data[p + 0x503] = idx | px);
		(px = this.fg[q | 0x2c]) && (data[p + 0x504] = idx | px);
		(px = this.fg[q | 0x2d]) && (data[p + 0x505] = idx | px);
		(px = this.fg[q | 0x2e]) && (data[p + 0x506] = idx | px);
		(px = this.fg[q | 0x2f]) && (data[p + 0x507] = idx | px);
		(px = this.fg[q | 0x30]) && (data[p + 0x600] = idx | px);
		(px = this.fg[q | 0x31]) && (data[p + 0x601] = idx | px);
		(px = this.fg[q | 0x32]) && (data[p + 0x602] = idx | px);
		(px = this.fg[q | 0x33]) && (data[p + 0x603] = idx | px);
		(px = this.fg[q | 0x34]) && (data[p + 0x604] = idx | px);
		(px = this.fg[q | 0x35]) && (data[p + 0x605] = idx | px);
		(px = this.fg[q | 0x36]) && (data[p + 0x606] = idx | px);
		(px = this.fg[q | 0x37]) && (data[p + 0x607] = idx | px);
		(px = this.fg[q | 0x38]) && (data[p + 0x700] = idx | px);
		(px = this.fg[q | 0x39]) && (data[p + 0x701] = idx | px);
		(px = this.fg[q | 0x3a]) && (data[p + 0x702] = idx | px);
		(px = this.fg[q | 0x3b]) && (data[p + 0x703] = idx | px);
		(px = this.fg[q | 0x3c]) && (data[p + 0x704] = idx | px);
		(px = this.fg[q | 0x3d]) && (data[p + 0x705] = idx | px);
		(px = this.fg[q | 0x3e]) && (data[p + 0x706] = idx | px);
		(px = this.fg[q | 0x3f]) && (data[p + 0x707] = idx | px);
	}

	xfer16x16_1(data, dst, src) {
		const idx = src >> 4 & 8 | src >> 1 & 0x30 | 0x40;
		let px;

		src = src << 8 & 0xff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.bg1[src++]))
					data[dst] = idx | px;
	}

	xfer16x16_2(data, dst, src) {
		const idx = src >> 2 & 0x38 | 0x80;
		let px;

		src = src << 8 & 0xff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.bg2[src++]))
					data[dst] = idx | px;
	}

	xfer16x16_3(data, dst, src) {
		const idx = src >> 2 & 0x38 | 0xc0;
		let px;

		src = src << 8 & 0x7f00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.bg3[src++]))
					data[dst] = idx | px;
	}

	xfer16x16(data, dst, src) {
		const idx = src >> 6 & 0x38 | 0x140;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		src = src << 8 & 0x1ff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[src++]))
					data[dst] = idx | px;
	}

	xfer16x16V(data, dst, src) {
		const idx = src >> 6 & 0x38 | 0x140;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		src = (src << 8 & 0x1ff00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[src++]))
					data[dst] = idx | px;
	}

	xfer16x16H(data, dst, src) {
		const idx = src >> 6 & 0x38 | 0x140;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		src = (src << 8 & 0x1ff00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[--src]))
					data[dst] = idx | px;
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >> 6 & 0x38 | 0x140;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		src = (src << 8 & 0x1ff00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[--src]))
					data[dst] = idx | px;
	}
}

/*
 *
 *	Star Force
 *
 */

let PRG1, PRG2, FG, BG1, BG2, BG3, OBJ, SND;

read('starforc.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG1 = Uint8Array.concat(...['3.3p', '2.3mn'].map(e => zip.decompress(e))).addBase();
	PRG2 = zip.decompress('1.3hj').addBase();
	FG = Uint8Array.concat(...['7.2fh', '8.3fh', '9.3fh'].map(e => zip.decompress(e)));
	BG1 = Uint8Array.concat(...['15.10jk', '14.9jk', '13.8jk'].map(e => zip.decompress(e)));
	BG2 = Uint8Array.concat(...['12.10de', '11.9de', '10.8de'].map(e => zip.decompress(e)));
	BG3 = Uint8Array.concat(...['18.10pq', '17.9pq', '16.8pq'].map(e => zip.decompress(e)));
	OBJ = Uint8Array.concat(...['6.10lm', '5.9lm', '4.8lm'].map(e => zip.decompress(e)));
	SND = zip.decompress('07b.bin');
	game = new StarForce();
	sound = [
		new SN76489({clock: 2000000, resolution: 3}),
		new SN76489({clock: 2000000, resolution: 3}),
		new SN76489({clock: 2000000, resolution: 3}),
		new SenjyoSound({SND, clock: 2000000, resolution: 3}),
	];
	canvas.addEventListener('click', () => game.coin());
	init({game, sound});
});

