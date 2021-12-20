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
import fs from 'fs/promises';
import RawImage from './RawImage.js';
import { DATA_PATH } from './constants.js';

export default class PlateMinder {
	#mjpegReadable = null;
	#mjpegToJpeg = null;
	#filters = [];
	#openAlprDetect = null;
	#recorders = [];

	constructor(mjpegReadable, mjpegToJpeg, filters, openAlprDetect, recorders) {
		if(!(mjpegReadable instanceof MJPEGReadable))
			throw new TypeError('mjpegReadable must be an instance of MJPEGReadable.');
		if(!(mjpegToJpeg instanceof MJPEGToJPEG))
			throw new TypeError('mjpegToJpeg must be an instance of MJPEGToJPEG.');
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

		this.#mjpegReadable = mjpegReadable;
		this.#mjpegToJpeg = mjpegToJpeg;
		this.#filters.push(...filters);
		this.#openAlprDetect = openAlprDetect;
		this.#recorders.push(...recorders);

		this.mjpegToJpeg.on('jpeg', (buffer) => this.next(buffer));
		this.mjpegReadable.pipe(this.mjpegToJpeg);
	}
	get mjpegReadable() {
		return this.#mjpegReadable;
	}
	get mjpegToJpeg() {
		return this.#mjpegToJpeg;
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
	async next(buffer) {
		//run the buffer through the filters
		// const start = new Date();
		//convert the jpeg buffer into a RawImage instance
		const rawImage = await RawImage.fromBuffer(buffer);
		for(const filter of this.filters) {
			await filter.next(rawImage);
			if(filter.debug)
				await fs.writeFile(`${DATA_PATH}/${filter.constructor.name}.jpeg`, await rawImage.toJpegBuffer());
		}
		//export a jpeg buffer
		buffer = await rawImage.toJpegBuffer();
		// console.log(`Time: ${(new Date()) - start}`);
		if(buffer.length === 0)
			return;

		//send the filtered buffer to OpenALPR
		const data = await this.openAlprDetect.detect(buffer);
		if(data.results.length === 0)
			return;

		//record the data
		for(const recorder of this.recorders)
			await recorder.record(data, buffer);
		
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');
		
		let mjpegReadable = null;
		switch(config.capture.type) {
			case 'rtsp':
				mjpegReadable = RTSPMJPEGReadable;
				break;
			case 'file':
				mjpegReadable = FileMJPEGReadable;
				break;
			default:
				throw new Error('Invalid MJPEGReadable type.');
		}

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

		const recorders = config.recorders.map(v => {
			switch(v.type) {
				case 'sqlite':
					return SQLitePlateRecorder.fromObject(v);
				case 'mqtt':
					return MQTTPlateRecorder.fromObject(v);
				default:
					throw new TypeError(`Unknown PlateRecorder type: ${v.type}.`);
			}
		});

		return new this(
			mjpegReadable.fromObject(config.capture),
			MJPEGToJPEG.fromObject({}),
			filters,
			OpenALPRDetect.fromObject(config.openALPR),
			recorders
		);
	}
}