import os
import json
import random
import shutil

SOURCE_DIR = '../simplified_scenarios'
DEST_DIR = './games'
GAMES_TO_SAMPLE = 10  # Ilość urozmaiconych gier, w które Ty (lub uczestnicy eksperymentu) możecie zagrać. 

def main():
    if os.path.exists(DEST_DIR):
        shutil.rmtree(DEST_DIR)
    os.makedirs(DEST_DIR)

    all_files = [f for f in os.listdir(SOURCE_DIR) if f.endswith('.ggame.json')]
    valid_games = []

    for f in all_files:
        path = os.path.join(SOURCE_DIR, f)
        with open(path, 'r', encoding='utf-8') as file:
            try:
                data = json.load(file)
                # Odrzucamy wszystkie pliki, którym z różnych przyczyn nie udało uformować się min. X scenariuszy
                if len(data.get('scenarios', [])) > 0:
                    valid_games.append((f, data))
            except Exception as e:
                print(f"Error reading {f}: {e}")

    # Wybierz określoną losową liczbę gier do paczki webowej
    if len(valid_games) > GAMES_TO_SAMPLE:
        selected = random.sample(valid_games, GAMES_TO_SAMPLE)
    else:
        selected = valid_games

    manifest = []
    
    for filename, game_data in selected:
        dest_path = os.path.join(DEST_DIR, filename)
        
        with open(dest_path, 'w', encoding='utf-8') as out_file:
            json.dump(game_data, out_file, separators=(',', ':'))
            
        manifest.append({
            "filename": filename,
            "id": game_data.get('original_game', {}).get('id'),
            "scenarios": [s['id'] for s in game_data.get('scenarios', [])]
        })

    with open(os.path.join(DEST_DIR, 'index.json'), 'w', encoding='utf-8') as manifest_file:
        json.dump(manifest, manifest_file, indent=2)

    print(f"Pomyślnie skopiowano {len(selected)} wyselekcjonowanych scenariuszy (simplified) do {DEST_DIR}.")
    print("Wygenerowano też plik index.json dla aplikacji.")

if __name__ == '__main__':
    main()
