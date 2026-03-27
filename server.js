const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI)
    .then(() => console.log("✅ MongoDB Bağlantısı Aktif!"))
    .catch(err => console.error("❌ MongoDB Hatası:", err.message));

// --- MODELLER ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, default: "Üye" }
});
const User = mongoose.model('User', UserSchema);

const ServerSchema = new mongoose.Schema({
    name: String,
    owner: String,
    icon: String
});
const Guild = mongoose.model('Guild', ServerSchema);

const MessageSchema = new mongoose.Schema({
    room: String, // Sunucu odası veya DM odası (örn: dm_ege_ali)
    user: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

app.use(express.static(path.join(__dirname, 'public')));

let onlineUsers = {};

io.on('connection', (socket) => {
    
    socket.on('auth', async (data) => {
        const { type, username, password } = data;
        try {
            if (type === 'register') {
                const existing = await User.findOne({ username });
                if (existing) return socket.emit('auth_error', "Kullanıcı adı dolu!");
                const hashedPassword = await bcrypt.hash(password, 10);
                const newUser = new User({ username, password: hashedPassword });
                await newUser.save();
                socket.emit('auth_success', { username, role: "Üye" });
            } else {
                const user = await User.findOne({ username });
                if (user && await bcrypt.compare(password, user.password)) {
                    socket.emit('auth_success', { username: user.username, role: user.role });
                } else {
                    socket.emit('auth_error', "Giriş hatalı!");
                }
            }
        } catch (e) { socket.emit('auth_error', "Sistem Hatası!"); }
    });

    socket.on('login_complete', async (username) => {
        socket.username = username;
        onlineUsers[username] = socket.id;
        
        // Sunucuları yükle
        const guilds = await Guild.find();
        socket.emit('load_guilds', guilds);
        
        // Herkese güncel kullanıcı listesini at
        io.emit('user_update', Object.keys(onlineUsers));
    });

    socket.on('create_server', async (data) => {
        const newGuild = new Guild({ name: data.name, owner: data.owner, icon: data.name[0].toUpperCase() });
        await newGuild.save();
        const allGuilds = await Guild.find();
        io.emit('load_guilds', allGuilds);
    });

    socket.on('join_room', async (room) => {
        socket.leaveAll();
        socket.join(room);
        socket.currentRoom = room;
        const history = await Message.find({ room }).sort({ timestamp: 1 }).limit(50);
        socket.emit('load_history', history);
    });

    socket.on('chat_message', async (data) => {
        const newMessage = new Message({ room: data.room, user: data.user, text: data.text });
        await newMessage.save();
        io.to(data.room).emit('chat_message', {
            user: data.user,
            text: data.text,
            timestamp: newMessage.timestamp
        });
    });

    socket.on('disconnect', () => {
        if (socket.username) delete onlineUsers[socket.username];
        io.emit('user_update', Object.keys(onlineUsers));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Challenger Pro ${PORT} Portunda!`));