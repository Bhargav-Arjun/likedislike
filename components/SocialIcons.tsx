
'use client';

import { Profile } from '@/lib/supabase';

// Renders one circular icon per social platform the user has actually filled in.
// Empty platforms render nothing at all (per design decision: don't show faded
// placeholder icons on the public profile -- keep it uncluttered).
const PLATFORMS: {
  key: keyof Pick<Profile, 'whatsapp' | 'youtube' | 'snapchat' | 'facebook' | 'gmail' | 'telegram' | 'phone'>;
  label: string;
  color: string;
  toHref: (value: string) => string;
  svgPath: string;
}[] = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    color: '#25D366',
    toHref: (v) => `https://wa.me/${v.replace(/\D/g, '')}`,
    svgPath:
      'M17.6 6.3A8 8 0 003.7 16l-1 3.7 3.8-1A8 8 0 1017.6 6.3zM12 18.5a6.4 6.4 0 01-3.3-.9l-.2-.1-2.4.6.6-2.3-.1-.2A6.5 6.5 0 1112 18.5zm3.5-4.8c-.2-.1-1.1-.6-1.3-.6s-.3-.1-.4.1l-.6.7c-.1.1-.2.1-.4.1a5.3 5.3 0 01-2.6-2.3c-.2-.3.2-.3.5-.9.1-.1 0-.2 0-.3l-.6-1.4c-.1-.4-.3-.3-.4-.3h-.4a.7.7 0 00-.5.2 2.1 2.1 0 00-.7 1.6c0 .9.7 1.9.8 2a9.2 9.2 0 003.6 3.2c1.3.5 1.6.4 1.9.4a1.6 1.6 0 001.1-.8c.1-.3.1-.5.1-.6s-.2-.1-.3-.2z',
  },
  {
    key: 'youtube',
    label: 'YouTube',
    color: '#FF0000',
    toHref: (v) => v,
    svgPath:
      'M21.6 7.2a2.5 2.5 0 00-1.8-1.8C18.1 5 12 5 12 5s-6.1 0-7.8.4A2.5 2.5 0 002.4 7.2 26 26 0 002 12a26 26 0 00.4 4.8 2.5 2.5 0 001.8 1.8C5.9 19 12 19 12 19s6.1 0 7.8-.4a2.5 2.5 0 001.8-1.8A26 26 0 0022 12a26 26 0 00-.4-4.8zM10 15V9l5.2 3z',
  },
  {
    key: 'snapchat',
    label: 'Snapchat',
    color: '#FFFC00',
    toHref: (v) => v,
    svgPath:
      'M12 2c3 0 5 2.2 5 5.3 0 1 0 2 .1 2.6.1.3.4.4.9.6.6.2 1.3.4 1.3 1.1 0 .5-.5.8-1 1a3 3 0 00-1 .6c0 .3.2.7.5 1.1.7 1 1.7 1.3 1.7 1.9 0 .7-1.5.9-2 1-.1.3-.2.7-.4 1-.3.4-.9.3-1.5.4-.5.1-.8.6-1.6.9-.7.3-1.5-.2-2-.2s-1.3.5-2 .2c-.8-.3-1.1-.8-1.6-.9-.6-.1-1.2 0-1.5-.4-.2-.3-.3-.7-.4-1-.5-.1-2-.3-2-1 0-.6 1-.9 1.7-1.9.3-.4.5-.8.5-1.1a3 3 0 00-1-.6c-.5-.2-1-.5-1-1 0-.7.7-.9 1.3-1.1.5-.2.8-.3.9-.6.1-.6.1-1.6.1-2.6C7 4.2 9 2 12 2z',
  },
  {
    key: 'facebook',
    label: 'Facebook',
    color: '#1877F2',
    toHref: (v) => v,
    svgPath:
      'M13.5 21v-7.5h2.5l.4-3H13.5V8.5c0-.9.2-1.5 1.5-1.5h1.6V4.3A21 21 0 0014.5 4c-2.2 0-3.7 1.3-3.7 3.9V10.5H8.4v3h2.4V21z',
  },
  {
    key: 'gmail',
    label: 'Gmail',
    color: '#EA4335',
    toHref: (v) => `mailto:${v}`,
    svgPath:
      'M2 6.5A2.5 2.5 0 014.5 4h15A2.5 2.5 0 0122 6.5v11a2.5 2.5 0 01-2.5 2.5h-15A2.5 2.5 0 012 17.5zM4.5 6l7.5 5.5L19.5 6M4.5 6v11.5h15V6',
  },
  {
    key: 'telegram',
    label: 'Telegram',
    color: '#26A5E4',
    toHref: (v) => v,
    svgPath:
      'M21.9 4.4L18.8 19c-.2 1-.9 1.3-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9L18 8.3c.4-.4-.1-.6-.6-.2L7.1 14.4l-4.7-1.5c-1-.3-1-1 .2-1.5l18.4-7.1c.9-.3 1.6.2 1.3 1.4z',
  },
  {
    key: 'phone',
    label: 'Phone',
    color: '#22C55E',
    toHref: (v) => `tel:${v}`,
    svgPath:
      'M6.6 10.8a15.9 15.9 0 006.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 013 4c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z',
  },
];

export default function SocialIcons({ profile }: { profile: Profile }) {
  const active = PLATFORMS.filter((p) => profile[p.key]);

  if (active.length === 0) return null;

  return (
    <div className="flex gap-2 mb-3">
      {active.map((p) => (
        <a
          key={p.key}
          href={p.toHref(profile[p.key] as string)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={p.label}
          className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill={p.color}>
            <path d={p.svgPath} />
          </svg>
        </a>
      ))}
    </div>
  );
}
