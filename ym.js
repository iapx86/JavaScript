/*
 *
 *	YM Sound Module
 *
 */

const LFOENTS = 256, CLENTS = 8192, OPSINBITS = 10, OPSINENTS = 1 << OPSINBITS, PGBITS = 9, RATIOBITS = 7, EG_BOTTOM = 955, OpType = {typeN: 0, typeM: 1};
export const YM = {RATIOBITS, OpType};

export class Channel4 {
	op = [new Operator, new Operator, new Operator, new Operator];
	fb = 0;
	buf = new Int32Array(4);
	in0;
	in1;
	out0;
	out1;
	out2;
	algo_ = 0;
	chip_ = null;
	pms = pmtable[0][0];

	constructor() { this.SetAlgorithm(0); }

	SetChip(t) { this.chip_ = t, this.op.forEach(op => op.SetChip(t)); }
	Reset() { this.op.forEach(op => op.Reset()); }

	Prepare() {
		this.op.forEach(op => op.Prepare()), this.pms = pmtable[this.op[0].type_][7 & this.op[0].ms_];
		let i = this.op[0].IsOn() | this.op[1].IsOn() | this.op[2].IsOn() | this.op[3].IsOn() ? 1 : 0;
		let s = this.op[0].ms_ & (this.op[0].amon_ | this.op[1].amon_ | this.op[2].amon_ | this.op[3].amon_ ? 55 : 7) ? 2 : 0;
		return i | s;
	}

	SetKCKF(t, i) {
		let h = 19 - (t >> 4 & 7), a = kctable[15 & t] + 2 & -4, o = a * kftable[63 & i] >> 19 << 19 - h, n = t >> 2 & 31;
		this.op.forEach(op => op.SetDPBN(o, n));
	}

	KeyControl(t) {
		1 & t ? this.op[0].KeyOn() : this.op[0].KeyOff(), 2 & t ? this.op[1].KeyOn() : this.op[1].KeyOff();
		4 & t ? this.op[2].KeyOn() : this.op[2].KeyOff(), 8 & t ? this.op[3].KeyOn() : this.op[3].KeyOff();
	}

	SetAlgorithm(t) { [this.in0, this.out0, this.in1, this.out1, , this.out2] = table1[t], this.op[0].ResetFB(), this.algo_ = t; }

	Calc() {
		let t = 0;
		switch (this.algo_) {
		case 0:
			return this.op[2].Calc(this.op[1].Out()), this.op[1].Calc(this.op[0].Out()), t = this.op[3].Calc(this.op[2].Out()), this.op[0].CalcFB(this.fb), t;
		case 1:
			return this.op[2].Calc(this.op[0].Out() + this.op[1].Out()), this.op[1].Calc(0), t = this.op[3].Calc(this.op[2].Out()), this.op[0].CalcFB(this.fb), t;
		case 2:
			return this.op[2].Calc(this.op[1].Out()), this.op[1].Calc(0), t = this.op[3].Calc(this.op[0].Out() + this.op[2].Out()), this.op[0].CalcFB(this.fb), t;
		case 3:
			return this.op[2].Calc(0), this.op[1].Calc(this.op[0].Out()), t = this.op[3].Calc(this.op[1].Out() + this.op[2].Out()), this.op[0].CalcFB(this.fb), t;
		case 4:
			return this.op[2].Calc(0), t = this.op[1].Calc(this.op[0].Out()), t += this.op[3].Calc(this.op[2].Out()), this.op[0].CalcFB(this.fb), t;
		case 5:
			return t = this.op[2].Calc(this.op[0].Out()), t += this.op[1].Calc(this.op[0].Out()), t += this.op[3].Calc(this.op[0].Out()), this.op[0].CalcFB(this.fb), t;
		case 6:
			return t = this.op[2].Calc(0), t += this.op[1].Calc(this.op[0].Out()), t += this.op[3].Calc(0), this.op[0].CalcFB(this.fb), t;
		case 7:
			return t = this.op[2].Calc(0), t += this.op[1].Calc(0), t += this.op[3].Calc(0), t += this.op[0].CalcFB(this.fb), t;
		}
		return t;
	}

	CalcL() {
		this.chip_.SetPMV(this.pms[this.chip_.GetPML()]);
		let t = 0;
		switch (this.algo_) {
		case 0:
			return this.op[2].CalcL(this.op[1].Out()), this.op[1].CalcL(this.op[0].Out()), t = this.op[3].CalcL(this.op[2].Out()), this.op[0].CalcFBL(this.fb), t;
		case 1:
			return this.op[2].CalcL(this.op[0].Out() + this.op[1].Out()), this.op[1].CalcL(0), t = this.op[3].CalcL(this.op[2].Out()), this.op[0].CalcFBL(this.fb), t;
		case 2:
			return this.op[2].CalcL(this.op[1].Out()), this.op[1].CalcL(0), t = this.op[3].CalcL(this.op[0].Out() + this.op[2].Out()), this.op[0].CalcFBL(this.fb), t;
		case 3:
			return this.op[2].CalcL(0), this.op[1].CalcL(this.op[0].Out()), t = this.op[3].CalcL(this.op[1].Out() + this.op[2].Out()), this.op[0].CalcFBL(this.fb), t;
		case 4:
			return this.op[2].CalcL(0), t = this.op[1].CalcL(this.op[0].Out()), t += this.op[3].CalcL(this.op[2].Out()), this.op[0].CalcFBL(this.fb), t;
		case 5:
			return t = this.op[2].CalcL(this.op[0].Out()), t += this.op[1].CalcL(this.op[0].Out()), t += this.op[3].CalcL(this.op[0].Out()), this.op[0].CalcFBL(this.fb), t;
		case 6:
			return t = this.op[2].CalcL(0), t += this.op[1].CalcL(this.op[0].Out()), t += this.op[3].CalcL(0), this.op[0].CalcFBL(this.fb), t;
		case 7:
			return t = this.op[2].CalcL(0), t += this.op[1].CalcL(0), t += this.op[3].CalcL(0), t += this.op[0].CalcFBL(this.fb), t;
		}
		return t;
	}

	CalcN(t) {
		this.buf[1] = this.buf[2] = this.buf[3] = 0, this.buf[0] = this.op[0].out_, this.op[0].CalcFB(this.fb);
		this.buf[this.out0] += this.op[1].Calc(this.buf[this.in0]), this.buf[this.out1] += this.op[2].Calc(this.buf[this.in1]);
		let e = this.op[3].out_;
		this.op[3].CalcN(t);
		return this.buf[this.out2] + e;
	}

	CalcLN(t) {
		this.chip_.SetPMV(this.pms[this.chip_.GetPML()]);
		this.buf[1] = this.buf[2] = this.buf[3] = 0, this.buf[0] = this.op[0].out_, this.op[0].CalcFBL(this.fb);
		this.buf[this.out0] += this.op[1].CalcL(this.buf[this.in0]), this.buf[this.out1] += this.op[2].CalcL(this.buf[this.in1]);
		let e = this.op[3].out_;
		this.op[3].CalcN(t);
		return this.buf[this.out2] + e;
	}

	SetType(t) { this.op.forEach(op => op.type_ = t); }
	SetFB(t) { this.fb = fbtable[t]; }
	SetMS(t) { this.op.forEach(op => op.SetMS(t)); }
	Mute(t) { this.op.forEach(op => op.Mute(t)); }
	SetFNum(t) { this.op.forEach(op => op.SetFNum(t)); }
	Refresh() { this.op.forEach(op => op.param_changed_ = true); }
}

const kctable = Int32Array.of(5197, 5506, 5833, 6180, 6180, 6547, 6937, 7349, 7349, 7786, 8249, 8740, 8740, 9259, 9810, 10394);
const table1 = [
	[ 0, 1, 1, 2, 2, 3], [ 1, 0, 0, 1, 1, 2], [ 1, 1, 1, 0, 0, 2], [ 0, 1, 2, 1, 1, 2],
	[ 0, 1, 2, 2, 2, 1], [ 0, 1, 0, 1, 0, 1], [ 0, 1, 2, 1, 2, 1], [ 1, 0, 1, 0, 1, 0],
];
const fbtable = Int8Array.of(31, 7, 6, 5, 4, 3, 2, 1);
const kftable = new Int32Array(64);

void function () {
	for (let t = 0; 64 > t; t++)
		kftable[t] = 65536 * Math.pow(2, t / 768);
}();

export class Chip {
	aml_ = 0;
	pml_ = 0;
	pmv_ = 0;

	SetAML(e) { this.aml_ = e & LFOENTS - 1; }
	SetPML(e) { this.pml_ = e & LFOENTS - 1; }
	SetPMV(t) { this.pmv_ = t; }
	GetAML() { return this.aml_; }
	GetPML() { return this.pml_; }
	GetPMV() { return this.pmv_; }
}

class Operator {
	chip_ = null;
	type_ = 0;
	out_ = 0;
	out2_ = 0;
	dp_ = 0;
	detune_ = 0;
	detune2_ = 0;
	multiple_ = 0;
	pg_count_ = 0;
	pg_diff_ = 0;
	pg_diff_lfo_ = 0;
	bn_ = 0;
	eg_level_ = 0;
	eg_level_on_next_phase_ = 0;
	eg_count_ = 0;
	eg_count_diff_ = 0;
	eg_out_ = 0;
	tl_out_ = 0;
	eg_rate_ = 0;
	eg_curve_count_ = 0;
	ssg_offset_ = 0;
	ssg_vector_ = 0;
	ssg_phase_ = 0;
	key_scale_rate_ = 0;
	eg_phase_ = 'next';
	ms_ = 0;
	tl_ = 0;
	tl_latch_ = 0;
	ar_ = 0;
	dr_ = 0;
	sr_ = 0;
	sl_ = 0;
	rr_ = 0;
	ks_ = 0;
	ssg_type_ = 0;
	keyon_ = false;
	amon_ = false;
	param_changed_ = false;
	mute_ = false;
	ams_ = amtable[0][0];

	SetChip(t) { this.chip_ = t; }

	Reset() {
		this.tl_ = this.tl_latch_ = 127, this.ShiftPhase('off'), this.eg_count_ = this.eg_curve_count_ = this.ssg_phase_ = 0;
		this.pg_count_ = this.out_ = this.out2_ = 0, this.param_changed_ = true;
	}

	SetDPBN(t, e) { this.dp_ = t, this.bn_ = e, this.param_changed_ = true; }

	Prepare() {
		if (this.param_changed_) {
			this.param_changed_ = false, this.pg_diff_ = (this.dp_ + dttable[this.detune_ + this.bn_]) * multable[this.detune2_][this.multiple_];
			this.pg_diff_lfo_ = this.pg_diff_ >> 11, this.key_scale_rate_ = this.bn_ >> 3 - this.ks_, this.tl_out_ = this.mute_ ? 1023 : 8 * this.tl_;
			switch (this.eg_phase_) {
			case 'attack':
				this.SetEGRate(this.ar_ ? Math.min(63, this.ar_ + this.key_scale_rate_) : 0);
				break;
			case 'decay':
				this.SetEGRate(this.dr_ ? Math.min(63, this.dr_ + this.key_scale_rate_) : 0), this.eg_level_on_next_phase_ = 8 * this.sl_;
				break;
			case 'sustain':
				this.SetEGRate(this.sr_ ? Math.min(63, this.sr_ + this.key_scale_rate_) : 0);
				break;
			case 'release':
				this.SetEGRate(Math.min(63, this.rr_ + this.key_scale_rate_));
				break;
			}
			if (this.ssg_type_ && 'release' !== this.eg_phase_) {
				let t = this.ar_ >= (this.ssg_type_ === 8 || this.ssg_type_ === 12 ? 56 : 60), e = ssgenvtable[this.ssg_type_ & 7][t][this.ssg_phase_];
				this.ssg_offset_ = 512 * e[0], this.ssg_vector_ = e[1];
			}
			this.ams_ = amtable[this.type_][this.amon_ ? this.ms_ >> 4 & 3 : 0], this.EGUpdate();
		}
	}

	ShiftPhase(i) {
		switch (i) {
		case 'attack':
			this.tl_ = this.tl_latch_;
			if (this.ssg_type_) {
				this.ssg_phase_ += 1;
				if (this.ssg_phase_ > 2)
					this.ssg_phase_ = 1;
				let s = this.ar_ >= (this.ssg_type_ === 8 || this.ssg_type_ === 12 ? 56 : 60), h = ssgenvtable[7 & this.ssg_type_][s][this.ssg_phase_];
				this.ssg_offset_ = h[0] * 0x200, this.ssg_vector_ = h[1];
			}
			if (62 > this.ar_ + this.key_scale_rate_) {
				this.SetEGRate(this.ar_ ? Math.min(63, this.ar_ + this.key_scale_rate_) : 0), this.eg_phase_ = 'attack';
				break;
			} // fallthrough
		case 'decay':
			if (this.sl_) {
				this.eg_level_ = 0, this.eg_level_on_next_phase_ = this.ssg_type_ ? Math.min(8 * this.sl_, 512) : 8 * this.sl_;
				this.SetEGRate(this.dr_ ? Math.min(63, this.dr_ + this.key_scale_rate_) : 0), this.eg_phase_ = 'decay';
				break;
			} // fallthrough
		case 'sustain':
			this.eg_level_ = 8 * this.sl_, this.eg_level_on_next_phase_ = this.ssg_type_ ? 512 : 1024;
			this.SetEGRate(this.sr_ ? Math.min(63, this.sr_ + this.key_scale_rate_) : 0), this.eg_phase_ = 'sustain';
			break;
		case 'release':
			if (this.ssg_type_)
				this.eg_level_ = this.eg_level_ * this.ssg_vector_ + this.ssg_offset_, this.ssg_vector_ = 1, this.ssg_offset_ = 0;
			if ('attack' === this.eg_phase_ || EG_BOTTOM > this.eg_level_) {
				this.eg_level_on_next_phase_ = 1024, this.SetEGRate(Math.min(63, this.rr_ + this.key_scale_rate_)), this.eg_phase_ = 'release';
				break;
			} // fallthrough
		default:
			this.eg_level_ = this.eg_level_on_next_phase_ = EG_BOTTOM, this.EGUpdate(), this.SetEGRate(0), this.eg_phase_ = 'off';
			break;
		}
	}

	LogToLin(i) { return CLENTS > i ? cltable[i] : 0; }

	EGUpdate() {
		if (!this.ssg_type_)
			this.eg_out_ = Math.min(this.tl_out_ + this.eg_level_, 1023) << 3;
		else
			this.eg_out_ = Math.min(this.tl_out_ + this.eg_level_ * this.ssg_vector_ + this.ssg_offset_, 1023) << 3;
	}

	SetEGRate(t) { this.eg_rate_ = t, this.eg_count_diff_ = decaytable2[t >> 2] << RATIOBITS; }

	EGCalc() {
		this.eg_count_ = 6141 << RATIOBITS;
		if ('attack' === this.eg_phase_) {
			let i = attacktable[this.eg_rate_][7 & this.eg_curve_count_];
			if (i >= 0)
				this.eg_level_ -= 1 + (this.eg_level_ >> i), this.eg_level_ <= 0 && this.ShiftPhase('decay');
			this.EGUpdate();
		} else {
			if (!this.ssg_type_) {
				this.eg_level_ += decaytable1[this.eg_rate_][7 & this.eg_curve_count_];
				if (this.eg_level_ >= this.eg_level_on_next_phase_)
					switch (this.eg_phase_) {
					case 'decay':
						this.ShiftPhase('sustain');
						break;
					case 'sustain':
						this.ShiftPhase('release');
						break;
					case 'release':
						this.ShiftPhase('off');
						break;
					}
				this.EGUpdate();
			} else {
				this.eg_level_ += 4 * decaytable1[this.eg_rate_][this.eg_curve_count_ & 7];
				if (this.eg_level_ >= this.eg_level_on_next_phase_) {
					this.EGUpdate();
					switch (this.eg_phase_) {
					case 'decay':
						this.ShiftPhase('sustain');
						break;
					case 'sustain':
						this.ShiftPhase('attack');
						break;
					case 'release':
						this.ShiftPhase('off');
						break;
					}
				}
			}
		}
		this.eg_curve_count_++;
	}

	EGStep() { this.eg_count_ -= this.eg_count_diff_, this.eg_count_ <= 0 && this.EGCalc(); }

	PGCalc() {
		let t = this.pg_count_;
		return this.pg_count_ += this.pg_diff_, t;
	}

	PGCalcL() {
		let t = this.pg_count_;
		return this.pg_count_ += this.pg_diff_ + (this.pg_diff_lfo_ * this.chip_.GetPMV() >> 5), t;
	}

	Calc(i) {
		this.EGStep(), this.out2_ = this.out_;
		let s = (this.PGCalc() >> 20 + PGBITS - OPSINBITS) + (i >> 11 - OPSINBITS);
		return this.out_ = this.LogToLin(this.eg_out_ + sinetable[s & OPSINENTS - 1]);
	}

	CalcL(i) {
		this.EGStep();
		let s = (this.PGCalcL() >> 20 + PGBITS - OPSINBITS) + (i >> 11 - OPSINBITS);
		return this.out_ = this.LogToLin(this.eg_out_ + sinetable[s & OPSINENTS - 1] + this.ams_[this.chip_.GetAML()]);
	}

	CalcN(t) {
		this.EGStep();
		let e = Math.max(0, 1023 - (this.tl_out_ + this.eg_level_)) << 1;
		return t = (t & 1) - 1, this.out_ = e + t ^ t;
	}

	CalcFB(i) {
		this.EGStep();
		let s = this.out_ + this.out2_;
		this.out2_ = this.out_;
		let h = this.PGCalc() >> 20 + PGBITS - OPSINBITS;
		31 > i && (h += s << 8 + PGBITS >> i >> 20 + PGBITS - OPSINBITS), this.out_ = this.LogToLin(this.eg_out_ + sinetable[h & OPSINENTS - 1]);
		return this.out2_;
	}

	CalcFBL(i) {
		this.EGStep();
		let s = this.out_ + this.out2_;
		this.out2_ = this.out_;
		let h = this.PGCalcL() >> 20 + PGBITS - OPSINBITS;
		31 > i && (h += s << 8 + PGBITS >> i >> 20 + PGBITS - OPSINBITS);
		return this.out_ = this.LogToLin(this.eg_out_ + sinetable[h & OPSINENTS - 1] + this.ams_[this.chip_.GetAML()]);
	}

	ResetFB() { this.out_ = this.out2_ = 0; }

	KeyOn() {
		if (!this.keyon_) {
			this.keyon_ = true;
			if (this.eg_phase_ === 'off' || this.eg_phase_ === 'release')
				this.ssg_phase_ = -1, this.ShiftPhase('attack'), this.EGUpdate(), this.out_ = this.out2_ = this.pg_count_ = 0;
		}
	}

	KeyOff() {
		if (this.keyon_)
			this.keyon_ = false, this.ShiftPhase('release');
	}

	IsOn() { return this.eg_phase_ !== 'off'; }
	SetDT(t) { this.detune_ = 32 * t, this.param_changed_ = true; }
	SetDT2(t) { this.detune2_ = 3 & t, this.param_changed_ = true; }
	SetMULTI(t) { this.multiple_ = t, this.param_changed_ = true; }
	SetTL(t, e) { !e && (this.tl_ = t, this.param_changed_ = true), this.tl_latch_ = t; }
	SetAR(t) { this.ar_ = t, this.param_changed_ = true; }
	SetDR(t) { this.dr_ = t, this.param_changed_ = true; }
	SetSR(t) { this.sr_ = t, this.param_changed_ = true; }
	SetSL(t) { this.sl_ = t, this.param_changed_ = true; }
	SetRR(t) { this.rr_ = t, this.param_changed_ = true; }
	SetKS(t) { this.ks_ = t, this.param_changed_ = true; }
	SetAMON(t) { this.amon_ = t, this.param_changed_ = true; }
	Mute(t) { this.mute_ = t, this.param_changed_ = true; }
	SetMS(t) { this.ms_ = t, this.param_changed_ = true; }
	Out() { return this.out_; }
	SetSSGEC(t) { this.ssg_type_ = t & 8 ? t : 0; }
	SetFNum(t) { this.dp_ = (t & 2047) << (t >> 11 & 7), this.bn_ = notetable[t >> 7 & 127], this.param_changed_ = true; }
}

const notetable = Int8Array.of(
	 0,  0,  0,  0,  0,  0,  0,  1,  2,  3,  3,  3,  3,  3,  3,  3,  4,  4,  4,  4,  4,  4,  4,  5,  6,  7,  7,  7,  7,  7,  7,  7,
	 8,  8,  8,  8,  8,  8,  8,  9, 10, 11, 11, 11, 11, 11, 11, 11, 12, 12, 12, 12, 12, 12, 12, 13, 14, 15, 15, 15, 15, 15, 15, 15,
	16, 16, 16, 16, 16, 16, 16, 17, 18, 19, 19, 19, 19, 19, 19, 19, 20, 20, 20, 20, 20, 20, 20, 21, 22, 23, 23, 23, 23, 23, 23, 23,
	24, 24, 24, 24, 24, 24, 24, 25, 26, 27, 27, 27, 27, 27, 27, 27, 28, 28, 28, 28, 28, 28, 28, 29, 30, 31, 31, 31, 31, 31, 31, 31,
);
const dttable = Int8Array.of(
	 0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
	 0,  0,  0,  0,  2,  2,  2,  2,  2,  2,  2,  2,  4,  4,  4,  4,  4,  6,  6,  6,  8,  8,  8, 10, 10, 12, 12, 14, 16, 16, 16, 16,
	 2,  2,  2,  2,  4,  4,  4,  4,  4,  6,  6,  6,  8,  8,  8, 10, 10, 12, 12, 14, 16, 16, 18, 20, 22, 24, 26, 28, 32, 32, 32, 32,
	 4,  4,  4,  4,  4,  6,  6,  6,  8,  8,  8, 10, 10, 12, 12, 14, 16, 16, 18, 20, 22, 24, 26, 28, 32, 34, 38, 40, 44, 44, 44, 44,
	 0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
	 0,  0,  0,  0, -2, -2, -2, -2, -2, -2, -2, -2, -4, -4, -4, -4, -4, -6, -6, -6, -8, -8, -8,-10,-10,-12,-12,-14,-16,-16,-16,-16,
	-2, -2, -2, -2, -4, -4, -4, -4, -4, -6, -6, -6, -8, -8, -8,-10,-10,-12,-12,-14,-16,-16,-18,-20,-22,-24,-26,-28,-32,-32,-32,-32,
	-4, -4, -4, -4, -4, -6, -6, -6, -8, -8, -8,-10,-10,-12,-12,-14,-16,-16,-18,-20,-22,-24,-26,-28,-32,-34,-38,-40,-44,-44,-44,-44,
);
const decaytable1 = [
	[ 0, 0, 0, 0, 0, 0, 0, 0], [ 0, 0, 0, 0, 0, 0, 0, 0], [ 1, 1, 1, 1, 1, 1, 1, 1], [ 1, 1, 1, 1, 1, 1, 1, 1],
	[ 1, 1, 1, 1, 1, 1, 1, 1], [ 1, 1, 1, 1, 1, 1, 1, 1], [ 1, 1, 1, 0, 1, 1, 1, 0], [ 1, 1, 1, 0, 1, 1, 1, 0],
	[ 1, 0, 1, 0, 1, 0, 1, 0], [ 1, 1, 1, 0, 1, 0, 1, 0], [ 1, 1, 1, 0, 1, 1, 1, 0], [ 1, 1, 1, 1, 1, 1, 1, 0],
	[ 1, 0, 1, 0, 1, 0, 1, 0], [ 1, 1, 1, 0, 1, 0, 1, 0], [ 1, 1, 1, 0, 1, 1, 1, 0], [ 1, 1, 1, 1, 1, 1, 1, 0],
	[ 1, 0, 1, 0, 1, 0, 1, 0], [ 1, 1, 1, 0, 1, 0, 1, 0], [ 1, 1, 1, 0, 1, 1, 1, 0], [ 1, 1, 1, 1, 1, 1, 1, 0],
	[ 1, 0, 1, 0, 1, 0, 1, 0], [ 1, 1, 1, 0, 1, 0, 1, 0], [ 1, 1, 1, 0, 1, 1, 1, 0], [ 1, 1, 1, 1, 1, 1, 1, 0],
	[ 1, 0, 1, 0, 1, 0, 1, 0], [ 1, 1, 1, 0, 1, 0, 1, 0], [ 1, 1, 1, 0, 1, 1, 1, 0], [ 1, 1, 1, 1, 1, 1, 1, 0],
	[ 1, 0, 1, 0, 1, 0, 1, 0], [ 1, 1, 1, 0, 1, 0, 1, 0], [ 1, 1, 1, 0, 1, 1, 1, 0], [ 1, 1, 1, 1, 1, 1, 1, 0],
	[ 1, 0, 1, 0, 1, 0, 1, 0], [ 1, 1, 1, 0, 1, 0, 1, 0], [ 1, 1, 1, 0, 1, 1, 1, 0], [ 1, 1, 1, 1, 1, 1, 1, 0],
	[ 1, 0, 1, 0, 1, 0, 1, 0], [ 1, 1, 1, 0, 1, 0, 1, 0], [ 1, 1, 1, 0, 1, 1, 1, 0], [ 1, 1, 1, 1, 1, 1, 1, 0],
	[ 1, 0, 1, 0, 1, 0, 1, 0], [ 1, 1, 1, 0, 1, 0, 1, 0], [ 1, 1, 1, 0, 1, 1, 1, 0], [ 1, 1, 1, 1, 1, 1, 1, 0],
	[ 1, 0, 1, 0, 1, 0, 1, 0], [ 1, 1, 1, 0, 1, 0, 1, 0], [ 1, 1, 1, 0, 1, 1, 1, 0], [ 1, 1, 1, 1, 1, 1, 1, 0],
	[ 1, 1, 1, 1, 1, 1, 1, 1], [ 2, 1, 1, 1, 2, 1, 1, 1], [ 2, 1, 2, 1, 2, 1, 2, 1], [ 2, 2, 2, 1, 2, 2, 2, 1],
	[ 2, 2, 2, 2, 2, 2, 2, 2], [ 4, 2, 2, 2, 4, 2, 2, 2], [ 4, 2, 4, 2, 4, 2, 4, 2], [ 4, 4, 4, 2, 4, 4, 4, 2],
	[ 4, 4, 4, 4, 4, 4, 4, 4], [ 8, 4, 4, 4, 8, 4, 4, 4], [ 8, 4, 8, 4, 8, 4, 8, 4], [ 8, 8, 8, 4, 8, 8, 8, 4],
	[16,16,16,16,16,16,16,16], [16,16,16,16,16,16,16,16], [16,16,16,16,16,16,16,16], [16,16,16,16,16,16,16,16],
];
const decaytable2 = Int32Array.of(1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2047, 2047, 2047, 2047, 2047);
const attacktable = [
	[-1,-1,-1,-1,-1,-1,-1,-1], [-1,-1,-1,-1,-1,-1,-1,-1], [ 4, 4, 4, 4, 4, 4, 4, 4], [ 4, 4, 4, 4, 4, 4, 4, 4],
	[ 4, 4, 4, 4, 4, 4, 4, 4], [ 4, 4, 4, 4, 4, 4, 4, 4], [ 4, 4, 4,-1, 4, 4, 4,-1], [ 4, 4, 4,-1, 4, 4, 4,-1],
	[ 4,-1, 4,-1, 4,-1, 4,-1], [ 4, 4, 4,-1, 4,-1, 4,-1], [ 4, 4, 4,-1, 4, 4, 4,-1], [ 4, 4, 4, 4, 4, 4, 4,-1],
	[ 4,-1, 4,-1, 4,-1, 4,-1], [ 4, 4, 4,-1, 4,-1, 4,-1], [ 4, 4, 4,-1, 4, 4, 4,-1], [ 4, 4, 4, 4, 4, 4, 4,-1],
	[ 4,-1, 4,-1, 4,-1, 4,-1], [ 4, 4, 4,-1, 4,-1, 4,-1], [ 4, 4, 4,-1, 4, 4, 4,-1], [ 4, 4, 4, 4, 4, 4, 4,-1],
	[ 4,-1, 4,-1, 4,-1, 4,-1], [ 4, 4, 4,-1, 4,-1, 4,-1], [ 4, 4, 4,-1, 4, 4, 4,-1], [ 4, 4, 4, 4, 4, 4, 4,-1],
	[ 4,-1, 4,-1, 4,-1, 4,-1], [ 4, 4, 4,-1, 4,-1, 4,-1], [ 4, 4, 4,-1, 4, 4, 4,-1], [ 4, 4, 4, 4, 4, 4, 4,-1],
	[ 4,-1, 4,-1, 4,-1, 4,-1], [ 4, 4, 4,-1, 4,-1, 4,-1], [ 4, 4, 4,-1, 4, 4, 4,-1], [ 4, 4, 4, 4, 4, 4, 4,-1],
	[ 4,-1, 4,-1, 4,-1, 4,-1], [ 4, 4, 4,-1, 4,-1, 4,-1], [ 4, 4, 4,-1, 4, 4, 4,-1], [ 4, 4, 4, 4, 4, 4, 4,-1],
	[ 4,-1, 4,-1, 4,-1, 4,-1], [ 4, 4, 4,-1, 4,-1, 4,-1], [ 4, 4, 4,-1, 4, 4, 4,-1], [ 4, 4, 4, 4, 4, 4, 4,-1],
	[ 4,-1, 4,-1, 4,-1, 4,-1], [ 4, 4, 4,-1, 4,-1, 4,-1], [ 4, 4, 4,-1, 4, 4, 4,-1], [ 4, 4, 4, 4, 4, 4, 4,-1],
	[ 4,-1, 4,-1, 4,-1, 4,-1], [ 4, 4, 4,-1, 4,-1, 4,-1], [ 4, 4, 4,-1, 4, 4, 4,-1], [ 4, 4, 4, 4, 4, 4, 4,-1],
	[ 4, 4, 4, 4, 4, 4, 4, 4], [ 3, 4, 4, 4, 3, 4, 4, 4], [ 3, 4, 3, 4, 3, 4, 3, 4], [ 3, 3, 3, 4, 3, 3, 3, 4],
	[ 3, 3, 3, 3, 3, 3, 3, 3], [ 2, 3, 3, 3, 2, 3, 3, 3], [ 2, 3, 2, 3, 2, 3, 2, 3], [ 2, 2, 2, 3, 2, 2, 2, 3],
	[ 2, 2, 2, 2, 2, 2, 2, 2], [ 1, 2, 2, 2, 1, 2, 2, 2], [ 1, 2, 1, 2, 1, 2, 1, 2], [ 1, 1, 1, 2, 1, 1, 1, 2],
	[ 0, 0, 0, 0, 0, 0, 0, 0], [ 0, 0, 0, 0, 0, 0, 0, 0], [ 0, 0, 0, 0, 0, 0, 0, 0], [ 0, 0, 0, 0, 0, 0, 0, 0],
];
const ssgenvtable = [
	[[[1, 1], [1, 1], [1, 1]], [[0, 1], [1, 1], [1, 1]]], [[[0, 1], [2, 0], [2, 0]], [[0, 1], [2, 0], [2, 0]]],
	[[[1,-1], [0, 1], [1,-1]], [[0, 1], [1,-1], [0, 1]]], [[[1,-1], [0, 0], [0, 0]], [[0, 1], [0, 0], [0, 0]]],
	[[[2,-1], [2,-1], [2,-1]], [[1,-1], [2,-1], [2,-1]]], [[[1,-1], [0, 0], [0, 0]], [[1,-1], [0, 0], [0, 0]]],
	[[[0, 1], [1,-1], [0, 1]], [[1,-1], [0, 1], [1,-1]]], [[[0, 1], [2, 0], [2, 0]], [[1,-1], [2, 0], [2, 0]]],
];
const sinetable = new Int32Array(OPSINENTS);
const cltable = new Int32Array(CLENTS);
const multable = [new Int32Array(16), new Int32Array(16), new Int32Array(16), new Int32Array(16)];

void function () {
	let s = 0;
	for (let i = 0; 256 > i; i++) {
		let h = Math.floor(Math.pow(2, 13 - i / 256));
		h = h + 2 & -4, cltable[s++] = h, cltable[s++] = -h;
	}
	for (; s < CLENTS;)
		cltable[s] = cltable[s - 512] / 2, s++;
	for (let i = 0; i < OPSINENTS / 2; i++) {
		let a = (2 * i + 1) * Math.PI / OPSINENTS, o = -256 * Math.log2(Math.sin(a));
		let n = Math.floor(o + .5) + 1;
		sinetable[i] = 2 * n, sinetable[OPSINENTS / 2 + i] = 2 * n + 1;
	}
	for (let e = 0; 4 > e; e++)
		for (let i = 0; 16 > i; i++)
			multable[e][i] = [1, 1.414, 1.581, 1.732][e] * (1 << RATIOBITS) / (1 << 2 + RATIOBITS - PGBITS) * (i ? 2 * i : 1);
}();

const pmtable = new Array(2), amtable = new Array(2);

void function () {
	let e, i;
	const s = [[0, 1 / 360, 2 / 360, 3 / 360, 4 / 360, 6 / 360, 12 / 360, 24 / 360], [0, 1 / 480, 2 / 480, 4 / 480, 10 / 480, 20 / 480, 80 / 480, 140 / 480]];
	const h = [[31, 6, 4, 3], [31, 2, 1, 0]];
	for (let a = 0; 2 > a; a++) {
		for (pmtable[a] = new Array(8), e = 0; 8 > e; e++) {
			let o = s[a][e];
			for (pmtable[a][e] = new Int32Array(LFOENTS), i = 0; i < LFOENTS; i++) {
				let n = .6 * o * Math.sin(2 * i * Math.PI / LFOENTS) + 1;
				pmtable[a][e][i] = 65536 * (n - 1);
			}
		}
		for (amtable[a] = new Array(4), e = 0; 4 > e; e++)
			for (amtable[a][e] = new Int32Array(LFOENTS), i = 0; i < LFOENTS; i++)
				amtable[a][e][i] = 4 * i >> h[a][e] << 3;
	}
}();
