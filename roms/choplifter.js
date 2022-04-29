/*
 *	Choplifter
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
const prg1 = cat(z.read('chopliftu/epr-7152.ic90'), z.read('chopliftu/epr-7153.ic91'), z.read('chopliftu/epr-7154.ic92'));
const prg2 = z.read('epr-7130.ic126');
const bg = cat(z.read('epr-7127.ic4'), z.read('epr-7128.ic5'), z.read('epr-7129.ic6'));
const obj = cat(z.read('epr-7121.ic87'), z.read('epr-7120.ic86'), z.read('epr-7123.ic89'), z.read('epr-7122.ic88'));
const red = z.read('pr7119.ic20');
const green = z.read('pr7118.ic14');
const blue = z.read('pr7117.ic8');
const pri = z.read('pr5317.ic28');

const rom = cat(prg1, prg2, bg, obj, red, green, blue, pri);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
