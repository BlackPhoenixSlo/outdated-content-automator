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
function __tFlushLog() {
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
            chrome.runtime.sendMessage({ action: "update_status", currentIndex, total: links.length });
            state = await chrome.storage.local.get('isRunning');
            isRunning = state.isRunning;
            continue;
        }

        tlog(`=== START link #${currentIndex} ${link}`);

        // Safety net (#3): a dialog from the PREVIOUS link may still be open if a
        // popup rendered after our confirm window (slow page) or won't auto-close
        // (e.g. "Invalid URL" with only Cancel/Back). Dismiss it — scoped to the
        // dialog so we never touch a pending request's controls — so step 1 can
        // click a real "New request" instead of one hidden behind the modal.
        const leftover = document.querySelector('[role="dialog"]');
        if (leftover && leftover.offsetParent !== null) {
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
            break;
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
            break;
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
            } else {
                console.error("Submit button is disabled or not found.");
                break;
            }
        } else {
            console.error("Could not find Submit button");
            break;
        }

        // 6. Wait for "Submit request" or "Ok"
        tlog('waiting for "Submit request"/"Ok" confirmation');
        const finalPhaseStart = Date.now();
        let okClicked = false;
        let sawDialog = false; // becomes true once any confirmation dialog shows

        // Keep looping while: not done yet AND
        //  - no dialog has appeared and we're still inside the short detect
        //    window (FINAL_PHASE_TIMEOUT), OR
        //  - a dialog HAS appeared and we're still inside the longer completion
        //    cap (DIALOG_COMPLETE_TIMEOUT). This way a slow "Ok" is never
        //    abandoned, but a silent submit is skipped quickly.
        const keepWaiting = () => {
            if (okClicked) return false;
            const elapsed = Date.now() - finalPhaseStart;
            return sawDialog
                ? elapsed < OCA_TIMINGS.DIALOG_COMPLETE_TIMEOUT
                : elapsed < OCA_TIMINGS.FINAL_PHASE_TIMEOUT;
        };

        while (keepWaiting()) {
            // Check if "Submit request" popped up
            const submitRequestSpan = await waitForElementText('span.VfPpkd-vQzf8d', 'Submit request', OCA_TIMINGS.SUBMIT_REQUEST_TIMEOUT);
            if (submitRequestSpan) {
                sawDialog = true;
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
                await delay(OCA_TIMINGS.AFTER_SUBMIT_REQUEST); // Give it time to transition to "Ok"
            }

            // Now check for "Ok"
            const okSpan = await waitForElementText('span.VfPpkd-vQzf8d', 'Ok', OCA_TIMINGS.OK_TIMEOUT);
            if (okSpan) {
                sawDialog = true;
                okSpan.closest('button').click();
                tlog(`clicked "Ok" - submission CONFIRMED for ${link}`);
                okClicked = true;
            }

            await delay(OCA_TIMINGS.FINAL_PHASE_LOOP);
        }

        if (!okClicked) {
            // No "Ok"/"Submit request" dialog appeared in the window. Google
            // usually just submits silently, so we treat this as success and
            // move on rather than wasting time waiting for a button that never
            // shows. (The URL was already recorded right after Submit.)
            tlog(`no confirmation within ${OCA_TIMINGS.FINAL_PHASE_TIMEOUT}ms - assuming submitted OK, moving on`);
        }

        await delay(OCA_TIMINGS.BETWEEN_LINKS); // Wait for modal to close fully before next loop
        tlog(`=== END link #${currentIndex} (next loop starts now)`);

        // Update state to next link
        currentIndex++;
        await chrome.storage.local.set({ currentIndex });
        chrome.runtime.sendMessage({ action: "update_status", currentIndex, total: links.length });

        state = await chrome.storage.local.get('isRunning');
        isRunning = state.isRunning;
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
