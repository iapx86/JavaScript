/*
 *
 *	AY-3-8910 Sound Module
 *
 */

class AY_3_8910 {
	constructor({clock, resolution = 1, gain = 0.1}) {
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.reg = new Uint8Array(0x10);
		this.tmp = new Uint8Array(0x10);
		this.rate = Math.floor(clock / 8);
		this.resolution = resolution;
		this.gain = gain;
		this.count = this.sampleRate - 1;
		this.wheel = [];
		this.tmpwheel = new Array(resolution);
		this.cycles = 0;
		this.channel = [];
		for (let i = 0; i < 3; i++)
			this.channel.push({freq: 0, count: 0, output: 0});
		this.ncount = 0;
		this.rng = 0xffff;
		this.ecount = 0;
		this.step = 0;
		this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
		this.scriptNode.onaudioprocess = ({outputBuffer}) => {
			const reg = this.reg;
			outputBuffer.getChannelData(0).fill(0).forEach((e, i, data) => {
				for (this.count += 60 * resolution; this.count >= this.sampleRate; this.count -= this.sampleRate) {
					const q = this.wheel.shift();
					q && q.forEach(e => this.checkwrite(e));
				}
				const nfreq = reg[6] & 0x1f, efreq = reg[11] | reg[12] << 8, etype = reg[13];
				const evol = (~this.step ^ ((((etype ^ etype >> 1) & this.step >> 4 ^ ~etype >> 2) & 1) - 1)) & (~etype >> 3 & this.step >> 4 & 1) - 1 & 15;
				this.channel.forEach((ch, j) => {
					ch.freq = reg[j * 2] | reg[1 + j * 2] << 8 & 0xf00;
					const vol = (reg[8 + j] >> 4 & 1) !== 0 ? evol : reg[8 + j] & 0x0f;
					data[i] += (((reg[7] >> j | ch.output) & (reg[7] >> j + 3 | this.rng) & 1) * 2 - 1) * (vol ? Math.pow(2, (vol - 15) / 2) : 0);
				});
				for (this.cycles += this.rate; this.cycles >= this.sampleRate; this.cycles -= this.sampleRate) {
					this.channel.forEach(ch => {
						if (++ch.count >= ch.freq) {
							ch.count = 0;
							ch.output = ~ch.output;
						}
					});
					if (++this.ncount >= nfreq << 1) {
						this.ncount = 0;
						this.rng = (this.rng >> 16 ^ this.rng >> 13 ^ 1) & 1 | this.rng << 1;
					}
					if (++this.ecount >= efreq) {
						this.ecount = 0;
						this.step += ((this.step < 16) | etype >> 3 & ~etype & 1) - (this.step >= 47) * 32;
					}
				}
			});
		};
		this.source = audioCtx.createBufferSource();
		this.gainNode = audioCtx.createGain();
		this.gainNode.gain.value = this.gain;
		this.source.connect(this.scriptNode);
		this.scriptNode.connect(this.gainNode);
		this.gainNode.connect(audioCtx.destination);
		this.source.start();
	}

	mute(flag) {
		this.gainNode.gain.value = flag ? 0 : this.gain;
	}

	read(addr) {
		return this.tmp[addr & 0x0f];
	}

	write(addr, data, timer = 0) {
		this.tmp[addr &= 0x0f] = data;
		if (addr >= 0x0e)
			return;
		if (this.tmpwheel[timer])
			this.tmpwheel[timer].push({addr, data});
		else
			this.tmpwheel[timer] = [{addr, data}];
	}

	update() {
		if (this.wheel.length >= this.resolution) {
			this.wheel.forEach(q => q.forEach(e => this.checkwrite(e)));
			this.count = this.sampleRate - 1;
			this.wheel = [];
		}
		this.wheel = this.wheel.concat(this.tmpwheel);
		this.tmpwheel = new Array(this.resolution);
	}

	checkwrite({addr, data}) {
		this.reg[addr] = data;
		if (addr === 13)
			this.step = 0;
	}
}

