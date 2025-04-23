// Core constants
const webhookUrlsKey = 'webhookUrls';
const userEmailKey = 'gtmUserEmail';
const consoleLoggingKey = 'consoleLogging';
const GTM_API_PATTERN = /https:\/\/tagmanager\.google\.com\/api\/accounts\/([^\/]+)\/containers\/([^\/]+)\/workspaces\/([^\/]+)\/publish/;

// Helper functions - consolidated and simplified
function logToConsole(...args) {
  chrome.storage.sync.get([consoleLoggingKey], (data) => {
    if (data[consoleLoggingKey] !== false) {
      console.log('GTM Publish Monitor:', ...args);
    }
  });
}

function matchesFilter(filter, value) {
  if (!filter || filter === '') return true;
  
  try {
    return new RegExp(filter).test(value);
  } catch (e) {
    return filter.split('|').includes(value);
  }
}

function processWebhookUrl(webhook) {
  // Handle string-only webhook format
  if (typeof webhook === 'string' && webhook) {
    return addProtocolIfNeeded(webhook);
  }
  
  // Handle object webhook format
  if (webhook && typeof webhook === 'object' && webhook.url) {
    return addProtocolIfNeeded(webhook.url);
  }
  
  return null;
}

function addProtocolIfNeeded(url) {
  if (!url || typeof url !== 'string') return null;
  return url.startsWith('http://') || url.startsWith('https://') ? url : 'http://' + url;
}

// Badge and tooltip management
function updateExtensionBadge() {
  chrome.storage.sync.get([webhookUrlsKey], (data) => {
    const webhooks = data[webhookUrlsKey] || [];
    const count = webhooks.length;
    const isActive = count > 0;
    
    // Update badge
    chrome.action.setBadgeText({ text: isActive ? count.toString() : '' });
    if (isActive) chrome.action.setBadgeBackgroundColor({ color: '#34a853' });
    
    // Update tooltip
    const tooltipMessage = isActive 
      ? `GTM Publish Monitor: Active (${count} webhook${count !== 1 ? 's' : ''})`
      : 'GTM Publish Monitor: Inactive (no webhooks configured)';
    chrome.action.setTitle({ title: tooltipMessage });
    
    // Log status if enabled
    logToConsole(isActive ? `Extension active with ${count} webhook(s)` : 'Extension inactive - no webhooks configured');
  });
}

// Initialize extension
updateExtensionBadge();

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    // Update badge when webhooks change
    if (changes[webhookUrlsKey]) {
      updateExtensionBadge();
    }
    
    // Log console preference changes
    if (changes[consoleLoggingKey]) {
      const isEnabled = changes[consoleLoggingKey].newValue;
      console.log(`GTM Publish Monitor: Console logging ${isEnabled ? 'enabled' : 'disabled'}`);
    }
  }
});

// Main request handler
chrome.webRequest.onCompleted.addListener(
  (details) => {
    // Only process successful POST requests
    if (details.method !== 'POST' || details.statusCode !== 200) return;
    
    // Check if this is a GTM publish request
    const match = details.url.match(GTM_API_PATTERN);
    if (!match) return;
    
    // Extract IDs from URL
    const [_, accountId, containerId] = match;
    
    logToConsole('Detected GTM publish event', { accountId, containerId, url: details.url });
    
    // Get webhooks and user info
    chrome.storage.sync.get([webhookUrlsKey, userEmailKey], (data) => {
      const webhooks = data[webhookUrlsKey] || [];
      if (webhooks.length === 0) return;
      
      const userEmail = data[userEmailKey] || "gtm_user@example.com";
      
      // Filter webhooks that match this event
      const matchingWebhooks = webhooks.filter(webhook => {
        if (typeof webhook === 'string') return true;
        
        const accountMatches = !webhook.accountFilter || matchesFilter(webhook.accountFilter, accountId);
        const containerMatches = !webhook.containerFilter || matchesFilter(webhook.containerFilter, containerId);
        
        return accountMatches && containerMatches;
      });
      
      if (matchingWebhooks.length === 0) {
        logToConsole('No matching webhooks for this event');
        return;
      }
      
      logToConsole(`Found ${matchingWebhooks.length} matching webhooks for this event`);
      
      // Prepare payload once
      const payload = {
        event: "gtm_container_published",
        account_id: accountId,
        container_id: containerId,
        user_email: userEmail,
        timestamp: new Date().toISOString()
      };
      
      logToConsole('Sending payload:', payload);
      
      // Send to each matching webhook
      matchingWebhooks.forEach(webhook => {
        sendWebhookPayload(webhook, payload);
      });
    });
  },
  { urls: ["https://tagmanager.google.com/*"] }
);

// Send payload to webhook
function sendWebhookPayload(webhook, payload) {
  try {
    const processedUrl = processWebhookUrl(webhook);
    
    if (!processedUrl) {
      logToConsole('Invalid or missing webhook URL');
      return;
    }
    
    logToConsole('Sending to webhook:', processedUrl);
    
    fetch(processedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(response => {
      if (response.ok) {
        logToConsole('Successfully sent to webhook:', processedUrl);
      } else {
        logToConsole('Failed to send to webhook:', processedUrl, response.status, response.statusText);
      }
    })
    .catch(error => {
      logToConsole('Error sending to webhook:', processedUrl, error);
    });
  } catch (error) {
    logToConsole('Exception when processing webhook:', error);
  }
}