/*server.js*/
const express = require('express');
const https = require('https');
const fs = require('fs');
const app = express();
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const { v4: uuidV4 } = require('uuid');

const connectDB = require('./config/database');
const User = require('./models/User');
const { requireAuth } = require('./middleware/auth');

const dotenv = require("dotenv");
dotenv.config();

// Connexion à la base de données MongoDB
connectDB();

app.use(express.urlencoded({ extended: true })); // Pour parser les formulaires

// Configuration des sessions
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: true, // Changé à true
    saveUninitialized: true, // Changé à true
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 24 * 60 * 60 // 1 jour
    })
}));

// --- CERTIFICATS ---
const options = {
  key: fs.readFileSync('certificats/localhost-key.pem'),
  cert: fs.readFileSync('certificats/localhost.pem')
}
const server = https.createServer(options, app);
const io = require('socket.io')(server);
const { ExpressPeerServer } = require('peer');
const peerServer = ExpressPeerServer(server, { debug: true });

app.use('/peerjs', peerServer);
app.set('view engine', 'ejs');
app.use(express.static('public'));

// --- ROUTES AUTHENTIFICATION ---
app.get('/login', (req, res) => res.render('login'));
app.get('/register', (req, res) => res.render('register'));

app.post('/register', async (req, res) => {
    try {
      const { username, password, confirmPassword } = req.body;

        if (password !== confirmPassword) {
            return res.render('register', {
                title: 'Inscription - CIRAS MEET',
                error: 'Les mots de passe ne correspondent pas'
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ username: username, password: hashedPassword });
        res.redirect('/login');
    } catch (e) { res.redirect('/register'); }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username: username });
  if (user && await bcrypt.compare(password, user.password)) {
      req.session.userId = user._id;
      req.session.username = user.username;
      res.redirect('/home');
  } else {
      res.redirect('/login');
  }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- ROUTES APP ---
app.get('/', (req, res) => {
    res.render('index', { userId: req.session.userId });
});

// Afficher le Dashboard
app.get('/home', requireAuth, (req, res) => {
    res.render('dashboard', { username: req.session.username });
});

// Route spécifique pour créer une salle (utilisée par le bouton "Nouvelle Réunion")
app.post('/create-room', requireAuth, (req, res) => {
    res.redirect(`/${uuidV4()}`);
});

app.get('/:room', requireAuth, (req, res) => {
    res.render('room', { roomId: req.params.room, username: req.session.username });
});

// --- SOCKET IO ---
io.on('connection', socket => {
    socket.on('join-room', (roomId, userId, username) => {
        socket.join(roomId);
        // On envoie aussi le username
        socket.to(roomId).emit('user-connected', userId, username);

        socket.on('message', (message) => {
            io.to(roomId).emit('createMessage', message, username);
        });

        // Fonctionnalité: Main levée
        socket.on('raise-hand', () => {
            io.to(roomId).emit('hand-raised', userId, username);
        });

        // Fonctionnalité: Tableau Blanc
        socket.on('draw', (data) => {
            socket.to(roomId).emit('draw-line', data);
        });
        
        socket.on('clear-board', () => {
            io.to(roomId).emit('board-cleared');
        })

        socket.on('disconnect', () => {
            socket.to(roomId).emit('user-disconnected', userId);
        });
    });
});

const PORT = process.env.PORT || 3030;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur sécurisé démarré sur https://localhost:${PORT}`);
});
