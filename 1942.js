/*
 *
 *	1942
 *
 */

import AY_3_8910 from './ay-3-8910.js';
import {seq, rseq, convertGFX} from './utils.js';
import {init, expand} from './main.js';
import Z80 from './z80.js';
let game, sound;

class _1942 {
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
	fTurbo = false;
	nBonus = '1st 20000 2nd 80000 every 80000';
	nLife = 3;
	nRank = 'Normal';

	ram = new Uint8Array(0x1d00).addBase();
	ram2 = new Uint8Array(0x800).addBase();
	in = Uint8Array.of(0xff, 0xff, 0xff, 0xf7, 0xff);
	psg = [{addr: 0}, {addr: 0}];
	command = 0;
	bank = 0x80;
	cpu_irq = false;
	cpu_irq2 = false;

	fg = new Uint8Array(0x8000).fill(3);
	bg = new Uint8Array(0x20000).fill(7);
	obj = new Uint8Array(0x20000).fill(15);
	fgcolor = Uint8Array.from(FGCOLOR, e => 0x80 | e);
	objcolor = Uint8Array.from(OBJCOLOR, e => 0x40 | e);
	rgb = Int32Array.from(seq(0x100), i => 0xff000000 | BLUE[i] * 255 / 15 << 16 | GREEN[i] * 255 / 15 << 8 | RED[i] * 255 / 15);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;
	dwScroll = 0;
	palette = 0;
	frame = 0;

	cpu = new Z80(Math.floor(12000000 / 3));
	cpu2 = new Z80(Math.floor(12000000 / 4));
	scanline = {rate: 256 * 60, frac: 0, count: 0, execute(rate, fn) {
		for (this.frac += this.rate; this.frac >= rate; this.frac -= rate)
			fn(this.count = this.count + 1 & 255);
	}};

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0xc0; i++)
			this.cpu.memorymap[i].base = PRG1.base[i];
		this.cpu.memorymap[0xc0].read = (addr) => { return (addr &= 0xff) < 5 ? this.in[addr] : 0xff; };
		this.cpu.memorymap[0xc8].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				return void(this.command = data);
			case 2:
				return void(this.dwScroll = this.dwScroll & 0xff00 | data);
			case 3:
				return void(this.dwScroll = this.dwScroll & 0xff | data << 8);
			case 4:
				return data & 0x10 ? this.cpu2.disable() : this.cpu2.enable();
			case 5:
				return void(this.palette = data << 4 & 0x30);
			case 6:
				const _bank = (data << 6 & 0xc0) + 0x80;
				if (_bank === this.bank)
					return;
				for (let i = 0; i < 0x40; i++)
					this.cpu.memorymap[0x80 + i].base = PRG1.base[_bank + i];
				return void(this.bank = _bank);
			}
		};
		this.cpu.memorymap[0xcc].base = this.ram.base[0];
		this.cpu.memorymap[0xcc].write = null;
		for (let i = 0; i < 0x0c; i++) {
			this.cpu.memorymap[0xd0 + i].base = this.ram.base[1 + i];
			this.cpu.memorymap[0xd0 + i].write = null;
		}
		for (let i = 0; i < 0x10; i++) {
			this.cpu.memorymap[0xe0 + i].base = this.ram.base[0xd + i];
			this.cpu.memorymap[0xe0 + i].write = null;
		}

		this.cpu.check_interrupt = () => {
			if (this.cpu_irq && this.cpu.interrupt(0xd7)) // RST 10H
				return this.cpu_irq = false, true;
			if (this.cpu_irq2 && this.cpu.interrupt(0xcf)) // RST 08H
				return this.cpu_irq2 = false, true;
			return false;
		};

		for (let i = 0; i < 0x40; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 8; i++) {
			this.cpu2.memorymap[0x40 + i].base = this.ram2.base[i];
			this.cpu2.memorymap[0x40 + i].write = null;
		}
		this.cpu2.memorymap[0x60].read = (addr) => { return addr & 0xff ? 0xff : this.command; };
		this.cpu2.memorymap[0x80].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				return void(this.psg[0].addr = data);
			case 1:
				return sound[0].write(this.psg[0].addr, data);
			}
		};
		this.cpu2.memorymap[0xc0].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				return void(this.psg[1].addr = data);
			case 1:
				return sound[1].write(this.psg[1].addr, data);
			}
		};

		// Videoの初期化
		convertGFX(this.fg, FG, 512, seq(8, 0, 16), rseq(4, 8).concat(rseq(4)), [4, 0], 16);
		convertGFX(this.bg, BG, 512, seq(16, 0, 8), rseq(8, 128).concat(rseq(8)), [0, Math.floor(BG.length / 3) * 8, Math.floor(BG.length / 3) * 16], 32);
		convertGFX(this.obj, OBJ, 512, seq(16, 0, 16), rseq(4, 264).concat(rseq(4, 256), rseq(4, 8), rseq(4)), [OBJ.length * 4 + 4, OBJ.length * 4, 4, 0], 64);
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.cpu2.execute(tick_rate);
			this.scanline.execute(tick_rate, (vpos) => {
				vpos === 44 && this.cpu2.interrupt(), vpos === 109 && (this.cpu_irq2 = true, this.cpu2.interrupt());
				vpos === 175 && this.cpu2.interrupt(), vpos === 240 && (update(), this.cpu_irq = true, this.cpu2.interrupt());
			});
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
			case 3:
				this.in[3] |= 0xc0;
				break;
			case 1:
				this.in[3] = this.in[3] & ~0xc0 | 0x80;
				break;
			case 2:
				this.in[3] = this.in[3] & ~0xc0 | 0x40;
				break;
			case 5:
				this.in[3] &= ~0xc0;
				break;
			}
			switch (this.nBonus) {
			case '1st 20000 2nd 80000 every 80000':
				this.in[3] |= 0x30;
				break;
			case '1st 20000 2nd 100000 every 100000':
				this.in[3] = this.in[3] & ~0x30 | 0x20;
				break;
			case '1st 30000 2nd 80000 every 80000':
				this.in[3] = this.in[3] & ~0x30 | 0x10;
				break;
			case '1st 30000 2nd 100000 every 100000':
				this.in[3] &= ~0x30;
				break;
			}
			switch (this.nRank) {
			case 'Normal':
				this.in[4] |= 0x60;
				break;
			case 'Easy':
				this.in[4] = this.in[4] & ~0x60 | 0x40;
				break;
			case 'Hard':
				this.in[4] = this.in[4] & ~0x60 | 0x20;
				break;
			case 'Very Hard':
				this.in[4] &= ~0x60;
				break;
			}
			if (!this.fTest)
				this.fReset = true;
		}

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu_irq = this.cpu_irq2 = false;
			this.cpu.reset();
			this.cpu2.disable();
		}
		return this;
	}

	updateInput() {
		this.in[0] = this.in[0] & ~0x13 | !this.fCoin << 4 | !this.fStart1P << 0 | !this.fStart2P << 1;
		this.fCoin -= !!this.fCoin, this.fStart1P -= !!this.fStart1P, this.fStart2P -= !!this.fStart2P;
		this.fTurbo && this.frame & 1 && (this.in[1] ^= 1 << 4);
		return this;
	}

	coin(fDown) {
		fDown && (this.fCoin = 2);
	}

	start1P(fDown) {
		fDown && (this.fStart1P = 2);
	}

	start2P(fDown) {
		fDown && (this.fStart2P = 2);
	}

	up(fDown) {
		this.in[1] = this.in[1] & ~(1 << 3) | fDown << 2 | !fDown << 3;
	}

	right(fDown) {
		this.in[1] = this.in[1] & ~(1 << 0) | fDown << 1 | !fDown << 0;
	}

	down(fDown) {
		this.in[1] = this.in[1] & ~(1 << 2) | fDown << 3 | !fDown << 2;
	}

	left(fDown) {
		this.in[1] = this.in[1] & ~(1 << 1) | fDown << 0 | !fDown << 1;
	}

	triggerA(fDown) {
		this.in[1] = this.in[1] & ~(1 << 4) | !fDown << 4;
	}

	triggerB(fDown) {
		this.in[1] = this.in[1] & ~(1 << 5) | !fDown << 5;
	}

	triggerY(fDown) {
		!(this.fTurbo = fDown) && (this.in[1] |= 1 << 4);
	}

	makeBitmap(flag) {
		if (!(this.updated = flag))
			return this.bitmap;

		this.frame++;

		// bg描画
		let p = 256 * 256 + 16 + (this.dwScroll & 0xf) * 256;
		for (let k = this.dwScroll << 1 & 0x3e0 | 1, i = 0; i < 17; k = k + 0x12 & 0x3ff, p -= 14 * 16 + 256 * 16, i++)
			for (let j = 0; j < 14; k++, p += 16, j++)
				this.xfer16x16x3(this.bitmap, p, 0x900 + k);

		// obj描画
		for (let k = 0x7c, i = 32; i !== 0; k -= 4, --i) {
			const x = this.ram[k + 2];
			const y = 256 - (this.ram[k + 3] | this.ram[k + 1] << 4 & 0x100) & 0x1ff;
			const src = this.ram[k] & 0x7f | this.ram[k + 1] << 2 & 0x80 | this.ram[k] << 1 & 0x100 | this.ram[k + 1] << 9 & 0x1e00;
			switch (this.ram[k + 1] >> 6) {
			case 0:
				this.xfer16x16x4(this.bitmap, x | y << 8, src);
				break;
			case 1:
				this.xfer16x16x4(this.bitmap, x | y << 8, src);
				this.xfer16x16x4(this.bitmap, x + 16 & 0xff | y << 8, src + 1);
				break;
			case 2:
			case 3:
				this.xfer16x16x4(this.bitmap, x | y << 8, src);
				this.xfer16x16x4(this.bitmap, x + 16 & 0xff | y << 8, src + 1);
				this.xfer16x16x4(this.bitmap, x + 32 & 0xff | y << 8, src + 2);
				this.xfer16x16x4(this.bitmap, x + 48 & 0xff | y << 8, src + 3);
				break;
			}
		}

		// fg描画
		p = 256 * 8 * 33 + 16;
		for (let k = 0x140, i = 0; i < 28; p += 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p -= 256 * 8, j++)
				this.xfer8x8(this.bitmap, p, k);

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				this.bitmap[p] = this.rgb[this.bitmap[p]];

		return this.bitmap;
	}

	xfer8x8(data, p, k) {
		const q = (this.ram[k] | this.ram[k + 0x400] << 1 & 0x100) << 6, idx = this.ram[k + 0x400] << 2 & 0xfc;
		let px;

		(px = this.fgcolor[idx | this.fg[q | 0x00]]) !== 0x8f && (data[p + 0x000] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x01]]) !== 0x8f && (data[p + 0x001] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x02]]) !== 0x8f && (data[p + 0x002] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x03]]) !== 0x8f && (data[p + 0x003] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x04]]) !== 0x8f && (data[p + 0x004] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x05]]) !== 0x8f && (data[p + 0x005] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x06]]) !== 0x8f && (data[p + 0x006] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x07]]) !== 0x8f && (data[p + 0x007] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x08]]) !== 0x8f && (data[p + 0x100] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x09]]) !== 0x8f && (data[p + 0x101] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x0a]]) !== 0x8f && (data[p + 0x102] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x0b]]) !== 0x8f && (data[p + 0x103] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x0c]]) !== 0x8f && (data[p + 0x104] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x0d]]) !== 0x8f && (data[p + 0x105] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x0e]]) !== 0x8f && (data[p + 0x106] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x0f]]) !== 0x8f && (data[p + 0x107] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x10]]) !== 0x8f && (data[p + 0x200] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x11]]) !== 0x8f && (data[p + 0x201] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x12]]) !== 0x8f && (data[p + 0x202] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x13]]) !== 0x8f && (data[p + 0x203] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x14]]) !== 0x8f && (data[p + 0x204] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x15]]) !== 0x8f && (data[p + 0x205] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x16]]) !== 0x8f && (data[p + 0x206] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x17]]) !== 0x8f && (data[p + 0x207] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x18]]) !== 0x8f && (data[p + 0x300] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x19]]) !== 0x8f && (data[p + 0x301] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x1a]]) !== 0x8f && (data[p + 0x302] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x1b]]) !== 0x8f && (data[p + 0x303] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x1c]]) !== 0x8f && (data[p + 0x304] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x1d]]) !== 0x8f && (data[p + 0x305] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x1e]]) !== 0x8f && (data[p + 0x306] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x1f]]) !== 0x8f && (data[p + 0x307] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x20]]) !== 0x8f && (data[p + 0x400] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x21]]) !== 0x8f && (data[p + 0x401] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x22]]) !== 0x8f && (data[p + 0x402] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x23]]) !== 0x8f && (data[p + 0x403] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x24]]) !== 0x8f && (data[p + 0x404] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x25]]) !== 0x8f && (data[p + 0x405] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x26]]) !== 0x8f && (data[p + 0x406] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x27]]) !== 0x8f && (data[p + 0x407] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x28]]) !== 0x8f && (data[p + 0x500] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x29]]) !== 0x8f && (data[p + 0x501] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x2a]]) !== 0x8f && (data[p + 0x502] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x2b]]) !== 0x8f && (data[p + 0x503] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x2c]]) !== 0x8f && (data[p + 0x504] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x2d]]) !== 0x8f && (data[p + 0x505] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x2e]]) !== 0x8f && (data[p + 0x506] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x2f]]) !== 0x8f && (data[p + 0x507] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x30]]) !== 0x8f && (data[p + 0x600] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x31]]) !== 0x8f && (data[p + 0x601] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x32]]) !== 0x8f && (data[p + 0x602] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x33]]) !== 0x8f && (data[p + 0x603] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x34]]) !== 0x8f && (data[p + 0x604] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x35]]) !== 0x8f && (data[p + 0x605] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x36]]) !== 0x8f && (data[p + 0x606] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x37]]) !== 0x8f && (data[p + 0x607] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x38]]) !== 0x8f && (data[p + 0x700] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x39]]) !== 0x8f && (data[p + 0x701] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x3a]]) !== 0x8f && (data[p + 0x702] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x3b]]) !== 0x8f && (data[p + 0x703] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x3c]]) !== 0x8f && (data[p + 0x704] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x3d]]) !== 0x8f && (data[p + 0x705] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x3e]]) !== 0x8f && (data[p + 0x706] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x3f]]) !== 0x8f && (data[p + 0x707] = px);
	}

	xfer16x16x3(data, p, k) {
		const idx = this.ram[k + 0x10] << 3 & 0xf8;
		let i, j, q = (this.ram[k] | this.ram[k + 0x10] << 1 & 0x100) << 8;

		switch (this.ram[k + 0x10] >> 5 & 3) {
		case 0:
			for (i = 16; i !== 0; p += 256 - 16, --i)
				for (j = 16; j !== 0; --j)
					data[p++] = this.palette | BGCOLOR[idx | this.bg[q++]];
			break;
		case 1:
			for (q += 256 - 16, i = 16; i !== 0; p += 256 - 16, q -= 32, --i)
				for (j = 16; j !== 0; --j)
					data[p++] = this.palette | BGCOLOR[idx | this.bg[q++]];
			break;
		case 2:
			for (q += 16, i = 16; i !== 0; p += 256 - 16, q += 32, --i)
				for (j = 16; j !== 0; --j)
					data[p++] = this.palette | BGCOLOR[idx | this.bg[--q]];
			break;
		case 3:
			for (q += 256, i = 16; i !== 0; p += 256 - 16, --i)
				for (j = 16; j !== 0; --j)
					data[p++] = this.palette | BGCOLOR[idx | this.bg[--q]];
			break;
		}
	}

	xfer16x16x4(data, dst, src) {
		const idx = src >> 5 & 0xf0;
		let px, i, j;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		for (src = src << 8 & 0x1ff00, i = 16; i !== 0; dst += 256 - 16, --i)
			for (j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj[src++]]) !== 0x4f)
					data[dst] = px;
	}
}

/*
 *
 *	1942
 *
 */

import {ROM} from "./dist/1942.png.js";
let PRG1, PRG2, FG, BG, OBJ, RED, GREEN, BLUE, FGCOLOR, BGCOLOR, OBJCOLOR;

window.addEventListener('load', () => expand(ROM).then(ROM => {
	PRG1 = new Uint8Array(ROM.buffer, 0x0, 0x18000).addBase();
	PRG2 = new Uint8Array(ROM.buffer, 0x18000, 0x4000).addBase();
	FG = new Uint8Array(ROM.buffer, 0x1c000, 0x2000);
	BG = new Uint8Array(ROM.buffer, 0x1e000, 0xc000);
	OBJ = new Uint8Array(ROM.buffer, 0x2a000, 0x10000);
	RED = new Uint8Array(ROM.buffer, 0x3a000, 0x100);
	GREEN = new Uint8Array(ROM.buffer, 0x3a100, 0x100);
	BLUE = new Uint8Array(ROM.buffer, 0x3a200, 0x100);
	FGCOLOR = new Uint8Array(ROM.buffer, 0x3a300, 0x100);
	BGCOLOR = new Uint8Array(ROM.buffer, 0x3a400, 0x100);
	OBJCOLOR = new Uint8Array(ROM.buffer, 0x3a500, 0x100);
	game = new _1942();
	sound = [
		new AY_3_8910({clock: Math.floor(12000000 / 8)}),
		new AY_3_8910({clock: Math.floor(12000000 / 8)}),
	];
	canvas.addEventListener('click', () => game.coin(true));
	init({game, sound});
}));

