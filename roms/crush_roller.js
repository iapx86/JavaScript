/*
 *	Crush Roller
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
const prg = cat(z.read('crush2/tp1'), z.read('crush2/tp5a'), z.read('crush2/tp2'), z.read('crush2/tp6'), z.read('crush2/tp3'), z.read('crush2/tp7'), z.read('crush2/tp4'), z.read('crush2/tp8'));
const bg = cat(z.read('crush2/tpa'), z.read('crush2/tpc'));
const obj = cat(z.read('crush2/tpb'), z.read('crush2/tpd'));
const rgb = z.read('82s123.7f');
const color = z.read('2s140.4a');
const snd = z.read('82s126.1m');

const rom = cat(prg, bg, obj, rgb, color, snd);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
