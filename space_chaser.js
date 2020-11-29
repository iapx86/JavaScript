/*
 *
 *	Space Chaser
 *
 */

import {init, read} from './main.js';
import I8080 from './i8080.js';
let game;

class SpaceChaser {
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
	nRank = 'EASY';

	ram = new Uint8Array(0x4000).addBase();
	io = new Uint8Array(0x100);
	cpu_irq = false;
	cpu_irq2 = false;

	shifter = {shift: 0, reg: 0};
	background_disable = false;
	background_select = false;

	cpu = new I8080();

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x20; i++)
			this.cpu.memorymap[i].base = PRG1.base[i];
		for (let i = 0; i < 8; i++)
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
			case 0x02:
				return void(this.shifter.shift = data & 7);
			case 0x03:
//				check_sound3(this, data);
				return this.background_disable = (data & 8) !== 0, void(this.background_select = (data & 0x10) !== 0);
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
			switch (this.nRank) {
			case 'EASY':
				this.io[2] &= ~8;
				break;
			case 'HARD':
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
		this.io[1] = this.io[1] & ~0xe0 | !this.fCoin << 7 | !!this.fStart1P << 6 | !!this.fStart2P << 5;
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
		this.io[1] = this.io[1] & ~(1 << 0 | fDown << 2) | fDown << 0;
	}

	right(fDown) {
		this.io[1] = this.io[1] & ~(1 << 3 | fDown << 1) | fDown << 3;
	}

	down(fDown) {
		this.io[1] = this.io[1] & ~(1 << 2 | fDown << 0) | fDown << 2;
	}

	left(fDown) {
		this.io[1] = this.io[1] & ~(1 << 1 | fDown << 3) | fDown << 1;
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
				const color = rgb[this.ram[k & 0x1f9f | 0x2000] & 7];
				const map_data = MAP[k >> 3 & 0x3e0 | k & 0x1f] & 0x0c;
				const back = rgb[this.background_disable ? 0 : this.background_select && map_data === 0x0c ? 4 : 2];
				let a = this.ram[k];
				data[p + 7 * 256] = a & 1 ? color : back;
				data[p + 6 * 256] = a & 2 ? color : back;
				data[p + 5 * 256] = a & 4 ? color : back;
				data[p + 4 * 256] = a & 8 ? color : back;
				data[p + 3 * 256] = a & 0x10 ? color : back;
				data[p + 2 * 256] = a & 0x20 ? color : back;
				data[p + 256] = a & 0x40 ? color : back;
				data[p] = a & 0x80 ? color : back;
				a = this.ram[k + 0x20];
				data[p + 1 + 7 * 256] = a & 1 ? color : back;
				data[p + 1 + 6 * 256] = a & 2 ? color : back;
				data[p + 1 + 5 * 256] = a & 4 ? color : back;
				data[p + 1 + 4 * 256] = a & 8 ? color : back;
				data[p + 1 + 3 * 256] = a & 0x10 ? color : back;
				data[p + 1 + 2 * 256] = a & 0x20 ? color : back;
				data[p + 1 + 256] = a & 0x40 ? color : back;
				data[p + 1] = a & 0x80 ? color : back;
				a = this.ram[k + 0x40];
				data[p + 2 + 7 * 256] = a & 1 ? color : back;
				data[p + 2 + 6 * 256] = a & 2 ? color : back;
				data[p + 2 + 5 * 256] = a & 4 ? color : back;
				data[p + 2 + 4 * 256] = a & 8 ? color : back;
				data[p + 2 + 3 * 256] = a & 0x10 ? color : back;
				data[p + 2 + 2 * 256] = a & 0x20 ? color : back;
				data[p + 2 + 256] = a & 0x40 ? color : back;
				data[p + 2] = a & 0x80 ? color : back;
				a = this.ram[k + 0x60];
				data[p + 3 + 7 * 256] = a & 1 ? color : back;
				data[p + 3 + 6 * 256] = a & 2 ? color : back;
				data[p + 3 + 5 * 256] = a & 4 ? color : back;
				data[p + 3 + 4 * 256] = a & 8 ? color : back;
				data[p + 3 + 3 * 256] = a & 0x10 ? color : back;
				data[p + 3 + 2 * 256] = a & 0x20 ? color : back;
				data[p + 3 + 256] = a & 0x40 ? color : back;
				data[p + 3] = a & 0x80 ? color : back;
			}
			k -= 0x20 * 224 - 1;
			p -= 224 + 256 * 8;
		}
	}
}

/*
 *
 *	Space Chaser
 *
 */

let PRG1, PRG2, MAP;

read('schaser.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG1 = Uint8Array.concat(...['rt13.bin', 'rt14.bin', 'rt15.bin', 'rt16.bin', 'rt17.bin'].map(e => zip.decompress(e)));
	PRG1 = Uint8Array.concat(PRG1, ...['rt18.bin', 'rt19.bin', 'rt20.bin'].map(e => zip.decompress(e))).addBase();
	PRG2 = Uint8Array.concat(...['rt21.bin', 'rt22.bin'].map(e => zip.decompress(e))).addBase();
	MAP = zip.decompress('rt06.ic2');
	game = new SpaceChaser();
	canvas.addEventListener('click', () => game.coin());
	init({game});
});

