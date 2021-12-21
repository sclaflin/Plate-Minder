import RawImage from './RawImage.js';

export default class ImageFilter {
	#debug = false;
	constructor(debug) {
		this.debug = debug;
	}
	get debug() {
		return this.#debug;
	}
	set debug(v) {
		if(typeof v !== 'boolean')
			throw new TypeError('debug must be a boolean.');
		this.#debug = v;
	}
	next(rawImage) {
		if(!(rawImage instanceof RawImage))
			throw new TypeError('rawImage must be an instance of RawImage.');
		
		return rawImage;
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');
		
		return new this(
			!!config.debug
		);
	}
}
