/*
 *
 *	Tank Force
 *
 */

import YM2151 from './ym2151.js';
import C30 from './c30.js';
import Dac8Bit2Ch from './dac_8bit_2ch.js';
import Cpu, {dummypage, init, loop} from './main.js';
import MC6809 from './mc6809.js';
import MC6801 from './mc6801.js';
let sound;

class TankForce {
	constructor() {
		this.cxScreen = 224;
		this.cyScreen = 288;
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

		// CPU周りの初期化
		this.memorymap = [];
		for (let i = 0; i < 0x8000; i++)
			this.memorymap.push({base: dummypage, read: null, write: () => {}, fetch: null});
		this.ram = new Uint8Array(0x18000).addBase();
		this.ram2 = new Uint8Array(0x800).addBase();
		this.ram3 = new Uint8Array(0x2000).addBase();
		this.ram4 = new Uint8Array(0x900).addBase();
		this.fm = {addr: 0, reg: new Uint8Array(0x100), status: 0, timera: 0, timerb: 0};
		this.in = Uint8Array.of(0xff, 0xff, 0xff, 0xf8);
		this.key = new Uint8Array(8);
		this.count = 0;
		this.bank1 = new Uint16Array(8);
		this.bank2 = new Uint16Array(8);
		this.bank3 = 0x40;
		this.bank4 = 0x80;
		this.cpu_irq = false;
		this.cpu2_irq = false;
		this.cpu2_firq = false;
		this.cpu3_irq = false;
		this.mcu_irq = false;

		const range = (page, start, end, mirror = 0) => (page & ~mirror) >= start && (page & ~mirror) <= end;

		for (let page = 0; page < 0x8000; page++)
			if (range(page, 0x2e00, 0x2e17)) {
				this.memorymap[page].read = addr => this.rgb[addr & 0x7ff] >> (addr >> 8 & 0x18) & 0xff;
				this.memorymap[page].write = (addr, data) => {
					const idx = addr & 0x7ff, shift = addr >> 8 & 0x18;
					this.rgb[idx] = this.rgb[idx] & ~(0xff << shift) | data << shift;
				};
			}
			else if (range(page, 0x2e18, 0x2e1f, 0x60)) {
				this.memorymap[page].read = addr => this.ram[0x7800 | addr & 0xf];
				this.memorymap[page].write = (addr, data) => void(this.ram[0x7800 | addr & 0xf] = data);
			}
			else if (range(page, 0x2e20, 0x2e37)) {
				this.memorymap[page].read = addr => this.rgb[0x800 | addr & 0x7ff] >> (addr >> 8 & 0x18) & 0xff;
				this.memorymap[page].write = (addr, data) => {
					const idx = 0x800 | addr & 0x7ff, shift = addr >> 8 & 0x18;
					this.rgb[idx] = this.rgb[idx] & ~(0xff << shift) | data << shift;
				};
			}
			else if (range(page, 0x2e40, 0x2e57)) {
				this.memorymap[page].read = addr => this.rgb[0x1000 | addr & 0x7ff] >> (addr >> 8 & 0x18) & 0xff;
				this.memorymap[page].write = (addr, data) => {
					const idx = 0x1000 | addr & 0x7ff, shift = addr >> 8 & 0x18;
					this.rgb[idx] = this.rgb[idx] & ~(0xff << shift) | data << shift;
				};
			}
			else if (range(page, 0x2e60, 0x2e77)) {
				this.memorymap[page].base = this.ram.base[0x60 | page & 0x1f];
				this.memorymap[page].write = null;
			}
			else if (range(page, 0x2f00, 0x2f7f)) {
				this.memorymap[page].base = this.ram.base[0x80 | page & 0x7f];
				this.memorymap[page].write = null;
			}
			else if (range(page, 0x2f80, 0x2f9f)) {
				this.memorymap[page].read = addr => [0, 0, addr << 4 & 0xf0 | this.key[1] & 0xf, 0, 0, 185, 0, 0][addr >> 4 & 7];
				this.memorymap[page].write = (addr, data) => void(this.key[addr >> 4 & 7] = data);
			}
			else if (range(page, 0x2fc0, 0x2fcf)) {
				this.memorymap[page].base = this.ram.base[0x50 | page & 0xf];
				this.memorymap[page].write = null;
			}
			else if (range(page, 0x2fd0, 0x2fdf)) {
				this.memorymap[page].read = addr => this.ram[0x4000 | addr & 0x1f];
				this.memorymap[page].write = (addr, data) => void(this.ram[0x4000 | addr & 0x1f] = data);
			}
			else if (range(page, 0x2fe0, 0x2fef)) {
				this.memorymap[page].read = addr => sound[1].read(addr);
				this.memorymap[page].write = (addr, data) => sound[1].write(addr, data, this.count);
			}
			else if (range(page, 0x2ff0, 0x2fff)) {
				this.memorymap[page].base = this.ram2.base[page & 7];
				this.memorymap[page].write = null;
			}
			else if (range(page, 0x3000, 0x307f)) {
				this.memorymap[page].base = this.ram.base[0x100 | page & 0x7f];
				this.memorymap[page].write = null;
			}
			else if (range(page, 0x4000, 0x4fff))
				this.memorymap[page].base = PRG.base[page >> 2 & 0x200 | page & 0x1ff];
			else if (range(page, 0x7800, 0x7fff))
				this.memorymap[page].base = PRG.base[0x400 | page & 0x1ff ^ 0x100];

		this.cpu = new MC6809(this);
		for (let i = 0; i < 0x20; i++)
			this.cpu.memorymap[0xe0 + i].write = (addr, data) => {
				const reg = addr >> 9 & 0xf;
				if (reg < 8)
					return this.bankswitch(reg, (addr & 1) === 0 ? data << 13 & 0x6000 | this.bank1[reg] & 0x1fe0 : this.bank1[reg] & 0x6000 | data << 5);
				switch (reg) {
				case 8:
					if ((data & 1) === 0) {
						this.cpu2.disable();
						this.cpu3.disable();
						this.mcu.disable();
					}
					else {
						this.cpu2.enable();
						this.cpu3.enable();
						this.mcu.enable();
					}
					return;
				case 11:
					return void(this.cpu_irq = false);
				case 13:
					return void(this.cpu2_firq = true);
				case 14:
					return this.bankswitch2(7, 0x6000 | data << 5);
				}
			};

		this.cpu.check_interrupt = () => this.cpu_irq && this.cpu.interrupt();

		this.cpu2 = new MC6809(this);
		for (let i = 0; i < 0x20; i++)
			this.cpu2.memorymap[0xe0 + i].write = (addr, data) => {
				const reg = addr >> 9 & 0xf;
				if (reg < 8)
					return this.bankswitch2(reg, (addr & 1) === 0 ? data << 13 & 0x6000 | this.bank2[reg] & 0x1fe0 : this.bank2[reg] & 0x6000 | data << 5);
				switch (reg) {
				case 11:
					return void(this.cpu2_irq = false);
				case 12:
					return void(this.cpu2_firq = false);
				}
			};

		this.cpu2.check_interrupt = () => this.cpu2_irq && this.cpu2.interrupt() || this.cpu2_firq && this.cpu2.fast_interrupt();

		this.cpu3 = new MC6809(this);
		for (let i = 0; i < 0x40; i++)
			this.cpu3.memorymap[i].base = SND.base[0x40 + i];
		this.cpu3.memorymap[0x40].read = addr => addr === 0x4001 ? this.fm.status : 0xff;
		this.cpu3.memorymap[0x40].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				return void(this.fm.addr = data);
			case 1:
				if (this.fm.addr === 0x14) { // CSM/F RESET/IRQEN/LOAD
					this.fm.status &= ~(data >> 4 & 3);
					if ((data & ~this.fm.reg[0x14] & 1) !== 0)
						this.fm.timera = this.fm.reg[0x10] << 2 | this.fm.reg[0x11] & 3;
					if ((data & ~this.fm.reg[0x14] & 2) !== 0)
						this.fm.timerb = this.fm.reg[0x12];
				}
				return sound[0].write(this.fm.addr, this.fm.reg[this.fm.addr] = data, this.count);
			}
		};
		for (let i = 0; i < 8; i++) {
			this.cpu3.memorymap[0x50 + i].read = addr => sound[1].read(addr);
			this.cpu3.memorymap[0x50 + i].write = (addr, data) => sound[1].write(addr, data, this.count);
		}
		for (let i = 0; i < 8; i++) {
			this.cpu3.memorymap[0x70 + i].base = this.ram2.base[i];
			this.cpu3.memorymap[0x70 + i].write = null;
		}
		for (let i = 0; i < 0x20; i++) {
			this.cpu3.memorymap[0x80 + i].base = this.ram3.base[i];
			this.cpu3.memorymap[0x80 + i].write = null;
		}
		for (let i = 0; i < 0x40; i++)
			this.cpu3.memorymap[0xc0 + i].base = SND.base[i];
		this.cpu3.memorymap[0xc0].write = (addr, data) => this.bankswitch3(data << 2 & 0x1c0);
		this.cpu3.memorymap[0xe0].write = () => void(this.cpu3_irq = false);

		this.cpu3.check_interrupt = () => this.cpu3_irq && this.cpu3.interrupt() || (this.fm.status & 3) !== 0 && this.cpu3.fast_interrupt();

		this.mcu = new MC6801(this);
		this.mcu.memorymap[0].base = this.ram4.base[0];
		this.mcu.memorymap[0].read = addr => {
			switch (addr) {
			case 2:
				return this.in[3];
			case 8:
				const data = this.ram4[8];
				this.ram4[8] &= ~0xe0;
				return data;
			}
			return this.ram4[addr];
		}
		this.mcu.memorymap[0].write = (addr, data) => {
			if (addr === 3) {
				sound[2].channel[0].gain = ((data >> 1 & 2 | data & 1) + 1) / 4;
				sound[2].channel[1].gain = ((data >> 3 & 3) + 1) / 4;
			}
			this.ram4[addr] = data;
		}
		this.mcu.memorymap[0x10].read = addr => this.in[2] >> (~addr << 1 & 4) | 0xf0;
		this.mcu.memorymap[0x14].read = addr => this.in[addr & 1];
		for (let i = 0; i < 0x80; i++)
			this.mcu.memorymap[0x40 + i].base = VOI.base[0x80 + i];
		for (let i = 0; i < 8; i++) {
			this.mcu.memorymap[0xc0 + i].base = this.ram2.base[i];
			this.mcu.memorymap[0xc0 + i].write = null;
		}
		this.mcu.memorymap[0xc0].write = (addr, data) => void(addr === 0xc000 && this.ram2[0] === 0xa6 || (this.ram2[addr & 0xff] = data));
		for (let i = 0; i < 8; i++) {
			this.mcu.memorymap[0xc8 + i].base = this.ram4.base[1 + i];
			this.mcu.memorymap[0xc8 + i].write = null;
		}
		this.mcu.memorymap[0xd0].write = (addr, data) => sound[2].write(0, data, this.count);
		this.mcu.memorymap[0xd4].write = (addr, data) => sound[2].write(1, data, this.count);
		this.mcu.memorymap[0xd8].write = (addr, data) => {
			const index = [0xf8, 0xf4, 0xec, 0xdc, 0xbc, 0x7c].indexOf(data & 0xfc);
			this.bankswitch4(index > 0 ? index << 9 | data << 7 & 0x180 : index === 0 ? data << 7 & 0x180 ^ 0x100 : 0);
		};
		for (let i = 0; i < 0x10; i++)
			this.mcu.memorymap[0xf0 + i].base = MCU.base[i];
		this.mcu.memorymap[0xf0].write = () => void(this.mcu_irq = false);

		this.mcu.check_interrupt = () => this.mcu_irq && this.mcu.interrupt() || (this.ram4[8] & 0x40) !== 0 && this.mcu.interrupt('ocf');

		// Videoの初期化
		this.chr = new Uint8Array(0x100000).fill(0xff);
		this.obj = new Uint8Array(0x200000).fill(0xf);
		this.rgb = new Uint32Array(0x2000).fill(0xff000000);
		this.convertCHR();
		this.convertOBJ();
	}

	bankswitch(reg, bank) {
		if (bank === this.bank1[reg])
			return;
		if (reg < 7)
			for (let i = 0; i < 0x20; i++)
				Object.assign(this.cpu.memorymap[(reg << 5) + i], this.memorymap[bank + i]);
		else
			for (let i = 0; i < 0x20; i++) {
				const {base, read, fetch} = this.memorymap[bank + i];
				Object.assign(this.cpu.memorymap[0xe0 + i], {base, read, fetch});
			}
		this.bank1[reg] = bank;
	}

	bankswitch2(reg, bank) {
		if (bank === this.bank2[reg])
			return;
		if (reg < 7)
			for (let i = 0; i < 0x20; i++)
				Object.assign(this.cpu2.memorymap[(reg << 5) + i], this.memorymap[bank + i]);
		else
			for (let i = 0; i < 0x20; i++) {
				const {base, read, fetch} = this.memorymap[bank + i];
				Object.assign(this.cpu2.memorymap[0xe0 + i], {base, read, fetch});
			}
		this.bank2[reg] = bank;
	}

	bankswitch3(bank) {
		if (bank === this.bank3)
			return;
		if (bank < 0x200)
			for (let i = 0; i < 0x40; i++)
				this.cpu3.memorymap[i].base = SND.base[bank + i];
		else
			for (let i = 0; i < 0x40; i++)
				this.cpu3.memorymap[i].base = dummypage;
		this.bank3 = bank;
	}

	bankswitch4(bank) {
		if (bank === this.bank4)
			return;
		if (bank < 0x400)
			for (let i = 0; i < 0x80; i++)
				this.mcu.memorymap[0x40 + i].base = VOI.base[bank + i];
		else
			for (let i = 0; i < 0x80; i++)
				this.mcu.memorymap[0x40 + i].base = dummypage;
		this.bank4 = bank;
	}

	execute() {
		this.cpu_irq = this.cpu2_irq = this.cpu3_irq = this.mcu_irq = true;
		for (this.count = 0; this.count < 29; this.count++) {
			Cpu.multiple_execute([this.cpu, this.cpu2, this.cpu3], 146);
			if ((this.fm.reg[0x14] & 1) !== 0 && (this.fm.timera += 16) >= 0x400) {
				this.fm.timera = (this.fm.timera & 0x3ff) + (this.fm.reg[0x10] << 2 | this.fm.reg[0x11] & 3);
				this.fm.status |= this.fm.reg[0x14] >> 2 & 1;
			}
			if ((this.fm.reg[0x14] & 2) !== 0 && ++this.fm.timerb >= 0x100) {
				this.fm.timerb = (this.fm.timerb & 0xff) + this.fm.reg[0x12];
				this.fm.status |= this.fm.reg[0x14] >> 2 & 2;
			}
		}
		for (this.count = 0; this.count < 50; this.count++) {
			(this.ram4[8] & 8) !== 0 && (this.ram4[8] |= 0x40);
			this.mcu.execute(84);
		}
		for (this.count = 29; this.count < 58; this.count++) { // 3579580 / 60 / 1024
			Cpu.multiple_execute([this.cpu, this.cpu2, this.cpu3], 146);
			if ((this.fm.reg[0x14] & 1) !== 0 && (this.fm.timera += 16) >= 0x400) {
				this.fm.timera = (this.fm.timera & 0x3ff) + (this.fm.reg[0x10] << 2 | this.fm.reg[0x11] & 3);
				this.fm.status |= this.fm.reg[0x14] >> 2 & 1;
			}
			if ((this.fm.reg[0x14] & 2) !== 0 && ++this.fm.timerb >= 0x100) {
				this.fm.timerb = (this.fm.timerb & 0xff) + this.fm.reg[0x12];
				this.fm.status |= this.fm.reg[0x14] >> 2 & 2;
			}
		}
		for (this.count = 50; this.count < 100; this.count++) {
			(this.ram4[8] & 8) !== 0 && (this.ram4[8] |= 0x40);
			this.mcu.execute(84);
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
			if (!this.fTest)
				this.fReset = true;
		}

		if (this.fTest)
			this.in[2] &= ~0x80;
		else
			this.in[2] |= 0x80;

		// リセット処理
		if (this.fReset) {
			this.fReset = false;
//			this.ram4[0x14] = 0; // for cold boot
			this.cpu_irq = this.cpu2_irq = this.cpu2_firq = this.cpu3_irq = this.mcu_irq = false;
			this.bankswitch(0, 0x3000);
			this.bankswitch(1, 0x3000);
			this.bankswitch(7, 0x7fe0);
			this.bankswitch2(0, 0x3000);
			this.bankswitch2(7, 0x7fe0);
			this.bankswitch3(0x40);
			this.bankswitch4(0x80);
			this.cpu.reset();
			this.cpu2.disable();
			this.cpu3.disable();
			this.mcu.disable();
		}
		return this;
	}

	updateInput() {
		// クレジット/スタートボタン処理
		if (this.fCoin) {
			--this.fCoin;
			this.in[3] &= ~(1 << 6);
		}
		else
			this.in[3] |= 1 << 6;
		if (this.fStart1P) {
			--this.fStart1P;
			this.in[0] &= ~(1 << 7);
		}
		else
			this.in[0] |= 1 << 7;
		if (this.fStart2P) {
			--this.fStart2P;
			this.in[1] &= ~(1 << 7);
		}
		else
			this.in[1] |= 1 << 7;

		// 連射処理
		if (this.fTurbo)
			this.in[0] ^= 1 << 4;
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
			this.in[0] = this.in[0] & ~(1 << 0) | 1 << 1;
		else
			this.in[0] |= 1 << 0;
	}

	down(fDown) {
		if (fDown)
			this.in[0] = this.in[0] & ~(1 << 2) | 1 << 3;
		else
			this.in[0] |= 1 << 2;
	}

	left(fDown) {
		if (fDown)
			this.in[0] = this.in[0] & ~(1 << 1) | 1 << 0;
		else
			this.in[0] |= 1 << 1;
	}

	triggerA(fDown) {
		if (fDown)
			this.in[0] &= ~(1 << 4);
		else
			this.in[0] |= 1 << 4;
	}

	triggerB(fDown) {
		if ((this.fTurbo = fDown) === false)
			this.in[0] &= ~(1 << 4);
	}

	convertCHR() {
		this.chr.set(CHR);
	}

	convertOBJ() {
		for (let p = 0, q = 0, i = 512; i !== 0; q += 512, --i) {
			for (let j = 0; j < 8; j++) {
				for (let k = 120; k >= 0; k -= 8)
					this.obj[p++] = OBJ[q + j + k + 256] >> 4;
				for (let k = 120; k >= 0; k -= 8)
					this.obj[p++] = OBJ[q + j + k] >> 4;
				for (let k = 120; k >= 0; k -= 8)
					this.obj[p++] = OBJ[q + j + k + 256] & 0xf;
				for (let k = 120; k >= 0; k -= 8)
					this.obj[p++] = OBJ[q + j + k] & 0xf;
			}
			for (let j = 0; j < 8; j++) {
				for (let k = 120; k >= 0; k -= 8)
					this.obj[p++] = OBJ[q + j + k + 384] >> 4;
				for (let k = 120; k >= 0; k -= 8)
					this.obj[p++] = OBJ[q + j + k + 128] >> 4;
				for (let k = 120; k >= 0; k -= 8)
					this.obj[p++] = OBJ[q + j + k + 384] & 0xf;
				for (let k = 120; k >= 0; k -= 8)
					this.obj[p++] = OBJ[q + j + k + 128] & 0xf;
			}
		}
	}

	makeBitmap(data) {
		const ram = this.ram, black = 0x1800;
		let p, k;

		// 画面クリア
		p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256, i++)
			data.fill(black, p, p + 224);

		for (let pri = 0; pri < 8; pri++) {
			// bg描画
			if (ram[0x4010] === pri) {
				const vScroll = ram[0x4001] | ram[0x4000] << 8, hScroll = ram[0x4003] | ram[0x4002] << 8, color = ram[0x4018] << 8 & 0x700 | 0x800;
				if ((ram[0x5ff6] & 1) === 0) {
					p = 256 * 8 * 2 + 232 - (48 + vScroll & 7) * 256 + (24 + hScroll & 7);
					k = 48 + vScroll >> 2 & 0x7e | 24 + hScroll << 4 & 0x1f80 | 0x8000;
				} else {
					p = 256 * 8 * 2 + 232 - (176 - vScroll & 7) * 256 + (264 - hScroll & 7);
					k = 176 - vScroll >> 2 & 0x7e | 264 - hScroll << 4 & 0x1f80 | 0x8000;
				}
				for (let i = 0; i < 29; k = k + 54 & 0x7e | k + 0x80 & 0x1f80 | 0x8000, p -= 256 * 8 * 37 + 8, i++)
					for (let j = 0; j < 37; k = k + 2 & 0x7e | k & 0xff80, p += 256 * 8, j++)
						this.xfer8x8(data, p, k, color);
			}
			if (ram[0x4011] === pri) {
				const vScroll = ram[0x4005] | ram[0x4004] << 8, hScroll = ram[0x4007] | ram[0x4006] << 8, color = ram[0x4019] << 8 & 0x700 | 0x800;
				if ((ram[0x5ff6] & 1) === 0) {
					p = 256 * 8 * 2 + 232 - (46 + vScroll & 7) * 256 + (24 + hScroll & 7);
					k = 46 + vScroll >> 2 & 0x7e | 24 + hScroll << 4 & 0x1f80 | 0xa000;
				} else {
					p = 256 * 8 * 2 + 232 - (178 - vScroll & 7) * 256 + (264 - hScroll & 7);
					k = 178 - vScroll >> 2 & 0x7e | 264 - hScroll << 4 & 0x1f80 | 0xa000;
				}
				for (let i = 0; i < 29; k = k + 54 & 0x7e | k + 0x80 & 0x1f80 | 0xa000, p -= 256 * 8 * 37 + 8, i++)
					for (let j = 0; j < 37; k = k + 2 & 0x7e | k & 0xff80, p += 256 * 8, j++)
						this.xfer8x8(data, p, k, color);
			}
			if (ram[0x4012] === pri) {
				const vScroll = ram[0x4009] | ram[0x4008] << 8, hScroll = ram[0x400b] | ram[0x400a] << 8, color = ram[0x401a] << 8 & 0x700 | 0x800;
				if ((ram[0x5ff6] & 1) === 0) {
					p = 256 * 8 * 2 + 232 - (45 + vScroll & 7) * 256 + (24 + hScroll & 7);
					k = 45 + vScroll >> 2 & 0x7e | 24 + hScroll << 4 & 0x1f80 | 0xc000;
				} else {
					p = 256 * 8 * 2 + 232 - (179 - vScroll & 7) * 256 + (264 - hScroll & 7);
					k = 179 - vScroll >> 2 & 0x7e | 264 - hScroll << 4 & 0x1f80 | 0xc000;
				}
				for (let i = 0; i < 29; k = k + 54 & 0x7e | k + 0x80 & 0x1f80 | 0xc000, p -= 256 * 8 * 37 + 8, i++)
					for (let j = 0; j < 37; k = k + 2 & 0x7e | k & 0xff80, p += 256 * 8, j++)
						this.xfer8x8(data, p, k, color);
			}
			if (ram[0x4013] === pri) {
				const vScroll = ram[0x400d] | ram[0x400c] << 8, hScroll = ram[0x400f], color = ram[0x401b] << 8 & 0x700 | 0x800;
				if ((ram[0x5ff6] & 1) === 0) {
					p = 256 * 8 * 2 + 232 - (44 + vScroll & 7) * 256 + (24 + hScroll & 7);
					k = 44 + vScroll >> 2 & 0x7e | 24 + hScroll << 4 & 0xf80 | 0xe000;
				}
				else {
					p = 256 * 8 * 2 + 232 - (180 - vScroll & 7) * 256 + (8 - hScroll & 7);
					k = 180 - vScroll >> 2 & 0x7e | 8 - hScroll << 4 & 0xf80 | 0xe000;
				}
				for (let i = 0; i < 29; k = k + 54 & 0x7e | k + 0x80 & 0xf80 | 0xe000, p -= 256 * 8 * 37 + 8, i++)
					for (let j = 0; j < 37; k = k + 2 & 0x7e | k & 0xff80, p += 256 * 8, j++)
						this.xfer8x8(data, p, k, color);
			}
			if (ram[0x4014] === pri) {
				const color = ram[0x401c] << 8 & 0x700 | 0x800;
				p = 256 * 8 * 2 + 232;
				k = 0xf010;
				for (let i = 0; i < 28; p -= 256 * 8 * 36 + 8, i++)
					for (let j = 0; j < 36; k = k + 2, p += 256 * 8, j++)
						this.xfer8x8(data, p, k, color);
			}
			if (ram[0x4015] === pri) {
				const color = ram[0x401d] << 8 & 0x700 | 0x800;
				p = 256 * 8 * 2 + 232;
				k = 0xf810;
				for (let i = 0; i < 28; p -= 256 * 8 * 36 + 8, i++)
					for (let j = 0; j < 36; k = k + 2, p += 256 * 8, j++)
						this.xfer8x8(data, p, k, color);
			}

			// obj描画
			for (let k = 0x5800, i = 127; i !== 0; k += 16, --i) {
				if (ram[k + 8] >> 5 !== pri)
					continue;
				const w = [16, 8, 32, 4][ram[k + 8] >> 1 & 3], h = [16, 8, 32, 4][ram[k + 4] >> 6];
				const x = w + ram[k + 9] + ram[0x5ff7] - ((ram[0x5ff6] & 1) === 0 ? 2 : 0) & 0xff;
				const y = (ram[k + 7] | ram[k + 6] << 8) + (ram[0x5ff5] | ram[0x5ff4] << 8) - ((ram[0x5ff6] & 1) === 0 ? 57 : 135) & 0x1ff;
				const src = (~ram[k + 8] & 0x18 | 7) & -w | (ram[k + 4] & -h) << 5 & 0x300 | ram[k + 5] << 10 & 0x3fc00 | ram[k + 4] << 18 & 0x1c0000;
				const color = ram[k + 6] << 3 & 0x7f0;
				if (color === 0x7f0)
					switch (ram[k + 8] & 1 | ram[k + 4] >> 4 & 2) {
					case 0:
						this.shadowHxW(data, src, y, x, h, w);
						break;
					case 1:
						this.shadowHxW_H(data, src, y, x, h, w);
						break;
					case 2:
						this.shadowHxW_V(data, src, y, x, h, w);
						break;
					case 0x03:
						this.shadowHxW_HV(data, src, y, x, h, w);
						break;
					}
				else
					switch (ram[k + 8] & 1 | ram[k + 4] >> 4 & 2) {
					case 0:
						this.xferHxW(data, src, color, y, x, h, w);
						break;
					case 1:
						this.xferHxW_H(data, src, color, y, x, h, w);
						break;
					case 2:
						this.xferHxW_V(data, src, color, y, x, h, w);
						break;
					case 0x03:
						this.xferHxW_HV(data, src, color, y, x, h, w);
						break;
					}
			}
		}

		// クリップ処理
		const t = -58 + (ram[0x7800] << 8 | ram[0x7801]), b = -58 + (ram[0x7802] << 8 | ram[0x7803]);
		const r = 273 - (ram[0x7804] << 8 | ram[0x7805]), l = 273 - (ram[0x7806] << 8 | ram[0x7807]);
		for (let y = 16; y < 288 + 16; y++) {
			if (y < t || y >= b) {
				data.fill(black, 16 | y << 8, 224 + 16 | y << 8);
				continue;
			}
			for (let x = 16; x < 224 + 16; x++)
				if (x < l || x >= r)
					data[x | y << 8] = black;
		}

		// palette変換
		p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256 - 224, i++)
			for (let j = 0; j < 224; p++, j++)
				data[p] = this.rgb[data[p]];
	}

	xfer8x8(data, p, k, color) {
		const q1 = (this.ram[k] << 8 & 0x3f00 | this.ram[k + 1]) << 3, q2 = q1 << 3;

		if ((CHR8[q1 | 0] & 0x80) !== 0) data[p + 0x007] = color | this.chr[q2 | 0x00];
		if ((CHR8[q1 | 0] & 0x40) !== 0) data[p + 0x107] = color | this.chr[q2 | 0x01];
		if ((CHR8[q1 | 0] & 0x20) !== 0) data[p + 0x207] = color | this.chr[q2 | 0x02];
		if ((CHR8[q1 | 0] & 0x10) !== 0) data[p + 0x307] = color | this.chr[q2 | 0x03];
		if ((CHR8[q1 | 0] & 0x08) !== 0) data[p + 0x407] = color | this.chr[q2 | 0x04];
		if ((CHR8[q1 | 0] & 0x04) !== 0) data[p + 0x507] = color | this.chr[q2 | 0x05];
		if ((CHR8[q1 | 0] & 0x02) !== 0) data[p + 0x607] = color | this.chr[q2 | 0x06];
		if ((CHR8[q1 | 0] & 0x01) !== 0) data[p + 0x707] = color | this.chr[q2 | 0x07];
		if ((CHR8[q1 | 1] & 0x80) !== 0) data[p + 0x006] = color | this.chr[q2 | 0x08];
		if ((CHR8[q1 | 1] & 0x40) !== 0) data[p + 0x106] = color | this.chr[q2 | 0x09];
		if ((CHR8[q1 | 1] & 0x20) !== 0) data[p + 0x206] = color | this.chr[q2 | 0x0a];
		if ((CHR8[q1 | 1] & 0x10) !== 0) data[p + 0x306] = color | this.chr[q2 | 0x0b];
		if ((CHR8[q1 | 1] & 0x08) !== 0) data[p + 0x406] = color | this.chr[q2 | 0x0c];
		if ((CHR8[q1 | 1] & 0x04) !== 0) data[p + 0x506] = color | this.chr[q2 | 0x0d];
		if ((CHR8[q1 | 1] & 0x02) !== 0) data[p + 0x606] = color | this.chr[q2 | 0x0e];
		if ((CHR8[q1 | 1] & 0x01) !== 0) data[p + 0x706] = color | this.chr[q2 | 0x0f];
		if ((CHR8[q1 | 2] & 0x80) !== 0) data[p + 0x005] = color | this.chr[q2 | 0x10];
		if ((CHR8[q1 | 2] & 0x40) !== 0) data[p + 0x105] = color | this.chr[q2 | 0x11];
		if ((CHR8[q1 | 2] & 0x20) !== 0) data[p + 0x205] = color | this.chr[q2 | 0x12];
		if ((CHR8[q1 | 2] & 0x10) !== 0) data[p + 0x305] = color | this.chr[q2 | 0x13];
		if ((CHR8[q1 | 2] & 0x08) !== 0) data[p + 0x405] = color | this.chr[q2 | 0x14];
		if ((CHR8[q1 | 2] & 0x04) !== 0) data[p + 0x505] = color | this.chr[q2 | 0x15];
		if ((CHR8[q1 | 2] & 0x02) !== 0) data[p + 0x605] = color | this.chr[q2 | 0x16];
		if ((CHR8[q1 | 2] & 0x01) !== 0) data[p + 0x705] = color | this.chr[q2 | 0x17];
		if ((CHR8[q1 | 3] & 0x80) !== 0) data[p + 0x004] = color | this.chr[q2 | 0x18];
		if ((CHR8[q1 | 3] & 0x40) !== 0) data[p + 0x104] = color | this.chr[q2 | 0x19];
		if ((CHR8[q1 | 3] & 0x20) !== 0) data[p + 0x204] = color | this.chr[q2 | 0x1a];
		if ((CHR8[q1 | 3] & 0x10) !== 0) data[p + 0x304] = color | this.chr[q2 | 0x1b];
		if ((CHR8[q1 | 3] & 0x08) !== 0) data[p + 0x404] = color | this.chr[q2 | 0x1c];
		if ((CHR8[q1 | 3] & 0x04) !== 0) data[p + 0x504] = color | this.chr[q2 | 0x1d];
		if ((CHR8[q1 | 3] & 0x02) !== 0) data[p + 0x604] = color | this.chr[q2 | 0x1e];
		if ((CHR8[q1 | 3] & 0x01) !== 0) data[p + 0x704] = color | this.chr[q2 | 0x1f];
		if ((CHR8[q1 | 4] & 0x80) !== 0) data[p + 0x003] = color | this.chr[q2 | 0x20];
		if ((CHR8[q1 | 4] & 0x40) !== 0) data[p + 0x103] = color | this.chr[q2 | 0x21];
		if ((CHR8[q1 | 4] & 0x20) !== 0) data[p + 0x203] = color | this.chr[q2 | 0x22];
		if ((CHR8[q1 | 4] & 0x10) !== 0) data[p + 0x303] = color | this.chr[q2 | 0x23];
		if ((CHR8[q1 | 4] & 0x08) !== 0) data[p + 0x403] = color | this.chr[q2 | 0x24];
		if ((CHR8[q1 | 4] & 0x04) !== 0) data[p + 0x503] = color | this.chr[q2 | 0x25];
		if ((CHR8[q1 | 4] & 0x02) !== 0) data[p + 0x603] = color | this.chr[q2 | 0x26];
		if ((CHR8[q1 | 4] & 0x01) !== 0) data[p + 0x703] = color | this.chr[q2 | 0x27];
		if ((CHR8[q1 | 5] & 0x80) !== 0) data[p + 0x002] = color | this.chr[q2 | 0x28];
		if ((CHR8[q1 | 5] & 0x40) !== 0) data[p + 0x102] = color | this.chr[q2 | 0x29];
		if ((CHR8[q1 | 5] & 0x20) !== 0) data[p + 0x202] = color | this.chr[q2 | 0x2a];
		if ((CHR8[q1 | 5] & 0x10) !== 0) data[p + 0x302] = color | this.chr[q2 | 0x2b];
		if ((CHR8[q1 | 5] & 0x08) !== 0) data[p + 0x402] = color | this.chr[q2 | 0x2c];
		if ((CHR8[q1 | 5] & 0x04) !== 0) data[p + 0x502] = color | this.chr[q2 | 0x2d];
		if ((CHR8[q1 | 5] & 0x02) !== 0) data[p + 0x602] = color | this.chr[q2 | 0x2e];
		if ((CHR8[q1 | 5] & 0x01) !== 0) data[p + 0x702] = color | this.chr[q2 | 0x2f];
		if ((CHR8[q1 | 6] & 0x80) !== 0) data[p + 0x001] = color | this.chr[q2 | 0x30];
		if ((CHR8[q1 | 6] & 0x40) !== 0) data[p + 0x101] = color | this.chr[q2 | 0x31];
		if ((CHR8[q1 | 6] & 0x20) !== 0) data[p + 0x201] = color | this.chr[q2 | 0x32];
		if ((CHR8[q1 | 6] & 0x10) !== 0) data[p + 0x301] = color | this.chr[q2 | 0x33];
		if ((CHR8[q1 | 6] & 0x08) !== 0) data[p + 0x401] = color | this.chr[q2 | 0x34];
		if ((CHR8[q1 | 6] & 0x04) !== 0) data[p + 0x501] = color | this.chr[q2 | 0x35];
		if ((CHR8[q1 | 6] & 0x02) !== 0) data[p + 0x601] = color | this.chr[q2 | 0x36];
		if ((CHR8[q1 | 6] & 0x01) !== 0) data[p + 0x701] = color | this.chr[q2 | 0x37];
		if ((CHR8[q1 | 7] & 0x80) !== 0) data[p + 0x000] = color | this.chr[q2 | 0x38];
		if ((CHR8[q1 | 7] & 0x40) !== 0) data[p + 0x100] = color | this.chr[q2 | 0x39];
		if ((CHR8[q1 | 7] & 0x20) !== 0) data[p + 0x200] = color | this.chr[q2 | 0x3a];
		if ((CHR8[q1 | 7] & 0x10) !== 0) data[p + 0x300] = color | this.chr[q2 | 0x3b];
		if ((CHR8[q1 | 7] & 0x08) !== 0) data[p + 0x400] = color | this.chr[q2 | 0x3c];
		if ((CHR8[q1 | 7] & 0x04) !== 0) data[p + 0x500] = color | this.chr[q2 | 0x3d];
		if ((CHR8[q1 | 7] & 0x02) !== 0) data[p + 0x600] = color | this.chr[q2 | 0x3e];
		if ((CHR8[q1 | 7] & 0x01) !== 0) data[p + 0x700] = color | this.chr[q2 | 0x3f];
	}

	shadowHxW(data, src, y0, x0, h, w) {
		const y1 = y0 + h - 1 & 0x1ff, x1 = x0 - w + 1 & 0xff;

		if ((y0 < 16 || y0 >= 304) && (y1 < 16 || y1 >= 304) || (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let y = y0, i = 0; i < h; y = y + 1 & 0x1ff, i++)
			for (let x = x0, j = w - 1; j >= 0; x = x - 1 & 0xff, --j)
				if (this.obj[src + i * 32 + j] !== 0xf && (data[x | y << 8] & 0x1800) === 0x800)
					data[x | y << 8] ^= 0x1800;
	}

	shadowHxW_V(data, src, y0, x0, h, w) {
		const y1 = y0 + h - 1 & 0x1ff, x1 = x0 - w + 1 & 0xff;

		if ((y0 < 16 || y0 >= 304) && (y1 < 16 || y1 >= 304) || (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let y = y1, i = 0; i < h; y = y - 1 & 0x1ff, i++)
			for (let x = x0, j = w - 1; j >= 0; x = x - 1 & 0xff, --j)
				if (this.obj[src + i * 32 + j] !== 0xf && (data[x | y << 8] & 0x1800) === 0x800)
					data[x | y << 8] ^= 0x1800;
	}

	shadowHxW_H(data, src, y0, x0, h, w) {
		const y1 = y0 + h - 1 & 0x1ff, x1 = x0 - w + 1 & 0xff;

		if ((y0 < 16 || y0 >= 304) && (y1 < 16 || y1 >= 304) || (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let y = y0, i = 0; i < h; y = y + 1 & 0x1ff, i++)
			for (let x = x1, j = w - 1; j >= 0; x = x + 1 & 0xff, --j)
				if (this.obj[src + i * 32 + j] !== 0xf && (data[x | y << 8] & 0x1800) === 0x800)
					data[x | y << 8] ^= 0x1800;
	}

	shadowHxW_HV(data, src, y0, x0, h, w) {
		const y1 = y0 + h - 1 & 0x1ff, x1 = x0 - w + 1 & 0xff;

		if ((y0 < 16 || y0 >= 304) && (y1 < 16 || y1 >= 304) || (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let y = y1, i = 0; i < h; y = y - 1 & 0x1ff, i++)
			for (let x = x1, j = w - 1; j >= 0; x = x + 1 & 0xff, --j)
				if (this.obj[src + i * 32 + j] !== 0xf && (data[x | y << 8] & 0x1800) === 0x800)
					data[x | y << 8] ^= 0x1800;
	}

	xferHxW(data, src, color, y0, x0, h, w) {
		const y1 = y0 + h - 1 & 0x1ff, x1 = x0 - w + 1 & 0xff;
		let px;

		if ((y0 < 16 || y0 >= 304) && (y1 < 16 || y1 >= 304) || (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let y = y0, i = 0; i < h; y = y + 1 & 0x1ff, i++)
			for (let x = x0, j = w - 1; j >= 0; x = x - 1 & 0xff, --j)
				if ((px = this.obj[src + i * 32 + j]) !== 0xf)
					data[x | y << 8] = color | px;
	}

	xferHxW_V(data, src, color, y0, x0, h, w) {
		const y1 = y0 + h - 1 & 0x1ff, x1 = x0 - w + 1 & 0xff;
		let px;

		if ((y0 < 16 || y0 >= 304) && (y1 < 16 || y1 >= 304) || (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let y = y1, i = 0; i < h; y = y - 1 & 0x1ff, i++)
			for (let x = x0, j = w - 1; j >= 0; x = x - 1 & 0xff, --j)
				if ((px = this.obj[src + i * 32 + j]) !== 0xf)
					data[x | y << 8] = color | px;
	}

	xferHxW_H(data, src, color, y0, x0, h, w) {
		const y1 = y0 + h - 1 & 0x1ff, x1 = x0 - w + 1 & 0xff;
		let px;

		if ((y0 < 16 || y0 >= 304) && (y1 < 16 || y1 >= 304) || (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let y = y0, i = 0; i < h; y = y + 1 & 0x1ff, i++)
			for (let x = x1, j = w - 1; j >= 0; x = x + 1 & 0xff, --j)
				if ((px = this.obj[src + i * 32 + j]) !== 0xf)
					data[x | y << 8] = color | px;
	}

	xferHxW_HV(data, src, color, y0, x0, h, w) {
		const y1 = y0 + h - 1 & 0x1ff, x1 = x0 - w + 1 & 0xff;
		let px;

		if ((y0 < 16 || y0 >= 304) && (y1 < 16 || y1 >= 304) || (x0 < 16 || x0 >= 240) && (x1 < 16 || x1 >= 240))
			return;
		for (let y = y1, i = 0; i < h; y = y - 1 & 0x1ff, i++)
			for (let x = x1, j = w - 1; j >= 0; x = x + 1 & 0xff, --j)
				if ((px = this.obj[src + i * 32 + j]) !== 0xf)
					data[x | y << 8] = color | px;
	}
}

/*
 *
 *	Tank Force
 *
 */

const url = 'tankfrce.zip';
let SND, PRG, MCU, VOI, CHR8, CHR, OBJ;

window.addEventListener('load', () => $.ajax({url, success, error: () => alert(url + ': failed to get')}));

function success(zip) {
	SND = new Uint8Array(zip.files['tf1_snd0.bin'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	PRG = zip.files['tf1_prg0.bin'].inflate() + zip.files['tf1_prg1.bin'].inflate();
	PRG = new Uint8Array((PRG + zip.files['tankfrcej/tf1_prg7.bin'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	MCU = new Uint8Array(zip.files['cus64-64a1.mcu'].inflate().split('').map(c => c.charCodeAt(0))).addBase();
	VOI = new Uint8Array((zip.files['tf1_voi0.bin'].inflate() + zip.files['tf1_voi1.bin'].inflate()).split('').map(c => c.charCodeAt(0))).addBase();
	CHR8 = new Uint8Array(zip.files['tf1_chr8.bin'].inflate().split('').map(c => c.charCodeAt(0)));
	CHR = zip.files['tf1_chr0.bin'].inflate() + zip.files['tf1_chr1.bin'].inflate() + zip.files['tf1_chr2.bin'].inflate() + zip.files['tf1_chr3.bin'].inflate();
	CHR = new Uint8Array((CHR + zip.files['tf1_chr4.bin'].inflate() + zip.files['tf1_chr5.bin'].inflate()).split('').map(c => c.charCodeAt(0)));
	OBJ = new Uint8Array((zip.files['tf1_obj0.bin'].inflate() + zip.files['tf1_obj1.bin'].inflate()).split('').map(c => c.charCodeAt(0)));
	init({
		game: new TankForce(),
		sound: sound = [
			new YM2151({clock: 3579580, resolution: 58, gain: 2}),
			new C30({resolution: 58}),
			new Dac8Bit2Ch({resolution: 100}),
		],
		rotate: true,
	});
	loop();
}

