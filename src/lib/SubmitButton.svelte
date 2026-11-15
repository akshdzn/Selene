<script>
  let {
    label = 'CALCULATE',
    disabled = false,
    onclick = () => {}
  } = $props();
</script>

<button
  type="button"
  class="submit-calculate-btn"
  {disabled}
  {onclick}
  aria-label={label}
>
  {label}
</button>

<style>
  .submit-calculate-btn {
    all: unset;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background-color: #ff9500;
    color: #000000;
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 1.2px;
    line-height: 1;
    text-transform: uppercase;
    padding: 0 36px;
    height: 42px;
    box-sizing: border-box;
    cursor: pointer;
    user-select: none;
    border-radius: 0px;
    transition: background-color 0.15s ease, transform 0.08s ease, opacity 0.15s ease;
    box-shadow: 0 4px 16px rgba(255, 149, 0, 0.3);
  }

  .submit-calculate-btn:hover:not(:disabled) {
    background-color: #ffa726;
  }

  .submit-calculate-btn:active:not(:disabled) {
    transform: scale(0.97);
    background-color: #f57c00;
  }

  .submit-calculate-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
