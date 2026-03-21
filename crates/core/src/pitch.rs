use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use pitch_detection::detector::mcleod::McLeodDetector;
use pitch_detection::detector::PitchDetector as PitchDetectorTrait;
use rustfft::{FftPlanner, num_complex::Complex};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DetectedPitch {
    pub frequency: f64,
    pub clarity: f64,
}

/// Check if the detected frequency should be corrected down an octave
/// using Harmonic Product Spectrum analysis. Returns the corrected frequency.
fn correct_octave_hps(signal: &[f64], sample_rate: usize, detected_freq: f64) -> f64 {
    let n = signal.len().next_power_of_two();
    let mut planner = FftPlanner::new();
    let fft = planner.plan_fft_forward(n);

    // Build complex buffer, zero-padded to power of 2
    let mut buffer: Vec<Complex<f64>> = signal
        .iter()
        .map(|&s| Complex::new(s, 0.0))
        .collect();
    buffer.resize(n, Complex::new(0.0, 0.0));

    fft.process(&mut buffer);

    // Magnitude spectrum (only first half — positive frequencies)
    let half = n / 2;
    let mags: Vec<f64> = buffer[..half].iter().map(|c| c.norm()).collect();

    // Frequency resolution: each bin = sample_rate / n Hz
    let bin_resolution = sample_rate as f64 / n as f64;

    // Find the bin for the detected frequency and its sub-harmonic (half)
    let detected_bin = (detected_freq / bin_resolution).round() as usize;
    let sub_bin = detected_bin / 2;

    if sub_bin == 0 || detected_bin >= half || sub_bin >= half {
        return detected_freq;
    }

    // Look at energy around the sub-harmonic (±2 bins)
    let window = 2usize;
    let sub_start = sub_bin.saturating_sub(window);
    let sub_end = (sub_bin + window + 1).min(half);
    let sub_energy: f64 = mags[sub_start..sub_end].iter().copied().sum();

    // Look at energy around the detected frequency
    let det_start = detected_bin.saturating_sub(window);
    let det_end = (detected_bin + window + 1).min(half);
    let det_energy: f64 = mags[det_start..det_end].iter().copied().sum();

    // If sub-harmonic has significant energy relative to the detected harmonic,
    // the fundamental is likely at the lower octave
    if sub_energy > det_energy * 0.4 {
        detected_freq / 2.0
    } else {
        detected_freq
    }
}

#[wasm_bindgen(js_name = PitchDetector)]
pub struct WasmPitchDetector {
    sample_rate: f64,
    detector: McLeodDetector<f64>,
    power_threshold: f64,
    clarity_threshold: f64,
}

#[wasm_bindgen(js_class = PitchDetector)]
impl WasmPitchDetector {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f64, buffer_size: usize) -> Self {
        // Detector operates on downsampled (2x) signal for better bass detection
        let ds_size = buffer_size / 2;
        let padding = ds_size / 2;
        WasmPitchDetector {
            sample_rate,
            detector: McLeodDetector::new(ds_size, padding),
            power_threshold: 3.0,
            clarity_threshold: 0.45,
        }
    }

    #[wasm_bindgen(js_name = setPowerThreshold)]
    pub fn set_power_threshold(&mut self, threshold: f64) {
        self.power_threshold = threshold;
    }

    #[wasm_bindgen(js_name = setClarityThreshold)]
    pub fn set_clarity_threshold(&mut self, threshold: f64) {
        self.clarity_threshold = threshold;
    }

    /// Detect pitch from a Float32Array audio buffer.
    /// Returns null if no pitch detected (silence or unclear signal).
    pub fn detect(&mut self, audio_data: &js_sys::Float32Array) -> JsValue {
        let input: Vec<f32> = audio_data.to_vec();

        // Downsample 2x (average adjacent pairs) for better bass detection
        let ds_len = input.len() / 2;
        let ds_signal: Vec<f64> = (0..ds_len)
            .map(|i| ((input[i * 2] as f64) + (input[i * 2 + 1] as f64)) * 0.5)
            .collect();

        let ds_sample_rate = (self.sample_rate / 2.0) as usize;

        match self.detector.get_pitch(
            &ds_signal,
            ds_sample_rate,
            self.power_threshold,
            self.clarity_threshold,
        ) {
            Some(pitch) => {
                // Use HPS on the original signal for octave correction
                let full_signal: Vec<f64> = input.iter().map(|&s| s as f64).collect();
                let corrected = correct_octave_hps(
                    &full_signal,
                    self.sample_rate as usize,
                    pitch.frequency,
                );
                let result = DetectedPitch {
                    frequency: corrected,
                    clarity: pitch.clarity,
                };
                serde_wasm_bindgen::to_value(&result).unwrap()
            }
            None => JsValue::NULL,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f64::consts::PI;

    /// Generate a sine wave for testing
    fn generate_sine(frequency: f64, sample_rate: f64, num_samples: usize) -> Vec<f64> {
        (0..num_samples)
            .map(|i| (2.0 * PI * frequency * i as f64 / sample_rate).sin())
            .collect()
    }

    #[test]
    fn test_detect_a4() {
        let sample_rate = 44100.0;
        let buffer_size = 4096;
        let signal = generate_sine(440.0, sample_rate, buffer_size);

        let padding = buffer_size / 2;
        let mut detector = McLeodDetector::new(buffer_size, padding);
        let result = detector.get_pitch(&signal, sample_rate as usize, 3.0, 0.45);

        assert!(result.is_some(), "Should detect pitch for A4 sine wave");
        let pitch = result.unwrap();
        assert!(
            (pitch.frequency - 440.0).abs() < 5.0,
            "Detected frequency {} should be close to 440 Hz",
            pitch.frequency
        );
        assert!(pitch.clarity > 0.8, "Clarity should be high for pure sine");
    }

    #[test]
    fn test_detect_e1_bass() {
        let sample_rate = 44100.0;
        let buffer_size = 4096;
        let signal = generate_sine(41.2, sample_rate, buffer_size);

        let padding = buffer_size / 2;
        let mut detector = McLeodDetector::new(buffer_size, padding);
        let result = detector.get_pitch(&signal, sample_rate as usize, 5.0, 0.5);

        assert!(result.is_some(), "Should detect pitch for E1 bass note");
        let pitch = result.unwrap();
        assert!(
            (pitch.frequency - 41.2).abs() < 3.0,
            "Detected frequency {} should be close to 41.2 Hz",
            pitch.frequency
        );
    }

    #[test]
    fn test_detect_silence() {
        let sample_rate = 44100.0;
        let buffer_size = 4096;
        let signal = vec![0.0; buffer_size];

        let padding = buffer_size / 2;
        let mut detector = McLeodDetector::new(buffer_size, padding);
        let result = detector.get_pitch(&signal, sample_rate as usize, 3.0, 0.45);

        assert!(result.is_none(), "Should not detect pitch in silence");
    }

    #[test]
    fn test_hps_pure_sine_no_correction() {
        // A pure sine wave at 440Hz should not be corrected down
        let sample_rate = 44100;
        let n = 8192;
        let signal = generate_sine(440.0, sample_rate as f64, n);
        let corrected = correct_octave_hps(&signal, sample_rate, 440.0);
        assert!(
            (corrected - 440.0).abs() < 1.0,
            "Pure sine should not be corrected, got {}",
            corrected,
        );
    }

    #[test]
    fn test_hps_corrects_octave_up_error() {
        // Signal with strong fundamental at 82Hz (E2) and harmonic at 164Hz (E3).
        // If MPM detected 164Hz (octave up error), HPS should correct to 82Hz.
        let sample_rate = 44100;
        let n = 8192;
        let fundamental: Vec<f64> = (0..n)
            .map(|i| (2.0 * PI * 82.0 * i as f64 / sample_rate as f64).sin())
            .collect();
        let harmonic: Vec<f64> = (0..n)
            .map(|i| 0.8 * (2.0 * PI * 164.0 * i as f64 / sample_rate as f64).sin())
            .collect();
        let signal: Vec<f64> = fundamental.iter().zip(&harmonic).map(|(a, b)| a + b).collect();

        let corrected = correct_octave_hps(&signal, sample_rate, 164.0);
        assert!(
            (corrected - 82.0).abs() < 1.0,
            "Should correct octave-up error from 164 to 82, got {}",
            corrected,
        );
    }
}
