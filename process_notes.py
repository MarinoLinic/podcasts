import os
import re
import datetime
import sys

# Try importing, but don't crash if library is missing/broken
try:
    from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound
    from youtube_transcript_api.formatters import TextFormatter
    LIBRARY_AVAILABLE = True
except ImportError:
    LIBRARY_AVAILABLE = False
    print("Warning: youtube_transcript_api not functioning. Transcripts will be skipped.")

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

    # 2. Rating
    rating_match = re.search(RATING_REGEX, content)
    rating = int(rating_match.group(1)) if rating_match else 0
    
    # 3. Date
    date_match = re.search(DATE_REGEX, content)
    date_str = ""
    if date_match:
        try:
            dt_obj = datetime.datetime.strptime(date_match.group(1), "%d %b %Y")
            date_str = dt_obj.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # 4. Cleanup Body (Remove Rating line only)
    content = re.sub(r'^Rating:\s*\d+.*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'\n{3,}', '\n\n', content).strip()

    # 5. Check if YAML exists
    if content.startswith("---"):
        return None, content

    # 6. Generate YAML
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

        # --- STEP 1: Process Metadata (ALWAYS RUNS) ---
        yaml_header, cleaned_body = extract_metadata_and_clean(content, filename)
        
        if yaml_header:
            print(f"Updated Metadata: {filename}")
            full_text = yaml_header + cleaned_body
            with open(input_path, 'w', encoding='utf-8') as f:
                f.write(full_text)
            content = full_text

        # --- STEP 2: Download Transcript (OPTIONAL / FAULT TOLERANT) ---
        # If this fails (IP block), we just skip it.
        if not LIBRARY_AVAILABLE:
            continue

        base_name = os.path.splitext(filename)[0]
        output_path = os.path.join(OUTPUT_FOLDER, f"{base_name}.txt")

        # Skip if we already have it
        if os.path.exists(output_path):
            continue

        video_ids = get_video_ids(content)
        if not video_ids:
            continue

        print(f"Attempting Download: '{filename}'...")

        try:
            full_transcript_text = ""
            success = False

            for i, video_id in enumerate(video_ids):
                # Try fetching
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
            # THIS IS THE FIX: We catch the error, print a warning, and CONTINUE.
            print(f"  [!] Skipped transcript (IP Block or Error): {e}")
            continue

if __name__ == "__main__":
    main()