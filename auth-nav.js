// NEAR's persistent non-game navigation. No sessions, member reads or API writes.
const paths = {
  near: '<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5Z"/>',
  friends: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2M17 4a4 4 0 0 1 0 7M22 21v-2a4 4 0 0 0-3-4"/>',
  chat: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/>',
  reviews: '<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
};
const labels={near:'หาเพื่อน',friends:'เพื่อน',chat:'แชท',reviews:'ความคิดเห็น',profile:'โปรไฟล์'};
const nav=document.createElement('nav');nav.className='auth-navigation';nav.setAttribute('aria-label','เมนูหลัก');
nav.innerHTML=Object.entries(labels).map(([tab,label])=>`<a href="/?tab=${tab}" aria-label="${label}" title="${label}"><svg viewBox="0 0 24 24" aria-hidden="true">${paths[tab]}</svg></a>`).join('');
document.body.append(nav);
