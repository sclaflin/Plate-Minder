import { connect } from 'mqtt';
import { DEFAULT_MQTT_BASE_TOPIC, DEFAULT_HASS_DISCOVERY_PREFIX } from './constants.js';
import PlateRecorder from './PlateRecorder.js';

export class HassDiscovery {
	#discoveryPrefix = null;
	constructor(discoveryPrefix) {
		if(typeof discoveryPrefix !== 'string')
			throw new TypeError('discoveryPrefix must be a string.');

		this.#discoveryPrefix = discoveryPrefix;
	}
	get discoveryPrefix() {
		return this.#discoveryPrefix;
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');
		return new this(
			config.discoveryPrefix || DEFAULT_HASS_DISCOVERY_PREFIX
		);
	}
}

export default class MQTTPlateRecorder extends PlateRecorder {
	#client = null;
	#baseTopic = null;
	#hassDiscovery = null;
	
	constructor(url, baseTopic, hassDiscovery, mqttOptions) {
		super();
		if(typeof url !== 'string')
			throw new TypeError('url must be a string.');
		if(typeof baseTopic !== 'string')
			throw new TypeError('baseTopic must be a string.');
		if(hassDiscovery !== null && !(hassDiscovery instanceof HassDiscovery))
			throw new TypeError('hassDiscovery must be an instance of HassDiscovery.');
		if(mqttOptions === null || typeof mqttOptions !== 'object')
			throw new TypeError('mqttOptions must be an Object.');
		
		mqttOptions = {
			...mqttOptions,
			will: {
				topic: 'plate-minder/available',
				payload: 'offline',
				retain: true
			}
		};
		this.#client = connect(url, mqttOptions);
		this.#baseTopic = baseTopic;
		this.#hassDiscovery = hassDiscovery;
		this.initMQTT();
	}
	initMQTT() {
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
		
		// Handle Home Assistant Auto Discovery
		if(this.#hassDiscovery) {
			this.#client.publish(
				`${this.#hassDiscovery.discoveryPrefix}/sensor/${source.name}_plate/config`,
				JSON.stringify({
					availability: [
						{
							topic: `${this.#baseTopic}/available`
						}
					],
					icon: 'mdi:car',
					state_topic: `${this.#baseTopic}/${source.name}/plate`,
					unique_id: `plate-minder_${source.name.replace(/[^A-Za-z0-9_-]./, '_')}_plate`,
					name: `${source.name} Plate`
				})
			);
			this.#client.publish(
				`${this.#hassDiscovery.discoveryPrefix}/camera/${source.name}_image/config`,
				JSON.stringify({
					availability: [
						{
							topic: `${this.#baseTopic}/available`
						}
					],
					topic: `${this.#baseTopic}/${source.name}/image`,
					unique_id: `plate-minder_${source.name.replace(/[^A-Za-z0-9_-]./, '_')}_image`,
					name: `${source.name} Image`
				})
			);
			this.#client.publish(
				`${this.#hassDiscovery.discoveryPrefix}/camera/${source.name}_roi/config`,
				JSON.stringify({
					availability: [
						{
							topic: `${this.#baseTopic}/available`
						}
					],
					topic: `${this.#baseTopic}/${source.name}/roi`,
					unique_id: `plate-minder_${source.name.replace(/[^A-Za-z0-9_-]./, '_')}_roi`,
					name: `${source.name} ROI`
				})
			);
		}
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');
		
		return new this(
			config.url,
			config.baseTopic || DEFAULT_MQTT_BASE_TOPIC,
			config.hassDiscovery !== undefined ? 
				HassDiscovery.fromObject(config.hassDiscovery || {}) :
				null,
			config.mqttOptions
		);
	}
}
