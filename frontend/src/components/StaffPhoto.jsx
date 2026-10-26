import React from 'react';
import { labels } from '../utils/format';

export function getStaffPhoto(staff) {
  if (!staff) return '/images/staff/referee-default.svg';
  if (staff.imageUrl) return staff.imageUrl;
  const name = staff.name || staff.fullName || '';
  if (name.includes('Quỳnh Mai') || name.includes('Mai') || name.includes('Nữ')) {
    return '/images/staff/referee-7.svg';
  }
  if (name.includes('Vũ Thanh Bình') || name.includes('Bình')) {
    return '/images/staff/referee-1.svg';
  }
  if (name.includes('Đỗ Hoài An') || name.includes('Hoài An')) {
    return '/images/staff/referee-2.svg';
  }
  if (name.includes('Bùi Quang Minh') || name.includes('Quang Minh')) {
    return '/images/staff/referee-3.svg';
  }
  if (name.includes('Phạm Quốc Huy') || name.includes('Quốc Huy')) {
    return '/images/staff/referee-4.svg';
  }
  if (name.includes('Nguyễn Hoàng Long') || name.includes('Hoàng Long')) {
    return '/images/staff/referee-5.svg';
  }
  // Deterministic avatar assignment for any other personnel
  const key = (staff.id || name).toString();
  const sum = key.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const avatars = [
    '/images/staff/referee-1.svg',
    '/images/staff/referee-2.svg',
    '/images/staff/referee-3.svg',
    '/images/staff/referee-4.svg',
    '/images/staff/referee-5.svg',
    '/images/staff/referee-7.svg'
  ];
  return avatars[sum % avatars.length];
}

export function StaffPhoto({ staff, size = 64, showBadge = true, showCaption = false }) {
  if (!staff) return null;
  const photoSrc = getStaffPhoto(staff);
  const isIllustration = !staff.imageUrl || staff.imageIsIllustration !== false;

  return (
    <div className="staff-photo-container" style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size > 80 ? 16 : '50%',
          overflow: 'hidden',
          border: '2px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          background: '#f8fafc',
          position: 'relative'
        }}
      >
        <img
          src={photoSrc}
          alt={staff.name || 'Ảnh nhân sự'}
          width={size}
          height={size}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {showBadge && (
          <span
            title="Ảnh mô phỏng / minh họa nhân sự"
            style={{
              position: 'absolute',
              bottom: 2,
              right: 2,
              background: '#047857',
              color: '#ffffff',
              fontSize: 9,
              fontWeight: 700,
              padding: '1px 4px',
              borderRadius: 4,
              lineHeight: 1.2
            }}
          >
            VTF
          </span>
        )}
      </div>
      {showCaption && (
        <span style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
          {isIllustration ? 'Ảnh minh họa' : 'Ảnh xác thực'}
        </span>
      )}
    </div>
  );
}
