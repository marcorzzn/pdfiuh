import os
import shutil

def build_release_package():
    release_name = "pdfiuh-v1.0.0-windows-x86"
    
    # 1. Crea la cartella di staging temporanea
    os.makedirs(release_name, exist_ok=True)
    print(f"[*] Creata directory di staging: {release_name}")

    # 2. Cerca il binario compilato (controlla sia il path standard che quello target-specific)
    exe_paths = [
        os.path.join("target", "i686-pc-windows-msvc", "release", "pdfiuh-ui.exe"),
        os.path.join("target", "release", "pdfiuh-ui.exe"),
        os.path.join("target", "debug", "pdfiuh-ui.exe") # Fallback estremo
    ]
    
    exe_found = None
    for path in exe_paths:
        if os.path.exists(path):
            exe_found = path
            break
            
    if not exe_found:
        print("[!] ERRORE: Eseguibile pdfiuh-ui.exe non trovato. Hai eseguito cargo build --release?")
        return

    # 3. Copia i file necessari nella cartella di staging
    files_to_package = [
        exe_found,
        "CHANGELOG.md",
        "README_MASTER.md"
    ]

    for file_path in files_to_package:
        if os.path.exists(file_path):
            shutil.copy(file_path, release_name)
            print(f"[*] Copiato: {file_path}")
        else:
            print(f"[!] ATTENZIONE: File mancante {file_path}")

    # 4. Comprimi la cartella in formato ZIP
    print(f"[*] Compressione dell'archivio {release_name}.zip in corso...")
    shutil.make_archive(release_name, 'zip', release_name)

    # 5. Pulizia della cartella temporanea
    shutil.rmtree(release_name)
    print(f"[+] SUCCESSO: Archivio {release_name}.zip forgiato e pronto nella root del progetto.")

if __name__ == "__main__":
    build_release_package()
