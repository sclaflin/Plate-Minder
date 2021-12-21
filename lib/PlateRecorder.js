import EventEmitter from 'events';
import RawImage from './RawImage.js';

export default class PlateRecorder {
    record(data, original, filtered) {
        if(data === null || typeof data !== 'object')
			throw new TypeError('data must be an object.');
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