/*
 *
 *	Sound Test 7
 *
 */

import YM2151 from './ym2151.js';
import K007232 from './k007232.js';
import VLM5030 from './vlm5030.js';
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

	ram2 = new Uint8Array(0x800).addBase();
	vlm_latch = 0;
	vlm_control = 0;
	command = [];
	wd = 0;

	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);

	cpu2 = new Z80(3579545);

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x80; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 8; i++) {
			this.cpu2.memorymap[0x80 + i].base = this.ram2.base[i];
			this.cpu2.memorymap[0x80 + i].write = null;
		}
		this.cpu2.memorymap[0xa0].read = (addr) => { return addr === 0xa000 && this.command.length ? this.command.shift() : 0xff; };
		this.cpu2.memorymap[0xb0].read = (addr) => { return addr < 0xb00e ? sound[1].read(addr) : 0xff; };
		this.cpu2.memorymap[0xb0].write = (addr, data) => { addr < 0xb00e && sound[1].write(addr, data); };
		this.cpu2.memorymap[0xc0].read = (addr) => { return addr === 0xc001 ? sound[0].status : 0xff; };
		this.cpu2.memorymap[0xc0].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				return void(sound[0].addr = data);
			case 1:
				return sound[0].write(data);
			}
		};
		this.cpu2.memorymap[0xd0].write = (addr, data) => { addr === 0xd000 && (this.vlm_latch = data); };
		this.cpu2.memorymap[0xe0].read = (addr) => { return addr === 0xe000 ? this.wd ^= 1 : 0xff; };
		this.cpu2.memorymap[0xf0].write = (addr, data) => {
			if (addr === 0xf000) {
				if (~data & this.vlm_control & 1)
					sound[2].rst(this.vlm_latch);
				if (~data & this.vlm_control & 2)
					sound[2].st(this.vlm_latch);
				this.vlm_control = data;
			}
		};

		this.cpu2.check_interrupt = () => { return this.command.length && this.cpu2.interrupt(); };
	}

	execute(audio, rate_correction) {
		const tick_rate = 384000, tick_max = Math.floor(tick_rate / 60);
		for (let i = 0; i < tick_max; i++) {
			this.cpu2.execute(tick_rate);
			sound[0].execute(tick_rate);
			sound[1].execute(tick_rate, rate_correction);
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
			this.nSound = 0x40;
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
 *	Sound Test 7
 *
 */

const key = [];
let PRG2, VLM, SND;

read('salamand.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG2 = zip.decompress('587-d09.11j').addBase();
	VLM = zip.decompress('587-d08.8g');
	SND = zip.decompress('587-c01.10a');
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Int32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	game = new SoundTest();
	sound = [
		new YM2151({clock: 3579545, gain: 5}),
		new K007232({SND, clock: 3579545, gain: 0.2}),
		new VLM5030({VLM, clock: 3579545, gain: 5}),
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

