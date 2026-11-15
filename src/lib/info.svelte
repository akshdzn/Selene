<script>
	import mitLogo from '../assets/mit-logo.svg';
	import nasaJplLogo from '../assets/nasa-jpl-logo.svg';
	import nasaLogo from '../assets/nasa-logo.svg';

	// Selene System Features Overview
	const features = [
		{
			category: 'PLANETARY SIMULATION & WARP',
			items: [
				{
					name: 'Tidally-Locked Orbit',
					desc: 'Accurately aligns Earth and the Moon based on real-time Horizons ephemeris data.'
				}
			]
		},
		{
			category: '3D MOON & NASA LOLA TOPOGRAPHY',
			items: [
				{
					name: 'True 32-Bit Float Elevation',
					desc: 'NASA LOLA elevation map (-8.8 km basin depths to +10.5 km highland peaks) decoded via UTIF.'
				},
				{
					name: 'Dynamic Solar Illumination',
					desc: 'Realistic Sun with procedural corona rings, horizontal flare streaks, and shadow casting.'
				}
			]
		},
		{
			category: 'SITE SELECTION & CARTOGRAPHY',
			items: [
				{
					name: 'Interactive Surface Reticle',
					desc: 'Normal-aligned 3D cursor with cast shadow for pinpointing any lunar coordinate.'
				},
				{
					name: 'Instant Ephemeris Targeting',
					desc: 'Click or double-click any point on the Moon to query live ephemeris for that exact site.'
				},
				{
					name: 'Known Lunar Landmarks',
					desc: '8 prominent Maria and mountain ranges.'
				}
			]
		},
		{
			category: '20-DAY EPHEMERIS TIMELINE',
			items: [
				{
					name: 'Scrubbable Playhead',
					desc: 'Scrub across a window to watch the day/night terminator and Sun/Earth positions shift in real time.'
				}
			]
		}
	];

	const sources = [
		{
			title: 'LOLA MAPS',
			desc: 'Lunar Reconnaissance Orbiter LOLA Science Node',
			url: 'https://imbrium.mit.edu/',
			logo: mitLogo,
			org: 'MIT'
		},
		{
			title: 'Azimuth Calculations API',
			desc: 'Solar System Dynamics & Horizons Ephemeris System',
			url: 'https://ssd-api.jpl.nasa.gov/doc/horizons.html',
			logo: nasaJplLogo,
			org: 'NASA JPL'
		},
		{
			title: 'Moon Map And Displacement',
			desc: 'CGI Moon Kit: Multi-Scale Topography & Displacement Map',
			url: 'https://svs.gsfc.nasa.gov/4720',
			logo: nasaLogo,
			org: 'NASA SVS'
		}
	];
</script>

<div class="info-wrapper">
	<!-- Mission Header -->
	<header class="info-header">
		<h1 class="info-title">SELENE LUNAR EXPLORATION ENGINE</h1>
		<p class="info-subtitle">
			An interactive 3D reconnaissance suite combining real-time NASA JPL Horizons ephemeris, LOLA lunar topography, and historical landing site cartography.
		</p>
	</header>

	<div class="divider"></div>

	<!-- Features Grid -->
	<div class="features-list">
		{#each features as section}
			<section class="feature-block">
				<div class="block-header">
					<span class="block-title">{section.category}</span>
				</div>
				<div class="items-grid">
					{#each section.items as item}
						<div class="item-card">
							<div class="item-name">{item.name}</div>
							<div class="item-desc">{item.desc}</div>
						</div>
					{/each}
				</div>
			</section>
		{/each}
	</div>

	<div class="divider"></div>

	<!-- Data Sources -->
	<section class="sources-section">
		<div class="block-header">
			<span class="block-title">SOURCES & CITATIONS</span>
		</div>
		<div class="sources-list">
			{#each sources as source}
				<a
					href={source.url}
					target="_blank"
					rel="noopener noreferrer"
					class="source-card"
				>
					<div class="source-logo-box">
						<img src={source.logo} alt="{source.title} logo" class="source-logo-img" />
					</div>
					<div class="source-info">
						<div class="source-title-row">
							<span class="source-title">{source.title}</span>
							<span class="source-org">[{source.org}]</span>
						</div>
						<div class="source-desc">{source.desc}</div>
						<div class="source-url">{source.url}</div>
					</div>
					<span class="source-arrow">↗</span>
				</a>
			{/each}
		</div>
	</section>
</div>

<style>
	.info-wrapper {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 2px 4px 8px 4px;
		color: #ffffff;
		font-family: "Space Grotesk", sans-serif;
		letter-spacing: 0.8px;
		user-select: text;
	}

	.info-header {
		display: flex;
		font-family: "Jersey 25", sans-serif;
		flex-direction: column;
		gap: 8px;
	}

	.info-title {
		margin: 0;
		font-size: 26px;
		letter-spacing: 1.4px;
		color: #ffffff;
		line-height: 1.15;
		text-shadow: 0 0 12px rgba(255, 255, 255, 0.2);
	}

	.info-subtitle {
		margin: 0;
		font-size: 16px;
		line-height: 1.4;
		color: rgba(255, 255, 255, 0.78);
		letter-spacing: 0.5px;
	}

	.divider {
		height: 1px;
		background: linear-gradient(90deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.05) 100%);
	}

	.features-list {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.feature-block {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.block-header {
		display: flex;
		align-items: center;
	}

	.block-title {
	    font-family: "Jersey 25", sans-serif;
		font-size: 17px;
		color: #ff9955;
		letter-spacing: 1.2px;
	}

	.items-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 8px;
	}

	@media (min-width: 500px) {
		.items-grid {
			grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
			gap: 10px;
		}
	}

	.item-card {
		padding: 10px 14px;
		background: rgba(255, 255, 255, 0.04);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.item-card:hover {
		background: rgba(255, 255, 255, 0.07);
	}

	.item-name {
		font-size: 16px;
		color: #ffffff;
		letter-spacing: 0.8px;
	}

	.item-desc {
		font-size: 14px;
		line-height: 1.35;
		color: rgba(255, 255, 255, 0.68);
		letter-spacing: 0.4px;
	}

	.sources-section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.sources-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.source-card {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
		background: rgba(255, 255, 255, 0.04);
		text-decoration: none;
		color: #ffffff;
		transition: all 0.2s ease;
	}

	.source-card:hover {
		background: rgba(255, 255, 255, 0.08);
		transform: translateX(2px);
	}

	.source-logo-box {
		width: 58px;
		height: 38px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #ffffff;
		padding: 4px 6px;
		flex-shrink: 0;
		box-shadow: 0 0 10px rgba(255, 255, 255, 0.12);
	}

	.source-logo-img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.source-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}

	.source-title-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
	}

	.source-title {
		font-size: 16px;
		color: #ffffff;
		letter-spacing: 0.8px;
	}

	.source-org {
		font-size: 13px;
		color: #ff9955;
		letter-spacing: 0.6px;
	}

	.source-desc {
		font-size: 13px;
		color: rgba(255, 255, 255, 0.65);
		letter-spacing: 0.3px;
	}

	.source-url {
		font-size: 13px;
		color: #33e5ff;
		letter-spacing: 0.4px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.source-arrow {
		font-size: 18px;
		color: rgba(255, 255, 255, 0.4);
		transition: color 0.2s ease, transform 0.2s ease;
		flex-shrink: 0;
	}

	.source-card:hover .source-arrow {
		color: #33e5ff;
		transform: translate(2px, -2px);
	}
</style>
