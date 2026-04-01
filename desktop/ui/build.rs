fn main() {
    slint_build::compile("ui/main.slint").unwrap();

    // Embed icon.ico into the Windows binary (no-op on Linux/macOS cross-compile targets)
    #[cfg(target_os = "windows")]
    {
        let mut res = winres::WindowsResource::new();
        res.set_icon("icon.ico");
        res.compile().unwrap();
    }
}
