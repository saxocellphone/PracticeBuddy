use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::note::Note;

#[wasm_bindgen]
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
pub enum ScaleType {
    Major,
    NaturalMinor,
    HarmonicMinor,
    MelodicMinor,
    Dorian,
    Phrygian,
    Lydian,
    Mixolydian,
    Locrian,
    MajorPentatonic,
    MinorPentatonic,
    Blues,
    // Jazz scales (Phase 2)
    LydianDominant,
    Altered,
    LocrianNatural2,
    // Jazz scales (Phase 3)
    HalfWholeDiminished,
    WholeTone,
    BebopDominant,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ScaleInfo {
    pub name: String,
    pub display_name: String,
    pub category: String,
}

impl ScaleType {
    pub fn intervals(&self) -> &'static [u8] {
        match self {
            ScaleType::Major => &[2, 2, 1, 2, 2, 2, 1],
            ScaleType::NaturalMinor => &[2, 1, 2, 2, 1, 2, 2],
            ScaleType::HarmonicMinor => &[2, 1, 2, 2, 1, 3, 1],
            ScaleType::MelodicMinor => &[2, 1, 2, 2, 2, 2, 1],
            ScaleType::Dorian => &[2, 1, 2, 2, 2, 1, 2],
            ScaleType::Phrygian => &[1, 2, 2, 2, 1, 2, 2],
            ScaleType::Lydian => &[2, 2, 2, 1, 2, 2, 1],
            ScaleType::Mixolydian => &[2, 2, 1, 2, 2, 1, 2],
            ScaleType::Locrian => &[1, 2, 2, 1, 2, 2, 2],
            ScaleType::MajorPentatonic => &[2, 2, 3, 2, 3],
            ScaleType::MinorPentatonic => &[3, 2, 2, 3, 2],
            ScaleType::Blues => &[3, 2, 1, 1, 3, 2],
            ScaleType::LydianDominant => &[2, 2, 2, 1, 2, 1, 2],
            ScaleType::Altered => &[1, 2, 1, 2, 2, 2, 2],
            ScaleType::LocrianNatural2 => &[2, 1, 2, 1, 2, 2, 2],
            ScaleType::HalfWholeDiminished => &[1, 2, 1, 2, 1, 2, 1, 2],
            ScaleType::WholeTone => &[2, 2, 2, 2, 2, 2],
            ScaleType::BebopDominant => &[2, 2, 1, 2, 2, 1, 1, 1],
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            ScaleType::Major => "Major",
            ScaleType::NaturalMinor => "Natural Minor",
            ScaleType::HarmonicMinor => "Harmonic Minor",
            ScaleType::MelodicMinor => "Melodic Minor",
            ScaleType::Dorian => "Dorian",
            ScaleType::Phrygian => "Phrygian",
            ScaleType::Lydian => "Lydian",
            ScaleType::Mixolydian => "Mixolydian",
            ScaleType::Locrian => "Locrian",
            ScaleType::MajorPentatonic => "Major Pentatonic",
            ScaleType::MinorPentatonic => "Minor Pentatonic",
            ScaleType::Blues => "Blues",
            ScaleType::LydianDominant => "Lydian Dominant",
            ScaleType::Altered => "Altered",
            ScaleType::LocrianNatural2 => "Locrian \u{266e}2",
            ScaleType::HalfWholeDiminished => "Half-Whole Dim.",
            ScaleType::WholeTone => "Whole Tone",
            ScaleType::BebopDominant => "Bebop Dominant",
        }
    }

    pub fn category(&self) -> &'static str {
        match self {
            ScaleType::Major | ScaleType::NaturalMinor | ScaleType::HarmonicMinor | ScaleType::MelodicMinor => "common",
            ScaleType::Dorian | ScaleType::Phrygian | ScaleType::Lydian | ScaleType::Mixolydian | ScaleType::Locrian => "modes",
            ScaleType::MajorPentatonic | ScaleType::MinorPentatonic => "pentatonic",
            ScaleType::Blues => "blues",
            ScaleType::LydianDominant
            | ScaleType::Altered
            | ScaleType::LocrianNatural2
            | ScaleType::HalfWholeDiminished
            | ScaleType::WholeTone
            | ScaleType::BebopDominant => "jazz",
        }
    }

    pub fn all() -> &'static [ScaleType] {
        &[
            ScaleType::Major,
            ScaleType::NaturalMinor,
            ScaleType::HarmonicMinor,
            ScaleType::MelodicMinor,
            ScaleType::Dorian,
            ScaleType::Phrygian,
            ScaleType::Lydian,
            ScaleType::Mixolydian,
            ScaleType::Locrian,
            ScaleType::MajorPentatonic,
            ScaleType::MinorPentatonic,
            ScaleType::Blues,
            ScaleType::LydianDominant,
            ScaleType::Altered,
            ScaleType::LocrianNatural2,
            ScaleType::HalfWholeDiminished,
            ScaleType::WholeTone,
            ScaleType::BebopDominant,
        ]
    }
}

/// Build a sequence of 7 letter names starting from the given root letter.
/// E.g., root_letter='G' → ['G', 'A', 'B', 'C', 'D', 'E', 'F']
fn diatonic_letter_sequence(root_letter: char) -> [char; 7] {
    const LETTERS: [char; 7] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    let start = LETTERS
        .iter()
        .position(|&l| l == root_letter.to_ascii_uppercase())
        .unwrap_or(0);
    let mut result = [' '; 7];
    for i in 0..7 {
        result[i] = LETTERS[(start + i) % 7];
    }
    result
}

pub fn build_scale_internal(
    root_name: &str,
    scale_type: ScaleType,
    direction: &str,
) -> Result<Vec<Note>, String> {
    let root = Note::from_name(root_name)?;
    let intervals = scale_type.intervals();
    let use_flats = root.pitch_class.contains('b');

    // Build ascending notes
    let mut ascending = Vec::with_capacity(intervals.len() + 1);
    ascending.push(root.clone());

    let mut current_midi = root.midi;

    if intervals.len() == 7 {
        // 7-note (diatonic) scale: spell each note with a unique letter name
        let root_letter = root.pitch_class.chars().next().unwrap();
        let letters = diatonic_letter_sequence(root_letter);
        for (i, &interval) in intervals.iter().enumerate() {
            current_midi += interval as i32;
            let letter = letters[(i + 1) % 7];
            ascending.push(
                Note::from_midi_with_letter(current_midi, letter)
                    .unwrap_or_else(|_| Note::from_midi_with_spelling(current_midi, use_flats))
            );
        }
    } else {
        // Non-diatonic scale: use flat/sharp spelling based on root
        for &interval in intervals {
            current_midi += interval as i32;
            ascending.push(Note::from_midi_with_spelling(current_midi, use_flats));
        }
    }

    match direction {
        "ascending" => Ok(ascending),
        "descending" => {
            ascending.reverse();
            Ok(ascending)
        }
        "both" => {
            // Ascending then descending, skip the repeated top note
            let mut both = ascending.clone();
            let descending: Vec<Note> = ascending.into_iter().rev().skip(1).collect();
            both.extend(descending);
            Ok(both)
        }
        _ => Err(format!("Invalid direction: {}. Use 'ascending', 'descending', or 'both'.", direction)),
    }
}

// WASM exports

#[wasm_bindgen(js_name = buildScale)]
pub fn build_scale(
    root_name: &str,
    scale_type: ScaleType,
    direction: &str,
) -> Result<JsValue, JsError> {
    let notes = build_scale_internal(root_name, scale_type, direction)
        .map_err(|e| JsError::new(&e))?;
    serde_wasm_bindgen::to_value(&notes).map_err(|e| JsError::new(&e.to_string()))
}

#[wasm_bindgen(js_name = listScaleTypes)]
pub fn list_scale_types() -> JsValue {
    let scales: Vec<ScaleInfo> = ScaleType::all()
        .iter()
        .map(|st| ScaleInfo {
            name: format!("{:?}", st),
            display_name: st.display_name().to_string(),
            category: st.category().to_string(),
        })
        .collect();
    serde_wasm_bindgen::to_value(&scales).unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_c_major_ascending() {
        let notes = build_scale_internal("C4", ScaleType::Major, "ascending").unwrap();
        let names: Vec<&str> = notes.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(names, vec!["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]);
    }

    #[test]
    fn test_c_major_descending() {
        let notes = build_scale_internal("C4", ScaleType::Major, "descending").unwrap();
        let names: Vec<&str> = notes.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(names, vec!["C5", "B4", "A4", "G4", "F4", "E4", "D4", "C4"]);
    }

    #[test]
    fn test_c_major_both() {
        let notes = build_scale_internal("C4", ScaleType::Major, "both").unwrap();
        let names: Vec<&str> = notes.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(
            names,
            vec!["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "B4", "A4", "G4", "F4", "E4", "D4", "C4"]
        );
    }

    #[test]
    fn test_a_natural_minor() {
        let notes = build_scale_internal("A3", ScaleType::NaturalMinor, "ascending").unwrap();
        let names: Vec<&str> = notes.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(names, vec!["A3", "B3", "C4", "D4", "E4", "F4", "G4", "A4"]);
    }

    #[test]
    fn test_e_minor_pentatonic() {
        let notes = build_scale_internal("E2", ScaleType::MinorPentatonic, "ascending").unwrap();
        let names: Vec<&str> = notes.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(names, vec!["E2", "G2", "A2", "B2", "D3", "E3"]);
    }

    #[test]
    fn test_a_blues() {
        let notes = build_scale_internal("A2", ScaleType::Blues, "ascending").unwrap();
        let names: Vec<&str> = notes.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(names, vec!["A2", "C3", "D3", "D#3", "E3", "G3", "A3"]);
    }

    #[test]
    fn test_e_dorian() {
        let notes = build_scale_internal("E2", ScaleType::Dorian, "ascending").unwrap();
        let names: Vec<&str> = notes.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(names, vec!["E2", "F#2", "G2", "A2", "B2", "C#3", "D3", "E3"]);
    }

    #[test]
    fn test_major_pentatonic() {
        let notes = build_scale_internal("C4", ScaleType::MajorPentatonic, "ascending").unwrap();
        let names: Vec<&str> = notes.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(names, vec!["C4", "D4", "E4", "G4", "A4", "C5"]);
    }

    #[test]
    fn test_scale_from_sharp_root() {
        let notes = build_scale_internal("F#2", ScaleType::Major, "ascending").unwrap();
        assert_eq!(notes.len(), 8);
        assert_eq!(notes[0].pitch_class, "F#");
    }

    #[test]
    fn test_list_all_scale_types() {
        let all = ScaleType::all();
        assert_eq!(all.len(), 18);
    }

    #[test]
    fn test_c_lydian_dominant() {
        let notes = build_scale_internal("C4", ScaleType::LydianDominant, "ascending").unwrap();
        let names: Vec<&str> = notes.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(names, vec!["C4", "D4", "E4", "F#4", "G4", "A4", "Bb4", "C5"]);
    }

    #[test]
    fn test_c_altered() {
        let notes = build_scale_internal("C4", ScaleType::Altered, "ascending").unwrap();
        let names: Vec<&str> = notes.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(names, vec!["C4", "Db4", "Eb4", "Fb4", "Gb4", "Ab4", "Bb4", "C5"]);
    }

    #[test]
    fn test_c_locrian_natural2() {
        let notes = build_scale_internal("C4", ScaleType::LocrianNatural2, "ascending").unwrap();
        let names: Vec<&str> = notes.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(names, vec!["C4", "D4", "Eb4", "F4", "Gb4", "Ab4", "Bb4", "C5"]);
    }

    #[test]
    fn test_c_half_whole_diminished() {
        let notes = build_scale_internal("C4", ScaleType::HalfWholeDiminished, "ascending").unwrap();
        let names: Vec<&str> = notes.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(names, vec!["C4", "C#4", "D#4", "E4", "F#4", "G4", "A4", "A#4", "C5"]);
    }

    #[test]
    fn test_c_whole_tone() {
        let notes = build_scale_internal("C4", ScaleType::WholeTone, "ascending").unwrap();
        let names: Vec<&str> = notes.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(names, vec!["C4", "D4", "E4", "F#4", "G#4", "A#4", "C5"]);
    }

    #[test]
    fn test_c_bebop_dominant() {
        let notes = build_scale_internal("C4", ScaleType::BebopDominant, "ascending").unwrap();
        let names: Vec<&str> = notes.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(names, vec!["C4", "D4", "E4", "F4", "G4", "A4", "A#4", "B4", "C5"]);
    }

    #[test]
    fn test_gb_major_diatonic_spelling() {
        let notes = build_scale_internal("Gb2", ScaleType::Major, "ascending").unwrap();
        let names: Vec<&str> = notes.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(names, vec!["Gb2", "Ab2", "Bb2", "Cb3", "Db3", "Eb3", "F3", "Gb3"]);
    }

    #[test]
    fn test_bb_major_diatonic_spelling() {
        let notes = build_scale_internal("Bb2", ScaleType::Major, "ascending").unwrap();
        let names: Vec<&str> = notes.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(names, vec!["Bb2", "C3", "D3", "Eb3", "F3", "G3", "A3", "Bb3"]);
    }

    #[test]
    fn test_f_sharp_major_diatonic_spelling() {
        let notes = build_scale_internal("F#2", ScaleType::Major, "ascending").unwrap();
        let names: Vec<&str> = notes.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(names, vec!["F#2", "G#2", "A#2", "B2", "C#3", "D#3", "E#3", "F#3"]);
    }

    #[test]
    fn test_eb_minor_pentatonic_flat_spelling() {
        // Non-diatonic (5 intervals): should use flat array for flat root
        let notes = build_scale_internal("Eb2", ScaleType::MinorPentatonic, "ascending").unwrap();
        let names: Vec<&str> = notes.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(names, vec!["Eb2", "Gb2", "Ab2", "Bb2", "Db3", "Eb3"]);
    }

    #[test]
    fn test_invalid_direction() {
        let result = build_scale_internal("C4", ScaleType::Major, "sideways");
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_root() {
        let result = build_scale_internal("X9", ScaleType::Major, "ascending");
        assert!(result.is_err());
    }
}
