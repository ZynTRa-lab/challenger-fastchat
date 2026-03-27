const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Render'daki MONGO_URI'yi çekiyoruz
const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI)
    .then(() => console.log("✅ MongoDB Bağlantısı Başarılı!"))
    .catch(err => console.error("❌ MongoDB Hatası:", err.message));

// --- MODELLER ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, default: "Üye" }
});
const User = mongoose.model('User', UserSchema);

const MessageSchema = new mongoose.Schema({
    room: String,
    user: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

app.use(express.static(path.join(__dirname, 'public')));

const onlineUsers = {};

io.on('connection', (socket) => {
    
    // Kayıt ve Giriş İşlemleri
    socket.on('auth', async (data) => {
        const { type, username, password } = data;
        if (mongoose.connection.readyState !== 1) {
            return socket.emit('auth_error', "Veritabanı bağlantısı yok!");
        }

        try {
            if (type === 'register') {
                const existing = await User.findOne({ username });
                if (existing) return socket.emit('auth_error', "Bu kullanıcı adı alınmış!");

                const hashedPassword = await bcrypt.hash(password, 10);
                const newUser = new User({ username, password: hashedPassword });
                await newUser.save();
                socket.emit('auth_success', { username, role: "Üye" });
            } else {
                const user = await User.findOne({ username });
                if (user && await bcrypt.compare(password, user.password)) {
                    socket.emit('auth_success', { username: user.username, role: user.role });
                } else {
                    socket.emit('auth_error', "Hatalı kullanıcı adı veya şifre!");
                }
            }
        } catch (e) {
            socket.emit('auth_error', "İşlem hatası: " + e.message);
        }
    });

    // Odaya Katılma ve Geçmişi Yükleme
    socket.on('join_room', async (room) => {
        socket.leaveAll();
        socket.join(room);
        socket.currentRoom = room;

        try {
            // Son 50 mesajı getir
            const history = await Message.find({ room }).sort({ timestamp: 1 }).limit(50);
            socket.emit('load_history', history);
        } catch (e) {
            console.log("Geçmiş yüklenemedi:", e);
        }
    });

    // Mesaj Gönderme ve Kaydetme
    socket.on('chat_message', async (data) => {
        try {
            const newMessage = new Message({
                room: data.room,
                user: data.user,
                text: data.text
            });
            await newMessage.save();
            io.to(data.room).emit('chat_message', {
                user: data.user,
                text: data.text,
                timestamp: newMessage.timestamp
            });
        } catch (e) {
            console.log("Mesaj kaydedilemedi:", e);
        }
    });

    socket.on('login_complete', (username) => {
        socket.username = username;
        onlineUsers[username] = socket.id;
        io.emit('user_update', Object.keys(onlineUsers));
    });

    socket.on('disconnect', () => {
        if (socket.username) delete onlineUsers[socket.username];
        io.emit('user_update', Object.keys(onlineUsers));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Challenger Pro ${PORT} üzerinde hazır!`));