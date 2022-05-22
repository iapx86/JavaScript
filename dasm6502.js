/*
 *	MCS6502 disassembler
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
const s8 = x => x & 0x7f | -(x & 0x80);
const fetch = () => buffer[location++];
const fetch16 = () => fetch() | fetch() << 8;
const byte = () => `$${x2(fetch())}`;

function word() {
	const operand = fetch16();
	return flags.includes('B') ? (jumplabel[operand] = true) : (label[operand] = true), `L${x4(operand)}`;
}

function am_relative() {
	const operand = s8(fetch()) + location & 0xffff;
	return jumplabel[operand] = true, `L${x4(operand)}`;
}

const table = {
	0x00: ['BRK',       '',   'BRK\t%s',   byte],
	0x08: ['PHP',       '',   'PHP'],
	0x10: ['BPL',       'B',  'BPL\t%s',   am_relative],
	0x18: ['CLC',       '',   'CLC'],
	0x20: ['JSR nn',    'B',  'JSR\t%s',   word],
	0x28: ['PLP',       '',   'PLP'],
	0x30: ['BMI',       'B',  'BMI\t%s',   am_relative],
	0x38: ['SEC',       '',   'SEC'],
	0x40: ['RTI',       'A',  'RTI'],
	0x48: ['PHA',       '',   'PHA'],
	0x4c: ['JMP nn',    'AB', 'JMP\t%s',   word],
	0x50: ['BVC',       'B',  'BVC\t%s',   am_relative],
	0x58: ['CLI',       '',   'CLI'],
	0x60: ['RTS',       'A',  'RTS'],
	0x68: ['PLA',       '',   'PLA'],
	0x6c: ['JMP (nn)',  'A',  'JMP\t(%s)', word],
	0x70: ['BVS',       'B',  'BVS\t%s',   am_relative],
	0x78: ['SEI',       '',   'SEI'],
	0x88: ['DEY',       '',   'DEY'],
	0x8a: ['TXA',       '',   'TXA'],
	0x90: ['BCC',       'B',  'BCC\t%s',   am_relative],
	0x94: ['STY n,X',   '',   'STY\t%s,X', byte],
	0x96: ['STX n,Y',   '',   'STX\t%s,Y', byte],
	0x98: ['TYA',       '',   'TYA'],
	0x9a: ['TXS',       '',   'TXS'],
	0xa8: ['TAY',       '',   'TAY'],
	0xaa: ['TAX',       '',   'TAX'],
	0xb0: ['BCS',       'B',  'BCS\t%s',   am_relative],
	0xb4: ['LDY n,X',   '',   'LDY\t%s,X', byte],
	0xb6: ['LDX n,Y',   '',   'LDX\t%s,Y', byte],
	0xb8: ['CLV',       '',   'CLV'],
	0xba: ['TSX',       '',   'TSX'],
	0xbc: ['LDY nn,X',  '',   'LDY\t%s,X', word],
	0xbe: ['LDX nn,Y',  '',   'LDX\t%s,Y', word],
	0xc8: ['INY',       '',   'INY'],
	0xca: ['DEX',       '',   'DEX'],
	0xd0: ['BNE',       'B',  'BNE\t%s',   am_relative],
	0xd8: ['CLD',       '',   'CLD'],
	0xe8: ['INX',       '',   'INX'],
	0xea: ['NOP',       '',   'NOP'],
	0xf0: ['BEQ',       'B',  'BEQ\t%s',   am_relative],
	0xf8: ['SED',       '',   'SED'],
};

for (let [i, op] of Object.entries({0x01:'ORA', 0x21:'AND', 0x41:'EOR', 0x61:'ADC', 0x81:'STA', 0xa1:'LDA', 0xc1:'CMP', 0xe1:'SBC'})) {
	table[0x00 | i] = [`${op} (n,X)`, '', `${op}\t(%s,X)`, byte];
	table[0x10 | i] = [`${op} (n),Y`, '', `${op}\t(%s),Y`, byte];
	table[0x18 | i] = [`${op} nn,Y`, '', `${op}\t%s,Y`, word];
}
for (let [i, op] of Object.entries({0x01:'ORA', 0x02:'ASL', 0x21:'AND', 0x22:'ROL', 0x41:'EOR', 0x42:'LSR', 0x61:'ADC', 0x62:'ROR', 0x81:'STA', 0xa1:'LDA', 0xc1:'CMP', 0xc2:'DEC', 0xe1:'SBC', 0xe2:'INC'})) {
	table[0x04 | i] = [`${op} n`, '', `${op}\t%s`, byte];
	table[0x0c | i] = [`${op} nn`, '', `${op}\t%s`, word];
}
for (let [i, op] of Object.entries({0x01:'ORA', 0x21:'AND', 0x41:'EOR', 0x61:'ADC', 0xa1:'LDA', 0xc1:'CMP', 0xe1:'SBC'}))
	table[0x08 | i] = [`${op} #n`, '', `${op}\t#%s`, byte];
for (let [i, op] of Object.entries({0x01:'ORA', 0x02:'ASL', 0x21:'AND', 0x22:'ROL', 0x41:'EOR', 0x42:'LSR', 0x61:'ADC', 0x62:'ROR', 0x81:'STA', 0xa1:'LDA', 0xc1:'CMP', 0xc2:'DEC', 0xe1:'SBC', 0xe2:'INC'})) {
	table[0x14 | i] = [`${op} n,X`, '', `${op}\t%s,X`, byte];
	table[0x1c | i] = [`${op} nn,X`, '', `${op}\t%s,X`, word];
}
for (let [i, op] of Object.entries({0xa0:'LDY', 0xa2:'LDX', 0xc0:'CPY', 0xe0:'CPX'}))
	table[0x00 | i] = [`${op} #n`, '', `${op}\t#%s`, byte];
for (let [i, op] of Object.entries({0x20:'BIT', 0x80:'STY', 0x82:'STX', 0xa0:'LDY', 0xa2:'LDX', 0xc0:'CPY', 0xe0:'CPX'})) {
	table[0x04 | i] = [`${op} n`, '', `${op}\t%s`, byte];
	table[0x0c | i] = [`${op} nn`, '', `${op}\t%s`, word];
}
for (let [i, op] of Object.entries({0x02:'ASL', 0x22:'ROL', 0x42:'LSR', 0x62:'ROR'}))
	table[0x08 | i] = [`${op}A`, '', `${op}A`];

function op() {
	const opcode = fetch();
	if (!(opcode in table))
		return flags = '', '';
	const a = table[opcode];
	return flags = a[1], a.slice(3).reduce((a, b) => a.replace('%s', b()), a[2].toLowerCase());
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
				attrib.fill(char('P'), i, i + 2), jumplabel[buffer[i] | buffer[i + 1] << 8] = true;
			return void(noentry = false);
		case 'u':
			base = parseInt(words[1], 16), size = words.length > 2 ? parseInt(words[2], 10) : 1;
			for (let i = base; i < base + size * 2; i += 2)
				attrib.fill(char('P'), i, i + 2), label[buffer[i] | buffer[i + 1] << 8] = true;
			return;
		case 'v':
			base = parseInt(words[1], 16), size = words.length > 2 ? parseInt(words[2], 10) : 1;
			for (let i = base; i < base + size * 3; i += 3)
				attrib.fill(char('P'), i, i + 2), label[buffer[i] | buffer[i + 1] << 8] = true;
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
	out += '\t\t\t*\tMCS6502 disassembler\n';
	out += `\t\t\t*\tfilename: ${process.argv[parser.optind()]}\n`;
	out += '\t\t\t************************************************\n';
	out += `\t\t\t\torg\t$${x4(start)}\n`;
	out += '\t\t\t\n';
} else {
	out += '************************************************\n';
	out += '*\tMCS6502 disassembler\n';
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
