// NEAR's persistent non-game navigation. No sessions, member reads or API writes.
const paths = {
  near: "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z\"></path>",
  chat: "<path d=\"M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719\"></path>",
  reviews: "<path d=\"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\"></path>",
  profile: "<path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\"></path><circle cx=\"12\" cy=\"7\" r=\"4\"></circle>",
};
const labels={near:'หาเพื่อน',chat:'แชท',reviews:'ความคิดเห็น',profile:'โปรไฟล์'};
const nav=document.createElement('nav');nav.className='auth-navigation';nav.setAttribute('aria-label','เมนูหลัก');
nav.innerHTML=Object.entries(labels).map(([tab,label])=>`<a href="/?tab=${tab}" aria-label="${label}" title="${label}"><svg viewBox="0 0 24 24" aria-hidden="true">${paths[tab]}</svg></a>`).join('');
document.body.append(nav);
