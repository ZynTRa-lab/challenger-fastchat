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
    .then(() => console.log("✅ MongoDB Hafızası Başarıyla Bağlandı!"))
    .catch(err => console.error("❌ MongoDB Bağlantı Hatası:", err.message));

// Kullanıcı Şeması
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, default: "Üye" },
    status: { type: String, default: "Çevrimiçi" }
});
const User = mongoose.model('User', UserSchema);

app.use(express.static(path.join(__dirname, 'public')));

const onlineUsers = {};

io.on('connection', (socket) => {
    
    socket.on('auth', async (data) => {
        const { type, username, password } = data;

        // BAĞLANTI KONTROLÜ
        if (mongoose.connection.readyState !== 1) {
            return socket.emit('auth_error', "Sunucu şu an veritabanına ulaşamıyor. Lütfen MONGO_URI linkini kontrol et.");
        }

        if (type === 'register') {
            try {
                // Kullanıcı adı daha önce alınmış mı?
                const existing = await User.findOne({ username });
                if (existing) return socket.emit('auth_error', "Bu kullanıcı adı zaten alınmış!");

                const hashedPassword = await bcrypt.hash(password, 10);
                const newUser = new User({ username, password: hashedPassword });
                await newUser.save();
                socket.emit('auth_success', { username, role: "Üye" });
            } catch (e) {
                socket.emit('auth_error', "Kayıt hatası: " + e.message);
            }
        } else {
            try {
                const user = await User.findOne({ username });
                if (user && await bcrypt.compare(password, user.password)) {
                    socket.emit('auth_success', { username: user.username, role: user.role });
                } else {
                    socket.emit('auth_error', "Hatalı kullanıcı adı veya şifre!");
                }
            } catch (e) {
                socket.emit('auth_error', "Giriş hatası: " + e.message);
            }
        }
    });

    socket.on('login_complete', (username) => {
        socket.username = username;
        onlineUsers[username] = socket.id;
        io.emit('user_update', Object.keys(onlineUsers));
    });

    socket.on('join_room', (room) => {
        socket.leaveAll();
        socket.join(room);
        socket.currentRoom = room;
    });

    socket.on('chat_message', (data) => {
        io.to(data.room).emit('chat_message', data);
    });

    socket.on('disconnect', () => {
        if (socket.username) delete onlineUsers[socket.username];
        io.emit('user_update', Object.keys(onlineUsers));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Challenger Pro ${PORT} portunda aktif!`));