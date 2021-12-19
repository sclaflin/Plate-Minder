import fetch from 'node-fetch';
import Blob from 'fetch-blob';
import { FormData } from 'formdata-polyfill/esm.min.js';

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
	
	async detect(jpeg) {
		const formData  = new FormData();
		formData.append('upload', new Blob([jpeg]));
		formData.append('country_code', 'us');

		const response = await fetch(this.#url.href, {
			method: 'POST',
			body: formData
		});

		return await response.json();
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');
		return new this(
			new URL(config.url)
		);
	}
}