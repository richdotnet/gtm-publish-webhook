const webhookUrlsKey = 'webhookUrls';

document.addEventListener('DOMContentLoaded', () => {
  const saveButton = document.getElementById('save-button');
  const testButton = document.getElementById('test-button');
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.getElementById('status-text');
  const addWebhookButton = document.getElementById('add-webhook');
  const webhooksContainer = document.getElementById('webhooks-container');

  // Load saved webhook URLs
  chrome.storage.sync.get([webhookUrlsKey], (data) => {
    const webhookUrls = data[webhookUrlsKey] || [];
    
    if (webhookUrls.length === 0) {
      // Add an empty webhook input if none exist
      addWebhookInput();
    } else {
      // Add inputs for each saved webhook
      webhookUrls.forEach(url => {
        addWebhookInput(url);
      });
      
      // Update status indicator
      statusDot.classList.add('active');
      statusText.textContent = 'Monitoring active';
    }

    // Update remove button visibility
    updateRemoveButtonVisibility();
  });

  // Add webhook button click handler
  addWebhookButton.addEventListener('click', () => {
    addWebhookInput();
    updateRemoveButtonVisibility();
  });

  // Save webhook URLs
  saveButton.addEventListener('click', () => {
    saveWebhooks().then(success => {
      if (success) {
        statusDot.classList.add('active');
        statusText.textContent = 'Monitoring active';
        showToast('Webhook URLs saved successfully');
      }
    });
  });

  // Test webhooks
  testButton.addEventListener('click', () => {
    const urls = collectWebhookUrls();
    
    if (urls.length === 0) {
      showToast('Please enter at least one webhook URL', true);
      return;
    }
    
    testButton.textContent = 'Sending...';
    testButton.disabled = true;
    
    let successCount = 0;
    let failCount = 0;
    let connectionRefusedCount = 0;
    
    const testPromises = urls.map(url => {
      // Ensure URL has a protocol
      let processedUrl = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        processedUrl = 'http://' + url;
      }
      
      // Validate URL format
      try {
        new URL(processedUrl);
      } catch (e) {
        failCount++;
        return Promise.resolve({ url, error: 'Invalid URL format' });
      }
      
      const testPayload = {
        event: "gtm_container_published",
        account_id: "test_account",
        container_id: "test_container",
        user_email: "test@example.com",
        timestamp: new Date().toISOString(),
        is_test: true
      };

      return fetch(processedUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testPayload)
      })
      .then(response => {
        if (response.ok) {
          successCount++;
          return { url, success: true };
        } else {
          failCount++;
          return { url, error: `Server returned ${response.status}: ${response.statusText}` };
        }
      })
      .catch(error => {
        failCount++;
        
        // Detect connection refused errors
        if (error.message && (
            error.message.includes('ERR_CONNECTION_REFUSED') || 
            error.message.includes('Failed to fetch'))) {
          connectionRefusedCount++;
          return { url, error: 'Connection refused', isConnectionError: true };
        }
        
        return { url, error: error.message || 'Unknown network error' };
      });
    });
    
    Promise.all(testPromises)
      .then((results) => {
        if (failCount === 0) {
          showToast(`Test webhooks sent successfully to ${successCount} endpoint${successCount !== 1 ? 's' : ''}`);
        } else if (successCount === 0) {
          if (connectionRefusedCount > 0) {
            // Show more helpful message for connection errors
            showToast(`Connection refused: No server running at ${connectionRefusedCount === 1 ? 'the specified URL' : 'the specified URLs'}`, true);
            showDevelopmentHelp();
          } else {
            showToast(`Failed to send test webhooks to all ${failCount} endpoint${failCount !== 1 ? 's' : ''}`, true);
          }
        } else {
          showToast(`Sent to ${successCount}, failed for ${failCount} endpoint${failCount !== 1 ? 's' : ''}`, true);
        }
      })
      .finally(() => {
        testButton.textContent = 'Test Webhooks';
        testButton.disabled = false;
      });
  });

  function addWebhookInput(url = '') {
    const inputGroup = document.createElement('div');
    inputGroup.className = 'webhook-input-group';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = url;
    input.placeholder = 'Enter webhook URL';
    input.className = 'webhook-url';
    
    const removeButton = document.createElement('button');
    removeButton.textContent = '×';
    removeButton.title = 'Remove webhook';
    removeButton.className = 'remove-webhook';
    removeButton.addEventListener('click', () => {
      inputGroup.remove();
      updateRemoveButtonVisibility();
    });
    
    inputGroup.appendChild(input);
    inputGroup.appendChild(removeButton);
    webhooksContainer.appendChild(inputGroup);
  }

  function updateRemoveButtonVisibility() {
    const inputs = document.querySelectorAll('.webhook-input-group');
    const removeButtons = document.querySelectorAll('.remove-webhook');
    
    // Hide all remove buttons if there's only one input
    if (inputs.length <= 1) {
      removeButtons.forEach(btn => {
        btn.style.display = 'none';
      });
    } else {
      removeButtons.forEach(btn => {
        btn.style.display = 'block';
      });
    }
  }

  function collectWebhookUrls() {
    const inputs = document.querySelectorAll('.webhook-url');
    return Array.from(inputs)
      .map(input => input.value.trim())
      .filter(url => url !== ''); // Remove empty entries
  }

  function saveWebhooks() {
    const urls = collectWebhookUrls();
    
    // Process URLs to ensure they have protocols
    const processedUrls = urls.map(url => {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return 'http://' + url;
      }
      return url;
    });
    
    // Validate URLs
    const invalidUrls = processedUrls.filter(url => {
      try {
        new URL(url);
        return false; // URL is valid
      } catch (e) {
        return true; // URL is invalid
      }
    });
    
    if (invalidUrls.length > 0) {
      showToast('Some URLs are invalid. Please check and try again.', true);
      return Promise.resolve(false);
    }
    
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [webhookUrlsKey]: processedUrls }, () => {
        // The tooltip will be automatically updated by the background script
        // through the storage.onChanged listener
        resolve(true);
      });
    });
  }

  // Show toast message
  function showToast(message, isError = false) {
    // Remove existing toast if any
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    // Create new toast
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Show toast with slight delay for animation
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    // Hide toast after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }

  // Helper function to show development setup hint
  function showDevelopmentHelp() {
    // Create a help message for local development
    const helpDiv = document.createElement('div');
    helpDiv.className = 'help-message';
    helpDiv.innerHTML = `
      <p><strong>Using localhost?</strong></p>
      <p>Make sure your server is running and accessible at the URL you entered.</p>
      <p>For local development:</p>
      <ul>
        <li>Verify your server is running</li>
        <li>Check that it's listening on the correct port</li>
        <li>Ensure no firewall is blocking connections</li>
      </ul>
      <button id="dismiss-help" class="secondary-button">Dismiss</button>
    `;
    
    document.body.appendChild(helpDiv);
    
    document.getElementById('dismiss-help').addEventListener('click', () => {
      helpDiv.remove();
    });
  }
});