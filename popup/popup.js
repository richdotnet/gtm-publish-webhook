const webhookUrlsKey = 'webhookUrls';
const consoleLoggingKey = 'consoleLogging';

// Helper function to check if a value matches a filter pattern
function matchesFilter(filter, value) {
  if (!filter || filter === '') return true;
  try {
    return new RegExp(filter).test(value);
  } catch (e) {
    return filter.split('|').includes(value);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // DOM element references
  const elements = {
    // Main page elements
    saveButton: document.getElementById('save-button'),
    statusDot: document.querySelector('.status-dot'),
    statusText: document.getElementById('status-text'),
    addWebhookButton: document.getElementById('add-webhook'),
    webhooksContainer: document.getElementById('webhooks-container'),
    toast: document.getElementById('toast'),
    mainPage: document.getElementById('main-page'),
    settingsButton: document.getElementById('settings-button'),
    
    // Settings page elements
    settingsPage: document.getElementById('settings-page'),
    backButton: document.getElementById('back-button'),
    testSavedOption: document.getElementById('test-saved'),
    testManualOption: document.getElementById('test-manual'),
    manualUrlContainer: document.getElementById('manual-url-container'),
    manualWebhookUrl: document.getElementById('manual-webhook-url'),
    sendTestButton: document.getElementById('send-test'),
    consoleLoggingCheckbox: document.getElementById('console-logging'),
    debugSaveButton: document.getElementById('debug-save-button'),
    savedWebhooksContainer: document.getElementById('saved-webhooks-dropdown-container'),
    
    // Dropdown elements
    selectSelected: document.querySelector('.select-selected'),
    selectItems: document.querySelector('.select-items'),
    selectOptions: document.querySelector('.select-options'),
    searchInput: document.querySelector('.search-input'),
    selectText: document.querySelector('.select-text'),
    
    // Templates
    webhookTemplate: document.getElementById('webhook-template')
  };
  
  // Global state
  let savedWebhooks = [];
  let selectedWebhookUrl = null;

  // Initialize UI and load data
  initUI();
  loadSavedWebhooks();

  function initUI() {
    // Initialize dropdown functionality
    initDropdown();
    
    // Set up page navigation
    elements.settingsButton.addEventListener('click', () => {
      showSettingsPage();
    });
    
    elements.backButton.addEventListener('click', () => {
      showMainPage();
    });
    
    // Debug save button
    elements.debugSaveButton.addEventListener('click', () => {
      saveConsoleLoggingPreference();
      showToast(elements.consoleLoggingCheckbox.checked ? 'Console logging enabled' : 'Console logging disabled');
      showMainPage();
    });
    
    // Test option radio buttons
    elements.testSavedOption.addEventListener('change', () => {
      if (elements.testSavedOption.checked) {
        elements.savedWebhooksContainer.classList.remove('hidden');
        elements.manualUrlContainer.classList.add('hidden');
      }
    });
    
    elements.testManualOption.addEventListener('change', () => {
      if (elements.testManualOption.checked) {
        elements.savedWebhooksContainer.classList.add('hidden');
        elements.manualUrlContainer.classList.remove('hidden');
      }
    });
    
    // Add webhook button
    elements.addWebhookButton.addEventListener('click', () => {
      addWebhookGroup();
    });
    
    // Save button
    elements.saveButton.addEventListener('click', () => {
      saveWebhooks()
        .then(success => {
          if (success) {
            elements.statusDot.classList.add('active');
            elements.statusText.textContent = 'Monitoring active';
            showToast('Settings saved successfully');
          }
        })
        .catch(() => {
          showToast('Error saving settings. Please try again.', true);
        });
    });
    
    // Send test button
    elements.sendTestButton.addEventListener('click', () => {
      if (elements.testSavedOption.checked) {
        if (!selectedWebhookUrl) {
          showToast('Please select a webhook to test', true);
          return;
        }
        sendTestWebhook(selectedWebhookUrl);
      } else {
        const url = elements.manualWebhookUrl.value.trim();
        if (!url) {
          showToast('Please enter a webhook URL', true);
          return;
        }
        sendTestWebhook(url, true);
      }
    });
  }
  
  // Initialize dropdown behavior
  function initDropdown() {
    elements.selectSelected.addEventListener('click', () => {
      const isHidden = elements.selectItems.classList.contains('hidden');
      closeAllDropdowns();
      
      if (isHidden) {
        elements.selectItems.classList.remove('hidden');
        elements.selectSelected.classList.add('active');
        elements.searchInput.focus();
      }
    });
    
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.custom-select')) {
        closeAllDropdowns();
      }
    });
    
    elements.searchInput.addEventListener('input', () => {
      filterWebhookOptions(elements.searchInput.value.toLowerCase().trim());
    });
  }
  
  function closeAllDropdowns() {
    document.querySelectorAll('.select-items').forEach(dropdown => {
      dropdown.classList.add('hidden');
    });
    
    document.querySelectorAll('.select-selected').forEach(trigger => {
      trigger.classList.remove('active');
    });
  }
  
  function showMainPage() {
    elements.settingsPage.classList.add('hidden');
    elements.mainPage.classList.remove('hidden');
  }
  
  function showSettingsPage() {
    elements.mainPage.classList.add('hidden');
    elements.settingsPage.classList.remove('hidden');
    populateWebhooksDropdown();
    loadConsoleLoggingPreference();
  }

  // Load saved webhook URLs with conditions
  function loadSavedWebhooks() {
    chrome.storage.sync.get([webhookUrlsKey], (data) => {
      const webhooks = data[webhookUrlsKey] || [];
      
      if (webhooks.length === 0) {
        // Add an empty webhook if none exist
        addWebhookGroup();
      } else {
        // Add inputs for each saved webhook
        webhooks.forEach(webhook => {
          if (typeof webhook === 'string') {
            // Handle legacy format (just URL string)
            addWebhookGroup(webhook);
          } else {
            // Handle new format with conditions
            addWebhookGroup(webhook.url, webhook.accountFilter, webhook.containerFilter);
          }
        });
        
        // Update status indicator
        elements.statusDot.classList.add('active');
        elements.statusText.textContent = 'Monitoring active';
      }
    });
  }

  // Console logging preference
  function loadConsoleLoggingPreference() {
    chrome.storage.sync.get([consoleLoggingKey], (data) => {
      // Default to true (enabled) if not set
      elements.consoleLoggingCheckbox.checked = data[consoleLoggingKey] !== false;
      
      // Log the initial state if enabled
      if (elements.consoleLoggingCheckbox.checked) {
        console.log('GTM Publish Webhook: Console logging is enabled');
      }
    });
  }
  
  function saveConsoleLoggingPreference() {
    const isEnabled = elements.consoleLoggingCheckbox.checked;
    chrome.storage.sync.set({ [consoleLoggingKey]: isEnabled }, () => {
      if (isEnabled) {
        console.log('GTM Publish Webhook: Console logging preference saved:', isEnabled);
      }
    });
  }
  
  // Webhook management
  function addWebhookGroup(url = '', accountFilter = '', containerFilter = '') {
    // Clone the template
    const clone = document.importNode(elements.webhookTemplate.content, true);
    const webhookGroup = clone.querySelector('.webhook-group');
    
    // Set values
    clone.querySelector('.webhook-url').value = url;
    clone.querySelector('.account-filter').value = accountFilter;
    clone.querySelector('.container-filter').value = containerFilter;
    
    // Add remove handler
    clone.querySelector('.remove-webhook').addEventListener('click', () => {
      webhookGroup.remove();
    });
    
    // Add toggle handler
    const conditionToggle = clone.querySelector('.condition-toggle');
    const conditionInputs = clone.querySelector('.condition-inputs');
    
    conditionToggle.addEventListener('click', () => {
      const isVisible = conditionInputs.style.display === 'block';
      conditionInputs.style.display = isVisible ? 'none' : 'block';
      conditionToggle.classList.toggle('expanded', !isVisible);
    });
    
    // If we have filter values, expand by default
    if (accountFilter || containerFilter) {
      conditionInputs.style.display = 'block';
      conditionToggle.classList.add('expanded');
    }
    
    elements.webhooksContainer.appendChild(webhookGroup);
  }

  function collectWebhooks() {
    const webhooks = [];
    
    document.querySelectorAll('.webhook-group').forEach(group => {
      const url = group.querySelector('.webhook-url').value.trim();
      
      if (url) {
        webhooks.push({
          url,
          accountFilter: group.querySelector('.account-filter').value.trim(),
          containerFilter: group.querySelector('.container-filter').value.trim()
        });
      }
    });
    
    return webhooks;
  }

  function saveWebhooks() {
    const webhooks = collectWebhooks();
    
    // Process URLs to ensure they have protocols and validate
    for (let i = 0; i < webhooks.length; i++) {
      let processedUrl = webhooks[i].url;
      if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
        processedUrl = 'http://' + processedUrl;
        webhooks[i].url = processedUrl;
      }
      
      try {
        new URL(processedUrl);
      } catch (e) {
        showToast(`Invalid URL format: ${webhooks[i].url}`, true);
        return Promise.resolve(false);
      }
    }
    
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [webhookUrlsKey]: webhooks }, () => {
        logToConsole('Webhooks saved:', webhooks);
        resolve(true);
      });
    });
  }
  
  // Test webhook functionality
  function populateWebhooksDropdown() {
    // Reset state
    selectedWebhookUrl = null;
    elements.selectText.textContent = 'Select webhook...';
    elements.searchInput.value = '';
    elements.selectOptions.innerHTML = '';
    
    chrome.storage.sync.get([webhookUrlsKey], (data) => {
      savedWebhooks = data[webhookUrlsKey] || [];
      
      if (savedWebhooks.length === 0) {
        const noWebhooksMsg = document.createElement('div');
        noWebhooksMsg.className = 'no-webhooks-message';
        noWebhooksMsg.textContent = 'No webhooks saved yet';
        elements.selectOptions.appendChild(noWebhooksMsg);
        return;
      }
      
      // Add each webhook as an option
      savedWebhooks.forEach((webhook, index) => {
        const webhookUrl = typeof webhook === 'string' ? webhook : webhook.url;
        addWebhookOption(webhookUrl, index === 0);
      });
    });
  }
  
  function addWebhookOption(url, isFirst = false) {
    const option = document.createElement('div');
    option.className = 'select-option';
    option.textContent = truncateUrl(url);
    option.setAttribute('data-value', url);
    option.setAttribute('title', url);
    
    // Select first option by default
    if (isFirst && !selectedWebhookUrl) {
      option.classList.add('selected');
      selectedWebhookUrl = url;
      elements.selectText.textContent = truncateUrl(url);
      elements.selectText.setAttribute('title', url);
    }
    
    // Set click handler
    option.addEventListener('click', () => {
      // Update selected state
      document.querySelectorAll('.select-option').forEach(opt => {
        opt.classList.remove('selected');
      });
      option.classList.add('selected');
      
      // Update selected value
      selectedWebhookUrl = url;
      elements.selectText.textContent = truncateUrl(url);
      elements.selectText.setAttribute('title', url);
      
      // Close dropdown
      closeAllDropdowns();
    });
    
    elements.selectOptions.appendChild(option);
  }
  
  function filterWebhookOptions(searchTerm) {
    const options = elements.selectOptions.querySelectorAll('.select-option');
    const noResultsMsg = elements.selectOptions.querySelector('.no-results-message');
    
    if (noResultsMsg) noResultsMsg.remove();
    let hasVisibleOptions = false;
    
    options.forEach(option => {
      const optionText = option.textContent.toLowerCase();
      const optionValue = option.getAttribute('data-value').toLowerCase();
      const isMatch = optionText.includes(searchTerm) || optionValue.includes(searchTerm);
      
      option.style.display = isMatch ? '' : 'none';
      if (isMatch) hasVisibleOptions = true;
    });
    
    // Show no results message if needed
    if (!hasVisibleOptions && savedWebhooks.length > 0) {
      const noResults = document.createElement('div');
      noResults.className = 'no-results-message';
      noResults.textContent = 'No matching webhooks found';
      elements.selectOptions.appendChild(noResults);
    }
  }
  
  // Consolidated function to send test webhooks
  function sendTestWebhook(url, isManual = false) {
    // Process URL to ensure it has protocol
    let processedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      processedUrl = 'http://' + url;
    }
    
    // Validate URL for manual entry
    if (isManual) {
      try {
        new URL(processedUrl);
      } catch (e) {
        showToast('Invalid URL format', true);
        return;
      }
    }
    
    // Create test payload
    const testPayload = {
      event: "gtm_container_published",
      account_id: "test_account",
      container_id: "test_container",
      user_email: "test@example.com",
      timestamp: new Date().toISOString(),
      is_test: true
    };
    
    // Log and update UI
    logToConsole(`Sending test to ${isManual ? 'manual' : ''} webhook:`, processedUrl);
    logToConsole('Test payload:', testPayload);
    elements.sendTestButton.disabled = true;
    elements.sendTestButton.textContent = 'Sending...';
    
    // Send request
    fetch(processedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    })
    .then(response => {
      if (response.ok) {
        showToast('Test sent successfully');
        logToConsole('Test sent successfully to:', processedUrl);
      } else {
        showToast(`Failed to send test: ${response.status} ${response.statusText}`, true);
        logToConsole('Test failed:', response.status, response.statusText);
      }
    })
    .catch(error => {
      showToast(`Error: ${error.message}`, true);
      logToConsole('Test error:', error);
    })
    .finally(() => {
      elements.sendTestButton.disabled = false;
      elements.sendTestButton.textContent = 'Send Test';
    });
  }
  
  // Helper functions
  function truncateUrl(url) {
    const maxLength = 40;
    return url.length > maxLength ? url.substring(0, maxLength) + '...' : url;
  }
  
  function logToConsole(...args) {
    chrome.storage.sync.get([consoleLoggingKey], (data) => {
      if (data[consoleLoggingKey] !== false) {
        console.log('GTM Publish Webhook:', ...args);
      }
    });
  }

  function showToast(message, isError = false) {
    // Reset and set initial state
    elements.toast.style.display = 'none';
    elements.toast.className = `toast ${isError ? 'error' : ''}`;
    elements.toast.textContent = message;
    
    // Show with animation
    requestAnimationFrame(() => {
      elements.toast.style.display = 'block';
      
      // Small delay to ensure transition works
      setTimeout(() => {
        elements.toast.classList.add('show');
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
          elements.toast.classList.remove('show');
          setTimeout(() => {
            elements.toast.style.display = 'none';
          }, 300); // Transition duration
        }, 3000);
      }, 10);
    });
  }
});