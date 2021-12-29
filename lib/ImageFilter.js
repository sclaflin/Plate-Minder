import RawImage from './RawImage.js';
import FileOperationQueue from './FileOperationQueue.js';
import { DATA_PATH } from './constants.js';
import FileOperation, { FILE_OPERATION_OVERWRITE, FILE_OPERATION_READ } from './FileOperation.js';

export default class ImageFilter {
	#debug = false;
	#queue = null;
	constructor(debug, queue) {
		this.debug = debug;
		this.queue = queue;
	}
	get debug() {
		return this.#debug;
	}
	set debug(v) {
		if(typeof v !== 'boolean')
			throw new TypeError('debug must be a boolean.');
		this.#debug = v;
	}
	get queue() {
		return this.#queue;
	}
	set queue(v) {
		if(!(v instanceof FileOperationQueue))
			throw new TypeError('queue must be an instance of FileOperationQueue.');
		this.#queue = v;
	}
	next(rawImage) {
		if(!(rawImage instanceof RawImage))
			throw new TypeError('rawImage must be an instance of RawImage.');
		
		return rawImage;
	}
	async writeDebugImage(rawImage) {
		const buffer = await rawImage.toJpegBuffer();
		this.queue.addOperation(
			new FileOperation(
				buffer,
				FILE_OPERATION_OVERWRITE
			)
		);
	}
	async readDebugImage() {
		return await new Promise((resolve, reject) => {
			this.queue.addOperation(
				new FileOperation(
					null,
					FILE_OPERATION_READ,
					(err, data) => {
						if(err) return reject(err);
						resolve(data);
					}
				)
			);
		});
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');
		
		return new this(
			!!config.debug,
			FileOperationQueue.fromObject(
				config.queue ?? { file: `${DATA_PATH}/${this.name}.jpeg` }
			)
		);
	}
}
