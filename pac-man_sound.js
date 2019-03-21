/*
 *
 *	Pac-Man Sound Module
 *
 */

class PacManSound {
	constructor({SND, resolution = 1, gain = 0.1}) {
		this.reg = new Uint8Array(0x20);
		this.tmp = new Uint8Array(0x20);
		this.snd = Float32Array.from(SND, v => (v & 0x0f) * 2 / 15 - 1);
		this.rate = Math.floor(8192 * 48000 / audioCtx.sampleRate);
		this.resolution = resolution;
		this.gain = gain;
		this.count = 0;
		this.wheel = [];
		this.tmpwheel = new Array(this.resolution);
		this.channel = [];
		for (let i = 0; i < 3; i++)
			this.channel.push({voice: 0, freq: 0, vol: 0, phase: 0});
		this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
		this.scriptNode.onaudioprocess = e => {
			e.outputBuffer.getChannelData(0).fill(0).forEach((v, i, data) => {
				this.channel.forEach(ch => data[i] += this.snd[ch.voice << 5 | ch.phase >>> 27] * ch.vol / 15);
				this.update1();
				this.channel.forEach(ch => ch.phase += ch.freq * this.rate);
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
		return this.tmp[addr & 0x1f];
	}

	write(addr, data, timer = 0) {
		this.tmp[addr &= 0x1f] = data &= 0x0f;
		if (this.tmpwheel[timer])
			this.tmpwheel[timer].push({addr, data});
		else
			this.tmpwheel[timer] = [{addr, data}];
	}

	update() {
		if (this.wheel.length >= this.resolution) {
			this.wheel.forEach(q => q.forEach(({addr, data}) => this.reg[addr] = data));
			this.count = 0;
		}
		else if (this.wheel.length) {
			[this.wheel, this.tmpwheel] = [this.wheel.concat(this.tmpwheel), new Array(this.resolution)];
			return;
		}
		[this.wheel, this.tmpwheel] = [this.tmpwheel, new Array(this.resolution)];
		const q = this.wheel.shift();
		q && q.forEach(({addr, data}) => this.reg[addr] = data);
		this.update2();
	}

	update1() {
		for (this.count += 60 * this.resolution; this.count >= audioCtx.sampleRate; this.count -= audioCtx.sampleRate) {
			const q = this.wheel.shift();
			q && q.forEach(({addr, data}) => this.reg[addr] = data);
		}
		this.update2();
	}

	update2() {
		const reg = this.reg, [ch0, ch1, ch2] = this.channel;
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

