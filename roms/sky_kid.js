/*
 *	Sky Kid
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
const prg1 = cat(z.read('sk2_2.6c'), z.read('sk1-1c.6b'), z.read('sk1_3.6d'));
const prg2 = z.read('sk2_4.3c');
const prg2i = z.read('cus63-63a1.mcu');
const fg = z.read('sk1_6.6l');
const bg = z.read('sk1_5.7e');
const obj = cat(z.read('sk1_8.10n'), z.read('sk1_7.10m'));
const red = z.read('sk1-1.2n');
const green = z.read('sk1-2.2p');
const blue = z.read('sk1-3.2r');
const bgcolor = z.read('sk1-4.5n');
const objcolor = z.read('sk1-5.6n');

const rom = cat(prg1, prg2, prg2i, fg, bg, obj, red, green, blue, bgcolor, objcolor);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
