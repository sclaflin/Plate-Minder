import EventEmitter from 'events';
import MJPEGToALPR from "./MJPEGToALPR.js";

export default class PlateRecorder extends EventEmitter {
    #mjpegToAlpr = null;
	#detectListener = null;

    constructor() {
		super();
		
		this.#detectListener = (data, jpeg) => this.record(data, jpeg);
    }
	get mjpegToAlpr() {
		return this.#mjpegToAlpr;
	}
	set mjpegToAlpr(v) {
		if(!(v instanceof MJPEGToALPR))
			throw new TypeError('mjpegToAlpr must be an instance of MJPEGToALPR.');
		if(this.#mjpegToAlpr)
			this.#mjpegToAlpr.removeListener('detect', this.#detectListener);
		this.#mjpegToAlpr = v;
		this.#mjpegToAlpr.on('detect', this.#detectListener);
	}
    record(data, jpeg) {
        throw new Error('Implement a record method here.');
    }
    static fromObject(config) {
        if(config === null || typeof config !== 'object')
            throw new TypeError('config must be an Object.');
        
        return new this();
    }
}