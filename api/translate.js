const { getVercelOidcToken } = require('@vercel/oidc');

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT_ID || 'clut-514720';
const PROJECT_NUMBER = '985633124945';
const SUBJECT = 'owner:county-count:project:clut:environment:production';
const PROVIDER = `//iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/clut-vercel/providers/vercel-clut`;
const SERVICE_ACCOUNT = 'clut-translation@clut-514720.iam.gserviceaccount.com';
const ALLOWED = new Set(['en','es','fr','de','it','pt','ru','ja','ko','zh','ar','hi','id','ur','pa']);

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `Google API error (${response.status})`);
  return data;
}

async function accessToken() {
  const oidc = await getVercelOidcToken();
  if (!oidc) throw new Error('Vercel OIDC is unavailable. Enable OIDC in project security settings.');
  const payload = JSON.parse(Buffer.from(oidc.split('.')[1], 'base64url').toString('utf8'));
  if (payload.sub !== SUBJECT || payload.iss !== 'https://oidc.vercel.com/county-count') {
    throw new Error('This deployment is not authorized for CLUT production translation.');
  }
  const exchanged = await jsonFetch('https://sts.googleapis.com/v1/token', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      audience: PROVIDER, grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
      requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
      subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt',
      subjectToken: oidc, scope: 'https://www.googleapis.com/auth/cloud-platform'
    })
  });
  const impersonated = await jsonFetch(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${SERVICE_ACCOUNT}:generateAccessToken`,
    {method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${exchanged.access_token}`},
     body:JSON.stringify({scope:['https://www.googleapis.com/auth/cloud-platform'],lifetime:'900s'})}
  );
  return impersonated.accessToken;
}

module.exports = async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  try {
    const {text,source='auto',target} = req.body || {};
    if (typeof text !== 'string' || !text.trim() || text.length > 10000 ||
        !ALLOWED.has(target) || (source !== 'auto' && !ALLOWED.has(source))) {
      return res.status(400).json({error:'Provide text (up to 10,000 characters) and valid languages.'});
    }
    const token = await accessToken();
    const body = {contents:[text],mimeType:'text/plain',targetLanguageCode:target};
    if (source !== 'auto') body.sourceLanguageCode = source;
    const data = await jsonFetch(`https://translation.googleapis.com/v3/projects/${PROJECT}:translateText`,{
      method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
      body:JSON.stringify(body)
    });
    const translation = data.translations?.[0];
    if (!translation?.translatedText) throw new Error('No translation returned.');
    return res.status(200).json({translatedText:translation.translatedText,detectedSourceLanguage:translation.detectedLanguageCode || source});
  } catch(e) {
    console.error('Translation error:', e.message);
    return res.status(502).json({error:'Translation service unavailable. Check Google Cloud authentication and API permissions.'});
  }
};
