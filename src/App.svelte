<script>
  import Globe from './lib/Globe.svelte';
  import getLunarData from '../backend/Lunarfunction';

  let lat = $state(-89.9);
  let lon = $state(0);
  let result = $state(null);
  let loading = $state(false);

  async function checkSite(targetLat, targetLon) {
    loading = true;
	try {
      result = await getLunarData(targetLat, targetLon);
      console.log('Site Analysis:', result);
	} catch (err) {
	  console.error(err);
	} finally {
	  loading = false;
    }
  }

  checkSite(23, 23);
</script>
<main>
  <Globe></Globe>
</main>
