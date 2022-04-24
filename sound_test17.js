/*
 *
 *	Sound Test 17
 *
 */

import YM2203 from './ym2203.js';
import SegaPCM from './sega_pcm.js';
import {Timer} from './utils.js';
import {init, expand} from './sound_test_main.js';
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

	ram = new Uint8Array(0x800).addBase();
	command = [];
	cpu_command = 0xff;
	cpu_nmi = false;

	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;

	cpu = new Z80(Math.floor(8000000 / 2));
	timer = new Timer(60);

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x80; i++)
			this.cpu.memorymap[i].base = PRG3.base[i];
		for (let i = 0; i < 0x10; i++) {
			this.cpu.memorymap[0xc0 + i].base = this.ram.base[i & 7];
			this.cpu.memorymap[0xc0 + i].write = null;
		}
		for (let i = 0; i < 0x10; i++) {
			this.cpu.memorymap[0xd0 + i].read = (addr) => { return ~addr & 1 ? sound[0].status : sound[0].read(); };
			this.cpu.memorymap[0xd0 + i].write = (addr, data) => { ~addr & 1 ? void(sound[0].addr = data) : sound[0].write(data); };
		}
		for (let i = 0; i < 0x10; i++) {
			this.cpu.memorymap[0xe0 + i].read = (addr) => { return sound[1].read(addr); };
			this.cpu.memorymap[0xe0 + i].write = (addr, data) => { sound[1].write(addr, data); };
		}
		for (let i = 0; i < 0x100; i++)
			this.cpu.iomap[i].read = (addr) => { return (addr >> 6 & 3) === 1 ? this.cpu_command : 0xff; };

		this.cpu.check_interrupt = () => { return this.cpu_nmi && (this.cpu_nmi = false, this.cpu.non_maskable_interrupt()); };
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.timer.execute(tick_rate, update);
			sound[0].execute(tick_rate);
			sound[1].execute(tick_rate);
			audio.execute(tick_rate);
		}
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// コマンド処理
		if (this.command.length && !this.cpu_nmi)
			this.cpu_command = this.command.shift(), this.cpu_nmi = true;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.nSound = 0xaa;
			this.command.splice(0);
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

	makeBitmap(flag) {
		if (!(this.updated = flag))
			return this.bitmap;

		for (let i = 0; i < 16; i++)
			for (let j = 0; j < 8; j++)
				SoundTest.Xfer28x16(this.bitmap, 28 * j + 256 * 16 * i, key[i < 6 ? 0 : 13]);

		for (let i = 0; i < 3; i++) {
			const b = sound[0].reg[0xa4 + i] >> 3 & 7, f = sound[0].reg[0xa0 + i] | sound[0].reg[0xa4 + i] << 8 & 0x700;
			const pitch = Math.floor(Math.log2(8000000 / 2 / 12 / 6 * f * Math.pow(2, b - 1) / 0x100000 / 440) * 12 + 45.5);
			if (!sound[0].kon[i] || pitch < 0 || pitch >= 12 * 8)
				continue;
			SoundTest.Xfer28x16(this.bitmap, 28 * Math.floor(pitch / 12) + 256 * 16 * i, key[pitch % 12 + 1]);
		}
		for (let i = 0; i < 3; i++) {
			const vol = sound[0].reg[8 + i] & 0x1f;
			if (!vol)
				continue;
			const freq = sound[0].reg[i * 2] | sound[0].reg[i * 2 + 1] << 8;
			const pitch = Math.floor(Math.log2(8000000 / 2 / 8 / 4 / (freq ? freq : 1) / 440) * 12 + 45.5);
			if (pitch < 0 || pitch >= 12 * 8)
				continue;
			SoundTest.Xfer28x16(this.bitmap, 28 * Math.floor(pitch / 12) + 256 * 16 * (i + 3), key[pitch % 12 + 1]);
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
 *	Sound Test 17
 *
 */

import {ROM} from "./dist/space_harrier.png.js";
const key = [];
let PRG3, PCM;

window.addEventListener('load', () => expand(ROM).then(ROM => {
	PRG3 = new Uint8Array(ROM.buffer, 0x0, 0x8000).addBase();
	PCM = new Uint8Array(ROM.buffer, 0x8000, 0x10000);
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Int32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	game = new SoundTest();
	sound = [
		new YM2203({clock: Math.floor(8000000 / 2)}),
		new SegaPCM({PCM, clock: 8000000}),
	];
	init({game, sound});
}));

