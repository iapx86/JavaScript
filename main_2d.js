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
const stream_out = `
registerProcessor('StreamOut', class extends AudioWorkletProcessor {
	samples = [];
	constructor (options) {
		super(options);
		this.port.onmessage = ({data: {samples}}) => { samples && (this.samples = this.samples.concat(samples)); };
		this.port.start();
	}
	process (inputs, outputs) {
		const buffer = outputs[0][0].fill(0), length = buffer.length;
		this.samples.length >= length && buffer.set(this.samples.splice(0, length));
		this.samples.length >= sampleRate / 60 * 2 && this.samples.every(e => !e) && this.samples.splice(0);
		return true;
	}
});
`;
let game, sound;
const cxScreen = canvas.width, cyScreen = canvas.height;
const ctx = canvas.getContext('2d'), timestamps = [], samples = [];
let source, worklet, scriptNode, button, state = '', toggle = 0;
const addStreamOut = audioCtx.audioWorklet ? audioCtx.audioWorklet.addModule('data:text/javascript,' + stream_out) : new Promise((resolve, reject) => reject());
const audio = {rate: audioCtx.sampleRate, frac: 0, execute(rate, rate_correction = 1) {
	if (Array.isArray(sound))
		for (this.frac += this.rate * rate_correction; this.frac >= rate; this.frac -= rate)
			audioCtx && samples.push(sound.reduce((a, e) => a + e.output, 0)), sound.forEach(e => e.update());
	else
		for (this.frac += this.rate * rate_correction; this.frac >= rate; this.frac -= rate)
			audioCtx && samples.push(sound.output), sound.update();
}};

(window.onresize = () => {
	const zoom = Math.max(1, Math.min(Math.floor(window.innerWidth / cxScreen), Math.floor(window.innerHeight / cyScreen)));
	canvas.style.width = cxScreen * zoom + 'px';
	canvas.style.height = cyScreen * zoom + 'px';
})();

export function init({keydown, keyup, ...args} = {}) {
	({game, sound} = args);
	source = audioCtx.createBufferSource();
	addStreamOut.then(() => {
		worklet = new AudioWorkletNode(audioCtx, 'StreamOut'), worklet.port.start(), source.connect(worklet).connect(audioCtx.destination), source.start();
	}).catch(() => {
		scriptNode = audioCtx.createScriptProcessor(1024, 1, 1);
		scriptNode.onaudioprocess = ({outputBuffer}) => {
			const buffer = outputBuffer.getChannelData(0).fill(0), length = buffer.length;
			samples.length >= length && buffer.set(samples.splice(0, length)), samples.length >= length && samples.every(e => !e) && samples.splice(0);
		};
		source.connect(scriptNode).connect(audioCtx.destination), source.start();
	});
	button = new Image();
	(button.update = () => { button.src = audioCtx.state === 'suspended' ? volume0 : volume1, button.alt = 'audio state: ' + audioCtx.state; })();
	audioCtx.onstatechange = button.update;
	document.body.appendChild(button);
	button.addEventListener('click', () => { audioCtx.state === 'suspended' ? audioCtx.resume().catch() : audioCtx.state === 'running' && audioCtx.suspend().catch(); });
	window.addEventListener('blur', () => { state = audioCtx.state, audioCtx.suspend().catch(); });
	window.addEventListener('focus', () => { state === 'running' && audioCtx.resume().catch(), timestamps.splice(0); });
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
	requestAnimationFrame(function loop(timestamp) {
		for (!(toggle ^= 1) && timestamps.shift(), timestamps.push(timestamp); timestamps.length > 4096; timestamps.shift()) {}
		const rate_correction = timestamps.length > 1 ? Math.max(0.8, Math.min(1.25, (timestamp - timestamps[0]) / (timestamps.length - 1) * 0.06)) : 1;
		updateGamepad(game);
		const data = game.updateStatus().updateInput().execute(audio, rate_correction).makeBitmap();
		audioCtx.state !== 'running' && samples.splice(0), worklet && samples.length && (worklet.port.postMessage({samples}), samples.splice(0));
		ctx.putImageData(new ImageData(new Uint8ClampedArray(data.buffer), game.width, game.height), -game.xOffset, -game.yOffset);
		requestAnimationFrame(loop);
	});
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

Uint8Array.concat = function (...args) {
	const typed_array = new this(args.reduce((a, b) => a + b.length, 0));
	for (let offset = 0, i = 0; i < args.length; offset += args[i++].length)
		typed_array.set(args[i], offset);
	return typed_array;
};

/*
 *
 *	Utilities
 *
 */

export const seq = (n, s = 0, d = 1) => new Array(n).fill(0).map((e, i) => s + i * d), rseq = (...args) => seq(...args).reverse();
export const bitswap = (val, ...args) => args.map((e, i, a) => (val >> e & 1) << a.length - i - 1).reduce((a, b) => a | b);

export function convertGFX(dst, src, n, x, y, z, d) {
	for (let p = 0, q = 0, i = 0; i < n; q += d, i++)
		for (let j = 0; j < y.length; j++)
			for (let k = 0; k < x.length; p++, k++)
				for (let l = 0; l < z.length; l++)
					z[l] >= 0 && (dst[p] ^= (~src[q + (x[k] + y[j] + z[l] >> 3)] >> (x[k] + y[j] + z[l] & 7 ^ 7) & 1) << z.length - l - 1);
}

export class IntTimer {
	rate = 0;
	frac = 0;
	fn = () => {};

	constructor(rate = 0) {
		this.rate = rate;
	}

	execute(rate, fn = this.fn) {
		for (this.frac += this.rate; this.frac >= rate; this.frac -= rate)
			fn();
	}
}

export class DoubleTimer {
	rate = 0;
	frac = 0;
	fn = () => {};

	constructor(rate = 0) {
		this.rate = rate;
	}

	execute(rate, rate_correction, fn = this.fn) {
		for (this.frac += this.rate * rate_correction; this.frac >= rate; this.frac -= rate)
			fn();
	}
}

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

/*
 *
 *	CPU Common Module
 *
 */

export const dummypage = new Uint8Array(0x100).fill(0xff);

export default class Cpu {
	fActive = false;
	fSuspend = false;
	pc = 0;
	memorymap = [];
	check_interrupt = null;
	breakpointmap = new Int32Array(0x800);
	breakpoint = null;
	undef = null;
	undefsize = 0;
	clock = 0;
	frac = 0;
	cycle = 0;

	constructor(clock = 0) {
		for (let i = 0; i < 0x100; i++)
			this.memorymap.push({base: dummypage, read: null, write: () => {}, fetch: null});
		this.clock = clock;
	}

	set_breakpoint(addr) {
		this.breakpointmap[addr >> 5] |= 1 << (addr & 0x1f);
	}

	clear_breakpoint(addr) {
		this.breakpointmap[addr >> 5] &= ~(1 << (addr & 0x1f));
	}

	clear_all_breakpoint() {
		this.breakpointmap.fill(0);
	}

	reset() {
		this.fActive = true;
		this.fSuspend = false;
		this.frac = 0;
		this.cycle = 0;
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

	execute(rate) {
		if (!this.fActive)
			return;
		for (this.cycle += Math.floor((this.frac += this.clock) / rate), this.frac %= rate; this.cycle > 0;) {
			if (this.check_interrupt && this.check_interrupt())
				continue;
			if (this.fSuspend)
				return void(this.cycle = 0);
			if (this.breakpoint && this.breakpointmap[this.pc >>> 5] >> (this.pc & 31) & 1)
				this.breakpoint(this.pc);
			this._execute();
		}
	}

	execute1() {
		if (!this.fActive || this.check_interrupt && this.check_interrupt() || this.fSuspend)
			return;
		if (this.breakpoint && this.breakpointmap[this.pc >>> 5] >> (this.pc & 31) & 1)
			this.breakpoint(this.pc);
		this._execute();
	}

	_execute() {
	}

	fetch() {
//		const page = this.memorymap[this.pc >> 8];
//		const data = !page.fetch ? page.base[this.pc & 0xff] : page.fetch(this.pc);
		const data = this.memorymap[this.pc >> 8].base[this.pc & 0xff];
		this.pc = this.pc + 1 & 0xffff;
		return data;
	}

	read(addr) {
		const page = this.memorymap[addr >> 8];
		return !page.read ? page.base[addr & 0xff] : page.read(addr);
	}

	write(addr, data) {
		const page = this.memorymap[addr >> 8];
		!page.write ? void(page.base[addr & 0xff] = data) : page.write(addr, data);
	}
}

