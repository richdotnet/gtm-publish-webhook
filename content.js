function extractUserEmail() {
    try {
        if (typeof preloadData === 'object' && preloadData.email) {
            const email = preloadData.email;
            chrome.storage.sync.set({ 'gtmUserEmail': email });
            return email;
        }
    } catch (error) {
        // Silent error in production
    }

    // Fallback: try to extract email from DOM
    try {
        const publishedByElement = document.querySelector('div[data-ng-if*="ctrl.publishedVersion.versionLastPublishedTime"]');
        if (publishedByElement && publishedByElement.textContent) {
            const publishText = publishedByElement.textContent.trim();
            const emailMatch = publishText.match(/by\s+([^\s]+@[^\s]+)/i);
            
            if (emailMatch && emailMatch[1]) {
                const email = emailMatch[1];
                chrome.storage.sync.set({ 'gtmUserEmail': email });
                return email;
            }
        }
    } catch (error) {
        // Silent error in production
    }

    return null;
}

// Initial check
setTimeout(() => {
    extractUserEmail();
}, 2000);

// Re-run when DOM changes to catch information if it loads later
const observer = new MutationObserver(() => {
    extractUserEmail();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});