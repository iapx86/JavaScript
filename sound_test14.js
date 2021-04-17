/*
 *
 *	Sound Test 14
 *
 */

import YM2151 from './ym2151.js';
import K054539 from './k054539.js';
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
	nSound = 0x80;

	ram2 = new Uint8Array(0x2000).addBase();
	command = [];
	bank = 0x80;

	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;

	cpu2 = new Z80(Math.floor(32000000 / 4));
	timer = new Timer(60);

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0xc0; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 0x20; i++) {
			this.cpu2.memorymap[0xc0 + i].base = this.ram2.base[i];
			this.cpu2.memorymap[0xc0 + i].write = null;
		}
		for (let i = 0; i < 3; i++) {
			this.cpu2.memorymap[0xe0 + i].read = (addr) => { return sound[1].read(addr); };
			this.cpu2.memorymap[0xe0 + i].write = (addr, data) => { sound[1].write(addr, data); };
		}
		this.cpu2.memorymap[0xec].read = (addr) => { return addr === 0xec01 ? sound[0].status : 0xff; };
		this.cpu2.memorymap[0xec].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				return void(sound[0].addr = data);
			case 1:
				return sound[0].write(data);
			}
		};
		this.cpu2.memorymap[0xf0].read = (addr) => {
			switch (addr & 0xff) {
			case 2:
				return this.command.length ? this.command.shift() : 0xff;
			case 3:
				return 0;
			}
			return 0xff;
		};
		this.cpu2.memorymap[0xf8].write = (addr, data) => {
			const _bank = data << 6 & 0x1c0;
			if (_bank !== this.bank) {
				for (let i = 0; i < 0x40; i++)
					this.cpu2.memorymap[0x80 + i].base = PRG2.base[_bank + i];
				this.bank = _bank;
			}
		};

		this.cpu2.check_interrupt = () => { return this.command.length && this.cpu2.interrupt(); };
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu2.execute(tick_rate);
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
		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.nSound = 0x80;
			this.command.splice(0);
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
 *	Sound Test 14
 *
 */

const key = [];
let PRG2, PCM;

read('xexex.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG2 = zip.decompress('xexexj/067jaa05.4e').addBase();
	PCM = Uint8Array.concat(...['067b06.3e', '067b07.1e'].map(e => zip.decompress(e)));
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Int32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	game = new SoundTest();
	sound = [
		new YM2151({clock: 4000000, gain: 2}),
		new K054539({PCM, clock: 18432000, gain: 0.2}),
	];
	init({game, sound});
});

