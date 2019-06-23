/*
 *
 *	Star Force
 *
 */

import SN76496 from './sn76496.js';
import Cpu, {init, loop} from './main.js';
import Z80 from './z80.js';
let sound;

class StarForce {
	constructor() {
		this.cxScreen = 224;
		this.cyScreen = 256;
		this.width = 256;
		this.height = 512;
		this.xOffset = 16;
		this.yOffset = 16;
		this.fReset = true;
		this.fTest = false;
		this.fDIPSwitchChanged = true;
		this.fCoin = 0;
		this.fStart1P = 0;
		this.fStart2P = 0;
		this.fTurbo = 0;
		this.nLife = 3;
		this.fDemoSound = true;
		this.nExtend = '50000, 200000, 500000';
		this.nDifficulty = 'Normal';

		// CPU周りの初期化
		this.ram = new Uint8Array(0x3c00).addBase();
		this.ram2 = new Uint8Array(0x400).addBase();
		this.in = Uint8Array.of(0, 0, 0, 0, 0xc0, 0);
		this.count = 0;
		this.timer = 0;
		this.cpu2_command = 0;
		this.pio = {int: false, fInterruptEnable: false};
		this.ctc = {int: false, fInterruptEnable: false};

		this.cpu = new Z80(this);
		this.cpu.int = false;
		for (let i = 0; i < 0x80; i++)
			this.cpu.memorymap[i].base = PRG1.base[i];
		for (let i = 0; i < 0x3c; i++) {
			this.cpu.memorymap[0x80 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x80 + i].write = null;
		}
		this.cpu.memorymap[0xd0].read = addr => {
			if ((addr &= 0xff) < 6)
				return this.in[addr];
			return 0xff;
		};
		this.cpu.memorymap[0xd0].write = (addr, data) => {
			switch (addr & 0xff) {
			case 2:
				this.cpu.int = false;
				break;
			case 4:
				this.cpu2_command = data;
				this.pio.int = this.pio.fInterruptEnable;
				break;
			}
		};

		this.cpu.check_interrupt = () => this.cpu.int && this.cpu.interrupt();

		this.cpu2 = new Z80(this);
		for (let i = 0; i < 0x20; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 4; i++) {
			this.cpu2.memorymap[0x40 + i].base = this.ram2.base[i];
			this.cpu2.memorymap[0x40 + i].write = null;
		}
		this.cpu2.memorymap[0x80].write = (addr, data) => sound[0].write(data, this.count);
		this.cpu2.memorymap[0x90].write = (addr, data) => sound[1].write(data, this.count);
		this.cpu2.memorymap[0xa0].write = (addr, data) => sound[2].write(data, this.count);
		this.cpu2.memorymap[0xd0].write = () => {};
		for (let i = 0; i < 0x100; i++) {
			this.cpu2.iomap[i].read = addr => (addr & 0xff) === 0 ? this.cpu2_command : 0xff;
			this.cpu2.iomap[i].write = (addr, data) => {
				switch (addr & 0xff) {
				case 1:
					if (data === 0xa7)
						this.pio.fInterruptEnable = true;
					break;
				case 9:
					if (data === 0xd7)
						this.ctc.fInterruptEnable = true;
					break;
				}
			};
		}

		this.cpu2.check_interrupt = () => {
			if (this.pio.int && this.cpu2.interrupt(0)) {
				this.pio.int = false;
				return true;
			}
			if (this.ctc.int && this.cpu2.interrupt(10)) {
				this.ctc.int = false;
				return true;
			}
			return false;
		};

		// Videoの初期化
		this.fg = new Uint8Array(0x8000);
		this.bg1 = new Uint8Array(0x10000);
		this.bg2 = new Uint8Array(0x10000);
		this.bg3 = new Uint8Array(0x8000);
		this.obj = new Uint8Array(0x20000);
		this.rgb = new Uint32Array(0x200);
		this.convertFG();
		this.convertBG();
		this.convertOBJ();
	}

	execute() {
		this.cpu.int = true;
		for (this.count = 0; this.count < 3; this.count++) {
			if (this.timer === 0)
				this.ctc.int = this.ctc.fInterruptEnable;
			Cpu.multiple_execute([this.cpu, this.cpu2], 0x800);
			if (++this.timer >= 2)
				this.timer = 0;
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
			this.cpu.int = false;
			this.cpu2.reset();
			this.timer = 0;
			this.pio.int = false;
			this.pio.fInterruptEnable = false;
			this.ctc.int = false;
			this.ctc.fInterruptEnable = false;
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if (this.fCoin) {
			--this.fCoin;
			this.in[2] |= 1 << 0;
		}
		else
			this.in[2] &= ~(1 << 0);
		if (this.fStart1P) {
			--this.fStart1P;
			this.in[2] |= 1 << 2;
		}
		else
			this.in[2] &= ~(1 << 2);
		if (this.fStart2P) {
			--this.fStart2P;
			this.in[2] |= 1 << 3;
		}
		else
			this.in[2] &= ~(1 << 3);

		// 連射処理
		if (this.fTurbo)
			this.in[0] ^= 1 << 4;
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
		if (fDown)
			this.in[0] = this.in[0] & ~(1 << 3) | 1 << 2;
		else
			this.in[0] &= ~(1 << 2);
	}

	right(fDown) {
		if (fDown)
			this.in[0] = this.in[0] & ~(1 << 1) | 1 << 0;
		else
			this.in[0] &= ~(1 << 0);
	}

	down(fDown) {
		if (fDown)
			this.in[0] = this.in[0] & ~(1 << 2) | 1 << 3;
		else
			this.in[0] &= ~(1 << 3);
	}

	left(fDown) {
		if (fDown)
			this.in[0] = this.in[0] & ~(1 << 0) | 1 << 1;
		else
			this.in[0] &= ~(1 << 1);
	}

	triggerA(fDown) {
		if (fDown)
			this.in[0] |= 1 << 4;
		else
			this.in[0] &= ~(1 << 4);
	}

	triggerB(fDown) {
		if ((this.fTurbo = fDown) === false)
			this.in[0] &= ~(1 << 4);
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
					this.fg[p++] = FG[q + k] >>> j << 2 & 4 | FG[q + k + 0x1000] >>> j << 1 & 2 | FG[q + k + 0x2000] >>> j & 1;
	}

	convertBG() {
		for (let p = 0, q = 0, i = 0; i < 256; q += 32, i++) {
			for (let j = 7; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.bg1[p++] = BG1[q + k + 16] >>> j << 2 & 4 | BG1[q + k + 0x2000 + 16] >>> j << 1 & 2 | BG1[q + k + 0x4000 + 16] >>> j & 1;
				for (let k = 7; k >= 0; --k)
					this.bg1[p++] = BG1[q + k] >>> j << 2 & 4 | BG1[q + k + 0x2000] >>> j << 1 & 2 | BG1[q + k + 0x4000] >>> j & 1;
			}
			for (let j = 7; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.bg1[p++] = BG1[q + k + 24] >>> j << 2 & 4 | BG1[q + k + 0x2000 + 24] >>> j << 1 & 2 | BG1[q + k + 0x4000 + 24] >>> j & 1;
				for (let k = 7; k >= 0; --k)
					this.bg1[p++] = BG1[q + k + 8] >>> j << 2 & 4 | BG1[q + k + 0x2000 + 8] >>> j << 1 & 2 | BG1[q + k + 0x4000 + 8] >>> j & 1;
			}
		}
		for (let p = 0, q = 0, i = 0; i < 256; q += 32, i++) {
			for (let j = 7; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.bg2[p++] = BG2[q + k + 16] >>> j << 2 & 4 | BG2[q + k + 0x2000 + 16] >>> j << 1 & 2 | BG2[q + k + 0x4000 + 16] >>> j & 1;
				for (let k = 7; k >= 0; --k)
					this.bg2[p++] = BG2[q + k] >>> j << 2 & 4 | BG2[q + k + 0x2000] >>> j << 1 & 2 | BG2[q + k + 0x4000] >>> j & 1;
			}
			for (let j = 7; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.bg2[p++] = BG2[q + k + 24] >>> j << 2 & 4 | BG2[q + k + 0x2000 + 24] >>> j << 1 & 2 | BG2[q + k + 0x4000 + 24] >>> j & 1;
				for (let k = 7; k >= 0; --k)
					this.bg2[p++] = BG2[q + k + 8] >>> j << 2 & 4 | BG2[q + k + 0x2000 + 8] >>> j << 1 & 2 | BG2[q + k + 0x4000 + 8] >>> j & 1;
			}
		}
		for (let p = 0, q = 0, i = 0; i < 128; q += 32, i++) {
			for (let j = 7; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.bg3[p++] = BG3[q + k + 16] >>> j << 2 & 4 | BG3[q + k + 0x1000 + 16] >>> j << 1 & 2 | BG3[q + k + 0x2000 + 16] >>> j & 1;
				for (let k = 7; k >= 0; --k)
					this.bg3[p++] = BG3[q + k] >>> j << 2 & 4 | BG3[q + k + 0x1000] >>> j << 1 & 2 | BG3[q + k + 0x2000] >>> j & 1;
			}
			for (let j = 7; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.bg3[p++] = BG3[q + k + 24] >>> j << 2 & 4 | BG3[q + k + 0x1000 + 24] >>> j << 1 & 2 | BG3[q + k + 0x2000 + 24] >>> j & 1;
				for (let k = 7; k >= 0; --k)
					this.bg3[p++] = BG3[q + k + 8] >>> j << 2 & 4 | BG3[q + k + 0x1000 + 8] >>> j << 1 & 2 | BG3[q + k + 0x2000 + 8] >>> j & 1;
			}
		}
	}

	convertOBJ() {
		for (let p = 0, q = 0, i = 0; i < 512; q += 32, i++) {
			for (let j = 7; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 16] >>> j << 2 & 4 | OBJ[q + k + 0x4000 + 16] >>> j << 1 & 2 | OBJ[q + k + 0x8000 + 16] >>> j & 1;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k] >>> j << 2 & 4 | OBJ[q + k + 0x4000] >>> j << 1 & 2 | OBJ[q + k + 0x8000] >>> j & 1;
			}
			for (let j = 7; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 24] >>> j << 2 & 4 | OBJ[q + k + 0x4000 + 24] >>> j << 1 & 2 | OBJ[q + k + 0x8000 + 24] >>> j & 1;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 8] >>> j << 2 & 4 | OBJ[q + k + 0x4000 + 8] >>> j << 1 & 2 | OBJ[q + k + 0x8000 + 8] >>> j & 1;
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
		let k = vScroll + 15 >>> 4 & 0x0f | hScroll & 0x7f0 | 0x2000;
		for (let i = 0; i < 15; k = k + 0x10 & 0x7ff | k & 0xf800, p -= 256 * 16 * 16 + 16, i++)
			for (let j = 0; j < 16; k = k + 1 & 0x0f | k & 0xfff0, p += 256 * 16, j++)
				this.xfer16x16_3(data, p, this.ram[k]);

		// obj描画
		this.drawObj(data, 1);

		// bg描画
		hScroll = (this.ram[0x1e30] | this.ram[0x1e31] << 8) + 15;
		vScroll = this.ram[0x1e35];
		p = 256 * 8 * 2 + 224 + (hScroll & 15) + (-vScroll & 0x0f) * 256;
		k = vScroll + 15 >>> 4 & 0x0f | hScroll & 0x7f0 | 0x2800;
		for (let i = 0; i < 15; k = k + 0x10 & 0x7ff | k & 0xf800, p -= 256 * 16 * 16 + 16, i++)
			for (let j = 0; j < 16; k = k + 1 & 0x0f | k & 0xfff0, p += 256 * 16, j++)
				this.xfer16x16_2(data, p, this.ram[k]);

		// obj描画
		this.drawObj(data, 2);

		// bg描画
		hScroll = (this.ram[0x1e30] | this.ram[0x1e31] << 8) + 15;
		vScroll = this.ram[0x1e35];
		p = 256 * 8 * 2 + 224 + (hScroll & 15) + (-vScroll & 0x0f) * 256;
		k = vScroll + 15 >>> 4 & 0x0f | hScroll & 0x7f0 | 0x3000;
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
			if ((this.ram[k + 1] >>> 4 & 3) !== pri)
				continue;
			const x = this.ram[k + 2] - 1 & 0xff;
			const y = (this.ram[k + 3] - 1 & 0xff) + 16;
			if (this.ram[k] < 0xc0)
				switch (this.ram[k + 1] >>> 6) {
				case 0: // ノーマル
					this.xfer16x16(data, x | y << 8, this.ram[k] | this.ram[k + 1] << 9);
					continue;
				case 1: // V反転
					this.xfer16x16V(data, x | y << 8, this.ram[k] | this.ram[k + 1] << 9);
					continue;
				case 2: // H反転
					this.xfer16x16H(data, x | y << 8, this.ram[k] | this.ram[k + 1] << 9);
					continue;
				case 3: // HV反転
					this.xfer16x16HV(data, x | y << 8, this.ram[k] | this.ram[k + 1] << 9);
					continue;
				}
			const src = this.ram[k] << 2 & 0x1fc | this.ram[k + 1] << 9;
			switch (this.ram[k + 1] >>> 6) {
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

	xfer8x8(data, p, k) {
		const q = (this.ram[k] | this.ram[k + 0x400] << 4 & 0x100) << 6, idx = this.ram[k + 0x400] << 3 & 0x38;
		let px;

		if ((px = this.fg[q | 0x00]) !== 0) data[p + 0x000] = idx | px;
		if ((px = this.fg[q | 0x01]) !== 0) data[p + 0x001] = idx | px;
		if ((px = this.fg[q | 0x02]) !== 0) data[p + 0x002] = idx | px;
		if ((px = this.fg[q | 0x03]) !== 0) data[p + 0x003] = idx | px;
		if ((px = this.fg[q | 0x04]) !== 0) data[p + 0x004] = idx | px;
		if ((px = this.fg[q | 0x05]) !== 0) data[p + 0x005] = idx | px;
		if ((px = this.fg[q | 0x06]) !== 0) data[p + 0x006] = idx | px;
		if ((px = this.fg[q | 0x07]) !== 0) data[p + 0x007] = idx | px;
		if ((px = this.fg[q | 0x08]) !== 0) data[p + 0x100] = idx | px;
		if ((px = this.fg[q | 0x09]) !== 0) data[p + 0x101] = idx | px;
		if ((px = this.fg[q | 0x0a]) !== 0) data[p + 0x102] = idx | px;
		if ((px = this.fg[q | 0x0b]) !== 0) data[p + 0x103] = idx | px;
		if ((px = this.fg[q | 0x0c]) !== 0) data[p + 0x104] = idx | px;
		if ((px = this.fg[q | 0x0d]) !== 0) data[p + 0x105] = idx | px;
		if ((px = this.fg[q | 0x0e]) !== 0) data[p + 0x106] = idx | px;
		if ((px = this.fg[q | 0x0f]) !== 0) data[p + 0x107] = idx | px;
		if ((px = this.fg[q | 0x10]) !== 0) data[p + 0x200] = idx | px;
		if ((px = this.fg[q | 0x11]) !== 0) data[p + 0x201] = idx | px;
		if ((px = this.fg[q | 0x12]) !== 0) data[p + 0x202] = idx | px;
		if ((px = this.fg[q | 0x13]) !== 0) data[p + 0x203] = idx | px;
		if ((px = this.fg[q | 0x14]) !== 0) data[p + 0x204] = idx | px;
		if ((px = this.fg[q | 0x15]) !== 0) data[p + 0x205] = idx | px;
		if ((px = this.fg[q | 0x16]) !== 0) data[p + 0x206] = idx | px;
		if ((px = this.fg[q | 0x17]) !== 0) data[p + 0x207] = idx | px;
		if ((px = this.fg[q | 0x18]) !== 0) data[p + 0x300] = idx | px;
		if ((px = this.fg[q | 0x19]) !== 0) data[p + 0x301] = idx | px;
		if ((px = this.fg[q | 0x1a]) !== 0) data[p + 0x302] = idx | px;
		if ((px = this.fg[q | 0x1b]) !== 0) data[p + 0x303] = idx | px;
		if ((px = this.fg[q | 0x1c]) !== 0) data[p + 0x304] = idx | px;
		if ((px = this.fg[q | 0x1d]) !== 0) data[p + 0x305] = idx | px;
		if ((px = this.fg[q | 0x1e]) !== 0) data[p + 0x306] = idx | px;
		if ((px = this.fg[q | 0x1f]) !== 0) data[p + 0x307] = idx | px;
		if ((px = this.fg[q | 0x20]) !== 0) data[p + 0x400] = idx | px;
		if ((px = this.fg[q | 0x21]) !== 0) data[p + 0x401] = idx | px;
		if ((px = this.fg[q | 0x22]) !== 0) data[p + 0x402] = idx | px;
		if ((px = this.fg[q | 0x23]) !== 0) data[p + 0x403] = idx | px;
		if ((px = this.fg[q | 0x24]) !== 0) data[p + 0x404] = idx | px;
		if ((px = this.fg[q | 0x25]) !== 0) data[p + 0x405] = idx | px;
		if ((px = this.fg[q | 0x26]) !== 0) data[p + 0x406] = idx | px;
		if ((px = this.fg[q | 0x27]) !== 0) data[p + 0x407] = idx | px;
		if ((px = this.fg[q | 0x28]) !== 0) data[p + 0x500] = idx | px;
		if ((px = this.fg[q | 0x29]) !== 0) data[p + 0x501] = idx | px;
		if ((px = this.fg[q | 0x2a]) !== 0) data[p + 0x502] = idx | px;
		if ((px = this.fg[q | 0x2b]) !== 0) data[p + 0x503] = idx | px;
		if ((px = this.fg[q | 0x2c]) !== 0) data[p + 0x504] = idx | px;
		if ((px = this.fg[q | 0x2d]) !== 0) data[p + 0x505] = idx | px;
		if ((px = this.fg[q | 0x2e]) !== 0) data[p + 0x506] = idx | px;
		if ((px = this.fg[q | 0x2f]) !== 0) data[p + 0x507] = idx | px;
		if ((px = this.fg[q | 0x30]) !== 0) data[p + 0x600] = idx | px;
		if ((px = this.fg[q | 0x31]) !== 0) data[p + 0x601] = idx | px;
		if ((px = this.fg[q | 0x32]) !== 0) data[p + 0x602] = idx | px;
		if ((px = this.fg[q | 0x33]) !== 0) data[p + 0x603] = idx | px;
		if ((px = this.fg[q | 0x34]) !== 0) data[p + 0x604] = idx | px;
		if ((px = this.fg[q | 0x35]) !== 0) data[p + 0x605] = idx | px;
		if ((px = this.fg[q | 0x36]) !== 0) data[p + 0x606] = idx | px;
		if ((px = this.fg[q | 0x37]) !== 0) data[p + 0x607] = idx | px;
		if ((px = this.fg[q | 0x38]) !== 0) data[p + 0x700] = idx | px;
		if ((px = this.fg[q | 0x39]) !== 0) data[p + 0x701] = idx | px;
		if ((px = this.fg[q | 0x3a]) !== 0) data[p + 0x702] = idx | px;
		if ((px = this.fg[q | 0x3b]) !== 0) data[p + 0x703] = idx | px;
		if ((px = this.fg[q | 0x3c]) !== 0) data[p + 0x704] = idx | px;
		if ((px = this.fg[q | 0x3d]) !== 0) data[p + 0x705] = idx | px;
		if ((px = this.fg[q | 0x3e]) !== 0) data[p + 0x706] = idx | px;
		if ((px = this.fg[q | 0x3f]) !== 0) data[p + 0x707] = idx | px;
	}

	xfer16x16_1(data, dst, src) {
		const idx = src >>> 4 & 8 | src >>> 1 & 0x30 | 0x40;
		let px;

		src = src << 8 & 0xff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.bg1[src++]) !== 0)
					data[dst] = idx | px;
	}

	xfer16x16_2(data, dst, src) {
		const idx = src >>> 2 & 0x38 | 0x80;
		let px;

		src = src << 8 & 0xff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.bg2[src++]) !== 0)
					data[dst] = idx | px;
	}

	xfer16x16_3(data, dst, src) {
		const idx = src >>> 2 & 0x38 | 0xc0;
		let px;

		src = src << 8 & 0x7f00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.bg3[src++]) !== 0)
					data[dst] = idx | px;
	}

	xfer16x16(data, dst, src) {
		const idx = src >>> 6 & 0x38 | 0x140;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		src = src << 8 & 0x1ff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[src++]) !== 0)
					data[dst] = idx | px;
	}

	xfer16x16V(data, dst, src) {
		const idx = src >>> 6 & 0x38 | 0x140;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		src = (src << 8 & 0x1ff00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[src++]) !== 0)
					data[dst] = idx | px;
	}

	xfer16x16H(data, dst, src) {
		const idx = src >>> 6 & 0x38 | 0x140;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		src = (src << 8 & 0x1ff00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[--src]) !== 0)
					data[dst] = idx | px;
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >>> 6 & 0x38 | 0x140;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		src = (src << 8 & 0x1ff00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[--src]) !== 0)
					data[dst] = idx | px;
	}
}

/*
 *
 *	Star Force
 *
 */

const url = 'starforc.zip';
let PRG1, PRG2, FG, BG1, BG2, BG3, OBJ;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG1 = new Uint8Array((zip.files['3.3p'].inflate() + zip.files['2.3mn'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	PRG2 = new Uint8Array(zip.files['1.3hj'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	FG = new Uint8Array((zip.files['7.2fh'].inflate()+ zip.files['8.3fh'].inflate() + zip.files['9.3fh'].inflate()).split('').map(c => c.charCodeAt(0)));
	BG1 = new Uint8Array((zip.files['15.10jk'].inflate()+ zip.files['14.9jk'].inflate() + zip.files['13.8jk'].inflate()).split('').map(c => c.charCodeAt(0)));
	BG2 = new Uint8Array((zip.files['12.10de'].inflate()+ zip.files['11.9de'].inflate() + zip.files['10.8de'].inflate()).split('').map(c => c.charCodeAt(0)));
	BG3 = new Uint8Array((zip.files['18.10pq'].inflate()+ zip.files['17.9pq'].inflate() + zip.files['16.8pq'].inflate()).split('').map(c => c.charCodeAt(0)));
	OBJ = new Uint8Array((zip.files['6.10lm'].inflate()+ zip.files['5.9lm'].inflate() + zip.files['4.8lm'].inflate()).split('').map(c => c.charCodeAt(0)));
	init({
		game: new StarForce(),
		sound: sound = [
			new SN76496({clock: 2000000, resolution: 3}),
			new SN76496({clock: 2000000, resolution: 3}),
			new SN76496({clock: 2000000, resolution: 3}),
		],
	});
	loop();
}

