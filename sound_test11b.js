/*
 *
 *	Sound Test 11b
 *
 */

import YM2151 from './ym2151.js';
import C30 from './c30.js';
import {init, loop, canvas} from './main.js';
import MC6801 from './mc6801.js';
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
		this.nSound = 1;
		this.command = [];

		// CPU周りの初期化
		this.ram3 = new Uint8Array(0xd00).addBase();
		this.fm = {addr: 0, reg: new Uint8Array(0x100), kon: new Uint8Array(8)};

		this.mcu = new MC6801(this);
		this.mcu.memorymap[0].base = this.ram3.base[0];
		this.mcu.memorymap[0].write = null;
		for (let i = 0; i < 4; i++) {
			this.mcu.memorymap[0x10 + i].read = addr => sound[1].read(addr);
			this.mcu.memorymap[0x10 + i].write = (addr, data) => sound[1].write(addr, data);
		}
		for (let i = 0; i < 0x0c; i++) {
			this.mcu.memorymap[0x14 + i].base = this.ram3.base[1 + i];
			this.mcu.memorymap[0x14 + i].write = null;
		}
		this.mcu.memorymap[0x38].read = addr => addr === 0x3801 ? 0 : 0xff;
		this.mcu.memorymap[0x38].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				return void(this.fm.addr = data);
			case 1:
				if (this.fm.addr === 8)
					this.fm.kon[data & 7] = Number((data & 0x78) !== 0);
				return sound[0].write(this.fm.addr, this.fm.reg[this.fm.addr] = data);
			}
		};
		for (let i = 0; i < 0x80; i++)
			this.mcu.memorymap[0x40 + i].base = PRG3.base[i];
		for (let i = 0; i < 0x10; i++)
			this.mcu.memorymap[0xf0 + i].base = PRG3I.base[i];
	}

	execute() {
		this.mcu.interrupt();
		this.mcu.execute(0x1000);
		if ((this.ram3[8] & 8) !== 0)
			this.mcu.interrupt('ocf');
		this.mcu.execute(0x1000);
		return this;
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// コマンド処理
		if (this.command.length) {
			if (this.command[0] === 0) {
				for (let i = 0; i < 0x20; i++)
					sound[1].write(0x285 + i, 0);
				sound[1].write(0x380, 0);
			}
			else if (this.command[0] < 16)
				sound[1].write(0x380, this.command[0]);
			else if (this.command[0] < 48)
				sound[1].write(0x285 + this.command[0] - 16, 1);
			this.command.shift();
		}

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.nSound = 1;
			this.command.splice(0);
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
		if (++this.nSound >= 48)
			this.nSound = 1;
		return this;
	}

	down() {
		return this;
	}

	left(fDown = false) {
		if (fDown)
			return this;
		if (--this.nSound <= 0)
			this.nSound = 47;
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

	makeBitmap(data) {
		for (let i = 0; i < 16; i++)
			for (let j = 0; j < 8; j++)
				SoundTest.Xfer28x16(data, 28 * j + 256 * 16 * i, key[0]);

		for (let i = 0; i < 8; i++) {
			const kc = this.fm.reg[0x28 + i], pitch = (kc >> 4 & 7) * 12 + (kc >> 2 & 3) * 3 + (kc & 3);
			if (!this.fm.kon[i] || pitch < 0 || pitch >= 12 * 8)
				continue;
			SoundTest.Xfer28x16(data, 28 * Math.floor(pitch / 12) + 256 * 16 * i, key[pitch % 12 + 1]);
		}

		const reg = [];
		for (let i = 0; i < 0x40; i++)
			reg[i] = sound[1].read(0x100 + i);

		for (let i = 0; i < 8; i++) {
			const vol = reg[i * 8] & 0x0f;
			if (vol === 0)
				continue;
			if (i < 4 && (reg[-4 + i * 8 & 0x3f] & 0x80) !== 0)
				SoundTest.Xfer28x16(data, 256 * 16 * (8 + i), key[1]);
			else {
				const freq = reg[3 + i * 8] | reg[2 + i * 8] << 8 | reg[1 + i * 8] << 16 & 0xf0000;
				const pitch = Math.floor(Math.log2(freq * 24000 / (1 << 20) / 440) * 12 + 45.5);
				if (pitch < 0 || pitch >= 12 * 8)
					continue;
				SoundTest.Xfer28x16(data, 28 * Math.floor(pitch / 12) + 256 * 16 * (8 + i), key[pitch % 12 + 1]);
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
 *	Sound Test 11b
 *
 */

const key = [];
const url = 'wndrmomo.zip';
let PRG3, PRG3I;

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
	PRG3 = new Uint8Array(zip.files['wm1_3.6b'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	PRG3I = new Uint8Array(zip.files['cus60-60a1.mcu'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	init({
		game: game = new SoundTest(),
		sound: sound = [
			new YM2151({clock: 3579580}),
			new C30(),
		],
	});
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
	loop();
}

