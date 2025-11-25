const socket = io('/');
const videoGrid = document.getElementById('video-grid');
const myPeer = new Peer(undefined, {
  path: '/peerjs',
  host: '/',
  port: '3030'
});
let myVideoStream;
const myVideo = document.createElement('video');
const text = $("#chat_message");
const chatButton = document.querySelector('#chatButton');
/** share */
const copyLinkBtn = document.getElementById('copy-link-btn');
const copyCodeBtn = document.getElementById('copy-code-btn');
const emailShareBtn = document.getElementById('email-share-btn');
const nativeShareBtn = document.getElementById('native-share-btn');
myVideo.muted = true;
const peers = {}

navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {
  myVideoStream = stream;
  addVideoStream(myVideo, stream)
  
  myPeer.on('call', call => {
    call.answer(stream)
    const video = document.createElement('video')
    call.on('stream', userVideoStream => {
      addVideoStream(video, userVideoStream)
    });
  });

  socket.on('user-connected', userId => {
    // Petit délai pour s'assurer que le PeerJS de l'autre est prêt
    setTimeout(() => {
      connectToNewUser(userId, stream)
    }, 1000)
  })

  $('html').keydown(function (e) {
    if (e.which == 13 && text.val().length !== 0) {
      socket.emit('message', text.val());
      text.val('');
    }
  });

  socket.on("createMessage", message => {
    $("ul").append(`<li class="message"><b>user</b><br/>${message}</li>`);
    scrollToBottom()
  });

});

socket.on('user-disconnected', userId => {
  if (peers[userId]) peers[userId].close()
})

myPeer.on('open', id => {
  socket.emit('join-room', ROOM_ID, id)
})

function connectToNewUser(userId, stream) {
  const call = myPeer.call(userId, stream)
  const video = document.createElement('video')
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream)
  })
  call.on('close', () => {
    video.remove()
  })

  peers[userId] = call;
  console.log('new user');
}

function addVideoStream(video, stream) {
  video.srcObject = stream
  video.addEventListener('loadedmetadata', () => {
    video.play()
  })
  videoGrid.append(video)
}

const scrollToBottom = () => {
  var d = $('.main__chat_window');
  d.scrollTop(d.prop("scrollHeight"));
}

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

const sendMessage = () => {
  if (text.val().length !== 0) {
    socket.emit('message', text.val());
    text.val('');
  }
}
