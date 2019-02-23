/*
 *
 *	Main Module
 *
 */

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const cxScreen = canvas.width;
const cyScreen = canvas.height;
let gain = 1;

(window.onresize = function() {
	const zoom = Math.max(1, Math.min(Math.floor(window.innerWidth / cxScreen), Math.floor(window.innerHeight / cyScreen)));
	canvas.style.width = cxScreen * zoom + 'px';
	canvas.style.height = cyScreen * zoom + 'px';
})();

let game, sound, imageData, data;

function init() {
	imageData = ctx.createImageData(game.width, game.height);
	data = new Uint32Array(imageData.data.buffer);
	document.onkeydown = onkeydown;
	document.onkeyup = onkeyup;
	if (typeof sound !== 'undefined') {
		window.onblur = onblur;
		window.onfocus = onfocus;
	}
}

function loop() {
	if (typeof sound !== 'undefined')
		sound.output(game);
	ctx.putImageData(imageData, -game.xOffset, -game.yOffset);
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
