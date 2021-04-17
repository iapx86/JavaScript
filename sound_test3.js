/*
 *
 *	Sound Test 3
 *
 */

import PolePositionSound from './pole_position_sound.js';
import {Timer} from './utils.js';
import {init, read} from './sound_test_main.js';
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

	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;

	cpu = new Z80(Math.floor(24576000 / 8));
	timer = new Timer(60);
	timer2 = new Timer(120);

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
			this.cpu.memorymap[0x80 + i].read = (addr) => { return sound.read(addr); };
			this.cpu.memorymap[0x80 + i].write = (addr, data) => { sound.write(addr, data, this.count); };
		}
		this.cpu.memorymap[0x90].base = this.ram.base[0x20];
		this.cpu.memorymap[0x90].write = null;
		this.cpu.memorymap[0x91].base = this.ram.base[0x21];
		this.cpu.memorymap[0x91].write = null;
		this.cpu.memorymap[0xa0].write = (addr, data) => {
			if (!(addr & 0xff))
				this.fInterruptEnable = (data & 1) !== 0;
			this.ram[0x2200 | addr & 0xff] = data;
		};

		this.cpu.breakpoint = (addr) => {
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

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.timer.execute(tick_rate, update);
			this.timer2.execute(tick_rate, () => { this.fInterruptEnable && this.cpu.interrupt(); });
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
			this.fInterruptEnable = false;
			this.cpu.reset();
		}
		return this;
	}

	updateInput() {
		return this;
	}

	right(fDown = false) {
		if (fDown)
			return this;
		this.nSound = this.nSound + 1 & 0xf;
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

	makeBitmap(flag) {
		if (!(this.updated = flag))
			return this.bitmap;

		for (let i = 0; i < 16; i++)
			for (let j = 0; j < 8; j++)
				SoundTest.Xfer28x16(this.bitmap, 28 * j + 256 * 16 * i, key[i < 8 ? 0 : 13]);

		const reg = [];
		for (let i = 0; i < 0x40; i++)
			reg[i] = sound.read(0x3c0 + i);

		for (let i = 0; i < 8; i++) {
			const freq = reg[i * 4] << 1 | reg[1 + i * 4] << 9;
			const vol = reg[2 + i * 4] >> 4 || reg[3 + i * 4] >> 4 || reg[3 + i * 4] & 0x0f || reg[0x23 + i * 4] >> 4;
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
 *	Sound Test 3
 *
 */

const key = [];
let PRG, SND;

read('polepos2.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG = Uint8Array.concat(...['pp4_9.6h', 'pp4_10.5h'].map(e => zip.decompress(e))).addBase();
	SND = zip.decompress('pp1-5.3b');
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Int32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	game = new SoundTest();
	sound = new PolePositionSound({SND});
	init({game, sound});
});

