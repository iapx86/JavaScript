/*
 *
 *	Main Module
 *
 */

const canvas = document.getElementById('canvas');
const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
const cxScreen = canvas.width;
const cyScreen = canvas.height;
let gain = 1;

(window.onresize = function() {
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

function init() {
	pixel = new Uint8Array(game.width * game.height * 4);
	data = new Uint32Array(pixel.buffer);
	document.onkeydown = onkeydown;
	document.onkeyup = onkeyup;
	if (typeof sound !== 'undefined') {
		window.onblur = onblur;
		window.onfocus = onfocus;
	}
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, game.width, game.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
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
		sound.output(game);
	draw();
	updateGamepad(game);
	game.updateStatus().updateInput().execute().makeBitmap(data);
	requestAnimationFrame(loop);
}

function onkeydown(e) {
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
		sound.gainNode.gain.value = sound.gainNode.gain.value ? 0 : 1;
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
}

function onkeyup(e) {
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
}

function onblur() {
	gain = sound.gainNode.gain.value;
	sound.gainNode.gain.value = 0;
}

function onfocus() {
	sound.gainNode.gain.value = gain;
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

window.addEventListener('gamepadconnected', function (e) {
	controllers[e.gamepad.index] = e.gamepad;
});

window.addEventListener('gamepaddisconnected', function (e) {
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
	if (typeof(val) === 'object')
		pressed = val.pressed;
	if (pressed !== gamepadStatus.triggerA)
		game.triggerA(gamepadStatus.triggerA = pressed);
	val = controller.buttons[1];
	pressed = val === 1.0;
	if (typeof(val) === 'object')
		pressed = val.pressed;
	if (pressed !== gamepadStatus.triggerB)
		game.triggerB(gamepadStatus.triggerB = pressed);
	val = controller.buttons[2];
	pressed = val === 1.0;
	if (typeof(val) === 'object')
		pressed = val.pressed;
	if (pressed !== gamepadStatus.triggerX && (gamepadStatus.triggerX = pressed))
		game.coin();
	val = controller.buttons[3];
	pressed = val === 1.0;
	if (typeof(val) === 'object')
		pressed = val.pressed;
	if (pressed !== gamepadStatus.triggerY && (gamepadStatus.triggerY = pressed))
		game.start1P();
	val = controller.buttons[8];
	pressed = val === 1.0;
	if (typeof(val) === 'object')
		pressed = val.pressed;
	if (pressed !== gamepadStatus.select && (gamepadStatus.select = pressed))
		game.coin();
	val = controller.buttons[9];
	pressed = val === 1.0;
	if (typeof(val) === 'object')
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
