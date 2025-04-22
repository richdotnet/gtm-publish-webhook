const webhookUrlKey = 'webhookUrl';

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.method === 'POST' && details.statusCode === 200) {
      const urlPattern = /https:\/\/tagmanager\.google\.com\/api\/accounts\/([^\/]+)\/containers\/([^\/]+)\/workspaces\/([^\/]+)\/publish/;
      const match = details.url.match(urlPattern);
      
      if (match) {
        const accountId = match[1];
        const containerId = match[2];
        // Note: details.initiator doesn't contain user email, we'll use a placeholder
        const userEmail = "gtm_user@example.com"; // In production, this would need to come from another source

        chrome.storage.sync.get(webhookUrlKey, (data) => {
          const webhookUrl = data[webhookUrlKey];
          
          if (webhookUrl) {
            try {
              // Ensure URL has protocol
              let processedUrl = webhookUrl;
              if (!webhookUrl.startsWith('http://') && !webhookUrl.startsWith('https://')) {
                processedUrl = 'http://' + webhookUrl;
              }
              
              const payload = {
                event: "gtm_container_published",
                account_id: accountId,
                container_id: containerId,
                user_email: userEmail,
                timestamp: new Date().toISOString()
              };

              fetch(processedUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
              })
              .catch(error => {
                console.error('Error sending webhook:', error);
              });
            } catch (error) {
              console.error('Error processing webhook URL:', error);
            }
          }
        });
      }
    }
  },
  { urls: ["https://tagmanager.google.com/*"] }
);