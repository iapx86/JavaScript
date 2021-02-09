/*
 *
 *	Time Pilot
 *
 */

import AY_3_8910 from './ay-3-8910.js';
import {init, seq, rseq, convertGFX, read} from './main.js';
import Z80 from './z80.js';
let game, sound;

class TimePilot {
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
	nBonus = '10000 50000';
	nDifficulty = 4;

	fInterruptEnable = false;

	ram = new Uint8Array(0x1400).addBase();
	in = Uint8Array.of(0xff, 0xff, 0xff, 0xff, 0x4b);
	ram2 = new Uint8Array(0x400).addBase();
	psg = [{addr: 0}, {addr: 0}];
	cpu2_irq = false;

	bg = new Uint8Array(0x8000).fill(3);
	obj = new Uint8Array(0x10000).fill(3);
	bgcolor = Uint8Array.from(BGCOLOR, e => 0x10 | e);
	rgb = Uint32Array.from(seq(0x20).map(i => RGB_H[i] << 8 | RGB_L[i]), e => 0xff000000 | (e >> 11) * 255 / 31 << 16 | (e >> 6 & 31) * 255 / 31 << 8 | (e >> 1 & 31) * 255 / 31);
	vpos = 0;

	cpu = new Z80(Math.floor(18432000 / 6));
	cpu2 = new Z80(Math.floor(14318181 / 8));
	scanline = {rate: 256 * 60, frac: 0, count: 0, execute(rate, fn) {
		for (this.frac += this.rate; this.frac >= rate; this.frac -= rate)
			fn(this.count = this.count + 1 & 255);
	}};
	timer = {rate: 14318181 / 4096, frac: 0, count: 0, execute(rate, rate_correction, fn) {
		for (this.frac += this.rate * rate_correction; this.frac >= rate; this.frac -= rate)
			fn(this.count = (this.count + 1) % 10);
	}};

	constructor() {
		// CPU周りの初期化
		const range = (page, start, end, mirror = 0) => (page & ~mirror) >= start && (page & ~mirror) <= end;

		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0x5f))
				this.cpu.memorymap[page].base = PRG1.base[page & 0x7f];
			else if (range(page, 0xa0, 0xaf)) {
				this.cpu.memorymap[page].base = this.ram.base[page & 0xf];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0xb0, 0xb0, 0x0b)) {
				this.cpu.memorymap[page].base = this.ram.base[0x10];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0xb4, 0xb4, 0x0b)) {
				this.cpu.memorymap[page].base = this.ram.base[0x11];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0xc0, 0xc0, 0x0c)) {
				this.cpu.memorymap[page].read = () => { return this.vpos; };
				this.cpu.memorymap[page].write = (addr, data) => { this.cpu2_irq = true, sound[0].write(0xe, data); };
			} else if (range(page, 0xc2, 0xc2, 0x0c))
				this.cpu.memorymap[page].read = () => { return this.in[4]; };
			else if (range(page, 0xc3, 0xc3, 0x0c)) {
				this.cpu.memorymap[page].read = (addr) => { return this.in[addr >> 5 & 3]; };
				this.cpu.memorymap[page].write = (addr, data) => {
					switch (addr >> 1 & 0x7f) {
					case 0:
						return void(this.fInterruptEnable = (data & 1) !== 0);
					case 3:
						return sound[0].control(!(data & 1)), sound[1].control(!(data & 1));
					}
				};
			}

		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0x0f))
				this.cpu2.memorymap[page].base = PRG2.base[page & 0xf];
			else if (range(page, 0x30, 0x33, 0x0c)) {
				this.cpu2.memorymap[page].base = this.ram2.base[page & 3];
				this.cpu2.memorymap[page].write = null;
			} else if (range(page, 0x40, 0x40, 0x0f)) {
				this.cpu2.memorymap[page].read = () => { return sound[0].read(this.psg[0].addr); };
				this.cpu2.memorymap[page].write = (addr, data) => { sound[0].write(this.psg[0].addr, data); };
			} else if (range(page, 0x50, 0x50, 0x0f))
				this.cpu2.memorymap[page].write = (addr, data) => { this.psg[0].addr = data; };
			else if (range(page, 0x60, 0x60, 0x0f)) {
				this.cpu2.memorymap[page].read = () => { return sound[1].read(this.psg[1].addr); };
				this.cpu2.memorymap[page].write = (addr, data) => { sound[1].write(this.psg[1].addr, data); };
			} else if (range(page, 0x70, 0x70, 0x0f))
				this.cpu2.memorymap[page].write = (addr, data) => { this.psg[1].addr = data; };

		this.cpu2.check_interrupt = () => { return this.cpu2_irq && this.cpu2.interrupt() && (this.cpu2_irq = false, true); };

		// Videoの初期化
		convertGFX(this.bg, BG, 512, rseq(8, 0, 8), seq(4).concat(seq(4, 64)), [4, 0], 16);
		convertGFX(this.obj, OBJ, 256, rseq(8, 256, 8).concat(rseq(8, 0, 8)), rseq(4, 192).concat(rseq(4, 128), rseq(4, 64), rseq(4)), [4, 0], 64);
	}

	execute(audio, rate_correction) {
		const tick_rate = 384000, tick_max = Math.floor(tick_rate / 60);
		for (let i = 0; i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.cpu2.execute(tick_rate);
			this.scanline.execute(tick_rate, (cnt) => {
				this.vpos = cnt + 240 & 0xff;
				!this.vpos && this.ram.copyWithin(0x1200, 0x1000, 0x1200);
				this.vpos === 240 && this.fInterruptEnable && this.cpu.non_maskable_interrupt();
			});
			this.timer.execute(tick_rate, rate_correction, (cnt) => sound[0].write(0xf, [0x00, 0x10, 0x20, 0x30, 0x40, 0x90, 0xa0, 0xb0, 0xa0, 0xd0][cnt]));
			sound[0].execute(tick_rate, rate_correction);
			sound[1].execute(tick_rate, rate_correction);
			audio.execute(tick_rate, rate_correction);
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
			case 3:
				this.in[4] |= 3;
				break;
			case 4:
				this.in[4] = this.in[4] & ~3 | 2;
				break;
			case 5:
				this.in[4] = this.in[4] & ~3 | 1;
				break;
			case 255:
				this.in[4] &= ~3;
				break;
			}
			switch (this.nBonus) {
			case '10000 50000':
				this.in[4] |= 8;
				break;
			case '20000 60000':
				this.in[4] &= ~8;
				break;
			}
			switch (this.nDifficulty) {
			case 1:
				this.in[4] |= 0x70;
				break;
			case 2:
				this.in[4] = this.in[4] & ~0x70 | 0x60;
				break;
			case 3:
				this.in[4] = this.in[4] & ~0x70 | 0x50;
				break;
			case 4:
				this.in[4] = this.in[4] & ~0x70 | 0x40;
				break;
			case 5:
				this.in[4] = this.in[4] & ~0x70 | 0x30;
				break;
			case 6:
				this.in[4] = this.in[4] & ~0x70 | 0x20;
				break;
			case 7:
				this.in[4] = this.in[4] & ~0x70 | 0x10;
				break;
			case 8:
				this.in[4] &= ~0x70;
				break;
			}
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
		this.in[0] = this.in[0] & ~0x19 | !this.fCoin << 0 | !this.fStart1P << 3 | !this.fStart2P << 4;
		this.fCoin -= !!this.fCoin, this.fStart1P -= !!this.fStart1P, this.fStart2P -= !!this.fStart2P;
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

	makeBitmap(data) {
		// bg描画
		let p = 256 * 8 * 2 + 232;
		for (let k = 0x40, i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				this.xfer8x8(data, p, k, 0);

		// obj描画
		for (let k = 0x103e; k >= 0x1010; k -= 2) {
			const dst0 = this.ram[k + 0x301] - 1 & 0xff | this.ram[k + 0x200] + 16 << 8;
			const src0 = this.ram[k + 0x201] | this.ram[k + 0x300] << 8;
			switch (src0 >> 14) {
			case 0: // ノーマル
				this.xfer16x16(data, dst0, src0);
				break;
			case 1: // V反転
				this.xfer16x16V(data, dst0, src0);
				break;
			case 2: // H反転
				this.xfer16x16H(data, dst0, src0);
				break;
			case 3: // HV反転
				this.xfer16x16HV(data, dst0, src0);
				break;
			}
			const dst1 = this.ram[k + 0x101] - 1 & 0xff | this.ram[k] + 16 << 8;
			const src1 = this.ram[k + 1] | this.ram[k + 0x100] << 8;
			if (dst1 === dst0 && src1 === src0)
				continue;
			switch (src1 >> 14) {
			case 0: // ノーマル
				this.xfer16x16(data, dst1, src1);
				break;
			case 1: // V反転
				this.xfer16x16V(data, dst1, src1);
				break;
			case 2: // H反転
				this.xfer16x16H(data, dst1, src1);
				break;
			case 3: // HV反転
				this.xfer16x16HV(data, dst1, src1);
				break;
			}
		}

		// bg描画
		p = 256 * 8 * 2 + 232;
		for (let k = 0x40, i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				this.xfer8x8(data, p, k, 1);

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] = this.rgb[data[p]];
	}

	xfer8x8(data, p, k, pri) {
		const q = (this.ram[0x400 + k] | this.ram[k] << 3 & 0x100) << 6, idx = this.ram[k] << 2 & 0x7c;

		if ((this.ram[k] >> 4 & 1) !== pri)
			return;
		switch (this.ram[k] >> 6) {
		case 0: // ノーマル
			data[p + 0x000] = this.bgcolor[idx | this.bg[q | 0x00]];
			data[p + 0x001] = this.bgcolor[idx | this.bg[q | 0x01]];
			data[p + 0x002] = this.bgcolor[idx | this.bg[q | 0x02]];
			data[p + 0x003] = this.bgcolor[idx | this.bg[q | 0x03]];
			data[p + 0x004] = this.bgcolor[idx | this.bg[q | 0x04]];
			data[p + 0x005] = this.bgcolor[idx | this.bg[q | 0x05]];
			data[p + 0x006] = this.bgcolor[idx | this.bg[q | 0x06]];
			data[p + 0x007] = this.bgcolor[idx | this.bg[q | 0x07]];
			data[p + 0x100] = this.bgcolor[idx | this.bg[q | 0x08]];
			data[p + 0x101] = this.bgcolor[idx | this.bg[q | 0x09]];
			data[p + 0x102] = this.bgcolor[idx | this.bg[q | 0x0a]];
			data[p + 0x103] = this.bgcolor[idx | this.bg[q | 0x0b]];
			data[p + 0x104] = this.bgcolor[idx | this.bg[q | 0x0c]];
			data[p + 0x105] = this.bgcolor[idx | this.bg[q | 0x0d]];
			data[p + 0x106] = this.bgcolor[idx | this.bg[q | 0x0e]];
			data[p + 0x107] = this.bgcolor[idx | this.bg[q | 0x0f]];
			data[p + 0x200] = this.bgcolor[idx | this.bg[q | 0x10]];
			data[p + 0x201] = this.bgcolor[idx | this.bg[q | 0x11]];
			data[p + 0x202] = this.bgcolor[idx | this.bg[q | 0x12]];
			data[p + 0x203] = this.bgcolor[idx | this.bg[q | 0x13]];
			data[p + 0x204] = this.bgcolor[idx | this.bg[q | 0x14]];
			data[p + 0x205] = this.bgcolor[idx | this.bg[q | 0x15]];
			data[p + 0x206] = this.bgcolor[idx | this.bg[q | 0x16]];
			data[p + 0x207] = this.bgcolor[idx | this.bg[q | 0x17]];
			data[p + 0x300] = this.bgcolor[idx | this.bg[q | 0x18]];
			data[p + 0x301] = this.bgcolor[idx | this.bg[q | 0x19]];
			data[p + 0x302] = this.bgcolor[idx | this.bg[q | 0x1a]];
			data[p + 0x303] = this.bgcolor[idx | this.bg[q | 0x1b]];
			data[p + 0x304] = this.bgcolor[idx | this.bg[q | 0x1c]];
			data[p + 0x305] = this.bgcolor[idx | this.bg[q | 0x1d]];
			data[p + 0x306] = this.bgcolor[idx | this.bg[q | 0x1e]];
			data[p + 0x307] = this.bgcolor[idx | this.bg[q | 0x1f]];
			data[p + 0x400] = this.bgcolor[idx | this.bg[q | 0x20]];
			data[p + 0x401] = this.bgcolor[idx | this.bg[q | 0x21]];
			data[p + 0x402] = this.bgcolor[idx | this.bg[q | 0x22]];
			data[p + 0x403] = this.bgcolor[idx | this.bg[q | 0x23]];
			data[p + 0x404] = this.bgcolor[idx | this.bg[q | 0x24]];
			data[p + 0x405] = this.bgcolor[idx | this.bg[q | 0x25]];
			data[p + 0x406] = this.bgcolor[idx | this.bg[q | 0x26]];
			data[p + 0x407] = this.bgcolor[idx | this.bg[q | 0x27]];
			data[p + 0x500] = this.bgcolor[idx | this.bg[q | 0x28]];
			data[p + 0x501] = this.bgcolor[idx | this.bg[q | 0x29]];
			data[p + 0x502] = this.bgcolor[idx | this.bg[q | 0x2a]];
			data[p + 0x503] = this.bgcolor[idx | this.bg[q | 0x2b]];
			data[p + 0x504] = this.bgcolor[idx | this.bg[q | 0x2c]];
			data[p + 0x505] = this.bgcolor[idx | this.bg[q | 0x2d]];
			data[p + 0x506] = this.bgcolor[idx | this.bg[q | 0x2e]];
			data[p + 0x507] = this.bgcolor[idx | this.bg[q | 0x2f]];
			data[p + 0x600] = this.bgcolor[idx | this.bg[q | 0x30]];
			data[p + 0x601] = this.bgcolor[idx | this.bg[q | 0x31]];
			data[p + 0x602] = this.bgcolor[idx | this.bg[q | 0x32]];
			data[p + 0x603] = this.bgcolor[idx | this.bg[q | 0x33]];
			data[p + 0x604] = this.bgcolor[idx | this.bg[q | 0x34]];
			data[p + 0x605] = this.bgcolor[idx | this.bg[q | 0x35]];
			data[p + 0x606] = this.bgcolor[idx | this.bg[q | 0x36]];
			data[p + 0x607] = this.bgcolor[idx | this.bg[q | 0x37]];
			data[p + 0x700] = this.bgcolor[idx | this.bg[q | 0x38]];
			data[p + 0x701] = this.bgcolor[idx | this.bg[q | 0x39]];
			data[p + 0x702] = this.bgcolor[idx | this.bg[q | 0x3a]];
			data[p + 0x703] = this.bgcolor[idx | this.bg[q | 0x3b]];
			data[p + 0x704] = this.bgcolor[idx | this.bg[q | 0x3c]];
			data[p + 0x705] = this.bgcolor[idx | this.bg[q | 0x3d]];
			data[p + 0x706] = this.bgcolor[idx | this.bg[q | 0x3e]];
			data[p + 0x707] = this.bgcolor[idx | this.bg[q | 0x3f]];
			break;
		case 1: // V反転
			data[p + 0x000] = this.bgcolor[idx | this.bg[q | 0x38]];
			data[p + 0x001] = this.bgcolor[idx | this.bg[q | 0x39]];
			data[p + 0x002] = this.bgcolor[idx | this.bg[q | 0x3a]];
			data[p + 0x003] = this.bgcolor[idx | this.bg[q | 0x3b]];
			data[p + 0x004] = this.bgcolor[idx | this.bg[q | 0x3c]];
			data[p + 0x005] = this.bgcolor[idx | this.bg[q | 0x3d]];
			data[p + 0x006] = this.bgcolor[idx | this.bg[q | 0x3e]];
			data[p + 0x007] = this.bgcolor[idx | this.bg[q | 0x3f]];
			data[p + 0x100] = this.bgcolor[idx | this.bg[q | 0x30]];
			data[p + 0x101] = this.bgcolor[idx | this.bg[q | 0x31]];
			data[p + 0x102] = this.bgcolor[idx | this.bg[q | 0x32]];
			data[p + 0x103] = this.bgcolor[idx | this.bg[q | 0x33]];
			data[p + 0x104] = this.bgcolor[idx | this.bg[q | 0x34]];
			data[p + 0x105] = this.bgcolor[idx | this.bg[q | 0x35]];
			data[p + 0x106] = this.bgcolor[idx | this.bg[q | 0x36]];
			data[p + 0x107] = this.bgcolor[idx | this.bg[q | 0x37]];
			data[p + 0x200] = this.bgcolor[idx | this.bg[q | 0x28]];
			data[p + 0x201] = this.bgcolor[idx | this.bg[q | 0x29]];
			data[p + 0x202] = this.bgcolor[idx | this.bg[q | 0x2a]];
			data[p + 0x203] = this.bgcolor[idx | this.bg[q | 0x2b]];
			data[p + 0x204] = this.bgcolor[idx | this.bg[q | 0x2c]];
			data[p + 0x205] = this.bgcolor[idx | this.bg[q | 0x2d]];
			data[p + 0x206] = this.bgcolor[idx | this.bg[q | 0x2e]];
			data[p + 0x207] = this.bgcolor[idx | this.bg[q | 0x2f]];
			data[p + 0x300] = this.bgcolor[idx | this.bg[q | 0x20]];
			data[p + 0x301] = this.bgcolor[idx | this.bg[q | 0x21]];
			data[p + 0x302] = this.bgcolor[idx | this.bg[q | 0x22]];
			data[p + 0x303] = this.bgcolor[idx | this.bg[q | 0x23]];
			data[p + 0x304] = this.bgcolor[idx | this.bg[q | 0x24]];
			data[p + 0x305] = this.bgcolor[idx | this.bg[q | 0x25]];
			data[p + 0x306] = this.bgcolor[idx | this.bg[q | 0x26]];
			data[p + 0x307] = this.bgcolor[idx | this.bg[q | 0x27]];
			data[p + 0x400] = this.bgcolor[idx | this.bg[q | 0x18]];
			data[p + 0x401] = this.bgcolor[idx | this.bg[q | 0x19]];
			data[p + 0x402] = this.bgcolor[idx | this.bg[q | 0x1a]];
			data[p + 0x403] = this.bgcolor[idx | this.bg[q | 0x1b]];
			data[p + 0x404] = this.bgcolor[idx | this.bg[q | 0x1c]];
			data[p + 0x405] = this.bgcolor[idx | this.bg[q | 0x1d]];
			data[p + 0x406] = this.bgcolor[idx | this.bg[q | 0x1e]];
			data[p + 0x407] = this.bgcolor[idx | this.bg[q | 0x1f]];
			data[p + 0x500] = this.bgcolor[idx | this.bg[q | 0x10]];
			data[p + 0x501] = this.bgcolor[idx | this.bg[q | 0x11]];
			data[p + 0x502] = this.bgcolor[idx | this.bg[q | 0x12]];
			data[p + 0x503] = this.bgcolor[idx | this.bg[q | 0x13]];
			data[p + 0x504] = this.bgcolor[idx | this.bg[q | 0x14]];
			data[p + 0x505] = this.bgcolor[idx | this.bg[q | 0x15]];
			data[p + 0x506] = this.bgcolor[idx | this.bg[q | 0x16]];
			data[p + 0x507] = this.bgcolor[idx | this.bg[q | 0x17]];
			data[p + 0x600] = this.bgcolor[idx | this.bg[q | 0x08]];
			data[p + 0x601] = this.bgcolor[idx | this.bg[q | 0x09]];
			data[p + 0x602] = this.bgcolor[idx | this.bg[q | 0x0a]];
			data[p + 0x603] = this.bgcolor[idx | this.bg[q | 0x0b]];
			data[p + 0x604] = this.bgcolor[idx | this.bg[q | 0x0c]];
			data[p + 0x605] = this.bgcolor[idx | this.bg[q | 0x0d]];
			data[p + 0x606] = this.bgcolor[idx | this.bg[q | 0x0e]];
			data[p + 0x607] = this.bgcolor[idx | this.bg[q | 0x0f]];
			data[p + 0x700] = this.bgcolor[idx | this.bg[q | 0x00]];
			data[p + 0x701] = this.bgcolor[idx | this.bg[q | 0x01]];
			data[p + 0x702] = this.bgcolor[idx | this.bg[q | 0x02]];
			data[p + 0x703] = this.bgcolor[idx | this.bg[q | 0x03]];
			data[p + 0x704] = this.bgcolor[idx | this.bg[q | 0x04]];
			data[p + 0x705] = this.bgcolor[idx | this.bg[q | 0x05]];
			data[p + 0x706] = this.bgcolor[idx | this.bg[q | 0x06]];
			data[p + 0x707] = this.bgcolor[idx | this.bg[q | 0x07]];
			break;
		case 2: // H反転
			data[p + 0x000] = this.bgcolor[idx | this.bg[q | 0x07]];
			data[p + 0x001] = this.bgcolor[idx | this.bg[q | 0x06]];
			data[p + 0x002] = this.bgcolor[idx | this.bg[q | 0x05]];
			data[p + 0x003] = this.bgcolor[idx | this.bg[q | 0x04]];
			data[p + 0x004] = this.bgcolor[idx | this.bg[q | 0x03]];
			data[p + 0x005] = this.bgcolor[idx | this.bg[q | 0x02]];
			data[p + 0x006] = this.bgcolor[idx | this.bg[q | 0x01]];
			data[p + 0x007] = this.bgcolor[idx | this.bg[q | 0x00]];
			data[p + 0x100] = this.bgcolor[idx | this.bg[q | 0x0f]];
			data[p + 0x101] = this.bgcolor[idx | this.bg[q | 0x0e]];
			data[p + 0x102] = this.bgcolor[idx | this.bg[q | 0x0d]];
			data[p + 0x103] = this.bgcolor[idx | this.bg[q | 0x0c]];
			data[p + 0x104] = this.bgcolor[idx | this.bg[q | 0x0b]];
			data[p + 0x105] = this.bgcolor[idx | this.bg[q | 0x0a]];
			data[p + 0x106] = this.bgcolor[idx | this.bg[q | 0x09]];
			data[p + 0x107] = this.bgcolor[idx | this.bg[q | 0x08]];
			data[p + 0x200] = this.bgcolor[idx | this.bg[q | 0x17]];
			data[p + 0x201] = this.bgcolor[idx | this.bg[q | 0x16]];
			data[p + 0x202] = this.bgcolor[idx | this.bg[q | 0x15]];
			data[p + 0x203] = this.bgcolor[idx | this.bg[q | 0x14]];
			data[p + 0x204] = this.bgcolor[idx | this.bg[q | 0x13]];
			data[p + 0x205] = this.bgcolor[idx | this.bg[q | 0x12]];
			data[p + 0x206] = this.bgcolor[idx | this.bg[q | 0x11]];
			data[p + 0x207] = this.bgcolor[idx | this.bg[q | 0x10]];
			data[p + 0x300] = this.bgcolor[idx | this.bg[q | 0x1f]];
			data[p + 0x301] = this.bgcolor[idx | this.bg[q | 0x1e]];
			data[p + 0x302] = this.bgcolor[idx | this.bg[q | 0x1d]];
			data[p + 0x303] = this.bgcolor[idx | this.bg[q | 0x1c]];
			data[p + 0x304] = this.bgcolor[idx | this.bg[q | 0x1b]];
			data[p + 0x305] = this.bgcolor[idx | this.bg[q | 0x1a]];
			data[p + 0x306] = this.bgcolor[idx | this.bg[q | 0x19]];
			data[p + 0x307] = this.bgcolor[idx | this.bg[q | 0x18]];
			data[p + 0x400] = this.bgcolor[idx | this.bg[q | 0x27]];
			data[p + 0x401] = this.bgcolor[idx | this.bg[q | 0x26]];
			data[p + 0x402] = this.bgcolor[idx | this.bg[q | 0x25]];
			data[p + 0x403] = this.bgcolor[idx | this.bg[q | 0x24]];
			data[p + 0x404] = this.bgcolor[idx | this.bg[q | 0x23]];
			data[p + 0x405] = this.bgcolor[idx | this.bg[q | 0x22]];
			data[p + 0x406] = this.bgcolor[idx | this.bg[q | 0x21]];
			data[p + 0x407] = this.bgcolor[idx | this.bg[q | 0x20]];
			data[p + 0x500] = this.bgcolor[idx | this.bg[q | 0x2f]];
			data[p + 0x501] = this.bgcolor[idx | this.bg[q | 0x2e]];
			data[p + 0x502] = this.bgcolor[idx | this.bg[q | 0x2d]];
			data[p + 0x503] = this.bgcolor[idx | this.bg[q | 0x2c]];
			data[p + 0x504] = this.bgcolor[idx | this.bg[q | 0x2b]];
			data[p + 0x505] = this.bgcolor[idx | this.bg[q | 0x2a]];
			data[p + 0x506] = this.bgcolor[idx | this.bg[q | 0x29]];
			data[p + 0x507] = this.bgcolor[idx | this.bg[q | 0x28]];
			data[p + 0x600] = this.bgcolor[idx | this.bg[q | 0x37]];
			data[p + 0x601] = this.bgcolor[idx | this.bg[q | 0x36]];
			data[p + 0x602] = this.bgcolor[idx | this.bg[q | 0x35]];
			data[p + 0x603] = this.bgcolor[idx | this.bg[q | 0x34]];
			data[p + 0x604] = this.bgcolor[idx | this.bg[q | 0x33]];
			data[p + 0x605] = this.bgcolor[idx | this.bg[q | 0x32]];
			data[p + 0x606] = this.bgcolor[idx | this.bg[q | 0x31]];
			data[p + 0x607] = this.bgcolor[idx | this.bg[q | 0x30]];
			data[p + 0x700] = this.bgcolor[idx | this.bg[q | 0x3f]];
			data[p + 0x701] = this.bgcolor[idx | this.bg[q | 0x3e]];
			data[p + 0x702] = this.bgcolor[idx | this.bg[q | 0x3d]];
			data[p + 0x703] = this.bgcolor[idx | this.bg[q | 0x3c]];
			data[p + 0x704] = this.bgcolor[idx | this.bg[q | 0x3b]];
			data[p + 0x705] = this.bgcolor[idx | this.bg[q | 0x3a]];
			data[p + 0x706] = this.bgcolor[idx | this.bg[q | 0x39]];
			data[p + 0x707] = this.bgcolor[idx | this.bg[q | 0x38]];
			break;
		case 3: // HV反転
			data[p + 0x000] = this.bgcolor[idx | this.bg[q | 0x3f]];
			data[p + 0x001] = this.bgcolor[idx | this.bg[q | 0x3e]];
			data[p + 0x002] = this.bgcolor[idx | this.bg[q | 0x3d]];
			data[p + 0x003] = this.bgcolor[idx | this.bg[q | 0x3c]];
			data[p + 0x004] = this.bgcolor[idx | this.bg[q | 0x3b]];
			data[p + 0x005] = this.bgcolor[idx | this.bg[q | 0x3a]];
			data[p + 0x006] = this.bgcolor[idx | this.bg[q | 0x39]];
			data[p + 0x007] = this.bgcolor[idx | this.bg[q | 0x38]];
			data[p + 0x100] = this.bgcolor[idx | this.bg[q | 0x37]];
			data[p + 0x101] = this.bgcolor[idx | this.bg[q | 0x36]];
			data[p + 0x102] = this.bgcolor[idx | this.bg[q | 0x35]];
			data[p + 0x103] = this.bgcolor[idx | this.bg[q | 0x34]];
			data[p + 0x104] = this.bgcolor[idx | this.bg[q | 0x33]];
			data[p + 0x105] = this.bgcolor[idx | this.bg[q | 0x32]];
			data[p + 0x106] = this.bgcolor[idx | this.bg[q | 0x31]];
			data[p + 0x107] = this.bgcolor[idx | this.bg[q | 0x30]];
			data[p + 0x200] = this.bgcolor[idx | this.bg[q | 0x2f]];
			data[p + 0x201] = this.bgcolor[idx | this.bg[q | 0x2e]];
			data[p + 0x202] = this.bgcolor[idx | this.bg[q | 0x2d]];
			data[p + 0x203] = this.bgcolor[idx | this.bg[q | 0x2c]];
			data[p + 0x204] = this.bgcolor[idx | this.bg[q | 0x2b]];
			data[p + 0x205] = this.bgcolor[idx | this.bg[q | 0x2a]];
			data[p + 0x206] = this.bgcolor[idx | this.bg[q | 0x29]];
			data[p + 0x207] = this.bgcolor[idx | this.bg[q | 0x28]];
			data[p + 0x300] = this.bgcolor[idx | this.bg[q | 0x27]];
			data[p + 0x301] = this.bgcolor[idx | this.bg[q | 0x26]];
			data[p + 0x302] = this.bgcolor[idx | this.bg[q | 0x25]];
			data[p + 0x303] = this.bgcolor[idx | this.bg[q | 0x24]];
			data[p + 0x304] = this.bgcolor[idx | this.bg[q | 0x23]];
			data[p + 0x305] = this.bgcolor[idx | this.bg[q | 0x22]];
			data[p + 0x306] = this.bgcolor[idx | this.bg[q | 0x21]];
			data[p + 0x307] = this.bgcolor[idx | this.bg[q | 0x20]];
			data[p + 0x400] = this.bgcolor[idx | this.bg[q | 0x1f]];
			data[p + 0x401] = this.bgcolor[idx | this.bg[q | 0x1e]];
			data[p + 0x402] = this.bgcolor[idx | this.bg[q | 0x1d]];
			data[p + 0x403] = this.bgcolor[idx | this.bg[q | 0x1c]];
			data[p + 0x404] = this.bgcolor[idx | this.bg[q | 0x1b]];
			data[p + 0x405] = this.bgcolor[idx | this.bg[q | 0x1a]];
			data[p + 0x406] = this.bgcolor[idx | this.bg[q | 0x19]];
			data[p + 0x407] = this.bgcolor[idx | this.bg[q | 0x18]];
			data[p + 0x500] = this.bgcolor[idx | this.bg[q | 0x17]];
			data[p + 0x501] = this.bgcolor[idx | this.bg[q | 0x16]];
			data[p + 0x502] = this.bgcolor[idx | this.bg[q | 0x15]];
			data[p + 0x503] = this.bgcolor[idx | this.bg[q | 0x14]];
			data[p + 0x504] = this.bgcolor[idx | this.bg[q | 0x13]];
			data[p + 0x505] = this.bgcolor[idx | this.bg[q | 0x12]];
			data[p + 0x506] = this.bgcolor[idx | this.bg[q | 0x11]];
			data[p + 0x507] = this.bgcolor[idx | this.bg[q | 0x10]];
			data[p + 0x600] = this.bgcolor[idx | this.bg[q | 0x0f]];
			data[p + 0x601] = this.bgcolor[idx | this.bg[q | 0x0e]];
			data[p + 0x602] = this.bgcolor[idx | this.bg[q | 0x0d]];
			data[p + 0x603] = this.bgcolor[idx | this.bg[q | 0x0c]];
			data[p + 0x604] = this.bgcolor[idx | this.bg[q | 0x0b]];
			data[p + 0x605] = this.bgcolor[idx | this.bg[q | 0x0a]];
			data[p + 0x606] = this.bgcolor[idx | this.bg[q | 0x09]];
			data[p + 0x607] = this.bgcolor[idx | this.bg[q | 0x08]];
			data[p + 0x700] = this.bgcolor[idx | this.bg[q | 0x07]];
			data[p + 0x701] = this.bgcolor[idx | this.bg[q | 0x06]];
			data[p + 0x702] = this.bgcolor[idx | this.bg[q | 0x05]];
			data[p + 0x703] = this.bgcolor[idx | this.bg[q | 0x04]];
			data[p + 0x704] = this.bgcolor[idx | this.bg[q | 0x03]];
			data[p + 0x705] = this.bgcolor[idx | this.bg[q | 0x02]];
			data[p + 0x706] = this.bgcolor[idx | this.bg[q | 0x01]];
			data[p + 0x707] = this.bgcolor[idx | this.bg[q | 0x00]];
			break;
		}
	}

	xfer16x16(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		src = src << 8 & 0xff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[src++]]))
					data[dst] = px;
	}

	xfer16x16V(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		src = (src << 8 & 0xff00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[src++]]))
					data[dst] = px;
	}

	xfer16x16H(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		src = (src << 8 & 0xff00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[--src]]))
					data[dst] = px;
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		src = (src << 8 & 0xff00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[--src]]))
					data[dst] = px;
	}
}

/*
 *
 *	Time Pilot
 *
 */

let PRG1, PRG2, BG, OBJ, RGB_H, RGB_L, OBJCOLOR, BGCOLOR;

read('timeplt.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG1 = Uint8Array.concat(...['tm1', 'tm2', 'tm3'].map(e => zip.decompress(e))).addBase();
	PRG2 = zip.decompress('tm7').addBase();
	BG = zip.decompress('tm6');
	OBJ = Uint8Array.concat(...['tm4', 'tm5'].map(e => zip.decompress(e)));
	RGB_H = zip.decompress('timeplt.b4');
	RGB_L = zip.decompress('timeplt.b5');
	OBJCOLOR = zip.decompress('timeplt.e9');
	BGCOLOR = zip.decompress('timeplt.e12');
	game = new TimePilot();
	sound = [
		new AY_3_8910({clock: 14318181 / 8, gain: 0.2}),
		new AY_3_8910({clock: 14318181 / 8, gain: 0.2}),
	];
	canvas.addEventListener('click', () => game.coin());
	init({game, sound});
});

