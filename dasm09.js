/*
 *	MC6809 disassembler
 */

const {readFileSync, writeFileSync} = require('fs');
const {basename} = require('path');
const {BasicParser} = require('posix-getopt');

const buffer = new Uint8Array(0x10000);
const jumplabel = new Array(buffer.length).fill(false), label = new Array(buffer.length).fill(false);
let location = 0, flags = '';

const char = s => s.charCodeAt(0);
const x2 = n => Number(n).toString(16).padStart(2, '0');
const x4 = n => Number(n).toString(16).padStart(4, '0');
const X2 = n => Number(n).toString(16).toUpperCase().padStart(2, '0');
const X4 = n => Number(n).toString(16).toUpperCase().padStart(4, '0');
const s5 = x => x & 15 | -(x & 16);
const s8 = x => x & 0x7f | -(x & 0x80);
const fetch = () => buffer[location++];
const fetch16 = () => fetch() << 8 | fetch();
const byte = () => `$${x2(fetch())}`;

function word() {
	const operand = fetch16();
	return flags.includes('B') ? (jumplabel[operand] = true) : (label[operand] = true), `L${x4(operand)}`;
}

function am_relative() {
	const operand = s8(fetch()) + location & 0xffff;
	return flags.includes('B') ? (jumplabel[operand] = true) : (label[operand] = true), `L${x4(operand)}`;
}

function am_lrelative() {
	const operand = (fetch() << 8 | fetch()) + location & 0xffff;
	return flags.includes('B') ? (jumplabel[operand] = true) : (label[operand] = true), `L${x4(operand)}`;
}

function am_index() {
	const post = fetch(), pl = post & 15;
	if (post & 0x80 && [0x07, 0x0a, 0x0e, 0x0f, 0x10, 0x12, 0x17, 0x1a, 0x1e].includes(post & 0x1f))
		return '';
	let d, offset;
	if (!(post & 0x80))
		d = s5(post), offset = d < 0 ? `-$${x2(-d)}` : `$${x2(d)}`;
	else if (pl === 5)
		offset = 'b';
	else if (pl === 6)
		offset = 'a';
	else if (pl === 8)
		d = s8(fetch()), offset = d < 0 ? `-$${x2(-d)}` : `$${x2(d)}`;
	else if (pl === 9 || pl === 15)
		offset = word();
	else if (pl === 11)
		offset = 'd';
	else if (pl === 12)
		offset = am_relative();
	else if (pl === 13)
		offset = am_lrelative();
	else
		offset = '';
	const dec = (post & 0x8e) === 0x82 ? ['-', '--'][post & 1] : '';
	const reg = (post & 0x8e) !== 0x8c ? ['x', 'y', 'u', 's'][post >> 5 & 3] : 'pc';
	const inc = (post & 0x8e) === 0x80 ? ['+', '++'][post & 1] : '';
	return !(post & 0x80) || !(post & 0x10) ? `${offset},${dec}${reg}${inc}` : pl !== 0x0f ? `[${offset},${dec}${reg}${inc}]` : `[${offset}]`;
}

function exg_tfr() {
	const post = fetch(), regs = {0:'d', 1:'x', 2:'y', 3:'u', 4:'s', 5:'pc', 8:'a', 9:'b', 0xa:'cc', 0xb:'dp'};
	return post >> 4 in regs && (post & 15) in regs ? `${regs[post >> 4]},${regs[post & 15]}` : '';
}

function psh_pul() {
	const post = fetch(), regs = ['cc', 'a', 'b', 'dp', 'x', 'y', buffer[location - 2] & 2 ? 's' : 'u', 'pc'];
	return regs.filter((e, i) => post & 1 << i).join(',');
}

const table_11 = {
	0x3f: ['SWI3', '',   'SWI3'],
};

for (let [i, op] of Object.entries({3:'CMPU', 0xc:'CMPS'})) {
	table_11[0x80 | i] = [`${op} #nn`, '', `${op}\t#%s`, word];
	table_11[0x90 | i] = [`${op} <n`, '', `${op}\t<%s`, byte];
	table_11[0xa0 | i] = [`${op} ,r`, '', `${op}\t%s`, am_index];
	table_11[0xb0 | i] = [`${op} >nn`, '', `${op}\t%s`, word];
}

function op_11() {
	const opcode = fetch();
	if (!(opcode in table_11))
		return '';
	const a = table_11[opcode];
	flags = a[1];
	const operands = a.slice(3).map(f => f());
	return operands.includes('') ? '' : operands.reduce((a, b) => a.replace('%s', b), a[2].toLowerCase());
}

const table_10 = {
	0x3f: ['SWI2',    '',   'SWI2'],
	0xce: ['LDS #nn', '',   'LDS\t#%s', word],
};

for (let [i, op] of Object.entries({1:'LBRN', 2:'LBHI', 3:'LBLS', 4:'LBCC', 5:'LBCS', 6:'LBNE', 7:'LBEQ', 8:'LBVC', 9:'LBVS', 0xa:'LBPL', 0xb:'LBMI', 0xc:'LBGE', 0xd:'LBLT', 0xe:'LBGT', 0xf:'LBLE'}))
	table_10[0x20 | i] = [`${op}`, 'B', `${op}\t%s`, am_lrelative];
for (let [i, op] of Object.entries({3:'CMPD', 0xc:'CMPY', 0xe:'LDY'}))
	table_10[0x80 | i] = [`${op} #nn`, '', `${op}\t#%s`, word];
for (let [i, op] of Object.entries({3:'CMPD', 0xc:'CMPY', 0xe:'LDY', 0xf:'STY'})) {
	table_10[0x90 | i] = [`${op} <n`, '', `${op}\t<%s`, byte];
	table_10[0xa0 | i] = [`${op} ,r`, '', `${op}\t%s`, am_index];
	table_10[0xb0 | i] = [`${op} >nn`, '', `${op}\t%s`, word];
}
for (let [i, op] of Object.entries({0xe:'LDS', 0xf:'STS'})) {
	table_10[0xd0 | i] = [`${op} <n`, '', `${op}\t<%s`, byte];
	table_10[0xe0 | i] = [`${op} ,r`, '', `${op}\t%s`, am_index];
	table_10[0xf0 | i] = [`${op} >nn`, '', `${op}\t%s`, word];
}

function op_10() {
	const opcode = fetch();
	if (!(opcode in table_10))
		return '';
	const a = table_10[opcode];
	flags = a[1];
	const operands = a.slice(3).map(f => f());
	return operands.includes('') ? '' : operands.reduce((a, b) => a.replace('%s', b), a[2].toLowerCase());
}

const table = {
	0x0e: ['JMP <n',  'A',  'JMP\t%s',    byte],
	0x10: ['',        '',   '%s',         op_10],
	0x11: ['',        '',   '%s',         op_11],
	0x12: ['NOP',     '',   'NOP'],
	0x13: ['SYNC',    '',   'SYNC'],
	0x16: ['LBRA',    'AB', 'LBRA\t%s',   am_lrelative],
	0x17: ['LBSR',    'B',  'LBSR\t%s',   am_lrelative],
	0x19: ['DAA',     '',   'DAA'],
	0x1a: ['ORCC',    '',   'ORCC\t#%s',  byte],
	0x1c: ['ANDCC',   '',   'ANDCC\t#%s', byte],
	0x1d: ['SEX',     '',   'SEX'],
	0x1e: ['EXG',     '',   'EXG\t%s',    exg_tfr],
	0x1f: ['TFR',     '',   'TFR\t%s',    exg_tfr],
	0x20: ['BRA',     'AB', 'BRA\t%s',    am_relative],
	0x39: ['RTS',     'A',  'RTS'],
	0x3a: ['ABX',     '',   'ABX'],
	0x3b: ['RTI',     'A',  'RTI'],
	0x3c: ['CWAI',    '',   'CWAI\t#%s',  byte],
	0x3d: ['MUL',     '',   'MUL'],
	0x3f: ['SWI',     '',   'SWI'],
	0x6e: ['JMP ,r',  'A',  'JMP\t%s',    am_index],
	0x7e: ['JMP >nn', 'AB', 'JMP\t%s',    word],
	0x8d: ['BSR',     'B',  'BSR\t%s',    am_relative],
	0x9d: ['JSR <n',  'B',  'JSR\t<%s',  byte],
	0xad: ['JSR ,r',  'B',  'JSR\t%s',   am_index],
	0xbd: ['JSR >nn', 'B',  'JSR\t%s',    word],
};

for (let [i, op] of Object.entries({0:'NEG', 3:'COM', 4:'LSR', 6:'ROR', 7:'ASR', 8:'LSL', 9:'ROL', 0xa:'DEC', 0xc:'INC', 0xd:'TST', 0xf:'CLR'})) {
	table[0x00 | i] = [`${op} <n`, '', `${op}\t<%s`, byte];
	table[0x40 | i] = [`${op}A`, '', `${op}A`];
	table[0x50 | i] = [`${op}B`, '', `${op}B`];
	table[0x60 | i] = [`${op} ,r`, '', `${op}\t%s`, am_index];
	table[0x70 | i] = [`${op} >nn`, '', `${op}\t%s`, word];
}
for (let [i, op] of Object.entries({1:'BRN', 2:'BHI', 3:'BLS', 4:'BCC', 5:'BCS', 6:'BNE', 7:'BEQ', 8:'BVC', 9:'BVS', 0xa:'BPL', 0xb:'BMI', 0xc:'BGE', 0xd:'BLT', 0xe:'BGT', 0xf:'BLE'}))
	table[0x20 | i] = [`${op}`, 'B', `${op}\t%s`, am_relative];
for (let [i, op] of ['LEAX', 'LEAY', 'LEAS', 'LEAU'].entries())
	table[0x30 | i] = [`${op}`, '', `${op}\t%s`, am_index];
for (let [i, op] of Object.entries({4:'PSHS', 5:'PULS', 6:'PSHU', 7:'PULU'}))
	table[0x30 | i] = [`${op}`, '', `${op}\t%s`, psh_pul];
for (let [i, op] of Object.entries({0:'SUBA', 1:'CMPA', 2:'SBCA', 4:'ANDA', 5:'BITA', 6:'LDA', 8:'EORA', 9:'ADCA', 0xa:'ORA', 0xb:'ADDA'}))
	table[0x80 | i] = [`${op} #n`, '', `${op}\t#%s`, byte];
for (let [i, op] of Object.entries({3:'SUBD', 0xc:'CMPX', 0xe:'LDX'}))
	table[0x80 | i] = [`${op} #nn`, '', `${op}\t#%s`, word];
for (let [i, op] of Object.entries({0:'SUBA', 1:'CMPA', 2:'SBCA', 3:'SUBD', 4:'ANDA', 5:'BITA', 6:'LDA', 7:'STA', 8:'EORA', 9:'ADCA', 0xa:'ORA', 0xb:'ADDA', 0xc:'CMPX', 0xe:'LDX', 0xf:'STX'})) {
	table[0x90 | i] = [`${op} <n`, '', `${op}\t<%s`, byte];
	table[0xa0 | i] = [`${op} ,r`, '', `${op}\t%s`, am_index];
	table[0xb0 | i] = [`${op} >nn`, '', `${op}\t%s`, word];
}
for (let [i, op] of Object.entries({0:'SUBB', 1:'CMPB', 2:'SBCB', 4:'ANDB', 5:'BITB', 6:'LDB', 8:'EORB', 9:'ADCB', 0xa:'ORB', 0xb:'ADDB'}))
	table[0xc0 | i] = [`${op} #n`, '', `${op}\t#%s`, byte];
for (let [i, op] of Object.entries({3:'ADDD', 0xc:'LDD', 0xe:'LDU'}))
	table[0xc0 | i] = [`${op} #nn`, '', `${op}\t#%s`, word];
for (let [i, op] of ['SUBB', 'CMPB', 'SBCB', 'ADDD', 'ANDB', 'BITB', 'LDB', 'STB', 'EORB', 'ADCB', 'ORB', 'ADDB', 'LDD', 'STD', 'LDU', 'STU'].entries()) {
	table[0xd0 | i] = [`${op} <n`, '', `${op}\t<%s`, byte];
	table[0xe0 | i] = [`${op} ,r`, '', `${op}\t%s`, am_index];
	table[0xf0 | i] = [`${op} >nn`, '', `${op}\t%s`, word];
}

function op() {
	const opcode = fetch();
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
let start = 0, listing = false, force = false, noentry = true, file = '', tablefile = '', out = '';
for (let opt; (opt = parser.getopt()) !== undefined;)
	switch (opt.option) {
	case 'e':
		jumplabel[parseInt(opt.optarg)] = true, noentry = false;
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
			for (let i = base; i < base + size * 2; i += 2)
				attrib.fill(char('P'), i, i + 2), jumplabel[buffer[i] << 8 | buffer[i + 1]] = true;
			return void(noentry = false);
		case 'u':
			base = parseInt(words[1], 16), size = words.length > 2 ? parseInt(words[2], 10) : 1;
			for (let i = base; i < base + size * 2; i += 2)
				attrib.fill(char('P'), i, i + 2), label[buffer[i] << 8 | buffer[i + 1]] = true;
			return;
		case 'v':
			base = parseInt(words[1], 16), size = words.length > 2 ? parseInt(words[2], 10) : 1;
			for (let i = base; i < base + size * 3; i += 3)
				attrib.fill(char('P'), i, i + 2), label[buffer[i] << 8 | buffer[i + 1]] = true;
			return;
		}
	});

// path 1
if (noentry)
	jumplabel[start] = true;
for (;;) {
	for (location = start; location < end && (attrib[location] || !jumplabel[location]); location++) {}
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
	out += '\t\t\t************************************************\n';
	out += '\t\t\t*\tMC6809 disassembler\n';
	out += `\t\t\t*\tfilename: ${process.argv[parser.optind()]}\n`;
	out += '\t\t\t************************************************\n';
	out += `\t\t\t\torg\t$${x4(start)}\n`;
	out += '\t\t\t\n';
} else {
	out += '************************************************\n';
	out += '*\tMC6809 disassembler\n';
	out += `*\tfilename: ${process.argv[parser.optind()]}\n`;
	out += '************************************************\n';
	out += `'\torg\t$${x4(start)}\n`;
	out += '\n';
}
for (location = start; location < end;) {
	const base = location;
	let i;
	if (base in remark)
		for (let s of remark[base])
			listing && (out += `${X4(base)}\t\t\t`), out += `*${s}\n`;
	switch (String.fromCharCode(attrib[base])) {
	case 'C':
		const s = op(), size = location - base;
		listing && (out += `${X4(base)} ${Array.from(buffer.slice(base, location), e => ` ${X2(e)}`).join('')}${'\t'.repeat(26 - size * 3 >> 3)}`);
		jumplabel[base] && (out += `L${x4(base)}`);
		out += s ? `\t${s}\n` : `\tfcb\t${Array.from(buffer.slice(base, location), e => `$${x2(e)}`).join(',')}\n`;
		break;
	case 'S':
		listing && (out += `${X4(base)}\t\t\t`), label[base] && (out += `L${x4(base)}`);
		for (out += `\tfcc\t'${String.fromCharCode(fetch())}`; location < end && attrib[location] === char('S') && !label[location]; out += String.fromCharCode(fetch())) {}
		out += `'\n`;
		break;
	case 'B':
		listing && (out += `${X4(base)}\t\t\t`), label[base] && (out += `L${x4(base)}`);
		for (out += `\tfcb\t$${x2(fetch())}`, i = 0; i < 7 && location < end && attrib[location] === char('B') && !label[location]; out += `,$${x2(fetch())}`, i++) {}
		out += '\n';
		break;
	case 'P':
		listing && (out += `${X4(base)}\t\t\t`), label[base] && (out += `L${x4(base)}`);
		for (out += `\tfdb\tL${x4(fetch16())}`, i = 0; i < 3 && location < end && attrib[location] === char('P') && !label[location]; out += `,L${x4(fetch16())}`, i++) {}
		out += '\n';
		break;
	default:
		const c = fetch();
		listing && (out += `${X4(base)}  ${X2(c)}\t\t`), label[base] && (out += `L${x4(base)}`);
		out += `\tfcb\t$${x2(c)}`, c >= 0x20 && c < 0x7f && (out += `\t'${String.fromCharCode(c)}'`), out += '\n';
		break;
	}
}
listing && (out += `${X4(location & 0xffff)}\t\t\t`), out += '\tend\n';
file ? writeFileSync(file, out, 'utf-8') : console.log(out);
