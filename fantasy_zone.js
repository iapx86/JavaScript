/*
 *
 *	Fantasy Zone
 *
 */

import YM2151 from './ym2151.js';
import {init, read} from './main.js';
import MC68000 from  './mc68000.js';
import Z80 from './z80.js';
let game, sound;

class FantasyZone {
	cxScreen = 224;
	cyScreen = 320;
	width = 256;
	height = 512;
	xOffset = 16;
	yOffset = 16;
	rotate = true;

	fReset = true;
	fTest = false;
	fDIPSwitchChanged = true;
	fCoin = 0;
	fStart1P = 0;
	fStart2P = 0;
	fTurbo = 0;
	fDemoSound = true;
	nLife = 3;
	nExtraShip = 5000;
	nRank = 'Normal';

	ram = new Uint8Array(0x10000).addBase();
	ram2 = new Uint8Array(0x800).addBase();
	in = Uint8Array.of(0xff, 0xff, 0xff, 0xff, 0xff, 0xfc);
	fm = {addr: 0, reg: new Uint8Array(0x100), status: 0, timera: 0, timerb: 0};
	count = 0;
	command = [];

	bg = new Uint8Array(0x40000);
	rgb = new Uint32Array(0x800).fill(0xff000000);
	mode = new Uint8Array(2);

	cpu = new MC68000();
	cpu2 = new Z80();

	constructor() {
		// CPU周りの初期化
		const range = (page, start, end, mirror = 0) => (page & ~mirror) >= start && (page & ~mirror) <= end;

		for (let page = 0; page < 0x10000; page++)
			if (range(page, 0, 0x2ff, 0x3800))
				this.cpu.memorymap[page].base = PRG1.base[page & 0x3ff];
			else if (range(page, 0x4000, 0x407f, 0xb880)) {
				this.cpu.memorymap[page].base = this.ram.base[page & 0x7f];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0x4100, 0x410f, 0xb8f0)) {
				this.cpu.memorymap[page].base = this.ram.base[0x80 | page & 0xf];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0x4400, 0x4407, 0x3bf8)) {
				this.cpu.memorymap[page].base = this.ram.base[0x90 | page & 7];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0x8400, 0x840f, 0x3bf0)) {
				this.cpu.memorymap[page].base = this.ram.base[0xa0 | page & 0xf];
				this.cpu.memorymap[page].write = null;
				this.cpu.memorymap[page].write16 = (addr, data) => {
					const offset = addr & 0xffe;
					this.ram[0xa000 | offset] = data >> 8, this.ram[0xa001 | offset] = data;
					this.rgb[offset >> 1] = (data >> 12 & 1 | data << 1 & 0x1e) * 255 / 31	// Red
						| (data >> 13 & 1 | data >> 3 & 0x1e) * 255 / 31 << 8				// Green
						| (data >> 14 & 1 | data >> 7 & 0x1e) * 255 / 31 << 16				// Blue
						| 0xff000000;														// Alpha
				};
			} else if (range(page, 0xc400, 0xc43f, 0x39c0)) {
				this.cpu.memorymap[page].read = addr => {
					switch (addr & 0x3000) {
					case 0x1000:
						return this.in[addr >> 1 & 3];
					case 0x2000:
						return this.in[4 | addr >> 1 & 1];
					}
					return 0xff;
				};
				this.cpu.memorymap[page].write = (addr, data) => {
					switch (addr & 0x3007) {
					case 1:
						return this.command.push(data);
					case 3:
						return void(this.mode[0] = data);
					case 5:
						return void(this.mode[1] = data);
					}
				};
			} else if (range(page, 0xc700, 0xc73f, 0x38c0)) {
				this.cpu.memorymap[page].base = this.ram.base[0xc0 | page & 0x3f];
				this.cpu.memorymap[page].write = null;
			}

		for (let i = 0; i < 0x80; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		this.cpu2.memorymap[0xe8].read = addr => addr === 0xe800 && this.command.length ? this.command.shift() : 0xff;
		for (let i = 0; i < 8; i++) {
			this.cpu2.memorymap[0xf8 + i].base = this.ram2.base[i];
			this.cpu2.memorymap[0xf8 + i].write = null;
		}
		for (let i = 0; i < 0x100; i++) {
			this.cpu2.iomap[i].read = addr => {
				switch (addr >> 6 & 3) {
				case 0:
					return (addr & 1) !== 0 ? this.fm.status : 0xff;
				case 3:
					return this.command.length ? this.command.shift() : 0xff;
				}
				return 0xff;
			};
			this.cpu2.iomap[i].write = (addr, data) => {
				if ((addr >> 6 & 3) !== 0)
					return;
				if ((addr & 1) === 0)
					return void(this.fm.addr = data);
				if (this.fm.addr === 0x14) { // CSM/F RESET/IRQEN/LOAD
					this.fm.status &= ~(data >> 4 & 3);
					if ((data & ~this.fm.reg[0x14] & 1) !== 0)
						this.fm.timera = this.fm.reg[0x10] << 2 | this.fm.reg[0x11] & 3;
					if ((data & ~this.fm.reg[0x14] & 2) !== 0)
						this.fm.timerb = this.fm.reg[0x12];
				}
				return sound.write(this.fm.addr, this.fm.reg[this.fm.addr] = data, this.count);
			};
		}

		// Videoの初期化
		this.convertBG();
	}

	execute() {
		this.cpu.interrupt(4);
		this.cpu.execute(0x4000);
		for (this.count = 0; this.count < 65; this.count++) { // 4000000 / 60 / 1024
			this.command.length && this.cpu2.non_maskable_interrupt();
			this.cpu2.execute(128);
			if ((this.fm.reg[0x14] & 1) !== 0 && (this.fm.timera += 16) >= 0x400) {
				this.fm.timera = (this.fm.timera & 0x3ff) + (this.fm.reg[0x10] << 2 | this.fm.reg[0x11] & 3);
				this.fm.status |= this.fm.reg[0x14] >> 2 & 1;
			}
			if ((this.fm.reg[0x14] & 2) !== 0 && ++this.fm.timerb >= 0x100) {
				this.fm.timerb = (this.fm.timerb & 0xff) + this.fm.reg[0x12];
				this.fm.status |= this.fm.reg[0x14] >> 2 & 2;
			}
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
			if (this.fDemoSound)
				this.in[5] &= ~2;
			else
				this.in[5] |= 2;
			switch (this.nLife) {
			case 2:
				this.in[5] = this.in[5] & ~0xc | 8;
				break;
			case 3:
				this.in[5] |= 0xc;
				break;
			case 4:
				this.in[5] = this.in[5] & ~0xc | 4;
				break;
			case 240:
				this.in[5] &= ~0xc;
				break;
			}
			switch (this.nExtraShip) {
			case 5000:
				this.in[5] |= 0x30;
				break;
			case 10000:
				this.in[5] = this.in[5] & ~0x30 | 0x20;
				break;
			case 15000:
				this.in[5] = this.in[5] & ~0x30 | 0x10;
				break;
			case 20000:
				this.in[5] &= ~0x30;
				break;
			}
			switch (this.nRank) {
			case 'Easy':
				this.in[5] = this.in[5] & ~0xc0 | 80;
				break;
			case 'Normal':
				this.in[5] |= 0xc0;
				break;
			case 'Hard':
				this.in[5] = this.in[5] & ~0xc0 | 40;
				break;
			case 'Hardest':
				this.in[5] &= ~0xc0;
				break;
			}
			if (!this.fTest)
				this.fReset = true;
		}

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu.reset();
			this.command.splice(0);
			this.cpu2.reset();
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if (this.fCoin)
			this.in[0] &= ~(1 << 3), --this.fCoin;
		else
			this.in[0] |= 1 << 3;
		if (this.fStart1P)
			this.in[0] &= ~(1 << 4), --this.fStart1P;
		else
			this.in[0] |= 1 << 4;
		if (this.fStart2P)
			this.in[0] &= ~(1 << 5), --this.fStart2P;
		else
			this.in[0] |= 1 << 5;

		// 連射処理
		if (this.fTurbo)
			this.in[1] ^= 1 << 1;
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
			this.in[1] = this.in[1] & ~(1 << 5) | 1 << 4;
		else
			this.in[1] |= 1 << 5;
	}

	right(fDown) {
		if (fDown)
			this.in[1] = this.in[1] & ~(1 << 6) | 1 << 7;
		else
			this.in[1] |= 1 << 6;
	}

	down(fDown) {
		if (fDown)
			this.in[1] = this.in[1] & ~(1 << 4) | 1 << 5;
		else
			this.in[1] |= 1 << 4;
	}

	left(fDown) {
		if (fDown)
			this.in[1] = this.in[1] & ~(1 << 7) | 1 << 6;
		else
			this.in[1] |= 1 << 7;
	}

	triggerA(fDown) {
		if (fDown)
			this.in[1] &= ~(1 << 1);
		else
			this.in[1] |= 1 << 1;
	}

	triggerB(fDown) {
		if (fDown)
			this.in[1] &= ~(1 << 2);
		else
			this.in[1] |= 1 << 2;
	}

	triggerX(fDown) {
		if (fDown)
			this.in[1] &= ~(1 << 0);
		else
			this.in[1] |= 1 << 0;
	}

	triggerY(fDown) {
		if ((this.fTurbo = fDown) === false)
			this.in[1] |= 1 << 1;
	}

	convertBG() {
		for (let p = 0, q = 0, i = 0; i < 4096; q += 8, i++)
			for (let j = 7; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k] >> j & 1 | BG[q + k + 0x8000] >> j << 1 & 2 | BG[q + k + 0x10000] >> j << 2 & 4;
	}

	makeBitmap(data) {
		// 画面クリア
		if ((this.mode[0] & 0x10) === 0) {
			let p = 256 * 16 + 16;
			for (let i = 0; i < 320; p += 256, i++)
				data.fill(0xff000000, p, p + 224);
			return;
		}

		// bg描画
		for (let k = 0; k < 0x1000; k += 2)
			this.xfer8x8(data, k, 0, 0, 0);

		// obj描画
		this.drawObj(data, 0);

		// bg描画
		for (let k = 0; k < 0x1000; k += 2)
			this.xfer8x8(data, k, 0, 0x10, 0);

		// obj描画
		this.drawObj(data, 1);

		// bg描画
		for (let k = 0; k < 0x1000; k += 2)
			this.xfer8x8(data, k, 0, 0x10, 0x10);
		for (let k = 0; k < 0x1000; k += 2)
			this.xfer8x8(data, k, 1, 0x10, 0);

		// obj描画
		this.drawObj(data, 2);

		// bg描画
		for (let k = 0; k < 0x1000; k += 2)
			this.xfer8x8(data, k, 1, 0x10, 0x10);
		for (let k = 0; k < 0x1000; k += 2)
			this.xfer8x8(data, k, 2, 8, 0);

		// obj描画
		this.drawObj(data, 3);

		// bg描画
		for (let k = 0; k < 0x1000; k += 2)
			this.xfer8x8(data, k, 2, 8, 8);

		// palette変換
		let p = 256 * 16 + 16;
		for (let i = 0; i < 320; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] = this.rgb[data[p]];
	}

	drawObj(data, cat) {
		for (let k = 0x9000; k < 0x9800; k += 0x10) {
			const x1 = ~this.ram[k] & 0xff, x0 = ~this.ram[k + 1] & 0xff;
			const y0 = (this.ram[k + 2] << 8 & 0x100 | this.ram[k + 3]) - 173 & 0x1ff;
			if ((this.ram[k + 9] & 3) !== cat || x1 < 0x0f || x0 <= x1)
				continue;
			const pitch = this.ram[k + 4] << 9 | this.ram[k + 5] << 1;
			const idx = this.ram[k + 8] << 4 & 0x3f0 | 0x400, bank = this.ram[k + 9] << 12 & 0x30000;
			for (let addr = this.ram[k + 6] << 9 | this.ram[k + 7] << 1, x = x0; x > x1; --x)
				if (((addr += pitch) & 0x10000) === 0)
					for (let a = addr & 0xfffe, y = y0, px = 0; px !== 0xf && y < y0 + 512; a = a + 2 & 0xfffe, y += 4) {
						let px0 = OBJ[a | bank], px1 = OBJ[1 | a | bank];
						if ((px = px0 >> 4) !== 0 && px !== 0xf)
							data[x - 17 & 0xff | y << 8 & 0x1ff00] = idx | px;
						if ((px = px0 & 0xf) !== 0 && px !== 0xf)
							data[x - 17 & 0xff | y + 1 << 8 & 0x1ff00] = idx | px;
						if ((px = px1 >> 4) !== 0 && px !== 0xf)
							data[x - 17 & 0xff | y + 2 << 8 & 0x1ff00] = idx | px;
						if ((px = px1 & 0xf) !== 0 && px !== 0xf)
							data[x - 17 & 0xff | y + 3 << 8 & 0x1ff00] = idx | px;
					}
				else
					for (let a = addr & 0xfffe, y = y0, px = 0; px !== 0xf && y < y0 + 512; a = a - 2 & 0xfffe, y += 4) {
						let px0 = OBJ[a | bank], px1 = OBJ[1 | a | bank];
						if ((px = px1 & 0xf) !== 0 && px !== 0xf)
							data[x - 17 & 0xff | y << 8 & 0x1ff00] = idx | px;
						if ((px = px1 >> 4) !== 0 && px !== 0xf)
							data[x - 17 & 0xff | y + 1 << 8 & 0x1ff00] = idx | px;
						if ((px = px0 & 0xf) !== 0 && px !== 0xf)
							data[x - 17 & 0xff | y + 2 << 8 & 0x1ff00] = idx | px;
						if ((px = px0 >> 4) !== 0 && px !== 0xf)
							data[x - 17 & 0xff | y + 3 << 8 & 0x1ff00] = idx | px;
					}
		}
	}

	xfer8x8(data, k, layer, mask, cmp) {
		let x0 = ~k >> 4 & 0xf8, y0 = k << 2 & 0x1f8;
		let x, y, page, p, q, idx, px;
		switch (layer) {
		case 0:
			x = x0 + this.ram[0x8f27] & 0xff;
			y = (y0 = y0 - 8 & 0x1f8) + (this.ram[0x8ffa] << 8 | this.ram[0x8ffb]) & 0x1ff;
			page = this.ram[0x8e9c | x >= x0] << 8 + (y0 < 504 ? y < y0 : y >= y0) * 4 & 0x7000;
			break;
		case 1:
			x = x0 + this.ram[0x8f25] & 0xff;
			y = (y0 = y0 - 8 & 0x1f8) + (this.ram[0x8ff8] << 8 | this.ram[0x8ff9]) & 0x1ff;
			page = this.ram[0x8e9e | x >= x0] << 8 + (y0 < 504 ? y < y0 : y >= y0) * 4 & 0x7000;
			break;
		case 2:
			x = x0;
			y = y0;
			page = 0x8000;
			break;
		}
		if ((this.ram[k | page] & mask) !== cmp || (x = x - 16 & 0xff) <= 8 || x >= 240 || (y = y - 176 & 0x1ff) <= 8 || y >= 336)
			return;
		p = x | y << 8;
		switch (layer) {
		case 0:
		case 1:
			q = (this.ram[k | page] << 8 & 0xf00 | this.ram[k | page | 1]) << 6;
			idx = this.ram[k | page] << 6 & 0x3c0 | this.ram[k | page | 1] >> 2 & 0x38;
			break;
		case 2:
			q = this.ram[k | page | 1] << 6;
			idx = this.ram[k | page] << 3 & 0x38;
			break;
		}

		if (mask === 0) {
			data[p + 0x000] = idx | this.bg[q | 0x00];
			data[p + 0x001] = idx | this.bg[q | 0x01];
			data[p + 0x002] = idx | this.bg[q | 0x02];
			data[p + 0x003] = idx | this.bg[q | 0x03];
			data[p + 0x004] = idx | this.bg[q | 0x04];
			data[p + 0x005] = idx | this.bg[q | 0x05];
			data[p + 0x006] = idx | this.bg[q | 0x06];
			data[p + 0x007] = idx | this.bg[q | 0x07];
			data[p + 0x100] = idx | this.bg[q | 0x08];
			data[p + 0x101] = idx | this.bg[q | 0x09];
			data[p + 0x102] = idx | this.bg[q | 0x0a];
			data[p + 0x103] = idx | this.bg[q | 0x0b];
			data[p + 0x104] = idx | this.bg[q | 0x0c];
			data[p + 0x105] = idx | this.bg[q | 0x0d];
			data[p + 0x106] = idx | this.bg[q | 0x0e];
			data[p + 0x107] = idx | this.bg[q | 0x0f];
			data[p + 0x200] = idx | this.bg[q | 0x10];
			data[p + 0x201] = idx | this.bg[q | 0x11];
			data[p + 0x202] = idx | this.bg[q | 0x12];
			data[p + 0x203] = idx | this.bg[q | 0x13];
			data[p + 0x204] = idx | this.bg[q | 0x14];
			data[p + 0x205] = idx | this.bg[q | 0x15];
			data[p + 0x206] = idx | this.bg[q | 0x16];
			data[p + 0x207] = idx | this.bg[q | 0x17];
			data[p + 0x300] = idx | this.bg[q | 0x18];
			data[p + 0x301] = idx | this.bg[q | 0x19];
			data[p + 0x302] = idx | this.bg[q | 0x1a];
			data[p + 0x303] = idx | this.bg[q | 0x1b];
			data[p + 0x304] = idx | this.bg[q | 0x1c];
			data[p + 0x305] = idx | this.bg[q | 0x1d];
			data[p + 0x306] = idx | this.bg[q | 0x1e];
			data[p + 0x307] = idx | this.bg[q | 0x1f];
			data[p + 0x400] = idx | this.bg[q | 0x20];
			data[p + 0x401] = idx | this.bg[q | 0x21];
			data[p + 0x402] = idx | this.bg[q | 0x22];
			data[p + 0x403] = idx | this.bg[q | 0x23];
			data[p + 0x404] = idx | this.bg[q | 0x24];
			data[p + 0x405] = idx | this.bg[q | 0x25];
			data[p + 0x406] = idx | this.bg[q | 0x26];
			data[p + 0x407] = idx | this.bg[q | 0x27];
			data[p + 0x500] = idx | this.bg[q | 0x28];
			data[p + 0x501] = idx | this.bg[q | 0x29];
			data[p + 0x502] = idx | this.bg[q | 0x2a];
			data[p + 0x503] = idx | this.bg[q | 0x2b];
			data[p + 0x504] = idx | this.bg[q | 0x2c];
			data[p + 0x505] = idx | this.bg[q | 0x2d];
			data[p + 0x506] = idx | this.bg[q | 0x2e];
			data[p + 0x507] = idx | this.bg[q | 0x2f];
			data[p + 0x600] = idx | this.bg[q | 0x30];
			data[p + 0x601] = idx | this.bg[q | 0x31];
			data[p + 0x602] = idx | this.bg[q | 0x32];
			data[p + 0x603] = idx | this.bg[q | 0x33];
			data[p + 0x604] = idx | this.bg[q | 0x34];
			data[p + 0x605] = idx | this.bg[q | 0x35];
			data[p + 0x606] = idx | this.bg[q | 0x36];
			data[p + 0x607] = idx | this.bg[q | 0x37];
			data[p + 0x700] = idx | this.bg[q | 0x38];
			data[p + 0x701] = idx | this.bg[q | 0x39];
			data[p + 0x702] = idx | this.bg[q | 0x3a];
			data[p + 0x703] = idx | this.bg[q | 0x3b];
			data[p + 0x704] = idx | this.bg[q | 0x3c];
			data[p + 0x705] = idx | this.bg[q | 0x3d];
			data[p + 0x706] = idx | this.bg[q | 0x3e];
			data[p + 0x707] = idx | this.bg[q | 0x3f];
			return;
		}

		if ((px = this.bg[q | 0x00]) !== 0) data[p + 0x000] = idx | px;
		if ((px = this.bg[q | 0x01]) !== 0) data[p + 0x001] = idx | px;
		if ((px = this.bg[q | 0x02]) !== 0) data[p + 0x002] = idx | px;
		if ((px = this.bg[q | 0x03]) !== 0) data[p + 0x003] = idx | px;
		if ((px = this.bg[q | 0x04]) !== 0) data[p + 0x004] = idx | px;
		if ((px = this.bg[q | 0x05]) !== 0) data[p + 0x005] = idx | px;
		if ((px = this.bg[q | 0x06]) !== 0) data[p + 0x006] = idx | px;
		if ((px = this.bg[q | 0x07]) !== 0) data[p + 0x007] = idx | px;
		if ((px = this.bg[q | 0x08]) !== 0) data[p + 0x100] = idx | px;
		if ((px = this.bg[q | 0x09]) !== 0) data[p + 0x101] = idx | px;
		if ((px = this.bg[q | 0x0a]) !== 0) data[p + 0x102] = idx | px;
		if ((px = this.bg[q | 0x0b]) !== 0) data[p + 0x103] = idx | px;
		if ((px = this.bg[q | 0x0c]) !== 0) data[p + 0x104] = idx | px;
		if ((px = this.bg[q | 0x0d]) !== 0) data[p + 0x105] = idx | px;
		if ((px = this.bg[q | 0x0e]) !== 0) data[p + 0x106] = idx | px;
		if ((px = this.bg[q | 0x0f]) !== 0) data[p + 0x107] = idx | px;
		if ((px = this.bg[q | 0x10]) !== 0) data[p + 0x200] = idx | px;
		if ((px = this.bg[q | 0x11]) !== 0) data[p + 0x201] = idx | px;
		if ((px = this.bg[q | 0x12]) !== 0) data[p + 0x202] = idx | px;
		if ((px = this.bg[q | 0x13]) !== 0) data[p + 0x203] = idx | px;
		if ((px = this.bg[q | 0x14]) !== 0) data[p + 0x204] = idx | px;
		if ((px = this.bg[q | 0x15]) !== 0) data[p + 0x205] = idx | px;
		if ((px = this.bg[q | 0x16]) !== 0) data[p + 0x206] = idx | px;
		if ((px = this.bg[q | 0x17]) !== 0) data[p + 0x207] = idx | px;
		if ((px = this.bg[q | 0x18]) !== 0) data[p + 0x300] = idx | px;
		if ((px = this.bg[q | 0x19]) !== 0) data[p + 0x301] = idx | px;
		if ((px = this.bg[q | 0x1a]) !== 0) data[p + 0x302] = idx | px;
		if ((px = this.bg[q | 0x1b]) !== 0) data[p + 0x303] = idx | px;
		if ((px = this.bg[q | 0x1c]) !== 0) data[p + 0x304] = idx | px;
		if ((px = this.bg[q | 0x1d]) !== 0) data[p + 0x305] = idx | px;
		if ((px = this.bg[q | 0x1e]) !== 0) data[p + 0x306] = idx | px;
		if ((px = this.bg[q | 0x1f]) !== 0) data[p + 0x307] = idx | px;
		if ((px = this.bg[q | 0x20]) !== 0) data[p + 0x400] = idx | px;
		if ((px = this.bg[q | 0x21]) !== 0) data[p + 0x401] = idx | px;
		if ((px = this.bg[q | 0x22]) !== 0) data[p + 0x402] = idx | px;
		if ((px = this.bg[q | 0x23]) !== 0) data[p + 0x403] = idx | px;
		if ((px = this.bg[q | 0x24]) !== 0) data[p + 0x404] = idx | px;
		if ((px = this.bg[q | 0x25]) !== 0) data[p + 0x405] = idx | px;
		if ((px = this.bg[q | 0x26]) !== 0) data[p + 0x406] = idx | px;
		if ((px = this.bg[q | 0x27]) !== 0) data[p + 0x407] = idx | px;
		if ((px = this.bg[q | 0x28]) !== 0) data[p + 0x500] = idx | px;
		if ((px = this.bg[q | 0x29]) !== 0) data[p + 0x501] = idx | px;
		if ((px = this.bg[q | 0x2a]) !== 0) data[p + 0x502] = idx | px;
		if ((px = this.bg[q | 0x2b]) !== 0) data[p + 0x503] = idx | px;
		if ((px = this.bg[q | 0x2c]) !== 0) data[p + 0x504] = idx | px;
		if ((px = this.bg[q | 0x2d]) !== 0) data[p + 0x505] = idx | px;
		if ((px = this.bg[q | 0x2e]) !== 0) data[p + 0x506] = idx | px;
		if ((px = this.bg[q | 0x2f]) !== 0) data[p + 0x507] = idx | px;
		if ((px = this.bg[q | 0x30]) !== 0) data[p + 0x600] = idx | px;
		if ((px = this.bg[q | 0x31]) !== 0) data[p + 0x601] = idx | px;
		if ((px = this.bg[q | 0x32]) !== 0) data[p + 0x602] = idx | px;
		if ((px = this.bg[q | 0x33]) !== 0) data[p + 0x603] = idx | px;
		if ((px = this.bg[q | 0x34]) !== 0) data[p + 0x604] = idx | px;
		if ((px = this.bg[q | 0x35]) !== 0) data[p + 0x605] = idx | px;
		if ((px = this.bg[q | 0x36]) !== 0) data[p + 0x606] = idx | px;
		if ((px = this.bg[q | 0x37]) !== 0) data[p + 0x607] = idx | px;
		if ((px = this.bg[q | 0x38]) !== 0) data[p + 0x700] = idx | px;
		if ((px = this.bg[q | 0x39]) !== 0) data[p + 0x701] = idx | px;
		if ((px = this.bg[q | 0x3a]) !== 0) data[p + 0x702] = idx | px;
		if ((px = this.bg[q | 0x3b]) !== 0) data[p + 0x703] = idx | px;
		if ((px = this.bg[q | 0x3c]) !== 0) data[p + 0x704] = idx | px;
		if ((px = this.bg[q | 0x3d]) !== 0) data[p + 0x705] = idx | px;
		if ((px = this.bg[q | 0x3e]) !== 0) data[p + 0x706] = idx | px;
		if ((px = this.bg[q | 0x3f]) !== 0) data[p + 0x707] = idx | px;
	}
}

/*
 *
 *	Fantasy Zone
 *
 */

const PRG1 = new Uint8Array(0x30000).addBase(), OBJ = new Uint8Array(0x30000);
let BG, PRG2;

read('fantzone.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	zip.decompress('epr-7385a.43').forEach((e, i) => PRG1[i << 1] = e);
	zip.decompress('epr-7382a.26').forEach((e, i) => PRG1[1 | i << 1] = e);
	zip.decompress('epr-7386a.42').forEach((e, i) => PRG1[0x10000 | i << 1] = e);
	zip.decompress('epr-7383a.25').forEach((e, i) => PRG1[0x10001 | i << 1] = e);
	zip.decompress('epr-7387.41').forEach((e, i) => PRG1[0x20000 | i << 1] = e);
	zip.decompress('epr-7384.24').forEach((e, i) => PRG1[0x20001 | i << 1] = e);
	BG = Uint8Array.concat(...['epr-7388.95', 'epr-7389.94', 'epr-7390.93'].map(e => zip.decompress(e)));
	zip.decompress('epr-7392.10').forEach((e, i) => OBJ[1 | i << 1] = e);
	zip.decompress('epr-7396.11').forEach((e, i) => OBJ[i << 1] = e);
	zip.decompress('epr-7393.17').forEach((e, i) => OBJ[0x10001 | i << 1] = e);
	zip.decompress('epr-7397.18').forEach((e, i) => OBJ[0x10000 | i << 1] = e);
	zip.decompress('epr-7394.23').forEach((e, i) => OBJ[0x20001 | i << 1] = e);
	zip.decompress('epr-7398.24').forEach((e, i) => OBJ[0x20000 | i << 1] = e);
	PRG2 = zip.decompress('epr-7535a.12').addBase();
	game = new FantasyZone();
	sound = new YM2151({clock: 4000000, resolution: 65});
	canvas.addEventListener('click', () => game.coin());
	init({game, sound});
});

