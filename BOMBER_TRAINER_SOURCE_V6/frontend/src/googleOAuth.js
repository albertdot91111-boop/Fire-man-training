import pb from '@/lib/pocketbaseClient';

// Manual OAuth2 code flow (used because the FastAPI proxy does not forward the
// PocketBase realtime WebSocket that the all-in-one `authWithOAuth2` needs).
// Redirect URL registered in Google must be exactly: <origin>/oauth/callback
export async function beginGoogleLogin(returnTo = '/') {
  const methods = await pb.collection('users').listAuthMethods();
  // Support both old (authProviders) and new (oauth2.providers) response shapes.
  const providers = methods?.oauth2?.providers || methods?.authProviders || [];
  const provider = providers.find((p) => p.name === 'google');
  if (!provider) {
    throw new Error("Google OAuth2 no està activat a PocketBase.");
  }
  const redirectURL = `${window.location.origin}/oauth/callback`;
  sessionStorage.setItem('pb_oauth_provider', JSON.stringify(provider));
  sessionStorage.setItem('pb_oauth_returnTo', returnTo || '/');
  const authUrl = provider.authURL || provider.authUrl;
  window.location.assign(authUrl + encodeURIComponent(redirectURL));
}
