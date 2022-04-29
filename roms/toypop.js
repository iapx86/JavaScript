/*
 *	Toypop
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
const prg1 = cat(z.read('tp1-2.5b'), z.read('tp1-1.5c'));
const prg2 = z.read('tp1-3.2c');
const prg3 = merge(z.read('tp1-4.8c'), z.read('tp1-5.10c'));
const bg = z.read('tp1-7.5p');
const obj = z.read('tp1-6.9t');
const red = z.read('tp1-3.1r');
const green = z.read('tp1-2.1s');
const blue = z.read('tp1-1.1t');
const bgcolor = z.read('tp1-4.5l');
const objcolor = z.read('tp1-5.2p');
const snd = z.read('tp1-6.3d');

const rom = cat(prg1, prg2, prg3, bg, obj, red, green, blue, bgcolor, objcolor, snd);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
