// ==UserScript==
// @name         KeyNavGoogleResults
// @license MIT
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Keyboard shortcuts for Google search: numbers (1-0) open results in background tabs (Shift for foreground tab, Alt for current tab), Arrow Up/Down to navigate results, Enter to open selected result, Left/Right arrows to navigate pages
// @author       pietrodn
// @match        https://www.google.com/search*
// @match        https://google.com/search*
// @grant        GM_openInTab
// @grant        window.focus
// @noframes
// ==/UserScript==
// Forked from: https://greasyfork.org/en/scripts/524830-keynavgoogleresults (MIT license) from aceitw

(function () {
  'use strict';

  const STYLES = {
    indicatorBg: '#f1f3f4',
    indicatorText: '#202124',
    indicatorSize: '20px',
    fontSize: '12px',
    borderColor: '#5f6368',
    shadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
    selectionColor: '#1a73e8', // Google Blue for selection
  };

  // State variables
  let isProcessing = false;
  let selectedIndex = -1; // Tracks the currently selected result index
  let lastResultCount = 0; // Tracks the count of results to detect changes

  function getNumberKey(e) {
    const code = e.which || e.keyCode;
    if (code >= 48 && code <= 57) return code === 48 ? 0 : code - 48;
    if (code >= 96 && code <= 105) return code - 96;
    return null;
  }

  /**
   * Helper function to get the array of valid search result elements.
   * This filter excludes elements like "People also ask".
   */
  function getValidResults() {
    return Array.from(document.querySelectorAll('div.A6K0A:has(a > h3):not(:has(span[role=heading]))'));
  }

  /**
   * Updates the visual indicator (the blue triangle and outline) for the newly selected result.
   * @param {number} newIndex The index of the result to select.
   * @param {boolean} shouldScroll Whether to force the result into view. Default is false.
   */
  function updateSelectionIndicator(newIndex, shouldScroll = false) {
    const results = getValidResults();

    // 1. Deselect old result
    if (selectedIndex >= 0 && selectedIndex < results.length) {
      const oldResult = results[selectedIndex];
      const oldTriangle = oldResult.querySelector('.search-result-triangle-indicator');
      if (oldTriangle) {
        oldTriangle.style.color = 'transparent';
        oldResult.style.outline = 'none'; // Remove outline/focus style
        oldResult.style.borderRadius = '0'; // Reset border radius on deselected item
      }
    }

    // 2. Set new index
    selectedIndex = newIndex;

    // 3. Select new result
    if (selectedIndex >= 0 && selectedIndex < results.length) {
      const newResult = results[selectedIndex];
      const newTriangle = newResult.querySelector('.search-result-triangle-indicator');

      if (newTriangle) {
        newTriangle.style.color = STYLES.selectionColor; // Make triangle visible
        // Add a subtle outline to the entire result block for better visual focus
        newResult.style.outline = `2px solid ${STYLES.selectionColor}`;
        newResult.style.outlineOffset = '4px';
        // NEW: Add border radius to the outline
        newResult.style.borderRadius = '8px';

        // Scroll the selected element into view, ensuring a smooth experience
        if (shouldScroll) {
            // Only scroll when explicitly told (i.e., when using arrow keys)
            newResult.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }

  function addNumberIndicators() {
    if (isProcessing) return;
    isProcessing = true;

    // Flag to check if we need to restore the selection highlight later
    let restoreSelection = selectedIndex !== -1;

    // Remove all previous indicator wrappers
    document.querySelectorAll('.search-result-indicator-wrapper').forEach(el => el.remove());

    const results = getValidResults();
    const currentResultCount = results.length;

    // If result count has changed, reset the selection index if it's now out of bounds
    if (currentResultCount !== lastResultCount && selectedIndex >= currentResultCount) {
         selectedIndex = -1;
         restoreSelection = false;
    }

    lastResultCount = currentResultCount;

    results.forEach((result, index) => {
      // Limit to 10 results for number keys
      if (index < 10) {
        const title = result.querySelector('a > h3');
        if (title) {
          // 1. Create wrapper for both indicators (triangle + number)
          const wrapper = document.createElement('div');
          wrapper.className = 'search-result-indicator-wrapper';
          wrapper.style.cssText = `
            display: flex;
            align-items: center;
            /* MOVED LEFT: Set to -60px */
            position: absolute;
            left: -60px;
            top: 50%;
            transform: translateY(-50%);
            z-index: 10;
          `;

          // 2. Selection Triangle (New feature)
          const triangle = document.createElement('span');
          triangle.textContent = '▶'; // Right-pointing triangle
          triangle.className = 'search-result-triangle-indicator';
          triangle.style.cssText = `
            font-size: 10px;
            color: transparent; /* Invisible by default */
            margin-right: 4px;
            line-height: 1;
            transition: color 0.1s;
          `;

          // 3. Number Indicator (Original logic, now inside the wrapper)
          const indicator = document.createElement('span');
          indicator.textContent = (index + 1) % 10;
          indicator.className = 'search-result-indicator';
          indicator.style.cssText = `
            display: inline-block;
            width: ${STYLES.indicatorSize};
            height: ${STYLES.indicatorSize};
            background-color: ${STYLES.indicatorBg};
            color: ${STYLES.indicatorText};
            border: 2px solid ${STYLES.borderColor};
            border-radius: 50%;
            text-align: center;
            line-height: ${STYLES.indicatorSize};
            font-size: ${STYLES.fontSize};
            font-weight: bold;
            box-shadow: ${STYLES.shadow};
          `;

          wrapper.appendChild(triangle);
          wrapper.appendChild(indicator);

          // Add margin-left to the result item itself to make space for the indicator
          // Ensure result is positioned relatively for indicator placement
          result.style.position = 'relative';

          // Prepend wrapper to the result container, not the title, for consistent positioning
          result.prepend(wrapper);
        }
      }
    });

    // Re-apply selection ONLY if a selection was active and the page reloaded/changed
    // Do NOT scroll here to avoid scroll jumping when content is merely shifted.
    if (restoreSelection) {
        // Force highlight, but DO NOT force scroll
        updateSelectionIndicator(selectedIndex, false);
    }

    isProcessing = false;
  }

  function openUrl(url, { active = false, currentTab = false } = {}) {
    try {
      if (currentTab) {
        window.location.href = url;
      } else if (typeof GM_openInTab !== 'undefined') {
        GM_openInTab(url, { active });
      } else {
        window.open(url, '_blank');
        if (!active) setTimeout(() => window.focus(), 0);
      }
    } catch (err) {
      console.error('openUrl error:', err);
    }
  }

  function updatePageIndicator() {
    let indicator = document.getElementById('google-results-page-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'google-results-page-indicator';
      indicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 8px;
        background: ${STYLES.indicatorBg};
        padding: 4px 12px;
        border-radius: 12px;
        font-size: ${STYLES.fontSize};
        font-weight: bold;
        color: ${STYLES.indicatorText};
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      `;
      document.body.appendChild(indicator);
    }
    const start = new URLSearchParams(location.search).get('start') || '0';
    const currentPage = Math.floor(parseInt(start, 10) / 10) + 1;
    indicator.textContent = `Page ${currentPage}`;
  }

  function navigatePage(direction) {
    const next = document.querySelector('#pnnext');
    const prev = document.querySelector('#pnprev');
    if (direction === 'next' && next) next.click();
    if (direction === 'previous' && prev) prev.click();
    setTimeout(updatePageIndicator, 200);
    // Reset selection when changing pages
    updateSelectionIndicator(-1, false);
  }

  function handleKeyPress(e) {
    // Ignore key presses in input/textarea fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const results = getValidResults();

    // --- 1. NUMBER KEY NAVIGATION (Original Feature) ---
    const numberKey = getNumberKey(e);
    if (numberKey !== null && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();

      const keyNum = numberKey === 0 ? 9 : numberKey - 1;
      const result = results[keyNum];
      if (result) {
        const link = result.querySelector('a');
        if (link && link.href) {
          openUrl(link.href, {
            active: e.shiftKey,
            currentTab: e.altKey,
          });
          // Update visual selection without scrolling on key press, only on arrow keys
          updateSelectionIndicator(keyNum, false);
        }
      }
      return;
    }

    // --- 2. ARROW UP/DOWN NAVIGATION (New Feature) ---
    if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
      e.preventDefault();

      if (results.length === 0) return;

      let newIndex = selectedIndex;

      if (e.code === 'ArrowDown') {
        // Start selection at 0 if none is selected
        newIndex = selectedIndex === -1 ? 0 : Math.min(selectedIndex + 1, results.length - 1);
      } else if (e.code === 'ArrowUp') {
        newIndex = Math.max(selectedIndex - 1, 0);
      }

      // Explicitly tell the function to scroll when using arrow keys
      updateSelectionIndicator(newIndex, true);
      return;
    }

    // --- 3. ENTER KEY (New Feature: Open Selected Result) ---
    if (e.code === 'Enter' && selectedIndex !== -1) {
      e.preventDefault();
      const result = results[selectedIndex];

      if (result) {
        const link = result.querySelector('a');
        if (link && link.href) {
          openUrl(link.href, {
            active: e.shiftKey,
            currentTab: e.altKey,
          });
          // Selection is intentionally NOT reset here to keep focus on the result.
        }
      }
      return;
    }

    // --- 4. PAGE NAVIGATION (Original Feature) ---
    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
      e.preventDefault();
      navigatePage(e.code === 'ArrowRight' ? 'next' : 'previous');
    }
  }

  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  function init() {
    addNumberIndicators();
    updatePageIndicator();
    document.addEventListener('keydown', handleKeyPress);

    // Observe the search results container for changes (e.g., infinite scroll or page changes)
    const observer = new MutationObserver(() => {
      // Debounce to prevent running indicator update too many times during rapid changes
      debounce(addNumberIndicators, 250)();
    });

    const container = document.querySelector('#search');
    if (container) {
      observer.observe(container, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
