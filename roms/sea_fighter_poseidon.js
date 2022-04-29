/*
 *	Sea Fighter Poseidon
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
const prg1 = cat(z.read('a14-01.1'), z.read('a14-02.2'), z.read('a14-03.3'), z.read('a14-04.6'), z.read('a14-05.7'));
const prg2 = cat(z.read('a14-10.70'), z.read('a14-11.71'));
const prg3 = z.read('a14-12');
const gfx = cat(z.read('a14-06.4'), z.read('a14-07.5'), z.read('a14-08.9'), z.read('a14-09.10'));
const pri = z.read('eb16.22');

const rom = cat(prg1, prg2, prg3, gfx, pri);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
