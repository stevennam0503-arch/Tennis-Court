import React,{useState,useEffect} from 'react';
import {ArrowRight,Check,Clock} from 'lucide-react';
import {Panel,Button} from './UI';
import {CourtPhoto,courtDescription} from './CourtGallery';
import {money,today,labels} from '../utils/format';

export default function BookingPicker({data,date,setDate,onBook,initialCourtId}){
  const [courtId,setCourtId]=useState(''),[period,setPeriod]=useState('all'),[selected,setSelected]=useState([]),[error,setError]=useState('');
  useEffect(()=>{if(initialCourtId)setCourtId(initialCourtId);},[initialCourtId]);
  const court=data.courts.find(c=>c.id===courtId)||data.courts.find(c=>c.status==='ACTIVE')||data.courts[0];
  useEffect(()=>{setSelected([]);setError('');},[date]);
  const chosen=data.schedules.filter(s=>selected.includes(s.id));
  const upcoming=s=>Date.parse(`${s.date}T${String(s.hour).padStart(2,'0')}:00:00+07:00`)>Date.now();
  const available=s=>upcoming(s)&&s.status==='AVAILABLE'&&data.courts.find(c=>c.id===s.court)?.status==='ACTIVE';
  const slots=data.schedules.filter(s=>s.court===court?.id&&upcoming(s)&&(period==='all'||(period==='morning'?s.hour<12:period==='afternoon'?s.hour>=12&&s.hour<17:s.hour>=17)));
  const total=chosen.reduce((n,s)=>n+s.price,0),maxDate=new Date(Date.now()+90*86400000).toISOString().slice(0,10);

  const choose=id=>{
    setError('');
    const clicked=data.schedules.find(s=>s.id===id);
    if(!clicked)return;
    const otherCourtSlots=chosen.filter(s=>s.court!==clicked.court).map(s=>s.id);
    const previous=chosen.filter(s=>s.court===clicked.court).sort((a,b)=>a.hour-b.hour);
    const otherCourts=new Set(data.schedules.filter(s=>otherCourtSlots.includes(s.id)).map(s=>s.court));

    if(!previous.length){
      if(otherCourts.size>=3){
        setError('Tối đa 3 sân trong cùng một đơn.');
        return;
      }
      setSelected([...otherCourtSlots,id]);
      return;
    }
    if(previous.length===1&&previous[0].id===id){
      setSelected(otherCourtSlots);
      return;
    }
    const start=Math.min(previous[0].hour,clicked.hour),end=clicked.hour<previous[0].hour?previous.at(-1).hour:clicked.hour;
    const range=data.schedules.filter(s=>s.court===clicked.court&&s.hour>=start&&s.hour<=end).sort((a,b)=>a.hour-b.hour);
    if(range.length!==end-start+1||range.some(s=>!available(s))){
      setError('Khoảng giờ đi qua slot bận. Hãy chọn khoảng trống liên tiếp.');
      return;
    }
    setSelected([...otherCourtSlots,...range.map(s=>s.id)]);
  };

  const proceed=()=>{
    if(!chosen.length)return;
    if(chosen.some(s=>!available(s))){
      setError('Một khung giờ vừa thay đổi. Vui lòng chọn lại.');
      setSelected(old=>old.filter(id=>data.schedules.some(s=>s.id===id&&available(s))));
      return;
    }
    onBook({type:'booking',date,scheduleIds:chosen.map(s=>s.id),onCreated:()=>setSelected([])});
  };

  const chosenCourtsList=Array.from(new Set(chosen.map(s=>s.court)));

  return <div className={`booking-picker ${chosen.length?'has-selection':''}`}><Panel title="Tìm giờ trống" action={<div className="booking-date"><label htmlFor="booking-date">Ngày chơi</label><input id="booking-date" type="date" min={today()} max={maxDate} value={date} onChange={e=>e.target.value&&setDate(e.target.value)}/></div>}><div className="panel-body">
  <div className="picker-step"><span>1</span><h3>Chọn sân</h3></div><div className="court-options" role="group" aria-label="Chọn sân">{data.courts.map(c=>{
    const cCount=chosen.filter(s=>s.court===c.id).length;
    return <button key={c.id} aria-pressed={court?.id===c.id} className={`${court?.id===c.id?'chosen':''} ${cCount>0?'has-selection':''}`} disabled={c.status!=='ACTIVE'} onClick={()=>{setCourtId(c.id);setError('');}}><b>{c.name}{cCount>0?` (${cCount}h)`:''}</b><span>{labels[c.type]} · {c.status==='ACTIVE'?'Đang hoạt động':'Bảo trì'}</span></button>;
  })}</div>
  <div className="court-picker-info">{court&&<><CourtPhoto court={court}/><div><h4>{court.name}</h4><p>{courtDescription(court)}</p><p>{court.address||data.club?.address||'Địa chỉ đang cập nhật'}</p>{court.amenities&&<p>{court.amenities}</p>}</div></>}</div><div className="picker-step"><span>2</span><h3>Chọn giờ chơi</h3></div><div className="time-filters" role="group" aria-label="Buổi chơi">{[['all','Cả ngày'],['morning','Buổi sáng'],['afternoon','Buổi chiều'],['evening','Buổi tối']].map(([id,text])=><button key={id} aria-pressed={period===id} className={period===id?'on':''} onClick={()=>setPeriod(id)}>{text}</button>)}</div><p className="slot-guide">Mỗi slot dài 1 giờ. Chọn giờ đầu rồi giờ cuối để đặt trên từng sân. Bạn có thể chọn chuyển tab sân khác để đặt tối đa 3 sân trong 1 đơn.</p>
  <div className="time-options">{slots.map(s=>{const on=selected.includes(s.id),can=available(s),status=court?.status!=='ACTIVE'?'Bảo trì':s.status==='LOCKED'?'Đang giữ chỗ':s.status==='IN_MATCH'?'Có trận đấu':s.status==='BOOKED'?'Đã đặt':'Còn trống';return <button key={s.id} disabled={!can} aria-pressed={on} className={`time-option ${on?'chosen':''}`} onClick={()=>choose(s.id)} aria-label={`${court?.name}, ${s.hour} đến ${s.hour+1} giờ, ${money(s.price)}, ${on?'Đang chọn':status}`}><b>{on?<Check size={15}/>:<Clock size={15}/>} {s.hour}:00 – {s.hour+1}:00</b><span>{money(s.price)}</span><small>{on?'Đang chọn':status}</small></button>;})}</div>{!slots.length&&<p className="empty">Không còn khung giờ trong khoảng này. Hãy chọn buổi hoặc ngày khác.</p>}
  {error&&<div className="error" role="alert">{error}</div>}<p className="booking-policy">Giữ chỗ {data.settings.holdMinutes} phút · Cọc {data.settings.depositPercent}% tại quầy để xác nhận.</p></div></Panel>
  {chosen.length>0&&<div className="booking-summary" role="region" aria-label="Lựa chọn đặt sân"><div className="selection-info" aria-live="polite"><b>{chosen.length} khung giờ ({chosenCourtsList.length} sân) · {money(total)}</b><span>Cọc dự kiến {money(total*data.settings.depositPercent/100)}</span><details><summary>Xem chi tiết từng sân</summary>{chosenCourtsList.map(cid=>{const cName=data.courts.find(c=>c.id===cid)?.name||'Sân';const cSlots=chosen.filter(s=>s.court===cid).sort((a,b)=>a.hour-b.hour);return <div key={cid} style={{margin:'4px 0'}}><b>{cName}:</b> {cSlots.map(s=>`${s.hour}:00–${s.hour+1}:00`).join(', ')} ({cSlots.length} giờ · {money(cSlots.reduce((a,b)=>a+b.price,0))})</div>;})}</details></div><Button onClick={()=>setSelected([])}>Bỏ chọn tất cả</Button><Button className="primary" onClick={proceed}>Tiếp tục <ArrowRight size={17}/></Button></div>}
  </div>;
}
