const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlWebpackInlineSourcePlugin = require('html-webpack-inline-source-plugin');

const list = [
	{name: '1942', title: '1942', width: 224, height: 256},
	{name: 'balloon_bomber', title: 'Balloon Bomber', width: 224, height: 256},
	{name: 'baraduke', title: 'Baraduke', width: 288, height: 224},
	{name: 'blast_off', title: 'Blast Off', width: 224, height: 288},
	{name: 'bosconian', title: 'Bosconian', width: 285, height: 224},
	{name: 'chackn_pop', title: 'Chack\'n Pop', width: 256, height: 224},
	{name: 'choplifter', title: 'Choplifter', width: 256, height: 224},
	{name: 'crazy_balloon', title: 'Crazy Balloon', width: 224, height: 256},
	{name: 'crush_roller', title: 'Crush Roller', width: 224, height: 288},
	{name: 'digdug', title: 'DigDug', width: 224, height: 288},
	{name: 'digdug_ii', title: 'DigDug II', width: 224, height: 288},
	{name: 'dragon_buster', title: 'Dragon Buster', width: 288, height: 224},
	{name: 'dragon_spirit', title: 'Dragon Spirit', width: 224, height: 288},
	{name: 'elevator_action', title: 'Elevator Action', width: 256, height: 224},
	{name: 'fantasy_zone', title: 'Fantasy Zone', width: 320, height: 224},
	{name: 'frogger', title: 'Frogger', width: 224, height: 256},
	{name: 'galaga', title: 'Galaga', width: 224, height: 288},
	{name: 'galaga_88', title: 'Galaga \'88', width: 224, height: 288},
	{name: 'galaxian', title: 'Galaxian', width: 224, height: 256},
	{name: 'galaxy_wars', title: 'Galaxy Wars', width: 224, height: 256},
	{name: 'gaplus', title: 'Gaplus', width: 224, height: 288},
	{name: 'genpei_toumaden', title: 'Genpei ToumaDen', width: 288, height: 224},
	{name: 'gradius', title: 'Gradius', width: 256, height: 224},
	{name: 'grobda', title: 'Grobda', width: 224, height: 288},
	{name: 'hopping_mappy', title: 'Hopping Mappy', width: 288, height: 224},
	{name: 'jr_pac-man', title: 'Jr. Pac-Man', width: 224, height: 288},
	{name: 'jump_bug', title: 'Jump Bug', width: 224, height: 256},
	{name: 'king_and_balloon', title: 'King & Balloon', width: 224, height: 256},
	{name: 'korosuke_roller', title: 'Korosuke Roller', width: 224, height: 288},
	{name: 'libble_rabble', title: 'Libble Rabble', width: 288, height: 224},
	{name: 'lunar_rescue', title: 'Lunar Rescue', width: 224, height: 256},
	{name: 'mappy', title: 'Mappy', width: 224, height: 288},
	{name: 'marchen_maze', title: 'Marchen Maze', width: 288, height: 224},
	{name: 'metro-cross', title: 'Metro-Cross', width: 288, height: 224},
	{name: 'moon_cresta', title: 'Moon Cresta', width: 224, height: 256},
	{name: 'motos', title: 'Motos', width: 224, height: 288},
	{name: 'new_rally-x', title: 'New Rally-X', width: 285, height: 224},
	{name: 'ninja_princess', title: 'Ninja Princess', width: 256, height: 224},
	{name: 'pac-land', title: 'Pac-Land', width: 288, height: 224},
	{name: 'pac-man', title: 'Pac-Man', width: 224, height: 288},
	{name: 'pac-mania', title: 'Pac-Mania', width: 224, height: 288},
	{name: 'pac_and_pal', title: 'Pac & Pal', width: 224, height: 288},
	{name: 'pengo', title: 'Pengo', width: 224, height: 288},
	{name: 'phozon', title: 'Phozon', width: 224, height: 288},
	{name: 'polaris', title: 'Polaris', width: 224, height: 256},
	{name: 'rally-x', title: 'Rally-X', width: 285, height: 224},
	{name: 'royal_mahjong', title: 'Royal Mahjong', width: 256, height: 240},
	{name: 'salamander', title: 'Salamander', width: 256, height: 224},
	{name: 'scramble', title: 'Scramble', width: 224, height: 256},
	{name: 'sea_fighter_poseidon', title: 'Sea Fighter Poseidon', width: 256, height: 224},
	{name: 'sky_kid', title: 'Sky Kid', width: 288, height: 224},
	{name: 'sky_kid_deluxe', title: 'Sky Kid Deluxe', width: 288, height: 224},
	{name: 'souko_ban_deluxe', title: 'Souko Ban Deluxe', width: 288, height: 224},
	{name: 'space_chaser', title: 'Space Chaser', width: 224, height: 256},
	{name: 'space_invaders', title: 'Space Invaders', width: 224, height: 256},
	{name: 'space_laser', title: 'Space Laser', width: 224, height: 256},
	{name: 'star_force', title: 'Star Force', width: 224, height: 256},
	{name: 'strategy_x', title: 'Strategy X', width: 256, height: 224},
	{name: 'super_pac-man', title: 'Super Pac-Man', width: 224, height: 288},
	{name: 'super_xevious', title: 'Super Xevious', width: 224, height: 288},
	{name: 't.t_mahjong', title: 'T.T Mahjong', width: 256, height: 240},
	{name: 'tank_battalion', title: 'Tank Battalion', width: 224, height: 256},
	{name: 'tank_force', title: 'Tank Force', width: 288, height: 224},
	{name: 'the_return_of_ishtar', title: 'The Return of Ishtar', width: 288, height: 224},
	{name: 'the_tower_of_druaga', title: 'The Tower of Druaga', width: 224, height: 288},
	{name: 'time_pilot', title: 'Time Pilot', width: 224, height: 256},
	{name: 'time_tunnel', title: 'Time Tunnel', width: 256, height: 224},
	{name: 'toki_no_senshi', title: 'Toki no Senshi', width: 224, height: 256},
	{name: 'toypop', title: 'Toypop', width: 288, height: 224},
	{name: 'twinbee', title: 'TwinBee', width: 224, height: 256},
	{name: 'ufo_senshi_yohko_chan', title: 'Ufo Senshi Yohko Chan', width: 256, height: 224},
	{name: 'vulgus', title: 'Vulgus', width: 224, height: 256},
	{name: 'warp_and_warp', title: 'Warp & Warp', width: 224, height: 272},
	{name: 'wonder_boy', title: 'Wonder Boy', width: 256, height: 224},
	{name: 'wonder_boy_in_monster_land', title: 'Wonder Boy in Monster Land', width: 256, height: 224},
	{name: 'wonder_momo', title: 'Wonder Momo', width: 288, height: 224},
	{name: 'world_court', title: 'World Court', width: 288, height: 224},
	{name: 'xevious', title: 'Xevious', width: 224, height: 288},
	{name: 'zigzag', title: 'Zig Zag', width: 224, height: 256},
];
const list2 = [
	{name: 'sound_test', title: 'Sound Test'},
	{name: 'sound_test2', title: 'Sound Test 2'},
	{name: 'sound_test3', title: 'Sound Test 3'},
	{name: 'sound_test4', title: 'Sound Test 4'},
	{name: 'sound_test5', title: 'Sound Test 5'},
	{name: 'sound_test5a', title: 'Sound Test 5a'},
	{name: 'sound_test6', title: 'Sound Test 6'},
	{name: 'sound_test7', title: 'Sound Test 7'},
	{name: 'sound_test8', title: 'Sound Test 8'},
	{name: 'sound_test9', title: 'Sound Test 9'},
	{name: 'sound_test10', title: 'Sound Test 10'},
	{name: 'sound_test10a', title: 'Sound Test 10a'},
	{name: 'sound_test10b', title: 'Sound Test 10b'},
	{name: 'sound_test10c', title: 'Sound Test 10c'},
	{name: 'sound_test10d', title: 'Sound Test 10d'},
	{name: 'sound_test10e', title: 'Sound Test 10e'},
	{name: 'sound_test11', title: 'Sound Test 11'},
	{name: 'sound_test11a', title: 'Sound Test 11a'},
	{name: 'sound_test11b', title: 'Sound Test 11b'},
	{name: 'sound_test11c', title: 'Sound Test 11c'},
	{name: 'sound_test12', title: 'Sound Test 12'},
	{name: 'sound_test12a', title: 'Sound Test 12a'},
	{name: 'sound_test12b', title: 'Sound Test 12b'},
	{name: 'sound_test12c', title: 'Sound Test 12c'},
	{name: 'sound_test12d', title: 'Sound Test 12d'},
	{name: 'sound_test12e', title: 'Sound Test 12e'},
	{name: 'sound_test12f', title: 'Sound Test 12f'},
	{name: 'sound_test12g', title: 'Sound Test 12g'},
	{name: 'sound_test12h', title: 'Sound Test 12h'},
	{name: 'sound_test13', title: 'Sound Test 13'},
	{name: 'sound_test13a', title: 'Sound Test 13a'},
	{name: 'sound_test14', title: 'Sound Test 14'},
	{name: 'sound_test15', title: 'Sound Test 15'},
	{name: 'sound_test16', title: 'Sound Test 16'},
	{name: 'sound_test16a', title: 'Sound Test 16a'},
	{name: 'sound_test16b', title: 'Sound Test 16b'},
	{name: 'sound_test16c', title: 'Sound Test 16c'},
];

module.exports = {
	mode: 'production',
	entry: list.concat(list2).reduce((a, b) => Object.assign(a, {[b.name]: `./${b.name}.js`}), {}),
	output: {
		filename: '[name].bundle.js',
		path: path.resolve(__dirname, 'dist'),
	},
	devServer: {contentBase: path.resolve(__dirname, 'dist')},
	plugins: [].concat(
		list.map(e => new HtmlWebpackPlugin({
			filename: `${e.name}.html`,
			template: 'index.html',
			chunks: [e.name],
			title: e.title,
			width: e.width,
			height: e.height,
			inlineSource: '.js$',
		})),
		list2.map(e => new HtmlWebpackPlugin({
			filename: `${e.name}.html`,
			template: 'sound_test.html',
			chunks: [e.name],
			title: e.title,
			inlineSource: '.js$',
		})),
		new HtmlWebpackInlineSourcePlugin(),
	),
	module: {
		rules: [{
			test: /\.js$/,
			exclude: /node_modules/,
			use: [{
				loader: 'babel-loader',
				options: {
					presets: [['@babel/preset-env', {modules: false, targets: 'defaults'}]],
					plugins: [['@babel/plugin-proposal-class-properties', { loose: true }]],
				}
			}]
		}]
	},
};

