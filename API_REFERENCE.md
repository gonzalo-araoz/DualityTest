# DualityTest - Complete API Reference

Complete documentation of all available methods in DualityTest.

## Table of Contents

1. [Initialization](#initialization)
2. [Selectors](#selectors)
3. [Actions](#actions)
4. [Text Input](#text-input)
5. [Navigation](#navigation)
6. [Scroll and Gestures](#scroll-and-gestures)
7. [Waits](#waits)
8. [Helper Methods](#helper-methods)
9. [Assertions](#assertions)
10. [Additional Actions](#additional-actions)
11. [Utilities](#utilities)
12. [Variables and Environment](#variables-and-environment)
13. [Cleanup](#cleanup)

---

## Initialization

### `constructor(config)`

Creates a new instance of DualityTest.

```javascript
import DualityTest from 'dualitytest.js';

const app = new DualityTest({
  appId: 'com.example.app', // Bundle ID, Package Name or Web URL
  platform: 'android',      // 'android', 'ios' or 'web' (default)
  logLevel: 'info',         // 'debug', 'info', 'warn', 'error'
  enableLogging: true       // true/false
});
```

### `async launch(options)`

Launches the browser or app depending on the platform.

**Parameters (Web):**
- `options.headless` (boolean): Headless mode (default: `false`)
- `options.browser` (string): `'chromium'` | `'webkit'` | `'firefox'` (default: `'chromium'`)
- `options.viewport` (object): `{ width: number, height: number }`
- `options.clearState` (boolean): Clear cookies/storage before launch
- `options.slowMo` (number): Slow down operations in ms
- `options.userAgent` (string): Custom user agent
- `options.geolocation` (object): `{ latitude: number, longitude: number }`
- `options.permissions` (array): Array of permissions (e.g., `['geolocation']`)

**Parameters (Android):**
- `options.clearState` (boolean): Clear app data
- `options.deviceSerial` (string): Device/emulator serial (e.g., `'emulator-5554'`)
- `options.deviceName` (string): Device name
- `options.appPackage` (string): Package name (optional, uses appId by default)
- `options.appActivity` (string): Main Activity (default: `'.MainActivity'`)
- `options.hostname` (string): Appium hostname (default: `'localhost'`)
- `options.port` (number): Appium port (default: `4723`)
- `options.capabilities` (object): Additional Appium capabilities

**Note:** DualityTest automatically applies performance optimizations for Android:
- Implicit wait timeout: 2 seconds
- Skip server installation when not doing full reset
- Compact responses enabled
- Performance logging disabled
- Animations enabled for realistic testing

**Parameters (iOS):**
- `options.clearState` (boolean): Clear app data
- `options.deviceName` (string): Device/simulator name
- `options.deviceSerial` (string): Device UDID (optional)
- `options.hostname` (string): Appium hostname
- `options.port` (number): Appium port
- `options.capabilities` (object): Additional Appium capabilities

**Example:**
```javascript
await app.launch({
  headless: false,
  clearState: true,
  deviceSerial: 'emulator-5554'
});
```

---

## Selectors

All selector methods return a locator that can be used with actions or assertions.

### `getByTestId(testId)`

Finds an element by test ID (accessibility id in mobile).

**Parameters:**
- `testId` (string): Element Test ID

**Example:**
```javascript
await app.tapOn(app.getByTestId('login-button'));
```

### `getByText(text, options)`

Finds an element by its text content.

**Parameters:**
- `text` (string): Text to search for.
- `options` (object):
  - `exact` (boolean): Whether to match exact text (default: `false`).
  - `index` (number): Get specific occurrence. Supports negative indexing (default: `null`).
    - `0` = first occurrence
    - `1` = second occurrence
    - `-1` = last occurrence
    - `-2` = second to last

**Returns:** `Locator` (Playwright) or `MobileLocator` (Android/iOS)

```javascript
// Default (first match)
app.getByText('Login');

// Exact match
app.getByText('Login', { exact: true });

// Get specific occurrence
await app.tapOn(app.getByText('Submit', { index: 0 }));  // First
await app.tapOn(app.getByText('Submit', { index: -1 })); // Last
```

### `getByRole(role, options)`

Finds an element by role (translates to text in mobile).

**Parameters:**
- `role` (string): Element role (e.g., `'button'`, `'textbox'`)
- `options.name` (string): Name/text of the element

**Example:**
```javascript
await app.tapOn(app.getByRole('button', { name: 'Login' }));
```

### `getByLabel(label)`

Finds an element by label (description in Android).

**Parameters:**
- `label` (string): Element label

**Example:**
```javascript
await app.fill(app.getByLabel('Email'), 'user@example.com');
```

### `getByPlaceholder(placeholder)`

Finds an element by placeholder (multiple strategies in Android).

**Parameters:**
- `placeholder` (string): Placeholder text

**Example:**
```javascript
await app.fill(app.getByPlaceholder('Your email'), 'user@example.com');
```

### `getById(id)`

Finds an element by ID.

**Parameters:**
- `id` (string): Element ID

**Example:**
```javascript
await app.tapOn(app.getById('submit-btn'));
```

### `locator(selector)`

Generic selector that accepts strings or complex selectors.

**Parameters:**
- `selector` (string): CSS selector, XPath, or Appium selector

**Example:**
```javascript
await app.tapOn(app.locator('.button'));
await app.tapOn(app.locator('text="Click me"'));
// Android: app.locator('~accessibility-id')
// Android: app.locator('android=new UiSelector().text("Hello")')
```

---

## Actions

### `async tapOn(selector, options)`

Taps or clicks on an element.

**Parameters:**
- `selector`: Locator or selector string
- `options.timeout` (number): Timeout in ms (default: `10000`)
- `options.force` (boolean): Force click even if not visible (web only)
- `options.position` (object): `{ x: number, y: number }` (web only)

**Example:**
```javascript
await app.tapOn(app.getByText('Submit'));
await app.tapOn('.button', { timeout: 5000, force: true });
```

### `async doubleTapOn(selector)`

Double taps on an element.

**Parameters:**
- `selector`: Locator or selector string

**Example:**
```javascript
await app.doubleTapOn('.image');
```

### `async longPress(selector, duration)`

Long presses on an element.

**Parameters:**
- `selector`: Locator or selector string
- `duration` (number): Duration in ms (default: `1000`)

**Example:**
```javascript
await app.longPress('.menu-item', 2000);
```

### `async tapOnWithRetry(selector, options)`

Retries tapping on an element until successful.

**Parameters:**
- `selector`: Locator or selector string
- `options.retries` (number): Number of retries (default: `5`)
- `options.delay` (number): Delay between retries in ms (default: `100`)
- `options.timeout` (number): Timeout per attempt in ms (default: `3000`)

**Example:**
```javascript
await app.tapOnWithRetry(app.getByText('Submit'), {
  retries: 10,
  delay: 100,
  timeout: 10000
});
```

**When to use:** When a button doesn't respond to the first tap but eventually works.

### `async tapOnUntilGone(selector, options)`

Taps on an element repeatedly until it disappears.

**Parameters:**
- `selector`: Locator or selector string
- `options.maxAttempts` (number): Max attempts (default: `10`)
- `options.checkInterval` (number): Check interval in ms (default: `100`)
- `options.tapDelay` (number): Delay after each tap in ms (default: `50`)

**Example:**
```javascript
await app.tapOnUntilGone(app.getByText('Close'), {
  maxAttempts: 15,
  tapDelay: 500
});
```

**When to use:** When the button should disappear after being clicked (e.g., closing modals).

### `async tapOnUntilVisible(selector, targetSelector, options)`

Taps on an element until another target element appears.

**Parameters:**
- `selector`: Locator of element to click
- `targetSelector`: Locator of element that should appear
- `options.maxAttempts` (number): Max attempts (default: `10`)
- `options.checkInterval` (number): Check interval in ms (default: `100`)
- `options.tapDelay` (number): Delay after each tap in ms (default: `50`)

**Example:**
```javascript
await app.tapOnUntilVisible(
  app.getByText('Next'),
  app.getByText('Welcome to Step 2'),
  { maxAttempts: 15 }
)
```

**When to use:** For navigation where you need to verify arrival at the new screen.

### `async tapAtCoordinates(x, y, options)`

Taps directly at specific screen coordinates.

**Parameters:**
- `x` (number): X Coordinate
- `y` (number): Y Coordinate
- `options.duration` (number): Tap duration in ms (default: `100`)

**Example:**
```javascript
await app.tapAtCoordinates(286, 905);
await app.tapAtCoordinates(500, 1200, { duration: 200 });
```

**When to use:** When you know exact coordinates or need to avoid overlays.

### `async tapOnElementByCoordinates(selector, options)`

Automatically calculates the center coordinates of the element and taps there.

**Parameters:**
- `selector`: Locator or selector string
- `options.duration` (number): Tap duration in ms (default: `100`)

**Example:**
```javascript
await app.tapOnElementByCoordinates(app.locator('//android.view.ViewGroup[@content-desc="Button"]'));
```

**When to use:** For buttons blocked by invisible overlays. This method taps at 70% of the element's height (bottom part) to avoid overlays that typically cover the top part.

**Note:** This method is especially useful for buttons in modals or screens with overlays that block normal taps.

---

## Text Input

### `async fill(selector, text)`

Fills a text field with the specified value.

**Parameters:**
- `selector`: Locator or selector string
- `text` (string): Text to input

**Example:**
```javascript
await app.fill(app.getByLabel('Email'), 'user@example.com');
await app.fill('#password', 'password123');
```

### `async inputText(text, options)`

Inputs text into the focused or specified field.

**Parameters:**
- `text` (string): Text to input
- `options.into` (string): Field selector (default: `'input:focus, textarea:focus'`)

**Example:**
```javascript
await app.inputText('Hello World');
await app.inputText('Hello', { into: '#input-field' });
```

### `async type(selector, text, options)`

Types text character by character.

**Parameters:**
- `selector`: Locator or selector string
- `text` (string): Text to type
- `options.delay` (number): Delay between characters in ms (default: `50`)

**Example:**
```javascript
await app.type('#search', 'query', { delay: 100 });
```

### `async clearText(selector)`

Clears the content of a text field.

**Parameters:**
- `selector`: Locator or selector string

**Example:**
```javascript
await app.clearText('#input');
```

### `async eraseText(selector, charactersToErase)`

Erases a specific number of characters or clears the entire field.

**Parameters:**
- `selector`: Locator or selector string
- `charactersToErase` (number, optional): Number of characters to erase. If not specified, clears everything.

**Example:**
```javascript
await app.eraseText('#input', 5);  // Erase 5 characters
await app.eraseText('#input');     // Clear all
```

---

## Navigation

### `async openLink(url)`

Opens a URL (web only).

**Parameters:**
- `url` (string): URL to open

**Example:**
```javascript
await app.openLink('https://example.com');
```

### `async back()`

Navigates back.

**Example:**
```javascript
await app.back();
```

### `async forward()`

Navigates forward (web only).

**Example:**
```javascript
await app.forward();
```

### `async reload()`

Reloads the page or app.

**Example:**
```javascript
await app.reload();
```

---

## Scroll and Gestures

### `async scroll(options)`

Scrolls the page or screen.

**Parameters:**
- `options.direction` (string): `'up'` | `'down'` (default: `'down'`)
- `options.distance` (number): Distance in pixels (default: `300`)

**Example:**
```javascript
await app.scroll({ direction: 'down', distance: 300 });
await app.scroll({ direction: 'up' });
```

### `async scrollUntilVisible(selector, options)`

Scrolls until an element becomes visible.

**Parameters:**
- `selector`: Locator or selector string
- `options.maxScrolls` (number): Max number of scrolls (default: `10`)
- `options.direction` (string): Scroll direction (default: `'down'`)

**Example:**
```javascript
await app.scrollUntilVisible('.footer', { 
  maxScrolls: 10,
  direction: 'down' 
});
```

### `async swipe(direction, options)`

Performs a swipe gesture.

**Parameters:**
- `direction` (string): `'up'` | `'down'` | `'left'` | `'right'`
- `options.startX` (number): Initial X position (optional)
- `options.startY` (number): Initial Y position (optional)
- `options.distance` (number): Swipe distance in pixels (default: `300`)

**Example:**
```javascript
await app.swipe('left', { distance: 300 });
await app.swipe('up', { startX: 200, startY: 400, distance: 200 });
```

---

## Waits

### `async waitFor(milliseconds)`

Waits for a fixed amount of time.

**Parameters:**
- `milliseconds` (number): Time to wait in milliseconds

**Example:**
```javascript
await app.waitFor(2000); // Wait 2 seconds
```

### `async waitForVisible(selector, options)`

Waits for an element to be visible.

**Parameters:**
- `selector`: Locator or selector string
- `options.timeout` (number): Timeout in ms (default: `10000`)

**Example:**
```javascript
await app.waitForVisible('.modal', { timeout: 10000 });
```

### `async waitUntilGone(selector, options)`

Waits for an element to disappear.

**Parameters:**
- `selector`: Locator or selector string
- `options.timeout` (number): Timeout in ms (default: `10000`)

**Example:**
```javascript
await app.waitUntilGone('.loading-spinner');
```

### `async extendedWaitUntil(options)`

Custom wait with multiple conditions.

**Parameters:**
- `options.visible` (selector): Element that must be visible
- `options.notVisible` (selector): Element that must not be visible
- `options.timeout` (number): Timeout in ms (default: `10000`)

**Example:**
```javascript
await app.extendedWaitUntil({
  visible: '.success-message',
  notVisible: '.error-message',
  timeout: 10000
});
```

---

## Helper Methods

These methods return boolean values for use in native JavaScript conditionals.

### `async isVisible(selector)`

Checks if an element is visible.

**Returns:** `boolean`

**Example:**
```javascript
if (await app.isVisible('.cookie-banner')) {
  await app.tapOn('.accept-cookies');
}
```

### `async isHidden(selector)`

Checks if an element is hidden.

**Returns:** `boolean`

**Example:**
```javascript
if (await app.isHidden('.modal')) {
  // Continue
}
```

### `async isEnabled(selector)`

Checks if an element is enabled.

**Returns:** `boolean`

**Example:**
```javascript
if (await app.isEnabled('#submit-btn')) {
  await app.tapOn('#submit-btn');
}
```

### `async isDisabled(selector)`

Checks if an element is disabled.

**Returns:** `boolean`

**Example:**
```javascript
if (await app.isDisabled('#submit-btn')) {
  console.log('Button is disabled');
}
```

### `async isChecked(selector)`

Checks if a checkbox or radio is checked.

**Returns:** `boolean`

**Example:**
```javascript
if (await app.isChecked('#checkbox')) {
  await app.uncheck('#checkbox');
}
```

### `async count(selector)`

Counts how many elements match the selector.

**Returns:** `number`

**Example:**
```javascript
const itemCount = await app.count('.list-item');
while (itemCount < 10) {
  await app.scroll({ direction: 'down' });
  itemCount = await app.count('.list-item');
}
```

---

## Assertions

All assertions throw errors if they fail and return the instance for chaining.

### `expect(selector)`

Returns an expect object for custom assertions.

**Example:**
```javascript
await app.expect('.title').toHaveText('Welcome');
```

### `async toBeVisible(selector)`

Verifies that an element is visible.

**Example:**
```javascript
await app.toBeVisible('.dashboard');
```

### `async toBeHidden(selector)`

Verifies that an element is hidden.

**Example:**
```javascript
await app.toBeHidden('.loading');
```

### `async toHaveText(selector, text, options)`

Verifies that an element has the specified text.

**Parameters:**
- `selector`: Locator or selector string
- `text` (string | RegExp): Expected text
- `options.ignoreCase` (boolean): Ignore case

**Example:**
```javascript
await app.toHaveText('.title', 'Welcome');
await app.toHaveText('.title', /Welcome/, { ignoreCase: true });
```

### `async toContainText(selector, text)`

Verifies that an element contains the specified text.

**Example:**
```javascript
await app.toContainText('.message', 'success');
```

### `async toHaveValue(selector, value)`

Verifies that a field has the specified value.

**Example:**
```javascript
await app.toHaveValue('#email', 'user@example.com');
```

### `async toHaveCount(selector, count)`

Verifies that there is a specific number of elements.

**Parameters:**
- `selector`: Locator or selector string
- `count` (number | object): Exact number or object with `{ exact, min, max }`

**Example:**
```javascript
await app.toHaveCount('.item', 5);
await app.toHaveCount('.item', { min: 3, max: 10 });
```

### `async toBeEnabled(selector)`

Verifies that an element is enabled.

**Example:**
```javascript
await app.toBeEnabled('#submit');
```

### `async toBeDisabled(selector)`

Verifies that an element is disabled.

**Example:**
```javascript
await app.toBeDisabled('#submit');
```

### `async toHaveURL(url, options)`

Verifies that the current URL matches (web only).

**Example:**
```javascript
await app.toHaveURL('https://example.com/dashboard');
```

### `async toHaveTitle(title, options)`

Verifies that the page title matches (web only).

**Example:**
```javascript
await app.toHaveTitle('Dashboard');
```

---

## Additional Actions

### `async selectOption(selector, value)`

Selects an option in a dropdown.

**Parameters:**
- `selector`: Locator or selector string
- `value` (string): Value to select

**Example:**
```javascript
await app.selectOption('#country', 'US');
```

### `async check(selector)`

Checks a checkbox.

**Example:**
```javascript
await app.check('#terms');
```

### `async uncheck(selector)`

Unchecks a checkbox.

**Example:**
```javascript
await app.uncheck('#terms');
```

### `async press(key)`

Presses a key.

**Parameters:**
- `key` (string): Key to press (e.g., `'Enter'`, `'Escape'`, `'Backspace'`)

**Example:**
```javascript
await app.press('Enter');
await app.press('Escape');
```

### `async hideKeyboard()`

Hides the keyboard (mobile) or presses Escape (web).

**Example:**
```javascript
await app.hideKeyboard();
```

### `async setLocation(latitude, longitude)`

Sets the geographical location.

**Parameters:**
- `latitude` (number): Latitude
- `longitude` (number): Longitude

**Example:**
```javascript
await app.setLocation(40.7128, -74.0060);
```

### `async setOrientation(orientation)`

Sets the device orientation (mobile) or viewport (web).

**Parameters:**
- `orientation` (string): `'portrait'` | `'landscape'`

**Example:**
```javascript
await app.setOrientation('landscape');
await app.setOrientation('portrait');
```

---

## Utilities

### `async getText(selector)`

Gets the text of an element.

**Returns:** `string`

**Example:**
```javascript
const text = await app.getText('.title');
```

### `async getValue(selector)`

Gets the value of an input field.

**Returns:** `string`

**Example:**
```javascript
const value = await app.getValue('#input');
```

### `async screenshot(options)`

Takes a screenshot.

**Parameters:**
- `options.path` (string): Path to save (default: `screenshot-{timestamp}.png`)
- `options.fullPage` (boolean): Capture full page (web only, default: `false`)

**Example:**
```javascript
await app.screenshot({ path: 'screenshot.png', fullPage: true });
```

### `async takeScreenshot(path)`

Alias for `screenshot()` with just the path.

**Example:**
```javascript
await app.takeScreenshot('screenshot.png');
```

### `async startRecording()`

Starts screen recording (mobile only).

**Example:**
```javascript
await app.startRecording();
```

### `async stopRecording(options)`

Stops recording and saves the video.

**Parameters:**
- `options.path` (string): Path to save the video

**Returns:** `string` (base64 of video) or `this`

**Example:**
```javascript
await app.startRecording();
// ... perform actions ...
const video = await app.stopRecording({ path: 'video.mp4' });
```

### `async copyTextFrom(selector)`

Copies text from an element to the clipboard.

**Example:**
```javascript
await app.copyTextFrom('.text-to-copy');
```

### `async pasteText()`

Pastes text from the clipboard into the focused field.

**Example:**
```javascript
await app.pasteText();
```

---

## Variables and Environment

### `async evalScript(script)`

Executes a JavaScript script in the page/app context.

**Parameters:**
- `script` (string | function): Script to execute

**Returns:** Result of the script

**Example:**
```javascript
const result = await app.evalScript(() => document.title);
const result = await app.evalScript('return window.innerWidth');
```

### `async runScript(script)`

Alias for `evalScript()`.

**Example:**
```javascript
await app.runScript(() => console.log('Hello'));
```

### `async setEnv(key, value)`

Sets a custom environment variable.

**Parameters:**
- `key` (string): Variable name
- `value` (any): Variable value

**Example:**
```javascript
await app.setEnv('USERNAME', 'testuser');
```

### `getEnv(key)`

Gets a custom environment variable.

**Parameters:**
- `key` (string): Variable name

**Returns:** Variable value

**Example:**
```javascript
const username = app.getEnv('USERNAME');
```

---

## Cleanup

### `async close()`

Closes the browser, context, page, and device connections.

**Example:**
```javascript
await app.close();
```

### `async stopApp()`

Stops the Android app (Android only).

**Example:**
```javascript
await app.stopApp();
```

### `async clearState()`

Clears the app state, cookies, and storage.

**Example:**
```javascript
await app.clearState();
```

### `async clearKeychain()`

Clears the iOS keychain (iOS only, requires special configuration).

**Example:**
```javascript
await app.clearKeychain();
```

---

## Full Usage Examples

### Full Login Test

```javascript
import { test } from '@playwright/test';
import DualityTest from '../dualitytest.js';

test('Login flow', async () => {
  const app = new DualityTest({ 
    appId: 'com.example.app',
    platform: 'android' 
  });

  await app.launch({ 
    deviceSerial: 'emulator-5554',
    clearState: true 
  });

  await app.waitFor(3000);

  // Login
  await app
    .tapOn(app.getByRole('button', { name: 'Login' }))
    .fill(app.getByPlaceholder('Your email'), 'user@test.com')
    .fill(app.getByPlaceholder('Password'), 'password123')
    .tapOn(app.getByRole('button', { name: 'Login' }));

  // Wait for load
  await app.waitFor(3000);

  // Verify successful login
  await app
    .waitForVisible(app.getByText('Dashboard'), { timeout: 30000 })
    .toBeVisible(app.getByText('Dashboard'));

  await app.close();
});
```

### Test with Conditionals

```javascript
test('Test with conditions', async () => {
  const app = new DualityTest({ appId: 'https://example.com' });
  await app.launch();

  // Handle cookie banner
  if (await app.isVisible('.cookie-banner')) {
    await app.tapOn('.accept-cookies');
  }

  // Conditional login
  const needsLogin = await app.isVisible('.login-button');
  if (needsLogin) {
    await app
      .tapOn('.login-button')
      .fill('#email', 'user@test.com')
      .fill('#password', 'pass123')
      .tapOn('button[type="submit"]');
  }

  await app.close();
});
```

### Test with Loops

```javascript
test('Test with loops', async () => {
  const app = new DualityTest({ appId: 'https://products.com' });
  await app.launch();

  // For loop
  for (let i = 0; i < 5; i++) {
    await app
      .tapOn(`.product-${i}`)
      .toBeVisible('.product-details')
      .screenshot({ path: `product-${i}.png` })
      .back();
  }

  // While loop
  let itemCount = 0;
  while (itemCount < 20) {
    const currentCount = await app.count('.feed-item');
    if (currentCount >= 20) break;
    
    await app.scroll({ direction: 'down' });
    await app.waitFor(500);
    itemCount = currentCount;
  }

  await app.close();
});
```

### Scroll to Find Element

```javascript
test('Scroll to find element', async () => {
  const app = new DualityTest({ 
    appId: 'com.shop.app',
    platform: 'android' 
  });

  await app.launch();

  // Scroll until product found
  let found = false;
  let attempts = 0;
  while (!found && attempts < 10) {
    found = await app.isVisible(app.getByText('Product X'));
    if (!found) {
      await app.scroll({ direction: 'down' });
      await app.waitFor(500);
      attempts++;
    }
  }

  if (found) {
    await app
      .tapOn(app.getByText('Product X'))
      .tapOn(app.getByRole('button', { name: 'Add to Cart' }))
      .toBeVisible(app.getByText('Added to cart'));
  }

  await app.close();
});
```

---

## Important Notes

1. **Chaining**: Most methods return `this`, allowing chaining:
   ```javascript
   await app
     .fill('#email', 'user@test.com')
     .fill('#password', 'pass123')
     .tapOn('button[type="submit"]');
   ```

2. **Selectors**: You can use strings or Playwright locators. On mobile, strings are automatically converted.

3. **Timeouts**: Default timeouts are 30 seconds. You can specify custom timeouts in options.

4. **Logging**: 
   - All errors are automatically logged. Configure `logLevel: 'debug'` to see more details.
   - webdriverio logs are automatically reduced (errors only by default).
   - You can configure the webdriverio log level with `options.wdioLogLevel` in `launch()`.

5. **Assertions with Playwright Test**:
   - ⚠️ **Do not use Playwright's `expect()` directly with mobile locators**.
   - **Do not use Playwright's `expect()` directly with mobile locators**.
   - On mobile, `app.getByText()` returns a `MobileLocator`, not a Playwright locator.
   - Use `app.toBeVisible()`, `app.expect()`, or `app.toHaveText()` instead.
   - Correct example:
     ```javascript
     // Correct
     await app.toBeVisible(app.getByText('Welcome'));
     await app.expect(app.getByText('Welcome')).toBeVisible();
     
     // Incorrect (only works on web)
     await expect(app.getByText('Welcome')).toBeVisible();
     ```

6. **Platform-specific**: Some methods only work on certain platforms (e.g., `openLink` only on web, `startRecording` only on mobile).
