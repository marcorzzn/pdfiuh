use std::env;
use std::path::PathBuf;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("cargo::rustc-check-cfg=cfg(mupdf_available)");
    // Only compile MuPDF if the folder actually exists.
    let mupdf_path = PathBuf::from("mupdf");
    
    if !mupdf_path.exists() {
        // Skip compilation to avoid failing before the user has run submodule init
        println!("cargo:warning=MuPDF submodule not found, skipping build.rs compilation for FFI.");
        return Ok(());
    }

    // Configure minimal MuPDF build
    let mut build = cc::Build::new();
    
    build
        .include("mupdf/include")
        .include("mupdf/source/fitz")
        // Just examples, actual files would refer to MuPDF's src structure
        .file("mupdf/source/fitz/load-pdf.c")
        .file("mupdf/source/fitz/draw-device.c")
        .define("FZ_ENABLE_XPS", "0")  // Disable XPS
        .define("FZ_ENABLE_SVG", "0")  // Disable SVG
        .define("FZ_ENABLE_JS", "0")   // Disable JavaScript
        .define("FZ_ENABLE_EPUB", "0") // Disable EPUB
        .opt_level(3)
        .flag_if_supported("-fno-exceptions")
        .compile("mupdf_minimal");

    // Link against system libraries
    println!("cargo:rustc-link-lib=z"); // zlib
    println!("cargo:rustc-link-lib=jpeg");
    
    // Generate bindings
    let bindings = bindgen::Builder::default()
        .header("mupdf/include/mupdf/fitz.h")
        .allowlist_function("fz_.*")
        .allowlist_type("fz_.*")
        .generate()
        .map_err(|_| "Unable to generate bindings")?;

    let out_path = PathBuf::from(env::var("OUT_DIR")?);
    bindings.write_to_file(out_path.join("bindings.rs"))?;

    // Inform the compiler that real mupdf bindings are available
    println!("cargo:rustc-cfg=mupdf_available");

    Ok(())
}
