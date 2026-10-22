import React from 'react';
import {ArrowUpRight,ArrowDown,Armchair,Coffee,ShowerHead,SquareParking,Dumbbell,ClipboardCheck} from 'lucide-react';
import tree from './overview.json';
import {useGuest,Action,dateToday,zone} from './context';
import {EventCards} from './Tournaments';
const icons={'arrow-up-right':ArrowUpRight,'arrow-down':ArrowDown,armchair:Armchair,coffee:Coffee,'shower-head':ShowerHead,'square-parking':SquareParking,dumbbell:Dumbbell,'clipboard-check':ClipboardCheck};
export default function Overview(){const {t,navigate,date,setDate,setPreferredZone,data}=useGuest();
 const quick=<section className="ct-quick-book"><div className="haus-quick-intro"><span className="ct-eyebrow">LET'S PLAY</span><strong>{t('Trận tiếp theo')}<br/>{t('bắt đầu từ đây.')}</strong></div><label>{t('Ngày chơi')}<input type="date" value={date} min={dateToday()} onChange={e=>e.target.value&&setDate(e.target.value)}/></label><label>{t('Khu sân')}<select onChange={e=>setPreferredZone(e.target.value)} defaultValue="A"><option value="A">{t('Ngoài trời')}</option><option value="B">{t('Trong nhà')}</option><option value="V">VIP</option></select></label><Action onClick={()=>navigate('booking')}>{t('Tìm giờ trống')}<ArrowUpRight/></Action></section>;
 function render(n,key){if(typeof n==='string')return t(n.trim());const a=n.attrs||{};
 if(a.class==='ct-quick-book')return <React.Fragment key={key}>{quick}</React.Fragment>;
 if('data-overview-events' in a)return <EventCards key={key} events={(data?.tournaments||[]).filter(x=>x.start>=dateToday()&&x.status==='OPEN').slice(0,3)}/>;
 if('data-overview-events-empty' in a)return null;
 if(a.class==='ce-proposal'||a.class==='haus-fine-print')return null;
 if(a['data-lucide']){const I=icons[a['data-lucide']]||ArrowUpRight;return <I key={key} aria-hidden="true"/>;}
 const props={key};for(const [k,v]of Object.entries(a)){if(k==='style'||k==='hidden')continue;if(k==='class')props.className=v;else if(k==='aria-label')props[k]=t(v);else if(k==='src')props[k]=v.replace('assets/images/','/guest/');else props[k]=v===null?'':v;}
 const dest=a['data-page']||a['data-info'];if(dest)props.onClick=()=>navigate(dest==='courts'?'booking':dest==='overview'?'about':dest);
 if(a['data-choose-court'])props.onClick=()=>{setPreferredZone(a['data-choose-court'][0]);navigate('booking')};
 if('data-book-referee'in a)props.onClick=()=>navigate('booking');
 if(a.class==='ce-ref-rate')return <div className="ce-ref-rate" key={key}><strong>{t('Trọng tài theo lịch trống thực tế')}</strong><span>{t('Phí được tính riêng theo khoảng giờ đã chọn.')}</span></div>;
 return React.createElement(n.tag,props,...n.children.map((c,i)=>render(c,key+'-'+i)));}
 return render(tree,'overview');}
