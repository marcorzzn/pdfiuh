import os
import requests
import numpy as np
import gc
from PIL import Image, ImageDraw, ImageFont

# Asset Paths Configurations
original_image_path = r"C:\Users\marco\Downloads\logo pdfiuh.png"
base_dir = r"pdfiuh-ui\assets"
out_dir = os.path.join(base_dir, "png")
os.makedirs(out_dir, exist_ok=True)

# 1. Download Montserrat font strictly (Open-Source Geometric Sans-Serif)
font_url = "https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/Montserrat-Bold.ttf"
font_path = os.path.join(base_dir, "Montserrat-Bold.ttf")

if not os.path.exists(font_path):
    print("Inizializzazione Download Font (Montserrat-Bold)...")
    with requests.get(font_url, stream=True) as r:
        r.raise_for_status()
        with open(font_path, 'wb') as f:
             for chunk in r.iter_content(chunk_size=8192): 
                f.write(chunk)
    print("Download Tipografico completato.")

print("Caricamento in memoria del Master Asset...")
with Image.open(original_image_path).convert("RGBA") as master:
    # Trasferimento matrice in C-array via numpy (Operazione VRAM Intensive)
    data = np.array(master)

    # 2. Scarto Algoritmico Fondo Bianco -> Canale Alpha
    # Convert white halos safely (Background color keying threshold >= 240 RGB)
    r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
    white_mask = (r > 240) & (g > 240) & (b > 240)
    data[white_mask, 3] = 0

    # 3. Ritaglio (Bounding-Box Tight Cropping) Autoritario
    coords = np.argwhere(data[:,:,3] > 0)
    if coords.size > 0:
        y0, x0 = coords.min(axis=0)
        y1, x1 = coords.max(axis=0) + 1
        cropped_data = data[y0:y1, x0:x1]
        
        # [MEMORY POLICY P0]: Flush immediato del footprint massivo numpy (Atom N455 Safe)
        del data, white_mask, r, g, b, a
        gc.collect()

        base_icon = Image.fromarray(cropped_data, 'RGBA')
        del cropped_data
    else:
        base_icon = master.copy()

    # 4. Sampling Autoritario Colori Brand
    colors = base_icon.getcolors(base_icon.size[0] * base_icon.size[1])
    sorted_colors = sorted(colors, key=lambda t: t[0], reverse=True) if colors else []
    
    # Fallback Codex palette (pdfiuh design scheme rules)
    primary_blue = (23, 33, 94, 255) 
    primary_cyan = (0, 191, 255, 255) 
    
    # Tentativo estrattivo empirico sui pixel validi per color match al 100%
    for count, color in sorted_colors:
        if color[3] > 200 and color[0] < 50 and color[1] < 50 and color[2] > 70:
            primary_blue = color
            break
    for count, color in sorted_colors:
        if color[3] > 200 and color[0] < 100 and color[1] > 150 and color[2] > 200:
            primary_cyan = color
            break

    # === Moduli Output ===

    def export_square(icon, size, name):
        """Genera un contenitore quadrato perfetto, ridimensionando l'asse lungo in modo safe."""
        with Image.new("RGBA", (size, size), (255, 255, 255, 0)) as canvas:
            # Padding nativo 10% di sicurezza frame (iOS/Windows compliant)
            target_size = int(size * 0.9)
            scaled = icon.copy()
            scaled.thumbnail((target_size, target_size), Image.Resampling.LANCZOS)
            
            x = (size - scaled.width) // 2
            y = (size - scaled.height) // 2
            canvas.paste(scaled, (x, y), scaled)
            canvas.save(os.path.join(out_dir, name), optimize=True)
            scaled.close()
            
    # [FASE A] Multi-Platform Icon Set Exporter
    print("Forgiatura array dimensioni ICNS/ICO compatibili...")
    sizes = [16, 32, 48, 64, 128, 256, 512, 1024]
    for s in sizes:
        export_square(base_icon, s, f"icon_{s}x{s}.png")
        
    # [FASE B] Android Adaptive Masks (Dual Layer Composition)
    print("Forgiatura Livelli Adaptive Android...")
    with Image.new("RGBA", (1024, 1024), primary_blue) as bg:
        bg.save(os.path.join(out_dir, "ic_launcher_background.png"), optimize=True)
    
    # Master geometricamente pronto al mascheramento framework SDK 
    export_square(base_icon, 1024, "ic_launcher_foreground.png") 

    # [FASE C] Compositing Avanzato Logo Variants
    print("Compilazione Loghi Ufficiali e offset tipografici...")
    text_str = "pdfiuh"
    
    try:
        # Dimensione base calcolata per allineare l'altezza ottica x-height
        font_size = 280
        font = ImageFont.truetype(font_path, font_size)
    except Exception as e:
        print(f"Warning: Caricamento TTF fallito ({e}). Uso fallback monolitico.")
        font = ImageFont.load_default()

    # Bounding tipografico (Pillow > 10.0 support)
    left, top, right, bottom = font.getbbox(text_str)
    text_w = right - left
    text_h = bottom - top

    # Normalizzazione scalare dell'icona base (512px height) per matching bilanciato
    master_logo_height = 512
    logo_w_ratio = base_icon.width / base_icon.height
    l_scaled = base_icon.resize((int(master_logo_height * logo_w_ratio), master_logo_height), Image.Resampling.LANCZOS)

    def create_layout(postfix, text_color, layout_type="horizontal"):
        """Costruisce i layout Dark/Light iniettando lo zero-background"""
        # Spaziatura ottica calcolata (il fiato tipografico è vitale in UI design)
        pad = int(master_logo_height * 0.25)
        bg_alpha = (0, 0, 0, 0)
        
        if layout_type == "horizontal":
            total_w = l_scaled.width + pad + text_w
            total_h = max(l_scaled.height, text_h)
            
            with Image.new("RGBA", (total_w, total_h), bg_alpha) as canvas:
                # Placcatura Asse Y centrato
                canvas.paste(l_scaled, (0, (total_h - l_scaled.height)//2), l_scaled)
                # Compilazione scritta "pdfiuh" a destra
                draw = ImageDraw.Draw(canvas)
                text_y = (total_h - text_h) // 2 - top
                draw.text((l_scaled.width + pad, text_y), text_str, font=font, fill=text_color)
                
                canvas.save(os.path.join(out_dir, f"logo_horizontal_{postfix}.png"), optimize=True)
        else: # vertical stack
            total_w = max(l_scaled.width, text_w)
            total_h = l_scaled.height + pad + text_h
            
            with Image.new("RGBA", (total_w, total_h), bg_alpha) as canvas:
                # Placcatura Asse X centrato
                canvas.paste(l_scaled, ((total_w - l_scaled.width)//2, 0), l_scaled)
                # Scruttura posizionata sul Bottom
                draw = ImageDraw.Draw(canvas)
                text_x = (total_w - text_w) // 2 - left
                text_y = l_scaled.height + pad - top
                draw.text((text_x, text_y), text_str, font=font, fill=text_color)
                
                canvas.save(os.path.join(out_dir, f"logo_stacked_{postfix}.png"), optimize=True)

    # Iniezione finalizzata per i 4 design canonici
    # "Light theme" -> testo scuro aziendale
    create_layout("light", primary_blue, "horizontal")
    create_layout("light", primary_blue, "vertical")
    
    # "Dark theme" -> testo ciano/bianco brillante per lettura su fondo buio
    # Il ciano prelevato o bianco puro (255,255,255) per la massima leggibilità
    create_layout("dark", (255, 255, 255, 255), "horizontal") # Usiamo White neve invece di cyan per chiarezza dark UI
    create_layout("dark", (255, 255, 255, 255), "vertical")

    l_scaled.close()
    
print("Architettura Pipeline completata con successo. VRAM rilasciata.")
