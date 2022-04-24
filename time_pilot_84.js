/*
 *
 *	Time Pilot '84
 *
 */

import SN76489 from './sn76489.js';
import {seq, rseq, convertGFX} from './utils.js';
import {init, expand} from './main.js';
import MC6809 from './mc6809.js';
import Z80 from './z80.js';
let game, sound;

class TimePilot84 {
	cxScreen = 224;
	cyScreen = 256;
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
	nLife = 3;
	nBonus = '20000 and every 60000';
	nDifficulty = 'Normal';
	fDemoSound = true;

	fInterruptEnable = false;
	fInterruptEnable2 = false;

	ram = new Uint8Array(0x1800).addBase();
	in = Uint8Array.of(0xff, 0xff, 0xff, 0xff, 0x32);
	ram2 = new Uint8Array(0x880).addBase();
	ram3 = new Uint8Array(0x400).addBase();
	command = 0;
	cpu_irq = false;
	cpu2_irq = false;
	cpu3_irq = false;

	bg = new Uint8Array(0x10000).fill(3);
	obj = new Uint8Array(0x10000).fill(15);
	rgb = Int32Array.from(seq(0x100), i => 0xff000000 | BLUE[i] * 255 / 15 << 16 | GREEN[i] * 255 / 15 << 8 | RED[i] * 255 / 15);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;
	palette = 0;
	hScroll = 0;
	vScroll = 0;
	vpos = 0;

	cpu = new MC6809(Math.floor(18432000 / 12));
	cpu2 = new MC6809(Math.floor(18432000 / 12));
	cpu3 = new Z80(Math.floor(14318181 / 4));
	scanline = {rate: 256 * 60, frac: 0, count: 0, execute(rate, fn) {
		for (this.frac += this.rate; this.frac >= rate; this.frac -= rate)
			fn(this.count = this.count + 1 & 255);
	}};
	timer = {rate: 14318181 / 4096, frac: 0, count: 0, execute(rate) {
		for (this.frac += this.rate; this.frac >= rate; this.frac -= rate)
			this.count = this.count + 1 & 15;
	}};

	constructor() {
		// CPU周りの初期化
		this.cpu.memorymap[0x28].read = (addr) => { return this.in[addr >> 5 & 3]; };
		this.cpu.memorymap[0x28].write = (addr, data) => { !(addr & 0xff) && (this.palette = data); };
		this.cpu.memorymap[0x30].read = (addr) => { return !(addr & 0xff) ? this.in[4] : 0xff; };
		this.cpu.memorymap[0x30].write = (addr, data) => { !(addr & 0xff) && !(this.fInterruptEnable = (data & 1) !== 0) && (this.cpu_irq = false); };
		this.cpu.memorymap[0x38].write = (addr) => { !(addr & 0xff) && (this.cpu3_irq = true); };
		this.cpu.memorymap[0x3a].write = (addr, data) => { !(addr & 0xff) && (this.command = data); };
		this.cpu.memorymap[0x3c].write = (addr, data) => { !(addr & 0xff) && (this.vScroll = data); };
		this.cpu.memorymap[0x3e].write = (addr, data) => { !(addr & 0xff) && (this.hScroll = data); };
		for (let i = 0; i < 0x18; i++) {
			this.cpu.memorymap[0x40 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x40 + i].write = null;
		}
		for (let i = 0; i < 0x80; i++)
			this.cpu.memorymap[0x80 + i].base = PRG1.base[i];

		this.cpu.check_interrupt = () => { return this.cpu_irq && this.cpu.interrupt() && (this.cpu_irq = false, true); };

		this.cpu2.memorymap[0x20].read = (addr) => { return !(addr & 0xff) ? this.vpos : 0xff; };
		this.cpu2.memorymap[0x40].write = (addr, data) => { !(addr & 0xff) && !(this.fInterruptEnable2 = (data & 1) !== 0) && (this.cpu2_irq = false); };
		for (let i = 0; i < 8; i++) {
			this.cpu2.memorymap[0x60 + i].base = this.ram2.base[i];
			this.cpu2.memorymap[0x60 + i].write = null;
		}
		for (let i = 0; i < 8; i++) {
			this.cpu2.memorymap[0x80 + i].base = this.ram.base[0x10 + i];
			this.cpu2.memorymap[0x80 + i].write = null;
		}
		for (let i = 0; i < 0x20; i++)
			this.cpu2.memorymap[0xe0 + i].base = PRG2.base[i];

		this.cpu2.check_interrupt = () => { return this.cpu2_irq && this.cpu2.interrupt() && (this.cpu2_irq = false, true); };

		for (let i = 0; i < 0x20; i++)
			this.cpu3.memorymap[i].base = PRG3.base[i];
		for (let i = 0; i < 4; i++) {
			this.cpu3.memorymap[0x40 + i].base = this.ram3.base[i];
			this.cpu3.memorymap[0x40 + i].write = null;
		}
		this.cpu3.memorymap[0x60].read = (addr) => { return !(addr & 0xff) ? this.command : 0xff; };
		this.cpu3.memorymap[0x80].read = (addr) => { return !(addr & 0xff) ? this.timer.count : 0xff; };
		this.cpu3.memorymap[0xc0].write = (addr, data) => {
			switch (addr & 0xff) {
			case 1:
				return sound[0].write(data);
			case 3:
				return sound[1].write(data);
			case 4:
				return sound[2].write(data);
			}
		};

		this.cpu3.check_interrupt = () => { return this.cpu3_irq && this.cpu3.interrupt() && (this.cpu3_irq = false, true); };

		// Videoの初期化
		convertGFX(this.bg, BG, 1024, rseq(8, 0, 8), seq(4).concat(seq(4, 64)), [4, 0], 16);
		convertGFX(this.obj, OBJ, 256, rseq(8, 256, 8).concat(rseq(8, 0, 8)), rseq(4, 192).concat(rseq(4, 128), rseq(4, 64), rseq(4)),
			[Math.floor(OBJ.length / 2) * 8 + 4, Math.floor(OBJ.length / 2) * 8, 4, 0], 64);
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.cpu2.execute(tick_rate);
			this.cpu3.execute(tick_rate);
			this.scanline.execute(tick_rate, (cnt) => {
				this.vpos = cnt + 240 & 0xff;
				!this.vpos && this.ram2.copyWithin(0x800, 0x780, 0x800);
				this.vpos === 240 && (update(), this.cpu_irq = this.fInterruptEnable, this.cpu2_irq = this.fInterruptEnable2);
			});
			this.timer.execute(tick_rate);
			sound[0].execute(tick_rate);
			sound[1].execute(tick_rate);
			sound[2].execute(tick_rate);
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
				this.in[4] |= 3;
				break;
			case 3:
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
			case '10000 and every 50000':
				this.in[4] |= 0x18;
				break;
			case '20000 and every 60000':
				this.in[4] = this.in[4] &= ~0x18 | 0x10;
				break;
			case '30000 and every 70000':
				this.in[4] = this.in[4] &= ~0x18 | 8;
				break;
			case '40000 and every 80000':
				this.in[4] &= ~0x18;
				break;
			}
			switch (this.nDifficulty) {
			case 'Easy':
				this.in[4] |= 0x60;
				break;
			case 'Normal':
				this.in[4] = this.in[4] & ~0x60 | 0x40;
				break;
			case 'Hard':
				this.in[4] = this.in[4] & ~0x60 | 0x20;
				break;
			case 'Hardest':
				this.in[4] &= ~0x60;
				break;
			}
			if (this.fDemoSound)
				this.in[4] &= ~0x80;
			else
				this.in[4] |= 0x80;
			if (!this.fTest)
				this.fReset = true;
		}

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.fInterruptEnable = this.fInterruptEnable2 = false;
			this.cpu_irq = this.cpu2_irq = this.cpu3_irq = false;
			this.cpu.reset();
			this.cpu2.reset();
			this.cpu3.reset();
		}
		return this;
	}

	updateInput() {
		this.in[0] = this.in[0] & ~0x1c | !this.fCoin << 2 | !this.fStart1P << 3 | !this.fStart2P << 4;
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
		this.in[1] = this.in[1] & ~(1 << 2) | fDown << 3 | !fDown << 2;
	}

	right(fDown) {
		this.in[1] = this.in[1] & ~(1 << 1) | fDown << 0 | !fDown << 1;
	}

	down(fDown) {
		this.in[1] = this.in[1] & ~(1 << 3) | fDown << 2 | !fDown << 3;
	}

	left(fDown) {
		this.in[1] = this.in[1] & ~(1 << 0) | fDown << 1 | !fDown << 0;
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
		let p = 256 * 8 * 2 + 232 - (this.vScroll & 7) * 256 + (16 + this.hScroll & 7);
		let k = this.vScroll >> 3 & 0x1f | 16 + this.hScroll << 2 & 0x3e0;
		for (let i = 0; i < 29; k = k - 33 & 0x1f | k + 0x20 & 0x3e0, p -= 256 * 8 * 33 + 8, i++)
			for (let j = 0; j < 33; k = k + 1 & 0x1f | k & 0x3e0, p += 256 * 8, j++)
				this.xfer8x8(this.bitmap, p, k);

		// obj描画
		for (let k = 0x7fc; k >= 0x7a0; k -= 4) {
			const dst0 = this.ram2[k + 0x83] - 1 & 0xff | this.ram2[k + 0x80] + 16 << 8;
			const src0 = this.ram2[k + 0x81] | this.ram2[k + 0x82] << 8;
			switch (src0 >> 14) {
			case 0: // ノーマル
				this.xfer16x16(this.bitmap, dst0, src0);
				break;
			case 1: // V反転
				this.xfer16x16V(this.bitmap, dst0, src0);
				break;
			case 2: // H反転
				this.xfer16x16H(this.bitmap, dst0, src0);
				break;
			case 3: // HV反転
				this.xfer16x16HV(this.bitmap, dst0, src0);
				break;
			}
			const dst1 = this.ram2[k + 3] - 1 & 0xff | this.ram2[k] + 16 << 8;
			const src1 = this.ram2[k + 1] | this.ram2[k + 2] << 8;
			if (dst1 === dst0 && src1 === src0)
				continue;
			switch (src1 >> 14) {
			case 0: // ノーマル
				this.xfer16x16(this.bitmap, dst1, src1);
				break;
			case 1: // V反転
				this.xfer16x16V(this.bitmap, dst1, src1);
				break;
			case 2: // H反転
				this.xfer16x16H(this.bitmap, dst1, src1);
				break;
			case 3: // HV反転
				this.xfer16x16HV(this.bitmap, dst1, src1);
				break;
			}
		}

		// fg描画
		p = 256 * 8 * 2 + 232;
		for (let k = 0x440, i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				(j < 2 || j > 29) && this.xfer8x8(this.bitmap, p, k);

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				this.bitmap[p] = this.rgb[this.bitmap[p]];

		return this.bitmap;
	}

	xfer8x8(data, p, k) {
		const q = (this.ram[k] | this.ram[k + 0x800] << 4 & 0x300) << 6, idx = this.palette << 4 & 0x70 | 0x80, idx2 = this.ram[k + 0x800] << 2 & 0x3c | this.palette << 3 & 0xc0;

		switch (this.ram[k + 0x800] >> 6) {
		case 0: // ノーマル
			data[p + 0x000] = idx | BGCOLOR[idx2 | this.bg[q | 0x00]];
			data[p + 0x001] = idx | BGCOLOR[idx2 | this.bg[q | 0x01]];
			data[p + 0x002] = idx | BGCOLOR[idx2 | this.bg[q | 0x02]];
			data[p + 0x003] = idx | BGCOLOR[idx2 | this.bg[q | 0x03]];
			data[p + 0x004] = idx | BGCOLOR[idx2 | this.bg[q | 0x04]];
			data[p + 0x005] = idx | BGCOLOR[idx2 | this.bg[q | 0x05]];
			data[p + 0x006] = idx | BGCOLOR[idx2 | this.bg[q | 0x06]];
			data[p + 0x007] = idx | BGCOLOR[idx2 | this.bg[q | 0x07]];
			data[p + 0x100] = idx | BGCOLOR[idx2 | this.bg[q | 0x08]];
			data[p + 0x101] = idx | BGCOLOR[idx2 | this.bg[q | 0x09]];
			data[p + 0x102] = idx | BGCOLOR[idx2 | this.bg[q | 0x0a]];
			data[p + 0x103] = idx | BGCOLOR[idx2 | this.bg[q | 0x0b]];
			data[p + 0x104] = idx | BGCOLOR[idx2 | this.bg[q | 0x0c]];
			data[p + 0x105] = idx | BGCOLOR[idx2 | this.bg[q | 0x0d]];
			data[p + 0x106] = idx | BGCOLOR[idx2 | this.bg[q | 0x0e]];
			data[p + 0x107] = idx | BGCOLOR[idx2 | this.bg[q | 0x0f]];
			data[p + 0x200] = idx | BGCOLOR[idx2 | this.bg[q | 0x10]];
			data[p + 0x201] = idx | BGCOLOR[idx2 | this.bg[q | 0x11]];
			data[p + 0x202] = idx | BGCOLOR[idx2 | this.bg[q | 0x12]];
			data[p + 0x203] = idx | BGCOLOR[idx2 | this.bg[q | 0x13]];
			data[p + 0x204] = idx | BGCOLOR[idx2 | this.bg[q | 0x14]];
			data[p + 0x205] = idx | BGCOLOR[idx2 | this.bg[q | 0x15]];
			data[p + 0x206] = idx | BGCOLOR[idx2 | this.bg[q | 0x16]];
			data[p + 0x207] = idx | BGCOLOR[idx2 | this.bg[q | 0x17]];
			data[p + 0x300] = idx | BGCOLOR[idx2 | this.bg[q | 0x18]];
			data[p + 0x301] = idx | BGCOLOR[idx2 | this.bg[q | 0x19]];
			data[p + 0x302] = idx | BGCOLOR[idx2 | this.bg[q | 0x1a]];
			data[p + 0x303] = idx | BGCOLOR[idx2 | this.bg[q | 0x1b]];
			data[p + 0x304] = idx | BGCOLOR[idx2 | this.bg[q | 0x1c]];
			data[p + 0x305] = idx | BGCOLOR[idx2 | this.bg[q | 0x1d]];
			data[p + 0x306] = idx | BGCOLOR[idx2 | this.bg[q | 0x1e]];
			data[p + 0x307] = idx | BGCOLOR[idx2 | this.bg[q | 0x1f]];
			data[p + 0x400] = idx | BGCOLOR[idx2 | this.bg[q | 0x20]];
			data[p + 0x401] = idx | BGCOLOR[idx2 | this.bg[q | 0x21]];
			data[p + 0x402] = idx | BGCOLOR[idx2 | this.bg[q | 0x22]];
			data[p + 0x403] = idx | BGCOLOR[idx2 | this.bg[q | 0x23]];
			data[p + 0x404] = idx | BGCOLOR[idx2 | this.bg[q | 0x24]];
			data[p + 0x405] = idx | BGCOLOR[idx2 | this.bg[q | 0x25]];
			data[p + 0x406] = idx | BGCOLOR[idx2 | this.bg[q | 0x26]];
			data[p + 0x407] = idx | BGCOLOR[idx2 | this.bg[q | 0x27]];
			data[p + 0x500] = idx | BGCOLOR[idx2 | this.bg[q | 0x28]];
			data[p + 0x501] = idx | BGCOLOR[idx2 | this.bg[q | 0x29]];
			data[p + 0x502] = idx | BGCOLOR[idx2 | this.bg[q | 0x2a]];
			data[p + 0x503] = idx | BGCOLOR[idx2 | this.bg[q | 0x2b]];
			data[p + 0x504] = idx | BGCOLOR[idx2 | this.bg[q | 0x2c]];
			data[p + 0x505] = idx | BGCOLOR[idx2 | this.bg[q | 0x2d]];
			data[p + 0x506] = idx | BGCOLOR[idx2 | this.bg[q | 0x2e]];
			data[p + 0x507] = idx | BGCOLOR[idx2 | this.bg[q | 0x2f]];
			data[p + 0x600] = idx | BGCOLOR[idx2 | this.bg[q | 0x30]];
			data[p + 0x601] = idx | BGCOLOR[idx2 | this.bg[q | 0x31]];
			data[p + 0x602] = idx | BGCOLOR[idx2 | this.bg[q | 0x32]];
			data[p + 0x603] = idx | BGCOLOR[idx2 | this.bg[q | 0x33]];
			data[p + 0x604] = idx | BGCOLOR[idx2 | this.bg[q | 0x34]];
			data[p + 0x605] = idx | BGCOLOR[idx2 | this.bg[q | 0x35]];
			data[p + 0x606] = idx | BGCOLOR[idx2 | this.bg[q | 0x36]];
			data[p + 0x607] = idx | BGCOLOR[idx2 | this.bg[q | 0x37]];
			data[p + 0x700] = idx | BGCOLOR[idx2 | this.bg[q | 0x38]];
			data[p + 0x701] = idx | BGCOLOR[idx2 | this.bg[q | 0x39]];
			data[p + 0x702] = idx | BGCOLOR[idx2 | this.bg[q | 0x3a]];
			data[p + 0x703] = idx | BGCOLOR[idx2 | this.bg[q | 0x3b]];
			data[p + 0x704] = idx | BGCOLOR[idx2 | this.bg[q | 0x3c]];
			data[p + 0x705] = idx | BGCOLOR[idx2 | this.bg[q | 0x3d]];
			data[p + 0x706] = idx | BGCOLOR[idx2 | this.bg[q | 0x3e]];
			data[p + 0x707] = idx | BGCOLOR[idx2 | this.bg[q | 0x3f]];
			break;
		case 1: // V反転
			data[p + 0x000] = idx | BGCOLOR[idx2 | this.bg[q | 0x38]];
			data[p + 0x001] = idx | BGCOLOR[idx2 | this.bg[q | 0x39]];
			data[p + 0x002] = idx | BGCOLOR[idx2 | this.bg[q | 0x3a]];
			data[p + 0x003] = idx | BGCOLOR[idx2 | this.bg[q | 0x3b]];
			data[p + 0x004] = idx | BGCOLOR[idx2 | this.bg[q | 0x3c]];
			data[p + 0x005] = idx | BGCOLOR[idx2 | this.bg[q | 0x3d]];
			data[p + 0x006] = idx | BGCOLOR[idx2 | this.bg[q | 0x3e]];
			data[p + 0x007] = idx | BGCOLOR[idx2 | this.bg[q | 0x3f]];
			data[p + 0x100] = idx | BGCOLOR[idx2 | this.bg[q | 0x30]];
			data[p + 0x101] = idx | BGCOLOR[idx2 | this.bg[q | 0x31]];
			data[p + 0x102] = idx | BGCOLOR[idx2 | this.bg[q | 0x32]];
			data[p + 0x103] = idx | BGCOLOR[idx2 | this.bg[q | 0x33]];
			data[p + 0x104] = idx | BGCOLOR[idx2 | this.bg[q | 0x34]];
			data[p + 0x105] = idx | BGCOLOR[idx2 | this.bg[q | 0x35]];
			data[p + 0x106] = idx | BGCOLOR[idx2 | this.bg[q | 0x36]];
			data[p + 0x107] = idx | BGCOLOR[idx2 | this.bg[q | 0x37]];
			data[p + 0x200] = idx | BGCOLOR[idx2 | this.bg[q | 0x28]];
			data[p + 0x201] = idx | BGCOLOR[idx2 | this.bg[q | 0x29]];
			data[p + 0x202] = idx | BGCOLOR[idx2 | this.bg[q | 0x2a]];
			data[p + 0x203] = idx | BGCOLOR[idx2 | this.bg[q | 0x2b]];
			data[p + 0x204] = idx | BGCOLOR[idx2 | this.bg[q | 0x2c]];
			data[p + 0x205] = idx | BGCOLOR[idx2 | this.bg[q | 0x2d]];
			data[p + 0x206] = idx | BGCOLOR[idx2 | this.bg[q | 0x2e]];
			data[p + 0x207] = idx | BGCOLOR[idx2 | this.bg[q | 0x2f]];
			data[p + 0x300] = idx | BGCOLOR[idx2 | this.bg[q | 0x20]];
			data[p + 0x301] = idx | BGCOLOR[idx2 | this.bg[q | 0x21]];
			data[p + 0x302] = idx | BGCOLOR[idx2 | this.bg[q | 0x22]];
			data[p + 0x303] = idx | BGCOLOR[idx2 | this.bg[q | 0x23]];
			data[p + 0x304] = idx | BGCOLOR[idx2 | this.bg[q | 0x24]];
			data[p + 0x305] = idx | BGCOLOR[idx2 | this.bg[q | 0x25]];
			data[p + 0x306] = idx | BGCOLOR[idx2 | this.bg[q | 0x26]];
			data[p + 0x307] = idx | BGCOLOR[idx2 | this.bg[q | 0x27]];
			data[p + 0x400] = idx | BGCOLOR[idx2 | this.bg[q | 0x18]];
			data[p + 0x401] = idx | BGCOLOR[idx2 | this.bg[q | 0x19]];
			data[p + 0x402] = idx | BGCOLOR[idx2 | this.bg[q | 0x1a]];
			data[p + 0x403] = idx | BGCOLOR[idx2 | this.bg[q | 0x1b]];
			data[p + 0x404] = idx | BGCOLOR[idx2 | this.bg[q | 0x1c]];
			data[p + 0x405] = idx | BGCOLOR[idx2 | this.bg[q | 0x1d]];
			data[p + 0x406] = idx | BGCOLOR[idx2 | this.bg[q | 0x1e]];
			data[p + 0x407] = idx | BGCOLOR[idx2 | this.bg[q | 0x1f]];
			data[p + 0x500] = idx | BGCOLOR[idx2 | this.bg[q | 0x10]];
			data[p + 0x501] = idx | BGCOLOR[idx2 | this.bg[q | 0x11]];
			data[p + 0x502] = idx | BGCOLOR[idx2 | this.bg[q | 0x12]];
			data[p + 0x503] = idx | BGCOLOR[idx2 | this.bg[q | 0x13]];
			data[p + 0x504] = idx | BGCOLOR[idx2 | this.bg[q | 0x14]];
			data[p + 0x505] = idx | BGCOLOR[idx2 | this.bg[q | 0x15]];
			data[p + 0x506] = idx | BGCOLOR[idx2 | this.bg[q | 0x16]];
			data[p + 0x507] = idx | BGCOLOR[idx2 | this.bg[q | 0x17]];
			data[p + 0x600] = idx | BGCOLOR[idx2 | this.bg[q | 0x08]];
			data[p + 0x601] = idx | BGCOLOR[idx2 | this.bg[q | 0x09]];
			data[p + 0x602] = idx | BGCOLOR[idx2 | this.bg[q | 0x0a]];
			data[p + 0x603] = idx | BGCOLOR[idx2 | this.bg[q | 0x0b]];
			data[p + 0x604] = idx | BGCOLOR[idx2 | this.bg[q | 0x0c]];
			data[p + 0x605] = idx | BGCOLOR[idx2 | this.bg[q | 0x0d]];
			data[p + 0x606] = idx | BGCOLOR[idx2 | this.bg[q | 0x0e]];
			data[p + 0x607] = idx | BGCOLOR[idx2 | this.bg[q | 0x0f]];
			data[p + 0x700] = idx | BGCOLOR[idx2 | this.bg[q | 0x00]];
			data[p + 0x701] = idx | BGCOLOR[idx2 | this.bg[q | 0x01]];
			data[p + 0x702] = idx | BGCOLOR[idx2 | this.bg[q | 0x02]];
			data[p + 0x703] = idx | BGCOLOR[idx2 | this.bg[q | 0x03]];
			data[p + 0x704] = idx | BGCOLOR[idx2 | this.bg[q | 0x04]];
			data[p + 0x705] = idx | BGCOLOR[idx2 | this.bg[q | 0x05]];
			data[p + 0x706] = idx | BGCOLOR[idx2 | this.bg[q | 0x06]];
			data[p + 0x707] = idx | BGCOLOR[idx2 | this.bg[q | 0x07]];
			break;
		case 2: // H反転
			data[p + 0x000] = idx | BGCOLOR[idx2 | this.bg[q | 0x07]];
			data[p + 0x001] = idx | BGCOLOR[idx2 | this.bg[q | 0x06]];
			data[p + 0x002] = idx | BGCOLOR[idx2 | this.bg[q | 0x05]];
			data[p + 0x003] = idx | BGCOLOR[idx2 | this.bg[q | 0x04]];
			data[p + 0x004] = idx | BGCOLOR[idx2 | this.bg[q | 0x03]];
			data[p + 0x005] = idx | BGCOLOR[idx2 | this.bg[q | 0x02]];
			data[p + 0x006] = idx | BGCOLOR[idx2 | this.bg[q | 0x01]];
			data[p + 0x007] = idx | BGCOLOR[idx2 | this.bg[q | 0x00]];
			data[p + 0x100] = idx | BGCOLOR[idx2 | this.bg[q | 0x0f]];
			data[p + 0x101] = idx | BGCOLOR[idx2 | this.bg[q | 0x0e]];
			data[p + 0x102] = idx | BGCOLOR[idx2 | this.bg[q | 0x0d]];
			data[p + 0x103] = idx | BGCOLOR[idx2 | this.bg[q | 0x0c]];
			data[p + 0x104] = idx | BGCOLOR[idx2 | this.bg[q | 0x0b]];
			data[p + 0x105] = idx | BGCOLOR[idx2 | this.bg[q | 0x0a]];
			data[p + 0x106] = idx | BGCOLOR[idx2 | this.bg[q | 0x09]];
			data[p + 0x107] = idx | BGCOLOR[idx2 | this.bg[q | 0x08]];
			data[p + 0x200] = idx | BGCOLOR[idx2 | this.bg[q | 0x17]];
			data[p + 0x201] = idx | BGCOLOR[idx2 | this.bg[q | 0x16]];
			data[p + 0x202] = idx | BGCOLOR[idx2 | this.bg[q | 0x15]];
			data[p + 0x203] = idx | BGCOLOR[idx2 | this.bg[q | 0x14]];
			data[p + 0x204] = idx | BGCOLOR[idx2 | this.bg[q | 0x13]];
			data[p + 0x205] = idx | BGCOLOR[idx2 | this.bg[q | 0x12]];
			data[p + 0x206] = idx | BGCOLOR[idx2 | this.bg[q | 0x11]];
			data[p + 0x207] = idx | BGCOLOR[idx2 | this.bg[q | 0x10]];
			data[p + 0x300] = idx | BGCOLOR[idx2 | this.bg[q | 0x1f]];
			data[p + 0x301] = idx | BGCOLOR[idx2 | this.bg[q | 0x1e]];
			data[p + 0x302] = idx | BGCOLOR[idx2 | this.bg[q | 0x1d]];
			data[p + 0x303] = idx | BGCOLOR[idx2 | this.bg[q | 0x1c]];
			data[p + 0x304] = idx | BGCOLOR[idx2 | this.bg[q | 0x1b]];
			data[p + 0x305] = idx | BGCOLOR[idx2 | this.bg[q | 0x1a]];
			data[p + 0x306] = idx | BGCOLOR[idx2 | this.bg[q | 0x19]];
			data[p + 0x307] = idx | BGCOLOR[idx2 | this.bg[q | 0x18]];
			data[p + 0x400] = idx | BGCOLOR[idx2 | this.bg[q | 0x27]];
			data[p + 0x401] = idx | BGCOLOR[idx2 | this.bg[q | 0x26]];
			data[p + 0x402] = idx | BGCOLOR[idx2 | this.bg[q | 0x25]];
			data[p + 0x403] = idx | BGCOLOR[idx2 | this.bg[q | 0x24]];
			data[p + 0x404] = idx | BGCOLOR[idx2 | this.bg[q | 0x23]];
			data[p + 0x405] = idx | BGCOLOR[idx2 | this.bg[q | 0x22]];
			data[p + 0x406] = idx | BGCOLOR[idx2 | this.bg[q | 0x21]];
			data[p + 0x407] = idx | BGCOLOR[idx2 | this.bg[q | 0x20]];
			data[p + 0x500] = idx | BGCOLOR[idx2 | this.bg[q | 0x2f]];
			data[p + 0x501] = idx | BGCOLOR[idx2 | this.bg[q | 0x2e]];
			data[p + 0x502] = idx | BGCOLOR[idx2 | this.bg[q | 0x2d]];
			data[p + 0x503] = idx | BGCOLOR[idx2 | this.bg[q | 0x2c]];
			data[p + 0x504] = idx | BGCOLOR[idx2 | this.bg[q | 0x2b]];
			data[p + 0x505] = idx | BGCOLOR[idx2 | this.bg[q | 0x2a]];
			data[p + 0x506] = idx | BGCOLOR[idx2 | this.bg[q | 0x29]];
			data[p + 0x507] = idx | BGCOLOR[idx2 | this.bg[q | 0x28]];
			data[p + 0x600] = idx | BGCOLOR[idx2 | this.bg[q | 0x37]];
			data[p + 0x601] = idx | BGCOLOR[idx2 | this.bg[q | 0x36]];
			data[p + 0x602] = idx | BGCOLOR[idx2 | this.bg[q | 0x35]];
			data[p + 0x603] = idx | BGCOLOR[idx2 | this.bg[q | 0x34]];
			data[p + 0x604] = idx | BGCOLOR[idx2 | this.bg[q | 0x33]];
			data[p + 0x605] = idx | BGCOLOR[idx2 | this.bg[q | 0x32]];
			data[p + 0x606] = idx | BGCOLOR[idx2 | this.bg[q | 0x31]];
			data[p + 0x607] = idx | BGCOLOR[idx2 | this.bg[q | 0x30]];
			data[p + 0x700] = idx | BGCOLOR[idx2 | this.bg[q | 0x3f]];
			data[p + 0x701] = idx | BGCOLOR[idx2 | this.bg[q | 0x3e]];
			data[p + 0x702] = idx | BGCOLOR[idx2 | this.bg[q | 0x3d]];
			data[p + 0x703] = idx | BGCOLOR[idx2 | this.bg[q | 0x3c]];
			data[p + 0x704] = idx | BGCOLOR[idx2 | this.bg[q | 0x3b]];
			data[p + 0x705] = idx | BGCOLOR[idx2 | this.bg[q | 0x3a]];
			data[p + 0x706] = idx | BGCOLOR[idx2 | this.bg[q | 0x39]];
			data[p + 0x707] = idx | BGCOLOR[idx2 | this.bg[q | 0x38]];
			break;
		case 3: // HV反転
			data[p + 0x000] = idx | BGCOLOR[idx2 | this.bg[q | 0x3f]];
			data[p + 0x001] = idx | BGCOLOR[idx2 | this.bg[q | 0x3e]];
			data[p + 0x002] = idx | BGCOLOR[idx2 | this.bg[q | 0x3d]];
			data[p + 0x003] = idx | BGCOLOR[idx2 | this.bg[q | 0x3c]];
			data[p + 0x004] = idx | BGCOLOR[idx2 | this.bg[q | 0x3b]];
			data[p + 0x005] = idx | BGCOLOR[idx2 | this.bg[q | 0x3a]];
			data[p + 0x006] = idx | BGCOLOR[idx2 | this.bg[q | 0x39]];
			data[p + 0x007] = idx | BGCOLOR[idx2 | this.bg[q | 0x38]];
			data[p + 0x100] = idx | BGCOLOR[idx2 | this.bg[q | 0x37]];
			data[p + 0x101] = idx | BGCOLOR[idx2 | this.bg[q | 0x36]];
			data[p + 0x102] = idx | BGCOLOR[idx2 | this.bg[q | 0x35]];
			data[p + 0x103] = idx | BGCOLOR[idx2 | this.bg[q | 0x34]];
			data[p + 0x104] = idx | BGCOLOR[idx2 | this.bg[q | 0x33]];
			data[p + 0x105] = idx | BGCOLOR[idx2 | this.bg[q | 0x32]];
			data[p + 0x106] = idx | BGCOLOR[idx2 | this.bg[q | 0x31]];
			data[p + 0x107] = idx | BGCOLOR[idx2 | this.bg[q | 0x30]];
			data[p + 0x200] = idx | BGCOLOR[idx2 | this.bg[q | 0x2f]];
			data[p + 0x201] = idx | BGCOLOR[idx2 | this.bg[q | 0x2e]];
			data[p + 0x202] = idx | BGCOLOR[idx2 | this.bg[q | 0x2d]];
			data[p + 0x203] = idx | BGCOLOR[idx2 | this.bg[q | 0x2c]];
			data[p + 0x204] = idx | BGCOLOR[idx2 | this.bg[q | 0x2b]];
			data[p + 0x205] = idx | BGCOLOR[idx2 | this.bg[q | 0x2a]];
			data[p + 0x206] = idx | BGCOLOR[idx2 | this.bg[q | 0x29]];
			data[p + 0x207] = idx | BGCOLOR[idx2 | this.bg[q | 0x28]];
			data[p + 0x300] = idx | BGCOLOR[idx2 | this.bg[q | 0x27]];
			data[p + 0x301] = idx | BGCOLOR[idx2 | this.bg[q | 0x26]];
			data[p + 0x302] = idx | BGCOLOR[idx2 | this.bg[q | 0x25]];
			data[p + 0x303] = idx | BGCOLOR[idx2 | this.bg[q | 0x24]];
			data[p + 0x304] = idx | BGCOLOR[idx2 | this.bg[q | 0x23]];
			data[p + 0x305] = idx | BGCOLOR[idx2 | this.bg[q | 0x22]];
			data[p + 0x306] = idx | BGCOLOR[idx2 | this.bg[q | 0x21]];
			data[p + 0x307] = idx | BGCOLOR[idx2 | this.bg[q | 0x20]];
			data[p + 0x400] = idx | BGCOLOR[idx2 | this.bg[q | 0x1f]];
			data[p + 0x401] = idx | BGCOLOR[idx2 | this.bg[q | 0x1e]];
			data[p + 0x402] = idx | BGCOLOR[idx2 | this.bg[q | 0x1d]];
			data[p + 0x403] = idx | BGCOLOR[idx2 | this.bg[q | 0x1c]];
			data[p + 0x404] = idx | BGCOLOR[idx2 | this.bg[q | 0x1b]];
			data[p + 0x405] = idx | BGCOLOR[idx2 | this.bg[q | 0x1a]];
			data[p + 0x406] = idx | BGCOLOR[idx2 | this.bg[q | 0x19]];
			data[p + 0x407] = idx | BGCOLOR[idx2 | this.bg[q | 0x18]];
			data[p + 0x500] = idx | BGCOLOR[idx2 | this.bg[q | 0x17]];
			data[p + 0x501] = idx | BGCOLOR[idx2 | this.bg[q | 0x16]];
			data[p + 0x502] = idx | BGCOLOR[idx2 | this.bg[q | 0x15]];
			data[p + 0x503] = idx | BGCOLOR[idx2 | this.bg[q | 0x14]];
			data[p + 0x504] = idx | BGCOLOR[idx2 | this.bg[q | 0x13]];
			data[p + 0x505] = idx | BGCOLOR[idx2 | this.bg[q | 0x12]];
			data[p + 0x506] = idx | BGCOLOR[idx2 | this.bg[q | 0x11]];
			data[p + 0x507] = idx | BGCOLOR[idx2 | this.bg[q | 0x10]];
			data[p + 0x600] = idx | BGCOLOR[idx2 | this.bg[q | 0x0f]];
			data[p + 0x601] = idx | BGCOLOR[idx2 | this.bg[q | 0x0e]];
			data[p + 0x602] = idx | BGCOLOR[idx2 | this.bg[q | 0x0d]];
			data[p + 0x603] = idx | BGCOLOR[idx2 | this.bg[q | 0x0c]];
			data[p + 0x604] = idx | BGCOLOR[idx2 | this.bg[q | 0x0b]];
			data[p + 0x605] = idx | BGCOLOR[idx2 | this.bg[q | 0x0a]];
			data[p + 0x606] = idx | BGCOLOR[idx2 | this.bg[q | 0x09]];
			data[p + 0x607] = idx | BGCOLOR[idx2 | this.bg[q | 0x08]];
			data[p + 0x700] = idx | BGCOLOR[idx2 | this.bg[q | 0x07]];
			data[p + 0x701] = idx | BGCOLOR[idx2 | this.bg[q | 0x06]];
			data[p + 0x702] = idx | BGCOLOR[idx2 | this.bg[q | 0x05]];
			data[p + 0x703] = idx | BGCOLOR[idx2 | this.bg[q | 0x04]];
			data[p + 0x704] = idx | BGCOLOR[idx2 | this.bg[q | 0x03]];
			data[p + 0x705] = idx | BGCOLOR[idx2 | this.bg[q | 0x02]];
			data[p + 0x706] = idx | BGCOLOR[idx2 | this.bg[q | 0x01]];
			data[p + 0x707] = idx | BGCOLOR[idx2 | this.bg[q | 0x00]];
			break;
		}
	}

	xfer16x16(data, dst, src) {
		const idx = this.palette << 4 & 0x70, idx2 = src >> 4 & 0xf0;
		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		src = src << 8 & 0xff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let px, j = 16; j !== 0; dst++, --j)
				(px = OBJCOLOR[idx2 | this.obj[src++]]) && (data[dst] = idx | px);
	}

	xfer16x16V(data, dst, src) {
		const idx = this.palette << 4 & 0x70, idx2 = src >> 4 & 0xf0;
		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		src = (src << 8 & 0xff00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let px, j = 16; j !== 0; dst++, --j)
				(px = OBJCOLOR[idx2 | this.obj[src++]]) && (data[dst] = idx | px);
	}

	xfer16x16H(data, dst, src) {
		const idx = this.palette << 4 & 0x70, idx2 = src >> 4 & 0xf0;
		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		src = (src << 8 & 0xff00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let px, j = 16; j !== 0; dst++, --j)
				(px = OBJCOLOR[idx2 | this.obj[--src]]) && (data[dst] = idx | px);
	}

	xfer16x16HV(data, dst, src) {
		const idx = this.palette << 4 & 0x70, idx2 = src >> 4 & 0xf0;
		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		src = (src << 8 & 0xff00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let px, j = 16; j !== 0; dst++, --j)
				(px = OBJCOLOR[idx2 | this.obj[--src]]) && (data[dst] = idx | px);
	}
}

/*
 *
 *	Time Pilot '84
 *
 */

import {ROM} from "./dist/time_pilot_84.png.js";
let PRG1, PRG2, PRG3, BG, OBJ, RED, GREEN, BLUE, BGCOLOR, OBJCOLOR;

window.addEventListener('load', () => expand(ROM).then(ROM => {
	PRG1 = new Uint8Array(ROM.buffer, 0x0, 0x8000).addBase();
	PRG2 = new Uint8Array(ROM.buffer, 0x8000, 0x2000).addBase();
	PRG3 = new Uint8Array(ROM.buffer, 0xa000, 0x2000).addBase();
	BG = new Uint8Array(ROM.buffer, 0xc000, 0x4000);
	OBJ = new Uint8Array(ROM.buffer, 0x10000, 0x8000);
	RED = new Uint8Array(ROM.buffer, 0x18000, 0x100);
	GREEN = new Uint8Array(ROM.buffer, 0x18100, 0x100);
	BLUE = new Uint8Array(ROM.buffer, 0x18200, 0x100);
	OBJCOLOR = new Uint8Array(ROM.buffer, 0x18300, 0x100);
	BGCOLOR = new Uint8Array(ROM.buffer, 0x18400, 0x100);
	game = new TimePilot84();
	sound = [
		new SN76489({clock: Math.floor(14318181 / 8)}),
		new SN76489({clock: Math.floor(14318181 / 8)}),
		new SN76489({clock: Math.floor(14318181 / 8)}),
	];
	canvas.addEventListener('click', () => game.coin(true));
	init({game, sound});
}));

