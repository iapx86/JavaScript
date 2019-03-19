/*
 *
 *	Pac-Man Sound Module
 *
 */

class PacManSound {
	constructor(SND, sound, resolution = 0) {
		this.snd = Float32Array.from(SND, v => (v & 0x0f) * 2 / 15 - 1);
		this.rate = Math.floor(8192 * 48000 / audioCtx.sampleRate);
		this.sound = sound;
		this.resolution = resolution;
		this.count = 0;
		this.que = '';
		this.append = false;
		this.channel = [];
		for (let i = 0; i < 3; i++)
			this.channel.push({voice: 0, freq: 0, vol: 0, phase: 0});
		this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
		this.scriptNode.onaudioprocess = e => {
			e.outputBuffer.getChannelData(0).fill(0).forEach((v, i, data) => {
				this.channel.forEach(ch => data[i] += this.snd[ch.voice << 5 | ch.phase >>> 27] * ch.vol / (15 * 10));
				if (typeof this.sound.que !== 'undefined')
					this.update1();
				this.channel.forEach(ch => ch.phase += ch.freq * this.rate);
			});
		};
		this.source = audioCtx.createBufferSource();
		this.source.connect(this.scriptNode);
		this.scriptNode.connect(audioCtx.destination);
		this.source.start();
	}

	output() {
		if (typeof this.sound.que !== 'undefined') {
			if (this.append) {
				for (; this.que; this.que = this.que.substring(3))
					if (this.que.charCodeAt(0) !== 0xffff)
						this.sound.reg[this.que.charCodeAt(1)] = this.que.charCodeAt(2);
			}
			else if (this.que) {
				this.que += String.fromCharCode(0xffff, 0, 0) + this.sound.que;
				this.sound.que = '';
				this.append = true;
				return;
			}
			this.que = this.sound.que;
			this.sound.que = '';
			this.count = 0;
			this.append = false;
			for (; this.que && this.que.charCodeAt(0) === 0; this.que = this.que.substring(3))
				this.sound.reg[this.que.charCodeAt(1)] = this.que.charCodeAt(2);
		}
		this.update2();
	}

	update1() {
		let count = Math.floor((this.count += 60 * this.resolution) / audioCtx.sampleRate);
		if (count >= this.resolution) {
			count = 0;
			this.count %= audioCtx.sampleRate;
			if (this.que && this.que.charCodeAt(0) === 0xffff) {
				this.que = this.que.substring(3);
				this.append = false;
			}
		}
		for (; this.que && this.que.charCodeAt(0) <= count; this.que = this.que.substring(3))
			this.sound.reg[this.que.charCodeAt(1)] = this.que.charCodeAt(2);
		this.update2();
	}

	update2() {
		const reg = this.sound.reg, [ch0, ch1, ch2] = this.channel;
		ch0.voice = reg[0x05] & 7;
		ch1.voice = reg[0x0a] & 7;
		ch2.voice = reg[0x0f] & 7;
		ch0.freq = reg[0x10] | reg[0x11] << 4 | reg[0x12] << 8 | reg[0x13] << 12 | reg[0x14] << 16;
		ch0.vol = reg[0x15];
		ch1.freq = reg[0x16] << 4 | reg[0x17] << 8 | reg[0x18] << 12 | reg[0x19] << 16;
		ch1.vol = reg[0x1a];
		ch2.freq = reg[0x1b] << 4 | reg[0x1c] << 8 | reg[0x1d] << 12 | reg[0x1e] << 16;
		ch2.vol = reg[0x1f];
	}
}

