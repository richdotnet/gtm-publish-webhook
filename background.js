const webhookUrlsKey = 'webhookUrls';  // Changed to plural
const userEmailKey = 'gtmUserEmail';

// Function to update the extension's tooltip/hover message
function updateExtensionTooltip() {
  chrome.storage.sync.get([webhookUrlsKey], (data) => {
    const webhookUrls = data[webhookUrlsKey] || [];
    const isActive = webhookUrls.length > 0;
    
    const tooltipMessage = isActive 
      ? `GTM Publish Monitor: Active (${webhookUrls.length} webhook${webhookUrls.length !== 1 ? 's' : ''})`
      : 'GTM Publish Monitor: Inactive (no webhooks configured)';
    
    chrome.action.setTitle({ title: tooltipMessage });
    
    // Optionally update the icon badge
    if (isActive) {
      chrome.action.setBadgeText({ text: webhookUrls.length.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#34a853' }); // Success green
    } else {
      chrome.action.setBadgeText({ text: '' }); // Clear badge
    }
  });
}

// Update tooltip when extension loads
updateExtensionTooltip();

// Listen for changes to webhook URLs and update tooltip
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes[webhookUrlsKey]) {
    updateExtensionTooltip();
  }
});

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.method === 'POST' && details.statusCode === 200) {
      const urlPattern = /https:\/\/tagmanager\.google\.com\/api\/accounts\/([^\/]+)\/containers\/([^\/]+)\/workspaces\/([^\/]+)\/publish/;
      const match = details.url.match(urlPattern);
      
      if (match) {
        const accountId = match[1];
        const containerId = match[2];
        
        // Get both webhook URLs and user email from storage
        chrome.storage.sync.get([webhookUrlsKey, userEmailKey], (data) => {
          const webhookUrls = data[webhookUrlsKey] || [];  // Default to empty array
          const userEmail = data[userEmailKey] || "gtm_user@example.com";
          
          if (webhookUrls.length > 0) {
            const payload = {
              event: "gtm_container_published",
              account_id: accountId,
              container_id: containerId,
              user_email: userEmail,
              timestamp: new Date().toISOString()
            };

            // Send to each webhook URL
            webhookUrls.forEach(webhookUrl => {
              try {
                // Ensure URL has protocol
                let processedUrl = webhookUrl;
                if (!webhookUrl.startsWith('http://') && !webhookUrl.startsWith('https://')) {
                  processedUrl = 'http://' + webhookUrl;
                }
                
                fetch(processedUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(payload)
                })
                .catch(error => {
                  console.error(`Error sending webhook to ${webhookUrl}:`, error);
                });
              } catch (error) {
                console.error(`Error processing webhook URL ${webhookUrl}:`, error);
              }
            });
          }
        });
      }
    }
  },
  { urls: ["https://tagmanager.google.com/*"] }
);