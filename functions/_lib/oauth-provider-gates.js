const PROVIDERS=['google','facebook','line'];
export function enabledOAuthProviders(env){
  if(String(env.OAUTH_LOGIN_ENABLED).toLowerCase()==='false')return [];
  // Explicit empty list is fail-closed. Legacy isolated tests retain the default.
  if(env.OAUTH_ENABLED_PROVIDERS===undefined)return [...PROVIDERS];
  return [...new Set(String(env.OAUTH_ENABLED_PROVIDERS).split(',').map(value=>value.trim().toLowerCase()).filter(value=>PROVIDERS.includes(value)))];
}
