import { connect } from 'mqtt';
import {
	DEFAULT_MQTT_BASE_TOPIC,
	DEFAULT_HASS_DISCOVERY_PREFIX,
	DEFAULT_HASS_DISCOVERY_ENABLE
} from './constants.js';
import PlateRecorder from './PlateRecorder.js';

export class HassDiscovery {
	#enable = null;
	#discoveryPrefix = null;
	constructor(enable, discoveryPrefix) {
		
		this.enable = enable;
		this.discoveryPrefix = discoveryPrefix;
	}
	get enable() {
		return this.#enable;
	}
	set enable(v) {
		if(typeof v !== 'boolean')
			throw new TypeError('enable must be a boolean.');
		this.#enable = v;
	}
	get discoveryPrefix() {
		return this.#discoveryPrefix;
	}
	set discoveryPrefix(v) {
		if(typeof v !== 'string')
			throw new TypeError('discoveryPrefix must be a string.');
		this.#discoveryPrefix = v;
	}
	toJSON() {
		return {
			enable: this.enable,
			discoveryPrefix: this.discoveryPrefix
		};
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');
		return new this(
			config.enable !== undefined ? config.enable : DEFAULT_HASS_DISCOVERY_ENABLE,
			config.discoveryPrefix || DEFAULT_HASS_DISCOVERY_PREFIX
		);
	}
}

export default class MQTTPlateRecorder extends PlateRecorder {
	#client = null;
	#url = null;
	#baseTopic = null;
	#hassDiscovery = null;
	#mqttOptions = null;
	#clientConnect = null;
	#clientError = null;
	#clientEnd = null;
	
	constructor(url, baseTopic, hassDiscovery, mqttOptions) {
		super();
		
		this.url = url;
		this.baseTopic = baseTopic;
		this.hassDiscovery = hassDiscovery;
		this.mqttOptions = mqttOptions;

		this.#clientConnect = () => {
			this.#client.publish(
				`${this.baseTopic}/available`,
				'online',
				{ retain: true }
			);
		};
		this.#clientError = err => console.error(err);
		this.#clientEnd = () => {
			this.#client.off('connect', this.#clientConnect);
			this.#client.off('error', this.#clientError);
			this.#client.off('end', this.#clientEnd);
			this.#client = null;
		};
	}
	start() {
		if(this.#client)
			throw new Error('Client is already started.');
		this.#client = connect(this.url.toString(), {
			...this.mqttOptions,
			will: {
				topic: `${this.baseTopic}/available`,
				payload: 'offline',
				retain: true
			}
		});
		this.#client.on('connect', this.#clientConnect);
		this.#client.on('error', this.#clientError);
		this.#client.on('end', this.#clientEnd);
	}
	async stop() {
		await new Promise(resolve =>  {
			this.#client.publish(
				`${this.baseTopic}/available`,
				'offline',
				{ retain: true }
			);
			this.#client.end(resolve);
		});
	}
	async restart() {
		if(this.#client)
			await this.stop();
		this.start();
	}
	get url() {
		return this.#url;
	}
	set url(v) {
		if(!(v instanceof URL))
			throw new TypeError('url must be an instance of URL.');
		this.#url = v;
	}
	get baseTopic() {
		return this.#baseTopic;
	}
	set baseTopic(v) {
		if(typeof v !== 'string')
			throw new TypeError('baseTopic must be a string.');
		
		const lastBaseTopic = this.baseTopic;
		this.#baseTopic = v;
		if(this.#client) {
			this.#client.publish(
				`${lastBaseTopic}/available`,
				undefined,
				{ retain: true }
			);
			this.#client.publish(
				`${this.baseTopic}/available`,
				'online',
				{ retain: true }
			);
		}
		
	}
	get hassDiscovery() {
		return this.#hassDiscovery;
	}
	set hassDiscovery(v) {
		if(!(v instanceof HassDiscovery))
			throw new TypeError('hassDiscovery must be an instance of HassDiscovery.');
		this.#hassDiscovery = v;
	}
	get mqttOptions() {
		return this.#mqttOptions;
	}
	set mqttOptions(v) {
		if(v === null || typeof v !== 'object')
			throw new TypeError('mqttOptions must be an Object.');
		this.#mqttOptions = v;
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
				`${this.baseTopic}/${source.name}/plate`,
				result.plate
			);
			this.#client.publish(
				`${this.baseTopic}/${source.name}/roi`,
				jpeg
			);
			this.#client.publish(
				`${this.baseTopic}/${source.name}/image`,
				await original.toJpegBuffer()
			);
		}
		this.#client.publish(
			`${this.baseTopic}/${source.name}/detect`,
			JSON.stringify({
				epoch_time,
				results
			})
		);
		
		// Handle Home Assistant Auto Discovery
		if(this.hassDiscovery.enable) {
			this.#client.publish(
				`${this.hassDiscovery.discoveryPrefix}/sensor/${source.name.replace(/[^A-Za-z0-9_-]/, '_')}_plate/config`,
				JSON.stringify({
					availability: [
						{
							topic: `${this.baseTopic}/available`
						}
					],
					icon: 'mdi:car',
					state_topic: `${this.baseTopic}/${source.name}/plate`,
					unique_id: `plate-minder_${source.name.replace(/[^A-Za-z0-9_-]./, '_')}_plate`,
					name: `${source.name} Plate`
				})
			);
			this.#client.publish(
				`${this.hassDiscovery.discoveryPrefix}/camera/${source.name.replace(/[^A-Za-z0-9_-]/, '_')}_image/config`,
				JSON.stringify({
					availability: [
						{
							topic: `${this.baseTopic}/available`
						}
					],
					topic: `${this.baseTopic}/${source.name}/image`,
					unique_id: `plate-minder_${source.name.replace(/[^A-Za-z0-9_-]./, '_')}_image`,
					name: `${source.name} Image`
				})
			);
			this.#client.publish(
				`${this.hassDiscovery.discoveryPrefix}/camera/${source.name.replace(/[^A-Za-z0-9_-]/, '_')}_roi/config`,
				JSON.stringify({
					availability: [
						{
							topic: `${this.baseTopic}/available`
						}
					],
					topic: `${this.baseTopic}/${source.name}/roi`,
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
			new URL(config.url),
			config.baseTopic || DEFAULT_MQTT_BASE_TOPIC,
			HassDiscovery.fromObject(config.hassDiscovery || {}),
			config.mqttOptions
		);
	}
}
