// dualitytest.js - Unified Web + Mobile automation API
// Playwright for Web + Appium for Native Mobile

import { chromium, webkit, firefox } from 'playwright';
import { expect } from '@playwright/test';
import { remote } from 'webdriverio';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join, extname } from 'path';
import { execSync } from 'child_process';

// Centralized logger
class Logger {
  constructor(config = {}) {
    this.enabled = config.enableLogging ?? true;
    this.level = config.logLevel ?? 'info'; // 'debug', 'info', 'warn', 'error'
  }

  log(level, message, data = null) {
    if (!this.enabled) return;
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    if (levels[level] >= levels[this.level]) {
      const timestamp = new Date().toISOString();
      console[level](`[${timestamp}] [${level.toUpperCase()}] ${message}`, data || '');
    }
  }

  debug(msg, data) { this.log('debug', msg, data); }
  info(msg, data) { this.log('info', msg, data); }
  warn(msg, data) { this.log('warn', msg, data); }
  error(msg, data) { this.log('error', msg, data); }
}

// Class to represent unified mobile locators
class MobileLocator {
  constructor(driver, selector, type = 'accessibility', fallbackStrategies = null, index = null) {
    this.driver = driver;
    this.selector = selector;
    this.type = type; // 'accessibility', 'xpath', 'text', 'id'
    this._element = null;
    this._elementCacheValid = false;
    this.fallbackStrategies = fallbackStrategies; // To try multiple strategies
    this.index = index; // Element index (can be negative, -1 = last)
  }

  _invalidateCache() {
    this._element = null;
    this._elementCacheValid = false;
  }

  async _getElement() {
    // Always fetch fresh element if index is specified (indexed elements can change)
    if (this._element && this.index === null && this._elementCacheValid) {
      // Verify cached element is still valid
      try {
        if (await this._element.isDisplayed()) {
          return this._element;
        }
      } catch (error) {
        // Element is stale, invalidate cache
        this._invalidateCache();
      }
    }

    const strategies = {
      accessibility: `~${this.selector}`,
      xpath: this.selector,
      text: `android=new UiSelector().text("${this.selector}")`,
      id: this.selector
    };

    // If there's an index (including negative), get all elements
    if (this.index !== null) {
      const selector = strategies[this.type] || this.selector;
      const elements = await this.driver.$$(selector);

      if (elements.length === 0) {
        throw new Error(`No elements found for selector: ${this.selector}`);
      }

      // Calculate real index (if negative, count from the end)
      let realIndex = this.index;
      if (this.index < 0) {
        realIndex = elements.length + this.index;
      }

      if (realIndex < 0 || realIndex >= elements.length) {
        throw new Error(`Index ${this.index} out of range. Found ${elements.length} elements.`);
      }

      this._element = elements[realIndex];
      this._elementCacheValid = true;
      return this._element;
    }

    // If there are fallback strategies, try them in order
    if (this.fallbackStrategies && this.fallbackStrategies.length > 0) {
      for (const strategy of this.fallbackStrategies) {
        try {
          this._element = await this.driver.$(strategy);
          if (this._element && await this._element.isDisplayed()) {
            this._elementCacheValid = true;
            return this._element;
          }
        } catch (error) {
          // Continue with next strategy
          continue;
        }
      }
    }

    // Try main strategy
    this._element = await this.driver.$(strategies[this.type]);
    this._elementCacheValid = true;
    return this._element;
  }

  async tap(options = {}) {
    const element = await this._getElement();
    await element.waitForDisplayed({ timeout: options.timeout || 30000 });
    await element.click();
  }

  async fill(text) {
    const element = await this._getElement();
    await element.waitForDisplayed({ timeout: 30000 });
    await element.setValue(text);
  }

  async clear() {
    const element = await this._getElement();
    await element.clearValue();
  }

  async getText() {
    const element = await this._getElement();
    return await element.getText();
  }

  async isVisible() {
    try {
      const element = await this._getElement();
      return await element.isDisplayed();
    } catch (error) {
      return false;
    }
  }

  async isEnabled() {
    try {
      const element = await this._getElement();
      return await element.isEnabled();
    } catch (error) {
      return false;
    }
  }

  async waitFor(options = {}) {
    const element = await this._getElement();
    const state = options.state || 'visible';

    if (state === 'visible') {
      await element.waitForDisplayed({ timeout: options.timeout || 30000 });
    } else if (state === 'hidden') {
      await element.waitForDisplayed({
        timeout: options.timeout || 30000,
        reverse: true
      });
    }
  }

  async count() {
    try {
      const strategies = {
        accessibility: `~${this.selector}`,
        xpath: this.selector,
        text: `android=new UiSelector().text("${this.selector}")`,
        id: this.selector
      };
      const selector = strategies[this.type] || this.selector;
      const elements = await this.driver.$$(selector);
      return elements.length;
    } catch (error) {
      // Log error for debugging but return 0 for graceful handling
      console.warn(`[MobileLocator] count() failed for selector "${this.selector}":`, error.message);
      return 0;
    }
  }
}

class DualityTest {
  constructor(config = {}) {
    const validPlatforms = ['web', 'android', 'ios'];
    const platform = config.platform || 'web';

    if (!validPlatforms.includes(platform)) {
      throw new Error(
        `Invalid platform: "${platform}". Must be one of: ${validPlatforms.join(', ')}`
      );
    }

    this.config = config;
    this.logger = new Logger({
      enableLogging: config.enableLogging,
      logLevel: config.logLevel || 'info'
    });
    this.platform = platform;

    // Web properties
    this.browser = null;
    this.page = null;
    this.context = null;

    // Mobile properties
    this.driver = null;

    this.appId = config.appId;
    this.env = config.env || {};
  }

  // ==================== INITIALIZATION ====================

  async launch(options = {}) {
    this.logger.info(`Launching ${this.platform} platform`, { appId: this.appId });

    try {
      if (this.platform === 'android' || this.platform === 'ios') {
        return await this._launchMobile({ ...options });
      } else {
        return await this._launchWeb({ ...options });
      }
    } catch (error) {
      this.logger.error('Launch failed', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async _launchWeb(options = {}) {
    const browserType = options.browser || 'chromium';
    const browsers = { chromium, webkit, firefox };

    if (!browsers[browserType]) {
      throw new Error(`Unsupported browser: ${browserType}`);
    }

    this.browser = await browsers[browserType].launch({
      headless: options.headless ?? false,
      slowMo: options.slowMo ?? 0
    });

    const contextOptions = {
      ...options.contextOptions,
      viewport: options.viewport || { width: 390, height: 844 },
      userAgent: options.userAgent,
      geolocation: options.geolocation,
      permissions: options.permissions
    };

    this.context = await this.browser.newContext(contextOptions);
    this.page = await this.context.newPage();

    if (options.clearState) {
      await this.clearState();
    }

    if (this.appId) {
      await this.page.goto(this.appId);
      this.logger.info('Navigated to URL', { url: this.appId });
    }

    return this;
  }

  async _launchMobile(options = {}) {
    if (!this.appId) {
      throw new Error('appId is required for mobile platform');
    }

    // For Android, verify ANDROID_HOME before attempting to connect
    if (this.platform === 'android') {
      const androidHome = this._detectAndroidHome();
      if (!androidHome && !process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
        const errorMessage = this._getAndroidHomeError();
        this.logger.error('Android SDK not configured', {});
        throw new Error(errorMessage);
      }

      // For Android 16 (API 36+), clean Appium servers before starting session
      // This resolves the "UiAutomation not connected" issue
      if (options.deviceSerial) {
        await this._cleanAppiumServers(options.deviceSerial);
      }
    }

    const capabilities = this._buildCapabilities(options);

    this.logger.info('Starting Appium session', { capabilities });

    try {
      // Configure webdriverio log level based on logger level
      const wdioLogLevel = this.logger.level === 'debug' ? 'warn' : 'error';

      // Add options to reduce Appium logs
      const finalCapabilities = {
        ...capabilities,
        'appium:printPageSourceOnFindFailure': false // Avoid additional logs
      };

      this.driver = await remote({
        protocol: options.protocol || 'http',
        hostname: options.hostname || 'localhost',
        port: options.port || 4723,
        path: options.path || '/',
        capabilities: finalCapabilities,
        logLevel: options.wdioLogLevel || wdioLogLevel, // 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent'
        connectionRetryCount: 3,
        connectionRetryTimeout: 30000
      });

      this.logger.info('Appium session started', { sessionId: this.driver.sessionId });

      // Note: If clearState is enabled, Appium already cleared data automatically
      // (noReset: false in capabilities). We don't need to call clearState() here.
      // clearState() is useful when called after launch to clear state mid-test.

      return this;
    } catch (error) {
      this.logger.error('Failed to start Appium session', { error: error.message });

      // Improve error message for ANDROID_HOME
      if (error.message.includes('ANDROID_HOME') || error.message.includes('ANDROID_SDK_ROOT')) {
        const helpfulMessage = this._getAndroidHomeError();
        throw new Error(helpfulMessage);
      }

      throw new Error(`Appium launch failed: ${error.message}`);
    }
  }

  _buildCapabilities(options) {
    // Determine if appId is a file path or a package/bundle ID
    const isAppPath = this.appId.includes('/') || this.appId.includes('\\') ||
      extname(this.appId).toLowerCase() === '.apk' ||
      extname(this.appId).toLowerCase() === '.ipa';

    const baseCapabilities = {
      platformName: this.platform === 'android' ? 'Android' : 'iOS',
      'appium:automationName': this.platform === 'android' ? 'UiAutomator2' : 'XCUITest',
      'appium:deviceName': options.deviceName || (this.platform === 'android' ? 'Android Emulator' : 'iPhone Simulator'),
      'appium:newCommandTimeout': 300,
      'appium:noReset': !options.clearState,
      ...options.capabilities
    };

    // Only use appium:app if it's a file path
    if (isAppPath) {
      baseCapabilities['appium:app'] = this.appId;
    }

    // Android specific
    if (this.platform === 'android') {
      // If it's a package name (not a file path), use appPackage
      if (!isAppPath) {
        baseCapabilities['appium:appPackage'] = options.appPackage || this.appId;
        baseCapabilities['appium:appActivity'] = options.appActivity || '.MainActivity';
      } else {
        // If it's an APK, we can also specify package/activity if provided
        if (options.appPackage) {
          baseCapabilities['appium:appPackage'] = options.appPackage;
        }
        if (options.appActivity) {
          baseCapabilities['appium:appActivity'] = options.appActivity;
        }
      }

      if (options.deviceSerial) {
        baseCapabilities['appium:udid'] = options.deviceSerial;
      }

      // Specific capabilities for Android API 36+ (Android 16+) to resolve UiAutomation issues
      // These capabilities help avoid the "UiAutomation not connected" error
      // IMPORTANT: On Android 16, DO NOT use skipServerInstallation - can cause issues with corrupted servers
      // Let Appium reinstall the clean UiAutomator2 server on each session
      baseCapabilities['appium:skipUnlock'] = true; // Avoid unlock issues
      baseCapabilities['appium:autoGrantPermissions'] = true; // Automatically grant permissions
      baseCapabilities['appium:uiautomator2ServerLaunchTimeout'] = 60000; // More time to start server
      baseCapabilities['appium:ignoreHiddenApiPolicyError'] = true; // Ignore hidden API policy errors (Android 16)
      baseCapabilities['appium:disableWindowAnimation'] = true; // Disable animations (required for Android 16)
      baseCapabilities['appium:enforceXPath1'] = true; // Use XPath 1.0 (more compatible)
      // Configure shorter timeout for waitForIdle to avoid blocking
      baseCapabilities['appium:waitForIdleTimeout'] = 100; // Short timeout to stabilize
    }

    // iOS specific
    if (this.platform === 'ios') {
      // For iOS, bundleId is always needed
      if (!isAppPath) {
        baseCapabilities['appium:bundleId'] = this.appId;
      }
      if (options.deviceSerial) {
        baseCapabilities['appium:udid'] = options.deviceSerial;
      }
    }

    return baseCapabilities;
  }

  // ==================== UNIFIED SELECTORS ====================

  getByTestId(testId) {
    this._ensureInitialized();
    if (this._isMobile()) {
      return new MobileLocator(this.driver, testId, 'accessibility');
    }
    return this.page.getByTestId(testId);
  }

  getByText(text, options = {}) {
    this._ensureInitialized();
    if (this._isMobile()) {
      // For Appium we use UiSelector on Android or predicate string on iOS
      const index = options.index !== undefined ? options.index : null;
      if (this.platform === 'android') {
        const exact = options.exact ?? false;
        const selector = exact
          ? `android=new UiSelector().text("${text}")`
          : `android=new UiSelector().textContains("${text}")`;
        return new MobileLocator(this.driver, selector, 'xpath', null, index);
      } else {
        // iOS: use predicate string
        const selector = `label == "${text}" OR name == "${text}"`;
        return new MobileLocator(this.driver, `-ios predicate string:${selector}`, 'xpath', null, index);
      }
    }
    return this.page.getByText(text, options);
  }

  getByRole(role, options = {}) {
    this._ensureInitialized();
    if (this._isMobile()) {
      // On mobile, "role" translates to accessibility
      const name = options.name || '';
      return this.getByText(name, { index: options.index });
    }
    return this.page.getByRole(role, options);
  }

  getByLabel(label) {
    this._ensureInitialized();
    if (this._isMobile()) {
      // On mobile, try accessibility id first, then by text
      // Create a locator that tries multiple strategies
      if (this.platform === 'android') {
        // Search by accessibility id first, if it fails try by text
        // Use UiSelector that searches by content-desc or text
        const selector = `android=new UiSelector().description("${label}").className("android.widget.EditText")`;
        return new MobileLocator(this.driver, selector, 'xpath');
      }
      return new MobileLocator(this.driver, label, 'accessibility');
    }
    return this.page.getByLabel(label);
  }

  getByPlaceholder(placeholder) {
    this._ensureInitialized();
    if (this._isMobile()) {
      // On Android, placeholder can be in different places
      if (this.platform === 'android') {
        // Try multiple strategies:
        // 1. By description (content-desc) - most common in React Native
        // 2. By textContains - if placeholder is visible as text
        // 3. By accessibility id
        const strategies = [
          `android=new UiSelector().descriptionContains("${placeholder}").className("android.widget.EditText")`,
          `android=new UiSelector().textContains("${placeholder}").className("android.widget.EditText")`,
          `~${placeholder}` // accessibility id as fallback
        ];
        return new MobileLocator(this.driver, strategies[0], 'xpath', strategies);
      }
      return new MobileLocator(this.driver, placeholder, 'accessibility');
    }
    return this.page.getByPlaceholder(placeholder);
  }

  getById(id) {
    if (this._isMobile()) {
      return new MobileLocator(this.driver, id, 'id');
    }
    return this.page.locator(`#${id}`);
  }

  locator(selector) {
    this._ensureInitialized();
    if (this._isMobile()) {
      // Detect selector type
      if (selector.startsWith('~')) {
        return new MobileLocator(this.driver, selector.substring(1), 'accessibility');
      } else if (selector.includes('UiSelector') || selector.startsWith('android=')) {
        return new MobileLocator(this.driver, selector, 'xpath');
      } else {
        return new MobileLocator(this.driver, selector, 'xpath');
      }
    }
    return this.page.locator(selector);
  }

  // ==================== ACTIONS ====================

  async tapOn(selector, options = {}) {
    this._ensureInitialized();
    this.logger.debug('Tap action', { selector: this._selectorToString(selector) });

    try {
      if (this._isMobile()) {
        const locator = this._toLocator(selector);
        await locator.tap(options);
      } else {
        const element = this._toLocator(selector);
        await element.tap({
          timeout: options.timeout ?? 30000,
          force: options.force ?? false,
          position: options.position
        });
      }
      return this;
    } catch (error) {
      this.logger.error('Tap failed', { selector: this._selectorToString(selector), error: error.message });
      throw error;
    }
  }

  async doubleTapOn(selector) {
    this._ensureInitialized();
    if (this._isMobile()) {
      const element = await this._toMobileElement(selector);
      await element.doubleClick();
    } else {
      const element = this._toLocator(selector);
      await element.dblclick();
    }
    return this;
  }

  async longPress(selector, duration = 1000) {
    this._ensureInitialized();
    if (this._isMobile()) {
      const element = await this._toMobileElement(selector);
      const location = await element.getLocation();
      const size = await element.getSize();
      const centerX = Math.round(location.x + size.width / 2);
      const centerY = Math.round(location.y + size.height / 2);

      // Use W3C Actions API instead of deprecated touchAction
      await this.driver.performActions([
        {
          type: 'pointer',
          id: 'finger1',
          parameters: { pointerType: 'touch' },
          actions: [
            { type: 'pointerMove', duration: 0, x: centerX, y: centerY },
            { type: 'pointerDown', button: 0 },
            { type: 'pause', duration: duration },
            { type: 'pointerUp', button: 0 }
          ]
        }
      ]);
      await this.driver.releaseActions();
    } else {
      const element = this._toLocator(selector);
      const box = await element.boundingBox();
      if (!box) throw new Error('Element not found');

      await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await this.page.mouse.down();
      await this.page.waitForTimeout(duration);
      await this.page.mouse.up();
    }
    return this;
  }

  // ==================== RETRY METHODS ====================

  async tapOnWithRetry(selector, options = {}) {
    const maxRetries = options.retries ?? 5;
    const delayBetweenRetries = options.delay ?? 500;

    this.logger.debug('Tap with retry', {
      selector: this._selectorToString(selector),
      maxRetries
    });

    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.tapOn(selector, { timeout: options.timeout ?? 5000 });
        this.logger.debug(`Tap successful on attempt ${i + 1}`);

        // Esperar un poco para que el tap tenga efecto
        if (delayBetweenRetries > 0) {
          await this.waitFor(delayBetweenRetries);
        }

        return this;
      } catch (error) {
        this.logger.debug(`Tap attempt ${i + 1} failed`, { error: error.message });

        if (i === maxRetries - 1) {
          this.logger.error('All tap retries failed', {
            selector: this._selectorToString(selector),
            attempts: maxRetries
          });
          throw error;
        }

        // Esperar antes del siguiente intento
        await this.waitFor(delayBetweenRetries);
      }
    }

    return this;
  }

  async tapOnUntilGone(selector, options = {}) {
    const maxAttempts = options.maxAttempts ?? 10;
    const checkInterval = options.checkInterval ?? 500;
    const tapDelay = options.tapDelay ?? 300;

    this.logger.debug('Tap until gone', {
      selector: this._selectorToString(selector),
      maxAttempts
    });

    for (let i = 0; i < maxAttempts; i++) {
      const isVisible = await this.isVisible(selector);

      if (!isVisible) {
        this.logger.debug(`Element gone after ${i} taps`);
        return this;
      }

      try {
        await this.tapOn(selector, { timeout: 3000 });
        this.logger.debug(`Tap ${i + 1} executed`);
      } catch (error) {
        this.logger.debug(`Tap ${i + 1} failed, checking if element is gone`);
      }

      // Esperar antes de verificar nuevamente
      await this.waitFor(tapDelay);

      // Verificar si desapareció después del tap
      const stillVisible = await this.isVisible(selector);
      if (!stillVisible) {
        this.logger.debug(`Element gone after tap ${i + 1}`);
        return this;
      }

      // Esperar antes del siguiente intento
      if (i < maxAttempts - 1) {
        await this.waitFor(checkInterval);
      }
    }

    this.logger.warn('Element still visible after max attempts', {
      selector: this._selectorToString(selector),
      maxAttempts
    });

    return this;
  }

  async tapOnUntilVisible(selector, targetSelector, options = {}) {
    const maxAttempts = options.maxAttempts ?? 10;
    const checkInterval = options.checkInterval ?? 500;
    const tapDelay = options.tapDelay ?? 300;

    this.logger.debug('Tap until visible', {
      selector: this._selectorToString(selector),
      target: this._selectorToString(targetSelector),
      maxAttempts
    });

    for (let i = 0; i < maxAttempts; i++) {
      // Verificar si el elemento objetivo ya es visible
      const isTargetVisible = await this.isVisible(targetSelector);

      if (isTargetVisible) {
        this.logger.debug(`Target visible after ${i} taps`);
        return this;
      }

      try {
        await this.tapOn(selector, { timeout: 3000 });
        this.logger.debug(`Tap ${i + 1} executed`);
      } catch (error) {
        this.logger.debug(`Tap ${i + 1} failed, checking if target appeared`);
      }

      // Esperar para que el tap tenga efecto
      await this.waitFor(tapDelay);

      // Verificar si el objetivo apareció
      const targetNowVisible = await this.isVisible(targetSelector);
      if (targetNowVisible) {
        this.logger.debug(`Target visible after tap ${i + 1}`);
        return this;
      }

      // Esperar antes del siguiente intento
      if (i < maxAttempts - 1) {
        await this.waitFor(checkInterval);
      }
    }

    this.logger.warn('Target not visible after max attempts', {
      selector: this._selectorToString(selector),
      target: this._selectorToString(targetSelector),
      maxAttempts
    });

    throw new Error(`Target element not visible after ${maxAttempts} tap attempts`);
  }

  async tapAtCoordinates(x, y, options = {}) {
    this.logger.debug('Tap at coordinates', { x, y });

    if (this._isMobile()) {
      // Usar W3C Actions API para mobile
      await this.driver.performActions([
        {
          type: 'pointer',
          id: 'finger1',
          parameters: { pointerType: 'touch' },
          actions: [
            { type: 'pointerMove', duration: 0, x: Math.round(x), y: Math.round(y) },
            { type: 'pointerDown', button: 0 },
            { type: 'pause', duration: options.duration || 100 },
            { type: 'pointerUp', button: 0 }
          ]
        }
      ]);
      await this.driver.releaseActions();
    } else {
      // Para web
      await this.page.mouse.click(x, y);
    }

    return this;
  }

  async tapOnElementByCoordinates(selector, options = {}) {
    this.logger.debug('Tap on element by coordinates', { selector: this._selectorToString(selector) });

    if (this._isMobile()) {
      const element = await this._toMobileElement(selector);
      const location = await element.getLocation();
      const size = await element.getSize();

      const centerX = Math.round(location.x + size.width / 2);
      // Usar 70% de la altura en lugar del centro (50%) para evitar overlays
      const centerY = Math.round(location.y + size.height * 0.7);

      this.logger.debug('Calculated coordinates', { x: centerX, y: centerY });

      await this.tapAtCoordinates(centerX, centerY, options);
    } else {
      // Para web, usar click normal
      const element = this._toLocator(selector);
      await element.click();
    }

    return this;
  }

  // ==================== TEXT INPUT ====================

  async fill(selector, text) {
    this._ensureInitialized();
    this.logger.debug('Fill action', { selector: this._selectorToString(selector), text });

    try {
      if (this._isMobile()) {
        const locator = this._toLocator(selector);
        await locator.fill(text);
      } else {
        const element = this._toLocator(selector);
        await element.fill(text);
      }
      return this;
    } catch (error) {
      this.logger.error('Fill failed', { selector: this._selectorToString(selector), error: error.message });
      throw error;
    }
  }

  async inputText(text, options = {}) {
    const selector = options.into || 'input:focus, textarea:focus';
    return await this.fill(selector, text);
  }

  async type(selector, text, options = {}) {
    this._ensureInitialized();
    if (this._isMobile()) {
      // Appium doesn't have pressSequentially, use setValue with simulated delay
      const element = await this._toMobileElement(selector);
      for (const char of text) {
        await element.addValue(char);
        if (options.delay) {
          await this.driver.pause(options.delay);
        }
      }
    } else {
      const element = this._toLocator(selector);
      await element.pressSequentially(text, { delay: options.delay ?? 50 });
    }
    return this;
  }

  async clearText(selector) {
    if (this._isMobile()) {
      const locator = this._toLocator(selector);
      await locator.clear();
    } else {
      const element = this._toLocator(selector);
      await element.clear();
    }
    return this;
  }

  async eraseText(selector, charactersToErase = null) {
    if (this._isMobile()) {
      if (charactersToErase) {
        for (let i = 0; i < charactersToErase; i++) {
          await this.driver.pressKeyCode(67); // Android: KEYCODE_DEL
        }
      } else {
        await this.clearText(selector);
      }
    } else {
      const element = this._toLocator(selector);
      if (charactersToErase) {
        for (let i = 0; i < charactersToErase; i++) {
          await element.press('Backspace');
        }
      } else {
        await element.clear();
      }
    }
    return this;
  }

  // ==================== NAVIGATION ====================

  async openLink(url) {
    if (this._isMobile()) {
      this.logger.warn('openLink not supported on mobile native apps');
    } else {
      await this.page.goto(url);
    }
    return this;
  }

  async back() {
    if (this._isMobile()) {
      await this.driver.back();
    } else {
      await this.page.goBack();
    }
    return this;
  }

  async forward() {
    if (this._isMobile()) {
      this.logger.warn('Forward navigation not supported on mobile');
    } else {
      await this.page.goForward();
    }
    return this;
  }

  async reload() {
    this._ensureInitialized();
    if (this._isMobile()) {
      // Reload app: terminate and relaunch
      await this.driver.terminateApp(this.appId);
      await this.driver.activateApp(this.appId);
      // Wait for app to be ready
      await this.waitFor(2000);
    } else {
      await this.page.reload();
    }
    return this;
  }

  // ==================== SCROLL AND GESTURES ====================

  async scroll(options = {}) {
    this._ensureInitialized();
    const direction = options.direction || 'down';
    const distance = options.distance || 300;

    if (this._isMobile()) {
      if (this.platform === 'android') {
        // Use Appium's native mobile:scrollGesture command for Android (more reliable)
        try {
          const size = await this.driver.getWindowSize();
          const scrollArea = {
            left: Math.round(size.width * 0.1),
            top: Math.round(size.height * 0.2),
            width: Math.round(size.width * 0.8),
            height: Math.round(size.height * 0.6)
          };
          
          await this.driver.execute('mobile: scrollGesture', {
            left: scrollArea.left,
            top: scrollArea.top,
            width: scrollArea.width,
            height: scrollArea.height,
            direction: direction === 'down' ? 'down' : 'up',
            percent: 0.5,
            speed: 500
          });
        } catch (error) {
          // Fallback to swipe if mobile:scrollGesture fails
          this.logger.debug('mobile:scrollGesture failed, using swipe fallback', { error: error.message });
          await this.swipe(direction === 'down' ? 'up' : 'down', { distance });
        }
      } else {
        // iOS - use swipe
        await this.swipe(direction === 'down' ? 'up' : 'down', { distance });
      }
    } else {
      await this.swipe(direction === 'down' ? 'up' : 'down', { distance });
    }
    return this;
  }

  async scrollUntilVisible(selector, options = {}) {
    const maxScrolls = options.maxScrolls ?? 10;
    const direction = options.direction ?? 'down';

    for (let i = 0; i < maxScrolls; i++) {
      const isVisible = await this.isVisible(selector);
      if (isVisible) return this;

      await this.scroll({ direction });
      await this.waitFor(300);
    }

    this.logger.error('Element not found after scrolling', { selector: this._selectorToString(selector), maxScrolls });
    throw new Error(`Element not found after ${maxScrolls} scrolls`);
  }

  async swipe(direction, options = {}) {
    this._ensureInitialized();
    if (this._isMobile()) {
      const size = await this.driver.getWindowSize();
      const startX = Math.round(options.startX || size.width / 2);
      const startY = Math.round(options.startY || size.height / 2);
      const distance = options.distance ?? 300;

      const directions = {
        up: { x: startX, y: startY, toX: startX, toY: Math.max(0, startY - distance) },
        down: { x: startX, y: startY, toX: startX, toY: Math.min(size.height, startY + distance) },
        left: { x: startX, y: startY, toX: Math.max(0, startX - distance), toY: startY },
        right: { x: startX, y: startY, toX: Math.min(size.width, startX + distance), toY: startY }
      };

      const coords = directions[direction];
      if (!coords) throw new Error(`Invalid swipe direction: ${direction}`);

      // Use Appium's native mobile:swipeGesture command for Android (more reliable than W3C Actions)
      if (this.platform === 'android') {
        try {
          // Calculate swipe area - use a small area around the start point
          const swipeArea = 50; // Small area for swipe gesture
          const startX = Math.round(coords.x);
          const startY = Math.round(coords.y);
          const endX = Math.round(coords.toX);
          const endY = Math.round(coords.toY);
          
          // Determine direction based on coordinates
          let swipeDirection;
          if (Math.abs(endY - startY) > Math.abs(endX - startX)) {
            swipeDirection = endY < startY ? 'up' : 'down';
          } else {
            swipeDirection = endX < startX ? 'left' : 'right';
          }
          
          await this.driver.execute('mobile: swipeGesture', {
            left: Math.max(0, Math.min(startX, endX) - swipeArea),
            top: Math.max(0, Math.min(startY, endY) - swipeArea),
            width: Math.abs(endX - startX) + (swipeArea * 2) || swipeArea * 2,
            height: Math.abs(endY - startY) + (swipeArea * 2) || swipeArea * 2,
            direction: swipeDirection,
            percent: 1.0,
            speed: 500
          });
        } catch (error) {
          // Fallback to W3C Actions if mobile:swipeGesture fails
          this.logger.debug('mobile:swipeGesture failed, using W3C Actions fallback', { error: error.message });
          await this.driver.performActions([
            {
              type: 'pointer',
              id: 'finger1',
              parameters: { pointerType: 'touch' },
              actions: [
                { type: 'pointerMove', duration: 0, x: Math.round(coords.x), y: Math.round(coords.y) },
                { type: 'pointerDown', button: 0 },
                { type: 'pause', duration: 100 },
                { type: 'pointerMove', duration: 300, x: Math.round(coords.toX), y: Math.round(coords.toY) },
                { type: 'pointerUp', button: 0 }
              ]
            }
          ]);
          await this.driver.releaseActions();
        }
      } else {
        // iOS - use W3C Actions
        await this.driver.performActions([
          {
            type: 'pointer',
            id: 'finger1',
            parameters: { pointerType: 'touch' },
            actions: [
              { type: 'pointerMove', duration: 0, x: Math.round(coords.x), y: Math.round(coords.y) },
              { type: 'pointerDown', button: 0 },
              { type: 'pause', duration: 100 },
              { type: 'pointerMove', duration: 300, x: Math.round(coords.toX), y: Math.round(coords.toY) },
              { type: 'pointerUp', button: 0 }
            ]
          }
        ]);
        await this.driver.releaseActions();
      }
    } else {
      const viewport = this.page.viewportSize();
      const startX = options.startX || viewport.width / 2;
      const startY = options.startY || viewport.height / 2;
      const distance = options.distance ?? 300;

      const directions = {
        up: { x: startX, y: startY + distance, toX: startX, toY: startY - distance },
        down: { x: startX, y: startY - distance, toX: startX, toY: startY + distance },
        left: { x: startX + distance, y: startY, toX: startX - distance, toY: startY },
        right: { x: startX - distance, y: startY, toX: startX + distance, toY: startY }
      };

      const coords = directions[direction];
      await this.page.mouse.move(coords.x, coords.y);
      await this.page.mouse.down();
      await this.page.mouse.move(coords.toX, coords.toY, { steps: 10 });
      await this.page.mouse.up();
    }
    return this;
  }

  // ==================== WAITS ====================

  async waitFor(milliseconds) {
    this._ensureInitialized();
    if (this._isMobile()) {
      await this.driver.pause(milliseconds);
    } else {
      await this.page.waitForTimeout(milliseconds);
    }
    return this;
  }

  async waitForVisible(selector, options = {}) {
    this.logger.debug('Waiting for visible', { selector: this._selectorToString(selector) });

    if (this._isMobile()) {
      const locator = this._toLocator(selector);
      await locator.waitFor({ state: 'visible', timeout: options.timeout || 30000 });
    } else {
      const element = this._toLocator(selector);
      await element.waitFor({ state: 'visible', timeout: options.timeout || 30000 });
    }
    return this;
  }

  async waitUntilGone(selector, options = {}) {
    if (this._isMobile()) {
      const locator = this._toLocator(selector);
      await locator.waitFor({ state: 'hidden', timeout: options.timeout || 30000 });
    } else {
      const element = this._toLocator(selector);
      await element.waitFor({ state: 'hidden', timeout: options.timeout || 30000 });
    }
    return this;
  }

  async extendedWaitUntil(options = {}) {
    const { visible, notVisible, timeout = 30000 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (visible) {
        const isVisible = await this.isVisible(visible);
        if (isVisible) return this;
      }

      if (notVisible) {
        const isVisible = await this.isVisible(notVisible);
        if (!isVisible) return this;
      }

      await this.waitFor(100);
    }

    throw new Error('Extended wait condition not met');
  }

  // ==================== HELPER METHODS ====================

  async isVisible(selector) {
    this._ensureInitialized();
    try {
      if (this._isMobile()) {
        const locator = this._toLocator(selector);
        return await locator.isVisible();
      } else {
        const element = this._toLocator(selector);
        return await element.isVisible();
      }
    } catch (error) {
      this.logger.debug('isVisible check failed', { selector: this._selectorToString(selector) });
      return false;
    }
  }

  async isHidden(selector) {
    return !(await this.isVisible(selector));
  }

  async isEnabled(selector) {
    try {
      if (this._isMobile()) {
        const locator = this._toLocator(selector);
        return await locator.isEnabled();
      } else {
        const element = this._toLocator(selector);
        return await element.isEnabled();
      }
    } catch (error) {
      return false;
    }
  }

  async isDisabled(selector) {
    return !(await this.isEnabled(selector));
  }

  async isChecked(selector) {
    if (this._isMobile()) {
      const element = await this._toMobileElement(selector);
      const isSelected = await element.isSelected();
      return isSelected;
    } else {
      const element = this._toLocator(selector);
      return await element.isChecked();
    }
  }

  async count(selector) {
    if (this._isMobile()) {
      const locator = this._toLocator(selector);
      return await locator.count();
    } else {
      const element = this._toLocator(selector);
      return await element.count();
    }
  }

  // ==================== ASSERTIONS ====================

  expect(selector) {
    if (this._isMobile()) {
      // Para mobile, devolver wrapper que soporte assertions
      return this._createMobileExpect(selector);
    }
    const element = this._toLocator(selector);
    return expect(element);
  }

  _createMobileExpect(selector) {
    const self = this;
    return {
      async toBeVisible() {
        const isVisible = await self.isVisible(selector);
        if (!isVisible) throw new Error(`Expected element to be visible: ${self._selectorToString(selector)}`);
      },
      async toBeHidden() {
        const isVisible = await self.isVisible(selector);
        if (isVisible) throw new Error(`Expected element to be hidden: ${self._selectorToString(selector)}`);
      },
      async toHaveText(text) {
        const actualText = await self.getText(selector);
        if (actualText !== text) {
          throw new Error(`Expected text "${text}", got "${actualText}"`);
        }
      },
      async toContainText(text) {
        const actualText = await self.getText(selector);
        if (!actualText.includes(text)) {
          throw new Error(`Expected to contain "${text}", got "${actualText}"`);
        }
      }
    };
  }

  async toBeVisible(selector) {
    await this.expect(selector).toBeVisible();
    return this;
  }

  async toBeHidden(selector) {
    await this.expect(selector).toBeHidden();
    return this;
  }

  async toHaveText(selector, text, options = {}) {
    if (this._isMobile()) {
      const actualText = await this.getText(selector);
      if (actualText !== text) {
        throw new Error(`Expected text "${text}", got "${actualText}"`);
      }
    } else {
      await expect(this._toLocator(selector)).toHaveText(text, options);
    }
    return this;
  }

  async toContainText(selector, text) {
    if (this._isMobile()) {
      await this.expect(selector).toContainText(text);
    } else {
      await expect(this._toLocator(selector)).toContainText(text);
    }
    return this;
  }

  async toHaveValue(selector, value) {
    if (this._isMobile()) {
      const actualValue = await this.getValue(selector);
      if (actualValue !== value) {
        throw new Error(`Expected value "${value}", got "${actualValue}"`);
      }
    } else {
      await expect(this._toLocator(selector)).toHaveValue(value);
    }
    return this;
  }

  async toHaveCount(selector, count) {
    const actualCount = await this.count(selector);
    const expectedCount = typeof count === 'object' ? count : { exact: count };

    if (expectedCount.exact !== undefined && actualCount !== expectedCount.exact) {
      throw new Error(`Expected count ${expectedCount.exact}, got ${actualCount}`);
    }
    if (expectedCount.min !== undefined && actualCount < expectedCount.min) {
      throw new Error(`Expected min count ${expectedCount.min}, got ${actualCount}`);
    }
    if (expectedCount.max !== undefined && actualCount > expectedCount.max) {
      throw new Error(`Expected max count ${expectedCount.max}, got ${actualCount}`);
    }
    return this;
  }

  async toBeEnabled(selector) {
    const isEnabled = await this.isEnabled(selector);
    if (!isEnabled) throw new Error('Expected element to be enabled');
    return this;
  }

  async toBeDisabled(selector) {
    const isEnabled = await this.isEnabled(selector);
    if (isEnabled) throw new Error('Expected element to be disabled');
    return this;
  }

  async toHaveURL(url, options = {}) {
    if (this._isMobile()) {
      this.logger.warn('toHaveURL not supported on mobile native apps');
    } else {
      await expect(this.page).toHaveURL(url, options);
    }
    return this;
  }

  async toHaveTitle(title, options = {}) {
    if (this._isMobile()) {
      this.logger.warn('toHaveTitle not supported on mobile native apps');
    } else {
      await expect(this.page).toHaveTitle(title, options);
    }
    return this;
  }

  // ==================== ACCIONES ADICIONALES ====================

  async selectOption(selector, value) {
    if (this._isMobile()) {
      this.logger.warn('selectOption limited support on mobile');
      await this.tapOn(selector);
      await this.tapOn(this.getByText(value));
    } else {
      const element = this._toLocator(selector);
      await element.selectOption(value);
    }
    return this;
  }

  async check(selector) {
    if (this._isMobile()) {
      const isChecked = await this.isChecked(selector);
      if (!isChecked) {
        await this.tapOn(selector);
      }
    } else {
      const element = this._toLocator(selector);
      await element.check();
    }
    return this;
  }

  async uncheck(selector) {
    if (this._isMobile()) {
      const isChecked = await this.isChecked(selector);
      if (isChecked) {
        await this.tapOn(selector);
      }
    } else {
      const element = this._toLocator(selector);
      await element.uncheck();
    }
    return this;
  }

  async press(key) {
    this._ensureInitialized();
    if (this._isMobile()) {
      // Basic mapping of common keys
      const keyMap = {
        'Enter': 66, // KEYCODE_ENTER
        'Escape': 111, // KEYCODE_ESCAPE
        'Backspace': 67 // KEYCODE_DEL
      };
      const keyCode = keyMap[key] || 0;
      if (keyCode) {
        await this.driver.pressKeyCode(keyCode);
      }
    } else {
      await this.page.keyboard.press(key);
    }
    return this;
  }

  async hideKeyboard() {
    if (this._isMobile()) {
      await this.driver.hideKeyboard();
    } else {
      await this.page.keyboard.press('Escape');
    }
    return this;
  }

  async setLocation(latitude, longitude) {
    if (this._isMobile()) {
      await this.driver.setGeoLocation({ latitude, longitude });
    } else {
      await this.context.setGeolocation({ latitude, longitude });
    }
    return this;
  }

  async setOrientation(orientation) {
    if (this._isMobile()) {
      await this.driver.setOrientation(orientation.toUpperCase());
    } else {
      const orientations = {
        portrait: { width: 390, height: 844 },
        landscape: { width: 844, height: 390 }
      };
      await this.page.setViewportSize(orientations[orientation]);
    }
    return this;
  }

  // ==================== UTILITIES ====================

  async getText(selector) {
    this._ensureInitialized();
    if (this._isMobile()) {
      const locator = this._toLocator(selector);
      return await locator.getText();
    } else {
      const element = this._toLocator(selector);
      return await element.textContent();
    }
  }

  async getValue(selector) {
    this._ensureInitialized();
    if (this._isMobile()) {
      const element = await this._toMobileElement(selector);
      return await element.getValue();
    } else {
      const element = this._toLocator(selector);
      return await element.inputValue();
    }
  }

  async screenshot(options = {}) {
    this._ensureInitialized();
    const path = options.path ?? `screenshot-${Date.now()}.png`;

    if (this._isMobile()) {
      await this.driver.saveScreenshot(path);
    } else {
      await this.page.screenshot({ path, fullPage: options.fullPage ?? false });
    }

    this.logger.info('Screenshot taken', { path });
    return this;
  }

  async takeScreenshot(path) {
    return await this.screenshot({ path });
  }

  async startRecording() {
    if (this._isMobile()) {
      await this.driver.startRecordingScreen();
      this.logger.info('Recording started');
    } else {
      this.logger.warn('Recording not supported on web platform');
    }
    return this;
  }

  async stopRecording(options = {}) {
    if (this._isMobile()) {
      const video = await this.driver.stopRecordingScreen();
      if (options.path) {
        const fs = await import('fs/promises');
        await fs.writeFile(options.path, Buffer.from(video, 'base64'));
        this.logger.info('Recording saved', { path: options.path });
      }
      return video;
    } else {
      this.logger.warn('Recording not supported on web platform');
    }
    return this;
  }

  async copyTextFrom(selector) {
    const text = await this.getText(selector);

    if (this._isMobile()) {
      await this.driver.setClipboard(text, 'plaintext');
    } else {
      await this.page.evaluate(t => navigator.clipboard.writeText(t), text);
    }
    return this;
  }

  async pasteText() {
    if (this._isMobile()) {
      const text = await this.driver.getClipboard();
      await this.inputText(text);
    } else {
      const text = await this.page.evaluate(() => navigator.clipboard.readText());
      await this.inputText(text);
    }
    return this;
  }

  // ==================== VARIABLES AND ENVIRONMENT ====================

  async evalScript(script) {
    if (this._isMobile()) {
      return await this.driver.execute(script);
    } else {
      return await this.page.evaluate(script);
    }
  }

  async runScript(script) {
    return await this.evalScript(script);
  }

  async setEnv(key, value) {
    this.env[key] = value;
    return this;
  }

  getEnv(key) {
    return this.env[key];
  }

  // ==================== CLEANUP ====================

  async close() {
    this.logger.info('Closing session');

    try {
      if (this._isMobile()) {
        await this.driver?.deleteSession();
      } else {
        await this.page?.close();
        await this.context?.close();
        await this.browser?.close();
      }
    } catch (error) {
      this.logger.error('Error during cleanup', { error: error.message });
    }
  }

  async stopApp() {
    if (this._isMobile()) {
      if (!this.appId) {
        throw new Error('appId is required to stop app');
      }
      await this.driver.terminateApp(this.appId);
      this.logger.info('App terminated', { appId: this.appId });
    }
    return this;
  }

  async clearState() {
    this.logger.info('Clearing state');

    try {
      if (this._isMobile()) {
        if (!this.appId) {
          throw new Error('appId is required to clear state');
        }

        if (!this.driver) {
          throw new Error('Driver not initialized. Cannot clear state before launch.');
        }

        // Terminate app if running
        try {
          await this.driver.terminateApp(this.appId);
        } catch (error) {
          // App might not be running, continue
          this.logger.debug('App termination skipped', { error: error.message });
        }

        // Clear data (Android)
        if (this.platform === 'android') {
          try {
            await this.driver.execute('mobile: shell', {
              command: 'pm',
              args: ['clear', this.appId]
            });
          } catch (error) {
            this.logger.warn('Failed to clear app data via shell', { error: error.message });
          }
        }

        // Relaunch app
        await this.driver.activateApp(this.appId);
        // Wait for app to be ready
        await this.waitFor(2000);

      } else {
        if (!this.context) {
          throw new Error('Context not initialized. Cannot clear state before launch.');
        }
        await this.context.clearCookies();
        await this.page.evaluate(() => {
          try {
            localStorage?.clear();
            sessionStorage?.clear();
          } catch (e) {
            // Storage might not be available in some contexts
            console.warn('Could not clear storage:', e.message);
          }
        });
      }
    } catch (error) {
      this.logger.error('Clear state failed', { error: error.message });
      throw error;
    }

    return this;
  }

  async clearKeychain() {
    if (this.platform === 'ios' && this._isMobile()) {
      // iOS keychain reset requires specific capabilities
      this.logger.warn('clearKeychain requires app restart with resetOnSessionStartOnly=false capability');
    } else {
      this.logger.warn('clearKeychain only available on iOS');
    }
    return this;
  }

  // ==================== INTERNAL HELPERS ====================

  _isMobile() {
    return this.platform === 'android' || this.platform === 'ios';
  }

  _detectAndroidHome() {
    // First check environment variables
    if (process.env.ANDROID_HOME && existsSync(process.env.ANDROID_HOME)) {
      return process.env.ANDROID_HOME;
    }
    if (process.env.ANDROID_SDK_ROOT && existsSync(process.env.ANDROID_SDK_ROOT)) {
      return process.env.ANDROID_SDK_ROOT;
    }

    // Try common locations
    const home = homedir();
    const commonPaths = [
      join(home, 'Library', 'Android', 'sdk'),      // macOS
      join(home, 'Android', 'Sdk'),                  // Linux
      join(home, 'AppData', 'Local', 'Android', 'Sdk'), // Windows
      '/opt/android-sdk',                             // Linux alternative
      '/usr/local/android-sdk',                       // Linux alternative
    ];

    for (const path of commonPaths) {
      if (existsSync(path)) {
        return path;
      }
    }

    return null;
  }

  async _cleanAppiumServers(deviceSerial) {
    // Clean Appium servers to resolve issues with Android 16 (API 36+)
    // This resolves the "UiAutomation not connected" error
    const androidHome = this._detectAndroidHome() || process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
    if (!androidHome) {
      this.logger.warn('Cannot clean Appium servers: ANDROID_HOME not found');
      return;
    }

    const adbPath = join(androidHome, 'platform-tools', 'adb');
    if (!existsSync(adbPath)) {
      this.logger.warn('Cannot clean Appium servers: ADB not found');
      return;
    }

    const appiumPackages = [
      'io.appium.uiautomator2.server',
      'io.appium.uiautomator2.server.test'
    ];

    try {
      for (const packageName of appiumPackages) {
        try {
          // Try to uninstall package (may fail if not installed, that's okay)
          execSync(`${adbPath} -s ${deviceSerial} uninstall ${packageName}`, {
            stdio: 'ignore',
            timeout: 5000
          });
          this.logger.debug(`Cleaned Appium package: ${packageName}`);
        } catch (error) {
          // Ignore errors if package is not installed
          this.logger.debug(`Package ${packageName} not found or already removed`);
        }
      }
      this.logger.info('Appium servers cleaned successfully');
    } catch (error) {
      this.logger.warn('Failed to clean Appium servers', { error: error.message });
      // Don't throw error, just log - Appium will reinstall servers if needed
    }
  }

  _getAndroidHomeError() {
    const detectedPath = this._detectAndroidHome();
    const home = homedir();
    const shellFile = process.platform === 'win32' ? '~/.bashrc' : '~/.zshrc';

    let message = '\n' + '='.repeat(70) + '\n';
    message += 'ERROR: ANDROID_HOME is not configured in the Appium process\n';
    message += '='.repeat(70) + '\n\n';

    if (detectedPath) {
      message += `Android SDK automatically detected at:\n  ${detectedPath}\n\n`;
      message += 'QUICK FIX (3 steps):\n\n';
      message += 'Step 1: Configure environment variables (copy and paste in terminal):\n';
      message += `  echo 'export ANDROID_HOME="${detectedPath}"' >> ${shellFile}\n`;
      message += `  echo 'export PATH=$PATH:$ANDROID_HOME/platform-tools' >> ${shellFile}\n`;
      message += `  echo 'export PATH=$PATH:$ANDROID_HOME/tools' >> ${shellFile}\n\n`;

      message += 'Step 2: Reload configuration:\n';
      message += `  source ${shellFile}\n\n`;

      message += 'Step 3: RESTART Appium (this is mandatory):\n';
      message += '  - Go to the terminal where Appium is running\n';
      message += '  - Press Ctrl+C to stop it\n';
      message += '  - Run: appium\n';
      message += '  - Then run your tests again: npm test\n\n';
    } else {
      message += 'WARNING: Could not automatically detect Android SDK.\n\n';
      message += 'Search for your SDK in these common locations:\n';
      message += `  - macOS: ${join(home, 'Library', 'Android', 'sdk')}\n`;
      message += `  - Linux: ${join(home, 'Android', 'Sdk')}\n`;
      message += `  - Windows: %LOCALAPPDATA%\\Android\\Sdk\n\n`;
      message += 'Once you find the path, configure it and restart Appium.\n\n';
    }

    message += 'Why restart Appium?\n';
    message += '  Appium needs ANDROID_HOME in its process at startup.\n';
    message += '  If it was already running, it will not see the new variables.\n';
    message += '='.repeat(70) + '\n';

    return message;
  }

  _ensureInitialized() {
    if (this._isMobile()) {
      if (!this.driver) {
        throw new Error('Driver not initialized. Call launch() first.');
      }
    } else {
      if (!this.page) {
        throw new Error('Page not initialized. Call launch() first.');
      }
    }
  }

  _toLocator(selector) {
    this._ensureInitialized();
    if (typeof selector === 'string') {
      return this._isMobile() ? this.locator(selector) : this.page.locator(selector);
    }
    return selector;
  }

  async _toMobileElement(selector, options = {}) {
    const locator = this._toLocator(selector);
    if (locator instanceof MobileLocator) {
      const element = await locator._getElement();
      if (options.timeout) {
        await element.waitForDisplayed({ timeout: options.timeout });
      }
      return element;
    }
    throw new Error('Invalid selector for mobile');
  }

  _selectorToString(selector) {
    if (typeof selector === 'string') return selector;
    if (selector instanceof MobileLocator) return `${selector.type}:${selector.selector}`;
    if (selector?._selector) return selector._selector;
    return 'unknown';
  }
}

export default DualityTest;

/* ==================== USAGE EXAMPLES ==================== */

/*
// ===== ANDROID =====
import DualityTest from './dualitytest.js';

async function testAndroidApp() {
  const app = new DualityTest({ 
    appId: 'com.example.app',
    platform: 'android',
    enableLogging: true,
    logLevel: 'debug'
  });

  await app.launch({ 
    headless: false,
    clearState: true,
    deviceName: 'Pixel 6',
    appPackage: 'com.example.app',
    appActivity: '.MainActivity'
  });

  // API identical to Playwright!
  await app
    .fill(app.getByLabel('Username'), 'testuser')
    .fill(app.getByLabel('Password'), 'password123')
    .tapOn(app.getByRole('button', { name: 'Login' }))
    .waitForVisible(app.getByText('Welcome'));

  // Native if/else
  if (await app.isVisible(app.getByText('Accept Terms'))) {
    await app.tapOn(app.getByText('Accept'));
  }

  await app
    .toBeVisible(app.getByTestId('dashboard'))
    .screenshot({ path: 'android-dashboard.png' })
    .close();
}

// ===== iOS =====
async function testIOSApp() {
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
}

// ===== WEB =====
async function testWeb() {
  const app = new DualityTest({ 
    appId: 'https://example.com',
    platform: 'web'
  });

  await app.launch({ headless: false, clearState: true });

  // Native for loop
  for (let i = 0; i < 3; i++) {
    await app
      .tapOn(`.item-${i}`)
      .toBeVisible('.details')
      .back();
  }

  await app.close();
}

// ===== COMPLEX TEST WITH IF/WHILE =====
async function testComplexFlow() {
  const app = new DualityTest({ 
    appId: 'com.shop.android',
    platform: 'android'
  });

  await app.launch({ clearState: true });

  // Handle permissions
  if (await app.isVisible(app.getByText('Allow'))) {
    await app.tapOn(app.getByText('Allow'));
  }

  // Scroll until product is found
  let found = false;
  let attempts = 0;
  while (!found && attempts < 10) {
    found = await app.isVisible(app.getByText('Product X'));
    if (!found) {
      await app.scroll({ direction: 'down' });
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
}
*/