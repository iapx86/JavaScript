/*
 *
 *	Genocide (X68000)
 *
 */

import {init, expand} from './main.js';
import X68000, {FDD, sound} from './x68000.js';
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
		return game.keyboard.fifo.push(0x55); // XF1
	case 'KeyZ':
		return game.keyboard.fifo.push(0x56); // XF2
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
		return game.keyboard.fifo.push(0x80 | 0x55); // XF1
	case 'KeyZ':
		return game.keyboard.fifo.push(0x80 | 0x56); // XF2
	}
};

/*
 *
 *	Genocide (X68000)
 *
 */

import {ROM, DISK1, DISK2, DISK3, DISK4} from "./dist/genocide_x68_rom.js";
let disk2, disk3, disk4;

window.addEventListener('load', () => expand(ROM).then(ROM => {
	game = new X68000(), game.rom.set(ROM);
}).then(() => expand(DISK1)).then(disk => {
	game.fdd.command.push({unit: 0, disk});
}).then(() => expand(DISK2)).then(disk => {
	game.fdd.command.push({unit: 1, disk: disk2 = disk});
}).then(() => expand(DISK3)).then(disk => {
	disk3 = disk;
}).then(() => expand(DISK4)).then(disk => {
	disk4 = disk;
	game.fdd.eject = unit => {
		switch (FDD[unit]) {
		case disk2:
			return void game.fdd.command.push({unit}, {unit, disk: disk3});
		case disk3:
			return void game.fdd.command.push({unit}, {unit, disk: disk4});
		case disk4:
			return void game.fdd.command.push({unit}, {unit, disk: disk2});
		}
	};
	canvas.addEventListener('click', () => void game.keyboard.fifo.push(0x56, 0x80 | 0x56));
	init({game, sound, keydown, keyup});
}));

