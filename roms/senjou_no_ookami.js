/*
 *	Senjou no Ookami
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
const prg1 = cat(z.read('commandoj/so04.9m'), z.read('commandoj/so03.8m'));
const prg2 = z.read('commandob2/8,so02.9f');
const fg = z.read('vt01.5d');
const bg = cat(z.read('vt11.5a'), z.read('vt12.6a'), z.read('vt13.7a'), z.read('vt14.8a'), z.read('vt15.9a'), z.read('vt16.10a'));
const obj = cat(z.read('vt05.7e'), z.read('vt06.8e'), z.read('vt07.9e'), pad(0x4000), z.read('vt08.7h'), z.read('vt09.8h'), z.read('vt10.9h'), pad(0x4000));
const red = z.read('vtb1.1d');
const green = z.read('vtb2.2d');
const blue = z.read('vtb3.3d');

const rom = cat(prg1, prg2, fg, bg, obj, red, green, blue);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
