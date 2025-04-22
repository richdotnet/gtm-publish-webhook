document.addEventListener('DOMContentLoaded', () => {
    const webhookUrlInput = document.getElementById('webhook-url');
    const saveButton = document.getElementById('save-button');
    const testButton = document.getElementById('test-button');
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.getElementById('status-text');
    const webhookUrlKey = 'webhookUrl';
  
    // Load saved webhook URL
    chrome.storage.sync.get(webhookUrlKey, (data) => {
      if (data[webhookUrlKey]) {
        webhookUrlInput.value = data[webhookUrlKey];
        statusDot.classList.add('active');
        statusText.textContent = 'Monitoring active';
      }
    });
  
    // Save webhook URL
    saveButton.addEventListener('click', () => {
      const webhookUrl = webhookUrlInput.value.trim();
      
      if (!webhookUrl) {
        showToast('Please enter a webhook URL', true);
        return;
      }
      
      // Ensure URL has a protocol
      let processedUrl = webhookUrl;
      if (!webhookUrl.startsWith('http://') && !webhookUrl.startsWith('https://')) {
        processedUrl = 'http://' + webhookUrl;
        webhookUrlInput.value = processedUrl;
      }
      
      // Validate URL format
      try {
        new URL(processedUrl);
      } catch (e) {
        showToast('Please enter a valid URL', true);
        return;
      }
      
      chrome.storage.sync.set({ [webhookUrlKey]: processedUrl }, () => {
        statusDot.classList.add('active');
        statusText.textContent = 'Monitoring active';
        showToast('Webhook URL saved successfully');
      });
    });
  
    // Test webhook
    testButton.addEventListener('click', () => {
      const webhookUrl = webhookUrlInput.value.trim();
      
      if (!webhookUrl) {
        showToast('Please enter a webhook URL', true);
        return;
      }
      
      // Ensure URL has a protocol - SAME LOGIC AS SAVE BUTTON
      let processedUrl = webhookUrl;
      if (!webhookUrl.startsWith('http://') && !webhookUrl.startsWith('https://')) {
        processedUrl = 'http://' + webhookUrl;
      }
      
      // Validate URL format
      try {
        new URL(processedUrl);
      } catch (e) {
        showToast('Please enter a valid URL', true);
        return;
      }
      
      const testPayload = {
        event: "gtm_container_published",
        account_id: "test_account",
        container_id: "test_container",
        user_email: "test@example.com",
        timestamp: new Date().toISOString(),
        is_test: true
      };
      
      testButton.textContent = 'Sending...';
      testButton.disabled = true;
      
      // Use processedUrl instead of webhookUrl
      fetch(processedUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testPayload)
      })
      .then(response => {
        if (response.ok) {
          showToast('Test webhook sent successfully');
        } else {
          showToast(`Error: ${response.status} ${response.statusText}`, true);
        }
      })
      .catch(error => {
        showToast(`Error: ${error.message}`, true);
      })
      .finally(() => {
        testButton.textContent = 'Test Webhook';
        testButton.disabled = false;
      });
    });
  
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
  });