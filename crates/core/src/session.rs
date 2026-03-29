use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::note::Note;
use crate::validation::validate_note_internal_full;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SessionConfig {
    pub scale_notes: Vec<Note>,
    pub cents_tolerance: f64,
    pub min_hold_detections: u32,
    #[serde(default)]
    pub ignore_octave: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum SessionPhase {
    Idle,
    Playing,
    Complete,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NoteAttempt {
    pub expected_note: Note,
    pub detected_note: Option<Note>,
    pub result: String, // "correct", "incorrect", "missed"
    pub cents_off: f64,
    pub detected_frequency: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SessionScore {
    pub total_notes: usize,
    pub correct_notes: usize,
    pub incorrect_notes: usize,
    pub missed_notes: usize,
    pub accuracy_percent: f64,
    pub average_cents_offset: f64,
    pub note_results: Vec<NoteAttempt>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SessionState {
    pub phase: SessionPhase,
    pub current_note_index: usize,
    pub total_notes: usize,
    pub current_hold_count: u32,
    pub min_hold_detections: u32,
    pub last_result: Option<String>,
    pub correct_count: usize,
    pub incorrect_count: usize,
}

/// Number of frames to ignore after advancing to a new note.
/// At ~60fps this is ~250ms — enough for a bass note to stop ringing
/// without feeling sluggish.
const GRACE_FRAMES_AFTER_ADVANCE: u32 = 15;

/// Number of frames after a new attack is detected where wrong notes
/// are suppressed but correct notes still count. This allows slides
/// and hammer-ons to settle onto the target pitch without penalty.
/// At ~60fps this is ~133ms.
const SETTLE_FRAMES_AFTER_ATTACK: u32 = 8;

/// RMS amplitude below this is considered silence (note has stopped).
const SILENCE_RMS_THRESHOLD: f64 = 0.005;

/// A new frame's RMS must exceed the running average by this factor
/// to be considered a transient attack (new note onset).
const TRANSIENT_RATIO: f64 = 2.5;

/// Smoothing factor for exponential moving average of RMS.
/// Lower = smoother (slower to adapt), higher = more responsive.
const RMS_SMOOTH_ALPHA: f64 = 0.08;

struct SessionInternal {
    config: SessionConfig,
    phase: SessionPhase,
    current_note_index: usize,
    hold_count: u32,
    grace_frames_remaining: u32,
    waiting_for_attack: bool,
    settle_frames_remaining: u32,
    last_confirmed_midi: Option<i32>,
    last_wrong_midi: Option<i32>,
    attempts: Vec<NoteAttempt>,
    correct_count: usize,
    incorrect_count: usize,
    last_result: Option<String>,
    /// Exponential moving average of RMS amplitude, used for transient detection.
    rms_avg: f64,
    /// Whether RMS dropped below the silence threshold since the last note advance.
    silence_detected: bool,
}

#[wasm_bindgen(js_name = PracticeSession)]
pub struct WasmPracticeSession {
    inner: Option<SessionInternal>,
}

#[wasm_bindgen(js_class = PracticeSession)]
impl WasmPracticeSession {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        WasmPracticeSession { inner: None }
    }

    /// Start a new practice session with the given config (passed as JsValue).
    pub fn start(&mut self, config_js: JsValue) -> Result<JsValue, JsError> {
        let config: SessionConfig = serde_wasm_bindgen::from_value(config_js)
            .map_err(|e| JsError::new(&format!("Invalid config: {}", e)))?;

        if config.scale_notes.is_empty() {
            return Err(JsError::new("Scale notes cannot be empty"));
        }

        let total_notes = config.scale_notes.len();
        self.inner = Some(SessionInternal {
            config,
            phase: SessionPhase::Playing,
            current_note_index: 0,
            hold_count: 0,
            grace_frames_remaining: 0,
            waiting_for_attack: false,
            settle_frames_remaining: 0,
            last_confirmed_midi: None,
            last_wrong_midi: None,
            attempts: Vec::with_capacity(total_notes),
            correct_count: 0,
            incorrect_count: 0,
            last_result: None,
            rms_avg: 0.0,
            silence_detected: false,
        });

        self.get_state()
    }

    /// Process a detected pitch frame.
    /// Returns the updated session state.
    #[wasm_bindgen(js_name = processFrame)]
    pub fn process_frame(
        &mut self,
        detected_frequency: f64,
        detected_clarity: f64,
        detected_rms: f64,
    ) -> Result<JsValue, JsError> {
        let session = self
            .inner
            .as_mut()
            .ok_or_else(|| JsError::new("Session not started"))?;

        if session.phase != SessionPhase::Playing {
            return self.get_state();
        }

        // Always update the running RMS average (even during grace/waiting)
        // so the baseline is accurate when we need it for transient detection.
        session.rms_avg = RMS_SMOOTH_ALPHA * detected_rms
            + (1.0 - RMS_SMOOTH_ALPHA) * session.rms_avg;

        // Grace period: unconditionally skip the first N frames after advancing
        if session.grace_frames_remaining > 0 {
            session.grace_frames_remaining -= 1;
            // Track silence during grace period too
            if detected_rms < SILENCE_RMS_THRESHOLD {
                session.silence_detected = true;
            }
            return self.get_state();
        }

        // Attack detection: after grace period, wait for evidence of a new
        // note onset before validating. Accepts a new note when EITHER:
        //   (a) Silence gap: RMS dropped below threshold, then sound returned
        //   (b) Transient spike: RMS jumped well above the running average
        // Pitch-change from the previous confirmed note is still required as
        // a secondary check to avoid re-triggering on the same sustained note.
        if session.waiting_for_attack {
            // Track silence
            if detected_rms < SILENCE_RMS_THRESHOLD {
                session.silence_detected = true;
                return self.get_state();
            }

            // Check for amplitude-based new attack evidence
            let has_silence_gap = session.silence_detected;
            let has_transient = session.rms_avg > 1e-6
                && detected_rms > session.rms_avg * TRANSIENT_RATIO;
            let has_amplitude_evidence = has_silence_gap || has_transient;

            if !has_amplitude_evidence {
                // No amplitude evidence of a new note — keep waiting
                return self.get_state();
            }

            // Also verify pitch has changed from the last confirmed note
            // (prevents re-triggering if the same note is struck again
            // with a transient but the target has moved on)
            let detected_midi = crate::note::frequency_to_midi_internal(detected_frequency)
                .round() as i32;
            if let Some(prev_midi) = session.last_confirmed_midi {
                let still_same = if session.config.ignore_octave {
                    detected_midi.rem_euclid(12) == prev_midi.rem_euclid(12)
                } else {
                    detected_midi == prev_midi
                };
                if still_same {
                    return self.get_state();
                }
            }

            // New attack confirmed — proceed to validation
            session.waiting_for_attack = false;
            session.settle_frames_remaining = SETTLE_FRAMES_AFTER_ATTACK;
        }

        // Track whether we're in the settle window (slides/hammer-ons settling)
        let in_settle = session.settle_frames_remaining > 0;
        if in_settle {
            session.settle_frames_remaining -= 1;
        }

        let expected = &session.config.scale_notes[session.current_note_index];
        let validation = validate_note_internal_full(
            detected_frequency,
            detected_clarity,
            expected.midi,
            session.config.cents_tolerance,
            session.config.ignore_octave,
        );

        if validation.is_correct {
            session.hold_count += 1;
            session.last_wrong_midi = None;
            // Landing on the correct note ends the settle window early
            session.settle_frames_remaining = 0;

            if session.hold_count >= session.config.min_hold_detections {
                // Note confirmed correct, advance
                let confirmed_midi = expected.midi;
                session.attempts.push(NoteAttempt {
                    expected_note: expected.clone(),
                    detected_note: Some(validation.detected_note),
                    result: "correct".to_string(),
                    cents_off: validation.cents_off,
                    detected_frequency,
                });
                session.correct_count += 1;
                session.last_result = Some("correct".to_string());
                session.hold_count = 0;
                session.current_note_index += 1;

                // Start grace period + attack detection for the next note
                session.grace_frames_remaining = GRACE_FRAMES_AFTER_ADVANCE;
                session.waiting_for_attack = true;
                session.silence_detected = false;
                session.last_confirmed_midi = Some(confirmed_midi);

                if session.current_note_index >= session.config.scale_notes.len() {
                    session.phase = SessionPhase::Complete;
                }
            }
        } else {
            if session.hold_count > 0 {
                session.hold_count = 0;
            }
            // During settle window, suppress wrong note recording —
            // the player may be sliding up to the target pitch.
            if in_settle {
                return self.get_state();
            }
            // Record wrong note only once per distinct wrong pitch.
            // While the same wrong note keeps ringing, don't log duplicates.
            let detected_midi = validation.detected_note.midi;
            let is_new_wrong = session.last_wrong_midi != Some(detected_midi);
            if is_new_wrong && detected_clarity > 0.7 && validation.match_type == "wrong" {
                session.attempts.push(NoteAttempt {
                    expected_note: expected.clone(),
                    detected_note: Some(validation.detected_note),
                    result: "incorrect".to_string(),
                    cents_off: validation.cents_off,
                    detected_frequency,
                });
                session.incorrect_count += 1;
                session.last_result = Some("incorrect".to_string());
                session.last_wrong_midi = Some(detected_midi);
            }
        }

        self.get_state()
    }

    /// Skip the current note (mark as missed) and advance.
    #[wasm_bindgen(js_name = skipNote)]
    pub fn skip_note(&mut self) -> Result<JsValue, JsError> {
        let session = self
            .inner
            .as_mut()
            .ok_or_else(|| JsError::new("Session not started"))?;

        if session.phase != SessionPhase::Playing {
            return self.get_state();
        }

        let expected = &session.config.scale_notes[session.current_note_index];
        session.attempts.push(NoteAttempt {
            expected_note: expected.clone(),
            detected_note: None,
            result: "missed".to_string(),
            cents_off: 0.0,
            detected_frequency: 0.0,
        });
        session.last_result = Some("missed".to_string());
        session.hold_count = 0;
        session.current_note_index += 1;

        if session.current_note_index >= session.config.scale_notes.len() {
            session.phase = SessionPhase::Complete;
        }

        self.get_state()
    }

    /// Get the current session state.
    #[wasm_bindgen(js_name = getState)]
    pub fn get_state(&self) -> Result<JsValue, JsError> {
        let session = self
            .inner
            .as_ref()
            .ok_or_else(|| JsError::new("Session not started"))?;

        let state = SessionState {
            phase: session.phase.clone(),
            current_note_index: session.current_note_index,
            total_notes: session.config.scale_notes.len(),
            current_hold_count: session.hold_count,
            min_hold_detections: session.config.min_hold_detections,
            last_result: session.last_result.clone(),
            correct_count: session.correct_count,
            incorrect_count: session.incorrect_count,
        };

        serde_wasm_bindgen::to_value(&state).map_err(|e| JsError::new(&e.to_string()))
    }

    /// Get the final score. Only valid when phase is Complete.
    #[wasm_bindgen(js_name = getScore)]
    pub fn get_score(&self) -> Result<JsValue, JsError> {
        let session = self
            .inner
            .as_ref()
            .ok_or_else(|| JsError::new("Session not started"))?;

        if session.phase != SessionPhase::Complete {
            return Err(JsError::new("Session is not complete yet"));
        }

        let score = compute_score(&session.attempts, session.config.scale_notes.len());
        serde_wasm_bindgen::to_value(&score).map_err(|e| JsError::new(&e.to_string()))
    }

    /// Reset the session to idle state.
    pub fn reset(&mut self) {
        self.inner = None;
    }
}

fn compute_score(attempts: &[NoteAttempt], total_scale_notes: usize) -> SessionScore {
    let correct_notes = attempts.iter().filter(|a| a.result == "correct").count();
    let incorrect_notes = attempts.iter().filter(|a| a.result == "incorrect").count();
    let missed_notes = total_scale_notes.saturating_sub(correct_notes);

    let correct_attempts: Vec<&NoteAttempt> =
        attempts.iter().filter(|a| a.result == "correct").collect();
    let average_cents_offset = if correct_attempts.is_empty() {
        0.0
    } else {
        let sum: f64 = correct_attempts.iter().map(|a| a.cents_off.abs()).sum();
        sum / correct_attempts.len() as f64
    };

    let total_attempts = correct_notes + incorrect_notes;
    let accuracy_percent = if total_attempts > 0 {
        (correct_notes as f64 / total_attempts as f64) * 100.0
    } else {
        0.0
    };

    SessionScore {
        total_notes: total_scale_notes,
        correct_notes,
        incorrect_notes,
        missed_notes,
        accuracy_percent,
        average_cents_offset,
        note_results: attempts.to_vec(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::note::midi_to_frequency_internal;
    use crate::scale::{build_scale_internal, ScaleType};

    fn make_config() -> SessionConfig {
        let notes = build_scale_internal("C4", ScaleType::Major, "ascending").unwrap();
        SessionConfig {
            scale_notes: notes,
            cents_tolerance: 50.0,
            min_hold_detections: 2,
            ignore_octave: false,
        }
    }

    #[test]
    fn test_session_start() {
        let config = make_config();
        let mut session = WasmPracticeSession::new();
        // We can't use wasm_bindgen methods directly in unit tests,
        // but we can test the internal logic.
        session.inner = Some(SessionInternal {
            config: config.clone(),
            phase: SessionPhase::Playing,
            current_note_index: 0,
            hold_count: 0,
            grace_frames_remaining: 0,
            waiting_for_attack: false,
            settle_frames_remaining: 0,
            last_confirmed_midi: None,
            last_wrong_midi: None,
            attempts: Vec::new(),
            correct_count: 0,
            incorrect_count: 0,
            last_result: None,
            rms_avg: 0.0,
            silence_detected: false,
        });

        let inner = session.inner.as_ref().unwrap();
        assert_eq!(inner.phase, SessionPhase::Playing);
        assert_eq!(inner.current_note_index, 0);
    }

    #[test]
    fn test_compute_score_all_correct() {
        let notes = build_scale_internal("C4", ScaleType::Major, "ascending").unwrap();
        let attempts: Vec<NoteAttempt> = notes
            .iter()
            .map(|n| NoteAttempt {
                expected_note: n.clone(),
                detected_note: Some(n.clone()),
                result: "correct".to_string(),
                cents_off: 2.0,
                detected_frequency: n.frequency,
            })
            .collect();

        let score = compute_score(&attempts, notes.len());
        assert_eq!(score.accuracy_percent, 100.0);
        assert_eq!(score.correct_notes, 8);
        assert_eq!(score.incorrect_notes, 0);
        assert_eq!(score.missed_notes, 0);
        assert!((score.average_cents_offset - 2.0).abs() < 0.01);
    }

    #[test]
    fn test_compute_score_mixed() {
        let notes = build_scale_internal("C4", ScaleType::Major, "ascending").unwrap();
        let mut attempts = Vec::new();

        // 4 correct
        for note in &notes[0..4] {
            attempts.push(NoteAttempt {
                expected_note: note.clone(),
                detected_note: Some(note.clone()),
                result: "correct".to_string(),
                cents_off: 5.0,
                detected_frequency: note.frequency,
            });
        }
        // 2 incorrect
        for note in &notes[4..6] {
            attempts.push(NoteAttempt {
                expected_note: note.clone(),
                detected_note: Some(Note::from_midi(note.midi + 1)),
                result: "incorrect".to_string(),
                cents_off: 100.0,
                detected_frequency: midi_to_frequency_internal(note.midi + 1),
            });
        }

        let score = compute_score(&attempts, 8);
        assert_eq!(score.correct_notes, 4);
        assert_eq!(score.incorrect_notes, 2);
        assert_eq!(score.missed_notes, 4); // 8 total - 4 correct
        // accuracy = 4 correct / (4 correct + 2 incorrect) = 66.67%
        assert!((score.accuracy_percent - 66.67).abs() < 0.1);
    }

    #[test]
    fn test_compute_score_empty() {
        let score = compute_score(&[], 8);
        assert_eq!(score.accuracy_percent, 0.0);
        assert_eq!(score.missed_notes, 8);
    }
}
