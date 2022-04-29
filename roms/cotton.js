/*
 *	Cotton
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
const prg1 = merge(cat(z.read('cottonj/epr-13858b.a7'), z.read('cottonj/epr-13859b.a8')), cat(z.read('cottonj/epr-13856b.a5'), z.read('cottonj/epr-13857b.a6')));
const key = z.read('cottonj/317-0179b.key');
const bg = cat(z.read('opr-13862.a14'), z.read('opr-13877.b14'), z.read('opr-13863.a15'), z.read('opr-13878.b15'), z.read('opr-13864.a16'), z.read('opr-13879.b16'));
let obj = merge(cat(z.read('opr-13869.b5'), z.read('opr-13870.b6'), z.read('opr-13871.b7'), z.read('opr-13872.b8')), cat(z.read('opr-13865.b1'), z.read('opr-13866.b2'), z.read('opr-13867.b3'), z.read('opr-13868.b4')));
obj = cat(obj, merge(cat(z.read('opr-13873.b10'), z.read('opr-13874.b11'), z.read('cottonj/opr-13875.b12'), z.read('opr-13876.b13')), cat(z.read('opr-13852.a1'), z.read('opr-13853.a2'), z.read('cottonj/opr-13854.a3'), z.read('opr-13855.a4'))));
const prg2 = cat(z.read('cottonj/epr-13860.a10'), z.read('cottonj/opr-13061.a11'));

const rom = cat(prg1, key, bg, obj, prg2);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
