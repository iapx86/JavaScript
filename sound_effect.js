/*
 *
 *	Sound Effect Module
 *
 */

class SoundEffect {
	constructor(se, freq = 44100) {
		this.se = se;
		se.forEach(se => {
			se.audioBuffer = audioCtx.createBuffer(1, se.buf.length, 44100);
			se.audioBuffer.getChannelData(0).forEach((x, i, data) => data[i] = se.buf[i] / 32767);
			se.playbackRate = freq / 44100;
			se.audioBufferSource = null;
		});
	}

	output() {
		this.se.forEach(se => {
			if (se.stop && se.audioBufferSource) {
				se.audioBufferSource.stop();
				se.audioBufferSource = null;
			}
			if (se.start && !se.audioBufferSource) {
				se.audioBufferSource = audioCtx.createBufferSource();
				se.audioBufferSource.buffer = se.audioBuffer;
				se.audioBufferSource.loop = se.loop;
				se.audioBufferSource.playbackRate.value = se.playbackRate;
				se.audioBufferSource.connect(audioCtx.destination);
				se.audioBufferSource.start();
			}
			se.start = se.stop = false;
		});
	}
}

