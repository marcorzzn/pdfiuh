use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Point {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Size {
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Rect {
    pub origin: Point,
    pub size: Size,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

impl Color {
    pub fn new(r: u8, g: u8, b: u8, a: u8) -> Self {
        Self { r, g, b, a }
    }
}

/// The atomic unit of our Vector Overlay (Glass Pane).
/// Highly optimized and `bincode`-ready for ultra-fast dumping to RAM/Disk.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Annotation {
    Highlight { rects: Vec<Rect>, color: Color },
    Underline { rects: Vec<Rect>, color: Color },
    FreehandInk { points: Vec<Point>, color: Color, thickness: f32 },
    StickyNote { origin: Point, text: String, color: Color },
}

/// A collection of annotations localized to a specific physical page index.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AnnotationLayer {
    pub page_num: usize,
    pub annotations: Vec<Annotation>,
}

impl AnnotationLayer {
    pub fn new(page_num: usize) -> Self {
        Self {
            page_num,
            annotations: Vec::new(),
        }
    }

    pub fn add_annotation(&mut self, annotation: Annotation) {
        self.annotations.push(annotation);
    }

    /// Fast and lossless serialization via `bincode`, fulfilling the core architecture mandate.
    pub fn serialize_to_bytes(&self) -> Result<Vec<u8>, bincode::Error> {
        bincode::serialize(self)
    }

    /// Hydration from `bincode` bytes back to working memory.
    pub fn deserialize_from_bytes(bytes: &[u8]) -> Result<Self, bincode::Error> {
        bincode::deserialize(bytes)
    }
}
