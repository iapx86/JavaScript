/*
 *
 *	Lunar Rescue
 *
 */

import {init, read} from './main.js';
import I8080 from './i8080.js';
let game;

class LunarRescue {
	cxScreen = 224;
	cyScreen = 256;
	width = 256;
	height = 256;
	xOffset = 0;
	yOffset = 0;
	rotate = false;

	fReset = false;
	fTest = false;
	fDIPSwitchChanged = true;
	fCoin = 0;
	fStart1P = 0;
	fStart2P = 0;
	nStock = 3;
	nExtend = 1500;

	ram = new Uint8Array(0x2000).addBase();
	io = new Uint8Array(0x100);
	cpu_irq = false;
	cpu_irq2 = false;

	shifter = {shift: 0, reg: 0};
	screen_red = false;

	cpu = new I8080();

	constructor() {
		// CPU周りの初期化
		const range = (page, start, end, mirror = 0) => (page & ~mirror) >= start && (page & ~mirror) <= end;

		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0x1f, 0x80))
				this.cpu.memorymap[page].base = PRG1.base[page & 0x1f];
			else if (range(page, 0x20, 0x3f, 0xc0)) {
				this.cpu.memorymap[page].base = this.ram.base[page & 0x1f];
				this.cpu.memorymap[page].write = null;
			} else if (range(page, 0x40, 0x4f, 0x80))
				this.cpu.memorymap[page].base = PRG2.base[page & 0xf];
		this.cpu.iomap.base = this.io;
		this.cpu.iomap.write = (addr, data) => {
			switch (addr) {
			case 0x00:
			case 0x01:
			case 0x02:
				return void(this.shifter.shift = data & 7);
			case 0x03:
//				check_sound3(this, data);
				return void(this.screen_red = (data & 4) !== 0);
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
		this.io[1] = 1;
	}

	execute() {
		this.cpu_irq = true;
		this.cpu.execute(0x0800);
		this.cpu_irq2 = true;
		this.cpu.execute(0x0800);
		return this;
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// DIPスイッチの更新
		if (this.fDIPSwitchChanged) {
			this.fDIPSwitchChanged = false;
			switch (this.nStock) {
			case 3:
				this.io[2] &= ~3;
				break;
			case 4:
				this.io[2] = this.io[2] & ~3 | 1;
				break;
			case 5:
				this.io[2] = this.io[2] & ~3 | 2;
				break;
			case 6:
				this.io[2] |= 3;
				break;
			}
			switch (this.nExtend) {
			case 1000:
				this.io[2] |= 8;
				break;
			case 1500:
				this.io[2] &= ~8;
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

	coin() {
		this.fCoin = 2;
	}

	start1P() {
		this.fStart1P = 2;
	}

	start2P() {
		this.fStart2P = 2;
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

	makeBitmap(data) {
		const rgb = Uint32Array.of(
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
				const color = rgb[this.screen_red ? 1 : MAP[k >> 3 & 0x3e0 | k & 0x1f] & 7];
				const back = rgb[0];
				let a = this.ram[k];
				data[p + 7 * 256] = (a & 1) !== 0 ? color : back;
				data[p + 6 * 256] = (a & 2) !== 0 ? color : back;
				data[p + 5 * 256] = (a & 4) !== 0 ? color : back;
				data[p + 4 * 256] = (a & 8) !== 0 ? color : back;
				data[p + 3 * 256] = (a & 0x10) !== 0 ? color : back;
				data[p + 2 * 256] = (a & 0x20) !== 0 ? color : back;
				data[p + 256] = (a & 0x40) !== 0 ? color : back;
				data[p] = (a & 0x80) !== 0 ? color : back;
				a = this.ram[k + 0x20];
				data[p + 1 + 7 * 256] = (a & 1) !== 0 ? color : back;
				data[p + 1 + 6 * 256] = (a & 2) !== 0 ? color : back;
				data[p + 1 + 5 * 256] = (a & 4) !== 0 ? color : back;
				data[p + 1 + 4 * 256] = (a & 8) !== 0 ? color : back;
				data[p + 1 + 3 * 256] = (a & 0x10) !== 0 ? color : back;
				data[p + 1 + 2 * 256] = (a & 0x20) !== 0 ? color : back;
				data[p + 1 + 256] = (a & 0x40) !== 0 ? color : back;
				data[p + 1] = (a & 0x80) !== 0 ? color : back;
				a = this.ram[k + 0x40];
				data[p + 2 + 7 * 256] = (a & 1) !== 0 ? color : back;
				data[p + 2 + 6 * 256] = (a & 2) !== 0 ? color : back;
				data[p + 2 + 5 * 256] = (a & 4) !== 0 ? color : back;
				data[p + 2 + 4 * 256] = (a & 8) !== 0 ? color : back;
				data[p + 2 + 3 * 256] = (a & 0x10) !== 0 ? color : back;
				data[p + 2 + 2 * 256] = (a & 0x20) !== 0 ? color : back;
				data[p + 2 + 256] = (a & 0x40) !== 0 ? color : back;
				data[p + 2] = (a & 0x80) !== 0 ? color : back;
				a = this.ram[k + 0x60];
				data[p + 3 + 7 * 256] = (a & 1) !== 0 ? color : back;
				data[p + 3 + 6 * 256] = (a & 2) !== 0 ? color : back;
				data[p + 3 + 5 * 256] = (a & 4) !== 0 ? color : back;
				data[p + 3 + 4 * 256] = (a & 8) !== 0 ? color : back;
				data[p + 3 + 3 * 256] = (a & 0x10) !== 0 ? color : back;
				data[p + 3 + 2 * 256] = (a & 0x20) !== 0 ? color : back;
				data[p + 3 + 256] = (a & 0x40) !== 0 ? color : back;
				data[p + 3] = (a & 0x80) !== 0 ? color : back;
			}
			k -= 0x20 * 224 - 1;
			p -= 224 + 256 * 8;
		}
	}
}

/*
 *
 *	Lunar Rescue
 *
 */

let PRG1, PRG2, MAP;

read('lrescue.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG1 = Uint8Array.concat(...['lrescue.1', 'lrescue.2', 'lrescue.3', 'lrescue.4'].map(e => zip.decompress(e))).addBase();
	PRG2 = Uint8Array.concat(...['lrescue.5', 'lrescue.6'].map(e => zip.decompress(e))).addBase();
	MAP = zip.decompress('7643-1.cpu');
	game = new LunarRescue();
	canvas.addEventListener('click', () => game.coin());
	init({game});
});

