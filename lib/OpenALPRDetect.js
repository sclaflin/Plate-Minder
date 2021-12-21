import fetch from 'node-fetch';
import Blob from 'fetch-blob';
import { FormData } from 'formdata-polyfill/esm.min.js';
import RawImage from './RawImage.js';

export default class OpenALPRDetect {
	#url = null;

	constructor(url) {
		if(!(url instanceof URL))
			throw new TypeError('url must be an instance of URL.');

		this.#url = url;
	}
	get url() {
		return this.#url;
	}
	
	async detect(rawImage) {
		const formData  = new FormData();
		formData.append('upload', new Blob([await rawImage.toJpegBuffer()]));
		formData.append('country_code', 'us');

		const response = await fetch(this.#url.href, {
			method: 'POST',
			body: formData
		});

		const data = await response.json();

		for(const result of data.results) {
			const rect = result.coordinates.reduce((prev, curr) => {
				const left = (prev.left === -1 || curr.x < prev.left) ? curr.x : prev.left;
				const top = (prev.top === -1 || curr.y < prev.top) ? curr.y : prev.top;
				prev.left = left < 0 ? 0 : left;
				prev.top = top < 0 ? 0 : top;

				const width = curr.x - prev.left > prev.width ? curr.x - prev.left : prev.width;
				const height = curr.y - prev.top > prev.height ? curr.y - prev.top : prev.height;
				prev.width = width + prev.left > rawImage.width ? rawImage.width - prev.left : width;
				prev.height = height + prev.top > rawImage.height ? rawImage.height - prev.top : height;

				return prev;
			}, { left: -1, top: -1, width: 0, height: 0 });

			const roi = await rawImage.roi(rect.left, rect.top, rect.width, rect.height);
			const buff = await roi.toJpegBuffer();
			result.jpeg = buff;
		}

		return data;
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');
		return new this(
			new URL(config.url)
		);
	}
}