import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Crown, Award, Gift, Sparkles, Search, Filter, 
  Clock, ShieldCheck, ArrowUpRight, Plus, Minus, History, CheckCircle2, AlertCircle
} from 'lucide-react';
import { useCourtly } from '../context';
import { api } from '../services/api';
import { Title, Button, Modal, Chip } from '../components/UI';
import { money } from '../utils/format';

const TIER_META = {
  ROOKIE: { label: 'Rookie', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1', icon: '🎾' },
  CHALLENGER: { label: 'Challenger', color: '#0284c7', bg: '#e0f2fe', border: '#7dd3fc', icon: '⭐' },
  MASTERS: { label: 'Masters', color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd', icon: '🏆' },
  GRAND_SLAM: { label: 'Grand Slam', color: '#b45309', bg: '#fef3c7', border: '#fcd34d', icon: '👑' }
};

export default function LoyaltyAdminPage() {
  const { user, isAdmin, notify } = useCourtly();
  const [tab, setTab] = useState('members'); // 'members' | 'lounge' | 'policy'
  const [tierFilter, setTierFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Data state
  const [members, setMembers] = useState([]);
  const [loungeVisits, setLoungeVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Adjust points modal state
  const [adjustingMember, setAdjustingMember] = useState(null);
  const [adjustPoints, setAdjustPoints] = useState(100);
  const [adjustType, setAdjustType] = useState('ADD'); // 'ADD' | 'SUBTRACT'
  const [adjustReason, setAdjustReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const data = await api('/admin/loyalty/members');
      if (data) setMembers(data);
    } catch (err) {
      console.error('Lỗi tải danh sách thành viên:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLoungeVisits = async () => {
    try {
      const data = await api('/admin/loyalty/lounge-visits');
      if (data) setLoungeVisits(data);
    } catch (err) {
      console.error('Lỗi tải lịch sử phòng chờ:', err);
    }
  };

  useEffect(() => {
    fetchMembers();
    fetchLoungeVisits();
  }, []);

  const handleAdjustPointsSubmit = async (e) => {
    e.preventDefault();
    if (!adjustingMember) return;
    if (!adjustReason.trim()) {
      alert('Vui lòng nhập lý do điều chỉnh điểm bắt buộc');
      return;
    }
    const pts = Math.abs(parseInt(adjustPoints, 10)) * (adjustType === 'SUBTRACT' ? -1 : 1);
    if (!pts) return;

    try {
      setSubmitting(true);
      await api('/admin/loyalty/adjust-points', 'POST', {
        accountId: adjustingMember.id,
        points: pts,
        reason: adjustReason.trim()
      });
      notify(`Đã ${pts > 0 ? 'cộng' : 'trừ'} ${Math.abs(pts)} điểm cho ${adjustingMember.name}`);
      setAdjustingMember(null);
      setAdjustReason('');
      setAdjustPoints(100);
      fetchMembers();
    } catch (err) {
      notify(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      if (tierFilter !== 'ALL' && (m.tier || 'ROOKIE') !== tierFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = m.name && m.name.toLowerCase().includes(q);
        const matchEmail = m.email && m.email.toLowerCase().includes(q);
        const matchPhone = m.phone && m.phone.includes(q);
        const matchRef = m.referralCode && m.referralCode.toLowerCase().includes(q);
        return matchName || matchEmail || matchPhone || matchRef;
      }
      return true;
    });
  }, [members, tierFilter, searchQuery]);

  const stats = useMemo(() => {
    const counts = { ROOKIE: 0, CHALLENGER: 0, MASTERS: 0, GRAND_SLAM: 0 };
    members.forEach(m => {
      const t = m.tier || 'ROOKIE';
      if (counts[t] !== undefined) counts[t]++;
    });
    return counts;
  }, [members]);

  return (
    <div className="page loyalty-admin-page" style={{ padding: '24px 28px', maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title>Thành viên & Điểm thưởng</Title>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13.5 }}>
            Quản lý 4 hạng thành viên Courtly, quỹ điểm thưởng, đãi ngộ và quyền truy cập VIP Lounge
          </p>
        </div>
      </div>

      {/* TIER STATS BAR */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
        {Object.entries(TIER_META).map(([key, meta]) => (
          <div 
            key={key} 
            onClick={() => setTierFilter(tierFilter === key ? 'ALL' : key)}
            style={{ 
              background: '#fff', 
              padding: '14px 18px', 
              borderRadius: 12, 
              border: `1.5px solid ${tierFilter === key ? meta.color : '#e2e8f0'}`,
              boxShadow: tierFilter === key ? `0 4px 12px ${meta.bg}` : '0 1px 3px rgba(0,0,0,0.03)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: meta.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{meta.icon}</span> {meta.label}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>
                {tierFilter === key ? 'Đang lọc' : 'Lọc'}
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', marginTop: 8 }}>
              {stats[key] || 0} <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>thành viên</span>
            </div>
          </div>
        ))}
      </div>

      {/* NAVIGATION TABS */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setTab('members')}
          style={{
            padding: '10px 18px',
            fontSize: 14,
            fontWeight: tab === 'members' ? 700 : 500,
            color: tab === 'members' ? '#0f172a' : '#64748b',
            borderBottom: tab === 'members' ? '2.5px solid #0f172a' : '2.5px solid transparent',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Users size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
          Danh sách thành viên ({filteredMembers.length})
        </button>

        <button
          type="button"
          onClick={() => setTab('lounge')}
          style={{
            padding: '10px 18px',
            fontSize: 14,
            fontWeight: tab === 'lounge' ? 700 : 500,
            color: tab === 'lounge' ? '#b45309' : '#64748b',
            borderBottom: tab === 'lounge' ? '2.5px solid #f59e0b' : '2.5px solid transparent',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Crown size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
          Lượt vào VIP Lounge ({loungeVisits.length})
        </button>

        <button
          type="button"
          onClick={() => setTab('policy')}
          style={{
            padding: '10px 18px',
            fontSize: 14,
            fontWeight: tab === 'policy' ? 700 : 500,
            color: tab === 'policy' ? '#0f172a' : '#64748b',
            borderBottom: tab === 'policy' ? '2.5px solid #0f172a' : '2.5px solid transparent',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Award size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
          Chính sách 4 Hạng & Đổi thưởng
        </button>
      </div>

      {/* TAB 1: MEMBERS LIST */}
      {tab === 'members' && (
        <div>
          {/* SEARCH & FILTER BAR */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Tìm theo tên, số điện thoại, email hoặc mã giới thiệu..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 13.5
                }}
              />
            </div>
            {tierFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setTierFilter('ALL')}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Xóa lọc ({tierFilter}) ✕
              </button>
            )}
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: 12, textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Thành viên</th>
                  <th style={{ padding: '12px 16px' }}>Hạng hiện tại</th>
                  <th style={{ padding: '12px 16px' }}>Chi tiêu 12T</th>
                  <th style={{ padding: '12px 16px' }}>Điểm thưởng</th>
                  <th style={{ padding: '12px 16px' }}>Ngày sinh</th>
                  <th style={{ padding: '12px 16px' }}>Mã GT</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                      Không tìm thấy thành viên nào phù hợp bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map(m => {
                    const meta = TIER_META[m.tier || 'ROOKIE'] || TIER_META.ROOKIE;
                    return (
                      <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>{m.name || 'Chưa đặt tên'}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            {m.phone ? `📱 ${m.phone}` : ''} {m.email ? `• ✉️ ${m.email}` : ''}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: 4, 
                            padding: '3px 9px', 
                            borderRadius: 12, 
                            fontSize: 12, 
                            fontWeight: 700, 
                            background: meta.bg, 
                            color: meta.color,
                            border: `1px solid ${meta.border}`
                          }}>
                            <span>{meta.icon}</span> {meta.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                          {money(m.lifetimeSpend || 0)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontWeight: 800, color: '#2563eb', fontSize: 14 }}>
                            {m.pointsBalance || 0}
                          </span>
                          <span style={{ fontSize: 11.5, color: '#64748b', marginLeft: 4 }}>điểm</span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569', fontSize: 12.5 }}>
                          {m.birthDate ? new Date(m.birthDate).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {m.referralCode ? (
                            <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 11.5, fontWeight: 700, color: '#475569' }}>
                              {m.referralCode}
                            </code>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {isAdmin ? (
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustingMember(m);
                                setAdjustReason('');
                                setAdjustPoints(100);
                              }}
                              style={{
                                padding: '5px 10px',
                                borderRadius: 6,
                                border: '1px solid #cbd5e1',
                                background: '#fff',
                                color: '#1e293b',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              Điều chỉnh điểm
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>Chỉ xem</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: VIP LOUNGE VISITS */}
      {tab === 'lounge' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#fdfbf7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>👑</span> Nhật ký check-in Phòng chờ VIP (VIP Lounge)
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#78350f' }}>
                Đặc quyền dành riêng cho thành viên hạng Grand Slam. Lễ tân quét mã thẻ VIP qua hộp Quét QR.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchLoungeVisits}
              style={{ background: '#fff', border: '1px solid #fde68a', color: '#92400e', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Làm mới
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: 12, textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Thời gian vào</th>
                <th style={{ padding: '12px 16px' }}>Mã thẻ VIP</th>
                <th style={{ padding: '12px 16px' }}>Khách hàng</th>
                <th style={{ padding: '12px 16px' }}>Số điện thoại</th>
                <th style={{ padding: '12px 16px' }}>Nhân sự ghi nhận</th>
              </tr>
            </thead>
            <tbody>
              {loungeVisits.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                    Chưa có lượt check-in phòng chờ VIP nào được ghi nhận.
                  </td>
                </tr>
              ) : (
                loungeVisits.map(v => (
                  <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                      {new Date(v.checkedInAt).toLocaleString('vi-VN')}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <code style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 12.5 }}>
                        {v.cardCode}
                      </code>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#173c32' }}>
                      {v.customerName}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>
                      {v.customerPhone || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 12.5 }}>
                      {v.staffName || 'Lễ tân Courtly'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: TIERS POLICY & REWARDS CATALOGUE */}
      {tab === 'policy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* 4 TIERS MATRIX */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
              Quy chế 4 Hạng thành viên Courtly
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '10px 14px' }}>Hạng</th>
                    <th style={{ padding: '10px 14px' }}>Chi tiêu 12T</th>
                    <th style={{ padding: '10px 14px' }}>Giảm tiền sân</th>
                    <th style={{ padding: '10px 14px' }}>Hệ số điểm</th>
                    <th style={{ padding: '10px 14px' }}>Đặt trước</th>
                    <th style={{ padding: '10px 14px' }}>Đổi lịch free/tháng</th>
                    <th style={{ padding: '10px 14px' }}>Quà khi lên hạng</th>
                    <th style={{ padding: '10px 14px' }}>Voucher sinh nhật</th>
                    <th style={{ padding: '10px 14px' }}>Đặc quyền khác</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#64748b' }}>🎾 Rookie</td>
                    <td style={{ padding: '12px 14px' }}>0₫</td>
                    <td style={{ padding: '12px 14px' }}>0%</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700 }}>×1,0</td>
                    <td style={{ padding: '12px 14px' }}>7 ngày</td>
                    <td style={{ padding: '12px 14px' }}>0</td>
                    <td style={{ padding: '12px 14px' }}>Voucher chào mừng 50k</td>
                    <td style={{ padding: '12px 14px' }}>30.000₫</td>
                    <td style={{ padding: '12px 14px', color: '#94a3b8' }}>—</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#f0f9ff' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0284c7' }}>⭐ Challenger</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>3.000.000₫</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0284c7' }}>−3%</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700 }}>×1,2</td>
                    <td style={{ padding: '12px 14px' }}>10 ngày</td>
                    <td style={{ padding: '12px 14px' }}>1 lượt</td>
                    <td style={{ padding: '12px 14px' }}>200 điểm thưởng</td>
                    <td style={{ padding: '12px 14px' }}>60.000₫</td>
                    <td style={{ padding: '12px 14px', color: '#94a3b8' }}>—</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#faf5ff' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#7c3aed' }}>🏆 Masters</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>8.000.000₫</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#7c3aed' }}>−5%</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700 }}>×1,5</td>
                    <td style={{ padding: '12px 14px' }}>14 ngày</td>
                    <td style={{ padding: '12px 14px' }}>2 lượt</td>
                    <td style={{ padding: '12px 14px' }}>500 điểm thưởng</td>
                    <td style={{ padding: '12px 14px' }}>120.000₫</td>
                    <td style={{ padding: '12px 14px' }}>Đăng ký giải sớm 3 ngày</td>
                  </tr>
                  <tr style={{ background: '#fefce8' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#b45309' }}>👑 Grand Slam</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700 }}>20.000.000₫</td>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#b45309' }}>−8%</td>
                    <td style={{ padding: '12px 14px', fontWeight: 800 }}>×2,0</td>
                    <td style={{ padding: '12px 14px' }}>21 ngày</td>
                    <td style={{ padding: '12px 14px' }}>4 lượt</td>
                    <td style={{ padding: '12px 14px' }}>1.000 điểm + Voucher 300.000₫ + Thẻ VIP Lounge</td>
                    <td style={{ padding: '12px 14px' }}>250.000₫</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#92400e' }}>Phòng chờ VIP Lounge · Hủy linh hoạt</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* REWARDS CATALOGUE */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
              Danh mục đổi thưởng bằng điểm (1 điểm = 100₫)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div style={{ padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  Trừ thẳng tiền sân khi đặt
                </div>
                <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 12 }}>
                  Tối thiểu 100 điểm, bội số của 10. Tối đa 50% tiền sân còn lại sau giảm hạng và voucher.
                </div>
                <div style={{ fontWeight: 800, color: '#2563eb', fontSize: 14 }}>
                  100 điểm = 10.000₫
                </div>
              </div>

              <div style={{ padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  Gia hạn sân 30 phút (giờ thường)
                </div>
                <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 12 }}>
                  Áp dụng trực tiếp tại sân khi khung giờ tiếp theo còn trống.
                </div>
                <div style={{ fontWeight: 800, color: '#2563eb', fontSize: 14 }}>
                  800 điểm
                </div>
              </div>

              <div style={{ padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  1 giờ sân giờ vàng (10:00–15:00)
                </div>
                <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 12 }}>
                  Khu vực sân ngoài trời các ngày trong tuần.
                </div>
                <div style={{ fontWeight: 800, color: '#2563eb', fontSize: 14 }}>
                  1.200 điểm
                </div>
              </div>

              <div style={{ padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  1 giờ dịch vụ trọng tài
                </div>
                <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 12 }}>
                  Áp dụng cho mọi trận đấu giao lưu hoặc giải nội bộ.
                </div>
                <div style={{ fontWeight: 800, color: '#2563eb', fontSize: 14 }}>
                  2.000 điểm
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADJUST POINTS MODAL (ADMIN ONLY) */}
      {adjustingMember && (
        <Modal onClose={() => setAdjustingMember(null)}>
          <form onSubmit={handleAdjustPointsSubmit} style={{ minWidth: 380, padding: 8 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>
              Điều chỉnh điểm: {adjustingMember.name}
            </h3>

            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              <div>Số dư điểm hiện tại: <b style={{ color: '#2563eb' }}>{adjustingMember.pointsBalance || 0} điểm</b></div>
              <div>Hạng thành viên: <b>{adjustingMember.tier || 'ROOKIE'}</b></div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Thao tác:</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setAdjustType('ADD')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: adjustType === 'ADD' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                    background: adjustType === 'ADD' ? '#f0fdf4' : '#fff',
                    color: adjustType === 'ADD' ? '#16a34a' : '#475569',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={14} style={{ display: 'inline', marginRight: 4 }} /> Cộng thêm điểm
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('SUBTRACT')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: adjustType === 'SUBTRACT' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                    background: adjustType === 'SUBTRACT' ? '#fef2f2' : '#fff',
                    color: adjustType === 'SUBTRACT' ? '#dc2626' : '#475569',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Minus size={14} style={{ display: 'inline', marginRight: 4 }} /> Khấu trừ bớt điểm
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Số điểm điều chỉnh:</label>
              <input
                type="number"
                min={1}
                step={10}
                required
                value={adjustPoints}
                onChange={e => setAdjustPoints(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 700 }}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Lý do điều chỉnh <span style={{ color: '#dc2626' }}>*</span>:
              </label>
              <textarea
                rows={3}
                required
                placeholder="Ghi rõ lý do (vd: Thưởng sự kiện khai xuân, Đền bù sự cố kỹ thuật...)"
                value={adjustReason}
                onChange={e => setAdjustReason(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button type="button" onClick={() => setAdjustingMember(null)} disabled={submitting}>
                Hủy
              </Button>
              <Button type="submit" className="primary" disabled={submitting || !adjustReason.trim()}>
                {submitting ? 'Đang lưu…' : 'Xác nhận điều chỉnh'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
