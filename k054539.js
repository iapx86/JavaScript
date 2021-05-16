/*
 *
 *	K054539 Sound Module
 *
 */

import {seq} from './utils.js';

export default class K054539 {
	pcm;
	clock;
	gain;
	output = 0;
	reg = new Uint8Array(0x400);
	frac = 0;
	channel = [];

	constructor({PCM, clock, gain = 1}) {
		this.pcm = PCM;
		this.clock = clock;
		this.gain = gain;
		for (let i = 0; i < 8; i++)
			this.channel.push({play: false, output: 0, addr: 0, frac: 0});
	}

	read(addr) {
		return (addr &= 0x3ff) < 0x230 ? this.reg[addr] : 0xff;
	}

	write(addr, data) {
		const reg = this.reg;
		switch (addr &= 0x3ff) {
		case 0x214:
			data &= ~reg[0x22c];
			for (let i = 0; i < 8; i++)
				if (data & 1 << i && (reg[0x200 | i << 1] & 0xc) === 0xc)
					data &= ~(1 << i);
			reg[0x22c] |= data;
			this.channel.forEach((ch, i) => {
				if (~data & 1 << i)
					return;
				Object.assign(ch, {play: true, output: 0, addr: reg[0xc | i << 5] | reg[0xd | i << 5] << 8 | reg[0xe | i << 5] << 16, frac: 0});
				switch (reg[0x200 | i << 1] & 0xc) {
				case 0:
					return void(ch.output = this.pcm[ch.addr] << 24 >> 16);
				case 4:
					return void(ch.output = (this.pcm[ch.addr] | this.pcm[ch.addr + 1] << 8) << 16 >> 16);
				case 8:
					return void(ch.output = [0, 1, 4, 9, 16, 25, 36, 49, -64, -49, -36, -25, -16, -9, -4, -1][this.pcm[(ch.addr <<= 1) >> 1] & 15] << 8);
				}
			});
			break;
		case 0x215:
			reg[0x22c] &= ~data;
			this.channel.forEach((ch, i) => data & 1 << i && (ch.play = false));
			break;
		}
		reg[addr] = data;
	}

	execute(rate) {
		const reg = this.reg;
		if (~reg[0x22f] & 1)
			return;
		for (this.frac += this.clock; this.frac >= rate * 384; this.frac -= rate * 384)
			this.channel.forEach((ch, i) => {
				if (!ch.play)
					return;
				const rate = reg[i << 5] | reg[1 | i << 5] << 8 | reg[2 | i << 5] << 16;
				const loop = reg[8 | i << 5] | reg[9 | i << 5] << 8 | reg[0xa | i << 5] << 16;
				let val;
outer:			switch (reg[0x200 | i << 1] & 0x2c) {
				case 0:
					for (ch.frac += rate; ch.frac >= 0x10000; ch.frac -= 0x10000)
						if ((ch.output = this.pcm[ch.addr += 1] << 24 >> 16) === -0x8000) {
							if (~reg[0x201 | i << 1] & 1)
								break outer;
							ch.output = this.pcm[ch.addr = loop] << 24 >> 16;
						}
					return;
				case 4:
					for (ch.frac += rate; ch.frac >= 0x10000; ch.frac -= 0x10000)
						if ((ch.output = (this.pcm[ch.addr += 2] | this.pcm[ch.addr + 1] << 8) << 16 >> 16) === -0x8000) {
							if (~reg[0x201 | i << 1] & 1)
								break outer;
							ch.output = (this.pcm[ch.addr = loop] | this.pcm[ch.addr + 1] << 8) << 16 >> 16;
						}
					return;
				case 8:
					for (ch.frac += rate; ch.frac >= 0x10000; ch.frac -= 0x10000) {
						if ((val = this.pcm[(ch.addr += 1) >> 1]) === 0x88) {
							if (~reg[0x201 | i << 1] & 1)
								break outer;
							val = this.pcm[(ch.addr = loop << 1) >> 1];
						}
						ch.output += [0, 1, 4, 9, 16, 25, 36, 49, -64, -49, -36, -25, -16, -9, -4, -1][ch.addr & 1 ? val >> 4 : val & 15] << 8;
						ch.output = ch.output < -0x7f00 ? -0x7f00 : ch.output > 0x7f00 ? 0x7f00 : ch.output;
					}
					return;
				case 0x20:
					for (ch.frac -= rate; ch.frac < 0; ch.frac += 0x10000)
						if ((ch.output = this.pcm[ch.addr -= 1] << 24 >> 16) === -0x8000) {
							if (~reg[0x201 | i << 1] & 1)
								break outer;
							ch.output = this.pcm[ch.addr = loop] << 24 >> 16;
						}
					return;
				case 0x24:
					for (ch.frac -= rate; ch.frac < 0; ch.frac += 0x10000)
						if ((ch.output = (this.pcm[ch.addr -= 2] | this.pcm[ch.addr + 1] << 8) << 16 >> 16) === -0x8000) {
							if (~reg[0x201 | i << 1] & 1)
								break outer;
							ch.output = (this.pcm[ch.addr = loop] | this.pcm[ch.addr + 1] << 8) << 16 >> 16;
						}
					return;
				case 0x28:
					for (ch.frac -= rate; ch.frac < 0; ch.frac += 0x10000) {
						if ((val = this.pcm[(ch.addr -= 1) >> 1]) === 0x88) {
							if (~reg[0x201 | i << 1] & 1)
								break outer;
							val = this.pcm[(ch.addr = loop << 1) >> 1];
						}
						ch.output -= [0, 1, 4, 9, 16, 25, 36, 49, -64, -49, -36, -25, -16, -9, -4, -1][ch.addr & 1 ? val >> 4 : val & 15] << 8;
						ch.output = ch.output < -0x7f00 ? -0x7f00 : ch.output > 0x7f00 ? 0x7f00 : ch.output;
					}
					return;
				}
				ch.play = false;
				this.reg[0x22c] &= ~(1 << i);
			});
	}

	update() {
		const reg = this.reg;
		this.output = 0;
		if (~reg[0x22f] & 1)
			return;
		this.channel.forEach((ch, i) => ch.play && (this.output += ch.output / 32767 * vol[reg[3 | i << 5]] * this.gain));
	}
}

const vol = Float64Array.from(seq(256), i => Math.pow(10, -36 / 0x40 / 20 * i));
