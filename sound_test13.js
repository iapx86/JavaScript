/*
 *
 *	Sound Test 13
 *
 */

import YM2151 from './ym2151.js';
import K007232 from './k007232.js';
import {init, loop, canvas} from './main.js';
import Z80 from './z80.js';
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
		this.nSound = 0x80;

		// CPU周りの初期化
		this.ram = new Uint8Array(0x800).addBase();
		this.fm = {addr: 0, reg: new Uint8Array(0x100), kon: new Uint8Array(8), status: 0, timera: 0, timerb: 0};
		this.count = 0;
		this.command = [];

		this.cpu3 = new Z80(this);
		for (let i = 0; i < 0x80; i++)
			this.cpu3.memorymap[i].base = PRG3.base[i];
		for (let i = 0; i < 8; i++) {
			this.cpu3.memorymap[0x80 + i].base = this.ram.base[i];
			this.cpu3.memorymap[0x80 + i].write = null;
		}
		this.cpu3.memorymap[0xa0].read = () => this.command.length ? this.command.shift() : 0xff;
		this.cpu3.memorymap[0xb0].read = addr => addr < 0xb00e ? sound[1].read(addr, this.count) : 0xff;
		this.cpu3.memorymap[0xb0].write = (addr, data) => void(addr < 0xb00e && sound[1].write(addr, data, this.count));
		this.cpu3.memorymap[0xc0].read = addr => addr === 0xc001 ? this.fm.status : 0xff;
		this.cpu3.memorymap[0xc0].write = (addr, data) => {
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
		this.cpu3.memorymap[0xf0].read = () => 0;

		this.cpu3.check_interrupt = () => this.command.length && this.cpu3.interrupt();
	}

	execute() {
		for (this.count = 0; this.count < 58; this.count++) { // 3579545 / 60 / 1024
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
			this.nSound = 0x80;
			this.command.splice(0);
			this.cpu3.reset();
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
		if (this.nSound >= 0x100)
			this.nSound = 1;
		return this;
	}

	down() {
		return this;
	}

	left(fDown = false) {
		if (fDown)
			return this;
		this.nSound = this.nSound - 1;
		if (this.nSound < 1)
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
 *	Sound Test 13
 *
 */

const key = [];
const url = 'cuebrick.zip';
let PRG3, SND;

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
	PRG3 = new Uint8Array(zip.files['cuebrickj/903_d03.10a'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	SND = new Uint8Array(0x20000);
	init({
		game: game = new SoundTest(),
		sound: sound = [
			new YM2151({clock: 3579545, resolution: 58, gain: 2}),
			new K007232({SND, clock: 3579545, resolution: 58, gain: 0.2}),
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

