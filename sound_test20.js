/*
 *
 *	Sound Test 20
 *
 */

import YM2203 from './ym2203.js';
import MSM5205 from './msm5205.js';
import {seq, Timer} from './utils.js';
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
	nSound = 0;

	fNmiEnable = false;

	ram = new Uint8Array(0x1000).addBase();
	bank = 0x40;
	ciu = {status: 0, mode: 0, data: new Uint8Array(2), nmi: false};
	command = [];
	cpu2_nmi = false;
	cpu4_command = 0xff;
	cpu4_nmi = false;

	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;

	cpu2 = new Z80(Math.floor(8000000 / 2));
	cpu4 = new Z80(Math.floor(8000000 / 2));
	timer = new Timer(60);

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x80; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 0x10; i++) {
			this.cpu2.memorymap[0x80 + i].base = this.ram.base[i];
			this.cpu2.memorymap[0x80 + i].write = null;
		}
		this.cpu2.memorymap[0x90].read = (addr) => {
			switch (addr) {
			case 0x9000:
				return sound[0].status;
			case 0x9001:
				return sound[0].read();
			}
			return 0xff;
		};
		this.cpu2.memorymap[0x90].write = (addr, data) => {
			switch (addr) {
			case 0x9000:
				return void(sound[0].addr = data);
			case 0x9001:
				return sound[0].write(data);
			}
		};
		this.cpu2.memorymap[0xa0].read = (addr) => {
			switch (addr) {
			case 0xa000:
				return sound[1].status;
			case 0xa001:
				return sound[1].read();
			}
			return 0xff;
		};
		this.cpu2.memorymap[0xa0].write = (addr, data) => {
			switch (addr) {
			case 0xa000:
				return void(sound[1].addr = data);
			case 0xa001:
				return sound[1].write(data);
			}
		};
		this.cpu2.memorymap[0xb0].read = (addr) => {
			if (addr === 0xb001)
				switch (this.ciu.mode) {
				case 0:
					return ++this.ciu.mode, this.ciu.data[0] & 15;
				case 1:
					return this.ciu.status &= ~1, ++this.ciu.mode, this.ciu.data[0] >> 4;
				case 2:
					return ++this.ciu.mode, this.ciu.data[1] & 15;
				case 3:
					return this.ciu.status &= ~2, ++this.ciu.mode, this.ciu.data[1] >> 4;
				case 4:
					return this.ciu.status;
				}
			return 0xff;
		};
		this.cpu2.memorymap[0xb0].write = (addr, data) => {
			switch (addr) {
			case 0xb000:
				return void(this.ciu.mode = data & 15);
			case 0xb001:
				switch (this.ciu.mode) {
				case 0: case 2:
					return void(++this.ciu.mode);
				case 1:
					return this.ciu.status |= 4, void(++this.ciu.mode);
				case 3:
					return this.ciu.status |= 8, void(++this.ciu.mode);
				case 5:
					return this.cpu2_nmi = false, void(this.ciu.nmi = false);
				case 6:
					return this.cpu2_nmi = (this.ciu.status & 3) !== 0, void(this.ciu.nmi = true);
				}
			}
		};
		this.cpu2.memorymap[0xd4].write = (addr, data) => { addr === 0xd400 && (this.cpu4_command = data); };
		this.cpu2.memorymap[0xdc].write = (addr, data) => {
			const _bank = data << 6 & 0xc0;
			if (addr === 0xdc00 && _bank !== this.bank) {
				for (let i = 0; i < 0x40; i++)
					this.cpu2.memorymap[0x40 + i].base = PRG2.base[_bank + i];
				this.bank = _bank;
			}
		};

		this.cpu2.check_interrupt = () => { return this.cpu2_nmi ? (this.cpu2_nmi = false, this.cpu2.non_maskable_interrupt()) : sound[0].irq && this.cpu2.interrupt(); };

		for (let i = 0; i < 0x100; i++)
			this.cpu4.memorymap[i].base = PRG4.base[i];
		for (let i = 0; i < 0x100; i++) {
			this.cpu4.iomap[i].read = (addr) => {
				switch (addr & 0xff) {
				case 0:
					return this.cpu4_command;
				case 2: case 3:
					return 0;
				}
				return 0xff;
			};
			this.cpu4.iomap[i].write = (addr, data) => {
				switch (addr & 0xff) {
				case 0:
					return void(this.fNmiEnable = false);
				case 1:
					return void(this.fNmiEnable = true);
				case 2:
					return data & 0x20 ? sound[2].start() : sound[2].stop(), sound[2].write(data & 15);
				}
			};
		}

		this.cpu4.check_interrupt = () => { return this.cpu4_nmi && (this.cpu4_nmi = false, this.cpu4.non_maskable_interrupt()); };
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu2.execute(tick_rate);
			this.cpu4.execute(tick_rate);
			this.timer.execute(tick_rate, update);
			sound[0].execute(tick_rate);
			sound[1].execute(tick_rate);
			sound[2].execute(tick_rate, () => { this.cpu4_nmi = this.fNmiEnable; });
			audio.execute(tick_rate);
		}
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// コマンド処理
		if (this.command.length && ~this.ciu.status & 1)
			this.ciu.data[0] = this.command.shift(), this.ciu.status |= 1, this.cpu2_nmi = this.ciu.nmi;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.nSound = 6;
			this.command.splice(0, this.command.length, 0xef, 0);
			this.cpu2.reset();
			this.cpu4.reset();
		}
		return this;
	}

	updateInput() {
		return this;
	}

	right(fDown = false) {
		if (fDown)
			return this;
		if (++this.nSound > 0xff)
			this.nSound = 0;
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
		this.command.push(this.nSound);
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
				SoundTest.Xfer28x16(this.bitmap, 28 * j + 256 * 16 * i, key[i < 12 ? 0 : 13]);

		for (let i = 0; i < 2; i++) {
			for (let j = 0; j < 3; j++) {
				const b = sound[i].reg[0xa4 + j] >> 3 & 7, f = sound[i].reg[0xa0 + j] | sound[i].reg[0xa4 + j] << 8 & 0x700;
				const pitch = Math.floor(Math.log2(8000000 / 2 / 12 / 6 * f * Math.pow(2, b - 1) / 0x100000 / 440) * 12 + 45.5);
				if (!sound[i].kon[j] || pitch < 0 || pitch >= 12 * 8)
					continue;
				SoundTest.Xfer28x16(this.bitmap, 28 * Math.floor(pitch / 12) + 256 * 16 * (i * 6 + j), key[pitch % 12 + 1]);
			}
			for (let j = 0; j < 3; j++) {
				const vol = sound[i].reg[8 + j] & 0x1f;
				if (!vol)
					continue;
				const freq = sound[i].reg[j * 2] | sound[i].reg[j * 2 + 1] << 8;
				const pitch = Math.floor(Math.log2(8000000 / 2 / 8 / 4 / (freq ? freq : 1) / 440) * 12 + 45.5);
				if (pitch < 0 || pitch >= 12 * 8)
					continue;
				SoundTest.Xfer28x16(this.bitmap, 28 * Math.floor(pitch / 12) + 256 * 16 * (i * 6 + j + 3), key[pitch % 12 + 1]);
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

function sound_update() {
	const reg = this.reg;
	this.output = this.output0[0] / 65536 * (reg[14] & 15) / 15 * 0.5;
	const etype = reg[13], evol = (~this.step ^ ((((etype ^ etype >> 1) & this.step >> 5 ^ ~etype >> 2) & 1) - 1)) & (~etype >> 3 & this.step >> 5 & 1) - 1 & 31;
	this.channel.forEach((ch, i) => {
		const state = ((!ch.freq | reg[7] >> i | ch.output) & (reg[7] >> i + 3 | this.rng) & 1) * 2 - 1;
		this.output += state * vol[reg[8 + i] >> 4 & 1 ? evol : reg[8 + i] << 1 & 30 | 1] * [reg[14] >> 4, reg[15] >> 4, reg[15] & 15][i] / 15 * 0.03;
	});
}

/*
 *
 *	Sound Test 20
 *
 */

const key = [];
const vol = Float64Array.from(seq(32), i => i > 1 ? Math.pow(10, (i - 31) / 20) : 0);
let PRG2, PRG4;

read('darius.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG2 = zip.decompress('a96_57.33').addBase();
	PRG4 = zip.decompress('a96_56.18').addBase();
	const tmp = Object.assign(document.createElement('canvas'), {width: 28, height: 16});
	const img = document.getElementsByTagName('img');
	for (let i = 0; i < 14; i++) {
		tmp.getContext('2d').drawImage(img['key' + i], 0, 0);
		key.push(new Int32Array(tmp.getContext('2d').getImageData(0, 0, 28, 16).data.buffer));
	}
	game = new SoundTest();
	sound = [
		new YM2203({clock: Math.floor(8000000 / 2)}),
		new YM2203({clock: Math.floor(8000000 / 2)}),
		new MSM5205(),
	];
	sound[0].update = sound[1].update = sound_update;
	init({game, sound});
});

