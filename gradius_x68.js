/*
 *
 *	Gradius (X68000)
 *
 */

import {init, expand} from './main.js';
import X68000, {sound} from './x68000.js';
let game;

const keydown = e => {
	if (e.repeat)
		return;
	switch (e.code) {
	case 'Enter':
		return game.keyboard.fifo.push(0x1d);
	case 'Escape':
		return game.keyboard.fifo.push(0x01);
	case 'ArrowLeft':
		return game.keyboard.fifo.push(0x47); // '4'
	case 'ArrowUp':
		return game.keyboard.fifo.push(0x44); // '8'
	case 'ArrowRight':
		return game.keyboard.fifo.push(0x49); // '6'
	case 'ArrowDown':
		return game.keyboard.fifo.push(0x4c); // '2'
	case 'KeyM': // MUTE
		return void(audioCtx.state === 'suspended' ? audioCtx.resume().catch() : audioCtx.state === 'running' && audioCtx.suspend().catch());
	case 'KeyR':
		return game.reset();
	case 'Space':
	case 'KeyX':
		return game.keyboard.fifo.push(0x2b);
	case 'KeyZ':
		return game.keyboard.fifo.push(0x2a);
	}
};

const keyup = e => {
	switch (e.code) {
	case 'Enter':
		return game.keyboard.fifo.push(0x80 | 0x1d);
	case 'Escape':
		return game.keyboard.fifo.push(0x80 | 0x01);
	case 'ArrowLeft':
		return game.keyboard.fifo.push(0x80 | 0x47); // '4'
	case 'ArrowUp':
		return game.keyboard.fifo.push(0x80 | 0x44); // '8'
	case 'ArrowRight':
		return game.keyboard.fifo.push(0x80 | 0x49); // '6'
	case 'ArrowDown':
		return game.keyboard.fifo.push(0x80 | 0x4c); // '2'
	case 'Space':
	case 'KeyX':
		return game.keyboard.fifo.push(0x80 | 0x2b);
	case 'KeyZ':
		return game.keyboard.fifo.push(0x80 | 0x2a);
	}
};

/*
 *
 *	Gradius (X68000)
 *
 */

import {ROM, DISK1} from "./dist/gradius_x68.png.js";

window.addEventListener('load', () => expand(ROM).then(ROM => {
	game = new X68000(), game.rom.set(ROM);
}).then(() => expand(DISK1)).then(disk => {
	game.fdd.command.push({unit: 0, disk});
	game.touch = {x: null, y: null};
	canvas.addEventListener('mousedown', e => game.mouse.button |= e.button === 0 ? 1 : e.button === 2 ? 2 : 0);
	canvas.addEventListener('mouseup', e => game.mouse.button &= ~(e.button === 0 ? 1 : e.button === 2 ? 2 : 0));
	canvas.addEventListener('mousemove', e => {
		typeof game.touch.x === 'number' && (game.mouse.x += e.offsetX - game.touch.x, game.mouse.y += e.offsetY - game.touch.y);
		game.touch = {x: e.offsetX, y: e.offsetY}
	});
	init({game, sound, keydown, keyup});
}));

