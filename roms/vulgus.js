/*
 *	Vulgus
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
const prg1 = cat(z.read('vulgus.002'), z.read('vulgus.003'), z.read('vulgus.004'), z.read('vulgus.005'), z.read('1-8n.bin'));
const prg2 = z.read('1-11c.bin');
const fg = z.read('1-3d.bin');
const bg = cat(z.read('2-2a.bin'), z.read('2-3a.bin'), z.read('2-4a.bin'), z.read('2-5a.bin'), z.read('2-6a.bin'), z.read('2-7a.bin'));
const obj = cat(z.read('2-2n.bin'), z.read('2-3n.bin'), z.read('2-4n.bin'), z.read('2-5n.bin'));
const red = z.read('e8.bin');
const green = z.read('e9.bin');
const blue = z.read('e10.bin');
const fgcolor = z.read('d1.bin');
const bgcolor = z.read('c9.bin');
const objcolor = z.read('j2.bin');

const rom = cat(prg1, prg2, fg, bg, obj, red, green, blue, fgcolor, bgcolor, objcolor);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
