<script lang="ts">
  import { weekDays, parseISODate } from '../domain/week';
  import { formatDayHeading } from '../domain/format';
  let {
    week,
    date = $bindable(),
    slot = $bindable(),
    disabled = false,
  }: {
    week: string;
    date: string;
    slot: 0 | 1 | 2;
    disabled?: boolean;
  } = $props();
  const days = $derived(weekDays(week));
  const letters = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
  const labels = ['Śniadanie', 'Obiad', 'Kolacja'];
</script>

<div class="label">Dzień</div>
<div class="days">
  {#each days as day, index (day)}<button
      type="button"
      {disabled}
      aria-label={formatDayHeading(day).replace(',', '')}
      aria-pressed={day === date}
      onclick={() => (date = day)}
      ><span>{letters[index]}</span><strong
        >{parseISODate(day).getUTCDate()}</strong
      ></button
    >{/each}
</div>
<div class="label">Posiłek</div>
<div class="slots">
  {#each [0, 1, 2] as value (value)}<button
      type="button"
      {disabled}
      aria-pressed={value === slot}
      onclick={() => (slot = value as 0 | 1 | 2)}>{labels[value]}</button
    >{/each}
</div>

<style>
  .label {
    margin-top: 16px;
    font-size: 13px;
    font-weight: 700;
    color: var(--muted);
  }
  .days {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 6px;
    margin-top: 6px;
  }
  .days button {
    height: 56px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
  .days span {
    font-size: 12px;
    color: var(--muted);
  }
  .days strong {
    font-size: 16px;
  }
  .slots {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    margin-top: 6px;
  }
  .slots button {
    height: 48px;
    font-size: 14px;
  }
  button {
    border: 1px solid rgba(20, 32, 26, 0.12);
    border-radius: 12px;
    background: var(--white);
  }
  [aria-pressed='true'] {
    background: var(--accent);
    color: var(--white);
  }
  [aria-pressed='true'] span {
    color: rgba(255, 255, 255, 0.85);
  }
  button:disabled {
    opacity: 0.6;
  }
  @media (min-width: 1024px) {
    .days button {
      height: 52px;
    }
    .slots button {
      height: 44px;
    }
    .label {
      margin-top: 12px;
    }
  }
</style>
