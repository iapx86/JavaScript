/*
 *	Flicky
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
const prg1 = cat(z.read('flickyo/epr-5857.bin'), z.read('flickyo/epr-5858a.bin'), z.read('flickyo/epr-5859.bin'), z.read('flickyo/epr-5860.bin'));
const prg2 = z.read('epr-5869.120');
const bg = cat(z.read('epr-5868.62'), z.read('epr-5867.61'), z.read('epr-5866.64'), z.read('epr-5865.63'), z.read('epr-5864.66'), z.read('epr-5863.65'));
const obj = cat(z.read('epr-5855.117'), z.read('epr-5856.110'));
const pri = z.read('pr-5317.76');

const rom = cat(prg1, prg2, bg, obj, pri);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
