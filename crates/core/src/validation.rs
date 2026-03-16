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

    // When ignoring octave, compute cents off relative to the nearest
    // octave of the expected pitch class for tolerance checking.
    let cents_off_for_tolerance = if ignore_octave && expected_pc == detected_pc && detected_midi != expected_midi {
        let octave_diff = ((detected_midi - expected_midi) as f64 / 12.0).round() as i32;
        let nearest_expected = expected_midi + octave_diff * 12;
        (midi_float - nearest_expected as f64) * 100.0
    } else {
        cents_off_from_expected
    };

    let (is_correct, match_type) = if detected_midi == expected_midi
        && cents_off_from_expected.abs() <= cents_tolerance
    {
        (true, "exact")
    } else if expected_pc == detected_pc
        && detected_midi != expected_midi
    {
        if ignore_octave && cents_off_for_tolerance.abs() <= cents_tolerance {
            // Right pitch class, different octave — accepted when ignoring octave
            (true, "wrongOctave")
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

    NoteValidationResult {
        is_correct,
        cents_off: cents_off_from_expected,
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
    fn test_wrong_octave() {
        // E3 when expecting E2
        let e3_freq = midi_to_frequency_internal(40); // E3
        let result = validate_note_internal(e3_freq, 0.9, 28, 50.0);
        assert!(!result.is_correct);
        assert_eq!(result.match_type, "wrongOctave");
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
}
