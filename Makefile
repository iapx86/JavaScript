targets = \
	1942.png.js after_burner_ii.png.js after_burner_ii_x68.png.js arkanoid_revenge_of_doh_x68.png.js \
	balloon_bomber.png.js baraduke.png.js battle_chess_x68.png.js beraboh_man.png.js blast_off.png.js \
	bomber_man_x68.png.js bonanza_bros_x68.png.js bosconian.png.js bosconian_x68.png.js bubble_bobble_x68.png.js \
	cameltry_x68.png.js chackn_pop.png.js choplifter.png.js cotton.png.js cotton_x68.png.js crazy_balloon.png.js \
	crush_roller.png.js cue_brick.png.js d_return_x68.png.js daimakaimura_x68.png.js darius.png.js dash_yarou_x68.png.js \
	detana_twinbee_x68.png.js digdug.png.js digdug_ii.png.js downtown_nekketsu_monogatari_x68.png.js \
	dragon_buster.png.js dragon_spirit.png.js dragon_spirit_x68.png.js elevator_action.png.js fantasy_zone.png.js \
	fantasy_zone_x68.png.js flicky.png.js frogger.png.js galaga.png.js galaga_88.png.js galaga_88_x68.png.js \
	galaxian.png.js galaxy_wars.png.js gaplus.png.js gemini_wing_x68.png.js genocide_x68.png.js genocide2_x68.png.js \
	genpei_toumaden.png.js genpei_toumaden_x68.png.js golden_axe.png.js gradius.png.js gradius_ii.png.js \
	gradius_iii.png.js gradius_x68.png.js grobda.png.js hishou_zame_x68.png.js hopping_mappy.png.js image_fight.png.js \
	image_fight_x68.png.js jr_pac-man.png.js jump_bug.png.js king_and_balloon.png.js \
	konya_mo_asa_made_powerful_mahjong2_x68.png.js korosuke_roller.png.js lagoon_x68.png.js libble_rabble.png.js \
	lunar_rescue.png.js mahjong_pon_chin_kan.png.js mahjong_yuugi.png.js makai-mura.png.js mappy.png.js \
	marble_madness_x68.png.js marchen_maze.png.js marchen_maze_x68.png.js master_of_weapon.png.js metro-cross.png.js \
	moon_cresta.png.js motos.png.js mr_heli_no_daibouken.png.js namco_video_game_music_library_x68.png.js \
	new_rally-x.png.js ninja_princess.png.js out_run.png.js pac-land.png.js pac-man.png.js pac-mania.png.js \
	pac-mania_x68.png.js pac_and_pal.png.js parodius_da_x68.png.js pengo.png.js phalanx_x68.png.js \
	phantasie_iii_x68.png.js phozon.png.js pinball_pinball_x68.png.js polaris.png.js pole_position_ii.png.js \
	populous_x68.png.js power_league_x68.png.js prince_of_persia_x68.png.js professional_mahjong_gokuu_x68.png.js \
	puzznic_x68.png.js quarth_x68.png.js r-type.png.js r-type_ii.png.js r-type_x68.png.js rally-x.png.js rompers.png.js \
	royal_mahjong.png.js saigo_no_nindou.png.js salamander.png.js scramble.png.js sea_fighter_poseidon.png.js \
	senjou_no_ookami.png.js shanghai_x68.png.js shuffle_puck_cafe_x68.png.js sky_kid.png.js sky_kid_deluxe.png.js \
	souko_ban_deluxe.png.js souko_ban_perfect_x68.png.js space_chaser.png.js space_harrier.png.js \
	space_harrier_x68.png.js space_invaders.png.js space_laser.png.js star_force.png.js strategy_x.png.js \
	sukeban_jansi_ryuko.png.js super_hang-on.png.js super_hang-on_x68.png.js super_pac-man.png.js \
	super_real_mahjong_part2.png.js super_real_mahjong_part3.png.js super_real_mahjong_pii_and_piii_x68.png.js \
	super_xevious.png.js syvalion_x68.png.js t.t_mahjong.png.js tank_battalion.png.js tank_force.png.js tetris.png.js \
	the_fairyland_story_x68.png.js the_newzealand_story.png.js the_newzealand_story_x68.png.js \
	the_return_of_ishtar.png.js the_return_of_ishtar_x68.png.js the_tower_of_druaga.png.js thunder_force_ii_x68.png.js \
	time_pilot.png.js time_pilot_84.png.js time_tunnel.png.js toki_no_senshi.png.js toypop.png.js turbo_out_run.png.js \
	twinbee.png.js twinbee_x68.png.js ufo_senshi_yohko_chan.png.js vball_x68.png.js vulgus.png.js warp_and_warp.png.js \
	wings_x68.png.js wonder_boy.png.js wonder_boy_iii.png.js wonder_boy_in_monster_land.png.js wonder_momo.png.js \
	world_court.png.js world_court_x68.png.js world_stadium_x68.png.js x_multiply.png.js xevious.png.js xexex.png.js \
	yokai_douchuuki.png.js zigzag.png.js

.PHONY: all
all: dist $(addprefix dist/,$(targets))

.PHONY: clean
clean:
	rm dist/*.png.js

dist:
	mkdir dist

dist/1942.png.js: $(addprefix roms/,1942.js 1942.zip)
	node $^ $@

dist/after_burner_ii.png.js: $(addprefix roms/,after_burner_ii.js aburner2.zip)
	node $^ $@

dist/after_burner_ii_x68.png.js: $(addprefix roms/,x68000.js x68000.zip after_burner_ii_disk1.xdf after_burner_ii_disk2.xdf)
	node $^ $@

dist/arkanoid_revenge_of_doh_x68.png.js: $(addprefix roms/,x68000.js x68000.zip arkanoid_revenge_of_doh.xdf)
	node $^ $@

dist/balloon_bomber.png.js: $(addprefix roms/,balloon_bomber.js ballbomb.zip)
	node $^ $@

dist/baraduke.png.js: $(addprefix roms/,baraduke.js aliensec.zip)
	node $^ $@

dist/battle_chess_x68.png.js: $(addprefix roms/,x68000.js x68000.zip battle_chess_disk1.xdf battle_chess_disk2.xdf)
	node $^ $@

dist/beraboh_man.png.js: $(addprefix roms/,beraboh_man.js berabohm.zip)
	node $^ $@

dist/blast_off.png.js: $(addprefix roms/,blast_off.js blastoff.zip)
	node $^ $@

dist/bomber_man_x68.png.js: $(addprefix roms/,x68000.js x68000.zip bomber_man.xdf)
	node $^ $@

dist/bonanza_bros_x68.png.js: $(addprefix roms/,x68000.js x68000.zip bonanza_bros_disk1.xdf bonanza_bros_disk2.xdf)
	node $^ $@

dist/bosconian.png.js: $(addprefix roms/,bosconian.js bosco.zip namco50.zip namco51.zip namco54.zip)
	node $^ $@

dist/bosconian_x68.png.js: $(addprefix roms/,x68000.js x68000.zip bosconian.xdf)
	node $^ $@

dist/bubble_bobble_x68.png.js: $(addprefix roms/,x68000.js x68000.zip bubble_bobble.xdf)
	node $^ $@

dist/cameltry_x68.png.js: $(addprefix roms/,x68000.js x68000.zip cameltry.xdf)
	node $^ $@

dist/chackn_pop.png.js: $(addprefix roms/,chackn_pop.js chaknpop.zip)
	node $^ $@

dist/choplifter.png.js: $(addprefix roms/,choplifter.js choplift.zip)
	node $^ $@

dist/cotton.png.js: $(addprefix roms/,cotton.js cotton.zip)
	node $^ $@

dist/cotton_x68.png.js: $(addprefix roms/,x68000.js x68000.zip cotton_disk1.xdf cotton_disk2.xdf)
	node $^ $@

dist/crazy_balloon.png.js: $(addprefix roms/,crazy_balloon.js crbaloon.zip)
	node $^ $@

dist/crush_roller.png.js: $(addprefix roms/,crush_roller.js crush.zip)
	node $^ $@

dist/cue_brick.png.js: $(addprefix roms/,cue_brick.js cuebrick.zip)
	node $^ $@

dist/d_return_x68.png.js: $(addprefix roms/,x68000.js x68000.zip d_return_disk1.xdf d_return_disk2.xdf)
	node $^ $@

dist/daimakaimura_x68.png.js: $(addprefix roms/,x68000.js x68000.zip daimakaimura_disk1.xdf daimakaimura_disk2.xdf)
	node $^ $@

dist/darius.png.js: $(addprefix roms/,darius.js darius.zip)
	node $^ $@

dist/dash_yarou_x68.png.js: $(addprefix roms/,x68000.js x68000.zip dash_yarou_disk1.xdf dash_yarou_disk2.xdf)
	node $^ $@

dist/detana_twinbee_x68.png.js: $(addprefix roms/,x68000.js x68000.zip detana_twinbee_disk1.xdf detana_twinbee_disk2.xdf)
	node $^ $@

dist/digdug.png.js: $(addprefix roms/,digdug.js digdug.zip namco51.zip)
	node $^ $@

dist/digdug_ii.png.js: $(addprefix roms/,digdug_ii.js digdug2.zip)
	node $^ $@

dist/downtown_nekketsu_monogatari_x68.png.js: $(addprefix roms/,x68000.js x68000.zip downtown_nekketsu_monogatari_disk1.xdf downtown_nekketsu_monogatari_disk2.xdf)
	node $^ $@

dist/dragon_buster.png.js: $(addprefix roms/,dragon_buster.js drgnbstr.zip)
	node $^ $@

dist/dragon_spirit.png.js: $(addprefix roms/,dragon_spirit.js dspirit.zip)
	node $^ $@

dist/dragon_spirit_x68.png.js: $(addprefix roms/,x68000.js x68000.zip dragon_spirit_disk1.xdf dragon_spirit_disk2.xdf)
	node $^ $@

dist/elevator_action.png.js: $(addprefix roms/,elevator_action.js elevator.zip)
	node $^ $@

dist/fantasy_zone.png.js: $(addprefix roms/,fantasy_zone.js fantzone.zip)
	node $^ $@

dist/fantasy_zone_x68.png.js: $(addprefix roms/,x68000.js x68000.zip fantasy_zone.xdf)
	node $^ $@

dist/flicky.png.js: $(addprefix roms/,flicky.js flicky.zip)
	node $^ $@

dist/frogger.png.js: $(addprefix roms/,frogger.js frogger.zip)
	node $^ $@

dist/galaga.png.js: $(addprefix roms/,galaga.js galaga.zip namco51.zip namco54.zip)
	node $^ $@

dist/galaga_88.png.js: $(addprefix roms/,galaga_88.js galaga88.zip)
	node $^ $@

dist/galaga_88_x68.png.js: $(addprefix roms/,x68000.js x68000.zip galaga_88_disk1.xdf galaga_88_disk2.xdf)
	node $^ $@

dist/galaxian.png.js: $(addprefix roms/,galaxian.js galaxian.zip)
	node $^ $@

dist/galaxy_wars.png.js: $(addprefix roms/,galaxy_wars.js galxwars.zip)
	node $^ $@

dist/gaplus.png.js: $(addprefix roms/,gaplus.js gaplus.zip namco62.zip)
	node $^ $@

dist/gemini_wing_x68.png.js: $(addprefix roms/,x68000.js x68000.zip gemini_wing_disk1.xdf gemini_wing_disk2.xdf)
	node $^ $@

dist/genocide_x68.png.js: $(addprefix roms/,x68000.js x68000.zip genocide_disk1.xdf genocide_disk2.xdf genocide_disk3.xdf genocide_disk4.xdf)
	node $^ $@

dist/genocide2_x68.png.js: $(addprefix roms/,x68000.js x68000.zip genocide2_disk1.xdf genocide2_disk2.xdf genocide2_disk3.xdf genocide2_disk4.xdf)
	node $^ $@

dist/genpei_toumaden.png.js: $(addprefix roms/,genpei_toumaden.js genpeitd.zip)
	node $^ $@

dist/genpei_toumaden_x68.png.js: $(addprefix roms/,x68000.js x68000.zip genpei_toumaden.xdf)
	node $^ $@

dist/golden_axe.png.js: $(addprefix roms/,golden_axe.js goldnaxe.zip)
	node $^ $@

dist/gradius.png.js: $(addprefix roms/,gradius.js nemesis.zip)
	node $^ $@

dist/gradius_ii.png.js: $(addprefix roms/,gradius_ii.js vulcan.zip)
	node $^ $@

dist/gradius_iii.png.js: $(addprefix roms/,gradius_iii.js gradius3.zip)
	node $^ $@

dist/gradius_x68.png.js: $(addprefix roms/,x68000.js x68000.zip gradius.xdf)
	node $^ $@

dist/grobda.png.js: $(addprefix roms/,grobda.js grobda.zip)
	node $^ $@

dist/hishou_zame_x68.png.js: $(addprefix roms/,x68000.js x68000.zip hishou_zame.xdf)
	node $^ $@

dist/hopping_mappy.png.js: $(addprefix roms/,hopping_mappy.js hopmappy.zip)
	node $^ $@

dist/image_fight.png.js: $(addprefix roms/,image_fight.js imgfight.zip)
	node $^ $@

dist/image_fight_x68.png.js: $(addprefix roms/,x68000.js x68000.zip image_fight_disk1.xdf image_fight_disk2.xdf)
	node $^ $@

dist/jr_pac-man.png.js: $(addprefix roms/,jr_pac-man.js jrpacman.zip)
	node $^ $@

dist/jump_bug.png.js: $(addprefix roms/,jump_bug.js jumpbug.zip)
	node $^ $@

dist/king_and_balloon.png.js: $(addprefix roms/,king_and_balloon.js kingball.zip)
	node $^ $@

dist/konya_mo_asa_made_powerful_mahjong2_x68.png.js: $(addprefix roms/,x68000.js x68000.zip \
		konya_mo_asa_made_powerful_mahjong2_disk1.xdf konya_mo_asa_made_powerful_mahjong2_disk2.xdf \
		konya_mo_asa_made_powerful_mahjong2_disk3.xdf konya_mo_asa_made_powerful_mahjong2_disk4.xdf)
	node $^ $@

dist/korosuke_roller.png.js: $(addprefix roms/,korosuke_roller.js crush.zip)
	node $^ $@

dist/lagoon_x68.png.js: $(addprefix roms/,x68000.js x68000.zip lagoon_disk1.xdf lagoon_disk2.xdf lagoon_disk3.xdf lagoon_disk4.xdf)
	node $^ $@

dist/libble_rabble.png.js: $(addprefix roms/,libble_rabble.js liblrabl.zip)
	node $^ $@

dist/lunar_rescue.png.js: $(addprefix roms/,lunar_rescue.js lrescue.zip)
	node $^ $@

dist/mahjong_pon_chin_kan.png.js: $(addprefix roms/,mahjong_pon_chin_kan.js ponchin.zip)
	node $^ $@

dist/mahjong_yuugi.png.js: $(addprefix roms/,mahjong_yuugi.js mjyuugi.zip)
	node $^ $@

dist/makai-mura.png.js: $(addprefix roms/,makai-mura.js gng.zip)
	node $^ $@

dist/mappy.png.js: $(addprefix roms/,mappy.js mappy.zip)
	node $^ $@

dist/marble_madness_x68.png.js: $(addprefix roms/,x68000.js x68000.zip marble_madness.xdf)
	node $^ $@

dist/marchen_maze.png.js: $(addprefix roms/,marchen_maze.js mmaze.zip)
	node $^ $@

dist/marchen_maze_x68.png.js: $(addprefix roms/,x68000.js x68000.zip marchen_maze_disk1.xdf marchen_maze_disk2.xdf)
	node $^ $@

dist/master_of_weapon.png.js: $(addprefix roms/,master_of_weapon.js masterw.zip)
	node $^ $@

dist/metro-cross.png.js: $(addprefix roms/,metro-cross.js metrocrs.zip)
	node $^ $@

dist/moon_cresta.png.js: $(addprefix roms/,moon_cresta.js mooncrst.zip)
	node $^ $@

dist/motos.png.js: $(addprefix roms/,motos.js motos.zip)
	node $^ $@

dist/mr_heli_no_daibouken.png.js: $(addprefix roms/,mr_heli_no_daibouken.js bchopper.zip)
	node $^ $@

dist/namco_video_game_music_library_x68.png.js: $(addprefix roms/,x68000.js x68000.zip namco_video_game_music_library.xdf)
	node $^ $@

dist/new_rally-x.png.js: $(addprefix roms/,new_rally-x.js nrallyx.zip)
	node $^ $@

dist/ninja_princess.png.js: $(addprefix roms/,ninja_princess.js seganinj.zip)
	node $^ $@

dist/out_run.png.js: $(addprefix roms/,out_run.js outrun.zip)
	node $^ $@

dist/pac-land.png.js: $(addprefix roms/,pac-land.js pacland.zip)
	node $^ $@

dist/pac-man.png.js: $(addprefix roms/,pac-man.js puckman.zip)
	node $^ $@

dist/pac-mania.png.js: $(addprefix roms/,pac-mania.js pacmania.zip)
	node $^ $@

dist/pac-mania_x68.png.js: $(addprefix roms/,x68000.js x68000.zip pac-mania.xdf)
	node $^ $@

dist/pac_and_pal.png.js: $(addprefix roms/,pac_and_pal.js pacnpal.zip)
	node $^ $@

dist/parodius_da_x68.png.js: $(addprefix roms/,x68000.js x68000.zip parodius_da_disk1.xdf parodius_da_disk2.xdf)
	node $^ $@

dist/pengo.png.js: $(addprefix roms/,pengo.js pengo.zip)
	node $^ $@

dist/phalanx_x68.png.js: $(addprefix roms/,x68000.js x68000.zip phalanx_disk1.xdf phalanx_disk2.xdf phalanx_disk3.xdf)
	node $^ $@

dist/phantasie_iii_x68.png.js: $(addprefix roms/,x68000.js x68000.zip phantasie_iii_disk1.xdf phantasie_iii_disk2.d88 phantasie_iii_disk3.d88)
	node $^ $@

dist/phozon.png.js: $(addprefix roms/,phozon.js phozon.zip)
	node $^ $@

dist/pinball_pinball_x68.png.js: $(addprefix roms/,x68000.js x68000.zip pinball_pinball.xdf)
	node $^ $@

dist/polaris.png.js: $(addprefix roms/,polaris.js polaris.zip)
	node $^ $@

dist/pole_position_ii.png.js: $(addprefix roms/,pole_position_ii.js polepos2.zip)
	node $^ $@

dist/populous_x68.png.js: $(addprefix roms/,x68000.js x68000.zip populous.xdf)
	node $^ $@

dist/power_league_x68.png.js: $(addprefix roms/,x68000.js x68000.zip power_league.xdf)
	node $^ $@

dist/prince_of_persia_x68.png.js: $(addprefix roms/,x68000.js x68000.zip prince_of_persia_disk1.xdf prince_of_persia_disk2.xdf prince_of_persia_disk3.xdf)
	node $^ $@

dist/professional_mahjong_gokuu_x68.png.js: $(addprefix roms/,x68000.js x68000.zip professional_mahjong_gokuu.xdf)
	node $^ $@

dist/puzznic_x68.png.js: $(addprefix roms/,x68000.js x68000.zip puzznic.xdf)
	node $^ $@

dist/quarth_x68.png.js: $(addprefix roms/,x68000.js x68000.zip quarth.xdf)
	node $^ $@

dist/r-type.png.js: $(addprefix roms/,r-type.js rtype.zip)
	node $^ $@

dist/r-type_ii.png.js: $(addprefix roms/,r-type_ii.js rtype2.zip)
	node $^ $@

dist/r-type_x68.png.js: $(addprefix roms/,x68000.js x68000.zip r-type.xdf)
	node $^ $@

dist/rally-x.png.js: $(addprefix roms/,rally-x.js rallyx.zip)
	node $^ $@

dist/rompers.png.js: $(addprefix roms/,rompers.js rompers.zip)
	node $^ $@

dist/royal_mahjong.png.js: $(addprefix roms/,royal_mahjong.js royalmj.zip)
	node $^ $@

dist/saigo_no_nindou.png.js: $(addprefix roms/,saigo_no_nindou.js nspirit.zip)
	node $^ $@

dist/salamander.png.js: $(addprefix roms/,salamander.js salamand.zip)
	node $^ $@

dist/scramble.png.js: $(addprefix roms/,scramble.js scramble.zip)
	node $^ $@

dist/sea_fighter_poseidon.png.js: $(addprefix roms/,sea_fighter_poseidon.js sfposeid.zip)
	node $^ $@

dist/senjou_no_ookami.png.js: $(addprefix roms/,senjou_no_ookami.js commando.zip)
	node $^ $@

dist/shanghai_x68.png.js: $(addprefix roms/,x68000.js x68000.zip shanghai.xdf)
	node $^ $@

dist/shuffle_puck_cafe_x68.png.js: $(addprefix roms/,x68000.js x68000.zip shuffle_puck_cafe_disk1.xdf shuffle_puck_cafe_disk2.xdf)
	node $^ $@

dist/sky_kid.png.js: $(addprefix roms/,sky_kid.js skykid.zip)
	node $^ $@

dist/sky_kid_deluxe.png.js: $(addprefix roms/,sky_kid_deluxe.js skykiddx.zip)
	node $^ $@

dist/souko_ban_deluxe.png.js: $(addprefix roms/,souko_ban_deluxe.js boxyboy.zip)
	node $^ $@

dist/souko_ban_perfect_x68.png.js: $(addprefix roms/,x68000.js x68000.zip souko_ban_perfect.xdf)
	node $^ $@

dist/space_chaser.png.js: $(addprefix roms/,space_chaser.js schaser.zip)
	node $^ $@

dist/space_harrier.png.js: $(addprefix roms/,space_harrier.js sharrier.zip)
	node $^ $@

dist/space_harrier_x68.png.js: $(addprefix roms/,x68000.js x68000.zip space_harrier.xdf)
	node $^ $@

dist/space_invaders.png.js: $(addprefix roms/,space_invaders.js invaders.zip)
	node $^ $@

dist/space_laser.png.js: $(addprefix roms/,space_laser.js spcewarl.zip)
	node $^ $@

dist/star_force.png.js: $(addprefix roms/,star_force.js starforc.zip)
	node $^ $@

dist/strategy_x.png.js: $(addprefix roms/,strategy_x.js stratgyx.zip)
	node $^ $@

dist/sukeban_jansi_ryuko.png.js: $(addprefix roms/,sukeban_jansi_ryuko.js sjryuko.zip)
	node $^ $@

dist/super_hang-on.png.js: $(addprefix roms/,super_hang-on.js shangon.zip)
	node $^ $@

dist/super_hang-on_x68.png.js: $(addprefix roms/,x68000.js x68000.zip super_hang-on_disk1.xdf super_hang-on_disk2.xdf)
	node $^ $@

dist/super_pac-man.png.js: $(addprefix roms/,super_pac-man.js superpac.zip)
	node $^ $@

dist/super_real_mahjong_part2.png.js: $(addprefix roms/,super_real_mahjong_part2.js srmp2.zip)
	node $^ $@

dist/super_real_mahjong_part3.png.js: $(addprefix roms/,super_real_mahjong_part3.js srmp3.zip)
	node $^ $@

dist/super_real_mahjong_pii_and_piii_x68.png.js: $(addprefix roms/,x68000.js x68000.zip \
		super_real_mahjong_pii_and_piii_disk1.xdf super_real_mahjong_pii_and_piii_disk2.xdf \
		super_real_mahjong_pii_and_piii_disk3.xdf super_real_mahjong_pii_and_piii_disk4.xdf \
		super_real_mahjong_pii_and_piii_disk5.xdf super_real_mahjong_pii_and_piii_disk6.xdf)
	node $^ $@

dist/super_xevious.png.js: $(addprefix roms/,super_xevious.js xevious.zip namco50.zip namco51.zip namco54.zip)
	node $^ $@

dist/syvalion_x68.png.js: $(addprefix roms/,x68000.js x68000.zip syvalion_disk1.xdf syvalion_disk2.xdf)
	node $^ $@

dist/t.t_mahjong.png.js: $(addprefix roms/,t.t_mahjong.js jongpute.zip)
	node $^ $@

dist/tank_battalion.png.js: $(addprefix roms/,tank_battalion.js tankbatt.zip)
	node $^ $@

dist/tank_force.png.js: $(addprefix roms/,tank_force.js tankfrce.zip)
	node $^ $@

dist/tetris.png.js: $(addprefix roms/,tetris.js tetris.zip)
	node $^ $@

dist/the_fairyland_story_x68.png.js: $(addprefix roms/,x68000.js x68000.zip the_fairyland_story_disk1.xdf the_fairyland_story_disk2.xdf)
	node $^ $@

dist/the_newzealand_story.png.js: $(addprefix roms/,the_newzealand_story.js tnzs.zip)
	node $^ $@

dist/the_newzealand_story_x68.png.js: $(addprefix roms/,x68000.js x68000.zip the_newzealand_story_disk1.xdf the_newzealand_story_disk2.xdf)
	node $^ $@

dist/the_return_of_ishtar.png.js: $(addprefix roms/,the_return_of_ishtar.js roishtar.zip)
	node $^ $@

dist/the_return_of_ishtar_x68.png.js: $(addprefix roms/,x68000.js x68000.zip the_return_of_ishtar.xdf)
	node $^ $@

dist/the_tower_of_druaga.png.js: $(addprefix roms/,the_tower_of_druaga.js todruaga.zip)
	node $^ $@

dist/thunder_force_ii_x68.png.js: $(addprefix roms/,x68000.js x68000.zip thunder_force_ii_disk1.xdf thunder_force_ii_disk2.xdf)
	node $^ $@

dist/time_pilot.png.js: $(addprefix roms/,time_pilot.js timeplt.zip)
	node $^ $@

dist/time_pilot_84.png.js: $(addprefix roms/,time_pilot_84.js tp84.zip)
	node $^ $@

dist/time_tunnel.png.js: $(addprefix roms/,time_tunnel.js timetunl.zip)
	node $^ $@

dist/toki_no_senshi.png.js: $(addprefix roms/,toki_no_senshi.js tokisens.zip)
	node $^ $@

dist/toypop.png.js: $(addprefix roms/,toypop.js toypop.zip)
	node $^ $@

dist/turbo_out_run.png.js: $(addprefix roms/,turbo_out_run.js toutrun.zip)
	node $^ $@

dist/twinbee.png.js: $(addprefix roms/,twinbee.js twinbee.zip)
	node $^ $@

dist/twinbee_x68.png.js: $(addprefix roms/,x68000.js x68000.zip twinbee.xdf)
	node $^ $@

dist/ufo_senshi_yohko_chan.png.js: $(addprefix roms/,ufo_senshi_yohko_chan.js ufosensi.zip)
	node $^ $@

dist/vball_x68.png.js: $(addprefix roms/,x68000.js x68000.zip vball.xdf)
	node $^ $@

dist/vulgus.png.js: $(addprefix roms/,vulgus.js vulgus.zip)
	node $^ $@

dist/warp_and_warp.png.js: $(addprefix roms/,warp_and_warp.js warpwarp.zip)
	node $^ $@

dist/wings_x68.png.js: $(addprefix roms/,x68000.js x68000.zip wings.xdf)
	node $^ $@

dist/wonder_boy.png.js: $(addprefix roms/,wonder_boy.js wboy.zip)
	node $^ $@

dist/wonder_boy_iii.png.js: $(addprefix roms/,wonder_boy_iii.js wb3.zip)
	node $^ $@

dist/wonder_boy_in_monster_land.png.js: $(addprefix roms/,wonder_boy_in_monster_land.js wbml.zip)
	node $^ $@

dist/wonder_momo.png.js: $(addprefix roms/,wonder_momo.js wndrmomo.zip)
	node $^ $@

dist/world_court.png.js: $(addprefix roms/,world_court.js wldcourt.zip)
	node $^ $@

dist/world_court_x68.png.js: $(addprefix roms/,x68000.js x68000.zip world_court_disk1.xdf world_court_disk2.xdf)
	node $^ $@

dist/world_stadium_x68.png.js: $(addprefix roms/,x68000.js x68000.zip world_stadium_disk1.xdf world_stadium_disk2.xdf)
	node $^ $@

dist/x_multiply.png.js: $(addprefix roms/,x_multiply.js xmultipl.zip)
	node $^ $@

dist/xevious.png.js: $(addprefix roms/,xevious.js xevious.zip namco50.zip namco51.zip namco54.zip)
	node $^ $@

dist/xexex.png.js: $(addprefix roms/,xexex.js xexex.zip)
	node $^ $@

dist/yokai_douchuuki.png.js: $(addprefix roms/,yokai_douchuuki.js shadowld.zip)
	node $^ $@

dist/zigzag.png.js: $(addprefix roms/,zigzag.js zigzagb.zip)
	node $^ $@

