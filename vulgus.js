/*
 *
 *	Vulgus
 *
 */

import AY_3_8910 from './ay-3-8910.js';
import {init, seq, rseq, convertGFX, IntTimer, read} from './main.js';
import Z80 from './z80.js';
let game, sound;

class Vulgus {
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
	nBonus = '20000 60000';
	nLife = 3;

	ram = new Uint8Array(0x2100).addBase();
	ram2 = new Uint8Array(0x800).addBase();
	in = Uint8Array.of(0xff, 0xff, 0xff, 0xff, 0x7f);
	psg = [{addr: 0}, {addr: 0}];
	command = 0;
	cpu_irq = false;

	fg = new Uint8Array(0x8000).fill(3);
	bg = new Uint8Array(0x20000).fill(7);
	obj = new Uint8Array(0x10000).fill(15);
	fgcolor = Uint8Array.from(FGCOLOR, e => 0x20 | e);
	objcolor = Uint8Array.from(OBJCOLOR, e => 0x10 | e);
	rgb = Uint32Array.from(seq(0x100), i => 0xff000000 | BLUE[i] * 255 / 15 << 16 | GREEN[i] * 255 / 15 << 8 | RED[i] * 255 / 15);
	hScroll = 0;
	vScroll = 0;
	palette = 0;
	frame = 0;

	cpu = new Z80(Math.floor(12000000 / 4));
	cpu2 = new Z80(Math.floor(12000000 / 4));
	timer = new IntTimer(8 * 60);

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0xa0; i++)
			this.cpu.memorymap[i].base = PRG1.base[i];
		this.cpu.memorymap[0xc0].read = (addr) => { return (addr &= 0xff) < 5 ? this.in[addr] : 0xff; };
		this.cpu.memorymap[0xc8].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				return void(this.command = data);
			case 2:
				return void(this.hScroll = this.hScroll & 0xff00 | data);
			case 3:
				return void(this.vScroll = this.vScroll & 0xff00 | data);
			case 4:
				return data & 0x10 ? this.cpu2.disable() : this.cpu2.enable();
			case 5:
				return void(this.palette = data << 6 & 0xc0);
			}
		};
		this.cpu.memorymap[0xc9].write = (addr, data) => {
			switch (addr & 0xff) {
			case 2:
				return void(this.hScroll = this.hScroll & 0xff | data << 8);
			case 3:
				return void(this.vScroll = this.vScroll & 0xff | data << 8);
			}
		};
		this.cpu.memorymap[0xcc].base = this.ram.base[0];
		this.cpu.memorymap[0xcc].write = null;
		for (let i = 0; i < 0x20; i++) {
			this.cpu.memorymap[0xd0 + i].base = this.ram.base[1 + i];
			this.cpu.memorymap[0xd0 + i].write = null;
		}

		this.cpu.check_interrupt = () => { return this.cpu_irq && this.cpu.interrupt(0xd7) && (this.cpu_irq = false, true); };

		for (let i = 0; i < 0x20; i++)
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
		convertGFX(this.obj, OBJ, 256, seq(16, 0, 16), rseq(4, 264).concat(rseq(4, 256), rseq(4, 8), rseq(4)), [OBJ.length * 4 + 4, OBJ.length * 4, 4, 0], 64);
	}

	execute(audio, rate_correction) {
		const tick_rate = 384000, tick_max = Math.floor(tick_rate / 60);
		this.cpu_irq = true;
		for (let i = 0; i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.cpu2.execute(tick_rate);
			this.timer.execute(tick_rate, () => { this.cpu2.interrupt(); });
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
			case 1:
				this.in[3] = this.in[3] & ~3 | 1;
				break;
			case 2:
				this.in[3] = this.in[3] & ~3 | 2;
				break;
			case 3:
				this.in[3] |= 3;
				break;
			case 5:
				this.in[3] &= ~3;
				break;
			}
			switch (this.nBonus) {
			case '10000 50000':
				this.in[4] = this.in[4] & ~0x70 | 0x30;
				break;
			case '10000 60000':
				this.in[4] = this.in[4] & ~0x70 | 0x50;
				break;
			case '10000 70000':
				this.in[4] = this.in[4] & ~0x70 | 0x10;
				break;
			case '20000 60000':
				this.in[4] |= 0x70;
				break;
			case '20000 70000':
				this.in[4] = this.in[4] & ~0x70 | 0x60;
				break;
			case '20000 80000':
				this.in[4] = this.in[4] & ~0x70 | 0x20;
				break;
			case '30000 70000':
				this.in[4] = this.in[4] & ~0x70 | 0x40;
				break;
			case 'None':
				this.in[4] &= ~0x70;
				break;
			}
			if (!this.fTest)
				this.fReset = true;
		}

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
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

	makeBitmap(data) {
		this.frame++;

		// bg描画
		let p = 256 * 256 + 16 - (16 + this.hScroll & 0x0f) + (this.vScroll & 0x0f) * 256;
		for (let k = 16 + this.hScroll >> 4 & 0x1f | this.vScroll << 1 & 0x3e0, i = 0; i < 17; k = k + 0x11 & 0x1f | k + 0x20 & 0x3e0, p -= 15 * 16 + 256 * 16, i++)
			for (let j = 0; j < 15; k = k + 1 & 0x1f | k & 0x3e0, p += 16, j++)
				this.xfer16x16x3(data, p, 0x900 + k);

		// obj描画
		for (let k = 0x7c, i = 32; i !== 0; k -= 4, --i) {
			const x = this.ram[k + 2];
			const y = 256 - this.ram[k + 3];
			const src = this.ram[k] | this.ram[k + 1] << 8;
			switch (this.ram[k + 1] >> 6) {
			case 0:
				this.xfer16x16x4(data, x | y << 8, src);
				break;
			case 1:
				this.xfer16x16x4(data, x | y << 8, src);
				this.xfer16x16x4(data, x + 16 & 0xff | y << 8, src + 1);
				break;
			case 2:
			case 3:
				this.xfer16x16x4(data, x | y << 8, src);
				this.xfer16x16x4(data, x + 16 & 0xff | y << 8, src + 1);
				this.xfer16x16x4(data, x + 32 & 0xff | y << 8, src + 2);
				this.xfer16x16x4(data, x + 48 & 0xff | y << 8, src + 3);
				break;
			}
		}

		// fg描画
		p = 256 * 8 * 33 + 16;
		for (let k = 0x140, i = 0; i < 28; p += 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p -= 256 * 8, j++)
				this.xfer8x8(data, p, k);

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] = this.rgb[data[p]];
	}

	xfer8x8(data, p, k) {
		const q = (this.ram[k] | this.ram[k + 0x400] << 1 & 0x100) << 6, idx = this.ram[k + 0x400] << 2 & 0xfc;
		let px;

		(px = this.fgcolor[idx | this.fg[q | 0x00]]) !== 0x2f && (data[p + 0x000] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x01]]) !== 0x2f && (data[p + 0x001] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x02]]) !== 0x2f && (data[p + 0x002] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x03]]) !== 0x2f && (data[p + 0x003] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x04]]) !== 0x2f && (data[p + 0x004] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x05]]) !== 0x2f && (data[p + 0x005] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x06]]) !== 0x2f && (data[p + 0x006] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x07]]) !== 0x2f && (data[p + 0x007] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x08]]) !== 0x2f && (data[p + 0x100] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x09]]) !== 0x2f && (data[p + 0x101] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x0a]]) !== 0x2f && (data[p + 0x102] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x0b]]) !== 0x2f && (data[p + 0x103] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x0c]]) !== 0x2f && (data[p + 0x104] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x0d]]) !== 0x2f && (data[p + 0x105] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x0e]]) !== 0x2f && (data[p + 0x106] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x0f]]) !== 0x2f && (data[p + 0x107] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x10]]) !== 0x2f && (data[p + 0x200] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x11]]) !== 0x2f && (data[p + 0x201] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x12]]) !== 0x2f && (data[p + 0x202] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x13]]) !== 0x2f && (data[p + 0x203] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x14]]) !== 0x2f && (data[p + 0x204] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x15]]) !== 0x2f && (data[p + 0x205] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x16]]) !== 0x2f && (data[p + 0x206] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x17]]) !== 0x2f && (data[p + 0x207] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x18]]) !== 0x2f && (data[p + 0x300] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x19]]) !== 0x2f && (data[p + 0x301] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x1a]]) !== 0x2f && (data[p + 0x302] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x1b]]) !== 0x2f && (data[p + 0x303] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x1c]]) !== 0x2f && (data[p + 0x304] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x1d]]) !== 0x2f && (data[p + 0x305] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x1e]]) !== 0x2f && (data[p + 0x306] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x1f]]) !== 0x2f && (data[p + 0x307] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x20]]) !== 0x2f && (data[p + 0x400] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x21]]) !== 0x2f && (data[p + 0x401] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x22]]) !== 0x2f && (data[p + 0x402] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x23]]) !== 0x2f && (data[p + 0x403] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x24]]) !== 0x2f && (data[p + 0x404] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x25]]) !== 0x2f && (data[p + 0x405] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x26]]) !== 0x2f && (data[p + 0x406] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x27]]) !== 0x2f && (data[p + 0x407] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x28]]) !== 0x2f && (data[p + 0x500] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x29]]) !== 0x2f && (data[p + 0x501] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x2a]]) !== 0x2f && (data[p + 0x502] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x2b]]) !== 0x2f && (data[p + 0x503] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x2c]]) !== 0x2f && (data[p + 0x504] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x2d]]) !== 0x2f && (data[p + 0x505] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x2e]]) !== 0x2f && (data[p + 0x506] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x2f]]) !== 0x2f && (data[p + 0x507] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x30]]) !== 0x2f && (data[p + 0x600] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x31]]) !== 0x2f && (data[p + 0x601] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x32]]) !== 0x2f && (data[p + 0x602] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x33]]) !== 0x2f && (data[p + 0x603] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x34]]) !== 0x2f && (data[p + 0x604] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x35]]) !== 0x2f && (data[p + 0x605] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x36]]) !== 0x2f && (data[p + 0x606] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x37]]) !== 0x2f && (data[p + 0x607] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x38]]) !== 0x2f && (data[p + 0x700] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x39]]) !== 0x2f && (data[p + 0x701] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x3a]]) !== 0x2f && (data[p + 0x702] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x3b]]) !== 0x2f && (data[p + 0x703] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x3c]]) !== 0x2f && (data[p + 0x704] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x3d]]) !== 0x2f && (data[p + 0x705] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x3e]]) !== 0x2f && (data[p + 0x706] = px);
		(px = this.fgcolor[idx | this.fg[q | 0x3f]]) !== 0x2f && (data[p + 0x707] = px);
	}

	xfer16x16x3(data, p, k) {
		const idx = this.ram[k + 0x400] << 3 & 0xf8;
		let i, j, q = (this.ram[k] | this.ram[k + 0x400] << 1 & 0x100) << 8;

		switch (this.ram[k + 0x400] >> 5 & 3) {
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
		const idx = src >> 4 & 0xf0;
		let px, i, j;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		for (src = src << 8 & 0xff00, i = 16; i !== 0; dst += 256 - 16, --i)
			for (j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj[src++]]) !== 0x1f)
					data[dst] = px;
	}
}

/*
 *
 *	Vulgus
 *
 */

let PRG1, PRG2, FG, BG, OBJ, RED, GREEN, BLUE, FGCOLOR, BGCOLOR, OBJCOLOR;

read('vulgus.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG1 = Uint8Array.concat(...['vulgus.002', 'vulgus.003', 'vulgus.004', 'vulgus.005', '1-8n.bin'].map(e => zip.decompress(e))).addBase();
	PRG2 = zip.decompress('1-11c.bin').addBase();
	FG = zip.decompress('1-3d.bin');
	BG = Uint8Array.concat(...['2-2a.bin', '2-3a.bin', '2-4a.bin', '2-5a.bin', '2-6a.bin', '2-7a.bin'].map(e => zip.decompress(e)));
	OBJ = Uint8Array.concat(...['2-2n.bin', '2-3n.bin', '2-4n.bin', '2-5n.bin'].map(e => zip.decompress(e)));
	RED = zip.decompress('e8.bin');
	GREEN = zip.decompress('e9.bin');
	BLUE = zip.decompress('e10.bin');
	FGCOLOR = zip.decompress('d1.bin');
	BGCOLOR = zip.decompress('c9.bin');
	OBJCOLOR = zip.decompress('j2.bin');
	game = new Vulgus();
	sound = [
		new AY_3_8910({clock: 12000000 / 8}),
		new AY_3_8910({clock: 12000000 / 8}),
	];
	canvas.addEventListener('click', () => game.coin());
	init({game, sound});
});

