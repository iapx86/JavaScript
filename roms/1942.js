/*
 *	1942
 */

const fs = require('fs');
const {createCanvas, createImageData} = require('canvas');
const {Zlib} = require('zlibjs/bin/unzip.min');
Zlib.Unzip.prototype.read = Zlib.Unzip.prototype.decompress;

const cat = (...args) => {
	const array = new Uint8Array(args.reduce((a, b) => a + b.length, 0));
	return args.reduce((a, b) => (array.set(b, a), a + b.length), 0), array;
};
const pad = (length, value = 0xff) => new Uint8Array(length).fill(value);

const z = new Zlib.Unzip(fs.readFileSync(process.argv[2]));
const prg1 = cat(z.read('srb-03.m3'), z.read('srb-04.m4'), z.read('srb-05.m5'), z.read('srb-06.m6'), pad(0x2000), z.read('srb-07.m7'), pad(0x4000));
const prg2 = z.read('sr-01.c11');
const fg = z.read('sr-02.f2');
const bg = cat(z.read('sr-08.a1'), z.read('sr-09.a2'), z.read('sr-10.a3'), z.read('sr-11.a4'), z.read('sr-12.a5'), z.read('sr-13.a6'));
const obj = cat(z.read('sr-14.l1'), z.read('sr-15.l2'), z.read('sr-16.n1'), z.read('sr-17.n2'));
const red = z.read('sb-5.e8');
const green = z.read('sb-6.e9');
const blue = z.read('sb-7.e10');
const fgcolor = z.read('sb-0.f1');
const bgcolor = z.read('sb-4.d6');
const objcolor = z.read('sb-8.k3');

const rom = cat(prg1, prg2, fg, bg, obj, red, green, blue, fgcolor, bgcolor, objcolor);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
