/*
 *
 *	Mappy Sound Module
 *
 */

class MappySound {
	constructor({SND, gain = 0.1}) {
		this.reg = new Uint8Array(0x400);
		this.snd = Float32Array.from(SND, e => (e & 0x0f) * 2 / 15 - 1);
		this.rate = Math.floor(2048 * 48000 / audioCtx.sampleRate);
		this.gain = gain;
		this.phase = new Uint32Array(8);
		this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
		this.scriptNode.onaudioprocess = e => {
			const reg = this.reg;
			e.outputBuffer.getChannelData(0).fill(0).forEach((e, i, data) => {
				for (let j = 0; j < 8; j++) {
					data[i] += this.snd[reg[6 + j * 8] << 1 & 0xe0 | this.phase[j] >>> 27] * (reg[3 + j * 8] & 0x0f) / 15;
					this.phase[j] += (reg[4 + j * 8] | reg[5 + j * 8] << 8 | reg[6 + j * 8] << 16 & 0xf0000) * this.rate;
				}
			});
		};
		this.source = new audioCtx.createBufferSource();
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
		return this.reg[addr & 0x3ff];
	}

	write(addr, data) {
		this.reg[addr & 0x3ff] = data;
	}

	update() {
	}
}

