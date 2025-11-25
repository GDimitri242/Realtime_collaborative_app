const socket = io('/');
const videoGrid = document.getElementById('video-grid');
const myPeer = new Peer(undefined, {
  path: '/peerjs',
  host: '/',
  port: '3030'
});

let myVideoStream;
let myScreenStream;

const text = $("#chat_message");
const chatButton = document.querySelector('#chatButton');
/** share */
const copyLinkBtn = document.getElementById('copy-link-btn');
const copyCodeBtn = document.getElementById('copy-code-btn');
const emailShareBtn = document.getElementById('email-share-btn');
const nativeShareBtn = document.getElementById('native-share-btn');

/**flux vidéo */
const myVideo = document.createElement('video');
myVideo.muted = true;

const peers = {}; // Stocke les connexions Peer
const peersData = {}; // Stocke les info utilisateurs

// --- INITIALISATION ---
navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {
  myVideoStream = stream;
  addVideoStream(myVideo, stream, 'Moi');

  myPeer.on('call', call => {
    call.answer(stream);
    const video = document.createElement('video');
    
    // Réception du flux distant
    call.on('stream', userVideoStream => {
      // On évite les doublons si le stream change (partage d'écran)
      if(!peers[call.peer]) { 
         addVideoStream(video, userVideoStream);
      }
    });
    // Important pour le partage d'écran: mettre à jour la src si le flux change
    call.on('stream', newStream => {
        video.srcObject = newStream;
    });
  });

  socket.on('user-connected', (userId, username) => {
    setTimeout(() => {
      connectToNewUser(userId, stream, username);
    }, 1000);
    showNotification(`${username} a rejoint la réunion`);
  });
  
  // --- CHAT ---
  /*$('#chat_message').keydown(function (e) {
    if (e.which == 13 && text.val().length !== 0) {
      socket.emit('message', text.val());
      text.val('');
    }
  });*/

  socket.on("createMessage", (message, userName) => {
    $(".messages").append(`<li class="message"><b>${userName}</b><br/>${message}</li>`);
    scrollToBottom();
  });

  // --- MAIN LEVÉE ---
  socket.on('hand-raised', (userId, username) => {
    showNotification(`✋ ${username} demande la parole !`, 'info');
    // Optionnel: Ajouter une bordure dorée à la vidéo de l'utilisateur
  });
});

socket.on('user-disconnected', userId => {
  if (peers[userId]) peers[userId].close()
})

myPeer.on('open', id => {
  socket.emit('join-room', ROOM_ID, id)
})

function connectToNewUser(userId, stream, username) {

  const call = myPeer.call(userId, stream);
  const video = document.createElement('video');

  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream, username);
  });

  call.on('close', () => {
    video.remove();
  });

  peers[userId] = call;
}

function addVideoStream(video, stream, labelName = '') {

  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => {
    video.play();
  });
  
  // Créer un wrapper pour ajouter le nom ou icônes
  const videoWrapper = document.createElement('div');
  videoWrapper.className = 'video-wrapper';
  videoWrapper.append(video);

  if(labelName) {
      const label = document.createElement('div');
      label.className = 'video-label';
      label.innerText = labelName;
      videoWrapper.append(label);
  }

  videoGrid.append(videoWrapper);
}

// --- PARTAGE D'ÉCRAN ---
const shareScreen = async () => {
    try {
        if (!myScreenStream) {
            // Démarrer le partage
            myScreenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true // Audio système si supporté
            });
            
            // Remplacer le flux vidéo envoyé aux autres
            const screenTrack = myScreenStream.getVideoTracks()[0];
            
            // Pour chaque peer connecté, remplacer la track vidéo
            for (let peerId in peers) {
                const sender = peers[peerId].peerConnection.getSenders().find((s) => s.track.kind === "video");
                sender.replaceTrack(screenTrack);
            }

            // Afficher mon propre écran dans ma vue locale
            myVideo.srcObject = myScreenStream;

            // Gérer l'arrêt du partage (bouton natif du navigateur)
            screenTrack.onended = () => {
                stopScreenShare();
            };

        } else {
            stopScreenShare();
        }
    } catch (err) {
        console.error("Erreur partage écran", err);
    }
};

const stopScreenShare = () => {
    if(myScreenStream) {
        myScreenStream.getTracks().forEach(track => track.stop());
        myScreenStream = null;
        
        // Remettre la webcam
        const videoTrack = myVideoStream.getVideoTracks()[0];
        for (let peerId in peers) {
            const sender = peers[peerId].peerConnection.getSenders().find((s) => s.track.kind === "video");
            sender.replaceTrack(videoTrack);
        }
        myVideo.srcObject = myVideoStream;
    }
}


// --- MAIN LEVÉE ---
const raiseHand = () => {
    socket.emit('raise-hand');
    showNotification("Vous avez levé la main");
}

// --- TABLEAU BLANC (CANVAS) ---
const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
let drawing = false;
let current = { x: 0, y: 0 };

// Redimensionner le canvas
const resizeCanvas = () => {
    canvas.width = window.innerWidth * 0.8;
    canvas.height = window.innerHeight * 0.8;
};
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const toggleWhiteboard = () => {
    const board = document.getElementById('whiteboard-container');
    if(board.classList.contains('d-none')) {
        board.classList.remove('d-none');
        resizeCanvas();
    } else {
        board.classList.add('d-none');
    }
};

// Dessiner
const drawLine = (x0, y0, x1, y1, color, emit) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();

    if (!emit) return;
    const w = canvas.width;
    const h = canvas.height;

    socket.emit('draw', {
        x0: x0 / w,
        y0: y0 / h,
        x1: x1 / w,
        y1: y1 / h,
        color: color
    });
};

const onMouseDown = (e) => {
    drawing = true;
    current.x = e.offsetX;
    current.y = e.offsetY;
};

const onMouseMove = (e) => {
    if (!drawing) return;
    drawLine(current.x, current.y, e.offsetX, e.offsetY, document.getElementById('colorPicker').value, true);
    current.x = e.offsetX;
    current.y = e.offsetY;
};

const onMouseUp = (e) => {
    if (!drawing) return;
    drawing = false;
    drawLine(current.x, current.y, e.offsetX, e.offsetY, document.getElementById('colorPicker').value, true);
};

// Events Canvas
canvas.addEventListener('mousedown', onMouseDown, false);
canvas.addEventListener('mouseup', onMouseUp, false);
canvas.addEventListener('mouseout', onMouseUp, false);
canvas.addEventListener('mousemove', onMouseMove, false);

// Socket Draw
socket.on('draw-line', (data) => {
    const w = canvas.width;
    const h = canvas.height;
    drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color, false);
});

const clearBoard = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit('clear-board');
}

socket.on('board-cleared', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// --- UTILITAIRES ---
const showNotification = (msg) => {
    const notif = document.createElement('div');
    notif.className = 'alert alert-info';
    notif.innerText = msg;
    document.getElementById('notification-area').appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
};

const scrollToBottom = () => {
  var d = $('.main__chat_window');
  d.scrollTop(d.prop("scrollHeight"));
}

const sendMessage = () => {
    let text = $("#chat_message");
    if (text.val().length !== 0) {
      socket.emit('message', text.val());
      text.val('');
    }
};

const muteUnmute = () => {
  const enabled = myVideoStream.getAudioTracks()[0].enabled;
  if (enabled) {
    myVideoStream.getAudioTracks()[0].enabled = false;
    setUnmuteButton();
  } else {
    setMuteButton();
    myVideoStream.getAudioTracks()[0].enabled = true;
  }
}

const playStop = () => {
  console.log('object')
  let enabled = myVideoStream.getVideoTracks()[0].enabled;
  if (enabled) {
    myVideoStream.getVideoTracks()[0].enabled = false;
    setPlayVideo()
  } else {
    setStopVideo()
    myVideoStream.getVideoTracks()[0].enabled = true;
  }
}

const setMuteButton = () => {
  const html = `
    <i class="fas fa-microphone"></i>
    <span>Mute</span>
  `
  document.querySelector('.main__mute_button').innerHTML = html;
}

const setUnmuteButton = () => {
  const html = `
    <i class="unmute fas fa-microphone-slash"></i>
    <span>Unmute</span>
  `
  document.querySelector('.main__mute_button').innerHTML = html;
}

const setStopVideo = () => {
  const html = `
    <i class="fas fa-video"></i>
    <span>Stop Video</span>
  `
  document.querySelector('.main__video_button').innerHTML = html;
}

const setPlayVideo = () => {
  const html = `
  <i class="stop fas fa-video-slash"></i>
    <span>Play Video</span>
  `
  document.querySelector('.main__video_button').innerHTML = html;
}

const toggleChat = () => {
  $('#chatModal').modal('toggle');
}

$('#chatModal').on('shown.bs.modal', function () {
  chatButton.style.color = '#ed4245'; // Rouge
  $('#chat_message').trigger('focus');
});

$('#chatModal').on('hidden.bs.modal', function () {
  chatButton.style.color = '#f2f3f5'; // Blanc cassé
});

$(function() {
  let chatIsDragging = false;
  let chatOffsetX, chatOffsetY;

  $('#chatModal .modal-header').on('mousedown', function(e) {
    chatIsDragging = true;
    const modal = $(this).closest('.modal-dialog');
    chatOffsetX = e.clientX - modal.offset().left;
    chatOffsetY = e.clientY - modal.offset().top;

    $(document).on('mousemove', function(e) {
      if (chatIsDragging) {
        const top = e.clientY - chatOffsetY;
        const left = e.clientX - chatOffsetX;
        modal.css({
          top: top + 'px',
          left: left + 'px',
          position: 'absolute'
        });
      }
    });
  });

  $(document).on('mouseup', function() {
    chatIsDragging = false;
    $(document).off('mousemove');
  });
});

const toggleInvite = () => {
  $('#inviteModal').modal('toggle');
}

// Copier le lien d'invitation
copyLinkBtn.addEventListener('click', function () {
    const inviteLink = document.getElementById('invite-link').textContent;
    navigator.clipboard.writeText(inviteLink).then(function() {
        copyLinkBtn.textContent = 'Copié!';
        setTimeout(() => {
            copyLinkBtn.textContent = 'Copier';
        }, 2000);
        //afficherToast('Lien copié dans le presse-papier');
    });
});

// Copier le code de réunion
copyCodeBtn.addEventListener('click', function () {
    const meetingCode = document.getElementById('meeting-code').textContent;
    navigator.clipboard.writeText(meetingCode).then(function() {
        copyCodeBtn.textContent = 'Copié!';
        setTimeout(() => {
            copyCodeBtn.textContent = 'Copier';
        }, 2000);
        //afficherToast('Code copié dans le presse-papier');
    });
});

// Partager par email
emailShareBtn.addEventListener('click', function () {
    const subject = 'Invitation à rejoindre la réunion CIRAS MEET';
    const body = `Je vous invite à rejoindre ma réunion sur CIRAS MEET.\n\nRejoignez la réunion ici : https://localhost:3000/rejoindre/<%= idReunion %>\n\nCode de la réunion : <%= idReunion %>`;
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
});

// Partage natif
nativeShareBtn.addEventListener('click', function () {
    if (navigator.share) {
        navigator.share({
            title: 'Rejoindre ma réunion CIRAS MEET',
            text: 'Rejoignez ma réunion vidéo sur CIRAS MEET',
            url: `https://localhost:3000/rejoindre/<%= idReunion %>`
        }).catch(() => {
            // L'utilisateur a annulé le partage
        });
    } else {
        afficherToast('Le partage natif n\'est pas supporté sur ce navigateur', 'error');
    }
});
