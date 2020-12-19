/*
 *
 *	Strategy X
 *
 */

import AY_3_8910 from './ay-3-8910.js';
import {init, read} from './main.js';
import Z80 from './z80.js';
let game, sound;

class StrategyX {
	cxScreen = 224;
	cyScreen = 256;
	width = 256;
	height = 512;
	xOffset = 16;
	yOffset = 16;
	rotate = true;

	fReset = false;
	fTest = false;
	fDIPSwitchChanged = true;
	fCoin = 0;
	fStart1P = 0;
	fStart2P = 0;
	nLife = 3;

	fInterruptEnable = false;
//	fSoundEnable = false;

	ram = new Uint8Array(0xd00).addBase();
	ppi0 = Uint8Array.of(0xff, 0xfc, 0xf1, 0);
	ppi1 = Uint8Array.of(0, 0, 0xfc, 0);
	ram2 = new Uint8Array(0x400).addBase();
	psg = [{addr: 0}, {addr: 0}];
	count = 0;
	timer = 0;
	command = [];

	fBackgroundGreen = false;
	fBackgroundBlue = false;
	fBackgroundRed = false;
	bg = new Uint8Array(0x4000);
	obj = new Uint8Array(0x4000);
	rgb;

	cpu = new Z80();
	cpu2 = new Z80();

	constructor() {
		// CPU周りの初期化
		const range = (page, start, end, mirror = 0) => (page & ~mirror) >= start && (page & ~mirror) <= end;

		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0x5f))
				this.cpu.memorymap[page].base = PRG1.base[page & 0x7f];
			else if (range(page, 0x80, 0x87)) {
				this.cpu.memorymap[page].base = this.ram.base[page & 7];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0x88, 0x88)) {
				this.cpu.memorymap[page].base = this.ram.base[0xc];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0x90, 0x93, 0x04)) {
				this.cpu.memorymap[page].base = this.ram.base[8 | page & 3];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0xa0, 0xa0))
				this.cpu.memorymap[page].read = (addr) => { return this.ppi0[addr >> 2 & 3]; };
			else if (range(page, 0xa8, 0xa8)) {
				this.cpu.memorymap[page].read = (addr) => { return this.ppi1[addr >> 2 & 3]; };
				this.cpu.memorymap[page].write = (addr, data) => {
					switch (addr >> 2 & 3) {
					case 0:
						return this.command.push(data);
//					case 1:
//						return void(this.fSoundEnable = (data & 0x10) === 0);
					}
				};
			} else if (range(page, 0xb0, 0xb0))
				this.cpu.memorymap[page].write = (addr, data) => {
					switch (addr & 0xff) {
					case 0:
						return void(this.fBackgroundGreen = (data & 1) !== 0);
					case 2:
						return void(this.fBackgroundBlue = (data & 1) !== 0);
					case 4:
						return void(this.fInterruptEnable = (data & 1) !== 0);
					case 0xa:
						return void(this.fBackgroundRed = (data & 1) !== 0);
					}
				};

		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0x1f))
				this.cpu2.memorymap[page].base = PRG2.base[page & 0x1f];
			else if (range(page, 0x80, 0x83, 0x0c)) {
				this.cpu2.memorymap[page].base = this.ram2.base[page & 3];
				this.cpu2.memorymap[page].write = null;
			}
		for (let page = 0; page < 0x100; page++) {
			this.cpu2.iomap[page].read = (addr) => {
				let data = 0xff;
				if (addr & 0x20)
					data &= sound[1].read(this.psg[1].addr);
				if (addr & 0x80)
					data &= sound[0].read(this.psg[0].addr);
				return data;
			};
			this.cpu2.iomap[page].write = (addr, data) => {
				if (addr & 0x10)
					this.psg[1].addr = data;
				else if (addr & 0x20)
					sound[1].write(this.psg[1].addr, data, this.count);
				if (addr & 0x40)
					this.psg[0].addr = data;
				else if (addr & 0x80)
					sound[0].write(this.psg[0].addr, data, this.count);
			};
		}

		// Videoの初期化
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();
	}

	execute() {
//		sound[0].mute(!this.fSoundEnable);
//		sound[1].mute(!this.fSoundEnable);
		this.fInterruptEnable && this.cpu.non_maskable_interrupt(), this.cpu.execute(0x2000);
		for (this.count = 0; this.count < 116; this.count++) { // 14318181 / 60 / 2048
			if (this.command.length && this.cpu2.interrupt())
				sound[0].write(0x0e, this.command.shift());
			sound[0].write(0x0f, [0x0e, 0x1e, 0x0e, 0x1e, 0x2e, 0x3e, 0x2e, 0x3e, 0x4e, 0x5e, 0x8e, 0x9e, 0x8e, 0x9e, 0xae, 0xbe, 0xae, 0xbe, 0xce, 0xde][this.timer]);
			this.cpu2.execute(36);
			++this.timer >= 20 && (this.timer = 0);
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
			case 4:
				this.ppi0[1] = this.ppi0[1] & ~3 | 1;
				break;
			case 5:
				this.ppi0[1] = this.ppi0[1] & ~3 | 2;
				break;
			case 255:
				this.ppi0[1] |= 3;
				break;
			}
			if (!this.fTest)
				this.fReset = true;
		}

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu.reset();
			this.fInterruptEnable = false;
//			this.fSoundEnable = false;
			this.command.splice(0);
			this.cpu2.reset();
			this.timer = 0;
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
		this.ppi0[2] = this.ppi0[2] & ~(1 << 5) | !fDown << 5;
	}

	triggerX(fDown) {
		this.ppi0[0] = this.ppi0[0] & ~(1 << 1) | !fDown << 1;
	}

	convertRGB() {
		this.rgb = Uint32Array.from(RGB, e => 0xff000000 | (e >> 6) * 255 / 3 << 16 | (e >> 3 & 7) * 255 / 7 << 8 | (e & 7) * 255 / 7);
	}

	convertBG() {
		for (let p = 0, q = 0, i = 256; i !== 0; q += 8, --i)
			for (let j = 7; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k + 0x800] >> j & 1 | BG[q + k] >> j << 1 & 2;
	}

	convertOBJ() {
		for (let p = 0, q = 0, i = 64; i !== 0; q += 32, --i) {
			for (let j = 7; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = BG[q + k + 0x800 + 16] >> j & 1 | BG[q + k + 16] >> j << 1 & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = BG[q + k + 0x800] >> j & 1 | BG[q + k] >> j << 1 & 2;
			}
			for (let j = 7; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = BG[q + k + 0x800 + 24] >> j & 1 | BG[q + k + 24] >> j << 1 & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = BG[q + k + 0x800 + 8] >> j & 1 | BG[q + k + 8] >> j << 1 & 2;
			}
		}
	}

	makeBitmap(data) {
		// bg描画
		let p = 256 * 32;
		for (let k = 0xbe2, i = 2; i < 32; p += 256 * 8, k += 0x401, i++) {
			let dwScroll = this.ram[0xc00 + i * 2];
			for (let j = 0; j < 32; k -= 0x20, j++) {
				this.xfer8x8(data, p + dwScroll, k, i);
				dwScroll = dwScroll + 8 & 0xff;
			}
		}

		// obj描画
		for (let k = 0xc5c, i = 7; i >= 0; k -= 4, --i) {
			const x = this.ram[k], y = this.ram[k + 3] + 16;
			const src = this.ram[k + 1] & 0x3f | this.ram[k + 2] << 6;
			switch (this.ram[k + 1] & 0xc0) {
			case 0x00: // ノーマル
				this.xfer16x16(data, x | y << 8, src);
				break;
			case 0x40: // V反転
				this.xfer16x16V(data, x | y << 8, src);
				break;
			case 0x80: // H反転
				this.xfer16x16H(data, x | y << 8, src);
				break;
			case 0xc0: // HV反転
				this.xfer16x16HV(data, x | y << 8, src);
				break;
			}
		}

		// bullets描画
		for (let k = 0xc60, i = 0; i < 8; k += 4, i++) {
			p = this.ram[k + 1] | 264 - this.ram[k + 3] << 8;
			data[p] = 7;
		}

		// bg描画
		p = 256 * 16;
		for (let k = 0xbe0, i = 0; i < 2; p += 256 * 8, k += 0x401, i++) {
			let dwScroll = this.ram[0xc00 + i * 2];
			for (let j = 0; j < 32; k -= 0x20, j++) {
				this.xfer8x8(data, p + dwScroll, k, i);
				dwScroll = dwScroll + 8 & 0xff;
			}
		}

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256 - 224, i++) {
			const color = (this.fBackgroundBlue && ~MAP[i >> 3] & 1 ? 0x00470000 : 0)
						| (this.fBackgroundGreen && ~MAP[i >> 3] & 2 ? 0x00003c00 : 0)
						| (this.fBackgroundRed && ~MAP[i >> 3] & 2 ? 0x0000007c : 0)
						| 0xff000000;
			for (let j = 0; j < 224; p++, j++)
				data[p] = data[p] & 3 ? this.rgb[data[p]] : color;
		}
	}

	xfer8x8(data, p, k, i) {
		const q = this.ram[k] << 6, idx = this.ram[0xc01 + i * 2] << 2 & 0x1c;

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

const keydown = e => {
	if (e.repeat)
		return;
	switch (e.code) {
	case 'ArrowLeft':
		return void game.left(true);
	case 'ArrowUp':
		return void game.up(true);
	case 'ArrowRight':
		return void game.right(true);
	case 'ArrowDown':
		return void game.down(true);
	case 'Digit0':
		return void game.coin();
	case 'Digit1':
		return void game.start1P();
	case 'Digit2':
		return void game.start2P();
	case 'KeyM': // MUTE
		if (audioCtx.state === 'suspended')
			audioCtx.resume().catch();
		else if (audioCtx.state === 'running')
			audioCtx.suspend().catch();
		return;
	case 'KeyR':
		return void game.reset();
	case 'KeyT':
		if ((game.fTest = !game.fTest) === true)
			game.fReset = true;
		return;
	case 'KeyC':
		return void game.triggerB(true);
	case 'Space':
	case 'KeyX':
		return void game.triggerA(true);
	case 'KeyZ':
		return void game.triggerX(true);
	}
};

const keyup = e => {
	switch (e.code) {
	case 'ArrowLeft':
		return void game.left(false);
	case 'ArrowUp':
		return void game.up(false);
	case 'ArrowRight':
		return void game.right(false);
	case 'ArrowDown':
		return void game.down(false);
	case 'KeyC':
		return void game.triggerB(false);
	case 'Space':
	case 'KeyX':
		return void game.triggerA(false);
	case 'KeyZ':
		return void game.triggerX(false);
	}
};

/*
 *
 *	Strategy X
 *
 */

let BG, RGB, PRG1, PRG2, MAP;

read('stratgyx.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG1 = Uint8Array.concat(...['2c_1.bin', '2e_2.bin', '2f_3.bin', '2h_4.bin', '2j_5.bin', '2l_6.bin'].map(e => zip.decompress(e))).addBase();
	PRG2 = Uint8Array.concat(...['s1.bin', 's2.bin'].map(e => zip.decompress(e))).addBase();
	BG = Uint8Array.concat(...['5f_c2.bin', '5h_c1.bin'].map(e => zip.decompress(e)));
	RGB = zip.decompress('strategy.6e');
	MAP = zip.decompress('strategy.10k');
	game = new StrategyX();
	sound = [
		new AY_3_8910({clock: 14318181 / 8, resolution: 116, gain: 0.2}),
		new AY_3_8910({clock: 14318181 / 8, resolution: 116, gain: 0.2}),
	];
	canvas.addEventListener('click', () => game.coin());
	init({game, sound, keydown, keyup});
});

