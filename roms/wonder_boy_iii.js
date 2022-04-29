/*
 *	Wonder Boy III
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
const prg1 = merge(cat(z.read('wb31/epr-12084.bin'), z.read('wb31/epr-12085.bin')), cat(z.read('wb31/epr-12082.bin'), z.read('wb31/epr-12083.bin')));
const key = z.read('wb31/317-0084.key');
const bg = cat(z.read('wb31/epr-12086.bin'), z.read('wb31/epr-12087.bin'), z.read('wb31/epr-12088.bin'));
let obj = merge(cat(z.read('epr-12094.b5').subarray(0, 0x8000), z.read('epr-12095.b6').subarray(0, 0x8000)), cat(z.read('epr-12090.b1').subarray(0, 0x8000), z.read('epr-12091.b2').subarray(0, 0x8000)));
obj = cat(obj, merge(cat(z.read('epr-12096.b7').subarray(0, 0x8000), z.read('epr-12097.b8').subarray(0, 0x8000)), cat(z.read('epr-12092.b3').subarray(0, 0x8000), z.read('epr-12093.b4').subarray(0, 0x8000))));
obj = cat(obj, merge(cat(z.read('epr-12094.b5').subarray(0x8000), z.read('epr-12095.b6').subarray(0x8000)), cat(z.read('epr-12090.b1').subarray(0x8000), z.read('epr-12091.b2').subarray(0x8000))));
obj = cat(obj, merge(cat(z.read('epr-12096.b7').subarray(0x8000), z.read('epr-12097.b8').subarray(0x8000)), cat(z.read('epr-12092.b3').subarray(0x8000), z.read('epr-12093.b4').subarray(0x8000))));
const prg2 = z.read('wb31/epr-12089.bin');

const rom = cat(prg1, key, bg, obj, prg2);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
