/*
 *
 *	Sound Test 7
 *
 */

import YM2151 from './ym2151.js';
import K007232 from './k007232.js';
import VLM5030 from './vlm5030.js';
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
		this.nSound = 1;

		// CPU周りの初期化
		this.ram2 = new Uint8Array(0x800).addBase();
		this.fm = {addr: 0, reg: new Uint8Array(0x100), kon: new Array(8).fill(false), status: 0, timera: 0, timerb: 0};
		this.vlm_latch = 0;
		this.vlm_control = 0;
		this.count = 0;
		this.command = [];
		this.wd = 0;

		this.cpu2 = new Z80(this);
		for (let i = 0; i < 0x80; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 8; i++) {
			this.cpu2.memorymap[0x80 + i].base = this.ram2.base[i];
			this.cpu2.memorymap[0x80 + i].write = null;
		}
		this.cpu2.memorymap[0xa0].read = addr => addr === 0xa000 && this.command.length ? this.command.shift() : 0xff;
		this.cpu2.memorymap[0xb0].read = addr => addr < 0xb00e ? sound[1].read(addr, this.count) : 0xff;
		this.cpu2.memorymap[0xb0].write = (addr, data) => addr < 0xb00e && sound[1].write(addr, data, this.count);
		this.cpu2.memorymap[0xc0].read = addr => addr === 0xc001 ? this.fm.status : 0xff;
		this.cpu2.memorymap[0xc0].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				this.fm.addr = data;
				break;
			case 1:
				switch (this.fm.addr) {
				case 8: // KON
					this.fm.kon[data & 7] = (data & 0x78) !== 0;
					break;
				case 0x14: // CSM/F RESET/IRQEN/LOAD
					this.fm.status &= ~(data >>> 4 & 3);
					if ((data & 1) !== 0)
						this.fm.timera = this.fm.reg[0x10] << 2 | this.fm.reg[0x11] & 3;
					if ((data & 2) !== 0)
						this.fm.timerb = this.fm.reg[0x12];
					break;
				}
				sound[0].write(this.fm.addr, this.fm.reg[this.fm.addr] = data, this.count);
				break;
			}
		};
		this.cpu2.memorymap[0xd0].write = (addr, data) => addr === 0xd000 && (this.vlm_latch = data);
		this.cpu2.memorymap[0xe0].read = addr => addr === 0xe000 ? this.wd ^= 1 : 0xff;
		this.cpu2.memorymap[0xf0].write = (addr, data) => {
			if (addr === 0xf000) {
				if ((~data & this.vlm_control & 1) !== 0)
					sound[2].rst(this.vlm_latch);
				if ((~data & this.vlm_control & 2) !== 0)
					sound[2].st(this.vlm_latch);
				this.vlm_control = data;
			}
		};
	}

	execute() {
		for (this.count = 0; this.count < 58; this.count++) { // 14318180 / 4 / 60 / 1024
			this.command.length && this.cpu2.interrupt();
			this.cpu2.execute(146);
			if ((this.fm.reg[0x14] & 1) !== 0 && (this.fm.timera += 16) >= 0x400) {
				this.fm.timera = (this.fm.timera & 0x3ff) + (this.fm.reg[0x10] << 2 | this.fm.reg[0x11] & 3);
				this.fm.status |= this.fm.reg[0x14] >>> 2 & 1;
			}
			if ((this.fm.reg[0x14] & 2) !== 0 && ++this.fm.timerb >= 0x100) {
				this.fm.timerb = (this.fm.timerb & 0xff) + this.fm.reg[0x12];
				this.fm.status |= this.fm.reg[0x14] >>> 2 & 2;
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
			this.nSound = 1;
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
		for (let i = 0; i < 8; i++)
			for (let j = 0; j < 8; j++)
				SoundTest.Xfer28x16(data, 28 * j + 256 * 16 * i, key[0]);

		for (let i = 8; i < 16; i++)
			for (let j = 0; j < 8; j++)
				SoundTest.Xfer28x16(data, 28 * j + 256 * 16 * i, key[13]);

		for (let i = 0; i < 8; i++) {
			if (!this.fm.kon[i])
				continue;
			const kc = this.fm.reg[0x28 + i];
			SoundTest.Xfer28x16(data, 28 * (kc >>> 4 & 7) + 256 * 16 * i, key[(kc >>> 2 & 3) * 3 + (kc & 3) + 1]);
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
 *	Sound Test 7
 *
 */

const key = [];
const url = 'salamand.zip';
let PRG2, VLM, SND;

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
	PRG2 = new Uint8Array(zip.files['587-d09.11j'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	VLM = new Uint8Array(zip.files['587-d08.8g'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	SND = new Uint8Array(zip.files['587-c01.10a'].inflate().split('').map(c => c.charCodeAt(0)));
	init({
		game: game = new SoundTest(),
		sound: sound = [
			new YM2151({clock: 14318180 / 4, resolution: 58, gain: 10}),
			new K007232({SND, clock: 14318180 / 4, resolution: 58, gain: 0.5}),
			new VLM5030({VLM, clock: 14318180 / 4, gain: 5}),
		],
	});
	canvas.addEventListener('click', () => game.triggerA().right());
	loop();
}

