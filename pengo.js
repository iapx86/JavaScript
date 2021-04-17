/*
 *
 *	Pengo
 *
 */

import PacManSound from './pac-man_sound.js';
import {seq, rseq, convertGFX, Timer} from './utils.js';
import {init, read} from './main.js';
import SegaZ80 from './sega_z80.js';
let game, sound;

class Pengo {
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
	nBonus = 30000;
	nRank = 'MEDIUM';

	fInterruptEnable = false;
	ram = new Uint8Array(0x1100).addBase();
	in = Uint8Array.of(0xcc, 0xb0, 0xff, 0xff);

	bg = new Uint8Array(0x8000).fill(3);
	obj = new Uint8Array(0x8000).fill(3);
	rgb = Int32Array.from(RGB, e => 0xff000000 | (e >> 6) * 255 / 3 << 16 | (e >> 3 & 7) * 255 / 7 << 8 | (e & 7) * 255 / 7);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;

	cpu = new SegaZ80([ // 315-5010
		[0xa0, 0x80, 0xa8, 0x88], [0x28, 0xa8, 0x08, 0x88], [0x28, 0xa8, 0x08, 0x88], [0xa0, 0x80, 0xa8, 0x88],
		[0xa0, 0x80, 0x20, 0x00], [0xa0, 0x80, 0x20, 0x00], [0x08, 0x28, 0x88, 0xa8], [0xa0, 0x80, 0xa8, 0x88],
		[0x08, 0x00, 0x88, 0x80], [0x28, 0xa8, 0x08, 0x88], [0xa0, 0x80, 0x20, 0x00], [0x08, 0x00, 0x88, 0x80],
		[0xa0, 0x80, 0x20, 0x00], [0xa0, 0x80, 0x20, 0x00], [0xa0, 0x80, 0x20, 0x00], [0x00, 0x08, 0x20, 0x28],
		[0x88, 0x80, 0x08, 0x00], [0xa0, 0x80, 0x20, 0x00], [0x88, 0x80, 0x08, 0x00], [0x00, 0x08, 0x20, 0x28],
		[0x08, 0x28, 0x88, 0xa8], [0x08, 0x28, 0x88, 0xa8], [0xa0, 0x80, 0xa8, 0x88], [0xa0, 0x80, 0x20, 0x00],
		[0x08, 0x00, 0x88, 0x80], [0x88, 0x80, 0x08, 0x00], [0x00, 0x08, 0x20, 0x28], [0x88, 0x80, 0x08, 0x00],
		[0x08, 0x28, 0x88, 0xa8], [0x08, 0x28, 0x88, 0xa8], [0x08, 0x00, 0x88, 0x80], [0xa0, 0x80, 0x20, 0x00],
	], Math.floor(18432000 / 6));
	timer = new Timer(60);

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x80; i++)
			this.cpu.memorymap[i].base = PRG.base[i];
		for (let i = 0; i < 0x10; i++) {
			this.cpu.memorymap[0x80 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x80 + i].write = null;
		}
		this.cpu.memorymap[0x90].read = (addr) => { return this.in[addr >> 6 & 3]; };
		this.cpu.memorymap[0x90].write = (addr, data) => {
			switch (addr >> 4 & 0xf) {
			case 0:
			case 1:
				return sound.write(addr, data);
			case 2:
				return void(this.ram[0x1020 | addr & 0xf] = data);
			case 4:
				switch (addr & 7) {
				case 0:
					return void(this.fInterruptEnable = (data & 1) !== 0);
				case 1:
					return sound.control(data & 1);
				default:
					return void(this.ram[0x1040 | addr & 7] = data & 1);
				}
			}
		};

		// Videoの初期化
		convertGFX(this.bg, BG, 512, rseq(8, 0, 8), seq(4, 64).concat(seq(4)), [0, 4], 16);
		convertGFX(this.obj, OBJ, 128, rseq(8, 256, 8).concat(rseq(8, 0, 8)), seq(4, 64).concat(seq(4, 128), seq(4, 192), seq(4)), [0, 4], 64);
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.timer.execute(tick_rate, () => { update(), this.fInterruptEnable && this.cpu.interrupt(); });
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
			case 2:
				this.in[1] |= 0x18;
				break;
			case 3:
				this.in[1] = this.in[1] & ~0x18 | 0x10;
				break;
			case 4:
				this.in[1] = this.in[1] & ~0x18 | 8;
				break;
			case 5:
				this.in[1] &= ~0x18;
				break;
			}
			switch (this.nBonus) {
			case 30000:
				this.in[1] &= ~1;
				break;
			case 50000:
				this.in[1] |= 1;
				break;
			}
			switch (this.nRank) {
			case 'EASY':
				this.in[1] |= 0xc0;
				break;
			case 'MEDIUM':
				this.in[1] = this.in[1] & ~0xc0 | 0x80;
				break;
			case 'HARD':
				this.in[1] = this.in[1] & ~0xc0 | 0x40;
				break;
			case 'HARDEST':
				this.in[1] &= ~0xc0;
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
		this.in[3] = this.in[3] & ~(1 << 4) | !this.fCoin << 4;
		this.in[2] = this.in[2] & ~0x60 | !this.fStart1P << 5 | !this.fStart2P << 6;
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
		this.in[3] = this.in[3] & ~(1 << 0) | fDown << 1 | !fDown << 0;
		this.in[2] = this.in[2] & ~(1 << 0) | fDown << 1 | !fDown << 0;
	}

	right(fDown) {
		this.in[3] = this.in[3] & ~(1 << 3) | fDown << 2 | !fDown << 3;
		this.in[2] = this.in[2] & ~(1 << 3) | fDown << 2 | !fDown << 3;
	}

	down(fDown) {
		this.in[3] = this.in[3] & ~(1 << 1) | fDown << 0 | !fDown << 1;
		this.in[2] = this.in[2] & ~(1 << 1) | fDown << 0 | !fDown << 1;
	}

	left(fDown) {
		this.in[3] = this.in[3] & ~(1 << 2) | fDown << 3 | !fDown << 2;
		this.in[2] = this.in[2] & ~(1 << 2) | fDown << 3 | !fDown << 2;
	}

	triggerA(fDown) {
		this.in[3] = this.in[3] & ~(1 << 7) | !fDown << 7;
		this.in[2] = this.in[2] & ~(1 << 7) | !fDown << 7;
	}

	makeBitmap(flag) {
		if (!(this.updated = flag))
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
		for (let k = 0x0ffe, i = 7; i !== 0; k -= 2, --i) {
			const x = (~this.ram[k + 0x30] - (i < 3)) & 0xff;
			const y = (-this.ram[k + 0x31] & 0xff) + 32;
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
				this.bitmap[p] = this.rgb[this.bitmap[p] | this.ram[0x1042] << 4];

		return this.bitmap;
	}

	xfer8x8(data, p, k) {
		const q = this.ram[k] << 6 | this.ram[0x1047] << 14, idx = this.ram[k + 0x400] << 2 & 0x7c | this.ram[0x1046] << 7;

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
		const idx = src >> 6 & 0x7c | this.ram[0x1046] << 7, h = 288 - (dst >> 8);
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (h >= 16) {
			src = src << 6 & 0x3f00 | this.ram[0x1047] << 14;
			for (let i = 16; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[src++]]))
						data[dst] = px;
		} else {
			src = src << 6 & 0x3f00 | this.ram[0x1047] << 14;
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
		const idx = src >> 6 & 0x7c | this.ram[0x1046] << 7, h = 288 - (dst >> 8);
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (h >= 16) {
			src = (src << 6 & 0x3f00 | this.ram[0x1047] << 14) + 256 - 16;
			for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[src++]]))
						data[dst] = px;
		} else {
			src = (src << 6 & 0x3f00 | this.ram[0x1047] << 14) + 256 - 16;
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
		const idx = src >> 6 & 0x7c | this.ram[0x1046] << 7, h = 288 - (dst >> 8);
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (h >= 16) {
			src = (src << 6 & 0x3f00 | this.ram[0x1047] << 14) + 16;
			for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[--src]]))
						data[dst] = px;
		} else {
			src = (src << 6 & 0x3f00 | this.ram[0x1047] << 14) + 16;
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
		const idx = src >> 6 & 0x7c | this.ram[0x1046] << 7, h = 288 - (dst >> 8);
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return;
		if (h >= 16) {
			src = (src << 6 & 0x3f00 | this.ram[0x1047] << 14) + 256;
			for (let i = 16; i !== 0; dst += 256 - 16, --i)
				for (let j = 16; j !== 0; dst++, --j)
					if ((px = COLOR[idx | this.obj[--src]]))
						data[dst] = px;
		} else {
			src = (src << 6 & 0x3f00 | this.ram[0x1047] << 14) + 256;
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
 *	Pengo
 *
 */

let PRG, BG, OBJ, RGB, COLOR, SND;

read('pengo.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG = Uint8Array.concat(...['ep1689c.8', 'ep1690b.7', 'ep1691b.15', 'ep1692b.14'].map(e => zip.decompress(e)));
	PRG = Uint8Array.concat(PRG, ...['ep1693b.21', 'ep1694b.20', 'ep5118b.32', 'ep5119c.31'].map(e => zip.decompress(e))).addBase();
	BG = Uint8Array.concat(...['ep1640.92', 'ep1695.105'].map(e => zip.decompress(e).subarray(0, 0x1000)));
	OBJ = Uint8Array.concat(...['ep1640.92', 'ep1695.105'].map(e => zip.decompress(e).subarray(0x1000)));
	RGB = zip.decompress('pr1633.78');
	COLOR = zip.decompress('pr1634.88');
	SND = zip.decompress('pr1635.51');
	game = new Pengo();
	sound = new PacManSound({SND});
	canvas.addEventListener('click', () => game.coin(true));
	init({game, sound});
});

