import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { timingSafeEqual } from 'crypto';
import { logInfo } from "../utils/logger.js";
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class HttpServer {
    constructor(port, simRigs) {
        this.port = port;
        this.app = express();
        this.httpServer = createServer(this.app);
        this.io = new Server(this.httpServer);
        this.simRigStatus = {};
        this.simRigLogs = {};

        Object.keys(simRigs).forEach(id => {
            this.simRigStatus[id] = {
                online: false,
                lastUpdate: null,
                isInUse: false,
                data: {}
            };
            this.simRigLogs[id] = [];
        });

        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketIO();
        this.startStatusCheck();
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, '../public')));
    }

    isValidSecret(clientKey) {
        const serverKey = process.env.SECRET_KEY;
        if (!serverKey || !clientKey || clientKey.length !== serverKey.length) {
            return false;
        }

        try {
            return timingSafeEqual(
                Buffer.from(clientKey),
                Buffer.from(serverKey)
            );
        } catch {
            return false;
        }
    }

    setupRoutes() {
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });

        this.app.post('/v1/api/simrig/:id/status', (req, res) => {
            if (process.env.NODE_ENV === 'production' && !req.secure) {
                return res.status(403).json({ error: 'HTTPS required' });
            }

            const { id } = req.params;
            const data = req.body;

            const clientKey = req.headers['x-secret-key'];
            if (!this.isValidSecret(clientKey)) {
                return res.status(401).json({ error: 'Unauthorized: Invalid secret key' });
            }

            if (!this.simRigStatus[id]) {
                return res.status(404).json({ error: 'SimRig not found' });
            }

            this.simRigStatus[id] = {
                online: true,
                lastUpdate: Date.now(),
                branch: data.branch,
                version: data.version,
                isInUse: data.isInUse || false,
                data: data
            };

            this.io.emit('status-update', { simRigId: id, ...this.simRigStatus[id] });
            res.json({ success: true });
        });

        this.app.post('/v1/api/simrig/:id/logs', (req, res) => {
            if (process.env.NODE_ENV === 'production' && !req.secure) {
                return res.status(403).json({ error: 'HTTPS required' });
            }

            const { id } = req.params;
            const { level, message, timestamp } = req.body;

            const clientKey = req.headers['x-secret-key'];
            if (!this.isValidSecret(clientKey)) {
                return res.status(401).json({ error: 'Unauthorized: Invalid secret key' });
            }

            if (!this.simRigLogs[id]) {
                return res.status(404).json({ error: 'SimRig not found' });
            }

            const logEntry = {
                level,
                message,
                timestamp: timestamp || Date.now()
            };

            this.simRigLogs[id].push(logEntry);

            if (this.simRigLogs[id].length > 100) {
                this.simRigLogs[id].shift();
            }

            this.io.emit('log-update', { simRigId: id, log: logEntry });
            res.json({ success: true });
        });

        this.app.get('/v1/api/simrig/:id/logs', (req, res) => {
            const { id } = req.params;

            if (!this.simRigLogs[id]) {
                return res.status(404).json({ error: 'SimRig not found' });
            }

            res.json(this.simRigLogs[id]);
        });

        this.app.get('/v1/api/info', (req, res) => {
            const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8'));
            const gitRev = require('git-rev-sync');

            res.json({
                name: packageJson.name,
                description: packageJson.description,
                version: packageJson.version,
                branch: gitRev.branch()
            });
        });

        this.app.get('/v1/api/simrigs', (req, res) => {
            res.json(this.simRigStatus);
        });
    }

    setupSocketIO() {
        this.io.on('connection', (socket) => {
            socket.emit('initial-status', this.simRigStatus);
        });
    }

    startStatusCheck() {
        setInterval(() => {
            const now = Date.now();
            let statusChanged = false;

            Object.keys(this.simRigStatus).forEach(id => {
                const status = this.simRigStatus[id];
                if (status.online && status.lastUpdate && (now - status.lastUpdate > 10000)) {
                    status.online = false;
                    statusChanged = true;
                    this.io.emit('status-update', { simRigId: id, ...status });
                }
            });
        }, 5000);
    }

    start() {
        this.httpServer.listen(this.port, () => {
            logInfo(`UI Server running on port ${this.port}`);
        });
    }
}
