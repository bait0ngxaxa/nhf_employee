export function formatDate(dateString: string, locale: string = 'th-TH'): string {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    return '-';
  }
  
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function formatDateTime(dateString: string, locale: string = 'th-TH'): string {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    return '-';
  }
  
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatTime(dateString: string, locale: string = 'th-TH'): string {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    return '-';
  }
  
  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatShortDate(dateString: string, locale: string = 'th-TH'): string {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    return '-';
  }
  
  return date.toLocaleDateString(locale, {
    year: '2-digit',
    month: 'short',
    day: 'numeric'
  });
}

export function formatThaiDate(dateString: string): string {
  return formatDate(dateString, 'th-TH');
}

export function formatThaiDateTime(dateString: string): string {
  return formatDateTime(dateString, 'th-TH');
}

export function formatThaiTime(dateString: string): string {
  return formatTime(dateString, 'th-TH');
}

export function getRelativeTime(dateString: string, locale: string = 'th-TH'): string {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  const now = new Date();
  
  if (isNaN(date.getTime())) {
    return '-';
  }
  
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (locale === 'th-TH') {
    if (diffSecs < 60) return 'เมื่อสักครู่';
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
    if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
  } else {
    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
  }
  
  return formatDate(dateString, locale);
}

export function isToday(dateString: string): boolean {
  if (!dateString) return false;
  
  const date = new Date(dateString);
  const today = new Date();
  
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function isPastDate(dateString: string): boolean {
  if (!dateString) return false;
  
  const date = new Date(dateString);
  const now = new Date();
  
  return date < now;
}

export function isFutureDate(dateString: string): boolean {
  if (!dateString) return false;
  
  const date = new Date(dateString);
  const now = new Date();
  
  return date > now;
}

export function getDaysUntil(dateString: string): number {
  if (!dateString) return 0;
  
  const date = new Date(dateString);
  const now = new Date();
  
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

export function generateFilename(prefix: string, extension: string = 'csv'): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('th-TH').replace(/\//g, '-');
  const timeStr = now.toLocaleTimeString('th-TH', { hour12: false }).replace(/:/g, '-');
  return `${prefix}_${dateStr}_${timeStr}.${extension}`;
}
