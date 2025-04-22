function extractUserEmail() {
  try {
    // Use the direct selector that returns email
    const emailElement = document.querySelector('span[ng-bind="ctrl.currentGaiaUser.email"]');
    if (emailElement && emailElement.innerHTML) {
      const email = emailElement.innerHTML.trim();
      if (email.includes('@')) {
        chrome.storage.sync.set({ 'gtmUserEmail': email });
        console.log('GTM Publish Monitor: Email found:', email);
        return email;
      }
    }
    
  } catch (error) {
    console.error('Error extracting email:', error);
  }
  
  return null;
}

// Run when page is loaded
setTimeout(extractUserEmail, 2000);

// Re-run when DOM changes to catch email if it loads later
const observer = new MutationObserver(() => {
  extractUserEmail();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});