/*
 *
 *	X68000
 *
 */

import YM2151 from './ym2151.js';
import MSM6258 from './msm6258.js';
import {init, read} from './main.js';
import MC68000 from './mc68000.js';
let game, sound;

class X68000 {
	cxScreen = 768;
	cyScreen = 512;
	width = 1024;
	height = 1024;
	xOffset = 16;
	yOffset = 16;
	rotate = false;

	fReset = true;

	ram = new Uint8Array(0xf00000).addBase();
	view = new DataView(this.ram.buffer);
	fdc = {status: 0x80, data: 0, irq: false, c: new Uint8Array(4), done: true, g: generator()};
	fdd = {control: 0, select: 0};
	scc = {a: {wr: new Uint8Array(16), rr: new Uint8Array(16)}, b: {wr: new Uint8Array(16), rr: new Uint8Array(16)}};
	keyboard = {fifo: []};
	mouse = {button: 0, x: 0, y: 0, fifo: []};

	pcg8 = new Uint8Array(0x4000);
	pcg16 = new Uint8Array(0x10000);
	rgb = new Uint32Array(0x10000).fill(0xff000000);
	bitmap;

	cpu = new MC68000(Math.floor(40000000 / 4));
	scanline = {rate: 31500 * 138, frac: 0, h_count: 0, v_count: 0, execute(rate, fn) {
		for (this.frac += this.rate; this.frac >= rate; this.frac -= rate)
			fn();
	}};
	timer1 = {rate: 4000000, frac: 0, prescaler: 0, count: 0, reload: 0, execute(rate, fn) {
		for (this.frac += this.rate; this.frac >= rate; this.frac -= rate)
			this.prescaler && !--this.count && (this.count = this.prescaler, fn());
	}};
	timer2 = {rate: 4000000, frac: 0, prescaler: 0, count: 0, reload: 0, execute(rate, fn) {
		for (this.frac += this.rate; this.frac >= rate; this.frac -= rate)
			this.prescaler && !--this.count && (this.count = this.prescaler, fn());
	}};

	constructor() {
		// CPU周りの初期化
		for (let i = 0; i < 0xf000; i++) {
			this.cpu.memorymap[i].base = this.ram.base[i];
			this.cpu.memorymap[i].write = null;
		}
		for (let i = 0; i < 0x800; i++)
			this.cpu.memorymap[0xe000 + i].write = (addr, data) => { // TEXT VRAM
				const r21 = this.view.getUint16(0xe8002a), mask = r21 & 0x200 ? this.ram[0xe8002e | addr & 1] : 0;
				if (~r21 & 0x100)
					return void(this.ram[addr] = this.ram[addr] & mask | data & ~mask);
				addr &= ~0x60000, r21 & 0x10 && (this.ram[addr] = this.ram[addr] & mask | data & ~mask);
				addr += 0x20000, r21 & 0x20 && (this.ram[addr] = this.ram[addr] & mask | data & ~mask);
				addr += 0x20000, r21 & 0x40 && (this.ram[addr] = this.ram[addr] & mask | data & ~mask);
				addr += 0x20000, r21 & 0x80 && (this.ram[addr] = this.ram[addr] & mask | data & ~mask);
			};
		this.cpu.memorymap[0xe800].write = (addr, data) => { // CRTC
			(addr & ~1) === 0xe80012 && (this.ram[0xe88001] |= 0x40);
			addr === 0xe80028 && (data ^ this.ram[addr]) & 4 && this.ram.fill(0, 0xc00000, 0xe00000);
			addr === 0xe80029 && (this.cxScreen = [256, 512, 768][data & 3], this.cyScreen = data >> 2 & 1 ? 512 : 256);
			this.ram[addr] = data;
			if (addr === 0xe80001 || addr === 0xe80029)
				this.scanline.rate = (this.ram[0xe80029] & 0x10 ? 31500 : 15980) * (this.ram[0xe80001] + 1), this.scanline.frac = 0;
		};
		this.cpu.memorymap[0xe804].write = (addr, data) => { // CRTC
			if (addr === 0xe80481 && data & 8 && this.ram[0xe8002c] !== this.ram[0xe8002d]) {
				let r21 = this.ram[0xe8002b], src = this.ram[0xe8002c] << 9, dst = this.ram[0xe8002d] << 9;
				src += 0xe00000, dst += 0xe00000, r21 & 1 && this.ram.copyWithin(dst, src, src + 0x200);
				src += 0x20000, dst += 0x20000, r21 & 2 && this.ram.copyWithin(dst, src, src + 0x200);
				src += 0x20000, dst += 0x20000, r21 & 4 && this.ram.copyWithin(dst, src, src + 0x200);
				src += 0x20000, dst += 0x20000, r21 & 8 && this.ram.copyWithin(dst, src, src + 0x200);
			}
			this.ram[addr] = data;
		};
		this.cpu.memorymap[0xe840].write = (addr, data) => { // DMAC
			const base = addr & ~0x3f;
			switch (addr & ~0xc0) {
			case 0xe84000:
				return void(this.ram[addr] &= ~(data & 0xf6));
			case 0xe84007:
				data & 0x10 && this.ram[base] & 8 && (this.ram[base] = this.ram[base] & ~8 | 0x10, this.ram[base + 1] = 0x11);
				if (data & 0x80 && (this.ram[base] & 0xf8) === 0) {
					const ch = addr >> 6 & 3, cr = this.view.getUint32(base + 4);
					let mtc = this.view.getUint16(base + 0xa), mar = this.view.getUint32(base + 0xc), dar = this.view.getUint32(base + 0x14);
					let btc = this.view.getUint16(base + 0x1a), bar = this.view.getUint32(base + 0x1c);
					if (ch === 2) {
						(data | this.ram[addr]) & 0x40 && console.log(`dma continue operation`);
						const size = 1 << (cr >> 20 & 3);
						switch (cr & ~0xff) {
						case 0x08010100: case 0x08110100: case 0x08210100:
							if (size === 1)
								this.ram.fill(this.ram[mar], dar, dar + mtc);
							else if (size === 2)
								for (let i = 0; i < mtc; i++)
									this.view.setUint16(dar + i * 2, this.view.getUint16(mar));
							else if (size === 4)
								for (let i = 0; i < mtc; i++)
									this.view.setUint16(dar + i * 4, this.view.getUint16(mar)), this.view.setUint16(dar + i * 4 + 2, this.view.getUint16(mar));
							this.view.setUint16(base + 0xa, 0), this.view.setUint32(base + 0x14, dar + mtc * size);
							return this.ram[base] |= 0x80, void(this.ram[addr] = data & 8);
						case 0x08010500: case 0x08110500: case 0x08210500:
							this.ram.copyWithin(dar, mar, mar + mtc * size), dar += mtc * size;
							this.view.setUint16(base + 0xa, 0), this.view.setUint32(base + 0xc, mar + mtc * size), this.view.setUint32(base + 0x14, dar);
							return this.ram[base] |= 0x80, void(this.ram[addr] = data & 8);
						case 0x08090500: case 0x08190500: case 0x08290500:
							do {
								mar = this.view.getUint32(bar), mtc = this.view.getUint16(bar + 4), bar += 6, this.ram.copyWithin(dar, mar, mar + mtc * size), dar += mtc * size;
							} while (--btc);
							this.view.setUint16(base + 0xa, 0), this.view.setUint32(base + 0xc, mar + mtc * size), this.view.setUint32(base + 0x14, dar);
							return this.view.setUint16(base + 0x1a, 0), this.view.setUint32(base + 0x1c, bar), this.ram[base] |= 0x80, void(this.ram[addr] = data & 8);
						case 0x080d0500: case 0x081d0500: case 0x082d0500:
							do {
								mar = this.view.getUint32(bar), mtc = this.view.getUint16(bar + 4), this.ram.copyWithin(dar, mar, mar + mtc * size), dar += mtc * size;
							} while (bar = this.view.getUint32(bar + 6));
							this.view.setUint16(base + 0xa, 0), this.view.setUint32(base + 0xc, mar + mtc * size), this.view.setUint32(base + 0x14, dar);
							return this.view.setUint32(base + 0x1c, bar), this.ram[base] |= 0x80, void(this.ram[addr] = data & 8);
						}
						console.log(`unknown dma control: $${cr.toString(16)}`);
						return this.view.setUint16(base + 0xa, 0), this.ram[base] |= 0x80, void(this.ram[addr] = data & 8);
					}
					if (cr & 0x80000) {
						this.view.setUint32(base + 0xc, this.view.getUint32(bar)), this.view.setUint16(base + 0xa, this.view.getUint16(bar + 4));
						cr & 0x40000 ? this.view.setUint32(base + 0x1c, this.view.getUint32(bar + 6))
							: (this.view.setUint16(base + 0x1a, btc - 1), this.view.setUint32(base + 0x1c, bar + 6));
					}
					this.ram[base] |= 8;
				}
				return void(this.ram[addr] = data & 0x48);
			default:
				return void(this.ram[addr] = data);
			}
		};
		this.cpu.memorymap[0xe880].read = (addr) => { // MFP
			switch (addr) {
			case 0xe8802d:
				return this.ram[addr] | 0x80;
			case 0xe8802f:
				return this.ram[0xe8802b] &= ~0x80, this.ram[addr];
			default:
				return this.ram[addr];
			}
		};
		this.cpu.memorymap[0xe880].write = (addr, data) => { // MFP
			const delta = this.ram[addr] ^ data;
			switch (addr) {
			case 0xe8801d:
				delta & 0x70 && (this.timer1.prescaler = this.timer1.count = [0, 4, 10, 16, 50, 64, 100, 200][data >> 4 & 7]);
				delta & 7 && (this.timer2.prescaler = this.timer2.count = [0, 4, 10, 16, 50, 64, 100, 200][data & 7]);
				return void(this.ram[addr] = data);
			case 0xe88023:
				return void(this.timer1.reload = this.ram[addr] = data);
			case 0xe88025:
				return void(this.timer2.reload = this.ram[addr] = data);
			case 0xe8802f:
				return;
			default:
				return void(this.ram[addr] = data);
			}
		};
		this.cpu.memorymap[0xe8a0].read = (addr) => { // RTC
			if (this.ram[0xe8a01b] & 1)
				return this.ram[addr];
			const date = new Date();
			switch (addr & 0xff) {
			case 1:
				return date.getSeconds() % 10;
			case 3:
				return Math.floor(date.getSeconds() / 10);
			case 5:
				return date.getMinutes() % 10;
			case 7:
				return Math.floor(date.getMinutes() / 10);
			case 9:
				return date.getHours() % 10;
			case 0xb:
				return Math.floor(date.getHours() / 10);
			case 0xd:
				return date.getDay();
			case 0xf:
				return date.getDate() % 10;
			case 0x11:
				return Math.floor(date.getDate() / 10);
			case 0x13:
				return (date.getMonth() + 1) % 10;
			case 0x15:
				return Math.floor((date.getMonth() + 1) / 10);
			case 0x17:
				return date.getFullYear() % 10;
			case 0x19:
				return (date.getFullYear() / 10 - 8) % 10;
			default:
				return this.ram[addr];
			}
		};
		this.cpu.memorymap[0xe8a0].write = (addr, data) => { // RTC
			if (this.ram[0xe8a01b] & 1 || addr >= 0xe8a01a)
				this.ram[addr] = data;
		};
		this.cpu.memorymap[0xe8e0].write = (addr, data) => { // SYSTEM PORT
			if (addr === 0xe8e001 && (data ^ this.ram[addr]) & 15)
				for (let i = 0; i < 0x10000; i++)
					this.rgb[i] = (i >> 5 & 62 | i & 1) * (data & 15) * 255 / 945	// Red
						| (i >> 10 & 62 | i & 1) * (data & 15) * 255 / 945 << 8		// Green
						| (i & 63) * (data & 15) * 255 / 945 << 16					// Blue
						| 0xff000000;												// Alpha
			this.ram[addr] = data;
		};
		this.cpu.memorymap[0xe900].read = (addr) => { // OPM
			switch (addr) {
			case 0xe90003:
				return sound[0].status;
			default:
				return this.ram[addr];
			}
		};
		this.cpu.memorymap[0xe900].write = (addr, data) => { // OPM
			switch (addr) {
			case 0xe90001:
				return void(sound[0].addr = data);
			case 0xe90003:
				sound[0].addr === 0x1b && (sound[1].clock = data & 0x80 ? 16000000 / 4 : 16000000 / 2);
				return sound[0].write(data);
			default:
				return void(this.ram[addr] = data);
			}
		};
		this.cpu.memorymap[0xe920].read = (addr) => { // ADPCM
			return addr === 0xe92001 ? sound[1].status() : this.ram[addr];
		};
		this.cpu.memorymap[0xe920].write = (addr, data) => { // ADPCM
			switch (addr) {
			case 0xe92001:
				return sound[1].command(data);
			case 0xe90003:
				return sound[1].write(data);
			default:
				return void(this.ram[addr] = data);
			}
		};
		this.cpu.memorymap[0xe940].read = (addr) => { // FDC/FDD
			let data;
			switch (addr) {
			case 0xe94001:
				return this.fdc.status;
			case 0xe94003:
				return data = this.fdc.data, !this.fdc.done && (this.fdc.done = this.fdc.g.next().done), data;
			default:
				return this.ram[addr];
			}
		};
		this.cpu.memorymap[0xe940].write = (addr, data) => { // FDC/FDD
			switch (addr) {
			case 0xe94003:
				return this.fdc.data = data, this.fdc.done && (this.fdc.g = generator(this.fdc, () => this.dma(0))), void(this.fdc.done = this.fdc.g.next().done);
			case 0xe94005:
				return this.ram[addr] = FDD[31 - Math.clz32(data & 15)] ? 0x80 : 0, void(this.fdd.control = data);
			case 0xe94007:
				return void(this.fdd.select = this.ram[addr] = data);
			default:
				return void(this.ram[addr] = data);
			}
		};
		this.cpu.memorymap[0xe960].read = (addr) => { // SASI
			return addr === 0xe96003 ? this.ram[addr] | 2 : this.ram[addr];
		};
		this.cpu.memorymap[0xe980].read = (addr) => { // SCC
			let reg, data;
			switch (addr) {
			case 0xe98001:
				return reg = this.scc.b.wr[0], this.scc.b.wr[0] = 0, reg = ((reg & 0x38) === 8 ? 8 : 0) | reg & 7, this.scc.b.rr[reg];
			case 0xe98003:
				data = this.scc.b.rr[8];
				if (this.mouse.fifo.length)
					this.scc.b.rr[8] = this.mouse.fifo.shift(), this.scc.b.rr[0] |= 1, (this.scc.b.wr[1] & 0x18) === 0x10 && (this.scc.a.rr[3] |= 4);
				else
					this.scc.b.rr[0] &= ~1;
				return data;
			case 0xe98005:
				return reg = this.scc.b.wr[0], this.scc.b.wr[0] = 0, reg = ((reg & 0x38) === 8 ? 8 : 0) | reg & 7, this.scc.b.rr[reg];
			case 0xe98007:
				return this.scc.a.rr[8];
			default:
				return this.ram[addr];
			}
		};
		this.cpu.memorymap[0xe980].write = (addr, data) => { // SCC
			let reg;
			switch (addr) {
			case 0xe98001:
				reg = this.scc.b.wr[0], reg = ((reg & 0x38) === 8 ? 8 : 0) | reg & 7;
				if (reg ===5 && ~data & this.scc.b.wr[reg] & 2) {
					const dx = Math.min(127, Math.max(-128, this.mouse.x)), dy = Math.min(127, Math.max(-128, this.mouse.y));
					this.mouse.x -= dx, this.mouse.y -= dy;
					if (~this.scc.b.rr[0] & 1) {
						this.mouse.fifo.push(this.mouse.button, dx, dy), this.scc.b.rr[8] = this.mouse.fifo.shift();
						this.scc.b.rr[0] |= 1, (this.scc.b.wr[1] & 0x18) === 0x10 && (this.scc.a.rr[3] |= 4);
					}
				}
				return this.scc.b.wr[reg] = data, void(reg && (this.scc.b.wr[0] = 0));
			case 0xe98003:
				return void(this.scc.b.wr[8] = data);
			case 0xe98005:
				reg = this.scc.a.wr[0], reg = ((reg & 0x38) === 8 ? 8 : 0) | reg & 7;
				return this.scc.a.wr[reg] = data, void(reg && (this.scc.a.wr[0] = 0));
			case 0xe98007:
				return void(this.scc.a.wr[8] = data);
			default:
				return void(this.ram[addr] = data);
			}
		};
		this.cpu.memorymap[0xe9a0].read = (addr) => { // PPI
			return addr === 0xe9a001 || addr === 0xe9a003 ? this.ram[addr] ^ 0xff : this.ram[addr];
		};
		this.cpu.memorymap[0xe9a0].write = (addr, data) => { // PPI
			return addr === 0xe9a005 ? sound[1].control(this.ram[addr] = data) : void(this.ram[addr] = data);
		};
		for (let i = 0; i < 0xc00; i++)
			this.cpu.memorymap[0xf000 + i].base = ROM.base[i];
		for (let i = 0; i < 0x200; i++)
			this.cpu.memorymap[0xfe00 + i].base = ROM.base[0xc00 + i];

		this.cpu.check_interrupt = () => {
			let cause = 31 - Math.clz32(this.ram[0xe8800b] << 8 & this.ram[0xe88013] << 8 | this.ram[0xe8800d] & this.ram[0xe88015]);
			if (cause >= 0 && this.cpu.interrupt(6, this.ram[0xe88017] & ~15 | cause))
				return cause >= 8 ? (this.ram[0xe8800b] &= ~(1 << cause - 8)) : (this.ram[0xe8800d] &= ~(1 << cause)), true;
			if (this.scc.a.rr[3] & 4 && this.cpu.interrupt(5, this.scc.a.wr[2] & ~0xe | 4))
				return this.scc.a.rr[3] &= ~4, true;
			if (this.ram[0xe84080] & 0xe0 && this.ram[0xe84087] & 8 && this.cpu.interrupt(3, this.ram[0xe840a5]))
				return true;
			if (this.ram[0xe840c0] & 0xe0 && this.ram[0xe840c7] & 8 && this.cpu.interrupt(3, this.ram[0xe840e5]))
				return true;
			if (this.fdc.irq && this.cpu.interrupt(1, this.ram[0xe9c003] & ~3))
				return this.fdc.irq = false, true;
			return false;
		};
	}

	dma(ch) {
		const base = 0xe84000 | ch << 6;
		if (~this.ram[base] & 8)
			return true;
		let ocr = this.ram[base + 5], scr = this.ram[base + 6], ccr = this.ram[base + 7];
		let mtc = this.view.getUint16(base + 0xa), mar = this.view.getUint32(base + 0xc), dar = this.view.getUint32(base + 0x14);
		if (ch === 0) {
			ocr & 0x80 ? (this.ram[mar] = this.fdc.data) : (this.fdc.data = this.ram[mar]), scr & 4 && ++mar, scr & 8 && --mar, --mtc;
		} else if (ch === 3) {
			ocr & 0x80 ? void(this.ram[mar] = 0) : sound[1].write(this.ram[mar]), scr & 4 && ++mar, scr & 8 && --mar, --mtc;
		} else
			console.log(`dma ch${ch}:`);
		if (!mtc) {
			if ((ocr >> 2 & 3) === 2) {
				let btc = this.view.getUint16(base + 0x1a), bar = this.view.getUint32(base + 0x1c);
				if (btc)
					mar = this.view.getUint32(bar), mtc = this.view.getUint16(bar + 4), this.view.setUint16(base + 0x1a, btc - 1), this.view.setUint32(base + 0x1c, bar + 6);
				else
					this.ram[base] = this.ram[base] & ~8 | 0x80;
			} else if ((ocr >> 2 & 3) === 3) {
				let bar = this.view.getUint32(base + 0x1c);
				if (bar)
					mar = this.view.getUint32(bar), mtc = this.view.getUint16(bar + 4), this.view.setUint32(base + 0x1c, this.view.getUint32(bar + 6));
				else
					this.ram[base] = this.ram[base] & ~8 | 0x80;
			} else if (ccr & 0x40)
				mtc = this.view.getUint16(base + 0x1a), mar = this.view.getUint32(base + 0x1c), this.ram[base] |= 0x40;
			else
				this.ram[base] = this.ram[base] & ~8 | 0x80;
		}
		this.view.setUint16(base + 0xa, mtc), this.view.setUint32(base + 0xc, mar), this.view.setUint32(base + 0x14, dar);
		return !mtc;
	}

	execute(audio, rate_correction) {
		const tick_rate = 384000, tick_max = Math.floor(tick_rate / 60);
		for (let i = 0; i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.scanline.execute(tick_rate, () => {
				if (++this.scanline.h_count > this.ram[0xe80001]) {
					this.scanline.h_count = 0, this.ram[0xe8800b] |= this.ram[0xe88007] & 0x80;
					if (++this.scanline.v_count > this.view.getUint16(0xe80008)) {
						if (this.bitmap) {
							for (let p = 1024 * 16 + 16, i = this.cyScreen; i !== 0; p += 1024, --i)
								this.bitmap.fill(0xff000000, p, p + this.cxScreen);
							for (let i = 2; i >= 0; --i)
								if (i === (this.ram[0xe82500] & 3))
									this.drawGraphic(this.bitmap);
								else if (i === (this.ram[0xe82500] >> 2 & 3))
									this.drawText(this.bitmap);
								else if (i === (this.ram[0xe82500] >> 4 & 3))
									this.drawSprite(this.bitmap);
						}
						this.scanline.v_count = 0;
						this.ram[0xe88019] & 8 ? (this.ram[0xe8800b] |= this.ram[0xe88007] & 0x20) : (this.ram[0xe8800d] |= this.ram[0xe88009] & 0x40);
						this.ram[0xe80481] & 2 && (this.ram.fill(0, 0xc00000, 0xe00000), this.ram[0xe80481] &= ~2);
					}
					const cirq = this.scanline.v_count === (this.view.getUint16(0xe80012) & 0x3ff);
					cirq && (this.ram[0xe88001] &= ~0x40, this.ram[0xe8800b] |= this.ram[0xe88007] & ~this.ram[0xe8800f] & 0x40);
					this.ram[0xe88001] = this.ram[0xe88001] & ~0x10 | (this.scanline.v_count > this.view.getUint16(0xe8000a)) << 4;
				}
				this.ram[0xe88001] = this.ram[0xe88001] & ~0x80 | (this.scanline.h_count <= this.ram[0xe80003]) << 7;
			});
			this.timer1.execute(tick_rate, () => {
				!--this.ram[0xe88023] && (this.ram[0xe88023] = this.timer1.reload, this.ram[0xe8800d] |= this.ram[0xe88009] & 0x20);
			});
			this.timer2.execute(tick_rate, () => {
				!--this.ram[0xe88025] && (this.ram[0xe88025] = this.timer2.reload, this.ram[0xe8800d] |= this.ram[0xe88009] & 0x10);
			});
			sound[0].execute(tick_rate);
			sound[0].status & 3 && this.ram[0xe88001] & 8 && (this.ram[0xe88001] &= ~8, this.ram[0xe8800d] |= this.ram[0xe88009] & 8);
			!(sound[0].status & 3) && ~this.ram[0xe88001] & 8 && (this.ram[0xe88001] |= 8);
			sound[1].execute(tick_rate, rate_correction, () => void this.dma(3));
			audio.execute(tick_rate, rate_correction);
		}
		return this;
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.ram.set(SRAM, 0xed0000);
			this.view.setUint32(0xbffffc, 0xffce14);
			this.cpu.memorymap[0].base = ROM.base[0xd00];
			this.cpu.reset();
			this.cpu.memorymap[0].base = this.ram.base[0];
		}
		return this;
	}

	updateInput() {
		if (this.keyboard.fifo.length && (this.ram[0xe8802b] & 0x81) === 1)
			this.ram[0xe8802f] = this.keyboard.fifo.shift(), this.ram[0xe8802b] |= 0x80, this.ram[0xe8800b] |= this.ram[0xe88007] & 0x10;
		return this;
	}

	up(fDown) {
		this.ram[0xe9a001] = this.ram[0xe9a001] & ~(1 << 0) | fDown << 0;
	}

	right(fDown) {
		this.ram[0xe9a001] = this.ram[0xe9a001] & ~(1 << 3) | fDown << 3;
	}

	down(fDown) {
		this.ram[0xe9a001] = this.ram[0xe9a001] & ~(1 << 1) | fDown << 1;
	}

	left(fDown) {
		this.ram[0xe9a001] = this.ram[0xe9a001] & ~(1 << 2) | fDown << 2;
	}

	triggerA(fDown) {
		this.ram[0xe9a001] = this.ram[0xe9a001] & ~(1 << 6) | fDown << 6;
	}

	triggerB(fDown) {
		this.ram[0xe9a001] = this.ram[0xe9a001] & ~(1 << 5) | fDown << 5;
	}

	makeBitmap(data) {
		if (!this.bitmap) {
			data.fill(0xff000000);
			for (let addr = 0xe80001; addr < 0xe80012; addr += 2)
				if (!this.ram[addr])
					return;
			this.bitmap = data;
		}
	}

	drawGraphic(data) {
		const cx = this.cxScreen, cy = this.cyScreen;
		switch (this.ram[0xe82401] & 7) {
		case 0: // 512x512 16色
			for (let i = 3; i >= 0; --i)
				if (this.ram[0xe82601] & 1 << i) {
					const sc = this.ram[0xe82501] >> i * 2 & 3, hScroll = this.view.getUint16(0xe80018 + sc * 4), vScroll = this.view.getUint16(0xe8001a + sc * 4);
					let p = 1024 * 16 + 16, k = 0xc00001 | sc << 19 | vScroll << 10 & 0x7fc00 | hScroll << 1 & 0x3fe;
					if (this.view.getUint16(0xe82000))
						for (let i = cy; i !== 0; k = k & 0xf80001 | k + 0x400 & 0x7fc00 | k - cx * 2 & 0x3fe, p += 1024 - cx, --i)
							for (let j = cx; j !== 0; k = k & 0xfffc01 | k + 2 & 0x3fe, ++p, --j)
								data[p] = this.rgb[this.view.getUint16(0xe82000 | this.ram[k] << 1 & 30)];
					else
						for (let i = cy; i !== 0; k = k & 0xf80001 | k + 0x400 & 0x7fc00 | k - cx * 2 & 0x3fe, p += 1024 - cx, --i)
							for (let px, j = cx; j !== 0; k = k & 0xfffc01 | k + 2 & 0x3fe, ++p, --j)
								(px = this.ram[k] << 1 & 30) && (data[p] = this.rgb[this.view.getUint16(0xe82000 | px)]);
				}
			return;
		case 1: // 512x512 256色
			for (let i = 2; i >= 0; i -= 2)
				if (this.ram[0xe82601] & 3 << i) {
					const sc = this.ram[0xe82501] >> i * 2 & 2, hScroll = this.view.getUint16(0xe80018 + sc * 4), vScroll = this.view.getUint16(0xe8001a + sc * 4);
					let p = 1024 * 16 + 16, k = 0xc00001 | sc << 18 | vScroll << 10 & 0x7fc00 | hScroll << 1 & 0x3fe;
					if (this.view.getUint16(0xe82000))
						for (let i = cy; i !== 0; k = k & 0xf80001 | k + 0x400 & 0x7fc00 | k - cx * 2 & 0x3fe, p += 1024 - cx, --i)
							for (let j = cx; j !== 0; k = k & 0xfffc01 | k + 2 & 0x3fe, ++p, --j)
								data[p] = this.rgb[this.view.getUint16(0xe82000 | this.ram[k] << 1)];
					else
						for (let i = cy; i !== 0; k = k & 0xf80001 | k + 0x400 & 0x7fc00 | k - cx * 2 & 0x3fe, p += 1024 - cx, --i)
							for (let px, j = cx; j !== 0; k = k & 0xfffc01 | k + 2 & 0x3fe, ++p, --j)
								(px = this.ram[k] << 1) && (data[p] = this.rgb[this.view.getUint16(0xe82000 | px)]);
				}
			return;
		case 3: // 512x512 65536色
			if (this.ram[0xe82601] & 15) {
				let p = 1024 * 16 + 16, k = 0xc00000 | this.view.getUint16(0xe8001a) << 10 & 0x7fc00 | this.view.getUint16(0xe80018) << 1 & 0x3fe;
				if (this.ram[0xe82000] | this.ram[0xe82002])
					for (let i = cy; i !== 0; k = 0xc00000 | k + 0x400 & 0x7fc00 | k - cx * 2 & 0x3fe, p += 1024 - cx, --i)
						for (let px0, px1, j = cx; j !== 0; k = k & 0xfffc00 | k + 2 & 0x3fe, ++p, --j) {
							px0 = this.ram[k], px1 = this.ram[k + 1];
							data[p] = this.rgb[this.ram[0xe82002 | px0 << 1 & 0x1fc | px0 & 1] << 8 | this.ram[0xe82000 | px1 << 1 & 0x1fc | px1 & 1]];
						}
				else
					for (let i = cy; i !== 0; k = 0xc00000 | k + 0x400 & 0x7fc00 | k - cx * 2 & 0x3fe, p += 1024 - cx, --i)
						for (let px0, px1, j = cx; j !== 0; k = k & 0xfffc00 | k + 2 & 0x3fe, ++p, --j)
							if ((px0 = this.ram[k]) | (px1 = this.ram[k + 1]))
								data[p] = this.rgb[this.ram[0xe82002 | px0 << 1 & 0x1fc | px0 & 1] << 8 | this.ram[0xe82000 | px1 << 1 & 0x1fc | px1 & 1]];
			}
			return;
		case 4: // 1024x1024 16色
			if (this.ram[0xe82601] & 16) {
				let p = 1024 * 16 + 16, k = 0xc00001 | this.view.getUint16(0xe8001a) << 11 & 0x1ff800 | this.view.getUint16(0xe80018) << 1 & 0x7fe;
				if (this.view.getUint16(0xe82000))
					for (let i = cy; i !== 0; k = 0xc00001 | k + 0x800 & 0x1ff800 | k - cx * 2 & 0x7fe, p += 1024 - cx, --i)
						for (let j = cx; j !== 0; k = k & 0xfff801 | k + 2 & 0x7fe, ++p, --j)
							data[p] = this.rgb[this.view.getUint16(0xe82000 | this.ram[k] << 1 & 30)];
				else
					for (let i = cy; i !== 0; k = 0xc00001 | k + 0x800 & 0x1ff800 | k - cx * 2 & 0x7fe, p += 1024 - cx, --i)
						for (let px, j = cx; j !== 0; k = k & 0xfff801 | k + 2 & 0x7fe, ++p, --j)
							(px = this.ram[k] << 1 & 30) && (data[p] = this.rgb[this.view.getUint16(0xe82000 | px)]);
			}
			return;
		}
	}

	drawText(data) {
		if (~this.ram[0xe82601] & 0x20)
			return;
		const cx = (this.cxScreen >> 3) + 1, cy = this.cyScreen, hScroll = this.view.getUint16(0xe80014), vScroll = this.view.getUint16(0xe80016);
		let p = 1024 * 16 + 16 - (hScroll & 7), k = 0xe00000 | vScroll << 7 & 0x1ff80 | hScroll >> 3 & 0x7f;
		if(this.view.getUint16(0xe82200))
			for (let i = cy; i !== 0; k = 0xe00000 | k + 0x80 & 0x1fff80 | k - cx & 0x7f, p += 1024 - cx * 8, --i)
				for (let j = cx; j !== 0; k = k & 0xffff80 | k + 1 & 0x7f, p += 8, --j) {
					const p0 = this.ram[k], p1 = this.ram[0x20000 + k], p2 = this.ram[0x40000 + k], p3 = this.ram[0x60000 + k];
					data[p] = this.rgb[this.view.getUint16(0xe82200 | p0 >> 6 & 2 | p1 >> 5 & 4 | p2 >> 4 & 8 | p3 >> 3 & 16)];
					data[p + 1] = this.rgb[this.view.getUint16(0xe82200 | p0 >> 5 & 2 | p1 >> 4 & 4 | p2 >> 3 & 8 | p3 >> 2 & 16)];
					data[p + 2] = this.rgb[this.view.getUint16(0xe82200 | p0 >> 4 & 2 | p1 >> 3 & 4 | p2 >> 2 & 8 | p3 >> 1 & 16)];
					data[p + 3] = this.rgb[this.view.getUint16(0xe82200 | p0 >> 3 & 2 | p1 >> 2 & 4 | p2 >> 1 & 8 | p3 & 16)];
					data[p + 4] = this.rgb[this.view.getUint16(0xe82200 | p0 >> 2 & 2 | p1 >> 1 & 4 | p2 & 8 | p3 << 1 & 16)];
					data[p + 5] = this.rgb[this.view.getUint16(0xe82200 | p0 >> 1 & 2 | p1 & 4 | p2 << 1 & 8 | p3 << 2 & 16)];
					data[p + 6] = this.rgb[this.view.getUint16(0xe82200 | p0 & 2 | p1 << 1 & 4 | p2 << 2 & 8 | p3 << 3 & 16)];
					data[p + 7] = this.rgb[this.view.getUint16(0xe82200 | p0 << 1 & 2 | p1 << 2 & 4 | p2 << 3 & 8 | p3 << 4 & 16)];
				}
		else
			for (let i = cy; i !== 0; k = 0xe00000 | k + 0x80 & 0x1fff80 | k - cx & 0x7f, p += 1024 - cx * 8, --i)
				for (let px, j = cx; j !== 0; k = k & 0xffff80 | k + 1 & 0x7f, p += 8, --j) {
					const p0 = this.ram[k], p1 = this.ram[0x20000 + k], p2 = this.ram[0x40000 + k], p3 = this.ram[0x60000 + k];
					(px = p0 >> 6 & 2 | p1 >> 5 & 4 | p2 >> 4 & 8 | p3 >> 3 & 16) && (data[p] = this.rgb[this.view.getUint16(0xe82200 | px)]);
					(px = p0 >> 5 & 2 | p1 >> 4 & 4 | p2 >> 3 & 8 | p3 >> 2 & 16) && (data[p + 1] = this.rgb[this.view.getUint16(0xe82200 | px)]);
					(px = p0 >> 4 & 2 | p1 >> 3 & 4 | p2 >> 2 & 8 | p3 >> 1 & 16) && (data[p + 2] = this.rgb[this.view.getUint16(0xe82200 | px)]);
					(px = p0 >> 3 & 2 | p1 >> 2 & 4 | p2 >> 1 & 8 | p3 & 16) && (data[p + 3] = this.rgb[this.view.getUint16(0xe82200 | px)]);
					(px = p0 >> 2 & 2 | p1 >> 1 & 4 | p2 & 8 | p3 << 1 & 16) && (data[p + 4] = this.rgb[this.view.getUint16(0xe82200 | px)]);
					(px = p0 >> 1 & 2 | p1 & 4 | p2 << 1 & 8 | p3 << 2 & 16) && (data[p + 5] = this.rgb[this.view.getUint16(0xe82200 | px)]);
					(px = p0 & 2 | p1 << 1 & 4 | p2 << 2 & 8 | p3 << 3 & 16) && (data[p + 6] = this.rgb[this.view.getUint16(0xe82200 | px)]);
					(px = p0 << 1 & 2 | p1 << 2 & 4 | p2 << 3 & 8 | p3 << 4 & 16) && (data[p + 7] = this.rgb[this.view.getUint16(0xe82200 | px)]);
				}
	}

	drawSprite(data) {
		if (~this.ram[0xe82601] & 0x40 || ~this.ram[0xeb0808] & 2)
			return;
		const convertPCG8 = (dst, src, n) => {
			for (let p = 0, q = 0, i = 0; i < n; q += 32, i++)
				for (let j = 0; j < 8; j++)
					for (let k = 0; k < 4; k++)
						dst[p++] = src[q + j * 4 + k] >> 4, dst[p++] = src[q + j * 4 + k] & 15;
		};
		~this.ram[0xeb0811] & 1 && convertPCG8(this.pcg8, this.ram.subarray(0xeb8000), 256);
		const convertPCG16 = (dst, src, n) => {
			for (let p = 0, q = 0, i = 0; i < n; q += 128, i++)
				for (let j = 0; j < 16; j++) {
					for (let k = 0; k < 4; k++)
						dst[p++] = src[q + j * 4 + k] >> 4, dst[p++] = src[q + j * 4 + k] & 15;
					for (let k = 0; k < 4; k++)
						dst[p++] = src[q + j * 4 + k + 64] >> 4, dst[p++] = src[q + j * 4 + k + 64] & 15;
				}
		};
		convertPCG16(this.pcg16, this.ram.subarray(0xeb8000), 256);
		const cx = this.cxScreen, cy = this.cyScreen;
		for (let k = 0xeb03f8; k >= 0xeb0000; k -= 8) {
			const pri = this.ram[k + 7] & 3, x = this.view.getUint16(k) & 0x3ff, y = this.view.getUint16(k + 2) & 0x3ff;
			if (pri === 1 && x > 0 && x < cx + 16 && y > 0 && y < cy + 16)
				this.xfer16x16(data, x | y << 10, k + 4);
		}
		if (~this.ram[0xeb0811] & 1 && this.ram[0xeb0809] & 8) {
			const hScroll = this.view.getUint16(0xeb0804), vScroll = this.view.getUint16(0xeb0806);
			const base = this.ram[0xeb0809] & 0x10 ? 0xebe000 : 0xebc000;
			for (let i = 0; i < 64; i++)
				for (let j = 0; j < 64; j++) {
					const x = 16 + j * 8 - hScroll & 0x1ff, y = 16 + i * 8 - vScroll & 0x1ff;
					if (x > 8 && x < cx + 16 && y > 8 && y < cy + 16)
						this.xfer8x8(data, x | y << 10, base + i * 128 + j * 2);
				}
		}
		for (let k = 0xeb03f8; k >= 0xeb0000; k -= 8) {
			const pri = this.ram[k + 7] & 3, x = this.view.getUint16(k) & 0x3ff, y = this.view.getUint16(k + 2) & 0x3ff;
			if (pri === 2 && x > 0 && x < cx + 16 && y > 0 && y < cy + 16)
				this.xfer16x16(data, x | y << 10, k + 4);
		}
		if (this.ram[0xeb0811] & 1 && this.ram[0xeb0809] & 1) {
			const hScroll = this.view.getUint16(0xeb0800), vScroll = this.view.getUint16(0xeb0802);
			const base = this.ram[0xeb0809] & 0x2 ? 0xebe000 : 0xebc000;
			for (let i = 0; i < 64; i++)
				for (let j = 0; j < 64; j++) {
					const x = 16 + j * 16 - hScroll & 0x3ff, y = 16 + i * 16 - vScroll & 0x3ff;
					if (x > 0 && x < cx + 16 && y > 0 && y < cy + 16)
						this.xfer16x16(data, x | y << 10, base + i * 128 + j * 2);
				}
		} else if (~this.ram[0xeb0811] & 1 && this.ram[0xeb0809] & 1) {
			const hScroll = this.view.getUint16(0xeb0800), vScroll = this.view.getUint16(0xeb0802);
			const base = this.ram[0xeb0809] & 0x2 ? 0xebe000 : 0xebc000;
			for (let i = 0; i < 64; i++)
				for (let j = 0; j < 64; j++) {
					const x = 16 + j * 8 - hScroll & 0x1ff, y = 16 + i * 8 - vScroll & 0x1ff;
					if (x > 8 && x < cx + 16 && y > 8 && y < cy + 16)
						this.xfer8x8(data, x | y << 10, base + i * 128 + j * 2);
				}
		}
		for (let k = 0xeb03f8; k >= 0xeb0000; k -= 8) {
			const pri = this.ram[k + 7] & 3, x = this.view.getUint16(k) & 0x3ff, y = this.view.getUint16(k + 2) & 0x3ff;
			if (pri === 3 && x > 0 && x < cx + 16 && y > 0 && y < cy + 16)
				this.xfer16x16(data, x | y << 10, k + 4);
		}
	}

	xfer8x8(data, p, k) {
		let q = this.ram[k + 1] << 6, idx = 0xe82200 | this.ram[k] << 5 & 0x1e0, px;
		switch (this.ram[k] >> 6) {
		case 0: // ノーマル
			(px = this.pcg8[q | 0x00]) && (data[p + 0x0000] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x01]) && (data[p + 0x0001] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x02]) && (data[p + 0x0002] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x03]) && (data[p + 0x0003] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x04]) && (data[p + 0x0004] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x05]) && (data[p + 0x0005] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x06]) && (data[p + 0x0006] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x07]) && (data[p + 0x0007] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x08]) && (data[p + 0x0400] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x09]) && (data[p + 0x0401] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0a]) && (data[p + 0x0402] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0b]) && (data[p + 0x0403] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0c]) && (data[p + 0x0404] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0d]) && (data[p + 0x0405] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0e]) && (data[p + 0x0406] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0f]) && (data[p + 0x0407] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x10]) && (data[p + 0x0800] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x11]) && (data[p + 0x0801] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x12]) && (data[p + 0x0802] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x13]) && (data[p + 0x0803] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x14]) && (data[p + 0x0804] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x15]) && (data[p + 0x0805] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x16]) && (data[p + 0x0806] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x17]) && (data[p + 0x0807] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x18]) && (data[p + 0x0c00] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x19]) && (data[p + 0x0c01] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1a]) && (data[p + 0x0c02] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1b]) && (data[p + 0x0c03] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1c]) && (data[p + 0x0c04] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1d]) && (data[p + 0x0c05] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1e]) && (data[p + 0x0c06] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1f]) && (data[p + 0x0c07] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x20]) && (data[p + 0x1000] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x21]) && (data[p + 0x1001] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x22]) && (data[p + 0x1002] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x23]) && (data[p + 0x1003] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x24]) && (data[p + 0x1004] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x25]) && (data[p + 0x1005] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x26]) && (data[p + 0x1006] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x27]) && (data[p + 0x1007] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x28]) && (data[p + 0x1400] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x29]) && (data[p + 0x1401] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2a]) && (data[p + 0x1402] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2b]) && (data[p + 0x1403] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2c]) && (data[p + 0x1404] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2d]) && (data[p + 0x1405] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2e]) && (data[p + 0x1406] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2f]) && (data[p + 0x1407] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x30]) && (data[p + 0x1800] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x31]) && (data[p + 0x1801] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x32]) && (data[p + 0x1802] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x33]) && (data[p + 0x1803] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x34]) && (data[p + 0x1804] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x35]) && (data[p + 0x1805] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x36]) && (data[p + 0x1806] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x37]) && (data[p + 0x1807] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x38]) && (data[p + 0x1c00] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x39]) && (data[p + 0x1c01] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x3a]) && (data[p + 0x1c02] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x3b]) && (data[p + 0x1c03] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x3c]) && (data[p + 0x1c04] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x3d]) && (data[p + 0x1c05] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x3e]) && (data[p + 0x1c06] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x3f]) && (data[p + 0x1c07] = this.rgb[this.view.getUint16(idx | px << 1)]);
			return;
		case 1: // H反転
			(px = this.pcg8[q | 0x07]) && (data[p + 0x0000] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x06]) && (data[p + 0x0001] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x05]) && (data[p + 0x0002] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x04]) && (data[p + 0x0003] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x03]) && (data[p + 0x0004] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x02]) && (data[p + 0x0005] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x01]) && (data[p + 0x0006] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x00]) && (data[p + 0x0007] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0f]) && (data[p + 0x0400] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0e]) && (data[p + 0x0401] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0d]) && (data[p + 0x0402] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0c]) && (data[p + 0x0403] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0b]) && (data[p + 0x0404] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0a]) && (data[p + 0x0405] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x09]) && (data[p + 0x0406] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x08]) && (data[p + 0x0407] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x17]) && (data[p + 0x0800] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x16]) && (data[p + 0x0801] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x15]) && (data[p + 0x0802] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x14]) && (data[p + 0x0803] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x13]) && (data[p + 0x0804] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x12]) && (data[p + 0x0805] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x11]) && (data[p + 0x0806] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x10]) && (data[p + 0x0807] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1f]) && (data[p + 0x0c00] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1e]) && (data[p + 0x0c01] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1d]) && (data[p + 0x0c02] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1c]) && (data[p + 0x0c03] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1b]) && (data[p + 0x0c04] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1a]) && (data[p + 0x0c05] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x19]) && (data[p + 0x0c06] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x18]) && (data[p + 0x0c07] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x27]) && (data[p + 0x1000] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x26]) && (data[p + 0x1001] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x25]) && (data[p + 0x1002] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x24]) && (data[p + 0x1003] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x23]) && (data[p + 0x1004] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x22]) && (data[p + 0x1005] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x21]) && (data[p + 0x1006] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x20]) && (data[p + 0x1007] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2f]) && (data[p + 0x1400] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2e]) && (data[p + 0x1401] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2d]) && (data[p + 0x1402] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2c]) && (data[p + 0x1403] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2b]) && (data[p + 0x1404] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2a]) && (data[p + 0x1405] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x29]) && (data[p + 0x1406] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x28]) && (data[p + 0x1407] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x37]) && (data[p + 0x1800] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x36]) && (data[p + 0x1801] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x35]) && (data[p + 0x1802] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x34]) && (data[p + 0x1803] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x33]) && (data[p + 0x1804] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x32]) && (data[p + 0x1805] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x31]) && (data[p + 0x1806] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x30]) && (data[p + 0x1807] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x3f]) && (data[p + 0x1c00] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x3e]) && (data[p + 0x1c01] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x3d]) && (data[p + 0x1c02] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x3c]) && (data[p + 0x1c03] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x3b]) && (data[p + 0x1c04] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x3a]) && (data[p + 0x1c05] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x39]) && (data[p + 0x1c06] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x38]) && (data[p + 0x1c07] = this.rgb[this.view.getUint16(idx | px << 1)]);
			return;
		case 2: // V反転
			(px = this.pcg8[q | 0x38]) && (data[p + 0x0000] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x39]) && (data[p + 0x0001] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x3a]) && (data[p + 0x0002] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x3b]) && (data[p + 0x0003] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x3c]) && (data[p + 0x0004] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x3d]) && (data[p + 0x0005] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x3e]) && (data[p + 0x0006] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x3f]) && (data[p + 0x0007] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x30]) && (data[p + 0x0400] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x31]) && (data[p + 0x0401] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x32]) && (data[p + 0x0402] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x33]) && (data[p + 0x0403] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x34]) && (data[p + 0x0404] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x35]) && (data[p + 0x0405] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x36]) && (data[p + 0x0406] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x37]) && (data[p + 0x0407] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x28]) && (data[p + 0x0800] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x29]) && (data[p + 0x0801] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2a]) && (data[p + 0x0802] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2b]) && (data[p + 0x0803] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2c]) && (data[p + 0x0804] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2d]) && (data[p + 0x0805] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2e]) && (data[p + 0x0806] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2f]) && (data[p + 0x0807] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x20]) && (data[p + 0x0c00] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x21]) && (data[p + 0x0c01] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x22]) && (data[p + 0x0c02] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x23]) && (data[p + 0x0c03] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x24]) && (data[p + 0x0c04] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x25]) && (data[p + 0x0c05] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x26]) && (data[p + 0x0c06] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x27]) && (data[p + 0x0c07] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x18]) && (data[p + 0x1000] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x19]) && (data[p + 0x1001] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1a]) && (data[p + 0x1002] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1b]) && (data[p + 0x1003] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1c]) && (data[p + 0x1004] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1d]) && (data[p + 0x1005] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1e]) && (data[p + 0x1006] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1f]) && (data[p + 0x1007] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x10]) && (data[p + 0x1400] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x11]) && (data[p + 0x1401] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x12]) && (data[p + 0x1402] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x13]) && (data[p + 0x1403] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x14]) && (data[p + 0x1404] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x15]) && (data[p + 0x1405] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x16]) && (data[p + 0x1406] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x17]) && (data[p + 0x1407] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x08]) && (data[p + 0x1800] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x09]) && (data[p + 0x1801] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0a]) && (data[p + 0x1802] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0b]) && (data[p + 0x1803] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0c]) && (data[p + 0x1804] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0d]) && (data[p + 0x1805] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0e]) && (data[p + 0x1806] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0f]) && (data[p + 0x1807] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x00]) && (data[p + 0x1c00] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x01]) && (data[p + 0x1c01] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x02]) && (data[p + 0x1c02] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x03]) && (data[p + 0x1c03] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x04]) && (data[p + 0x1c04] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x05]) && (data[p + 0x1c05] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x06]) && (data[p + 0x1c06] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x07]) && (data[p + 0x1c07] = this.rgb[this.view.getUint16(idx | px << 1)]);
			return;
		case 3: // HV反転
			(px = this.pcg8[q | 0x3f]) && (data[p + 0x0000] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x3e]) && (data[p + 0x0001] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x3d]) && (data[p + 0x0002] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x3c]) && (data[p + 0x0003] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x3b]) && (data[p + 0x0004] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x3a]) && (data[p + 0x0005] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x39]) && (data[p + 0x0006] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x38]) && (data[p + 0x0007] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x37]) && (data[p + 0x0400] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x36]) && (data[p + 0x0401] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x35]) && (data[p + 0x0402] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x34]) && (data[p + 0x0403] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x33]) && (data[p + 0x0404] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x32]) && (data[p + 0x0405] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x31]) && (data[p + 0x0406] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x30]) && (data[p + 0x0407] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2f]) && (data[p + 0x0800] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2e]) && (data[p + 0x0801] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2d]) && (data[p + 0x0802] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2c]) && (data[p + 0x0803] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2b]) && (data[p + 0x0804] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x2a]) && (data[p + 0x0805] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x29]) && (data[p + 0x0806] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x28]) && (data[p + 0x0807] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x27]) && (data[p + 0x0c00] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x26]) && (data[p + 0x0c01] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x25]) && (data[p + 0x0c02] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x24]) && (data[p + 0x0c03] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x23]) && (data[p + 0x0c04] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x22]) && (data[p + 0x0c05] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x21]) && (data[p + 0x0c06] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x20]) && (data[p + 0x0c07] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1f]) && (data[p + 0x1000] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1e]) && (data[p + 0x1001] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1d]) && (data[p + 0x1002] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1c]) && (data[p + 0x1003] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1b]) && (data[p + 0x1004] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x1a]) && (data[p + 0x1005] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x19]) && (data[p + 0x1006] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x18]) && (data[p + 0x1007] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x17]) && (data[p + 0x1400] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x16]) && (data[p + 0x1401] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x15]) && (data[p + 0x1402] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x14]) && (data[p + 0x1403] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x13]) && (data[p + 0x1404] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x12]) && (data[p + 0x1405] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x11]) && (data[p + 0x1406] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x10]) && (data[p + 0x1407] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0f]) && (data[p + 0x1800] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0e]) && (data[p + 0x1801] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0d]) && (data[p + 0x1802] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0c]) && (data[p + 0x1803] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0b]) && (data[p + 0x1804] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x0a]) && (data[p + 0x1805] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x09]) && (data[p + 0x1806] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x08]) && (data[p + 0x1807] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x07]) && (data[p + 0x1c00] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x06]) && (data[p + 0x1c01] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x05]) && (data[p + 0x1c02] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x04]) && (data[p + 0x1c03] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x03]) && (data[p + 0x1c04] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x02]) && (data[p + 0x1c05] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x01]) && (data[p + 0x1c06] = this.rgb[this.view.getUint16(idx | px << 1)]);
			(px = this.pcg8[q | 0x00]) && (data[p + 0x1c07] = this.rgb[this.view.getUint16(idx | px << 1)]);
			return;
		}
	}

	xfer16x16(data, p, k) {
		let q = this.ram[k + 1] << 8, idx = 0xe82200 | this.ram[k] << 5 & 0x1e0;
		switch (this.ram[k] >> 6) {
		case 0: // ノーマル
			for (let i = 16; i !== 0; p += 1024 - 16, --i)
				for (let px, j = 16; j !== 0; ++p, --j)
					(px = this.pcg16[q++]) && (data[p] = this.rgb[this.view.getUint16(idx | px << 1)]);
			return;
		case 1: // H反転
			q += 16;
			for (let i = 16; i !== 0; p += 1024 - 16, q += 32, --i)
				for (let px, j = 16; j !== 0; ++p, --j)
					(px = this.pcg16[--q]) && (data[p] = this.rgb[this.view.getUint16(idx | px << 1)]);
			return;
		case 2: // V反転
			q += 256 - 16;
			for (let i = 16; i !== 0; p += 1024 - 16, q -= 32, --i)
				for (let px, j = 16; j !== 0; ++p, --j)
					(px = this.pcg16[q++]) && (data[p] = this.rgb[this.view.getUint16(idx | px << 1)]);
			return;
		case 3: // HV反転
			q += 256;
			for (let i = 16; i !== 0; p += 1024 - 16, --i)
				for (let px, j = 16; j !== 0; ++p, --j)
					(px = this.pcg16[--q]) && (data[p] = this.rgb[this.view.getUint16(idx | px << 1)]);
			return;
		}
	}
}

function* generator(fdc, drq) {
	let command = fdc.data, us, irq = () => fdc.irq = true;
	if (command === 3) { // SPECIFY
		fdc.status |= 0x10, yield, yield, fdc.status &= ~0x10;
	} else if (command === 4) { // SENSE DEVICE STATUS
		fdc.status |= 0x10, yield, us = fdc.data, fdc.data = (FDD[us & 3] ? 1 : 0) << 5 | !fdc.c[us & 3] << 4 | us & 7, fdc.status |= 0x40, yield, fdc.status &= ~0x50;
	} else if ((command & ~0xc0) === 5) { // WRITE DATA
		let c, h, r, n, eot, length, offset, tc;
		fdc.status |= 0x10, yield, us = fdc.data & 7, yield, c = fdc.data, yield, h = fdc.data, yield, r = fdc.data, yield, n = fdc.data;
		yield, eot = fdc.data, yield, /* gsl */ yield, /* dtl */ length = 128 << n, offset = (c * 2 + h) * 8192 + (r - 1) * length;
		if (FDD[us & 3]) {
			do {
				tc = drq(), FDD[us & 3][offset] = fdc.data;
				if (!(++offset & length - 1))
					r < eot ? ++r : ~command & 0x80 ? (++c, r = 1) : (us & 4 && ++c, us ^= 4, h ^= 1, r = 1), offset = (c * 2 + h) * 8192 + (r - 1) * length;
			} while (!tc);
			offset & length - 1 && (r < eot ? ++r : ~command & 0x80 ? (++c, r = 1) : (us & 4 && ++c, h ^= 1, r = 1)), fdc.data = us, fdc.status |= 0x40, irq();
			yield, fdc.data = 0, yield, yield, fdc.data = c, yield, fdc.data = h, yield, fdc.data = r, yield, fdc.data = n, yield, fdc.status &= ~0x50;
		} else
			fdc.data = 0x48 | us, fdc.status |= 0x40, irq(), yield, fdc.data = 0, yield, yield, yield, yield, yield, yield, fdc.status &= ~0x50;
	} else if ((command & ~0xe0) === 6) { // READ DATA
		let c, h, r, n, eot, length, offset;
		fdc.status |= 0x10, yield, us = fdc.data & 7, yield, c = fdc.data, yield, h = fdc.data, yield, r = fdc.data, yield, n = fdc.data;
		yield, eot = fdc.data, yield, /* gsl */ yield, /* dtl */ length = 128 << n, offset = (c * 2 + h) * 8192 + (r - 1) * length, fdc.status |= 0x40;
		if (FDD[us & 3]) {
			do {
				fdc.data = FDD[us & 3][offset];
				if (!(++offset & length - 1))
					r < eot ? ++r : ~command & 0x80 ? (++c, r = 1) : (us & 4 && ++c, us ^= 4, h ^= 1, r = 1), offset = (c * 2 + h) * 8192 + (r - 1) * length;
			} while (!drq());
			offset & length - 1 && (r < eot ? ++r : ~command & 0x80 ? (++c, r = 1) : (us & 4 && ++c, h ^= 1, r = 1)), fdc.data = us, irq();
			yield, fdc.data = 0, yield, yield, fdc.data = c, yield, fdc.data = h, yield, fdc.data = r, yield, fdc.data = n, yield, fdc.status &= ~0x50;
		} else
			fdc.data = 0x48 | us, irq(), yield, fdc.data = 0, yield, yield, yield, yield, yield, yield, fdc.status &= ~0x50;
	} else if (command === 7) { // RECALIBRATE
		fdc.status |= 0x10, yield, us = fdc.data & 3, fdc.c[us] = 0, fdc.status = fdc.status & ~0x10 | 1 << us, irq();
	} else if (command === 8) { // SENSE INTERRUPT STATUS
		if (fdc.status & 15)
			fdc.status |= 0x50, us = 31 - Math.clz32(fdc.status & 15), fdc.data = 0x20 | us, yield, fdc.data = fdc.c[us], yield, fdc.status &= ~(0x50 | 1 << us);
		else
			fdc.status |= 0x50, fdc.data = 0x80, yield, fdc.status &= ~0x50;
	} else if ((command & ~0x40) === 10) { // READ ID
		fdc.status |= 0x10, yield, us = fdc.data & 7;
		if (FDD[us & 3]) {
			fdc.data = 0 | us, fdc.status |= 0x40, irq(), yield, fdc.data = 0, yield, yield, fdc.data = fdc.c[us & 3];
			yield, fdc.data = us >> 2, yield, fdc.data = 1, yield, fdc.data = 3, yield, fdc.status &= ~0x50;
		} else
			fdc.data = 0x48 | us, fdc.status |= 0x40, irq(), yield, fdc.data = 0, yield, yield, yield, yield, yield, yield, fdc.status &= ~0x50;
	} else if ((command & ~0x40) === 13) { // WRITE ID
		let n, sc, d, offset;
		fdc.status |= 0x10, yield, us = fdc.data & 7, yield n = fdc.data, yield, sc = fdc.data, yield, /* gpl */ yield, d = fdc.data;
		if (FDD[us & 3]) {
			for (let count = 0; !drq() && ++count < sc * 4;) {}
			offset = (fdc.c[us & 3] * 2 + (us >> 2)) * 8192, FDD[us & 3].fill(d, offset, offset + 8192);
			fdc.data = us, fdc.status |= 0x40, irq(), yield, fdc.data = 0, yield, yield, yield, yield, yield, fdc.data = n, yield, fdc.status &= ~0x50;
		} else
			fdc.data = 0x48 | us, fdc.status |= 0x40, irq(), yield, fdc.data = 0, yield, yield, yield, yield, yield, yield, fdc.status &= ~0x50;
	} else if (command === 15) { // SEEK
		fdc.status |= 0x10, yield, us = fdc.data & 3, yield, fdc.c[us] = fdc.data, fdc.status = fdc.status & ~0x10 | 1 << us, irq();
	} else if ((command & ~0xe0) === 17) { // SCAN EQUAL
		let c, h, r, n, eot, stp, length, offset, tc, sh;
		fdc.status |= 0x10, yield, us = fdc.data & 7, yield, c = fdc.data, yield, h = fdc.data, yield, r = fdc.data, yield, n = fdc.data;
		yield, eot = fdc.data, yield, /* gsl */ yield, stp = fdc.data, length = 128 << n, offset = (c * 2 + h) * 8192 + (r - 1) * length;
		if (FDD[us & 3]) {
			for (; ;) {
				for (sh = true, tc = false; !tc; ++offset)
					tc = drq(), fdc.data !== 0xff && fdc.data !== FDD[us & 3][offset] && (sh = false);
				if (sh || r === eot && (~command & 0x80 || us & 4))
					break;
				r < eot ? r += stp : command & 0x80 && (us |= 4, h ^= 1, r = stp), offset = (c * 2 + h) * 8192 + (r - 1) * length;
			}
			fdc.data = us, fdc.status |= 0x40, irq(), yield, fdc.data = 0, yield, fdc.data = sh << 3 | !sh << 2;
			yield, fdc.data = c, yield, fdc.data = h, yield, fdc.data = r, yield, fdc.data = n, yield, fdc.status &= ~0x50;
		} else
			fdc.data = 0x48 | us, fdc.status |= 0x40, irq(), yield, fdc.data = 0, yield, yield, yield, yield, yield, yield, fdc.status &= ~0x50;
	} else
		console.log(`FDC Command ($${Number(command).toString(16)})`), fdc.status |= 0x50, fdc.data = 0x80, yield, fdc.status &= ~0x50;
}

const keydown = e => {
	switch (e.code) {
	case 'Digit0':
		return void game.keyboard.fifo.push(0x0b);
	case 'Digit1':
		return void game.keyboard.fifo.push(0x02);
	case 'Digit2':
		return void game.keyboard.fifo.push(0x03);
	case 'Digit3':
		return void game.keyboard.fifo.push(0x04);
	case 'Digit4':
		return void game.keyboard.fifo.push(0x05);
	case 'Digit5':
		return void game.keyboard.fifo.push(0x06);
	case 'Digit6':
		return void game.keyboard.fifo.push(0x07);
	case 'Digit7':
		return void game.keyboard.fifo.push(0x08);
	case 'Digit8':
		return void game.keyboard.fifo.push(0x09);
	case 'Digit9':
		return void game.keyboard.fifo.push(0x0a);
	case 'KeyA':
		return void game.keyboard.fifo.push(0x1e);
	case 'KeyB':
		return void game.keyboard.fifo.push(0x2e);
	case 'KeyC':
		return void game.keyboard.fifo.push(0x2c);
	case 'KeyD':
		return void game.keyboard.fifo.push(0x20);
	case 'KeyE':
		return void game.keyboard.fifo.push(0x13);
	case 'KeyF':
		return void game.keyboard.fifo.push(0x21);
	case 'KeyG':
		return void game.keyboard.fifo.push(0x22);
	case 'KeyH':
		return void game.keyboard.fifo.push(0x23);
	case 'KeyI':
		return void game.keyboard.fifo.push(0x18);
	case 'KeyJ':
		return void game.keyboard.fifo.push(0x24);
	case 'KeyK':
		return void game.keyboard.fifo.push(0x25);
	case 'KeyL':
		return void game.keyboard.fifo.push(0x26);
	case 'KeyM':
		return void game.keyboard.fifo.push(0x30);
	case 'KeyN':
		return void game.keyboard.fifo.push(0x2f);
	case 'KeyO':
		return void game.keyboard.fifo.push(0x19);
	case 'KeyP':
		return void game.keyboard.fifo.push(0x1a);
	case 'KeyQ':
		return void game.keyboard.fifo.push(0x11);
	case 'KeyR':
		return void game.keyboard.fifo.push(0x14);
	case 'KeyS':
		return void game.keyboard.fifo.push(0x1f);
	case 'KeyT':
		return void game.keyboard.fifo.push(0x15);
	case 'KeyU':
		return void game.keyboard.fifo.push(0x17);
	case 'KeyV':
		return void game.keyboard.fifo.push(0x2d);
	case 'KeyW':
		return void game.keyboard.fifo.push(0x12);
	case 'KeyX':
		return void game.keyboard.fifo.push(0x2b);
	case 'KeyY':
		return void game.keyboard.fifo.push(0x16);
	case 'KeyZ':
		return void game.keyboard.fifo.push(0x2a);
	case 'Backquote':
		return void game.keyboard.fifo.push(0x1b);
	case 'Backslash':
		return void game.keyboard.fifo.push(0x0e);
	case 'BracketLeft':
		return void game.keyboard.fifo.push(0x1c);
	case 'BracketRight':
		return void game.keyboard.fifo.push(0x29);
	case 'Comma':
		return void game.keyboard.fifo.push(0x31);
	case 'Equal':
		return void game.keyboard.fifo.push(0x0d);
	case 'Minus':
		return void game.keyboard.fifo.push(0x0c);
	case 'Period':
		return void game.keyboard.fifo.push(0x32);
	case 'Quote':
		return void game.keyboard.fifo.push(0x28);
	case 'Semicolon':
		return void game.keyboard.fifo.push(0x27);
	case 'Slash':
		return void game.keyboard.fifo.push(0x33);
	case 'Backspace':
		return void game.keyboard.fifo.push(0x0f);
	case 'Tab':
		return void game.keyboard.fifo.push(0x10);
	case 'Enter':
		return void game.keyboard.fifo.push(0x1d);
	case 'ShiftLeft':
	case 'ShiftRight':
		return void game.keyboard.fifo.push(0x70);
	case 'ControlLeft':
	case 'ControlRight':
		return void game.keyboard.fifo.push(0x71);
	case 'AltLeft':
		return void game.keyboard.fifo.push(0x72); // OPT1
	case 'AltRight':
		return void game.keyboard.fifo.push(0x73); // OPT2
	case 'CapsLock':
		return void game.keyboard.fifo.push(0x5d);
	case 'Escape':
		return void game.keyboard.fifo.push(0x01);
	case 'Space':
		return void game.keyboard.fifo.push(0x35);
	case 'PageUp':
		return void game.keyboard.fifo.push(0x38);
	case 'PageDown':
		return void game.keyboard.fifo.push(0x39);
	case 'End':
		return void game.keyboard.fifo.push(0x3a);
	case 'Home':
		return void game.keyboard.fifo.push(0x36);
	case 'ArrowLeft':
		return void game.keyboard.fifo.push(0x3b);
	case 'ArrowUp':
		return void game.keyboard.fifo.push(0x3c);
	case 'ArrowRight':
		return void game.keyboard.fifo.push(0x3d);
	case 'ArrowDown':
		return void game.keyboard.fifo.push(0x3e);
	case 'Delete':
		return void game.keyboard.fifo.push(0x37);
	}
};

const keyup = e => {
	switch (e.code) {
	case 'Digit0':
		return void game.keyboard.fifo.push(0x80 | 0x0b);
	case 'Digit1':
		return void game.keyboard.fifo.push(0x80 | 0x02);
	case 'Digit2':
		return void game.keyboard.fifo.push(0x80 | 0x03);
	case 'Digit3':
		return void game.keyboard.fifo.push(0x80 | 0x04);
	case 'Digit4':
		return void game.keyboard.fifo.push(0x80 | 0x05);
	case 'Digit5':
		return void game.keyboard.fifo.push(0x80 | 0x06);
	case 'Digit6':
		return void game.keyboard.fifo.push(0x80 | 0x07);
	case 'Digit7':
		return void game.keyboard.fifo.push(0x80 | 0x08);
	case 'Digit8':
		return void game.keyboard.fifo.push(0x80 | 0x09);
	case 'Digit9':
		return void game.keyboard.fifo.push(0x80 | 0x0a);
	case 'KeyA':
		return void game.keyboard.fifo.push(0x80 | 0x1e);
	case 'KeyB':
		return void game.keyboard.fifo.push(0x80 | 0x2e);
	case 'KeyC':
		return void game.keyboard.fifo.push(0x80 | 0x2c);
	case 'KeyD':
		return void game.keyboard.fifo.push(0x80 | 0x20);
	case 'KeyE':
		return void game.keyboard.fifo.push(0x80 | 0x13);
	case 'KeyF':
		return void game.keyboard.fifo.push(0x80 | 0x21);
	case 'KeyG':
		return void game.keyboard.fifo.push(0x80 | 0x22);
	case 'KeyH':
		return void game.keyboard.fifo.push(0x80 | 0x23);
	case 'KeyI':
		return void game.keyboard.fifo.push(0x80 | 0x18);
	case 'KeyJ':
		return void game.keyboard.fifo.push(0x80 | 0x24);
	case 'KeyK':
		return void game.keyboard.fifo.push(0x80 | 0x25);
	case 'KeyL':
		return void game.keyboard.fifo.push(0x80 | 0x26);
	case 'KeyM':
		return void game.keyboard.fifo.push(0x80 | 0x30);
	case 'KeyN':
		return void game.keyboard.fifo.push(0x80 | 0x2f);
	case 'KeyO':
		return void game.keyboard.fifo.push(0x80 | 0x19);
	case 'KeyP':
		return void game.keyboard.fifo.push(0x80 | 0x1a);
	case 'KeyQ':
		return void game.keyboard.fifo.push(0x80 | 0x11);
	case 'KeyR':
		return void game.keyboard.fifo.push(0x80 | 0x14);
	case 'KeyS':
		return void game.keyboard.fifo.push(0x80 | 0x1f);
	case 'KeyT':
		return void game.keyboard.fifo.push(0x80 | 0x15);
	case 'KeyU':
		return void game.keyboard.fifo.push(0x80 | 0x17);
	case 'KeyV':
		return void game.keyboard.fifo.push(0x80 | 0x2d);
	case 'KeyW':
		return void game.keyboard.fifo.push(0x80 | 0x12);
	case 'KeyX':
		return void game.keyboard.fifo.push(0x80 | 0x2b);
	case 'KeyY':
		return void game.keyboard.fifo.push(0x80 | 0x16);
	case 'KeyZ':
		return void game.keyboard.fifo.push(0x80 | 0x2a);
	case 'Backquote':
		return void game.keyboard.fifo.push(0x80 | 0x1b);
	case 'Backslash':
		return void game.keyboard.fifo.push(0x80 | 0x0e);
	case 'BracketLeft':
		return void game.keyboard.fifo.push(0x80 | 0x1c);
	case 'BracketRight':
		return void game.keyboard.fifo.push(0x80 | 0x29);
	case 'Comma':
		return void game.keyboard.fifo.push(0x80 | 0x31);
	case 'Equal':
		return void game.keyboard.fifo.push(0x80 | 0x0d);
	case 'Minus':
		return void game.keyboard.fifo.push(0x80 | 0x0c);
	case 'Period':
		return void game.keyboard.fifo.push(0x80 | 0x32);
	case 'Quote':
		return void game.keyboard.fifo.push(0x80 | 0x28);
	case 'Semicolon':
		return void game.keyboard.fifo.push(0x80 | 0x27);
	case 'Slash':
		return void game.keyboard.fifo.push(0x80 | 0x33);
	case 'Backspace':
		return void game.keyboard.fifo.push(0x80 | 0x0f);
	case 'Tab':
		return void game.keyboard.fifo.push(0x80 | 0x10);
	case 'Enter':
		return void game.keyboard.fifo.push(0x80 | 0x1d);
	case 'ShiftLeft':
	case 'ShiftRight':
		return void game.keyboard.fifo.push(0x80 | 0x70);
	case 'ControlLeft':
	case 'ControlRight':
		return void game.keyboard.fifo.push(0x80 | 0x71);
	case 'AltLeft':
		return void game.keyboard.fifo.push(0x80 | 0x72); // OPT1
	case 'AltRight':
		return void game.keyboard.fifo.push(0x80 | 0x73); // OPT2
	case 'CapsLock':
		return void game.keyboard.fifo.push(0x80 | 0x5d);
	case 'Escape':
		return void game.keyboard.fifo.push(0x80 | 0x01);
	case 'Space':
		return void game.keyboard.fifo.push(0x80 | 0x35);
	case 'PageUp':
		return void game.keyboard.fifo.push(0x80 | 0x38);
	case 'PageDown':
		return void game.keyboard.fifo.push(0x80 | 0x39);
	case 'End':
		return void game.keyboard.fifo.push(0x80 | 0x3a);
	case 'Home':
		return void game.keyboard.fifo.push(0x80 | 0x36);
	case 'ArrowLeft':
		return void game.keyboard.fifo.push(0x80 | 0x3b);
	case 'ArrowUp':
		return void game.keyboard.fifo.push(0x80 | 0x3c);
	case 'ArrowRight':
		return void game.keyboard.fifo.push(0x80 | 0x3d);
	case 'ArrowDown':
		return void game.keyboard.fifo.push(0x80 | 0x3e);
	case 'Delete':
		return void game.keyboard.fifo.push(0x80 | 0x37);
	}
};

/*
 *
 *	X68000
 *
 */

const SRAM = Uint8Array.from(window.atob('\
gnc2ODAwMFcAwAAAAL///ADtAQD/////kHBuBwAQAAAAAP//AAAHAQ4ADQAAAAAA+D7/wP/+zahAIgMCAAgAAAAAAAAAAAAAAP/cAAQAAQEAAAAgAAn5AQAAAADgAOAA4ADgAAAAAAAAAAAAAAAAVg8=\
').split(''), c => c.charCodeAt(0));
let FDD = [], ROM;

read(`human302.xdf`).then(buffer => {
	FDD[0] = new Uint8Array(buffer);
}).then(() => read('x68000.zip')).then(buffer => new Zlib.Unzip(new Uint8Array(buffer))).then(zip => {
	ROM = Uint8Array.concat(...['cgrom.dat', 'iplrom.dat'].map(e => zip.decompress(e))).addBase();
	game = new X68000();
	sound = [
		new YM2151({clock: 16000000 / 4}),
		new MSM6258(),
	];
	game.touch = {x: undefined, y: undefined};
	canvas.addEventListener('mousedown', e => game.mouse.button |= e.button === 0 ? 1 : e.button === 2 ? 2 : 0);
	canvas.addEventListener('mouseup', e => game.mouse.button &= ~(e.button === 0 ? 1 : e.button === 2 ? 2 : 0));
	canvas.addEventListener('mousemove', e => {
		typeof game.touch.x === 'number' && (game.mouse.x += e.offsetX - game.touch.x, game.mouse.y += e.offsetY - game.touch.y);
		game.touch = {x: e.offsetX, y: e.offsetY}
	});
	init({game, sound, keyup, keydown});
});
