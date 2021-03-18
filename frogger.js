/*
 *
 *	Frogger
 *
 */

import AY_3_8910 from './ay-3-8910.js';
import {init, seq, rseq, bitswap, convertGFX, read} from './main.js';
import Z80 from './z80.js';
let game, sound;

class Frogger {
	static decoded = false;

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

	fInterruptEnable = false;

	ram = new Uint8Array(0xd00).addBase();
	ppi0 = Uint8Array.of(0xff, 0xfc, 0xf1, 0);
	ppi1 = new Uint8Array(4);
	ram2 = new Uint8Array(0x400).addBase();
	psg = {addr: 0};
	cpu2_irq = false;

	bg = new Uint8Array(0x4000).fill(3);
	obj = new Uint8Array(0x4000).fill(3);
	rgb = Int32Array.from(RGB, e => 0xff000000 | (e >> 6) * 255 / 3 << 16 | (e >> 3 & 7) * 255 / 7 << 8 | (e & 7) * 255 / 7);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);

	cpu = new Z80(Math.floor(18432000 / 6));
	cpu2 = new Z80(Math.floor(14318181 / 8));
	timer = {rate: 14318181 / 2048, frac: 0, count: 0, execute(rate, rate_correction, fn) {
		for (this.frac += this.rate * rate_correction; this.frac >= rate; this.frac -= rate)
			fn(this.count = (this.count + 1) % 20);
	}};

	constructor() {
		// CPU周りの初期化
		const range = (page, start, end, mirror = 0) => (page & ~mirror) >= start && (page & ~mirror) <= end;

		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0x2f))
				this.cpu.memorymap[page].base = PRG1.base[page & 0x3f];
			else if (range(page, 0x80, 0x87)) {
				this.cpu.memorymap[page].base = this.ram.base[page & 7];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0xa8, 0xab, 0x04)) {
				this.cpu.memorymap[page].base = this.ram.base[8 | page & 3];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0xb0, 0xb0, 0x07)) {
				this.cpu.memorymap[page].base = this.ram.base[0x0c];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0xb8, 0xb8, 0x07))
				this.cpu.memorymap[page].write = (addr, data) => {
					if ((addr & 0x1c) === 8)
						this.fInterruptEnable = (data & 1) !== 0;
				};
			else if (range(page, 0xc0, 0xff)) {
				this.cpu.memorymap[page].read = (addr) => {
					let data = 0xff;
					if (addr & 0x1000)
						data &= this.ppi1[addr >> 1 & 3];
					if (addr & 0x2000)
						data &= this.ppi0[addr >> 1 & 3];
					return data;
				};
				this.cpu.memorymap[page].write = (addr, data) => {
					if (addr & 0x1000)
						switch (addr >> 1 & 3) {
						case 0:
							return this.ppi1[0] = data, sound.write(0xe, data);
						case 1:
							~data & this.ppi1[1] & 8 && (this.cpu2_irq = true), this.ppi1[1] = data;
							return sound.control(!(data & 0x10));
						}
				};
			}

		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0x1f))
				this.cpu2.memorymap[page].base = PRG2.base[page & 0x1f];
			else if (range(page, 0x40, 0x43, 0x1c)) {
				this.cpu2.memorymap[page].base = this.ram2.base[page & 3];
				this.cpu2.memorymap[page].write = null;
			}
		for (let page = 0; page < 0x100; page++) {
			this.cpu2.iomap[page].read = (addr) => { return addr & 0x40 ? sound.read(this.psg.addr) : 0xff; };
			this.cpu2.iomap[page].write = (addr, data) => {
				if (addr & 0x40)
					sound.write(this.psg.addr, data);
				else if (addr & 0x80)
					this.psg.addr = data;
			};
		}

		this.cpu2.check_interrupt = () => { return this.cpu2_irq && this.cpu2.interrupt() && (this.cpu2_irq = false, true); };

		Frogger.decodeROM();

		// Videoの初期化
		convertGFX(this.bg, BG, 256, rseq(8, 0, 8), seq(8), [0, -1], 8);
		convertGFX(this.bg, BG, 256, rseq(8, 0, 8), [0, 1, 2, 3, 4, 5, 7, 6], [BG.length * 4], 8);
		convertGFX(this.obj, BG, 64, rseq(8, 128, 8).concat(rseq(8, 0, 8)), seq(8).concat(seq(8, 64)), [0, BG.length * 4], 32);
	}

	execute(audio, rate_correction) {
		const tick_rate = 384000, tick_max = Math.floor(tick_rate / 60);
		this.fInterruptEnable && this.cpu.non_maskable_interrupt();
		for (let i = 0; i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.cpu2.execute(tick_rate);
			this.timer.execute(tick_rate, rate_correction, (cnt) => sound.write(0xf, (cnt >= 10) << 7 | [0x26, 0x36, 0x26, 0x36, 0x2e, 0x3e, 0x2e, 0x3e, 0x66, 0x76][cnt % 10]));
			sound.execute(tick_rate, rate_correction);
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
				this.ppi0[1] &= ~3;
				break;
			case 5:
				this.ppi0[1] = this.ppi0[1] & ~3 | 1;
				break;
			case 7:
				this.ppi0[1] = this.ppi0[1] & ~3 | 2;
				break;
			case 256:
				this.ppi0[1] |= 3;
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
		this.ppi0[0] = this.ppi0[0] & ~(1 << 7) | !this.fCoin << 7;
		this.ppi0[1] = this.ppi0[1] & ~0xc0 | !this.fStart1P << 7 | !this.fStart2P << 6;
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
		this.ppi0[2] = this.ppi0[2] & ~(1 << 4) | fDown << 6 | !fDown << 4;
	}

	right(fDown) {
		this.ppi0[0] = this.ppi0[0] & ~(1 << 4) | fDown << 5 | !fDown << 4;
	}

	down(fDown) {
		this.ppi0[2] = this.ppi0[2] & ~(1 << 6) | fDown << 4 | !fDown << 6;
	}

	left(fDown) {
		this.ppi0[0] = this.ppi0[0] & ~(1 << 5) | fDown << 4 | !fDown << 5;
	}

	triggerA(fDown) {
		this.ppi0[0] = this.ppi0[0] & ~(1 << 3) | !fDown << 3;
	}

	triggerB(fDown) {
		this.ppi0[0] = this.ppi0[0] & ~(1 << 1) | !fDown << 1;
	}

	static decodeROM() {
		if (Frogger.decoded)
			return;
		for (let i = 0; i < 0x800; i++)
			PRG2[i] = bitswap(PRG2[i], 7, 6, 5, 4, 3, 2, 0, 1);
		Frogger.decoded = true;
	}

	makeBitmap() {
		// bg描画
		let p = 256 * 32;
		for (let k = 0xbe2, i = 2; i < 32; p += 256 * 8, k += 0x401, i++) {
			let dwScroll = this.ram[0xc00 + i * 2] >> 4 | this.ram[0xc00 + i * 2] << 4 & 0xf0;
			for (let j = 0; j < 32; k -= 0x20, j++) {
				this.xfer8x8(this.bitmap, p + dwScroll, k, i);
				dwScroll = dwScroll + 8 & 0xff;
			}
		}

		// obj描画
		for (let k = 0xc5c, i = 7; i >= 0; k -= 4, --i) {
			const x = this.ram[k] >> 4 | this.ram[k] << 4 & 0xf0, y = this.ram[k + 3] + 16;
			const src = this.ram[k + 1] & 0x3f | this.ram[k + 2] << 5 & 0xc0 | this.ram[k + 2] << 8 & 0x100;
			switch (this.ram[k + 1] & 0xc0) {
			case 0x00: // ノーマル
				this.xfer16x16(this.bitmap, x | y << 8, src);
				break;
			case 0x40: // V反転
				this.xfer16x16V(this.bitmap, x | y << 8, src);
				break;
			case 0x80: // H反転
				this.xfer16x16H(this.bitmap, x | y << 8, src);
				break;
			case 0xc0: // HV反転
				this.xfer16x16HV(this.bitmap, x | y << 8, src);
				break;
			}
		}

		// bg描画
		p = 256 * 16;
		for (let k = 0xbe0, i = 0; i < 2; p += 256 * 8, k += 0x401, i++) {
			let dwScroll = this.ram[0xc00 + i * 2] >> 4 | this.ram[0xc00 + i * 2] << 4 & 0xf0;
			for (let j = 0; j < 32; k -= 0x20, j++) {
				this.xfer8x8(this.bitmap, p + dwScroll, k, i);
				dwScroll = dwScroll + 8 & 0xff;
			}
		}

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 128; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				this.bitmap[p] = this.bitmap[p] & 3 ? this.rgb[this.bitmap[p]] : this.rgb[2];
		for (let i = 0; i < 128; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				this.bitmap[p] = this.rgb[this.bitmap[p]];

		return this.bitmap;
	}

	xfer8x8(data, p, k, i) {
		const q = this.ram[k] << 6, idx = this.ram[0xc01 + i * 2] << 1 & 0xc | this.ram[0xc01 + i * 2] << 4 & 0x10;

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
	}

	xfer16x16(data, dst, src) {
		const idx = src >> 4 & 0x1c;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		src = src << 8 & 0x3f00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[src++]))
					data[dst] = idx | px;
	}

	xfer16x16V(data, dst, src) {
		const idx = src >> 4 & 0x1c;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		src = (src << 8 & 0x3f00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[src++]))
					data[dst] = idx | px;
	}

	xfer16x16H(data, dst, src) {
		const idx = src >> 4 & 0x1c;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		src = (src << 8 & 0x3f00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[--src]))
					data[dst] = idx | px;
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >> 4 & 0x1c;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		src = (src << 8 & 0x3f00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[--src]))
					data[dst] = idx | px;
	}
}

/*
 *
 *	Frogger
 *
 */

let BG, RGB, PRG1, PRG2;

read('frogger.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG1 = Uint8Array.concat(...['frogger.26', 'frogger.27', 'frsm3.7'].map(e => zip.decompress(e))).addBase();
	PRG2 = Uint8Array.concat(...['frogger.608', 'frogger.609', 'frogger.610'].map(e => zip.decompress(e))).addBase();
	BG = Uint8Array.concat(...['frogger.607', 'frogger.606'].map(e => zip.decompress(e)));
	RGB = zip.decompress('pr-91.6l');
	game = new Frogger();
	sound = new AY_3_8910({clock: 14318181 / 8, gain: 0.4});
	canvas.addEventListener('click', () => game.coin());
	init({game, sound});
});

