// Header navigation destinations: focused on core customer actions.
export const customerNavigation = [
  {id:'about',href:'/',label:'Giới thiệu'},
  {id:'pricing',href:'/bang-gia',label:'Bảng giá'},
  {id:'booking',href:'/dat-san',label:'Đặt sân'},
  {id:'tournaments',href:'/giai-dau',label:'Giải đấu'},
  {id:'membership',href:'/membership',label:'Hội viên'},
];

// Footer destinations: include feedback, news, and contact information.
export const customerFooterLinks = [
  ...customerNavigation,
  {id:'news',href:'/tin-tuc',label:'Tin tức'},
  {id:'feedback',href:'/feedback',label:'Feedback'},
  {id:'contact',href:'/lien-he',label:'Liên hệ'},
];
