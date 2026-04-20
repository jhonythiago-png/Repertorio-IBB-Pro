import os
import re
from PyPDF2 import PdfReader

def extract_text_from_pdf(pdf_path):
    try:
        reader = PdfReader(pdf_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        text = text.replace("ﬁ", "fi").replace("ﬂ", "fl")
        return text
    except Exception as e:
        print(f"Erro ao ler PDF {pdf_path}: {e}")
        return ""

def parse_repertoire(text):
    categories = []
    category_names = [
        "Convite", "Celebração/Adoração/Louvor", "Consagração", 
        "Busca", "Contemplação/Adoração e Louvor", "Ceia", 
        "Comunhão", "Fé", "Clássicas"
    ]
    
    cat_pattern = r"(" + "|".join(re.escape(name) for name in category_names) + r")"
    text = re.sub(r"REPERTÓRIO 2024-2", "", text)
    parts = re.split(cat_pattern, text)
    
    total_found = 0
    all_titles = []
    
    if len(parts) > 1:
        for i in range(1, len(parts), 2):
            cat_name = parts[i]
            content = parts[i+1] if i+1 < len(parts) else ""
            songs = []
            
            # Aqui está a regex atual:
            matches = list(re.finditer(r"(\d+)\.\s*(.+?)(?=\d+\.|$)", content, re.DOTALL))
            
            for m in matches:
                full_text = m.group(2).strip()
                title = full_text
                artist = "Vários"
                artist_match = re.search(r"\((.+?)\)", full_text)
                if artist_match:
                    title = full_text.replace(artist_match.group(0), "").strip()
                
                # Vamos remover o [NOVA] para verificar as exclusivas
                title = re.sub(r"\[NOVA\*?\]", "", title, flags=re.IGNORECASE).strip()
                
                songs.append(title)
                all_titles.append(title)
            
            print(f"Categoria [{cat_name}]: Encontrou {len(songs)} louvores")
            total_found += len(songs)
            
    print(f"\nTotal extraído cru via Regex: {total_found}")
    
    # Check duplicates
    unique_titles = set(all_titles)
    print(f"Títulos Únicos no PDF: {len(unique_titles)}")
    print(f"Diferença (Duplicadas ou perdidas na agregação): {total_found - len(unique_titles)}")
    
    # Ache algumas duplicadas para mostrar
    from collections import Counter
    c = Counter(all_titles)
    print("Músicas que aparecem mais de uma vez no PDF (sobrepostas usando o título como chave):")
    for k, v in c.items():
        if v > 1:
            print(f" - '{k}' aparece {v} vezes")

if __name__ == "__main__":
    pdf_path = None
    for f in os.listdir("."):
        if f.endswith(".pdf"):
            pdf_path = f
            print("Lendo pdf...")
            break
            
    if pdf_path:
        text = extract_text_from_pdf(pdf_path)
        parse_repertoire(text)
    else:
        print("Nenhum PDF encontrado na pasta.")
