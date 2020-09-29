/*
 *
 *	SN76489 Sound Module
 *
 */

export default class SN76489 {
	rate;
	sampleRate;
	count;
	resolution;
	gain;
	tmpwheel = [];
	wheel = [];
	addr = 0;
	reg = new Uint16Array(8).fill(-1);
	cycles = 0;
	channel = [];
	ncount = 0;
	rng = 0x4000;

	source;
	gainNode;
	scriptNode;

	constructor({clock, resolution = 1, gain = 0.1}) {
		this.rate = Math.floor(clock / 16);
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.count = this.sampleRate - 1;
		this.resolution = resolution;
		this.gain = gain;
		for (let i = 0; i < resolution; i++)
			this.tmpwheel.push([]);
		for (let i = 0; i < 3; i++)
			this.channel.push({freq: 0, count: 0, output: 0});
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

	write(data, timer = 0) {
		this.tmpwheel[timer].push(data);
	}

	update() {
		if (audioCtx) {
			if (this.wheel.length > this.resolution) {
				while (this.wheel.length)
					this.wheel.shift().forEach(e => this.regwrite(e));
				this.count = this.sampleRate - 1;
			}
			this.tmpwheel.forEach(e => this.wheel.push(e));
		}
		for (let i = 0; i < this.resolution; i++)
			this.tmpwheel[i] = [];
	}

	makeSound(data) {
		const reg = this.reg;
		data.forEach((e, i) => {
			for (this.count += 60 * this.resolution; this.count >= this.sampleRate; this.count -= this.sampleRate)
				if (this.wheel.length)
					this.wheel.shift().forEach(e => this.regwrite(e));
			this.channel.forEach((ch, j) => {
				ch.freq = reg[j * 2];
				const vol = ~reg[j * 2 + 1] & 0xf;
				data[i] += ((ch.output & 1) * 2 - 1) * (vol ? Math.pow(10, (vol - 15) / 10) : 0);
			});
			const nfreq = (reg[6] & 3) === 3 ? this.channel[2].freq << 1 : 32 << (reg[6] & 3), nvol = ~reg[7] & 0xf;
			data[i] += ((this.rng & 1) * 2 - 1) * (nvol ? Math.pow(10, (nvol - 15) / 10) : 0);
			for (this.cycles += this.rate; this.cycles >= this.sampleRate; this.cycles -= this.sampleRate) {
				this.channel.forEach(ch => {
					if ((--ch.count & 0x3ff) === 0)
						ch.count = ch.freq, ch.output = ~ch.output;
				});
				if ((--this.ncount & 0x7ff) === 0)
					this.ncount = nfreq, this.rng = this.rng >> 1 | (this.rng << 14 ^ this.rng << 13 & reg[6] << 12) & 0x4000;
			}
		});
	}

	regwrite(data) {
		if ((data & 0x80) !== 0)
			this.addr = data >> 4 & 7, this.reg[this.addr] = this.reg[this.addr] & 0x3f0 | data & 0xf;
		else
			this.reg[this.addr] = this.reg[this.addr] & 0xf | data << 4 & 0x3f0;
		if (this.addr === 6)
			this.rng = 0x4000;
	}
}

