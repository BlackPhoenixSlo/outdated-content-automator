document.addEventListener('DOMContentLoaded', async () => {
    const startBtn = document.getElementById('start');
    const stopBtn = document.getElementById('stop');
    const dropSavedBtn = document.getElementById('dropSaved');
    const exportSavedBtn = document.getElementById('exportSaved');
    const importSavedBtn = document.getElementById('importSaved');
    const importFile = document.getElementById('importFile');
    const statusDiv = document.getElementById('status');
    const savedInfo = document.getElementById('savedInfo');
    const linksArea = document.getElementById('links');

    const updateSavedInfo = async () => {
        // ocaLoadSubmitted restores from the sync backup if local was wiped.
        const urls = await ocaLoadSubmitted();
        const count = urls.length;
        savedInfo.innerText = `${count} URL${count === 1 ? '' : 's'} saved (will be skipped if re-added). `
            + `⚠️ Back this up yourself with "Export saved" — reloading the extension can wipe it.`;
        dropSavedBtn.disabled = count === 0;
        exportSavedBtn.disabled = count === 0;
    };

    const updateStatus = async () => {
        const res = await chrome.storage.local.get(['links', 'currentIndex', 'isRunning']);
        if (res.isRunning) {
            statusDiv.innerText = `Running... (${res.currentIndex}/${res.links?.length || 0})`;
            startBtn.disabled = true;
        } else {
            statusDiv.innerText = res.links && res.currentIndex >= res.links.length
                ? 'Done!' : 'Stopped or Idle.';
            startBtn.disabled = false;
        }
    };

    updateStatus();
    updateSavedInfo();

    dropSavedBtn.addEventListener('click', async () => {
        await ocaSaveSubmittedNow([]);
        statusDiv.innerText = 'Saved URL log cleared (local + sync).';
        updateSavedInfo();
    });

    // Export the saved (already-submitted) URLs to a downloadable file.
    exportSavedBtn.addEventListener('click', async () => {
        const urls = await ocaLoadSubmitted();
        if (urls.length === 0) {
            statusDiv.innerText = 'Nothing to export — no saved URLs yet.';
            return;
        }
        const blob = new Blob([JSON.stringify(urls, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const a = document.createElement('a');
        a.href = url;
        a.download = `oca-saved-urls-${stamp}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        statusDiv.innerText = `Exported ${urls.length} saved URL${urls.length === 1 ? '' : 's'}.`;
    });

    // Import saved URLs from a file and merge them into the existing log.
    importSavedBtn.addEventListener('click', () => importFile.click());

    importFile.addEventListener('change', async () => {
        const file = importFile.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            let incoming;
            // Accept either a JSON array or a plain newline-separated list.
            const trimmed = text.trim();
            if (trimmed.startsWith('[')) {
                incoming = JSON.parse(trimmed);
                if (!Array.isArray(incoming)) throw new Error('JSON is not an array');
            } else {
                incoming = trimmed.split('\n');
            }
            incoming = incoming.map(u => String(u).trim()).filter(Boolean);

            const before = new Set(await ocaLoadSubmitted());
            const sizeBefore = before.size;
            incoming.forEach(u => before.add(u));
            const merged = Array.from(before);
            await ocaSaveSubmittedNow(merged);

            const added = merged.length - sizeBefore;
            statusDiv.innerText = `Imported ${incoming.length} URL${incoming.length === 1 ? '' : 's'} (${added} new, ${incoming.length - added} already saved).`;
            updateSavedInfo();
        } catch (err) {
            statusDiv.innerText = `Import failed: ${err.message}`;
        } finally {
            importFile.value = ''; // allow re-importing the same file
        }
    });

    startBtn.addEventListener('click', async () => {
        const text = linksArea.value;
        const links = text.split('\n').map(l => l.trim()).filter(l => l);
        if (links.length === 0) {
            statusDiv.innerText = "Please enter some valid links.";
            return;
        }

        const verifyWord = document.getElementById('verifyWord').value;

        await chrome.storage.local.set({ links, verifyWord, currentIndex: 0, isRunning: true });
        updateStatus();

        // Start the process in the active tab
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0].url.includes("search.google.com")) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "start" });
            } else {
                statusDiv.innerText = `Please open Google Search Console "Remove Outdated Content" page to run this.`;
                chrome.storage.local.set({ isRunning: false });
                startBtn.disabled = false;
            }
        });
    });

    stopBtn.addEventListener('click', async () => {
        await chrome.storage.local.set({ isRunning: false });
        updateStatus();
    });

    const downloadLogBtn = document.getElementById('downloadLog');
    const clearLogBtn = document.getElementById('clearLog');

    if (downloadLogBtn) {
        downloadLogBtn.addEventListener('click', async () => {
            const { runLog } = await chrome.storage.local.get('runLog');
            const lines = runLog || [];
            if (lines.length === 0) {
                statusDiv.innerText = 'Log is empty — run the process first.';
                return;
            }
            const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const a = document.createElement('a');
            a.href = url;
            a.download = `oca-log-${stamp}.txt`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            statusDiv.innerText = `Downloaded ${lines.length} log lines.`;
        });
    }

    if (clearLogBtn) {
        clearLogBtn.addEventListener('click', async () => {
            await chrome.storage.local.set({ runLog: [] });
            statusDiv.innerText = 'Log cleared.';
        });
    }

    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "update_status") {
            statusDiv.innerText = `Running... (${message.currentIndex}/${message.total})`;
        } else if (message.action === "done") {
            updateStatus();
        } else if (message.action === "cooldown") {
            // Dialog didn't open (tab was likely backgrounded). Retrying shortly.
            statusDiv.innerText = `⏳ Link #${message.currentIndex} stalled. `
                + `Retrying in ${message.seconds}s (attempt ${message.retry}/${message.max}). `
                + `Keep this tab open.`;
        } else if (message.action === "stalled") {
            // Gave up after exhausting retries — tell the user.
            statusDiv.innerText = `⛔ Stopped at link #${message.currentIndex} after ${message.retries} retries `
                + `(${message.reason}). Press Start to resume from this index.`;
            startBtn.disabled = false;
        }
    });

    // Send steady state UI update if they open popup while running
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.currentIndex || changes.isRunning) {
            updateStatus();
        }
        if (changes.submittedUrls) {
            updateSavedInfo();
        }
    });
});
