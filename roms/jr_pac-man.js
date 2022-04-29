/*
 *	Jr. Pac-Man
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
const prg = cat(z.read('jrp8d.8d'), z.read('jrp8e.8e'), z.read('jrp8h.8h'), z.read('jrp8j.8j'), z.read('jrp8k.8k'));
const bg = z.read('jrp2c.2c');
const obj = z.read('jrp2e.2e');
const rgb_l = z.read('a290-27axv-bxhd.9e');
const rgb_h = z.read('a290-27axv-cxhd.9f');
const color = z.read('a290-27axv-axhd.9p');
const snd = z.read('a290-27axv-dxhd.7p');

const rom = cat(prg, bg, obj, rgb_l, rgb_h, color, snd);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
