/*
 *	Dragon Buster
 */

const fs = require('fs');
const {createCanvas, createImageData} = require('canvas');
const {Zlib} = require('zlibjs/bin/unzip.min');
Zlib.Unzip.prototype.read = Zlib.Unzip.prototype.decompress;

const cat = (...args) => {
	const array = new Uint8Array(args.reduce((a, b) => a + b.length, 0));
	return args.reduce((a, b) => (array.set(b, a), a + b.length), 0), array;
};

const z = new Zlib.Unzip(fs.readFileSync(process.argv[2]));
const prg1 = cat(z.read('db1_2b.6c'), z.read('db1_1.6b'), z.read('db1_3.6d'));
const prg2 = z.read('db1_4.3c');
const prg2i = z.read('cus60-60a1.mcu');
const fg = z.read('db1_6.6l');
const bg = z.read('db1_5.7e');
const obj = cat(z.read('db1_8.10n'), z.read('db1_7.10m'));
const red = z.read('db1-1.2n');
const green = z.read('db1-2.2p');
const blue = z.read('db1-3.2r');
const bgcolor = z.read('db1-4.5n');
const objcolor = z.read('db1-5.6n');

const rom = cat(prg1, prg2, prg2i, fg, bg, obj, red, green, blue, bgcolor, objcolor);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
