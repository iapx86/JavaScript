/*
 *
 *	Sound Test 5a
 *
 */

import AY_3_8910 from './ay-3-8910.js';
import K005289 from './k005289.js';
import VLM5030 from './vlm5030.js';
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
	nSound = 1;

	ram2 = new Uint8Array(0x4000).addBase();
	vlm = new Uint8Array(0x800).addBase();
	psg = [{addr: 0}, {addr: 0}];
	scc = {freq0: 0, freq1: 0, reg0: 0, reg1: 0};
	vlm_latch = 0;
	count = 0;
	timer = 0;
	command = [];
	cpu2 = new Z80();

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x20; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 0x40; i++) {
			this.cpu2.memorymap[0x40 + i].base = this.ram2.base[i];
			this.cpu2.memorymap[0x40 + i].write = null;
		}
		for (let i = 0; i < 8; i++) {
			this.cpu2.memorymap[0x80 + i].base = this.vlm.base[i];
			this.cpu2.memorymap[0x80 + i].write = null;
		}
		for (let i = 0; i < 0x10; i++) {
			this.cpu2.memorymap[0xa0 + i].write = (addr) => { this.scc.freq0 = ~addr & 0xfff; };
			this.cpu2.memorymap[0xc0 + i].write = (addr) => { this.scc.freq1 = ~addr & 0xfff; };
		}
		this.cpu2.memorymap[0xe0].read = (addr) => {
			switch (addr & 0xff) {
			case 1:
				return this.command.length ? this.command.shift() : 0xff;
			case 0x86:
				return sound[0].read(this.psg[0].addr);
			}
			return 0xff;
		};
		this.cpu2.memorymap[0xe0].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				return void(this.vlm_latch = data);
			case 3:
				return sound[2].write(2, this.scc.freq0, this.count);
			case 4:
				return sound[2].write(3, this.scc.freq1, this.count);
			case 5:
				return void(this.psg[1].addr = data);
			case 6:
				return void(this.psg[0].addr = data);
			case 0x30:
				return sound[3].st(this.vlm_latch);
			}
		};
		this.cpu2.memorymap[0xe1].write = (addr, data) => { addr === 0xe106 && this.psg[0].addr !== 0xe && sound[0].write(this.psg[0].addr, data, this.count); };
		this.cpu2.memorymap[0xe2].read = (addr) => { return addr === 0xe205 ? sound[1].read(this.psg[1].addr) : 0xff; };
		this.cpu2.memorymap[0xe4].write = (addr, data) => {
			if (addr === 0xe405) {
				if (this.psg[1].addr === 0xe)
					sound[2].write(0, this.scc.reg0 = data, this.count);
				if (this.psg[1].addr === 0xf)
					sound[2].write(1, this.scc.reg1 = data, this.count);
				sound[1].write(this.psg[1].addr, data, this.count);
			}
		};
	}

	execute() {
		for (this.count = 0; this.count < 58; this.count++) { // 14318180 / 4 / 60 / 1024
			this.command.length && this.cpu2.interrupt();
			sound[0].write(0x0e, this.timer & 0x2f | sound[3].BSY << 5 | 0xd0);
			this.cpu2.execute(146);
			this.timer = this.timer + 1 & 0xff;
		}
		this.cpu2.non_maskable_interrupt();
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
			this.timer = 0;
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

	makeBitmap(data) {
		for (let i = 0; i < 16; i++)
			for (let j = 0; j < 8; j++)
				SoundTest.Xfer28x16(data, 28 * j + 256 * 16 * i, key[i < 8 ? 0 : 13]);

		const reg = [];
		for (let i = 0; i < 0x20; i++)
			reg[i] = sound[i >> 4].read(i & 0xf);

		if (this.scc.freq0 && (this.scc.reg0 & 0xf)) {
			const pitch = Math.floor(Math.log2(14318180 / 4 / 32 / this.scc.freq0 / 440) * 12 + 45.5);
			if (pitch > 0 && pitch < 12 * 8)
				SoundTest.Xfer28x16(data, 28 * Math.floor(pitch / 12), key[pitch % 12 + 1]);
		}
		if (this.scc.freq1 && (this.scc.reg1 & 0xf)) {
			const pitch = Math.floor(Math.log2(14318180 / 4 / 32 / this.scc.freq1 / 440) * 12 + 45.5);
			if (pitch > 0 && pitch < 12 * 8)
				SoundTest.Xfer28x16(data, 28 * Math.floor(pitch / 12) + 256 * 16, key[pitch % 12 + 1]);
		}
		for (let i = 0; i < 6; i++) {
			const vol = reg[[8, 9, 0xa, 0x18, 0x19, 0x1a][i]] & 0x1f;
			if (!vol)
				continue;
			const addr = [0, 2, 4, 0x10, 0x12, 0x14][i];
			const freq = reg[addr] | reg[addr + 1] << 8;
			const pitch = Math.floor(Math.log2(14318180 / 8 / 16 / (freq ? freq : 1) / 440) * 12 + 45.5);
			if (pitch < 0 || pitch >= 12 * 8)
				continue;
			SoundTest.Xfer28x16(data, 28 * Math.floor(pitch / 12) + 256 * 16 * (i + 2), key[pitch % 12 + 1]);
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
 *	Sound Test 5a
 *
 */

const key = [];
let PRG2, SND;

read('twinbee.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG2 = zip.decompress('400-e03.5l').addBase();
	SND = Uint8Array.concat(...['400-a01.fse', '400-a02.fse'].map(e => zip.decompress(e)));
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Uint32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	game = new SoundTest();
	sound = [
		new AY_3_8910({clock: 14318180 / 8, resolution: 58, gain: 0.3}),
		new AY_3_8910({clock: 14318180 / 8, resolution: 58, gain: 0.3}),
		new K005289({SND, clock: 14318180 / 4, resolution: 58, gain: 0.3}),
		new VLM5030({VLM: game.vlm, clock: 14318180 / 4, gain: 5}),
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

