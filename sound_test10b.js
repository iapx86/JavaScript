/*
 *
 *	Sound Test 10b
 *
 */

import YM2151 from './ym2151.js';
import {init, DoubleTimer, read} from './main.js';
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

	ram2 = new Uint8Array(0x1000).addBase();
	command = [];
	addr = 0;
	cpu2 = new Z80(3579545);

	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);

	timer = new DoubleTimer(32000000 / 8 / 512);

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0xf0; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 0x10; i++) {
			this.cpu2.memorymap[0xf0 + i].base = this.ram2.base[i];
			this.cpu2.memorymap[0xf0 + i].write = null;
		}
		for (let i = 0; i < 0x100; i++) {
			this.cpu2.iomap[i].read = (addr) => {
				switch (addr & 0xff) {
				case 1:
					return sound[0].status;
				case 0x80:
					return this.command.length ? this.command.shift() : 0xff;
				case 0x84:
					return PCM[this.addr];
				}
				return 0xff;
			};
			this.cpu2.iomap[i].write = (addr, data) => {
				switch (addr & 0xff) {
				case 0:
					return void(sound[0].addr = data);
				case 1:
					return sound[0].write(data);
				case 0x80:
					return void(this.addr = this.addr & 0x1e000 | data << 5);
				case 0x81:
					return void(this.addr = this.addr & 0x1fe0 | data << 13);
				case 0x82:
					return sound[1].data = (data - 128) / 127, void(this.addr = this.addr + 1 & PCM.length - 1);
				}
			};
		}

		this.cpu2.check_interrupt = () => { return sound[0].irq && this.cpu2.interrupt(0xef); };
	}

	execute(audio, rate_correction) {
		const tick_rate = 384000, tick_max = Math.floor(tick_rate / 60);
		this.command.length && this.cpu2.interrupt(0xdf);
		for (let i = 0; i < tick_max; i++) {
			this.cpu2.execute(tick_rate);
			this.timer.execute(tick_rate, rate_correction, () => this.cpu2.non_maskable_interrupt());
			sound[0].execute(tick_rate);
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
 *	Sound Test 10b
 *
 */

const key = [];
let PRG2, PCM;

read('rtype2.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG2 = zip.decompress('ic17.4f').addBase();
	PCM = zip.decompress('ic14.4c');
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Int32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	game = new SoundTest();
	sound = [
		new YM2151({clock: 3579545, gain: 2}),
		{output: 0, gain: 0.5, data: 0, update() { this.output = this.data * this.gain; }},
	];
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

