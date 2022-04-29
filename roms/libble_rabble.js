/*
 *	Libble Rabble
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
const prg1 = cat(z.read('5b.rom'), z.read('5c.rom'));
const prg2 = z.read('2c.rom');
const prg3 = merge(z.read('8c.rom'), z.read('10c.rom'));
const bg = z.read('5p.rom');
const obj = z.read('9t.rom');
const red = z.read('lr1-3.1r');
const green = z.read('lr1-2.1s');
const blue = z.read('lr1-1.1t');
const bgcolor = z.read('lr1-5.5l');
const objcolor = z.read('lr1-6.2p');
const snd = z.read('lr1-4.3d');

const rom = cat(prg1, prg2, prg3, bg, obj, red, green, blue, bgcolor, objcolor, snd);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
