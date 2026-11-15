<script>
  import { onMount } from 'svelte';
  import { convertToDirectionalCoords } from './ephemeris.js';

  let {
    selectedCoords = null,
    hoveredCoords = null,
    lat = 26.1322,
    lon = 3.6339
  } = $props();

  let isDropdownOpen = $state(false);

  // 1. When a coordinate is selected, the above coordinates should ONLY display that coordinate (using selectedCoords).
  // 2. When no coordinate is selected yet, read latitude and longitude from the mouse cursor location (hoveredCoords).
  // 3. Before any clicks or mouse hover happen on the CoordsHUD, show lat (26.1322) and lon (3.6339) as the initial value.
  let displayCoords = $derived.by(() => {
    if (selectedCoords && typeof selectedCoords.lat === 'number' && typeof selectedCoords.lon === 'number') {
      return convertToDirectionalCoords(selectedCoords.lat, selectedCoords.lon, { precision: 3, space: ' ' });
    }
    if (hoveredCoords && typeof hoveredCoords.lat === 'number' && typeof hoveredCoords.lon === 'number') {
      return convertToDirectionalCoords(hoveredCoords.lat, hoveredCoords.lon, { precision: 3, space: ' ' });
    }
    return convertToDirectionalCoords(lat ?? 26.1322, lon ?? 3.6339, { precision: 3, space: ' ' });
  });

  let isTargetLocked = $derived(
    Boolean(selectedCoords && typeof selectedCoords.lat === 'number' && typeof selectedCoords.lon === 'number')
  );

  let isHoverTracking = $derived(
    Boolean(!isTargetLocked && hoveredCoords && typeof hoveredCoords.lat === 'number' && typeof hoveredCoords.lon === 'number')
  );

  let targetingStatus = $derived.by(() => {
    if (isTargetLocked) return 'SURFACE TARGET LOCKED';
    if (isHoverTracking) return 'LIVE CURSOR TRACKING';
    return 'DEFAULT TELEMETRY';
  });

  function handleKeydown(e) {
    if (e.key === 'Escape' && isDropdownOpen) {
      isDropdownOpen = false;
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<!-- Lunar Coordinates HUD (Figma node 49:9) -->
<div class="lunar-hud-container" data-node-id="49:9">
  <!-- Frosted Coordinates Box (node 47:2) -->
  <div class="lunar-hud-box" data-node-id="47:2">
    <!-- Left: Latitude (node 47:6) -->
    <div class="coord-col coord-col-left">
      <span class="coord-value" data-node-id="47:6">{displayCoords.latStr}</span>
    </div>

    <!-- Center Divider (node 47:5) -->
    <div class="hud-divider" data-node-id="47:5"></div>

    <!-- Right: Longitude (node 47:7) -->
    <div class="coord-col coord-col-right">
      <span class="coord-value" data-node-id="47:7">{displayCoords.lonStr}</span>
    </div>
  </div>

  <!-- Bottom Labels & Arrow Button Row -->
  <div class="lunar-hud-labels">
    <!-- Latitude Label (node 47:3) -->
    <span class="hud-label hud-label-lat" data-node-id="47:3">LATITUDE</span>

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
    <span class="hud-label hud-label-lon" data-node-id="47:4">LONGITUDINAL</span>
  </div>

  <!-- Telemetry Dropdown Menu -->
  {#if isDropdownOpen}
    <div
      class="telemetry-dropdown"
      role="region"
      aria-label="Lunar site telemetry dropdown"
    >
      <div class="dropdown-header">
        <div class="title-group">
          <span class="telemetry-status-dot" class:is-locked={isTargetLocked}></span>
          <h2 class="dropdown-title">LUNAR SITE TELEMETRY</h2>
        </div>
        <button
          type="button"
          class="dropdown-close-btn"
          onclick={() => (isDropdownOpen = false)}
          aria-label="Close telemetry dropdown"
        >
          [ CLOSE ]
        </button>
      </div>

      <div class="dropdown-divider"></div>

      <div class="dropdown-body">
        <div class="site-coords-grid">
          <div class="coord-stat-card">
            <span class="stat-label">LATITUDE</span>
            <span class="stat-value">{displayCoords.latStr}</span>
          </div>
          <div class="coord-stat-card">
            <span class="stat-label">LONGITUDE</span>
            <span class="stat-value">{displayCoords.lonStr}</span>
          </div>
        </div>

        <div class="telemetry-status-strip">
          <span class="status-tag">STATUS:</span>
          <span class="status-text">{targetingStatus}</span>
        </div>

        <div class="placeholder-section">
          <div class="placeholder-badge">[ SITE ANALYSIS PENDING ]</div>
          <p class="placeholder-desc">
            Surface reconnaissance telemetry, elevation contours, and mission metadata for this lunar coordinate will appear here.
          </p>
        </div>
      </div>
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
  }

  .coord-col {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: center;
    box-sizing: border-box;
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
    padding: 16px 20px 20px 20px;
    /* Translucent dark glass backdrop allowing lunar surface and stars behind to remain clearly visible */
    background: linear-gradient(
      180deg,
      rgba(10, 14, 24, 0.62) 0%,
      rgba(6, 9, 18, 0.52) 100%
    );
    /* Frosted glass blur & saturation to smooth high-frequency background noise and ensure readability */
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
    gap: 14px;
    max-height: calc(100vh - 120px);
    overflow-y: auto;
    animation: dropdownSlideDown 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    transform-origin: top center;
  }

  .telemetry-dropdown::-webkit-scrollbar {
    width: 5px;
  }

  .telemetry-dropdown::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.04);
  }

  .telemetry-dropdown::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.25);
    border-radius: 2px;
  }

  .telemetry-dropdown::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.45);
  }

  .dropdown-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .title-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .telemetry-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #58b5ff;
    box-shadow: 0 0 8px #58b5ff;
    display: inline-block;
    animation: pulseDot 2s infinite ease-in-out;
  }

  .telemetry-status-dot.is-locked {
    background: #4ade80;
    box-shadow: 0 0 8px #4ade80;
  }

  .dropdown-title {
    margin: 0;
    font-family: "Jersey 25", sans-serif;
    font-size: 21px;
    letter-spacing: 1.4px;
    color: #ffffff;
    line-height: 1.15;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95), 0 0 10px rgba(0, 0, 0, 0.8);
  }

  .dropdown-close-btn {
    padding: 4px 12px;
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: 3px;
    font-family: "Jersey 25", sans-serif;
    font-size: 15px;
    letter-spacing: 1px;
    cursor: pointer;
    backdrop-filter: blur(8px);
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.08);
    transition: all 0.18s ease;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
  }

  .dropdown-close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: #ffffff;
    box-shadow: 0 0 14px rgba(255, 255, 255, 0.3);
    transform: scale(1.03);
  }

  .dropdown-close-btn:active {
    transform: scale(0.97);
  }

  .dropdown-divider {
    height: 1px;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.35) 0%,
      rgba(255, 255, 255, 0.06) 100%
    );
  }

  .dropdown-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    user-select: text;
  }

  .site-coords-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .coord-stat-card {
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    gap: 3px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.25);
  }

  .stat-label {
    font-family: "Jersey 25", sans-serif;
    font-size: 14px;
    color: #ffaa55;
    letter-spacing: 1.1px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95);
  }

  .stat-value {
    font-family: "Space Grotesk", sans-serif;
    font-size: 17px;
    font-weight: 600;
    color: #ffffff;
    letter-spacing: 0.5px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95), 0 0 6px rgba(0, 0, 0, 0.7);
  }

  .telemetry-status-strip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-family: "Jersey 25", sans-serif;
    letter-spacing: 1px;
  }

  .status-tag {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.55);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
  }

  .status-text {
    font-size: 15px;
    color: #79c0ff;
    letter-spacing: 1.2px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95);
  }

  .placeholder-section {
    padding: 12px 14px;
    background: rgba(0, 0, 0, 0.25);
    border: 1px dashed rgba(255, 255, 255, 0.2);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .placeholder-badge {
    font-family: "Jersey 25", sans-serif;
    font-size: 15px;
    color: #e2e8f0;
    letter-spacing: 1.1px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95);
  }

  .placeholder-desc {
    margin: 0;
    font-family: "Space Grotesk", sans-serif;
    font-size: 13px;
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.88);
    letter-spacing: 0.3px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95);
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
</style>
