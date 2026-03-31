use std::env;
use std::path::PathBuf;

fn main() {
    // Only compile MuPDF if the folder actually exists.
    // In this codex version, we are expecting it to be initialized later by the user.
    let mupdf_path = PathBuf::from("mupdf");
    
    if !mupdf_path.exists() {
        // Skip compilation to avoid failing before the user has run submodule init
        println!("cargo:warning=MuPDF submodule not found, skipping build.rs compilation for FFI.");
        return;
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
        .expect("Unable to generate bindings");

    let out_path = PathBuf::from(env::var("OUT_DIR").unwrap());
    bindings
        .write_to_file(out_path.join("bindings.rs"))
        .expect("Couldn't write bindings!");
}
