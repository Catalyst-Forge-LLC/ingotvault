import { defineFilepressConfig } from 'getfilepress';

export default defineFilepressConfig({
	title: 'IngotVault',
	description:
		'Spare remotes for a workspace of Git repos. Push committed history to bare mirrors on a drive you control — never touches origin.',
	tagline: 'Every commit in a second place you control.',
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
		{ label: 'GitHub', href: 'https://github.com/Catalyst-Forge-LLC/ingotvault' }
	]
});
