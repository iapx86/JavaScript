/*
 *	Elevator Action
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
const prg1 = cat(z.read('ba3__01.2764.ic1'), z.read('ba3__02.2764.ic2'), z.read('ba3__03-1.2764.ic3'), z.read('ba3__04-1.2764.ic6'));
const prg2 = cat(z.read('ba3__09.2732.ic70'), z.read('ba3__10.2732.ic71'));
const prg3 = z.read('ba3__11.mc68705p3.ic24');
const gfx = cat(z.read('ba3__05.2764.ic4'), z.read('ba3__06.2764.ic5'), z.read('ba3__07.2764.ic9'), z.read('ba3__08.2764.ic10'));
const pri = z.read('eb16.ic22');

const rom = cat(prg1, prg2, prg3, gfx, pri);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
