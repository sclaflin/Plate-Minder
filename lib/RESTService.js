import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import YAML from 'yaml';
import fs from 'fs/promises';
import { DEFAULT_CONFIG, DEFAULT_REST_SERVER_ENABLE, DEFAULT_REST_SERVER_PORT } from './constants.js';
import { RestartingError } from './MJPEGReadable.js';
import FileMJPEGReadable from './FileMJPEGReadable.js';
import RTSPMJPEGReadable from './RTSPMJPEGReadable.js';
import MaskImageFilter from './MaskImageFilter.js';
import OpenALPRDetect from './OpenALPRDetect.js';
import MQTTPlateRecorder, { HassDiscovery } from './MQTTPlateRecorder.js';
import FilePlateRecorder from './FilePlateRecorder.js';
import MJPEGReadables from './MJPEGReadables.js';
import ImageFilters from './ImageFilters.js';
import PlateRecorders from './PlateRecorders.js';
import MotionImageFilter from './MotionImageFilter.js';
import SQLitePlateRecorder from './SQLitePlateRecorder.js';


export class SourceDoesNotExist extends Error {}
export class FilterDoesNotExist extends Error {}
export class RecorderDoesNotExist extends Error {}

export default class RESTService {
	#app = null;
	#server = null;
	#port = null;
	#enable = null;
	#sources = null;
	#filters = null;
	#openAlprDetect = null;
	#recorders = null;
	constructor(port, enable) {

		this.#app = express();
		this.app.use((req, res, next) => {
			// Disable the loading of any resources and disable framing, recommended for APIs to use
			res.setHeader('Content-Security-Policy', 'default-src \'none\'; frame-ancestors \'none\'');
			// Set HSTS header.  Instructs browsers to always connect via HTTPS, for all sub-domains.
			// Also add this site to a "preload" list for browser vendors
			// res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
			// Tell browser not to accidentally sniff non-scripts as scripts
			res.setHeader('X-Content-Type-Options', 'nosniff');
			// Block site from being framed
			res.setHeader('X-Frame-Options', 'DENY');
			// Block pages from loading when they detect reflected XSS attacks
			res.setHeader('X-XSS-Protection', '1; mode=block');
			next();
		});
		this.app.disable('x-powered-by');
		this.app.use(cors());
		this.app.use(bodyParser.json({ type: 'application/json' }));
		this.app.get('/config', (req, res) => this.getConfig(res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"type": "file", "name": "Southbound", "file": "./videos/lpr.20211205_160218_1.mp4", "captureInterval": 1}' localhost:5555/source
		this.app.put('/source', (req, res) => this.addSource(req, res));
		//curl -X DELETE -H "Content-Type: application/json" localhost:5555/source/0
		this.app.delete('/source/:index', (req, res) => this.removeSource(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"captureInterval": 1}' localhost:5555/source/0/captureInterval
		this.app.put('/source/:index/captureInterval', (req, res) => this.updateSourceCaptureInterval(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"name": "Northbound"}' localhost:5555/source/0/name
		this.app.put('/source/:index/name', (req, res) => this.updateSourceName(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"preInputArgs": ["-hwaccel", "qsv", "-c:v", "h264_qsv"]}' localhost:5555/source/0/preInputArgs
		this.app.put('/source/:index/preInputArgs', (req, res) => this.updateSourcePreInputArgs(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"preOutputArgs": ["-c:v", "mjpeg_qsv"]}' localhost:5555/source/0/preOutputArgs
		this.app.put('/source/:index/preOutputArgs', (req, res) => this.updateSourcePreOutputArgs(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"file": "/path/to/my/file.mp4"}' localhost:5555/source/0/file
		this.app.put('/source/:index/file', (req, res) => this.updateSourceFile(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"url": "rtsp://mycamera"}' localhost:5555/source/0/url
		this.app.put('/source/:index/url', (req, res) => this.updateSourceUrl(req, res));
		//curl -X GET -H "Content-Type: application/json" localhost:5555/source/0/status
		this.app.get('/source/:index/status', (req, res) => this.getSourceStatus(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"run": true}' localhost:5555/source/0/run
		this.app.put('/source/:index/run', (req, res) => this.updateSourceRun(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"type": "motion", "debug": true}' localhost:5555/filter
		this.app.put('/filter', (req, res) => this.addFilter(req, res));
		//curl -X DELETE -H "Content-Type: application/json" localhost:5555/filter/0
		this.app.delete('/filter/:index', (req, res) => this.removeFilter(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"debug": true}' localhost:5555/filter/0/debug
		this.app.put('/filter/:index/debug', (req, res) => this.updateFilterDebug(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"shapes": ["1267,0,1920,0,1920,100,1267,100"]}' localhost:5555/filter/0/shapes
		this.app.put('/filter/:index/shapes', (req, res) => this.updateFilterShapes(req, res));
		//curl -X GET -H "Content-Type: application/json" localhost:5555/filter/0/debugImage
		this.app.get('/filter/:index/debugImage', (req, res) => this.getFilterDebugImage(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"url": "http://open-alpr-http-wrapper:3000/detect"}' localhost:5555/openALPR/url
		this.app.put('/openALPR/url', (req, res) => this.updateOpenALPRUrl(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"type": "file", "pattern": "./data/images/{{DATE}}/{{SOURCE}}/{{TIME}}_{{PLATE}}.jpeg", "retainDays": 5}' localhost:5555/recorder
		this.app.put('/recorder', (req, res) => this.addRecorder(req, res));
		//curl -X DELETE -H "Content-Type: application/json" localhost:5555/recorder/0
		this.app.delete('/recorder/:index', (req, res) => this.removeRecorder(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"url": "mqtt://mqtt.server"}' localhost:5555/recorder/0/url
		this.app.put('/recorder/:index/url', (req, res) => this.updateRecorderUrl(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"baseTopic": "plate-minder"}' localhost:5555/recorder/0/baseTopic
		this.app.put('/recorder/:index/baseTopic', (req, res) => this.updateRecorderBaseTopic(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"hassDiscovery": {"enable": true, "discoveryPrefix": "homeassistant"}}' localhost:5555/recorder/0/hassDiscovery
		this.app.put('/recorder/:index/hassDiscovery', (req, res) => this.updateRecorderHassDiscovery(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"mqttOptions": {"username": "myusername", "password": "mypassword"}}' localhost:5555/recorder/0/mqttOptions
		this.app.put('/recorder/:index/mqttOptions', (req, res) => this.updateRecorderMqttOptions(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"pattern": "./data/images/{{DATE}}/{{SOURCE}}/{{TIME}}_{{PLATE}}.jpeg"}' localhost:5555/recorder/0/pattern
		this.app.put('/recorder/:index/pattern', (req, res) => this.updateRecorderPattern(req, res));
		//curl -X PUT -H "Content-Type: application/json" -d '{"retainDays": 30}' localhost:5555/recorder/0/retainDays
		this.app.put('/recorder/:index/retainDays', (req, res) => this.updateRecorderRetainDays(req, res));

		this.port = port;
		this.enable = enable;
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
	get enable() {
		return this.#enable;
	}
	set enable(v) {
		if(typeof v !== 'boolean')
			throw new TypeError('enable must be a boolean.');
		this.#enable = v;

		if(this.enable)
			this.#server = this.app.listen(this.port);
		else if(this.#server) {
			this.#server.close();
			this.#server = null;
		}
	}
	async getConfig(res) {
		res.json(await this.readConfig());
	}
	async readConfig() {
		return YAML.parse(
			(await fs.readFile('config.yaml')).toString()
		) || DEFAULT_CONFIG;
	}
	async writeConfig(config) {
		await fs.writeFile('config.yaml', YAML.stringify(config));
	}
	async addSource(req, res) {
		try {
			let source = null;
			switch(req.body.type) {
				case 'rtsp':
					source = RTSPMJPEGReadable.fromObject(req.body);
					break;
				case 'file':
					source = FileMJPEGReadable.fromObject(req.body);
					break;
				default:
					throw new TypeError('Unrecognized source type.');
			}

			const config = await this.readConfig();
			this.sources.add(source);
			config.sources.push(req.body);

			await this.writeConfig(config);
			
			res.json('ok');
		}
		catch(err) {
			if(err instanceof TypeError)
				return res.status(400).json(err.message);
			throw err;
		}
	}
	async removeSource(req, res) {
		try {
			const { index } = req.params;
			const source = this.sources.get(index);
			const config = await this.readConfig();
			const configSource = config.sources[index];

			if(!source)
				throw new SourceDoesNotExist('Source does not exist.');
			
			this.sources.remove(source);
			config.sources.splice(config.sources.indexOf(configSource), 1);

			await this.writeConfig(config);
			
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
	async updateSourceCaptureInterval(req, res) {
		try {
			const { index } = req.params;
			const source = this.sources.get(index);
			const config = await this.readConfig();
			const configSource = config.sources[index];

			if(!source)
				throw new SourceDoesNotExist('Source does not exist.');
			
			const captureInterval = req.body.captureInterval;
			source.captureInterval = captureInterval;
			configSource.captureInterval = captureInterval;

			await this.writeConfig(config);
			
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
			const source = this.sources.get(index);
			const config = await this.readConfig();
			const configSource = config.sources[index];
		
			if(!source)
				throw new SourceDoesNotExist('Source does not exist.');
			
			const name = req.body.name;
			source.name = name;
			configSource.name = name;

			await this.writeConfig(config);
			
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
	async updateSourcePreInputArgs(req, res) {
		try {
			const { index } = req.params;
			const source = this.sources.get(index);
			const config = await this.readConfig();
			const configSource = config.sources[index];
			
			if(!source)
				throw new SourceDoesNotExist('Source does not exist.');
			if(!Array.isArray(req.body.preInputArgs))
				throw new TypeError('preInputArgs must be an Array.');
			
			source.preInputArgs.clear();
			source.preInputArgs.add(...req.body.preInputArgs);
			configSource.preInputArgs = req.body.preInputArgs;

			await this.writeConfig(config);
			
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
	async updateSourcePreOutputArgs(req, res) {
		try {
			const { index } = req.params;
			const source = this.sources.get(index);
			const config = await this.readConfig();
			const configSource = config.sources[index];
			
			if(!source)
				throw new SourceDoesNotExist('Source does not exist.');
			if(!Array.isArray(req.body.preOutputArgs))
				throw new TypeError('preOutputArgs must be an Array.');
			
			source.preOutputArgs.clear();
			source.preOutputArgs.add(...req.body.preOutputArgs);
			configSource.preOutputArgs = req.body.preOutputArgs;

			await this.writeConfig(config);
			
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
			const source = this.sources.get(index);
			const config = await this.readConfig();
			const configSource = config.sources[index];
			
			if(!source)
				throw new SourceDoesNotExist('Source does not exist.');
			if(!(source instanceof FileMJPEGReadable))
				throw new TypeError('Source type must be "file".');
			
			const file = req.body.file;
			source.file = file;
			configSource.file = file;

			await this.writeConfig(config);
			
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
			const source = this.sources.get(index);
			const config = await this.readConfig();
			const configSource = config.sources[index];
			
			if(!source)
				throw new SourceDoesNotExist('Source does not exist.');
			if(!(source instanceof RTSPMJPEGReadable))
				throw new TypeError('Source type must be "rtsp".');
			
			const url = new URL(req.body.url);
			source.url = url;
			configSource.url = url;

			await this.writeConfig(config);
			
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
	async getSourceStatus(req, res) {
		try {
			const { index } = req.params;
			const source = this.sources.get(index);
			
			if(!source)
				throw new SourceDoesNotExist('Source does not exist.');

			const data = {
				running: source.running,
				restarting: source.restarting,
				errText: source.errText
			};
			res.set('Content-Type', 'application/json');
			res.json(data);
		}
		catch(err) {
			console.error(err);
			if(err instanceof SourceDoesNotExist)
				return res.status(404).json(err.message);
			if(err instanceof TypeError)
				return res.status(400).json(err.message);
			throw err;
		}
	}
	async updateSourceRun(req, res) {
		try {
			const { index } = req.params;
			const source = this.sources.get(index);
			
			if(!source)
				throw new SourceDoesNotExist('Source does not exist.');
			
			const run = req.body.run;
			if(run) {
				if(source.running)
					source.restart();
				else source.start();
			} else source.stop();
			
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
	async addFilter(req, res) {
		try {
			let filter = null;
			switch(req.body.type) {
				case 'mask':
					filter = MaskImageFilter.fromObject(req.body);
					break;
				case 'motion':
					filter = MotionImageFilter.fromObject(req.body);
					break;
				default:
					throw new TypeError('Unrecognized filter type.');
			}

			const config = await this.readConfig();
			this.filters.add(filter);
			config.filters.push(req.body);

			await this.writeConfig(config);
			
			res.json('ok');
		}
		catch(err) {
			if(err instanceof TypeError)
				return res.status(400).json(err.message);
			throw err;
		}
	}
	async removeFilter(req, res) {
		try {
			const { index } = req.params;
			const filter = this.filters.get(index);
			const config = await this.readConfig();
			const configFilter = config.filters[index];

			if(!filter)
				throw new FilterDoesNotExist('Filter does not exist.');
			
			this.filters.remove(filter);
			config.filters.splice(config.filters.indexOf(configFilter), 1);

			await this.writeConfig(config);
			
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
	async updateFilterDebug(req, res) {
		try {
			const { index } = req.params;
			const filter = this.filters.get(index);
			const config = await this.readConfig();
			const configFilter = config.filters[index];
		
			if(!filter)
				throw new FilterDoesNotExist('Filter does not exist.');
			
			const debug = req.body.debug;
			filter.debug = debug;
			configFilter.debug = debug;

			await this.writeConfig(config);
			
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
	async getFilterDebugImage(req, res) {
		try {
			const { index } = req.params;
			const filter = this.filters.get(index);
			
			if(!filter)
				throw new FilterDoesNotExist('Filter does not exist.');

			const data = await filter.readDebugImage();
			res.set('Content-Type', 'image/jpeg');
			res.send(data);
		}
		catch(err) {
			console.error(err);
			if(err instanceof FilterDoesNotExist)
				return res.status(404).json(err.message);
			if(err instanceof TypeError)
				return res.status(400).json(err.message);
			if(err.code === 'ENOENT')
				return res.status(404).json(err.message);
			throw err;
		}
	}
	async updateFilterShapes(req, res) {
		try {
			const { index } = req.params;
			const filter = this.filters.get(index);
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

			await this.writeConfig(config);
			
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

			await this.writeConfig(config);
			
			res.json('ok');
		}
		catch(err) {
			if(err instanceof TypeError)
				return res.status(400).json(err.message);
			throw err;
		}
	}
	async addRecorder(req, res) {
		try {
			let recorder = null;
			switch(req.body.type) {
				case 'sqlite':
					recorder = SQLitePlateRecorder.fromObject(req.body);
					break;
				case 'mqtt':
					recorder = MQTTPlateRecorder.fromObject(req.body);
					break;
				case 'file':
					recorder = FilePlateRecorder.fromObject(req.body);
					break;
				default:
					throw new TypeError('Unrecognized filter type.');
			}

			const config = await this.readConfig();
			this.recorders.add(recorder);
			config.recorders.push(req.body);

			await this.writeConfig(config);
			
			res.json('ok');
		}
		catch(err) {
			if(err instanceof TypeError)
				return res.status(400).json(err.message);
			throw err;
		}
	}
	async removeRecorder(req, res) {
		try {
			const { index } = req.params;
			const recorder = this.recorders.get(index);
			const config = await this.readConfig();
			const configRecorder = config.recorders[index];

			if(!recorder)
				throw new RecorderDoesNotExist('Recorder does not exist.');
			
			this.recorders.remove(recorder);
			config.recorders.splice(config.recorders.indexOf(configRecorder), 1);

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
	async updateRecorderUrl(req, res) {
		try {
			const { index } = req.params;
			const recorder = this.recorders.get(index);
			const config = await this.readConfig();
			const configRecorder = config.recorders[index];
			
			if(!recorder)
				throw new RecorderDoesNotExist('Recorder does not exist.');
			if(!(recorder instanceof MQTTPlateRecorder))
				throw new TypeError('Recorder type must be "mqtt".');
			
			const url = new URL(req.body.url);
			recorder.url = url;
			configRecorder.url = url;

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
	async updateRecorderBaseTopic(req, res) {
		try {
			const { index } = req.params;
			const recorder = this.recorders.get(index);
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
	async updateRecorderHassDiscovery(req, res) {
		try {
			const { index } = req.params;
			const recorder = this.recorders.get(index);
			const config = await this.readConfig();
			const configRecorder = config.recorders[index];

			if(!recorder)
				throw new RecorderDoesNotExist('Recorder does not exist.');
			if(!(recorder instanceof MQTTPlateRecorder))
				throw new TypeError('Recorder type must be "mqtt".');
			
			const hassDiscovery = HassDiscovery.fromObject(req.body.hassDiscovery);
			recorder.hassDiscovery = hassDiscovery;
			configRecorder.hassDiscovery = hassDiscovery;

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
	async updateRecorderMqttOptions(req, res) {
		try {
			const { index } = req.params;
			const recorder = this.recorders.get(index);
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
			const recorder = this.recorders.get(index);
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
			const recorder = this.recorders.get(index);
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
		if(!(v instanceof MJPEGReadables))
			throw new TypeError('sources must be an instance of MJPEGReadables.');
		
		this.#sources = v;
	}
	get filters() {
		return this.#filters;
	}
	set filters(v) {
		if(!(v instanceof ImageFilters))
			throw new TypeError('filters must be an instance of ImageFilters.');
		
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
		if(!(v instanceof PlateRecorders))
			throw new TypeError('recorders must be an instance of PlateRecorders.');

		this.#recorders = v;
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');

		return new this(
			config.port || DEFAULT_REST_SERVER_PORT,
			config.enable !== undefined ? config.enable : DEFAULT_REST_SERVER_ENABLE
		);
	}
}
