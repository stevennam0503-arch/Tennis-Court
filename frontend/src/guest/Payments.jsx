import React,{useState,useEffect,useRef} from 'react';
import QRCode from 'qrcode';
import {Copy,CheckCircle2,ArrowRight} from 'lucide-react';
import {api} from '../services/api';
import {useGuest,Action,State,Empty,money} from './context';

export function PaymentDialog({intent,onClose}){
  const {t,refresh,notify,navigate}=useGuest();
  const lastStatus=useRef(intent.status);
  const [current,setCurrent]=useState(intent);
  const [qr,setQr]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');


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

      <p className="gx-notice">{t('Chỉ ngân hàng xác minh tiền chuyển khoản. Nút thông báo đã chuyển tiền không xác nhận thu tiền và không gia hạn giữ chỗ.')}</p>
      {/* VietQR Display */}
      <div className="gx-qr" style={{textAlign:'center',margin:'10px 0'}}>
        {qr ? (
          <img src={qr} width="240" height="240" alt="Mã VietQR thanh toán" style={{borderRadius:6}}/>
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

      {/* Action Buttons */}
      <div style={{display:'grid',gap:8}}>
        {['PENDING','CHECKING'].includes(current.status)&&(
          <button
            type="button"
            disabled={busy}
            onClick={()=>action('declared')}
            style={{background:'#fffefa',border:'1px solid #bfc7ba',borderRadius:4,padding:'9px',fontSize:12,cursor:'pointer'}}
          >
            {t('Tôi đã chuyển khoản (Chờ đối soát)')}
          </button>
        )}

        <Action secondary onClick={onClose}>{t('Đóng')}</Action>
      </div>
    </div>
  );
}

export function PaymentChoice({onChoose}){
 const {t}=useGuest();const [busy,setBusy]=useState(false),[online,setOnline]=useState(null);
 useEffect(()=>{let live=true;api('/public/payment-config').then(c=>{if(live)setOnline(c.onlineEnabled&&c.bankConfigured)}).catch(()=>{if(live)setOnline(false)});return()=>{live=false}},[]);
 return <div className="gx-form"><h2>{t('Chọn phương thức thanh toán')}</h2><p>{t('Tiền chỉ được ghi nhận khi nhân viên thu tiền mặt hoặc ngân hàng gửi xác minh chuyển khoản.')}</p><Action disabled={busy||!online} onClick={async()=>{setBusy(true);try{await onChoose('BANK_TRANSFER')}finally{setBusy(false)}}}>{t('Chuyển khoản VietQR')}</Action>{online===false&&<p>{t('Chuyển khoản hiện chưa khả dụng. Vui lòng thanh toán tại quầy.')}</p>}<Action secondary disabled={busy} onClick={()=>onChoose('CASH')}>{t('Tiền mặt tại quầy')}</Action></div>;
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
