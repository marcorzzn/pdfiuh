use criterion::{black_box, criterion_group, criterion_main, Criterion};
use pdfiuh_core::*;
use pdfiuh_ffi::{MuPdfContext, PdfDocument};

fn benchmark_document_open(c: &mut Criterion) {
    // This is purely structural since we haven't built MuPDF yet.
    // In a full environment, the C lib would be linked.
    let ctx = MuPdfContext::new().unwrap();
    
    c.bench_function("open_pdf_mock", |b| {
        b.iter(|| {
            // we ignore the result because the file might not exist in the stub
            let _doc = PdfDocument::open(
                &ctx,
                black_box("tests/fixtures/1mb.pdf"),
            );
        });
    });
}

fn benchmark_page_render(c: &mut Criterion) {
    let ctx = MuPdfContext::new().unwrap();
    // Fallback to avoid panicking during benchmark analysis phase if the file doesn't exist yet
    let doc = PdfDocument::open(&ctx, "tests/fixtures/text.pdf");
    
    c.bench_function("render_page_mock", |b| {
        b.iter(|| {
            // Setup renderer
            let mut renderer = PageRenderer::new(MuPdfContext::new().unwrap());
            if let Ok(d) = &doc {
                let _img = renderer.render_page(
                    d,
                    black_box(0),
                    black_box(1.0),
                );
            }
        });
    });
}

criterion_group!(benches, benchmark_document_open, benchmark_page_render);
criterion_main!(benches);
