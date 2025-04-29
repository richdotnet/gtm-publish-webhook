// Constants
const USER_EMAIL_KEY = 'gtmUserEmail';
const CONSOLE_LOGGING_KEY = 'consoleLogging';

// Conditional logging function
function logToConsole(...args) {
  chrome.storage.sync.get([CONSOLE_LOGGING_KEY], (data) => {
    if (data[CONSOLE_LOGGING_KEY] === true) {
      console.log('GTM Publish Monitor:', ...args);
    }
  });
}

// Setup listener for the email event from the injected script
document.addEventListener('gtm_email_found', (event) => {
  const email = event.detail.email;
  chrome.storage.sync.set({ [USER_EMAIL_KEY]: email });
  logToConsole('Email captured from page context');
});

// Function to inject a script into the page context
function injectScript() {
  const scriptElement = document.createElement('script');
  scriptElement.src = chrome.runtime.getURL('page-script.js');
  (document.head || document.documentElement).appendChild(scriptElement);
  
  // Clean up after script loads
  scriptElement.onload = () => scriptElement.remove();
}

// Call the injection function immediately
try {
  injectScript();
} catch (error) {
  logToConsole('Script injection failed, using fallback');
  extractUserEmail();
}

// DOM-based extraction function as fallback
function extractUserEmail() {
  try {
    const publishedByElement = document.querySelector('div[data-ng-if*="ctrl.publishedVersion.versionLastPublishedTime"]');
    if (publishedByElement?.textContent) {
      const publishText = publishedByElement.textContent.trim();
      const emailMatch = publishText.match(/by\s+([^\s]+@[^\s]+)/i);
      
      if (emailMatch?.[1]) {
        const email = emailMatch[1];
        chrome.storage.sync.set({ [USER_EMAIL_KEY]: email });
        logToConsole('Email extracted from DOM');
        return email;
      }
    }
  } catch (error) {
    logToConsole('DOM extraction failed');
  }
  return null;
}

// Set up optimized MutationObserver as a fallback
let observerTimeout = null;
const observer = new MutationObserver(() => {
  // Debounce the DOM checks to avoid excessive processing
  if (observerTimeout) clearTimeout(observerTimeout);
  
  observerTimeout = setTimeout(() => {
    const email = extractUserEmail();
    if (email) {
      // If email found, disconnect observer as it's no longer needed
      observer.disconnect();
    }
  }, 500); // Wait 500ms before processing DOM changes
});

// Start observing with optimized settings for performance
observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: false, // Don't need character data changes
  attributes: false     // Don't need attribute changes
});

// Auto-disconnect after 60 seconds to prevent memory leaks
setTimeout(() => {
  if (observer) {
    observer.disconnect();
    logToConsole('Observer disconnected after timeout');
  }
}, 60000);