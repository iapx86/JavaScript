/*
 *
 *	Prince of Persia (X68000)
 *
 */

import {init, expand} from './main.js';
import X68000, {FDD, sound} from './x68000.js';
let game, disk2, disk3;

const keydown = e => {
	if (e.repeat)
		return;
	switch (e.code) {
	case 'Digit0':
		return game.keyboard.fifo.push(0x0b);
	case 'Digit1':
		return game.keyboard.fifo.push(0x02);
	case 'Digit2':
		return game.keyboard.fifo.push(0x03);
	case 'Digit3':
		return game.keyboard.fifo.push(0x04);
	case 'Digit4':
		return game.keyboard.fifo.push(0x05);
	case 'Digit5':
		return game.keyboard.fifo.push(0x06);
	case 'Digit6':
		return game.keyboard.fifo.push(0x07);
	case 'Digit7':
		return game.keyboard.fifo.push(0x08);
	case 'Digit8':
		return game.keyboard.fifo.push(0x09);
	case 'Digit9':
		return game.keyboard.fifo.push(0x0a);
	case 'KeyA':
		return game.keyboard.fifo.push(0x1e);
	case 'KeyB':
		return game.keyboard.fifo.push(0x2e);
	case 'KeyC':
		return game.keyboard.fifo.push(0x2c);
	case 'KeyD':
		return game.keyboard.fifo.push(0x20);
	case 'KeyE':
		return game.keyboard.fifo.push(0x13);
	case 'KeyF':
		return game.keyboard.fifo.push(0x21);
	case 'KeyG':
		return game.keyboard.fifo.push(0x22);
	case 'KeyH':
		return game.keyboard.fifo.push(0x23);
	case 'KeyI':
		return game.keyboard.fifo.push(0x18);
	case 'KeyJ':
		return game.keyboard.fifo.push(0x24);
	case 'KeyK':
		return game.keyboard.fifo.push(0x25);
	case 'KeyL':
		return game.keyboard.fifo.push(0x26);
	case 'KeyM':
		return game.keyboard.fifo.push(0x30);
	case 'KeyN':
		return game.keyboard.fifo.push(0x2f);
	case 'KeyO':
		return game.keyboard.fifo.push(0x19);
	case 'KeyP':
		return game.keyboard.fifo.push(0x1a);
	case 'KeyQ':
		return game.keyboard.fifo.push(0x11);
	case 'KeyR':
		return game.keyboard.fifo.push(0x14);
	case 'KeyS':
		return game.keyboard.fifo.push(0x1f);
	case 'KeyT':
		return game.keyboard.fifo.push(0x15);
	case 'KeyU':
		return game.keyboard.fifo.push(0x17);
	case 'KeyV':
		return game.keyboard.fifo.push(0x2d);
	case 'KeyW':
		return game.keyboard.fifo.push(0x12);
	case 'KeyX':
		return game.keyboard.fifo.push(0x2b);
	case 'KeyY':
		return game.keyboard.fifo.push(0x16);
	case 'KeyZ':
	case 'Slash':
		return game.keyboard.fifo.push(0x63); // F1
	case 'Enter':
		return game.keyboard.fifo.push(0x1d);
	case 'ShiftLeft':
	case 'ShiftRight':
		return game.keyboard.fifo.push(0x70);
	case 'Escape':
		return game.keyboard.fifo.push(0x01);
	case 'Space':
		return game.keyboard.fifo.push(0x35);
	case 'ArrowLeft':
		return game.keyboard.fifo.push(0x47); // '4'
	case 'ArrowUp':
		return game.keyboard.fifo.push(0x44); // '8'
	case 'ArrowRight':
		return game.keyboard.fifo.push(0x49); // '6'
	case 'ArrowDown':
		return game.keyboard.fifo.push(0x4c); // '2'
	case 'Delete':
		switch (FDD[1]) {
		case disk2:
			return void game.fdd.command.push({unit: 1}, {unit: 1, disk: disk3});
		case disk3:
			return void game.fdd.command.push({unit: 1}, {unit: 1, disk: disk2});
		}
		return;
	}
};

const keyup = e => {
	switch (e.code) {
	case 'Digit0':
		return game.keyboard.fifo.push(0x80 | 0x0b);
	case 'Digit1':
		return game.keyboard.fifo.push(0x80 | 0x02);
	case 'Digit2':
		return game.keyboard.fifo.push(0x80 | 0x03);
	case 'Digit3':
		return game.keyboard.fifo.push(0x80 | 0x04);
	case 'Digit4':
		return game.keyboard.fifo.push(0x80 | 0x05);
	case 'Digit5':
		return game.keyboard.fifo.push(0x80 | 0x06);
	case 'Digit6':
		return game.keyboard.fifo.push(0x80 | 0x07);
	case 'Digit7':
		return game.keyboard.fifo.push(0x80 | 0x08);
	case 'Digit8':
		return game.keyboard.fifo.push(0x80 | 0x09);
	case 'Digit9':
		return game.keyboard.fifo.push(0x80 | 0x0a);
	case 'KeyA':
		return game.keyboard.fifo.push(0x80 | 0x1e);
	case 'KeyB':
		return game.keyboard.fifo.push(0x80 | 0x2e);
	case 'KeyC':
		return game.keyboard.fifo.push(0x80 | 0x2c);
	case 'KeyD':
		return game.keyboard.fifo.push(0x80 | 0x20);
	case 'KeyE':
		return game.keyboard.fifo.push(0x80 | 0x13);
	case 'KeyF':
		return game.keyboard.fifo.push(0x80 | 0x21);
	case 'KeyG':
		return game.keyboard.fifo.push(0x80 | 0x22);
	case 'KeyH':
		return game.keyboard.fifo.push(0x80 | 0x23);
	case 'KeyI':
		return game.keyboard.fifo.push(0x80 | 0x18);
	case 'KeyJ':
		return game.keyboard.fifo.push(0x80 | 0x24);
	case 'KeyK':
		return game.keyboard.fifo.push(0x80 | 0x25);
	case 'KeyL':
		return game.keyboard.fifo.push(0x80 | 0x26);
	case 'KeyM':
		return game.keyboard.fifo.push(0x80 | 0x30);
	case 'KeyN':
		return game.keyboard.fifo.push(0x80 | 0x2f);
	case 'KeyO':
		return game.keyboard.fifo.push(0x80 | 0x19);
	case 'KeyP':
		return game.keyboard.fifo.push(0x80 | 0x1a);
	case 'KeyQ':
		return game.keyboard.fifo.push(0x80 | 0x11);
	case 'KeyR':
		return game.keyboard.fifo.push(0x80 | 0x14);
	case 'KeyS':
		return game.keyboard.fifo.push(0x80 | 0x1f);
	case 'KeyT':
		return game.keyboard.fifo.push(0x80 | 0x15);
	case 'KeyU':
		return game.keyboard.fifo.push(0x80 | 0x17);
	case 'KeyV':
		return game.keyboard.fifo.push(0x80 | 0x2d);
	case 'KeyW':
		return game.keyboard.fifo.push(0x80 | 0x12);
	case 'KeyX':
		return game.keyboard.fifo.push(0x80 | 0x2b);
	case 'KeyY':
		return game.keyboard.fifo.push(0x80 | 0x16);
	case 'KeyZ':
		return game.keyboard.fifo.push(0x80 | 0x2a);
	case 'Slash':
		return game.keyboard.fifo.push(0x80 | 0x63); // F1
	case 'Enter':
		return game.keyboard.fifo.push(0x80 | 0x1d);
	case 'ShiftLeft':
	case 'ShiftRight':
		return game.keyboard.fifo.push(0x80 | 0x70);
	case 'Escape':
		return game.keyboard.fifo.push(0x80 | 0x01);
	case 'Space':
		return game.keyboard.fifo.push(0x80 | 0x35);
	case 'ArrowLeft':
		return game.keyboard.fifo.push(0x80 | 0x47); // '4'
	case 'ArrowUp':
		return game.keyboard.fifo.push(0x80 | 0x44); // '8'
	case 'ArrowRight':
		return game.keyboard.fifo.push(0x80 | 0x49); // '6'
	case 'ArrowDown':
		return game.keyboard.fifo.push(0x80 | 0x4c); // '2'
	}
};

/*
 *
 *	Prince of Persia (X68000)
 *
 */

import {ROM, DISK1, DISK2, DISK3} from "./dist/prince_of_persia_x68.png.js";

window.addEventListener('load', () => expand(ROM).then(ROM => {
	game = new X68000(), game.rom.set(ROM);
}).then(() => expand(DISK1)).then(disk => {
	game.fdd.command.push({unit: 0, disk});
}).then(() => expand(DISK2)).then(disk => {
	game.fdd.command.push({unit: 1, disk: disk2 = disk});
}).then(() => expand(DISK3)).then(disk => {
	disk3 = disk;
	canvas.addEventListener('click', () => void game.keyboard.fifo.push(0x35, 0x80 | 0x35));
	init({game, sound, keydown, keyup});
}));

