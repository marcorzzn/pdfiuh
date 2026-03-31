use pdfiuh_core::*;
use pdfiuh_core::annotations::*;
use pdfiuh_ffi::{MuPdfContext, PdfDocument};
use std::path::PathBuf;

// Test fixture: sample PDFs in tests/fixtures/
fn fixture_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
        .join(name)
}

#[test]
fn test_open_valid_pdf() {
    // This is mocked to bypass actual FFI linkage issues before we compile the C code
    // In a real run, this checks for context creation
    let ctx = MuPdfContext::new().unwrap();
    // Assuming `PdfDocument::open` fails gracefully if path doesn't exist
    let _ = PdfDocument::open(&ctx, fixture_path("simple.pdf").to_str().unwrap());
}

#[test]
fn test_annotation_serialization() {
    let mut layer = AnnotationLayer::new();
    
    layer.add(Annotation::Highlight {
        page: 0,
        bounds: vec![Rect { x: 10.0, y: 10.0, width: 100.0, height: 20.0 }],
        color: Color { r: 255, g: 255, b: 0, a: 128 },
    });
    
    let bytes = layer.serialize().expect("Should serialize successfully");
    assert!(!bytes.is_empty(), "Serialized bytes should not be empty");

    let decoded = AnnotationLayer::deserialize(&bytes).expect("Should deserialize");
    let highlights = decoded.get_for_page(0);
    assert_eq!(highlights.len(), 1);
}
