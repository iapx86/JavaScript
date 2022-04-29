/*
 *	Time Pilot '84
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
const prg1 = cat(z.read('388_f04.7j'), z.read('388_05.8j'), z.read('388_f06.9j'), z.read('388_07.10j'));
const prg2 = z.read('388_f08.10d');
const prg3 = z.read('388j13.6a');
const bg = cat(z.read('388_h02.2j'), z.read('388_d01.1j'));
const obj = cat(z.read('388_e09.12a'), z.read('388_e10.13a'), z.read('388_e11.14a'), z.read('388_e12.15a'));
const red = z.read('388d14.2c');
const green = z.read('388d15.2d');
const blue = z.read('388d16.1e');
const bgcolor = z.read('388d18.1f');
const objcolor = z.read('388j17.16c');

const rom = cat(prg1, prg2, prg3, bg, obj, red, green, blue, objcolor, bgcolor);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
