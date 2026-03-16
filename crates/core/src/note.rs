use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

const A4_FREQUENCY: f64 = 440.0;
const A4_MIDI: f64 = 69.0;
const SEMITONES_PER_OCTAVE: f64 = 12.0;
const CENTS_PER_OCTAVE: f64 = 1200.0;

const PITCH_CLASSES: [&str; 12] = [
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

/// Maps sharp pitch classes to their flat equivalents
const FLAT_EQUIVALENTS: [(&str, &str); 5] = [
    ("C#", "Db"),
    ("D#", "Eb"),
    ("F#", "Gb"),
    ("G#", "Ab"),
    ("A#", "Bb"),
];

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub name: String,
    pub pitch_class: String,
    pub octave: i32,
    pub midi: i32,
    pub frequency: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FrequencyToNoteResult {
    pub note: Note,
    pub cents_offset: f64,
}

impl Note {
    pub fn from_midi(midi: i32) -> Self {
        let pitch_class_idx = ((midi % 12 + 12) % 12) as usize;
        let octave = (midi / 12) - 1;
        let pitch_class = PITCH_CLASSES[pitch_class_idx].to_string();
        let name = format!("{}{}", pitch_class, octave);
        let frequency = midi_to_frequency_internal(midi);

        Note {
            name,
            pitch_class,
            octave,
            midi,
            frequency,
        }
    }

    pub fn from_name(name: &str) -> Result<Self, String> {
        let (pitch_class, octave_str) = parse_note_name(name)?;
        let octave: i32 = octave_str
            .parse()
            .map_err(|_| format!("Invalid octave in note: {}", name))?;

        let semitone = pitch_class_to_semitone(&pitch_class)?;
        let midi = (octave + 1) * 12 + semitone as i32;
        let frequency = midi_to_frequency_internal(midi);

        // Normalize pitch class to sharp representation for consistency
        let normalized_pc = PITCH_CLASSES[semitone].to_string();

        Ok(Note {
            name: format!("{}{}", normalized_pc, octave),
            pitch_class: normalized_pc,
            octave,
            midi,
            frequency,
        })
    }
}

/// Parse a note name like "C#4", "Db2", "E3" into (pitch_class, octave_string)
fn parse_note_name(name: &str) -> Result<(String, String), String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Empty note name".to_string());
    }

    let chars: Vec<char> = name.chars().collect();
    let letter = chars[0];
    if !letter.is_ascii_alphabetic() {
        return Err(format!("Invalid note letter: {}", letter));
    }

    let mut pitch_end = 1;
    if pitch_end < chars.len() && (chars[pitch_end] == '#' || chars[pitch_end] == 'b') {
        pitch_end += 1;
    }

    let pitch_class: String = chars[..pitch_end].iter().collect();
    let pitch_class = pitch_class
        .chars()
        .next()
        .map(|c| c.to_uppercase().to_string())
        .unwrap_or_default()
        + &pitch_class[1..];

    let octave_str: String = chars[pitch_end..].iter().collect();
    if octave_str.is_empty() {
        return Err(format!("Missing octave in note: {}", name));
    }

    Ok((pitch_class, octave_str))
}

/// Convert pitch class string to semitone offset (0-11)
pub fn pitch_class_to_semitone(pc: &str) -> Result<usize, String> {
    // Check sharp names first
    for (i, &name) in PITCH_CLASSES.iter().enumerate() {
        if pc.eq_ignore_ascii_case(name) {
            return Ok(i);
        }
    }
    // Check flat equivalents
    for &(sharp, flat) in &FLAT_EQUIVALENTS {
        if pc.eq_ignore_ascii_case(flat) {
            for (i, &name) in PITCH_CLASSES.iter().enumerate() {
                if name == sharp {
                    return Ok(i);
                }
            }
        }
    }
    Err(format!("Unknown pitch class: {}", pc))
}

/// Check if two pitch classes are enharmonic equivalents
pub fn are_enharmonic(pc_a: &str, pc_b: &str) -> bool {
    if let (Ok(a), Ok(b)) = (pitch_class_to_semitone(pc_a), pitch_class_to_semitone(pc_b)) {
        a == b
    } else {
        false
    }
}

// Internal functions (testable without WASM)

pub fn frequency_to_midi_internal(frequency: f64) -> f64 {
    SEMITONES_PER_OCTAVE * (frequency / A4_FREQUENCY).log2() + A4_MIDI
}

pub fn midi_to_frequency_internal(midi: i32) -> f64 {
    A4_FREQUENCY * 2.0_f64.powf((midi as f64 - A4_MIDI) / SEMITONES_PER_OCTAVE)
}

pub fn cents_distance_internal(freq_a: f64, freq_b: f64) -> f64 {
    CENTS_PER_OCTAVE * (freq_a / freq_b).log2()
}

pub fn frequency_to_note_internal(frequency: f64) -> FrequencyToNoteResult {
    let midi_float = frequency_to_midi_internal(frequency);
    let midi_rounded = midi_float.round() as i32;
    let cents_offset = (midi_float - midi_rounded as f64) * 100.0;

    FrequencyToNoteResult {
        note: Note::from_midi(midi_rounded),
        cents_offset,
    }
}

// WASM-exported functions

#[wasm_bindgen(js_name = frequencyToMidi)]
pub fn frequency_to_midi(frequency: f64) -> f64 {
    frequency_to_midi_internal(frequency)
}

#[wasm_bindgen(js_name = midiToFrequency)]
pub fn midi_to_frequency(midi: i32) -> f64 {
    midi_to_frequency_internal(midi)
}

#[wasm_bindgen(js_name = centsDistance)]
pub fn cents_distance(freq_a: f64, freq_b: f64) -> f64 {
    cents_distance_internal(freq_a, freq_b)
}

#[wasm_bindgen(js_name = frequencyToNote)]
pub fn frequency_to_note(frequency: f64) -> JsValue {
    let result = frequency_to_note_internal(frequency);
    serde_wasm_bindgen::to_value(&result).unwrap()
}

#[wasm_bindgen(js_name = noteFromName)]
pub fn note_from_name(name: &str) -> Result<JsValue, JsError> {
    let note = Note::from_name(name).map_err(|e| JsError::new(&e))?;
    serde_wasm_bindgen::to_value(&note).map_err(|e| JsError::new(&e.to_string()))
}

#[wasm_bindgen(js_name = noteFromMidi)]
pub fn note_from_midi(midi: i32) -> JsValue {
    let note = Note::from_midi(midi);
    serde_wasm_bindgen::to_value(&note).unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_frequency_to_midi_a4() {
        let result = frequency_to_midi_internal(440.0);
        assert!((result - 69.0).abs() < 0.001);
    }

    #[test]
    fn test_frequency_to_midi_e1() {
        // E1 = MIDI 28, ~41.2 Hz
        let result = frequency_to_midi_internal(41.2034);
        assert!((result - 28.0).abs() < 0.01);
    }

    #[test]
    fn test_midi_to_frequency_a4() {
        let result = midi_to_frequency_internal(69);
        assert!((result - 440.0).abs() < 0.001);
    }

    #[test]
    fn test_midi_to_frequency_middle_c() {
        let result = midi_to_frequency_internal(60);
        assert!((result - 261.626).abs() < 0.01);
    }

    #[test]
    fn test_cents_distance_zero() {
        let result = cents_distance_internal(440.0, 440.0);
        assert!(result.abs() < 0.001);
    }

    #[test]
    fn test_cents_distance_one_semitone() {
        // A#4 = 466.164 Hz, one semitone above A4
        let result = cents_distance_internal(466.164, 440.0);
        assert!((result - 100.0).abs() < 0.1);
    }

    #[test]
    fn test_note_from_midi_a4() {
        let note = Note::from_midi(69);
        assert_eq!(note.name, "A4");
        assert_eq!(note.pitch_class, "A");
        assert_eq!(note.octave, 4);
        assert_eq!(note.midi, 69);
    }

    #[test]
    fn test_note_from_midi_middle_c() {
        let note = Note::from_midi(60);
        assert_eq!(note.name, "C4");
        assert_eq!(note.pitch_class, "C");
        assert_eq!(note.octave, 4);
    }

    #[test]
    fn test_note_from_midi_e1() {
        let note = Note::from_midi(28);
        assert_eq!(note.name, "E1");
        assert_eq!(note.pitch_class, "E");
        assert_eq!(note.octave, 1);
    }

    #[test]
    fn test_note_from_name_simple() {
        let note = Note::from_name("C4").unwrap();
        assert_eq!(note.midi, 60);
        assert_eq!(note.pitch_class, "C");
        assert_eq!(note.octave, 4);
    }

    #[test]
    fn test_note_from_name_sharp() {
        let note = Note::from_name("F#2").unwrap();
        assert_eq!(note.pitch_class, "F#");
        assert_eq!(note.octave, 2);
        assert_eq!(note.midi, 42);
    }

    #[test]
    fn test_note_from_name_flat() {
        let note = Note::from_name("Bb3").unwrap();
        // Normalized to sharp
        assert_eq!(note.pitch_class, "A#");
        assert_eq!(note.midi, 58);
    }

    #[test]
    fn test_note_from_name_invalid() {
        assert!(Note::from_name("X4").is_err());
        assert!(Note::from_name("").is_err());
    }

    #[test]
    fn test_frequency_to_note_a4() {
        let result = frequency_to_note_internal(440.0);
        assert_eq!(result.note.name, "A4");
        assert!(result.cents_offset.abs() < 0.01);
    }

    #[test]
    fn test_frequency_to_note_slightly_sharp() {
        // 441 Hz is slightly sharp of A4
        let result = frequency_to_note_internal(441.0);
        assert_eq!(result.note.name, "A4");
        assert!(result.cents_offset > 0.0);
        assert!(result.cents_offset < 10.0);
    }

    #[test]
    fn test_enharmonic_equivalents() {
        assert!(are_enharmonic("C#", "Db"));
        assert!(are_enharmonic("D#", "Eb"));
        assert!(are_enharmonic("F#", "Gb"));
        assert!(are_enharmonic("G#", "Ab"));
        assert!(are_enharmonic("A#", "Bb"));
        assert!(!are_enharmonic("C", "D"));
    }

    #[test]
    fn test_roundtrip_midi_frequency() {
        for midi in 21..=108 {
            let freq = midi_to_frequency_internal(midi);
            let back = frequency_to_midi_internal(freq);
            assert!(
                (back - midi as f64).abs() < 0.001,
                "Roundtrip failed for MIDI {}",
                midi
            );
        }
    }
}
