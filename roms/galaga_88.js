/*
 *	Galaga '88
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
const snd = cat(z.read('g81_s0.bin'), z.read('g81_s1.bin'));
const prg = cat(z.read('g81_p0.bin'), z.read('g81_p1.bin'), z.read('g81_p5.bin'), z.read('galaga88j/g81_p6.bin'), z.read('galaga88j/g81_p7.bin'));
const mcu = z.read('cus64-64a1.mcu');
let voi = cat(z.read('g81_v0.bin'), z.read('g81_v0.bin'), z.read('g81_v1.bin'), z.read('g81_v1.bin'), z.read('g81_v2.bin'), z.read('g81_v2.bin'));
voi = cat(voi, z.read('g81_v3.bin'), z.read('g81_v3.bin'), z.read('g81_v4.bin'), z.read('g81_v4.bin'), z.read('g81_v5.bin'), z.read('g81_v5.bin'));
const chr8 = z.read('g8_chr-8.bin');
const chr = cat(z.read('g8_chr-0.bin'), z.read('g8_chr-1.bin'), z.read('g8_chr-2.bin'), z.read('g8_chr-3.bin'));
const obj = cat(z.read('g8_obj-0.bin'), z.read('g8_obj-1.bin'), z.read('g8_obj-2.bin'), z.read('g8_obj-3.bin'), z.read('g8_obj-4.bin'), z.read('g8_obj-5.bin'));

const rom = cat(snd, prg, mcu, voi, chr8, chr, obj);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
