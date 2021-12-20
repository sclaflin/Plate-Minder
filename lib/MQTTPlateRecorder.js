import { connect } from 'mqtt';
import PlateRecorder from './PlateRecorder.js';

export default class MQTTPlateRecorder extends PlateRecorder {
	#client = null;
	
	constructor(url, mqttOptions) {
		super();
		if(typeof url !== 'string')
			throw new TypeError('url must be a string.');
		if(mqttOptions === null || typeof mqttOptions !== 'object')
			throw new TypeError('mqttOptions must be an Object.');
		
		this.#client = connect(url, mqttOptions);
		this.#client.on('error', err => {
			throw err;
		});
	}
	async record(data, jpeg) {
		const { epoch_time, results } = data;
		
		this.#client.publish('plate-minder/detect', JSON.stringify({
			epoch_time,
			results
		}));
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');
		
		return new this(
			config.url,
			config.mqttOptions
		)
	}
}