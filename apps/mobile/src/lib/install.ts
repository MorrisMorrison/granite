// Getting Granite onto the home screen (pure helpers; the reactive state lives in
// stores/install.svelte.ts). On phones a header button opens the browser's install
// prompt where there is one (Android Chrome/Edge) or a short sheet with the steps:
// Share → Add to Home Screen on iPhone/iPad, the browser menu on Android, and "open it
// in your browser" inside apps like Instagram, which can't install web apps. After the
// first logged workout a dismissible card on Today suggests it too.

export type Platform = 'inapp' | 'ios' | 'android' | 'desktop';

// Browsers built into other apps. They can't install a web app, so the page has to be opened elsewhere.
const IN_APP =
	/FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Snapchat|musical_ly|BytedanceWebview|LinkedInApp|Pinterest|Line\//;

/** The platform from the user agent. iPads report themselves as a Mac with touch. */
export function platformOf(userAgent = '', touchPoints = 0): Platform {
	if (IN_APP.test(userAgent)) return 'inapp';
	if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && touchPoints > 1)) return 'ios';
	if (/Android/.test(userAgent)) return 'android';
	return 'desktop';
}

/** The header button: on phones and tablets, until Granite runs from the home screen. */
export function offersButton(o: { platform: Platform; standalone: boolean }): boolean {
	return o.platform !== 'desktop' && !o.standalone;
}

/** The Today card: like the button, but only once dismissed never again, and only after a first workout. */
export function shouldOffer(o: {
	platform: Platform;
	standalone: boolean;
	dismissed: boolean;
	workouts: number;
}): boolean {
	return offersButton(o) && !o.dismissed && o.workouts > 0;
}

const SHARE_ICON =
	'<svg class="share-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10V1.5M5 4.5l3-3 3 3M4.5 7H3.5v7.5h9V7h-1"/></svg>';

/** The sheet's steps for a platform (trusted HTML: our own constants only). */
export function sheetSteps(platform: Platform): string[] {
	if (platform === 'inapp')
		return [
			'You are in an app’s built-in browser, which can’t add pages to your home screen.',
			'Open this page in Safari or Chrome: look for <b>Open in browser</b>, often behind ⋯ or ⋮. Or copy the link and paste it there.',
			'Then tap the home-screen button at the top again.'
		];
	if (platform === 'ios')
		return [
			`Tap Share ${SHARE_ICON} in the browser’s toolbar. In newer Safari, tap ⋯ first.`,
			'Choose <b>Add to Home Screen</b>, then tap <b>Add</b>.',
			'Granite now opens from its own icon, full screen, and logs workouts offline.'
		];
	return [
		'Open the browser’s menu ⋮.',
		'Choose <b>Add to Home screen</b> or <b>Install app</b>.',
		'Granite now opens from its own icon, full screen, and logs workouts offline.'
	];
}

/** The card's text; `canPrompt` when the browser handed us its install prompt. */
export function installText(platform: Platform, canPrompt: boolean): string {
	if (platform === 'inapp')
		return 'You are in an app’s built-in browser. Open this page in Safari or Chrome to add Granite to your home screen.';
	if (platform === 'ios')
		return `Tap Share ${SHARE_ICON}, then <b>Add to Home Screen</b>. Granite opens like an app, full screen, right at the gym.`;
	if (canPrompt) return 'Install Granite and it opens like an app, full screen, straight from your home screen.';
	return 'Open your browser’s menu and choose <b>Add to Home screen</b> or <b>Install app</b>. Granite then opens like an app.';
}
