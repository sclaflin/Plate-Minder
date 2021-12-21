import { connect } from 'mqtt';
import { DEFAULT_MQTT_BASE_TOPIC } from './constants.js'
import PlateRecorder from './PlateRecorder.js';

export default class MQTTPlateRecorder extends PlateRecorder {
	#client = null;
	#baseTopic = null;
	
	constructor(url, baseTopic, mqttOptions) {
		super();
		if(typeof url !== 'string')
			throw new TypeError('url must be a string.');
		if(typeof baseTopic !== 'string')
			throw new TypeError('baseTopic must be a string.');
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
		this.#baseTopic = baseTopic;
		this.#client.on('connect', () => {
			this.#client.publish(
				`${this.#baseTopic}/available`,
				'online',
				{ retain: true }
			);
		});
		this.#client.on('error', err => {
			throw err;
		});
	}
	async record(data, source, original, filtered) {
		super.record(data, source, original, filtered);

		const { epoch_time, results } = data;
		
		for(const result of results) {
			const { jpeg } = result;
			//strip the jpeg from the result since it's 
			//potentially a lot of data that we're already
			//going to output in it's own topic.
			delete result.jpeg;
			
			this.#client.publish(
				`${this.#baseTopic}/${source.name}/plate`,
				result.plate,
				{ retain: true }
			);
			this.#client.publish(
				`${this.#baseTopic}/${source.name}/roi`,
				jpeg,
				{ retain: true }
			);
			this.#client.publish(
				`${this.#baseTopic}/${source.name}/image`,
				await original.toJpegBuffer(),
				{ retain: true }
			);
		}
		this.#client.publish(
			`${this.#baseTopic}/${source.name}/detect`,
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
			config.baseTopic || DEFAULT_MQTT_BASE_TOPIC,
			config.mqttOptions
		)
	}
}