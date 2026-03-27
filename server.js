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
    friends: [String], // Arkadaş listesi (Kullanıcı adları)
    guilds: [String]   // Katıldığı sunucuların ID'leri veya isimleri
});
const User = mongoose.model('User', UserSchema);

const GuildSchema = new mongoose.Schema({
    name: { type: String, unique: true },
    owner: String,
    members: [String]
});
const Guild = mongoose.model('Guild', GuildSchema);

const MessageSchema = new mongoose.Schema({
    room: String,
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
                if (existing) return socket.emit('auth_error', "Bu kullanıcı adı dolu!");
                const hashedPassword = await bcrypt.hash(password, 10);
                const newUser = new User({ username, password: hashedPassword });
                await newUser.save();
                socket.emit('auth_success', { username });
            } else {
                const user = await User.findOne({ username });
                if (user && await bcrypt.compare(password, user.password)) {
                    socket.emit('auth_success', { username });
                } else {
                    socket.emit('auth_error', "Giriş hatalı!");
                }
            }
        } catch (e) { socket.emit('auth_error', "Sistem Hatası!"); }
    });

    socket.on('login_complete', async (username) => {
        socket.username = username;
        onlineUsers[username] = socket.id;
        await updateUserData(socket);
    });

    async function updateUserData(targetSocket) {
        const user = await User.findOne({ username: targetSocket.username });
        if(!user) return;

        // Sadece arkadaş olanları ve online olanları filtrele
        const friendList = user.friends || [];
        const onlineFriends = friendList.filter(f => onlineUsers[f]);
        
        // Kullanıcıya kendi arkadaş listesini ve sunucularını gönder
        const userGuilds = await Guild.find({ name: { $in: user.guilds } });
        
        targetSocket.emit('user_update', {
            onlineFriends,
            guilds: userGuilds
        });
        
        // Arkadaşlarına "ben online oldum" sinyali gönder
        onlineFriends.forEach(fName => {
            const fSocketId = onlineUsers[fName];
            if(fSocketId) {
                io.to(fSocketId).emit('friend_online', targetSocket.username);
            }
        });
    }

    // Arkadaş Ekleme
    socket.on('add_friend', async (targetName) => {
        if(targetName === socket.username) return socket.emit('sys_msg', "Kendini ekleyemezsin kanka!");
        
        const target = await User.findOne({ username: targetName });
        const me = await User.findOne({ username: socket.username });

        if(target && !me.friends.includes(targetName)) {
            me.friends.push(targetName);
            target.friends.push(socket.username);
            await me.save();
            await target.save();
            await updateUserData(socket);
            const targetSocketId = onlineUsers[targetName];
            if(targetSocketId) {
                const targetSocket = io.sockets.sockets.get(targetSocketId);
                if(targetSocket) await updateUserData(targetSocket);
            }
        } else {
            socket.emit('sys_msg', "Kullanıcı bulunamadı veya zaten arkadaşsınız.");
        }
    });

    // Sunucu Kurma
    socket.on('create_guild', async (guildName) => {
        try {
            const existing = await Guild.findOne({ name: guildName });
            if(existing) return socket.emit('sys_msg', "Bu isimde bir sunucu zaten var!");

            const newGuild = new Guild({ name: guildName, owner: socket.username, members: [socket.username] });
            await newGuild.save();

            const me = await User.findOne({ username: socket.username });
            me.guilds.push(guildName);
            await me.save();

            await updateUserData(socket);
        } catch(e) { console.log(e); }
    });

    // Sunucuya Katılma
    socket.on('join_guild_request', async (guildName) => {
        const guild = await Guild.findOne({ name: guildName });
        if(!guild) return socket.emit('sys_msg', "Sunucu bulunamadı!");

        const me = await User.findOne({ username: socket.username });
        if(me.guilds.includes(guildName)) return socket.emit('sys_msg', "Zaten bu sunucudasın!");

        me.guilds.push(guildName);
        guild.members.push(socket.username);
        await me.save();
        await guild.save();

        await updateUserData(socket);
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
        // Arkadaşlarına çevrimdışı bilgisini yayabiliriz (opsiyonel)
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Challenger Pro ${PORT} Portunda!`));