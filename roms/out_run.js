/*
 *	Out Run
 */

const fs = require('fs');
const {createCanvas, createImageData} = require('canvas');
const {Zlib} = require('zlibjs/bin/unzip.min');
Zlib.Unzip.prototype.read = Zlib.Unzip.prototype.decompress;

const cat = (...args) => {
	const array = new Uint8Array(args.reduce((a, b) => a + b.length, 0));
	return args.reduce((a, b) => (array.set(b, a), a + b.length), 0), array;
};
const pad = (length, value = 0xff) => new Uint8Array(length).fill(value);

const z = new Zlib.Unzip(fs.readFileSync(process.argv[2]));
const prg3 = z.read('epr-10187.88');
let pcm = cat(z.read('opr-10193.66'), z.read('opr-10193.66'), z.read('opr-10192.67'), z.read('opr-10192.67'), z.read('opr-10191.68'), z.read('opr-10191.68'));
pcm = cat(pcm, z.read('opr-10190.69'), z.read('opr-10190.69'), z.read('opr-10189.70'), z.read('opr-10189.70'), z.read('opr-10188.71'), z.read('opr-10188.71'), pad(0x20000));

const rom = cat(prg3, pcm);

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

fs.writeFileSync(process.argv[3], `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`);
