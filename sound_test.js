/*
 *
 *	Sound Test
 *
 */

import MappySound from './mappy_sound.js';
import {Timer} from './utils.js';
import {init, read} from './sound_test_main.js';
import MC6809 from './mc6809.js';
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

	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;

	cpu2 = new MC6809(Math.floor(6144000 / 4));
	timer = new Timer(60);

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 4; i++) {
			this.cpu2.memorymap[i].read = (addr) => { return sound.read(addr); };
			this.cpu2.memorymap[i].write = (addr, data) => { sound.write(addr, data); };
		}
		for (let i = 0; i < 0x20; i++)
			this.cpu2.memorymap[0xe0 + i].base = PRG2.base[i];
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu2.execute(tick_rate);
			this.timer.execute(tick_rate, () => { update(), this.cpu2.interrupt(); });
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
		this.nSound = this.nSound + 1 & 0x1f;
		return this;
	}

	left(fDown = false) {
		if (fDown)
			return this;
		this.nSound = this.nSound - 1 & 0x1f;
		return this;
	}

	triggerA(fDown = false) {
		if (fDown)
			return this;
		for (let i = 0; i < 0x40; i ++)
			sound.write(0x40 + i, 0);
		sound.write(0x40 + this.nSound, 1);
		return this;
	}

	triggerB(fDown = false) {
		if (fDown)
			return this;
		for (let i = 0; i < 0x40; i ++)
			sound.write(0x40 + i, 0);
		return this;
	}

	makeBitmap(flag) {
		if (!(this.updated = flag))
			return this.bitmap;

		for (let i = 0; i < 16; i++)
			for (let j = 0; j < 8; j++)
				SoundTest.Xfer28x16(this.bitmap, 28 * j + 256 * 16 * i, key[i < 8 ? 0 : 13]);

		const reg = [];
		for (let i = 0; i < 0x40; i++)
			reg[i] = sound.read(i);

		for (let i = 0; i < 8; i++) {
			const freq = reg[4 + i * 8] | reg[5 + i * 8] << 8 | reg[6 + i * 8] << 16 & 0xf0000;
			const vol = reg[3 + i * 8] & 0x0f;
			const pitch = Math.floor(Math.log2(freq * 48000 / (1 << 21) / 440) * 12 + 45.5);
			if (!vol || pitch < 0 || pitch >= 12 * 8)
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
 *	Sound Test
 *
 */

const key = [];
let SND, PRG2;

read('liblrabl.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG2 = zip.decompress('2c.rom').addBase();
	SND = zip.decompress('lr1-4.3d');
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Int32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	game = new SoundTest();
	sound = new MappySound({SND});
	init({game, sound});
});

