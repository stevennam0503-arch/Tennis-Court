import React, { useState } from 'react';

export default function NoticeBar({ notices = [], t = (x) => x }) {
  const [expanded, setExpanded] = useState(false);

  const activeNotices = notices.filter(Boolean);
  if (!activeNotices.length) return null;

  const primary = activeNotices[0];
  const othersCount = activeNotices.length - 1;

  return (
    <div className="gx-notice-bar-container" style={{ position: 'relative', zIndex: 85, width: '100%' }}>
      {/* Primary single-line notice bar */}
      <aside
        className={`gx-notice-bar gx-notice-${primary.key}`}
        style={{
          background: primary.bg || 'linear-gradient(90deg, #173c32 0%, #1e4d40 100%)',
          color: '#ffffff',
          padding: '8px 20px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          minHeight: 48,
          maxHeight: 56,
          position: 'relative',
          borderBottom: primary.borderBottom || 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>{primary.icon}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap', overflow: 'hidden' }}>
            <strong style={{ color: primary.accent || '#def46a', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>
              {primary.title}
            </strong>
            {primary.badge && (
              <span
                style={{
                  background: primary.badgeBg || (primary.accent || '#def46a'),
                  color: primary.badgeColor || '#173c32',
                  fontSize: 10.5,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 10,
                  flexShrink: 0,
                  whiteSpace: 'nowrap'
                }}
              >
                {primary.badge}
              </span>
            )}
            <span
              style={{
                fontSize: 12.5,
                color: 'rgba(255,255,255,0.9)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '650px'
              }}
              title={typeof primary.desc === 'string' ? primary.desc : ''}
            >
              {primary.desc}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {primary.actions}

          {othersCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              style={{
                background: expanded ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.35)',
                padding: '5px 10px',
                borderRadius: 14,
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.15s ease'
              }}
              aria-expanded={expanded}
              aria-label={t('+N thông báo khác')}
            >
              {expanded ? t('Thu gọn') : `+${othersCount} ${t('thông báo khác')}`}
            </button>
          )}

          {primary.onDismiss && (
            <button
              type="button"
              onClick={primary.onDismiss}
              aria-label={t('Đóng thông báo')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.7)',
                fontSize: 18,
                cursor: 'pointer',
                padding: '4px 6px',
                lineHeight: 1
              }}
            >
              ✕
            </button>
          )}
        </div>
      </aside>

      {/* Expanded panel showing all notices */}
      {expanded && othersCount > 0 && (
        <div
          className="gx-notice-list-dropdown"
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderTop: 'none',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            maxHeight: '420px',
            overflowY: 'auto'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              {t('Tất cả thông báo')} ({activeNotices.length})
            </span>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              {t('Thu gọn')} ▲
            </button>
          </div>

          {activeNotices.map((n, idx) => (
            <div
              key={n.key || idx}
              style={{
                background: n.bg || '#173c32',
                color: '#ffffff',
                borderRadius: 8,
                padding: '10px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 20 }}>{n.icon}</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ color: n.accent || '#def46a', fontSize: 13, textTransform: 'uppercase' }}>
                      {n.title}
                    </strong>
                    {n.badge && (
                      <span
                        style={{
                          background: n.badgeBg || (n.accent || '#def46a'),
                          color: n.badgeColor || '#173c32',
                          fontSize: 10.5,
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: 8
                        }}
                      >
                        {n.badge}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.9)', display: 'block', marginTop: 2 }}>
                    {n.desc}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {n.actions}
                {n.onDismiss && (
                  <button
                    type="button"
                    onClick={() => {
                      n.onDismiss();
                      if (activeNotices.length <= 2) setExpanded(false);
                    }}
                    aria-label={t('Đóng thông báo')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'rgba(255,255,255,0.7)',
                      fontSize: 16,
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
