import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { Camera, Upload, Keyboard, CheckCircle2, AlertTriangle, Clock, RefreshCw, X, Sparkles, Volume2, ArrowRight } from 'lucide-react';
import { useCourtly } from '../context';
import { money, today } from '../utils/format';
import './AutoQRCheckInModal.css';

// Audio tone synthesizer for instant feedback
function playSuccessSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

function playWarningSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch {}
}

export default function AutoQRCheckInModal({ onClose }) {
  const { data, mutate, notify, show } = useCourtly();
  const [tab, setTab] = useState('camera'); // 'camera' | 'upload' | 'manual'
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState('environment'); // 'user' | 'environment'
  
  // Processing & result state
  const [processing, setProcessing] = useState(false);
  const [lastScannedResult, setLastScannedResult] = useState(null); // { order, type: 'SUCCESS' | 'HOLDING' | 'ALREADY' | 'COMPLETED' | 'NOT_FOUND', msg }
  const [manualCode, setManualCode] = useState('');
  const [autoResumeTimer, setAutoResumeTimer] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanningRef = useRef(true);

  // Helper to match order from decoded string
  const findMatchingOrder = useCallback((rawInput) => {
    if (!rawInput) return null;
    let target = String(rawInput).trim();
    try {
      const parsed = JSON.parse(target);
      if (parsed.orderId) target = parsed.orderId;
      else if (parsed.ticket) target = parsed.ticket;
    } catch {}

    const clean = target.toUpperCase().replace(/^#/, '');
    return data.orders.find(o => {
      const tCode = 'CT' + o.id.replace(/-/g, '').slice(0, 8).toUpperCase();
      const tCodeHyphen = 'CT-' + o.id.replace(/-/g, '').slice(0, 8).toUpperCase();
      const tCode6 = 'CT-' + o.id.replace(/-/g, '').slice(0, 6).toUpperCase();
      return (
        o.id === target ||
        o.id.startsWith(target) ||
        tCode === clean ||
        tCodeHyphen === clean ||
        tCode6 === clean ||
        o.phone === target ||
        (clean.length >= 6 && o.id.replace(/-/g, '').toUpperCase().includes(clean))
      );
    });
  }, [data.orders]);

  // Main automatic process for scanned QR payload
  const handleScannedPayload = useCallback(async (payload) => {
    if (processing || !payload) return;
    setProcessing(true);
    scanningRef.current = false;

    const order = findMatchingOrder(payload);
    if (!order) {
      playWarningSound();
      setLastScannedResult({
        type: 'NOT_FOUND',
        raw: payload,
        msg: `Không tìm thấy đơn hàng khớp với mã "${String(payload).slice(0, 24)}…"`
      });
      setProcessing(false);
      return;
    }

    // 1. Order is CONFIRMED -> AUTOMATIC CHECK-IN!
    if (order.status === 'CONFIRMED') {
      try {
        await mutate(`/orders/${order.id}/check-in`, {
          reason: 'Quét mã QR tự động tại quầy'
        });
        playSuccessSound();
        notify(`✅ Check-in thành công: ${order.name}`);
        setLastScannedResult({
          type: 'SUCCESS',
          order: { ...order, status: 'CHECKED_IN', checkInAt: new Date().toISOString() },
          msg: 'Khách đã check-in thành công và có thể vào sân ngay!'
        });
      } catch (err) {
        playWarningSound();
        setLastScannedResult({
          type: 'ERROR',
          order,
          msg: err.message || 'Lỗi khi thực hiện check-in đơn hàng'
        });
      } finally {
        setProcessing(false);
      }
      return;
    }

    // 2. Order is HOLDING -> Needs deposit payment
    if (order.status === 'HOLDING') {
      playWarningSound();
      setLastScannedResult({
        type: 'HOLDING',
        order,
        msg: `Đơn đang giữ chỗ và chưa đóng cọc. Cần thu cọc ${money(order.deposit)} trước khi check-in.`
      });
      setProcessing(false);
      return;
    }

    // 3. Order is ALREADY CHECKED_IN
    if (order.status === 'CHECKED_IN') {
      playWarningSound();
      setLastScannedResult({
        type: 'ALREADY',
        order,
        msg: `Khách này đã check-in vào sân lúc ${order.checkInAt ? new Date(order.checkInAt).toLocaleTimeString('vi-VN') : ''}.`
      });
      setProcessing(false);
      return;
    }

    // 4. Order is COMPLETED
    if (order.status === 'COMPLETED') {
      setLastScannedResult({
        type: 'COMPLETED',
        order,
        msg: 'Buổi chơi của đơn này đã hoàn tất trước đó.'
      });
      setProcessing(false);
      return;
    }

    // Other status
    setLastScannedResult({
      type: 'OTHER',
      order,
      msg: `Trạng thái đơn: ${order.status}`
    });
    setProcessing(false);
  }, [processing, findMatchingOrder, mutate, notify]);

  // Camera lifecycle & scanning frame loop
  useEffect(() => {
    if (tab !== 'camera' || lastScannedResult) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      setCameraActive(false);
      return;
    }

    scanningRef.current = true;
    let animId = null;

    async function startCamera() {
      setCameraError('');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 640 }, height: { ideal: 480 } }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
          setCameraActive(true);
          requestAnimationFrame(scanLoop);
        }
      } catch (err) {
        setCameraError(err.name === 'NotAllowedError' 
          ? 'Quyền truy cập Camera bị từ chối. Vui lòng cho phép quyền Camera trên trình duyệt hoặc dùng tính năng Tải ảnh QR / Nhập mã.'
          : 'Không thể kết nối với Camera thiết bị. Vui lòng kiểm tra lại thiết bị hoặc dùng Tải ảnh QR.');
      }
    }

    function scanLoop() {
      if (!scanningRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });
        if (code && code.data) {
          handleScannedPayload(code.data);
          return; // Stop loop when code found
        }
      }
      animId = requestAnimationFrame(scanLoop);
    }

    startCamera();

    return () => {
      scanningRef.current = false;
      if (animId) cancelAnimationFrame(animId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [tab, facingMode, lastScannedResult, handleScannedPayload]);

  // Handle image upload decode
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          handleScannedPayload(code.data);
        } else {
          playWarningSound();
          alert('Không tìm thấy mã QR nào trong hình ảnh tải lên. Vui lòng chọn ảnh chụp rõ nét hơn.');
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Reset scanner to scan next ticket
  const resumeScanning = () => {
    setLastScannedResult(null);
    setManualCode('');
    scanningRef.current = true;
  };

  // Sample orders for quick 1-click test in demo
  const sampleConfirmed = data.orders.find(o => o.status === 'CONFIRMED');
  const sampleCheckedIn = data.orders.find(o => o.status === 'CHECKED_IN');
  const sampleHolding = data.orders.find(o => o.status === 'HOLDING');

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="aqr-modal" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="aqr-header">
          <div>
            <h2>
              <Sparkles size={20} /> Check-in Tự Động Bằng Mã QR
            </h2>
            <div className="aqr-header-sub">
              Nhận diện camera theo thời gian thực & xác nhận khách vào sân tự động
            </div>
          </div>
          <button className="aqr-close" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        {!lastScannedResult && (
          <div className="aqr-tabs">
            <button
              type="button"
              className={`aqr-tab ${tab === 'camera' ? 'active' : ''}`}
              onClick={() => setTab('camera')}
            >
              <Camera size={16} /> Quét bằng Camera
            </button>
            <button
              type="button"
              className={`aqr-tab ${tab === 'upload' ? 'active' : ''}`}
              onClick={() => setTab('upload')}
            >
              <Upload size={16} /> Tải ảnh QR
            </button>
            <button
              type="button"
              className={`aqr-tab ${tab === 'manual' ? 'active' : ''}`}
              onClick={() => setTab('manual')}
            >
              <Keyboard size={16} /> Nhập mã / Máy quét
            </button>
          </div>
        )}

        <div className="aqr-body">
          {/* SUCCESS RESULT SCREEN */}
          {lastScannedResult ? (
            <div className={`aqr-result-view ${lastScannedResult.type}`}>
              {lastScannedResult.type === 'SUCCESS' && (
                <div className="aqr-success-card">
                  <div className="aqr-success-icon">
                    <CheckCircle2 size={36} />
                  </div>
                  <h3 className="aqr-success-title">CHECK-IN TỰ ĐỘNG THÀNH CÔNG!</h3>
                  <p style={{ margin: 0, color: '#166534', fontSize: 13.5 }}>
                    Hệ thống đã tự động xác thực vé và ghi nhận khách vào sân.
                  </p>

                  <div className="aqr-success-order-box">
                    <div className="aqr-info-row">
                      <span style={{ color: '#64748b' }}>Khách hàng:</span>
                      <strong style={{ fontSize: 15, color: '#173c32' }}>{lastScannedResult.order.name}</strong>
                    </div>
                    <div className="aqr-info-row">
                      <span style={{ color: '#64748b' }}>Số điện thoại:</span>
                      <b>{lastScannedResult.order.phone || 'Không có'}</b>
                    </div>
                    <div className="aqr-info-row">
                      <span style={{ color: '#64748b' }}>Lịch thi đấu:</span>
                      <b>
                        {lastScannedResult.order.date} • {lastScannedResult.order.slots?.map(s => `${data.courts.find(c => c.id === s.court)?.name || 'Sân'} (${s.hour}:00)`).join(', ')}
                      </b>
                    </div>
                    <div className="aqr-info-row">
                      <span style={{ color: '#64748b' }}>Mã vé điện tử:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#166534', background: '#dcfce7', padding: '2px 8px', borderRadius: 4 }}>
                        CT-{lastScannedResult.order.id.slice(0, 8).toUpperCase()}
                      </span>
                    </div>
                    <div className="aqr-info-row">
                      <span style={{ color: '#64748b' }}>Thời gian check-in:</span>
                      <span style={{ color: '#15803d', fontWeight: 700 }}>
                        {new Date(lastScannedResult.order.checkInAt).toLocaleTimeString('vi-VN')} (Vừa xong)
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <button
                      type="button"
                      className="btn primary"
                      onClick={resumeScanning}
                      style={{ padding: '10px 22px', fontSize: 14, fontWeight: 700 }}
                    >
                      <Camera size={16} /> Quét lượt tiếp theo
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => { onClose(); show({ type: 'order', id: lastScannedResult.order.id }); }}
                    >
                      Xem chi tiết đơn
                    </button>
                  </div>
                </div>
              )}

              {lastScannedResult.type === 'HOLDING' && (
                <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 22, textAlign: 'center' }}>
                  <AlertTriangle size={42} color="#d97706" style={{ margin: '0 auto 10px' }} />
                  <h3 style={{ margin: '0 0 6px', fontSize: 18, color: '#92400e' }}>ĐƠN HÀNG CHƯA ĐÓNG CỌC</h3>
                  <p style={{ margin: '0 0 16px', color: '#78350f', fontSize: 14 }}>
                    Đơn <strong>{lastScannedResult.order.name}</strong> đang giữ chỗ. Lễ tân cần thu cọc <strong>{money(lastScannedResult.order.deposit)}</strong> trước khi check-in cho khách vào sân.
                  </p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <button
                      type="button"
                      className="btn lime"
                      onClick={() => { onClose(); show({ type: 'payment', id: lastScannedResult.order.id }); }}
                    >
                      💵 Thu tiền cọc tại quầy ({money(lastScannedResult.order.deposit)})
                    </button>
                    <button type="button" className="btn" onClick={resumeScanning}>
                      Quét lượt khác
                    </button>
                  </div>
                </div>
              )}

              {lastScannedResult.type === 'ALREADY' && (
                <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 12, padding: 22, textAlign: 'center' }}>
                  <Clock size={42} color="#2563eb" style={{ margin: '0 auto 10px' }} />
                  <h3 style={{ margin: '0 0 6px', fontSize: 18, color: '#1e40af' }}>KHÁCH ĐÃ CHECK-IN TRƯỚC ĐÓ</h3>
                  <p style={{ margin: '0 0 16px', color: '#1e3a8a', fontSize: 14 }}>
                    Khách <strong>{lastScannedResult.order.name}</strong> đã check-in lúc {new Date(lastScannedResult.order.checkInAt).toLocaleTimeString('vi-VN')} và đang chơi trên sân.
                  </p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <button
                      type="button"
                      className="btn primary"
                      style={{ background: '#1e40af', borderColor: '#1e40af' }}
                      onClick={async () => {
                        await mutate(`/orders/${lastScannedResult.order.id}/check-out`, {});
                        notify('🏁 Khách đã check-out & hoàn tất buổi chơi!');
                        resumeScanning();
                      }}
                    >
                      🏁 Check-out & Hoàn tất buổi chơi
                    </button>
                    <button type="button" className="btn" onClick={resumeScanning}>
                      Quét lượt khác
                    </button>
                  </div>
                </div>
              )}

              {lastScannedResult.type === 'NOT_FOUND' && (
                <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 12, padding: 22, textAlign: 'center' }}>
                  <X size={42} color="#dc2626" style={{ margin: '0 auto 10px' }} />
                  <h3 style={{ margin: '0 0 6px', fontSize: 18, color: '#991b1b' }}>KHÔNG TÌM THẤY ĐƠN HÀNG</h3>
                  <p style={{ margin: '0 0 16px', color: '#7f1d1d', fontSize: 14 }}>
                    {lastScannedResult.msg}
                  </p>
                  <button type="button" className="btn" onClick={resumeScanning}>
                    Thử lại
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* TAB 1: LIVE WEBCAM SCANNER */}
              {tab === 'camera' && (
                <div>
                  <div className="aqr-camera-box">
                    <video ref={videoRef} className="aqr-video" muted playsInline />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />

                    {cameraActive && (
                      <div className="aqr-viewfinder">
                        <div className="aqr-laser" />
                        <div className="aqr-corner tl" />
                        <div className="aqr-corner tr" />
                        <div className="aqr-corner bl" />
                        <div className="aqr-corner br" />
                      </div>
                    )}

                    <div className="aqr-camera-status">
                      <span className="pulse-dot" />
                      {processing ? 'Đang nhận diện & xử lý…' : cameraActive ? 'Đưa mã QR trên vé vào khung quét' : 'Đang bật Camera…'}
                    </div>
                  </div>

                  {cameraError && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, margin: '14px 0', color: '#991b1b', fontSize: 13 }}>
                      {cameraError}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                    <small style={{ color: '#64748b' }}>
                      ⚡ <strong>Chế độ tự động:</strong> Giữ mã QR trước camera, hệ thống sẽ tự động check-in ngay khi nhận diện.
                    </small>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => setFacingMode(m => m === 'environment' ? 'user' : 'environment')}
                      style={{ fontSize: 12 }}
                    >
                      <RefreshCw size={13} /> Đổi camera
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: UPLOAD IMAGE */}
              {tab === 'upload' && (
                <div className="aqr-dropzone" onClick={() => document.getElementById('aqr-file-input').click()}>
                  <input
                    id="aqr-file-input"
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleImageUpload}
                  />
                  <Upload size={48} color="#173c32" style={{ margin: '0 auto 12px' }} />
                  <h4 style={{ margin: '0 0 6px', fontSize: 16, color: '#173c32' }}>Nhấn để chọn ảnh vé QR</h4>
                  <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                    Hỗ trợ file PNG, JPG, WEBP hoặc ảnh chụp màn hình vé điện tử
                  </p>
                </div>
              )}

              {/* TAB 3: KEYBOARD / BARCODE GUN */}
              {tab === 'manual' && (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    if (manualCode.trim()) handleScannedPayload(manualCode.trim());
                  }}
                  style={{ display: 'grid', gap: 14 }}
                >
                  <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#173c32' }}>
                    Mã vé E-Ticket, UUID đơn hàng hoặc Số điện thoại:
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        autoFocus
                        type="text"
                        value={manualCode}
                        onChange={e => setManualCode(e.target.value)}
                        placeholder="Ví dụ: CT-22222222 hoặc 0913555777…"
                        style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1.5px solid #173c32', fontSize: 15 }}
                      />
                      <button type="submit" className="btn primary" style={{ minWidth: 100 }}>
                        Check-in
                      </button>
                    </div>
                  </label>
                  <small style={{ color: '#64748b' }}>
                    Tương thích hoàn toàn với máy quét mã vạch/QR cầm tay (USB Barcode Scanner) tự động gõ mã và nhấn Enter.
                  </small>
                </form>
              )}

              {/* Quick Demo Test Buttons */}
              <div className="aqr-demo-pills">
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  🎯 Thử nghiệm nhanh:
                </span>
                {sampleConfirmed && (
                  <button
                    type="button"
                    className="aqr-demo-btn"
                    onClick={() => handleScannedPayload(sampleConfirmed.id)}
                    title={`Check-in tự động đơn ${sampleConfirmed.name}`}
                  >
                    🟢 Thử đơn ĐÃ CỌC: {sampleConfirmed.name}
                  </button>
                )}
                {sampleCheckedIn && (
                  <button
                    type="button"
                    className="aqr-demo-btn"
                    onClick={() => handleScannedPayload(sampleCheckedIn.id)}
                    title={`Đơn ${sampleCheckedIn.name} đang chơi`}
                  >
                    🎾 Thử đơn ĐANG CHƠI: {sampleCheckedIn.name}
                  </button>
                )}
                {sampleHolding && (
                  <button
                    type="button"
                    className="aqr-demo-btn"
                    onClick={() => handleScannedPayload(sampleHolding.id)}
                    title={`Đơn ${sampleHolding.name} giữ chỗ`}
                  >
                    ⏳ Thử đơn CHƯA CỌC: {sampleHolding.name}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
