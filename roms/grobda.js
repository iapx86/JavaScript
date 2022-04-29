/*
 *	Grobda
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
const prg1 = cat(z.read('gr2-3.1d'), z.read('gr2-2.1c'), z.read('gr2-1.1b'));
const prg2 = z.read('gr1-4.1k');
const bg = z.read('gr1-7.3c');
const obj = cat(z.read('gr1-5.3f'), z.read('gr1-6.3e'));
const rgb = z.read('gr1-6.4c');
const bgcolor = z.read('gr1-5.4e');
const objcolor = z.read('gr1-4.3l');
const snd = z.read('gr1-3.3m');

const rom = cat(prg1, prg2, bg, obj, rgb, bgcolor, objcolor, snd);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
