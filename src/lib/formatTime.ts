export function formatRiyadhTime(iso: string, isRtl: boolean): string {
  return new Date(iso).toLocaleTimeString(isRtl ? 'ar-SA' : 'en-SA', {
    timeZone: 'Asia/Riyadh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatRiyadhDateTime(iso: string, isRtl: boolean): string {
  return new Date(iso).toLocaleString(isRtl ? 'ar-SA' : 'en-SA', {
    timeZone: 'Asia/Riyadh',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
