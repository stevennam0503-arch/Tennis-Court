import {createServer} from '../frontend/node_modules/vite/dist/node/index.js';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../frontend',import.meta.url));
const require=createRequire(new URL('../frontend/package.json',import.meta.url));
const React=require('react'),{renderToString}=require('react-dom/server');
const data=JSON.parse(await readFile(new URL('./fixtures/overview.json',import.meta.url),'utf8'));
const server=await createServer({root,server:{middlewareMode:true},appType:'custom'});
globalThis.location=new URL('http://localhost/app#calendar');
try{
 const {CourtlyContext}=await server.ssrLoadModule('/src/context.js');
 const value={data,user:data.viewer,isAdmin:true,date:new Date().toISOString().slice(0,10),setDate(){},navigate(){},show(){},notify(){},mutate(){},refresh(){}};
 const names=['Calendar','Orders','Payments','Courts','Products','Staff','Accounts','Tournaments','Reports','System','Notifications','Operations','Profile','Customer','Public','Information','Membership','MyMembership','MembershipAdmin','ContentAdmin'];
 for(const name of names){const {default:Page}=await server.ssrLoadModule(`/src/pages/${name}Page.jsx`.replace('/MyMembershipPage.jsx','/MyMembership.jsx'));const props=name==='Information'?{path:'/gioi-thieu'}:name==='Customer'?{route:'calendar'}:{};const html=renderToString(React.createElement(CourtlyContext.Provider,{value},React.createElement(Page,props)));assert(html.length>0);assert(!html.includes('NaN'));console.log('PASS render',name);}
 const {AuthenticatedApp}=await server.ssrLoadModule('/src/App.jsx');
 const admin=renderToString(React.createElement(AuthenticatedApp,{session:{user:data.viewer},onLogout(){}}));assert(admin.includes('class="sidebar'));
 const customer=renderToString(React.createElement(AuthenticatedApp,{session:{user:{...data.viewer,role:'CUSTOMER'}},onLogout(){}}));assert(customer.includes('customer-workspace'));assert(!customer.includes('class="sidebar'));
 const {PublicHeader}=await server.ssrLoadModule('/src/components/PublicLayout.jsx');
 const {Header:GuestHeader}=await server.ssrLoadModule('/src/guest/Layout.jsx');
 const {GuestContext}=await server.ssrLoadModule('/src/guest/context.jsx');
 const publicHeader=renderToString(React.createElement(PublicHeader,{onLogin(){}}));
 const guestHeader=renderToString(React.createElement(GuestContext.Provider,{value:{t:s=>s,lang:'vi',setLang(){},navigate(){},route:'about',login(){},logout(){}}},React.createElement(GuestHeader)));
 for(const [name,html]of [['public',publicHeader],['guest',guestHeader]]){
  for(const label of ['Bảng giá','Giải đấu','Hội viên'])assert(html.includes(label),`${name} header includes ${label}`);
 }
 assert(publicHeader.includes('href="/bang-gia"')&&publicHeader.includes('href="/giai-dau"')&&publicHeader.includes('href="/membership"'));
 console.log('PASS pricing, tournaments and membership in both public headers.');
 console.log('PASS admin shell retained; customer shell independent.');
}finally{await server.close();}
