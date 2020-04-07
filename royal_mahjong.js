/*
 *
 *	Royal Mahjong
 *
 */

import AY_3_8910 from './ay-3-8910.js';
import {init, loop} from './main.js';
import Z80 from './z80.js';
let game, sound;

class RoyalMahjong {
	constructor() {
		this.cxScreen = 240;
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
		this.nPayOutRate = '96%';
		this.nMaximumBet = '20';

		// CPU周りの初期化
		this.ram = new Uint8Array(0x1000).addBase();
		this.vram = new Uint8Array(0x8000);
		this.in = Uint8Array.of(0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0, 0x3f);
		this.psg = {addr: 0};

		this.cpu = new Z80(this);
		for (let i = 0; i < 0x60; i++)
			this.cpu.memorymap[i].base = PRG.base[i];
		for (let i = 0; i < 0x10; i++) {
			this.cpu.memorymap[0x70 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x70 + i].write = null;
		}
		for (let i = 0; i < 0x80; i++)
			this.cpu.memorymap[0x80 + i].write = (addr, data) => this.vram[addr & 0x7fff] = data;
		for (let i = 0; i < 0x100; i++) {
			this.cpu.iomap[i].read = addr => {
				switch (addr & 0xff) {
				case 0x01:
					return sound.read(this.psg.addr);
				case 0x10:
					return this.in[11];
				case 0x11:
					return this.in[10];
				}
				return 0xff;
			};
			this.cpu.iomap[i].write = (addr, data) => {
				switch (addr & 0xff) {
				case 0x02:
					this.psg.addr < 0xe && sound.write(this.psg.addr, data);
					break;
				case 0x03:
					this.psg.addr = data;
					break;
				case 0x10:
					this.palette = data << 1 & 0x10;
					break;
				case 0x11:
					const select = data;
					data = this.in[0] | 0x3f;
					for (let i = 0; i < 5; i++)
						if ((select & 1 << i) === 0)
							data &= this.in[i];
					sound.write(0xe, data);
					data = this.in[5] | 0x3f;
					for (let i = 0; i < 5; i++)
						if ((select & 1 << i) === 0)
							data &= this.in[5 + i];
					sound.write(0xf, data);
					break;
				}
			};
		}

		// Videoの初期化
		this.rgb = new Uint32Array(0x20);
		this.palette = 0;
		this.convertRGB();
	}

	execute() {
		this.cpu.interrupt();
		this.cpu.execute(0x2000);
		return this;
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// DIPスイッチの更新
		if (this.fDIPSwitchChanged) {
			this.fDIPSwitchChanged = false;
			switch (this.nPayOutRate) {
			case '96%':
				this.in[11] |= 0xf;
				break;
			case '93%':
				this.in[11] = this.in[11] & ~0xf | 0xe;
				break;
			case '90%':
				this.in[11] = this.in[11] & ~0xf | 0xd;
				break;
			case '87%':
				this.in[11] = this.in[11] & ~0xf | 0xc;
				break;
			case '84%':
				this.in[11] = this.in[11] & ~0xf | 0xb;
				break;
			case '81%':
				this.in[11] = this.in[11] & ~0xf | 0xa;
				break;
			case '78%':
				this.in[11] = this.in[11] & ~0xf | 9;
				break;
			case '75%':
				this.in[11] = this.in[11] & ~0xf | 8;
				break;
			case '71%':
				this.in[11] = this.in[11] & ~0xf | 7;
				break;
			case '68%':
				this.in[11] = this.in[11] & ~0xf | 6;
				break;
			case '65%':
				this.in[11] = this.in[11] & ~0xf | 5;
				break;
			case '62%':
				this.in[11] = this.in[11] & ~0xf | 4;
				break;
			case '59%':
				this.in[11] = this.in[11] & ~0xf | 3;
				break;
			case '56%':
				this.in[11] = this.in[11] & ~0xf | 2;
				break;
			case '53%':
				this.in[11] = this.in[11] & ~0xf | 1;
				break;
			case '50%':
				this.in[11] &= ~0xf;
				break;
			}
			switch (this.nMaximumBet) {
			case '1':
				this.in[11] &= ~0x30;
				break;
			case '5':
				this.in[11] = this.in[11] & ~0x30 | 0x10;
				break;
			case '10':
				this.in[11] = this.in[11] & ~0x30 | 0x20;
				break;
			case '20':
				this.in[11] |= 0x30;
				break;
			}
			this.fReset = true;
		}

		if (this.fTest)
			this.in[10] |= 8;
		else
			this.in[10] &= ~8;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu.reset();
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if (this.fCoin) {
			--this.fCoin;
			this.in[5] &= ~(1 << 6);
		}
		else
			this.in[5] |= 1 << 6;
		if (this.fStart1P) {
			--this.fStart1P;
			this.in[0] &= ~(1 << 5);
		}
		else
			this.in[0] |= 1 << 5;
		if (this.fStart2P) {
			--this.fStart2P;
			this.in[5] &= ~(1 << 5);
		}
		else
			this.in[5] |= 1 << 5;
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

	convertRGB() {
		for (let i = 0; i < 0x20; i++)
			this.rgb[i] = (RGB[i] & 7) * 255 / 7	// Red
				| (RGB[i] >> 3 & 7) * 255 / 7 << 8	// Green
				| (RGB[i] >> 6) * 255 / 3 << 16		// Blue
				| 0xff000000;						// Alpha
	}

	makeBitmap(data) {
		for (let p = 252 * 256, k = 0x200, i = 240; i !== 0; p += 256 * 256 + 1, --i)
			for (let j = 256 >> 2; j !== 0; k++, p -= 4 * 256, --j) {
				const p0 = this.vram[k], p1 = this.vram[0x4000 + k];
				data[p] = this.rgb[p0 >> 3 & 1 | p0 >> 6 & 2 | p1 >> 1 & 4 | p1 >> 4 & 8 | this.palette];
				data[p + 256] = this.rgb[p0 >> 2 & 1 | p0 >> 5 & 2 | p1 & 4 | p1 >> 3 & 8 | this.palette];
				data[p + 2 * 256] = this.rgb[p0 >> 1 & 1 | p0 >> 4 & 2 | p1 << 1 & 4 | p1 >> 2 & 8 | this.palette];
				data[p + 3 * 256] = this.rgb[p0 & 1 | p0 >> 3 & 2 | p1 << 2 & 4 | p1 >> 1 & 8 | this.palette];
			}
	}
}

const keydown = e => {
	switch (e.keyCode) {
	case 48: // '0' COIN
		game.coin();
		break;
	case 49: // '1' 1P START
		game.start1P();
		break;
	case 50: // '2' 2P START
		game.start2P();
		break;
	case 51: // '3' BET
		game.in[1] &= ~(1 << 5);
		break;
	case 53: // '5' KAN
		game.in[0] &= ~(1 << 4);
		break;
	case 54: // '6' PON
		game.in[3] &= ~(1 << 3);
		break;
	case 55: // '7' CHI
		game.in[2] &= ~(1 << 3);
		break;
	case 56: // '8' REACH
		game.in[1] &= ~(1 << 4);
		break;
	case 57: // '9' RON
		game.in[2] &= ~(1 << 4);
		break;
	case 65: // 'A'
		game.in[0] &= ~(1 << 0);
		break;
	case 66: // 'B'
		game.in[1] &= ~(1 << 0);
		break;
	case 67: // 'C'
		game.in[2] &= ~(1 << 0);
		break;
	case 68: // 'D'
		game.in[3] &= ~(1 << 0);
		break;
	case 69: // 'E'
		game.in[0] &= ~(1 << 1);
		break;
	case 70: // 'F'
		game.in[1] &= ~(1 << 1);
		break;
	case 71: // 'G'
		game.in[2] &= ~(1 << 1);
		break;
	case 72: // 'H'
		game.in[3] &= ~(1 << 1);
		break;
	case 73: // 'I'
		game.in[0] &= ~(1 << 2);
		break;
	case 74: // 'J'
		game.in[1] &= ~(1 << 2);
		break;
	case 75: // 'K'
		game.in[2] &= ~(1 << 2);
		break;
	case 76: // 'L'
		game.in[3] &= ~(1 << 2);
		break;
	case 77: // 'M'
		game.in[0] &= ~(1 << 3);
		break;
	case 78: // 'N'
		game.in[1] &= ~(1 << 3);
		break;
	case 82: // 'R' RESET
		game.reset();
		break;
	case 83: // 'S' SERVICE
		game.in[10] ^= 1 << 2;
		break;
	case 86: // 'V' MUTE
		if (!audioCtx)
			break;
		if (audioCtx.state === 'suspended')
			audioCtx.resume().catch();
		else if (audioCtx.state === 'running')
			audioCtx.suspend().catch();
		break;
	case 118: // F7 FLIP FLOP
		game.in[4] &= ~(1 << 3);
		break;
	case 119: // F8 TAKE SCORE
		game.in[4] &= ~(1 << 1);
		break;
	case 120: // F9 DOUBLE UP
		game.in[4] &= ~(1 << 2);
		break;
	case 121: // F10 BIG
		game.in[4] &= ~(1 << 4);
		break;
	case 122: // F11 SMALL
		game.in[4] &= ~(1 << 5);
		break;
	case 123: // F12 LAST CHANCE
		game.in[4] &= ~(1 << 0);
		break;
	}
};

const keyup = e => {
	switch (e.keyCode) {
	case 51: // '3' BET
		game.in[1] |= 1 << 5;
		break;
	case 53: // '5' KAN
		game.in[0] |= 1 << 4;
		break;
	case 54: // '6' PON
		game.in[3] |= 1 << 3;
		break;
	case 55: // '7' CHI
		game.in[2] |= 1 << 3;
		break;
	case 56: // '8' REACH
		game.in[1] |= 1 << 4;
		break;
	case 57: // '9' RON
		game.in[2] |= 1 << 4;
		break;
	case 65: // 'A'
		game.in[0] |= 1 << 0;
		break;
	case 66: // 'B'
		game.in[1] |= 1 << 0;
		break;
	case 67: // 'C'
		game.in[2] |= 1 << 0;
		break;
	case 68: // 'D'
		game.in[3] |= 1 << 0;
		break;
	case 69: // 'E'
		game.in[0] |= 1 << 1;
		break;
	case 70: // 'F'
		game.in[1] |= 1 << 1;
		break;
	case 71: // 'G'
		game.in[2] |= 1 << 1;
		break;
	case 72: // 'H'
		game.in[3] |= 1 << 1;
		break;
	case 73: // 'I'
		game.in[0] |= 1 << 2;
		break;
	case 74: // 'J'
		game.in[1] |= 1 << 2;
		break;
	case 75: // 'K'
		game.in[2] |= 1 << 2;
		break;
	case 76: // 'L'
		game.in[3] |= 1 << 2;
		break;
	case 77: // 'M'
		game.in[0] |= 1 << 3;
		break;
	case 78: // 'N'
		game.in[1] |= 1 << 3;
		break;
	case 118: // F7 FLIP FLOP
		game.in[4] |= 1 << 3;
		break;
	case 119: // F8 TAKE SCORE
		game.in[4] |= 1 << 1;
		break;
	case 120: // F9 DOUBLE UP
		game.in[4] |= 1 << 2;
		break;
	case 121: // F10 BIG
		game.in[4] |= 1 << 4;
		break;
	case 122: // F11 SMALL
		game.in[4] |= 1 << 5;
		break;
	case 123: // F12 LAST CHANCE
		game.in[4] |= 1 << 0;
		break;
	}
};

/*
 *
 *	Royal Mahjong
 *
 */

const url = 'royalmj.zip';
let PRG, RGB;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG = zip.files['1.p1'].inflate() + zip.files['2.p2'].inflate() + zip.files['3.p3'].inflate() + zip.files['4.p4'].inflate();
	PRG = new Uint8Array((PRG + zip.files['5.p5'].inflate() + zip.files['6.p6'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	RGB = new Uint8Array(zip.files['18s030n.6k'].inflate().split('').map(c => c.charCodeAt(0)));
	init({
		game: game = new RoyalMahjong(),
		sound: sound = new AY_3_8910({clock: 1536000, gain: 0.2}),
		rotate: true,
		keydown, keyup
	});
	loop();
}

