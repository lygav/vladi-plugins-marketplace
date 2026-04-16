import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightThemeNext from 'starlight-theme-next';

export default defineConfig({
  site: 'https://lygav.github.io',
  base: '/vladi-plugins-marketplace',
  integrations: [
    starlight({
      title: 'Squad Federation',
      description: 'Transport-agnostic federated team orchestration',
      plugins: [starlightThemeNext()],
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
            { label: 'Teams Presence', slug: 'guides/teams-presence' },
            { label: 'Team Onboarding', slug: 'guides/team-onboarding' },
            { label: 'Multi-Team Walkthrough', slug: 'guides/multi-team-walkthrough' },
            { label: 'Communication Transports', slug: 'guides/communication-transports' },
            { label: 'Monitoring', slug: 'guides/monitoring' },
            { label: 'Knowledge Lifecycle', slug: 'guides/knowledge-lifecycle' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Architecture Overview', slug: 'reference/architecture' },
            { label: 'SDK Types', slug: 'reference/sdk-types' },
            { label: 'Configuration', slug: 'reference/configuration' },
            { label: 'Signal Protocol', slug: 'reference/signal-protocol' },
            { label: 'Launch Mechanics', slug: 'reference/launch-mechanics' },
            { label: 'Archetype System', slug: 'reference/archetype-system' },
            { label: 'Design Decisions', slug: 'reference/design-decisions' },
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
