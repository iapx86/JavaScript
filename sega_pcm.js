/*
 *
 *	SEGA PCM Sound Module
 *
 */

export default class SegaPCM {
	constructor({PCM, clock, resolution = 1, gain = 1}) {
		this.ram = new Uint8Array(0x800);
		this.resolution = resolution;
		this.gain = gain;
		this.tmpwheel = new Array(resolution);
		if (!audioCtx)
			return;
		this.source = audioCtx.createBufferSource();
		this.gainNode = audioCtx.createGain();
		this.gainNode.gain.value = gain;
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.reg = new Uint8Array(0x100);
		this.pcm = Float32Array.from(PCM, e => e * 2 / 255 - 1);
		this.rate = Math.floor(clock / 128);
		this.count = this.sampleRate - 1;
		this.wheel = [];
		this.cycles = 0;
		this.low = new Uint8Array(16);
		this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
		this.scriptNode.onaudioprocess = ({outputBuffer}) => {
			const reg = this.reg;
			outputBuffer.getChannelData(0).fill(0).forEach((e, i, data) => {
				for (this.count += 60 * resolution; this.count >= this.sampleRate; this.count -= this.sampleRate) {
					const q = this.wheel.shift();
					q && q.forEach(({addr, data}) => this.reg[addr] = data);
				}
				for (let j = 0; j < 0x80; j += 8)
					if ((reg[0x86 | j] & 1) === 0) {
						const vol = ((reg[2 | j] & 0x7f) + (reg[3 | j] & 0x7f)) / 0xfe;
						data[i] += this.pcm[reg[0x86 | j] << 12 & 0x70000 | reg[0x85 | j] << 8 | reg[0x84 | j]] * vol;
					}
				for (this.cycles += this.rate; this.cycles >= this.sampleRate; this.cycles -= this.sampleRate)
					for (let j = 0; j < 0x80; j += 8)
						if ((reg[0x86 | j] & 1) === 0) {
							const addr = (reg[0x85 | j] << 16 | reg[0x84 | j] << 8 | this.low[j >>> 3]) + reg[7 | j];
							reg[0x85 | j] = addr >>> 16;
							reg[0x84 | j] = addr >>> 8;
							this.low[j >>> 3] = addr;
							if (reg[0x85 | j] === (reg[6 | j] + 1 & 0xff)) {
								this.low[j >>> 3] = 0;
								if ((reg[0x86 | j] & 2) === 0) {
									reg[0x85 | j] = reg[5 | j];
									reg[0x84 | j] = reg[4 | j];
								} else
									reg[0x86 | j] |= 1;
							}
						}
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

	read(addr) {
		return this.ram[addr & 0x7ff];
	}

	write(addr, data, timer = 0) {
		this.ram[addr &= 0x7ff] = data;
		if (addr >= 0x100)
			return;
		if (this.tmpwheel[timer])
			this.tmpwheel[timer].push({addr, data});
		else
			this.tmpwheel[timer] = [{addr, data}];
	}

	update() {
		if (this.wheel) {
			if (this.wheel.length > this.resolution) {
				this.wheel.forEach(q => q.forEach(({addr, data}) => this.reg[addr] = data));
				this.count = this.sampleRate - 1;
				this.wheel.splice(0);
			}
			this.wheel = this.wheel.concat(this.tmpwheel);
		}
		this.tmpwheel = new Array(this.resolution);
	}
}

