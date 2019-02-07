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

