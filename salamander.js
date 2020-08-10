/*
 *
 *	Salamander
 *
 */

import YM2151 from './ym2151.js';
import K007232 from './k007232.js';
import VLM5030 from './vlm5030.js';
import {init, loop} from './main.js';
import MC68000 from  './mc68000.js';
import Z80 from './z80.js';
let sound;

class Salamander {
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
		this.nRank = 'Normal';
		this.fDemoSound = true;

		// CPU周りの初期化
		this.fInterruptEnable = false;

		this.ram = new Uint8Array(0x20000).addBase();
		this.ram2 = new Uint8Array(0x800).addBase();
		this.in = Uint8Array.of(0xff, 0x42, 0xe0, 0, 0);
		this.fm = {addr: 0, reg: new Uint8Array(0x100), status: 0, timera: 0, timerb: 0};
		this.vlm_latch = 0;
		this.vlm_control = 0;
		this.count = 0;
		this.command = [];
		this.wd = 0;

		this.cpu = new MC68000(this);
		for (let i = 0; i < 0x200; i++)
			this.cpu.memorymap[i].base = PRG1.base[i];
		for (let i = 0; i < 0x400; i++)
			this.cpu.memorymap[0x400 + i].base = PRG1.base[0x200 + i];
 		for (let i = 0; i < 0x80; i++) {
			this.cpu.memorymap[0x800 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x800 + i].write = null;
		}
		for (let i = 0; i < 0x20; i++) {
			this.cpu.memorymap[0x900 + i].read = addr => (addr & 1) !== 0 ? this.ram[0x8000 | addr >> 1 & 0xfff] : 0;
			this.cpu.memorymap[0x900 + i].write = (addr, data) => void((addr & 1) !== 0 && (this.ram[0x8000 | addr >> 1 & 0xfff] = data));
		}
		this.cpu.memorymap[0xa00].write = (addr, data) => {
			if (addr === 0xa0001) {
				this.fInterruptEnable = (data & 1) !== 0;
				this.flip = data >> 2 & 3;
			}
		};
		this.cpu.memorymap[0xc00].read = addr => addr === 0xc0003 ? this.in[0] : 0xff;
		this.cpu.memorymap[0xc00].write = (addr, data) => void(addr === 0xc0001 && this.command.push(data));
		this.cpu.memorymap[0xc20].read = addr => {
			switch (addr & 0xff) {
			case 1:
				return this.in[2];
			case 3:
				return this.in[3];
			case 5:
				return this.in[4];
			case 7:
				return this.in[1];
			}
			return 0xff;
		};
		for (let i = 0; i < 0x40; i++) {
			this.cpu.memorymap[0x1000 + i].base = this.ram.base[0x90 + i];
			this.cpu.memorymap[0x1000 + i].write = null;
		}
		for (let i = 0; i < 0x100; i++) {
			this.cpu.memorymap[0x1200 + i].base = this.ram.base[0x100 + i];
			this.cpu.memorymap[0x1200 + i].write = (addr, data) => {
				let offset = addr & 0xffff;
				this.ram[0x10000 | offset] = data;
				this.chr[offset <<= 1] = data >> 4;
				this.chr[1 | offset] = data & 0xf;
			};
		}
		for (let i = 0; i < 0x10; i++) {
			this.cpu.memorymap[0x1800 + i].base = this.ram.base[0xd0 + i];
			this.cpu.memorymap[0x1800 + i].write = null;
		}
		for (let i = 0; i < 0x20; i++) {
			this.cpu.memorymap[0x1900 + i].base = this.ram.base[0xe0 + i];
			this.cpu.memorymap[0x1900 + i].write = null;
		}

		this.cpu2 = new Z80(this);
		for (let i = 0; i < 0x80; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 8; i++) {
			this.cpu2.memorymap[0x80 + i].base = this.ram2.base[i];
			this.cpu2.memorymap[0x80 + i].write = null;
		}
		this.cpu2.memorymap[0xa0].read = addr => addr === 0xa000 && this.command.length ? this.command.shift() : 0xff;
		this.cpu2.memorymap[0xb0].read = addr => addr < 0xb00e ? sound[1].read(addr, this.count) : 0xff;
		this.cpu2.memorymap[0xb0].write = (addr, data) => void(addr < 0xb00e && sound[1].write(addr, data, this.count));
		this.cpu2.memorymap[0xc0].read = addr => addr === 0xc001 ? this.fm.status : 0xff;
		this.cpu2.memorymap[0xc0].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				return void(this.fm.addr = data);
			case 1:
				if (this.fm.addr === 0x14) { // CSM/F RESET/IRQEN/LOAD
					this.fm.status &= ~(data >> 4 & 3);
					if ((data & ~this.fm.reg[0x14] & 1) !== 0)
						this.fm.timera = this.fm.reg[0x10] << 2 | this.fm.reg[0x11] & 3;
					if ((data & ~this.fm.reg[0x14] & 2) !== 0)
						this.fm.timerb = this.fm.reg[0x12];
				}
				return sound[0].write(this.fm.addr, this.fm.reg[this.fm.addr] = data, this.count);
			}
		};
		this.cpu2.memorymap[0xd0].write = (addr, data) => void(addr === 0xd000 && (this.vlm_latch = data));
		this.cpu2.memorymap[0xe0].read = addr => addr === 0xe000 ? this.wd ^= 1 : 0xff;
		this.cpu2.memorymap[0xf0].write = (addr, data) => {
			if (addr === 0xf000) {
				if ((~data & this.vlm_control & 1) !== 0)
					sound[2].rst(this.vlm_latch);
				if ((~data & this.vlm_control & 2) !== 0)
					sound[2].st(this.vlm_latch);
				this.vlm_control = data;
			}
		};

		// Videoの初期化
		this.chr = new Uint8Array(0x20000);
		this.rgb = new Uint32Array(0x800);
		this.flip = 0;
	}

	execute() {
		if (this.fInterruptEnable)
			this.cpu.interrupt(1);
		this.cpu.execute(0x4000);
		for (this.count = 0; this.count < 58; this.count++) { // 14318180 / 4 / 60 / 1024
			this.command.length && this.cpu2.interrupt();
			this.cpu2.execute(146);
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
			switch (this.nLife) {
			case 2:
				this.in[1] |= 3;
				break;
			case 3:
				this.in[1] = this.in[1] & ~3 | 2;
				break;
			case 5:
				this.in[1] = this.in[1] & ~3 | 1;
				break;
			case 7:
				this.in[1] &= ~3;
				break;
			}
			switch (this.nRank) {
			case 'Easy':
				this.in[1] |= 0x60;
				break;
			case 'Normal':
				this.in[1] = this.in[1] & ~0x60 | 0x40;
				break;
			case 'Hard':
				this.in[1] = this.in[1] & ~0x60 | 0x20;
				break;
			case 'Hardest':
				this.in[1] &= ~0x60;
				break;
			}
			if (this.fDemoSound)
				this.in[1] &= ~0x80;
			else
				this.in[1] |= 0x80;
			if (!this.fTest)
				this.fReset = true;
		}

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.fInterruptEnable = false;
			this.cpu.reset();
			this.command.splice(0);
			this.cpu2.reset();
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if (this.fCoin) {
			--this.fCoin;
			this.in[2] |= 1 << 2;
		}
		else
			this.in[2] &= ~(1 << 2);
		if (this.fStart1P) {
			--this.fStart1P;
			this.in[2] |= 1 << 3;
		}
		else
			this.in[2] &= ~(1 << 3);
		if (this.fStart2P) {
			--this.fStart2P;
			this.in[2] |= 1 << 4;
		}
		else
			this.in[2] &= ~(1 << 4);

		// 連射処理
		if (this.fTurbo)
			this.in[3] ^= 1 << 4;
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
			this.in[3] = this.in[3] & ~(1 << 3) | 1 << 2;
		else
			this.in[3] &= ~(1 << 2);
	}

	right(fDown) {
		if (fDown)
			this.in[3] = this.in[3] & ~(1 << 0) | 1 << 1;
		else
			this.in[3] &= ~(1 << 1);
	}

	down(fDown) {
		if (fDown)
			this.in[3] = this.in[3] & ~(1 << 2) | 1 << 3;
		else
			this.in[3] &= ~(1 << 3);
	}

	left(fDown) {
		if (fDown)
			this.in[3] = this.in[3] & ~(1 << 1) | 1 << 0;
		else
			this.in[3] &= ~(1 << 0);
	}

	triggerA(fDown) {
		if (fDown)
			this.in[3] |= 1 << 4;
		else
			this.in[3] &= ~(1 << 4);
	}

	triggerB(fDown) {
		if (fDown)
			this.in[3] |= 1 << 5;
		else
			this.in[3] &= ~(1 << 5);
	}

	triggerY(fDown) {
		if ((this.fTurbo = fDown) === false)
			this.in[3] &= ~(1 << 4);
	}

	convertRGB() {
		for (let i = 0; i < 0x800; i++) {
			const data = this.ram[0x8000 | i << 1] << 8 | this.ram[0x8001 | i << 1];
			this.rgb[i] = (data & 0x1f) * 255 / 31		// Red
				| (data >> 5 & 0x1f) * 255 / 31 << 8	// Green
				| (data >> 10 & 0x1f) * 255 / 31 << 16	// Blue
				| 0xff000000;							// Alpha
		}
	}

	makeBitmap(data) {
		this.convertRGB();

		// 画面クリア
		let p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256, i++)
			data.fill(0, p, p + 224);

		// bg描画
		for (let k = 0x9000; k < 0xa000; k += 2)
			if ((this.ram[k] & 0x50) === 0 && (this.ram[k] & 0xf8) !== 0)
				this.xfer8x8(data, k);
		for (let k = 0xa000; k < 0xb000; k += 2)
			if ((this.ram[k] & 0x50) === 0 && (this.ram[k] & 0xf8) !== 0)
				this.xfer8x8(data, k);
		for (let k = 0x9000; k < 0xa000; k += 2)
			if ((this.ram[k] & 0x50) === 0x40 && (this.ram[k] & 0xf8) !== 0)
				this.xfer8x8(data, k);
		for (let k = 0xa000; k < 0xb000; k += 2)
			if ((this.ram[k] & 0x50) === 0x40 && (this.ram[k] & 0xf8) !== 0)
				this.xfer8x8(data, k);

		// obj描画
		const size = [[32, 32], [16, 32], [32, 16], [64, 64], [8, 8], [16, 8], [8, 16], [16, 16]];
		for (let pri = 0; pri < 256; pri++)
			for (let k = 0xd000; k < 0xe000; k += 0x10) {
				if (this.ram[k + 1] !== pri)
					continue;
				let zoom = this.ram[k + 5];
				let src = this.ram[k + 9] << 9 & 0x18000 | this.ram[k + 7] << 7;
				if (this.ram[k + 4] === 0 && this.ram[k + 6] !== 0xff)
					src = src + (this.ram[k + 6] << 15) & 0x1ff80;
				if (zoom === 0xff && src === 0 || (zoom |= this.ram[k + 3] << 2 & 0x300) === 0)
					continue;
				const color = this.ram[k + 9] << 3 & 0xf0;
				const y = (this.ram[k + 9] << 8 | this.ram[k + 11]) + 16 & 0x1ff;
				const x = ~this.ram[k + 13] & 0xff;
				const [h, w] = size[this.ram[k + 3] >> 3 & 7];
				switch (this.ram[k + 9] >> 4 & 2 | this.ram[k + 3] & 1) {
				case 0:
					this.xferHxW(data, src, color, y, x, h, w, zoom);
					break;
				case 1:
					this.xferHxW_V(data, src, color, y, x, h, w, zoom);
					break;
				case 2:
					this.xferHxW_H(data, src, color, y, x, h, w, zoom);
					break;
				case 3:
					this.xferHxW_HV(data, src, color, y, x, h, w, zoom);
					break;
				}
			}

		// bg描画
		for (let k = 0x9000; k < 0xa000; k += 2)
			if ((this.ram[k] & 0x10) === 0x10 && (this.ram[k] & 0xf8) !== 0)
				this.xfer8x8(data, k);
		for (let k = 0xa000; k < 0xb000; k += 2)
			if ((this.ram[k] & 0x10) === 0x10 && (this.ram[k] & 0xf8) !== 0)
				this.xfer8x8(data, k);

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] = this.rgb[data[p]];
	}

	xfer8x8(data, k) {
		const x0 = (((this.flip & 2) === 0 ? ~k : k) >> 4 & 0xf8 | 7) + this.ram[0xef01 | k >> 5 & 0x80 | k & 0x7e] & 0xff;
		const color = this.ram[k + 0x2001] << 4 & 0x7f0;
		let src = (this.ram[k] << 8 & 0x700 | this.ram[k + 1]) << 6, px;

		if (x0 < 16 && x0 >= 247)
			return;
		if ((this.ram[k] & 0x20) === 0 || (this.ram[k] & 0xc0) === 0x40)
			switch ((this.ram[k] >> 2 & 2 | this.ram[k + 0x2001] >> 7) ^ this.flip) {
			case 0: // ノーマル
				for (let x = x0, i = 0; i < 8; src += 8, --x, i++) {
					const offset = ~k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0xe001 | offset] | this.ram[0xe201 | offset] << 8;
					const y = (k << 2) - scroll + 16 & 0x1ff;
					if (y > 8 && y < 272) {
						data[y << 8 | x] = color | this.chr[src | 0];
						data[y + 1 << 8 | x] = color | this.chr[src | 1];
						data[y + 2 << 8 | x] = color | this.chr[src | 2];
						data[y + 3 << 8 | x] = color | this.chr[src | 3];
						data[y + 4 << 8 | x] = color | this.chr[src | 4];
						data[y + 5 << 8 | x] = color | this.chr[src | 5];
						data[y + 6 << 8 | x] = color | this.chr[src | 6];
						data[y + 7 << 8 | x] = color | this.chr[src | 7];
					}
				}
				return;
			case 1: // V反転
				for (let x = x0, i = 0; i < 8; src += 8, --x, i++){
					const offset = ~k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0xe001 | offset] | this.ram[0xe201 | offset] << 8;
					const y = (k << 2) - scroll + 16 & 0x1ff;
					if (y > 8 && y < 272) {
						data[y + 7 << 8 | x] = color | this.chr[src | 0];
						data[y + 6 << 8 | x] = color | this.chr[src | 1];
						data[y + 5 << 8 | x] = color | this.chr[src | 2];
						data[y + 4 << 8 | x] = color | this.chr[src | 3];
						data[y + 3 << 8 | x] = color | this.chr[src | 4];
						data[y + 2 << 8 | x] = color | this.chr[src | 5];
						data[y + 1 << 8 | x] = color | this.chr[src | 6];
						data[y << 8 | x] = color | this.chr[src | 7];
					}
				}
				return;
			case 2: // H反転
				for (let x = x0 - 7, i = 0; i < 8; src += 8, x++, i++) {
					const offset = ~k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0xe001 | offset] | this.ram[0xe201 | offset] << 8;
					const y = (k << 2) - scroll + 16 & 0x1ff;
					if (y > 8 && y < 272) {
						data[y << 8 | x] = color | this.chr[src | 0];
						data[y + 1 << 8 | x] = color | this.chr[src | 1];
						data[y + 2 << 8 | x] = color | this.chr[src | 2];
						data[y + 3 << 8 | x] = color | this.chr[src | 3];
						data[y + 4 << 8 | x] = color | this.chr[src | 4];
						data[y + 5 << 8 | x] = color | this.chr[src | 5];
						data[y + 6 << 8 | x] = color | this.chr[src | 6];
						data[y + 7 << 8 | x] = color | this.chr[src | 7];
					}
				}
				return;
			case 3: // HV反転
				for (let x = x0 - 7, i = 0; i < 8; src += 8, x++, i++) {
					const offset = ~k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0xe001 | offset] | this.ram[0xe201 | offset] << 8;
					const y = (k << 2) - scroll + 16 & 0x1ff;
					if (y > 8 && y < 272) {
						data[y + 7 << 8 | x] = color | this.chr[src | 0];
						data[y + 6 << 8 | x] = color | this.chr[src | 1];
						data[y + 5 << 8 | x] = color | this.chr[src | 2];
						data[y + 4 << 8 | x] = color | this.chr[src | 3];
						data[y + 3 << 8 | x] = color | this.chr[src | 4];
						data[y + 2 << 8 | x] = color | this.chr[src | 5];
						data[y + 1 << 8 | x] = color | this.chr[src | 6];
						data[y << 8 | x] = color | this.chr[src | 7];
					}
				}
				return;
			}
		switch ((this.ram[k] >> 2 & 2 | this.ram[k + 0x2001] >> 7) ^ this.flip) {
		case 0: // ノーマル
			for (let x = x0, i = 0; i < 8; src += 8, --x, i++) {
				const offset = ~k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0xe001 | offset] | this.ram[0xe201 | offset] << 8;
				const y = (k << 2) - scroll + 16 & 0x1ff;
				if (y > 8 && y < 272) {
					if ((px = this.chr[src | 0]) !== 0) data[y << 8 | x] = color | px;
					if ((px = this.chr[src | 1]) !== 0) data[y + 1 << 8 | x] = color | px;
					if ((px = this.chr[src | 2]) !== 0) data[y + 2 << 8 | x] = color | px;
					if ((px = this.chr[src | 3]) !== 0) data[y + 3 << 8 | x] = color | px;
					if ((px = this.chr[src | 4]) !== 0) data[y + 4 << 8 | x] = color | px;
					if ((px = this.chr[src | 5]) !== 0) data[y + 5 << 8 | x] = color | px;
					if ((px = this.chr[src | 6]) !== 0) data[y + 6 << 8 | x] = color | px;
					if ((px = this.chr[src | 7]) !== 0) data[y + 7 << 8 | x] = color | px;
				}
			}
			break;
		case 1: // V反転
			for (let x = x0, i = 0; i < 8; src += 8, --x, i++){
				const offset = ~k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0xe001 | offset] | this.ram[0xe201 | offset] << 8;
				const y = (k << 2) - scroll + 16 & 0x1ff;
				if (y > 8 && y < 272) {
					if ((px = this.chr[src | 0]) !== 0) data[y + 7 << 8 | x] = color | px;
					if ((px = this.chr[src | 1]) !== 0) data[y + 6 << 8 | x] = color | px;
					if ((px = this.chr[src | 2]) !== 0) data[y + 5 << 8 | x] = color | px;
					if ((px = this.chr[src | 3]) !== 0) data[y + 4 << 8 | x] = color | px;
					if ((px = this.chr[src | 4]) !== 0) data[y + 3 << 8 | x] = color | px;
					if ((px = this.chr[src | 5]) !== 0) data[y + 2 << 8 | x] = color | px;
					if ((px = this.chr[src | 6]) !== 0) data[y + 1 << 8 | x] = color | px;
					if ((px = this.chr[src | 7]) !== 0) data[y << 8 | x] = color | px;
				}
			}
			break;
		case 2: // H反転
			for (let x = x0 - 7, i = 0; i < 8; src += 8, x++, i++) {
				const offset = ~k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0xe001 | offset] | this.ram[0xe201 | offset] << 8;
				const y = (k << 2) - scroll + 16 & 0x1ff;
				if (y > 8 && y < 272) {
					if ((px = this.chr[src | 0]) !== 0) data[y << 8 | x] = color | px;
					if ((px = this.chr[src | 1]) !== 0) data[y + 1 << 8 | x] = color | px;
					if ((px = this.chr[src | 2]) !== 0) data[y + 2 << 8 | x] = color | px;
					if ((px = this.chr[src | 3]) !== 0) data[y + 3 << 8 | x] = color | px;
					if ((px = this.chr[src | 4]) !== 0) data[y + 4 << 8 | x] = color | px;
					if ((px = this.chr[src | 5]) !== 0) data[y + 5 << 8 | x] = color | px;
					if ((px = this.chr[src | 6]) !== 0) data[y + 6 << 8 | x] = color | px;
					if ((px = this.chr[src | 7]) !== 0) data[y + 7 << 8 | x] = color | px;
				}
			}
			break;
		case 3: // HV反転
			for (let x = x0 - 7, i = 0; i < 8; src += 8, x++, i++) {
				const offset = ~k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0xe001 | offset] | this.ram[0xe201 | offset] << 8;
				const y = (k << 2) - scroll + 16 & 0x1ff;
				if (y > 8 && y < 272) {
					if ((px = this.chr[src | 0]) !== 0) data[y + 7 << 8 | x] = color | px;
					if ((px = this.chr[src | 1]) !== 0) data[y + 6 << 8 | x] = color | px;
					if ((px = this.chr[src | 2]) !== 0) data[y + 5 << 8 | x] = color | px;
					if ((px = this.chr[src | 3]) !== 0) data[y + 4 << 8 | x] = color | px;
					if ((px = this.chr[src | 4]) !== 0) data[y + 3 << 8 | x] = color | px;
					if ((px = this.chr[src | 5]) !== 0) data[y + 2 << 8 | x] = color | px;
					if ((px = this.chr[src | 6]) !== 0) data[y + 1 << 8 | x] = color | px;
					if ((px = this.chr[src | 7]) !== 0) data[y << 8 | x] = color | px;
				}
			}
			break;
		}
	}

	xferHxW(data, src, color, y0, x0, h, w, zoom) {
		const dh = Math.floor(h * 0x80 / zoom), dw = Math.floor(w * 0x80 / zoom), y1 = y0 + dh - 1 & 0x1ff, x1 = x0 - dw + 1 & 0xff;
		let px;

		if (dh <= 256 && (y0 < 16 || y0 >= 272) && (y1 < 16 || y1 >= 272) || dw <= 32 && (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let x = x0, i = 0; i >> 7 < w; x = x - 1 & 0xff, i += zoom)
			for (let y = y0, j = 0; j >> 7 < h; y = y + 1 & 0x1ff, j += zoom)
				if ((px = this.chr[src | (i >> 7) * h | j >> 7]) !== 0)
					data[y << 8 | x] = color | px;
	}

	xferHxW_V(data, src, color, y0, x0, h, w, zoom) {
		const dh = Math.floor(h * 0x80 / zoom), dw = Math.floor(w * 0x80 / zoom), y1 = y0 + dh - 1 & 0x1ff, x1 = x0 - dw + 1 & 0xff;
		let px;

		if (dh <= 256 && (y0 < 16 || y0 >= 272) && (y1 < 16 || y1 >= 272) || dw <= 32 && (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let x = x0, i = 0; i >> 7 < w; x = x - 1 & 0xff, i += zoom)
			for (let y = y1, j = 0; j >> 7 < h; y = y - 1 & 0x1ff, j += zoom)
				if ((px = this.chr[src | (i >> 7) * h | j >> 7]) !== 0)
					data[y << 8 | x] = color | px;
	}

	xferHxW_H(data, src, color, y0, x0, h, w, zoom) {
		const dh = Math.floor(h * 0x80 / zoom), dw = Math.floor(w * 0x80 / zoom), y1 = y0 + dh - 1 & 0x1ff, x1 = x0 - dw + 1 & 0xff;
		let px;

		if (dh <= 256 && (y0 < 16 || y0 >= 272) && (y1 < 16 || y1 >= 272) || dw <= 32 && (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let x = x1, i = 0; i >> 7 < w; x = x + 1 & 0xff, i += zoom)
			for (let y = y0, j = 0; j >> 7 < h; y = y + 1 & 0x1ff, j += zoom)
				if ((px = this.chr[src | (i >> 7) * h | j >> 7]) !== 0)
					data[y << 8 | x] = color | px;
	}

	xferHxW_HV(data, src, color, y0, x0, h, w, zoom) {
		const dh = Math.floor(h * 0x80 / zoom), dw = Math.floor(w * 0x80 / zoom), y1 = y0 + dh - 1 & 0x1ff, x1 = x0 - dw + 1 & 0xff;
		let px;

		if (dh <= 256 && (y0 < 16 || y0 >= 272) && (y1 < 16 || y1 >= 272) || dw <= 32 && (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let x = x1, i = 0; i >> 7 < w; x = x + 1 & 0xff, i += zoom)
			for (let y = y1, j = 0; j >> 7 < h; y = y - 1 & 0x1ff, j += zoom)
				if ((px = this.chr[src | (i >> 7) * h | j >> 7]) !== 0)
					data[y << 8 | x] = color | px;
	}
}

/*
 *
 *	Salamander
 *
 */

const url = 'salamand.zip';
const PRG1 = new Uint8Array(0x60000).addBase();
let PRG2, VLM, SND;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	zip.files['587-d02.18b'].inflate().split('').forEach((c, i) => PRG1[i << 1] = c.charCodeAt(0));
	zip.files['587-d05.18c'].inflate().split('').forEach((c, i) => PRG1[1 + (i << 1)] = c.charCodeAt(0));
	zip.files['587-c03.17b'].inflate().split('').forEach((c, i) => PRG1[0x20000 + (i << 1)] = c.charCodeAt(0));
	zip.files['587-c06.17c'].inflate().split('').forEach((c, i) => PRG1[0x20001 + (i << 1)] = c.charCodeAt(0));
	PRG2 = new Uint8Array(zip.files['587-d09.11j'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	VLM = new Uint8Array(zip.files['587-d08.8g'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	SND = new Uint8Array(zip.files['587-c01.10a'].inflate().split('').map(c => c.charCodeAt(0)));
	init({
		game: new Salamander(),
		sound: sound = [
			new YM2151({clock: 14318180 / 4, resolution: 58, gain: 10}),
			new K007232({SND, clock: 14318180 / 4, resolution: 58, gain: 0.5}),
			new VLM5030({VLM, clock: 14318180 / 4, gain: 5}),
		],
		rotate: true,
	});
	loop();
}

