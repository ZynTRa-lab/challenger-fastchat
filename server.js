const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('Bir kullanıcı bağlandı!');

    // Genel mesajlaşma
    socket.on('chat message', (data) => {
        io.emit('chat message', data); 
    });

    // Arkadaşlık isteği gönderildiğinde
    socket.on('send friend request', (data) => {
        // Şimdilik herkese duyurur (Önemli: Alıcıya ulaşması için)
        socket.broadcast.emit('receive friend request', data); 
    });

    // Arkadaşlık isteğine cevap verildiğinde
    socket.on('respond friend request', (data) => {
        socket.broadcast.emit('request response', {
            from: data.to, 
            accepted: data.accepted
        });
    });

    socket.on('disconnect', () => {
        console.log('Bir kullanıcı ayrıldı.');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda hazır!`);
});