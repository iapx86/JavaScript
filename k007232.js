/*
 *
 *	K007232 Sound Module
 *
 */

export default class K007232 {
	constructor({SND, clock, resolution = 1, gain = 0.1}) {
		this.resolution = resolution;
		this.gain = gain;
		this.tmpwheel = new Array(resolution);
		if (!audioCtx)
			return;
		this.source = audioCtx.createBufferSource();
		this.gainNode = audioCtx.createGain();
		this.gainNode.gain.value = gain;
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.reg = new Uint8Array(14);
		this.snd = Float32Array.from(SND, e => (e & 0x7f) * 2 / 127 - 1);
		this.rate = Math.floor(clock / 128);
		this.count = this.sampleRate - 1;
		this.wheel = [];
		this.cycles = 0;
		this.channel = [];
		for (let i = 0; i < 2; i++)
			this.channel.push({play: false, addr: 0});
		this.vol = 0;
		this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
		this.scriptNode.onaudioprocess = ({outputBuffer}) => {
			const reg = this.reg;
			outputBuffer.getChannelData(0).fill(0).forEach((e, i, data) => {
				for (this.count += 60 * resolution; this.count >= this.sampleRate; this.count -= this.sampleRate) {
					const q = this.wheel.shift();
					q && q.forEach(e => this.regwrite(e));
				}
				this.channel.forEach(ch => ch.play && (data[i] += this.snd[ch.addr >>> 12] * this.vol));
				for (this.cycles += this.rate; this.cycles >= this.sampleRate; this.cycles -= this.sampleRate)
					this.channel.forEach((ch, j) => {
						if (!ch.play)
							return;
						const rate = Math.floor(0x20000 / (0x200 - (reg[j * 6] | reg[1 + j * 6] << 8 & 0x100)));
						for (let addr = (ch.addr >>> 12) + 1, addr1 = (ch.addr += rate) >>> 12; addr <= addr1; addr++)
							if (addr >= SND.length || (SND[addr] & 0x80) !== 0) {
								if ((reg[13] & 1 << j) !== 0)
									ch.addr = (reg[2 + j * 6] | reg[3 + j * 6] << 8 | reg[4 + j * 6] << 16 & 0x10000) << 12;
								else
									ch.play = false;
								break;
							}
					});
			});
		};
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

	read(addr, timer = 0) {
		switch (addr &= 0xf) {
		case 5:
		case 11:
			if (this.tmpwheel[timer])
				this.tmpwheel[timer].push({addr, data: 0});
			else
				this.tmpwheel[timer] = [{addr, data: 0}];
			break;
		}
		return 0;
	}

	write(addr, data, timer = 0) {
		addr &= 0xf;
		if (this.tmpwheel[timer])
			this.tmpwheel[timer].push({addr, data});
		else
			this.tmpwheel[timer] = [{addr, data}];
	}

	update() {
		if (this.wheel) {
			if (this.wheel.length >= this.resolution) {
				this.wheel.forEach(q => q.forEach(e => this.regwrite(e)));
				this.count = this.sampleRate - 1;
				this.wheel.splice(0);
			}
			this.wheel = this.wheel.concat(this.tmpwheel);
		}
		this.tmpwheel = new Array(this.resolution);
	}

	regwrite({addr, data}) {
		const reg = this.reg;
		switch (addr) {
		case 5:
			this.channel[0].addr = (reg[2] | reg[3] << 8 | reg[4] << 16 & 0x10000) << 12;
			this.channel[0].play = this.channel[0].addr >> 12 < this.snd.length;
			break;
		case 11:
			this.channel[1].addr = (reg[8] | reg[9] << 8 | reg[10] << 16 & 0x10000) << 12;
			this.channel[1].play = this.channel[1].addr >> 12 < this.snd.length;
			break;
		case 12:
			this.vol = ((data & 0xf) + (data >>> 4)) / 30;
			break;
		}
		reg[addr] = data;
	}
}

