const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlWebpackInlineSourcePlugin = require('html-webpack-inline-source-plugin');

module.exports = {
	mode: 'production',
	entry: {
		'1942': './1942.js',
		'balloon_bomber': './balloon_bomber.js',
		'baraduke': './baraduke.js',
		'bosconian': './bosconian.js',
		'chackn_pop': './chackn_pop.js',
		'crazy_balloon': './crazy_balloon.js',
		'crush_roller': './crush_roller.js',
		'digdug': './digdug.js',
		'digdug_ii': './digdug_ii.js',
		'dragon_buster': './dragon_buster.js',
		'frogger': './frogger.js',
		'galaga': './galaga.js',
		'galaxian': './galaxian.js',
		'galaxy_wars': './galaxy_wars.js',
		'gaplus': './gaplus.js',
		'grobda': './grobda.js',
		'jr_pac-man': './jr_pac-man.js',
		'jump_bug': './jump_bug.js',
		'king_and_balloon': './king_and_balloon.js',
		'korosuke_roller': './korosuke_roller.js',
		'libble_rabble': './libble_rabble.js',
		'lunar_rescue': './lunar_rescue.js',
		'mappy': './mappy.js',
		'metro-cross': './metro-cross.js',
		'moon_cresta': './moon_cresta.js',
		'motos': './motos.js',
		'new_rally-x': './new_rally-x.js',
		'pac_and_pal': './pac_and_pal.js',
		'pac-land': './pac-land.js',
		'pac-man': './pac-man.js',
		'pengo': './pengo.js',
		'phozon': './phozon.js',
		'polaris': './polaris.js',
		'rally-x': './rally-x.js',
		'royal_mahjong': './royal_mahjong.js',
		'scramble': './scramble.js',
		'sky_kid': './sky_kid.js',
		'sound_test': './sound_test.js',
		'sound_test2': './sound_test2.js',
		'space_chaser': './space_chaser.js',
		'space_invaders': './space_invaders.js',
		'space_laser': './space_laser.js',
		'strategy_x': './strategy_x.js',
		'super_pac-man': './super_pac-man.js',
		'super_xevious': './super_xevious.js',
		't.t_mahjong': './t.t_mahjong.js',
		'tank_battalion': './tank_battalion.js',
		'the_tower_of_druaga': './the_tower_of_druaga.js',
		'time_pilot': './time_pilot.js',
		'toypop': './toypop.js',
		'vulgus': './vulgus.js',
		'warp_and_warp': './warp_and_warp.js',
		'xevious': './xevious.js',
		'zigzag': './zigzag.js',
	},
	output: {
		filename: '[name].bundle.js',
		path: __dirname + '/dist',
	},
	plugins: [
		new HtmlWebpackPlugin({title: '1942', filename: '1942.html', width: 224, height: 256, chunks: ['1942'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Balloon Bomber', filename: 'balloon_bomber.html', width: 224, height: 256, chunks: ['balloon_bomber'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Baraduke', filename: 'baraduke.html', width: 288, height: 224, chunks: ['baraduke'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Bosconian', filename: 'bosconian.html', width: 285, height: 224, chunks: ['bosconian'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Chack\'n Pop', filename: 'chackn_pop.html', width: 256, height: 224, chunks: ['chackn_pop'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Crazy Balloon', filename: 'crazy_balloon.html', width: 224, height: 256, chunks: ['crazy_balloon'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Crush Roller', filename: 'crush_roller.html', width: 224, height: 288, chunks: ['crush_roller'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'DigDug', filename: 'digdug.html', width: 224, height: 288, chunks: ['digdug'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'DigDug II', filename: 'digdug_ii.html', width: 224, height: 288, chunks: ['digdug_ii'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Dragon Buster', filename: 'dragon_buster.html', width: 288, height: 224, chunks: ['dragon_buster'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Frogger', filename: 'frogger.html', width: 224, height: 256, chunks: ['frogger'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Galaga', filename: 'galaga.html', width: 224, height: 288, chunks: ['galaga'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Galaxian', filename: 'galaxian.html', width: 224, height: 256, chunks: ['galaxian'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Galaxy Wars', filename: 'galaxy_wars.html', width: 224, height: 256, chunks: ['galaxy_wars'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Gaplus', filename: 'gaplus.html', width: 224, height: 288, chunks: ['gaplus'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Grobda', filename: 'grobda.html', width: 224, height: 288, chunks: ['grobda'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Jr. Pac-Man', filename: 'jr_pac-man.html', width: 224, height: 288, chunks: ['jr_pac-man'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Jump Bug', filename: 'jump_bug.html', width: 224, height: 256, chunks: ['jump_bug'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'King & Balloon', filename: 'king_and_balloon.html', width: 224, height: 256, chunks: ['king_and_balloon'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Korosuke Roller', filename: 'korosuke_roller.html', width: 224, height: 288, chunks: ['korosuke_roller'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Libble Rabble', filename: 'libble_rabble.html', width: 288, height: 224, chunks: ['libble_rabble'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Lunar Rescue', filename: 'lunar_rescue.html', width: 224, height: 256, chunks: ['lunar_rescue'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Mappy', filename: 'mappy.html', width: 224, height: 288, chunks: ['mappy'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Metro-Cross', filename: 'metro-cross.html', width: 288, height: 224, chunks: ['metro-cross'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Moon Cresta', filename: 'moon_cresta.html', width: 224, height: 256, chunks: ['moon_cresta'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Motos', filename: 'motos.html', width: 224, height: 288, chunks: ['motos'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'New Rally-X', filename: 'new_rally-x.html', width: 285, height: 224, chunks: ['new_rally-x'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Pac & Pal', filename: 'pac_and_pal.html', width: 224, height: 288, chunks: ['pac_and_pal'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Pac-Land', filename: 'pac-land.html', width: 288, height: 224, chunks: ['pac-land'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Pac-Man', filename: 'pac-man.html', width: 224, height: 288, chunks: ['pac-man'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Pengo', filename: 'pengo.html', width: 224, height: 288, chunks: ['pengo'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Phozon', filename: 'phozon.html', width: 224, height: 288, chunks: ['phozon'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Polaris', filename: 'polaris.html', width: 224, height: 256, chunks: ['polaris'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Rally-X', filename: 'rally-x.html', width: 285, height: 224, chunks: ['rally-x'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Royal Mahjong', filename: 'royal_mahjong.html', width: 256, height: 240, chunks: ['royal_mahjong'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Scramble', filename: 'scramble.html', width: 224, height: 256, chunks: ['scramble'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Sky Kid', filename: 'sky_kid.html', width: 288, height: 224, chunks: ['sky_kid'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Sound Test', filename: 'sound_test.html', width: 224, height: 256, chunks: ['sound_test'], template: 'sound_test.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Sound Test 2', filename: 'sound_test2.html', width: 224, height: 256, chunks: ['sound_test2'], template: 'sound_test.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Space Chaser', filename: 'space_chaser.html', width: 224, height: 256, chunks: ['space_chaser'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Space Invaders', filename: 'space_invaders.html', width: 224, height: 256, chunks: ['space_invaders'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Space Laser', filename: 'space_laser.html', width: 224, height: 256, chunks: ['space_laser'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Strategy X', filename: 'strategy_x.html', width: 256, height: 224, chunks: ['strategy_x'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Super Pac-Man', filename: 'super_pac-man.html', width: 224, height: 288, chunks: ['super_pac-man'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Super Xevious', filename: 'super_xevious.html', width: 224, height: 288, chunks: ['super_xevious'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'T.T Mahjong', filename: 't.t_mahjong.html', width: 256, height: 240, chunks: ['t.t_mahjong'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Tank Battalion', filename: 'tank_battalion.html', width: 224, height: 256, chunks: ['tank_battalion'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'The Tower of Druaga', filename: 'the_tower_of_druaga.html', width: 224, height: 288, chunks: ['the_tower_of_druaga'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Time Pilot', filename: 'time_pilot.html', width: 224, height: 256, chunks: ['time_pilot'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Toypop', filename: 'toypop.html', width: 288, height: 224, chunks: ['toypop'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Vulgus', filename: 'vulgus.html', width: 224, height: 256, chunks: ['vulgus'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Warp & Warp', filename: 'warp_and_warp.html', width: 224, height: 272, chunks: ['warp_and_warp'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Xevious', filename: 'xevious.html', width: 224, height: 288, chunks: ['xevious'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackPlugin({title: 'Zig Zag', filename: 'zigzag.html', width: 224, height: 256, chunks: ['zigzag'], template: 'index.html', inlineSource: '.js$'}),
		new HtmlWebpackInlineSourcePlugin(),
	],
	module: {
		rules: [
			{
				test: /\.js$/,
				use: [
					{
						loader: 'babel-loader',
						options: {
							presets: [
								'@babel/preset-env'
							]
						}
					}
				]
			}
		]
	}
};

