/*
 *	Baraduke
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
const prg1 = cat(z.read('bd1_3.9c'), z.read('baraduke/bd1_1.9a'), z.read('baraduke/bd1_2.9b'));
const prg2 = z.read('baraduke/bd1_4b.3b');
const prg2i = z.read('cus60-60a1.mcu');
const fg = z.read('bd1_5.3j');
const bg = cat(z.read('baraduke/bd1_8.4p'), z.read('bd1_7.4n'), z.read('baraduke/bd1_6.4m'));
const obj = cat(z.read('bd1_9.8k'), z.read('bd1_10.8l'), z.read('bd1_11.8m'), z.read('bd1_12.8n'));
const green = z.read('bd1-1.1n');
const red = z.read('bd1-2.2m');

const rom = cat(prg1, prg2, prg2i, fg, bg, obj, green, red);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
