/*
 *	Dragon Spirit
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
const snd = cat(z.read('ds1_s0.bin'), z.read('ds1_s1.bin'));
const prg = cat(z.read('ds1_p0.bin'), z.read('ds1_p1.bin'), z.read('ds1_p2.bin'), z.read('ds1_p3.bin'), z.read('ds1_p4.bin'), z.read('ds1_p5.bin'), z.read('ds3_p6.bin'), z.read('ds3_p7.bin'));
const mcu = z.read('cus64-64a1.mcu');
const voi = cat(z.read('ds1_v0.bin'), z.read('ds1_v0.bin'), z.read('ds_voi-1.bin'), z.read('ds_voi-2.bin'), z.read('ds_voi-3.bin'), z.read('ds_voi-4.bin'));
const chr8 = z.read('ds_chr-8.bin');
const chr = cat(z.read('ds_chr-0.bin'), z.read('ds_chr-1.bin'), z.read('ds_chr-2.bin'), z.read('ds_chr-3.bin'), z.read('ds_chr-4.bin'), z.read('ds_chr-5.bin'), z.read('ds_chr-6.bin'), z.read('ds_chr-7.bin'));
const obj = cat(z.read('ds_obj-0.bin'), z.read('ds_obj-1.bin'), z.read('ds_obj-2.bin'), z.read('ds_obj-3.bin'), z.read('ds1_o4.bin'), z.read('ds1_o4.bin'));

const rom = cat(snd, prg, mcu, voi, chr8, chr, obj);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
