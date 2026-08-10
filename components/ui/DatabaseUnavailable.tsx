interface DatabaseUnavailableProps {
  description?: string;
}

export function DatabaseUnavailable({ description }: DatabaseUnavailableProps) {
  return (
    <div className="rounded-sm border border-danger/30 bg-bg-panel px-4 py-3">
      <p className="text-sm font-semibold text-danger">Database unavailable</p>
      <p className="mt-1 text-sm text-text-secondary">
        {description ??
          "This page needs the Pizza Logs database. Start local Postgres or reconnect the production database to load live data."}
      </p>
    </div>
  );
}
