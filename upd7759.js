/*
 *
 *	uPD7759 Sound Module
 *
 */

export default class UPD7759 {
	base;
	rate;
	sampleRate;
	count;
	resolution;
	gain;
	tmpwheel = [];
	wheel = [];
	cycles = 0;
	md = true;
	signal = 0;
	port = [];
	m0 = {state: 'IDLE', count: 0, valid: false};
	m1 = {state: 'IDLE', count: 0, valid: false, cycles: 0, repeat: 0, num: 0, addr: 0, rate: 0};
	addr = 0;
	adpcm_state = 0;
	adpcm_data = 0;
	output = 0;

	source = audioCtx.createBufferSource();
	gainNode = audioCtx.createGain();
	scriptNode = audioCtx.createScriptProcessor(512, 1, 1);

	constructor({VOI, mode = true, clock = 640000, resolution = 1, gain = 0.5}) {
		this.base = VOI;
		this.rate = Math.floor(clock);
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.count = this.sampleRate - 1;
		this.resolution = resolution;
		this.gain = gain;
		for (let i = 0; i < resolution; i++)
			this.tmpwheel.push([]);
		this.md = mode;
		this.gainNode.gain.value = gain;
		this.scriptNode.onaudioprocess = ({outputBuffer}) => this.makeSound(outputBuffer.getChannelData(0));
		this.source.connect(this.scriptNode).connect(this.gainNode).connect(audioCtx.destination);
		this.source.start();
	}

	reset(state, timer = 0) {
		state & ~this.signal & 1 ? void(this.signal |= 2) : ~state & this.signal & 1 ? (!this.md && (this.m0.state = 'IDLE'), void this.tmpwheel[timer].push(256)) : void(0);
		return void(this.signal = this.signal & ~1 | state & 1);
	}

	start(state, timer = 0) {
		if (this.signal & 1 && ~state << 1 & this.signal & 2)
			this.md ? void this.tmpwheel[timer].push(257) : this.m0.state === 'IDLE' ? (this.m0.state = 'START', void this.tmpwheel[timer].push(257)) : void(0);
		return void(this.signal = this.signal & ~2 | state << 1 & 2);
	}

	busy() {
		return (this.md ? this.m1.state : this.m0.state) === 'IDLE';
	}

	write(data, timer = 0) {
		this.md ? void(this.port[0] = data) : (this.tmpwheel[timer].push(data), this.advance_state0(data));
	}

	update() {
		if (this.wheel.length > this.resolution) {
			while (this.wheel.length)
				this.wheel.shift().forEach(e => this.control(e));
			this.count = this.sampleRate - 1;
		}
		this.tmpwheel.forEach(e => this.wheel.push(e));
		for (let i = 0; i < this.resolution; i++)
			this.tmpwheel[i] = [];
	}

	makeSound(data) {
		data.forEach((e, i) => {
			for (this.count += 60 * this.resolution; this.count >= this.sampleRate; this.count -= this.sampleRate)
				this.wheel.length && this.wheel.shift().forEach(e => this.control(e));
			data[i] = this.output / 255;
			for (this.cycles += this.rate; this.cycles >= this.sampleRate; this.cycles -= this.sampleRate)
				this.m1.cycles <= 0 ? this.advance_state() : void(0), --this.m1.cycles;
		});
	}

	control(data) {
		if (data < 256)
			this.port.push(data);
		else if (data === 256) // reset
			this.m1.state = 'IDLE', this.m1.cycles = this.adpcm_state = this.output = 0;
		else if (data === 257) // start
			this.m1.state === 'IDLE' && (this.md ? void(0) : void this.port.splice(0), this.m1.state = 'START');
	}

	advance_state() {
		const next = () => { return this.md ? this.base[this.addr++] : this.port.length ? this.port.shift() : -1; };
		let data;
		switch (this.m1.state) {
		case 'IDLE':
			return void(this.m1.cycles = 4);
		case 'START':
			return this.m1.num = this.md ? this.port[0] : 0x10, this.addr = 0, this.m1.state = 'MAX_NUM', void(this.m1.cycles = 70 + 44 + 320);
		case 'MAX_NUM':
			return (data = next()) < 0 ? void(this.m1.cycles = 4) : (this.m1.state = data < this.m1.num ? 'IDLE' : 'DUMMY', void(this.m1.cycles = 28));
		case 'DUMMY':
			return next() < 0 ? void(this.m1.cycles = 4) : (this.addr = this.m1.num * 2 + 5, this.m1.state = 'ADDR_H', void(this.m1.cycles = 32));
		case 'ADDR_H':
			return (this.m1.addr = next()) < 0 ? void(this.m1.cycles = 4) : (this.m1.state = 'ADDR_L', void(this.m1.cycles = 44));
		case 'ADDR_L':
			return (data = next()) < 0 ? void(this.m1.cycles = 4) : (this.addr = (this.m1.addr << 8 | data) << 1, this.m1.state = 'DUMMY2', void(this.m1.cycles = 36));
		case 'DUMMY2':
			return next() < 0 ? void(this.m1.cycles = 4) : (this.m1.valid = false, this.m1.repeat = 0, this.m1.state = 'HEADER', void(this.m1.cycles = 36));
		case 'HEADER':
			this.m1.repeat && (--this.m1.repeat, this.addr = this.m1.addr);
			if ((data = next()) < 0)
				return void(this.m1.cycles = 4);
			data && (this.m1.valid = true);
			switch (data >> 6) {
			case 0:
				return this.adpcm_state = this.output = 0, this.m1.state = !data && this.m1.valid ? 'IDLE' : 'HEADER', void(this.m1.cycles = 1024 * ((data & 0x3f) + 1));
			case 1:
				return this.m1.rate = 4 * ((data & 0x3f) + 1), this.m1.count = 256, this.m1.state = 'NIBBLE_H', void(this.m1.cycles = 36);
			case 2:
				return this.m1.rate = 4 * ((data & 0x3f) + 1), this.m1.state = 'COUNT', void(this.m1.cycles = 36);
			case 3:
				return this.m1.repeat = (data & 7) + 1, this.m1.addr = this.addr, this.m1.state = 'HEADER', void(this.m1.cycles = 36);
			}
			return;
		case 'COUNT':
			return (data = next()) < 0 ? void(this.m1.cycles = 4) : (this.m1.count = data + 1, this.m1.state = 'NIBBLE_H', void(this.m1.cycles = 36));
		case 'NIBBLE_H':
			if ((this.adpcm_data = next()) < 0)
				return void(this.m1.cycles = 4);
			data = this.adpcm_data >> 4, this.output += step[this.adpcm_state][data], this.adpcm_state = Math.min(Math.max(this.adpcm_state + state_table[data], 0), 15);
			return this.m1.state = --this.m1.count ? 'NIBBLE_L' : 'HEADER', void(this.m1.cycles = this.m1.rate);
		case 'NIBBLE_L':
			data = this.adpcm_data & 15, this.output += step[this.adpcm_state][data], this.adpcm_state = Math.min(Math.max(this.adpcm_state + state_table[data], 0), 15);
			return this.m1.state = --this.m1.count ? 'NIBBLE_H' : 'HEADER', void(this.m1.cycles = this.m1.rate);
		}
	}

	advance_state0(data) {
		switch (this.m0.state) {
		case 'START':
			return this.m0.valid = false, this.m0.count = 5, void(this.m0.state = data < 0x10 ? 'IDLE' : 'DUMMY');
		case 'DUMMY':
			return void(this.m0.state = --this.m0.count > 0 ? 'DUMMY' : 'HEADER');
		case 'HEADER':
			data && (this.m0.valid = true);
			switch (data >> 6) {
			case 0:
				return void(this.m0.state = !data && this.m0.valid ? 'IDLE' : 'HEADER');
			case 1:
				return this.m0.count = 128, void(this.m0.state = 'NIBBLE');
			case 2:
				return void(this.m0.state = 'COUNT');
			case 3:
				return void(this.m0.state = 'HEADER');
			}
			break;
		case 'COUNT':
			return this.m0.count = data + 2 >> 1, void(this.m0.state = 'NIBBLE');
		case 'NIBBLE':
			return void(this.m0.state = --this.m0.count > 0 ? 'NIBBLE' : 'HEADER');
		}
	}
}

const step = [
	[ 0,  0,  1,  2,  3,   5,   7,  10,  0,   0,  -1,  -2,  -3,   -5,   -7,  -10 ],
	[ 0,  1,  2,  3,  4,   6,   8,  13,  0,  -1,  -2,  -3,  -4,   -6,   -8,  -13 ],
	[ 0,  1,  2,  4,  5,   7,  10,  15,  0,  -1,  -2,  -4,  -5,   -7,  -10,  -15 ],
	[ 0,  1,  3,  4,  6,   9,  13,  19,  0,  -1,  -3,  -4,  -6,   -9,  -13,  -19 ],
	[ 0,  2,  3,  5,  8,  11,  15,  23,  0,  -2,  -3,  -5,  -8,  -11,  -15,  -23 ],
	[ 0,  2,  4,  7, 10,  14,  19,  29,  0,  -2,  -4,  -7, -10,  -14,  -19,  -29 ],
	[ 0,  3,  5,  8, 12,  16,  22,  33,  0,  -3,  -5,  -8, -12,  -16,  -22,  -33 ],
	[ 1,  4,  7, 10, 15,  20,  29,  43, -1,  -4,  -7, -10, -15,  -20,  -29,  -43 ],
	[ 1,  4,  8, 13, 18,  25,  35,  53, -1,  -4,  -8, -13, -18,  -25,  -35,  -53 ],
	[ 1,  6, 10, 16, 22,  31,  43,  64, -1,  -6, -10, -16, -22,  -31,  -43,  -64 ],
	[ 2,  7, 12, 19, 27,  37,  51,  76, -2,  -7, -12, -19, -27,  -37,  -51,  -76 ],
	[ 2,  9, 16, 24, 34,  46,  64,  96, -2,  -9, -16, -24, -34,  -46,  -64,  -96 ],
	[ 3, 11, 19, 29, 41,  57,  79, 117, -3, -11, -19, -29, -41,  -57,  -79, -117 ],
	[ 4, 13, 24, 36, 50,  69,  96, 143, -4, -13, -24, -36, -50,  -69,  -96, -143 ],
	[ 4, 16, 29, 44, 62,  85, 118, 175, -4, -16, -29, -44, -62,  -85, -118, -175 ],
	[ 6, 20, 36, 54, 76, 104, 144, 214, -6, -20, -36, -54, -76, -104, -144, -214 ],
];

const state_table = [ -1, -1, 0, 0, 1, 2, 2, 3, -1, -1, 0, 0, 1, 2, 2, 3 ];
