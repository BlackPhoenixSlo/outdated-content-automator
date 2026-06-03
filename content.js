/* content.js for Outdated Content Automator */

const delay = ms => new Promise(res => setTimeout(res, ms));

async function waitForElementText(selector, text, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const els = Array.from(document.querySelectorAll(selector));
        const el = els.find(e => e.innerText && e.innerText.trim().toLowerCase() === text.toLowerCase());
        if (el) return el;
        await delay(500);
    }
    return null;
}

// Ensure process loops through links
async function startProcess() {
    let state = await chrome.storage.local.get(['links', 'currentIndex', 'isRunning', 'verifyWord']);
    let { links, currentIndex, isRunning, verifyWord } = state;

    if (!isRunning || !links || currentIndex >= links.length) return;

    while (currentIndex < links.length && isRunning) {
        const link = links[currentIndex];
        console.log("Processing link:", link);

        // 1. Click "New request"
        const newReqSpan = await waitForElementText('span.VfPpkd-vQzf8d', 'New request');
        if (!newReqSpan) {
            console.error("Could not find 'New request' button.");
            break;
        }
        newReqSpan.closest('button').click();
        await delay(1500);

        // Optional: Check if "Next" button appears right away
        const nextBtnSpan = await waitForElementText('span.VfPpkd-vQzf8d', 'Next', 2000);
        if (nextBtnSpan) {
            nextBtnSpan.closest('button').click();
            await delay(1000);
        }

        // 2. Click "Image" tab/option
        let imageTab = await waitForElementText('.VfPpkd-vQzf8d, [role="tab"] span, span[jsname="V67aGc"], span.VfPpkd-YVzG2b', 'Image', 3000);
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
            await delay(1000);
        } else {
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
            await delay(1000);
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
                await delay(1000);
            } else {
                console.error("Second option element not found directly or by label.");
            }
        }

        // 4. Paste link
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

        await delay(1000);

        // 5. Submit
        const submitSpan = await waitForElementText('span.VfPpkd-vQzf8d', 'Submit');
        if (submitSpan) {
            const btn = submitSpan.closest('button');
            if (btn && !btn.disabled) {
                btn.click();
            } else {
                console.error("Submit button is disabled or not found.");
                break;
            }
        } else {
            console.error("Could not find Submit button");
            break;
        }

        // 6. Wait for "Submit request" or "Ok"
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
                    await delay(500);
                }

                submitRequestSpan.closest('button').click();
                await delay(1000); // Give it time to transition to "Ok"
            }

            // Now check for "Ok"
            const okSpan = await waitForElementText('span.VfPpkd-vQzf8d', 'Ok', 500);
            if (okSpan) {
                okSpan.closest('button').click();
                console.log("Clicked Ok for link:", link);
                okClicked = true;
            }

            await delay(500);
        }

        if (!okClicked) {
            console.error("Could not find OK button after submission within timeout.");
        }

        await delay(2000); // Wait for modal to close fully before next loop

        // Update state to next link
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
