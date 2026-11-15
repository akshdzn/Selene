<script>
  import { onMount } from 'svelte';
  import {
    getAllExportableSites,
    getDaysDiff,
    offsetDays,
    generateExportPayload,
    downloadJsonFile
  } from './exportUtils.js';
  import { convertToDirectionalCoords, fetchCurrentLunarPositions } from './ephemeris.js';

  let {
    isOpen = $bindable(false),
    currentSite = null,
    defaultStartDate = '2026-03-01',
    defaultEndDate = '2026-03-21',
    onClose = null
  } = $props();

  // All available sites
  let allSites = $state([]);
  let searchQuery = $state('');
  let activeCategory = $state('ALL');

  // Selected site IDs (Set in state)
  let selectedSiteIds = $state(new Set());

  // Date selection state
  let batchStartDate = $state('2026-03-01');
  let batchEndDate = $state('2026-03-21');
  let applyToAll = $state(true);
  let customDatesMap = $state({});

  // Export progress & state
  let isExporting = $state(false);
  let exportProgress = $state({ current: 0, total: 0, siteName: '' });
  let exportSuccessMsg = $state('');
  let exportErrorMsg = $state('');

  // Initialize sites list on mount or when currentSite changes
  $effect(() => {
    if (isOpen) {
      allSites = getAllExportableSites(currentSite);
      // Pre-select Apollo 15 and Apollo 11 or current site if empty
      if (selectedSiteIds.size === 0 && allSites.length > 0) {
        const initial = new Set();
        // Select Apollo 15 by default
        const a15 = allSites.find((s) => s.name.includes('Apollo 15'));
        if (a15) initial.add(a15.id);
        const a11 = allSites.find((s) => s.name.includes('Apollo 11'));
        if (a11) initial.add(a11.id);
        if (initial.size === 0 && allSites[0]) initial.add(allSites[0].id);
        selectedSiteIds = initial;
      }
      exportSuccessMsg = '';
      exportErrorMsg = '';
    }
  });

  // Keep default dates in sync
  $effect(() => {
    if (defaultStartDate) batchStartDate = defaultStartDate;
    if (defaultEndDate) batchEndDate = defaultEndDate;
  });

  let categories = $derived.by(() => {
    const cats = new Set(allSites.map((s) => s.category));
    return ['ALL', ...Array.from(cats)];
  });

  let filteredSites = $derived.by(() => {
    let list = allSites;
    if (activeCategory !== 'ALL') {
      list = list.filter((s) => s.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.country && s.country.toLowerCase().includes(q)) ||
          s.category.toLowerCase().includes(q) ||
          (s.subType && s.subType.toLowerCase().includes(q))
      );
    }
    return list;
  });

  let batchDurationDays = $derived(getDaysDiff(batchStartDate, batchEndDate));

  function handleToggleSite(siteId) {
    const next = new Set(selectedSiteIds);
    if (next.has(siteId)) {
      next.delete(siteId);
    } else {
      next.add(siteId);
    }
    selectedSiteIds = next;
  }

  function handleSelectAll() {
    const next = new Set(selectedSiteIds);
    for (const site of filteredSites) {
      next.add(site.id);
    }
    selectedSiteIds = next;
  }

  function handleDeselectAll() {
    const next = new Set(selectedSiteIds);
    for (const site of filteredSites) {
      next.delete(site.id);
    }
    selectedSiteIds = next;
  }

  function handlePresetDays(days) {
    if (!batchStartDate) {
      const pad = (n) => String(n).padStart(2, '0');
      const now = new Date();
      batchStartDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    }
    batchEndDate = offsetDays(batchStartDate, days);
  }

  function handleCustomSiteDateChange(siteId, field, value) {
    const cur = customDatesMap[siteId] || {
      startDate: batchStartDate,
      endDate: batchEndDate
    };
    customDatesMap = {
      ...customDatesMap,
      [siteId]: {
        ...cur,
        [field]: value
      }
    };
  }

  function closeModal() {
    if (isExporting) return;
    isOpen = false;
    onClose?.();
  }

  function handleKeydown(e) {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      closeModal();
    }
  }

  async function handleExport() {
    if (selectedSiteIds.size === 0 || isExporting) return;
    isExporting = true;
    exportSuccessMsg = '';
    exportErrorMsg = '';

    const selectedList = allSites.filter((s) => selectedSiteIds.has(s.id));
    exportProgress = { current: 0, total: selectedList.length, siteName: '' };

    try {
      const payload = await generateExportPayload({
        selectedSites: selectedList,
        defaultStartDate: batchStartDate,
        defaultEndDate: batchEndDate,
        customDatesMap: applyToAll ? {} : customDatesMap,
        fetchEphemerisFn: fetchCurrentLunarPositions,
        onProgress: (p) => {
          exportProgress = p;
        }
      });

      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `selene-lunar-data-${selectedList.length}-sites-${dateStr}.json`;
      downloadJsonFile(payload, filename);

      exportSuccessMsg = `Successfully exported ${selectedList.length} site${selectedList.length === 1 ? '' : 's'} to ${filename}`;
    } catch (err) {
      console.error('Export failed:', err);
      exportErrorMsg = 'Failed to compile or download JSON export. Please try again.';
    } finally {
      isExporting = false;
    }
  }
  function portal(node) {
    if (typeof document !== 'undefined') {
      document.body.appendChild(node);
    }
    return {
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    };
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div
    use:portal
    class="modal-backdrop"
    onclick={(e) => {
      if (e.target === e.currentTarget) closeModal();
    }}
    role="presentation"
  >
    <div
      class="export-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
    >
      <!-- Dialog Header -->
      <div class="dialog-header">
        <div class="header-titles">
          <div class="header-tag-row">
            <span class="header-mode-badge">JSON DATA EXPORT</span>
            <span class="header-count-badge">
              {selectedSiteIds.size} {selectedSiteIds.size === 1 ? 'SITE' : 'SITES'} SELECTED (NO LIMIT)
            </span>
          </div>
          <h2 id="export-dialog-title" class="dialog-title">EXPORT LUNAR SITE DATA</h2>
          <span class="dialog-subtitle">
            Select lunar sites and mission windows to download full solar, earth, and ephemeris data.
          </span>
        </div>
        <button
          type="button"
          class="dialog-close-btn"
          onclick={closeModal}
          disabled={isExporting}
          aria-label="Close export dialog"
        >
          ✕
        </button>
      </div>

      <!-- Dialog Body -->
      <div class="dialog-body">
        <!-- Section 1: Mission Window / Dates Selection -->
        <div class="dialog-section">
          <div class="section-header-row">
            <span class="section-title">MISSION DATES FOR EXPORT</span>
            <span class="section-badge">{batchDurationDays} DAYS WINDOW</span>
          </div>

          <div class="date-controls-grid">
            <div class="date-input-group">
              <label for="export-start-date" class="date-label">START DATE</label>
              <input
                id="export-start-date"
                type="date"
                class="date-input"
                bind:value={batchStartDate}
                disabled={isExporting}
              />
            </div>

            <div class="date-input-group">
              <label for="export-end-date" class="date-label">END DATE</label>
              <input
                id="export-end-date"
                type="date"
                class="date-input"
                min={batchStartDate}
                bind:value={batchEndDate}
                disabled={isExporting}
              />
            </div>

            <div class="date-presets-group">
              <span class="presets-label">QUICK PRESETS</span>
              <div class="presets-buttons">
                <button
                  type="button"
                  class="preset-btn"
                  onclick={() => handlePresetDays(7)}
                  disabled={isExporting}
                >
                  7D
                </button>
                <button
                  type="button"
                  class="preset-btn"
                  onclick={() => handlePresetDays(14)}
                  disabled={isExporting}
                >
                  14D
                </button>
                <button
                  type="button"
                  class="preset-btn"
                  onclick={() => handlePresetDays(20)}
                  disabled={isExporting}
                >
                  20D
                </button>
                <button
                  type="button"
                  class="preset-btn"
                  onclick={() => handlePresetDays(29)}
                  disabled={isExporting}
                  title="Full Lunar Synodic Month (29.5 days)"
                >
                  29.5D (SYNODIC)
                </button>
              </div>
            </div>
          </div>

          <div class="apply-all-row">
            <label class="checkbox-label-row">
              <input
                type="checkbox"
                class="custom-checkbox"
                bind:checked={applyToAll}
                disabled={isExporting}
              />
              <span class="checkbox-label-text">
                Apply this date range to all selected sites
              </span>
            </label>
            {#if !applyToAll}
              <span class="per-site-notice">
                Custom dates can be set individually per site below
              </span>
            {/if}
          </div>
        </div>

        <!-- Section 2: Site Selection -->
        <div class="dialog-section">
          <div class="section-header-row">
            <span class="section-title">SELECT SITES TO EXPORT</span>
            <div class="selection-actions">
              <button
                type="button"
                class="select-action-btn"
                onclick={handleSelectAll}
                disabled={isExporting || filteredSites.length === 0}
              >
                SELECT ALL ({filteredSites.length})
              </button>
              <button
                type="button"
                class="select-action-btn"
                onclick={handleDeselectAll}
                disabled={isExporting || selectedSiteIds.size === 0}
              >
                DESELECT ALL
              </button>
            </div>
          </div>

          <!-- Search & Filter Bar -->
          <div class="search-filter-row">
            <div class="search-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                class="search-input"
                placeholder="Search sites by name, country, or plain..."
                bind:value={searchQuery}
              />
              {#if searchQuery}
                <button
                  type="button"
                  class="search-clear-btn"
                  onclick={() => (searchQuery = '')}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              {/if}
            </div>

            <!-- Category Pills -->
            <div class="category-pills">
              {#each categories as cat}
                <button
                  type="button"
                  class="cat-pill"
                  class:is-active={activeCategory === cat}
                  onclick={() => (activeCategory = cat)}
                >
                  {cat}
                </button>
              {/each}
            </div>
          </div>

          <!-- Scrollable Sites List -->
          <div class="sites-scroll-list">
            {#if filteredSites.length === 0}
              <div class="empty-sites-notice">
                No lunar sites found matching "{searchQuery}"
              </div>
            {/if}

            {#each filteredSites as site (site.id)}
              {@const isSelected = selectedSiteIds.has(site.id)}
              {@const dir = convertToDirectionalCoords(site.lat, site.lon, { precision: 3, space: ' ' })}
              <div class="site-list-card" class:is-selected={isSelected}>
                <div
                  class="site-card-main-row"
                  onclick={() => handleToggleSite(site.id)}
                  role="checkbox"
                  aria-checked={isSelected}
                  tabindex="0"
                  onkeydown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      handleToggleSite(site.id);
                    }
                  }}
                >
                  <div class="site-checkbox-wrap">
                    <input
                      type="checkbox"
                      class="custom-checkbox"
                      checked={isSelected}
                      onclick={(e) => e.stopPropagation()}
                      onchange={() => handleToggleSite(site.id)}
                      aria-label="Select {site.name}"
                    />
                  </div>

                  <div class="site-info-col">
                    <div class="site-name-row">
                      <span class="site-title">{site.name}</span>
                      {#if site.country}
                        <span class="site-country-badge">{site.country}</span>
                      {/if}
                      {#if site.isCustom}
                        <span class="site-custom-badge">CURRENT TARGET</span>
                      {/if}
                    </div>
                    <div class="site-sub-row">
                      <span class="site-sub-desc">{site.subType}</span>
                    </div>
                  </div>

                  <div class="site-coords-col">
                    <span class="site-coords-pill">{dir.latStr}, {dir.lonStr}</span>
                    <span class="site-cat-tag">{site.category}</span>
                  </div>
                </div>

                <!-- Per-Site Custom Dates Row (Only when applyToAll is unchecked) -->
                {#if isSelected && !applyToAll}
                  {@const custom = customDatesMap[site.id] || { startDate: batchStartDate, endDate: batchEndDate }}
                  <div class="site-custom-dates-row">
                    <span class="custom-dates-label">Site Dates:</span>
                    <input
                      type="date"
                      class="custom-date-field"
                      value={custom.startDate || batchStartDate}
                      onchange={(e) => handleCustomSiteDateChange(site.id, 'startDate', e.target.value)}
                      disabled={isExporting}
                    />
                    <span class="date-arrow">→</span>
                    <input
                      type="date"
                      class="custom-date-field"
                      min={custom.startDate || batchStartDate}
                      value={custom.endDate || batchEndDate}
                      onchange={(e) => handleCustomSiteDateChange(site.id, 'endDate', e.target.value)}
                      disabled={isExporting}
                    />
                    <span class="custom-duration">
                      ({getDaysDiff(custom.startDate || batchStartDate, custom.endDate || batchEndDate)}d)
                    </span>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>

        <!-- Export Progress / Notification Messages -->
        {#if isExporting}
          <div class="export-status-banner is-loading">
            <div class="status-spinner"></div>
            <div class="status-content">
              <span class="status-title">
                Generating Ephemeris Data ({exportProgress.current} / {exportProgress.total})
              </span>
              <span class="status-desc">
                Fetching JPL Horizons lunar coordinates for {exportProgress.siteName}...
              </span>
            </div>
          </div>
        {/if}

        {#if exportSuccessMsg}
          <div class="export-status-banner is-success">
            <span class="status-icon">✓</span>
            <div class="status-content">
              <span class="status-title">EXPORT COMPLETE</span>
              <span class="status-desc">{exportSuccessMsg}</span>
            </div>
          </div>
        {/if}

        {#if exportErrorMsg}
          <div class="export-status-banner is-error">
            <span class="status-icon">✕</span>
            <div class="status-content">
              <span class="status-title">EXPORT ERROR</span>
              <span class="status-desc">{exportErrorMsg}</span>
            </div>
          </div>
        {/if}
      </div>

      <!-- Dialog Footer Actions -->
      <div class="dialog-footer">
        <div class="footer-left">
          <span class="footer-summary">
            {selectedSiteIds.size} of {allSites.length} sites selected
          </span>
          <span class="footer-format">Format: Standard JSON (.json)</span>
        </div>

        <div class="footer-actions">
          <button
            type="button"
            class="footer-btn btn-secondary"
            onclick={closeModal}
            disabled={isExporting}
          >
            Cancel
          </button>

          <button
            type="button"
            class="footer-btn btn-primary"
            onclick={handleExport}
            disabled={isExporting || selectedSiteIds.size === 0}
          >
            {#if isExporting}
              <div class="mini-spinner"></div>
              <span>EXPORTING...</span>
            {:else}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>EXPORT {selectedSiteIds.size} {selectedSiteIds.size === 1 ? 'SITE' : 'SITES'} (.JSON)</span>
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ---------------- Modal Backdrop ---------------- */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.55);
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
    transform: translateZ(0);
    will-change: backdrop-filter;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    box-sizing: border-box;
    animation: fadeIn 0.2s ease-out;
    user-select: auto;
  }

  /* ---------------- Dialog Container ---------------- */
  .export-dialog {
    position: relative;
    width: 640px;
    max-width: 95vw;
    max-height: 88vh;
    margin: auto;
    background: rgba(10, 14, 24, 0.75);
    -webkit-backdrop-filter: blur(20px) saturate(140%);
    backdrop-filter: blur(20px) saturate(140%);
    will-change: transform, backdrop-filter;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15);
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    overflow: hidden;
    color: #ffffff;
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    animation: dialogPop 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    user-select: auto;
  }

  /* ---------------- Header ---------------- */
  .dialog-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 18px 22px 14px 22px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.02);
  }

  .header-titles {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .header-tag-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
  }

  .header-mode-badge {
    font-family: 'Jersey 25', sans-serif;
    font-size: 13px;
    color: #33e5ff;
    letter-spacing: 1px;
    background: rgba(51, 229, 255, 0.12);
    border: 1px solid rgba(51, 229, 255, 0.35);
    border-radius: 2px;
    padding: 1px 6px;
  }

  .header-count-badge {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 11px;
    font-weight: 700;
    color: #ffaa55;
    background: rgba(255, 170, 85, 0.12);
    border: 1px solid rgba(255, 170, 85, 0.35);
    border-radius: 2px;
    padding: 1px 6px;
    letter-spacing: 0.6px;
  }

  .dialog-title {
    margin: 0;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 19px;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: #ffffff;
  }

  .dialog-subtitle {
    font-size: 12.5px;
    color: rgba(255, 255, 255, 0.6);
    line-height: 1.4;
  }

  .dialog-close-btn {
    all: unset;
    cursor: pointer;
    font-size: 16px;
    color: rgba(255, 255, 255, 0.6);
    padding: 6px 10px;
    border-radius: 3px;
    border: 1px solid transparent;
    transition: all 0.15s ease;
  }

  .dialog-close-btn:hover:not(:disabled) {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.25);
  }

  /* ---------------- Body & Sections ---------------- */
  .dialog-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 18px 22px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    box-sizing: border-box;
  }

  .dialog-section {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-sizing: border-box;
  }

  .section-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .section-title {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.8);
    text-transform: uppercase;
  }

  .section-badge {
    font-family: 'Jersey 25', sans-serif;
    font-size: 13px;
    color: #33e5ff;
    letter-spacing: 0.8px;
  }

  .selection-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .select-action-btn {
    all: unset;
    cursor: pointer;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.6px;
    padding: 2px 8px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.18);
    color: rgba(255, 255, 255, 0.8);
    transition: all 0.15s ease;
  }

  .select-action-btn:hover:not(:disabled) {
    background: rgba(51, 229, 255, 0.15);
    border-color: rgba(51, 229, 255, 0.4);
    color: #33e5ff;
  }

  /* ---------------- Date Controls ---------------- */
  .date-controls-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1.3fr;
    gap: 12px;
    align-items: flex-end;
  }

  .date-input-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .date-label {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: rgba(255, 255, 255, 0.6);
  }

  .date-input {
    color-scheme: dark;
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 3px;
    color: #ffffff;
    font-family: monospace;
    font-size: 12.5px;
    padding: 6px 8px;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .date-input:focus {
    border-color: #33e5ff;
    box-shadow: none;
  }

  .date-presets-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .presets-label {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: rgba(255, 255, 255, 0.6);
  }

  .presets-buttons {
    display: flex;
    gap: 4px;
  }

  .preset-btn {
    all: unset;
    cursor: pointer;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    padding: 6px 8px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.16);
    color: rgba(255, 255, 255, 0.8);
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .preset-btn:hover:not(:disabled) {
    background: rgba(255, 170, 85, 0.16);
    border-color: rgba(255, 170, 85, 0.5);
    color: #ffaa55;
  }

  .apply-all-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 4px;
    flex-wrap: wrap;
    gap: 6px;
  }

  .checkbox-label-row {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
  }

  .checkbox-label-text {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.8);
    letter-spacing: 0.3px;
  }

  .per-site-notice {
    font-size: 11px;
    color: #ffaa55;
    letter-spacing: 0.3px;
  }

  /* ---------------- Search & Filter ---------------- */
  .search-filter-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 3px;
    padding: 6px 10px;
    box-sizing: border-box;
  }

  .search-box svg {
    color: rgba(255, 255, 255, 0.45);
    flex-shrink: 0;
  }

  .search-input {
    all: unset;
    flex: 1;
    font-size: 12.5px;
    color: #ffffff;
  }

  .search-clear-btn {
    all: unset;
    cursor: pointer;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    padding: 0 4px;
  }

  .category-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .cat-pill {
    all: unset;
    cursor: pointer;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.6px;
    padding: 3px 8px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.6);
    transition: all 0.15s ease;
  }

  .cat-pill:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .cat-pill.is-active {
    background: rgba(51, 229, 255, 0.15);
    border-color: rgba(51, 229, 255, 0.5);
    color: #33e5ff;
  }

  /* ---------------- Sites Scroll List ---------------- */
  .sites-scroll-list {
    max-height: 250px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-right: 4px;
    box-sizing: border-box;
  }

  .empty-sites-notice {
    padding: 24px;
    text-align: center;
    color: rgba(255, 255, 255, 0.45);
    font-size: 12.5px;
  }

  .site-list-card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    transition: all 0.15s ease;
  }

  .site-list-card:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.22);
  }

  .site-list-card.is-selected {
    border-color: rgba(51, 229, 255, 0.5);
    background: rgba(51, 229, 255, 0.06);
  }

  .site-card-main-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    cursor: pointer;
    box-sizing: border-box;
  }

  .site-checkbox-wrap {
    display: flex;
    align-items: center;
  }

  .custom-checkbox {
    cursor: pointer;
    width: 15px;
    height: 15px;
    accent-color: #33e5ff;
  }

  .site-info-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .site-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .site-title {
    font-size: 13.5px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: 0.3px;
  }

  .site-country-badge {
    font-family: 'Jersey 25', sans-serif;
    font-size: 11.5px;
    letter-spacing: 0.6px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    padding: 0 4px;
    color: rgba(255, 255, 255, 0.8);
  }

  .site-custom-badge {
    font-family: 'Jersey 25', sans-serif;
    font-size: 11.5px;
    letter-spacing: 0.8px;
    background: rgba(51, 229, 255, 0.15);
    border: 1px solid rgba(51, 229, 255, 0.4);
    border-radius: 2px;
    padding: 0 5px;
    color: #33e5ff;
  }

  .site-sub-row {
    display: flex;
    align-items: center;
  }

  .site-sub-desc {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .site-coords-col {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 3px;
    flex-shrink: 0;
  }

  .site-coords-pill {
    font-family: monospace;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
    background: rgba(0, 0, 0, 0.35);
    padding: 2px 6px;
    border-radius: 2px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .site-cat-tag {
    font-size: 10px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.45);
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }

  .site-custom-dates-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px 8px 35px;
    border-top: 1px dashed rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.2);
  }

  .custom-dates-label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
  }

  .custom-date-field {
    color-scheme: dark;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    color: #ffffff;
    font-family: monospace;
    font-size: 11px;
    padding: 3px 6px;
    outline: none;
  }

  .date-arrow {
    color: rgba(255, 255, 255, 0.4);
    font-size: 12px;
  }

  .custom-duration {
    font-size: 11px;
    color: #ffaa55;
    font-weight: 600;
  }

  /* ---------------- Status Banners ---------------- */
  .export-status-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 3px;
    box-sizing: border-box;
    animation: fadeIn 0.2s ease-out;
  }

  .export-status-banner.is-loading {
    background: rgba(51, 229, 255, 0.1);
    border: 1px solid rgba(51, 229, 255, 0.4);
  }

  .export-status-banner.is-success {
    background: rgba(74, 222, 128, 0.12);
    border: 1px solid rgba(74, 222, 128, 0.5);
  }

  .export-status-banner.is-error {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.5);
  }

  .status-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(51, 229, 255, 0.2);
    border-top-color: #33e5ff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
  }

  .status-icon {
    font-size: 16px;
    font-weight: bold;
    flex-shrink: 0;
  }

  .export-status-banner.is-success .status-icon {
    color: #4ade80;
  }

  .export-status-banner.is-error .status-icon {
    color: #ef4444;
  }

  .status-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .status-title {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.6px;
  }

  .export-status-banner.is-loading .status-title {
    color: #33e5ff;
  }

  .export-status-banner.is-success .status-title {
    color: #4ade80;
  }

  .export-status-banner.is-error .status-title {
    color: #ef4444;
  }

  .status-desc {
    font-size: 11.5px;
    color: rgba(255, 255, 255, 0.7);
  }

  /* ---------------- Footer Actions ---------------- */
  .dialog-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 22px;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.02);
    gap: 12px;
    flex-wrap: wrap;
  }

  .footer-left {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .footer-summary {
    font-size: 12px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: 0.4px;
  }

  .footer-format {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
  }

  .footer-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .footer-btn {
    all: unset;
    cursor: pointer;
    font-size: 12.5px;
    font-weight: 700;
    letter-spacing: 0.8px;
    padding: 8px 16px;
    border-radius: 3px;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    transition: all 0.15s ease;
  }

  .footer-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.18);
    color: rgba(255, 255, 255, 0.8);
  }

  .btn-secondary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
  }

  .btn-primary {
    background: rgba(51, 229, 255, 0.18);
    border: 1px solid rgba(51, 229, 255, 0.6);
    color: #33e5ff;
    box-shadow: none;
  }

  .btn-primary:hover:not(:disabled) {
    background: rgba(51, 229, 255, 0.28);
    border-color: #33e5ff;
    box-shadow: none;
    color: #ffffff;
  }

  .mini-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes dialogPop {
    from {
      opacity: 0;
      transform: scale(0.96) translateY(-8px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  /* Mobile Responsive Adaptations */
  @media (max-width: 640px) {
    .modal-backdrop {
      padding: 8px;
    }

    .export-dialog {
      width: 100%;
      max-width: calc(100vw - 16px);
      max-height: 94vh;
      max-height: 94dvh;
    }

    .dialog-header {
      padding: 12px 14px 10px 14px;
    }

    .dialog-title {
      font-size: 16px;
    }

    .dialog-subtitle {
      font-size: 11px;
    }

    .dialog-body {
      padding: 12px 14px;
      gap: 12px;
    }

    .date-controls-grid {
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .date-presets-group {
      grid-column: 1 / -1;
    }

    .presets-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .site-list-card {
      padding: 8px 10px;
    }

    .site-title {
      font-size: 13px;
    }

    .site-coords-pill {
      font-size: 10px;
      padding: 1px 4px;
    }

    .dialog-footer {
      padding: 10px 14px;
      flex-direction: column;
      gap: 10px;
      align-items: stretch;
    }

    .footer-left {
      align-items: center;
      text-align: center;
    }

    .footer-actions {
      display: flex;
      gap: 8px;
      width: 100%;
    }

    .footer-btn {
      flex: 1;
      justify-content: center;
    }
  }
</style>
