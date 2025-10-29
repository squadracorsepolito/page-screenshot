import html2canvas from 'html2canvas';
import optionsStorage from './options-storage.js';

function convertAllImagesToBase64(cloned) {
	const pendingImagesPromises = [];
	const pendingPromisesData = [];

	const images = cloned.querySelectorAll('img');

	for (let i = 0; i < images.length; i += 1) {
		const promise = new Promise((resolve, reject) => {
			pendingPromisesData.push({
				index: i,
				resolve,
				reject,
			});
		});
		pendingImagesPromises.push(promise);
	}

	for (const [i, image] of images.entries()) {
		// Fetch via background service worker to avoid CORS issues
		chrome.runtime.sendMessage(
			{action: 'fetch-image', url: image.src},
			(response) => {
				const pending = pendingPromisesData.find((p) => p.index === i);
				if (!response || response.error) {
					// Fallback: keep original src if fetch fails
					pending.resolve(image.src);
				} else {
					image.src = response.dataUrl;
					pending.resolve(response.dataUrl);
				}
			}
		);
	}

	return Promise.all(pendingImagesPromises);
}

chrome.runtime.onMessage.addListener(async (message) => {
	if (message.action === 'take-screenshot') {
		const options = await optionsStorage.getAll();

		html2canvas(document.body, {
			allowTaint: true,
			useCORS: true,
			onclone: convertAllImagesToBase64,
			width: document.body.scrollWidth - 4,
			height: document.body.scrollHeight - 4,
			scrollX: -window.scrollX,
			scrollY: -window.scrollY,
			x: 2,
			y: 2,
			windowWidth: document.documentElement.offsetWidth,
			windowHeight: document.documentElement.offsetHeight,
		}).then((canvas) => {
			canvas.toBlob((blob) => {
				const formData = new FormData();
				const filename = new Date().toISOString() + '.png';
				formData.append('document', blob, filename);

				const queryParameters = new URLSearchParams();
				queryParameters.set('chat_id', options.chatId);
				if (options.topicId && options.topicId !== '') {
					queryParameters.set('message_thread_id', options.topicId);
				}

				const url = new URL(
					'https://api.telegram.org/bot' + options.botToken + '/sendDocument',
				);
				url.search = queryParameters.toString();

				const xhr = new XMLHttpRequest();
				xhr.open('POST', url.toString(), true);

				xhr.send(formData);
			});
		});
	}
});