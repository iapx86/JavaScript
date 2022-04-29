/*
 *	Scramble
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
const prg1 = cat(z.read('s1.2d'), z.read('s2.2e'), z.read('s3.2f'), z.read('s4.2h'), z.read('s5.2j'), z.read('s6.2l'), z.read('s7.2m'), z.read('s8.2p'));
const prg2 = cat(z.read('ot1.5c'), z.read('ot2.5d'), z.read('ot3.5e'));
const bg = cat(z.read('c2.5f'), z.read('c1.5h'));
const rgb = z.read('c01s.6e');

const rom = cat(prg1, prg2, bg, rgb);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
