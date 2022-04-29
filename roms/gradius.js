/*
 *	Gradius
 */

const fs = require('fs');
const {createCanvas, createImageData} = require('canvas');
const {Zlib} = require('zlibjs/bin/unzip.min');
Zlib.Unzip.prototype.read = Zlib.Unzip.prototype.decompress;

const cat = (...args) => {
	const array = new Uint8Array(args.reduce((a, b) => a + b.length, 0));
	return args.reduce((a, b) => (array.set(b, a), a + b.length), 0), array;
};
const merge = (...args) => {
	const array = new Uint8Array(args.reduce((a, b) => a + b.length, 0)), step = args.length;
	return args.forEach((a, i) => a.forEach((e, j) => array[j * step + i] = e)), array;
};

const z = new Zlib.Unzip(fs.readFileSync(process.argv[2]));
const prg1 = merge(cat(z.read('gradius/400-a06.15l'), z.read('gradius/456-a07.17l')), cat(z.read('gradius/400-a04.10l'), z.read('gradius/456-a05.12l')));
const prg2 = z.read('gradius/400-e03.5l');
const snd = cat(z.read('400-a01.fse'), z.read('400-a02.fse'));

const rom = cat(prg1, prg2, snd);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
