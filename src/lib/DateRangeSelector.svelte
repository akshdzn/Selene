<script>
  let {
    startDate = '',
    endDate = '',
    onChange = () => {}
  } = $props();

  let internalStart = $state('');
  let internalEnd = $state('');

  $effect(() => {
    internalStart = startDate || '';
  });

  $effect(() => {
    internalEnd = endDate || '';
  });

  function handleStartChange(e) {
    internalStart = e.target.value;
  }

  function handleEndChange(e) {
    internalEnd = e.target.value;
  }

  function handleSubmit() {
    if (internalStart && internalEnd && internalStart <= internalEnd) {
      onChange({ startDate: internalStart, endDate: internalEnd });
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }
</script>

<!-- Figma Node #33:176: Frame 17 (column, gap: 8px) -->
<div class="date-selector-frame">
  <!-- Frame 15: START DATE row -->
  <div class="date-row">
    <div class="date-label">START DATE</div>
    <div class="date-input-wrapper">
      <input
        type="date"
        class="date-input"
        value={internalStart}
        max={internalEnd || undefined}
        onchange={handleStartChange}
        onkeydown={handleKeyDown}
        aria-label="Start Date"
      />
    </div>
  </div>

  <!-- Frame 16: END DATE row -->
  <div class="date-row">
    <div class="date-label">END DATE</div>
    <div class="date-input-wrapper">
      <input
        type="date"
        class="date-input"
        value={internalEnd}
        min={internalStart || undefined}
        onchange={handleEndChange}
        onkeydown={handleKeyDown}
        aria-label="End Date"
      />
    </div>
  </div>

  <!-- Action button below the date fields -->
  <button
    type="button"
    class="enter-btn"
    onclick={handleSubmit}
    disabled={!internalStart || !internalEnd || internalStart > internalEnd}
  >
    ENTER
  </button>
</div>

<style>
  /* Figma Frame 17: Column layout with 8px gap */
  .date-selector-frame {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    user-select: none;
    z-index: 25;
  }

  /* Figma Frame 15 & 16: Row layout, unified 32px height */
  .date-row {
    display: flex;
    align-items: center;
    height: 32px;
  }

  /* Figma Frame 13: Label box without glass blur effect, unified 32px height */
  .date-label {
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    min-width: 105px;
    height: 32px;
    background: transparent;
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.8px;
    line-height: 1;
    white-space: nowrap;
    box-sizing: border-box;
  }

  /* Figma Frame 14: Input box with unified 32px height */
  .date-input-wrapper {
    display: inline-flex;
    align-items: center;
    height: 32px;
  }

  .date-input {
    all: unset;
    height: 32px;
    padding: 0 10px;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(40px);
    -webkit-backdrop-filter: blur(40px);
    color: #ffffff;
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13px;
    font-weight: 500;
    line-height: 32px;
    letter-spacing: 0.5px;
    outline: none;
    cursor: pointer;
    box-sizing: border-box;
    color-scheme: dark;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  .date-input:hover,
  .date-input:focus {
    border-color: rgba(255, 255, 255, 0.5);
    background: rgba(255, 255, 255, 0.16);
  }

  /* Datepicker calendar icon */
  .date-input::-webkit-calendar-picker-indicator {
    filter: invert(1);
    cursor: pointer;
    opacity: 0.75;
    transition: opacity 0.15s ease;
  }

  .date-input::-webkit-calendar-picker-indicator:hover {
    opacity: 1;
  }

  /* ENTER button below date fields */
  .enter-btn {
    height: 30px;
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background-color: #ff2600;
    color: #ffffff;
    border: none;
    border-radius: 2px;
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1px;
    line-height: 1;
    cursor: pointer;
    box-sizing: border-box;
    transition: background-color 0.15s ease, opacity 0.15s ease, transform 0.05s ease;
  }

  .enter-btn:hover:not(:disabled) {
    background-color: #ff3d1a;
  }

  .enter-btn:active:not(:disabled) {
    transform: scale(0.99);
  }

  .enter-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
</style>
