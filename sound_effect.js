/*
 *
 *	Sound Effect Module
 *
 */

class SoundEffect {
	constructor({se, freq = 44100, gain = 1}) {
		this.se = se;
		se.forEach(se => {
			se.audioBuffer = audioCtx.createBuffer(1, se.buf.length, 44100);
			se.audioBuffer.getChannelData(0).forEach((e, i, buf) => buf[i] = se.buf[i] / 32767);
			se.playbackRate = freq / 44100;
		});
		this.merger = audioCtx.createChannelMerger(1);
		this.gain = audioCtx.createGain();
		this.gain.gain.value = gain;
		this.merger.connect(this.gain);
		this.gain.connect(audioCtx.destination);
	}

	update() {
		this.se.forEach(se => {
			if (se.stop && se.audioBufferSource) {
				se.audioBufferSource.stop();
				delete se.audioBufferSource;
			}
			if (se.start && !se.audioBufferSource) {
				se.audioBufferSource = audioCtx.createBufferSource();
				se.audioBufferSource.buffer = se.audioBuffer;
				se.audioBufferSource.loop = se.loop;
				se.audioBufferSource.playbackRate.value = se.playbackRate;
				se.audioBufferSource.connect(this.merger);
				se.audioBufferSource.start();
			}
			se.start = se.stop = false;
		});
	}
}

