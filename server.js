const express = require('express');
const ws = require('ws');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const HTTP_PORT = 3000;
const WS_PORT = 8080;
let connectedNodes = [];

// WebSocket Sunucusu Yapılandırması (Real-time Veri Akışı İçin)
const wss = new ws.Server({ port: WS_PORT }, () => {
    console.log(`[*] WebSocket Sunucusu Aktif | Port: ${WS_PORT}`);
});

wss.on('connection', (socket, req) => {
    const nodeId = "NODE_" + Math.random().toString(36).substring(2, 7).toUpperCase();
    const nodeIp = req.socket.remoteAddress ? req.socket.remoteAddress.replace('::ffff:', '') : '127.0.0.1';
    
    const nodeInfo = {
        id: nodeId,
        ip: nodeIp,
        status: "Çevrimiçi",
        lastMessage: "Bağlantı sağlandı."
    };
    
    connectedNodes.push({ info: nodeInfo, socket: socket });
    console.log(`[+] Yeni Düğüm Bağlandı: ${nodeId} (${nodeIp})`);

    // İstemciden gelen standart verileri dinleme
    socket.on('message', (message) => {
        const target = connectedNodes.find(c => c.socket === socket);
        if (target) {
            target.info.lastMessage = message.toString();
            console.log(`[Veri] ${target.info.id}: ${message.toString()}`);
        }
    });

    // Bağlantı koptuğunda listeden temizleme
    socket.on('close', () => {
        connectedNodes = connectedNodes.filter(c => c.socket !== socket);
        console.log(`[-] Düğüm Ayrıldı: ${nodeId}`);
    });
});

// --- API ENDPOINTS ---
app.get('/api/nodes', (req, res) => {
    res.json(connectedNodes.map(c => c.info));
});

// Statik Dosya Yönlendirmeleri (Root Seviyesi)
app.get('/style.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'style.css'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(HTTP_PORT, () => {
    console.log(`[+] Yönetim Paneli Yayında: http://localhost:${HTTP_PORT}`);
});
