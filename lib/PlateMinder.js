import FileMJPEGReadable from './FileMJPEGReadable.js';
import RTSPMJPEGReadable from './RTSPMJPEGReadable.js';
import MJPEGReadable from './MJPEGReadable.js';
import MJPEGToJPEG from './MJPEGToJPEG.js';
import MaskImageFilter from './MaskImageFilter.js';
import MotionImageFilter from './MotionImageFilter.js';
import ImageFilter from './ImageFilter.js';
import OpenALPRDetect from './OpenALPRDetect.js';
import PlateRecorder from './PlateRecorder.js';
import SQLitePlateRecorder from './SQLitePlateRecorder.js';
import MQTTPlateRecorder from './MQTTPlateRecorder.js';
import fs from 'fs/promises';
import RawImage from './RawImage.js';
import { DATA_PATH } from './constants.js';
import FilePlateRecorder from './FilePlateRecorder.js';
import RESTServer from './RESTServer.js';

export default class PlateMinder {
	#sources = [];
	#sinks = [];
	#filters = [];
	#openAlprDetect = null;
	#recorders = [];
	#restServer = null;

	constructor(sources, sinkClass, filters, openAlprDetect, recorders, restServer) {
		if(!Array.isArray(sources))
			throw new TypeError('sources must be an array.');
		for(const source of sources) {
			if(!(source instanceof MJPEGReadable))
				throw new TypeError('sources array must only contain instances of MJPEGReadable.');
		}
		if(sinkClass !== MJPEGToJPEG && Object.prototype.isPrototypeOf.call(MJPEGToJPEG, sinkClass))
			throw new TypeError('sinkClass must be an MJPEGToJPEG class.');
		if(!Array.isArray(filters))
			throw new TypeError('filters must be an array.');
		for(const filter of filters) {
			if(!(filter instanceof ImageFilter))
				throw new TypeError('filters array must only contain instances of JPEGFilter.');
		}
		if(!(openAlprDetect instanceof OpenALPRDetect))
			throw new TypeError('openAlprDetect must be an instance of OpenALPRDetect.');
		if(!Array.isArray(recorders))
			throw new TypeError('recorders must be an array.');
		for(const recorder of recorders) {
			if(!(recorder instanceof PlateRecorder))
				throw new TypeError('recorders array must only contain instances of PlateRecorder.');
		}
		if(!(restServer instanceof RESTServer))
			throw new TypeError('restServer must be an instance of RESTServer.');

		this.#sources = sources;
		this.#filters.push(...filters);
		this.#openAlprDetect = openAlprDetect;
		this.#recorders.push(...recorders);
		this.#restServer = restServer;
		
		this.restServer.sources = this.sources;
		this.restServer.filters = this.filters;
		this.restServer.openAlprDetect = this.openAlprDetect;
		this.restServer.recorders = this.recorders;
		this.restServer.listen();

		for(const source of this.sources) {
			const sink = sinkClass.fromObject({});
			sink.on('jpeg', buffer => this.next(buffer, source));
			source.pipe(sink);
		}
	}
	get sources() {
		return this.#sources;
	}
	get filters() {
		return this.#filters.slice(0);
	}
	get openAlprDetect() {
		return this.#openAlprDetect;
	}
	get recorders() {
		return this.#recorders.slice(0);
	}
	get restServer() {
		return this.#restServer;
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

		return new this(
			sources,
			MJPEGToJPEG,
			filters,
			OpenALPRDetect.fromObject(config.openALPR),
			recorders,
			RESTServer.fromObject(config.restServer || {})
		);
	}
}
