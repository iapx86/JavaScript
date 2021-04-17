/*
 *
 *	Sky Kid
 *
 */

import C30 from './c30.js';
import {seq, rseq, convertGFX, Timer} from './utils.js';
import {init, read} from './main.js';
import MC6809 from './mc6809.js';
import MC6801 from './mc6801.js';
let game, sound;

class SkyKid {
	cxScreen = 224;
	cyScreen = 288;
	width = 256;
	height = 512;
	xOffset = 16;
	yOffset = 16;
	rotate = true;

	fReset = true;
	fTest = false;
	fDIPSwitchChanged = true;
	fCoin = 0;
	fStart1P = 0;
	fStart2P = 0;
	fAttract = true;
	fSkip = false;
	nLife = 3;
	nBonus = '1st 30000 2nd 90000';
	fContinue = true;

	fInterruptEnable0 = false;
	fInterruptEnable1 = false;
	bank = 0x80;

	ram = new Uint8Array(0x3000).addBase();
	ram2 = new Uint8Array(0x900).addBase();
	in = new Uint8Array(8).fill(0xff);
	select = 0;
	cpu_irq = false;
	mcu_irq = false;

	fg = new Uint8Array(0x8000).fill(3);
	bg = new Uint8Array(0x8000).fill(3);
	obj = new Uint8Array(0x20000).fill(7).fill(3, 0x10000);
	rgb = Int32Array.from(seq(0x100), i => 0xff000000 | BLUE[i] * 255 / 15 << 16 | GREEN[i] * 255 / 15 << 8| RED[i] * 255 / 15);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;
	priority = 0;
	vScroll = 0;
	hScroll = 0;
	fFlip = false;

	cpu = new MC6809(Math.floor(49152000 / 32));
	mcu = new MC6801(Math.floor(49152000 / 8 / 4));
	timer = new Timer(60);

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x20; i++)
			this.cpu.memorymap[i].base = PRG1.base[0x80 + i];
		for (let i = 0; i < 0x10; i++) {
			this.cpu.memorymap[0x20 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x20 + i].write = null;
		}
		for (let i = 0; i < 0x20; i++) {
			this.cpu.memorymap[0x40 + i].base = this.ram.base[0x10 + i];
			this.cpu.memorymap[0x40 + i].write = null;
		}
		this.cpu.memorymap[0x60].write = (addr) => { this.hScroll = addr & 0xff; };
		for (let i = 0; i < 2; i++)
			this.cpu.memorymap[0x62 + i].write = (addr) => { this.vScroll = addr & 0x1ff; };
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0x68 + i].read = (addr) => { return sound.read(addr); };
			this.cpu.memorymap[0x68 + i].write = (addr, data) => { sound.write(addr, data); };
		}
		for (let i = 0; i < 0x10; i++)
			this.cpu.memorymap[0x70 + i].write = (addr) => { this.fInterruptEnable0 = !(addr & 0x800); };
		for (let i = 0; i < 0x80; i++)
			this.cpu.memorymap[0x80 + i].base = PRG1.base[i];
		for (let i = 0; i < 0x10; i++)
			this.cpu.memorymap[0x80 + i].write = (addr) => { addr & 0x800 ? this.mcu.disable() : this.mcu.enable(); };
		for (let i = 0; i < 0x10; i++)
			this.cpu.memorymap[0x90 + i].write = (addr) => {
				const _bank = ~addr >> 6 & 0x20 | 0x80;
				if (_bank === this.bank)
					return;
				for (let i = 0; i < 0x20; i++)
					this.cpu.memorymap[i].base = PRG1.base[_bank + i];
				this.bank = _bank;
			};
		this.cpu.memorymap[0xa0].write = (addr, data) => { !(addr & 0xfe) && (this.priority = data, this.fFlip = (addr & 1) !== 0); };

		this.cpu.check_interrupt = () => { return this.cpu_irq && this.cpu.interrupt() && (this.cpu_irq = false, true); };

		this.mcu.memorymap[0].read = (addr) => {
			let data;
			switch (addr) {
			case 2:
				return this.in[this.select];
			case 8:
				return data = this.ram2[8], this.ram2[8] &= ~0xe0, data;
			}
			return this.ram2[addr];
		};
		this.mcu.memorymap[0].write = (addr, data) => { addr === 2 && (data & 0xe0) === 0x60 && (this.select = data & 7), this.ram2[addr] = data; };
		for (let i = 0; i < 4; i++) {
			this.mcu.memorymap[0x10 + i].read = (addr) => { return sound.read(addr); };
			this.mcu.memorymap[0x10 + i].write = (addr, data) => { sound.write(addr, data); };
		}
		for (let i = 0; i < 0x40; i++)
			this.mcu.memorymap[0x40 + i].write = (addr) => { this.fInterruptEnable1 = !(addr & 0x2000); };
		for (let i = 0; i < 0x20; i++)
			this.mcu.memorymap[0x80 + i].base = PRG2.base[i];
		for (let i = 0; i < 8; i++) {
			this.mcu.memorymap[0xc0 + i].base = this.ram2.base[1 + i];
			this.mcu.memorymap[0xc0 + i].write = null;
		}
		for (let i = 0; i < 0x10; i++)
			this.mcu.memorymap[0xf0 + i].base = PRG2I.base[i];

		this.mcu.check_interrupt = () => { return this.mcu_irq && this.mcu.interrupt() ? (this.mcu_irq = false, true) : (this.ram2[8] & 0x48) === 0x48 && this.mcu.interrupt('ocf'); };

		// Videoの初期化
		convertGFX(this.fg, FG, 512, rseq(8, 0, 8), seq(4, 64).concat(seq(4)), [0, 4], 16);
		convertGFX(this.bg, BG, 512, rseq(8, 0, 16), seq(4).concat(seq(4, 8)), [0, 4], 16);
		convertGFX(this.obj, OBJ, 128, rseq(8, 256, 8).concat(rseq(8, 0, 8)),
			seq(4).concat(seq(4, 64), seq(4, 128), seq(4, 192)), [0x20004, 0, 4], 64);
		convertGFX(this.obj.subarray(0x8000), OBJ.subarray(0x2000), 128, rseq(8, 256, 8).concat(rseq(8, 0, 8)),
			seq(4).concat(seq(4, 64), seq(4, 128), seq(4, 192)), [0x10000, 0, 4], 64);
		convertGFX(this.obj.subarray(0x10000), OBJ.subarray(0x6000), 128, rseq(8, 256, 8).concat(rseq(8, 0, 8)),
			seq(4).concat(seq(4, 64), seq(4, 128), seq(4, 192)), [0, 4], 64);
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.mcu.execute(tick_rate);
			this.timer.execute(tick_rate, () => { update(), this.cpu_irq = this.fInterruptEnable0, this.mcu_irq = this.fInterruptEnable1, this.ram2[8] |= this.ram2[8] << 3 & 0x40; });
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
			switch (this.nLife) {
			case 3:
				this.in[0] |= 0x18;
				break;
			case 1:
				this.in[0] = this.in[0] & ~0x18 | 0x10;
				break;
			case 2:
				this.in[0] = this.in[0] & ~0x18 | 8;
				break;
			case 5:
				this.in[0] &= ~0x18;
				break;
			}
			if (this.fAttract)
				this.in[2] |= 8;
			else
				this.in[2] &= ~8;
			if (this.fSkip)
				this.in[2] &= ~4;
			else
				this.in[2] |= 4;
			switch (this.nBonus) {
			case '1st 30000 2nd 90000':
				this.in[0] |= 6;
				break;
			case '1st 30000 every 90000':
				this.in[0] = this.in[0] & ~6 | 4;
				break;
			case '1st 20000 2nd 80000':
				this.in[0] = this.in[0] & ~6 | 2;
				break;
			case '1st 20000 every 80000':
				this.in[0] &= ~6;
				break;
			}
			if (this.fContinue)
				this.in[1] |= 8;
			else
				this.in[1] &= ~8;
			this.in[1] &= ~4; // Flip
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.in[1] &= ~2;
		else
			this.in[1] |= 2;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu.reset();
			this.mcu.disable();
		}
		return this;
	}

	updateInput() {
		this.in[4] = this.in[4] & ~0x19 | !this.fCoin << 0 | !this.fStart1P << 3 | !this.fStart2P << 4;
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

	up(fDown) {
		this.in[6] = this.in[6] & ~(1 << 3) | fDown << 2 | !fDown << 3;
	}

	right(fDown) {
		this.in[6] = this.in[6] & ~(1 << 1) | fDown << 0 | !fDown << 1;
	}

	down(fDown) {
		this.in[6] = this.in[6] & ~(1 << 2) | fDown << 3 | !fDown << 2;
	}

	left(fDown) {
		this.in[6] = this.in[6] & ~(1 << 0) | fDown << 1 | !fDown << 0;
	}

	triggerA(fDown) {
		this.in[6] = this.in[6] & ~(1 << 4) | !fDown << 4;
	}

	triggerB(fDown) {
		this.in[3] = this.in[3] & ~(1 << 3) | !fDown << 3;
	}

	makeBitmap(flag) {
		if (!(this.updated = flag))
			return this.bitmap;

		// bg描画
		let p = 256 * 8 * 2 + 232 + (this.fFlip ? (7 - this.hScroll & 7) - (4 - this.vScroll & 7) * 256 : (1 + this.hScroll & 7) - (3 + this.vScroll & 7) * 256);
		let _k = this.fFlip ? 7 - this.hScroll << 3 & 0x7c0 | (4 - this.vScroll >> 3) + 23 & 0x3f : 0x18 + 1 + this.hScroll << 3 & 0x7c0 | (3 + this.vScroll >> 3) + 4 & 0x3f;
		for (let k = _k, i = 0; i < 29; k = k + 27 & 0x3f | k + 0x40 & 0x7c0, p -= 256 * 8 * 37 + 8, i++)
			for (let j = 0; j < 37; k = k + 1 & 0x3f | k & 0x7c0, p += 256 * 8, j++)
				this.xfer8x8b(this.bitmap, p, k);

		// fg描画
		if (this.priority & 4) {
			p = 256 * 8 * 4 + 232;
			for (let k = 0x1040, i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
				for (let j = 0; j < 32; k++, p += 256 * 8, j++)
					if (!((this.ram[k] ^ this.priority) & 0xf0))
						this.xfer8x8f(this.bitmap, p, k);
			p = 256 * 8 * 36 + 232;
			for (let k = 0x1002, i = 0; i < 28; p -= 8, k++, i++)
				if (!((this.ram[k] ^ this.priority) & 0xf0))
					this.xfer8x8f(this.bitmap, p, k);
			p = 256 * 8 * 37 + 232;
			for (let k = 0x1022, i = 0; i < 28; p -= 8, k++, i++)
				if (!((this.ram[k] ^ this.priority) & 0xf0))
					this.xfer8x8f(this.bitmap, p, k);
			p = 256 * 8 * 2 + 232;
			for (let k = 0x13c2, i = 0; i < 28; p -= 8, k++, i++)
				if (!((this.ram[k] ^ this.priority) & 0xf0))
					this.xfer8x8f(this.bitmap, p, k);
			p = 256 * 8 * 3 + 232;
			for (let k = 0x13e2, i = 0; i < 28; p -= 8, k++, i++)
				if (!((this.ram[k] ^ this.priority) & 0xf0))
					this.xfer8x8f(this.bitmap, p, k);
		}

		// obj描画
		if (this.fFlip) {
			for (let k = 0x1f80, i = 64; i !== 0; k += 2, --i) {
				const x = 0xe9 - this.ram[k + 0x800] & 0xff;
				const y = 0x167 - this.ram[k + 0x801] - this.ram[k + 0x1001] * 0x100 & 0x1ff;
				const src = this.ram[k] | this.ram[k + 0x1000] << 1 & 0x100 | this.ram[k + 1] << 9;
				switch (this.ram[k + 0x1000] & 0x0f) {
				case 0x00: // ノーマル
					this.xfer16x16(this.bitmap, x | y << 8, src);
					break;
				case 0x01: // V反転
					this.xfer16x16V(this.bitmap, x | y << 8, src);
					break;
				case 0x02: // H反転
					this.xfer16x16H(this.bitmap, x | y << 8, src);
					break;
				case 0x03: // HV反転
					this.xfer16x16HV(this.bitmap, x | y << 8, src);
					break;
				case 0x04: // ノーマル
					this.xfer16x16(this.bitmap, x | y << 8, src | 1);
					this.xfer16x16(this.bitmap, x | (y - 16 & 0x1ff) << 8, src & ~1);
					break;
				case 0x05: // V反転
					this.xfer16x16V(this.bitmap, x | y << 8, src & ~1);
					this.xfer16x16V(this.bitmap, x | (y - 16 & 0x1ff) << 8, src | 1);
					break;
				case 0x06: // H反転
					this.xfer16x16H(this.bitmap, x | y << 8, src | 1);
					this.xfer16x16H(this.bitmap, x | (y - 16 & 0x1ff) << 8, src & ~1);
					break;
				case 0x07: // HV反転
					this.xfer16x16HV(this.bitmap, x | y << 8, src & ~1);
					this.xfer16x16HV(this.bitmap, x | (y - 16 & 0x1ff) << 8, src | 1);
					break;
				case 0x08: // ノーマル
					this.xfer16x16(this.bitmap, x | y << 8, src & ~2);
					this.xfer16x16(this.bitmap, x - 16 & 0xff | y << 8, src | 2);
					break;
				case 0x09: // V反転
					this.xfer16x16V(this.bitmap, x | y << 8, src & ~2);
					this.xfer16x16V(this.bitmap, x - 16 & 0xff | y << 8, src | 2);
					break;
				case 0x0a: // H反転
					this.xfer16x16H(this.bitmap, x | y << 8, src | 2);
					this.xfer16x16H(this.bitmap, x - 16 & 0xff | y << 8, src & ~2);
					break;
				case 0x0b: // HV反転
					this.xfer16x16HV(this.bitmap, x | y << 8, src | 2);
					this.xfer16x16HV(this.bitmap, x - 16 & 0xff | y << 8, src & ~2);
					break;
				case 0x0c: // ノーマル
					this.xfer16x16(this.bitmap, x | y << 8, src & ~3 | 1);
					this.xfer16x16(this.bitmap, x | (y - 16 & 0x1ff) << 8, src & ~3);
					this.xfer16x16(this.bitmap, x - 16 & 0xff | y << 8, src | 3);
					this.xfer16x16(this.bitmap, x - 16 & 0xff | (y - 16 & 0x1ff) << 8, src & ~3 | 2);
					break;
				case 0x0d: // V反転
					this.xfer16x16V(this.bitmap, x | y << 8, src & ~3);
					this.xfer16x16V(this.bitmap, x | (y - 16 & 0x1ff) << 8, src & ~3 | 1);
					this.xfer16x16V(this.bitmap, x - 16 & 0xff | y << 8, src & ~3 | 2);
					this.xfer16x16V(this.bitmap, x - 16 & 0xff | (y - 16 & 0x1ff) << 8, src | 3);
					break;
				case 0x0e: // H反転
					this.xfer16x16H(this.bitmap, x | y << 8, src | 3);
					this.xfer16x16H(this.bitmap, x | (y - 16 & 0x1ff) << 8, src & ~3 | 2);
					this.xfer16x16H(this.bitmap, x - 16 & 0xff | y << 8, src & ~3 | 1);
					this.xfer16x16H(this.bitmap, x - 16 & 0xff | (y - 16 & 0x1ff) << 8, src & ~3);
					break;
				case 0x0f: // HV反転
					this.xfer16x16HV(this.bitmap, x | y << 8, src & ~3 | 2);
					this.xfer16x16HV(this.bitmap, x | (y - 16 & 0x1ff) << 8, src | 3);
					this.xfer16x16HV(this.bitmap, x - 16 & 0xff | y << 8, src & ~3);
					this.xfer16x16HV(this.bitmap, x - 16 & 0xff | (y - 16 & 0x1ff) << 8, src & ~3 | 1);
					break;
				}
			}
		} else {
			for (let k = 0x1f80, i = 64; i !== 0; k += 2, --i) {
				const x = this.ram[k + 0x800] + 7 & 0xff;
				const y = (this.ram[k + 0x801] | this.ram[k + 0x1001] << 8) - 55 & 0x1ff;
				const src = this.ram[k] | this.ram[k + 0x1000] << 1 & 0x100 | this.ram[k + 1] << 9;
				switch (this.ram[k + 0x1000] & 0x0f) {
				case 0x00: // ノーマル
					this.xfer16x16(this.bitmap, x | y << 8, src);
					break;
				case 0x01: // V反転
					this.xfer16x16V(this.bitmap, x | y << 8, src);
					break;
				case 0x02: // H反転
					this.xfer16x16H(this.bitmap, x | y << 8, src);
					break;
				case 0x03: // HV反転
					this.xfer16x16HV(this.bitmap, x | y << 8, src);
					break;
				case 0x04: // ノーマル
					this.xfer16x16(this.bitmap, x | y << 8, src & ~1);
					this.xfer16x16(this.bitmap, x | (y + 16 & 0x1ff) << 8, src | 1);
					break;
				case 0x05: // V反転
					this.xfer16x16V(this.bitmap, x | y << 8, src | 1);
					this.xfer16x16V(this.bitmap, x | (y + 16 & 0x1ff) << 8, src & ~1);
					break;
				case 0x06: // H反転
					this.xfer16x16H(this.bitmap, x | y << 8, src & ~1);
					this.xfer16x16H(this.bitmap, x | (y + 16 & 0x1ff) << 8, src | 1);
					break;
				case 0x07: // HV反転
					this.xfer16x16HV(this.bitmap, x | y << 8, src | 1);
					this.xfer16x16HV(this.bitmap, x | (y + 16 & 0x1ff) << 8, src & ~1);
					break;
				case 0x08: // ノーマル
					this.xfer16x16(this.bitmap, x | y << 8, src | 2);
					this.xfer16x16(this.bitmap, x + 16 & 0xff | y << 8, src & ~2);
					break;
				case 0x09: // V反転
					this.xfer16x16V(this.bitmap, x | y << 8, src | 2);
					this.xfer16x16V(this.bitmap, x + 16 & 0xff | y << 8, src & ~2);
					break;
				case 0x0a: // H反転
					this.xfer16x16H(this.bitmap, x | y << 8, src & ~2);
					this.xfer16x16H(this.bitmap, x + 16 & 0xff | y << 8, src | 2);
					break;
				case 0x0b: // HV反転
					this.xfer16x16HV(this.bitmap, x | y << 8, src & ~2);
					this.xfer16x16HV(this.bitmap, x + 16 & 0xff | y << 8, src | 2);
					break;
				case 0x0c: // ノーマル
					this.xfer16x16(this.bitmap, x | y << 8, src & ~3 | 2);
					this.xfer16x16(this.bitmap, x | (y + 16 & 0x1ff) << 8, src | 3);
					this.xfer16x16(this.bitmap, x + 16 & 0xff | y << 8, src & ~3);
					this.xfer16x16(this.bitmap, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3 | 1);
					break;
				case 0x0d: // V反転
					this.xfer16x16V(this.bitmap, x | y << 8, src | 3);
					this.xfer16x16V(this.bitmap, x | (y + 16 & 0x1ff) << 8, src & ~3 | 2);
					this.xfer16x16V(this.bitmap, x + 16 & 0xff | y << 8, src & ~3 | 1);
					this.xfer16x16V(this.bitmap, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3);
					break;
				case 0x0e: // H反転
					this.xfer16x16H(this.bitmap, x | y << 8, src & ~3);
					this.xfer16x16H(this.bitmap, x | (y + 16 & 0x1ff) << 8, src & ~3 | 1);
					this.xfer16x16H(this.bitmap, x + 16 & 0xff | y << 8, src & ~3 | 2);
					this.xfer16x16H(this.bitmap, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src | 3);
					break;
				case 0x0f: // HV反転
					this.xfer16x16HV(this.bitmap, x | y << 8, src & ~3 | 1);
					this.xfer16x16HV(this.bitmap, x | (y + 16 & 0x1ff) << 8, src & ~3);
					this.xfer16x16HV(this.bitmap, x + 16 & 0xff | y << 8, src | 3);
					this.xfer16x16HV(this.bitmap, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, src & ~3 | 2);
					break;
				}
			}
		}

		// fg描画
		p = 256 * 8 * 4 + 232;
		for (let k = 0x1040, i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				if (~this.priority & 4 || (this.ram[k] ^ this.priority) & 0xf0)
					this.xfer8x8f(this.bitmap, p, k);
		p = 256 * 8 * 36 + 232;
		for (let k = 0x1002, i = 0; i < 28; p -= 8, k++, i++)
			if (~this.priority & 4 || (this.ram[k] ^ this.priority) & 0xf0)
				this.xfer8x8f(this.bitmap, p, k);
		p = 256 * 8 * 37 + 232;
		for (let k = 0x1022, i = 0; i < 28; p -= 8, k++, i++)
			if (~this.priority & 4 || (this.ram[k] ^ this.priority) & 0xf0)
				this.xfer8x8f(this.bitmap, p, k);
		p = 256 * 8 * 2 + 232;
		for (let k = 0x13c2, i = 0; i < 28; p -= 8, k++, i++)
			if (~this.priority & 4 || (this.ram[k] ^ this.priority) & 0xf0)
				this.xfer8x8f(this.bitmap, p, k);
		p = 256 * 8 * 3 + 232;
		for (let k = 0x13e2, i = 0; i < 28; p -= 8, k++, i++)
			if (~this.priority & 4 || (this.ram[k] ^ this.priority) & 0xf0)
				this.xfer8x8f(this.bitmap, p, k);

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				this.bitmap[p] = this.rgb[this.bitmap[p]];

		return this.bitmap;
	}

	xfer8x8f(data, p, k) {
		const q = this.ram[k] << 6, idx = this.ram[k + 0x400] << 2 & 0xfc;
		let px;

		(px = this.fg[q | 0x00]) && (data[p + 0x000] = idx | px);
		(px = this.fg[q | 0x01]) && (data[p + 0x001] = idx | px);
		(px = this.fg[q | 0x02]) && (data[p + 0x002] = idx | px);
		(px = this.fg[q | 0x03]) && (data[p + 0x003] = idx | px);
		(px = this.fg[q | 0x04]) && (data[p + 0x004] = idx | px);
		(px = this.fg[q | 0x05]) && (data[p + 0x005] = idx | px);
		(px = this.fg[q | 0x06]) && (data[p + 0x006] = idx | px);
		(px = this.fg[q | 0x07]) && (data[p + 0x007] = idx | px);
		(px = this.fg[q | 0x08]) && (data[p + 0x100] = idx | px);
		(px = this.fg[q | 0x09]) && (data[p + 0x101] = idx | px);
		(px = this.fg[q | 0x0a]) && (data[p + 0x102] = idx | px);
		(px = this.fg[q | 0x0b]) && (data[p + 0x103] = idx | px);
		(px = this.fg[q | 0x0c]) && (data[p + 0x104] = idx | px);
		(px = this.fg[q | 0x0d]) && (data[p + 0x105] = idx | px);
		(px = this.fg[q | 0x0e]) && (data[p + 0x106] = idx | px);
		(px = this.fg[q | 0x0f]) && (data[p + 0x107] = idx | px);
		(px = this.fg[q | 0x10]) && (data[p + 0x200] = idx | px);
		(px = this.fg[q | 0x11]) && (data[p + 0x201] = idx | px);
		(px = this.fg[q | 0x12]) && (data[p + 0x202] = idx | px);
		(px = this.fg[q | 0x13]) && (data[p + 0x203] = idx | px);
		(px = this.fg[q | 0x14]) && (data[p + 0x204] = idx | px);
		(px = this.fg[q | 0x15]) && (data[p + 0x205] = idx | px);
		(px = this.fg[q | 0x16]) && (data[p + 0x206] = idx | px);
		(px = this.fg[q | 0x17]) && (data[p + 0x207] = idx | px);
		(px = this.fg[q | 0x18]) && (data[p + 0x300] = idx | px);
		(px = this.fg[q | 0x19]) && (data[p + 0x301] = idx | px);
		(px = this.fg[q | 0x1a]) && (data[p + 0x302] = idx | px);
		(px = this.fg[q | 0x1b]) && (data[p + 0x303] = idx | px);
		(px = this.fg[q | 0x1c]) && (data[p + 0x304] = idx | px);
		(px = this.fg[q | 0x1d]) && (data[p + 0x305] = idx | px);
		(px = this.fg[q | 0x1e]) && (data[p + 0x306] = idx | px);
		(px = this.fg[q | 0x1f]) && (data[p + 0x307] = idx | px);
		(px = this.fg[q | 0x20]) && (data[p + 0x400] = idx | px);
		(px = this.fg[q | 0x21]) && (data[p + 0x401] = idx | px);
		(px = this.fg[q | 0x22]) && (data[p + 0x402] = idx | px);
		(px = this.fg[q | 0x23]) && (data[p + 0x403] = idx | px);
		(px = this.fg[q | 0x24]) && (data[p + 0x404] = idx | px);
		(px = this.fg[q | 0x25]) && (data[p + 0x405] = idx | px);
		(px = this.fg[q | 0x26]) && (data[p + 0x406] = idx | px);
		(px = this.fg[q | 0x27]) && (data[p + 0x407] = idx | px);
		(px = this.fg[q | 0x28]) && (data[p + 0x500] = idx | px);
		(px = this.fg[q | 0x29]) && (data[p + 0x501] = idx | px);
		(px = this.fg[q | 0x2a]) && (data[p + 0x502] = idx | px);
		(px = this.fg[q | 0x2b]) && (data[p + 0x503] = idx | px);
		(px = this.fg[q | 0x2c]) && (data[p + 0x504] = idx | px);
		(px = this.fg[q | 0x2d]) && (data[p + 0x505] = idx | px);
		(px = this.fg[q | 0x2e]) && (data[p + 0x506] = idx | px);
		(px = this.fg[q | 0x2f]) && (data[p + 0x507] = idx | px);
		(px = this.fg[q | 0x30]) && (data[p + 0x600] = idx | px);
		(px = this.fg[q | 0x31]) && (data[p + 0x601] = idx | px);
		(px = this.fg[q | 0x32]) && (data[p + 0x602] = idx | px);
		(px = this.fg[q | 0x33]) && (data[p + 0x603] = idx | px);
		(px = this.fg[q | 0x34]) && (data[p + 0x604] = idx | px);
		(px = this.fg[q | 0x35]) && (data[p + 0x605] = idx | px);
		(px = this.fg[q | 0x36]) && (data[p + 0x606] = idx | px);
		(px = this.fg[q | 0x37]) && (data[p + 0x607] = idx | px);
		(px = this.fg[q | 0x38]) && (data[p + 0x700] = idx | px);
		(px = this.fg[q | 0x39]) && (data[p + 0x701] = idx | px);
		(px = this.fg[q | 0x3a]) && (data[p + 0x702] = idx | px);
		(px = this.fg[q | 0x3b]) && (data[p + 0x703] = idx | px);
		(px = this.fg[q | 0x3c]) && (data[p + 0x704] = idx | px);
		(px = this.fg[q | 0x3d]) && (data[p + 0x705] = idx | px);
		(px = this.fg[q | 0x3e]) && (data[p + 0x706] = idx | px);
		(px = this.fg[q | 0x3f]) && (data[p + 0x707] = idx | px);
	}

	xfer8x8b(data, p, k) {
		const q = (this.ram[k] | this.ram[k + 0x800] << 8) << 6 & 0x7fc0;
		const idx = this.ram[k + 0x800] << 1 & 0xfc | this.ram[k + 0x800] << 8 & 0x100;

		data[p + 0x000] = BGCOLOR[idx | this.bg[q | 0x00]];
		data[p + 0x001] = BGCOLOR[idx | this.bg[q | 0x01]];
		data[p + 0x002] = BGCOLOR[idx | this.bg[q | 0x02]];
		data[p + 0x003] = BGCOLOR[idx | this.bg[q | 0x03]];
		data[p + 0x004] = BGCOLOR[idx | this.bg[q | 0x04]];
		data[p + 0x005] = BGCOLOR[idx | this.bg[q | 0x05]];
		data[p + 0x006] = BGCOLOR[idx | this.bg[q | 0x06]];
		data[p + 0x007] = BGCOLOR[idx | this.bg[q | 0x07]];
		data[p + 0x100] = BGCOLOR[idx | this.bg[q | 0x08]];
		data[p + 0x101] = BGCOLOR[idx | this.bg[q | 0x09]];
		data[p + 0x102] = BGCOLOR[idx | this.bg[q | 0x0a]];
		data[p + 0x103] = BGCOLOR[idx | this.bg[q | 0x0b]];
		data[p + 0x104] = BGCOLOR[idx | this.bg[q | 0x0c]];
		data[p + 0x105] = BGCOLOR[idx | this.bg[q | 0x0d]];
		data[p + 0x106] = BGCOLOR[idx | this.bg[q | 0x0e]];
		data[p + 0x107] = BGCOLOR[idx | this.bg[q | 0x0f]];
		data[p + 0x200] = BGCOLOR[idx | this.bg[q | 0x10]];
		data[p + 0x201] = BGCOLOR[idx | this.bg[q | 0x11]];
		data[p + 0x202] = BGCOLOR[idx | this.bg[q | 0x12]];
		data[p + 0x203] = BGCOLOR[idx | this.bg[q | 0x13]];
		data[p + 0x204] = BGCOLOR[idx | this.bg[q | 0x14]];
		data[p + 0x205] = BGCOLOR[idx | this.bg[q | 0x15]];
		data[p + 0x206] = BGCOLOR[idx | this.bg[q | 0x16]];
		data[p + 0x207] = BGCOLOR[idx | this.bg[q | 0x17]];
		data[p + 0x300] = BGCOLOR[idx | this.bg[q | 0x18]];
		data[p + 0x301] = BGCOLOR[idx | this.bg[q | 0x19]];
		data[p + 0x302] = BGCOLOR[idx | this.bg[q | 0x1a]];
		data[p + 0x303] = BGCOLOR[idx | this.bg[q | 0x1b]];
		data[p + 0x304] = BGCOLOR[idx | this.bg[q | 0x1c]];
		data[p + 0x305] = BGCOLOR[idx | this.bg[q | 0x1d]];
		data[p + 0x306] = BGCOLOR[idx | this.bg[q | 0x1e]];
		data[p + 0x307] = BGCOLOR[idx | this.bg[q | 0x1f]];
		data[p + 0x400] = BGCOLOR[idx | this.bg[q | 0x20]];
		data[p + 0x401] = BGCOLOR[idx | this.bg[q | 0x21]];
		data[p + 0x402] = BGCOLOR[idx | this.bg[q | 0x22]];
		data[p + 0x403] = BGCOLOR[idx | this.bg[q | 0x23]];
		data[p + 0x404] = BGCOLOR[idx | this.bg[q | 0x24]];
		data[p + 0x405] = BGCOLOR[idx | this.bg[q | 0x25]];
		data[p + 0x406] = BGCOLOR[idx | this.bg[q | 0x26]];
		data[p + 0x407] = BGCOLOR[idx | this.bg[q | 0x27]];
		data[p + 0x500] = BGCOLOR[idx | this.bg[q | 0x28]];
		data[p + 0x501] = BGCOLOR[idx | this.bg[q | 0x29]];
		data[p + 0x502] = BGCOLOR[idx | this.bg[q | 0x2a]];
		data[p + 0x503] = BGCOLOR[idx | this.bg[q | 0x2b]];
		data[p + 0x504] = BGCOLOR[idx | this.bg[q | 0x2c]];
		data[p + 0x505] = BGCOLOR[idx | this.bg[q | 0x2d]];
		data[p + 0x506] = BGCOLOR[idx | this.bg[q | 0x2e]];
		data[p + 0x507] = BGCOLOR[idx | this.bg[q | 0x2f]];
		data[p + 0x600] = BGCOLOR[idx | this.bg[q | 0x30]];
		data[p + 0x601] = BGCOLOR[idx | this.bg[q | 0x31]];
		data[p + 0x602] = BGCOLOR[idx | this.bg[q | 0x32]];
		data[p + 0x603] = BGCOLOR[idx | this.bg[q | 0x33]];
		data[p + 0x604] = BGCOLOR[idx | this.bg[q | 0x34]];
		data[p + 0x605] = BGCOLOR[idx | this.bg[q | 0x35]];
		data[p + 0x606] = BGCOLOR[idx | this.bg[q | 0x36]];
		data[p + 0x607] = BGCOLOR[idx | this.bg[q | 0x37]];
		data[p + 0x700] = BGCOLOR[idx | this.bg[q | 0x38]];
		data[p + 0x701] = BGCOLOR[idx | this.bg[q | 0x39]];
		data[p + 0x702] = BGCOLOR[idx | this.bg[q | 0x3a]];
		data[p + 0x703] = BGCOLOR[idx | this.bg[q | 0x3b]];
		data[p + 0x704] = BGCOLOR[idx | this.bg[q | 0x3c]];
		data[p + 0x705] = BGCOLOR[idx | this.bg[q | 0x3d]];
		data[p + 0x706] = BGCOLOR[idx | this.bg[q | 0x3e]];
		data[p + 0x707] = BGCOLOR[idx | this.bg[q | 0x3f]];
	}

	xfer16x16(data, dst, src) {
		const idx = src >> 6 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0x1ff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[src++]]) !== 0xff)
					data[dst] = px;
	}

	xfer16x16V(data, dst, src) {
		const idx = src >> 6 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x1ff00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[src++]]) !== 0xff)
					data[dst] = px;
	}

	xfer16x16H(data, dst, src) {
		const idx = src >> 6 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x1ff00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[--src]]) !== 0xff)
					data[dst] = px;
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >> 6 & 0x1f8;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0x1ff00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = OBJCOLOR[idx | this.obj[--src]]) !== 0xff)
					data[dst] = px;
	}
}

/*
 *
 *	Sky Kid
 *
 */

let PRG1, PRG2, PRG2I, FG, BG, OBJ, RED, GREEN, BLUE, BGCOLOR, OBJCOLOR;

read('skykid.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG1 = Uint8Array.concat(...['sk2_2.6c', 'sk1-1c.6b', 'sk1_3.6d'].map(e => zip.decompress(e))).addBase();
	PRG2 = zip.decompress('sk2_4.3c').addBase();
	PRG2I = zip.decompress('cus63-63a1.mcu').addBase();
	FG = zip.decompress('sk1_6.6l');
	BG = zip.decompress('sk1_5.7e');
	OBJ = Uint8Array.concat(...['sk1_8.10n', 'sk1_7.10m'].map(e => zip.decompress(e)));
	RED = zip.decompress('sk1-1.2n');
	GREEN = zip.decompress('sk1-2.2p');
	BLUE = zip.decompress('sk1-3.2r');
	BGCOLOR = zip.decompress('sk1-4.5n');
	OBJCOLOR = zip.decompress('sk1-5.6n');
	game = new SkyKid();
	sound = new C30();
	canvas.addEventListener('click', () => game.coin(true));
	init({game, sound});
});

