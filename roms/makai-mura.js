/*
 *	Makai-Mura
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
const prg1 = cat(z.read('makaimur/10n.rom'), z.read('makaimur/8n.rom'), z.read('makaimur/12n.rom'));
const prg2 = z.read('gg2.bin');
const fg = z.read('gg1.bin');
const bg = cat(z.read('gg11.bin'), z.read('gg10.bin'), z.read('gg9.bin'), z.read('gg8.bin'), z.read('gg7.bin'), z.read('gg6.bin'));
const obj = cat(z.read('gngbl/19.84472.4n'), z.read('gg16.bin'), z.read('gg15.bin'), pad(0x4000), z.read('gngbl/16.84472.4l'), z.read('gg13.bin'), z.read('gg12.bin'), pad(0x4000));

const rom = cat(prg1, prg2, fg, bg, obj);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
