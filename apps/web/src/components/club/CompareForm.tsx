import { Button } from '@/components/ui/Button';

interface FieldProps {
  name: 'a' | 'b';
  label: string;
  value: string;
  error?: string;
}

function Field({ name, label, value, error }: FieldProps) {
  const id = `club-${name}`;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-muted">
        {label}
      </label>
      <input
        id={id}
        name={name}
        defaultValue={value}
        placeholder="#2YPLQ"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="min-h-11 w-full min-w-0 rounded-card border border-border bg-surface-2 px-3 text-base uppercase text-fg placeholder:normal-case placeholder:text-muted"
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-loss">
          {error}
        </p>
      )}
    </div>
  );
}

/** Formulario GET nativo: funciona sin JavaScript y antes de hidratar. */
export function CompareForm({ a, b, errors }: { a: string; b: string; errors: { a?: string; b?: string } }) {
  return (
    <form method="get" action="/clubes/comparar" className="rounded-card border border-border bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="a" label="Club A" value={a} error={errors.a} />
        <Field name="b" label="Club B" value={b} error={errors.b} />
      </div>
      <Button type="submit" className="mt-3 w-full sm:w-auto">
        Comparar
      </Button>
    </form>
  );
}
