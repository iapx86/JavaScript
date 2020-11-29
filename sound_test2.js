/*
 *
 *	Sound Test 2
 *
 */

import C30 from './c30.js';
import {init, read} from './main.js';
import MC6801 from './mc6801.js';
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

	fInterruptEnable1 = false;
	ram2 = new Uint8Array(0x900).addBase();
	mcu = new MC6801();

	constructor() {
		// CPU周りの初期化
		this.mcu.memorymap[0].base = this.ram2.base[0];
		this.mcu.memorymap[0].write = null;
		for (let i = 0; i < 4; i++) {
			this.mcu.memorymap[0x10 + i].read = (addr) => { return sound.read(addr); };
			this.mcu.memorymap[0x10 + i].write = (addr, data) => { sound.write(addr, data); };
		}
		for (let i = 0; i < 0x40; i++)
			this.mcu.memorymap[0x40 + i].write = (addr) => { this.fInterruptEnable1 = !(addr & 0x2000); };
		for (let i = 0; i < 0x20; i++)
			this.mcu.memorymap[0x80 + i].base = PRG2.base[i];
		for (let i = 0; i < 8; i++) {
			this.mcu.memorymap[0xc0 + i].base = this.ram2.base[1 + i];
			this.mcu.memorymap[0xc0 + i].write = null;
		}
		for (let i = 0; i < 0x10; i++)
			this.mcu.memorymap[0xf0 + i].base = PRG2I.base[i];
	}

	execute() {
		if (this.fInterruptEnable1)
			this.mcu.interrupt();
		this.mcu.execute(0x1000);
		if (this.ram2[8] & 8)
			this.mcu.interrupt('ocf');
		this.mcu.execute(0x1000);
		return this;
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.mcu.reset();
		}
		return this;
	}

	updateInput() {
		return this;
	}

	coin() {
		return this;
	}

	start1P() {
		return this;
	}

	start2P() {
		return this;
	}

	up() {
		return this;
	}

	right(fDown = false) {
		if (fDown)
			return this;
		this.nSound = this.nSound + 1 & 0x3f;
		return this;
	}

	down() {
		return this;
	}

	left(fDown = false) {
		if (fDown)
			return this;
		this.nSound = this.nSound - 1 & 0x3f;
		return this;
	}

	triggerA(fDown = false) {
		if (fDown)
			return this;
		for (let i = 0; i < 0x40; i++)
			sound.write(0x285 + i, 0);
		sound.write(0x285 + this.nSound, 1);
		return this;
	}

	triggerB(fDown = false) {
		if (fDown)
			return this;
		for (let i = 0; i < 0x40; i++)
			sound.write(0x285 + i, 0);
		return this;
	}

	makeBitmap(data) {
		for (let i = 0; i < 16; i++)
			for (let j = 0; j < 8; j++)
				SoundTest.Xfer28x16(data, 28 * j + 256 * 16 * i, key[i < 8 ? 0 : 13]);

		const reg = [];
		for (let i = 0; i < 0x40; i++)
			reg[i] = sound.read(0x100 + i);

		for (let i = 0; i < 8; i++) {
			const vol = reg[i * 8] & 0x0f;
			if (!vol)
				continue;
			if (i < 4 && reg[-4 + i * 8 & 0x3f] & 0x80)
				SoundTest.Xfer28x16(data, 256 * 16 * i, key[1]);
			else {
				const freq = reg[3 + i * 8] | reg[2 + i * 8] << 8 | reg[1 + i * 8] << 16 & 0xf0000;
				const pitch = Math.floor(Math.log2(freq * 24000 / (1 << 20) / 440) * 12 + 45.5);
				if (pitch < 0 || pitch >= 12 * 8)
					continue;
				SoundTest.Xfer28x16(data, 28 * Math.floor(pitch / 12) + 256 * 16 * i, key[pitch % 12 + 1]);
			}
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
 *	Sound Test 2
 *
 */

const key = [];
let PRG2, PRG2I;

read('pacland.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG2 = zip.decompress('pl1_7.3e').addBase();
	PRG2I = zip.decompress('cus60-60a1.mcu').addBase();
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Uint32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	game = new SoundTest();
	sound = new C30();
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

