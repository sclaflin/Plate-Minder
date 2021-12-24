import FileMJPEGReadable from './FileMJPEGReadable.js';
import RTSPMJPEGReadable from './RTSPMJPEGReadable.js';
import MJPEGToJPEG from './MJPEGToJPEG.js';
import MaskImageFilter from './MaskImageFilter.js';
import MotionImageFilter from './MotionImageFilter.js';
import OpenALPRDetect from './OpenALPRDetect.js';
import SQLitePlateRecorder from './SQLitePlateRecorder.js';
import MQTTPlateRecorder from './MQTTPlateRecorder.js';
import fs from 'fs/promises';
import RawImage from './RawImage.js';
import { DATA_PATH } from './constants.js';
import FilePlateRecorder from './FilePlateRecorder.js';
import RESTService from './RESTService.js';
import MJPEGReadables from './MJPEGReadables.js';
import ImageFilters from './ImageFilters.js';
import PlateRecorders from './PlateRecorders.js';

export default class PlateMinder {
	#sources = null;
	#sinkClass = null;
	#filters = null;
	#openAlprDetect = null;
	#recorders = null;
	#restService = null;

	constructor(sources, sinkClass, filters, openAlprDetect, recorders, restService) {
		if(!(sources instanceof MJPEGReadables))
			throw new TypeError('sources must be an instance of MJPEGReadables.');
		if(sinkClass !== MJPEGToJPEG && Object.prototype.isPrototypeOf.call(MJPEGToJPEG, sinkClass))
			throw new TypeError('sinkClass must be an MJPEGToJPEG class.');
		if(!(filters instanceof ImageFilters))
			throw new TypeError('filters must be an instance of ImageFilters.');
		if(!(openAlprDetect instanceof OpenALPRDetect))
			throw new TypeError('openAlprDetect must be an instance of OpenALPRDetect.');
		if(!(recorders instanceof PlateRecorders))
			throw new TypeError('recorders must be an instance of PlateRecorders.');
		if(!(restService instanceof RESTService))
			throw new TypeError('restService must be an instance of RESTService.');

		this.#sources = sources;
		this.#sinkClass = sinkClass;
		this.#filters = filters;
		this.#openAlprDetect = openAlprDetect;
		this.#recorders = recorders;
		this.#restService = restService;

		this.restService.sources = this.sources;
		this.restService.filters = this.filters;
		this.restService.openAlprDetect = this.openAlprDetect;
		this.restService.recorders = this.recorders;

		this.sources.on('add', (...sources) => {
			for(const source of sources) {
				source.on('failed', (code, errText) => {
					console.error(`${source.name} source failed: ${errText}`);
				});
				const sink = this.sinkClass.fromObject({});
				sink.on('jpeg', buffer => this.next(buffer, source));
				source.pipe(sink);
			}
		});
		this.sources.on('remove', (...sources) => {
			for(const source of sources) {
				source.stop();
			}
		});
		this.recorders.on('add', (...recorders) => {
			for(const recorder of recorders)
				recorder.start();
		});
		this.recorders.on('remove', (...recorders) => {
			for(const recorder of recorders)
				recorder.stop();
		});
		
	}
	get sources() {
		return this.#sources;
	}
	get sinkClass() {
		return this.#sinkClass;
	}
	get filters() {
		return this.#filters;
	}
	get openAlprDetect() {
		return this.#openAlprDetect;
	}
	get recorders() {
		return this.#recorders;
	}
	get restService() {
		return this.#restService;
	}
	async next(buffer, source) {
		//run the buffer through the filters
		// const start = new Date();
		//convert the jpeg buffer into a RawImage instance
		const original = await RawImage.fromBuffer(buffer);
		const filtered = await RawImage.copy(original);
		for(const filter of this.filters) {
			await filter.next(filtered);
			if(filter.debug)
				await fs.writeFile(`${DATA_PATH}/${source.name}_${filter.constructor.name}.jpeg`, await filtered.toJpegBuffer());
		}
		// console.log(`Time: ${(new Date()) - start}`);
		if(filtered.buffer.length === 0)
			return;

		//send the filtered buffer to OpenALPR
		const data = await this.openAlprDetect.detect(filtered);
		if(data.results.length === 0)
			return;

		//mark the ROI in the original image
		await original.markRoi(filtered.cropData);

		//record the data
		for(const recorder of this.recorders)
			await recorder.record(data, source, original, filtered);
		
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');
		const sources = (config.sources || []).map(v => {
			switch(v.type) {
				case 'rtsp':
					return RTSPMJPEGReadable.fromObject(v);
				case 'file':
					return FileMJPEGReadable.fromObject(v);
				default:
					throw new TypeError('Invalid MJPEGReadable type.');
			}
		});
		const filters = (config.filters || []).map(v => {
			switch(v.type) {
				case 'motion':
					return MotionImageFilter.fromObject(v);
				case 'mask':
					return MaskImageFilter.fromObject(v);
				default:
					throw new TypeError(`Unknown JPEGFilter type: ${v.type}.`);
			}
		});
		const recorders = (config.recorders || []).map(v => {
			switch(v.type) {
				case 'sqlite':
					return SQLitePlateRecorder.fromObject(v);
				case 'mqtt':
					return MQTTPlateRecorder.fromObject(v);
				case 'file':
					return FilePlateRecorder.fromObject(v);
				default:
					throw new TypeError(`Unknown PlateRecorder type: ${v.type}.`);
			}
		});

		const plateMinder = new this(
			new MJPEGReadables(),
			MJPEGToJPEG,
			new ImageFilters(),
			OpenALPRDetect.fromObject(config.openALPR),
			new PlateRecorders(),
			RESTService.fromObject(config.restService || {})
		);
		plateMinder.sources.add(...sources);
		plateMinder.filters.add(...filters);
		plateMinder.recorders.add(...recorders);

		return plateMinder;
	}
}
