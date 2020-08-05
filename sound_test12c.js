/*
 *
 *	Sound Test 12c
 *
 */

import YM2151 from './ym2151.js';
import C30 from './c30.js';
import {dummypage, init, loop, canvas} from './main.js';
import MC6809 from './mc6809.js';
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
		this.nSound = 0;

		// CPU周りの初期化
		this.ram2 = new Uint8Array(0x800).addBase();
		this.ram3 = new Uint8Array(0x2000).addBase();
		this.fm = {addr: 0, reg: new Uint8Array(0x100), kon: new Array(8).fill(false), status: 0, timera: 0, timerb: 0};
		this.count = 0;
		this.bank3 = 0x40;
		this.cpu3_irq = false;

		this.cpu3 = new MC6809(this);
		for (let i = 0; i < 0x40; i++)
			this.cpu3.memorymap[i].base = SND.base[0x40 + i];
		this.cpu3.memorymap[0x40].read = addr => addr === 0x4001 ? this.fm.status : 0xff;
		this.cpu3.memorymap[0x40].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				return void(this.fm.addr = data);
			case 1:
				switch (this.fm.addr) {
				case 8: // KON
					this.fm.kon[data & 7] = (data & 0x78) !== 0;
					break;
				case 0x14: // CSM/F RESET/IRQEN/LOAD
					this.fm.status &= ~(data >> 4 & 3);
					if ((data & ~this.fm.reg[0x14] & 1) !== 0)
						this.fm.timera = this.fm.reg[0x10] << 2 | this.fm.reg[0x11] & 3;
					if ((data & ~this.fm.reg[0x14] & 2) !== 0)
						this.fm.timerb = this.fm.reg[0x12];
					break;
				}
				return sound[0].write(this.fm.addr, this.fm.reg[this.fm.addr] = data, this.count);
			}
		};
		for (let i = 0; i < 8; i++) {
			this.cpu3.memorymap[0x50 + i].read = addr => sound[1].read(addr);
			this.cpu3.memorymap[0x50 + i].write = (addr, data) => sound[1].write(addr, data, this.count);
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
		this.cpu3.memorymap[0xc0].write = (addr, data) => this.bankswitch3(data << 2 & 0x1c0);
		this.cpu3.memorymap[0xe0].write = () => void(this.cpu3_irq = false);

		this.cpu3.check_interrupt = () => this.cpu3_irq && this.cpu3.interrupt() || (this.fm.status & 3) !== 0 && this.cpu3.fast_interrupt();
	}

	bankswitch3(bank) {
		if (bank === this.bank3)
			return;
		if (bank < 0x200)
			for (let i = 0; i < 0x40; i++)
				this.cpu3.memorymap[i].base = SND.base[bank + i];
		else
			for (let i = 0; i < 0x40; i++)
				this.cpu3.memorymap[i].base = dummypage;
		this.bank3 = bank;
	}

	execute() {
		this.cpu3_irq = true;
		for (this.count = 0; this.count < 58; this.count++) { // 3579580 / 60 / 1024
			this.cpu3.execute(146);
			if ((this.fm.reg[0x14] & 1) !== 0 && (this.fm.timera += 16) >= 0x400) {
				this.fm.timera = (this.fm.timera & 0x3ff) + (this.fm.reg[0x10] << 2 | this.fm.reg[0x11] & 3);
				this.fm.status |= this.fm.reg[0x14] >> 2 & 1;
			}
			if ((this.fm.reg[0x14] & 2) !== 0 && ++this.fm.timerb >= 0x100) {
				this.fm.timerb = (this.fm.timerb & 0xff) + this.fm.reg[0x12];
				this.fm.status |= this.fm.reg[0x14] >> 2 & 2;
			}
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
			this.nSound = 0;
			this.cpu3_irq = false;
			this.bankswitch3(0x40);
			this.cpu3.reset();
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
		this.nSound = this.nSound + 1;
		if (this.nSound >= 0x140)
			this.nSound = 0;
		return this;
	}

	down() {
		return this;
	}

	left(fDown = false) {
		if (fDown)
			return this;
		this.nSound = this.nSound - 1;
		if (this.nSound < 0)
			this.nSound = 0x13f;
		return this;
	}

	triggerA(fDown = false) {
		if (fDown)
			return this;
		for (let i = 0; i < 0x80; i++)
			sound[1].write(0x240 + i, 0);
		this.ram2[0x101] = 0;
		this.ram2.set([0, 1, 0, 0, 0, 0, 0, 0], 0x30);
		this.ram2[0x2f] = 8;
		this.ram2[0x13] = 0;
		this.ram2[0x38] = 0;
		console.log(`command=$${this.nSound.toString(16)}`);
		if (this.nSound < 0x100) {
			this.ram2[0x100] = this.nSound;
			this.ram2[0x101] = 0x40;
			this.ram2[0x38] = 1;
		}
		else if (this.nSound < 0x140)
			sound[1].write(0x240 + this.nSound - 0x100, 1);
		return this;
	}

	triggerB(fDown = false) {
		if (fDown)
			return this;
		for (let i = 0; i < 0x80; i++)
			sound[1].write(0x240 + i, 0);
		this.ram2[0x101] = 0;
		this.ram2.set([0, 1, 0, 0, 0, 0, 0, 0], 0x30);
		this.ram2[0x2f] = 8;
		this.ram2[0x13] = 0;
		this.ram2[0x38] = 0;
		return this;
	}

	makeBitmap(data) {
		for (let i = 0; i < 16; i++)
			for (let j = 0; j < 8; j++)
				SoundTest.Xfer28x16(data, 28 * j + 256 * 16 * i, key[0]);

		for (let i = 0; i < 8; i++) {
			if (!this.fm.kon[i])
				continue;
			const kc = this.fm.reg[0x28 + i];
			SoundTest.Xfer28x16(data, 28 * (kc >> 4 & 7) + 256 * 16 * i, key[(kc >> 2 & 3) * 3 + (kc & 3) + 1]);
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
				const pitch = Math.floor(Math.log2(freq * 48000 / (1 << 21) / 440) * 12 + 45.5);
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
 *	Sound Test 12c
 *
 */

const key = [];
const url = 'galaga88.zip';
let SND;

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
	SND = new Uint8Array((zip.files['g81_s0.bin'].inflate() + zip.files['g81_s1.bin'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	init({
		game: game = new SoundTest(),
		sound: sound = [
			new YM2151({clock: 3579580, resolution: 58, gain: 2}),
			new C30({resolution: 58}),
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

