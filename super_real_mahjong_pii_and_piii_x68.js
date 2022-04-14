/*
 *
 *	スーパーリアル麻雀PII＆PIII (X68000)
 *
 */

import {init, expand} from './main.js';
import X68000, {FDD, sound} from './x68000.js';
let game;

const keydown = e => {
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
		return game.keyboard.fifo.push(0x2a);
	case 'Backquote':
		return game.keyboard.fifo.push(0x1b);
	case 'Backslash':
		return game.keyboard.fifo.push(0x0e);
	case 'BracketLeft':
		return game.keyboard.fifo.push(0x1c);
	case 'BracketRight':
		return game.keyboard.fifo.push(0x29);
	case 'Comma':
		return game.keyboard.fifo.push(0x31);
	case 'Equal':
		return game.keyboard.fifo.push(0x0d);
	case 'Minus':
		return game.keyboard.fifo.push(0x0c);
	case 'Period':
		return game.keyboard.fifo.push(0x32);
	case 'Quote':
		return game.keyboard.fifo.push(0x28);
	case 'Semicolon':
		return game.keyboard.fifo.push(0x27);
	case 'Slash':
		return game.keyboard.fifo.push(0x33);
	case 'Backspace':
		return game.keyboard.fifo.push(0x0f);
	case 'Tab':
		return game.keyboard.fifo.push(0x10);
	case 'Enter':
		return game.keyboard.fifo.push(0x1d);
	case 'ShiftLeft':
	case 'ShiftRight':
		return game.keyboard.fifo.push(0x70);
	case 'ControlLeft':
	case 'ControlRight':
		return game.keyboard.fifo.push(0x71);
	case 'AltLeft':
		return game.keyboard.fifo.push(0x72); // OPT1
	case 'AltRight':
		return game.keyboard.fifo.push(0x73); // OPT2
	case 'CapsLock':
		return game.keyboard.fifo.push(0x5d);
	case 'Escape':
		return game.keyboard.fifo.push(0x01);
	case 'Space':
		return game.keyboard.fifo.push(0x35);
	case 'PageUp':
		return game.keyboard.fifo.push(0x38);
	case 'PageDown':
		return game.keyboard.fifo.push(0x39);
	case 'End':
		return game.keyboard.fifo.push(0x3a);
	case 'Home':
		return game.keyboard.fifo.push(0x36);
	case 'ArrowLeft':
		return game.keyboard.fifo.push(0x3b);
	case 'ArrowUp':
		return game.keyboard.fifo.push(0x3c);
	case 'ArrowRight':
		return game.keyboard.fifo.push(0x3d);
	case 'ArrowDown':
		return game.keyboard.fifo.push(0x3e);
	case 'Delete':
		return game.keyboard.fifo.push(0x37);
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
	case 'Backquote':
		return game.keyboard.fifo.push(0x80 | 0x1b);
	case 'Backslash':
		return game.keyboard.fifo.push(0x80 | 0x0e);
	case 'BracketLeft':
		return game.keyboard.fifo.push(0x80 | 0x1c);
	case 'BracketRight':
		return game.keyboard.fifo.push(0x80 | 0x29);
	case 'Comma':
		return game.keyboard.fifo.push(0x80 | 0x31);
	case 'Equal':
		return game.keyboard.fifo.push(0x80 | 0x0d);
	case 'Minus':
		return game.keyboard.fifo.push(0x80 | 0x0c);
	case 'Period':
		return game.keyboard.fifo.push(0x80 | 0x32);
	case 'Quote':
		return game.keyboard.fifo.push(0x80 | 0x28);
	case 'Semicolon':
		return game.keyboard.fifo.push(0x80 | 0x27);
	case 'Slash':
		return game.keyboard.fifo.push(0x80 | 0x33);
	case 'Backspace':
		return game.keyboard.fifo.push(0x80 | 0x0f);
	case 'Tab':
		return game.keyboard.fifo.push(0x80 | 0x10);
	case 'Enter':
		return game.keyboard.fifo.push(0x80 | 0x1d);
	case 'ShiftLeft':
	case 'ShiftRight':
		return game.keyboard.fifo.push(0x80 | 0x70);
	case 'ControlLeft':
	case 'ControlRight':
		return game.keyboard.fifo.push(0x80 | 0x71);
	case 'AltLeft':
		return game.keyboard.fifo.push(0x80 | 0x72); // OPT1
	case 'AltRight':
		return game.keyboard.fifo.push(0x80 | 0x73); // OPT2
	case 'CapsLock':
		return game.keyboard.fifo.push(0x80 | 0x5d);
	case 'Escape':
		return game.keyboard.fifo.push(0x80 | 0x01);
	case 'Space':
		return game.keyboard.fifo.push(0x80 | 0x35);
	case 'PageUp':
		return game.keyboard.fifo.push(0x80 | 0x38);
	case 'PageDown':
		return game.keyboard.fifo.push(0x80 | 0x39);
	case 'End':
		return game.keyboard.fifo.push(0x80 | 0x3a);
	case 'Home':
		return game.keyboard.fifo.push(0x80 | 0x36);
	case 'ArrowLeft':
		return game.keyboard.fifo.push(0x80 | 0x3b);
	case 'ArrowUp':
		return game.keyboard.fifo.push(0x80 | 0x3c);
	case 'ArrowRight':
		return game.keyboard.fifo.push(0x80 | 0x3d);
	case 'ArrowDown':
		return game.keyboard.fifo.push(0x80 | 0x3e);
	case 'Delete':
		return game.keyboard.fifo.push(0x80 | 0x37);
	}
};

/*
 *
 *	Super Jack Pro68K (X68000)
 *
 */

import {ROM, DISK1, DISK2, DISK3, DISK4, DISK5, DISK6} from "./dist/super_real_mahjong_pii_and_piii_x68_rom.js";
let disk1, disk2, disk3, disk4, disk5, disk6;

window.addEventListener('load', () => expand(ROM).then(ROM => {
	game = new X68000(), game.rom.set(ROM);
}).then(() => expand(DISK1)).then(disk => {
	game.fdd.command.push({unit: 0, disk: disk1 = disk});
}).then(() => expand(DISK2)).then(disk => {
	game.fdd.command.push({unit: 1, disk: disk2 = disk});
}).then(() => expand(DISK3)).then(disk => {
	disk3 = disk;
}).then(() => expand(DISK4)).then(disk => {
	disk4 = disk;
}).then(() => expand(DISK5)).then(disk => {
	disk5 = disk;
}).then(() => expand(DISK6)).then(disk => {
	disk6 = disk;
	game.fdd.eject = unit => {
		switch (FDD[unit]) {
		case disk1:
			return void game.fdd.command.push({unit}, {unit, disk: disk3});
		case disk3:
			return void game.fdd.command.push({unit}, {unit, disk: disk4});
		case disk4:
			return void game.fdd.command.push({unit}, {unit, disk: disk5});
		case disk5:
			return void game.fdd.command.push({unit}, {unit, disk: disk6});
		case disk6:
			return void game.fdd.command.push({unit}, {unit, disk: disk1});
		}
	};
	game.touch = {x: null, y: null};
	canvas.addEventListener('click', () => void game.keyboard.fifo.push(0x1d, 0x80 | 0x1d));
	init({game, sound, keydown, keyup});
}));

