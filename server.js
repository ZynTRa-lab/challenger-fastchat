const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// MongoDB Bağlantısı (Render'daki MONGO_URI'yi kullanır)
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI)
    .then(() => console.log("MongoDB Hafızası Bağlandı!"))
    .catch(err => console.log("Bağlantı Hatası:", err));

// Veritabanı Modelleri
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: String, default: "Üye" },
    status: { type: String, default: "Çevrimiçi" }
});
const User = mongoose.model('User', UserSchema);

app.use(express.static(path.join(__dirname, 'public')));

const onlineUsers = {};

io.on('connection', (socket) => {
    // KAYIT VE GİRİŞ SİSTEMİ
    socket.on('auth', async (data) => {
        const { type, username, password } = data;
        
        if (type === 'register') {
            const hashedPassword = await bcrypt.hash(password, 10);
            try {
                const newUser = new User({ username, password: hashedPassword });
                await newUser.save();
                socket.emit('auth_success', { username, role: "Üye" });
            } catch (e) { socket.emit('auth_error', "Bu kullanıcı adı alınmış!"); }
        } else {
            const user = await User.findOne({ username });
            if (user && await bcrypt.compare(password, user.password)) {
                socket.emit('auth_success', { username: user.username, role: user.role });
            } else { socket.emit('auth_error', "Hatalı kullanıcı adı veya şifre!"); }
        }
    });

    socket.on('login_complete', (username) => {
        socket.username = username;
        onlineUsers[username] = socket.id;
        io.emit('user_update', Object.keys(onlineUsers));
    });

    // ODA SİSTEMİ
    socket.on('join_room', (room) => {
        socket.leaveAll();
        socket.join(room);
        socket.currentRoom = room;
    });

    socket.on('chat_message', (data) => {
        io.to(data.room).emit('chat_message', data);
    });

    // ARKADAŞLIK VE DM (Özel Mesaj)
    socket.on('private_msg', (data) => {
        const targetId = onlineUsers[data.to];
        if (targetId) {
            io.to(targetId).emit('private_msg', data);
            socket.emit('private_msg', data);
        }
    });

    socket.on('disconnect', () => {
        if (socket.username) delete onlineUsers[socket.username];
        io.emit('user_update', Object.keys(onlineUsers));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sistem ${PORT} üzerinde devrede!`));