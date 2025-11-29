import os
import re
import datetime
import textwrap
import sys

# --- CONFIGURATION ---
INPUT_FOLDER = "Original_Notes"       
JEKYLL_OUTPUT_FOLDER = "Notes"
TEXT_OUTPUT_FOLDER = "Notes_Text"
TRANSCRIPT_FOLDER = "Transcripts"
IMAGE_OUTPUT_FOLDER = os.path.join("assets", "img", "og") # Path for generated images
SOURCE_EXTENSION = ".md"
FONT_PATH = "font.ttf" # Place a .ttf file in the root folder for better looking text

# TOGGLES
DOWNLOAD_TRANSCRIPTS = False # Set to True to enable YouTube transcript downloading

# --- LIBRARIES CHECK ---
# Check for YouTube Transcript API
try:
    from youtube_transcript_api import YouTubeTranscriptApi
    from youtube_transcript_api.formatters import TextFormatter
    YT_LIBRARY_AVAILABLE = True
except ImportError:
    YT_LIBRARY_AVAILABLE = False

# Check for Pillow (Image Generation)
try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("Warning: 'Pillow' library not found. Images will not be generated.")
    print("Run: pip install Pillow")

# --- REGEX PATTERNS ---
YOUTUBE_REGEX = r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})'
RATING_REGEX = r'Rating:\s*(\d+)'
DATE_REGEX = r'Date:\s*`?([0-9]{1,2}\s+[A-Za-z]{3,}\s+[0-9]{4})`?'
TYPE_REGEX = r'Type:\s*(.*)'
TAGS_REGEX = r'Tags:\s*(.*)'

def get_video_ids(text):
    return re.findall(YOUTUBE_REGEX, text)

# --- IMAGE GENERATION FUNCTION ---
def generate_og_image(title, author, date_str, filename):
    if not PIL_AVAILABLE:
        return

    # 1. Define Output Path
    # Replace .md with .png for the image file
    image_filename = os.path.splitext(filename)[0] + ".png"
    save_path = os.path.join(IMAGE_OUTPUT_FOLDER, image_filename)

    # 2. Check if exists (Optimization)
    if os.path.exists(save_path):
        return # Skip generation

    print(f"  [+] Generating Social Image for: {filename}")

    # 3. Setup Canvas (Open Graph standard is 1200x630)
    width, height = 1200, 630
    background_color = "#ffffff" # White background
    text_color = "#111111"       # Dark text
    accent_color = "#0969da"     # Blue accent
    
    img = Image.new('RGB', (width, height), color=background_color)
    draw = ImageDraw.Draw(img)
    
    # 4. Load Fonts
    try:
        # Sizes: Title (70), Meta (40), Footer (30)
        font_title = ImageFont.truetype(FONT_PATH, 70)
        font_meta = ImageFont.truetype(FONT_PATH, 40)
        font_footer = ImageFont.truetype(FONT_PATH, 30)
    except IOError:
        # Fallback if font.ttf isn't found
        font_title = ImageFont.load_default()
        font_meta = ImageFont.load_default()
        font_footer = ImageFont.load_default()

    # 5. Draw "Marino's Podcast Notes" (Top Left)
    draw.text((60, 60), "Marino's Podcast Notes", font=font_footer, fill=accent_color)

    # 6. Wrap and Draw Title (Centered Vertically approx)
    margin = 60
    # Text wrapping logic
    # Approx 25 characters fit on a line with size 70 font
    lines = textwrap.wrap(title, width=25) 
    
    line_height = 80 # Approx height for size 70
    total_text_height = len(lines) * line_height
    start_y = (height - total_text_height) / 2 - 40 # Shift up slightly
    
    current_y = start_y
    for line in lines:
        draw.text((margin, current_y), line, font=font_title, fill=text_color)
        current_y += line_height

    # 7. Draw Author and Date (Bottom Left)
    meta_text = f"{author}  •  {date_str}"
    draw.text((margin, height - 100), meta_text, font=font_meta, fill="#666666")

    # 8. Save
    img.save(save_path)

# --- JEKYLL PROCESSING ---
def process_for_jekyll(content, filename):
    # Extract Author/Title from filename
    base_name = os.path.splitext(filename)[0]
    if " - " in base_name:
        author, title = base_name.split(" - ", 1)
    else:
        author, title = "Uncategorized", base_name

    # Extract Metadata via Regex
    rating_match = re.search(RATING_REGEX, content)
    rating = int(rating_match.group(1)) if rating_match else 0
    
    type_match = re.search(TYPE_REGEX, content)
    note_type = type_match.group(1).strip() if type_match else "article" 

    tags_match = re.search(TAGS_REGEX, content)
    tags = tags_match.group(1).strip() if tags_match else ""
    
    date_match = re.search(DATE_REGEX, content)
    date_str = "1970-01-01" 
    
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

    # CLEAN CONTENT: Remove metadata lines from body
    content = re.sub(r'^Rating:\s*\d+.*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'^Date:\s*.*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'^Type:\s*.*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'^Tags:\s*.*$', '', content, flags=re.MULTILINE)
    
    # Clean up excessive newlines
    content = re.sub(r'\n{3,}', '\n\n', content).strip()

    # Generate YAML Front Matter
    yaml = "---\n"
    yaml += f'layout: default\n'
    yaml += f'title: "{title}"\n'
    yaml += f'author: "{author}"\n'
    yaml += f'rating: {rating}\n'
    yaml += f'date: {date_str}\n'
    yaml += f'type: "{note_type}"\n'
    yaml += f'tags: [{tags}]\n' 
    yaml += "---\n\n"

    # Return the full file content AND metadata for image generation
    return (yaml + content), title, author, date_str

# --- TEXT FILE PROCESSING ---
def convert_to_text_format(content, filename):
    # Extract Title for Header
    base_name = os.path.splitext(filename)[0]
    title_parts = base_name.split(" - ", 1)
    full_title = f"{title_parts[0]} on {title_parts[1]}" if len(title_parts) > 1 else base_name

    header = f"{full_title}"

    # Body Processing
    lines = content.split('\n')
    processed_lines = []
    
    for line in lines:
        # Remove Metadata lines
        if any(x in line for x in ["Rating:", "Date:", "Type:", "Tags:", "Source:", "Video URL:"]):
            continue
        
        # Keep Summary, remove explicit labels if preferred, or keep as is.
        
        # Replace image links
        line = re.sub(r'!\[.*?\]\((.*?)\)', r'Image: \1', line)
        
        # Headers handling
        if line.strip().startswith('#'):
            clean_header = line.lstrip('#').strip().replace('**', '').replace('*', '')
            if processed_lines and processed_lines[-1] != "":
                processed_lines.append("")
            processed_lines.append(clean_header)
            continue
            
        # List handling
        if re.match(r'^\s+(\*|-)\s+', line):
            clean_sub = re.sub(r'^\s+(\*|-)\s+', '-- ', line).replace('**', '').replace('*', '')
            processed_lines.append(clean_sub)
            continue

        if re.match(r'^(\*|-)\s+', line):
            clean_item = re.sub(r'^(\*|-)\s+', '- ', line).replace('**', '').replace('*', '')
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

        # Normal text cleaning
        processed_lines.append(line.replace('**', '').replace('*', ''))

    body = "\n".join(processed_lines)
    body = re.sub(r'\n{3,}', '\n\n', body).strip()
    
    return header + "\n\n" + body

# --- MAIN EXECUTION ---
def main():
    # 1. Ensure folders exist
    for folder in [INPUT_FOLDER, JEKYLL_OUTPUT_FOLDER, TEXT_OUTPUT_FOLDER, TRANSCRIPT_FOLDER, IMAGE_OUTPUT_FOLDER]:
        if not os.path.exists(folder):
            os.makedirs(folder)

    files = [f for f in os.listdir(INPUT_FOLDER) if f.endswith(SOURCE_EXTENSION)]
    
    # Initialize Transcript Formatter if needed
    formatter = None
    if DOWNLOAD_TRANSCRIPTS and YT_LIBRARY_AVAILABLE:
        formatter = TextFormatter()

    print(f"Scanning {len(files)} files in '{INPUT_FOLDER}'...")

    for filename in files:
        input_path = os.path.join(INPUT_FOLDER, filename)
        
        with open(input_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # --- A. Generate Jekyll Markdown ---
        # We now unpack the 4 return values
        jekyll_content, title, author, date_str = process_for_jekyll(content, filename)
        
        jekyll_path = os.path.join(JEKYLL_OUTPUT_FOLDER, filename)
        with open(jekyll_path, 'w', encoding='utf-8') as f:
            f.write(jekyll_content)
        
        # --- B. Generate Text Output ---
        text_content = convert_to_text_format(content, filename)
        text_filename = os.path.splitext(filename)[0] + ".txt"
        text_path = os.path.join(TEXT_OUTPUT_FOLDER, text_filename)
        with open(text_path, 'w', encoding='utf-8') as f:
            f.write(text_content)

        # --- C. Generate Social Image ---
        # Passes metadata to image generator
        generate_og_image(title, author, date_str, filename)

        print(f"Processed: {filename}")

        # --- D. Transcripts (Optional) ---
        if DOWNLOAD_TRANSCRIPTS and YT_LIBRARY_AVAILABLE:
            base_name = os.path.splitext(filename)[0]
            transcript_path = os.path.join(TRANSCRIPT_FOLDER, f"{base_name}.txt")

            # Skip if transcript already exists
            if os.path.exists(transcript_path): 
                continue

            video_ids = get_video_ids(content)
            if not video_ids: 
                continue

            print(f"  Downloading Transcript...")
            try:
                full_transcript_text = ""
                success = False
                for i, video_id in enumerate(video_ids):
                    # Use the _api fallback if needed, handled by library import check usually
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