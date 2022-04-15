targets = \
	1942_rom.js after_burner_ii_rom.js after_burner_ii_x68_rom.js arkanoid_revenge_of_doh_x68_rom.js \
	balloon_bomber_rom.js baraduke_rom.js battle_chess_x68_rom.js beraboh_man_rom.js blast_off_rom.js \
	bomber_man_x68_rom.js bonanza_bros_x68_rom.js bosconian_rom.js bosconian_x68_rom.js bubble_bobble_x68_rom.js \
	cameltry_x68_rom.js chackn_pop_rom.js choplifter_rom.js cotton_rom.js cotton_x68_rom.js crazy_balloon_rom.js \
	crush_roller_rom.js cue_brick_rom.js d_return_x68_rom.js daimakaimura_x68_rom.js darius_rom.js dash_yarou_x68_rom.js \
	detana_twinbee_x68_rom.js digdug_rom.js digdug_ii_rom.js downtown_nekketsu_monogatari_x68_rom.js \
	dragon_buster_rom.js dragon_spirit_rom.js dragon_spirit_x68_rom.js elevator_action_rom.js fantasy_zone_rom.js \
	fantasy_zone_x68_rom.js flicky_rom.js frogger_rom.js galaga_rom.js galaga_88_rom.js galaga_88_x68_rom.js \
	galaxian_rom.js galaxy_wars_rom.js gaplus_rom.js gemini_wing_x68_rom.js genocide_x68_rom.js genocide2_x68_rom.js \
	genpei_toumaden_rom.js genpei_toumaden_x68_rom.js golden_axe_rom.js gradius_rom.js gradius_ii_rom.js \
	gradius_iii_rom.js gradius_x68_rom.js grobda_rom.js hishou_zame_x68_rom.js hopping_mappy_rom.js image_fight_rom.js \
	image_fight_x68_rom.js jr_pac-man_rom.js jump_bug_rom.js king_and_balloon_rom.js korosuke_roller_rom.js \
	lagoon_x68_rom.js libble_rabble_rom.js lunar_rescue_rom.js mahjong_pon_chin_kan_rom.js mahjong_yuugi_rom.js \
	makai-mura_rom.js mappy_rom.js marble_madness_x68_rom.js marchen_maze_rom.js marchen_maze_x68_rom.js \
	master_of_weapon_rom.js metro-cross_rom.js moon_cresta_rom.js motos_rom.js mr_heli_no_daibouken_rom.js \
	namco_video_game_music_library_x68_rom.js new_rally-x_rom.js ninja_princess_rom.js out_run_rom.js pac-land_rom.js \
	pac-man_rom.js pac-mania_rom.js pac-mania_x68_rom.js pac_and_pal_rom.js parodius_da_x68_rom.js pengo_rom.js \
	phalanx_x68_rom.js phozon_rom.js pinball_pinball_x68_rom.js polaris_rom.js pole_position_ii_rom.js \
	populous_x68_rom.js power_league_x68_rom.js prince_of_persia_x68_rom.js professional_mahjong_gokuu_x68_rom.js \
	puzznic_x68_rom.js quarth_x68_rom.js r-type_rom.js r-type_ii_rom.js r-type_x68_rom.js rally-x_rom.js rompers_rom.js \
	royal_mahjong_rom.js saigo_no_nindou_rom.js salamander_rom.js scramble_rom.js sea_fighter_poseidon_rom.js \
	senjou_no_ookami_rom.js shanghai_x68_rom.js shuffle_puck_cafe_x68_rom.js sky_kid_rom.js sky_kid_deluxe_rom.js \
	souko_ban_deluxe_rom.js souko_ban_perfect_x68_rom.js space_chaser_rom.js space_harrier_rom.js \
	space_harrier_x68_rom.js space_invaders_rom.js space_laser_rom.js star_force_rom.js strategy_x_rom.js \
	sukeban_jansi_ryuko_rom.js super_hang-on_rom.js super_hang-on_x68_rom.js super_pac-man_rom.js \
	super_real_mahjong_part2_rom.js super_real_mahjong_part3_rom.js super_real_mahjong_pii_and_piii_x68_rom.js \
	super_xevious_rom.js syvalion_x68_rom.js t.t_mahjong_rom.js tank_battalion_rom.js tank_force_rom.js tetris_rom.js \
	the_fairyland_story_x68_rom.js the_newzealand_story_rom.js the_newzealand_story_x68_rom.js \
	the_return_of_ishtar_rom.js the_return_of_ishtar_x68_rom.js the_tower_of_druaga_rom.js thunder_force_ii_x68_rom.js \
	time_pilot_rom.js time_pilot_84_rom.js time_tunnel_rom.js toki_no_senshi_rom.js toypop_rom.js turbo_out_run_rom.js \
	twinbee_rom.js twinbee_x68_rom.js ufo_senshi_yohko_chan_rom.js vball_x68_rom.js vulgus_rom.js warp_and_warp_rom.js \
	wings_x68_rom.js wonder_boy_rom.js wonder_boy_iii_rom.js wonder_boy_in_monster_land_rom.js wonder_momo_rom.js \
	world_court_rom.js world_court_x68_rom.js world_stadium_x68_rom.js x_multiply_rom.js xevious_rom.js xexex_rom.js \
	yokai_douchuuki_rom.js zigzag_rom.js

.PHONY: all
all: dist $(addprefix dist/,$(targets))

.PHONY: clean
clean:
	del dist\*_rom.js

dist:
	mkdir dist

dist/1942_rom.js: $(addprefix roms/,1942.zip)
	powershell -ExecutionPolicy RemoteSigned -File 1942.ps1 $^ $@

dist/after_burner_ii_rom.js: $(addprefix roms/,aburner2.zip)
	powershell -ExecutionPolicy RemoteSigned -File after_burner_ii.ps1 $^ $@

dist/after_burner_ii_x68_rom.js: $(addprefix roms/,x68000.zip after_burner_ii_disk1.xdf after_burner_ii_disk2.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/arkanoid_revenge_of_doh_x68_rom.js: $(addprefix roms/,x68000.zip arkanoid_revenge_of_doh.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/balloon_bomber_rom.js: $(addprefix roms/,ballbomb.zip)
	powershell -ExecutionPolicy RemoteSigned -File balloon_bomber.ps1 $^ $@

dist/baraduke_rom.js: $(addprefix roms/,aliensec.zip)
	powershell -ExecutionPolicy RemoteSigned -File baraduke.ps1 $^ $@

dist/battle_chess_x68_rom.js: $(addprefix roms/,x68000.zip battle_chess_disk1.xdf battle_chess_disk2.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/beraboh_man_rom.js: $(addprefix roms/,berabohm.zip)
	powershell -ExecutionPolicy RemoteSigned -File beraboh_man.ps1 $^ $@

dist/blast_off_rom.js: $(addprefix roms/,blastoff.zip)
	powershell -ExecutionPolicy RemoteSigned -File blast_off.ps1 $^ $@

dist/bomber_man_x68_rom.js: $(addprefix roms/,x68000.zip bomber_man.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/bonanza_bros_x68_rom.js: $(addprefix roms/,x68000.zip bonanza_bros_disk1.xdf bonanza_bros_disk2.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/bosconian_rom.js: $(addprefix roms/,bosco.zip namco50.zip namco51.zip namco54.zip)
	powershell -ExecutionPolicy RemoteSigned -File bosconian.ps1 $^ $@

dist/bosconian_x68_rom.js: $(addprefix roms/,x68000.zip bosconian.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/bubble_bobble_x68_rom.js: $(addprefix roms/,x68000.zip bubble_bobble.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/cameltry_x68_rom.js: $(addprefix roms/,x68000.zip cameltry.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/chackn_pop_rom.js: $(addprefix roms/,chaknpop.zip)
	powershell -ExecutionPolicy RemoteSigned -File chackn_pop.ps1 $^ $@

dist/choplifter_rom.js: $(addprefix roms/,choplift.zip)
	powershell -ExecutionPolicy RemoteSigned -File choplifter.ps1 $^ $@

dist/cotton_rom.js: $(addprefix roms/,cotton.zip)
	powershell -ExecutionPolicy RemoteSigned -File cotton.ps1 $^ $@

dist/cotton_x68_rom.js: $(addprefix roms/,x68000.zip cotton_disk1.xdf cotton_disk2.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/crazy_balloon_rom.js: $(addprefix roms/,crbaloon.zip)
	powershell -ExecutionPolicy RemoteSigned -File crazy_balloon.ps1 $^ $@

dist/crush_roller_rom.js: $(addprefix roms/,crush.zip)
	powershell -ExecutionPolicy RemoteSigned -File crush_roller.ps1 $^ $@

dist/cue_brick_rom.js: $(addprefix roms/,cuebrick.zip)
	powershell -ExecutionPolicy RemoteSigned -File cue_brick.ps1 $^ $@

dist/d_return_x68_rom.js: $(addprefix roms/,x68000.zip d_return_disk1.xdf d_return_disk2.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/daimakaimura_x68_rom.js: $(addprefix roms/,x68000.zip daimakaimura_disk1.xdf daimakaimura_disk2.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/darius_rom.js: $(addprefix roms/,darius.zip)
	powershell -ExecutionPolicy RemoteSigned -File darius.ps1 $^ $@

dist/dash_yarou_x68_rom.js: $(addprefix roms/,x68000.zip dash_yarou_disk1.xdf dash_yarou_disk2.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/detana_twinbee_x68_rom.js: $(addprefix roms/,x68000.zip detana_twinbee_disk1.xdf detana_twinbee_disk2.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/digdug_rom.js: $(addprefix roms/,digdug.zip namco51.zip)
	powershell -ExecutionPolicy RemoteSigned -File digdug.ps1 $^ $@

dist/digdug_ii_rom.js: $(addprefix roms/,digdug2.zip)
	powershell -ExecutionPolicy RemoteSigned -File digdug_ii.ps1 $^ $@

dist/downtown_nekketsu_monogatari_x68_rom.js: $(addprefix roms/,x68000.zip downtown_nekketsu_monogatari_disk1.xdf downtown_nekketsu_monogatari_disk2.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/dragon_buster_rom.js: $(addprefix roms/,drgnbstr.zip)
	powershell -ExecutionPolicy RemoteSigned -File dragon_buster.ps1 $^ $@

dist/dragon_spirit_rom.js: $(addprefix roms/,dspirit.zip)
	powershell -ExecutionPolicy RemoteSigned -File dragon_spirit.ps1 $^ $@

dist/dragon_spirit_x68_rom.js: $(addprefix roms/,x68000.zip dragon_spirit_disk1.xdf dragon_spirit_disk2.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/elevator_action_rom.js: $(addprefix roms/,elevator.zip)
	powershell -ExecutionPolicy RemoteSigned -File elevator_action.ps1 $^ $@

dist/fantasy_zone_rom.js: $(addprefix roms/,fantzone.zip)
	powershell -ExecutionPolicy RemoteSigned -File fantasy_zone.ps1 $^ $@

dist/fantasy_zone_x68_rom.js: $(addprefix roms/,x68000.zip fantasy_zone.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/flicky_rom.js: $(addprefix roms/,flicky.zip)
	powershell -ExecutionPolicy RemoteSigned -File flicky.ps1 $^ $@

dist/frogger_rom.js: $(addprefix roms/,frogger.zip)
	powershell -ExecutionPolicy RemoteSigned -File frogger.ps1 $^ $@

dist/galaga_rom.js: $(addprefix roms/,galaga.zip namco51.zip namco54.zip)
	powershell -ExecutionPolicy RemoteSigned -File galaga.ps1 $^ $@

dist/galaga_88_rom.js: $(addprefix roms/,galaga88.zip)
	powershell -ExecutionPolicy RemoteSigned -File galaga_88.ps1 $^ $@

dist/galaga_88_x68_rom.js: $(addprefix roms/,x68000.zip galaga_88_disk1.xdf galaga_88_disk2.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/galaxian_rom.js: $(addprefix roms/,galaxian.zip)
	powershell -ExecutionPolicy RemoteSigned -File galaxian.ps1 $^ $@

dist/galaxy_wars_rom.js: $(addprefix roms/,galxwars.zip)
	powershell -ExecutionPolicy RemoteSigned -File galaxy_wars.ps1 $^ $@

dist/gaplus_rom.js: $(addprefix roms/,gaplus.zip namco62.zip)
	powershell -ExecutionPolicy RemoteSigned -File gaplus.ps1 $^ $@

dist/gemini_wing_x68_rom.js: $(addprefix roms/,x68000.zip gemini_wing_disk1.xdf gemini_wing_disk2.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/genocide_x68_rom.js: $(addprefix roms/,x68000.zip genocide_disk1.xdf genocide_disk2.xdf genocide_disk3.xdf genocide_disk4.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/genocide2_x68_rom.js: $(addprefix roms/,x68000.zip genocide2_disk1.xdf genocide2_disk2.xdf genocide2_disk3.xdf genocide2_disk4.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/genpei_toumaden_rom.js: $(addprefix roms/,genpeitd.zip)
	powershell -ExecutionPolicy RemoteSigned -File genpei_toumaden.ps1 $^ $@

dist/genpei_toumaden_x68_rom.js: $(addprefix roms/,x68000.zip genpei_toumaden.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/golden_axe_rom.js: $(addprefix roms/,goldnaxe.zip)
	powershell -ExecutionPolicy RemoteSigned -File golden_axe.ps1 $^ $@

dist/gradius_rom.js: $(addprefix roms/,nemesis.zip)
	powershell -ExecutionPolicy RemoteSigned -File gradius.ps1 $^ $@

dist/gradius_ii_rom.js: $(addprefix roms/,vulcan.zip)
	powershell -ExecutionPolicy RemoteSigned -File gradius_ii.ps1 $^ $@

dist/gradius_iii_rom.js: $(addprefix roms/,gradius3.zip)
	powershell -ExecutionPolicy RemoteSigned -File gradius_iii.ps1 $^ $@

dist/gradius_x68_rom.js: $(addprefix roms/,x68000.zip gradius.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/grobda_rom.js: $(addprefix roms/,grobda.zip)
	powershell -ExecutionPolicy RemoteSigned -File grobda.ps1 $^ $@

dist/hishou_zame_x68_rom.js: $(addprefix roms/,x68000.zip hishou_zame.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/hopping_mappy_rom.js: $(addprefix roms/,hopmappy.zip)
	powershell -ExecutionPolicy RemoteSigned -File hopping_mappy.ps1 $^ $@

dist/image_fight_rom.js: $(addprefix roms/,imgfight.zip)
	powershell -ExecutionPolicy RemoteSigned -File image_fight.ps1 $^ $@

dist/image_fight_x68_rom.js: $(addprefix roms/,x68000.zip image_fight_disk1.xdf image_fight_disk2.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/jr_pac-man_rom.js: $(addprefix roms/,jrpacman.zip)
	powershell -ExecutionPolicy RemoteSigned -File jr_pac-man.ps1 $^ $@

dist/jump_bug_rom.js: $(addprefix roms/,jumpbug.zip)
	powershell -ExecutionPolicy RemoteSigned -File jump_bug.ps1 $^ $@

dist/king_and_balloon_rom.js: $(addprefix roms/,kingball.zip)
	powershell -ExecutionPolicy RemoteSigned -File king_and_balloon.ps1 $^ $@

dist/korosuke_roller_rom.js: $(addprefix roms/,crush.zip)
	powershell -ExecutionPolicy RemoteSigned -File korosuke_roller.ps1 $^ $@

dist/lagoon_x68_rom.js: $(addprefix roms/,x68000.zip lagoon_disk1.xdf lagoon_disk2.xdf lagoon_disk3.xdf lagoon_disk4.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/libble_rabble_rom.js: $(addprefix roms/,liblrabl.zip)
	powershell -ExecutionPolicy RemoteSigned -File libble_rabble.ps1 $^ $@

dist/lunar_rescue_rom.js: $(addprefix roms/,lrescue.zip)
	powershell -ExecutionPolicy RemoteSigned -File lunar_rescue.ps1 $^ $@

dist/mahjong_pon_chin_kan_rom.js: $(addprefix roms/,ponchin.zip)
	powershell -ExecutionPolicy RemoteSigned -File mahjong_pon_chin_kan.ps1 $^ $@

dist/mahjong_yuugi_rom.js: $(addprefix roms/,mjyuugi.zip)
	powershell -ExecutionPolicy RemoteSigned -File mahjong_yuugi.ps1 $^ $@

dist/makai-mura_rom.js: $(addprefix roms/,gng.zip)
	powershell -ExecutionPolicy RemoteSigned -File makai-mura.ps1 $^ $@

dist/mappy_rom.js: $(addprefix roms/,mappy.zip)
	powershell -ExecutionPolicy RemoteSigned -File mappy.ps1 $^ $@

dist/marble_madness_x68_rom.js: $(addprefix roms/,x68000.zip marble_madness.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/marchen_maze_rom.js: $(addprefix roms/,mmaze.zip)
	powershell -ExecutionPolicy RemoteSigned -File marchen_maze.ps1 $^ $@

dist/marchen_maze_x68_rom.js: $(addprefix roms/,x68000.zip marchen_maze_disk1.xdf marchen_maze_disk2.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/master_of_weapon_rom.js: $(addprefix roms/,masterw.zip)
	powershell -ExecutionPolicy RemoteSigned -File master_of_weapon.ps1 $^ $@

dist/metro-cross_rom.js: $(addprefix roms/,metrocrs.zip)
	powershell -ExecutionPolicy RemoteSigned -File metro-cross.ps1 $^ $@

dist/moon_cresta_rom.js: $(addprefix roms/,mooncrst.zip)
	powershell -ExecutionPolicy RemoteSigned -File moon_cresta.ps1 $^ $@

dist/motos_rom.js: $(addprefix roms/,motos.zip)
	powershell -ExecutionPolicy RemoteSigned -File motos.ps1 $^ $@

dist/mr_heli_no_daibouken_rom.js: $(addprefix roms/,bchopper.zip)
	powershell -ExecutionPolicy RemoteSigned -File mr_heli_no_daibouken.ps1 $^ $@

dist/namco_video_game_music_library_x68_rom.js: $(addprefix roms/,x68000.zip namco_video_game_music_library.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/new_rally-x_rom.js: $(addprefix roms/,nrallyx.zip)
	powershell -ExecutionPolicy RemoteSigned -File new_rally-x.ps1 $^ $@

dist/ninja_princess_rom.js: $(addprefix roms/,seganinj.zip)
	powershell -ExecutionPolicy RemoteSigned -File ninja_princess.ps1 $^ $@

dist/out_run_rom.js: $(addprefix roms/,outrun.zip)
	powershell -ExecutionPolicy RemoteSigned -File out_run.ps1 $^ $@

dist/pac-land_rom.js: $(addprefix roms/,pacland.zip)
	powershell -ExecutionPolicy RemoteSigned -File pac-land.ps1 $^ $@

dist/pac-man_rom.js: $(addprefix roms/,puckman.zip)
	powershell -ExecutionPolicy RemoteSigned -File pac-man.ps1 $^ $@

dist/pac-mania_rom.js: $(addprefix roms/,pacmania.zip)
	powershell -ExecutionPolicy RemoteSigned -File pac-mania.ps1 $^ $@

dist/pac-mania_x68_rom.js: $(addprefix roms/,x68000.zip pac-mania.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/pac_and_pal_rom.js: $(addprefix roms/,pacnpal.zip)
	powershell -ExecutionPolicy RemoteSigned -File pac_and_pal.ps1 $^ $@

dist/parodius_da_x68_rom.js: $(addprefix roms/,x68000.zip parodius_da_disk1.xdf parodius_da_disk2.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/pengo_rom.js: $(addprefix roms/,pengo.zip)
	powershell -ExecutionPolicy RemoteSigned -File pengo.ps1 $^ $@

dist/phalanx_x68_rom.js: $(addprefix roms/,x68000.zip phalanx_disk1.xdf phalanx_disk2.xdf phalanx_disk3.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/phozon_rom.js: $(addprefix roms/,phozon.zip)
	powershell -ExecutionPolicy RemoteSigned -File phozon.ps1 $^ $@

dist/pinball_pinball_x68_rom.js: $(addprefix roms/,x68000.zip pinball_pinball.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/polaris_rom.js: $(addprefix roms/,polaris.zip)
	powershell -ExecutionPolicy RemoteSigned -File polaris.ps1 $^ $@

dist/pole_position_ii_rom.js: $(addprefix roms/,polepos2.zip)
	powershell -ExecutionPolicy RemoteSigned -File pole_position_ii.ps1 $^ $@

dist/populous_x68_rom.js: $(addprefix roms/,x68000.zip populous.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/power_league_x68_rom.js: $(addprefix roms/,x68000.zip power_league.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/prince_of_persia_x68_rom.js: $(addprefix roms/,x68000.zip prince_of_persia_disk1.xdf prince_of_persia_disk2.xdf prince_of_persia_disk3.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/professional_mahjong_gokuu_x68_rom.js: $(addprefix roms/,x68000.zip professional_mahjong_gokuu.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/puzznic_x68_rom.js: $(addprefix roms/,x68000.zip puzznic.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/quarth_x68_rom.js: $(addprefix roms/,x68000.zip quarth.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/r-type_rom.js: $(addprefix roms/,rtype.zip)
	powershell -ExecutionPolicy RemoteSigned -File r-type.ps1 $^ $@

dist/r-type_ii_rom.js: $(addprefix roms/,rtype2.zip)
	powershell -ExecutionPolicy RemoteSigned -File r-type_ii.ps1 $^ $@

dist/r-type_x68_rom.js: $(addprefix roms/,x68000.zip r-type.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/rally-x_rom.js: $(addprefix roms/,rallyx.zip)
	powershell -ExecutionPolicy RemoteSigned -File rally-x.ps1 $^ $@

dist/rompers_rom.js: $(addprefix roms/,rompers.zip)
	powershell -ExecutionPolicy RemoteSigned -File rompers.ps1 $^ $@

dist/royal_mahjong_rom.js: $(addprefix roms/,royalmj.zip)
	powershell -ExecutionPolicy RemoteSigned -File royal_mahjong.ps1 $^ $@

dist/saigo_no_nindou_rom.js: $(addprefix roms/,nspirit.zip)
	powershell -ExecutionPolicy RemoteSigned -File saigo_no_nindou.ps1 $^ $@

dist/salamander_rom.js: $(addprefix roms/,salamand.zip)
	powershell -ExecutionPolicy RemoteSigned -File salamander.ps1 $^ $@

dist/scramble_rom.js: $(addprefix roms/,scramble.zip)
	powershell -ExecutionPolicy RemoteSigned -File scramble.ps1 $^ $@

dist/sea_fighter_poseidon_rom.js: $(addprefix roms/,sfposeid.zip)
	powershell -ExecutionPolicy RemoteSigned -File sea_fighter_poseidon.ps1 $^ $@

dist/senjou_no_ookami_rom.js: $(addprefix roms/,commando.zip)
	powershell -ExecutionPolicy RemoteSigned -File senjou_no_ookami.ps1 $^ $@

dist/shanghai_x68_rom.js: $(addprefix roms/,x68000.zip shanghai.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/shuffle_puck_cafe_x68_rom.js: $(addprefix roms/,x68000.zip shuffle_puck_cafe_disk1.xdf shuffle_puck_cafe_disk2.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/sky_kid_rom.js: $(addprefix roms/,skykid.zip)
	powershell -ExecutionPolicy RemoteSigned -File sky_kid.ps1 $^ $@

dist/sky_kid_deluxe_rom.js: $(addprefix roms/,skykiddx.zip)
	powershell -ExecutionPolicy RemoteSigned -File sky_kid_deluxe.ps1 $^ $@

dist/souko_ban_deluxe_rom.js: $(addprefix roms/,boxyboy.zip)
	powershell -ExecutionPolicy RemoteSigned -File souko_ban_deluxe.ps1 $^ $@

dist/souko_ban_perfect_x68_rom.js: $(addprefix roms/,x68000.zip souko_ban_perfect.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/space_chaser_rom.js: $(addprefix roms/,schaser.zip)
	powershell -ExecutionPolicy RemoteSigned -File space_chaser.ps1 $^ $@

dist/space_harrier_rom.js: $(addprefix roms/,sharrier.zip)
	powershell -ExecutionPolicy RemoteSigned -File space_harrier.ps1 $^ $@

dist/space_harrier_x68_rom.js: $(addprefix roms/,x68000.zip space_harrier.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/space_invaders_rom.js: $(addprefix roms/,invaders.zip)
	powershell -ExecutionPolicy RemoteSigned -File space_invaders.ps1 $^ $@

dist/space_laser_rom.js: $(addprefix roms/,spcewarl.zip)
	powershell -ExecutionPolicy RemoteSigned -File space_laser.ps1 $^ $@

dist/star_force_rom.js: $(addprefix roms/,starforc.zip)
	powershell -ExecutionPolicy RemoteSigned -File star_force.ps1 $^ $@

dist/strategy_x_rom.js: $(addprefix roms/,stratgyx.zip)
	powershell -ExecutionPolicy RemoteSigned -File strategy_x.ps1 $^ $@

dist/sukeban_jansi_ryuko_rom.js: $(addprefix roms/,sjryuko.zip)
	powershell -ExecutionPolicy RemoteSigned -File sukeban_jansi_ryuko.ps1 $^ $@

dist/super_hang-on_rom.js: $(addprefix roms/,shangon.zip)
	powershell -ExecutionPolicy RemoteSigned -File super_hang-on.ps1 $^ $@

dist/super_hang-on_x68_rom.js: $(addprefix roms/,x68000.zip super_hang-on_disk1.xdf super_hang-on_disk2.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/super_pac-man_rom.js: $(addprefix roms/,superpac.zip)
	powershell -ExecutionPolicy RemoteSigned -File super_pac-man.ps1 $^ $@

dist/super_real_mahjong_part2_rom.js: $(addprefix roms/,srmp2.zip)
	powershell -ExecutionPolicy RemoteSigned -File super_real_mahjong_part2.ps1 $^ $@

dist/super_real_mahjong_part3_rom.js: $(addprefix roms/,srmp3.zip)
	powershell -ExecutionPolicy RemoteSigned -File super_real_mahjong_part3.ps1 $^ $@

dist/super_real_mahjong_pii_and_piii_x68_rom.js: $(addprefix roms/,x68000.zip \
		super_real_mahjong_pii_and_piii_disk1.xdf super_real_mahjong_pii_and_piii_disk2.xdf \
		super_real_mahjong_pii_and_piii_disk3.xdf super_real_mahjong_pii_and_piii_disk4.xdf \
		super_real_mahjong_pii_and_piii_disk5.xdf super_real_mahjong_pii_and_piii_disk6.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/super_xevious_rom.js: $(addprefix roms/,xevious.zip namco50.zip namco51.zip namco54.zip)
	powershell -ExecutionPolicy RemoteSigned -File super_xevious.ps1 $^ $@

dist/syvalion_x68_rom.js: $(addprefix roms/,x68000.zip syvalion_disk1.xdf syvalion_disk2.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/t.t_mahjong_rom.js: $(addprefix roms/,jongpute.zip)
	powershell -ExecutionPolicy RemoteSigned -File t.t_mahjong.ps1 $^ $@

dist/tank_battalion_rom.js: $(addprefix roms/,tankbatt.zip)
	powershell -ExecutionPolicy RemoteSigned -File tank_battalion.ps1 $^ $@

dist/tank_force_rom.js: $(addprefix roms/,tankfrce.zip)
	powershell -ExecutionPolicy RemoteSigned -File tank_force.ps1 $^ $@

dist/tetris_rom.js: $(addprefix roms/,tetris.zip)
	powershell -ExecutionPolicy RemoteSigned -File tetris.ps1 $^ $@

dist/the_fairyland_story_x68_rom.js: $(addprefix roms/,x68000.zip the_fairyland_story_disk1.xdf the_fairyland_story_disk2.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/the_newzealand_story_rom.js: $(addprefix roms/,tnzs.zip)
	powershell -ExecutionPolicy RemoteSigned -File the_newzealand_story.ps1 $^ $@

dist/the_newzealand_story_x68_rom.js: $(addprefix roms/,x68000.zip the_newzealand_story_disk1.xdf the_newzealand_story_disk2.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/the_return_of_ishtar_rom.js: $(addprefix roms/,roishtar.zip)
	powershell -ExecutionPolicy RemoteSigned -File the_return_of_ishtar.ps1 $^ $@

dist/the_return_of_ishtar_x68_rom.js: $(addprefix roms/,x68000.zip the_return_of_ishtar.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/the_tower_of_druaga_rom.js: $(addprefix roms/,todruaga.zip)
	powershell -ExecutionPolicy RemoteSigned -File the_tower_of_druaga.ps1 $^ $@

dist/thunder_force_ii_x68_rom.js: $(addprefix roms/,x68000.zip thunder_force_ii_disk1.xdf thunder_force_ii_disk2.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/time_pilot_rom.js: $(addprefix roms/,timeplt.zip)
	powershell -ExecutionPolicy RemoteSigned -File time_pilot.ps1 $^ $@

dist/time_pilot_84_rom.js: $(addprefix roms/,tp84.zip)
	powershell -ExecutionPolicy RemoteSigned -File time_pilot_84.ps1 $^ $@

dist/time_tunnel_rom.js: $(addprefix roms/,timetunl.zip)
	powershell -ExecutionPolicy RemoteSigned -File time_tunnel.ps1 $^ $@

dist/toki_no_senshi_rom.js: $(addprefix roms/,tokisens.zip)
	powershell -ExecutionPolicy RemoteSigned -File toki_no_senshi.ps1 $^ $@

dist/toypop_rom.js: $(addprefix roms/,toypop.zip)
	powershell -ExecutionPolicy RemoteSigned -File toypop.ps1 $^ $@

dist/turbo_out_run_rom.js: $(addprefix roms/,toutrun.zip)
	powershell -ExecutionPolicy RemoteSigned -File turbo_out_run.ps1 $^ $@

dist/twinbee_rom.js: $(addprefix roms/,twinbee.zip)
	powershell -ExecutionPolicy RemoteSigned -File twinbee.ps1 $^ $@

dist/twinbee_x68_rom.js: $(addprefix roms/,x68000.zip twinbee.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/ufo_senshi_yohko_chan_rom.js: $(addprefix roms/,ufosensi.zip)
	powershell -ExecutionPolicy RemoteSigned -File ufo_senshi_yohko_chan.ps1 $^ $@

dist/vball_x68_rom.js: $(addprefix roms/,x68000.zip vball.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/vulgus_rom.js: $(addprefix roms/,vulgus.zip)
	powershell -ExecutionPolicy RemoteSigned -File vulgus.ps1 $^ $@

dist/warp_and_warp_rom.js: $(addprefix roms/,warpwarp.zip)
	powershell -ExecutionPolicy RemoteSigned -File warp_and_warp.ps1 $^ $@

dist/wings_x68_rom.js: $(addprefix roms/,x68000.zip wings.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/wonder_boy_rom.js: $(addprefix roms/,wboy.zip)
	powershell -ExecutionPolicy RemoteSigned -File wonder_boy.ps1 $^ $@

dist/wonder_boy_iii_rom.js: $(addprefix roms/,wb3.zip)
	powershell -ExecutionPolicy RemoteSigned -File wonder_boy_iii.ps1 $^ $@

dist/wonder_boy_in_monster_land_rom.js: $(addprefix roms/,wbml.zip)
	powershell -ExecutionPolicy RemoteSigned -File wonder_boy_in_monster_land.ps1 $^ $@

dist/wonder_momo_rom.js: $(addprefix roms/,wndrmomo.zip)
	powershell -ExecutionPolicy RemoteSigned -File wonder_momo.ps1 $^ $@

dist/world_court_rom.js: $(addprefix roms/,wldcourt.zip)
	powershell -ExecutionPolicy RemoteSigned -File world_court.ps1 $^ $@

dist/world_court_x68_rom.js: $(addprefix roms/,x68000.zip world_court_disk1.xdf world_court_disk2.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/world_stadium_x68_rom.js: $(addprefix roms/,x68000.zip world_stadium_disk1.xdf world_stadium_disk2.xdf)
	powershell -ExecutionPolicy RemoteSigned -File x68000.ps1 $^ $@

dist/x_multiply_rom.js: $(addprefix roms/,xmultipl.zip)
	powershell -ExecutionPolicy RemoteSigned -File x_multiply.ps1 $^ $@

dist/xevious_rom.js: $(addprefix roms/,xevious.zip namco50.zip namco51.zip namco54.zip)
	powershell -ExecutionPolicy RemoteSigned -File xevious.ps1 $^ $@

dist/xexex_rom.js: $(addprefix roms/,xexex.zip)
	powershell -ExecutionPolicy RemoteSigned -File xexex.ps1 $^ $@

dist/yokai_douchuuki_rom.js: $(addprefix roms/,shadowld.zip)
	powershell -ExecutionPolicy RemoteSigned -File yokai_douchuuki.ps1 $^ $@

dist/zigzag_rom.js: $(addprefix roms/,zigzagb.zip)
	powershell -ExecutionPolicy RemoteSigned -File zigzag.ps1 $^ $@

