import MJPEGReadable from './MJPEGReadable.js';

export default class RTSPMJPEGReadable extends MJPEGReadable {
	#url = null;
	
	constructor(captureInterval, url) {
		super(captureInterval);

		if(!(url instanceof URL))
			throw new TypeError('url must be an instance of URL.');
		
		this.#url = url;
		this.ffmpegInputArgs.length = 0;
		this.ffmpegInputArgs.push('-i', this.#url.href);
	}
	get url() {
		return this.#url;
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an object.');

		return new this(
			config.captureInterval,
			new URL(config.url)
		);
	}
}
