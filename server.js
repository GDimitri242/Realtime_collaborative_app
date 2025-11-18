const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const path = require('path');
const {PeerServer} = require('peer');
const { title } = require('process');
const { Socket } = require('dgram');
const MongoStore = require('connect-mongo');
const session = require('express-session');
const connectDB = require('./config/database');
const User = require('./models/User');
const { requireAuth, requireGuest } = require('./middleware/auth');

const app = express();

const options = {
    key : fs.readFileSync('certificats/localhost-key.pem'),
    cert: fs.readFileSync('certificats/localhost.pem')
}

const server = https.createServer(options, app);
const io = socketIo(server);

const peerServer = PeerServer(
    {
        port: 9000,
        path: '/myapp',
        ssl: options
    }
);

// Connexion à la base de données MongoDB
connectDB();

// Configuration des sessions
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: true, // Changé à true
    saveUninitialized: true, // Changé à true
    store: MongoStore.create({
        mongoUrl: 'mongodb://localhost:27017/collaboration-tp',
        ttl: 24 * 60 * 60 // 1 jour
    }),
    cookie: { 
        secure: false, // Mettez true en production avec HTTPS
        maxAge: 24 * 60 * 60 * 1000, // 24 heures
        httpOnly: true,
        sameSite: 'lax'
    }
}));

// Middleware pour rendre l'utilisateur disponible dans toutes les vues
app.use((req, res, next) => {
    res.locals.currentUser = req.session.user || null;
    //console.log('Session user:', req.session.user); // Debug
    next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const reunions = new Map();
const utilisateurs = new Map();

app.get('/favicon.ico', (req, res) => {
    res.status(204).end();
});

app.get('/', (req, res) => {
    if (req.session.user) {
        res.render('index', {
            title: 'Accueil - CIRAS MEET',
            currentUser: req.session.user
        });
    } else {
        res.render('welcome', {
            title: 'Bienvenue - CIRAS MEET'
        });
    }
});

// Routes d'authentification
app.get('/login', (req, res) => {
    res.render('login', {
        title: 'Connexion - CIRAS MEET'
    });
});

app.get('/register', (req, res) => {
    res.render('register', {
        title: 'Inscription - CIRAS MEET'
    });
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1) Vérifier si l'utilisateur existe
        const user = await User.findOne({ email });
        if (!user) {
            return res.render('login', {
                title: 'Connexion - CIRAS MEET',
                error: 'Email ou mot de passe incorrect'
            });
        }

        // 2) Vérifier le mot de passe
        const isPasswordValid = await user.correctPassword(password, user.password);
        if (!isPasswordValid) {
            return res.render('login', {
                title: 'Connexion - CIRAS MEET',
                error: 'Email ou mot de passe incorrect'
            });
        }

        // 3) Connecter l'utilisateur
        req.session.user = {
            id: user._id,
            username: user.username,
            email: user.email,
            avatar: user.avatar
        };

        // 4) Mettre à jour le statut en ligne
        await User.findByIdAndUpdate(user._id, { isOnline: true });

        res.redirect('/');

    } catch (error) {
        console.error('Erreur de connexion:', error);
        res.render('login', {
            title: 'Connexion - CIRAS MEET',
            error: 'Une erreur est survenue lors de la connexion'
        });
    }
});

app.post('/register', async (req, res) => {
    try {
        const { username, email, password, confirmPassword } = req.body;

        // 1) Validation
        if (password !== confirmPassword) {
            return res.render('register', {
                title: 'Inscription - CIRAS MEET',
                error: 'Les mots de passe ne correspondent pas'
            });
        }

        // 2) Vérifier si l'utilisateur existe déjà
        const existingUser = await User.findOne({ 
            $or: [{ email }, { username }] 
        });
        
        if (existingUser) {
            return res.render('register', {
                title: 'Inscription - CIRAS MEET',
                error: 'Un utilisateur avec cet email ou nom d\'utilisateur existe déjà'
            });
        }

        // 3) Créer un nouvel utilisateur
        const newUser = await User.create({
            username,
            email,
            password
        });

        // 4) Connecter automatiquement
        req.session.user = {
            id: newUser._id,
            username: newUser.username,
            email: newUser.email,
            avatar: newUser.avatar
        };

        res.redirect('/');

    } catch (error) {
        console.error('Erreur d\'inscription:', error);
        res.render('register', {
            title: 'Inscription - CIRAS MEET',
            error: 'Une erreur est survenue lors de l\'inscription'
        });
    }
});

app.get('/logout', async (req, res) => {
    try {
        if (req.session.user) {
            // Mettre à jour le statut hors ligne
            await User.findByIdAndUpdate(req.session.user.id, { 
                isOnline: false,
                lastSeen: new Date()
            });
        }
        
        req.session.destroy((err) => {
            if (err) {
                console.error('Erreur de déconnexion:', err);
                return res.status(500).send('Erreur lors de la déconnexion');
            }
            res.redirect('/');
        });
    } catch (error) {
        console.error('Erreur de déconnexion:', error);
        res.redirect('/');
    }
});

app.post('/creer-reunion', requireAuth, (req, res) => {
    const nomUtilisateur = req.session.user.username;
    const userId = req.session.user.id;
    const idReunion = genererIdReunion();

    // Créer une nouvelle réunion avec infos d'invitation
    reunions.set(idReunion, {
        id: idReunion,
        createur: nomUtilisateur,
        participants: [{
            id: `creator-${Date.now()}`,
            nom: nomUtilisateur,
            userId: userId,
            audioActive: true,
            videoActive: true,
            peerId: null
        }],
        partageEcran: null,
        dateCreation: new Date(),
        invitations: [], // Nouveau: stocker les emails invités
        lienPublic: true, // Si la réunion est accessible via lien
        motDePasse: null // Optionnel: pour réunions privées
    });

    // Sauvegarder en session
    req.session.reunions = reunions;

    res.redirect(`/reunion/${idReunion}?nom=${encodeURIComponent(nomUtilisateur)}`);
});

// Route pour générer le lien d'invitation
app.get('/reunion/:id/invitation', requireAuth, (req, res) => {
    const idReunion = req.params.id;
    
    if (!reunions.has(idReunion)) {
        return res.status(404).json({ error: 'Réunion non trouvée' });
    }

    const reunion = reunions.get(idReunion);
    
    // Vérifier que l'utilisateur fait partie de la réunion
    const utilisateurEstDansReunion = reunion.participants.some(
        p => p.nom === req.session.user.username
    );

    if (!utilisateurEstDansReunion && reunion.createur !== req.session.user.username) {
        return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Générer le lien d'invitation
    const lienInvitation = `${req.protocol}://${req.get('host')}/rejoindre/${idReunion}`;
    
    res.json({
        success: true,
        lien: lienInvitation,
        idReunion: idReunion,
        createur: reunion.createur,
        dateCreation: reunion.dateCreation
    });
});

// Route pour rejoindre via lien d'invitation
app.get('/rejoindre/:id', requireAuth, (req, res) => {
    const idReunion = req.params.id;
    
    if (!reunions.has(idReunion)) {
        return res.redirect('/?erreur=reunion-introuvable');
    }

    const nomUtilisateur = req.session.user.username;
    res.redirect(`/reunion/${idReunion}?nom=${encodeURIComponent(nomUtilisateur)}`);
});

app.post('/rejoindre-reunion', requireAuth, (req, res) => {
    
    const nomUtilisateur = req.session.user.username;
    const {idReunion} = req.body;

    if(reunions.has(idReunion)) {
        res.redirect(`/reunion/${idReunion}?nom=${encodeURIComponent(nomUtilisateur)}`);
    } else {
        res.render('index', {
            title:'Accueil - Ciras Meet',
            erreur:'Réunion introuvable',
        });
    }
});

app.get('/reunion/:id', requireAuth, (req, res) => {
    const nomUtilisateur = req.session.user.username;
    const userId = req.session.user.id;
    const idReunion = req.params.id;

    console.log('Tentative d\'accès à la réunion:', idReunion, 'par:', nomUtilisateur); // Debug

    // Vérifier si la réunion existe
    if (!reunions.has(idReunion)) {
        console.log('Réunion non trouvée:', idReunion); // Debug
        return res.redirect('/?erreur=reunion-introuvable');
    }

    const reunion = reunions.get(idReunion);
    console.log('Réunion trouvée. Participants actuels:', reunion.participants.map(p => p.nom));
    
    // Vérifier si l'utilisateur est déjà dans la réunion
    const utilisateurDejaPresent = reunion.participants.some(p => p.userId === userId);
    console.log('Utilisateur déjà présent:', utilisateurDejaPresent);
    
    if (!utilisateurDejaPresent) {
        // Ajouter l'utilisateur à la réunion avec un ID temporaire
        reunion.participants.push({
            id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            nom: nomUtilisateur,
            userId: userId,
            audioActive: true,
            videoActive: true,
            peerId: null
        });
        console.log('Utilisateur ajouté à la réunion');
    }

    // Rendre la page de réunion avec les données
    res.render('reunion', {
        title: `Réunion ${idReunion} - CIRAS MEET`,
        idReunion: idReunion,
        nomUtilisateur: nomUtilisateur,
        reunion: reunion,
        currentUser: req.session.user
    });
});

/*app.post('/reunion/:id', (req, res) => {

    const idReunion = req.params.id;
    const nomUtilisateur = req.query.nom;

    if(!reunions.has(idReunion)) {
        res.redirect('/?erreur=reunion-introuvable');
    } else {
        res.render('index', {
            title:`Réunion ${idReunion}`,
            idReunion,
            nomUtilisateur,
            reunion: reunions.get(idReunion)
        });
    }
});*/

// Tests des sessions
app.get('/test-session', (req, res) => {
    res.json({
        sessionID: req.sessionID,
        user: req.session.user,
        cookie: req.session.cookie
    });
});

app.get('/debug/reunions', (req, res) => {
    const reunionsArray = Array.from(reunions.entries()).map(([id, reunion]) => ({
        id,
        createur: reunion.createur,
        participants: reunion.participants.map(p => ({
            nom: p.nom,
            userId: p.userId,
            socketId: p.id,
            peerId: p.peerId
        })),
        dateCreation: reunion.dateCreation,
        nombreParticipants: reunion.participants.length
    }));
    
    res.json({
        total: reunions.size,
        reunions: reunionsArray
    });
});

io.on('connection', (socket) => {

    console.log('Nouvelle connexion : ', socket.id);

    //Integrer une réunion
    socket.on('rejoindre-reunion', (data) => {
        const { idReunion, nomUtilisateur, peerId } = data;

        if (reunions.has(idReunion)) {
            const reunion = reunions.get(idReunion);
            
            // Mettre à jour le peerId de l'utilisateur existant
            const participantIndex = reunion.participants.findIndex(p => p.nom === nomUtilisateur);
            
            if (participantIndex !== -1) {
                // Mettre à jour l'ID socket et peerId du participant existant
                reunion.participants[participantIndex].id = socket.id;
                reunion.participants[participantIndex].peerId = peerId;
                
                console.log('Participant mis à jour avec socket ID:', socket.id);
            } else {
                // Ajouter un nouveau participant (cas de secours)
                reunion.participants.push({
                    id: socket.id,
                    peerId: peerId,
                    nom: nomUtilisateur,
                    audioActive: true,
                    videoActive: true,
                });
                console.log('Participant ajouté (ne devrait pas arriver normalement)');
            }

            utilisateurs.set(socket.id, {
                id: socket.id,
                peerId: peerId,
                nom: nomUtilisateur,
                audioActive: true,
                videoActive: true,
            });

            // Rejoindre la réunion
            socket.join(idReunion);

            // Notifier les autres participants
            socket.to(idReunion).emit('nouvel-utilisateur', {
                peerId: peerId,
                nomUtilisateur: nomUtilisateur
            });

            // Envoyer la liste des participants existants
            const participantsExistants = reunion.participants
                .filter(p => p.id !== socket.id && p.peerId)
                .map(p => ({ peerId: p.peerId, nom: p.nom }));

            socket.emit('participants-existants', participantsExistants);

            // Mettre à jour la liste des participants pour tous
            io.to(idReunion).emit('mise-a-jour-participants',
                reunion.participants.map(p => ({
                    nom: p.nom,
                    audioActive: p.audioActive,
                    videoActive: p.videoActive
                }))
            );

            console.log('Réunion rejointe avec succès');
            console.log('Participants finaux:', reunion.participants.map(p => ({ nom: p.nom, socketId: p.id })));
        } else {
            console.log('Réunion non trouvée pour socket');
            socket.emit('erreur-reunion', { message: 'Réunion introuvable' });
        }
    });

    //Gestion du partage d'écran
    socket.on('commencer-partage-ecran', (data) => {
        const {idReunion} = data;
        const utilisateur = utilisateurs.get(socket.id);

        if(reunions.has(idReunion) && utilisateur) {
            const reunion = reunions.get(idReunion);
            reunion.partageEcran = {
                utilisateur: utilisateur.nom,
                peerId: utilisateur.peerId
            }

            io.to(idReunion).emit('partage-ecran-commence', {
                utilisateur: utilisateur.nom,
                peerId: utilisateur.peerId
            });
        }
    });

    socket.on('arreter-partage-ecran', (data) => {
        const {idReunion} = data;

        if(reunions.has(idReunion)) {
            const reunion = reunions.get(idReunion);
            reunion.partageEcran = null;

            io.to(idReunion).emit('partage-ecran-arrete', {
                utilisateur: reunion.partageEcran ? reunion.partageEcran.utilisateur : 'Quelqu\'un'
            });
        }
    });

    //Gestion des flux audio/video
    socket.on('basculer-audio', (data) => {
        const {idReunion, audioActive} = data;
        const utilisateur = utilisateurs.get(socket.id);

        if(utilisateur) {
            utilisateur.audioActive = audioActive;

            socket.to(idReunion).emit('utilisateur-audio-change', {
                peerId: utilisateur.peerId,
                audioActive
            });
        }
    });

    socket.on('basculer-video', (data) => {
        const {idReunion, videoActive} = data;
        const utilisateur = utilisateurs.get(socket.id);

        if(utilisateur) {
            utilisateur.videoActive = videoActive;

            socket.to(idReunion).emit('utilisateur-video-change', {
                peerId: utilisateur.peerId,
                videoActive
            });
        }
    });

    //Quitter une reunion
    socket.on('disconnect', () => {
        const utilisateur = utilisateurs.get(socket.id);

        if (utilisateur) {
            // Retirer l'utilisateur de la réunion
            for (const [idReunion, reunion] of reunions) {
                const index = reunion.participants.findIndex(p => p.id === socket.id);

                if (index !== -1) {
                    console.log('Utilisateur retiré de la réunion:', reunion.participants[index].nom);
                    
                    reunion.participants.splice(index, 1);

                    // Notifier les autres participants
                    socket.to(idReunion).emit('utilisateur-deconnecte', {
                        peerId: utilisateur.peerId
                    });

                    // Mettre à jour la liste des participants
                    io.to(idReunion).emit('mise-a-jour-participants',
                        reunion.participants.map(p => ({
                            nom: p.nom,
                            audioActive: p.audioActive,
                            videoActive: p.videoActive
                        }))
                    );

                    console.log('Participants restants:', reunion.participants.map(p => p.nom));
                    
                    // NE PAS SUPPRIMER LA RÉUNION MÊME SI ELLE EST VIDE
                    // La réunion reste disponible pour les rechargements

                    /*Terminer la réunion si plus d'utilisateurs
                    if(reunion.participants.length === 0) {
                        //Supression de la réunion
                        reunions.delete(idReunion);
                    }*/
                    
                    break;
                }
            }

            utilisateurs.delete(socket.id);
        }
    });
});

function genererIdReunion() {
    return Math.random().toString(36).substring(2, 8).toLocaleUpperCase();
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur démarré sur https://localhost:${PORT}`);
    console.log(`Serveur PeerJs démarré sur le port 9000`);
});
