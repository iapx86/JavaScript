/*
 *	New Rally-X
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
let prg = cat(z.read('nrx_prg1.1d').subarray(0, 0x800), z.read('nrx_prg2.1e').subarray(0, 0x800), z.read('nrx_prg1.1d').subarray(0x800), z.read('nrx_prg2.1e').subarray(0x800));
prg = cat(prg, z.read('nrx_prg3.1k').subarray(0, 0x800), z.read('nrx_prg4.1l').subarray(0, 0x800), z.read('nrx_prg3.1k').subarray(0x800), z.read('nrx_prg4.1l').subarray(0x800));
const bgobj = cat(z.read('nrx_chg1.8e'), z.read('nrx_chg2.8d'));
const rgb = z.read('nrx1-1.11n');
const color = z.read('nrx1-7.8p');
const snd = z.read('rx1-5.3p');

const rom = cat(prg, bgobj, rgb, color, snd);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
