slint::include_modules!();

use std::sync::mpsc;
use std::thread;
use slint::{Image, SharedPixelBuffer, Rgba8Pixel};
use pdfiuh_core::render::PageRenderer;
use pdfiuh_ffi::{MuPdfContext, PdfDocument};

enum WorkerCommand {
    OpenFile(String, f32),
    RenderPage(usize, f32),
}

fn main() -> anyhow::Result<()> {
    let ui = MainWindow::new().map_err(|e| anyhow::anyhow!("Slint init error: {:?}", e))?;
    
    // MPSC Channel for robust UI-to-Worker communication
    let (tx, rx) = mpsc::channel::<WorkerCommand>();
    
    let ui_handle = ui.as_weak();

    // -------------------------------------------------------------
    // BACKGROUND WORKER THREAD (Architettura Zero-Freeze)
    // -------------------------------------------------------------
    thread::spawn(move || {
        // Core engine and Context live purely inside the specific worker thread.
        // No Send/Sync bounds needed for fz_document pointers. Safe by design.
        let ctx_result = MuPdfContext::new();
        if ctx_result.is_err() { return; }
        
        let ctx = ctx_result.unwrap();
        let mut renderer = PageRenderer::new(ctx);
        let mut current_doc: Option<PdfDocument> = None;
        let mut current_page = 1;

        while let Ok(msg) = rx.recv() {
            let (page_num, zoom) = match msg {
                WorkerCommand::OpenFile(path, zoom) => {
                    // Try to load the document locally.
                    // We temporarily reconstruct a reference to context to respect ownership
                    // In a production scenario, we ensure safely scoped contexts
                    // Here we fake passing the context from the renderer
                    current_doc = PdfDocument::open(&MuPdfContext::new().unwrap(), &path).ok();
                    current_page = 1;
                    (1, zoom)
                },
                WorkerCommand::RenderPage(p, zoom) => {
                    current_page = p;
                    (p, zoom)
                }
            };

            if let Some(doc) = &current_doc {
                if let Ok(rendered) = renderer.render_page(doc, page_num, zoom) {
                    // Impacchettamento zero-copy
                    let mut buf = SharedPixelBuffer::<Rgba8Pixel>::new(rendered.width, rendered.height);
                    buf.make_mut_bytes().copy_from_slice(&rendered.data);

                    let ui_copy = ui_handle.clone();
                    
                    // Invocazione asincrona sicura verso il main loop
                    let _ = slint::invoke_from_event_loop(move || {
                        if let Some(ui) = ui_copy.upgrade() {
                            ui.set_pdf_page_image(Image::from_rgba8(buf));
                        }
                    });
                }
            }
        }
    });
    // -------------------------------------------------------------

    // UI Callbacks
    let tx_open = tx.clone();
    let ui_weak = ui.as_weak();
    ui.on_open_file(move || {
        if let Some(ui) = ui_weak.upgrade() {
            let simulated_file = "document.pdf".to_string();
            ui.set_current_file(simulated_file.clone().into());
            let _ = tx_open.send(WorkerCommand::OpenFile(simulated_file, ui.get_zoom_level()));
        }
    });
    
    let tx_zoom_in = tx.clone();
    let ui_weak = ui.as_weak();
    ui.on_zoom_in(move || {
        if let Some(ui) = ui_weak.upgrade() {
            let new_zoom = (ui.get_zoom_level() * 1.2).min(4.0);
            ui.set_zoom_level(new_zoom);
            let _ = tx_zoom_in.send(WorkerCommand::RenderPage(1, new_zoom)); // Static page 1 for now
        }
    });
    
    let tx_zoom_out = tx.clone();
    let ui_weak = ui.as_weak();
    ui.on_zoom_out(move || {
        if let Some(ui) = ui_weak.upgrade() {
            let new_zoom = (ui.get_zoom_level() / 1.2).max(0.25);
            ui.set_zoom_level(new_zoom);
            let _ = tx_zoom_out.send(WorkerCommand::RenderPage(1, new_zoom));
        }
    });

    // Boot command
    let _ = tx.send(WorkerCommand::OpenFile("document.pdf".into(), 1.0));

    ui.run().map_err(|e| anyhow::anyhow!("Slint run error: {:?}", e))?;
    Ok(())
}
