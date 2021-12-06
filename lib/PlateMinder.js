import PlateRecorder from './PlateRecorder.js';
import MJPEGToALPR from './MJPEGToALPR.js';
import SQLitePlateRecorder from './SQLitePlateRecorder.js';

export default class PlateMinder {
	#mjpegToAlpr = null;
	#recorders = [];

	constructor(mjpegToAlpr, recorders) {
		if(!(mjpegToAlpr instanceof MJPEGToALPR))
			throw new TypeError('mjpegToAlpr must be an instance of MJPEGToALPR.');
		if(!Array.isArray(recorders))
			throw new TypeError('recorders must be an array.');
		for(const recorder of recorders) {
			if(!(recorder instanceof PlateRecorder))
				throw new TypeError('recorders array must only contain instances of PlateRecorder.');
		}

		this.#mjpegToAlpr = mjpegToAlpr;
		this.#recorders.push(...recorders);
		for(const recorder of this.#recorders)
			recorder.mjpegToAlpr = this.#mjpegToAlpr;
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');
		
		return new this(
			MJPEGToALPR.fromObject(config.mjpegToAlpr),
			config.recorders.map(v => {
				switch(v.type) {
					case 'sqlite':
						return SQLitePlateRecorder.fromObject(v);
					case 'mqtt':
						return MQTTPlateRecorder.fromObject(v);
					default:
						throw new Error('Invalid plate recorder type.');
				}
			})
		);
	}
}