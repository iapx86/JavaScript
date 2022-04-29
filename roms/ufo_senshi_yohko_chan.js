/*
 *	Ufo Senshi Yohko Chan
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
const prg1 = cat(z.read('epr-11661.90'), z.read('epr-11662.91'), z.read('epr-11663.92'));
const key = z.read('317-0064.key');
const prg2 = z.read('epr-11667.126');
const bg = cat(z.read('epr-11664.4'), z.read('epr-11665.5'), z.read('epr-11666.6'));
const obj = cat(z.read('epr-11658.87'), z.read('epr-11657.86'), z.read('epr-11660.89'), z.read('epr-11659.88'));
const red = z.read('pr11656.20');
const green = z.read('pr11655.14');
const blue = z.read('pr11654.8');
const pri = z.read('pr5317.28');

const rom = cat(prg1, key, prg2, bg, obj, red, green, blue, pri);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
