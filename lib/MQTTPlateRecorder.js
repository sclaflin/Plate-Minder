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
		
		mqttOptions = {
			...mqttOptions,
			will: {
				topic: 'plate-minder/available',
				payload: 'offline',
				retain: true
			}
		}
		this.#client = connect(url, mqttOptions);
		this.#client.on('connect', () => {
			this.#client.publish(
				'plate-minder/available',
				'online'
			);
		});
		this.#client.on('error', err => {
			throw err;
		});
	}
	async record(data, rawImage) {
		const { epoch_time, results } = data;
		
		for(const result of results) {
			const { jpeg } = result;
			//strip the jpeg from the result since it's 
			//potentially a lot of data that we're already
			//going to output in it's own topic.
			delete result.jpeg;
			
			this.#client.publish(
				'plate-minder/plate',
				result.plate,
				{ retain: true }
			);
			this.#client.publish(
				'plate-minder/image',
				jpeg,
				{ retain: true }
			);
		}
		this.#client.publish(
			'plate-minder/detect',
			JSON.stringify({
				epoch_time,
				results
			}),
			{ retain: true }
		);
		
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