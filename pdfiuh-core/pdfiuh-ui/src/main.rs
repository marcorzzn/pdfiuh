slint::include_modules!();

fn main() -> anyhow::Result<()> {
    let ui = MainWindow::new()?;
    
    let ui_weak = ui.as_weak();
    ui.on_open_file(move || {
        let ui = ui_weak.unwrap();
        // File dialog integration placeholder
        ui.set_current_file("document.pdf".into());
    });
    
    let ui_weak = ui.as_weak();
    ui.on_zoom_in(move || {
        let ui = ui_weak.unwrap();
        let zoom = ui.get_zoom_level();
        let new_zoom = (zoom * 1.2).min(4.0);
        ui.set_zoom_level(new_zoom);
    });
    
    let ui_weak = ui.as_weak();
    ui.on_zoom_out(move || {
        let ui = ui_weak.unwrap();
        let zoom = ui.get_zoom_level();
        let new_zoom = (zoom / 1.2).max(0.25);
        ui.set_zoom_level(new_zoom);
    });
    
    ui.run()?;
    Ok(())
}
