/*
 *	Chack'n Pop
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
const prg1 = cat(z.read('ao4_01.ic28'), z.read('ao4_02.ic27'), z.read('ao4_03.ic26'), z.read('ao4_04.ic25'), z.read('ao4_05.ic3'));
const prg2 = z.read('ao4_06.ic23');
const obj = cat(z.read('ao4_08.ic14'), z.read('ao4_07.ic15'));
const bg = cat(z.read('ao4_09.ic98'), z.read('ao4_10.ic97'));
const rgb_l = z.read('ao4-11.ic96');
const rgb_h = z.read('ao4-12.ic95');

const rom = cat(prg1, prg2, obj, bg, rgb_l, rgb_h);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
