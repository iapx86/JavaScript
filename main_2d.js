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
let sound;
const cxScreen = canvas.width, cyScreen = canvas.height;
const ctx = canvas.getContext('2d');
const audio = {rate: audioCtx.sampleRate, frac: 0, samples: [], maxLength: 800, timestamp: 0, execute(rate) {
	if (Array.isArray(sound))
		for (this.frac += this.rate; this.frac >= rate; this.frac -= rate)
			audioCtx && this.samples.push(sound.reduce((a, e) => a + e.output, 0)), sound.forEach(e => e.update());
	else
		for (this.frac += this.rate; this.frac >= rate; this.frac -= rate)
			audioCtx && this.samples.push(sound.output), sound.update();
}};

(window.onresize = () => {
	const zoom = Math.max(1, Math.min(Math.floor(window.innerWidth / cxScreen), Math.floor(window.innerHeight / cyScreen)));
	canvas.style.width = cxScreen * zoom + 'px';
	canvas.style.height = cyScreen * zoom + 'px';
})();

export function init({game, keydown, keyup, ...args} = {}) {
	({sound} = args);
	let {cxScreen, cyScreen} = game, images = [];
	let state = '', lastFrame = {timestamp: 0, array: new Uint8ClampedArray(new Int32Array(cxScreen * cyScreen).fill(0xff000000).buffer), cxScreen, cyScreen};
	const source = audioCtx.createBufferSource(), scriptNode = audioCtx.createScriptProcessor(2048, 1, 1);
	audio.maxLength = scriptNode.bufferSize;
	scriptNode.onaudioprocess = ({playbackTime, outputBuffer}) => {
		const buffer = outputBuffer.getChannelData(0).fill(0), length = buffer.length;
		buffer.set(audio.samples.slice(0, length)), audio.samples.splice(0), audio.timestamp = playbackTime + length / audioCtx.sampleRate;
	};
	source.connect(scriptNode).connect(audioCtx.destination), source.start();
	const button = new Image();
	(button.update = () => { button.src = audioCtx.state === 'suspended' ? volume0 : volume1, button.alt = 'audio state: ' + audioCtx.state; })();
	audioCtx.onstatechange = button.update;
	document.body.appendChild(button);
	button.addEventListener('click', () => { audioCtx.state === 'suspended' ? audioCtx.resume().catch() : audioCtx.state === 'running' && audioCtx.suspend().catch(); });
	window.addEventListener('blur', () => { state = audioCtx.state, audioCtx.suspend().catch(); });
	window.addEventListener('focus', () => { state === 'running' && audioCtx.resume().catch(); });
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
			return void('coin' in game && game.coin());
		case 'Digit1':
			return void('start1P' in game && game.start1P());
		case 'Digit2':
			return void('start2P' in game && game.start2P());
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
	game.updateStatus().updateInput();
	requestAnimationFrame(function loop() {
		function ent({buffer}) {
			const {cxScreen, cyScreen, width, xOffset, yOffset} = game, array = new Uint8ClampedArray(cxScreen * cyScreen * 4);
			for (let y = 0; y < game.cyScreen; ++y)
				array.set(new Uint8ClampedArray(buffer, (xOffset + (y + yOffset) * width) * 4, cxScreen * 4), y * cxScreen * 4);
			const timestamp = audio.timestamp + audio.samples.length / audio.rate;
			images.push({timestamp, array, cxScreen, cyScreen});
		}
		if (audioCtx && audioCtx.state === 'running') {
			updateGamepad(game), game.execute(audio, audio.maxLength, ent);
			for (; images.length && images[0].timestamp < audioCtx.currentTime; lastFrame = images.shift()) {}
		} else {
			updateGamepad(game), game.execute(audio, Math.floor(audio.rate / 60), ent), audio.samples.splice(0);
			for (; images.length; lastFrame = images.shift()) {}
		}
		const {array, cxScreen, cyScreen} = images.length ? images[0] : lastFrame;
		ctx.putImageData(new ImageData(array, cxScreen, cyScreen), 0, 0);
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

void function () {
	Uint8Array.__proto__.concat = function (...args) {
		const typed_array = new this(args.reduce((a, b) => a + b.length, 0));
		for (let offset = 0, i = 0; i < args.length; offset += args[i++].length)
			typed_array.set(args[i], offset);
		return typed_array;
	};
}();

/*
 *
 *	Utilities
 *
 */

export function read(url) {
	return fetch(url).then(response => {
		if (response.ok)
			return response.arrayBuffer();
		alert(`failed to get: ${url}`);
		throw new Error(url);
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
	let val, pressed;
	val = controller.buttons[0];
	if ('triggerA' in game && (pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.buttons[0])
		game.triggerA(gamepadStatus.buttons[0] = pressed);
	val = controller.buttons[1];
	if ('triggerB' in game && (pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.buttons[1])
		game.triggerB(gamepadStatus.buttons[1] = pressed);
	val = controller.buttons[2];
	if ('triggerX' in game && (pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.buttons[2])
		game.triggerX(gamepadStatus.buttons[2] = pressed);
	val = controller.buttons[3];
	if ('triggerY' in game && (pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.buttons[3])
		game.triggerY(gamepadStatus.buttons[3] = pressed);
	val = controller.buttons[4];
	if ('triggerL1' in game && (pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.buttons[4])
		game.triggerL1(gamepadStatus.buttons[4] = pressed);
	val = controller.buttons[5];
	if ('triggerR1' in game && (pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.buttons[5])
		game.triggerR1(gamepadStatus.buttons[5] = pressed);
	val = controller.buttons[6];
	if ('triggerL2' in game && (pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.buttons[6])
		game.triggerL2(gamepadStatus.buttons[6] = pressed);
	val = controller.buttons[7];
	if ('triggerR2' in game && (pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.buttons[7])
		game.triggerR2(gamepadStatus.buttons[7] = pressed);
	val = controller.buttons[8];
	if ('coin' in game && (pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.buttons[8] && (gamepadStatus.buttons[8] = pressed))
		game.coin();
	val = controller.buttons[9];
	if ('start1P' in game && (pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.buttons[9] && (gamepadStatus.buttons[9] = pressed))
		game.start1P();
	val = controller.buttons[10];
	if ('triggerL3' in game && (pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.buttons[10])
		game.triggerL3(gamepadStatus.buttons[4] = pressed);
	val = controller.buttons[11];
	if ('triggerR3' in game && (pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.buttons[11])
		game.triggerR3(gamepadStatus.buttons[5] = pressed);
	val = controller.buttons[12];
	if ('up' in game && (pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.buttons[12])
		game.up(gamepadStatus.buttons[12] = pressed);
	val = controller.buttons[13];
	if ('down' in game && (pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.buttons[13])
		game.down(gamepadStatus.buttons[13] = pressed);
	val = controller.buttons[14];
	if ('left' in game && (pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.buttons[14])
		game.left(gamepadStatus.buttons[14] = pressed);
	val = controller.buttons[15];
	if ('right' in game && (pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.buttons[15])
		game.right(gamepadStatus.buttons[15] = pressed);
	if ('up' in game && (pressed = controller.axes[1] < -0.5) !== gamepadStatus.up)
		game.up(gamepadStatus.up = pressed);
	if ('right' in game && (pressed = controller.axes[0] > 0.5) !== gamepadStatus.right)
		game.right(gamepadStatus.right = pressed);
	if ('down' in game && (pressed = controller.axes[1] > 0.5) !== gamepadStatus.down)
		game.down(gamepadStatus.down = pressed);
	if ('left' in game && (pressed = controller.axes[0] < -0.5) !== gamepadStatus.left)
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

