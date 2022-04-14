/*
 *
 *	Sound Test 8b
 *
 */

import YM2151 from './ym2151.js';
import UPD7759 from './upd7759.js';
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

	ram2 = new Uint8Array(0x800).addBase();
	command = [];
	bank = 0;
	cpu2_nmi = false;

	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;

	cpu2 = new Z80(Math.floor(20000000 / 4));
	timer = new Timer(60);

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x80; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 0x40; i++)
			this.cpu2.memorymap[0x80 + i].read = (addr) => { return PRG2[this.bank + addr]; };
		this.cpu2.memorymap[0xe8].read = (addr) => { return addr === 0xe800 && this.command.length ? this.command.shift() : 0xff; };
		for (let i = 0; i < 8; i++) {
			this.cpu2.memorymap[0xf8 + i].base = this.ram2.base[i];
			this.cpu2.memorymap[0xf8 + i].write = null;
		}
		for (let i = 0; i < 0x100; i++) {
			this.cpu2.iomap[i].read = (addr) => {
				switch (addr >> 6 & 3) {
				case 0:
					return addr & 1 ? sound[0].status : 0xff;
				case 2:
					return sound[1].busy() << 7;
				case 3:
					return this.command.length ? this.command.shift() : 0xff;
				}
				return 0xff;
			};
			this.cpu2.iomap[i].write = (addr, data) => {
				switch (addr >> 6 & 3) {
				case 0:
					return ~addr & 1 ? void(sound[0].addr = data) : sound[0].write(data);
				case 1:
					sound[1].reset(data >> 6 & 1), sound[1].st(data >> 7);
					return void(this.bank = data << 14 & 0x1c000);
				case 2:
					return sound[1].write(data);
				}
			};
		}

		this.cpu2.check_interrupt = () => {
			return this.cpu2_nmi && (this.cpu2_nmi = false, this.cpu2.non_maskable_interrupt()) || this.command.length && this.cpu2.interrupt();
		};
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu2.execute(tick_rate);
			this.timer.execute(tick_rate, update);
			sound[0].execute(tick_rate);
			sound[1].execute(tick_rate, () => this.cpu2_nmi = true);
			audio.execute(tick_rate);
		}
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.nSound = 0x10;
			this.command.splice(0);
			this.cpu2_nmi = false;
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
		if (++this.nSound >= 0xc0)
			this.nSound = 0x10;
		return this;
	}

	left(fDown = false) {
		if (fDown)
			return this;
		if (--this.nSound < 0x10)
			this.nSound = 0xbf;
		return this;
	}

	triggerA(fDown = false) {
		if (fDown)
			return this;
		console.log(`command=$${this.nSound.toString(16)}`);
		this.command.push(1, this.nSound);
		return this;
	}

	triggerB(fDown = false) {
		if (fDown)
			return this;
		this.command.push(1, 1);
		return this;
	}

	makeBitmap(flag) {
		if (!(this.updated = flag))
			return this.bitmap;

		for (let i = 0; i < 16; i++)
			for (let j = 0; j < 8; j++)
				SoundTest.Xfer28x16(this.bitmap, 28 * j + 256 * 16 * i, key[i < 8 ? 0 : 13]);

		for (let i = 0; i < 8; i++) {
			const kc = sound[0].reg[0x28 + i], pitch = (kc >> 4 & 7) * 12 + (kc >> 2 & 3) * 3 + (kc & 3) + 2;
			if (!sound[0].kon[i] || pitch < 0 || pitch >= 12 * 8)
				continue;
			SoundTest.Xfer28x16(this.bitmap, 28 * Math.floor(pitch / 12) + 256 * 16 * i, key[pitch % 12 + 1]);
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
 *	Sound Test 8b
 *
 */

import {ROM} from "./dist/cotton_rom.js";
const key = [];
let PRG2;

window.addEventListener('load', () => expand(ROM).then(ROM => {
	PRG2 = new Uint8Array(ROM.buffer, 0x342000, 0x28000).addBase();
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Int32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	game = new SoundTest();
	sound = [
		new YM2151({clock: Math.floor(8000000 / 2)}),
		new UPD7759(),
	];
	init({game, sound});
}));

