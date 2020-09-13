/*
 *
 *	Sound Test 10b
 *
 */

import YM2151 from './ym2151.js';
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
	nSound = 1;

	ram2 = new Uint8Array(0x1000).addBase();
	fm = {addr: 0, reg: new Uint8Array(0x100), kon: new Uint8Array(8), status: 0, timera: 0, timerb: 0};
	count = 0;
	command = [];
	addr = 0;
	cpu2 = new Z80();

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0xf0; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 0x10; i++) {
			this.cpu2.memorymap[0xf0 + i].base = this.ram2.base[i];
			this.cpu2.memorymap[0xf0 + i].write = null;
		}
		for (let i = 0; i < 0x100; i++) {
			this.cpu2.iomap[i].read = addr => {
				switch (addr & 0xff) {
				case 1:
					return this.fm.status;
				case 0x80:
					return this.command.length ? this.command.shift() : 0xff;
				case 0x84:
					return PCM[this.addr];
				}
				return 0xff;
			};
			this.cpu2.iomap[i].write = (addr, data) => {
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
						if ((data & ~this.fm.reg[0x14] & 1) !== 0)
							this.fm.timera = this.fm.reg[0x10] << 2 | this.fm.reg[0x11] & 3;
						if ((data & ~this.fm.reg[0x14] & 2) !== 0)
							this.fm.timerb = this.fm.reg[0x12];
						break;
					}
					return sound.write(this.fm.addr, this.fm.reg[this.fm.addr] = data, this.count);
				case 0x80:
					return void(this.addr = this.addr & 0xff00 | data);
				case 0x81:
					return void(this.addr = this.addr & 0xff | data << 8);
				case 0x82:
					return void(this.addr = this.addr + 1 & PCM.length - 1);
				}
			};
		}

		this.cpu2.check_interrupt = () => (this.fm.status & 3) !== 0 && this.cpu2.interrupt(0xef);
	}

	execute() {
		if (this.command.length)
			this.cpu2.interrupt(0xdf);
		for (this.count = 0; this.count < 58; this.count++) { // 3579545 / 60 / 1024
			this.cpu2.non_maskable_interrupt();
			this.cpu2.execute(73);
			this.cpu2.non_maskable_interrupt();
			this.cpu2.execute(73);
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
			this.command.splice(0);
			this.cpu2.reset();
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
		if (++this.nSound >= 0x100)
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
			this.nSound = 0xff;
		return this;
	}

	triggerA(fDown = false) {
		if (fDown)
			return this;
		console.log(`command=$${this.nSound.toString(16)}`);
		this.command.push(0x20, this.nSound);
		return this;
	}

	triggerB(fDown = false) {
		if (fDown)
			return this;
		this.command.push(0x20);
		return this;
	}

	makeBitmap(data) {
		for (let i = 0; i < 16; i++)
			for (let j = 0; j < 8; j++)
				SoundTest.Xfer28x16(data, 28 * j + 256 * 16 * i, key[i < 8 ? 0 : 13]);

		for (let i = 0; i < 8; i++) {
			const kc = this.fm.reg[0x28 + i], pitch = (kc >> 4 & 7) * 12 + (kc >> 2 & 3) * 3 + (kc & 3);
			if (!this.fm.kon[i] || pitch < 0 || pitch >= 12 * 8)
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
 *	Sound Test 10b
 *
 */

const key = [];
const url = 'rtype2.zip';
let PRG2, PCM;

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
	PRG2 = new Uint8Array(zip.files['ic17.4f'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	PCM = new Uint8Array(zip.files['ic14.4c'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	game = new SoundTest();
	sound = new YM2151({clock: 3579545, resolution: 58, gain: 2});
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

