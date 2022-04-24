/*
 *
 *	今夜も朝までPOWERFULまあじゃん2 (X68000)
 *
 */

import {init, expand} from './main.js';
import X68000, {FDD, sound} from './x68000.js';
let game;

const keydown = e => {
	switch (e.code) {
	case 'Digit0':
		return game.keyboard.fifo.push(0x41); // '*' RON
	case 'Digit1':
		return game.keyboard.fifo.push(0x63); // F1
	case 'Digit2':
		return game.keyboard.fifo.push(0x64); // F2
	case 'Digit3':
		return game.keyboard.fifo.push(0x65); // F3
	case 'Digit4':
		return game.keyboard.fifo.push(0x66); // F4
	case 'Digit5':
		return game.keyboard.fifo.push(0x67); // F5
	case 'Digit6':
		return game.keyboard.fifo.push(0x44); // '8' KAN
	case 'Digit7':
		return game.keyboard.fifo.push(0x43); // '7' PON
	case 'Digit8':
		return game.keyboard.fifo.push(0x45); // '9' CHI
	case 'Digit9':
		return game.keyboard.fifo.push(0x4f); // '0' REACH
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
		return game.keyboard.fifo.push(0x2a);
	case 'Enter':
		return game.keyboard.fifo.push(0x1d);
	case 'Escape':
		return game.keyboard.fifo.push(0x61); // BREAK
	case 'Space':
		return game.keyboard.fifo.push(0x35);
	case 'Home':
		return game.keyboard.fifo.push(0x36);
	case 'ArrowLeft':
		return game.keyboard.fifo.push(0x47); // '4'
	case 'ArrowUp':
		return game.keyboard.fifo.push(0x44); // '8'
	case 'ArrowRight':
		return game.keyboard.fifo.push(0x49); // '6'
	case 'ArrowDown':
		return game.keyboard.fifo.push(0x4c); // '2'
	case 'Delete':
		return game.keyboard.fifo.push(0x37);
	}
};

const keyup = e => {
	switch (e.code) {
	case 'Digit0':
		return game.keyboard.fifo.push(0x80 | 0x41); // '*' RON
	case 'Digit1':
		return game.keyboard.fifo.push(0x80 | 0x63); // F1
	case 'Digit2':
		return game.keyboard.fifo.push(0x80 | 0x64); // F2
	case 'Digit3':
		return game.keyboard.fifo.push(0x80 | 0x65); // F3
	case 'Digit4':
		return game.keyboard.fifo.push(0x80 | 0x66); // F4
	case 'Digit5':
		return game.keyboard.fifo.push(0x80 | 0x67); // F5
	case 'Digit6':
		return game.keyboard.fifo.push(0x80 | 0x44); // '8' KAN
	case 'Digit7':
		return game.keyboard.fifo.push(0x80 | 0x43); // '7' PON
	case 'Digit8':
		return game.keyboard.fifo.push(0x80 | 0x45); // '9' CHI
	case 'Digit9':
		return game.keyboard.fifo.push(0x80 | 0x4f); // '0' REACH
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
	case 'Enter':
		return game.keyboard.fifo.push(0x80 | 0x1d);
	case 'Escape':
		return game.keyboard.fifo.push(0x80 | 0x61); // BREAK
	case 'Space':
		return game.keyboard.fifo.push(0x80 | 0x35);
	case 'Home':
		return game.keyboard.fifo.push(0x80 | 0x36);
	case 'ArrowLeft':
		return game.keyboard.fifo.push(0x80 | 0x47); // '4'
	case 'ArrowUp':
		return game.keyboard.fifo.push(0x80 | 0x44); // '8'
	case 'ArrowRight':
		return game.keyboard.fifo.push(0x80 | 0x49); // '6'
	case 'ArrowDown':
		return game.keyboard.fifo.push(0x80 | 0x4c); // '2'
	case 'Delete':
		return game.keyboard.fifo.push(0x80 | 0x37);
	}
};

/*
 *
 *	今夜も朝までPOWERFULまあじゃん2 (X68000)
 *
 */

import {ROM, DISK1, DISK2, DISK3, DISK4} from "./dist/konya_mo_asa_made_powerful_mahjong2_x68.png.js";
let disk1, disk2, disk3;

window.addEventListener('load', () => expand(ROM).then(ROM => {
	game = new X68000(), game.rom.set(ROM);
}).then(() => expand(DISK1)).then(disk => {
	game.fdd.command.push({unit: 0, disk: disk1 = disk});
}).then(() => expand(DISK2)).then(disk => {
	disk2 = disk;
}).then(() => expand(DISK3)).then(disk => {
	disk3 = disk;
}).then(() => expand(DISK4)).then(disk => {
	game.fdd.command.push({unit: 1, disk});
	game.fdd.eject = unit => {
		switch (FDD[unit]) {
		case disk1:
			return void game.fdd.command.push({unit}, {unit, disk: disk2});
		case disk2:
			return void game.fdd.command.push({unit}, {unit, disk: disk3});
		case disk3:
			return void game.fdd.command.push({unit}, {unit, disk: disk1});
		}
	};
	game.touch = {x: null, y: null};
	canvas.addEventListener('mousedown', e => game.mouse.button |= e.button === 0 ? 1 : e.button === 2 ? 2 : 0);
	canvas.addEventListener('mouseup', e => game.mouse.button &= ~(e.button === 0 ? 1 : e.button === 2 ? 2 : 0));
	canvas.addEventListener('mousemove', e => {
		typeof game.touch.x === 'number' && (game.mouse.x += e.offsetX - game.touch.x, game.mouse.y += e.offsetY - game.touch.y);
		game.touch = {x: e.offsetX, y: e.offsetY}
	});
	init({game, sound, keydown, keyup});
}));

