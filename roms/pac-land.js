/*
 *	Pac-Land
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
const prg1 = cat(z.read('paclandj/pl6_01.8b'), z.read('paclandj/pl6_02.8d'), z.read('pl1_3.8e'), z.read('pl1_4.8f'), z.read('pl1_5.8h'), z.read('paclandj/pl1_6.8j'));
const prg2 = z.read('pl1_7.3e');
const prg2i = z.read('cus60-60a1.mcu');
const fg = z.read('paclandj/pl6_12.6n');
const bg = z.read('paclandj/pl1_13.6t');
const obj = cat(z.read('paclandj/pl1_9b.6f'), z.read('paclandj/pl1_8.6e'), z.read('paclandj/pl1_10b.7e'), z.read('paclandj/pl1_11.7f'));
const red = z.read('pl1-2.1t');
const blue = z.read('pl1-1.1r');
const fgcolor = z.read('pl1-5.5t');
const bgcolor = z.read('pl1-4.4n');
const objcolor = z.read('pl1-3.6l');

const rom = cat(prg1, prg2, prg2i, fg, bg, obj, red, blue, fgcolor, bgcolor, objcolor);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
