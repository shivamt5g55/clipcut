/**
 * Parse a timestamp string into seconds.
 * Supports: "2:46", "0:30", "1:02:30", "146" (plain seconds), "146.5"
 */
export function parseTimestamp(str: string): number | null {
  if (!str) return null;
  const clean = str.trim();
  if (clean === '') return null;

  // Check if it is a plain float/integer
  if (/^\d+(\.\d+)?$/.test(clean)) {
    return parseFloat(clean);
  }

  // Check hh:mm:ss or mm:ss
  const parts = clean.split(':');
  if (parts.length === 2) {
    // mm:ss
    const mins = parseInt(parts[0], 10);
    const secs = parseFloat(parts[1]);
    if (isNaN(mins) || isNaN(secs) || mins < 0 || secs < 0 || secs >= 60) {
      return null;
    }
    return mins * 60 + secs;
  } else if (parts.length === 3) {
    // hh:mm:ss
    const hrs = parseInt(parts[0], 10);
    const mins = parseInt(parts[1], 10);
    const secs = parseFloat(parts[2]);
    if (
      isNaN(hrs) || isNaN(mins) || isNaN(secs) ||
      hrs < 0 || mins < 0 || mins >= 60 || secs < 0 || secs >= 60
    ) {
      return null;
    }
    return hrs * 3600 + mins * 60 + secs;
  }

  return null;
}

/**
 * Format active seconds counter into mm:ss or hh:mm:ss
 */
export function formatSeconds(secs: number, includeMs = false): string {
  if (isNaN(secs) || secs < 0) return '00:00';

  const hrs = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  const remainingSecs = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 1000);

  const pad = (num: number) => num.toString().padStart(2, '0');

  let result = '';
  if (hrs > 0) {
    result += `${pad(hrs)}:`;
  }
  result += `${pad(mins)}:${pad(remainingSecs)}`;

  if (includeMs) {
    result += `.${ms.toString().padStart(3, '0')}`;
  }

  return result;
}

/**
 * Format bytes into human readable sizes (KB, MB, GB)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
