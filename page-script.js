function capturePreloadData() {
    try {
        if (typeof preloadData === 'object' && preloadData.email) {
            document.dispatchEvent(new CustomEvent('gtm_email_found', {
                detail: { email: preloadData.email }
            }));
            return true;
        }
    } catch (e) {
        console.error('Error capturing preloadData:', e);
    }
    return false;
}

// Run immediately
const found = capturePreloadData();

// Only set up polling if not found immediately
if (!found) {
    let pagePollingCount = 0;
    const pagePoller = setInterval(() => {
        pagePollingCount++;
        if (capturePreloadData() || pagePollingCount >= 100) {
            clearInterval(pagePoller);
        }
    }, 100);
}