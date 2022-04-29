/*
 *	Cue Brick
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
const prg1 = merge(cat(z.read('cuebrickj/903_e05.6n'), z.read('cuebrickj/903_e09.6r')), cat(z.read('cuebrickj/903_e04.4n'), z.read('cuebrickj/903_e08.4r')));
const prg2 = merge(cat(z.read('cuebrickj/903_d07.10n'), z.read('cuebrickj/903_e13.10s')), cat(z.read('cuebrickj/903_d06.8n'), z.read('cuebrickj/903_e12.8s')));
const prg3 = z.read('cuebrickj/903_d03.10a');
const bg = z.read('cuebrickj/903_e14.d8');
const data = merge(z.read('cuebrickj/903_e11.10r'), z.read('cuebrickj/903_e10.8r'));

const rom = cat(prg1, prg2, prg3, bg, data);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
