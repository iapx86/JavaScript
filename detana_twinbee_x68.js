/*
 *
 *	Detana!! TwinBee (X68000)
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
	case 'Digit1':
		return game.keyboard.fifo.push(0x63); // F1
	case 'Digit2':
		return game.keyboard.fifo.push(0x64); // F2
	case 'Digit3':
		return game.keyboard.fifo.push(0x65); // F3
	case 'KeyM': // MUTE
		return void(audioCtx.state === 'suspended' ? audioCtx.resume().catch() : audioCtx.state === 'running' && audioCtx.suspend().catch());
	case 'KeyR':
		return game.reset();
	case 'Space':
	case 'KeyX':
		return game.keyboard.fifo.push(0x58); // XF4
	case 'KeyZ':
		return game.keyboard.fifo.push(0x59); // XF5
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
	case 'Digit1':
		return game.keyboard.fifo.push(0x80 | 0x63); // F1
	case 'Digit2':
		return game.keyboard.fifo.push(0x80 | 0x64); // F2
	case 'Digit3':
		return game.keyboard.fifo.push(0x80 | 0x65); // F3
	case 'Space':
	case 'KeyX':
		return game.keyboard.fifo.push(0x80 | 0x58); // XF4
	case 'KeyZ':
		return game.keyboard.fifo.push(0x80 | 0x59); // XF5
	}
};

/*
 *
 *	Detana!! TwinBee (X68000)
 *
 */

import {ROM, DISK1, DISK2} from "./dist/detana_twinbee_x68.png.js";

window.addEventListener('load', () => expand(ROM).then(ROM => {
	game = new X68000(), game.rom.set(ROM);
}).then(() => expand(DISK1)).then(disk => {
	game.fdd.command.push({unit: 0, disk});
}).then(() => expand(DISK2)).then(disk => {
	game.fdd.command.push({unit: 1, disk});
	canvas.addEventListener('click', () => void game.keyboard.fifo.push(0x58, 0x80 | 0x58));
	init({game, sound, keydown, keyup});
}));

