/*
 *
 *	Utilities
 *
 */

export const seq = (n, s = 0, d = 1) => new Array(n).fill(0).map((e, i) => s + i * d);
export const rseq = (n, s = 0, d = 1) => new Array(n).fill(0).map((e, i) => s + (n - i - 1) * d);
export const bitswap = (val, ...args) => args.reduce((a, b) => a << 1 | val >> b & 1, 0);

export function convertGFX(dst, src, n, x, y, z, d) {
	for (let p = 0, q = 0, i = 0; i < n; q += d, i++)
		y.forEach(y => x.forEach(x => dst[p++] ^= z.reduce((a, z) => a << 1 | (z >= 0 && ~src[q | x + y + z >> 3] >> (x + y + z & 7 ^ 7) & 1), 0)));
}

export class Timer {
	rate = 0;
	frac = 0;
	fn = () => {};

	constructor(rate = 0) {
		this.rate = rate;
	}

	execute(rate, fn = this.fn) {
		for (this.frac += this.rate; this.frac >= rate; this.frac -= rate)
			fn();
	}
}

