/*
 *
 *	Daimakaimura (X68000)
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
		return game.keyboard.fifo.push(0x23); // 'H'
	case 'ArrowUp':
		return game.keyboard.fifo.push(0x17); // 'U'
	case 'ArrowRight':
		return game.keyboard.fifo.push(0x25); // 'K'
	case 'ArrowDown':
		return game.keyboard.fifo.push(0x30); // 'M'
	case 'KeyM': // MUTE
		return void(audioCtx.state === 'suspended' ? audioCtx.resume().catch() : audioCtx.state === 'running' && audioCtx.suspend().catch());
	case 'KeyR':
		return game.reset();
	case 'Space':
	case 'KeyX':
		return game.keyboard.fifo.push(0x56); // XF2
	case 'KeyZ':
		return game.keyboard.fifo.push(0x55); // XF1
	}
};

const keyup = e => {
	switch (e.code) {
	case 'Enter':
		return game.keyboard.fifo.push(0x80 | 0x1d);
	case 'Escape':
		return game.keyboard.fifo.push(0x80 | 0x01);
	case 'ArrowLeft':
		return game.keyboard.fifo.push(0x80 | 0x23); // 'H'
	case 'ArrowUp':
		return game.keyboard.fifo.push(0x80 | 0x17); // 'U'
	case 'ArrowRight':
		return game.keyboard.fifo.push(0x80 | 0x25); // 'K'
	case 'ArrowDown':
		return game.keyboard.fifo.push(0x80 | 0x30); // 'M'
	case 'Space':
	case 'KeyX':
		return game.keyboard.fifo.push(0x80 | 0x56); // XF2
	case 'KeyZ':
		return game.keyboard.fifo.push(0x80 | 0x55); // XF1
	}
};

/*
 *
 *	Daimakaimura (X68000)
 *
 */

import {ROM, DISK1, DISK2} from "./dist/daimakaimura_x68.png.js";

window.addEventListener('load', () => expand(ROM).then(ROM => {
	game = new X68000(), game.rom.set(ROM);
}).then(() => expand(DISK1)).then(disk => {
	game.fdd.command.push({unit: 0, disk});
}).then(() => expand(DISK2)).then(disk => {
	game.fdd.command.push({unit: 1, disk});
	canvas.addEventListener('click', () => void game.keyboard.fifo.push(0x56, 0x80 | 0x56));
	init({game, sound, keydown, keyup});
}));

