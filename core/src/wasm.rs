/// pdfiuh — Bridge WebAssembly
///
/// Espone `PdfWebEngine` a JavaScript tramite wasm-bindgen.
/// Responsabilità: gestione stateful delle annotazioni vettoriali (Glass Pane).
/// Il rendering raster dei PDF è delegato a PDF.js nel Web Worker JS.
///
/// Invarianti di sicurezza:
///   - Zero uso di `.unwrap()` o `.expect()`.
///   - Ogni fallimento è propagato come `JsValue` leggibile da JS.
///   - La struttura è thread-local (WASM single-threaded per definizione).

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
use js_sys::Uint8Array;

#[cfg(target_arch = "wasm32")]
use crate::annotations::{Annotation, AnnotationLayer, Color, Point, Rect, Size};

// ---------------------------------------------------------------------------
// Costanti
// ---------------------------------------------------------------------------

/// Colore giallo trasparente di default per le evidenziazioni.
#[cfg(target_arch = "wasm32")]
const HIGHLIGHT_COLOR: Color = Color { r: 255, g: 255, b: 0, a: 128 };

/// Colore di default per le note adesive (giallo chiaro opaco).
#[cfg(target_arch = "wasm32")]
const STICKY_NOTE_COLOR: Color = Color { r: 255, g: 255, b: 153, a: 255 };

/// Soglia minima di punti per considerare valido un tratto a mano libera.
#[cfg(target_arch = "wasm32")]
const FREEHAND_MIN_POINTS: usize = 2;

// ---------------------------------------------------------------------------
// Struct principale
// ---------------------------------------------------------------------------

/// Motore di annotazione PDF lato web.
///
/// Mantiene in memoria tutte le annotazioni vettoriali della pagina corrente
/// e il buffer del tratto a mano libera ancora in costruzione.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub struct PdfWebEngine {
    /// Layer delle annotazioni finalizzate per la pagina corrente.
    layer: AnnotationLayer,
    /// Buffer temporaneo dei punti del tratto freehand in costruzione.
    /// Viene svuotato da `commit_freehand` o `discard_freehand`.
    current_freehand_points: Vec<Point>,
}

// ---------------------------------------------------------------------------
// Implementazione wasm-bindgen
// ---------------------------------------------------------------------------

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
impl PdfWebEngine {
    // -----------------------------------------------------------------------
    // Costruttore / ciclo di vita
    // -----------------------------------------------------------------------

    /// Crea un nuovo motore per la pagina specificata (1-indexed come PDF.js).
    ///
    /// # Errori
    /// Restituisce un `JsValue` con descrizione testuale se il numero di pagina
    /// è zero (non valido nella specifica PDF).
    #[wasm_bindgen(constructor)]
    pub fn new(page_num: usize) -> Result<PdfWebEngine, JsValue> {
        if page_num == 0 {
            return Err(JsValue::from_str(
                "PdfWebEngine: page_num deve essere >= 1 (indicizzazione PDF 1-based)",
            ));
        }
        Ok(PdfWebEngine {
            layer: AnnotationLayer::new(page_num),
            current_freehand_points: Vec::new(),
        })
    }

    /// Cambia la pagina attiva, azzerando il layer e il buffer freehand.
    ///
    /// Chiama `serialize_annotations` prima di questo metodo se vuoi
    /// salvare lo stato della pagina corrente in IndexedDB.
    ///
    /// # Errori
    /// Come `new`, rifiuta `page_num == 0`.
    #[wasm_bindgen]
    pub fn set_page(&mut self, page_num: usize) -> Result<(), JsValue> {
        if page_num == 0 {
            return Err(JsValue::from_str(
                "set_page: page_num deve essere >= 1",
            ));
        }
        self.layer = AnnotationLayer::new(page_num);
        self.current_freehand_points.clear();
        Ok(())
    }

    /// Restituisce il numero di pagina corrente (1-indexed).
    #[wasm_bindgen]
    pub fn page_num(&self) -> usize {
        self.layer.page_num
    }

    // -----------------------------------------------------------------------
    // Annotazioni finalizzate
    // -----------------------------------------------------------------------

    /// Aggiunge un'evidenziazione rettangolare gialla alla pagina corrente.
    ///
    /// `x`, `y` sono le coordinate dell'angolo superiore sinistro in punti PDF.
    /// `width`, `height` sono le dimensioni in punti PDF.
    #[wasm_bindgen]
    pub fn add_highlight(&mut self, x: f32, y: f32, width: f32, height: f32) {
        let rect = Rect {
            origin: Point { x, y },
            size: Size { width, height },
        };
        self.layer.add_annotation(Annotation::Highlight {
            rects: vec![rect],
            color: HIGHLIGHT_COLOR,
        });
    }

    /// Aggiunge un'evidenziazione con colore RGBA personalizzato.
    ///
    /// Utile per lo switcher colore nella toolbar.
    #[wasm_bindgen]
    pub fn add_highlight_colored(
        &mut self,
        x: f32,
        y: f32,
        width: f32,
        height: f32,
        r: u8,
        g: u8,
        b: u8,
        a: u8,
    ) {
        let rect = Rect {
            origin: Point { x, y },
            size: Size { width, height },
        };
        self.layer.add_annotation(Annotation::Highlight {
            rects: vec![rect],
            color: Color::new(r, g, b, a),
        });
    }

    /// Aggiunge una sottolineatura rettangolare alla pagina corrente.
    #[wasm_bindgen]
    pub fn add_underline(&mut self, x: f32, y: f32, width: f32, height: f32) {
        let rect = Rect {
            origin: Point { x, y },
            size: Size { width, height },
        };
        self.layer.add_annotation(Annotation::Underline {
            rects: vec![rect],
            color: Color::new(30, 100, 220, 200),
        });
    }

    /// Aggiunge una nota adesiva in un punto specifico della pagina.
    ///
    /// `text` viene copiato: è sicuro passare una stringa JS temporanea.
    #[wasm_bindgen]
    pub fn add_sticky_note(&mut self, x: f32, y: f32, text: &str) {
        self.layer.add_annotation(Annotation::StickyNote {
            origin: Point { x, y },
            text: text.to_string(),
            color: STICKY_NOTE_COLOR,
        });
    }

    // -----------------------------------------------------------------------
    // Tratto freehand (inchiostro)
    // -----------------------------------------------------------------------

    /// Aggiunge un punto al buffer del tratto freehand in costruzione.
    ///
    /// Chiama questo metodo ad ogni evento `pointermove` sul canvas.
    /// Il punto viene ignorato silenziosamente se coincide esattamente con
    /// l'ultimo inserito (deduplicazione anti-jitter).
    #[wasm_bindgen]
    pub fn add_freehand_point(&mut self, x: f32, y: f32) {
        if let Some(last) = self.current_freehand_points.last() {
            // Deduplicazione: scarta punti identici (coordinate esatte).
            if (last.x - x).abs() < f32::EPSILON && (last.y - y).abs() < f32::EPSILON {
                return;
            }
        }
        self.current_freehand_points.push(Point { x, y });
    }

    /// Finalizza il tratto freehand, lo aggiunge alle annotazioni e svuota il buffer.
    ///
    /// Restituisce `true` se il tratto è stato aggiunto (sufficienti punti),
    /// `false` se il buffer era troppo corto e il tratto è stato scartato.
    ///
    /// Chiamare all'evento `pointerup` o `pointercancel`.
    #[wasm_bindgen]
    pub fn commit_freehand(&mut self, r: u8, g: u8, b: u8, a: u8, thickness: f32) -> bool {
        if self.current_freehand_points.len() < FREEHAND_MIN_POINTS {
            self.current_freehand_points.clear();
            return false;
        }
        let points = std::mem::take(&mut self.current_freehand_points);
        self.layer.add_annotation(Annotation::FreehandInk {
            points,
            color: Color::new(r, g, b, a),
            thickness,
        });
        true
    }

    /// Scarta il tratto freehand in costruzione senza salvarlo.
    ///
    /// Utile se l'utente preme Escape durante il disegno.
    #[wasm_bindgen]
    pub fn discard_freehand(&mut self) {
        self.current_freehand_points.clear();
    }

    /// Numero di punti freehand attualmente nel buffer (utile per debug/UI).
    #[wasm_bindgen]
    pub fn freehand_point_count(&self) -> usize {
        self.current_freehand_points.len()
    }

    // -----------------------------------------------------------------------
    // Stato del layer
    // -----------------------------------------------------------------------

    /// Rimuove tutte le annotazioni finalizzate e svuota il buffer freehand.
    #[wasm_bindgen]
    pub fn clear_annotations(&mut self) {
        self.layer.annotations.clear();
        self.current_freehand_points.clear();
    }

    /// Numero di annotazioni finalizzate nella pagina corrente.
    #[wasm_bindgen]
    pub fn annotation_count(&self) -> usize {
        self.layer.annotations.len()
    }

    // -----------------------------------------------------------------------
    // Serializzazione / deserializzazione (persistenza IndexedDB)
    // -----------------------------------------------------------------------

    /// Serializza il layer di annotazioni in un buffer bincode.
    ///
    /// Il buffer risultante va salvato in IndexedDB con chiave
    /// `"annotations:<docHash>:<pageNum>"` per garantire isolamento per documento.
    ///
    /// # Errori
    /// Fallisce se la serializzazione bincode produce un errore interno.
    #[wasm_bindgen]
    pub fn serialize_annotations(&self) -> Result<Uint8Array, JsValue> {
        self.layer
            .serialize_to_bytes()
            .map(|bytes| Uint8Array::from(&bytes[..]))
            .map_err(|e| JsValue::from_str(&format!("serialize_annotations: {}", e)))
    }

    /// Idrata il layer di annotazioni da un buffer bincode (proveniente da IndexedDB).
    ///
    /// **Sovrascrive completamente** lo stato corrente del layer.
    /// Chiamare solo dopo aver cambiato pagina o aperto un documento.
    /// Il buffer freehand in costruzione viene sempre azzerato.
    ///
    /// # Errori
    /// Fallisce se i byte non rappresentano un `AnnotationLayer` bincode valido,
    /// o se la versione dello schema è incompatibile.
    #[wasm_bindgen]
    pub fn deserialize_annotations(&mut self, bytes: &[u8]) -> Result<(), JsValue> {
        // Svuota sempre il buffer freehand per coerenza.
        self.current_freehand_points.clear();

        if bytes.is_empty() {
            // Buffer vuoto = nessuna annotazione salvata. Non è un errore.
            self.layer.annotations.clear();
            return Ok(());
        }

        match AnnotationLayer::deserialize_from_bytes(bytes) {
            Ok(restored_layer) => {
                // Sanity check: la pagina del layer ripristinato deve corrispondere
                // alla pagina corrente del motore.
                if restored_layer.page_num != self.layer.page_num {
                    return Err(JsValue::from_str(&format!(
                        "deserialize_annotations: page mismatch — \
                         engine è a pagina {}, layer salvato è pagina {}",
                        self.layer.page_num, restored_layer.page_num
                    )));
                }
                self.layer = restored_layer;
                Ok(())
            }
            Err(e) => Err(JsValue::from_str(&format!(
                "deserialize_annotations: schema bincode non valido — {}",
                e
            ))),
        }
    }

    /// Sostituisce il layer corrente con quello deserializzato senza controllo pagina.
    ///
    /// Usare quando si carica un layer da un documento e la pagina corrente
    /// viene impostata immediatamente dopo (es. apertura documento + ripristino stato).
    #[wasm_bindgen]
    pub fn force_deserialize_annotations(&mut self, bytes: &[u8]) -> Result<(), JsValue> {
        self.current_freehand_points.clear();

        if bytes.is_empty() {
            self.layer.annotations.clear();
            return Ok(());
        }

        match AnnotationLayer::deserialize_from_bytes(bytes) {
            Ok(restored_layer) => {
                self.layer = restored_layer;
                Ok(())
            }
            Err(e) => Err(JsValue::from_str(&format!(
                "force_deserialize_annotations: {}", e
            ))),
        }
    }
}
