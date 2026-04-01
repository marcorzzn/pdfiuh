#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
use crate::annotations::{Annotation, AnnotationLayer, Color, Point, Rect};

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub struct PdfWebEngine {
    layer: AnnotationLayer,
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
impl PdfWebEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(page_num: usize) -> Result<PdfWebEngine, JsValue> {
        Ok(PdfWebEngine {
            layer: AnnotationLayer::new(page_num),
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
    pub fn serialize_annotations(&self) -> Result<js_sys::Uint8Array, JsValue> {
        match self.layer.serialize_to_bytes() {
            Ok(bytes) => Ok(js_sys::Uint8Array::from(&bytes[..])),
            Err(e) => Err(JsValue::from_str(&format!("Failed to serialize: {}", e))),
        }
    }
}
