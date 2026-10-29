import React, { useState } from 'react';
import { Trophy, Crown, Calendar, RefreshCw, ChevronRight, CheckCircle2, User, Award, ShieldAlert } from 'lucide-react';
import { useCourtly } from '../context';
import { Button } from './UI';
import { labels, slotLabel } from '../utils/format';
import './TournamentFlowchart.css';

export default function TournamentFlowchart({ tournament, registrations = [], matches = [], courts = [], staff = [], onSchedule }) {
  const { mutate, notify } = useCourtly();
  const [winnerDialog, setWinnerDialog] = useState(null); // { match, reg, teamName }
  const [score, setScore] = useState('6-4, 6-3');
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Group matches by round number
  const roundNumbers = [...new Set(matches.map(m => m.round))].sort((a, b) => a - b);
  const totalRounds = roundNumbers.length;

  // Helper to find registration by id
  const getReg = id => registrations.find(r => r.id === id);
  const getRegName = id => getReg(id)?.name || null;

  // Final match
  const finalMatch = matches.find(m => m.round === totalRounds && m.index === 0);
  const championReg = finalMatch?.winner ? getReg(finalMatch.winner) : null;

  // Submit winner result
  const handleConfirmWinner = async () => {
    if (!winnerDialog || busy) return;
    setBusy(true);
    try {
      await mutate(`/matches/${winnerDialog.match.id}/result`, {
        winnerId: winnerDialog.reg.id,
        score: score.trim() || 'Thắng'
      });
      notify(`🏆 ${winnerDialog.teamName} đã thắng và tiến vào nhánh tiếp theo!`);
      setWinnerDialog(null);
    } catch (e) {
      alert(e.message || 'Không thể cập nhật kết quả trận');
    } finally {
      setBusy(false);
    }
  };

  // Reset draw confirmation
  const handleResetDraw = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy nhánh đấu hiện tại để bốc thăm lại từ đầu?')) return;
    setResetting(true);
    try {
      await mutate(`/tournaments/${tournament.id}/draw`, {}, 'DELETE');
      notify('Đã hủy nhánh đấu. Bạn có thể tiến hành bốc thăm lại.');
    } catch (e) {
      alert(e.message || 'Không thể hủy nhánh đấu');
    } finally {
      setResetting(false);
    }
  };

  if (!matches.length) {
    return (
      <div className="tf-container" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <Trophy size={42} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
        <h4 style={{ margin: '0 0 8px', color: '#173c32', fontSize: 16 }}>Chưa có nhánh đấu</h4>
        <p style={{ color: '#64748b', fontSize: 13, maxWidth: 440, margin: '0 auto 16px' }}>
          Giải đấu đang mở đăng ký ({registrations.length}/{tournament.max} đã đăng ký). Hãy xác nhận đủ 2, 4, 8, hoặc 16 người/đội rồi nhấn "Bốc thăm nhánh đấu" để tạo sơ đồ thi đấu.
        </p>
      </div>
    );
  }

  return (
    <div className="tf-container">
      {/* Top action header */}
      <div className="tf-header">
        <div className="tf-header-title">
          <Trophy size={20} color="#173c32" />
          <h3>Sơ đồ nhánh đấu loại trực tiếp (Flowchart)</h3>
          <span style={{ fontSize: 12, color: '#52655a', background: '#eaf1ed', padding: '3px 9px', borderRadius: 6, fontWeight: 600 }}>
            {labels[tournament.format] || tournament.format} • {totalRounds} Vòng đấu
          </span>
        </div>

        <div className="tf-header-actions">
          <Button
            className="sm danger"
            onClick={handleResetDraw}
            disabled={resetting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
          >
            <RefreshCw size={14} className={resetting ? 'spin' : ''} />
            {resetting ? 'Đang hủy...' : 'Hủy & Bốc thăm lại'}
          </Button>
        </div>
      </div>

      {/* Guide Banner */}
      <div style={{
        background: '#ecfdf5',
        border: '1px solid #a7f3d0',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 12.5,
        color: '#065f46',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 20
      }}>
        <Crown size={18} color="#059669" style={{ flexShrink: 0 }} />
        <span>
          <strong>Hướng dẫn Admin:</strong> Nhấn nút <strong>[ 👑 Chọn thắng ]</strong> ở đội nào thì đội đó sẽ lập tức chiến thắng và tự động nối nhánh tiến lên vòng tiếp theo để gặp đội thắng ở nhánh đối diện!
        </span>
      </div>

      {/* Bracket Tree Flowchart */}
      <div className="tf-bracket-tree">
        {roundNumbers.map((roundNum, rIdx) => {
          const roundMatches = matches.filter(m => m.round === roundNum).sort((a, b) => a.index - b.index);
          const roundName = roundMatches[0]?.roundName || `Vòng ${roundNum}`;
          const isNextRound = rIdx < roundNumbers.length - 1;

          return (
            <React.Fragment key={roundNum}>
              {/* Round Column */}
              <div className="tf-round-column">
                <div className="tf-round-header">
                  <div className="tf-round-title">{roundName}</div>
                  <div className="tf-round-subtitle">
                    {roundMatches.length} trận đấu {roundMatches.every(m => m.status === 'FINISHED') ? '• Đã hoàn thành' : ''}
                  </div>
                </div>

                <div className="tf-matches-list">
                  {roundMatches.map(m => {
                    const reg1 = getReg(m.reg1);
                    const reg2 = getReg(m.reg2);
                    const isFinished = m.status === 'FINISHED';
                    const isReady = reg1 && reg2 && !isFinished;
                    const court = m.slots?.length ? courts.find(c => c.id === m.slots[0].court) : null;

                    return (
                      <div className={`tf-match-node ${isFinished ? 'finished' : ''}`} key={m.id}>
                        {/* Match Bar */}
                        <div className="tf-match-topbar">
                          <span>Trận #{m.index + 1} {m.roundName ? `(${m.roundName})` : ''}</span>
                          <span className={`tf-badge ${isFinished ? 'completed' : isReady ? 'ready' : 'scheduled'}`}>
                            {isFinished ? 'Đã xong' : isReady ? 'Sẵn sàng đấu' : 'Chờ nhánh'}
                          </span>
                        </div>

                        {/* Team 1 Row */}
                        <div className={`tf-team-row team-top ${!reg1 ? 'empty' : ''} ${m.winner === m.reg1 ? 'winner' : isFinished ? 'loser' : ''}`}>
                          <div className="tf-team-info">
                            <span className="tf-team-seed">1</span>
                            <span className="tf-team-name" title={reg1?.name || 'Chờ người thắng vòng trước'}>
                              {reg1?.name || 'Chờ nhánh trước…'}
                            </span>
                          </div>

                          {m.winner === m.reg1 ? (
                            <span className="tf-winner-pill">
                              <Crown size={12} /> THẮNG {m.score ? `(${m.score})` : ''}
                            </span>
                          ) : isReady ? (
                            <button
                              type="button"
                              className="tf-btn-win"
                              onClick={() => {
                                setWinnerDialog({ match: m, reg: reg1, teamName: reg1.name });
                                setScore('6-4, 6-3');
                              }}
                              title="Chọn đội này thắng để tiến vào vòng tiếp theo"
                            >
                              <Crown size={12} /> Chọn thắng
                            </button>
                          ) : null}
                        </div>

                        {/* Team 2 Row */}
                        <div className={`tf-team-row ${!reg2 ? 'empty' : ''} ${m.winner === m.reg2 ? 'winner' : isFinished ? 'loser' : ''}`}>
                          <div className="tf-team-info">
                            <span className="tf-team-seed">2</span>
                            <span className="tf-team-name" title={reg2?.name || 'Chờ người thắng vòng trước'}>
                              {reg2?.name || 'Chờ nhánh trước…'}
                            </span>
                          </div>

                          {m.winner === m.reg2 ? (
                            <span className="tf-winner-pill">
                              <Crown size={12} /> THẮNG {m.score ? `(${m.score})` : ''}
                            </span>
                          ) : isReady ? (
                            <button
                              type="button"
                              className="tf-btn-win"
                              onClick={() => {
                                setWinnerDialog({ match: m, reg: reg2, teamName: reg2.name });
                                setScore('6-4, 6-3');
                              }}
                              title="Chọn đội này thắng để tiến vào vòng tiếp theo"
                            >
                              <Crown size={12} /> Chọn thắng
                            </button>
                          ) : null}
                        </div>

                        {/* Match Footer */}
                        <div className="tf-match-footer">
                          <span>
                            {m.date ? `${m.date} ${court ? `• ${court.name}` : ''}` : 'Chưa xếp sân'}
                          </span>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {isFinished && isReady && (
                              <button
                                type="button"
                                onClick={() => {
                                  const alternate = m.winner === m.reg1 ? reg2 : reg1;
                                  setWinnerDialog({ match: m, reg: alternate, teamName: alternate.name });
                                  setScore(m.score || '6-4, 6-3');
                                }}
                                title="Đổi kết quả sang đội đối diện"
                              >
                                Đổi kết quả
                              </button>
                            )}
                            {onSchedule && (
                              <button type="button" onClick={() => onSchedule(m)}>
                                📅 {court ? 'Đổi sân' : 'Xếp sân'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Connecting Flowchart Fork Column */}
              {isNextRound && (
                <div className="tf-connector-col">
                  {Array.from({ length: roundMatches.length / 2 }).map((_, pairIdx) => {
                    const topMatch = roundMatches[pairIdx * 2];
                    const bottomMatch = roundMatches[pairIdx * 2 + 1];
                    const topWon = topMatch?.status === 'FINISHED' && topMatch?.winner;
                    const bottomWon = bottomMatch?.status === 'FINISHED' && bottomMatch?.winner;

                    return (
                      <div className="tf-connector-pair" key={pairIdx}>
                        <svg className="tf-connector-svg" viewBox="0 0 44 120" preserveAspectRatio="none">
                          {/* Top branch line */}
                          <path
                            d="M 0,30 L 22,30 L 22,60"
                            fill="none"
                            stroke={topWon ? '#10b981' : '#cbd5e1'}
                            strokeWidth={topWon ? 2.5 : 1.5}
                          />
                          {/* Bottom branch line */}
                          <path
                            d="M 0,90 L 22,90 L 22,60"
                            fill="none"
                            stroke={bottomWon ? '#10b981' : '#cbd5e1'}
                            strokeWidth={bottomWon ? 2.5 : 1.5}
                          />
                          {/* Exit line to next round */}
                          <path
                            d="M 22,60 L 40,60"
                            fill="none"
                            stroke={topWon || bottomWon ? '#10b981' : '#cbd5e1'}
                            strokeWidth={topWon || bottomWon ? 2.5 : 1.5}
                          />
                          {/* Arrow Head */}
                          <polygon
                            points="38,56 44,60 38,64"
                            fill={topWon || bottomWon ? '#10b981' : '#cbd5e1'}
                          />
                        </svg>
                      </div>
                    );
                  })}
                </div>
              )}
            </React.Fragment>
          );
        })}

        {/* Final to Champion Connector & Podium */}
        <div className="tf-connector-col" style={{ width: 36 }}>
          <svg className="tf-connector-svg" viewBox="0 0 36 120" preserveAspectRatio="none">
            <path
              d="M 0,60 L 32,60"
              fill="none"
              stroke={championReg ? '#f59e0b' : '#cbd5e1'}
              strokeWidth={championReg ? 3 : 1.5}
            />
            <polygon
              points="30,55 36,60 30,65"
              fill={championReg ? '#f59e0b' : '#cbd5e1'}
            />
          </svg>
        </div>

        {/* Champion Podium Card */}
        <div className="tf-champion-col">
          <div className="tf-champion-card" style={{ opacity: championReg ? 1 : 0.65 }}>
            <div className="tf-trophy-icon">🏆</div>
            <div className="tf-champion-title">QUÁN QUÂN GIẢI ĐẤU</div>
            <div className="tf-champion-name">
              {championReg ? championReg.name : 'Đang chờ trận Chung kết'}
            </div>
            {championReg && (
              <div style={{
                fontSize: 11.5,
                background: '#fef08a',
                color: '#854d0e',
                fontWeight: 750,
                padding: '4px 12px',
                borderRadius: 20,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5
              }}>
                <Award size={14} /> VÔ ĐỊCH TOURNAMENT
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Winner */}
      {winnerDialog && (
        <div
          className="modal-backdrop"
          onMouseDown={e => e.target === e.currentTarget && !busy && setWinnerDialog(null)}
          style={{ zIndex: 120 }}
        >
          <div
            className="modal"
            style={{ maxWidth: 460, borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
          >
            <div className="modal-header" style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Crown size={20} color="#15803d" />
                <h3 style={{ margin: 0, fontSize: 17, color: '#14532d', fontWeight: 700 }}>
                  Xác nhận đội chiến thắng
                </h3>
              </div>
              <button className="close" onClick={() => !busy && setWinnerDialog(null)}>✕</button>
            </div>

            <div className="modal-body" style={{ padding: '22px 24px' }}>
              <p style={{ margin: '0 0 16px', fontSize: 14, color: '#334155' }}>
                Đội <strong style={{ color: '#15803d', fontSize: 15 }}>{winnerDialog.teamName}</strong> sẽ giành chiến thắng ở <strong>{winnerDialog.match.roundName || `Trận #${winnerDialog.match.index + 1}`}</strong> và được nối trực tiếp vào vòng sau!
              </p>

              <label style={{ display: 'grid', gap: 7, fontSize: 13, fontWeight: 600, color: '#173c32', marginBottom: 16 }}>
                Tỉ số trận đấu (tùy chọn)
                <input
                  type="text"
                  value={score}
                  onChange={e => setScore(e.target.value)}
                  placeholder="Ví dụ: 6-4, 6-3 hoặc Thắng"
                  style={{
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #cbd5e1',
                    fontSize: 14
                  }}
                />
              </label>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {['6-4, 6-3', '6-2, 6-1', '7-6, 6-4', '6-0, 6-0', 'Thắng'].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setScore(preset)}
                    style={{
                      background: score === preset ? '#dcfce7' : '#f1f5f9',
                      border: `1px solid ${score === preset ? '#10b981' : '#cbd5e1'}`,
                      color: score === preset ? '#047857' : '#475569',
                      borderRadius: 6,
                      padding: '4px 9px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '14px 24px', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setWinnerDialog(null)}
                disabled={busy}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={handleConfirmWinner}
                disabled={busy}
                style={{ background: '#15803d', borderColor: '#15803d', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Crown size={15} />
                {busy ? 'Đang cập nhật…' : 'Xác nhận & Tiến vào vòng sau'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
