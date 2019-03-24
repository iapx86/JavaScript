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
				const reg = this.reg;
				this.channel.forEach(ch => data[i] += this.snd[ch.voice << 5 | ch.phase >>> 27] * ch.vol / 15);
				for (this.count += 60 * this.resolution; this.count >= audioCtx.sampleRate; this.count -= audioCtx.sampleRate) {
					const q = this.wheel.shift();
					q && q.forEach(({addr, data}) => reg[addr] = data);
				}
				this.channel.forEach((ch, i) => {
					ch.voice = reg[0x05 + i * 5] & 7;
					ch.freq = (i ? 0 : reg[0x10]) | reg[0x11 + i * 5] << 4 | reg[0x12 + i * 5] << 8 | reg[0x13 + i * 5] << 12 | reg[0x14 + i * 5] << 16;
					ch.vol = reg[0x15 + i * 5];
					ch.phase += ch.freq * this.rate
				});
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
		const reg = this.reg;
		if (this.wheel.length >= this.resolution) {
			this.wheel.forEach(q => q.forEach(({addr, data}) => reg[addr] = data));
			this.count = 0;
		}
		else if (this.wheel.length) {
			[this.wheel, this.tmpwheel] = [this.wheel.concat(this.tmpwheel), new Array(this.resolution)];
			return;
		}
		[this.wheel, this.tmpwheel] = [this.tmpwheel, new Array(this.resolution)];
		const q = this.wheel.shift();
		q && q.forEach(({addr, data}) => reg[addr] = data);
		this.channel.forEach((ch, i) => {
			ch.voice = reg[0x05 + i * 5] & 7;
			ch.freq = (i ? 0 : reg[0x10]) | reg[0x11 + i * 5] << 4 | reg[0x12 + i * 5] << 8 | reg[0x13 + i * 5] << 12 | reg[0x14 + i * 5] << 16;
			ch.vol = reg[0x15 + i * 5];
		});
	}
}

