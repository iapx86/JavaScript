/*
 *
 *	New Rally-X
 *
 */

import PacManSound from './pac-man_sound.js';
import SoundEffect from './sound_effect.js';
import {init, loop} from './main.js';
import Z80 from './z80.js';
let game, sound;

class NewRallyX {
	constructor() {
		this.cxScreen = 224;
		this.cyScreen = 285;
		this.width = 256;
		this.height = 512;
		this.xOffset = 16;
		this.yOffset = 19;
		this.fReset = false;
		this.fTest = false;
		this.fDIPSwitchChanged = true;
		this.fCoin = 0;
		this.fStart1P = 0;
		this.fStart2P = 0;
		this.dwStick = 0;
		this.abStick = Uint8Array.of(~0, ~1, ~2, ~0, ~4, ~4, ~2, ~4, ~8, ~1, ~8, ~8, ~0, ~1, ~2, ~0);
		this.nMyCar = 3;
//		this.nRank = 'A';
		this.nBonus = 'A';

		// CPU周りの初期化
		this.fInterrupt = false;
		this.fSoundEnable = false;

		this.ram = new Uint8Array(0x1800).addBase();
		this.mmi = new Uint8Array(0x200).fill(0xff).addBase();
		this.mmo = new Uint8Array(0x200);
		this.adwCount = new Uint8Array(8);
		this.mmi[0x100] = 0xc5;
		this.vector = 0;

		this.cpu = new Z80(this);
		for (let i = 0; i < 0x40; i++)
			this.cpu.memorymap[i].base = PRG.base[i];
		for (let i = 0; i < 0x10; i++) {
			this.cpu.memorymap[0x80 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x80 + i].write = null;
		}
		for (let i = 0; i < 0x08; i++) {
			this.cpu.memorymap[0x98 + i].base = this.ram.base[0x10 + i];
			this.cpu.memorymap[0x98 + i].write = null;
		}
		for (let i = 0; i < 0x02; i++) {
			this.cpu.memorymap[0xa0 + i].base = this.mmi.base[i];
			this.cpu.memorymap[0xa0 + i].write = systemcontrolarea;
		}
		for (let i = 0; i < 0x100; i++)
			this.cpu.iomap[i].write = (addr, data) => void((addr & 0xff) === 0 && (this.vector = data));

		this.cpu.breakpoint = hookBreakPoint;
		this.cpu.set_breakpoint(0x0d39);
		this.cpu.set_breakpoint(0x1886);

		// Videoの初期化
		this.bg = new Uint8Array(0x4000);
		this.obj = new Uint8Array(0x4000);
		this.color = Uint8Array.from(COLOR, e => e & 0xf);
		this.rgb = new Uint32Array(0x20);
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();

		// 効果音の初期化
		this.se = [{buf: BANG, loop: false, start: false, stop: false}];

		// ライトハンドラ
		function systemcontrolarea(addr, data, game) {
			switch (addr >> 4 & 0xfff) {
			case 0xa10:
			case 0xa11:
				sound[0].write(addr, data);
				break;
			case 0xa18:
				switch (addr & 0xf) {
				case 0:
					if (data === 0xff)
						game.se[0].start = game.se[0].stop = true;
					break;
				case 1:
					game.fInterrupt = (data & 1) !== 0;
					break;
				case 2:
					game.fSoundEnable = (data & 1) !== 0;
					break;
				}
				game.mmo[addr & 0x1ff] = data;
				break;
			default:
				game.mmo[addr & 0x1ff] = data;
				break;
			}
		}

		// ブレークポイントコールバック
		function hookBreakPoint(addr, game) {
			switch (addr) {
			case 0x0d39:
				if (!game.adwCount[(this.ixl | this.ixh << 8) - 0x8088 >> 5])
					game.adwCount[(this.ixl | this.ixh << 8) - 0x8088 >> 5] = 0x88;
				break;
			case 0x1886:
				if (!game.adwCount[(this.ixl | this.ixh << 8) - 0x8088 >> 5])
					game.adwCount[(this.ixl | this.ixh << 8) - 0x8088 >> 5] = 0x20;
				break;
			}
		}
	}

	execute() {
//		sound[0].mute(!this.fSoundEnable);
		while (this.fInterrupt && !this.cpu.interrupt(this.vector))
			this.cpu.execute(0x10);
		this.cpu.execute(0x2400);
		return this;
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// DIPスイッチの更新
		if (this.fDIPSwitchChanged) {
			this.fDIPSwitchChanged = false;
			switch (this.nMyCar) {
			case 3:
				this.mmi[0x100] &= ~8;
				break;
			case 4:
				this.mmi[0x100] |= 8;
				break;
			}
			switch (this.nBonus) {
			case 'NOTHING':
				this.mmi[0x100] &= ~6;
				break;
			case 'A':
				this.mmi[0x100] = this.mmi[0x100] & ~6 | 2;
				break;
			case 'B':
				this.mmi[0x100] = this.mmi[0x100] & ~6 | 4;
				break;
			case 'C':
				this.mmi[0x100] |= 6;
				break;
			}
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.mmi[0x100] &= ~1;
		else
			this.mmi[0x100] |= 1;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.adwCount.fill(0);
			this.cpu.reset();
		}

		for (let i = 0; i < 8; i++) {
			if (!this.adwCount[i] || --this.adwCount[i] || !this.ram[0x88 + i * 0x20])
				continue;
			this.ram[0x88 + i * 0x20] = this.ram[0x88 + 0x15 + i * 0x20] ? 1 : 0xff;
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if (this.fCoin) {
			--this.fCoin;
			this.mmi[0] &= ~(1 << 7);
		}
		else
			this.mmi[0] |= 1 << 7;
		if (this.fStart1P) {
			--this.fStart1P;
			this.mmi[0] &= ~(1 << 6);
		}
		else
			this.mmi[0] |= 1 << 6;
		if (this.fStart2P) {
			--this.fStart2P;
			this.mmi[0x80] &= ~(1 << 6);
		}
		else
			this.mmi[0x80] |= 1 << 6;

		this.mmi[0] = this.mmi[0] & 0xc3 | this.abStick[this.dwStick] << 2 & 0x3c;
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
			this.dwStick = this.dwStick & ~(1 << 2) | 1 << 3;
		else
			this.dwStick &= ~(1 << 3);
	}

	right(fDown) {
		if (fDown)
			this.dwStick = this.dwStick & ~(1 << 0) | 1 << 1;
		else
			this.dwStick &= ~(1 << 1);
	}

	down(fDown) {
		if (fDown)
			this.dwStick = this.dwStick & ~(1 << 3) | 1 << 2;
		else
			this.dwStick &= ~(1 << 2);
	}

	left(fDown) {
		if (fDown)
			this.dwStick = this.dwStick & ~(1 << 1) | 1 << 0;
		else
			this.dwStick &= ~(1 << 0);
	}

	triggerA(fDown) {
		if (fDown)
			this.mmi[0] &= ~(1 << 1);
		else
			this.mmi[0] |= 1 << 1;
	}

	triggerB(fDown) {
	}

	convertRGB() {
		for (let i = 0; i < 0x20; i++)
			this.rgb[i] = (RGB[i] & 7) * 255 / 7	// Red
				| (RGB[i] >> 3 & 7) * 255 / 7 << 8	// Green
				| (RGB[i] >> 6) * 255 / 3 << 16		// Blue
				| 0xff000000;						// Alpha
	}

	convertBG() {
		const BG = BGOBJ;
		for (let p = 0, q = 0, i = 256; i !== 0; q += 16, --i) {
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k + 8] >> j & 1 | BG[q + k + 8] >> (j + 3) & 2;
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k] >> j & 1 | BG[q + k] >> (j + 3) & 2;
		}
	}

	convertOBJ() {
		const OBJ = BGOBJ;
		for (let p = 0, q = 0, i = 64; i !== 0; q += 64, --i) {
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 40] >> j & 1 | OBJ[q + k + 40] >> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 8] >> j & 1 | OBJ[q + k + 8] >> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 48] >> j & 1 | OBJ[q + k + 48] >> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 16] >> j & 1 | OBJ[q + k + 16] >> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 56] >> j & 1 | OBJ[q + k + 56] >> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 24] >> j & 1 | OBJ[q + k + 24] >> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 32] >> j & 1 | OBJ[q + k + 32] >> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k] >> j & 1 | OBJ[q + k] >> (j + 3) & 2;
			}
		}
	}

	makeBitmap(data) {
		// bg描画
		this.drawBG(data, 0);

		// obj描画
		for (let k = 0x001e, i = 6; i !== 0; k -= 2, --i) {
			if (this.ram[k] < 0xe0)
				continue;
			const x = -1 + this.ram[k + 0x800] & 0xff;
			const y = this.ram[k + 1] - (this.ram[k + 0x801] << 1 & 0x100) + 16 & 0x1ff;
			const src = this.ram[k] | this.ram[k + 0x801] << 8;
			switch (this.ram[k] & 3) {
			case 0: // ノーマル
				this.xfer16x16(data, x | y << 8, src);
				break;
			case 1: // V反転
				this.xfer16x16V(data, x | y << 8, src);
				break;
			case 2: // H反転
				this.xfer16x16H(data, x | y << 8, src);
				break;
			case 3: // HV反転
				this.xfer16x16HV(data, x | y << 8, src);
				break;
			}
		}

		// bg描画
		this.drawBG(data, 1);

		// レーダー描画
		for (let k = 0x3c, i = 9; i !== 0; --k, --i) {
			if (this.ram[k + 0x800] === 0)
				continue;
			const x = 1 + this.ram[k + 0x800] & 0xff;
			const y = this.ram[k] + 32 & 0xff;
			if (x <= 12 || x >= 240 || y >= 64)
				continue;
			this.xfer4x4(data, (x | y << 8) + 240 * 0x100, k);
		}

		// palette変換
		let p = 256 * 19 + 16;
		for (let i = 0; i < 285; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] = this.rgb[data[p]];
	}

	drawBG(data, pri) {
		// スクロール部
		let p = 256 * (8 * 2 + 3) + 232 + (this.mmo[0x140] & 7) - (this.mmo[0x130] & 7) * 256;
		let k = 0x400 + (this.mmo[0x140] + 0x10 << 2 & 0x3e0 | this.mmo[0x130] >> 3);
		for (let i = 0; i < 29; k = k + 3 & 0x1f | k + 0x20 & 0x3e0 | 0x400, p -= 256 * 8 * 29 + 8, i++)
			for (let j = 0; j < 29; k = k + 1 & 0x1f | k & 0x7e0, p += 256 * 8, j++)
				this.xfer8x8(data, p, k, pri);

		// FIX部分
		p = 256 * 8 * 34 + 232;
		k = 0x0040;
		for (let i = 0; i < 28; k += 24, p -= 8, i++) {
			for (let j = 0; j < 4; k++, p += 256 * 8, j++)
				this.xfer8x8(data, p, k, pri);
			p -= 256 * 8 * 8;
			for (let j = 0; j < 4; k++, p += 256 * 8, j++)
				this.xfer8x8(data, p, k, pri);
		}
	}

	xfer4x4(data, p, k) {
		switch (this.mmo[k - 0x30] >> 1 & 7) {
		case 0:
			data[p + 0x000] = data[p + 0x001] = data[p + 0x002] = data[p + 0x003] = 0x12;
			data[p + 0x100] = data[p + 0x103] = data[p + 0x200] = data[p + 0x203] = 0x12;
			data[p + 0x101] = data[p + 0x102] = data[p + 0x201] = data[p + 0x202] = 0x11;
			data[p + 0x300] = data[p + 0x301] = data[p + 0x302] = data[p + 0x303] = 0x12;
			break;
		case 1:
			// 透明
			break;
		case 2:
			data[p + 0x000] = data[p + 0x001] = data[p + 0x002] = data[p + 0x003] = 0x11;
			data[p + 0x100] = data[p + 0x103] = data[p + 0x200] = data[p + 0x203] = 0x11;
			data[p + 0x101] = data[p + 0x102] = data[p + 0x201] = data[p + 0x202] = 0x11;
			data[p + 0x300] = data[p + 0x301] = data[p + 0x302] = data[p + 0x303] = 0x11;
			break;
		case 3:
			data[p + 0x000] = data[p + 0x001] = data[p + 0x002] = data[p + 0x003] = 0x12;
			data[p + 0x100] = data[p + 0x103] = data[p + 0x200] = data[p + 0x203] = 0x12;
			data[p + 0x101] = data[p + 0x102] = data[p + 0x201] = data[p + 0x202] = 0x12;
			data[p + 0x300] = data[p + 0x301] = data[p + 0x302] = data[p + 0x303] = 0x12;
			break;
		case 4:
			data[p + 0x000] = data[p + 0x001] = 0x10;
			data[p + 0x100] = data[p + 0x101] = 0x10;
			break;
		case 5:
			// 透明
			break;
		case 6:
			data[p + 0x000] = data[p + 0x001] = 0x11;
			data[p + 0x100] = data[p + 0x101] = 0x11;
			break;
		case 7:
			data[p + 0x000] = data[p + 0x001] = 0x12;
			data[p + 0x100] = data[p + 0x101] = 0x12;
			break;
		}
	}

	xfer8x8(data, p, k, pri) {
		const q = this.ram[k] << 6, idx = this.ram[k + 0x800] << 2 & 0xfc;

		if ((this.ram[k + 0x800] >> 5 & 1) !== pri)
			return;
		switch (this.ram[k + 0x800] >> 6) {
		case 0: // V反転
			data[p + 0x000] = this.color[idx | this.bg[q | 0x38]];
			data[p + 0x001] = this.color[idx | this.bg[q | 0x39]];
			data[p + 0x002] = this.color[idx | this.bg[q | 0x3a]];
			data[p + 0x003] = this.color[idx | this.bg[q | 0x3b]];
			data[p + 0x004] = this.color[idx | this.bg[q | 0x3c]];
			data[p + 0x005] = this.color[idx | this.bg[q | 0x3d]];
			data[p + 0x006] = this.color[idx | this.bg[q | 0x3e]];
			data[p + 0x007] = this.color[idx | this.bg[q | 0x3f]];
			data[p + 0x100] = this.color[idx | this.bg[q | 0x30]];
			data[p + 0x101] = this.color[idx | this.bg[q | 0x31]];
			data[p + 0x102] = this.color[idx | this.bg[q | 0x32]];
			data[p + 0x103] = this.color[idx | this.bg[q | 0x33]];
			data[p + 0x104] = this.color[idx | this.bg[q | 0x34]];
			data[p + 0x105] = this.color[idx | this.bg[q | 0x35]];
			data[p + 0x106] = this.color[idx | this.bg[q | 0x36]];
			data[p + 0x107] = this.color[idx | this.bg[q | 0x37]];
			data[p + 0x200] = this.color[idx | this.bg[q | 0x28]];
			data[p + 0x201] = this.color[idx | this.bg[q | 0x29]];
			data[p + 0x202] = this.color[idx | this.bg[q | 0x2a]];
			data[p + 0x203] = this.color[idx | this.bg[q | 0x2b]];
			data[p + 0x204] = this.color[idx | this.bg[q | 0x2c]];
			data[p + 0x205] = this.color[idx | this.bg[q | 0x2d]];
			data[p + 0x206] = this.color[idx | this.bg[q | 0x2e]];
			data[p + 0x207] = this.color[idx | this.bg[q | 0x2f]];
			data[p + 0x300] = this.color[idx | this.bg[q | 0x20]];
			data[p + 0x301] = this.color[idx | this.bg[q | 0x21]];
			data[p + 0x302] = this.color[idx | this.bg[q | 0x22]];
			data[p + 0x303] = this.color[idx | this.bg[q | 0x23]];
			data[p + 0x304] = this.color[idx | this.bg[q | 0x24]];
			data[p + 0x305] = this.color[idx | this.bg[q | 0x25]];
			data[p + 0x306] = this.color[idx | this.bg[q | 0x26]];
			data[p + 0x307] = this.color[idx | this.bg[q | 0x27]];
			data[p + 0x400] = this.color[idx | this.bg[q | 0x18]];
			data[p + 0x401] = this.color[idx | this.bg[q | 0x19]];
			data[p + 0x402] = this.color[idx | this.bg[q | 0x1a]];
			data[p + 0x403] = this.color[idx | this.bg[q | 0x1b]];
			data[p + 0x404] = this.color[idx | this.bg[q | 0x1c]];
			data[p + 0x405] = this.color[idx | this.bg[q | 0x1d]];
			data[p + 0x406] = this.color[idx | this.bg[q | 0x1e]];
			data[p + 0x407] = this.color[idx | this.bg[q | 0x1f]];
			data[p + 0x500] = this.color[idx | this.bg[q | 0x10]];
			data[p + 0x501] = this.color[idx | this.bg[q | 0x11]];
			data[p + 0x502] = this.color[idx | this.bg[q | 0x12]];
			data[p + 0x503] = this.color[idx | this.bg[q | 0x13]];
			data[p + 0x504] = this.color[idx | this.bg[q | 0x14]];
			data[p + 0x505] = this.color[idx | this.bg[q | 0x15]];
			data[p + 0x506] = this.color[idx | this.bg[q | 0x16]];
			data[p + 0x507] = this.color[idx | this.bg[q | 0x17]];
			data[p + 0x600] = this.color[idx | this.bg[q | 0x08]];
			data[p + 0x601] = this.color[idx | this.bg[q | 0x09]];
			data[p + 0x602] = this.color[idx | this.bg[q | 0x0a]];
			data[p + 0x603] = this.color[idx | this.bg[q | 0x0b]];
			data[p + 0x604] = this.color[idx | this.bg[q | 0x0c]];
			data[p + 0x605] = this.color[idx | this.bg[q | 0x0d]];
			data[p + 0x606] = this.color[idx | this.bg[q | 0x0e]];
			data[p + 0x607] = this.color[idx | this.bg[q | 0x0f]];
			data[p + 0x700] = this.color[idx | this.bg[q | 0x00]];
			data[p + 0x701] = this.color[idx | this.bg[q | 0x01]];
			data[p + 0x702] = this.color[idx | this.bg[q | 0x02]];
			data[p + 0x703] = this.color[idx | this.bg[q | 0x03]];
			data[p + 0x704] = this.color[idx | this.bg[q | 0x04]];
			data[p + 0x705] = this.color[idx | this.bg[q | 0x05]];
			data[p + 0x706] = this.color[idx | this.bg[q | 0x06]];
			data[p + 0x707] = this.color[idx | this.bg[q | 0x07]];
			break;
		case 1: // ノーマル
			data[p + 0x000] = this.color[idx | this.bg[q | 0x00]];
			data[p + 0x001] = this.color[idx | this.bg[q | 0x01]];
			data[p + 0x002] = this.color[idx | this.bg[q | 0x02]];
			data[p + 0x003] = this.color[idx | this.bg[q | 0x03]];
			data[p + 0x004] = this.color[idx | this.bg[q | 0x04]];
			data[p + 0x005] = this.color[idx | this.bg[q | 0x05]];
			data[p + 0x006] = this.color[idx | this.bg[q | 0x06]];
			data[p + 0x007] = this.color[idx | this.bg[q | 0x07]];
			data[p + 0x100] = this.color[idx | this.bg[q | 0x08]];
			data[p + 0x101] = this.color[idx | this.bg[q | 0x09]];
			data[p + 0x102] = this.color[idx | this.bg[q | 0x0a]];
			data[p + 0x103] = this.color[idx | this.bg[q | 0x0b]];
			data[p + 0x104] = this.color[idx | this.bg[q | 0x0c]];
			data[p + 0x105] = this.color[idx | this.bg[q | 0x0d]];
			data[p + 0x106] = this.color[idx | this.bg[q | 0x0e]];
			data[p + 0x107] = this.color[idx | this.bg[q | 0x0f]];
			data[p + 0x200] = this.color[idx | this.bg[q | 0x10]];
			data[p + 0x201] = this.color[idx | this.bg[q | 0x11]];
			data[p + 0x202] = this.color[idx | this.bg[q | 0x12]];
			data[p + 0x203] = this.color[idx | this.bg[q | 0x13]];
			data[p + 0x204] = this.color[idx | this.bg[q | 0x14]];
			data[p + 0x205] = this.color[idx | this.bg[q | 0x15]];
			data[p + 0x206] = this.color[idx | this.bg[q | 0x16]];
			data[p + 0x207] = this.color[idx | this.bg[q | 0x17]];
			data[p + 0x300] = this.color[idx | this.bg[q | 0x18]];
			data[p + 0x301] = this.color[idx | this.bg[q | 0x19]];
			data[p + 0x302] = this.color[idx | this.bg[q | 0x1a]];
			data[p + 0x303] = this.color[idx | this.bg[q | 0x1b]];
			data[p + 0x304] = this.color[idx | this.bg[q | 0x1c]];
			data[p + 0x305] = this.color[idx | this.bg[q | 0x1d]];
			data[p + 0x306] = this.color[idx | this.bg[q | 0x1e]];
			data[p + 0x307] = this.color[idx | this.bg[q | 0x1f]];
			data[p + 0x400] = this.color[idx | this.bg[q | 0x20]];
			data[p + 0x401] = this.color[idx | this.bg[q | 0x21]];
			data[p + 0x402] = this.color[idx | this.bg[q | 0x22]];
			data[p + 0x403] = this.color[idx | this.bg[q | 0x23]];
			data[p + 0x404] = this.color[idx | this.bg[q | 0x24]];
			data[p + 0x405] = this.color[idx | this.bg[q | 0x25]];
			data[p + 0x406] = this.color[idx | this.bg[q | 0x26]];
			data[p + 0x407] = this.color[idx | this.bg[q | 0x27]];
			data[p + 0x500] = this.color[idx | this.bg[q | 0x28]];
			data[p + 0x501] = this.color[idx | this.bg[q | 0x29]];
			data[p + 0x502] = this.color[idx | this.bg[q | 0x2a]];
			data[p + 0x503] = this.color[idx | this.bg[q | 0x2b]];
			data[p + 0x504] = this.color[idx | this.bg[q | 0x2c]];
			data[p + 0x505] = this.color[idx | this.bg[q | 0x2d]];
			data[p + 0x506] = this.color[idx | this.bg[q | 0x2e]];
			data[p + 0x507] = this.color[idx | this.bg[q | 0x2f]];
			data[p + 0x600] = this.color[idx | this.bg[q | 0x30]];
			data[p + 0x601] = this.color[idx | this.bg[q | 0x31]];
			data[p + 0x602] = this.color[idx | this.bg[q | 0x32]];
			data[p + 0x603] = this.color[idx | this.bg[q | 0x33]];
			data[p + 0x604] = this.color[idx | this.bg[q | 0x34]];
			data[p + 0x605] = this.color[idx | this.bg[q | 0x35]];
			data[p + 0x606] = this.color[idx | this.bg[q | 0x36]];
			data[p + 0x607] = this.color[idx | this.bg[q | 0x37]];
			data[p + 0x700] = this.color[idx | this.bg[q | 0x38]];
			data[p + 0x701] = this.color[idx | this.bg[q | 0x39]];
			data[p + 0x702] = this.color[idx | this.bg[q | 0x3a]];
			data[p + 0x703] = this.color[idx | this.bg[q | 0x3b]];
			data[p + 0x704] = this.color[idx | this.bg[q | 0x3c]];
			data[p + 0x705] = this.color[idx | this.bg[q | 0x3d]];
			data[p + 0x706] = this.color[idx | this.bg[q | 0x3e]];
			data[p + 0x707] = this.color[idx | this.bg[q | 0x3f]];
			break;
		case 2: // HV反転
			data[p + 0x000] = this.color[idx | this.bg[q | 0x3f]];
			data[p + 0x001] = this.color[idx | this.bg[q | 0x3e]];
			data[p + 0x002] = this.color[idx | this.bg[q | 0x3d]];
			data[p + 0x003] = this.color[idx | this.bg[q | 0x3c]];
			data[p + 0x004] = this.color[idx | this.bg[q | 0x3b]];
			data[p + 0x005] = this.color[idx | this.bg[q | 0x3a]];
			data[p + 0x006] = this.color[idx | this.bg[q | 0x39]];
			data[p + 0x007] = this.color[idx | this.bg[q | 0x38]];
			data[p + 0x100] = this.color[idx | this.bg[q | 0x37]];
			data[p + 0x101] = this.color[idx | this.bg[q | 0x36]];
			data[p + 0x102] = this.color[idx | this.bg[q | 0x35]];
			data[p + 0x103] = this.color[idx | this.bg[q | 0x34]];
			data[p + 0x104] = this.color[idx | this.bg[q | 0x33]];
			data[p + 0x105] = this.color[idx | this.bg[q | 0x32]];
			data[p + 0x106] = this.color[idx | this.bg[q | 0x31]];
			data[p + 0x107] = this.color[idx | this.bg[q | 0x30]];
			data[p + 0x200] = this.color[idx | this.bg[q | 0x2f]];
			data[p + 0x201] = this.color[idx | this.bg[q | 0x2e]];
			data[p + 0x202] = this.color[idx | this.bg[q | 0x2d]];
			data[p + 0x203] = this.color[idx | this.bg[q | 0x2c]];
			data[p + 0x204] = this.color[idx | this.bg[q | 0x2b]];
			data[p + 0x205] = this.color[idx | this.bg[q | 0x2a]];
			data[p + 0x206] = this.color[idx | this.bg[q | 0x29]];
			data[p + 0x207] = this.color[idx | this.bg[q | 0x28]];
			data[p + 0x300] = this.color[idx | this.bg[q | 0x27]];
			data[p + 0x301] = this.color[idx | this.bg[q | 0x26]];
			data[p + 0x302] = this.color[idx | this.bg[q | 0x25]];
			data[p + 0x303] = this.color[idx | this.bg[q | 0x24]];
			data[p + 0x304] = this.color[idx | this.bg[q | 0x23]];
			data[p + 0x305] = this.color[idx | this.bg[q | 0x22]];
			data[p + 0x306] = this.color[idx | this.bg[q | 0x21]];
			data[p + 0x307] = this.color[idx | this.bg[q | 0x20]];
			data[p + 0x400] = this.color[idx | this.bg[q | 0x1f]];
			data[p + 0x401] = this.color[idx | this.bg[q | 0x1e]];
			data[p + 0x402] = this.color[idx | this.bg[q | 0x1d]];
			data[p + 0x403] = this.color[idx | this.bg[q | 0x1c]];
			data[p + 0x404] = this.color[idx | this.bg[q | 0x1b]];
			data[p + 0x405] = this.color[idx | this.bg[q | 0x1a]];
			data[p + 0x406] = this.color[idx | this.bg[q | 0x19]];
			data[p + 0x407] = this.color[idx | this.bg[q | 0x18]];
			data[p + 0x500] = this.color[idx | this.bg[q | 0x17]];
			data[p + 0x501] = this.color[idx | this.bg[q | 0x16]];
			data[p + 0x502] = this.color[idx | this.bg[q | 0x15]];
			data[p + 0x503] = this.color[idx | this.bg[q | 0x14]];
			data[p + 0x504] = this.color[idx | this.bg[q | 0x13]];
			data[p + 0x505] = this.color[idx | this.bg[q | 0x12]];
			data[p + 0x506] = this.color[idx | this.bg[q | 0x11]];
			data[p + 0x507] = this.color[idx | this.bg[q | 0x10]];
			data[p + 0x600] = this.color[idx | this.bg[q | 0x0f]];
			data[p + 0x601] = this.color[idx | this.bg[q | 0x0e]];
			data[p + 0x602] = this.color[idx | this.bg[q | 0x0d]];
			data[p + 0x603] = this.color[idx | this.bg[q | 0x0c]];
			data[p + 0x604] = this.color[idx | this.bg[q | 0x0b]];
			data[p + 0x605] = this.color[idx | this.bg[q | 0x0a]];
			data[p + 0x606] = this.color[idx | this.bg[q | 0x09]];
			data[p + 0x607] = this.color[idx | this.bg[q | 0x08]];
			data[p + 0x700] = this.color[idx | this.bg[q | 0x07]];
			data[p + 0x701] = this.color[idx | this.bg[q | 0x06]];
			data[p + 0x702] = this.color[idx | this.bg[q | 0x05]];
			data[p + 0x703] = this.color[idx | this.bg[q | 0x04]];
			data[p + 0x704] = this.color[idx | this.bg[q | 0x03]];
			data[p + 0x705] = this.color[idx | this.bg[q | 0x02]];
			data[p + 0x706] = this.color[idx | this.bg[q | 0x01]];
			data[p + 0x707] = this.color[idx | this.bg[q | 0x00]];
			break;
		case 3: // H反転
			data[p + 0x000] = this.color[idx | this.bg[q | 0x07]];
			data[p + 0x001] = this.color[idx | this.bg[q | 0x06]];
			data[p + 0x002] = this.color[idx | this.bg[q | 0x05]];
			data[p + 0x003] = this.color[idx | this.bg[q | 0x04]];
			data[p + 0x004] = this.color[idx | this.bg[q | 0x03]];
			data[p + 0x005] = this.color[idx | this.bg[q | 0x02]];
			data[p + 0x006] = this.color[idx | this.bg[q | 0x01]];
			data[p + 0x007] = this.color[idx | this.bg[q | 0x00]];
			data[p + 0x100] = this.color[idx | this.bg[q | 0x0f]];
			data[p + 0x101] = this.color[idx | this.bg[q | 0x0e]];
			data[p + 0x102] = this.color[idx | this.bg[q | 0x0d]];
			data[p + 0x103] = this.color[idx | this.bg[q | 0x0c]];
			data[p + 0x104] = this.color[idx | this.bg[q | 0x0b]];
			data[p + 0x105] = this.color[idx | this.bg[q | 0x0a]];
			data[p + 0x106] = this.color[idx | this.bg[q | 0x09]];
			data[p + 0x107] = this.color[idx | this.bg[q | 0x08]];
			data[p + 0x200] = this.color[idx | this.bg[q | 0x17]];
			data[p + 0x201] = this.color[idx | this.bg[q | 0x16]];
			data[p + 0x202] = this.color[idx | this.bg[q | 0x15]];
			data[p + 0x203] = this.color[idx | this.bg[q | 0x14]];
			data[p + 0x204] = this.color[idx | this.bg[q | 0x13]];
			data[p + 0x205] = this.color[idx | this.bg[q | 0x12]];
			data[p + 0x206] = this.color[idx | this.bg[q | 0x11]];
			data[p + 0x207] = this.color[idx | this.bg[q | 0x10]];
			data[p + 0x300] = this.color[idx | this.bg[q | 0x1f]];
			data[p + 0x301] = this.color[idx | this.bg[q | 0x1e]];
			data[p + 0x302] = this.color[idx | this.bg[q | 0x1d]];
			data[p + 0x303] = this.color[idx | this.bg[q | 0x1c]];
			data[p + 0x304] = this.color[idx | this.bg[q | 0x1b]];
			data[p + 0x305] = this.color[idx | this.bg[q | 0x1a]];
			data[p + 0x306] = this.color[idx | this.bg[q | 0x19]];
			data[p + 0x307] = this.color[idx | this.bg[q | 0x18]];
			data[p + 0x400] = this.color[idx | this.bg[q | 0x27]];
			data[p + 0x401] = this.color[idx | this.bg[q | 0x26]];
			data[p + 0x402] = this.color[idx | this.bg[q | 0x25]];
			data[p + 0x403] = this.color[idx | this.bg[q | 0x24]];
			data[p + 0x404] = this.color[idx | this.bg[q | 0x23]];
			data[p + 0x405] = this.color[idx | this.bg[q | 0x22]];
			data[p + 0x406] = this.color[idx | this.bg[q | 0x21]];
			data[p + 0x407] = this.color[idx | this.bg[q | 0x20]];
			data[p + 0x500] = this.color[idx | this.bg[q | 0x2f]];
			data[p + 0x501] = this.color[idx | this.bg[q | 0x2e]];
			data[p + 0x502] = this.color[idx | this.bg[q | 0x2d]];
			data[p + 0x503] = this.color[idx | this.bg[q | 0x2c]];
			data[p + 0x504] = this.color[idx | this.bg[q | 0x2b]];
			data[p + 0x505] = this.color[idx | this.bg[q | 0x2a]];
			data[p + 0x506] = this.color[idx | this.bg[q | 0x29]];
			data[p + 0x507] = this.color[idx | this.bg[q | 0x28]];
			data[p + 0x600] = this.color[idx | this.bg[q | 0x37]];
			data[p + 0x601] = this.color[idx | this.bg[q | 0x36]];
			data[p + 0x602] = this.color[idx | this.bg[q | 0x35]];
			data[p + 0x603] = this.color[idx | this.bg[q | 0x34]];
			data[p + 0x604] = this.color[idx | this.bg[q | 0x33]];
			data[p + 0x605] = this.color[idx | this.bg[q | 0x32]];
			data[p + 0x606] = this.color[idx | this.bg[q | 0x31]];
			data[p + 0x607] = this.color[idx | this.bg[q | 0x30]];
			data[p + 0x700] = this.color[idx | this.bg[q | 0x3f]];
			data[p + 0x701] = this.color[idx | this.bg[q | 0x3e]];
			data[p + 0x702] = this.color[idx | this.bg[q | 0x3d]];
			data[p + 0x703] = this.color[idx | this.bg[q | 0x3c]];
			data[p + 0x704] = this.color[idx | this.bg[q | 0x3b]];
			data[p + 0x705] = this.color[idx | this.bg[q | 0x3a]];
			data[p + 0x706] = this.color[idx | this.bg[q | 0x39]];
			data[p + 0x707] = this.color[idx | this.bg[q | 0x38]];
			break;
		}
	}

	xfer16x16(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) < 4 * 0x100 || dst >= 304 * 0x100)
			return;
		src = src << 6 & 0x3f00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.color[idx | this.obj[src++]]) !== 0)
					data[dst] = px;
	}

	xfer16x16V(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) < 4 * 0x100 || dst >= 304 * 0x100)
			return;
		src = (src << 6 & 0x3f00) + 256 - 16;
		for (let i = 16; i !== 0; src -= 32, dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.color[idx | this.obj[src++]]) !== 0)
					data[dst] = px;
	}

	xfer16x16H(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) < 4 * 0x100 || dst >= 304 * 0x100)
			return;
		src = (src << 6 & 0x3f00) + 16;
		for (let i = 16; i !== 0; src += 32, dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.color[idx | this.obj[--src]]) !== 0)
					data[dst] = px;
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) < 4 * 0x100 || dst >= 304 * 0x100)
			return;
		src = (src << 6 & 0x3f00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.color[idx | this.obj[--src]]) !== 0)
					data[dst] = px;
	}
}

/*
 *
 *	New Rally-X
 *
 */

const BANG = new Int16Array(new Uint8Array(window.atob('\
Lf9t/ib+/f0N/rD+KATG/MbpoOCA2nPWhdNb0brPfs57zaLM+stay+TKW8rRyX3DgMXl0EfhpfaXCjYWBh5xI2UnXCqeLGQuBDBFMVY3Qy1HMQgzgzSWNXg2\
Yzd0OJY+MDaxKGwQCAe3BsgL3RMPIvks9ynAH5AR5P7X7p7hsuH1597x0f2eCjIb/CPdKdgtozCtMi00WjVHNvw2nDcbOJM4BzlaOcY5ZTpKRAw20hvMARLz\
TumO4rzdKtpu10HVgdMB0r/Qqc+yzsjN9cw4zHTL0sowyqDJHMmWyCDIssdNx+3GlMZCxvvFnMX/w7DBBsbby2fR8PGgBAQROxkLH0AjcSbdKNkqcyzXLQ4v\
HzAQMe4xvzJ6MyI0yDRdNe01bTbuNjw3jzd5NxRDgjkWKP0LIvkZ7fHkTN8k2wfYPtPf14XUpdL+0LjPp87JzfLMMszTxKjIdtnZ5M7mAuSd3i7YtNJczyDN\
9cIcx0zUaea4AakPFxmGHzEmxyhNJ4ojmh4ZGVYTmQ0pCAsDTv4O+jL2yPC86gbzLAoOGAAh5yYFK/AtFTC2MQczETTtNK81VTbqNmo32jcsOJA41DhYP0c7\
njGnJPUVXQbe9E7qEeMD3k7actdB1XbT/tG50J7Pm862zezMJcyRy+fKXMrlvnXKMd68/TwNkRd2Hl4j8yajKbMrUS2pLs4vxTCoMWoyHDO+M1Q03DRWNdM1\
QjaiNgU3WTenN/U3NzhrOKo43jgTOUE5ZDlTOWo52jiZRqo4AxzfAbbytOjP4dPcH9lP1gbUMdKd0EzPFM4gzSTMMctWyobJzcggyHbH2MZYxuDFZ8XqxO6+\
ycMOzVzdouoF7EHnqt5o1NnOMMu6yATH2sXrxBrEV7zZv3LM2d26+BoHcw0ND8MNowfFAncNFRnPH1MkmicJKvArai2wLr8vuDCEMSkyzjIhM807pzWQKawZ\
jQem83Lo2eCT28PX69TA0gfRos91zmbNX8wxxV/H4dJN42P5AAwaF3seniNIJwEqEyywLQkvIDAdMf8xCzNANoE4RC8rIWwQ4/ra7LLjed0O2c/VXNNj0djP\
V87qynLHpM+V3DzsTv8ZEAwaqiBBJZMoCSvoLGUuoi+iMHgxQDLwMl8z5jMeNNk+iTdpJ58Or/jE6yHjKt3f2MXVUdNs0drPhs65zC7IgsxV1BLeNvCL9fTx\
IumW3MbVLtE8yD3Lh9P43hzs7fmpC1UWhh1zIg8msyjEKmosvS3XLtMvsDBzMSsy3TLFM7Q2kTtRLmIZbf3K7gTlZN6q2TbWl9ON0fLPms5yzXLMlMvMyhTK\
bMnSyEHIusfmxqzEc7280AXiqO6k+CQBpgh7D8MVyBvtIdMlsijXKoos5y0ZLxgw9zC4MXUyHzO0M0Y00TRPNcE1LzaJNuc2IjdpN4Y3Ez0qOT4xwCbrGpUO\
JQI19SXpd+EI2SPU19lH5GPxtP+UEsEchyMTKC4reC0VL2Y2azPzKbgccQ2l+8brROLP2znX3dNN0VHPu81kzDvLQcpdyZLI5Mc+x6fGHMaWxQHFLcSmvqy9\
DcyW42n9fwvkFD4b0R8yI8MlxidvKb8q8iv8LN0tsS53LyIwyTBfMeExbTLiMlQzzjMZNIs0+TSZPqMyPhkpBLz3EfBJ6znoXOYk5V/k++Ov45XpyeDK2MzT\
a9DyzRTMmspwyXzIpsfkxkXGsMUnxa7EPsTGw2fDF8O5wlPCM73cxtrNS9RR2h3gwODU76AFDRGuGP8dziGzJPYmwyhOKpQrtCy7LZsuby8xMOkwhzEvMpcy\
EjMBMxE+xzQcJCwLa/b36bDh29u+1rjS6dfU0pPQyM5nzUHMR8tsyp7J3chKx4/JBMhqx8zGT8bSxTbFz8DZwBvKvNfW5yT8zQuhFU0cESGLJC8nQinyKk8s\
my0UL540OC6HI3kWSgjv+JLpFdyT2ZvdguX+798A7ATuAfb65PGi4/XZKNsP4k3sPfjsBB4V2x3bI/0nBCt8Lc8wljRpLdAhgg1EBQkE6wYbDKoWTB35GM0O\
ggGU793kw93b2FrVu9K40DfP8c3hzPLLKst1ytfJRcm+yEfI0cdqxxPHs8ZhxobFfsKtxcbLu9O43CbkMO65BrQS0xpWIGUkbyfQKbArQC2ULsUvxTC4MY0y\
UDMFNK40STXbNWc24zZXN8w3NDiROO84QDmKOc85FjpNOoQ6tDreOhU7CjsvO786AUgYOm0cEwMj9DPqW+Nn3r7a5tet1dHTR9Lo0LLPnM6kzcDM68spy3HK\
1sk3yZ7IGMiRxxvHv8ZVxt7F3L0+wjLU6+Go6Rbur/A/8SnuX/ZhC+oVIR0OIqclWyhxKhosfy3ALsAvrDB4MTUy5zKFMxk0pDQkNZw1DzZ/NtQ2HTdsN7s3\
ADgUOD443zd2RLE5TyY0Bsr1tOou48LdytnH1mvUhtLu0JXPYs5dzWfMhsufyjfIssXZyjHTTt1g6NPzWP+qCtwWxx2oIkcmtSzRLQomBRqmC3X7I+pD4IXZ\
/dSv0TfPW82Mx3/I8dA23xfj2+HF3dfXtM5CyrLPFtpZ59z1QwlnFAIcMiEBJdIn/injK2EuUTJhLJYipBaKCQH8B+2I4rTbEde500fReM/zzcjMV8XlyKbS\
HuBh790BJxFyGrggGyVMKK8qjSwELkQvUzA8MQAyuDJoM/gzlzRHNZU9HzPeHQcK6P5k+Kj0mPKW8TzxPvF78c7xMfKP8uTyEfNZ847zmPnR78ThQdpL1efR\
a8+TzTLMDMsjyljJrshlxajFY8rP1FHdv9sI02DOZMtdyerHV8ITxInLDtkH5jHpgucJ41Td3Nb/0F7N+8pTyTDIWcfAxlbGBcbDxW7FYMSmw97A9srQ2wn3\
ZAi7E2sb7iD2JAcobypoLBQufS+2MN0x1zKwM340ADUuOzU3ci9SJQUaOw5dAnf2C+uJ41jevtoA2M3VBM/Jz23YIuXK9zIHjA35DpcNkwqhBkoC3v15+Uf1\
Pe6j6g7xyPxtDyUcLySlKVct9TL8MtUs7CbbLYYxBzTDNRI3FTjZOII5DzqGOtY6OjtTO+5Cbju/LsoeRgzw+ObtW+YP4SzdJ9o81dTTmt1p3nfYZNUl05DR\
IdDrzs7I7MwT1bLlK+0T7jfrWea33l3Wz9jY4DvsBvlkDAgWHxjKFcsQwwjy/qr/3gXZDqgcFiTFLE0uPioJIxIaHRDMBW/7N/GD57bfvdpA17XU2NJX0f/P\
GMgmznTZAejl90sN0xieIAMm2imtLNcujDDxMQwzCDTtNMI1sjZvOf87ZzM6JlkWmgPR8tzoGOJc3eXZStdI1aPTTtIy0TrQW8+ezvHNSc21zAjMS8v1wuXL\
Atvx7QUHCxTAHLMiBSc1KpQsgC4LMFcxdjJuM0M0AzW8NV82AzeTNzs4VjmTPRM3kSzQH9URNwN28Q/mwOM/5p7rlPJj+pACogqUEvMZlCaQKRUk4RnuDFj9\
dOty5JDjUeYe65n2NfoR9m3tmuES23vWptHuzZvRd9gv4eTq9vQc/wYJiBISHWMjzifpKkktRy9CNdY08SucHmAOIflH75nrsuvr7W/2s/i88mDllN1V2MfU\
J9IN0ADL3cxm0gXaxuIR7Jf1BP8fCNsQShleIVAmzClgLFIu2i8kMSsyETPeM5E0QTURNks6LjwzMRwgPAby9OHpbOIx3WnZlNZ51LHSGdDOzlzQSNOH3CvX\
l9LGz+LNcMxiy5PK08k1yafEKceYzVPWQ+DY6qH1SwCjCngWHB5fIxwn7CkRLMwtIy9QMAgx2zm2M/8nyRiIB4jzZujh4LnbBdhX1UfTntFC0DjPQ856za7H\
/NCu04rTwdHYz6TKG8m10A7dHOyV/X0PhxtJIEQh7R9JHcEZwBWJEUwN5QgnABQCCQrYGcwizSjZLL8vMDIpNsEzwC5OKO0gJhk/EXMJzgGA+rPzbO2k533i\
9t2I2tLXqNXs05XSldFV0dPR29KW1LvWY9ln3NffleOY58TrLPCo9D353v16Av8GegvND/MT+xe7G0YfjyK0JVMmZCyhL+sxijPMNM81ujZzNxo4pTgvOaY5\
Fjp4OtI6IjtqO7s7+DsZPD88BDzNRBw9RC+pHZAFMfYY7CvlIuB53KjZZteT1QzUvNKA0YHQjs+2zvDNKc1+zNzLP8u1ykXKzclZyfG/SsVb1EHqXQP5EAca\
LyCgJOMnXipULPAtQi9jMF4xTDIWM84zdjQTNas1KjasNiI3jTf0N2s4LDlcPno/TzAjFTP+hPBo5xrhktw42aTWntTy0ozRWNBMz1rOac2ezODLNMu6yh3K\
tsk2wavG89Jr47L4GwsSFm8djiJDJgYpKSvdLEAuai96MF0xKzLnMo4zMzS+NEQ12DWdNh47WjXxK18guxOcBhr5oOtZ45bdf9l91g/UKtKCy47OEdY04Lvr\
2fcvBMoSbRygIh0rViqgJWse4RWRDAkDf/lI8B/nS98m2RDVM9IE0DzO08dDyWjRMt1764H9CAZ0CbgJNgiZAR4AjwX5Dq4bWSLnJhcqYywrLocvqDCCMUcy\
vDJMOYgzmyV1H4AdzR0wHyMl+iWRHsESdAQl8hbns9+G2s3WBNTW0R7Qwc6OzXDMUchVyALOX9ZF4O7qM/mCA24F3wKi/ef2yeo+6GPr1PEI+h4GRw8aEHoM\
LwZ+/jrxke2X7//0KvwsB9MP8Q+KC5AELfwv7p7p9uq274L2wQCACYgJAgXr/XX1duyv4nDaX9Xe0WbPjs0lzA3LKspoycPIQ8jGx0bH5caOxinGc8ViwI/C\
ps2j3YHxkAZlEmIa6R/yIwEnZClJK9gsLi5iL2owVzE4MvkyuzNaNAE1mDUZNp42Fzd8N+83VTimOPg4UTmbOfU5JDtEPAw5wjMmLaMlkx0fFZEM+QNh+//y\
d+rH4ljdgNmO1kHUWNLd0JfPdM5yzZrMwssBy1bKt8kfyZjIEsiZxxzHt8ZXxvTFm8VexTDF5sRZxA7E7cH5wfrK09go6f3/nA3RFiIdqyH7JI8n2Cl2K+ks\
IC5EL0cwMjEAMscyejMiNMU0WjXxNac2czh6O0Q09ihTG5IM5vu27RTlF9/c2q/XQ9Vr0+DRhNAwyxHNS9Pw29PlZvAX+2wKxxFaEgEPewmyAk77uPNO7Cjl\
Pd7r2IXUhdFdz8LNhMyRy83KH8okyY7ISsSlxwjSdOCp8D4HVBOiG1ghdyWMKPUq4SxyLrsv3zDcMcEykDNMNP40mTU1Nr02NjekNx44Hz4tO4wxPiTVFDwD\
hPKw6PfhNN212RTX7NSt0vXQctSh0THQ7c7mzQzNScyTy/7KZ8rsyVbJXsjfwk/JGdSY4XTwJAHTEBUaaiDaJCMonSqWLDAugy+yMJwxgzL/Mhs4jjCBLqIu\
CDC9MRQ4ETcELxIjABW3BerzWOkq4ibdg9nD1qPU9dKN0WTQW894zqXN6sw+zKHLE8tgynTIjcMHzI/ZBOrN/2YPQRn1H6skHyi8Kr8sXC60L+Ew5THFMpgz\
TDT0NI81IzauNh83kzf/N2c4wzgXOUs5hDlpObhCtDuxLUgbjwIB9DXqluPR3kvbsti/1iXVIdSi03vTx9NH1ALV8NUf11rYv9k72+Dcn95l4DPiEeTx5drn\
v+mi62vtKu/l8Jby+PiG9cnrSt5N16LSfM9GzaTLdcqMydHIPcjGx1jH/catxnvGSMYTxvXFv8WCxaS+xcESzkTfJ/h7CZQUFBxmIVglUyinKpMsLC6OL8cw\
2DHXMrszjjRSNQs2uDZJN+g3gDhVPHU7XDVpKf4fBh1mHaof2SJqJgkqki20MG0zqTVlN5Q4Pjl6OUg51zxVNvEpThoaB931heuC5ILfydv82MHW7dRv0yjS\
+9Drz0TNQsuAz3DW4t4n6MbxdvviBAQOxhb5H08lDCnOK84taS+0MLsxozJ7M280hzjQOA8w+iJkEz8BTfBY5pLf1tpT17PUptIK0brPic69zfLMI8xyy8DK\
G8pwydPHTMSiyWDSM90N6Ur1jQEqEJEZ6B9iJJ4nEioDLJIt3i74L/cw0DF4MiczaTNDO1E1fyrrF04LIAQZAAn+ZP5vAPL5O+xo4i7c39fM1IHSs9BBzxrO\
F81AzG/Lx8oKyuHILso4ys7JFckKyG7DXcgU0o7eeezF/oQLFRIlFQQWrBVSFF8SKxDPDWcLCgm7BooEhAKeAPP+b/0B/CT5Bfex/DkGZhQCH6AlHio8LYMv\
STGmMsQzpzRwNSM2tTZCN8U3XDi/Ob89KTYYKm4baQsY+Hbsf+QH3xTbDtig1BTSNNMO1h3ayt7F41fttO8g7ArlyNs11nXS4M/7zYzMc8udytPJMMnAw7TH\
otCJ3ZnjQuYE59XmceKt45Xqm/Q3AEYPohlqIB4ljSgeKx8tsy4ZMFUxEzUGNf4vdCh+H7gVrgsI/tP1NfRc9rr6uAARCgALfwdsAQv6t+7d54rn1upT8Ez3\
9QEqBOABBf3T9vLv8ei94cbb+Na502vRu89kzm3Nkczcy4PFrsnI0uTeauyu+qYMzhdRH4AkQygUKy4t8y5DMI80XC/BMMQyFjQdNfE1pjZCN883VDjIODM5\
nTnuOTE6gTqIOvRBBjtTLh4emgrA97jsMeXx3xHcH9nV1vnUbtMk0gHRCdArz1nOm83bzDjMnssLy4bKBsqQySLJushayPHHosdNxzfFF8VmxYDLXdip6HkA\
qA4vGKseVyPOJnkphys+La8u8C8KMQIy4TKyM2s0GjW9NVA24zZjN903Tzi9OCE5gDnUOS46lTprPhw6xzJ/KU0ffRSYDUD3MuyP5ErfZNt22CnWW9TQ0n/R\
XdBiz3TOoM3lzCjMhsv7yl/KuslfxiPMmczbypTJvcjzx5nFV8PYyLPRgdxW6LH0/AD+Dz0Zkh8EJFAnpyybLLgpHiWBH1cZAROJDK4EhP37/XcCKwkNEW4Z\
lyNFKTAt6y/mMXIzmzSHNVA26DZ2N7k3TD6KOTQwBCRVFvcHp/ez6//jn96+2sPXtdQ10dXSwNYk3F3iHOn579/2mP0YBEkKHxCHFYIa6B7hIkQmGymFL/Uu\
DiiwHUoRJAPa8gTrxOde55To6OrP7RPxf/QN+Db8WALr/xn5yu//4+LbU9bd0EfQ3NLn11rgSeFc3gDZYtPyz5vN7Mumyq/J7shZyNPHascOx77GdsYlxuLE\
psTaxmDK384F1H7YXN046br5egzUFuMd2iKIJlUphytWLdkuKzBPMV8yQzMeNOc0pDVYNus2hDcSOJg4IDmqOZo6OTsNN2U0NTJPMGovqC95J+8aBQz9+IPt\
yeVg4Hncx9ga17jXINV30xLS79Dxzw3PQM5+zdnMPMyyyyTLisqXxs3Gzc0f2DDkKfFt/rsOHBkTIO4kcygbKzEt2S47MGYxajJLMyQ03zSENSo2wjZRN/43\
fjnMPbY18ChmGdQHSfWu6mrjVd6h2tbXsdXy04fSa9Fm0HXPnc7YzSLNdczAy+PI3sdMzd3Yct7E4Enh9OD13XfdMuM17Av3uwIVESAbwCFRJqkpLSwdLqwv\
+zAgMhkz8jO3NGk1FDalNjM3vjcxOKY4CzmROXQ6ckC8N4MpMBjzAKbyMOm84hbesdoe2AHWItSU0qHRMtG10djSc9SA1ufYY9su3hTh+OMC5/bpAu0E8Ff2\
AviF8+LrfOFV2VnUDNGzzgzNxcvSyhXKfsn/yJnINcjFx3rGEcLfyATUMuSr8v37kgKXB4QL2Q6/EVsUvRbYGMQYThsLJc0pLC2QL2kx4zIaNBY1+DXENm83\
GDiuOCU5pjksOpA6ETsNPNc+JTp3MgMprh7vEyQJuvob9IHy6fMU9zr78//gBNQJrw48E38XUxvPHtshhSSYKBsrHCY1HRkS2wWv+CfrG+N83YLZlNZV1JPS\
FNG0zZrMG9QY18rWstQv0hPQFs6dzIHLm8q1yXXFK8eYzjfZoOX08/8CQwvuD0sSRhNfE+8SFhL+ELYPig1CCscNmRRXIJUm2yrOLfYvHjTXMxcxxCyBJ6wh\
ihtGFfsOzAjVAib9sff38fbqduvn77T2qP5xClMR/xK4EbgOsgoUBhABGfw095PyN+416pDmV+OL4ELeWtzl2u7ZXtlY2bvZitqu2yLd7d4G4V/j2+VN5yfp\
RvGU/AULKBjxH0sl/ii/K8wtoi/oMP4x+DLTM5Q0RzXiNXg2ADd2N+s3Zzj/OI47kDzTNYgrRR/qERYEnvTe6bXipd0n2dHVjdVP1zfa5d324VDmj+sN8jDx\
kuzU5czdQNc00ezO5tAW1ZHay+Ba5wruuPRB+4IBdgcDDSMS4xa0GxUiiSDNGooS9gig+6ryPO/l7obwo/Od+Yj4zfMS7RHlH91/17zTItExz8PNnMy+y/fK\
XMrXyVTJ6ciUyD3I08dixi3GhMg2zOzQT9ZD3JPiF+m974D2Pf3oA2YKvBDHFrEcNCJzJ9sqYi1TL+wwODJfM1Q0LjX5NbU2WDf1N4Q4DTl4OfY5TjpRP6w6\
kTIvJqoatxS0EWoQFRBOEMQQRhG/ESISWBJuEkUS4BFeEakQhhPcDqMFhPlV6zXjlN2s2cLWGNSb0SPR3tK71UPZZt3N4Vbm3+pv8pz1YvNI7sLnMOAJ2VzU\
NdH0zmHNHMwHy1XG3sg9zx/Y2ORq66PuDfB58F3wC/Cz73zvYu9i793sIPEr+U8D9w5mG4UiaSfcKnkteS8YMWUygDN5NFc1EjbBNm03ITgUPDc7CzEUK3Qn\
QCW3I7IkpyN7HBoSIwZl+LTrSeP23cjb0Ns+3Z7fg+LO5Vbp9+w59JL0yfCk6gbjhtva1qrTWtGez13OW82IzM3LM8uuyibKbcjzxOHKntSL4Nfw0/sHA/MH\
fgsEDRgOyRTVH6gltSmYLNcukzACMiszMjQSNd01kTY/N9c3WzjfOFE5Vj3gObYz0yv+IqwZRBD3Bo767fNM8pnztPaW+/EB7wG0/rD52/Oi7XXnUuGa3F/Y\
btU+05PRT9A3zzvOMstlydPOktdJ4u7tCvoXBpIUfB2LI9on8CpNLQsv8DJ9Mesrmis6LokxWzPGNNU1pjZKN9Y3WDi1OB05Vjn9Pnw7CDOUJ4EaBwmt/df2\
tfJI8PXuSu4P7irue+7q7m7v+O+G8Bzxv/Gd85f16vBN6C3eY9hw1KTRkM//zcjMyMvqyjTKmskNyYvIGsivx1THBsepxjzG4MLUwebJ79VP5J7z2gdfE0Qb\
vyDBJMMnHyoBLJct5i4RMBwxCTLiMqUzVjQFNag1TzYDN7g4yTiYM30vsysxKCUlHyTOG9IPcQHn8Gnn6eBa3AXZdtZz1PrRqdAd0dzSWtVy2NXbhd9V40Xn\
Kese7/ryzfZu+v79CgRPBj4DbP0K9tztvOKd3m3eseB25IfrJvDT7wDt+ehW5JvfJtvy1p/TDNEaz5rNisysy5jLPczLyvrPEdlY5N3wyf1hDWcYoR+kJD8o\
/yokLeQuUzCKMZYyvzVRNX4yNi4PKWwjlx2fF64R9AuOBjMBLPyk92vzu+9f6VTpcO3a84X78wOFDPQUQh0rJjUrty41MQQzgzT7NX85FTbqLx8oWB8lFsUM\
hgOC+u3xh+l74iPdd9mp1iDTGtDy0m3Yrt806vnulfBg8Dnvoe3l6yXqjOgu5/3ldOJO5arrHPSE/XUHPxHBHGwjDyhSK7gtmy8dMew02jJ+LrIo9yHVGnQT\
DQy8BLP98faH8JrqK+VB4ODbktjp1cHTFNLB0LfP8M7Tzv3Nts4B1UXeKOnD9LgAIg2JGb4gsCU8Kesr6y2QL/cwMDSLMt8u7yk8JPAdQBbLDvkM+A2mEBIU\
AxthHL4ZzhSWDrAHfwA5+SXyXuvn5C7fptrp1k7UTNKq0FvMVMwU0VXY3uAj7cD0pPhM+rf6ePqx+cb4vPfG9t31I/V+9Az0ufOP8/Lyg/HK9eT8mAXXDhMb\
1yJGJh0nNya1IyEfyB8II88nHS0iMDEywDPsNMw1lzY7N8o3STitOAk5bDlbOgY7njkJN5Yzdy/fKnYn0yILGBYKRvfI6wrkld6i2qXXT9Vv09/Rj9Bkz1nO\
X82TzMvLCctoysrJOsnByDTI/cZaxjvH2cYRzGvVEuHt7TD7pgsRFhUd+yGKJTooUSr+K2Mtmi6yL9swgzOWMawthijLHzUbTBpbG4EdyyArJYAjqx79F0IQ\
KQVJ/pr7TPtY/C/+WQC1AgoFPQc/CdsN6Q1UCUQCx/k88NXkqt/t3U7e998i5cbmUOTE3+XZS9TfzwXMlMyxz1bUYtxR4TXi7OCL3mnbCNag1oDaR+AM57rw\
evfD+bj5T/gx9p7z8/BJ7tHre+l558TlVeRC44fiJOIO4lfi6eLP4+/kdOR35vHsuvW5/ycK/hb0HmAkMCgDKy8t2i4tMFoxWDI/M/4zrzRkNW05MTh8MOAn\
1yKaH10dhBvrGVUYtBb5FBoTHxEFD8gMWQrmB2kFBwZDAMb2SOkb4Y/btdfj1LLSANGez4TOi82ozNnLKMuJyvHJasnxyHjI88e+w6PEJ8yh2Jvh0Oj37m30\
hflY/sMCGgciC9oOShDUF+cgACaRKSUsHC6uL+4wBDLzMsMzgTQsNb41SjbVNko3wDcmOOc4dTkPPOM31S91JdQZtwts/z748vNd8evvIu/f7t3uFe9u7+Xv\
XPDT8E/x0vE+8rLyH/N1887zJfQj9pj21/Fn6tzgZ9mx1GrRuc4WzMbLKc/B0uTRe8+ozOLKqcm3yP7Ha8fxxo7GNsbvxabFqMRRxGPFwscAy+3OetNo2LLd\
MOPz6MHusvQe+PP/Mgw+GFYfRSTWJ4oqoSxbLsMvBzETMhEz7zO9NJ41JDbDNlU36TdlOOo4dTk0PKk7gTc1Mc4pnyEaGYQQCgit/7j3GPDN6OjivN0p2nrX\
aNXK02XSJ9HWzO/N9dI12iDj1u2f8932i/hq+Yv3q/hE/ckDQQt4ExMdOSFWInwhZx+XHEEZnRUED3UNIA97EsEWkhzBIf0hdh9OGy0WxA31CWYJtQoQDfQQ\
vRRiE4IP+gm1Az/6kvVs9GD1dvc0+k39eACgA64GggkaDGcObBAdEpUTiRWbF/ITQw3wBMb7UvJl6IzfDdo51mnTVtG1z2POWs1tzK/L+spbytTJWMnlyHrI\
B8gYx+vF48a2xyfNodZq4nLvSf1HDEoWUx1sIjQmlSgkK/4siy7ZL/cw9DHTMqYzYDQNNbI1QzbSNlQ3yTc/OJ84/jhYOa85+TkyOwk7sTltN4Y0BzEbLcko\
JiRBHyga8BSZDy4KvgRp/xD66vTo7xPreuYX4vbdQdpJ18rUq9LW0FnPHM4OzRnMOcvSy4TKsMnwyFjIzsdNx9zGb8YcxsLFdsUzxevEr8R5xEPEG8T1w97D\
t8OjwenBmcUby8nRPtkt4WjpwfEr+mACdApAEbwbbiGIJZIo7SraLGsuxC/qMPYx5zLEM400QTXiNXg2CzeXNxk4lTgMOZs5AzxJPIA3KDBfJ8IdzROGCWT9\
Cvfs893yDPMZ9r72n/OS7pLo6uG82vzWDddE2bLc6eIr54vnAOaG45Lgi92z2izYAtYx1FTRvNCW1PXaw+JE6yr0E/3ZBVcOeBZUH14mvSh8KGcmQyPxHCsb\
/xtBHiEhQyRIJxoqkCysLlAwITRLMugsaCWsHFgTwQkmAMr2c+0n5breXtpC1+DUC9OP0VLQRs9dzpXN3swXzLPIksjGzYHVw9636AjzT/16BzkRFhxWIrom\
3ClDLBwumi/eMOcxoTXMMyctaCkBKNcnMyixKCkpcylvKSApZygSKt8m2R+6FnMMsgGT9izr5eJW3W3ZgtZO1IbSENHhz87O6M0WzUzMUcnGyEDPRdRR12PZ\
ENuc3CXe0d+W4ZbjsuUR6I7qHu3p767yOfWK9kb8UQRjDS0ZqiDFJV4pOSz7LqYv+y5oLRkq1iaeJycq9i00MTgztDTBNZc2RjflN1A7ZzpJNbItxSRfGD8Q\
Mwv6B+oFdQUxBVAAIPm48Gvnr9/A2jrXn9SU0vbQoM+FznjNVMueyavOeNFb0kTS5dF+0SXRD9FQ0fHR6NL+0RTVfNu24/PsmfZXAOsJpxPQHFwiUyZBKXAr\
OS2wLuQv7DDeMbIycjMeNL40UjXgNW02GzdkOQ460TPYKbkdhRCLAO/zYut35TDhcN4g3SLYQNUK01fR8s/FzsjN6swnzGrLnMl0yIXKJ87X0iXY2N2w45Tp\
fe839cX6GgAkBfMJWg53EigWhBlhHPEeMyEmJY4j3h5fGNYQBQcu/1r71Pm2+X360/1s/GT49vLz7MHmZeAy25LWZNMR0ezOXMt/zHnQJtZM3mzl+eit6mTr\
ges+6XPrUfCp9tj9oQY4DrkRCxPvEhMSnBC8DrIMiwpmCFIGVARsArQAB/+O/Tf8Gfsi+j/5tPhc+B/4FPgy+HH40PhP+fP5r/qI+378cf2L/qz/1AAGAjQD\
bASYBbMG2gfvCP8J8QrZC7QMdA0bDqYOHA+FD9IPBBAdECQQ/Q9NDk8OphGyFoUctCKxKvItUi7CLAEqAyUEIVwgXiErI0clXidIKeMqGSzlLM8uvC4zKhcj\
ohpSEacHBP5g9NXqouJa3Y7ZvdaN1MzSYtEu0BjPMM5dzaDM8ctSy7vKPcqxydrIDsV6xy/OTtfE4dbsLfhnAyYP1BlJINMkHCigKo4sGy5vL5QwkDFpMjMz\
8TOSNC41vzU8NrE2IDc6PLE5CTJrJyQb9A1fAE/xb+fJ4CLctdgU1grUYNL/0NXP0M7gzRnNWcywyyXLmsoVyobJqMhFyB/IUsloyxrOVNH51PPYOt274W3m\
ZelJ7/T3CQInDQ0Z3x+qJAwopyqoLFouuy/uMPIx3DKkM2A0EDWzNUY20zZPN9U3PjiROOw4RjmrOZc6oTu0OWQ2AzIDLXgnMyThG14Q6gK38svo/+FB3bXZ\
Ctfu1DnTzdGT0H7Pis6izWjMdMsIyyXM+s3D0ubTS9K7zw/ND8tVyKfG08jwzDHSbtpb36vhhuKr4vvhpuCK45bo7u7Y9Rv/EQUECD0JUglnCEUGDQjEC44Q\
rRUXHRYh2SGtIGAeSBu8F+IT+Q/9CxEIQwSkACr95/nz9j30zvGx797tYuwz64royuhX7LvxNPhj/wYIZgxUDuMOhA6oDVIM0AoyCYkHoAVGAigDWQa8CroP\
mhYwGzwcVxs5GTcWARHoD9gQCRPCFU8ayBydG30YMxQaD8gHwgQZBM8EOgYlCBAK+AvLDYMP9xAtEiET1hNIFHIUTxTzE04TchJhERoQlw78DDILSQk2BxoF\
5gKoAE7+AvzL+eX5PfXy7XXkh9yw10/U2NH5z4rOVM1ezJfL3Mo2yqrJKcm2yEzI38d0xyHHzMZBxSfEFcWcyy3ViOC17Fz5MQbmE9MbYSFOJUwomSp8LAEu\
Wy96MIMxZDJEM/sztDRfNfU1gDYPN5c3xji9OJ43xzVeM5kwZS8cKf4fNRWqCWv87fCa6Z3kU+EU37vfutuD18XUuNIj0c/PuM6/zSXMl8q+y73OxdKQ17vc\
duP76PfqJetf6hPpkuU35lHp7e1R8xf5Af/eBJsKHhA3FRccix4HHskbgBiaFD0QrQslB64Caf4l+CX25PZI+Y78YwBkBGoITgwZEJsT0Ra1GUkcaR5QIKki\
cCTOIdwciRZ9D9cF+f/8/Kr7Yvuv+2H8Qf00/iX/IgD7AM0BewIjA6kD1QQNBv0Cu/1L91bwRukH4hLcRtcC1KjR8c+LznbNlMzNyxLLScjqxwDMPNLH2fvh\
ieow8777GQQhDMkTGhtkIt8mHSqdLKEvRzHPL7cslCjeI7MeVBnME1cO8gimA6X+2fl59V/xoe1P6k/nvOSR4srgYd+f3Yzcad9m5KLqd/Ga+ikASQPUBIIF\
oQVqBe8EYwTMAysDoAB+AdIEhQneDhkVZBvKHRYe7BztGmYW6hS0FcMXaRrrHZshPSG/HtwaNxYXDwgLmwmqCZkKcgz5Dn8N/Qk8Be//Wvjy82nymPLS86f1\
y/cO+lH8lv66ALsEfwUlAyT/Nfp49Jbt7eqI6pjra+3H72PyHfXa96P6mv2NATMBl/6l+h/2UfF67MPnYONE323bn9Ze1rXYk9xb4bbmWez/8aj3Qv3KAoYJ\
7QvmC2oKHQjKAzMBlgF+A08GownADrUPbg7GC1MIggSPAHb8lfjQ9DvxIexi6xTtVfBI9NP4cv0iArEGDgsvDw8TkhaxGX0c4h7qIIAipSN4JO4k/iS8Jugj\
Wx46FzgPmwX9/A74MfWi8/Hyz/S58o/uLelA4+PcetcV1VHV/Nam2dvch+Bq5F3og+yw8Ln0q/hu/AgAZgOeBpUJkgyPEC8Qew1cCXwEUf8I+tL0zO8V653m\
/uDe3z7hReQ06EDugvLo89nz9fKD8WDuIu8J8jj2FPszAHAFmAqTD0kUsxivHFUghiNMJpookSr7K/8sii25LYYt3y6hK7YlMR7JFbkL2gKQ/Vf6Xfge93D2\
EPbx9fz1Kfao9//31vT+703qReR83LPYxNee2IbaOt1c4NjjgudO6xXv4fKU9i76pf39ACMEFgfVCVYMkg6XEGMUKxQrEa8MYQelAcf7AvZ18DrrXub+4SXe\
s9rj147VMNND0WPTx9eU3Rjk5eyg8hD2Jvh++Wr6F/ur+y78wfxT/f39rP5r/zkAFAEMAgkDDAQZBSYGOAeQBrUIFw3BEuEYKB/YJWsr9C52MT4zqjTFNb44\
fDjBNXMxOixYJjUgzBl0E2MLAQaKA8sCEgPmAxQFTQaiB+MIBAoHC/ELlAwMDXgNtg2zDaINTA4uDlQKhgS0/Wf2Be+25xjhQdts16nUldIB0bLPqM7AzfvM\
Ucyxyx/LbMpkyRPJfcryzCjQ69Mq2MXcl+Gd5sHrevD+9H78egUdD+QapCFkJs0pXyxkLgMwXDF+MnczWDQpNd81iTYoN7c3PzjAOFw5qzufPFQ3KC9kI7gZ\
ihLODPEHFwR+ARL7zvIV6aHhvdw92aDWqtQQ07XRlNCZz7LO382PzB3M2cwyzaLNQc7yzvTO39Lp2DzgNuiP8PT4PQFECQ0RahgoII0lTCkRLCUu1C9DMd8y\
ADVPM8MvoymnJi8lpiRlJMolNCWJISUczBXhDswHyQDr+UrzB+3u5c3gON/B35ThP+QZ6XbqBuqS6K/miOPC4QnjIuZO6gPvqPXd+Ar6Dfpg+Vr3NPYB+FT7\
e/8JBLkIXA3SEQcW+BmWHaggSiOWJW8n4SjLK6Yq1iZxIRcbThQ7DRcGEf9Y+Ary8utv5lnhqdwj2VDWAtQt0pXPic2iz7bTEtkp36blWOwQ87b5KgDPBzkN\
qQ9cEPoPyA7SCycMGw4JEVwUKBkbHBUcXRqkF0UUjRChDJ0IogS4ABP9gPkk9hPzSPDH7Z7rs+kv6PjmEeaF5UblReWW5THmEOcd6HvpBOu77IXuje+d8XT2\
svyuA+QKrBMIGSEc0B2BHo8eEB4uHQgcmRrzGCUXQBVAEyMRAQ8WDIcJCgoaDPIOKxInF9YYMhgmFj8TGg/9Ct4JOgp8CwkNnRDbENcOdAtWB9sCLv6H+fX0\
ofCB7LToS+Uz4njfJN1D287ZutgR2MrX7tdw2EjZadru26fdQ9+q4Gblw+sL86n6cgL+CVgRPxj1Hl0lWykwLFouCDBnMYcybzNCNPk0rTU9Noc3FTgjN041\
sjKWL/0rASjAI00fFBt9F9QPSAal+9Lv5OWl30HbDtie1a/TGtLT0LbPps7MzfvMOcyOy/PKY8rGyQLIA8aWyirRe9Y/29LfReSv6BLtZfG59ej5ef0JASAH\
Zg5GFnMf2iSoKGoriy0uL44wszGeMoEzIzQ3N3A0kzKOMfEwTTCXL40uRy2uK80piicQJUUiSB8HHKgYGxVqEacN1An4BRsCMwBU+/TzwuqO4efb4tf+1M7S\
HtG5z3LO4swgzCfMYc1bz8vRn9Sd1+DaKN4549rlFOYF5VnjN+EE3l7er+Al5EnoRu5S8vnzYPQG9CfzBvE98iD1Bvlr/WgDewf5CAsJRwjbBuEDGgT2BcII\
9wtWD6IS1BXIGHwbAR6DITchwR7pGk4WOhH7C5QGSAEd/Eb3ifIx7jPqpuZq45PfYd1U3v/g0OQ06fPt2fLL96P8XAH+Bi0LbAwEDJQKkQilBNUDxwSxBi4J\
3QydD2wPww0dC/oH7wL4AOgA9AGqA54FwwfjCekLvw16D+YQKRInE9gTbRS9FOUUvhRUFLYT2xLbEacQVg/TDTYMfwqsCMcG2ATnAuIA2f7t/Cj7u/qp9sDw\
9+ly4pTbutZv01fR0tBw0dzS0tQ21+XZydwq4QjkSuQ545nhxN/d3THcwtq42f7Ym9fc1wPb4N+l5evrefIb+aP/AQYdDO0RXRdYHPwgHiXaKOcrVC43ML8x\
DTMJNa01xDIELv4nUCE7GgATtwucBKD9Lva076Xsg+up64Ts6+2M73jxe/OJ9ar3uvm5+7X9kf9UAbAEuASLAiz/OvsF97jyj+6n6gXnyuNN3zneh99S4gvm\
9ur97z3yF/M18+jy1PCD8TX0Dfh9/MgBKAeICVwKKQpoCbMGcgYYCMsKCQ7tEQ8WCxdMFn8UDRI6DzcMJgkEBu0Chv/P+1/7nPzn/qIBOwZhCFcIFAcVBVQC\
yP5Y/oP/hAEMBOsGlAkxDKcO+BAQE/MUjxbrF+4YsBkmGlgaNhrNGUcZjRiHF2EW2BWQFAsQ3gnMAlb7FvI77K/oxObd5VLm5ObW5H3hlN1z2TfWddMk0W7P\
H87KzFbKvcrkzZ3SM9hh3s7kX+vq8W34vP7UBI4KBhAfFdsZHB74IWMlTSjbKmAtvi+KLmMr7Sa2IQ8cKhYlEC4KTgSp/kD5LPR17w7rJucq4v3fbOBu4ofl\
belP7lDw5fCh8ADwQ++J7tPtRu3k7Ljsu+z77GXtFu7h7u7vBfFe8s7zV/XJ9nj3CvseAAEGIQxQEk4YCh5lI44ooizjL4EySTJ6MKUt4yhNJbYjGCP+Iggj\
GyMFI7UiNyJtIWkgLh+sHewbBxrkF6AVNROoEPcNPwvQCaMGuQB8+afxKukH4cvbVNgK1gLVDdZZ1lPUQtIo0KPOds18zLfLDMt1yubJPMmDyDnI2MiJyuvM\
2s9H0xXXPNu03zDkzOiT7V7yL/eu+qMADwgZEN4YDiEcJrIpRixBLuovRzFqMm0zTTQSNco1cTYSN603UDixOvI63TaAMNQoZyCcF6sOzwUo/dr0zuzN5Zzf\
d9tk2OfVWNMI0ubS9NS11//aoN6J4p7mEOxw7iXv7+5G7oTto+zU6zzryuqO6j/pFOu07lfzmvgP/o8D8QgrDioT3heDHeQfPyBEH2odJhptF+wWiRe9GCQa\
kRvgHAse8x6tH/4gRSGGHjUa+BQqDywJFgMo/WT37fHf7BTouePh33vcn9nF1TbV99Yg2h7er+KK55PsnPGu9pX7XQDnBDwJPg3+EHMUiBdEGq0csh5kILEh\
oiI9I4AjZyP7IkkiQiH1H2QemxymGnQYGRaZEw0R/A7lDK4H5QBO+WzxZuk64iPcHdhE1RLTZdEG0K3OvsxszEzOYtEw1X7ZLN5c4xjpBOyH7TXude6Q7q/u\
zO4G72Lv6++R8E7xLPJI83n0zPVB98X4V/r8+639Wf8DAbgCWQQYBr0HYgneCvcKZw1WEQwW+BqOIJIl1Sd/KA8o3CYrJQcjnCDfHQ0bHhgTFfkR2Q7NC8EI\
1gUEA00Asv1A+4D45/Uk9uP3dPp8/S0CdATMBB8E1QI1AU7/a/14+6b54Pfs9GH03PVi+JL7BP+fAhcGhAnEDLoPcxLfFP0WxxhEGtUbfR3uG5wYOxRED4kI\
7QNcAfb/UP9c/00AU/7o+s72VfLN7WPpLuVO4cXdqdr917fV+tOk0t3RSdD10PzTdNjR3Zrjm+nD79L1xfuHAQcHNAwOEYYVoxlSHY0gXyPCJbQnLSlJKuYq\
IivrKlsqjCmMKSImzyBSGjITmAp6A77+fPsg+X33cfeQ9EPwP+v55crg9ds22O7UitKv0L3OrszWzDjP1tIZ2NDcn9934c3i8+PO42fmiuqR7xj11fqEABwG\
ggujEHkVQRviHZke/h2fHMMaihj7FVMTgRCzDd4KDQgcBWQBuQCXAVEDcgUMCdcKmAouCQsHewS5AMv/TACiAWUDngYqCKMH6QWNA94ADf4j+1T4pfUq88zv\
Ie7J7sLwkvPR9mb7P/2g/Sj9OPwJ+8P5dPg59wv2FvUo9HDz2PJy8izyQPF68ezzovfs+4sAaQaeCTALwQu7C08LlgqpCZ8IjgdsBv4DPAT1BX0IcQtLD1US\
/BJZEtsQ2g4xCwkKVQpuC9kMhg4gEKUR/RI5FCkV7BVYFpkWkxZRFtsVNRVFFDET4BFxEOcONw1ZC3IJewd3BWQDSgEx/yf9DPud+l73VPJ47Ebmvd942kXW\
Z9NE0aPPWs5AzUfLJMqYy/bOVtPN1X3Xxtj92Uzbu9xO3h7gGeL0483lJ+rD7x32sPyTBEkKNA7/EAYTdxSKFUUWwBb4FgEXshUdFggYyBrUHSUh2iS8JRYl\
UCP8IDge9Bp4F+oTVhDADEAJxAV1AkT/NfxX+cP2VfQN8i/wou497R7smeq76VjrWe4T8jv23/sd/8kAdgGnAXoBGQGZAAsAfP/W/mT+7v10/RL9sPzz+0v7\
Av3t/3oDPQdmDDYPRRBEEJUPcA4DDVkLoQnRB/sF5AL6AcACeASmBhAJfAvbDQwQFhLeE2oVoxaaF04YwhjnGNAYbhjMF/MW3BWcFC4ThRHCD9sN2Qu/CYYH\
WgUMA8IA1f/a/Mv30/Fw6+jkxN532bvVFNMV0Y7PVM5QzXnMussZy4PK8ckIyWrIWMjSyMXLDdGy1yrfA+cO7wv39f6VBuMN0RRaG+ohkibbKUwsMi60L/kw\
FDIDM+oz9zRXN3Y1tzG0LBQn/yCWGhAUlQ0+B/oA8/pC9efv2OoK5WbiqeEu4m/jUeWD5+fpcOwe79rxuPX09rX2pPUb9HXyv/AY75jtT+ws61Lqselc6Srp\
TukB6W/pBOzu73j0W/mJ/1UDswUMB9cHSwh6CHAIOgeDB5YJXAyfD+kSMxYpGf8bfB6iIH0i+CMKJcElJCYmJtolKSUxJOciYSG+ID8eeBl6E8EMpAVx/Rv4\
evT88Sjw2O7b7Sntquxq7Fvsh+0N7E3pzuUm4ozeHdv010TVA9M10a3OOs+V0SbVctky3kHjWeia7b/y2ffJ/IcBEwZeCloOFRJsFXEYKBt7HXcfJSFhIkcj\
1CMZJMYkdySSIUUdHBh+ElsLvQbBA8oBZgA2AHr/qvzL+Hv0/O846izn+uXv5bDm7OeF6VPrTu1v74Px/fQC9nr1FvQ88tDvfu2J7e/uEPGw83r2bfll/FP/\
JwLpBHAH2gkMDAoO0Q9pEbgSzxOyFFQVzBXxFeoVpRU8FZ0UKRU/E38PtApQBVj/EvmJ9X7zWfLR8b3x9vFM8tzyhfNJ9Az14PW39pX3c/hY+Sz6A/vR+538\
t/0p/+v9dvs/+MP0LvG57XzqgOfR5ITijuDq3iXdKdzW3cbgyOQZ6e/uq/L+9JH2sfcX+Jf4Hvuj/sIC+gZ4DKUPRhHfEdgR9BDgD7AQdxK6FCAXdBmyG7Md\
ch/7IJ4i/yOrIuEfMhz/FzESeg5BDAULWQphCpEKawgZBSQB4vxT9/vzZvL+8VzygfMZ9Xn0wvKN8BLusOtY6SLnTuW74zXilOCj4STkj+dy68TwcvSS9tv3\
m/jn+Iz4ZfpR/ekAswSTCGYMBRB4E6UWkRkYHE4eJiCtIdoiryMqJEYkFySkI9AiuiFhIMQe9xzwGskYdRbuE04Ruw4hDGcK6QURAHr5p/LN6qTk0uB63jLd\
jdx/3Njcid2I3rrfGeJj48/iaeGj38rd79rQ2lLc3N774ZPlWulG7TzxOvUf+fr8pQAiBHIHmAo/Ds8QJhFIEKgOjAwcCecHAgjJCP4JWAvADBcOWA96EHkR\
ixPLEoIQQQ2BCdMEsgCw/u/91v0r/rz+fP+EABECUAFL/4X8bPkm9XXyufEU8hjzofRJ9if4B/oC/N/9yQAcApIB+f/T/Vb72/fh9kL3efgL+v37Dv4VACkC\
IgQOBtIHcwntCjcMXw1YDiAPuw8uEGMQhhBuEC4Qxw9HD5IO0A3uDPIL2wq4CYIIMwfkBY0EMAPUAXcAH/++/XX8N/sH+in6tPfR80nvg+r85HjgWd683RXe\
F9+W4GfifOTJ5izpauwH76fvP+9n7kzt++oE65XsEu8c8nL15Phj/Of/TAONBqYJigw7D7UR7RPrFZ0XEhk+GjUb1htBHHMcUBz2G2sbsxq4GY4YRxfSFTQU\
gxK5EM4O1wzXCtcIzAatBLMCsAC9/t78D/tK+aj3Hfa09GXzNfIp8UTwee/i7lTu+u237Z/toO3B7QDuVO7P7lLv/O+x8HrxVPJI84b0QfaM9bHzMvGF7r/q\
vOic6K3pceut7UDw6vLF9Y/4Y/si/twAZQPwBjUI9Qe+BgkFdwIvAOz/xQA4AgAELAcQCIgHNwZvBOUBgf9O/ysAqwF4A38FkweTCYYLXw2UD2oR+BAsD7wM\
1QmWBVADnwLBAoID5QRwBsAFBASyAQH/F/su+eP4lvnW+nj8L/4EANgBsANqBTgI5QjtB/UFhAN4ABP94fsA/M38/f2gAHgBuAAt/yf9pfq+9xv3w/co+fX6\
Jf6k/5H/rf5F/bD79PlR+LD2R/Xp893xa/HG8iL1Hfhm+8j+MwKSBcsI1guqDk8RrxPAFZkXLRlyGmobHByHHK0cmR3YHPoZBRZZET4MCQZmAgoAm/6q/Q3+\
TP3j+ob33fP07zfrBelu6M3o1+kz7J/tYe1h7PnqfukW6MfmuOXg5EnkQ+Nh44Pl1ujQ7CfxpfU0+r/+JgNVB14LIA+YEsIVphgxG2wdQB/UIPgh2SI2JFYk\
ISKqHnEavhXTEMgLvQbKAfX8cPgY9APwXez96CbmkeN04YTfW93F3b7fouIf5vbp+u0U8iT2L/pP/vgCNgUkBk4G/AVSBYQEmgOdAqoBnADN/kb/6gA5A9UF\
qQhpCw0OjRDkEv4UzBcRGNMWrRT0EQAPwAtjCBEFygGY/oH67fi++HP5ovrz/Gn+Hv71/E77WvlQ9or1IPZ290T5DPwd/mn+uP2R/Bj7ifnz93b2B/W38+7x\
AvH38Qz0w/bR+f78MABcA3QGUgm9DD8PtQ/2Do0NrAtoCCsHHAe8B8MIgArbCzALeAkvB38EfwCc/hP+XP4g/60ADgJ5Adn/sv1L+5j3B/bb9Z/23fdi+Rv7\
3fyX/k4A3gGUBCQFIgRIAvX/bP3E+hH4kvUn8/nw6+3u7JftQO9+8Rb01/ai+W38Nv/aAXoFKQcpB1MG6AQ8A1ABYv91/Zz7xvks90H2/fab+NP6j/25ALEB\
uAEMAQwA3/0l/d39dP9mAZ4D1QUCCLcKyAzvDOoLQworCMgEVAMoA7IDrATJBfEGHQg9CUUKKQvhC4EM/gxDDWkNcw1GDfwMkQwODFULmArFCc4IwgesBooF\
XAQoA98BqgBk/yP+7vy1+4n6c/nT+ET4hvXH8Y3tOOn45PbgQd3/2RbXatTw0RLSy9Nr1rrZiN2T4cXlE+p27hLz6Pea+jX8Kv23/RH94/31/8oC6AVvCU0N\
Cg+ZD2UPtw7PDa0MYQsECqkIGwf/BPwEGgbTB9MJ8AsSDhUQ+RGpEy4VeRaFF1MY5xhGGVsayxloF/UT6g+JCwQHgAIb/tD5u/UI8drtp+ya7E3tge4A8Lvx\
kvN99Wr3Wvk9+w/90/6NAEECqAS+BJUDpwFX/xv8wPks+YL5evrN+z3+k/6+/Un8gvrh9xT2APb89oH4XPpb/H/+lACcApAEcwYlCLQJGgtWDG4NZQ4BD3MP\
vQ/mD+YPxA9yDw0Pcw7MDe8MFAxKC+cKTwh8BAsAQ/tw9Tfxzu5/7fLs4Owl7a7tZ+5A7zLwTfFt8pTzyfQJ9mX3cvlM+f73Dvbe87fw4O697qTvKvEM8yb1\
Yveq+fb7L/5iAHcCewRVBgwIoAkGC0wMZA1HDgsPqQ8VEFYQaRBfEC0Q1A9dD8YOBw5FDSQNCgz8CAUFggDC+/j1lvKx8LzvaO+H7+jvf/BK8SryK/M29Ff1\
fvai98b4Afol+0D8T/1h/mP/ZgE1AbL/dP3b+jH4cfXV8mzwPu5L7IzpIOk06j/s3u7J8e30Jfhi+5T+tQG1BJQHPQq6DAkPGhHtEo4U7xUVF/0XtxlLGVsX\
aRT1EMYMeQgnBvAEUwQLBP4DCAQaBD4EUwR1BIQEgASBBHoEWQQrBPUDrgNoAx4DCwM1AzABEP5r+ob2sfLx7lfrGugl5VTiid81303gQOLc5N7n+uo77oHx\
5vQ++JD7y/7oAdMElAcuCpwMzQ7BEZUSBxKCEHsOpgv4CAYI8gdwCCMJAgvmCnkJXwfMBJkBm/52/Wb96P3Z/vP/HQFJAnMDmwQnBl4HqQbZBH8Czf/1+wr6\
cvmz+Xv6jfvC/An+av+vAPUBLQNMBEkFPwYNB8wHUQjbCDIJdQmVCbMK4QmMB2IEyAC2/FX4K/Ys9fz0KPXJ9s/2mvW985jxZu9C7UXriOkB6Mjm4OTN5Erm\
3ugH7Lfv9vNt9u334Ph9+S75Afo3/A//WQKzBRMJWQx6D2USChVWGBAaBxoDGVcXORXMEjIQhw3SChwIcAXkAmIAAv7F+6T58/Z/9i/3rfiE+nv9af/f/3z/\
tv6h/Yz8X/tC+iH5Ovhx97H2D/aU9UH1FvUE9SD1UfWe9RD2/fWv9gH5Kvy4/20DKwfTCkwOkBGJFAIYUhrKGiMazBj1FtUTbBIDEhoSbRLiEiITRhNbE0UT\
ChOsEiQSdxGaEJcPgQ5IDeILcQtxCfAFewG3/ND33fIL7o3pVeWH4Svdo9r22YXa5Nv63QLhT+LL4u/i7OL34hrjY+Pu45XkbOXM5UHouuv673L04flD/jcB\
XgMHBTMGNgf/B6wIJAmaCUwJsQleC80NdhAtE9IVUxiOGo8cRx5lIFIhbCBmHrEbihgUFXMRsg3tCS0GowIV/7X7gPiV9cfyT/AS7h7sbur96D/nbuZq537p\
H+xC72vz0/Uw9wD4b/jN+Or4CPkq+WH5m/n6+Cf6Z/xN/2oCrwXeCOYL3Q6NEf8TNBYZGLUZAxsOHM0cQB1YHUAd3hxGHFYbRRrtGGoXthXiE+AR0A+TDWIL\
AwnCB44EAgC9+kL1we9U6i3lZODu23XY1dRZ0rbRZ9L40ynWxNix2+TeKOKY5QLq6uyR7pLvNfCA8GzwLPLO9O73SvvS/kQCqwXbCPgLFA8+EjUTHxNIEvkQ\
ew47DRkNiw1MDjEPFhDZEIcRGBKNEs8S+RLgEq0TTRKXDxoMPgiuA1j/3fxm+5r6Hfru+gn6DPh59arycu967Hnrk+tg7J7tHe/g8LXyn/SV9uv4JPuM+wb7\
FfrP+IL22/V59tD3mPma+7D9wv/QAdQDrwVpCGYJ+gjFBxgG3gNgAakA4QCWAYoCoAQ4BXgECwM9AUj/N/0x+z75Zve19VrziPI486T0s/Ys+SL8Rv2j/Wn9\
4/xB/Jn77PpG+rX5TvnX+Iz4WPhF+Ez4bvie+PH4VPnL+V/6/Pqd+1/8I/3m/bb+jP9dAC4B+wGpAskChQQgBx0KRQ0VEdgTDxVzFS8ViRSTE2MSDxGUDwEO\
sAs7ChwKqwqlC9EMrA6dDogNxwueCZgGQQRjAzcDiAMDBKYERAXWBWQG3wboBwYIjwY5BFwBXP4w+xb4DPU68ozvhexe6vvpnurs66rtqu+48dLzAfYu+OH6\
+Px1/SD9SPw2+/f5ufhS94P1tPXk9q34rvrq/CX/WQGAA5MFpgcFCm4KxQltCLoG0wTHArMAqP6p/KD6H/if9yL4T/nS+o78Yf4rAO8BqQNaBZMH2QcRB5oF\
vwMKASX/nf7U/oD/hAA7AjkCPgGk/8/93fvb+e33GfZk9M7ypvBu8GHxEfMh9QP4Sfo0+2/7PPvK+kn6w/k4+cL4U/iC90P3jfid+if91/90A1MFLAZaBiMG\
PwWUBEUFpAZiCDIKAwy+DWIP1BAaEq0TphTSExISuw//DB4J7wbFBUEFAgUGBRIFIQU5BUcFTwUzBi8FEgNJACX9hvkL9lr0mfOK89fzTvVK9Tv0svLy8Brv\
Ye3L62LqOOlB6LHm5uZc6K3qdO2K8MTzC/dR+or9mABvBKUGnwfTB5MH/gZDBmIFcAR9A40CwwBmACoBkAJWBH4G1wiDCVEJgAhoB2EFWwRqBCQFLwZgB5wI\
zQn4CvUL0wyLDS4Olw6oD/AOIQ11CnoHwgNaAH/+k/0f/QH9F/1C/Y791v0d/m7+vP4B/zn/cP+b/7v/0P/Y/93/2v/L/7P/l/9z/03/F//n/rD+cf4v/vb9\
Gf4h/mj86Pn29uHzzfDW7Q/rhehE5h7kJeIn4lDjROWa503qM+0q8CrzOvaE+dj8fv4+/3r/cv9o/pn+4v+tAdIDRAbuCPcJDQqeCc0I0gewBnkFSQQWA7oB\
EAAiABEBhAImBNEGHQhLCLoH0AapBV8E9gKZAUIA+f7I/av8j/ux+uL5N/me+CX43Pep94z34fZa9wT5YPse/hoBrgSZBpIH+Qf+B9EHbwf2BmsG2gU4BacE\
AwRqA8oCMwIZAbAAoQEkAwgFLAfsCQYLHAuhCrsJpQheBwEGngQ+A9sBfgA2///92fy9+0n6ffkL+mr7Of0w/0QBWANjBU8HHAnYCjEMXA1xDkwP/A94EMsQ\
8RDtEK4QRhDIDwQP/w6VDfUKdQebA4r/evtw95Pz7e+A7GrpleYX5PDhLeC83qzd9dyg3Jzc69yc3ZDev9834e/i3+Ty5jnpoesl7rfw1fKu9av5JP7UAoMH\
JAyDELgUhhgOHEUfBiJtJHgmByhIKcwqUSqXKPsl1SK8HgQbdhiQFuoUdRPMEmgQ9Qz7CK4EYQAE/Mr3xPP/723sbuhr5rvl3+Wh5kLotunS6YLp6+hb6AXn\
bufl6ALrge3Q8KTzR/VE9uL2TPfl9uL30vk2/Nr+/AHLBDEG0wbwBr8GmQXABcYGLgjRCeELpw3mDWUNRgzhCnwIdgdNB7AHTghgCVcKyQllCJcGdgRCAvv/\
vP2L+4P5T/cv9bX0LvU99o/32/ns+vD6dPq9+eT48fcP90D2ePXe9F70+/O685vzmfON82HzzPQC96f5iPw8AL0CJATqBFIFggVxBSkF5ASGBCsEDAMTAxsE\
mwVqB1UJKAvpDP0OgxCiENsPjg7nDPsK+gjhBrwEnwKUAJX+qvzX+jT5rfd/9fX0ePWe9ij47fnD+5f9dv9AAfUChgQEBlgHkAibCdsK4ws+C8EJygd5BTsC\
VQB5/zb/Sf/c/4IAqP8i/jn8Jfo096r1PvWF9TX2YvfB+MH4Cfj39sD1tfMD82TzevTo9dL36/mi+qf6P/qh+ez4NfiE9+b2Xvbv9aL1ZfVN9VL1afXz9K71\
ePfh+ZD8d/9DAgoFuAdFCqkM1A7OEIoSExRTFWMWJhe3FwoYGxj7F6AXExdUFmYVThQSE7URKRCSDuEMGQtOCXcHkAWsA84B9v8Z/mb8sPoQ+W/3u/Yh9UHy\
5u5a68TnpuN54Y7gauDo4GLiZeNc4/PibeLn4d3gjOFM46vle+gM7CvvKPGj8svz1PTI9bz2qvej+J75t/rE+9f87/0N/yYAowBZAskEnweiCgwO8xCJEloT\
lBN9ExYTfBK4Eb8Qyg+/Dp8NcAw1C+sJoghdBxMG3ASdA3ICWAFJAEj/wP00/c39/f6ZAGICsAR/BY8FEQVOBG0DbwJhAVUAXv9i/nv9o/ze+yP7fvr/+Zj5\
OPn2+M/4u/i4+MX47/gs+X353vlO+sL6SfvV+1v8Yvy6/dz/WgIKBUcIyAoHDKMMxwyDDGALgwtGDGINiA7AD9IQzxGhEjoToRPjE/oT0hN/E/4SWBKBEYQQ\
ZQ8yDt0MZAvZCUAIpAb7BMIDKAIb/2X7V/c48y7vTOuq52DkX+HB3oPcqto92SzYktem1l7XWdkV3GHfQuMz5//pXexd7j3wXPG088X2SPrz/aoBSwXUCC8M\
Tw8vEtcULBc0GfEabhziHQ4fkR4pHRUbnxgcFa0SERHtDwsPMw59DaUM1gsFCw4K2glTCKUFaQLo/ir7IffF9GHzmvIn8uXyXPIH8UnvbO1q60Lpv+g06Tfq\
nutN7S/vHfEM8y/1Yvdu+Xj75P3I/2sAUgDZ/xf/Qf5X/W38mfvF+rf5/viK+dX6efxT/gsBZgLhAs4CgAKsAeYASAFMAqYDHwWoBigIjwnoCiMMfQ2iDkcO\
IA15C34JsAYOBUoEEgQcBJwEIAVSBNMC9QDi/sn8sPqk+Lr27fQa817xHPG98ezyc/TY9jP4p/iq+G74GvjC9233G/fs9sT2wfbQ9un2KPd997730PdM+Wn7\
6P2TAFkDAQaICP4KUA2FD9URlxKCEswRsRCyDnkNFw0qDW0NyQ0ZDl8OiQ6aDokOag4ZDqcNHA1+DNoLmgu3CQIH0ANiAOD8cvka9u7y8+8m7R3q1+iW6Abp\
/OnS6wXtV+097ezsluyw61nsye3F7xDyjvQl97j5QPzI/iUBbgOcBZ0HdgknC7cMAA4lDxAQ2RBsEc8RBhIMEvERohHMERARAQ83DAcJpQUnAsL+a/sw+CX1\
VvLG713tmuo56Tzp4ukg66vsb+5O8FDyVPRY9gr5v/pf+4f7WfsF+5f6MPrK+XD5Kfn6+OD41Pjf+AP5J/nx+Bb67vs3/qsAvwMDBkgH7wcvCB4IZAfjB/II\
TQq+C8EN7w4ED3UOcA0jDAkKSgkxCXAJ1wlZCtUKNAuPC9kLCQyrDNALEQrKBzAFEQJh/9j9DP2n/ID8Kv1//B77Svlb9/T0HPN38pLyKvMO9MP1N/b19Vz1\
ivRi84Py2vLt81T1BvfW+Lr6mvxx/kAAXAIGBG4EMgSJA5wCmAF/AFb/N/4k/eL7yPoF+9v7I/2b/tQA1QH7AbABEgEWABX/SP8HACcBaQK4AwUFTQZ/B5EI\
6AnrCpkKjQkHCE4GXgRnAnIAif6t/Ov6RPnE92r2MvUp9KHyXPIN82H0HfY5+Hj6l/sW/ED8JvwK/Nn7q/uB+1z7Jfux+nv7/fzH/tAAfAM6BfQFQAYaBtAF\
VAWyBA4EYwPJAiMCkQH3AFkAyP8//8X+Vv7u/Yz9Ov35/L78mPyH/Hb8b/x9/Iv8afxv/IX9RP9DAWcDJga1B2UImAhmCMkHDwdeBx0ILgk8CvsLggwcDCkL\
4Ql0CNIGFAVqA7MBAgBl/tP8Vfv3+br4Y/cd9iX24PYR+H/5q/vb/CP9Gf25/EX8rPsg+4/6DvqW+aj4s/ii+RL72/yx/osAcAI5BO0FfQfoCEIKYgtYDCIN\
4A1FDpcOtA6zDoMOQA7NDT4NkAzECwYLigqMCMYFowJL/+P7hvhJ9TjyXO+27FbqOOhy5uDksuNE4u3hy+Jz5IvmCukj7Cvun+/J8MDxxfK386r0svW99sL3\
Vvgk+pP8V/8uAhoF8geXCiENfA+nERUUEhUpFawUwBOLEjERkw/wDSoMYAr3B9wGagZ8BqMGYAenB9wGdgXQA/sBfv8j/pv9ff21/YP+9/5i/lb99Pt3+vL4\
evcf9r/0t/PK8gnyZPFd8EjwRfHQ8rf09/aL+f361ftM/Iz8wfzb/O78/vwc/Rn9yPyk/Sr/AAH7AgAF+wbVCJsKPAyyDfIOGRAEEbsRPRKnEtESyBKEEjQS\
rxECESsQOA8tDvwMywuBCicJqAc0BrkERAPDAUYAzv5m/YL8FfuN+JT1YfI17yPsTOmk5lXkQuI24Nze7t7f327hU+Mc5uLnGeka6v7qi+uC7H3uDfH28wD3\
Ivoy/TYAIQPyBZEIEgtVDWwPURHzEmAUkhWKFksXuxcXGCUYCxisFzQXgBZMFrEUGRICD58LtwcEBG4Bm/88/iD9Ovx/+836P/q/+Vz5/fix+HT4RPgf+Pv3\
9vfk9/X3B/hw+M/4A/ir9gz1VfMO8fHvye818BDxJfJt87v0IPad9xb5Jfs4/GP8Ivyj+xX7Z/rJ+TL5s/hO+Av4ufeD92r3dfej99r3Mfix+Cb5uPlU+hf7\
xPvu+1f9ff/gAWQEPQfNCTYLDwyCDK4MkwxfDP0LkwsHC3QK2QkkCWQIqQflBiUGWQWMBMoDDQNYAqgBAgFmAMr/RP/L/mb+/v2x/Wz9Lv0D/eP8zfzL/Mb8\
5vz7/Bv9Rf2K/cD9+f1F/pb+7f49/wv/xv8vAf0C6QQVB0sJUAqvCqUKWwrPCS0JZAiNB54GkwVNBCkEggQ4BfoF3QasB3cIJgm6CVYKEAtxCikJZgdmBcIC\
7ADc/1P/If80/6D/2/6E/eL7FPpB+H/20vQ5883xh/Bu73/uwe077dfsNux57K7tbe+H8fbz0PaI+LT5nvo/+1z7B/xz/T//PQFJA1gFRgcYCc0KWAy+DeIO\
2g+rED4RuxF7EuERcxCJDkgMZwkDB4EFfwTDAzkDywJaAv0BlAEtAUcBxwBB/z79+fqi+EH2DPTy8QnwRe7b7HDrO+pb6b7oVOio50ToyunF6xjumfBI8+f1\
C/lx+xz9L/4V/7r/OQCgAAYBUgGlAWgB6AETA50EVwYjCNwJfAv6DFUOkA8kEcERZRFpEA0PcQ2dC7kJzAfRBeADewHV/xP/5f4L/1H/tv8hAJsADwF4AeYB\
PAJ9AroC7gIaA6gDAwOmAej//P2S+6350fiC+J742fhB+cj5XPrn+ob7L/zE/FD93P1o/u/+7P+5/97+lP0Z/Cb6tfgx+Eb4uPhh+bP67fqP+uH5C/ne9/T2\
C/ev97T45vnF+5D8uvyF/Cv8bfvl+k77OPx1/cj+NAClAf4CXAScBR0HOwhGCLMHyAaoBW0EFQO1AWcAHP+o/Vz8Hvx4/EX9F/4Z/y0ANgE6AjQDKwTwBKQF\
TgbnBmIHXAg3CD8HzQUSBA4C4v/a/mf+Tv5m/p/+5P40/4j/4P8zAIAAwwAAAToBWQF0AY0BngGhAaABowGEAVgBKgH0AMIAfQBFAA0Avv92/zX/6v6U/qv+\
YP4z/XD7f/l59930dvPg8uHyK/MM9M70qvQn9HHztvJx8V3xB/Ie85f0Pfbu96X5c/s1/ev+nAA0ArUDJgVpBuMHIQlBCbsI4AfHBowFRgTyAp0BWwDz/pT9\
Tf2k/VP+MP8yADcBNgIzAyMEOwVEBiQGdAVrBCoD0wF2ABH/vv2C/GH7TPpQ+YD4wPcn9yv2Kvbv9i/4yvl4+0r9Ef/XAIgCLQQ0Bl4HmgdlB9sGOwZOBVkE\
bgN4AogBGQCH/7D/UwAvATMCRANHBD8FNAYHB0sIrQgyCDkH6gV5BO8CWgHH/z/+zPxg+yb68fjs9/j2HvYN9Tj19/U496T4qfoe/NL8Hv0r/RT9efzp/Or9\
L/+XAIwC5QNhBGgELAS2AyYDggLqAUUBnADy/1//xP5D/sH9UP11/LT8hP2//hUA4gFMA88D2QOYAysDoALuAT4BiQDY/zT/nP4G/o/9DP2i/Dr87vuS+//6\
lPu6/C3+uf/RAR8DsQPNA6oDWQPyAmoC4QFOAcIALwCs/yz/sf5J/sT9EP1R/Sr+T/+oAHsCrwMTBAYErQMqAx0CEwKNAkIDDQRgBRoG9QVRBXUEXAPGATAB\
IgFrAdwBYwLnAmYD4ANdBLcE/gQzBWUFbwV0Bc0FkQVhBLQCxACw/hL8nvrG+Wz5TPlo+Y/5x/kV+nH6y/qt+3v7q/p9+Tf46/af9Wn0UvNT8oTxT/BK8Afx\
OfKp81T1EvfM+Jv6Y/wd/j4AWAHLAdEBmgEJAXsA0QCIAYAChAOjBK0FpAaFB1UIDwmsCR8KhwrGCuQKfAvzCqMJ6QfoBdMDogF1/2T9Wvt4+a73A/aB9C7z\
A/Lc8OnvFvDs8CnynvNF9QD3w/h7+kv8K/4IAN8APAEvAQQBNQAtAL4AoAGxAvkDXwW9BZgFKAV0BEoDoAKhAvwCkgNcBFoFVwXSBOgD2gKuAYoASf+T/Qf9\
M/2u/V7+Lv/+/9kApwFyAioDVQR5BOYD/QLBAXoAMv/T/Y78Xvs1+jT5Pvht97P2G/Zd9ez0ZvWC9uL3ePkn++j8h/42ANkBaAPSBCMGXQd2CG8JTwr7CoQL\
+As+DHgMgwx2DDwM+guRCxELgwrRCRQJQAhnB4IGiAWSBIkDgQIPAq8Aif4P/Gb5ofa/8yvyLvG38IjwJPEG8WrwgO+Q7n3tY+xt7B7tQe6d78LxFfPh82r0\
x/Qd9XD1zvU99rT2SPd792T48/nm+wz+WQCCArYExga+CJIKuwwPDnkOZg4IDk8NHAzCC9ELGAxjDB4NQw2DDFQL1gknCPwF1QQ4BOEDuAO8A60DpQOaA4sD\
kgPfAyQDwQEfAEH+CvxJ+nH5FvkN+Uf5D/rf+Tb5Pvg999v1/fTn9G31P/Y998z4bfmO+Xb5MvkA+Zj4MPjv97v3p/eh97L32vcX+Fb4uvgz+ar5JfrH+of7\
Nfz+/MP9gf43//n/rABhAZoBewLgA5cFaAdXCWoLfQz+DBgN5QyNDAUMVQuVCsgJ1wiYBy4HTwepBxUI/ghXCdsI7Qe+Bm0FAwSKAhcBrf9H/gH9t/uN+nf5\
hPiv9+f2SvbC9WX1FfXv9N706/QO9Vn1qvUW9pf2LffH93f48fjA+Tz7HP0r/1IB1ANoBWIGCgdhB0kHXAf/B/cIAwoPCwMM7Qy6DVUO0Q44D1YPXQ8yDwIP\
mQ6aDncNowtcCeQGBwRcAY7/Tv5Z/Zr89fuB+/36qfpT+lH6G/oV+aL3BvZf9LzyOfHK74jueO2U7O3rbusx6xvrMut66/Trlexi7UXuaO9+8LLxEvOC9P/1\
Fvf1+Ez78P2xAG0DDwalCAILTw1QDzARyRItFFsVTRYHF4wX0RfeF7YXXBdQF0QWYRQEEmIPlgySCYMGhwOGAKn9ffo4+M728/Va9Rv1BPX49B31U/W59Rj2\
kPYT9433FPiV+CX5s/lG+tD6Wvvd+2H84/zh/eb9T/1o/Fj7BvrH+Hf4nPgl+cf5APtq+0H72fpK+qn5E/mO+Bf4qvdP9xD38fbo9uj2C/cn91L3UPjG+YP7\
Wv21/z8BNgLWAjUDfgOmA8EDuwPCA60DnwOAA10DQgMjA/QC0wKuAoACWwIuApwBtgFhAmUDgwSvBdYG7wcFCesJrwptC/sLaQy3DOwMJw1LDWoMBAtBCUQH\
PQUuAwwB+v75/AT76vji92n3a/eg9wP4dvgK+aL5RvoJ+/X79PuH+8z69vkj+VL4f/fM9iv2k/XU9Bj16fUH92H4NPqD+0L8nvzT/PH83/zX/M78zPzR/OH8\
8vwB/S/9WP15/U/9/f0k/4wAEwLuA2AFFgZYBmMGNwaRBaQFIgbgBpcHYwgeCcIJTQrNCjUL4gttC2sK+whaB0sFjQOCAuwBgwFHAQ4B+ADtAAkBWwAs/8j9\
MvyZ+g35jPcp9uD0vPPF8unxOPG08FnwI/AV8DbwZ/DO8DzxlPHT8pn0oPbS+BP7Xv2Q/8QB2wPOBZkHUQnaCkcMdQ3lDpcPgA/uDgQO1wwnC0IKvAlyCUIJ\
egkyCSoIvQYRBUsDewGg/9H9Jfx2+qL4U/fR9s72Ivem90f4BPnB+ZX6Y/s3/Pn8w/15/jj/3P/rAA4BnwDV/+3+qP2l/GP8ifzq/HT9BP6m/kb/2v9vAFIB\
zwGQAd0A8//l/sr9tvyu+6v6tfmt+N336/dh+D35L/q4+2j8rvyf/Gn8/Puj+wn8zfzN/en+hQBVAZIBiAFLAeoAiwAeAKz/Pv/W/nf+Fv7A/XD9Kv0G/dz8\
yvyv/LL8t/zM/O38DP02/XT9hv2V/Wv+pP8HAYYCaASZBSsGYwZhBkcG+AWeBTkFxARGBNoDPAOfAgoCbQHRAAoAHgCqAFABMgIIA+gDsARbBRcG1AZpB9QH\
fQi3CCQILAfaBWMEXgJCAZQAOQAQABIA//8PAAQAIAAeACAAFwALAPr/6/////7/F//p/Wn82fpN+dP3XfYX9eTz4PL18TvxqPA+8ADw7e/67yzwePD08Ibx\
OvII8/Pz8PT99bz2K/gS+jf8kf7fAC4DXwV6B3oJQwtRDYwODA8gD+cOUw5/DUsNWw2KDa8N2w3xDfQNxw2YDV4NMw0JDGEKbghBBqYDoAFDAEj/hv4Q/tv9\
0vxx+9T5Pfij9hz1rPNi8kDxO/Ab7xPvne+B8JXxTfN+9Dn1q/UH9k72VvYc92L42vmG+yT93/6DAB4CpAMVBWIGnwezCKkJfgqTCwEMnwvpCtwJqgjrBg4G\
jAVOBSUFcAU6BWgELgPPAUwAav5n/ez8tvy+/Of8Hf1P/ZT94P0h/mf+sv7r/in/Zf+4/9D/z//k//b/BQB3AAMAGv/p/Y/8KPvY+X34Pvcw9lj1fvTa8zfz\
j/LU8pzzr/QD9sn3Ffna+V36vvoC+0L7gPu++w38TPy4/Aj9aP3J/TP+lP67/pj/4QBRAtgDZAXrBk8IlgnLCuULIA1jDSUNjgywC7kKlwlWCBgHxQV3BNQC\
DAK+AbUBzwENAj0CgAK1AvMCIgOoAzsDYgIsAeL/i/4y/dr7lPpe+UX4R/dr9qf1BvWL9OXzv/M/9DH1bPbM90j5wfpR/Mn9Of+1APYBLwNWBGgFYAY9B/oH\
qggtCZoJLgppCs4J1AiJBx0GlgQMA3EB5v9i/gL9mvta+jD5Kvgv91z2svUn9av0VvT788/zb/R79dn2TPg9+n/7V/zm/FX9k/2y/Xn+lf/aADMCfQPNBAQG\
IgcrCEYJMQpLCu0JTwlwCBcHPAb0Bc8F1wXlBfoFCwYEBvsF3gUdBqoFkQQtA58BDwBY/pP8BPt3+Qz4v/aa9ZP0s/Pj8lzy5/GQ8SzxL/H+8THzu/Rd9hT4\
0/mO+0T98f7OAFgCLAOmA9oD2QNkA5gDIgTZBKgFiwZIBwkIpgg4CaEJZApSCqIJmghkBwgGmAQeA6wBSgDa/oP9Sfwm+wj6B/k7+Hz3w/Y59sf1ePXo9B/1\
2vX19j34yPli+1H83fxU/Zn9dP3i/cb+2f8bAX8C3AOEBMkExQSgBEwE9AOBAxEDmQIjAqsBMQG5AEQA1P8V//n+RP/o/7MAwQG7AgkD9wKkAisCrwEWAYQA\
3/9W/77+RP6//VX96vyA/OX7yfs7/AP98v36/ggACQEEAvwC4AMEBZcFjQUuBYUEvwOZAjQCIgJEAocC0AIgA2gDrAPeAxQEdgQEBCsD/wG3AF7/Bv6w/GT7\
LvoS+Qb4HfdQ9pz1BvWP9D70B/Tl8/nzE/T787f04vVX9/v4pfpj/BD+tP9SAdoCSwSABbMGrQeoCHoJKgq8CkMLngvSC+cL6wvhC88LAAu+CS0IZAaMBKIC\
vwDh/hP9W/vE+Tr43Paa9YH0k/PH8h/ymvE+8Qfxt/A/8Uzyn/Mk9RP3lfiz+Yj6L/u++xD8Av1E/qr/IgHrAkQEBAV2Ba4FtgWkBXsFRQX9BKoEWgT/A5ID\
KgPIAlwCowGhAQsCpAJRA08E7wTvBKEEKASFA4YCLAIvAmYCxgJqA70DegPkAiECNwFNAFf/bP6J/aj8pPvt+tb6K/u1+1b8Yv3C/br9gP0e/cD8Svzb+3b7\
JPvT+jn6YPr2+tL7x/zm/f/+CgAYASACEQNEBMIEuQRfBNgDPwOHAs4BBwE/AI3/cv4d/i/+if4O/53/RgDdAHoBBQKFAlkDdwMIA1sCewFrAF7/6P7Z/vX+\
NP+I/+H/IgBxAMUABgFCAXUBpAG+AdUBPQIAAjwBLgD+/r/9f/w4+xn6/fgE+Dv3W/aa9ff0fPQn9Pbz4fPy8xH0TvSh9Bj1lvXY9er2b/gc+vL7y/2f/2oB\
IgPFBFEGsAcCCSgKLAsPDAkNog2SDQENPgw1CxYK1wiMByoG2gSBAy0C2wCU/2T+Qf02/EX7WvqT+db4HfiA96j3I/jl+M/5Jvvm+y38UvxY/DT8/Ptq/Cn9\
Ev4M/2oANQF4AYcBdAFBAfkAmwBQAAMArv8I/wf/Xv8KAL4AlwFtAjgD/AO0BEwFMQZ3BjcGmQXOBMgDmwIXAtoB3gH1AR0CNgJRAmkCfgKUAqMCngKKAnEC\
XQI5AgMCyQGhAV8BKAEaAVQAIP/K/Un85Pp5+Rj4zva09ab0zPME83PyAvK18YbxjvGh8dfxOfKw8kbz9vPA9Jj1fvZ994D4ffmK+qD7tfyI/fH+pwB0AkUE\
XQb7BxoJ3wlcCqYKjgrsCoELIAzHDGYN6A1ADokOsA62DugOVg4yDcYLLQpQCHwGHgUnBFYDqgIRAnsB+gBtAOP/Xv/w/mD+4/15/Sz9zfx+/C381PuJ+0b7\
AfvK+vP6lfqy+Z/4cfc/9uD0XvQ49HP02fTF9Tn2S/Yq9gj22PWw9ZH1jvWY9br19fVN9qj2IPer9zL4nfis+RP7sPxT/lAA5QHwAr4DSAS2BM8EZQU7BjwH\
IAhhCSQKZgpCCu8JSwlxCBEI/gcJCDUIWwh2CHAIawhZCD4ISAisB44GMAWqAyICkgD4/nv9D/yt+mD5Qvg590f2dfWt9Ar0JvSq9Hf1YPZt94f4svnc+v/7\
T/1z/v3+Nv88/0L/zP74/mX/HgDiAOkBvQIGA/UCxwJlAvoBjQEIAYYACACG/x//r/5L/vT9mP0F/RP9gP0o/u3+7f+5AI8BYgIsA+sDkAQwBbMFIwZ9BvsG\
RgfnBiEGMAUYBJcCmwEaAccArQCMAIkAhgCHAIkAhgBzAG0AVgBKADcAUwBNAJP/lv5p/SX8mvqk+Sj5BfkK+Uf5gvnc+X36yvrG+nb6EfqI+a/4gfjH+Ej5\
+vm1+pP7YPw7/RD+5f6u/2sAFgHOAWIC+AJuA94DQASMBM4EAQUjBSwFMgUmBUUFLwVzBGgDLwLKAGX/C/66/HP7RfoU+fb3lvem9/T3b/j/+LH5X/ob++H7\
pvxn/R3+0v6G/zYA0QBgAeYBYwLcAl0D3wOlAx0DWwJ8ATwAjP9E/zb/Y/+Y/9P/JgBwAKwA7gB/AYQBEAFXAIP/lv5e/e/80vz3/DL9i/3z/VD+vf4s/5b/\
/v9LAKgA+wBFAYMBygHyARYCNwJlAqkCOwJsAW0AWP/s/fP8h/xg/Gb8ifzH/BL9Y/25/Q/+vf7s/qL+Cf5t/bb85Psy+4P65Pld+ej4kvg5+BT49ffw97H3\
Qfgi+T36cvvN/CD+cf+zAP8BMgOWBE8FlQWiBX4FAwW3BNYEIwWYBRQG2AbLBmUGxQUDBf4DJQO/ArUCtgLXAvYCHQNVA5IDRQOiAs4BzQDR/7r+s/23/Mv7\
4frm+ZL5u/ke+pj6hvsP/Cn8CPza+5r7GvtG+8D7e/w9/Rz++/7V/64AiAFNAkADhwNwAw8DmgLUAU0BOAFjAbMBAgJfAq0C/QJOA5EDDgQhBKgD7gIIAgkB\
9v/y/vX99vwK/DP7b/q0+Q75ivgc+ID3j/cP+Nj4wPnw+uz7fvzI/Pf8BP0l/Tf9Qv1W/XL9X/2L/Sf+B/8TAB0BcwItA4UDqgObA4cDTwMFA74CeQIpAo8B\
iAHZAU8C3gKqA0MEUQQYBLsDNAOVAvwBUgGjAAUAbf/X/kD+w/1H/dL8cvwi/N77p/ty+0/7Pfs1+zj7TPtn+4j7rPvh+xv8aPys/Pv8Sf2r/QL+Y/5//g//\
7v8JAS8CYwN2BIEFgAZmBy8I3wh2Cd8JOAp9CscK5ApnCoMJYwgdB30FNARFA48CBwKzAXwBqQCO/0j+9vym+2v6GfmZ9/X2yPbd9iP3v/cx+DH4Aviy92j3\
0fbh9lL3BvjZ+Mv5wfq7+8P8tf2k/pr/dQBFAQkCtgKDAxsEJQTUA18DtQK/AU8BMQFIAXEBzgEbAugBYAG5APD/K/9U/o79zfwb/Hr73fpY+uz5jflA+cb4\
2vha+Rv6BfsC/Ab9Fv4W/w0ABQE2AtMCCgP5AsgCfwIgArQBRgHcAGsAu/+J/7D/EwCNACUBsgE8AsQCOQOkA1sEewQkBJQD3wIUAkEBWgB8/6j+2f3V/Ef8\
Lvxj/Lb8J/2e/Sv+q/4r/6L/LQCVAPwAXQG0ARACgwJVAtUBHgFAAB7/bf4V/gb+Jf5X/pj+2P4h/2D/m/8nADoA2v82/4T+wP3u/CH8ZPu4+hn6UPns+Av5\
b/kL+sL6iPtd/C/99/3T/pz/ZQAPAbgBVgLmAmED3QM+BIgE0gQfBTIFIwUmBQsF7gTKBI0EXQQRBL0DagMLA6ACLALTAXwBCQGmAFYAGgAx/w3+p/xU+/b5\
q/hk9032RfVU9FzzMfNp8+fzlvRz9WH2Wfdg+Hn5gvqW+6X8rf2x/qT/kAB2AUICBgO8A2oELQVaBSIFpgQSBDMDjQJXAlsCcgKoAhoD8gJ2AsoBEQFCAHz/\
tv7x/UP9kPy6+4n7qPsK/Jf8a/0B/iL+Gf7l/bL9Lf1B/aD9Mf7a/sf/gAC5ALYAnABkAB0A1v+I/z//9f6g/ln+kf4Q/77/agBwAd8B/AHjAboBdAEuAdAA\
dwAjAMz/Of84/3v//P+SAGMBDgIzAh8C5AGLAd8AtwDkACoBngEwAqsCoAJVAuMBUgG4AB0AhP/k/kr+1P1I/c38ZvwG/Kz7cPs9+w/79/ro+vT6+/oV+zb7\
Y/uZ+5r7Dfzc/N39//41AHIBFwKMAscC5wKwAuACUQPgA4AESwX/BQoG5gV6BfwEJQSxA4wDjwOnA8sD8AP6A00ESQTxAzEDZwJwAXUAaP9i/mz9evyk+9L6\
CPpm+dD4Ufih96H35veJ+Dj5Gfrx+uP7v/yo/Yf+Z/8xAO8AoQFRAg4DqgOvA3EDBgNxApkBMAEXAScBUQGwAf0BuAE/AZkA4v8j/2z+sP0F/VP8u/ss+6r6\
Nfrk+Zf5Ifki+Z75TfoZ+/377fzX/cH+s/+HAGEBJALYAoIDFQSuBEQFQAXsBGcEugO/AisC4AHLAdUB9wH/AQ0CHwIpAikCeQJBAqwB1gDx//f+9P33/Az8\
Lftb+ln53PjF+Af5Y/nx+YT6JvvQ+3/8H/3R/Xj+Ev+p/zkAywB5AZwBZwEEAYQAvv88/yv/UP+S/+X/NACBAN8AKgF4Af8BIALNAUkBnQDu/yX/Zv6e/fH8\
Pvx3+/z6+fo3+677MPzM/GX9C/6w/lP/5f93AAABcAHxAV8CAQPhAoUC5QE7AUkAk/9I/03/Wv+R/8L///82AGMAqwDpAC0BVQF7AZABrgGxAcEBzAHvAW8B\
ugDW/9X+kv3D/Ff8Jvwi/EH8a/yl/Nr8F/1f/aj96/0v/oD+y/4H/0//jP/C//T/IQBKAHgAjQCjAMAAzwDTANAA2gDGAMMAtgCsAJMAgQBuAFQAdgAGAET/\
VP5N/V78XPt1+pL50vgq+FP3K/dc99H3avgo+fj5yfql+4f8Yf03/hD/6v+mAF8BDAKwAj0DygNDBLUEQgVEBdgEUQSeA7AC2AF8AVoBTgFZAXQBiQGlAb4B\
0QEPAh8CqgEHATgAWv8t/ov9Rf02/Ub9nP3U/aj9OP29/DD8Yvsk+zD7hfvt+3b8Av2f/S7+yv5b/ykAbwBnACQAyf9G/8j+uP76/ln/xP9+AMAArwB1ABoA\
vf9H/9z+cP4V/qv9XP0W/dX8m/x6/GL8UfxD/Er8Yfx6/Hj8tvxK/R3+/v4IACIBuwEmAlgCawJnAmoCUgIbAgoCBwLpAcMBhgFSAY4B+wGLAhwD+QM6BDQE\
AgSpAxcDlAJxApQCyAIOA0gDjAO4A+gDAgRGBF4E6gM4A1sCbQF8AHv/i/6Y/bj84fsl+3r60vlM+dD4Nfge+Gf45PiU+Xf6VfvK+w38MfxG/FL8Z/x4/In8\
ofyr/LT8Lf3w/dD+tP+oAJEBbAI6AwUE0QSZBckFrwVnBfcENgTMA7oDrwPVAwAEQwT2A3cDwQL1ASEBRwBi/4j+uP35/Ef8pvsN+476F/q5+Wb5J/kC+eL4\
3vjv+An5JPlf+af59vle+rT6Hvua+w/8kPwR/Z39H/6g/vH+lf9zAHoBkgKtA7IErwWbBnkHJwjYCFUJvAkECjoKYwqSCiwKYQltCEgH3gWtBNoDPwO6Ak4C\
GgJuAWsASv8i/rr8ofvz+pD6WvpD+kv6WPpx+pz6y/oi+0X7XfuQ+8n7Bfw//IL8yvwD/UH9fv2//fT9D/5Y/q3+6f4m/2//tf98/wH/W/6l/e78PPyL++T6\
U/rL+V35Avmt+H74WPhT+Fj4aPiR+Mr4Dflu+cb5N/qr+iv7iPs3/DP9T/6V/9wALAIdA8MDPwSMBNYE7AT9BAAF+QTmBMUEngR2BDwE/QOTA1oDbwO9AxYE\
ewTaBDwFggXABfQFGQYpBigGGAb8BdMF1AVJBWEEVAMiAvoAxv+N/m39U/w++wr6gfk4+Tb5VPmp+eH5Qfqq+hX7ivsE/HT85fxi/cz9Ov6h/gj/Zf+4/w8A\
WQCfANQADwEyAYoBqQFOAcgAFQBj/5T+yv0O/VX8qvsK+3/6Dfqk+U75C/mh+L/4MvnS+Zz6pPt6/AH9W/2e/cz9vf0N/pf+Tf8YAOwAtgF5Ai4D6AN5BEcF\
mAWKBTsF1ARGBJoDUwNBA0gDXQOvA5oDKwORAt0BNQFZAHT/n/7T/R39bfzc+1H7z/pa+gb6u/l3+VH5M/lB+VP5iPmx+bT5O/oE++n78/wr/j//5/9dALcA\
AQEzAVUBawGMAZUBsgG4AbQBpwGoAZ4BWAGCAeQBcQL9Aq4DQwRxBGMELATLAzED9QLoAgsDRQOmA90DogM4A6sC+wENAYQASgAxADcAUQBfAH8AmACqALsA\
/wDbAGoAwP///jf+b/2o/Ov7RPuY+g/6jfko+cv4ivhX+EH4N/g5+FH4e/i2+Pz4S/mo+Rb6jvrf+qP7nfzD/eb+FQA4AVMCXANbBEoFOganBtIGyAaLBgwG\
zgW8BdgF+QUcBi0GPgY4BisGFgYgBtAFGgU2BCMDAQK1AOD/UP/y/qL+Y/40/hH+7f3V/br9l/2C/WL9WP07/Wz9VP3V/Cv8dvu6+v75U/mx+CL4pfch9932\
EPd89x745vjg+XT60voL+0n7g/uw+9b7DfxJ/Ir8pvwK/bv9iv5x/10ARQEnAv4CzAOLBCoFyQVgBtUG9wbJBnUG5QVPBaUE6AMvA3QCsAH2ADcAhf/Z/kP+\
pP0i/Z38NvzQ+3n7DPsg+3D78vuI/GH98v03/lH+Wf5I/h/+Uf7A/kX/3P+0AD0BaAFkAUkBGQHbAJYATQD//7//Vv8o/0//ov8LAIoAAgF5AesBWgK1AkQD\
fANUA/cCdQLfAUIBmgD1/1P/uP7+/Xn9Uv1t/af99P1//pT+gf46/vD9b/0n/SL9af3J/UX+5v4g/xX/6v6r/lL+Af4U/lX+vf4l/9P/FAANANr/nv84/+n+\
7f4l/33/4f+AAK4AlABiAAwAuP9Y/+/+lf49/uP9nP1Z/SD94/zA/KP8hPx1/Gb8cvx7/In8nvzA/Nn8CP0j/Vr9zf2R/ln/NABDAfEBUAKGAqQCqwKZAoQC\
YQI8Ag0CrwGiAcoBGgJ/AuUCRgOoA/gDRgR+BMgExwTJBLYEoQSDBGEELAT1A6wDXQMIA7MCSQIKAmYBlgCK/3D+Vf0r/BX7D/oX+Tz4PvfN9rj20/Yp9773\
Nfhp+I34gPiC+Er4lPgX+c35m/pt+0/8MP0O/vD+xf+RAFUBBgKwAkUD5gNuBIUEXQQaBK4DAgOjAoECggKdAtACBQOzAkYCqQEQATgArf90/13/cP+g/8b/\
k/8w/7j+KP5w/Qr9+vwO/Uj9h/3Z/TL+j/7X/jD/sf/i/7v/bf8S/5L+Av7R/eX9Ef5Y/t3+CP/2/rr+aP4e/r/9bv0h/dj8lvxq/DL8D/z/++376vvu+/77\
Hfwv/GL8mvzQ/Aj9SP2O/eP9Kf54/s7+GP9r/7r/BwBYAKcA7AA8AXEBuQHwAR0COwJJAmwC0gJWA/ADjgRCBYQFkAVtBSQFqARVBDsERARbBIAEwQSaBCME\
kAPqAgMCXQHuALYAmgCGAHgAeQBuAGsAYACcAG8A6P83/3T+qP3c/Bz8bvu/+hz6j/kh+a/4UPgc+BD4/fcE+CL4PPhw+Kn49/hO+bX5FPqN+g37kPsH/Hj8\
Qv00/jv/TgBkAWwCZwNTBC8F8QWiBjwHugckCHUIuwjpCPgI7QjVCKUIYwgQCK0HOgetBloGqQWXBFcDCgKUAAX/5/0l/Xj8/vvG+2v7uPrz+SX5Ufhl9/P2\
3fbx9jP3sfcQ+CT4IvgS+BD4AfgF+Bz4RPhw+JP46PiT+XH6Z/tq/HP9ff52/3UAawGIAkEDqwPnAwAE/QO3A8oD+ANMBI0E6wQxBWkFoAXJBeEFFwbcBVUF\
pgTaA+wCAgJpAQgByQCcAKEASgC4///+RP5l/aX8MvwR/Af8GPw8/Gr8lPzL/BH9fP21/Zf9Yv0I/aj8Tvzo+5H7RPsJ+9j6sfqL+ob6ifqS+qD60Prz+in7\
b/up++z7gvxI/Sn+F/8DAOwAygGnAnQDQATfBF0F2AU3BpMGCgcjB+AGbgbSBScFZQSaA80C+QFIAY8A3/8w/4H+4P1F/bv8OPyv+037Pvtv+8r7Mfyr/C/9\
tf0y/rD+N/+1/xsAhgDvAEgBygHhAbkBYQH/AG0A9//G/83/3/8BADMAawCRALMA4AATASYBLQFCAU4BUwGCAVcBzgA9AID/u/7m/YX9WP1A/UD9i/2C/Tr9\
3Pxp/AT8kPss+9j6h/pN+ur55vk6+rH6Sfvz+8X8MP1z/aP9wP2v/ej9Uv7d/of/PgDPAGwB9wF8AgQDhAPgA0wElQTWBA4FVgUqBcEEKASAA8kCFQJFAYAA\
yP8I/zz+zv2p/bX9wf3v/Rv+Tf6G/r/++v5c/0r/CP+x/kT+2P1l/ff8j/w+/Pn7o/tp+zz7FvsA+9f67vpO+937kPxO/TP+wP4a/0j/ev+Y/7X/w//L/+D/\
5v/M/wwAdwD3AJIBIQKvAi4DogMZBIAE1AT5BCAFMwUxBTYFMgUWBQUFxwSYBFEEBwTFA3ID2wIHAhwBEQDU/uP9Rf3b/Iz8Vfwo/Ab89Pvo++77HvwR/LX7\
RPvN+k361Plb+Qj5vvh3+FL4O/hB+Eb4Z/iS+Lb4Ofns+dL6u/vo/Mz9fv4D/3j/2//8/4QAKgHZAY4CQwP8A48EJAWvBScGogbFBpAGQwbCBUcFqgQQBGID\
vAIOAj8BzgCUAIMAewCQAJYAnwCmALgAuQDPAMYAzQDCALYA0gDDAFEAv/8W/2/+p/32/Eb8o/sP+5r6IfrF+Wf5M/n8+Lj41/g++db5f/pH+wT8yPyU/VX+\
Gf/U/38AIAG5AUwC1QJEA6EDBQRLBIkEsQThBPYE9wTmBOAEvgSUBF0EJgTYA7wDMQNsAncBdwBe/1P+pP0z/eP8t/yL/ID8Yfxf/F/8fPyQ/Fb8/PuB+wL7\
kvoh+r35Zfkn+fn41vjK+ND45fj9+Cn5afn/+aj6fvtn/FP9SP44/xYA8gC+AYICOAPHA3AEFAWIBfcFWwaWBr8G3gb2Bu8G2Aa2BoMGOAb0BZ4FPAXHBGIE\
5ANqA+gCYgLYAU0BwQA8ALL/Iv+n/ij+uP1E/eb8fPwn/NL7n/te+yn78/rd+rr6r/qq+qj6q/q++uf6Gfvk+p/6OPrl+Vb5O/lM+Zj5BvqL+gf7mvs7/NL8\
Y/0u/qT+3f7t/vH+7/7g/sv+zf7B/rL+h/6q/gj/cv8IAKAAMAG0AT8CxwI4A6IDAgRKBI8E0AQLBTcFDwWpBCIEfAPUAhgCZwGxAAQAUv+Y/jv+H/4n/kP+\
af6X/sL++/45/2z/oP/K//n/JwBFAJoArgBmAAcAlP8L/47+C/6L/Rj9nvw2/Of76vsb/HX81/xI/bf9Lv6j/iT/rv8RAC0AHwDw/8D/h/9E/wL/yf6I/mj+\
Lv4E/uj9xf2v/Z39nf2U/Z39o/3O/c79yf3c/e79DP40/lT+jf6z/tn+Bv9C/1n/if/I/xQATACFAMcA7gAhATUBYwFwAWgBlQHqAVwC2AJVA88DPwShBPgE\
PwWlBbwFhAUcBZkEAgRcA68CAAJLAZoA9f9Z/7D+G/6O/Rb9mPw1/MT7hPsq+w770Pqw+pr6lfqj+qr6yfrw+h/7U/ud++X7NfyG/Nj8Nv1u/QL+sP59/0oA\
IgHpAZ8CUgPpA4UE/wRxBcoFGgZNBoYGmgalBpAGeQZKBhwG0wWBBRsFsARxBOYDAQMFAu0Awv+a/n/9cPxo+236kvnA+A34Yvfp9nr2/PXt9Sn2l/YZ98f3\
efgx+fP5vvqI+1/8Hv3k/Zb+VP///6AANgHIAUUCugIfA4ADygMHBDgEgwSRBEsE4QNfA7gCCgJiAa0A8v9R/6f+F/53/fn8i/wW/LL7ZvsY++X6sPqP+nP6\
pPoT+6P7OvwB/Zn95v0s/lf+lP6i/qD+uP7D/tX+6/4F/xf/M/9N/2z/g/+O/6z/vv/o/wUALgBZAGQAgACVAKAAsQCtALoA9ABZAc0BTwK5AiYDjAPoAzUE\
lQTFBKgETQTqA1kDzQI2Ap8BBAFeAM3/Nf+t/iX+tf06/aj8cvx1/J385fw5/Yb93v1C/pz+9P5C/5z/6/8xAHAAqgDkAAoBLAFcAWMBfgGFAYoBfQF4AYgB\
fgEiAZoA+P9H/3H+4/2R/Wr9W/1m/Yj9X/33/Jn8OPzT+3D7FfvJ+or6aPo3+hP6DfoH+hT6E/pQ+tP6dfsu/AT92P1p/t7+MP9r/67/5P8MACwAVQB7AJEA\
qgC+AN0A5ADLAPAAQwGnAR0ClwIxA14DbwNfAygDxQKZApECqQLFAvwCIgMGA7kCUgLLAVMBxQA4ALb/K/+u/hP+zf3O/d39Af5b/oX+eP5D/hH+w/1i/U39\
dP20/fD9RP6e/vD+S/+e//L/YwBdADwA7v+d/0H/6P6N/j/+5v2m/Vb9H/3Z/I38pfwE/XP92v18/tz+Bf8O/w7/+/7U/u/+Of+J/+7/WADBABsBcQHKARoC\
WgKLArsC5gIAAzcDNAPYAmwC4QFBAacAAwBg/8v+PP6v/TH9s/xN/OD7jPsZ+wr7N/t6++f7dfze/Bb9Mf0//UD9Iv1L/aj9Lv6k/kP/vf/2/w8AHAANAOD/\
+/8uAIQA2QA5AZYB4gE3An0CtgISAxED1wKCAg8CngElAacAMACq/zn/k/5V/kH+Q/5x/pT+yP78/iz/ZP+U//T/8P/D/33/I//N/mP+A/64/WD9Ev3P/Jj8\
YvxD/Br88/vq+x/8ivwA/YX9Pv6z/vn+Fv82/z3/OP95/9b/TAC/ADYBmQEBAk0CsAITA1wDWwMjA9sCbwIGApcBJAGsADMAwP9V/+L+fv4a/rv9cv0j/eT8\
pfx//E/8KfxN/J/8Ev2H/Uz+lP64/rv+xf60/pf+wf4q/4H/4/9NALkAHAFqAdMBPwJ/AssCGwNDAyMD0gJpAucBRAHgAK4AkACHAIgAiwCBAIwAhwB+AJ0A\
awD//3b/8v5k/tH9Pf28/D780vto+x/71Pqc+mb6U/pH+j76R/ps+ob6kfrj+nT7DfzO/KX9dv70/mD/sP/2/xEAXwDJAFQB2QFoAuwCZAPQAzEEfQTLBAUF\
MAVVBV4FagVwBRkFlwT3Az8DhwLMAQMBOAB+/8n+HP5o/dH8RfzG+y373PrN+u/6Kft4+8n7K/yS/P38W/3T/TD+kP7z/kn/t/8fACoAIAD0/7r/gv85//L+\
qf5v/jj+BP7P/aH9dP1d/UD9Pf0s/TD9Pv1F/VX9a/2N/bP9x/3i/Q7+df7y/o7/KwDbADgBgQGbAagBkQGcAcoBDQJgAroCHgMyAyQD8gKrAlgCCgKiATkB\
3gB9APn/wv+//8z/7/8wADsASwBeAHMAjADAAKYAcAAHAIr/Gv+v/jD+jf1J/Vb9YP2R/dL9H/4o/gL+5P2k/Uz9Lf03/Wf9r/34/Un+nv7u/kn/lf/n/y8A\
dACvAOYAGAFcAVABFQG/AFkA0/99/0j/Rv9L/23/nv+N/0v///6X/kz+4v2H/Sv96PyW/E/8Q/xq/LH8Ev12/eX9Sf65/ij/jv/w/04AowDyAD4BfQHAAeEB\
DAIuAkkCWwJlAmICXQJUAkECJwILAuYBzgGPAXABOwECAbwAiAB1ADEAn/8D/03+l/29/D389PvO+7j73/vr+8D7gPs8+/j6kPqJ+qf67Po/+7L7JfyO/A79\
if0E/p7+7P4W/yX/J/8V/w3/9f7j/tb+wv7E/r7+q/6t/rL+xP7F/sn+0/7n/vT+Ef8j/0T/TP9w/4j/ov+8/+H//f8RACoARQBZAG0AgwCbAK0AwQDBAMwA\
1QDbAOgA5ADtAN8A/QDqANEAvQCsAJgAigB3AGUAWgA8ADEAHQD+/+z/2v/r/9L/4P/a/7D/x/8CAFMAqgAnAXoBjAGBAWsBQAHqANYA5QABASgBcgGeAYgB\
VQERAa8AXAD6/5//PP/k/of+Ov7s/aj9av0v/eX84Pz8/Ef9mf0a/mr+mf6m/qr+lP5q/m/+qf7m/jj/lv/p/zMAiQDZAA4BUQGKAb0B4wH+AS8CQgIQAsMB\
TgHZACoAxv+D/2z/UP9R/2H/MP/V/nH+/f2e/SL9xPxl/Bj8zvuL+0n7JPv3+u36w/ro+jL7n/so/Lb8Vf3p/YX+E/+a/yEArgAWAYAB6QFaArECxgKyAoMC\
QwLbAZUBdwF2AYIBjgG+AZUBVgH3AIwAFgCq/zD/yP5X/gX+fv1N/Ur9bf2a/dj9Gv5T/pj+0/4e/1r/mf/S/wAAMQB+AJ4AcwA7AO//lv9A/+D+iP4u/uP9\
lv1Z/Rf97fyy/KD8Xvxf/I781vww/ar9HP5W/nv+hf6U/pb+lf6Q/m/+uP4c/47//f9sAN8AOwGVAf8BUgKXAqsCjQJYAg0ClQFaATgBMgE3AUwBcAFGAf4A\
pQArANP/X//8/pD+Nv7Q/W/9T/1P/X/9rv3t/TD+d/65/gL/VP+b/6v/lP9x/zv/CP/Q/pL+V/4k/vn9y/2u/Y39bP1d/Uf9SP2A/df9Q/6x/kX/hP+2/8X/\
0/+9/8b/8P9CAJcA3wAyAYgB2AEcAlkCqQLMArYCdAIyAtwBXAHzAIMADQCp/0T/4v6A/h7+zf17/ST9Bf0R/Ub9jf3q/T3+Vv5d/kf+PP4l/hL+9v3k/db9\
vf23/eL9MP6P/vX+Z//X/zgAmAD0AFUBnwHhAR4CWAKDAr0CrgJ7AiICuwE8Ab8AhwBlAFcAQABtAEQA/P+c/y//w/5U/uL9gf0f/cn8XPwv/EX8Yfyc/OD8\
O/2M/eP9Nf6S/vv+OP9v/6P/3f8nAHQAcwBXACAA4P+N/1X/Av+F/nX+mv7E/vv+UP+M/4b/bP9H/xT/2/6w/nT+SP4W/uH9vv3U/RH+Wv6q/gX/ZP+0/wUA\
VgC+APkABAHtAMQAkwBSAA8A1P+X/1f/IP/t/qz+e/5b/jL+8f3v/RH+Uf6g/g//Y/+M/5z/jf+A/23/WP8//yH/Dv/m/sn+7/4q/3T/xf8eAHEAwQAPAVgB\
nAHXAQoCOwJbAnICrgKnAmcC9gGOAR8BoAAcAKr/Lf+1/k3+4v15/Rz9yPx//C/8KPxX/JH81fxY/ZP9sP26/cH9vP2y/c/9Gv5x/tT+WP+i/87/2//a/9L/\
0f+2/5r/jf98/2L/Yv9L/z//Of8k/wb/LP9m/7X/AQCEAMgA4gDdANMAqACKAF0ANwD//9b/oP+C/4v/r//q/zQAYwCTANwADAE5AV8BfwGbAbABwgHMAekB\
uQFnAQABhQAnAIX/7P5j/un9Yv3//Jr8TPz0+6r7efta+yb7AfsI+yn7Qftv+5P7vfvs+yj8Z/yk/Ov8NP1//c39Gv5l/qb+Gv+k/z4A1QCOARECWgKZAroC\
wwK6AtYCEwNJA30DugPzAw0ELwQ/BE8ERgQ4BCAEAgTOA6QDZwMcA8wChgI3AtwBeQEiAb4AYAAlAMD/JP9z/q399vwg/J/7RvsS++367Prn+uj6/Poc+zz7\
XvuO+7f79fsu/Ir8vPzY/L/8vfyV/Gf8dfyj/OT8O/3E/Q/+N/5K/lD+Vf5N/kz+Tv5U/lL+Y/5r/m3+gP6R/p/+nP7T/ij/j//9/3EA4ABIAbQBEgJtArMC\
9gI0A2IDggOjA8ADmANFA94CbQL3AXoB7ABuAO7/d//u/qP+gv5//oD+kP6b/rP+yf7o/gD/H/8s/1D/Yv9s/4H/m/+n/7T/wP/O/+P/sP9z/xf/s/4u/u39\
yf3Q/dP9EP4V/h3+M/5a/nP+sP67/qL+e/4t/v39vv1z/Sb98fwT/Tv9kv3d/Sf+cf7J/hT/Z//N/wsAHAAJAPP/0f+n/3n/RP8e/+T+0/6f/o7+Zv5V/kD+\
Ef4l/l3+ov79/lb/vf8XAHIAvwATAVkBogHWARICRgJ4ApIClwKpArICpgLGApgCPgLFAUcBtQAhAMj/hv9k/0n/Mv8s/xz/Ff8E/wn/A//1/u/+6f7o/gT/\
6/6r/kv+7/2M/TX92PyJ/Eb8Avy2+5r7vvv0+0f8tfwd/Uj9av2C/Y/9iP2x/ez9Tv61/jb/n//d/xAAKAA1AB8AKgBcAJkA6QA0AYYBpAGeAYkBWQEZAekA\
9gD6ABwBNgFcAXkBjwGqAboB2AHYAZYBRgHdAH4A3v+U/2T/T/89/1T/T/8U/8T+dv4e/sj9fP0p/d78pfxf/Dr8Tvx2/Lv8E/2L/cH96P3t/ff96v3+/Sb+\
ev7R/jb/l//j/zIAbwC4APcAQQF+AbcB2AEIAh8CLwI+AjgCTAJWAl0CUgI9AigC/wHgAbMBhQFJARMB2ACcAGEASwAAAH//4P5Q/rP9Av2j/Gj8Svww/E/8\
RPwc/On7r/tu+y37IvtG+4r7zvsk/JL82vxI/a79H/5w/tL+Jf+B/8//KQBtALYA+QA1AWMBlwG4Ad4B7wEFAioCIALkAZcBNQG8ADMA3/+6/5f/kv+k/5f/\
WP8N/7f+Wv7u/br9q/2t/cT97P0W/jn+a/6r/uT+Iv8n/xX/7P65/nT+RP5A/lf+gP65/hD/Kf8i/wv/8v7D/qD+qv7R/gX/RP+f/8v/xP+7/5z/hf9o/0n/\
Hv///ur+0v69/qv+l/6Q/o7+i/6B/pL+m/6e/o3+tP75/lL/s/8jAI4AxgDeAOwA4wDlANgAxgCwAJoAhQBnAE8AKgAeAPT/wf/J/+L/BABCAHsAwQDwADAB\
XAGJAcsBzgHQAcoB0QHVAdcBowFaAeYAdADv/4T/BP+A/iD+1v12/Sf96fyh/GT8MPz/++b7tPvD+/T7Tvyn/CX9kv3a/Qj+LP5H/lz+eP6I/pr+q/66/tH+\
D/9n/83/LwCfAAABXQGvAQECVAKcAqICjQJqAisC0QGbAY4BfwGBAZYBmwFxAScBywByAAsAr/9E/+D+hf4w/t39k/1T/RP92vyf/JL8rPzb/CX9c/3H/Rv+\
eP7I/iL/j//Q/9n/2//K/7D/jP9t/z//J/8J/9H+w/7V/gL/QP+G/9X/9P/3/+f/y/+t/4T/aP9A/xv//P7e/sX+pP6S/n/+VP5l/nn+t/4F/1r/tP/d/+r/\
7f/b/8n/uf+q/5D/fP9m/1r/TP80/yD/EP/2/vn+BP85/4H/zv8PAFcAogDcAA0BRwF+AaEBwgHeAf4BBQIHAv8B+wHpAdgByAGeAXkBXgEtAfwAxgCcAGEA\
OAAYAMn/ef81//X+uf6b/j7+2f1Q/cn8R/zY+0374vqS+mz6LfoN+vH5zvnx+Tn6nfoJ+5f7D/xV/I/80fwG/UT9df2u/en9H/5I/pr++P55////hAAbAWwB\
rwHKAeIB8gH8AfQB7wHgAcsBngGsAb4B5AECAjgCVQJrAoMCmAKiAqwCnQKWAoMCaQJvAkAC4gFtAfgAcQDf/1f/2f5N/s79Uv3t/Lv8q/yz/ND86/wO/TP9\
W/2V/cz9+P0u/mL+mf7M/hb/Jf8Z//T+zv6e/mf+Wf51/pv+y/4V/zD/Jf8T//v+zf6j/rP+0v4E/y7/hf+f/6j/lP96/0//Kv8x/0//dP+t/9j/DwA7AGsA\
mgC8AOkA/AASAScBNQFSATwB/wCxAFAACQCV/zH/0P51/hz+sP2A/X39hf2o/c/9/P0o/mD+kf7A/g//Lf8h/wX/4f60/oj+gf6U/r7+7P40/1r/Vv9E/yT/\
GP/c/sn+4/73/iv/Wv+O/8f/8v8SAEYAaACHAJwAtgDlAAUBHwE0AToBPQE9ATUBIgEdAQEB5wDMALcAjQBuAFUALQAHAOH/4P+2/1r/7P59/gf+dP0Z/fT8\
3/zd/N/8+fwM/TL9Tv15/Z/91P32/Sn+Tf6a/rf+tv6f/n7+Uv4W/gT+Df46/mr+oP7W/gz/R/+C/7b/6/8eAEkAdACZANMA+gDjALwAhgBDAPn/t/9q/yH/\
3v6k/mf+Nv7//eP9uv2K/YH9q/3e/Sf+gf7F/gv/Wf+m/+f/RwCAAIMAigByAF4APQAjAAcA2P+2/5T/d/9R/zX/Hf8F/9/+8v4X/1H/iP/m/x4ANAAtADAA\
EwABANr/0/+0/57/iP9y/1L/RP8z/zH/Ff8H//f++P7q/u7+7/7r/u/+8/7u/gT/C/8a/zH/Nv9E/1b/Z/92/4//k/+q/7n/x//P/+b/3//y/x0AXwCkAPwA\
NwFoAaIBwQHWAf4BIgI2Ak4CSgJYAkYCPQIsAgkC1wGEASIBrAAvALT/Kf+u/jf+yf1Z/fT8oPxD/AD8xPuX+2/7Vvs++z/7PftF+2P7gvuf+9H7BPxL/IX8\
1/wV/V/9xP1H/tb+Zf/w/4YAAAGDAfEBZwK+Ag0DVwOUA78D6AMCBBIEGAQWBAUE6QPFA5kDbAMwAxQDvgJDAqgBEAFgAMb/Gf96/tb9Qf28/EL80/tz+xb7\
yvpy+mb6gPqy+ur6T/ug+/T7V/zJ/DX9oP3n/R/+N/5R/mL+cv6j/uj+Ov+L/9z/KwB+AMQACQFYAZUBngGRAWsBPAELAd0AmwBdAB0A1/+Y/4r/h/+b/6v/\
5P/s/9P/sv9+/zz/Cf/t/vz+Gv8z/1//Z/9Q/zX///7a/q/+gv5c/jz+Jv7i/en9BP4w/mz+tv4F/x3/Jv8p/yD/Hv8Q/wH/6f7k/s/+yv7c/hD/S/+V//D/\
HgBGAHgAnwDXAP4AJQFTAWsBggGGAZ0BnwGZAYsBaQEZAcIAUwD7/7v/mv97/27/ZP9T/0v/O/8+/zr/NP8p/y3/If8b/zT/F//W/ob+Lf7K/X39Xf1E/U79\
Xf17/aD9xf3g/R3+Vf6G/n3+bP5W/jX+9/3v/fn9Hv5I/oD+sf7m/h7/W/+U/9j/+f/y/+H/tP+O/1j/Vv9e/4T/of/O/+v/EgAnAFEAdwCmAJcAeQA/AAoA\
qP+C/2f/bP94/5n/s/+j/3//V/8V/8/+oP6b/qn+uv7f/hL/D//8/uj+xv6j/oD+VP4//iD+BP7s/f39Kf5j/qX+B/9E/1f/bP9n/3D/Yv9q/1z/Vf9I/0T/\
RP9I/0L/Sv8//03/SP9Q/1n/Vf9t/27/af9q/3f/iv+E/4n/kP+a/6L/pv+7/8H/xv/T/9P/zP/n/xsAZACUAP8ANAFBAUEBMwEXAfYA0ACyAIkAXgA4AP//\
1f/l/+T//P8uACQADQDS/6T/c/9H//3+uv6a/oz+Zv5U/j3+Hv4K/vv95v3U/bz9wv3l/Rr+Y/6v/hH/Pv9Z/2H/bf9t/2r/X/9e/1z/T/9A/1n/if+4//r/\
MQByAKcA6AAZAUsBgQGEAWsBOwEFAb0AgQBkAFUAUwBTAFIAVgBfAF0AUQBoAFoAHwDZ/4n/OP/Y/ob+Ov7g/Zf9Xf0c/e78sPyV/HH8WPxE/En8RvxN/GL8\
d/ye/Lv86fwa/Ub9e/2x/fD9If5g/o7+5f5I/7v/MQCYAAYBaQHNARoCdAKnAtkCFAMyA04DZwNhAzED5QKRAi8CwwF+AVMBLgELAQQBxwByABMApP8o/8P+\
e/5S/jn+JP4j/h7+JP4d/h/+Nv4z/jP+Pv5Q/lj+bv51/oP+kf6k/rf+3P67/pv+Yf4m/vD9uP2G/VP9MP0b/ff85vzX/Nf80vzh/PH8//wO/TT9bP15/YT9\
tP3U/f/9EP5T/rP+Ev92/+f/WACxAAgBXwHPAQwCXgKhAvAC/ALvAssCkgJkAhkCxwFxASQByQB+AC8A5P+T/0L/DP/E/n3+Pf4R/uP9pv2e/ab9x/38/Sv+\
bv6e/t3+Fv9T/5n/vv+9/7T/oP+S/3D/Uv8t/xX//f7o/sP+tf6e/o/+ef5r/ov+uv74/iv/hP+z/8b/y//N/8H/tv+8/9//DwA3AGQAlgC9AOIACQEhAUQB\
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\
1P7K/tT+4v4C/yv/R/9k/4f/pf/C/+//DAAZACcAOwBKAF0ASQAvAAYAy/+d/2H/JP/n/qz+hv5V/if+/v3k/cT9n/2Q/Zr9s/3q/Rf+Yv6Q/qX+qv63/qv+\
q/7J/uj+Gf9e/5H/wP/p/xMARQB9AJ8AowCbAIYAbABUADIACwDc/6//jP9p/0P/G//9/uL+wf6t/pf+hf6A/nT+Z/5b/mD+Xv5k/nb+b/5p/mL+Y/5i/nL+\
mv7U/hf/XP+U/9z/GABNAIMAsgC/AMQAyAC6AJ8AgwB2AGMAQAAjAAoA4v/N/53/if+K/5v/pf/S//f/BQD2/+L/x/+b/3D/b/9l/3//jv+v/7j/rf+K/3P/\
Rv8l/w3/JP8x/z3/V/9g/3X/h/+f/73/x/+z/5r/ef9G/xf/7P7I/pn+bf5E/in+Ff4s/lD+Zv6f/r3+vP6+/rn+sf6o/pz+of6R/pD+f/6R/qn+4v4E/0T/\
e/+y/+b/HQBAAHYAlACsAM4A5AD0AAQBDgEYARsBIQEXARYBAgHyAOIA2gDJAIkASQADAKH/NP/3/rn+of59/nz+gf5f/i3+Af7H/Y39cv1p/XH9hv2j/c79\
2v3j/dn90f3V/cn9tv28/bf9u/27/dX9/f1I/oj+zf4V/0//mv/e/yMAXwCIAJQAmACBAIYAeQBdAD4ALwAXAO3/4v/u//v/GgBXAFIAMgAQAN3/vf+A/3L/\
a/9w/3X/gP+S/53/qv+8/8L/rf+d/4P/Xf8v/wn/4P64/oz+df54/oz+nv7I/vT++f4C//j+6f7Y/tb+wv64/q/+qf6n/qT+n/6w/qv+qv60/uT+GP9R/4n/\
yv8DADcAZgCbAM0A8QAQASIBPgFVAWABagF1AXABZAFyAV0BJQHsAKMAVwD2/8P/jv91/1b/aP9C/xf/zv6f/lj+Hv7k/ar9ef1V/SX9EP0M/TD9Vf1//bH9\
6/0Z/lP+h/7M/vb+G/9V/3v/qv/J//L/EAA5AFIAcQB+AJ0AmwCrAKcAswCqAK8ApQCgAKQAkwBgACUA4f+p/1j/G//I/oj+P/4Q/t79sP2A/Wb9Sf0c/SP9\
Pf1o/Zn93f0F/jT+dv6t/ur+NP9c/3f/ev+H/4z/jv+I/4r/gP+E/3H/ev+J/7b/2f8bADEAYACAAKsAxADyAPoA8QDQAK8AnQBbACYAFQAIAP//BwD4/+D/\
rv91/0n/GP/U/pT+Z/5x/mn+i/6l/rD+2/7x/gj/H/9N/1j/V/9I/yj/Cf/c/tf+1v7h/vP+IP83/zP/Lf8Q//7+3/7W/rn+n/6U/on+f/50/m/+Zv51/mT+\
df6i/tH+C/9R/4H/uP/s/ycAVwCRAKkArQCpAJYAfQBiAFgAYQBpAH8AhwCaAJYAsgCsALMAsgCqAKwAqACaAJIAhQBuAFgATQAvACAAAQDy/9r/wf+l/4v/\
b/9Z/zn/RP8f/+b+pv5j/hf+xv2X/Xr9b/1l/Xr9iv2n/bH91v3m/SL+Lf44/ib+H/4R/v/9A/4d/jj+Xv6S/r7+5P4X/0//g/+z/8z/1f/R/7f/s/+p/5H/\
eP9t/2T/Qv82/xv/FP8E/+/+7f4G/xn/Sv9x/6r/w//R/87/xv+4/7n/o/+l/4z/kP+E/4L/dP9r/1r/Xf9d/07/R/9M/0r/SP88/03/Yf+G/6//2f/r//b/\
5//p/9P/wf+u/5j/k/+Z/5f/lf+A/4b/iP+i/83/8P8WACAAHAAOAPb/2P/Q/8f/2f/t//7/FwAsADEARABKAGcAaQBKACEAAQDT/5H/cv9p/2j/Wv9f/2X/\
Xf9r/3H/e/9+/2n/PP8L/+D+u/6H/lX+Kv4N/u39yv2y/aD9i/2I/Xv9hf2C/Yf9mf2l/br91P3p/QX+H/4+/mv+mP7e/if/cP+3/wsATgCTANAAGAFAAVsB\
XgFiAVMBJwEbARoBHgEfASQBKAEhASUBHAEYAQcB9gDdANEArQCwAI0AUAAIALv/bP8a/87+ef4z/u79qP11/VT9VP1Z/W/9m/2m/aD9n/2a/Yv9hv2X/cP9\
8/0p/mb+j/6m/rH+tf7J/tD+5v4U/0X/dP+3/+T/+f/2//r/8//x/+3/BQAjAD8AawB9AG0AXQA8ACEAAwDx//P///8NAC4AGQAUAAMABQABAAwA6//O/5T/\
YP8g//P+uv52/lj+Tv4p/gz+Af7j/dD9wP20/bH9of2n/c79/v06/nX+uf7s/i3/a/+p/9z/EgA6AGQAiwC3ANEA6AD6AAwBDwExATEBBAHeAKkAcwA+AAcA\
zf+T/1v/Gf/t/uH+2f7d/vT+/f7p/tb+xP6s/nf+cf55/oH+j/7A/t7+7v4U/zr/V/9//5P/i/98/2j/Uv9H/yn/Ef/8/un+1P7N/rv+sf6i/pr+kv6m/r3+\
5v4H/03/Z/9z/3f/eP96/23/dv+Z/67/1v/0/x0ANgBGAG4AiACkAJUAhgBnAEEACQDy/8z/1v/N/9D/4//Q/6n/g/9Z/yD//v7x/u7+/v4E/yD/Hf8E//b+\
2f60/pP+lf6a/qn+v/7Y/vP+Df8q/0L/bv98/5X/ov/B/9f/1f/y//X/AwAGAB0AJAAFAOD/uv+H/2H/G//7/sf+pf6h/mD+J/7+/dj9yP21/aL9n/2l/Zz9\
o/20/bb9rP3a/Sr+Zf64/gb/S/+M/9P/FgBNAJYAvwDRAMkAxAC5ALMAkQB/AGQAVAArACAAGwAjACYAPwBFAF0AZAB4AHEAigCAAGcAQQATAN3/qf96/0L/\
D//b/qf+iv51/nH+gP6M/qD+tf7L/uX+9P4P/y7/Pf9d/3D/kP+o/63/mf+E/1r/Sv8l//7+3P7I/q/+mv57/mT+Xv5T/kL+Tv5N/lX+V/5e/mj+dv6G/qP+\
pv66/sj+6/4q/17/mf/j/wsAIQA7AEAAUwBPAFQASABIAD0AMQA1AEcAVQB3AJgArgC3AMwA4ADmAOwA/QDyAPYA8ADuANoAtgCEADwA+v+n/3P/Rf8x/xT/\
Jf8D/9j+sf58/kv+Cv7x/ef93v3z/f39EP4f/j3+VP5w/o/+qf6Z/pv+g/58/mn+Uv5O/kb+NP4t/jH+WP50/qX+9/4Z/xb/MP8j/yn/I/8r/y//Kf8j/x7/\
Jv8c/w7/Gf9O/23/rv/i/xkAMABHAEcAQgBJACsAIQAQAAIA3P/M/8//1P/i//X/HgA6ACYAGwANAPf/y//D/8r/xv/L/+j/9v/r/8//wP+c/3X/Y/9e/2T/\
aP9//4f/g/+T/5//sv+5/7j/xP/K/8//zv/O/7//xP+5/7v/vP+i/3j/Vv8j//z+v/6O/ln+Of4G/un90P2z/aD9j/14/Xf9gP2k/d39Bf5H/nj+k/6p/rr+\
2v7Y/un+Dv9A/3H/rf/Z/+b/+f/9/wgA/f8RACkARwBlAIoAlQCdAIsAeQBdAEAAKAAJAN7/x/+i/4v/Y/9N/zX/Hv8F//z+6/7e/s/+yf7D/q3+t/63/rv+\
tP63/rf+v/67/tH+1f7p/vD+Av8Y/yv/M/9L/1H/Zv95/5P/lP+n/7P/v//F/93/+f8nAEYAeACeAMQA1QDzABYBHgESARAB+ADzAOcA2gC3AIIAQQAOAML/\
f/9B/+n+1v7O/s7+zv7K/s7+yP7N/sn+2f7d/sb+pv6K/l7+N/4c/hH+F/4n/j/+Tf5i/nb+lf6w/tn+7/7r/u/+7P7f/tP+x/68/rP+o/6c/pn+pf7D/uv+\
KP9F/1H/Yf9t/2f/Zf9h/2H/Vf9X/1f/Tf9O/3D/j/+t/9H/AgAYAD4AVQB1AJQAlACKAHUAVgA4ACAA9v/J/7P/iP9r/1X/MP8b//j+4v7P/s7+3v4A/xb/\
Qv83/zn/Of8i/yH/EP///vz+6f7g/sv+xP7E/r/+u/63/sb+2f7z/iP/Sf93/5z/xv/n/wwANQBVAFIATwBHAC0ACwACAPb/AwARAB4AKAAoADEANwA0ADIA\
KQAiABwADAAOAAEA6P+7/5D/W/8W//H+2v7L/sH+wv7E/sD+w/7N/tD+1/7g/ub+6P73/gf/Dv/9/u7+zv60/p7+cv5c/lX+Xv5m/ov+f/6O/nP+cP5Z/lv+\
S/4e/kD+dP6d/sn+Af83/0P/WP9W/2D/Xf9k/3r/oP+1/+X/AwAPABAAEgACAPv/6v/U/8n/uP+b/4f/hP+G/5j/sf/O/+b/8/8HAB0AKwA5AEUAVgBiAGEA\
bgBfADkAEwDb/7T/h/9S/x//9f7G/pj+d/5V/jn+If4M/vr9/v0M/jH+S/50/pn+xP7q/hD/QP90/4L/jP+Y/5D/ff+G/5D/q/+8/9z///8DAP//9//r/9f/\
uf+Z/4P/bP9b/0L/PP9Q/1r/a/+E/6z/t//E/9b/8f///w8AJgAqADAAOwA/AEIAPAAvADAALgAqAB0AFAADAPT/6//d/8f/uv+l/6P/h/9z/2P/Uf9J/zT/\
Fv8H/+/+5/7e/rr+kf5j/jD++f3P/aT9f/1p/Vf9QP0z/TP9LP0o/TX9RP1l/ZT91P0R/kn+kf7T/g7/TP+s/8X/2f/8/yQASAB9AIcAjQCIAHUAXwBUAC8A\
/v/8/xcAIwBAAF4AdQBkAFYANgAQAO3/y/+3/6z/sv+z/7//xP/B/8n/yv/V/9v/u/+X/3X/TP8f/wr/Av8E/wP/GP8h/xP///7u/tX+s/62/rL+yP7h/v3+\
GP8d/zb/Vf9y/5T/kf+D/3//dP9a/0//MP8p/xf/A//p/vL+AP8V/y7/VP9u/3T/bf9u/1P/T/9C/1X/YP92/6D/wf+//7//tP+o/5T/hv9w/1//Uf9R/zP/\
Gf8L//7+9f73/uf+3v7Y/uH+3P7W/uH+2/7r/uv++/4B/wr/B/8h/y3/QP9H/1b/af94/3z/l/+z/9//CAA9AFsAaQBzAHcAZwBbAF4AZQBtAHYAoQClAIsA\
ewBpAEIAIAD//9n/sf+R/27/Tf8s/w3/8P7V/rH+sf6s/rz+0v7o/gb/Iv8y/1P/YP95/5L/o/+8/87/8//2/87/sv+P/2H/NP8b/xD/Cv/8/hP/Gf8W/x7/\
JP8v/xX/Df/4/t7+zv6p/pX+gP5v/l7+Sv4+/kD+NP4i/jD+T/5v/pv+zf74/gr/HP8w/zj/J/9E/1j/ff+d/8b/7f/9/wIA/v/1/9v/5f/y//j/EQA5AEsA\
SwBZAHIAdQB3AIAAgAB7AHgAdwB6AE0AJADw/8b/gv9h/zv/L/8m/yf/Ff8Y/wv/Ef8C/w3/Ev8R/w3/Cv8N/xX/Ev8Z/yb/Jv8k/y//KP8q/zr/Qv81/y//\
Lv8u/yz/NP8y/xn/+/7U/sP+nf57/lr+Sf4t/h7+EP4H/vf9+v3q/fH9+/0d/kH+cP6l/t3+7P4I/xf/MP87/0f/W/9j/3b/gv+F/5z/y//w/yoAOwBXAE4A\
VgBCAD8AOgA+AD8AWQBhAIEAcwBjAFEANAAJAO7/4f/a/9v/6f/o//b/9v/6//r////4/9f/tv+V/3H/P/8J/+7+2/7P/sX+y/61/qH+ff5t/k7+Nv4m/vn9\
D/4t/lr+ff6k/sf+3v4L/yj/T/9q/4z/o//F/9j/AgAJAAMA8//n/8//vP+h/6z/tP+2/8L/1P/R/+b/6P/5/wcA9//o/8L/oP+D/2f/Of8S//L+2v65/pL+\
dP5p/lP+SP47/jH+Mf43/j/+P/5K/nL+l/7I/vH+K/9S/4T/pv/Z/wMAHgAeACAAFQAfAA4AAwDy/+P/0f+8/7r/xf/M/+L/+P8RABQAJAA8AFUAWABEADUA\
FQDu/87/qv98/13/Mv8V/+r+2P65/p/+jf58/mj+cP59/pf+tf7e/u7+8v74/v7+/v79/vv+9/74/vv+Av8D/wf/DP8P/xv/Jf8y/1P/gP+p/8X/6P/w//P/\
8f/z/97/7//2/xEAJwA2AEwAXABlAHAAhgCLAGwAUAAyAAgAz/+x/5j/jf+D/3//e/90/2//af9l/4f/W/8z//3+0f6W/mj+SP5S/kb+TP5G/lv+X/5j/m7+\
e/6A/nz+b/5q/ln+WP5I/kv+Q/46/kD+SP5K/lT+Z/6G/qv+3v4L/z7/b/+k/8r/6/8aAEYAWAB/AJEAqQDDANUA5ADrAPUA8wD1AOsA6gDVANIAsACfAIcA\
cgBYAEwALQD2/8H/jP9B/wb/zf6q/pD+hP54/nj+Y/5r/nX+bf59/nL+aP5M/jz+JP4P/gX+D/4i/j/+Z/6D/oL+iv6P/o3+jv6L/o7+k/6V/pr+oP6z/tz+\
Av8u/2b/e/+w/9j//P8oAEIAQABBADoAOQAZABwAIwAqACoAUwBMAD0AIwAOAOr/yP+w/6n/pP+n/7D/sf+x/7f/vv/M/9z/wP+w/5T/dP9I/yn/C/8G/wL/\
Cf8X/wn//v7h/s/+xP6i/pT+h/52/m7+X/5b/nH+jf6t/uH+Af8S/xn/HP8j/yb/Kv8v/y//Mv9c/z3/LP8i/xf/Iv8c/yH/R/9p/3v/pf/K/93/9f8RADoA\
NQBCAEQANAAfAAkAAQDy/+D/yP+o/5T/ev9Y/z7/Pf9K/1H/Yf92/4b/lf+n/7P/xv/R/9r/5f/z//D/9f8DAO3/0/+w/5P/cv9M/yT/BP/g/sn+rf6K/nT+\
YP5N/jr+Pf5I/l3+d/6s/sj+3/7l/vT++/75/gn/IP85/1T/lf+t/7f/vv+1/7j/rf+x/8L/0f/l/wQAHAAXABAABAD1/9r/1v/U/9z/2//7//X/+P/2/wAA\
/v8IAPj/AwD1//b/BQDw/9b/uv+U/2H/K/8c/wT/8f7x/vP++f73/vn++/4E/wP/C/8Q/xP/IP8j/yX/Kf8u/zv/Mv8r/zr/OP86/zz/Sf9G/zT/E//1/tT+\
tP6k/oD+aP5O/jv+LP4q/j3+Vf5v/pb+sP62/r/+u/68/sD+0P7n/g3/Iv9P/2r/jf+u/83/CgATAAcA+P/o/9P/yv+y/6L/g/9x/1z/Tf8w/xj/CP8Z/wr/\
IP8Z/xL/E/8m/zr/Vf93/5T/pf/I/+H/8/8KABoAMgA7AEAAZgBhAEsAPwAiAAAA3v/A/53/ff9d/zv/IP8T/xP/I/8d/y//Pf9L/2L/Wf+A/4H/iv+K/5f/\
nP+p/7H/rP+s/7H/qv+4/63/of+f/5z/lP+a/4n/gf97/4L/ef9h/0P/IP/0/sr+q/6R/oz+lf6X/p3+pv62/sT+yP7q/u/+4f7Q/sf+x/6q/pX+j/5y/nD+\
VP5i/m/+iP6s/tj++/4d/0z/cv+P/7T/zP/o////HAA4AFMASQA/AC8AGgD9/+z/3v/k/+f/7P/+//H/5//H/6//iv90/2b/Zf9p/3n/dv9z/3X/hP9//5X/\
lf9+/2j/VP8+/xf/BP8I/wz/Dv8h/y//J/8a/w3/+f7f/uD+6f71/vz+Jv83/zz/L/8v/yr/GP/v/uT+wv6w/pz+kP6d/rr+yP7x/gD/Hf9B/0//ff+h/9L/\
9P8ZACIAHwARAPv/5v/Q/73/nv+N/3X/W/9E/zD/IP8N//b+7f7o/vL+B/8S/zH/S/9N/1j/Uv9X/1b/UP9T/0X/PP8y/zb/Pv9c/3H/lf+j/6v/uv+1/6b/\
of+j/6b/rf/K/9r/6f/u/woAEQAfADIAPgAqABsA+//q/8v/r/+K/2T/SP84/xj///7m/tb+wf62/qf+of6c/pD+mv6X/pf+mP6l/q/+qf6p/rX+wf7K/t7+\
7f75/gj/Ef8h/yH/Q/9Z/4f/ov/S//f/HQA8AFYAdgCIAKAArwC7AMUAygDSALkAowB8AFkAHQABAOv/2//J/8j/vf+Y/3f/T/8r//T+0v6u/qf+pf6s/qn+\
nf6P/oX+cP5f/lH+RP4x/iL+Hv4h/iP+P/5Z/oP+ov7I/un+DP83/1z/iP+U/5b/p/+n/6f/mf+X/5j/mf+n/7r/x//c/93/8f/x/woABgD9/w8ADAD+/+v/\
z/+5/5L/b/9Y/zf/Ev/+/vj+9v74/gf/Ef8e/yH/O/9L/1H/Y/9q/3T/fP+F/5L/dv9v/03/N/8e/wr/BP8P/xD/I/8w/zT/R/9S/1z/cf90/17/U/8z/yr/\
B/8F/wH/Ef8V/yz/Nf9G/03/Xf9t/3z/b/9n/17/Uv8x/yz/Hf8v/zf/Tv9b/2P/Xv9V/0X/Pf8v/xz/Ev8A//f+8f78/gj/If8w/1T/Zf9m/1z/Wf9b/1v/\
U/9Y/0//RP9C/0j/Tv9l/3r/nP+s/8L/y//K/7f/t/+z/7j/wf/T/+T//f/y//X/6//R/7//tP+y/7D/xP/K/9P/1P/g/+P/5//4/+3/0/++/5v/fP9V/zP/\
Df/y/tj+uf6j/pX+dP5v/lr+U/5T/mj+eP6Q/sP+3/7n/vX+9f75/vn+A/8H/wj/Dv8r/xz/Df8b/yz/Rf9l/3X/n/+y/8P/0P/v//L/+P8HAEAAQwBmAHAA\
gAB4AIAAeQBtAF4AVABBAEEAKwAQAPn/4//U/8H/qf+b/3z/W/8k//3+y/6U/oD+aP5g/l3+Yf5h/lP+Pf4x/iP+HP4T/iH+Nf5L/mz+iv6h/sT+3/4C/xr/\
PP9Y/3L/jv+0/8D/yv/L/7v/s/+t/6j/sv+1/8L/0//l/9//6P/7//z/BgDy/+P/yf+s/5b/h/9l/0r/Lv8i/wD/6P7a/sz+sP6q/pf+mf6k/rn+z/7i/vf+\
Fv8r/0n/bP99/4b/gP97/3j/cv9i/1j/WP9G/03/Pv83/zT/MP8w/yj/Lv8p/y3/Kf8r/yz/N/9R/3X/h/+t/8H/5v/3/wcAMgBGADYAMAAjABMA+f/r/8z/\
wf+n/5f/f/9t/13/R/83/yf/Ff8M/wH/8f7v/uf+7P7y/g3/Kf9L/1f/Y/9m/23/dv9d/0v/WP9R/1z/aP+G/5r/pP+n/7n/w//E/7z/yP/k/9z/9f/2////\
9P/y/+//7f/u/+P/u/+Z/3X/U/8l//j+0f6t/ob+a/5O/jr+HP4O/gH+8/30/ez98/34/Qf+Cf4Y/ib+Q/5I/mX+gv6j/rr+zf4B/xb/Mf9P/2r/gP+X/7f/\
2P8LACEAVgB/AJ4AuwDXAO8A/wASARgBJwEgASgBIgEbARMBAgHwAOQAzACUAGYAOwD8/8n/kP9a/y7/7/67/p3+g/5t/mr+gf5t/mX+aP5z/nr+hf6Q/pj+\
o/62/s7+3f7b/tP+0f7C/rT+uf66/sf+1/7y/gj/B/8I/wb///7//vf+7/7o/ur+6P7y/vj+9P74/v3+/P4D/x3/M/9V/4X/l/+b/6j/qv+l/5z/oP+w/77/\
z//f//3/9f///w==\
').split('').map(c => c.charCodeAt(0))).buffer);

/*
 *
 *	New Rally-X
 *
 */

const url = 'nrallyx.zip';
let SND, BGOBJ, COLOR, RGB, PRG;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG = zip.files['nrx_prg1.1d'].inflate().slice(0, 0x800) + zip.files['nrx_prg2.1e'].inflate().slice(0, 0x800) + zip.files['nrx_prg1.1d'].inflate().slice(0x800);
	PRG += zip.files['nrx_prg2.1e'].inflate().slice(0x800) + zip.files['nrx_prg3.1k'].inflate().slice(0, 0x800) + zip.files['nrx_prg4.1l'].inflate().slice(0, 0x800);
	PRG = new Uint8Array((PRG + zip.files['nrx_prg3.1k'].inflate().slice(0x800) + zip.files['nrx_prg4.1l'].inflate().slice(0x800)).split('').map(c => c.charCodeAt(0))).addBase();
	BGOBJ = new Uint8Array((zip.files['nrx_chg1.8e'].inflate() + zip.files['nrx_chg2.8d'].inflate()).split('').map(c => c.charCodeAt(0)));
	RGB = new Uint8Array(zip.files['nrx1-1.11n'].inflate().split('').map(c => c.charCodeAt(0)));
	COLOR = new Uint8Array(zip.files['nrx1-7.8p'].inflate().split('').map(c => c.charCodeAt(0)));
	SND = new Uint8Array(zip.files['rx1-5.3p'].inflate().split('').map(c => c.charCodeAt(0)));
	init({
		game: game = new NewRallyX(),
		sound: sound = [
			new PacManSound({SND}),
			new SoundEffect({se: game.se, freq: 11025, gain: 9 / 16}),
		],
		rotate: true,
	});
	loop();
}

