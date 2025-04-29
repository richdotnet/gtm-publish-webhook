// Core constants
const webhookUrlsKey = 'webhookUrls';
const userEmailKey = 'gtmUserEmail';
const consoleLoggingKey = 'consoleLogging';
const GTM_API_PATTERN = /https:\/\/tagmanager\.google\.com\/api\/accounts\/([^\/]+)\/containers\/([^\/]+)\/workspaces\/([^\/]+)\/publish/;

// Helper functions
function logToConsole(...args) {
  chrome.storage.sync.get([consoleLoggingKey], (data) => {
    if (data[consoleLoggingKey] === true) {
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
  if (typeof webhook === 'string' && webhook) {
    return addProtocolIfNeeded(webhook);
  }
  
  if (webhook && typeof webhook === 'object' && webhook.url) {
    return addProtocolIfNeeded(webhook.url);
  }
  
  return null;
}

function addProtocolIfNeeded(url) {
  if (!url || typeof url !== 'string') return null;
  return url.startsWith('http://') || url.startsWith('https://') ? url : 'https://' + url;
}

// Badge and tooltip management
function updateExtensionBadge() {
  chrome.storage.sync.get([webhookUrlsKey], (data) => {
    const webhooks = data[webhookUrlsKey] || [];
    const count = webhooks.length;
    const isActive = count > 0;
    
    chrome.action.setBadgeText({ text: isActive ? count.toString() : '' });
    if (isActive) chrome.action.setBadgeBackgroundColor({ color: '#34a853' });
    
    const tooltipMessage = isActive 
      ? `GTM Publish Monitor: Active (${count} webhook${count !== 1 ? 's' : ''})`
      : 'GTM Publish Monitor: Inactive (no webhooks configured)';
    chrome.action.setTitle({ title: tooltipMessage });
  });
}

// Initialize extension
updateExtensionBadge();

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes[webhookUrlsKey]) {
    updateExtensionBadge();
  }
});

// Process webhook payloads
function prepareWebhookPayload(data) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      { 
        'excludeEmail': false,
        'gtmUserEmail': ''
      },
      (settings) => {
        const payload = { ...data };
        
        if (!settings.excludeEmail && settings.gtmUserEmail) {
          payload.user_email = settings.gtmUserEmail;
        }
        
        resolve(payload);
      }
    );
  });
}

// Send payload to webhook
function sendWebhookPayload(webhook, payload) {
  try {
    const processedUrl = processWebhookUrl(webhook);
    
    if (!processedUrl) {
      logToConsole('Invalid webhook URL');
      return;
    }
    
    fetch(processedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(response => {
      logToConsole(
        response.ok 
          ? `Successfully sent to webhook: ${processedUrl}` 
          : `Failed to send to webhook: ${processedUrl} (${response.status})`
      );
    })
    .catch(error => {
      logToConsole('Error sending to webhook:', processedUrl);
    });
  } catch (error) {
    logToConsole('Exception when processing webhook');
  }
}

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
    
    logToConsole('Detected GTM publish event', { accountId, containerId });
    
    // Get webhooks
    chrome.storage.sync.get([webhookUrlsKey], (data) => {
      const webhooks = data[webhookUrlsKey] || [];
      if (webhooks.length === 0) return;
      
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
      
      // Prepare base payload
      const basePayload = {
        event: "gtm_container_published",
        account_id: accountId,
        container_id: containerId,
        timestamp: new Date().toISOString()
      };
      
      // Process the payload to respect email exclusion setting
      prepareWebhookPayload(basePayload).then(finalPayload => {
        logToConsole('Sending payload');
        
        // Send to each matching webhook
        matchingWebhooks.forEach(webhook => {
          sendWebhookPayload(webhook, finalPayload);
        });
      });
    });
  },
  { urls: ["https://tagmanager.google.com/*"] }
);