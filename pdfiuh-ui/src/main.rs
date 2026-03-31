slint::include_modules!();

fn main() -> anyhow::Result<()> {
    let ui = MainWindow::new().map_err(|e| anyhow::anyhow!("Slint init error: {:?}", e))?;
    
    let ui_weak = ui.as_weak();
    ui.on_open_file(move || {
        if let Some(ui) = ui_weak.upgrade() {
            ui.set_current_file("document.pdf".into());
        }
    });
    
    let ui_weak = ui.as_weak();
    ui.on_zoom_in(move || {
        if let Some(ui) = ui_weak.upgrade() {
            let zoom = ui.get_zoom_level();
            ui.set_zoom_level((zoom * 1.2).min(4.0));
        }
    });
    
    let ui_weak = ui.as_weak();
    ui.on_zoom_out(move || {
        if let Some(ui) = ui_weak.upgrade() {
            let zoom = ui.get_zoom_level();
            ui.set_zoom_level((zoom / 1.2).max(0.25));
        }
    });
    
    ui.run().map_err(|e| anyhow::anyhow!("Slint run error: {:?}", e))?;
    Ok(())
}
