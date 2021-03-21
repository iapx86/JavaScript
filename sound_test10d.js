/*
 *
 *	Sound Test 10d
 *
 */

import YM2151 from './ym2151.js';
import {init, read} from './main.js';
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

	cpu2 = new Z80(3579545);

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

	execute(audio, rate_correction) {
		const tick_rate = 384000, tick_max = Math.floor(tick_rate / 60);
		this.command.length && this.cpu2.interrupt(0xdf);
		for (let i = 0; i < tick_max; i++) {
			this.cpu2.execute(tick_rate);
			sound.execute(tick_rate);
			audio.execute(tick_rate, rate_correction);
		}
		return this;
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
			this.ram2.set(PRG.subarray(0x400, 0xc400));
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
		this.command.push(0x20, this.nSound);
		return this;
	}

	triggerB(fDown = false) {
		if (fDown)
			return this;
		this.command.push(0x20);
		return this;
	}

	makeBitmap() {
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
 *	Sound Test 10d
 *
 */

const key = [];
const PRG = new Uint8Array(0x20000);

read('bchopper.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	zip.decompress('mrheli/mh_c-h1-.ic41').forEach((e, i) => PRG[1 | i << 1] = e);
	zip.decompress('mrheli/mh_c-l1-.ic36').forEach((e, i) => PRG[i << 1] = e);
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Int32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	game = new SoundTest();
	sound = new YM2151({clock: 3579545, gain: 2});
	game.initial = true;
	canvas.addEventListener('click', e => {
		if (game.initial)
			game.initial = false;
		else if (e.offsetX < canvas.width / 2)
			game.left();
		else
			game.right();
		game.triggerA();
	});
	init({game, sound});
});

