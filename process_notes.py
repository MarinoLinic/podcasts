import os
import re
import datetime
import sys

# --- IMPORT HACK (Keep this) ---
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
# -------------------------------

# Configuration
INPUT_FOLDER = "Original_Notes"       
JEKYLL_OUTPUT_FOLDER = "Notes"
TEXT_OUTPUT_FOLDER = "Notes_Text"
TRANSCRIPT_FOLDER = "Transcripts"
SOURCE_EXTENSION = ".md"

# Regex patterns
YOUTUBE_REGEX = r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})'
RATING_REGEX = r'Rating:\s*(\d+)'
# Updated Date Regex to be more flexible (no ticks required)
DATE_REGEX = r'Date:\s*`?([0-9]{1,2}\s+[A-Za-z]{3,}\s+[0-9]{4})`?'
# New Regexes
TYPE_REGEX = r'Type:\s*(.*)'
TAGS_REGEX = r'Tags:\s*(.*)'

def get_video_ids(text):
    return re.findall(YOUTUBE_REGEX, text)

# --- 1. JEKYLL PROCESSING ---
def process_for_jekyll(content, filename):
    # Extract Author/Title
    base_name = os.path.splitext(filename)[0]
    if " - " in base_name:
        author, title = base_name.split(" - ", 1)
    else:
        author, title = "Uncategorized", base_name

    # Extract Metadata
    rating_match = re.search(RATING_REGEX, content)
    rating = int(rating_match.group(1)) if rating_match else 0
    
    type_match = re.search(TYPE_REGEX, content)
    note_type = type_match.group(1).strip() if type_match else "article" # default

    tags_match = re.search(TAGS_REGEX, content)
    tags = tags_match.group(1).strip() if tags_match else ""
    
    date_match = re.search(DATE_REGEX, content)
    date_str = "1970-01-01" # Default fallback
    
    if date_match:
        date_text = date_match.group(1)
        try:
            dt_obj = datetime.datetime.strptime(date_text, "%d %b %Y")
            date_str = dt_obj.strftime("%Y-%m-%d")
        except ValueError:
            try:
                dt_obj = datetime.datetime.strptime(date_text, "%d %B %Y")
                date_str = dt_obj.strftime("%Y-%m-%d")
            except ValueError:
                print(f"  [!] WARNING: Could not parse date '{date_text}' in {filename}. Using default.")
    else:
        print(f"  [!] WARNING: No date found in {filename}. Using 1970-01-01.")

    # CLEAN CONTENT: 
    # Remove Rating, Date, and Type lines.
    # We DO NOT remove Tags line (it remains in body).
    content = re.sub(r'^Rating:\s*\d+.*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'^Date:\s*.*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'^Type:\s*.*$', '', content, flags=re.MULTILINE)
    # Note: Source/URL is usually at the bottom or inline, we leave it unless specified.
    
    # Clean up excessive newlines
    content = re.sub(r'\n{3,}', '\n\n', content).strip()

    # Generate YAML
    yaml = "---\n"
    yaml += f'layout: default\n'
    yaml += f'title: "{title}"\n'
    yaml += f'author: "{author}"\n'
    yaml += f'rating: {rating}\n'
    yaml += f'date: {date_str}\n'
    yaml += f'type: "{note_type}"\n'
    # We add tags to YAML too so Jekyll can use them if needed, even if they stay in body
    yaml += f'tags: [{tags}]\n' 
    yaml += "---\n\n"

    return yaml + content

# --- 2. FACEBOOK/TEXT PROCESSING ---
def convert_to_text_format(content, filename):
    # Extract Title for Header
    base_name = os.path.splitext(filename)[0]
    title_parts = base_name.split(" - ", 1)
    full_title = f"{title_parts[0]} on {title_parts[1]}" if len(title_parts) > 1 else base_name

    # 1. Header Construction (SIMPLIFIED per request)
    # Only the title remains.
    header = f"{full_title}"

    # 2. Body Processing
    lines = content.split('\n')
    processed_lines = []
    
    for line in lines:
        # Remove Metadata lines we don't want in text version
        # We strip Rating, Date, Type, and Source/URL lines.
        # We KEEP Tags.
        if "Rating:" in line or "Date:" in line or "Type:" in line:
            continue
        if "Source:" in line or "Video URL:" in line:
            continue
        if "Summary:" in line: # Optional: keep or remove summary label, keeping for now
            pass
        
        # Handle Empty Lines (Preserve Paragraphs)
        if not line.strip():
            if processed_lines and processed_lines[-1] != "":
                processed_lines.append("")
            continue

        # Headers (### **I. Title**) -> I. Title
        if line.strip().startswith('#'):
            clean_header = line.lstrip('#').strip()
            clean_header = clean_header.replace('**', '')
            # Ensure separation before header
            if processed_lines and processed_lines[-1] != "":
                processed_lines.append("")
            processed_lines.append(clean_header)
            continue
            
        # Lists (Sub-bullets) - NO EXTRA NEWLINE
        if re.match(r'^\s+(\*|-)\s+', line):
            clean_sub = re.sub(r'^\s+(\*|-)\s+', '-- ', line)
            clean_sub = clean_sub.replace('**', '')
            processed_lines.append(clean_sub)
            continue

        # Lists (Main bullets) - FORCE NEWLINE BEFORE
        if re.match(r'^(\*|-)\s+', line):
            clean_item = re.sub(r'^(\*|-)\s+', '- ', line)
            clean_item = clean_item.replace('**', '')
            
            # Add breathing room before a main bullet point
            if processed_lines and processed_lines[-1] != "":
                processed_lines.append("")
                
            processed_lines.append(clean_item)
            continue
            
        # Separators
        if "---" in line:
            if processed_lines and processed_lines[-1] != "":
                processed_lines.append("")
            processed_lines.append("---")
            continue

        # Normal text
        processed_lines.append(line.replace('**', ''))

    body = "\n".join(processed_lines)
    body = re.sub(r'\n{3,}', '\n\n', body).strip()
    
    return header + "\n\n" + body

def main():
    # Ensure directories exist
    for folder in [INPUT_FOLDER, JEKYLL_OUTPUT_FOLDER, TEXT_OUTPUT_FOLDER, TRANSCRIPT_FOLDER]:
        if not os.path.exists(folder):
            os.makedirs(folder)

    files = [f for f in os.listdir(INPUT_FOLDER) if f.endswith(SOURCE_EXTENSION)]
    formatter = TextFormatter() if LIBRARY_AVAILABLE else None

    print(f"Scanning {len(files)} files in '{INPUT_FOLDER}'...")

    for filename in files:
        input_path = os.path.join(INPUT_FOLDER, filename)
        
        with open(input_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # --- A. Generate Jekyll Markdown ---
        jekyll_content = process_for_jekyll(content, filename)
        jekyll_path = os.path.join(JEKYLL_OUTPUT_FOLDER, filename)
        with open(jekyll_path, 'w', encoding='utf-8') as f:
            f.write(jekyll_content)
        
        # --- B. Generate Text Output ---
        text_content = convert_to_text_format(content, filename)
        text_filename = os.path.splitext(filename)[0] + ".txt"
        text_path = os.path.join(TEXT_OUTPUT_FOLDER, text_filename)
        with open(text_path, 'w', encoding='utf-8') as f:
            f.write(text_content)

        print(f"Processed: {filename}")

        # --- C. Transcripts ---
        if not LIBRARY_AVAILABLE: continue

        base_name = os.path.splitext(filename)[0]
        transcript_path = os.path.join(TRANSCRIPT_FOLDER, f"{base_name}.txt")

        if os.path.exists(transcript_path): continue

        video_ids = get_video_ids(content)
        if not video_ids: continue

        print(f"  Downloading Transcript...")
        try:
            full_transcript_text = ""
            success = False
            for i, video_id in enumerate(video_ids):
                transcript_data = YouTubeTranscriptApi.get_transcript(video_id)
                formatted_part = formatter.format_transcript(transcript_data)
                
                if len(video_ids) > 1:
                    full_transcript_text += f"\n--- TRANSCRIPT PART {i+1} ---\n"
                full_transcript_text += formatted_part + "\n"
                success = True

            if success:
                with open(transcript_path, 'w', encoding='utf-8') as f:
                    f.write(full_transcript_text)

        except Exception as e:
            print(f"  [!] Skipped transcript: {e}")
            continue

if __name__ == "__main__":
    main()