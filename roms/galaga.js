/*
 *	Galaga
 */

const fs = require('fs');
const {createCanvas, createImageData} = require('canvas');
const {Zlib} = require('zlibjs/bin/unzip.min');
Zlib.Unzip.prototype.read = Zlib.Unzip.prototype.decompress;

const cat = (...args) => {
	const array = new Uint8Array(args.reduce((a, b) => a + b.length, 0));
	return args.reduce((a, b) => (array.set(b, a), a + b.length), 0), array;
};

let z = new Zlib.Unzip(fs.readFileSync(process.argv[2]));
const prg1 = cat(z.read('gg1_1b.3p'), z.read('gg1_2b.3m'), z.read('gg1_3.2m'), z.read('gg1_4b.2l'));
const prg2 = z.read('gg1_5b.3f');
const prg3 = z.read('gg1_7b.2c');
const bg = z.read('gg1_9.4l');
const obj = cat(z.read('gg1_11.4d'), z.read('gg1_10.4f'));
const rgb = z.read('prom-5.5n');
const bgcolor = z.read('prom-4.2n');
const objcolor = z.read('prom-3.1c');
const snd = z.read('prom-1.1d');
z = new Zlib.Unzip(fs.readFileSync(process.argv[3]));
const io = z.read('51xx.bin');
z = new Zlib.Unzip(fs.readFileSync(process.argv[4]));
const prg = z.read('54xx.bin');

const rom = cat(prg1, prg2, prg3, bg, obj, rgb, bgcolor, objcolor, snd, io, prg);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[5], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
