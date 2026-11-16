import React, { useState } from 'react';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-7 h-7 text-[11px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
};

const BG_PALETTE = [
  'bg-[#1B2A41] text-white',
  'bg-[#2CA69A] text-white',
  'bg-[#F47735] text-white',
  'bg-[#263A57] text-[#F5F1E8]',
];

function getInitials(name: string): string {
  const parts = (name || 'U').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getTone(name: string): string {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return BG_PALETTE[sum % BG_PALETTE.length];
}

export const Avatar: React.FC<AvatarProps> = ({ name, src, size = 'md', className = '' }) => {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={`${name} avatar`}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${SIZE_MAP[size]} rounded-full object-cover shrink-0 border border-[#1B2A41]/10 bg-[#EAE2D0] ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={`${name} initials`}
      className={`${SIZE_MAP[size]} ${getTone(name)} rounded-full flex items-center justify-center font-display font-semibold shrink-0 select-none ${className}`}
    >
      {getInitials(name)}
    </div>
  );
};
