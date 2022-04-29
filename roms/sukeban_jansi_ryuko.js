/*
 *	Sukeban Jansi Ryuko
 */

const fs = require('fs');
const {createCanvas, createImageData} = require('canvas');
const {Zlib} = require('zlibjs/bin/unzip.min');
Zlib.Unzip.prototype.read = Zlib.Unzip.prototype.decompress;

const cat = (...args) => {
	const array = new Uint8Array(args.reduce((a, b) => a + b.length, 0));
	return args.reduce((a, b) => (array.set(b, a), a + b.length), 0), array;
};
const merge = (...args) => {
	const array = new Uint8Array(args.reduce((a, b) => a + b.length, 0)), step = args.length;
	return args.forEach((a, i) => a.forEach((e, j) => array[j * step + i] = e)), array;
};

const z = new Zlib.Unzip(fs.readFileSync(process.argv[2]));
const prg1 = merge(cat(z.read('sjryuko1/epr-12251.43'), z.read('sjryuko1/epr-12252.42')), cat(z.read('sjryuko1/epr-12249.26'), z.read('sjryuko1/epr-12250.25')));
const bg = cat(z.read('epr-12224-95.b9'), z.read('epr-12225-94.b10'), z.read('epr-12226-93.b11'));
let obj = merge(cat(z.read('epr-12236-11.b5').subarray(0, 0x8000), z.read('epr-12237-18.b6').subarray(0, 0x8000)), cat(z.read('epr-12232-10.b1').subarray(0, 0x8000), z.read('epr-12233-17.b2').subarray(0, 0x8000)));
obj = cat(obj, merge(cat(z.read('epr-12238-24.b7').subarray(0, 0x8000), z.read('epr-12239-30.b8').subarray(0, 0x8000)), cat(z.read('epr-12234-23.b3').subarray(0, 0x8000), z.read('epr-12235-29.b4').subarray(0, 0x8000))));
obj = cat(obj, merge(cat(z.read('epr-12236-11.b5').subarray(0x8000), z.read('epr-12237-18.b6').subarray(0x8000)), cat(z.read('epr-12232-10.b1').subarray(0x8000), z.read('epr-12233-17.b2').subarray(0x8000))));
obj = cat(obj, merge(cat(z.read('epr-12238-24.b7').subarray(0x8000), z.read('epr-12239-30.b8').subarray(0x8000)), cat(z.read('epr-12234-23.b3').subarray(0x8000), z.read('epr-12235-29.b4').subarray(0x8000))));
const prg2 = z.read('sjryuko1/epr-12227.12');
const mcu = z.read('sjryuko1/7751.bin');
const voi = cat(z.read('sjryuko1/epr-12228.1'), z.read('sjryuko1/epr-12229.2'), z.read('sjryuko1/epr-12230.4'), z.read('sjryuko1/epr-12231.5'));
const key = z.read('317-5021.key');

const rom = cat(prg1, bg, obj, prg2, mcu, voi, key);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
