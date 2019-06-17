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
				this.scroll[addr & 7] = data;
				break;
			case 6:
			case 7:
				this.colorbank[addr & 1] = data;
				break;
			case 8:
				this.collision.fill(0);
				break;
			case 9:
				this.gfxaddr = this.gfxaddr & 0xff00 | data;
				break;
			case 0xa:
				this.gfxaddr = this.gfxaddr & 0xff | data << 8;
				break;
			case 0xb:
				this.cpu2_command = data;
				this.cpu2_flag = 1;
				this.cpu2.nmi = true;
				break;
			case 0xc:
				this.cpu2_flag2 = data & 1;
				this.cpu2.nmi2 = (data & 1) !== 0;
				break;
			case 0xe:
				const bank = (data >> 2 & 0x20) + 0x60;
				if (bank === this.bank)
					break;
				for (let i = 0; i < 0x20; i++)
					this.cpu.memorymap[0x60 + i].base = PRG1.base[bank + i];
				this.bank = bank;
				break;
			}
		};
		this.cpu.memorymap[0xd6].write = (addr, data) => this.mode = data;

		this.cpu2 = new Z80(this);
		this.cpu2.int = false;
		this.cpu2.nmi = false;
		this.cpu2.nmi2 = false;
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
					this.psg[1].addr = data;
					break;
				case 1:
					sound[1].write(this.psg[1].addr, data, this.count);
					break;
				case 2:
					this.psg[2].addr = data;
					break;
				case 3:
					if ((this.psg[2].addr & 0xf) === 0xe)
						this.in[5] = this.in[5] & 0x0f | data & 0xf0;
					sound[2].write(this.psg[2].addr, data, this.count);
					break;
				case 4:
				case 6:
					this.psg[3].addr = data;
					break;
				case 5:
				case 7:
					if ((this.psg[3].addr & 0xf) === 0xf)
						this.fNmiEnable = (data & 1) === 0;
					sound[3].write(this.psg[3].addr, data, this.count);
					break;
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
					this.cpu2_command &= 0x7f;
					break;
				case 1:
					this.cpu2_flag2 = 0;
					break;
				}
			};
		}

		this.cpu2.check_interrupt = () => {
			if (((this.fNmiEnable && this.cpu2.nmi) || this.cpu2.nmi2) && this.cpu2.non_maskable_interrupt()) {
				this.cpu2.nmi = this.cpu2.nmi2 = false;
				return true;
			}
			if (this.cpu2.int && this.cpu2.interrupt()) {
				this.cpu2.int = false;
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
				this.cpu2.int = true;
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
			this.cpu2.int = false;
			this.cpu2.nmi = false;
			this.cpu2.nmi2 = false;
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
				this.pri[i][j] = PRI[i << 4 & 0xf0 | mask] >>> 2 & 3;
	}

	convertRGB() {
		for (let p = 0, q = 0x4a00, i = 0; i < 0x40; q += 2, i++)
			this.rgb[p++] = (~(this.ram[q] << 8 | this.ram[q + 1]) >>> 6 & 7) * 255 / 7	// Red
				| (~(this.ram[q] << 8 | this.ram[q + 1]) >>> 3 & 7) * 255 / 7 << 8		// Green
				| (~(this.ram[q] << 8 | this.ram[q + 1]) & 7) * 255 / 7 << 16			// Blue
				| 0xff000000;															// Alpha
	}

	convertBG() {
		for (let p = 0, q = 0x800, i = 0; i < 256; q += 8, i++) {
			for (let j = 0; j < 8; j++)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = this.ram[q + k] >>> j & 1 | this.ram[q + k + 0x800] >>> j << 1 & 2 | this.ram[q + k + 0x1000] >>> j << 2 & 4;
		}
		for (let p = 0x4000, q = 0x2000, i = 0; i < 256; q += 8, i++) {
			for (let j = 0; j < 8; j++)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = this.ram[q + k] >>> j & 1 | this.ram[q + k + 0x800] >>> j << 1 & 2 | this.ram[q + k + 0x1000] >>> j << 2 & 4;
		}
	}

	convertOBJ() {
		for (let p = 0, q = 0x800, i = 0; i < 64; q += 32, i++) {
			for (let j = 0; j < 8; j++) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = this.ram[q + k + 16] >>> j & 1 | this.ram[q + k + 0x800 + 16] >>> j << 1 & 2 | this.ram[q + k + 0x1000 + 16] >>> j << 2 & 4;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = this.ram[q + k] >>> j & 1 | this.ram[q + k + 0x800] >>> j << 1 & 2 | this.ram[q + k + 0x1000] >>> j << 2 & 4;
			}
			for (let j = 0; j < 8; j++) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = this.ram[q + k + 24] >>> j & 1 | this.ram[q + k + 0x800 + 24] >>> j << 1 & 2 | this.ram[q + k + 0x1000 + 24] >>> j << 2 & 4;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = this.ram[q + k + 8] >>> j & 1 | this.ram[q + k + 0x800 + 8] >>> j << 1 & 2 | this.ram[q + k + 0x1000 + 8] >>> j << 2 & 4;
			}
		}
		for (let p = 0x4000, q = 0x2000, i = 0; i < 64; q += 32, i++) {
			for (let j = 0; j < 8; j++) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = this.ram[q + k + 16] >>> j & 1 | this.ram[q + k + 0x800 + 16] >>> j << 1 & 2 | this.ram[q + k + 0x1000 + 16] >>> j << 2 & 4;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = this.ram[q + k] >>> j & 1 | this.ram[q + k + 0x800] >>> j << 1 & 2 | this.ram[q + k + 0x1000] >>> j << 2 & 4;
			}
			for (let j = 0; j < 8; j++) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = this.ram[q + k + 24] >>> j & 1 | this.ram[q + k + 0x800 + 24] >>> j << 1 & 2 | this.ram[q + k + 0x1000 + 24] >>> j << 2 & 4;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = this.ram[q + k + 8] >>> j & 1 | this.ram[q + k + 0x800 + 8] >>> j << 1 & 2 | this.ram[q + k + 0x1000 + 8] >>> j << 2 & 4;
			}
		}
	}

	static convertPCM() {
		const clock = 3000000, rate = 48000, buf = [];

		for (let idx = 1; idx < 16; idx++) {
			const desc1 = PRG2[0x05f3 + idx * 2] | PRG2[0x05f3 + idx * 2 + 1] << 8;
			const [n, w1, r1, desc2_l, desc2_h] = PRG2.subarray(desc1, desc1 + 5), desc2 = desc2_l | desc2_h << 8;
			let timer = 0, m = 0x80, vol = 0;
			for (let i = 0; i < r1; i++) {
				for (timer += 84 * rate; timer >= clock; timer -= clock)
					buf.push((m - 0x80) * vol);
				for (let j = 0; j < n; j++) {
					let [len, w2, r2, dw2, addr_l, addr_h, _vol, dv] = PRG2.subarray(desc2 + j * 8, desc2 + j * 8 + 8), addr = addr_l | addr_h << 8;
					for (timer += 314 * rate; timer >= clock; timer -= clock)
						buf.push((m - 0x80) * vol);
					vol = _vol;
					for (timer += 4 * rate; timer >= clock; timer -= clock)
						buf.push((m - 0x80) * vol);
					for (let k = 0; k < r2; k++) {
						for (timer += 33 * rate; timer >= clock; timer -= clock)
							buf.push((m - 0x80) * vol);
						for (let l = 0; l < len; l++) {
							for (timer += (83 + (w1 - 1 & 0xff) * 16) * rate; timer >= clock; timer -= clock)
								buf.push((m - 0x80) * vol);
							m = PRG2[addr + l];
							for (timer += (50 + (w2 - 1 & 0xff) * 16) * rate; timer >= clock; timer -= clock)
								buf.push((m - 0x80) * vol);
						}
						_vol = _vol + dv & 0xff;
						w2 = w2 + dw2 & 0xff;
						for (timer += 103 * rate; timer >= clock; timer -= clock)
							buf.push((m - 0x80) * vol);
						vol = _vol;
						for (timer += 49 * rate; timer >= clock; timer -= clock)
							buf.push((m - 0x80) * vol);
					}
					for (timer += 62 * rate; timer >= clock; timer -= clock)
						buf.push((m - 0x80) * vol);
				}
				for (timer += 47 * rate; timer >= clock; timer -= clock)
					buf.push((m - 0x80) * vol);
			}
			pcm.push(new Int16Array(buf));
			buf.splice(0);
		}
	}

	makeBitmap(data) {
		const [layer0, layer1, layer2, layer3] = this.layer;

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
				const x = (~k >>> 2 & 0xf8) + this.scroll[1] + this.ram[0x4800 | k & 0x1f] & 0xff;
				const y = ((k << 3 & 0xf8) + scroll & 0xff) + 16;
				if (x > 8 && x < 240)
					this.xfer8x8(layer1, color, x | y << 8, k);
			}
		}
		if ((this.mode & 0x20) !== 0) {
			const color = this.colorbank[0] >>> 4;
			const scroll = -(this.scroll[2] & 0xf8) + (this.scroll[2] + 1 & 7) + 10;
			for (let k = 0x4000; k < 0x4400; k++) {
				const x = (~k >>> 2 & 0xf8) + this.scroll[3] + this.ram[0x4820 | k & 0x1f] & 0xff;
				const y = ((k << 3 & 0xf8) + scroll & 0xff) + 16;
				if (x > 8 && x < 240)
					this.xfer8x8(layer2, color, x | y << 8, k);
			}
		}
		if ((this.mode & 0x40) !== 0) {
			const color = this.colorbank[1];
			const scroll = -(this.scroll[4] & 0xf8) + (this.scroll[4] - 1 & 7) + 12;
			for (let k = 0x4400; k < 0x4800; k++) {
				const x = (~k >>> 2 & 0xf8) + this.scroll[5] + this.ram[0x4840 | k & 0x1f] & 0xff;
				const y = ((k << 3 & 0xf8) + scroll & 0xff) + 16;
				if (x > 8 && x < 240)
					this.xfer8x8(layer3, color, x | y << 8, k);
			}
		}

		// obj 描画
		if ((this.mode & 0x80) !== 0) {
			layer0.fill(0);
			this.drawObj(0x497c | this.mode << 5 & 0x80);
			for (let k = 0x4900 | this.mode << 5 & 0x80, i = 0; i < 31; k += 4, i++) {
				if (i >= 16 && i < 24)
					continue;
				const collision = this.drawObj(k);
				if ((collision & 8) !== 0)
					this.collision[i >= 16 ? 2 : i >>> 3] |= 1 << (i & 7);
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
				for (let k = 0; k < 224; p++, k++)
					if ((layer[p] & 7) !== 0)
						data[p] = layer[p];
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

		for (let i = 0; i < 8; p += 256, p -= (p >= 0x11000) * 0x10000, q += 8, i++) {
			data[p] = idx | this.bg[q];
			data[p + 1] = idx | this.bg[q + 1];
			data[p + 2] = idx | this.bg[q + 2];
			data[p + 3] = idx | this.bg[q + 3];
			data[p + 4] = idx | this.bg[q + 4];
			data[p + 5] = idx | this.bg[q + 5];
			data[p + 6] = idx | this.bg[q + 6];
			data[p + 7] = idx | this.bg[q + 7];
		}
	}

	drawObj(k) {
		const x = this.ram[k + 1];
		const y = (this.ram[k] - 1 & 0xff) + 16;
		const color = this.ram[k + 2] >>> 2 & 1 | this.colorbank[1] >>> 3 & 6;

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
		const idx = src >>> 4 & 0x38, [layer0, layer1, layer2, layer3] = this.layer;
		let px, collision = 0;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return collision;
		src = src << 8 & 0x7f00;
		for (let i = 16; i !== 0; dst += 256 - 16, dst -= (dst >= 0x11000) * 0x10000, --i)
			for (let j = 16; j !== 0; dst++, --j) {
				if ((px = this.obj[src++]) === 0 || (dst & 0xff) < 16 || (dst & 0xff) >= 240)
					continue;
				if (layer0[dst] === 0)
					layer0[dst] = idx | px;
				else
					collision |= 8;
				if ((this.mode & 0x10) !== 0 && (layer1[dst] & 7) !== 0)
					collision |= 1;
				if ((this.mode & 0x20) !== 0 && (layer2[dst] & 7) !== 0)
					collision |= 2;
				if ((this.mode & 0x40) !== 0 && (layer3[dst] & 7) !== 0)
					collision |= 4;
			}
		return collision;
	}

	xfer16x16V(dst, src) {
		const idx = src >>> 4 & 0x38, [layer0, layer1, layer2, layer3] = this.layer;
		let px, collision = 0;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return collision;
		src = (src << 8 & 0x7f00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, dst -= (dst >= 0x11000) * 0x10000, --i)
			for (let j = 16; j !== 0; dst++, --j) {
				if ((px = this.obj[src++]) === 0 || (dst & 0xff) < 16 || (dst & 0xff) >= 240)
					continue;
				if (layer0[dst] === 0)
					layer0[dst] = idx | px;
				else
					collision |= 8;
				if ((this.mode & 0x10) !== 0 && (layer1[dst] & 7) !== 0)
					collision |= 1;
				if ((this.mode & 0x20) !== 0 && (layer2[dst] & 7) !== 0)
					collision |= 2;
				if ((this.mode & 0x40) !== 0 && (layer3[dst] & 7) !== 0)
					collision |= 4;
			}
		return collision;
	}

	xfer16x16H(dst, src) {
		const idx = src >>> 4 & 0x38, [layer0, layer1, layer2, layer3] = this.layer;
		let px, collision = 0;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return collision;
		src = (src << 8 & 0x7f00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, dst -= (dst >= 0x11000) * 0x10000, --i)
			for (let j = 16; j !== 0; dst++, --j) {
				if ((px = this.obj[--src]) === 0 || (dst & 0xff) < 16 || (dst & 0xff) >= 240)
					continue;
				if (layer0[dst] === 0)
					layer0[dst] = idx | px;
				else
					collision |= 8;
				if ((this.mode & 0x10) !== 0 && (layer1[dst] & 7) !== 0)
					collision |= 1;
				if ((this.mode & 0x20) !== 0 && (layer2[dst] & 7) !== 0)
					collision |= 2;
				if ((this.mode & 0x40) !== 0 && (layer3[dst] & 7) !== 0)
					collision |= 4;
			}
		return collision;
	}

	xfer16x16HV(dst, src) {
		const idx = src >>> 4 & 0x38, [layer0, layer1, layer2, layer3] = this.layer;
		let px, collision = 0;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240)
			return collision;
		src = (src << 8 & 0x7f00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, dst -= (dst >= 0x11000) * 0x10000, --i)
			for (let j = 16; j !== 0; dst++, --j) {
				if ((px = this.obj[--src]) === 0 || (dst & 0xff) < 16 || (dst & 0xff) >= 240)
					continue;
				if (layer0[dst] === 0)
					layer0[dst] = idx | px;
				else
					collision |= 8;
				if ((this.mode & 0x10) !== 0 && (layer1[dst] & 7) !== 0)
					collision |= 1;
				if ((this.mode & 0x20) !== 0 && (layer2[dst] & 7) !== 0)
					collision |= 2;
				if ((this.mode & 0x40) !== 0 && (layer3[dst] & 7) !== 0)
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
			new SoundEffect({se: game.se, freq: 48000, gain: 0.7}),
		],
		rotate: true,
	});
	loop();
}

