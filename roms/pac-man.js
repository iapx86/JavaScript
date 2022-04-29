/*
 *	Pac-Man
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
const prg = cat(z.read('pm1_prg1.6e'), z.read('pm1_prg2.6k'), z.read('pm1_prg3.6f'), z.read('pm1_prg4.6m'), z.read('pm1_prg5.6h'), z.read('pm1_prg6.6n'), z.read('pm1_prg7.6j'), z.read('pm1_prg8.6p'));
const bg = cat(z.read('pm1_chg1.5e'), z.read('pm1_chg2.5h'));
const obj = cat(z.read('pm1_chg3.5f'), z.read('pm1_chg4.5j'));
const rgb = z.read('pm1-1.7f');
const color = z.read('pm1-4.4a');
const snd = z.read('pm1-3.1m');

const rom = cat(prg, bg, obj, rgb, color, snd);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
