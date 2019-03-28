/*
 *
 *	Mappy Sound Module
 *
 */

class MappySound {
	constructor({SND, resolution = 1, gain = 0.1}) {
		this.reg = new Uint8Array(0x40);
		this.tmp = new Uint8Array(0x400);
		this.audioBuffer = [];
		for (let i = 0; i < 8; i++) {
			this.audioBuffer[i] = audioCtx.createBuffer(1, 32, audioCtx.sampleRate);
			this.audioBuffer[i].getChannelData(0).forEach((e, j, buf) => buf[j] = (SND[i << 5 | j] & 0x0f) * 2 / 15 - 1);
		}
		this.rate = 48000 / audioCtx.sampleRate / (1 << 16);
		this.resolution = resolution;
		this.gain = gain;
		this.wheel = new Array(resolution);
		this.merger = audioCtx.createChannelMerger(8);
		this.gainNode = audioCtx.createGain();
		this.gainNode.gain.value = gain;
		this.merger.connect(this.gainNode);
		this.gainNode.connect(audioCtx.destination);
		this.channel = [];
		for (let i = 0; i < 8; i++) {
			const ch = {source: [], gainNode: []};
			ch.merger = audioCtx.createChannelMerger(8);
			ch.merger.connect(this.merger);
			for (let j = 0; j < 8; j++) {
				ch.source[j] = audioCtx.createBufferSource();
				ch.source[j].buffer = this.audioBuffer[j];
				ch.source[j].loop = true;
				ch.gainNode[j] = audioCtx.createGain();
				ch.source[j].connect(ch.gainNode[j]);
				ch.gainNode[j].connect(ch.merger);
				ch.source[j].start();
			}
			this.channel.push(ch);
		}
	}

	mute(flag) {
		this.gainNode.gain.value = flag ? 0 : this.gain;
	}

	read(addr) {
		return this.tmp[addr & 0x3ff];
	}

	write(addr, data, timer = 0) {
		this.tmp[addr &= 0x3ff] = data;
		if (addr >= 0x40)
			return;
		if (this.wheel[timer])
			this.wheel[timer].push({addr, data});
		else
			this.wheel[timer] = [{addr, data}];
	}

	update() {
		const now = audioCtx.currentTime;
		this.channel.forEach(ch => {
			ch.source.forEach(n => n.playbackRate.cancelScheduledValues(0));
			ch.gainNode.forEach(n => n.gain.cancelScheduledValues(0));
		});
		for (let timer = 0; timer < this.resolution; timer++) {
			const reg = this.reg, q = this.wheel.shift(), start = now + timer / this.resolution / 60;
			q && q.forEach(({addr, data}) => reg[addr] = data);
			this.channel.forEach((ch, i) => {
				const voice = reg[6 + i * 8] >>> 4 & 7;
				const freq = reg[4 + i * 8] | reg[5 + i * 8] << 8 | reg[6 + i * 8] << 16 & 0xf0000;
				const vol = reg[3 + i * 8] & 0x0f;
				ch.source.forEach(n => n.playbackRate.setValueAtTime(this.rate * freq, start));
				ch.gainNode.forEach((n, j) => n.gain.setValueAtTime(j === voice && freq ? vol / 15 : 0, start));
			});
		}
		this.wheel = new Array(this.resolution);
	}
}

