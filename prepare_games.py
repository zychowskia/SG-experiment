import os
import shutil
import json
import random
import re

SOURCE_DIR = '../simplified_scenarios'
DEST_DIR = './games'

def get_game_properties(filename):
    match = re.search(r'simple-(\d+)step-(\d+)targets', filename)
    if match:
        return int(match.group(1)), int(match.group(2))
    return None

def main():
    if os.path.exists(DEST_DIR):
        shutil.rmtree(DEST_DIR)
    os.makedirs(DEST_DIR)

    all_files = [f for f in os.listdir(SOURCE_DIR) if f.endswith('.ggame.json')]
    groups = {}
    
    for f in all_files:
        with open(os.path.join(SOURCE_DIR, f), 'r', encoding='utf-8') as rf:
            gdata = json.load(rf)
            if len(gdata.get('scenarios', [])) == 0:
                continue

        props = get_game_properties(f)
        if props:
            if props not in groups:
                groups[props] = []
            groups[props].append(f)
            
    selected_files = []
    # sort by steps, then targets
    sorted_keys = sorted(groups.keys(), key=lambda k: (k[0], k[1]))
    
    for k in sorted_keys:
        chosen = random.choice(groups[k])
        selected_files.append((k, chosen))
        
    index_data = []

    for idx, (props, f) in enumerate(selected_files):
        src_path = os.path.join(SOURCE_DIR, f)
        dest_path = os.path.join(DEST_DIR, f)
        
        shutil.copy2(src_path, dest_path)
        
        with open(dest_path, 'r', encoding='utf-8') as rf:
            game_data = json.load(rf)
            
        index_data.append({
            "filename": f,
            "order": idx + 1,
            "id": game_data.get('original_game', {}).get('id'),
            "scenarios": [s['id'] for s in game_data.get('scenarios', [])]
        })

    with open(os.path.join(DEST_DIR, 'index.json'), 'w', encoding='utf-8') as manifest_file:
        json.dump(index_data, manifest_file, indent=2)

    print(f"Przygotowano {len(index_data)} gier (po 1 z kazdego ukladu, posortowane od m=1 N=3 do m=3 N=15).")

if __name__ == '__main__':
    main()
