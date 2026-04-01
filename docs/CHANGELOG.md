# Changelog - PDFIUH v1.0.0 (Initial Release)

### 🚀 Engineering & Architecture Highlights
* **Zero-Freeze UI**: Implementato un Thread Worker MPSC per il rendering in background. L'interfaccia Slint mantiene i 60 fps costanti senza mai bloccarsi durante la rasterizzazione di MuPDF.
* **Memory Capping (Hardware Legacy)**: Algoritmo custom di caching LRU (Least Recently Used) limitato chirurgicamente a 20 MB. Previene la saturazione della RAM e lo swap sul disco su sistemi limitati a 2 GB totali.
* **Zoom a "Muro di Gomma"**: Capping di sicurezza nativo a 15 MB per singola pagina in fase di zoom estremo, delegando l'ingrandimento finale allo scaling vettoriale hardware.
* **Glass Pane Annotations**: Livello vettoriale sovrapposto non distruttivo. Serializzazione "Zero-Loss" in memoria delle annotazioni in meno di 2 millisecondi tramite `bincode`.
* **Sicurezza Assoluta**: Applicata e validata la policy "Zero `.unwrap()`" nel codice di produzione. Contratti FFI e blocchi `unsafe` blindati e isolati.
* **LTO Target**: Binario compilato a 32-bit con *Link Time Optimization* (fat) per garantire la minima impronta di memoria su processori single-core Intel Atom x86.
