/*
 *	Bosconian
 */

const fs = require('fs');
const {createCanvas, createImageData} = require('canvas');
const {Zlib} = require('zlibjs/bin/unzip.min');
Zlib.Unzip.prototype.read = Zlib.Unzip.prototype.decompress;

const cat = (...args) => {
	const array = new Uint8Array(args.reduce((a, b) => a + b.length, 0));
	return args.reduce((a, b) => (array.set(b, a), a + b.length), 0), array;
};

let z = new Zlib.Unzip(fs.readFileSync(process.argv[2]));
const prg1 = cat(z.read('bos3_1.3n'), z.read('bos1_2.3m'), z.read('bos1_3.3l'), z.read('bos1_4b.3k'));
const prg2 = cat(z.read('bos1_5c.3j'), z.read('bos3_6.3h'));
const prg3 = z.read('bos1_7.3e');
const bg = z.read('bos1_14.5d');
const obj = z.read('bos1_13.5e');
const rgb = z.read('bos1-6.6b');
const bgcolor = z.read('bos1-5.4m');
const snd = z.read('bos1-1.1d');
const voi = cat(z.read('bos1_9.5n'), z.read('bos1_10.5m'), z.read('bos1_11.5k'));
z = new Zlib.Unzip(fs.readFileSync(process.argv[3]));
const key = z.read('50xx.bin');
z = new Zlib.Unzip(fs.readFileSync(process.argv[4]));
const io = z.read('51xx.bin');
z = new Zlib.Unzip(fs.readFileSync(process.argv[5]));
const prg = z.read('54xx.bin');

const rom = cat(prg1, prg2, prg3, bg, obj, rgb, bgcolor, snd, voi, key, io, prg);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[6], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
