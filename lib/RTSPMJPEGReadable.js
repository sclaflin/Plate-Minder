import MJPEGReadable from './MJPEGReadable.js';

export default class RTSPMJPEGReadable extends MJPEGReadable {
	#url = null;
	
	get url() {
		return this.#url;
	}
	set url(v) {
		if(!(v instanceof URL))
			throw new TypeError('url must be an instance of URL.');
		
		this.#url = v;
		this.inputArgs.clear();
		this.inputArgs.add('-i', this.#url.href);

		if(this.running)
			this.restart();
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an object.');

		const obj = MJPEGReadable.fromObject.call(this, config);
		obj.url = new URL(config.url);

		return obj;
	}
}
