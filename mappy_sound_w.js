/*
 *
 *	Mappy Sound Module
 *
 */

const mappySound = `
registerProcessor('MappySound', class extends AudioWorkletProcessor {
	constructor (options) {
		super(options);
		this.reg = new Uint8Array(0x40);
		this.channel = [];
		for (let i = 0; i < 8; i++)
			this.channel.push({voice: 0, freq: 0, vol: 0, phase: 0});
		this.port.onmessage = ({data: {SND, sampleRate, wheel}}) => {
			if (SND)
				this.snd = Float32Array.from(SND, v => (v & 0x0f) * 2 / 15 - 1);
			if (sampleRate) {
				this.sampleRate = sampleRate;
				this.rate = Math.floor(2048 * 48000 / sampleRate);
			}
			if (wheel) {
				const reg = this.reg;
				wheel.forEach(({addr, data}) => reg[addr] = data);
				for (let i = 0; i < 8; i++) {
					const ch = this.channel[i];
					ch.voice = reg[6 + i * 8] >> 4 & 7;
					ch.freq = reg[4 + i * 8] | reg[5 + i * 8] << 8 | reg[6 + i * 8] << 16 & 0xf0000;
					ch.vol = reg[3 + i * 8] & 0x0f;
				}
			}
		};
		this.port.start();
	}
	process (inputs, outputs) {
		outputs[0][0].fill(0).forEach((v, i, data) => {
			this.channel.forEach(ch => data[i] += this.snd[ch.voice << 5 | ch.phase >>> 27] * ch.vol / 15);
			this.channel.forEach(ch => ch.phase += ch.freq * this.rate);
		});
		return true;
	}
});
`;

const MappySoundPromise = audioCtx.audioWorklet.addModule('data:text/javascript,' + mappySound);

class MappySound {
	constructor({SND, gain = 0.1}) {
		this.reg = new Uint8Array(0x400);
		this.gain = gain;
		this.wheel = [];
		this.source = audioCtx.createBufferSource();
		this.gainNode = audioCtx.createGain();
		this.gainNode.gain.value = this.gain;
		MappySoundPromise.then(() => {
			this.worklet = new AudioWorkletNode(audioCtx, 'MappySound');
			this.worklet.port.start();
			this.worklet.port.postMessage({SND, sampleRate: audioCtx.sampleRate});
			this.source.connect(this.worklet).connect(this.gainNode).connect(audioCtx.destination);
			this.source.start();
		});
	}

	mute(flag) {
		this.gainNode.gain.value = flag ? 0 : this.gain;
	}

	read(addr) {
		return this.reg[addr & 0x3ff];
	}

	write(addr, data) {
		this.reg[addr &= 0x3ff] = data;
		addr < 0x40 && this.wheel.push({addr, data});
	}

	update() {
		this.worklet && this.worklet.port.postMessage({wheel: this.wheel});
		this.wheel = [];
	}
}

