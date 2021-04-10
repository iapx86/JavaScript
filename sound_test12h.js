/*
 *
 *	Sound Test 12h
 *
 */

import YM2151 from './ym2151.js';
import C30 from './c30.js';
import {Timer} from './utils.js';
import {init, read} from './main.js';
import {dummypage} from './cpu.js'
import MC6809 from './mc6809.js';
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
	command = [];

	ram2 = new Uint8Array(0x800).addBase();
	ram3 = new Uint8Array(0x2000).addBase();
	ram4 = new Uint8Array(0x900).addBase();
	bank3 = 0x40;
	bank4 = 0x80;
	cpu3_irq = false;
	mcu_irq = false;

	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);

	cpu3 = new MC6809(Math.floor(49152000 / 32));
	mcu = new MC6801(Math.floor(49152000 / 8 / 4));
	timer = new Timer(60);
	timer2 = new Timer(Math.floor(49152000 / 8 / 1024));

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x40; i++)
			this.cpu3.memorymap[i].base = SND.base[0x40 + i];
		this.cpu3.memorymap[0x40].read = (addr) => { return addr === 0x4001 ? sound[0].status : 0xff; };
		this.cpu3.memorymap[0x40].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				return void(sound[0].addr = data);
			case 1:
				return sound[0].write(data);
			}
		};
		for (let i = 0; i < 8; i++) {
			this.cpu3.memorymap[0x50 + i].read = (addr) => { return sound[1].read(addr); };
			this.cpu3.memorymap[0x50 + i].write = (addr, data) => { sound[1].write(addr, data); };
		}
		for (let i = 0; i < 8; i++) {
			this.cpu3.memorymap[0x70 + i].base = this.ram2.base[i];
			this.cpu3.memorymap[0x70 + i].write = null;
		}
		for (let i = 0; i < 0x20; i++) {
			this.cpu3.memorymap[0x80 + i].base = this.ram3.base[i];
			this.cpu3.memorymap[0x80 + i].write = null;
		}
		for (let i = 0; i < 0x40; i++)
			this.cpu3.memorymap[0xc0 + i].base = SND.base[i];
		this.cpu3.memorymap[0xc0].write = (addr, data) => { this.bankswitch3(data << 2 & 0x1c0); };
		this.cpu3.memorymap[0xe0].write = () => { this.cpu3_irq = false; };

		this.cpu3.check_interrupt = () => { return this.cpu3_irq && this.cpu3.interrupt() || sound[0].irq && this.cpu3.fast_interrupt(); };

		this.mcu.memorymap[0].base = this.ram4.base[0];
		this.mcu.memorymap[0].read = (addr) => {
			let data;
			switch (addr) {
			case 2:
				return 0xf8;
			case 8:
				return data = this.ram4[8], this.ram4[8] &= ~0xe0, data;
			}
			return this.ram4[addr];
		};
		this.mcu.memorymap[0].write = (addr, data) => {
			if (addr === 3) {
				sound[2].v1 = ((data >> 1 & 2 | data & 1) + 1) / 4;
				sound[2].v2 = ((data >> 3 & 3) + 1) / 4;
			}
			this.ram4[addr] = data;
		};
		for (let i = 0; i < 0x80; i++)
			this.mcu.memorymap[0x40 + i].base = VOI.base[0x80 + i];
		for (let i = 0; i < 8; i++) {
			this.mcu.memorymap[0xc0 + i].base = this.ram2.base[i];
			this.mcu.memorymap[0xc0 + i].write = null;
		}
		this.mcu.memorymap[0xc0].write = (addr, data) => { addr === 0xc000 && this.ram2[0] === 0xa6 || (this.ram2[addr & 0xff] = data); };
		for (let i = 0; i < 8; i++) {
			this.mcu.memorymap[0xc8 + i].base = this.ram4.base[1 + i];
			this.mcu.memorymap[0xc8 + i].write = null;
		}
		this.mcu.memorymap[0xd0].write = (addr, data) => { sound[2].d1 = (data - 0x80) / 127; };
		this.mcu.memorymap[0xd4].write = (addr, data) => { sound[2].d2 = (data - 0x80) / 127; };
		this.mcu.memorymap[0xd8].write = (addr, data) => {
			const index = [0xf8, 0xf4, 0xec, 0xdc, 0xbc, 0x7c].indexOf(data & 0xfc);
			this.bankswitch4(index < 0 ? 0 : index ? index << 9 | data << 7 & 0x180 : data << 7 & 0x180 ^ 0x100);
		};
		for (let i = 0; i < 0x10; i++)
			this.mcu.memorymap[0xf0 + i].base = MCU.base[i];
		this.mcu.memorymap[0xf0].write = () => { this.mcu_irq = false; };

		this.mcu.check_interrupt = () => { return this.mcu_irq && this.mcu.interrupt() || (this.ram4[8] & 0x48) === 0x48 && this.mcu.interrupt('ocf'); };
	}

	bankswitch3(bank) {
		if (bank === this.bank3)
			return;
		if (bank < 0x200)
			for (let i = 0; i < 0x40; i++)
				this.cpu3.memorymap[i].base = SND.base[bank | i];
		else
			for (let i = 0; i < 0x40; i++)
				this.cpu3.memorymap[i].base = dummypage;
		this.bank3 = bank;
	}

	bankswitch4(bank) {
		if (bank === this.bank4)
			return;
		if (bank < 0x600)
			for (let i = 0; i < 0x80; i++)
				this.mcu.memorymap[0x40 + i].base = VOI.base[bank | i];
		else
			for (let i = 0; i < 0x80; i++)
				this.mcu.memorymap[0x40 + i].base = dummypage;
		this.bank4 = bank;
	}

	execute(audio, length, fn) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { fn(this.makeBitmap(true)), this.updateStatus(), this.updateInput(); };
		for (let i = 0; i < tick_max; i++) {
			this.cpu3.execute(tick_rate);
			this.mcu.execute(tick_rate);
			this.timer.execute(tick_rate, () => { update(), this.cpu3_irq = this.mcu_irq = true; });
			this.timer2.execute(tick_rate, () => { this.ram4[8] |= this.ram4[8] << 3 & 0x40; });
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
			if (this.command[0] < 0) {
				for (let i = 0; i < 0x80; i++)
					sound[1].write(0x240 + i, 0);
				this.ram2[0x2b] = 0;
				this.ram2[0x2c] = 0x40;
				this.ram2[0x101] = 0;
				this.ram2.set([0, 1, 0, 0, 0, 0, 0, 0], 0x30);
				this.ram2[0x2f] = 8;
				this.ram2[0x13] = 0;
				this.ram2[0x38] = 0;
			} else if (this.command[0] < 0x100) {
				this.ram2[0x100] = this.command[0];
				this.ram2[0x101] = 0x40;
				this.ram2[0x38] = 1;
			} else if (this.command[0] < 0x140)
				sound[1].write(0x240 + this.command[0] - 0x100, 1);
			this.command.shift();
		}

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.nSound = 0;
			this.command.splice(0);
			this.cpu3_irq = this.mcu_irq = false;
			this.bankswitch3(0x40);
			this.bankswitch4(0x80);
			this.cpu3.reset();
			this.mcu.reset();
			sound[1].write(0, 0xa6);
		}
		return this;
	}

	updateInput() {
		return this;
	}

	right(fDown = false) {
		if (fDown)
			return this;
		if (++this.nSound >= 0x140)
			this.nSound = 0;
		return this;
	}

	left(fDown = false) {
		if (fDown)
			return this;
		if (--this.nSound < 0)
			this.nSound = 0x13f;
		return this;
	}

	triggerA(fDown = false) {
		if (fDown)
			return this;
		console.log(`command=$${this.nSound.toString(16)}`);
		this.command.push(-1, this.nSound);
		return this;
	}

	triggerB(fDown = false) {
		if (fDown)
			return this;
		this.command.push(-1);
		return this;
	}

	makeBitmap(flag) {
		if (!flag)
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
				const pitch = Math.floor(Math.log2(freq * 12000 / (1 << 20) / 440) * 12 + 45.5);
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
 *	Sound Test 12h
 *
 */

const key = [];
let SND, MCU, VOI;

read('shadowld.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	SND = Uint8Array.concat(...['yd1_s0.bin', 'yd1_s1.bin'].map(e => zip.decompress(e))).addBase();
	MCU = zip.decompress('cus64-64a1.mcu').addBase();
	VOI = Uint8Array.concat(...['yd_voi-0.bin', 'yd_voi-1.bin', 'yd_voi-2.bin'].map(e => zip.decompress(e))).addBase();
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Int32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	game = new SoundTest();
	sound = [
		new YM2151({clock: 3579580, gain: 1.4}),
		new C30({clock: Math.floor(49152000 / 2048)}),
		{output: 0, gain: 0.5, d1: 0, d2: 0, v1: 0, v2: 0, update() { this.output = (this.d1 * this.v1 + this.d2 * this.v2) * this.gain; }}, // DAC
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

