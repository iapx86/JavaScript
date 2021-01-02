/*
 *
 *	SEGA Z80 Emulator
 *
 */

import Z80 from './z80.js';
import {seq, bitswap} from './main.js';

export default class Sega2Z80 extends Z80 {
	code_table = Uint8Array.from(seq(0x4100), i => i & 0xff);
	data_table = Uint8Array.from(seq(0x4100), i => i & 0xff);

	constructor(key1, key2) {
		super();
		const t = [
			[6, 4, 2, 0], [4, 6, 2, 0], [2, 4, 6, 0], [0, 4, 2, 6], [6, 2, 4, 0], [6, 0, 2, 4],
			[6, 4, 0, 2], [2, 6, 4, 0], [4, 2, 6, 0], [4, 6, 0, 2], [6, 0, 4, 2], [0, 6, 4, 2],
			[4, 0, 6, 2], [0, 4, 6, 2], [6, 2, 0, 4], [2, 6, 0, 4], [0, 6, 2, 4], [2, 0, 6, 4],
			[0, 2, 6, 4], [4, 2, 0, 6], [2, 4, 0, 6], [4, 0, 2, 6], [2, 0, 4, 6], [0, 2, 4, 6]];
		for (let i = 0; i < 0x4000; i++) {
			const c = t[key2[i >> 7 & ~1]], d = t[key2[i >> 7 | 1]];
			this.code_table[i] = bitswap(i, 7, c[0], 5, c[1], 3, c[2], 1, c[3]) ^ key1[i >> 7 & ~1];
			this.data_table[i] = bitswap(i, 7, d[0], 5, d[1], 3, d[2], 1, d[3]) ^ key1[i >> 7 | 1];
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

const index = Uint8Array.from(seq(0x10000), i => i & 0x8000 ? 0x40 : bitswap(i, 14, 12, 9, 6, 3, 0));
