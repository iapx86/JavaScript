/*
 *
 *	Sound Test 8b
 *
 */

import YM2151 from './ym2151.js';
import UPD7759 from './upd7759.js';
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
	command = [];
	bank = 0;
	cpu2_nmi = false;

	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);

	cpu2 = new Z80(Math.floor(20000000 / 4));

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

	execute(audio, rate_correction) {
		const tick_rate = 384000, tick_max = Math.floor(tick_rate / 60);
		for (let i = 0; i < tick_max; i++) {
			this.cpu2.execute(tick_rate);
			sound[0].execute(tick_rate);
			sound[1].execute(tick_rate, rate_correction, () => this.cpu2_nmi = true);
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

	makeBitmap() {
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

const key = [];
let PRG2;

read('cotton.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG2 = Uint8Array.concat(...['cottonj/epr-13860.a10', 'cottonj/opr-13061.a11'].map(e => zip.decompress(e))).addBase();
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Int32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	game = new SoundTest();
	sound = [
		new YM2151({clock: 8000000 / 2}),
		new UPD7759(),
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

