use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::signal::PitchDetectorCore;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DetectedPitch {
    pub frequency: f64,
    pub clarity: f64,
    /// Root-mean-square amplitude of the audio buffer.
    pub rms: f64,
}

#[wasm_bindgen(js_name = PitchDetector)]
pub struct WasmPitchDetector {
    sample_rate: f64,
    buffer_size: usize,
    min_freq: f64,
    max_freq: f64,
    detector: PitchDetectorCore,
}

#[wasm_bindgen(js_class = PitchDetector)]
impl WasmPitchDetector {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f64, buffer_size: usize) -> Self {
        let min_freq = 20.0;
        let max_freq = 10000.0;
        WasmPitchDetector {
            sample_rate,
            buffer_size,
            min_freq,
            max_freq,
            detector: PitchDetectorCore::new(sample_rate, buffer_size, min_freq, max_freq),
        }
    }

    /// These thresholds are handled internally by the lingot algorithm.
    /// Kept for API compatibility.
    #[wasm_bindgen(js_name = setPowerThreshold)]
    pub fn set_power_threshold(&mut self, _threshold: f64) {}

    #[wasm_bindgen(js_name = setClarityThreshold)]
    pub fn set_clarity_threshold(&mut self, _threshold: f64) {}

    /// Set the instrument frequency range. Rebuilds the internal detector
    /// since the oversampling factor depends on the frequency range.
    #[wasm_bindgen(js_name = setFrequencyRange)]
    pub fn set_frequency_range(&mut self, min_freq: f64, max_freq: f64) {
        self.min_freq = min_freq;
        self.max_freq = max_freq;
        self.detector =
            PitchDetectorCore::new(self.sample_rate, self.buffer_size, min_freq, max_freq);
    }

    #[wasm_bindgen(js_name = setFlatnessThreshold)]
    pub fn set_flatness_threshold(&mut self, _threshold: f64) {}

    /// Detect pitch from a Float32Array audio buffer.
    /// Returns null if no pitch detected.
    pub fn detect(&mut self, audio_data: &js_sys::Float32Array) -> JsValue {
        let input: Vec<f32> = audio_data.to_vec();
        let signal: Vec<f64> = input.iter().map(|&s| s as f64).collect();

        // Compute RMS from the raw signal (used by session attack detection)
        let rms = if signal.is_empty() {
            0.0
        } else {
            let sum_sq: f64 = signal.iter().map(|&s| s * s).sum();
            (sum_sq / signal.len() as f64).sqrt()
        };

        match self.detector.detect(&signal) {
            Some((freq, quality)) => {
                // Map lingot quality (sum of SNR dB) to a 0-1 clarity value.
                // Quality of 20 dB (minimum threshold) → 0.5, 40+ dB → 1.0.
                let clarity = (quality / 40.0).clamp(0.0, 1.0);
                let result = DetectedPitch {
                    frequency: freq,
                    clarity,
                    rms,
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

    fn generate_sine(frequency: f64, sample_rate: f64, num_samples: usize) -> Vec<f64> {
        (0..num_samples)
            .map(|i| (2.0 * PI * frequency * i as f64 / sample_rate).sin())
            .collect()
    }

    #[test]
    fn test_detect_a4_via_lingot() {
        let sr = 44100.0;
        let signal = generate_sine(440.0, sr, 8192);
        let mut det = PitchDetectorCore::new(sr, 8192, 80.0, 6000.0);
        let result = det.detect_raw(&signal);
        assert!(result.is_some(), "Should detect A4");
        let (freq, _) = result.unwrap();
        assert!(
            (freq - 440.0).abs() < 5.0,
            "Expected ~440 Hz, got {}",
            freq
        );
    }

    #[test]
    fn test_detect_silence() {
        let signal = vec![0.0; 8192];
        let mut det = PitchDetectorCore::new(44100.0, 8192, 80.0, 6000.0);
        assert!(det.detect_raw(&signal).is_none());
    }
}
