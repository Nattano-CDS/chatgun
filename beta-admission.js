// Private invitation links use a fragment, never a URL query, cookie or localStorage.
// This transports a bearer only to the existing same-origin OAuth start endpoint.
(() => {
  const pattern=/^[A-Za-z0-9_-]{43}$/u;
  function capture(location,history){
    const url=new URL(location.href),fragment=new URLSearchParams(url.hash.slice(1));
    const queryToken=url.searchParams.has('invite'),hasFragment=fragment.has('invite');
    if(!queryToken&&!hasFragment)return {code:null,error:null};
    const values=fragment.getAll('invite');
    url.searchParams.delete('invite');if(hasFragment)url.hash='';
    history.replaceState(history.state,'',url.pathname+url.search+url.hash);
    if(queryToken||values.length!==1||!pattern.test(values[0]))return {code:null,error:'invitation_invalid'};
    return {code:values[0],error:null};
  }
  function requestFields(admission,config){
    return admission.code&&config?.oauthLoginEnabled===true&&config?.invitationOnlyRegistrationEnabled===true&&config?.newAccountRegistrationEnabled===false
      ?{invitationCode:admission.code}:{};
  }
  window.ChatgunBetaAdmission=Object.freeze({capture,requestFields});
})();
