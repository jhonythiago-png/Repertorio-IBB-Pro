import os
from supabase import create_client, Client
from collections import Counter

SUPABASE_URL = "https://chjirzwxsewlhbnhpvjh.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoamlyend4c2V3bGhibmhwdmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTk1NDAsImV4cCI6MjA5MTgzNTU0MH0.tOz51eKBGv0thiZLRIeVv7qcIR8mFANuFJ4qHelPlRA"

def get_stats():
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    response = supabase.table("songs").select("*").execute()
    data = response.data
    
    total = len(data)
    print(f"__TOTAL_SONGS__:{total}")
    
    categories = Counter()
    for s in data:
        cat_list = s.get("categories", [])
        if not isinstance(cat_list, list):
            cat_list = [cat_list]
        for c in cat_list:
            categories[c] += 1
            
    print("__CATEGORIES__")
    for k, v in categories.most_common():
        print(f"{k} = {v}")

if __name__ == "__main__":
    get_stats()
