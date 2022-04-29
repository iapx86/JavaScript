/*
 *	Time Tunnel
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
const prg1 = cat(z.read('un01.69'), z.read('un02.68'), z.read('un03.67'), z.read('un04.66'), z.read('un05.65'), z.read('un06.64'), z.read('un07.55'), z.read('un08.54'), z.read('un09.53'), z.read('un10.52'));
const prg2 = z.read('un19.70');
const gfx = cat(z.read('un11.1'), z.read('un12.2'), z.read('un13.3'), z.read('un14.4'), z.read('un15.5'), z.read('un16.6'), z.read('un17.7'), z.read('un18.8'));
const pri = z.read('eb16.22');

const rom = cat(prg1, prg2, gfx, pri);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
