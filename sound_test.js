/*
 *
 *	Sound Test
 *
 */

import MappySound from './mappy_sound.js';
import {init, loop} from './main.js';
import MC6809 from './mc6809.js';
let game, sound;

class SoundTest {
	constructor() {
		this.cxScreen = 224;
		this.cyScreen = 256;
		this.width = 256;
		this.height = 256;
		this.xOffset = 0;
		this.yOffset = 0;
		this.fReset = true;
		this.nSound = 0;

		// CPU周りの初期化
		this.fInterruptEnable = false;

		this.cpu = new MC6809(this);

		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[i].read = addr => sound.read(addr);
			this.cpu.memorymap[i].write = (addr, data) => sound.write(addr, data);
		}
		this.cpu.memorymap[0x40].write = () => this.fInterruptEnable = true;
		this.cpu.memorymap[0x60].write = () => this.fInterruptEnable = false;
		for (let i = 0; i < 0x20; i++)
			this.cpu.memorymap[0xe0 + i].base = PRG2.base[i];
	}

	execute() {
		if (this.fInterruptEnable)
			this.cpu.interrupt();
		this.cpu.execute(0x2000);
		return this;
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.fInterruptEnable = false;
			this.cpu.reset();
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
		this.nSound = this.nSound + 1 & 0x1f;
		return this;
	}

	down() {
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
		for (let addr = 0x40; addr < 0x80; addr ++)
			sound.write(addr, 0);
		sound.write(0x40 + this.nSound, 1);
		return this;
	}

	triggerB(fDown = false) {
		if (fDown)
			return this;
		for (let addr = 0x40; addr < 0x80; addr ++)
			sound.write(addr, 0);
		return this;
	}

	makeBitmap(data) {
		for (let i = 0; i < 8; i++)
			for (let j = 0; j < 8; j++)
				SoundTest.Xfer28x16(data, 28 * j + 256 * 16 * i, key[0]);

		for (let i = 8; i < 16; i++)
			for (let j = 0; j < 8; j++)
				SoundTest.Xfer28x16(data, 28 * j + 256 * 16 * i, key[13]);

		const reg = [];
		for (let addr = 0; addr < 0x40; addr++)
			reg[addr] = sound.read(addr);

		for (let i = 0; i < 8; i++) {
			const freq = reg[4 + i * 8] | reg[5 + i * 8] << 8 | reg[6 + i * 8] << 16 & 0xf0000;
			const vol =  reg[3 + i * 8] & 0x0f;
			const pitch = Math.floor(Math.log2(freq * 48000 / (1 << 21) / 440) * 12 + 45.5);
			if (vol === 0 || pitch < 0 || pitch >= 12 * 8)
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
 *	Sound Test
 *
 */

const key = [];
const url = 'liblrabl.zip';
let SND, PRG2;

window.addEventListener('load', () => {
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Uint32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	$.ajax({url, success, error: () => alert(url + ': failed to get')});
});

function success(zip) {
	PRG2 = new Uint8Array(zip.files['2c.rom'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	SND = new Uint8Array(zip.files['lr1-4.3d'].inflate().split('').map(c => c.charCodeAt(0)));
	init({
		game: game = new SoundTest(),
		sound: sound = new MappySound({SND}),
	});
	canvas.addEventListener('click', () => game.triggerA().right());
	loop();
}

