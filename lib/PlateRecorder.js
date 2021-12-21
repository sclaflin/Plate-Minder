import MJPEGReadable from './MJPEGReadable.js';
import RawImage from './RawImage.js';

export default class PlateRecorder {
    record(data, source, original, filtered) {
        if(data === null || typeof data !== 'object')
			throw new TypeError('data must be an object.');
		if(!(source instanceof MJPEGReadable))
			throw new TypeError('source must be an instance of MJPEGReadable.');
		if(!(original instanceof RawImage))
			throw new TypeError('original must be an instance of RawImage.');
		if(!(filtered instanceof RawImage))
			throw new TypeError('filtered must be an instance of RawImage.');
    }
    static fromObject(config) {
        if(config === null || typeof config !== 'object')
            throw new TypeError('config must be an Object.');
        
        return new this();
    }
}
