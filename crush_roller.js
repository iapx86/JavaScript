/*
 *
 *	Crush Roller
 *
 */

import PacManSound from './pac-man_sound.js';
import {seq, rseq, convertGFX} from './utils.js';
import {init, read} from './main.js';
import Z80 from './z80.js';
let game, sound;

class CrushRoller {
	cxScreen = 224;
	cyScreen = 288;
	width = 256;
	height = 512;
	xOffset = 16;
	yOffset = 16;
	rotate = false;

	fReset = false;
	fDIPSwitchChanged = true;
	fCoin = 0;
	fStart1P = 0;
	fStart2P = 0;
	nLife = 3;

	fInterruptEnable = false;
	ram = new Uint8Array(0xd00).addBase();
	in = Uint8Array.of(0xef, 0x6f, 0x31);
	intvec = 0;
	fProtectEnable = false;
	protect_count = 0;
	protect_index = 0;

	bg = new Uint8Array(0x4000).fill(3);
	obj = new Uint8Array(0x4000).fill(3);
	rgb = Int32Array.from(RGB, e => 0xff000000 | (e >> 6) * 255 / 3 << 16 | (e >> 3 & 7) * 255 / 7 << 8 | (e & 7) * 255 / 7);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);

	cpu = new Z80(Math.floor(18432000 / 6));
	scanline = {rate: 256 * 60, frac: 0, count: 0, execute(rate, fn) {
		for (this.frac += this.rate; this.frac >= rate; this.frac -= rate)
			fn(this.count = this.count + 1 & 255);
	}};

	constructor() {
		// CPU周りの初期化
		const range = (page, start, end, mirror = 0) => (page & ~mirror) >= start && (page & ~mirror) <= end;

		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0x3f, 0x80))
				this.cpu.memorymap[page].base = PRG.base[page & 0x3f];
			else if (range(page, 0x40, 0x47, 0xa0)) {
				this.cpu.memorymap[page].base = this.ram.base[page & 7];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0x48, 0x48, 0xa3))
				this.cpu.memorymap[page].read = () => { return 0xbf; };
			else if (range(page, 0x4c, 0x4f, 0xa0)) {
				this.cpu.memorymap[page].base = this.ram.base[8 | page & 3];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0x50, 0x50, 0xaf)) {
				this.cpu.memorymap[page].read = (addr) => {
					switch (addr >> 6 & 3) {
					case 0:
						return this.in[0];
					case 1:
						return this.in[1];
					case 2:
						if (this.fProtectEnable)
							return this.in[2] & ~0xc0 | [0x00, 0xc0, 0x00, 0x40, 0xc0, 0x40, 0x00, 0xc0, 0x00, 0x40, 0x00, 0xc0, 0x00, 0x40, 0xc0,
								0x40, 0x00, 0xc0, 0x00, 0x40, 0x00, 0xc0, 0x00, 0x40, 0xc0, 0x40, 0x00, 0xc0, 0x00, 0x40][this.protect_index];
						switch (addr & 0x3f) {
						case 0x01:
						case 0x04:
							return this.in[2] & ~0xc0 | 0x40;
						case 0x05:
						case 0x0e:
						case 0x10:
							return this.in[2] & ~0xc0 | 0xc0;
						default:
							return this.in[2] & ~0xc0;
						}
					case 3:
						if (this.fProtectEnable)
							return [0x1f, 0x3f, 0x2f, 0x2f, 0x0f, 0x0f, 0x0f, 0x3f, 0x0f, 0x0f, 0x1c, 0x3c, 0x2c, 0x2c, 0x0c,
								0x0c, 0x0c, 0x3c, 0x0c, 0x0c, 0x11, 0x31, 0x21, 0x21, 0x01, 0x01, 0x01, 0x31, 0x01, 0x01][this.protect_index];
						switch (addr & 0x3f) {
						case 0x00:
							return 0x1f;
						case 0x09:
							return 0x30;
						case 0x0c:
							return 0x00;
						default:
							return 0x20;
						}
					}
				};
				this.cpu.memorymap[page].write = (addr, data) => {
					switch (addr >> 4 & 0xf) {
					case 0:
						switch (addr & 7) {
						case 0:
							return void(this.fInterruptEnable = (data & 1) !== 0);
						case 1:
							return sound.control(data & 1);
						case 4:
							if (!(this.fProtectEnable = (data & 1) !== 0))
								this.protect_count = this.protect_index = 0;
							else if (++this.protect_count === 0x3c) {
								this.protect_count = 0;
								if (++this.protect_index === 0x1e)
									this.protect_index = 0;
							}
							return;
						}
						return;
					case 4:
					case 5:
						return sound.write(addr, data);
					case 6:
						return void(this.ram[0xc60 | addr & 0xf] = data);
					}
				};
			}
		for (let page = 0; page < 0x100; page++)
			this.cpu.iomap[page].write = (addr, data) => { !(addr & 0xff) && (this.intvec = data); };

		// Videoの初期化
		convertGFX(this.bg, BG, 256, rseq(8, 0, 8), seq(4, 64).concat(seq(4)), [0, 4], 16);
		convertGFX(this.obj, OBJ, 64, rseq(8, 256, 8).concat(rseq(8, 0, 8)), seq(4, 64).concat(seq(4, 128), seq(4, 192), seq(4)), [0, 4], 64);
	}

	execute(audio, length, fn) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { fn(this.makeBitmap(true)), this.updateStatus(), this.updateInput(); };
		for (let i = 0; i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.scanline.execute(tick_rate, (vpos) => !vpos && (update(), this.fInterruptEnable && this.cpu.interrupt(this.intvec)));
			sound.execute(tick_rate);
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
				this.in[2] &= ~0xc;
				break;
			case 4:
				this.in[2] = this.in[2] & ~0xc | 4;
				break;
			case 5:
				this.in[2] = this.in[2] & ~0xc | 8;
				break;
			case 6:
				this.in[2] |= 0xc;
				break;
			}
			this.fReset = true;
		}

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu.reset();
		}
		return this;
	}

	updateInput() {
		this.in[0] = this.in[0] & ~(1 << 5) | !this.fCoin << 5;
		this.in[1] = this.in[1] & ~0x60 | !this.fStart1P << 5 | !this.fStart2P << 6;
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
		this.in[0] = this.in[0] & ~(1 << 0) | fDown << 3 | !fDown << 0;
		this.in[1] = this.in[1] & ~(1 << 0) | fDown << 3 | !fDown << 0;
	}

	right(fDown) {
		this.in[0] = this.in[0] & ~(1 << 2) | fDown << 1 | !fDown << 2;
		this.in[1] = this.in[1] & ~(1 << 2) | fDown << 1 | !fDown << 2;
	}

	down(fDown) {
		this.in[0] = this.in[0] & ~(1 << 3) | fDown << 0 | !fDown << 3;
		this.in[1] = this.in[1] & ~(1 << 3) | fDown << 0 | !fDown << 3;
	}

	left(fDown) {
		this.in[0] = this.in[0] & ~(1 << 1) | fDown << 2 | !fDown << 1;
		this.in[1] = this.in[1] & ~(1 << 1) | fDown << 2 | !fDown << 1;
	}

	makeBitmap(flag) {
		if (!flag)
			return this.bitmap;

		// bg描画
		let p = 256 * 8 * 4 + 232;
		for (let k = 0x40, i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				this.xfer8x8(this.bitmap, p, k);
		p = 256 * 8 * 36 + 232;
		for (let k = 2, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(this.bitmap, p, k);
		p = 256 * 8 * 37 + 232;
		for (let k = 0x22, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(this.bitmap, p, k);
		p = 256 * 8 * 2 + 232;
		for (let k = 0x3c2, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(this.bitmap, p, k);
		p = 256 * 8 * 3 + 232;
		for (let k = 0x3e2, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(this.bitmap, p, k);

		// obj描画
		for (let k = 0x0bfe, i = 7; i !== 0; k -= 2, --i) {
			const x = (~this.ram[k + 0x70] - (i < 3)) & 0xff;
			const y = (-this.ram[k + 0x71] & 0xff) + 32;
			const src = this.ram[k] | this.ram[k + 1] << 8;
			switch (this.ram[k] & 3) {
			case 0: // ノーマル
				this.xfer16x16(this.bitmap, x | y << 8, src);
				break;
			case 1: // V反転
				this.xfer16x16V(this.bitmap, x | y << 8, src);
				break;
			case 2: // H反転
				this.xfer16x16H(this.bitmap, x | y << 8, src);
				break;
			case 3: // HV反転
				this.xfer16x16HV(this.bitmap, x | y << 8, src);
				break;
			}
		}

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				this.bitmap[p] = this.rgb[this.bitmap[p]];

		return this.bitmap;
	}

	xfer8x8(data, p, k) {
		const q = this.ram[k] << 6, idx = this.ram[k + 0x400] << 2 & 0x7c;

		data[p + 0x000] = COLOR[idx | this.bg[q | 0x00]];
		data[p + 0x001] = COLOR[idx | this.bg[q | 0x01]];
		data[p + 0x002] = COLOR[idx | this.bg[q | 0x02]];
		data[p + 0x003] = COLOR[idx | this.bg[q | 0x03]];
		data[p + 0x004] = COLOR[idx | this.bg[q | 0x04]];
		data[p + 0x005] = COLOR[idx | this.bg[q | 0x05]];
		data[p + 0x006] = COLOR[idx | this.bg[q | 0x06]];
		data[p + 0x007] = COLOR[idx | this.bg[q | 0x07]];
		data[p + 0x100] = COLOR[idx | this.bg[q | 0x08]];
		data[p + 0x101] = COLOR[idx | this.bg[q | 0x09]];
		data[p + 0x102] = COLOR[idx | this.bg[q | 0x0a]];
		data[p + 0x103] = COLOR[idx | this.bg[q | 0x0b]];
		data[p + 0x104] = COLOR[idx | this.bg[q | 0x0c]];
		data[p + 0x105] = COLOR[idx | this.bg[q | 0x0d]];
		data[p + 0x106] = COLOR[idx | this.bg[q | 0x0e]];
		data[p + 0x107] = COLOR[idx | this.bg[q | 0x0f]];
		data[p + 0x200] = COLOR[idx | this.bg[q | 0x10]];
		data[p + 0x201] = COLOR[idx | this.bg[q | 0x11]];
		data[p + 0x202] = COLOR[idx | this.bg[q | 0x12]];
		data[p + 0x203] = COLOR[idx | this.bg[q | 0x13]];
		data[p + 0x204] = COLOR[idx | this.bg[q | 0x14]];
		data[p + 0x205] = COLOR[idx | this.bg[q | 0x15]];
		data[p + 0x206] = COLOR[idx | this.bg[q | 0x16]];
		data[p + 0x207] = COLOR[idx | this.bg[q | 0x17]];
		data[p + 0x300] = COLOR[idx | this.bg[q | 0x18]];
		data[p + 0x301] = COLOR[idx | this.bg[q | 0x19]];
		data[p + 0x302] = COLOR[idx | this.bg[q | 0x1a]];
		data[p + 0x303] = COLOR[idx | this.bg[q | 0x1b]];
		data[p + 0x304] = COLOR[idx | this.bg[q | 0x1c]];
		data[p + 0x305] = COLOR[idx | this.bg[q | 0x1d]];
		data[p + 0x306] = COLOR[idx | this.bg[q | 0x1e]];
		data[p + 0x307] = COLOR[idx | this.bg[q | 0x1f]];
		data[p + 0x400] = COLOR[idx | this.bg[q | 0x20]];
		data[p + 0x401] = COLOR[idx | this.bg[q | 0x21]];
		data[p + 0x402] = COLOR[idx | this.bg[q | 0x22]];
		data[p + 0x403] = COLOR[idx | this.bg[q | 0x23]];
		data[p + 0x404] = COLOR[idx | this.bg[q | 0x24]];
		data[p + 0x405] = COLOR[idx | this.bg[q | 0x25]];
		data[p + 0x406] = COLOR[idx | this.bg[q | 0x26]];
		data[p + 0x407] = COLOR[idx | this.bg[q | 0x27]];
		data[p + 0x500] = COLOR[idx | this.bg[q | 0x28]];
		data[p + 0x501] = COLOR[idx | this.bg[q | 0x29]];
		data[p + 0x502] = COLOR[idx | this.bg[q | 0x2a]];
		data[p + 0x503] = COLOR[idx | this.bg[q | 0x2b]];
		data[p + 0x504] = COLOR[idx | this.bg[q | 0x2c]];
		data[p + 0x505] = COLOR[idx | this.bg[q | 0x2d]];
		data[p + 0x506] = COLOR[idx | this.bg[q | 0x2e]];
		data[p + 0x507] = COLOR[idx | this.bg[q | 0x2f]];
		data[p + 0x600] = COLOR[idx | this.bg[q | 0x30]];
		data[p + 0x601] = COLOR[idx | this.bg[q | 0x31]];
		data[p + 0x602] = COLOR[idx | this.bg[q | 0x32]];
		data[p + 0x603] = COLOR[idx | this.bg[q | 0x33]];
		data[p + 0x604] = COLOR[idx | this.bg[q | 0x34]];
		data[p + 0x605] = COLOR[idx | this.bg[q | 0x35]];
		data[p + 0x606] = COLOR[idx | this.bg[q | 0x36]];
		data[p + 0x607] = COLOR[idx | this.bg[q | 0x37]];
		data[p + 0x700] = COLOR[idx | this.bg[q | 0x38]];
		data[p + 0x701] = COLOR[idx | this.bg[q | 0x39]];
		data[p + 0x702] = COLOR[idx | this.bg[q | 0x3a]];
		data[p + 0x703] = COLOR[idx | this.bg[q | 0x3b]];
		data[p + 0x704] = COLOR[idx | this.bg[q | 0x3c]];
		data[p + 0x705] = COLOR[idx | this.bg[q | 0x3d]];
		data[p + 0x706] = COLOR[idx | this.bg[q | 0x3e]];
		data[p + 0x707] = COLOR[idx | this.bg[q | 0x3f]];
	}

	xfer16x16(data, dst, src) {
		const idx = src >> 6 & 0x7c, h = 288 - (dst >> 8);
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (h >= 16) {
			src = src << 6 & 0x3f00;
			for (let i = 16; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[src++]]))
						data[dst] = px;
		} else {
			src = src << 6 & 0x3f00;
			for (let i = h; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[src++]]))
						data[dst] = px;
			dst -= 0x10000;
			for (let i = 16 - h; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[src++]]))
						data[dst] = px;
		}
	}

	xfer16x16V(data, dst, src) {
		const idx = src >> 6 & 0x7c, h = 288 - (dst >> 8);
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (h >= 16) {
			src = (src << 6 & 0x3f00) + 256 - 16;
			for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[src++]]))
						data[dst] = px;
		} else {
			src = (src << 6 & 0x3f00) + 256 - 16;
			for (let i = h; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[src++]]))
						data[dst] = px;
			dst -= 0x10000;
			for (let i = 16 - h; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[src++]]))
						data[dst] = px;
		}
	}

	xfer16x16H(data, dst, src) {
		const idx = src >> 6 & 0x7c, h = 288 - (dst >> 8);
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (h >= 16) {
			src = (src << 6 & 0x3f00) + 16;
			for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[--src]]))
						data[dst] = px;
		} else {
			src = (src << 6 & 0x3f00) + 16;
			for (let i = h; i !== 0; dst += 256 - 16, src += 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[--src]]))
						data[dst] = px;
			dst -= 0x10000;
			for (let i = 16 - h; i !== 0; dst += 256 - 16, src += 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[--src]]))
						data[dst] = px;
		}
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >> 6 & 0x7c, h = 288 - (dst >> 8);
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (h >= 16) {
			src = (src << 6 & 0x3f00) + 256;
			for (let i = 16; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[--src]]))
						data[dst] = px;
		} else {
			src = (src << 6 & 0x3f00) + 256;
			for (let i = h; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[--src]]))
						data[dst] = px;
			dst -= 0x10000;
			for (let i = 16 - h; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[--src]]))
						data[dst] = px;
		}
	}
}

/*
 *
 *	Crush Roller
 *
 */

let PRG, BG, OBJ, RGB, COLOR, SND;

read('crush.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG = Uint8Array.concat(...['crushkrl.6e', 'crushkrl.6f', 'crushkrl.6h', 'crushkrl.6j'].map(e => zip.decompress(e))).addBase();
	BG = zip.decompress('maketrax.5e');
	OBJ = zip.decompress('maketrax.5f');
	RGB = zip.decompress('82s123.7f');
	COLOR = zip.decompress('2s140.4a');
	SND = zip.decompress('82s126.1m');
	game = new CrushRoller();
	sound = new PacManSound({SND});
	canvas.addEventListener('click', () => game.coin());
	init({game, sound});
});

