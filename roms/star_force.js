/*
 *	Star Force
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
const prg1 = cat(z.read('3.3p'), z.read('2.3mn'));
const prg2 = z.read('1.3hj');
const fg = cat(z.read('7.2fh'), z.read('8.3fh'), z.read('9.3fh'));
const bg1 = cat(z.read('15.10jk'), z.read('14.9jk'), z.read('13.8jk'));
const bg2 = cat(z.read('12.10de'), z.read('11.9de'), z.read('10.8de'));
const bg3 = cat(z.read('18.10pq'), z.read('17.9pq'), z.read('16.8pq'));
const obj = cat(z.read('6.10lm'), z.read('5.9lm'), z.read('4.8lm'));
const snd = z.read('07b.bin');

const rom = cat(prg1, prg2, fg, bg1, bg2, bg3, obj, snd);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
