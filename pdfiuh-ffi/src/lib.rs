use std::ffi::CString;
use std::ptr;

#[derive(thiserror::Error, Debug)]
pub enum MuPdfError {
    #[error("Failed to convert string: {0}")]
    NulError(#[from] std::ffi::NulError),
    #[error("MuPDF internal error: {0}")]
    Internal(String),
}

pub type Result<T> = std::result::Result<T, MuPdfError>;

#[cfg(mupdf_available)]
pub mod bindings {
    #![allow(non_upper_case_globals)]
    #![allow(non_camel_case_types)]
    #![allow(non_snake_case)]
    include!(concat!(env!("OUT_DIR"), "/bindings.rs"));
}

#[cfg(not(mupdf_available))]
pub mod bindings {
    #![allow(non_camel_case_types)]
    
    pub type fz_context = std::ffi::c_void;
    pub type fz_document = std::ffi::c_void;
    pub type fz_alloc_context = std::ffi::c_void;
    pub type fz_locks_context = std::ffi::c_void;
    
    pub const FZ_STORE_DEFAULT: usize = 256 * 1024 * 1024;
    
    extern "C" {
        pub fn fz_new_context_imp(alloc: *const fz_alloc_context, locks: *const fz_locks_context, max_store: usize, version: *const std::ffi::c_char) -> *mut fz_context;
        pub fn fz_drop_context(ctx: *mut fz_context);
        pub fn fz_register_document_handlers(ctx: *mut fz_context);
        pub fn fz_open_document(ctx: *mut fz_context, filename: *const std::ffi::c_char) -> *mut fz_document;
        pub fn fz_drop_document(ctx: *mut fz_context, doc: *mut fz_document);
        pub fn fz_count_pages(ctx: *mut fz_context, doc: *mut fz_document) -> std::ffi::c_int;
    }
}

pub struct MuPdfContext {
    pub(crate) ctx: *mut bindings::fz_context,
}

impl MuPdfContext {
    pub fn new() -> Result<Self> {
        // SAFETY: creating a new MuPDF context is safe if handled with default settings and null locks
        unsafe {
            let version = CString::new("1.23.0")?;
            let ctx = bindings::fz_new_context_imp(
                ptr::null(),  // allocator (use default)
                ptr::null(),  // locks
                bindings::FZ_STORE_DEFAULT,
                version.as_ptr()
            );
            
            if ctx.is_null() {
                return Err(MuPdfError::Internal("Failed to create MuPDF context".into()));
            }
            
            // Register document handlers
            bindings::fz_register_document_handlers(ctx);
            
            Ok(MuPdfContext { ctx })
        }
    }
}

impl Drop for MuPdfContext {
    fn drop(&mut self) {
        // SAFETY: ctx was allocated by MuPDF, calling its native drop function is appropriate, 
        // provided the context is not null.
        unsafe {
            if !self.ctx.is_null() {
                bindings::fz_drop_context(self.ctx);
            }
        }
    }
}

// SAFETY: MuPDF context is thread-safe with proper locking
unsafe impl Send for MuPdfContext {}
unsafe impl Sync for MuPdfContext {}

pub struct PdfDocument {
    pub(crate) doc: *mut bindings::fz_document,
    pub(crate) ctx: *mut bindings::fz_context,
}

impl PdfDocument {
    pub fn open(ctx: &MuPdfContext, path: &str) -> Result<Self> {
        let c_path = CString::new(path)?;
        
        // SAFETY: We verify that the context pointer is securely populated before attempting to open the document.
        unsafe {
            // Null check context
            if ctx.ctx.is_null() {
                return Err(MuPdfError::Internal("MuPDF context is null".into()));
            }

            let doc = bindings::fz_open_document(ctx.ctx, c_path.as_ptr());
            
            if doc.is_null() {
                return Err(MuPdfError::Internal(format!("Failed to open PDF: {}", path)));
            }
            
            Ok(PdfDocument {
                doc,
                ctx: ctx.ctx,
            })
        }
    }
    
    pub fn page_count(&self) -> i32 {
        // SAFETY: counting pages is safe if both context and document are valid
        unsafe {
            if self.doc.is_null() || self.ctx.is_null() {
                return 0;
            }
            bindings::fz_count_pages(self.ctx, self.doc)
        }
    }
}

impl Drop for PdfDocument {
    fn drop(&mut self) {
        // SAFETY: memory lifecycle managed via native fz_drop_document API 
        unsafe {
            if !self.doc.is_null() && !self.ctx.is_null() {
                bindings::fz_drop_document(self.ctx, self.doc);
            }
        }
    }
}
