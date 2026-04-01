use thiserror::Error;

#[derive(Error, Debug)]
pub enum PdfiuhError {
    #[error("PDF parsing failed: {0}")]
    ParseError(String),
    
    #[error("Invalid PDF version: {0}")]
    UnsupportedVersion(String),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Rendering error: {0}")]
    RenderError(String),
    
    #[cfg(not(target_arch = "wasm32"))]
    #[error("FFI error: {0}")]
    FfiError(#[from] pdfiuh_ffi::MuPdfError),
}

pub type Result<T> = std::result::Result<T, PdfiuhError>;
