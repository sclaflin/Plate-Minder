import PlateRecorder from './PlateRecorder.js';
import RTSPToALPR from './RTSPToALPR.js';
import SQLitePlateRecorder from './SQLitePlateRecorder.js';

export default class PlateMinder {
	#rtspToAlpr = null;
	#recorders = [];

	constructor(rtspToAlpr, recorders) {
		if(!(rtspToAlpr instanceof RTSPToALPR))
			throw new TypeError('rtspToAlpr must be an instance of RTSPToALPR.');
		if(!Array.isArray(recorders))
			throw new TypeError('recorders must be an array.');
		for(const recorder of recorders) {
			if(!(recorder instanceof PlateRecorder))
				throw new TypeError('recorders array must only contain instances of PlateRecorder.');
		}

		this.#rtspToAlpr = rtspToAlpr;
		this.#recorders.push(...recorders);
		for(const recorder of this.#recorders)
			recorder.rtspToAlpr = this.#rtspToAlpr;
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');
		
		return new this(
			RTSPToALPR.fromObject(config.rtspToAlpr),
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