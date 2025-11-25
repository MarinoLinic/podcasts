import os
import re
import datetime
import sys

# --- IMPORT HACK (Keep this to bypass your IP/Library issues) ---
try:
    from youtube_transcript_api import YouTubeTranscriptApi
    from youtube_transcript_api.formatters import TextFormatter
    LIBRARY_AVAILABLE = True
except ImportError:
    LIBRARY_AVAILABLE = False

if LIBRARY_AVAILABLE and not hasattr(YouTubeTranscriptApi, 'get_transcript'):
    try:
        from youtube_transcript_api._api import YouTubeTranscriptApi
    except ImportError:
        LIBRARY_AVAILABLE = False
# ---------------------------------------------------------------

# Configuration
SOURCE_FOLDER = "Notes"       
OUTPUT_FOLDER = "Transcripts"
SOURCE_EXTENSION = ".md"

# Regex patterns
YOUTUBE_REGEX = r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})'
RATING_REGEX = r'Rating:\s*(\d+)'
DATE_REGEX = r'Date:\s*`?([0-9]{1,2}\s+[A-Za-z]{3}\s+[0-9]{4})`?'

def get_video_ids(text):
    return re.findall(YOUTUBE_REGEX, text)

def extract_metadata_and_clean(content, filename):
    # 1. Author/Title
    base_name = os.path.splitext(filename)[0]
    if " - " in base_name:
        author, title = base_name.split(" - ", 1)
    else:
        author, title = "Uncategorized", base_name

    # 2. Extract Metadata
    rating_match = re.search(RATING_REGEX, content)
    rating = int(rating_match.group(1)) if rating_match else 0
    
    date_match = re.search(DATE_REGEX, content)
    date_str = ""
    if date_match:
        try:
            dt_obj = datetime.datetime.strptime(date_match.group(1), "%d %b %Y")
            date_str = dt_obj.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # 3. CLEAN CONTENT
    # Remove Rating AND Date lines from the body so they don't show up twice
    content = re.sub(r'^Rating:\s*\d+.*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'^Date:\s*`?.*`?.*$', '', content, flags=re.MULTILINE)
    
    # Clean up empty newlines
    content = re.sub(r'\n{3,}', '\n\n', content).strip()

    # 4. Check if YAML exists
    if content.startswith("---"):
        return None, content

    # 5. Generate YAML
    yaml = "---\n"
    yaml += f'layout: default\n'
    yaml += f'title: "{title}"\n'
    yaml += f'author: "{author}"\n'
    yaml += f'rating: {rating}\n'
    if date_str:
        yaml += f'date: {date_str}\n'
    yaml += "---\n\n"

    return yaml, content

def main():
    if not os.path.exists(OUTPUT_FOLDER):
        os.makedirs(OUTPUT_FOLDER)
    if not os.path.exists(SOURCE_FOLDER):
        print(f"Error: Folder '{SOURCE_FOLDER}' not found.")
        return

    files = [f for f in os.listdir(SOURCE_FOLDER) if f.endswith(SOURCE_EXTENSION)]
    formatter = TextFormatter() if LIBRARY_AVAILABLE else None

    print(f"Scanning {len(files)} files...")

    for filename in files:
        input_path = os.path.join(SOURCE_FOLDER, filename)
        
        with open(input_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # --- STEP 1: Metadata & Cleaning ---
        yaml_header, cleaned_body = extract_metadata_and_clean(content, filename)
        
        if yaml_header:
            print(f"Updated Metadata: {filename}")
            full_text = yaml_header + cleaned_body
            with open(input_path, 'w', encoding='utf-8') as f:
                f.write(full_text)
            content = full_text

        # --- STEP 2: Transcripts (Skip if blocked/missing) ---
        if not LIBRARY_AVAILABLE: continue

        base_name = os.path.splitext(filename)[0]
        output_path = os.path.join(OUTPUT_FOLDER, f"{base_name}.txt")

        if os.path.exists(output_path): continue

        video_ids = get_video_ids(content)
        if not video_ids: continue

        print(f"Attempting Download: '{filename}'...")
        try:
            full_transcript_text = ""
            success = False
            for i, video_id in enumerate(video_ids):
                # Using standard call (with hack applied at top if needed)
                transcript_data = YouTubeTranscriptApi.get_transcript(video_id)
                formatted_part = formatter.format_transcript(transcript_data)
                
                if len(video_ids) > 1:
                    full_transcript_text += f"\n--- TRANSCRIPT PART {i+1} ---\n"
                full_transcript_text += formatted_part + "\n"
                success = True

            if success:
                with open(output_path, 'w', encoding='utf-8') as f:
                    f.write(full_transcript_text)
                print(f"  [✓] Success.")

        except Exception as e:
            print(f"  [!] Skipped transcript (Error): {e}")
            continue

if __name__ == "__main__":
    main()