<script>
  import { onMount, tick } from 'svelte';
  import { Tabs, Combobox } from 'bits-ui';
  import { convertToDirectionalCoords, parseCoordinateInput, calculateOptimalValue } from './ephemeris.js';
  import { getLandmarkTypes, getLandmarksByType } from './places.js';

  let {
    selectedCoords = null,
    hoveredCoords = null,
    lat = 26.1322,
    lon = 3.6339,
    onCoordinateSelect = null,
    mode = $bindable('single'),
    lunarPositions = null,
    lunarPositionsS2 = null,
    optimalSample = null
  } = $props();

  let isDropdownOpen = $state(false);
  let isEditing = $state(false);
  let editLatInput = $state('');
  let editLonInput = $state('');
  let hasInputError = $state(false);

  let selectedType = $state('');
  let typeInputValue = $state('');
  const landmarkTypes = getLandmarkTypes();

  let filteredTypeOptions = $derived.by(() => {
    if (!typeInputValue) return landmarkTypes;
    return landmarkTypes.filter((t) =>
      t.label.toLowerCase().includes(typeInputValue.toLowerCase())
    );
  });

  let listedLandmarks = $derived.by(() => {
    if (!selectedType) return [];
    return getLandmarksByType(selectedType);
  });

  // Optimal calculations for Compare Mode
  let sample1OptimalValue = $derived(
    calculateOptimalValue(lunarPositions?.dataset?.sun, lunarPositions?.dataset?.earth)
  );
  let sample2OptimalValue = $derived(
    calculateOptimalValue(lunarPositionsS2?.dataset?.sun, lunarPositionsS2?.dataset?.earth)
  );

  // Variable called Optimal Sample which gets input from the higher Optimal value between the two samples
  let derivedOptimalSample = $derived.by(() => {
    if (mode !== 'compare') return null;
    if (!lunarPositions || !lunarPositionsS2) return null;
    const v1 = sample1OptimalValue;
    const v2 = sample2OptimalValue;
    if (v1 <= 0 && v2 <= 0) return null;
    return v1 >= v2 ? 1 : 2;
  });

  let activeOptimalSample = $derived(optimalSample ?? derivedOptimalSample);
  let OptimalSample = $derived(activeOptimalSample);
  let optimalSampleValue = $derived(
    mode === 'compare' ? Math.max(sample1OptimalValue, sample2OptimalValue) : 0
  );

  let latInputEl = $state(null);
  let lonInputEl = $state(null);
  let hudBoxEl = $state(null);

  // 1. When a coordinate is selected, the above coordinates should ONLY display that coordinate (using selectedCoords).
  // 2. When no coordinate is selected yet, read latitude and longitude from the mouse cursor location (hoveredCoords).
  // 3. Before any clicks or mouse hover happen on the CoordsHUD, show lat (26.1322) and lon (3.6339) as the initial value.
  let currentLatNum = $derived.by(() => {
    if (selectedCoords && typeof selectedCoords.lat === 'number') return selectedCoords.lat;
    if (hoveredCoords && typeof hoveredCoords.lat === 'number') return hoveredCoords.lat;
    return typeof lat === 'number' ? lat : 26.1322;
  });

  let currentLonNum = $derived.by(() => {
    if (selectedCoords && typeof selectedCoords.lon === 'number') return selectedCoords.lon;
    if (hoveredCoords && typeof hoveredCoords.lon === 'number') return hoveredCoords.lon;
    return typeof lon === 'number' ? lon : 3.6339;
  });

  let displayCoords = $derived.by(() => {
    if (selectedCoords && typeof selectedCoords.lat === 'number' && typeof selectedCoords.lon === 'number') {
      return convertToDirectionalCoords(selectedCoords.lat, selectedCoords.lon, { precision: 3, space: ' ' });
    }
    if (hoveredCoords && typeof hoveredCoords.lat === 'number' && typeof hoveredCoords.lon === 'number') {
      return convertToDirectionalCoords(hoveredCoords.lat, hoveredCoords.lon, { precision: 3, space: ' ' });
    }
    return convertToDirectionalCoords(lat ?? 26.1322, lon ?? 3.6339, { precision: 3, space: ' ' });
  });

  async function startEditing(targetField = 'lat') {
    isEditing = true;
    hasInputError = false;
    editLatInput = currentLatNum.toFixed(4);
    editLonInput = currentLonNum.toFixed(4);

    await tick();
    if (targetField === 'lon' && lonInputEl) {
      lonInputEl.focus();
      lonInputEl.select();
    } else if (latInputEl) {
      latInputEl.focus();
      latInputEl.select();
    }
  }

  function commitEditing() {
    if (!isEditing) return;

    let parsedLat = null;
    let parsedLon = null;

    // Check if user entered or pasted a comma-separated coordinate pair into either field
    if (editLatInput.includes(',')) {
      const parts = editLatInput.split(',');
      parsedLat = parseCoordinateInput(parts[0], true);
      parsedLon = parseCoordinateInput(parts[1], false);
    } else if (editLonInput.includes(',')) {
      const parts = editLonInput.split(',');
      parsedLat = parseCoordinateInput(parts[0], true);
      parsedLon = parseCoordinateInput(parts[1], false);
    } else {
      parsedLat = parseCoordinateInput(editLatInput, true);
      parsedLon = parseCoordinateInput(editLonInput, false);
    }

    if (parsedLat === null || parsedLon === null) {
      hasInputError = true;
      return;
    }

    hasInputError = false;
    isEditing = false;
    onCoordinateSelect?.({ lat: parsedLat, lon: parsedLon });
  }

  function cancelEditing() {
    isEditing = false;
    hasInputError = false;
  }

  function handleInputKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEditing();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      if (isEditing) {
        cancelEditing();
      } else if (isDropdownOpen) {
        isDropdownOpen = false;
      }
    }
  }

  function handlePointerDown(e) {
    if (isEditing && hudBoxEl && !hudBoxEl.contains(e.target)) {
      commitEditing();
    }
  }

  function isLandmarkActive(landmark) {
    const targetLat = landmark.latitude ?? landmark.lat;
    const targetLon = landmark.longitude ?? landmark.lon;
    if (typeof targetLat !== 'number' || typeof targetLon !== 'number') return false;
    return (
      Math.abs(currentLatNum - targetLat) < 0.005 &&
      Math.abs(currentLonNum - targetLon) < 0.005
    );
  }

  function handleSelectLandmark(landmark) {
    const targetLat = landmark.latitude ?? landmark.lat;
    const targetLon = landmark.longitude ?? landmark.lon;
    if (typeof targetLat === 'number' && typeof targetLon === 'number') {
      onCoordinateSelect?.({ lat: targetLat, lon: targetLon, flyTo: true });
    }
  }

  function formatLandmarkCoords(landmark) {
    const targetLat = landmark.latitude ?? landmark.lat;
    const targetLon = landmark.longitude ?? landmark.lon;
    const formatted = convertToDirectionalCoords(targetLat, targetLon, { precision: 3, space: ' ' });
    return `${formatted.latStr}, ${formatted.lonStr}`;
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  });
</script>

<!-- Lunar Coordinates HUD (Figma node 49:9) -->
<div class="lunar-hud-container" data-node-id="49:9">
  <!-- Frosted Coordinates Box (node 47:2) with Double-Click To Edit -->
  <div
    bind:this={hudBoxEl}
    class="lunar-hud-box"
    class:is-editing={isEditing}
    class:has-error={hasInputError}
    data-node-id="47:2"
    role="region"
    aria-label="Lunar coordinates HUD"
    title={isEditing ? 'Press Enter to apply, Esc to cancel' : 'Double-click to type coordinates'}
  >
    <!-- Left: Latitude (node 47:6) -->
    <div
      class="coord-col coord-col-left"
      role="button"
      tabindex={isEditing ? -1 : 0}
      aria-label="Latitude coordinate: double click to edit"
      ondblclick={(e) => {
        e.stopPropagation();
        startEditing('lat');
      }}
      onkeydown={(e) => {
        if (!isEditing && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          startEditing('lat');
        }
      }}
    >
      {#if isEditing}
        <input
          bind:this={latInputEl}
          type="text"
          class="coord-input coord-input-left"
          bind:value={editLatInput}
          onkeydown={handleInputKeydown}
          placeholder="26.1322"
          aria-label="Latitude coordinate"
          spellcheck="false"
        />
      {:else}
        <span class="coord-value" data-node-id="47:6">{displayCoords.latStr}</span>
      {/if}
    </div>

    <!-- Center Divider (node 47:5) -->
    <div class="hud-divider" data-node-id="47:5"></div>

    <!-- Right: Longitude (node 47:7) -->
    <div
      class="coord-col coord-col-right"
      role="button"
      tabindex={isEditing ? -1 : 0}
      aria-label="Longitude coordinate: double click to edit"
      ondblclick={(e) => {
        e.stopPropagation();
        startEditing('lon');
      }}
      onkeydown={(e) => {
        if (!isEditing && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          startEditing('lon');
        }
      }}
    >
      {#if isEditing}
        <input
          bind:this={lonInputEl}
          type="text"
          class="coord-input coord-input-right"
          bind:value={editLonInput}
          onkeydown={handleInputKeydown}
          placeholder="3.6339"
          aria-label="Longitude coordinate"
          spellcheck="false"
        />
      {:else}
        <span class="coord-value" data-node-id="47:7">{displayCoords.lonStr}</span>
      {/if}
    </div>

    {#if isEditing}
      <div class="edit-actions-bar">
        <button
          type="button"
          class="edit-action-btn edit-action-confirm"
          onclick={(e) => {
            e.stopPropagation();
            commitEditing();
          }}
          title="Apply coordinates (Enter)"
          aria-label="Apply coordinates"
        >
          ✓
        </button>
        <button
          type="button"
          class="edit-action-btn edit-action-cancel"
          onclick={(e) => {
            e.stopPropagation();
            cancelEditing();
          }}
          title="Cancel (Esc)"
          aria-label="Cancel editing"
        >
          ✕
        </button>
      </div>
    {/if}
  </div>

  <!-- Bottom Labels & Arrow Button Row -->
  <div class="lunar-hud-labels">
    <!-- Latitude Label (node 47:3) -->
    <span class="hud-label hud-label-lat" data-node-id="47:3">
      {isEditing ? 'LAT (-90°..90°)' : 'LATITUDE'}
    </span>

    <!-- Arrow Button (node 49:6) -->
    <button
      type="button"
      class="hud-arrow-btn"
      class:is-open={isDropdownOpen}
      onclick={() => (isDropdownOpen = !isDropdownOpen)}
      aria-label="Toggle lunar site telemetry dropdown"
      aria-expanded={isDropdownOpen}
      title={isDropdownOpen ? "Collapse site telemetry" : "View site telemetry"}
      data-node-id="49:6"
      data-name="Frame"
    >
      <svg
        class="arrow-icon"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 12.68L9.63 10.3C9.44333 10.1133 9.21333 10.02 8.94 10.02C8.66667 10.02 8.43 10.1133 8.23 10.3C8.03 10.5 7.93 10.7367 7.93 11.01C7.93 11.2833 8.03 11.52 8.23 11.72L11.3 14.8C11.5 15 11.7333 15.1 12 15.1C12.2667 15.1 12.5 15 12.7 14.8L15.8 11.7C16 11.5 16.0967 11.2667 16.09 11C16.0833 10.7333 15.98 10.5 15.78 10.3C15.58 10.1133 15.3467 10.0167 15.08 10.01C14.8133 10.0033 14.58 10.1 14.38 10.3L12 12.68ZM12 22C10.62 22 9.32 21.7367 8.1 21.21C6.88667 20.6833 5.83 19.97 4.93 19.07C4.03 18.1767 3.31667 17.12 2.79 15.9C2.26333 14.68 2 13.38 2 12C2 10.6133 2.26333 9.31333 2.79 8.1C3.31667 6.88 4.03 5.82333 4.93 4.93C5.83 4.02333 6.88667 3.31 8.1 2.79C9.32 2.26333 10.62 2 12 2C13.38 2 14.68 2.26333 15.9 2.79C17.12 3.31667 18.1767 4.03 19.07 4.93C19.97 5.83 20.6833 6.88667 21.21 8.1C21.7367 9.31333 22 10.6133 22 12C22 13.3867 21.7367 14.6867 21.21 15.9C20.6833 17.1133 19.97 18.17 19.07 19.07C18.17 19.97 17.1133 20.6833 15.9 21.21C14.6867 21.7367 13.3867 22 12 22ZM12 20C14.2333 20 16.1267 19.2267 17.68 17.68C19.2333 16.1333 20.0067 14.24 20 12C19.9933 9.76 19.22 7.86667 17.68 6.32C16.14 4.77333 14.2467 4 12 4C9.75333 4 7.86333 4.77333 6.33 6.32C4.79667 7.86667 4.02 9.76 4 12C3.98 14.24 4.75667 16.1333 6.33 17.68C7.90333 19.2267 9.79333 20 12 20Z"
          fill="currentColor"
        />
      </svg>
    </button>

    <!-- Longitudinal Label (node 47:4) -->
    <span class="hud-label hud-label-lon" data-node-id="47:4">
      {isEditing ? 'LON (-180°..180°)' : 'LONGITUDINAL'}
    </span>
  </div>

  <!-- Blank Popdown Menu with Full-Width Bits UI Tabs (Single & Compare) -->
  {#if isDropdownOpen}
    <div
      class="telemetry-dropdown"
      role="region"
      aria-label="Lunar site popdown"
    >
      <Tabs.Root bind:value={mode} class="popdown-tabs">
        <Tabs.List class="tabs-list">
          <Tabs.Trigger value="single" class="tab-trigger">
            Single
          </Tabs.Trigger>
          <Tabs.Trigger value="compare" class="tab-trigger">
            Compare
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="single" class="tab-content">
          <div class="combobox-section">
            <span class="combobox-label">LANDMARK CATEGORY</span>
            <Combobox.Root
              type="single"
              bind:value={selectedType}
              bind:inputValue={typeInputValue}
              items={landmarkTypes}
              onValueChange={(val) => {
                selectedType = val ?? '';
              }}
            >
              <div class="combobox-input-row">
                <Combobox.Input
                  class="combobox-search-input"
                  placeholder="Select landmark type..."
                  aria-label="Select landmark type"
                />
                {#if selectedType}
                  <button
                    type="button"
                    class="combobox-action-btn combobox-clear-btn"
                    onclick={(e) => {
                      e.stopPropagation();
                      selectedType = '';
                      typeInputValue = '';
                    }}
                    title="Clear selection"
                    aria-label="Clear selection"
                  >
                    ✕
                  </button>
                {/if}
                <Combobox.Trigger
                  class="combobox-action-btn combobox-trigger-btn"
                  aria-label="Toggle landmark types dropdown"
                >
                  <svg
                    class="combobox-chevron"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.2"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </Combobox.Trigger>
              </div>

              <Combobox.Portal>
                <Combobox.Content
                  class="combobox-content-portal"
                  side="bottom"
                  sideOffset={6}
                  align="start"
                >
                  <Combobox.Viewport class="combobox-viewport">
                    {#each filteredTypeOptions as opt (opt.value)}
                      <Combobox.Item
                        value={opt.value}
                        label={opt.label}
                        class="combobox-item-option"
                      >
                        <span class="option-label">{opt.label}</span>
                        <span class="option-badge">[{opt.count}]</span>
                      </Combobox.Item>
                    {/each}
                    {#if filteredTypeOptions.length === 0}
                      <div class="combobox-empty-row">No matching types found</div>
                    {/if}
                  </Combobox.Viewport>
                </Combobox.Content>
              </Combobox.Portal>
            </Combobox.Root>
          </div>

          <!-- Landmarks Listed Below Combobox When A Type Is Selected -->
          {#if selectedType}
            <div class="landmarks-list-section">
              <div class="landmarks-list-header">
                <span class="section-title">{selectedType}</span>
                <span class="section-count">
                  {listedLandmarks.length} {listedLandmarks.length === 1 ? 'LOCATION' : 'LOCATIONS'}
                </span>
              </div>

              <div class="landmarks-scroll-container">
                {#each listedLandmarks as landmark (landmark.name)}
                  {@const isActive = isLandmarkActive(landmark)}
                  <button
                    type="button"
                    class="landmark-item-row"
                    class:is-active={isActive}
                    onclick={() => handleSelectLandmark(landmark)}
                    title="Click to navigate to {landmark.name} on the Moon"
                    aria-label="Select landmark {landmark.name}"
                  >
                    <div class="landmark-left-col">
                      <span class="landmark-dot" class:is-active={isActive}></span>
                      <div class="landmark-text-block">
                        <span class="landmark-name-text">{landmark.name}</span>
                        <span class="landmark-coords-text">
                          {formatLandmarkCoords(landmark)}
                        </span>
                      </div>
                    </div>

                    <div class="landmark-right-col">
                      {#if landmark.diameter_km}
                        <span class="landmark-metric-badge">Ø {Math.round(landmark.diameter_km)} km</span>
                      {:else if landmark.country}
                        <span class="landmark-metric-badge">{landmark.country}</span>
                      {/if}
                      {#if isActive}
                        <span class="landmark-locked-tag">TARGETED</span>
                      {/if}
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          {:else}
            <div class="landmarks-empty-state">
              <div class="empty-state-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <circle cx="12" cy="12" r="10"></circle>
                  <circle cx="12" cy="12" r="3"></circle>
                  <line x1="12" y1="2" x2="12" y2="5"></line>
                  <line x1="12" y1="19" x2="12" y2="22"></line>
                  <line x1="2" y1="12" x2="5" y2="12"></line>
                  <line x1="19" y1="12" x2="22" y2="12"></line>
                </svg>
              </div>
              <span class="empty-state-title">SELECT A LANDMARK TYPE</span>
              <p class="empty-state-desc">
                Choose a landmark category from the combobox above to browse Maria, mountain ranges, and historical landing sites.
              </p>
            </div>
          {/if}
        </Tabs.Content>

        <Tabs.Content value="compare" class="tab-content">
          <div class="compare-hud-section">
            <div class="compare-hud-header">
              <span class="compare-hud-title">MISSION WINDOW COMPARISON</span>
              <span class="compare-hud-badge">COMPARE MODE</span>
            </div>

            <div class="compare-samples-grid">
              <!-- Sample 1 Card -->
              <div class="compare-sample-summary-card" class:is-optimal={activeOptimalSample === 1}>
                <div class="summary-card-header">
                  <span class="summary-sample-tag s1-tag">SAMPLE 1</span>
                  {#if activeOptimalSample === 1}
                    <span class="optimal-sample-badge">OPTIMAL SAMPLE</span>
                  {/if}
                </div>
                <div class="summary-metric-row">
                  <span class="metric-name">OPTIMAL WINDOW</span>
                  <span class="metric-value">{sample1OptimalValue}h</span>
                </div>
              </div>

              <!-- Sample 2 Card -->
              <div class="compare-sample-summary-card" class:is-optimal={activeOptimalSample === 2}>
                <div class="summary-card-header">
                  <span class="summary-sample-tag s2-tag">SAMPLE 2</span>
                  {#if activeOptimalSample === 2}
                    <span class="optimal-sample-badge">OPTIMAL SAMPLE</span>
                  {/if}
                </div>
                <div class="summary-metric-row">
                  <span class="metric-name">OPTIMAL WINDOW</span>
                  <span class="metric-value">{sample2OptimalValue}h</span>
                </div>
              </div>
            </div>

            {#if activeOptimalSample}
              <div class="optimal-verdict-banner">
                <span class="verdict-icon">★</span>
                <span class="verdict-text">
                  SAMPLE {activeOptimalSample} IS OPTIMAL WITH {optimalSampleValue}h OF SIMULTANEOUS POWER & COMMS
                </span>
              </div>
            {:else}
              <div class="compare-pending-notice">
                <span>Select and calculate date ranges to evaluate optimal sample window.</span>
              </div>
            {/if}
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  {/if}
</div>

<style>
  /* ---------------- HUD Layout ---------------- */
  .lunar-hud-container {
    position: absolute;
    top: 27px;
    left: 50%;
    transform: translateX(-50%);
    width: 423px;
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 15;
    user-select: none;
    pointer-events: auto;
  }

  /* Frosted Box: 423px x 58px */
  .lunar-hud-box {
    width: 423px;
    height: 58px;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    position: relative;
    box-sizing: border-box;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .lunar-hud-box:hover:not(.is-editing) {
    background: rgba(255, 255, 255, 0.14);
  }

  .lunar-hud-box.is-editing {
    background: rgba(14, 20, 32, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.4);
    box-shadow: 0 0 20px rgba(0, 160, 255, 0.25), inset 0 0 12px rgba(255, 255, 255, 0.08);
    cursor: default;
  }

  .lunar-hud-box.has-error {
    border-color: rgba(255, 80, 80, 0.7);
    box-shadow: 0 0 18px rgba(255, 60, 60, 0.35);
  }

  .coord-col {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: center;
    box-sizing: border-box;
    cursor: pointer;
  }

  .coord-col-left {
    justify-content: flex-start;
    padding-left: 14px;
  }

  .coord-col-right {
    justify-content: flex-end;
    padding-right: 15px;
  }

  .coord-value {
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 500;
    font-size: 24px;
    color: #ffffff;
    line-height: normal;
    white-space: nowrap;
    letter-spacing: 0.5px;
  }

  /* Coordinate Inputs when editing */
  .coord-input {
    width: 100%;
    height: 100%;
    background: transparent;
    border: none;
    outline: none;
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 500;
    font-size: 22px;
    color: #ffffff;
    line-height: normal;
    letter-spacing: 0.5px;
    box-sizing: border-box;
    padding: 0;
  }

  .coord-input-left {
    text-align: left;
    padding-left: 0;
  }

  .coord-input-right {
    text-align: right;
    padding-right: 0;
  }

  .coord-input::placeholder {
    color: rgba(255, 255, 255, 0.35);
  }

  .coord-input:focus {
    color: #fffbdf;
    text-shadow: 0 0 10px rgba(255, 220, 100, 0.4);
  }

  /* Action buttons when editing */
  .edit-actions-bar {
    position: absolute;
    right: -66px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    gap: 4px;
    animation: fadeIn 0.15s ease-out;
  }

  .edit-action-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(10, 14, 24, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    font-size: 13px;
    font-family: sans-serif;
    cursor: pointer;
    border-radius: 3px;
    transition: all 0.15s ease;
  }

  .edit-action-confirm {
    color: #4ade80;
    border-color: rgba(74, 222, 128, 0.5);
  }

  .edit-action-confirm:hover {
    background: rgba(74, 222, 128, 0.25);
    border-color: #4ade80;
    transform: scale(1.08);
  }

  .edit-action-cancel {
    color: #f87171;
    border-color: rgba(248, 113, 113, 0.5);
  }

  .edit-action-cancel:hover {
    background: rgba(248, 113, 113, 0.25);
    border-color: #f87171;
    transform: scale(1.08);
  }

  /* Vertical Divider: 2px wide, 58px tall */
  .hud-divider {
    width: 2px;
    height: 58px;
    background: rgba(255, 255, 255, 0.2);
    flex-shrink: 0;
  }

  /* Labels and Arrow Button Row */
  .lunar-hud-labels {
    width: 423px;
    margin-top: 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
    height: 24px;
    box-sizing: border-box;
  }

  .hud-label {
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 500;
    font-size: 16px;
    color: #ffffff;
    line-height: normal;
    white-space: nowrap;
    letter-spacing: 0.8px;
  }

  .hud-label-lat {
    text-align: left;
  }

  .hud-label-lon {
    text-align: right;
  }

  /* Circular Arrow Button (node 49:6) */
  .hud-arrow-btn {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 24px;
    height: 24px;
    padding: 0;
    margin: 0;
    background: transparent;
    border: none;
    cursor: pointer;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease, color 0.2s ease;
  }

  .hud-arrow-btn:hover {
    opacity: 0.85;
    color: #ffffff;
    transform: translate(-50%, -50%) scale(1.15);
  }

  .hud-arrow-btn:active {
    transform: translate(-50%, -50%) scale(0.92);
  }

  .hud-arrow-btn.is-open {
    transform: translate(-50%, -50%) rotate(180deg);
  }

  .hud-arrow-btn.is-open:hover {
    transform: translate(-50%, -50%) rotate(180deg) scale(1.15);
  }

  .arrow-icon {
    width: 24px;
    height: 24px;
    display: block;
    pointer-events: none;
  }

  /* ---------------- Dropdown Menu ---------------- */
  /* Translucent frosted glass HUD dropdown attached below the coordinates HUD */
  .telemetry-dropdown {
    width: 423px;
    box-sizing: border-box;
    margin-top: 10px;
    padding: 0px;
    background: linear-gradient(
      180deg,
      rgba(10, 14, 24, 0.78) 0%,
      rgba(6, 9, 18, 0.68) 100%
    );
    backdrop-filter: blur(16px) saturate(160%) brightness(1.05);
    -webkit-backdrop-filter: blur(16px) saturate(160%) brightness(1.05);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-top: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 4px;
    box-shadow:
      0 16px 36px rgba(0, 0, 0, 0.55),
      0 0 24px rgba(0, 140, 255, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.18);
    display: flex;
    flex-direction: column;
    min-height: 220px;
    max-height: 480px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
    animation: dropdownSlideDown 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    transform-origin: top center;
  }

  :global(.popdown-tabs) {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  :global(.tabs-list) {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    background: rgba(255, 255, 255, 0.06);
    /*border: 1px solid rgba(255, 255, 255, 0.15);*/
    border-radius: 2px;
    box-sizing: border-box;
    padding: 3px;
    gap: 4px;
  }

  :global(.tab-trigger) {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 36px;
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.8px;
    color: rgba(255, 255, 255, 0.65);
    background: transparent;
    border: none;
    border-radius: 2px;
    cursor: pointer;
    box-sizing: border-box;
    transition: all 0.15s ease;
    user-select: none;
  }

  :global(.tab-trigger:hover:not([data-state="active"])) {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.1);
  }

  :global(.tab-trigger[data-state="active"]) {
    background: rgba(255, 255, 255, 0.3);
    color: white;
    font-weight: 700;
    /*box-shadow: 0 0 12px rgba(255, 149, 0, 0.35);*/
  }

  :global(.tab-content) {
    width: 100%;
    flex: 1;
    box-sizing: border-box;
    padding: 12px 14px 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    outline: none;
  }

  /* ---------------- Combobox Styles ---------------- */
  .combobox-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    box-sizing: border-box;
  }

  .combobox-label {
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.2px;
    color: rgba(255, 255, 255, 0.65);
    text-transform: uppercase;
  }

  .combobox-input-row {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    height: 38px;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 3px;
    box-sizing: border-box;
    transition: all 0.15s ease;
  }

  .combobox-input-row:focus-within {
    border-color: rgba(51, 229, 255, 0.8);
    background: rgba(255, 255, 255, 0.1);
    box-shadow: 0 0 12px rgba(51, 229, 255, 0.25);
  }

  :global(.combobox-search-input) {
    flex: 1;
    height: 100%;
    background: transparent;
    border: none;
    outline: none;
    padding: 0 12px;
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13.5px;
    font-weight: 500;
    color: #ffffff;
    letter-spacing: 0.4px;
    box-sizing: border-box;
  }

  :global(.combobox-search-input::placeholder) {
    color: rgba(255, 255, 255, 0.45);
  }

  .combobox-action-btn {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 100%;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.65);
    transition: color 0.15s ease, transform 0.15s ease;
    box-sizing: border-box;
  }

  .combobox-action-btn:hover {
    color: #ffffff;
  }

  .combobox-clear-btn {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  .combobox-clear-btn:hover {
    color: #ff6b6b;
  }

  .combobox-chevron {
    transition: transform 0.2s ease;
  }

  :global(.combobox-content-portal) {
    z-index: 9999;
    min-width: 395px;
    max-height: 240px;
    background: rgba(10, 14, 24, 0.94);
    backdrop-filter: blur(20px) saturate(160%);
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 3px;
    box-shadow:
      0 14px 34px rgba(0, 0, 0, 0.8),
      0 0 20px rgba(0, 140, 255, 0.15);
    padding: 4px;
    box-sizing: border-box;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
  }

  :global(.combobox-viewport) {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  :global(.combobox-item-option) {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13.5px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    border-radius: 2px;
    cursor: pointer;
    box-sizing: border-box;
    transition: background 0.12s ease, color 0.12s ease;
  }

  :global(.combobox-item-option:hover),
  :global(.combobox-item-option[data-highlighted]) {
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
  }

  :global(.combobox-item-option[data-state="checked"]) {
    background: rgba(51, 229, 255, 0.18);
    color: #33e5ff;
    font-weight: 600;
  }

  .option-label {
    letter-spacing: 0.3px;
  }

  .option-badge {
    font-family: 'Jersey 25', sans-serif;
    font-size: 13px;
    color: #ffaa55;
    letter-spacing: 0.8px;
  }

  .combobox-empty-row {
    padding: 12px;
    text-align: center;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.45);
  }

  /* ---------------- Landmarks List Section ---------------- */
  .landmarks-list-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    margin-top: 2px;
  }

  .landmarks-list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 4px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  }

  .section-title {
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.1px;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
  }

  .section-count {
    font-family: 'Jersey 25', sans-serif;
    font-size: 13.5px;
    color: #ffaa55;
    letter-spacing: 1px;
  }

  .landmarks-scroll-container {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 220px;
    overflow-y: auto;
    padding-right: 2px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
  }

  .landmark-item-row {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 3px;
    cursor: pointer;
    box-sizing: border-box;
    transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .landmark-item-row:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(51, 229, 255, 0.5);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), 0 0 10px rgba(51, 229, 255, 0.15);
  }

  .landmark-item-row.is-active {
    background: rgba(51, 229, 255, 0.14);
    border-color: #33e5ff;
    box-shadow: 0 0 14px rgba(51, 229, 255, 0.25), inset 0 0 8px rgba(51, 229, 255, 0.08);
  }

  .landmark-left-col {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .landmark-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.35);
    box-shadow: 0 0 4px rgba(255, 255, 255, 0.2);
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .landmark-dot.is-active {
    background: #33e5ff;
    box-shadow: 0 0 8px #33e5ff;
    transform: scale(1.2);
  }

  .landmark-text-block {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .landmark-name-text {
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13.5px;
    font-weight: 600;
    color: #ffffff;
    letter-spacing: 0.3px;
  }

  .landmark-coords-text {
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 11.5px;
    color: rgba(255, 255, 255, 0.6);
    letter-spacing: 0.3px;
  }

  .landmark-right-col {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .landmark-metric-badge {
    font-family: 'Jersey 25', sans-serif;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.8);
    background: rgba(255, 255, 255, 0.07);
    padding: 2px 7px;
    border-radius: 2px;
    letter-spacing: 0.8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .landmark-locked-tag {
    font-family: 'Jersey 25', sans-serif;
    font-size: 12.5px;
    color: #33e5ff;
    letter-spacing: 1px;
    text-shadow: 0 0 6px rgba(51, 229, 255, 0.6);
  }

  /* Empty State / Placeholder */
  .landmarks-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px 16px;
    text-align: center;
    background: rgba(255, 255, 255, 0.03);
    border: 1px dashed rgba(255, 255, 255, 0.15);
    border-radius: 3px;
    gap: 8px;
  }

  .empty-state-icon {
    color: rgba(255, 255, 255, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .empty-state-title {
    font-family: 'Jersey 25', sans-serif;
    font-size: 15px;
    color: rgba(255, 255, 255, 0.85);
    letter-spacing: 1.2px;
  }

  .empty-state-desc {
    margin: 0;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    line-height: 1.4;
    max-width: 280px;
  }

  /* Compare Tab in HUD */
  .compare-hud-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  .compare-hud-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  }

  .compare-hud-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.1px;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
  }

  .compare-hud-badge {
    font-family: 'Jersey 25', sans-serif;
    font-size: 13px;
    color: #ffaa55;
    letter-spacing: 1px;
  }

  .compare-samples-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .compare-sample-summary-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 3px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    box-sizing: border-box;
    transition: all 0.2s ease;
  }

  .compare-sample-summary-card.is-optimal {
    background: rgba(74, 222, 128, 0.12);
    border-color: rgba(74, 222, 128, 0.6);
    box-shadow: 0 0 12px rgba(74, 222, 128, 0.2);
  }

  .summary-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 4px;
  }

  .summary-sample-tag {
    font-family: 'Jersey 25', sans-serif;
    font-size: 12.5px;
    letter-spacing: 1px;
    padding: 1px 5px;
    border-radius: 2px;
  }

  .summary-sample-tag.s1-tag {
    background: rgba(255, 149, 0, 0.2);
    color: #ffaa55;
    border: 1px solid rgba(255, 149, 0, 0.4);
  }

  .summary-sample-tag.s2-tag {
    background: rgba(0, 178, 255, 0.2);
    color: #33e5ff;
    border: 1px solid rgba(0, 178, 255, 0.4);
  }

  .optimal-sample-badge {
    font-family: 'Jersey 25', sans-serif;
    font-size: 12px;
    letter-spacing: 1px;
    color: #4ade80;
    background: rgba(74, 222, 128, 0.18);
    border: 1px solid rgba(74, 222, 128, 0.6);
    border-radius: 2px;
    padding: 1px 6px;
    text-shadow: 0 0 8px rgba(74, 222, 128, 0.6);
    box-shadow: 0 0 10px rgba(74, 222, 128, 0.25);
    white-space: nowrap;
    animation: fadeIn 0.25s ease-out;
  }

  .summary-metric-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 2px;
  }

  .metric-name {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 10.5px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.55);
    letter-spacing: 0.6px;
  }

  .metric-value {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
  }

  .optimal-verdict-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(74, 222, 128, 0.15);
    border: 1px solid rgba(74, 222, 128, 0.5);
    border-radius: 3px;
    padding: 8px 12px;
    box-shadow: 0 0 10px rgba(74, 222, 128, 0.15);
    animation: fadeIn 0.25s ease-out;
  }

  .verdict-icon {
    color: #4ade80;
    font-size: 14px;
  }

  .verdict-text {
    font-family: 'Jersey 25', sans-serif;
    font-size: 13.5px;
    color: #4ade80;
    letter-spacing: 1px;
    line-height: 1.25;
  }

  .compare-pending-notice {
    padding: 14px;
    text-align: center;
    background: rgba(255, 255, 255, 0.03);
    border: 1px dashed rgba(255, 255, 255, 0.15);
    border-radius: 3px;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  @keyframes dropdownSlideDown {
    from {
      opacity: 0;
      transform: translateY(-8px) scaleY(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scaleY(1);
    }
  }

  @keyframes pulseDot {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.45;
      transform: scale(0.85);
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
</style>
