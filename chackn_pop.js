/*
 *
 *	Chack'n Pop
 *
 */

import AY_3_8910 from './ay-3-8910.js';
import {seq, rseq, convertGFX, Timer} from './utils.js';
import {init, read} from './main.js';
import Z80 from './z80.js';
import MC6805 from './mc6805.js';
let game, sound;

class ChacknPop {
	cxScreen = 224;
	cyScreen = 256;
	width = 256;
	height = 512;
	xOffset = 16;
	yOffset = 16;
	rotate = true;

	fReset = false;
	fTest = false;
	fDIPSwitchChanged = true;
	fCoin = 0;
	fStart1P = 0;
	fStart2P = 0;
	nLife = 3;
	nBonus = 20000;

	ram = new Uint8Array(0xd00).addBase();
	vram = new Uint8Array(0x8000).addBase();
	ram2 = new Uint8Array(0x80);
	in = Uint8Array.of(0x7d, 0xff, 0xff, 0xff, 0, 0x4f);
	psg = [{addr: 0}, {addr: 0}];
	mcu_command = 0;
	mcu_result = 0;
	mcu_flag = 0;

	bg = new Uint8Array(0x10000).fill(3);
	obj = new Uint8Array(0x10000).fill(3);
	rgb = Int32Array.from(seq(0x400).map(i => RGB_H[i] << 4 | RGB_L[i]), e => 0xff000000 | (e >> 6) * 255 / 3 << 16 | (e >> 3 & 7) * 255 / 7 << 8 | (e & 7) * 255 / 7);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	updated = false;
	mode = 0;

	cpu = new Z80(Math.floor(18000000 / 6));
	mcu = new MC6805(Math.floor(18000000 / 6 / 4));
	timer = new Timer(60);

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x80; i++)
			this.cpu.memorymap[i].base = PRG1.base[i];
		for (let i = 0; i < 8; i++) {
			this.cpu.memorymap[0x80 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x80 + i].write = null;
		}
		this.cpu.memorymap[0x88].read = (addr) => {
			switch (addr & 0xff) {
			case 0x00:
				return this.mcu_flag &= ~2, this.mcu_result;
			case 0x01:
				return this.mcu_flag ^ 1 | 0xfc;
			case 0x04:
			case 0x05:
				return sound[0].read(this.psg[0].addr);
			case 0x06:
			case 0x07:
				return sound[1].read(this.psg[1].addr);
			case 0x08:
			case 0x09:
			case 0x0a:
			case 0x0b:
				return this.in[addr & 3];
			case 0x0c:
				return this.mode;
			}
			return 0xff;
		};
		this.cpu.memorymap[0x88].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0x00:
				return this.mcu_command = data, this.mcu_flag |= 1, void(this.mcu.irq = true);
			case 0x04:
				return void(this.psg[0].addr = data);
			case 0x05:
				return void((this.psg[0].addr & 0x0f) < 0x0e && sound[0].write(this.psg[0].addr, data));
			case 0x06:
				return void(this.psg[1].addr = data);
			case 0x07:
				return sound[1].write(this.psg[1].addr, data);
			case 0x0c:
				if ((data ^ this.mode) & 4) {
					const bank = data << 4 & 0x40;
					for (let i = 0; i < 0x40; i++)
						this.cpu.memorymap[0xc0 + i].base = this.vram.base[bank + i];
				}
				return void(this.mode = data);
			}
		};
		for (let i = 0; i < 4; i++) {
			this.cpu.memorymap[0x90 + i].base = this.ram.base[8 + i];
			this.cpu.memorymap[0x90 + i].write = null;
		}
		this.cpu.memorymap[0x98].base = this.ram.base[0x0c];
		this.cpu.memorymap[0x98].write = null;
		for (let i = 0; i < 0x20; i++)
			this.cpu.memorymap[0xa0 + i].base = PRG1.base[0x80 + i];
		for (let i = 0; i < 0x40; i++) {
			this.cpu.memorymap[0xc0 + i].base = this.vram.base[i];
			this.cpu.memorymap[0xc0 + i].write = null;
		}

		this.mcu.memorymap[0].fetch = (addr) => { return addr >= 0x80 ? PRG2[addr] : this.ram2[addr]; };
		this.mcu.memorymap[0].read = (addr) => {
			if (addr >= 0x80)
				return PRG2[addr];
			switch (addr) {
			case 0:
				return this.mcu_command;
			case 2:
				return this.mcu_flag ^ 2 | 0xfc;
			}
			return this.ram2[addr];
		};
		this.mcu.memorymap[0].write = (addr, data) => {
			if (addr >= 0x80)
				return;
			if (addr === 1 && ~this.ram2[1] & data & 2)
				this.mcu_flag &= ~1, this.mcu.irq = false;
			if (addr === 1 && this.ram2[1] & ~data & 4)
				this.mcu_result = this.ram2[0], this.mcu_flag |= 2;
			this.ram2[addr] = data;
		};
		for (let i = 1; i < 8; i++)
			this.mcu.memorymap[i].base = PRG2.base[i];

		this.mcu.check_interrupt = () => { return this.mcu.irq && this.mcu.interrupt(); };

		// Videoの初期化
		convertGFX(this.bg, BG, 1024, rseq(8, 0, 8), seq(8), [0, BG.length * 4], 8);
		convertGFX(this.obj, OBJ, 256, rseq(8, 128, 8).concat(rseq(8, 0, 8)), seq(8).concat(seq(8, 64)), [0, OBJ.length * 4], 32);
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.mcu.execute(tick_rate);
			this.timer.execute(tick_rate, () => { update(), this.cpu.interrupt(); });
			sound[0].execute(tick_rate);
			sound[1].execute(tick_rate);
			audio.execute(tick_rate);
		}
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// DIPスイッチの更新
		if (this.fDIPSwitchChanged) {
			this.fDIPSwitchChanged = false;
			switch (this.nLife) {
			case 6:
				this.in[5] &= ~0x18;
				break;
			case 3:
				this.in[5] = this.in[5] & ~0x18 | 0x08;
				break;
			case 2:
				this.in[5] = this.in[5] & ~0x18 | 0x10;
				break;
			case 1:
				this.in[5] |= 0x18;
				break;
			}
			switch (this.nBonus) {
			case 80000:
				this.in[5] &= ~3;
				break;
			case 60000:
				this.in[5] = this.in[5] & ~3 | 1;
				break;
			case 40000:
				this.in[5] = this.in[5] & ~3 | 2;
				break;
			case 20000:
				this.in[5] |= 3;
				break;
			}
			sound[0].write(0x0e, this.in[4]);
			sound[0].write(0x0f, this.in[5]);
			if (!this.fTest)
				this.fReset = true;
		}

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu.reset();
			this.mcu.reset();
			this.mcu_command = 0;
			this.mcu_result = 0;
			this.mcu_flag = 0;
		}
		return this;
	}

	updateInput() {
		this.in[2] = this.in[2] & ~0x34 | !this.fCoin << 2 | !this.fStart1P << 4 | !this.fStart2P << 5;
		this.fCoin -= !!this.fCoin, this.fStart1P -= !!this.fStart1P, this.fStart2P -= !!this.fStart2P;
		return this;
	}

	coin(fDown) {
		fDown && (this.fCoin = 2);
	}

	start1P(fDown) {
		fDown && (this.fStart1P = 2);
	}

	start2P(fDown) {
		fDown && (this.fStart2P = 2);
	}

	up(fDown) {
		this.in[1] = this.in[1] & ~(1 << 3) | fDown << 2 | !fDown << 3;
	}

	right(fDown) {
		this.in[1] = this.in[1] & ~(1 << 1) | fDown << 0 | !fDown << 1;
	}

	down(fDown) {
		this.in[1] = this.in[1] & ~(1 << 2) | fDown << 3 | !fDown << 2;
	}

	left(fDown) {
		this.in[1] = this.in[1] & ~(1 << 0) | fDown << 1 | !fDown << 0;
	}

	triggerA(fDown) {
		this.in[1] = this.in[1] & ~(1 << 4) | !fDown << 4;
	}

	triggerB(fDown) {
		this.in[1] = this.in[1] & ~(1 << 5) | !fDown << 5;
	}

	makeBitmap(flag) {
		if (!(this.updated = flag))
			return this.bitmap;

		// bg描画
		let p = 256 * 8 * 2 + 232;
		for (let k = 0x840, i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				this.xfer8x8(this.bitmap, p, k);

		// obj描画
		for (let k = 0xc40, i = 48; i !== 0; k += 4, --i) {
			const x = this.ram[k] - 1 & 0xff, y = this.ram[k + 3] + 16;
			const src = this.ram[k + 1] & 0x3f | this.ram[k + 2] << 6;
			switch (this.ram[k + 1] & 0xc0) {
			case 0x00: // ノーマル
				this.xfer16x16(this.bitmap, x | y << 8, src);
				break;
			case 0x40: // V反転
				this.xfer16x16V(this.bitmap, x | y << 8, src);
				break;
			case 0x80: // H反転
				this.xfer16x16H(this.bitmap, x | y << 8, src);
				break;
			case 0xc0: // HV反転
				this.xfer16x16HV(this.bitmap, x | y << 8, src);
				break;
			}
		}

		// bitmap描画
		p = 256 * 8 * 33 + 16;
		for (let k = 0x0200, i = 256 >> 3; i !== 0; --i) {
			for (let j = 224 >> 2; j !== 0; k += 0x80, p += 4, --j) {
				let p0 = this.vram[k], p1 = this.vram[0x2000 + k], p2 = this.vram[0x4000 + k], p3 = this.vram[0x6000 + k];
				this.bitmap[p + 7 * 256] = this.rgb[p0 << 9 & 0x200 | p2 << 8 & 0x100 | p1 << 7 & 0x80 | p3 << 6 & 0x40 | this.bitmap[p + 7 * 256]];
				this.bitmap[p + 6 * 256] = this.rgb[p0 << 8 & 0x200 | p2 << 7 & 0x100 | p1 << 6 & 0x80 | p3 << 5 & 0x40 | this.bitmap[p + 6 * 256]];
				this.bitmap[p + 5 * 256] = this.rgb[p0 << 7 & 0x200 | p2 << 6 & 0x100 | p1 << 5 & 0x80 | p3 << 4 & 0x40 | this.bitmap[p + 5 * 256]];
				this.bitmap[p + 4 * 256] = this.rgb[p0 << 6 & 0x200 | p2 << 5 & 0x100 | p1 << 4 & 0x80 | p3 << 3 & 0x40 | this.bitmap[p + 4 * 256]];
				this.bitmap[p + 3 * 256] = this.rgb[p0 << 5 & 0x200 | p2 << 4 & 0x100 | p1 << 3 & 0x80 | p3 << 2 & 0x40 | this.bitmap[p + 3 * 256]];
				this.bitmap[p + 2 * 256] = this.rgb[p0 << 4 & 0x200 | p2 << 3 & 0x100 | p1 << 2 & 0x80 | p3 << 1 & 0x40 | this.bitmap[p + 2 * 256]];
				this.bitmap[p + 256] = this.rgb[p0 << 3 & 0x200 | p2 << 2 & 0x100 | p1 << 1 & 0x80 | p3 << 0 & 0x40 | this.bitmap[p + 256]];
				this.bitmap[p] = this.rgb[p0 << 2 & 0x200 | p2 << 1 & 0x100 | p1 << 0 & 0x80 | p3 >> 1 & 0x40 | this.bitmap[p]];
				p0 = this.vram[0x20 + k], p1 = this.vram[0x2020 + k], p2 = this.vram[0x4020 + k], p3 = this.vram[0x6020 + k];
				this.bitmap[p + 1 + 7 * 256] = this.rgb[p0 << 9 & 0x200 | p2 << 8 & 0x100 | p1 << 7 & 0x80 | p3 << 6 & 0x40 | this.bitmap[p + 1 + 7 * 256]];
				this.bitmap[p + 1 + 6 * 256] = this.rgb[p0 << 8 & 0x200 | p2 << 7 & 0x100 | p1 << 6 & 0x80 | p3 << 5 & 0x40 | this.bitmap[p + 1 + 6 * 256]];
				this.bitmap[p + 1 + 5 * 256] = this.rgb[p0 << 7 & 0x200 | p2 << 6 & 0x100 | p1 << 5 & 0x80 | p3 << 4 & 0x40 | this.bitmap[p + 1 + 5 * 256]];
				this.bitmap[p + 1 + 4 * 256] = this.rgb[p0 << 6 & 0x200 | p2 << 5 & 0x100 | p1 << 4 & 0x80 | p3 << 3 & 0x40 | this.bitmap[p + 1 + 4 * 256]];
				this.bitmap[p + 1 + 3 * 256] = this.rgb[p0 << 5 & 0x200 | p2 << 4 & 0x100 | p1 << 3 & 0x80 | p3 << 2 & 0x40 | this.bitmap[p + 1 + 3 * 256]];
				this.bitmap[p + 1 + 2 * 256] = this.rgb[p0 << 4 & 0x200 | p2 << 3 & 0x100 | p1 << 2 & 0x80 | p3 << 1 & 0x40 | this.bitmap[p + 1 + 2 * 256]];
				this.bitmap[p + 1 + 256] = this.rgb[p0 << 3 & 0x200 | p2 << 2 & 0x100 | p1 << 1 & 0x80 | p3 << 0 & 0x40 | this.bitmap[p + 1 + 256]];
				this.bitmap[p + 1] = this.rgb[p0 << 2 & 0x200 | p2 << 1 & 0x100 | p1 << 0 & 0x80 | p3 >> 1 & 0x40 | this.bitmap[p + 1]];
				p0 = this.vram[0x40 + k], p1 = this.vram[0x2040 + k], p2 = this.vram[0x4040 + k], p3 = this.vram[0x6040 + k];
				this.bitmap[p + 2 + 7 * 256] = this.rgb[p0 << 9 & 0x200 | p2 << 8 & 0x100 | p1 << 7 & 0x80 | p3 << 6 & 0x40 | this.bitmap[p + 2 + 7 * 256]];
				this.bitmap[p + 2 + 6 * 256] = this.rgb[p0 << 8 & 0x200 | p2 << 7 & 0x100 | p1 << 6 & 0x80 | p3 << 5 & 0x40 | this.bitmap[p + 2 + 6 * 256]];
				this.bitmap[p + 2 + 5 * 256] = this.rgb[p0 << 7 & 0x200 | p2 << 6 & 0x100 | p1 << 5 & 0x80 | p3 << 4 & 0x40 | this.bitmap[p + 2 + 5 * 256]];
				this.bitmap[p + 2 + 4 * 256] = this.rgb[p0 << 6 & 0x200 | p2 << 5 & 0x100 | p1 << 4 & 0x80 | p3 << 3 & 0x40 | this.bitmap[p + 2 + 4 * 256]];
				this.bitmap[p + 2 + 3 * 256] = this.rgb[p0 << 5 & 0x200 | p2 << 4 & 0x100 | p1 << 3 & 0x80 | p3 << 2 & 0x40 | this.bitmap[p + 2 + 3 * 256]];
				this.bitmap[p + 2 + 2 * 256] = this.rgb[p0 << 4 & 0x200 | p2 << 3 & 0x100 | p1 << 2 & 0x80 | p3 << 1 & 0x40 | this.bitmap[p + 2 + 2 * 256]];
				this.bitmap[p + 2 + 256] = this.rgb[p0 << 3 & 0x200 | p2 << 2 & 0x100 | p1 << 1 & 0x80 | p3 << 0 & 0x40 | this.bitmap[p + 2 + 256]];
				this.bitmap[p + 2] = this.rgb[p0 << 2 & 0x200 | p2 << 1 & 0x100 | p1 << 0 & 0x80 | p3 >> 1 & 0x40 | this.bitmap[p + 2]];
				p0 = this.vram[0x60 + k], p1 = this.vram[0x2060 + k], p2 = this.vram[0x4060 + k], p3 = this.vram[0x6060 + k];
				this.bitmap[p + 3 + 7 * 256] = this.rgb[p0 << 9 & 0x200 | p2 << 8 & 0x100 | p1 << 7 & 0x80 | p3 << 6 & 0x40 | this.bitmap[p + 3 + 7 * 256]];
				this.bitmap[p + 3 + 6 * 256] = this.rgb[p0 << 8 & 0x200 | p2 << 7 & 0x100 | p1 << 6 & 0x80 | p3 << 5 & 0x40 | this.bitmap[p + 3 + 6 * 256]];
				this.bitmap[p + 3 + 5 * 256] = this.rgb[p0 << 7 & 0x200 | p2 << 6 & 0x100 | p1 << 5 & 0x80 | p3 << 4 & 0x40 | this.bitmap[p + 3 + 5 * 256]];
				this.bitmap[p + 3 + 4 * 256] = this.rgb[p0 << 6 & 0x200 | p2 << 5 & 0x100 | p1 << 4 & 0x80 | p3 << 3 & 0x40 | this.bitmap[p + 3 + 4 * 256]];
				this.bitmap[p + 3 + 3 * 256] = this.rgb[p0 << 5 & 0x200 | p2 << 4 & 0x100 | p1 << 3 & 0x80 | p3 << 2 & 0x40 | this.bitmap[p + 3 + 3 * 256]];
				this.bitmap[p + 3 + 2 * 256] = this.rgb[p0 << 4 & 0x200 | p2 << 3 & 0x100 | p1 << 2 & 0x80 | p3 << 1 & 0x40 | this.bitmap[p + 3 + 2 * 256]];
				this.bitmap[p + 3 + 256] = this.rgb[p0 << 3 & 0x200 | p2 << 2 & 0x100 | p1 << 1 & 0x80 | p3 << 0 & 0x40 | this.bitmap[p + 3 + 256]];
				this.bitmap[p + 3] = this.rgb[p0 << 2 & 0x200 | p2 << 1 & 0x100 | p1 << 0 & 0x80 | p3 >> 1 & 0x40 | this.bitmap[p + 3]];
			}
			k -= 0x20 * 224 - 1;
			p -= 224 + 256 * 8;
		}

		return this.bitmap;
	}

	xfer8x8(data, p, k) {
		const q = (this.ram[k] ^ (this.mode & 0x20 && this.ram[k] >= 0xc0 ? 0x140 : 0) | this.mode << 2 & 0x200) << 6;
		const idx = (this.ram[k] === 0x74 ? this.ram[0xc0b] : this.ram[0xc01]) << 2 & 0x1c | 0x20;

		data[p + 0x000] = idx | this.bg[q | 0x00];
		data[p + 0x001] = idx | this.bg[q | 0x01];
		data[p + 0x002] = idx | this.bg[q | 0x02];
		data[p + 0x003] = idx | this.bg[q | 0x03];
		data[p + 0x004] = idx | this.bg[q | 0x04];
		data[p + 0x005] = idx | this.bg[q | 0x05];
		data[p + 0x006] = idx | this.bg[q | 0x06];
		data[p + 0x007] = idx | this.bg[q | 0x07];
		data[p + 0x100] = idx | this.bg[q | 0x08];
		data[p + 0x101] = idx | this.bg[q | 0x09];
		data[p + 0x102] = idx | this.bg[q | 0x0a];
		data[p + 0x103] = idx | this.bg[q | 0x0b];
		data[p + 0x104] = idx | this.bg[q | 0x0c];
		data[p + 0x105] = idx | this.bg[q | 0x0d];
		data[p + 0x106] = idx | this.bg[q | 0x0e];
		data[p + 0x107] = idx | this.bg[q | 0x0f];
		data[p + 0x200] = idx | this.bg[q | 0x10];
		data[p + 0x201] = idx | this.bg[q | 0x11];
		data[p + 0x202] = idx | this.bg[q | 0x12];
		data[p + 0x203] = idx | this.bg[q | 0x13];
		data[p + 0x204] = idx | this.bg[q | 0x14];
		data[p + 0x205] = idx | this.bg[q | 0x15];
		data[p + 0x206] = idx | this.bg[q | 0x16];
		data[p + 0x207] = idx | this.bg[q | 0x17];
		data[p + 0x300] = idx | this.bg[q | 0x18];
		data[p + 0x301] = idx | this.bg[q | 0x19];
		data[p + 0x302] = idx | this.bg[q | 0x1a];
		data[p + 0x303] = idx | this.bg[q | 0x1b];
		data[p + 0x304] = idx | this.bg[q | 0x1c];
		data[p + 0x305] = idx | this.bg[q | 0x1d];
		data[p + 0x306] = idx | this.bg[q | 0x1e];
		data[p + 0x307] = idx | this.bg[q | 0x1f];
		data[p + 0x400] = idx | this.bg[q | 0x20];
		data[p + 0x401] = idx | this.bg[q | 0x21];
		data[p + 0x402] = idx | this.bg[q | 0x22];
		data[p + 0x403] = idx | this.bg[q | 0x23];
		data[p + 0x404] = idx | this.bg[q | 0x24];
		data[p + 0x405] = idx | this.bg[q | 0x25];
		data[p + 0x406] = idx | this.bg[q | 0x26];
		data[p + 0x407] = idx | this.bg[q | 0x27];
		data[p + 0x500] = idx | this.bg[q | 0x28];
		data[p + 0x501] = idx | this.bg[q | 0x29];
		data[p + 0x502] = idx | this.bg[q | 0x2a];
		data[p + 0x503] = idx | this.bg[q | 0x2b];
		data[p + 0x504] = idx | this.bg[q | 0x2c];
		data[p + 0x505] = idx | this.bg[q | 0x2d];
		data[p + 0x506] = idx | this.bg[q | 0x2e];
		data[p + 0x507] = idx | this.bg[q | 0x2f];
		data[p + 0x600] = idx | this.bg[q | 0x30];
		data[p + 0x601] = idx | this.bg[q | 0x31];
		data[p + 0x602] = idx | this.bg[q | 0x32];
		data[p + 0x603] = idx | this.bg[q | 0x33];
		data[p + 0x604] = idx | this.bg[q | 0x34];
		data[p + 0x605] = idx | this.bg[q | 0x35];
		data[p + 0x606] = idx | this.bg[q | 0x36];
		data[p + 0x607] = idx | this.bg[q | 0x37];
		data[p + 0x700] = idx | this.bg[q | 0x38];
		data[p + 0x701] = idx | this.bg[q | 0x39];
		data[p + 0x702] = idx | this.bg[q | 0x3a];
		data[p + 0x703] = idx | this.bg[q | 0x3b];
		data[p + 0x704] = idx | this.bg[q | 0x3c];
		data[p + 0x705] = idx | this.bg[q | 0x3d];
		data[p + 0x706] = idx | this.bg[q | 0x3e];
		data[p + 0x707] = idx | this.bg[q | 0x3f];
	}

	xfer16x16(data, dst, src) {
		const idx = src >> 4 & 0x1c;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		src = src << 8 & 0x3f00 | src << 5 & 0xc000;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[src++]))
					data[dst] = idx | px;
	}

	xfer16x16V(data, dst, src) {
		const idx = src >> 4 & 0x1c;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		src = (src << 8 & 0x3f00 | src << 5 & 0xc000) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[src++]))
					data[dst] = idx | px;
	}

	xfer16x16H(data, dst, src) {
		const idx = src >> 4 & 0x1c;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		src = (src << 8 & 0x3f00 | src << 5 & 0xc000) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[--src]))
					data[dst] = idx | px;
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >> 4 & 0x1c;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) === 0 || dst >= 272 * 0x100)
			return;
		src = (src << 8 & 0x3f00 | src << 5 & 0xc000) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.obj[--src]))
					data[dst] = idx | px;
	}
}

const keydown = e => {
	if (e.repeat)
		return;
	switch (e.code) {
	case 'ArrowLeft':
		return void game.left(true);
	case 'ArrowUp':
		return void game.up(true);
	case 'ArrowRight':
		return void game.right(true);
	case 'ArrowDown':
		return void game.down(true);
	case 'Digit0':
		return void game.coin(true);
	case 'Digit1':
		return void game.start1P(true);
	case 'Digit2':
		return void game.start2P(true);
	case 'KeyM': // MUTE
		return audioCtx.state === 'suspended' ? audioCtx.resume().catch() : audioCtx.state === 'running' && audioCtx.suspend().catch();
	case 'KeyR':
		return game.reset();
	case 'KeyT':
		if ((game.fTest = !game.fTest) === true)
			game.fReset = true;
		return;
	case 'Space':
	case 'KeyX':
		return void game.triggerB(true);
	case 'KeyZ':
		return void game.triggerA(true);
	}
};

const keyup = e => {
	switch (e.code) {
	case 'ArrowLeft':
		return void game.left(false);
	case 'ArrowUp':
		return void game.up(false);
	case 'ArrowRight':
		return void game.right(false);
	case 'ArrowDown':
		return void game.down(false);
	case 'Space':
	case 'KeyX':
		return void game.triggerB(false);
	case 'KeyZ':
		return void game.triggerA(false);
	}
};

/*
 *
 *	Chack'n Pop
 *
 */

let PRG1, PRG2, OBJ, BG, RGB_L, RGB_H;

read('chaknpop.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	PRG1 = Uint8Array.concat(...['ao4_01.ic28', 'ao4_02.ic27', 'ao4_03.ic26', 'ao4_04.ic25', 'ao4_05.ic3'].map(e => zip.decompress(e))).addBase();
	PRG2 = zip.decompress('ao4_06.ic23').addBase();
	OBJ = Uint8Array.concat(...['ao4_08.ic14', 'ao4_07.ic15'].map(e => zip.decompress(e)));
	BG = Uint8Array.concat(...['ao4_09.ic98', 'ao4_10.ic97'].map(e => zip.decompress(e)));
	RGB_L = zip.decompress('ao4-11.ic96');
	RGB_H = zip.decompress('ao4-12.ic95');
	game = new ChacknPop();
	sound = [
		new AY_3_8910({clock: Math.floor(18000000 / 12)}),
		new AY_3_8910({clock: Math.floor(18000000 / 12)}),
	];
	canvas.addEventListener('click', () => game.coin(true));
	init({game, sound, keydown, keyup});
});

