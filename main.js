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
			if (audioCtx.state === 'suspended')
				audioCtx.resume().catch();
			else if (audioCtx.state === 'running')
				audioCtx.suspend().catch();
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
	(button.update = () => {
		button.src = audioCtx.state === 'suspended' ? volume0 : volume1;
		button.alt = 'audio state: ' + audioCtx.state;
	})();
	audioCtx.onstatechange = button.update;
	document.body.appendChild(button);
	button.addEventListener('click', () => {
		if (audioCtx.state === 'suspended')
			audioCtx.resume().catch();
		else if (audioCtx.state === 'running')
			audioCtx.suspend().catch();
	});
	window.addEventListener('blur', () => {
		state = audioCtx.state;
		audioCtx.suspend().catch();
	});
	window.addEventListener('focus', () => {
		if (state === 'running')
			audioCtx.resume().catch();
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
const gamepadStatus = {up: false, right: false, down: false, left: false, up2: false, right2: false, down2: false, left2: false,
						triggerA: false, triggerB: false, triggerX: false, triggerY: false, select: false, start: false};

window.addEventListener('gamepadconnected', e => controllers[e.gamepad.index] = e.gamepad);
window.addEventListener('gamepaddisconnected', e => delete controllers[e.gamepad.index]);

function updateGamepad(game) {
	if (!haveEvents) {
		const gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
		controllers.splice(0);
		for (let i = 0, n = gamepads.length; i < n; i++)
			if (gamepads[i])
				controllers[gamepads[i].index] = gamepads[i];
	}
	const controller = controllers.find(() => true);
	if (!controller)
		return;
	let val, pressed;
	val = controller.buttons[0];
	if ((pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.triggerA)
		game.triggerA(gamepadStatus.triggerA = pressed);
	val = controller.buttons[1];
	if ((pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.triggerB)
		game.triggerB(gamepadStatus.triggerB = pressed);
	val = controller.buttons[2];
	if ((pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.triggerX && (gamepadStatus.triggerX = pressed))
		game.coin();
	val = controller.buttons[3];
	if ((pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.triggerY && (gamepadStatus.triggerY = pressed))
		game.start1P();
	val = controller.buttons[8];
	if ((pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.select && (gamepadStatus.select = pressed))
		game.coin();
	val = controller.buttons[9];
	if ((pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.start && (gamepadStatus.start = pressed))
		game.start1P();
	if ((pressed = controller.axes[1] < -0.5) !== gamepadStatus.up)
		game.up(gamepadStatus.up = pressed);
	if ((pressed = controller.axes[0] > 0.5) !== gamepadStatus.right)
		game.right(gamepadStatus.right = pressed);
	if ((pressed = controller.axes[1] > 0.5) !== gamepadStatus.down)
		game.down(gamepadStatus.down = pressed);
	if ((pressed = controller.axes[0] < -0.5) !== gamepadStatus.left)
		game.left(gamepadStatus.left = pressed);
	if ('up2' in game && (pressed = controller.axes[3] < -0.5) !== gamepadStatus.up2)
		game.up2(gamepadStatus.up2 = pressed);
	if ('right2' in game && (pressed = controller.axes[2] > 0.5) !== gamepadStatus.right2)
		game.right2(gamepadStatus.right2 = pressed);
	if ('down2' in game && (pressed = controller.axes[3] > 0.5) !== gamepadStatus.down2)
		game.down2(gamepadStatus.down2 = pressed);
	if ('left2' in game && (pressed = controller.axes[2] < -0.5) !== gamepadStatus.left2)
		game.left2(gamepadStatus.left2 = pressed);
}

/*
 *
 *	CPU Common Module
 *
 */

const dummypage = new Uint8Array(0x100).fill(0xff);

class Cpu {
	constructor(arg = null) {
		this.fActive = false;
		this.fSuspend = false;
		this.pc = 0;
		this.memorymap = [];
		for (let i = 0; i < 0x100; i++)
			this.memorymap.push({base: dummypage, read: null, write: () => {}, fetch: null});
		this.check_interrupt = null;
		this.breakpointmap = new Uint32Array(0x800);
		this.breakpoint = null;
		this.undef = null;
		this.undefsize = 0;
		this.arg = arg;
	}

	set_breakpoint(addr) {
		this.breakpointmap[addr >>> 5] |= 1 << (addr & 0x1f);
	}
/*
 *	clear_breakpoint(addr) {
 *		this.breakpointmap[addr >>> 5] &= ~(1 << (addr & 0x1f));
 *	}
 *
 *	clear_all_breakpoint() {
 *		this.breakpointmap.fill(0);
 *	}
 */
	reset() {
		this.fActive = true;
		this.fSuspend = false;
	}

	enable() {
		if (this.fActive)
			return;
		this.reset();
	}

	disable() {
		this.fActive = false;
	}

	suspend() {
		if (!this.fActive || this.fSuspend)
			return;
		this.fSuspend = true;
	}

	resume() {
		if (!this.fActive || !this.fSuspend)
			return;
		this.fSuspend = false;
	}

	interrupt() {
		if (!this.fActive)
			return false;
		this.resume();
		return true;
	}

	static multiple_execute(cpu, count) {
		const n = cpu.length;
		for (let i = 0; i < count; i++)
			for (let j = 0; j < n; j++) {
				if (!cpu[j].fActive || cpu[j].check_interrupt && cpu[j].check_interrupt(cpu[j].arg) || cpu[j].fSuspend)
					continue;
				if (cpu[j].breakpoint && (cpu[j].breakpointmap[cpu[j].pc >>> 5] & 1 << (cpu[j].pc & 0x1f)) !== 0)
					cpu[j].breakpoint(cpu[j].pc, cpu[j].arg);
				cpu[j]._execute();
			}
	}

	execute(count) {
		for (let i = 0; i < count; i++) {
			if (!this.fActive)
				break;
			if (this.check_interrupt && this.check_interrupt(this.arg) || this.fSuspend)
				continue;
			if (this.breakpoint && (this.breakpointmap[this.pc >>> 5] & 1 << (this.pc & 0x1f)) !== 0)
				this.breakpoint(this.pc, this.arg);
			this._execute();
		}
	}

	_execute() {
	}

	fetch() {
//		const page = this.memorymap[this.pc >>> 8];
//		const data = !page.fetch ? page.base[this.pc & 0xff] : page.fetch(this.pc, this.arg);
		const data = this.memorymap[this.pc >>> 8].base[this.pc & 0xff];
		this.pc = this.pc + 1 & 0xffff;
		return data;
	}

	read(addr) {
		const page = this.memorymap[addr >>> 8];
		return !page.read ? page.base[addr & 0xff] : page.read(addr, this.arg);
	}

	read1(addr) {
		const page = this.memorymap[(addr = addr + 1 & 0xffff) >>> 8];
		return !page.read ? page.base[addr & 0xff] : page.read(addr, this.arg);
	}

	write(addr, data) {
		const page = this.memorymap[addr >>> 8];
		if (!page.write)
			page.base[addr & 0xff] = data;
		else
			page.write(addr, data, this.arg);
		return data;
	}

	write1(addr, data) {
		const page = this.memorymap[(addr = addr + 1 & 0xffff) >>> 8];
		if (!page.write)
			page.base[addr & 0xff] = data;
		else
			page.write(addr, data, this.arg);
		return data;
	}
}

Uint8Array.prototype.addBase = function () {
	this.base = [];
	for (let begin = 0; begin < this.length; begin += 0x100) {
		const end = Math.min(begin + 0x100, this.length);
		this.base.push(this.subarray(begin, end));
	}
	return this;
};

