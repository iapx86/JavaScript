/*
 *	MC68000 disassembler
 */

const {readFileSync, writeFileSync} = require('fs');
const {basename} = require('path');
const {BasicParser} = require('posix-getopt');

const buffer = new Uint8Array(0x1000000), view = new DataView(buffer.buffer);
const jumplabel = new Array(buffer.length).fill(false), label = new Array(buffer.length).fill(false);
let location = 0, flags = '';

const char = s => s.charCodeAt(0);
const b16 = n => Number(n).toString(2).padStart(16, '0');
const x2 = n => Number(n).toString(16).padStart(2, '0');
const x4 = n => Number(n).toString(16).padStart(4, '0');
const x6 = n => Number(n).toString(16).padStart(6, '0');
const x8 = n => Number(n).toString(16).padStart(8, '0');
const X2 = n => Number(n).toString(16).toUpperCase().padStart(2, '0');
const X6 = n => Number(n).toString(16).toUpperCase().padStart(6, '0');
const s8 = x => x & 0x7f | -(x & 0x80);
const s16 = x => x & 0x7fff | -(x & 0x8000);
const fetch = () => buffer[location++];
const fetch16 = () => fetch() << 8 | fetch();
const fetch32 = () => fetch16() << 16 | fetch16();

function displacement() {
	const d = s16(fetch16());
	return d < 0 ? `-$${x4(-d)}` : `$${x4(d)}`;
}

function am_relative8() {
	const ea = location + s8(buffer[location - 1]) & 0xffffff;
	return jumplabel[ea] = true, `L${x6(ea)}`;
}

function am_relative16() {
	const ea = location + s16(fetch16()) & 0xffffff;
	return flags.includes('B') ? (jumplabel[ea] = true) : (label[ea] = true), `L${x6(ea)}`;
}

function am_index(an) {
	const base = location, x = fetch16();
	if (x & 0x700)
		return '';
	let d = s8(x), rn = `${'da'[x >> 15]}${x >> 12 & 7}.${'wl'[x >> 11 & 1]}`;
	if (an === 'pc')
		return d = base + d & 0xffffff, label[d] = true, `(L${x6(d)},pc,${rn})`;
	return d < 0 ? `(-$${x2(-d)},${an},${rn})` : d ? `($${x2(d)},${an},${rn})` : `(${an},${rn})`;
}

function am_absolute16() {
	const x = s16(fetch16()), ea = x & 0xffffff;
	if (ea < start || ea > end)
		return x < 0 ? `(-$${x4(-x)})` :  `($${x4(x)})`;
	return flags.includes('B') ? (jumplabel[ea] = true) : (label[ea] = true), `(L${x6(ea)}).w`;
}

function am_absolute32() {
	const x = fetch32(), ea = x & 0xffffff;
	if (ea < start || ea > end)
		return `($${x8(x >>> 0)})${ea >= 0x8000 && ea < 0xff8000 ? '' : '.l'}`;
	return flags.includes('B') ? (jumplabel[ea] = true) : (label[ea] = true), `(L${x6(ea)})`;
}

function am_immediate8() {
	return `#$${x2(fetch16() & 0xff)}`;
}

function am_immediate16() {
	const x = fetch16(), ea = s16(x) & 0xffffff;
	if (flags.includes('P') && ea >= start && ea <= end)
		return label[ea] = true, `#L${x6(ea)}`;
	return `#$${x4(x)}`;
}

function am_immediate32() {
	const x = fetch32(), ea = x & 0xffffff;
	if (flags.includes('P') && ea >= start && ea <= end)
		return label[ea] = true, `#L${x6(ea)}`;
	return `#$${x8(x >>> 0)}`;
}

function am_decode(mod, n, size) {
	if (mod >= 12)
		return [undefined, undefined, []];
	const ea1 = [`D${n}`, `A${n}`, `(A${n})`, `(A${n})+`, `-(A${n})`, `d(A${n})`, `d(A${n},Xi)`, 'Abs.W', 'Abs.L', 'd(PC)', 'd(PC,Xi)', '#<data>'][mod];
	const ea2 = [`D${n}`, `A${n}`, `(A${n})`, `(A${n})+`, `-(A${n})`, `(%s,A${n})`, '%s', '%s', '%s', '(%s,PC)', '%s', '%s'][mod];
	const fnc_imm = {B:am_immediate8, W:am_immediate16, L:am_immediate32}[size];
	const fnc = {5:displacement, 6:() => am_index(`a${n}`), 7:am_absolute16, 8:am_absolute32, 9:am_relative16, 10:() => am_index('pc'), 11:fnc_imm}[mod];
	return [ea1, ea2, fnc ? [fnc] : []];
}

function branch16() {
	const base = location, d = s16(fetch16()), ea = base + d & 0xffffff;
	return jumplabel[ea] = true, `${d >= -0x80 && d < 0x80 ? '.w' : ''}\tL${x6(ea)}`;
}

function register_list() {
	const c = view.getUint16(location - 2), n = c & 7, mod = (c >> 3 & 7) + n * ((c >> 3 & 7) === 7);
	const mask = mod === 4 ? b16(fetch16()).split('') : b16(fetch16()).split('').reverse();
	let regs = [], start = 0, prev = '0';
	for (let [r, slice] of [['d', mask.slice(0, 8).concat('0')], ['a', mask.slice(8).concat('0')]])
		for (let [i, c] of slice.entries())
			c === '1' && prev === '0' && (start = i), c === '0' && prev === '1' && regs.push(i - start > 1 ? `${r}${start}-${r}${i - 1}` : `${r}${start}`), prev = c;
	return regs.join('/');
}

function movem() {
	const c = view.getUint16(location - 2), n = c & 7, mod = (c >> 3 & 7) + n * ((c >> 3 & 7) === 7);
	const [, ea2, fnc] = am_decode(mod, n), regs = register_list();
	return `${fnc.reduce((a, b) => a.replace('%s', b()), ea2.toLowerCase())},${regs}`;
}

const table = {
	0x4afc: ['ILLEGAL',   '',   'ILLEGAL'],
	0x4e70: ['RESET',     '',   'RESET'],
	0x4e71: ['NOP',       '',   'NOP'],
	0x4e72: ['STOP #xxx', '',   'STOP\t%s', am_immediate16],
	0x4e73: ['RTE',       'A',  'RTE'],
	0x4e75: ['RTS',       'A',  'RTS'],
	0x4e76: ['TRAPV',     '',   'TRAPV'],
	0x4e77: ['RTR',       'A',  'RTR'],
};

for (let i = 0; i < 0x1000; i++) {
	const x = i >> 9 & 7, dst = (i >> 6 & 7) + x * ((i >> 6 & 7) === 7), y = i & 7, src = (i >> 3 & 7) + y * ((i >> 3 & 7) === 7);
	if (dst >= 9 || src >= 12)
		continue;
	const [a, flg_a] = dst === 1 ? ['A', 'P'] : ['', ''];
	let src1, src2, fnc_src, dst1, dst2, fnc_dst;
	if (dst !== 1 && src !== 1) {
		[src1, src2, fnc_src] = am_decode(src, y, 'B'), [dst1, dst2, fnc_dst] = am_decode(dst, x);
		table[0x1000 | i] = [`MOVE.B ${src1},${dst1}`, '', `MOVE.B\t${src2},${dst2}`, ...fnc_src, ...fnc_dst];
	}
	[src1, src2, fnc_src] = am_decode(src, y, 'W'), [dst1, dst2, fnc_dst] = am_decode(dst, x);
	table[0x3000 | i] = [`MOVE${a}.W ${src1},${dst1}`, `${flg_a}`, `MOVE${a}.W\t${src2},${dst2}`, ...fnc_src, ...fnc_dst];
	[src1, src2, fnc_src] = am_decode(src, y, 'L'), [dst1, dst2, fnc_dst] = am_decode(dst, x);
	table[0x2000 | i] = [`MOVE${a}.L ${src1},${dst1}`, `${flg_a}`, `MOVE${a}.L\t${src2},${dst2}`, ...fnc_src, ...fnc_dst];
}
for (let i = 0; i < 0x1000; i++) {
	const x = i >> 9 & 7, op = i >> 6 & 7, y = i & 7, mod = (i >> 3 & 7) + y * ((i >> 3 & 7) === 7);
	if (mod >= [12, 12, 12, 12, 9, 9, 9, 12][op])
		continue;
	let a = op === 3 || op === 7 ? 'A' : '', size = 'BWLWBWLL'[op], [ea1, ea2, fnc] = am_decode(mod, y, size);
	[ea1, ea2] = [ea1, ea2].map(y => ({S:`${y},D${x}`, D:`D${x},${y}`, A:`${y},A${x}`}['SSSADDDA'[op]]));
	if (op !== 3 && op !== 7 && mod !== 1 && !(op >= 4 && op < 7 && mod === 0)) {
		table[0x8000 | i] = [`OR.${size} ${ea1}`, '', `OR.${size}\t${ea2}`, ...fnc];
		table[0xc000 | i] = [`AND.${size} ${ea1}`, '', `AND.${size}\t${ea2}`, ...fnc];
	}
	if (!(op === 0 && mod === 1) && !(op >= 4 && op < 7 && mod < 2)) {
		table[0x9000 | i] = [`SUB${a}.${size} ${ea1}`, '', `SUB${a}.${size}\t${ea2}`, ...fnc];
		table[0xd000 | i] = [`ADD${a}.${size} ${ea1}`, '', `ADD${a}.${size}\t${ea2}`, ...fnc];
	}
	if (!(op === 0 && mod === 1) && !(op >= 4 && op < 7))
		table[0xb000 | i] = [`CMP${a}.${size} ${ea1}`, '', `CMP${a}.${size}\t${ea2}`, ...fnc];
	if (op >= 4 && op < 7 && mod !== 1)
		table[0xb000 | i] = [`EOR.${size} ${ea1}`, '', `EOR.${size}\t${ea2}`, ...fnc];
	if ((op === 3 || op === 7) && mod !== 1) {
		const s = op === 7 ? 'S' : 'U', [ea1, ea2, fnc] = am_decode(mod, y, 'W');
		table[0x8000 | i] = [`DIV${s}.W ${ea1},D${x}`, '', `DIV${s}.W\t${ea2},D${x}`, ...fnc];
		table[0xc000 | i] = [`MUL${s}.W ${ea1},D${x}`, '', `MUL${s}.W\t${ea2},D${x}`, ...fnc];
	}
}
for (let i = 0; i < 0xc0; i++) {
	const n = i & 7, mod = (i >> 3 & 7) + n * ((i >> 3 & 7) === 7);
	if (mod === 1 || mod >= 9)
		continue;
	let size = 'BWL'[i >> 6], [ea1, ea2, fnc] = am_decode(mod, n);
	fnc = [{B:am_immediate8, W:am_immediate16, L:am_immediate32}[size], ...fnc];
	for (let [base, op] of Object.entries({0x0000:'ORI', 0x0200:'ANDI', 0x0400:'SUBI', 0x0600:'ADDI', 0x0a00:'EORI', 0x0c00:'CMPI'}))
		table[base | i] = [`${op}.${size} #<data>,${ea1}`, '', `${op}.${size}\t%s,${ea2}`, ...fnc];
}
for (let [base, op] of Object.entries({0x0000:'ORI', 0x0200:'ANDI', 0x0a00:'EORI'}))
	for (let [i, ea1] of Object.entries({0x3c:'CCR', 0x7c:'SR'})) {
		const size = 'BW'[i >> 6], fnc = [{B:am_immediate8, W:am_immediate16}[size]];
		table[base | i] = [`${op}.${size} #<data>,${ea1}`, '', `${op}.${size}\t%s,${ea1}`, ...fnc];
	}
for (let i = 0; i < 0x1000; i++) {
	let data = i >> 9 & 7, size = i >> 6 & 3, n = i & 7, mod = (i >> 3 & 7) + n * ((i >> 3 & 7) === 7);
	if (size === 3 || mod >= 9 || size === 0 && mod === 1)
		continue;
	const op = ['ADDQ', 'SUBQ'][i >> 8 & 1], [ea1, ea2, fnc] = am_decode(mod, n);
	size = 'BWL'[size], data = data ? data : 8;
	table[0x5000 | i] = [`${op}.${size} #${data},${ea1}`, '', `${op}.${size}\t#${data},${ea2}`, ...fnc];
}
for (let i = 0; i < 0x1000; i++) {
	if (i & 0x100)
		continue;
	const n = i >> 9, data = i & 0x80 ? `-$${x2(-s8(i))}` : `$${x2(s8(i))}`;
	table[0x7000 | i] = [`MOVEQ.L #${data},D${n}`, '', `MOVEQ.L\t#${data},D${n}`];
}
for (let i = 0; i < 0xc0; i++) {
	const n = i & 7, mod = (i >> 3 & 7) + n * ((i >> 3 & 7) === 7);
	if (mod === 1 || mod >= 9)
		continue;
	const size = 'BWL'[i >> 6], [ea1, ea2, fnc] = am_decode(mod, n);
	for (let [base, op] of Object.entries({0x4000:'NEGX', 0x4200:'CLR', 0x4400:'NEG', 0x4600:'NOT', 0x4a00:'TST'}))
		table[base | i] = [`${op}.${size} ${ea1}`, '', `${op}.${size}\t${ea2}`, ...fnc];
	if (size === 'B')
		table[0x4800 | i] = [`NBCD.B ${ea1}`, '', `NBCD.B\t${ea2}`, ...fnc];
}
for (let i = 0xc0; i < 0x100; i++) {
	const n = i & 7, mod = (i >> 3 & 7) + n * ((i >> 3 & 7) === 7);
	if (mod === 1 || mod >= 9)
		continue;
	const [ea1, ea2, fnc] = am_decode(mod, n);
	for (let [base, op] of Object.entries({0x4a00:'TAS', 0x5000:'ST', 0x5100:'SF', 0x5200:'SHI', 0x5300:'SLS', 0x5400:'SCC', 0x5500:'SCS', 0x5600:'SNE', 0x5700:'SEQ',
											0x5800:'SVC', 0x5900:'SVS', 0x5a00:'SPL', 0x5b00:'SMI', 0x5c00:'SGE', 0x5d00:'SLT', 0x5e00:'SGT', 0x5f00:'SLE'}))
		table[base | i] = [`${op}.B ${ea1}`, '', `${op}.B\t${ea2}`, ...fnc];
}
for (let i = 0; i < 0x1000; i++) {
	let y = i >> 9, dr = 'RL'[i >> 8 & 1], size = i >> 6 & 3, n = i & 7;
	if (size < 3) {
		const src1 = [`#${y ? y : 8}`, `D${y}`][i >> 5 & 1], op = ['AS', 'LS', 'ROX', 'RO'][i >> 3 & 3];
		size = 'BWL'[size], table[0xe000 | i] = [`${op}${dr}.${size} ${src1},D${n}`, '', `${op}${dr}.${size}\t${src1},D${n}`];
	} else {
		const mod = (i >> 3 & 7) + n * ((i >> 3 & 7) === 7);
		if (y >= 4 || mod < 2 || mod >= 9)
			continue;
		const op = ['AS', 'LS', 'ROX', 'RO'][y], [ea1, ea2, fnc] = am_decode(mod, n);
		table[0xe000 | i] = [`${op}${dr}.W ${ea1}`, '', `${op}${dr}.W\t${ea2}`, ...fnc];
	}
}
for (let i = 0; i < 0x1000; i++) {
	const y = i >> 9, dyn = i >> 8 & 1, n = i & 7, mod = (i >> 3 & 7) + n * ((i >> 3 & 7) === 7);
	if (!dyn && y !== 4 || mod === 1 || mod >= 9)
		continue;
	const src1 = ['#<data>', `D${y}`][dyn], src2 = ['%s', `D${y}`][dyn], size = mod === 0 ? 'L' : 'B';
	let [ea1, ea2, fnc] = am_decode(mod, n), op = ['BTST', 'BCHG', 'BCLR', 'BSET'][i >> 6 & 3];
	fnc = dyn ? fnc : [am_immediate8, ...fnc];
	table[0x0000 | i] = [`${op}.${size} ${src1},${ea1}`, '', `${op}.${size}\t${src2},${ea2}`, ...fnc];
}
for (let i = 0; i < 0x100; i++) {
	const n = i & 7;
	table[0x6000 | i] = i ? ['BRA.B <label>', 'AB', 'BRA\t%s', am_relative8] : ['BRA.W <label>', 'AB', 'BRA%s', branch16];
	for (let [base, op] of Object.entries({0x6100:'BSR', 0x6200:'BHI', 0x6300:'BLS', 0x6400:'BCC', 0x6500:'BCS', 0x6600:'BNE', 0x6700:'BEQ', 0x6800:'BVC',
											0x6900:'BVS', 0x6a00:'BPL', 0x6b00:'BMI', 0x6c00:'BGE', 0x6d00:'BLT', 0x6e00:'BGT', 0x6f00:'BLE'}))
		table[base | i] = i ? [`${op}.B <label>`, 'B', `${op}\t%s`, am_relative8] : [`${op}.W <label>`, 'B', `${op}%s`, branch16];
	if ((i >> 3 & 0x1f) === 0x19)
		for (let [base, op] of Object.entries({0x5000:'DBT', 0x5100:'DBRA', 0x5200:'DBHI', 0x5300:'DBLS', 0x5400:'DBCC', 0x5500:'DBCS', 0x5600:'DBNE', 0x5700:'DBEQ',
												0x5800:'DBVC', 0x5900:'DBVS', 0x5a00:'DBPL', 0x5b00:'DBMI', 0x5c00:'DBGE', 0x5d00:'DBLT', 0x5e00:'DBGT', 0x5f00:'DBLE'}))
			table[base | i] = [`${op} D${n},<label>`, 'B', `${op}\tD${n},%s`, am_relative16];
}
for (let i = 0; i < 0x40; i++) {
	const n = i & 7, mod = (i >> 3) + n * ((i >> 3) === 7);
	if (mod < 2 || mod >= 11)
		continue;
	const [ea1, ea2, fnc] = am_decode(mod, n);
	if (mod !== 3 && mod !== 4) {
		for (let y = 0; y < 8; y++)
			table[0x41c0 | y << 9 | i] = [`LEA.L ${ea1},A${y}`, '', `LEA.L\t${ea2},A${y}`, ...fnc];
		table[0x4840 | i] = [`PEA.L ${ea1}`, '', `PEA.L\t${ea2}`, ...fnc];
		table[0x4e80 | i] = [`JSR ${ea1}`, 'B', `JSR\t${ea2}`, ...fnc];
		table[0x4ec0 | i] = [`JMP ${ea1}`, 'AB', `JMP\t${ea2}`, ...fnc];
	}
	if (mod !== 3 && mod < 9) {
		table[0x4880 | i] = [`MOVEM.W <register list>,${ea1}`, '', `MOVEM.W\t%s,${ea2}`, register_list, ...fnc];
		table[0x48c0 | i] = [`MOVEM.L <register list>,${ea1}`, '', `MOVEM.L\t%s,${ea2}`, register_list, ...fnc];
	}
	if (mod !== 4) {
		table[0x4c80 | i] = [`MOVEM.W ${ea1},<register list>`, '', 'MOVEM.W\t%s', movem];
		table[0x4cc0 | i] = [`MOVEM.L ${ea1},<register list>`, '', 'MOVEM.L\t%s', movem];
	}
}
for (let i = 0; i < 0x1000; i++) {
	let x = i >> 9, size = i >> 6 & 3, rm = i >> 3 & 1, y = i & 7;
	if ((i & 0x130) !== 0x100 || size === 3)
		continue;
	size = 'BWL'[size];
	const rm1 = [`D${y},D${x}`, `-(A${y}),-(A${x})`][rm];
	if (size === 'B') {
		table[0x8000 | i] = [`SBCD.B ${rm1}`, '', `SBCD.B\t${rm1}`];
		table[0xc000 | i] = [`ABCD.B ${rm1}`, '', `ABCD.B\t${rm1}`];
	}
	if (rm)
		table[0xb000 | i] = [`CMPM.${size} (A${y})+,(A${x})+`, '', `CMPM.${size}\t(A${y})+,(A${x})+`];
	table[0x9000 | i] = [`SUBX.${size} ${rm1}`, '', `SUBX.${size}\t${rm1}`];
	table[0xd000 | i] = [`ADDX.${size} ${rm1}`, '', `ADDX.${size}\t${rm1}`];
}
for (let i = 0; i < 0x1000; i++) {
	const x = i >> 9, y = i & 7, mod = (i >> 3 & 7) + y * ((i >> 3 & 7) === 7);
	if ((i >> 3 & 0x3f) === 0x21)
		table[0x0000 | i] = [`MOVEP.W d(A${y}),D${x}`, '', `MOVEP.W\t(%s,A${y}),D${x}`, displacement];
	if ((i >> 3 & 0x3f) === 0x29)
		table[0x0000 | i] = [`MOVEP.L d(A${y}),D${x}`, '', `MOVEP.L\t(%s,A${y}),D${x}`, displacement];
	if ((i >> 3 & 0x3f) === 0x31)
		table[0x0000 | i] = [`MOVEP.W D${x},d(A${y})`, '', `MOVEP.W\tD${x},(%s,A${y})`, displacement];
	if ((i >> 3 & 0x3f) === 0x39)
		table[0x0000 | i] = [`MOVEP.L D${x},d(A${y})`, '', `MOVEP.L\tD${x},(%s,A${y})`, displacement];
	if ((i >> 6 & 7) === 6 && mod !== 1 && mod < 12) {
		const [ea1, ea2, fnc] = am_decode(mod, y, 'W');
		table[0x4000 | i] = [`CHK.W ${ea1},D${x}`, '', `CHK.W\t${ea2},D${x}`, ...fnc];
	}
	if ((i >> 3 & 0x3f) === 0x28)
		table[0xc000 | i] = [`EXG.L D${x},D${y}`, '', `EXG.L\tD${x},D${y}`];
	if ((i >> 3 & 0x3f) === 0x29)
		table[0xc000 | i] = [`EXG.L A${x},A${y}`, '', `EXG.L\tA${x},A${y}`];
	if ((i >> 3 & 0x3f) === 0x31)
		table[0xc000 | i] = [`EXG.L D${x},A${y}`, '', `EXG.L\tD${x},A${y}`];
}
for (let i = 0; i < 0x40; i++) {
	const n = i & 7, mod = (i >> 3) + n * ((i >> 3) === 7);
	if (mod === 1 || mod >= 12)
		continue;
	const [ea1, ea2, fnc] = am_decode(mod, n, 'W');
	if (mod !== 1 && mod < 9)
		table[0x40c0 | i] = [`MOVE.W SR,${ea1}`, '', `MOVE.W\tSR,${ea2}`, ...fnc];
	if (mod !== 1) {
		table[0x44c0 | i] = [`MOVE.W ${ea1},CCR`, '', `MOVE.W\t${ea2},CCR`, ...fnc];
		table[0x46c0 | i] = [`MOVE.W ${ea1},SR`, '', `MOVE.W\t${ea2},SR`, ...fnc];
	}
}
for (let n = 0; n < 8; n++) {
	table[0x4840 | n] = [`SWAP.W D${n}`, '', `SWAP.W\tD${n}`];
	table[0x4880 | n] = [`EXT.W D${n}`, '', `EXT.W\tD${n}`];
	table[0x48c0 | n] = [`EXT.L D${n}`, '', `EXT.L\tD${n}`];
	table[0x4e50 | n] = [`LINK A${n},#<displacement>`, '', `LINK.W\tA${n},#%s`, displacement];
	table[0x4e58 | n] = [`UNLK A${n}`, '', `UNLK\tA${n}`];
	table[0x4e60 | n] = [`MOVE.L A${n},USP`, '', `MOVE.L\tA${n},USP`];
	table[0x4e68 | n] = [`MOVE.L USP,A${n}`, '', `MOVE.L\tUSP,A${n}`];
}
for (let v = 0; v < 16; v++)
	table[0x4e40 | v] = [`TRAP #${v}`, '', `TRAP\t#${v}`];

function op() {
	const opcode = fetch16();
	if (!(opcode in table))
		return flags = '', '';
	const a = table[opcode];
	flags = a[1];
	const operands = a.slice(3).map(f => f());
	return operands.includes('') ? '' : operands.reduce((a, b) => a.replace('%s', b), a[2].toLowerCase());
}

// main
const parser = new BasicParser('e:flo:s:t:', process.argv);
if (parser.optind() >= process.argv.length) {
	console.log(`使い方: ${basename(process.argv[1])} [オプション] ファイル名`);
	console.log('オプション:');
	console.log('  -e <アドレス>   エントリ番地を指定する');
	console.log('  -f              強制的に逆アセンブルする');
	console.log('  -l              アドレスとデータを出力する');
	console.log('  -o <ファイル名> 出力ファイルを指定する(デフォルト:標準出力)');
	console.log('  -s <アドレス>   開始番地を指定する(デフォルト:0)');
	console.log('  -t <ファイル名> ラベルテーブルを使用する');
	process.exit(0);
}
const remark = {}, attrib = new Uint8Array(buffer.length);
let start = 0, listing = false, force = false, entry = 0, noentry = true, file = '', tablefile = '', out = '';
for (let opt; (opt = parser.getopt()) !== undefined;)
	switch (opt.option) {
	case 'e':
		entry = parseInt(opt.optarg), jumplabel[entry] = true, noentry = false;
		break;
	case 'f':
		force = true;
		break;
	case 'l':
		listing = true;
		break;
	case 'o':
		file = opt.optarg;
		break;
	case 's':
		start = parseInt(opt.optarg);
		break;
	case 't':
		tablefile = opt.optarg;
		break;
	}
const data = readFileSync(process.argv[parser.optind()]).slice(0, buffer.length - start), end = start + data.length;
buffer.set(data, start);
if (tablefile)
	readFileSync(tablefile, 'utf-8').split('\n').map(l => l.trimEnd()).forEach(line => {
		const words = line.split(' ');
		let base, size;
		switch (words[0]) {
		case 'b':
			return base = parseInt(words[1], 16), size = words.length > 2 ? parseInt(words[2], 10) : 1, void(attrib.fill(char('B'), base, base + size));
		case 'c':
			return jumplabel[parseInt(words[1], 16)] = true, void(noentry = false);
		case 'd':
			return void(label[parseInt(words[1], 16)] = true);
		case 'r':
			const addr = parseInt(words[1], 16);
			return !(addr in remark) && (remark[addr] = []), void(remark[addr].push(line.slice((words[0] + words[1]).length + 2)));
		case 's':
			return base = parseInt(words[1], 16), size = words.length > 2 ? parseInt(words[2], 10) : 1, void(attrib.fill(char('S'), base, base + size));
		case 't':
			base = parseInt(words[1], 16), size = words.length > 2 ? parseInt(words[2], 10) : 1;
			for (let i = base; i < base + size * 4; i += 4)
				attrib.fill(char('P'), i, i + 4), jumplabel[view.getUint32(i) & 0xffffff] = true;
			return void(noentry = false);
		case 'u':
			base = parseInt(words[1], 16), size = words.length > 2 ? parseInt(words[2], 10) : 1;
			for (let i = base; i < base + size * 4; i += 4)
				attrib.fill(char('P'), i, i + 4), label[view.getUint32(i) & 0xffffff] = true;
			return;
		}
	});

// path 1
if (noentry && !start) {
	label[start] = true;
	const reset = view.getUint32(4) & 0xffffff;
	entry = reset >= Math.max(start, 8) && reset < end && !(reset & 1) ? reset : start, jumplabel[entry] = true;
	for (let i = 8; i < Math.min(reset, 0x400); i += 4) {
		const vector = view.getUint32(i) & 0xffffff;
		vector >= Math.max(start, 8) && vector < end && !(vector & 1) && (jumplabel[vector] = true);
	}
} else if (noentry)
	entry = start, jumplabel[entry] = true;
for (;;) {
	for (location = start; location < end && (attrib[location] || !jumplabel[location]); location += 2) {}
	if (location === end)
		break;
	do {
		const base = location;
		op();
		attrib.fill(char('C'), base, location);
	} while ((force || !flags.includes('A')) && location < end && !attrib[location]);
}

// path 2
if (listing) {
	out += '\t\t\t\t;-----------------------------------------------\n';
	out += '\t\t\t\t;\tMC68000 disassembler\n';
	out += `\t\t\t\t;\tfilename: ${process.argv[parser.optind()]}\n`;
	out += '\t\t\t\t;-----------------------------------------------\n';
	out += '\t\t\t\t\n';
	out += '\t\t\t\t\t.cpu\t68000\n';
	out += '\t\t\t\t\n';
	out += '\t\t\t\t\t.text\n';
	out += '\t\t\t\t\n';
} else {
	out += ';-----------------------------------------------\n';
	out += ';\tMC68000 disassembler\n';
	out += `;\tfilename: ${process.argv[parser.optind()]}\n`;
	out += ';-----------------------------------------------\n';
	out += '\n';
	out += '\t.cpu\t68000\n';
	out += '\n';
	out += '\t.text\n';
	out += '\n';
}
for (location = start; location < end;) {
	const base = location;
	let i;
	if (base in remark)
		for (let s of remark[base])
			listing && (out += `${X6(base)}\t\t\t\t`), out += `;${s}\n`;
	switch (String.fromCharCode(attrib[base])) {
	case 'C':
		const s = op(), size = location - base;
		jumplabel[base] && (listing && (out += `${X6(base)}\t\t\t\t`), out += `L${x6(base)}:\n`);
		listing && (out += X6(base) + Array.from(buffer.slice(base, location), (e, i) => ' '.repeat(~i & 1) + X2(e)).join('') + '\t'.repeat(33 - size * 2.5 >> 3));
		out += s ? `\t${s}\n` : `\t.dc.b\t${Array.from(buffer.slice(base, location), e => `$${x2(e)}`).join(',')}\n`;
		break;
	case 'S':
		label[base] && (listing && (out += `${X6(base)}\t\t\t\t`), out += `L${x6(base)}:\n`), listing && (out += `${X6(base)}\t\t\t\t`);
		for (out += `\t.dc.b\t'${String.fromCharCode(fetch())}`; location < end && attrib[location] === char('S') && !label[location]; out += String.fromCharCode(fetch())) {}
		out += `'\n`;
		break;
	case 'B':
		label[base] && (listing && (out += `${X6(base)}\t\t\t\t`), out += `L${x6(base)}:\n`), listing && (out += `${X6(base)}\t\t\t\t`);
		for (out += `\t.dc.b\t$${x2(fetch())}`, i = 0; i < 7 && location < end && attrib[location] === char('B') && !label[location]; out += `,$${x2(fetch())}`, i++) {}
		out += '\n';
		break;
	case 'P':
		label[base] && (listing && (out += `${X6(base)}\t\t\t\t`), out += `L${x6(base)}:\n`), listing && (out += `${X6(base)}\t\t\t\t`);
		for (out += `\t.dc.l\tL${x6(fetch32())}`, i = 0; i < 3 && location < end && attrib[location] === char('P') && !label[location]; out += `,L${x6(fetch32())}`, i++) {}
		out += '\n';
		break;
	default:
		label[base] && (listing && (out += `${X6(base)}\t\t\t\t`), out += `L${x6(base)}:\n`), listing && (out += `${X6(base)}\t\t\t\t`);
		for (out += `\t.dc.b\t$${x2(fetch())}`, i = 0; i < 7 && location < end && !attrib[location] && !label[location]; out += `,$${x2(fetch())}`, i++) {}
		out += '\n';
		break;
	}
}
(label[location] || jumplabel[location]) && (listing && (out += `${X6(location)}\t\t\t\t`), out += `L${x6(location)}:\n`);
listing && (out += `${X6(location & 0xffffff)}\t\t\t\t`), out += `\t.end\tL${x6(entry)}\n`;
file ? writeFileSync(file, out, 'utf-8') : console.log(out);
