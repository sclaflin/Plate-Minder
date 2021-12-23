import express from 'express';
import bodyParser from 'body-parser';
import YAML from 'yaml';
import fs from 'fs/promises';
import { DEFAULT_REST_SERVER_PORT } from './constants.js';
import MJPEGReadable, { RestartingError } from './MJPEGReadable.js';
import ImageFilter from './ImageFilter.js';
import FileMJPEGReadable from './FileMJPEGReadable.js';
import RTSPMJPEGReadable from './RTSPMJPEGReadable.js';
import MaskImageFilter from './MaskImageFilter.js';
import OpenALPRDetect from './OpenALPRDetect.js';
import PlateRecorder from './PlateRecorder.js';
import MQTTPlateRecorder from './MQTTPlateRecorder.js';
import FilePlateRecorder from './FilePlateRecorder.js';


export class SourceDoesNotExist extends Error {}
export class FilterDoesNotExist extends Error {}
export class RecorderDoesNotExist extends Error {}

export default class RESTServer {
	#app = null;
	#port = null;
	#sources = null;
	#filters = null;
	#openAlprDetect = null;
	#recorders = null;
	constructor(port) {

		this.#app = express();
		this.app.use(bodyParser.json({ type: 'application/json' }));
		this.app.get('/config', (req, res) => this.getConfig(res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"captureInterval": 1}' localhost:5555/source/0/captureInterval
		this.app.put('/source/:index/captureInterval', (req, res) => this.updateSourceCaptureInterval(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"name": "Northbound"}' localhost:5555/source/0/name
		this.app.put('/source/:index/name', (req, res) => this.updateSourceName(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"file": "/path/to/my/file.mp4"}' localhost:5555/source/0/file
		this.app.put('/source/:index/file', (req, res) => this.updateSourceFile(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"url": "rtsp://mycamera"}' localhost:5555/source/0/url
		this.app.put('/source/:index/url', (req, res) => this.updateSourceUrl(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"debug": true}' localhost:5555/filter/0/debug
		this.app.put('/filter/:index/debug', (req, res) => this.updateFilterDebug(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"shapes": ["1267,0,1920,0,1920,100,1267,100"]}' localhost:5555/filter/0/shapes
		this.app.put('/filter/:index/shapes', (req, res) => this.updateFilterShapes(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"url": "http://open-alpr-http-wrapper:3000/detect"}' localhost:5555/openALPR/url
		this.app.put('/openALPR/url', (req, res) => this.updateOpenALPRUrl(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"url": "mqtt://mqtt.server"}' localhost:5555/recorder/0/url
		this.app.put('/recorder/:index/url', (req, res) => this.updateRecorderUrl(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"baseTopic": "plate-minder"}' localhost:5555/recorder/0/baseTopic
		this.app.put('/recorder/:index/baseTopic', (req, res) => this.updateRecorderBaseTopic(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"enable": true}' localhost:5555/recorder/0/hassDiscovery/enable
		this.app.put('/recorder/:index/hassDiscovery/enable', (req, res) => this.updateRecorderHassDiscoveryEnable(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"discoveryPrefix": "homeassistant"}' localhost:5555/recorder/0/hassDiscovery/discoveryPrefix
		this.app.put('/recorder/:index/hassDiscovery/discoveryPrefix', (req, res) => this.updateRecorderHassDiscoveryDiscoveryPrefix(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"mqttOptions": {"username": "myusername", "password": "mypassword"}}' localhost:5555/recorder/0/mqttOptions
		this.app.put('/recorder/:index/mqttOptions', (req, res) => this.updateRecorderMqttOptions(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"pattern": "./data/images/{{DATE}}/{{SOURCE}}/{{TIME}}_{{PLATE}}.jpeg"}' localhost:5555/recorder/0/pattern
		this.app.put('/recorder/:index/pattern', (req, res) => this.updateRecorderPattern(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"retainDays": 30}' localhost:5555/recorder/0/retainDays
		this.app.put('/recorder/:index/retainDays', (req, res) => this.updateRecorderRetainDays(req, res));

		this.port = port;
	}
	get app() {
		return this.#app;
	}
	get port() {
		return this.#port;
	}
	set port(v) {
		if(!Number.isInteger(v))
			throw new TypeError('port must be an integer.');
		this.#port = v;
	}
	async getConfig(res) {
		res.json(await this.readConfig());
	}
	async readConfig() {
		return YAML.parse(
			(await fs.readFile('config.yaml')).toString()
		);
	}
	async writeConfig(config) {
		await fs.writeFile('config.yaml', YAML.stringify(config));
	}
	async updateSourceCaptureInterval(req, res) {
		try {
			const { index } = req.params;
			const source = this.sources[index];
			const config = await this.readConfig();
			const configSource = config.sources[index];

			if(!source)
				throw new SourceDoesNotExist('Source does not exist.');
			
			const captureInterval = req.body.captureInterval;
			source.captureInterval = captureInterval;
			configSource.captureInterval = captureInterval;

			this.writeConfig(config);
			
			res.json('ok');
		}
		catch(err) {
			if(err instanceof SourceDoesNotExist)
				return res.status(404).json(err.message);
			if(err instanceof TypeError)
				return res.status(400).json(err.message);
			if(err instanceof RestartingError)
				return res.status(503).json(err.message);
			throw err;
		}
	}
	async updateSourceName(req, res) {
		try {
			const { index } = req.params;
			const source = this.sources[index];
			const config = await this.readConfig();
			const configSource = config.sources[index];
		
			if(!source)
				throw new SourceDoesNotExist('Source does not exist.');
			
			const name = req.body.name;
			source.name = name;
			configSource.name = name;

			this.writeConfig(config);
			
			res.json('ok');
		}
		catch(err) {
			if(err instanceof SourceDoesNotExist)
				return res.status(404).json(err.message);
			if(err instanceof TypeError)
				return res.status(400).json(err.message);
			throw err;
		}
	}
	async updateSourceFile(req, res) {
		try {
			const { index } = req.params;
			const source = this.sources[index];
			const config = await this.readConfig();
			const configSource = config.sources[index];
			
			if(!source)
				throw new SourceDoesNotExist('Source does not exist.');
			if(!(source instanceof FileMJPEGReadable))
				throw new TypeError('Source type must be "file".');
			
			const file = req.body.file;
			source.file = file;
			configSource.file = file;

			this.writeConfig(config);
			
			res.json('ok');
		}
		catch(err) {
			if(err instanceof SourceDoesNotExist)
				return res.status(404).json(err.message);
			if(err instanceof TypeError)
				return res.status(400).json(err.message);
			throw err;
		}
	}
	async updateSourceUrl(req, res) {
		try {
			const { index } = req.params;
			const source = this.sources[index];
			const config = await this.readConfig();
			const configSource = config.sources[index];
			
			if(!source)
				throw new SourceDoesNotExist('Source does not exist.');
			if(!(source instanceof RTSPMJPEGReadable))
				throw new TypeError('Source type must be "rtsp".');
			
			const url = new URL(req.body.url);
			source.url = url;
			configSource.url = url;

			this.writeConfig(config);
			
			res.json('ok');
		}
		catch(err) {
			if(err instanceof SourceDoesNotExist)
				return res.status(404).json(err.message);
			if(err instanceof TypeError)
				return res.status(400).json(err.message);
			throw err;
		}
	}
	async updateFilterDebug(req, res) {
		try {
			const { index } = req.params;
			const filter = this.filters[index];
			const config = await this.readConfig();
			const configFilter = config.filters[index];
		
			if(!filter)
				throw new FilterDoesNotExist('Filter does not exist.');
			
			const debug = req.body.debug;
			filter.debug = debug;
			configFilter.debug = debug;

			this.writeConfig(config);
			
			res.json('ok');
		}
		catch(err) {
			if(err instanceof FilterDoesNotExist)
				return res.status(404).json(err.message);
			if(err instanceof TypeError)
				return res.status(400).json(err.message);
			throw err;
		}
	}
	async updateFilterShapes(req, res) {
		try {
			const { index } = req.params;
			const filter = this.filters[index];
			const config = await this.readConfig();
			const configFilter = config.filters[index];
			
			if(!filter)
				throw new FilterDoesNotExist('Filter does not exist.');
			if(!(filter instanceof MaskImageFilter))
				throw new TypeError('filter type must be "mask".');
			if(!Array.isArray(req.body.shapes))
				throw new TypeError('shapes must be an Array.');
			
			filter.shapes = req.body.shapes.map(v =>
				new Uint16Array(
					v.split(',').map(v => parseInt(v, 10))
				)
			);
			configFilter.shapes = req.body.shapes;

			this.writeConfig(config);
			
			res.json('ok');
		}
		catch(err) {
			if(err instanceof FilterDoesNotExist)
				return res.status(404).json(err.message);
			if(err instanceof TypeError)
				return res.status(400).json(err.message);
			throw err;
		}
	}
	async updateOpenALPRUrl(req, res) {
		try {
			const config = await this.readConfig();
			
			const url = new URL(req.body.url);
			this.openAlprDetect.url = url;
			config.openALPR.url = req.body.url;	

			this.writeConfig(config);
			
			res.json('ok');
		}
		catch(err) {
			if(err instanceof TypeError)
				return res.status(400).json(err.message);
			throw err;
		}
	}
	async updateRecorderUrl(req, res) {
		try {
			const { index } = req.params;
			const recorder = this.recorders[index];
			const config = await this.readConfig();
			const configRecorder = config.recorders[index];
			
			if(!recorder)
				throw new RecorderDoesNotExist('Recorder does not exist.');
			if(!(recorder instanceof MQTTPlateRecorder))
				throw new TypeError('Recorder type must be "mqtt".');
			
			const url = new URL(req.body.url);
			recorder.url = url;
			configRecorder.url = url;

			this.writeConfig(config);
			await recorder.restart();
			
			res.json('ok');
		}
		catch(err) {
			if(err instanceof RecorderDoesNotExist)
				return res.status(404).json(err.message);
			if(err instanceof TypeError)
				return res.status(400).json(err.message);
			throw err;
		}
	}
	async updateRecorderBaseTopic(req, res) {
		try {
			const { index } = req.params;
			const recorder = this.recorders[index];
			const config = await this.readConfig();
			const configRecorder = config.recorders[index];
			
			if(!recorder)
				throw new RecorderDoesNotExist('Recorder does not exist.');
			if(!(recorder instanceof MQTTPlateRecorder))
				throw new TypeError('Recorder type must be "mqtt".');
			
			const baseTopic = req.body.baseTopic;
			recorder.baseTopic = baseTopic;
			configRecorder.baseTopic = baseTopic;

			await this.writeConfig(config);
			await recorder.restart();
			
			res.json('ok');
		}
		catch(err) {
			if(err instanceof RecorderDoesNotExist)
				return res.status(404).json(err.message);
			if(err instanceof TypeError)
				return res.status(400).json(err.message);
			throw err;
		}
	}
	async updateRecorderHassDiscoveryEnable(req, res) {
		try {
			const { index } = req.params;
			const recorder = this.recorders[index];
			const config = await this.readConfig();
			const configRecorder = config.recorders[index];
		
			if(!recorder)
				throw new RecorderDoesNotExist('Recorder does not exist.');
			if(!(recorder instanceof MQTTPlateRecorder))
				throw new TypeError('Recorder type must be "mqtt".');
			
			const enable = req.body.enable;
			recorder.hassDiscovery.enable = enable;
			configRecorder.hassDiscovery.enable = enable;

			this.writeConfig(config);
			
			res.json('ok');
		}
		catch(err) {
			if(err instanceof RecorderDoesNotExist)
				return res.status(404).json(err.message);
			if(err instanceof TypeError)
				return res.status(400).json(err.message);
			throw err;
		}
	}
	async updateRecorderHassDiscoveryDiscoveryPrefix(req, res) {
		try {
			const { index } = req.params;
			const recorder = this.recorders[index];
			const config = await this.readConfig();
			const configRecorder = config.recorders[index];
		
			if(!recorder)
				throw new RecorderDoesNotExist('Recorder does not exist.');
			if(!(recorder instanceof MQTTPlateRecorder))
				throw new TypeError('Recorder type must be "mqtt".');
			
			const discoveryPrefix = req.body.discoveryPrefix;
			recorder.hassDiscovery.discoveryPrefix = discoveryPrefix;
			configRecorder.hassDiscovery.discoveryPrefix = discoveryPrefix;

			this.writeConfig(config);
			
			res.json('ok');
		}
		catch(err) {
			if(err instanceof RecorderDoesNotExist)
				return res.status(404).json(err.message);
			if(err instanceof TypeError)
				return res.status(400).json(err.message);
			throw err;
		}
	}
	async updateRecorderMqttOptions(req, res) {
		try {
			const { index } = req.params;
			const recorder = this.recorders[index];
			const config = await this.readConfig();
			const configRecorder = config.recorders[index];
			
			if(!recorder)
				throw new RecorderDoesNotExist('Recorder does not exist.');
			if(!(recorder instanceof MQTTPlateRecorder))
				throw new TypeError('Recorder type must be "mqtt".');
			
			const mqttOptions = req.body.mqttOptions;
			recorder.mqttOptions = mqttOptions;
			configRecorder.mqttOptions = mqttOptions;

			await this.writeConfig(config);
			await recorder.restart();
			
			res.json('ok');
		}
		catch(err) {
			if(err instanceof RecorderDoesNotExist)
				return res.status(404).json(err.message);
			if(err instanceof TypeError)
				return res.status(400).json(err.message);
			throw err;
		}
	}
	async updateRecorderPattern(req, res) {
		try {
			const { index } = req.params;
			const recorder = this.recorders[index];
			const config = await this.readConfig();
			const configRecorder = config.recorders[index];
			
			if(!recorder)
				throw new RecorderDoesNotExist('Recorder does not exist.');
			if(!(recorder instanceof FilePlateRecorder))
				throw new TypeError('Recorder type must be "file".');
			
			const pattern = req.body.pattern;
			recorder.pattern = pattern;
			configRecorder.pattern = pattern;

			await this.writeConfig(config);
			
			res.json('ok');
		}
		catch(err) {
			if(err instanceof RecorderDoesNotExist)
				return res.status(404).json(err.message);
			if(err instanceof TypeError)
				return res.status(400).json(err.message);
			throw err;
		}
	}
	async updateRecorderRetainDays(req, res) {
		try {
			const { index } = req.params;
			const recorder = this.recorders[index];
			const config = await this.readConfig();
			const configRecorder = config.recorders[index];
			
			if(!recorder)
				throw new RecorderDoesNotExist('Recorder does not exist.');
			if(!(recorder instanceof FilePlateRecorder))
				throw new TypeError('Recorder type must be "file".');
			
			const retainDays = req.body.retainDays;
			recorder.retainDays = retainDays;
			configRecorder.retainDays = retainDays;

			await this.writeConfig(config);
			
			res.json('ok');
		}
		catch(err) {
			if(err instanceof RecorderDoesNotExist)
				return res.status(404).json(err.message);
			if(err instanceof TypeError)
				return res.status(400).json(err.message);
			throw err;
		}
	}
	listen() {
		this.app.listen(this.port);
	}
	get sources() {
		return this.#sources;
	}
	set sources(v) {
		if(!Array.isArray(v))
			throw new TypeError('sources must be an Array.');
		if(v.filter(source => !(source instanceof MJPEGReadable)).length > 0)
			throw new TypeError('All sources elements must be an instance of MJPEGReadable.');

		this.#sources = v;
	}
	get filters() {
		return this.#filters;
	}
	set filters(v) {
		if(!Array.isArray(v))
			throw new TypeError('filters must be an Array.');
		if(v.filter(filter => !(filter instanceof ImageFilter)).length > 0)
			throw new TypeError('All filters elements must be an instance of ImageFilter.');

		this.#filters = v;
	}
	get openAlprDetect() {
		return this.#openAlprDetect;
	}
	set openAlprDetect(v) {
		if(!(v instanceof OpenALPRDetect))
			throw new TypeError('openAlprDetect must be an instance of OpenALPRDetect.');
		this.#openAlprDetect = v;
	}
	get recorders() {
		return this.#recorders;
	}
	set recorders(v) {
		if(!Array.isArray(v))
			throw new TypeError('recorders must be an Array.');
		if(v.filter(recorder => !(recorder instanceof PlateRecorder)).length > 0)
			throw new TypeError('All recorders elements must be an instance of PlateRecorder.');

		this.#recorders = v;
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');

		return new this(
			config.port || DEFAULT_REST_SERVER_PORT
		);
	}
}
