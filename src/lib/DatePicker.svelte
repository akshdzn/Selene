<script>
  import { DatePicker } from 'bits-ui';
  import { parseDate } from '@internationalized/date';

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

  function safeParse(s) {
    if (!s || typeof s !== 'string') return undefined;
    try {
      return parseDate(s);
    } catch {
      return undefined;
    }
  }

  let internalValue = $state();

  $effect(() => {
    internalValue = safeParse(value);
  });

  let minValue = $derived(safeParse(min));
  let maxValue = $derived(safeParse(max));

  function handleValueChange(newVal) {
    internalValue = newVal;
    const str = newVal ? newVal.toString() : '';
    if (str !== value) {
      onchange(str);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onsubmit();
    }
  }
</script>

<div class="date-picker-container align-{align}" class:is-disabled={disabled}>
  <span class="date-picker-label">
    {label}
  </span>

  <DatePicker.Root
    value={internalValue}
    onValueChange={handleValueChange}
    {minValue}
    {maxValue}
    {disabled}
    locale="en-GB"
    weekdayFormat="short"
    fixedWeeks={true}
  >
    <div class="date-input-box">
      <DatePicker.Input class="bits-date-input" onkeydown={handleKeyDown}>
        {#snippet children({ segments })}
          {#each segments as { part, value: segmentValue }}
            <DatePicker.Segment {part} class="bits-date-segment">
              {segmentValue}
            </DatePicker.Segment>
          {/each}
        {/snippet}
      </DatePicker.Input>

      <DatePicker.Trigger class="calendar-trigger-btn" aria-label="Open calendar for {label}">
        <svg
          class="calendar-icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="3" y="4" width="18" height="18"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      </DatePicker.Trigger>
    </div>

    <DatePicker.Portal>
      <DatePicker.Content
        side="bottom"
        sideOffset={8}
        align={align === 'right' ? 'end' : 'start'}
        class="bits-calendar-popover"
      >
        <DatePicker.Calendar class="bits-calendar">
          {#snippet children({ months, weekdays })}
            <DatePicker.Header class="calendar-header">
              <DatePicker.PrevButton class="calendar-nav-btn" aria-label="Previous month">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </DatePicker.PrevButton>

              <DatePicker.Heading class="calendar-heading" />

              <DatePicker.NextButton class="calendar-nav-btn" aria-label="Next month">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </DatePicker.NextButton>
            </DatePicker.Header>

            <div class="calendar-grid-wrapper">
              {#each months as month}
                <DatePicker.Grid class="calendar-grid">
                  <DatePicker.GridHead>
                    <DatePicker.GridRow class="grid-row">
                      {#each weekdays as day}
                        <DatePicker.HeadCell class="head-cell">
                          {day}
                        </DatePicker.HeadCell>
                      {/each}
                    </DatePicker.GridRow>
                  </DatePicker.GridHead>
                  <DatePicker.GridBody>
                    {#each month.weeks as weekDates}
                      <DatePicker.GridRow class="grid-row">
                        {#each weekDates as date}
                          <DatePicker.Cell {date} month={month.value} class="calendar-cell">
                            <DatePicker.Day class="calendar-day" />
                          </DatePicker.Cell>
                        {/each}
                      </DatePicker.GridRow>
                    {/each}
                  </DatePicker.GridBody>
                </DatePicker.Grid>
              {/each}
            </div>
          {/snippet}
        </DatePicker.Calendar>
      </DatePicker.Content>
    </DatePicker.Portal>
  </DatePicker.Root>
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
    justify-content: space-between;
    position: relative;
    background: rgba(255, 255, 255, 0.08);
    -webkit-backdrop-filter: blur(24px);
    backdrop-filter: blur(24px);
    transform: translateZ(0);
    will-change: backdrop-filter;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 0px;
    height: 44px;
    width: 220px;
    max-width: 100%;
    padding: 0 12px;
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

  .date-picker-container.is-disabled {
    opacity: 0.55;
    pointer-events: none;
    user-select: none;
  }

  .date-picker-container.is-disabled .date-input-box {
    cursor: not-allowed;
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.08);
  }

  :global(.date-picker-container.is-disabled .calendar-trigger-btn) {
    opacity: 0.3;
    pointer-events: none;
  }

  :global(.bits-date-input) {
    display: flex;
    align-items: center;
    flex: 1;
    outline: none;
  }

  :global(.bits-date-segment) {
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
    padding: 2px 3px;
    outline: none;
    border-radius: 0px;
    box-sizing: border-box;
    transition: background-color 0.12s ease, color 0.12s ease;
  }

  :global(.bits-date-segment[data-segment="literal"]) {
    color: rgba(255, 255, 255, 0.45);
    padding: 0 1px;
  }

  :global(.bits-date-segment:focus) {
    background: #ff9500;
    color: #000000;
    font-weight: 700;
  }

  .calendar-trigger-btn {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    color: rgba(255, 255, 255, 0.65);
    cursor: pointer;
    transition: color 0.15s ease, transform 0.08s ease;
    border-radius: 0px;
  }

  .calendar-trigger-btn:hover {
    color: #ff9500;
  }

  .calendar-trigger-btn:active {
    transform: scale(0.92);
  }

  /* Popover Content */
  :global(.bits-calendar-popover) {
    z-index: 1000;
    background: rgba(12, 12, 12, 0.94);
    -webkit-backdrop-filter: blur(28px);
    backdrop-filter: blur(28px);
    transform: translateZ(0);
    will-change: backdrop-filter;
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.85), 0 0 1px rgba(255, 255, 255, 0.3);
    padding: 14px;
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
    user-select: none;
    border-radius: 0px;
    min-width: 240px;
    max-width: calc(100vw - 20px);
    box-sizing: border-box;
  }

  :global(.calendar-header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  :global(.calendar-heading) {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: #ffffff;
  }

  :global(.calendar-nav-btn) {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    color: rgba(255, 255, 255, 0.8);
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 0px;
    cursor: pointer;
    box-sizing: border-box;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }

  :global(.calendar-nav-btn:hover:not(:disabled)) {
    background: rgba(255, 255, 255, 0.2);
    border-color: #ff9500;
    color: #ff9500;
  }

  :global(.calendar-nav-btn:disabled) {
    opacity: 0.3;
    cursor: not-allowed;
  }

  :global(.calendar-grid-wrapper) {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  :global(.calendar-grid) {
    width: 100%;
    border-collapse: collapse;
  }

  :global(.grid-row) {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
    margin-bottom: 2px;
  }

  :global(.head-cell) {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 24px;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: rgba(255, 255, 255, 0.45);
    text-transform: uppercase;
  }

  :global(.calendar-cell) {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  :global(.calendar-day) {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: #ffffff;
    cursor: pointer;
    box-sizing: border-box;
    border-radius: 0px;
    transition: background-color 0.12s ease, color 0.12s ease;
  }

  :global(.calendar-day:hover:not([data-disabled])) {
    background: rgba(255, 255, 255, 0.18);
  }

  :global(.calendar-day[data-today]) {
    border: 1px solid rgba(255, 149, 0, 0.6);
  }

  :global(.calendar-day[data-selected]) {
    background-color: #ff9500;
    color: #000000;
    font-weight: 700;
    box-shadow: 0 0 10px rgba(255, 149, 0, 0.4);
  }

  :global(.calendar-day[data-disabled]) {
    opacity: 0.25;
    cursor: not-allowed;
  }

  :global(.calendar-day[data-outside-month]) {
    opacity: 0.2;
  }

  @media (max-width: 768px) {
    .date-input-box {
      width: 100%;
      max-width: 165px;
      height: 38px;
      padding: 0 8px;
    }

    :global(.bits-date-segment) {
      font-size: 13px;
      padding: 1px 2px;
    }

    .date-picker-label {
      font-size: 10px;
    }

    .calendar-trigger-btn {
      width: 24px;
      height: 24px;
    }
  }
</style>
