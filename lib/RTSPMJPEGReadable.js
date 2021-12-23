import MJPEGReadable from './MJPEGReadable.js';

export default class RTSPMJPEGReadable extends MJPEGReadable {
	#url = null;
	
	constructor(name, captureInterval, url) {
		super(name, captureInterval);

		
		this.url = url;
		this.ffmpegInputArgs.length = 0;
		this.ffmpegInputArgs.push('-i', this.#url.href);
	}
	get url() {
		return this.#url;
	}
	set url(v) {
		if(!(v instanceof URL))
			throw new TypeError('url must be an instance of URL.');
		this.#url = v;
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an object.');

		return new this(
			config.name,
			config.captureInterval,
			new URL(config.url)
		);
	}
}
