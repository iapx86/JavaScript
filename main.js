/*
 *
 *	Main Module
 *
 */

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const canvas = document.getElementById('canvas');
const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
const cxScreen = canvas.width;
const cyScreen = canvas.height;
const button = new Image();
let state = '';

(window.onresize = () => {
	const zoom = Math.max(1, Math.min(Math.floor(window.innerWidth / cxScreen), Math.floor(window.innerHeight / cyScreen)));
	canvas.width = cxScreen * zoom;
	canvas.height = cyScreen * zoom;
	gl.viewport(0, 0, canvas.width, canvas.height);
})();

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

const program = initShaderProgram(gl, vsSource, fsSource);
const aVertexPositionHandle = gl.getAttribLocation(program, 'aVertexPosition');
const aTextureCoordHandle = gl.getAttribLocation(program, 'aTextureCoord');
// const uSamplerHandle = gl.getUniformLocation(program, 'uSampler');
const positionBuffer = gl.createBuffer();
const textureCoordBuffer = gl.createBuffer();
const texture = gl.createTexture();
let game, sound, pixel, data, rotate = false;

const volume0 = `data:image/png;base64,
iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAC4jAAAuIwF4pT92AAAA
eElEQVR42u3XywrAIAxE0fz/T09XXRRaTCvDnYoBV7o4oHlYkopctQF/B5yBAEQCRAJEAkQBRmED
dGMaMBtvUvOy7wSok7oOwBPi9rwL0M4YJ6BVsJYGoFeAPkI8DT8VIrwUxzajmHYcM5BEjGQRQ2nE
WL5/RmsADqNJE6QZh85dAAAAAElFTkSuQmCC
`;

const volume1 = `data:image/png;base64,
iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAC4jAAAuIwF4pT92AAAA
fklEQVR42u2XwQrAIAxD+/8/nZ12GrhoWoolBS9SyEOliQEgOlcY4HaAt1oAQAIs+zLEofRmiEMB
zhAH+TYkgL9i7/2zrwozAGAA1IrTU6gECOYUDGAAA4ydA9uTsHIUS16gmlGaG+7acVkeOAkk6YlI
iWQtoXRuLPfPaAbAA72UT2ikWgrdAAAAAElFTkSuQmCC
`;

function init() {
	pixel = new Uint8Array(game.width * game.height * 4);
	data = new Uint32Array(pixel.buffer);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, game.width, game.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	document.addEventListener('keydown', e => {
		switch (e.keyCode) {
		case 37: // left
			game.left(true);
			break;
		case 38: // up
			game.up(true);
			break;
		case 39: // right
			game.right(true);
			break;
		case 40: // down
			game.down(true);
			break;
		case 48: // '0'
			game.coin();
			break;
		case 49: // '1'
			game.start1P();
			break;
		case 50: // '2'
			game.start2P();
			break;
		case 77: // 'M'
			if (typeof audioCtx === 'undefined')
				break;
			if (audioCtx.state === 'suspended')
				audioCtx.resume().then(button.update);
			else if (audioCtx.state === 'running')
				audioCtx.suspend().then(button.update);
			break;
		case 82: // 'R'
			game.reset();
			break;
		case 84: // 'T'
			if ((game.fTest = !game.fTest) === true)
				game.fReset = true;
			break;
		case 32: // space
		case 88: // 'X'
			game.triggerA(true);
			break;
		case 90: // 'Z'
			game.triggerB(true);
			break;
		}
	});
	document.addEventListener('keyup', e => {
		switch (e.keyCode) {
		case 37: // left
			game.left(false);
			break;
		case 38: // up
			game.up(false);
			break;
		case 39: // right
			game.right(false);
			break;
		case 40: // down
			game.down(false);
			break;
		case 32: // space
		case 88: // 'X'
			game.triggerA(false);
			break;
		case 90: // 'Z'
			game.triggerB(false);
			break;
		}
	});
	if (typeof audioCtx === 'undefined')
		return;
	(button.update = () => {
		button.src = audioCtx.state === 'suspended' ? volume0 : volume1;
		button.alt = 'audio state: ' + audioCtx.state;
	})();
	document.body.appendChild(button);
	button.addEventListener('click', () => {
		if (audioCtx.state === 'suspended')
			audioCtx.resume().then(button.update);
		else if (audioCtx.state === 'running')
			audioCtx.suspend().then(button.update);
	});
	window.addEventListener('blur', () => {
		state = audioCtx.state;
		audioCtx.suspend().then(button.update);
	});
	window.addEventListener('focus', () => {
		if (state === 'running')
			audioCtx.resume().then(button.update);
	});
}

function draw() {
	const positions = new Float32Array(rotate ? [-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0] : [-1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0]);
	const textureCoordinates = new Float32Array([
		game.xOffset / game.width, game.yOffset / game.height,
		game.xOffset / game.width, (game.yOffset + game.cyScreen) / game.height,
		(game.xOffset + game.cxScreen) / game.width, game.yOffset / game.height,
		(game.xOffset + game.cxScreen) / game.width, (game.yOffset + game.cyScreen) / game.height
	]);

	gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, game.yOffset, game.width, game.cyScreen, gl.RGBA, gl.UNSIGNED_BYTE, pixel.subarray(game.yOffset * game.width * 4));

	gl.useProgram(program);

	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
	gl.vertexAttribPointer(aVertexPositionHandle, 2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(aVertexPositionHandle);
	gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, textureCoordinates, gl.STATIC_DRAW);
	gl.vertexAttribPointer(aTextureCoordHandle, 2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(aTextureCoordHandle);

	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function loop() {
	if (typeof sound !== 'undefined')
		if (Array.isArray(sound))
			sound.forEach(s => s.update(game));
		else
			sound.update(game);
	draw();
	updateGamepad(game);
	game.updateStatus().updateInput().execute().makeBitmap(data);
	requestAnimationFrame(loop);
}

/*
 *
 *	Gamepad Module
 *
 */

const haveEvents = 'ongamepadconnected' in window;
const controllers = [];
const gamepadStatus = {
	up: false,
	right: false,
	down: false,
	left: false,
	triggerA: false,
	triggerB: false,
	triggerX: false,
	triggerY: false,
	select: false,
	start: false
};

window.addEventListener('gamepadconnected', e => {
	controllers[e.gamepad.index] = e.gamepad;
});

window.addEventListener('gamepaddisconnected', e => {
	delete controllers[e.gamepad.index];
});

function updateGamepad(game) {
	let i, n;

	if (!haveEvents) {
		const gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
		for (i = 0, n = controllers.length; i < n; i++)
			if (controllers[i])
				delete controllers[i];
		for (i = 0, n = gamepads.length; i < n; i++)
			if (gamepads[i])
				controllers[gamepads[i].index] = gamepads[i];
	}
	for (i = 0, n = controllers.length; i < n; i++)
		if (controllers[i])
			break;
	if (i >= n)
		return;
	const controller = controllers[i];
	let val = controller.buttons[0];
	let pressed = val === 1.0;
	if (typeof val === 'object')
		pressed = val.pressed;
	if (pressed !== gamepadStatus.triggerA)
		game.triggerA(gamepadStatus.triggerA = pressed);
	val = controller.buttons[1];
	pressed = val === 1.0;
	if (typeof val === 'object')
		pressed = val.pressed;
	if (pressed !== gamepadStatus.triggerB)
		game.triggerB(gamepadStatus.triggerB = pressed);
	val = controller.buttons[2];
	pressed = val === 1.0;
	if (typeof val === 'object')
		pressed = val.pressed;
	if (pressed !== gamepadStatus.triggerX && (gamepadStatus.triggerX = pressed))
		game.coin();
	val = controller.buttons[3];
	pressed = val === 1.0;
	if (typeof val === 'object')
		pressed = val.pressed;
	if (pressed !== gamepadStatus.triggerY && (gamepadStatus.triggerY = pressed))
		game.start1P();
	val = controller.buttons[8];
	pressed = val === 1.0;
	if (typeof val === 'object')
		pressed = val.pressed;
	if (pressed !== gamepadStatus.select && (gamepadStatus.select = pressed))
		game.coin();
	val = controller.buttons[9];
	pressed = val === 1.0;
	if (typeof val === 'object')
		pressed = val.pressed;
	if (pressed !== gamepadStatus.start && (gamepadStatus.start = pressed))
		game.start1P();
	if ((pressed = controller.axes[1] < -0.5) !== gamepadStatus.up)
		game.up(gamepadStatus.up = pressed);
	if ((pressed = controller.axes[0] > 0.5) !== gamepadStatus.right)
		game.right(gamepadStatus.right = pressed);
	if ((pressed = controller.axes[1] > 0.5) !== gamepadStatus.down)
		game.down(gamepadStatus.down = pressed);
	if ((pressed = controller.axes[0] < -0.5) !== gamepadStatus.left)
		game.left(gamepadStatus.left = pressed);
}

