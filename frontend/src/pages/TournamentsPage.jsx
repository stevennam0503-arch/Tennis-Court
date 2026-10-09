import React from 'react';
import {Trophy} from 'lucide-react';
import {useCourtly} from '../context';
import {Title,Chip,Button} from '../components/UI';
import {money,labels} from '../utils/format';
export default function TournamentsPage(){
 const {data,show}=useCourtly();
 return <><Title subtitle="Đăng ký, thu phí, nhánh đấu và lịch thi đấu." action={<Button className="primary" onClick={()=>show({type:'entity',collection:'tournaments'})}>Tạo giải</Button>}>Giải đấu</Title><div className="grid-cards">{data.tournaments.map(t=>{const regs=data.registrations.filter(r=>r.tournamentId===t.id);return <article className="item-card" key={t.id}><div className="card-body"><div className="card-top"><span className="stat-icon"><Trophy size={20}/></span><Chip status={t.status}/></div><h2>{t.name}</h2><p className="subtitle">{labels[t.format]} · {t.location}</p><div className="metric"><span className="muted">Ngày thi đấu</span><span>{t.start}</span></div><div className="metric"><span className="muted">Hạn đăng ký</span><span>{t.deadline}</span></div><div className="metric"><span className="muted">Phí đăng ký</span><b>{money(t.fee)}</b></div><div className="progress"><b style={{width:`${Math.min(100,regs.length/t.max*100)}%`}}/></div><small>{regs.length}/{t.max} đăng ký · {regs.filter(r=>r.status==='CONFIRMED').length} xác nhận</small><div className="card-buttons"><Button className="primary sm" onClick={()=>show({type:'tournament',id:t.id})}>Quản lý giải</Button><Button className="sm" onClick={()=>show({type:'entity',collection:'tournaments',row:t})}>Sửa</Button></div></div></article>;})}</div></>;
}
