/*
 *
 *	AY-3-8910 Sound Module
 *
 */

class AY_3_8910 {
	constructor(clock, psg, resolution = 0) {
		this.rate = Math.floor(clock / 8);
		this.psg = psg;
		this.resolution = resolution;
		this.count = 0;
		this.cycles = 0;
		this.que = '';
		this.now = 0;
		this.channel = [];
		for (let i = 0; i < 3; i++)
			this.channel.push({freq: 0xfff, tone: false, noise: false, vol: 0, envelope: true, count: 0, output: 1});
		Object.assign(this, {noisefreq: 0x1f, envelopefreq: 0xffff, envelopetype: 0x0f, noisecount: 0, rng: 0xffff});
		this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
		this.scriptNode.onaudioprocess = e => {
			e.outputBuffer.getChannelData(0).forEach((v, i, data) => {
				data[i] = 0;
				this.channel.forEach(ch => {
					data[i] += (((ch.output | ch.tone) & (this.rng | ch.noise) & 1) * 2 - 1) * Math.pow(2, (ch.vol - 15) / 2) / 10;
				});
				if (typeof this.psg.que !== 'undefined')
					this.update1();
				for (this.cycles += this.rate; this.cycles >= audioCtx.sampleRate; this.cycles -= audioCtx.sampleRate) {
					if (++this.noisecount >>> 1 >= this.noisefreq)
						[this.noisecount, this.rng] = [0, (this.rng >> 16 ^ this.rng >> 13 ^ 1) & 1 | this.rng << 1];
					this.channel.forEach(ch => {
						if (++ch.count >= ch.freq)
							[ch.count, ch.output] = [0, ~ch.output];
					});
				}
			});
		};
		this.source = audioCtx.createBufferSource();
		this.source.connect(this.scriptNode);
		this.scriptNode.connect(audioCtx.destination);
		this.source.start();
	}

	output() {
		if (typeof this.psg.que !== 'undefined') {
			this.now = audioCtx.currentTime;
			this.que += String.fromCharCode(0xffff, this.now * 120 & 0xffff, this.now * 120 >>> 16) + this.psg.que;
			this.psg.que = '';
		}
		else
			this.update2();
	}

	update1() {
		this.count += 60 * this.resolution;
		const count = Math.floor(this.count / audioCtx.sampleRate);
		if (count >= this.resolution) {
			this.count %= audioCtx.sampleRate;
			while (this.que !== '' && this.que.charCodeAt(0) < this.resolution)
				[this.psg.reg[this.que.charCodeAt(1)], this.que] = [this.que.charCodeAt(2), this.que.substring(3)];
			while (this.que !== '' && this.que.charCodeAt(0) >= this.resolution) {
				const time = (this.que.charCodeAt(1) | this.que.charCodeAt(2) << 16) / 120;
				this.que = this.que.substring(3);
				if (time >= this.now - 4 / 120)
					break;
				while (this.que !== '' && this.que.charCodeAt(0) < this.resolution)
					[this.psg.reg[this.que.charCodeAt(1)], this.que] = [this.que.charCodeAt(2), this.que.substring(3)];
			}
			while (this.que !== '' && this.que.charCodeAt(0) === 0)
				[this.psg.reg[this.que.charCodeAt(1)], this.que] = [this.que.charCodeAt(2), this.que.substring(3)];
			this.update2();
		}
		else if (this.que !== '' && this.que.charCodeAt(0) <= count) {
			do {
				[this.psg.reg[this.que.charCodeAt(1)], this.que] = [this.que.charCodeAt(2), this.que.substring(3)];
			} while (this.que !== '' && this.que.charCodeAt(0) <= count);
			this.update2();
		}
	}

	update2() {
		const base = this.psg.reg;
		this.channel.forEach((ch, i) => {
			ch.freq = base[i * 2] | base[1 + i * 2] << 8 & 0xf00;
			ch.tone = base[7] >> i;
			ch.noise = base[7] >> i + 3;
			ch.vol = base[8 + i] & 0x0f;
			ch.envelope = (base[8 + i] & 0x10) !== 0;
		});
		this.noisefreq = base[6] & 0x1f;
		this.envelopefreq = base[11] | base[12] << 8;
		this.envelopetype = base[13] & 0x0f;
	}
}

