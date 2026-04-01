#[cfg(not(target_arch = "wasm32"))]
use mimalloc::MiMalloc;

#[cfg(not(target_arch = "wasm32"))]
#[global_allocator]
static GLOBAL: MiMalloc = MiMalloc;

pub mod error;
#[cfg(not(target_arch = "wasm32"))]
pub mod render;
pub mod annotations;
#[cfg(target_arch = "wasm32")]
pub mod wasm;

pub use error::{PdfiuhError, Result};
#[cfg(not(target_arch = "wasm32"))]
pub use render::PageRenderer;
pub use annotations::{Annotation, AnnotationLayer, Color, Point, Rect, Size};
