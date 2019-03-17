/*
 *
 *	Pac-Man Sound Module
 *
 */

class PacManSound {
	constructor(SND, sound, resolution = 0) {
		this.audioBuffer = [];
		for (let i = 0; i < 8; i++) {
			this.audioBuffer[i] = audioCtx.createBuffer(1, 32, 48000);
			this.audioBuffer[i].getChannelData(0).forEach((x, j, data) => data[j] = (SND[i * 32 + j] & 0x0f) * 2 / 15 - 1);
		}
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
			e.outputBuffer.getChannelData(0).forEach((v, i, data) => {
				data[i] = 0;
				this.channel.forEach(ch => data[i] += this.audioBuffer[ch.voice].getChannelData(0)[ch.phase >>> 27] * ch.vol / (15 * 10));
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
		const base = this.sound.reg;
		this.channel[0].voice = base[0x05] & 7;
		this.channel[0].freq = base[0x10] | base[0x11] << 4 | base[0x12] << 8 | base[0x13] << 12 | base[0x14] << 16;
		this.channel[0].vol = base[0x15];
		this.channel[1].voice = base[0x0a] & 7;
		this.channel[1].freq = base[0x16] << 4 | base[0x17] << 8 | base[0x18] << 12 | base[0x19] << 16;
		this.channel[1].vol = base[0x1a];
		this.channel[2].voice = base[0x0f] & 7;
		this.channel[2].freq = base[0x1b] << 4 | base[0x1c] << 8 | base[0x1d] << 12 | base[0x1e] << 16;
		this.channel[2].vol = base[0x1f];
	}
}

