const stamp=n=>`${String(Math.floor(n)).padStart(2,'0')}:${String(Math.round((n%1)*60)).padStart(2,'0')}`;
// Segment both calendars at every tariff boundary; gaps use the court's base price.
export function tariffRows(court,prices){
 const rates=prices.filter(p=>p.court===court.id);
 const boundaries=[...new Set([6,23,...rates.flatMap(p=>[Number(p.start),Number(p.end)]).filter(n=>n>6&&n<23)])].sort((a,b)=>a-b);
 const price=(day,start)=>rates.find(p=>p.dayType===day&&Number(p.start)<=start&&Number(p.end)>start)?.price??court.price;
 return boundaries.slice(0,-1).map((start,i)=>({start:stamp(start),end:stamp(boundaries[i+1]),weekday:price('WEEKDAY',start),weekend:price('WEEKEND',start)}));
}
