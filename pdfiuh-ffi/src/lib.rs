use std::ffi::CString;
use std::ptr;
use pdfiuh_core::{PdfiuhError, Result};

// We mock the FFI bindings in the absence of an actual `bindgen` generated file for now.
// In a real run, you would include `bindings.rs`.
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
        unsafe {
            let version = CString::new("1.23.0").map_err(|e| PdfiuhError::FfiError(e.to_string()))?;
            let ctx = bindings::fz_new_context_imp(
                ptr::null(),  // allocator (use default)
                ptr::null(),  // locks
                bindings::FZ_STORE_DEFAULT,
                version.as_ptr()
            );
            
            if ctx.is_null() {
                return Err(PdfiuhError::FfiError("Failed to create MuPDF context".into()));
            }
            
            // Register document handlers
            bindings::fz_register_document_handlers(ctx);
            
            Ok(MuPdfContext { ctx })
        }
    }
}

impl Drop for MuPdfContext {
    fn drop(&mut self) {
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
        let c_path = CString::new(path).map_err(|e| PdfiuhError::Io(std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string())))?;
        
        unsafe {
            // Null check context
            if ctx.ctx.is_null() {
                return Err(PdfiuhError::FfiError("MuPDF context is null".into()));
            }

            let doc = bindings::fz_open_document(ctx.ctx, c_path.as_ptr());
            
            if doc.is_null() {
                return Err(PdfiuhError::FfiError(format!("Failed to open PDF: {}", path)));
            }
            
            Ok(PdfDocument {
                doc,
                ctx: ctx.ctx,
            })
        }
    }
    
    pub fn page_count(&self) -> i32 {
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
        unsafe {
            if !self.doc.is_null() && !self.ctx.is_null() {
                bindings::fz_drop_document(self.ctx, self.doc);
            }
        }
    }
}
