import { useState } from 'react';
import { useNavigation } from './useNavigation';
export function useApplication() {
  const route = useNavigation();
  const [busy, setBusy] = useState(false);
  return { route, busy, setBusy };
}
