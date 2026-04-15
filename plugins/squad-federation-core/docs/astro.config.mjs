import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Squad Federation',
      description: 'Transport-agnostic federated team orchestration',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/lygav/vladi-plugins-marketplace',
        },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: 'getting-started/introduction' },
            { label: 'Installation', slug: 'getting-started/installation' },
            { label: 'Your First Federation', slug: 'getting-started/first-federation' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Federation Setup', slug: 'guides/federation-setup' },
            { label: 'Team Onboarding', slug: 'guides/team-onboarding' },
            { label: 'Communication Transports', slug: 'guides/communication-transports' },
            { label: 'Monitoring', slug: 'guides/monitoring' },
            { label: 'Knowledge Lifecycle', slug: 'guides/knowledge-lifecycle' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'SDK Types', slug: 'reference/sdk-types' },
            { label: 'Configuration', slug: 'reference/configuration' },
            { label: 'Signal Protocol', slug: 'reference/signal-protocol' },
            { label: 'Scripts', slug: 'reference/scripts' },
          ],
        },
        {
          label: 'Archetypes',
          items: [
            { label: 'Overview', slug: 'archetypes/overview' },
            { label: 'Creating Archetypes', slug: 'archetypes/creating-archetypes' },
            { label: 'Coding', slug: 'archetypes/coding' },
            { label: 'Deliverable', slug: 'archetypes/deliverable' },
            { label: 'Consultant', slug: 'archetypes/consultant' },
          ],
        },
      ],
    }),
  ],
});
