/*
 *	The NewZealand Story
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
const prg1 = z.read('b53-24.u1');
const prg2 = z.read('tnzsj/b53-27.u3');
const prg3 = z.read('b53-26.u34');
const gfx = cat(z.read('b53-16.ic7'), z.read('b53-17.ic8'), z.read('b53-18.ic9'), z.read('b53-19.ic10'), z.read('b53-22.ic11'), z.read('b53-23.ic13'), z.read('b53-20.ic12'), z.read('b53-21.ic14'));

const rom = cat(prg1, prg2, prg3, gfx);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
