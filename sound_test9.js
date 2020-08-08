/*
 *
 *	Sound Test 9
 *
 */

import YM2151 from './ym2151.js';
import SegaPCM from './sega_pcm.js';
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
		this.nSound = 0;

		// CPU周りの初期化
		this.ram = new Uint8Array(0x800).addBase();
		this.fm = {addr: 0, reg: new Uint8Array(0x100), kon: new Uint8Array(8), status: 0, timera: 0, timerb: 0};
		this.count = 0;
		this.command = [];

		this.cpu = new Z80(this);
		for (let i = 0; i < 0x80; i++)
			this.cpu.memorymap[i].base = PRG3.base[i];
		for (let i = 0; i < 8; i++) {
			this.cpu.memorymap[0xf0 + i].read = addr => sound[1].read(addr);
			this.cpu.memorymap[0xf0 + i].write = (addr, data) => sound[1].write(addr, data, this.count);
		}
		for (let i = 0; i < 8; i++) {
			this.cpu.memorymap[0xf8 + i].base = this.ram.base[i];
			this.cpu.memorymap[0xf8 + i].write = null;
		}
		for (let i = 0; i < 0x100; i++) {
			this.cpu.iomap[i].read = addr => {
				switch (addr >> 6 & 3) {
				case 0:
					return (addr & 1) !== 0 ? this.fm.status : 0xff;
				case 1:
					return this.command.length ? this.command.shift() : 0xff;
				}
				return 0xff;
			};
			this.cpu.iomap[i].write = (addr, data) => {
				if ((addr >> 6 & 3) !== 0)
					return;
				switch (addr & 1) {
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
			}
		}
	}

	execute() {
		for (this.count = 0; this.count < 65; this.count++) { // 4000000 / 60 / 1024
			this.command.length && this.cpu.non_maskable_interrupt();
			this.cpu.execute(128);
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
			this.nSound = 0x81;
			this.command.splice(0);
			this.cpu.reset();
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
		this.command.push(this.nSound, 0, 0, 0, 0, 0, 0, 0);
		return this;
	}

	triggerB(fDown = false) {
		if (fDown)
			return this;
		console.log(`command=0`);
		this.command.push(0, 0, 0, 0, 0, 0, 0, 0);
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
 *	Sound Test 9
 *
 */

const key = [];
const url = 'outrun.zip';
let PRG3, PCM;

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
	PRG3 = new Uint8Array(zip.files['epr-10187.88'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	PCM = zip.files['opr-10193.66'].inflate() + zip.files['opr-10193.66'].inflate() + zip.files['opr-10192.67'].inflate() + zip.files['opr-10192.67'].inflate();
	PCM += zip.files['opr-10191.68'].inflate() + zip.files['opr-10191.68'].inflate() + zip.files['opr-10190.69'].inflate() + zip.files['opr-10190.69'].inflate();
	PCM += zip.files['opr-10189.70'].inflate() + zip.files['opr-10189.70'].inflate() + zip.files['opr-10188.71'].inflate() + zip.files['opr-10188.71'].inflate();
	PCM = new Uint8Array((PCM + '\xff'.repeat(0x20000)).split('').map(c => c.charCodeAt(0)));
	init({
		game: game = new SoundTest(),
		sound: sound = [
			new YM2151({clock: 4000000, resolution: 65}),
			new SegaPCM({PCM, clock: 4000000, resolution: 65}),
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

