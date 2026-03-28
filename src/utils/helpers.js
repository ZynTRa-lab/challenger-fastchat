/**
 * Format a date string into a human-readable timestamp.
 * Returns "Bugün HH:MM", "Dün HH:MM", or "DD.MM.YYYY HH:MM".
 */
export function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();

  const pad = (n) => String(n).padStart(2, '0');
  const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  const dateOnly = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const diffDays = Math.round((dateOnly(now) - dateOnly(date)) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return `Bugün ${timeStr}`;
  if (diffDays === 1) return `Dün ${timeStr}`;

  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();
  return `${day}.${month}.${year} ${timeStr}`;
}

/**
 * Get the first 2 characters of a name, uppercased.
 */
export function getInitials(name) {
  if (!name) return '??';
  return name.trim().slice(0, 2).toUpperCase();
}

/**
 * Return a consistent Tailwind-compatible color class based on a userId hash.
 */
export function getAvatarColor(userId) {
  const palette = [
    '#5865f2', // discord blurple
    '#57f287', // green
    '#fee75c', // yellow
    '#eb459e', // fuchsia
    '#ed4245', // red
    '#3ba55c', // dark green
    '#faa81a', // orange
    '#9b59b6', // purple
    '#1abc9c', // teal
    '#e91e63', // pink
  ];

  if (!userId) return palette[0];

  let hash = 0;
  const str = String(userId);
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0; // Convert to 32-bit int
  }

  const index = Math.abs(hash) % palette.length;
  return palette[index];
}

/**
 * Join class names, filtering out any falsy values.
 */
export function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}
