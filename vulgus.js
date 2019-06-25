/*
 *
 *	Vulgus
 *
 */

import AY_3_8910 from './ay-3-8910.js';
import Cpu, {init, loop} from './main.js';
import Z80 from './z80.js';
let sound;

class Vulgus {
	constructor() {
		this.cxScreen = 224;
		this.cyScreen = 256;
		this.width = 256;
		this.height = 512;
		this.xOffset = 16;
		this.yOffset = 16;
		this.fReset = true;
		this.fTest = false;
		this.fDIPSwitchChanged = true;
		this.fCoin = 0;
		this.fStart1P = 0;
		this.fStart2P = 0;
		this.nBonus = '20000 60000';
		this.nLife = 3;

		// CPU周りの初期化
		this.ram = new Uint8Array(0x2100).addBase();
		this.ram2 = new Uint8Array(0x800).addBase();
		this.in = Uint8Array.of(0xff, 0xff, 0xff, 0xff, 0x7f);
		this.psg = [{addr: 0}, {addr: 0}];
		this.command = 0;
		this.timer = 0;

		this.cpu = new Z80(this);
		for (let i = 0; i < 0xa0; i++)
			this.cpu.memorymap[i].base = PRG1.base[i];
		this.cpu.memorymap[0xc0].read = addr => {
			if ((addr &= 0xff) < 5)
				return this.in[addr];
			return 0xff;
		};
		this.cpu.memorymap[0xc8].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				this.command = data;
				break;
			case 2:
				this.hScroll = this.hScroll & 0xff00 | data;
				break;
			case 3:
				this.vScroll = this.vScroll & 0xff00 | data;
				break;
			case 4:
				(data & 0x10) !== 0 ? this.cpu2.disable() : this.cpu2.enable();
				break;
			case 5:
				this.palette = data << 6 & 0xc0;
				break;
			}
		};
		this.cpu.memorymap[0xc9].write = (addr, data) => {
			switch (addr & 0xff) {
			case 2:
				this.hScroll = this.hScroll & 0xff | data << 8;
				break;
			case 3:
				this.vScroll = this.vScroll & 0xff | data << 8;
				break;
			}
		};
		this.cpu.memorymap[0xcc].base = this.ram.base[0];
		this.cpu.memorymap[0xcc].write = null;
		for (let i = 0; i < 0x20; i++) {
			this.cpu.memorymap[0xd0 + i].base = this.ram.base[1 + i];
			this.cpu.memorymap[0xd0 + i].write = null;
		}

		this.cpu2 = new Z80(this);
		for (let i = 0; i < 0x20; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 8; i++) {
			this.cpu2.memorymap[0x40 + i].base = this.ram2.base[i];
			this.cpu2.memorymap[0x40 + i].write = null;
		}
		this.cpu2.memorymap[0x60].read = addr => (addr & 0xff) === 0 ? this.command : 0xff;
		this.cpu2.memorymap[0x80].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				this.psg[0].addr = data;
				break;
			case 1:
				sound[0].write(this.psg[0].addr, data, this.timer);
				break;
			}
		};
		this.cpu2.memorymap[0xc0].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				this.psg[1].addr = data;
				break;
			case 1:
				sound[1].write(this.psg[1].addr, data, this.timer);
				break;
			}
		};

		// Videoの初期化
		this.fg = new Uint8Array(0x8000);
		this.bg = new Uint8Array(0x20000);
		this.obj = new Uint8Array(0x10000);
		this.rgb = new Uint32Array(0x100);
		this.hScroll = 0;
		this.vScroll = 0;
		this.palette = 0;
		this.convertRGB();
		this.convertFG();
		this.convertBG();
		this.convertOBJ();
	}

	execute() {
		for (let i = 0; i < 16; i++) {
			if (i === 0)
				this.cpu.interrupt(0xd7); // RST 10H
			if ((i & 1) === 0) {
				this.timer = i >>> 1;
				this.cpu2.interrupt();
			}
			Cpu.multiple_execute([this.cpu, this.cpu2], 600);
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
		// クレジット/スタートボタン処理
		if (this.fCoin) {
			--this.fCoin;
			this.in[0] &= ~(1 << 4);
		}
		else
			this.in[0] |= 1 << 4;
		if (this.fStart1P) {
			--this.fStart1P;
			this.in[0] &= ~(1 << 0);
		}
		else
			this.in[0] |= 1 << 0;
		if (this.fStart2P) {
			--this.fStart2P;
			this.in[0] &= ~(1 << 1);
		}
		else
			this.in[0] |= 1 << 1;
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
			this.in[1] = this.in[1] & ~(1 << 3) | 1 << 2;
		else
			this.in[1] |= 1 << 3;
	}

	right(fDown) {
		if (fDown)
			this.in[1] = this.in[1] & ~(1 << 0) | 1 << 1;
		else
			this.in[1] |= 1 << 0;
	}

	down(fDown) {
		if (fDown)
			this.in[1] = this.in[1] & ~(1 << 2) | 1 << 3;
		else
			this.in[1] |= 1 << 2;
	}

	left(fDown) {
		if (fDown)
			this.in[1] = this.in[1] & ~(1 << 1) | 1 << 0;
		else
			this.in[1] |= 1 << 1;
	}

	triggerA(fDown) {
		if (fDown)
			this.in[1] &= ~(1 << 4);
		else
			this.in[1] |= 1 << 4;
	}

	triggerB(fDown) {
		if (fDown)
			this.in[1] &= ~(1 << 5);
		else
			this.in[1] |= 1 << 5;
	}

	convertRGB() {
		for (let i = 0; i < 0x100; i++)
			this.rgb[i] = (RED[i] & 0x0f) * 255 / 15	// Red
				| (GREEN[i] & 0x0f) * 255 / 15 << 8		// Green
				| (BLUE[i] & 0x0f) * 255 / 15 << 16		// Blue
				| 0xff000000;							// Alpha
	}

	convertFG() {
		for (let p = 0, q = 0, i = 512; i !== 0; q += 16, --i) {
			for (let j = 0; j < 4; j++)
				for (let k = 0; k < 16; k += 2)
					this.fg[p++] = FG[q + k + 1] >>> (j + 4) & 1 | FG[q + k + 1] >>> j << 1 & 2;
			for (let j = 0; j < 4; j++)
				for (let k = 0; k < 16; k += 2)
					this.fg[p++] = FG[q + k] >>> (j + 4) & 1 | FG[q + k] >>> j << 1 & 2;
		}
	}

	convertBG() {
		for (let p = 0, q = 0, i = 512; i !== 0; q += 32, --i) {
			for (let j = 0; j < 8; j++)
				for (let k = 0; k < 16; k++)
					this.bg[p++] = BG[q + k + 0x8000 + 16] >>> j & 1 | BG[q + k + 0x4000 + 16] >>> j << 1 & 2 | BG[q + k + 16] >>> j << 2 & 4;
			for (let j = 0; j < 8; j++)
				for (let k = 0; k < 16; k++)
					this.bg[p++] = BG[q + k + 0x8000] >>> j & 1 | BG[q + k + 0x4000] >>> j << 1 & 2 | BG[q + k] >>> j << 2 & 4;
		}
	}

	convertOBJ() {
		for (let p = 0, q = 0, i = 256; i !== 0; q += 64, --i) {
			for (let j = 0; j < 4; j++)
				for (let k = 0; k < 32; k += 2)
					this.obj[p++] = OBJ[q + k + 33] >>> (j + 4) & 1 | OBJ[q + k + 33] >>> j << 1 & 2 | OBJ[q + k + 0x4000 + 33] >>> (j + 2) & 4 | OBJ[q + k + 0x4000 + 33] >>> j << 3 & 8;
			for (let j = 0; j < 4; j++)
				for (let k = 0; k < 32; k += 2)
					this.obj[p++] = OBJ[q + k + 32] >>> (j + 4) & 1 | OBJ[q + k + 32] >>> j << 1 & 2 | OBJ[q + k + 0x4000 + 32] >>> (j + 2) & 4 | OBJ[q + k + 0x4000 + 32] >>> j << 3 & 8;
			for (let j = 0; j < 4; j++)
				for (let k = 0; k < 32; k += 2)
					this.obj[p++] = OBJ[q + k + 1] >>> (j + 4) & 1 | OBJ[q + k + 1] >>> j << 1 & 2 | OBJ[q + k + 0x4000 + 1] >>> (j + 2) & 4 | OBJ[q + k + 0x4000 + 1] >>> j << 3 & 8;
			for (let j = 0; j < 4; j++)
				for (let k = 0; k < 32; k += 2)
					this.obj[p++] = OBJ[q + k] >>> (j + 4) & 1 | OBJ[q + k] >>> j << 1 & 2 | OBJ[q + k + 0x4000] >>> (j + 2) & 4 | OBJ[q + k + 0x4000] >>> j << 3 & 8;
		}
	}

	makeBitmap(data) {
		// bg描画
		let p = 256 * 256 + 16 - (16 + this.hScroll & 0x0f) + (this.vScroll & 0x0f) * 256;
		let k = 16 + this.hScroll >>> 4 & 0x1f | this.vScroll << 1 & 0x3e0;
		for (let i = 0; i < 17; k = k + 0x11 & 0x1f | k + 0x20 & 0x3e0, p -= 15 * 16 + 256 * 16, i++)
			for (let j = 0; j < 15; k = k + 1 & 0x1f | k & 0x3e0, p += 16, j++)
				this.xfer16x16x3(data, p, 0x900 + k);

		// obj描画
		for (let p = 0x7c, i = 32; i !== 0; p -= 4, --i) {
			const y = 256 - this.ram[p + 3];
			const x = this.ram[p + 2];
			const src = this.ram[p] | this.ram[p + 1] << 8;
			switch (this.ram[p + 1] >>> 6) {
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
		k = 0x140;
		for (let i = 0; i < 28; p += 256 * 8 * 32 + 8, i++)
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

		if ((px = FGCOLOR[idx | this.fg[q | 0x00]]) !== 0x0f) data[p + 0x000] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x01]]) !== 0x0f) data[p + 0x001] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x02]]) !== 0x0f) data[p + 0x002] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x03]]) !== 0x0f) data[p + 0x003] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x04]]) !== 0x0f) data[p + 0x004] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x05]]) !== 0x0f) data[p + 0x005] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x06]]) !== 0x0f) data[p + 0x006] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x07]]) !== 0x0f) data[p + 0x007] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x08]]) !== 0x0f) data[p + 0x100] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x09]]) !== 0x0f) data[p + 0x101] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x0a]]) !== 0x0f) data[p + 0x102] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x0b]]) !== 0x0f) data[p + 0x103] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x0c]]) !== 0x0f) data[p + 0x104] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x0d]]) !== 0x0f) data[p + 0x105] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x0e]]) !== 0x0f) data[p + 0x106] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x0f]]) !== 0x0f) data[p + 0x107] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x10]]) !== 0x0f) data[p + 0x200] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x11]]) !== 0x0f) data[p + 0x201] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x12]]) !== 0x0f) data[p + 0x202] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x13]]) !== 0x0f) data[p + 0x203] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x14]]) !== 0x0f) data[p + 0x204] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x15]]) !== 0x0f) data[p + 0x205] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x16]]) !== 0x0f) data[p + 0x206] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x17]]) !== 0x0f) data[p + 0x207] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x18]]) !== 0x0f) data[p + 0x300] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x19]]) !== 0x0f) data[p + 0x301] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x1a]]) !== 0x0f) data[p + 0x302] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x1b]]) !== 0x0f) data[p + 0x303] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x1c]]) !== 0x0f) data[p + 0x304] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x1d]]) !== 0x0f) data[p + 0x305] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x1e]]) !== 0x0f) data[p + 0x306] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x1f]]) !== 0x0f) data[p + 0x307] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x20]]) !== 0x0f) data[p + 0x400] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x21]]) !== 0x0f) data[p + 0x401] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x22]]) !== 0x0f) data[p + 0x402] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x23]]) !== 0x0f) data[p + 0x403] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x24]]) !== 0x0f) data[p + 0x404] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x25]]) !== 0x0f) data[p + 0x405] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x26]]) !== 0x0f) data[p + 0x406] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x27]]) !== 0x0f) data[p + 0x407] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x28]]) !== 0x0f) data[p + 0x500] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x29]]) !== 0x0f) data[p + 0x501] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x2a]]) !== 0x0f) data[p + 0x502] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x2b]]) !== 0x0f) data[p + 0x503] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x2c]]) !== 0x0f) data[p + 0x504] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x2d]]) !== 0x0f) data[p + 0x505] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x2e]]) !== 0x0f) data[p + 0x506] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x2f]]) !== 0x0f) data[p + 0x507] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x30]]) !== 0x0f) data[p + 0x600] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x31]]) !== 0x0f) data[p + 0x601] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x32]]) !== 0x0f) data[p + 0x602] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x33]]) !== 0x0f) data[p + 0x603] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x34]]) !== 0x0f) data[p + 0x604] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x35]]) !== 0x0f) data[p + 0x605] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x36]]) !== 0x0f) data[p + 0x606] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x37]]) !== 0x0f) data[p + 0x607] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x38]]) !== 0x0f) data[p + 0x700] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x39]]) !== 0x0f) data[p + 0x701] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x3a]]) !== 0x0f) data[p + 0x702] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x3b]]) !== 0x0f) data[p + 0x703] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x3c]]) !== 0x0f) data[p + 0x704] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x3d]]) !== 0x0f) data[p + 0x705] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x3e]]) !== 0x0f) data[p + 0x706] = 0x20 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x3f]]) !== 0x0f) data[p + 0x707] = 0x20 | px;
	}

	xfer16x16x3(data, p, k) {
		const idx = this.ram[k + 0x400] << 3 & 0xf8;
		let i, j, q = (this.ram[k] | this.ram[k + 0x400] << 1 & 0x100) << 8;

		switch (this.ram[k + 0x400] >>> 5 & 3) {
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
		const idx = src >>> 4 & 0xf0;
		let px, i, j;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		for (src = src << 8 & 0xff00, i = 16; i !== 0; dst += 256 - 16, --i)
			for (j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[src++]]) !== 0x0f)
					data[dst] = 0x10 | px;
	}
}

/*
 *
 *	Vulgus
 *
 */

const url = 'vulgus.zip';
let PRG1, PRG2, FG, BG, OBJ, RED, GREEN, BLUE, FGCOLOR, BGCOLOR, OBJCOLOR;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG1 = zip.files['vulgus.002'].inflate() + zip.files['vulgus.003'].inflate() + zip.files['vulgus.004'].inflate() + zip.files['vulgus.005'].inflate();
	PRG1 = new Uint8Array((PRG1 + zip.files['1-8n.bin'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	PRG2 = new Uint8Array(zip.files['1-11c.bin'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	FG = new Uint8Array(zip.files['1-3d.bin'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	BG = zip.files['2-2a.bin'].inflate() + zip.files['2-3a.bin'].inflate() + zip.files['2-4a.bin'].inflate() + zip.files['2-5a.bin'].inflate();
	BG = new Uint8Array((BG + zip.files['2-6a.bin'].inflate() + zip.files['2-7a.bin'].inflate()).split('').map(c => c.charCodeAt(0)));
	OBJ = new Uint8Array((zip.files['2-2n.bin'].inflate() + zip.files['2-3n.bin'].inflate() + zip.files['2-4n.bin'].inflate() + zip.files['2-5n.bin'].inflate()).split('').map(c => c.charCodeAt(0)));
	RED = new Uint8Array(zip.files['e8.bin'].inflate().split('').map(c => c.charCodeAt(0)));
	GREEN = new Uint8Array(zip.files['e9.bin'].inflate().split('').map(c => c.charCodeAt(0)));
	BLUE = new Uint8Array(zip.files['e10.bin'].inflate().split('').map(c => c.charCodeAt(0)));
	FGCOLOR = new Uint8Array(zip.files['d1.bin'].inflate().split('').map(c => c.charCodeAt(0)));
	BGCOLOR = new Uint8Array(zip.files['c9.bin'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJCOLOR = new Uint8Array(zip.files['j2.bin'].inflate().split('').map(c => c.charCodeAt(0)));
	init({
		game: new Vulgus(),
		sound: sound = [
			new AY_3_8910({clock: 1500000, resolution: 8}),
			new AY_3_8910({clock: 1500000, resolution: 8}),
		],
	});
	loop();
}
