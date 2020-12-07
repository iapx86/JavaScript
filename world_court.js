/*
 *
 *	World Court
 *
 */

import YM2151 from './ym2151.js';
import C30 from './c30.js';
import Dac8Bit2Ch from './dac_8bit_2ch.js';
import Cpu, {dummypage, init, read} from './main.js';
import MC6809 from './mc6809.js';
import MC6801 from './mc6801.js';
let game, sound;

class WorldCourt {
	cxScreen = 224;
	cyScreen = 288;
	width = 256;
	height = 512;
	xOffset = 16;
	yOffset = 16;
	rotate = true;

	fReset = true;
	fTest = false;
	fDIPSwitchChanged = true;
	fCoin = 0;
	fStart1P = 0;
	fStart2P = 0;

	memorymap = [];
	ram = new Uint8Array(0x18000).addBase();
	ram2 = new Uint8Array(0x800).addBase();
	ram3 = new Uint8Array(0x2000).addBase();
	ram4 = new Uint8Array(0x900).addBase();
	fm = {addr: 0, reg: new Uint8Array(0x100), status: 0, timera: 0, timerb: 0};
	in = Uint8Array.of(0xff, 0xff, 0xff, 0xf8);
	key = new Uint8Array(4);
	count = 0;
	bank1 = new Uint16Array(8);
	bank2 = new Uint16Array(8);
	bank3 = 0x40;
	bank4 = 0x80;
	cpu_irq = false;
	cpu2_irq = false;
	cpu2_firq = false;
	cpu3_irq = false;
	mcu_irq = false;

	chr = new Uint8Array(0x100000).fill(0xff);
	obj = new Uint8Array(0x200000).fill(0xf);
	rgb = new Uint32Array(0x2000).fill(0xff000000);
	isspace = new Uint8Array(0x4000);

	cpu = new MC6809();
	cpu2 = new MC6809();
	cpu3 = new MC6809();
	mcu = new MC6801();

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0x8000; i++)
			this.memorymap.push({base: dummypage, read: null, write: () => {}, fetch: null});

		const range = (page, start, end, mirror = 0) => (page & ~mirror) >= start && (page & ~mirror) <= end;

		for (let page = 0; page < 0x8000; page++)
			if (range(page, 0x2e00, 0x2e17)) {
				this.memorymap[page].read = (addr) => { return this.rgb[addr & 0x7ff] >> (addr >> 8 & 0x18) & 0xff; };
				this.memorymap[page].write = (addr, data) => {
					const idx = addr & 0x7ff, shift = addr >> 8 & 0x18;
					this.rgb[idx] = this.rgb[idx] & ~(0xff << shift) | data << shift;
				};
			} else if (range(page, 0x2e18, 0x2e1f, 0x60)) {
				this.memorymap[page].read = (addr) => { return this.ram[0x7800 | addr & 0xf]; };
				this.memorymap[page].write = (addr, data) => { this.ram[0x7800 | addr & 0xf] = data; };
			} else if (range(page, 0x2e20, 0x2e37)) {
				this.memorymap[page].read = (addr) => { return this.rgb[0x800 | addr & 0x7ff] >> (addr >> 8 & 0x18) & 0xff; };
				this.memorymap[page].write = (addr, data) => {
					const idx = 0x800 | addr & 0x7ff, shift = addr >> 8 & 0x18;
					this.rgb[idx] = this.rgb[idx] & ~(0xff << shift) | data << shift;
				};
			} else if (range(page, 0x2e40, 0x2e57)) {
				this.memorymap[page].read = (addr) => { return this.rgb[0x1000 | addr & 0x7ff] >> (addr >> 8 & 0x18) & 0xff; };
				this.memorymap[page].write = (addr, data) => {
					const idx = 0x1000 | addr & 0x7ff, shift = addr >> 8 & 0x18;
					this.rgb[idx] = this.rgb[idx] & ~(0xff << shift) | data << shift;
				};
			} else if (range(page, 0x2e60, 0x2e77)) {
				this.memorymap[page].base = this.ram.base[0x60 | page & 0x1f];
				this.memorymap[page].write = null;
			} else if (range(page, 0x2f00, 0x2f7f)) {
				this.memorymap[page].base = this.ram.base[0x80 | page & 0x7f];
				this.memorymap[page].write = null;
			} else if (range(page, 0x2f80, 0x2f9f)) {
				this.memorymap[page].read = (addr) => {
					const key = this.key, d = key[0], n = key[1] << 8 | key[2];
					if ((addr & 0x1fff) < 4)
						return d ? [n % d, n / d >> 8, n / d & 0xff, 0x35][addr & 3] : [0, 0xff, 0xff, 0x35][addr & 3];
					return 0;
				};
				this.memorymap[page].write = (addr, data) => { (addr & 0x1fff) < 3 && (this.key[addr & 3] = data); };
			} else if (range(page, 0x2fc0, 0x2fcf)) {
				this.memorymap[page].base = this.ram.base[0x50 | page & 0xf];
				this.memorymap[page].write = null;
			} else if (range(page, 0x2fd0, 0x2fdf)) {
				this.memorymap[page].read = (addr) => { return this.ram[0x4000 | addr & 0x1f]; };
				this.memorymap[page].write = (addr, data) => { this.ram[0x4000 | addr & 0x1f] = data; };
			} else if (range(page, 0x2fe0, 0x2fef)) {
				this.memorymap[page].read = (addr) => { return sound[1].read(addr); };
				this.memorymap[page].write = (addr, data) => { sound[1].write(addr, data, this.count); };
			} else if (range(page, 0x2ff0, 0x2fff)) {
				this.memorymap[page].base = this.ram2.base[page & 7];
				this.memorymap[page].write = null;
			} else if (range(page, 0x3000, 0x307f)) {
				this.memorymap[page].base = this.ram.base[0x100 | page & 0x7f];
				this.memorymap[page].write = null;
			} else if (range(page, 0x7000, 0x7fff))
				this.memorymap[page].base = PRG.base[page >> 3 & 0x100 | page & 0xff];

		for (let i = 0; i < 0x20; i++)
			this.cpu.memorymap[0xe0 + i].write = (addr, data) => {
				const reg = addr >> 9 & 0xf;
				if (reg < 8)
					return this.bankswitch(reg, addr & 1 ? this.bank1[reg] & 0x6000 | data << 5 : data << 13 & 0x6000 | this.bank1[reg] & 0x1fe0);
				switch (reg) {
				case 8:
					if (data & 1)
						return this.cpu2.enable(), this.cpu3.enable(), this.mcu.enable();
					return this.cpu2.disable(), this.cpu3.disable(), this.mcu.disable();
				case 11:
					return void(this.cpu_irq = false);
				case 13:
					return void(this.cpu2_firq = true);
				case 14:
					return this.bankswitch2(7, 0x6000 | data << 5);
				}
			};

		this.cpu.check_interrupt = () => { return this.cpu_irq && this.cpu.interrupt(); };

		for (let i = 0; i < 0x20; i++)
			this.cpu2.memorymap[0xe0 + i].write = (addr, data) => {
				const reg = addr >> 9 & 0xf;
				if (reg < 8)
					return this.bankswitch2(reg, addr & 1 ? this.bank2[reg] & 0x6000 | data << 5 : data << 13 & 0x6000 | this.bank2[reg] & 0x1fe0);
				switch (reg) {
				case 11:
					return void(this.cpu2_irq = false);
				case 12:
					return void(this.cpu2_firq = false);
				}
			};

		this.cpu2.check_interrupt = () => { return this.cpu2_irq && this.cpu2.interrupt() || this.cpu2_firq && this.cpu2.fast_interrupt(); };

		for (let i = 0; i < 0x40; i++)
			this.cpu3.memorymap[i].base = SND.base[0x40 + i];
		this.cpu3.memorymap[0x40].read = (addr) => { return addr === 0x4001 ? this.fm.status : 0xff; };
		this.cpu3.memorymap[0x40].write = (addr, data) => {
			switch (addr & 0xff) {
			case 0:
				return void(this.fm.addr = data);
			case 1:
				if (this.fm.addr === 0x14) { // CSM/F RESET/IRQEN/LOAD
					this.fm.status &= ~(data >> 4 & 3);
					data & ~this.fm.reg[0x14] & 1 && (this.fm.timera = this.fm.reg[0x10] << 2 | this.fm.reg[0x11] & 3);
					data & ~this.fm.reg[0x14] & 2 && (this.fm.timerb = this.fm.reg[0x12]);
				}
				return sound[0].write(this.fm.addr, this.fm.reg[this.fm.addr] = data, this.count);
			}
		};
		for (let i = 0; i < 8; i++) {
			this.cpu3.memorymap[0x50 + i].read = (addr) => { return sound[1].read(addr); };
			this.cpu3.memorymap[0x50 + i].write = (addr, data) => { sound[1].write(addr, data, this.count); };
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
		this.cpu3.memorymap[0xc0].write = (addr, data) => { this.bankswitch3(data << 2 & 0x1c0); };
		this.cpu3.memorymap[0xe0].write = () => { this.cpu3_irq = false; };

		this.cpu3.check_interrupt = () => { return this.cpu3_irq && this.cpu3.interrupt() || this.fm.status & 3 && this.cpu3.fast_interrupt(); };

		this.mcu.memorymap[0].base = this.ram4.base[0];
		this.mcu.memorymap[0].read = (addr) => {
			let data;
			switch (addr) {
			case 2:
				return this.in[3];
			case 8:
				return data = this.ram4[8], this.ram4[8] &= ~0xe0, data;
			}
			return this.ram4[addr];
		};
		this.mcu.memorymap[0].write = (addr, data) => {
			if (addr === 3) {
				sound[2].channel[0].gain = ((data >> 1 & 2 | data & 1) + 1) / 4;
				sound[2].channel[1].gain = ((data >> 3 & 3) + 1) / 4;
			}
			this.ram4[addr] = data;
		};
		this.mcu.memorymap[0x10].read = (addr) => { return this.in[2] >> (~addr << 1 & 4) | 0xf0; };
		this.mcu.memorymap[0x14].read = (addr) => { return this.in[addr & 1]; };
		for (let i = 0; i < 0x80; i++)
			this.mcu.memorymap[0x40 + i].base = VOI.base[0x80 + i];
		for (let i = 0; i < 8; i++) {
			this.mcu.memorymap[0xc0 + i].base = this.ram2.base[i];
			this.mcu.memorymap[0xc0 + i].write = null;
		}
		this.mcu.memorymap[0xc0].write = (addr, data) => { addr === 0xc000 && this.ram2[0] === 0xa6 || (this.ram2[addr & 0xff] = data); };
		for (let i = 0; i < 8; i++) {
			this.mcu.memorymap[0xc8 + i].base = this.ram4.base[1 + i];
			this.mcu.memorymap[0xc8 + i].write = null;
		}
		this.mcu.memorymap[0xd0].write = (addr, data) => { sound[2].write(0, data, this.count); };
		this.mcu.memorymap[0xd4].write = (addr, data) => { sound[2].write(1, data, this.count); };
		this.mcu.memorymap[0xd8].write = (addr, data) => {
			const index = [0xf8, 0xf4, 0xec, 0xdc, 0xbc, 0x7c].indexOf(data & 0xfc);
			this.bankswitch4(index < 0 ? 0 : index ? index << 9 | data << 7 & 0x180 : data << 7 & 0x180 ^ 0x100);
		};
		for (let i = 0; i < 0x10; i++)
			this.mcu.memorymap[0xf0 + i].base = MCU.base[i];
		this.mcu.memorymap[0xf0].write = () => { this.mcu_irq = false; };

		this.mcu.check_interrupt = () => { return this.mcu_irq && this.mcu.interrupt() || (this.ram4[8] & 0x48) === 0x48 && this.mcu.interrupt('ocf'); };

		// Videoの初期化
		this.convertCHR();
		this.convertOBJ();
	}

	bankswitch(reg, bank) {
		if (bank === this.bank1[reg])
			return;
		if (reg < 7)
			for (let i = 0; i < 0x20; i++)
				this.cpu.memorymap[reg << 5 | i] = this.memorymap[bank | i];
		else
			for (let i = 0; i < 0x20; i++)
				this.cpu.memorymap[0xe0 | i].base = this.memorymap[bank | i].base;
		this.bank1[reg] = bank;
	}

	bankswitch2(reg, bank) {
		if (bank === this.bank2[reg])
			return;
		if (reg < 7)
			for (let i = 0; i < 0x20; i++)
				this.cpu2.memorymap[reg << 5 | i] = this.memorymap[bank | i];
		else
			for (let i = 0; i < 0x20; i++)
				this.cpu2.memorymap[0xe0 | i].base = this.memorymap[bank | i].base;
		this.bank2[reg] = bank;
	}

	bankswitch3(bank) {
		if (bank === this.bank3)
			return;
		if (bank < 0x100)
			for (let i = 0; i < 0x40; i++)
				this.cpu3.memorymap[i].base = SND.base[bank | i];
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
				this.mcu.memorymap[0x40 + i].base = VOI.base[bank | i];
		else
			for (let i = 0; i < 0x80; i++)
				this.mcu.memorymap[0x40 + i].base = dummypage;
		this.bank4 = bank;
	}

	execute() {
		this.cpu_irq = this.cpu2_irq = this.cpu3_irq = this.mcu_irq = true;
		for (this.count = 0; this.count < 29; this.count++) {
			Cpu.multiple_execute([this.cpu, this.cpu2, this.cpu3], 146);
			if (this.fm.reg[0x14] & 1 && (this.fm.timera += 16) >= 0x400) {
				this.fm.timera = (this.fm.timera & 0x3ff) + (this.fm.reg[0x10] << 2 | this.fm.reg[0x11] & 3);
				this.fm.status |= this.fm.reg[0x14] >> 2 & 1;
			}
			if (this.fm.reg[0x14] & 2 && ++this.fm.timerb >= 0x100) {
				this.fm.timerb = (this.fm.timerb & 0xff) + this.fm.reg[0x12];
				this.fm.status |= this.fm.reg[0x14] >> 2 & 2;
			}
		}
		for (this.count = 0; this.count < 50; this.count++) {
			this.ram4[8] |= this.ram4[8] << 3 & 0x40;
			this.mcu.execute(84);
		}
		for (this.count = 29; this.count < 58; this.count++) { // 3579580 / 60 / 1024
			Cpu.multiple_execute([this.cpu, this.cpu2, this.cpu3], 146);
			if (this.fm.reg[0x14] & 1 && (this.fm.timera += 16) >= 0x400) {
				this.fm.timera = (this.fm.timera & 0x3ff) + (this.fm.reg[0x10] << 2 | this.fm.reg[0x11] & 3);
				this.fm.status |= this.fm.reg[0x14] >> 2 & 1;
			}
			if (this.fm.reg[0x14] & 2 && ++this.fm.timerb >= 0x100) {
				this.fm.timerb = (this.fm.timerb & 0xff) + this.fm.reg[0x12];
				this.fm.status |= this.fm.reg[0x14] >> 2 & 2;
			}
		}
		for (this.count = 50; this.count < 100; this.count++) {
			this.ram4[8] |= this.ram4[8] << 3 & 0x40;
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
		this.in[3] = this.in[3] & ~(1 << 6) | !this.fCoin << 6;
		this.in[0] = this.in[0] & ~(1 << 7) | !this.fStart1P << 7;
		this.in[1] = this.in[1] & ~(1 << 7) | !this.fStart2P << 7;
		this.fCoin -= !!this.fCoin, this.fStart1P -= !!this.fStart1P, this.fStart2P -= !!this.fStart2P;
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
		this.in[0] = this.in[0] & ~(1 << 3) | fDown << 2 | !fDown << 3;
	}

	right(fDown) {
		this.in[0] = this.in[0] & ~(1 << 0) | fDown << 1 | !fDown << 0;
	}

	down(fDown) {
		this.in[0] = this.in[0] & ~(1 << 2) | fDown << 3 | !fDown << 2;
	}

	left(fDown) {
		this.in[0] = this.in[0] & ~(1 << 1) | fDown << 0 | !fDown << 1;
	}

	triggerA(fDown) {
		this.in[0] = this.in[0] & ~(1 << 4) | !fDown << 4;
	}

	triggerB(fDown) {
		this.in[0] = this.in[0] & ~(1 << 5) | !fDown << 5;
	}

	convertCHR() {
		for (let p = 0, q = 0, i = 16384; i !== 0; q += 8, --i)
			this.isspace[p++] = Number(CHR8.subarray(q, q + 8).every(e => !e));
		this.chr.set(CHR);
	}

	convertOBJ() {
		for (let p = 0, q = 0, i = 1024; i !== 0; q += 512, --i) {
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
		const ram = this.ram, black = 0x1800, flip = !!(ram[0x5ff6] & 1);

		// 画面クリア
		let p = 256 * 16 + 16;
		for (let i = 0; i < 288; p += 256, i++)
			data.fill(black, p, p + 224);

		for (let pri = 0; pri < 8; pri++) {
			// bg描画
			if (ram[0x4010] === pri) {
				const vScroll = ram[0x4001] | ram[0x4000] << 8, hScroll = ram[0x4003] | ram[0x4002] << 8, color = ram[0x4018] << 8 & 0x700 | 0x800;
				p = flip ? 256 * 8 * 2 + 232 - (176 - vScroll & 7) * 256 + (264 - hScroll & 7) : 256 * 8 * 2 + 232 - (48 + vScroll & 7) * 256 + (24 + hScroll & 7);
				let k = flip ? 176 - vScroll >> 2 & 0x7e | 264 - hScroll << 4 & 0x1f80 | 0x8000 : 48 + vScroll >> 2 & 0x7e | 24 + hScroll << 4 & 0x1f80 | 0x8000;
				for (let i = 0; i < 29; k = k + 54 & 0x7e | k + 0x80 & 0x1f80 | 0x8000, p -= 256 * 8 * 37 + 8, i++)
					for (let j = 0; j < 37; k = k + 2 & 0x7e | k & 0xff80, p += 256 * 8, j++)
						this.xfer8x8(data, p, k, color);
			}
			if (ram[0x4011] === pri) {
				const vScroll = ram[0x4005] | ram[0x4004] << 8, hScroll = ram[0x4007] | ram[0x4006] << 8, color = ram[0x4019] << 8 & 0x700 | 0x800;
				p = flip ? 256 * 8 * 2 + 232 - (178 - vScroll & 7) * 256 + (264 - hScroll & 7) : 256 * 8 * 2 + 232 - (46 + vScroll & 7) * 256 + (24 + hScroll & 7);
				let k = flip ? 178 - vScroll >> 2 & 0x7e | 264 - hScroll << 4 & 0x1f80 | 0xa000 : 46 + vScroll >> 2 & 0x7e | 24 + hScroll << 4 & 0x1f80 | 0xa000;
				for (let i = 0; i < 29; k = k + 54 & 0x7e | k + 0x80 & 0x1f80 | 0xa000, p -= 256 * 8 * 37 + 8, i++)
					for (let j = 0; j < 37; k = k + 2 & 0x7e | k & 0xff80, p += 256 * 8, j++)
						this.xfer8x8(data, p, k, color);
			}
			if (ram[0x4012] === pri) {
				const vScroll = ram[0x4009] | ram[0x4008] << 8, hScroll = ram[0x400b] | ram[0x400a] << 8, color = ram[0x401a] << 8 & 0x700 | 0x800;
				p = flip ? 256 * 8 * 2 + 232 - (179 - vScroll & 7) * 256 + (264 - hScroll & 7) : 256 * 8 * 2 + 232 - (45 + vScroll & 7) * 256 + (24 + hScroll & 7);
				let k = flip ? 179 - vScroll >> 2 & 0x7e | 264 - hScroll << 4 & 0x1f80 | 0xc000 : 45 + vScroll >> 2 & 0x7e | 24 + hScroll << 4 & 0x1f80 | 0xc000;
				for (let i = 0; i < 29; k = k + 54 & 0x7e | k + 0x80 & 0x1f80 | 0xc000, p -= 256 * 8 * 37 + 8, i++)
					for (let j = 0; j < 37; k = k + 2 & 0x7e | k & 0xff80, p += 256 * 8, j++)
						this.xfer8x8(data, p, k, color);
			}
			if (ram[0x4013] === pri) {
				const vScroll = ram[0x400d] | ram[0x400c] << 8, hScroll = ram[0x400f], color = ram[0x401b] << 8 & 0x700 | 0x800;
				p = flip ? 256 * 8 * 2 + 232 - (180 - vScroll & 7) * 256 + (8 - hScroll & 7) : 256 * 8 * 2 + 232 - (44 + vScroll & 7) * 256 + (24 + hScroll & 7);
				let k = flip ? 180 - vScroll >> 2 & 0x7e | 8 - hScroll << 4 & 0xf80 | 0xe000 : 44 + vScroll >> 2 & 0x7e | 24 + hScroll << 4 & 0xf80 | 0xe000;
				for (let i = 0; i < 29; k = k + 54 & 0x7e | k + 0x80 & 0xf80 | 0xe000, p -= 256 * 8 * 37 + 8, i++)
					for (let j = 0; j < 37; k = k + 2 & 0x7e | k & 0xff80, p += 256 * 8, j++)
						this.xfer8x8(data, p, k, color);
			}
			if (ram[0x4014] === pri) {
				const color = ram[0x401c] << 8 & 0x700 | 0x800;
				p = 256 * 8 * 2 + 232;
				for (let k = 0xf010, i = 0; i < 28; p -= 256 * 8 * 36 + 8, i++)
					for (let j = 0; j < 36; k = k + 2, p += 256 * 8, j++)
						this.xfer8x8(data, p, k, color);
			}
			if (ram[0x4015] === pri) {
				const color = ram[0x401d] << 8 & 0x700 | 0x800;
				p = 256 * 8 * 2 + 232;
				for (let k = 0xf810, i = 0; i < 28; p -= 256 * 8 * 36 + 8, i++)
					for (let j = 0; j < 36; k = k + 2, p += 256 * 8, j++)
						this.xfer8x8(data, p, k, color);
			}

			// obj描画
			for (let k = 0x5800, i = 127; i !== 0; k += 16, --i) {
				if (ram[k + 8] >> 5 !== pri)
					continue;
				const w = [16, 8, 32, 4][ram[k + 8] >> 1 & 3], h = [16, 8, 32, 4][ram[k + 4] >> 6];
				const x = w + ram[k + 9] + ram[0x5ff7] - (flip ? 0 : 2) & 0xff;
				const y = (ram[k + 7] | ram[k + 6] << 8) + (ram[0x5ff5] | ram[0x5ff4] << 8) - (flip ? 135 : 57) & 0x1ff;
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
		if (t > 16 || b < 288 + 16 || l > 16 || r < 224 + 16)
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
		const c = this.ram[k] << 8 & 0x3f00 | this.ram[k + 1], q1 = c << 3, q2 = q1 << 3;

		if (this.isspace[c])
			return;
		CHR8[q1 | 0] & 0x80 && (data[p + 0x007] = color | this.chr[q2 | 0x00]);
		CHR8[q1 | 0] & 0x40 && (data[p + 0x107] = color | this.chr[q2 | 0x01]);
		CHR8[q1 | 0] & 0x20 && (data[p + 0x207] = color | this.chr[q2 | 0x02]);
		CHR8[q1 | 0] & 0x10 && (data[p + 0x307] = color | this.chr[q2 | 0x03]);
		CHR8[q1 | 0] & 0x08 && (data[p + 0x407] = color | this.chr[q2 | 0x04]);
		CHR8[q1 | 0] & 0x04 && (data[p + 0x507] = color | this.chr[q2 | 0x05]);
		CHR8[q1 | 0] & 0x02 && (data[p + 0x607] = color | this.chr[q2 | 0x06]);
		CHR8[q1 | 0] & 0x01 && (data[p + 0x707] = color | this.chr[q2 | 0x07]);
		CHR8[q1 | 1] & 0x80 && (data[p + 0x006] = color | this.chr[q2 | 0x08]);
		CHR8[q1 | 1] & 0x40 && (data[p + 0x106] = color | this.chr[q2 | 0x09]);
		CHR8[q1 | 1] & 0x20 && (data[p + 0x206] = color | this.chr[q2 | 0x0a]);
		CHR8[q1 | 1] & 0x10 && (data[p + 0x306] = color | this.chr[q2 | 0x0b]);
		CHR8[q1 | 1] & 0x08 && (data[p + 0x406] = color | this.chr[q2 | 0x0c]);
		CHR8[q1 | 1] & 0x04 && (data[p + 0x506] = color | this.chr[q2 | 0x0d]);
		CHR8[q1 | 1] & 0x02 && (data[p + 0x606] = color | this.chr[q2 | 0x0e]);
		CHR8[q1 | 1] & 0x01 && (data[p + 0x706] = color | this.chr[q2 | 0x0f]);
		CHR8[q1 | 2] & 0x80 && (data[p + 0x005] = color | this.chr[q2 | 0x10]);
		CHR8[q1 | 2] & 0x40 && (data[p + 0x105] = color | this.chr[q2 | 0x11]);
		CHR8[q1 | 2] & 0x20 && (data[p + 0x205] = color | this.chr[q2 | 0x12]);
		CHR8[q1 | 2] & 0x10 && (data[p + 0x305] = color | this.chr[q2 | 0x13]);
		CHR8[q1 | 2] & 0x08 && (data[p + 0x405] = color | this.chr[q2 | 0x14]);
		CHR8[q1 | 2] & 0x04 && (data[p + 0x505] = color | this.chr[q2 | 0x15]);
		CHR8[q1 | 2] & 0x02 && (data[p + 0x605] = color | this.chr[q2 | 0x16]);
		CHR8[q1 | 2] & 0x01 && (data[p + 0x705] = color | this.chr[q2 | 0x17]);
		CHR8[q1 | 3] & 0x80 && (data[p + 0x004] = color | this.chr[q2 | 0x18]);
		CHR8[q1 | 3] & 0x40 && (data[p + 0x104] = color | this.chr[q2 | 0x19]);
		CHR8[q1 | 3] & 0x20 && (data[p + 0x204] = color | this.chr[q2 | 0x1a]);
		CHR8[q1 | 3] & 0x10 && (data[p + 0x304] = color | this.chr[q2 | 0x1b]);
		CHR8[q1 | 3] & 0x08 && (data[p + 0x404] = color | this.chr[q2 | 0x1c]);
		CHR8[q1 | 3] & 0x04 && (data[p + 0x504] = color | this.chr[q2 | 0x1d]);
		CHR8[q1 | 3] & 0x02 && (data[p + 0x604] = color | this.chr[q2 | 0x1e]);
		CHR8[q1 | 3] & 0x01 && (data[p + 0x704] = color | this.chr[q2 | 0x1f]);
		CHR8[q1 | 4] & 0x80 && (data[p + 0x003] = color | this.chr[q2 | 0x20]);
		CHR8[q1 | 4] & 0x40 && (data[p + 0x103] = color | this.chr[q2 | 0x21]);
		CHR8[q1 | 4] & 0x20 && (data[p + 0x203] = color | this.chr[q2 | 0x22]);
		CHR8[q1 | 4] & 0x10 && (data[p + 0x303] = color | this.chr[q2 | 0x23]);
		CHR8[q1 | 4] & 0x08 && (data[p + 0x403] = color | this.chr[q2 | 0x24]);
		CHR8[q1 | 4] & 0x04 && (data[p + 0x503] = color | this.chr[q2 | 0x25]);
		CHR8[q1 | 4] & 0x02 && (data[p + 0x603] = color | this.chr[q2 | 0x26]);
		CHR8[q1 | 4] & 0x01 && (data[p + 0x703] = color | this.chr[q2 | 0x27]);
		CHR8[q1 | 5] & 0x80 && (data[p + 0x002] = color | this.chr[q2 | 0x28]);
		CHR8[q1 | 5] & 0x40 && (data[p + 0x102] = color | this.chr[q2 | 0x29]);
		CHR8[q1 | 5] & 0x20 && (data[p + 0x202] = color | this.chr[q2 | 0x2a]);
		CHR8[q1 | 5] & 0x10 && (data[p + 0x302] = color | this.chr[q2 | 0x2b]);
		CHR8[q1 | 5] & 0x08 && (data[p + 0x402] = color | this.chr[q2 | 0x2c]);
		CHR8[q1 | 5] & 0x04 && (data[p + 0x502] = color | this.chr[q2 | 0x2d]);
		CHR8[q1 | 5] & 0x02 && (data[p + 0x602] = color | this.chr[q2 | 0x2e]);
		CHR8[q1 | 5] & 0x01 && (data[p + 0x702] = color | this.chr[q2 | 0x2f]);
		CHR8[q1 | 6] & 0x80 && (data[p + 0x001] = color | this.chr[q2 | 0x30]);
		CHR8[q1 | 6] & 0x40 && (data[p + 0x101] = color | this.chr[q2 | 0x31]);
		CHR8[q1 | 6] & 0x20 && (data[p + 0x201] = color | this.chr[q2 | 0x32]);
		CHR8[q1 | 6] & 0x10 && (data[p + 0x301] = color | this.chr[q2 | 0x33]);
		CHR8[q1 | 6] & 0x08 && (data[p + 0x401] = color | this.chr[q2 | 0x34]);
		CHR8[q1 | 6] & 0x04 && (data[p + 0x501] = color | this.chr[q2 | 0x35]);
		CHR8[q1 | 6] & 0x02 && (data[p + 0x601] = color | this.chr[q2 | 0x36]);
		CHR8[q1 | 6] & 0x01 && (data[p + 0x701] = color | this.chr[q2 | 0x37]);
		CHR8[q1 | 7] & 0x80 && (data[p + 0x000] = color | this.chr[q2 | 0x38]);
		CHR8[q1 | 7] & 0x40 && (data[p + 0x100] = color | this.chr[q2 | 0x39]);
		CHR8[q1 | 7] & 0x20 && (data[p + 0x200] = color | this.chr[q2 | 0x3a]);
		CHR8[q1 | 7] & 0x10 && (data[p + 0x300] = color | this.chr[q2 | 0x3b]);
		CHR8[q1 | 7] & 0x08 && (data[p + 0x400] = color | this.chr[q2 | 0x3c]);
		CHR8[q1 | 7] & 0x04 && (data[p + 0x500] = color | this.chr[q2 | 0x3d]);
		CHR8[q1 | 7] & 0x02 && (data[p + 0x600] = color | this.chr[q2 | 0x3e]);
		CHR8[q1 | 7] & 0x01 && (data[p + 0x700] = color | this.chr[q2 | 0x3f]);
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
 *	World Court
 *
 */

let SND, PRG, MCU, VOI, CHR8, CHR, OBJ;

read('wldcourt.zip').then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	SND = zip.decompress('wc1_snd0.bin').addBase();
	PRG = Uint8Array.concat(...['wc1_prg6.bin', 'wc1_prg7.bin'].map(e => zip.decompress(e))).addBase();
	MCU = zip.decompress('cus64-64a1.mcu').addBase();
	VOI = Uint8Array.concat(...['wc1_voi0.bin', 'wc1_voi0.bin', 'wc1_voi1.bin'].map(e => zip.decompress(e))).addBase();
	CHR8 = zip.decompress('wc1_chr8.bin');
	CHR = Uint8Array.concat(...['wc1_chr0.bin', 'wc1_chr1.bin', 'wc1_chr2.bin', 'wc1_chr3.bin'].map(e => zip.decompress(e)));
	OBJ = Uint8Array.concat(...['wc1_obj0.bin', 'wc1_obj1.bin', 'wc1_obj2.bin', 'wc1_obj3.bin', 'wc1_obj3.bin'].map(e => zip.decompress(e)));
	game = new WorldCourt();
	sound = [
		new YM2151({clock: 3579580, resolution: 58, gain: 1.4}),
		new C30({clock: 49152000 / 2048 / 2, resolution: 58}),
		new Dac8Bit2Ch({resolution: 100, gain: 0.5}),
	];
	canvas.addEventListener('click', () => game.coin());
	init({game, sound});
});

