/*
 *	X68000
 */

const fs = require('fs');
const path = require('path');
const {createCanvas, createImageData} = require('canvas');
const {Zlib} = require('zlibjs/bin/unzip.min');
Zlib.Unzip.prototype.read = Zlib.Unzip.prototype.decompress;

const cat = (...args) => {
	const array = new Uint8Array(args.reduce((a, b) => a + b.length, 0));
	return args.reduce((a, b) => (array.set(b, a), a + b.length), 0), array;
};

const z = new Zlib.Unzip(fs.readFileSync(process.argv[2]));
const rom = cat(z.read('cgrom.dat'), z.read('iplrom.dat'));

const pngString = array => {
	const w = 1024, h = Math.ceil(array.byteLength / w), canvas = createCanvas(w, h);
	const palette = new Uint8ClampedArray(new Uint32Array(256).map((e, i) => i | 0xff000000).buffer);
	canvas.getContext('2d', {pixelFormat: 'A8'}).putImageData(createImageData(new Uint8ClampedArray(array.buffer), w, h), 0, 0);
	return Buffer.from(canvas.toBuffer('image/png', {compressionLevel: 9, filters: canvas.PNG_FILTER_NONE, palette})).toString('base64');
};

let str = `export const ROM = 'data:image/png;base64,${pngString(rom)}';\n`;
for(let i = 3; i < process.argv.length - 1; i++)
	if (path.extname(process.argv[i]) === '.d88') {
		const disk = fs.readFileSync(process.argv[i]), view = new DataView(disk.buffer), out = new Uint8Array(164 * 8192);
		let track = 0;
		for (let p; track < 164 && (p = view.getInt32(0x20 + track * 4, true)) >= 0x2b0 && p < disk.length; track++)
			for (let nsec = view.getUint16(p + 4, true), sector, size, i = 0; i < nsec; p += 0x10 + size, i++)
				sector = disk[p + 2] - 1, size = view.getUint16(p + 0xe, true), out.set(disk.subarray(p + 0x10, p + 0x10 + size), track * 8192 + sector * size);
		str += `export const DISK${i - 2} = 'data:image/png;base64,${pngString(out.subarray(0, track * 8192))}';\n`;
	} else
		str += `export const DISK${i - 2} = 'data:image/png;base64,${pngString(fs.readFileSync(process.argv[i]))}';\n`;
fs.writeFileSync(process.argv[process.argv.length - 1], str);
