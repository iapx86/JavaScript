/*
 *
 *	Time Tunnel
 *
 */

import AY_3_8910 from './ay-3-8910.js';
import SoundEffect from './sound_effect.js';
import Cpu, {init, loop} from './main.js';
import Z80 from './z80.js';
let game, sound, pcm = [];

class TimeTunnel {
	constructor() {
		this.cxScreen = 224;
		this.cyScreen = 256;
		this.width = 256;
		this.height = 512;
		this.xOffset = 16;
		this.yOffset = 16;
		this.fReset = false;
		this.fTest = false;
		this.fDIPSwitchChanged = true;
		this.fCoin = 0;
		this.fStart1P = 0;
		this.fStart2P = 0;
		this.nLife = 3;

		// CPU周りの初期化
		this.fNmiEnable = false;
		this.bank = 0x60;

		this.ram = new Uint8Array(0x4b00).addBase();
		this.ram2 = new Uint8Array(0x400).addBase();
		this.in = Uint8Array.of(0xff, 0xff, 0x1c, 0xff, 0xff, 0x0f, 0, 0xf0);
		this.psg = [{addr: 0}, {addr: 0}, {addr: 0}, {addr: 0}];
		this.count = 0;
		this.timer = 0;
		this.cpu2_irq = false;
		this.cpu2_nmi = false;
		this.cpu2_nmi2 = false;
		this.cpu2_command = 0;
		this.cpu2_flag = 0;
		this.cpu2_flag2 = 0;

		this.cpu = new Z80(this);
		for (let i = 0; i < 0x80; i++)
			this.cpu.memorymap[i].base = PRG1.base[i];
		for (let i = 0; i < 8; i++) {
			this.cpu.memorymap[0x80 + i].base = this.ram.base[i];
			this.cpu.memorymap[0x80 + i].write = null;
		}
		for (let i = 0; i < 8; i++)
			this.cpu.memorymap[0x88 + i].read = addr => (addr & 1) === 0 ? 0 : 0xff;
		for (let i = 0; i < 0x42; i++) {
			this.cpu.memorymap[0x90 + i].base = this.ram.base[8 + i];
			this.cpu.memorymap[0x90 + i].write = null;
		}
		this.cpu.memorymap[0xd2].read = addr => this.ram[0x4a00 | addr & 0x7f];
		this.cpu.memorymap[0xd2].write = (addr, data) => this.ram[0x4a00 | addr & 0x7f] = data;
		this.cpu.memorymap[0xd3].write = (addr, data) => this.priority = data;
		this.cpu.memorymap[0xd4].read = addr => {
			switch (addr & 0x0f) {
			case 0:
			case 1:
			case 2:
			case 3:
				return this.collision[addr & 3];
			case 4:
			case 5:
			case 6:
			case 7:
				const data = this.gfxaddr < 0x8000 ? GFX[this.gfxaddr] : 0;
				this.gfxaddr = this.gfxaddr + 1 & 0xffff;
				return data;
			case 8:
			case 9:
			case 0xa:
			case 0xb:
			case 0xc:
			case 0xd:
				return this.in[addr & 7];
			case 0xf:
				return sound[0].read(this.psg[0].addr);
			}
			return 0xff;
		};
		this.cpu.memorymap[0xd4].write = (addr, data) => {
			switch (addr & 0xf) {
			case 0xe:
				this.psg[0].addr = data;
				break;
			case 0xf:
				(this.psg[0].addr & 0xf) < 0xe && sound[0].write(this.psg[0].addr, data, this.count);
				break;
			}
		};
		this.cpu.memorymap[0xd5].write = (addr, data) => {
			switch (addr & 0xf) {
			case 0:
			case 1:
			case 2:
			case 3:
			case 4:
			case 5:
				return void(this.scroll[addr & 7] = data);
			case 6:
			case 7:
				return void(this.colorbank[addr & 1] = data);
			case 8:
				return this.collision.fill(0);
			case 9:
				return void(this.gfxaddr = this.gfxaddr & 0xff00 | data);
			case 0xa:
				return void(this.gfxaddr = this.gfxaddr & 0xff | data << 8);
			case 0xb:
				this.cpu2_command = data;
				this.cpu2_flag = 1;
				this.cpu2_nmi = true;
				return;
			case 0xc:
				this.cpu2_flag2 = data & 1;
				this.cpu2_nmi2 = (data & 1) !== 0;
				return;
			case 0xe:
				const bank = (data >> 2 & 0x20) + 0x60;
				if (bank === this.bank)
					return;
				for (let i = 0; i < 0x20; i++)
					this.cpu.memorymap[0x60 + i].base = PRG1.base[bank + i];
				this.bank = bank;
				return;
			}
		};
		this.cpu.memorymap[0xd6].write = (addr, data) => this.mode = data;

		this.cpu2 = new Z80(this);
		for (let i = 0; i < 0x10; i++)
			this.cpu2.memorymap[i].base = PRG2.base[i];
		for (let i = 0; i < 4; i++) {
			this.cpu2.memorymap[0x40 + i].base = this.ram2.base[i];
			this.cpu2.memorymap[0x40 + i].write = null;
		}
		for (let i = 0; i < 8; i++) {
			this.cpu2.memorymap[0x48 + i].read = addr => {
				switch (addr & 7) {
				case 1:
					return sound[1].read(this.psg[1].addr);
				case 3:
					return sound[2].read(this.psg[2].addr);
				case 5:
				case 7:
					return sound[3].read(this.psg[3].addr);
				}
				return 0xff;
			};
			this.cpu2.memorymap[0x48 + i].write = (addr, data) => {
				switch (addr & 7) {
				case 0:
					return void(this.psg[1].addr = data);
				case 1:
					return sound[1].write(this.psg[1].addr, data, this.count);
				case 2:
					return void(this.psg[2].addr = data);
				case 3:
					if ((this.psg[2].addr & 0xf) === 0xe)
						this.in[5] = this.in[5] & 0x0f | data & 0xf0;
					return sound[2].write(this.psg[2].addr, data, this.count);
				case 4:
				case 6:
					return void(this.psg[3].addr = data);
				case 5:
				case 7:
					if ((this.psg[3].addr & 0xf) === 0xf)
						this.fNmiEnable = (data & 1) === 0;
					return sound[3].write(this.psg[3].addr, data, this.count);
				}
			};
			this.cpu2.memorymap[0x50 + i].read = addr => {
				switch (addr & 3) {
				case 0:
					this.cpu2_flag = 0;
					return this.cpu2_command;
				case 1:
					return this.cpu2_flag << 3 | this.cpu2_flag2 << 2 | 3;
				}
				return 0xff;
			};
			this.cpu2.memorymap[0x50 + i].write = addr => {
				switch (addr & 3) {
				case 0:
					return void(this.cpu2_command &= 0x7f);
				case 1:
					return void(this.cpu2_flag2 = 0);
				}
			};
		}

		this.cpu2.check_interrupt = () => {
			if (((this.fNmiEnable && this.cpu2_nmi) || this.cpu2_nmi2) && this.cpu2.non_maskable_interrupt()) {
				this.cpu2_nmi = this.cpu2_nmi2 = false;
				return true;
			}
			if (this.cpu2_irq && this.cpu2.interrupt()) {
				this.cpu2_irq = false;
				return true;
			}
			return false;
		};

		this.cpu2.breakpoint = () => {
			this.se.forEach(se => se.stop = true);
			if (this.cpu2.a > 0 && this.cpu2.a < 16)
				this.se[this.cpu2.a - 1].start = true;
		};
		this.cpu2.set_breakpoint(0x04f3);

		// Videoの初期化
		this.bg = new Uint8Array(0x8000);
		this.obj = new Uint8Array(0x8000);
		this.rgb = new Uint32Array(0x40);
		this.pri = [];
		for (let i = 0; i < 32; i++)
			this.pri.push(new Uint8Array(4));
		this.layer = [];
		for (let i = 0; i < 4; i++)
			this.layer.push(new Uint8Array(this.width * this.height));
		this.priority = 0;
		this.collision = new Uint8Array(4);
		this.gfxaddr = 0;
		this.scroll = new Uint8Array(6);
		this.colorbank = new Uint8Array(2);
		this.mode = 0;
		this.convertPRI();

		// 効果音の初期化
		this.se = pcm.map(buf => ({buf: buf, loop: false, start: false, stop: false}));
	}

	execute() {
		this.cpu.interrupt();
		for (this.count = 0; this.count < 3; this.count++) {
			if (this.timer === 0)
				this.cpu2_irq = true;
			Cpu.multiple_execute([this.cpu, this.cpu2], 0x800);
			if (++this.timer >= 5)
				this.timer = 0;
		}
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
			case 3:
				this.in[2] |= 0x18;
				break;
			case 4:
				this.in[2] = this.in[2] & ~0x18 | 0x10;
				break;
			case 5:
				this.in[2] = this.in[2] & ~0x18 | 0x08;
				break;
			case 6:
				this.in[2] &= ~0x18;
				break;
			}
			sound[0].write(0x0e, this.in[6]);
			sound[0].write(0x0f, this.in[7]);
			if (!this.fTest)
				this.fReset = true;
		}

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.cpu.reset();
			this.cpu2.reset();
			this.cpu2_irq = false;
			this.cpu2_nmi = false;
			this.cpu2_nmi2 = false;
			this.timer = 0;
			this.cpu2_command = 0;
			this.cpu2_flag = 0;
			this.cpu2_flag2 = 0;
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if (this.fCoin) {
			--this.fCoin;
			this.in[3] &= ~(1 << 5);
		}
		else
			this.in[3] |= 1 << 5;
		if (this.fStart1P) {
			--this.fStart1P;
			this.in[3] &= ~(1 << 6);
		}
		else
			this.in[3] |= 1 << 6;
		if (this.fStart2P) {
			--this.fStart2P;
			this.in[3] &= ~(1 << 7);
		}
		else
			this.in[3] |= 1 << 7;
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
			this.in[0] = this.in[0] & ~(1 << 3) | 1 << 2;
		else
			this.in[0] |= 1 << 3;
	}

	right(fDown) {
		if (fDown)
			this.in[0] = this.in[0] & ~(1 << 1) | 1 << 0;
		else
			this.in[0] |= 1 << 1;
	}

	down(fDown) {
		if (fDown)
			this.in[0] = this.in[0] & ~(1 << 2) | 1 << 3;
		else
			this.in[0] |= 1 << 2;
	}

	left(fDown) {
		if (fDown)
			this.in[0] = this.in[0] & ~(1 << 0) | 1 << 1;
		else
			this.in[0] |= 1 << 0;
	}

	triggerA(fDown) {
		if (fDown)
			this.in[0] &= ~(1 << 4);
		else
			this.in[0] |= 1 << 4;
	}

	triggerB(fDown) {
		if (fDown)
			this.in[0] &= ~(1 << 5);
		else
			this.in[0] |= 1 << 5;
	}

	convertPRI() {
		for (let i = 0; i < 16; i++)
			for (let mask = 0, j = 3; j >= 0; mask |= 1 << this.pri[i][j], --j)
				this.pri[i][j] = PRI[i << 4 & 0xf0 | mask] & 3;
		for (let i = 16; i < 32; i++)
			for (let mask = 0, j = 3; j >= 0; mask |= 1 << this.pri[i][j], --j)
				this.pri[i][j] = PRI[i << 4 & 0xf0 | mask] >> 2 & 3;
	}

	convertRGB() {
		for (let p = 0, q = 0x4a00, i = 0; i < 0x40; q += 2, i++)
			this.rgb[p++] = (~(this.ram[q] << 8 | this.ram[q + 1]) >> 6 & 7) * 255 / 7	// Red
				| (~(this.ram[q] << 8 | this.ram[q + 1]) >> 3 & 7) * 255 / 7 << 8		// Green
				| (~(this.ram[q] << 8 | this.ram[q + 1]) & 7) * 255 / 7 << 16			// Blue
				| 0xff000000;															// Alpha
	}

	convertBG() {
		for (let p = 0, q = 0x800, i = 0; i < 256; q += 8, i++) {
			for (let j = 0; j < 8; j++)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = this.ram[q + k] >> j & 1 | this.ram[q + k + 0x800] >> j << 1 & 2 | this.ram[q + k + 0x1000] >> j << 2 & 4;
		}
		for (let p = 0x4000, q = 0x2000, i = 0; i < 256; q += 8, i++) {
			for (let j = 0; j < 8; j++)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = this.ram[q + k] >> j & 1 | this.ram[q + k + 0x800] >> j << 1 & 2 | this.ram[q + k + 0x1000] >> j << 2 & 4;
		}
	}

	convertOBJ() {
		for (let p = 0, q = 0x800, i = 0; i < 64; q += 32, i++) {
			for (let j = 0; j < 8; j++) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = this.ram[q + k + 16] >> j & 1 | this.ram[q + k + 0x800 + 16] >> j << 1 & 2 | this.ram[q + k + 0x1000 + 16] >> j << 2 & 4;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = this.ram[q + k] >> j & 1 | this.ram[q + k + 0x800] >> j << 1 & 2 | this.ram[q + k + 0x1000] >> j << 2 & 4;
			}
			for (let j = 0; j < 8; j++) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = this.ram[q + k + 24] >> j & 1 | this.ram[q + k + 0x800 + 24] >> j << 1 & 2 | this.ram[q + k + 0x1000 + 24] >> j << 2 & 4;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = this.ram[q + k + 8] >> j & 1 | this.ram[q + k + 0x800 + 8] >> j << 1 & 2 | this.ram[q + k + 0x1000 + 8] >> j << 2 & 4;
			}
		}
		for (let p = 0x4000, q = 0x2000, i = 0; i < 64; q += 32, i++) {
			for (let j = 0; j < 8; j++) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = this.ram[q + k + 16] >> j & 1 | this.ram[q + k + 0x800 + 16] >> j << 1 & 2 | this.ram[q + k + 0x1000 + 16] >> j << 2 & 4;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = this.ram[q + k] >> j & 1 | this.ram[q + k + 0x800] >> j << 1 & 2 | this.ram[q + k + 0x1000] >> j << 2 & 4;
			}
			for (let j = 0; j < 8; j++) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = this.ram[q + k + 24] >> j & 1 | this.ram[q + k + 0x800 + 24] >> j << 1 & 2 | this.ram[q + k + 0x1000 + 24] >> j << 2 & 4;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = this.ram[q + k + 8] >> j & 1 | this.ram[q + k + 0x800 + 8] >> j << 1 & 2 | this.ram[q + k + 0x1000 + 8] >> j << 2 & 4;
			}
		}
	}

	static convertPCM() {
		const clock = 3000000, rate = 48000;

		for (let idx = 1; idx < 16; idx++) {
			const desc1 = PRG2[0x05f3 + idx * 2] | PRG2[0x05f3 + idx * 2 + 1] << 8;
			const n = PRG2[desc1], w1 = PRG2[desc1 + 1], r1 = PRG2[desc1 + 2], desc2 = PRG2[desc1 + 3] | PRG2[desc1 + 4] << 8;
			let timer = 0;
			for (let i = 0; i < r1; i++) {
				timer += 84;
				for (let j = 0; j < n; j++) {
					let len = PRG2[desc2 + j * 8], w2 = PRG2[desc2 + j * 8 + 1], r2 = PRG2[desc2 + j * 8 + 2], dw2 = PRG2[desc2 + j * 8 + 3];
					timer += 314 + 4;
					for (let k = 0; k < r2; w2 = w2 + dw2 & 0xff, k++)
						timer += 33 + (83 + (w1 - 1 & 0xff) * 16 + 50 + (w2 - 1 & 0xff) * 16) * len + 103 + 49;
					timer += 62;
				}
				timer += 47;
			}
			const buf = new Int16Array(Math.floor(timer * rate / clock));
			let e = 0, m = 0, vol = 0, cnt = 0;
			const advance = cycle => {
				for (timer += cycle * rate; timer >= clock; timer -= clock)
					buf[cnt++] = e;
			};
			timer = 0;
			for (let i = 0; i < r1; i++) {
				advance(84);
				for (let j = 0; j < n; j++) {
					let len = PRG2[desc2 + j * 8], w2 = PRG2[desc2 + j * 8 + 1], r2 = PRG2[desc2 + j * 8 + 2], dw2 = PRG2[desc2 + j * 8 + 3];
					let addr = PRG2[desc2 + j * 8 + 4] | PRG2[desc2 + j * 8 + 5] << 8, _vol = PRG2[desc2 + j * 8 + 6], dv = PRG2[desc2 + j * 8 + 7];
					advance(314);
					e = m * (vol = ~_vol & 0xff);
					advance(4);
					for (let k = 0; k < r2; k++) {
						advance(33);
						for (let l = 0; l < len; l++) {
							advance(83 + (w1 - 1 & 0xff) * 16);
							e = (m = PRG2[addr + l] - 0x80) * vol;
							advance(50 + (w2 - 1 & 0xff) * 16);
						}
						_vol = _vol + dv & 0xff;
						w2 = w2 + dw2 & 0xff;
						advance(103);
						e = m * (vol = ~_vol & 0xff);
						advance(49);
					}
					advance(62);
				}
				advance(47);
			}
			pcm.push(buf);
		}
	}

	makeBitmap(data) {
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();

		// 画面クリア
		let p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256, i++)
			data.fill(this.colorbank[1] << 3 & 0x38, p, p + 224);

		// bg 描画
		if ((this.mode & 0x10) !== 0) {
			const color = this.colorbank[0];
			const scroll = -(this.scroll[0] & 0xf8) + (this.scroll[0] + 3 & 7) + 8;
			for (let k = 0x3c00; k < 0x4000; k++) {
				const x = (~k >> 2 & 0xf8) + this.scroll[1] + this.ram[0x4800 | k & 0x1f] & 0xff;
				const y = ((k << 3 & 0xf8) + scroll & 0xff) + 16;
				if (x > 8 && x < 240)
					this.xfer8x8(this.layer[1], color, x | y << 8, k);
			}
		}
		if ((this.mode & 0x20) !== 0) {
			const color = this.colorbank[0] >> 4;
			const scroll = -(this.scroll[2] & 0xf8) + (this.scroll[2] + 1 & 7) + 10;
			for (let k = 0x4000; k < 0x4400; k++) {
				const x = (~k >> 2 & 0xf8) + this.scroll[3] + this.ram[0x4820 | k & 0x1f] & 0xff;
				const y = ((k << 3 & 0xf8) + scroll & 0xff) + 16;
				if (x > 8 && x < 240)
					this.xfer8x8(this.layer[2], color, x | y << 8, k);
			}
		}
		if ((this.mode & 0x40) !== 0) {
			const color = this.colorbank[1];
			const scroll = -(this.scroll[4] & 0xf8) + (this.scroll[4] - 1 & 7) + 12;
			for (let k = 0x4400; k < 0x4800; k++) {
				const x = (~k >> 2 & 0xf8) + this.scroll[5] + this.ram[0x4840 | k & 0x1f] & 0xff;
				const y = ((k << 3 & 0xf8) + scroll & 0xff) + 16;
				if (x > 8 && x < 240)
					this.xfer8x8(this.layer[3], color, x | y << 8, k);
			}
		}

		// obj 描画
		if ((this.mode & 0x80) !== 0) {
			this.layer[0].fill(0);
			this.drawObj(0x497c | this.mode << 5 & 0x80);
			for (let k = 0x4900 | this.mode << 5 & 0x80, i = 0; i < 31; k += 4, i++) {
				if (i >= 16 && i < 24)
					continue;
				const collision = this.drawObj(k);
				if ((collision & 8) !== 0)
					this.collision[i >= 16 ? 2 : i >> 3] |= 1 << (i & 7);
				this.collision[3] |= collision & 7;
			}
		}

		// layer合成
		for (let i = 0; i < 4; i++) {
			const index = this.pri[this.priority & 0x1f][i];
			const layer = this.layer[index];
			if ((this.mode & [0x80, 0x10, 0x20, 0x40][index]) === 0)
				continue;
			p = 256 * 16 + 16;
			for (let j = 0; j < 256; p += 256 - 224, j++)
				for (let k = 0; k < 7; p += 32, k++) {
					let px;
					if (((px = layer[p]) & 7) !== 0) data[p] = px;
					if (((px = layer[p + 0x01]) & 7) !== 0) data[p + 0x01] = px;
					if (((px = layer[p + 0x02]) & 7) !== 0) data[p + 0x02] = px;
					if (((px = layer[p + 0x03]) & 7) !== 0) data[p + 0x03] = px;
					if (((px = layer[p + 0x04]) & 7) !== 0) data[p + 0x04] = px;
					if (((px = layer[p + 0x05]) & 7) !== 0) data[p + 0x05] = px;
					if (((px = layer[p + 0x06]) & 7) !== 0) data[p + 0x06] = px;
					if (((px = layer[p + 0x07]) & 7) !== 0) data[p + 0x07] = px;
					if (((px = layer[p + 0x08]) & 7) !== 0) data[p + 0x08] = px;
					if (((px = layer[p + 0x09]) & 7) !== 0) data[p + 0x09] = px;
					if (((px = layer[p + 0x0a]) & 7) !== 0) data[p + 0x0a] = px;
					if (((px = layer[p + 0x0b]) & 7) !== 0) data[p + 0x0b] = px;
					if (((px = layer[p + 0x0c]) & 7) !== 0) data[p + 0x0c] = px;
					if (((px = layer[p + 0x0d]) & 7) !== 0) data[p + 0x0d] = px;
					if (((px = layer[p + 0x0e]) & 7) !== 0) data[p + 0x0e] = px;
					if (((px = layer[p + 0x0f]) & 7) !== 0) data[p + 0x0f] = px;
					if (((px = layer[p + 0x10]) & 7) !== 0) data[p + 0x10] = px;
					if (((px = layer[p + 0x11]) & 7) !== 0) data[p + 0x11] = px;
					if (((px = layer[p + 0x12]) & 7) !== 0) data[p + 0x12] = px;
					if (((px = layer[p + 0x13]) & 7) !== 0) data[p + 0x13] = px;
					if (((px = layer[p + 0x14]) & 7) !== 0) data[p + 0x14] = px;
					if (((px = layer[p + 0x15]) & 7) !== 0) data[p + 0x15] = px;
					if (((px = layer[p + 0x16]) & 7) !== 0) data[p + 0x16] = px;
					if (((px = layer[p + 0x17]) & 7) !== 0) data[p + 0x17] = px;
					if (((px = layer[p + 0x18]) & 7) !== 0) data[p + 0x18] = px;
					if (((px = layer[p + 0x19]) & 7) !== 0) data[p + 0x19] = px;
					if (((px = layer[p + 0x1a]) & 7) !== 0) data[p + 0x1a] = px;
					if (((px = layer[p + 0x1b]) & 7) !== 0) data[p + 0x1b] = px;
					if (((px = layer[p + 0x1c]) & 7) !== 0) data[p + 0x1c] = px;
					if (((px = layer[p + 0x1d]) & 7) !== 0) data[p + 0x1d] = px;
					if (((px = layer[p + 0x1e]) & 7) !== 0) data[p + 0x1e] = px;
					if (((px = layer[p + 0x1f]) & 7) !== 0) data[p + 0x1f] = px;
				}
		}

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 256; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] = this.rgb[data[p]];
	}

	xfer8x8(data, color, p, k) {
		let q = (this.ram[k] | color << 5 & 0x100) << 6;
		const idx = color << 3 & 0x38;

		if (p < 0x10900) {
			data[p + 0x000] = idx | this.bg[q + 0x00];
			data[p + 0x001] = idx | this.bg[q + 0x01];
			data[p + 0x002] = idx | this.bg[q + 0x02];
			data[p + 0x003] = idx | this.bg[q + 0x03];
			data[p + 0x004] = idx | this.bg[q + 0x04];
			data[p + 0x005] = idx | this.bg[q + 0x05];
			data[p + 0x006] = idx | this.bg[q + 0x06];
			data[p + 0x007] = idx | this.bg[q + 0x07];
			data[p + 0x100] = idx | this.bg[q + 0x08];
			data[p + 0x101] = idx | this.bg[q + 0x09];
			data[p + 0x102] = idx | this.bg[q + 0x0a];
			data[p + 0x103] = idx | this.bg[q + 0x0b];
			data[p + 0x104] = idx | this.bg[q + 0x0c];
			data[p + 0x105] = idx | this.bg[q + 0x0d];
			data[p + 0x106] = idx | this.bg[q + 0x0e];
			data[p + 0x107] = idx | this.bg[q + 0x0f];
			data[p + 0x200] = idx | this.bg[q + 0x10];
			data[p + 0x201] = idx | this.bg[q + 0x11];
			data[p + 0x202] = idx | this.bg[q + 0x12];
			data[p + 0x203] = idx | this.bg[q + 0x13];
			data[p + 0x204] = idx | this.bg[q + 0x14];
			data[p + 0x205] = idx | this.bg[q + 0x15];
			data[p + 0x206] = idx | this.bg[q + 0x16];
			data[p + 0x207] = idx | this.bg[q + 0x17];
			data[p + 0x300] = idx | this.bg[q + 0x18];
			data[p + 0x301] = idx | this.bg[q + 0x19];
			data[p + 0x302] = idx | this.bg[q + 0x1a];
			data[p + 0x303] = idx | this.bg[q + 0x1b];
			data[p + 0x304] = idx | this.bg[q + 0x1c];
			data[p + 0x305] = idx | this.bg[q + 0x1d];
			data[p + 0x306] = idx | this.bg[q + 0x1e];
			data[p + 0x307] = idx | this.bg[q + 0x1f];
			data[p + 0x400] = idx | this.bg[q + 0x20];
			data[p + 0x401] = idx | this.bg[q + 0x21];
			data[p + 0x402] = idx | this.bg[q + 0x22];
			data[p + 0x403] = idx | this.bg[q + 0x23];
			data[p + 0x404] = idx | this.bg[q + 0x24];
			data[p + 0x405] = idx | this.bg[q + 0x25];
			data[p + 0x406] = idx | this.bg[q + 0x26];
			data[p + 0x407] = idx | this.bg[q + 0x27];
			data[p + 0x500] = idx | this.bg[q + 0x28];
			data[p + 0x501] = idx | this.bg[q + 0x29];
			data[p + 0x502] = idx | this.bg[q + 0x2a];
			data[p + 0x503] = idx | this.bg[q + 0x2b];
			data[p + 0x504] = idx | this.bg[q + 0x2c];
			data[p + 0x505] = idx | this.bg[q + 0x2d];
			data[p + 0x506] = idx | this.bg[q + 0x2e];
			data[p + 0x507] = idx | this.bg[q + 0x2f];
			data[p + 0x600] = idx | this.bg[q + 0x30];
			data[p + 0x601] = idx | this.bg[q + 0x31];
			data[p + 0x602] = idx | this.bg[q + 0x32];
			data[p + 0x603] = idx | this.bg[q + 0x33];
			data[p + 0x604] = idx | this.bg[q + 0x34];
			data[p + 0x605] = idx | this.bg[q + 0x35];
			data[p + 0x606] = idx | this.bg[q + 0x36];
			data[p + 0x607] = idx | this.bg[q + 0x37];
			data[p + 0x700] = idx | this.bg[q + 0x38];
			data[p + 0x701] = idx | this.bg[q + 0x39];
			data[p + 0x702] = idx | this.bg[q + 0x3a];
			data[p + 0x703] = idx | this.bg[q + 0x3b];
			data[p + 0x704] = idx | this.bg[q + 0x3c];
			data[p + 0x705] = idx | this.bg[q + 0x3d];
			data[p + 0x706] = idx | this.bg[q + 0x3e];
			data[p + 0x707] = idx | this.bg[q + 0x3f];
			return;
		}
		for (let i = 0; i < 8; p += 256, p -= (p >= 0x11000) * 0x10000, q += 8, i++) {
			data[p] = idx | this.bg[q];
			data[p + 0x001] = idx | this.bg[q + 0x01];
			data[p + 0x002] = idx | this.bg[q + 0x02];
			data[p + 0x003] = idx | this.bg[q + 0x03];
			data[p + 0x004] = idx | this.bg[q + 0x04];
			data[p + 0x005] = idx | this.bg[q + 0x05];
			data[p + 0x006] = idx | this.bg[q + 0x06];
			data[p + 0x007] = idx | this.bg[q + 0x07];
		}
	}

	drawObj(k) {
		const x = this.ram[k + 1];
		const y = (this.ram[k] - 1 & 0xff) + 16;
		const color = this.ram[k + 2] >> 2 & 1 | this.colorbank[1] >> 3 & 6;

		switch (this.ram[k + 2] & 3) {
		case 0: // ノーマル
			return this.xfer16x16(x | y << 8, this.ram[k + 3] & 0x7f | color << 7);
		case 1: // V反転
			return this.xfer16x16V(x | y << 8, this.ram[k + 3] & 0x7f | color << 7);
		case 2: // H反転
			return this.xfer16x16H(x | y << 8, this.ram[k + 3] & 0x7f | color << 7);
		case 3: // HV反転
			return this.xfer16x16HV(x | y << 8, this.ram[k + 3] & 0x7f | color << 7);
		}
	}

	xfer16x16(dst, src) {
		const idx = src >> 4 & 0x38;
		let px, collision = 0;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return collision;
		src = src << 8 & 0x7f00;
		for (let i = 16; i !== 0; dst += 256 - 16, dst -= (dst >= 0x11000) * 0x10000, --i)
			for (let j = 16; j !== 0; dst++, --j) {
				if ((px = this.obj[src++]) === 0 || (dst & 0xff) < 16 || (dst & 0xff) >= 240)
					continue;
				if (this.layer[0][dst] === 0)
					this.layer[0][dst] = idx | px;
				else
					collision |= 8;
				if ((this.mode & 0x10) !== 0 && (this.layer[1][dst] & 7) !== 0)
					collision |= 1;
				if ((this.mode & 0x20) !== 0 && (this.layer[2][dst] & 7) !== 0)
					collision |= 2;
				if ((this.mode & 0x40) !== 0 && (this.layer[3][dst] & 7) !== 0)
					collision |= 4;
			}
		return collision;
	}

	xfer16x16V(dst, src) {
		const idx = src >> 4 & 0x38;
		let px, collision = 0;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return collision;
		src = (src << 8 & 0x7f00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, dst -= (dst >= 0x11000) * 0x10000, --i)
			for (let j = 16; j !== 0; dst++, --j) {
				if ((px = this.obj[src++]) === 0 || (dst & 0xff) < 16 || (dst & 0xff) >= 240)
					continue;
				if (this.layer[0][dst] === 0)
					this.layer[0][dst] = idx | px;
				else
					collision |= 8;
				if ((this.mode & 0x10) !== 0 && (this.layer[1][dst] & 7) !== 0)
					collision |= 1;
				if ((this.mode & 0x20) !== 0 && (this.layer[2][dst] & 7) !== 0)
					collision |= 2;
				if ((this.mode & 0x40) !== 0 && (this.layer[3][dst] & 7) !== 0)
					collision |= 4;
			}
		return collision;
	}

	xfer16x16H(dst, src) {
		const idx = src >> 4 & 0x38;
		let px, collision = 0;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return collision;
		src = (src << 8 & 0x7f00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, dst -= (dst >= 0x11000) * 0x10000, --i)
			for (let j = 16; j !== 0; dst++, --j) {
				if ((px = this.obj[--src]) === 0 || (dst & 0xff) < 16 || (dst & 0xff) >= 240)
					continue;
				if (this.layer[0][dst] === 0)
					this.layer[0][dst] = idx | px;
				else
					collision |= 8;
				if ((this.mode & 0x10) !== 0 && (this.layer[1][dst] & 7) !== 0)
					collision |= 1;
				if ((this.mode & 0x20) !== 0 && (this.layer[2][dst] & 7) !== 0)
					collision |= 2;
				if ((this.mode & 0x40) !== 0 && (this.layer[3][dst] & 7) !== 0)
					collision |= 4;
			}
		return collision;
	}

	xfer16x16HV(dst, src) {
		const idx = src >> 4 & 0x38;
		let px, collision = 0;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return collision;
		src = (src << 8 & 0x7f00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, dst -= (dst >= 0x11000) * 0x10000, --i)
			for (let j = 16; j !== 0; dst++, --j) {
				if ((px = this.obj[--src]) === 0 || (dst & 0xff) < 16 || (dst & 0xff) >= 240)
					continue;
				if (this.layer[0][dst] === 0)
					this.layer[0][dst] = idx | px;
				else
					collision |= 8;
				if ((this.mode & 0x10) !== 0 && (this.layer[1][dst] & 7) !== 0)
					collision |= 1;
				if ((this.mode & 0x20) !== 0 && (this.layer[2][dst] & 7) !== 0)
					collision |= 2;
				if ((this.mode & 0x40) !== 0 && (this.layer[3][dst] & 7) !== 0)
					collision |= 4;
			}
		return collision;
	}
}

/*
 *
 *	Time Tunnel
 *
 */

const url = 'timetunl.zip';
let PRG1, PRG2, GFX, PRI;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG1 = zip.files['un01.69'].inflate() + zip.files['un02.68'].inflate() + zip.files['un03.67'].inflate() + zip.files['un04.66'].inflate() + zip.files['un05.65'].inflate() + zip.files['un06.64'].inflate();
	PRG1 = new Uint8Array((PRG1 + zip.files['un07.55'].inflate() + zip.files['un08.54'].inflate() + zip.files['un09.53'].inflate() + zip.files['un10.52'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	PRG2 = new Uint8Array(zip.files['un19.70'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	GFX = zip.files['un11.1'].inflate() + zip.files['un12.2'].inflate() + zip.files['un13.3'].inflate() + zip.files['un14.4'].inflate() + zip.files['un15.5'].inflate();
	GFX = new Uint8Array((GFX + zip.files['un16.6'].inflate() + zip.files['un17.7'].inflate() + zip.files['un18.8'].inflate()).split('').map(c => c.charCodeAt(0)));
	PRI = new Uint8Array(zip.files['eb16.22'].inflate().split('').map(c => c.charCodeAt(0)));
	TimeTunnel.convertPCM();
	init({
		game: game = new TimeTunnel(),
		sound: sound = [
			new AY_3_8910({clock: 1500000, resolution: 3}),
			new AY_3_8910({clock: 1500000, resolution: 3}),
			new AY_3_8910({clock: 1500000, resolution: 3}),
			new AY_3_8910({clock: 1500000, resolution: 3}),
			new SoundEffect({se: game.se, freq: 48000, gain: 0.2}),
		],
		rotate: true,
	});
	loop();
}

