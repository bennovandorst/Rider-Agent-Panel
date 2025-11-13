const socket = io();
let simRigCount = { total: 0, online: 0, inUse: 0 };
let allSimRigs = {};

socket.on('initial-status', (statuses) => {
    const grid = document.getElementById('simrigs-grid');
    grid.innerHTML = '';
    allSimRigs = statuses;

    Object.entries(statuses).forEach(([simRigId, status]) => {
        createSimRigCard(simRigId);
        updateSimRigDisplay(simRigId, status);
    });

    setTimeout(() => {
        Object.keys(statuses).forEach(simRigId => {
            loadLogs(simRigId);
        });
    }, 0);

    updateStats();
});

socket.on('status-update', ({ simRigId, online, lastUpdate, isInUse, data }) => {
    if (!document.getElementById(`simrig-${simRigId}`)) {
        createSimRigCard(simRigId);
        setTimeout(() => loadLogs(simRigId), 0);
    }

    allSimRigs[simRigId] = { online, lastUpdate, isInUse, data };
    updateSimRigDisplay(simRigId, { online, lastUpdate, isInUse, data });
    updateStats();
});

socket.on('log-update', ({ simRigId, log }) => {
    appendLog(simRigId, log);
});

function createSimRigCard(simRigId) {
    const grid = document.getElementById('simrigs-grid');

    const noRigs = grid.querySelector('.no-rigs');
    if (noRigs) {
        noRigs.remove();
    }

    const card = document.createElement('div');
    card.className = 'simrig-card';
    card.id = `simrig-${simRigId}`;
    card.dataset.simrigId = simRigId;

    card.innerHTML = `
        <div class="card-header">
            <h2 class="simrig-name">SimRig ${simRigId}</h2>
            <span class="branch-badge unknown">Unknown</span>
        </div>
        <div class="card-meta">
            <div class="status-indicator">
                <span class="status-dot offline"></span>
                <span class="status-text">Offline</span>
            </div>
            <div class="usage-indicator">
                <span class="usage-dot idle"></span>
                <span class="usage-text">Idle</span>
            </div>
            <div class="version-info">v0.0.0</div>
        </div>
        <div class="last-update">Never updated</div>
        <div class="log-section">
            <h3 class="data-title">Recent Logs</h3>
            <div class="log-viewer" id="logs-${simRigId}">
                <p class="no-data">No logs available</p>
            </div>
        </div>
    `;

    grid.appendChild(card);
}

function updateSimRigDisplay(simRigId, { online, lastUpdate, isInUse, data }) {
    const card = document.getElementById(`simrig-${simRigId}`);
    if (!card) return;

    card.dataset.online = online;
    card.dataset.inUse = isInUse;

    const branchBadge = card.querySelector('.branch-badge');
    const statusDot = card.querySelector('.status-dot');
    const statusText = card.querySelector('.status-text');
    const usageDot = card.querySelector('.usage-dot');
    const usageText = card.querySelector('.usage-text');
    const versionInfo = card.querySelector('.version-info');
    const lastUpdateDiv = card.querySelector('.last-update');

    if (data?.branch) {
        const branch = data.branch.toLowerCase();
        branchBadge.className = `branch-badge ${(branch === 'dev' && data.devMode) || (branch === 'prod' && !data.devMode) ? branch : 'unknown'}`;
        branchBadge.textContent = data.branch;
    }

    if (data?.version) {
        versionInfo.textContent = `v${data.version}`;
    }

    statusDot.className = `status-dot ${online ? 'online' : 'offline'}`;
    statusText.textContent = online ? 'Online' : 'Offline';

    usageDot.className = `usage-dot ${isInUse ? 'in-use' : 'idle'}`;
    usageText.textContent = isInUse ? 'In Use' : 'Idle';

    if (lastUpdate) {
        const date = new Date(lastUpdate);
        const now = new Date();
        const dateStr = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        const timeStr = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        lastUpdateDiv.textContent = `${dateStr} at ${timeStr}`;
    } else {
        lastUpdateDiv.textContent = 'Never updated';
    }
}

async function loadLogs(simRigId) {
    try {
        const response = await fetch(`/v1/api/simrig/${simRigId}/logs`);
        const logs = await response.json();

        const logViewer = document.getElementById(`logs-${simRigId}`);
        if (!logViewer) {
            console.warn(`Log viewer not found for SimRig ${simRigId}`);
            return;
        }

        const filteredLogs = logs.filter(log => log.level?.toLowerCase() !== 'panel');

        if (filteredLogs.length === 0) {
            logViewer.innerHTML = '<p class="no-data">No logs available</p>';
        } else {
            const recentLogs = filteredLogs.slice(-5).reverse();
            logViewer.innerHTML = recentLogs.map(log => createLogEntry(log)).join('');
        }
    } catch (error) {
        console.error('Failed to load logs:', error);
    }
}

async function loadAppVersion() {
    try {
        const response = await fetch('/v1/api/info');
        const { name, description, version, branch } = await response.json();

        document.getElementById('app-version').textContent = `v${version}@${branch}`;
    } catch (error) {
        document.getElementById('app-version').textContent = 'Unknown';
        console.error('Failed to load info:', error);
    }
}

loadAppVersion();

function appendLog(simRigId, log) {
    if (log.level?.toLowerCase() === 'panel') {
        return;
    }

    const logViewer = document.getElementById(`logs-${simRigId}`);
    if (!logViewer) return;

    const noData = logViewer.querySelector('.no-data');
    if (noData) {
        logViewer.innerHTML = '';
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = createLogEntry(log);

    logViewer.insertBefore(wrapper.firstElementChild, logViewer.firstChild);

    while (logViewer.children.length > 5) {
        logViewer.removeChild(logViewer.lastChild);
    }
}

function createLogEntry(log) {
    const time = new Date(log.timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const levelClass = log.level?.toLowerCase() || 'info';
    const level = (log.level || 'INFO').toUpperCase().padEnd(7);

    return `<div class="log-entry log-${levelClass}"><span class="log-time">[${time}]</span><span class="log-level">${level}</span><span class="log-message">${escapeHtml(log.message)}</span></div>`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateStats() {
    const cards = document.querySelectorAll('.simrig-card');
    const onlineCards = document.querySelectorAll('.status-dot.online');
    const inUseCards = document.querySelectorAll('.usage-dot.in-use');

    simRigCount.total = cards.length;
    simRigCount.online = onlineCards.length;
    simRigCount.inUse = inUseCards.length;

    document.getElementById('total-rigs').textContent = simRigCount.total;
    document.getElementById('online-rigs').textContent = simRigCount.online;
    document.getElementById('inuse-rigs').textContent = simRigCount.inUse;
}

const searchInput = document.getElementById('search-input');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        filterCards(searchTerm, document.getElementById('filter-select')?.value || 'all');
    });
}

const filterSelect = document.getElementById('filter-select');
if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
        const filterValue = e.target.value;
        filterCards(document.getElementById('search-input')?.value.toLowerCase() || '', filterValue);
    });
}

function filterCards(searchTerm, filterValue) {
    const cards = document.querySelectorAll('.simrig-card');
    let visibleCount = 0;

    cards.forEach(card => {
        const simrigId = card.dataset.simrigId;
        const simrigName = `simrig ${simrigId}`.toLowerCase();
        const isOnline = card.dataset.online === 'true';
        const isInUse = card.dataset.inUse === 'true';

        const matchesSearch = simrigName.includes(searchTerm);

        let matchesFilter = true;
        if (filterValue === 'online') {
            matchesFilter = isOnline;
        } else if (filterValue === 'offline') {
            matchesFilter = !isOnline;
        } else if (filterValue === 'in-use') {
            matchesFilter = isInUse;
        }

        if (matchesSearch && matchesFilter) {
            card.style.display = '';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    const grid = document.getElementById('simrigs-grid');
    let noResults = grid.querySelector('.no-rigs');

    if (visibleCount === 0 && cards.length > 0) {
        if (!noResults) {
            noResults = document.createElement('div');
            noResults.className = 'no-rigs';
            noResults.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="11" cy="11" r="8" stroke-width="2"/>
                    <path d="m21 21-4.35-4.35" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <p>No SimRigs found</p>
                <span>Try adjusting your search or filter</span>
            `;
            grid.appendChild(noResults);
        }
    } else if (noResults && visibleCount > 0) {
        noResults.remove();
    }
}
