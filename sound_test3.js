/*
 *
 *	Sound Test 3
 *
 */

import PolePositionSound from './pole_position_sound.js';
import {init} from './main.js';
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

	fInterruptEnable = false;
	ram = new Uint8Array(0x2300).addBase();
	count = 0;
	cpu = new Z80();

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x30; i++)
			this.cpu.memorymap[i].base = PRG.base[i];
		for (let i = 0; i < 8; i++) {
			this.cpu.memorymap[0x30 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x30 + i].write = null;
		}
		for (let i = 0; i < 0x18; i++) {
			this.cpu.memorymap[0x40 + i].base = this.ram.base[8 + i];
			this.cpu.memorymap[0x40 + i].write = null;
		}
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0x80 + i].read = addr => sound.read(addr);
			this.cpu.memorymap[0x80 + i].write = (addr, data) => sound.write(addr, data, this.count);
		}
		this.cpu.memorymap[0x90].base = this.ram.base[0x20];
		this.cpu.memorymap[0x90].write = null;
		this.cpu.memorymap[0x91].base = this.ram.base[0x21];
		this.cpu.memorymap[0x91].write = null;
		this.cpu.memorymap[0xa0].write = (addr, data) => {
			if ((addr & 0xff) === 0)
				this.fInterruptEnable = (data & 1) !== 0;
			this.ram[0x2200 | addr & 0xff] = data;
		};

		this.cpu.breakpoint = addr => {
			switch (addr) {
			case 0x0000:
				return void(this.cpu.pc = 0x0ea5);
			case 0x00b8:
				return this.cpu.suspend();
			case 0x0119:
				return void(this.cpu.pc = 0x0139);
			case 0x013c:
				return void(this.cpu.pc = 0x0154);
			case 0x0159:
				return void(this.cpu.pc = 0x0181);
			}
		};
		this.cpu.set_breakpoint(0x0000);
		this.cpu.set_breakpoint(0x00b8);
		this.cpu.set_breakpoint(0x0119);
		this.cpu.set_breakpoint(0x013c);
		this.cpu.set_breakpoint(0x0159);
	}

	execute() {
		for (this.count = 0; this.count < 2; this.count++) {
			if (this.fInterruptEnable)
				this.cpu.interrupt();
			this.cpu.execute(0x1000);
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
		this.nSound = this.nSound + 1 & 0xf;
		return this;
	}

	down() {
		return this;
	}

	left(fDown = false) {
		if (fDown)
			return this;
		this.nSound = this.nSound - 1 & 0xf;
		return this;
	}

	triggerA(fDown = false) {
		if (fDown)
			return this;
		this.cpu.write(0x4071, 1);
		this.cpu.write(0x4076, 0);
		this.cpu.write(0x4077, 0);
		this.cpu.write(0x4076 + (this.nSound >> 3), 0x80 >> (this.nSound & 7));
		return this;
	}

	triggerB(fDown = false) {
		if (fDown)
			return this;
		this.cpu.write(0x4071, 1);
		this.cpu.write(0x4076, 0);
		this.cpu.write(0x4077, 0);
		return this;
	}

	makeBitmap(data) {
		for (let i = 0; i < 16; i++)
			for (let j = 0; j < 8; j++)
				SoundTest.Xfer28x16(data, 28 * j + 256 * 16 * i, key[i < 8 ? 0 : 13]);

		const reg = [];
		for (let i = 0; i < 0x40; i++)
			reg[i] = sound.read(0x3c0 + i);

		for (let i = 0; i < 8; i++) {
			const freq = reg[i * 4] << 1 | reg[1 + i * 4] << 9;
			const vol = reg[2 + i * 4] >> 4 || reg[3 + i * 4] >> 4 || reg[3 + i * 4] & 0x0f || reg[0x23 + i * 4] >> 4;
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
 *	Sound Test 3
 *
 */

const key = [];
const url = 'polepos2.zip';
let PRG, SND;

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
	PRG = new Uint8Array((zip.files['pp4_9.6h'].inflate() + zip.files['pp4_10.5h'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	SND = new Uint8Array(zip.files['pp1-5.3b'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	game = new SoundTest();
	sound = new PolePositionSound({SND, resolution: 2});
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
}

