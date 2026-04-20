import os
import time
import json
import re
import requests
from PyPDF2 import PdfReader
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from supabase import create_client, Client

# Configurações Supabase
SUPABASE_URL = "https://rxcfnwhgkdauzyuekjxf.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4Y2Zud2hna2RhdXp5dWVranhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NTAyODAsImV4cCI6MjA5MjIyNjI4MH0.QewcMlTw0L6gXkz-WXwQvSu-vZXtO3vR48X2a_-FH9g"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Configurações Locais
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
PDF_PATTERN = re.compile(r".*\.pdf$", re.IGNORECASE)

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
    
    if len(parts) > 1:
        for i in range(1, len(parts), 2):
            cat_name = parts[i]
            content = parts[i+1] if i+1 < len(parts) else ""
            songs = []
            
            matches = re.finditer(r"(\d+)\.\s*(.+?)(?=\d+\.|$)", content, re.DOTALL)
            
            for m in matches:
                full_text = m.group(2).strip()
                status = ""
                if "[NOVA]" in full_text.upper() or "[NOVA*]" in full_text.upper():
                    status = "NOVA"
                    full_text = re.sub(r"\[NOVA\*?\]", "", full_text, flags=re.IGNORECASE).strip()
                
                title = full_text
                artist = "Vários"
                artist_match = re.search(r"\((.+?)\)", full_text)
                if artist_match:
                    artist = artist_match.group(1).strip()
                    title = full_text.replace(artist_match.group(0), "").strip()
                
                songs.append({
                    "title": title,
                    "artist": artist,
                    "status": status,
                    "query": f"{title} {artist}"
                })
            
            if songs:
                categories.append({"name": cat_name, "songs": songs})
                
    return categories

def get_youtube_id(query):
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"}
        search_query = query.replace(' ', '+')
        url = f"https://www.youtube.com/results?search_query={search_query}"
        response = requests.get(url, headers=headers, timeout=10)
        matches = re.findall(r"\"videoId\":\"(.*?)\"", response.text)
        if matches:
            for vid in matches:
                if len(vid) == 11: return vid
    except: pass
    return None

def sync():
    print("Sincronizando com Supabase...")
    
    # Dicionário para agregar dados por título
    # Estrutura: { "Titulo": { "artist": "...", "categories": set(), "status": "...", "query": "..." } }
    aggregated_songs = {}
    
    for filename in os.listdir(DIRECTORY):
        if PDF_PATTERN.match(filename):
            path = os.path.join(DIRECTORY, filename)
            text = extract_text_from_pdf(path)
            cats = parse_repertoire(text)
            for cat in cats:
                cat_name = cat["name"]
                for song in cat["songs"]:
                    title = song["title"].strip()
                    if title not in aggregated_songs:
                        aggregated_songs[title] = {
                            "artist": song["artist"],
                            "status": song["status"],
                            "query": song["query"],
                            "categories": set()
                        }
                    aggregated_songs[title]["categories"].add(cat_name)
                    if song["status"] == "NOVA":
                        aggregated_songs[title]["status"] = "NOVA"
                        aggregated_songs[title]["categories"].add("Novos")

    # Carregar lista de músicas ignoradas (deletadas manualmente)
    ignored_titles = []
    ignored_path = os.path.join(DIRECTORY, "deleted_songs.json")
    if os.path.exists(ignored_path):
        try:
            with open(ignored_path, "r", encoding="utf-8") as f:
                ignored_data = json.load(f)
                ignored_titles = [t.strip().lower() for t in ignored_data.get("ignored_titles", [])]
        except: pass

    total_synced = 0
    for title, song_data in aggregated_songs.items():
        artist = song_data["artist"]
        full_check = f"{title} ({artist})".lower()
        
        # Bloqueio agressivo por substring para evitar duplicatas "ao vivo"
        is_ignored = any(term.lower() in full_check for term in ignored_titles) or "ao vivo" in full_check
        
        if is_ignored:
            print(f"Bloqueio de Sincronia: '{title}' detectado como duplicata ou versão ao vivo.")
            continue

        data = {
            "title": title,
            "artist": song_data["artist"],
            "status": song_data["status"],
            "categories": list(song_data["categories"])
        }
        
        try:
            # Verificar se já existe (para preservar URL e respeitar DELETED)
            existing = supabase.table("songs").select("url, vid_id, status").eq("title", title).execute()
            
            if existing.data:
                # Se já foi deletado no site, mantemos como DELETED aqui tbm
                if existing.data[0].get("status") == "DELETED":
                    data["status"] = "DELETED"
                
                # Se já tem vídeo, não buscamos de novo
                if existing.data[0].get("vid_id"):
                    data["vid_id"] = existing.data[0]["vid_id"]
                    data["url"] = existing.data[0]["url"]
                else:
                    vid_id = get_youtube_id(song_data["query"])
                    if vid_id:
                        data["vid_id"] = vid_id
                        data["url"] = f"https://www.youtube.com/embed/{vid_id}"
            else:
                # Música nova, busca vídeo
                vid_id = get_youtube_id(song_data["query"])
                if vid_id:
                    data["vid_id"] = vid_id
                    data["url"] = f"https://www.youtube.com/embed/{vid_id}"
            
            supabase.table("songs").upsert(data, on_conflict="title").execute()
            total_synced += 1
        except Exception as e:
            print(f"Erro ao sincronizar um item: {e}")
        
        time.sleep(0.05)
    
    print(f"Sincronismo concluído! {total_synced} louvores processados no Supabase.")

class RepertoireHandler(FileSystemEventHandler):
    def on_modified(self, event):
        if event.src_path.endswith('.pdf'):
            sync()

if __name__ == "__main__":
    # Primeira execução
    sync()
    
    # Inicia Watcher para novos PDFs
    observer = Observer()
    observer.schedule(RepertoireHandler(), DIRECTORY, recursive=False)
    observer.start()
    print("Monitorando a pasta por novos PDFs...")
    try:
        while True: time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
