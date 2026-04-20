import os
import json
from supabase import create_client, Client

SUPABASE_URL = "https://chjirzwxsewlhbnhpvjh.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoamlyend4c2V3bGhibmhwdmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTk1NDAsImV4cCI6MjA5MTgzNTU0MH0.tOz51eKBGv0thiZLRIeVv7qcIR8mFANuFJ4qHelPlRA"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

try:
    response = supabase.table("songs").select("*").execute()
    songs = response.data
    
    print(f"Total de musicas no banco: {len(songs)}")
    
    bad_data = []
    dynamic_categories = set()
    
    for s in songs:
        title = s.get("title", "")
        # Checa ligaduras tipograficas
        if "ﬁ" in title or "ﬂ" in title:
            bad_data.append(s)
            
        for cat in s.get("categories", []):
            dynamic_categories.add(cat)
            
    print(f"Musicas com ligaduras tipograficas ('ﬁ' ou 'ﬂ'): {len(bad_data)}")
    for b in bad_data:
        print(f"ID: {b['id']} - Title: {b['title']}")
        
    print(f"\nTodas as categorias encontradas:")
    for c in dynamic_categories:
        print(f"- {c}")

except Exception as e:
    print(f"Erro: {e}")
