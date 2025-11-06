const socket = io();
let simRigCount = { total: 0, online: 0 };

socket.on('initial-status', (statuses) => {
    const grid = document.getElementById('simrigs-grid');
    grid.innerHTML = '';

    Object.entries(statuses).forEach(([simRigId, status]) => {
        createSimRigCard(simRigId);
        updateSimRigDisplay(simRigId, status);
    });

    updateStats();
});

socket.on('status-update', ({ simRigId, online, lastUpdate, data }) => {
    if (!document.getElementById(`simrig-${simRigId}`)) {
        createSimRigCard(simRigId);
    }
    updateSimRigDisplay(simRigId, { online, lastUpdate, data });
    updateStats();
});

function createSimRigCard(simRigId) {
    const grid = document.getElementById('simrigs-grid');
    const card = document.createElement('div');
    card.className = 'simrig-card';
    card.id = `simrig-${simRigId}`;

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
            <div class="version-info">v0.0.0</div>
        </div>
        <div class="last-update">Never</div>
        <div class="data-section">
            <h3 class="data-title">Raw Data</h3>
            <div class="raw-data">
                <p class="no-data">No data available</p>
            </div>
        </div>
    `;

    grid.appendChild(card);
}

function updateSimRigDisplay(simRigId, { online, lastUpdate, data }) {
    const card = document.getElementById(`simrig-${simRigId}`);
    if (!card) return;

    const branchBadge = card.querySelector('.branch-badge');
    const statusDot = card.querySelector('.status-dot');
    const statusText = card.querySelector('.status-text');
    const versionInfo = card.querySelector('.version-info');
    const lastUpdateDiv = card.querySelector('.last-update');
    const dataDiv = card.querySelector('.raw-data');

    // Update branch
    if (data?.branch) {
        const branch = data.branch.toLowerCase();
        branchBadge.className = `branch-badge ${(branch === 'dev' && data.devMode) || (branch === 'prod' && !data.devMode) ? branch : 'unknown'}`;
        branchBadge.textContent = data.branch;
    }

    // Update version
    if (data?.version) {
        versionInfo.textContent = `v${data.version}`;
    }

    // Update status
    statusDot.className = `status-dot ${online ? 'online' : 'offline'}`;
    statusText.textContent = online ? 'Online' : 'Offline';

    if (lastUpdate) {
        const date = new Date(lastUpdate);
        lastUpdateDiv.textContent = `Last update: ${date.toLocaleTimeString()}`;
    } else {
        lastUpdateDiv.textContent = 'Never';
    }

    if (data && Object.keys(data).length > 0) {
        dataDiv.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    } else {
        dataDiv.innerHTML = '<p class="no-data">No data available</p>';
    }
}

function updateStats() {
    const cards = document.querySelectorAll('.simrig-card');
    const onlineCards = document.querySelectorAll('.status-dot.online');

    simRigCount.total = cards.length;
    simRigCount.online = onlineCards.length;

    document.getElementById('total-rigs').textContent = simRigCount.total;
    document.getElementById('online-rigs').textContent = simRigCount.online;
}
