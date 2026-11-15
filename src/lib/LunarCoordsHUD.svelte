<script>
  import { onMount, tick } from 'svelte';
  import { Tabs } from 'bits-ui';
  import { convertToDirectionalCoords, parseCoordinateInput } from './ephemeris.js';

  let {
    selectedCoords = null,
    hoveredCoords = null,
    lat = 26.1322,
    lon = 3.6339,
    onCoordinateSelect = null,
    mode = $bindable('single')
  } = $props();

  let isDropdownOpen = $state(false);
  let isEditing = $state(false);
  let editLatInput = $state('');
  let editLonInput = $state('');
  let hasInputError = $state(false);

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
          <!-- Blank popdown content for Single -->
        </Tabs.Content>

        <Tabs.Content value="compare" class="tab-content">
          <!-- Blank popdown content for Compare -->
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
    min-height: 140px;
    box-sizing: border-box;
    outline: none;
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
