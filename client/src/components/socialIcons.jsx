export function WhatsAppIcon({ size = 16, className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 11.5A8.5 8.5 0 0 1 7.1 18.9L3.5 20l1.2-3.4A8.5 8.5 0 1 1 20 11.5Z" />
      <path d="M9.1 8.9c.2-.5.4-.5.7-.5h.6c.2 0 .4.1.5.4l.7 1.7c.1.2.1.4 0 .6l-.4.7c-.1.2-.1.4 0 .6.4.7 1.1 1.4 1.9 1.8.2.1.4.1.6 0l.7-.4c.2-.1.4-.1.6 0l1.6.7c.3.1.4.3.4.5v.6c0 .3-.1.5-.5.7-.5.3-1.2.4-1.9.2-2-.5-4.2-2.7-4.9-4.8-.2-.8-.1-1.5.2-2Z" />
    </svg>
  );
}

export function FacebookIcon({ size = 16, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor" aria-hidden="true">
      <path d="M13.6 21v-7h2.4l.4-2.8h-2.8V9.4c0-.8.2-1.4 1.4-1.4h1.5V5.5c-.3 0-1.1-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.1H8V14h2.6v7h3Z" />
    </svg>
  );
}

export function InstagramIcon({ size = 16, className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TikTokIcon({ size = 16, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor" aria-hidden="true">
      <path d="M14.7 4h2.5c.1 1.1.8 2.1 1.8 2.7.5.3 1 .5 1.6.6v2.6c-1.3 0-2.6-.4-3.7-1.1v5.6c0 2.8-2.2 4.9-5.1 4.9S6.8 17.2 6.8 14.5c0-2.6 2-4.7 4.6-4.9v2.6c-1.1.2-1.9 1.1-1.9 2.3 0 1.3 1 2.3 2.3 2.3 1.4 0 2.3-1 2.3-2.5V4h.6Z" />
    </svg>
  );
}
