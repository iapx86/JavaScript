/*
 *	Ninja Princess
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
const prg1 = cat(z.read('nprincesu/epr-6573.129'), z.read('nprincesu/epr-6574.130'), z.read('nprincesu/epr-6575.131'), z.read('nprincesu/epr-6576.132'), z.read('nprinces/epr-6616.133'), z.read('nprincesu/epr-6578.134'));
const prg2 = z.read('epr-6559.120');
const bg = cat(z.read('epr-6558.62'), z.read('nprinces/epr-6557.61'), z.read('epr-6556.64'), z.read('nprinces/epr-6555.63'), z.read('epr-6554.66'), z.read('nprinces/epr-6553.65'));
const obj = cat(z.read('epr-6546.117'), z.read('epr-6548.04'), z.read('epr-6547.110'), z.read('ninja/epr-6549.05'));
const pri = z.read('pr-5317.76');

const rom = cat(prg1, prg2, bg, obj, pri);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
