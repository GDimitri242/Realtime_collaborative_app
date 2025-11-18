// middleware/auth.js
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        console.log('Utilisateur non authentifié, redirection vers /login');
        return res.redirect('/login');
    }
    next();
};

const requireGuest = (req, res, next) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    next();
};

module.exports = { requireAuth, requireGuest };