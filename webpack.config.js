const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlWebpackInlineSourcePlugin = require('html-webpack-inline-source-plugin');

const list = [
	{name: '1942', title: '1942', width: 224, height: 256},
	{name: 'balloon_bomber', title: 'Balloon Bomber', width: 224, height: 256},
	{name: 'baraduke', title: 'Baraduke', width: 288, height: 224},
	{name: 'bosconian', title: 'Bosconian', width: 285, height: 224},
	{name: 'chackn_pop', title: 'Chack\'n Pop', width: 256, height: 224},
	{name: 'crazy_balloon', title: 'Crazy Balloon', width: 224, height: 256},
	{name: 'crush_roller', title: 'Crush Roller', width: 224, height: 288},
	{name: 'digdug', title: 'DigDug', width: 224, height: 288},
	{name: 'digdug_ii', title: 'DigDug II', width: 224, height: 288},
	{name: 'dragon_buster', title: 'Dragon Buster', width: 288, height: 224},
	{name: 'elevator_action', title: 'Elevator Action', width: 256, height: 224},
	{name: 'fantasy_zone', title: 'Fantasy Zone', width: 320, height: 224},
	{name: 'frogger', title: 'Frogger', width: 224, height: 256},
	{name: 'galaga', title: 'Galaga', width: 224, height: 288},
	{name: 'galaxian', title: 'Galaxian', width: 224, height: 256},
	{name: 'galaxy_wars', title: 'Galaxy Wars', width: 224, height: 256},
	{name: 'gaplus', title: 'Gaplus', width: 224, height: 288},
	{name: 'gradius', title: 'Gradius', width: 256, height: 224},
	{name: 'grobda', title: 'Grobda', width: 224, height: 288},
	{name: 'jr_pac-man', title: 'Jr. Pac-Man', width: 224, height: 288},
	{name: 'jump_bug', title: 'Jump Bug', width: 224, height: 256},
	{name: 'king_and_balloon', title: 'King & Balloon', width: 224, height: 256},
	{name: 'korosuke_roller', title: 'Korosuke Roller', width: 224, height: 288},
	{name: 'libble_rabble', title: 'Libble Rabble', width: 288, height: 224},
	{name: 'lunar_rescue', title: 'Lunar Rescue', width: 224, height: 256},
	{name: 'mappy', title: 'Mappy', width: 224, height: 288},
	{name: 'metro-cross', title: 'Metro-Cross', width: 288, height: 224},
	{name: 'moon_cresta', title: 'Moon Cresta', width: 224, height: 256},
	{name: 'motos', title: 'Motos', width: 224, height: 288},
	{name: 'new_rally-x', title: 'New Rally-X', width: 285, height: 224},
	{name: 'pac_and_pal', title: 'Pac & Pal', width: 224, height: 288},
	{name: 'pac-land', title: 'Pac-Land', width: 288, height: 224},
	{name: 'pac-man', title: 'Pac-Man', width: 224, height: 288},
	{name: 'pengo', title: 'Pengo', width: 224, height: 288},
	{name: 'phozon', title: 'Phozon', width: 224, height: 288},
	{name: 'polaris', title: 'Polaris', width: 224, height: 256},
	{name: 'rally-x', title: 'Rally-X', width: 285, height: 224},
	{name: 'royal_mahjong', title: 'Royal Mahjong', width: 256, height: 240},
	{name: 'salamander', title: 'Salamander', width: 256, height: 224},
	{name: 'scramble', title: 'Scramble', width: 224, height: 256},
	{name: 'sea_fighter_poseidon', title: 'Sea Fighter Poseidon', width: 256, height: 224},
	{name: 'sky_kid', title: 'Sky Kid', width: 288, height: 224},
	{name: 'space_chaser', title: 'Space Chaser', width: 224, height: 256},
	{name: 'space_invaders', title: 'Space Invaders', width: 224, height: 256},
	{name: 'space_laser', title: 'Space Laser', width: 224, height: 256},
	{name: 'star_force', title: 'Star Force', width: 224, height: 256},
	{name: 'strategy_x', title: 'Strategy X', width: 256, height: 224},
	{name: 'super_pac-man', title: 'Super Pac-Man', width: 224, height: 288},
	{name: 'super_xevious', title: 'Super Xevious', width: 224, height: 288},
	{name: 't.t_mahjong', title: 'T.T Mahjong', width: 256, height: 240},
	{name: 'tank_battalion', title: 'Tank Battalion', width: 224, height: 256},
	{name: 'the_tower_of_druaga', title: 'The Tower of Druaga', width: 224, height: 288},
	{name: 'time_pilot', title: 'Time Pilot', width: 224, height: 256},
	{name: 'time_tunnel', title: 'Time Tunnel', width: 256, height: 224},
	{name: 'toypop', title: 'Toypop', width: 288, height: 224},
	{name: 'twinbee', title: 'TwinBee', width: 224, height: 256},
	{name: 'vulgus', title: 'Vulgus', width: 224, height: 256},
	{name: 'warp_and_warp', title: 'Warp & Warp', width: 224, height: 272},
	{name: 'xevious', title: 'Xevious', width: 224, height: 288},
	{name: 'zigzag', title: 'Zig Zag', width: 224, height: 256},
];
const list2 = [
	{name: 'sound_test', title: 'Sound Test'},
	{name: 'sound_test2', title: 'Sound Test 2'},
	{name: 'sound_test3', title: 'Sound Test 3'},
	{name: 'sound_test4', title: 'Sound Test 4'},
	{name: 'sound_test5', title: 'Sound Test 5'},
	{name: 'sound_test6', title: 'Sound Test 6'},
	{name: 'sound_test7', title: 'Sound Test 7'},
	{name: 'sound_test8', title: 'Sound Test 8'},
	{name: 'sound_test9', title: 'Sound Test 9'},
	{name: 'sound_test10', title: 'Sound Test 10'},
	{name: 'sound_test11', title: 'Sound Test 11'},
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
					presets: [['@babel/preset-env', {modules: false, targets: {ie: '11'}}]]
				}
			}]
		}]
	},
};

