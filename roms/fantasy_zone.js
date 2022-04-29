/*
 *	Fantasy Zone
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
const prg1 = merge(cat(z.read('epr-7385a.43'), z.read('epr-7386a.42'), z.read('epr-7387.41')), cat(z.read('epr-7382a.26'), z.read('epr-7383a.25'), z.read('epr-7384.24')));
const bg = cat(z.read('epr-7388.95'), z.read('epr-7389.94'), z.read('epr-7390.93'));
const obj = merge(cat(z.read('epr-7396.11'), z.read('epr-7397.18'), z.read('epr-7398.24')), cat(z.read('epr-7392.10'), z.read('epr-7393.17'), z.read('epr-7394.23')));
const prg2 = z.read('epr-7535a.12');

const rom = cat(prg1, bg, obj, prg2);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
