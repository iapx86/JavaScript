/*
 *
 *	Sound Test 12a
 *
 */

import YM2151 from './ym2151.js';
import C30 from './c30.js';
import Dac8Bit2Ch from './dac_8bit_2ch.js';
import {dummypage, init, read} from './main.js';
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
	fm = {addr: 0, reg: new Uint8Array(0x100), kon: new Uint8Array(8), status: 0, timera: 0, timerb: 0};
	count = 0;
	bank3 = 0x40;
	bank4 = 0x80;
	cpu3_irq = false;
	mcu_irq = false;
	cpu3 = new MC6809();
	mcu = new MC6801();

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x40; i++)
			this.cpu3.memorymap[i].base = SND.base[0x40 + i];
		this.cpu3.memorymap[0x40].read = (addr) => { return addr === 0x4001 ? this.fm.status : 0xff; };
		this.cpu3.memorymap[0x40].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				return void(this.fm.addr = data);
			case 1:
				switch (this.fm.addr) {
				case 8: // KON
					this.fm.kon[data & 7] = Number((data & 0x78) !== 0);
					break;
				case 0x14: // CSM/F RESET/IRQEN/LOAD
					this.fm.status &= ~(data >> 4 & 3);
					if (data & ~this.fm.reg[0x14] & 1)
						this.fm.timera = this.fm.reg[0x10] << 2 | this.fm.reg[0x11] & 3;
					if (data & ~this.fm.reg[0x14] & 2)
						this.fm.timerb = this.fm.reg[0x12];
					break;
				}
				return sound[0].write(this.fm.addr, this.fm.reg[this.fm.addr] = data, this.count);
			}
		};
		for (let i = 0; i < 8; i++) {
			this.cpu3.memorymap[0x50 + i].read = (addr) => { return sound[1].read(addr); };
			this.cpu3.memorymap[0x50 + i].write = (addr, data) => { sound[1].write(addr, data, this.count); };
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

		this.cpu3.check_interrupt = () => { return this.cpu3_irq && this.cpu3.interrupt() || this.fm.status & 3 && this.cpu3.fast_interrupt(); };

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
				sound[2].channel[0].gain = ((data >> 1 & 2 | data & 1) + 1) / 4;
				sound[2].channel[1].gain = ((data >> 3 & 3) + 1) / 4;
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
		this.mcu.memorymap[0xd0].write = (addr, data) => { sound[2].write(0, data, this.count); };
		this.mcu.memorymap[0xd4].write = (addr, data) => { sound[2].write(1, data, this.count); };
		this.mcu.memorymap[0xd8].write = (addr, data) => {
			const index = [0xf8, 0xf4, 0xec, 0xdc, 0xbc, 0x7c].indexOf(data & 0xfc);
			this.bankswitch4(index > 0 ? index << 9 | data << 7 & 0x180 : index === 0 ? data << 7 & 0x180 ^ 0x100 : 0);
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
		if (bank < 0x200)
			for (let i = 0; i < 0x80; i++)
				this.mcu.memorymap[0x40 + i].base = VOI.base[bank | i];
		else
			for (let i = 0; i < 0x80; i++)
				this.mcu.memorymap[0x40 + i].base = dummypage;
		this.bank4 = bank;
	}

	execute() {
		this.cpu3_irq = this.mcu_irq = true;
		for (this.count = 0; this.count < 29; this.count++) {
			this.cpu3.execute(146);
			if (this.fm.reg[0x14] & 1 && (this.fm.timera += 16) >= 0x400) {
				this.fm.timera = (this.fm.timera & 0x3ff) + (this.fm.reg[0x10] << 2 | this.fm.reg[0x11] & 3);
				this.fm.status |= this.fm.reg[0x14] >> 2 & 1;
			}
			if (this.fm.reg[0x14] & 2 && ++this.fm.timerb >= 0x100) {
				this.fm.timerb = (this.fm.timerb & 0xff) + this.fm.reg[0x12];
				this.fm.status |= this.fm.reg[0x14] >> 2 & 2;
			}
		}
		for (this.count = 0; this.count < 50; this.count++) {
			this.ram4[8] |= this.ram4[8] << 3 & 0x40;
			this.mcu.execute(84);
		}
		for (this.count = 29; this.count < 58; this.count++) { // 3579580 / 60 / 1024
			this.cpu3.execute(146);
			if (this.fm.reg[0x14] & 1 && (this.fm.timera += 16) >= 0x400) {
				this.fm.timera = (this.fm.timera & 0x3ff) + (this.fm.reg[0x10] << 2 | this.fm.reg[0x11] & 3);
				this.fm.status |= this.fm.reg[0x14] >> 2 & 1;
			}
			if (this.fm.reg[0x14] & 2 && ++this.fm.timerb >= 0x100) {
				this.fm.timerb = (this.fm.timerb & 0xff) + this.fm.reg[0x12];
				this.fm.status |= this.fm.reg[0x14] >> 2 & 2;
			}
		}
		for (this.count = 50; this.count < 100; this.count++) {
			this.ram4[8] |= this.ram4[8] << 3 & 0x40;
			this.mcu.execute(84);
		}
		return this;
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
		if (++this.nSound >= 0x140)
			this.nSound = 0;
		return this;
	}

	down() {
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
			if (!vol)
				continue;
			if (i < 4 && (reg[-4 + i * 8 & 0x3f] & 0x80) !== 0)
				SoundTest.Xfer28x16(data, 256 * 16 * (8 + i), key[1]);
			else {
				const freq = reg[3 + i * 8] | reg[2 + i * 8] << 8 | reg[1 + i * 8] << 16 & 0xf0000;
				const pitch = Math.floor(Math.log2(freq * 12000 / (1 << 20) / 440) * 12 + 45.5);
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
 *	Sound Test 12a
 *
 */

const key = [];
let SND, MCU, VOI;

read('pacmania.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	SND = Uint8Array.concat(...['pacmaniaj/pn1_s0.bin', 'pacmaniaj/pn1_s1.bin'].map(e => zip.decompress(e))).addBase();
	MCU = zip.decompress('cus64-64a1.mcu').addBase();
	VOI = Uint8Array.concat(...['pacmaniaj/pn1_v0.bin', 'pacmaniaj/pn1_v0.bin'].map(e => zip.decompress(e))).addBase();
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Uint32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	game = new SoundTest();
	sound = [
		new YM2151({clock: 3579580, resolution: 58, gain: 1.4}),
		new C30({clock: 49152000 / 2048 / 2, resolution: 58}),
		new Dac8Bit2Ch({resolution: 100, gain: 0.5}),
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

