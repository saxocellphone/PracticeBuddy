use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use pitch_detection::detector::mcleod::McLeodDetector;
use pitch_detection::detector::PitchDetector as PitchDetectorTrait;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DetectedPitch {
    pub frequency: f64,
    pub clarity: f64,
}

#[wasm_bindgen(js_name = PitchDetector)]
pub struct WasmPitchDetector {
    sample_rate: f64,
    buffer_size: usize,
    power_threshold: f64,
    clarity_threshold: f64,
}

#[wasm_bindgen(js_class = PitchDetector)]
impl WasmPitchDetector {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f64, buffer_size: usize) -> Self {
        WasmPitchDetector {
            sample_rate,
            buffer_size,
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

        // Convert f32 to f64 for pitch-detection crate
        let signal: Vec<f64> = input.iter().map(|&s| s as f64).collect();

        let padding = self.buffer_size / 2;
        let mut detector = McLeodDetector::new(self.buffer_size, padding);

        match detector.get_pitch(
            &signal,
            self.sample_rate as usize,
            self.power_threshold,
            self.clarity_threshold,
        ) {
            Some(pitch) => {
                let result = DetectedPitch {
                    frequency: pitch.frequency,
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
}
