const PROVIDERS=['google','facebook','line'];
export function enabledOAuthProviders(env){
  const production=String(env.DEPLOYMENT_ENVIRONMENT).trim().toLowerCase()==='production';
  const loginEnabled=String(env.OAUTH_LOGIN_ENABLED ?? '').trim().toLowerCase();
  if(loginEnabled==='false'||(production&&loginEnabled!=='true'))return [];

  // Production must always provide an exact, non-empty provider allowlist. A
  // typo must close OAuth instead of silently broadening it. Legacy isolated
  // environments retain the historical default when no allowlist is present.
  if(env.OAUTH_ENABLED_PROVIDERS===undefined)return production?[]:[...PROVIDERS];
  const configured=String(env.OAUTH_ENABLED_PROVIDERS).split(',').map(value=>value.trim().toLowerCase());
  if(production&&(configured.length===0||configured.some(value=>!value||!PROVIDERS.includes(value))))return [];
  return [...new Set(configured.filter(value=>PROVIDERS.includes(value)))];
}
