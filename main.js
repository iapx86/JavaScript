/*
 *
 *	Main Module
 *
 */

const volume0 = 'data:image/png;base64,\
iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAC4jAAAuIwF4pT92AAAAeElEQVR42u3XywrAIAxE0fz/T09XXRRaTCvDnYoBV7o4\
oHlYkopctQF/B5yBAEQCRAJEAkQBRmEDdGMaMBtvUvOy7wSok7oOwBPi9rwL0M4YJ6BVsJYGoFeAPkI8DT8VIrwUxzajmHYcM5BEjGQRQ2nEWL5/RmsADqNJ\
E6QZh85dAAAAAElFTkSuQmCC\
';
const volume1 = 'data:image/png;base64,\
iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAC4jAAAuIwF4pT92AAAAfklEQVR42u2XwQrAIAxD+/8/nZ12GrhoWoolBS9SyEOl\
iQEgOlcY4HaAt1oAQAIs+zLEofRmiEMBzhAH+TYkgL9i7/2zrwozAGAA1IrTU6gECOYUDGAAA4ydA9uTsHIUS16gmlGaG+7acVkeOAkk6YlIiWQtoXRuLPfP\
aAbAA72UT2ikWgrdAAAAAElFTkSuQmCC\
';
const vsSource = `
	attribute vec4 aVertexPosition;
	attribute vec2 aTextureCoord;
	varying highp vec2 vTextureCoord;
	void main(void) {
		gl_Position = aVertexPosition;
		vTextureCoord = aTextureCoord;
	}
`;
const fsSource = `
	varying highp vec2 vTextureCoord;
	uniform sampler2D uSampler;
	void main(void) {
		gl_FragColor = texture2D(uSampler, vTextureCoord);
	}
`;
const cxScreen = canvas.width, cyScreen = canvas.height;
const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

(window.onresize = () => {
	const zoom = Math.max(1, Math.min(Math.floor(window.innerWidth / cxScreen), Math.floor(window.innerHeight / cyScreen)));
	canvas.width = cxScreen * zoom;
	canvas.height = cyScreen * zoom;
	gl.viewport(0, 0, canvas.width, canvas.height);
})();

function loadShader(gl, type, source) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}
	return shader;
}

function initShaderProgram(gl, vsSource, fsSource) {
	const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
	const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
	const shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.linkProgram(shaderProgram);
	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
		alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
		return null;
	}
	return shaderProgram;
}

export function init({game, sound, keydown, keyup} = {}) {
	let {cxScreen, cyScreen, width, height, rotate} = game, images = [], silence, samples0, maxLength, source, node;
	let lastFrame = {timestamp: 0, array: new Uint8Array(new Int32Array(cxScreen * cyScreen).fill(0xff000000).buffer), cxScreen, cyScreen};
	const positions = new Float32Array(rotate ? [-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0] : [-1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0]);
	const program = initShaderProgram(gl, vsSource, fsSource);
	const aVertexPositionHandle = gl.getAttribLocation(program, 'aVertexPosition');
	const aTextureCoordHandle = gl.getAttribLocation(program, 'aTextureCoord');
//	const uSamplerHandle = gl.getUniformLocation(program, 'uSampler');
	const positionBuffer = gl.createBuffer();
	const textureCoordBuffer = gl.createBuffer();
	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(new Int32Array(width * height).fill(0xff000000).buffer));
	gl.useProgram(program);
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
	gl.vertexAttribPointer(aVertexPositionHandle, 2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(aVertexPositionHandle);
	node = audioCtx.createScriptProcessor(2048, 1, 1), samples0 = silence = new Float32Array(maxLength = node.bufferSize);
	node.onaudioprocess = ({playbackTime, outputBuffer}) => {
		const buffer = outputBuffer.getChannelData(0);
		buffer.set(samples0), samples0 !== silence && (samples0 = silence, postMessage({timestamp: playbackTime + maxLength / audioCtx.sampleRate}, '*'));
	};
	const button = new Image();
	document.body.appendChild(button);
	button.addEventListener('click', () => { audioCtx.state === 'suspended' ? audioCtx.resume().catch() : audioCtx.state === 'running' && audioCtx.suspend().catch(); });
	document.addEventListener('keydown', keydown ? keydown : e => {
		if (e.repeat)
			return;
		switch (e.code) {
		case 'ArrowLeft':
			return void('left' in game && game.left(true));
		case 'ArrowUp':
			return void('up' in game && game.up(true));
		case 'ArrowRight':
			return void('right' in game && game.right(true));
		case 'ArrowDown':
			return void('down' in game && game.down(true));
		case 'Digit0':
			return void('coin' in game && game.coin(true));
		case 'Digit1':
			return void('start1P' in game && game.start1P(true));
		case 'Digit2':
			return void('start2P' in game && game.start2P(true));
		case 'KeyM': // MUTE
			return void(audioCtx.state === 'suspended' ? audioCtx.resume().catch() : audioCtx.state === 'running' && audioCtx.suspend().catch());
		case 'KeyR':
			return game.reset();
		case 'KeyT':
			return void('fTest' in game && (game.fTest = !game.fTest) === true && (game.fReset = true));
		case 'Space':
		case 'KeyX':
			return void('triggerA' in game && game.triggerA(true));
		case 'KeyZ':
			return void('triggerB' in game && game.triggerB(true));
		}
	});
	document.addEventListener('keyup', keyup ? keyup : e => {
		switch (e.code) {
		case 'ArrowLeft':
			return void('left' in game && game.left(false));
		case 'ArrowUp':
			return void('up' in game && game.up(false));
		case 'ArrowRight':
			return void('right' in game && game.right(false));
		case 'ArrowDown':
			return void('down' in game && game.down(false));
		case 'Space':
		case 'KeyX':
			return void('triggerA' in game && game.triggerA(false));
		case 'KeyZ':
			return void('triggerB' in game && game.triggerB(false));
		}
	});
	const audio = {rate: audioCtx.sampleRate, frac: 0, samples: [], execute(rate) {
		if (Array.isArray(sound))
			for (this.frac += this.rate; this.frac >= rate; this.frac -= rate)
				this.samples.push(sound.reduce((a, e) => a + e.output, 0)), sound.forEach(e => e.update());
		else
			for (this.frac += this.rate; this.frac >= rate; this.frac -= rate)
				this.samples.push(sound.output), sound.update();
	}};
	addEventListener('blur', () => audioCtx.suspend().catch());
	addEventListener('message', ({data: {timestamp}}) => {
		if (!timestamp)
			return;
		if (game.execute(audio, maxLength), audio.samples.length >= maxLength)
			return samples0 = new Float32Array(audio.samples.slice(0, maxLength)), void audio.samples.splice(0);
		const {buffer} = game.makeBitmap(false), {cxScreen, cyScreen, width, xOffset, yOffset} = game, array = new Uint8Array(cxScreen * cyScreen * 4);
		for (let y = 0; y < cyScreen; ++y)
			array.set(new Uint8Array(buffer, (xOffset + (y + yOffset) * width) * 4, cxScreen * 4), y * cxScreen * 4);
		images.push({timestamp: timestamp + audio.samples.length / audio.rate, array, cxScreen, cyScreen}), postMessage({timestamp}, '*');
	});
	game.updateStatus().updateInput(), postMessage({timestamp: maxLength * 2 / audioCtx.sampleRate}, '*');
	(audioCtx.onstatechange = () => {
		if (audioCtx.state === 'running') {
			button.src = volume1, button.alt = 'audio state: running';
			source = audioCtx.createBufferSource(), source.connect(node).connect(audioCtx.destination), source.start();
		} else {
			button.src = volume0, button.alt = 'audio state: ' + audioCtx.state;
			source && source.stop();
		}
	})();
	requestAnimationFrame(function loop() {
		updateGamepad(game);
		for (; images.length && images[0].timestamp < audioCtx.currentTime; lastFrame = images.shift()) {}
		const {array, cxScreen, cyScreen} = images.length ? images[0] : lastFrame;
		const textureCoordinates = new Float32Array([0, 0, 0, cyScreen / height, cxScreen / width, 0, cxScreen / width, cyScreen / height]);
		gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cxScreen, cyScreen, gl.RGBA, gl.UNSIGNED_BYTE, array);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, cxScreen <= 384 && cyScreen <= 384 ? gl.NEAREST : gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, cxScreen <= 384 && cyScreen <= 384 ? gl.NEAREST : gl.LINEAR);
		gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, textureCoordinates, gl.STATIC_DRAW);
		gl.vertexAttribPointer(aTextureCoordHandle, 2, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(aTextureCoordHandle);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		requestAnimationFrame(loop);
	});
}

/*
 *
 *	Array supplementary
 *
 */

if (!Array.prototype.addBase)
	Object.defineProperty(Uint8Array.prototype, 'addBase', {
		value: function () {
			this.base = [];
			for (let begin = 0; begin < this.length; begin += 0x100) {
				const end = Math.min(begin + 0x100, this.length);
				this.base.push(this.subarray(begin, end));
			}
			return this;
		},
		writable: true,
		configurable: true,
	});

/*
 *
 *	Utilities
 *
 */

export function expand(src) {
	let img = new Image();
	return new Promise((resolve) => Object.assign(img, {onload: () => resolve(), src})).then(() => {
		const {width, height} = img, c = Object.assign(document.createElement('canvas'), {width, height}).getContext('2d');
		return c.drawImage(img, 0, 0), new Uint8Array(new Int32Array(c.getImageData(0, 0, width, height).data.buffer));
	});
}

/*
 *
 *	Gamepad Module
 *
 */

const haveEvents = 'ongamepadconnected' in window;
const controllers = [];
const gamepadStatus = {up: false, right: false, down: false, left: false, up2: false, right2: false, down2: false, left2: false, buttons: new Array(16).fill(false)};
const buttons = ['triggerA', 'triggerB', 'triggerX', 'triggerY', 'triggerL1', 'triggerR1', 'triggerL2', 'triggerR2', 'coin', 'start1P', 'triggerL3', 'triggerR3', 'up', 'down', 'left', 'right'];

window.addEventListener('gamepadconnected', e => controllers[e.gamepad.index] = e.gamepad);
window.addEventListener('gamepaddisconnected', e => delete controllers[e.gamepad.index]);

function updateGamepad(game) {
	if (!haveEvents) {
		const gamepads = 'getGamepads' in navigator && navigator.getGamepads() || 'webkitGetGamepads' in navigator && navigator.webkitGetGamepads() || [];
		controllers.splice(0);
		for (let i = 0, n = gamepads.length; i < n; i++)
			if (gamepads[i])
				controllers[gamepads[i].index] = gamepads[i];
	}
	const controller = controllers.find(() => true);
	if (!controller)
		return;
	buttons.forEach((button, i) => {
		const val = controller.buttons[i], pressed = typeof val === 'object' ? val.pressed : val === 1.0;
		pressed !== gamepadStatus.buttons[i] && (gamepadStatus.buttons[i] = pressed, button in game && game[button](pressed));
	});
	let pressed;
	(pressed = controller.axes[1] < -0.5) !== gamepadStatus.up && (gamepadStatus.up = pressed, 'up' in game && game.up(pressed));
	(pressed = controller.axes[0] > 0.5) !== gamepadStatus.right && (gamepadStatus.right = pressed, 'right' in game && game.right(pressed));
	(pressed = controller.axes[1] > 0.5) !== gamepadStatus.down && (gamepadStatus.down = pressed, 'down' in game && game.down(pressed));
	(pressed = controller.axes[0] < -0.5) !== gamepadStatus.left && (gamepadStatus.left = pressed, 'left' in game && game.left(pressed));
	(pressed = controller.axes[3] < -0.5) !== gamepadStatus.up2 && (gamepadStatus.up2 = pressed, 'up2' in game && game.up2(pressed));
	(pressed = controller.axes[2] > 0.5) !== gamepadStatus.right2 && (gamepadStatus.right2 = pressed, 'right2' in game && game.right2(pressed));
	(pressed = controller.axes[3] > 0.5) !== gamepadStatus.down2 && (gamepadStatus.down2 = pressed, 'down2' in game && game.down2(pressed));
	(pressed = controller.axes[2] < -0.5) !== gamepadStatus.left2 && (gamepadStatus.left2 = pressed, 'left2' in game && game.left2(pressed));
}
