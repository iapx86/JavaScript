/*
 *
 *	Polaris
 *
 */

import {init, read} from './main.js';
import I8080 from './i8080.js';
let game;

class Polaris {
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

	ram = new Uint8Array(0x4000).addBase();
	io = new Uint8Array(0x100);
	cpu_irq = false;
	cpu_irq2 = false;

	shifter = {shift: 0, reg: 0};

	cpu = new I8080();

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x20; i++)
			this.cpu.memorymap[i].base = PRG1.base[i];
		for (let i = 0; i < 0x18; i++)
			this.cpu.memorymap[0x40 + i].base = PRG2.base[i];
		for (let i = 0; i < 0x20; i++) {
			this.cpu.memorymap[0x20 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x20 + i].write = null;
		}
		for (let i = 0; i < 0x20; i++) {
			this.cpu.memorymap[0xc0 + i].base = this.ram.base[0x20 + i];
			this.cpu.memorymap[0xc0 + i].write = (addr, data) => { this.ram[0x2000 | addr & 0x1f9f] = data; };
		}
		this.cpu.iomap.base = this.io;
		this.cpu.iomap.write = (addr, data) => {
			switch (addr) {
			case 0x00:
				return void(this.shifter.shift = data & 7);
			case 0x03:
				this.io[3] = data << this.shifter.shift | this.shifter.reg >> (8 - this.shifter.shift);
				return void(this.shifter.reg = data);
			default:
//				this.io[addr] = data;
				return;
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
			this.fReset = true;
		}

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu_irq = this.cpu_irq2 = false;
			this.ram.fill(0, 0, 0x2000);
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

	up(fDown) {
		this.io[1] = this.io[1] & ~(1 << 7 | fDown << 5) | fDown << 7;
	}

	right(fDown) {
		this.io[1] = this.io[1] & ~(1 << 4 | fDown << 6) | fDown << 4;
	}

	down(fDown) {
		this.io[1] = this.io[1] & ~(1 << 5 | fDown << 7) | fDown << 5;
	}

	left(fDown) {
		this.io[1] = this.io[1] & ~(1 << 6 | fDown << 4) | fDown << 6;
	}

	triggerA(fDown) {
		this.io[1] = this.io[1] & ~(1 << 3) | fDown << 3;
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
				const color = rgb[~this.ram[k & 0x1f9f | 0x2000] & 7];
				const back = rgb[(MAP[k >> 3 & 0x3e0 | k & 0x1f] & 1) !== 0 ? 6 : 2];
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
 *	Polaris
 *
 */

let PRG1, PRG2, MAP, OBJ;

read('polaris.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG1 = Uint8Array.concat(...['ps01-1.30', 'ps09.36', 'ps03-1.31', 'ps04.37'].map(e => zip.decompress(e))).addBase();
	PRG2 = Uint8Array.concat(...['ps05.32', 'ps10.38', 'ps26'].map(e => zip.decompress(e))).addBase();
	MAP = zip.decompress('ps08.1b');
	OBJ = zip.decompress('ps07.2c');
	game = new Polaris();
	canvas.addEventListener('click', () => game.coin());
	init({game});
});

