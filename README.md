# DualityTest

> **DualityTest** is a unified API that combines the power of **Playwright** (Web) and **Appium** (Mobile) under a single fluid and modern interface.

## Features

- **Cross-Platform**: Write one test, run it on Web, Android, and iOS.
- **Unified Selectors**: Use `getByText`, `getByRole` in mobile just like in web.
- **Fluent API**: Chain commands like `app.tapOn().fill().toBeVisible()`.
- **Overlay Handling**: Smart solution for buttons blocked by overlays.
- **Detailed Logging**: Integrated logging system for easy debugging.


Since the driver is included in the this repo, you just need to install the necessary dependencies, including **Playwright**.

Follow these 3 steps to set up the environment completely:

### 1. System Requirements (Node.js)

You need to have **Node.js** installed on your machine. This will automatically install **npm** (Node Package Manager).

- [Download Node.js](https://nodejs.org/) (v16 or higher recommended)
- Verify installation: `node -v` and `npm -v`

### 2. Project Setup (Playwright)

Install the project dependencies and the browser binaries used by Playwright.

```bash
# Install dependencies from package.json (includes playwright, webdriverio, etc.)
npm install

# Download the actual browser binaries (Chromium, Firefox, WebKit)
npx playwright install
```

### 3. Mobile Setup (Appium)

If you plan to run mobile tests (Android/iOS), you must install and run Appium **globally**.

```bash
# Install Appium server globally
npm install -g appium

# Install the necessary drivers
appium driver install uiautomator2  # For Android
appium driver install xcuitest      # For iOS (Mac only)
```

> **Note:** Whenever you run mobile tests, the Appium server must be running in a separate terminal using the command `appium`.

### Mobile Requirements

Before running mobile tests, ensure:

- **Android**:
    - Android SDK installed and `ANDROID_HOME` configured.
    - ADB in PATH (`adb version`).
    - Device or Emulator connected (`adb devices`).

- **iOS** (Mac only):
    - Xcode installed.
    - Appium with `xcuitest` driver.

## Recommended Project Structure

To keep your tests organized and scalable, we recommend the following folder structure:

```text
my-project/
├── dualitytest.js            # The custom driver file (DO NOT DELETE)
├── package.json            # Dependencies
├── playwright.config.js    # Playwright configuration
├── .env                    # Environment variables (Credentials, App IDs)
├── tests/
│   ├── e2e/
│   │   ├── mobile/         # Mobile-specific tests
│   │   └── web/            # Web-specific tests
│   └── fixtures/           # Shared test fixtures
├── pages/                  # Page Object Model (POM)
│   ├── common/             # Shared components
│   ├── android/            # Android-specific pages
│   └── ios/                # iOS-specific pages
└── data/                   # Test data (e.g., credentials, constants)
```

## Quick Start

### Web Testing

```javascript
import { test } from '@playwright/test';
import DualityTest from '../dualitytest.js';

test('Login test', async () => {
  const app = new DualityTest({ 
    appId: 'https://example.com',
    platform: 'web' 
  });

  await app.launch({ headless: false });
  
  await app
    .fill(app.getByLabel('Email'), 'user@example.com')
    .fill(app.getByLabel('Password'), 'password123')
    .tapOn(app.getByRole('button', { name: 'Login' }))
    .toBeVisible('.dashboard')
    .close();
});
```

### Android Testing

```javascript
import { test } from '@playwright/test';
import DualityTest from '../dualitytest.js';

test('Android app test', async () => {
  const app = new DualityTest({ 
    appId: 'com.example.app',
    platform: 'android' 
  });

  await app.launch({ 
    deviceSerial: 'emulator-5554',
    clearState: true 
  });

  await app
    .waitFor(2000) // Wait for app to load
    .tapOn(app.getByText('Login'))
    .fill(app.getByLabel('Email'), 'user@test.com')
    .fill(app.getByLabel('Password'), 'pass123')
    .tapOn(app.getByRole('button', { name: 'Sign in' }))
    .toBeVisible('text="Dashboard"')
    .close();
});
```

### iOS Testing

```javascript
import { test } from '@playwright/test';
import DualityTest from '../dualitytest.js';

test('iOS app test', async () => {
  const app = new DualityTest({ 
    appId: 'com.example.iosapp',
    platform: 'ios' 
  });

  await app.launch({ 
    clearState: true,
    deviceName: 'iPhone 14'
  });

  await app
    .tapOn(app.getByLabel('Email'))
    .type(app.getByLabel('Email'), 'user@test.com')
    .tapOn(app.getByLabel('Submit'))
    .toHaveText(app.getByTestId('result'), 'Success')
    .close();
});
```

## How to Run Tests

Tests are run exactly the same as before, using Playwright Test:

```bash
# Run all tests
npm test

# Or directly with Playwright
npx playwright test

# Run a specific file
npx playwright test tests/test.spec.js

# Run in UI mode
npx playwright test --ui

# Run in headed mode (see the browser)
npx playwright test --headed
```

### Mobile Requirements

Before running mobile tests, ensure:

1. **Appium running**: `appium` must be running in another terminal (see [Appium Server](#appium-server) section above)
2. **Device/Emulator connected**:
   - Android: `adb devices` must show your device
   - iOS: Simulator must be open or physical device connected
3. **Prerequisites met**: See [Prerequisites](#prerequisites) section above

## Configuration

### Constructor Options

```javascript
const app = new DualityTest({
  appId: 'https://example.com',  // URL (web) or package name (mobile)
  platform: 'web',                // 'web' | 'android' | 'ios'
  env: {},                        // Custom environment variables
  enableLogging: true,            // Enable logging (default: true)
  logLevel: 'info'                // 'debug' | 'info' | 'warn' | 'error'
});
```

### Launch Options

#### Web

```javascript
await app.launch({
  headless: false,                 // Show browser window
  clearState: true,                // Clear cookies/storage before launch
  browser: 'chromium',             // 'chromium' | 'webkit' | 'firefox'
  viewport: { width: 390, height: 844 },
  slowMo: 100,                     // Slow down operations (ms)
  userAgent: '...',
  geolocation: { latitude: 0, longitude: 0 },
  permissions: ['geolocation']
});
```

#### Android

```javascript
await app.launch({
  clearState: true,                // Clear app data
  deviceSerial: 'emulator-5554',  // Device/emulator serial
  deviceName: 'Pixel 6',          // Device name
  appPackage: 'com.example.app',  // Package name (optional, uses appId by default)
  appActivity: '.MainActivity',    // Main Activity (optional)
  hostname: 'localhost',          // Appium hostname (default: localhost)
  port: 4723,                      // Appium port (default: 4723)
  capabilities: {}                 // Additional Appium capabilities
});
```

#### iOS

```javascript
await app.launch({
  clearState: true,                // Clear app data
  deviceName: 'iPhone 14',         // Device/simulator name
  deviceSerial: 'UDID',            // Device UDID (optional)
  hostname: 'localhost',          // Appium hostname
  port: 4723,                      // Appium port
  capabilities: {}                  // Additional Appium capabilities
});
```

## Platform Notes

### Web Platform

Standard browser automation using Playwright. Supports Chromium, WebKit, and Firefox.

```javascript
const app = new DualityTest({ 
  appId: 'https://example.com',
  platform: 'web' 
});
await app.launch({ browser: 'webkit' });
```

### Android Platform

Requires Android device connected via ADB or running emulator.

**Requirements**:
- Android SDK installed
- Environment variables configured:
  ```bash
  export ANDROID_HOME=$HOME/Library/Android/sdk
  # Or alternatively:
  export ANDROID_SDK_ROOT=$HOME/Library/Android/sdk
  export PATH=$PATH:$ANDROID_HOME/platform-tools
  export PATH=$PATH:$ANDROID_HOME/tools
  ```
- ADB in PATH (verify with `adb version`)
- Appium with `uiautomator2` driver installed
- Device/emulator visible in `adb devices`

**Performance Optimizations**:
DualityTest includes several performance optimizations for Android:
- **Faster timeouts**: Default timeouts reduced from 30s to 10s for quicker test execution
- **Optimized delays**: Reduced delays between retries (100ms) and taps (50ms)
- **Implicit wait**: Configured to 2 seconds for faster element finding
- **Server installation**: Skips reinstalling UiAutomator2 server when not doing full reset
- **Compact responses**: Uses compact JSON responses for faster communication
- **Animations enabled**: Keeps animations enabled for realistic performance testing

```javascript
const app = new DualityTest({ 
  appId: 'com.example.app',
  platform: 'android' 
});
await app.launch({ 
  deviceSerial: 'emulator-5554',
  clearState: true 
});
```

### iOS Platform

Supports real iOS devices and simulators.

**Requirements**:
- Xcode installed (for simulators)
- Appium with `xcuitest` driver installed
- For physical devices: WebDriverAgent configured

```javascript
const app = new DualityTest({ 
  appId: 'com.example.iosapp',
  platform: 'ios' 
});
await app.launch({ 
  clearState: true,
  deviceName: 'iPhone 14'
});
```

## API Reference

**For complete documentation of all methods, check [API_REFERENCE.md](./API_REFERENCE.md)**

### Selectors

All selector methods work the same in web and mobile:

```javascript
// By test ID
app.getByTestId('login-button')

// By text
app.getByText('Submit')
app.getByText('Submit', { exact: true })

// Get specific occurrence (supports negative indexing)
app.getByText('Submit', { index: 0 });   // First occurrence
app.getByText('Submit', { index: 1 });   // Second occurrence
app.getByText('Submit', { index: -1 });  // Last occurrence
app.getByText('Submit', { index: -2 });  // Second to last

// By role
app.getByRole('button', { name: 'Login' })

// By label
app.getByLabel('Email')

// By placeholder
app.getByPlaceholder('Enter email')

// By ID
app.getById('submit-btn')

// Generic selector
app.locator('.button')
app.locator('text="Click me"')
```

### Actions

```javascript
// Tap/Click
await app.tapOn(selector)
await app.tapOn(selector, { timeout: 5000, force: true })

// Double tap
await app.doubleTapOn(selector)

// Long press
await app.longPress(selector, 2000)

// Retry Methods - For problematic buttons
await app.tapOnWithRetry(selector, {
  retries: 10,
  delay: 100,
  timeout: 10000
})

await app.tapOnUntilGone(selector, {
  maxAttempts: 15,
  tapDelay: 50
})

await app.tapOnUntilVisible(
  selector,
  targetSelector,
  { maxAttempts: 15 }
)

// Coordinate Taps - For overlays
await app.tapAtCoordinates(286, 905)
await app.tapOnElementByCoordinates(selector)  // Automatically avoids overlays
```

### Input

```javascript
await app.fill(selector, 'text')
await app.type(selector, 'text', { delay: 100 })
await app.clearText(selector)
await app.eraseText(selector, 5) // Erase 5 characters
```

### Scroll

```javascript
await app.scroll({ direction: 'down', distance: 300 })
await app.scrollUntilVisible(selector, { maxScrolls: 10 })
```

### Swipe

```javascript
await app.swipe('left', { distance: 300 })
```

### Waits

```javascript
// Fixed wait
await app.waitFor(2000)

// Wait for visibility
await app.waitForVisible(selector, { timeout: 10000 })

// Wait until gone
await app.waitUntilGone(selector)

// Extended wait with conditions
await app.extendedWaitUntil({
  visible: '.success',
  notVisible: '.error',
  timeout: 10000
})
```

### Helpers (for if/while)

```javascript
// Return booleans for use in native conditionals
if (await app.isVisible('.modal')) {
  await app.tapOn('.close');
}

if (await app.isEnabled('#submit')) {
  await app.tapOn('#submit');
}

const count = await app.count('.item');
while (count < 10) {
  await app.scroll({ direction: 'down' });
}
```

### Assertions

```javascript
// Chainable assertions
await app
  .toBeVisible('.dashboard')
  .toHaveText('.title', 'Welcome')
  .toContainText('.message', 'success')
  .toHaveValue('#email', 'user@test.com')
  .toHaveCount('.item', 5)
  .toBeEnabled('#submit')

// Or use Playwright expect directly
await expect(app.getByText('Welcome')).toBeVisible()
```

### Utilities

```javascript
// Screenshots
await app.screenshot({ path: 'screenshot.png', fullPage: true })

// Screen recording (mobile only)
await app.startRecording()
// ... perform actions ...
const video = await app.stopRecording({ path: 'video.mp4' })

// Get text/values
const text = await app.getText(selector)
const value = await app.getValue(selector)

// Clipboard
await app.copyTextFrom(selector)
await app.pasteText()

// Geolocation
await app.setLocation(40.7128, -74.0060)

// Orientation (mobile)
await app.setOrientation('landscape')
```

## Examples

### Full Test with Conditionals

```javascript
import { test } from '@playwright/test';
import DualityTest from '../dualitytest.js';

test('Login flow with conditions', async () => {
  const app = new DualityTest({ 
    appId: 'com.example.app',
    platform: 'android' 
  });

  await app.launch({ clearState: true });
  await app.waitFor(3000);

  // Handle permissions
  if (await app.isVisible(app.getByText('Allow'))) {
    await app.tapOn(app.getByText('Allow'));
  }

  // Login
  await app
    .tapOn(app.getByRole('button', { name: 'Login' }))
    .fill(app.getByLabel('Email'), 'user@test.com')
    .fill(app.getByLabel('Password'), 'pass123')
    .tapOn(app.getByRole('button', { name: 'Login' }));

  // Verify successful login
  await app.toBeVisible('text="Dashboard"');
  
  await app.close();
});
```

### Scroll to Find Element

```javascript
test('Scroll to find product', async () => {
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

### Handle Problematic Buttons with Overlays

```javascript
test('Handle button with overlay', async () => {
  const app = new DualityTest({ 
    appId: 'com.example.app',
    platform: 'android' 
  });

  await app.launch();

  // Fill form
  await app.fill(app.getByLabel('Name'), 'John Doe');
  await app.tapOn(app.getByRole('button', { name: 'Submit' }));

  // Option 1: Use tapOnWithRetry for unresponsive buttons
  await app.tapOnWithRetry(app.getByText('Continue'), {
    retries: 10,
    delay: 100
  });

  // Option 2: Use tapOnElementByCoordinates for buttons with overlay
  const selector = '//android.view.ViewGroup[@content-desc="Next Button"]';
  await app.tapOnElementByCoordinates(app.locator(selector));

  // Option 3: Verify navigation with tapOnUntilVisible
  await app.tapOnUntilVisible(
    app.getByText('Go to Dashboard'),
    app.getByText('Dashboard Title'),
    { maxAttempts: 15 }
  );

  await app.close();
});
```

## Debugging

### Logging

The logger is enabled by default. You can configure the level:

```javascript
const app = new DualityTest({ 
  appId: 'com.example.app',
  platform: 'android',
  enableLogging: true,
  logLevel: 'debug' // 'debug' | 'info' | 'warn' | 'error'
});
```

### Reduce Appium/WebdriverIO Logs

By default, webdriverio logs are automatically reduced (errors only). For more control:

```javascript
await app.launch({
  deviceSerial: 'emulator-5554',
  wdioLogLevel: 'silent' // 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent'
});
```

### Assertions with Playwright Test

⚠️ **Important**: Do not use Playwright's `expect()` directly with mobile locators:

```javascript
// ✅ Correct - Use API methods
await app.toBeVisible(app.getByText('Welcome'));
await app.expect(app.getByText('Welcome')).toBeVisible();

// ❌ Incorrect - Only works on web
await expect(app.getByText('Welcome')).toBeVisible(); // Error on mobile!
```

In mobile, `app.getByText()` returns a `MobileLocator`, not a Playwright locator. Use the API assertion methods instead.

### Screenshots on Errors

```javascript
test('Test with error handling', async () => {
  const app = new DualityTest({ appId: 'com.example.app', platform: 'android' });

  try {
    await app.launch();
    await app.tapOn('.button-that-might-not-exist');
  } catch (error) {
    await app.screenshot({ path: 'error.png' });
    throw error;
  } finally {
    await app.close();
  }
});
```

### Playwright Debug Mode

```bash
# Run with debug enabled
PWDEBUG=1 npx playwright test

# Or use UI mode
npx playwright test --ui
```

## Benefits vs. Previous Version

- **10-50x faster**: No overhead from temporary YAML files
- **Easy debugging**: Detailed logs of all operations
- **Real iOS supported**: Not just web simulation, real iOS devices
- **Consistent API**: Same interface across all platforms
- **Robust assertions**: Clear and descriptive error messages
- **No external dependencies**: Does not require Maestro CLI

## Troubleshooting

### Appium not connecting

1. Verify Appium is running: `appium` in another terminal
2. Verify port: default is 4723
3. For Android: verify `adb devices`
4. For iOS: verify simulator is open

### Error: ANDROID_HOME not configured

If you see the error `Neither ANDROID_HOME nor ANDROID_SDK_ROOT environment variable was exported`:

1. **Find your Android SDK**:
   ```bash
   # Generally located at:
   # macOS: ~/Library/Android/sdk
   # Linux: ~/Android/Sdk
   # Windows: %LOCALAPPDATA%\Android\Sdk
   ```

2. **Configure environment variables**:
   
   **macOS/Linux** (add to `~/.zshrc` or `~/.bashrc`):
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   export PATH=$PATH:$ANDROID_HOME/tools
   export PATH=$PATH:$ANDROID_HOME/tools/bin
   ```
   
   **Windows** (PowerShell):
   ```powershell
   $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
   $env:PATH += ";$env:ANDROID_HOME\platform-tools"
   $env:PATH += ";$env:ANDROID_HOME\tools"
   ```

3. **Reload terminal** or run:
   ```bash
   source ~/.zshrc  # or ~/.bashrc
   ```

4. **Verify configuration**:
   ```bash
   echo $ANDROID_HOME
   adb version
   ```

### Element not found

1. Use `waitForVisible` with a longer timeout
2. Verify selector with `isVisible` first
3. Use `screenshot` to see current state
4. Check logs with `logLevel: 'debug'`

### App does not launch

1. Verify `appId` is correct (package name for Android, bundle ID for iOS)
2. For Android: verify app is installed
3. Verify device/emulator is connected
4. Check Appium logs in the running terminal

## More Information

- **[Complete API Reference](./API_REFERENCE.md)** - Detailed documentation of all methods
- [Playwright Documentation](https://playwright.dev)
- [Appium Documentation](http://appium.io/docs/en/latest/)
- [WebdriverIO Documentation](https://webdriver.io/)
