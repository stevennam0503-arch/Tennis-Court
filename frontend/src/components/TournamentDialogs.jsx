import React from 'react';
import {useCourtly} from '../context';
import {Modal,FormDialog,Button,Chip,Table} from './UI';
import {money,labels,slotLabel,slotHours} from '../utils/format';
import {resolveSlots} from './OrderDialogs';
import TournamentFlowchart from './TournamentFlowchart';
export function TournamentDetail({id,onClose}){
 const {data,show}=useCourtly();
 const t=data.tournaments.find(t=>t.id===id),
       regs=data.registrations.filter(r=>r.tournamentId===id),
       matches=data.matches.filter(m=>m.tournamentId===id);

 return (
   <Modal title={`Quản lý giải đấu: ${t.name}`} onClose={onClose} wide="ultra-wide" footer={<Button onClick={onClose}>Đóng</Button>}>
     <div className="detail-head" style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
       <div>
         <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
           <Chip status={t.status}/>
           <strong style={{fontSize:15}}>{labels[t.format]} · {t.location}</strong>
         </div>
         <span style={{fontSize:13,color:'#637269'}}>{t.start} → {t.end} · Hạn đăng ký: {t.deadline} · Phí: {money(t.fee)}/đăng ký</span>
       </div>
       <div className="step-row" style={{margin:0}}>
         <Button className="primary sm" disabled={t.status!=='OPEN'} onClick={()=>show({type:'registration',id})}>+ Thêm đăng ký</Button>
         {!matches.length && (
           <Button className="sm" onClick={()=>show({type:'draw',id})}>🎯 Bốc thăm nhánh đấu</Button>
         )}
       </div>
     </div>

     {/* Interactive Flowchart Bracket */}
     <TournamentFlowchart
       tournament={t}
       registrations={regs}
       matches={matches}
       courts={data.courts}
       staff={data.staff}
       onSchedule={m => show({type:'match-schedule', id: m.id})}
     />

     {/* Registrations List Accordion/Section */}
     <details style={{marginTop:24,border:'1px solid #dce3df',borderRadius:10,padding:'12px 18px',background:'#ffffff'}} open={!matches.length}>
       <summary style={{cursor:'pointer',fontWeight:700,fontSize:14,color:'#173c32'}}>
         📋 Danh sách đăng ký thi đấu ({regs.length}/{t.max} suất · {regs.filter(r=>r.status==='CONFIRMED').length} đã xác nhận)
       </summary>
       <div style={{marginTop:14}}>
         <Table headings={['Đội / cá nhân','Thành viên','Trạng thái','Đã thu','']} empty={!regs.length}>
           {regs.map(r=><tr key={r.id}><td className="name">{r.name}</td><td>{r.members.map((name,i)=><div key={i}>{name}</div>)}</td><td><Chip status={r.status}/></td><td>{money(r.paid)}</td><td>{r.paid<t.fee&&<Button className="sm" onClick={()=>show({type:'payment',registrationId:r.id})}>Thu phí</Button>}</td></tr>)}
         </Table>
       </div>
     </details>
   </Modal>
 );
}
export function TournamentActionDialog({type,id,onClose}){
 const {data,mutate,notify,show}=useCourtly();const t=data.tournaments.find(t=>t.id===id);
 const done=()=>{notify('Đã cập nhật giải');show({type:'tournament',id});};
 if(type==='draw')return <FormDialog title="Bốc thăm nhánh đấu" fields={[]} onClose={onClose} submitText="Bốc thăm" onSubmit={async()=>{await mutate(`/tournaments/${id}/draw`);done();}}><p>Sinh nhánh loại trực tiếp cho 2, 4, 8, 16… đăng ký đã xác nhận. Bản hiện tại chưa hỗ trợ bye.</p></FormDialog>;
 return <FormDialog title="Đăng ký giải đấu" initial={{accountId:data.accounts.find(a=>a.status==='ACTIVE')?.id,name:'',members:''}} fields={[{name:'accountId',label:'Người đăng ký',full:true,options:data.accounts.filter(a=>a.status==='ACTIVE').map(a=>({value:a.id,label:a.name}))},{name:'name',label:t.format==='SINGLES'?'Tên thi đấu':'Tên đội',full:true},{name:'members',label:'Thành viên bổ sung (mỗi dòng một người)',type:'textarea',full:true,required:t.format!=='SINGLES'}]} onClose={onClose} submitText="Đăng ký" onSubmit={async v=>{await mutate(`/tournaments/${id}/registrations`,{...v,members:v.members.split('\n').map(x=>x.trim()).filter(Boolean)});done();}}><div className="notice" style={{marginBottom:18}}>Người đăng ký tự được thêm vào đội. Giải đôi cần thêm đúng một đồng đội.</div></FormDialog>;
}
export function MatchDetail({id,onClose}){
 const {data,show}=useCourtly();const m=data.matches.find(x=>x.id===id);
 const name=id=>data.registrations.find(r=>r.id===id)?.name||'Chờ vòng trước';
 return <Modal title={`Trận đấu · ${m.roundName}`} onClose={onClose} footer={<Button onClick={()=>show({type:'tournament',id:m.tournamentId})}>Về giải đấu</Button>}><div className="detail-head"><h2>{name(m.reg1)} <span className="muted">vs</span> {name(m.reg2)}</h2><p className="subtitle"><Chip status={m.status}/> {m.score}</p></div>{m.slots.length?<div className="notice">{m.date}<br/>{m.slots.map(s=><div key={s.id}>{data.courts.find(c=>c.id===s.court)?.name} · {slotLabel(s)}</div>)}{m.staffId&&<div>Trọng tài: {data.staff.find(s=>s.id===m.staffId)?.name}</div>}</div>:<p className="subtitle">Chưa xếp sân.</p>}{m.status==='SCHEDULED'&&m.reg1&&m.reg2&&<div className="step-row"><Button className="primary" onClick={()=>show({type:'match-schedule',id})}>Xếp lịch sân & trọng tài</Button><Button disabled={!m.slots.length} onClick={()=>show({type:'match-result',id})}>Nhập kết quả</Button></div>}</Modal>;
}
export function MatchActionDialog({type,id,onClose}){
 const {data,mutate,notify,show}=useCourtly();const m=data.matches.find(x=>x.id===id),t=data.tournaments.find(x=>x.id===m.tournamentId);
 const done=()=>{notify('Đã cập nhật trận');show({type:'match',id});};
 if(type==='match-result')return <FormDialog title="Ghi kết quả trận" initial={{winnerId:m.reg1,score:''}} fields={[{name:'winnerId',label:'Đội / người thắng',options:[m.reg1,m.reg2].map(id=>({value:id,label:data.registrations.find(r=>r.id===id)?.name}))},{name:'score',label:'Tỉ số (ví dụ 6-4, 6-3)'}]} onClose={onClose} submitText="Kết thúc trận & nhả sân" onSubmit={async v=>{await mutate(`/matches/${id}/result`,v);done();}}/>;
 return <FormDialog title="Xếp lịch thi đấu" initial={{date:m.date||t.start,court:m.slots[0]?.court||data.courts.find(c=>c.status==='ACTIVE')?.id,start:m.slots[0]?.hour||8,hours:m.slots.reduce((n,s)=>n+slotHours(s),0)||1,staffId:m.staffId||''}} fields={[{name:'date',label:'Ngày thi đấu',type:'date',min:t.start,max:t.end},{name:'court',label:'Sân',options:data.courts.filter(c=>c.status==='ACTIVE').map(c=>({value:c.id,label:c.name}))},{name:'start',label:'Giờ bắt đầu',type:'number',min:6,max:22.5,step:0.5},{name:'hours',label:'Số giờ liên tiếp',type:'number',min:0.5,max:17,step:0.5},{name:'staffId',label:'Trọng tài',full:true,required:false,options:[{value:'',label:'Không phân công'},...data.staff.filter(s=>s.type==='REFEREE'&&s.status==='ACTIVE').map(s=>({value:s.id,label:s.name}))]}]} onClose={onClose} onSubmit={async v=>{await mutate(`/matches/${id}/schedule`,{scheduleIds:await resolveSlots(v),staffId:v.staffId||null},'PUT');done();}}/>;
}
