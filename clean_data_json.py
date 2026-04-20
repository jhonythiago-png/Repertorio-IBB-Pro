import json
import os

path = r'c:\Users\JHONY BERALDO\Documents\Repertório IBB\data.json'
if os.path.exists(path):
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    removed_count = 0
    for cat in data:
        if 'items' in cat:
            old_items = cat['items']
            cat['items'] = [
                s for s in old_items 
                if 'ao vivo' not in s['title'].lower() 
                and 'ao vivo' not in s.get('artist', '').lower()
            ]
            removed_count += (len(old_items) - len(cat['items']))
    
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    
    print(f"Limpeza de data.json concluída: {removed_count} itens removidos.")
else:
    print("Arquivo data.json não encontrado.")
