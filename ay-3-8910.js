/*
 *
 *	AY-3-8910 Sound Module
 *
 */

export default class AY_3_8910 {
	rate;
	sampleRate;
	count;
	resolution;
	gain;
	tmpwheel = [];
	wheel = [];
	ram = new Uint8Array(0x10);
	reg = new Uint8Array(0x10);
	cycles = 0;
	channel = [];
	ncount = 0;
	rng = 0xffff;
	ecount = 0;
	step = 0;

	source;
	gainNode;
	scriptNode;

	constructor({clock, resolution = 1, gain = 0.1}) {
		this.rate = Math.floor(clock / 8);
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

	read(addr) {
		return this.ram[addr & 0xf];
	}

	write(addr, data, timer = 0) {
		this.ram[addr &= 0xf] = data;
		if (addr >= 0xe)
			return;
		this.tmpwheel[timer].push({addr, data});
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
			const nfreq = reg[6] & 0x1f, efreq = reg[11] | reg[12] << 8, etype = reg[13];
			const evol = (~this.step ^ ((((etype ^ etype >> 1) & this.step >> 4 ^ ~etype >> 2) & 1) - 1)) & (~etype >> 3 & this.step >> 4 & 1) - 1 & 15;
			this.channel.forEach((ch, j) => {
				ch.freq = reg[j * 2] | reg[1 + j * 2] << 8 & 0xf00;
				const vol = (reg[8 + j] >> 4 & 1) !== 0 ? evol : reg[8 + j] & 0xf;
				data[i] += (((ch.freq === 0 | reg[7] >> j | ch.output) & (reg[7] >> j + 3 | this.rng) & 1) * 2 - 1) * (vol ? Math.pow(10, (vol - 15) / 10) : 0);
			});
			for (this.cycles += this.rate; this.cycles >= this.sampleRate; this.cycles -= this.sampleRate) {
				this.channel.forEach(ch => {
					if (++ch.count >= ch.freq)
						ch.output = ~ch.output, ch.count = 0;
				});
				if (++this.ncount >= nfreq << 1)
					this.rng = (this.rng >> 16 ^ this.rng >> 13 ^ 1) & 1 | this.rng << 1, this.ncount = 0;
				if (++this.ecount >= efreq)
					this.step += ((this.step < 16) | etype >> 3 & ~etype & 1) - (this.step >= 47) * 32, this.ecount = 0;
			}
		});
	}

	regwrite({addr, data}) {
		this.reg[addr] = data;
		if (addr === 13)
			this.step = 0;
	}
}

