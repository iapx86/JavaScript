/*
 *
 *	Makai-Mura
 *
 */

import YM2203 from './ym2203.js';
import {seq, rseq, convertGFX} from './utils.js';
import {init, read} from './main.js';
import MC6809 from './mc6809.js';
import Z80 from './z80.js';
let game, sound;

class MakaiMura {
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
	fDemoSound = true;
	nLife = 3;
	nBonus = '20K 70K Every 70K';
	nDifficulty = 'Normal';

	ram = new Uint8Array(0x3200).addBase();
	ram2 = new Uint8Array(0x800).addBase();
	in = Uint8Array.of(0xff, 0xff, 0xff, 0xdf, 0xfb);
	command = 0;
	bank = 0;
	cpu_irq = false;

	fg = new Uint8Array(0x10000).fill(3);
	bg = new Uint8Array(0x40000).fill(7);
	obj = new Uint8Array(0x40000).fill(15);
	rgb = new Int32Array(0x100).fill(0xff000000);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;
	hScroll = 0;
	vScroll = 0;

	cpu = new MC6809(Math.floor(12000000 / 6));
	cpu2 = new Z80(Math.floor(12000000 / 4));
	scanline = {rate: 256 * 60, frac: 0, count: 0, execute(rate, fn) {
		for (this.frac += this.rate; this.frac >= rate; this.frac -= rate)
			fn(this.count = this.count + 1 & 255);
	}};

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x30; i++) {
			this.cpu.memorymap[i].base = this.ram.base[i];
			this.cpu.memorymap[i].write = null;
		}
		this.cpu.memorymap[0x30].read = (addr) => { return addr < 0x3005 ? this.in[addr & 7] : 0xff; };
		for (let i = 0; i < 2; i++)
			this.cpu.memorymap[0x38 + i].write = (addr, data) => {
				this.ram[0x3000 | addr & 0x1ff] = data, addr &= 0xff, data = this.ram[0x3000 | addr] << 8 | this.ram[0x3100 | addr];
				this.rgb[addr] = 0xff000000 | (data >> 4 & 15) * 255 / 15 << 16 | (data >> 8 & 15) * 255 / 15 << 8 | (data >> 12 & 15) * 255 / 15;
			};
		this.cpu.memorymap[0x3a].write = (addr, data) => { !(addr & 0xff) && (this.command = data); };
		this.cpu.memorymap[0x3b].write = (addr, data) => {
			switch (addr & 0xff) {
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
		this.cpu.memorymap[0x3d].write = (addr, data) => { !(addr & 0xff) && (data & 2 ? this.cpu2.disable() : this.cpu2.enable()); };
		this.cpu.memorymap[0x3e].write = (addr, data) => {
			const _bank = [0xc0, 0xe0, 0x100, 0x120, 0][data & 4 ? 4 : data & 3];
			if (addr & 0xff || _bank === this.bank)
				return;
			for (let i = 0; i < 0x20; i++)
				this.cpu.memorymap[0x40 + i].base = PRG1.base[_bank + i];
			this.bank = _bank;
		};
		for (let i = 0; i < 0xc0; i++)
			this.cpu.memorymap[0x40 + i].base = PRG1.base[i];

		this.cpu.check_interrupt = () => { return this.cpu_irq && this.cpu.interrupt() && (this.cpu_irq = false, true); };

		for (let i = 0; i < 0x80; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 8; i++) {
			this.cpu2.memorymap[0xc0 + i].base = this.ram2.base[i];
			this.cpu2.memorymap[0xc0 + i].write = null;
		}
		this.cpu2.memorymap[0xc8].read = (addr) => { return addr & 0xff ? 0xff : this.command; };
		this.cpu2.memorymap[0xe0].read = (addr) => {
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
		this.cpu2.memorymap[0xe0].write = (addr, data) => {
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
		convertGFX(this.fg, FG, 1024, rseq(8, 0, 16), seq(4).concat(seq(4, 8)), [4, 0], 16);
		convertGFX(this.bg, BG, 1024, rseq(16, 0, 8), seq(8).concat(seq(8, 128)), [Math.floor(BG.length / 3) * 16, Math.floor(BG.length / 3) * 8, 0], 32);
		convertGFX(this.obj, OBJ, 1024, rseq(16, 0, 16), seq(4).concat(seq(4, 8), seq(4, 256), seq(4, 264)), [OBJ.length * 4 + 4, OBJ.length * 4, 4, 0], 64);
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
			if (this.fDemoSound)
				this.in[3] &= ~0x20;
			else
				this.in[3] |= 0x20;
			switch (this.nLife) {
			case 3:
				this.in[4] |= 3;
				break;
			case 4:
				this.in[4] = this.in[4] & ~3 | 2;
				break;
			case 5:
				this.in[4] = this.in[4] & ~3 | 1;
				break;
			case 7:
				this.in[4] &= ~3;
				break;
			}
			switch (this.nBonus) {
			case '20K 70K Every 70K':
				this.in[4] |= 0x18;
				break;
			case '30K 80K Every 80K':
				this.in[4] = this.in[4] & ~0x18 | 0x10;
				break;
			case '20K and 80K Only':
				this.in[4] = this.in[4] & ~0x18 | 8;
				break;
			case '30K and 80K Only':
				this.in[4] &= ~0x18;
				break;
			}
			switch (this.nDifficulty) {
			case 'Easy':
				this.in[4] = this.in[4] & ~0x60 | 0x40;
				break;
			case 'Normal':
				this.in[4] |= 0x60;
				break;
			case 'Difficult':
				this.in[4] = this.in[4] & ~0x60 | 0x20;
				break;
			case 'Very Difficult':
				this.in[4] &= ~0x60;
				break;
			}
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.in[3] &= ~0x40;
		else
			this.in[3] |= 0x40;

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
		this.in[0] = this.in[0] & ~0x23 | !this.fCoin << 5 | !this.fStart1P << 0 | !this.fStart2P << 1;
		this.fCoin -= !!this.fCoin, this.fStart1P -= !!this.fStart1P, this.fStart2P -= !!this.fStart2P;
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

	makeBitmap(flag) {
		if (!(this.updated = flag))
			return this.bitmap;

		// bg描画
		let p = 256 * 16 + 224 + (16 + this.hScroll & 0x0f) - (this.vScroll & 0x0f) * 256;
		for (let k = 16 + this.hScroll >> 4 & 0x1f | this.vScroll << 1 & 0x3e0, i = 0; i < 17; k = k + 0x11 & 0x1f | k + 0x20 & 0x3e0, p += 15 * 16 + 256 * 16, i++)
			for (let j = 0; j < 15; k = k + 1 & 0x1f | k & 0x3e0, p -= 16, j++)
				this.xfer16x16x3_0(this.bitmap, p, 0x2800 + k);

		// obj描画
		for (let k = 0x1ffc, i = 128; i !== 0; k -= 4, --i) {
			const x = 240 - this.ram[k + 2] & 0xff;
			const y = 16 + (this.ram[k + 3] | this.ram[k + 1] << 8 & 0x100) & 0x1ff;
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

		// bg描画
		p = 256 * 16 + 224 + (16 + this.hScroll & 0x0f) - (this.vScroll & 0x0f) * 256;
		for (let k = 16 + this.hScroll >> 4 & 0x1f | this.vScroll << 1 & 0x3e0, i = 0; i < 17; k = k + 0x11 & 0x1f | k + 0x20 & 0x3e0, p += 15 * 16 + 256 * 16, i++)
			for (let j = 0; j < 15; k = k + 1 & 0x1f | k & 0x3e0, p -= 16, j++)
				this.ram[0x2c00 + k] & 8 && this.xfer16x16x3_1(this.bitmap, p, 0x2800 + k);

		// fg描画
		p = 256 * 8 * 2 + 232;
		for (let k = 0x2040, i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				this.xfer8x8(this.bitmap, p, k);

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				this.bitmap[p] = this.rgb[this.bitmap[p]];

		return this.bitmap;
	}

	xfer8x8(data, p, k) {
		const q = (this.ram[k] | this.ram[k + 0x400] << 2 & 0x300) << 6, idx = 0x80 | this.ram[k + 0x400] << 2 & 0x3c;
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

	xfer16x16x3_0(data, p, k) {
		const idx = this.ram[k + 0x400] << 3 & 0x38;
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

	xfer16x16x3_1(data, p, k) {
		const idx = this.ram[k + 0x400] << 3 & 0x38;
		let px, i, j, q = (this.ram[k] | this.ram[k + 0x400] << 2 & 0x300) << 8;

		switch (this.ram[k + 0x400] >> 4 & 3) {
		case 0:
			for (i = 16; i !== 0; p += 256 - 16, --i)
				for (j = 16; j !== 0; ++p, --j)
					(px = this.bg[q++]) !== 0 && px !== 6 && (data[p] = idx | px);
			break;
		case 1:
			for (q += 256 - 16, i = 16; i !== 0; p += 256 - 16, q -= 32, --i)
				for (j = 16; j !== 0; ++p, --j)
					(px = this.bg[q++]) !== 0 && px !== 6 && (data[p] = idx | px);
			break;
		case 2:
			for (q += 16, i = 16; i !== 0; p += 256 - 16, q += 32, --i)
				for (j = 16; j !== 0; ++p, --j)
					(px = this.bg[--q]) !== 0 && px !== 6 && (data[p] = idx | px);
			break;
		case 3:
			for (q += 256, i = 16; i !== 0; p += 256 - 16, --i)
				for (j = 16; j !== 0; ++p, --j)
					(px = this.bg[--q]) !== 0 && px !== 6 && (data[p] = idx | px);
			break;
		}
	}

	xfer16x16x4(data, dst, src) {
		const idx = 0x40 | src >> 6 & 0x30;
		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		src = src << 8 & 0x3ff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let px, j = 16; j !== 0; dst++, --j)
				(px = this.obj[src++]) !== 15 && (data[dst] = idx | px);
	}

	xfer16x16x4V(data, dst, src) {
		const idx = 0x40 | src >> 6 & 0x30;
		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		src = (src << 8 & 0x3ff00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let px, j = 16; j !== 0; dst++, --j)
				(px = this.obj[src++]) !== 15 && (data[dst] = idx | px);
	}

	xfer16x16x4H(data, dst, src) {
		const idx = 0x40 | src >> 6 & 0x30;
		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		src = (src << 8 & 0x3ff00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let px, j = 16; j !== 0; dst++, --j)
				(px = this.obj[--src]) !== 15 && (data[dst] = idx | px);
	}

	xfer16x16x4HV(data, dst, src) {
		const idx = 0x40 | src >> 6 & 0x30;
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
 *	Makai-Mura
 *
 */

let PRG1, PRG2, FG, BG, OBJ;

read('gng.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG1 = Uint8Array.concat(...['makaimur/10n.rom', 'makaimur/8n.rom', 'makaimur/12n.rom'].map(e => zip.decompress(e))).addBase();
	PRG2 = zip.decompress('gg2.bin').addBase();
	FG = zip.decompress('gg1.bin');
	BG = Uint8Array.concat(...['gg11.bin', 'gg10.bin', 'gg9.bin', 'gg8.bin', 'gg7.bin', 'gg6.bin'].map(e => zip.decompress(e)));
	OBJ = Uint8Array.concat(...['gngbl/19.84472.4n', 'gg16.bin', 'gg15.bin'].map(e => zip.decompress(e)), new Uint8Array(0x4000).fill(0xff));
	OBJ = Uint8Array.concat(OBJ, ...['gngbl/16.84472.4l', 'gg13.bin', 'gg12.bin'].map(e => zip.decompress(e)), new Uint8Array(0x4000).fill(0xff));
	game = new MakaiMura();
	sound = [
		new YM2203({clock: Math.floor(12000000 / 8), gain: 0.5}),
		new YM2203({clock: Math.floor(12000000 / 8), gain: 0.5}),
	];
	canvas.addEventListener('click', () => game.coin(true));
	init({game, sound});
});

