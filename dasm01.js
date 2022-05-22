/*
 *	MC6801 disassembler
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

table = {
	0x18: ['XGDX',    '',   'XGDX'], // (HD63701)
	0x1a: ['SLP',     '',   'SLP'], // (HD63701)
	0x20: ['BRA',     'AB', 'BRA\t%s',   am_relative],
	0x39: ['RTS',     'A',  'RTS'],
	0x3b: ['RTI',     'A',  'RTI'],
	0x6e: ['JMP ,X',  'AB', 'JMP\t%s,X', byte],
	0x7e: ['JMP >nn', 'AB', 'JMP\t%s',   word],
	0x8d: ['BSR',     'B',  'BSR\t%s',   am_relative],
	0x9d: ['JSR <n',  'B',  'JSR\t<%s',  byte],
	0xad: ['JSR ,X',  'B',  'JSR\t%s,X', byte],
	0xbd: ['JSR >nn', 'B',  'JSR\t%s',   word],
};

for (let [i, op] of Object.entries({1:'NOP', 4:'LSRD', 5:'ASLD', 6:'TAP', 7:'TPA', 8:'INX', 9:'DEX', 0xa:'CLV', 0xb:'SEV', 0xc:'CLC', 0xd:'SEC', 0xe:'CLI', 0xf:'SEI'}))
	table[0x00 | i] = [`${op}`, '', `${op}`];
for (let [i, op] of Object.entries({0:'SBA', 1:'CBA', 6:'TAB', 7:'TBA', 9:'DAA', 0xb:'ABA'}))
	table[0x10 | i] = [`${op}`, '', `${op}`];
for (let [i, op] of Object.entries({1:'BRN', 2:'BHI', 3:'BLS', 4:'BCC', 5:'BCS', 6:'BNE', 7:'BEQ', 8:'BVC', 9:'BVS', 0xa:'BPL', 0xb:'BMI', 0xc:'BGE', 0xd:'BLT', 0xe:'BGT', 0xf:'BLE'}))
	table[0x20 | i] = [`${op}`, 'B', `${op}\t%s`, am_relative];
for (let [i, op] of Object.entries({0:'TSX', 1:'INS', 2:'PULA', 3:'PULB', 4:'DES', 5:'TXS', 6:'PSHA', 7:'PSHB', 8:'PULX', 0xa:'ABX', 0xc:'PSHX', 0xd:'MUL', 0xe:'WAI', 0xf:'SWI'}))
	table[0x30 | i] = [`${op}`, '', `${op}`];
for (let [i, op] of Object.entries({0:'NEG', 3:'COM', 4:'LSR', 6:'ROR', 7:'ASR', 8:'ASL', 9:'ROL', 10:'DEC', 12:'INC', 13:'TST', 15:'CLR'})) {
	table[0x40 | i] = [`${op}A`, '', `${op}A`];
	table[0x50 | i] = [`${op}B`, '', `${op}B`];
	table[0x60 | i] = [`${op} ,X`, '', `${op}\t%s,X`, byte];
	table[0x70 | i] = [`${op} >nn`, '', `${op}\t%s`, word];
}
for (let [i, op] of Object.entries({1:'AIM', 2:'OIM', 5:'EIM', 11:'TIM'})) { // (HD63701)
	table[0x60 | i] = [`${op} ,X`, '', `${op}\t#%s,[%s,X]`, byte, byte];
	table[0x70 | i] = [`${op} <n`, '', `${op}\t#%s,<%s`, byte, byte];
}
for (let [i, op] of Object.entries({0:'SUBA', 1:'CMPA', 2:'SBCA', 4:'ANDA', 5:'BITA', 6:'LDAA', 8:'EORA', 9:'ADCA', 0xa:'ORAA', 0xb:'ADDA'}))
	table[0x80 | i] = [`${op} #n`, '', `${op}\t#%s`, byte];
for (let [i, op] of Object.entries({3:'SUBD', 0xc:'CPX', 0xe:'LDS'}))
	table[0x80 | i] = [`${op} #nn`, '', `${op}\t#%s`, word];
for (let [i, op] of Object.entries({0:'SUBA', 1:'CMPA', 2:'SBCA', 3:'SUBD', 4:'ANDA', 5:'BITA', 6:'LDAA', 7:'STAA', 8:'EORA', 9:'ADCA', 0xa:'ORAA', 0xb:'ADDA', 0xc:'CPX', 0xe:'LDS', 0xf:'STS'})) {
	table[0x90 | i] = [`${op} <n`, '', `${op}\t<%s`, byte];
	table[0xa0 | i] = [`${op} ,X`, '', `${op}\t%s,X`, byte];
	table[0xb0 | i] = [`${op} >nn`, '', `${op}\t%s`, word];
}
for (let [i, op] of Object.entries({0:'SUBB', 1:'CMPB', 2:'SBCB', 4:'ANDB', 5:'BITB', 6:'LDAB', 8:'EORB', 9:'ADCB', 0xa:'ORAB', 0xb:'ADDB'}))
	table[0xc0 | i] = [`${op} #n`, '', `${op}\t#%s`, byte];
for (let [i, op] of Object.entries({3:'ADDD', 0xc:'LDD', 0xe:'LDX'}))
	table[0xc0 | i] = [`${op} #nn`, '', `${op}\t#%s`, word];
for (let [i, op] of ['SUBB', 'CMPB', 'SBCB', 'ADDD', 'ANDB', 'BITB', 'LDAB', 'STAB', 'EORB', 'ADCB', 'ORAB', 'ADDB', 'LDD', 'STD', 'LDX', 'STX'].entries()) {
	table[0xd0 | i] = [`${op} <n`, '', `${op}\t<%s`, byte];
	table[0xe0 | i] = [`${op} ,X`, '', `${op}\t%s,X`, byte];
	table[0xf0 | i] = [`${op} >nn`, '', `${op}\t%s`, word];
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
	out += '\t\t\t*\tMC6801 disassembler\n';
	out += `\t\t\t*\tfilename: ${process.argv[parser.optind()]}\n`;
	out += '\t\t\t************************************************\n';
	out += `\t\t\t\torg\t$${x4(start)}\n`;
	out += '\t\t\t\n';
} else {
	out += '************************************************\n';
	out += '*\tMC6801 disassembler\n';
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
