export interface ClipItem {
  id: string;
  name: string;
  startTime: string; // User-entered text representation (e.g. "0:30")
  endTime: string;   // User-entered text representation (e.g. "1:15")
  validatedStart: number | null; // Parsed seconds
  validatedEnd: number | null;   // Parsed seconds
  error?: string | null;
}

export interface ProcessingStatus {
  active: boolean;
  currentIndex: number;
  totalClips: number;
  progress: number; // 0 to 100
  statusText: string;
  clipName: string;
}

export interface ProcessedClip {
  id: string;
  name: string;
  url: string;
  fileSize: number;
  duration: number;
  startTime: number;
  endTime: number;
  fileName: string;
  format: 'mp4' | 'webm' | 'mp3' | 'wav';
}

export interface UserVideo {
  file?: File;
  name: string;
  size: number;
  url: string;
  duration: number; // in seconds
  width: number;
  height: number;
  isYoutube?: boolean;
}
