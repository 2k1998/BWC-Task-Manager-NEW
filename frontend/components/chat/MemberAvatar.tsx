'use client';

interface MemberAvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function MemberAvatar({ name, photoUrl, size = 28 }: MemberAvatarProps) {
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.4)) };
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        style={style}
        className="rounded-full object-cover border border-gray-200 shrink-0"
      />
    );
  }
  return (
    <span
      style={style}
      className="rounded-full bg-[#D1AE62]/25 text-[#342C19] font-semibold flex items-center justify-center shrink-0"
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
