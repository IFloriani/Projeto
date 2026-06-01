const socket = io();
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const statusText = document.getElementById('status');
const startButton = document.getElementById('startButton');
const cameraSelect = document.getElementById('cameraSelect');

let localStream = null;
let peerConnection = null;
let roomId = null;
let isInitiator = false;
let selectedCameraId = null;

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

async function initLocalStream() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = false;
    }

    localVideo.srcObject = localStream;
    await updateCameraList();
    statusText.textContent = 'Clique em Iniciar conversa para se conectar';
    startButton.disabled = false;
  } catch (error) {
    statusText.textContent = 'Não foi possível acessar a câmera/microfone.';
    console.error(error);
  }
}

async function updateCameraList() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === 'videoinput');

    cameraSelect.innerHTML = '';

    cameras.forEach((camera, index) => {
      const option = document.createElement('option');
      option.value = camera.deviceId;
      option.textContent = camera.label || `Câmera ${index + 1}`;
      cameraSelect.appendChild(option);
    });

    if (cameras.length > 1) {
      cameraSelect.style.display = 'inline-block';
      selectedCameraId = selectedCameraId || localStream.getVideoTracks()[0]?.getSettings()?.deviceId || cameras[0].deviceId;
      cameraSelect.value = selectedCameraId;
    } else {
      cameraSelect.style.display = 'none';
    }
  } catch (error) {
    console.error('Erro ao listar câmeras:', error);
  }
}

async function switchCamera(deviceId) {
  if (!deviceId || !localStream) {
    return;
  }

  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
      audio: false
    });

    const newVideoTrack = newStream.getVideoTracks()[0];
    const oldVideoTrack = localStream.getVideoTracks()[0];

    if (oldVideoTrack) {
      localStream.removeTrack(oldVideoTrack);
      oldVideoTrack.stop();
    }

    localStream.addTrack(newVideoTrack);
    localVideo.srcObject = localStream;
    selectedCameraId = deviceId;

    const videoSender = peerConnection?.getSenders().find((sender) => sender.track?.kind === 'video');
    if (videoSender) {
      await videoSender.replaceTrack(newVideoTrack);
    }
  } catch (error) {
    console.error('Erro ao trocar de câmera:', error);
    updateStatus('Não foi possível trocar de câmera.');
  }
}

function updateStatus(message) {
  statusText.textContent = message;
}

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(configuration);

  for (const track of localStream.getTracks()) {
    peerConnection.addTrack(track, localStream);
  }

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', { roomId, data: { type: 'ice-candidate', candidate: event.candidate } });
    }
  };

  peerConnection.onconnectionstatechange = () => {
    if (peerConnection.connectionState === 'connected') {
      updateStatus('Conectado! Aproveite a conversa.');
    } else if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
      updateStatus('Conexão perdida. Recarregue a página para tentar novamente.');
    }
  };
}

async function startCall() {
  startButton.disabled = true;
  const audioTracks = localStream?.getAudioTracks() || [];
  audioTracks.forEach((track) => {
    track.enabled = true;
  });
  updateStatus('Procurando outra pessoa...');
  socket.emit('join');
}

socket.on('status', (message) => {
  updateStatus(message);
});

socket.on('matched', async (data) => {
  roomId = data.roomId;
  isInitiator = data.initiator;
  updateStatus('Par conectado! Preparando chamada...');

  createPeerConnection();

  if (isInitiator) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('signal', { roomId, data: { type: 'offer', sdp: offer } });
  }
});

socket.on('signal', async (data) => {
  if (!peerConnection) {
    createPeerConnection();
  }

  if (data.type === 'offer') {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('signal', { roomId, data: { type: 'answer', sdp: answer } });
  } else if (data.type === 'answer') {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
  } else if (data.type === 'ice-candidate') {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (error) {
      console.error('Erro ao adicionar ICE candidate', error);
    }
  }
});

socket.on('partner-disconnected', () => {
  updateStatus('O parceiro saiu da conversa. Recarregue para tentar novamente.');
});

cameraSelect.addEventListener('change', async () => {
  await switchCamera(cameraSelect.value);
});

startButton.addEventListener('click', startCall);
initLocalStream();
