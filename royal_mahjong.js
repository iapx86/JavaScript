/*
 *
 *	Royal Mahjong
 *
 */

import AY_3_8910 from './ay-3-8910.js';
import {Timer} from './utils.js';
import {init, read} from './main.js';
import Z80 from './z80.js';
let game, sound;

class RoyalMahjong {
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
	nPayOutRate = '96%';
	nMaximumBet = '20';

	ram = new Uint8Array(0x1000).addBase();
	vram = new Uint8Array(0x8000);
	in = Uint8Array.of(0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0, 0x3f);
	psg = {addr: 0};

	rgb = Int32Array.from(RGB, e => 0xff000000 | (e >> 6) * 255 / 3 << 16 | (e >> 3 & 7) * 255 / 7 << 8 | (e & 7) * 255 / 7);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;
	palette = 0;

	cpu = new Z80(Math.floor(18432000 / 6));
	timer = new Timer(60);

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x60; i++)
			this.cpu.memorymap[i].base = PRG.base[i];
		for (let i = 0; i < 0x10; i++) {
			this.cpu.memorymap[0x70 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x70 + i].write = null;
		}
		for (let i = 0; i < 0x80; i++)
			this.cpu.memorymap[0x80 + i].write = (addr, data) => { this.vram[addr & 0x7fff] = data; };
		for (let i = 0; i < 0x100; i++) {
			this.cpu.iomap[i].read = (addr) => {
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
					return void(this.psg.addr < 0xe && sound.write(this.psg.addr, data));
				case 0x03:
					return void(this.psg.addr = data);
				case 0x10:
					return void(this.palette = data << 1 & 0x10);
				case 0x11:
					const select = data;
					data = this.in[0] | 0x3f;
					for (let i = 0; i < 5; i++)
						if (~select & 1 << i)
							data &= this.in[i];
					sound.write(0xe, data);
					data = this.in[5] | 0x3f;
					for (let i = 0; i < 5; i++)
						if (~select & 1 << i)
							data &= this.in[5 + i];
					return sound.write(0xf, data);
				}
			};
		}
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.timer.execute(tick_rate, () => { update(), this.cpu.interrupt(); });
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
		this.in[5] = this.in[5] & ~0x60 | !this.fCoin << 6 | !this.fStart2P << 5;
		this.in[0] = this.in[0] & ~(1 << 5) | !this.fStart1P << 5;
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

	makeBitmap(flag) {
		if (!(this.updated = flag))
			return this.bitmap;

		for (let p = 252 * 256, k = 0x200, i = 240; i !== 0; p += 256 * 256 + 1, --i)
			for (let j = 256 >> 2; j !== 0; k++, p -= 4 * 256, --j) {
				const p0 = this.vram[k], p1 = this.vram[0x4000 + k];
				this.bitmap[p] = this.rgb[p0 >> 3 & 1 | p0 >> 6 & 2 | p1 >> 1 & 4 | p1 >> 4 & 8 | this.palette];
				this.bitmap[p + 256] = this.rgb[p0 >> 2 & 1 | p0 >> 5 & 2 | p1 & 4 | p1 >> 3 & 8 | this.palette];
				this.bitmap[p + 2 * 256] = this.rgb[p0 >> 1 & 1 | p0 >> 4 & 2 | p1 << 1 & 4 | p1 >> 2 & 8 | this.palette];
				this.bitmap[p + 3 * 256] = this.rgb[p0 & 1 | p0 >> 3 & 2 | p1 << 2 & 4 | p1 >> 1 & 8 | this.palette];
			}

		return this.bitmap;
	}
}

const keydown = e => {
	if (e.repeat)
		return;
	switch (e.code) {
	case 'Digit0':
		return void game.coin(true);
	case 'Digit1':
		return void game.start1P(true);
	case 'Digit2':
		return void game.start2P(true);
	case 'Digit3': // BET
		return void(game.in[1] &= ~(1 << 5));
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
	case 'KeyR':
		return game.reset();
	case 'KeyS': // SERVICE
		return void(game.in[10] ^= 1 << 2);
	case 'KeyT':
		if ((game.fTest = !game.fTest) === true)
			game.fReset = true;
		return;
	case 'KeyV': // MUTE
		return audioCtx.state === 'suspended' ? audioCtx.resume().catch() : audioCtx.state === 'running' && audioCtx.suspend().catch();
	case 'F7': // FLIP FLOP
		return void(game.in[4] &= ~(1 << 3));
	case 'F8': // TAKE SCORE
		return void(game.in[4] &= ~(1 << 1));
	case 'F9': // DOUBLE UP
		return void(game.in[4] &= ~(1 << 2));
	case 'F10': // BIG
		return void(game.in[4] &= ~(1 << 4));
	case 'F11': // SMALL
		return void(game.in[4] &= ~(1 << 5));
	case 'F12': // LAST CHANCE
		return void(game.in[4] &= ~(1 << 0));
	}
};

const keyup = e => {
	switch (e.code) {
	case 'Digit3': // BET
		return void(game.in[1] |= 1 << 5);
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
	case 'F7': // FLIP FLOP
		return void(game.in[4] |= 1 << 3);
	case 'F8': // TAKE SCORE
		return void(game.in[4] |= 1 << 1);
	case 'F9': // DOUBLE UP
		return void(game.in[4] |= 1 << 2);
	case 'F10': // BIG
		return void(game.in[4] |= 1 << 4);
	case 'F11': // SMALL
		return void(game.in[4] |= 1 << 5);
	case 'F12': // LAST CHANCE
		return void(game.in[4] |= 1 << 0);
	}
};

/*
 *
 *	Royal Mahjong
 *
 */

let PRG, RGB;

read('royalmj.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG = Uint8Array.concat(...['1.p1', '2.p2', '3.p3', '4.p4', '5.p5', '6.p6'].map(e => zip.decompress(e))).addBase();
	RGB = zip.decompress('18s030n.6k');
	game = new RoyalMahjong();
	sound = new AY_3_8910({clock: Math.floor(18432000 / 12), gain: 0.2});
	canvas.addEventListener('click', () => game.coin(true));
	init({game, sound, keydown, keyup});
});

