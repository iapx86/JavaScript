/*
 *
 *	Mappy Sound Module
 *
 */

const mappySound = `
registerProcessor('MappySound', class extends AudioWorkletProcessor {
	constructor (options) {
		const {SND, sampleRate} = options.processorOptions;
		super(options);
		this.reg = new Uint8Array(0x40);
		this.snd = Float32Array.from(SND, e => (e & 0x0f) * 2 / 15 - 1);
		this.rate = Math.floor(2048 * 48000 / sampleRate);
		this.phase = new Uint32Array(8);
		this.port.onmessage = ({data: {wheel}}) => {
			if (wheel)
				wheel.forEach(({addr, data}) => this.reg[addr] = data);
		};
		this.port.start();
	}
	process (inputs, outputs) {
		const reg = this.reg;
		outputs[0][0].fill(0).forEach((e, i, data) => {
			for (let j = 0; j < 8; j++) {
				data[i] += this.snd[reg[6 + j * 8] << 1 & 0xe0 | this.phase[j] >>> 27] * (reg[3 + j * 8] & 0x0f) / 15;
				this.phase[j] += (reg[4 + j * 8] | reg[5 + j * 8] << 8 | reg[6 + j * 8] << 16 & 0xf0000) * this.rate;
			}
		});
		return true;
	}
});
`;

const addMappySound = audioCtx.audioWorklet.addModule('data:text/javascript,' + mappySound);

class MappySound {
	constructor({SND, gain = 0.1}) {
		this.reg = new Uint8Array(0x400);
		this.gain = gain;
		this.wheel = [];
		this.source = new AudioBufferSourceNode(audioCtx);
		this.gainNode = new GainNode(audioCtx, {gain});
		addMappySound.then(() => {
			this.worklet = new AudioWorkletNode(audioCtx, 'MappySound', {processorOptions: {SND, sampleRate: audioCtx.sampleRate}});
			this.worklet.port.start();
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

