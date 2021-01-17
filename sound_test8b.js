/*
 *
 *	Sound Test 8b
 *
 */

import YM2151 from './ym2151.js';
import UPD7759 from './upd7759.js';
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

	ram2 = new Uint8Array(0x800).addBase();
	fm = {addr: 0, reg: new Uint8Array(0x100), kon: new Uint8Array(8), status: 0, timera: 0, timerb: 0};
	count = 0;
	command = [];
	bank = 0;
	cpu2 = new Z80();

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x80; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 0x40; i++)
			this.cpu2.memorymap[0x80 + i].read = (addr) => { return PRG2[this.bank + addr]; };
		this.cpu2.memorymap[0xe8].read = (addr) => { return addr === 0xe800 && this.command.length ? this.command.shift() : 0xff; };
		for (let i = 0; i < 8; i++) {
			this.cpu2.memorymap[0xf8 + i].base = this.ram2.base[i];
			this.cpu2.memorymap[0xf8 + i].write = null;
		}
		for (let i = 0; i < 0x100; i++) {
			this.cpu2.iomap[i].read = (addr) => {
				switch (addr >> 6 & 3) {
				case 0:
					return addr & 1 ? this.fm.status : 0xff;
				case 2:
					return sound[1].busy() << 7;
				case 3:
					return this.command.length ? this.command.shift() : 0xff;
				}
				return 0xff;
			};
			this.cpu2.iomap[i].write = (addr, data) => {
				switch (addr >> 6 & 3) {
				case 0:
					if (~addr & 1)
						return void(this.fm.addr = data);
					switch (this.fm.addr) {
					case 8: // KON
						this.fm.kon[data & 7] = Number((data & 0x78) !== 0);
						break;
					case 0x14: // CSM/F RESET/IRQEN/LOAD
						this.fm.status &= ~(data >> 4 & 3);
						data & ~this.fm.reg[0x14] & 1 && (this.fm.timera = this.fm.reg[0x10] << 2 | this.fm.reg[0x11] & 3);
						data & ~this.fm.reg[0x14] & 2 && (this.fm.timerb = this.fm.reg[0x12]);
						break;
					}
					return sound[0].write(this.fm.addr, this.fm.reg[this.fm.addr] = data, this.count);
				case 1:
					sound[1].reset(data >> 6 & 1, this.count), sound[1].start(data >> 7, this.count);
					return void(this.bank = data << 14 & 0x1c000);
				case 2:
					return sound[1].write(data, this.count);
				}
			};
		}

		this.cpu2.check_interrupt = () => { return this.command.length && this.cpu2.interrupt(); };
	}

	execute() {
		for (this.count = 0; this.count < 65; this.count++) { // 4000000 / 60 / 1024
			!sound[1].busy() && this.cpu2.non_maskable_interrupt(), this.cpu2.execute(64);
			!sound[1].busy() && this.cpu2.non_maskable_interrupt(), this.cpu2.execute(64);
			if (this.fm.reg[0x14] & 1 && (this.fm.timera += 16) >= 0x400)
				this.fm.status |= this.fm.reg[0x14] >> 2 & 1, this.fm.timera = (this.fm.timera & 0x3ff) + (this.fm.reg[0x10] << 2 | this.fm.reg[0x11] & 3);
			if (this.fm.reg[0x14] & 2 && ++this.fm.timerb >= 0x100)
				this.fm.status |= this.fm.reg[0x14] >> 2 & 2, this.fm.timerb = (this.fm.timerb & 0xff) + this.fm.reg[0x12];
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
			this.nSound = 0x10;
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
		if (++this.nSound >= 0xc0)
			this.nSound = 0x10;
		return this;
	}

	left(fDown = false) {
		if (fDown)
			return this;
		if (--this.nSound < 0x10)
			this.nSound = 0xbf;
		return this;
	}

	triggerA(fDown = false) {
		if (fDown)
			return this;
		console.log(`command=$${this.nSound.toString(16)}`);
		this.command.push(1, this.nSound);
		return this;
	}

	triggerB(fDown = false) {
		if (fDown)
			return this;
		this.command.push(1, 1);
		return this;
	}

	makeBitmap(data) {
		for (let i = 0; i < 16; i++)
			for (let j = 0; j < 8; j++)
				SoundTest.Xfer28x16(data, 28 * j + 256 * 16 * i, key[i < 8 ? 0 : 13]);

		for (let i = 0; i < 8; i++) {
			const kc = this.fm.reg[0x28 + i], pitch = (kc >> 4 & 7) * 12 + (kc >> 2 & 3) * 3 + (kc & 3) + 2;
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
 *	Sound Test 8b
 *
 */

const key = [];
let PRG2;

read('cotton.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG2 = Uint8Array.concat(...['cottonj/epr-13860.a10', 'cottonj/opr-13061.a11'].map(e => zip.decompress(e))).addBase();
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Uint32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	game = new SoundTest();
	sound = [
		new YM2151({clock: 4000000, resolution: 65}),
		new UPD7759({mode: false, resolution: 65}),
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

