/*
 *
 *	Bosconian
 *
 */

import PacManSound from './pac-man_sound.js';
import Namco54XX from './namco_54xx.js';
import Namco52XX from './namco_52xx.js';
import {seq, rseq, convertGFX, Timer} from './utils.js';
import {init, expand} from './main.js';
import Z80 from './z80.js';
import MB8840 from './mb8840.js';
let game, sound;

class Bosconian {
	cxScreen = 224;
	cyScreen = 285;
	width = 256;
	height = 512;
	xOffset = 16;
	yOffset = 19;
	rotate = true;

	fReset = false;
	fTest = false;
	fDIPSwitchChanged = true;
	fCoin = 0;
	fStart1P = 0;
	fStart2P = 0;
	dwStick = 0xf;
	nMyShip = 3;
	nBonus = 'F';
	nRank = 'AUTO';
	fContinue = true;
	fAttract = true;

	fInterruptEnable0 = false;
	fInterruptEnable1 = false;
	fInterruptEnable2 = false;
	fNmiEnable0 = 0;
	fNmiEnable1 = 0;
	ram = new Uint8Array(0x1800).fill(0xff).addBase();
	mmi = new Uint8Array(0x200).fill(0xff).addBase();
	dmactrl0 = 0;
	dmactrl1 = 0;

	stars = [];
	bg = new Uint8Array(0x4000).fill(3);
	obj = new Uint8Array(0x4000).fill(3);
	bgcolor = Uint8Array.from(BGCOLOR, e => 0x10 | e);
	rgb = new Int32Array(0x80);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;

	cpu = [new Z80(Math.floor(18432000 / 6)), new Z80(Math.floor(18432000 / 6)), new Z80(Math.floor(18432000 / 6))];
	mcu = [new MB8840(), new MB8840(), new MB8840()];
	scanline = {rate: 256 * 60, frac: 0, count: 0, execute(rate, fn) {
		for (this.frac += this.rate; this.frac >= rate; this.frac -= rate)
			fn(this.count = this.count + 1 & 255);
	}};
	timer = new Timer(Math.floor(18432000 / 384));

	constructor() {
		// CPU周りの初期化
		// DIPSW SETUP A:0x01 B:0x02
		this.mmi[0] = 3; // DIPSW B/A1
		this.mmi[1] = 3; // DIPSW B/A2
		this.mmi[2] = 3; // DIPSW B/A3
		this.mmi[3] = 2; // DIPSW B/A4
		this.mmi[4] = 2; // DIPSW B/A5
		this.mmi[5] = 3; // DIPSW B/A6
		this.mmi[6] = 2; // DIPSW B/A7
		this.mmi[7] = 3; // DIPSW B/A8

		const range = (page, start, end = start, mirror = 0) => (page & ~mirror) >= start && (page & ~mirror) <= end;
		const interrupt = (_mcu) => {
			_mcu.cause = _mcu.cause & ~4 | !_mcu.interrupt() << 2;
			for (let op = _mcu.execute(); op !== 0x3c && (op !== 0x25 || _mcu.cause & 4); op = _mcu.execute())
				op === 0x25 && (_mcu.cause &= ~4);
		};

		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0x3f))
				this.cpu[0].memorymap[page].base = PRG1.base[page & 0x3f];
			else if (range(page, 0x68)) {
				this.cpu[0].memorymap[page].base = this.mmi;
				this.cpu[0].memorymap[page].write = (addr, data) => {
					switch (addr & 0xf0) {
					case 0x00:
					case 0x10:
						return sound[0].write(addr, data);
					case 0x20:
						switch (addr & 0x0f) {
						case 0:
							return void(this.fInterruptEnable0 = (data & 1) !== 0);
						case 1:
							return void(this.fInterruptEnable1 = (data & 1) !== 0);
						case 2:
							return void(this.fInterruptEnable2 = (data & 1) !== 0);
						case 3:
							return data & 1 ? (this.cpu[1].enable(), this.cpu[2].enable()) : (this.cpu[1].disable(), this.cpu[2].disable());
						}
					}
				};
			} else if (range(page, 0x70)) {
				this.cpu[0].memorymap[page].read = () => {
					let data = 0xff;
					this.dmactrl0 & 1 && (data &= this.mcu[0].o, this.mcu[0].k |= 8, interrupt(this.mcu[0]));
					this.dmactrl0 & 4 && (data &= this.mcu[1].o, this.mcu[1].r |= 0x100, interrupt(this.mcu[1]));
					return data;
				};
				this.cpu[0].memorymap[page].write = (addr, data) => {
					this.dmactrl0 & 1 && (this.mcu[0].k = data & 7, interrupt(this.mcu[0]));
					this.dmactrl0 & 4 && (this.mcu[1].r = data & 15, this.mcu[1].k = data >> 4, interrupt(this.mcu[1]));
					this.dmactrl0 & 8 && sound[1].write(data);
				};
			} else if (range(page, 0x71)) {
				this.cpu[0].memorymap[page].read = () => { return this.dmactrl0; };
				this.cpu[0].memorymap[page].write = (addr, data) => {
					this.fNmiEnable0 = 2 << (data >> 5) & ~3;
					switch (this.dmactrl0 = data) {
					case 0x71:
					case 0x91:
						if (this.mcu[0].mask & 4)
							for (this.mcu[0].execute(); this.mcu[0].pc !== 0x182; this.mcu[0].execute()) {}
						return this.mcu[0].t = this.mcu[0].t + 1 & 0xff, this.mcu[0].k |= 8, interrupt(this.mcu[0]);
					case 0x94:
						if (this.mcu[1].mask & 4)
							for (this.mcu[1].execute(); this.mcu[1].pc !== 0x4c; this.mcu[1].execute()) {}
						return this.mcu[1].r |= 0x100, interrupt(this.mcu[1]);
					}
				};
			} else if (range(page, 0x78, 0x7f)) {
				this.cpu[0].memorymap[page].base = this.ram.base[page & 7];
				this.cpu[0].memorymap[page].write = null;
			} else if (range(page, 0x80, 0x87)) {
				this.cpu[0].memorymap[page].base = this.ram.base[8 | page & 7];
				this.cpu[0].memorymap[page].write = null;
			} else if (range(page, 0x88, 0x8f)) {
				this.cpu[0].memorymap[page].base = this.ram.base[0x10 | page & 7];
				this.cpu[0].memorymap[page].write = null;
			} else if (range(page, 0x90)) {
				this.cpu[0].memorymap[page].read = () => {
					let data = 0xff;
					this.dmactrl1 & 1 && (data &= this.mcu[2].o, this.mcu[2].r |= 0x100, interrupt(this.mcu[2]));
					return data;
				};
				this.cpu[0].memorymap[page].write = (addr, data) => {
					this.dmactrl1 & 1 && (this.mcu[2].r = data & 15, this.mcu[2].k = data >> 4, interrupt(this.mcu[2]));
					this.dmactrl1 & 2 && sound[2].write(data);
				};
			} else if (range(page, 0x91)) {
				this.cpu[0].memorymap[page].read = () => { return this.dmactrl1; };
				this.cpu[0].memorymap[page].write = (addr, data) => {
					this.fNmiEnable1 = 2 << (data >> 5) & ~3;
					switch (this.dmactrl1 = data) {
					case 0x91:
						if (this.mcu[2].mask & 4)
							for (this.mcu[2].execute(); this.mcu[2].pc !== 0x4c; this.mcu[2].execute()) {}
						return this.mcu[2].r |= 0x100, interrupt(this.mcu[2]);
					}
				};
			} else if (range(page, 0x98)) {
				this.cpu[0].memorymap[page].base = this.mmi.base[1];
				this.cpu[0].memorymap[page].write = null;
			}

		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0x1f))
				this.cpu[1].memorymap[page].base = PRG2.base[page & 0x1f];
			else if (range(page, 0x40, 0xff))
				this.cpu[1].memorymap[page] = this.cpu[0].memorymap[page];

		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0xf))
				this.cpu[2].memorymap[page].base = PRG3.base[page & 0xf];
			else if (range(page, 0x40, 0xff))
				this.cpu[2].memorymap[page] = this.cpu[0].memorymap[page];
		this.cpu[2].memorymap[0x68] = {base: this.mmi, read: null, write: (addr, data) => {
			!(addr & 0xe0) && sound[0].write(addr, data);
		}, fetch: null};

		this.mcu[0].rom.set(IO);
		this.mcu[0].r = 0xffff;
		this.mcu[1].rom.set(KEY);
		this.mcu[2].rom.set(KEY);

		// Videoの初期化
		convertGFX(this.bg, BG, 256, rseq(8, 0, 8), seq(4, 64).concat(seq(4)), [0, 4], 16);
		convertGFX(this.obj, OBJ, 64, rseq(8, 256, 8).concat(rseq(8, 0, 8)), seq(4, 64).concat(seq(4, 128), seq(4, 192), seq(4)), [0, 4], 64);
		for (let i = 0; i < 0x20; i++)
			this.rgb[i] = 0xff000000 | (RGB[i] >> 6) * 255 / 3 << 16 | (RGB[i] >> 3 & 7) * 255 / 7 << 8 | (RGB[i] & 7) * 255 / 7;
		for (let i = 0; i < 0x40; i++)
			this.rgb[0x40 | i] = 0xff000000 | (i >> 4) * 255 / 3 << 16 | (i >> 1 & 6) * 255 / 7 << 8 | (i << 1 & 6) * 255 / 7;
		for (let i = 0; i < 1024; i++)
			this.stars.push({x: 0, y: 0, color: 0, blk: 0});
		this.initializeStar();
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			for (let j = 0; j < 3; j++)
				this.cpu[j].execute(tick_rate);
			this.scanline.execute(tick_rate, (vpos) => {
				!(vpos & 0x7f) && this.fInterruptEnable2 && this.cpu[2].non_maskable_interrupt();
				!vpos && (this.moveStars(), update(), this.fInterruptEnable0 && this.cpu[0].interrupt(), this.fInterruptEnable1 && this.cpu[1].interrupt());
			});
			this.timer.execute(tick_rate, () => {
				this.fNmiEnable0 && !--this.fNmiEnable0 && (this.fNmiEnable0 = 2 << (this.dmactrl0 >> 5), this.cpu[0].non_maskable_interrupt());
				this.fNmiEnable1 && !--this.fNmiEnable1 && (this.fNmiEnable1 = 2 << (this.dmactrl1 >> 5), this.cpu[1].non_maskable_interrupt());
			});
			sound[0].execute(tick_rate);
			sound[1].execute(tick_rate);
			audio.execute(tick_rate);
		}
		if (this.mcu[1].mask & 4)
			for (this.mcu[1].execute(); this.mcu[1].pc !== 0x4c; this.mcu[1].execute()) {}
		if (this.mcu[2].mask & 4)
			for (this.mcu[2].execute(); this.mcu[2].pc !== 0x4c; this.mcu[2].execute()) {}
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// DIPスイッチの更新 A:0x01 B:0x02
		if (this.fDIPSwitchChanged) {
			this.fDIPSwitchChanged = false;
			// DIPSW SETUP A:0x01 B:0x02
			switch (this.nMyShip) {
			case 1:
				this.mmi[6] &= ~1, this.mmi[7] &= ~1;
				break;
			case 2:
				this.mmi[6] |= 1, this.mmi[7] &= ~1;
				break;
			case 3:
				this.mmi[6] &= ~1, this.mmi[7] |= 1;
				break;
			case 5:
				this.mmi[6] |= 1, this.mmi[7] |= 1;
				break;
			}
			switch (this.nRank) {
			case 'A':
				this.mmi[0] |= 2, this.mmi[1] |= 2;
				break;
			case 'AUTO':
				this.mmi[0] &= ~2, this.mmi[1] &= ~2;
				break;
			case 'B':
				this.mmi[0] |= 2, this.mmi[1] &= ~2;
				break;
			case 'C':
				this.mmi[0] &= ~2, this.mmi[1] |= 2;
				break;
			}
			switch (this.nBonus) {
			case 'A':
				this.mmi[3] &= ~1, this.mmi[4] |= 1, this.mmi[5] |= 1;
				break;
			case 'B':
				this.mmi[3] |= 1, this.mmi[4] |= 1, this.mmi[5] |= 1;
				break;
			case 'C':
				this.mmi[3] |= 1, this.mmi[4] &= ~1, this.mmi[5] &= ~1;
				break;
			case 'D':
				this.mmi[3] &= ~1, this.mmi[4] |= 1, this.mmi[5] &= ~1;
				break;
			case 'E':
				this.mmi[3] |= 1, this.mmi[4] |= 1, this.mmi[5] &= ~1;
				break;
			case 'F':
				this.mmi[3] &= ~1, this.mmi[4] &= ~1, this.mmi[5] |= 1;
				break;
			case 'G':
				this.mmi[3] |= 1, this.mmi[4] &= ~1, this.mmi[5] |= 1;
				break;
			case 'NONE':
				this.mmi[3] &= ~1, this.mmi[4] &= ~1, this.mmi[5] &= ~1;
				break;
			}
			if (this.fContinue)
				this.mmi[2] |= 2;
			else
				this.mmi[2] &= ~2;
			if (this.fAttract)
				this.mmi[3] &= ~2;
			else
				this.mmi[3] |= 2;
			if (!this.fTest)
				this.fReset = true;
		}

		this.mcu[0].r = this.mcu[0].r & ~0x8000 | !this.fTest << 15;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			sound[1].reset();
			sound[2].reset();
			this.fInterruptEnable0 = this.fInterruptEnable1 = this.fInterruptEnable2 = false;
			this.fNmiEnable0 = this.fNmiEnable1 = 0;
			this.cpu[0].reset();
			this.cpu[1].disable();
			this.cpu[2].disable();
			this.mcu.forEach(mcu => mcu.reset());
			for (; ~this.mcu[0].mask & 4; this.mcu[0].execute()) {}
			for (; ~this.mcu[1].mask & 4; this.mcu[1].execute()) {}
			for (; ~this.mcu[2].mask & 4; this.mcu[2].execute()) {}
			this.mmi[0x140] |= 1;
		}
		return this;
	}

	updateInput() {
		this.mcu[0].r = this.mcu[0].r & ~0x4c0f | this.dwStick | !this.fCoin << 14 | !this.fStart1P << 10 | !this.fStart2P << 11;
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
		this.dwStick = this.dwStick & ~(1 << 0) | fDown << 2 | !fDown << 0;
	}

	right(fDown) {
		this.dwStick = this.dwStick & ~(1 << 1) | fDown << 3 | !fDown << 1;
	}

	down(fDown) {
		this.dwStick = this.dwStick & ~(1 << 2) | fDown << 0 | !fDown << 2;
	}

	left(fDown) {
		this.dwStick = this.dwStick & ~(1 << 3) | fDown << 1 | !fDown << 3;
	}

	triggerA(fDown) {
		this.mcu[0].r = this.mcu[0].r & ~(1 << 8) | !fDown << 8;
	}

	initializeStar() {
		let color;

		for (let sr = 0, i = 0, y = 0; y < 224; y++) {
			for (let x = 0; x < 288; x++) {
				const cy = ~sr << 5 ^ ~sr << 10 ^ ~sr << 12 ^ sr << 15;
				sr = cy & 0x8000 | sr >> 1;
				if ((sr & 0xf429) === 0xf000 && (color = sr << 1 & 0x20 | sr << 2 & 0x18 | sr >> 6 & 0x07)) {
					this.stars[i].x = x;
					this.stars[i].y = y;
					this.stars[i].color = color;
					this.stars[i].blk = sr >> 11 & 1 | sr >> 8 & 2;
					i++;
				}
			}
		}
	}

	moveStars() {
		if (this.mmi[0x140] & 1)
			return;
		for (let i = 0; i < 256 && this.stars[i].color; i++) {
			switch (this.mmi[0x130] & 7) {
			case 0:
				if (--this.stars[i].x < 0) {
					this.stars[i].x += 0x120;
					if (--this.stars[i].y < 0)
						this.stars[i].y += 0xe0;
				}
				break;
			case 1:
				if ((this.stars[i].x -= 2) < 0) {
					this.stars[i].x += 0x120;
					if (--this.stars[i].y < 0)
						this.stars[i].y += 0xe0;
				}
				break;
			case 2:
				if ((this.stars[i].x -= 3) < 0) {
					this.stars[i].x += 0x120;
					if (--this.stars[i].y < 0)
						this.stars[i].y += 0xe0;
				}
				break;
			case 3:
				if ((this.stars[i].x -= 4) < 0) {
					this.stars[i].x -= 0x120;
					if (--this.stars[i].y < 0)
						this.stars[i].y += 0xe0;
				}
				break;
			case 4:
				if ((this.stars[i].x += 3) >= 0x120) {
					this.stars[i].x -= 0x120;
					if (++this.stars[i].y >= 0xe0)
						this.stars[i].y -= 0xe0;
				}
				break;
			case 5:
				if ((this.stars[i].x += 2) >= 0x120) {
					this.stars[i].x -= 0x120;
					if (++this.stars[i].y >= 0xe0)
						this.stars[i].y -= 0xe0;
				}
				break;
			case 6:
				if (++this.stars[i].x >= 0x120) {
					this.stars[i].x -= 0x120;
					if (++this.stars[i].y >= 0xe0)
						this.stars[i].y -= 0xe0;
				}
				break;
			case 7:
				break;
			}
			switch (this.mmi[0x130] >> 3 & 7) {
			case 0:
				break;
			case 1:
				if (--this.stars[i].y < 0)
					this.stars[i].y += 0xe0;
				break;
			case 2:
				if ((this.stars[i].y -= 2) < 0)
					this.stars[i].y += 0xe0;
				break;
			case 3:
				if ((this.stars[i].y -= 3) < 0)
					this.stars[i].y += 0xe0;
				break;
			case 4:
				if ((this.stars[i].y += 4) >= 0xe0)
					this.stars[i].y -= 0xe0;
				break;
			case 5:
				if ((this.stars[i].y += 3) >= 0xe0)
					this.stars[i].y -= 0xe0;
				break;
			case 6:
				if ((this.stars[i].y += 2) >= 0xe0)
					this.stars[i].y -= 0xe0;
				break;
			case 7:
				if (++this.stars[i].y >= 0xe0)
					this.stars[i].y -= 0xe0;
				break;
			}
		}
	}

	makeBitmap(flag) {
		if (!(this.updated = flag))
			return this.bitmap;

		// bg描画
		// スクロール部
		let p = 256 * (8 * 2 + 3) + 232 + (this.mmi[0x120] & 7) - (this.mmi[0x110] & 7) * 256;
		for (let k = 0xc00 + (this.mmi[0x120] + 0x10 << 2 & 0x3e0 | this.mmi[0x110] >> 3), i = 0; i < 29; k = k + 3 & 0x1f | k + 0x20 & 0x3e0 | 0xc00, p -= 256 * 8 * 29 + 8, i++)
			for (let j = 0; j < 29; k = k + 1 & 0x1f | k & 0xfe0, p += 256 * 8, j++)
				this.xfer8x8(this.bitmap, p, k);

		// obj描画 : $83d4 - $83de
		for (let k = 0xbde, i = 6; i !== 0; k -= 2, --i) {
			if (!this.ram[k + 0x800])
				continue;
			const x = -2 + this.ram[k + 0x800] & 0xff;
			const y = this.ram[k + 1] - (this.ram[k + 0x801] << 1 & 0x100) + 16 & 0x1ff;
			const src = this.ram[k] | this.ram[k + 0x801] << 8;
			switch (this.ram[k] & 3) {
			case 0: // ノーマル
				this.xfer16x16(this.bitmap, x | y << 8, src);
				break;
			case 1: // V反転
				this.xfer16x16V(this.bitmap, x | y << 8, src);
				break;
			case 2: // H反転
				this.xfer16x16H(this.bitmap, x | y << 8, src);
				break;
			case 3: // HV反転
				this.xfer16x16HV(this.bitmap, x | y << 8, src);
				break;
			}
		}

		// star描画
		if (~this.mmi[0x140] & 1) {
			let p = 256 * 16 + 16;
			for (let i = 0; i < 256 && this.stars[i].color; i++) {
				const px = this.stars[i].color;
				const x = this.stars[i].x, y = this.stars[i].y;
				const k = this.stars[i].blk;
				switch (this.mmi[0x174] << 1 & 2 | this.mmi[0x175] & 1) {
				case 0:
					if ((k === 0 || k === 2) && this.bitmap[p + (223 - y | x + 3 << 8)] === 0x1f)
						this.bitmap[p + (223 - y | x + 3 << 8)] = 0x40 | px;
					break;
				case 1:
					if ((k === 1 || k === 2) && this.bitmap[p + (223 - y | x + 3 << 8)] === 0x1f)
						this.bitmap[p + (223 - y | x + 3 << 8)] = 0x40 | px;
					break;
				case 2:
					if ((k === 0 || k === 3) && this.bitmap[p + (223 - y | x + 3 << 8)] === 0x1f)
						this.bitmap[p + (223 - y | x + 3 << 8)] = 0x40 | px;
					break;
				case 3:
					if ((k === 1 || k === 3) && this.bitmap[p + (223 - y | x + 3 << 8)] === 0x1f)
						this.bitmap[p + (223 - y | x + 3 << 8)] = 0x40 | px;
					break;
				}
			}
		}

		// bg描画
		// FIX部分
		p = 256 * 8 * 34 + 232;
		for (let k = 0x0840, i = 0; i < 28; k += 24, p -= 8, i++) {
			for (let j = 0; j < 4; k++, p += 256 * 8, j++)
				this.xfer8x8(this.bitmap, p, k);
			p -= 256 * 8 * 8;
			for (let j = 0; j < 4; k++, p += 256 * 8, j++)
				this.xfer8x8(this.bitmap, p, k);
		}

		// レーダー描画
		for (let k = 0xf, i = 12; i !== 0; --k, --i) {
			const x = -1 + this.ram[k + 0x13f0] & 0xff;
			const y = (this.mmi[k + 0x100] & 1 ^ 1) * 0x100 + this.ram[k + 0xbf0] + 16 & 0x1ff;
			this.xfer4x4(this.bitmap, x | y << 8, k);
		}

		// palette変換
		p = 256 * 19 + 16;
		for (let i = 0; i < 285; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				this.bitmap[p] = this.rgb[this.bitmap[p]];

		return this.bitmap;
	}

	xfer4x4(data, p, k) {
		switch (this.mmi[k + 0x100] >> 1 & 7) {
		case 0:
			data[p + 0x002] = data[p + 0x003] = 0x1f;
			data[p + 0x102] = data[p + 0x103] = 0x1f;
			break;
		case 1:
			data[p + 0x002] = data[p + 0x003] = 0x1e;
			data[p + 0x102] = data[p + 0x103] = 0x1e;
			break;
		case 2:
			data[p + 0x002] = data[p + 0x003] = 0x1d;
			data[p + 0x102] = data[p + 0x103] = 0x1d;
			break;
		case 3:
			data[p + 0x001] = data[p + 0x002] = data[p + 0x003] = 0x1d;
			data[p + 0x101] = data[p + 0x102] = data[p + 0x103] = 0x1d;
			data[p + 0x201] = data[p + 0x202] = data[p + 0x203] = 0x1d;
			break;
		case 4:
			data[p + 0x002] = data[p + 0x003] = 0x1e;
			data[p + 0x101] = data[p + 0x102] = data[p + 0x103] = 0x1e;
			data[p + 0x200] = data[p + 0x201] = data[p + 0x202] = 0x1e;
			data[p + 0x300] = data[p + 0x301] = 0x1e;
			break;
		case 5:
			data[p + 0x000] = data[p + 0x001] = 0x1e;
			data[p + 0x100] = data[p + 0x101] = data[p + 0x102] = 0x1e;
			data[p + 0x201] = data[p + 0x202] = data[p + 0x203] = 0x1e;
			data[p + 0x302] = data[p + 0x303] = 0x1e;
			break;
		case 6:
			data[p + 0x100] = data[p + 0x101] = data[p + 0x102] = data[p + 0x103] = 0x1e;
			data[p + 0x200] = data[p + 0x201] = data[p + 0x202] = data[p + 0x203] = 0x1e;
			break;
		case 7:
			data[p + 0x001] = data[p + 0x002] = 0x1e;
			data[p + 0x101] = data[p + 0x102] = 0x1e;
			data[p + 0x201] = data[p + 0x202] = 0x1e;
			data[p + 0x301] = data[p + 0x302] = 0x1e;
			break;
		}
	}

	xfer8x8(data, p, k) {
		const q = this.ram[k] << 6, idx = this.ram[k + 0x800] << 2 & 0xfc;

		switch (this.ram[k + 0x800] >> 6) {
		case 0: // V反転
			data[p + 0x000] = this.bgcolor[idx | this.bg[q | 0x38]];
			data[p + 0x001] = this.bgcolor[idx | this.bg[q | 0x39]];
			data[p + 0x002] = this.bgcolor[idx | this.bg[q | 0x3a]];
			data[p + 0x003] = this.bgcolor[idx | this.bg[q | 0x3b]];
			data[p + 0x004] = this.bgcolor[idx | this.bg[q | 0x3c]];
			data[p + 0x005] = this.bgcolor[idx | this.bg[q | 0x3d]];
			data[p + 0x006] = this.bgcolor[idx | this.bg[q | 0x3e]];
			data[p + 0x007] = this.bgcolor[idx | this.bg[q | 0x3f]];
			data[p + 0x100] = this.bgcolor[idx | this.bg[q | 0x30]];
			data[p + 0x101] = this.bgcolor[idx | this.bg[q | 0x31]];
			data[p + 0x102] = this.bgcolor[idx | this.bg[q | 0x32]];
			data[p + 0x103] = this.bgcolor[idx | this.bg[q | 0x33]];
			data[p + 0x104] = this.bgcolor[idx | this.bg[q | 0x34]];
			data[p + 0x105] = this.bgcolor[idx | this.bg[q | 0x35]];
			data[p + 0x106] = this.bgcolor[idx | this.bg[q | 0x36]];
			data[p + 0x107] = this.bgcolor[idx | this.bg[q | 0x37]];
			data[p + 0x200] = this.bgcolor[idx | this.bg[q | 0x28]];
			data[p + 0x201] = this.bgcolor[idx | this.bg[q | 0x29]];
			data[p + 0x202] = this.bgcolor[idx | this.bg[q | 0x2a]];
			data[p + 0x203] = this.bgcolor[idx | this.bg[q | 0x2b]];
			data[p + 0x204] = this.bgcolor[idx | this.bg[q | 0x2c]];
			data[p + 0x205] = this.bgcolor[idx | this.bg[q | 0x2d]];
			data[p + 0x206] = this.bgcolor[idx | this.bg[q | 0x2e]];
			data[p + 0x207] = this.bgcolor[idx | this.bg[q | 0x2f]];
			data[p + 0x300] = this.bgcolor[idx | this.bg[q | 0x20]];
			data[p + 0x301] = this.bgcolor[idx | this.bg[q | 0x21]];
			data[p + 0x302] = this.bgcolor[idx | this.bg[q | 0x22]];
			data[p + 0x303] = this.bgcolor[idx | this.bg[q | 0x23]];
			data[p + 0x304] = this.bgcolor[idx | this.bg[q | 0x24]];
			data[p + 0x305] = this.bgcolor[idx | this.bg[q | 0x25]];
			data[p + 0x306] = this.bgcolor[idx | this.bg[q | 0x26]];
			data[p + 0x307] = this.bgcolor[idx | this.bg[q | 0x27]];
			data[p + 0x400] = this.bgcolor[idx | this.bg[q | 0x18]];
			data[p + 0x401] = this.bgcolor[idx | this.bg[q | 0x19]];
			data[p + 0x402] = this.bgcolor[idx | this.bg[q | 0x1a]];
			data[p + 0x403] = this.bgcolor[idx | this.bg[q | 0x1b]];
			data[p + 0x404] = this.bgcolor[idx | this.bg[q | 0x1c]];
			data[p + 0x405] = this.bgcolor[idx | this.bg[q | 0x1d]];
			data[p + 0x406] = this.bgcolor[idx | this.bg[q | 0x1e]];
			data[p + 0x407] = this.bgcolor[idx | this.bg[q | 0x1f]];
			data[p + 0x500] = this.bgcolor[idx | this.bg[q | 0x10]];
			data[p + 0x501] = this.bgcolor[idx | this.bg[q | 0x11]];
			data[p + 0x502] = this.bgcolor[idx | this.bg[q | 0x12]];
			data[p + 0x503] = this.bgcolor[idx | this.bg[q | 0x13]];
			data[p + 0x504] = this.bgcolor[idx | this.bg[q | 0x14]];
			data[p + 0x505] = this.bgcolor[idx | this.bg[q | 0x15]];
			data[p + 0x506] = this.bgcolor[idx | this.bg[q | 0x16]];
			data[p + 0x507] = this.bgcolor[idx | this.bg[q | 0x17]];
			data[p + 0x600] = this.bgcolor[idx | this.bg[q | 0x08]];
			data[p + 0x601] = this.bgcolor[idx | this.bg[q | 0x09]];
			data[p + 0x602] = this.bgcolor[idx | this.bg[q | 0x0a]];
			data[p + 0x603] = this.bgcolor[idx | this.bg[q | 0x0b]];
			data[p + 0x604] = this.bgcolor[idx | this.bg[q | 0x0c]];
			data[p + 0x605] = this.bgcolor[idx | this.bg[q | 0x0d]];
			data[p + 0x606] = this.bgcolor[idx | this.bg[q | 0x0e]];
			data[p + 0x607] = this.bgcolor[idx | this.bg[q | 0x0f]];
			data[p + 0x700] = this.bgcolor[idx | this.bg[q | 0x00]];
			data[p + 0x701] = this.bgcolor[idx | this.bg[q | 0x01]];
			data[p + 0x702] = this.bgcolor[idx | this.bg[q | 0x02]];
			data[p + 0x703] = this.bgcolor[idx | this.bg[q | 0x03]];
			data[p + 0x704] = this.bgcolor[idx | this.bg[q | 0x04]];
			data[p + 0x705] = this.bgcolor[idx | this.bg[q | 0x05]];
			data[p + 0x706] = this.bgcolor[idx | this.bg[q | 0x06]];
			data[p + 0x707] = this.bgcolor[idx | this.bg[q | 0x07]];
			break;
		case 1: // ノーマル
			data[p + 0x000] = this.bgcolor[idx | this.bg[q | 0x00]];
			data[p + 0x001] = this.bgcolor[idx | this.bg[q | 0x01]];
			data[p + 0x002] = this.bgcolor[idx | this.bg[q | 0x02]];
			data[p + 0x003] = this.bgcolor[idx | this.bg[q | 0x03]];
			data[p + 0x004] = this.bgcolor[idx | this.bg[q | 0x04]];
			data[p + 0x005] = this.bgcolor[idx | this.bg[q | 0x05]];
			data[p + 0x006] = this.bgcolor[idx | this.bg[q | 0x06]];
			data[p + 0x007] = this.bgcolor[idx | this.bg[q | 0x07]];
			data[p + 0x100] = this.bgcolor[idx | this.bg[q | 0x08]];
			data[p + 0x101] = this.bgcolor[idx | this.bg[q | 0x09]];
			data[p + 0x102] = this.bgcolor[idx | this.bg[q | 0x0a]];
			data[p + 0x103] = this.bgcolor[idx | this.bg[q | 0x0b]];
			data[p + 0x104] = this.bgcolor[idx | this.bg[q | 0x0c]];
			data[p + 0x105] = this.bgcolor[idx | this.bg[q | 0x0d]];
			data[p + 0x106] = this.bgcolor[idx | this.bg[q | 0x0e]];
			data[p + 0x107] = this.bgcolor[idx | this.bg[q | 0x0f]];
			data[p + 0x200] = this.bgcolor[idx | this.bg[q | 0x10]];
			data[p + 0x201] = this.bgcolor[idx | this.bg[q | 0x11]];
			data[p + 0x202] = this.bgcolor[idx | this.bg[q | 0x12]];
			data[p + 0x203] = this.bgcolor[idx | this.bg[q | 0x13]];
			data[p + 0x204] = this.bgcolor[idx | this.bg[q | 0x14]];
			data[p + 0x205] = this.bgcolor[idx | this.bg[q | 0x15]];
			data[p + 0x206] = this.bgcolor[idx | this.bg[q | 0x16]];
			data[p + 0x207] = this.bgcolor[idx | this.bg[q | 0x17]];
			data[p + 0x300] = this.bgcolor[idx | this.bg[q | 0x18]];
			data[p + 0x301] = this.bgcolor[idx | this.bg[q | 0x19]];
			data[p + 0x302] = this.bgcolor[idx | this.bg[q | 0x1a]];
			data[p + 0x303] = this.bgcolor[idx | this.bg[q | 0x1b]];
			data[p + 0x304] = this.bgcolor[idx | this.bg[q | 0x1c]];
			data[p + 0x305] = this.bgcolor[idx | this.bg[q | 0x1d]];
			data[p + 0x306] = this.bgcolor[idx | this.bg[q | 0x1e]];
			data[p + 0x307] = this.bgcolor[idx | this.bg[q | 0x1f]];
			data[p + 0x400] = this.bgcolor[idx | this.bg[q | 0x20]];
			data[p + 0x401] = this.bgcolor[idx | this.bg[q | 0x21]];
			data[p + 0x402] = this.bgcolor[idx | this.bg[q | 0x22]];
			data[p + 0x403] = this.bgcolor[idx | this.bg[q | 0x23]];
			data[p + 0x404] = this.bgcolor[idx | this.bg[q | 0x24]];
			data[p + 0x405] = this.bgcolor[idx | this.bg[q | 0x25]];
			data[p + 0x406] = this.bgcolor[idx | this.bg[q | 0x26]];
			data[p + 0x407] = this.bgcolor[idx | this.bg[q | 0x27]];
			data[p + 0x500] = this.bgcolor[idx | this.bg[q | 0x28]];
			data[p + 0x501] = this.bgcolor[idx | this.bg[q | 0x29]];
			data[p + 0x502] = this.bgcolor[idx | this.bg[q | 0x2a]];
			data[p + 0x503] = this.bgcolor[idx | this.bg[q | 0x2b]];
			data[p + 0x504] = this.bgcolor[idx | this.bg[q | 0x2c]];
			data[p + 0x505] = this.bgcolor[idx | this.bg[q | 0x2d]];
			data[p + 0x506] = this.bgcolor[idx | this.bg[q | 0x2e]];
			data[p + 0x507] = this.bgcolor[idx | this.bg[q | 0x2f]];
			data[p + 0x600] = this.bgcolor[idx | this.bg[q | 0x30]];
			data[p + 0x601] = this.bgcolor[idx | this.bg[q | 0x31]];
			data[p + 0x602] = this.bgcolor[idx | this.bg[q | 0x32]];
			data[p + 0x603] = this.bgcolor[idx | this.bg[q | 0x33]];
			data[p + 0x604] = this.bgcolor[idx | this.bg[q | 0x34]];
			data[p + 0x605] = this.bgcolor[idx | this.bg[q | 0x35]];
			data[p + 0x606] = this.bgcolor[idx | this.bg[q | 0x36]];
			data[p + 0x607] = this.bgcolor[idx | this.bg[q | 0x37]];
			data[p + 0x700] = this.bgcolor[idx | this.bg[q | 0x38]];
			data[p + 0x701] = this.bgcolor[idx | this.bg[q | 0x39]];
			data[p + 0x702] = this.bgcolor[idx | this.bg[q | 0x3a]];
			data[p + 0x703] = this.bgcolor[idx | this.bg[q | 0x3b]];
			data[p + 0x704] = this.bgcolor[idx | this.bg[q | 0x3c]];
			data[p + 0x705] = this.bgcolor[idx | this.bg[q | 0x3d]];
			data[p + 0x706] = this.bgcolor[idx | this.bg[q | 0x3e]];
			data[p + 0x707] = this.bgcolor[idx | this.bg[q | 0x3f]];
			break;
		case 2: // HV反転
			data[p + 0x000] = this.bgcolor[idx | this.bg[q | 0x3f]];
			data[p + 0x001] = this.bgcolor[idx | this.bg[q | 0x3e]];
			data[p + 0x002] = this.bgcolor[idx | this.bg[q | 0x3d]];
			data[p + 0x003] = this.bgcolor[idx | this.bg[q | 0x3c]];
			data[p + 0x004] = this.bgcolor[idx | this.bg[q | 0x3b]];
			data[p + 0x005] = this.bgcolor[idx | this.bg[q | 0x3a]];
			data[p + 0x006] = this.bgcolor[idx | this.bg[q | 0x39]];
			data[p + 0x007] = this.bgcolor[idx | this.bg[q | 0x38]];
			data[p + 0x100] = this.bgcolor[idx | this.bg[q | 0x37]];
			data[p + 0x101] = this.bgcolor[idx | this.bg[q | 0x36]];
			data[p + 0x102] = this.bgcolor[idx | this.bg[q | 0x35]];
			data[p + 0x103] = this.bgcolor[idx | this.bg[q | 0x34]];
			data[p + 0x104] = this.bgcolor[idx | this.bg[q | 0x33]];
			data[p + 0x105] = this.bgcolor[idx | this.bg[q | 0x32]];
			data[p + 0x106] = this.bgcolor[idx | this.bg[q | 0x31]];
			data[p + 0x107] = this.bgcolor[idx | this.bg[q | 0x30]];
			data[p + 0x200] = this.bgcolor[idx | this.bg[q | 0x2f]];
			data[p + 0x201] = this.bgcolor[idx | this.bg[q | 0x2e]];
			data[p + 0x202] = this.bgcolor[idx | this.bg[q | 0x2d]];
			data[p + 0x203] = this.bgcolor[idx | this.bg[q | 0x2c]];
			data[p + 0x204] = this.bgcolor[idx | this.bg[q | 0x2b]];
			data[p + 0x205] = this.bgcolor[idx | this.bg[q | 0x2a]];
			data[p + 0x206] = this.bgcolor[idx | this.bg[q | 0x29]];
			data[p + 0x207] = this.bgcolor[idx | this.bg[q | 0x28]];
			data[p + 0x300] = this.bgcolor[idx | this.bg[q | 0x27]];
			data[p + 0x301] = this.bgcolor[idx | this.bg[q | 0x26]];
			data[p + 0x302] = this.bgcolor[idx | this.bg[q | 0x25]];
			data[p + 0x303] = this.bgcolor[idx | this.bg[q | 0x24]];
			data[p + 0x304] = this.bgcolor[idx | this.bg[q | 0x23]];
			data[p + 0x305] = this.bgcolor[idx | this.bg[q | 0x22]];
			data[p + 0x306] = this.bgcolor[idx | this.bg[q | 0x21]];
			data[p + 0x307] = this.bgcolor[idx | this.bg[q | 0x20]];
			data[p + 0x400] = this.bgcolor[idx | this.bg[q | 0x1f]];
			data[p + 0x401] = this.bgcolor[idx | this.bg[q | 0x1e]];
			data[p + 0x402] = this.bgcolor[idx | this.bg[q | 0x1d]];
			data[p + 0x403] = this.bgcolor[idx | this.bg[q | 0x1c]];
			data[p + 0x404] = this.bgcolor[idx | this.bg[q | 0x1b]];
			data[p + 0x405] = this.bgcolor[idx | this.bg[q | 0x1a]];
			data[p + 0x406] = this.bgcolor[idx | this.bg[q | 0x19]];
			data[p + 0x407] = this.bgcolor[idx | this.bg[q | 0x18]];
			data[p + 0x500] = this.bgcolor[idx | this.bg[q | 0x17]];
			data[p + 0x501] = this.bgcolor[idx | this.bg[q | 0x16]];
			data[p + 0x502] = this.bgcolor[idx | this.bg[q | 0x15]];
			data[p + 0x503] = this.bgcolor[idx | this.bg[q | 0x14]];
			data[p + 0x504] = this.bgcolor[idx | this.bg[q | 0x13]];
			data[p + 0x505] = this.bgcolor[idx | this.bg[q | 0x12]];
			data[p + 0x506] = this.bgcolor[idx | this.bg[q | 0x11]];
			data[p + 0x507] = this.bgcolor[idx | this.bg[q | 0x10]];
			data[p + 0x600] = this.bgcolor[idx | this.bg[q | 0x0f]];
			data[p + 0x601] = this.bgcolor[idx | this.bg[q | 0x0e]];
			data[p + 0x602] = this.bgcolor[idx | this.bg[q | 0x0d]];
			data[p + 0x603] = this.bgcolor[idx | this.bg[q | 0x0c]];
			data[p + 0x604] = this.bgcolor[idx | this.bg[q | 0x0b]];
			data[p + 0x605] = this.bgcolor[idx | this.bg[q | 0x0a]];
			data[p + 0x606] = this.bgcolor[idx | this.bg[q | 0x09]];
			data[p + 0x607] = this.bgcolor[idx | this.bg[q | 0x08]];
			data[p + 0x700] = this.bgcolor[idx | this.bg[q | 0x07]];
			data[p + 0x701] = this.bgcolor[idx | this.bg[q | 0x06]];
			data[p + 0x702] = this.bgcolor[idx | this.bg[q | 0x05]];
			data[p + 0x703] = this.bgcolor[idx | this.bg[q | 0x04]];
			data[p + 0x704] = this.bgcolor[idx | this.bg[q | 0x03]];
			data[p + 0x705] = this.bgcolor[idx | this.bg[q | 0x02]];
			data[p + 0x706] = this.bgcolor[idx | this.bg[q | 0x01]];
			data[p + 0x707] = this.bgcolor[idx | this.bg[q | 0x00]];
			break;
		case 3: // H反転
			data[p + 0x000] = this.bgcolor[idx | this.bg[q | 0x07]];
			data[p + 0x001] = this.bgcolor[idx | this.bg[q | 0x06]];
			data[p + 0x002] = this.bgcolor[idx | this.bg[q | 0x05]];
			data[p + 0x003] = this.bgcolor[idx | this.bg[q | 0x04]];
			data[p + 0x004] = this.bgcolor[idx | this.bg[q | 0x03]];
			data[p + 0x005] = this.bgcolor[idx | this.bg[q | 0x02]];
			data[p + 0x006] = this.bgcolor[idx | this.bg[q | 0x01]];
			data[p + 0x007] = this.bgcolor[idx | this.bg[q | 0x00]];
			data[p + 0x100] = this.bgcolor[idx | this.bg[q | 0x0f]];
			data[p + 0x101] = this.bgcolor[idx | this.bg[q | 0x0e]];
			data[p + 0x102] = this.bgcolor[idx | this.bg[q | 0x0d]];
			data[p + 0x103] = this.bgcolor[idx | this.bg[q | 0x0c]];
			data[p + 0x104] = this.bgcolor[idx | this.bg[q | 0x0b]];
			data[p + 0x105] = this.bgcolor[idx | this.bg[q | 0x0a]];
			data[p + 0x106] = this.bgcolor[idx | this.bg[q | 0x09]];
			data[p + 0x107] = this.bgcolor[idx | this.bg[q | 0x08]];
			data[p + 0x200] = this.bgcolor[idx | this.bg[q | 0x17]];
			data[p + 0x201] = this.bgcolor[idx | this.bg[q | 0x16]];
			data[p + 0x202] = this.bgcolor[idx | this.bg[q | 0x15]];
			data[p + 0x203] = this.bgcolor[idx | this.bg[q | 0x14]];
			data[p + 0x204] = this.bgcolor[idx | this.bg[q | 0x13]];
			data[p + 0x205] = this.bgcolor[idx | this.bg[q | 0x12]];
			data[p + 0x206] = this.bgcolor[idx | this.bg[q | 0x11]];
			data[p + 0x207] = this.bgcolor[idx | this.bg[q | 0x10]];
			data[p + 0x300] = this.bgcolor[idx | this.bg[q | 0x1f]];
			data[p + 0x301] = this.bgcolor[idx | this.bg[q | 0x1e]];
			data[p + 0x302] = this.bgcolor[idx | this.bg[q | 0x1d]];
			data[p + 0x303] = this.bgcolor[idx | this.bg[q | 0x1c]];
			data[p + 0x304] = this.bgcolor[idx | this.bg[q | 0x1b]];
			data[p + 0x305] = this.bgcolor[idx | this.bg[q | 0x1a]];
			data[p + 0x306] = this.bgcolor[idx | this.bg[q | 0x19]];
			data[p + 0x307] = this.bgcolor[idx | this.bg[q | 0x18]];
			data[p + 0x400] = this.bgcolor[idx | this.bg[q | 0x27]];
			data[p + 0x401] = this.bgcolor[idx | this.bg[q | 0x26]];
			data[p + 0x402] = this.bgcolor[idx | this.bg[q | 0x25]];
			data[p + 0x403] = this.bgcolor[idx | this.bg[q | 0x24]];
			data[p + 0x404] = this.bgcolor[idx | this.bg[q | 0x23]];
			data[p + 0x405] = this.bgcolor[idx | this.bg[q | 0x22]];
			data[p + 0x406] = this.bgcolor[idx | this.bg[q | 0x21]];
			data[p + 0x407] = this.bgcolor[idx | this.bg[q | 0x20]];
			data[p + 0x500] = this.bgcolor[idx | this.bg[q | 0x2f]];
			data[p + 0x501] = this.bgcolor[idx | this.bg[q | 0x2e]];
			data[p + 0x502] = this.bgcolor[idx | this.bg[q | 0x2d]];
			data[p + 0x503] = this.bgcolor[idx | this.bg[q | 0x2c]];
			data[p + 0x504] = this.bgcolor[idx | this.bg[q | 0x2b]];
			data[p + 0x505] = this.bgcolor[idx | this.bg[q | 0x2a]];
			data[p + 0x506] = this.bgcolor[idx | this.bg[q | 0x29]];
			data[p + 0x507] = this.bgcolor[idx | this.bg[q | 0x28]];
			data[p + 0x600] = this.bgcolor[idx | this.bg[q | 0x37]];
			data[p + 0x601] = this.bgcolor[idx | this.bg[q | 0x36]];
			data[p + 0x602] = this.bgcolor[idx | this.bg[q | 0x35]];
			data[p + 0x603] = this.bgcolor[idx | this.bg[q | 0x34]];
			data[p + 0x604] = this.bgcolor[idx | this.bg[q | 0x33]];
			data[p + 0x605] = this.bgcolor[idx | this.bg[q | 0x32]];
			data[p + 0x606] = this.bgcolor[idx | this.bg[q | 0x31]];
			data[p + 0x607] = this.bgcolor[idx | this.bg[q | 0x30]];
			data[p + 0x700] = this.bgcolor[idx | this.bg[q | 0x3f]];
			data[p + 0x701] = this.bgcolor[idx | this.bg[q | 0x3e]];
			data[p + 0x702] = this.bgcolor[idx | this.bg[q | 0x3d]];
			data[p + 0x703] = this.bgcolor[idx | this.bg[q | 0x3c]];
			data[p + 0x704] = this.bgcolor[idx | this.bg[q | 0x3b]];
			data[p + 0x705] = this.bgcolor[idx | this.bg[q | 0x3a]];
			data[p + 0x706] = this.bgcolor[idx | this.bg[q | 0x39]];
			data[p + 0x707] = this.bgcolor[idx | this.bg[q | 0x38]];
			break;
		}
	}

	xfer16x16(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || dst < 4 * 0x100 || dst >= 304 * 0x100)
			return;
		src = src << 6 & 0x3f00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = BGCOLOR[idx | this.obj[src++]]) !== 0xf)
					data[dst] = px;
	}

	xfer16x16V(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || dst < 4 * 0x100 || dst >= 304 * 0x100)
			return;
		src = (src << 6 & 0x3f00) + 256 - 16;
		for (let i = 16; i !== 0; src -= 32, dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = BGCOLOR[idx | this.obj[src++]]) !== 0xf)
					data[dst] = px;
	}

	xfer16x16H(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || dst < 4 * 0x100 || dst >= 304 * 0x100)
			return;
		src = (src << 6 & 0x3f00) + 16;
		for (let i = 16; i !== 0; src += 32, dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = BGCOLOR[idx | this.obj[--src]]) !== 0xf)
					data[dst] = px;
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || dst < 4 * 0x100 || dst >= 304 * 0x100)
			return;
		src = (src << 6 & 0x3f00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = BGCOLOR[idx | this.obj[--src]]) !== 0xf)
					data[dst] = px;
	}
}

/*
 *
 *	Bosconian
 *
 */

import {ROM} from "./dist/bosconian.png.js";
let PRG1, PRG2, PRG3, RGB, SND, BGCOLOR, BG, OBJ, VOI, KEY, IO, PRG;

window.addEventListener('load', () => expand(ROM).then(ROM => {
	PRG1 = new Uint8Array(ROM.buffer, 0x0, 0x4000).addBase();
	PRG2 = new Uint8Array(ROM.buffer, 0x4000, 0x2000).addBase();
	PRG3 = new Uint8Array(ROM.buffer, 0x6000, 0x1000).addBase();
	BG = new Uint8Array(ROM.buffer, 0x7000, 0x1000);
	OBJ = new Uint8Array(ROM.buffer, 0x8000, 0x1000);
	RGB = new Uint8Array(ROM.buffer, 0x9000, 0x20);
	BGCOLOR = new Uint8Array(ROM.buffer, 0x9020, 0x100);
	SND = new Uint8Array(ROM.buffer, 0x9120, 0x100);
	VOI = new Uint8Array(ROM.buffer, 0x9220, 0x3000);
	KEY = new Uint8Array(ROM.buffer, 0xc220, 0x800);
	IO = new Uint8Array(ROM.buffer, 0xca20, 0x400);
	PRG = new Uint8Array(ROM.buffer, 0xce20, 0x400);
	game = new Bosconian();
	sound = [
		new PacManSound({SND}),
		new Namco54XX({PRG, clock: Math.floor(18432000 / 12)}),
		new Namco52XX({VOI, clock: Math.floor(18432000 / 12)}),
	];
	canvas.addEventListener('click', () => game.coin(true));
	init({game, sound});
}));

