/*
 *
 *	TwinBee
 *
 */

import AY_3_8910 from './ay-3-8910.js';
import K005289 from './k005289.js';
import VLM5030 from './vlm5030.js';
import {init, read} from './main.js';
import MC68000 from './mc68000.js';
import Z80 from './z80.js';
let game, sound;

class TwinBee {
	cxScreen = 224;
	cyScreen = 256;
	width = 256;
	height = 512;
	xOffset = 16;
	yOffset = 16;
	rotate = false;

	fReset = true;
	fTest = false;
	fDIPSwitchChanged = true;
	fCoin = 0;
	fStart1P = 0;
	fStart2P = 0;
	fTurbo = false;
	nLife = 3;
	nBonus = '30000 120000';
	nRank = 'Normal';
	fDemoSound = true;

	fInterrupt2Enable = false;
	fInterrupt4Enable = false;

	ram = new Uint8Array(0x49000).addBase();
	ram2 = new Uint8Array(0x4000).addBase();
	vlm = new Uint8Array(0x800).addBase();
	in = Uint8Array.of(0xff, 0x56, 0xff, 0xff, 0xff, 0xff);
	psg = [{addr: 0}, {addr: 0}];
	scc = {freq0: 0, freq1: 0};
	vlm_latch = 0;
	command = 0;
	cpu2_irq = false;

	chr = new Uint8Array(0x20000);
	rgb = new Uint32Array(0x800).fill(0xff000000);
	flip = 0;
	intensity = new Uint8Array(32);

	cpu = new MC68000(Math.floor(18432000 / 2));
	cpu2 = new Z80(Math.floor(14318180 / 8));
	scanline = {rate: 256 * 60, frac: 0, count: 0, execute(rate, fn) {
		for (this.frac += this.rate; this.frac >= rate; this.frac -= rate)
			fn(this.count = this.count + 1 & 255);
	}};
	timer = {rate: 14318180 / 4096, frac: 0, count: 0, execute(rate, rate_correction, fn) {
		for (this.frac += this.rate * rate_correction; this.frac >= rate; this.frac -= rate)
			fn(this.count = this.count + 1 & 255)
	}};

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x100; i++)
			this.cpu.memorymap[i].base = PRG1.base[i];
		for (let i = 0; i < 0x100; i++) {
			this.cpu.memorymap[0x100 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x100 + i].write = null;
		}
		for (let i = 0; i < 0x80; i++) {
			this.cpu.memorymap[0x200 + i].read = (addr) => { return addr & 1 ? this.ram2[addr >> 1 & 0x3fff] : 0; };
			this.cpu.memorymap[0x200 + i].write = (addr, data) => { addr & 1 && (this.ram2[addr >> 1 & 0x3fff] = data); };
		}
		for (let i = 0; i < 0x100; i++) {
			this.cpu.memorymap[0x300 + i].base = this.ram.base[0x100 + i];
			this.cpu.memorymap[0x300 + i].write = (addr, data) => {
				let offset = addr & 0xffff;
				this.ram[0x10000 | offset] = data, this.chr[offset <<= 1] = data >> 4, this.chr[1 | offset] = data & 0xf;
			};
		}
		for (let i = 0; i < 0x80; i++) {
			this.cpu.memorymap[0x500 + i].base = this.ram.base[0x200 + i];
			this.cpu.memorymap[0x500 + i].write = null;
		}
		for (let i = 0; i < 0x10; i++) {
			this.cpu.memorymap[0x5a0 + i].base = this.ram.base[0x280 + i];
			this.cpu.memorymap[0x5a0 + i].write = null;
			this.cpu.memorymap[0x5a0 + i].write16 = (addr, data) => {
				const offset = addr & 0xffe;
				this.ram[0x28000 | offset] = data >> 8, this.ram[0x28001 | offset] = data;
				this.rgb[offset >> 1] = 0xff000000 | this.intensity[data >> 10 & 31] << 16 | this.intensity[data >> 5 & 31] << 8 | this.intensity[data & 31];
			};
		}
		this.cpu.memorymap[0x5c0].write = (addr, data) => { addr === 0x5c001 && (this.command = data); };
		this.cpu.memorymap[0x5c4].read = (addr) => { return addr >= 0x5c402 && addr < 0x5c408 ? this.in[addr - 0x5c402 >> 1] : 0xff; };
		this.cpu.memorymap[0x5cc].read = (addr) => { return addr < 0x5cc06 ? this.in[addr - 0x5cc00 + 6 >> 1] : 0xff; };
		this.cpu.memorymap[0x5d0].read = (addr) => { return addr === 0x5d001 ? 0 : 0xff; };
		this.cpu.memorymap[0x5e0].write = (addr, data) => {
			switch (addr & 0xff) {
			case 1:
				return void(this.fInterrupt2Enable = (data & 1) !== 0);
			case 4:
				return void(data & 1 && (this.cpu2_irq = true));
			case 5:
				return void(this.flip = this.flip & 2 | data & 1);
			case 7:
				return void(this.flip = this.flip & 1 | data << 1 & 2);
			case 0xe:
				return void(this.fInterrupt4Enable = (data & 1) !== 0);
			}
		};
		for (let i = 0; i < 0x200; i++) {
			this.cpu.memorymap[0x600 + i].base = this.ram.base[0x290 + i];
			this.cpu.memorymap[0x600 + i].write = null;
		}
		for (let i = 0; i < 0x400; i++)
			this.cpu.memorymap[0x800 + i].base = PRG1.base[0x100 + i];

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
				return this.command;
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
				return sound[2].write(2, this.scc.freq0);
			case 4:
				return sound[2].write(3, this.scc.freq1);
			case 5:
				return void(this.psg[1].addr = data);
			case 6:
				return void(this.psg[0].addr = data);
			case 0x30:
				return sound[3].st(this.vlm_latch);
			}
		};
		this.cpu2.memorymap[0xe1].write = (addr, data) => { addr === 0xe106 && this.psg[0].addr !== 0xe && sound[0].write(this.psg[0].addr, data); };
		this.cpu2.memorymap[0xe2].read = (addr) => { return addr === 0xe205 ? sound[1].read(this.psg[1].addr) : 0xff; };
		this.cpu2.memorymap[0xe4].write = (addr, data) => {
			if (addr === 0xe405) {
				if ((this.psg[1].addr & 0xe) === 0xe)
					sound[2].write(this.psg[1].addr & 1, data);
				sound[1].write(this.psg[1].addr, data);
			}
		};

		this.cpu2.check_interrupt = () => { return this.cpu2_irq && this.cpu2.interrupt() && (this.cpu2_irq = false, true); };

		// Videoの初期化

		// 輝度の計算
		const _intensity = new Array(32);
		const r = [4700, 2400, 1200, 620, 300];
		for (let i = 0; i < 32; i++) {
			let rt = 0, v = 0;
			for (let j = 0; j < r.length; j++)
				if (~i >> j & 1)
					rt += 1 / r[j], v += 0.05 / r[j];
			_intensity[i] = ((v + 0.005) / (rt + 0.001) - 0.7) * 255 / 5.0 + 0.4;
		}
		const black = _intensity[0], white = 255 / (_intensity[31] - black);
		this.intensity.set(_intensity.map(e => (e - black) * white + 0.5));
	}

	execute(audio, rate_correction) {
		const tick_rate = 384000, tick_max = Math.floor(tick_rate / 60);
		for (let i = 0; i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.cpu2.execute(tick_rate);
			this.scanline.execute(tick_rate, (cnt) => {
				const vpos = cnt + 240 & 0xff;
				vpos === 0 && this.fInterrupt2Enable && this.cpu.interrupt(2);
				vpos === 120 && this.fInterrupt4Enable && this.cpu.interrupt(4);
			});
			this.timer.execute(tick_rate, rate_correction, (cnt) => { sound[0].write(0xe, cnt & 0x2f | sound[3].BSY << 5 | 0xd0); });
			for (let j = 0; j < 3; j++)
				sound[j].execute(tick_rate, rate_correction);
			audio.execute(tick_rate, rate_correction);
		}
		this.cpu2.non_maskable_interrupt();
		return this;
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// DIPスイッチの更新
		if (this.fDIPSwitchChanged) {
			this.fDIPSwitchChanged = false;
			switch (this.nLife) {
			case 2:
				this.in[1] |= 3;
				break;
			case 3:
				this.in[1] = this.in[1] & ~3 | 2;
				break;
			case 4:
				this.in[1] = this.in[1] & ~3 | 1;
				break;
			case 7:
				this.in[1] &= ~3;
				break;
			}
			switch (this.nBonus) {
			case '20000 100000':
				this.in[1] |= 0x18;
				break;
			case '30000 120000':
				this.in[1] = this.in[1] & ~0x18 | 0x10;
				break;
			case '40000 140000':
				this.in[1] = this.in[1] & ~0x18 | 8;
				break;
			case '50000 160000':
				this.in[1] &= ~0x18;
				break;
			}
			switch (this.nRank) {
			case 'Easy':
				this.in[1] |= 0x60;
				break;
			case 'Normal':
				this.in[1] = this.in[1] & ~0x60 | 0x40;
				break;
			case 'Hard':
				this.in[1] = this.in[1] & ~0x60 | 0x20;
				break;
			case 'Hardest':
				this.in[1] &= ~0x60;
				break;
			}
			if (this.fDemoSound)
				this.in[1] &= ~0x80;
			else
				this.in[1] |= 0x80;
			if (!this.fTest)
				this.fReset = true;
		}

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu.reset();
			this.fInterrupt2Enable = false;
			this.fInterrupt4Enable = false;
			this.cpu2_irq = false;
			this.cpu2.reset();
		}
		return this;
	}

	updateInput() {
		this.in[3] = this.in[3] & ~0x1c | !this.fCoin << 2 | !this.fStart1P << 3 | !this.fStart2P << 4;
		this.fCoin -= !!this.fCoin, this.fStart1P -= !!this.fStart1P, this.fStart2P -= !!this.fStart2P;
		this.fTurbo && (this.in[4] ^= 1 << 4);
		return this;
	}

	coin() {
		this.fCoin = 2;
	}

	start1P() {
		this.fStart1P = 2;
	}

	start2P() {
		this.fStart2P = 2;
	}

	up(fDown) {
		this.in[4] = this.in[4] & ~(1 << 2) | fDown << 3 | !fDown << 2;
	}

	right(fDown) {
		this.in[4] = this.in[4] & ~(1 << 1) | fDown << 0 | !fDown << 1;
	}

	down(fDown) {
		this.in[4] = this.in[4] & ~(1 << 3) | fDown << 2 | !fDown << 3;
	}

	left(fDown) {
		this.in[4] = this.in[4] & ~(1 << 0) | fDown << 1 | !fDown << 0;
	}

	triggerA(fDown) {
		this.in[4] = this.in[4] & ~(1 << 4) | !fDown << 4;
	}

	triggerB(fDown) {
		this.in[4] = this.in[4] & ~(1 << 5) | !fDown << 5;
	}

	triggerY(fDown) {
		!(this.fTurbo = fDown) && (this.in[4] |= 1 << 4);
	}

	makeBitmap(data) {
		// 画面クリア
		let p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256, i++)
			data.fill(0, p, p + 224);

		// bg描画
		for (let k = 0x23000; k < 0x24000; k += 2)
			if (!(this.ram[k] & 0x50) && this.ram[k] & 0xf8)
				this.xfer8x8(data, k);
		for (let k = 0x22000; k < 0x23000; k += 2)
			if (!(this.ram[k] & 0x50) && this.ram[k] & 0xf8)
				this.xfer8x8(data, k);
		for (let k = 0x23000; k < 0x24000; k += 2)
			if ((this.ram[k] & 0x50) === 0x40 && this.ram[k] & 0xf8)
				this.xfer8x8(data, k);
		for (let k = 0x22000; k < 0x23000; k += 2)
			if ((this.ram[k] & 0x50) === 0x40 && this.ram[k] & 0xf8)
				this.xfer8x8(data, k);

		// obj描画
		const size = [[32, 32], [16, 32], [32, 16], [64, 64], [8, 8], [16, 8], [8, 16], [16, 16]];
		for (let pri = 0; pri < 256; pri++)
			for (let k = 0x26000; k < 0x27000; k += 0x10) {
				if (this.ram[k + 1] !== pri)
					continue;
				let zoom = this.ram[k + 5];
				let src = this.ram[k + 9] << 9 & 0x18000 | this.ram[k + 7] << 7;
				if (!this.ram[k + 4] && this.ram[k + 6] !== 0xff)
					src = src + (this.ram[k + 6] << 15) & 0x1ff80;
				if (zoom === 0xff && !src || !(zoom |= this.ram[k + 3] << 2 & 0x300))
					continue;
				const color = this.ram[k + 9] << 3 & 0xf0;
				const y = (this.ram[k + 9] << 8 | this.ram[k + 11]) + 16 & 0x1ff;
				const x = ~this.ram[k + 13] & 0xff;
				const [h, w] = size[this.ram[k + 3] >> 3 & 7];
				switch (this.ram[k + 9] >> 4 & 2 | this.ram[k + 3] & 1) {
				case 0:
					this.xferHxW(data, src, color, y, x, h, w, zoom);
					break;
				case 1:
					this.xferHxW_V(data, src, color, y, x, h, w, zoom);
					break;
				case 2:
					this.xferHxW_H(data, src, color, y, x, h, w, zoom);
					break;
				case 3:
					this.xferHxW_HV(data, src, color, y, x, h, w, zoom);
					break;
				}
			}

		// bg描画
		for (let k = 0x23000; k < 0x24000; k += 2)
			if (this.ram[k] & 0x10 && this.ram[k] & 0xf8)
				this.xfer8x8(data, k);
		for (let k = 0x22000; k < 0x23000; k += 2)
			if (this.ram[k] & 0x10 && this.ram[k] & 0xf8)
				this.xfer8x8(data, k);

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] = this.rgb[data[p]];
	}

	xfer8x8(data, k) {
		const x0 = ((this.flip & 2 ? k : ~k) >> 4 & 0xf8 | 7) + this.ram[0x20f01 | ~k >> 5 & 0x80 | k & 0x7e] & 0xff;
		const color = this.ram[k + 0x2001] << 4 & 0x7f0;
		let src = (this.ram[k] << 8 & 0x700 | this.ram[k + 1]) << 6, px;

		if (x0 < 16 || x0 >= 247)
			return;
		if (~this.ram[k] & 0x20 || (this.ram[k] & 0xc0) === 0x40)
			switch ((this.ram[k] >> 2 & 2 | this.ram[k + 0x2001] >> 7) ^ this.flip) {
			case 0: // ノーマル
				for (let x = x0, i = 0; i < 8; src += 8, --x, i++) {
					const offset = k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0x20001 | offset] | this.ram[0x20201 | offset] << 8;
					const y = (k << 2) - scroll + 16 & 0x1ff;
					if (y < 9 || y > 271)
						continue;
					data[y << 8 | x] = color | this.chr[src | 0];
					data[y + 1 << 8 | x] = color | this.chr[src | 1];
					data[y + 2 << 8 | x] = color | this.chr[src | 2];
					data[y + 3 << 8 | x] = color | this.chr[src | 3];
					data[y + 4 << 8 | x] = color | this.chr[src | 4];
					data[y + 5 << 8 | x] = color | this.chr[src | 5];
					data[y + 6 << 8 | x] = color | this.chr[src | 6];
					data[y + 7 << 8 | x] = color | this.chr[src | 7];
				}
				return;
			case 1: // V反転
				for (let x = x0, i = 0; i < 8; src += 8, --x, i++){
					const offset = k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0x20001 | offset] | this.ram[0x20201 | offset] << 8;
					const y = (k << 2) - scroll + 16 & 0x1ff;
					if (y < 9 || y > 271)
						continue;
					data[y + 7 << 8 | x] = color | this.chr[src | 0];
					data[y + 6 << 8 | x] = color | this.chr[src | 1];
					data[y + 5 << 8 | x] = color | this.chr[src | 2];
					data[y + 4 << 8 | x] = color | this.chr[src | 3];
					data[y + 3 << 8 | x] = color | this.chr[src | 4];
					data[y + 2 << 8 | x] = color | this.chr[src | 5];
					data[y + 1 << 8 | x] = color | this.chr[src | 6];
					data[y << 8 | x] = color | this.chr[src | 7];
				}
				return;
			case 2: // H反転
				for (let x = x0 - 7, i = 0; i < 8; src += 8, x++, i++) {
					const offset = k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0x20001 | offset] | this.ram[0x20201 | offset] << 8;
					const y = (k << 2) - scroll + 16 & 0x1ff;
					if (y < 9 || y > 271)
						continue;
					data[y << 8 | x] = color | this.chr[src | 0];
					data[y + 1 << 8 | x] = color | this.chr[src | 1];
					data[y + 2 << 8 | x] = color | this.chr[src | 2];
					data[y + 3 << 8 | x] = color | this.chr[src | 3];
					data[y + 4 << 8 | x] = color | this.chr[src | 4];
					data[y + 5 << 8 | x] = color | this.chr[src | 5];
					data[y + 6 << 8 | x] = color | this.chr[src | 6];
					data[y + 7 << 8 | x] = color | this.chr[src | 7];
				}
				return;
			case 3: // HV反転
				for (let x = x0 - 7, i = 0; i < 8; src += 8, x++, i++) {
					const offset = k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0x20001 | offset] | this.ram[0x20201 | offset] << 8;
					const y = (k << 2) - scroll + 16 & 0x1ff;
					if (y < 9 || y > 271)
						continue;
					data[y + 7 << 8 | x] = color | this.chr[src | 0];
					data[y + 6 << 8 | x] = color | this.chr[src | 1];
					data[y + 5 << 8 | x] = color | this.chr[src | 2];
					data[y + 4 << 8 | x] = color | this.chr[src | 3];
					data[y + 3 << 8 | x] = color | this.chr[src | 4];
					data[y + 2 << 8 | x] = color | this.chr[src | 5];
					data[y + 1 << 8 | x] = color | this.chr[src | 6];
					data[y << 8 | x] = color | this.chr[src | 7];
				}
				return;
			}
		switch ((this.ram[k] >> 2 & 2 | this.ram[k + 0x2001] >> 7) ^ this.flip) {
		case 0: // ノーマル
			for (let x = x0, i = 0; i < 8; src += 8, --x, i++) {
				const offset = k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0x20001 | offset] | this.ram[0x20201 | offset] << 8;
				const y = (k << 2) - scroll + 16 & 0x1ff;
				if (y < 9 || y > 271)
					continue;
				(px = this.chr[src | 0]) && (data[y << 8 | x] = color | px);
				(px = this.chr[src | 1]) && (data[y + 1 << 8 | x] = color | px);
				(px = this.chr[src | 2]) && (data[y + 2 << 8 | x] = color | px);
				(px = this.chr[src | 3]) && (data[y + 3 << 8 | x] = color | px);
				(px = this.chr[src | 4]) && (data[y + 4 << 8 | x] = color | px);
				(px = this.chr[src | 5]) && (data[y + 5 << 8 | x] = color | px);
				(px = this.chr[src | 6]) && (data[y + 6 << 8 | x] = color | px);
				(px = this.chr[src | 7]) && (data[y + 7 << 8 | x] = color | px);
			}
			break;
		case 1: // V反転
			for (let x = x0, i = 0; i < 8; src += 8, --x, i++){
				const offset = k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0x20001 | offset] | this.ram[0x20201 | offset] << 8;
				const y = (k << 2) - scroll + 16 & 0x1ff;
				if (y < 9 || y > 271)
					continue;
				(px = this.chr[src | 0]) && (data[y + 7 << 8 | x] = color | px);
				(px = this.chr[src | 1]) && (data[y + 6 << 8 | x] = color | px);
				(px = this.chr[src | 2]) && (data[y + 5 << 8 | x] = color | px);
				(px = this.chr[src | 3]) && (data[y + 4 << 8 | x] = color | px);
				(px = this.chr[src | 4]) && (data[y + 3 << 8 | x] = color | px);
				(px = this.chr[src | 5]) && (data[y + 2 << 8 | x] = color | px);
				(px = this.chr[src | 6]) && (data[y + 1 << 8 | x] = color | px);
				(px = this.chr[src | 7]) && (data[y << 8 | x] = color | px);
			}
			break;
		case 2: // H反転
			for (let x = x0 - 7, i = 0; i < 8; src += 8, x++, i++) {
				const offset = k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0x20001 | offset] | this.ram[0x20201 | offset] << 8;
				const y = (k << 2) - scroll + 16 & 0x1ff;
				if (y < 9 || y > 271)
					continue;
				(px = this.chr[src | 0]) && (data[y << 8 | x] = color | px);
				(px = this.chr[src | 1]) && (data[y + 1 << 8 | x] = color | px);
				(px = this.chr[src | 2]) && (data[y + 2 << 8 | x] = color | px);
				(px = this.chr[src | 3]) && (data[y + 3 << 8 | x] = color | px);
				(px = this.chr[src | 4]) && (data[y + 4 << 8 | x] = color | px);
				(px = this.chr[src | 5]) && (data[y + 5 << 8 | x] = color | px);
				(px = this.chr[src | 6]) && (data[y + 6 << 8 | x] = color | px);
				(px = this.chr[src | 7]) && (data[y + 7 << 8 | x] = color | px);
			}
			break;
		case 3: // HV反転
			for (let x = x0 - 7, i = 0; i < 8; src += 8, x++, i++) {
				const offset = k >> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0x20001 | offset] | this.ram[0x20201 | offset] << 8;
				const y = (k << 2) - scroll + 16 & 0x1ff;
				if (y < 9 || y > 271)
					continue;
				(px = this.chr[src | 0]) && (data[y + 7 << 8 | x] = color | px);
				(px = this.chr[src | 1]) && (data[y + 6 << 8 | x] = color | px);
				(px = this.chr[src | 2]) && (data[y + 5 << 8 | x] = color | px);
				(px = this.chr[src | 3]) && (data[y + 4 << 8 | x] = color | px);
				(px = this.chr[src | 4]) && (data[y + 3 << 8 | x] = color | px);
				(px = this.chr[src | 5]) && (data[y + 2 << 8 | x] = color | px);
				(px = this.chr[src | 6]) && (data[y + 1 << 8 | x] = color | px);
				(px = this.chr[src | 7]) && (data[y << 8 | x] = color | px);
			}
			break;
		}
	}

	xferHxW(data, src, color, y0, x0, h, w, zoom) {
		const dh = Math.floor(h * 0x80 / zoom), dw = Math.floor(w * 0x80 / zoom), y1 = y0 + dh - 1 & 0x1ff, x1 = x0 - dw + 1 & 0xff;
		let px;

		if (dh <= 256 && (y0 < 16 || y0 >= 272) && (y1 < 16 || y1 >= 272) || dw <= 32 && (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let x = x0, i = 0; i >> 7 < w; x = x - 1 & 0xff, i += zoom)
			for (let y = y0, j = 0; j >> 7 < h; y = y + 1 & 0x1ff, j += zoom)
				if ((px = this.chr[src | (i >> 7) * h | j >> 7]))
					data[y << 8 | x] = color | px;
	}

	xferHxW_V(data, src, color, y0, x0, h, w, zoom) {
		const dh = Math.floor(h * 0x80 / zoom), dw = Math.floor(w * 0x80 / zoom), y1 = y0 + dh - 1 & 0x1ff, x1 = x0 - dw + 1 & 0xff;
		let px;

		if (dh <= 256 && (y0 < 16 || y0 >= 272) && (y1 < 16 || y1 >= 272) || dw <= 32 && (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let x = x0, i = 0; i >> 7 < w; x = x - 1 & 0xff, i += zoom)
			for (let y = y1, j = 0; j >> 7 < h; y = y - 1 & 0x1ff, j += zoom)
				if ((px = this.chr[src | (i >> 7) * h | j >> 7]))
					data[y << 8 | x] = color | px;
	}

	xferHxW_H(data, src, color, y0, x0, h, w, zoom) {
		const dh = Math.floor(h * 0x80 / zoom), dw = Math.floor(w * 0x80 / zoom), y1 = y0 + dh - 1 & 0x1ff, x1 = x0 - dw + 1 & 0xff;
		let px;

		if (dh <= 256 && (y0 < 16 || y0 >= 272) && (y1 < 16 || y1 >= 272) || dw <= 32 && (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let x = x1, i = 0; i >> 7 < w; x = x + 1 & 0xff, i += zoom)
			for (let y = y0, j = 0; j >> 7 < h; y = y + 1 & 0x1ff, j += zoom)
				if ((px = this.chr[src | (i >> 7) * h | j >> 7]))
					data[y << 8 | x] = color | px;
	}

	xferHxW_HV(data, src, color, y0, x0, h, w, zoom) {
		const dh = Math.floor(h * 0x80 / zoom), dw = Math.floor(w * 0x80 / zoom), y1 = y0 + dh - 1 & 0x1ff, x1 = x0 - dw + 1 & 0xff;
		let px;

		if (dh <= 256 && (y0 < 16 || y0 >= 272) && (y1 < 16 || y1 >= 272) || dw <= 32 && (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let x = x1, i = 0; i >> 7 < w; x = x + 1 & 0xff, i += zoom)
			for (let y = y1, j = 0; j >> 7 < h; y = y - 1 & 0x1ff, j += zoom)
				if ((px = this.chr[src | (i >> 7) * h | j >> 7]))
					data[y << 8 | x] = color | px;
	}
}

/*
 *
 *	TwinBee
 *
 */

const PRG1 = new Uint8Array(0x50000).addBase();
let PRG2, SND;

read('twinbee.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	zip.decompress('400-a06.15l').forEach((e, i) => PRG1[i << 1] = e);
	zip.decompress('400-a04.10l').forEach((e, i) => PRG1[1 + (i << 1)] = e);
	zip.decompress('412-a07.17l').forEach((e, i) => PRG1[0x10000 + (i << 1)] = e);
	zip.decompress('412-a05.12l').forEach((e, i) => PRG1[0x10001 + (i << 1)] = e);
	PRG2 = zip.decompress('400-e03.5l').addBase();
	SND = Uint8Array.concat(...['400-a01.fse', '400-a02.fse'].map(e => zip.decompress(e)));
	game = new TwinBee();
	sound = [
		new AY_3_8910({clock: 14318180 / 8, gain: 0.3}),
		new AY_3_8910({clock: 14318180 / 8, gain: 0.3}),
		new K005289({SND, clock: 14318180 / 4, gain: 0.3}),
		new VLM5030({VLM: game.vlm, clock: 14318180 / 4, gain: 5}),
	];
	canvas.addEventListener('click', () => game.coin());
	init({game, sound});
});

