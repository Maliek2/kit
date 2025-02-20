import { expect } from '@playwright/test';
import { start_server, test } from '../../../utils.js';

/** @typedef {import('@playwright/test').Response} Response */

test.describe('base path', () => {
	test('serves a useful 404 when visiting unprefixed path', async ({ request }) => {
		const response = await request.get('/');
		expect(response.status()).toBe(404);
		expect(await response.text()).toBe('Not found (did you mean /path-base/?)');
	});

	test('serves /', async ({ page, javaScriptEnabled }) => {
		await page.goto('/path-base/');

		expect(await page.textContent('h1')).toBe('I am in the template');
		expect(await page.textContent('h2')).toBe("We're on index.svelte");

		const mode = process.env.DEV ? 'dev' : 'prod';
		expect(await page.textContent('p')).toBe(
			`Hello from the ${javaScriptEnabled ? 'client' : 'server'} in ${mode} mode!`
		);
	});

	// TODO re-enable these once we upgrade to Vite 3
	// https://github.com/sveltejs/kit/pull/4891#issuecomment-1125471630
	test.skip('sets_paths', async ({ page }) => {
		await page.goto('/path-base/base/');
		expect(await page.textContent('[data-source="base"]')).toBe('/path-base');
		expect(await page.textContent('[data-source="assets"]')).toBe('/_svelte_kit_assets');
	});

	test.skip('loads javascript', async ({ page, javaScriptEnabled }) => {
		await page.goto('/path-base/base/');
		expect(await page.textContent('button')).toBe('clicks: 0');

		if (javaScriptEnabled) {
			await page.click('button');
			expect(await page.innerHTML('h2')).toBe('button has been clicked 1 time');
		}
	});

	test.skip('loads CSS', async ({ page }) => {
		await page.goto('/path-base/base/');
		expect(
			await page.evaluate(() => {
				const el = document.querySelector('p');
				return el && getComputedStyle(el).color;
			})
		).toBe('rgb(255, 0, 0)');
	});

	test.skip('inlines CSS', async ({ page, javaScriptEnabled }) => {
		await page.goto('/path-base/base/');
		if (process.env.DEV) {
			const ssr_style = await page.evaluate(() => document.querySelector('style[data-sveltekit]'));

			if (javaScriptEnabled) {
				// <style data-sveltekit> is removed upon hydration
				expect(ssr_style).toBeNull();
			} else {
				expect(ssr_style).not.toBeNull();
			}

			expect(
				await page.evaluate(() => document.querySelector('link[rel="stylesheet"]'))
			).toBeNull();
		} else {
			expect(await page.evaluate(() => document.querySelector('style'))).not.toBeNull();
			expect(
				await page.evaluate(() => document.querySelector('link[rel="stylesheet"][disabled]'))
			).not.toBeNull();
			expect(
				await page.evaluate(() => document.querySelector('link[rel="stylesheet"]:not([disabled])'))
			).not.toBeNull();
		}
	});

	test.skip('sets params correctly', async ({ page, clicknav }) => {
		await page.goto('/path-base/base/one');

		expect(await page.textContent('h2')).toBe('one');

		await clicknav('[href="/path-base/base/two"]');
		expect(await page.textContent('h2')).toBe('two');
	});
});

test.describe('CSP', () => {
	test('blocks script from external site', async ({ page }) => {
		const { port, close } = await start_server((req, res) => {
			if (req.url === '/blocked.js') {
				res.writeHead(200, {
					'content-type': 'text/javascript'
				});

				res.end('window.pwned = true');
			} else {
				res.writeHead(404).end('not found');
			}
		});

		await page.goto(`/path-base/csp?port=${port}`);

		expect(await page.evaluate('window.pwned')).toBe(undefined);

		await close();
	});
});

test.describe('Custom extensions', () => {
	test('works with arbitrary extensions', async ({ page }) => {
		await page.goto('/path-base/custom-extensions/');
		expect(await page.textContent('h2')).toBe('Great success!');
	});

	test('works with other arbitrary extensions', async ({ page }) => {
		await page.goto('/path-base/custom-extensions/const');
		expect(await page.textContent('h2')).toBe('Tremendous!');

		await page.goto('/path-base/custom-extensions/a');

		expect(await page.textContent('h2')).toBe('a');

		await page.goto('/path-base/custom-extensions/test-slug');

		expect(await page.textContent('h2')).toBe('TEST-SLUG');

		await page.goto('/path-base/custom-extensions/unsafe-replacement');

		expect(await page.textContent('h2')).toBe('Bazooom!');
	});
});

test.describe('Headers', () => {
	test('enables floc', async ({ page }) => {
		const response = await page.goto('/path-base');
		const headers = /** @type {Response} */ (response).headers();
		expect(headers['permissions-policy']).toBeUndefined();
	});
});

test.describe('trailingSlash', () => {
	test('adds trailing slash', async ({ baseURL, page, clicknav }) => {
		await page.goto('/path-base/slash');

		expect(page.url()).toBe(`${baseURL}/path-base/slash/`);
		expect(await page.textContent('h2')).toBe('/slash/');

		await clicknav('[href="/path-base/slash/child"]');
		expect(page.url()).toBe(`${baseURL}/path-base/slash/child/`);
		expect(await page.textContent('h2')).toBe('/slash/child/');
	});

	test('ignores trailing slash on endpoint', async ({ baseURL, request }) => {
		const r1 = await request.get('/path-base/endpoint/');
		expect(r1.url()).toBe(`${baseURL}/path-base/endpoint/`);
		expect(await r1.text()).toBe('hi');

		const r2 = await request.get('/path-base/endpoint');
		expect(r2.url()).toBe(`${baseURL}/path-base/endpoint`);
		expect(await r2.text()).toBe('hi');
	});

	test('can fetch data from page-endpoint', async ({ request, baseURL }) => {
		const r = await request.get('/path-base/page-endpoint/__data.json');
		expect(r.url()).toBe(`${baseURL}/path-base/page-endpoint/__data.json`);
		expect(await r.json()).toEqual({ data: 'hi' });
	});
});

test.describe('serviceWorker', () => {
	if (!process.env.DEV) {
		test('does not register service worker if none created', async ({ page }) => {
			await page.goto('/path-base/');
			expect(await page.content()).not.toMatch('navigator.serviceWorker');
		});
	}
});
