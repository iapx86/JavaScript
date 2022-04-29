/*
 *	Pengo
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
const prg = cat(z.read('epr-1689c.ic8'), z.read('epr-1690b.ic7'), z.read('epr-1691b.ic15'), z.read('epr-1692b.ic14'), z.read('epr-1693b.ic21'), z.read('epr-1694b.ic20'), z.read('epr-5118b.ic32'), z.read('epr-5119c.ic31'));
const bg = cat(z.read('epr-1640.ic92').subarray(0, 0x1000), z.read('epr-1695.ic105').subarray(0, 0x1000));
const obj = cat(z.read('epr-1640.ic92').subarray(0x1000), z.read('epr-1695.ic105').subarray(0x1000));
const rgb = z.read('pr1633.ic78');
const color = z.read('pr1634.ic88');
const snd = z.read('pr1635.ic51');

const rom = cat(prg, bg, obj, rgb, color, snd);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
