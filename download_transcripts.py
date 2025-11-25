import os
import re
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import TextFormatter

# Configuration
SOURCE_FOLDER = "Notes"       
OUTPUT_FOLDER = "Transcripts"
SOURCE_EXTENSION = ".md"

def get_video_id(text):
    """
    Scans text for youtube.com or youtu.be links and extracts the 11-char Video ID.
    """
    match_standard = re.search(r'youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})', text)
    if match_standard:
        return match_standard.group(1)
    
    match_short = re.search(r'youtu\.be/([a-zA-Z0-9_-]{11})', text)
    if match_short:
        return match_short.group(1)
        
    return None

def main():
    # Create the output directory if it doesn't exist
    if not os.path.exists(OUTPUT_FOLDER):
        os.makedirs(OUTPUT_FOLDER)
        print(f"Created directory: {OUTPUT_FOLDER}")

    # Check if Source directory exists
    if not os.path.exists(SOURCE_FOLDER):
        print(f"Error: The folder '{SOURCE_FOLDER}' does not exist.")
        return

    # Get all markdown files in the 'Notes' directory
    files = [f for f in os.listdir(SOURCE_FOLDER) if f.endswith(SOURCE_EXTENSION)]

    if not files:
        print(f"No markdown files found in '{SOURCE_FOLDER}'.")
        return

    formatter = TextFormatter()

    for filename in files:
        # Construct output filename (Base name inside Transcripts folder)
        base_name = os.path.splitext(filename)[0]
        output_path = os.path.join(OUTPUT_FOLDER, f"{base_name}.txt")

        # Check if transcript already exists
        if os.path.exists(output_path):
            print(f"Skipping: '{filename}' (Transcript already exists)")
            continue

        print(f"Processing: '{filename}'...")

        try:
            # Construct the full path to the input file
            input_path = os.path.join(SOURCE_FOLDER, filename)

            # Read the markdown file
            with open(input_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Find the video ID
            video_id = get_video_id(content)

            if not video_id:
                print(f"  [!] No YouTube link found in '{filename}'.")
                continue

            # Download Transcript
            # (Using the standard static method call which is correct for most versions)
            transcript = YouTubeTranscriptApi.get_transcript(video_id)
            
            # Format to plain text
            formatted_text = formatter.format_transcript(transcript)

            # Save to file
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(formatted_text)
            
            print(f"  [✓] Success. Saved to '{output_path}'")

        except Exception as e:
            print(f"  [X] Error fetching transcript: {e}")

if __name__ == "__main__":
    main()