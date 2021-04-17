/*
 *
 *	Galaxy Wars
 *
 */

import {init, read} from './main.js';
import I8080 from './i8080.js';
let game, sound;

class GalaxyWars {
	cxScreen = 224;
	cyScreen = 256;
	width = 256;
	height = 256;
	xOffset = 0;
	yOffset = 0;
	rotate = false;

	fReset = false;
	fDIPSwitchChanged = true;
	fCoin = 0;
	fStart1P = 0;
	fStart2P = 0;
	nStock = 3;
	nExtend = 3000;

	ram = new Uint8Array(0x2000).addBase();
	io = new Uint8Array(0x100);
	cpu_irq = false;
	cpu_irq2 = false;

	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;
	shifter = {shift: 0, reg: 0};
//	screen_red = false;

	cpu = new I8080(Math.floor(19968000 / 10));
	scanline = {rate: 256 * 60, frac: 0, count: 0, execute(rate, fn) {
		for (this.frac += this.rate; this.frac >= rate; this.frac -= rate)
			fn(this.count = this.count + 1 & 255);
	}};

	constructor() {
		// CPU周りの初期化
		const range = (page, start, end, mirror = 0) => (page & ~mirror) >= start && (page & ~mirror) <= end;

		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0x0f, 0x80))
				this.cpu.memorymap[page].base = PRG1.base[page & 0xf];
			else if (range(page, 0x20, 0x3f, 0xc0)) {
				this.cpu.memorymap[page].base = this.ram.base[page & 0x1f];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0x40, 0x47, 0x80))
				this.cpu.memorymap[page].base = PRG2.base[page & 7];
		this.cpu.iomap.base = this.io;
		this.cpu.iomap.write = (addr, data) => {
			switch (addr) {
			case 0x00:
			case 0x01:
			case 0x02:
				return void(this.shifter.shift = data & 7);
			case 0x03:
//				check_sound3(this, data);
//				this.screen_red = (data & 4) !== 0;
				return;
			case 0x04:
				this.io[3] = data << this.shifter.shift | this.shifter.reg >> (8 - this.shifter.shift);
				return void(this.shifter.reg = data);
			case 0x05:
//				check_sound5(this, data);
				return;
			default:
				return void(this.io[addr] = data);
			}
		};

		this.cpu.check_interrupt = () => {
			if (this.cpu_irq && this.cpu.interrupt(0xd7)) // RST 10H
				return this.cpu_irq = false, true;
			if (this.cpu_irq2 && this.cpu.interrupt(0xcf)) // RST 08H
				return this.cpu_irq2 = false, true;
			return false;
		};

		// DIPSW SETUP
		this.io[0] = 0x40;
		this.io[1] = 0x81;
		this.io[2] = 0x01;
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.scanline.execute(tick_rate, (vpos) => { vpos === 96 && (this.cpu_irq2 = true), vpos === 224 && (update(), this.cpu_irq = true); });
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
			switch (this.nStock) {
			case 2:
				this.io[2] &= ~3;
				break;
			case 3:
				this.io[2] = this.io[2] & ~3 | 1;
				break;
			case 4:
				this.io[2] = this.io[2] & ~3 | 2;
				break;
			case 5:
				this.io[2] |= 3;
				break;
			}
			switch (this.nExtend) {
			case 3000:
				this.io[2] &= ~8;
				break;
			case 5000:
				this.io[2] |= 8;
				break;
			}
			this.fReset = true;
		}

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu_irq = this.cpu_irq2 = false;
			this.ram.fill(0);
			this.cpu.reset();
		}
		return this;
	}

	updateInput() {
		this.io[1] = this.io[1] & ~7 | !this.fCoin << 0 | !!this.fStart1P << 2 | !!this.fStart2P << 1;
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

	right(fDown) {
		this.io[1] = this.io[1] & ~(1 << 6 | fDown << 5) | fDown << 6;
	}

	left(fDown) {
		this.io[1] = this.io[1] & ~(1 << 5 | fDown << 6) | fDown << 5;
	}

	triggerA(fDown) {
		this.io[1] = this.io[1] & ~(1 << 4) | fDown << 4;
	}

	makeBitmap(flag) {
		if (!(this.updated = flag))
			return this.bitmap;

		const rgb = Int32Array.of(
			0xff000000, // black
			0xff0000ff, // red
			0xffff0000, // blue
			0xffff00ff, // magenta
			0xff00ff00, // green
			0xff00ffff, // yellow
			0xffffff00, // cyan
			0xffffffff, // white
		);

		for (let p = 256 * 8 * 31, k = 0x0400, i = 256 >> 3; i !== 0; --i) {
			for (let j = 224 >> 2; j !== 0; k += 0x80, p += 4, --j) {
//				const color = rgb[this.screen_red ? 1 : MAP[k >> 3 & 0x3e0 | k & 0x1f] & 7];
				const color = rgb[7], back = rgb[0];
				let a = this.ram[k];
				this.bitmap[p + 7 * 256] = a & 1 ? color : back;
				this.bitmap[p + 6 * 256] = a & 2 ? color : back;
				this.bitmap[p + 5 * 256] = a & 4 ? color : back;
				this.bitmap[p + 4 * 256] = a & 8 ? color : back;
				this.bitmap[p + 3 * 256] = a & 0x10 ? color : back;
				this.bitmap[p + 2 * 256] = a & 0x20 ? color : back;
				this.bitmap[p + 256] = a & 0x40 ? color : back;
				this.bitmap[p] = a & 0x80 ? color : back;
				a = this.ram[k + 0x20];
				this.bitmap[p + 1 + 7 * 256] = a & 1 ? color : back;
				this.bitmap[p + 1 + 6 * 256] = a & 2 ? color : back;
				this.bitmap[p + 1 + 5 * 256] = a & 4 ? color : back;
				this.bitmap[p + 1 + 4 * 256] = a & 8 ? color : back;
				this.bitmap[p + 1 + 3 * 256] = a & 0x10 ? color : back;
				this.bitmap[p + 1 + 2 * 256] = a & 0x20 ? color : back;
				this.bitmap[p + 1 + 256] = a & 0x40 ? color : back;
				this.bitmap[p + 1] = a & 0x80 ? color : back;
				a = this.ram[k + 0x40];
				this.bitmap[p + 2 + 7 * 256] = a & 1 ? color : back;
				this.bitmap[p + 2 + 6 * 256] = a & 2 ? color : back;
				this.bitmap[p + 2 + 5 * 256] = a & 4 ? color : back;
				this.bitmap[p + 2 + 4 * 256] = a & 8 ? color : back;
				this.bitmap[p + 2 + 3 * 256] = a & 0x10 ? color : back;
				this.bitmap[p + 2 + 2 * 256] = a & 0x20 ? color : back;
				this.bitmap[p + 2 + 256] = a & 0x40 ? color : back;
				this.bitmap[p + 2] = a & 0x80 ? color : back;
				a = this.ram[k + 0x60];
				this.bitmap[p + 3 + 7 * 256] = a & 1 ? color : back;
				this.bitmap[p + 3 + 6 * 256] = a & 2 ? color : back;
				this.bitmap[p + 3 + 5 * 256] = a & 4 ? color : back;
				this.bitmap[p + 3 + 4 * 256] = a & 8 ? color : back;
				this.bitmap[p + 3 + 3 * 256] = a & 0x10 ? color : back;
				this.bitmap[p + 3 + 2 * 256] = a & 0x20 ? color : back;
				this.bitmap[p + 3 + 256] = a & 0x40 ? color : back;
				this.bitmap[p + 3] = a & 0x80 ? color : back;
			}
			k -= 0x20 * 224 - 1;
			p -= 224 + 256 * 8;
		}

		return this.bitmap;
	}
}

/*
 *
 *	Galaxy Wars
 *
 */

let PRG1, PRG2;

read('galxwars.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG1 = Uint8Array.concat(...['univgw3.0', 'univgw4.1', 'univgw5.2', 'univgw6.3'].map(e => zip.decompress(e))).addBase();
	PRG2 = Uint8Array.concat(...['univgw1.4', 'univgw2.5'].map(e => zip.decompress(e))).addBase();
	game = new GalaxyWars();
	sound = [];
	canvas.addEventListener('click', () => game.coin(true));
	init({game, sound});
});

