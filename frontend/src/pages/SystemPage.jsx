import React,{useState} from 'react';
import {useCourtly} from '../context';
import {Title,Panel,Table,Button,Tabs} from '../components/UI';
import modules from '../modules.json';
const pending=[1,2,5,30,32,34],partial=[3,4,6,7,13,15,18,20,23,24,31,35,36,39,40,42,44,47,48,49,50];
export default function SystemPage(){
 const {data,show}=useCourtly();const [tab,setTab]=useState('modules');
 return <><Title subtitle="Đối chiếu phạm vi với tài liệu 50 module.">Hệ thống & module</Title><Tabs options={[["modules","50 module"],["audit","Nhật ký"],["settings","Chính sách"]]} value={tab} onChange={setTab}/>
 {tab==='modules'&&<><div className="notice" style={{marginBottom:20}}>Các nhãn thể hiện phạm vi đã triển khai. Bản cơ bản và phần cần kết nối chưa được xem là hoàn thành đầy đủ nghiệp vụ.</div><Panel title="50 module từ tài liệu"><Table headings={['#','Module','Phạm vi','Ưu tiên']}>{modules.map(m=><tr key={m.id}><td>{m.id}</td><td><span className="name">{m.name}</span><small>{m.group}</small><small style={{maxWidth:570}}>{m.description}</small></td><td><span className={`chip ${pending.includes(m.id)?'orange':partial.includes(m.id)?'blue':'green'}`}>{pending.includes(m.id)?'Chưa kết nối':partial.includes(m.id)?'Bản cơ bản':'Đã có thao tác'}</span></td><td>{m.priority}</td></tr>)}</Table></Panel></>}
 {tab==='audit'&&<Panel title="100 thao tác gần nhất"><Table headings={['Thời điểm','Người thao tác','Hành động','Chi tiết']} empty={!data.audit.length}>{data.audit.map(a=><tr key={a.id}><td>{new Date(a.at).toLocaleString('vi-VN')}</td><td>{a.actor}</td><td>{a.action}</td><td>{a.detail}</td></tr>)}</Table></Panel>}
 {tab==='settings'&&<Panel title="Chính sách giữ chỗ"><div className="panel-body"><div className="summary-line"><span>Thời gian giữ chỗ</span><b>{data.settings.holdMinutes} phút</b></div><div className="summary-line"><span>Tiền cọc</span><b>{data.settings.depositPercent}%</b></div><div className="summary-line"><span>Tỷ lệ hoàn tham khảo</span><b>{data.settings.cancelRefundPercent}%</b></div><p className="subtitle" style={{margin:'14px 0'}}>Khoản hoàn vẫn cần quản lý xác nhận; chưa tự áp dụng chính sách theo thời điểm hủy.</p><Button className="primary" onClick={()=>show({type:'settings'})}>Sửa chính sách</Button></div></Panel>}
 </>;
}
