// Helper to send events to both our API and GA4
export function sendEvent(
  name: string,
  params?: Record<string, any>
): void {
  // Send to our first-party API
  const path = window.location.pathname;
  fetch('/api/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      path,
      meta: params,
    }),
    keepalive: true,
  }).catch(() => {});

  // Send to GA4 if available
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', name, params);
  }
}

// Type declaration for gtag
declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'js',
      targetOrAction: string | Date,
      params?: Record<string, any>
    ) => void;
    dataLayer?: any[];
  }
}
