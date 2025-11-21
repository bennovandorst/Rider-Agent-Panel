import express from 'express';
import { generateCodeVerifier, generateCodeChallenge, generateState, buildAuthorizationUrl, exchangeCodeForToken, decodeJwtPayload } from '../utils/client.js';
import { URL } from 'url';

const router = express.Router();

const COOKIE_OPTIONS = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 4 };

const { maxAge, ...CLEAR_COOKIE_OPTIONS } = COOKIE_OPTIONS;

router.get('/login', async (req, res) => {
    const redirectUri = new URL('/auth/callback', `${req.protocol}://${req.get('host')}`).toString();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState();

    res.cookie('pkce_verifier', codeVerifier, { ...COOKIE_OPTIONS });
    res.cookie('pkce_state', state, { ...COOKIE_OPTIONS });

    const url = buildAuthorizationUrl({ redirectUri, state, codeChallenge });
    res.redirect(url);
});

router.get('/callback', async (req, res) => {
    const { code, state } = req.query;
    const savedState = req.cookies['pkce_state'];
    const codeVerifier = req.cookies['pkce_verifier'];

    if (!code || !state || !savedState || state !== savedState) {
        return res.status(400).send('Invalid OIDC callback state or missing code');
    }

    try {
        const redirectUri = new URL('/auth/callback', `${req.protocol}://${req.get('host')}`).toString();
        const tokenRes = await exchangeCodeForToken({ code, redirectUri, codeVerifier });

        const idToken = tokenRes.id_token;
        const accessToken = tokenRes.access_token;
        const payload = decodeJwtPayload(idToken) || decodeJwtPayload(accessToken);

         res.cookie('id_token', idToken, { ...COOKIE_OPTIONS });
         res.cookie('access_token', accessToken, { ...COOKIE_OPTIONS });
         res.cookie('user_claims', JSON.stringify(payload || {}), { ...COOKIE_OPTIONS });

         res.redirect('/');
     } catch (err) {
         console.error('OIDC callback error', err);
         return res.status(500).send('Failed to exchange code for token');
     }
});

router.get('/logout', (req, res) => {
    const idToken = req.cookies && req.cookies.id_token;

    try {
        res.clearCookie('id_token', CLEAR_COOKIE_OPTIONS);
        res.clearCookie('access_token', CLEAR_COOKIE_OPTIONS);
        res.clearCookie('user_claims', CLEAR_COOKIE_OPTIONS);
        res.clearCookie('pkce_state', CLEAR_COOKIE_OPTIONS);
        res.clearCookie('pkce_verifier', CLEAR_COOKIE_OPTIONS);
    } catch (e) {
        res.clearCookie('id_token');
        res.clearCookie('access_token');
        res.clearCookie('user_claims');
        res.clearCookie('pkce_state');
        res.clearCookie('pkce_verifier');
    }

    const issuer = process.env.AUTH_SERVER_URL;
    const endSession = `${issuer.replace(/\/$/, '')}/connect/logout`;

    try {
        const params = new URLSearchParams();
        if (idToken) params.set('id_token_hint', idToken);

        const url = params.toString() ? `${endSession}?${params.toString()}` : endSession;
        return res.redirect(url);
    } catch (e) {
        return res.redirect('/');
    }
});

router.get('/status', (req, res) => {
    if (process.env.AUTH_ENABLED === 'false') {
        return res.json({ authenticated: true, user: {} });
    }

    const userClaims = req.cookies && req.cookies.user_claims;
    if (!userClaims) {
        return res.json({ authenticated: false });
    }

    try {
        const claims = JSON.parse(userClaims);
        return res.json({ authenticated: true, user: claims });
    } catch (e) {
        return res.json({ authenticated: false });
    }
});

export default router;
