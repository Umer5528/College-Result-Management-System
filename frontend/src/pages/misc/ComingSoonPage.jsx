import React from 'react';
import { Construction } from 'lucide-react';
import { PageContainer } from '../../components/ui/PageContainer.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';

/**
 * Honest placeholder for a nav destination whose real screen hasn't been
 * built yet in this module-by-module build. Replaced page by page as each
 * module lands — never a fake button, just a clear "not yet" state.
 */
export default function ComingSoonPage({ moduleLabel }) {
  return (
    <PageContainer>
      <EmptyState
        icon={Construction}
        title={`${moduleLabel} is coming soon`}
        description="This screen is being built in an upcoming module and will appear here once ready."
      />
    </PageContainer>
  );
}
