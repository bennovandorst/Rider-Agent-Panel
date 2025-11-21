const socket = io();
let allLogs = [];

const filters = {
    simrig: 'all',
    level: 'all',
    search: ''
};

async function fetchVersion() {
    try {
        const response = await fetch('/v1/api/info');
        const data = await response.json();
        const versionBadge = document.getElementById('app-version');
        if (versionBadge) {
            versionBadge.textContent = `v${data.version}@${data.branch}`;
        }
    } catch (error) {
        console.error('Failed to fetch version:', error);
    }
}

fetchVersion();

socket.on('initial-status', async (statuses) => {
    const simrigFilter = document.getElementById('simrig-filter');

    Object.keys(statuses).forEach(simRigId => {
        const option = document.createElement('option');
        option.value = simRigId;
        option.textContent = `SimRig ${simRigId}`;
        simrigFilter.appendChild(option);
    });

    await loadAllLogs(Object.keys(statuses));
});

socket.on('log-update', ({ simRigId, log }) => {
    addLog(simRigId, log);
});

async function loadAllLogs(simRigIds) {
    try {
        const logPromises = simRigIds.map(async (simRigId) => {
            const response = await fetch(`/v1/api/simrig/${simRigId}/logs`);
            const logs = await response.json();
            return logs.map(log => ({ ...log, simRigId }));
        });

        const logsArrays = await Promise.all(logPromises);
        allLogs = logsArrays.flat().sort((a, b) => b.timestamp - a.timestamp);

        renderLogs();
        updateStats();
    } catch (error) {
        console.error('Failed to load logs:', error);
        document.getElementById('log-list').innerHTML = '<p class="no-data">Failed to load logs</p>';
    }
}

function addLog(simRigId, log) {
    allLogs.unshift({ ...log, simRigId });

    if (allLogs.length > 10000) {
        allLogs = allLogs.slice(0, 10000);
    }

    renderLogs();
    updateStats();
}

function renderLogs() {
    const logList = document.getElementById('log-list');
    const filteredLogs = getFilteredLogs();

    if (filteredLogs.length === 0) {
        logList.innerHTML = '<p class="no-data">No logs match the current filters</p>';
        return;
    }

    logList.innerHTML = filteredLogs.map(log => createLogEntry(log)).join('');

    document.getElementById('filtered-logs').textContent = filteredLogs.length;
}

function getFilteredLogs() {
    return allLogs.filter(log => {
        if (filters.simrig !== 'all' && log.simRigId !== filters.simrig) {
            return false;
        }

        if (filters.level !== 'all' && log.level?.toLowerCase() !== filters.level) {
            return false;
        }

        if (filters.search && !log.message?.toLowerCase().includes(filters.search.toLowerCase())) {
            return false;
        }

        return true;
    });
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

    return `<div class="log-entry log-${levelClass}"><span class="log-time">[${time}]</span><span class="log-simrig">SimRig ${log.simRigId}</span><span class="log-level">${level}</span><span class="log-message">${escapeHtml(log.message)}</span></div>`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateStats() {
    document.getElementById('total-logs').textContent = allLogs.length;

    const counts = {
        info: 0,
        error: 0,
        warning: 0
    };

    allLogs.forEach(log => {
        const level = log.level?.toLowerCase();
        switch (level) {
            case 'info':
                counts.info++;
                break;
            case 'error':
                counts.error++;
                break;
            case 'warning':
                counts.warning++;
                break;
        }
    });

    document.getElementById('info-count').textContent = counts.info;
    document.getElementById('error-count').textContent = counts.error;
    document.getElementById('warning-count').textContent = counts.warning;
}

document.getElementById('simrig-filter').addEventListener('change', (e) => {
    filters.simrig = e.target.value;
    renderLogs();
});

document.getElementById('level-filter').addEventListener('change', (e) => {
    filters.level = e.target.value;
    renderLogs();
});

document.getElementById('search-input').addEventListener('input', (e) => {
    filters.search = e.target.value;
    renderLogs();
});

document.getElementById('clear-filters').addEventListener('click', () => {
    filters.simrig = 'all';
    filters.level = 'all';
    filters.search = '';

    document.getElementById('simrig-filter').value = 'all';
    document.getElementById('level-filter').value = 'all';
    document.getElementById('search-input').value = '';

    renderLogs();
});

function ensureLogoutLinkLogs() {
    try {
        const navActions = document.querySelector('.navbar-actions');
        if (!navActions) return;
        if (navActions.querySelector('.logout-link')) return;
        const a = document.createElement('a');
        a.href = '/auth/logout';
        a.className = 'btn-ghost logout-link';
        a.textContent = 'Logout';
        a.addEventListener('click', (e) => {
            setTimeout(() => { window.location.href = '/auth/logout'; }, 50);
        });
        navActions.appendChild(a);
    } catch (e) {
    }
}

ensureLogoutLinkLogs();
