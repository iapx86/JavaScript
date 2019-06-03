/*
 *
 *	Sound Effect Module
 *
 */

export default class SoundEffect {
	constructor({se, freq = audioCtx.sampleRate, gain = 1}) {
		this.se = se;
		if (!audioCtx)
			return;
		se.forEach(se => {
			se.audioBuffer = audioCtx.createBuffer(1, se.buf.length, audioCtx.sampleRate);
			se.audioBuffer.getChannelData(0).forEach((e, i, buf) => buf[i] = se.buf[i] / 32767);
			se.playbackRate = freq / audioCtx.sampleRate;
			se.gainNode = audioCtx.createGain();
			se.gainNode.gain.value = gain;
			se.gainNode.connect(audioCtx.destination);
		});
	}

	update() {
		if (!audioCtx) {
			this.se.forEach(se => se.start = se.stop = false);
			return;
		}
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
				se.audioBufferSource.connect(se.gainNode);
				se.audioBufferSource.start();
			}
			se.start = se.stop = false;
		});
	}
}

