/*
 *
 *	T.T Mahjong
 *
 */

import AY_3_8910 from './ay-3-8910.js';
import Cpu, {init, loop} from './main.js';
import Z80 from './z80.js';
let game, sound;

class TTMahjong {
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
		this.nSpeed = 0;

		// CPU周りの初期化
		this.ram = new Uint8Array(0x400).addBase();
		this.vram1 = new Uint8Array(0x4000);
		this.vram2 = new Uint8Array(0x4000);
		this.in = new Uint8Array(9);
		this.select = 0;
		this.psg = {addr: 0};

		this.cpu = [new Z80(this), new Z80(this)];

		for (let i = 0; i < 0x40; i++)
			this.cpu[0].memorymap[i].base = PRG1.base[i];
		for (let i = 0; i < 4; i++) {
			this.cpu[0].memorymap[0x40 + i].base = this.ram.base[i];
			this.cpu[0].memorymap[0x40 + i].write = null;
		}
		this.cpu[0].memorymap[0x48].read = () => this.in[8];
		this.cpu[0].memorymap[0x48].write = (addr, data) => this.palette1 = data << 2 & 0x7c;
		this.cpu[0].memorymap[0x50].read = () => this.select >= 0 ? this.in[4 + this.select] : 0;
		this.cpu[0].memorymap[0x50].write = (addr, data) => this.palette2 = data << 2 & 0x7c;
		this.cpu[0].memorymap[0x58].read = () => this.select >= 0 ? this.in[this.select] : 0;
		this.cpu[0].memorymap[0x58].write = (addr, data) => this.select = [1, 2, 4, 8].indexOf(data);
		this.cpu[0].memorymap[0x68].write = (addr, data) => sound.write(this.psg.addr, data);
		this.cpu[0].memorymap[0x69].write = (addr, data) => this.psg.addr = data;
		for (let i = 0; i < 0x40; i++)
			this.cpu[0].memorymap[0x80 + i].write = (addr, data) => this.vram1[addr & 0x3fff] = data;

		for (let i = 0; i < 0x18; i++)
			this.cpu[1].memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 4; i++) {
			this.cpu[1].memorymap[0x40 + i].base = this.ram.base[i];
			this.cpu[1].memorymap[0x40 + i].write = null;
		}
		for (let i = 0; i < 0x40; i++)
			this.cpu[1].memorymap[0x80 + i].write = (addr, data) => this.vram2[addr & 0x3fff] = data;

		// Videoの初期化
		this.rgb = Uint32Array.of(0xff000000, 0xffff0000, 0xff00ff00, 0xffffff00, 0xff0000ff, 0xffff00ff, 0xff00ffff, 0xffffffff);
		this.palette1 = 0;
		this.palette2 = 0;
	}

	execute() {
		this.cpu[0].interrupt();
		Cpu.multiple_execute(this.cpu, 0x1c00);
		return this;
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// DIPスイッチの更新
		if (this.fDIPSwitchChanged) {
			this.fDIPSwitchChanged = false;
			switch (this.nSpeed) {
			case 0:
				this.in[8] |= 0xc;
				break;
			case 1:
				this.in[8] = this.in[8] & ~0xc | 8;
				break;
			case 2:
				this.in[8] = this.in[8] & ~0xc | 4;
				break;
			case 3:
				this.in[8] &= ~0xc;
				break;
			}
			this.fReset = true;
		}

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu[0].reset();
			this.cpu[1].reset();
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if (this.fCoin) {
			--this.fCoin;
			this.in[7] |= 1 << 7;
		}
		else
			this.in[7] &= ~(1 << 7);
		if (this.fStart1P) {
			--this.fStart1P;
			this.in[0] |= 1 << 5;
		}
		else
			this.in[0] &= ~(1 << 5);
		if (this.fStart2P) {
			--this.fStart2P;
			this.in[1] |= 1 << 5;
		}
		else
			this.in[1] &= ~(1 << 5);
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

	makeBitmap(data) {
		for (let p = 252 * 256, k = 0x200, i = 240; i !== 0; p += 256 * 256 + 1, --i)
			for (let j = 256 >>> 2; j !== 0; k++, p -= 4 * 256, --j) {
				const p1 = this.vram1[k], p2 = this.vram2[k];
				data[p] = this.rgb[(COLOR1[p1 >>> 3 & 1 | p1 >>> 6 & 2 | this.palette1] | COLOR2[p2 >>> 3 & 1 | p2 >>> 6 & 2 | this.palette2 | p1 << 4 & 0x80 | p1 & 0x80]) & 7];
				data[p + 256] = this.rgb[(COLOR1[p1 >>> 2 & 1 | p1 >>> 5 & 2 | this.palette1] | COLOR2[p2 >>> 2 & 1 | p2 >>> 5 & 2 | this.palette2 | p1 << 5 & 0x80 | p1 << 1 & 0x80]) & 7];
				data[p + 2 * 256] = this.rgb[(COLOR1[p1 >>> 1 & 1 | p1 >>> 4 & 2 | this.palette1] | COLOR2[p2 >>> 1 & 1 | p2 >>> 4 & 2 | this.palette2 | p1 << 6 & 0x80 | p1 << 2 & 0x80]) & 7];
				data[p + 3 * 256] = this.rgb[(COLOR1[p1 & 1 | p1 >>> 3 & 2 | this.palette1] | COLOR2[p2 & 1 | p2 >>> 3 & 2 | this.palette2 | p1 << 7 & 0x80 | p1 << 3 & 0x80]) & 7];
			}
	}
}

const keydown = e => {
	switch (e.keyCode) {
	case 48: // '0' COIN
		game.coin();
		break;
	case 49: // '1'
		game.start1P();
		break;
	case 50: // '2'
		game.start2P();
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
	case 82: // 'R' RESET
		game.reset();
		break;
	case 86: // 'V' MUTE
		if (!audioCtx)
			break;
		if (audioCtx.state === 'suspended')
			audioCtx.resume().catch();
		else if (audioCtx.state === 'running')
			audioCtx.suspend().catch();
		break;
	}
};

const keyup = e => {
	switch (e.keyCode) {
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
	}
};

/*
 *
 *	T.T Mahjong
 *
 */

const url = 'ttmahjng.zip';
let PRG1, PRG2, COLOR1, COLOR2;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG1 = new Uint8Array((zip.files['ju04'].inflate() + zip.files['ju05'].inflate() + zip.files['ju06'].inflate() + zip.files['ju07'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	PRG2 = new Uint8Array((zip.files['ju01'].inflate() + zip.files['ju02'].inflate() + zip.files['ju08'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	COLOR1 = new Uint8Array(zip.files['ju03'].inflate().split('').map(c => c.charCodeAt(0)));
	COLOR2 = new Uint8Array(zip.files['ju09'].inflate().split('').map(c => c.charCodeAt(0)));
	init({
		game: game = new TTMahjong(),
		sound: sound = new AY_3_8910({clock: 1250000, gain: 0.2}),
		rotate: true,
		keydown, keyup,
	});
	loop();
}

