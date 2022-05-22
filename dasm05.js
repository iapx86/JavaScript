/*
 *	MC6805 disassembler
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
const fetch16 = () => fetch() << 8 | fetch();
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
	0x20: ['BRA',      'AB', 'BRA\t%s',   am_relative],
	0x80: ['RTI',      'A',  'RTI'],
	0x81: ['RTS',      'A',  'RTS'],
	0x83: ['SWI',      '',   'SWI'],
	0x8e: ['STOP',     '',   'STOP'],
	0x8f: ['WAIT',     '',   'WAIT'],
	0xad: ['BSR',      'B',  'BSR\t%s',   am_relative],
	0xbc: ['JMP <n',   'AB', 'JMP\t<%s',  byte],
	0xbd: ['JSR <n',   'B',  'JSR\t<%s',  byte],
	0xcc: ['JMP >nn',  'AB', 'JMP\t%s',   word],
	0xcd: ['JSR >nn',  'B',  'JSR\t%s',   word],
	0xdc: ['JMP nn,X', 'AB', 'JMP\t%s,X', word],
	0xdd: ['JSR nn,X', 'B',  'JSR\t%s,X', word],
	0xec: ['JMP n,X',  'AB', 'JMP\t%s,X', byte],
	0xed: ['JSR n,X',  'B',  'JSR\t%s,X', byte],
	0xfc: ['JMP ,X',   'AB', 'JMP\t,X'],
	0xfd: ['JSR ,X',   'B',  'JSR\t,X'],
};

for (let b = 0; b < 8; b++) {
	table[0x00 | b << 1] = [`BRSET${b}`, 'B', `BRSET\t${b},<%s,%s`, byte, am_relative];
	table[0x01 | b << 1] = [`BRCLR${b}`, 'B', `BRCLR\t${b},<%s,%s`, byte, am_relative];
	table[0x10 | b << 1] = [`BSET${b}`, '', `BSET\t${b},<%s`, byte];
	table[0x11 | b << 1] = [`BCLR${b}`, '', `BCLR\t${b},<%s`, byte];
}
for (let [i, op] of Object.entries({1:'BRN', 2:'BHI', 3:'BLS', 4:'BCC', 5:'BCS', 6:'BNE', 7:'BEQ', 8:'BHCC', 9:'BHCS', 0xa:'BPL', 0xb:'BMI', 0xc:'BMC', 0xd:'BMS', 0xe:'BIL', 0xf:'BIH'}))
	table[0x20 | i] = [`${op}`, 'B', `${op}\t%s`, am_relative];
for (let [i, op] of Object.entries({0:'NEG', 3:'COM', 4:'LSR', 6:'ROR', 7:'ASR', 8:'ASL', 9:'ROL', 0xa:'DEC', 0xc:'INC', 0xd:'TST', 0xf:'CLR'})) {
	table[0x30 | i] = [`${op} <n`, '', `${op}\t<%s`, byte];
	table[0x40 | i] = [`${op}A`, '', `${op}A`];
	table[0x50 | i] = [`${op}X`, '', `${op}X`];
	table[0x60 | i] = [`${op} n,X`, '', `${op}\t%s,X`, byte];
	table[0x70 | i] = [`${op} ,X`, '', `${op}\t,X`];
}
for (let [i, op] of Object.entries({7:'TAX', 8:'CLC', 9:'SEC', 0xa:'CLI', 0xb:'SEI', 0xc:'RSP', 0xd:'NOP', 0xf:'TXA'}))
	table[0x90 | i] = [`${op}`, '', `${op}`];
for (let [i, op] of Object.entries({0:'SUB', 1:'CMP', 2:'SBC', 3:'CPX', 4:'AND', 5:'BIT', 6:'LDA', 8:'EOR', 9:'ADC', 0xa:'ORA', 0xb:'ADD', 0xe:'LDX'}))
	table[0xa0 | i] = [`${op} #n`, '', `${op}\t#%s`, byte];
for (let [i, op] of Object.entries({0:'SUB', 1:'CMP', 2:'SBC', 3:'CPX', 4:'AND', 5:'BIT', 6:'LDA', 7:'STA', 8:'EOR', 9:'ADC', 0xa:'ORA', 0xb:'ADD', 0xe:'LDX', 0xf:'STX'})) {
	table[0xb0 | i] = [`${op} <n`, '', `${op}\t<%s`, byte];
	table[0xc0 | i] = [`${op} >nn`, '', `${op}\t%s`, word];
	table[0xd0 | i] = [`${op} nn,X`, '', `${op}\t%s,X`, word];
	table[0xe0 | i] = [`${op} n,X`, '', `${op}\t%s,X`, byte];
	table[0xf0 | i] = [`${op} ,X`, '', `${op}\t,X`];
}

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
	out += '\t\t\t*\tMC6805 disassembler\n';
	out += `\t\t\t*\tfilename: ${process.argv[parser.optind()]}\n`;
	out += '\t\t\t************************************************\n';
	out += `\t\t\t\torg\t$${x4(start)}\n`;
	out += '\t\t\t\n';
} else {
	out += '************************************************\n';
	out += '*\tMC6805 disassembler\n';
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
