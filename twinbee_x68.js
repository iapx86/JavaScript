/*
 *
 *	TwinBee (X68000)
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
		return game.keyboard.fifo.push(0x1e); // 'A'
	case 'ArrowUp':
		return game.keyboard.fifo.push(0x12); // 'W'
	case 'ArrowRight':
		return game.keyboard.fifo.push(0x20); // 'D'
	case 'ArrowDown':
		return game.keyboard.fifo.push(0x2b); // 'X'
	case 'KeyM': // MUTE
		return void(audioCtx.state === 'suspended' ? audioCtx.resume().catch() : audioCtx.state === 'running' && audioCtx.suspend().catch());
	case 'KeyR':
		return game.reset();
	case 'Space':
	case 'KeyX':
		return game.keyboard.fifo.push(0x2e); // 'B'
	case 'KeyZ':
		return game.keyboard.fifo.push(0x2f); // 'N'
	}
};

const keyup = e => {
	switch (e.code) {
	case 'Enter':
		return game.keyboard.fifo.push(0x80 | 0x1d);
	case 'Escape':
		return game.keyboard.fifo.push(0x80 | 0x01);
	case 'ArrowLeft':
		return game.keyboard.fifo.push(0x80 | 0x1e); // 'A'
	case 'ArrowUp':
		return game.keyboard.fifo.push(0x80 | 0x12); // 'W'
	case 'ArrowRight':
		return game.keyboard.fifo.push(0x80 | 0x20); // 'D'
	case 'ArrowDown':
		return game.keyboard.fifo.push(0x80 | 0x2b); // 'X'
	case 'Space':
	case 'KeyX':
		return game.keyboard.fifo.push(0x80 | 0x2e); // 'B'
	case 'KeyZ':
		return game.keyboard.fifo.push(0x80 | 0x2f); // 'N'
	}
};

/*
 *
 *	TwinBee (X68000)
 *
 */

import {ROM, DISK1} from "./dist/twinbee_x68_rom.js";

window.addEventListener('load', () => expand(ROM).then(ROM => {
	game = new X68000(), game.rom.set(ROM);
}).then(() => expand(DISK1)).then(disk => {
	game.fdd.command.push({unit: 0, disk});
	canvas.addEventListener('click', () => void game.keyboard.fifo.push(0x1d, 0x80 | 0x1d));
	init({game, sound, keydown, keyup});
}));

