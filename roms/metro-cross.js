/*
 *	Metro-Cross
 */

const fs = require('fs');
const {createCanvas, createImageData} = require('canvas');
const {Zlib} = require('zlibjs/bin/unzip.min');
Zlib.Unzip.prototype.read = Zlib.Unzip.prototype.decompress;

const cat = (...args) => {
	const array = new Uint8Array(args.reduce((a, b) => a + b.length, 0));
	return args.reduce((a, b) => (array.set(b, a), a + b.length), 0), array;
};
const pad = (length, value = 0xff) => new Uint8Array(length).fill(value);

const z = new Zlib.Unzip(fs.readFileSync(process.argv[2]));
const prg1 = cat(z.read('mc1-3.9c'), z.read('mc1-1.9a'), z.read('mc1-2.9b'));
const prg2 = z.read('mc1-4.3b');
const prg2i = z.read('cus60-60a1.mcu');
const fg = z.read('mc1-5.3j');
const bg = cat(z.read('mc1-7.4p'), z.read('mc1-6.4n'), pad(0x4000));
const obj = cat(z.read('mc1-8.8k'), z.read('mc1-9.8l'));
const green = z.read('mc1-1.1n');
const red = z.read('mc1-2.2m');

const rom = cat(prg1, prg2, prg2i, fg, bg, obj, green, red);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
