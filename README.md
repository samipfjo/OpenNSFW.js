# OpenNSFW.js
 A nudity classifier for web browsers utilizing Yahoo's OpenNSFW model

<br>

### Motivation
 There are several projects that offer Tensorflow.js NSFW classification, but all of the models I tried had serious training bias against people of color, causing regular false positives due to the subject's skin color. This was highly disturbing and made them completely unusable for the project I was working on ([YouTube Spam Remover](https://github.com/lukepfjo/YouTube-Spam-Remover)). After several days of searching, the best model I could find was Yahoo's OpenNSFW. There was not yet a port to Tensorflow.js, and thus this project was born.

<br>

### Credits
 This project stands on the shoulders of giants. A huge thanks to the following for making it possible:
 - [Yahoo](https://github.com/yahoo/open_nsfw), for making their Caffe classification model open-source
 - [Marc Dietrichstein](https://github.com/mdietrichstein/tensorflow-open_nsfw), for porting OpenNSFW to TensorFlow 1
 - [Bosco Yung](https://github.com/bhky/opennsfw2), for porting the aforementioned TensorFlow model to TensorFlow 2.

<br>

### [Read the API documentation here](https://lukepfjo.github.io/OpenNSFW.js/)

<br>

### Usage:

```html
<script src="opennsfw.min.js"></script>  <!-- Or include it in your bundle -->

<script>
	async function classify_images() {
		const nsfw = new window.OpenNSFW();
		await nsfw.load();

		// this.prime() speeds up subsequent classifications, but it's not helpful
		// here as we're immediately classifying an image after the model loads
		// await opennsfw.prime();

		const images  = document.querySelectorAll('img');		
		const results = await nsfw.classifyImages(images)

		let img_index = 0;
		for (let result of results) {
			const new_text = document.createElement('h4');
			const confidence = (result.nsfw_confidence * 100).toFixed(4);

			new_text.innerText = `${result.is_nsfw ? 'NSFW' : 'SFW'} - (${confidence}%)`;

			images[img_index].parentElement.appendChild(new_text);
			img_index++;
		}
	}

	document.addEventListener('DOMContentLoaded', classify_images);
</script>

<!-- (...) -->

<div><img src="img-1.jpg"></div>
<div><img src="img-2.jpg"></div>
```
