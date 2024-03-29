/*
 *
 *	Phozon
 *
 */

import MappySound from './mappy_sound.js';
import {seq, rseq, convertGFX, Timer} from './utils.js';
import {init, expand} from './main.js';
import MC6809 from './mc6809.js';
let game, sound;

class Phozon {
	cxScreen = 224;
	cyScreen = 288;
	width = 256;
	height = 512;
	xOffset = 16;
	yOffset = 16;
	rotate = false;

	fReset = false;
	fTest = false;
	fDIPSwitchChanged = true;
	fCoin = 0;
	fStart1P = 0;
	fStart2P = 0;
	nChemic = 3;
	nBonus = 'A';
	nRank = '0';

	fPortTest = false;
	fInterruptEnable0 = false;
	fInterruptEnable1 = false;
	fInterruptEnable2 = false;
	ram = new Uint8Array(0x2800).addBase();
	port = new Uint8Array(0x40);
	in = new Uint8Array(10);
	edge = 0xf;

	bg = new Uint8Array(0x8000).fill(3);
	obj = new Uint8Array(0x8000).fill(3);
	objcolor = Uint8Array.from(OBJCOLOR, e => 0x10 | e);
	rgb = Int32Array.from(seq(0x40), i => 0xff000000 | BLUE[i] * 255 / 15 << 16 | GREEN[i] * 255 / 15 << 8 | RED[i] * 255 / 15);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;

	cpu = new MC6809(Math.floor(18432000 / 12));
	cpu2 = new MC6809(Math.floor(18432000 / 12));
	cpu3 = new MC6809(Math.floor(18432000 / 12));
	timer = new Timer(60);

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x20; i++) {
			this.cpu.memorymap[i].base = this.ram.base[i];
			this.cpu.memorymap[i].write = null;
		}
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0x40 + i].read = (addr) => { return sound.read(addr); };
			this.cpu.memorymap[0x40 + i].write = (addr, data) => { sound.write(addr, data); };
		}
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0x48 + i].read = (addr) => { return this.port[addr & 0x3f] | 0xf0; };
			this.cpu.memorymap[0x48 + i].write = (addr, data) => { this.port[addr & 0x3f] = data & 0xf; };
		}
		this.cpu.memorymap[0x50].write = (addr) => {
			switch (addr & 0xff) {
			case 0x00: // INTERRUPT STOP
				return void(this.fInterruptEnable2 = false);
			case 0x01: // INTERRUPT START
				return void(this.fInterruptEnable2 = true);
			case 0x02: // INTERRUPT STOP
				return void(this.fInterruptEnable1 = false);
			case 0x03: // INTERRUPT START
				return void(this.fInterruptEnable1 = true);
			case 0x04: // INTERRUPT STOP
				return void(this.fInterruptEnable0 = false);
			case 0x05: // INTERRUPT START
				return void(this.fInterruptEnable0 = true);
			case 0x06: // SND STOP
				return sound.control(false);
			case 0x07: // SND START
				return sound.control(true);
			case 0x08: // PORT TEST START
				return void(this.fPortTest = true);
			case 0x09: // PORT TEST END
				return void(this.fPortTest = false);
			case 0x0a: // SUB CPU STOP
				return this.cpu2.disable();
			case 0x0b: // SUB CPU START
				return this.cpu2.enable();
			case 0x0c: // SUB CPU STOP
				return this.cpu3.disable();
			case 0x0d: // SUB CPU START
				return this.cpu3.enable();
			}
		};
		for (let i = 0; i < 0x80; i++)
			this.cpu.memorymap[0x80 + i].base = PRG1.base[i];

		for (let i = 0; i < 4; i++) {
			this.cpu2.memorymap[i].read = (addr) => { return sound.read(addr); };
			this.cpu2.memorymap[i].write = (addr, data) => { sound.write(addr, data); };
		}
		for (let i = 0; i < 0x20; i++)
			this.cpu2.memorymap[0xe0 + i].base = PRG2.base[i];

		for (let i = 0; i < 0x20; i++) {
			this.cpu3.memorymap[i].base = this.ram.base[i];
			this.cpu3.memorymap[i].write = null;
		}
		for (let i = 0; i < 4; i++) {
			this.cpu3.memorymap[0x40 + i].read = (addr) => { return sound.read(addr); };
			this.cpu3.memorymap[0x40 + i].write = (addr, data) => { sound.write(addr, data); };
		}
		for (let i = 0; i < 8; i++) {
			this.cpu3.memorymap[0xa0 + i].base = this.ram.base[0x20 + i];
			this.cpu3.memorymap[0xa0 + i].write = null;
		}
		for (let i = 0; i < 0x20; i++)
			this.cpu3.memorymap[0xe0 + i].base = PRG3.base[i];

		// Videoの初期化
		convertGFX(this.bg, BG, 512, rseq(8, 0, 8), seq(4, 64).concat(seq(4)), [0, 4], 16);
		convertGFX(this.obj, OBJ, 128, rseq(8, 256, 8).concat(rseq(8, 0, 8)), seq(4).concat(seq(4, 64), seq(4, 128), seq(4, 192)), [0, 4], 64);
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.cpu2.execute(tick_rate);
			this.cpu3.execute(tick_rate);
			this.timer.execute(tick_rate, () => {
				update(), this.fInterruptEnable0 && this.cpu.interrupt(), this.fInterruptEnable1 && this.cpu2.interrupt(), this.fInterruptEnable2 && this.cpu3.interrupt();
			});
			sound.execute(tick_rate);
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
			switch (this.nChemic) {
			case 1:
				this.in[5] &= ~1, this.in[9] |= 1;
				break;
			case 3:
				this.in[5] &= ~1, this.in[9] &= ~1;
				break;
			case 4:
				this.in[5] |= 1, this.in[9] &= ~1;
				break;
			case 5:
				this.in[5] |= 1, this.in[9] |= 1;
				break;
			}
			switch (this.nRank) {
			case '0':
				this.in[6] &= ~0xe;
				break;
			case '1':
				this.in[6] = this.in[6] & ~0xe | 2;
				break;
			case '2':
				this.in[6] = this.in[6] & ~0xe | 4;
				break;
			case '3':
				this.in[6] = this.in[6] & ~0xe | 6;
				break;
			case '4':
				this.in[6] = this.in[6] & ~0xe | 8;
				break;
			case '5':
				this.in[6] = this.in[6] & ~0xe | 0xa;
				break;
			case '6':
				this.in[6] = this.in[6] & ~0xe | 0xc;
				break;
			case '7':
				this.in[6] |= 0xe;
				break;
			}
			switch (this.nBonus) {
			case 'A':
				this.in[5] &= ~2, this.in[9] &= ~6;
				break;
			case 'B':
				this.in[5] &= ~2, this.in[9] = this.in[9] & ~6 | 2;
				break;
			case 'C':
				this.in[5] |= 2, this.in[9] &= ~6;
				break;
			case 'D':
				this.in[5] |= 2, this.in[9] = this.in[9] & ~6 | 2;
				break;
			case 'E':
				this.in[5] &= ~2, this.in[9] = this.in[9] & ~6 | 4;
				break;
			case 'F':
				this.in[5] &= ~2, this.in[9] |= 6;
				break;
			case 'G':
				this.in[5] |= 2, this.in[9] = this.in[9] & ~6 | 4;
				break;
			case 'NONE':
				this.in[5] |= 2, this.in[9] |= 6;
				break;
			}
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.in[8] |= 8;
		else
			this.in[8] &= ~8;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu.reset();
			this.cpu2.disable();
			this.cpu3.disable();
		}
		return this;
	}

	updateInput() {
		this.in[0] = !!this.fCoin << 3, this.in[3] = this.in[3] & 3 | !!this.fStart1P << 2 | !!this.fStart2P << 3;
		this.fCoin -= !!this.fCoin, this.fStart1P -= !!this.fStart1P, this.fStart2P -= !!this.fStart2P;
		this.edge &= this.in[3];
		if (this.fPortTest)
			return this.edge = this.in[3] ^ 0xf, this;
		if (this.port[8] === 1)
			this.port.set(this.in.subarray(0, 4), 4);
		else if (this.port[8] === 3) {
			let credit = this.port[2] * 10 + this.port[3];
			if (this.fCoin && credit < 150)
				this.port[0] += 1, credit = Math.min(credit + 1, 99);
			if (!this.port[9] && this.fStart1P && credit > 0)
				this.port[1] += 1, credit -= (credit < 150);
			if (!this.port[9] && this.fStart2P && credit > 1)
				this.port[1] += 2, credit -= (credit < 150) * 2;
			this.port[2] = credit / 10, this.port[3] = credit % 10;
			this.port.set([this.in[1], this.in[3] << 1 & 0xa | this.edge & 5, this.in[2], this.in[3] & 0xa | this.edge >> 1 & 5], 4);
		} else if (this.port[8] === 5)
			this.port.set([0, 2, 3, 4, 5, 6, 0xc, 0xa]);
		if (this.port[0x18] === 8)
			this.port[0x10] = 1, this.port[0x11] = 0xc;
		else if (this.port[0x18] === 9)
			this.port.set([this.in[5], this.in[9], this.in[6], this.in[6], this.in[7], this.in[7], this.in[8], this.in[8]], 0x10);
		return this.edge = this.in[3] ^ 0xf, this;
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
		this.in[1] = this.in[1] & ~(1 << 0 | fDown << 2) | fDown << 0;
	}

	right(fDown) {
		this.in[1] = this.in[1] & ~(1 << 1 | fDown << 3) | fDown << 1;
	}

	down(fDown) {
		this.in[1] = this.in[1] & ~(1 << 2 | fDown << 0) | fDown << 2;
	}

	left(fDown) {
		this.in[1] = this.in[1] & ~(1 << 3 | fDown << 1) | fDown << 3;
	}

	triggerA(fDown) {
		this.in[3] = this.in[3] & ~(1 << 0) | fDown << 0;
	}

	makeBitmap(flag) {
		if (!(this.updated = flag))
			return this.bitmap;

		// 画面クリア
		let p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256, i++)
			this.bitmap.fill(0xf, p, p + 224);

		// bg描画
		this.drawBG(this.bitmap, 0);

		// obj描画
		for (let k = 0x0f80, i = 64; i !== 0; k += 2, --i) {
			const x = this.ram[k + 0x800] + 8 & 0xff;
			const y = (this.ram[k + 0x801] | this.ram[k + 0x1001] << 8) - 54 & 0x1ff;
			const src = this.ram[k] | this.ram[k + 1] << 8;
			if (this.ram[k + 0x1000] & 0x34)
				switch (this.ram[k + 0x1000] & 0x30) {
				// 8x8
				case 0x10:
					switch (this.ram[k + 0x1000] & 0xc0) {
					case 0x00:
						this.xfer8x8_0(this.bitmap, x | y << 8, src);
						break;
					case 0x40:
						this.xfer8x8_1(this.bitmap, x | y << 8, src);
						break;
					case 0x80:
						this.xfer8x8_2(this.bitmap, x | y << 8, src);
						break;
					case 0xc0:
						this.xfer8x8_3(this.bitmap, x | y << 8, src);
						break;
					}
					break;
				// 32x8
				case 0x20:
					if (this.ram[k + 0x1000] & 0x40) {
						this.xfer16x8_1(this.bitmap, x | y << 8, src + 2);
						this.xfer16x8_1(this.bitmap, x + 16 | y << 8, src);
					} else {
						this.xfer16x8_0(this.bitmap, x | y << 8, src + 2);
						this.xfer16x8_0(this.bitmap, x + 16 | y << 8, src);
					}
					break;
				}
			else
				this.xfer16x16(this.bitmap, x | y << 8, src);
		}

		// bg描画
		this.drawBG(this.bitmap, 1);

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				this.bitmap[p] = this.rgb[this.bitmap[p]];

		return this.bitmap;
	}

	drawBG(data, pri) {
		let p = 256 * 8 * 4 + 232;
		for (let k = 0x40, i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				this.xfer8x8(data, p, k, pri);
		p = 256 * 8 * 36 + 232;
		for (let k = 2, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
		p = 256 * 8 * 37 + 232;
		for (let k = 0x22, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
		p = 256 * 8 * 2 + 232;
		for (let k = 0x3c2, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
		p = 256 * 8 * 3 + 232;
		for (let k = 0x3e2, i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k, pri);
	}

	xfer8x8(data, p, k, pri) {
		const q = (this.ram[k] | this.ram[k + 0x400] << 1 & 0x100) << 6, idx = this.ram[k + 0x400] << 2 & 0x7c;
		let px;

		if ((this.ram[k + 0x400] >> 6 & 1) !== pri)
			return;
		if (~this.ram[k + 0x400] & 0x20) {
			// ノーマル
			(px = BGCOLOR[idx | this.bg[q | 0x00]]) !== 0xf && (data[p + 0x000] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x01]]) !== 0xf && (data[p + 0x001] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x02]]) !== 0xf && (data[p + 0x002] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x03]]) !== 0xf && (data[p + 0x003] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x04]]) !== 0xf && (data[p + 0x004] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x05]]) !== 0xf && (data[p + 0x005] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x06]]) !== 0xf && (data[p + 0x006] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x07]]) !== 0xf && (data[p + 0x007] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x08]]) !== 0xf && (data[p + 0x100] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x09]]) !== 0xf && (data[p + 0x101] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x0a]]) !== 0xf && (data[p + 0x102] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x0b]]) !== 0xf && (data[p + 0x103] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x0c]]) !== 0xf && (data[p + 0x104] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x0d]]) !== 0xf && (data[p + 0x105] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x0e]]) !== 0xf && (data[p + 0x106] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x0f]]) !== 0xf && (data[p + 0x107] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x10]]) !== 0xf && (data[p + 0x200] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x11]]) !== 0xf && (data[p + 0x201] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x12]]) !== 0xf && (data[p + 0x202] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x13]]) !== 0xf && (data[p + 0x203] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x14]]) !== 0xf && (data[p + 0x204] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x15]]) !== 0xf && (data[p + 0x205] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x16]]) !== 0xf && (data[p + 0x206] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x17]]) !== 0xf && (data[p + 0x207] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x18]]) !== 0xf && (data[p + 0x300] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x19]]) !== 0xf && (data[p + 0x301] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x1a]]) !== 0xf && (data[p + 0x302] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x1b]]) !== 0xf && (data[p + 0x303] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x1c]]) !== 0xf && (data[p + 0x304] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x1d]]) !== 0xf && (data[p + 0x305] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x1e]]) !== 0xf && (data[p + 0x306] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x1f]]) !== 0xf && (data[p + 0x307] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x20]]) !== 0xf && (data[p + 0x400] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x21]]) !== 0xf && (data[p + 0x401] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x22]]) !== 0xf && (data[p + 0x402] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x23]]) !== 0xf && (data[p + 0x403] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x24]]) !== 0xf && (data[p + 0x404] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x25]]) !== 0xf && (data[p + 0x405] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x26]]) !== 0xf && (data[p + 0x406] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x27]]) !== 0xf && (data[p + 0x407] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x28]]) !== 0xf && (data[p + 0x500] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x29]]) !== 0xf && (data[p + 0x501] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x2a]]) !== 0xf && (data[p + 0x502] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x2b]]) !== 0xf && (data[p + 0x503] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x2c]]) !== 0xf && (data[p + 0x504] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x2d]]) !== 0xf && (data[p + 0x505] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x2e]]) !== 0xf && (data[p + 0x506] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x2f]]) !== 0xf && (data[p + 0x507] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x30]]) !== 0xf && (data[p + 0x600] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x31]]) !== 0xf && (data[p + 0x601] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x32]]) !== 0xf && (data[p + 0x602] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x33]]) !== 0xf && (data[p + 0x603] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x34]]) !== 0xf && (data[p + 0x604] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x35]]) !== 0xf && (data[p + 0x605] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x36]]) !== 0xf && (data[p + 0x606] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x37]]) !== 0xf && (data[p + 0x607] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x38]]) !== 0xf && (data[p + 0x700] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x39]]) !== 0xf && (data[p + 0x701] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x3a]]) !== 0xf && (data[p + 0x702] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x3b]]) !== 0xf && (data[p + 0x703] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x3c]]) !== 0xf && (data[p + 0x704] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x3d]]) !== 0xf && (data[p + 0x705] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x3e]]) !== 0xf && (data[p + 0x706] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x3f]]) !== 0xf && (data[p + 0x707] = px);
		} else if (this.ram[k + 0x400] & 0x1f) {
			// HV反転
			(px = BGCOLOR[idx | this.bg[q | 0x3f]]) !== 0xf && (data[p + 0x000] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x3e]]) !== 0xf && (data[p + 0x001] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x3d]]) !== 0xf && (data[p + 0x002] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x3c]]) !== 0xf && (data[p + 0x003] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x3b]]) !== 0xf && (data[p + 0x004] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x3a]]) !== 0xf && (data[p + 0x005] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x39]]) !== 0xf && (data[p + 0x006] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x38]]) !== 0xf && (data[p + 0x007] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x37]]) !== 0xf && (data[p + 0x100] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x36]]) !== 0xf && (data[p + 0x101] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x35]]) !== 0xf && (data[p + 0x102] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x34]]) !== 0xf && (data[p + 0x103] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x33]]) !== 0xf && (data[p + 0x104] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x32]]) !== 0xf && (data[p + 0x105] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x31]]) !== 0xf && (data[p + 0x106] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x30]]) !== 0xf && (data[p + 0x107] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x2f]]) !== 0xf && (data[p + 0x200] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x2e]]) !== 0xf && (data[p + 0x201] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x2d]]) !== 0xf && (data[p + 0x202] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x2c]]) !== 0xf && (data[p + 0x203] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x2b]]) !== 0xf && (data[p + 0x204] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x2a]]) !== 0xf && (data[p + 0x205] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x29]]) !== 0xf && (data[p + 0x206] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x28]]) !== 0xf && (data[p + 0x207] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x27]]) !== 0xf && (data[p + 0x300] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x26]]) !== 0xf && (data[p + 0x301] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x25]]) !== 0xf && (data[p + 0x302] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x24]]) !== 0xf && (data[p + 0x303] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x23]]) !== 0xf && (data[p + 0x304] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x22]]) !== 0xf && (data[p + 0x305] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x21]]) !== 0xf && (data[p + 0x306] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x20]]) !== 0xf && (data[p + 0x307] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x1f]]) !== 0xf && (data[p + 0x400] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x1e]]) !== 0xf && (data[p + 0x401] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x1d]]) !== 0xf && (data[p + 0x402] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x1c]]) !== 0xf && (data[p + 0x403] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x1b]]) !== 0xf && (data[p + 0x404] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x1a]]) !== 0xf && (data[p + 0x405] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x19]]) !== 0xf && (data[p + 0x406] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x18]]) !== 0xf && (data[p + 0x407] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x17]]) !== 0xf && (data[p + 0x500] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x16]]) !== 0xf && (data[p + 0x501] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x15]]) !== 0xf && (data[p + 0x502] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x14]]) !== 0xf && (data[p + 0x503] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x13]]) !== 0xf && (data[p + 0x504] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x12]]) !== 0xf && (data[p + 0x505] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x11]]) !== 0xf && (data[p + 0x506] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x10]]) !== 0xf && (data[p + 0x507] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x0f]]) !== 0xf && (data[p + 0x600] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x0e]]) !== 0xf && (data[p + 0x601] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x0d]]) !== 0xf && (data[p + 0x602] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x0c]]) !== 0xf && (data[p + 0x603] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x0b]]) !== 0xf && (data[p + 0x604] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x0a]]) !== 0xf && (data[p + 0x605] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x09]]) !== 0xf && (data[p + 0x606] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x08]]) !== 0xf && (data[p + 0x607] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x07]]) !== 0xf && (data[p + 0x700] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x06]]) !== 0xf && (data[p + 0x701] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x05]]) !== 0xf && (data[p + 0x702] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x04]]) !== 0xf && (data[p + 0x703] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x03]]) !== 0xf && (data[p + 0x704] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x02]]) !== 0xf && (data[p + 0x705] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x01]]) !== 0xf && (data[p + 0x706] = px);
			(px = BGCOLOR[idx | this.bg[q | 0x00]]) !== 0xf && (data[p + 0x707] = px);
		}
	}

	xfer16x16(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0x7f00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj[src++]]) !== 0x1f)
					data[dst] = px;
	}

	xfer16x8_0(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0x7f00;
		for (let i = 8; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj[src++]]) !== 0x1f)
					data[dst] = px;
	}

	xfer16x8_1(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x7f00) + 0x80;
		for (let i = 8; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj[src++]]) !== 0x1f)
					data[dst] = px;
	}

	xfer8x8_0(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x7f00) + 8;
		for (let i = 8; i !== 0; dst += 256 - 8, src += 8, --i)
			for (let j = 8; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj[src++]]) !== 0x1f)
					data[dst] = px;
	}

	xfer8x8_1(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x7f00) + 0x88;
		for (let i = 8; i !== 0; dst += 256 - 8, src += 8, --i)
			for (let j = 8; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj[src++]]) !== 0x1f)
					data[dst] = px;
	}

	xfer8x8_2(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0x7f00;
		for (let i = 8; i !== 0; dst += 256 - 8, src += 8, --i)
			for (let j = 8; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj[src++]]) !== 0x1f)
					data[dst] = px;
	}

	xfer8x8_3(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x7f00) + 0x80;
		for (let i = 8; i !== 0; dst += 256 - 8, src += 8, --i)
			for (let j = 8; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj[src++]]) !== 0x1f)
					data[dst] = px;
	}
}

/*
 *
 *	Phozon
 *
 */

import {ROM} from "./dist/phozon.png.js";
let PRG1, PRG2, PRG3, BG, OBJ, RED, GREEN, BLUE, BGCOLOR, OBJCOLOR, SND;

window.addEventListener('load', () => expand(ROM).then(ROM => {
	PRG1 = new Uint8Array(ROM.buffer, 0x0, 0x8000).addBase();
	PRG2 = new Uint8Array(ROM.buffer, 0x8000, 0x2000).addBase();
	PRG3 = new Uint8Array(ROM.buffer, 0xa000, 0x2000).addBase();
	BG = new Uint8Array(ROM.buffer, 0xc000, 0x2000);
	OBJ = new Uint8Array(ROM.buffer, 0xe000, 0x2000);
	RED = new Uint8Array(ROM.buffer, 0x10000, 0x100);
	GREEN = new Uint8Array(ROM.buffer, 0x10100, 0x100);
	BLUE = new Uint8Array(ROM.buffer, 0x10200, 0x100);
	BGCOLOR = new Uint8Array(ROM.buffer, 0x10300, 0x100);
	OBJCOLOR = new Uint8Array(ROM.buffer, 0x10400, 0x100);
	SND = new Uint8Array(ROM.buffer, 0x10500, 0x100);
	game = new Phozon();
	sound = new MappySound({SND});
	canvas.addEventListener('click', () => game.coin(true));
	init({game, sound});
}));

