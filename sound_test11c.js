/*
 *
 *	Sound Test 11c
 *
 */

import YM2151 from './ym2151.js';
import C30 from './c30.js';
import {Timer} from './utils.js';
import {init, expand} from './sound_test_main.js';
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
	nSound = 1;
	command = [];

	ram3 = new Uint8Array(0xd00).addBase();
	mcu_irq = false;

	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;

	mcu = new MC6801(Math.floor(49152000 / 8 / 4));
	timer = new Timer(60);

	constructor() {
		// CPU周りの初期化
		this.mcu.memorymap[0].base = this.ram3.base[0];
		this.mcu.memorymap[0].read = (addr) => {
			let data;
			switch (addr) {
			case 8:
				return data = this.ram3[8], this.ram3[8] &= ~0xe0, data;
			}
			return this.ram3[addr];
		};
		this.mcu.memorymap[0].write = null;
		for (let i = 0; i < 4; i++) {
			this.mcu.memorymap[0x10 + i].read = (addr) => { return sound[1].read(addr); };
			this.mcu.memorymap[0x10 + i].write = (addr, data) => { sound[1].write(addr, data); };
		}
		for (let i = 0; i < 0x0c; i++) {
			this.mcu.memorymap[0x14 + i].base = this.ram3.base[1 + i];
			this.mcu.memorymap[0x14 + i].write = null;
		}
		for (let i = 0; i < 0x20; i++)
			this.mcu.memorymap[0x20 + i].base = PRG3.base[0x20 + i];
		this.mcu.memorymap[0x60].read = (addr) => { return addr === 0x6001 ? sound[0].status : 0xff; };
		this.mcu.memorymap[0x60].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				return void(sound[0].addr = data);
			case 1:
				return sound[0].write(data);
			}
		};
		for (let i = 0; i < 0x40; i++)
			this.mcu.memorymap[0x80 + i].base = PRG3.base[0x40 + i];
		for (let i = 0; i < 0x10; i++)
			this.mcu.memorymap[0xf0 + i].base = PRG3I.base[i];

		this.mcu.check_interrupt = () => { return this.mcu_irq && this.mcu.interrupt() ? (this.mcu_irq = false, true) : (this.ram3[8] & 0x48) === 0x48 && this.mcu.interrupt('ocf'); };
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.mcu.execute(tick_rate);
			this.timer.execute(tick_rate, () => { update(), this.mcu_irq = true, this.ram3[8] |= this.ram3[8] << 3 & 0x40; });
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
		if (this.command.length) {
			if (!this.command[0]) {
				for (let i = 0; i < 0x41; i++)
					sound[1].write(0x285 + i, 0);
				sound[1].write(0x380, 0);
			} else if (this.command[0] < 16)
				sound[1].write(0x380, this.command[0]);
			else if (this.command[0] < 40)
				sound[1].write(0x285 + this.command[0] - 16, 1);
			this.command.shift();
		}

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.nSound = 1;
			this.command.splice(0);
			this.mcu_irq = false;
			this.mcu.reset();
		}
		return this;
	}

	updateInput() {
		return this;
	}

	right(fDown = false) {
		if (fDown)
			return this;
		if (++this.nSound >= 40)
			this.nSound = 1;
		return this;
	}

	left(fDown = false) {
		if (fDown)
			return this;
		if (--this.nSound <= 0)
			this.nSound = 39;
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
				SoundTest.Xfer28x16(this.bitmap, 28 * j + 256 * 16 * i, key[0]);

		for (let i = 0; i < 8; i++) {
			const kc = sound[0].reg[0x28 + i], pitch = (kc >> 4 & 7) * 12 + (kc >> 2 & 3) * 3 + (kc & 3);
			if (!sound[0].kon[i] || pitch < 0 || pitch >= 12 * 8)
				continue;
			SoundTest.Xfer28x16(this.bitmap, 28 * Math.floor(pitch / 12) + 256 * 16 * i, key[pitch % 12 + 1]);
		}

		const reg = [];
		for (let i = 0; i < 0x40; i++)
			reg[i] = sound[1].read(0x100 + i);

		for (let i = 0; i < 8; i++) {
			const vol = reg[i * 8] & 0x0f;
			if (!vol)
				continue;
			if (i < 4 && reg[-4 + i * 8 & 0x3f] & 0x80)
				SoundTest.Xfer28x16(this.bitmap, 256 * 16 * (8 + i), key[1]);
			else {
				const freq = reg[3 + i * 8] | reg[2 + i * 8] << 8 | reg[1 + i * 8] << 16 & 0xf0000;
				const pitch = Math.floor(Math.log2(freq * 24000 / (1 << 20) / 440) * 12 + 45.5);
				if (pitch < 0 || pitch >= 12 * 8)
					continue;
				SoundTest.Xfer28x16(this.bitmap, 28 * Math.floor(pitch / 12) + 256 * 16 * (8 + i), key[pitch % 12 + 1]);
			}
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
 *	Sound Test 11c
 *
 */

import {ROM} from "./dist/the_return_of_ishtar.png.js";
const key = [];
let PRG3, PRG3I;

window.addEventListener('load', () => expand(ROM).then(ROM => {
	PRG3 = new Uint8Array(ROM.buffer, 0x5f420, 0x8000).addBase();
	PRG3I = new Uint8Array(ROM.buffer, 0x67420, 0x1000).addBase();
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Int32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	game = new SoundTest();
	sound = [
		new YM2151({clock: 3579580}),
		new C30(),
	];
	init({game, sound});
}));

