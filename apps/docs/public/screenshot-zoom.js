// App screenshots open at full size in a dialog. Esc, the backdrop or the image closes it.
const shots = document.querySelectorAll('.sl-markdown-content img[src*="/screenshots/"]');

if (shots.length) {
	const dialog = document.createElement('dialog');
	dialog.className = 'shot-dialog';
	dialog.setAttribute('aria-label', 'Screenshot');
	const full = document.createElement('img');
	dialog.append(full);
	dialog.addEventListener('click', () => dialog.close());
	document.body.append(dialog);

	for (const img of shots) {
		const zoom = document.createElement('button');
		zoom.type = 'button';
		zoom.className = 'shot-zoom';
		zoom.setAttribute('aria-label', `Enlarge screenshot: ${img.alt}`);
		img.replaceWith(zoom);
		zoom.append(img);
		zoom.addEventListener('click', () => {
			full.src = img.src;
			full.alt = img.alt;
			dialog.showModal();
		});
	}
}
