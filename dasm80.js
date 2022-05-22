/*
 *	Z80 disassembler
 */

const {readFileSync, writeFileSync} = require('fs');
const {basename} = require('path');
const {BasicParser} = require('posix-getopt');

const buffer = new Uint8Array(0x10000);
const jumplabel = new Array(buffer.length).fill(false), label = new Array(buffer.length).fill(false);
let location = 0, flags = '';

const char = s => s.charCodeAt(0);
const x2 = n => Number(n).toString(16).padStart(2, '0');
const x2z = n => Number(n).toString(16).padStart(2 + (n >= 0xa0), '0');
const x4 = n => Number(n).toString(16).padStart(4, '0');
const x4z = n => Number(n).toString(16).padStart(4 + (n >= 0xa000), '0');
const X2 = n => Number(n).toString(16).toUpperCase().padStart(2, '0');
const X4 = n => Number(n).toString(16).toUpperCase().padStart(4, '0');
const s8 = x => x & 0x7f | -(x & 0x80);
const fetch = () => buffer[location++];
const fetch16 = () => fetch() | fetch() << 8;
const byte = () => `${x2z(fetch())}h`;

function sbyte() {
	const operand = s8(fetch());
	return operand < 0 ? `-${x2(-operand)}h` : `+${x2(operand)}h`;
}

function word() {
	const operand = fetch16();
	return flags.includes('B') ? (jumplabel[operand] = true) : (label[operand] = true), `L${x4(operand)}`;
}

function relative() {
	const operand = s8(fetch()) + location & 0xffff;
	return jumplabel[operand] = true, `L${x4(operand)}`;
}

const table_fdcb = {};

for (let [i, op] of Object.entries({0x00:'RLC', 0x08:'RRC', 0x10:'RL', 0x18:'RR', 0x20:'SLA', 0x28:'SRA', 0x38:'SRL'}))
	table_fdcb[i | 6] = [`${op} (IY+d)`, '', `${op}\t(IY%s)`];
for (let [i, op] of Object.entries({0x40:'BIT', 0x80:'RES', 0xc0:'SET'}))
	for (let b = 0; b < 8; b++)
		table_fdcb[i | b << 3 | 6] = [`${op} ${b},(IY+d)`, '', `${op}\t${b},(IY%s)`];

function op_fdcb() {
	const d = sbyte(), opcode = fetch();
	if (!(opcode in table_fdcb))
		return '';
	return table_fdcb[opcode][2].toLowerCase().replace('%s', d);
}

const table_ddcb = {};

for (let [i, op] of Object.entries({0x00:'RLC', 0x08:'RRC', 0x10:'RL', 0x18:'RR', 0x20:'SLA', 0x28:'SRA', 0x38:'SRL'}))
	table_ddcb[i | 6] = [`${op} (IX+d)`, '', `${op}\t(IX%s)`];
for (let [i, op] of Object.entries({0x40:'BIT', 0x80:'RES', 0xc0:'SET'}))
	for (let b = 0; b < 8; b++)
		table_ddcb[i | b << 3 | 6] = [`${op} ${b},(IX+d)`, '', `${op}\t${b},(IX%s)`];

function op_ddcb() {
	const d = sbyte(), opcode = fetch();
	if (!(opcode in table_ddcb))
		return '';
	return table_ddcb[opcode][2].toLowerCase().replace('%s', d);
}

const table_fd = {
	0x09: ['ADD IY,BC',    '',   'ADD\tIY,BC'],
	0x19: ['ADD IY,DE',    '',   'ADD\tIY,DE'],
	0x21: ['LD IY,nn',     '',   'LD\tIY,%s',     word],
	0x22: ['LD (nn),IY',   '',   'LD\t(%s),IY',   word],
	0x23: ['INC IY',       '',   'INC\tIY'],
	0x24: ['INC IYH',      '',   'INC\tIYH'], // undefined operation
	0x25: ['DEC IYH',      '',   'DEC\tIYH'], // undefined operation
	0x26: ['LD IYH,n',     '',   'LD\tIYH,%s',    byte], // undefined operation
	0x29: ['ADD IY,IY',    '',   'ADD\tIY,IY'],
	0x2a: ['LD IY,(nn)',   '',   'LD\tIY,(%s)',   word],
	0x2b: ['DEC IY',       '',   'DEC\tIY'],
	0x2c: ['INC IYL',      '',   'INC\tIYL'], // undefined operation
	0x2d: ['DEC IYL',      '',   'DEC\tIYL'], // undefined operation
	0x2e: ['LD IYL,n',     '',   'LD\tIYL,%s',    byte], // undefined operation
	0x34: ['INC (IY+d)',   '',   'INC\t(IY%s)',   sbyte],
	0x35: ['DEC (IY+d)',   '',   'DEC\t(IY%s)',   sbyte],
	0x36: ['LD (IY+d),n',  '',   'LD\t(IY%s),%s', sbyte, byte],
	0x39: ['ADD IY,SP',    '',   'ADD\tIY,SP'],
	0x84: ['ADD A,IYH',    '',   'ADD\tA,IYH'], // undefined operation
	0x85: ['ADD A,IYL',    '',   'ADD\tA,IYL'], // undefined operation
	0x86: ['ADD A,(IY+d)', '',   'ADD\tA,(IY%s)', sbyte],
	0x8c: ['ADC A,IYH',    '',   'ADC\tA,IYH'], // undefined operation
	0x8d: ['ADC A,IYL',    '',   'ADC\tA,IYL'], // undefined operation
	0x8e: ['ADC A,(IY+d)', '',   'ADC\tA,(IY%s)', sbyte],
	0x94: ['SUB IYH',      '',   'SUB\tIYH'], // undefined operation
	0x95: ['SUB IYL',      '',   'SUB\tIYL'], // undefined operation
	0x96: ['SUB (IY+d)',   '',   'SUB\t(IY%s)',   sbyte],
	0x9c: ['SBC A,IYH',    '',   'SBC\tA,IYH'], // undefined operation
	0x9d: ['SBC A,IYL',    '',   'SBC\tA,IYL'], // undefined operation
	0x9e: ['SBC A,(IY+d)', '',   'SBC\tA,(IY%s)', sbyte],
	0xa4: ['AND IYH',      '',   'AND\tIYH'], // undefined operation
	0xa5: ['AND IYL',      '',   'AND\tIYL'], // undefined operation
	0xa6: ['AND (IY+d)',   '',   'AND\t(IY%s)',   sbyte],
	0xac: ['XOR IYH',      '',   'XOR\tIYH'], // undefined operation
	0xad: ['XOR IYL',      '',   'XOR\tIYL'], // undefined operation
	0xae: ['XOR (IY+d)',   '',   'XOR\t(IY%s)',   sbyte],
	0xb4: ['OR IYH',       '',   'OR\tIYH'], // undefined operation
	0xb5: ['OR IYL',       '',   'OR\tIYL'], // undefined operation
	0xb6: ['OR (IY+d)',    '',   'OR\t(IY%s)',    sbyte],
	0xbc: ['CP IYH',       '',   'CP\tIYH'], // undefined operation
	0xbd: ['CP IYL',       '',   'CP\tIYL'], // undefined operation
	0xbe: ['CP (IY+d)',    '',   'CP\t(IY%s)',    sbyte],
	0xcb: ['',             '',   '%s',            op_fdcb],
	0xe1: ['POP IY',       '',   'POP\tIY'],
	0xe3: ['EX (SP),IY',   '',   'EX\t(SP),IY'],
	0xe5: ['PUSH IY',      '',   'PUSH\tIY'],
	0xe9: ['JP (IY)',      'A',  'JP\t(IY)'],
	0xf9: ['LD SP,IY',     '',   'LD\tSP,IY'],
};

for (let [i, r] of Object.entries({0:'B', 1:'C', 2:'D', 3:'E', 4:'H', 5:'L', 7:'A'})) {
	table_fd[0x46 | i << 3] = [`LD ${r},(IY+d)`, '', `LD\t${r},(IY%s)`, sbyte];
	table_fd[0x70 | i] = [`LD (IY+d),${r}`, '', `LD\t(IY%s),${r}`, sbyte];
}
for (let [i, r] of Object.entries({0:'B', 1:'C', 2:'D', 3:'E', 7:'A'})) {
	table_fd[0x44 | i << 3] = [`LD ${r},IYH`, '', `LD\t${r},IYH`]; // undefined operation
	table_fd[0x45 | i << 3] = [`LD ${r},IYL`, '', `LD\t${r},IYL`]; // undefined operation
	table_fd[0x60 | i] = [`LD IYH,${r}`, '', `LD\tIYH,${r}`]; // undefined operation
	table_fd[0x68 | i] = [`LD IYL,${r}`, '', `LD\tIYL,${r}`]; // undefined operation
}

function op_fd() {
	const opcode = fetch();
	if (!(opcode in table_fd))
		return '';
	const a = table_fd[opcode];
	return flags = a[1], a.slice(3).reduce((a, b) => a.replace('%s', b()), a[2].toLowerCase());
}

const table_ed = {
	0x44: ['NEG',    '',   'NEG'],
	0x45: ['RETN',   'A',  'RETN'],
	0x46: ['IM 0',   '',   'IM\t0'],
	0x47: ['LD I,A', '',   'LD\tI,A'],
	0x4d: ['RETI',   'A',  'RETI'],
	0x4f: ['LD R,A', '',   'LD\tR,A'],
	0x56: ['IM 1',   '',   'IM\t1'],
	0x57: ['LD A,I', '',   'LD\tA,I'],
	0x5e: ['IM 2',   '',   'IM\t2'],
	0x5f: ['LD A,R', '',   'LD\tA,R'],
	0x67: ['RRD',    '',   'RRD'],
	0x6f: ['RLD',    '',   'RLD'],
	0xa0: ['LDI',    '',   'LDI'],
	0xa1: ['CPI',    '',   'CPI'],
	0xa2: ['INI',    '',   'INI'],
	0xa3: ['OUTI',   '',   'OUTI'],
	0xa8: ['LDD',    '',   'LDD'],
	0xa9: ['CPD',    '',   'CPD'],
	0xaa: ['IND',    '',   'IND'],
	0xab: ['OUTD',   '',   'OUTD'],
	0xb0: ['LDIR',   '',   'LDIR'],
	0xb1: ['CPIR',   '',   'CPIR'],
	0xb2: ['INIR',   '',   'INIR'],
	0xb3: ['OTIR',   '',   'OTIR'],
	0xb8: ['LDDR',   '',   'LDDR'],
	0xb9: ['CPDR',   '',   'CPDR'],
	0xba: ['INDR',   '',   'INDR'],
	0xbb: ['OTDR',   '',   'OTDR'],
};

for (let [i, r] of Object.entries({0:'B', 1:'C', 2:'D', 3:'E', 4:'H', 5:'L', 7:'A'})) {
	table_ed[0x40 | i << 3] = [`IN ${r},(C)`, '', `IN\t${r},(C)`];
	table_ed[0x41 | i << 3] = [`OUT (C),${r}`, '', `OUT\t(C),${r}`];
}
for (let [i, rr] of ['BC', 'DE', 'HL', 'SP'].entries()) {
	table_ed[0x42 | i << 4] = [`SBC HL,${rr}`, '', `SBC\tHL,${rr}`];
	table_ed[0x4a | i << 4] = [`ADC HL,${rr}`, '', `ADC\tHL,${rr}`];
}
for (let [i, rr] of Object.entries({0:'BC', 1:'DE', 3:'SP'})) {
	table_ed[0x43 | i << 4] = [`LD (nn),${rr}`, '', `LD\t(%s),${rr}`, word];
	table_ed[0x4b | i << 4] = [`LD ${rr},(nn)`, '', `LD\t${rr},(%s)`, word];
}

function op_ed() {
	const opcode = fetch();
	if (!(opcode in table_ed))
		return '';
	const a = table_ed[opcode];
	return flags = a[1], a.slice(3).reduce((a, b) => a.replace('%s', b()), a[2].toLowerCase());
}

const table_dd = {
	0x09: ['ADD IX,BC',    '',   'ADD\tIX,BC'],
	0x19: ['ADD IX,DE',    '',   'ADD\tIX,DE'],
	0x21: ['LD IX,nn',     '',   'LD\tIX,%s',      word],
	0x22: ['LD (nn),IX',   '',   'LD\t(%s),IX',    word],
	0x23: ['INC IX',       '',   'INC\tIX'],
	0x24: ['INC IXH',      '',   'INC\tIXH'], // undefined operation
	0x25: ['DEC IXH',      '',   'DEC\tIXH'], // undefined operation
	0x26: ['LD IXH,n',     '',   'LD\tIXH,%s',    byte], // undefined operation
	0x29: ['ADD IX,IX',    '',   'ADD\tIX,IX'],
	0x2a: ['LD IX,(nn)',   '',   'LD\tIX,(%s)',   word],
	0x2b: ['DEC IX',       '',   'DEC\tIX'],
	0x2c: ['INC IXL',      '',   'INC\tIXL'], // undefined operation
	0x2d: ['DEC IXL',      '',   'DEC\tIXL'], // undefined operation
	0x2e: ['LD IXL,n',     '',   'LD\tIXL,%s',    byte], // undefined operation
	0x34: ['INC (IX+d)',   '',   'INC\t(IX%s)',   sbyte],
	0x35: ['DEC (IX+d)',   '',   'DEC\t(IX%s)',   sbyte],
	0x36: ['LD (IX+d),n',  '',   'LD\t(IX%s),%s', sbyte, byte],
	0x39: ['ADD IX,SP',    '',   'ADD\tIX,SP'],
	0x84: ['ADD A,IXH',    '',   'ADD\tA,IXH'], // undefined operation
	0x85: ['ADD A,IXL',    '',   'ADD\tA,IXL'], // undefined operation
	0x86: ['ADD A,(IX+d)', '',   'ADD\tA,(IX%s)', sbyte],
	0x8c: ['ADC A,IXH',    '',   'ADC\tA,IXH'], // undefined operation
	0x8d: ['ADC A,IXL',    '',   'ADC\tA,IXL'], // undefined operation
	0x8e: ['ADC A,(IX+d)', '',   'ADC\tA,(IX%s)', sbyte],
	0x94: ['SUB IXH',      '',   'SUB\tIXH'], // undefined operation
	0x95: ['SUB IXL',      '',   'SUB\tIXL'], // undefined operation
	0x96: ['SUB (IX+d)',   '',   'SUB\t(IX%s)',   sbyte],
	0x9c: ['SBC A,IXH',    '',   'SBC\tA,IXH'], // undefined operation
	0x9d: ['SBC A,IXL',    '',   'SBC\tA,IXL'], // undefined operation
	0x9e: ['SBC A,(IX+d)', '',   'SBC\tA,(IX%s)', sbyte],
	0xa4: ['AND IXH',      '',   'AND\tIXH'], // undefined operation
	0xa5: ['AND IXL',      '',   'AND\tIXL'], // undefined operation
	0xa6: ['AND (IX+d)',   '',   'AND\t(IX%s)',   sbyte],
	0xac: ['XOR IXH',      '',   'XOR\tIXH'], // undefined operation
	0xad: ['XOR IXL',      '',   'XOR\tIXL'], // undefined operation
	0xae: ['XOR (IX+d)',   '',   'XOR\t(IX%s)',   sbyte],
	0xb4: ['OR IXH',       '',   'OR\tIXH'], // undefined operation
	0xb5: ['OR IXL',       '',   'OR\tIXL'], // undefined operation
	0xb6: ['OR (IX+d)',    '',   'OR\t(IX%s)',    sbyte],
	0xbc: ['CP IXH',       '',   'CP\tIXH'], // undefined operation
	0xbd: ['CP IXL',       '',   'CP\tIXL'], // undefined operation
	0xbe: ['CP (IX+d)',    '',   'CP\t(IX%s)',    sbyte],
	0xcb: ['',             '',   '%s',            op_ddcb],
	0xe1: ['POP IX',       '',   'POP\tIX'],
	0xe3: ['EX (SP),IX',   '',   'EX\t(SP),IX'],
	0xe5: ['PUSH IX',      '',   'PUSH\tIX'],
	0xe9: ['JP (IX)',      'A',  'JP\t(IX)'],
	0xf9: ['LD SP,IX',     '',   'LD\tSP,IX'],
};

for (let [i, r] of Object.entries({0:'B', 1:'C', 2:'D', 3:'E', 4:'H', 5:'L', 7:'A'})) {
	table_dd[0x46 | i << 3] = [`LD ${r},(IX+d)`, '', `LD\t${r},(IX%s)`, sbyte];
	table_dd[0x70 | i] = [`LD (IX+d),${r}`, '', `LD\t(IX%s),${r}`, sbyte];
}
for (let [i, r] of Object.entries({0:'B', 1:'C', 2:'D', 3:'E', 7:'A'})) {
	table_dd[0x44 | i << 3] = [`LD ${r},IXH`, '', `LD\t${r},IXH`]; // undefined operation
	table_dd[0x45 | i << 3] = [`LD ${r},IXL`, '', `LD\t${r},IXL`]; // undefined operation
	table_dd[0x60 | i] = [`LD IXH,${r}`, '', `LD\tIXH,${r}`]; // undefined operation
	table_dd[0x68 | i] = [`LD IXL,${r}`, '', `LD\tIXL,${r}`]; // undefined operation
}

function op_dd() {
	const opcode = fetch();
	if (!(opcode in table_dd))
		return '';
	const a = table_dd[opcode];
	return flags = a[1], a.slice(3).reduce((a, b) => a.replace('%s', b()), a[2].toLowerCase());
}

const table_cb = {};

for (let [i, op] of Object.entries({0x00:'RLC', 0x08:'RRC', 0x10:'RL', 0x18:'RR', 0x20:'SLA', 0x28:'SRA', 0x38:'SRL'}))
	for (let [j, r] of ['B', 'C', 'D', 'E', 'H', 'L', '(HL)', 'A'].entries())
		table_cb[i | j] = [`${op} ${r}`, '', `${op}\t${r}`];
for (let [i, op] of Object.entries({0x40:'BIT', 0x80:'RES', 0xc0:'SET'}))
	for (let b = 0; b < 8; b++)
		for (let [j, r] of ['B', 'C', 'D', 'E', 'H', 'L', '(HL)', 'A'].entries())
			table_cb[i | b << 3 | j] = [`${op} ${b},${r}`, '', `${op}\t${b},${r}`];

function op_cb() {
	const opcode = fetch();
	if (!(opcode in table_cb))
		return '';
	return table_cb[opcode][2].toLowerCase();
}

const table = {
	0x00: ['NOP',        '',   'NOP'],
	0x02: ['LD (BC),A',  '',   'LD\t(BC),A'],
	0x07: ['RLCA',       '',   'RLCA'],
	0x08: ['EX AF,AF\'', '',   'EX\tAF,AF\''],
	0x0a: ['LD A,(BC)',  '',   'LD\tA,(BC)'],
	0x0f: ['RRCA',       '',   'RRCA'],
	0x10: ['DJNZ e',     'B',  'DJNZ\t%s',    relative],
	0x12: ['LD (DE),A',  '',   'LD\t(DE),A'],
	0x17: ['RLA',        '',   'RLA'],
	0x18: ['JR e',       'AB', 'JR\t%s',      relative],
	0x1a: ['LD A,(DE)',  '',   'LD\tA,(DE)'],
	0x1f: ['RRA',        '',   'RRA'],
	0x20: ['JR NZ,e',    'B',  'JR\tNZ,%s',   relative],
	0x22: ['LD (nn),HL', '',   'LD\t(%s),HL', word],
	0x27: ['DAA',        '',   'DAA'],
	0x28: ['JR Z,e',     'B',  'JR\tZ,%s',    relative],
	0x2a: ['LD HL,(nn)', '',   'LD\tHL,(%s)', word],
	0x2f: ['CPL',        '',   'CPL'],
	0x30: ['JR NC,e',    'B',  'JR\tNC,%s',   relative],
	0x32: ['LD (nn),A',  '',   'LD\t(%s),A',  word],
	0x37: ['SCF',        '',   'SCF'],
	0x38: ['JR C,e',     'B',  'JR\tC,%s',    relative],
	0x3a: ['LD A,(nn)',  '',   'LD\tA,(%s)',  word],
	0x3f: ['CCF',        '',   'CCF'],
	0x76: ['HALT',       '',   'HALT'],
	0xc3: ['JP nn',      'AB', 'JP\t%s',      word],
	0xc6: ['ADD A,n',    '',   'ADD\tA,%s',   byte],
	0xc9: ['RET',        'A',  'RET'],
	0xcb: ['',           '',   '%s',          op_cb],
	0xcd: ['CALL nn',    'B',  'CALL\t%s',    word],
	0xce: ['ADC A,n',    '',   'ADC\tA,%s',   byte],
	0xd3: ['OUT n,A',    'B',  'OUT\t%s,A',   byte],
	0xd6: ['SUB n',      '',   'SUB\t%s',     byte],
	0xd9: ['EXX',        '',   'EXX'],
	0xdb: ['IN A,n',     '',   'IN\tA,%s',    byte],
	0xdd: ['',           '',   '%s',          op_dd],
	0xde: ['SBC A,n',    '',   'SBC\tA,%s',   byte],
	0xe3: ['EX (SP),HL', '',   'EX\t(SP),HL'],
	0xe6: ['AND n',      '',   'AND\t%s',     byte],
	0xe9: ['JP (HL)',    'A',  'JP\t(HL)'],
	0xeb: ['EX DE,HL',   '',   'EX\tDE,HL'],
	0xed: ['',           '',   '%s',          op_ed],
	0xee: ['XOR n',      '',   'XOR\t%s',     byte],
	0xf3: ['DI',         '',   'DI'],
	0xf6: ['OR n',       '',   'OR\t%s',      byte],
	0xf9: ['LD SP,HL',   '',   'LD\tSP,HL'],
	0xfb: ['EI',         '',   'EI'],
	0xfd: ['',           '',   '%s',          op_fd],
	0xfe: ['CP n',       '',   'CP\t%s',      byte],
};

for (let [i, rr] of ['BC', 'DE', 'HL', 'SP'].entries()) {
	table[0x01 | i << 4] = [`LD ${rr},nn`, '', `LD\t${rr},%s`, word];
	table[0x03 | i << 4] = [`INC ${rr}`, '', `INC\t${rr}`];
	table[0x09 | i << 4] = [`ADD HL,${rr}`, '', `ADD\tHL,${rr}`];
	table[0x0b | i << 4] = [`DEC ${rr}`, '', `DEC\t${rr}`];
}
for (let [i, r] of ['B', 'C', 'D', 'E', 'H', 'L', '(HL)', 'A'].entries()) {
	table[0x04 | i << 3] = [`INC ${r}`, '', `INC\t${r}`];
	table[0x05 | i << 3] = [`DEC ${r}`, '', `DEC\t${r}`];
	table[0x06 | i << 3] = [`LD ${r},n`, '', `LD\t${r},%s`, byte];
	table[0x80 | i] = [`ADD A,${r}`, '', `ADD\tA,${r}`];
	table[0x88 | i] = [`ADC A,${r}`, '', `ADC\tA,${r}`];
	table[0x90 | i] = [`SUB ${r}`, '', `SUB\t${r}`];
	table[0x98 | i] = [`SBC A,${r}`, '', `SBC\tA,${r}`];
	table[0xa0 | i] = [`AND ${r}`, '', `AND\t${r}`];
	table[0xa8 | i] = [`XOR ${r}`, '', `XOR\t${r}`];
	table[0xb0 | i] = [`OR ${r}`, '', `OR\t${r}`];
	table[0xb8 | i] = [`CP ${r}`, '', `CP\t${r}`];
}
for (let [i, r] of ['B', 'C', 'D', 'E', 'H', 'L', '(HL)', 'A'].entries())
	for (let [j, s] of ['B', 'C', 'D', 'E', 'H', 'L', '(HL)', 'A'].entries())
		if (r !== '(HL)' || s !== '(HL)')
			table[0x40 | i << 3 | j] = [`LD ${r},${s}`, '', `LD\t${r},${s}`];
for (let [i, cc] of ['NZ', 'Z', 'NC', 'C', 'PO', 'PE', 'P', 'M'].entries()) {
	table[0xc0 | i << 3] = [`RET ${cc}`, '', `RET\t${cc}`];
	table[0xc2 | i << 3] = [`JP ${cc},nn`, 'B', `JP\t${cc},%s`, word];
	table[0xc4 | i << 3] = [`CALL ${cc},nn`, 'B', `CALL\t${cc},%s`, word];
}
for (let [i, qq] of ['BC', 'DE', 'HL', 'AF'].entries()) {
	table[0xc1 | i << 4] = [`POP ${qq}`, '', `POP\t${qq}`];
	table[0xc5 | i << 4] = [`PUSH ${qq}`, '', `PUSH\t${qq}`];
}
for (let p = 0; p < 0x40; p += 8)
	table[0xc7 | p] = [`RST ${x2(p)}h`, '', `RST\t${x2(p)}h`];

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
	out += '\t\t\t;-----------------------------------------------\n';
	out += '\t\t\t;\tZ80 disassembler\n';
	out += `\t\t\t;\tfilename: ${process.argv[parser.optind()]}\n`;
	out += '\t\t\t;-----------------------------------------------\n';
	out += `\t\t\t\torg\t${x4z(start)}h\n`;
	out += '\t\t\t\n';
} else {
	out += ';-----------------------------------------------\n';
	out += ';\tZ80 disassembler\n';
	out += `';\tfilename: ${process.argv[parser.optind()]}\n`;
	out += ';-----------------------------------------------\n';
	out += `\torg\t${x4z(start)}h\n`;
	out += '\n';
}
for (location = start; location < end;) {
	const base = location;
	let i;
	if (base in remark)
		for (let s of remark[base])
			listing && (out += `${X4(base)}\t\t\t`), out += `;${s}\n`;
	switch (String.fromCharCode(attrib[base])) {
	case 'C':
		const s = op(), size = location - base;
		listing && (out += `${X4(base)} ${Array.from(buffer.slice(base, location), e => ` ${X2(e)}`).join('')}${'\t'.repeat(26 - size * 3 >> 3)}`);
		jumplabel[base] && (out += `L${x4(base)}:`);
		out += s ? `\t${s}\n` : `\tdb\t${Array.from(buffer.slice(base, location), e => `${x2z(e)}h`).join(',')}\n`;
		break;
	case 'S':
		listing && (out += `${X4(base)}\t\t\t`), label[base] && (out += `L${x4(base)}:`);
		for (out += `\tdb\t'${String.fromCharCode(fetch())}`; location < end && attrib[location] === char('S') && !label[location]; out += String.fromCharCode(fetch())) {}
		out += `'\n`;
		break;
	case 'B':
		listing && (out += `${X4(base)}\t\t\t`), label[base] && (out += `L${x4(base)}:`);
		for (out += `\tdb\t${x2z(fetch())}h`, i = 0; i < 7 && location < end && attrib[location] === char('B') && !label[location]; out += `,${x2z(fetch())}h`, i++) {}
		out += '\n';
		break;
	case 'P':
		listing && (out += `${X4(base)}\t\t\t`), label[base] && (out += `L${x4(base)}:`);
		for (out += `\tdw\tL${x4(fetch16())}`, i = 0; i < 3 && location < end && attrib[location] === char('P') && !label[location]; out += `,L${x4(fetch16())}`, i++) {}
		out += '\n';
		break;
	default:
		const c = fetch();
		listing && (out += `${X4(base)}  ${X2(c)}\t\t`), label[base] && (out += `L${x4(base)}:`);
		out += `\tdb\t${x2z(c)}h`, c >= 0x20 && c < 0x7f && (out += `\t;'${String.fromCharCode(c)}'`), out += '\n';
		break;
	}
}
listing && (out += `${X4(location & 0xffff)}\t\t\t`), out += '\tend\n';
file ? writeFileSync(file, out, 'utf-8') : console.log(out);
