# MatchCam

Projeto simples de chat por vídeo usando WebRTC e Socket.IO.

Este projeto também inclui medidas básicas de segurança no servidor, como cabeçalhos de proteção e políticas de conteúdo.

## Como usar

1. Abra um terminal em `c:\Users\igor.floriani\Desktop\Nova pasta`
2. Execute:

```bash
npm install
npm start
```

3. Abra `http://localhost:3000` no navegador.
4. Abra a mesma página em outra aba ou em outro navegador para conectar duas pessoas.

## O que este site faz

- Captura sua câmera e microfone
- Conecta você automaticamente a outra pessoa que esteja aguardando
- Usa WebRTC para transmitir vídeo e áudio
- Faz pareamento aleatório de dois visitantes
- Permite silenciar o microfone, desligar a câmera e enviar mensagens de texto
- É responsivo para celulares e tablets
