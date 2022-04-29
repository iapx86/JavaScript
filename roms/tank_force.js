/*
 *	Tank Force
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
const snd = z.read('tf1_snd0.bin');
const prg = cat(z.read('tf1_prg0.bin'), z.read('tf1_prg1.bin'), z.read('tankfrcej/tf1_prg7.bin'));
const mcu = z.read('cus64-64a1.mcu');
const voi = cat(z.read('tf1_voi0.bin'), z.read('tf1_voi1.bin'));
const chr8 = z.read('tf1_chr8.bin');
const chr = cat(z.read('tf1_chr0.bin'), z.read('tf1_chr1.bin'), z.read('tf1_chr2.bin'), z.read('tf1_chr3.bin'), z.read('tf1_chr4.bin'), z.read('tf1_chr5.bin'));
const obj = cat(z.read('tf1_obj0.bin'), z.read('tf1_obj1.bin'));

const rom = cat(snd, prg, mcu, voi, chr8, chr, obj);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
