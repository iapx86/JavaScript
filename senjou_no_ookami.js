/*
 *
 *	Senjou no Ookami
 *
 */

import YM2203 from './ym2203.js';
import {seq, rseq, bitswap, convertGFX} from './utils.js';
import {init, expand} from './main.js';
import Z80 from './z80.js';
let game, sound;

class SenjouNoOokami {
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
	nLife = 3;
	nBonus = '10K 50K+';
	fDemoSound = true;
	nDifficulty = 'Normal';

	ram = new Uint8Array(0x3000).addBase();
	ram2 = new Uint8Array(0x800).addBase();
	in = Uint8Array.of(0xff, 0xff, 0xff, 0xff, 0x1f);
	command = 0;
	cpu_irq = false;

	fg = new Uint8Array(0x10000).fill(3);
	bg = new Uint8Array(0x40000).fill(7);
	obj = new Uint8Array(0x40000).fill(15);
	rgb = Int32Array.from(seq(0x100), i => 0xff000000 | BLUE[i] * 255 / 15 << 16 | GREEN[i] * 255 / 15 << 8 | RED[i] * 255 / 15);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;
	hScroll = 0;
	vScroll = 0;
	frame = 0;

	cpu = new Z80(Math.floor(12000000 / 4));
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
			case 4:
				return data & 0x10 ? this.cpu2.disable() : this.cpu2.enable();
			case 8:
				return void(this.vScroll = this.vScroll & 0xff00 | data);
			case 9:
				return void(this.vScroll = this.vScroll & 0xff | data << 8);
			case 10:
				return void(this.hScroll = this.hScroll & 0xff00 | data);
			case 11:
				return void(this.hScroll = this.hScroll & 0xff | data << 8);
			}
		};
		for (let i = 0; i < 0x30; i++) {
			this.cpu.memorymap[0xd0 + i].base = this.ram.base[i];
			this.cpu.memorymap[0xd0 + i].write = null;
		}

		this.cpu.check_interrupt = () => { return this.cpu_irq && this.cpu.interrupt(0xd7) && (this.cpu_irq = false, true); };

		this.cpu.fetchM1 = function () {
			const addr = this.pc, data = this.memorymap[addr >> 8].base[addr & 0xff];
			return this.pc = this.pc + 1 & 0xffff, addr ? code_table[data] : data;
		};

		for (let i = 0; i < 0x40; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 8; i++) {
			this.cpu2.memorymap[0x40 + i].base = this.ram2.base[i];
			this.cpu2.memorymap[0x40 + i].write = null;
		}
		this.cpu2.memorymap[0x60].read = (addr) => { return addr & 0xff ? 0xff : this.command; };
		this.cpu2.memorymap[0x80].read = (addr) => {
			switch (addr & 0xff) {
			case 0:
				return sound[0].status;
			case 1:
				return sound[0].read();
			case 2:
				return sound[1].status;
			case 3:
				return sound[1].read();
			}
			return 0xff;
		};
		this.cpu2.memorymap[0x80].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				return data >= 0x2d && data <= 0x2f && sound[0].prescaler(data - 0x2d), void(sound[0].addr = data);
			case 1:
				return sound[0].write(data);
			case 2:
				return data >= 0x2d && data <= 0x2f && sound[1].prescaler(data - 0x2d), void(sound[1].addr = data);
			case 3:
				return sound[1].write(data);
			}
		};

		// Videoの初期化
		convertGFX(this.fg, FG, 1024, seq(8, 0, 16), rseq(4, 8).concat(rseq(4)), [4, 0], 16);
		convertGFX(this.bg, BG, 1024, seq(16, 0, 8), rseq(8, 128).concat(rseq(8)), [0, Math.floor(BG.length / 3) * 8, Math.floor(BG.length / 3) * 16], 32);
		convertGFX(this.obj, OBJ, 1024, seq(16, 0, 16), rseq(4, 264).concat(rseq(4, 256), rseq(4, 8), rseq(4)), [OBJ.length * 4 + 4, OBJ.length * 4, 4, 0], 64);
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.cpu2.execute(tick_rate);
			this.scanline.execute(tick_rate, (vpos) => { !(vpos & 0x3f) && this.cpu2.interrupt(), !vpos && (update(), this.cpu_irq = true); });
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
				this.in[3] = this.in[3] & ~0xc | 4;
				break;
			case 3:
				this.in[3] |= 0xc;
				break;
			case 4:
				this.in[3] = this.in[3] & ~0xc | 8;
				break;
			case 5:
				this.in[3] &= ~0xc;
				break;
			}
			switch (this.nBonus) {
			case '10K 50K+':
				this.in[4] |= 7;
				break;
			case '10K 60K+':
				this.in[4] = this.in[4] & ~7 | 3;
				break;
			case '20K 60K+':
				this.in[4] = this.in[4] & ~7 | 5;
				break;
			case '20K 70K+':
				this.in[4] = this.in[4] & ~7 | 1;
				break;
			case '30K 70K+':
				this.in[4] = this.in[4] & ~7 | 6;
				break;
			case '30K 80K+':
				this.in[4] = this.in[4] & ~7 | 2;
				break;
			case '40K 100K+':
				this.in[4] = this.in[4] & ~7 | 4;
				break;
			case 'None':
				this.in[4] &= ~7;
				break;
			}
			if (this.fDemoSound)
				this.in[4] |= 8;
			else
				this.in[4] &= ~8;
			switch (this.nDifficulty) {
			case 'Normal':
				this.in[4] |= 0x10;
				break;
			case 'Difficult':
				this.in[4] &= ~0x10;
				break;
			}
			if (!this.fTest)
				this.fReset = true;
		}

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu_irq = false;
			this.cpu.reset();
			this.cpu2.disable();
		}
		return this;
	}

	updateInput() {
		this.in[0] = this.in[0] & ~0x83 | !this.fCoin << 7 | !this.fStart1P << 0 | !this.fStart2P << 1;
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
		let p = 256 * 256 + 16 - (16 + this.hScroll & 0x0f) + (this.vScroll & 0x0f) * 256;
		for (let k = 16 + this.hScroll >> 4 & 0x1f | this.vScroll << 1 & 0x3e0, i = 0; i < 17; k = k + 0x11 & 0x1f | k + 0x20 & 0x3e0, p -= 15 * 16 + 256 * 16, i++)
			for (let j = 0; j < 15; k = k + 1 & 0x1f | k & 0x3e0, p += 16, j++)
				this.xfer16x16x3(this.bitmap, p, 0x800 + k);

		// obj描画
		for (let k = 0x2f7c, i = 96; i !== 0; k -= 4, --i) {
			const x = this.ram[k + 2];
			const y = 256 - (this.ram[k + 3] | this.ram[k + 1] << 8 & 0x100) & 0x1ff;
			const src = this.ram[k] | this.ram[k + 1] << 2 & 0x300 | this.ram[k + 1] << 6 & 0xc00;
			switch (this.ram[k + 1] >> 2 & 3) {
			case 0:
				this.xfer16x16x4(this.bitmap, x | y << 8, src);
				break;
			case 1:
				this.xfer16x16x4V(this.bitmap, x | y << 8, src);
				break;
			case 2:
				this.xfer16x16x4H(this.bitmap, x | y << 8, src);
				break;
			case 3:
				this.xfer16x16x4HV(this.bitmap, x | y << 8, src);
				break;
			}
		}

		// fg描画
		p = 256 * 8 * 33 + 16;
		for (let k = 0x40, i = 0; i < 28; p += 256 * 8 * 32 + 8, i++)
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
		const q = (this.ram[k] | this.ram[k + 0x400] << 2 & 0x300) << 6, idx = 0xc0 | this.ram[k + 0x400] << 2 & 0x3c;
		let px;

		(px = this.fg[q | 0x00]) !== 3 && (data[p + 0x000] = idx | px);
		(px = this.fg[q | 0x01]) !== 3 && (data[p + 0x001] = idx | px);
		(px = this.fg[q | 0x02]) !== 3 && (data[p + 0x002] = idx | px);
		(px = this.fg[q | 0x03]) !== 3 && (data[p + 0x003] = idx | px);
		(px = this.fg[q | 0x04]) !== 3 && (data[p + 0x004] = idx | px);
		(px = this.fg[q | 0x05]) !== 3 && (data[p + 0x005] = idx | px);
		(px = this.fg[q | 0x06]) !== 3 && (data[p + 0x006] = idx | px);
		(px = this.fg[q | 0x07]) !== 3 && (data[p + 0x007] = idx | px);
		(px = this.fg[q | 0x08]) !== 3 && (data[p + 0x100] = idx | px);
		(px = this.fg[q | 0x09]) !== 3 && (data[p + 0x101] = idx | px);
		(px = this.fg[q | 0x0a]) !== 3 && (data[p + 0x102] = idx | px);
		(px = this.fg[q | 0x0b]) !== 3 && (data[p + 0x103] = idx | px);
		(px = this.fg[q | 0x0c]) !== 3 && (data[p + 0x104] = idx | px);
		(px = this.fg[q | 0x0d]) !== 3 && (data[p + 0x105] = idx | px);
		(px = this.fg[q | 0x0e]) !== 3 && (data[p + 0x106] = idx | px);
		(px = this.fg[q | 0x0f]) !== 3 && (data[p + 0x107] = idx | px);
		(px = this.fg[q | 0x10]) !== 3 && (data[p + 0x200] = idx | px);
		(px = this.fg[q | 0x11]) !== 3 && (data[p + 0x201] = idx | px);
		(px = this.fg[q | 0x12]) !== 3 && (data[p + 0x202] = idx | px);
		(px = this.fg[q | 0x13]) !== 3 && (data[p + 0x203] = idx | px);
		(px = this.fg[q | 0x14]) !== 3 && (data[p + 0x204] = idx | px);
		(px = this.fg[q | 0x15]) !== 3 && (data[p + 0x205] = idx | px);
		(px = this.fg[q | 0x16]) !== 3 && (data[p + 0x206] = idx | px);
		(px = this.fg[q | 0x17]) !== 3 && (data[p + 0x207] = idx | px);
		(px = this.fg[q | 0x18]) !== 3 && (data[p + 0x300] = idx | px);
		(px = this.fg[q | 0x19]) !== 3 && (data[p + 0x301] = idx | px);
		(px = this.fg[q | 0x1a]) !== 3 && (data[p + 0x302] = idx | px);
		(px = this.fg[q | 0x1b]) !== 3 && (data[p + 0x303] = idx | px);
		(px = this.fg[q | 0x1c]) !== 3 && (data[p + 0x304] = idx | px);
		(px = this.fg[q | 0x1d]) !== 3 && (data[p + 0x305] = idx | px);
		(px = this.fg[q | 0x1e]) !== 3 && (data[p + 0x306] = idx | px);
		(px = this.fg[q | 0x1f]) !== 3 && (data[p + 0x307] = idx | px);
		(px = this.fg[q | 0x20]) !== 3 && (data[p + 0x400] = idx | px);
		(px = this.fg[q | 0x21]) !== 3 && (data[p + 0x401] = idx | px);
		(px = this.fg[q | 0x22]) !== 3 && (data[p + 0x402] = idx | px);
		(px = this.fg[q | 0x23]) !== 3 && (data[p + 0x403] = idx | px);
		(px = this.fg[q | 0x24]) !== 3 && (data[p + 0x404] = idx | px);
		(px = this.fg[q | 0x25]) !== 3 && (data[p + 0x405] = idx | px);
		(px = this.fg[q | 0x26]) !== 3 && (data[p + 0x406] = idx | px);
		(px = this.fg[q | 0x27]) !== 3 && (data[p + 0x407] = idx | px);
		(px = this.fg[q | 0x28]) !== 3 && (data[p + 0x500] = idx | px);
		(px = this.fg[q | 0x29]) !== 3 && (data[p + 0x501] = idx | px);
		(px = this.fg[q | 0x2a]) !== 3 && (data[p + 0x502] = idx | px);
		(px = this.fg[q | 0x2b]) !== 3 && (data[p + 0x503] = idx | px);
		(px = this.fg[q | 0x2c]) !== 3 && (data[p + 0x504] = idx | px);
		(px = this.fg[q | 0x2d]) !== 3 && (data[p + 0x505] = idx | px);
		(px = this.fg[q | 0x2e]) !== 3 && (data[p + 0x506] = idx | px);
		(px = this.fg[q | 0x2f]) !== 3 && (data[p + 0x507] = idx | px);
		(px = this.fg[q | 0x30]) !== 3 && (data[p + 0x600] = idx | px);
		(px = this.fg[q | 0x31]) !== 3 && (data[p + 0x601] = idx | px);
		(px = this.fg[q | 0x32]) !== 3 && (data[p + 0x602] = idx | px);
		(px = this.fg[q | 0x33]) !== 3 && (data[p + 0x603] = idx | px);
		(px = this.fg[q | 0x34]) !== 3 && (data[p + 0x604] = idx | px);
		(px = this.fg[q | 0x35]) !== 3 && (data[p + 0x605] = idx | px);
		(px = this.fg[q | 0x36]) !== 3 && (data[p + 0x606] = idx | px);
		(px = this.fg[q | 0x37]) !== 3 && (data[p + 0x607] = idx | px);
		(px = this.fg[q | 0x38]) !== 3 && (data[p + 0x700] = idx | px);
		(px = this.fg[q | 0x39]) !== 3 && (data[p + 0x701] = idx | px);
		(px = this.fg[q | 0x3a]) !== 3 && (data[p + 0x702] = idx | px);
		(px = this.fg[q | 0x3b]) !== 3 && (data[p + 0x703] = idx | px);
		(px = this.fg[q | 0x3c]) !== 3 && (data[p + 0x704] = idx | px);
		(px = this.fg[q | 0x3d]) !== 3 && (data[p + 0x705] = idx | px);
		(px = this.fg[q | 0x3e]) !== 3 && (data[p + 0x706] = idx | px);
		(px = this.fg[q | 0x3f]) !== 3 && (data[p + 0x707] = idx | px);
	}

	xfer16x16x3(data, p, k) {
		const idx = this.ram[k + 0x400] << 3 & 0x78;
		let i, j, q = (this.ram[k] | this.ram[k + 0x400] << 2 & 0x300) << 8;

		switch (this.ram[k + 0x400] >> 4 & 3) {
		case 0:
			for (i = 16; i !== 0; p += 256 - 16, --i)
				for (j = 16; j !== 0; --j)
					data[p++] = idx | this.bg[q++];
			break;
		case 1:
			for (q += 256 - 16, i = 16; i !== 0; p += 256 - 16, q -= 32, --i)
				for (j = 16; j !== 0; --j)
					data[p++] = idx | this.bg[q++];
			break;
		case 2:
			for (q += 16, i = 16; i !== 0; p += 256 - 16, q += 32, --i)
				for (j = 16; j !== 0; --j)
					data[p++] = idx | this.bg[--q];
			break;
		case 3:
			for (q += 256, i = 16; i !== 0; p += 256 - 16, --i)
				for (j = 16; j !== 0; --j)
					data[p++] = idx | this.bg[--q];
			break;
		}
	}

	xfer16x16x4(data, dst, src) {
		const idx = 0x80 | src >> 6 & 0x30;
		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		src = src << 8 & 0x3ff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let px, j = 16; j !== 0; dst++, --j)
				(px = this.obj[src++]) !== 15 && (data[dst] = idx | px);
	}

	xfer16x16x4V(data, dst, src) {
		const idx = 0x80 | src >> 6 & 0x30;
		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		src = (src << 8 & 0x3ff00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let px, j = 16; j !== 0; dst++, --j)
				(px = this.obj[src++]) !== 15 && (data[dst] = idx | px);
	}

	xfer16x16x4H(data, dst, src) {
		const idx = 0x80 | src >> 6 & 0x30;
		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		src = (src << 8 & 0x3ff00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let px, j = 16; j !== 0; dst++, --j)
				(px = this.obj[--src]) !== 15 && (data[dst] = idx | px);
	}

	xfer16x16x4HV(data, dst, src) {
		const idx = 0x80 | src >> 6 & 0x30;
		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		src = (src << 8 & 0x3ff00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let px, j = 16; j !== 0; dst++, --j)
				(px = this.obj[--src]) !== 15 && (data[dst] = idx | px);
	}
}

/*
 *
 *	Senjou no Ookami
 *
 */

import {ROM} from "./dist/senjou_no_ookami.png.js";
const code_table = Uint8Array.from(seq(0x100), i => bitswap(i, 3, 2, 1, 4, 7, 6, 5, 0));
let PRG1, PRG2, FG, BG, OBJ, RED, GREEN, BLUE;

window.addEventListener('load', () => expand(ROM).then(ROM => {
	PRG1 = new Uint8Array(ROM.buffer, 0x0, 0xc000).addBase();
	PRG2 = new Uint8Array(ROM.buffer, 0xc000, 0x4000).addBase();
	FG = new Uint8Array(ROM.buffer, 0x10000, 0x4000);
	BG = new Uint8Array(ROM.buffer, 0x14000, 0x18000);
	OBJ = new Uint8Array(ROM.buffer, 0x2c000, 0x20000);
	RED = new Uint8Array(ROM.buffer, 0x4c000, 0x100);
	GREEN = new Uint8Array(ROM.buffer, 0x4c100, 0x100);
	BLUE = new Uint8Array(ROM.buffer, 0x4c200, 0x100);
	game = new SenjouNoOokami();
	sound = [
		new YM2203({clock: Math.floor(12000000 / 8), gain: 0.5}),
		new YM2203({clock: Math.floor(12000000 / 8), gain: 0.5}),
	];
	canvas.addEventListener('click', () => game.coin(true));
	init({game, sound});
}));

