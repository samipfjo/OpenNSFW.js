# OpenNSFW JS
 A nudity classifier for web browsers utilizing Yahoo's OpenNSFW model

<br>

[Read the documentation here](https://lukepfjo.github.io/OpenNSFW.js/)

<br>

Usage:

```html
<script src="opennsfw.min.js"></script>  <!-- Or include it in your bundle -->

<script>
	async function classify_images() {
		const nsfw = new window.OpenNSFW('/static/model/model.json');
		await nsfw.load();

		// this.prime() speeds up subsequent classifications, but it's not helpful
		// here as we're immediately classifying an image after the model loads
		// await opennsfw.prime();

		const images = document.querySelectorAll('img');
		
		nsfw.classifyImages(images).then((output) => {
			let img_index = 0;

			for (let result of output) {
				const new_text = document.createElement('h4');
				const confidence = (result.nsfw_confidence * 100).toFixed(4);

				new_text.innerText = `${result.is_nsfw ? 'NSFW' : 'SFW'} - (${confidence}%)`;

				images[img_index].parentElement.appendChild(new_text);
				img_index++;
			}
		});
	}

	document.addEventListener('DOMContentLoaded', classify_images);
</script>

<!-- (...) -->

<img src="some-img.jpg">
<h3 id="result></h3>
```
