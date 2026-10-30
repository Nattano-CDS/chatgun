// A build-time, fictional-only recovery contract, never a live-service flag override.
export async function loadSocialConfig(loadLive, fetchAsset = fetch) {
  try { return await loadLive(); }
  catch (originalError) {
    try {
      const response = await fetchAsset('/assets/demo/canary-runtime.json', {
        cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw originalError;
      const marker = await response.json();
      if (marker.mode !== 'fictional-only-v1' || marker.demoBatch !== 'chatgun-browser-demo-v1') throw originalError;
      // Do not accept remotely supplied capability flags, sessions, or provider data.
      return {
        socialAppEnabled: false, adultOnboardingEnabled: false,
        publicDiscoveryEnabled: false, friendRequestsEnabled: false,
        messagingEnabled: false, mediaUploadEnabled: false,
        mediaQuarantineEnabled: true, ratingsEnabled: false,
        identityVerificationEnabled: false, sensitiveContentEnabled: false,
        gameEnabled: false, emailOtpEnabled: false, mobileOtpEnabled: false,
        demoModeEnabled: true, demoAutoStartEnabled: true,
      };
    } catch { throw originalError; }
  }
}
