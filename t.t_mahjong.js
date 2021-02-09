/*
 *
 *	T.T Mahjong
 *
 */

import AY_3_8910 from './ay-3-8910.js';
import {init, read} from './main.js';
import Z80 from './z80.js';
let game, sound;

class TTMahjong {
	cxScreen = 240;
	cyScreen = 256;
	width = 256;
	height = 256;
	xOffset = 0;
	yOffset = 0;
	rotate = true;

	fReset = false;
	fTest = false;
	fDIPSwitchChanged = true;
	fCoin = 0;
	fStart1P = 0;
	fStart2P = 0;
	nSpeed = 0;

	ram = new Uint8Array(0x400).addBase();
	vram1 = new Uint8Array(0x4000);
	vram2 = new Uint8Array(0x4000);
	in = new Uint8Array(9);
	select = 0;
	psg = {addr: 0};

	rgb = Uint32Array.of(0xff000000, 0xffff0000, 0xff00ff00, 0xffffff00, 0xff0000ff, 0xffff00ff, 0xff00ffff, 0xffffffff);
	palette1 = 0;
	palette2 = 0;

	cpu = [new Z80(Math.floor(10000000 / 4)), new Z80(Math.floor(10000000 / 4))];

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x40; i++)
			this.cpu[0].memorymap[i].base = PRG1.base[i];
		for (let i = 0; i < 4; i++) {
			this.cpu[0].memorymap[0x40 + i].base = this.ram.base[i];
			this.cpu[0].memorymap[0x40 + i].write = null;
		}
		this.cpu[0].memorymap[0x48].read = () => { return this.in[8]; };
		this.cpu[0].memorymap[0x48].write = (addr, data) => { this.palette1 = data << 2 & 0x7c; };
		this.cpu[0].memorymap[0x50].read = () => { return this.select >= 0 ? this.in[4 + this.select] : 0; };
		this.cpu[0].memorymap[0x50].write = (addr, data) => { this.palette2 = data << 2 & 0x7c; };
		this.cpu[0].memorymap[0x58].read = () => { return this.select >= 0 ? this.in[this.select] : 0; };
		this.cpu[0].memorymap[0x58].write = (addr, data) => { this.select = [1, 2, 4, 8].indexOf(data); };
		this.cpu[0].memorymap[0x68].write = (addr, data) => { sound.write(this.psg.addr, data); };
		this.cpu[0].memorymap[0x69].write = (addr, data) => { this.psg.addr = data; };
		for (let i = 0; i < 0x40; i++)
			this.cpu[0].memorymap[0x80 + i].write = (addr, data) => { this.vram1[addr & 0x3fff] = data; };

		for (let i = 0; i < 0x18; i++)
			this.cpu[1].memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 4; i++) {
			this.cpu[1].memorymap[0x40 + i].base = this.ram.base[i];
			this.cpu[1].memorymap[0x40 + i].write = null;
		}
		for (let i = 0; i < 0x40; i++)
			this.cpu[1].memorymap[0x80 + i].write = (addr, data) => { this.vram2[addr & 0x3fff] = data; };
	}

	execute(audio, rate_correction) {
		const tick_rate = 384000, tick_max = Math.floor(tick_rate / 60);
		this.cpu[0].interrupt();
		for (let i = 0; i < tick_max; i++) {
			this.cpu[0].execute(tick_rate);
			this.cpu[1].execute(tick_rate);
			sound.execute(tick_rate, rate_correction);
			audio.execute(tick_rate, rate_correction);
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
		this.in[7] = this.in[7] & ~(1 << 7) | !!this.fCoin << 7;
		this.in[0] = this.in[0] & ~(1 << 5) | !!this.fStart1P << 5;
		this.in[1] = this.in[1] & ~(1 << 5) | !!this.fStart2P << 5;
		this.fCoin -= !!this.fCoin, this.fStart1P -= !!this.fStart1P, this.fStart2P -= !!this.fStart2P;
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
			for (let j = 256 >> 2; j !== 0; k++, p -= 4 * 256, --j) {
				const p1 = this.vram1[k], p2 = this.vram2[k];
				data[p] = this.rgb[(COLOR1[p1 >> 3 & 1 | p1 >> 6 & 2 | this.palette1] | COLOR2[p2 >> 3 & 1 | p2 >> 6 & 2 | this.palette2 | p1 << 4 & 0x80 | p1 & 0x80]) & 7];
				data[p + 256] = this.rgb[(COLOR1[p1 >> 2 & 1 | p1 >> 5 & 2 | this.palette1] | COLOR2[p2 >> 2 & 1 | p2 >> 5 & 2 | this.palette2 | p1 << 5 & 0x80 | p1 << 1 & 0x80]) & 7];
				data[p + 2 * 256] = this.rgb[(COLOR1[p1 >> 1 & 1 | p1 >> 4 & 2 | this.palette1] | COLOR2[p2 >> 1 & 1 | p2 >> 4 & 2 | this.palette2 | p1 << 6 & 0x80 | p1 << 2 & 0x80]) & 7];
				data[p + 3 * 256] = this.rgb[(COLOR1[p1 & 1 | p1 >> 3 & 2 | this.palette1] | COLOR2[p2 & 1 | p2 >> 3 & 2 | this.palette2 | p1 << 7 & 0x80 | p1 << 3 & 0x80]) & 7];
			}
	}
}

const keydown = e => {
	if (e.repeat)
		return;
	switch (e.code) {
	case 'Digit0':
		return void game.coin();
	case 'Digit1':
		return void game.start1P();
	case 'Digit2':
		return void game.start2P();
	case 'Digit5': // KAN
		return void(game.in[0] |= 1 << 4);
	case 'Digit6': // PON
		return void(game.in[3] |= 1 << 3);
	case 'Digit7': // CHI
		return void(game.in[2] |= 1 << 3);
	case 'Digit8': // REACH
		return void(game.in[1] |= 1 << 4);
	case 'Digit9': // RON
		return void(game.in[2] |= 1 << 4);
	case 'KeyA':
		return void(game.in[0] |= 1 << 0);
	case 'KeyB':
		return void(game.in[1] |= 1 << 0);
	case 'KeyC':
		return void(game.in[2] |= 1 << 0);
	case 'KeyD':
		return void(game.in[3] |= 1 << 0);
	case 'KeyE':
		return void(game.in[0] |= 1 << 1);
	case 'KeyF':
		return void(game.in[1] |= 1 << 1);
	case 'KeyG':
		return void(game.in[2] |= 1 << 1);
	case 'KeyH':
		return void(game.in[3] |= 1 << 1);
	case 'KeyI':
		return void(game.in[0] |= 1 << 2);
	case 'KeyJ':
		return void(game.in[1] |= 1 << 2);
	case 'KeyK':
		return void(game.in[2] |= 1 << 2);
	case 'KeyL':
		return void(game.in[3] |= 1 << 2);
	case 'KeyM':
		return void(game.in[0] |= 1 << 3);
	case 'KeyN':
		return void(game.in[1] |= 1 << 3);
	case 'KeyR':
		return void game.reset();
	case 'KeyV': // MUTE
		if (audioCtx.state === 'suspended')
			audioCtx.resume().catch();
		else if (audioCtx.state === 'running')
			audioCtx.suspend().catch();
		return;
	}
};

const keyup = e => {
	switch (e.code) {
	case 'Digit5': // KAN
		return void(game.in[0] &= ~(1 << 4));
	case 'Digit6': // PON
		return void(game.in[3] &= ~(1 << 3));
	case 'Digit7': // CHI
		return void(game.in[2] &= ~(1 << 3));
	case 'Digit8': // REACH
		return void(game.in[1] &= ~(1 << 4));
	case 'Digit9': // RON
		return void(game.in[2] &= ~(1 << 4));
	case 'KeyA':
		return void(game.in[0] &= ~(1 << 0));
	case 'KeyB':
		return void(game.in[1] &= ~(1 << 0));
	case 'KeyC':
		return void(game.in[2] &= ~(1 << 0));
	case 'KeyD':
		return void(game.in[3] &= ~(1 << 0));
	case 'KeyE':
		return void(game.in[0] &= ~(1 << 1));
	case 'KeyF':
		return void(game.in[1] &= ~(1 << 1));
	case 'KeyG':
		return void(game.in[2] &= ~(1 << 1));
	case 'KeyH':
		return void(game.in[3] &= ~(1 << 1));
	case 'KeyI':
		return void(game.in[0] &= ~(1 << 2));
	case 'KeyJ':
		return void(game.in[1] &= ~(1 << 2));
	case 'KeyK':
		return void(game.in[2] &= ~(1 << 2));
	case 'KeyL':
		return void(game.in[3] &= ~(1 << 2));
	case 'KeyM':
		return void(game.in[0] &= ~(1 << 3));
	case 'KeyN':
		return void(game.in[1] &= ~(1 << 3));
	}
};

/*
 *
 *	T.T Mahjong
 *
 */

let PRG1, PRG2, COLOR1, COLOR2;

read('ttmahjng.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG1 = Uint8Array.concat(...['ju04', 'ju05', 'ju06', 'ju07'].map(e => zip.decompress(e))).addBase();
	PRG2 = Uint8Array.concat(...['ju01', 'ju02', 'ju08'].map(e => zip.decompress(e))).addBase();
	COLOR1 = zip.decompress('ju03');
	COLOR2 = zip.decompress('ju09');
	game = new TTMahjong();
	sound = new AY_3_8910({clock: 10000000 / 8, gain: 0.2});
	canvas.addEventListener('click', () => game.coin());
	init({game, sound, keydown, keyup});
});

