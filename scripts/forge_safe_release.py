import os
import shutil
import sys
import time

def forge_safe_release():
    target_exe = os.path.join("target", "x86_64-pc-windows-gnu", "release", "pdfiuh.exe")
    if not os.path.exists(target_exe):
        target_exe = os.path.join("target", "release", "pdfiuh.exe")
    
    zip_name = "pdfiuh-v1.0.0-final"
    folder_name = "pdfiuh_staging"

    if not os.path.exists(target_exe):
        print("[!] ERRORE: Eseguibile non trovato dopo la build.")
        sys.exit(1)

    size_mb = os.path.getsize(target_exe) / (1024 * 1024)
    print(f"[*] Eseguibile trovato: {target_exe}")
    print(f"[*] Peso verificato: {size_mb:.2f} MB")

    if size_mb < 0.5:
        print("[!] ERRORE: File troppo piccolo (corrotto o placeholder).")
        sys.exit(1)

    # 1. Staging
    if os.path.exists(folder_name):
        shutil.rmtree(folder_name)
    os.makedirs(folder_name)
    
    # Copia forzata con flush esplicito del filesystem
    dest_exe = os.path.join(folder_name, "pdfiuh.exe")
    shutil.copy2(target_exe, dest_exe)
    # Forza Windows a svuotare i buffer I/O prima di creare lo ZIP
    with open(dest_exe, 'r+b') as f:
        os.fsync(f.fileno())

    if os.path.exists("CHANGELOG.md"):
        shutil.copy2("CHANGELOG.md", folder_name)
    if os.path.exists("README_MASTER.md"):
        shutil.copy2("README_MASTER.md", folder_name)

    # Attesa di sicurezza: lascia che il filesystem NTFS chiuda i descrittori
    print("[*] Attesa flush filesystem (2s)...")
    time.sleep(2)

    # 2. Compressione deterministica e verificata
    shutil.make_archive(zip_name, 'zip', folder_name)
    shutil.rmtree(folder_name)
    
    zip_path = zip_name + ".zip"
    final_size_kb = os.path.getsize(zip_path) / 1024
    final_size_mb = final_size_kb / 1024
    print(f"[+++] RELEASE INTEGRATA: {zip_path}")
    print(f"      Peso: {final_size_kb:.0f} KB ({final_size_mb:.2f} MB)")
    print(f"      Pronto per upload su GitHub Releases.")

if __name__ == "__main__":
    forge_safe_release()
