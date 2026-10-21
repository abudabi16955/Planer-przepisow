<script lang="ts">
  import type { DailyGoal } from '../domain/day';
  let {
    values,
    onchange,
  }: {
    values: Record<keyof DailyGoal, string>;
    onchange: (key: keyof DailyGoal, value: string) => void;
  } = $props();
  const uid = $props.id();
  const fields = [
    ['kcal', 'Kalorie (kcal)'],
    ['protein', 'Białko (g)'],
    ['carbs', 'Węglowodany (g)'],
    ['fat', 'Tłuszcze (g)'],
  ] as const;
</script>

<div class="fields">
  {#each fields as [key, label] (key)}<div>
      <label for={`${uid}-${key}`}>{label}</label><input
        id={`${uid}-${key}`}
        inputmode="decimal"
        value={values[key]}
        oninput={(event) => onchange(key, event.currentTarget.value)}
      />
    </div>{/each}
</div>

<style>
  .fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 12px;
  }
  label {
    display: block;
    font-size: 13px;
    font-weight: 700;
  }
  input {
    width: 100%;
    height: 48px;
    margin-top: 4px;
    padding: 0 12px;
    border: 1px solid rgba(20, 32, 26, 0.2);
    border-radius: 12px;
    background: var(--white);
    font: inherit;
    font-size: 16px;
  }
  @media (min-width: 1024px) {
    .fields {
      gap: 10px;
    }
    input {
      height: 44px;
      padding: 0 10px;
      border-radius: 10px;
      font-size: 15px;
    }
  }
</style>
