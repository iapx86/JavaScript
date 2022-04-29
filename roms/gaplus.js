/*
 *	Gaplus
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
const prg1 = cat(z.read('gp2-4.8d'), z.read('gp2-3b.8c'), z.read('gp2-2b.8b'));
const prg2 = cat(z.read('gp2-8.11d'), z.read('gp2-7.11c'), z.read('gp2-6.11b'));
const prg3 = z.read('gp2-1.4b');
const bg = z.read('gp2-5.8s');
const obj = cat(z.read('gp2-11.11p'), z.read('gp2-10.11n'), z.read('gp2-9.11m'), z.read('gp2-12.11r'));
const red = z.read('gp2-3.1p');
const green = z.read('gp2-1.1n');
const blue = z.read('gp2-2.2n');
const bgcolor = z.read('gp2-7.6s');
const objcolor_l = z.read('gp2-6.6p');
const objcolor_h = z.read('gp2-5.6n');
const snd = z.read('gp2-4.3f');
z = new Zlib.Unzip(fs.readFileSync(process.argv[3]));
const prg = z.read('62xx.bin');

const rom = cat(prg1, prg2, prg3, bg, obj, red, green, blue, bgcolor, objcolor_l, objcolor_h, snd, prg);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[4], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
