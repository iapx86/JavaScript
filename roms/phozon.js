/*
 *	Phozon
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
const prg1 = cat(z.read('6e.rom'), z.read('6h.rom'), z.read('6c.rom'), z.read('6d.rom'));
const prg2 = z.read('3b.rom');
const prg3 = z.read('9r.rom');
const bg = cat(z.read('7j.rom'), z.read('8j.rom'));
const obj = z.read('5t.rom');
const red = z.read('red.prm');
const green = z.read('green.prm');
const blue = z.read('blue.prm');
const bgcolor = z.read('chr.prm');
const objcolor = z.read('sprite.prm');
const snd = z.read('sound.prm');

const rom = cat(prg1, prg2, prg3, bg, obj, red, green, blue, bgcolor, objcolor, snd);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
