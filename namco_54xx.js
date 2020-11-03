/*
 *
 *	Namco 54XX Sound Module
 *
 */

class BiquadFilter {
	b0 = 0;
	b1 = 0;
	b2 = 0;
	a1 = 0;
	a2 = 0;
	x1 = 0;
	x2 = 0;
	y1 = 0;
	y2 = 0;

	bandpass(freq, Q) {
		const w0 = 2 * Math.PI * freq / audioCtx.sampleRate, alpha = Math.sin(w0) / (2 * Q), a0 = 1 + alpha;
		this.b0 = alpha / a0, this.b1 = 0, this.b2 = -alpha / a0, this.a1 = -2 * Math.cos(w0) / a0, this.a2 = (1 - alpha) / a0;
	}

	filter(x) {
		const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
		this.x2 = this.x1, this.x1 = x, this.y2 = this.y1, this.y1 = y;
		return y;
	}
}

export default class Namco54XX {
	rate;
	sampleRate;
	gain;
	cycles = 0;
	channel = [];
	state = 0;
	rng = new Int32Array(4);

	source;
	gainNode;
	scriptNode;

	constructor({clock, gain = 0.5}) {
		this.rate = Math.floor(clock / 650);
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.gain = gain;
		for (let i = 0; i < 2; i++)
			this.channel.push({output: 0, vol: 0, state: 0, count: 0, vol3: 0, vol1: 0, count3: 0, count2: 0, count1: 0, bq: new BiquadFilter()});
		this.channel.push({output: 0, vol: 0, state: 0, count: 0, add1: 0, add2: 0, vol2: 0, count2: 0, count1: 0, bq: new BiquadFilter()});
		this.channel[0].bq.bandpass(200, 1);
		this.channel[1].bq.bandpass(200, 1);
		this.channel[2].bq.bandpass(2200, 1);
		if (!audioCtx)
			return;
		this.source = audioCtx.createBufferSource();
		this.gainNode = audioCtx.createGain();
		this.gainNode.gain.value = gain;
		this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
		this.scriptNode.onaudioprocess = ({outputBuffer}) => this.makeSound(outputBuffer.getChannelData(0).fill(0));
		this.source.connect(this.scriptNode);
		this.scriptNode.connect(this.gainNode);
		this.gainNode.connect(audioCtx.destination);
		this.source.start();
	}

	mute(flag) {
		if (!audioCtx)
			return;
		this.gainNode.gain.value = flag ? 0 : this.gain;
	}

	write(data) {
		switch (this.state) {
		default:
			switch (data >> 4) {
			case 1:
				return this.channel[0].vol = this.channel[0].vol3, this.channel[0].state = 3, void(this.channel[0].count = this.channel[0].count3 << 4);
			case 2:
				return this.channel[1].vol = this.channel[1].vol3, this.channel[1].state = 3, void(this.channel[1].count = this.channel[1].count3 << 4);
			case 3:
				return void(this.state = 0x37);
			case 4:
				return void(this.state = 0x3f);
			case 5:
				return this.channel[2].count = this.channel[2].count2, this.channel[2].vol = this.channel[2].vol2, void(this.channel[2].state = 2);
			case 6:
				return void(this.state = 0x29);
			case 7:
				return void(this.channel[2].vol = data & 15);
			default:
				return;
			}
		case 0x21:
			return this.channel[2].vol2 = data >> 4, this.channel[2].count2 |= data & 15, void(this.state = 0);
		case 0x23:
			return this.channel[2].count2 = data << 8 & 0xf00 | data & 0xf0, void(this.state = 0x21);
		case 0x25:
			return this.channel[2].count1 = data << 4 & 0xf0 | data >> 4, void(this.state = 0x23);
		case 0x27:
			return this.channel[2].add2 = data << 4 & 0xf0 | data >> 4, void(this.state = 0x25);
		case 0x29:
			return this.channel[2].add1 = data << 4 & 0xf0 | data >> 4, void(this.state = 0x27);
		case 0x31:
			return this.channel[0].vol3 = data >> 4, this.channel[0].vol1 = data & 15, void(this.state = 0);
		case 0x33:
			return this.channel[0].count1 = data << 4 & 0xf0 | data >> 4, void(this.state = 0x31);
		case 0x35:
			return this.channel[0].count2 = data << 4 & 0xf0 | data >> 4, void(this.state = 0x33);
		case 0x37:
			return this.channel[0].count3 = data << 4 & 0xf0 | data >> 4, void(this.state = 0x35);
		case 0x39:
			return this.channel[1].vol3 = data >> 4, this.channel[1].vol1 = data & 15, void(this.state = 0);
		case 0x3b:
			return this.channel[1].count1 = data << 4 & 0xf0 | data >> 4, void(this.state = 0x39);
		case 0x3d:
			return this.channel[1].count2 = data << 4 & 0xf0 | data >> 4, void(this.state = 0x3b);
		case 0x3f:
			return this.channel[1].count3 = data << 4 & 0xf0 | data >> 4, void(this.state = 0x3d);
		}
	}

	update() {
	}

	makeSound(data) {
		data.forEach((e, i) => {
			this.channel.forEach(ch => data[i] += ch.bq.filter(ch.output / 15));
			for (this.cycles += this.rate; this.cycles >= this.sampleRate; this.cycles -= this.sampleRate) {
				this.rng[0] = this.rng[0] >> 1 | (this.rng[0] << 14 ^ this.rng[0] << 3 ^ 0x10000) & 0x10000;
				this.channel[0].output = this.channel[0].vol & -((this.rng[0] & 1) !== 0), this.rng[1] = this.rng[1] << 1 | ((this.rng[0] & 1) !== 0);
				this.rng[2] += (this.rng[1] & 3) === 1;
				this.channel[1].output = this.channel[1].vol & -((this.rng[2] & 1) === 0);
				for (let i = 0; i < 2; i++)
					if (this.channel[i].state !== 0 && --this.channel[i].count < 0)
						switch (--this.channel[i].state) {
						case 2:
							this.channel[i].vol = 0;
							if (this.channel[i].count2 !== 0) {
								this.channel[i].count = this.channel[i].count2 << 4 | 15;
								break;
							}
							this.channel[i].state = 1;
							// fallthrough
						case 1:
							this.channel[i].vol = this.channel[i].vol1;
							if (this.channel[i].count1 !== 0) {
								this.channel[i].count = this.channel[i].count1 << 4 | 15;
								break;
							}
							this.channel[i].state = 0;
							// fallthrough
						default:
							if (this.channel[i].vol === 0)
								break;
							this.channel[i].vol = (this.channel[i].vol >> 1) + this.channel[i].vol >> 1, this.channel[i].state = 1;
							if (this.channel[i].count1 !== 0) {
								this.channel[i].count = this.channel[i].count1 << 4 | 15;
								break;
							}
							this.channel[i].state = 0, this.channel[i].vol = 0;
							break;
						}
				this.channel[2].output = this.channel[2].vol & -((this.rng[3] & 0x80) === 0);
				this.rng[3] += this.channel[2].add1 + (this.channel[2].add2 & -((this.rng[0] & 1) !== 0));
				if (this.channel[2].state !== 0 && --this.channel[2].count < 0)
					switch (--this.channel[2].state) {
					case 0:
						if ((this.channel[2].vol = (this.channel[2].vol >> 1) + this.channel[2].vol >> 1) === 0)
							break;
						this.channel[2].state = 1;
						// fallthrough
					default:
						if (this.channel[2].count1 !== 0) {
							this.channel[2].count = this.channel[2].count1 << 4;
							break;
						}
						this.channel[2].state = 0, this.channel[2].vol = 0;
						break;
					}
			}
		});
	}
}

