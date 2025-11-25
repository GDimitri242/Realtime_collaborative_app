# CIRAS MEET - Plateforme de visioconférence collaborative

![NodeJS](https://img.shields.io/badge/Node.js-14.x-green) ![Socket.io](https://img.shields.io/badge/Socket.io-Realtime-black) ![WebRTC](https://img.shields.io/badge/WebRTC-PeerJS-blue) ![MongoDB](https://img.shields.io/badge/Database-MongoDB-forestgreen)

**CIRAS MEET** est une application web de visioconférence en temps réel conçue pour faciliter le travail collaboratif à distance. Elle combine des fonctionnalités vidéo classiques avec des outils d'interaction avancés comme un tableau blanc partagé et la gestion de prise de parole.

## Fonctionnalités principales

* **🔐 Authentification Sécurisée :** Inscription et connexion des utilisateurs via MongoDB (mots de passe hachés).
* **📹 Appels Vidéo & Audio :** Communication fluide en pair-à-pair (P2P) via WebRTC.
* **🖥️ Partage d'Écran :** Possibilité pour les participants de présenter leur écran entier ou une fenêtre spécifique.
* **🎨 Tableau Blanc Collaboratif :** Zone de dessin interactive synchronisée en temps réel pour tous les participants.
* **✋ Gestion de Parole :** Fonctionnalité "Lever la main" avec notifications visuelles.
* **💬 Chat Intégré :** Messagerie instantanée durant la réunion.
* **🌙 Interface Dark Mode :** Design moderne et reposant pour les yeux.

## Stack technique

**Backend :**
* Node.js
* Express.js
* Socket.io (Signaling & événements temps réel)
* MongoDB & Mongoose (Base de données)
* PeerJS Server (Gestion des IDs WebRTC)

**Frontend :**
* EJS (Moteur de template)
* Bootstrap 4 (UI/UX)
* Vanilla JS & jQuery
* Canvas API (Tableau blanc)

## Installation et démarrage

Suivez ces instructions pour lancer le projet localement.

### 1. Prérequis
* [Node.js](https://nodejs.org/) installé.
* [MongoDB](https://www.mongodb.com/) installé et en cours d'exécution localement (port 27017).

### 2. Cloner le dépôt
```bash
git clone [https://github.com/votre-nom-utilisateur/ciras-meet.git](https://github.com/votre-nom-utilisateur/ciras-meet.git)
cd ciras-meet
```

### 3. Installer les dépendances
```bash
npm install
```

### 4. Configuration SSL
L'application utilise HTTPS pour fonctionner avec WebRTC. Vous devez générer des certificats auto-signés.
Créez un dossier certificats à la racine du projet.
Générez les clés (si vous avez OpenSSL/Git Bash) :

```bash
mkdir certificats
cd certificats
openssl req -x509 -newkey rsa:4096 -keyout localhost-key.pem -out localhost.pem -days 365 -nodes
```

Note : Si vous ne pouvez pas générer de clés, vous pouvez commenter la partie HTTPS dans server.js et utiliser http pour le développement (mais la vidéo risque de ne pas fonctionner sur certains navigateurs).

### 5. Démarrer le serveur
```bash
npm start
# Ou pour le mode développement avec nodemon
npm run dev
```

Accédez à l'application via : https://localhost:3030

Note : Votre navigateur affichera une alerte de sécurité car le certificat est auto-signé. Vous devez accepter le risque/continuer pour accéder au site (ex: "Avancé" -> "Continuer vers localhost").

## Structure du projet

├── certificats/       # Clés SSL (à générer)

├── public/            # Fichiers statiques (CSS, JS client, Images)

│   ├── script.js      # Logique client (Socket.io, PeerJS, Canvas)

│   └── style.css      # Styles globaux

├── views/             # Templates EJS

│   ├── dashboard.ejs  # Dashboard utilisateur

│   ├── index.ejs      # Page d'accueil publique

│   ├── room.ejs       # Salle de réunion

│   ├── login.ejs      # Page de connexion

│   └── register.ejs   # Page d'inscription

├── server.js          # Serveur principal (Express, Socket, Mongo)

└── package.json       # Dépendances

## Contribution
Les contributions sont les bienvenues !

Forkez le projet.
Créez votre branche de fonctionnalité (git checkout -b feature/AmazingFeature).
Commitez vos changements (git commit -m 'Add some AmazingFeature').
Push vers la branche (git push origin feature/AmazingFeature).
Ouvrez une Pull Request.

## Auteur
Développé dans le cadre d'un projet académique.


