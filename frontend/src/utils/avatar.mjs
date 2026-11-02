import { useState, useEffect } from 'react';

export const AVATAR_PRESETS = [
  { id: 'tennis', label: 'Bóng Tennis', icon: '🎾' },
  { id: 'trophy', label: 'Cúp vô địch', icon: '🏆' },
  { id: 'cap', label: 'Mũ thi đấu', icon: '🧢' },
  { id: 'lightning', label: 'Cú Ace sấm sét', icon: '⚡' },
  { id: 'lion', label: 'Bản lĩnh sân đấu', icon: '🦁' },
  { id: 'star', label: 'Ngôi sao sân quần', icon: '🌟' },
  { id: 'target', label: 'Bách phát bách trúng', icon: '🎯' },
  { id: 'fire', label: 'Nhiệt huyết thi đấu', icon: '🔥' }
];

export function getStoredAvatar(userId) {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const key = 'courtly_avatar_' + (userId || 'me');
  return window.localStorage.getItem(key) || null;
}

export function saveStoredAvatar(userId, avatarValue) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const key = 'courtly_avatar_' + (userId || 'me');
  if (avatarValue) {
    window.localStorage.setItem(key, avatarValue);
  } else {
    window.localStorage.removeItem(key);
  }
  try {
    window.dispatchEvent(
      new CustomEvent('courtly-avatar-changed', {
        detail: { userId: userId || 'me', avatar: avatarValue || null }
      })
    );
  } catch (e) {
    // Non-browser or SSR
  }
}

export function useUserAvatar(user) {
  const userId = user?.id || user?.accountId || user?.email || 'me';
  const [avatar, setAvatar] = useState(() => {
    return user?.avatarUrl || user?.avatar || getStoredAvatar(userId);
  });

  useEffect(() => {
    setAvatar(user?.avatarUrl || user?.avatar || getStoredAvatar(userId));
  }, [userId, user?.avatarUrl, user?.avatar]);

  useEffect(() => {
    const handleAvatarChange = (e) => {
      const targetId = e.detail?.userId;
      if (!targetId || targetId === userId || targetId === 'me') {
        setAvatar(e.detail?.avatar || null);
      }
    };
    const handleStorage = (e) => {
      if (e.key === 'courtly_avatar_' + userId || e.key === 'courtly_avatar_me') {
        setAvatar(e.newValue || null);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('courtly-avatar-changed', handleAvatarChange);
      window.addEventListener('storage', handleStorage);
      return () => {
        window.removeEventListener('courtly-avatar-changed', handleAvatarChange);
        window.removeEventListener('storage', handleStorage);
      };
    }
  }, [userId]);

  return avatar;
}

export function resizeImageFile(file, maxWidth = 256, maxHeight = 256, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WebP)'));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Tệp ảnh bị lỗi hoặc không hỗ trợ'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
