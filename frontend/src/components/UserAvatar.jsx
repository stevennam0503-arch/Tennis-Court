import React, { useState } from 'react';
import { useUserAvatar } from '../utils/avatar.mjs';

export function UserAvatar({
  user,
  avatar: explicitAvatar,
  size = 34,
  dark = false,
  className = '',
  style = {},
  alt = ''
}) {
  const dynamicAvatar = useUserAvatar(user);
  const avatar = explicitAvatar !== undefined ? explicitAvatar : dynamicAvatar;
  const [imageError, setImageError] = useState(false);

  const name = user?.name || user?.fullName || 'Người dùng';
  const initial = (name.trim().charAt(0) || 'U').toUpperCase();

  const isImage =
    !imageError &&
    avatar &&
    (avatar.startsWith('data:image/') ||
      avatar.startsWith('http://') ||
      avatar.startsWith('https://') ||
      avatar.startsWith('/'));

  if (isImage) {
    return (
      <img
        src={avatar}
        alt={alt || name}
        onError={() => setImageError(true)}
        className={`user-avatar-img ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          borderRadius: '50%',
          objectFit: 'cover',
          display: 'block',
          boxShadow: dark ? '0 0 0 1px rgba(255, 255, 255, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
          ...style
        }}
      />
    );
  }

  if (avatar && !isImage) {
    return (
      <div
        className={`user-avatar-preset ${className}`}
        title={alt || name}
        style={{
          width: size,
          height: size,
          minWidth: size,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          fontSize: Math.round(size * 0.52),
          lineHeight: 1,
          userSelect: 'none',
          background: dark ? 'rgba(255, 255, 255, 0.12)' : '#eef5f1',
          border: dark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #d0dfd6',
          ...style
        }}
      >
        <span>{avatar}</span>
      </div>
    );
  }

  return (
    <div
      className={`user-avatar-initial ${className}`}
      title={alt || name}
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 800,
        fontSize: Math.max(12, Math.round(size * 0.4)),
        lineHeight: 1,
        color: dark ? 'var(--lime, #def46a)' : '#173c32',
        background: dark ? '#2d5849' : '#e2ede6',
        flexShrink: 0,
        userSelect: 'none',
        ...style
      }}
    >
      {initial}
    </div>
  );
}

export default UserAvatar;
