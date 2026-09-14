import { TopCustomers } from '../components/TopCustomers';
import { useTopCustomers } from '../hooks/useTopCustomers';

export function TopCustomersContainer({ enabled }: { enabled: boolean }) {
  const state = useTopCustomers(enabled);
  return (
    <TopCustomers
      rows={state.rows}
      date={state.draft}
      period={state.period}
      loading={state.loading}
      error={state.error}
      onDateChange={state.setDraft}
      onSearch={state.search}
      onToday={state.useToday}
      onRetry={state.retry}
    />
  );
}
