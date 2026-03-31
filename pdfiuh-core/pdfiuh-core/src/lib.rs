use mimalloc::MiMalloc;

#[global_allocator]
static GLOBAL: MiMalloc = MiMalloc;

pub mod error;
pub mod render;
pub mod annotations;

pub use error::{PdfiuhError, Result};
pub use render::PageRenderer;
pub use annotations::{Annotation, AnnotationLayer, Color, Point, Rect, Size};
