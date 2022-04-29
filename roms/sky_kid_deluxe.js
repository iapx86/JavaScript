/*
 *	Sky Kid Deluxe
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
const prg1 = cat(z.read('sk3_2.9d'), z.read('sk3_1b.9c'));
const prg2 = z.read('sk3_3.12c');
const bg1 = cat(z.read('sk3_9.7r'), z.read('sk3_10.7s'));
const bg2 = cat(z.read('sk3_7.4r'), z.read('sk3_8.4s'));
const obj = cat(z.read('sk3_5.12h'), z.read('sk3_6.12k'));
const red = z.read('sk3-1.3r');
const blue = z.read('sk3-2.3s');
const bgcolor = z.read('sk3-3.4v');
const objcolor = z.read('sk3-4.5v');
const bgaddr = z.read('sk3-5.6u');
const prg3 = z.read('sk3_4.6b');
const prg3i = z.read('cus60-60a1.mcu');

const rom = cat(prg1, prg2, bg1, bg2, obj, red, blue, bgcolor, objcolor, bgaddr, prg3, prg3i);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
