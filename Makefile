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
	pac-mania_x68.png.js pac_and_pal.png.js parodius_da_x68.png.js pengo.png.js phalanx_x68.png.js phozon.png.js \
	pinball_pinball_x68.png.js polaris.png.js pole_position_ii.png.js populous_x68.png.js power_league_x68.png.js \
	prince_of_persia_x68.png.js professional_mahjong_gokuu_x68.png.js puzznic_x68.png.js quarth_x68.png.js r-type.png.js \
	r-type_ii.png.js r-type_x68.png.js rally-x.png.js rompers.png.js royal_mahjong.png.js saigo_no_nindou.png.js \
	salamander.png.js scramble.png.js sea_fighter_poseidon.png.js senjou_no_ookami.png.js shanghai_x68.png.js \
	shuffle_puck_cafe_x68.png.js sky_kid.png.js sky_kid_deluxe.png.js souko_ban_deluxe.png.js \
	souko_ban_perfect_x68.png.js space_chaser.png.js space_harrier.png.js space_harrier_x68.png.js space_invaders.png.js \
	space_laser.png.js star_force.png.js strategy_x.png.js sukeban_jansi_ryuko.png.js super_hang-on.png.js \
	super_hang-on_x68.png.js super_pac-man.png.js super_real_mahjong_part2.png.js super_real_mahjong_part3.png.js \
	super_real_mahjong_pii_and_piii_x68.png.js super_xevious.png.js syvalion_x68.png.js t.t_mahjong.png.js \
	tank_battalion.png.js tank_force.png.js tetris.png.js the_fairyland_story_x68.png.js the_newzealand_story.png.js \
	the_newzealand_story_x68.png.js the_return_of_ishtar.png.js the_return_of_ishtar_x68.png.js \
	the_tower_of_druaga.png.js thunder_force_ii_x68.png.js time_pilot.png.js time_pilot_84.png.js time_tunnel.png.js \
	toki_no_senshi.png.js toypop.png.js turbo_out_run.png.js twinbee.png.js twinbee_x68.png.js \
	ufo_senshi_yohko_chan.png.js vball_x68.png.js vulgus.png.js warp_and_warp.png.js wings_x68.png.js wonder_boy.png.js \
	wonder_boy_iii.png.js wonder_boy_in_monster_land.png.js wonder_momo.png.js world_court.png.js world_court_x68.png.js \
	world_stadium_x68.png.js x_multiply.png.js xevious.png.js xexex.png.js yokai_douchuuki.png.js zigzag.png.js

.PHONY: all
all: dist $(addprefix dist/,$(targets))

.PHONY: clean
clean:
	del dist\*.png.js

dist:
	mkdir dist

dist/1942.png.js: $(addprefix roms/,1942.py 1942.zip)
	python $^ $@

dist/after_burner_ii.png.js: $(addprefix roms/,after_burner_ii.py aburner2.zip)
	python $^ $@

dist/after_burner_ii_x68.png.js: $(addprefix roms/,x68000.py x68000.zip after_burner_ii_disk1.xdf after_burner_ii_disk2.xdf)
	python $^ $@

dist/arkanoid_revenge_of_doh_x68.png.js: $(addprefix roms/,x68000.py x68000.zip arkanoid_revenge_of_doh.xdf)
	python $^ $@

dist/balloon_bomber.png.js: $(addprefix roms/,balloon_bomber.py ballbomb.zip)
	python $^ $@

dist/baraduke.png.js: $(addprefix roms/,baraduke.py aliensec.zip)
	python $^ $@

dist/battle_chess_x68.png.js: $(addprefix roms/,x68000.py x68000.zip battle_chess_disk1.xdf battle_chess_disk2.xdf)
	python $^ $@

dist/beraboh_man.png.js: $(addprefix roms/,beraboh_man.py berabohm.zip)
	python $^ $@

dist/blast_off.png.js: $(addprefix roms/,blast_off.py blastoff.zip)
	python $^ $@

dist/bomber_man_x68.png.js: $(addprefix roms/,x68000.py x68000.zip bomber_man.xdf)
	python $^ $@

dist/bonanza_bros_x68.png.js: $(addprefix roms/,x68000.py x68000.zip bonanza_bros_disk1.xdf bonanza_bros_disk2.xdf)
	python $^ $@

dist/bosconian.png.js: $(addprefix roms/,bosconian.py bosco.zip namco50.zip namco51.zip namco54.zip)
	python $^ $@

dist/bosconian_x68.png.js: $(addprefix roms/,x68000.py x68000.zip bosconian.xdf)
	python $^ $@

dist/bubble_bobble_x68.png.js: $(addprefix roms/,x68000.py x68000.zip bubble_bobble.xdf)
	python $^ $@

dist/cameltry_x68.png.js: $(addprefix roms/,x68000.py x68000.zip cameltry.xdf)
	python $^ $@

dist/chackn_pop.png.js: $(addprefix roms/,chackn_pop.py chaknpop.zip)
	python $^ $@

dist/choplifter.png.js: $(addprefix roms/,choplifter.py choplift.zip)
	python $^ $@

dist/cotton.png.js: $(addprefix roms/,cotton.py cotton.zip)
	python $^ $@

dist/cotton_x68.png.js: $(addprefix roms/,x68000.py x68000.zip cotton_disk1.xdf cotton_disk2.xdf)
	python $^ $@

dist/crazy_balloon.png.js: $(addprefix roms/,crazy_balloon.py crbaloon.zip)
	python $^ $@

dist/crush_roller.png.js: $(addprefix roms/,crush_roller.py crush.zip)
	python $^ $@

dist/cue_brick.png.js: $(addprefix roms/,cue_brick.py cuebrick.zip)
	python $^ $@

dist/d_return_x68.png.js: $(addprefix roms/,x68000.py x68000.zip d_return_disk1.xdf d_return_disk2.xdf)
	python $^ $@

dist/daimakaimura_x68.png.js: $(addprefix roms/,x68000.py x68000.zip daimakaimura_disk1.xdf daimakaimura_disk2.xdf)
	python $^ $@

dist/darius.png.js: $(addprefix roms/,darius.py darius.zip)
	python $^ $@

dist/dash_yarou_x68.png.js: $(addprefix roms/,x68000.py x68000.zip dash_yarou_disk1.xdf dash_yarou_disk2.xdf)
	python $^ $@

dist/detana_twinbee_x68.png.js: $(addprefix roms/,x68000.py x68000.zip detana_twinbee_disk1.xdf detana_twinbee_disk2.xdf)
	python $^ $@

dist/digdug.png.js: $(addprefix roms/,digdug.py digdug.zip namco51.zip)
	python $^ $@

dist/digdug_ii.png.js: $(addprefix roms/,digdug_ii.py digdug2.zip)
	python $^ $@

dist/downtown_nekketsu_monogatari_x68.png.js: $(addprefix roms/,x68000.py x68000.zip downtown_nekketsu_monogatari_disk1.xdf downtown_nekketsu_monogatari_disk2.xdf)
	python $^ $@

dist/dragon_buster.png.js: $(addprefix roms/,dragon_buster.py drgnbstr.zip)
	python $^ $@

dist/dragon_spirit.png.js: $(addprefix roms/,dragon_spirit.py dspirit.zip)
	python $^ $@

dist/dragon_spirit_x68.png.js: $(addprefix roms/,x68000.py x68000.zip dragon_spirit_disk1.xdf dragon_spirit_disk2.xdf)
	python $^ $@

dist/elevator_action.png.js: $(addprefix roms/,elevator_action.py elevator.zip)
	python $^ $@

dist/fantasy_zone.png.js: $(addprefix roms/,fantasy_zone.py fantzone.zip)
	python $^ $@

dist/fantasy_zone_x68.png.js: $(addprefix roms/,x68000.py x68000.zip fantasy_zone.xdf)
	python $^ $@

dist/flicky.png.js: $(addprefix roms/,flicky.py flicky.zip)
	python $^ $@

dist/frogger.png.js: $(addprefix roms/,frogger.py frogger.zip)
	python $^ $@

dist/galaga.png.js: $(addprefix roms/,galaga.py galaga.zip namco51.zip namco54.zip)
	python $^ $@

dist/galaga_88.png.js: $(addprefix roms/,galaga_88.py galaga88.zip)
	python $^ $@

dist/galaga_88_x68.png.js: $(addprefix roms/,x68000.py x68000.zip galaga_88_disk1.xdf galaga_88_disk2.xdf)
	python $^ $@

dist/galaxian.png.js: $(addprefix roms/,galaxian.py galaxian.zip)
	python $^ $@

dist/galaxy_wars.png.js: $(addprefix roms/,galaxy_wars.py galxwars.zip)
	python $^ $@

dist/gaplus.png.js: $(addprefix roms/,gaplus.py gaplus.zip namco62.zip)
	python $^ $@

dist/gemini_wing_x68.png.js: $(addprefix roms/,x68000.py x68000.zip gemini_wing_disk1.xdf gemini_wing_disk2.xdf)
	python $^ $@

dist/genocide_x68.png.js: $(addprefix roms/,x68000.py x68000.zip genocide_disk1.xdf genocide_disk2.xdf genocide_disk3.xdf genocide_disk4.xdf)
	python $^ $@

dist/genocide2_x68.png.js: $(addprefix roms/,x68000.py x68000.zip genocide2_disk1.xdf genocide2_disk2.xdf genocide2_disk3.xdf genocide2_disk4.xdf)
	python $^ $@

dist/genpei_toumaden.png.js: $(addprefix roms/,genpei_toumaden.py genpeitd.zip)
	python $^ $@

dist/genpei_toumaden_x68.png.js: $(addprefix roms/,x68000.py x68000.zip genpei_toumaden.xdf)
	python $^ $@

dist/golden_axe.png.js: $(addprefix roms/,golden_axe.py goldnaxe.zip)
	python $^ $@

dist/gradius.png.js: $(addprefix roms/,gradius.py nemesis.zip)
	python $^ $@

dist/gradius_ii.png.js: $(addprefix roms/,gradius_ii.py vulcan.zip)
	python $^ $@

dist/gradius_iii.png.js: $(addprefix roms/,gradius_iii.py gradius3.zip)
	python $^ $@

dist/gradius_x68.png.js: $(addprefix roms/,x68000.py x68000.zip gradius.xdf)
	python $^ $@

dist/grobda.png.js: $(addprefix roms/,grobda.py grobda.zip)
	python $^ $@

dist/hishou_zame_x68.png.js: $(addprefix roms/,x68000.py x68000.zip hishou_zame.xdf)
	python $^ $@

dist/hopping_mappy.png.js: $(addprefix roms/,hopping_mappy.py hopmappy.zip)
	python $^ $@

dist/image_fight.png.js: $(addprefix roms/,image_fight.py imgfight.zip)
	python $^ $@

dist/image_fight_x68.png.js: $(addprefix roms/,x68000.py x68000.zip image_fight_disk1.xdf image_fight_disk2.xdf)
	python $^ $@

dist/jr_pac-man.png.js: $(addprefix roms/,jr_pac-man.py jrpacman.zip)
	python $^ $@

dist/jump_bug.png.js: $(addprefix roms/,jump_bug.py jumpbug.zip)
	python $^ $@

dist/king_and_balloon.png.js: $(addprefix roms/,king_and_balloon.py kingball.zip)
	python $^ $@

dist/konya_mo_asa_made_powerful_mahjong2_x68.png.js: $(addprefix roms/,x68000.py x68000.zip \
		konya_mo_asa_made_powerful_mahjong2_disk1.xdf konya_mo_asa_made_powerful_mahjong2_disk2.xdf \
		konya_mo_asa_made_powerful_mahjong2_disk3.xdf konya_mo_asa_made_powerful_mahjong2_disk4.xdf)
	python $^ $@

dist/korosuke_roller.png.js: $(addprefix roms/,korosuke_roller.py crush.zip)
	python $^ $@

dist/lagoon_x68.png.js: $(addprefix roms/,x68000.py x68000.zip lagoon_disk1.xdf lagoon_disk2.xdf lagoon_disk3.xdf lagoon_disk4.xdf)
	python $^ $@

dist/libble_rabble.png.js: $(addprefix roms/,libble_rabble.py liblrabl.zip)
	python $^ $@

dist/lunar_rescue.png.js: $(addprefix roms/,lunar_rescue.py lrescue.zip)
	python $^ $@

dist/mahjong_pon_chin_kan.png.js: $(addprefix roms/,mahjong_pon_chin_kan.py ponchin.zip)
	python $^ $@

dist/mahjong_yuugi.png.js: $(addprefix roms/,mahjong_yuugi.py mjyuugi.zip)
	python $^ $@

dist/makai-mura.png.js: $(addprefix roms/,makai-mura.py gng.zip)
	python $^ $@

dist/mappy.png.js: $(addprefix roms/,mappy.py mappy.zip)
	python $^ $@

dist/marble_madness_x68.png.js: $(addprefix roms/,x68000.py x68000.zip marble_madness.xdf)
	python $^ $@

dist/marchen_maze.png.js: $(addprefix roms/,marchen_maze.py mmaze.zip)
	python $^ $@

dist/marchen_maze_x68.png.js: $(addprefix roms/,x68000.py x68000.zip marchen_maze_disk1.xdf marchen_maze_disk2.xdf)
	python $^ $@

dist/master_of_weapon.png.js: $(addprefix roms/,master_of_weapon.py masterw.zip)
	python $^ $@

dist/metro-cross.png.js: $(addprefix roms/,metro-cross.py metrocrs.zip)
	python $^ $@

dist/moon_cresta.png.js: $(addprefix roms/,moon_cresta.py mooncrst.zip)
	python $^ $@

dist/motos.png.js: $(addprefix roms/,motos.py motos.zip)
	python $^ $@

dist/mr_heli_no_daibouken.png.js: $(addprefix roms/,mr_heli_no_daibouken.py bchopper.zip)
	python $^ $@

dist/namco_video_game_music_library_x68.png.js: $(addprefix roms/,x68000.py x68000.zip namco_video_game_music_library.xdf)
	python $^ $@

dist/new_rally-x.png.js: $(addprefix roms/,new_rally-x.py nrallyx.zip)
	python $^ $@

dist/ninja_princess.png.js: $(addprefix roms/,ninja_princess.py seganinj.zip)
	python $^ $@

dist/out_run.png.js: $(addprefix roms/,out_run.py outrun.zip)
	python $^ $@

dist/pac-land.png.js: $(addprefix roms/,pac-land.py pacland.zip)
	python $^ $@

dist/pac-man.png.js: $(addprefix roms/,pac-man.py puckman.zip)
	python $^ $@

dist/pac-mania.png.js: $(addprefix roms/,pac-mania.py pacmania.zip)
	python $^ $@

dist/pac-mania_x68.png.js: $(addprefix roms/,x68000.py x68000.zip pac-mania.xdf)
	python $^ $@

dist/pac_and_pal.png.js: $(addprefix roms/,pac_and_pal.py pacnpal.zip)
	python $^ $@

dist/parodius_da_x68.png.js: $(addprefix roms/,x68000.py x68000.zip parodius_da_disk1.xdf parodius_da_disk2.xdf)
	python $^ $@

dist/pengo.png.js: $(addprefix roms/,pengo.py pengo.zip)
	python $^ $@

dist/phalanx_x68.png.js: $(addprefix roms/,x68000.py x68000.zip phalanx_disk1.xdf phalanx_disk2.xdf phalanx_disk3.xdf)
	python $^ $@

dist/phozon.png.js: $(addprefix roms/,phozon.py phozon.zip)
	python $^ $@

dist/pinball_pinball_x68.png.js: $(addprefix roms/,x68000.py x68000.zip pinball_pinball.xdf)
	python $^ $@

dist/polaris.png.js: $(addprefix roms/,polaris.py polaris.zip)
	python $^ $@

dist/pole_position_ii.png.js: $(addprefix roms/,pole_position_ii.py polepos2.zip)
	python $^ $@

dist/populous_x68.png.js: $(addprefix roms/,x68000.py x68000.zip populous.xdf)
	python $^ $@

dist/power_league_x68.png.js: $(addprefix roms/,x68000.py x68000.zip power_league.xdf)
	python $^ $@

dist/prince_of_persia_x68.png.js: $(addprefix roms/,x68000.py x68000.zip prince_of_persia_disk1.xdf prince_of_persia_disk2.xdf prince_of_persia_disk3.xdf)
	python $^ $@

dist/professional_mahjong_gokuu_x68.png.js: $(addprefix roms/,x68000.py x68000.zip professional_mahjong_gokuu.xdf)
	python $^ $@

dist/puzznic_x68.png.js: $(addprefix roms/,x68000.py x68000.zip puzznic.xdf)
	python $^ $@

dist/quarth_x68.png.js: $(addprefix roms/,x68000.py x68000.zip quarth.xdf)
	python $^ $@

dist/r-type.png.js: $(addprefix roms/,r-type.py rtype.zip)
	python $^ $@

dist/r-type_ii.png.js: $(addprefix roms/,r-type_ii.py rtype2.zip)
	python $^ $@

dist/r-type_x68.png.js: $(addprefix roms/,x68000.py x68000.zip r-type.xdf)
	python $^ $@

dist/rally-x.png.js: $(addprefix roms/,rally-x.py rallyx.zip)
	python $^ $@

dist/rompers.png.js: $(addprefix roms/,rompers.py rompers.zip)
	python $^ $@

dist/royal_mahjong.png.js: $(addprefix roms/,royal_mahjong.py royalmj.zip)
	python $^ $@

dist/saigo_no_nindou.png.js: $(addprefix roms/,saigo_no_nindou.py nspirit.zip)
	python $^ $@

dist/salamander.png.js: $(addprefix roms/,salamander.py salamand.zip)
	python $^ $@

dist/scramble.png.js: $(addprefix roms/,scramble.py scramble.zip)
	python $^ $@

dist/sea_fighter_poseidon.png.js: $(addprefix roms/,sea_fighter_poseidon.py sfposeid.zip)
	python $^ $@

dist/senjou_no_ookami.png.js: $(addprefix roms/,senjou_no_ookami.py commando.zip)
	python $^ $@

dist/shanghai_x68.png.js: $(addprefix roms/,x68000.py x68000.zip shanghai.xdf)
	python $^ $@

dist/shuffle_puck_cafe_x68.png.js: $(addprefix roms/,x68000.py x68000.zip shuffle_puck_cafe_disk1.xdf shuffle_puck_cafe_disk2.xdf)
	python $^ $@

dist/sky_kid.png.js: $(addprefix roms/,sky_kid.py skykid.zip)
	python $^ $@

dist/sky_kid_deluxe.png.js: $(addprefix roms/,sky_kid_deluxe.py skykiddx.zip)
	python $^ $@

dist/souko_ban_deluxe.png.js: $(addprefix roms/,souko_ban_deluxe.py boxyboy.zip)
	python $^ $@

dist/souko_ban_perfect_x68.png.js: $(addprefix roms/,x68000.py x68000.zip souko_ban_perfect.xdf)
	python $^ $@

dist/space_chaser.png.js: $(addprefix roms/,space_chaser.py schaser.zip)
	python $^ $@

dist/space_harrier.png.js: $(addprefix roms/,space_harrier.py sharrier.zip)
	python $^ $@

dist/space_harrier_x68.png.js: $(addprefix roms/,x68000.py x68000.zip space_harrier.xdf)
	python $^ $@

dist/space_invaders.png.js: $(addprefix roms/,space_invaders.py invaders.zip)
	python $^ $@

dist/space_laser.png.js: $(addprefix roms/,space_laser.py spcewarl.zip)
	python $^ $@

dist/star_force.png.js: $(addprefix roms/,star_force.py starforc.zip)
	python $^ $@

dist/strategy_x.png.js: $(addprefix roms/,strategy_x.py stratgyx.zip)
	python $^ $@

dist/sukeban_jansi_ryuko.png.js: $(addprefix roms/,sukeban_jansi_ryuko.py sjryuko.zip)
	python $^ $@

dist/super_hang-on.png.js: $(addprefix roms/,super_hang-on.py shangon.zip)
	python $^ $@

dist/super_hang-on_x68.png.js: $(addprefix roms/,x68000.py x68000.zip super_hang-on_disk1.xdf super_hang-on_disk2.xdf)
	python $^ $@

dist/super_pac-man.png.js: $(addprefix roms/,super_pac-man.py superpac.zip)
	python $^ $@

dist/super_real_mahjong_part2.png.js: $(addprefix roms/,super_real_mahjong_part2.py srmp2.zip)
	python $^ $@

dist/super_real_mahjong_part3.png.js: $(addprefix roms/,super_real_mahjong_part3.py srmp3.zip)
	python $^ $@

dist/super_real_mahjong_pii_and_piii_x68.png.js: $(addprefix roms/,x68000.py x68000.zip \
		super_real_mahjong_pii_and_piii_disk1.xdf super_real_mahjong_pii_and_piii_disk2.xdf \
		super_real_mahjong_pii_and_piii_disk3.xdf super_real_mahjong_pii_and_piii_disk4.xdf \
		super_real_mahjong_pii_and_piii_disk5.xdf super_real_mahjong_pii_and_piii_disk6.xdf)
	python $^ $@

dist/super_xevious.png.js: $(addprefix roms/,super_xevious.py xevious.zip namco50.zip namco51.zip namco54.zip)
	python $^ $@

dist/syvalion_x68.png.js: $(addprefix roms/,x68000.py x68000.zip syvalion_disk1.xdf syvalion_disk2.xdf)
	python $^ $@

dist/t.t_mahjong.png.js: $(addprefix roms/,t.t_mahjong.py jongpute.zip)
	python $^ $@

dist/tank_battalion.png.js: $(addprefix roms/,tank_battalion.py tankbatt.zip)
	python $^ $@

dist/tank_force.png.js: $(addprefix roms/,tank_force.py tankfrce.zip)
	python $^ $@

dist/tetris.png.js: $(addprefix roms/,tetris.py tetris.zip)
	python $^ $@

dist/the_fairyland_story_x68.png.js: $(addprefix roms/,x68000.py x68000.zip the_fairyland_story_disk1.xdf the_fairyland_story_disk2.xdf)
	python $^ $@

dist/the_newzealand_story.png.js: $(addprefix roms/,the_newzealand_story.py tnzs.zip)
	python $^ $@

dist/the_newzealand_story_x68.png.js: $(addprefix roms/,x68000.py x68000.zip the_newzealand_story_disk1.xdf the_newzealand_story_disk2.xdf)
	python $^ $@

dist/the_return_of_ishtar.png.js: $(addprefix roms/,the_return_of_ishtar.py roishtar.zip)
	python $^ $@

dist/the_return_of_ishtar_x68.png.js: $(addprefix roms/,x68000.py x68000.zip the_return_of_ishtar.xdf)
	python $^ $@

dist/the_tower_of_druaga.png.js: $(addprefix roms/,the_tower_of_druaga.py todruaga.zip)
	python $^ $@

dist/thunder_force_ii_x68.png.js: $(addprefix roms/,x68000.py x68000.zip thunder_force_ii_disk1.xdf thunder_force_ii_disk2.xdf)
	python $^ $@

dist/time_pilot.png.js: $(addprefix roms/,time_pilot.py timeplt.zip)
	python $^ $@

dist/time_pilot_84.png.js: $(addprefix roms/,time_pilot_84.py tp84.zip)
	python $^ $@

dist/time_tunnel.png.js: $(addprefix roms/,time_tunnel.py timetunl.zip)
	python $^ $@

dist/toki_no_senshi.png.js: $(addprefix roms/,toki_no_senshi.py tokisens.zip)
	python $^ $@

dist/toypop.png.js: $(addprefix roms/,toypop.py toypop.zip)
	python $^ $@

dist/turbo_out_run.png.js: $(addprefix roms/,turbo_out_run.py toutrun.zip)
	python $^ $@

dist/twinbee.png.js: $(addprefix roms/,twinbee.py twinbee.zip)
	python $^ $@

dist/twinbee_x68.png.js: $(addprefix roms/,x68000.py x68000.zip twinbee.xdf)
	python $^ $@

dist/ufo_senshi_yohko_chan.png.js: $(addprefix roms/,ufo_senshi_yohko_chan.py ufosensi.zip)
	python $^ $@

dist/vball_x68.png.js: $(addprefix roms/,x68000.py x68000.zip vball.xdf)
	python $^ $@

dist/vulgus.png.js: $(addprefix roms/,vulgus.py vulgus.zip)
	python $^ $@

dist/warp_and_warp.png.js: $(addprefix roms/,warp_and_warp.py warpwarp.zip)
	python $^ $@

dist/wings_x68.png.js: $(addprefix roms/,x68000.py x68000.zip wings.xdf)
	python $^ $@

dist/wonder_boy.png.js: $(addprefix roms/,wonder_boy.py wboy.zip)
	python $^ $@

dist/wonder_boy_iii.png.js: $(addprefix roms/,wonder_boy_iii.py wb3.zip)
	python $^ $@

dist/wonder_boy_in_monster_land.png.js: $(addprefix roms/,wonder_boy_in_monster_land.py wbml.zip)
	python $^ $@

dist/wonder_momo.png.js: $(addprefix roms/,wonder_momo.py wndrmomo.zip)
	python $^ $@

dist/world_court.png.js: $(addprefix roms/,world_court.py wldcourt.zip)
	python $^ $@

dist/world_court_x68.png.js: $(addprefix roms/,x68000.py x68000.zip world_court_disk1.xdf world_court_disk2.xdf)
	python $^ $@

dist/world_stadium_x68.png.js: $(addprefix roms/,x68000.py x68000.zip world_stadium_disk1.xdf world_stadium_disk2.xdf)
	python $^ $@

dist/x_multiply.png.js: $(addprefix roms/,x_multiply.py xmultipl.zip)
	python $^ $@

dist/xevious.png.js: $(addprefix roms/,xevious.py xevious.zip namco50.zip namco51.zip namco54.zip)
	python $^ $@

dist/xexex.png.js: $(addprefix roms/,xexex.py xexex.zip)
	python $^ $@

dist/yokai_douchuuki.png.js: $(addprefix roms/,yokai_douchuuki.py shadowld.zip)
	python $^ $@

dist/zigzag.png.js: $(addprefix roms/,zigzag.py zigzagb.zip)
	python $^ $@

