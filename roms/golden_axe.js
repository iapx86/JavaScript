/*
 *	Golden Axe
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
const pad = (length, value = 0xff) => new Uint8Array(length).fill(value);

const z = new Zlib.Unzip(fs.readFileSync(process.argv[2]));
const prg1 = merge(cat(z.read('goldnaxej/epr-12540.a7'), z.read('goldnaxe2/epr-12521.a8')), cat(z.read('goldnaxej/epr-12539.a5'), z.read('goldnaxe2/epr-12519.a6')));
const key = z.read('goldnaxej/317-0121.key');
const bg = cat(z.read('epr-12385.ic19'), z.read('epr-12386.ic20'), z.read('epr-12387.ic21'));
let obj = merge(cat(z.read('mpr-12379.ic12').subarray(0, 0x20000), z.read('mpr-12381.ic13').subarray(0, 0x20000)), cat(z.read('mpr-12378.ic9').subarray(0, 0x20000), z.read('mpr-12380.ic10').subarray(0, 0x20000)));
obj = cat(obj, merge(z.read('mpr-12383.ic14').subarray(0, 0x20000), z.read('mpr-12382.ic11').subarray(0,0x20000)), pad(0x40000));
obj = cat(obj, merge(cat(z.read('mpr-12379.ic12').subarray(0x20000), z.read('mpr-12381.ic13').subarray(0x20000)), cat(z.read('mpr-12378.ic9').subarray(0x20000), z.read('mpr-12380.ic10').subarray(0x20000))));
obj = cat(obj, merge(z.read('mpr-12383.ic14').subarray(0x20000), z.read('mpr-12382.ic11').subarray(0x20000)), pad(0x40000));
const prg2 = cat(z.read('epr-12390.ic8'), z.read('mpr-12384.ic6'));

const rom = cat(prg1, key, bg, obj, prg2);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
