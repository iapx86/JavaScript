/*
 *	Xevious
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
const prg1 = cat(z.read('xvi_1.3p'), z.read('xvi_2.3m'), z.read('xvi_3.2m'), z.read('xvi_4.2l'));
const prg2 = cat(z.read('xvi_5.3f'), z.read('xvi_6.3j'));
const prg3 = z.read('xvi_7.2c');
const bg2 = z.read('xvi_12.3b');
const bg4 = cat(z.read('xvi_13.3c'), z.read('xvi_14.3d'));
const obj = cat(z.read('xvi_15.4m'), z.read('xvi_17.4p'), z.read('xvi_18.4r'), z.read('xvi_16.4n'));
const maptbl = cat(z.read('xvi_9.2a'), z.read('xvi_10.2b'));
const mapdata = z.read('xvi_11.2c');
const red = z.read('xvi-8.6a');
const green = z.read('xvi-9.6d');
const blue = z.read('xvi-10.6e');
const bgcolor_l = z.read('xvi-7.4h');
const bgcolor_h = z.read('xvi-6.4f');
const objcolor_l = z.read('xvi-4.3l');
const objcolor_h = z.read('xvi-5.3m');
const snd = z.read('xvi-2.7n');
z = new Zlib.Unzip(fs.readFileSync(process.argv[3]));
const key = z.read('50xx.bin');
z = new Zlib.Unzip(fs.readFileSync(process.argv[4]));
const io = z.read('51xx.bin');
z = new Zlib.Unzip(fs.readFileSync(process.argv[5]));
const prg = z.read('54xx.bin');

const rom = cat(prg1, prg2, prg3, bg2, bg4, obj, maptbl, mapdata, red, green, blue, bgcolor_l, bgcolor_h, objcolor_l, objcolor_h, snd, key, io, prg);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[6], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
