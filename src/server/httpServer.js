import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class HttpServer {
    constructor(port, simRigs) {
        this.port = port;
        this.app = express();
        this.httpServer = createServer(this.app);
        this.io = new Server(this.httpServer);
        this.simRigStatus = {};

        Object.keys(simRigs).forEach(id => {
            this.simRigStatus[id] = {
                online: false,
                lastUpdate: null,
                data: {}
            };
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

    setupRoutes() {
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });

        this.app.post('/v1/api/simrig/:id/status', (req, res) => {
            const { id } = req.params;
            const data = req.body;

            if (!this.simRigStatus[id]) {
                return res.status(404).json({ error: 'SimRig not found' });
            }

            this.simRigStatus[id] = {
                online: true,
                lastUpdate: Date.now(),
                branch: data.branch,
                version: data.version,
                data: data
            };

            this.io.emit('status-update', { simRigId: id, ...this.simRigStatus[id] });

            res.json({ success: true });
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
