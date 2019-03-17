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
		this.append = false;
		this.channel = [];
		for (let i = 0; i < 3; i++)
			this.channel.push({freq: 0, tone: false, noise: false, vol: 0, envelope: true, count: 0, output: 0});
		Object.assign(this, {noisefreq: 0, envelopefreq: 0, envelopetype: 0, noisecount: 0, rng: 0xffff});
		this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
		this.scriptNode.onaudioprocess = e => {
			e.outputBuffer.getChannelData(0).forEach((v, i, data) => {
				data[i] = 0;
				this.channel.forEach(ch => {
					const vol = ch.vol ? Math.pow(2, (ch.vol - 15) / 2) : 0;
					data[i] += (((ch.output | ch.tone) & (this.rng | ch.noise) & 1) * 2 - 1) * vol / 10;
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
			if (this.append) {
				for (; this.que; this.que = this.que.substring(3))
					if (this.que.charCodeAt(0) !== 0xffff)
						this.psg.reg[this.que.charCodeAt(1)] = this.que.charCodeAt(2);
			}
			else if (this.que) {
				this.que += String.fromCharCode(0xffff, 0, 0) + this.psg.que;
				this.psg.que = '';
				this.append = true;
				return;
			}
			this.que = this.psg.que;
			this.psg.que = '';
			this.count = 0;
			this.append = false;
			for (; this.que && this.que.charCodeAt(0) === 0; this.que = this.que.substring(3))
				this.psg.reg[this.que.charCodeAt(1)] = this.que.charCodeAt(2);
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
			this.psg.reg[this.que.charCodeAt(1)] = this.que.charCodeAt(2);
		this.update2();
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

