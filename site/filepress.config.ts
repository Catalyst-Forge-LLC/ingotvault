import { defineFilepressConfig } from 'getfilepress';

const github = 'https://github.com/Catalyst-Forge-LLC/ingotvault';

export default defineFilepressConfig({
	title: 'IngotVault',
	description:
		'Spare remotes for a workspace of Git repos. Push covered local Git history to bare mirrors on a drive you control. Never touches origin.',
	tagline: 'Covered local history, in a second place you control.',
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
		{ label: 'AppFacts', href: 'https://appfacts.dev/v#af1.eNpVkUFrwzAMhf-K0dlttx19G4XBRtklvY0yVEdzvTq2sZSsoeS_D7dp2W5CfHrvSTrDAOZRQ8SOwICPLsmAfRDQIGOuvfXmVUlKATSwoPQMBtCKHwg0BG8pcsWeM9oDLZ6WD1fQHsGcIWB0PboKbMdMjS0-i1ZvOOC1Bg2lj-Iv9u-ppeU3g4ZDYvHRVfuQ-vYrYKGL7hjmdtPApKGlzGA-zhDBXALzTTVXy0bZ1GUfUHyKMOmZ49MM0IlsX43UtlHXUb5jPwWjC1RmtqUc0lhZSepPqmmngQd7T_EvcAFz20WxF1IYW4XMVH12Gva9D209VEZ7REefHUZ0VMdyzF1dsVBO7CWVsWqJZDarlfNy6PdLm7rVGgXDyLJ4ScXRYrNZr_68cfoFp6GiKQ' }
	]
});
