/*
 *
 *	Grobda
 *
 */

import MappySound from './mappy_sound.js';
import SoundEffect from './sound_effect.js';
import Cpu, {init, loop} from './main.js';
import MC6809 from './mc6809.js';
let game, sound;

class Grobda {
	constructor() {
		this.cxScreen = 224;
		this.cyScreen = 288;
		this.width = 256;
		this.height = 512;
		this.xOffset = 16;
		this.yOffset = 16;
		this.fReset = false;
		this.fTest = false;
		this.fDIPSwitchChanged = true;
		this.fCoin = false;
		this.fStart1P = false;
		this.fStart2P = false;
		this.nGrobda = 3;
		this.nRank = 'A';
		this.nExtend = 'A';
		this.fAttract = true;
		this.fSelect = true;

		// CPU周りの初期化
		this.fPortTest = false;
		this.fInterruptEnable0 = false;
		this.fInterruptEnable1 = false;
		this.fSoundEnable = false;

		this.ram = new Uint8Array(0x2800).addBase();
		this.port = new Uint8Array(0x20);
		this.port[0x12] = 6;
		this.port[0x14] = 3;

		this.cpu = [];
		for (let i = 0; i < 2; i++)
			this.cpu[i] = new MC6809(this);

		for (let i = 0; i < 0x60; i++)
			this.cpu[0].memorymap[0xa0 + i].base = PRG1.base[i];
		for (let i = 0; i < 8; i++) {
			this.cpu[0].memorymap[i].base = this.ram.base[i];
			this.cpu[0].memorymap[i].write = null;
		}
		for (let i = 0; i < 0x18; i++) {
			this.cpu[0].memorymap[0x08 + i].base = this.ram.base[8 + i];
			this.cpu[0].memorymap[0x08 + i].write = null;
		}
		for (let i = 0; i < 4; i++) {
			this.cpu[0].memorymap[0x40 + i].read = addr => sound[0].read(addr);
			this.cpu[0].memorymap[0x40 + i].write = (addr, data) => sound[0].write(addr, data);
		}
		for (let i = 0; i < 4; i++) {
			this.cpu[0].memorymap[0x48 + i].base = this.ram.base[0x24 + i];
			this.cpu[0].memorymap[0x48 + i].write = null;
		}
		this.cpu[0].memorymap[0x50].write = systemcontrolarea;
		for (let i = 0; i < 4; i++) {
			this.cpu[1].memorymap[i].read = addr => sound[0].read(addr);
			this.cpu[1].memorymap[i].write = (addr, data) => sound[0].write(addr, data);
		}
		this.cpu[1].memorymap[0x20].write = systemcontrolarea;
		for (let i = 0; i < 0x20; i++)
			this.cpu[1].memorymap[0xe0 + i].base = PRG2.base[i];

		this.cpu[1].breakpoint = hookBreakPoint1;
		this.cpu[1].set_breakpoint(0xea2c); // Get Ready

		// Videoの初期化
		this.bg = new Uint32Array(0x200000);
		this.obj = new Uint8Array(0x10000);
		this.objcolor = new Uint32Array(0x100);
		this.rgb = new Uint32Array(0x20);
		this.convertRGB();
		this.convertBG();
		this.convertOBJ();

		// 効果音の初期化
		this.se = [{buf: GETREADY, loop: false, start: false, stop: false}];

		// ライトハンドラ
		function systemcontrolarea(addr, data, game) {
			switch (addr & 0xff) {
			case 0x00: // INTERRUPT STOP
				game.fInterruptEnable1 = false;
				break;
			case 0x01: // INTERRUPT START
				game.fInterruptEnable1 = true;
				break;
			case 0x02: // INTERRUPT STOP
				game.fInterruptEnable0 = false;
				break;
			case 0x03: // INTERRUPT START
				game.fInterruptEnable0 = true;
				break;
			case 0x06: // SND STOP
				game.fSoundEnable = false;
				game.se[0].stop = true;
				break;
			case 0x07: // SND START
				game.fSoundEnable = true;
				break;
			case 0x08: // PORT TEST START
				game.fPortTest = true;
				break;
			case 0x09: // PORT TEST END
				game.fPortTest = false;
				break;
			case 0x0a: // SUB CPU STOP
				game.cpu[1].disable();
				break;
			case 0x0b: // SUB CPU START
				game.cpu[1].enable();
				break;
			}
		}

		// ブレークポイントコールバック
		function hookBreakPoint1(addr, game) {
			if (addr === 0xea2c)
				game.se[0].start = game.se[0].stop = true;
		}
	}

	execute() {
		sound[0].mute(!this.fSoundEnable);
		if (this.fInterruptEnable0)
			this.cpu[0].interrupt();
		if (this.fInterruptEnable1)
			this.cpu[1].interrupt();
		Cpu.multiple_execute(this.cpu, 0x2000);
		return this;
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// DIPスイッチの更新
		if (this.fDIPSwitchChanged) {
			this.fDIPSwitchChanged = false;
			switch (this.nGrobda) {
			case 3:
				this.port[0x10] &= ~3;
				break;
			case 1:
				this.port[0x10] = this.port[0x10] & ~3 | 1;
				break;
			case 2:
				this.port[0x10] = this.port[0x10] & ~3 | 2;
				break;
			case 5:
				this.port[0x10] |= 3;
				break;
			}
			switch (this.nRank) {
			case 'A':
				this.port[0x10] &= ~0x0c;
				break;
			case 'B':
				this.port[0x10] = this.port[0x10] & ~0x0c | 4;
				break;
			case 'C':
				this.port[0x10] = this.port[0x10] & ~0x0c | 8;
				break;
			case 'D':
				this.port[0x10] |= 0x0c;
				break;
			}
			switch (this.nExtend) {
			case 'A':
				this.port[0x11] &= ~0x0c;
				break;
			case 'NONE':
				this.port[0x11] = this.port[0x11] & ~0x0c | 4;
				break;
			case 'B':
				this.port[0x11] = this.port[0x11] & ~0x0c | 8;
				break;
			case 'C':
				this.port[0x11] |= 0x0c;
				break;
			}
			if (this.fAttract)
				this.port[0x11] &= ~1;
			else
				this.port[0x11] |= 1;
			if (this.fSelect)
				this.port[0x11] &= ~2;
			else
				this.port[0x11] |= 2;
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.port[0x12] |= 1;
		else
			this.port[0x12] &= ~1;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.se[0].stop = true;
			this.fSoundEnable = false;
			this.cpu[0].reset();
			this.cpu[1].disable();
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if (this.fCoin) {
			let i = (this.ram[0x2402] & 0x0f) * 10 + (this.ram[0x2403] & 0x0f);
			if (i < 150) {
				i++;
				if (i > 99)
					i = 99;
				this.ram[0x2402] = i / 10;
				this.ram[0x2403] = i % 10;
				this.ram[0x2400] = 1;
			}
		}
		if (this.fStart1P) {
			this.port[8 - this.ram[0x2408]] |= 8;
			if (!this.ram[0x2409]) {
				let i = (this.ram[0x2402] & 0x0f) * 10 + (this.ram[0x2403] & 0x0f);
				if (i >= 150)
					this.ram[0x2401] |= 1;
				else if (i > 0) {
					--i;
					this.ram[0x2402] = i / 10;
					this.ram[0x2403] = i % 10;
					this.ram[0x2401] |= 1;
				}
			}
		}
		else
			this.port[8 - this.ram[0x2408]] &= ~8;
		if (this.fStart2P) {
			this.port[8 - this.ram[0x2408]] |= 4;
			if (!this.ram[0x2409]) {
				let i = (this.ram[0x2402] & 0x0f) * 10 + (this.ram[0x2403] & 0x0f);
				if (i >= 150)
					this.ram[0x2401] |= 2;
				else if (i > 1) {
					i -= 2;
					this.ram[0x2402] = i / 10;
					this.ram[0x2403] = i % 10;
					this.ram[0x2401] |= 2;
				}
			}
		}
		else
			this.port[8 - this.ram[0x2408]] &= ~4;
		this.fCoin = this.fStart1P = this.fStart2P = false;

		if (!this.fPortTest) {
			let i, p;
			this.ram.set(this.port.subarray(4, 8), 0x2404);
			this.ram.set(this.port.subarray(0x10, 0x18), 0x2410);
			switch (this.ram[0x2408] & 0x0f) {
			case 5:
				this.ram[0x2402] = 0x0f;
				this.ram[0x2406] = 0x0c;
				break;
			case 8:
				for (i = 0, p = 0x2409; p < 0x2410; p++)
					i += this.ram[p] & 0x0f;
				this.ram[0x2400] = i >>> 4 & 0x0f;
				this.ram[0x2401] = i & 0x0f;
				break;
			}
			if ((this.ram[0x2418] & 0x0f) === 8) {
				for (i = 0, p = 0x2419; p < 0x2420; p++)
					i += this.ram[p] & 0x0f;
				this.ram[0x2410] = i >>> 4 & 0x0f;
				this.ram[0x2411] = i & 0x0f;
			}
		}
		return this;
	}

	coin() {
		this.fCoin = true;
	}

	start1P() {
		this.fStart1P = true;
	}

	start2P() {
		this.fStart2P = true;
	}

	up(fDown) {
		const r = 7 - this.ram[0x2408] & 0x1f;

		if (fDown)
			this.port[r] = this.port[r] & ~4 | 1;
		else
			this.port[r] &= ~1;
	}

	right(fDown) {
		const r = 7 - this.ram[0x2408] & 0x1f;

		if (fDown)
			this.port[r] = this.port[r] & ~8 | 2;
		else
			this.port[r] &= ~2;
	}

	down(fDown) {
		const r = 7 - this.ram[0x2408] & 0x1f;

		if (fDown)
			this.port[r] = this.port[r] & ~1 | 4;
		else
			this.port[r] &= ~4;
	}

	left(fDown) {
		const r = 7 - this.ram[0x2408] & 0x1f;

		if (fDown)
			this.port[r] = this.port[r] & ~2 | 8;
		else
			this.port[r] &= ~8;
	}

	triggerA(fDown) {
		if (fDown)
			this.port[8 - this.ram[0x2408] & 0x1f] |= 2;
		else
			this.port[8 - this.ram[0x2408] & 0x1f] &= ~2;
	}

	triggerB(fDown) {
		if (fDown)
			this.port[0x16] |= 1;
		else
			this.port[0x16] &= ~1;
	}

	convertRGB() {
		for (let i = 0; i < 0x20; i++)
			this.rgb[i] = (RGB[i] & 7) * 255 / 7	// Red
				| (RGB[i] >>> 3 & 7) * 255 / 7 << 8	// Green
				| (RGB[i] >>> 6) * 255 / 3 << 16;	// Blue
	}

	convertBG() {
		for (let p = 0, q = 0, i = 256; i !== 0; q += 16, --i) {
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k + 8] >>> j & 1 | BG[q + k + 8] >>> (j + 3) & 2;
			for (let j = 3; j >= 0; --j)
				for (let k = 7; k >= 0; --k)
					this.bg[p++] = BG[q + k] >>> j & 1 | BG[q + k] >>> (j + 3) & 2;
		}
		for (let p = 0, i = 127; i !== 0; p += 0x4000, --i)
			this.bg.copyWithin(p + 0x4000, p, p + 0x4000);
		for (let p = 0, i = 0; i < 64; i++)
			for (let j = 0x4000; j !== 0; p++, --j)
				this.bg[p] = this.rgb[~BGCOLOR[i * 4 + this.bg[p]] & 0x0f | 0x10];
		for (let p = 0x100000, i = 0; i < 64; i++)
			for (let j = 0x4000; j !== 0; p++, --j) {
				const idx = ~BGCOLOR[i * 4 + this.bg[p]] & 0x0f | 0x10;
				this.bg[p] = idx === 0x1f ? this.rgb[idx] : this.rgb[idx] | 0xff000000;
			}
	}

	convertOBJ() {
		// obj palette
		for (let i = 0; i < 0x100; i++) {
			const idx = OBJCOLOR[i] & 0x0f;
			this.objcolor[i] = idx === 0x0f ? 0xffffffff : this.rgb[idx];
		}

		for (let p = 0, q = 0, i = 256; i !== 0; q += 64, --i) {
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 32] >>> j & 1 | OBJ[q + k + 32] >>> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k] >>> j & 1 | OBJ[q + k] >>> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 40] >>> j & 1 | OBJ[q + k + 40] >>> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 8] >>> j & 1 | OBJ[q + k + 8] >>> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 48] >>> j & 1 | OBJ[q + k + 48] >>> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 16] >>> j & 1 | OBJ[q + k + 16] >>> (j + 3) & 2;
			}
			for (let j = 3; j >= 0; --j) {
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 56] >>> j & 1 | OBJ[q + k + 56] >>> (j + 3) & 2;
				for (let k = 7; k >= 0; --k)
					this.obj[p++] = OBJ[q + k + 24] >>> j & 1 | OBJ[q + k + 24] >>> (j + 3) & 2;
			}
		}
	}

	static convertGETREADY() {
		const voicebuf = new Int16Array(0x3000);
		let i, j, k, d, m;

		// Get Ready
		k = 0x0a6c;
		i = 0;
		while (PRG2[k]) {
			if (PRG2[k] === 7) {
				m = ((PRG2[k++] & 0x0f) - 8) * 3 << 9;
				for (j = 0; j < 13; j++)
					voicebuf[i++] = m;
			} else {
				m = ((PRG2[k] & 0x0f) - 8) * 3 << 9;
				for (j = 0; j < 4; j++)
					voicebuf[i++] = m;
				m = ((PRG2[k++] >>> 4) - 8) * 3 << 9;
				for (j = 0; j < 3; j++)
					voicebuf[i++] = m;
			}
		}

		// 14800Hzのオリジナルを22050Hzにコンバート
		j = k = d = 0;
		while (k < i) {
			GETREADY[j++] = voicebuf[k];
			d += 14800;
			k += d / 22050 | 0;
			d %= 22050;
		}
	}

	makeBitmap(data) {
		// bg描画
		let p = 256 * 8 * 4 + 232;
		let k = 0x40;
		for (let i = 0; i < 28; p -= 256 * 8 * 32 + 8, i++)
			for (let j = 0; j < 32; k++, p += 256 * 8, j++)
				this.xfer8x8(data, p, k);
		p = 256 * 8 * 36 + 232;
		k = 2;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k);
		p = 256 * 8 * 37 + 232;
		k = 0x22;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k);
		p = 256 * 8 * 2 + 232;
		k = 0x3c2;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k);
		p = 256 * 8 * 3 + 232;
		k = 0x3e2;
		for (let i = 0; i < 28; p -= 8, k++, i++)
			this.xfer8x8(data, p, k);

		// obj描画
		for (let p = 0x0f80, i = 64; i !== 0; p += 2, --i) {
			const y = this.ram[p + 0x801] + this.ram[p + 0x1001] * 0x100 - 24 & 0x1ff;
			const x = this.ram[p + 0x800] - 1 & 0xff;
			switch (this.ram[p + 0x1000] & 0x0f) {
			case 0x00: // ノーマル
				this.xfer16x16(data, x | y << 8, this.ram[p + 1] << 8 | this.ram[p]);
				break;
			case 0x01: // V反転
				this.xfer16x16V(data, x | y << 8, this.ram[p + 1] << 8 | this.ram[p]);
				break;
			case 0x02: // H反転
				this.xfer16x16H(data, x | y << 8, this.ram[p + 1] << 8 | this.ram[p]);
				break;
			case 0x03: // HV反転
				this.xfer16x16HV(data, x | y << 8, this.ram[p + 1] << 8 | this.ram[p]);
				break;
			case 0x04: // ノーマル
				this.xfer16x16(data, x | y << 8, this.ram[p + 1] << 8 | this.ram[p] & ~1);
				this.xfer16x16(data, x | (y + 16 & 0x1ff) << 8, this.ram[p + 1] << 8 | this.ram[p] | 1);
				break;
			case 0x05: // V反転
				this.xfer16x16V(data, x | y << 8, this.ram[p + 1] << 8 | this.ram[p] | 1);
				this.xfer16x16V(data, x | (y + 16 & 0x1ff) << 8, this.ram[p + 1] << 8 | this.ram[p] & ~1);
				break;
			case 0x06: // H反転
				this.xfer16x16H(data, x | y << 8, this.ram[p + 1] << 8 | this.ram[p] & ~1);
				this.xfer16x16H(data, x | (y + 16 & 0x1ff) << 8, this.ram[p + 1] << 8 | this.ram[p] | 1);
				break;
			case 0x07: // HV反転
				this.xfer16x16HV(data, x | y << 8, this.ram[p + 1] << 8 | this.ram[p] | 1);
				this.xfer16x16HV(data, x | (y + 16 & 0x1ff) << 8, this.ram[p + 1] << 8 | this.ram[p] & ~1);
				break;
			case 0x08: // ノーマル
				this.xfer16x16(data, x | y << 8, this.ram[p + 1] << 8 | this.ram[p] | 2);
				this.xfer16x16(data, x + 16 & 0xff | y << 8, this.ram[p + 1] << 8 | this.ram[p] & ~2);
				break;
			case 0x09: // V反転
				this.xfer16x16V(data, x | y << 8, this.ram[p + 1] << 8 | this.ram[p] | 2);
				this.xfer16x16V(data, x + 16 & 0xff | y << 8, this.ram[p + 1] << 8 | this.ram[p] & ~2);
				break;
			case 0x0a: // H反転
				this.xfer16x16H(data, x | y << 8, this.ram[p + 1] << 8 | this.ram[p] & ~2);
				this.xfer16x16H(data, x + 16 & 0xff | y << 8, this.ram[p + 1] << 8 | this.ram[p] | 2);
				break;
			case 0x0b: // HV反転
				this.xfer16x16HV(data, x | y << 8, this.ram[p + 1] << 8 | this.ram[p] & ~2);
				this.xfer16x16HV(data, x + 16 & 0xff | y << 8, this.ram[p + 1] << 8 | this.ram[p] | 2);
				break;
			case 0x0c: // ノーマル
				this.xfer16x16(data, x | y << 8, this.ram[p + 1] << 8 | this.ram[p] & ~3 | 2);
				this.xfer16x16(data, x | (y + 16 & 0x1ff) << 8, this.ram[p + 1] << 8 | this.ram[p] | 3);
				this.xfer16x16(data, x + 16 & 0xff | y << 8, this.ram[p + 1] << 8 | this.ram[p] & ~3);
				this.xfer16x16(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, this.ram[p + 1] << 8 | this.ram[p] & ~3 | 1);
				break;
			case 0x0d: // V反転
				this.xfer16x16V(data, x | y << 8, this.ram[p + 1] << 8 | this.ram[p] | 3);
				this.xfer16x16V(data, x | (y + 16 & 0x1ff) << 8, this.ram[p + 1] << 8 | this.ram[p] & ~3 | 2);
				this.xfer16x16V(data, x + 16 & 0xff | y << 8, this.ram[p + 1] << 8 | this.ram[p] & ~3 | 1);
				this.xfer16x16V(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, this.ram[p + 1] << 8 | this.ram[p] & ~3);
				break;
			case 0x0e: // H反転
				this.xfer16x16H(data, x | y << 8, this.ram[p + 1] << 8 | this.ram[p] & ~3);
				this.xfer16x16H(data, x | (y + 16 & 0x1ff) << 8, this.ram[p + 1] << 8 | this.ram[p] & ~3 | 1);
				this.xfer16x16H(data, x + 16 & 0xff | y << 8, this.ram[p + 1] << 8 | this.ram[p] & ~3 | 2);
				this.xfer16x16H(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, this.ram[p + 1] << 8 | this.ram[p] | 3);
				break;
			case 0x0f: // HV反転
				this.xfer16x16HV(data, x | y << 8, this.ram[p + 1] << 8 | this.ram[p] & ~3 | 1);
				this.xfer16x16HV(data, x | (y + 16 & 0x1ff) << 8, this.ram[p + 1] << 8 | this.ram[p] & ~3);
				this.xfer16x16HV(data, x + 16 & 0xff | y << 8, this.ram[p + 1] << 8 | this.ram[p] | 3);
				this.xfer16x16HV(data, x + 16 & 0xff | (y + 16 & 0x1ff) << 8, this.ram[p + 1] << 8 | this.ram[p] & ~3 | 2);
				break;
			}
		}

		// alphaチャンネル修正
		p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] |= 0xff000000;
	}

	xfer8x8(data, p, k) {
		const q = ((this.ram[k + 0x400] << 8 | this.ram[k]) & 0x7fff) << 6;

		data[p + 0x000] = this.bg[q + 0x00];
		data[p + 0x001] = this.bg[q + 0x01];
		data[p + 0x002] = this.bg[q + 0x02];
		data[p + 0x003] = this.bg[q + 0x03];
		data[p + 0x004] = this.bg[q + 0x04];
		data[p + 0x005] = this.bg[q + 0x05];
		data[p + 0x006] = this.bg[q + 0x06];
		data[p + 0x007] = this.bg[q + 0x07];
		data[p + 0x100] = this.bg[q + 0x08];
		data[p + 0x101] = this.bg[q + 0x09];
		data[p + 0x102] = this.bg[q + 0x0a];
		data[p + 0x103] = this.bg[q + 0x0b];
		data[p + 0x104] = this.bg[q + 0x0c];
		data[p + 0x105] = this.bg[q + 0x0d];
		data[p + 0x106] = this.bg[q + 0x0e];
		data[p + 0x107] = this.bg[q + 0x0f];
		data[p + 0x200] = this.bg[q + 0x10];
		data[p + 0x201] = this.bg[q + 0x11];
		data[p + 0x202] = this.bg[q + 0x12];
		data[p + 0x203] = this.bg[q + 0x13];
		data[p + 0x204] = this.bg[q + 0x14];
		data[p + 0x205] = this.bg[q + 0x15];
		data[p + 0x206] = this.bg[q + 0x16];
		data[p + 0x207] = this.bg[q + 0x17];
		data[p + 0x300] = this.bg[q + 0x18];
		data[p + 0x301] = this.bg[q + 0x19];
		data[p + 0x302] = this.bg[q + 0x1a];
		data[p + 0x303] = this.bg[q + 0x1b];
		data[p + 0x304] = this.bg[q + 0x1c];
		data[p + 0x305] = this.bg[q + 0x1d];
		data[p + 0x306] = this.bg[q + 0x1e];
		data[p + 0x307] = this.bg[q + 0x1f];
		data[p + 0x400] = this.bg[q + 0x20];
		data[p + 0x401] = this.bg[q + 0x21];
		data[p + 0x402] = this.bg[q + 0x22];
		data[p + 0x403] = this.bg[q + 0x23];
		data[p + 0x404] = this.bg[q + 0x24];
		data[p + 0x405] = this.bg[q + 0x25];
		data[p + 0x406] = this.bg[q + 0x26];
		data[p + 0x407] = this.bg[q + 0x27];
		data[p + 0x500] = this.bg[q + 0x28];
		data[p + 0x501] = this.bg[q + 0x29];
		data[p + 0x502] = this.bg[q + 0x2a];
		data[p + 0x503] = this.bg[q + 0x2b];
		data[p + 0x504] = this.bg[q + 0x2c];
		data[p + 0x505] = this.bg[q + 0x2d];
		data[p + 0x506] = this.bg[q + 0x2e];
		data[p + 0x507] = this.bg[q + 0x2f];
		data[p + 0x600] = this.bg[q + 0x30];
		data[p + 0x601] = this.bg[q + 0x31];
		data[p + 0x602] = this.bg[q + 0x32];
		data[p + 0x603] = this.bg[q + 0x33];
		data[p + 0x604] = this.bg[q + 0x34];
		data[p + 0x605] = this.bg[q + 0x35];
		data[p + 0x606] = this.bg[q + 0x36];
		data[p + 0x607] = this.bg[q + 0x37];
		data[p + 0x700] = this.bg[q + 0x38];
		data[p + 0x701] = this.bg[q + 0x39];
		data[p + 0x702] = this.bg[q + 0x3a];
		data[p + 0x703] = this.bg[q + 0x3b];
		data[p + 0x704] = this.bg[q + 0x3c];
		data[p + 0x705] = this.bg[q + 0x3d];
		data[p + 0x706] = this.bg[q + 0x3e];
		data[p + 0x707] = this.bg[q + 0x3f];
	}

	xfer16x16(data, dst, src) {
		const idx = src >>> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) <= 8 * 0x100 || dst >= 304 * 0x100)
			return;
		src = src << 8 & 0xff00;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx + this.obj[src++]]) !== 0xffffffff && (data[dst] & 0xff000000) === 0)
					data[dst] = px;
	}

	xfer16x16V(data, dst, src) {
		const idx = src >>> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) <= 8 * 0x100 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 256 - 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src -= 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx + this.obj[src++]]) !== 0xffffffff && (data[dst] & 0xff000000) === 0)
					data[dst] = px;
	}

	xfer16x16H(data, dst, src) {
		const idx = src >>> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) <= 8 * 0x100 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 16;
		for (let i = 16; i !== 0; dst += 256 - 16, src += 32, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx + this.obj[--src]]) !== 0xffffffff && (data[dst] & 0xff000000) === 0)
					data[dst] = px;
	}

	xfer16x16HV(data, dst, src) {
		const idx = src >>> 6 & 0xfc;
		let px;

		if ((dst & 0xff) === 0 || (dst & 0xff) >= 240 || (dst & 0x1ff00) <= 8 * 0x100 || dst >= 304 * 0x100)
			return;
		src = (src << 8 & 0xff00) + 256;
		for (let i = 16; i !== 0; dst += 256 - 16, --i)
			for (let j = 16; j !== 0; dst++, --j)
				if ((px = this.objcolor[idx + this.obj[--src]]) !== 0xffffffff && (data[dst] & 0xff000000) === 0)
					data[dst] = px;
	}
}

/*
 *
 *	Grobda
 *
 */

const GETREADY = new Int16Array(Math.ceil(8837 * 22050 / 14800));
const url = 'grobda.zip';
let SND, BG, OBJ, BGCOLOR, OBJCOLOR, RGB, PRG1, PRG2;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	PRG1 = new Uint8Array((zip.files['gr2-3.1d'].inflate() + zip.files['gr2-2.1c'].inflate() + zip.files['gr2-1.1b'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	PRG2 = new Uint8Array(zip.files['gr1-4.1k'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	BG = new Uint8Array(zip.files['gr1-7.3c'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJ = new Uint8Array((zip.files['gr1-5.3f'].inflate() + zip.files['gr1-6.3e'].inflate()).split('').map(c => c.charCodeAt(0)));
	RGB = new Uint8Array(zip.files['gr1-6.4c'].inflate().split('').map(c => c.charCodeAt(0)));
	BGCOLOR = new Uint8Array(zip.files['gr1-5.4e'].inflate().split('').map(c => c.charCodeAt(0)));
	OBJCOLOR = new Uint8Array(zip.files['gr1-4.3l'].inflate().split('').map(c => c.charCodeAt(0)));
	SND = new Uint8Array(zip.files['gr1-3.3m'].inflate().split('').map(c => c.charCodeAt(0)));
	Grobda.convertGETREADY();
	init({
		game: game = new Grobda(),
		sound: sound = [
			new MappySound({SND}),
			new SoundEffect({se: game.se, freq: 22050}),
		],
	});
	loop();
}
