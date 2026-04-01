use criterion::{black_box, criterion_group, criterion_main, Criterion};
use pdfiuh_core::{AnnotationLayer, Annotation, Rect, Color, Point, Size};

fn bench_glass_pane_throttle(c: &mut Criterion) {
    let mut layer = AnnotationLayer::new(1);
    
    // Simulate massive payload: 10,000 extreme highlights overlapping on multiple rows
    for i in 0..10_000 {
        layer.add_annotation(Annotation::Highlight {
            rects: vec![
                Rect { 
                    origin: Point { x: (i % 500) as f32, y: (i % 800) as f32 }, 
                    size: Size { width: 50.0, height: 12.0 } 
                }
            ],
            color: Color::new(255, 255, 0, 128)
        });
    }

    // Benchmark the Write-To-RAM loop locking the Glass Pane
    c.bench_function("serialize_10k_highlights_bincode", |b| {
        b.iter(|| {
            // Simulate the User hitting "Save"
            let bytes = layer.serialize_to_bytes().expect("Bincode serialization panic");
            black_box(bytes);
        })
    });
    
    // Validate the re-hydration speed
    let pre_serialized_payload = layer.serialize_to_bytes().unwrap();
    c.bench_function("deserialize_10k_highlights_bincode", |b| {
        b.iter(|| {
            // Simulate switching back to Page 1 and parsing vectors
            let decoded = AnnotationLayer::deserialize_from_bytes(&pre_serialized_payload).expect("Bincode memory hydrate panic");
            black_box(decoded);
        })
    });
}

criterion_group!(benches, bench_glass_pane_throttle);
criterion_main!(benches);
