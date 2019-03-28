/*
 *
 *	AY-3-8910 Sound Module
 *
 */

class AY_3_8910 {
	constructor({clock, resolution = 1, gain = 0.1}) {
		this.reg = new Uint8Array(0x10);
		this.tmp = new Uint8Array(0x10);
		const repeat = 16;
		this.noiseBuffer = audioCtx.createBuffer(1, 131071 * repeat, audioCtx.sampleRate);
		for (let data = this.noiseBuffer.getChannelData(0), rng = 0xffff, i = 0; i < data.length; i++) {
			if (i % repeat === 0)
				rng = (rng >>> 16 ^ rng >>> 13 ^ 1) & 1 | rng << 1;
			data[i] = (rng & 1) * 2 - 1;
		}
		this.clock = clock;
		this.rate = Math.floor(clock / 8);
		this.pbRate = this.rate * repeat / audioCtx.sampleRate / 2;
		this.resolution = resolution;
		this.gain = gain;
		this.count = 0;
		this.wheel = new Array(resolution);
		this.cycles = 0;
		this.ecount = 0;
		this.step = 0;
		this.merger = audioCtx.createChannelMerger(4);
		this.gainNode = audioCtx.createGain();
		this.gainNode.gain.value = gain;
		this.merger.connect(this.gainNode);
		this.gainNode.connect(audioCtx.destination);
		this.channel = [];
		for (let i = 0; i < 3; i++) {
			const ch = {oscillator: audioCtx.createOscillator(), gainNode: audioCtx.createGain()};
			ch.oscillator.type = 'square';
			ch.gainNode.gain.value = 0;
			ch.oscillator.connect(ch.gainNode);
			ch.gainNode.connect(this.merger);
			ch.oscillator.start();
			this.channel.push(ch);
		}
		this.noise = {source: audioCtx.createBufferSource(), gainNode: audioCtx.createGain()};
		this.noise.source.buffer = this.noiseBuffer;
		this.noise.source.loop = true;
		this.noise.gainNode.gain.value = 0;
		this.noise.source.connect(this.noise.gainNode);
		this.noise.gainNode.connect(this.merger);
		this.noise.source.start();
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
		if (this.wheel[timer])
			this.wheel[timer].push({addr, data});
		else
			this.wheel[timer] = [{addr, data}];
	}

	update() {
		const now = audioCtx.currentTime;
		this.channel.forEach(ch => {
			ch.oscillator.frequency.cancelScheduledValues(0);
			ch.gainNode.gain.cancelScheduledValues(0);
		});
		this.noise.source.playbackRate.cancelScheduledValues(0);
		this.noise.gainNode.gain.cancelScheduledValues(0);
		for (let timer = 0; timer < this.resolution; timer++) {
			const reg = this.reg, q = this.wheel.shift(), start = now + timer / this.resolution / 60;
			q && q.forEach(({addr, data}) => {
				reg[addr] = data;
				if (addr === 13)
					this.step = 0;
			});
			const efreq = reg[11] | reg[12] << 8, etype = reg[13];
			const evol = (~this.step ^ ((((etype ^ etype >> 1) & this.step >> 4 ^ ~etype >> 2) & 1) - 1)) & (~etype >> 3 & this.step >> 4 & 1) - 1 & 15;
			this.channel.forEach((ch, i) => {
				const freq = reg[i * 2] | reg[1 + i * 2] << 8 & 0xf00;
				ch.oscillator.frequency.setValueAtTime(this.clock / 16 / (freq ? freq : 1), start);
				const vol = (reg[7] >> i & 1) !== 0 ? 0 : (reg[8 + i] >> 4 & 1) !== 0 ? evol : reg[8 + i] & 0x0f;
				ch.gainNode.gain.setValueAtTime(vol ? Math.pow(2, (vol - 15) / 2) : 0, start);
			});
			const nfreq = reg[6] & 0x1f;
			this.noise.source.playbackRate.setValueAtTime(this.pbRate / (nfreq ? nfreq : 1), start);
			let nvol = 0;
			for (let i = 0; i < 3; i++) {
				const vol = (reg[7] >> i + 3 & 1) !== 0 ? 0 : (reg[8 + i] >> 4 & 1) !== 0 ? evol : reg[8 + i] & 0x0f;
				nvol += vol ? Math.pow(2, (vol - 15) / 2) : 0;
			}
			this.noise.gainNode.gain.setValueAtTime(nvol, start);
			for (this.count += this.rate; this.count >= 60 * this.resolution; this.count -= 60 * this.resolution)
				if (++this.ecount >= efreq) {
					this.ecount = 0;
					this.step += ((this.step < 16) | etype >> 3 & ~etype & 1) - (this.step >= 47) * 32;
				}
		}
		this.wheel = new Array(this.resolution);
	}
}

