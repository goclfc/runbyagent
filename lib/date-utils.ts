// Format dates and times in Asia/Tbilisi timezone (UTC+4)

export function formatDateTbilisi(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Tbilisi',
  }).format(d);
}

export function formatTimeTbilisi(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tbilisi',
  }).format(d);
}

export function formatDateShortTbilisi(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Tbilisi',
  }).format(d);
}

export function formatDateMonthDayTbilisi(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Tbilisi',
  }).format(d);
}

// Get date string in YYYY-MM-DD format for grouping (in Tbilisi timezone)
export function getDateKeyTbilisi(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tbilisi',
  }).format(d);
  return formatted;
}
