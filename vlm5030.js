/*
 *
 *	VLM5030 Sound Module
 *
 */

export default class VLM5030 {
	constructor({VLM, clock, gain = 0.1}) {
		this.base = VLM;
		this.BSY = 0;
		this.gain = gain;
		if (!audioCtx)
			return;
		this.source = audioCtx.createBufferSource();
		this.gainNode = audioCtx.createGain();
		this.gainNode.gain.value = gain;
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.rate = Math.floor(clock / 440);
		this.cycles = this.sampleRate - 1;
		this.param = 0;
		this.offset = 0;
		this.icount = 0;
		this.scount = 0;
		this.pcount = 0;
		this.pitch0 = 0;
		this.energy0 = 0;
		this.k0 = new Int16Array(10);
		this.npitch = 0;
		this.nenergy = 0;
		this.nk = new Int16Array(10);
		this.pitch1 = 0;
		this.energy1 = 0;
		this.k1 = this.k0;
		this.pitch = 0;
		this.energy = 0;
		this.k = new Int16Array(10);
		this.x = new Int32Array(10);
		this.output = 0;
		this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
		this.scriptNode.onaudioprocess = ({outputBuffer}) => {
			outputBuffer.getChannelData(0).forEach((e, i, data) => {
				data[i] = this.output;
				for (this.cycles += this.rate; this.cycles >= this.sampleRate; this.cycles -= this.sampleRate) {
					if (this.BSY === 0)
						continue;
					if (this.scount === 0) {
						this.scount = [40, 30, 20, 20, 40, 60, 50, 50][this.param >>> 3 & 7];
						if (this.icount === 0) {
							[this.pitch0, this.energy0, this.k0] = [this.npitch, this.nenergy, this.nk];
							this.npitch = this.nenergy = 0;
							this.nk = new Int16Array(10);
							const frame = this.base.subarray(this.offset);
							if ((frame[0] & 1) === 0) {
								this.npitch = VLM5030.table.p[frame[0] >>> 1 & 0x1f] + [0, 8, -8, -8][this.param >>> 6 & 3] & 0xff;
								this.nenergy = VLM5030.table.e[frame[0] >>> 6 | frame[1] << 2 & 0x1c];
								this.nk[9] = VLM5030.table.k4_9[frame[1] >>> 3 & 7];
								this.nk[8] = VLM5030.table.k4_9[frame[1] >>> 6 | frame[2] << 2 & 4];
								this.nk[7] = VLM5030.table.k4_9[frame[2] >>> 1 & 7];
								this.nk[6] = VLM5030.table.k4_9[frame[2] >>> 4 & 7];
								this.nk[5] = VLM5030.table.k4_9[frame[2] >>> 7 | frame[3] << 1 & 6];
								this.nk[4] = VLM5030.table.k4_9[frame[3] >>> 2 & 7];
								this.nk[3] = VLM5030.table.k2_3[frame[3] >>> 5 | frame[4] << 3 & 8];
								this.nk[2] = VLM5030.table.k2_3[frame[4] >>> 1 & 0xf];
								this.nk[1] = VLM5030.table.k1[frame[4] >>> 5 | frame[5] << 3 & 0x18];
								this.nk[0] = VLM5030.table.k0[frame[5] >>> 2];
								this.offset += 6;
								this.icount = 4;
							}
							else if ((frame[0] & 2) === 0) {
								this.offset++;
								this.icount = (frame[0] & 0xc) + 4 << 1;
							}
							else if (this.energy0 !== 0)
								this.icount = 4;
							else {
								this.BSY = 0;
								continue;
							}
							if (this.energy0 !== 0)
								[this.pitch1, this.energy1, this.k1] = [this.npitch, this.nenergy, this.nk];
							else
								[this.pitch1, this.energy1, this.k1] = [this.pitch0, this.energy0, this.k0];
						}
						const ieffect = ~(this.icount -= [1, 2, 4, 4][this.param & 3]) & 3 + 1;
						this.pitch = this.pitch0 > 1 ? this.pitch0 + ((this.pitch1 - this.pitch0) * ieffect >> 2) : 0;
						this.energy = this.energy0 + ((this.energy1 - this.energy0) * ieffect >> 2);
						for (let i = 0; i < 10; i++)
							this.k[i] = this.k0[i] + ((this.k1[i] - this.k0[i]) * ieffect >> 2);
					}
					const u = new Int32Array(11);
					u[10] = this.pitch0 > 1 ? this.energy * (this.pcount === 0) : Math.random() >= 0.5 ? this.energy : -this.energy;
					for (let i = 9; i >= 0; --i)
						u[i] = u[i + 1] + (this.k[i] * this.x[i] >> 9);
					for (let i = 9; i >= 1; --i)
						this.x[i] = this.x[i - 1] - (this.k[i - 1] * u[i - 1] >> 9);
					this.x[0] = u[0];
					this.output = Math.min(1, Math.max(-1, u[0] / 511));
					--this.scount;
					if (++this.pcount >= this.pitch)
						this.pcount = 0;
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

	update() {
	}

	rst(data) {
		if (!audioCtx)
			return this;
		if (this.BSY) {
			this.BSY = 0;
			this.offset = 0;
			this.icount = this.scount = this.pcount = 0;
			this.pitch0 = this.energy0 = 0;
			this.k0.fill(0);
			this.npitch = this.nenergy = 0;
			this.nk.fill(0);
			this.pitch1 = this.energy1 = 0;
			this.k1 = this.k0;
			this.pitch = this.energy = 0;
			this.k.fill(0);
			this.x.fill(0);
			this.output = 0;
		}
		this.param = data;
		return this;
	}

	st(data) {
		if (!audioCtx)
			return this;
		const offset = data & 0xfe | data << 8 & 0x100;
		this.offset = (this.base[offset] << 8 | this.base[offset + 1]) & this.base.length - 1;
		this.scount = [40, 30, 20, 20, 40, 60, 50, 50][this.param >>> 3 & 7];
		this.icount = 4;
		this.BSY = 1;
		return this;
	}
}

VLM5030.table = {
	p: new Uint8Array([0, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 33, 35, 37, 39, 41, 43, 45, 49, 53, 57, 61, 65, 69, 73, 77, 85, 93, 101, 109, 117, 125]),
	e: new Uint8Array([0, 1, 2, 3, 5, 6, 7, 9, 11, 13, 15, 17, 19, 22, 24, 27, 31, 34, 38, 42, 47, 51, 57, 62, 68, 75, 82, 89, 98, 107, 116, 127]),
	k4_9: new Int16Array([0, 128, 256, 384, -512, -384, -256, -128]),
	k2_3: new Int16Array([0, 64, 128, 192, 256, 320, 384, 448, -512, -448, -384, -320, -256, -192, -128, -64]),
	k1: new Int16Array([0, 50, 100, 149, 196, 241, 284, 325, 362, 396, 426, 452, 473, 490, 502, 510, 0, -510, -502, -490, -473, -452, -426, -396, -362, -325, -284, -241, -196, -149, -100, -50]),
	k0: new Int16Array([390, 403, 414, 425, 434, 443, 450, 457, 463, 469, 474, 478, 482, 485, 488, 491, 494, 496, 498, 499, 501, 502, 503, 504, 505, 506, 507, 507, 508, 508, 509, 509,
		-390,-376,-360,-344,-325,-305,-284,-261, -237,-211,-183,-155,-125, -95, -64, -32, 0, 32, 64, 95, 125, 155, 183, 211, 237, 261, 284, 305, 325, 344, 360, 376]),
};
