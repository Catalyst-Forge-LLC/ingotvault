import { defineFilepressConfig } from 'getfilepress';

const github = 'https://github.com/Catalyst-Forge-LLC/ingotvault';

export default defineFilepressConfig({
	title: 'IngotVault',
	description:
		'Spare remotes for a workspace of Git repos. Push covered local Git history to bare mirrors on a drive you control. Never touches origin.',
	tagline: 'Local history, in a second place you control.',
	lede: 'CLI · bare mirrors · never touches origin',
	url: 'https://ingotvault.dev',
	author: 'Catalyst Forge LLC',
	logo: '/logo.png',
	ogImage: '/logo.png',
	homePage: 'about',
	topics: [
		{ label: 'Guides', tag: 'guides' },
		{ label: 'Agents', tag: 'agents' },
		{ label: 'Release notes', tag: 'releases' }
	],
	nav: [
		{ label: 'Home', href: '/' },
		{ label: 'Posts', href: '/writing' },
		{ label: 'Install', href: '/install' },
		{ label: 'Safety', href: '/safety' },
		{ label: 'GitHub', href: github, icon: 'github' }
	],
	footerLinks: [
		{ label: 'See the rest of the Catalyst Forge shelf.', href: 'https://catalystforge.com/tools/' },
		{ label: 'RSS', href: '/rss.xml' },
		{ label: 'Topics', href: '/topics' },
		{ label: 'GitHub', href: github, icon: 'github' },
		{ label: 'AppFacts', href: 'https://appfacts.dev/v#af1.eNpVkUFrwzAMhf-K0dlNtx19G4XBRtklZZdRhupojlfHNrGcNZT89-EmLd1NiE_vPUlnGEA9SvDYESh49SbwB2bHIIHHWHqb7avgEBxISIycEyhAzXYgkOCsJp8K9hxRt7R6qh5mUB9BncGhNxlNAXZjpFr3NrIUbzjgXIOEPnu2F_v30FD1k0BCGxJbb4q9C7n5dtjTRXd0S7uuYZLQUEygPs_gQV0Cp6tqLJa10KGL1iHb4GGSC5dOC0An0rkYiV0t5tF0w3579MZRv7ANRRfGwnIQd6mmvYQ06FuKf4F7UNddRLJMAn0jMCUqPnsJh2xdUw4VUR_R0FeHHg2VsehjV1ZsQ0dxPmHLHJNar21501DeVDU0FBuKIVkO_XhHGcttPlQ6dOsNMrox8eol9IZW2-3mTgOmP8dnrqI' }
	]
});
