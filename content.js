/* content.js for Outdated Content Automator */

const delay = ms => new Promise(res => setTimeout(res, ms));

// Short pause after a click so Google's dialog/animation can settle before we
// query for the next element. This prevents matching a button mid-transition
// (which was clicking the wrong button and triggering "Something went wrong").
const SETTLE = 600;

// Generic poll: returns the element as soon as it exists (poll every 150ms).
async function waitForElement(selector, timeout = 6000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const el = document.querySelector(selector);
        if (el) return el;
        await delay(150);
    }
    return null;
}

// True if the element is actually visible on screen (not a hidden sibling input).
function isVisible(el) {
    return !!el && el.offsetParent !== null;
}

// Wait specifically for the VISIBLE "Search results URL" input. The dialog keeps
// the other radio's inputs (Image URL / Containing page URL) in the DOM too, so
// we must pick the right, visible one — not just the first match.
async function waitForUrlInput(timeout = 6000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        // Most specific first: the placeholder is unique to this box.
        const byPlaceholder = Array.from(document.querySelectorAll('input[placeholder="Search results URL"]'));
        const visible = byPlaceholder.find(isVisible);
        if (visible) return visible;

        // Fallback: any visible text input inside the open dialog.
        const dialog = document.querySelector('[role="dialog"]') || document;
        const candidate = Array.from(dialog.querySelectorAll('input[type="text"]')).find(isVisible);
        if (candidate) return candidate;

        await delay(150);
    }
    return null;
}

// Wait for an element whose trimmed text matches `text` (poll every 150ms).
async function waitForElementText(selector, text, timeout = 6000) {
    const start = Date.now();
    const target = text.toLowerCase();
    while (Date.now() - start < timeout) {
        const els = Array.from(document.querySelectorAll(selector));
        const el = els.find(e => e.innerText && e.innerText.trim().toLowerCase() === target);
        if (el) return el;
        await delay(150);
    }
    return null;
}

// Detect Google's "Something went wrong" error banner/dialog.
function pageHasError() {
    const text = (document.body.innerText || '').toLowerCase();
    return text.includes('something went wrong');
}

// Ensure process loops through links
async function startProcess() {
    let state = await chrome.storage.local.get(['links', 'currentIndex', 'isRunning', 'verifyWord']);
    let { links, currentIndex, isRunning, verifyWord } = state;

    if (!isRunning || !links || currentIndex >= links.length) return;

    while (currentIndex < links.length && isRunning) {
        const link = links[currentIndex];
        console.log("Processing link:", link);

        // Bail out cleanly if Google is showing an error — let the user reset.
        if (pageHasError()) {
            console.error("Google is showing 'Something went wrong'. Stopping so you can reload the page.");
            await chrome.storage.local.set({ isRunning: false });
            chrome.runtime.sendMessage({ action: "error", message: "Google error: 'Something went wrong'. Reload the page and press Start again." });
            return;
        }

        // 1. Click "New request"
        const newReqSpan = await waitForElementText('span.VfPpkd-vQzf8d', 'New request');
        if (!newReqSpan) {
            console.error("Could not find 'New request' button.");
            break;
        }
        newReqSpan.closest('button').click();
        await delay(SETTLE); // let the dialog open before looking for Next/Image

        // Optional: "Next" button may appear in the dialog
        const nextBtnSpan = await waitForElementText('span.VfPpkd-vQzf8d', 'Next', 2500);
        if (nextBtnSpan) {
            nextBtnSpan.closest('button').click();
            await delay(SETTLE);
        }

        // 2. Click "Image" tab/option (wait until it shows up)
        let imageTab = await waitForElementText('.VfPpkd-vQzf8d, [role="tab"] span, span[jsname="V67aGc"], span.VfPpkd-YVzG2b', 'Image', 4000);
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
            await delay(SETTLE); // let the Image panel render before clicking the radio
        } else {
            console.error("Could not find Image tab, but continuing anyway.");
        }

        // 3. Second option (Radio button) — wait for it, then click
        let secondOptionClicked = false;
        const radioInput = await waitForElement('input[type="radio"][value="XYxcBb"]', 4000);
        if (radioInput) {
            radioInput.click();
            secondOptionClicked = true;
            await delay(SETTLE);
        }

        // Fallback: label text matching if input wasn't found/didn't work
        if (!secondOptionClicked) {
            const labels = Array.from(document.querySelectorAll('label.VfPpkd-V67aGc, label, span'));
            const radioLabel = labels.find(l => l.innerText && l.innerText.includes('Copy link address'));
            if (radioLabel) {
                radioLabel.click();
                if (radioLabel.previousElementSibling) {
                    radioLabel.previousElementSibling.click();
                }
                await delay(SETTLE);
            } else {
                console.error("Second option element not found directly or by label.");
            }
        }

        // 4. Paste link — wait for the VISIBLE "Search results URL" input
        const inputField = await waitForUrlInput(4000);

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
        await delay(SETTLE); // give Google a moment to validate the URL / enable Submit

        // 5. Submit — wait for it, and wait until it's enabled
        let submitSpan = await waitForElementText('span.VfPpkd-vQzf8d', 'Submit');
        let btn = submitSpan ? submitSpan.closest('button') : null;
        if (btn) {
            const enableStart = Date.now();
            while (btn.disabled && Date.now() - enableStart < 4000) {
                await delay(150);
            }
            if (!btn.disabled) {
                btn.click();
            } else {
                console.error("Submit button stayed disabled.");
                break;
            }
        } else {
            console.error("Could not find Submit button");
            break;
        }

        // 6. Wait for "Submit request" confirmation and/or "Ok"
        const finalPhaseStart = Date.now();
        let okClicked = false;

        while (Date.now() - finalPhaseStart < 15000 && !okClicked) {
            // Check if "Submit request" popped up
            const submitRequestSpan = await waitForElementText('span.VfPpkd-vQzf8d', 'Submit request', 500);
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
                    await delay(SETTLE);
                }

                submitRequestSpan.closest('button').click();
                await delay(SETTLE);
            }

            // Now check for "Ok"
            const okSpan = await waitForElementText('span.VfPpkd-vQzf8d', 'Ok', 500);
            if (okSpan) {
                okSpan.closest('button').click();
                console.log("Clicked Ok for link:", link);
                okClicked = true;
            }
        }

        if (!okClicked) {
            console.error("Could not find OK button after submission within timeout.");
        }

        // Update state to next link
        currentIndex++;
        await chrome.storage.local.set({ currentIndex });
        chrome.runtime.sendMessage({ action: "update_status", currentIndex, total: links.length });

        state = await chrome.storage.local.get('isRunning');
        isRunning = state.isRunning;

        // Wait for the modal to fully close (New request ready again) before next link
        await delay(SETTLE);
        await waitForElementText('span.VfPpkd-vQzf8d', 'New request', 5000);
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
