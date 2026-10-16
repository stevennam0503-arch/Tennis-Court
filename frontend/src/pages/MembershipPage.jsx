import React,{useState,useEffect} from 'react';
import {PublicHeader,PublicFooter} from '../components/PublicLayout';
import MembershipPlans,{MembershipTerms} from '../components/MembershipPlans';
import {api} from '../services/api';
import {today} from '../utils/format';
import {Button} from '../components/UI';
export default function MembershipPage({onLogin,user,onAction}){
 const [plans,setPlans]=useState(null),[error,setError]=useState('');
 const load=()=>{setError('');api('/public/overview?date='+today()).then(d=>setPlans(d.membershipPlans||[])).catch(e=>setError(e.message));};
 useEffect(()=>{load();},[]);
 return <div className="public-page"><PublicHeader user={user} onLogin={onLogin} active="/membership"/><main className="membership-public public-section"><header className="membership-intro"><span className="section-kicker">COURTLY MEMBERSHIP</span><h1>Chơi thường xuyên.<br/>Gắn bó nhiều hơn.</h1><p>Chọn quyền lợi phù hợp với nhịp ra sân. Xem rõ phí hội viên, thời hạn và ưu đãi trước khi đăng ký.</p></header>{error?<div className="error" role="alert">{error} <Button onClick={load}>Thử lại</Button></div>:plans?<MembershipPlans plans={plans} onChoose={p=>onAction({type:'membership',planId:p.id})}/>:<p className="loading" role="status">Đang tải các gói hội viên…</p>}<MembershipTerms/></main><PublicFooter/></div>;
}
