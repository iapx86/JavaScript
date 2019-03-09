/*
 *
 *	Sound Effect Module
 *
 */

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

class SoundEffect {
	constructor(se, freq = 22050) {
		this.se = se;
		this.gainNode = audioCtx.createGain();
		this.merger = audioCtx.createChannelMerger(1);
		this.merger.connect(this.gainNode).connect(audioCtx.destination);
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
				se.audioBufferSource.connect(this.merger);
				se.audioBufferSource.start();
			}
			se.start = se.stop = false;
		});
	}
}

