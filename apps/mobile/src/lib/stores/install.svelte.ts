import { platformOf, type Platform } from '#lib/install.ts';

const DISMISSED = 'granite:install-dismissed';

// The browser's deferred install prompt (Chrome/Edge on Android). Not in lib.dom yet.
interface InstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
	return (
		matchMedia('(display-mode: standalone)').matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true
	);
}

function readDismissed(): boolean {
	try {
		return localStorage.getItem(DISMISSED) !== null;
	} catch {
		return false;
	}
}

/** Home-screen install state: platform, standalone, the deferred prompt, the card's dismissal. */
class InstallState {
	platform = $state<Platform>('desktop');
	standalone = $state(false);
	dismissed = $state(false);
	sheetOpen = $state(false);
	#prompt = $state<InstallPromptEvent | null>(null);

	get canPrompt(): boolean {
		return this.#prompt !== null;
	}

	/** Call once on app start: detect the platform and listen for the browser's install events. */
	init(): void {
		this.platform = platformOf(navigator.userAgent, navigator.maxTouchPoints);
		this.standalone = isStandalone();
		this.dismissed = readDismissed();
		addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault(); // keep it for our own buttons instead of the mini-infobar
			this.#prompt = e as InstallPromptEvent;
		});
		addEventListener('appinstalled', () => {
			this.standalone = true;
			this.#prompt = null;
		});
	}

	/** The native prompt where there is one, else the steps sheet. */
	async install(): Promise<void> {
		const p = this.#prompt;
		if (!p) {
			this.sheetOpen = true;
			return;
		}
		this.#prompt = null; // a prompt can only be used once
		await p.prompt();
		const { outcome } = await p.userChoice;
		if (outcome === 'accepted') this.standalone = true;
	}

	dismiss(): void {
		this.dismissed = true;
		try {
			localStorage.setItem(DISMISSED, new Date().toISOString().slice(0, 10));
		} catch {
			/* shown again next visit */
		}
	}
}

export const install = new InstallState();
