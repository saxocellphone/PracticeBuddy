//! Core pitch detection algorithm.
//!
//! Inspired by lingot (<https://github.com/ibancg/lingot>).
//!
//! Pipeline: Decimation → Hamming window → FFT → SPD → Noise floor → SNR →
//! Peak detection → Quinn-2 interpolation → Harmonic grouping →
//! Newton-Raphson DTFT refinement → Frequency locker.

use std::f64::consts::PI;
use rustfft::{FftPlanner, num_complex::Complex};

// ---------------------------------------------------------------------------
// Configuration constants
// ---------------------------------------------------------------------------

const PEAK_NUMBER: usize = 8;
const MAX_DIVISOR: usize = 4;
const MAX_NR_ITER: usize = 10;
const NR_CONVERGENCE: f64 = 1e-4;

// Noise floor estimation
const NOISE_FILTER_C: f64 = 0.1;
const NOISE_FILTER_WIDTH_HZ: f64 = 150.0;

// Peak / harmonic quality thresholds
const RATIO_TOL: f64 = 0.02;
const MIN_OVERALL_SNR: f64 = 20.0;
const MIN_SNR_DB: f64 = 10.0;
const PEAK_PRUNE_DB: f64 = 20.0;
const HARMONIC_BIAS: f64 = 1.5;

// Frequency locker
const NHITS_TO_LOCK: u32 = 4;
const NHITS_TO_UNLOCK: u32 = 5;
const NHITS_TO_RELOCK: u32 = 6;
const NHITS_TO_RELOCK_UP: u32 = 8;
const FREQ_RELATION_TOL: f64 = 0.05;

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

fn hamming_window(size: usize) -> Vec<f64> {
    if size <= 1 {
        return vec![1.0; size];
    }
    (0..size)
        .map(|i| 0.53836 - 0.46164 * (2.0 * PI * i as f64 / (size - 1) as f64).cos())
        .collect()
}

/// Largest power of 2 ≤ n.
fn prev_pow2(n: usize) -> usize {
    if n == 0 {
        return 0;
    }
    1 << (usize::BITS - 1 - n.leading_zeros())
}

// ---------------------------------------------------------------------------
// Quinn's second estimator
// ---------------------------------------------------------------------------

/// Quinn's τ helper (defined for x ≥ 0).
fn quinn_tau(x: f64) -> f64 {
    const SQRT_2_3: f64 = 0.816_496_580_927_726;
    const COEFF: f64 = 0.102_062_072_615_966; // √6 / 24
    let inner = 3.0 * x * x + 6.0 * x + 1.0;
    if inner <= 0.0 {
        return 0.0;
    }
    let numer = x + 1.0 - SQRT_2_3;
    let denom = x + 1.0 + SQRT_2_3;
    if numer.abs() < 1e-30 || denom.abs() < 1e-30 {
        return 0.0;
    }
    0.25 * inner.ln() - COEFF * (numer / denom).abs().ln()
}

/// Sub-bin frequency interpolation using Quinn's second estimator.
fn quinn_interpolate(fft: &[Complex<f64>], bin: usize, delta_f: f64, half: usize) -> f64 {
    if bin == 0 || bin + 1 >= half {
        return bin as f64 * delta_f;
    }
    let y1 = fft[bin - 1];
    let y2 = fft[bin];
    let y3 = fft[bin + 1];
    if y2.norm_sqr() < 1e-30 {
        return bin as f64 * delta_f;
    }
    let ap = (y3 / y2).re;
    let dp = -ap / (1.0 - ap);
    let am = (y1 / y2).re;
    let dm = am / (1.0 - am);
    let delta = 0.5 * (dp + dm) + quinn_tau(dp * dp) - quinn_tau(dm * dm);
    (bin as f64 + delta) * delta_f
}

// ---------------------------------------------------------------------------
// SPD and DTFT derivatives (for Newton-Raphson)
// ---------------------------------------------------------------------------

/// Evaluate SPD and its first two derivatives at angular frequency `w`.
fn spd_derivatives(signal: &[f64], w: f64) -> (f64, f64, f64) {
    let n = signal.len();
    let (mut sc, mut ss) = (0.0, 0.0);
    let (mut snc, mut sns) = (0.0, 0.0);
    let (mut sn2c, mut sn2s) = (0.0, 0.0);

    for (i, &x) in signal.iter().enumerate() {
        let wn = w * i as f64;
        let (sin_wn, cos_wn) = wn.sin_cos();
        let nf = i as f64;
        sc += x * cos_wn;
        ss += x * sin_wn;
        snc += x * cos_wn * nf;
        sns += x * sin_wn * nf;
        sn2c += x * cos_wn * nf * nf;
        sn2s += x * sin_wn * nf * nf;
    }

    let n2 = (n * n) as f64;
    let spd = (sc * sc + ss * ss) / n2;
    let d1 = 2.0 * (ss * snc - sc * sns) / n2;
    let d2 = 2.0 * (snc * snc - ss * sn2s + sns * sns - sc * sn2c) / n2;
    (spd, d1, d2)
}

// ---------------------------------------------------------------------------
// Frequency locker
// ---------------------------------------------------------------------------

/// Check if two frequencies are harmonically related (within tolerance).
/// Returns `(mult_for_f1, mult_for_f2)` that map each to the common fundamental.
fn frequencies_related(f1: f64, f2: f64) -> Option<(f64, f64)> {
    let (big, small, swapped) = if f1 >= f2 {
        (f1, f2, false)
    } else {
        (f2, f1, true)
    };
    if small < 1.0 {
        return None;
    }
    for d in 1..=MAX_DIVISOR as u32 {
        let ratio = big * d as f64 / small;
        let n = ratio.round();
        if n < 1.0 {
            continue;
        }
        let error = (ratio - n).abs();
        if error < FREQ_RELATION_TOL * n {
            let (m_big, m_small) = (1.0 / n, 1.0 / d as f64);
            return Some(if swapped {
                (m_small, m_big)
            } else {
                (m_big, m_small)
            });
        }
    }
    None
}

pub(crate) struct FrequencyLocker {
    locked: bool,
    current_freq: f64,
    fail_counter: u32,
    lock_counter: u32,
    rehit_counter: u32,
    rehit_up_counter: u32,
    last_rehit_mult: f64,
}

impl FrequencyLocker {
    pub fn new() -> Self {
        Self {
            locked: false,
            current_freq: 0.0,
            fail_counter: 0,
            lock_counter: 0,
            rehit_counter: 0,
            rehit_up_counter: 0,
            last_rehit_mult: 0.0,
        }
    }

    /// Feed a new reading. Returns the stable output frequency (0 = not locked).
    pub fn update(&mut self, freq: f64) -> f64 {
        if freq <= 0.0 {
            return self.handle_miss();
        }
        if self.locked {
            self.handle_locked(freq)
        } else {
            self.handle_unlocked(freq)
        }
    }

    fn handle_miss(&mut self) -> f64 {
        if self.locked {
            self.fail_counter += 1;
            if self.fail_counter >= NHITS_TO_UNLOCK {
                self.locked = false;
                self.current_freq = 0.0;
                self.fail_counter = 0;
            }
            return self.current_freq;
        }
        self.lock_counter = 0;
        self.current_freq = 0.0;
        0.0
    }

    fn handle_unlocked(&mut self, freq: f64) -> f64 {
        if self.current_freq > 0.0 {
            if let Some((m1, _)) = frequencies_related(freq, self.current_freq) {
                if (m1 - 1.0).abs() < 0.1 {
                    self.current_freq = freq * m1;
                    self.lock_counter += 1;
                    if self.lock_counter >= NHITS_TO_LOCK {
                        self.locked = true;
                        self.lock_counter = 0;
                        self.fail_counter = 0;
                        return self.current_freq;
                    }
                    return 0.0;
                }
            }
        }
        self.current_freq = freq;
        self.lock_counter = 1;
        0.0
    }

    fn handle_locked(&mut self, freq: f64) -> f64 {
        if let Some((m1, m2)) = frequencies_related(freq, self.current_freq) {
            let corrected = freq * m1;

            if (m2 - 1.0).abs() < 0.1 {
                // Consistent with locked fundamental
                self.current_freq = corrected;
                self.fail_counter = 0;
                self.rehit_counter = 0;

                if (m1 - 1.0).abs() > 0.1 {
                    // Hearing a harmonic — track for potential octave jump
                    self.rehit_up_counter += 1;
                    if self.rehit_up_counter >= NHITS_TO_RELOCK_UP {
                        self.current_freq = freq;
                        self.rehit_up_counter = 0;
                    }
                } else {
                    self.rehit_up_counter = 0;
                }
                return self.current_freq;
            }

            // Harmonically related but different fundamental — track for hop
            if (m2 - self.last_rehit_mult).abs() < 0.1 {
                self.rehit_counter += 1;
            } else {
                self.rehit_counter = 1;
                self.last_rehit_mult = m2;
            }
            if self.rehit_counter >= NHITS_TO_RELOCK {
                self.current_freq = corrected;
                self.rehit_counter = 0;
                return self.current_freq;
            }
            return self.current_freq;
        }

        // Not related — increment fail counter
        self.fail_counter += 1;
        if self.fail_counter >= NHITS_TO_UNLOCK {
            self.locked = false;
            self.current_freq = 0.0;
            self.fail_counter = 0;
            return 0.0;
        }
        self.current_freq
    }
}

// ---------------------------------------------------------------------------
// Spectral peak
// ---------------------------------------------------------------------------

#[derive(Clone)]
struct Peak {
    bin: usize,
    freq: f64,
    snr_db: f64,
}

// ---------------------------------------------------------------------------
// PitchDetectorCore
// ---------------------------------------------------------------------------

pub struct PitchDetectorCore {
    effective_sr: f64,
    oversampling: usize,
    fft_size: usize,
    internal_min_freq: f64,
    peak_half_width: usize,

    fft_window: Vec<f64>,
    locker: FrequencyLocker,
    prev_freq: f64,
}

impl PitchDetectorCore {
    pub fn new(sample_rate: f64, buffer_size: usize, min_freq: f64, max_freq: f64) -> Self {
        let internal_min_freq = 0.8 * min_freq;
        let internal_max_freq = 3.1 * max_freq;

        let oversampling = ((0.5 * sample_rate / internal_max_freq) as usize).max(1);
        let effective_sr = sample_rate / oversampling as f64;

        // FFT size: largest power-of-2 that fits in available decimated data, capped at 2048
        let decimated_len = buffer_size / oversampling;
        let max_samples = decimated_len.min((0.3 * effective_sr) as usize).min(2048);
        let fft_size = prev_pow2(max_samples).max(256);
        let peak_half_width = if fft_size > 256 { 2 } else { 1 };

        PitchDetectorCore {
            effective_sr,
            oversampling,
            fft_size,
            internal_min_freq,
            peak_half_width,
            fft_window: hamming_window(fft_size),
            locker: FrequencyLocker::new(),
            prev_freq: 0.0,
        }
    }

    /// Main entry point. Returns `(frequency_hz, quality_snr_db)` or `None`.
    pub fn detect(&mut self, audio_data: &[f64]) -> Option<(f64, f64)> {
        // 1. Decimate
        let decimated: Vec<f64> = if self.oversampling > 1 {
            (0..audio_data.len() / self.oversampling)
                .map(|i| audio_data[i * self.oversampling])
                .collect()
        } else {
            audio_data.to_vec()
        };

        if decimated.len() < self.fft_size {
            let locked = self.locker.update(0.0);
            return if locked > 0.0 { Some((locked, 0.0)) } else { None };
        }

        let temporal_len = decimated.len();

        // 2. Window the last fft_size samples for FFT
        let fft_start = temporal_len - self.fft_size;
        let windowed_fft: Vec<f64> = decimated[fft_start..]
            .iter()
            .zip(&self.fft_window)
            .map(|(s, w)| s * w)
            .collect();

        // 3. Window the full temporal buffer for Newton-Raphson refinement
        let temporal_win = hamming_window(temporal_len);
        let windowed_temporal: Vec<f64> = decimated
            .iter()
            .zip(&temporal_win)
            .map(|(s, w)| s * w)
            .collect();

        // 4. FFT → SPD
        let (spd, fft_complex) = self.compute_fft_spd(&windowed_fft);

        // 5. dB conversion
        let spl: Vec<f64> = spd
            .iter()
            .map(|&p| if p > 1e-20 { 10.0 * p.log10() } else { -200.0 })
            .collect();

        // 6. Noise floor estimation
        let noise = self.estimate_noise(&spl);

        // 7. SNR
        let snr: Vec<f64> = spl.iter().zip(&noise).map(|(s, n)| s - n).collect();

        // 8. Peak detection + Quinn interpolation
        let delta_f = self.effective_sr / self.fft_size as f64;
        let peaks = self.find_peaks(&snr, &fft_complex, delta_f);

        if peaks.is_empty() {
            let locked = self.locker.update(0.0);
            return if locked > 0.0 { Some((locked, 0.0)) } else { None };
        }

        // 9. Harmonic grouping → best fundamental candidate
        let (raw_freq, quality, divisor) = self.find_fundamental(&peaks, delta_f);

        if raw_freq <= 0.0 || quality < MIN_OVERALL_SNR {
            let locked = self.locker.update(0.0);
            return if locked > 0.0 { Some((locked, quality)) } else { None };
        }

        // 10. Newton-Raphson DTFT refinement (two stages)
        let w0 = 2.0 * PI * raw_freq / self.effective_sr;
        let refined_w = newton_raphson(&windowed_fft, w0);
        let final_w = if refined_w > 0.0 {
            newton_raphson(&windowed_temporal, refined_w)
        } else {
            0.0
        };

        let final_freq = if final_w > 0.0 {
            final_w * self.effective_sr / (divisor as f64 * 2.0 * PI)
        } else if refined_w > 0.0 {
            refined_w * self.effective_sr / (divisor as f64 * 2.0 * PI)
        } else {
            raw_freq / divisor as f64
        };

        // 11. Frequency locker
        let locked = self.locker.update(final_freq);
        if locked > 0.0 {
            self.prev_freq = locked;
            Some((locked, quality))
        } else {
            None
        }
    }

    /// Detect without the frequency locker (for testing / low-latency use).
    pub fn detect_raw(&mut self, audio_data: &[f64]) -> Option<(f64, f64)> {
        let decimated: Vec<f64> = if self.oversampling > 1 {
            (0..audio_data.len() / self.oversampling)
                .map(|i| audio_data[i * self.oversampling])
                .collect()
        } else {
            audio_data.to_vec()
        };

        if decimated.len() < self.fft_size {
            return None;
        }

        let temporal_len = decimated.len();
        let fft_start = temporal_len - self.fft_size;
        let windowed_fft: Vec<f64> = decimated[fft_start..]
            .iter()
            .zip(&self.fft_window)
            .map(|(s, w)| s * w)
            .collect();

        let temporal_win = hamming_window(temporal_len);
        let windowed_temporal: Vec<f64> = decimated
            .iter()
            .zip(&temporal_win)
            .map(|(s, w)| s * w)
            .collect();

        let (spd, fft_complex) = self.compute_fft_spd(&windowed_fft);
        let spl: Vec<f64> = spd
            .iter()
            .map(|&p| if p > 1e-20 { 10.0 * p.log10() } else { -200.0 })
            .collect();
        let noise = self.estimate_noise(&spl);
        let snr: Vec<f64> = spl.iter().zip(&noise).map(|(s, n)| s - n).collect();
        let delta_f = self.effective_sr / self.fft_size as f64;
        let peaks = self.find_peaks(&snr, &fft_complex, delta_f);

        if peaks.is_empty() {
            return None;
        }

        let (raw_freq, quality, divisor) = self.find_fundamental(&peaks, delta_f);
        if raw_freq <= 0.0 || quality < MIN_OVERALL_SNR {
            return None;
        }

        let w0 = 2.0 * PI * raw_freq / self.effective_sr;
        let refined_w = newton_raphson(&windowed_fft, w0);
        let final_w = if refined_w > 0.0 {
            newton_raphson(&windowed_temporal, refined_w)
        } else {
            0.0
        };

        let final_freq = if final_w > 0.0 {
            final_w * self.effective_sr / (divisor as f64 * 2.0 * PI)
        } else if refined_w > 0.0 {
            refined_w * self.effective_sr / (divisor as f64 * 2.0 * PI)
        } else {
            raw_freq / divisor as f64
        };

        self.prev_freq = final_freq;
        Some((final_freq, quality))
    }

    // ---- internal helpers ----

    fn compute_fft_spd(&self, windowed: &[f64]) -> (Vec<f64>, Vec<Complex<f64>>) {
        let n = self.fft_size;
        let mut planner = FftPlanner::new();
        let fft = planner.plan_fft_forward(n);

        let mut buf: Vec<Complex<f64>> =
            windowed.iter().map(|&s| Complex::new(s, 0.0)).collect();
        buf.resize(n, Complex::new(0.0, 0.0));
        fft.process(&mut buf);

        let half = n / 2;
        let n_sq = (n * n) as f64;
        let spd: Vec<f64> = buf[..half]
            .iter()
            .map(|c| (c.re * c.re + c.im * c.im) / n_sq)
            .collect();
        (spd, buf)
    }

    fn estimate_noise(&self, spl: &[f64]) -> Vec<f64> {
        let n = spl.len();
        let warmup = ((NOISE_FILTER_WIDTH_HZ * self.fft_size as f64 / self.effective_sr)
            .ceil() as usize)
            .max(1)
            .min(n);

        let mut noise = vec![-200.0; n];

        // Pass 1: warm-up over `warmup` bins
        let mut state = spl[0];
        for &val in &spl[..warmup] {
            state = NOISE_FILTER_C * val + (1.0 - NOISE_FILTER_C) * state;
        }

        // Pass 2: full spectrum using warmed-up state
        for (i, &val) in spl.iter().enumerate() {
            state = NOISE_FILTER_C * val + (1.0 - NOISE_FILTER_C) * state;
            noise[i] = state;
        }
        noise
    }

    fn find_peaks(
        &self,
        snr: &[f64],
        fft_complex: &[Complex<f64>],
        delta_f: f64,
    ) -> Vec<Peak> {
        let half = self.fft_size / 2;
        let hw = self.peak_half_width;
        let lowest = ((self.internal_min_freq / delta_f).ceil() as usize).max(hw + 1);
        let highest = ((0.95 * half as f64) as usize).min(half.saturating_sub(hw + 1));

        let mut peaks: Vec<Peak> = Vec::with_capacity(PEAK_NUMBER);

        for i in lowest..highest {
            if snr[i] < MIN_SNR_DB {
                continue;
            }

            // Local maximum test — monotonic non-increase in both directions
            let is_peak = (1..=hw).all(|j| {
                i + j < half
                    && i >= j
                    && snr[i + j] <= snr[i + j - 1]
                    && snr[i - j] <= snr[i - j + 1]
            });
            if !is_peak {
                continue;
            }

            // Harmonic bias toward previously detected pitch
            let mut effective_snr = snr[i];
            if self.prev_freq > 0.0 {
                let f = i as f64 * delta_f;
                let ratio = f / self.prev_freq;
                if (ratio - ratio.round()).abs() < 0.07 {
                    effective_snr *= HARMONIC_BIAS;
                }
            }

            // Maintain top-N buffer
            if peaks.len() < PEAK_NUMBER {
                peaks.push(Peak { bin: i, freq: 0.0, snr_db: effective_snr });
            } else if let Some((min_idx, _)) = peaks
                .iter()
                .enumerate()
                .min_by(|a, b| a.1.snr_db.partial_cmp(&b.1.snr_db).unwrap())
            {
                if effective_snr > peaks[min_idx].snr_db {
                    peaks[min_idx] = Peak { bin: i, freq: 0.0, snr_db: effective_snr };
                }
            }
        }

        if peaks.is_empty() {
            return peaks;
        }

        // Prune weak peaks
        let max_snr = peaks.iter().map(|p| p.snr_db).fold(f64::NEG_INFINITY, f64::max);
        peaks.retain(|p| p.snr_db >= max_snr - PEAK_PRUNE_DB);

        // Quinn interpolation
        for p in &mut peaks {
            p.freq = quinn_interpolate(fft_complex, p.bin, delta_f, half);
        }

        peaks
    }

    fn find_fundamental(&self, peaks: &[Peak], _delta_f: f64) -> (f64, f64, usize) {
        let mut best_freq = 0.0;
        let mut best_quality = 0.0_f64;
        let mut best_divisor: usize = 1;

        for peak in peaks {
            for div in 1..=MAX_DIVISOR {
                let ground = peak.freq / div as f64;
                if ground < self.internal_min_freq {
                    continue;
                }

                let mut quality = 0.0;
                let mut strongest_freq = peak.freq;
                let mut strongest_snr = peak.snr_db;

                for other in peaks {
                    let ratio = other.freq / ground;
                    if (ratio - ratio.round()).abs() < RATIO_TOL {
                        let penalty = ground * 1.111e-5 + 0.9889;
                        quality += other.snr_db * penalty;
                        if other.snr_db > strongest_snr {
                            strongest_snr = other.snr_db;
                            strongest_freq = other.freq;
                        }
                    }
                }

                if quality > best_quality {
                    best_quality = quality;
                    best_freq = strongest_freq;
                    best_divisor = (strongest_freq / ground).round().max(1.0) as usize;
                }
            }
        }

        (best_freq, best_quality, best_divisor)
    }
}

/// Newton-Raphson iteration to find the SPD maximum near `w0`.
fn newton_raphson(windowed: &[f64], w0: f64) -> f64 {
    let mut w = w0;
    let mut prev_spd = 0.0;

    for k in 0..MAX_NR_ITER {
        let (spd, d1, d2) = spd_derivatives(windowed, w);

        if k > 0 && spd < prev_spd {
            return 0.0; // diverging
        }
        prev_spd = spd;

        if d2.abs() < 1e-20 {
            break;
        }

        let w_next = w - d1 / d2;
        if k >= 1 && (w_next - w).abs() < NR_CONVERGENCE {
            return w_next;
        }
        w = w_next;
    }

    if w > 0.0 { w } else { 0.0 }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn sine(freq: f64, sr: f64, n: usize) -> Vec<f64> {
        (0..n).map(|i| (2.0 * PI * freq * i as f64 / sr).sin()).collect()
    }

    fn harmonic_signal(fundamental: f64, sr: f64, n: usize) -> Vec<f64> {
        let h1 = sine(fundamental, sr, n);
        let h2 = sine(fundamental * 2.0, sr, n);
        let h3 = sine(fundamental * 3.0, sr, n);
        (0..n)
            .map(|i| h1[i] + 0.6 * h2[i] + 0.3 * h3[i])
            .collect()
    }

    #[test]
    fn test_detect_raw_a4() {
        let sr = 44100.0;
        let signal = sine(440.0, sr, 8192);
        let mut det = PitchDetectorCore::new(sr, 8192, 80.0, 6000.0);
        let result = det.detect_raw(&signal);
        assert!(result.is_some(), "Should detect A4 sine");
        let (freq, _) = result.unwrap();
        assert!(
            (freq - 440.0).abs() < 5.0,
            "Expected ~440 Hz, got {} Hz",
            freq
        );
    }

    #[test]
    fn test_detect_raw_harmonic() {
        let sr = 44100.0;
        let signal = harmonic_signal(220.0, sr, 8192);
        let mut det = PitchDetectorCore::new(sr, 8192, 80.0, 6000.0);
        let result = det.detect_raw(&signal);
        assert!(result.is_some(), "Should detect harmonic signal");
        let (freq, _) = result.unwrap();
        assert!(
            (freq - 220.0).abs() < 5.0,
            "Expected ~220 Hz (fundamental), got {} Hz",
            freq
        );
    }

    #[test]
    fn test_detect_raw_silence() {
        let signal = vec![0.0; 8192];
        let mut det = PitchDetectorCore::new(44100.0, 8192, 80.0, 6000.0);
        assert!(det.detect_raw(&signal).is_none(), "Should not detect silence");
    }

    #[test]
    fn test_locker_locks_after_consistent_readings() {
        let mut locker = FrequencyLocker::new();
        // First few readings: not locked yet
        for _ in 0..3 {
            assert_eq!(locker.update(440.0), 0.0);
        }
        // 4th consistent reading locks
        let f = locker.update(440.0);
        assert!(f > 0.0, "Should lock after {} readings", NHITS_TO_LOCK);
        assert!((f - 440.0).abs() < 1.0);
    }

    #[test]
    fn test_locker_unlocks_after_failures() {
        let mut locker = FrequencyLocker::new();
        // Lock on 440
        for _ in 0..NHITS_TO_LOCK {
            locker.update(440.0);
        }
        assert!(locker.update(440.0) > 0.0);

        // Miss enough times to unlock
        for _ in 0..NHITS_TO_UNLOCK {
            locker.update(0.0);
        }
        assert_eq!(locker.update(0.0), 0.0, "Should be unlocked");
    }

    #[test]
    fn test_frequencies_related() {
        // Same frequency
        assert!(frequencies_related(440.0, 440.0).is_some());
        // Octave
        assert!(frequencies_related(440.0, 220.0).is_some());
        // Unrelated (313 Hz has no simple harmonic relationship to 440 Hz)
        assert!(frequencies_related(440.0, 313.0).is_none());
    }

    #[test]
    fn test_detect_with_locker_a4() {
        let sr = 44100.0;
        let signal = sine(440.0, sr, 8192);
        let mut det = PitchDetectorCore::new(sr, 8192, 80.0, 6000.0);

        let mut locked_freq = 0.0;
        // Feed consistent signal until locker engages
        for _ in 0..10 {
            if let Some((f, _)) = det.detect(&signal) {
                locked_freq = f;
                break;
            }
        }
        assert!(
            (locked_freq - 440.0).abs() < 5.0,
            "Locker should converge to ~440 Hz, got {} Hz",
            locked_freq
        );
    }

    #[test]
    fn test_detect_low_bass_e2() {
        let sr = 44100.0;
        let signal = harmonic_signal(82.41, sr, 8192);
        let mut det = PitchDetectorCore::new(sr, 8192, 30.0, 1200.0);
        let result = det.detect_raw(&signal);
        assert!(result.is_some(), "Should detect E2");
        let (freq, _) = result.unwrap();
        assert!(
            (freq - 82.41).abs() < 3.0,
            "Expected ~82.4 Hz, got {} Hz",
            freq
        );
    }
}
