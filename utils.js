/*
 *
 *	Array supplementary
 *
 */

if (!Array.prototype.addBase)
	Object.defineProperty(Uint8Array.prototype, 'addBase', {
		value: function () {
			this.base = [];
			for (let begin = 0; begin < this.length; begin += 0x100) {
				const end = Math.min(begin + 0x100, this.length);
				this.base.push(this.subarray(begin, end));
			}
			return this;
		},
		writable: true,
		configurable: true,
	});

if (!Array.prototype.fill)
	Object.defineProperty(Array.prototype, 'fill', {
		value: function (value, start = 0, end = this.length) {
			for (let i = start; i < end; i++)
				this[i] = value;
			return this;
		},
		writable: true,
		configurable: true,
	});

if (!Array.prototype.find)
	Object.defineProperty(Array.prototype, 'find', {
		value: function (callback, thisArg) {
			for (let i = 0; i < this.length; i++)
				if (i in this && callback.call(thisArg, this[i], i, this))
					return this[i];
			return undefined;
		},
		writable: true,
		configurable: true,
	});

if (!Uint8Array.prototype.copyWithin)
	Object.defineProperty(Uint8Array.prototype, 'copyWithin', {
		value: function (target, start, end = this.length) {
			for (let i = start; i < end; i++)
				this[target - start + i] = this[i];
		},
		writable: true,
		configurable: true,
	});

if (!Uint8Array.prototype.every)
	Object.defineProperty(Uint8Array.prototype, 'every', {
		value: function (func, thisObj) {
			for (let i = 0; i < this.length; i++)
				if (!func.call(thisObj, this[i]))
					return false;
			return true;
		},
		writable: true,
		configurable: true,
	});

if (!Uint8Array.prototype.fill)
	Object.defineProperty(Uint8Array.prototype, 'fill', {
		value: function (value, start = 0, end = this.length) {
			for (let i = start; i < end; i++)
				this[i] = value;
			return this;
		},
		writable: true,
		configurable: true,
	});

if (!Uint8Array.__proto__.of)
	void function () {
		Uint8Array.__proto__.of = function () { return new Uint8Array(arguments); };
	}();

if (!Uint8Array.__proto__.from)
	void function () {
		Uint8Array.__proto__.from = function (obj, func, thisObj) {
			let typed_array = new this(obj.length);
			for (let i = 0; i < typed_array.length; i++)
				typed_array[i] = func.call(thisObj, obj[i], i, typed_array);
			return typed_array;
		};
	}();

if (!Uint16Array.prototype.fill)
	Object.defineProperty(Uint16Array.prototype, 'fill', {
		value: function (value, start = 0, end = this.length) {
			for (let i = start; i < end; i++)
				this[i] = value;
			return this;
		},
		writable: true,
		configurable: true,
	});

if (!Uint16Array.__proto__.from)
	void function () {
		Uint16Array.__proto__.from = function (obj, func, thisObj) {
			let typed_array = new this(obj.length);
			for (let i = 0; i < typed_array.length; i++)
				typed_array[i] = func.call(thisObj, obj[i], i, typed_array);
			return typed_array;
		};
	}();

if (!Int32Array.prototype.copyWithin)
	Object.defineProperty(Int32Array.prototype, 'copyWithin', {
		value: function (target, start, end = this.length) {
			for (let i = start; i < end; i++)
				this[target - start + i] = this[i];
		},
		writable: true,
		configurable: true,
	});

if (!Int32Array.prototype.fill)
	Object.defineProperty(Int32Array.prototype, 'fill', {
		value: function (value, start = 0, end = this.length) {
			for (let i = start; i < end; i++)
				this[i] = value;
			return this;
		},
		writable: true,
		configurable: true,
	});

if (!Int32Array.__proto__.of)
	void function () {
		Int32Array.__proto__.of = function () { return new Int32Array(arguments); };
	}();

if (!Int32Array.__proto__.from)
	void function () {
		Int32Array.__proto__.from = function (obj, func, thisObj) {
			let typed_array = new this(obj.length);
			for (let i = 0; i < typed_array.length; i++)
				typed_array[i] = func.call(thisObj, obj[i], i, typed_array);
			return typed_array;
		};
	}();

if (!String.prototype.repeat)
	Object.defineProperty(String.prototype, 'repeat', {
		value: function (count) {
			let str = '' + this;
			if (!str.length || !count)
				return '';
			const maxCount = str.length * count;
			for (let i = 1; i * 2 <= count; i *= 2)
				str += str;
			str += str.substring(0, maxCount - str.length);
			return str;
		},
		writable: true,
		configurable: true,
	});

if (typeof Object.assign !== 'function')
	Object.defineProperty(Object, 'assign', {
		value: function (target, varArgs) {
			const to = Object(target);
			for (let index = 1; index < arguments.length; index++) {
				const nextSource = arguments[index];
				if (nextSource !== null && nextSource !== undefined)
					for (const nextKey in nextSource)
						if (Object.prototype.hasOwnProperty.call(nextSource, nextKey))
							to[nextKey] = nextSource[nextKey];
			}
			return to;
		},
		writable: true,
		configurable: true
	});

if (!Math.log2)
	Math.log2 = x => Math.log(x) / Math.LN2;

if (!Math.clz32)
	Math.clz32 = x => !(x >>> 0) ? 32 : 31 - (Math.log2(x >>> 0) | 0) | 0;

/*
 *
 *	Utilities
 *
 */

export const seq = (n, s = 0, d = 1) => new Array(n).fill(0).map((e, i) => s + i * d), rseq = (...args) => seq(...args).reverse();
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

