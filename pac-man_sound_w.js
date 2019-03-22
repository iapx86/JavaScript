/*
 *
 *	Pac-Man Sound Module
 *
 */

const pacmanSound = `
registerProcessor('PacManSound', class extends AudioWorkletProcessor {
	constructor (options) {
		super(options);
		this.reg = new Uint8Array(0x20);
		this.count = 0;
		this.wheel = [];
		this.channel = [];
		for (let i = 0; i < 3; i++)
			this.channel.push({voice: 0, freq: 0, vol: 0, phase: 0});
		this.port.onmessage = ({data: {SND, sampleRate, resolution, wheel}}) => {
			if (SND)
				this.snd = Float32Array.from(SND, v => (v & 0x0f) * 2 / 15 - 1);
			if (sampleRate) {
				this.sampleRate = sampleRate;
				this.rate = Math.floor(8192 * 48000 / sampleRate);
			}
			if (resolution)
				this.resolution = resolution;
			if (wheel) {
				if (this.wheel.length >= this.resolution) {
					this.wheel.forEach(q => q.forEach(({addr, data}) => this.reg[addr] = data));
					this.count = 0;
					this.wheel = [];
				}
				if (this.wheel.length)
					this.wheel = this.wheel.concat(wheel);
				else {
					this.wheel = wheel;
					const q = this.wheel.shift();
					q && q.forEach(({addr, data}) => this.reg[addr] = data);
					this.update();
				}
			}
		};
		this.port.start();
	}
	process (inputs, outputs) {
		outputs[0][0].fill(0).forEach((v, i, data) => {
			this.channel.forEach(ch => data[i] += this.snd[ch.voice << 5 | ch.phase >>> 27] * ch.vol / 15);
			for (this.count += 60 * this.resolution; this.count >= this.sampleRate; this.count -= this.sampleRate) {
				const q = this.wheel.shift();
				q && q.forEach(({addr, data}) => this.reg[addr] = data);
			}
			this.update();
			this.channel.forEach(ch => ch.phase += ch.freq * this.rate);
		});
		return true;
	}
	update() {
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
});
`;

const PacManSoundPromise = audioCtx.audioWorklet.addModule('data:text/javascript,' + pacmanSound);

class PacManSound {
	constructor({SND, resolution = 1, gain = 0.1}) {
		this.reg = new Uint8Array(0x20);
		this.resolution = resolution;
		this.gain = gain;
		this.wheel = new Array(resolution);
		this.source = audioCtx.createBufferSource();
		this.gainNode = audioCtx.createGain();
		this.gainNode.gain.value = this.gain;
		PacManSoundPromise.then(() => {
			this.worklet = new AudioWorkletNode(audioCtx, 'PacManSound');
			this.worklet.port.start();
			this.worklet.port.postMessage({SND, sampleRate: audioCtx.sampleRate, resolution});
			this.source.connect(this.worklet).connect(this.gainNode).connect(audioCtx.destination);
			this.source.start();
		});
	}

	mute(flag) {
		this.gainNode.gain.value = flag ? 0 : this.gain;
	}

	read(addr) {
		return this.reg[addr & 0x1f];
	}

	write(addr, data, timer = 0) {
		this.reg[addr &= 0x1f] = data &= 0x0f;
		if (this.wheel[timer])
			this.wheel[timer].push({addr, data});
		else
			this.wheel[timer] = [{addr, data}];
	}

	update() {
		this.worklet && this.worklet.port.postMessage({wheel: this.wheel});
		this.wheel = new Array(this.resolution);
	}
}

