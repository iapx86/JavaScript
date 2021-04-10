/*
 *
 *	SEGA Z80 Emulator
 *
 */

import Z80 from './z80.js';
import {seq, bitswap} from './utils.js';

export default class SegaZ80 extends Z80 {
	code_table = Uint8Array.from(seq(0x1100), i => i & 0xff);
	data_table = Uint8Array.from(seq(0x1100), i => i & 0xff);

	constructor(key, clock) {
		super(clock);
		for (let i = 0; i < 0x1000; i++) {
			this.code_table[i] = i & 0x57 | (i & 0x80 ? key[i >> 7 & ~1][bitswap(~i, 5, 3)] ^ 0xa8 : key[i >> 7 & ~1][bitswap(i, 5, 3)]);
			this.data_table[i] = i & 0x57 | (i & 0x80 ? key[i >> 7 | 1][bitswap(~i, 5, 3)] ^ 0xa8 : key[i >> 7 | 1][bitswap(i, 5, 3)]);
		}
	}

	fetchM1() {
		const addr = this.pc;
		return this.code_table[index[addr] << 8 | super.fetchM1()];
	}

	fetch() {
		const addr = this.pc;
		return this.data_table[index[addr] << 8 | super.fetch()];
	}

	read(addr) {
		return this.data_table[index[addr] << 8 | super.read(addr)];
	}
}

const index = Uint8Array.from(seq(0x10000), i => i & 0x8000 ? 0x10 : bitswap(i, 12, 8, 4, 0));
