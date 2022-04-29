/*
 *	DigDug
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
const prg1 = cat(z.read('dd1a.1'), z.read('dd1a.2'), z.read('dd1a.3'), z.read('dd1a.4'));
const prg2 = cat(z.read('dd1a.5'), z.read('dd1a.6'));
const prg3 = z.read('dd1.7');
const bg2 = z.read('dd1.9');
const obj = cat(z.read('dd1.15'), z.read('dd1.14'), z.read('dd1.13'), z.read('dd1.12'));
const bg4 = z.read('dd1.11');
const mapdata = z.read('dd1.10b');
const rgb = z.read('136007.113');
const objcolor = z.read('136007.111');
const bgcolor = z.read('136007.112');
const snd = z.read('136007.110');
z = new Zlib.Unzip(fs.readFileSync(process.argv[3]));
const io = z.read('51xx.bin');

const rom = cat(prg1, prg2, prg3, bg2, obj, bg4, mapdata, rgb, objcolor, bgcolor, snd, io);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[4], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
