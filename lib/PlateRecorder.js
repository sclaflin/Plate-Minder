import EventEmitter from 'events';
import RTSPToALPR from "./RTSPToALPR.js";

export default class PlateRecorder extends EventEmitter {
    #rtspToAlpr = null;
	#detectListener = null;

    constructor() {
		super();
		
		this.#detectListener = (data, jpeg) => this.record(data, jpeg);
    }
	get rtspToAlpr() {
		return this.#rtspToAlpr;
	}
	set rtspToAlpr(v) {
		if(!(v instanceof RTSPToALPR))
			throw new TypeError('rtspToAlpr must be an instance of RTSPToALPR.');
		if(this.#rtspToAlpr)
			this.#rtspToAlpr.removeListener('detect', this.#detectListener);
		this.#rtspToAlpr = v;
		this.#rtspToAlpr.on('detect', this.#detectListener);
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