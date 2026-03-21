use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::note::{are_enharmonic, frequency_to_midi_internal, Note};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NoteValidationResult {
    pub is_correct: bool,
    pub cents_off: f64,
    pub expected_note: Note,
    pub detected_note: Note,
    pub detected_frequency: f64,
    pub detected_clarity: f64,
    pub match_type: String,
}

pub fn validate_note_internal(
    detected_frequency: f64,
    detected_clarity: f64,
    expected_midi: i32,
    cents_tolerance: f64,
) -> NoteValidationResult {
    validate_note_internal_full(detected_frequency, detected_clarity, expected_midi, cents_tolerance, false)
}

pub fn validate_note_internal_full(
    detected_frequency: f64,
    detected_clarity: f64,
    expected_midi: i32,
    cents_tolerance: f64,
    ignore_octave: bool,
) -> NoteValidationResult {
    let midi_float = frequency_to_midi_internal(detected_frequency);
    let detected_midi = midi_float.round() as i32;
    let cents_off_from_expected =
        (midi_float - expected_midi as f64) * 100.0;

    let expected_note = Note::from_midi(expected_midi);
    let detected_note = Note::from_midi(detected_midi);

    let expected_pc = expected_midi.rem_euclid(12);
    let detected_pc = detected_midi.rem_euclid(12);

    // Compute cents off relative to the nearest octave of the expected
    // pitch class. Used for both ignoreOctave and octaveCorrected logic.
    let octave_diff = ((detected_midi - expected_midi) as f64 / 12.0).round() as i32;
    let cents_off_nearest_octave = if expected_pc == detected_pc && detected_midi != expected_midi {
        let nearest_expected = expected_midi + octave_diff * 12;
        (midi_float - nearest_expected as f64) * 100.0
    } else {
        cents_off_from_expected
    };

    let is_one_octave_off = octave_diff.abs() == 1;

    let (is_correct, match_type) = if detected_midi == expected_midi
        && cents_off_from_expected.abs() <= cents_tolerance
    {
        (true, "exact")
    } else if expected_pc == detected_pc
        && detected_midi != expected_midi
    {
        if ignore_octave && cents_off_nearest_octave.abs() <= cents_tolerance {
            // Right pitch class, different octave — accepted when ignoring octave
            (true, "wrongOctave")
        } else if !ignore_octave
            && is_one_octave_off
            && cents_off_nearest_octave.abs() <= cents_tolerance
        {
            // Exactly one octave off — likely a harmonic detection error.
            // Accept it as correct with a distinct match type.
            (true, "octaveCorrected")
        } else if cents_off_from_expected.abs() <= cents_tolerance + 1200.0 {
            // Right pitch class, wrong octave — not accepted
            (false, "wrongOctave")
        } else {
            (false, "wrong")
        }
    } else if are_enharmonic(&detected_note.pitch_class, &expected_note.pitch_class)
        && cents_off_from_expected.abs() <= cents_tolerance
    {
        (true, "enharmonic")
    } else {
        (false, "wrong")
    };

    // For octave-corrected matches, report cents relative to the nearest
    // octave so the tuning display shows meaningful data (not ~1200 cents).
    let final_cents_off = if match_type == "octaveCorrected" {
        cents_off_nearest_octave
    } else {
        cents_off_from_expected
    };

    NoteValidationResult {
        is_correct,
        cents_off: final_cents_off,
        expected_note,
        detected_note,
        detected_frequency,
        detected_clarity,
        match_type: match_type.to_string(),
    }
}

#[wasm_bindgen(js_name = validateNote)]
pub fn validate_note(
    detected_frequency: f64,
    detected_clarity: f64,
    expected_midi: i32,
    cents_tolerance: f64,
) -> JsValue {
    let result = validate_note_internal(
        detected_frequency,
        detected_clarity,
        expected_midi,
        cents_tolerance,
    );
    serde_wasm_bindgen::to_value(&result).unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::note::midi_to_frequency_internal;

    #[test]
    fn test_exact_match() {
        let result = validate_note_internal(440.0, 0.95, 69, 50.0);
        assert!(result.is_correct);
        assert_eq!(result.match_type, "exact");
        assert!(result.cents_off.abs() < 1.0);
    }

    #[test]
    fn test_sharp_within_tolerance() {
        // 441 Hz is ~3.93 cents sharp of A4 (MIDI 69)
        let result = validate_note_internal(441.0, 0.9, 69, 50.0);
        assert!(result.is_correct);
        assert_eq!(result.match_type, "exact");
        assert!(result.cents_off > 0.0);
        assert!(result.cents_off < 50.0);
    }

    #[test]
    fn test_flat_within_tolerance() {
        // 439 Hz is ~3.94 cents flat of A4
        let result = validate_note_internal(439.0, 0.9, 69, 50.0);
        assert!(result.is_correct);
        assert_eq!(result.match_type, "exact");
        assert!(result.cents_off < 0.0);
        assert!(result.cents_off > -50.0);
    }

    #[test]
    fn test_wrong_note() {
        // F2 (87.31 Hz) when expecting E2 (MIDI 28, ~82.41 Hz)
        let f2_freq = midi_to_frequency_internal(29); // F2
        let result = validate_note_internal(f2_freq, 0.9, 28, 50.0);
        assert!(!result.is_correct);
        assert_eq!(result.match_type, "wrong");
    }

    #[test]
    fn test_wrong_octave_now_octave_corrected() {
        // E3 when expecting E2 — exactly 1 octave off, accepted as octaveCorrected
        let e3_freq = midi_to_frequency_internal(40); // E3
        let result = validate_note_internal(e3_freq, 0.9, 28, 50.0);
        assert!(result.is_correct);
        assert_eq!(result.match_type, "octaveCorrected");
    }

    #[test]
    fn test_outside_tolerance() {
        // ~30 cents sharp, tolerance is 20
        let freq = 440.0 * 2.0_f64.powf(30.0 / 1200.0); // 30 cents sharp of A4
        let result = validate_note_internal(freq, 0.9, 69, 20.0);
        // Still rounds to same MIDI note but cents off is > tolerance
        // The exact match check is: detected_midi == expected_midi AND cents <= tolerance
        // 30 cents is still within the same semitone, so detected_midi == 69
        // but 30 > 20 tolerance, so it should be wrong
        assert!(!result.is_correct);
    }

    #[test]
    fn test_expected_note_populated() {
        let result = validate_note_internal(440.0, 0.95, 69, 50.0);
        assert_eq!(result.expected_note.name, "A4");
        assert_eq!(result.expected_note.midi, 69);
    }

    #[test]
    fn test_detected_metadata() {
        let result = validate_note_internal(440.0, 0.88, 69, 50.0);
        assert_eq!(result.detected_frequency, 440.0);
        assert_eq!(result.detected_clarity, 0.88);
    }

    #[test]
    fn test_octave_corrected_one_octave_above() {
        // Detected E3 (MIDI 52) when expecting E2 (MIDI 40), ignoreOctave = false
        let e3_freq = midi_to_frequency_internal(52);
        let result = validate_note_internal_full(e3_freq, 0.9, 40, 50.0, false);
        assert!(result.is_correct, "Should accept one octave above as octaveCorrected");
        assert_eq!(result.match_type, "octaveCorrected");
        assert!(result.cents_off.abs() < 1.0, "Cents off should be near 0, got {}", result.cents_off);
    }

    #[test]
    fn test_octave_corrected_one_octave_below() {
        // Detected A3 (MIDI 57) when expecting A4 (MIDI 69), ignoreOctave = false
        let a3_freq = midi_to_frequency_internal(57);
        let result = validate_note_internal_full(a3_freq, 0.9, 69, 50.0, false);
        assert!(result.is_correct, "Should accept one octave below as octaveCorrected");
        assert_eq!(result.match_type, "octaveCorrected");
        assert!(result.cents_off.abs() < 1.0, "Cents off should be near 0, got {}", result.cents_off);
    }

    #[test]
    fn test_octave_corrected_two_octaves_not_corrected() {
        // Detected E4 (MIDI 64) when expecting E2 (MIDI 40) — two octaves off
        let e4_freq = midi_to_frequency_internal(64);
        let result = validate_note_internal_full(e4_freq, 0.9, 40, 50.0, false);
        assert!(!result.is_correct, "Two octaves off should not be octaveCorrected");
        // 2400 cents exceeds tolerance + 1200 so it's classified as "wrong"
        assert_eq!(result.match_type, "wrong");
    }

    #[test]
    fn test_octave_corrected_not_applied_when_ignore_octave() {
        // When ignoreOctave is true, should use "wrongOctave" not "octaveCorrected"
        let e3_freq = midi_to_frequency_internal(52);
        let result = validate_note_internal_full(e3_freq, 0.9, 40, 50.0, true);
        assert!(result.is_correct);
        assert_eq!(result.match_type, "wrongOctave", "ignoreOctave should use wrongOctave, not octaveCorrected");
    }

    #[test]
    fn test_octave_corrected_respects_cents_tolerance() {
        // E3 slightly sharp, but within tolerance of the octave-adjusted expected
        let e3_sharp = midi_to_frequency_internal(52) * 2.0_f64.powf(15.0 / 1200.0); // 15 cents sharp
        let result = validate_note_internal_full(e3_sharp, 0.9, 40, 20.0, false);
        assert!(result.is_correct, "15 cents sharp within 20 cent tolerance should pass");
        assert_eq!(result.match_type, "octaveCorrected");
        assert!((result.cents_off - 15.0).abs() < 1.0, "Cents off should be ~15, got {}", result.cents_off);
    }

    #[test]
    fn test_octave_corrected_outside_cents_tolerance() {
        // E3 very sharp — outside tolerance
        let e3_very_sharp = midi_to_frequency_internal(52) * 2.0_f64.powf(40.0 / 1200.0); // 40 cents sharp
        let result = validate_note_internal_full(e3_very_sharp, 0.9, 40, 20.0, false);
        assert!(!result.is_correct, "40 cents sharp outside 20 cent tolerance should fail");
    }
}
