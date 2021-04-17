/*
 *
 *	The Return of Ishtar
 *
 */

import YM2151 from './ym2151.js';
import C30 from './c30.js';
import {seq, rseq, convertGFX, Timer} from './utils.js';
import {init, read} from './main.js';
import MC6809 from './mc6809.js';
import MC6801 from './mc6801.js';
let game, sound;

class TheReturnOfIshtar {
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

	ram = new Uint8Array(0x6000).addBase();
	ram3 = new Uint8Array(0xd00).addBase();
	in = new Uint8Array(5).fill(0xff);
	sw = {a: 0, b: 0};
	bank = 0;
	cpu_irq = false;
	cpu2_irq = false;
	mcu_irq = false;

	bg1 = new Uint8Array(0x10000).fill(3);
	bg2 = new Uint8Array(0x10000).fill(3);
	obj = new Uint8Array(0x80000).fill(15);
	rgb = Int32Array.from(seq(0x200), i => 0xff000000 | BLUE[i] * 255 / 15 << 16 | (RED[i] >> 4) * 255 / 15 << 8 | (RED[i] & 15) * 255 / 15);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;
	isspace1 = new Uint8Array(0x400);
	isspace2 = new Uint8Array(0x400);
	vScroll = new Uint16Array(4);
	hScroll = new Uint8Array(4);
//	bgbank = 0;
	backcolor = 0;

	cpu = new MC6809(Math.floor(49152000 / 32));
	cpu2 = new MC6809(Math.floor(49152000 / 32));
	mcu = new MC6801(Math.floor(49152000 / 8 / 4));
	timer = new Timer(60);

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x40; i++) {
			this.cpu.memorymap[i].base = this.ram.base[i];
			this.cpu.memorymap[i].write = null;
		}
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0x40 + i].read = (addr) => { return sound[1].read(addr); };
			this.cpu.memorymap[0x40 + i].write = (addr, data) => { sound[1].write(addr, data); };
		}
		for (let i = 0; i < 0x1c; i++) {
			this.cpu.memorymap[0x44 + i].base = this.ram.base[0x44 + i];
			this.cpu.memorymap[0x44 + i].write = null;
		}
		for (let i = 0; i < 0x20; i++)
			this.cpu.memorymap[0x60 + i].base = PRG1.base[i];
		for (let i = 0; i < 0x80; i++)
			this.cpu.memorymap[0x80 + i].base = PRG1.base[0x20 + i];
		this.cpu.memorymap[0x84].write = () => { this.cpu_irq = false; };
//		for (let i = 0; i < 8; i++)
//			this.cpu.memorymap[0x88 + i].write = (addr) => { this.bgbank = addr >> 10 & 1; };
		this.cpu.memorymap[0x90].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				return void(this.vScroll[0] = this.vScroll[0] & 0xff | data << 8);
			case 1:
				return void(this.vScroll[0] = this.vScroll[0] & 0xff00 | data);
			case 2:
				return void(this.hScroll[0] = data);
			case 3:
				const _bank = data << 5 & 0x60;
				if (_bank === this.bank)
					break;
//				for (let i = 0; i < 0x20; i++)
//					this.cpu.memorymap[0x60 + i].base = PRG1.base[_bank + i];
				return void(this.bank = _bank);
			case 4:
				return void(this.vScroll[1] = this.vScroll[1] & 0xff | data << 8);
			case 5:
				return void(this.vScroll[1] = this.vScroll[1] & 0xff00 | data);
			case 6:
				return void(this.hScroll[1] = data);
			}
		};
		this.cpu.memorymap[0x94].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				return void(this.vScroll[2] = this.vScroll[2] & 0xff | data << 8);
			case 1:
				return void(this.vScroll[2] = this.vScroll[2] & 0xff00 | data);
			case 2:
				return void(this.hScroll[2] = data);
			case 4:
				return void(this.vScroll[3] = this.vScroll[3] & 0xff | data << 8);
			case 5:
				return void(this.vScroll[3] = this.vScroll[3] & 0xff00 | data);
			case 6:
				return void(this.hScroll[3] = data);
			}
		};
		this.cpu.memorymap[0xa0].write = (addr, data) => { this.backcolor = data; };

		this.cpu.check_interrupt = () => { return this.cpu_irq && this.cpu.interrupt(); };

		for (let i = 0; i < 0x20; i++) {
			this.cpu2.memorymap[i].base = this.ram.base[0x40 + i];
			this.cpu2.memorymap[i].write = null;
		}
		for (let i = 0; i < 0x20; i++) {
			this.cpu2.memorymap[0x40 + i].base = this.ram.base[0x20 + i];
			this.cpu2.memorymap[0x40 + i].write = null;
		}
		for (let i = 0; i < 0x20; i++) {
			this.cpu2.memorymap[0x60 + i].base = this.ram.base[i];
			this.cpu2.memorymap[0x60 + i].write = null;
		}
		for (let i = 0; i < 0x80; i++)
			this.cpu2.memorymap[0x80 + i].base = PRG2.base[i];
		this.cpu2.memorymap[0xb0].write = () => { this.cpu2_irq = false; };

		this.cpu2.check_interrupt = () => { return this.cpu2_irq && this.cpu2.interrupt(); };

		this.mcu.memorymap[0].base = this.ram3.base[0];
		this.mcu.memorymap[0].read = (addr) => {
			let data;
			switch (addr) {
			case 2:
				return this.in[2];
			case 8:
				return data = this.ram3[8], this.ram3[8] &= ~0xe0, data;
			}
			return this.ram3[addr];
		};
		this.mcu.memorymap[0].write = null;
		for (let i = 0; i < 4; i++) {
			this.mcu.memorymap[0x10 + i].read = (addr) => { return sound[1].read(addr); };
			this.mcu.memorymap[0x10 + i].write = (addr, data) => { sound[1].write(addr, data); };
		}
		for (let i = 0; i < 0x0c; i++) {
			this.mcu.memorymap[0x14 + i].base = this.ram3.base[1 + i];
			this.mcu.memorymap[0x14 + i].write = null;
		}
		for (let i = 0; i < 0x20; i++)
			this.mcu.memorymap[0x20 + i].base = PRG3.base[0x20 + i];
		this.mcu.memorymap[0x60].read = (addr) => {
			switch (addr & 0xff) {
			case 1:
				return sound[0].status;
			case 0x20:
				return this.in[0];
			case 0x21:
				return this.in[1];
			case 0x30:
				return this.in[3];
			case 0x31:
				return this.in[4];
			}
			return 0xff;
		};
		this.mcu.memorymap[0x60].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				return void(sound[0].addr = data);
			case 1:
				return sound[0].write(data);
			}
		};
		for (let i = 0; i < 0x40; i++)
			this.mcu.memorymap[0x80 + i].base = PRG3.base[0x40 + i];
		for (let i = 0; i < 0x10; i++)
			this.mcu.memorymap[0xf0 + i].base = PRG3I.base[i];

		this.mcu.check_interrupt = () => { return this.mcu_irq && this.mcu.interrupt() ? (this.mcu_irq = false, true) : (this.ram3[8] & 0x48) === 0x48 && this.mcu.interrupt('ocf'); };

		// Videoの初期化
		convertGFX(this.bg1, BG1, 1024, rseq(8, 0, 8), seq(8), [Math.floor(BG1.length / 3) * 16, -1, -1], 8);
		convertGFX(this.bg1, BG1, 1024, rseq(8, 0, 16), seq(4).concat(seq(4, 8)), [0, 4], 16);
		convertGFX(this.bg2, BG2, 1024, rseq(8, 0, 8), seq(8), [Math.floor(BG2.length / 3) * 16, -1, -1], 8);
		convertGFX(this.bg2, BG2, 1024, rseq(8, 0, 16), seq(4).concat(seq(4, 8)), [0, 4], 16);
		convertGFX(this.obj, OBJ, 512, rseq(16, 2048, 64).concat(rseq(16, 0, 64)), seq(16, 0, 4).concat(seq(16, 1024, 4)), seq(4), 512);
		for (let p = 0, q = 0, i = 1024; i !== 0; q += 64, --i)
			this.isspace1[p++] = Number(this.bg1.subarray(q, q + 64).every(e => e === 7));
		for (let p = 0, q = 0, i = 1024; i !== 0; q += 64, --i)
			this.isspace2[p++] = Number(this.bg2.subarray(q, q + 64).every(e => e === 7));
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.cpu2.execute(tick_rate);
			this.mcu.execute(tick_rate);
			this.timer.execute(tick_rate, () => { update(), this.cpu_irq = this.cpu2_irq = this.mcu_irq = true, this.ram3[8] |= this.ram3[8] << 3 & 0x40; });
			sound[0].execute(tick_rate);
			sound[1].execute(tick_rate);
			audio.execute(tick_rate);
		}
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		const sw = this.sw;

		// DIPスイッチの更新
		if (this.fDIPSwitchChanged) {
			this.fDIPSwitchChanged = false;
			if (this.fAttract)
				sw.a &= ~0x40;
			else
				sw.a |= 0x40;
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			sw.a |= 0x80;
		else
			sw.a &= ~0x80;
		this.in[3] = ~(sw.a << 1 & 0x80 | sw.a << 2 & 0x40 | sw.a << 3 & 0x20 | sw.a << 4 & 0x10 | sw.b >> 3 & 8 | sw.b >> 2 & 4 | sw.b >> 1 & 2 | sw.b & 1);
		this.in[4] = ~(sw.a & 0x80 | sw.a << 1 & 0x40 | sw.a << 2 & 0x20 | sw.a << 1 & 0x10 | sw.b >> 4 & 8 | sw.b >> 3 & 4 | sw.b >> 2 & 2 | sw.b >> 1 & 1);

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu_irq = this.cpu2_irq = this.mcu_irq = false;
			this.cpu.reset();
			this.cpu2.reset();
			this.mcu.reset();
		}
		return this;
	}

	updateInput() {
		this.in[1] = this.in[1] & ~0x50 | !this.fCoin << 4 | !this.fStart2P << 6;
		this.in[0] = this.in[0] & ~(1 << 6) | !this.fStart1P << 6;
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
		this.in[1] = this.in[1] & ~(1 << 2) | !fDown << 2, this.in[0] |= fDown << 2;
	}

	right(fDown) {
		this.in[2] = this.in[2] & ~(1 << 5) | fDown << 4 | !fDown << 5;
	}

	down(fDown) {
		this.in[0] = this.in[0] & ~(1 << 2) | !fDown << 2, this.in[1] |= fDown << 2;
	}

	left(fDown) {
		this.in[2] = this.in[2] & ~(1 << 4) | fDown << 5 | !fDown << 4;
	}

	up2(fDown) {
		this.in[1] = this.in[1] & ~(1 << 3) | !fDown << 3, this.in[0] |= 1 << 3;
	}

	right2(fDown) {
		this.in[0] = this.in[0] & ~(1 << 4) | !fDown << 4, this.in[2] |= 1 << 7;
	}

	down2(fDown) {
		this.in[0] = this.in[0] & ~(1 << 3) | !fDown << 3, this.in[1] |= 1 << 3;
	}

	left2(fDown) {
		this.in[2] = this.in[2] & ~(1 << 7) | !fDown << 7, this.in[0] |= 1 << 4;
	}

	triggerA(fDown) {
		this.in[2] = this.in[2] & ~(1 << 3) | !fDown << 3;
	}

	triggerB(fDown) {
		this.in[0] = this.in[0] & ~(1 << 1) | !fDown << 1;
	}

	makeBitmap(flag) {
		if (!(this.updated = flag))
			return this.bitmap;

		const ram = this.ram, flip = !!(ram[0x5ff6] & 1);

		// 画面クリア
		let p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256, i++)
			this.bitmap.fill(BGCOLOR[this.backcolor << 3 | 7], p, p + 224);

		for (let pri = 0; pri < 8; pri++) {
			// bg描画
			if ((this.vScroll[3] >> 9 & 7) === pri) {
				p = flip ? 256 * 8 * 2 + 232 - (205 - this.vScroll[3] & 7) * 256 + (7 - this.hScroll[3] & 7) : 256 * 8 * 2 + 232 - (19 + this.vScroll[3] & 7) * 256 + (25 + this.hScroll[3] & 7);
				let k = flip ? 205 - this.vScroll[3] >> 2 & 0x7e | 7 - this.hScroll[3] << 4 & 0xf80 | 0x3000 : 19 + this.vScroll[3] >> 2 & 0x7e | 25 + this.hScroll[3] << 4 & 0xf80 | 0x3000;
				for (let i = 0; i < 29; k = k + 54 & 0x7e | k + 0x80 & 0xf80 | 0x3000, p -= 256 * 8 * 37 + 8, i++)
					for (let j = 0; j < 37; k = k + 2 & 0x7e | k & 0x3f80, p += 256 * 8, j++)
						this.xfer8x8b2(this.bitmap, p, k, 1);
			}
			if ((this.vScroll[2] >> 9 & 7) === pri) {
				p = flip ? 256 * 8 * 2 + 232 - (203 - this.vScroll[2] & 7) * 256 + (7 - this.hScroll[2] & 7) : 256 * 8 * 2 + 232 - (21 + this.vScroll[2] & 7) * 256 + (25 + this.hScroll[2] & 7);
				let k = flip ? 203 - this.vScroll[2] >> 2 & 0x7e | 7 - this.hScroll[2] << 4 & 0xf80 | 0x2000 : 21 + this.vScroll[2] >> 2 & 0x7e | 25 + this.hScroll[2] << 4 & 0xf80 | 0x2000;
				for (let i = 0; i < 29; k = k + 54 & 0x7e | k + 0x80 & 0xf80 | 0x2000, p -= 256 * 8 * 37 + 8, i++)
					for (let j = 0; j < 37; k = k + 2 & 0x7e | k & 0x3f80, p += 256 * 8, j++)
						this.xfer8x8b2(this.bitmap, p, k, 0);
			}
			if ((this.vScroll[1] >> 9 & 7) === pri) {
				p = flip ? 256 * 8 * 2 + 232 - (206 - this.vScroll[1] & 7) * 256 + (7 - this.hScroll[1] & 7) : 256 * 8 * 2 + 232 - (18 + this.vScroll[1] & 7) * 256 + (25 + this.hScroll[1] & 7);
				let k = flip ? 206 - this.vScroll[1] >> 2 & 0x7e | 7 - this.hScroll[1] << 4 & 0xf80 | 0x1000 : 18 + this.vScroll[1] >> 2 & 0x7e | 25 + this.hScroll[1] << 4 & 0xf80 | 0x1000;
				for (let i = 0; i < 29; k = k + 54 & 0x7e | k + 0x80 & 0xf80 | 0x1000, p -= 256 * 8 * 37 + 8, i++)
					for (let j = 0; j < 37; k = k + 2 & 0x7e | k & 0x3f80, p += 256 * 8, j++)
						this.xfer8x8b1(this.bitmap, p, k, 1);
			}
			if ((this.vScroll[0] >> 9 & 7) === pri) {
				p = flip ? 256 * 8 * 2 + 232 - (204 - this.vScroll[0] & 7) * 256 + (7 - this.hScroll[0] & 7) : 256 * 8 * 2 + 232 - (20 + this.vScroll[0] & 7) * 256 + (25 + this.hScroll[0] & 7);
				let k = flip ? 204 - this.vScroll[0] >> 2 & 0x7e | 7 - this.hScroll[0] << 4 & 0xf80 : 20 + this.vScroll[0] >> 2 & 0x7e | 25 + this.hScroll[0] << 4 & 0xf80;
				for (let i = 0; i < 29; k = k + 54 & 0x7e | k + 0x80 & 0xf80, p -= 256 * 8 * 37 + 8, i++)
					for (let j = 0; j < 37; k = k + 2 & 0x7e | k & 0x3f80, p += 256 * 8, j++)
						this.xfer8x8b1(this.bitmap, p, k, 0);
			}

			// obj描画
			for (let k = 0x5800, i = 127; i !== 0; k += 16, --i) {
				if (ram[k + 8] >> 5 !== pri)
					continue;
				const w = [16, 8, 32, 4][ram[k + 8] >> 1 & 3], h = [16, 8, 32, 4][ram[k + 4] >> 6];
				const x = w + ram[k + 9] + ram[0x5ff7] - (flip ? 0 : 2) & 0xff;
				const y = (ram[k + 7] | ram[k + 6] << 8) + (ram[0x5ff5] | ram[0x5ff4] << 8) - (flip ? 141 : 51) & 0x1ff;
				const src = (~ram[k + 8] & 0x18 | 7) & -w | (ram[k + 4] & -h) << 5 & 0x300 | ram[k + 5] << 10 & 0xfc00 | ram[k + 4] << 16 & 0x70000;
				const color = ram[k + 6] << 3 & 0x7f0;
				switch (ram[k + 8] & 1 | ram[k + 4] >> 4 & 2) {
				case 0:
					this.xferHxW(this.bitmap, src, color, y, x, h, w);
					break;
				case 1:
					this.xferHxW_H(this.bitmap, src, color, y, x, h, w);
					break;
				case 2:
					this.xferHxW_V(this.bitmap, src, color, y, x, h, w);
					break;
				case 0x03:
					this.xferHxW_HV(this.bitmap, src, color, y, x, h, w);
					break;
				}
			}
		}

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				this.bitmap[p] = this.rgb[this.bitmap[p]];

		return this.bitmap;
	}

	xfer8x8b1(data, p, k, back) {
		const c = this.ram[k] | this.ram[k + 1] << 8 & 0x100 | back << 9, q = c << 6;
		const idx = this.ram[k + 1] << 3;
		let px;

		if (this.isspace1[c])
			return;
		(px = this.bg1[q | 0x00]) !== 7 && (data[p + 0x000] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x01]) !== 7 && (data[p + 0x001] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x02]) !== 7 && (data[p + 0x002] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x03]) !== 7 && (data[p + 0x003] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x04]) !== 7 && (data[p + 0x004] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x05]) !== 7 && (data[p + 0x005] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x06]) !== 7 && (data[p + 0x006] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x07]) !== 7 && (data[p + 0x007] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x08]) !== 7 && (data[p + 0x100] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x09]) !== 7 && (data[p + 0x101] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x0a]) !== 7 && (data[p + 0x102] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x0b]) !== 7 && (data[p + 0x103] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x0c]) !== 7 && (data[p + 0x104] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x0d]) !== 7 && (data[p + 0x105] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x0e]) !== 7 && (data[p + 0x106] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x0f]) !== 7 && (data[p + 0x107] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x10]) !== 7 && (data[p + 0x200] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x11]) !== 7 && (data[p + 0x201] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x12]) !== 7 && (data[p + 0x202] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x13]) !== 7 && (data[p + 0x203] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x14]) !== 7 && (data[p + 0x204] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x15]) !== 7 && (data[p + 0x205] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x16]) !== 7 && (data[p + 0x206] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x17]) !== 7 && (data[p + 0x207] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x18]) !== 7 && (data[p + 0x300] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x19]) !== 7 && (data[p + 0x301] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x1a]) !== 7 && (data[p + 0x302] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x1b]) !== 7 && (data[p + 0x303] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x1c]) !== 7 && (data[p + 0x304] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x1d]) !== 7 && (data[p + 0x305] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x1e]) !== 7 && (data[p + 0x306] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x1f]) !== 7 && (data[p + 0x307] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x20]) !== 7 && (data[p + 0x400] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x21]) !== 7 && (data[p + 0x401] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x22]) !== 7 && (data[p + 0x402] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x23]) !== 7 && (data[p + 0x403] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x24]) !== 7 && (data[p + 0x404] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x25]) !== 7 && (data[p + 0x405] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x26]) !== 7 && (data[p + 0x406] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x27]) !== 7 && (data[p + 0x407] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x28]) !== 7 && (data[p + 0x500] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x29]) !== 7 && (data[p + 0x501] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x2a]) !== 7 && (data[p + 0x502] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x2b]) !== 7 && (data[p + 0x503] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x2c]) !== 7 && (data[p + 0x504] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x2d]) !== 7 && (data[p + 0x505] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x2e]) !== 7 && (data[p + 0x506] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x2f]) !== 7 && (data[p + 0x507] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x30]) !== 7 && (data[p + 0x600] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x31]) !== 7 && (data[p + 0x601] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x32]) !== 7 && (data[p + 0x602] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x33]) !== 7 && (data[p + 0x603] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x34]) !== 7 && (data[p + 0x604] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x35]) !== 7 && (data[p + 0x605] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x36]) !== 7 && (data[p + 0x606] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x37]) !== 7 && (data[p + 0x607] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x38]) !== 7 && (data[p + 0x700] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x39]) !== 7 && (data[p + 0x701] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x3a]) !== 7 && (data[p + 0x702] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x3b]) !== 7 && (data[p + 0x703] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x3c]) !== 7 && (data[p + 0x704] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x3d]) !== 7 && (data[p + 0x705] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x3e]) !== 7 && (data[p + 0x706] = BGCOLOR[idx | px]);
		(px = this.bg1[q | 0x3f]) !== 7 && (data[p + 0x707] = BGCOLOR[idx | px]);
	}

	xfer8x8b2(data, p, k, back) {
		const c = this.ram[k] | this.ram[k + 1] << 8 & 0x100 | back << 9, q = c << 6;
		const idx = this.ram[k + 1] << 3;
		let px;

		if (this.isspace2[c])
			return;
		(px = this.bg2[q | 0x00]) !== 7 && (data[p + 0x000] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x01]) !== 7 && (data[p + 0x001] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x02]) !== 7 && (data[p + 0x002] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x03]) !== 7 && (data[p + 0x003] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x04]) !== 7 && (data[p + 0x004] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x05]) !== 7 && (data[p + 0x005] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x06]) !== 7 && (data[p + 0x006] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x07]) !== 7 && (data[p + 0x007] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x08]) !== 7 && (data[p + 0x100] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x09]) !== 7 && (data[p + 0x101] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x0a]) !== 7 && (data[p + 0x102] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x0b]) !== 7 && (data[p + 0x103] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x0c]) !== 7 && (data[p + 0x104] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x0d]) !== 7 && (data[p + 0x105] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x0e]) !== 7 && (data[p + 0x106] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x0f]) !== 7 && (data[p + 0x107] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x10]) !== 7 && (data[p + 0x200] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x11]) !== 7 && (data[p + 0x201] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x12]) !== 7 && (data[p + 0x202] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x13]) !== 7 && (data[p + 0x203] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x14]) !== 7 && (data[p + 0x204] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x15]) !== 7 && (data[p + 0x205] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x16]) !== 7 && (data[p + 0x206] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x17]) !== 7 && (data[p + 0x207] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x18]) !== 7 && (data[p + 0x300] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x19]) !== 7 && (data[p + 0x301] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x1a]) !== 7 && (data[p + 0x302] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x1b]) !== 7 && (data[p + 0x303] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x1c]) !== 7 && (data[p + 0x304] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x1d]) !== 7 && (data[p + 0x305] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x1e]) !== 7 && (data[p + 0x306] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x1f]) !== 7 && (data[p + 0x307] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x20]) !== 7 && (data[p + 0x400] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x21]) !== 7 && (data[p + 0x401] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x22]) !== 7 && (data[p + 0x402] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x23]) !== 7 && (data[p + 0x403] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x24]) !== 7 && (data[p + 0x404] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x25]) !== 7 && (data[p + 0x405] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x26]) !== 7 && (data[p + 0x406] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x27]) !== 7 && (data[p + 0x407] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x28]) !== 7 && (data[p + 0x500] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x29]) !== 7 && (data[p + 0x501] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x2a]) !== 7 && (data[p + 0x502] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x2b]) !== 7 && (data[p + 0x503] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x2c]) !== 7 && (data[p + 0x504] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x2d]) !== 7 && (data[p + 0x505] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x2e]) !== 7 && (data[p + 0x506] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x2f]) !== 7 && (data[p + 0x507] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x30]) !== 7 && (data[p + 0x600] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x31]) !== 7 && (data[p + 0x601] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x32]) !== 7 && (data[p + 0x602] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x33]) !== 7 && (data[p + 0x603] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x34]) !== 7 && (data[p + 0x604] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x35]) !== 7 && (data[p + 0x605] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x36]) !== 7 && (data[p + 0x606] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x37]) !== 7 && (data[p + 0x607] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x38]) !== 7 && (data[p + 0x700] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x39]) !== 7 && (data[p + 0x701] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x3a]) !== 7 && (data[p + 0x702] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x3b]) !== 7 && (data[p + 0x703] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x3c]) !== 7 && (data[p + 0x704] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x3d]) !== 7 && (data[p + 0x705] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x3e]) !== 7 && (data[p + 0x706] = BGCOLOR[idx | px]);
		(px = this.bg2[q | 0x3f]) !== 7 && (data[p + 0x707] = BGCOLOR[idx | px]);
	}

	xferHxW(data, src, color, y0, x0, h, w) {
		const y1 = y0 + h - 1 & 0x1ff, x1 = x0 - w + 1 & 0xff;
		let px;

		if ((y0 < 16 || y0 >= 304) && (y1 < 16 || y1 >= 304) || (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let y = y0, i = 0; i < h; y = y + 1 & 0x1ff, i++)
			for (let x = x0, j = w - 1; j >= 0; x = x - 1 & 0xff, --j)
				if ((px = this.obj[src + i * 32 + j]) !== 0xf)
					data[x | y << 8] = 0x100 | OBJCOLOR[color | px];
	}

	xferHxW_V(data, src, color, y0, x0, h, w) {
		const y1 = y0 + h - 1 & 0x1ff, x1 = x0 - w + 1 & 0xff;
		let px;

		if ((y0 < 16 || y0 >= 304) && (y1 < 16 || y1 >= 304) || (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let y = y1, i = 0; i < h; y = y - 1 & 0x1ff, i++)
			for (let x = x0, j = w - 1; j >= 0; x = x - 1 & 0xff, --j)
				if ((px = this.obj[src + i * 32 + j]) !== 0xf)
					data[x | y << 8] = 0x100 | OBJCOLOR[color | px];
	}

	xferHxW_H(data, src, color, y0, x0, h, w) {
		const y1 = y0 + h - 1 & 0x1ff, x1 = x0 - w + 1 & 0xff;
		let px;

		if ((y0 < 16 || y0 >= 304) && (y1 < 16 || y1 >= 304) || (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let y = y0, i = 0; i < h; y = y + 1 & 0x1ff, i++)
			for (let x = x1, j = w - 1; j >= 0; x = x + 1 & 0xff, --j)
				if ((px = this.obj[src + i * 32 + j]) !== 0xf)
					data[x | y << 8] = 0x100 | OBJCOLOR[color | px];
	}

	xferHxW_HV(data, src, color, y0, x0, h, w) {
		const y1 = y0 + h - 1 & 0x1ff, x1 = x0 - w + 1 & 0xff;
		let px;

		if ((y0 < 16 || y0 >= 304) && (y1 < 16 || y1 >= 304) || (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let y = y1, i = 0; i < h; y = y - 1 & 0x1ff, i++)
			for (let x = x1, j = w - 1; j >= 0; x = x + 1 & 0xff, --j)
				if ((px = this.obj[src + i * 32 + j]) !== 0xf)
					data[x | y << 8] = 0x100 | OBJCOLOR[color | px];
	}
}

/*
 *
 *	The Return of Ishtar
 *
 */

let PRG1, PRG2, BG1, BG2, OBJ, RED, BLUE, BGCOLOR, OBJCOLOR, /* BGADDR, */ PRG3, PRG3I;

read('roishtar.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG1 = Uint8Array.concat(...['ri1_2.9d', 'ri1_1c.9c'].map(e => zip.decompress(e))).addBase();
	PRG2 = zip.decompress('ri1_3.12c').addBase();
	BG1 = Uint8Array.concat(...['ri1_14.7r', 'ri1_15.7s'].map(e => zip.decompress(e)));
	BG2 = Uint8Array.concat(...['ri1_12.4r', 'ri1_13.4s'].map(e => zip.decompress(e)));
	OBJ = Uint8Array.concat(...['ri1_5.12h', 'ri1_6.12k', 'ri1_7.12l', 'ri1_8.12m', 'ri1_9.12p', 'ri1_10.12r', 'ri1_11.12t'].map(e => zip.decompress(e)));
	OBJ = Uint8Array.concat(OBJ, new Uint8Array(0x8000).fill(0xff));
	RED = zip.decompress('ri1-1.3r');
	BLUE = zip.decompress('ri1-2.3s');
	BGCOLOR = zip.decompress('ri1-3.4v');
	OBJCOLOR = zip.decompress('ri1-4.5v');
//	BGADDR = zip.decompress('ri1-5.6u');
	PRG3 = zip.decompress('ri1_4.6b').addBase();
	PRG3I = zip.decompress('cus60-60a1.mcu').addBase();
	game = new TheReturnOfIshtar();
	sound = [
		new YM2151({clock: 3579580}),
		new C30(),
	];
	canvas.addEventListener('click', () => game.coin(true));
	init({game, sound});
});

