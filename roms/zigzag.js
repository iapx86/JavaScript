/*
 *	Zig Zag
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
const prg = cat(z.read('zz_d1.7l'), z.read('zz_d2.7k'), z.read('zz_d4.7f'), z.read('zz_d3.7h'));
const bg = cat(z.read('zz_6.1h').subarray(0, 0x800), z.read('zz_5.1k').subarray(0, 0x800));
const obj = cat(z.read('zz_6.1h').subarray(0x800), z.read('zz_5.1k').subarray(0x800));
const rgb = z.read('zzbpr_e9.bin');

const rom = cat(prg, bg, obj, rgb);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
