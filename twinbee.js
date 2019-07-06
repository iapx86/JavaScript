/*
 *
 *	TwinBee
 *
 */

import AY_3_8910 from './ay-3-8910.js';
import K005289 from './k005289.js';
import VLM5030 from './vlm5030.js';
import {init, loop} from './main.js';
import MC68000 from  './mc68000.js';
import Z80 from './z80.js';
let game, sound;

class TwinBee {
	constructor() {
		this.cxScreen = 224;
		this.cyScreen = 256;
		this.width = 256;
		this.height = 512;
		this.xOffset = 16;
		this.yOffset = 16;
		this.fReset = true;
		this.fTest = false;
		this.fDIPSwitchChanged = true;
		this.fCoin = 0;
		this.fStart1P = 0;
		this.fStart2P = 0;
		this.fTurbo = 0;
		this.nLife = 3;
		this.nBonus = '30000 120000';
		this.nRank = 'Normal';
		this.fDemoSound = true;

		// CPU周りの初期化
		this.fInterrupt2Enable = false;
		this.fInterrupt4Enable = false;

		this.ram = new Uint8Array(0x49000).addBase();
		this.ram2 = new Uint8Array(0x4000).addBase();
		this.vlm = new Uint8Array(0x800).addBase();
		this.in = Uint8Array.of(0xff, 0x56, 0xff, 0xff, 0xff, 0xff);
		this.psg = [{addr: 0}, {addr: 0}];
		this.scc = {freq0: 0, freq1: 0};
		this.vlm_latch = 0;
		this.count = 0;
		this.timer = 0;
		this.command = [];

		this.cpu = new MC68000(this);
		for (let i = 0; i < 0x100; i++)
			this.cpu.memorymap[i].base = PRG1.base[i];
		for (let i = 0; i < 0x100; i++) {
			this.cpu.memorymap[0x100 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x100 + i].write = null;
		}
		for (let i = 0; i < 0x80; i++) {
			this.cpu.memorymap[0x200 + i].read = addr => (addr & 1) !== 0 ? this.ram2[addr >> 1 & 0x3fff] : 0;
			this.cpu.memorymap[0x200 + i].write = (addr, data) => (addr & 1) !== 0 && (this.ram2[addr >> 1 & 0x3fff] = data);
		}
		for (let i = 0; i < 0x100; i++) {
			this.cpu.memorymap[0x300 + i].base = this.ram.base[0x100 + i];
			this.cpu.memorymap[0x300 + i].write = (addr, data) => {
				let offset = addr & 0xffff;
				this.ram[0x10000 | offset] = data;
				this.chr[offset <<= 1] = data >>> 4;
				this.chr[1 | offset] = data & 0xf;
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
				this.ram[0x28000 | offset] = data >>> 8;
				this.ram[0x28001 | offset] = data;
				this.rgb[offset >>> 1] = this.intensity[data & 0x1f]	// Red
					| this.intensity[data >>> 5 & 0x1f] << 8			// Green
					| this.intensity[data >>> 10 & 0x1f] << 16			// Blue
					| 0xff000000;										// Alpha
			};
		}
		this.cpu.memorymap[0x5c0].write = (addr, data) => addr === 0x5c001 && this.command.push(data);
		this.cpu.memorymap[0x5c4].read = addr => addr >= 0x5c402 && addr < 0x5c408 ? this.in[addr - 0x5c402 >>> 1] : 0xff;
		this.cpu.memorymap[0x5cc].read = addr => addr < 0x5cc06 ? this.in[addr - 0x5cc00 + 6 >>> 1] : 0xff;
		this.cpu.memorymap[0x5d0].read = addr => addr === 0x5d001 ? 0 : 0xff;
		this.cpu.memorymap[0x5e0].write = (addr, data) => {
			switch (addr & 0xff) {
			case 1:
				this.fInterrupt2Enable = (data & 1) !== 0;
				break;
			case 5:
				this.flip = this.flip & 2 | data & 1;
				break;
			case 7:
				this.flip = this.flip & 1 | data << 1 & 2;
				break;
			case 0xe:
				this.fInterrupt4Enable = (data & 1) !== 0;
				break;
			}
		};
		for (let i = 0; i < 0x200; i++) {
			this.cpu.memorymap[0x600 + i].base = this.ram.base[0x290 + i];
			this.cpu.memorymap[0x600 + i].write = null;
		}
		for (let i = 0; i < 0x400; i++)
			this.cpu.memorymap[0x800 + i].base = PRG1.base[0x100 + i];

		this.cpu2 = new Z80(this);
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
			this.cpu2.memorymap[0xa0 + i].write = addr => this.scc.freq0 = ~addr & 0xfff;
			this.cpu2.memorymap[0xc0 + i].write = addr => this.scc.freq1 = ~addr & 0xfff;
		}
		this.cpu2.memorymap[0xe0].read = addr => {
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
				this.vlm_latch = data;
				break;
			case 3:
				sound[2].write(2, this.scc.freq0, this.count);
				break;
			case 4:
				sound[2].write(3, this.scc.freq1, this.count);
				break;
			case 5:
				this.psg[1].addr = data;
				break;
			case 6:
				this.psg[0].addr = data;
				break;
			case 0x30:
				sound[3].st(this.vlm_latch);
				break;
			}
		};
		this.cpu2.memorymap[0xe1].write = (addr, data) => addr === 0xe106 && this.psg[0].addr !== 0xe && sound[0].write(this.psg[0].addr, data, this.count);
		this.cpu2.memorymap[0xe2].read = addr => addr === 0xe205 ? sound[1].read(this.psg[1].addr) : 0xff;
		this.cpu2.memorymap[0xe4].write = (addr, data) => {
			if (addr === 0xe405) {
				if ((this.psg[1].addr & 0xe) === 0xe)
					sound[2].write(this.psg[1].addr & 1, data, this.count);
				sound[1].write(this.psg[1].addr, data, this.count);
			}
		};

		// Videoの初期化
		this.chr = new Uint8Array(0x20000);
		this.rgb = new Uint32Array(0x800);
		this.flip = 0;

		// 輝度の計算
		const intensity = new Array(32);
		const r = [4700, 2400, 1200, 620, 300];
		for (let i = 0; i < 32; i++) {
			let rt = 0, v = 0;
			for (let j = 0; j < r.length; j++)
				if ((i >>> j & 1) === 0) {
					rt += 1 / r[j];
					v += 0.05 / r[j];
				}
			rt += 0.001;
			v += 0.005;
			v = v / rt - 0.7;
			intensity[i] = v * 255 / 5.0 + 0.4;
		}
		const black = intensity[0], white = 255 / (intensity[31] - black);
		this.intensity = new Uint8Array(intensity.map(e => (e - black) * white + 0.5));
	}

	execute() {
		for (let vpos = 0; vpos < 256; vpos++) {
			if (vpos === 0 && this.fInterrupt2Enable)
				this.cpu.interrupt(2);
			if (vpos === 120 && this.fInterrupt4Enable)
				this.cpu.interrupt(4);
			this.cpu.execute(64);
		}
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
			this.command.splice(0);
			this.cpu2.reset();
			this.timer = 0;
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if (this.fCoin) {
			--this.fCoin;
			this.in[3] &= ~(1 << 2);
		}
		else
			this.in[3] |= 1 << 2;
		if (this.fStart1P) {
			--this.fStart1P;
			this.in[3] &= ~(1 << 3);
		}
		else
			this.in[3] |= 1 << 3;
		if (this.fStart2P) {
			--this.fStart2P;
			this.in[3] &= ~(1 << 4);
		}
		else
			this.in[3] |= 1 << 4;

		// 連射処理
		if (this.fTurbo)
			this.in[4] ^= 1 << 4;
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
		if (fDown)
			this.in[4] = this.in[4] & ~(1 << 2) | 1 << 3;
		else
			this.in[4] |= 1 << 2;
	}

	right(fDown) {
		if (fDown)
			this.in[4] = this.in[4] & ~(1 << 1) | 1 << 0;
		else
			this.in[4] |= 1 << 1;
	}

	down(fDown) {
		if (fDown)
			this.in[4] = this.in[4] & ~(1 << 3) | 1 << 2;
		else
			this.in[4] |= 1 << 3;
	}

	left(fDown) {
		if (fDown)
			this.in[4] = this.in[4] & ~(1 << 0) | 1 << 1;
		else
			this.in[4] |= 1 << 0;
	}

	triggerA(fDown) {
		if (fDown)
			this.in[4] &= ~(1 << 4);
		else
			this.in[4] |= 1 << 4;
	}

	triggerB(fDown) {
		if (fDown)
			this.in[4] &= ~(1 << 5);
		else
			this.in[4] |= 1 << 5;
	}

	triggerY(fDown) {
		if ((this.fTurbo = fDown) === false)
			this.in[4] |= 1 << 4;
	}

	makeBitmap(data) {
		// 画面クリア
		let p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256, i++)
			data.fill(0, p, p + 224);

		// bg描画
		for (let k = 0x23000; k < 0x24000; k += 2)
			if ((this.ram[k] & 0x50) === 0 && (this.ram[k] & 0xf8) !== 0)
				this.xfer8x8(data, k);
		for (let k = 0x22000; k < 0x23000; k += 2)
			if ((this.ram[k] & 0x50) === 0 && (this.ram[k] & 0xf8) !== 0)
				this.xfer8x8(data, k);
		for (let k = 0x23000; k < 0x24000; k += 2)
			if ((this.ram[k] & 0x50) === 0x40 && (this.ram[k] & 0xf8) !== 0)
				this.xfer8x8(data, k);
		for (let k = 0x22000; k < 0x23000; k += 2)
			if ((this.ram[k] & 0x50) === 0x40 && (this.ram[k] & 0xf8) !== 0)
				this.xfer8x8(data, k);

		// obj描画
		const size = [[32, 32], [16, 32], [32, 16], [64, 64], [8, 8], [16, 8], [8, 16], [16, 16]];
		for (let pri = 0; pri < 256; pri++)
			for (let p = 0x26000; p < 0x27000; p += 0x10) {
				if (this.ram[p + 1] !== pri)
					continue;
				let zoom = this.ram[p + 5];
				let src = this.ram[p + 9] << 9 & 0x18000 | this.ram[p + 7] << 7;
				if (this.ram[p + 4] === 0 && this.ram[p + 6] !== 0xff)
					src = src + (this.ram[p + 6] << 15) & 0x1ff80;
				if (zoom === 0xff && src === 0 || (zoom |= this.ram[p + 3] << 2 & 0x300) === 0)
					continue;
				const color = this.ram[p + 9] << 3 & 0xf0;
				const y = (this.ram[p + 9] << 8 | this.ram[p + 11]) + 16 & 0x1ff;
				const x = ~this.ram[p + 13] & 0xff;
				const [h, w] = size[this.ram[p + 3] >>> 3 & 7];
				switch (this.ram[p + 9] >>> 4 & 2 | this.ram[p + 3] & 1) {
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
			if ((this.ram[k] & 0x10) === 0x10 && (this.ram[k] & 0xf8) !== 0)
				this.xfer8x8(data, k);
		for (let k = 0x22000; k < 0x23000; k += 2)
			if ((this.ram[k] & 0x10) === 0x10 && (this.ram[k] & 0xf8) !== 0)
				this.xfer8x8(data, k);

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] = this.rgb[data[p]];
	}

	xfer8x8(data, k) {
		const x0 = (((this.flip & 2) === 0 ? ~k : k) >>> 4 & 0xf8 | 7) + this.ram[0x20f01 | ~k >>> 5 & 0x80 | k & 0x7e] & 0xff;
		const color = this.ram[k + 0x2001] << 4 & 0x7f0;
		let src = (this.ram[k] << 8 & 0x700 | this.ram[k + 1]) << 6, px;

		if (x0 < 16 && x0 >= 247)
			return;
		if ((this.ram[k] & 0x20) === 0 || (this.ram[k] & 0xc0) === 0x40)
			switch ((this.ram[k] >>> 2 & 2 | this.ram[k + 0x2001] >>> 7) ^ this.flip) {
			case 0: // ノーマル
				for (let x = x0, i = 0; i < 8; src += 8, --x, i++) {
					const offset = k >>> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0x20001 | offset] | this.ram[0x20201 | offset] << 8;
					const y = (k << 2) - scroll + 16 & 0x1ff;
					if (y > 8 && y < 272) {
						data[y << 8 | x] = color | this.chr[src | 0];
						data[y + 1 << 8 | x] = color | this.chr[src | 1];
						data[y + 2 << 8 | x] = color | this.chr[src | 2];
						data[y + 3 << 8 | x] = color | this.chr[src | 3];
						data[y + 4 << 8 | x] = color | this.chr[src | 4];
						data[y + 5 << 8 | x] = color | this.chr[src | 5];
						data[y + 6 << 8 | x] = color | this.chr[src | 6];
						data[y + 7 << 8 | x] = color | this.chr[src | 7];
					}
				}
				return;
			case 1: // V反転
				for (let x = x0, i = 0; i < 8; src += 8, --x, i++){
					const offset = k >>> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0x20001 | offset] | this.ram[0x20201 | offset] << 8;
					const y = (k << 2) - scroll + 16 & 0x1ff;
					if (y > 8 && y < 272) {
						data[y + 7 << 8 | x] = color | this.chr[src | 0];
						data[y + 6 << 8 | x] = color | this.chr[src | 1];
						data[y + 5 << 8 | x] = color | this.chr[src | 2];
						data[y + 4 << 8 | x] = color | this.chr[src | 3];
						data[y + 3 << 8 | x] = color | this.chr[src | 4];
						data[y + 2 << 8 | x] = color | this.chr[src | 5];
						data[y + 1 << 8 | x] = color | this.chr[src | 6];
						data[y << 8 | x] = color | this.chr[src | 7];
					}
				}
				return;
			case 2: // H反転
				for (let x = x0 - 7, i = 0; i < 8; src += 8, x++, i++) {
					const offset = k >>> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0x20001 | offset] | this.ram[0x20201 | offset] << 8;
					const y = (k << 2) - scroll + 16 & 0x1ff;
					if (y > 8 && y < 272) {
						data[y << 8 | x] = color | this.chr[src | 0];
						data[y + 1 << 8 | x] = color | this.chr[src | 1];
						data[y + 2 << 8 | x] = color | this.chr[src | 2];
						data[y + 3 << 8 | x] = color | this.chr[src | 3];
						data[y + 4 << 8 | x] = color | this.chr[src | 4];
						data[y + 5 << 8 | x] = color | this.chr[src | 5];
						data[y + 6 << 8 | x] = color | this.chr[src | 6];
						data[y + 7 << 8 | x] = color | this.chr[src | 7];
					}
				}
				return;
			case 3: // HV反転
				for (let x = x0 - 7, i = 0; i < 8; src += 8, x++, i++) {
					const offset = k >>> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0x20001 | offset] | this.ram[0x20201 | offset] << 8;
					const y = (k << 2) - scroll + 16 & 0x1ff;
					if (y > 8 && y < 272) {
						data[y + 7 << 8 | x] = color | this.chr[src | 0];
						data[y + 6 << 8 | x] = color | this.chr[src | 1];
						data[y + 5 << 8 | x] = color | this.chr[src | 2];
						data[y + 4 << 8 | x] = color | this.chr[src | 3];
						data[y + 3 << 8 | x] = color | this.chr[src | 4];
						data[y + 2 << 8 | x] = color | this.chr[src | 5];
						data[y + 1 << 8 | x] = color | this.chr[src | 6];
						data[y << 8 | x] = color | this.chr[src | 7];
					}
				}
				return;
			}
		switch ((this.ram[k] >>> 2 & 2 | this.ram[k + 0x2001] >>> 7) ^ this.flip) {
		case 0: // ノーマル
			for (let x = x0, i = 0; i < 8; src += 8, --x, i++) {
				const offset = k >>> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0x20001 | offset] | this.ram[0x20201 | offset] << 8;
				const y = (k << 2) - scroll + 16 & 0x1ff;
				if (y > 8 && y < 272) {
					if ((px = this.chr[src | 0]) !== 0) data[y << 8 | x] = color | px;
					if ((px = this.chr[src | 1]) !== 0) data[y + 1 << 8 | x] = color | px;
					if ((px = this.chr[src | 2]) !== 0) data[y + 2 << 8 | x] = color | px;
					if ((px = this.chr[src | 3]) !== 0) data[y + 3 << 8 | x] = color | px;
					if ((px = this.chr[src | 4]) !== 0) data[y + 4 << 8 | x] = color | px;
					if ((px = this.chr[src | 5]) !== 0) data[y + 5 << 8 | x] = color | px;
					if ((px = this.chr[src | 6]) !== 0) data[y + 6 << 8 | x] = color | px;
					if ((px = this.chr[src | 7]) !== 0) data[y + 7 << 8 | x] = color | px;
				}
			}
			break;
		case 1: // V反転
			for (let x = x0, i = 0; i < 8; src += 8, --x, i++){
				const offset = k >>> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0x20001 | offset] | this.ram[0x20201 | offset] << 8;
				const y = (k << 2) - scroll + 16 & 0x1ff;
				if (y > 8 && y < 272) {
					if ((px = this.chr[src | 0]) !== 0) data[y + 7 << 8 | x] = color | px;
					if ((px = this.chr[src | 1]) !== 0) data[y + 6 << 8 | x] = color | px;
					if ((px = this.chr[src | 2]) !== 0) data[y + 5 << 8 | x] = color | px;
					if ((px = this.chr[src | 3]) !== 0) data[y + 4 << 8 | x] = color | px;
					if ((px = this.chr[src | 4]) !== 0) data[y + 3 << 8 | x] = color | px;
					if ((px = this.chr[src | 5]) !== 0) data[y + 2 << 8 | x] = color | px;
					if ((px = this.chr[src | 6]) !== 0) data[y + 1 << 8 | x] = color | px;
					if ((px = this.chr[src | 7]) !== 0) data[y << 8 | x] = color | px;
				}
			}
			break;
		case 2: // H反転
			for (let x = x0 - 7, i = 0; i < 8; src += 8, x++, i++) {
				const offset = k >>> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0x20001 | offset] | this.ram[0x20201 | offset] << 8;
				const y = (k << 2) - scroll + 16 & 0x1ff;
				if (y > 8 && y < 272) {
					if ((px = this.chr[src | 0]) !== 0) data[y << 8 | x] = color | px;
					if ((px = this.chr[src | 1]) !== 0) data[y + 1 << 8 | x] = color | px;
					if ((px = this.chr[src | 2]) !== 0) data[y + 2 << 8 | x] = color | px;
					if ((px = this.chr[src | 3]) !== 0) data[y + 3 << 8 | x] = color | px;
					if ((px = this.chr[src | 4]) !== 0) data[y + 4 << 8 | x] = color | px;
					if ((px = this.chr[src | 5]) !== 0) data[y + 5 << 8 | x] = color | px;
					if ((px = this.chr[src | 6]) !== 0) data[y + 6 << 8 | x] = color | px;
					if ((px = this.chr[src | 7]) !== 0) data[y + 7 << 8 | x] = color | px;
				}
			}
			break;
		case 3: // HV反転
			for (let x = x0 - 7, i = 0; i < 8; src += 8, x++, i++) {
				const offset = k >>> 2 & 0x400 | ~x << 1 & 0x1fe, scroll = this.ram[0x20001 | offset] | this.ram[0x20201 | offset] << 8;
				const y = (k << 2) - scroll + 16 & 0x1ff;
				if (y > 8 && y < 272) {
					if ((px = this.chr[src | 0]) !== 0) data[y + 7 << 8 | x] = color | px;
					if ((px = this.chr[src | 1]) !== 0) data[y + 6 << 8 | x] = color | px;
					if ((px = this.chr[src | 2]) !== 0) data[y + 5 << 8 | x] = color | px;
					if ((px = this.chr[src | 3]) !== 0) data[y + 4 << 8 | x] = color | px;
					if ((px = this.chr[src | 4]) !== 0) data[y + 3 << 8 | x] = color | px;
					if ((px = this.chr[src | 5]) !== 0) data[y + 2 << 8 | x] = color | px;
					if ((px = this.chr[src | 6]) !== 0) data[y + 1 << 8 | x] = color | px;
					if ((px = this.chr[src | 7]) !== 0) data[y << 8 | x] = color | px;
				}
			}
			break;
		}
	}

	xferHxW(data, src, color, y0, x0, h, w, zoom) {
		const dh = Math.floor(h * 0x80 / zoom), dw = Math.floor(w * 0x80 / zoom), y1 = y0 + dh - 1 & 0x1ff, x1 = x0 - dw + 1 & 0xff;
		let px;

		if (dh <= 256 && (y0 < 16 || y0 >= 272) && (y1 < 16 || y1 >= 272) || dw <= 32 && (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let x = x0, i = 0; i >>> 7 < w; x = x - 1 & 0xff, i += zoom)
			for (let y = y0, j = 0; j >>> 7 < h; y = y + 1 & 0x1ff, j += zoom)
				if ((px = this.chr[src | (i >>> 7) * h | j >>> 7]) !== 0)
					data[y << 8 | x] = color | px;
	}

	xferHxW_V(data, src, color, y0, x0, h, w, zoom) {
		const dh = Math.floor(h * 0x80 / zoom), dw = Math.floor(w * 0x80 / zoom), y1 = y0 + dh - 1 & 0x1ff, x1 = x0 - dw + 1 & 0xff;
		let px;

		if (dh <= 256 && (y0 < 16 || y0 >= 272) && (y1 < 16 || y1 >= 272) || dw <= 32 && (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let x = x0, i = 0; i >>> 7 < w; x = x - 1 & 0xff, i += zoom)
			for (let y = y1, j = 0; j >>> 7 < h; y = y - 1 & 0x1ff, j += zoom)
				if ((px = this.chr[src | (i >>> 7) * h | j >>> 7]) !== 0)
					data[y << 8 | x] = color | px;
	}

	xferHxW_H(data, src, color, y0, x0, h, w, zoom) {
		const dh = Math.floor(h * 0x80 / zoom), dw = Math.floor(w * 0x80 / zoom), y1 = y0 + dh - 1 & 0x1ff, x1 = x0 - dw + 1 & 0xff;
		let px;

		if (dh <= 256 && (y0 < 16 || y0 >= 272) && (y1 < 16 || y1 >= 272) || dw <= 32 && (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let x = x1, i = 0; i >>> 7 < w; x = x + 1 & 0xff, i += zoom)
			for (let y = y0, j = 0; j >>> 7 < h; y = y + 1 & 0x1ff, j += zoom)
				if ((px = this.chr[src | (i >>> 7) * h | j >>> 7]) !== 0)
					data[y << 8 | x] = color | px;
	}

	xferHxW_HV(data, src, color, y0, x0, h, w, zoom) {
		const dh = Math.floor(h * 0x80 / zoom), dw = Math.floor(w * 0x80 / zoom), y1 = y0 + dh - 1 & 0x1ff, x1 = x0 - dw + 1 & 0xff;
		let px;

		if (dh <= 256 && (y0 < 16 || y0 >= 272) && (y1 < 16 || y1 >= 272) || dw <= 32 && (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let x = x1, i = 0; i >>> 7 < w; x = x + 1 & 0xff, i += zoom)
			for (let y = y1, j = 0; j >>> 7 < h; y = y - 1 & 0x1ff, j += zoom)
				if ((px = this.chr[src | (i >>> 7) * h | j >>> 7]) !== 0)
					data[y << 8 | x] = color | px;
	}
}

/*
 *
 *	TwinBee
 *
 */

const url = 'twinbee.zip';
const PRG1 = new Uint8Array(0x50000).addBase();
let PRG2, SND;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	zip.files['400-a06.15l'].inflate().split('').forEach((c, i) => PRG1[i << 1] = c.charCodeAt(0));
	zip.files['400-a04.10l'].inflate().split('').forEach((c, i) => PRG1[1 + (i << 1)] = c.charCodeAt(0));
	zip.files['412-a07.17l'].inflate().split('').forEach((c, i) => PRG1[0x10000 + (i << 1)] = c.charCodeAt(0));
	zip.files['412-a05.12l'].inflate().split('').forEach((c, i) => PRG1[0x10001 + (i << 1)] = c.charCodeAt(0));
	PRG2 = new Uint8Array(zip.files['400-e03.5l'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	SND = new Uint8Array((zip.files['400-a01.fse'].inflate() + zip.files['400-a02.fse'].inflate()).split('').map(c => c.charCodeAt(0)));
	init({
		game: game = new TwinBee(),
		sound: sound = [
			new AY_3_8910({clock: 14318180 / 8, resolution: 58, gain: 0.3}),
			new AY_3_8910({clock: 14318180 / 8, resolution: 58, gain: 0.3}),
			new K005289({SND, clock: 14318180 / 4, resolution: 58, gain: 0.3}),
			new VLM5030({VLM: game.vlm, clock: 14318180 / 4, gain: 5}),
		],
	});
	loop();
}

