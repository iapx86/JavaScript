/*
 *
 *	Sound Test 9
 *
 */

import YM2151 from './ym2151.js';
import SegaPCM from './sega_pcm.js';
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

	ram = new Uint8Array(0x800).addBase();
	command = [];
	cpu = new Z80(Math.floor(16000000 / 4));

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
					return this.command.length ? this.command.shift() : 0xff;
				}
				return 0xff;
			};
			this.cpu.iomap[i].write = (addr, data) => { addr >> 6 & 3 ? void(0) : ~addr & 1 ? void(sound[0].addr = data) : sound[0].write(data); };
		}
	}

	execute(audio, rate_correction) {
		const tick_rate = 384000, tick_max = Math.floor(tick_rate / 60);
		this.command.length && this.cpu.non_maskable_interrupt();
		for (let i = 0; i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			sound[0].execute(tick_rate);
			sound[1].execute(tick_rate, rate_correction);
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

	makeBitmap(data) {
		for (let i = 0; i < 16; i++)
			for (let j = 0; j < 8; j++)
				SoundTest.Xfer28x16(data, 28 * j + 256 * 16 * i, key[i < 8 ? 0 : 13]);

		for (let i = 0; i < 8; i++) {
			const kc = sound[0].reg[0x28 + i], pitch = (kc >> 4 & 7) * 12 + (kc >> 2 & 3) * 3 + (kc & 3) + 2;
			if (!sound[0].kon[i] || pitch < 0 || pitch >= 12 * 8)
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
 *	Sound Test 9
 *
 */

const key = [];
let PRG3, PCM;

read('outrun.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG3 = zip.decompress('epr-10187.88').addBase();
	PCM = Uint8Array.concat(...['opr-10193.66', 'opr-10193.66', 'opr-10192.67', 'opr-10192.67', 'opr-10191.68'].map(e => zip.decompress(e)));
	PCM = Uint8Array.concat(PCM, ...['opr-10191.68', 'opr-10190.69', 'opr-10190.69', 'opr-10189.70', 'opr-10189.70'].map(e => zip.decompress(e)));
	PCM = Uint8Array.concat(PCM, ...['opr-10188.71', 'opr-10188.71'].map(e => zip.decompress(e)), new Uint8Array(0x20000).fill(0xff));
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Uint32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	game = new SoundTest();
	sound = [
		new YM2151({clock: 16000000 / 4}),
		new SegaPCM({PCM, clock: 16000000 / 4}),
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

