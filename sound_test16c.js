/*
 *
 *	Sound Test 16c
 *
 */

import SN76489 from './sn76489.js';
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
	nSound = 0;

	ram2 = new Uint8Array(0x800).addBase();
	count = 0;
	command = [];
	cpu2_irq = false;
	cpu2 = new Z80();

	constructor() {
		// CPU周りの初期化
		const range = (page, start, end, mirror = 0) => (page & ~mirror) >= start && (page & ~mirror) <= end;

		for (let page = 0; page < 0x100; page++)
			if (range(page, 0, 0x7f))
				this.cpu2.memorymap[page].base = PRG2.base[page & 0x7f];
			else if (range(page, 0x80, 0x87, 0x18)) {
				this.cpu2.memorymap[page].base = this.ram2.base[page & 7];
				this.cpu2.memorymap[page].write = null;
			} else if (range(page, 0xa0, 0xa0, 0x1f))
				this.cpu2.memorymap[page].write = (addr, data) => { sound[0].write(data, this.count); };
			else if (range(page, 0xc0, 0xc0, 0x1f))
				this.cpu2.memorymap[page].write = (addr, data) => { sound[1].write(data, this.count); };
			else if (range(page, 0xe0, 0xe0, 0x1f))
				this.cpu2.memorymap[page].read = () => { return this.command.length ? this.command.shift() : 0xff; };

		this.cpu2.check_interrupt = () => { return this.cpu2_irq && this.cpu2.interrupt() ? (this.cpu2_irq = false, true) : false; };
	}

	execute() {
		for (this.count = 0; this.count < 4; this.count++)
			this.command.length && this.cpu2.non_maskable_interrupt(), this.cpu2_irq = true, this.cpu2.execute(0x800);
		return this;
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.nSound = 0xa9;
			this.command.splice(0);
			this.cpu2.reset();
			this.cpu2_irq = false;
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
		this.command.push(0, 0);
		return this;
	}

	makeBitmap(data) {
		for (let i = 0; i < 16; i++)
			for (let j = 0; j < 8; j++)
				SoundTest.Xfer28x16(data, 28 * j + 256 * 16 * i, key[i < 6 ? 0 : 13]);

		const reg = [];
		for (let i = 0; i < 16; i++)
			reg[i] = sound[i >> 3].reg[i & 7];

		for (let i = 0; i < 6; i++) {
			const vol = ~reg[[1, 3, 5, 9, 11, 13][i]] & 0xf;
			if (!vol)
				continue;
			const freq = reg[[0, 2, 4, 8, 10, 12][i]];
			const pitch = Math.floor(Math.log2((i < 3 ? 2000000 : 4000000) / 32 / (freq ? freq : 0x400) / 440) * 12 + 45.5);
			if (pitch < 0 || pitch >= 12 * 8)
				continue;
			SoundTest.Xfer28x16(data, 28 * Math.floor(pitch / 12) + 256 * 16 * i, key[pitch % 12 + 1]);
		}
	}

	static Xfer28x16(data, dst, src) {
		for (let i = 0; i < 16; i++)
			for (let j = 0; j < 28; j++)
				data[dst + 256 * i + j] = src[28 * i + j];
	}
}

/*
 *
 *	Sound Test 16c
 *
 */

const key = [];
let PRG2;

read('ufosensi.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG2 = zip.decompress('epr-11667.126').addBase();
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Uint32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	game = new SoundTest();
	sound = [
		new SN76489({clock: 2000000, resolution: 4}),
		new SN76489({clock: 4000000, resolution: 4}),
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
