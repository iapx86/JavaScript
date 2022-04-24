/*
 *
 *	Pinball Pinball (X68000)
 *
 */

import {init, expand} from './main.js';
import X68000, {sound} from './x68000.js';
let game;

const keydown = e => {
	if (e.repeat)
		return;
	switch (e.code) {
	case 'ShiftLeft':
	case 'ShiftRight':
		return game.keyboard.fifo.push(0x70);
	case 'Space':
		return game.keyboard.fifo.push(0x35);
	case 'KeyM': // MUTE
		return void(audioCtx.state === 'suspended' ? audioCtx.resume().catch() : audioCtx.state === 'running' && audioCtx.suspend().catch());
	case 'KeyR':
		return game.reset();
	case 'KeyZ':
		return game.keyboard.fifo.push(0x2a);
	case 'Slash':
		return game.keyboard.fifo.push(0x34); // '_'
	}
};

const keyup = e => {
	switch (e.code) {
	case 'ShiftLeft':
	case 'ShiftRight':
		return game.keyboard.fifo.push(0x80 | 0x70);
	case 'Space':
		return game.keyboard.fifo.push(0x80 | 0x35);
	case 'KeyZ':
		return game.keyboard.fifo.push(0x80 | 0x2a);
	case 'Slash':
		return game.keyboard.fifo.push(0x80 | 0x34); // '_'
	}
};

/*
 *
 *	Pinball Pinball (X68000)
 *
 */

import {ROM, DISK1} from "./dist/pinball_pinball_x68.png.js";

window.addEventListener('load', () => expand(ROM).then(ROM => {
	game = new X68000(), game.rom.set(ROM);
}).then(() => expand(DISK1)).then(disk => {
	game.fdd.command.push({unit: 0, disk});
	canvas.addEventListener('click', () => void game.keyboard.fifo.push(0x35, 0x80 | 0x35));
	init({game, sound, keydown, keyup});
}));

