let socket, peer, monStreamLocal, streamPartageEcran;
let connexionPeers = new Map();
let audioActif = true, videoActif = true, partageEcranActif = false;

//Les éléments du DOM
let maVideo, videosDistantes, listeParticipants, boutonAudio;
let boutonVideo, boutonPartageEcran, boutonQuitter;
let messageStatut, videoPartageEcran, partageEcranContainer;

let partageModal, boutonPartageLien, lienInvitation, copierLien, copierCode, partageEmail , toast, toastMessage;


function initialiserReunion(idReunion, nomUtilisateur) {
    console.log('Initialisation de la réunion : ', idReunion, nomUtilisateur);
    
    // Vérifier que les paramètres sont valides
    if (!idReunion || !nomUtilisateur) {
        console.error('Paramètres manquants pour initialiser la réunion');
        afficherMessage('Erreur: paramètres de réunion manquants', 'error');
        return;
    }
    
    // Sauvegarder les variables globalement
    window.idReunionGlobal = idReunion;
    window.nomUtilisateurGlobal = nomUtilisateur;
    
    //Obtenir les références aux éléments du DOM
    obtenirElementsDOM();
    
    //configurer les gestionnaires d'événements
    configurerGestionnaires();

    //Initialiser Socket.io
    initialiserSocket();

    //Initialiser Peer
    initialiserPeer(idReunion, nomUtilisateur);

    //Obtenir le stream local (audio/vidéo)
    obtenirStreamLocal();
}

function obtenirElementsDOM() {
    maVideo = document.getElementById('maVideo');
    videosDistantes = document.getElementById('videosDistantes');
    listeParticipants = document.getElementById('listeParticipants');
    boutonAudio = document.getElementById('boutonAudio');
    boutonVideo = document.getElementById('boutonVideo');
    boutonPartageEcran = document.getElementById('boutonPartageEcran');
    boutonQuitter = document.getElementById('boutonQuitter');
    messageStatut = document.getElementById('messageStatut');
    videoPartageEcran = document.getElementById('videoPartageEcran');
    partageEcranContainer = document.getElementById('partageEcranContainer');

    partageModal = document.getElementById('partageModal');
    boutonPartageLien = document.getElementById('boutonPartageLien');
    lienInvitation = document.getElementById('lienInvitation');
    copierLien = document.getElementById('copierLien');
    copierCode = document.getElementById('copierCode');
    partageEmail = document.getElementById('partageEmail');
    toast = document.getElementById('toast');
    toastMessage = document.getElementById('toastMessage');
}

function configurerGestionnaires() {

    //Gestionnaire pour le bouton audio
    boutonAudio.addEventListener('click', function () {
        audioActif = !audioActif;

        if(monStreamLocal) {
            const pistesAudio = monStreamLocal.getAudioTracks();
            pistesAudio.forEach(piste => piste.enable = audioActif);
        }

        mettreAJourBoutonAudio();

        if(socket) {
            socket.emit('basculer-audio', {
                idReunion: window.idReunionGlobal,
                audioActive: audioActif
            });
        }
    });

    //Gestionnaire pour le bouton vidéo
    boutonVideo.addEventListener('click', function () {

        videoActif = !videoActif;

        if(monStreamLocal) {
            const pistesVideo = monStreamLocal.getVideoTracks();
            pistesVideo.forEach(piste => {
                piste.enabled = videoActif;
            });
        }

        mettreAJourBoutonVideo();

        if(socket) {
            socket.emit('basculer-video', {
                idReunion: window.idReunionGlobal,
                videoActive: videoActif
            });
        }
    });

    //Gestionnaire pour le partage d'écran
    boutonPartageEcran.addEventListener('click', function () {
        if(partageEcranActif) {
            arreterPartageEcran();
        } else {
            commencerPartageEcran();
        }
    });

    /*/Gestionnaire pour le partage d'écran
    boutonQuitter.addEventListener('click', function () {
        if(confirm('Voulez-vous vraiment quitter la réunion ?')) {
            window.location.href = '/';
        }
    });*/

    // Gestion du partage de lien
    document.addEventListener('DOMContentLoaded', function() {
    
        // Fonction pour afficher le toast
        function afficherToast(message) {
            toastMessage.textContent = message;
            toast.classList.remove('hidden');
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 3000);
        }

        // Ouvrir le modal de partage
        boutonPartageLien.addEventListener('click', async function() {
            try {
                // Récupérer le lien d'invitation depuis le serveur
                const response = await fetch(`/reunion/${window.idReunionGlobal}/invitation`);
                const data = await response.json();
                
                if (data.success) {
                lienInvitation.value = data.lien;
                partageModal.showModal();
                } else {
                throw new Error(data.error);
                }
            } catch (error) {
                console.error('Erreur lors de la génération du lien:', error);
                afficherToast('Erreur lors de la génération du lien');
            }
        });

        // Copier le lien d'invitation
        copierLien.addEventListener('click', async function() {
            try {
                await navigator.clipboard.writeText(lienInvitation.value);
                afficherToast('Lien copié dans le presse-papier !');
                
                // Animation de confirmation
                copierLien.innerHTML = `
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Copié !
                `;
                
                setTimeout(() => {
                copierLien.innerHTML = `
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copier
                `;
                }, 2000);
                
            } catch (err) {
                // Fallback pour les navigateurs qui ne supportent pas clipboard API
                lienInvitation.select();
                document.execCommand('copy');
                afficherToast('Lien copié !');
            }
        });

        // Copier le code de la réunion
        copierCode.addEventListener('click', async function() {
            try {
                await navigator.clipboard.writeText('<%= idReunion %>');
                afficherToast('Code de réunion copié !');
            } catch (err) {
                afficherToast('Erreur lors de la copie du code');
            }
        });

        // Partager par email
        partageEmail.addEventListener('click', function() {
            const sujet = `Invitation à la réunion ${window.idReunionGlobal}`;
            const corps = `Je vous invite à rejoindre ma réunion sur CIRAS MEET.\n\nRejoignez la réunion ici : ${lienInvitation.value}\n\nCode de la réunion : ${window.idReunionGlobal}`;
            
            const lienEmail = `mailto:?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
            window.open(lienEmail, '_blank');
        });

        // Partage natif (Web Share API)
        if (navigator.share) {
        document.getElementById('partageNative').disabled = false;
        document.getElementById('partageNative').textContent = 'Partager';
        
        document.getElementById('partageNative').addEventListener('click', async function() {
            try {
            await navigator.share({
                title: `Rejoindre la réunion ${window.idReunionGlobal}`,
                text: 'Rejoignez ma réunion sur CIRAS MEET',
                url: lienInvitation.value
            });
            } catch (err) {
            console.log('Partage annulé');
            }
        });
        }
    });
}

function initialiserSocket() {
    socket = io();

    //Gestionnaire pour un nouvel utilisateur
    socket.on('nouvel-utilisateur', function (data) {
        console.log("Un nouvel utilisateur s'est connecté : ", data);
        afficherMessage(`${data.nom} a rejoint la réunion`);

        //Appeler le nouvel utilisateur
        setTimeout(()=> {
            appellerUtilisateur(data.peerId, data.nom);
        }, 1000);
    });

    //Gestionnaire pour les participants existants
    socket.on('participants-existants', function (participants) {
        console.log("Participants existants : ", participants);
        participants.forEach(participants => {
            setTimeout(()=> {
                appellerUtilisateur(data.peerId, data.nom);
            }, 1000);
        });
    });

    //Gestionnaire pour la mise à jour des participants
    socket.on('mise-a-jour-participants', function (participants) {
        mettreAJourParticipants(participants);
    });

    //Gestionnaire pour la déconnexion d'un utilisateur
    socket.on('utilisateur-deconnecte', function (data) {
        console.log("Utilisateur déconnecté : ", data);

        //Fermer la connexion peer
        if(connexionPeers.has(data.peerId)) {
            connexionPeers.get(data.peerId).close();
            connexionPeers.delete(data.peerId);
        }
        
        //Retrait de la vidéo de l'interface
        const videoElement = document.getElementById(`video-${data.peerId}`);
        if(videoElement) {
            videoElement.remove();
        }

        afficherMessage('Un utilisateur a quitté la réunion');
    });

    //Gestionnaires pour le partage d'écran
    socket.on('partage-ecran-commence', function (data) {
        afficherMessage(`${data.utilisateur} partage son écran`);
    });

    socket.on('partage-ecran-arrete', function (data) {
        afficherMessage(`${data.utilisateur} a arrêté de partager son écran`);
        masquerPartageEcran();
    });

    //Gestionnaires pour les changements audio/vidéo
    socket.on('utilisateur-audio-change', function (data) {
        console.log('Changement audio utilisateur : ', data);
    });

    socket.on('utilisateur-video-change', function (data) {
        console.log('Changement video utilisateur : ', data);
    });

}

function initialiserPeer(idReunion, nomUtilisateur) {

    console.log('Initialisation PeerJS pour la réunion:', idReunion);

    //Créer une instance de Peer
    peer = new Peer(undefined, {
        host: 'localhost', // Changé à localhost par une IP
        port: 9000,
        path: '/myapp',
        secure: true,
        debug: 3 // Mode debug pour voir les erreurs
    });

    //Lorsque le peer est prêt
    peer.on('open', function (peerId) {
        console.log('PeerJS connecté avec l\'id : ', peerId);

        // Vérifier que socket est initialisé
        if (!socket) {
            console.error('Socket non initialisé');
            setTimeout(() => {
                if (socket) {
                    rejoindreReunionSocket(idReunion, nomUtilisateur, peerId);
                }
            }, 1000);
        } else {
            rejoindreReunionSocket(idReunion, nomUtilisateur, peerId);
        }
    });

    peer.on('call', function (appel) {
        console.log('Appel entrant de : ', appel.peer);

        //Repondre avec notre stream local
        appel.answer(monStreamLocal);

        //Gérer le stream de l'appelant
        appel.on('stream', function (streamDistant) {
            ajouterVideoDistante(appel.peer, streamDistant);
        });

        //Sauvegrader la connexion
        connexionPeers.set(appel.peer, appel);

        //Gérer la fermeture de l'appel
        appel.on('close', function () {
            console.log('Appel fermé avec : ', appel.peer);
            retirerVideoDistante(appel.peer);
        });
    });

    peer.on('erreur', function (erreur) {
        console.error('Erreur peerJS : ', erreur);
        afficherMessage('Erreur de connexion : '+erreur.message);
    });
}

function rejoindreReunionSocket(idReunion, nomUtilisateur, peerId) {
    //Rejoindre la réunion via socket.io
    socket.emit('rejoindre-reunion', {
        idReunion: idReunion,
        nomUtilisateur: nomUtilisateur,
        peerId: peerId
    });
    
    console.log('Émission rejoindre-reunion:', {
        idReunion: idReunion,
        nomUtilisateur: nomUtilisateur,
        peerId: peerId
    });
}

function obtenirStreamLocal() {
    // Vérifier si les médias sont disponibles
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('API Media Devices non supportée');
        afficherMessage('Votre navigateur ne supporte pas l\'accès à la caméra/microphone');
        return;
    }

    navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
    })
    .then(function (stream) {
        monStreamLocal = stream;
        maVideo.srcObject = stream;

        // Mettre à jour l'interface
        mettreAJourBoutonAudio();
        mettreAJourBoutonVideo();

        console.log('Stream local obtenu avec succès');
    })
    .catch(function (erreur) {
        console.error('Erreur :', erreur.name, erreur.message);
        
        // Essayer sans audio d'abord
        navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(function (videoStream) {
            monStreamLocal = videoStream;
            maVideo.srcObject = videoStream;

            console.log('Video seule obtenue');
            audioActif = false;

            mettreAJourBoutonAudio();
            mettreAJourBoutonVideo();
        })
        .catch(function (videoError) {
            console.error('Même la vidéo seule échoue:', videoError);
            
            // Essayer sans vidéo
            navigator.mediaDevices.getUserMedia({ video: false, audio: true })
            .then(function (audioStream) {
                monStreamLocal = audioStream;

                console.log('Audio seul obtenu');
                videoActif = false;

                mettreAJourBoutonAudio();
                mettreAJourBoutonVideo();
            })
            .catch(function (audioError) {
                console.error('Tout échoue:', audioError);
                afficherMessage('Impossible d\'accéder à la caméra et/ou au microphone. Vérifiez les permissions.');
            });
        });
    });
}

function appellerUtilisateur(peerId, nom) {
    console.log('Appel vers : ', peerId, nom);

    if(!monStreamLocal) {
        console.log('Stream local pas encore prêt, prochaine tentative dans une seconde');

        setTimeout(() => appellerUtilisateur(peerId, nom), 1000);
        return ;
    }

    //Faire l'appel
    const appel = peer.call(peerId, monStreamLocal);

    //Gérer le stream de réponse
    appel.on('stream', function(streamDistant) {
        ajouterVideoDistante(peerId, streamDistant, nom);
    });

    //Sauvegarder la connexion
    connexionPeers.set(peerId, appel);

    //Gérer la fermeture
    appel.on('close', function (){
        console.log('Appel fermé avec : ', peerId);
        retirerVideoDistante(peerId);
    });

    //Gérer les erreurs
    appel.on('error', function (erreur){
        console.error('Erreur lors de l\'appel : ', erreur);
    });
}

function ajouterVideoDistante(peerId, stream, nom = 'Participant') {
    console.log('Ajout vidéo distante pour : ', peerId);
    //Vérifier si la vidéo existe déjà
    let videoContainer = document.getElementById(`video-${peerId}`);

    if(!videoContainer) {
        //créer le conteneur vidéo
        videoContainer = document.createElement('div');
        videoContainer.id = `video-${peerId}`;
        videoContainer.className = 'video-distante';

        //Créer l'élément vidéo
        const videoElement = document.createElement('video');
        videoElement.autoplay = true;
        videoElement.srcObject = stream;

        //Créer le label
        const label = document.createElement('div');
        label.className = 'video-label';
        label.textContent = nom;

        //Assembler le tout
        videoContainer.appendChild(videoElement);
        videoContainer.appendChild(label);

        //Ajout au conteneur
        videosDistantes.appendChild(videoContainer);
    } else {
        //Mettre à jour le stream existant
        const videoElement = videoContainer.querySelector('video');
        videoElement.srcObject = stream;
    }
}

function retirerVideoDistante(peerId) {
    const videoContainer = document.querySelector(`video-${peerId}`);
    if(videoContainer) {
        videoContainer.remove();
    }
}

function commencerPartageEcran() {
    navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
    })
    .then(function (stream){
        streamPartageEcran = stream;

        //Afficher le partage d'écran localement
        videoPartageEcran.srcObject = stream
        partageEcranContainer.style.display = 'block';

        
        partageEcranActif = true;
        togglePartageEcran(partageEcranActif);
        //boutonPartageEcran.textContent = 'Arrêter le partage';

        //Notifier les autres participants
        socket.emit('commencer-partage-ecran', {
            idReunion: window.idReunionGlobal
        });

        //partager l'écran avec tous les participants connectés
        connexionPeers.forEach((connexion, peerId) => {
            //Remplacer le track vidéo par celui du partage d'écran
            const sender = connexion.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            
            if(sender) {
                sender.replaceTrack(stream.getVideoTracks()[0]);
            }
        });

        stream.getVideoTracks()[0].onended = function () {
            arreterPartageEcran();
        }
    })
    .catch(function (erreur){
        console.error('Erreur partage d\'écran : ', erreur);
        afficherMessage('Impossible de partager l\'écran');
    });
}

function arreterPartageEcran() {
    if(streamPartageEcran) {
        streamPartageEcran.getTracks().forEach(track => track.stop());
        streamPartageEcran = null;
    }

    partageEcranContainer.style.display = 'none';
    partageEcranActif = false;
    togglePartageEcran(partageEcranActif);
    //boutonPartageEcran.textContent = 'Partager l\'écran';

    //Remettre la caméra
    if(monStreamLocal) {
        connexionPeers.forEach((connexion, peerId) => {
            const sender = connexion.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            if(sender && monStreamLocal.getVideoTracks()[0]) {
                sender.replaceTrack(monStreamLocal.getVideoTracks()[0]);
            }
        });
    }

    //Notifier les autres utilisateurs
    socket.emit('arreter-partage-ecran', {
        idReunion: window.idReunionGlobal
    });

    afficherMessage('Partage d\'écran arrêté');
}

function masquerPartageEcran() {
    partageEcranContainer.style.display = 'none';
}

function mettreAJourBoutonAudio() {
    if(audioActif) {
        boutonAudio.className = 'btn btn-controle btn-sm text-white border-0 lg:btn-md gap-2 bg-red-500 hover:bg-red-600';
    } else {
        boutonAudio.className = 'btn btn-controle btn-sm text-white border-0 lg:btn-md gap-2 bg-gray-500 hover:bg-gray-600';
    }
}

function mettreAJourBoutonVideo() {
    if(videoActif) {
        boutonVideo.className = 'btn btn-controle btn-sm text-white border-0 lg:btn-md gap-2 bg-red-500 hover:bg-red-600';
    } else {
        boutonVideo.className = 'btn btn-controle btn-sm text-white border-0 lg:btn-md gap-2 bg-gray-500 hover:bg-gray-600';
    }
}

function mettreAJourParticipants(participants) {
    listeParticipants.innerHTML = '';

    participants.forEach(participant => {
        const item =document.createElement('div');
        item.className = 'participants-item';

        const nom = document.createElement('span');
        nom.className = 'participants-nom';
        nom.textContent = participant.nom;

        const statut = document.createElement('div');
        statut.className = 'participants-statut';

        //Badge audio
        const badgeAudio = document.createElement('div');
        badgeAudio.className = `statut-badge ${participant.audioActive ? 'audio-actif' : 'audio-innactif'}`;
        badgeAudio.title = participant.audioActive ? 'Audio activé' : 'Audio coupé';

        //Badge vidéo
        const badgeVideo = document.createElement('div');
        badgeVideo.className = `statut-badge ${participant.videoActive ? 'video-actif' : 'video-innactif'}`;
        badgeVideo.title = participant.videoActive ? 'Vidéo activé' : 'Vidéo coupéé';

        statut.appendChild(badgeAudio);
        statut.appendChild(badgeVideo);

        item.appendChild(nom);
        item.appendChild(statut);

        listeParticipants.appendChild(item);
    });
}

function afficherMessage(message) {
    messageStatut.textContent = message;
    messageStatut.style.display = 'block';

    setTimeout(() => {
        messageStatut.style.display = 'none';
    }, 3000);
}

window.addEventListener('beforeunload', function (){
    if(peer) {
        peer.destroy();
    }

    if(socket) {
        socket.disconnect();
    }
});

