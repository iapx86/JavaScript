/*
 *
 *	Sound Test 18
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

	ram = new Uint8Array(0x2000).addBase();
	command = [];
	cpu3_command = 0xff;
	cpu3_irq = false;
	cpu3_nmi = false;

	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;

	cpu3 = new Z80(Math.floor(12000000 / 2));
	timer = new Timer(60);

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x80; i++)
			this.cpu3.memorymap[i].base = PRG3.base[i];
		for (let i = 0; i < 0x20; i++) {
			this.cpu3.memorymap[0xc0 + i].base = this.ram.base[i];
			this.cpu3.memorymap[0xc0 + i].write = null;
		}
		for (let i = 0; i < 0x100; i++) {
			this.cpu3.iomap[i].read = (addr) => {
				switch (addr & 0xff) {
				case 0:
					return sound.status;
				case 1:
					return sound.read();
				case 2:
					return this.cpu3_irq = false, this.cpu3_command;
				}
				return 0xff;
			};
			this.cpu3.iomap[i].write = (addr, data) => {
				switch (addr & 0xff) {
				case 0:
					return void(sound.addr = data);
				case 1:
					return sound.write(data);
				}
			};
		}

		this.cpu3.check_interrupt = () => { return this.cpu3_nmi ? (this.cpu3_nmi = false, this.cpu3.non_maskable_interrupt()) : this.cpu3_irq && this.cpu3.interrupt(); };
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu3.execute(tick_rate);
			this.timer.execute(tick_rate, update);
			let irq = sound.irq;
			sound.execute(tick_rate) && !irq && (this.cpu3_nmi = true);
			audio.execute(tick_rate);
		}
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// コマンド処理
		if (this.command.length && !this.cpu3_irq)
			this.cpu3_command = this.command.shift(), this.cpu3_irq = true;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.nSound = 5;
			this.command.splice(0, this.command.length, 0xef);
			this.cpu3.reset();
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
			this.nSound = 1;
		return this;
	}

	left(fDown = false) {
		if (fDown)
			return this;
		if (--this.nSound < 1)
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
			const pitch = Math.floor(Math.log2(12000000 / 4 / 12 / 6 * f * Math.pow(2, b - 1) / 0x100000 / 440) * 12 + 45.5);
			if (!sound.kon[i] || pitch < 0 || pitch >= 12 * 8)
				continue;
			SoundTest.Xfer28x16(this.bitmap, 28 * Math.floor(pitch / 12) + 256 * 16 * i, key[pitch % 12 + 1]);
		}
		for (let i = 0; i < 3; i++) {
			const vol = sound.reg[8 + i] & 0x1f;
			if (!vol)
				continue;
			const freq = sound.reg[i * 2] | sound.reg[i * 2 + 1] << 8;
			const pitch = Math.floor(Math.log2(12000000 / 4 / 8 / 4 / (freq ? freq : 1) / 440) * 12 + 45.5);
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
 *	Sound Test 18
 *
 */

import {ROM} from "./dist/the_newzealand_story.png.js";
const key = [];
let PRG3;

window.addEventListener('load', () => expand(ROM).then(ROM => {
	PRG3 = new Uint8Array(ROM.buffer, 0x30000, 0x10000).addBase();
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Int32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	game = new SoundTest();
	sound = new YM2203({clock: Math.floor(12000000 / 4), gain: 2});
	init({game, sound});
}));

