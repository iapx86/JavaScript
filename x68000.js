/*
 *
 *	X68000
 *
 */

import YM2151 from './ym2151.js';
import MSM6258 from './msm6258.js';
import MC68000 from './mc68000.js';

export default class X68000 {
	cxScreen = 768;
	cyScreen = 512;
	width = 1024;
	height = 1024;
	xOffset = 16;
	yOffset = 16;
	rotate = false;

	fReset = true;
	fSwapAB = false;
	fTurboA = false;
	fTurboB = false;

	bus_error = 0;
	ram = new Uint8Array(0xf00000).addBase();
	rom = new Uint8Array(0xe0000).addBase();
	view = new DataView(this.ram.buffer);
	fdc = {rate: 62500, frac: 0, status: 0x80, data: 0, irq: false, drq: false, tc: false, c: new Uint8Array(4), execute(rate, fn) {
		for (this.frac += this.rate; this.frac >= rate; this.frac -= rate)
			fn();
	}};
	g = generator(this.fdc);
	fdd = {control: 0, select: 0, command: [], eject: () => {}};
	scc = {a: {wr: new Uint8Array(16), rr: new Uint8Array(16)}, b: {wr: new Uint8Array(16), rr: new Uint8Array(16)}};
	keyboard = {fifo: []};
	mouse = {button: 0, x: 0, y: 0, fifo: []};

	pcg8 = new Uint8Array(0x4000);
	pcg16 = new Uint8Array(0x10000);
	text = new Uint8Array(0x100000);
	temp = new Uint8Array(0x400);
	pri = new Uint8Array(0x400);
	palette1 = new Uint16Array(0x100);
	palette2 = new Uint16Array(0x100);
	rgb = new Int32Array(0x10000).fill(0xff000000);
	bitmap = new Int32Array(this.width * this.height).fill(0xff000000);
	ready = false;
	updated = false;
	pri_h = new Uint8Array(0x40);
	pri_l = new Uint8Array(0x100);
	memmode_c = 0;
	memmode_v = 0;
	spri = 0x1200;
	gpri = 0xe4;

	cpu = new MC68000(Math.floor(40000000 / 4));
	scanline = {rate: 31500 * 138, frac: 0, h_count: 0, v_count: 0, execute(rate, fn) {
		this.h_count += Math.floor((this.frac += this.rate) / rate), this.frac %= rate, fn();
	}};
	timer_a = {reload: 0};
	timer_c = {rate: 4000000, frac: 0, prescaler: 0, count: 0, reload: 0, execute(rate, fn) {
		for (this.count += Math.floor((this.frac += this.rate) / rate), this.frac %= rate; this.prescaler && this.count >= this.prescaler; this.count -= this.prescaler)
			fn();
	}};
	timer_d = {rate: 4000000, frac: 0, prescaler: 0, count: 0, reload: 0, execute(rate, fn) {
		for (this.count += Math.floor((this.frac += this.rate) / rate), this.frac %= rate; this.prescaler && this.count >= this.prescaler; this.count -= this.prescaler)
			fn();
	}};

	constructor({swapAB} = {}) {
		swapAB !== undefined && (this.fSwapAB = swapAB);

		// CPU周りの初期化
		for (let i = 0; i < 0xf000; i++) {
			this.cpu.memorymap[i].base = this.ram.base[i];
			this.cpu.memorymap[i].write = null;
		}
		for (let i = 0; i < 0x800; i++) {
			this.cpu.memorymap[0xc000 + i].read = (addr) => { // GRAPHIC VRAM
				switch (this.memmode_c) {
				case 0: // 512x512 16色
					return this.ram[addr & 0xdfffff];
				case 1: // 512x512 256色
					return this.ram[addr & 0xc7ffff | 0x80000] << 4 | this.ram[addr & 0xc7ffff];
				case 2: case 4: // 512x512 65536色
					return addr = addr & 0xc7ffff | ~addr << 20 & 0x100000 | 1, this.ram[addr | 0x80000] << 4 | this.ram[addr];
				case 3: // 1024x1024 16色
					return this.ram[addr & 0xd003ff | addr << 9 & 0x80000 | addr >> 1 & 0x7fc00];
				}
				return 0;
			};
			this.cpu.memorymap[0xc000 + i].write = (addr, data) => { // GRAPHIC VRAM
				switch (this.memmode_c) {
				case 0: // 512x512 16色
					return void(addr & 1 && (this.ram[addr & 0xdfffff] = data & 15));
				case 1: // 512x512 256色
					return void(addr & 1 && (this.ram[addr & 0xc7ffff] = data & 15, this.ram[addr & 0xc7ffff | 0x80000] = data >> 4));
				case 2: case 4: // 512x512 65536色
					return addr = addr & 0xc7ffff | ~addr << 20 & 0x100000 | 1, this.ram[addr] = data & 15, void(this.ram[addr | 0x80000] = data >> 4);
				case 3: // 1024x1024 16色
					return void(addr & 1 && (this.ram[addr & 0xd003ff | addr << 9 & 0x80000 | addr >> 1 & 0x7fc00] = data & 15));
				}
			};
		}
		for (let i = 0; i < 0x800; i++) {
			this.cpu.memorymap[0xc800 + i].read = (addr) => { // GRAPHIC VRAM
				switch (this.memmode_c) {
				case 0: // 512x512 16色
					return this.ram[addr & 0xdfffff];
				case 1: // 512x512 256色
					return this.ram[addr & 0xc7ffff | 0x180000] << 4 | this.ram[addr & 0xc7ffff | 0x100000];
				case 3: // 1024x1024 16色
					return this.ram[addr & 0xd003ff | addr << 9 & 0x80000 | addr >> 1 & 0x7fc00];
				}
				return 0;
			};
			this.cpu.memorymap[0xc800 + i].write = (addr, data) => { // GRAPHIC VRAM
				switch (this.memmode_c) {
				case 0: // 512x512 16色
					return void(addr & 1 && (this.ram[addr & 0xdfffff] = data & 15));
				case 1: // 512x512 256色
					return void(addr & 1 && (this.ram[addr & 0xc7ffff | 0x100000] = data & 15, this.ram[addr & 0xc7ffff | 0x180000] = data >> 4));
				case 3: // 1024x1024 16色
					return void(addr & 1 && (this.ram[addr & 0xd003ff | addr << 9 & 0x80000 | addr >> 1 & 0x7fc00] = data & 15));
				}
			};
		}
		for (let i = 0; i < 0x1000; i++) {
			this.cpu.memorymap[0xd000 + i].read = (addr) => { // GRAPHIC VRAM
				switch (this.memmode_c) {
				case 0: // 512x512 16色
					return this.ram[addr & 0xdfffff];
				case 3: // 1024x1024 16色
					return this.ram[addr & 0xd003ff | addr << 9 & 0x80000 | addr >> 1 & 0x7fc00];
				}
				return 0;
			};
			this.cpu.memorymap[0xd000 + i].write = (addr, data) => { // GRAPHIC VRAM
				switch (this.memmode_c) {
				case 0: // 512x512 16色
					return void(addr & 1 && (this.ram[addr & 0xdfffff] = data & 15));
				case 3: // 1024x1024 16色
					return void(addr & 1 && (this.ram[addr & 0xd003ff | addr << 9 & 0x80000 | addr >> 1 & 0x7fc00] = data & 15));
				}
			};
		}
		for (let i = 0; i < 0x800; i++)
			this.cpu.memorymap[0xe000 + i].write = (addr, data) => { // TEXT VRAM
				const r21 = this.view.getUint16(0xe8002a), mask = r21 & 0x200 ? this.ram[0xe8002e | addr & 1] : 0;
				const sa = r21 & 0x100 ? r21 >> 4 : 1 << (addr >> 17 & 3), k = addr & 0x1ffff, p = k << 3;
				let t0 = this.ram[0xe00000 + k], t1 = this.ram[0xe20000 + k], t2 = this.ram[0xe40000 + k], t3 = this.ram[0xe60000 + k];
				sa & 1 && (t0 = t0 & mask | data & ~mask), sa & 2 && (t1 = t1 & mask | data & ~mask);
				sa & 4 && (t2 = t2 & mask | data & ~mask), sa & 8 && (t3 = t3 & mask | data & ~mask);
				this.ram[0xe00000 + k] = t0, this.ram[0xe20000 + k] = t1, this.ram[0xe40000 + k] = t2, this.ram[0xe60000 + k] = t3;
				this.text[p] = t0 >> 7 & 1 | t1 >> 6 & 2 | t2 >> 5 & 4 | t3 >> 4 & 8;
				this.text[p + 1] = t0 >> 6 & 1 | t1 >> 5 & 2 | t2 >> 4 & 4 | t3 >> 3 & 8;
				this.text[p + 2] = t0 >> 5 & 1 | t1 >> 4 & 2 | t2 >> 3 & 4 | t3 >> 2 & 8;
				this.text[p + 3] = t0 >> 4 & 1 | t1 >> 3 & 2 | t2 >> 2 & 4 | t3 >> 1 & 8;
				this.text[p + 4] = t0 >> 3 & 1 | t1 >> 2 & 2 | t2 >> 1 & 4 | t3 & 8;
				this.text[p + 5] = t0 >> 2 & 1 | t1 >> 1 & 2 | t2 & 4 | t3 << 1 & 8;
				this.text[p + 6] = t0 >> 1 & 1 | t1 & 2 | t2 << 1 & 4 | t3 << 2 & 8;
				this.text[p + 7] = t0 & 1 | t1 << 1 & 2 | t2 << 2 & 4 | t3 << 3 & 8;
			};
		this.cpu.memorymap[0xe800].write = (addr, data) => { // CRTC
			this.ram[addr &= ~0xff000000] = data, addr === 0xe80028 && (this.memmode_c = 32 - Math.clz32(data & 15));
			if ((addr & ~0xb) === 0xe80004 || addr === 0xe80029) {
				this.cxScreen = Math.max(1, (this.ram[0xe80007] - this.ram[0xe80005]) * 8);
				const r06 = this.view.getUint16(0xe8000c) & 0x3ff, r07 = this.view.getUint16(0xe8000e) & 0x3ff, r20 = this.view.getUint16(0xe80028);
				this.cyScreen = Math.max(1, Math.floor((r07 - r06) * [1, 2, 1, 1, 0.5, 1, 1, 1][r20 >> 2 & 7]));
			}
			if (addr === 0xe80001 || addr === 0xe80029)
				this.scanline.rate = (this.ram[0xe80029] & 0x10 ? 31500 : 15980) * (this.ram[0xe80001] + 1), this.scanline.frac = 0;
		};
		this.cpu.memorymap[0xe804].write = (addr, data) => { // CRTC
			if ((addr &= ~0xff000000) === 0xe80481 && data & 8 && this.ram[0xe8002c] !== this.ram[0xe8002d]) {
				let r21 = this.ram[0xe8002b], src = this.ram[0xe8002c] << 9, dst = this.ram[0xe8002d] << 9;
				src += 0xe00000, dst += 0xe00000, r21 & 1 && this.ram.copyWithin(dst, src, src + 0x200);
				src += 0x20000, dst += 0x20000, r21 & 2 && this.ram.copyWithin(dst, src, src + 0x200);
				src += 0x20000, dst += 0x20000, r21 & 4 && this.ram.copyWithin(dst, src, src + 0x200);
				src += 0x20000, dst += 0x20000, r21 & 8 && this.ram.copyWithin(dst, src, src + 0x200);
				r21 &= 15, src = this.ram[0xe8002c] << 12, dst = this.ram[0xe8002d] << 12;
				if (r21 === 15)
					this.text.copyWithin(dst, src, src + 0x1000);
				else if (r21)
					for (let i = 0; i < 0x1000; i++)
						this.text[dst + i] = this.text[dst + i] & ~r21 | this.text[src + i] & r21;
			}
			this.ram[addr] = data;
		};
		for (let i = 0; i < 2; i++)
			this.cpu.memorymap[0xe820 + i].write = (addr, data) => { // GRAPHIC PALETTE
				this.ram[addr &= ~0xff000000] = data, this.palette1[addr >> 1 & 0xff] = this.view.getUint16(addr & ~1);
			};
		for (let i = 0; i < 2; i++)
			this.cpu.memorymap[0xe822 + i].write = (addr, data) => { // TEXT PALETTE
				this.ram[addr &= ~0xff000000] = data, this.palette2[addr >> 1 & 0xff] = this.view.getUint16(addr & ~1);
			};
		this.cpu.memorymap[0xe824].write = (addr, data) => { // VIDEO CONTROL
			this.ram[addr &= ~0xff000000] = data, addr === 0xe82401 && (this.memmode_v = 32 - Math.clz32(data & 7));
		};
		this.cpu.memorymap[0xe825].write = (addr, data) => { // VIDEO CONTROL
			this.ram[addr &= ~0xff000000] = data, addr === 0xe82500 ? (this.spri = this.pri_h[data & 63] << 8) : addr === 0xe82501 && (this.gpri = this.pri_l[data]);
		};
		this.cpu.memorymap[0xe840].write = (addr, data) => { // DMAC
			const base = (addr &= ~0xff000000) & ~0x3f;
			switch (addr & ~0xc0) {
			case 0xe84000:
				return void(this.ram[addr] &= ~(data & 0xf6));
			case 0xe84007:
				data & 0x10 && this.ram[base] & 8 && (this.ram[base] = this.ram[base] & ~8 | 0x10, this.ram[base + 1] = 0x11);
				if (data & 0x80 && (this.ram[base] & 0xf8) === 0) {
					const cr = this.view.getUint32(base + 4);
					if (cr & 0x80000) {
						let btc = this.view.getUint16(base + 0x1a), bar = this.view.getUint32(base + 0x1c);
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
			switch (addr &= ~0xff000000) {
			case 0xe8802d:
				return this.ram[addr] | 0x80;
			case 0xe8802f:
				return this.ram[0xe8802b] &= ~0x80, this.ram[addr];
			default:
				return this.ram[addr];
			}
		};
		this.cpu.memorymap[0xe880].write = (addr, data) => { // MFP
			const delta = this.ram[addr &= ~0xff000000] ^ data;
			switch (addr) {
			case 0xe88007:
			case 0xe88009:
				return this.ram[addr + 4] &= data, void(this.ram[addr] = data);
			case 0xe8800b:
			case 0xe8800d:
				return void(bc[data] === 7 && (this.ram[addr] &= data));
			case 0xe8801d:
				delta & 0x70 && (this.timer_c.prescaler = [0, 4, 10, 16, 50, 64, 100, 200][data >> 4 & 7], this.timer_c.count = 0);
				delta & 7 && (this.timer_d.prescaler = [0, 4, 10, 16, 50, 64, 100, 200][data & 7], this.timer_d.count = 0);
				return void(this.ram[addr] = data);
			case 0xe8801f:
				return void(this.timer_a.reload = this.ram[addr] = data);
			case 0xe88023:
				return void(this.timer_c.reload = this.ram[addr] = data);
			case 0xe88025:
				return void(this.timer_d.reload = this.ram[addr] = data);
			case 0xe8802f:
				return;
			default:
				return void(this.ram[addr] = data);
			}
		};
		this.cpu.memorymap[0xe8a0].read = (addr) => { // RTC
			addr &= ~0xff000000;
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
			addr &= ~0xff000000;
			if (this.ram[0xe8a01b] & 1 || addr >= 0xe8a01a)
				this.ram[addr] = data;
		};
		this.cpu.memorymap[0xe8e0].write = (addr, data) => { // SYSTEM PORT
			if ((addr &= ~0xff000000) === 0xe8e001 && (data ^ this.ram[addr]) & 15)
				for (let i = 0; i < 0x10000; i++)
					this.rgb[i] = (i >> 5 & 62 | i & 1) * (data & 15) * 255 / 945	// Red
						| (i >> 10 & 62 | i & 1) * (data & 15) * 255 / 945 << 8		// Green
						| (i & 63) * (data & 15) * 255 / 945 << 16					// Blue
						| 0xff000000;												// Alpha
			this.ram[addr] = data;
		};
		this.cpu.memorymap[0xe900].read = (addr) => { // OPM
			switch (addr &= ~0xff000000) {
			case 0xe90003:
				return sound[0].status;
			default:
				return this.ram[addr];
			}
		};
		this.cpu.memorymap[0xe900].write = (addr, data) => { // OPM
			switch (addr &= ~0xff000000) {
			case 0xe90001:
				return void(sound[0].addr = data);
			case 0xe90003:
				sound[0].write(data);
				switch (sound[0].addr) {
				case 0x14:
					sound[0].irq && this.ram[0xe88001] & 8 && (this.ram[0xe8800d] |= this.ram[0xe88009] & 8);
					return void(this.ram[0xe88001] = this.ram[0xe88001] & ~8 | !sound[0].irq << 3);
				case 0x1b:
					return void(sound[1].clock = Math.floor(data & 0x80 ? 16000000 / 4 : 16000000 / 2));
				}
				return;
			default:
				return void(this.ram[addr] = data);
			}
		};
		this.cpu.memorymap[0xe920].read = (addr) => { // ADPCM
			return (addr &= ~0xff000000) === 0xe92001 ? sound[1].status() : this.ram[addr];
		};
		this.cpu.memorymap[0xe920].write = (addr, data) => { // ADPCM
			switch (addr &= ~0xff000000) {
			case 0xe92001:
				return sound[1].command(data);
			case 0xe92003:
				return sound[1].write(data);
			default:
				return void(this.ram[addr] = data);
			}
		};
		this.cpu.memorymap[0xe940].read = (addr) => { // FDC/FDD
			let data;
			switch (addr &= ~0xff000000) {
			case 0xe94001:
				return this.fdc.status;
			case 0xe94003:
				return data = this.fdc.data, this.g.next(), data;
			case 0xe94005:
				return this.ram[0xe9c001] &= ~0x40, this.ram[addr];
			default:
				return this.ram[addr];
			}
		};
		this.cpu.memorymap[0xe940].write = (addr, data) => { // FDC/FDD
			switch (addr &= ~0xff000000) {
			case 0xe94003:
				return this.fdc.data = data, void this.g.next();
			case 0xe94005:
				this.ram[addr] = FDD[31 - Math.clz32(data & 15)] ? 0x80 : 0, data & ~this.fdd.control & 0x20 && this.fdd.eject(31 - Math.clz32(data & 15));
				return void(this.fdd.control = data);
			case 0xe94007:
				return void(this.fdd.select = this.ram[addr] = data);
			default:
				return void(this.ram[addr] = data);
			}
		};
		this.cpu.memorymap[0xe960].read = (addr) => { // SASI
			return (addr &= ~0xff000000) === 0xe96003 ? this.ram[addr] | 2 : this.ram[addr];
		};
		this.cpu.memorymap[0xe980].read = (addr) => { // SCC
			let reg, data;
			switch (addr &= ~0xff000000) {
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
				return reg = this.scc.a.wr[0], this.scc.a.wr[0] = 0, reg = ((reg & 0x38) === 8 ? 8 : 0) | reg & 7, this.scc.a.rr[reg];
			case 0xe98007:
				return this.scc.a.rr[8];
			default:
				return this.ram[addr];
			}
		};
		this.cpu.memorymap[0xe980].write = (addr, data) => { // SCC
			let reg;
			switch (addr &= ~0xff000000) {
			case 0xe98001:
				reg = this.scc.b.wr[0], reg = ((reg & 0x38) === 8 ? 8 : 0) | reg & 7;
				if (reg === 5 && ~data & this.scc.b.wr[reg] & 2) {
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
			return (addr &= ~0xff000000) === 0xe9a001 || addr === 0xe9a003 ? this.ram[addr] ^ 0xff : this.ram[addr];
		};
		this.cpu.memorymap[0xe9a0].write = (addr, data) => { // PPI
			return (addr &= ~0xff000000) === 0xe9a005 ? sound[1].control(this.ram[addr] = data) : void(this.ram[addr] = data);
		};
		for (let i = 0; i < 0x120; i++) {
			this.cpu.memorymap[0xe9e0 + i].read = (addr) => { return !this.bus_error && (this.bus_error = addr | 1), 0xff; };
			this.cpu.memorymap[0xe9e0 + i].write = (addr) => { !this.bus_error && (this.bus_error = addr | 1); };
		}
		for (let i = 0; i < 0x20; i++)
			this.cpu.memorymap[0xeb80 + i].write = (addr, data) => { // SPRITE VRAM
				const addr8 = (addr &= ~0xff000000) << 1 & 0x3ffe, addr16 = addr << 1 & 0xff06 | addr << 2 & 0xf0 | addr >> 3 & 8;
				this.pcg8[addr8] = this.pcg16[addr16] = data >> 4, this.pcg8[addr8 + 1] = this.pcg16[addr16 + 1] = data & 15, this.ram[addr] = data;
			};
		for (let i = 0; i < 0x60; i++)
			this.cpu.memorymap[0xeba0 + i].write = (addr, data) => { // SPRITE VRAM
				addr &= ~0xff000000;
				const addr16 = addr << 1 & 0xff06 | addr << 2 & 0xf0 | addr >> 3 & 8;
				this.pcg16[addr16] = data >> 4, this.pcg16[addr16 + 1] = data & 15, this.ram[addr] = data;
			};
		for (let i = 0; i < 0xc00; i++)
			this.cpu.memorymap[0xf000 + i].base = this.rom.base[i];
		for (let i = 0; i < 0x200; i++)
			this.cpu.memorymap[0xfe00 + i].base = this.rom.base[0xc00 + i];

		this.cpu.check_interrupt = () => {
			if (this.ram[0xe84080] & 8)
				return this.dma(2), true;
			if (this.bus_error)
				return this.cpu.exception(2), this.cpu.a[7] -= 6, this.cpu.write32(this.bus_error, this.cpu.a[7]), this.cpu.a[7] -= 2, this.bus_error = 0, true;
			let cause = 31 - Math.clz32(this.ram[0xe8800b] << 8 & this.ram[0xe88013] << 8 | this.ram[0xe8800d] & this.ram[0xe88015]);
			if (cause >= 0 && this.cpu.interrupt(6, this.ram[0xe88017] & ~15 | cause))
				return cause >= 8 ? (this.ram[0xe8800b] &= ~(1 << cause - 8)) : (this.ram[0xe8800d] &= ~(1 << cause)), true;
			if (this.scc.a.rr[3] & 4 && this.cpu.interrupt(5, this.scc.a.wr[2] & ~0xe | 4))
				return this.scc.a.rr[3] &= ~4, true;
			if (this.ram[0xe84080] & 0xe0 && this.ram[0xe84087] & 8 && this.cpu.interrupt(3, this.ram[0xe840a5]))
				return true;
			if (this.ram[0xe840c0] & 0xe0 && this.ram[0xe840c7] & 8 && this.cpu.interrupt(3, this.ram[0xe840e5]))
				return true;
			if (this.fdc.irq && this.ram[0xe9c001] & 4 && this.cpu.interrupt(1, this.ram[0xe9c003] & ~3))
				return this.fdc.irq = false, true;
			return (this.ram[0xe9c001] & 0x42) === 0x42 && this.cpu.interrupt(1, this.ram[0xe9c003] & ~3 | 1);
		};

		// Videoの初期化
		const buf = [];
		for (let i = 0; i < 64; i++) {
			for (let n = 0, j = 0; j < 3; j++)
				for (let k = 0; k < 3; k++)
					[0, 1, 2, 2][i >> [2, 4, 0][k] & 3] === j && (buf[k] = n++);
			this.pri_h[i] = buf[1] << 4 | buf[0] << 2 | buf[2];
		}
		for (let i = 0; i < 256; i++) {
			for (let n = 0, j = 0; j < 4; j++)
				for (let k = 0; k < 4; k++)
					(i >> k * 2 & 3) === j && (buf[k] = n++);
			this.pri_l[i] = buf[3] << 6 | buf[2] << 4 | buf[1] << 2 | buf[0];
		}
	}

	dma(ch) {
		const base = 0xe84000 | ch << 6;
		if (~this.ram[base] & 8)
			return;
		const cr = this.view.getUint32(base + 4);
		let mtc = this.view.getUint16(base + 0xa), mar = this.view.getUint32(base + 0xc), dar = this.view.getUint32(base + 0x14);
		--mtc, ch === 0 && (this.fdc.tc = !mtc);
		switch (cr >> 20 & 3) {
		case 2:
			this.cpu.cycle -= 4, cr & 0x800000 ? this.cpu.write16(this.cpu.read16(dar), mar) : this.cpu.write16(this.cpu.read16(mar), dar);
			cr & 0x100 && (dar += 2), cr & 0x200 && (dar -= 2), cr & 0x400 && (mar += 2), cr & 0x800 && (mar -= 2); // fallthrough
		case 1:
			this.cpu.cycle -= 4, cr & 0x800000 ? this.cpu.write16(this.cpu.read16(dar), mar) : this.cpu.write16(this.cpu.read16(mar), dar);
			cr & 0x100 && (dar += 2), cr & 0x200 && (dar -= 2), cr & 0x400 && (mar += 2), cr & 0x800 && (mar -= 2);
			break;
		case 0: case 3:
			this.cpu.cycle -= 4, cr & 0x800000 ? this.cpu.write8(this.cpu.read8(dar), mar) : this.cpu.write8(this.cpu.read8(mar), dar);
			cr & 0x100 && ++dar, cr & 0x200 && --dar, cr & 0x400 && ++mar, cr & 0x800 && --mar;
			break;
		}
		if (!mtc) {
			if ((cr & 0xc0000) === 0x80000) {
				let btc = this.view.getUint16(base + 0x1a), bar = this.view.getUint32(base + 0x1c);
				if (btc)
					mar = this.view.getUint32(bar), mtc = this.view.getUint16(bar + 4), this.view.setUint16(base + 0x1a, btc - 1), this.view.setUint32(base + 0x1c, bar + 6);
				else
					this.ram[base] = this.ram[base] & ~8 | 0x80;
			} else if ((cr & 0xc0000) === 0xc0000) {
				let bar = this.view.getUint32(base + 0x1c);
				if (bar)
					mar = this.view.getUint32(bar), mtc = this.view.getUint16(bar + 4), this.view.setUint32(base + 0x1c, this.view.getUint32(bar + 6));
				else
					this.ram[base] = this.ram[base] & ~8 | 0x80;
			} else if (cr & 0x40)
				mtc = this.view.getUint16(base + 0x1a), mar = this.view.getUint32(base + 0x1c), this.ram[base] |= 0x40;
			else
				this.ram[base] = this.ram[base] & ~8 | 0x80;
		}
		this.view.setUint16(base + 0xa, mtc), this.view.setUint32(base + 0xc, mar), this.view.setUint32(base + 0x14, dar);
	}

	execute(audio, length) {
		const tick_rate = 192000, tick_max = Math.ceil(((length - audio.samples.length) * tick_rate - audio.frac) / audio.rate);
		const update = () => { this.makeBitmap(true), this.updateStatus(), this.updateInput(); };
		!this.ready && (this.ready = new Uint16Array(this.ram.buffer, 0xe80000, 9).every(e => e));
		for (let i = 0; !this.updated && i < tick_max; i++) {
			this.cpu.execute(tick_rate);
			this.scanline.execute(tick_rate, () => {
				const r00 = this.ram[0xe80001], r01 = this.ram[0xe80003], r04 = this.view.getUint16(0xe80008) & 0x3ff, r06 = this.view.getUint16(0xe8000c) & 0x3ff;
				const r07 = this.view.getUint16(0xe8000e) & 0x3ff, r09 = this.view.getUint16(0xe80012) & 0x3ff, r20 = this.view.getUint16(0xe80028);
				const aer = this.ram[0xe88003], iera = this.ram[0xe88007], ierb = this.ram[0xe88009], tacr = this.ram[0xe88019];
				const timer_a_tick = () => tacr & 8 && !--this.ram[0xe8801f] && (this.ram[0xe8801f] = this.timer_a.reload, this.ram[0xe8800b] |= iera & 0x20);
				for (; this.scanline.h_count > r00; this.scanline.h_count -= r00 + 1) {
					this.ram[0xe8800b] |= iera & 0x80;
					++this.scanline.v_count > r04 && (this.scanline.v_count = 0, this.ready && update());
					const v_count = this.scanline.v_count, cirq = v_count === r09, vdisp = v_count > r06 && v_count <= r07 || r07 >= r04 && v_count < r07 - r04;
					this.ram[0xe88001] = this.ram[0xe88001] & ~0x50 | !cirq << 6 | vdisp << 4, ~aer & 0x40 && cirq && (this.ram[0xe8800b] |= iera & 0x40);
					if (aer & 0x10 ? v_count === r06 + 1 : r07 >= r04 ? v_count === r07 - r04 : v_count === r07 + 1)
						this.ram[0xe8800d] |= ierb & 0x40, timer_a_tick();
					v_count === r06 + 1 && this.ram[0xe80481] & 2 && (this.fastClear(), this.ram[0xe80481] &= ~2);
					if (vdisp && this.ready) {
						const y = v_count - r06 + (v_count > r06 ? -1 : r04), mode = r20 >> 2 & 7;
						mode === 1 ? (this.drawLine(y << 1), this.drawLine(y << 1 | 1)) : mode !== 4 ? this.drawLine(y) : y & 1 && this.drawLine(y >> 1);
					}
				}
				this.ram[0xe88001] = this.ram[0xe88001] & ~0x80 | (this.scanline.h_count > r01) << 7;
			});
			this.timer_c.execute(tick_rate, () => {
				!--this.ram[0xe88023] && (this.ram[0xe88023] = this.timer_c.reload, this.ram[0xe8800d] |= this.ram[0xe88009] & 0x20);
			});
			this.timer_d.execute(tick_rate, () => {
				!--this.ram[0xe88025] && (this.ram[0xe88025] = this.timer_d.reload, this.ram[0xe8800d] |= this.ram[0xe88009] & 0x10);
			});
			this.fdc.execute(tick_rate, () => this.fdc.drq && (this.fdc.drq = false, this.dma(0)));
			sound[0].execute(tick_rate) && this.ram[0xe88001] & 8 && (this.ram[0xe88001] &= ~8, this.ram[0xe8800d] |= this.ram[0xe88009] & 8);
			sound[1].execute(tick_rate, () => this.dma(3));
			audio.execute(tick_rate);
		}
	}

	reset() {
		this.fReset = true;
	}

	updateStatus() {
		// リセット処理
		if (this.fReset) {
			this.fReset = false;
			this.ready = false;
			this.ram.fill(0).set(SRAM, 0xed0000);
			this.view.setUint32(0xbffffc, 0xffce14);
			this.scc.a.wr.fill(0), this.scc.a.rr.fill(0), this.scc.b.wr.fill(0), this.scc.b.rr.fill(0);
			this.scc.a.rr[0] = this.scc.b.rr[0] = 4, this.scc.a.rr[1] = this.scc.b.rr[1] = 1;
			this.keyboard.fifo.splice(0), this.mouse.fifo.splice(0);
			this.cpu.memorymap[0].base = this.rom.base[0xd00];
			this.cpu.reset();
			this.cpu.memorymap[0].base = this.ram.base[0];
			sound[0].reg.fill(0);
		}
		if (this.fdd.command.length) {
			const command = this.fdd.command.shift();
			if ('disk' in command)
				FDD[command.unit] = command.disk;
			else
				delete FDD[command.unit];
			this.ram[0xe9c001] |= 0x40;
		}
		return this;
	}

	updateInput() {
		if (this.keyboard.fifo.length && (this.ram[0xe8802b] & 0x81) === 1)
			this.ram[0xe8802f] = this.keyboard.fifo.shift(), this.ram[0xe8802b] |= 0x80, this.ram[0xe8800b] |= this.ram[0xe88007] & 0x10;
		this.fTurboA && (this.ram[0xe9a001] ^= 1 << (this.fSwapAB ? 6 : 5));
		this.fTurboB && (this.ram[0xe9a001] ^= 1 << (this.fSwapAB ? 5 : 6));
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

	up2(fDown) {
		this.ram[0xe9a003] = this.ram[0xe9a003] & ~(1 << 0) | fDown << 0;
	}

	right2(fDown) {
		this.ram[0xe9a003] = this.ram[0xe9a003] & ~(1 << 3) | fDown << 3;
	}

	down2(fDown) {
		this.ram[0xe9a003] = this.ram[0xe9a003] & ~(1 << 1) | fDown << 1;
	}

	left2(fDown) {
		this.ram[0xe9a003] = this.ram[0xe9a003] & ~(1 << 2) | fDown << 2;
	}

	triggerA(fDown) {
		this.fSwapAB ? (this.ram[0xe9a001] = this.ram[0xe9a001] & ~(1 << 6) | fDown << 6) : (this.ram[0xe9a001] = this.ram[0xe9a001] & ~(1 << 5) | fDown << 5);
	}

	triggerB(fDown) {
		this.fSwapAB ? (this.ram[0xe9a001] = this.ram[0xe9a001] & ~(1 << 5) | fDown << 5) : (this.ram[0xe9a001] = this.ram[0xe9a001] & ~(1 << 6) | fDown << 6);
	}

	triggerX(fDown) {
		!(this.fTurboA = fDown) && (this.ram[0xe9a001] &= ~(1 << (this.fSwapAB ? 6 : 5)));
	}

	triggerY(fDown) {
		!(this.fTurboB = fDown) && (this.ram[0xe9a001] &= ~(1 << (this.fSwapAB ? 5 : 6)));
	}

	triggerL1(fDown) {
		this.ram[0xe9a003] = this.ram[0xe9a003] & ~(1 << 5) | fDown << 5;
	}

	triggerR1(fDown) {
		this.ram[0xe9a003] = this.ram[0xe9a003] & ~(1 << 6) | fDown << 6;
	}

	makeBitmap(flag) {
		return this.updated = flag, this.bitmap;
	}

	drawLine(y) {
		const cx = this.cxScreen, p = 1024 * (16 + y) + 16;
		this.bitmap.fill(0, p, p + cx);
		for (let r1 = this.spri, s = r1 >> 12 & 3, t = r1 >> 10 & 3, g = r1 >> 8 & 3, pri = 2; pri >= 0; --pri)
			pri === g ? this.drawGraphic(this.bitmap, y) : pri === s ? this.drawSprite(this.bitmap, y) : pri === t && this.drawText(this.bitmap, y);
		(this.ram[0xe82600] & 0x5c) === 0x14 && this.spri & 0x300 && this.specialPriority(this.bitmap, y);
		for (let i = 0; i < cx; ++i)
			this.bitmap[p + i] = this.rgb[this.bitmap[p + i]];
	}

	drawGraphic(data, y) {
		const half = (a, b) => (a & 0xf800) + (b & 0xf800) >> 1 & 0xf800 | (a & 0x7c0) + (b & 0x7c0) >> 1 & 0x7c0 | (a & 0x3e) + (b & 0x3e) >> 1 & 0x3e | b & 1;
		const cx = this.cxScreen, r1 = this.gpri, r2 = this.view.getUint16(0xe82600);
		if (this.memmode_v < 3) {
			const sc = new Uint8Array(4), sx = new Uint16Array(4), sy = new Uint16Array(4);
			for (let i = 0; i < 4; i++)
				sc[i] = r1 >> i * 2 & 3, sx[i] = this.view.getUint16(0xe80018 + sc[i] * 4) << 1, sy[i] = this.view.getUint16(0xe8001a + sc[i] * 4);
			const k = 0xc00001 | sc[0] << 19 | y + sy[0] << 10 & 0x7fc00, l = 0xc00001 | sc[1] << 19 | y + sy[1] << 10 & 0x7fc00;
			const m = 0xc00001 | sc[2] << 19 | y + sy[2] << 10 & 0x7fc00, n = 0xc00001 | sc[3] << 19 | y + sy[3] << 10 & 0x7fc00;
			switch (this.memmode_v) {
			case 0: // 512x512 16色
				if (r2 & 15) {
					const temp = new Uint8Array(1024);
					if (r2 & 8)
						for (let px, p = 16, x = 0; x < cx << 1; ++p, x += 2)
							(px = this.ram[n | x + sx[3] & 0x3fe]) && (temp[p] = px);
					if (r2 & 4)
						for (let px, p = 16, x = 0; x < cx << 1; ++p, x += 2)
							(px = this.ram[m | x + sx[2] & 0x3fe]) && (temp[p] = px);
					if (r2 & 2)
						for (let px, p = 16, x = 0; x < cx << 1; ++p, x += 2)
							(px = this.ram[l | x + sx[1] & 0x3fe]) && (temp[p] = px);
					if (r2 & 1) {
						if ((r2 & 0x5400) === 0x1400) // 特殊プライオリティ/半透明
							for (let px, p = 16, x = 0; x < cx << 1; ++p, x += 2)
								(px = this.ram[k | x + sx[0] & 0x3fe] & 14) && (temp[p] = px);
						else
							for (let px, p = 16, x = 0; x < cx << 1; ++p, x += 2)
								(px = this.ram[k | x + sx[0] & 0x3fe]) && (temp[p] = px);
					}
					if ((r2 & 0x4400) === 0x4400) // 半透明
						for (let p = 1024 * (y + 16) + 16, q = 16, x = 0; x < cx; ++p, ++x)
							data[p] = half(this.palette1[temp[q++]], this.palette2[0]);
					else
						for (let px, p = 1024 * (y + 16) + 16, q = 16, x = 0; x < cx; ++p, ++x)
							(px = this.palette1[temp[q++]]) && (data[p] = px);
				}
				if ((r2 & 0x5c00) === 0x1c00 && r2 & 1) // 半透明
					for (let px, sel, p = 1024 * (y + 16) + 16, x = 0; x < cx << 1; ++p, x += 2) {
						px = this.ram[k | x + sx[0] & 0x3fe], sel = px & 1, px = this.palette1[px & 14];
						sel && r2 & 0x200 && (px = half(px, this.palette1[this.ram[l | x + sx[1] & 0x3fe]]));
						sel && (r2 & 0x100 && (px = half(px, this.palette2[this.temp[x + 32 >> 1]])), data[p] = px);
					}
				return;
			case 1: // 512x512 256色
				if (r2 & 15) {
					const temp = new Uint8Array(1024);
					if (r2 & 12)
						for (let px, p = 16, x = 0; x < cx << 1; ++p, x += 2)
							(px = this.ram[n | x + sx[3] & 0x3fe] << 4 | this.ram[m | x + sx[2] & 0x3fe]) && (temp[p] = px);
					if (r2 & 3) {
						if ((r2 & 0x5400) === 0x1400 && r2 & 3) // 特殊プライオリティ/半透明
							for (let px, p = 16, x = 0; x < cx << 1; ++p, x += 2)
								(px = this.ram[l | x + sx[1] & 0x3fe] << 4 | this.ram[k | x + sx[0] & 0x3fe] & 14) && (temp[p] = px);
						else
							for (let px, p = 16, x = 0; x < cx << 1; ++p, x += 2)
								(px = this.ram[l | x + sx[1] & 0x3fe] << 4 | this.ram[k | x + sx[0] & 0x3fe]) && (temp[p] = px);
					}
					if ((r2 & 0x4400) === 0x4400) // 半透明
						for (let p = 1024 * (y + 16) + 16, q = 16, x = 0; x < cx; ++p, ++x)
							data[p] = half(this.palette1[temp[q++]], this.palette2[0]);
					else
						for (let px, p = 1024 * (y + 16) + 16, q = 16, x = 0; x < cx; ++p, ++x)
							(px = this.palette1[temp[q++]]) && (data[p] = px);
				}
				if ((r2 & 0x5c00) === 0x1c00 && r2 & 3) // 半透明
					for (let px, sel, p = 1024 * (y + 16) + 16, x = 0; x < cx << 1; ++p, x += 2) {
						px = this.ram[l | x + sx[1] & 0x3fe] << 4 | this.ram[k | x + sx[0] & 0x3fe], sel = px & 1, px = this.palette1[px & 254];
						sel && r2 & 0x200 && (px = half(px, this.palette1[this.ram[n | x + sx[3] & 0x3fe] << 4 | this.ram[m | x + sx[2] & 0x3fe]]));
						sel && (r2 & 0x100 && (px = half(px, this.palette2[this.temp[x + 32 >> 1]])), data[p] = px);
					}
				return;
			case 2: // 512x512 65536色
				if (!(r2 & 15))
					return;
				if ((r2 & 0x5c00) === 0x1400) // 特殊プライオリティ
					for (let px0, px1, px, p = 1024 * (y + 16) + 16, x = 0; x < cx << 1; ++p, x += 2) {
						px0 = this.ram[n | x + sx[3] & 0x3fe] << 4 | this.ram[m | x + sx[2] & 0x3fe];
						px1 = this.ram[l | x + sx[1] & 0x3fe] << 4 | this.ram[k | x + sx[0] & 0x3fe];
						(px = this.ram[0xe82002 | px0 << 1 & 0x1fc | px0 & 1] << 8 | this.ram[0xe82000 | px1 << 1 & 0x1fc]) && (data[p] = px);
					}
				else if ((r2 & 0x5c00) === 0x1c00) // 半透明
					for (let px0, px1, px, sel, p = 1024 * (y + 16) + 16, x = 0; x < cx << 1; ++p, x += 2) {
						px0 = this.ram[n | x + sx[3] & 0x3fe] << 4 | this.ram[m | x + sx[2] & 0x3fe];
						px1 = this.ram[l | x + sx[1] & 0x3fe] << 4 | this.ram[k | x + sx[0] & 0x3fe];
						sel = px1 & 1, px = this.ram[0xe82002 | px0 << 1 & 0x1fc | px0 & 1] << 8 | this.ram[0xe82000 | px1 << 1 & 0x1fc];
						sel && r2 & 0x100 && (px = half(px, this.palette2[this.temp[x + 32 >> 1]])), (sel || px) && (data[p] = px);
					}
				else if ((r2 & 0x4400) === 0x4400) // 半透明
					for (let px0, px1, p = 1024 * (y + 16) + 16, x = 0; x < cx << 1; ++p, x += 2) {
						px0 = this.ram[n | x + sx[3] & 0x3fe] << 4 | this.ram[m | x + sx[2] & 0x3fe];
						px1 = this.ram[l | x + sx[1] & 0x3fe] << 4 | this.ram[k | x + sx[0] & 0x3fe];
						data[p] = half(this.ram[0xe82002 | px0 << 1 & 0x1fc | px0 & 1] << 8 | this.ram[0xe82000 | px1 << 1 & 0x1fc | px1 & 1], this.palette2[0]);
					}
				else
					for (let px0, px1, px, p = 1024 * (y + 16) + 16, x = 0; x < cx << 1; ++p, x += 2) {
						px0 = this.ram[n | x + sx[3] & 0x3fe] << 4 | this.ram[m | x + sx[2] & 0x3fe];
						px1 = this.ram[l | x + sx[1] & 0x3fe] << 4 | this.ram[k | x + sx[0] & 0x3fe];
						(px = this.ram[0xe82002 | px0 << 1 & 0x1fc | px0 & 1] << 8 | this.ram[0xe82000 | px1 << 1 & 0x1fc | px1 & 1]) && (data[p] = px);
					}
				return;
			}
		} else if (r2 & 16) { // 1024x1024 16色
			const sx = this.view.getUint16(0xe80018) << 1, sy = this.view.getUint16(0xe8001a), k = 0xc00001 | y + sy << 10 & 0x7fc00;
			const sc = [r1 << (y + sy & 0x200 ? 15 : 19) & 0x180000, r1 << (y + sy & 0x200 ? 13 : 17) & 0x180000];
			if ((r2 & 0x5c00) === 0x1400) // 特殊プライオリティ
				for (let px, p = 1024 * (y + 16) + 16, x = 0; x < cx << 1; ++p, x += 2)
					(px = this.palette1[this.ram[k | sc[x + sx >> 10 & 1] | x + sx & 0x3fe] & 14]) && (data[p] = px);
			else if ((r2 & 0x5c00) === 0x1c00) // 半透明
				for (let px, sel, p = 1024 * (y + 16) + 16, x = 0; x < cx << 1; ++p, x += 2) {
					px = this.ram[k | sc[x + sx >> 10 & 1] | x + sx & 0x3fe], sel = px & 1, px = this.palette1[px & 14];
					sel && r2 & 0x100 && (px = half(px, this.palette2[this.temp[x + 32 >> 1]])), (sel || px) && (data[p] = px);
				}
			else if ((r2 & 0x4400) === 0x4400) // 半透明
				for (let p = 1024 * (y + 16) + 16, x = 0; x < cx << 1; ++p, x += 2)
					data[p] = half(this.palette1[this.ram[k | sc[x + sx >> 10 & 1] | x + sx & 0x3fe]], this.palette2[0]);
			else
				for (let px, p = 1024 * (y + 16) + 16, x = 0; x < cx << 1; ++p, x += 2)
					(px = this.palette1[this.ram[k | sc[x + sx >> 10 & 1] | x + sx & 0x3fe]]) && (data[p] = px);
		}
	}

	specialPriority(data, y) {
		const cx = this.cxScreen, r1 = this.gpri, r2 = this.view.getUint16(0xe82600);
		if (this.memmode_v < 3) {
			const sc = [], sx = [], sy = [];
			for (let i = 0; i < 4; i++)
				sc[i] = r1 >> i * 2 & 3, sx[i] = this.view.getUint16(0xe80018 + sc[i] * 4) << 1, sy[i] = this.view.getUint16(0xe8001a + sc[i] * 4);
			const k = 0xc00001 | sc[0] << 19 | y + sy[0] << 10 & 0x7fc00, l = 0xc00001 | sc[1] << 19 | y + sy[1] << 10 & 0x7fc00;
			const m = 0xc00001 | sc[2] << 19 | y + sy[2] << 10 & 0x7fc00, n = 0xc00001 | sc[3] << 19 | y + sy[3] << 10 & 0x7fc00;
			switch (this.memmode_v) {
			case 0: // 512x512 16色
				if (r2 & 1)
					for (let px, p = 1024 * (y + 16) + 16, x = 0; x < cx << 1; ++p, x += 2)
						(px = this.ram[k | x + sx[0] & 0x3fe]) & 1 && (px &= 14) && (data[p] = this.palette1[px]);
				return;
			case 1: // 512x512 256色
				if (r2 & 3)
					for (let px, p = 1024 * (y + 16) + 16, x = 0; x < cx << 1; ++p, x += 2)
						(px = this.ram[l | x + sx[1] & 0x3fe] << 4 | this.ram[k | x + sx[0] & 0x3fe]) & 1 && (px &= 254) && (data[p] = this.palette1[px]);
				return;
			case 2: // 512x512 65536色
				if (r2 & 15)
					for (let px0, px1, p = 1024 * (y + 16) + 16, x = 0; x < cx << 1; ++p, x += 2) {
						px0 = this.ram[n | x + sx[3] & 0x3fe] << 4 | this.ram[m | x + sx[2] & 0x3fe];
						px1 = this.ram[l | x + sx[2] & 0x3fe] << 4 | this.ram[k | x + sx[0] & 0x3fe];
						px1 & 1 && ((px1 &= 254) | px0) && (data[p] = this.ram[0xe82002 | px0 << 1 & 0x1fc | px0 & 1] << 8 | this.ram[0xe82000 | px1 << 1]);
					}
				return;
			}
		} else if (r2 & 16) { // 1024x1024 16色
			const sx = this.view.getUint16(0xe80018) << 1, sy = this.view.getUint16(0xe8001a), k = 0xc00001 | y + sy << 10 & 0x7fc00;
			const sc = [r1 << (y + sy & 0x200 ? 15 : 19) & 0x180000, r1 << (y + sy & 0x200 ? 13 : 17) & 0x180000];
			for (let px, p = 1024 * (y + 16) + 16, x = 0; x < cx << 1; ++p, x += 2)
				(px = this.ram[k | sc[x + sx >> 10 & 1] | x + sx & 0x3fe]) & 1 && (px &= 14) && (data[p] = this.palette1[px]);
		}
	}

	fastClear() {
		const cy = this.cyScreen, r21 = this.view.getUint16(0xe8002a);
		const sy = [this.view.getUint16(0xe8001a), this.view.getUint16(0xe8001e), this.view.getUint16(0xe80022), this.view.getUint16(0xe80026)];
		switch (this.memmode_c) {
		default: // 512x512
			if (r21 & 1)
				for (let k, y = 0; y < cy; ++y)
					k = 0xc00000 | y + sy[0] << 10 & 0x7fc00, this.ram.fill(0, k, k + 0x400);
			if (r21 & 2)
				for (let k, y = 0; y < cy; ++y)
					k = 0xc80000 | y + sy[1] << 10 & 0x7fc00, this.ram.fill(0, k, k + 0x400);
			if (r21 & 4)
				for (let k, y = 0; y < cy; ++y)
					k = 0xd00000 | y + sy[2] << 10 & 0x7fc00, this.ram.fill(0, k, k + 0x400);
			if (r21 & 8)
				for (let k, y = 0; y < cy; ++y)
					k = 0xd80000 | y + sy[3] << 10 & 0x7fc00, this.ram.fill(0, k, k + 0x400);
			return;
		case 3: // 1024x1024 16色
			for (let k, y = 0; y < cy; ++y)
				k = 0xc00000 | y + sy[0] << 11 & 0x100000 | y + sy[0] << 10 & 0x7fc00, this.ram.fill(0, k, k + 0x400), this.ram.fill(0, k + 0x80000, k + 0x80400);
			return;
		}
	}

	drawText(data, y) {
		const cx = this.cxScreen, r1 = this.spri, r2 = this.view.getUint16(0xe82600), diff = (r1 >> 12 & 3) - (r1 >> 10 & 3);
		const sx = this.view.getUint16(0xe80014), sy = this.view.getUint16(0xe80016);
		if (~r2 & 0x20)
			return;
		if (diff === 1 && r2 & 0x40 && this.ram[0xeb0808] & 2)
			for (let px, p = 16, q = y + sy << 10 & 0xffc00, x = 0; x < cx; ++p, ++x)
				(px = this.text[q | x + sx & 0x3ff]) && (this.temp[p] = px);
		else
			for (let p = 16, q = y + sy << 10 & 0xffc00, x = 0; x < cx; ++p, ++x)
				this.temp[p] = this.text[q | x + sx & 0x3ff];
		if (diff !== -1 || ~r2 & 0x40 || ~this.ram[0xeb0808] & 2)
			for (let px, p = 1024 * (y + 16) + 16, q = 16, x = 0; x < cx; ++p, ++x)
				(px = this.palette2[this.temp[q++]]) && (data[p] = px);
	}

	drawSprite(data, y) {
		const cx = this.cxScreen, r1 = this.spri, r2 = this.view.getUint16(0xe82600), diff = (r1 >> 12 & 3) - (r1 >> 10 & 3);
		if (~r2 & 0x40 || ~this.ram[0xeb0808] & 2)
			return;
		(this.ram[0xe80029] ^ this.ram[0xeb0811]) & 4 && (this.ram[0xeb0811] & 4 ? (y <<= 1) : (y >>= 1));
		if (diff !== -1 || ~r2 & 0x20)
			this.temp.fill(0, 16, 16 + cx);
		this.pri.fill(0xff);
		const spr = [];
		for (let n = 0; n < 128; n++) {
			const sx = this.view.getUint16(0xeb0000 | n << 3) & 0x3ff, sy = this.view.getUint16(0xeb0002 | n << 3) & 0x3ff, prw = this.ram[0xeb0007 | n << 3] & 3;
			if (prw && sx > 0 && sx < cx + 16 && sy > y && sy <= y + 16 && (spr.push({n, x: sx, y: sy, prw}) >= 32))
				break;
		}
		for (let i = spr.length - 1; i >= 0; --i)
			spr[i].prw === 1 && this.xfer16sp(spr[i].x, 0xeb0004 | spr[i].n << 3, y + 16 - spr[i].y, spr[i].n);
		if (~this.ram[0xeb0811] & 1 && this.ram[0xeb0809] & 8) {
			const hs = this.view.getUint16(0xeb0804), vs = this.view.getUint16(0xeb0806), base = this.ram[0xeb0809] & 0x10 ? 0xebe000 : 0xebc000;
			for (let i = y + vs >> 3 & 63, j = 0; j < 64; j++) {
				const x = 16 + j * 8 - hs & 0x1ff;
				x > 8 && x < cx + 16 && this.xfer8(x, base + i * 128 + j * 2, y + vs & 7, diff >= 0);
			}
		}
		for (let i = spr.length - 1; i >= 0; --i)
			spr[i].prw === 2 && this.xfer16sp(spr[i].x, 0xeb0004 | spr[i].n << 3, y + 16 - spr[i].y, spr[i].n);
		if (this.ram[0xeb0811] & 1 && this.ram[0xeb0809] & 1) {
			const hs = this.view.getUint16(0xeb0800), vs = this.view.getUint16(0xeb0802), base = this.ram[0xeb0809] & 0x2 ? 0xebe000 : 0xebc000;
			for (let i = y + vs >> 4 & 63, j = 0; j < 64; j++) {
				const x = 16 + j * 16 - hs & 0x3ff;
				x > 0 && x < cx + 16 && this.xfer16(x, base + i * 128 + j * 2, y + vs & 15, diff >= 0);
			}
		} else if (~this.ram[0xeb0811] & 1 && this.ram[0xeb0809] & 1) {
			const hs = this.view.getUint16(0xeb0800), vs = this.view.getUint16(0xeb0802), base = this.ram[0xeb0809] & 0x2 ? 0xebe000 : 0xebc000;
			for (let i = y + vs >> 3 & 63, j = 0; j < 64; j++) {
				const x = 16 + j * 8 - hs & 0x1ff;
				x > 8 && x < cx + 16 && this.xfer8(x, base + i * 128 + j * 2, y + vs & 7, diff >= 0);
			}
		}
		for (let i = spr.length - 1; i >= 0; --i)
			spr[i].prw === 3 && this.xfer16sp(spr[i].x, 0xeb0004 | spr[i].n << 3, y + 16 - spr[i].y, spr[i].n);
		if (diff === -2)
			for (let px, p = 1024 * (y + 16) + 16, q = 16, i = cx; i > 0; ++p, --i)
				(px = this.temp[q++]) && (px = this.palette2[px]) && (data[p] = px);
		else if (diff !== 1 || ~r2 & 0x20)
			for (let px, p = 1024 * (y + 16) + 16, q = 16, i = cx; i > 0; ++p, --i)
				(px = this.palette2[this.temp[q++]]) && (data[p] = px);
	}

	xfer8(p, k, l, gd) {
		let q = this.ram[k + 1] << 6, idx = this.ram[k] << 4 & 0xf0;
		switch (this.ram[k] >> 6) {
		case 0: // ノーマル
			q += l << 3;
			if (gd)
				for (let px, i = 8; i !== 0; ++p, --i)
					((px = this.pcg8[q++]) || idx && !this.temp[p]) && (this.temp[p] = idx | px);
			else
				for (let px, i = 8; i !== 0; ++p, --i)
					(px = this.pcg8[q++]) && (this.temp[p] = idx | px);
			return;
		case 1: // H反転
			q += l + 1 << 3;
			if (gd)
				for (let px, i = 8; i !== 0; ++p, --i)
					((px = this.pcg8[--q]) || idx && !this.temp[p]) && (this.temp[p] = idx | px);
			else
				for (let px, i = 8; i !== 0; ++p, --i)
					(px = this.pcg8[--q]) && (this.temp[p] = idx | px);
			return;
		case 2: // V反転
			q += 7 - l << 3;
			if (gd)
				for (let px, i = 8; i !== 0; ++p, --i)
					((px = this.pcg8[q++]) || idx && !this.temp[p]) && (this.temp[p] = idx | px);
			else
				for (let px, i = 8; i !== 0; ++p, --i)
					(px = this.pcg8[q++]) && (this.temp[p] = idx | px);
			return;
		case 3: // HV反転
			q += 8 - l << 3;
			if (gd)
				for (let px, i = 8; i !== 0; ++p, --i)
					((px = this.pcg8[--q]) || idx && !this.temp[p]) && (this.temp[p] = idx | px);
			else
				for (let px, i = 8; i !== 0; ++p, --i)
					(px = this.pcg8[--q]) && (this.temp[p] = idx | px);
			return;
		}
	}

	xfer16(p, k, l, gd) {
		let q = this.ram[k + 1] << 8, idx = this.ram[k] << 4 & 0xf0;
		switch (this.ram[k] >> 6) {
		case 0: // ノーマル
			q += l << 4;
			if (gd)
				for (let px, i = 16; i !== 0; ++p, --i)
					((px = this.pcg16[q++]) || idx && !this.temp[p]) && (this.temp[p] = idx | px);
			else
				for (let px, i = 16; i !== 0; ++p, --i)
					(px = this.pcg16[q++]) && (this.temp[p] = idx | px);
			return;
		case 1: // H反転
			q += l + 1 << 4;
			if (gd)
				for (let px, i = 16; i !== 0; ++p, --i)
					((px = this.pcg16[--q]) || idx && !this.temp[p]) && (this.temp[p] = idx | px);
			else
				for (let px, i = 16; i !== 0; ++p, --i)
					(px = this.pcg16[--q]) && (this.temp[p] = idx | px);
			return;
		case 2: // V反転
			q += 15 - l << 4;
			if (gd)
				for (let px, i = 16; i !== 0; ++p, --i)
					((px = this.pcg16[q++]) || idx && !this.temp[p]) && (this.temp[p] = idx | px);
			else
				for (let px, i = 16; i !== 0; ++p, --i)
					(px = this.pcg16[q++]) && (this.temp[p] = idx | px);
			return;
		case 3: // HV反転
			q += 16 - l << 4;
			if (gd)
				for (let px, i = 16; i !== 0; ++p, --i)
					((px = this.pcg16[--q]) || idx && !this.temp[p]) && (this.temp[p] = idx | px);
			else
				for (let px, i = 16; i !== 0; ++p, --i)
					(px = this.pcg16[--q]) && (this.temp[p] = idx | px);
			return;
		}
	}

	xfer16sp(p, k, l, n) {
		let q = this.ram[k + 1] << 8, idx = this.ram[k] << 4 & 0xf0;
		switch (this.ram[k] >> 6) {
		case 0: // ノーマル
			q += l << 4;
			for (let px, i = 16; i !== 0; ++p, --i)
				(px = this.pcg16[q++]) && this.pri[p] > n && (this.temp[p] = idx | px, this.pri[p] = n);
			return;
		case 1: // H反転
			q += l + 1 << 4;
			for (let px, i = 16; i !== 0; ++p, --i)
				(px = this.pcg16[--q]) && this.pri[p] > n && (this.temp[p] = idx | px, this.pri[p] = n);
			return;
		case 2: // V反転
			q += 15 - l << 4;
			for (let px, i = 16; i !== 0; ++p, --i)
				(px = this.pcg16[q++]) && this.pri[p] > n && (this.temp[p] = idx | px, this.pri[p] = n);
			return;
		case 3: // HV反転
			q += 16 - l << 4;
			for (let px, i = 16; i !== 0; ++p, --i)
				(px = this.pcg16[--q]) && this.pri[p] > n && (this.temp[p] = idx | px, this.pri[p] = n);
			return;
		}
	}
}

function* generator(fdc) {
	const irq = () => fdc.irq = true, drq = () => fdc.drq = true;
	for (;;) {
		let command = fdc.data, us;
		if (command === 3) { // SPECIFY
			fdc.status |= 0x10, yield, yield, fdc.status &= ~0x10;
		} else if (command === 4) { // SENSE DEVICE STATUS
			fdc.status |= 0x10, yield, us = fdc.data, fdc.data = (FDD[us & 3] ? 1 : 0) << 5 | !fdc.c[us & 3] << 4 | us & 7, fdc.status |= 0x40, yield;
		} else if ((command & ~0xc0) === 5) { // WRITE DATA
			let c, h, r, n, eot, length, offset;
			fdc.status |= 0x10, yield, us = fdc.data & 7, yield, c = fdc.data, yield, h = fdc.data, yield, r = fdc.data, yield, n = fdc.data;
			yield, eot = fdc.data, yield, /* gsl */ yield, /* dtl */ length = 128 << n, offset = (c * 2 + h) * 8192 + (r - 1) * length;
			if (FDD[us & 3]) {
				do {
					drq(), yield, FDD[us & 3][offset] = fdc.data;
					if (!(++offset & length - 1))
						r < eot ? ++r : ~command & 0x80 ? (++c, r = 1) : (us & 4 && ++c, us ^= 4, h ^= 1, r = 1), offset = (c * 2 + h) * 8192 + (r - 1) * length;
				} while (!fdc.tc);
				offset & length - 1 && (r < eot ? ++r : ~command & 0x80 ? (++c, r = 1) : (us & 4 && ++c, h ^= 1, r = 1)), fdc.data = us, fdc.status |= 0x40, irq();
				yield, fdc.data = 0, yield, yield, fdc.data = c, yield, fdc.data = h, yield, fdc.data = r, yield, fdc.data = n, yield;
			} else
				fdc.data = 0x48 | us, fdc.status |= 0x40, irq(), yield, fdc.data = 0, yield, yield, yield, yield, yield, yield;
		} else if ((command & ~0xe0) === 6) { // READ DATA
			let c, h, r, n, eot, length, offset;
			fdc.status |= 0x10, yield, us = fdc.data & 7, yield, c = fdc.data, yield, h = fdc.data, yield, r = fdc.data, yield, n = fdc.data;
			yield, eot = fdc.data, yield, /* gsl */ yield, /* dtl */ length = 128 << n, offset = (c * 2 + h) * 8192 + (r - 1) * length, fdc.status |= 0x40;
			if (FDD[us & 3]) {
				do {
					fdc.data = FDD[us & 3][offset];
					if (!(++offset & length - 1))
						r < eot ? ++r : ~command & 0x80 ? (++c, r = 1) : (us & 4 && ++c, us ^= 4, h ^= 1, r = 1), offset = (c * 2 + h) * 8192 + (r - 1) * length;
					drq(), yield;
				} while (!fdc.tc);
				offset & length - 1 && (r < eot ? ++r : ~command & 0x80 ? (++c, r = 1) : (us & 4 && ++c, h ^= 1, r = 1)), fdc.data = us, irq();
				yield, fdc.data = 0, yield, yield, fdc.data = c, yield, fdc.data = h, yield, fdc.data = r, yield, fdc.data = n, yield;
			} else
				fdc.data = 0x48 | us, irq(), yield, fdc.data = 0, yield, yield, yield, yield, yield, yield;
		} else if (command === 7) { // RECALIBRATE
			fdc.status |= 0x10, yield, us = fdc.data & 3, fdc.c[us] = 0, fdc.status = fdc.status & ~0x10 | 1 << us, irq();
		} else if (command === 8) { // SENSE INTERRUPT STATUS
			if (fdc.status & 15)
				fdc.status |= 0x50, us = 31 - Math.clz32(fdc.status & 15), fdc.data = 0x20 | us, yield, fdc.data = fdc.c[us], yield, fdc.status &= ~(1 << us);
			else
				fdc.status |= 0x50, fdc.data = 0x80, yield;
		} else if ((command & ~0x40) === 10) { // READ ID
			fdc.status |= 0x10, yield, us = fdc.data & 7;
			if (FDD[us & 3]) {
				fdc.data = 0 | us, fdc.status |= 0x40, irq(), yield, fdc.data = 0, yield, yield, fdc.data = fdc.c[us & 3];
				yield, fdc.data = us >> 2, yield, fdc.data = 1, yield, fdc.data = 3, yield;
			} else
				fdc.data = 0x48 | us, fdc.status |= 0x40, irq(), yield, fdc.data = 0, yield, yield, yield, yield, yield, yield;
		} else if ((command & ~0x40) === 13) { // WRITE ID
			let n, sc, d, offset, count = 0;
			fdc.status |= 0x10, yield, us = fdc.data & 7, yield, n = fdc.data, yield, sc = fdc.data, yield, /* gpl */ yield, d = fdc.data;
			if (FDD[us & 3]) {
				for (fdc.tc = false; !fdc.tc && count < sc * 4; ++count)
					drq(), yield;
				offset = (fdc.c[us & 3] * 2 + (us >> 2)) * 8192, FDD[us & 3].fill(d, offset, offset + 8192);
				fdc.data = us, fdc.status |= 0x40, irq(), yield, fdc.data = 0, yield, yield, yield, yield, yield, fdc.data = n, yield;
			} else
				fdc.data = 0x48 | us, fdc.status |= 0x40, irq(), yield, fdc.data = 0, yield, yield, yield, yield, yield, yield;
		} else if (command === 15) { // SEEK
			fdc.status |= 0x10, yield, us = fdc.data & 3, yield, fdc.c[us] = fdc.data, fdc.status = fdc.status & ~0x10 | 1 << us, irq();
		} else if ((command & ~0xe0) === 17) { // SCAN EQUAL
			let c, h, r, n, eot, stp, length, offset, sh;
			fdc.status |= 0x10, yield, us = fdc.data & 7, yield, c = fdc.data, yield, h = fdc.data, yield, r = fdc.data, yield, n = fdc.data;
			yield, eot = fdc.data, yield, /* gsl */ yield, stp = fdc.data, length = 128 << n, offset = (c * 2 + h) * 8192 + (r - 1) * length;
			if (FDD[us & 3]) {
				for (; ;) {
					for (sh = true, fdc.tc = false; !fdc.tc; ++offset)
						drq(), yield, fdc.data !== 0xff && fdc.data !== FDD[us & 3][offset] && (sh = false);
					if (sh || r === eot && (~command & 0x80 || us & 4))
						break;
					r < eot ? r += stp : command & 0x80 && (us |= 4, h ^= 1, r = stp), offset = (c * 2 + h) * 8192 + (r - 1) * length;
				}
				fdc.data = us, fdc.status |= 0x40, irq(), yield, fdc.data = 0, yield, fdc.data = sh << 3 | !sh << 2;
				yield, fdc.data = c, yield, fdc.data = h, yield, fdc.data = r, yield, fdc.data = n, yield;
			} else
				fdc.data = 0x48 | us, fdc.status |= 0x40, irq(), yield, fdc.data = 0, yield, yield, yield, yield, yield, yield;
		} else
			console.log(`FDC Command ($${Number(command).toString(16)})`), fdc.status |= 0x50, fdc.data = 0x80, yield;
		fdc.status &= ~0x50, yield;
	}
}

const bc = Uint8Array.from(window.atob('\
AAEBAgECAgMBAgIDAgMDBAECAgMCAwMEAgMDBAMEBAUBAgIDAgMDBAIDAwQDBAQFAgMDBAMEBAUDBAQFBAUFBgECAgMCAwMEAgMDBAMEBAUCAwMEAwQEBQME\
BAUEBQUGAgMDBAMEBAUDBAQFBAUFBgMEBAUEBQUGBAUFBgUGBgcBAgIDAgMDBAIDAwQDBAQFAgMDBAMEBAUDBAQFBAUFBgIDAwQDBAQFAwQEBQQFBQYDBAQF\
BAUFBgQFBQYFBgYHAgMDBAMEBAUDBAQFBAUFBgMEBAUEBQUGBAUFBgUGBgcDBAQFBAUFBgQFBQYFBgYHBAUFBgUGBgcFBgYHBgcHCA==\
').split(''), c => c.charCodeAt(0));
export const SRAM = Uint8Array.from(window.atob('\
gnc2ODAwMFcAwAAAAL///ADtAQD/////kHBuBwAQAAAAAP//AAAHAQ4ADQAAAAAA+D7/wP/+zahAIgMCAAgAAAAAAAAAAAAAAP/cAAQAAQEAAAAgAAn5AQAA\
AADgAOAA4ADgAAAAAAAAAAAAAAAAVg8=\
').split(''), c => c.charCodeAt(0));
export const FDD = [];
export const sound = [
	new YM2151({clock: Math.floor(16000000 / 4)}),
	new MSM6258(),
];
