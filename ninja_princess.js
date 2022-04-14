/*
 *
 *	Ninja Princess
 *
 */

import SN76489 from './sn76489.js';
import {seq, rseq, convertGFX} from './utils.js';
import {init, expand} from './main.js';
import Z80 from './z80.js';
let game, sound;

class NinjaPrincess {
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
	fDemoSound = false;
	nLife = 3;
	nBonus = '20k 70k 120k 170k';
	fContinue = false;
	nDifficulty = 'Easy';

	ram = new Uint8Array(0x3000).addBase();
	ram2 = new Uint8Array(0x800).addBase();
	ppi = new Uint8Array(4);
	in = Uint8Array.of(0xff, 0xff, 0xff, 0xff, 0xfe);
	cpu2_nmi = false;
	cpu2_irq = false;

	bg = new Uint8Array(0x20000).fill(7);
	rgb = Int32Array.from(seq(0x100), i => 0xff000000 | (i >> 6) * 255 / 3 << 16 | (i >> 3 & 7) * 255 / 7 << 8 | (i & 7) * 255 / 7);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;
	layer = [];
	mode = 0;
	collision = new Uint8Array(0x442);

	cpu = new Z80(4000000);
	cpu2 = new Z80(Math.floor(8000000 / 2));
	scanline = {rate: 256 * 60, frac: 0, count: 0, execute(rate, fn) {
		for (this.frac += this.rate; this.frac >= rate; this.frac -= rate)
			fn(this.count = this.count + 1 & 255);
	}};

	constructor() {
		// CPU周りの初期化
		const range = (page, start, end, mirror = 0) => (page & ~mirror) >= start && (page & ~mirror) <= end;

		for (let i = 0; i < 0xc0; i++)
			this.cpu.memorymap[i].base = PRG1.base[i];
		for (let i = 0; i < 0x30; i++) {
			this.cpu.memorymap[0xc0 + i].base = this.ram.base[i];
			this.cpu.memorymap[0xc0 + i].write = null;
		}
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0xf0 + i].read = addr => { return this.collision[0x400 | addr & 0x3f] | 0x7e | this.collision[0x441] << 7; };
			this.cpu.memorymap[0xf0 + i].write = addr => { this.collision[0x400 | addr & 0x3f] = 0; };
		}
		for (let i = 0; i < 4; i++)
			this.cpu.memorymap[0xf4 + i].write = () => { this.collision[0x441] = 0; };
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0xf8 + i].read = addr => { return this.collision[addr & 0x3ff] | 0x7e | this.collision[0x440] << 7; };
			this.cpu.memorymap[0xf8 + i].write = addr => { this.collision[addr & 0x3ff] = 0; };
		}
		for (let i = 0; i < 4; i++)
			this.cpu.memorymap[0xfc + i].write = () => { this.collision[0x440] = 0; };
		for (let page = 0; page < 0x100; page++) {
			this.cpu.iomap[page].read = (addr) => {
				switch (addr >> 2 & 7) {
				case 0:
					return this.in[0];
				case 1:
					return this.in[1];
				case 2:
					return this.in[2];
				case 3:
					return addr & 1 ? this.in[4] | 0x80 : this.in[3];
				case 4:
					return this.in[4] & ~0x80;
				case 5:
					return this.ppi[addr & 3];
				}
				return 0xff;
			};
			this.cpu.iomap[page].write = (addr, data) => {
				switch (addr & 0x1f) {
				case 0x14:
					return this.cpu2_nmi = true, this.ppi[2] &= ~0x40, void(this.ppi[0] = data);
				case 0x15:
					return void(this.mode = this.ppi[1] = data);
				case 0x16:
					return sound[0].control(!(data & 1)), sound[1].control(!(data & 1)), void(this.ppi[2] = this.ppi[2] & 0x40 | data & ~0x40);
				}
			};
		}

		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0x1f))
				this.cpu2.memorymap[page].base = PRG2.base[page & 0x1f];
			else if (range(page, 0x80, 0x87, 0x18)) {
				this.cpu2.memorymap[page].base = this.ram2.base[page & 7];
				this.cpu2.memorymap[page].write = null;
			} else if (range(page, 0xa0, 0xa0, 0x1f))
				this.cpu2.memorymap[page].write = (addr, data) => { sound[0].write(data); };
			else if (range(page, 0xc0, 0xc0, 0x1f))
				this.cpu2.memorymap[page].write = (addr, data) => { sound[1].write(data); };
			else if (range(page, 0xe0, 0xe0, 0x1f))
				this.cpu2.memorymap[page].read = () => { return this.ppi[2] |= 0x40, this.ppi[0]; };

		this.cpu2.check_interrupt = () => {
			if (this.cpu2_nmi)
				return this.cpu2_nmi = false, this.cpu2.non_maskable_interrupt();
			return this.cpu2_irq && this.cpu2.interrupt() && (this.cpu2_irq = false, true);
		};

		// Videoの初期化
		convertGFX(this.bg, BG, 2048, rseq(8, 0, 8), seq(8), [0, Math.floor(BG.length / 3) * 8, Math.floor(BG.length / 3) * 16], 8);
		for (let i = 0; i < 3; i++)
			this.layer.push(new Int32Array(this.width * this.height));
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.cpu2.execute(tick_rate);
			this.scanline.execute(tick_rate, (vpos) => { !(vpos & 0x3f) && (this.cpu2_irq = true), !vpos && (update(), this.cpu.interrupt()); });
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
				this.in[4] &= ~2;
			else
				this.in[4] |= 2;
			switch (this.nLife) {
			case 2:
				this.in[4] = this.in[4] & ~0xc | 8;
				break;
			case 3:
				this.in[4] |= 0xc;
				break;
			case 4:
				this.in[4] = this.in[4] & ~0xc | 4;
				break;
			case 240:
				this.in[4] &= ~0xc;
				break;
			}
			switch (this.nBonus) {
			case '20k 70k 120k 170k':
				this.in[4] |= 0x10;
				break;
			case '50k 100k 150k 200k':
				this.in[4] &= ~0x10;
				break;
			}
			if (this.fContinue)
				this.in[4] &= ~0x20;
			else
				this.in[4] |= 0x20;
			switch (this.nDifficulty) {
			case 'Easy':
				this.in[4] |= 0x40;
				break;
			case 'Hard':
				this.in[4] &= ~0x40;
				break;
			}
			this.fReset = true;
		}

		if (this.fTest)
			this.in[2] &= ~4;
		else
			this.in[2] |= 4;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu.reset();
			this.cpu2_nmi = this.cpu2_irq = false;
			this.cpu2.reset();
		}
		return this;
	}

	updateInput() {
		this.in[2] = this.in[2] & ~0x38 | !this.fCoin << 3 | !this.fStart1P << 4 | !this.fStart2P << 5;
		this.fCoin -= !!this.fCoin, this.fStart1P -= !!this.fStart1P, this.fStart2P -= !!this.fStart2P;
		this.fTurbo && (this.in[0] ^= 1 << 2);
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
		this.in[0] = this.in[0] & ~(1 << 5) | fDown << 4 | !fDown << 5;
	}

	right(fDown) {
		this.in[0] = this.in[0] & ~(1 << 6) | fDown << 7 | !fDown << 6;
	}

	down(fDown) {
		this.in[0] = this.in[0] & ~(1 << 4) | fDown << 5 | !fDown << 4;
	}

	left(fDown) {
		this.in[0] = this.in[0] & ~(1 << 7) | fDown << 6 | !fDown << 7;
	}

	triggerA(fDown) {
		this.in[0] = this.in[0] & ~(1 << 2) | !fDown << 2;
	}

	triggerB(fDown) {
		this.in[0] = this.in[0] & ~(1 << 1) | !fDown << 1;
	}

	triggerX(fDown) {
		this.in[0] = this.in[0] & ~(1 << 0) | !fDown << 0;
	}

	triggerY(fDown) {
		!(this.fTurbo = fDown) && (this.in[0] |= 1 << 2);
	}

	makeBitmap(flag) {
		if (!(this.updated = flag))
			return this.bitmap;

		// 画面クリア
		if (this.mode & 0x10) {
			let p = 256 * 16 + 16;
			for (let i = 0; i < 256; p += 256, i++)
				this.bitmap.fill(0xff000000, p, p + 224);
			return this.bitmap;
		}

		// obj描画
		this.layer[0].fill(0), this.drawObj(this.layer[0]);

		// fg描画
		let p = 256 * 8 * 2 + 232;
		for (let k = 0x2800, i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k += 2, p += 256 * 8, j++)
				this.xfer8x8(this.layer[1], p, k);

		// bg描画
		const hScroll = this.ram[0x2fbd], vScroll = this.ram[0x2ffc] | this.ram[0x2ffd] << 8 & 0x100;
		for (let i = 0; i < 64; i++)
			for (let j = 0; j < 64; j++) {
				const x = 232 - i * 8 + hScroll & 0x1ff, y = 286 + j * 8 + (vScroll >> 1) & 0x1ff;
				if (x > 8 && x < 240 && y > 8 && y < 272)
					this.xfer8x8(this.layer[2], x | y << 8, 0x2000 | i << 6 & 0x7c0 | j << 1 & 0x3e);
			}

		// layer合成
		p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++) {
				const px0 = this.layer[0][p], px1 = this.layer[1][p], px2 = this.layer[2][p];
				const pri = PRI[px2 >> 4 & 0x60 | !(px2 & 7) << 4 | px1 >> 7 & 0xc | !(px1 & 7) << 1 | !(px0 & 0xf)];
				~pri & 4 && (this.collision[0x400 | pri << 2 & 0x20 | px0 >> 4] = this.collision[0x441] = 1);
				this.bitmap[p] = this.rgb[this.ram[(pri & 3) === 0 ? 0x1800 | px0 & 0x1ff : (pri & 3) === 1 ? 0x1a00 | px1 & 0x1ff : 0x1c00 | px2 & 0x1ff]];
			}

		return this.bitmap;
	}

	drawObj(data) {
		for (let k = 0x1000; k < 0x1200; k += 0x10) {
			const x0 = this.ram[k] ^ 0xff, x1 = this.ram[k + 1] ^ 0xff, y0 = (this.ram[k + 2] >> 1 | this.ram[k + 3] << 7) + 17 & 0x1ff;
			if (!x0)
				return;
			const pitch = this.ram[k + 4] | this.ram[k + 5] << 8, idx = k & 0x1f0;
			const obank = /* this.ram[k + 3] << 14 & 0x20000 | this.ram[k + 3] << 10 & 0x10000 | */ this.ram[k + 3] << 8 & 0x8000;
			for (let addr = this.ram[k + 6] | this.ram[k + 7] << 8, x = x0; x > x1; --x) {
				addr += pitch;
				if ((x - 17 & 0xff) < 16 || (x - 17 & 0xff) > 239)
					continue;
				if (addr & 0x8000)
					for (let a = addr & 0x7fff, y = y0; y < y0 + 512; a = a - 1 & 0x7fff, y += 2) {
						let px0 = OBJ[a | obank], px, dst;
						if ((px = px0 & 15) === 15)
							break;
						if (px && (y & 0x1ff) > 15 && (y & 0x1ff) < 272) {
							dst = x - 17 & 0xff | y << 8 & 0x1ff00;
							data[dst] && (this.collision[idx << 1 | data[dst] >> 4] = this.collision[0x440] = 1), data[dst] = idx | px;
						}
						if ((px = px0 >> 4) === 15)
							break;
						if (px && (y + 1 & 0x1ff) > 15 && (y + 1 & 0x1ff) < 272) {
							dst = x - 17 & 0xff | y + 1 << 8 & 0x1ff00;
							data[dst] && (this.collision[idx << 1 | data[dst] >> 4] = this.collision[0x440] = 1), data[dst] = idx | px;
						}
					}
				else
					for (let a = addr & 0x7fff, y = y0; y < y0 + 512; a = a + 1 & 0x7fff, y += 2) {
						let px0 = OBJ[a | obank], px, dst;
						if ((px = px0 >> 4) === 15)
							break;
						if (px && (y & 0x1ff) > 15 && (y & 0x1ff) < 272) {
							dst = x - 17 & 0xff | y << 8 & 0x1ff00;
							data[dst] && (this.collision[idx << 1 | data[dst] >> 4] = this.collision[0x440] = 1), data[dst] = idx | px;
						}
						if ((px = px0 & 15) === 15)
							break;
						if (px && (y + 1 & 0x1ff) > 15 && (y + 1 & 0x1ff) < 272) {
							dst = x - 17 & 0xff | y + 1 << 8 & 0x1ff00;
							data[dst] && (this.collision[idx << 1 | data[dst] >> 4] = this.collision[0x440] = 1), data[dst] = idx | px;
						}
					}
			}
		}
	}

	xfer8x8(data, p, k) {
		const t = this.ram[k] | this.ram[k + 1] << 8, c = t & 0x7ff, idx = t >> 2 & 0x3f8, q = c << 6;
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
		return void game.coin(true);
	case 'Digit1':
		return void game.start1P(true);
	case 'Digit2':
		return void game.start2P(true);
	case 'KeyC':
		return void game.triggerX(true);
	case 'KeyM': // MUTE
		return audioCtx.state === 'suspended' ? audioCtx.resume().catch() : audioCtx.state === 'running' && audioCtx.suspend().catch();
	case 'KeyR':
		return game.reset();
	case 'KeyT':
		return void(game.fTest = true);
	case 'Space':
	case 'KeyX':
		return void game.triggerA(true);
	case 'KeyZ':
		return void game.triggerB(true);
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
		return void game.triggerX(false);
	case 'KeyT':
		return void(game.fTest = false);
	case 'Space':
	case 'KeyX':
		return void game.triggerA(false);
	case 'KeyZ':
		return void game.triggerB(false);
	}
};

/*
 *
 *	Ninja Princess
 *
 */

import {ROM} from "./dist/ninja_princess_rom.js";
let PRG1, PRG2, BG, OBJ, PRI;

window.addEventListener('load', () => expand(ROM).then(ROM => {
	PRG1 = new Uint8Array(ROM.buffer, 0x0, 0xc000).addBase();
	PRG2 = new Uint8Array(ROM.buffer, 0xc000, 0x2000).addBase();
	BG = new Uint8Array(ROM.buffer, 0xe000, 0xc000);
	OBJ = new Uint8Array(ROM.buffer, 0x1a000, 0x10000);
	PRI = new Uint8Array(ROM.buffer, 0x2a000, 0x100);
	game = new NinjaPrincess();
	sound = [
		new SN76489({clock: Math.floor(8000000 / 4)}),
		new SN76489({clock: Math.floor(8000000 / 2)}),
	];
	canvas.addEventListener('click', () => game.coin(true));
	init({game, sound, keydown, keyup});
}));

