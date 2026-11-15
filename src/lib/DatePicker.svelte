<script>
  let {
    label = '',
    value = '',
    min = '',
    max = '',
    align = 'left',
    disabled = false,
    onchange = () => {},
    onsubmit = () => {}
  } = $props();

  let inputRef = $state(null);

  function handleInput(e) {
    onchange(e.target.value);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onsubmit();
    }
  }

  function handleBoxClick(e) {
    if (e.target !== inputRef && inputRef && !disabled) {
      if (typeof inputRef.showPicker === 'function') {
        try {
          inputRef.showPicker();
        } catch {
          inputRef.focus();
        }
      } else {
        inputRef.focus();
      }
    }
  }
</script>

<!-- Date Picker Container -->
<div class="date-picker-container align-{align}">
  <label class="date-picker-label" for="date-input-{label.replace(/\s+/g, '-').toLowerCase()}">
    {label}
  </label>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="date-input-box" onclick={handleBoxClick}>
    <input
      id="date-input-{label.replace(/\s+/g, '-').toLowerCase()}"
      bind:this={inputRef}
      type="date"
      class="native-date-input"
      {value}
      min={min || undefined}
      max={max || undefined}
      {disabled}
      oninput={handleInput}
      onchange={handleInput}
      onkeydown={handleKeyDown}
      aria-label={label}
    />
  </div>
</div>

<style>
  .date-picker-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    user-select: none;
  }

  .align-left {
    align-items: flex-start;
  }

  .align-right {
    align-items: flex-end;
  }

  .date-picker-label {
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1px;
    line-height: 1;
    text-transform: uppercase;
    cursor: default;
  }

  .align-right .date-picker-label {
    text-align: right;
  }

  .date-input-box {
    display: inline-flex;
    align-items: center;
    position: relative;
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 0px;
    height: 44px;
    width: 220px;
    box-sizing: border-box;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .date-input-box:hover {
    background: rgba(255, 255, 255, 0.14);
    border-color: rgba(255, 255, 255, 0.35);
  }

  .date-input-box:focus-within {
    border-color: rgba(255, 255, 255, 0.6);
    background: rgba(255, 255, 255, 0.16);
  }

  .native-date-input {
    all: unset;
    width: 100%;
    height: 100%;
    padding: 0 16px;
    color: #ffffff;
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.5px;
    box-sizing: border-box;
    color-scheme: dark;
    cursor: pointer;
  }

  .align-right .native-date-input {
    text-align: right;
  }

  /* Invert native calendar picker indicator */
  .native-date-input::-webkit-calendar-picker-indicator {
    filter: invert(1);
    cursor: pointer;
    opacity: 0.8;
    transition: opacity 0.15s ease;
  }

  .native-date-input::-webkit-calendar-picker-indicator:hover {
    opacity: 1;
  }

  .native-date-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
