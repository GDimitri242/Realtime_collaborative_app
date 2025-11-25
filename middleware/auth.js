// middleware/auth.js
const requireAuth = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    console.log('Utilisateur non authentifié, redirection vers /login');
    return res.redirect('/login');
};

module.exports = { requireAuth };