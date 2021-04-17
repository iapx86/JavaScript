/*
 *
 *	Sound Test 15
 *
 */

import YM2151 from './ym2151.js';
import K007232 from './k007232.js';
import {Timer} from './utils.js';
import {init, read} from './sound_test_main.js';
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
	nSound = 0x80;

	ram = new Uint8Array(0x800).addBase();
	command = [];

	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;

	cpu3 = new Z80(3579545);
	timer = new Timer(60);

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0xf0; i++)
			this.cpu3.memorymap[i].base = PRG3.base[i];
		this.cpu3.memorymap[0xf0].read = (addr) => {
			switch (addr >> 4 & 0xf) {
			case 1:
				return this.command.length ? this.command.shift() : 0xff;
			case 2:
				return sound[1].read(addr);
			case 3:
				return sound[0].status;
			}
			return 0;
		};
		this.cpu3.memorymap[0xf0].write = (addr, data) => {
			switch (addr >> 4 & 0xf) {
			case 0:
				return sound[1].set_bank(data & 3, data >> 2 & 3);
			case 2:
				return sound[1].write(addr, data);
			case 3:
				return ~addr & 1 ? void(sound[0].addr = data) : sound[0].write(data);
			}
		};
		for (let i = 0; i < 8; i++) {
			this.cpu3.memorymap[0xf8 + i].base = this.ram.base[i];
			this.cpu3.memorymap[0xf8 + i].write = null;
		}

		this.cpu3.check_interrupt = () => { return this.command.length && this.cpu3.interrupt(); };
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu3.execute(tick_rate);
			this.timer.execute(tick_rate, update);
			sound[0].execute(tick_rate);
			sound[1].execute(tick_rate);
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
			this.nSound = 0x80;
			this.command.splice(0);
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
		if (++this.nSound >= 0x100)
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
		this.command.push(0, this.nSound);
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
				SoundTest.Xfer28x16(this.bitmap, 28 * j + 256 * 16 * i, key[i < 8 ? 0 : 13]);

		for (let i = 0; i < 8; i++) {
			const kc = sound[0].reg[0x28 + i], pitch = (kc >> 4 & 7) * 12 + (kc >> 2 & 3) * 3 + (kc & 3);
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
 *	Sound Test 15
 *
 */

const key = [];
let PRG3, SND;

read('gradius3.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG3 = zip.decompress('945_r05.d9').addBase();
	SND = Uint8Array.concat(...['945_a10.b15', '945_l11a.c18', '945_l11b.c20'].map(e => zip.decompress(e)));
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Int32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	game = new SoundTest();
	sound = [
		new YM2151({clock: 3579545, gain: 3}),
		new K007232({SND, clock: 3579545, gain: 0.2}),
	];
	init({game, sound});
});

