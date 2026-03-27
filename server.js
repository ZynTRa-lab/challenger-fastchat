const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// RENDER ÜZERİNDEKİ MONGO_URI'YI KONTROL ET
const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
    console.error("❌ HATA: MONGO_URI tanımlanmamış! Render Dashboard -> Settings -> Config Vars kısmına ekle.");
}

mongoose.connect(mongoURI)
    .then(() => console.log("✅ MongoDB Bağlantısı Başarılı!"))
    .catch(err => console.error("❌ MongoDB Bağlantı Hatası:", err.message));

// --- MODELLER ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    bio: { type: String, default: "Selam! Ben bir Challenger kullanıcısıyım." },
    avatar: { type: String, default: "" }, // Profil Fotoğrafı (Base64 veya URL)
    friends: [String],
    blocked: [String],
    pendingRequests: [String],
    guilds: [String]
});
const User = mongoose.model('User', UserSchema);

const Guild = mongoose.model('Guild', new mongoose.Schema({
    name: { type: String, unique: true },
    owner: String,
    members: [String]
}));

const Message = mongoose.model('Message', new mongoose.Schema({
    room: String, user: String, text: String, timestamp: { type: Date, default: Date.now }
}));

app.use(express.static(path.join(__dirname, 'public')));

let onlineUsers = {};

io.on('connection', (socket) => {
    
    socket.on('auth', async (data) => {
        const { type, username, password } = data;
        try {
            if (type === 'register') {
                const existing = await User.findOne({ username });
                if (existing) return socket.emit('auth_error', "Bu kullanıcı adı zaten alınmış!");
                const user = new User({ username, password: await bcrypt.hash(password, 10) });
                await user.save();
                socket.emit('auth_success', { username });
            } else {
                const user = await User.findOne({ username });
                if (user && await bcrypt.compare(password, user.password)) {
                    socket.emit('auth_success', { username });
                } else {
                    socket.emit('auth_error', "Giriş bilgileri hatalı!");
                }
            }
        } catch (e) { socket.emit('auth_error', "Veritabanı bağlantı hatası!"); }
    });

    socket.on('login_complete', async (username) => {
        socket.username = username;
        onlineUsers[username] = socket.id;
        await updateUserData(socket);
    });

    async function updateUserData(targetSocket) {
        try {
            const user = await User.findOne({ username: targetSocket.username });
            if(!user) return;
            const onlineFriends = (user.friends || []).filter(f => onlineUsers[f]);
            const userGuilds = await Guild.find({ name: { $in: user.guilds } });
            
            targetSocket.emit('user_update', {
                onlineFriends,
                pendingRequests: user.pendingRequests,
                guilds: userGuilds,
                blocked: user.blocked,
                bio: user.bio,
                avatar: user.avatar
            });
        } catch (e) { console.log("Update Error"); }
    }

    socket.on('get_profile', async (targetName) => {
        const user = await User.findOne({ username: targetName });
        if(user) socket.emit('profile_data', { username: user.username, bio: user.bio, avatar: user.avatar });
    });

    socket.on('update_profile', async (data) => {
        await User.findOneAndUpdate({ username: socket.username }, { bio: data.bio, avatar: data.avatar });
        await updateUserData(socket);
        socket.emit('sys_msg', "Profil başarıyla güncellendi!");
    });

    socket.on('relation_action', async ({ target, type }) => {
        const me = await User.findOne({ username: socket.username });
        const other = await User.findOne({ username: target });
        if(!me || !other) return;

        if(type === 'remove') {
            me.friends = me.friends.filter(f => f !== target);
            other.friends = other.friends.filter(f => f !== socket.username);
        } else if(type === 'block') {
            me.friends = me.friends.filter(f => f !== target);
            other.friends = other.friends.filter(f => f !== socket.username);
            if(!me.blocked.includes(target)) me.blocked.push(target);
        }
        await me.save(); await other.save();
        await updateUserData(socket);
        if(onlineUsers[target]) await updateUserData(io.sockets.sockets.get(onlineUsers[target]));
    });

    socket.on('send_friend_request', async (targetName) => {
        const target = await User.findOne({ username: targetName });
        const me = await User.findOne({ username: socket.username });
        if(target && !me.friends.includes(targetName) && !target.pendingRequests.includes(socket.username) && !target.blocked.includes(socket.username)) {
            target.pendingRequests.push(socket.username);
            await target.save();
            if(onlineUsers[targetName]) await updateUserData(io.sockets.sockets.get(onlineUsers[targetName]));
            socket.emit('sys_msg', "İstek gönderildi!");
        }
    });

    socket.on('handle_request', async ({ fromUser, action }) => {
        const me = await User.findOne({ username: socket.username });
        const sender = await User.findOne({ username: fromUser });
        me.pendingRequests = me.pendingRequests.filter(u => u !== fromUser);
        if(action === 'accept' && sender) {
            me.friends.push(fromUser); sender.friends.push(socket.username);
            await sender.save();
        }
        await me.save();
        await updateUserData(socket);
        if(onlineUsers[fromUser]) await updateUserData(io.sockets.sockets.get(onlineUsers[fromUser]));
    });

    socket.on('create_guild', async (name) => {
        const g = new Guild({ name, owner: socket.username, members: [socket.username] });
        await g.save();
        const me = await User.findOne({ username: socket.username });
        me.guilds.push(name); await me.save();
        await updateUserData(socket);
    });

    socket.on('join_room', async (room) => {
        socket.leaveAll(); socket.join(room);
        const history = await Message.find({ room }).sort({ timestamp: 1 }).limit(50);
        socket.emit('load_history', history);
    });

    socket.on('chat_message', async (data) => {
        const m = new Message({ room: data.room, user: data.user, text: data.text });
        await m.save();
        io.to(data.room).emit('chat_message', m);
    });

    socket.on('disconnect', () => { delete onlineUsers[socket.username]; });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sunucu ${PORT} portunda hazır!`));