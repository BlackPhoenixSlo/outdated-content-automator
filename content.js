/* content.js for Outdated Content Automator */

const delay = ms => new Promise(res => setTimeout(res, ms));

// Timestamped logger. Shows wall-clock time, ms since process start,
// and ms since the previous log call so you can spot slow steps.
// Lines are also buffered into chrome.storage.local under 'runLog' so the
// popup can download them as log.txt.
let __tProcessStart = null;
let __tLastLog = null;
let __tLogLines = [];
let __tLogFlushPending = false;
let __tLogSeeded = false;
// On page load, seed the in-memory buffer from the persisted log so a reload
// (e.g. stall recovery, or an accidental refresh) APPENDS to the existing log
// instead of overwriting it. We hold off flushing until this completes so the
// first write can't clobber prior history.
chrome.storage.local.get('runLog', (res) => {
    const prior = Array.isArray(res.runLog) ? res.runLog : [];
    __tLogLines = prior.concat(__tLogLines);
    __tLogSeeded = true;
    __tFlushLog();
});
function __tFlushLog() {
    if (!__tLogSeeded) return;     // wait until prior log is loaded, so we append not overwrite
    // Coalesce rapid writes into a single storage set.
    if (__tLogFlushPending) return;
    __tLogFlushPending = true;
    setTimeout(() => {
        __tLogFlushPending = false;
        chrome.storage.local.set({ runLog: __tLogLines });
    }, 250);
}
function tlog(label) {
    const now = Date.now();
    if (__tProcessStart === null) { __tProcessStart = now; __tLastLog = now; }
    const sinceStart = now - __tProcessStart;
    const sincePrev = now - __tLastLog;
    __tLastLog = now;
    const clock = new Date(now).toLocaleTimeString('en-GB', { hour12: false }) +
        '.' + String(now % 1000).padStart(3, '0');
    const line = `[OCA ${clock}] +${sinceStart}ms (dt=${sincePrev}ms) ${label}`;
    console.log(line);
    __tLogLines.push(line);
    __tFlushLog();
}

async function waitForElementText(selector, text, timeout = OCA_TIMINGS.FIND_TIMEOUT) {
    const start = Date.now();
    const target = text.toLowerCase();
    while (Date.now() - start < timeout) {
        const els = Array.from(document.querySelectorAll(selector));
        // Match VISIBLE elements only (offsetParent !== null). This prevents
        // clicking a stale/hidden span left over from a previous dialog (#4),
        // and makes "New request" (step 1) wait for a leftover modal to truly
        // close before matching the real, clickable button (#3).
        const el = els.find(e => e.offsetParent !== null && e.innerText && e.innerText.trim().toLowerCase() === target);
        if (el) return el;
        await delay(OCA_TIMINGS.POLL_INTERVAL);
    }
    return null;
}

// Synchronous (no waiting) lookup of a VISIBLE span with exact text. Used in
// the tight confirm loop so the grace window isn't padded by blocking polls.
function findVisibleText(text) {
    const target = text.toLowerCase();
    return Array.from(document.querySelectorAll('span.VfPpkd-vQzf8d'))
        .find(e => e.offsetParent !== null && e.innerText && e.innerText.trim().toLowerCase() === target) || null;
}

// True while Google's "Checking page URL" loading dialog is up (progress bar +
// Cancel). We must NEVER click in this state and NEVER treat it as done — the
// submit is still being processed. Detected by a visible dialog that contains a
// progress bar, or whose text says "checking".
function isCheckingDialog() {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg || dlg.offsetParent === null) return false;
    if (dlg.querySelector('[role="progressbar"]')) return true;
    return (dlg.innerText || '').toLowerCase().includes('checking');
}

// Handle a stall: the "New request" dialog/form didn't open in time (no
// "Next"/"Image" tab/URL field). Almost always the tab was backgrounded and
// Chrome throttled it. We wait a short cooldown and retry the SAME link, up to
// STALL_MAX_RETRIES times, logging every attempt. Returns:
//   'reload'  - page is reloading; caller must return (auto-resume retries)
//   'retry'   - retry the same link in place; caller should `continue`
//   'giveup'  - retries exhausted (or stopped); caller should break the run
async function handleStall(currentIndex, link, reason) {
    const key = `stallRetries_${currentIndex}`;
    const store = await chrome.storage.local.get(key);
    const tries = (store[key] || 0) + 1;
    await chrome.storage.local.set({ [key]: tries });

    if (tries > OCA_TIMINGS.STALL_MAX_RETRIES) {
        tlog(`STALL on link #${currentIndex} (${reason}) - GAVE UP after ${tries - 1} retries`);
        await chrome.storage.local.set({ isRunning: false });
        await ocaFlushSync();
        chrome.runtime.sendMessage({ action: "stalled", currentIndex, link, reason, retries: tries - 1 });
        return 'giveup';
    }

    const secs = Math.round(OCA_TIMINGS.STALL_COOLDOWN / 1000);
    tlog(`STALL on link #${currentIndex} (${reason}) - retry ${tries}/${OCA_TIMINGS.STALL_MAX_RETRIES} in ${secs}s`);
    chrome.runtime.sendMessage({ action: "cooldown", currentIndex, link, seconds: secs, retry: tries, max: OCA_TIMINGS.STALL_MAX_RETRIES });
    await ocaFlushSync();
    await delay(OCA_TIMINGS.STALL_COOLDOWN);

    // The user may have hit Stop during the wait.
    const s = await chrome.storage.local.get('isRunning');
    if (!s.isRunning) { tlog('stopped during cooldown - not retrying'); return 'giveup'; }

    if (OCA_TIMINGS.RELOAD_ON_STALL) {
        tlog(`cooldown elapsed - reloading page to retry link #${currentIndex}`);
        location.reload(); // auto-resume on load re-runs startProcess at the same currentIndex
        return 'reload';
    }
    tlog(`cooldown elapsed - retrying link #${currentIndex} in place`);
    return 'retry';
}

// Ensure process loops through links
async function startProcess() {
    let state = await chrome.storage.local.get(['links', 'currentIndex', 'isRunning', 'verifyWord']);
    let { links, currentIndex, isRunning, verifyWord } = state;

    if (!isRunning || !links || currentIndex >= links.length) return;

    // Persisted log of every URL we've successfully submitted. Used to skip
    // duplicates if the same link is added again in a later run. ocaLoadSubmitted
    // restores it from the sync backup if local was wiped (extension reload).
    const submittedSet = new Set(await ocaLoadSubmitted());

    while (currentIndex < links.length && isRunning) {
        const link = links[currentIndex];

        // Skip links we've already submitted in any previous run.
        if (submittedSet.has(link)) {
            tlog(`=== SKIP already-submitted link #${currentIndex} ${link}`);
            currentIndex++;
            await chrome.storage.local.set({ currentIndex });
            // Re-read links too, so links appended mid-run ("Add links") are picked up.
            state = await chrome.storage.local.get(['isRunning', 'links']);
            isRunning = state.isRunning;
            links = state.links || links;
            chrome.runtime.sendMessage({ action: "update_status", currentIndex, total: links.length });
            continue;
        }

        tlog(`=== START link #${currentIndex} ${link}`);

        // Safety net (#3): a dialog from the PREVIOUS link may still be open if a
        // popup rendered after our confirm window (slow page) or won't auto-close
        // (e.g. "Invalid URL" with only Cancel/Back). Dismiss it — scoped to the
        // dialog so we never touch a pending request's controls — so step 1 can
        // click a real "New request" instead of one hidden behind the modal.
        // If a URL check is somehow still running, WAIT for it — never cancel a
        // live check.
        if (isCheckingDialog()) {
            tlog('leftover "checking" dialog still up - waiting for it to finish');
            const waitStart = Date.now();
            while (isCheckingDialog() && Date.now() - waitStart < OCA_TIMINGS.CHECK_TIMEOUT) {
                await delay(OCA_TIMINGS.FINAL_PHASE_LOOP);
            }
        }
        const leftover = document.querySelector('[role="dialog"]');
        if (leftover && leftover.offsetParent !== null && !isCheckingDialog()) {
            const dismiss = ['Ok', 'Cancel', 'Back', 'Discard']
                .map(t => Array.from(leftover.querySelectorAll('span.VfPpkd-vQzf8d, button'))
                    .find(e => e.offsetParent !== null && e.innerText && e.innerText.trim().toLowerCase() === t.toLowerCase()))
                .find(Boolean);
            if (dismiss) {
                (dismiss.closest('button') || dismiss).click();
                tlog('dismissed leftover dialog before starting link');
                await delay(OCA_TIMINGS.AFTER_NEW_REQUEST);
            }
        }

        // 1. Click "New request"
        tlog('waiting for "New request" button');
        const newReqSpan = await waitForElementText('span.VfPpkd-vQzf8d', 'New request');
        if (!newReqSpan) {
            console.error("Could not find 'New request' button.");
            const r = await handleStall(currentIndex, link, 'New request button missing');
            if (r === 'reload') return;   // page reloading; auto-resume continues
            if (r === 'giveup') break;
            continue;                     // retry same link in place
        }
        newReqSpan.closest('button').click();
        tlog('clicked "New request"');
        await delay(OCA_TIMINGS.AFTER_NEW_REQUEST);

        // Optional: Check if "Next" button appears right away
        tlog('waiting for "Next" button (New Request dialog)');
        const nextBtnSpan = await waitForElementText('span.VfPpkd-vQzf8d', 'Next', OCA_TIMINGS.NEXT_TIMEOUT);
        if (nextBtnSpan) {
            nextBtnSpan.closest('button').click();
            tlog('clicked "Next"');
            await delay(OCA_TIMINGS.AFTER_NEXT);
        } else {
            tlog('"Next" NOT found within NEXT_TIMEOUT');
        }

        // 2. Click "Image" tab/option
        tlog('waiting for "Image" tab');
        let imageTab = await waitForElementText('.VfPpkd-vQzf8d, [role="tab"] span, span[jsname="V67aGc"], span.VfPpkd-YVzG2b', 'Image', OCA_TIMINGS.IMAGE_TAB_TIMEOUT);
        if (!imageTab) {
            // fallback using user's explicit jsname for Image
            const ksKsZd = document.querySelector('span[jsname="ksKsZd"]');
            if (ksKsZd) imageTab = ksKsZd;
            if (!imageTab) {
                const tabs = Array.from(document.querySelectorAll('button[role="tab"]'));
                imageTab = tabs.find(t => t.innerText && t.innerText.includes('Image'));
            }
        }

        if (imageTab) {
            let clickable = imageTab.closest('[role="tab"]') || imageTab.closest('button') || imageTab;
            clickable.click();
            tlog('clicked "Image" tab');
            await delay(OCA_TIMINGS.AFTER_IMAGE_TAB);
        } else {
            tlog('"Image" tab NOT found, continuing anyway');
            console.error("Could not find Image tab, but continuing anyway.");
        }

        // 3. Second option (Radio button)
        // Try clicking the radio input directly, or its exact label container
        let secondOptionClicked = false;

        // 1. Try finding input[type="radio"][value="XYxcBb"] directly
        const radioInput = document.querySelector('input[type="radio"][value="XYxcBb"]');
        if (radioInput) {
            radioInput.click();
            secondOptionClicked = true;
            await delay(OCA_TIMINGS.AFTER_RADIO);
        }

        // 2. Try label text matching again if input wasn't found/didn't work
        if (!secondOptionClicked) {
            const labels = Array.from(document.querySelectorAll('label.VfPpkd-V67aGc, label, span'));
            const radioLabel = labels.find(l => l.innerText && l.innerText.includes('Copy link address'));
            if (radioLabel) {
                // Try clicking the label
                radioLabel.click();

                // Also trigger click on previous sibling if it's the custom google radio div
                if (radioLabel.previousElementSibling) {
                    radioLabel.previousElementSibling.click();
                }
                await delay(OCA_TIMINGS.AFTER_RADIO);
            } else {
                console.error("Second option element not found directly or by label.");
            }
        }

        tlog(secondOptionClicked ? 'radio option clicked' : 'radio option NOT clicked');

        // 4. Paste link
        tlog('locating URL input field');
        const inputField = document.querySelector('input[placeholder="Search results URL"]')
            || document.querySelector('input.VfPpkd-fmcmS-wGMbrd')
            || document.querySelector('input[jsname="YPqjbf"][type="text"]');

        if (!inputField) {
            console.error("Could not find input field for URL.");
            const r = await handleStall(currentIndex, link, 'URL input field missing (dialog did not open)');
            if (r === 'reload') return;   // page reloading; auto-resume continues
            if (r === 'giveup') break;
            continue;                     // retry same link in place
        }

        inputField.focus();

        // Use native setter to bypass React/Angular event traps
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(inputField, link);
        } else {
            inputField.value = link;
        }

        inputField.dispatchEvent(new Event('input', { bubbles: true }));
        inputField.dispatchEvent(new Event('change', { bubbles: true }));
        inputField.blur();
        tlog('pasted URL into input field');

        await delay(OCA_TIMINGS.AFTER_PASTE);

        // 5. Submit
        tlog('waiting for "Submit" button');
        const submitSpan = await waitForElementText('span.VfPpkd-vQzf8d', 'Submit');
        if (submitSpan) {
            const btn = submitSpan.closest('button');
            if (btn && !btn.disabled) {
                btn.click();
                tlog('clicked "Submit"');
                // Record this URL right after the submit "shot" is fired, so it
                // is skipped if added again — even if the "Ok" confirmation
                // can't be detected later (it often times out but still submits).
                submittedSet.add(link);
                await ocaSaveSubmitted(Array.from(submittedSet));
                tlog(`recorded submitted URL ${link}`);
                // Submission went through: clear any stall counter for this index.
                chrome.storage.local.remove(`stallRetries_${currentIndex}`);
            } else {
                console.error("Submit button is disabled or not found.");
                const r = await handleStall(currentIndex, link, 'Submit button disabled/not found');
                if (r === 'reload') return;
                if (r === 'giveup') break;
                continue;
            }
        } else {
            console.error("Could not find Submit button");
            const r = await handleStall(currentIndex, link, 'Submit button missing');
            if (r === 'reload') return;
            if (r === 'giveup') break;
            continue;
        }

        // 6. Confirm. After Submit, Google often shows a "Checking page URL"
        //    loading dialog (progress bar + Cancel). We MUST wait that out —
        //    never click during it, never move on — or the next link's cleanup
        //    would hit its "Cancel" and abort the submit. Only once it clears do
        //    we look for "Submit request"/"Ok"; if none shows, it submitted
        //    silently.
        tlog('confirming (checking page URL / Submit request / Ok)');
        const phaseStart = Date.now();
        let okClicked = false;
        let everChecked = false;  // did we see the "Checking page URL" dialog?
        let checkDoneAt = null;   // when checking finished (for the grace window)

        while (!okClicked) {
            const now = Date.now();

            // (a) Still actively checking the URL — wait it out, touch nothing.
            if (isCheckingDialog()) {
                everChecked = true;
                checkDoneAt = null;
                if (now - phaseStart >= OCA_TIMINGS.CHECK_TIMEOUT) {
                    tlog(`"Checking page URL" exceeded ${OCA_TIMINGS.CHECK_TIMEOUT}ms - moving on`);
                    break;
                }
                tlog('checking page URL... waiting');
                await delay(OCA_TIMINGS.FINAL_PHASE_LOOP);
                continue;
            }

            // Mark the instant checking finished, so we grace-wait for "Ok".
            if (everChecked && checkDoneAt === null) checkDoneAt = now;

            // (b) "Submit request" confirmation (may include the verify-word box).
            const submitRequestSpan = findVisibleText('Submit request');
            if (submitRequestSpan) {
                console.log("Found 'Submit request' confirmation.");

                // Check if there's a verification word text input
                const dialog = submitRequestSpan.closest('[role="dialog"]') || document;
                const wordInput = dialog.querySelector('input[type="text"][jsname="YPqjbf"]:not([placeholder="Search results URL"]), input[type="text"].VfPpkd-fmcmS-wGMbrd:not([placeholder="Search results URL"])');

                if (wordInput && wordInput.offsetParent !== null && verifyWord) { // visible and word provided
                    console.log(`Found verification word input, entering '${verifyWord}'`);
                    wordInput.focus();
                    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                    if (nativeSetter) {
                        nativeSetter.call(wordInput, verifyWord);
                    } else {
                        wordInput.value = verifyWord;
                    }
                    wordInput.dispatchEvent(new Event('input', { bubbles: true }));
                    wordInput.dispatchEvent(new Event('change', { bubbles: true }));
                    wordInput.blur();
                    await delay(OCA_TIMINGS.AFTER_VERIFY_WORD);
                }

                submitRequestSpan.closest('button').click();
                await delay(OCA_TIMINGS.AFTER_SUBMIT_REQUEST); // may kick off another "Checking" pass
                continue; // re-loop: there may be another check, then "Ok"
            }

            // (c) Success "Ok".
            const okSpan = findVisibleText('Ok');
            if (okSpan) {
                okSpan.closest('button').click();
                tlog(`clicked "Ok" - submission CONFIRMED for ${link}`);
                okClicked = true;
                break;
            }

            // (d) Nothing actionable on screen — decide whether to stop waiting.
            const elapsed = now - phaseStart;
            if (everChecked) {
                // Checking finished and no confirm dialog within the grace window
                // → silent success.
                if (checkDoneAt !== null && now - checkDoneAt >= OCA_TIMINGS.AFTER_CHECK_GRACE) {
                    tlog('check finished, no confirm dialog - assuming submitted OK');
                    break;
                }
            } else if (elapsed >= OCA_TIMINGS.FINAL_PHASE_TIMEOUT) {
                // Never saw a checking dialog and nothing showed → silent success.
                tlog(`no dialog within ${OCA_TIMINGS.FINAL_PHASE_TIMEOUT}ms - assuming submitted OK`);
                break;
            }

            await delay(OCA_TIMINGS.FINAL_PHASE_LOOP);
        }

        // After a real "Ok" the success modal is closing, so pause for it.
        // After a silent success the grace window already served as the gap, so
        // go straight to the next link (step 1 waits for a visible "New request"
        // anyway, and cleans up any leftover dialog first).
        if (okClicked) {
            await delay(OCA_TIMINGS.BETWEEN_LINKS);
        }
        tlog(`=== END link #${currentIndex} (next loop starts now)`);

        // Update state to next link
        currentIndex++;
        await chrome.storage.local.set({ currentIndex });

        // Re-read links too, so links appended mid-run ("Add links") are picked up.
        state = await chrome.storage.local.get(['isRunning', 'links']);
        isRunning = state.isRunning;
        links = state.links || links;
        chrome.runtime.sendMessage({ action: "update_status", currentIndex, total: links.length });
    }

    // Make sure any debounced sync backup is written before we stop.
    await ocaFlushSync();

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

// Auto-resume an in-progress run after a page reload. Stall recovery reloads the
// GSC page to reset Google's SPA, and this picks the run back up at the same
// currentIndex. Also recovers from an accidental refresh while running.
(async () => {
    const { isRunning } = await chrome.storage.local.get('isRunning');
    if (isRunning) {
        tlog('page loaded with isRunning=true - auto-resuming run');
        startProcess();
    }
})();
