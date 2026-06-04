const express = require('express');
const ws = require('ws');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const HTTP_PORT = 3000;
const WS_PORT = 8080;
let connectedNodes = [];

const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);

// Real-time Veri İletişimi İçin WebSocket Sunucusu
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
        lastSeen: new Date().toLocaleTimeString()
    };
    
    connectedNodes.push({ info: nodeInfo, socket: socket });
    console.log(`[+] Yeni Bağlantı Sağlandı: ${nodeId} (${nodeIp})`);

    socket.on('message', (message) => {
        console.log(`[Veri] ${nodeId} isimli düğümden gelen mesaj: ${message.toString()}`);
    });

    socket.on('close', () => {
        connectedNodes = connectedNodes.filter(c => c.socket !== socket);
        console.log(`[-] Bağlantı Sonlandırıldı: ${nodeId}`);
    });
});

// --- API ENDPOINTS ---
app.get('/api/nodes', (req, res) => {
    res.json(connectedNodes.map(c => c.info));
});

// Güvenli Dosya Dağıtım Rotası
app.get('/download/:file', (req, res) => {
    const fileName = req.params.file;
    const filePath = path.resolve(downloadsDir, fileName);

    if (!filePath.startsWith(downloadsDir)) {
        return res.status(403).send("Yetkisiz dizin erişimi engellendi.");
    }

    if (fs.existsSync(filePath)) {
        if (fileName.endsWith('.apk')) {
            res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        } else if (fileName.endsWith('.exe')) {
            res.setHeader('Content-Type', 'application/octet-stream');
        }
        res.download(filePath);
    } else {
        res.status(404).send("İlgili dosya sunucuda bulunamadı. Lütfen downloads/ klasörünü kontrol edin.");
    }
});

// Statik Dosya Sunumları (Root Düzlemi)
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(HTTP_PORT, () => console.log(`[+] Yönetim Paneline Bağlanın: http://localhost:${HTTP_PORT}`));
