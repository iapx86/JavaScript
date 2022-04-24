/*
 *
 *	Sound Test 19
 *
 */

import YM2203 from './ym2203.js';
import {Timer} from './utils.js';
import {init, expand} from './sound_test_main.js';
import Z80 from './z80.js';
let game, sound;

class SoundTest {
	cxScreen = 224;
	cyScreen = 256;
	width = 256;
	height = 256;
	xOffset = 0;
	yOffset = 0;
	rotate = false;

	fReset = true;
	nSound = 0;

	ram = new Uint8Array(0x1000).addBase();
	bank = 0x40;
	ciu = {status: 0, mode: 0, data: new Uint8Array(2)};
	command = [];

	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;

	cpu2 = new Z80(Math.floor(24000000 / 4));
	timer = new Timer(60);

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x80; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 0x10; i++) {
			this.cpu2.memorymap[0x80 + i].base = this.ram.base[i];
			this.cpu2.memorymap[0x80 + i].write = null;
		}
		this.cpu2.memorymap[0x90].read = (addr) => {
			switch (addr) {
			case 0x9000:
				return sound.status;
			case 0x9001:
				return sound.read();
			}
			return 0xff;
		};
		this.cpu2.memorymap[0x90].write = (addr, data) => {
			switch (addr) {
			case 0x9000:
				return void(sound.addr = data);
			case 0x9001:
				if (sound.addr === 14) {
					const _bank = data << 6 & 0xc0;
					if (_bank !== this.bank) {
						for (let i = 0; i < 0x40; i++)
							this.cpu2.memorymap[0x40 + i].base = PRG2.base[_bank + i];
						this.bank = _bank;
					}
				}
				return sound.write(data);
			}
		};
		this.cpu2.memorymap[0xa0].read = (addr) => {
			if (addr === 0xa001)
				switch (this.ciu.mode) {
				case 0:
					return ++this.ciu.mode, this.ciu.data[0] & 15;
				case 1:
					return this.ciu.status &= ~1, ++this.ciu.mode, this.ciu.data[0] >> 4;
				case 2:
					return ++this.ciu.mode, this.ciu.data[1] & 15;
				case 3:
					return this.ciu.status &= ~2, ++this.ciu.mode, this.ciu.data[1] >> 4;
				case 4:
					return this.ciu.status;
				}
			return 0xff;
		};
		this.cpu2.memorymap[0xa0].write = (addr, data) => {
			switch (addr) {
			case 0xa000:
				return void(this.ciu.mode = data & 15);
			case 0xa001:
				switch (this.ciu.mode) {
				case 0: case 2:
					return void(++this.ciu.mode);
				case 1:
					return this.ciu.status |= 4, void(++this.ciu.mode);
				case 3:
					return this.ciu.status |= 8, void(++this.ciu.mode);
				}
			}
		};

		this.cpu2.check_interrupt = () => { return sound.irq && this.cpu2.interrupt(); };
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu2.execute(tick_rate);
			this.timer.execute(tick_rate, update);
			sound.execute(tick_rate);
			audio.execute(tick_rate);
		}
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// コマンド処理
		if (this.command.length && ~this.ciu.status & 1)
			this.ciu.data[0] = this.command.shift(), this.ciu.status |= 1;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.nSound = 5;
			this.command.splice(0, this.command.length, 0xef, 0);
			this.cpu2.reset();
		}
		return this;
	}

	updateInput() {
		return this;
	}

	right(fDown = false) {
		if (fDown)
			return this;
		if (++this.nSound > 0xff)
			this.nSound = 0;
		return this;
	}

	left(fDown = false) {
		if (fDown)
			return this;
		if (--this.nSound < 0)
			this.nSound = 0xff;
		return this;
	}

	triggerA(fDown = false) {
		if (fDown)
			return this;
		console.log(`command=$${this.nSound.toString(16)}`);
		this.command.push(this.nSound);
		return this;
	}

	triggerB(fDown = false) {
		if (fDown)
			return this;
		this.command.push(0);
		return this;
	}

	makeBitmap(flag) {
		if (!(this.updated = flag))
			return this.bitmap;

		for (let i = 0; i < 16; i++)
			for (let j = 0; j < 8; j++)
				SoundTest.Xfer28x16(this.bitmap, 28 * j + 256 * 16 * i, key[i < 6 ? 0 : 13]);

		for (let i = 0; i < 3; i++) {
			const b = sound.reg[0xa4 + i] >> 3 & 7, f = sound.reg[0xa0 + i] | sound.reg[0xa4 + i] << 8 & 0x700;
			const pitch = Math.floor(Math.log2(24000000 / 8 / 12 / 6 * f * Math.pow(2, b - 1) / 0x100000 / 440) * 12 + 45.5);
			if (!sound.kon[i] || pitch < 0 || pitch >= 12 * 8)
				continue;
			SoundTest.Xfer28x16(this.bitmap, 28 * Math.floor(pitch / 12) + 256 * 16 * i, key[pitch % 12 + 1]);
		}
		for (let i = 0; i < 3; i++) {
			const vol = sound.reg[8 + i] & 0x1f;
			if (!vol)
				continue;
			const freq = sound.reg[i * 2] | sound.reg[i * 2 + 1] << 8;
			const pitch = Math.floor(Math.log2(24000000 / 8 / 8 / 4 / (freq ? freq : 1) / 440) * 12 + 45.5);
			if (pitch < 0 || pitch >= 12 * 8)
				continue;
			SoundTest.Xfer28x16(this.bitmap, 28 * Math.floor(pitch / 12) + 256 * 16 * (i + 3), key[pitch % 12 + 1]);
		}

		return this.bitmap;
	}

	static Xfer28x16(data, dst, src) {
		for (let i = 0; i < 16; i++)
			for (let j = 0; j < 28; j++)
				data[dst + 256 * i + j] = src[28 * i + j];
	}
}

/*
 *
 *	Sound Test 19
 *
 */

import {ROM} from "./dist/master_of_weapon.png.js";
const key = [];
let PRG2;

window.addEventListener('load', () => expand(ROM).then(ROM => {
	PRG2 = new Uint8Array(ROM.buffer, 0x0, 0x10000).addBase();
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Int32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	game = new SoundTest();
	sound = new YM2203({clock: Math.floor(24000000 / 8)});
	init({game, sound});
}));

