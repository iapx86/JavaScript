/*
 *	Wonder Momo
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
const prg1 = cat(z.read('wm1_16.f1'), z.read('wm1_1.9c'));
const prg2 = z.read('wm1_2.12c');
const bg1 = cat(z.read('wm1_6.7r'), z.read('wm1_7.7s'));
const bg2 = cat(z.read('wm1_4.4r'), z.read('wm1_5.4s'));
const obj = cat(z.read('wm1_8.12h'), z.read('wm1_9.12k'), z.read('wm1_10.12l'), z.read('wm1_11.12m'), z.read('wm1_12.12p'), z.read('wm1_13.12r'), z.read('wm1_14.12t'), z.read('wm1_15.12u'));
const red = z.read('wm1-1.3r');
const blue = z.read('wm1-2.3s');
const bgcolor = z.read('wm1-3.4v');
const objcolor = z.read('wm1-4.5v');
const bgaddr = z.read('wm1-5.6u');
const prg3 = z.read('wm1_3.6b');
const prg3i = z.read('cus60-60a1.mcu');
const pcm = cat(z.read('wm1_17.f3'), z.read('wm1_17.f3'), z.read('wm1_18.h3'), z.read('wm1_18.h3'), z.read('wm1_19.k3'), z.read('wm1_19.k3'), z.read('wm1_20.m3'), z.read('wm1_20.m3'));

const rom = cat(prg1, prg2, bg1, bg2, obj, red, blue, bgcolor, objcolor, bgaddr, prg3, prg3i, pcm);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
