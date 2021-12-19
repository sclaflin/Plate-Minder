import RawImage from './RawImage.js';

export default class ImageFilter {
	next(rawImage) {
		if(!(rawImage instanceof RawImage))
			throw new TypeError('rawImage must be an instance of RawImage.');
		
		return rawImage;
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');
		
		return new this();
	}
}