const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Online kullanıcıları tutan liste (KullanıcıAdı: SocketID)
const onlineUsers = {};

io.on('connection', (socket) => {
    
    // GİRİŞ YAPMA (Register)
    socket.on('register', (username) => {
        socket.username = username;
        onlineUsers[username] = socket.id;
        console.log(`${username} sisteme giriş yaptı.`);
        // Herkese kimin online olduğunu duyur (isteğe bağlı)
        io.emit('user list', Object.keys(onlineUsers));
    });

    // GENEL SOHBET
    socket.on('chat message', (data) => {
        io.emit('chat message', data); 
    });

    // ARKADAŞLIK İSTEĞİ (Belli bir kişiye gönderir)
    socket.on('send friend request', (data) => {
        const targetId = onlineUsers[data.to];
        if (targetId) {
            io.to(targetId).emit('receive friend request', { from: data.from });
        }
    });

    // ARKADAŞLIK YANITI (Kabul/Red)
    socket.on('respond friend request', (data) => {
        const requesterId = onlineUsers[data.from];
        if (requesterId) {
            io.to(requesterId).emit('request response', {
                from: data.to,
                accepted: data.accepted
            });
        }
    });

    // ÇIKIŞ YAPMA
    socket.on('disconnect', () => {
        if (socket.username) {
            delete onlineUsers[socket.username];
            console.log(`${socket.username} ayrıldı.`);
            io.emit('user list', Object.keys(onlineUsers));
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Challenger Sunucusu ${PORT} portunda tam kapasite çalışıyor!`);
});