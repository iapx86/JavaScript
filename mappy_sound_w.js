/*
 *
 *	Mappy Sound Module
 *
 */

const mappySound = `
registerProcessor('MappySound', class extends AudioWorkletProcessor {
	constructor (options) {
		super(options);
		this.snd = new Float32Array(0x100);
		this.phase = new Uint32Array(8);
		this.port.onmessage = e => {
			if (e.data.SND)
				e.data.SND.forEach((v, i) => this.snd[i] = (v & 0x0f) * 2 / 15 - 1);
			if (e.data.rate)
				this.rate = e.data.rate;
			if (e.data.channel)
				this.channel = e.data.channel;
		};
		this.port.start();
	}
	process (inputs, outputs) {
		outputs[0][0].forEach((v, i, data) => {
			data[i] = 0;
			this.channel.forEach((ch, j) => {
				data[i] += this.snd[ch.voice << 5 | this.phase[j] >>> 27] * ch.vol / (15 * 10);
				this.phase[j] += ch.freq * this.rate;
			});
		});
		return true;
	}
});
`;

class MappySound {
	constructor(SND, base) {
		this.rate = Math.floor(2048 * 48000 / audioCtx.sampleRate);
		this.base = base;
		this.channel = [];
		for (let i = 0; i < 8; i++)
			this.channel.push({voice: 0, freq: 0, vol: 0});
		audioCtx.audioWorklet.addModule('data:text/javascript,' + encodeURI(mappySound)).then(() => {
			this.worklet = new AudioWorkletNode(audioCtx, 'MappySound');
			this.worklet.port.start();
			this.worklet.port.postMessage({SND: SND, rate: this.rate, channel: this.channel});
			this.source = audioCtx.createBufferSource();
			this.source.connect(this.worklet);
			this.worklet.connect(audioCtx.destination);
			this.source.start();
		});
	}

	output() {
		this.channel.forEach((ch, i) => {
			ch.voice = this.base[6 + i * 8] >>> 4 & 7;
			ch.freq = this.base[4 + i * 8] | this.base[5 + i * 8] << 8 | this.base[6 + i * 8] << 16 & 0xf0000;
			ch.vol = this.base[3 + i * 8] & 0x0f;
		});
		if (this.worklet)
			this.worklet.port.postMessage({channel: this.channel});
	}
}

