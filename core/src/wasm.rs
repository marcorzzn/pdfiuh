#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
use crate::annotations::{Annotation, AnnotationLayer, Color, Point, Rect};

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub struct PdfWebEngine {
    layer: AnnotationLayer,
    current_ink: Vec<Point>,
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
impl PdfWebEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(page_num: usize) -> Result<PdfWebEngine, JsValue> {
        Ok(PdfWebEngine {
            layer: AnnotationLayer::new(page_num),
            current_ink: Vec::new(),
        })
    }

    #[wasm_bindgen]
    pub fn set_page(&mut self, page_num: usize) {
        if self.layer.page_number != page_num {
            self.layer = AnnotationLayer::new(page_num);
            self.current_ink.clear();
        }
    }

    #[wasm_bindgen]
    pub fn annotation_count(&self) -> usize {
        self.layer.annotations.len()
    }

    #[wasm_bindgen]
    pub fn add_highlight_colored(&mut self, x: f32, y: f32, width: f32, height: f32, r: u8, g: u8, b: u8, a: u8) {
        let rect = Rect {
            origin: Point { x, y },
            size: crate::annotations::Size { width, height },
        };
        let color = Color::new(r, g, b, a);
        
        self.layer.add_annotation(Annotation::Highlight {
            rects: vec![rect],
            color,
        });
    }

    #[wasm_bindgen]
    pub fn add_freehand_point(&mut self, x: f32, y: f32) {
        self.current_ink.push(Point { x, y });
    }

    #[wasm_bindgen]
    pub fn freehand_point_count(&self) -> usize {
        self.current_ink.len()
    }

    #[wasm_bindgen]
    pub fn discard_freehand(&mut self) {
        self.current_ink.clear();
    }

    #[wasm_bindgen]
    pub fn commit_freehand(&mut self, r: u8, g: u8, b: u8, a: u8, thickness: f32) -> bool {
        if self.current_ink.len() >= 2 {
            let color = Color::new(r, g, b, a);
            let points = std::mem::take(&mut self.current_ink);
            let annotation = Annotation::Ink {
                paths: vec![points],
                color,
                thickness,
            };
            self.layer.add_annotation(annotation);
            true
        } else {
            self.current_ink.clear();
            false
        }
    }

    #[wasm_bindgen]
    pub fn add_sticky_note(&mut self, x: f32, y: f32, text: &str) {
        let color = Color::new(255, 255, 153, 255);
        let annotation = Annotation::Note {
            origin: Point { x, y },
            content: text.to_string(),
            color,
        };
        self.layer.add_annotation(annotation);
    }

    #[wasm_bindgen]
    pub fn clear_annotations(&mut self) {
        let page_num = self.layer.page_number;
        self.layer = AnnotationLayer::new(page_num);
        self.current_ink.clear();
    }
    
    #[wasm_bindgen]
    pub fn serialize_annotations(&self) -> Result<js_sys::Uint8Array, JsValue> {
        match self.layer.serialize_to_bytes() {
            Ok(bytes) => Ok(js_sys::Uint8Array::from(&bytes[..])),
            Err(e) => Err(JsValue::from_str(&format!("Failed to serialize: {}", e))),
        }
    }

    #[wasm_bindgen]
    pub fn deserialize_annotations(&mut self, bytes: &[u8]) -> Result<(), JsValue> {
        match AnnotationLayer::deserialize_from_bytes(bytes) {
            Ok(layer) => {
                self.layer = layer;
                Ok(())
            },
            Err(e) => Err(JsValue::from_str(&format!("Failed to deserialize: {}", e))),
        }
    }

    #[wasm_bindgen]
    pub fn force_deserialize_annotations(&mut self, bytes: &[u8]) -> Result<(), JsValue> {
        // Variante che non controlla il numero di pagina, utile per il caricamento iniziale forzato
        match AnnotationLayer::deserialize_from_bytes(bytes) {
            Ok(layer) => {
                self.layer = layer;
                Ok(())
            },
            Err(e) => Err(JsValue::from_str(&format!("Failed to force deserialize: {}", e))),
        }
    }
}
