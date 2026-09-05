interface DatabaseUnavailableProps {
  description?: string;
}

export function DatabaseUnavailable({ description }: DatabaseUnavailableProps) {
  return (
    <div className="rounded-sm border border-danger/30 bg-bg-panel px-4 py-3">
      <p className="text-base font-semibold text-danger-light">Reports temporarily unavailable</p>
      <p className="mt-1 text-sm text-text-secondary">
        {description ??
          "We could not load the raid data. Refresh this page to try again, or come back shortly."}
      </p>
    </div>
  );
}
