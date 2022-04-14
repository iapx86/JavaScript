/*
 *
 *	Super Real Mahjong Part 3
 *
 */

import AY_3_8910 from './ay-3-8910.js';
import MSM5205 from './msm5205.js';
import {seq, rseq, convertGFX, Timer} from './utils.js';
import {init, expand} from './main.js';
import Z80 from './z80.js';
let game, sound;

class SuperRealMahjongPart3 {
	cxScreen = 224;
	cyScreen = 384;
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
	nDifficulty = 'Easy';

	ram = new Uint8Array(0x4400).addBase();
	in = Uint8Array.of(0xff, 0xff, 0xbf, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff);
	iox = {command: 0, data: 0, ff: 0};
	psg = {addr: 0};
	adpcm = {bank: 0, addr: 0, end: 0, data: 0};
	bank = 0x80;
	cpu_irq = false;

	gfx = new Uint8Array(0x800000).fill(15);
	rgb = Int32Array.from(seq(0x200).map(i => COLOR_H[i] << 8 | COLOR_L[i]), e => 0xff000000 | (e & 31) * 255 / 31 << 16 | (e >> 5 & 31) * 255 / 31 << 8 | (e >> 10 & 31) * 255 / 31);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;
	gfxbank = 0;

	cpu = new Z80(3500000);
	timer = new Timer(60);

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0xa0; i++)
			this.cpu.memorymap[i].base = PRG.base[i];
		for (let i = 0; i < 8; i++) {
			this.cpu.memorymap[0xa0 + i].base = NVRAM.base[i];
			this.cpu.memorymap[0xa0 + i].write = null;
		}
		for (let i = 0; i < 3; i++) {
			this.cpu.memorymap[0xb0 + i].base = this.ram.base[0x40 + i];
			this.cpu.memorymap[0xb0 + i].write = null;
		}
		this.cpu.memorymap[0xb3].write = (addr, data) => { addr < 0xb304 && (this.ram[0x4300 | addr & 3] = data); };
		for (let i = 0; i < 0x40; i++) {
			this.cpu.memorymap[0xc0 + i].base = this.ram.base[i];
			this.cpu.memorymap[0xc0 + i].write = null;
		}
		for (let i = 0; i < 0x100; i++) {
			this.cpu.iomap[i].read = (addr) => {
				let data;
				switch (addr & 0xff) {
				case 0x40:
					return this.in[0];
				case 0xa1: // adpcm status
					return 1;
				case 0xc0:
					if ((data = [0x49, 0x4c, 0x1c, 0x45].indexOf(this.iox.data)) >= 0)
						return this.iox.data = 0, [0xc9, 0x00, 0x04, 0x00][data];
					if (this.iox.ff)
						return this.in[11];
					switch (this.iox.command) {
					case 1:
						if ((data = 31 - Math.clz32(~(this.in[7] | this.in[8] << 8 | this.in[9] << 16 | this.in[10] << 24))) >= 0)
							return data + 32; // fallthrough
					case 2:
						return (data = 31 - Math.clz32(~(this.in[3] | this.in[4] << 8 | this.in[5] << 16 | this.in[6] << 24))) < 0 ? 0 : data;
					case 4:
						return (data = 31 - Math.clz32(~(this.in[7] | this.in[8] << 8 | this.in[9] << 16 | this.in[10] << 24))) < 0 ? 0 : data + 32;
					}
					return 0xff;
				case 0xc1:
					return 1;
				case 0xe2:
					switch (this.psg.addr) {
					case 14:
						return this.in[2];
					case 15:
						return this.in[1];
					}
					return sound[0].read(this.psg.addr);
				}
				return 0xff;
			};
			this.cpu.iomap[i].write = (addr, data) => {
				switch (addr & 0xff) {
				case 0x20:
					return void(this.cpu_irq = false);
				case 0x40:
					return void(this.gfxbank = data << 7 & 0x6000);
				case 0x60:
					const _bank = data << 5 & 0x1e0;
					this.adpcm.bank = data << 11 & 0x70000;
					if (_bank === this.bank)
						return;
					for (let i = 0; i < 0x20; i++)
						this.cpu.memorymap[0x80 + i].base = PRG.base[_bank + i];
					return void(this.bank = _bank);
				case 0xa0: // adpcm_code_w
					const base = this.adpcm.bank | data << 2, start = VOI[base] << 8, end = VOI[base + 1] << 8;
					return this.adpcm.addr = this.adpcm.bank + start, this.adpcm.end = this.adpcm.bank + (end ? end : 0x10000), this.adpcm.data = -1, sound[1].start();
				case 0xc0:
					return this.iox.command = data, void(this.iox.ff = 0);
				case 0xc1:
					return this.iox.data = data, data === 0xc8 ? void(this.iox.ff = 0) : data === 0xef ? void(this.iox.ff ^= 1) : void(0);
				case 0xe0:
					return void(this.psg.addr = data);
				case 0xe1:
					return sound[0].write(this.psg.addr, data);
				}
			};
		}

		this.cpu.check_interrupt = () => { return this.cpu_irq && this.cpu.interrupt(); };

		// Videoの初期化
		convertGFX(this.gfx, GFX, 32768, rseq(8, 256, 16).concat(rseq(8, 0, 16)), seq(8).concat(seq(8, 128)),
			[Math.floor(GFX.length / 2) * 8 + 8, Math.floor(GFX.length / 2) * 8, 8, 0], 64);
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.timer.execute(tick_rate, () => { update(), this.cpu_irq = true; });
			sound[0].execute(tick_rate);
			sound[1].execute(tick_rate, () => {
				if (!sound[1].status())
					return;
				if (this.adpcm.data >= 0)
					sound[1].write(this.adpcm.data & 15), this.adpcm.data = -1;
				else if (this.adpcm.addr < this.adpcm.end)
					this.adpcm.data = VOI[this.adpcm.addr++], sound[1].write(this.adpcm.data >> 4);
				else
					sound[1].stop();
			});
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
			switch (this.nDifficulty) {
			case 'Easy':
				this.in[1] |= 0xe0;
				break;
			case 'Hard':
				this.in[1] &= ~0xe0;
				break;
			}
		}

		if (this.fTest)
			this.in[2] &= ~2;
		else
			this.in[2] |= 2;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu_irq = false;
			this.cpu.reset();
		}
		return this;
	}

	updateInput() {
		this.in[0] = this.in[0] & ~(1 << 1) | !this.fCoin << 1, this.in[5] = this.in[5] & ~(1 << 3) | !this.fStart1P << 3, this.in[9] = this.in[9] & ~(1 << 3) | !this.fStart2P << 3;
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

		// 画面クリア
		let p = 256 * 16 + 16;
		for (let i = 0; i < 384; p += 256, i++)
			this.bitmap.fill(0x1f0, p, p + 224);

		// bg描画
		const ctrl = this.ram[0x4300], ctrl2 = this.ram[0x4301], gbank = (ctrl2 ^ ~ctrl2 << 1) << 6 & 0x1000, num = (ctrl2 & 15) === 1 ? 16 : ctrl2 & 15, offset = ctrl << 1 & 12;
		for (let i = 0; i < num; i++) {
			const hScroll = this.ram[0x4200 | i << 4], vScroll = this.ram[0x4204 | i << 4] | this.ram[0x4302 | i >> 3 & 1] << (~i & 7) + 1 & 0x100;
			for (let start = i + offset << 5 & 0x1e0, end = start + 32, j = start; j < end; ++j) {
				let reg1 = this.ram[0x400 | gbank | j] | this.ram[0x2400 | gbank | j] << 8, reg2 = this.ram[0x600 | gbank | j] | this.ram[0x2600 | gbank | j] << 8;
				let x = hScroll - (j << 3 & 0xf0) - 18 & 0xff, y = vScroll + (j << 4 & 0x10) + 16 & 0x1ff, src = reg2 << 4 & 0xf8000 | reg1 & 0x3fff;
				switch (reg1 >> 14) {
				case 0:
					this.xfer16x16(this.bitmap, x | y << 8, src);
					break;
				case 1:
					this.xfer16x16H(this.bitmap, x | y << 8, src);
					break;
				case 2:
					this.xfer16x16V(this.bitmap, x | y << 8, src);
					break;
				case 3:
					this.xfer16x16HV(this.bitmap, x | y << 8, src);
					break;
				}
			}
		}

		// obj描画
		for (let i = 511; i >= 0; --i) {
			let reg1 = this.ram[gbank | i] | this.ram[0x2000 | gbank | i] << 8, reg2 = this.ram[0x200 | gbank | i] | this.ram[0x2200 | gbank | i] << 8;
			let x = this.ram[0x4000 | i] - 2 & 0xff, y = reg2 + 16 & 0x1ff, src = reg2 << 4 & 0xf8000 | reg1 & 0x3fff;
			src & 0x2000 && (src += this.gfxbank);
			switch (reg1 >> 14) {
			case 0:
				this.xfer16x16(this.bitmap, x | y << 8, src);
				break;
			case 1:
				this.xfer16x16H(this.bitmap, x | y << 8, src);
				break;
			case 2:
				this.xfer16x16V(this.bitmap, x | y << 8, src);
				break;
			case 3:
				this.xfer16x16HV(this.bitmap, x | y << 8, src);
				break;
			}
		}

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 384; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				this.bitmap[p] = this.rgb[this.bitmap[p]];

		return this.bitmap;
	}

	xfer16x16(data, dst, src) {
		const idx = src >> 11 & 0x1f0;
		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 400 * 0x100)
			return;
		src = src << 8 & 0x7fff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let px, j = 16; j !== 0; dst++, --j)
				(px = this.gfx[src++]) && (data[dst] = idx | px);
	}

	xfer16x16V(data, dst, src) {
		const idx = src >> 11 & 0x1f0;
		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 400 * 0x100)
			return;
		src = (src << 8 & 0x7fff00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let px, j = 16; j !== 0; dst++, --j)
				(px = this.gfx[src++]) && (data[dst] = idx | px);
	}

	xfer16x16H(data, dst, src) {
		const idx = src >> 11 & 0x1f0;
		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 400 * 0x100)
			return;
		src = (src << 8 & 0x7fff00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let px, j = 16; j !== 0; dst++, --j)
				(px = this.gfx[--src]) && (data[dst] = idx | px);
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >> 11 & 0x1f0;
		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 400 * 0x100)
			return;
		src = (src << 8 & 0x7fff00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let px, j = 16; j !== 0; dst++, --j)
				(px = this.gfx[--src]) && (data[dst] = idx | px);
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
		return void(game.in[6] &= ~(1 << 1));
	case 'Digit5': // KAN
		return void(game.in[5] &= ~(1 << 5));
	case 'Digit6': // PON
		return void(game.in[5] &= ~(1 << 1));
	case 'Digit7': // CHI
		return void(game.in[4] &= ~(1 << 3));
	case 'Digit8': // REACH
		return void(game.in[6] &= ~(1 << 3));
	case 'Digit9': // RON
		return void(game.in[4] &= ~(1 << 1));
	case 'KeyA':
		return void(game.in[6] &= ~(1 << 0));
	case 'KeyB':
		return void(game.in[6] &= ~(1 << 6));
	case 'KeyC':
		return void(game.in[4] &= ~(1 << 4));
	case 'KeyD':
		return void(game.in[5] &= ~(1 << 2));
	case 'KeyE':
		return void(game.in[5] &= ~(1 << 6));
	case 'KeyF':
		return void(game.in[6] &= ~(1 << 4));
	case 'KeyG':
		return void(game.in[4] &= ~(1 << 2));
	case 'KeyH':
		return void(game.in[5] &= ~(1 << 0));
	case 'KeyI':
		return void(game.in[5] &= ~(1 << 4));
	case 'KeyJ':
		return void(game.in[6] &= ~(1 << 2));
	case 'KeyK':
		return void(game.in[4] &= ~(1 << 0));
	case 'KeyL':
		return void(game.in[4] &= ~(1 << 6));
	case 'KeyM':
		return void(game.in[5] &= ~(1 << 7));
	case 'KeyN':
		return void(game.in[6] &= ~(1 << 5));
	case 'KeyR':
		return game.reset();
	case 'KeyT':
		return void((game.fTest = !game.fTest) === false && (game.fReset = true));
	case 'KeyV': // MUTE
		return audioCtx.state === 'suspended' ? audioCtx.resume().catch() : audioCtx.state === 'running' && audioCtx.suspend().catch();
	case 'F7': // FLIP FLOP
		return void(game.in[3] &= ~(1 << 5));
	case 'F8': // TAKE SCORE
		return void(game.in[3] &= ~(1 << 4));
	case 'F9': // DOUBLE UP
		return void(game.in[3] &= ~(1 << 2));
	case 'F10': // BIG
		return void(game.in[3] &= ~(1 << 3));
	case 'F11': // SMALL
		return void(game.in[3] &= ~(1 << 1));
	case 'F12': // LAST CHANCE
		return void(game.in[3] &= ~(1 << 6));
	}
};

const keyup = e => {
	switch (e.code) {
	case 'Digit3': // BET
		return void(game.in[6] |= 1 << 1);
	case 'Digit5': // KAN
		return void(game.in[5] |= 1 << 5);
	case 'Digit6': // PON
		return void(game.in[5] |= 1 << 1);
	case 'Digit7': // CHI
		return void(game.in[4] |= 1 << 3);
	case 'Digit8': // REACH
		return void(game.in[6] |= 1 << 3);
	case 'Digit9': // RON
		return void(game.in[4] |= 1 << 1);
	case 'KeyA':
		return void(game.in[6] |= 1 << 0);
	case 'KeyB':
		return void(game.in[6] |= 1 << 6);
	case 'KeyC':
		return void(game.in[4] |= 1 << 4);
	case 'KeyD':
		return void(game.in[5] |= 1 << 2);
	case 'KeyE':
		return void(game.in[5] |= 1 << 6);
	case 'KeyF':
		return void(game.in[6] |= 1 << 4);
	case 'KeyG':
		return void(game.in[4] |= 1 << 2);
	case 'KeyH':
		return void(game.in[5] |= 1 << 0);
	case 'KeyI':
		return void(game.in[5] |= 1 << 4);
	case 'KeyJ':
		return void(game.in[6] |= 1 << 2);
	case 'KeyK':
		return void(game.in[4] |= 1 << 0);
	case 'KeyL':
		return void(game.in[4] |= 1 << 6);
	case 'KeyM':
		return void(game.in[5] |= 1 << 7);
	case 'KeyN':
		return void(game.in[6] |= 1 << 5);
	case 'F7': // FLIP FLOP
		return void(game.in[3] |= 1 << 5);
	case 'F8': // TAKE SCORE
		return void(game.in[3] |= 1 << 4);
	case 'F9': // DOUBLE UP
		return void(game.in[3] |= 1 << 2);
	case 'F10': // BIG
		return void(game.in[3] |= 1 << 3);
	case 'F11': // SMALL
		return void(game.in[3] |= 1 << 1);
	case 'F12': // LAST CHANCE
		return void(game.in[3] |= 1 << 6);
	}
};

/*
 *
 *	Super Real Mahjong Part 3
 *
 */

export const NVRAM = Uint8Array.from(window.atob('\
QUxJQ0UgTUFISk9ORyBaU1JNUDPecQAAAAAAAAAAAAAAAAAAAAAAAAAAAAdfAABfAAAAAAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeqAKAAAAAABFsAAAAABsBwAAAACRBQAAAAC2AwAAAADbAQAAAACWnsme4Z75nhGfAAAAAAAAAAAAAAAA\
6AMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEgAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADxcXHxwAAAAAA\
AMBgAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABzR2Aw3h+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
EQAHBwEAAABOAAAAAAAAAQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAGCEwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABOAABOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/wAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAACWATQEAAAAQAAAAPAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAPAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\
AAAAAAAAgwICCgYAgwICCoMCAgqDAgIKBgCxf/l9AAAggE2hyADge8jRAAAAAAAAAADmFc4MIAOAzrIVghSxSSA26zU=\
').split(''), c => c.charCodeAt(0)).addBase();

/*
 *
 *	Super Real Mahjong Part 3
 *
 */

import {ROM} from "./dist/super_real_mahjong_part3_rom.js";
let PRG, GFX, VOI, COLOR_H, COLOR_L;

window.addEventListener('load', () => expand(ROM).then(ROM => {
	PRG = new Uint8Array(ROM.buffer, 0x0, 0x20000).addBase();
	GFX = new Uint8Array(ROM.buffer, 0x20000, 0x400000);
	VOI = new Uint8Array(ROM.buffer, 0x420000, 0x80000);
	COLOR_H = new Uint8Array(ROM.buffer, 0x4a0000, 0x200);
	COLOR_L = new Uint8Array(ROM.buffer, 0x4a0200, 0x200);
	game = new SuperRealMahjongPart3();
	sound = [
		new AY_3_8910({clock: Math.floor(16000000 / 16)}),
		new MSM5205(),
	];
	canvas.addEventListener('click', () => game.coin(true));
	init({game, sound, keydown, keyup});
}));

