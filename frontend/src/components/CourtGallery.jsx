import React from 'react';
import { MapPin, ArrowRight } from 'lucide-react';
import { Chip } from './UI';
import { money, labels } from '../utils/format';

export const courtImage = c => c.imageUrl || ({
  VIP: '/guest/zone-v-lounge.webp',
  INDOOR: '/guest/zone-b-indoor.webp',
  OUTDOOR: '/guest/zone-a-outdoor.webp'
})[c.type] || '/guest/zone-a-outdoor.webp';

export const courtDescription = c => c.description || ({
  VIP: 'Sân VIP cao cấp có khu vực lounge nghỉ ngơi riêng biệt và tiện nghi chuẩn thi đấu.',
  INDOOR: 'Sân trong nhà có mái che, hệ thống đèn chống lóa, thi đấu mọi điều kiện thời tiết.',
  OUTDOOR: 'Sân ngoài trời thoáng đãng, mặt sân tiêu chuẩn thi đấu quốc tế.'
})[c.type] || 'Sân tennis tiêu chuẩn thi đấu.';

export function CourtPhoto({ court }) {
  const fallback = ({
    VIP: '/guest/zone-v-lounge.webp',
    INDOOR: '/guest/zone-b-indoor.webp',
    OUTDOOR: '/guest/zone-a-outdoor.webp'
  })[court.type] || '/guest/zone-a-outdoor.webp';

  return (
    <figure className="court-photo">
      <img
        src={courtImage(court)}
        alt={`${court.name} · ${labels[court.type] || court.type}${!court.imageUrl || court.imageIsIllustration ? ' (ảnh minh họa)' : ''}`}
        loading="lazy"
        width="1200"
        height="800"
        onError={e => {
          if (!e.currentTarget.src.endsWith(fallback)) {
            e.currentTarget.src = fallback;
            const cap = e.currentTarget.closest('figure')?.querySelector('figcaption');
            if (cap) cap.textContent = 'Ảnh minh họa';
          }
        }}
      />
      <figcaption>{!court.imageUrl || court.imageIsIllustration ? 'Ảnh minh họa' : 'Ảnh sân do CLB cung cấp'}</figcaption>
    </figure>
  );
}

export default function CourtGallery({ courts, club = {}, onChoose }) {
  return (
    <div className="court-gallery">
      {courts.filter(c => c.status !== 'INACTIVE').map(c => (
        <article className="court-card" key={c.id}>
          <CourtPhoto court={c} />
          <div className="court-card-body">
            <div className="customer-order-top">
              <span className="section-kicker">{labels[c.type] || c.type}</span>
              <Chip status={c.status} />
            </div>
            <h3>{c.name}</h3>
            <p>{courtDescription(c)}</p>
            {c.amenities && <p className="court-amenities">{c.amenities}</p>}
            <p className="court-address">
              <MapPin size={16} />{c.address || club.address || 'Địa chỉ đang cập nhật'}
            </p>
            <div className="court-price">
              <span>Giá cơ bản <b>{money(c.price)}<small>/giờ</small></b></span>
              {c.status === 'ACTIVE' && (
                <button className="btn primary" onClick={() => onChoose(c.id)}>
                  Chọn sân <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
