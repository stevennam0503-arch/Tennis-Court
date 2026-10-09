import React,{useState} from 'react';
import {useCourtly} from '../context';
import {Title,Panel,Table,Chip,Button,Tabs} from '../components/UI';
import {money} from '../utils/format';
export default function ProductsPage(){
 const {data,show}=useCourtly();const [tab,setTab]=useState('DRINK'),[query,setQuery]=useState('');
 const list=data.products.filter(p=>p.type===tab&&p.name.toLowerCase().includes(query.toLowerCase()));
 const collection=tab==='DRINK'?'drinks':'rentals';
 return <><Title subtitle="Hàng bán và thiết bị cho thuê theo giờ." action={<Button className="primary" onClick={()=>show({type:'entity',collection})}>Thêm sản phẩm</Button>}>Đồ uống & đồ thuê</Title><Tabs options={[["DRINK","Đồ uống"],["RENTAL","Thiết bị thuê"]]} value={tab} onChange={setTab}/><Panel title="Danh mục sản phẩm" action={<div className="tools"><input className="search" placeholder="Tìm sản phẩm" value={query} onChange={e=>setQuery(e.target.value)}/></div>}><Table headings={['Sản phẩm','Đơn giá','Tồn kho','Trạng thái','']} empty={!list.length}>{list.map(p=><tr key={p.id}><td className="name">{p.name}</td><td>{money(p.price)}{p.type==='RENTAL'&&<small>/ giờ</small>}</td><td>{p.stock} {p.stock<10&&<span className="chip orange">Tồn thấp</span>}</td><td><Chip status={p.status}/></td><td><Button className="sm" onClick={()=>show({type:'entity',collection,row:p})}>Chỉnh sửa</Button></td></tr>)}</Table></Panel><div className="notice" style={{marginTop:20}}>Bán hàng, thuê và trả thiết bị tại chi tiết đơn đặt sân. Kho được kiểm tra trong transaction khi thêm vào đơn.</div></>;
}
