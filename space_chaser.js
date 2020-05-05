/*
 *
 *	Space Chaser
 *
 */

import {init, loop} from './main.js';
import I8080 from './i8080.js';

class SpaceChaser {
	constructor() {
		this.cxScreen = 224;
		this.cyScreen = 256;
		this.width = 256;
		this.height = 256;
		this.xOffset = 0;
		this.yOffset = 0;
		this.fReset = false;
		this.fTest = false;
		this.fDIPSwitchChanged = true;
		this.fCoin = 0;
		this.fStart1P = 0;
		this.fStart2P = 0;
		this.nStock = 3;
		this.nRank = 'EASY';

		// CPU周りの初期化
		this.ram = new Uint8Array(0x4000).addBase();
		this.io = new Uint8Array(0x100);

		this.cpu = new I8080(this);
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
			this.cpu.memorymap[0xc0 + i].write = (addr, data) => this.ram[0x2000 + (addr & 0x1f9f)] = data;
		}
		this.cpu.iomap.base = this.io;
		this.cpu.iomap.write = (addr, data) => {
			switch (addr) {
			case 0x02:
				this.shifter.shift = data & 7;
				break;
			case 0x03:
//				check_sound3(this, data);
				this.background_disable = (data & 8) !== 0;
				this.background_select = (data & 0x10) !== 0;
				break;
			case 0x04:
				this.io[3] = (data << this.shifter.shift | this.shifter.reg >> (8 - this.shifter.shift)) & 0xff;
				this.shifter.reg = data;
				break;
			case 0x05:
//				check_sound5(this, data);
				break;
			default:
				this.io[addr] = data;
				break;
			}
		};

		// Videoの初期化
		this.shifter = {shift: 0, reg: 0};
		this.background_disable = false;
		this.background_select = false;
	}

	execute() {
		this.cpu.execute(0x0800);
		this.cpu.interrupt(0xd7); // RST 10h
		this.cpu.execute(0x0800);
		this.cpu.interrupt(0xcf); // RST 08h
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
			this.ram.fill(0);
			this.cpu.reset();
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if (this.fCoin) {
			--this.fCoin;
			this.io[1] &= ~(1 << 7);
		}
		else
			this.io[1] |= 1 << 7;
		if (this.fStart1P) {
			--this.fStart1P;
			this.io[1] |= 1 << 6;
		}
		else
			this.io[1] &= ~(1 << 6);
		if (this.fStart2P) {
			--this.fStart2P;
			this.io[1] |= 1 << 5;
		}
		else
			this.io[1] &= ~(1 << 5);
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
		if (fDown)
			this.io[1] = this.io[1] & ~(1 << 2) | 1 << 0;
		else
			this.io[1] &= ~(1 << 0);
	}

	right(fDown) {
		if (fDown)
			this.io[1] = this.io[1] & ~(1 << 1) | 1 << 3;
		else
			this.io[1] &= ~(1 << 3);
	}

	down(fDown) {
		if (fDown)
			this.io[1] = this.io[1] & ~(1 << 0) | 1 << 2;
		else
			this.io[1] &= ~(1 << 2);
	}

	left(fDown) {
		if (fDown)
			this.io[1] = this.io[1] & ~(1 << 3) | 1 << 1;
		else
			this.io[1] &= ~(1 << 1);
	}

	triggerA(fDown) {
		if (fDown)
			this.io[1] |= 1 << 4;
		else
			this.io[1] &= ~(1 << 4);
	}

	triggerB(fDown) {
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
 *	Space Chaser
 *
 */

const url = 'schaser.zip';
let PRG1, PRG2, MAP;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG1 = zip.files['rt13.bin'].inflate() + zip.files['rt14.bin'].inflate() + zip.files['rt15.bin'].inflate() + zip.files['rt16.bin'].inflate() + zip.files['rt17.bin'].inflate();
	PRG1 = new Uint8Array((PRG1 + zip.files['rt18.bin'].inflate() + zip.files['rt19.bin'].inflate() + zip.files['rt20.bin'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	PRG2 = new Uint8Array((zip.files['rt21.bin'].inflate() + zip.files['rt22.bin'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	MAP = new Uint8Array(zip.files['rt06.ic2'].inflate().split('').map(c => c.charCodeAt(0)));
	init({game: new SpaceChaser()});
	loop();
}

