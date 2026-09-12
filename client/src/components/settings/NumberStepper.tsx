import { Button } from '@/components/ui/button';

interface NumberStepperProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  ariaLabel?: string;
}

export function NumberStepper({
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  ariaLabel,
}: NumberStepperProps) {
  const handleDecrement = () => {
    const next = Math.max(min, value - step);
    if (next !== value) onChange(next);
  };

  const handleIncrement = () => {
    const next = Math.min(max, value + step);
    if (next !== value) onChange(next);
  };

  return (
    <div
      className="flex items-center gap-1.5 bg-slate-900/40 border border-white/10 rounded-xl p-1"
      aria-label={ariaLabel}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg shrink-0"
        disabled={value <= min}
        onClick={handleDecrement}
        aria-label="Decrease"
      >
        <span className="material-icons text-sm">remove</span>
      </Button>
      <span className="min-w-16 text-center text-sm font-semibold font-mono text-foreground px-1 select-none">
        {value}{unit ? ` ${unit}` : ''}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg shrink-0"
        disabled={value >= max}
        onClick={handleIncrement}
        aria-label="Increase"
      >
        <span className="material-icons text-sm">add</span>
      </Button>
    </div>
  );
}
