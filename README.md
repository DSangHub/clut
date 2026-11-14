# CLUT — Write · Translate · Copy

CLUT provides typed translation and optional browser voice dictation. The UI supports English, Spanish, French, German, Italian, Portuguese, Russian, Japanese, Korean, Chinese, Arabic, Hindi, Indonesian, Urdu and Punjabi.

## Production deployment

Deploy the repository's `main` branch to the existing Vercel project `county-count/clut`. The `api/translate.js` function requires Vercel OIDC (Team issuer) and Google Cloud Workload Identity Federation. Set `GOOGLE_CLOUD_PROJECT_ID=clut-514720` in Vercel Production environment variables.

Google Cloud project: `clut-514720`
- Workload identity pool: `clut-vercel`
- OIDC provider: `vercel-clut`
- Issuer: `https://oidc.vercel.com/county-count`
- Audience: `https://vercel.com/county-count`
- Authorized subject: `owner:county-count:project:clut:environment:production`
- Service account: `clut-translation@clut-514720.iam.gserviceaccount.com`

Enable Cloud Translation API, IAM Service Account Credentials API, and grant the service account Cloud Translation API User. Grant only the authorized production subject Workload Identity User on that service account. No private Google JSON key is required.

## Verification

1. Confirm the new Vercel deployment is built from the latest GitHub `main` commit (not a redeploy of an old upload).
2. Visit the production domain, hard refresh, and verify the Indonesian, Urdu, Punjabi language options and Speak button.
3. Translate `Hello, how are you today?` into Indonesian; the output must be genuine translated text.
4. Verify Copy to Clipboard works and Urdu text displays right-to-left.
5. If translation fails, inspect the Vercel function logs for `/api/translate` and Google Cloud IAM/OIDC configuration.

## Notes

Voice input uses the browser's SpeechRecognition implementation where available, not the Google Speech-to-Text API. Browser support and recognition language support vary. Automatic source detection applies to typed text; speech recognition defaults to the browser locale when source language is set to Auto detect.
