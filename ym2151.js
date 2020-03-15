/*
 *
 *	YM2151 Sound Module
 *
 */

export default class YM2151 {
	constructor({clock, resolution = 1, gain = 1}) {
		this.clock = clock;
		this.resolution = resolution;
		this.gain = gain;
		this.tmpwheel = new Array(resolution);
		if (!audioCtx)
			return;
		this.source = audioCtx.createBufferSource();
		this.gainNode = audioCtx.createGain();
		this.gainNode.gain.value = gain;
		this.sampleRate = Math.floor(audioCtx.sampleRate);
		this.count = this.sampleRate - 1;
		this.wheel = [];
		this.opm = new OPM();
		this.opm.Init(clock, this.sampleRate);
		this.scriptNode = audioCtx.createScriptProcessor(512, 1, 1);
		this.scriptNode.onaudioprocess = ({outputBuffer}) => {
			outputBuffer.getChannelData(0).forEach((e, i, data) => {
				for (this.count += 60 * resolution; this.count >= this.sampleRate; this.count -= this.sampleRate) {
					const q = this.wheel.shift();
					q && q.forEach(({addr, data}) => this.opm.SetReg(addr, data));
				}
				const ch0 = [], ch1 = [];
				this.opm.Mix(ch0, ch1, 0, 1);
				data[i] = (ch0[0] + ch1[0]) / 2;
			});
		};
		this.source.connect(this.scriptNode);
		this.scriptNode.connect(this.gainNode);
		this.gainNode.connect(audioCtx.destination);
		this.source.start();
	}

	mute(flag) {
		if (!audioCtx)
			return;
		this.gainNode.gain.value = flag ? 0 : this.gain;
	}

	write(addr, data, timer = 0) {
		if (this.tmpwheel[timer])
			this.tmpwheel[timer].push({addr, data});
		else
			this.tmpwheel[timer] = [{addr, data}];
	}

	update() {
		if (this.wheel) {
			if (this.wheel.length > this.resolution) {
				this.wheel.forEach(q => q.forEach(({addr, data}) => this.opm.SetReg(addr, data)));
				this.count = this.sampleRate - 1;
				this.wheel.splice(0);
			}
			this.wheel = this.wheel.concat(this.tmpwheel);
		}
		this.tmpwheel = new Array(this.resolution);
	}
}

const FM = {FM_PGBITS: 9, FM_RATIOBITS: 7, FM_LFOBITS: 8, FM_TLBITS: 7, FM_CLENTS: 8192, FM_OPSINBITS: 10, FM_EG_BOTTOM: 955, pmtable: new Array(2), amtable: new Array(2), OpType: {typeN: 0, typeM: 1}};

void function () {
	FM.FM_TLENTS = 1 << FM.FM_TLBITS;
	FM.FM_LFOENTS = 1 << FM.FM_LFOBITS;
	FM.FM_OPSINENTS = 1 << FM.FM_OPSINBITS;
	FM.IS2EC_SHIFT = 20 + FM.FM_PGBITS - 13;
}();

void function MakeLFOTable() {
	let e, i,
		s = [[0, 1 / 360, 2 / 360, 3 / 360, 4 / 360, 6 / 360, 12 / 360, 24 / 360], [0, 1 / 480, 2 / 480, 4 / 480, 10 / 480, 20 / 480, 80 / 480, 140 / 480]],
		h = [[31, 6, 4, 3], [31, 2, 1, 0]];
	for (let a = 0; 2 > a; a++) {
		for (FM.pmtable[a] = new Array(8), e = 0; 8 > e; e++) {
			let o = s[a][e];
			for (FM.pmtable[a][e] = new Array(FM.FM_LFOENTS), i = 0; i < FM.FM_LFOENTS; i++) {
				let n = (/* Math.pow(2, o * (2 * i - FM.FM_LFOENTS + 1) / (FM.FM_LFOENTS - 1)), */ .6 * o * Math.sin(2 * i * Math.PI / FM.FM_LFOENTS) + 1);
				FM.pmtable[a][e][i] = 65536 * (n - 1) | 0;
			}
		}
		for (FM.amtable[a] = new Array(4), e = 0; 4 > e; e++) for (FM.amtable[a][e] = new Array(FM.FM_LFOENTS), i = 0; i < FM.FM_LFOENTS; i++) FM.amtable[a][e][i] = 2 * (4 * i >> h[a][e]) << 2;
	}
}();

class Operator {
	constructor() {
		this.chip_ = null;
		this.type_ = 0;
		this.out_ = 0;
		this.out2_ = 0;
		this.dp_ = 0;
		this.detune_ = 0;
		this.detune2_ = 0;
		this.multiple_ = 0;
		this.pg_count_ = 0;
		this.pg_diff_ = 0;
		this.pg_diff_lfo_ = 0;
		this.bn_ = 0;
		this.eg_level_ = 0;
		this.eg_level_on_next_phase_ = 0;
		this.eg_count_ = 0;
		this.eg_count_diff_ = 0;
		this.eg_out_ = 0;
		this.tl_out_ = 0;
		this.eg_rate_ = 0;
		this.eg_curve_count_ = 0;
		this.key_scale_rate_ = 0;
		this.eg_phase_ = Operator.EGPhase.next;
		this.ms_ = 0;
		this.tl_ = 0;
		this.ar_ = 0;
		this.dr_ = 0;
		this.sr_ = 0;
		this.sl_ = 0;
		this.rr_ = 0;
		this.ks_ = 0;
		this.keyon_ = false;
		this.amon_ = false;
		this.param_changed_ = false;
		this.mute_ = false;
		Operator.tablehasmade || Operator.MakeTable();
		this.ar_ = this.dr_ = this.sr_ = this.rr_ = this.key_scale_rate_ = 0;
		this.ams_ = FM.amtable[0][0];
		this.mute_ = false;
		this.keyon_ = false;
		this.tl_out_ = 0;
		this.multiple_ = 0;
		this.detune_ = 0;
		this.detune2_ = 0;
		this.ms_ = 0;
	}

	SetChip(t) {
		this.chip_ = t;
	}

	Reset() {
		this.tl_ = 127;
		this.ShiftPhase(Operator.EGPhase.off);
		this.eg_count_ = 0;
		this.eg_curve_count_ = 0;
		this.pg_count_ = 0;
		this.out_ = this.out2_ = 0;
		this.param_changed_ = true;
	}

	static MakeTable() {
		let s = 0;
		for (let i = 0; 256 > i; i++) {
			let h = Math.floor(Math.pow(2, 13 - i / 256));
			h = h + 2 & -4;
			Operator.cltable[s++] = h;
			Operator.cltable[s++] = -h;
		}
		for (; s < FM.FM_CLENTS;) {
			Operator.cltable[s] = Operator.cltable[s - 512] / 2 | 0;
			s++;
		}
		for (let i = 0; i < FM.FM_OPSINENTS / 2; i++) {
			let a = (2 * i + 1) * Math.PI / FM.FM_OPSINENTS, o = -256 * Math.log(Math.sin(a)) / Math.LN2,
				n = Math.floor(o + .5) + 1;
			Operator.sinetable[i] = 2 * n;
			Operator.sinetable[FM.FM_OPSINENTS / 2 + i] = 2 * n + 1;
		}
		Operator.tablehasmade = true;
	}

	SetDPBN(t, e) {
		this.dp_ = t;
		this.bn_ = e;
		this.param_changed_ = true;
	}

	Prepare() {
		if (this.param_changed_) {
			this.param_changed_ = false;
			this.pg_diff_ = (this.dp_ + Operator.dttable[this.detune_ + this.bn_]) * this.chip_.GetMulValue(this.detune2_, this.multiple_);
			this.pg_diff_lfo_ = this.pg_diff_ >> 11;
			this.key_scale_rate_ = this.bn_ >> 3 - this.ks_;
			this.tl_out_ = this.mute_ ? 1023 : 8 * this.tl_;
			switch (this.eg_phase_) {
			case Operator.EGPhase.attack:
				this.SetEGRate(this.ar_ ? Math.min(63, this.ar_ + this.key_scale_rate_) : 0);
				break;
			case Operator.EGPhase.decay:
				this.SetEGRate(this.dr_ ? Math.min(63, this.dr_ + this.key_scale_rate_) : 0);
				this.eg_level_on_next_phase_ = 8 * this.sl_;
				break;
			case Operator.EGPhase.sustain:
				this.SetEGRate(this.sr_ ? Math.min(63, this.sr_ + this.key_scale_rate_) : 0);
				break;
			case Operator.EGPhase.release:
				this.SetEGRate(Math.min(63, this.rr_ + this.key_scale_rate_));
				break;
			}
			this.ams_ = FM.amtable[this.type_][this.amon_ ? this.ms_ >> 4 & 3 : 0];
			this.EGUpdate();
		}
	}

	ShiftPhase(i) {
		switch (i) {
		case Operator.EGPhase.attack:
			if (this.ar_ + this.key_scale_rate_ < 62) {
				this.SetEGRate(this.ar_ ? Math.min(63, this.ar_ + this.key_scale_rate_) : 0);
				this.eg_phase_ = Operator.EGPhase.attack;
				break;
			}
		case Operator.EGPhase.decay:
			if (this.sl_) {
				this.eg_level_ = 0;
				this.eg_level_on_next_phase_ = 8 * this.sl_;
				this.SetEGRate(this.dr_ ? Math.min(63, this.dr_ + this.key_scale_rate_) : 0);
				this.eg_phase_ = Operator.EGPhase.decay;
				break;
			}
		case Operator.EGPhase.sustain:
			this.eg_level_ = 8 * this.sl_;
			this.eg_level_on_next_phase_ = 1024;
			this.SetEGRate(this.sr_ ? Math.min(63, this.sr_ + this.key_scale_rate_) : 0);
			this.eg_phase_ = Operator.EGPhase.sustain;
			break;
		case Operator.EGPhase.release:
			if (this.eg_phase_ === Operator.EGPhase.attack || this.eg_level_ < FM.FM_EG_BOTTOM) {
				this.eg_level_on_next_phase_ = 1024;
				this.SetEGRate(Math.min(63, this.rr_ + this.key_scale_rate_));
				this.eg_phase_ = Operator.EGPhase.release;
				break;
			}
		case Operator.EGPhase.off:
		default:
			this.eg_level_ = FM.FM_EG_BOTTOM;
			this.eg_level_on_next_phase_ = FM.FM_EG_BOTTOM;
			this.EGUpdate();
			this.SetEGRate(0);
			this.eg_phase_ = Operator.EGPhase.off;
			break;
		}
	}

	static LogToLin(i) {
		return i < FM.FM_CLENTS ? Operator.cltable[i] : 0;
	}

	EGUpdate() {
		this.eg_out_ = Math.min(this.tl_out_ + this.eg_level_, 1023) << 3;
	}

	SetEGRate(t) {
		this.eg_rate_ = t;
		this.eg_count_diff_ = Operator.decaytable2[t >> 2] * this.chip_.GetRatio();
	}

	EGCalc() {
		this.eg_count_ = 6141 << FM.FM_RATIOBITS;
		if (this.eg_phase_ === Operator.EGPhase.attack) {
			let i = Operator.attacktable[this.eg_rate_][7 & this.eg_curve_count_];
			if (i >= 0) {
				this.eg_level_ -= 1 + (this.eg_level_ >> i);
				this.eg_level_ <= 0 && this.ShiftPhase(Operator.EGPhase.decay);
			}
			this.EGUpdate();
		}
		else {
			this.eg_level_ += Operator.decaytable1[this.eg_rate_][7 & this.eg_curve_count_];
			this.eg_level_ >= this.eg_level_on_next_phase_ && this.ShiftPhase(this.eg_phase_ + 1);
			this.EGUpdate();
		}
		this.eg_curve_count_++;
	}

	EGStep() {
		this.eg_count_ -= this.eg_count_diff_;
		this.eg_count_ <= 0 && this.EGCalc();
	}

	PGCalc() {
		let t = this.pg_count_;
		this.pg_count_ += this.pg_diff_;
		return t;
	}

	PGCalcL() {
		let t = this.pg_count_;
		this.pg_count_ += this.pg_diff_ + (this.pg_diff_lfo_ * this.chip_.GetPMV() >> 5);
		return t;
	}

	Calc(i) {
		this.EGStep();
		this.out2_ = this.out_;
		let s = this.PGCalc() >> 20 + FM.FM_PGBITS - FM.FM_OPSINBITS;
		s += i >> 20 + FM.FM_PGBITS - FM.FM_OPSINBITS - (2 + FM.IS2EC_SHIFT);
		this.out_ = Operator.LogToLin(this.eg_out_ + Operator.sinetable[s & FM.FM_OPSINENTS - 1]);
		return this.out_;
	}

	CalcL(i) {
		this.EGStep();
		let s = this.PGCalcL() >> 20 + FM.FM_PGBITS - FM.FM_OPSINBITS;
		s += i >> 20 + FM.FM_PGBITS - FM.FM_OPSINBITS - (2 + FM.IS2EC_SHIFT);
		this.out_ = Operator.LogToLin(this.eg_out_ + Operator.sinetable[s & FM.FM_OPSINENTS - 1] + this.ams_[this.chip_.GetAML()]);
		return this.out_;
	}

	CalcN(t) {
		this.EGStep();
		let e = Math.max(0, 1023 - (this.tl_out_ + this.eg_level_)) << 1;
		t = (1 & t) - 1;
		this.out_ = e + t ^ t;
		return this.out_;
	}

	CalcFB(i) {
		this.EGStep();
		let s = this.out_ + this.out2_;
		this.out2_ = this.out_;
		let h = this.PGCalc() >> 20 + FM.FM_PGBITS - FM.FM_OPSINBITS;
		31 > i && (h += s << 1 + FM.IS2EC_SHIFT >> i >> 20 + FM.FM_PGBITS - FM.FM_OPSINBITS);
		this.out_ = Operator.LogToLin(this.eg_out_ + Operator.sinetable[h & FM.FM_OPSINENTS - 1]);
		return this.out2_;
	}

	CalcFBL(i) {
		this.EGStep();
		let s = this.out_ + this.out2_;
		this.out2_ = this.out_;
		let h = this.PGCalcL() >> 20 + FM.FM_PGBITS - FM.FM_OPSINBITS;
		31 > i && (h += s << 1 + FM.IS2EC_SHIFT >> i >> 20 + FM.FM_PGBITS - FM.FM_OPSINBITS);
		this.out_ = Operator.LogToLin(this.eg_out_ + Operator.sinetable[h & FM.FM_OPSINENTS - 1] + this.ams_[this.chip_.GetAML()]);
		return this.out_;
	}

	ResetFB() {
		this.out_ = this.out2_ = 0;
	}

	KeyOn() {
		if (!this.keyon_) {
			this.keyon_ = true;
			if (this.eg_phase_ === Operator.EGPhase.off || this.eg_phase_ === Operator.EGPhase.release) {
				this.ShiftPhase(Operator.EGPhase.attack);
				this.EGUpdate();
				this.out_ = this.out2_ = 0;
				this.pg_count_ = 0;
			}
		}
	}

	KeyOff() {
		if (this.keyon_) {
			this.keyon_ = false;
			this.ShiftPhase(Operator.EGPhase.release);
		}
	}

	IsOn() {
		return this.eg_phase_ - Operator.EGPhase.off;
	}

	SetDT(t) {
		this.detune_ = 32 * t;
		this.param_changed_ = true;
	}

	SetDT2(t) {
		this.detune2_ = 3 & t;
		this.param_changed_ = true;
	}

	SetMULTI(t) {
		this.multiple_ = t;
		this.param_changed_ = true;
	}

	SetTL(t) {
		this.tl_ = t;
		this.param_changed_ = true;
	}

	SetAR(t) {
		this.ar_ = t;
		this.param_changed_ = true;
	}

	SetDR(t) {
		this.dr_ = t;
		this.param_changed_ = true;
	}

	SetSR(t) {
		this.sr_ = t;
		this.param_changed_ = true;
	}

	SetSL(t) {
		this.sl_ = t;
		this.param_changed_ = true;
	}

	SetRR(t) {
		this.rr_ = t;
		this.param_changed_ = true;
	}

	SetKS(t) {
		this.ks_ = t;
		this.param_changed_ = true;
	}

	SetAMON(t) {
		this.amon_ = t;
		this.param_changed_ = true;
	}

	Mute(t) {
		this.mute_ = t;
		this.param_changed_ = true;
	}

	SetMS(t) {
		this.ms_ = t;
		this.param_changed_ = true;
	}

	Out() {
		return this.out_;
	}
}

void function () {
	Operator.notetable = [
		0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 5, 6, 7, 7, 7, 7, 7, 7, 7,
		8, 8, 8, 8, 8, 8, 8, 9, 10, 11, 11, 11, 11, 11, 11, 11, 12, 12, 12, 12, 12, 12, 12, 13, 14, 15, 15, 15, 15, 15, 15, 15,
		16, 16, 16, 16, 16, 16, 16, 17, 18, 19, 19, 19, 19, 19, 19, 19, 20, 20, 20, 20, 20, 20, 20, 21, 22, 23, 23, 23, 23, 23, 23, 23,
		24, 24, 24, 24, 24, 24, 24, 25, 26, 27, 27, 27, 27, 27, 27, 27, 28, 28, 28, 28, 28, 28, 28, 29, 30, 31, 31, 31, 31, 31, 31, 31
	];
	Operator.dttable = [
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 8, 8, 8, 10, 10, 12, 12, 14, 16, 16, 16, 16,
		2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 8, 8, 8, 10, 10, 12, 12, 14, 16, 16, 18, 20, 22, 24, 26, 28, 32, 32, 32, 32,
		4, 4, 4, 4, 4, 6, 6, 6, 8, 8, 8, 10, 10, 12, 12, 14, 16, 16, 18, 20, 22, 24, 26, 28, 32, 34, 38, 40, 44, 44, 44, 44,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, -2, -2, -2, -2, -2, -2, -2, -2, -4, -4, -4, -4, -4, -6, -6, -6, -8, -8, -8, -10, -10, -12, -12, -14, -16, -16, -16, -16,
		-2, -2, -2, -2, -4, -4, -4, -4, -4, -6, -6, -6, -8, -8, -8, -10, -10, -12, -12, -14, -16, -16, -18, -20, -22, -24, -26, -28, -32, -32, -32, -32,
		-4, -4, -4, -4, -4, -6, -6, -6, -8, -8, -8, -10, -10, -12, -12, -14, -16, -16, -18, -20, -22, -24, -26, -28, -32, -34, -38, -40, -44, -44, -44, -44
	];
	Operator.decaytable1 = [
		[0, 0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0, 0],
		[1, 1, 1, 1, 1, 1, 1, 1],
		[1, 1, 1, 1, 1, 1, 1, 1],
		[1, 1, 1, 1, 1, 1, 1, 1],
		[1, 1, 1, 1, 1, 1, 1, 1],
		[1, 1, 1, 0, 1, 1, 1, 0],
		[1, 1, 1, 0, 1, 1, 1, 0],
		[1, 0, 1, 0, 1, 0, 1, 0],
		[1, 1, 1, 0, 1, 0, 1, 0],
		[1, 1, 1, 0, 1, 1, 1, 0],
		[1, 1, 1, 1, 1, 1, 1, 0],
		[1, 0, 1, 0, 1, 0, 1, 0],
		[1, 1, 1, 0, 1, 0, 1, 0],
		[1, 1, 1, 0, 1, 1, 1, 0],
		[1, 1, 1, 1, 1, 1, 1, 0],
		[1, 0, 1, 0, 1, 0, 1, 0],
		[1, 1, 1, 0, 1, 0, 1, 0],
		[1, 1, 1, 0, 1, 1, 1, 0],
		[1, 1, 1, 1, 1, 1, 1, 0],
		[1, 0, 1, 0, 1, 0, 1, 0],
		[1, 1, 1, 0, 1, 0, 1, 0],
		[1, 1, 1, 0, 1, 1, 1, 0],
		[1, 1, 1, 1, 1, 1, 1, 0],
		[1, 0, 1, 0, 1, 0, 1, 0],
		[1, 1, 1, 0, 1, 0, 1, 0],
		[1, 1, 1, 0, 1, 1, 1, 0],
		[1, 1, 1, 1, 1, 1, 1, 0],
		[1, 0, 1, 0, 1, 0, 1, 0],
		[1, 1, 1, 0, 1, 0, 1, 0],
		[1, 1, 1, 0, 1, 1, 1, 0],
		[1, 1, 1, 1, 1, 1, 1, 0],
		[1, 0, 1, 0, 1, 0, 1, 0],
		[1, 1, 1, 0, 1, 0, 1, 0],
		[1, 1, 1, 0, 1, 1, 1, 0],
		[1, 1, 1, 1, 1, 1, 1, 0],
		[1, 0, 1, 0, 1, 0, 1, 0],
		[1, 1, 1, 0, 1, 0, 1, 0],
		[1, 1, 1, 0, 1, 1, 1, 0],
		[1, 1, 1, 1, 1, 1, 1, 0],
		[1, 0, 1, 0, 1, 0, 1, 0],
		[1, 1, 1, 0, 1, 0, 1, 0],
		[1, 1, 1, 0, 1, 1, 1, 0],
		[1, 1, 1, 1, 1, 1, 1, 0],
		[1, 0, 1, 0, 1, 0, 1, 0],
		[1, 1, 1, 0, 1, 0, 1, 0],
		[1, 1, 1, 0, 1, 1, 1, 0],
		[1, 1, 1, 1, 1, 1, 1, 0],
		[1, 1, 1, 1, 1, 1, 1, 1],
		[2, 1, 1, 1, 2, 1, 1, 1],
		[2, 1, 2, 1, 2, 1, 2, 1],
		[2, 2, 2, 1, 2, 2, 2, 1],
		[2, 2, 2, 2, 2, 2, 2, 2],
		[4, 2, 2, 2, 4, 2, 2, 2],
		[4, 2, 4, 2, 4, 2, 4, 2],
		[4, 4, 4, 2, 4, 4, 4, 2],
		[4, 4, 4, 4, 4, 4, 4, 4],
		[8, 4, 4, 4, 8, 4, 4, 4],
		[8, 4, 8, 4, 8, 4, 8, 4],
		[8, 8, 8, 4, 8, 8, 8, 4],
		[16, 16, 16, 16, 16, 16, 16, 16],
		[16, 16, 16, 16, 16, 16, 16, 16],
		[16, 16, 16, 16, 16, 16, 16, 16],
		[16, 16, 16, 16, 16, 16, 16, 16]
	];
	Operator.decaytable2 = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2047, 2047, 2047, 2047, 2047];
	Operator.attacktable = [
		[-1, -1, -1, -1, -1, -1, -1, -1],
		[-1, -1, -1, -1, -1, -1, -1, -1],
		[4, 4, 4, 4, 4, 4, 4, 4],
		[4, 4, 4, 4, 4, 4, 4, 4],
		[4, 4, 4, 4, 4, 4, 4, 4],
		[4, 4, 4, 4, 4, 4, 4, 4],
		[4, 4, 4, -1, 4, 4, 4, -1],
		[4, 4, 4, -1, 4, 4, 4, -1],
		[4, -1, 4, -1, 4, -1, 4, -1],
		[4, 4, 4, -1, 4, -1, 4, -1],
		[4, 4, 4, -1, 4, 4, 4, -1],
		[4, 4, 4, 4, 4, 4, 4, -1],
		[4, -1, 4, -1, 4, -1, 4, -1],
		[4, 4, 4, -1, 4, -1, 4, -1],
		[4, 4, 4, -1, 4, 4, 4, -1],
		[4, 4, 4, 4, 4, 4, 4, -1],
		[4, -1, 4, -1, 4, -1, 4, -1],
		[4, 4, 4, -1, 4, -1, 4, -1],
		[4, 4, 4, -1, 4, 4, 4, -1],
		[4, 4, 4, 4, 4, 4, 4, -1],
		[4, -1, 4, -1, 4, -1, 4, -1],
		[4, 4, 4, -1, 4, -1, 4, -1],
		[4, 4, 4, -1, 4, 4, 4, -1],
		[4, 4, 4, 4, 4, 4, 4, -1],
		[4, -1, 4, -1, 4, -1, 4, -1],
		[4, 4, 4, -1, 4, -1, 4, -1],
		[4, 4, 4, -1, 4, 4, 4, -1],
		[4, 4, 4, 4, 4, 4, 4, -1],
		[4, -1, 4, -1, 4, -1, 4, -1],
		[4, 4, 4, -1, 4, -1, 4, -1],
		[4, 4, 4, -1, 4, 4, 4, -1],
		[4, 4, 4, 4, 4, 4, 4, -1],
		[4, -1, 4, -1, 4, -1, 4, -1],
		[4, 4, 4, -1, 4, -1, 4, -1],
		[4, 4, 4, -1, 4, 4, 4, -1],
		[4, 4, 4, 4, 4, 4, 4, -1],
		[4, -1, 4, -1, 4, -1, 4, -1],
		[4, 4, 4, -1, 4, -1, 4, -1],
		[4, 4, 4, -1, 4, 4, 4, -1],
		[4, 4, 4, 4, 4, 4, 4, -1],
		[4, -1, 4, -1, 4, -1, 4, -1],
		[4, 4, 4, -1, 4, -1, 4, -1],
		[4, 4, 4, -1, 4, 4, 4, -1],
		[4, 4, 4, 4, 4, 4, 4, -1],
		[4, -1, 4, -1, 4, -1, 4, -1],
		[4, 4, 4, -1, 4, -1, 4, -1],
		[4, 4, 4, -1, 4, 4, 4, -1],
		[4, 4, 4, 4, 4, 4, 4, -1],
		[4, 4, 4, 4, 4, 4, 4, 4],
		[3, 4, 4, 4, 3, 4, 4, 4],
		[3, 4, 3, 4, 3, 4, 3, 4],
		[3, 3, 3, 4, 3, 3, 3, 4],
		[3, 3, 3, 3, 3, 3, 3, 3],
		[2, 3, 3, 3, 2, 3, 3, 3],
		[2, 3, 2, 3, 2, 3, 2, 3],
		[2, 2, 2, 3, 2, 2, 2, 3],
		[2, 2, 2, 2, 2, 2, 2, 2],
		[1, 2, 2, 2, 1, 2, 2, 2],
		[1, 2, 1, 2, 1, 2, 1, 2],
		[1, 1, 1, 2, 1, 1, 1, 2],
		[0, 0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0, 0],
		[0, 0, 0, 0, 0, 0, 0, 0]
	];
	Operator.tablehasmade = false;
	Operator.sinetable = new Array(1024);
	Operator.cltable = new Array(FM.FM_CLENTS);
	Operator.EGPhase = {next: 0, attack: 1, decay: 2, sustain: 3, release: 4, off: 5};
}();

class Channel4 {
	constructor() {
		this.op = [new Operator, new Operator, new Operator, new Operator];
		this.fb = 0;
		this.buf = new Array(4);
		this.inop = new Array(3);
		this.outop = new Array(3);
		this.algo_ = 0;
		this.chip_ = null;
		Channel4.tablehasmade || Channel4.MakeTable();
		this.SetAlgorithm(0);
		this.pms = FM.pmtable[0][0];
	}

	static MakeTable() {
		for (let t = 0; 64 > t; t++)
			Channel4.kftable[t] = 65536 * Math.pow(2, t / 768) | 0;
	}

	SetChip(t) {
		this.chip_ = t;
		for (let e = 0; 4 > e; e++)
			this.op[e].SetChip(t);
	}

	Reset() {
		for (let t = 0; 4 > t; t++)
			this.op[t].Reset();
	}

	Prepare() {
		for (let e = 0; 4 > e; e++)
			this.op[e].Prepare();
		this.pms = FM.pmtable[this.op[0].type_][7 & this.op[0].ms_];
		let i = (this.op[0].IsOn() | this.op[1].IsOn() | this.op[2].IsOn() | this.op[3].IsOn()) !== 0 ? 1 : 0,
			s = this.op[0].ms_ & (this.op[0].amon_ || this.op[1].amon_ || this.op[2].amon_ || this.op[3].amon_ ? 55 : 7) ? 2 : 0;
		return i | s;
	}

	SetKCKF(t, i) {
		let s = [5197, 5506, 5833, 6180, 6180, 6547, 6937, 7349, 7349, 7786, 8249, 8740, 8740, 9259, 9810, 10394],
			h = 19 - (t >> 4 & 7), a = s[15 & t];
		a = 4 * ((a + 2) / 4 | 0);
		let o = a * Channel4.kftable[63 & i];
		o >>= 19;
		o <<= 19;
		o >>= h;
		let n = t >> 2 & 31;
		this.op[0].SetDPBN(o, n);
		this.op[1].SetDPBN(o, n);
		this.op[2].SetDPBN(o, n);
		this.op[3].SetDPBN(o, n);
	}

	KeyControl(t) {
		(1 & t) !== 0 ? this.op[0].KeyOn() : this.op[0].KeyOff();
		(2 & t) !== 0 ? this.op[1].KeyOn() : this.op[1].KeyOff();
		(4 & t) !== 0 ? this.op[2].KeyOn() : this.op[2].KeyOff();
		(8 & t) !== 0 ? this.op[3].KeyOn() : this.op[3].KeyOff();
	}

	SetAlgorithm(t) {
		let e = [[0, 1, 1, 2, 2, 3], [1, 0, 0, 1, 1, 2], [1, 1, 1, 0, 0, 2], [0, 1, 2, 1, 1, 2], [0, 1, 2, 2, 2, 1], [0, 1, 0, 1, 0, 1], [0, 1, 2, 1, 2, 1], [1, 0, 1, 0, 1, 0]];
		this.inop[0] = e[t][0];
		this.outop[0] = e[t][1];
		this.inop[1] = e[t][2];
		this.outop[1] = e[t][3];
		this.inop[2] = e[t][4];
		this.outop[2] = e[t][5];
		this.op[0].ResetFB();
		this.algo_ = t;
	}

	Calc() {
		let t;
		switch (this.algo_) {
		case 0:
			this.op[2].Calc(this.op[1].Out());
			this.op[1].Calc(this.op[0].Out());
			t = this.op[3].Calc(this.op[2].Out());
			this.op[0].CalcFB(this.fb);
			break;
		case 1:
			this.op[2].Calc(this.op[0].Out() + this.op[1].Out());
			this.op[1].Calc(0);
			t = this.op[3].Calc(this.op[2].Out());
			this.op[0].CalcFB(this.fb);
			break;
		case 2:
			this.op[2].Calc(this.op[1].Out());
			this.op[1].Calc(0);
			t = this.op[3].Calc(this.op[0].Out() + this.op[2].Out());
			this.op[0].CalcFB(this.fb);
			break;
		case 3:
			this.op[2].Calc(0);
			this.op[1].Calc(this.op[0].Out());
			t = this.op[3].Calc(this.op[1].Out() + this.op[2].Out());
			this.op[0].CalcFB(this.fb);
			break;
		case 4:
			this.op[2].Calc(0);
			t = this.op[1].Calc(this.op[0].Out());
			t += this.op[3].Calc(this.op[2].Out());
			this.op[0].CalcFB(this.fb);
			break;
		case 5:
			t = this.op[2].Calc(this.op[0].Out());
			t += this.op[1].Calc(this.op[0].Out());
			t += this.op[3].Calc(this.op[0].Out());
			this.op[0].CalcFB(this.fb);
			break;
		case 6:
			t = this.op[2].Calc(0);
			t += this.op[1].Calc(this.op[0].Out());
			t += this.op[3].Calc(0);
			this.op[0].CalcFB(this.fb);
			break;
		case 7:
			t = this.op[2].Calc(0);
			t += this.op[1].Calc(0);
			t += this.op[3].Calc(0);
			t += this.op[0].CalcFB(this.fb);
			break;
		}
		return t;
	}

	CalcL() {
		this.chip_.SetPMV(this.pms[this.chip_.GetPML()]);
		let t;
		switch (this.algo_) {
		case 0:
			this.op[2].CalcL(this.op[1].Out());
			this.op[1].CalcL(this.op[0].Out());
			t = this.op[3].CalcL(this.op[2].Out());
			this.op[0].CalcFBL(this.fb);
			break;
		case 1:
			this.op[2].CalcL(this.op[0].Out() + this.op[1].Out());
			this.op[1].CalcL(0);
			t = this.op[3].CalcL(this.op[2].Out());
			this.op[0].CalcFBL(this.fb);
			break;
		case 2:
			this.op[2].CalcL(this.op[1].Out());
			this.op[1].CalcL(0);
			t = this.op[3].CalcL(this.op[0].Out() + this.op[2].Out());
			this.op[0].CalcFBL(this.fb);
			break;
		case 3:
			this.op[2].CalcL(0);
			this.op[1].CalcL(this.op[0].Out());
			t = this.op[3].CalcL(this.op[1].Out() + this.op[2].Out());
			this.op[0].CalcFBL(this.fb);
			break;
		case 4:
			this.op[2].CalcL(0);
			t = this.op[1].CalcL(this.op[0].Out());
			t += this.op[3].CalcL(this.op[2].Out());
			this.op[0].CalcFBL(this.fb);
			break;
		case 5:
			t = this.op[2].CalcL(this.op[0].Out());
			t += this.op[1].CalcL(this.op[0].Out());
			t += this.op[3].CalcL(this.op[0].Out());
			this.op[0].CalcFBL(this.fb);
			break;
		case 6:
			t = this.op[2].CalcL(0);
			t += this.op[1].CalcL(this.op[0].Out());
			t += this.op[3].CalcL(0);
			this.op[0].CalcFBL(this.fb);
			break;
		case 7:
			t = this.op[2].CalcL(0);
			t += this.op[1].CalcL(0);
			t += this.op[3].CalcL(0);
			t += this.op[0].CalcFBL(this.fb);
			break;
		}
		return t;
	}

	CalcN(t) {
		this.buf[1] = this.buf[2] = this.buf[3] = 0;
		this.buf[0] = this.op[0].out_;
		this.op[0].CalcFB(this.fb);
		this.buf[this.outop[0]] += this.op[1].Calc(this.buf[this.inop[0]]);
		this.buf[this.outop[1]] += this.op[2].Calc(this.buf[this.inop[1]]);
		let e = this.op[3].out_;
		this.op[3].CalcN(t);
		return this.buf[this.outop[2]] + e;
	}

	CalcLN(t) {
		this.chip_.SetPMV(this.pms[this.chip_.GetPML()]);
		this.buf[1] = this.buf[2] = this.buf[3] = 0;
		this.buf[0] = this.op[0].out_;
		this.op[0].CalcFBL(this.fb);
		this.buf[this.outop[0]] += this.op[1].CalcL(this.buf[this.inop[0]]);
		this.buf[this.outop[1]] += this.op[2].CalcL(this.buf[this.inop[1]]);
		let e = this.op[3].out_;
		this.op[3].CalcN(t);
		return this.buf[this.outop[2]] + e;
	}

	SetType(t) {
		for (let e = 0; 4 > e; e++)
			this.op[e].type_ = t;
	}

	SetFB(t) {
		this.fb = Channel4.fbtable[t];
	}

	SetMS(t) {
		for (let e = 0; 4 > e; e++)
			this.op[e].SetMS(t);
	}

	Mute(t) {
		for (let e = 0; 4 > e; e++)
			this.op[e].Mute(t);
	}
}

void function() {
	Channel4.fbtable = [31, 7, 6, 5, 4, 3, 2, 1];
	Channel4.kftable = new Array(64);
	Channel4.tablehasmade = false;
}();

class Chip {
	constructor() {
		this.ratio_ = 0;
		this.aml_ = 0;
		this.pml_ = 0;
		this.pmv_ = 0;
	}

	SetRatio(t) {
		if (this.ratio_ !== t) {
			this.ratio_ = t;
			this.MakeTable();
		}
	}

	SetAML(e) {
		this.aml_ = e & FM.FM_LFOENTS - 1;
	}

	SetPML(e) {
		this.pml_ = e & FM.FM_LFOENTS - 1;
	}

	SetPMV(t) {
		this.pmv_ = t;
	}

	GetMulValue(t, e) {
		return this.multable_[t][e];
	}

	GetAML() {
		return this.aml_;
	}

	GetPML() {
		return this.pml_;
	}

	GetPMV() {
		return this.pmv_;
	}

	GetRatio() {
		return this.ratio_;
	}

	MakeTable() {
		let e, i, s = [1, 1.414, 1.581, 1.732];
		for (this.multable_ = new Array(4), e = 0; 4 > e; e++) {
			let h = s[e] * this.ratio_ / (1 << 2 + FM.FM_RATIOBITS - FM.FM_PGBITS);
			for (this.multable_[e] = new Array(16), i = 0; 16 > i; i++) {
				let a = i ? 2 * i : 1;
				this.multable_[e][i] = a * h | 0;
			}
		}
	}
}

class OPM {
	constructor() {
		this.OPM_LFOENTS = 512;
		this.regtc = 0;
		this.regta = new Array(2);
		this.clock = 0;
		this.rate = 0;
		this.pmd = 0;
		this.amd = 0;
		this.lfo_count_ = 0;
		this.lfo_count_diff_ = 0;
		this.lfo_step_ = 0;
		this.lfo_count_prev_ = 0;
		this.lfowaveform = 0;
		this.rateratio = 0;
		this.noise = 0;
		this.noisecount = 0;
		this.noisedelta = 0;
		this.lfofreq = 0;
		this.status = 0;
		this.reg01 = 0;
		this.kc = new Array(8);
		this.kf = new Array(8);
		this.pan = new Array(8);
		this.ch = [new Channel4, new Channel4, new Channel4, new Channel4, new Channel4, new Channel4, new Channel4, new Channel4];
		this.chip = new Chip;
		this.lfo_count_ = 0;
		this.lfo_count_prev_ = -1;
		this.BuildLFOTable();
		for (let i = 0; 8 > i; i++) {
			this.ch[i].SetChip(this.chip);
			this.ch[i].SetType(FM.OpType.typeM);
		}
	}

	Init(t, e) {
		if (this.SetRate(t, e)) {
			this.Reset();
			this.SetChannelMask(0);
			return true;
		}
		return false;
	}

	SetTimerControl(t) {
		this.regtc = t;
		16 & t && this.ResetStatus(1);
		32 & t && this.ResetStatus(2);
	}

	SetTimerA(t, e) {
		this.regta[1 & t] = e;
	}

	SetTimerB(t) {
	}

	SetRate(t, e) {
		this.clock = t;
		this.rate = e;
		this.RebuildTimeTable();
		return true;
	}

	SetChannelMask(t) {
		for (let e = 0; 8 > e; e++)
			this.ch[e].Mute(!!(t & 1 << e));
	}

	Reset() {
		let t;
		for (t = 0; 256 > t; t++)
			this.SetReg(t, 0);
		for (this.SetReg(25, 128), this.status = 0, this.noise = 12345, this.noisecount = 0, t = 0; 8 > t; t++)
			this.ch[t].Reset();
	}

	RebuildTimeTable() {
		let e = this.clock / 64 | 0;
		this.rateratio = ((e << FM.FM_RATIOBITS) + this.rate / 2) / this.rate | 0;
		this.chip.SetRatio(this.rateratio);
	}

	ResetStatus(t) {
		if ((this.status & t) !== 0) {
			this.status &= ~t;
			this.status || this.Intr(false);
		}
	}

	SetReg(e, i) {
		if (!(e >= 256)) {
			let s = 7 & e;
			switch (255 & e) {
			case 1:
				if ((2 & i) !== 0) {
					this.lfo_count_ = 0;
					this.lfo_count_prev_ = -1;
				}
				this.reg01 = i;
				break;
			case 8:
				if ((128 & this.regtc) !== 0) {
					s = 7 & i;
					8 & i || this.ch[s].op[0].KeyOff();
					16 & i || this.ch[s].op[1].KeyOff();
					32 & i || this.ch[s].op[2].KeyOff();
					64 & i || this.ch[s].op[3].KeyOff();
				}
				else
					this.ch[7 & i].KeyControl(i >> 3);
				break;
			case 16:
			case 17:
				this.SetTimerA(e, i);
				break;
			case 18:
				this.SetTimerB(i);
				break;
			case 20:
				this.SetTimerControl(i);
				break;
			case 24:
				this.lfofreq = i;
				this.lfo_count_diff_ = this.rateratio * (16 + (15 & this.lfofreq) << 12 - FM.FM_RATIOBITS) / (1 << 15 - (this.lfofreq >> 4)) | 0;
				break;
			case 25:
				0 !== (128 & i) ? this.pmd = 127 & i : this.amd = 127 & i;
				break;
			case 27:
				this.lfowaveform = 3 & i;
				break;
			case 32:
			case 33:
			case 34:
			case 35:
			case 36:
			case 37:
			case 38:
			case 39:
				this.ch[s].SetFB(i >> 3 & 7);
				this.ch[s].SetAlgorithm(7 & i);
				this.pan[s] = i >> 6 & 3;
				break;
			case 40:
			case 41:
			case 42:
			case 43:
			case 44:
			case 45:
			case 46:
			case 47:
				this.kc[s] = i;
				this.ch[s].SetKCKF(this.kc[s], this.kf[s]);
				break;
			case 48:
			case 49:
			case 50:
			case 51:
			case 52:
			case 53:
			case 54:
			case 55:
				this.kf[s] = i >> 2;
				this.ch[s].SetKCKF(this.kc[s], this.kf[s]);
				break;
			case 56:
			case 57:
			case 58:
			case 59:
			case 60:
			case 61:
			case 62:
			case 63:
				this.ch[s].SetMS(i << 4 | i >> 4);
				break;
			case 15:
				this.noisedelta = i;
				this.noisecount = 0;
				break;
			default:
				e >= 64 && this.SetParameter(e, i);
				break;
			}
		}
	}

	SetParameter(t, e) {
		let i = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 124], s = [0, 2, 1, 3], h = s[t >> 3 & 3],
			a = this.ch[7 & t].op[h];
		switch (t >> 5 & 7) {
		case 2:
			a.SetDT(e >> 4 & 7);
			a.SetMULTI(15 & e);
			break;
		case 3:
			a.SetTL(127 & e);
			break;
		case 4:
			a.SetKS(e >> 6 & 3);
			a.SetAR(2 * (31 & e));
			break;
		case 5:
			a.SetDR(2 * (31 & e));
			a.SetAMON(0 !== (128 & e));
			break;
		case 6:
			a.SetSR(2 * (31 & e));
			a.SetDT2(e >> 6 & 3);
			break;
		case 7:
			a.SetSL(i[e >> 4 & 15]);
			a.SetRR(4 * (15 & e) + 2);
			break;
		}
	}

	BuildLFOTable() {
		this.amtable = new Array(4);
		this.pmtable = new Array(4);
		for (let t = 0; 4 > t; t++) {
			let e = 0;
			this.amtable[t] = new Array(this.OPM_LFOENTS);
			this.pmtable[t] = new Array(this.OPM_LFOENTS);
			for (let i = 0; i < this.OPM_LFOENTS; i++) {
				let s, h;
				switch (t) {
				case 0:
					h = ((i + 256 & 511) / 2 | 0) - 128;
					s = 255 - (i / 2 | 0);
					break;
				case 1:
					s = 256 > i ? 255 : 0;
					h = 256 > i ? 127 : -128;
					break;
				case 2:
					h = i + 128 & 511;
					h = 256 > h ? h - 128 : 383 - h;
					s = 256 > i ? 255 - i : i - 256;
					break;
				case 3:
					3 & i || (e = 255 & ((32768 * Math.random() | 0) / 17 | 0));
					s = e;
					h = e - 128;
					break;
				}
				this.amtable[t][i] = s;
				this.pmtable[t][i] = -h - 1;
			}
		}
	}

	LFO() {
		let t;
		if (3 !== this.lfowaveform) {
			t = this.lfo_count_ >> 15 & 510;
			this.chip.SetPML(this.pmtable[this.lfowaveform][t] * (this.pmd / 128 | 0) + 128);
			this.chip.SetAML(this.amtable[this.lfowaveform][t] * (this.amd / 128 | 0));
		}
		else if ((-131072 & (this.lfo_count_ ^ this.lfo_count_prev_)) !== 0) {
			t = 255 & ((32768 * Math.random() | 0) / 17 | 0);
			this.chip.SetPML(((t - 128) * this.pmd / 128 | 0) + 128);
			this.chip.SetAML(t * this.amd / 128 | 0);
		}
		this.lfo_count_prev_ = this.lfo_count_;
		this.lfo_step_++;
		0 === (7 & this.lfo_step_) && (this.lfo_count_ += this.lfo_count_diff_);
	}

	Noise() {
		this.noisecount += 2 * this.rateratio;
		if (this.noisecount >= 32 << FM.FM_RATIOBITS) {
			let e = 32 - (31 & this.noisedelta);
			1 === e && (e = 2);
			this.noisecount = this.noisecount - (e << FM.FM_RATIOBITS);
			31 === (31 & this.noisedelta) && (this.noisecount -= FM.FM_RATIOBITS);
			this.noise = this.noise >> 1 ^ (1 & this.noise ? 33800 : 0);
		}
		return this.noise;
	}

	MixSub(t, e) {
		16384 & t && (e[this.pan[0]] = this.ch[0].Calc());
		4096 & t && (e[this.pan[1]] += this.ch[1].Calc());
		1024 & t && (e[this.pan[2]] += this.ch[2].Calc());
		256 & t && (e[this.pan[3]] += this.ch[3].Calc());
		64 & t && (e[this.pan[4]] += this.ch[4].Calc());
		16 & t && (e[this.pan[5]] += this.ch[5].Calc());
		4 & t && (e[this.pan[6]] += this.ch[6].Calc());
		1 & t && (128 & this.noisedelta ? e[this.pan[7]] += this.ch[7].CalcN(this.Noise()) : e[this.pan[7]] += this.ch[7].Calc());
	}

	MixSubL(t, e) {
		16384 & t && (e[this.pan[0]] = this.ch[0].CalcL());
		4096 & t && (e[this.pan[1]] += this.ch[1].CalcL());
		1024 & t && (e[this.pan[2]] += this.ch[2].CalcL());
		256 & t && (e[this.pan[3]] += this.ch[3].CalcL());
		64 & t && (e[this.pan[4]] += this.ch[4].CalcL());
		16 & t && (e[this.pan[5]] += this.ch[5].CalcL());
		4 & t && (e[this.pan[6]] += this.ch[6].CalcL());
		1 & t && (128 & this.noisedelta ? e[this.pan[7]] += this.ch[7].CalcLN(this.Noise()) : e[this.pan[7]] += this.ch[7].CalcL());
	}

	Mix(t, e, i, s) {
		let  h = 0, a = i + s;
		for (let o = 0; 8 > o; o++)
			h = h << 2 | this.ch[o].Prepare();
		2 & this.reg01 && (h &= 21845);
		let n = new Array(4);
		for (let o = i; a > o; o++) {
			n[1] = n[2] = n[3] = 0;
			this.LFO();
			43690 & h ? this.MixSubL(h, n) : this.MixSub(h, n);
			t[o] = (n[1] + n[3]) / 49152;
			e[o] = (n[2] + n[3]) / 49152;
		}
	}

	Intr(t) {
	}
}
