# GTM Publish Monitor

GTM Publish Monitor is a Chrome extension that monitors Google Tag Manager (GTM) container publishing events. It intercepts network requests to detect when a GTM container is published and sends a notification to a user-configurable webhook.

## Features

- Monitors GTM container publishing events.
- Intercepts HTTP requests to detect successful publishes.
- Sends a customizable JSON payload to a specified webhook URL.

## Files

- **manifest.json**: Configuration file for the Chrome extension.
- **background.js**: Contains the logic for intercepting network requests and sending webhook notifications.
- **options/options.html**: User interface for configuring the webhook URL.
- **options/options.js**: Logic for saving and retrieving the webhook URL from Chrome storage.
- **options/options.css**: Styles for the options page.
- **icons/**: Contains icons for the extension in various sizes.

## Installation Instructions

To install the extension locally via "Load Unpacked Extension" in Chrome:

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable "Developer mode" using the toggle in the top right corner.
3. Click on "Load unpacked" and select the directory containing the project files (`gtm-publish-monitor`).
4. The extension should now be loaded and ready for use.

## Usage

1. After loading the extension, click on the extension icon in the toolbar.
2. Navigate to the options page to configure your webhook URL.
3. Once configured, the extension will monitor GTM container publishing events and send notifications to the specified webhook.

## License

This project is licensed under the MIT License.