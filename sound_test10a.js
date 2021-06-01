/*
 *
 *	Sound Test 10a
 *
 */

import YM2151 from './ym2151.js';
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
	nSound = 1;

	ram2 = new Uint8Array(0x10000).addBase();
	command = [];

	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;

	cpu2 = new Z80(3579545);
	timer = new Timer(60);

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x100; i++) {
			this.cpu2.memorymap[i].base = this.ram2.base[i];
			this.cpu2.memorymap[i].write = null;
		}
		for (let i = 0; i < 0x100; i++) {
			this.cpu2.iomap[i].read = (addr) => {
				switch (addr & 0xff) {
				case 1:
					return sound.status;
				case 2:
					return this.command.length ? this.command.shift() : 0xff;
				}
				return 0xff;
			};
			this.cpu2.iomap[i].write = (addr, data) => {
				switch (addr & 0xff) {
				case 0:
					return void(sound.addr = data);
				case 1:
					return sound.write(data);
				}
			};
		}

		this.cpu2.check_interrupt = () => { return sound.irq && this.cpu2.interrupt(0xef); };
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu2.execute(tick_rate);
			this.timer.execute(tick_rate, () => { update(), this.command.length && this.cpu2.interrupt(0xdf); });
			sound.execute(tick_rate);
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
			this.nSound = 0;
			this.ram2.fill(0);
			this.ram2.set(PRG.subarray(0x22000, 0x2f000));
			this.command.splice(0);
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
		if (++this.nSound >= 0x100)
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
		switch (this.nSound) {
		case 0x86:
			return this.command.push(0x20, 0x84, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x85), this;
		case 0x8b:
			return this.command.push(0x20, 0x84, 0x8b, 0x8c, 0x8d, 0x8e, 0x8f, 0x85), this;
		case 0x90:
			return this.command.push(0x20, 0x84, 0x90, 0x91, 0x92, 0x93, 0x94, 0x85), this;
		default:
			return this.command.push(0x20, this.nSound), this;
		}
	}

	triggerB(fDown = false) {
		if (fDown)
			return this;
		this.command.push(0x20);
		return this;
	}

	makeBitmap(flag) {
		if (!(this.updated = flag))
			return this.bitmap;

		for (let i = 0; i < 16; i++)
			for (let j = 0; j < 8; j++)
				SoundTest.Xfer28x16(this.bitmap, 28 * j + 256 * 16 * i, key[i < 8 ? 0 : 13]);

		for (let i = 0; i < 8; i++) {
			const kc = sound.reg[0x28 + i], pitch = (kc >> 4 & 7) * 12 + (kc >> 2 & 3) * 3 + (kc & 3);
			if (!sound.kon[i] || pitch < 0 || pitch >= 12 * 8)
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
 *	Sound Test 10a
 *
 */

const key = [];
const PRG = new Uint8Array(0x40000);

read('imgfight.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	zip.decompress('if-c-h3.bin').forEach((e, i) => PRG[1 | i << 1] = e);
	zip.decompress('if-c-l3.bin').forEach((e, i) => PRG[i << 1] = e);
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Int32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	game = new SoundTest();
	sound = new YM2151({clock: 3579545, gain: 2});
	init({game, sound});
});

