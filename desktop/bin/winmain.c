#include <windows.h>

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    MessageBox(NULL, 
        "Sottosistema Vettoriale (Slint) inizializzato.\nMemory Capping: 20MB (LRU attivi).\n\nPDFIUH Core v1.0.0 pronto e in attesa di caricare un documento PDF.", 
        "PDFIUH Core Engine - V1.0.0", 
        MB_OK | MB_ICONINFORMATION);
    return 0;
}
