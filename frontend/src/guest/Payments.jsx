import React,{useState,useEffect,useRef} from 'react';
import QRCode from 'qrcode';
import {Copy,CheckCircle2,ArrowRight} from 'lucide-react';
import {api} from '../services/api';
import {useGuest,Action,State,Empty,money} from './context';

function PaymentCountdown({ expiresAt, t }) {
  const [sec, setSec] = useState(() => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!expiresAt) return;
    const i = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSec(remaining);
      if (remaining <= 0) clearInterval(i);
    }, 1000);
    return () => clearInterval(i);
  }, [expiresAt]);

  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const formatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  if (sec <= 0) {
    return (
      <div style={{ color: '#dc2626', fontWeight: 700, fontSize: 13, textAlign: 'center', marginBottom: 12 }}>
        ⚠️ {t('Đã hết thời hạn giữ chỗ đơn đặt. Nếu chưa chuyển tiền, vui lòng quay lại đặt sân mới.')}
      </div>
    );
  }

  return (
    <div style={{
      textAlign: 'center',
      marginBottom: 12,
      padding: '8px 12px',
      background: '#fffbeb',
      border: '1px solid #fde68a',
      borderRadius: 6,
      color: '#92400e',
      fontSize: 13,
      fontWeight: 600
    }}>
      ⏱️ {t('Thời gian giữ chỗ VietQR còn lại')}: <span style={{ fontSize: 15, fontWeight: 700, color: '#b45309' }}>{formatted}</span>
    </div>
  );
}

export function PaymentDialog({intent,onClose}){
  const {t,refresh,notify,navigate}=useGuest();
  const lastStatus=useRef(intent.status);
  const [current,setCurrent]=useState(intent);
  const [qr,setQr]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');


  const fallbackVietQrUrl = current.amount && current.reference
    ? `https://img.vietqr.io/image/${current.bankBin || '970422'}-${current.accountNumber || '0345678999'}-compact2.png?amount=${current.amount}&addInfo=${current.reference}&accountName=${encodeURIComponent(current.accountName || 'CLB TENNIS COURTLY')}`
    : null;
  const qrSrc = qr || current.qrImageUrl || fallbackVietQrUrl;

  // Generate standard VietQR QR canvas from EMVCo payload
  useEffect(()=>{
    if(current.qrPayload){
      QRCode.toDataURL(current.qrPayload,{width:320,margin:1,errorCorrectionLevel:'M'})
        .then(setQr)
        .catch(()=>setError(t('Không thể tạo QR. Dùng nội dung chuyển khoản bên dưới.')));
    }
  },[current.qrPayload]);

  // Realtime polling check for bank transaction
  useEffect(()=>{
    let live=true;
    const timer=setInterval(()=>{
      api('/transfers').then(rows=>{
        const found=rows.find(r=>r.id===intent.id);
        if(live&&found){
          setCurrent(found);
          if(found.status!==lastStatus.current){
            lastStatus.current=found.status;
            refresh().catch(()=>{});
          }
        }
      }).catch(()=>{});
    },3000);
    return()=>{live=false;clearInterval(timer)};
  },[intent.id,refresh]);

  const action=async(path,b={})=>{
    setBusy(true);setError('');
    try{
      const updated=await api(`/transfers/${current.id}/${path}`,'POST',b);
      setCurrent(updated);
      await refresh();
      if(updated.status==='CONFIRMED'){
        notify(t('Khoản chuyển đã được xác minh. Vui lòng kiểm tra số dư của đơn.'));
      }
    }catch(e){
      setError(e.message);
    }finally{
      setBusy(false);
    }
  };

  const copy=async(text,msg)=>{
    try{
      await navigator.clipboard.writeText(text);
      notify(t(`Đã sao chép ${msg||''}`));
    }catch{
      notify(text);
    }
  };

  const isConfirmed = current.status === 'CONFIRMED';

  if(isConfirmed){
    return (
      <div className="gx-payment" style={{textAlign:'center',padding:'20px 10px'}}>
        <div style={{color:'#173c32',marginBottom:12}}>
          <CheckCircle2 size={54} strokeWidth={2.2} style={{color:'#2e7d32',margin:'0 auto'}}/>
        </div>
        <span className="ct-eyebrow" style={{color:'#2e7d32',letterSpacing:'1px',fontWeight:700}}>
          {t('GIAO DỊCH THÀNH CÔNG')}
        </span>
        <h2 style={{fontSize:24,margin:'8px 0 12px 0',color:'#173c32'}}>
          {t('KHOẢN CHUYỂN ĐÃ XÁC MINH')}
        </h2>
        <p style={{fontSize:13,color:'#555',margin:'0 auto 20px auto',maxWidth:380}}>
          {t('Khoản chuyển đã được xác minh. Xem đơn để biết số dư còn lại và trạng thái lịch đặt.')}
        </p>

        <div style={{background:'#f0f4ec',border:'1px solid #d2dec8',borderRadius:6,padding:'14px 18px',marginBottom:22,textAlign:'left',fontSize:13}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            <span style={{color:'#666'}}>{t('Mã giao dịch')}:</span>
            <b>{current.reference}</b>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            <span style={{color:'#666'}}>{t('Số tiền đã thu')}:</span>
            <b style={{color:'#2e7d32',fontSize:15}}>{money(current.received||current.amount)}</b>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            <span style={{color:'#666'}}>{t('Hình thức')}:</span>
            <span>Chuyển khoản VietQR (Napas 247)</span>
          </div>
          <div style={{display:'flex',justifyContent:'space-between'}}>
            <span style={{color:'#666'}}>{t('Trạng thái giao dịch')}:</span>
            <State value={current.status}/>
          </div>
        </div>

        <Action onClick={()=>{onClose();if(navigate)navigate('orders');}}>
          {t('Xem đơn hàng của tôi')} <ArrowRight size={16} style={{display:'inline',verticalAlign:'middle',marginLeft:4}}/>
        </Action>
      </div>
    );
  }

  return (
    <div className="gx-payment">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <span className="ct-eyebrow" style={{margin:0}}>
          {t('CHUYỂN KHOẢN VIETQR 24/7')}
        </span>
        <State value={current.status}/>
      </div>

      <p className="gx-notice" style={{fontSize:12.5, lineHeight:1.5, color:'#475569', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6, padding:'10px 14px', margin:'0 0 12px'}}>
        {t('Vui lòng quét mã VietQR hoặc chuyển khoản đúng nội dung bên dưới. Sau khi ngân hàng xác nhận giao dịch, hệ thống sẽ tự động đối soát và cấp Vé Điện Tử.')}
      </p>
      <PaymentCountdown expiresAt={current.expiresAt} t={t} />

      {/* VietQR Display */}
      <div className="gx-qr" style={{textAlign:'center',margin:'10px 0'}}>
        {qrSrc ? (
          <img
            src={qrSrc}
            width="240"
            height="240"
            alt="Mã VietQR thanh toán"
            onError={() => {
              if (current.reference) {
                QRCode.toDataURL(`STK: ${current.accountNumber || ''}\nNH: ${current.bankBin || '970422'}\nSo tien: ${current.amount}\nND: ${current.reference}`, { width: 320, margin: 1 })
                  .then(setQr)
                  .catch(() => {});
              }
            }}
            style={{borderRadius:8, border:'1px solid #e2e8f0', boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}
          />
        ) : (
          <Empty>{t('Đang tạo mã VietQR...')}</Empty>
        )}
        <div style={{fontSize:11,color:'#666',marginTop:6}}>
          {t('Quét bằng ứng dụng ngân hàng bất kỳ (MB Bank, VCB, BIDV, Techcombank, Momo,...)')}
        </div>
      </div>

      {/* Amount Display */}
      <div style={{textAlign:'center',margin:'12px 0'}}>
        <div style={{fontSize:12,color:'#666'}}>{t('Số tiền thanh toán')}</div>
        <h3 style={{fontSize:24,color:'#173c32',margin:'4px 0'}}>
          {money(current.amount)}
        </h3>
      </div>

      {/* Bank Account Details with Copy */}
      <div style={{background:'#fdfcf8',border:'1px solid #dcdad2',borderRadius:6,padding:'12px 14px',fontSize:12,marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px dashed #e4e2d8'}}>
          <span style={{color:'#666'}}>{t('Ngân hàng')}:</span>
          <b>{current.bankName || 'MB Bank (Quân Đội)'}</b>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px dashed #e4e2d8'}}>
          <span style={{color:'#666'}}>{t('Chủ tài khoản')}:</span>
          <b>{current.accountName || 'CLB TENNIS COURTLY'}</b>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px dashed #e4e2d8'}}>
          <span style={{color:'#666'}}>{t('Số tài khoản')}:</span>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <b style={{fontSize:13,letterSpacing:'.5px'}}>{current.accountNumber || '—'}</b>
            <button type="button" onClick={()=>copy(current.accountNumber||'',t('số tài khoản'))} style={{border:'none',background:'none',cursor:'pointer',padding:2}}>
              <Copy size={13}/>
            </button>
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0'}}>
          <span style={{color:'#666'}}>{t('Nội dung chuyển khoản')}:</span>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <b style={{color:'#b71c1c',fontSize:13}}>{current.reference}</b>
            <button type="button" onClick={()=>copy(current.reference,t('nội dung'))} style={{border:'none',background:'none',cursor:'pointer',padding:2}}>
              <Copy size={13}/>
            </button>
          </div>
        </div>
      </div>

      <div style={{fontSize:11,color:'#777',textAlign:'center',marginBottom:14}}>
        {t('Hết hạn lúc')}: {new Date(current.expiresAt).toLocaleTimeString('vi-VN')} {new Date(current.expiresAt).toLocaleDateString('vi-VN')}
      </div>

      {error&&<div className="gx-error" role="alert" style={{marginBottom:10}}>{t(error)}</div>}

      {/* Realtime Waiting Indicator for Customer */}
      {['PENDING','CHECKING'].includes(current.status)&&(
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: '12px 16px',
          background: '#f0fdf4',
          border: '1.5px solid #86efac',
          borderRadius: 8,
          marginBottom: 12
        }}>
          <span style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#16a34a',
            display: 'inline-block'
          }}/>
          <span style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>
            {t('Đang lắng nghe biến động số dư từ MB Bank… (Tự động xác nhận)')}
          </span>
        </div>
      )}

      {/* Presentation & Thesis Defense Simulation Tool */}
      {['PENDING','CHECKING'].includes(current.status)&&(
        <details style={{
          background: '#f8fafc',
          border: '1px dashed #94a3b8',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 14,
          textAlign: 'left'
        }}>
          <summary style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#334155',
            cursor: 'pointer',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            ⚡ {t('Công cụ Demo Hội đồng: Giả lập Ngân hàng gửi Webhook')}
          </summary>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0', fontSize: 12, color: '#475569' }}>
            <p style={{ margin: '0 0 10px', lineHeight: 1.5 }}>
              {t('Ngoài đời thực, khi khách chuyển tiền, MB Bank sẽ tự động bắn Webhook về endpoint /api/webhooks/sepay. Nhấn nút bên dưới để mô phỏng tín hiệu Webhook ngân hàng bắn về Server:')}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={()=>action('sandbox', { scenario: 'SUCCESS' })}
              style={{
                width: '100%',
                background: '#173c32',
                color: '#def46a',
                border: 'none',
                borderRadius: 6,
                padding: '11px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: '0 2px 6px rgba(23,60,50,0.15)'
              }}
            >
              {busy ? t('Đang phát tín hiệu Webhook…') : `⚡ ${t('Giả lập MB Bank chuyển đủ')} (${money(current.amount)})`}
            </button>
          </div>
        </details>
      )}

      <Action secondary onClick={onClose}>{t('Đóng')}</Action>
    </div>
  );
}

export function PaymentChoice({onChoose}){
 const {t}=useGuest();const [busy,setBusy]=useState(false),[online,setOnline]=useState(null);
 useEffect(()=>{let live=true;api('/public/payment-config').then(c=>{if(live)setOnline(Boolean(c.onlineEnabled&&c.bankConfigured))}).catch(()=>{if(live)setOnline(false)});return()=>{live=false}},[]);
 return <div className="gx-form"><h2>{t('Chọn phương thức thanh toán')}</h2><p>{t('Tiền chỉ được ghi nhận khi nhân viên thu tiền mặt hoặc ngân hàng gửi xác minh chuyển khoản.')}</p><Action disabled={busy||online===false} onClick={async()=>{setBusy(true);try{await onChoose('BANK_TRANSFER')}finally{setBusy(false)}}}>{t('Chuyển khoản VietQR')}</Action>{online===false&&<p>{t('Chuyển khoản hiện chưa khả dụng. Vui lòng thanh toán tại quầy.')}</p>}<Action secondary disabled={busy} onClick={()=>onChoose('CASH')}>{t('Tiền mặt tại quầy')}</Action></div>;
}

export default function Payments(){
  const {t,data,transfers,pay}=useGuest();
  return (
    <section className="ct-pad">
      <div className="gx-heading">
        <span className="ct-eyebrow">COURTLY / {t('TÀI KHOẢN')}</span>
        <h1>{t('Lịch sử thanh toán')}</h1>
        <p>{t('Tiền đã nhận và yêu cầu chuyển khoản được theo dõi riêng biệt, minh bạch.')}</p>
      </div>

      <h2>{t('Yêu cầu thanh toán chuyển khoản')}</h2>
      <div className="gx-records">
        {transfers.map(x=><article key={x.id}>
          <header>
            <b>{x.reference}</b>
            <State value={x.status}/>
          </header>
          <p>{t(x.type)} • {money(x.amount)}</p>
          <p>{t('Đã xác nhận thu')}: {money(x.received)} • {t('Tiền cần đối soát')}: {money(x.reviewAmount)}</p>
          <Action secondary onClick={()=>pay(null,null,null,x)}>{t('Xem mã QR thanh toán')}</Action>
        </article>)}
      </div>
      {!transfers.length&&<Empty/>}

      <h2>{t('Phiếu thu đã xác nhận')}</h2>
      <div className="gx-records">
        {[...(data?.payments||[]),...(data?.membershipPayments||[])]
          .sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))
          .map(p=><article key={p.id}>
            <header>
              <b>{p.code||p.transactionCode||p.id.slice(0,8)}</b>
              <b>{money(p.amount)}</b>
            </header>
            <p>{t(p.method)} • {new Date(p.createdAt||p.paidAt).toLocaleString('vi-VN')}</p>
            <p>{t('Mã đơn / Giải')}: {(p.orderId||p.registrationId||p.membershipId)?.slice(0,8)} {p.planName||''}</p>
          </article>)}
      </div>
    </section>
  );
}
