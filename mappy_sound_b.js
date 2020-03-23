/*
 *
 *	Mappy Sound Module
 *
 */

export default class MappySound {
	constructor({SND, resolution = 1, gain = 0.1}) {
		const repeat = 16;
		this.ram = new Uint8Array(0x400);
		this.reg = new Uint8Array(0x40);
		this.audioBuffer = [];
		for (let i = 0; i < 8; i++) {
			this.audioBuffer[i] = new AudioBuffer({length: 32 * repeat, sampleRate: audioCtx.sampleRate});
			this.audioBuffer[i].getChannelData(0).forEach((e, j, buf) => buf[j] = (SND[i << 5 | Math.floor(j / repeat)] & 0x0f) * 2 / 15 - 1);
		}
		this.rate = 48000 * repeat / audioCtx.sampleRate / (1 << 16);
		this.resolution = resolution;
		this.gain = gain;
		this.muteflag = false;
		this.wheel = [];
		for (let i = 0; i < resolution; i++)
			this.wheel.push([]);
		this.channel = [];
		for (let i = 0; i < 8; i++) {
			const ch = {source: [], gainNode: []};
			for (let j = 0; j < 8; j++) {
				ch.source[j] = new AudioBufferSourceNode(audioCtx, {buffer: this.audioBuffer[j], loop: true});
				ch.gainNode[j] = new GainNode(audioCtx, {gain: 0});
				ch.source[j].connect(ch.gainNode[j]).connect(audioCtx.destination);
				ch.source[j].start();
			}
			this.channel.push(ch);
		}
	}

	mute(flag) {
		this.muteflag = flag;
	}

	read(addr) {
		return this.ram[addr & 0x3ff];
	}

	write(addr, data, timer = 0) {
		this.ram[addr &= 0x3ff] = data;
		if (addr >= 0x40)
			return;
		this.wheel[timer].push({addr, data});
	}

	update() {
		const now = audioCtx.currentTime;
		this.channel.forEach(ch => {
			ch.source.forEach(n => n.playbackRate.cancelScheduledValues(0));
			ch.gainNode.forEach(n => n.gain.cancelScheduledValues(0));
		});
		for (let timer = 0; timer < this.resolution; timer++) {
			const reg = this.reg, start = now + timer / this.resolution / 60;
			this.wheel[timer].forEach(({addr, data}) => reg[addr] = data);
			this.wheel[timer].splice(0);
			this.channel.forEach((ch, i) => {
				const voice = reg[6 + i * 8] >> 4 & 7;
				const freq = reg[4 + i * 8] | reg[5 + i * 8] << 8 | reg[6 + i * 8] << 16 & 0xf0000;
				const vol = reg[3 + i * 8] & 0x0f;
				ch.source.forEach(n => n.playbackRate.setValueAtTime(this.rate * freq, start));
				ch.gainNode.forEach((n, j) => n.gain.setValueAtTime(j === voice && freq && !this.muteflag ? vol / 15 * this.gain : 0, start));
			});
		}
	}
}

