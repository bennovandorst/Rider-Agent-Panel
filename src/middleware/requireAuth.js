import { parse } from 'cookie';

export default function requireAuth(req, res, next) {
    if (process.env.AUTH_ENABLED === 'false') {
        return next();
    }

    if (req.path.startsWith('/v1/api') || req.path.startsWith('/js') || req.path.startsWith('/css') || req.path.startsWith('/socket.io')) {
        return next();
    }

    const cookies = parse(req ? req.headers.cookie || "" : document.cookie);
    const userClaims = cookies.user_claims;

    if (!userClaims) {
        return res.redirect('/auth/login');
    }

    try {
        req.user = JSON.parse(userClaims);
    } catch (e) {
        return res.redirect('/auth/login');
    }

    next();
}
