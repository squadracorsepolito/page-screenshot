// eslint-disable-next-line import/no-unassigned-import
import './options-storage.js';

chrome.action.onClicked.addListener((tab) => {
	if (!tab || !tab.id) return;
	const url = tab.url || '';
	
	// Content scripts work only on http/https pages
	if (!/^https?:\/\//.test(url)) {
		console.warn('Page Screenshot: Extension works only on http/https pages');
		return;
	}
	// Send message to content script (fire-and-forget, no response needed)
	chrome.tabs.sendMessage(tab.id, {action: 'take-screenshot'}).catch((error) => {
		// Handle connection error
		if (error.message?.includes('Receiving end does not exist')) {
			console.warn('Page Screenshot: Content script not loaded yet. Please refresh the page and try again.');
		} else {
			console.error('Page Screenshot: Error -', error.message);
		}
	});
});

// Handle cross-origin image fetching from content script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message && message.action === 'fetch-image' && typeof message.url === 'string') {
		(async () => {
			try {
				const response = await fetch(message.url, {
					mode: 'cors',
					credentials: 'omit',
					cache: 'no-cache',
				});
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const buffer = await response.arrayBuffer();
				const bytes = new Uint8Array(buffer);
				let binary = '';
				for (let i = 0; i < bytes.length; i += 1) {
					binary += String.fromCharCode(bytes[i]);
				}
				const base64 = btoa(binary);
				const contentType = response.headers.get('content-type') || 'application/octet-stream';
				const dataUrl = `data:${contentType};base64,${base64}`;
				sendResponse({dataUrl});
			} catch (error) {
				sendResponse({error: String(error)});
			}
		})();
		// Keep message channel open for async response
		return true;
	}
	return undefined;
});