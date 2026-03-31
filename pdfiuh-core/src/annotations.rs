use serde::{Deserialize, Serialize};
use crate::{PdfiuhError, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Point {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rect {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Size {
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Annotation {
    Highlight {
        page: usize,
        bounds: Vec<Rect>,  // Multiple rects for text spanning lines
        color: Color,
    },
    FreehandStroke {
        page: usize,
        points: Vec<Point>,
        color: Color,
        thickness: f32,
    },
    TextBox {
        page: usize,
        position: Point,
        size: Size,
        content: String,
        font_size: f32,
    },
}

impl Annotation {
    pub fn page(&self) -> usize {
        match self {
            Annotation::Highlight { page, .. } => *page,
            Annotation::FreehandStroke { page, .. } => *page,
            Annotation::TextBox { page, .. } => *page,
        }
    }
}

pub struct AnnotationLayer {
    annotations: Vec<Annotation>,
}

impl AnnotationLayer {
    pub fn new() -> Self {
        Self {
            annotations: Vec::new(),
        }
    }

    pub fn add(&mut self, annotation: Annotation) {
        self.annotations.push(annotation);
    }

    pub fn get_for_page(&self, page: usize) -> Vec<&Annotation> {
        self.annotations
            .iter()
            .filter(|a| a.page() == page)
            .collect()
    }

    pub fn serialize(&self) -> Result<Vec<u8>> {
        bincode::serialize(&self.annotations)
            .map_err(|e| PdfiuhError::ParseError(format!("Serialization Error: {}", e)))
    }
    
    pub fn deserialize(data: &[u8]) -> Result<Self> {
        let annotations: Vec<Annotation> = bincode::deserialize(data)
            .map_err(|e| PdfiuhError::ParseError(format!("Deserialization Error: {}", e)))?;
        Ok(Self { annotations })
    }
}
