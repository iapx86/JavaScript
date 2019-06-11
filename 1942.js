/*
 *
 *	1942
 *
 */

import AY_3_8910 from './ay-3-8910.js';
import Cpu, {init, loop} from './main.js';
import Z80 from './z80.js';
let sound;

class _1942 {
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
		this.nBonus = '1st 20000 2nd 80000 every 80000';
		this.nLife = 3;
		this.nRank = 'Normal';

		// CPU周りの初期化
		this.ram = new Uint8Array(0x1d00).addBase();
		this.ram2 = new Uint8Array(0x800).addBase();
		this.in = Uint8Array.of(0xff, 0xff, 0xff, 0xf7, 0xff);
		this.psg = [{addr: 0}, {addr: 0}];
		this.command = 0;
		this.bank = 0x80;
		this.timer = 0;

		this.cpu = new Z80(this);
		for (let i = 0; i < 0xc0; i++)
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
				this.dwScroll = this.dwScroll & 0xff00 | data;
				break;
			case 3:
				this.dwScroll = this.dwScroll & 0xff | data << 8;
				break;
			case 4:
				(data & 0x10) !== 0 ? this.cpu2.disable() : this.cpu2.enable();
				break;
			case 5:
				this.palette = data << 4 & 0x30;
				break;
			case 6:
				const bank = (data << 6 & 0xc0) + 0x80;
				if (bank === this.bank)
					break;
				for (let i = 0; i < 0x40; i++)
					this.cpu.memorymap[0x80 + i].base = PRG1.base[bank + i];
				this.bank = bank;
				break;
			}
		};
		this.cpu.memorymap[0xcc].base = this.ram.base[0];
		this.cpu.memorymap[0xcc].write = null;
		for (let i = 0; i < 0x0c; i++) {
			this.cpu.memorymap[0xd0 + i].base = this.ram.base[1 + i];
			this.cpu.memorymap[0xd0 + i].write = null;
		}
		for (let i = 0; i < 0x10; i++) {
			this.cpu.memorymap[0xe0 + i].base = this.ram.base[0x0d + i];
			this.cpu.memorymap[0xe0 + i].write = null;
		}

		this.cpu2 = new Z80(this);
		for (let i = 0; i < 0x40; i++)
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
		this.obj = new Uint8Array(0x20000);
		this.rgb = new Uint32Array(0x100);
		this.dwScroll = 0;
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
			if (i === 1)
				this.cpu.interrupt(0xcf); // RST 08H
			if ((i & 3) === 0) {
				this.timer = i >>> 2;
				this.cpu2.interrupt();
			}
			Cpu.multiple_execute([this.cpu, this.cpu2], 800);
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
				this.in[3] |= 0xc0;
				break;
			case 1:
				this.in[3] = this.in[3] & ~0xc0 | 0x80;
				break;
			case 2:
				this.in[3] = this.in[3] & ~0xc0 | 0x40;
				break;
			case 5:
				this.in[3] &= ~0xc0;
				break;
			}
			switch (this.nBonus) {
			case '1st 20000 2nd 80000 every 80000':
				this.in[3] |= 0x30;
				break;
			case '1st 20000 2nd 100000 every 100000':
				this.in[3] = this.in[3] & ~0x30 | 0x20;
				break;
			case '1st 30000 2nd 80000 every 80000':
				this.in[3] = this.in[3] & ~0x30 | 0x10;
				break;
			case '1st 30000 2nd 100000 every 100000':
				this.in[3] &= ~0x30;
				break;
			}
			switch (this.nRank) {
			case 'Normal':
				this.in[4] |= 0x60;
				break;
			case 'Easy':
				this.in[4] = this.in[4] & ~0x60 | 0x40;
				break;
			case 'Hard':
				this.in[4] = this.in[4] & ~0x60 | 0x20;
				break;
			case 'Very Hard':
				this.in[4] &= ~0x60;
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
		for (let p = 0, q = 0, i = 512; i !== 0; q += 64, --i) {
			for (let j = 0; j < 4; j++)
				for (let k = 0; k < 32; k += 2)
					this.obj[p++] = OBJ[q + k + 33] >>> (j + 4) & 1 | OBJ[q + k + 33] >>> j << 1 & 2 | OBJ[q + k + 0x8000 + 33] >>> (j + 2) & 4 | OBJ[q + k + 0x8000 + 33] >>> j << 3 & 8;
			for (let j = 0; j < 4; j++)
				for (let k = 0; k < 32; k += 2)
					this.obj[p++] = OBJ[q + k + 32] >>> (j + 4) & 1 | OBJ[q + k + 32] >>> j << 1 & 2 | OBJ[q + k + 0x8000 + 32] >>> (j + 2) & 4 | OBJ[q + k + 0x8000 + 32] >>> j << 3 & 8;
			for (let j = 0; j < 4; j++)
				for (let k = 0; k < 32; k += 2)
					this.obj[p++] = OBJ[q + k + 1] >>> (j + 4) & 1 | OBJ[q + k + 1] >>> j << 1 & 2 | OBJ[q + k + 0x8000 + 1] >>> (j + 2) & 4 | OBJ[q + k + 0x8000 + 1] >>> j << 3 & 8;
			for (let j = 0; j < 4; j++)
				for (let k = 0; k < 32; k += 2)
					this.obj[p++] = OBJ[q + k] >>> (j + 4) & 1 | OBJ[q + k] >>> j << 1 & 2 | OBJ[q + k + 0x8000] >>> (j + 2) & 4 | OBJ[q + k + 0x8000] >>> j << 3 & 8;
		}
	}

	makeBitmap(data) {
		// bg描画
		let p = 256 * 256 + 16 + (this.dwScroll & 0x0f) * 256;
		let k = this.dwScroll << 1 & 0x3e0 | 1;
		for (let i = 0; i < 17; k = k + 0x12 & 0x3ff, p -= 14 * 16 + 256 * 16, i++)
			for (let j = 0; j < 14; k++, p += 16, j++)
				this.xfer16x16x3(data, p, 0x900 + k);

		// obj描画
		for (let p = 0x7c, i = 32; i !== 0; p -= 4, --i) {
			const y = 256 - (this.ram[p + 3] | this.ram[p + 1] << 4 & 0x100) & 0x1ff;
			const x = this.ram[p + 2];
			const src = this.ram[p] & 0x7f | this.ram[p + 1] << 2 & 0x80 | this.ram[p] << 1 & 0x100 | this.ram[p + 1] << 9 & 0x1e00;
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

		if ((px = FGCOLOR[idx | this.fg[q | 0x00]]) !== 0x0f) data[p + 0x000] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x01]]) !== 0x0f) data[p + 0x001] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x02]]) !== 0x0f) data[p + 0x002] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x03]]) !== 0x0f) data[p + 0x003] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x04]]) !== 0x0f) data[p + 0x004] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x05]]) !== 0x0f) data[p + 0x005] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x06]]) !== 0x0f) data[p + 0x006] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x07]]) !== 0x0f) data[p + 0x007] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x08]]) !== 0x0f) data[p + 0x100] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x09]]) !== 0x0f) data[p + 0x101] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x0a]]) !== 0x0f) data[p + 0x102] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x0b]]) !== 0x0f) data[p + 0x103] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x0c]]) !== 0x0f) data[p + 0x104] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x0d]]) !== 0x0f) data[p + 0x105] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x0e]]) !== 0x0f) data[p + 0x106] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x0f]]) !== 0x0f) data[p + 0x107] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x10]]) !== 0x0f) data[p + 0x200] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x11]]) !== 0x0f) data[p + 0x201] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x12]]) !== 0x0f) data[p + 0x202] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x13]]) !== 0x0f) data[p + 0x203] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x14]]) !== 0x0f) data[p + 0x204] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x15]]) !== 0x0f) data[p + 0x205] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x16]]) !== 0x0f) data[p + 0x206] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x17]]) !== 0x0f) data[p + 0x207] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x18]]) !== 0x0f) data[p + 0x300] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x19]]) !== 0x0f) data[p + 0x301] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x1a]]) !== 0x0f) data[p + 0x302] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x1b]]) !== 0x0f) data[p + 0x303] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x1c]]) !== 0x0f) data[p + 0x304] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x1d]]) !== 0x0f) data[p + 0x305] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x1e]]) !== 0x0f) data[p + 0x306] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x1f]]) !== 0x0f) data[p + 0x307] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x20]]) !== 0x0f) data[p + 0x400] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x21]]) !== 0x0f) data[p + 0x401] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x22]]) !== 0x0f) data[p + 0x402] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x23]]) !== 0x0f) data[p + 0x403] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x24]]) !== 0x0f) data[p + 0x404] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x25]]) !== 0x0f) data[p + 0x405] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x26]]) !== 0x0f) data[p + 0x406] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x27]]) !== 0x0f) data[p + 0x407] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x28]]) !== 0x0f) data[p + 0x500] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x29]]) !== 0x0f) data[p + 0x501] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x2a]]) !== 0x0f) data[p + 0x502] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x2b]]) !== 0x0f) data[p + 0x503] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x2c]]) !== 0x0f) data[p + 0x504] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x2d]]) !== 0x0f) data[p + 0x505] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x2e]]) !== 0x0f) data[p + 0x506] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x2f]]) !== 0x0f) data[p + 0x507] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x30]]) !== 0x0f) data[p + 0x600] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x31]]) !== 0x0f) data[p + 0x601] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x32]]) !== 0x0f) data[p + 0x602] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x33]]) !== 0x0f) data[p + 0x603] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x34]]) !== 0x0f) data[p + 0x604] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x35]]) !== 0x0f) data[p + 0x605] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x36]]) !== 0x0f) data[p + 0x606] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x37]]) !== 0x0f) data[p + 0x607] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x38]]) !== 0x0f) data[p + 0x700] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x39]]) !== 0x0f) data[p + 0x701] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x3a]]) !== 0x0f) data[p + 0x702] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x3b]]) !== 0x0f) data[p + 0x703] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x3c]]) !== 0x0f) data[p + 0x704] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x3d]]) !== 0x0f) data[p + 0x705] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x3e]]) !== 0x0f) data[p + 0x706] = 0x80 | px;
		if ((px = FGCOLOR[idx | this.fg[q | 0x3f]]) !== 0x0f) data[p + 0x707] = 0x80 | px;
	}

	xfer16x16x3(data, p, k) {
		const idx = this.ram[k + 0x10] << 3 & 0xf8;
		let i, j, q = (this.ram[k] | this.ram[k + 0x10] << 1 & 0x100) << 8;

		switch (this.ram[k + 0x10] >>> 5 & 3) {
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
		const idx = src >>> 5 & 0xf0;
		let px, i, j;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		for (src = src << 8 & 0x1ff00, i = 16; i !== 0; dst += 256 - 16, --i)
			for (j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[src++]]) !== 0x0f)
					data[dst] = 0x40 | px;
	}
}

/*
 *
 *	1942
 *
 */

const url = '1942.zip';
let PRG1, PRG2, FG, BG, OBJ, RED, GREEN, BLUE, FGCOLOR, BGCOLOR, OBJCOLOR;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG1 = zip.files['srb-03.m3'].inflate() + zip.files['srb-04.m4'].inflate() + zip.files['srb-05.m5'].inflate() + zip.files['srb-06.m6'].inflate();
	PRG1 = new Uint8Array((PRG1 + '\xff'.repeat(0x2000) + zip.files['srb-07.m7'].inflate() + '\xff'.repeat(0x4000)).split('').map(c => c.charCodeAt(0))).addBase();
	PRG2 = new Uint8Array(zip.files['sr-01.c11'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	FG = new Uint8Array(zip.files['sr-02.f2'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	BG = zip.files['sr-08.a1'].inflate() + zip.files['sr-09.a2'].inflate() + zip.files['sr-10.a3'].inflate() + zip.files['sr-11.a4'].inflate();
	BG = new Uint8Array((BG + zip.files['sr-12.a5'].inflate() + zip.files['sr-13.a6'].inflate()).split('').map(c => c.charCodeAt(0)));
	OBJ = zip.files['sr-14.l1'].inflate() + zip.files['sr-15.l2'].inflate() + zip.files['sr-16.n1'].inflate() + zip.files['sr-17.n2'].inflate();
	OBJ = new Uint8Array(OBJ.split('').map(c => c.charCodeAt(0)));
	RED = new Uint8Array(zip.files['sb-5.e8'].inflate().split('').map(c => c.charCodeAt(0)));
	GREEN = new Uint8Array(zip.files['sb-6.e9'].inflate().split('').map(c => c.charCodeAt(0)));
	BLUE = new Uint8Array(zip.files['sb-7.e10'].inflate().split('').map(c => c.charCodeAt(0)));
	FGCOLOR = new Uint8Array(zip.files['sb-0.f1'].inflate().split('').map(c => c.charCodeAt(0)));
	BGCOLOR = new Uint8Array(zip.files['sb-4.d6'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJCOLOR = new Uint8Array(zip.files['sb-8.k3'].inflate().split('').map(c => c.charCodeAt(0)));
	init({
		game: new _1942(),
		sound: sound = [
			new AY_3_8910({clock: 1500000, resolution: 4}),
			new AY_3_8910({clock: 1500000, resolution: 4}),
		]
	});
	loop();
}

