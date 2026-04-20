import os
from supabase import create_client, Client

SUPABASE_URL = "https://chjirzwxsewlhbnhpvjh.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoamlyend4c2V3bGhibmhwdmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTk1NDAsImV4cCI6MjA5MTgzNTU0MH0.tOz51eKBGv0thiZLRIeVv7qcIR8mFANuFJ4qHelPlRA"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def fix_fonts():
    try:
        response = supabase.table("songs").select("*").execute()
        songs = response.data
        
        updates = 0
        
        for s in songs:
            original = s.get("title", "")
            if not original:
                continue
                
            # Tratamento focado em ligaduras do PDF e de espaços no início
            fixed = original.replace("ﬁ", "fi").replace("ﬂ", "fl").strip()
            
            if fixed != original:
                print(f"Ajustando {s['id']}: '{original.encode('utf-8')}' -> '{fixed}'")
                supabase.table("songs").update({"title": fixed}).eq("id", s["id"]).execute()
                updates += 1
                
        print(f"Limpeza de banco concluída. {updates} músicas modificadas.")
    except Exception as e:
        print(f"Erro fatal: {e}")

if __name__ == '__main__':
    fix_fonts()
