/*
 *	Wonder Boy
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
const prg1 = cat(z.read('wboy2/epr-7587.129'), z.read('wboy2/epr-7588.130'), z.read('wboy2/epr-7589.131'), z.read('wboy2/epr-7590.132'), z.read('wboy2/epr-7591.133'), z.read('wboy2/epr-7592.134'));
const prg2 = z.read('epr-7498.120');
const bg = cat(z.read('epr-7497.62'), z.read('epr-7496.61'), z.read('epr-7495.64'), z.read('epr-7494.63'), z.read('epr-7493.66'), z.read('epr-7492.65'));
const obj = cat(z.read('epr-7485.117'), z.read('epr-7487.04'), z.read('epr-7486.110'), z.read('epr-7488.05'));
const pri = cat(z.read('pr-5317.76'));

const rom = cat(prg1, prg2, bg, obj, pri);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
