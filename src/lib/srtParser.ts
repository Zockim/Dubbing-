export interface Subtitle {
  id: number;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
  speaker: string;
  spokenText: string;
}

export function parseSrt(srtText: string): Subtitle[] {
  const subtitles: Subtitle[] = [];
  // Normalize line endings
  const normalizedText = srtText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalizedText.trim().split(/\n\s*\n/);

  let unknownSpeakerCount = 0;

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length >= 3) {
      const id = parseInt(lines[0], 10);
      const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
      if (timeMatch) {
        const startHours = parseInt(timeMatch[1], 10);
        const startMinutes = parseInt(timeMatch[2], 10);
        const startSeconds = parseInt(timeMatch[3], 10);
        const startMilliseconds = parseInt(timeMatch[4], 10);
        const startTime = startHours * 3600 + startMinutes * 60 + startSeconds + startMilliseconds / 1000;

        const endHours = parseInt(timeMatch[5], 10);
        const endMinutes = parseInt(timeMatch[6], 10);
        const endSeconds = parseInt(timeMatch[7], 10);
        const endMilliseconds = parseInt(timeMatch[8], 10);
        const endTime = endHours * 3600 + endMinutes * 60 + endSeconds + endMilliseconds / 1000;

        const text = lines.slice(2).join('\n');
        
        let speaker = 'Default';
        let spokenText = text;

        // Match [NAME]: or NAME:
        const speakerMatch = text.match(/^\[?([A-Za-z0-9\s]+)\]?:\s*(.*)/s);
        if (speakerMatch) {
          speaker = speakerMatch[1].trim().toUpperCase();
          spokenText = speakerMatch[2].trim();
        } else {
          // Match dash indicating a different speaker
          const dashMatch = text.match(/^-\s*(.*)/s);
          if (dashMatch) {
            unknownSpeakerCount++;
            speaker = `SPEAKER ${unknownSpeakerCount}`;
            spokenText = dashMatch[1].trim();
          }
        }

        subtitles.push({ id, startTime, endTime, text, speaker, spokenText });
      }
    }
  }
  return subtitles;
}
