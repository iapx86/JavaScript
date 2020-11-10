/*
 *
 *	Bosconian
 *
 */

import PacManSound from './pac-man_sound.js';
import Namco54XX from './namco_54xx.js';
import SoundEffect from './sound_effect.js';
import Cpu, {dummypage, init, read} from './main.js';
import Z80 from './z80.js';
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
	fCoin = false;
	fStart1P = false;
	fStart2P = false;
	dwCredit = 0;
	dwStick = 0;
	dwScore = 0;
	dwScore1 = 0;
	dwScore2 = 0;
	dwHiScore = 0;
	dwNext1up = 0;
	dwNext1up1 = 0;
	dwNext1up2 = 0;
	dw1up1 = 0;
	dw1up2 = 0;

	nMyShip = 3;
	nBonus = 'F';
	nRank = 'AUTO';
	fContinue = true;
	fAttract = true;

	fInterruptEnable0 = false;
	fInterruptEnable1 = false;
	fSoundEnable = false;
	fKeyDisable = false;
	fNmiEnable0 = false;
	fNmiEnable1 = false;

	ram = new Uint8Array(0x1800).fill(0xff).addBase();
	mmi = new Uint8Array(0x200).fill(0xff).addBase();
	mmo = new Uint8Array(0x100);
	count = 0;
	starport = new Uint8Array(0x100);
	keyport = new Uint8Array(0x100);
	scoreport = new Uint8Array(0x100);
	ioport = new Uint8Array(0x100);
	dmaport0 = new Uint8Array(0x100);
	dmaport1 = new Uint8Array(0x100);
	keytbl = Uint8Array.of(8, 0, 2, 1, 4, 8, 3, 8, 6, 7, 8, 8, 5, 8, 8, 8);

	stars = [];
	bg = new Uint8Array(0x4000);
	obj = new Uint8Array(0x4000);
	bgcolor = Uint8Array.from(BGCOLOR, e => e & 0xf | 0x10);
	objcolor = Uint8Array.from(BGCOLOR, e => e & 0xf);
	rgb = new Uint32Array(0x80);

	se;

	cpu = [new Z80(), new Z80(), new Z80()];

	constructor() {
		// CPU周りの初期化
		this.ioport[0] = 0x80;
		this.ioport[1] = 0x3f;
		this.ioport[2] = 0x3f;

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

		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0x3f))
				this.cpu[0].memorymap[page].base = PRG1.base[page & 0x3f];
			else if (range(page, 0x68)) {
				this.cpu[0].memorymap[page].base = this.mmi.base[0];
				this.cpu[0].memorymap[page].write = (addr, data) => {
					switch (addr & 0xf0) {
					case 0x00:
					case 0x10:
						break;
					case 0x20:
						switch (addr & 0x0f) {
						case 0:
							this.fInterruptEnable0 = (data & 1) !== 0;
							break;
						case 1:
							this.fInterruptEnable1 = (data & 1) !== 0;
							break;
						case 2:
							if (data)
								this.fSoundEnable = true;
							else {
								this.fSoundEnable = false;
								this.se.forEach(se => se.stop = true);
							}
							break;
						case 3:
							if ((data & 1) !== 0)
								this.cpu[1].enable(), this.cpu[2].enable();
							else
								this.cpu[1].disable(), this.cpu[2].disable();
							break;
						}
						// fallthrough
					default:
						this.mmo[addr & 0xff] = data;
						break;
					}
				};
			} else if (range(page, 0x70)) {
				this.cpu[0].memorymap[page].base = this.ioport;
				this.cpu[0].memorymap[page].write = (addr, data) => void((this.dmaport0[0] & 8) !== 0 && sound[1].write(data));
			} else if (range(page, 0x71)) {
				this.cpu[0].memorymap[page].base = this.dmaport0;
				this.cpu[0].memorymap[page].write = (addr, data) => {
					this.dmaport0[addr & 0xff] = data;
					switch (data) {
					case 0x10:
						this.fNmiEnable0 = false;
						return;
					case 0x08:
					case 0x18:
					case 0x20:
					case 0x28:
					case 0x30:
					case 0x38:
					case 0x40:
					case 0x50:
					case 0x58:
					case 0x60:
					case 0x68:
					case 0x70:
					case 0x78:
					case 0x80:
						// 7000h -> 8be0h
						this.cpu[0].memorymap[0x70].base = this.ioport;
						break;
					case 0x48:
						this.cpu[0].memorymap[0x70].base = this.ioport;
						break;
					case 0x61:
						this.cpu[0].memorymap[0x70].base = dummypage;
						break;
					case 0x64:
						this.cpu[0].memorymap[0x70].base = dummypage;
						switch (this.cpu[0].read(this.cpu[0].l_prime | this.cpu[0].h_prime << 8)) {
						case 0x60: // 1P Score
							this.dwScore2 = this.dwScore;
							this.dwScore = this.dwScore1;
							this.dwNext1up2 = this.dwNext1up;
							this.dwNext1up = this.dwNext1up1;
							break;
						case 0x68: // 2P Score
							this.dwScore1 = this.dwScore;
							this.dwScore = this.dwScore2;
							this.dwNext1up1 = this.dwNext1up;
							this.dwNext1up = this.dwNext1up2;
							break;
						case 0x81:
							this.dwScore += 10;
							break;
						case 0x83:
							this.dwScore += 20;
							break;
						case 0x87:
							this.dwScore += 50;
							break;
						case 0x88:
							this.dwScore += 60;
							break;
						case 0x89:
							this.dwScore += 70;
							break;
						case 0x8d:
							this.dwScore += 200;
							break;
						case 0x93:
							this.dwScore += 200;
							break;
						case 0x95:
							this.dwScore += 300;
							break;
						case 0x96:
							this.dwScore += 400;
							break;
						case 0x97:
							this.dwScore += 500;
							break;
						case 0x98:
							this.dwScore += 600;
							break;
						case 0x99:
							this.dwScore += 700;
							break;
						case 0x9a:
							this.dwScore += 800;
							break;
						case 0xa0:
							this.dwScore += 500;
							break;
						case 0xa1:
							this.dwScore += 1000;
							break;
						case 0xa2:
							this.dwScore += 1500;
							break;
						case 0xa3:
							this.dwScore += 2000;
							break;
						case 0xa5:
							this.dwScore += 3000;
							break;
						case 0xa6:
							this.dwScore += 4000;
							break;
						case 0xa7:
							this.dwScore += 5000;
							break;
						case 0xa8:
							this.dwScore += 6000;
							break;
						case 0xa9:
							this.dwScore += 7000;
							break;
						case 0xb7:
							this.dwScore += 100;
							break;
						case 0xb8:
							this.dwScore += 120;
							break;
						case 0xb9:
							this.dwScore += 140;
							break;
						}
						break;
					case 0x71:
						this.cpu[0].memorymap[0x70].base = this.ioport;
						break;
					case 0x84:
						this.cpu[0].memorymap[0x70].base = dummypage;
						const scorepage = this.cpu[0].memorymap[this.cpu[0].h_prime].base.subarray(this.cpu[0].l_prime);
						if (scorepage[0] === 0x10) {
							// L+4 が $00-$ff を超えないことを前提としてます
							switch (scorepage[1] & 0xf0) {
							case 0x20:
								// 最初の 1up score
								this.dw1up1 = (scorepage[1] & 0x0f) * 1000000 +
									(scorepage[2] >> 4) * 100000 + (scorepage[2] & 0x0f) * 10000 +
									(scorepage[3] >> 4) * 1000 + (scorepage[3] & 0x0f) * 100 +
									(scorepage[4] >> 4) * 10 + (scorepage[4] & 0x0f);
								break;
							case 0x30:
								// 2回目以降の 1up score
								this.dw1up2 = (scorepage[1] & 0x0f) * 1000000 +
									(scorepage[2] >> 4) * 100000 + (scorepage[2] & 0x0f) * 10000 +
									(scorepage[3] >> 4) * 1000 + (scorepage[3] & 0x0f) * 100 +
									(scorepage[4] >> 4) * 10 + (scorepage[4] & 0x0f);
								break;
							case 0x50:
								this.dwHiScore = (scorepage[1] & 0x0f) * 1000000 +
									(scorepage[2] >> 4) * 100000 + (scorepage[2] & 0x0f) * 10000 +
									(scorepage[3] >> 4) * 1000 + (scorepage[3] & 0x0f) * 100 +
									(scorepage[4] >> 4) * 10 + (scorepage[4] & 0x0f);
								break;
							case 0x60:
								this.dwScore = 0;
								this.dwScore1 = 0;
								this.dwScore2 = 0;
								this.dwNext1up = this.dw1up1;	// Current Player's Next 1up Score
								this.dwNext1up1 = this.dw1up1;	// 1PLAYER's Next 1up Score
								this.dwNext1up2 = this.dw1up1;	// 2PLAYER's Next 1up Score
								break;
							}
						}
						break;
					case 0x91:
						this.cpu[0].memorymap[0x70].base = this.keyport;
						break;
					case 0x94:
						this.cpu[0].memorymap[0x70].base = this.scoreport;
						this.scoreport[0] = this.dwScore / 10000000 % 10 << 4 | this.dwScore / 1000000 % 10;
						this.scoreport[1] = this.dwScore / 100000 % 10 << 4 | this.dwScore / 10000 % 10;
						this.scoreport[2] = this.dwScore / 1000 % 10 << 4 | this.dwScore / 100 % 10;
						this.scoreport[3] = this.dwScore / 10 % 10 << 4 | this.dwScore % 10;
						if (this.dwScore >= this.dwHiScore) {
							this.dwHiScore = this.dwScore;
							this.scoreport[0] |= 0x80;
						}
						if (this.dwScore >= this.dwNext1up) {
							this.scoreport[0] |= 0x40;		// 1up flag
							if (this.dwNext1up === this.dw1up1)
								this.dwNext1up = this.dw1up2;
							else {
								this.scoreport[0] |= 0x20;	// 2回目以降の 1up flag
								this.dwNext1up += this.dw1up2;
							}
						}
						break;
					case 0xa1:
						this.cpu[0].memorymap[0x70].base = dummypage;
						this.fKeyDisable = false;
						break;
					case 0xc1:
						this.cpu[0].memorymap[0x70].base = dummypage;
						break;
					case 0xc8:
						this.cpu[0].memorymap[0x70].base = dummypage;
						this.fKeyDisable = true;
						break;
					default:
						this.cpu[0].memorymap[0x70].base = dummypage;
						break;
					}
					this.fNmiEnable0 = true;
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
				this.cpu[0].memorymap[page].base = this.starport;
				this.cpu[0].memorymap[page].write = (addr, data) => void((this.dmaport1[0] & 2) !== 0 && data !== 0 && (this.se[data - 1].start = this.se[data - 1].stop = true));
			} else if (range(page, 0x91)) {
				this.cpu[0].memorymap[page].base = this.dmaport1;
				this.cpu[0].memorymap[page].write = (addr, data) => {
					this.dmaport1[addr & 0xff] = data;
					switch (data) {
					case 0x10:
						this.fNmiEnable1 = false;
						return;
					case 0x81:
						this.cpu[1].memorymap[0x90].base = dummypage;
						break;
					case 0x91:
						this.cpu[1].memorymap[0x90].base = this.starport;
						this.starport[3] = this.starport[1] = this.starport[0] = 0;
						this.starport[2] = this.ram[0x11cc];
						break;
					case 0xa1:
						this.cpu[1].memorymap[0x90].base = dummypage;
						break;
					default:
						this.cpu[1].memorymap[0x90].base = dummypage;
						break;
					}
					this.fNmiEnable1 = true;
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
		this.cpu[2].memorymap[0x68] = {base: this.mmi.base[0], read: null, write: (addr, data) => {
			switch (addr & 0xf0) {
			case 0x00:
			case 0x10:
				sound[0].write(addr, data, this.count);
				break;
			case 0x20:
				break;
			default:
				this.mmo[addr & 0xff] = data;
				break;
			}
		}, fetch: null};

		// Videoの初期化
		for (let i = 0; i < 1024; i++)
			this.stars.push({x: 0, y: 0, color: 0, blk: 0});
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();
		this.initializeStar();

		// 効果音の初期化
		const buf = new Int16Array(VOI.length * 2);
		for (let i = 0; i < VOI.length; i++)
			buf[i * 2] = VOI[i] - 8 << 12, buf[i * 2 + 1] = (VOI[i] >> 4) - 8 << 12;
		const voi = [];
		for (let i = 0; i < 5; i++) {
			const start = VOI[i] | VOI[0x10 + i] << 8, end = VOI[1 + i] | VOI[0x11 + i] << 8;
			voi.push(buf.subarray(start * 2, end * 2));
		}
		this.se = voi.map(buf => ({buf: buf, loop: false, start: false, stop: false}));
	}

	execute() {
		sound[0].mute(!this.fSoundEnable);
		if (this.fInterruptEnable0)
			this.cpu[0].interrupt();
		if (this.fInterruptEnable1)
			this.cpu[1].interrupt();
		this.count = 0;
		this.cpu[2].non_maskable_interrupt();			// SOUND INTERRUPT
		for (let i = 0; i < 64; i++) {
			if (this.fNmiEnable0)
				this.cpu[0].non_maskable_interrupt();	// DMA INTERRUPT
			if (this.fNmiEnable1)
				this.cpu[1].non_maskable_interrupt();	// DMA INTERRUPT
			Cpu.multiple_execute(this.cpu, 32);
			if (this.fNmiEnable1)
				this.cpu[1].non_maskable_interrupt();	// DMA INTERRUPT
			Cpu.multiple_execute(this.cpu, 32);
		}
		this.count = 1;
		this.cpu[2].non_maskable_interrupt();			// SOUND INTERRUPT
		for (let i = 0; i < 64; i++) {
			if (this.fNmiEnable0)
				this.cpu[0].non_maskable_interrupt();	// DMA INTERRUPT
			if (this.fNmiEnable1)
				this.cpu[1].non_maskable_interrupt();	// DMA INTERRUPT
			Cpu.multiple_execute(this.cpu, 32);
			if (this.fNmiEnable1)
				this.cpu[1].non_maskable_interrupt();	// DMA INTERRUPT
			Cpu.multiple_execute(this.cpu, 32);
		}
		this.moveStars();
		return this;
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

		if (!this.fTest)
			this.ioport[0] |= 0x80;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.fSoundEnable = false;
			sound[1].reset();
			this.dwCredit = 0;
			this.scoreport.fill(0);
			this.fInterruptEnable0 = this.fInterruptEnable1 = false;
			this.fNmiEnable0 = this.fNmiEnable1 = false;
			this.cpu[0].reset();
			this.cpu[1].disable();
			this.cpu[2].disable();
			this.mmi[0x140] |= 1;
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		let i = (this.dwCredit >> 4 & 0x0f) * 10 + (this.dwCredit & 0x0f);
		if (this.fCoin && ++i > 99)
			i = 99;
		else if (this.fStart1P && i > 0)
			--i;
		else if (this.fStart2P && i > 1)
			i -= 2;
		this.dwCredit = i / 10 << 4 | i % 10;
		this.fCoin = this.fStart1P = this.fStart2P = false;

		this.ioport[0x10] = this.ioport[0x10] & 0xf0 | this.dwStick & 0x0f;

		if (this.fTest) {
			this.ioport[0] = 0x7f;
			this.ioport[1] = ~this.ioport[0x10];
			this.ioport[2] = ~this.ioport[0x11];
		} else if (!this.fKeyDisable) {
			this.ioport[0] = this.dwCredit;

			this.ioport[1] = this.keytbl[this.ioport[0x10] & 0x0f] | 0x30;
			this.mmi[0] |= 1;

			if ((this.ioport[0x10] & 0x10) !== 0) {
				this.ioport[1] &= 0xdf;
				if ((this.ioport[0x11] & 0x10) === 0)
					this.ioport[1] &= 0xef;
			}
			if ((this.ioport[0x10] & 0x20) !== 0)
				this.mmi[0] &= 0xfe;

			this.ioport[0x11] = this.ioport[0x10];
		} else {
			this.ioport[0] = 0x80;
			this.ioport[1] = 0x3f;
			this.ioport[2] = 0x3f;
		}
		return this;
	}

	coin() {
		this.fCoin = true;
	}

	start1P() {
		this.fStart1P = true;
	}

	start2P() {
		this.fStart2P = true;
	}

	up(fDown) {
		if (fDown)
			this.dwStick = this.dwStick & ~(1 << 2) | 1 << 0;
		else
			this.dwStick &= ~(1 << 0);
	}

	right(fDown) {
		if (fDown)
			this.dwStick = this.dwStick & ~(1 << 3) | 1 << 1;
		else
			this.dwStick &= ~(1 << 1);
	}

	down(fDown) {
		if (fDown)
			this.dwStick = this.dwStick & ~(1 << 0) | 1 << 2;
		else
			this.dwStick &= ~(1 << 2);
	}

	left(fDown) {
		if (fDown)
			this.dwStick = this.dwStick & ~(1 << 1) | 1 << 3;
		else
			this.dwStick &= ~(1 << 3);
	}

	triggerA(fDown) {
		if (fDown)
			this.ioport[0x10] |= 1 << 4;
		else
			this.ioport[0x10] &= ~(1 << 4);
	}

	triggerB(fDown) {
	}

	convertRGB() {
		for (let i = 0; i < 0x20; i++)
			this.rgb[i] = (RGB[i] & 7) * 255 / 7	// Red
				| (RGB[i] >> 3 & 7) * 255 / 7 << 8	// Green
				| (RGB[i] >> 6) * 255 / 3 << 16		// Blue
				| 0xff000000;						// Alpha
		for (let i = 0; i < 0x40; i++)
			this.rgb[0x40 | i] = (i << 1 & 6) * 255 / 7	// Red
				| (i >> 1 & 6) * 255 / 7 << 8			// Green
				| (i >> 4) * 255 / 3 << 16				// Blue
				| 0xff000000;							// Alpha
	}

	convertBG() {
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

	initializeStar() {
		let color;

		for (let sr = 0, i = 0, y = 0; y < 224; y++) {
			for (let x = 0; x < 288; x++) {
				const cy = ~sr << 5 ^ ~sr << 10 ^ ~sr << 12 ^ sr << 15;
				sr = cy & 0x8000 | sr >> 1;
				if ((sr & 0xf429) === 0xf000 && (color = sr << 1 & 0x20 | sr << 2 & 0x18 | sr >> 6 & 0x07) !== 0) {
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
		if ((this.mmi[0x140] & 1) !== 0)
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

	makeBitmap(data) {
		// bg描画
		// スクロール部
		let p = 256 * (8 * 2 + 3) + 232 + (this.mmi[0x120] & 7) - (this.mmi[0x110] & 7) * 256;
		let k = 0xc00 + (this.mmi[0x120] + 0x10 << 2 & 0x3e0 | this.mmi[0x110] >> 3);
		for (let i = 0; i < 29; k = k + 3 & 0x1f | k + 0x20 & 0x3e0 | 0xc00, p -= 256 * 8 * 29 + 8, i++)
			for (let j = 0; j < 29; k = k + 1 & 0x1f | k & 0xfe0, p += 256 * 8, j++)
				this.xfer8x8(data, p, k);

		// obj描画 : $83d4 - $83de
		for (let k = 0xbde, i = 6; i !== 0; k -= 2, --i) {
			if (!this.ram[k + 0x800])
				continue;
			const x = -2 + this.ram[k + 0x800] & 0xff;
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

		// star描画
		if ((this.mmi[0x140] & 1) === 0) {
			let p = 256 * 16 + 16;
			for (let i = 0; i < 256 && this.stars[i].color; i++) {
				const px = this.stars[i].color;
				const x = this.stars[i].x, y = this.stars[i].y;
				const k = this.stars[i].blk;
				switch (this.mmi[0x174] << 1 & 2 | this.mmi[0x175] & 1) {
				case 0:
					if ((k === 0 || k === 2) && data[p + (223 - y | x + 3 << 8)] === 0x1f)
						data[p + (223 - y | x + 3 << 8)] = 0x40 | px;
					break;
				case 1:
					if ((k === 1 || k === 2) && data[p + (223 - y | x + 3 << 8)] === 0x1f)
						data[p + (223 - y | x + 3 << 8)] = 0x40 | px;
					break;
				case 2:
					if ((k === 0 || k === 3) && data[p + (223 - y | x + 3 << 8)] === 0x1f)
						data[p + (223 - y | x + 3 << 8)] = 0x40 | px;
					break;
				case 3:
					if ((k === 1 || k === 3) && data[p + (223 - y | x + 3 << 8)] === 0x1f)
						data[p + (223 - y | x + 3 << 8)] = 0x40 | px;
					break;
				}
			}
		}

		// bg描画
		// FIX部分
		p = 256 * 8 * 34 + 232;
		k = 0x0840;
		for (let i = 0; i < 28; k += 24, p -= 8, i++) {
			for (let j = 0; j < 4; k++, p += 256 * 8, j++)
				this.xfer8x8(data, p, k);
			p -= 256 * 8 * 8;
			for (let j = 0; j < 4; k++, p += 256 * 8, j++)
				this.xfer8x8(data, p, k);
		}

		// レーダー描画
		for (let k = 0xf, i = 12; i !== 0; --k, --i) {
			const x = -1 + this.ram[k + 0x13f0] & 0xff;
			const y = (this.mmi[k + 0x100] & 1 ^ 1) * 0x100 + this.ram[k + 0xbf0] + 16 & 0x1ff;
			this.xfer4x4(data, x | y << 8, k);
		}

		// palette変換
		p = 256 * 19 + 16;
		for (let i = 0; i < 285; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] = this.rgb[data[p]];
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

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) < 4 * 0x100 || dst >= 304 * 0x100)
			return;
		src = src << 6 & 0x3f00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx | this.obj[src++]]) !== 0xf)
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
				if ((px = this.objcolor[idx | this.obj[src++]]) !== 0xf)
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
				if ((px = this.objcolor[idx | this.obj[--src]]) !== 0xf)
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
				if ((px = this.objcolor[idx | this.obj[--src]]) !== 0xf)
					data[dst] = px;
	}
}

/*
 *
 *	Bosconian
 *
 */

let PRG1, PRG2, PRG3, RGB, SND, BGCOLOR, BG, OBJ, VOI, PRG;

read('bosco.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG1 = Uint8Array.concat(...['bos3_1.3n', 'bos1_2.3m', 'bos1_3.3l', 'bos1_4b.3k'].map(e => zip.decompress(e))).addBase();
	PRG2 = Uint8Array.concat(...['bos1_5c.3j', 'bos3_6.3h'].map(e => zip.decompress(e))).addBase();
	PRG3 = zip.decompress('bos1_7.3e').addBase();
	BG = zip.decompress('bos1_14.5d');
	OBJ = zip.decompress('bos1_13.5e');
	RGB = zip.decompress('bos1-6.6b');
	BGCOLOR = zip.decompress('bos1-5.4m');
	SND = zip.decompress('bos1-1.1d');
	VOI = Uint8Array.concat(...['bos1_9.5n', 'bos1_10.5m', 'bos1_11.5k'].map(e => zip.decompress(e)));
}).then(() =>read('namco54.zip')).then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG = zip.decompress('54xx.bin');
	game = new Bosconian();
	sound = [
		new PacManSound({SND, resolution: 2}),
		new Namco54XX({PRG, clock: 1536000}),
		new SoundEffect({se: game.se, freq: 4000, gain: 0.25}),
	];
	canvas.addEventListener('click', () => game.coin());
	init({game, sound});
});

