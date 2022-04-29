/*
 *	R-Type
 */

const fs = require('fs');
const {createCanvas, createImageData} = require('canvas');
const {Zlib} = require('zlibjs/bin/unzip.min');
Zlib.Unzip.prototype.read = Zlib.Unzip.prototype.decompress;

const cat = (...args) => {
	const array = new Uint8Array(args.reduce((a, b) => a + b.length, 0));
	return args.reduce((a, b) => (array.set(b, a), a + b.length), 0), array;
};
const merge = (...args) => {
	const array = new Uint8Array(args.reduce((a, b) => a + b.length, 0)), step = args.length;
	return args.forEach((a, i) => a.forEach((e, j) => array[j * step + i] = e)), array;
};

const z = new Zlib.Unzip(fs.readFileSync(process.argv[2]));
const prg = merge(cat(z.read('rtypej/rt_r-l0-.3b'), z.read('rtypej/rt_r-l1-.3c')), cat(z.read('rtypej/rt_r-h0-.1b'), z.read('rtypej/rt_r-h1-.1c')));
let obj = cat(z.read('rt_r-00.1h'), z.read('rt_r-01.1j'), z.read('rt_r-01.1j'), z.read('rt_r-10.1k'), z.read('rt_r-11.1l'), z.read('rt_r-11.1l'));
obj = cat(obj, z.read('rt_r-20.3h'), z.read('rt_r-21.3j'), z.read('rt_r-21.3j'), z.read('rt_r-30.3k'), z.read('rt_r-31.3l'), z.read('rt_r-31.3l'));
const bg1 = cat(z.read('rt_b-a0.3c'), z.read('rt_b-a1.3d'), z.read('rt_b-a2.3a'), z.read('rt_b-a3.3e'));
const bg2 = cat(z.read('rt_b-b0.3j'), z.read('rt_b-b1.3k'), z.read('rt_b-b2.3h'), z.read('rt_b-b3.3f'));

const rom = cat(prg, obj, bg1, bg2);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
