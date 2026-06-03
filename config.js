/* config.js — all wait / timeout values for the automation, in milliseconds.
 *
 * This is the extension's ".env": edit the numbers here to tune speed without
 * touching content.js. Lower = faster (but riskier on slow loads);
 * higher = slower but safer. Must be listed BEFORE content.js in manifest.json.
 */
const OCA_TIMINGS = {
    // --- Core polling ---
    POLL_INTERVAL: 300,            // how often element-waits re-check the page
    FIND_TIMEOUT: 4000,            // default wait for a text element (New request, Submit)

    // --- Per-step pauses ---
    AFTER_NEW_REQUEST: 1350,       // pause after clicking "New request"
    NEXT_TIMEOUT: 1800,            // how long to look for an optional "Next" button
    AFTER_NEXT: 800,              // pause after clicking "Next"
    IMAGE_TAB_TIMEOUT: 2600,       // how long to look for the "Image" tab
    AFTER_IMAGE_TAB: 900,         // pause after clicking the "Image" tab
    AFTER_RADIO: 700,             // pause after selecting the "Copy link address" radio
    AFTER_PASTE: 700,             // pause after pasting the URL (lets Submit enable)

    // --- Final confirm phase (Submit request / verify word / Ok) ---
    // If NO confirmation dialog appears within this window, the submit went
    // through silently — we assume success and move on (Google often submits
    // without showing an "Ok" to click).
    FINAL_PHASE_TIMEOUT: 3000,     // how long to watch for a dialog to FIRST appear
    // Once a dialog HAS appeared, keep handling it (fill word, click Submit
    // request, click Ok) up to this longer cap — so a slow-to-render "Ok"
    // doesn't get abandoned with the dialog left open.
    DIALOG_COMPLETE_TIMEOUT: 12000,
    SUBMIT_REQUEST_TIMEOUT: 500,   // per-check wait for "Submit request"
    AFTER_VERIFY_WORD: 500,        // pause after typing the verification word
    AFTER_SUBMIT_REQUEST: 1000,    // pause after clicking "Submit request"
    OK_TIMEOUT: 500,               // per-check wait for "Ok"
    FINAL_PHASE_LOOP: 500,         // loop delay during the final wait phase

    // --- Between links ---
    BETWEEN_LINKS: 2000,           // pause after Ok, before starting the next link
};
