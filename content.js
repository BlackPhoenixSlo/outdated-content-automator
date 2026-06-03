/* content.js for Outdated Content Automator */

const delay = ms => new Promise(res => setTimeout(res, ms));

// Tiny pause after a click so we don't grab the very same frame's transitioning
// element. The real waiting is done by the adaptive polls below, which proceed
// the instant the next element is visible.
const SETTLE = 150;

// Adaptive poll: checks fast at first (50ms), then backs off toward 400ms if
// nothing shows up yet. Returns the truthy result of check() as soon as it's
// found, or null on timeout. This is the "fast, then wait & recheck" behavior.
async function adaptivePoll(check, timeout = 6000) {
    const start = Date.now();
    let interval = 50;
    while (Date.now() - start < timeout) {
        const result = check();
        if (result) return result;
        await delay(interval);
        interval = Math.min(interval + 50, 400);
    }
    return null;
}

// True if the element is actually visible on screen (not a hidden sibling).
function isVisible(el) {
    return !!el && el.offsetParent !== null;
}

// Click an element without ever throwing. Finds the nearest real clickable
// (button / role=button), falling back to the element itself. Returns true if
// something was clicked. Never lets a null/odd DOM kill the whole loop.
function safeClick(el) {
    try {
        if (!el) return false;
        const clickable = el.closest('button') || el.closest('[role="button"]') || el.closest('[role="tab"]') || el;
        clickable.click();
        return true;
    } catch (e) {
        console.warn("safeClick failed:", e);
        return false;
    }
}

// Returns the element as soon as it exists (fast, then backs off).
async function waitForElement(selector, timeout = 6000) {
    return adaptivePoll(() => document.querySelector(selector), timeout);
}

// Find a VISIBLE button/span whose trimmed text matches `text` exactly.
// Returns the element (caller clicks via safeClick) or null.
function findByText(text) {
    const target = text.toLowerCase();
    const els = Array.from(document.querySelectorAll('span.VfPpkd-vQzf8d, span[jsname="V67aGc"], button, [role="button"]'));
    return els.find(e => isVisible(e) && e.innerText && e.innerText.trim().toLowerCase() === target) || null;
}

// Wait until a visible element with the given exact text appears.
async function waitForText(text, timeout = 6000) {
    return adaptivePoll(() => findByText(text), timeout);
}

// Click a target and CONFIRM the expected next state appeared. If nothing
// happens within `perAttempt`, click again — this self-heals a click that was
// missed or absorbed by a still-closing modal (the freeze you saw at link 30).
// Returns true once `confirm()` is satisfied, false after all attempts.
async function clickUntil(getTarget, confirm, { attempts = 5, perAttempt = 1500, findTimeout = 7000 } = {}) {
    for (let i = 0; i < attempts; i++) {
        if (confirm()) return true; // already there
        const target = await adaptivePoll(getTarget, findTimeout);
        if (!target) break;
        safeClick(target);
        if (await adaptivePoll(confirm, perAttempt)) return true;
        console.warn(`clickUntil: no response, re-clicking (attempt ${i + 2}/${attempts})`);
    }
    return !!confirm();
}

// Wait specifically for the VISIBLE "Search results URL" input. The dialog keeps
// the other radio's inputs (Image URL / Containing page URL) in the DOM too, so
// we must pick the right, visible one — not just the first match.
async function waitForUrlInput(timeout = 6000) {
    return adaptivePoll(() => {
        const byPlaceholder = Array.from(document.querySelectorAll('input[placeholder="Search results URL"]'));
        const visible = byPlaceholder.find(isVisible);
        if (visible) return visible;

        const dialog = document.querySelector('[role="dialog"]') || document;
        return Array.from(dialog.querySelectorAll('input[type="text"]')).find(isVisible) || null;
    }, timeout);
}

// Set an input's value in a way React/Angular notices.
function setInputValue(input, value) {
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
}

// Detect Google's "Something went wrong" error banner/dialog.
function pageHasError() {
    const text = (document.body.innerText || '').toLowerCase();
    return text.includes('something went wrong');
}

// Dismiss any leftover confirmation dialog by clicking "Ok" if present.
function dismissOkIfOpen() {
    const ok = findByText('Ok');
    if (ok) {
        safeClick(ok);
        return true;
    }
    return false;
}

// True if Google is showing the "Invalid page URL" / invalid-URL rejection.
function hasInvalidUrlDialog() {
    const text = (document.body.innerText || '').toLowerCase();
    return text.includes('invalid page url')
        || text.includes('url you provided is invalid')
        || text.includes('invalid url');
}

// True if Google is showing the "Image URL provided — enter URL of page
// containing this image" dialog (appears for direct image URLs).
function hasImageUrlDialog() {
    const text = (document.body.innerText || '').toLowerCase();
    return text.includes('image url provided')
        || text.includes('url of page containing this image');
}

// Pause for `ms`, but bail out early if the user pressed Stop. Returns true if
// the full pause elapsed, false if Stop was pressed during it.
async function pauseWithStopCheck(ms) {
    const start = Date.now();
    while (Date.now() - start < ms) {
        const s = await chrome.storage.local.get('isRunning');
        if (!s.isRunning) return false;
        await delay(500);
    }
    return true;
}

// Find a visible button BY TEXT but only INSIDE the open dialog — so we never
// accidentally click a "Cancel" link belonging to a pending request out on the
// main page.
function findInDialog(text) {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return null;
    const target = text.toLowerCase();
    return Array.from(dialog.querySelectorAll('span.VfPpkd-vQzf8d, span[jsname="V67aGc"], button, [role="button"]'))
        .find(e => isVisible(e) && e.innerText && e.innerText.trim().toLowerCase() === target) || null;
}

// Get the UI back to the main page (where "New request" is clickable) after a
// dialog left it stuck — e.g. the invalid-URL popup, which has Cancel/Back and
// no "Ok". We click the dismiss button INSIDE the dialog, in priority order,
// and repeat until "New request" reappears.
async function recoverToMainPage() {
    for (let i = 0; i < 8; i++) {
        if (findByText('New request')) return true; // back on the main page

        // Only dialog-scoped buttons, so we never cancel a real pending request.
        const btn = findInDialog('Discard')
            || findInDialog('Cancel')
            || findInDialog('Back')
            || findInDialog('Ok');
        if (btn) safeClick(btn);

        await delay(SETTLE);
    }
    return !!findByText('New request');
}

// Process a SINGLE link. Returns true on success, false if a step failed.
// Throws are caught by the caller so one bad link never freezes the run.
async function processLink(link, verifyWord) {
    // 1. Click "New request" — retry until the dialog actually opens. If the
    //    first click lands in a still-closing modal it does nothing, so we
    //    re-click rather than freeze (this is what stalled at link 30).
    const dialogOpened = () =>
        !!(findByText('Image') || findByText('Next') || document.querySelector('input[type="radio"][value="XYxcBb"]'));
    const opened = await clickUntil(() => findByText('New request'), dialogOpened, { perAttempt: 800 });
    if (!opened) {
        console.error("'New request' dialog didn't open after retries.");
        return false;
    }

    // Optional: "Next" button may already be showing in the dialog
    const nextBtnSpan = findByText('Next');
    if (nextBtnSpan) {
        safeClick(nextBtnSpan);
        await delay(SETTLE);
    }

    // 2. Click the "Image" tab — CONFIRM the image options actually appeared
    //    (the radio / "Copy link address" option). Re-clicks if nothing changed.
    const imageOpened = () =>
        !!(document.querySelector('input[type="radio"][value="XYxcBb"]')
            || findByText('Copy link address')
            || document.querySelector('input[placeholder="Search results URL"]'));
    const imageOk = await clickUntil(
        () => findByText('Image') || document.querySelector('span[jsname="ksKsZd"]'),
        imageOpened,
        { perAttempt: 1200 }
    );
    if (!imageOk) {
        console.error("Image options never appeared.");
        return false;
    }

    // 3. Select the "Copy link address" radio — CONFIRM the URL box appears as a
    //    result. This is what was being skipped past; now we verify it took.
    const urlBoxReady = () => isVisible(document.querySelector('input[placeholder="Search results URL"]'));
    let radioOk = await clickUntil(
        () => document.querySelector('input[type="radio"][value="XYxcBb"]'),
        urlBoxReady,
        { perAttempt: 1200 }
    );
    if (!radioOk) {
        // Fallback: click the label text instead of the input.
        const labels = Array.from(document.querySelectorAll('label.VfPpkd-V67aGc, label, span'));
        const radioLabel = labels.find(l => l.innerText && l.innerText.includes('Copy link address'));
        if (radioLabel) {
            safeClick(radioLabel);
            if (radioLabel.previousElementSibling) safeClick(radioLabel.previousElementSibling);
            radioOk = await adaptivePoll(urlBoxReady, 3000);
        }
    }
    if (!radioOk) {
        console.error("'Copy link address' option / URL box never became ready.");
        return false;
    }

    // 4. Paste link into the VISIBLE "Search results URL" input, then CONFIRM the
    //    value actually landed in the box before moving on.
    const inputField = await waitForUrlInput(4000);
    if (!inputField) {
        console.error("Could not find input field for URL.");
        return false;
    }
    setInputValue(inputField, link);
    const valueLanded = await adaptivePoll(() => inputField.value === link, 2000);
    if (!valueLanded) {
        // Try once more — some fields swallow the first programmatic set.
        setInputValue(inputField, link);
        await adaptivePoll(() => inputField.value === link, 2000);
    }
    await delay(SETTLE); // let Google validate the URL / enable Submit

    // 5. Submit — wait for it, and wait until it's enabled
    const submitSpan = await waitForText('Submit');
    const submitBtn = submitSpan ? (submitSpan.closest('button') || submitSpan) : null;
    if (!submitBtn) {
        console.error("Could not find Submit button");
        return false;
    }
    const enableStart = Date.now();
    while (submitBtn.disabled && Date.now() - enableStart < 4000) {
        await delay(150);
    }
    if (submitBtn.disabled) {
        console.error("Submit button stayed disabled.");
        return false;
    }
    safeClick(submitBtn);

    // CRUCIAL: wait for the post-submit dialog to actually render before acting.
    // The bot is fast enough to otherwise race past a slow "Image URL provided"
    // popup. We don't proceed until one of the known next states is on screen.
    await adaptivePoll(
        () => hasImageUrlDialog() || hasInvalidUrlDialog() || findInDialog('Submit request') || findByText('Ok'),
        7000
    );

    // 6. Handle "Image URL provided" / "Submit request" confirmation / "Ok"
    const finalPhaseStart = Date.now();
    let okClicked = false;

    while (Date.now() - finalPhaseStart < 15000 && !okClicked) {
        // Google rejected the URL — treat as failure so the caller retries.
        if (hasInvalidUrlDialog()) {
            console.warn("Invalid page URL:", link);
            await recoverToMainPage();
            return false;
        }

        // "Image URL provided" — Google wants a containing-page URL. We only
        // have the image link, so put that in the box and submit.
        if (hasImageUrlDialog()) {
            const dialog = document.querySelector('[role="dialog"]');
            const pageInput = dialog && Array.from(dialog.querySelectorAll('input[type="text"]')).find(isVisible);
            if (pageInput) {
                console.log("Image URL dialog — filling page-URL box with the link.");
                setInputValue(pageInput, link);
                await delay(SETTLE);
            }
            const srBtn = findInDialog('Submit request');
            if (srBtn) {
                const b = srBtn.closest('button') || srBtn;
                const t0 = Date.now();
                while (b.disabled && Date.now() - t0 < 3000) await delay(150);
                safeClick(b);
                await delay(SETTLE);
            }
            await delay(200);
            continue; // re-loop to catch the success "Ok"
        }

        // "Submit request" confirmation (may include a verification-word input)
        const submitRequestSpan = findByText('Submit request');
        if (submitRequestSpan) {
            const dialog = submitRequestSpan.closest('[role="dialog"]') || document;
            const wordInput = dialog.querySelector('input[type="text"][jsname="YPqjbf"]:not([placeholder="Search results URL"]), input[type="text"].VfPpkd-fmcmS-wGMbrd:not([placeholder="Search results URL"])');
            if (isVisible(wordInput) && verifyWord) {
                console.log(`Entering verification word '${verifyWord}'`);
                setInputValue(wordInput, verifyWord);
                await delay(SETTLE);
            }
            safeClick(submitRequestSpan);
            await delay(SETTLE);
        }

        // Success dialog → "Ok"
        const okSpan = findByText('Ok');
        if (okSpan) {
            safeClick(okSpan);
            console.log("Clicked Ok for link:", link);
            okClicked = true;
            break;
        }

        await delay(200);
    }

    if (!okClicked) {
        console.error("No OK/confirmation seen within timeout — moving on.");
        // Clear whatever dialog is open so the next link can start clean.
        await recoverToMainPage();
    }

    return okClicked;
}

// Guard so only ONE loop can ever run in this tab. Two concurrent loops share
// the same currentIndex and make the counter jump/repeat (and double-submit).
let loopRunning = false;

// Main loop over all links.
async function startProcess() {
    if (loopRunning) {
        console.warn("startProcess already running — ignoring duplicate start.");
        return;
    }
    loopRunning = true;
    try {
        await runLoop();
    } finally {
        loopRunning = false;
    }
}

async function runLoop() {
    let state = await chrome.storage.local.get(['links', 'currentIndex', 'isRunning', 'verifyWord']);
    let { links, currentIndex, isRunning, verifyWord } = state;

    if (!isRunning || !links || currentIndex >= links.length) return;

    const MAX_ATTEMPTS = 3;       // tries per link before giving up on it
    const RETRY_PAUSE_MS = 30000; // pause before retrying a failed link

    while (currentIndex < links.length && isRunning) {
        const link = links[currentIndex];
        let success = false;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS && isRunning; attempt++) {
            console.log(`Link ${currentIndex + 1}/${links.length}, attempt ${attempt}/${MAX_ATTEMPTS}:`, link);

            // Hard stop on Google's rate-limit error — retrying won't help here.
            if (pageHasError()) {
                console.error("Google is showing 'Something went wrong'. Stopping.");
                await chrome.storage.local.set({ isRunning: false });
                chrome.runtime.sendMessage({ action: "error", message: "Google error: 'Something went wrong'. Reload the page and press Start again." });
                return;
            }

            // Make sure we're on a clean main page before (re)starting this link.
            if (document.querySelector('[role="dialog"]')) await recoverToMainPage();

            try {
                success = await processLink(link, verifyWord);
            } catch (e) {
                console.error("Error processing link:", link, e);
                success = false;
            }

            if (success) break;

            // Failed — clear any open dialog, then pause and retry the SAME link.
            await recoverToMainPage();
            state = await chrome.storage.local.get('isRunning');
            isRunning = state.isRunning;
            if (!isRunning) break;

            if (attempt < MAX_ATTEMPTS) {
                console.warn(`Link failed — pausing 30s, then retrying from "New request".`);
                chrome.runtime.sendMessage({ action: "status_msg", message: `Link ${currentIndex + 1} failed — pausing 30s, then retry ${attempt + 1}/${MAX_ATTEMPTS}…` });
                const completed = await pauseWithStopCheck(RETRY_PAUSE_MS);
                if (!completed) { isRunning = false; break; }
            } else {
                console.warn(`Link ${currentIndex + 1} failed after ${MAX_ATTEMPTS} attempts — moving on.`);
            }
        }

        // Advance to the next link (succeeded, or exhausted its retries).
        currentIndex++;
        await chrome.storage.local.set({ currentIndex });
        chrome.runtime.sendMessage({ action: "update_status", currentIndex, total: links.length });

        state = await chrome.storage.local.get('isRunning');
        isRunning = state.isRunning;
    }

    if (currentIndex >= links.length) {
        await chrome.storage.local.set({ isRunning: false });
        chrome.runtime.sendMessage({ action: "done" });
        console.log("Finished submitting all links.");
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "start") {
        startProcess();
        sendResponse({ status: "started" });
    }
});
