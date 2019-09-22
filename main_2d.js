/*
 *
 *	Main Module
 *
 */

export const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const cxScreen = canvas.width;
const cyScreen = canvas.height;
const button = new Image();
let state = '';

(window.onresize = () => {
	const zoom = Math.max(1, Math.min(Math.floor(window.innerWidth / cxScreen), Math.floor(window.innerHeight / cyScreen)));
	canvas.style.width = cxScreen * zoom + 'px';
	canvas.style.height = cyScreen * zoom + 'px';
})();

let game, sound, imageData, data;

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

export function init({keydown, keyup, ...args} = {}) {
	({game, sound} = args);
	imageData = ctx.createImageData(game.width, game.height);
	data = new Uint32Array(imageData.data.buffer);
	document.addEventListener('keydown', keydown ? keydown : e => {
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
			if (!audioCtx)
				break;
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
	document.addEventListener('keyup', keyup ? keyup : e => {
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
	if (!audioCtx)
		return;
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

export function loop() {
	if (sound)
		Array.isArray(sound) ? sound.forEach(s => s.update(game)) : sound.update(game);
	updateGamepad(game);
	game.updateStatus().updateInput().execute().makeBitmap(data);
	ctx.putImageData(imageData, -game.xOffset, -game.yOffset);
	requestAnimationFrame(loop);
}

/*
 *
 *	Array supplementary
 *
 */

Uint8Array.prototype.addBase = function () {
	this.base = [];
	for (let begin = 0; begin < this.length; begin += 0x100) {
		const end = Math.min(begin + 0x100, this.length);
		this.base.push(this.subarray(begin, end));
	}
	return this;
};

if (!Array.prototype.fill)
	Array.prototype.fill = function (value, start, end) {
		if (start === undefined)
			start = 0;
		if (end === undefined)
			end = this.length;
		for (let i = start; i < end; i++)
			this[i] = value;
		return this;
	};

if (!Array.prototype.find)
	Array.prototype.find = function(callback, thisArg) {
		for (let i = 0; i < this.length; i++)
			if (i in this && callback.call(thisArg, this[i], i, this))
				return this[i];
		return undefined;
	};

if (!Uint8Array.prototype.copyWithin)
	Uint8Array.prototype.copyWithin = function (target, start, end) {
		if (end === undefined)
			end = this.length;
		for (let i = start; i < end; i++)
			this[target - start + i] = this[i];
	};

if (!Uint8Array.prototype.fill)
	Uint8Array.prototype.fill = function (value, start, end) {
		if (start === undefined)
			start = 0;
		if (end === undefined)
			end = this.length;
		for (let i = start; i < end; i++)
			this[i] = value;
		return this;
	};

if (!Uint8Array.of)
	Uint8Array.of = function () {return new Uint8Array(arguments);};

if (!Uint32Array.prototype.copyWithin)
	Uint32Array.prototype.copyWithin = function (target, start, end) {
		if (end === undefined)
			end = this.length;
		for (let i = start; i < end; i++)
			this[target - start + i] = this[i];
	};

if (!Uint32Array.prototype.fill)
	Uint32Array.prototype.fill = function (value, start, end) {
		if (start === undefined)
			start = 0;
		if (end === undefined)
			end = this.length;
		for (let i = start; i < end; i++)
			this[i] = value;
		return this;
	};

if (!Uint32Array.of)
	Uint32Array.of = function () {return new Uint32Array(arguments);};

if (!String.prototype.repeat)
	String.prototype.repeat = function (count) {
		let str = '' + this;
		if (str.length === 0 || count === 0)
			return '';
		const maxCount = str.length * count;
		for (let i = 1; i * 2 <= count; i *= 2)
			str += str;
		str += str.substring(0, maxCount - str.length);
		return str;
	};

if (typeof Object.assign !== 'function')
	Object.defineProperty(Object, "assign", {
		value: function assign(target, varArgs) {
			const to = Object(target);
			for (let index = 1; index < arguments.length; index++) {
				const nextSource = arguments[index];
				if (nextSource !== null && nextSource !== undefined)
					for (const nextKey in nextSource)
						if (Object.prototype.hasOwnProperty.call(nextSource, nextKey))
							to[nextKey] = nextSource[nextKey];
			}
			return to;
		},
		writable: true,
		configurable: true
	});

if (!Math.log2)
	Math.log2 = x => Math.log(x) / Math.LN2;

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
	if ('hatU' in game && (pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.buttons[12])
		game.hatU(gamepadStatus.buttons[12] = pressed);
	val = controller.buttons[13];
	if ('hatD' in game && (pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.buttons[13])
		game.hatD(gamepadStatus.buttons[13] = pressed);
	val = controller.buttons[14];
	if ('hatL' in game && (pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.buttons[14])
		game.hatL(gamepadStatus.buttons[14] = pressed);
	val = controller.buttons[15];
	if ('hatR' in game && (pressed = typeof val === 'object' ? val.pressed : val === 1.0) !== gamepadStatus.buttons[15])
		game.hatR(gamepadStatus.buttons[15] = pressed);
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

/*
 *
 *	CPU Common Module
 *
 */

export const dummypage = new Uint8Array(0x100).fill(0xff);

export default class Cpu {
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

	clear_breakpoint(addr) {
		this.breakpointmap[addr >>> 5] &= ~(1 << (addr & 0x1f));
	}

	clear_all_breakpoint() {
		this.breakpointmap.fill(0);
	}

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

