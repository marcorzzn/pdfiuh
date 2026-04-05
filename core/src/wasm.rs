#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
use crate::annotations::{Annotation, AnnotationLayer, Color, Point, Rect};

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub struct PdfWebEngine {
    layer: AnnotationLayer,
    current_freehand_points: Vec<Point>,
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
impl PdfWebEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(page_num: usize) -> Result<PdfWebEngine, JsValue> {
        Ok(PdfWebEngine {
            layer: AnnotationLayer::new(page_num),
            current_freehand_points: Vec::new(),
        })
    }

    #[wasm_bindgen]
    pub fn add_highlight(&mut self, x: f32, y: f32, width: f32, height: f32) {
        let rect = Rect {
            origin: Point { x, y },
            size: crate::annotations::Size { width, height },
        };
        let color = Color::new(255, 255, 0, 128); // Yellow with some transparency
        
        let annotation = Annotation::Highlight {
            rects: vec![rect],
            color,
        };
        
        self.layer.add_annotation(annotation);
    }

    #[wasm_bindgen]
    pub fn deserialize_annotations(&mut self, bytes: &[u8]) -> Result<(), JsValue> {
        match AnnotationLayer::deserialize_from_bytes(bytes) {
            Ok(layer) => {
                self.layer = layer;
                Ok(())
            }
            Err(e) => Err(JsValue::from_str(&format!("Failed to deserialize: {}", e))),
        }
    }

    #[wasm_bindgen]
    pub fn clear_annotations(&mut self) {
        self.layer.annotations.clear();
        self.current_freehand_points.clear();
    }

    #[wasm_bindgen]
    pub fn add_freehand_point(&mut self, x: f32, y: f32) {
        self.current_freehand_points.push(Point { x, y });
    }

    #[wasm_bindgen]
    pub fn commit_freehand(&mut self, r: u8, g: u8, b: u8, a: u8, thickness: f32) {
        if !self.current_freehand_points.is_empty() {
            let points = std::mem::take(&mut self.current_freehand_points);
            let color = Color::new(r, g, b, a);
            self.layer.add_annotation(Annotation::FreehandInk { points, color, thickness });
        }
    }

    #[wasm_bindgen]
    pub fn add_sticky_note(&mut self, x: f32, y: f32, text: &str) {
        let origin = Point { x, y };
        let color = Color::new(255, 255, 153, 255); // Sticky note color
        self.layer.add_annotation(Annotation::StickyNote { origin, text: text.to_string(), color });
    }
    
    #[wasm_bindgen]
    pub fn serialize_annotations(&self) -> Result<js_sys::Uint8Array, JsValue> {
        match self.layer.serialize_to_bytes() {
            Ok(bytes) => Ok(js_sys::Uint8Array::from(&bytes[..])),
            Err(e) => Err(JsValue::from_str(&format!("Failed to serialize: {}", e))),
        }
    }
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
impl PdfWebEngine {
    #[wasm_bindgen]
    pub fn load_document(&mut self, _bytes: &[u8]) -> Result<(), JsValue> {
        // Fallback temporaneo per WASM dato che non abbiamo MuPDF qui
        // Nella vera architettura, il rendering raster verrà demandato a PDF.js lato JS
        // e questo core gestirà solo la logica dei layer e vettoriale.
        web_sys::console::log_1(&"Document loaded virtually in WASM core.".into());
        Ok(())
    }

    #[wasm_bindgen]
    pub fn render_page(&self, _page_num: usize) -> Result<(), JsValue> {
        web_sys::console::log_1(&"Page rendering logic is deferred to PDF.js on the frontend.".into());
        Ok(())
    }
}
