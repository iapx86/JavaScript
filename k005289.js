/*
 *
 *	K005289 Sound Module
 *
 */

export default class K005289 {
	constructor({SND, clock, resolution = 1, gain = 0.1}) {
		this.resolution = resolution;
		this.gain = gain;
		this.tmpwheel = new Array(resolution);
		if (!audioCtx)
			return;
		this.source = audioCtx.createBufferSource();
		this.gainNode = audioCtx.createGain();
		this.gainNode.gain.value = gain;
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.reg = new Uint16Array(4);
		this.snd = Float32Array.from(SND, e => (e & 0x0f) * 2 / 15 - 1);
		this.rate = clock / audioCtx.sampleRate * (1 << 27);
		this.count = this.sampleRate - 1;
		this.wheel = [];
		this.phase = new Uint32Array(2);
		this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
		this.scriptNode.onaudioprocess = ({outputBuffer}) => {
			const reg = this.reg;
			outputBuffer.getChannelData(0).fill(0).forEach((e, i, data) => {
				for (this.count += 60 * resolution; this.count >= this.sampleRate; this.count -= this.sampleRate) {
					const q = this.wheel.shift();
					q && q.forEach(({addr, data}) => reg[addr] = data);
				}
				for (let j = 0; j < 2; j++)
					if (reg[j + 2]) {
						data[i] += this.snd[j << 8 | reg[j] & 0xe0 | this.phase[j] >>> 27] * (reg[j] & 0x0f) / 15;
						this.phase[j] += Math.floor(this.rate / reg[j + 2]);
					}
			});
		};
		this.source.connect(this.scriptNode);
		this.scriptNode.connect(this.gainNode);
		this.gainNode.connect(audioCtx.destination);
		this.source.start();
	}

	mute(flag) {
		if (!audioCtx)
			return;
		this.gainNode.gain.value = flag ? 0 : this.gain;
	}

	write(addr, data, timer = 0) {
		if (this.tmpwheel[timer])
			this.tmpwheel[timer].push({addr, data});
		else
			this.tmpwheel[timer] = [{addr, data}];
	}

	update() {
		if (this.wheel) {
			if (this.wheel.length > this.resolution) {
				this.wheel.forEach(q => q.forEach(({addr, data}) => this.reg[addr] = data));
				this.count = this.sampleRate - 1;
				this.wheel.splice(0);
			}
			this.wheel = this.wheel.concat(this.tmpwheel);
		}
		this.tmpwheel = new Array(this.resolution);
	}
}

