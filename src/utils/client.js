import 'dotenv/config';
import crypto from 'crypto';

function buildAuthEndpoint() {
    const authServer = process.env.AUTH_SERVER_URL;
    if (!authServer) return '';
    return `${authServer.replace(/\/$/, '')}/connect/authorize`;
}

function buildTokenEndpoint() {
    const authServer = process.env.AUTH_SERVER_URL;
    if (!authServer) return '';
    return `${authServer.replace(/\/$/, '')}/connect/token`;
}

function getClientId() {
    return process.env.AUTH_CLIENT_ID;
}

const DEFAULT_SCOPES = 'openid profile';

function base64url(buffer) {
    return buffer.toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

export function generateCodeVerifier() {
    return base64url(crypto.randomBytes(32));
}

export async function generateCodeChallenge(verifier) {
    const hash = crypto.createHash('sha256').update(verifier).digest();
    return base64url(hash);
}

export function generateState() {
    return base64url(crypto.randomBytes(16));
}

export function buildAuthorizationUrl({ redirectUri, state, codeChallenge, scope = DEFAULT_SCOPES }) {
    const AUTH_ENDPOINT = buildAuthEndpoint();

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: getClientId(),
        redirect_uri: redirectUri,
        scope,
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
    });

    return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeCodeForToken({ code, redirectUri, codeVerifier }) {
    const TOKEN_ENDPOINT = buildTokenEndpoint();
    if (!TOKEN_ENDPOINT) throw new Error('AUTH_SERVER_URL is not configured');

    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: getClientId(),
        code_verifier: codeVerifier
    });

    const res = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
    });

    if (!res.ok) {
        const txt = await res.text();
        const err = new Error('Token endpoint returned error: ' + res.status + ' ' + txt);
        err.status = res.status;
        throw err;
    }

    return res.json();
}

export function decodeJwtPayload(token) {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    try {
        const payload = parts[1];
        const buf = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
        return JSON.parse(buf.toString('utf8'));
    } catch (e) {
        return null;
    }
}

export function getClientConfig() {
    const clientId = getClientId();
    const authServer = process.env.AUTH_SERVER_URL;
    return {
        clientId: clientId || null,
        authServer,
        tokenEndpoint: authServer ? `${authServer.replace(/\/$/, '')}/connect/token` : '',
    };
}
