/*
 *
 *	Salamander
 *
 */

import YM2151 from './ym2151.js';
import K007232 from './k007232.js';
import VLM5030 from './vlm5030.js';
import {init, read} from './main.js';
import MC68000 from './mc68000.js';
import Z80 from './z80.js';
let game, sound;

class Salamander {
	cxScreen = 224;
	cyScreen = 256;
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
	fTurbo = false;
	nLife = 3;
	nRank = 'Normal';
	fDemoSound = true;

	fInterruptEnable = false;

	ram = new Uint8Array(0x20000).addBase();
	ram2 = new Uint8Array(0x800).addBase();
	in = Uint8Array.of(0xff, 0x42, 0xe0, 0, 0);
	vlm_latch = 0;
	vlm_control = 0;
	command = 0;
	wd = 0;
	cpu2_irq = false;

	chr = new Uint8Array(0x20000);
	rgb = new Int32Array(0x800);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	flip = 0;

	cpu = new MC68000(Math.floor(18432000 / 2));
	cpu2 = new Z80(3579545);
	scanline = {rate: 256 * 60, frac: 0, count: 0, execute(rate, fn) {
		for (this.frac += this.rate; this.frac >= rate; this.frac -= rate)
			fn(this.count = this.count + 1 & 255);
	}};

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x200; i++)
			this.cpu.memorymap[i].base = PRG1.base[i];
		for (let i = 0; i < 0x400; i++)
			this.cpu.memorymap[0x400 + i].base = PRG1.base[0x200 + i];
 		for (let i = 0; i < 0x80; i++) {
			this.cpu.memorymap[0x800 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x800 + i].write = null;
		}
		for (let i = 0; i < 0x20; i++) {
			this.cpu.memorymap[0x900 + i].read = (addr) => { return addr & 1 ? this.ram[0x8000 | addr >> 1 & 0xfff] : 0; };
			this.cpu.memorymap[0x900 + i].write = (addr, data) => { addr & 1 && (this.ram[0x8000 | addr >> 1 & 0xfff] = data); };
		}
		this.cpu.memorymap[0xa00].write = (addr, data) => {
			if (addr === 0xa0000)
				data & 8 && (this.cpu2_irq = true);
			else if (addr === 0xa0001)
				this.fInterruptEnable = (data & 1) !== 0, this.flip = data >> 2 & 3;
		};
		this.cpu.memorymap[0xc00].read = (addr) => { return addr === 0xc0003 ? this.in[0] : 0xff; };
		this.cpu.memorymap[0xc00].write = (addr, data) => { addr === 0xc0001 && (this.command = data); };
		this.cpu.memorymap[0xc20].read = (addr) => {
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
				this.ram[0x10000 | offset] = data, this.chr[offset <<= 1] = data >> 4, this.chr[1 | offset] = data & 0xf;
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

		for (let i = 0; i < 0x80; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 8; i++) {
			this.cpu2.memorymap[0x80 + i].base = this.ram2.base[i];
			this.cpu2.memorymap[0x80 + i].write = null;
		}
		this.cpu2.memorymap[0xa0].read = (addr) => { return addr === 0xa000 ? this.command : 0xff; };
		this.cpu2.memorymap[0xb0].read = (addr) => { return addr < 0xb00e ? sound[1].read(addr) : 0xff; };
		this.cpu2.memorymap[0xb0].write = (addr, data) => { addr < 0xb00e && sound[1].write(addr, data); };
		this.cpu2.memorymap[0xc0].read = (addr) => { return addr === 0xc001 ? sound[0].status : 0xff; };
		this.cpu2.memorymap[0xc0].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				return void(sound[0].addr = data);
			case 1:
				return sound[0].write(data);
			}
		};
		this.cpu2.memorymap[0xd0].write = (addr, data) => { addr === 0xd000 && (this.vlm_latch = data); };
		this.cpu2.memorymap[0xe0].read = (addr) => { return addr === 0xe000 ? this.wd ^= 1 : 0xff; };
		this.cpu2.memorymap[0xf0].write = (addr, data) => {
			if (addr === 0xf000) {
				if (~data & this.vlm_control & 1)
					sound[2].rst(this.vlm_latch);
				if (~data & this.vlm_control & 2)
					sound[2].st(this.vlm_latch);
				this.vlm_control = data;
			}
		};

		this.cpu2.check_interrupt = () => { return this.cpu2_irq && this.cpu2.interrupt() && (this.cpu2_irq = false, true); };
	}

	execute(audio, length, fn) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { fn(this.makeBitmap(true)), this.updateStatus(), this.updateInput(); };
		for (let i = 0; i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.cpu2.execute(tick_rate);
			this.scanline.execute(tick_rate, (vpos) => !vpos && (update(), this.fInterruptEnable && this.cpu.interrupt(1)));
			sound[0].execute(tick_rate);
			sound[1].execute(tick_rate);
			audio.execute(tick_rate);
		}
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
			this.cpu2_irq = false;
			this.cpu2.reset();
		}
		return this;
	}

	updateInput() {
		this.in[2] = this.in[2] & ~0x1c | !!this.fCoin << 2 | !!this.fStart1P << 3 | !!this.fStart2P << 4;
		this.fCoin -= !!this.fCoin, this.fStart1P -= !!this.fStart1P, this.fStart2P -= !!this.fStart2P;
		this.fTurbo && (this.in[3] ^= 1 << 4);
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
		this.in[3] = this.in[3] & ~(1 << 2 | fDown << 3) | fDown << 2;
	}

	right(fDown) {
		this.in[3] = this.in[3] & ~(1 << 1 | fDown << 0) | fDown << 1;
	}

	down(fDown) {
		this.in[3] = this.in[3] & ~(1 << 3 | fDown << 2) | fDown << 3;
	}

	left(fDown) {
		this.in[3] = this.in[3] & ~(1 << 0 | fDown << 1) | fDown << 0;
	}

	triggerA(fDown) {
		this.in[3] = this.in[3] & ~(1 << 4) | fDown << 4;
	}

	triggerB(fDown) {
		this.in[3] = this.in[3] & ~(1 << 5) | fDown << 5;
	}

	triggerY(fDown) {
		!(this.fTurbo = fDown) && (this.in[3] &= ~(1 << 4));
	}

	makeBitmap(flag) {
		if (!flag)
			return this.bitmap;

		for (let i = 0; i < 0x800; i++) {
			const e = this.ram[0x8000 | i << 1] << 8 | this.ram[0x8001 | i << 1];
			this.rgb[i] = 0xff000000 | (e >> 10 & 31) * 255 / 31 << 16 | (e >> 5 & 31) * 255 / 31 << 8 | (e & 31) * 255 / 31;
		}

		// 画面クリア
		let p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256, i++)
			this.bitmap.fill(0, p, p + 224);

		// bg描画
		for (let k = 0x9000; k < 0xa000; k += 2)
			if (!(this.ram[k] & 0x50) && this.ram[k] & 0xf8)
				this.xfer8x8(this.bitmap, k);
		for (let k = 0xa000; k < 0xb000; k += 2)
			if (!(this.ram[k] & 0x50) && this.ram[k] & 0xf8)
				this.xfer8x8(this.bitmap, k);
		for (let k = 0x9000; k < 0xa000; k += 2)
			if ((this.ram[k] & 0x50) === 0x40 && this.ram[k] & 0xf8)
				this.xfer8x8(this.bitmap, k);
		for (let k = 0xa000; k < 0xb000; k += 2)
			if ((this.ram[k] & 0x50) === 0x40 && this.ram[k] & 0xf8)
				this.xfer8x8(this.bitmap, k);

		// obj描画
		const size = [[32, 32], [16, 32], [32, 16], [64, 64], [8, 8], [16, 8], [8, 16], [16, 16]];
		for (let pri = 0; pri < 256; pri++)
			for (let k = 0xd000; k < 0xe000; k += 0x10) {
				if (this.ram[k + 1] !== pri)
					continue;
				let zoom = this.ram[k + 5];
				let src = this.ram[k + 9] << 9 & 0x18000 | this.ram[k + 7] << 7;
				if (!this.ram[k + 4] && this.ram[k + 6] !== 0xff)
					src = src + (this.ram[k + 6] << 15) & 0x1ff80;
				if (zoom === 0xff && !src || !(zoom |= this.ram[k + 3] << 2 & 0x300))
					continue;
				const color = this.ram[k + 9] << 3 & 0xf0;
				const y = (this.ram[k + 9] << 8 | this.ram[k + 11]) + 16 & 0x1ff;
				const x = ~this.ram[k + 13] & 0xff;
				const [h, w] = size[this.ram[k + 3] >> 3 & 7];
				switch (this.ram[k + 9] >> 4 & 2 | this.ram[k + 3] & 1) {
				case 0:
					this.xferHxW(this.bitmap, src, color, y, x, h, w, zoom);
					break;
				case 1:
					this.xferHxW_V(this.bitmap, src, color, y, x, h, w, zoom);
					break;
				case 2:
					this.xferHxW_H(this.bitmap, src, color, y, x, h, w, zoom);
					break;
				case 3:
					this.xferHxW_HV(this.bitmap, src, color, y, x, h, w, zoom);
					break;
				}
			}

		// bg描画
		for (let k = 0x9000; k < 0xa000; k += 2)
			if (this.ram[k] & 0x10 && this.ram[k] & 0xf8)
				this.xfer8x8(this.bitmap, k);
		for (let k = 0xa000; k < 0xb000; k += 2)
			if (this.ram[k] & 0x10 && this.ram[k] & 0xf8)
				this.xfer8x8(this.bitmap, k);

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				this.bitmap[p] = this.rgb[this.bitmap[p]];

		return this.bitmap;
	}

	xfer8x8(data, k) {
		const x0 = ((this.flip & 2 ? k : ~k) >> 4 & 0xf8 | 7) + this.ram[0xef01 | k >> 5 & 0x80 | k & 0x7e] & 0xff;
		const color = this.ram[k + 0x2001] << 4 & 0x7f0;
		let src = (this.ram[k] << 8 & 0x700 | this.ram[k + 1]) << 6, px;

		if (x0 < 16 || x0 >= 247)
			return;
		if (~this.ram[k] & 0x20 || (this.ram[k] & 0xc0) === 0x40)
			switch ((this.ram[k] >> 2 & 2 | this.ram[k + 0x2001] >> 7) ^ this.flip) {
			case 0: // ノーマル
				for (let x = x0, i = 0; i < 8; src += 8, --x, i++) {
					const offset = ~k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0xe001 | offset] | this.ram[0xe201 | offset] << 8;
					const y = (k << 2) - scroll + 16 & 0x1ff;
					if (y < 9 || y > 271)
						continue;
					data[y << 8 | x] = color | this.chr[src | 0];
					data[y + 1 << 8 | x] = color | this.chr[src | 1];
					data[y + 2 << 8 | x] = color | this.chr[src | 2];
					data[y + 3 << 8 | x] = color | this.chr[src | 3];
					data[y + 4 << 8 | x] = color | this.chr[src | 4];
					data[y + 5 << 8 | x] = color | this.chr[src | 5];
					data[y + 6 << 8 | x] = color | this.chr[src | 6];
					data[y + 7 << 8 | x] = color | this.chr[src | 7];
				}
				return;
			case 1: // V反転
				for (let x = x0, i = 0; i < 8; src += 8, --x, i++){
					const offset = ~k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0xe001 | offset] | this.ram[0xe201 | offset] << 8;
					const y = (k << 2) - scroll + 16 & 0x1ff;
					if (y < 9 || y > 271)
						continue;
					data[y + 7 << 8 | x] = color | this.chr[src | 0];
					data[y + 6 << 8 | x] = color | this.chr[src | 1];
					data[y + 5 << 8 | x] = color | this.chr[src | 2];
					data[y + 4 << 8 | x] = color | this.chr[src | 3];
					data[y + 3 << 8 | x] = color | this.chr[src | 4];
					data[y + 2 << 8 | x] = color | this.chr[src | 5];
					data[y + 1 << 8 | x] = color | this.chr[src | 6];
					data[y << 8 | x] = color | this.chr[src | 7];
				}
				return;
			case 2: // H反転
				for (let x = x0 - 7, i = 0; i < 8; src += 8, x++, i++) {
					const offset = ~k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0xe001 | offset] | this.ram[0xe201 | offset] << 8;
					const y = (k << 2) - scroll + 16 & 0x1ff;
					if (y < 9 || y > 271)
						continue;
					data[y << 8 | x] = color | this.chr[src | 0];
					data[y + 1 << 8 | x] = color | this.chr[src | 1];
					data[y + 2 << 8 | x] = color | this.chr[src | 2];
					data[y + 3 << 8 | x] = color | this.chr[src | 3];
					data[y + 4 << 8 | x] = color | this.chr[src | 4];
					data[y + 5 << 8 | x] = color | this.chr[src | 5];
					data[y + 6 << 8 | x] = color | this.chr[src | 6];
					data[y + 7 << 8 | x] = color | this.chr[src | 7];
				}
				return;
			case 3: // HV反転
				for (let x = x0 - 7, i = 0; i < 8; src += 8, x++, i++) {
					const offset = ~k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0xe001 | offset] | this.ram[0xe201 | offset] << 8;
					const y = (k << 2) - scroll + 16 & 0x1ff;
					if (y < 9 || y > 271)
						continue;
					data[y + 7 << 8 | x] = color | this.chr[src | 0];
					data[y + 6 << 8 | x] = color | this.chr[src | 1];
					data[y + 5 << 8 | x] = color | this.chr[src | 2];
					data[y + 4 << 8 | x] = color | this.chr[src | 3];
					data[y + 3 << 8 | x] = color | this.chr[src | 4];
					data[y + 2 << 8 | x] = color | this.chr[src | 5];
					data[y + 1 << 8 | x] = color | this.chr[src | 6];
					data[y << 8 | x] = color | this.chr[src | 7];
				}
				return;
			}
		switch ((this.ram[k] >> 2 & 2 | this.ram[k + 0x2001] >> 7) ^ this.flip) {
		case 0: // ノーマル
			for (let x = x0, i = 0; i < 8; src += 8, --x, i++) {
				const offset = ~k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0xe001 | offset] | this.ram[0xe201 | offset] << 8;
				const y = (k << 2) - scroll + 16 & 0x1ff;
				if (y < 9 || y > 271)
					continue;
				(px = this.chr[src | 0]) && (data[y << 8 | x] = color | px);
				(px = this.chr[src | 1]) && (data[y + 1 << 8 | x] = color | px);
				(px = this.chr[src | 2]) && (data[y + 2 << 8 | x] = color | px);
				(px = this.chr[src | 3]) && (data[y + 3 << 8 | x] = color | px);
				(px = this.chr[src | 4]) && (data[y + 4 << 8 | x] = color | px);
				(px = this.chr[src | 5]) && (data[y + 5 << 8 | x] = color | px);
				(px = this.chr[src | 6]) && (data[y + 6 << 8 | x] = color | px);
				(px = this.chr[src | 7]) && (data[y + 7 << 8 | x] = color | px);
			}
			break;
		case 1: // V反転
			for (let x = x0, i = 0; i < 8; src += 8, --x, i++){
				const offset = ~k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0xe001 | offset] | this.ram[0xe201 | offset] << 8;
				const y = (k << 2) - scroll + 16 & 0x1ff;
				if (y < 9 || y > 271)
					continue;
				(px = this.chr[src | 0]) && (data[y + 7 << 8 | x] = color | px);
				(px = this.chr[src | 1]) && (data[y + 6 << 8 | x] = color | px);
				(px = this.chr[src | 2]) && (data[y + 5 << 8 | x] = color | px);
				(px = this.chr[src | 3]) && (data[y + 4 << 8 | x] = color | px);
				(px = this.chr[src | 4]) && (data[y + 3 << 8 | x] = color | px);
				(px = this.chr[src | 5]) && (data[y + 2 << 8 | x] = color | px);
				(px = this.chr[src | 6]) && (data[y + 1 << 8 | x] = color | px);
				(px = this.chr[src | 7]) && (data[y << 8 | x] = color | px);
			}
			break;
		case 2: // H反転
			for (let x = x0 - 7, i = 0; i < 8; src += 8, x++, i++) {
				const offset = ~k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0xe001 | offset] | this.ram[0xe201 | offset] << 8;
				const y = (k << 2) - scroll + 16 & 0x1ff;
				if (y < 9 || y > 271)
					continue;
				(px = this.chr[src | 0]) && (data[y << 8 | x] = color | px);
				(px = this.chr[src | 1]) && (data[y + 1 << 8 | x] = color | px);
				(px = this.chr[src | 2]) && (data[y + 2 << 8 | x] = color | px);
				(px = this.chr[src | 3]) && (data[y + 3 << 8 | x] = color | px);
				(px = this.chr[src | 4]) && (data[y + 4 << 8 | x] = color | px);
				(px = this.chr[src | 5]) && (data[y + 5 << 8 | x] = color | px);
				(px = this.chr[src | 6]) && (data[y + 6 << 8 | x] = color | px);
				(px = this.chr[src | 7]) && (data[y + 7 << 8 | x] = color | px);
			}
			break;
		case 3: // HV反転
			for (let x = x0 - 7, i = 0; i < 8; src += 8, x++, i++) {
				const offset = ~k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0xe001 | offset] | this.ram[0xe201 | offset] << 8;
				const y = (k << 2) - scroll + 16 & 0x1ff;
				if (y < 9 || y > 271)
					continue;
				(px = this.chr[src | 0]) && (data[y + 7 << 8 | x] = color | px);
				(px = this.chr[src | 1]) && (data[y + 6 << 8 | x] = color | px);
				(px = this.chr[src | 2]) && (data[y + 5 << 8 | x] = color | px);
				(px = this.chr[src | 3]) && (data[y + 4 << 8 | x] = color | px);
				(px = this.chr[src | 4]) && (data[y + 3 << 8 | x] = color | px);
				(px = this.chr[src | 5]) && (data[y + 2 << 8 | x] = color | px);
				(px = this.chr[src | 6]) && (data[y + 1 << 8 | x] = color | px);
				(px = this.chr[src | 7]) && (data[y << 8 | x] = color | px);
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
				if ((px = this.chr[src | (i >> 7) * h | j >> 7]))
					data[y << 8 | x] = color | px;
	}

	xferHxW_V(data, src, color, y0, x0, h, w, zoom) {
		const dh = Math.floor(h * 0x80 / zoom), dw = Math.floor(w * 0x80 / zoom), y1 = y0 + dh - 1 & 0x1ff, x1 = x0 - dw + 1 & 0xff;
		let px;

		if (dh <= 256 && (y0 < 16 || y0 >= 272) && (y1 < 16 || y1 >= 272) || dw <= 32 && (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let x = x0, i = 0; i >> 7 < w; x = x - 1 & 0xff, i += zoom)
			for (let y = y1, j = 0; j >> 7 < h; y = y - 1 & 0x1ff, j += zoom)
				if ((px = this.chr[src | (i >> 7) * h | j >> 7]))
					data[y << 8 | x] = color | px;
	}

	xferHxW_H(data, src, color, y0, x0, h, w, zoom) {
		const dh = Math.floor(h * 0x80 / zoom), dw = Math.floor(w * 0x80 / zoom), y1 = y0 + dh - 1 & 0x1ff, x1 = x0 - dw + 1 & 0xff;
		let px;

		if (dh <= 256 && (y0 < 16 || y0 >= 272) && (y1 < 16 || y1 >= 272) || dw <= 32 && (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let x = x1, i = 0; i >> 7 < w; x = x + 1 & 0xff, i += zoom)
			for (let y = y0, j = 0; j >> 7 < h; y = y + 1 & 0x1ff, j += zoom)
				if ((px = this.chr[src | (i >> 7) * h | j >> 7]))
					data[y << 8 | x] = color | px;
	}

	xferHxW_HV(data, src, color, y0, x0, h, w, zoom) {
		const dh = Math.floor(h * 0x80 / zoom), dw = Math.floor(w * 0x80 / zoom), y1 = y0 + dh - 1 & 0x1ff, x1 = x0 - dw + 1 & 0xff;
		let px;

		if (dh <= 256 && (y0 < 16 || y0 >= 272) && (y1 < 16 || y1 >= 272) || dw <= 32 && (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let x = x1, i = 0; i >> 7 < w; x = x + 1 & 0xff, i += zoom)
			for (let y = y1, j = 0; j >> 7 < h; y = y - 1 & 0x1ff, j += zoom)
				if ((px = this.chr[src | (i >> 7) * h | j >> 7]))
					data[y << 8 | x] = color | px;
	}
}

/*
 *
 *	Salamander
 *
 */

const PRG1 = new Uint8Array(0x60000).addBase();
let PRG2, VLM, SND;

read('salamand.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	zip.decompress('587-d02.18b').forEach((e, i) => PRG1[i << 1] = e);
	zip.decompress('587-d05.18c').forEach((e, i) => PRG1[1 + (i << 1)] = e);
	zip.decompress('587-c03.17b').forEach((e, i) => PRG1[0x20000 + (i << 1)] = e);
	zip.decompress('587-c06.17c').forEach((e, i) => PRG1[0x20001 + (i << 1)] = e);
	PRG2 = zip.decompress('587-d09.11j').addBase();
	VLM = zip.decompress('587-d08.8g');
	SND = zip.decompress('587-c01.10a');
	game = new Salamander();
	sound = [
		new YM2151({clock: 3579545, gain: 5}),
		new K007232({SND, clock: 3579545, gain: 0.2}),
		new VLM5030({VLM, clock: 3579545, gain: 5}),
	];
	canvas.addEventListener('click', () => game.coin());
	init({game, sound});
});

