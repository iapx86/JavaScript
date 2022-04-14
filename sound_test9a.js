/*
 *
 *	Sound Test 9a
 *
 */

import YM2151 from './ym2151.js';
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

	cpu = new Z80(Math.floor(16000000 / 4));
	timer = new Timer(60);

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x80; i++)
			this.cpu.memorymap[i].base = PRG3.base[i];
		for (let i = 0; i < 8; i++) {
			this.cpu.memorymap[0xf0 + i].read = (addr) => { return sound[1].read(addr); };
			this.cpu.memorymap[0xf0 + i].write = (addr, data) => { sound[1].write(addr, data); };
		}
		for (let i = 0; i < 8; i++) {
			this.cpu.memorymap[0xf8 + i].base = this.ram.base[i];
			this.cpu.memorymap[0xf8 + i].write = null;
		}
		for (let i = 0; i < 0x100; i++) {
			this.cpu.iomap[i].read = (addr) => {
				switch (addr >> 6 & 3) {
				case 0:
					return addr & 1 ? sound[0].status : 0xff;
				case 1:
					return this.cpu_command;
				}
				return 0xff;
			};
			this.cpu.iomap[i].write = (addr, data) => { addr >> 6 & 3 ? void(0) : ~addr & 1 ? void(sound[0].addr = data) : sound[0].write(data); };
		}

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
			this.nSound = 0x81;
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
		this.command.push(this.nSound, 0, 0, 0, 0, 0, 0, 0);
		return this;
	}

	triggerB(fDown = false) {
		if (fDown)
			return this;
		this.command.push(0, 0, 0, 0, 0, 0, 0, 0);
		return this;
	}

	makeBitmap(flag) {
		if (!(this.updated = flag))
			return this.bitmap;

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
 *	Sound Test 9a
 *
 */

import {ROM} from "./dist/super_hang-on_rom.js";
const key = [];
let PRG3, PCM;

window.addEventListener('load', () => expand(ROM).then(ROM => {
	PRG3 = new Uint8Array(ROM.buffer, 0x0, 0x8000).addBase();
	PCM = new Uint8Array(ROM.buffer, 0x8000, 0x80000);
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Int32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	game = new SoundTest();
	sound = [
		new YM2151({clock: Math.floor(16000000 / 4)}),
		new SegaPCM({PCM, clock: Math.floor(16000000 / 4)}),
	];
	init({game, sound});
}));

