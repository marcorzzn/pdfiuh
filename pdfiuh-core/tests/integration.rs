use pdfiuh_ffi::{MuPdfContext, PdfDocument};
use pdfiuh_core::{PageRenderer, AnnotationLayer, Annotation, Rect, Color, Point, Size};

#[test]
fn test_mupdf_mock_lifecycle() {
    // Phase 4: Validating the document opening, context, and page count
    // Using isolated simulated backend if real C source is absent
    let ctx = MuPdfContext::new().expect("Failed to init secure MuPdfContext");
    let doc = PdfDocument::open(&ctx, "dummy_fixture.pdf").expect("Failed to open dummy document");
    
    // Test count (mock should return 1 or more)
    assert!(doc.page_count() > 0);
    
    let mut renderer = PageRenderer::new(ctx);
    
    // Zoom factor 1.0 (100%)
    let image = renderer.render_page(&doc, 1, 1.0).expect("Render layout failed");
    
    // Validate image integrity
    assert!(image.width == 595); // A4 Width
    assert!(image.height == 842); // A4 Height
    assert!(!image.data.is_empty());
}

#[test]
fn test_zero_loss_annotation_serialization() {
    // Phase 4: Glass Pane Persistence Check
    let mut layer = AnnotationLayer::new(1);
    
    layer.add_annotation(Annotation::Highlight {
        rects: vec![Rect { origin: Point { x: 10.0, y: 20.0 }, size: Size { width: 100.0, height: 15.0 } }],
        color: Color::new(255, 255, 0, 128)
    });
    
    layer.add_annotation(Annotation::StickyNote {
        origin: Point { x: 50.0, y: 50.0 },
        text: "Supervisor Note".to_string(),
        color: Color::new(200, 200, 255, 255) // Paste-blue note
    });

    // Dump VRAM state to byte array
    let bytes = layer.serialize_to_bytes().expect("Bincode serialization failed to dump");
    assert!(!bytes.is_empty());
    
    // Hydrate back to struct to verify strict equality
    let hydra_layer = AnnotationLayer::deserialize_from_bytes(&bytes).expect("Bincode memory hydrate failed");
    
    assert_eq!(hydra_layer.page_num, layer.page_num);
    assert_eq!(hydra_layer.annotations.len(), 2);
    
    match &hydra_layer.annotations[1] {
        Annotation::StickyNote { text, .. } => assert_eq!(text, "Supervisor Note"),
        _ => panic!("Glass Pane Annotation schema corrupted during transport"),
    }
}
