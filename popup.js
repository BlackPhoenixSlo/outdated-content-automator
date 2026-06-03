document.addEventListener('DOMContentLoaded', async () => {
    const startBtn = document.getElementById('start');
    const stopBtn = document.getElementById('stop');
    const statusDiv = document.getElementById('status');
    const linksArea = document.getElementById('links');

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

    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "update_status") {
            statusDiv.innerText = `Running... (${message.currentIndex}/${message.total})`;
        } else if (message.action === "done") {
            updateStatus();
        } else if (message.action === "error") {
            statusDiv.innerText = message.message || "Stopped due to an error.";
            startBtn.disabled = false;
        }
    });

    // Send steady state UI update if they open popup while running
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.currentIndex || changes.isRunning) {
            updateStatus();
        }
    });
});
