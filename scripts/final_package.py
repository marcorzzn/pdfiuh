import os
import shutil
import sys

def forge_release():
    target_exe = os.path.join("target", "release", "pdfiuh-ui.exe")
    zip_name = "pdfiuh-v1.0.0-windows-x86.zip"
    folder_name = "pdfiuh-v1.0.0-windows-x86"

    # 1. Verifica Esistenza e Peso
    if not os.path.exists(target_exe):
        print(f"[!] ERRORE: {target_exe} non trovato!")
        sys.exit(1)
    
    size_mb = os.path.getsize(target_exe) / (1024*1024)
    print(f"[*] Eseguibile verificato: {size_mb:.2f} MB")

    if size_mb < 0.5:
        print("[!] ERRORE: File troppo piccolo (corrotto).")
        sys.exit(1)

    # 2. Packaging
    if os.path.exists(folder_name): shutil.rmtree(folder_name)
    os.makedirs(folder_name)
    
    shutil.copy(target_exe, folder_name)
    if os.path.exists("CHANGELOG.md"): shutil.copy("CHANGELOG.md", folder_name)
    if os.path.exists("README_MASTER.md"): shutil.copy("README_MASTER.md", folder_name)

    # 3. Compressione
    shutil.make_archive(zip_name.replace(".zip", ""), 'zip', folder_name)
    shutil.rmtree(folder_name)
    
    final_zip_size = os.path.getsize(zip_name) / (1024*1024)
    print(f"[+++] RELEASE PRONTA: {zip_name} ({final_zip_size:.2f} MB)")

if __name__ == "__main__":
    forge_release()
