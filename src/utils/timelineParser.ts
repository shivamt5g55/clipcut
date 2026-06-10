import { ClipItem } from '../types';
import { parseTimestamp, formatSeconds } from './time';

/**
 * Parses free-form text containing video timelines/chapters and returns structured ClipItem rows.
 * Supports:
 * 1. Double timestamps (Range): "01:15 - 02:30 Cute puppy starts"
 * 2. Single timestamps:
 *    "0:00 - Intro"
 *    "1:30 - Mid segment"
 *    "3:10 - Outro"
 */
export function parseTimelineText(text: string, videoDuration: number | null): ClipItem[] {
  const lines = text.split('\n');
  const parsedItems: {
    startSec: number;
    endSec: number | null;
    rawText: string;
    lineName: string;
  }[] = [];

  // Regex to detect standard colon timestamps like "1:02:30", "01:25", "4:15"
  // Safe boundary constraints to avoid greediness
  const timestampRegex = /(?:\b|\s)(\d{1,2}:\d{2}(?::\d{2})?)\b/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Direct timestamp discovery on this line
    const matches: string[] = [];
    let match;
    // reset pointer
    timestampRegex.lastIndex = 0;
    while ((match = timestampRegex.exec(trimmed)) !== null) {
      matches.push(match[1]);
    }

    if (matches.length >= 2) {
      // Scenario A: Precise start and end range parsed from a single line
      const firstStr = matches[0];
      const secondStr = matches[1];

      const start = parseTimestamp(firstStr);
      const end = parseTimestamp(secondStr);

      if (start !== null && end !== null) {
        // Clean the descriptive name
        let name = trimmed;
        // Strip out matched timestamp text from subtitle
        name = name.replace(firstStr, '').replace(secondStr, '');
        // Clean common separators: dashes, colons, brackets, spaces
        name = name.replace(/^[-\s:;~[\](){}]*|[-\s:;~[\](){}]*$/g, '').trim();

        if (!name) {
          name = `Parsed Segment (${firstStr} - ${secondStr})`;
        }

        parsedItems.push({
          startSec: start,
          endSec: end,
          rawText: trimmed,
          lineName: name
        });
      }
    } else if (matches.length === 1) {
      // Scenario B: Single timestamp. We will map chronological end points sequentially later.
      const timeStr = matches[0];
      const start = parseTimestamp(timeStr);

      if (start !== null) {
        let name = trimmed.replace(timeStr, '');
        name = name.replace(/^[-\s:;~[\](){}]*|[-\s:;~[\](){}]*$/g, '').trim();

        if (!name) {
          name = `Chapter @ ${timeStr}`;
        }

        parsedItems.push({
          startSec: start,
          endSec: null, // to be inferred
          rawText: trimmed,
          lineName: name
        });
      }
    }
  }

  // Sort chronologically by start seconds
  parsedItems.sort((a, b) => a.startSec - b.startSec);

  // Map to final ClipItem format
  const finalClips: ClipItem[] = [];

  for (let i = 0; i < parsedItems.length; i++) {
    const item = parsedItems[i];
    let start = item.startSec;
    let end = item.endSec;

    if (end === null) {
      // Infer end time from the next segment start
      if (i + 1 < parsedItems.length) {
        end = parsedItems[i + 1].startSec;
      } else if (videoDuration && videoDuration > start) {
        end = videoDuration;
      } else {
        // Fallback default duration of 30 seconds if video duration is unknown
        end = start + 30;
      }
    }

    // Ensure start is before end
    if (start >= end) {
      end = start + 10; // offset if overlapping
    }

    const mockId = Math.random().toString(36).substring(2, 11);
    
    finalClips.push({
      id: mockId,
      name: item.lineName,
      startTime: formatSeconds(start),
      endTime: formatSeconds(end),
      validatedStart: start,
      validatedEnd: end,
      error: null
    });
  }

  return finalClips;
}
